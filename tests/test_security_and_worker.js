// ============================================================================
// SEISMOLIVE v4.0 — Security Hardening, CORS, CSP & Proxy Validation Tests
// ============================================================================

import workerDefault from '../worker.js';
import { onRequestGet as shakemapGet, isAllowedUsgsUrl } from '../functions/api/shakemap.js';
import { onRequestGet as sheltersGet } from '../functions/api/shelters.js';
import {
  isAllowedOrigin,
  buildContentSecurityPolicy,
  validateOriginForApi
} from '../functions/_shared/security.js';
import { escapeHtml, sanitizeExternalHref } from '../js/lib/htmlEscape.js';

let passed = 0;
let failed = 0;

function assert(cond, label, extra = '') {
  if (cond) {
    passed++;
    console.log(`  [PASS] ${label}${extra ? ' -> ' + extra : ''}`);
  } else {
    failed++;
    console.error(`  [FAIL] ${label}${extra ? ' -> ' + extra : ''}`);
  }
}

console.log('====================================================================');
console.log('SEISMOLIVE v4.0 — Security, CORS, CSP, XSS & Proxy Bounds Suite');
console.log('====================================================================');

// 1. HTML Escaping & URL Sanitization
assert(
  escapeHtml('<img src=x onerror="alert(1)"> & \'한글\'') === '&lt;img src=x onerror=&quot;alert(1)&quot;&gt; &amp; &#39;한글&#39;',
  '1.1: escapeHtml neutralizes HTML/attribute injection while preserving Korean text'
);
assert(
  sanitizeExternalHref('javascript:alert(1)') === null &&
  sanitizeExternalHref('data:text/html,<script>alert(1)</script>') === null &&
  sanitizeExternalHref('https://earthquake.usgs.gov/earthquakes/eventpage/us6000jllz') === 'https://earthquake.usgs.gov/earthquakes/eventpage/us6000jllz',
  '1.2: sanitizeExternalHref permits http/https only and rejects javascript:/data: URIs'
);

// 2. Origin Allowlist & CORS Rejection
assert(
  isAllowedOrigin('https://seismolive.ckdals9538.workers.dev') &&
  isAllowedOrigin('http://127.0.0.1:4189') &&
  isAllowedOrigin('http://localhost:8787') &&
  !isAllowedOrigin('https://evil-attacker.example') &&
  !isAllowedOrigin('https://seismolive.ckdals9538.workers.dev.evil.com'),
  '2.1: Origin allowlist permits prod workers.dev & localhost only (blocks spoofing)'
);

const blockedOptRes = await workerDefault.fetch(
  new Request('https://seismolive.ckdals9538.workers.dev/api/earthquakes', {
    method: 'OPTIONS',
    headers: { Origin: 'https://evil-attacker.example' }
  }),
  {},
  {}
);
assert(
  blockedOptRes.status === 403 && !blockedOptRes.headers.get('Access-Control-Allow-Origin'),
  '2.2: Disallowed Origin receives 403 without Access-Control-Allow-Origin wildcard'
);

const allowedOptRes = await workerDefault.fetch(
  new Request('https://seismolive.ckdals9538.workers.dev/api/earthquakes', {
    method: 'OPTIONS',
    headers: { Origin: 'https://seismolive.ckdals9538.workers.dev' }
  }),
  {},
  {}
);
assert(
  allowedOptRes.status === 204 &&
  allowedOptRes.headers.get('Access-Control-Allow-Origin') === 'https://seismolive.ckdals9538.workers.dev' &&
  allowedOptRes.headers.get('Vary') === 'Origin',
  '2.3: Trusted Origin OPTIONS reflects exact origin with Vary: Origin'
);

// 3. Static Asset Security Headers & Strict CSP
const assetMockEnv = {
  ASSETS: {
    fetch: async () => new Response('<!doctype html><html><body>ok</body></html>', {
      status: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8' }
    })
  }
};
const htmlRes = await workerDefault.fetch(
  new Request('https://seismolive.ckdals9538.workers.dev/index.html', { method: 'GET' }),
  assetMockEnv,
  {}
);
const csp = htmlRes.headers.get('Content-Security-Policy') || '';
assert(
  csp.includes("script-src 'self'") &&
  !csp.includes("script-src 'self' 'unsafe-inline'") &&
  csp.includes("frame-ancestors 'none'") &&
  htmlRes.headers.get('X-Frame-Options') === 'DENY' &&
  htmlRes.headers.get('X-Content-Type-Options') === 'nosniff' &&
  (htmlRes.headers.get('Permissions-Policy') || '').includes('geolocation=(self)'),
  '3.1: Static HTML assets enforce Strict CSP (no unsafe-inline script), DENY frame-options & nosniff',
  `cspLen=${csp.length}`
);

const binMockEnv = {
  ASSETS: {
    fetch: async () => new Response(new Uint8Array([1, 2, 3]), {
      status: 200,
      headers: { 'Content-Type': 'application/octet-stream' }
    })
  }
};
const binRes = await workerDefault.fetch(
  new Request('https://seismolive.ckdals9538.workers.dev/assets/terrain/bathymetry/regional_2016_gyeongju_unorm16.bin'),
  binMockEnv,
  {}
);
assert(
  binRes.headers.get('Cache-Control') === 'public, max-age=86400' &&
  binRes.headers.get('X-Content-Type-Options') === 'nosniff',
  '3.2: Terrain binary assets receive 24h cache header and nosniff'
);

// 4. SSRF & Input Validation on /api/shakemap and /api/shelters
assert(
  isAllowedUsgsUrl('https://earthquake.usgs.gov/fdsnws/event/1/query?eventid=us6000jllz&format=geojson') &&
  isAllowedUsgsUrl('https://earthquake.usgs.gov/earthquakes/feed/v1.0/detail/us6000jllz.geojson') &&
  !isAllowedUsgsUrl('https://earthquake.usgs.gov/arbitrary/unlisted/endpoint') &&
  !isAllowedUsgsUrl('https://user:pass@earthquake.usgs.gov/fdsnws/event/1/query') &&
  !isAllowedUsgsUrl('http://169.254.169.254/latest/meta-data'),
  '4.1: ShakeMap SSRF filter restricts host, protocol, credentials, and USGS path prefix'
);

const badShakemapRes = await shakemapGet({
  request: new Request('https://seismolive.ckdals9538.workers.dev/api/shakemap?detailUrl=https://earthquake.usgs.gov/admin/secret'),
  ctx: {}
});
assert(
  badShakemapRes.status === 400,
  '4.2: /api/shakemap rejects disallowed USGS subpath with HTTP 400'
);

const badShelterRes = await sheltersGet({
  request: new Request('https://seismolive.ckdals9538.workers.dev/api/shelters?lat=999&lon=127'),
  env: { MOIS_API_KEY: 'dummy_test_key' },
  ctx: {}
});
assert(
  badShelterRes.status === 400,
  '4.3: /api/shelters rejects invalid latitude (999) with HTTP 400'
);

const localCsp = buildContentSecurityPolicy({ isHttps: false });
assert(
  !localCsp.includes('upgrade-insecure-requests'),
  '4.4: Local HTTP CSP omits upgrade-insecure-requests so local E2E remains unblocked'
);

console.log('\n====================================================================');
console.log(`SECURITY & WORKER HARDENING TESTS: ${passed} PASSED | ${failed} FAILED`);
console.log('====================================================================');
if (failed > 0) Deno.exit(1);
