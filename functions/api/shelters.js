// Cloudflare Worker / Pages Function: /api/shelters
// Queries official Korean MOIS (행정안전부 지진옥외대피장소, DSSP-IF-10943) open dataset when MOIS_API_KEY is provisioned.
// Separates statutory/official designation ("OFFICIAL_DESIGNATED") from post-earthquake operational status ("UNVERIFIED_IN_DISASTER").
// Edge-caches both the compact nationwide MOIS dataset (3600s) and quantized spatial slice responses (300s).

import { jsonApiResponse, validateOriginForApi, withEdgeCache } from '../_shared/security.js';

function haversineMeters(lat1, lon1, lat2, lon2) {
  const r = Math.PI / 180;
  const dp = (lat2 - lat1) * r;
  const dl = (lon2 - lon1) * r;
  const a = Math.sin(dp * 0.5) ** 2 + Math.cos(lat1 * r) * Math.cos(lat2 * r) * Math.sin(dl * 0.5) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(Math.max(0, 1 - a)));
}

function extractMoisPage(json) {
  const header = json?.header || json?.response?.header || null;
  const rawCode = header?.resultCode != null ? String(header.resultCode).trim() : null;
  if (rawCode && !['00', '0', 'NORMAL_SERVICE', 'NORMAL SERVICE'].includes(rawCode.toUpperCase())) {
    return {
      ok: false,
      errorCode: rawCode.slice(0, 32),
      errorMsg: String(header?.errorMsg || header?.resultMsg || 'UPSTREAM_API_ERROR').slice(0, 120),
      rows: [],
      totalCount: 0
    };
  }

  let rawRows = [];
  if (Array.isArray(json?.body)) rawRows = json.body;
  else if (Array.isArray(json?.body?.items)) rawRows = json.body.items;
  else if (Array.isArray(json?.body?.items?.item)) rawRows = json.body.items.item;
  else if (json?.body?.items?.item && typeof json.body.items.item === 'object') rawRows = [json.body.items.item];
  else if (Array.isArray(json?.items)) rawRows = json.items;
  else if (Array.isArray(json?.data)) rawRows = json.data;
  else if (Array.isArray(json?.response?.body?.items?.item)) rawRows = json.response.body.items.item;
  else if (json?.response?.body?.items?.item && typeof json.response.body.items.item === 'object') {
    rawRows = [json.response.body.items.item];
  }

  const parsedTotal = Number(
    json?.totalCount ??
    json?.body?.totalCount ??
    json?.response?.body?.totalCount ??
    rawRows.length
  );

  return {
    ok: true,
    rows: rawRows,
    totalCount: Number.isFinite(parsedTotal) && parsedTotal > 0 ? parsedTotal : rawRows.length
  };
}

function compactMoisRow(row, fallbackIdx) {
  if (!row || typeof row !== 'object') return null;
  const lat = Number(
    row.LA ?? row.LAT ?? row.lat ?? row.YLAT ?? row.YCORD ?? row.YCORT ?? row.YCRD ?? row.WGS84_LA ?? row.Y
  );
  const lon = Number(
    row.LO ?? row.LOT ?? row.LON ?? row.lon ?? row.XLON ?? row.XCORD ?? row.XCORT ?? row.XCRD ?? row.WGS84_LO ?? row.X
  );
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || lat < 31 || lat > 44 || lon < 122 || lon > 134) {
    return null;
  }

  const rawId =
    row.MNG_SN ?? row.SN ?? row.EQUP_SN ?? row.ACMD_SN ?? row.FCLTY_SN ?? row.VT_ACMD_FCLTY_SN ?? row.REARE_NM ?? `MOIS_${fallbackIdx}`;
  const rawName =
    row.VT_ACMDFCLTY_NM ?? row.VT_ACMD_FCLTY_NM ?? row.FCLTY_NM ?? row.SHLT_NM ?? row.SHNT_PLACE_NM ?? row.EQUP_NM ?? row.FACIL_NM ?? row.REARE_NM ?? '지진옥외대피장소';
  const rnAddr = row.RN_DTL_ADRES || row.RONA_DADDR || row.RDNM_ADDR;
  const lotFullAddr = [row.CTPRVN_NM, row.SGG_NM, row.EMD_NM, row.DTL_ADRES].filter(Boolean).join(' ').trim();
  const rawAddr = rnAddr || lotFullAddr || row.DTL_ADRES || row.LNM_ADDR || row.LOCPLC_ADDR || row.ADRES || null;
  const areaM2 = Number(row.AR ?? row.FCLTY_AR ?? row.AR_VALUE);
  const cap = Number(row.ACEPTNC_NMPR ?? row.VT_ACMD_PSBL_NMPR ?? row.SHNT_PSBL_NMPR ?? row.USE_PSBL_NMPR);

  return {
    id: String(rawId).slice(0, 64),
    name: String(rawName).slice(0, 120),
    addr: rawAddr ? String(rawAddr).slice(0, 160) : null,
    lat,
    lon,
    area: Number.isFinite(areaM2) && areaM2 > 0 ? Math.round(areaM2) : null,
    cap: Number.isFinite(cap) && cap > 0 ? Math.round(cap) : null
  };
}

async function fetchMoisPage(apiKey, pageNo, numOfRows) {
  const apiUrl =
    `https://www.safetydata.go.kr/V2/api/DSSP-IF-10943?serviceKey=${encodeURIComponent(apiKey)}` +
    `&numOfRows=${numOfRows}&pageNo=${pageNo}&returnType=json`;
  const resp = await fetch(apiUrl, { signal: AbortSignal.timeout(8500) });
  if (!resp.ok) {
    return { ok: false, status: 'UPSTREAM_ERROR', httpStatus: resp.status, rows: [], totalCount: 0 };
  }
  const json = await resp.json();
  return extractMoisPage(json);
}

async function fetchCachedMoisDataset(request, env, ctx) {
  const apiKey = env?.MOIS_API_KEY || env?.SAFETYDATA_API_KEY || null;
  if (!apiKey) return { ok: false, status: 'OFFICIAL_API_KEY_REQUIRED', rows: [] };

  const reqOrigin = new URL(request.url).origin;
  const upstreamKey = new Request(`${reqOrigin}/__edge_cache/mois-upstream-shelters-v3`, { method: 'GET' });
  const cacheStorage = typeof caches !== 'undefined' && caches?.default ? caches.default : null;

  if (cacheStorage) {
    try {
      const cached = await cacheStorage.match(upstreamKey);
      if (cached) {
        const parsed = await cached.json();
        if (Array.isArray(parsed?.rows) && parsed.rows.length > 0) {
          return { ok: true, status: 'LIVE', rows: parsed.rows, totalCount: parsed.totalCount ?? parsed.rows.length };
        }
      }
    } catch {}
  }

  const pageSize = 1000;
  const first = await fetchMoisPage(apiKey, 1, pageSize);
  if (!first.ok) {
    return {
      ok: false,
      status: first.errorCode ? 'UPSTREAM_API_ERROR' : (first.status || 'UPSTREAM_ERROR'),
      resultCode: first.errorCode || null,
      resultMsg: first.errorMsg || null,
      rows: []
    };
  }

  const allCompacted = [];
  let rawCountTotal = first.rows.length;
  for (const row of first.rows) {
    const compact = compactMoisRow(row, allCompacted.length);
    if (compact) allCompacted.push(compact);
  }

  const observedPageSize = first.rows.length > 0 ? first.rows.length : pageSize;
  const totalPages = first.totalCount > first.rows.length
    ? Math.min(15, Math.ceil(first.totalCount / observedPageSize))
    : 1;

  for (let startPage = 2; startPage <= totalPages; startPage += 5) {
    const endPage = Math.min(totalPages, startPage + 4);
    const batchPromises = [];
    for (let p = startPage; p <= endPage; p++) {
      batchPromises.push(fetchMoisPage(apiKey, p, observedPageSize));
    }
    const batchResults = await Promise.allSettled(batchPromises);
    for (const res of batchResults) {
      if (res.status === 'fulfilled' && res.value?.ok && Array.isArray(res.value.rows)) {
        rawCountTotal += res.value.rows.length;
        for (const row of res.value.rows) {
          const compact = compactMoisRow(row, allCompacted.length);
          if (compact) allCompacted.push(compact);
        }
      }
    }
  }

  const sampleKeys = rawCountTotal > 0 && allCompacted.length === 0 && first.rows[0] && typeof first.rows[0] === 'object'
    ? Object.keys(first.rows[0]).slice(0, 20)
    : undefined;

  if (cacheStorage && allCompacted.length > 0) {
    const cacheRes = new Response(JSON.stringify({ rows: allCompacted, totalCount: first.totalCount }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'public, max-age=3600, s-maxage=3600'
      }
    });
    const putTask = cacheStorage.put(upstreamKey, cacheRes).catch(() => {});
    if (ctx && typeof ctx.waitUntil === 'function') ctx.waitUntil(putTask);
    else await putTask;
  }

  return {
    ok: true,
    status: 'LIVE',
    rows: allCompacted,
    rawCountTotal,
    totalCount: first.totalCount,
    sampleKeys
  };
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
  const cacheKeyUrl = `${url.origin}/__edge_cache/shelters-v3?lat=${qLat}&lon=${qLon}&radiusM=${qRad}`;

  return withEdgeCache({
    request,
    ctx,
    cacheKeyUrl,
    ttlSec: 300,
    fetcher: async () => {
      try {
        const upstream = await fetchCachedMoisDataset(request, env, ctx);
        if (!upstream.ok) {
          return {
            status: 200,
            cacheable: false,
            body: {
              ok: false,
              status: upstream.status,
              ...(upstream.resultCode ? { resultCode: upstream.resultCode } : {}),
              ...(upstream.resultMsg ? { resultMsg: upstream.resultMsg } : {}),
              shelters: []
            }
          };
        }

        const matched = [];
        for (const row of upstream.rows) {
          const distM = haversineMeters(lat, lon, row.lat, row.lon);
          if (distM <= radiusM) {
            matched.push({
              id: row.id,
              officialId: row.id,
              name: row.name,
              address: row.addr,
              lat: row.lat,
              lon: row.lon,
              distanceMeters: Math.round(distM),
              areaSqMeters: row.area,
              capacityEstimate: row.cap,
              designationStatus: 'OFFICIAL_DESIGNATED',
              operationalStatus: 'UNVERIFIED_IN_DISASTER',
              sourceName: '행정안전부 지진옥외대피장소 공식 DB'
            });
          }
        }

        matched.sort((a, b) => a.distanceMeters - b.distanceMeters);
        return {
          status: 200,
          cacheable: upstream.rows.length > 0,
          body: {
            ok: true,
            status: matched.length > 0 ? 'OFFICIAL_LIVE' : 'NONE_WITHIN_RADIUS',
            source: '행정안전부 지진옥외대피장소 실시간 연계',
            indexedCount: upstream.rows.length,
            ...(upstream.sampleKeys ? { sampleKeys: upstream.sampleKeys } : {}),
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
