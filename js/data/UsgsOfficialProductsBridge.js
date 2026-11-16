// ============================================================================
// SEISMOLIVE v4.0 — Official USGS ShakeMap & OAF Conditional Product Bridge
// File: js/data/UsgsOfficialProductsBridge.js
//
// Tier 2.3 Implementation:
//   Conditionally ingests official USGS ComCat `detail` GeoJSON products
//   (`shakemap` / `cont_mmi.json` & `oaf` aftershock forecast).
//
// Strict Scientific Guardrails:
//   - NEVER invent fallback empirical MMI equations (no `1*M - 3*log10(R) + 4.5`).
//   - When official USGS products are missing or offline, keep fields `null`.
//   - Reuses LocalTangentAnchor for rigorous WGS84 -> Local ENU projection.
// ============================================================================

import { LocalTangentAnchor, HANYANG_BLDG212_ANCHOR } from '../response/LocalTangentAnchor.js';
import { DATA_PROVENANCE_SOURCE, VERIFICATION_STATUS } from '../response/ResponseDomainTypes.js';

export const USGS_PRODUCT_STATUS = Object.freeze({
  AVAILABLE: 'OFFICIAL_PRODUCT_AVAILABLE',
  PARTIAL: 'OFFICIAL_PRODUCT_PARTIAL',
  UNAVAILABLE: 'OFFICIAL_PRODUCT_UNAVAILABLE'
});

/**
 * Inspect a USGS ComCat GeoJSON event detail payload for official `shakemap` and `oaf` products.
 * Strictly returns `null` entries when absent (no synthetic substitution).
 */
export function extractOfficialUsgsProducts(eventDetailJson) {
  const products = eventDetailJson?.properties?.products || null;
  if (!products || typeof products !== 'object') {
    return Object.freeze({
      status: USGS_PRODUCT_STATUS.UNAVAILABLE,
      shakemap: null,
      oaf: null,
      provenance: DATA_PROVENANCE_SOURCE.OFFICIAL_DISASTER_INFO,
      scientificCaveat: '공식 USGS ShakeMap/OAF 산출물이 존재하지 않아 null로 유지됩니다 (임의 경험식 추정 금지).'
    });
  }

  const shakeArr = Array.isArray(products.shakemap) ? products.shakemap : [];
  const oafArr = Array.isArray(products.oaf) ? products.oaf : [];

  const primaryShake = shakeArr[0] || null;
  const primaryOaf = oafArr[0] || null;

  let shakemap = null;
  if (primaryShake) {
    const contents = primaryShake.contents || {};
    const props = primaryShake.properties || {};
    shakemap = Object.freeze({
      id: primaryShake.id || null,
      code: primaryShake.code || null,
      source: primaryShake.source || 'us',
      maxMmi: props.maxmmi !== undefined ? Number(props.maxmmi) : null,
      maxPgaPctG: props.maxpga !== undefined ? Number(props.maxpga) : null,
      maxPgvCmS: props.maxpgv !== undefined ? Number(props.maxpgv) : null,
      contMmiUrl: contents['download/cont_mmi.json']?.url || null,
      gridXmlUrl: contents['download/grid.xml']?.url || null,
      provenance: DATA_PROVENANCE_SOURCE.OFFICIAL_DISASTER_INFO,
      verificationStatus: VERIFICATION_STATUS.VERIFIED
    });
  }

  let oaf = null;
  if (primaryOaf) {
    const props = primaryOaf.properties || {};
    const contents = primaryOaf.contents || {};
    oaf = Object.freeze({
      id: primaryOaf.id || null,
      source: primaryOaf.source || 'us',
      maxProbM5Plus1Wk: props['prob-m5-1wk'] !== undefined ? Number(props['prob-m5-1wk']) : null,
      forecastJsonUrl: contents['forecast.json']?.url || null,
      provenance: DATA_PROVENANCE_SOURCE.OFFICIAL_DISASTER_INFO,
      verificationStatus: VERIFICATION_STATUS.VERIFIED
    });
  }

  let status = USGS_PRODUCT_STATUS.UNAVAILABLE;
  if (shakemap && oaf) status = USGS_PRODUCT_STATUS.AVAILABLE;
  else if (shakemap || oaf) status = USGS_PRODUCT_STATUS.PARTIAL;

  return Object.freeze({
    status,
    shakemap,
    oaf,
    provenance: DATA_PROVENANCE_SOURCE.OFFICIAL_DISASTER_INFO,
    scientificCaveat: status === USGS_PRODUCT_STATUS.UNAVAILABLE
      ? '공식 USGS ShakeMap/OAF 산출물이 존재하지 않아 null로 유지됩니다 (임의 경험식 추정 금지).'
      : '공식 USGS ShakeMap/OAF 산출물 메타데이터가 검증되었습니다.'
  });
}

/**
 * Parse official USGS ShakeMap `cont_mmi.json` GeoJSON contours into Local ENU meters
 * anchored at `anchor` using Bowring/WGS84 ellipsoid geometry.
 */
export function parseShakeMapMmiContours(contMmiGeoJson, anchor = HANYANG_BLDG212_ANCHOR) {
  if (!contMmiGeoJson || !Array.isArray(contMmiGeoJson.features)) {
    return Object.freeze([]);
  }

  const lta = new LocalTangentAnchor(anchor);
  const contours = [];

  for (const feature of contMmiGeoJson.features) {
    const geom = feature?.geometry;
    const props = feature?.properties || {};
    const mmiValue = props.value ?? props.MMI ?? props.mmi ?? null;
    if (!geom || !Array.isArray(geom.coordinates)) continue;

    let rings = [];
    if (geom.type === 'LineString') {
      rings = [geom.coordinates];
    } else if (geom.type === 'MultiLineString' || geom.type === 'Polygon') {
      rings = geom.coordinates;
    } else if (geom.type === 'MultiPolygon') {
      rings = geom.coordinates.flat();
    }

    for (const ring of rings) {
      if (!Array.isArray(ring) || ring.length < 2) continue;
      const pointsENU = ring.map(([lon, lat]) => {
        const [east_m, north_m] = lta.geodeticToENU(lat, lon, anchor.h || 0.0);
        return Object.freeze([Number(east_m.toFixed(2)), Number(north_m.toFixed(2))]);
      });

      contours.push(Object.freeze({
        mmiValue: typeof mmiValue === 'number' ? mmiValue : (mmiValue !== null ? Number(mmiValue) : null),
        colorHint: props.color || null,
        pointsENU: Object.freeze(pointsENU),
        provenance: DATA_PROVENANCE_SOURCE.OFFICIAL_DISASTER_INFO,
        verificationStatus: VERIFICATION_STATUS.VERIFIED
      }));
    }
  }

  return Object.freeze(contours);
}
