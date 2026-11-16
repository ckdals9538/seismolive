// Cloudflare Pages Function: /api/shakemap
// Strict allowlisted proxy for USGS event detail + ShakeMap stationlist.json strong-motion telemetry.

function jsonResponse(body, status = 200, maxAgeSec = 180) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': `public, max-age=${maxAgeSec}`,
      'Access-Control-Allow-Origin': '*'
    }
  });
}

function isAllowedUsgsUrl(rawUrl) {
  try {
    const parsed = new URL(rawUrl);
    return parsed.protocol === 'https:' && parsed.hostname === 'earthquake.usgs.gov';
  } catch {
    return false;
  }
}

export async function onRequestGet({ request }) {
  const url = new URL(request.url);
  const detailUrl = url.searchParams.get('detailUrl');
  if (!detailUrl || !isAllowedUsgsUrl(detailUrl)) {
    return jsonResponse({ ok: false, error: 'INVALID_OR_UNTRUSTED_USGS_URL' }, 400, 0);
  }

  try {
    const detailResp = await fetch(detailUrl, { signal: AbortSignal.timeout(4500) });
    if (!detailResp.ok) {
      return jsonResponse({ ok: false, status: 'DETAIL_UNAVAILABLE' }, 200, 60);
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

    return jsonResponse({
      ok: true,
      detailJson,
      stationFeatures
    }, 200, 180);
  } catch (err) {
    return jsonResponse({ ok: false, error: err?.message || 'FETCH_ERROR' }, 200, 30);
  }
}
