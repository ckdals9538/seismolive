// ============================================================================
// SEISMOLIVE v4.0 — Cloudflare Worker Security, CORS & Edge Cache Utilities
// ============================================================================

const PROD_ORIGIN_RE = /^https:\/\/(?:[a-z0-9-]+\.)?seismolive\.ckdals9538\.workers\.dev$/i;
const LOCAL_ORIGIN_RE = /^https?:\/\/(?:localhost|127\.0\.0\.1)(?::\d{1,5})?$/i;

export function isAllowedOrigin(origin) {
  if (!origin || typeof origin !== 'string') return false;
  return PROD_ORIGIN_RE.test(origin) || LOCAL_ORIGIN_RE.test(origin);
}

export function getCorsHeaders(request, { allowMethods = 'GET, OPTIONS' } = {}) {
  const origin = request?.headers?.get?.('Origin') || null;
  const headers = {
    'Vary': 'Origin'
  };
  if (origin && isAllowedOrigin(origin)) {
    headers['Access-Control-Allow-Origin'] = origin;
    headers['Access-Control-Allow-Methods'] = allowMethods;
    headers['Access-Control-Max-Age'] = '600';
  }
  return headers;
}

export function buildContentSecurityPolicy({ isHttps = true } = {}) {
  const directives = [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com data:",
    "img-src 'self' data: blob: https://elevation-tiles-prod.s3.amazonaws.com",
    "connect-src 'self' https://earthquake.usgs.gov https://elevation-tiles-prod.s3.amazonaws.com https://nominatim.openstreetmap.org https://api.openstreetmap.org https://overpass-api.de",
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "frame-ancestors 'none'",
    "form-action 'self'"
  ];
  if (isHttps) {
    directives.push('upgrade-insecure-requests');
  }
  return directives.join('; ');
}

export function applySecurityHeaders(headersInput, request, { isHtml = false } = {}) {
  const headers = headersInput instanceof Headers ? new Headers(headersInput) : new Headers(headersInput || {});
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('X-Frame-Options', 'DENY');
  headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  headers.set('Permissions-Policy', 'geolocation=(self), camera=(), microphone=()');
  headers.set('Cross-Origin-Opener-Policy', 'same-origin');

  if (isHtml) {
    let isHttps = true;
    try {
      isHttps = new URL(request?.url || 'https://seismolive.ckdals9538.workers.dev').protocol === 'https:';
    } catch {
      isHttps = true;
    }
    headers.set('Content-Security-Policy', buildContentSecurityPolicy({ isHttps }));
  }
  return headers;
}

export function jsonApiResponse(body, {
  request = null,
  status = 200,
  maxAgeSec = 60,
  swrSec = null
} = {}) {
  const swr = swrSec ?? maxAgeSec * 2;
  const cacheHeader = maxAgeSec > 0
    ? `public, max-age=${maxAgeSec}, s-maxage=${maxAgeSec}, stale-while-revalidate=${swr}`
    : 'no-store';

  const baseHeaders = {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': cacheHeader,
    ...getCorsHeaders(request)
  };
  const headers = applySecurityHeaders(baseHeaders, request, { isHtml: false });
  return new Response(JSON.stringify(body), { status, headers });
}

export function validateOriginForApi(request) {
  const origin = request?.headers?.get?.('Origin') || null;
  if (origin && !isAllowedOrigin(origin)) {
    return jsonApiResponse({ ok: false, error: 'FORBIDDEN_ORIGIN' }, {
      request,
      status: 403,
      maxAgeSec: 0
    });
  }
  return null;
}

/**
 * Shared Cloudflare Cache API wrapper (`caches.default`) for `/api/*` endpoints.
 * Falls back transparently when executed in Node/Deno unit-test runtimes.
 */
export async function withEdgeCache({ request, ctx, cacheKeyUrl, ttlSec = 60, fetcher }) {
  const cacheStorage = typeof caches !== 'undefined' && caches?.default ? caches.default : null;
  const keyReq = cacheKeyUrl ? new Request(cacheKeyUrl, { method: 'GET' }) : null;

  if (cacheStorage && keyReq) {
    try {
      const hit = await cacheStorage.match(keyReq);
      if (hit) {
        const clonedHeaders = applySecurityHeaders(hit.headers, request, { isHtml: false });
        const cors = getCorsHeaders(request);
        for (const [k, v] of Object.entries(cors)) clonedHeaders.set(k, v);
        clonedHeaders.set('X-Seismolive-Cache', 'HIT');
        return new Response(hit.body, {
          status: hit.status,
          headers: clonedHeaders
        });
      }
    } catch {
      // Cache lookup error should never break upstream live response
    }
  }

  const result = await fetcher();
  const payload = result?.body ?? result;
  const status = result?.status ?? 200;
  const shouldCache = Boolean(result?.cacheable && status === 200 && cacheStorage && keyReq && ttlSec > 0);

  const res = jsonApiResponse(payload, {
    request,
    status,
    maxAgeSec: shouldCache ? ttlSec : Math.min(ttlSec, 30)
  });

  if (shouldCache) {
    const cacheableRes = new Response(JSON.stringify(payload), {
      status: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': `public, max-age=${ttlSec}, s-maxage=${ttlSec}, stale-while-revalidate=${ttlSec * 2}`
      }
    });
    const putPromise = cacheStorage.put(keyReq, cacheableRes).catch(() => {});
    if (ctx && typeof ctx.waitUntil === 'function') {
      ctx.waitUntil(putPromise);
    } else {
      await putPromise;
    }
  }

  res.headers.set('X-Seismolive-Cache', shouldCache ? 'MISS-STORED' : 'BYPASS');
  return res;
}
