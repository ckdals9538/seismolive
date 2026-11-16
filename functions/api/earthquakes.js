// Cloudflare Worker / Pages Function: /api/earthquakes
// Aggregates live USGS global + Korea/East-Asia feeds and optional KMA APIHub official bulletins.
// Never synthesizes fake KMA records when KMA_API_KEY is absent; enforces edge caching & input bounds.

import { validateOriginForApi, withEdgeCache } from '../_shared/security.js';

function parseKmaItems(rawText) {
  try {
    const parsed = JSON.parse(rawText);
    const items = parsed?.response?.body?.items?.item;
    const list = Array.isArray(items) ? items : (items ? [items] : []);
    return list
      .map(it => {
        const lat = Number(it.lat);
        const lon = Number(it.lon);
        const mag = Number(it.mt);
        const dep = it.dep !== undefined && it.dep !== '' ? Number(it.dep) : null;
        const tmEqk = String(it.tmEqk || '');
        let occurredAtMs = null;
        if (/^\d{14}$/.test(tmEqk)) {
          const iso = `${tmEqk.slice(0, 4)}-${tmEqk.slice(4, 6)}-${tmEqk.slice(6, 8)}T${tmEqk.slice(8, 10)}:${tmEqk.slice(10, 12)}:${tmEqk.slice(12, 14)}+09:00`;
          const ms = Date.parse(iso);
          if (Number.isFinite(ms)) occurredAtMs = ms;
        }
        if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
        return {
          id: `kma_${tmEqk || Date.now()}_${it.tmSeq || ''}`.replace(/_+$/, ''),
          lat,
          lon,
          mag: Number.isFinite(mag) && mag > 0 ? mag : null,
          depthKm: Number.isFinite(dep) && dep > 0 ? dep : null,
          occurredAtMs,
          place: String(it.loc || '대한민국 지진 관측').slice(0, 160),
          sourceName: '대한민국 기상청(KMA) 실시간 통보',
          recordType: 'kma-live',
          verification: 'kma-official'
        };
      })
      .filter(Boolean);
  } catch {
    return [];
  }
}

export async function onRequestGet({ request, env, ctx }) {
  const blocked = validateOriginForApi(request);
  if (blocked) return blocked;

  const reqUrl = new URL(request.url);
  const rawMinMag = Number(reqUrl.searchParams.get('minMag'));
  const minMagKorea = Number.isFinite(rawMinMag) ? Number(Math.min(9.5, Math.max(-1.0, rawMinMag)).toFixed(1)) : 2.0;
  const rawDays = Number(reqUrl.searchParams.get('days'));
  const days = Number.isFinite(rawDays) ? Math.round(Math.min(30, Math.max(1, rawDays))) : 14;

  const cacheKeyUrl = `${reqUrl.origin}/__edge_cache/earthquakes?minMag=${minMagKorea}&days=${days}`;

  return withEdgeCache({
    request,
    ctx,
    cacheKeyUrl,
    ttlSec: 60,
    fetcher: async () => {
      const startIso = new Date(Date.now() - days * 86400_000).toISOString();
      const usgsGlobalUrl = 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/4.5_month.geojson';
      const usgsRegionalUrl =
        `https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&starttime=${encodeURIComponent(startIso)}` +
        `&minlatitude=31&maxlatitude=44&minlongitude=122&maxlongitude=134&minmagnitude=${minMagKorea}`;

      const [globalRes, regionalRes] = await Promise.allSettled([
        fetch(usgsGlobalUrl, { signal: AbortSignal.timeout(4500) }),
        fetch(usgsRegionalUrl, { signal: AbortSignal.timeout(4500) })
      ]);

      let usgsGlobalFeatures = [];
      let usgsRegionalFeatures = [];
      let usgsStatus = 'UNAVAILABLE';

      if (globalRes.status === 'fulfilled' && globalRes.value.ok) {
        const gj = await globalRes.value.json();
        usgsGlobalFeatures = Array.isArray(gj.features) ? gj.features : [];
        usgsStatus = 'LIVE';
      }
      if (regionalRes.status === 'fulfilled' && regionalRes.value.ok) {
        const rj = await regionalRes.value.json();
        usgsRegionalFeatures = Array.isArray(rj.features) ? rj.features : [];
        usgsStatus = 'LIVE';
      }

      let kmaEvents = [];
      let kmaStatus = env?.KMA_API_KEY ? 'UNAVAILABLE' : 'API_KEY_NOT_CONFIGURED';
      if (env?.KMA_API_KEY) {
        try {
          const kstNow = new Date(Date.now() + 9 * 3600 * 1000);
          const kstFrom = new Date(kstNow.getTime() - 3 * 86400 * 1000);
          const fmtYmd = (d) => d.toISOString().slice(0, 10).replace(/-/g, '');
          const kmaUrl = `https://apihub.kma.go.kr/api/typ02/openApi/EqkInfoService/getEqkMsg?pageNo=1&numOfRows=30&dataType=JSON&fromTmFc=${fmtYmd(kstFrom)}&toTmFc=${fmtYmd(kstNow)}&authKey=${encodeURIComponent(env.KMA_API_KEY)}`;
          const kr = await fetch(kmaUrl, { signal: AbortSignal.timeout(4500) });
          if (kr.ok) {
            kmaEvents = parseKmaItems(await kr.text());
            kmaStatus = 'LIVE';
          }
        } catch {
          kmaStatus = 'FETCH_FAILED';
        }
      }

      return {
        status: 200,
        cacheable: usgsStatus === 'LIVE' || kmaStatus === 'LIVE',
        body: {
          ok: true,
          serverTime: new Date().toISOString(),
          agencies: {
            usgs: { status: usgsStatus, globalCount: usgsGlobalFeatures.length, regionalCount: usgsRegionalFeatures.length },
            kma: { status: kmaStatus, count: kmaEvents.length }
          },
          usgsGlobalFeatures,
          usgsRegionalFeatures,
          kmaEvents
        }
      };
    }
  });
}
