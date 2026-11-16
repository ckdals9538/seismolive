import { onRequestGet as earthquakesGet } from './functions/api/earthquakes.js';
import { onRequestGet as sheltersGet } from './functions/api/shelters.js';
import { onRequestGet as shakemapGet } from './functions/api/shakemap.js';
import {
  applySecurityHeaders,
  getCorsHeaders,
  jsonApiResponse,
  validateOriginForApi
} from './functions/_shared/security.js';

const API_ROUTES = {
  '/api/earthquakes': earthquakesGet,
  '/api/shelters': sheltersGet,
  '/api/shakemap': shakemapGet
};

function isHtmlRequestOrResponse(pathname, contentType) {
  if (contentType && contentType.toLowerCase().includes('text/html')) return true;
  return pathname === '/' || pathname.endsWith('.html');
}

/**
 * Cloudflare Workers entrypoint bridging static assets (`env.ASSETS`) and
 * `/api/*` seismic/shelter proxy handlers with strict CORS, security headers, and caching.
 */
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const isApiPath = Boolean(API_ROUTES[url.pathname]);

    if (isApiPath) {
      const originBlock = validateOriginForApi(request);
      if (originBlock) return originBlock;

      if (request.method === 'OPTIONS') {
        const hdrs = applySecurityHeaders(getCorsHeaders(request), request, { isHtml: false });
        return new Response(null, { status: 204, headers: hdrs });
      }

      if (request.method === 'GET') {
        return API_ROUTES[url.pathname]({ request, env, ctx });
      }
      return jsonApiResponse({ ok: false, error: 'METHOD_NOT_ALLOWED' }, { request, status: 405, maxAgeSec: 0 });
    }

    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return new Response('Method Not Allowed', { status: 405 });
    }

    if (env?.ASSETS?.fetch) {
      const assetRes = await env.ASSETS.fetch(request);
      const contentType = assetRes.headers.get('Content-Type') || '';
      const isHtml = isHtmlRequestOrResponse(url.pathname, contentType);
      const securedHeaders = applySecurityHeaders(assetRes.headers, request, { isHtml });

      if (isHtml) {
        securedHeaders.set('Cache-Control', 'public, max-age=60, must-revalidate');
      } else if (url.pathname.startsWith('/assets/terrain/') && (url.pathname.endsWith('.bin') || url.pathname.endsWith('.json'))) {
        securedHeaders.set('Cache-Control', 'public, max-age=86400');
      } else if (url.searchParams.has('v') && (url.pathname.endsWith('.js') || url.pathname.endsWith('.css'))) {
        securedHeaders.set('Cache-Control', 'public, max-age=3600, stale-while-revalidate=86400');
      } else if (!securedHeaders.has('Cache-Control')) {
        securedHeaders.set('Cache-Control', 'public, max-age=300, must-revalidate');
      }

      return new Response(assetRes.body, {
        status: assetRes.status,
        statusText: assetRes.statusText,
        headers: securedHeaders
      });
    }

    return new Response('Not Found', {
      status: 404,
      headers: applySecurityHeaders({}, request, { isHtml: false })
    });
  }
};
