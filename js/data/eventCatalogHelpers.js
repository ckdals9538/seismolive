// ============================================================================
// SEISMOLIVE v4.0 — Event Catalog & Geodetic Resolution Helpers
// ============================================================================

export function getEventCoords(ev) {
  if (!ev) return { lat: null, lon: null };
  let lat = null;
  let lon = null;

  if (typeof ev.lat === 'number' && !isNaN(ev.lat)) {
    lat = ev.lat;
  } else if (ev.lat && typeof ev.lat.v === 'number' && !isNaN(ev.lat.v)) {
    lat = ev.lat.v;
  } else if (ev.spatial?.inferredCoordinates?.lat != null) {
    const n = Number(ev.spatial.inferredCoordinates.lat);
    if (!isNaN(n)) lat = n;
  } else if (ev.interpretations?.[0]?.epicenter?.lat != null) {
    const n = Number(ev.interpretations[0].epicenter.lat);
    if (!isNaN(n)) lat = n;
  } else if (ev.placeMappings?.[0]?.representativeCoords?.lat != null) {
    const n = Number(ev.placeMappings[0].representativeCoords.lat);
    if (!isNaN(n)) lat = n;
  }

  if (typeof ev.lon === 'number' && !isNaN(ev.lon)) {
    lon = ev.lon;
  } else if (ev.lon && typeof ev.lon.v === 'number' && !isNaN(ev.lon.v)) {
    lon = ev.lon.v;
  } else if (ev.spatial?.inferredCoordinates?.lon != null) {
    const n = Number(ev.spatial.inferredCoordinates.lon);
    if (!isNaN(n)) lon = n;
  } else if (ev.interpretations?.[0]?.epicenter?.lon != null) {
    const n = Number(ev.interpretations[0].epicenter.lon);
    if (!isNaN(n)) lon = n;
  } else if (ev.placeMappings?.[0]?.representativeCoords?.lon != null) {
    const n = Number(ev.placeMappings[0].representativeCoords.lon);
    if (!isNaN(n)) lon = n;
  }

  return { lat, lon };
}

export function isHistoricalRecord(ev) {
  if (!ev) return true;
  if (ev.isInstrumental === true) return false;
  if (ev.recordType === 'usgs-live' || ev.catalogType === 'INSTRUMENTAL_GLOBAL' || ev.recordType === 'instrumental-global' || ev.recordType === 'instrumental-early' || ev.recordType === 'instrumental-digital') return false;
  const evId = String(ev.id || ev.eventId || "").toLowerCase();
  if (evId.startsWith('inst_') || evId.startsWith('global_') || evId.startsWith('usgs_')) return false;
  if (evId.includes('turkey') || evId.includes('kumamoto') || evId.includes('tohoku')) return false;
  if (evId.includes('gyeongju') && evId.includes('2016')) return false;
  if (evId.includes('pohang') && (evId.includes('2017') || evId.includes('2018'))) return false;
  if (evId.includes('buan') && evId.includes('2024')) return false;
  if (ev.century && ev.century >= 20) return false;
  if (ev.year && ev.year >= 1910) return false;
  return true;
}

export function getAllLocalizedEvents(masterRegistry = null, histEvents = [], instEvents = []) {
  const list = [];
  const source = masterRegistry || window.MASTER_EVENTS_REGISTRY || [...histEvents, ...instEvents];
  source.forEach(ev => {
    const { lat, lon } = getEventCoords(ev);
    if (lat != null && lon != null) {
      list.push(ev);
    }
  });
  return list;
}

if (typeof window !== 'undefined') {
  window.getEventCoords = getEventCoords;
  window.isHistoricalRecord = isHistoricalRecord;
}
