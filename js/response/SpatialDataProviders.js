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

// ----------------------------------------------------------------------------
// 1. LocationProvider
// ----------------------------------------------------------------------------
export class LocationProvider {
  constructor(initial = {}) {
    this.userCurrentLocation = initial.userCurrentLocation || null; // { lat, lon, accuracyMeters, source, timestamp }
    this.userSelectedLocation = initial.userSelectedLocation || {
      lat: initial.lat ?? 37.555815,
      lon: initial.lon ?? 127.045053,
      label: initial.label || '선택 지역'
    };
    this.provenance = createProvenanceRecord({
      source: initial.userCurrentLocation ? 'BROWSER_GEOLOCATION' : 'USER_MANUAL_SELECTION',
      sourceType: initial.userCurrentLocation ? DATA_ORIGIN_TYPES.OBSERVED : DATA_ORIGIN_TYPES.PROVISIONAL,
      geometryAccuracy: initial.userCurrentLocation?.accuracyMeters ? `±${Math.round(initial.userCurrentLocation.accuracyMeters)}m` : '수동 지정 좌표',
      completeness: 'COMPLETE',
      verificationStatus: initial.userCurrentLocation ? VERIFICATION_STATUS.PARTIALLY_VERIFIED : VERIFICATION_STATUS.PROVISIONAL,
      confidence: initial.userCurrentLocation ? 0.72 : 0.85,
      limitations: '실외 수평 좌표만 제공하며 건물 층수·실내 호실은 사용자가 직접 확인해야 합니다.'
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

  async detectBrowserLocation(timeoutMs = 5000) {
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
            timestamp: pos.timestamp || Date.now()
          };
          this.userSelectedLocation = {
            lat: this.userCurrentLocation.lat,
            lon: this.userCurrentLocation.lon,
            label: 'GPS 현재 위치'
          };
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

  setUserSelectedLocation(lat, lon, label = '선택 지역') {
    if (!Number.isFinite(Number(lat)) || !Number.isFinite(Number(lon))) return null;
    this.userSelectedLocation = {
      lat: Number(Number(lat).toFixed(6)),
      lon: Number(Number(lon).toFixed(6)),
      label: label || '선택 지역'
    };
    return this.userSelectedLocation;
  }

  getActiveAnalysisLocation() {
    return this.userSelectedLocation || this.userCurrentLocation || { lat: 37.555815, lon: 127.045053, label: '선택 위치' };
  }
}

// ----------------------------------------------------------------------------
// 2. HazardProvider (Observed vs Educational Synthetic vs Historical)
// ----------------------------------------------------------------------------
export class HazardProvider {
  /**
   * Normalize observed/synthetic/historical earthquake scenario independently of user city.
   */
  static createScenario(spec = {}) {
    const type = spec.scenarioType || SCENARIO_TYPES.EDUCATIONAL_SYNTHETIC;
    const isObs = type === SCENARIO_TYPES.OBSERVED_EVENT;
    const isHist = type === SCENARIO_TYPES.HISTORICAL_RECORD;
    const provenance = createProvenanceRecord({
      source: spec.source || (isObs ? 'KMA / USGS 계기 관측 기록' : isHist ? '한국 역사 지진 문헌 사료' : '교육용 사용자 인공지진 설정'),
      sourceType: isObs ? DATA_ORIGIN_TYPES.OBSERVED : isHist ? DATA_ORIGIN_TYPES.PROVISIONAL : DATA_ORIGIN_TYPES.SYNTHETIC,
      geometryAccuracy: isObs ? '계기 진앙 오차 수 km 이내' : isHist ? '사료 추정 타원(수십 km 불확실)' : '사용자 직접 지정 좌표',
      completeness: spec.magnitude != null && spec.depthKm != null ? 'COMPLETE' : 'PARTIAL',
      verificationStatus: isObs ? VERIFICATION_STATUS.VERIFIED : VERIFICATION_STATUS.PROVISIONAL,
      confidence: isObs ? 0.92 : isHist ? 0.35 : 1.0,
      limitations: isObs
        ? '단층 지반 증폭 및 건물 개별 응답은 현장 계측 없이 추론 불가합니다.'
        : isHist
          ? '과거 문헌 기반 추정치로 현대 건축물 대응 근거로 직접 사용할 수 없습니다.'
          : '교육 훈련용 인공 매개변수이며 실제 관측 지진이 아닙니다.'
    });

    return Object.freeze({
      id: spec.id || `${type}_${Date.now()}`,
      scenarioType: type,
      title: spec.title || (type === SCENARIO_TYPES.EDUCATIONAL_SYNTHETIC ? '교육용 인공지진 시나리오' : '지진 시나리오'),
      epicenterLat: spec.epicenterLat ?? null,
      epicenterLon: spec.epicenterLon ?? null,
      magnitude: typeof spec.magnitude === 'number' ? spec.magnitude : null,
      depthKm: typeof spec.depthKm === 'number' ? spec.depthKm : null,
      occurredAt: spec.occurredAt || (type === SCENARIO_TYPES.EDUCATIONAL_SYNTHETIC ? 'DRILL_NOW' : null),
      originText: spec.originText || '진원 위치 정보 확인 중',
      simulatedPga_g: spec.simulatedPga_g ?? null,
      provenance
    });
  }

  /**
   * Evaluate whether a target (user or analysis location) falls within seismic impact zone.
   * Never marks distant unrelated regions as affected evacuation emergencies.
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
        shouldRecommendLocalEvacuation: false,
        explanationKo: '지진 발생 좌표 또는 사용자 위치 정보가 부족하여 영향권 여부를 판단할 수 없습니다.',
        limitations: '좌표 정보 부재로 인한 판단 보류'
      };
    }

    const distanceKm = geodesicDistanceKm(userLat, userLon, hazard.epicenterLat, hazard.epicenterLon);
    const bearingDeg = geodesicBearingDeg(userLat, userLon, hazard.epicenterLat, hazard.epicenterLon);
    const depthKm = typeof hazard.depthKm === 'number' && hazard.depthKm >= 0 ? hazard.depthKm : null;
    const hypoKm = depthKm !== null ? Math.hypot(distanceKm, depthKm) : distanceKm;
    const pWaveEtaSec = Number((hypoKm / 6.0).toFixed(1));
    const sWaveEtaSec = Number((hypoKm / 3.5).toFixed(1));

    // Historical record warning: never treat ancient chronicle coordinates as present shaking
    if (hazard.scenarioType === SCENARIO_TYPES.HISTORICAL_RECORD) {
      return {
        impactStatus: IMPACT_ZONE_STATUS.HISTORICAL_REFERENCE_ONLY,
        distanceKm,
        bearingDeg,
        pWaveEtaSec,
        sWaveEtaSec,
        shouldRecommendLocalEvacuation: false,
        explanationKo: `과거 역사 문헌 사료(${hazard.title})와의 거리 ${distanceKm}km 참고 정보입니다. 실제 현재 지진 발생 상황이 아니며 사료 좌표 불확실성이 존재합니다.`,
        limitations: '역사 기록 추정 진앙이며 현 지반 진동(PGA) 실측이 아닙니다.'
      };
    }

    const mag = typeof hazard.magnitude === 'number' ? hazard.magnitude : 5.0;
    // Conservative physical screening radii (NOT a site-specific ground motion GMPE claim)
    // Near/strong-motion response radius (~27km at M4.8, ~65km at M5.8, ~186km at M7.0)
    const impactRadiusKm = Math.max(15, Math.min(220, Math.pow(10, 0.38 * mag - 0.39)));
    const feltRadiusKm = Math.max(impactRadiusKm * 2.4, Math.min(600, impactRadiusKm * 3.2));

    if (hazard.scenarioType === SCENARIO_TYPES.EDUCATIONAL_SYNTHETIC) {
      const withinDrill = distanceKm <= impactRadiusKm;
      return {
        impactStatus: withinDrill ? IMPACT_ZONE_STATUS.EDUCATIONAL_DRILL : IMPACT_ZONE_STATUS.OUTSIDE_IMPACT_ZONE,
        distanceKm,
        bearingDeg,
        pWaveEtaSec,
        sWaveEtaSec,
        impactRadiusKm: Math.round(impactRadiusKm),
        feltRadiusKm: Math.round(feltRadiusKm),
        shouldRecommendLocalEvacuation: withinDrill,
        explanationKo: withinDrill
          ? `교육용 인공지진(M${mag.toFixed(1)}, 깊이 ${depthKm ?? '미상'}km) 설정 영향권(${Math.round(impactRadiusKm)}km 이내, 거리 ${distanceKm}km) 내 대피 훈련 시나리오입니다.`
          : `설정한 교육용 인공지진 진앙(${distanceKm}km)은 현재 위치의 직하 영향권(참고 반경 약 ${Math.round(impactRadiusKm)}km) 밖입니다. 훈련 지역을 진앙 부근으로 옮기거나 진앙을 현재 지역으로 설정하십시오.`,
        limitations: '교육용 합성 시나리오이며 거리 기반 단순 반경 모델(MODELLED)입니다.'
      };
    }

    // Real Observed Event
    if (distanceKm <= impactRadiusKm) {
      return {
        impactStatus: IMPACT_ZONE_STATUS.IN_IMPACT_ZONE,
        distanceKm,
        bearingDeg,
        pWaveEtaSec,
        sWaveEtaSec,
        impactRadiusKm: Math.round(impactRadiusKm),
        feltRadiusKm: Math.round(feltRadiusKm),
        shouldRecommendLocalEvacuation: true,
        explanationKo: `실제 관측 지진(${hazard.title}, M${hazard.magnitude ?? '미상'})의 추정 주요 진동 영향 반경(약 ${Math.round(impactRadiusKm)}km) 내에 위치합니다(진앙 거리 ${distanceKm}km). 흔들림 및 주변 위험을 확인하십시오.`,
        limitations: '개별 건물의 내진성·지반 증폭은 관측소 실측 및 현장 확인 전까지 알 수 없습니다.'
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
        shouldRecommendLocalEvacuation: false,
        explanationKo: `실제 관측 지진(${hazard.title})으로부터 ${distanceKm}km 떨어져 있어 약한 진동만 감지될 수 있는 경계 구역입니다. 무작정 옥외 대피하기보다 실내 낙하물 점검 및 기상청 공식 특보를 우선 확인하십시오.`,
        limitations: '약한 감진 구역은 현장 체감·관측소 PGA 확인이 우선됩니다.'
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
      shouldRecommendLocalEvacuation: false,
      explanationKo: `실제 관측 지진(${hazard.title})은 현재 분석 위치에서 ${distanceKm}km 떨어져 있어(영향권 밖) 이 위치에 임의 대피 경로를 생성하지 않습니다. 피해 현장 대응을 확인하려면 진앙 인근 지역을 선택하십시오.`,
      limitations: '원거리 관측 사건 — 사용자 위치 직접 피해 가능성 낮음.'
    };
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
      // Preserve explicit visual hint ONLY if height/levels unavailable without falsely marking it measured
      const visualHeightMeters = hasKnownHeight ? rawH : hasKnownLevels ? Number((rawLvls * 3.3).toFixed(1)) : 8.5;

      const wingObbs = decomposePolygonToOBBs(clean, visualHeightMeters);
      const groundY = sampleGridHeightAt(terrainGrid, cE, cN);

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

      if (bName || namedBuildings.length < 60) {
        namedBuildings.push(bObj);
      }
    }

    obbRawList.sort((a, b) => b.height_m - a.height_m);
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
        tags.landuse === 'grass' || tags.landuse === 'recreation_ground' || tags.amenity === 'school';
      if (isGreen && ptsEN.length >= 3 && polygonArea2D(ptsEN) >= 220) {
        greenPolygons.push(ptsEN);
        const { nx, nz, halfExtentMeters: gh, greenMask } = terrainGrid;
        if (greenMask && gh > 0) {
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
      }
    }

    const walkGraph = { anchor: { lat: anchorLat, lon: anchorLon }, nodes, edges };

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
    halfExtentMeters = 2000
  }) {
    const osmNodes = new Map();
    for (const el of elements) {
      if (el.type === 'node' && Number.isFinite(el.lat) && Number.isFinite(el.lon)) {
        const [e, n] = projectLatLonToEN(el.lat, el.lon, anchorLat, anchorLon);
        osmNodes.set(el.id, { id: el.id, e: Number(e.toFixed(2)), n: Number(n.toFixed(2)), tags: el.tags || null });
      }
    }

    const rawCandidates = [];

    for (const el of elements) {
      const tags = el.tags || {};
      let cE = null, cN = null, area = null, ptsEN = null;

      if (el.type === 'node' && osmNodes.has(el.id)) {
        if (tags.emergency !== 'assembly_point' && tags.social_facility !== 'shelter' && tags.amenity !== 'shelter') continue;
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
        ? '지진 옥외집결지 표기 지점(OSM)'
        : isPublicSchoolOrStadium
          ? '학교·운동장 개활 공간(미지정 대안)'
          : '개활 공원·광장(공식 대피소 아님)';

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
      for (const b of obbRawList) {
        const cl = Math.max(0, Math.hypot(b.east_m - c.east_m, b.north_m - c.north_m) - Math.hypot(b.width_m, b.depth_m) * 0.45);
        if (cl < clearanceMeters) clearanceMeters = cl;
      }

      // Check graph reachability from origin
      let nearestNodeIdx = -1;
      let snapDistMeters = Infinity;
      for (let i = 0; i < nodes.length; i++) {
        const d = Math.hypot(nodes[i][1] - c.east_m, nodes[i][2] - c.north_m);
        if (d < snapDistMeters) { snapDistMeters = d; nearestNodeIdx = i; }
      }
      const graphConnected = Boolean(originComponent && nearestNodeIdx >= 0 && snapDistMeters <= 160 && originComponent.has(nearestNodeIdx));
      const linearDistMeters = Math.round(Math.hypot(c.east_m - originEN[0], c.north_m - originEN[1]));

      // Check proximity to river/waterway flooding/liquefaction caution
      const nearWater = waterways.some(w => (w.pointsEN || []).some(p => Math.hypot(p[0] - c.east_m, p[1] - c.north_m) < 45)) ||
        waterPolygons.some(wp => (wp.outer || wp).some(p => Math.hypot(p[0] - c.east_m, p[1] - c.north_m) < 45));

      const distPenalty = linearDistMeters * 0.03;
      const status = !graphConnected
        ? CANDIDATE_STATUS.UNAVAILABLE
        : CANDIDATE_STATUS.CONDITIONAL; // OSM-only data lacks live open confirmation -> strictly CONDITIONAL

      const y = sampleGridHeightAt(terrainGrid, c.east_m, c.north_m);
      const dimensions = Object.freeze({
        officialDesignation: 'UNCONFIRMED_IN_PUBLIC_SHELTER_API (공식 대피소 API 미연동)',
        facilityExists: true,
        openStatus: 'UNKNOWN (개방 여부 현장 확인 필요)',
        distanceMeters: linearDistMeters,
        graphConnected,
        snapDistanceMeters: Number.isFinite(snapDistMeters) ? Math.round(snapDistMeters) : null,
        clearanceRadiusMeters: Math.round(clearanceMeters),
        waterProximityCaution: nearWater,
        seismicImpactStatus: impactStatus,
        confidenceLabel: c.isOsmAssemblyTagged ? 'MEDIUM (OSM 집결지 태그)' : 'LOW_TO_MEDIUM (개활지 추출)'
      });

      const selectionReason = graphConnected
        ? `보행망으로 연결 가능한 ${c.areaSqMeters ? `면적 약 ${c.areaSqMeters.toLocaleString()}㎡ ` : ''}개활 후보(이격 ${Math.round(clearanceMeters)}m)입니다. 단, 공식 대피소 지정 여부 및 개방 상태는 현장 확인이 필요한 조건부(CONDITIONAL) 후보입니다.`
        : '후보 공간은 존재하나 출발 지점으로부터 연결된 보행 네트워크가 확인되지 않았습니다.';

      evaluated.push({
        id: c.id,
        name: c.name,
        facilityType: c.facilityType,
        category: evaluated.length === 0 ? 'PRIMARY_SHELTER' : 'REGIONAL_SHELTER',
        candidateStatus: status,
        subtitle: `${c.isOsmAssemblyTagged ? 'OSM 집결지(미검증)' : '개활 후보(공식아님)'} · ${linearDistMeters}m`,
        positionThree: [Number(c.east_m.toFixed(2)), Number(y.toFixed(2)), Number((-c.north_m).toFixed(2))],
        east_m: c.east_m,
        north_m: c.north_m,
        priority: Math.max(10, Math.round((graphConnected ? 65 : 15) + (c.isOsmAssemblyTagged ? 20 : 0) + Math.min(20, clearanceMeters * 0.5) - distPenalty)),
        provenance: VERIFICATION_STATUS.PROVISIONAL,
        provenanceLabel: c.isOsmAssemblyTagged ? 'OSM 집결지 태그 (공식 API 미확인)' : 'OSM 개활 공터 후보 (공식 대피소 아님)',
        dimensions,
        justification: {
          id: c.id,
          candidateStatus: status,
          areaSqMeters: c.areaSqMeters,
          capacityEstimate: c.areaSqMeters ? Math.round((c.areaSqMeters * 0.45) / 1.65) : null,
          clearanceRadiusMeters: Math.round(clearanceMeters),
          provenanceLabel: c.isOsmAssemblyTagged ? 'OSM 집결지 태그 · 개방 미확인' : '개활지·운동장 추출 (공식 대피소 지정 미확인)',
          selectionReason,
          hazardCaveat: nearWater
            ? '인접 하천 수계(45m 이내)가 탐지되어 여진·제방 위험을 우선 점검해야 합니다.'
            : '실시간 개방 상태 및 시설 안전 점검 여부를 현장에서 직접 확인하십시오.'
        }
      });
    }

    // Sort reachable candidates first, then official/assembly tags & clearance
    evaluated.sort((a, b) => b.priority - a.priority);
    const deduped = [];
    for (const c of evaluated) {
      if (!deduped.some(prev => Math.hypot(prev.east_m - c.east_m, prev.north_m - c.north_m) < 120)) {
        deduped.push(c);
      }
      if (deduped.length >= 6) break;
    }

    const reachableCount = deduped.filter(c => c.candidateStatus !== CANDIDATE_STATUS.UNAVAILABLE).length;
    const overallStatus = reachableCount > 0
      ? CANDIDATE_STATUS.CONDITIONAL
      : (walkGraph.nodes.length === 0 ? CANDIDATE_STATUS.UNKNOWN : CANDIDATE_STATUS.UNAVAILABLE);

    return {
      candidates: deduped,
      primaryCandidate: deduped.find(c => c.candidateStatus !== CANDIDATE_STATUS.UNAVAILABLE) || null,
      overallStatus,
      limitations: overallStatus === CANDIDATE_STATUS.UNKNOWN
        ? '주변 보행로 및 시설 공간 데이터가 부족하여 목적지를 판단할 수 없습니다.'
        : overallStatus === CANDIDATE_STATUS.UNAVAILABLE
          ? '확인 가능한 접근 가능 대피 후보가 없거나 보행 네트워크가 연결되지 않았습니다.'
          : '추출된 후보는 개방 상태 및 공식 지진대피소 지정 여부가 미확인된 조건부(CONDITIONAL) 대안입니다.'
    };
  }
}
