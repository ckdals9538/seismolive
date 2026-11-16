// ============================================================================
// SEISMOLIVE v4.0 — Seismic Epicenter Context & Path-Synchronized Safety Rules
// File: js/response/SeismicImpactContext.js
//
// Bridges macro earthquake event provenance (epicenter, bearing, distance,
// theoretical P/S arrival timing, local ground-motion provenance) with
// micro human evacuation checkpoints along the 3D path to shelter.
//
// Strict Scientific Integrity:
//   - Unknown depth/magnitude/MMI remain null ('미상' / '미확인') — never fabricated.
//   - Travel-time estimates clearly separated from measured site shaking (PGA).
// ============================================================================

import { INSTRUMENTAL_EVENTS } from '../data/instrumentalCatalogDB.js';
import { HISTORICAL_EVENTS } from '../data/historicalArchiveDB.js';
import { VERIFICATION_STATUS } from './ResponseDomainTypes.js';

export const DEFAULT_LOCAL_ANCHOR_COORDS = Object.freeze({
  lat: 37.555815,
  lon: 127.045053,
  name: '한양대학교 제1공학관 (성동구 행당동)'
});

const EARTH_RADIUS_KM = 6371.0;

/**
 * Compute geodesic distance (km) and clockwise azimuth bearing (deg from North)
 * from `fromCoords` (e.g. Hanyang Univ.) to `toCoords` (e.g. epicenter).
 */
export function computeGeodesicBearingAndDistanceKm(
  fromLat,
  fromLon,
  toLat,
  toLon
) {
  if (
    !Number.isFinite(fromLat) ||
    !Number.isFinite(fromLon) ||
    !Number.isFinite(toLat) ||
    !Number.isFinite(toLon)
  ) {
    return { distanceKm: null, bearingDeg: null, compassDirKo: '방향 미상' };
  }

  const phi1 = (fromLat * Math.PI) / 180;
  const phi2 = (toLat * Math.PI) / 180;
  const dPhi = ((toLat - fromLat) * Math.PI) / 180;
  const dLambda = ((toLon - fromLon) * Math.PI) / 180;

  const sinDPhi = Math.sin(dPhi * 0.5);
  const sinDLam = Math.sin(dLambda * 0.5);
  const a = sinDPhi * sinDPhi + Math.cos(phi1) * Math.cos(phi2) * sinDLam * sinDLam;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(Math.max(0, 1 - a)));
  const distanceKm = Number((EARTH_RADIUS_KM * c).toFixed(1));

  const y = Math.sin(dLambda) * Math.cos(phi2);
  const x =
    Math.cos(phi1) * Math.sin(phi2) -
    Math.sin(phi1) * Math.cos(phi2) * Math.cos(dLambda);
  const rawBearing = ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
  const bearingDeg = Number(rawBearing.toFixed(1));

  const dirs = ['북', '북동', '동', '남동', '남', '남서', '서', '북서'];
  const compassDirKo = dirs[Math.round(bearingDeg / 45) % 8];

  return { distanceKm, bearingDeg, compassDirKo };
}

function unwrapVal(field) {
  if (field && typeof field === 'object' && 'v' in field) return field.v;
  return field ?? null;
}

function extractEventRecordFields(ev) {
  if (!ev) return null;
  const coords = ev.spatial?.inferredCoordinates;
  const lat = Number.isFinite(unwrapVal(ev.lat)) ? unwrapVal(ev.lat) : (coords?.lat ?? null);
  const lon = Number.isFinite(unwrapVal(ev.lon)) ? unwrapVal(ev.lon) : (coords?.lon ?? null);
  const mag = Number.isFinite(unwrapVal(ev.mag)) ? unwrapVal(ev.mag) : null;
  const depthRaw = unwrapVal(ev.depth);
  const depthKm = Number.isFinite(depthRaw) ? depthRaw : (ev.spatial?.focalDepth?.valKm ?? null);
  const titleKo = ev.titleKo || ev.place || ev.spatial?.placeName || ev.id || '지진 기록';
  const placeName = ev.spatial?.placeName || ev.place || '위치 정보 확인 중';
  const isSimulated = Boolean(ev.isSimulatedScenario);
  const isHistorical = ev.recordType === 'historical' || ev.century < 20;

  return {
    eventId: ev.eventId || ev.id || 'unknown_event',
    titleKo,
    placeName,
    lat,
    lon,
    mag,
    magType: ev.magType || (mag !== null ? 'M' : null),
    depthKm,
    dateText: ev.dateText || ev.temporal?.gregorianDate || '시각 정보 없음',
    verification: ev.verification || (isSimulated ? VERIFICATION_STATUS.PROVISIONAL : 'catalog-verified'),
    sourceName: ev.sourceName || (isHistorical ? '한국 역사 지진 사료' : '계측 지진 카탈로그'),
    isSimulated,
    isHistorical
  };
}

/**
 * Resolve active earthquake context by ID (searching instrumental catalog,
 * historical catalog, and optional USGS GeoJSON feature array) and project its
 * geodesic relation to the local shelter site.
 */
export function resolveActiveSeismicEvent(eventId = null, options = {}) {
  const anchor = options.anchor || DEFAULT_LOCAL_ANCHOR_COORDS;
  const defaultFallbackId = 'hist_2016_gyeongju';
  const requestedId = eventId || defaultFallbackId;

  let rawEvent =
    INSTRUMENTAL_EVENTS.find(e => e.eventId === requestedId || e.id === requestedId) ||
    HISTORICAL_EVENTS.find(e => e.eventId === requestedId || e.id === requestedId) ||
    null;

  if (!rawEvent && Array.isArray(options.usgsFeatures)) {
    const feat = options.usgsFeatures.find(f => f.id === requestedId);
    if (feat) {
      const coords = feat.geometry?.coordinates || [];
      const p = feat.properties || {};
      rawEvent = {
        eventId: feat.id,
        titleKo: p.place ? `${p.place} 지진` : (p.title || feat.id),
        spatial: {
          placeName: p.place || p.title || 'USGS 글로벌 관측 진앙',
          inferredCoordinates: { lat: coords[1], lon: coords[0] },
          focalDepth: { valKm: Number.isFinite(coords[2]) ? coords[2] : null }
        },
        mag: Number.isFinite(p.mag) ? p.mag : null,
        magType: p.magType || 'Mw',
        dateText: p.time ? new Date(p.time).toISOString().replace('T', ' ').slice(0, 16) + ' UTC' : '최근 USGS 관측',
        verification: 'usgs-official',
        sourceName: '미국지질조사국(USGS) 글로벌 관측망'
      };
    }
  }

  if (!rawEvent) {
    rawEvent =
      INSTRUMENTAL_EVENTS.find(e => e.eventId === defaultFallbackId) ||
      INSTRUMENTAL_EVENTS[0];
  }

  const fields = extractEventRecordFields(rawEvent);
  const geo = computeGeodesicBearingAndDistanceKm(
    anchor.lat,
    anchor.lon,
    fields.lat,
    fields.lon
  );

  // Homogeneous half-space first-order travel-time reference (Vp=6.0 km/s, Vs=3.5 km/s)
  let pWaveEtaSec = null;
  let sWaveEtaSec = null;
  let spLagSec = null;
  if (geo.distanceKm !== null) {
    const focalDepth = Number.isFinite(fields.depthKm) ? fields.depthKm : 10.0;
    const hypocentralKm = Math.hypot(geo.distanceKm, focalDepth);
    pWaveEtaSec = Number((hypocentralKm / 6.0).toFixed(1));
    sWaveEtaSec = Number((hypocentralKm / 3.5).toFixed(1));
    spLagSec = Number((sWaveEtaSec - pWaveEtaSec).toFixed(1));
  }

  const isDefaultReference = !eventId || eventId === defaultFallbackId;
  const magSummary = fields.mag !== null
    ? `${fields.magType || 'M'} ${fields.mag.toFixed(1)}`
    : '규모 미상(사료 기록)';

  const impactSummaryKo = geo.distanceKm !== null
    ? `${anchor.name} 기준 ${geo.compassDirKo}쪽(${geo.bearingDeg}°) ${geo.distanceKm} km · 이론상 P파 ${pWaveEtaSec}s / S파 ${sWaveEtaSec}s 도달 권역`
    : '진앙 거리 미확정 · 현장 계측 및 공식 안내 확인 필요';

  return Object.freeze({
    ...fields,
    isReferenceDefault: isDefaultReference,
    magSummary,
    distanceKm: geo.distanceKm,
    bearingDeg: geo.bearingDeg,
    compassDirKo: geo.compassDirKo,
    pWaveEtaSec,
    sWaveEtaSec,
    spLagSec,
    provenanceBadge: fields.isHistorical
      ? '역사 사료 참조 사건 (현장 실측 아님)'
      : isDefaultReference
        ? '대피 기준 시나리오 (2016 경주 실측 기반)'
        : `${fields.sourceName} 연동`,
    impactSummaryKo
  });
}

/**
 * Construct the 5 contextual safety rule checkpoints mapped cleanly along
 * the active evacuation path normalized progress t in [0, 1].
 */
export function buildEvacuationSafetyCheckpoints(ctx = {}) {
  const facilityName = ctx.facilityName || '제1공학관(212동)';
  const floor = ctx.floor ?? 3;
  const room = ctx.room || '301호';
  const shelterName = ctx.shelterName || '한양대 대운동장';
  const shortestMeters = ctx.shortestMeters ?? 737.9;
  const stepFreeMeters = ctx.stepFreeMeters ?? 855.1;
  const isStepFree = Boolean(ctx.isStepFree);
  const hasObstacles = Boolean(ctx.hasObstacles);

  const outdoorDistStr = isStepFree ? `${stepFreeMeters}m` : `${shortestMeters}m`;

  return Object.freeze([
    Object.freeze({
      id: 'CP_01_INDOOR_HOLD',
      stepNo: '01',
      title: `${facilityName} ${floor}층 ${room} · 진동 멈춤 확인 후 출발`,
      shortLabel: '실내 출발',
      tAnchor: 0.05,
      range: [0.0, 0.16],
      instruction: '흔들림 중엔 책상 아래서 머리를 보호하세요. 진동이 완전히 멈춘 뒤 출입문을 열어 탈출로를 확보하고 이동을 시작합니다.',
      caution: '승강기(엘리베이터)는 정전·갇힘 위험이 있으므로 절대 이용하지 마십시오.',
      isAlert: true
    }),
    Object.freeze({
      id: 'CP_02_STAIR_EXIT',
      stepNo: '02',
      title: isStepFree ? '1층 경사로 및 비상출구 통과' : '비상계단 하강 및 1층 남동측 출구',
      shortLabel: '계단 · 출구',
      tAnchor: 0.24,
      range: [0.16, 0.36],
      instruction: isStepFree
        ? '단차가 없는 완경사 연결로를 따라 낙하물에 주의하며 1층 출구 외부로 진입하세요.'
        : '계단 균열과 천장 마감재 탈락을 살피며 난간을 잡고 질서 있게 1층 남동측 출구로 내려오세요.',
      caution: '출구 직전 로비 유리창과 상부 간판·외장재 낙하에 유의하십시오.',
      isAlert: true
    }),
    Object.freeze({
      id: 'CP_03_FACADE_CLEARANCE',
      stepNo: '03',
      title: '건물 외벽 낙하물 위험 반경 이탈',
      shortLabel: '외벽 이탈',
      tAnchor: 0.48,
      range: [0.36, 0.60],
      instruction: '건물 외벽 유리와 벽돌 추락 위험 반경(건물 높이 이상 이격 권장)에서 즉시 벗어나 넓은 보행로 중앙으로 이동하세요.',
      caution: hasObstacles
        ? '동측 계단/외벽 주의 구간 폐쇄가 감지되어 안전한 우회 동선으로 안내 중입니다.'
        : '옥외 첫 계단 구간(68.5m)은 여진 시 발을 헛디딜 수 있으므로 보폭을 줄이십시오.',
      isAlert: hasObstacles
    }),
    Object.freeze({
      id: 'CP_04_CORRIDOR_TRANSIT',
      stepNo: '04',
      title: isStepFree
        ? `캠퍼스 무단차 안전 우회로 (${outdoorDistStr})`
        : `캠퍼스 최단 대피 경로 보행 (${outdoorDistStr})`,
      shortLabel: isStepFree ? '무단차 우회' : '캠퍼스 보행',
      tAnchor: 0.74,
      range: [0.60, 0.86],
      instruction: isStepFree
        ? '계단과 낙하 위험 구간을 우회하는 완경사 도로를 따라 남동쪽 대운동장 방향으로 이동 중입니다.'
        : '전신주·옹벽·가로등에서 거리를 두고 도로 중앙 시야가 트인 경로로 이동하십시오.',
      caution: '이동 중 여진이 다시 시작되면 그 자리에서 자세를 낮춰 두부를 보호하세요.',
      isAlert: false
    }),
    Object.freeze({
      id: 'CP_05_SHELTER_ARRIVAL',
      stepNo: '05',
      title: `${shelterName} (최종 옥외대피소) 도착 · 집결`,
      shortLabel: '대피소 안착',
      tAnchor: 0.96,
      range: [0.86, 1.01],
      instruction: `낙하물 위험이 없는 ${shelterName} 중앙 개활지에 안착했습니다. 재난문자 및 현장 안내요원의 지시를 확인하십시오.`,
      caution: '안전 점검이 완료되기 전까지 건물 내부로 임의 재진입하지 마십시오.',
      isAlert: false
    })
  ]);
}

/**
 * Given normalized progress t in [0, 1], resolve active safety checkpoint,
 * walked distance, remaining distance, and estimated walking time (at 1.25 m/s).
 */
export function evaluatePathProgressState(checkpoints, normalizedT = 0.0, totalMeters = 737.9) {
  const clampedT = Math.max(0, Math.min(1, Number.isFinite(normalizedT) ? normalizedT : 0));
  const traversedMeters = Number((clampedT * totalMeters).toFixed(1));
  const remainingMeters = Number(Math.max(0, totalMeters - traversedMeters).toFixed(1));
  // Average calm emergency walking pace ~ 1.2 m/s (72 m/min)
  const remainingMinutes = Math.max(1, Math.ceil(remainingMeters / 72.0));

  let active = checkpoints[0];
  for (const cp of checkpoints) {
    if (clampedT >= cp.range[0] && clampedT < cp.range[1]) {
      active = cp;
      break;
    }
  }
  if (clampedT >= 0.999 && checkpoints.length > 0) {
    active = checkpoints[checkpoints.length - 1];
  }

  return {
    normalizedT: clampedT,
    traversedMeters,
    remainingMeters,
    totalMeters: Number(totalMeters.toFixed(1)),
    remainingMinutes,
    activeCheckpoint: active
  };
}
