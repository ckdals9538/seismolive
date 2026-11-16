// Cloudflare Worker / Pages Function: /api/shakemap
// Strict allowlisted proxy for USGS event detail + ShakeMap stationlist.json strong-motion telemetry.

import { jsonApiResponse, validateOriginForApi, withEdgeCache } from '../_shared/security.js';

const ALLOWED_USGS_PATH_RE = /^\/(?:fdsnws\/event\/1\/|earthquakes\/feed\/v1\.0\/|archive\/product\/shakemap\/)/i;

export function isAllowedUsgsUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string' || rawUrl.length > 512) return false;
  try {
    const parsed = new URL(rawUrl);
    return (
      parsed.protocol === 'https:' &&
      parsed.hostname === 'earthquake.usgs.gov' &&
      !parsed.username &&
      !parsed.password &&
      ALLOWED_USGS_PATH_RE.test(parsed.pathname)
    );
  } catch {
    return false;
  }
}

export async function onRequestGet({ request, ctx }) {
  const blocked = validateOriginForApi(request);
  if (blocked) return blocked;

  const url = new URL(request.url);
  const detailUrl = url.searchParams.get('detailUrl');
  if (!detailUrl || !isAllowedUsgsUrl(detailUrl)) {
    return jsonApiResponse({ ok: false, error: 'INVALID_OR_UNTRUSTED_USGS_URL' }, {
      request,
      status: 400,
      maxAgeSec: 0
    });
  }

  const cacheKeyUrl = `${url.origin}/__edge_cache/shakemap?detailUrl=${encodeURIComponent(detailUrl)}`;

  return withEdgeCache({
    request,
    ctx,
    cacheKeyUrl,
    ttlSec: 180,
    fetcher: async () => {
      try {
        const detailResp = await fetch(detailUrl, { signal: AbortSignal.timeout(4500) });
        if (!detailResp.ok) {
          return { status: 200, cacheable: false, body: { ok: false, status: 'DETAIL_UNAVAILABLE' } };
        }
        const detailJson = await detailResp.json();
        const smList = detailJson?.properties?.products?.shakemap || [];
        const smContents = smList[0]?.contents || {};
        const stationUrl = smContents['download/stationlist.json']?.url || smContents['stationlist.json']?.url || null;

        let stationFeatures = null;
        if (stationUrl && isAllowedUsgsUrl(stationUrl)) {
          try {
            const stResp = await fetch(stationUrl, { signal: AbortSignal.timeout(4000) });
            if (stResp.ok) {
              const stJson = await stResp.json();
              stationFeatures = Array.isArray(stJson.features) ? stJson.features.slice(0, 24) : null;
            }
          } catch {}
        }

        return {
          status: 200,
          cacheable: true,
          body: {
            ok: true,
            detailJson,
            stationFeatures
          }
        };
      } catch {
        return {
          status: 200,
          cacheable: false,
          body: { ok: false, error: 'FETCH_UNAVAILABLE' }
        };
      }
    }
  });
}
