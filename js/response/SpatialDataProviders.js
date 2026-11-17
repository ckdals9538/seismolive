// ============================================================================
// SEISMOLIVE v4.0 — Swappable Regional Spatial & Seismic Data Providers
// File: js/response/SpatialDataProviders.js
//
// Universal, region-agnostic provider layer decoupling spatial data sources
// from evacuation assessment & pedestrian routing logic.
//
// 7 Independent Normalized Providers:
//   1. LocationProvider        (User current GPS vs manual point vs analysis target)
//   2. HazardProvider          (OBSERVED_EVENT / EDUCATIONAL_SYNTHETIC / HISTORICAL_RECORD)
//   3. ElevationProvider       (Terrarium AWS DEM / Local binary DEM + provenance)
//   4. BuildingProvider        (OSM concave OBB wings + Indoor scope tiers, 0 fake blocks)
//   5. RoadNetworkProvider     (OSM walkable graph + bridges/crossings/waterways)
//   6. FacilityProvider        (Multi-dimensional shelter candidate evaluation -> CONFIRMED..UNAVAILABLE)
//   7. IndoorSpatialProvider   (Section 8 strict indoor data scoping)
// ============================================================================

import {
  DATA_ORIGIN_TYPES,
  SCENARIO_TYPES,
  IMPACT_ZONE_STATUS,
  CANDIDATE_STATUS,
  CANDIDATE_FACILITY_TYPES,
  INDOOR_SPATIAL_SCOPE,
  VERIFICATION_STATUS,
  createProvenanceRecord
} from './ResponseDomainTypes.js';
import {
  decomposePolygonToOBBs,
  polygonArea2D,
  getOrCompileWalkAdjacency
} from './CampusWalkRouter.js';
import { sampleGridHeightAt } from './LocalSpatialMapLayer.js';

const WGS84_A = 6378137.0;
const WGS84_E2 = 0.00669437999014;
const DEG2RAD = Math.PI / 180;

export function projectLatLonToEN(lat, lon, anchorLat, anchorLon) {
  const lat0Rad = anchorLat * DEG2RAD;
  const sinLat = Math.sin(lat0Rad);
  const cosLat = Math.cos(lat0Rad);
  const denom = Math.sqrt(1 - WGS84_E2 * sinLat * sinLat);
  const rn = WGS84_A / denom;
  const rm = (WGS84_A * (1 - WGS84_E2)) / Math.pow(denom, 3);
  return [
    (lon - anchorLon) * DEG2RAD * rn * cosLat,
    (lat - anchorLat) * DEG2RAD * rm
  ];
}

export function unprojectENToLatLon(east_m, north_m, anchorLat, anchorLon) {
  const lat0Rad = anchorLat * DEG2RAD;
  const sinLat = Math.sin(lat0Rad);
  const cosLat = Math.cos(lat0Rad);
  const denom = Math.sqrt(1 - WGS84_E2 * sinLat * sinLat);
  const rn = WGS84_A / denom;
  const rm = (WGS84_A * (1 - WGS84_E2)) / Math.pow(denom, 3);
  return {
    lat: anchorLat + (north_m / rm) * (180 / Math.PI),
    lon: anchorLon + (east_m / (rn * cosLat)) * (180 / Math.PI)
  };
}

export function geodesicDistanceKm(lat1, lon1, lat2, lon2) {
  if (![lat1, lon1, lat2, lon2].every(Number.isFinite)) return null;
  const p1 = lat1 * DEG2RAD;
  const p2 = lat2 * DEG2RAD;
  const dp = (lat2 - lat1) * DEG2RAD;
  const dl = (lon2 - lon1) * DEG2RAD;
  const a = Math.sin(dp * 0.5) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl * 0.5) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(Math.max(0, 1 - a)));
  return Number((6371.0 * c).toFixed(2));
}

export function geodesicBearingDeg(lat1, lon1, lat2, lon2) {
  if (![lat1, lon1, lat2, lon2].every(Number.isFinite)) return null;
  const p1 = lat1 * DEG2RAD;
  const p2 = lat2 * DEG2RAD;
  const dl = (lon2 - lon1) * DEG2RAD;
  const y = Math.sin(dl) * Math.cos(p2);
  const x = Math.cos(p1) * Math.sin(p2) - Math.sin(p1) * Math.cos(p2) * Math.cos(dl);
  return Number((((Math.atan2(y, x) * 180) / Math.PI + 360) % 360).toFixed(1));
}

export const EXPERIENCE_ENTRY_MODES = Object.freeze({
  UNSELECTED: 'UNSELECTED',
  FROM_GLOBE_EVENT: 'FROM_GLOBE_EVENT',
  MY_LOCATION: 'MY_LOCATION',
  FREE_MODE: 'FREE_MODE'
});

/**
 * Single Session Truth Owner bridging Global Earth -> Earthquake -> Local Space -> Human Response.
 * Strictly isolates userActualLocation (GPS) from analysisAnchor (search/map/vicinity) and activeEvent.
 */
export class UnifiedExperienceSession {
  constructor() {
    this.entryMode = EXPERIENCE_ENTRY_MODES.UNSELECTED;
    this.userActualLocation = null; // Real GPS only: { lat, lon, accuracyMeters, timestamp, originType }
    this.gpsPermissionState = 'prompt'; // 'prompt' | 'granted' | 'denied' | 'unavailable'
    this.analysisAnchor = null; // { lat, lon, label, originType: 'GPS_OBSERVED' | 'FREE_MODE_SELECTED' | 'EVENT_VICINITY' }
    this.handedGlobeEvent = null;
    this.activeHazard = null;
    this.activeImpactEval = null;
    this.activeSpatialPackage = null;
    this.activeGuidance = null;
    this._listeners = new Set();
  }

  subscribe(fn) {
    if (typeof fn === 'function') this._listeners.add(fn);
    return () => this._listeners.delete(fn);
  }

  _emit(reason = 'update') {
    for (const fn of this._listeners) {
      try { fn(this, reason); } catch (_) {}
    }
  }

  setGlobeEventHandoff(rawOrNormalizedEvent) {
    this.entryMode = EXPERIENCE_ENTRY_MODES.FROM_GLOBE_EVENT;
    this.handedGlobeEvent = rawOrNormalizedEvent ? HazardProvider.normalizeGlobeEvent(rawOrNormalizedEvent) : null;
    this.activeHazard = this.handedGlobeEvent;
    this._emit('globe_handoff');
    return this.handedGlobeEvent;
  }

  setGpsLocationResult(gpsRes) {
    if (gpsRes?.ok && Number.isFinite(gpsRes.lat) && Number.isFinite(gpsRes.lon)) {
      this.gpsPermissionState = 'granted';
      this.userActualLocation = {
        lat: gpsRes.lat,
        lon: gpsRes.lon,
        accuracyMeters: gpsRes.location?.accuracyMeters ?? null,
        timestamp: gpsRes.location?.timestamp ?? Date.now(),
        originType: DATA_ORIGIN_TYPES.OBSERVED
      };
      this.entryMode = EXPERIENCE_ENTRY_MODES.MY_LOCATION;
      this.analysisAnchor = {
        lat: gpsRes.lat,
        lon: gpsRes.lon,
        label: '내 현재 위치 (GPS)',
        originType: 'GPS_OBSERVED',
        isActualUserGps: true
      };
    } else {
      this.gpsPermissionState = gpsRes?.error?.includes('UNAVAILABLE') ? 'unavailable' : 'denied';
      this.userActualLocation = null;
    }
    this._emit('gps_update');
    return this.userActualLocation;
  }

  setFreeModeLocation(lat, lon, label = '선택 지역', sourceKind = 'FREE_MODE_SELECTED') {
    if (!Number.isFinite(Number(lat)) || !Number.isFinite(Number(lon))) return null;
    this.entryMode = this.handedGlobeEvent && sourceKind === 'EVENT_VICINITY'
      ? EXPERIENCE_ENTRY_MODES.FROM_GLOBE_EVENT
      : EXPERIENCE_ENTRY_MODES.FREE_MODE;
    this.analysisAnchor = {
      lat: Number(Number(lat).toFixed(6)),
      lon: Number(Number(lon).toFixed(6)),
      label: label || `지정 좌표 (${Number(lat).toFixed(3)}, ${Number(lon).toFixed(3)})`,
      originType: sourceKind,
      isActualUserGps: false
    };
    this._emit('free_location_update');
    return this.analysisAnchor;
  }

  setEntryMode(mode) {
    const valid = Object.values(EXPERIENCE_ENTRY_MODES);
    this.entryMode = valid.includes(mode) ? mode : EXPERIENCE_ENTRY_MODES.UNSELECTED;
    this._emit('entry_mode');
    return this.entryMode;
  }

  clearEventHandoff() {
    this.handedGlobeEvent = null;
    this.activeHazard = null;
    this.activeImpactEval = null;
    this._emit('clear_event');
  }
}

// ----------------------------------------------------------------------------
// 1. LocationProvider
// ----------------------------------------------------------------------------
export class LocationProvider {
  constructor(initial = {}) {
    this.userCurrentLocation = initial.userCurrentLocation || null; // Real GPS only
    this.userSelectedLocation = (Number.isFinite(initial.lat) && Number.isFinite(initial.lon))
      ? {
          lat: initial.lat,
          lon: initial.lon,
          label: initial.label || '선택 지역',
          originType: 'FREE_MODE_SELECTED',
          isActualUserGps: false
        }
      : null;
    this.provenance = createProvenanceRecord({
      source: initial.userCurrentLocation ? 'BROWSER_GEOLOCATION' : 'USER_FREE_SELECTION',
      sourceType: initial.userCurrentLocation ? DATA_ORIGIN_TYPES.OBSERVED : DATA_ORIGIN_TYPES.PROVISIONAL,
      geometryAccuracy: initial.userCurrentLocation?.accuracyMeters ? `±${Math.round(initial.userCurrentLocation.accuracyMeters)}m` : '수동 지정 좌표',
      completeness: 'COMPLETE',
      verificationStatus: initial.userCurrentLocation ? VERIFICATION_STATUS.PARTIALLY_VERIFIED : VERIFICATION_STATUS.PROVISIONAL,
      confidence: initial.userCurrentLocation ? 0.72 : 0.85,
      limitations: '실외 수평 좌표 기준이며 건물 내부 위치·층수는 가정하지 않습니다.'
    });
  }

  static parseCoordinateInput(rawText) {
    const clean = String(rawText || '').trim();
    const match = clean.match(/^(-?\d+(?:\.\d+)?)\s*[,/\s]\s*(-?\d+(?:\.\d+)?)$/);
    if (!match) return null;
    let a = Number(match[1]);
    let b = Number(match[2]);
    if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
    // Swap transparently if user typed (lon, lat) in Korea range (lon ~ 124..132, lat ~ 32..40)
    if (a > 100 && b >= -90 && b <= 90) [a, b] = [b, a];
    if (a < -90 || a > 90 || b < -180 || b > 180) return null;
    return { lat: Number(a.toFixed(6)), lon: Number(b.toFixed(6)) };
  }

  async detectBrowserLocation(timeoutMs = 5500) {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      return { ok: false, error: 'BROWSER_GEOLOCATION_UNAVAILABLE' };
    }
    return new Promise(resolve => {
      navigator.geolocation.getCurrentPosition(
        pos => {
          this.userCurrentLocation = {
            lat: Number(pos.coords.latitude.toFixed(6)),
            lon: Number(pos.coords.longitude.toFixed(6)),
            accuracyMeters: pos.coords.accuracy ?? null,
            timestamp: pos.timestamp || Date.now(),
            isActualUserGps: true
          };
          this.userSelectedLocation = null; // Keep actual GPS distinct from Free Mode selection
          resolve({
            ok: true,
            lat: this.userCurrentLocation.lat,
            lon: this.userCurrentLocation.lon,
            location: this.userCurrentLocation
          });
        },
        err => resolve({ ok: false, error: err?.message || 'GEOLOCATION_DENIED' }),
        { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 60000 }
      );
    });
  }

  setGpsLocation(lat, lon, accuracyMeters = null, label = '내 현재 위치(GPS)') {
    if (!Number.isFinite(Number(lat)) || !Number.isFinite(Number(lon))) return null;
    this.userSelectedLocation = null; // Clear Free Mode anchor once live GPS becomes active
    this.userCurrentLocation = {
      lat: Number(Number(lat).toFixed(6)),
      lon: Number(Number(lon).toFixed(6)),
      accuracyMeters: Number.isFinite(Number(accuracyMeters)) ? Math.round(Number(accuracyMeters)) : null,
      label: label || '내 현재 위치(GPS)',
      originType: 'GPS_ACTUAL',
      isActualUserGps: true,
      timestamp: Date.now()
    };
    return this.userCurrentLocation;
  }

  setUserSelectedLocation(lat, lon, label = '지정 지역 (자유 모드)') {
    if (!Number.isFinite(Number(lat)) || !Number.isFinite(Number(lon))) return null;
    this.userSelectedLocation = {
      lat: Number(Number(lat).toFixed(6)),
      lon: Number(Number(lon).toFixed(6)),
      label: label || '지정 지역 (자유 모드)',
      originType: 'FREE_MODE_SELECTED',
      isActualUserGps: false
    };
    return this.userSelectedLocation;
  }

  getActiveAnalysisLocation() {
    return this.userSelectedLocation || this.userCurrentLocation || null;
  }
}

// ----------------------------------------------------------------------------
// 2. HazardProvider (Observed vs Educational Synthetic vs Historical)
// ----------------------------------------------------------------------------
function _unwrapEventVal(v) {
  if (v && typeof v === 'object' && 'v' in v) return v.v;
  return v ?? null;
}

export class HazardProvider {
  /**
   * Convert any catalog/USGS/Historical Globe event object into a strict normalized hazard contract
   * preserving source authority, uncertainty, null fields, and official ShakeMap/OAF products.
   */
  static normalizeGlobeEvent(rawEv = {}, officialProducts = null) {
    if (!rawEv || typeof rawEv !== 'object') return null;
    const isHist =
      rawEv.scenarioType === SCENARIO_TYPES.HISTORICAL_RECORD ||
      rawEv.recordType === 'historical' ||
      (typeof rawEv.century === 'number' && rawEv.century < 20);
    const scenarioType = rawEv.scenarioType
      || (isHist ? SCENARIO_TYPES.HISTORICAL_RECORD : SCENARIO_TYPES.OBSERVED_EVENT);

    const coords = rawEv.spatial?.inferredCoordinates;
    const rawLat = _unwrapEventVal(rawEv.lat) ?? rawEv.epicenterLat ?? coords?.lat ?? null;
    const rawLon = _unwrapEventVal(rawEv.lon) ?? rawEv.epicenterLon ?? coords?.lon ?? null;
    const rawMag = _unwrapEventVal(rawEv.mag) ?? rawEv.magnitude ?? null;
    const rawDepth = _unwrapEventVal(rawEv.depth) ?? rawEv.depthKm ?? rawEv.spatial?.focalDepth?.valKm ?? null;
    const rawTime = _unwrapEventVal(rawEv.time) ?? rawEv.occurredAt ?? rawEv.dateText ?? rawEv.temporal?.gregorianDate ?? null;
    const occurredAt = typeof rawTime === 'number' && Number.isFinite(rawTime)
      ? new Date(rawTime).toISOString().replace('T', ' ').slice(0, 19) + ' UTC'
      : (rawTime || (scenarioType === SCENARIO_TYPES.EDUCATIONAL_SYNTHETIC ? '교육 훈련 시나리오' : '시각 정보 미상'));

    const toNullableNum = (v) => (v !== null && v !== undefined && v !== '' && Number.isFinite(Number(v))) ? Number(v) : null;
    const parsedLat = toNullableNum(rawLat);
    const parsedLon = toNullableNum(rawLon);
    const parsedMag = toNullableNum(rawMag);
    const parsedDepth = toNullableNum(rawDepth);

    return HazardProvider.createScenario({
      id: rawEv.eventId || rawEv.id || `EV_${Date.now()}`,
      scenarioType,
      title: rawEv.titleKo || rawEv.title || rawEv.place || rawEv.spatial?.placeName || rawEv.id || '지진 사건',
      epicenterLat: parsedLat,
      epicenterLon: parsedLon,
      magnitude: (parsedMag !== null && parsedMag > 0) ? parsedMag : null,
      magScale: rawEv.magType || rawEv.magnitudeScale || null,
      depthKm: (parsedDepth !== null && parsedDepth > 0) ? parsedDepth : null,
      occurredAt,
      isRealtimeLive: rawEv.recordType === 'usgs-live',
      originText: rawEv.spatial?.placeName || rawEv.originText || rawEv.place || '진앙 위치 확인 중',
      source: rawEv.sourceName || rawEv.source || (isHist ? '한국 역사지진 사료' : 'KMA / USGS 계측 기록'),
      uncertaintyNote: rawEv.uncertaintyNote || rawEv.estimatedMagnitudeRange || null,
      usgsDetailUrl: rawEv.usgsDetailUrl || rawEv.detail || null,
      officialProducts: officialProducts || rawEv.officialProducts || null,
      isGeneralAssumptionOnly: Boolean(rawEv.isGeneralAssumptionOnly),
      selectionReasonKo: rawEv.selectionReasonKo || (scenarioType === SCENARIO_TYPES.OBSERVED_EVENT ? '글로벌 지구에서 선택한 관측 지진' : '글로벌 지구에서 선택한 역사 기록')
    });
  }

  /**
   * Normalize observed/synthetic/historical earthquake scenario independently of user city.
   */
  static createScenario(spec = {}) {
    const type = spec.scenarioType || SCENARIO_TYPES.EDUCATIONAL_SYNTHETIC;
    const isObs = type === SCENARIO_TYPES.OBSERVED_EVENT;
    const isHist = type === SCENARIO_TYPES.HISTORICAL_RECORD;
    const officialProducts = spec.officialProducts || null;
    const hasOfficialShakeMap = Boolean(officialProducts?.shakemap);

    const provenance = createProvenanceRecord({
      source: spec.source || (isObs ? 'KMA / USGS 계기 관측 기록' : isHist ? '한국 역사 지진 문헌 사료' : '교육용 일반 단층 가정 시나리오'),
      sourceType: isObs ? (hasOfficialShakeMap ? DATA_ORIGIN_TYPES.OFFICIAL : DATA_ORIGIN_TYPES.OBSERVED) : isHist ? DATA_ORIGIN_TYPES.PROVISIONAL : DATA_ORIGIN_TYPES.SYNTHETIC,
      geometryAccuracy: isObs ? '계기 진앙 오차 수 km 이내' : isHist ? '사료 추정 타원(수십 km 불확실)' : '교육용 일반 위치 가정',
      completeness: spec.magnitude != null && spec.depthKm != null ? 'COMPLETE' : 'PARTIAL',
      verificationStatus: isObs ? VERIFICATION_STATUS.VERIFIED : VERIFICATION_STATUS.PROVISIONAL,
      confidence: isObs ? 0.92 : isHist ? 0.35 : 0.0,
      limitations: isObs
        ? (hasOfficialShakeMap
          ? '공식 USGS ShakeMap 참고 정보가 포함되나, 개별 건물 내진성과 현장 지반 증폭은 별도 점검이 필요합니다.'
          : '관측소 실시간 지반 진동/ShakeMap이 없어 단순 거리-규모 선별 기준을 적용합니다.')
        : isHist
          ? '과거 문헌 사료 기록으로 현재 진행 중인 재난 경보가 아니며 좌표·규모 불확실성이 큽니다.'
          : (spec.isGeneralAssumptionOnly !== false
            ? '실제 단층 물리 모델에 근거하지 않은 교육·훈련용 일반 가정 시나리오입니다.'
            : '교육·훈련용 합성 매개변수이며 실제 발생 지진이 아닙니다.')
    });

    return Object.freeze({
      id: spec.id || `${type}_${Date.now()}`,
      scenarioType: type,
      title: spec.title || (type === SCENARIO_TYPES.EDUCATIONAL_SYNTHETIC ? '교육용 합성 지진 시나리오' : '지진 시나리오'),
      epicenterLat: spec.epicenterLat ?? null,
      epicenterLon: spec.epicenterLon ?? null,
      magnitude: typeof spec.magnitude === 'number' ? spec.magnitude : null,
      magScale: spec.magScale || (typeof spec.magnitude === 'number' ? 'M' : null),
      depthKm: typeof spec.depthKm === 'number' ? spec.depthKm : null,
      occurredAt: spec.occurredAt || (type === SCENARIO_TYPES.EDUCATIONAL_SYNTHETIC ? 'DRILL_SYNTHETIC' : null),
      isRealtimeLive: Boolean(spec.isRealtimeLive),
      originText: spec.originText || '진원 위치 정보 확인 중',
      uncertaintyNote: spec.uncertaintyNote || null,
      usgsDetailUrl: spec.usgsDetailUrl || null,
      officialProducts: officialProducts ? Object.freeze({
        status: officialProducts.status || 'UNAVAILABLE',
        shakemap: officialProducts.shakemap || null,
        aftershockForecast: officialProducts.oaf || officialProducts.aftershockForecast || null
      }) : Object.freeze({
        status: 'OFFICIAL_PRODUCT_UNAVAILABLE',
        shakemap: null,
        aftershockForecast: null
      }),
      isGeneralAssumptionOnly: spec.isGeneralAssumptionOnly !== undefined ? Boolean(spec.isGeneralAssumptionOnly) : type === SCENARIO_TYPES.EDUCATIONAL_SYNTHETIC,
      selectionReasonKo: spec.selectionReasonKo || null,
      simulatedPga_g: spec.simulatedPga_g ?? null,
      provenance
    });
  }

  /**
   * Evaluate whether a target (user or analysis location) falls within seismic screening zone.
   * Incorporates official ShakeMap maxMMI when present, never treats OAF forecast as present PGA,
   * and never equates "outside screening radius" with guaranteed safety.
   */
  static evaluateSeismicImpactAtLocation(hazard, userLat, userLon) {
    if (!hazard || !Number.isFinite(userLat) || !Number.isFinite(userLon) ||
      !Number.isFinite(hazard.epicenterLat) || !Number.isFinite(hazard.epicenterLon)) {
      return {
        impactStatus: IMPACT_ZONE_STATUS.UNKNOWN,
        distanceKm: null,
        bearingDeg: null,
        pWaveEtaSec: null,
        sWaveEtaSec: null,
        officialShakemapUsed: false,
        maxReportedMmi: null,
        aftershockProbabilityNote: null,
        shouldRecommendLocalEvacuation: false,
        explanationKo: '지진 발생 좌표 또는 분석 기준 위치가 확정되지 않아 영향권 여부를 평가할 수 없습니다.',
        limitations: '좌표 정보 부재로 인한 판단 보류'
      };
    }

    const distanceKm = geodesicDistanceKm(userLat, userLon, hazard.epicenterLat, hazard.epicenterLon);
    const bearingDeg = geodesicBearingDeg(userLat, userLon, hazard.epicenterLat, hazard.epicenterLon);
    const depthKm = typeof hazard.depthKm === 'number' && hazard.depthKm >= 0 ? hazard.depthKm : null;
    const hypoKm = depthKm !== null ? Math.hypot(distanceKm, depthKm) : distanceKm;
    const pWaveEtaSec = Number((hypoKm / 6.0).toFixed(1));
    const sWaveEtaSec = Number((hypoKm / 3.5).toFixed(1));

    const shake = hazard.officialProducts?.shakemap || null;
    const oaf = hazard.officialProducts?.aftershockForecast || null;
    const aftershockProbabilityNote = oaf && typeof oaf.maxProbM5Plus1Wk === 'number'
      ? `USGS OAF 1주 내 M5+ 여진 통계 확률 ${(oaf.maxProbM5Plus1Wk * 100).toFixed(1)}% (현재 진동 실측 아님)`
      : null;

    if (hazard.scenarioType === SCENARIO_TYPES.HISTORICAL_RECORD) {
      return {
        impactStatus: IMPACT_ZONE_STATUS.HISTORICAL_REFERENCE_ONLY,
        distanceKm,
        bearingDeg,
        pWaveEtaSec,
        sWaveEtaSec,
        officialShakemapUsed: false,
        maxReportedMmi: null,
        aftershockProbabilityNote: null,
        shouldRecommendLocalEvacuation: false,
        explanationKo: `과거 역사 문헌 사료(${hazard.title}) 진앙 추정 위치와 거리 ${distanceKm}km 참고 정보입니다. 현재 진행 중인 재난이 아닙니다.`,
        limitations: '역사 문헌 추정 진앙으로 현대 건물 응답·지반 진동 실측이 아닙니다.'
      };
    }

    const mag = typeof hazard.magnitude === 'number' ? hazard.magnitude : 5.0;
    // Conservative physical screening radii (MODELLED screening rule — NOT a site-specific GMPE loss prediction)
    const impactRadiusKm = Math.max(15, Math.min(220, Math.pow(10, 0.38 * mag - 0.39)));
    const feltRadiusKm = Math.max(impactRadiusKm * 2.4, Math.min(600, impactRadiusKm * 3.2));
    const shakeSuffix = shake?.maxMmi ? ` · 공식 ShakeMap 최대 MMI ${shake.maxMmi}` : '';

    if (hazard.scenarioType === SCENARIO_TYPES.EDUCATIONAL_SYNTHETIC) {
      const withinDrill = distanceKm <= impactRadiusKm;
      const assumptionTag = hazard.isGeneralAssumptionOnly ? '실제 단층 미근거 · 교육용 일반 가정' : '교육용 합성 모델';
      return {
        impactStatus: withinDrill ? IMPACT_ZONE_STATUS.EDUCATIONAL_DRILL : IMPACT_ZONE_STATUS.OUTSIDE_IMPACT_ZONE,
        distanceKm,
        bearingDeg,
        pWaveEtaSec,
        sWaveEtaSec,
        impactRadiusKm: Math.round(impactRadiusKm),
        feltRadiusKm: Math.round(feltRadiusKm),
        officialShakemapUsed: false,
        maxReportedMmi: null,
        aftershockProbabilityNote: null,
        shouldRecommendLocalEvacuation: withinDrill,
        explanationKo: withinDrill
          ? `교육용 합성 지진(M${mag.toFixed(1)}, 깊이 ${depthKm ?? '미상'}km)의 선별 참고 반경(${Math.round(impactRadiusKm)}km 이내, 거리 ${distanceKm}km)에 대한 대응 훈련입니다.`
          : `설정한 가상 진앙(${distanceKm}km)은 단순 거리-규모 선별 반경(약 ${Math.round(impactRadiusKm)}km) 밖입니다. 진앙 인접 지역으로 이동해 대응 상황을 점검할 수 있습니다.`,
        limitations: `${assumptionTag} · 정밀 피해 예측이 아니며 실제 발생 지진이 아닙니다.`
      };
    }

    if (distanceKm <= impactRadiusKm) {
      return {
        impactStatus: IMPACT_ZONE_STATUS.IN_IMPACT_ZONE,
        distanceKm,
        bearingDeg,
        pWaveEtaSec,
        sWaveEtaSec,
        impactRadiusKm: Math.round(impactRadiusKm),
        feltRadiusKm: Math.round(feltRadiusKm),
        officialShakemapUsed: Boolean(shake),
        maxReportedMmi: shake?.maxMmi ?? null,
        aftershockProbabilityNote,
        shouldRecommendLocalEvacuation: true,
        explanationKo: `실제 관측 지진(${hazard.title}, ${hazard.magScale || 'M'}${hazard.magnitude ?? '미상'})의 보수적 선별 반경(약 ${Math.round(impactRadiusKm)}km) 내 위치입니다(거리 ${distanceKm}km${shakeSuffix}).`,
        limitations: shake
          ? '공식 ShakeMap 참고값과 거리 기반 선별 결합 결과이나, 개별 건축물 손상은 현장 확인이 우선됩니다.'
          : '공식 ShakeMap/관측소 실측이 부재한 거리-규모 선별 판단이며 정밀 피해 예측이 아닙니다.'
      };
    }

    if (distanceKm <= feltRadiusKm) {
      return {
        impactStatus: IMPACT_ZONE_STATUS.MARGINAL_FELT_ZONE,
        distanceKm,
        bearingDeg,
        pWaveEtaSec,
        sWaveEtaSec,
        impactRadiusKm: Math.round(impactRadiusKm),
        feltRadiusKm: Math.round(feltRadiusKm),
        officialShakemapUsed: Boolean(shake),
        maxReportedMmi: shake?.maxMmi ?? null,
        aftershockProbabilityNote,
        shouldRecommendLocalEvacuation: false,
        explanationKo: `실제 관측 지진(${hazard.title})으로부터 ${distanceKm}km 떨어져 있어 단순 선별 모델상 약한 진동 감진 권역으로 분류되었습니다${shakeSuffix}.`,
        limitations: '단순 거리 기반 선별은 절대 안전을 보증하지 않습니다. 실제 체감 흔들림, 낙하물 및 기상청 특보를 우선 확인하십시오.'
      };
    }

    return {
      impactStatus: IMPACT_ZONE_STATUS.OUTSIDE_IMPACT_ZONE,
      distanceKm,
      bearingDeg,
      pWaveEtaSec,
      sWaveEtaSec,
      impactRadiusKm: Math.round(impactRadiusKm),
      feltRadiusKm: Math.round(feltRadiusKm),
      officialShakemapUsed: Boolean(shake),
      maxReportedMmi: shake?.maxMmi ?? null,
      aftershockProbabilityNote,
      shouldRecommendLocalEvacuation: false,
      explanationKo: `실제 관측 지진(${hazard.title})은 분석 기준 위치에서 ${distanceKm}km 떨어져 단순 선별 강진 반경 바깥입니다${shakeSuffix}.`,
      limitations: '선별 반경 외 분류가 무조건적인 안전 또는 대피 불필요를 보증하지 않으며, 실제 피해 현장 확인은 진앙권 이동으로 점검할 수 있습니다.'
    };
  }
}

// ----------------------------------------------------------------------------
// 2B. AutoScenarioResolver (Automatic Relevant Event or Educational Assumption)
// ----------------------------------------------------------------------------
export class AutoScenarioResolver {
  static resolveForLocation({
    anchorLat,
    anchorLon,
    anchorLabel = '선택 지역',
    catalogEvents = [],
    handedEvent = null,
    preferredMode = 'AUTO'
  }) {
    if (handedEvent && preferredMode === 'AUTO') {
      return HazardProvider.normalizeGlobeEvent(handedEvent, handedEvent.officialProducts || null);
    }

    const candidates = (Array.isArray(catalogEvents) ? catalogEvents : [])
      .map(ev => HazardProvider.normalizeGlobeEvent(ev, ev?.officialProducts || null))
      .filter(ev => ev && Number.isFinite(ev.epicenterLat) && Number.isFinite(ev.epicenterLon))
      .map(ev => ({
        ev,
        distKm: geodesicDistanceKm(anchorLat, anchorLon, ev.epicenterLat, ev.epicenterLon)
      }));

    if (preferredMode === 'HISTORICAL') {
      const hist = candidates
        .filter(c => c.ev.scenarioType === SCENARIO_TYPES.HISTORICAL_RECORD)
        .sort((a, b) => a.distKm - b.distKm)[0];
      if (hist) {
        return HazardProvider.createScenario({
          ...hist.ev,
          selectionReasonKo: `${anchorLabel}에서 가장 가까운 한반도 역사 지진 문헌 기록(${Math.round(hist.distKm)}km)입니다.`
        });
      }
    }

    if (preferredMode === 'AUTO' || preferredMode === 'OBSERVED') {
      const observedNearby = candidates
        .filter(c => c.ev.scenarioType === SCENARIO_TYPES.OBSERVED_EVENT)
        .filter(c => {
          const mag = typeof c.ev.magnitude === 'number' ? c.ev.magnitude : 4.8;
          const relRadiusKm = Math.max(40, Math.min(180, Math.pow(10, 0.38 * mag - 0.39) * 1.25));
          return c.distKm <= relRadiusKm;
        })
        .sort((a, b) => a.distKm - b.distKm);

      if (observedNearby.length > 0) {
        const best = observedNearby[0];
        return HazardProvider.createScenario({
          ...best.ev,
          selectionReasonKo: `${anchorLabel} 반경 ${best.distKm}km 내 계기 관측 지진(${best.ev.title})을 자동 연계했습니다.`
        });
      }

      if (preferredMode === 'OBSERVED' && candidates.some(c => c.ev.scenarioType === SCENARIO_TYPES.OBSERVED_EVENT)) {
        const closestObs = candidates
          .filter(c => c.ev.scenarioType === SCENARIO_TYPES.OBSERVED_EVENT)
          .sort((a, b) => a.distKm - b.distKm)[0];
        return HazardProvider.createScenario({
          ...closestObs.ev,
          selectionReasonKo: `${anchorLabel} 주변 영향권 내 최근 지진이 없어 가장 인접한 관측 기록(${Math.round(closestObs.distKm)}km)을 표시합니다.`
        });
      }
    }

    const isEastCoast = anchorLon >= 128.4 && anchorLat >= 35.0;
    const isSoutheastCoast = anchorLon >= 128.8 && anchorLat <= 35.6;
    const mag = isSoutheastCoast ? 5.6 : isEastCoast ? 5.4 : 5.2;
    const depthKm = isEastCoast ? 12 : 10;
    const offsetLat = isEastCoast ? 0.036 : 0.032;
    const offsetLon = isEastCoast ? 0.068 : 0.045;
    const geoContextText = isEastCoast
      ? '동해안 연안 해역 가정 진원 (실제 단층 모델이 아닌 교육용 일반 가정)'
      : '인근 천부 단층 가정 진원 (실제 단층 모델이 아닌 교육용 일반 가정)';

    return HazardProvider.createScenario({
      id: `SYNTH_AUTO_${anchorLat.toFixed(2)}_${anchorLon.toFixed(2)}`,
      scenarioType: SCENARIO_TYPES.EDUCATIONAL_SYNTHETIC,
      title: `${anchorLabel} 교육용 합성 지진 시나리오 (M${mag.toFixed(1)})`,
      epicenterLat: Number((anchorLat + offsetLat).toFixed(4)),
      epicenterLon: Number((anchorLon + offsetLon).toFixed(4)),
      magnitude: mag,
      magScale: 'M',
      depthKm,
      occurredAt: 'EDUCATIONAL_GENERAL_ASSUMPTION',
      originText: `${anchorLabel} 인근 (${geoContextText})`,
      source: 'SEISMOLIVE 교육용 일반 가정 시나리오',
      isGeneralAssumptionOnly: true,
      selectionReasonKo: `${anchorLabel} 기준 실제 관측 강진 기록이 없어 지형 환경 기반 교육용 일반 가정 시나리오(M${mag.toFixed(1)})를 자동 구성했습니다.`
    });
  }
}

// ----------------------------------------------------------------------------
// 3. IndoorSpatialProvider (Section 8 Tier Enforcement)
// ----------------------------------------------------------------------------
export class IndoorSpatialProvider {
  static classifyBuildingIndoorScope(tags = {}, hasPilotFloorplan = false) {
    if (hasPilotFloorplan) {
      return {
        indoorScope: INDOOR_SPATIAL_SCOPE.PROVISIONAL_FLOORPLAN,
        hasIndoorNetwork: true,
        levelsKnown: Number(tags['building:levels']) || null,
        provenance: createProvenanceRecord({
          source: '파일럿 잠정 실내 그래프 (현장 미실측)',
          sourceType: DATA_ORIGIN_TYPES.PROVISIONAL,
          completeness: 'PROVISIONAL_3F_ONLY',
          verificationStatus: VERIFICATION_STATUS.PROVISIONAL,
          confidence: 0.45,
          limitations: '출입문·복도 폭은 현장 실측(F-01~F-02) 완료 전까지 잠정치입니다.'
        })
      };
    }

    const lvls = parseFloat(String(tags['building:levels'] || '').replace(/[^0-9.]/g, ''));
    const h = parseFloat(String(tags.height || '').replace(/[^0-9.]/g, ''));
    if (Number.isFinite(lvls) && lvls >= 1) {
      return {
        indoorScope: INDOOR_SPATIAL_SCOPE.LEVEL_COUNT_ONLY,
        hasIndoorNetwork: false,
        levelsKnown: Math.round(lvls),
        provenance: createProvenanceRecord({
          source: 'OpenStreetMap 건물 태그 (building:levels)',
          sourceType: DATA_ORIGIN_TYPES.PROVISIONAL,
          geometryAccuracy: '외곽 풋프린트만 확보',
          completeness: 'NO_INDOOR_FLOORPLAN',
          verificationStatus: VERIFICATION_STATUS.UNAVAILABLE,
          confidence: 0.3,
          limitations: '층수 정보만 존재하며 실내 평면도·비상계단·출입구 위치는 미확인 상태입니다.'
        })
      };
    }
    if (Number.isFinite(h) && h >= 2.5) {
      return {
        indoorScope: INDOOR_SPATIAL_SCOPE.HEIGHT_ONLY_3D,
        hasIndoorNetwork: false,
        levelsKnown: null,
        provenance: createProvenanceRecord({
          source: 'OpenStreetMap 건물 높이 태그 (height)',
          sourceType: DATA_ORIGIN_TYPES.PROVISIONAL,
          completeness: 'NO_INDOOR_FLOORPLAN',
          verificationStatus: VERIFICATION_STATUS.UNAVAILABLE,
          confidence: 0.25,
          limitations: '건물 외형 높이만 존재하며 실내 공간 및 출구 정보는 미확보 상태입니다.'
        })
      };
    }

    return {
      indoorScope: INDOOR_SPATIAL_SCOPE.FOOTPRINT_ONLY,
      hasIndoorNetwork: false,
      levelsKnown: null,
      provenance: createProvenanceRecord({
        source: 'OpenStreetMap 건물 외곽 풋프린트',
        sourceType: DATA_ORIGIN_TYPES.PROVISIONAL,
        geometryAccuracy: '2D 외곽 다각형',
        completeness: 'FOOTPRINT_ONLY',
        verificationStatus: VERIFICATION_STATUS.UNAVAILABLE,
        confidence: 0.2,
        limitations: '건물 위치와 외곽만 확인되며 높이·층수·실내 도면은 미확인 상태입니다.'
      })
    };
  }
}

// ----------------------------------------------------------------------------
// 4. BuildingProvider (Zero Fake Buildings When Sparse/Missing)
// ----------------------------------------------------------------------------
export class BuildingProvider {
  static extractFromOsmElements(elements = [], { anchorLat, anchorLon, terrainGrid, halfExtentMeters = 2000 }) {
    const nodeMap = new Map();
    for (const el of elements) {
      if (el.type === 'node' && Number.isFinite(el.lat) && Number.isFinite(el.lon)) {
        const [e, n] = projectLatLonToEN(el.lat, el.lon, anchorLat, anchorLon);
        nodeMap.set(el.id, [Number(e.toFixed(2)), Number(n.toFixed(2))]);
      }
    }

    const obbRawList = [];
    const buildingPolygons = [];
    const namedBuildings = [];

    for (const el of elements) {
      if (el.type !== 'way' || !el.tags?.building) continue;
      const tags = el.tags;
      const ptsEN = [];
      for (const nid of (el.nodes || [])) {
        const pt = nodeMap.get(nid);
        if (pt) ptsEN.push(pt);
      }
      if (ptsEN.length < 3) continue;

      let sumE = 0, sumN = 0;
      for (const p of ptsEN) { sumE += p[0]; sumN += p[1]; }
      const cE = sumE / ptsEN.length;
      const cN = sumN / ptsEN.length;
      if (Math.abs(cE) > halfExtentMeters + 250 || Math.abs(cN) > halfExtentMeters + 250) continue;

      const clean = ptsEN.slice();
      if (clean.length > 2 && Math.hypot(clean[0][0] - clean[clean.length - 1][0], clean[0][1] - clean[clean.length - 1][1]) < 0.05) {
        clean.pop();
      }
      if (clean.length < 3) continue;

      const area = polygonArea2D(clean);
      if (area < 9.0) continue;

      const indoorMeta = IndoorSpatialProvider.classifyBuildingIndoorScope(tags, false);
      const rawH = parseFloat(String(tags.height || '').replace(/[^0-9.]/g, ''));
      const rawLvls = parseFloat(String(tags['building:levels'] || '').replace(/[^0-9.]/g, ''));
      const hasKnownHeight = Number.isFinite(rawH) && rawH >= 3 && rawH <= 260;
      const hasKnownLevels = Number.isFinite(rawLvls) && rawLvls >= 1 && rawLvls <= 80;
      // Deterministic morphological hint ONLY when OSM lacks explicit height/levels (never marks unverified height as verified)
      let visualHeightMeters = hasKnownHeight ? rawH : hasKnownLevels ? Number((rawLvls * 3.3).toFixed(1)) : null;
      if (visualHeightMeters === null) {
        const bTag = tags.building || '';
        const hHash = (Math.imul(Number(el.id) || 1, 2654435761) >>> 0) / 4294967296;
        if (bTag === 'apartments') {
          visualHeightMeters = Number((18.0 + hHash * 15.0).toFixed(1));
        } else if (bTag === 'commercial' || bTag === 'retail' || bTag === 'public' || tags.amenity === 'hospital') {
          visualHeightMeters = Number((8.5 + Math.min(11.0, area * 0.007) + hHash * 4.0).toFixed(1));
        } else if (bTag === 'industrial' || bTag === 'warehouse') {
          visualHeightMeters = Number((7.2 + hHash * 3.8).toFixed(1));
        } else {
          visualHeightMeters = Number((4.8 + Math.min(4.0, area * 0.012) + hHash * 2.8).toFixed(1));
        }
      }

      const wingObbs = decomposePolygonToOBBs(clean, visualHeightMeters);
      const groundY = sampleGridHeightAt(terrainGrid, cE, cN);
      let minCornerY = groundY;
      for (let k = 0; k < clean.length; k++) {
        const cy = sampleGridHeightAt(terrainGrid, clean[k][0], clean[k][1]);
        if (cy < minCornerY) minCornerY = cy;
      }
      // Match rooftop elevation against centroid so steep hill buildings anchor into ground cleanly without shrinking skyline height
      const topElevOffset = Math.max(0, groundY - minCornerY);

      const bName = tags['name:ko'] || tags.name || tags['addr:housename'] || null;
      const bObj = {
        id: `OSM_BLDG_${el.id}`,
        osmWayId: el.id,
        name: bName || `건물 #${el.id}`,
        hasExplicitName: Boolean(bName),
        useType: tags.amenity || tags.building || 'yes',
        category: tags.amenity === 'hospital' ? 'MEDICAL' : tags.amenity === 'school' || tags.building === 'school' ? 'SCHOOL' : 'URBAN_BUILDING',
        east_m: Number(cE.toFixed(2)),
        north_m: Number(cN.toFixed(2)),
        groundY_m: Number(groundY.toFixed(2)),
        width_m: Number((wingObbs[0]?.[2] || 14).toFixed(2)),
        depth_m: Number((wingObbs[0]?.[3] || 14).toFixed(2)),
        yaw_rad: Number((wingObbs[0]?.[4] || 0).toFixed(4)),
        height_m: Number(visualHeightMeters.toFixed(2)),
        heightVerified: hasKnownHeight || hasKnownLevels,
        indoorScope: indoorMeta.indoorScope,
        levelsKnown: indoorMeta.levelsKnown,
        isTargetBuilding: false,
        priority: tags.amenity === 'hospital' || tags.building === 'public' ? 88 : Math.min(82, Math.round(45 + area * 0.015)),
        provenance: indoorMeta.provenance
      };

      for (const obb of wingObbs) {
        obbRawList.push({
          buildingId: bObj.id,
          name: bObj.name,
          east_m: Number(obb[0].toFixed(2)),
          north_m: Number(obb[1].toFixed(2)),
          width_m: Number(obb[2].toFixed(2)),
          depth_m: Number(obb[3].toFixed(2)),
          yaw_rad: Number(obb[4].toFixed(4)),
          height_m: Number(obb[5].toFixed(2)),
          groundY_m: sampleGridHeightAt(terrainGrid, obb[0], obb[1])
        });
      }

      buildingPolygons.push({
        buildingId: bObj.id,
        name: bObj.name,
        ptsEN: clean,
        east_m: bObj.east_m,
        north_m: bObj.north_m,
        width_m: bObj.width_m,
        depth_m: bObj.depth_m,
        yaw_rad: bObj.yaw_rad,
        height_m: Number((visualHeightMeters + topElevOffset * 0.5).toFixed(2)),
        groundY_m: Number(minCornerY.toFixed(2))
      });

      if (bName || namedBuildings.length < 60) {
        namedBuildings.push(bObj);
      }
    }

    obbRawList.sort((a, b) => b.height_m - a.height_m);
    buildingPolygons.sort((a, b) => b.height_m - a.height_m);
    const obbFloat32 = new Float32Array(obbRawList.length * 6);
    const groundOffsets = new Float32Array(obbRawList.length);
    for (let i = 0; i < obbRawList.length; i++) {
      const b = obbRawList[i];
      const base = i * 6;
      obbFloat32[base + 0] = b.east_m;
      obbFloat32[base + 1] = b.north_m;
      obbFloat32[base + 2] = b.width_m;
      obbFloat32[base + 3] = b.depth_m;
      obbFloat32[base + 4] = b.yaw_rad;
      obbFloat32[base + 5] = b.height_m;
      groundOffsets[i] = b.groundY_m;
    }

    const tallCount = obbRawList.filter(b => b.height_m >= 18).length;
    const overviewCount = obbRawList.length === 0 ? 0 : Math.min(obbRawList.length, Math.max(120, tallCount));

    return {
      obbRawList,
      buildingPolygons,
      obbBuildingsFloat32: obbFloat32,
      obbGroundOffsets: groundOffsets,
      obbLodCounts: { overviewCount, fullCount: obbRawList.length, stride: 6 },
      namedBuildings,
      provenance: createProvenanceRecord({
        source: 'OpenStreetMap 건축물 외곽 데이터',
        sourceType: obbRawList.length > 0 ? DATA_ORIGIN_TYPES.PROVISIONAL : DATA_ORIGIN_TYPES.UNKNOWN,
        geometryAccuracy: 'OSM 커뮤니티 매핑 (±2~5m)',
        completeness: obbRawList.length >= 20 ? 'MODERATE' : obbRawList.length > 0 ? 'SPARSE' : 'EMPTY',
        verificationStatus: obbRawList.length > 0 ? VERIFICATION_STATUS.PROVISIONAL : VERIFICATION_STATUS.UNAVAILABLE,
        confidence: obbRawList.length >= 20 ? 0.65 : obbRawList.length > 0 ? 0.35 : 0.0,
        limitations: obbRawList.length === 0
          ? '해당 반경 내 등록된 건축물 데이터가 없습니다.'
          : '건축물 내진설계 여부 및 실내 도면은 포함되지 않았습니다.'
      })
    };
  }
}

// ----------------------------------------------------------------------------
// 5. RoadNetworkProvider (Walkable Graph + Bridges + Waterways)
// ----------------------------------------------------------------------------
function isSegmentBlockedByWaterPolygons(aXZ, bXZ, waterPolygons = []) {
  if (!waterPolygons || waterPolygons.length === 0) return false;
  const mx = (aXZ[0] + bXZ[0]) * 0.5;
  const mn = -(aXZ[1] + bXZ[1]) * 0.5;
  for (const item of waterPolygons) {
    const poly = item?.outer || item;
    if (!Array.isArray(poly) || poly.length < 3) continue;
    let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const xi = poly[i][0], yi = poly[i][1];
      const xj = poly[j][0], yj = poly[j][1];
      if (((yi > mn) !== (yj > mn)) && (mx < ((xj - xi) * (mn - yi)) / ((yj - yi) || 1e-9) + xi)) {
        inside = !inside;
      }
    }
    if (inside) return true;
  }
  return false;
}

export class RoadNetworkProvider {
  static classifyRoad(tags = {}) {
    const hw = String(tags.highway || '').toLowerCase();
    if (tags.railway === 'rail' || tags.railway === 'subway' || tags.railway === 'light_rail') return 'rail';
    if (hw === 'motorway' || hw === 'motorway_link') return 'motorway';
    if (hw === 'trunk' || hw === 'trunk_link') return 'trunk';
    if (hw === 'primary' || hw === 'primary_link') return 'primary';
    if (hw === 'secondary' || hw === 'secondary_link') return 'secondary';
    if (hw === 'tertiary' || hw === 'tertiary_link' || hw === 'unclassified') return 'tertiary';
    if (hw === 'footway' || hw === 'steps' || hw === 'pedestrian' || hw === 'path' || hw === 'cycleway' || hw === 'living_street' || hw === 'residential' || hw === 'service') {
      return (hw === 'footway' || hw === 'steps' || hw === 'pedestrian' || hw === 'path') ? 'footway' : 'tertiary';
    }
    return null;
  }

  static isWalkable(tags = {}) {
    const hw = String(tags.highway || '').toLowerCase();
    if (!hw) return false;
    if (hw === 'motorway' || hw === 'motorway_link' || hw === 'trunk' || hw === 'trunk_link') return false;
    if (tags.access === 'no' || tags.access === 'private') return false;
    return [
      'footway', 'steps', 'pedestrian', 'path', 'cycleway',
      'living_street', 'residential', 'service', 'unclassified',
      'tertiary', 'tertiary_link', 'secondary', 'secondary_link',
      'primary', 'primary_link', 'track'
    ].includes(hw);
  }

  static extractFromOsmElements(elements = [], { anchorLat, anchorLon, terrainGrid, halfExtentMeters = 2000 }) {
    const osmNodes = new Map();
    for (const el of elements) {
      if (el.type === 'node' && Number.isFinite(el.lat) && Number.isFinite(el.lon)) {
        const [e, n] = projectLatLonToEN(el.lat, el.lon, anchorLat, anchorLon);
        osmNodes.set(el.id, { id: el.id, e: Number(e.toFixed(2)), n: Number(n.toFixed(2)), tags: el.tags || null });
      }
    }

    const denseRoadNetwork = [];
    const walkableWays = [];
    const waterPolygons = [];
    const waterways = [];
    const greenPolygons = [];

    for (const el of elements) {
      if (el.type !== 'way') continue;
      const tags = el.tags || {};
      const pts = [];
      for (const nid of (el.nodes || [])) {
        const nd = osmNodes.get(nid);
        if (nd) pts.push([nd.e, nd.n, nd.id]);
      }
      if (pts.length < 2) continue;

      let cE = 0, cN = 0, minE = Infinity, maxE = -Infinity, minN = Infinity, maxN = -Infinity;
      for (const p of pts) {
        cE += p[0]; cN += p[1];
        if (p[0] < minE) minE = p[0]; if (p[0] > maxE) maxE = p[0];
        if (p[1] < minN) minN = p[1]; if (p[1] > maxN) maxN = p[1];
      }
      cE /= pts.length;
      cN /= pts.length;
      if (Math.abs(cE) > halfExtentMeters + 350 || Math.abs(cN) > halfExtentMeters + 350) continue;

      const ptsEN = pts.map(p => [p[0], p[1]]);
      const roadCls = RoadNetworkProvider.classifyRoad(tags);
      if (roadCls) {
        const bridgeInt = tags.bridge && tags.bridge !== 'no' ? 1 : 0;
        const tunnelInt = tags.tunnel && tags.tunnel !== 'no' ? 1 : 0;
        denseRoadNetwork.push([roadCls, bridgeInt, ptsEN]);
        if (RoadNetworkProvider.isWalkable(tags)) {
          walkableWays.push({ tags, pts, isBridge: bridgeInt === 1, isTunnel: tunnelInt === 1 });
        }
        continue;
      }

      if (tags.waterway && !tags.natural) {
        waterways.push({
          id: `WATERWAY_${el.id}`,
          name: tags['name:ko'] || tags.name || '하천',
          widthMeters: tags.waterway === 'river' ? 36.0 : 12.0,
          elevationY: Number((sampleGridHeightAt(terrainGrid, cE, cN) - 0.6).toFixed(2)),
          provenance: VERIFICATION_STATUS.VERIFIED,
          pointsEN: ptsEN
        });
        continue;
      }

      if ((tags.natural === 'water' || tags.waterway === 'riverbank') && ptsEN.length >= 3) {
        waterPolygons.push({
          outer: ptsEN,
          holes: [],
          y: Number((sampleGridHeightAt(terrainGrid, cE, cN) - 0.5).toFixed(2))
        });
        continue;
      }

      const isGreen = tags.leisure === 'park' || tags.leisure === 'pitch' || tags.leisure === 'stadium' ||
        tags.leisure === 'garden' || tags.landuse === 'grass' || tags.landuse === 'meadow' ||
        tags.landuse === 'recreation_ground' || tags.landuse === 'forest' ||
        tags.natural === 'wood' || tags.natural === 'scrub';
      const spawnsTrees = isGreen && tags.leisure !== 'stadium' && tags.leisure !== 'pitch';
      if (isGreen && ptsEN.length >= 3 && polygonArea2D(ptsEN) >= 220) {
        greenPolygons.push(ptsEN);
        const { nx, nz, halfExtentMeters: gh, greenMask } = terrainGrid;
        if (spawnsTrees && greenMask && gh > 0) {
          const span = gh * 2;
          const i0 = Math.max(0, Math.floor(((minE + gh) / span) * nx));
          const i1 = Math.min(nx, Math.ceil(((maxE + gh) / span) * nx));
          const j0 = Math.max(0, Math.floor(((minN + gh) / span) * nz));
          const j1 = Math.min(nz, Math.ceil(((maxN + gh) / span) * nz));
          for (let j = j0; j <= j1; j++) {
            for (let i = i0; i <= i1; i++) {
              greenMask[j * (nx + 1) + i] = 1;
            }
          }
        }
      }
    }

    // Build genuine walkable graph (NO fabricated orthogonal grid if empty!)
    const nodeIdxById = new Map();
    const nodes = [];
    const edges = [];
    const edgeWidths = [];

    const addNode = (osmId, e, n) => {
      if (nodeIdxById.has(osmId)) return nodeIdxById.get(osmId);
      const idx = nodes.length;
      const y = Number(sampleGridHeightAt(terrainGrid, e, n).toFixed(2));
      nodes.push([String(osmId), Number(e.toFixed(2)), Number(n.toFixed(2)), y]);
      nodeIdxById.set(osmId, idx);
      return idx;
    };

    for (const w of walkableWays) {
      const hw = String(w.tags.highway || 'footway');
      const hasStairs = hw === 'steps' ? 1 : 0;
      const crossingInt = hw === 'crossing' ? 1 : 0;
      const debrisRisk = w.isBridge ? 0.25 : hw === 'footway' || hw === 'pedestrian' || hw === 'steps' ? 0.08 : 0.14;
      const parsedW = parseFloat(String(w.tags.width || w.tags.est_width || '').replace(/[^0-9.]/g, ''));
      const parsedLanes = parseFloat(String(w.tags.lanes || '').replace(/[^0-9.]/g, ''));
      const widthHint = (Number.isFinite(parsedW) && parsedW >= 1.2 && parsedW <= 45)
        ? Number(parsedW.toFixed(1))
        : (Number.isFinite(parsedLanes) && parsedLanes >= 1 && parsedLanes <= 10)
          ? Number((parsedLanes * 3.2 + (w.tags.sidewalk && w.tags.sidewalk !== 'no' ? 3.0 : 0)).toFixed(1))
          : null;
      for (let i = 1; i < w.pts.length; i++) {
        const [e0, n0, id0] = w.pts[i - 1];
        const [e1, n1, id1] = w.pts[i];
        if (id0 === id1) continue;
        const dist = Math.hypot(e1 - e0, n1 - n0);
        if (dist < 0.35 || dist > 450) continue;
        // Disallow non-bridge footpath edges crossing water polygons
        if (!w.isBridge && waterPolygons.length > 0 && isSegmentBlockedByWaterPolygons([e0, -n0], [e1, -n1], waterPolygons)) {
          continue;
        }
        const u = addNode(id0, e0, n0);
        const v = addNode(id1, e1, n1);
        edges.push([u, v, Number(dist.toFixed(2)), hw, hasStairs, debrisRisk, w.isBridge ? 1 : 0, crossingInt]);
        edgeWidths.push(widthHint);
      }
    }

    const walkGraph = { anchor: { lat: anchorLat, lon: anchorLon }, nodes, edges, edgeWidths };

    return {
      denseRoadNetwork,
      waterPolygons,
      waterways,
      greenPolygons,
      walkGraph,
      provenance: createProvenanceRecord({
        source: 'OpenStreetMap 도로·보행망 데이터',
        sourceType: edges.length > 0 ? DATA_ORIGIN_TYPES.PROVISIONAL : DATA_ORIGIN_TYPES.UNKNOWN,
        geometryAccuracy: 'OSM 센터라인 (±2~4m)',
        completeness: edges.length >= 40 ? 'MODERATE' : edges.length > 0 ? 'SPARSE' : 'EMPTY',
        verificationStatus: edges.length > 0 ? VERIFICATION_STATUS.PROVISIONAL : VERIFICATION_STATUS.UNAVAILABLE,
        confidence: edges.length >= 40 ? 0.72 : edges.length > 0 ? 0.35 : 0.0,
        limitations: edges.length === 0
          ? '해당 반경 내 보행 가능 도로/보도 네트워크가 확인되지 않습니다.'
          : '보도 폭, 임시 공사, 낙하물 폐쇄 여부는 현장 확인이 필요합니다.'
      })
    };
  }
}

// ----------------------------------------------------------------------------
// 6. FacilityProvider (Multi-Dimensional Evaluation -> CONFIRMED..UNAVAILABLE)
// ----------------------------------------------------------------------------
export class FacilityProvider {
  /**
   * Discover & honestly evaluate destination candidates WITHOUT inventing shelters
   * or misclassifying unverified parks as official shelters.
   */
  static discoverAndEvaluateCandidates(elements = [], {
    anchorLat,
    anchorLon,
    terrainGrid,
    obbRawList = [],
    walkGraph = { nodes: [], edges: [] },
    waterPolygons = [],
    waterways = [],
    impactStatus = IMPACT_ZONE_STATUS.UNKNOWN,
    originEN = [0, 0],
    halfExtentMeters = 2000,
    officialShelters = []
  }) {
    const osmNodes = new Map();
    for (const el of elements) {
      if (el.type === 'node' && Number.isFinite(el.lat) && Number.isFinite(el.lon)) {
        const [e, n] = projectLatLonToEN(el.lat, el.lon, anchorLat, anchorLon);
        osmNodes.set(el.id, { id: el.id, e: Number(e.toFixed(2)), n: Number(n.toFixed(2)), tags: el.tags || null });
      }
    }

    const rawCandidates = [];

    // 1. Official Government API Designated Shelters (when provided by live /api/shelters)
    for (const sh of (officialShelters || [])) {
      if (!Number.isFinite(sh?.lat) || !Number.isFinite(sh?.lon)) continue;
      const [e, n] = projectLatLonToEN(sh.lat, sh.lon, anchorLat, anchorLon);
      if (Math.abs(e) > halfExtentMeters || Math.abs(n) > halfExtentMeters) continue;
      rawCandidates.push({
        id: sh.officialId || sh.id || `MOIS_${rawCandidates.length}`,
        name: sh.name || '공식 지진옥외대피장소',
        east_m: Number(e.toFixed(2)),
        north_m: Number(n.toFixed(2)),
        areaSqMeters: Number.isFinite(sh.areaSqMeters) ? sh.areaSqMeters : null,
        capacityOverride: Number.isFinite(sh.capacityEstimate) ? sh.capacityEstimate : null,
        isOsmAssemblyTagged: true,
        isOfficialDesignated: true,
        sourceName: sh.sourceName || '행정안전부 지진옥외대피장소 공식 DB',
        address: sh.address || null
      });
    }

    for (const el of elements) {
      const tags = el.tags || {};
      let cE = null, cN = null, area = null, ptsEN = null;

      if (el.type === 'node' && osmNodes.has(el.id)) {
        // Strictly exclude OSM amenity=shelter (rain/busstop/park gazebos) unless explicitly marked emergency assembly_point or social_facility=shelter
        if (tags.emergency !== 'assembly_point' && tags.social_facility !== 'shelter') continue;
        const nd = osmNodes.get(el.id);
        cE = nd.e;
        cN = nd.n;
      } else if (el.type === 'way') {
        const isExplicitAssembly = tags.emergency === 'assembly_point' || tags.social_facility === 'shelter';
        const isSchoolOrStadium = tags.amenity === 'school' || tags.leisure === 'stadium' || tags.leisure === 'pitch';
        const isParkOrPlaza = tags.leisure === 'park' || tags.leisure === 'recreation_ground' || tags.place === 'square' || tags.landuse === 'village_green';
        if (!isExplicitAssembly && !isSchoolOrStadium && !isParkOrPlaza) continue;

        const pts = [];
        for (const nid of (el.nodes || [])) {
          const nd = osmNodes.get(nid);
          if (nd) pts.push([nd.e, nd.n]);
        }
        if (pts.length < 3) continue;
        area = Math.round(polygonArea2D(pts));
        if (area < 550) continue; // Too small to safely escape surrounding collapse debris
        cE = pts.reduce((s, p) => s + p[0], 0) / pts.length;
        cN = pts.reduce((s, p) => s + p[1], 0) / pts.length;
        ptsEN = pts;
      } else {
        continue;
      }

      if (!Number.isFinite(cE) || Math.abs(cE) > halfExtentMeters || Math.abs(cN) > halfExtentMeters) continue;

      const isExplicitAssembly = tags.emergency === 'assembly_point' || tags.social_facility === 'shelter';
      const isPublicSchoolOrStadium = tags.amenity === 'school' || tags.leisure === 'stadium' || tags.leisure === 'pitch';
      const facilityType = isExplicitAssembly
        ? CANDIDATE_FACILITY_TYPES.LOCAL_DESIGNATED
        : isPublicSchoolOrStadium
          ? CANDIDATE_FACILITY_TYPES.CONFIRMED_PUBLIC_FACILITY
          : CANDIDATE_FACILITY_TYPES.OPEN_SPACE_ALTERNATIVE;

      const defaultLabel = isExplicitAssembly
        ? '옥외 집결지'
        : isPublicSchoolOrStadium
          ? '학교·운동장 개활지'
          : '개활 공원·광장';

      rawCandidates.push({
        id: isExplicitAssembly ? `OSM-AP-${el.id}` : `OSM-OPEN-${el.id}`,
        name: tags['name:ko'] || tags.name || defaultLabel,
        facilityType,
        isOfficialDesignated: false, // Never treat raw OSM tags as MOIS official without verified public shelter DB!
        isOsmAssemblyTagged: isExplicitAssembly,
        east_m: Number(cE.toFixed(2)),
        north_m: Number(cN.toFixed(2)),
        areaSqMeters: area,
        ptsEN
      });
    }

    // Check walkGraph component connectivity from originEN
    const { nodes, adj } = getOrCompileWalkAdjacency(walkGraph);
    let originComponent = null;
    if (nodes.length > 0 && adj.length > 0) {
      let bestStartIdx = -1;
      let bestD = Infinity;
      for (let i = 0; i < nodes.length; i++) {
        const d = Math.hypot(nodes[i][1] - originEN[0], nodes[i][2] - originEN[1]);
        if (d < bestD) { bestD = d; bestStartIdx = i; }
      }
      if (bestStartIdx >= 0 && bestD <= 220) {
        const visited = new Set([bestStartIdx]);
        const q = [bestStartIdx];
        while (q.length > 0) {
          const u = q.shift();
          for (const e of (adj[u] || [])) {
            if (!visited.has(e.to)) { visited.add(e.to); q.push(e.to); }
          }
        }
        originComponent = visited;
      }
    }

    const evaluated = [];
    for (const c of rawCandidates) {
      // Check building interior overlap
      const insideBldg = obbRawList.some(b => {
        const dx = c.east_m - b.east_m;
        const dn = c.north_m - b.north_m;
        const cos = Math.cos(-b.yaw_rad);
        const sin = Math.sin(-b.yaw_rad);
        return Math.abs(dx * cos - dn * sin) <= b.width_m * 0.5 + 1.5 && Math.abs(dx * sin + dn * cos) <= b.depth_m * 0.5 + 1.5;
      });
      if (insideBldg) continue;

      let clearanceMeters = 80;
      let tallestSurroundingH = 0;
      for (const b of obbRawList) {
        const distEdge = Math.max(0, Math.hypot(b.east_m - c.east_m, b.north_m - c.north_m) - Math.hypot(b.width_m, b.depth_m) * 0.45);
        if (distEdge < clearanceMeters) clearanceMeters = distEdge;
        if (distEdge < Math.max(12, (b.height_m || 8.5) * 0.65) && (b.height_m || 8.5) > tallestSurroundingH) {
          tallestSurroundingH = b.height_m || 8.5;
        }
      }

      // Check graph reachability from origin AND whether the site touches walkable road topology at all
      let nearestNodeIdx = -1;
      let snapDistMeters = Infinity;
      for (let i = 0; i < nodes.length; i++) {
        const d = Math.hypot(nodes[i][1] - c.east_m, nodes[i][2] - c.north_m);
        if (d < snapDistMeters) { snapDistMeters = d; nearestNodeIdx = i; }
      }
      const hasLocalRoadAccess = Boolean(nodes.length > 0 && nearestNodeIdx >= 0 && snapDistMeters <= 200);
      const graphConnected = Boolean(originComponent && nearestNodeIdx >= 0 && snapDistMeters <= 160 && originComponent.has(nearestNodeIdx));
      const linearDistMeters = Math.round(Math.hypot(c.east_m - originEN[0], c.north_m - originEN[1]));

      // Check proximity to river/waterway flooding/liquefaction caution
      const nearWater = waterways.some(w => (w.pointsEN || []).some(p => Math.hypot(p[0] - c.east_m, p[1] - c.north_m) < 45)) ||
        waterPolygons.some(wp => (wp.outer || wp).some(p => Math.hypot(p[0] - c.east_m, p[1] - c.north_m) < 45));

      const distPenalty = linearDistMeters * 0.03;
      const status = !hasLocalRoadAccess
        ? CANDIDATE_STATUS.UNAVAILABLE
        : (c.isOfficialDesignated ? CANDIDATE_STATUS.CONFIRMED : CANDIDATE_STATUS.CONDITIONAL);

      const y = sampleGridHeightAt(terrainGrid, c.east_m, c.north_m);
      const dimensions = Object.freeze({
        officialDesignation: c.isOfficialDesignated
          ? `OFFICIAL_DESIGNATED (${c.sourceName || '행정안전부 지진옥외대피장소'})`
          : 'UNCONFIRMED_IN_PUBLIC_SHELTER_API (공식 대피소 API 미연동)',
        facilityExists: true,
        openStatus: c.isOfficialDesignated
          ? 'UNVERIFIED_IN_DISASTER (공식 지정 확인 · 재난 당시 개방 현장 확인)'
          : 'UNKNOWN (개방 여부 현장 확인 필요)',
        distanceMeters: linearDistMeters,
        graphConnected,
        hasLocalRoadAccess,
        snapDistanceMeters: Number.isFinite(snapDistMeters) ? Math.round(snapDistMeters) : null,
        clearanceRadiusMeters: Math.round(clearanceMeters),
        tallestSurroundingHeightM: Math.round(tallestSurroundingH),
        waterProximityCaution: nearWater,
        seismicImpactStatus: impactStatus,
        confidenceLabel: c.isOfficialDesignated
          ? 'HIGH (행정안전부 공식 지정 DB · 개방 현장 확인)'
          : (c.isOsmAssemblyTagged ? 'MEDIUM (OSM 집결지 태그)' : 'LOW_TO_MEDIUM (개활지 추출)')
      });

      const selectionReason = c.isOfficialDesignated
        ? (graphConnected
            ? `${c.sourceName || '행정안전부 공식 지정'} 대피장소로 확인되었으며 보행망 연결이 가능합니다. 재난 당시 개방 상태는 현장 확인이 필요합니다.`
            : `${c.sourceName || '행정안전부 공식 지정'} 대피장소이나 출발 지점 기준 연결 여부를 확인 중입니다.`)
        : (hasLocalRoadAccess
            ? `보행망으로 연결 가능한 ${c.areaSqMeters ? `면적 약 ${c.areaSqMeters.toLocaleString()}㎡ ` : ''}개활 후보(이격 ${Math.round(clearanceMeters)}m${tallestSurroundingH > 0 ? ` · 인접 건물 최고 ${Math.round(tallestSurroundingH)}m` : ''})입니다. 단, 공식 대피소 지정 여부 및 개방 상태는 현장 확인이 필요한 조건부(CONDITIONAL) 후보입니다.`
            : '후보 공간은 존재하나 주변 보행 네트워크 접속 노드가 확인되지 않았습니다.');

      evaluated.push({
        id: c.id,
        name: c.name,
        facilityType: c.facilityType || (c.isOfficialDesignated ? 'OFFICIAL_SHELTER' : 'OPEN_SPACE'),
        category: evaluated.length === 0 ? 'PRIMARY_SHELTER' : 'REGIONAL_SHELTER',
        candidateStatus: status,
        subtitle: c.isOfficialDesignated
          ? `공식 대피소 · ${linearDistMeters}m`
          : `${c.isOsmAssemblyTagged ? 'OSM 집결지' : '개활 후보'} · ${linearDistMeters}m`,
        positionThree: [Number(c.east_m.toFixed(2)), Number(y.toFixed(2)), Number((-c.north_m).toFixed(2))],
        east_m: c.east_m,
        north_m: c.north_m,
        priority: Math.max(10, Math.round((graphConnected ? 65 : hasLocalRoadAccess ? 25 : 10) + (c.isOfficialDesignated ? 35 : 0) + (c.isOsmAssemblyTagged ? 20 : 0) + Math.min(20, clearanceMeters * 0.5) - distPenalty)),
        provenance: c.isOfficialDesignated ? VERIFICATION_STATUS.VERIFIED : VERIFICATION_STATUS.PROVISIONAL,
        provenanceLabel: c.isOfficialDesignated
          ? '행안부 공식 지정'
          : (c.isOsmAssemblyTagged ? 'OSM 집결지' : '개활 공터 후보'),
        dimensions,
        justification: {
          id: c.id,
          candidateStatus: status,
          areaSqMeters: c.areaSqMeters,
          capacityEstimate: c.capacityOverride ?? (c.areaSqMeters ? Math.round((c.areaSqMeters * 0.45) / 1.65) : null),
          clearanceRadiusMeters: Math.round(clearanceMeters),
          tallestSurroundingHeightM: Math.round(tallestSurroundingH),
          provenanceLabel: c.isOfficialDesignated
            ? '행안부 공식 지정'
            : (c.isOsmAssemblyTagged ? 'OSM 집결지 · 미지정' : '개활 공터 · 미지정'),
          selectionReason,
          hazardCaveat: nearWater
            ? '인접 하천 수계(45m 이내)가 탐지되어 여진·제방 위험을 우선 점검해야 합니다.'
            : '실시간 개방 상태 및 시설 안전 점검 여부를 현장에서 직접 확인하십시오.'
        }
      });
    }

    // Retain up to 24 distinct regional shelters across all banks/quadrants (>= 85m spacing)
    evaluated.sort((a, b) => b.priority - a.priority);
    const deduped = [];
    for (const c of evaluated) {
      if (!deduped.some(prev => Math.hypot(prev.east_m - c.east_m, prev.north_m - c.north_m) < 85)) {
        deduped.push(c);
      }
      if (deduped.length >= 24) break;
    }

    const confirmedCount = deduped.filter(c => c.candidateStatus === CANDIDATE_STATUS.CONFIRMED).length;
    const reachableCount = deduped.filter(c => c.candidateStatus !== CANDIDATE_STATUS.UNAVAILABLE).length;
    const overallStatus = confirmedCount > 0
      ? CANDIDATE_STATUS.CONFIRMED
      : (reachableCount > 0
        ? CANDIDATE_STATUS.CONDITIONAL
        : (walkGraph.nodes.length === 0 ? CANDIDATE_STATUS.UNKNOWN : CANDIDATE_STATUS.UNAVAILABLE));

    return {
      candidates: deduped,
      primaryCandidate: deduped.find(c => c.candidateStatus !== CANDIDATE_STATUS.UNAVAILABLE) || null,
      overallStatus,
      limitations: confirmedCount > 0
        ? '공식 지진옥외대피장소 지정 정보는 확인되었으나, 지진 발생 시 실제 개방 여부와 도로 통행 안전은 별개입니다.'
        : overallStatus === CANDIDATE_STATUS.UNKNOWN
          ? '주변 보행로 및 시설 공간 데이터가 부족하여 목적지를 판단할 수 없습니다.'
          : overallStatus === CANDIDATE_STATUS.UNAVAILABLE
            ? '확인 가능한 접근 가능 대피 후보가 없거나 보행 네트워크가 연결되지 않았습니다.'
            : '추출된 후보는 개방 상태 및 공식 지진대피소 지정 여부가 미확인된 조건부(CONDITIONAL) 대안입니다.'
    };
  }
}
