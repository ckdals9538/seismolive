import { onRequestGet as earthquakesGet } from './functions/api/earthquakes.js';
import { onRequestGet as sheltersGet } from './functions/api/shelters.js';
import { onRequestGet as shakemapGet } from './functions/api/shakemap.js';

const API_ROUTES = {
  '/api/earthquakes': earthquakesGet,
  '/api/shelters': sheltersGet,
  '/api/shakemap': shakemapGet
};

/**
 * Cloudflare Workers entrypoint bridging static assets (`env.ASSETS`) and
 * `/api/*` seismic/shelter proxy handlers when deployed to `*.workers.dev`.
 */
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (request.method === 'OPTIONS' && API_ROUTES[url.pathname]) {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, OPTIONS'
        }
      });
    }

    const handler = API_ROUTES[url.pathname];
    if (handler && request.method === 'GET') {
      return handler({ request, env, ctx });
    }

    if (env?.ASSETS?.fetch) {
      return env.ASSETS.fetch(request);
    }
    return new Response('Not Found', { status: 404 });
  }
};
