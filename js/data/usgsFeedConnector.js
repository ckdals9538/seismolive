// ============================================================================
// SeismoLive v4.0 — USGS Global Earthquake Feed Connector & Unified Registry
// Seamlessly integrates USGS Earthquake Hazards Program GeoJSON into SeismoLive
// Supports:
//   - Live network fetch with timeout
//   - Guaranteed local fallback snapshot (assets/data/usgs_4.5_month.geojson)
//   - Schema adaptation conforming to SeismoLive Universal Event Model
//   - 4-Era Epistemological Boundary preservation
// ============================================================================

function isValidNumber(v) {
  return typeof v === 'number' && Number.isFinite(v);
}

/**
 * Adapts a single USGS GeoJSON feature into SeismoLive universal event schema
 * @param {object} f USGS GeoJSON feature
 * @returns {object|null}
 */
export function adaptUSGSFeature(f) {
  if (!f || typeof f !== 'object') return null;
  const p = f.properties || {};
  const g = f.geometry || {};
  const coords = Array.isArray(g.coordinates) ? g.coordinates : [];

  const rawLon = coords[0];
  const rawLat = coords[1];
  const isZero = rawLat === 0 && rawLon === 0;
  const lon = !isZero && isValidNumber(rawLon) && rawLon >= -180 && rawLon <= 180 ? rawLon : null;
  const lat = !isZero && isValidNumber(rawLat) && rawLat >= -90 && rawLat <= 90 ? rawLat : null;
  const depth = isValidNumber(coords[2]) && coords[2] >= 0 ? coords[2] : null;
  const mag = isValidNumber(p.mag) ? p.mag : null;
  const magType = p.magType || (mag != null ? 'Mw' : 'M');

  if (lat == null || lon == null || mag == null) return null;

  const isFixedDefaultDepth = depth === 10 || depth === 33;
  const dateIso = isValidNumber(p.time) 
    ? new Date(p.time).toISOString().replace('T', ' ').slice(0, 19) + ' UTC' 
    : '시각 미상';
  const place = p.place || '글로벌 지진원';
  const id = typeof f.id === 'string' && f.id ? f.id : `usgs_${p.time || Date.now()}`;

  // Extract country / region name
  let country = 'GLOBAL';
  if (place.includes(',')) {
    const parts = place.split(',');
    country = parts[parts.length - 1].trim().toUpperCase();
  } else if (place.includes('of')) {
    const parts = place.split('of');
    country = parts[parts.length - 1].trim().toUpperCase();
  }

  const reportedMmi = isValidNumber(p.mmi) ? p.mmi : (isValidNumber(p.cdi) ? p.cdi : null);

  return {
    id: id,
    eventId: id,
    century: 21,
    seismicEra: 'ERA_4_1999_PRESENT_DIGITAL',
    observationMethod: 'MODERN_BROADBAND_DIGITAL',
    catalogType: 'INSTRUMENTAL_GLOBAL',
    recordType: 'usgs-live',
    sourceName: '미국지질조사국(USGS) 글로벌 지진 관측망',
    verification: 'usgs-official',
    kind: 'instrumental-global',
    place: place,
    titleKo: `[글로벌] ${place} (M${mag.toFixed(1)})`,
    country: country,
    lat: { v: lat },
    lon: { v: lon },
    depth: { v: depth },
    mag: { v: mag },
    magType: magType,
    time: { v: p.time },
    dateText: dateIso,
    spatial: {
      placeName: place,
      inferredCoordinates: { 
        lat, 
        lon, 
        coordinateConfidence: 'HIGH_PRECISION_INSTRUMENTAL', 
        errorRadiusKm: 1.0 
      },
      focalDepth: { 
        valKm: depth, 
        isKnown: depth != null, 
        determinationType: isFixedDefaultDepth ? 'INSTRUMENTAL_FIXED_DEFAULT' : 'INSTRUMENTAL_FREE_INVERSION' 
      }
    },
    temporal: {
      gregorianDate: dateIso.slice(0, 10),
      gregorianPrecision: 'SECOND',
      originTimeUTC: isValidNumber(p.time) ? new Date(p.time).toISOString() : null
    },
    scientificEstimates: [
      { source: '미국지질조사국(USGS)', estimatedMag: mag, magType: magType }
    ],
    macroseismic: {
      maxIntensityMMI: reportedMmi != null ? {
        rawRoman: `MMI ${reportedMmi.toFixed(1)}`,
        numericEquivalent: reportedMmi,
        scale: 'USGS ShakeMap / DYFI'
      } : null,
      tsunamiObserved: Boolean(p.tsunami)
    },
    primaryText: {
      originalScript: `${place}에서 규모 ${mag.toFixed(1)} 지진 발생. 진원 깊이 ${depth != null ? depth.toFixed(1) : '미상'}km.`,
      documentSource: 'USGS Real-time Earthquake Hazards Program Feed'
    },
    archivalLexicon: [
      { token: '진동', category: 'motion', translation: '지각 진동 관측' },
      { token: '파열', category: 'damage', translation: '단층 파열 전파' }
    ]
  };
}

/**
 * Loads USGS GeoJSON feed with live network fallback to local snapshot
 * @param {string} [feedUrl]
 * @returns {Promise<Array<object>>}
 */
export async function loadUSGSFeed(feedUrl = 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/4.5_month.geojson') {
  let geojson = null;

  // 1. Try live fetch with 3.5s timeout
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3500);
    const res = await fetch(feedUrl, { signal: controller.signal });
    clearTimeout(timeoutId);
    if (res.ok) {
      geojson = await res.json();
      console.log(`[USGS Connector] Fetched ${geojson.features?.length || 0} live events from USGS`);
    }
  } catch (err) {
    console.warn('[USGS Connector] Live fetch timed out or offline; falling back to local snapshot:', err.message);
  }

  // 2. Fallback to local snapshot
  if (!geojson || !Array.isArray(geojson.features)) {
    try {
      const res = await fetch('assets/data/usgs_4.5_month.geojson');
      if (res.ok) {
        geojson = await res.json();
        console.log(`[USGS Connector] Loaded ${geojson.features?.length || 0} events from local snapshot`);
      }
    } catch (err) {
      console.error('[USGS Connector] Failed to load local snapshot:', err);
      return [];
    }
  }

  if (!geojson || !Array.isArray(geojson.features)) return [];

  const adapted = [];
  for (const f of geojson.features) {
    const ev = adaptUSGSFeature(f);
    if (ev) adapted.push(ev);
  }

  return adapted;
}

/**
 * Build unified master catalog merging historical, instrumental, and global USGS feeds
 * @param {Array} historicalEvents
 * @param {Array} instrumentalEvents
 * @param {Array} [usgsEvents]
 * @returns {Array} Unified list with zero duplicate IDs
 */
export function buildUnifiedMasterCatalog(historicalEvents = [], instrumentalEvents = [], usgsEvents = []) {
  const master = [];
  const seenIds = new Set();

  function addList(list) {
    for (const ev of list) {
      const id = ev.id || ev.eventId;
      if (id && !seenIds.has(id)) {
        seenIds.add(id);
        master.push(ev);
      }
    }
  }

  // Preserve authentic chronological / benchmark ordering
  addList(historicalEvents);
  addList(instrumentalEvents);
  addList(usgsEvents);

  return master;
}
