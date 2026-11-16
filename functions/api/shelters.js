// Cloudflare Worker / Pages Function: /api/shelters
// Queries official Korean MOIS (행정안전부 지진옥외대피장소) open dataset when MOIS_API_KEY is provisioned.
// Separates statutory/official designation ("VERIFIED") from post-earthquake operational status ("UNVERIFIED_IN_DISASTER").
// Edge-caches both the upstream MOIS dataset (300s) and quantized spatial slice responses (180s).

import { jsonApiResponse, validateOriginForApi, withEdgeCache } from '../_shared/security.js';

function haversineMeters(lat1, lon1, lat2, lon2) {
  const r = Math.PI / 180;
  const dp = (lat2 - lat1) * r;
  const dl = (lon2 - lon1) * r;
  const a = Math.sin(dp * 0.5) ** 2 + Math.cos(lat1 * r) * Math.cos(lat2 * r) * Math.sin(dl * 0.5) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(Math.max(0, 1 - a)));
}

async function fetchCachedMoisDataset(request, env, ctx) {
  const apiKey = env?.MOIS_API_KEY || env?.SAFETYDATA_API_KEY || null;
  if (!apiKey) return { ok: false, status: 'OFFICIAL_API_KEY_REQUIRED', rows: [] };

  const reqOrigin = new URL(request.url).origin;
  const upstreamKey = new Request(`${reqOrigin}/__edge_cache/mois-upstream-shelters-v1`, { method: 'GET' });
  const cacheStorage = typeof caches !== 'undefined' && caches?.default ? caches.default : null;

  if (cacheStorage) {
    try {
      const cached = await cacheStorage.match(upstreamKey);
      if (cached) {
        const parsed = await cached.json();
        if (Array.isArray(parsed?.rows)) {
          return { ok: true, status: 'LIVE', rows: parsed.rows };
        }
      }
    } catch {}
  }

  const apiUrl = `https://www.safetydata.go.kr/V2/api/DSSP-IF-10943?serviceKey=${encodeURIComponent(apiKey)}&numOfRows=500&pageNo=1&returnType=json`;
  const resp = await fetch(apiUrl, { signal: AbortSignal.timeout(5000) });
  if (!resp.ok) {
    return { ok: false, status: 'UPSTREAM_ERROR', rows: [] };
  }
  const json = await resp.json();
  const rows = Array.isArray(json?.body) ? json.body : (Array.isArray(json?.items) ? json.items : []);

  if (cacheStorage && rows.length > 0) {
    const cacheRes = new Response(JSON.stringify({ rows }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'public, max-age=300, s-maxage=300'
      }
    });
    const putTask = cacheStorage.put(upstreamKey, cacheRes).catch(() => {});
    if (ctx && typeof ctx.waitUntil === 'function') ctx.waitUntil(putTask);
    else await putTask;
  }

  return { ok: true, status: 'LIVE', rows };
}

export async function onRequestGet({ request, env, ctx }) {
  const blocked = validateOriginForApi(request);
  if (blocked) return blocked;

  const url = new URL(request.url);
  const rawLat = url.searchParams.get('lat');
  const rawLon = url.searchParams.get('lon');
  const lat = rawLat !== null && rawLat !== '' ? Number(rawLat) : NaN;
  const lon = rawLon !== null && rawLon !== '' ? Number(rawLon) : NaN;
  const rawRadius = Number(url.searchParams.get('radiusM'));
  const radiusM = Number.isFinite(rawRadius) ? Math.min(5000, Math.max(300, rawRadius)) : 2500;

  if (!Number.isFinite(lat) || !Number.isFinite(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
    return jsonApiResponse({ ok: false, status: 'INVALID_COORDINATES', shelters: [] }, {
      request,
      status: 400,
      maxAgeSec: 0
    });
  }

  const apiKey = env?.MOIS_API_KEY || env?.SAFETYDATA_API_KEY || null;
  if (!apiKey) {
    return jsonApiResponse({
      ok: true,
      status: 'OFFICIAL_API_KEY_REQUIRED',
      source: '행정안전부 지진옥외대피장소 API (미연동 — OSM 조건부 후보 사용)',
      shelters: []
    }, { request, status: 200, maxAgeSec: 300 });
  }

  const qLat = lat.toFixed(2);
  const qLon = lon.toFixed(2);
  const qRad = Math.round(radiusM / 100) * 100;
  const cacheKeyUrl = `${url.origin}/__edge_cache/shelters?lat=${qLat}&lon=${qLon}&radiusM=${qRad}`;

  return withEdgeCache({
    request,
    ctx,
    cacheKeyUrl,
    ttlSec: 180,
    fetcher: async () => {
      try {
        const upstream = await fetchCachedMoisDataset(request, env, ctx);
        if (!upstream.ok) {
          return {
            status: 200,
            cacheable: false,
            body: { ok: false, status: upstream.status, shelters: [] }
          };
        }

        const matched = [];
        for (const row of upstream.rows) {
          const rLat = Number(row.LA ?? row.lat ?? row.YCORD);
          const rLon = Number(row.LO ?? row.lon ?? row.XCORD);
          if (!Number.isFinite(rLat) || !Number.isFinite(rLon)) continue;
          const distM = haversineMeters(lat, lon, rLat, rLon);
          if (distM <= radiusM) {
            const areaM2 = Number(row.AR ?? row.FCLTY_AR);
            const cap = Number(row.ACEPTNC_NMPR ?? row.VT_ACMD_PSBL_NMPR);
            matched.push({
              id: String(row.MNG_SN || row.SN || `MOIS_${matched.length}`).slice(0, 64),
              officialId: String(row.MNG_SN || row.SN || '').slice(0, 64),
              name: String(row.VT_ACMD_FCLTY_NM || row.SHLT_NM || '지진옥외대피장소').slice(0, 120),
              address: row.RN_DTL_ADRES || row.DTL_ADRES ? String(row.RN_DTL_ADRES || row.DTL_ADRES).slice(0, 160) : null,
              lat: rLat,
              lon: rLon,
              distanceMeters: Math.round(distM),
              areaSqMeters: Number.isFinite(areaM2) && areaM2 > 0 ? Math.round(areaM2) : null,
              capacityEstimate: Number.isFinite(cap) && cap > 0 ? Math.round(cap) : null,
              designationStatus: 'OFFICIAL_DESIGNATED',
              operationalStatus: 'UNVERIFIED_IN_DISASTER',
              sourceName: '행정안전부 지진옥외대피장소 공식 DB'
            });
          }
        }

        matched.sort((a, b) => a.distanceMeters - b.distanceMeters);
        return {
          status: 200,
          cacheable: true,
          body: {
            ok: true,
            status: matched.length > 0 ? 'OFFICIAL_LIVE' : 'NONE_WITHIN_RADIUS',
            source: '행정안전부 지진옥외대피장소 실시간 연계',
            shelters: matched.slice(0, 12)
          }
        };
      } catch {
        return {
          status: 200,
          cacheable: false,
          body: {
            ok: false,
            status: 'FETCH_TIMEOUT',
            shelters: []
          }
        };
      }
    }
  });
}
