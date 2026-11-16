// Cloudflare Pages Function: /api/shelters
// Queries official Korean MOIS (행정안전부 지진옥외대피장소) open dataset when MOIS_API_KEY is provisioned.
// Separates statutory/official designation ("VERIFIED") from post-earthquake operational status ("UNVERIFIED_IN_DISASTER").

function jsonResponse(body, status = 200, maxAgeSec = 180) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': `public, max-age=${maxAgeSec}, stale-while-revalidate=${maxAgeSec * 2}`,
      'Access-Control-Allow-Origin': '*'
    }
  });
}

function haversineMeters(lat1, lon1, lat2, lon2) {
  const r = Math.PI / 180;
  const dp = (lat2 - lat1) * r;
  const dl = (lon2 - lon1) * r;
  const a = Math.sin(dp * 0.5) ** 2 + Math.cos(lat1 * r) * Math.cos(lat2 * r) * Math.sin(dl * 0.5) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(Math.max(0, 1 - a)));
}

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const lat = Number(url.searchParams.get('lat'));
  const lon = Number(url.searchParams.get('lon'));
  const radiusM = Math.min(5000, Math.max(300, Number(url.searchParams.get('radiusM') || 2500)));

  if (!Number.isFinite(lat) || !Number.isFinite(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
    return jsonResponse({ ok: false, status: 'INVALID_COORDINATES', shelters: [] }, 400, 0);
  }

  const apiKey = env?.MOIS_API_KEY || env?.SAFETYDATA_API_KEY || null;
  if (!apiKey) {
    return jsonResponse({
      ok: true,
      status: 'OFFICIAL_API_KEY_REQUIRED',
      source: '행정안전부 지진옥외대피장소 API (미연동 — OSM 조건부 후보 사용)',
      shelters: []
    }, 200, 300);
  }

  try {
    const apiUrl = `https://www.safetydata.go.kr/V2/api/DSSP-IF-10943?serviceKey=${encodeURIComponent(apiKey)}&numOfRows=500&pageNo=1&returnType=json`;
    const resp = await fetch(apiUrl, { signal: AbortSignal.timeout(5000) });
    if (!resp.ok) {
      return jsonResponse({ ok: false, status: 'UPSTREAM_ERROR', shelters: [] }, 200, 30);
    }
    const json = await resp.json();
    const rows = Array.isArray(json?.body) ? json.body : (Array.isArray(json?.items) ? json.items : []);

    const matched = [];
    for (const row of rows) {
      const rLat = Number(row.LA ?? row.lat ?? row.YCORD);
      const rLon = Number(row.LO ?? row.lon ?? row.XCORD);
      if (!Number.isFinite(rLat) || !Number.isFinite(rLon)) continue;
      const distM = haversineMeters(lat, lon, rLat, rLon);
      if (distM <= radiusM) {
        const areaM2 = Number(row.AR ?? row.FCLTY_AR);
        const cap = Number(row.ACEPTNC_NMPR ?? row.VT_ACMD_PSBL_NMPR);
        matched.push({
          id: String(row.MNG_SN || row.SN || `MOIS_${matched.length}`),
          officialId: String(row.MNG_SN || row.SN || ''),
          name: String(row.VT_ACMD_FCLTY_NM || row.SHLT_NM || '지진옥외대피장소'),
          address: row.RN_DTL_ADRES || row.DTL_ADRES || null,
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
    return jsonResponse({
      ok: true,
      status: matched.length > 0 ? 'OFFICIAL_LIVE' : 'NONE_WITHIN_RADIUS',
      source: '행정안전부 지진옥외대피장소 실시간 연계',
      shelters: matched.slice(0, 12)
    }, 200, 180);
  } catch (err) {
    return jsonResponse({
      ok: false,
      status: 'FETCH_TIMEOUT',
      error: err?.message || 'Timeout',
      shelters: []
    }, 200, 30);
  }
}
