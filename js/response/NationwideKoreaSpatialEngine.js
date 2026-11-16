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

import { VERIFICATION_STATUS } from './ResponseDomainTypes.js';
import {
  HANYANG_LOCAL_4KM_PACKAGE,
  HANYANG_LOCAL_SPATIAL_METADATA,
  sampleTerrainHeight as sampleHanyangTerrainHeight
} from './HanyangLocalSpatialData.js';
import { HANYANG_CAMPUS_WALK_GRAPH } from './HanyangCampusWalkData.js';
import {
  decomposePolygonToOBBs,
  polygonArea2D,
  buildDynamicFacilityFromPoint,
  doesSegmentIntersectOBBXZ
} from './CampusWalkRouter.js';
import { sampleGridHeightAt } from './LocalSpatialMapLayer.js';

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
    title: '공식 재난방송·余震 정보 수신',
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
    subtitle: '한반도 직하·원거리 역사지진 수도권 3D 대피 기준 권역',
    lat: 37.555815,
    lon: 127.045053,
    isHanyangDefault: true,
    scenarioEvent: Object.freeze({
      id: 'SJM-1681-CAPSTONE',
      title: '1681 양양 역사지진 서울 감응 · 도시 대피 시나리오',
      epicenterLat: 38.05,
      epicenterLon: 128.65,
      originText: '강원도 양양 인근 (숙종 7년 5월 14일 실록 기록)',
      magnitudeText: '규모 미상(사료 기록)',
      depthText: '진원 깊이 미상',
      distanceKm: 164.7,
      azimuthDeg: 72.4,
      pArrivalSec: 23.5,
      sArrivalSec: 47.1
    })
  }),
  Object.freeze({
    id: 'gyeongju',
    name: '경북 경주 · 황남·월성 지구',
    shortName: '경주 진앙권',
    subtitle: '2016.09.12 경주 지진(M5.8) 인접 한옥·구도심 개활 대피 권역',
    lat: 35.8347,
    lon: 129.2190,
    isHanyangDefault: false,
    scenarioEvent: Object.freeze({
      id: 'KMA-2016-GYEONGJU',
      title: '2016 경주 M5.8 내남면 단층 파열 · 구도심 대피 권역',
      epicenterLat: 35.760,
      epicenterLon: 129.190,
      originText: '경북 경주시 남남서쪽 8.7km (2016.09.12)',
      magnitudeText: 'M5.8 (기상청 계기 기록)',
      depthText: '진원 깊이 약 15km',
      distanceKm: 8.7,
      azimuthDeg: 197.5,
      pArrivalSec: 1.5,
      sArrivalSec: 2.6
    })
  }),
  Object.freeze({
    id: 'pohang',
    name: '경북 포항 · 흥해·중앙 지구',
    shortName: '포항 흥해권',
    subtitle: '2017.11.15 포항 지진(M5.4) 천부 지진 단층 대피 권역',
    lat: 36.1086,
    lon: 129.3490,
    isHanyangDefault: false,
    scenarioEvent: Object.freeze({
      id: 'KMA-2017-POHANG',
      title: '2017 포항 M5.4 흥해 천부 단층 · 필로티 회피 대피 권역',
      epicenterLat: 36.109,
      epicenterLon: 129.366,
      originText: '경북 포항시 북구 북쪽 9km (2017.11.15)',
      magnitudeText: 'M5.4 (기상청 계기 기록)',
      depthText: '진원 깊이 약 7km',
      distanceKm: 1.6,
      azimuthDeg: 88.2,
      pArrivalSec: 1.1,
      sArrivalSec: 2.0
    })
  }),
  Object.freeze({
    id: 'yangyang',
    name: '강원 양양 · 낙산·읍내 지구',
    shortName: '양양 역사권',
    subtitle: '1681년 조선 숙종 7년 대규모 역사지진 진원 추정 연안 권역',
    lat: 38.0754,
    lon: 128.6189,
    isHanyangDefault: false,
    scenarioEvent: Object.freeze({
      id: 'HIST-1681-YANGYANG',
      title: '1681 양양·강릉 대지진(승정원일기) 동해안 고지 대피 권역',
      epicenterLat: 38.05,
      epicenterLon: 128.65,
      originText: '강원도 양양·강릉 해역 (1681.06.26)',
      magnitudeText: '규모 미상 (한반도 전역 감지)',
      depthText: '진원 깊이 미상',
      distanceKm: 3.9,
      azimuthDeg: 136.0,
      pArrivalSec: 1.4,
      sArrivalSec: 2.5
    })
  }),
  Object.freeze({
    id: 'buan',
    name: '전북 부안 · 부안읍 지구',
    shortName: '부안 진앙권',
    subtitle: '2024.06.12 부안 지진(M4.8) 호남 내륙 단층 대피 권역',
    lat: 35.7285,
    lon: 126.7318,
    isHanyangDefault: false,
    scenarioEvent: Object.freeze({
      id: 'KMA-2024-BUAN',
      title: '2024 부안 M4.8 남남서 단층 · 내륙 소도시 대피 권역',
      epicenterLat: 35.700,
      epicenterLon: 126.710,
      originText: '전북 부안군 남남서쪽 4km (2024.06.12)',
      magnitudeText: 'M4.8 (기상청 계기 기록)',
      depthText: '진원 깊이 약 8km',
      distanceKm: 3.7,
      azimuthDeg: 212.0,
      pArrivalSec: 1.4,
      sArrivalSec: 2.5
    })
  }),
  Object.freeze({
    id: 'busan_haeundae',
    name: '부산 해운대 · 좌동 지구',
    shortName: '부산 해운대',
    subtitle: '동남권 고밀도 해안 도심 지진·해일 고지 대피 권역',
    lat: 35.1695,
    lon: 129.1725,
    isHanyangDefault: false,
    scenarioEvent: Object.freeze({
      id: 'KMA-SE-BUSAN',
      title: '울산·양산단층 동남권 지진 · 해안 고밀도 블록 대피 권역',
      epicenterLat: 35.42,
      epicenterLon: 129.55,
      originText: '동남권 해역 단층대 시나리오',
      magnitudeText: 'M5.9 (시나리오 가정)',
      depthText: '진원 깊이 약 12km',
      distanceKm: 44.1,
      azimuthDeg: 50.8,
      pArrivalSec: 7.4,
      sArrivalSec: 12.6
    })
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

function estimateBuildingHeightMeters(tags = {}, areaSqMeters = 220) {
  if (tags.height) {
    const parsed = parseFloat(String(tags.height).replace(/[^0-9.]/g, ''));
    if (Number.isFinite(parsed) && parsed >= 3 && parsed <= 240) return parsed;
  }
  if (tags['building:levels']) {
    const lvls = parseFloat(String(tags['building:levels']).replace(/[^0-9.]/g, ''));
    if (Number.isFinite(lvls) && lvls >= 1 && lvls <= 70) return Number((lvls * 3.35).toFixed(1));
  }
  const btype = String(tags.building || '').toLowerCase();
  if (btype === 'apartments' || btype === 'office' || btype === 'commercial') {
    return areaSqMeters > 700 ? 28.0 : 18.5;
  }
  if (btype === 'school' || btype === 'university' || btype === 'hospital' || btype === 'public') {
    return 17.5;
  }
  if (btype === 'house' || btype === 'residential' || btype === 'detached') {
    return 7.8;
  }
  if (areaSqMeters > 1200) return 21.0;
  if (areaSqMeters > 450) return 14.0;
  return 9.5;
}

function classifyOsmHighway(tags = {}) {
  const hw = String(tags.highway || '').toLowerCase();
  if (tags.railway === 'rail' || tags.railway === 'subway' || tags.railway === 'light_rail') return 'rail';
  if (hw === 'motorway' || hw === 'motorway_link') return 'motorway';
  if (hw === 'trunk' || hw === 'trunk_link') return 'trunk';
  if (hw === 'primary' || hw === 'primary_link') return 'primary';
  if (hw === 'secondary' || hw === 'secondary_link') return 'secondary';
  if (hw === 'tertiary' || hw === 'tertiary_link' || hw === 'unclassified') return 'tertiary';
  if (
    hw === 'footway' || hw === 'steps' || hw === 'pedestrian' ||
    hw === 'path' || hw === 'cycleway' || hw === 'living_street' ||
    hw === 'residential' || hw === 'service'
  ) {
    return hw === 'footway' || hw === 'steps' || hw === 'pedestrian' || hw === 'path'
      ? 'footway'
      : 'tertiary';
  }
  return null;
}

function isWalkableOsmHighway(tags = {}) {
  const hw = String(tags.highway || '').toLowerCase();
  if (!hw) return false;
  if (hw === 'motorway' || hw === 'motorway_link' || hw === 'trunk' || hw === 'trunk_link') return false;
  return (
    hw === 'footway' || hw === 'steps' || hw === 'pedestrian' || hw === 'path' ||
    hw === 'cycleway' || hw === 'living_street' || hw === 'residential' ||
    hw === 'service' || hw === 'unclassified' || hw === 'tertiary' ||
    hw === 'secondary' || hw === 'primary' || hw === 'track'
  );
}

function pointInsideBBox(east_m, north_m, box) {
  return (
    east_m >= box.minE && east_m <= box.maxE &&
    north_m >= box.minN && north_m <= box.maxN
  );
}

function computePolygonCentroidAndBBox(ptsEN) {
  let minE = Infinity;
  let maxE = -Infinity;
  let minN = Infinity;
  let maxN = -Infinity;
  let sumE = 0;
  let sumN = 0;
  for (const [e, n] of ptsEN) {
    if (e < minE) minE = e;
    if (e > maxE) maxE = e;
    if (n < minN) minN = n;
    if (n > maxN) maxN = n;
    sumE += e;
    sumN += n;
  }
  const len = Math.max(1, ptsEN.length);
  return {
    centroidE: sumE / len,
    centroidN: sumN / len,
    minE,
    maxE,
    minN,
    maxN,
    spanMeters: Math.max(maxE - minE, maxN - minN)
  };
}

function isPointInsidePolygonEN(east_m, north_m, ptsEN) {
  let inside = false;
  for (let i = 0, j = ptsEN.length - 1; i < ptsEN.length; j = i++) {
    const xi = ptsEN[i][0];
    const yi = ptsEN[i][1];
    const xj = ptsEN[j][0];
    const yj = ptsEN[j][1];
    const intersect = (yi > north_m) !== (yj > north_m) &&
      east_m < ((xj - xi) * (north_m - yi)) / ((yj - yi) || 1e-9) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

/**
 * Compile raw OSM 0.6 JSON (+ optional Terrarium terrainGrid) into a complete,
 * OBB-decomposed, collision-free nationwide Spatial Package consumed by LocalSpatialMapLayer.
 */
export function compileOsmJsonToSpatialPackage(osmJson, opts = {}) {
  const anchorLat = opts.lat ?? 37.555815;
  const anchorLon = opts.lon ?? 127.045053;
  const regionId = opts.regionId || `KR_${anchorLat.toFixed(4)}_${anchorLon.toFixed(4)}`;
  const regionTitle = opts.title || '대한민국 지진 대응 3D 국지 공간 패키지';
  const halfExtentMeters = opts.halfExtentMeters || 1400.0;

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
  const osmNodesById = new Map();

  for (const el of elements) {
    if (el.type === 'node' && Number.isFinite(el.lat) && Number.isFinite(el.lon)) {
      const [e, n] = latLonToLocalENU(el.lat, el.lon, anchorLat, anchorLon);
      osmNodesById.set(el.id, {
        id: el.id,
        lat: el.lat,
        lon: el.lon,
        e: Number(e.toFixed(2)),
        n: Number(n.toFixed(2)),
        tags: el.tags || null
      });
    }
  }

  const obbRawList = [];
  const namedBuildings = [];
  const denseRoadNetwork = [];
  const waterPolygons = [];
  const greenPolygons = [];
  const waterways = [];
  const shelterCandidates = [];
  const walkableWays = [];

  const getWayPointsEN = way => {
    const ids = Array.isArray(way.nodes) ? way.nodes : [];
    const pts = [];
    for (const nid of ids) {
      const nd = osmNodesById.get(nid);
      if (nd) pts.push([nd.e, nd.n, nd.id]);
    }
    return pts;
  };

  // Pass 1: Process OSM Ways (Buildings, Roads, Green, Water, Walkways, Shelters)
  for (const el of elements) {
    if (el.type !== 'way') continue;
    const tags = el.tags || {};
    const rawPts = getWayPointsEN(el);
    if (rawPts.length < 2) continue;

    const ptsEN = rawPts.map(p => [p[0], p[1]]);
    const { centroidE, centroidN, minE, maxE, minN, maxN, spanMeters } = computePolygonCentroidAndBBox(ptsEN);
    if (Math.abs(centroidE) > halfExtentMeters + 250 || Math.abs(centroidN) > halfExtentMeters + 250) {
      continue;
    }

    // A) Building -> Concave Wing-OBB Decomposition
    if (tags.building && ptsEN.length >= 3) {
      const closedClean = ptsEN.slice();
      if (
        closedClean.length > 2 &&
        Math.hypot(closedClean[0][0] - closedClean[closedClean.length - 1][0], closedClean[0][1] - closedClean[closedClean.length - 1][1]) < 0.05
      ) {
        closedClean.pop();
      }
      if (closedClean.length < 3) continue;
      const area = polygonArea2D(closedClean);
      if (area < 9.0) continue;
      const height_m = estimateBuildingHeightMeters(tags, area);
      const wingObbs = decomposePolygonToOBBs(closedClean, height_m);
      const groundY = sampleGridHeightAt(terrainGrid, centroidE, centroidN);

      for (const obb of wingObbs) {
        obbRawList.push({
          east_m: Number(obb[0].toFixed(2)),
          north_m: Number(obb[1].toFixed(2)),
          width_m: Number(obb[2].toFixed(2)),
          depth_m: Number(obb[3].toFixed(2)),
          yaw_rad: Number(obb[4].toFixed(4)),
          height_m: Number(obb[5].toFixed(2)),
          groundY_m: sampleGridHeightAt(terrainGrid, obb[0], obb[1])
        });
      }

      const bName = tags['name:ko'] || tags.name || tags['addr:housename'] || null;
      if (bName && wingObbs.length > 0 && namedBuildings.length < 90) {
        const primary = wingObbs[0];
        namedBuildings.push({
          id: `OSM_BLDG_${el.id}`,
          name: bName,
          category: tags.amenity === 'hospital' ? 'MEDICAL' : tags.amenity === 'school' || tags.building === 'school' ? 'SCHOOL' : 'URBAN_BUILDING',
          east_m: Number(centroidE.toFixed(2)),
          north_m: Number(centroidN.toFixed(2)),
          groundY_m: Number(groundY.toFixed(2)),
          width_m: Number(primary[2].toFixed(2)),
          depth_m: Number(primary[3].toFixed(2)),
          yaw_rad: Number(primary[4].toFixed(4)),
          height_m: Number(height_m.toFixed(2)),
          isTargetBuilding: false,
          priority: tags.amenity === 'hospital' || tags.building === 'public' ? 88 : Math.min(82, Math.round(45 + area * 0.015))
        });
      }
      continue;
    }

    // B) Roads & Railways
    const roadCls = classifyOsmHighway(tags);
    if (roadCls) {
      const bridgeInt = tags.bridge && tags.bridge !== 'no' ? 1 : 0;
      denseRoadNetwork.push([roadCls, bridgeInt, ptsEN.map(([e, n]) => [Number(e.toFixed(1)), Number(n.toFixed(1))])]);
      if (isWalkableOsmHighway(tags)) {
        walkableWays.push({ el, tags, rawPts });
      }
      continue;
    }

    // C) Waterways / Water Polygons
    if (tags.waterway && !tags.natural) {
      waterways.push({
        id: `WATERWAY_${el.id}`,
        name: tags['name:ko'] || tags.name || '하천',
        widthMeters: tags.waterway === 'river' ? 38.0 : 12.0,
        elevationY: sampleGridHeightAt(terrainGrid, centroidE, centroidN) - 0.6,
        provenance: VERIFICATION_STATUS.VERIFIED,
        pointsEN: ptsEN
      });
      continue;
    }

    if ((tags.natural === 'water' || tags.waterway === 'riverbank') && ptsEN.length >= 3) {
      waterPolygons.push({
        outer: ptsEN,
        holes: [],
        y: Number((sampleGridHeightAt(terrainGrid, centroidE, centroidN) - 0.45).toFixed(2))
      });
      continue;
    }

    // D) Green Areas / Open Fields / Earthquake Shelter Candidates
    const isOpenGround =
      tags.leisure === 'park' ||
      tags.leisure === 'pitch' ||
      tags.leisure === 'stadium' ||
      tags.leisure === 'playground' ||
      tags.leisure === 'recreation_ground' ||
      tags.landuse === 'grass' ||
      tags.landuse === 'recreation_ground' ||
      tags.landuse === 'village_green' ||
      tags.amenity === 'school' ||
      tags.emergency === 'assembly_point';

    if (isOpenGround && ptsEN.length >= 3) {
      const area = polygonArea2D(ptsEN);
      if (area >= 220) {
        greenPolygons.push(ptsEN);
        // Mark greenMask on terrainGrid inside polygon bbox
        const { nx, nz, halfExtentMeters: gridHalf, greenMask } = terrainGrid;
        if (greenMask && gridHalf > 0) {
          const gridSpan = gridHalf * 2;
          const iMin = Math.max(0, Math.floor(((minE + gridHalf) / gridSpan) * nx));
          const iMax = Math.min(nx, Math.ceil(((maxE + gridHalf) / gridSpan) * nx));
          const jMin = Math.max(0, Math.floor(((minN + gridHalf) / gridSpan) * nz));
          const jMax = Math.min(nz, Math.ceil(((maxN + gridHalf) / gridSpan) * nz));
          const bbox = { minE, maxE, minN, maxN };
          for (let j = jMin; j <= jMax; j++) {
            const gn = -gridHalf + (j / nz) * gridSpan;
            for (let i = iMin; i <= iMax; i++) {
              const ge = -gridHalf + (i / nx) * gridSpan;
              if (pointInsideBBox(ge, gn, bbox) && isPointInsidePolygonEN(ge, gn, ptsEN)) {
                greenMask[j * (nx + 1) + i] = 1;
              }
            }
          }
        }
      }

      if (area >= 650 && spanMeters >= 24) {
        const isExplicitAssembly = tags.emergency === 'assembly_point';
        const isPitchOrSchool = tags.leisure === 'pitch' || tags.leisure === 'stadium' || tags.amenity === 'school' || tags.leisure === 'recreation_ground';
        const label =
          tags['name:ko'] ||
          tags.name ||
          (tags.amenity === 'school' ? '인근 학교 운동장(임시 집결 후보)' :
            tags.leisure === 'pitch' ? '체육 운동장 공터' :
            isExplicitAssembly ? '지진 옥외집결지(OSM)' : '도시 개활 공원 광장');
        const capacity = Math.min(18000, Math.max(120, Math.round((area * 0.5) / 1.65)));
        shelterCandidates.push({
          id: isExplicitAssembly ? `OSM-AP-${el.id}` : `OSM-OPEN-${el.id}`,
          name: label,
          east_m: Number(centroidE.toFixed(2)),
          north_m: Number(centroidN.toFixed(2)),
          areaSqMeters: Math.round(area),
          spanMeters: Number(spanMeters.toFixed(1)),
          capacityEstimate: capacity,
          isExplicitAssembly,
          isPitchOrSchool,
          ptsEN
        });
      }
    }
  }

  // Pass 2: Also check point nodes tagged emergency=assembly_point or hospital/school
  for (const [, nd] of osmNodesById) {
    const tags = nd.tags;
    if (!tags) continue;
    if (Math.abs(nd.e) > halfExtentMeters || Math.abs(nd.n) > halfExtentMeters) continue;
    if (tags.emergency === 'assembly_point') {
      shelterCandidates.push({
        id: `OSM-AP-NODE-${nd.id}`,
        name: tags['name:ko'] || tags.name || '공식 집결표지 지점(OSM)',
        east_m: nd.e,
        north_m: nd.n,
        areaSqMeters: 2400,
        spanMeters: 48,
        capacityEstimate: 720,
        isExplicitAssembly: true,
        isPitchOrSchool: false,
        ptsEN: null
      });
    }
  }

  // Height-sort OBBs for overviewCount LOD & pack Float32Array
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

  // Build Pedestrian WalkGraph from OSM walkable ways
  const walkGraph = buildWalkGraphFromOsmWays(walkableWays, anchorLat, anchorLon, terrainGrid);

  // Evaluate & Rank Shelters using real debris clearance & connectivity to walkGraph
  const rankedShelters = rankAndFilterShelters(
    shelterCandidates,
    obbRawList,
    walkGraph,
    terrainGrid
  );

  // Guarantee at least one open safe shelter if a sparse rural query returned 0 polygon parks
  if (rankedShelters.length === 0) {
    const fallbackOpen = findNearestOpenClearancePoint(obbRawList, walkGraph, terrainGrid);
    rankedShelters.push(fallbackOpen);
  }

  // Pick a compelling, well-connected Default Origin Building near anchor (0, 0)
  const primaryShelter = rankedShelters[0];
  const defaultOrigin = pickDefaultOriginBuilding(
    namedBuildings,
    obbRawList,
    primaryShelter,
    terrainGrid
  );

  const overviewCount = Math.min(Math.max(1, obbRawList.length), Math.max(180, obbRawList.filter(b => b.height_m >= 18).length));

  const pkg = {
    metadata: {
      packageId: regionId,
      title: regionTitle,
      crs: 'LOCAL_TANGENT_ENU_WGS84',
      anchor: { lat: anchorLat, lon: anchorLon, ellipsoidalHeightMeters: terrainGrid.anchorElevationMeters || 20 },
      dataSources: [
        `Terrain: ${terrainGrid.provenance || 'Mapzen Terrarium DEM'}`,
        `Urban Massing & Walkable Sidewalks: OpenStreetMap 0.6 Live (${obbRawList.length} OBBs, ${walkGraph.edges.length} edges)`,
        `Shelters: ${rankedShelters.map(s => s.provenanceLabel || s.provenance).slice(0, 2).join(', ')}`
      ]
    },
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
        position: [primaryShelter.east_m + 180, 195, -primaryShelter.north_m + 260],
        target: [(defaultOrigin.east_m + primaryShelter.east_m) * 0.5, 4, -(defaultOrigin.north_m + primaryShelter.north_m) * 0.5],
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
    obbBuildingsFloat32: obbFloat32,
    obbGroundOffsets: groundOffsets,
    obbLodCounts: {
      overviewCount,
      fullCount: obbRawList.length,
      stride: 6
    },
    walkGraph,
    defaultOriginMeta: defaultOrigin
  };

  // Pre-build initial collision-free FacilityPackage ready for Evacuee Animation & Camera Staging
  pkg.initialFacilityPackage = buildDynamicFacilityFromPoint({
    buildingId: defaultOrigin.id,
    name: defaultOrigin.name,
    east_m: defaultOrigin.east_m,
    north_m: defaultOrigin.north_m,
    width_m: defaultOrigin.width_m,
    depth_m: defaultOrigin.depth_m,
    yaw_rad: defaultOrigin.yaw_rad,
    height_m: defaultOrigin.height_m,
    anchor: { lat: anchorLat, lon: anchorLon, h: terrainGrid.anchorElevationMeters || 20 },
    walkGraph,
    buildingOBBs: obbFloat32,
    shelter: primaryShelter,
    elevationSampler: (e, n) => sampleGridHeightAt(terrainGrid, e, n)
  });

  return pkg;
}

function buildWalkGraphFromOsmWays(walkableWays, anchorLat, anchorLon, terrainGrid) {
  const nodeIndexByOsmId = new Map();
  const nodes = [];
  const edges = [];

  const getOrAddNode = (osmId, east_m, north_m) => {
    if (nodeIndexByOsmId.has(osmId)) return nodeIndexByOsmId.get(osmId);
    const idx = nodes.length;
    const y = Number(sampleGridHeightAt(terrainGrid, east_m, north_m).toFixed(2));
    nodes.push([osmId, Number(east_m.toFixed(2)), Number(north_m.toFixed(2)), y]);
    nodeIndexByOsmId.set(osmId, idx);
    return idx;
  };

  for (const { tags, rawPts } of walkableWays) {
    const hw = String(tags.highway || 'footway');
    const hasStairs = hw === 'steps' ? 1 : 0;
    const debrisRisk = hw === 'footway' || hw === 'pedestrian' || hw === 'steps' ? 0.08 : 0.14;
    for (let i = 1; i < rawPts.length; i++) {
      const [e0, n0, id0] = rawPts[i - 1];
      const [e1, n1, id1] = rawPts[i];
      if (id0 === id1) continue;
      const dist = Math.hypot(e1 - e0, n1 - n0);
      if (dist < 0.4 || dist > 380) continue;
      const u = getOrAddNode(id0, e0, n0);
      const v = getOrAddNode(id1, e1, n1);
      edges.push([u, v, Number(dist.toFixed(2)), hw, hasStairs, debrisRisk]);
    }
  }

  // Fallback sparse orthogonal walkway grid if OSM had 0 walkable ways
  if (nodes.length < 4) {
    const step = 120;
    const gridN = 5;
    for (let r = -gridN; r <= gridN; r++) {
      for (let c = -gridN; c <= gridN; c++) {
        const e = c * step;
        const n = r * step;
        const y = Number(sampleGridHeightAt(terrainGrid, e, n).toFixed(2));
        nodes.push([`FALLBACK_${r}_${c}`, e, n, y]);
      }
    }
    const stride = gridN * 2 + 1;
    for (let r = 0; r < stride; r++) {
      for (let c = 0; c < stride; c++) {
        const u = r * stride + c;
        if (c + 1 < stride) edges.push([u, u + 1, step, 'footway', 0, 0.1]);
        if (r + 1 < stride) edges.push([u, u + stride, step, 'footway', 0, 0.1]);
      }
    }
  }

  return {
    anchor: { lat: anchorLat, lon: anchorLon },
    nodes,
    edges
  };
}

function measureShelterClearanceRadius(east_m, north_m, obbRawList) {
  let minClear = 85.0;
  for (let i = 0; i < obbRawList.length; i++) {
    const b = obbRawList[i];
    const centerDist = Math.hypot(b.east_m - east_m, b.north_m - north_m);
    const edgeClear = Math.max(0, centerDist - Math.hypot(b.width_m, b.depth_m) * 0.45);
    if (edgeClear < minClear) minClear = edgeClear;
  }
  return minClear;
}

function rankAndFilterShelters(candidates, obbRawList, walkGraph, terrainGrid) {
  const scored = [];
  for (const c of candidates) {
    const distFromCenter = Math.hypot(c.east_m, c.north_m);
    if (distFromCenter > 1150) continue;

    // Exclude candidates whose centroid sits inside a building OBB
    const insideBuilding = obbRawList.some(b => {
      const dx = c.east_m - b.east_m;
      const dn = c.north_m - b.north_m;
      const cos = Math.cos(-b.yaw_rad);
      const sin = Math.sin(-b.yaw_rad);
      const lx = Math.abs(dx * cos - dn * sin);
      const lz = Math.abs(dx * sin + dn * cos);
      return lx <= b.width_m * 0.5 + 1.5 && lz <= b.depth_m * 0.5 + 1.5;
    });
    if (insideBuilding) continue;

    const clearance = measureShelterClearanceRadius(c.east_m, c.north_m, obbRawList);
    const baseScore =
      (c.isExplicitAssembly ? 45 : 0) +
      (c.isPitchOrSchool ? 28 : 10) +
      Math.min(30, Math.sqrt(c.areaSqMeters) * 0.28) +
      Math.min(20, clearance * 0.6) -
      distFromCenter * 0.025;

    const y = sampleGridHeightAt(terrainGrid, c.east_m, c.north_m);
    const provenanceStatus = c.isExplicitAssembly
      ? VERIFICATION_STATUS.PARTIALLY_VERIFIED
      : VERIFICATION_STATUS.PROVISIONAL;
    const provenanceLabel = c.isExplicitAssembly
      ? 'OSM 지진옥외집결지 표기 (현장 점검 권장)'
      : 'OSM 개활지·학교운동장 후보 (잠정 산출)';
    const selectionReason =
      `면적 약 ${c.areaSqMeters.toLocaleString()}㎡, 인접 건축물 이격 반경 약 ${Math.round(clearance)}m의 ` +
      `${c.isExplicitAssembly ? '옥외 집결지' : c.isPitchOrSchool ? '학교/운동장 개활지' : '공원 광장'}로 ` +
      `보행로 그래프와의 접속 거리가 짧아 대피 목적지로 선정되었습니다.`;

    scored.push({
      id: c.id,
      name: c.name,
      category: scored.length === 0 ? 'PRIMARY_SHELTER' : 'REGIONAL_SHELTER',
      subtitle: `${c.isExplicitAssembly ? '옥외집결지' : '개활 안전 공터'} · 약 ${c.capacityEstimate.toLocaleString()}명 수용(추정)`,
      positionThree: [Number(c.east_m.toFixed(2)), Number(y.toFixed(2)), Number((-c.north_m).toFixed(2))],
      east_m: c.east_m,
      north_m: c.north_m,
      priority: Math.round(65 + Math.min(34, Math.max(0, baseScore * 0.4))),
      score: baseScore,
      provenance: provenanceStatus,
      provenanceLabel,
      justification: {
        id: c.id,
        areaSqMeters: c.areaSqMeters,
        capacityEstimate: c.capacityEstimate,
        clearanceRadiusMeters: Math.round(clearance),
        provenanceLabel,
        selectionReason,
        hazardCaveat: '전국 동적 OSM 추출 결과이므로, 실제 재난 시 현장 안전표지 및 붕괴 위험물을 우선 확인하십시오.'
      }
    });
  }

  scored.sort((a, b) => b.score - a.score);
  // Deduplicate close candidates (<120m apart)
  const deduped = [];
  for (const item of scored) {
    if (!deduped.some(prev => Math.hypot(prev.east_m - item.east_m, prev.north_m - item.north_m) < 120)) {
      item.category = deduped.length === 0 ? 'PRIMARY_SHELTER' : 'REGIONAL_SHELTER';
      deduped.push(item);
    }
    if (deduped.length >= 6) break;
  }
  return deduped;
}

function findNearestOpenClearancePoint(obbRawList, walkGraph, terrainGrid) {
  let best = { east_m: 140, north_m: 120, clearance: 0 };
  for (const node of walkGraph.nodes || []) {
    const [, e, n] = node;
    if (Math.hypot(e, n) < 160 || Math.hypot(e, n) > 650) continue;
    const cl = measureShelterClearanceRadius(e, n, obbRawList);
    if (cl > best.clearance) best = { east_m: e, north_m: n, clearance: cl };
  }
  const y = sampleGridHeightAt(terrainGrid, best.east_m, best.north_m);
  return {
    id: 'OSM-OPEN-AUTO',
    name: '인근 최대 이격 개활 공터(잠정)',
    category: 'PRIMARY_SHELTER',
    subtitle: '개활 대피 지점 · 현장 이격 반경 산출',
    positionThree: [best.east_m, y, -best.north_m],
    east_m: best.east_m,
    north_m: best.north_m,
    priority: 82,
    provenance: VERIFICATION_STATUS.PROVISIONAL,
    provenanceLabel: '보행망 기반 최대 이격 개활 지점(PROVISIONAL)',
    justification: {
      id: 'OSM-OPEN-AUTO',
      areaSqMeters: Math.round(Math.PI * Math.pow(Math.max(12, best.clearance), 2)),
      capacityEstimate: 450,
      clearanceRadiusMeters: Math.round(best.clearance),
      provenanceLabel: '보행망 최대 이격 산출 지점 (PROVISIONAL)',
      selectionReason: `주변 건물 밀집 구역에서 가장 먼 이격 반경(${Math.round(best.clearance)}m)의 개활 교차 지점을 대피 거점으로 자동 선정했습니다.`,
      hazardCaveat: '공식 대피소 표지 미검출 구간으로, 주변 공터·학교 운동장 확인 후 대피하십시오.'
    }
  };
}

function pickDefaultOriginBuilding(namedBuildings, obbRawList, primaryShelter, terrainGrid) {
  const candidates = namedBuildings.filter(b => {
    const dShelter = Math.hypot(b.east_m - primaryShelter.east_m, b.north_m - primaryShelter.north_m);
    const dOrigin = Math.hypot(b.east_m, b.north_m);
    return dShelter >= 140 && dShelter <= 720 && dOrigin <= 520;
  });
  candidates.sort((a, b) => Math.hypot(a.east_m, a.north_m) - Math.hypot(b.east_m, b.north_m));
  if (candidates.length > 0) return candidates[0];

  const obbFallback = obbRawList.find(b => {
    const dS = Math.hypot(b.east_m - primaryShelter.east_m, b.north_m - primaryShelter.north_m);
    return dS >= 130 && dS <= 720 && Math.hypot(b.east_m, b.north_m) <= 450 && b.width_m >= 10;
  });
  if (obbFallback) {
    return {
      id: 'ORIGIN_CENTER_BLDG',
      name: '중심부 출발 건축물',
      east_m: obbFallback.east_m,
      north_m: obbFallback.north_m,
      groundY_m: obbFallback.groundY_m,
      width_m: obbFallback.width_m,
      depth_m: obbFallback.depth_m,
      yaw_rad: obbFallback.yaw_rad,
      height_m: obbFallback.height_m
    };
  }
  const e = -120;
  const n = -90;
  return {
    id: 'ORIGIN_DEFAULT_POINT',
    name: '출발 지점(현위치)',
    east_m: e,
    north_m: n,
    groundY_m: sampleGridHeightAt(terrainGrid, e, n),
    width_m: 22,
    depth_m: 16,
    yaw_rad: 0.15,
    height_m: 16
  };
}

/**
 * Offline deterministic OSM-structured fallback for key Korean cities when network is offline.
 */
function buildOfflineBenchmarkOsmPayload(region) {
  const lat0 = region.lat;
  const lon0 = region.lon;
  const toNodeLatLon = (e, n) => localENUToLatLon(e, n, lat0, lon0);

  const elements = [];
  let nextId = 100000;
  const pushPolyWay = (ptsEN, tags) => {
    const nodeIds = [];
    for (const [e, n] of ptsEN) {
      const ll = toNodeLatLon(e, n);
      const nid = nextId++;
      elements.push({ type: 'node', id: nid, lat: ll.lat, lon: ll.lon });
      nodeIds.push(nid);
    }
    nodeIds.push(nodeIds[0]);
    const wid = nextId++;
    elements.push({ type: 'way', id: wid, nodes: nodeIds, tags });
  };
  const pushLineWay = (ptsEN, tags) => {
    const nodeIds = [];
    for (const [e, n] of ptsEN) {
      const ll = toNodeLatLon(e, n);
      const nid = nextId++;
      elements.push({ type: 'node', id: nid, lat: ll.lat, lon: ll.lon });
      nodeIds.push(nid);
    }
    const wid = nextId++;
    elements.push({ type: 'way', id: wid, nodes: nodeIds, tags });
  };

  // Street grid + diagonal pedestrian connectors
  const xs = [-420, -240, -80, 90, 260, 420];
  const ys = [-360, -180, 0, 180, 360];
  for (let yi = 0; yi < ys.length; yi++) {
    const hw = ys[yi] === 0 ? 'primary' : Math.abs(ys[yi]) === 180 ? 'secondary' : 'footway';
    pushLineWay(xs.map(x => [x, ys[yi]]), { highway: hw });
  }
  for (let xi = 0; xi < xs.length; xi++) {
    const hw = xs[xi] === 90 ? 'secondary' : 'footway';
    pushLineWay(ys.map(y => [xs[xi], y]), { highway: hw });
  }

  // City blocks leaving central avenues + shelter plaza open
  const blockCenters = [
    [-160, -90, 62, 34, 18, `${region.shortName} 중심 상업동`],
    [-160, 90, 54, 42, 14, `${region.shortName} 주거 블록 A`],
    [10, -90, 68, 36, 22, `${region.shortName} 공용 청사`],
    [10, 90, 58, 38, 16, `${region.shortName} 문화 회관`],
    [175, -270, 56, 36, 24, `${region.shortName} 아파트 A동`],
    [-320, -90, 64, 44, 12, `${region.shortName} 서측 블록`]
  ];
  for (const [cx, cy, w, d, h, name] of blockCenters) {
    const hw = w * 0.5;
    const hd = d * 0.5;
    pushPolyWay([[cx - hw, cy - hd], [cx + hw, cy - hd], [cx + hw, cy + hd], [cx - hw, cy + hd]], {
      building: 'yes',
      height: String(h),
      name
    });
  }

  // Open ground / park shelter polygon at (+260, +180) area centered (+220, +90)
  pushPolyWay(
    [[145, 25], [295, 25], [295, 165], [145, 165]],
    {
      leisure: 'pitch',
      emergency: 'assembly_point',
      name: `${region.shortName} 중앙 대피광장·운동장`
    }
  );

  return { elements };
}

/**
 * Unified Regional Spatial Loader for all of South Korea.
 * Instantly returns Hanyang's verified 4km package near Hanyang;
 * otherwise fetches live AWS Terrarium DEM + OSM 0.6 urban map & shelters.
 */
export async function loadRegionalSpatialPackage(lat, lon, opts = {}) {
  const distToHanyang = distanceMetersLatLon(lat, lon, 37.555815, 127.045053);
  if (distToHanyang < 2200 || opts.regionId === 'seoul_hanyang') {
    const hanyangRegion = KOREA_BENCHMARK_REGIONS[0];
    return {
      ...HANYANG_LOCAL_4KM_PACKAGE,
      walkGraph: HANYANG_CAMPUS_WALK_GRAPH,
      defaultOriginMeta: {
        id: 'BLDG_212',
        name: '제1공학관 (212동)',
        east_m: 44.36,
        north_m: 112.16,
        height_m: 26.0
      },
      shelterJustifications: HANYANG_SHELTER_JUSTIFICATION,
      regionInfo: hanyangRegion,
      isHanyangNative: true
    };
  }

  const matchedBenchmark =
    KOREA_BENCHMARK_REGIONS.find(r => r.id === opts.regionId) ||
    KOREA_BENCHMARK_REGIONS.find(r => distanceMetersLatLon(lat, lon, r.lat, r.lon) < 4000) || {
      id: opts.regionId || `KR_${lat.toFixed(3)}_${lon.toFixed(3)}`,
      name: opts.name || `대한민국 (${lat.toFixed(4)}°N, ${lon.toFixed(4)}°E)`,
      shortName: opts.shortName || opts.name || '선택 지역',
      lat,
      lon,
      isHanyangDefault: false,
      scenarioEvent: {
        id: `DYNAMIC-KR-${lat.toFixed(2)}`,
        title: `${opts.shortName || opts.name || '선택 지역'} 지진 감응 · 국지 3D 대피 경로`,
        epicenterLat: lat + 0.11,
        epicenterLon: lon + 0.14,
        originText: `${opts.shortName || '현장'} 북동측 약 17.5km 인근 단층 시나리오`,
        magnitudeText: 'M5.2 (국지 대응 가정)',
        depthText: '진원 깊이 10km (가정)',
        distanceKm: 17.5,
        azimuthDeg: 45.0,
        pArrivalSec: 2.9,
        sArrivalSec: 5.0
      }
    };

  const dLat = 0.0065; // ~720m half-span -> 1.44km N-S (compact, fast <1.5s, under OSM limits)
  const dLon = 0.0080; // ~720m half-span -> 1.44km E-W
  const bbox = `${(lon - dLon).toFixed(5)},${(lat - dLat).toFixed(5)},${(lon + dLon).toFixed(5)},${(lat + dLat).toFixed(5)}`;

  const demPromise = fetchTerrariumTerrainGrid(lat, lon, { halfExtentMeters: 1400.0, nx: 64, nz: 64 });
  const osmPromise = (async () => {
    if (typeof fetch !== 'function' || opts.offlineOnly) return null;
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 5500);
      const res = await fetch(`https://api.openstreetmap.org/api/0.6/map.json?bbox=${bbox}`, {
        mode: 'cors',
        signal: controller.signal
      });
      clearTimeout(timer);
      if (!res.ok) return null;
      const json = await res.json();
      if (!json || !Array.isArray(json.elements) || json.elements.length === 0) return null;
      return json;
    } catch (_) {
      return null;
    }
  })();

  const [terrainGrid, liveOsmJson] = await Promise.all([demPromise, osmPromise]);
  const osmJson = liveOsmJson || buildOfflineBenchmarkOsmPayload(matchedBenchmark);
  const usedFallback = !liveOsmJson;

  const pkg = compileOsmJsonToSpatialPackage(osmJson, {
    lat,
    lon,
    regionId: matchedBenchmark.id,
    title: `${matchedBenchmark.name} 국지 3D 대피 패키지`,
    halfExtentMeters: 1400.0,
    terrainGrid
  });

  if (usedFallback) {
    pkg.metadata.dataSources.push('OSM 실시간 네트워크 미연결로 기준 권역 표준 격자 모델을 표시합니다.');
  }
  pkg.regionInfo = matchedBenchmark;
  pkg.isHanyangNative = false;
  pkg.usedOsmFallback = usedFallback;
  return pkg;
}
