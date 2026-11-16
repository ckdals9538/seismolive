// ============================================================================
// SEISMOLIVE v4.0 — Nationwide South Korea Dynamic 3D Spatial & Shelter Engine
// File: js/response/NationwideKoreaSpatialEngine.js
//
// Expands 3D terrain + concave-wing OSM buildings + pedestrian graph +
// justified outdoor earthquake shelters from Seongdong/Hanyang to ANY point
// in South Korea:
//   - DEM Terrain: AWS Mapzen Terrarium tiles (Access-Control-Allow-Origin: *)
//   - Urban Massing & Walkable Graph: OSM 0.6/map.json (CORS forPages/localhost)
//   - Korean Place Search: Nominatim countrycodes=kr (Access-Control-Allow-Origin: *)
//   - Deterministic Offline Fallbacks for key Korean seismic benchmarks
// ============================================================================

import {
  VERIFICATION_STATUS,
  DATA_ORIGIN_TYPES,
  SCENARIO_TYPES,
  IMPACT_ZONE_STATUS,
  CANDIDATE_STATUS,
  INDOOR_SPATIAL_SCOPE,
  createProvenanceRecord
} from './ResponseDomainTypes.js';
import {
  HANYANG_LOCAL_4KM_PACKAGE,
  HANYANG_LOCAL_SPATIAL_METADATA,
  sampleTerrainHeight as sampleHanyangTerrainHeight
} from './HanyangLocalSpatialData.js';
import { HANYANG_CAMPUS_WALK_GRAPH } from './HanyangCampusWalkData.js';
import {
  polygonArea2D,
  buildDynamicFacilityFromPoint,
  doesSegmentIntersectOBBXZ
} from './CampusWalkRouter.js';
import { sampleGridHeightAt } from './LocalSpatialMapLayer.js';
import {
  HazardProvider,
  AutoScenarioResolver,
  IndoorSpatialProvider,
  BuildingProvider,
  RoadNetworkProvider,
  FacilityProvider,
  geodesicDistanceKm,
  geodesicBearingDeg
} from './SpatialDataProviders.js';
import { liveSeismicDataService } from '../data/LiveSeismicDataService.js';

export const HANYANG_SHELTER_JUSTIFICATION = Object.freeze({
  'OA-21060': Object.freeze({
    id: 'OA-21060',
    areaSqMeters: 16200,
    capacityEstimate: 7425,
    clearanceRadiusMeters: 26,
    elevationContrastMeters: '+4.8m (중랑천 범람고 대비 양호)',
    provenanceLabel: '행정안전부 지진옥외대피장소 공식 지정 (OA-21060)',
    selectionReason:
      '캠퍼스 중심부에서 외곽 도로로 즉시 이어지는 개활 운동장으로, 인접 고층 건물 낙하물 반경(H/2 ≈ 14m) 바깥에 폭 70m 이상의 무장애 집결 공터가 확보되어 최우선 대피지로 선정되었습니다.',
    hazardCaveat: '공식 지정 옥외대피장소이나, 현장의 동측 진입 계단 및 야간 조명 상태는 PROVISIONAL(미검증)으로 표기합니다.'
  }),
  'OA-21061': Object.freeze({
    id: 'OA-21061',
    areaSqMeters: 28500,
    capacityEstimate: 11200,
    clearanceRadiusMeters: 35,
    elevationContrastMeters: '-2.2m (하천 인접 저지대 주의)',
    provenanceLabel: '성동구 광역 지진옥외대피장소 (OA-21061)',
    selectionReason:
      '건축물 붕괴 낙하 위험이 전혀 없는 대규모 개활 체육공원입니다. 단, 중랑천 충적 지반에 위치하므로 지반 증폭 및 제방 붕괴 여부를 살피며 고지대 이동 준비가 필요합니다.',
    hazardCaveat: '충적 저지대 지반 특성상 여진 지속 시 고지대 대피소(한양대 대운동장 등) 이동 권장.'
  }),
  'OA-21062': Object.freeze({
    id: 'OA-21062',
    areaSqMeters: 45000,
    capacityEstimate: 18500,
    clearanceRadiusMeters: 42,
    elevationContrastMeters: '-3.0m (성수 권역 광역 공터)',
    provenanceLabel: '서울숲 광역 지진옥외집결지 (OA-21062)',
    selectionReason:
      '초고층 건물군과 유리 외벽으로부터 40m 이상 완전히 이격된 넓은 잔디·광장 영역으로, 다수의 시민이 동시에 머무를 수 있는 안전 공간입니다.',
    hazardCaveat: '성수동 고밀도 블록 통과 시 간판·외장재 낙하물 구역 우회 필요.'
  })
});

export const POST_ARRIVAL_SAFETY_PROTOCOLS = Object.freeze([
  Object.freeze({
    id: 'AFTERSHOCK_SETBACK',
    stepNumber: '01',
    title: '구조물 낙하 이격 거리 확보',
    summary: '대피소 중앙부 개활 공간으로 이동하여 주변 건물 외벽·전신주·가로등으로부터 건물 높이 1/2 이상 떨어져 대기하십시오.',
    actionLabel: '중앙 안전 반경 표시',
    motionMode: 'SETBACK_RING'
  }),
  Object.freeze({
    id: 'SITUATION_MONITORING',
    stepNumber: '02',
    title: '공식 재난방송 · 여진 정보 수신',
    summary: '기상청(KMA) 여진 속보 및 행정안전부 긴급재난문자를 확인하고, 통화 폭주를 피해 SMS·메신저로 짧은 안부만 전하십시오.',
    actionLabel: '주변 위험·지진원 방향 확인',
    motionMode: 'EPICENTER_SCAN'
  }),
  Object.freeze({
    id: 'NO_EARLY_REENTRY',
    stepNumber: '03',
    title: '안전 점검 완료 전 건물 재진입 금지',
    summary: '진동이 멎어도 여진으로 손상된 건물·유리·가스 배관이 재붕괴할 수 있습니다. 소방·안전 당국의 출입 허용 전까지 실내로 돌아가지 마십시오.',
    actionLabel: '안전 구역 점검 완료',
    motionMode: 'SHELTER_STABILIZE'
  })
]);

export const KOREA_BENCHMARK_REGIONS = Object.freeze([
  Object.freeze({
    id: 'seoul_hanyang',
    name: '서울 성동 · 한양대학교',
    shortName: '서울 한양대',
    subtitle: '실측 OSM 건물·보행망 + 제1공학관(212동) 3F 파일럿 실내망 검증 기준 권역',
    lat: 37.555815,
    lon: 127.045053,
    isHanyangDefault: true,
    scenarioEvent: Object.freeze({
      id: 'SYNTH-SEOUL-DRILL',
      scenarioType: SCENARIO_TYPES.EDUCATIONAL_SYNTHETIC,
      title: '서울 성동 인근 가상 근거리 단층 대피 훈련 (교육용 합성)',
      epicenterLat: 37.585,
      epicenterLon: 127.095,
      magnitude: 5.2,
      depthKm: 10,
      originText: '서울 성동·광진 북동측 약 5.4km 인근 (교육용 합성 단층)',
      magnitudeText: 'M5.2 (교육용 가상 설정)',
      depthText: '진원 깊이 10km (가상)',
      source: 'SEISMOLIVE_EDUCATIONAL_SYNTHETIC'
    })
  }),
  Object.freeze({
    id: 'sokcho',
    name: '강원 속초 · 청초·교동 연안 도심',
    shortName: '속초 도심',
    subtitle: '동해안 연안·청초호 수계 인접 도심 지진·대피 분석 권역 (범용 OSM)',
    lat: 38.2070,
    lon: 128.5918,
    isHanyangDefault: false,
    scenarioEvent: Object.freeze({
      id: 'SYNTH-SOKCHO-DRILL',
      scenarioType: SCENARIO_TYPES.EDUCATIONAL_SYNTHETIC,
      title: '속초 동북동 해역 가상 지진 대응 시나리오 (교육용 합성)',
      epicenterLat: 38.245,
      epicenterLon: 128.695,
      magnitude: 5.4,
      depthKm: 12,
      originText: '강원 속초시 동북동 해역 약 10km (교육용 합성)',
      magnitudeText: 'M5.4 (교육용 가상 설정)',
      depthText: '진원 깊이 12km (가상)',
      source: 'SEISMOLIVE_EDUCATIONAL_SYNTHETIC'
    })
  }),
  Object.freeze({
    id: 'gyeongju',
    name: '경북 경주 · 황남·월성 지구',
    shortName: '경주 도심',
    subtitle: '2016.09.12 경주 지진(M5.8) 인접 구도심·형산강 수계 대피 분석 권역',
    lat: 35.8347,
    lon: 129.2190,
    isHanyangDefault: false,
    scenarioEvent: Object.freeze({
      id: 'KMA-2016-GYEONGJU',
      scenarioType: SCENARIO_TYPES.OBSERVED_EVENT,
      title: '2016 경주 M5.8 내남면 관측 지진 · 구도심 대응',
      epicenterLat: 35.760,
      epicenterLon: 129.190,
      magnitude: 5.8,
      depthKm: 15,
      occurredAt: '2016-09-12T11:32:54Z',
      originText: '경북 경주시 남남서쪽 약 8.7km (2016.09.12 기상청 관측)',
      magnitudeText: 'M5.8 (기상청 계기 관측)',
      depthText: '진원 깊이 약 15km',
      source: 'KMA_OBSERVED_ARCHIVE'
    })
  }),
  Object.freeze({
    id: 'pohang',
    name: '경북 포항 · 흥해·중앙 지구',
    shortName: '포항 흥해권',
    subtitle: '2017.11.15 포항 지진(M5.4) 천부 단층 도심 대응 분석 권역',
    lat: 36.1086,
    lon: 129.3490,
    isHanyangDefault: false,
    scenarioEvent: Object.freeze({
      id: 'KMA-2017-POHANG',
      scenarioType: SCENARIO_TYPES.OBSERVED_EVENT,
      title: '2017 포항 M5.4 흥해 천부 단층 관측 지진',
      epicenterLat: 36.109,
      epicenterLon: 129.366,
      magnitude: 5.4,
      depthKm: 7,
      occurredAt: '2017-11-15T05:29:31Z',
      originText: '경북 포항시 북구 북쪽 9km (2017.11.15 기상청 관측)',
      magnitudeText: 'M5.4 (기상청 계기 관측)',
      depthText: '진원 깊이 약 7km',
      source: 'KMA_OBSERVED_ARCHIVE'
    })
  }),
  Object.freeze({
    id: 'yangyang',
    name: '강원 양양 · 낙산·읍내 지구',
    shortName: '양양 역사권',
    subtitle: '1681년 조선 숙종 7년 역사 문헌 사료 진원 추정 연안 권역',
    lat: 38.0754,
    lon: 128.6189,
    isHanyangDefault: false,
    scenarioEvent: Object.freeze({
      id: 'HIST-1681-YANGYANG',
      scenarioType: SCENARIO_TYPES.HISTORICAL_RECORD,
      title: '1681 양양·강릉 역사지진 사료 기록 (승정원일기·조선왕조실록)',
      epicenterLat: 38.05,
      epicenterLon: 128.65,
      magnitude: null,
      depthKm: null,
      occurredAt: '1681-06-26',
      originText: '강원도 양양·강릉 해역 추정 (1681.06.26 사료 기록)',
      magnitudeText: '규모 미상 (역사 문헌 사료)',
      depthText: '진원 깊이 미상',
      source: 'CHOSUN_ANNALS_HISTORICAL'
    })
  }),
  Object.freeze({
    id: 'buan',
    name: '전북 부안 · 부안읍 지구',
    shortName: '부안 내륙권',
    subtitle: '2024.06.12 부안 지진(M4.8) 호남 내륙 소도시 대피 분석 권역',
    lat: 35.7285,
    lon: 126.7318,
    isHanyangDefault: false,
    scenarioEvent: Object.freeze({
      id: 'KMA-2024-BUAN',
      scenarioType: SCENARIO_TYPES.OBSERVED_EVENT,
      title: '2024 부안 M4.8 내륙 관측 지진',
      epicenterLat: 35.700,
      epicenterLon: 126.710,
      magnitude: 4.8,
      depthKm: 8,
      occurredAt: '2024-06-11T23:26:49Z',
      originText: '전북 부안군 남남서쪽 4km (2024.06.12 기상청 관측)',
      magnitudeText: 'M4.8 (기상청 계기 관측)',
      depthText: '진원 깊이 약 8km',
      source: 'KMA_OBSERVED_ARCHIVE'
    })
  }),
  Object.freeze({
    id: 'busan_haeundae',
    name: '부산 해운대 · 좌동 지구',
    shortName: '부산 해운대',
    subtitle: '동남권 고밀도 해안 도심 지진·연안 대피 분석 권역',
    lat: 35.1695,
    lon: 129.1725,
    isHanyangDefault: false,
    scenarioEvent: Object.freeze({
      id: 'SYNTH-BUSAN-SE',
      scenarioType: SCENARIO_TYPES.EDUCATIONAL_SYNTHETIC,
      title: '울산·동남권 해역 가상 지진 대응 시나리오 (교육용 합성)',
      epicenterLat: 35.42,
      epicenterLon: 129.55,
      magnitude: 5.9,
      depthKm: 12,
      originText: '동남권 해역 단층대 가상 지진 (교육용 합성)',
      magnitudeText: 'M5.9 (교육용 가상 설정)',
      depthText: '진원 깊이 12km (가상)',
      source: 'SEISMOLIVE_EDUCATIONAL_SYNTHETIC'
    })
  })
]);

/**
 * Independent Earthquake Scenarios selectable against ANY user/analysis location.
 * Strictly demarcates OBSERVED_EVENT, EDUCATIONAL_SYNTHETIC, and HISTORICAL_RECORD.
 */
export const PRESET_EARTHQUAKE_SCENARIOS = Object.freeze([
  Object.freeze({
    id: 'SYNTH-LOCAL-M52',
    scenarioType: SCENARIO_TYPES.EDUCATIONAL_SYNTHETIC,
    title: '분석 지점 근거리 가상 단층 시나리오 (교육용)',
    useLocalOffset: true,
    offsetLatDeg: 0.032,
    offsetLonDeg: 0.045,
    magnitude: 5.2,
    depthKm: 10
  }),
  Object.freeze({
    id: 'KMA-2016-GYEONGJU',
    scenarioType: SCENARIO_TYPES.OBSERVED_EVENT,
    title: '2016.09.12 경주 M5.8 (실제 기상청 관측)',
    epicenterLat: 35.760,
    epicenterLon: 129.190,
    magnitude: 5.8,
    depthKm: 15,
    occurredAt: '2016-09-12T11:32:54Z',
    originText: '경북 경주시 남남서쪽 8.7km (KMA 계기 기록)'
  }),
  Object.freeze({
    id: 'KMA-2017-POHANG',
    scenarioType: SCENARIO_TYPES.OBSERVED_EVENT,
    title: '2017.11.15 포항 M5.4 (실제 기상청 관측)',
    epicenterLat: 36.109,
    epicenterLon: 129.366,
    magnitude: 5.4,
    depthKm: 7,
    occurredAt: '2017-11-15T05:29:31Z',
    originText: '경북 포항시 북구 북쪽 9km (KMA 계기 기록)'
  }),
  Object.freeze({
    id: 'KMA-2024-BUAN',
    scenarioType: SCENARIO_TYPES.OBSERVED_EVENT,
    title: '2024.06.12 부안 M4.8 (실제 기상청 관측)',
    epicenterLat: 35.700,
    epicenterLon: 126.710,
    magnitude: 4.8,
    depthKm: 8,
    occurredAt: '2024-06-11T23:26:49Z',
    originText: '전북 부안군 남남서쪽 4km (KMA 계기 기록)'
  }),
  Object.freeze({
    id: 'HIST-1681-YANGYANG',
    scenarioType: SCENARIO_TYPES.HISTORICAL_RECORD,
    title: '1681 양양·강릉 역사지진 사료 (승정원일기)',
    epicenterLat: 38.05,
    epicenterLon: 128.65,
    magnitude: null,
    depthKm: null,
    occurredAt: '1681-06-26',
    originText: '강원도 양양·강릉 해역 추정 (역사 사료 · 규모 미상)'
  })
]);

const WGS84_A = 6378137.0;
const WGS84_E2 = 0.00669437999014;
const EARTH_DEG_TO_RAD = Math.PI / 180;

export function latLonToLocalENU(lat, lon, anchorLat, anchorLon) {
  const lat0Rad = anchorLat * EARTH_DEG_TO_RAD;
  const sinLat = Math.sin(lat0Rad);
  const cosLat = Math.cos(lat0Rad);
  const denom = Math.sqrt(1 - WGS84_E2 * sinLat * sinLat);
  const rn = WGS84_A / denom;
  const rm = (WGS84_A * (1 - WGS84_E2)) / Math.pow(denom, 3);
  const east_m = (lon - anchorLon) * EARTH_DEG_TO_RAD * rn * cosLat;
  const north_m = (lat - anchorLat) * EARTH_DEG_TO_RAD * rm;
  return [east_m, north_m];
}

export function localENUToLatLon(east_m, north_m, anchorLat, anchorLon) {
  const lat0Rad = anchorLat * EARTH_DEG_TO_RAD;
  const sinLat = Math.sin(lat0Rad);
  const cosLat = Math.cos(lat0Rad);
  const denom = Math.sqrt(1 - WGS84_E2 * sinLat * sinLat);
  const rn = WGS84_A / denom;
  const rm = (WGS84_A * (1 - WGS84_E2)) / Math.pow(denom, 3);
  const lat = anchorLat + (north_m / rm) * (180 / Math.PI);
  const lon = anchorLon + (east_m / (rn * cosLat)) * (180 / Math.PI);
  return { lat, lon };
}

export function distanceMetersLatLon(lat1, lon1, lat2, lon2) {
  const [e, n] = latLonToLocalENU(lat1, lon1, lat2, lon2);
  return Math.hypot(e, n);
}

/**
 * Search South Korean locations via Nominatim (falling back to curated benchmarks).
 */
export async function geocodeKoreaQuery(query) {
  const clean = (query || '').trim();
  if (!clean) return [];

  const lower = clean.toLowerCase();
  const localMatches = KOREA_BENCHMARK_REGIONS.filter(r =>
    r.name.toLowerCase().includes(lower) ||
    r.shortName.toLowerCase().includes(lower) ||
    r.id.toLowerCase().includes(lower)
  ).map(r => ({
    id: r.id,
    displayName: r.name,
    shortName: r.shortName,
    lat: r.lat,
    lon: r.lon,
    source: 'BENCHMARK'
  }));

  if (typeof fetch !== 'function') return localMatches;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3200);
    const url =
      `https://nominatim.openstreetmap.org/search?countrycodes=kr&format=json&limit=5&accept-language=ko&q=${encodeURIComponent(clean)}`;
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) return localMatches;
    const rows = await res.json();
    if (!Array.isArray(rows)) return localMatches;
    const remoteMatches = rows.map((row, i) => ({
      id: `nominatim_${i}_${Math.round(Number(row.lat) * 1e4)}`,
      displayName: row.display_name || clean,
      shortName: (row.name || row.display_name || clean).split(',')[0].trim(),
      lat: Number(row.lat),
      lon: Number(row.lon),
      source: 'NOMINATIM_OSM'
    }));
    const merged = [...localMatches];
    for (const rm of remoteMatches) {
      if (!merged.some(m => distanceMetersLatLon(m.lat, m.lon, rm.lat, rm.lon) < 500)) {
        merged.push(rm);
      }
    }
    return merged.slice(0, 6);
  } catch (_) {
    return localMatches;
  }
}

function latLonToTileFloat(lat, lon, zoom) {
  const n = Math.pow(2, zoom);
  const latRad = lat * Math.PI / 180;
  const x = ((lon + 180) / 360) * n;
  const y = ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n;
  return { x, y };
}

async function fetchTileRgbaPixels(z, tx, ty, timeoutMs = 4500) {
  const url = `https://elevation-tiles-prod.s3.amazonaws.com/terrarium/${z}/${tx}/${ty}.png`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { mode: 'cors', signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) return null;
    const blob = await res.blob();
    if (typeof createImageBitmap === 'function') {
      const bmp = await createImageBitmap(blob);
      const canvas = typeof OffscreenCanvas !== 'undefined'
        ? new OffscreenCanvas(bmp.width, bmp.height)
        : Object.assign(document.createElement('canvas'), { width: bmp.width, height: bmp.height });
      const ctx = canvas.getContext('2d');
      ctx.drawImage(bmp, 0, 0);
      if (bmp.close) bmp.close();
      return { width: canvas.width, height: canvas.height, data: ctx.getImageData(0, 0, canvas.width, canvas.height).data };
    }
  } catch (_) {
    clearTimeout(timer);
  }
  return null;
}

/**
 * Fetch real Mapzen Terrarium DEM elevation grid centered at (lat, lon).
 * Falls back cleanly to a gentle undulating coastal/hill grid if offline.
 */
export async function fetchTerrariumTerrainGrid(lat, lon, opts = {}) {
  const halfExtentMeters = opts.halfExtentMeters || 1400.0;
  const nx = opts.nx || 64;
  const nz = opts.nz || 64;
  const zoom = opts.zoom || 13;

  const fallbackGrid = () => {
    const heights = new Array((nx + 1) * (nz + 1)).fill(0);
    const greenMask = new Array((nx + 1) * (nz + 1)).fill(0);
    for (let j = 0; j <= nz; j++) {
      const north_m = -halfExtentMeters + (j / nz) * halfExtentMeters * 2;
      for (let i = 0; i <= nx; i++) {
        const east_m = -halfExtentMeters + (i / nx) * halfExtentMeters * 2;
        const slope =
          Math.sin(east_m * 0.0022) * 3.8 +
          Math.cos(north_m * 0.0019) * 3.4 +
          (north_m / halfExtentMeters) * 4.5 - 6.0;
        heights[j * (nx + 1) + i] = Number(Math.max(-21.0, Math.min(48.0, slope)).toFixed(2));
      }
    }
    return {
      nx,
      nz,
      halfExtentMeters,
      heights,
      greenMask,
      anchorElevationMeters: 18.0,
      provenance: 'SYNTHETIC_SLOPE_FALLBACK'
    };
  };

  if (typeof fetch !== 'function' || (typeof createImageBitmap !== 'function' && typeof document === 'undefined')) {
    return fallbackGrid();
  }

  try {
    const nw = localENUToLatLon(-halfExtentMeters, halfExtentMeters, lat, lon);
    const se = localENUToLatLon(halfExtentMeters, -halfExtentMeters, lat, lon);
    const tfNW = latLonToTileFloat(nw.lat, nw.lon, zoom);
    const tfSE = latLonToTileFloat(se.lat, se.lon, zoom);
    const txMin = Math.floor(Math.min(tfNW.x, tfSE.x));
    const txMax = Math.floor(Math.max(tfNW.x, tfSE.x));
    const tyMin = Math.floor(Math.min(tfNW.y, tfSE.y));
    const tyMax = Math.floor(Math.max(tfNW.y, tfSE.y));

    const tileMap = new Map();
    const promises = [];
    for (let ty = tyMin; ty <= tyMax; ty++) {
      for (let tx = txMin; tx <= txMax; tx++) {
        promises.push(
          fetchTileRgbaPixels(zoom, tx, ty).then(pix => {
            if (pix) tileMap.set(`${tx}_${ty}`, pix);
          })
        );
      }
    }
    await Promise.all(promises);
    if (tileMap.size === 0) return fallbackGrid();

    const decodeTerrariumAt = (qLat, qLon) => {
      const tf = latLonToTileFloat(qLat, qLon, zoom);
      const tx = Math.floor(tf.x);
      const ty = Math.floor(tf.y);
      const tile = tileMap.get(`${tx}_${ty}`);
      if (!tile) return null;
      const px = Math.max(0, Math.min(tile.width - 1, Math.floor((tf.x - tx) * tile.width)));
      const py = Math.max(0, Math.min(tile.height - 1, Math.floor((tf.y - ty) * tile.height)));
      const off = (py * tile.width + px) * 4;
      const r = tile.data[off];
      const g = tile.data[off + 1];
      const b = tile.data[off + 2];
      return r * 256.0 + g + b / 256.0 - 32768.0;
    };

    const rawCenter = decodeTerrariumAt(lat, lon);
    const anchorElev = Number.isFinite(rawCenter) ? rawCenter : 18.0;
    const heights = new Array((nx + 1) * (nz + 1)).fill(-6.0);
    const greenMask = new Array((nx + 1) * (nz + 1)).fill(0);

    for (let j = 0; j <= nz; j++) {
      const north_m = -halfExtentMeters + (j / nz) * halfExtentMeters * 2;
      for (let i = 0; i <= nx; i++) {
        const east_m = -halfExtentMeters + (i / nx) * halfExtentMeters * 2;
        const pLatLon = localENUToLatLon(east_m, north_m, lat, lon);
        const absElev = decodeTerrariumAt(pLatLon.lat, pLatLon.lon);
        // Shift near viewer pedestal baseline (-4.5m at anchor) so 3D cuts stay cleanly above -24.2m skirt
        const rel = Number.isFinite(absElev) ? absElev - anchorElev - 4.5 : -4.5;
        heights[j * (nx + 1) + i] = Number(Math.max(-21.2, Math.min(72.0, rel)).toFixed(2));
      }
    }

    return {
      nx,
      nz,
      halfExtentMeters,
      heights,
      greenMask,
      anchorElevationMeters: Number(anchorElev.toFixed(1)),
      provenance: 'MAPZEN_TERRARIUM_AWS_DEM'
    };
  } catch (_) {
    return fallbackGrid();
  }
}

export function evaluateRegionalHazard(regionOrScenario, userLat, userLon) {
  const lat = Number.isFinite(userLat) ? userLat : 37.555815;
  const lon = Number.isFinite(userLon) ? userLon : 127.045053;
  const raw = regionOrScenario?.scenarioEvent || regionOrScenario || {};
  const epiLat = Number.isFinite(raw.epicenterLat)
    ? raw.epicenterLat
    : (raw.useLocalOffset ? lat + (raw.offsetLatDeg ?? 0.032) : lat + 0.032);
  const epiLon = Number.isFinite(raw.epicenterLon)
    ? raw.epicenterLon
    : (raw.useLocalOffset ? lon + (raw.offsetLonDeg ?? 0.045) : lon + 0.045);

  const hazard = (raw.provenance && raw.scenarioType && raw.epicenterLat !== undefined)
    ? raw
    : HazardProvider.createScenario({
        id: raw.id || `SCENARIO_${lat.toFixed(2)}_${lon.toFixed(2)}`,
        scenarioType: raw.scenarioType || SCENARIO_TYPES.EDUCATIONAL_SYNTHETIC,
        title: raw.title || '지역 기반 지진 시나리오',
        epicenterLat: epiLat,
        epicenterLon: epiLon,
        magnitude: raw.magnitude !== undefined ? raw.magnitude : 5.2,
        magScale: raw.magScale || null,
        depthKm: raw.depthKm !== undefined ? raw.depthKm : 10,
        originText: raw.originText || '지진 발생 위치',
        occurredAt: raw.occurredAt || null,
        source: raw.source || 'SEISMOLIVE_HAZARD_PROVIDER',
        officialProducts: raw.officialProducts || null,
        isGeneralAssumptionOnly: raw.isGeneralAssumptionOnly,
        selectionReasonKo: raw.selectionReasonKo || null
      });

  const evalResult = HazardProvider.evaluateSeismicImpactAtLocation(hazard, lat, lon);
  return {
    ...hazard,
    distanceKm: evalResult.distanceKm,
    azimuthDeg: evalResult.bearingDeg,
    pArrivalSec: evalResult.pWaveEtaSec,
    sArrivalSec: evalResult.sWaveEtaSec,
    impactAssessment: evalResult
  };
}

/**
 * Compile raw OSM 0.6 / Overpass JSON (+ optional Terrarium terrainGrid) into a complete,
 * OBB-decomposed, collision-free nationwide Spatial Package using the 7 normalized providers.
 * NEVER fabricates buildings, walkable grids, indoor floorplans, or shelters when sparse/missing.
 */
export function compileOsmJsonToSpatialPackage(osmJson, opts = {}) {
  const anchorLat = opts.lat ?? 37.555815;
  const anchorLon = opts.lon ?? 127.045053;
  const regionId = opts.regionId || `KR_${anchorLat.toFixed(4)}_${anchorLon.toFixed(4)}`;
  const regionTitle = opts.title || `대한민국 (${anchorLat.toFixed(4)}°N, ${anchorLon.toFixed(4)}°E) 국지 3D 공간 패키지`;
  const halfExtentMeters = opts.halfExtentMeters || 1800.0;
  const impactStatus = opts.impactStatus || IMPACT_ZONE_STATUS.EDUCATIONAL_DRILL;

  const terrainGrid = opts.terrainGrid || {
    nx: 48,
    nz: 48,
    halfExtentMeters,
    heights: new Array(49 * 49).fill(-5.0),
    greenMask: new Array(49 * 49).fill(0),
    anchorElevationMeters: 18.0,
    provenance: 'DEFAULT_FLAT_GRID'
  };

  const elements = Array.isArray(osmJson?.elements) ? osmJson.elements : [];

  // Provider 4: Buildings (concave OBB wings + Section 8 indoor scoping; zero fake blocks)
  const buildingData = BuildingProvider.extractFromOsmElements(elements, {
    anchorLat,
    anchorLon,
    terrainGrid,
    halfExtentMeters
  });

  // Provider 5: Road Network & Hydrology (walkable ways + bridges + crossings + waterways; zero fake grid)
  const roadData = RoadNetworkProvider.extractFromOsmElements(elements, {
    anchorLat,
    anchorLon,
    terrainGrid,
    halfExtentMeters
  });

  const {
    obbRawList,
    obbBuildingsFloat32,
    obbGroundOffsets,
    obbLodCounts,
    namedBuildings
  } = buildingData;

  const {
    denseRoadNetwork,
    waterPolygons,
    waterways,
    greenPolygons,
    walkGraph
  } = roadData;

  // Anchor analysis directly at the selected/GPS outdoor point — NEVER assume the user resides inside a nearby building
  const defaultOrigin = pickAnalysisOriginPoint(
    walkGraph,
    terrainGrid,
    opts.originLabel || '분석 기준 위치'
  );

  const originEN = defaultOrigin ? [defaultOrigin.east_m, defaultOrigin.north_m] : [0, 0];

  // Provider 6: Facility / Destination Candidates with honest multi-dimensional evaluation
  const facilityEval = FacilityProvider.discoverAndEvaluateCandidates(elements, {
    anchorLat,
    anchorLon,
    terrainGrid,
    obbRawList,
    walkGraph,
    waterPolygons,
    waterways,
    impactStatus,
    originEN,
    halfExtentMeters,
    officialShelters: opts.officialShelters || []
  });

  const rankedShelters = facilityEval.candidates;
  const primaryCandidate = facilityEval.primaryCandidate;
  const reachableCandidates = rankedShelters.filter(c => c.candidateStatus !== CANDIDATE_STATUS.UNAVAILABLE);

  // Build Initial Facility Package ONLY if walkable road data & a viable candidate exist
  let initialFacilityPackage = null;
  if (primaryCandidate && walkGraph.edges.length > 0 && defaultOrigin) {
    const builtPkg = buildDynamicFacilityFromPoint({
      buildingId: defaultOrigin.id,
      name: defaultOrigin.name,
      east_m: defaultOrigin.east_m,
      north_m: defaultOrigin.north_m,
      width_m: defaultOrigin.width_m,
      depth_m: defaultOrigin.depth_m,
      yaw_rad: defaultOrigin.yaw_rad,
      height_m: defaultOrigin.height_m,
      hasIndoorData: false,
      indoorScope: defaultOrigin.indoorScope || INDOOR_SPATIAL_SCOPE.OUTDOOR_ONLY,
      levelsKnown: defaultOrigin.levelsKnown ?? null,
      anchor: { lat: anchorLat, lon: anchorLon, h: terrainGrid.anchorElevationMeters || 20 },
      walkGraph,
      buildingOBBs: obbBuildingsFloat32,
      waterPolygons,
      waterways,
      shelter: primaryCandidate,
      destinationStatus: primaryCandidate.candidateStatus,
      elevationSampler: (e, n) => sampleGridHeightAt(terrainGrid, e, n)
    });

    if (builtPkg && builtPkg.outdoorGraph?.edges?.length > 0) {
      initialFacilityPackage = builtPkg;
    }
  }

  // Honest Data Completeness Grading (Section 7)
  let dataCompleteness = 'INSUFFICIENT';
  if (obbRawList.length >= 6 && walkGraph.edges.length >= 12 && reachableCandidates.length >= 1 && initialFacilityPackage) {
    dataCompleteness = 'SUFFICIENT';
  } else if (walkGraph.edges.length >= 1 || obbRawList.length >= 1 || rankedShelters.length >= 1) {
    dataCompleteness = 'PARTIAL';
  }

  const dataLimitations = [];
  if (obbRawList.length === 0) {
    dataLimitations.push('주변 건축물(building) 외곽 데이터가 확인되지 않았습니다.');
  } else {
    dataLimitations.push('추출된 건물은 외곽 풋프린트만 존재하며, 파일럿 지정 건물이 아닌 이상 실내 평면도·비상계단 정보는 미제공입니다.');
  }
  if (walkGraph.edges.length === 0) {
    dataLimitations.push('보행 가능 도로·보도 네트워크가 확인되지 않아 실측 경로를 계산할 수 없습니다.');
  }
  if (reachableCandidates.length === 0) {
    dataLimitations.push(facilityEval.limitations || '접근 가능한 확인된 대피소 또는 개활 안전 후보를 찾지 못했습니다.');
  } else {
    dataLimitations.push('공식 행정안전부 지진옥외대피장소 실시간 API 미연동 구간에서는 OSM 개활 공터·집결지 태그를 조건부(CONDITIONAL) 후보로 제시합니다.');
  }
  if (terrainGrid.provenance === 'SYNTHETIC_SLOPE_FALLBACK' || terrainGrid.provenance === 'DEFAULT_FLAT_GRID') {
    dataLimitations.push('실시간 DEM 고도 타일(Terrarium AWS) 미연결로 기본 표고 평면을 표시합니다.');
  }

  const viewAnchorE = primaryCandidate?.east_m ?? defaultOrigin?.east_m ?? 0;
  const viewAnchorN = primaryCandidate?.north_m ?? defaultOrigin?.north_m ?? 0;
  const originE = defaultOrigin?.east_m ?? 0;
  const originN = defaultOrigin?.north_m ?? 0;

  return {
    metadata: {
      packageId: regionId,
      title: regionTitle,
      crs: 'LOCAL_TANGENT_ENU_WGS84',
      anchor: { lat: anchorLat, lon: anchorLon, ellipsoidalHeightMeters: terrainGrid.anchorElevationMeters || 20 },
      dataCompleteness,
      dataLimitations,
      dataSources: [
        `Terrain: ${terrainGrid.provenance || 'Mapzen Terrarium DEM'}`,
        `Buildings: ${buildingData.provenance.source} (${obbRawList.length} OBBs, ${buildingData.provenance.completeness})`,
        `Roads: ${roadData.provenance.source} (${walkGraph.edges.length} walkable edges, ${roadData.provenance.completeness})`,
        `Facilities: ${facilityEval.overallStatus} (${reachableCandidates.length}/${rankedShelters.length} reachable candidates)`
      ]
    },
    providers: {
      terrain: createProvenanceRecord({
        source: terrainGrid.provenance || 'Mapzen Terrarium DEM',
        sourceType: terrainGrid.provenance === 'MAPZEN_TERRARIUM_AWS_DEM'
          ? DATA_ORIGIN_TYPES.OBSERVED
          : DATA_ORIGIN_TYPES.UNKNOWN,
        verificationStatus: terrainGrid.provenance === 'MAPZEN_TERRARIUM_AWS_DEM'
          ? VERIFICATION_STATUS.VERIFIED
          : VERIFICATION_STATUS.UNAVAILABLE
      }),
      buildings: buildingData.provenance,
      roads: roadData.provenance,
      facilities: facilityEval
    },
    dataCompleteness,
    dataLimitations,
    destinationAssessment: facilityEval,
    viewpoints: {
      LOCAL_4KM_OVERVIEW: {
        position: [-360.0, 440.0, 780.0],
        target: [0, 0, 0],
        near: 0.5,
        far: 6500.0
      },
      REGIONAL_APPROACH: {
        position: [-360.0, 440.0, 780.0],
        target: [0, 0, 0],
        near: 0.5,
        far: 6500.0
      },
      CAMPUS_OVERVIEW: {
        position: [viewAnchorE + 180, 195, -viewAnchorN + 260],
        target: [(originE + viewAnchorE) * 0.5, 4, -(originN + viewAnchorN) * 0.5],
        near: 0.25,
        far: 6500.0
      }
    },
    terrainGrid,
    terrainAndHydrology: {
      hillslopeContours: [],
      waterways,
      alluvialCautionZone: null,
      waterPolygons,
      greenPolygons
    },
    roadNetwork: [],
    denseRoadNetwork,
    sheltersAndFacilities: rankedShelters,
    namedBuildings,
    obbBuildingsFloat32,
    obbGroundOffsets,
    obbLodCounts,
    walkGraph,
    defaultOriginMeta: defaultOrigin,
    initialFacilityPackage
  };
}

function pickAnalysisOriginPoint(walkGraph, terrainGrid, label = '분석 기준 위치') {
  if ((walkGraph?.nodes?.length || 0) >= 2 && (walkGraph?.edges?.length || 0) >= 1) {
    let bestNode = null;
    let bestD = Infinity;
    for (const nd of walkGraph.nodes) {
      const d = Math.hypot(nd[1], nd[2]);
      if (d < bestD) { bestD = d; bestNode = nd; }
    }
    if (bestNode && bestD <= 450) {
      return {
        id: 'OUTDOOR_ANALYSIS_ORIGIN',
        name: label,
        east_m: Number((bestNode[1] * 0.25).toFixed(2)), // Anchor near (0,0) analysis point rather than inside random building
        north_m: Number((bestNode[2] * 0.25).toFixed(2)),
        groundY_m: sampleGridHeightAt(terrainGrid, 0, 0),
        width_m: 4,
        depth_m: 4,
        yaw_rad: 0,
        height_m: 0,
        indoorScope: INDOOR_SPATIAL_SCOPE.OUTDOOR_ONLY,
        originHasBuilding: false
      };
    }
  }
  return null;
}

async function fetchOsmRegionElements(lat, lon, halfSpanMeters = 900) {
  if (typeof fetch !== 'function') return null;

  const latDegPerMeter = 1 / 111320;
  const lonDegPerMeter = 1 / (111320 * Math.max(0.2, Math.cos((lat * Math.PI) / 180)));
  const dLat = halfSpanMeters * latDegPerMeter;
  const dLon = halfSpanMeters * lonDegPerMeter;
  const south = (lat - dLat).toFixed(5);
  const west = (lon - dLon).toFixed(5);
  const north = (lat + dLat).toFixed(5);
  const east = (lon + dLon).toFixed(5);

  // 1. Fast OSM 0.6 XML/JSON bbox API for tighter bounding boxes (< ~1km half-span)
  if (halfSpanMeters <= 1000) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 5500);
      const bbox = `${west},${south},${east},${north}`;
      const res = await fetch(`https://api.openstreetmap.org/api/0.6/map.json?bbox=${bbox}`, {
        mode: 'cors',
        signal: controller.signal
      });
      clearTimeout(timer);
      if (res.ok) {
        const json = await res.json();
        if (json && Array.isArray(json.elements) && json.elements.length > 0) {
          return json;
        }
      }
    } catch (_) {
      // Fall through to Overpass API
    }
  }

  // 2. Overpass API (handles wider 4km~6.4km regional queries; trims dense building ways when >2.2km)
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8500);
    const includeBuildings = halfSpanMeters <= 2200
      ? `way["building"](${south},${west},${north},${east});`
      : '';
    const roadSelector = halfSpanMeters <= 2200
      ? `way["highway"](${south},${west},${north},${east});`
      : `way["highway"~"primary|secondary|tertiary|unclassified|residential|footway|pedestrian|path|steps"](${south},${west},${north},${east});`;
    const overpassQuery =
      `[out:json][timeout:10];` +
      `(` +
        includeBuildings +
        roadSelector +
        `way["waterway"](${south},${west},${north},${east});` +
        `way["natural"="water"](${south},${west},${north},${east});` +
        `way["leisure"~"park|pitch|stadium|recreation_ground"](${south},${west},${north},${east});` +
        `way["amenity"="school"](${south},${west},${north},${east});` +
        `way["emergency"="assembly_point"](${south},${west},${north},${east});` +
        `node["emergency"="assembly_point"](${south},${west},${north},${east});` +
      `);` +
      `(._;>;);out body;`;
    const url = `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(overpassQuery)}`;
    const res = await fetch(url, { mode: 'cors', signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) return null;
    const json = await res.json();
    if (json && Array.isArray(json.elements)) return json;
  } catch (_) {
    return null;
  }
  return null;
}

/**
 * Unified Regional Spatial Loader for ANY location in South Korea.
 * Supports Globe event handoff, automatic scenario resolution, and multi-stage radius expansion.
 */
export async function loadRegionalSpatialPackage(lat, lon, opts = {}) {
  const distToHanyang = distanceMetersLatLon(lat, lon, 37.555815, 127.045053);
  const useHanyangNative = !opts.forceGenericOsm && (opts.regionId === 'seoul_hanyang' || (opts.usePilotPreset && distToHanyang < 2200));
  if (useHanyangNative) {
    const hanyangRegion = KOREA_BENCHMARK_REGIONS[0];
    const autoResolved = opts.handedEvent
      ? HazardProvider.normalizeGlobeEvent(opts.handedEvent, opts.handedEvent.officialProducts || null)
      : (opts.customScenario || AutoScenarioResolver.resolveForLocation({
          anchorLat: lat,
          anchorLon: lon,
          anchorLabel: opts.shortName || hanyangRegion.shortName,
          catalogEvents: opts.catalogEvents || PRESET_EARTHQUAKE_SCENARIOS,
          preferredMode: opts.preferredScenarioMode || 'AUTO'
        }));
    const scenarioEval = evaluateRegionalHazard(autoResolved, lat, lon);
    const hanyangCandidates = (HANYANG_LOCAL_4KM_PACKAGE.sheltersAndFacilities || []).map(s => ({
      ...s,
      candidateStatus: HANYANG_SHELTER_JUSTIFICATION[s.id]
        ? CANDIDATE_STATUS.CONFIRMED
        : CANDIDATE_STATUS.CONDITIONAL,
      provenanceLabel: HANYANG_SHELTER_JUSTIFICATION[s.id]?.provenanceLabel || '성동 권역 대피 후보',
      justification: HANYANG_SHELTER_JUSTIFICATION[s.id] || s.justification || null
    }));

    return {
      ...HANYANG_LOCAL_4KM_PACKAGE,
      walkGraph: HANYANG_CAMPUS_WALK_GRAPH,
      defaultOriginMeta: {
        id: opts.usePilotBuildingOrigin ? 'BLDG_212_ENG1' : 'OUTDOOR_ANALYSIS_ORIGIN',
        name: opts.usePilotBuildingOrigin ? '제1공학관 (212동)' : '서울 성동 분석 기준 위치',
        east_m: opts.usePilotBuildingOrigin ? 44.36 : 52.0,
        north_m: opts.usePilotBuildingOrigin ? 112.16 : 74.0,
        height_m: opts.usePilotBuildingOrigin ? 26.0 : 0,
        hasIndoorData: Boolean(opts.usePilotBuildingOrigin),
        originHasBuilding: Boolean(opts.usePilotBuildingOrigin),
        indoorScope: opts.usePilotBuildingOrigin ? INDOOR_SPATIAL_SCOPE.VERIFIED_FLOORPLAN : INDOOR_SPATIAL_SCOPE.OUTDOOR_ONLY
      },
      shelterJustifications: HANYANG_SHELTER_JUSTIFICATION,
      destinationAssessment: {
        candidates: hanyangCandidates,
        primaryCandidate: hanyangCandidates[0] || null,
        overallStatus: hanyangCandidates.length > 0 ? CANDIDATE_STATUS.CONFIRMED : CANDIDATE_STATUS.UNAVAILABLE,
        limitations: '제1공학관(212동) 파일럿 범위 외 일반 건축물은 외곽 풋프린트만 포함되며, 공식 지정 여부가 현장 개방·안전을 즉시 보증하지 않습니다.'
      },
      dataCompleteness: 'SUFFICIENT',
      dataLimitations: [
        '공식 대피소 지정 정보와 현재 개방·접근 가능 여부는 별개이며 현장 확인이 우선됩니다.',
        '계산된 보행 경로는 기하학적 연결 경로이며 지진 후 노면 파손 안전을 보증하지 않습니다.'
      ],
      regionInfo: {
        ...hanyangRegion,
        scenarioEvent: scenarioEval
      },
      isHanyangNative: true
    };
  }

  const matchedBenchmark =
    KOREA_BENCHMARK_REGIONS.find(r => r.id === opts.regionId) ||
    KOREA_BENCHMARK_REGIONS.find(r => !r.isHanyangDefault && distanceMetersLatLon(lat, lon, r.lat, r.lon) < 4000) || {
      id: opts.regionId || `KR_${lat.toFixed(3)}_${lon.toFixed(3)}`,
      name: opts.name || `대한민국 (${lat.toFixed(4)}°N, ${lon.toFixed(4)}°E)`,
      shortName: opts.shortName || opts.name || `선택 위치 (${lat.toFixed(3)}, ${lon.toFixed(3)})`,
      subtitle: '범용 3D 지역 공간 분석 권역',
      lat,
      lon,
      isHanyangDefault: false
    };

  const resolvedScenarioSpec = opts.handedEvent
    ? HazardProvider.normalizeGlobeEvent(opts.handedEvent, opts.handedEvent.officialProducts || null)
    : (opts.customScenario || AutoScenarioResolver.resolveForLocation({
        anchorLat: lat,
        anchorLon: lon,
        anchorLabel: matchedBenchmark.shortName || matchedBenchmark.name,
        catalogEvents: opts.catalogEvents || PRESET_EARTHQUAKE_SCENARIOS,
        preferredMode: opts.preferredScenarioMode || 'AUTO'
      }));

  const scenarioEval = evaluateRegionalHazard(resolvedScenarioSpec, lat, lon);
  const impactStatus = scenarioEval.impactAssessment?.impactStatus || IMPACT_ZONE_STATUS.UNKNOWN;

  let queryRadiusMeters = opts.radiusMeters || 900;
  let maxExtentMeters = Math.max(1800, queryRadiusMeters);

  const demPromise = fetchTerrariumTerrainGrid(lat, lon, { halfExtentMeters: maxExtentMeters, nx: 64, nz: 64 });
  const osmPromise = (async () => {
    if (opts.osmJsonOverride) return opts.osmJsonOverride;
    if (opts.osmJson) return opts.osmJson;
    if (typeof fetch !== 'function' || opts.offlineOnly) return null;

    // 1. Compact urban fetch (~1.8km span)
    let json = await fetchOsmRegionElements(lat, lon, 900);
    const hasOpenShelterTag = el => el.type === 'way' && (el.tags?.leisure === 'park' || el.tags?.leisure === 'pitch' || el.tags?.leisure === 'stadium' || el.tags?.amenity === 'school' || el.tags?.emergency === 'assembly_point');
    const wayCount = json?.elements?.filter(e => e.type === 'way')?.length || 0;
    const candCount = json?.elements?.filter(hasOpenShelterTag)?.length || 0;

    // 2. Dynamic expansion up to ~4km span (2000m half-extent)
    if (!json || wayCount < 15 || candCount === 0) {
      const expanded = await fetchOsmRegionElements(lat, lon, 2000);
      if (expanded && Array.isArray(expanded.elements) && expanded.elements.length > (json?.elements?.length || 0)) {
        json = expanded;
        queryRadiusMeters = 2000;
      }
    }

    // 3. Adaptive >4km rural/suburban outreach up to 3.2km radius (6.4km diameter) if still sparse
    const candCount2 = json?.elements?.filter(hasOpenShelterTag)?.length || 0;
    if (!json || candCount2 === 0) {
      const wide = await fetchOsmRegionElements(lat, lon, 3200);
      if (wide && Array.isArray(wide.elements) && wide.elements.length > (json?.elements?.length || 0)) {
        // Merge buildings from 2km pass with wider roads & parks from 3.2km pass
        const prevBuildings = (json?.elements || []).filter(e => e.tags?.building);
        const wideNodesAndWays = wide.elements;
        json = { elements: [...(json?.elements || []), ...wideNodesAndWays.filter(w => !prevBuildings.some(pb => pb.id === w.id))] };
        queryRadiusMeters = 3200;
        maxExtentMeters = 3200;
      }
    }
    return json;
  })();

  const shelterPromise = (!opts.offlineOnly && !opts.osmJsonOverride && typeof fetch === 'function')
    ? liveSeismicDataService.fetchOfficialSheltersNear(lat, lon, Math.max(2500, queryRadiusMeters), { timeoutMs: 1600 })
    : Promise.resolve({ status: 'OFFLINE_OR_SKIPPED', shelters: [] });

  const [terrainGrid, liveOsmJson, officialShelterRes] = await Promise.all([demPromise, osmPromise, shelterPromise]);
  const osmJson = liveOsmJson || { elements: [] };
  const osmUnavailable = !liveOsmJson || !Array.isArray(liveOsmJson.elements) || liveOsmJson.elements.length === 0;
  const officialShelters = Array.isArray(officialShelterRes?.shelters) ? officialShelterRes.shelters : [];

  const pkg = compileOsmJsonToSpatialPackage(osmJson, {
    lat,
    lon,
    regionId: matchedBenchmark.id,
    title: `${matchedBenchmark.name} 지역 공간 분석`,
    originLabel: opts.originLabel || `${matchedBenchmark.shortName || '선택 지역'} 기준 위치`,
    halfExtentMeters: maxExtentMeters,
    impactStatus,
    terrainGrid,
    officialShelters
  });

  pkg.metadata.shelterApiStatus = officialShelterRes?.status || 'UNKNOWN';
  pkg.metadata.officialShelterCount = officialShelters.length;

  if (osmUnavailable && officialShelters.length === 0) {
    pkg.metadata.dataSources.push('OSM 실시간 공간 데이터를 확보하지 못했습니다 (가상 데이터 생성 금지).');
    pkg.dataLimitations = [
      'OpenStreetMap / Overpass 공간 데이터를 불러오지 못해 건물·보행로·대피 후보가 미확인(INSUFFICIENT) 상태입니다.',
      ...pkg.dataLimitations
    ];
  }

  pkg.regionInfo = {
    ...matchedBenchmark,
    scenarioEvent: scenarioEval
  };
  pkg.isHanyangNative = false;
  pkg.osmFetchUnavailable = osmUnavailable;
  pkg.queryRadiusMeters = queryRadiusMeters;
  return pkg;
}
