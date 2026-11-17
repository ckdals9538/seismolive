// ============================================================================
// SEISMOLIVE v4.0 — Unified Real-Time Seismic & Open-Data Service Layer
// File: js/data/LiveSeismicDataService.js
//
// Coordinates live earthquake catalogs, USGS ShakeMap/OAF/StationList products,
// and official Korean shelter APIs with deterministic offline/snapshot fallbacks.
//
// Scientific & Honesty Mandates:
//   - Never promote unverified OSM amenities into OFFICIAL_DESIGNATED without API proof.
//   - Never invent ShakeMap MMI, OAF probabilities, or observed station PGA_g when absent.
//   - Separate official agency telemetry provenance from educational drill values.
// ============================================================================

import { adaptUSGSFeature, mergeCatalogWithUncertaintyPreservation } from './usgsFeedConnector.js';
import { extractOfficialUsgsProducts, USGS_PRODUCT_STATUS } from './UsgsOfficialProductsBridge.js';

export const LIVE_FEED_STATUS = Object.freeze({
  LIVE_MULTI_AGENCY: 'LIVE_MULTI_AGENCY',
  LIVE_USGS: 'LIVE_USGS',
  OFFLINE_SNAPSHOT: 'OFFLINE_SNAPSHOT',
  UNAVAILABLE: 'UNAVAILABLE'
});

function defaultFetch(...args) {
  if (typeof fetch !== 'function') {
    throw new Error('fetch API unavailable');
  }
  return fetch(...args);
}

function haversineKm(lat1, lon1, lat2, lon2) {
  if (![lat1, lon1, lat2, lon2].every(Number.isFinite)) return Infinity;
  const r = Math.PI / 180;
  const dp = (lat2 - lat1) * r;
  const dl = (lon2 - lon1) * r;
  const a = Math.sin(dp * 0.5) ** 2 + Math.cos(lat1 * r) * Math.cos(lat2 * r) * Math.sin(dl * 0.5) ** 2;
  return 6371.0 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(Math.max(0, 1 - a)));
}

/**
 * Normalize official USGS ShakeMap stationlist.json GeoJSON features cleanly.
 * Extracts only actual seismic station records with measured PGA/PGV (returns null PGA when missing).
 */
export function parseShakeMapStations(stationFeatures = [], refLat = null, refLon = null) {
  if (!Array.isArray(stationFeatures) || stationFeatures.length === 0) return [];
  const parsed = [];

  for (const feat of stationFeatures) {
    const props = feat?.properties || {};
    const coords = feat?.geometry?.coordinates || [];
    const lon = Number(coords[0]);
    const lat = Number(coords[1]);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    // Exclude non-instrument DYFI geocoded intensity reports when looking for strong-motion channels
    const stType = String(props.station_type || props.source || '').toUpperCase();
    const isInstrument = !stType.includes('DYFI') && stType !== 'CIIM';

    // USGS stationlist reports pga in %g on properties or inside channels[].amplitudes
    let rawPgaPctG = Number.isFinite(Number(props.pga)) ? Number(props.pga) : null;
    let rawPgvCms = Number.isFinite(Number(props.pgv)) ? Number(props.pgv) : null;
    if (rawPgaPctG === null && Array.isArray(props.channels)) {
      for (const ch of props.channels) {
        for (const amp of (ch.amplitudes || [])) {
          if (amp?.name === 'pga' && Number.isFinite(Number(amp.value))) {
            const cand = Number(amp.value);
            if (rawPgaPctG === null || cand > rawPgaPctG) rawPgaPctG = cand;
          }
          if (amp?.name === 'pgv' && Number.isFinite(Number(amp.value))) {
            const cand = Number(amp.value);
            if (rawPgvCms === null || cand > rawPgvCms) rawPgvCms = cand;
          }
        }
      }
    }

    const pga_g = rawPgaPctG !== null ? Number((rawPgaPctG / 100.0).toFixed(4)) : null;
    const distanceKm = Number.isFinite(refLat) && Number.isFinite(refLon)
      ? Number(haversineKm(refLat, refLon, lat, lon).toFixed(2))
      : (Number.isFinite(Number(props.distance)) ? Number(Number(props.distance).toFixed(2)) : null);

    if (!isInstrument && pga_g === null) continue;

    parsed.push({
      code: props.code || props.name || feat.id || 'USGS-STN',
      network: props.network || props.source || 'GSN',
      name: props.name || props.code || '관측소',
      lat,
      lon,
      distanceKm,
      pga_g,
      pgaCms: pga_g !== null ? Number((pga_g * 980.665).toFixed(1)) : null,
      pgvCms: rawPgvCms,
      mmi: Number.isFinite(Number(props.mmi)) ? Number(props.mmi) : null,
      vs30: Number.isFinite(Number(props.vs30)) ? Number(props.vs30) : null,
      isInstrument
    });
  }

  parsed.sort((a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity));
  return parsed;
}

export class LiveSeismicDataService {
  constructor(options = {}) {
    this.fetchFn = options.fetchFn || defaultFetch;
    this.apiBase = options.apiBase ?? '';
    this.cacheTtlMs = options.cacheTtlMs ?? 90_000;
    this._catalogCache = null;
    this._catalogFetchedAt = 0;
    this._productCache = new Map();
    this._shelterCache = new Map();
    this.lastDiagnostics = {
      feedStatus: LIVE_FEED_STATUS.UNAVAILABLE,
      usgsOnline: false,
      kmaStatus: 'UNKNOWN',
      shelterApiStatus: 'UNKNOWN',
      updatedAtIso: null
    };
  }

  async _fetchJsonWithTimeout(url, timeoutMs = 4000) {
    const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timer = ctrl ? setTimeout(() => ctrl.abort(), timeoutMs) : null;
    try {
      const res = await this.fetchFn(url, ctrl ? { signal: ctrl.signal } : undefined);
      if (!res || !res.ok) return null;
      const contentType = res.headers?.get?.('content-type') || '';
      if (contentType && !contentType.includes('json') && !contentType.includes('geo+json') && !contentType.includes('javascript')) {
        return null;
      }
      return await res.json();
    } catch {
      return null;
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  /**
   * Fetch live multi-agency earthquake catalog:
   *  1) /api/earthquakes (Cloudflare Pages Function if deployed -> USGS + KMA)
   *  2) Direct USGS global + Korea/East-Asia feeds
   *  3) Verified local snapshot assets/data/usgs_4.5_month.geojson
   */
  async fetchLiveEarthquakeCatalog(opts = {}) {
    const forceRefresh = Boolean(opts.forceRefresh);
    const now = Date.now();
    if (!forceRefresh && this._catalogCache && (now - this._catalogFetchedAt) < this.cacheTtlMs) {
      return this._catalogCache;
    }

    let adaptedUsgs = [];
    let kmaEvents = [];
    let feedStatus = LIVE_FEED_STATUS.UNAVAILABLE;
    let kmaStatus = 'UNCONFIGURED';

    // 1. Try unified backend endpoint (/api/earthquakes) when hosted in browser/Edge
    const canTryApiProxy = Boolean(opts.useProxyEndpoint !== false && (this.apiBase || (typeof window !== 'undefined' && window.location?.protocol?.startsWith('http'))));
    if (canTryApiProxy) {
      const apiData = await this._fetchJsonWithTimeout(`${this.apiBase}/api/earthquakes?minMag=2.5&days=14`, opts.timeoutMs || 3800);
      if (apiData?.ok) {
        const mergedFeatures = [...(apiData.usgsGlobalFeatures || []), ...(apiData.usgsRegionalFeatures || [])];
        const seen = new Set();
        for (const f of mergedFeatures) {
          if (f?.id && !seen.has(f.id)) {
            seen.add(f.id);
            const ev = adaptUSGSFeature(f);
            if (ev) adaptedUsgs.push(ev);
          }
        }
        kmaEvents = Array.isArray(apiData.kmaEvents) ? apiData.kmaEvents : [];
        kmaStatus = apiData.agencies?.kma?.status || 'UNCONFIGURED';
        if (adaptedUsgs.length > 0 || kmaEvents.length > 0) {
          feedStatus = kmaStatus === 'LIVE' ? LIVE_FEED_STATUS.LIVE_MULTI_AGENCY : LIVE_FEED_STATUS.LIVE_USGS;
        }
      }
    }

    // 2. Direct live USGS feeds (global + Korea/East-Asia M2.5+ window)
    if (adaptedUsgs.length === 0) {
      const startIso = new Date(now - 14 * 86400_000).toISOString();
      const [globalGj, regionalGj] = await Promise.all([
        this._fetchJsonWithTimeout(opts.usgsGlobalUrl || 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/4.5_month.geojson', opts.timeoutMs || 3800),
        this._fetchJsonWithTimeout(
          opts.usgsRegionalUrl || `https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&starttime=${encodeURIComponent(startIso)}&minlatitude=31&maxlatitude=44&minlongitude=122&maxlongitude=134&minmagnitude=2.5`,
          opts.timeoutMs || 3800
        )
      ]);
      const seen = new Set();
      for (const gj of [regionalGj, globalGj]) {
        for (const f of (gj?.features || [])) {
          if (f?.id && !seen.has(f.id)) {
            seen.add(f.id);
            const ev = adaptUSGSFeature(f);
            if (ev) adaptedUsgs.push(ev);
          }
        }
      }
      if (adaptedUsgs.length > 0) {
        feedStatus = LIVE_FEED_STATUS.LIVE_USGS;
      }
    }

    // 3. Guaranteed local snapshot fallback when offline
    if (adaptedUsgs.length === 0 && !opts.skipSnapshot) {
      const snapGj = await this._fetchJsonWithTimeout(opts.snapshotUrl || 'assets/data/usgs_4.5_month.geojson', 2500);
      for (const f of (snapGj?.features || [])) {
        const ev = adaptUSGSFeature(f);
        if (ev) adaptedUsgs.push(ev);
      }
      if (adaptedUsgs.length > 0) {
        feedStatus = LIVE_FEED_STATUS.OFFLINE_SNAPSHOT;
      }
    }

    const events = kmaEvents.length > 0
      ? mergeCatalogWithUncertaintyPreservation(kmaEvents, adaptedUsgs)
      : adaptedUsgs;

    const result = {
      events,
      usgsCount: adaptedUsgs.length,
      kmaCount: kmaEvents.length,
      feedStatus,
      kmaStatus,
      updatedAtIso: new Date().toISOString()
    };

    this.lastDiagnostics = {
      feedStatus,
      usgsOnline: feedStatus === LIVE_FEED_STATUS.LIVE_USGS || feedStatus === LIVE_FEED_STATUS.LIVE_MULTI_AGENCY,
      kmaStatus,
      shelterApiStatus: this.lastDiagnostics.shelterApiStatus,
      updatedAtIso: result.updatedAtIso
    };
    this._catalogCache = result;
    this._catalogFetchedAt = now;
    return result;
  }

  /**
   * Fetch & extract official USGS products (ShakeMap + OAF + real observed strong-motion stationlist).
   * Preserves null strictly when official products do not exist.
   */
  async fetchOfficialEventProducts(rawEvent, refAnchor = null, opts = {}) {
    const detailUrl = rawEvent?.usgsDetailUrl;
    if (!detailUrl) {
      return rawEvent?.officialProducts || {
        status: USGS_PRODUCT_STATUS.UNAVAILABLE,
        shakemap: null,
        oaf: null,
        stations: []
      };
    }

    const cacheKey = `${detailUrl}|${refAnchor?.lat ?? ''}|${refAnchor?.lon ?? ''}`;
    const cached = this._productCache.get(cacheKey);
    if (cached && !opts.forceRefresh && (Date.now() - cached.ts) < 300_000) {
      return cached.data;
    }

    let detailJson = null;
    let stationFeatures = null;

    // Try proxy endpoint first if hosted; otherwise fetch USGS detail directly (USGS API supports CORS *)
    const proxyRes = opts.useProxyEndpoint !== false
      ? await this._fetchJsonWithTimeout(`${this.apiBase}/api/shakemap?detailUrl=${encodeURIComponent(detailUrl)}`, opts.timeoutMs || 3500)
      : null;

    if (proxyRes?.ok && proxyRes.detailJson) {
      detailJson = proxyRes.detailJson;
      stationFeatures = proxyRes.stationFeatures || null;
    } else {
      detailJson = await this._fetchJsonWithTimeout(detailUrl, opts.timeoutMs || 3200);
      if (detailJson) {
        const smContents = detailJson?.properties?.products?.shakemap?.[0]?.contents || {};
        const stationUrl = smContents['download/stationlist.json']?.url || smContents['stationlist.json']?.url || null;
        if (stationUrl) {
          const stJson = await this._fetchJsonWithTimeout(stationUrl, 3000);
          stationFeatures = stJson?.features || null;
        }
      }
    }

    const products = extractOfficialUsgsProducts(detailJson);
    const stations = parseShakeMapStations(stationFeatures || [], refAnchor?.lat ?? null, refAnchor?.lon ?? null);
    const bundle = {
      ...products,
      stations,
      detailJson: detailJson || null
    };
    this._productCache.set(cacheKey, { ts: Date.now(), data: bundle });
    return bundle;
  }

  /**
   * Query official Korean shelter endpoint (/api/shelters).
   * Returns empty array gracefully unless backend MOIS key is configured.
   */
  async fetchOfficialSheltersNear(lat, lon, radiusM = 2500, opts = {}) {
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      return { status: 'INVALID_COORDINATES', shelters: [] };
    }
    const cacheKey = `${lat.toFixed(3)}_${lon.toFixed(3)}_${radiusM}`;
    const cached = this._shelterCache.get(cacheKey);
    if (cached && !opts.forceRefresh && (Date.now() - cached.ts) < 300_000) {
      return cached.data;
    }

    const res = await this._fetchJsonWithTimeout(
      `${this.apiBase}/api/shelters?lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}&radiusM=${encodeURIComponent(radiusM)}`,
      opts.timeoutMs || 4500
    );

    const out = res?.ok
      ? { status: res.status || 'UNKNOWN', source: res.source || '', shelters: res.shelters || [] }
      : { status: 'ENDPOINT_UNAVAILABLE', source: '', shelters: [] };

    this.lastDiagnostics.shelterApiStatus = out.status;
    this._shelterCache.set(cacheKey, { ts: Date.now(), data: out });
    return out;
  }
}

export const liveSeismicDataService = new LiveSeismicDataService();
