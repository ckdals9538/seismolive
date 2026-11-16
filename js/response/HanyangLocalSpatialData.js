// ============================================================================
// SEISMOLIVE v4.0 — Pre-Built 4km Seongdong / Hanyang Local Spatial Data Package
// File: js/response/HanyangLocalSpatialData.js
//
// Strategy C Local Spatial Package:
//   Zero runtime Overpass/DEM API dependencies. All 4km x 4km coordinates are
//   pre-projected in the WGS84 Local Tangent ENU frame anchored at
//   HANYANG_BLDG212_ANCHOR (lat 37.555815, lon 127.045053, h 42.0m):
//     Three.js X = +East (m), Y = +Up (m), Z = -North (m).
//
// Strict Provenance Demarcation:
//   - VERIFIED: Official/OSM exterior footprints, road arteries, river axes
//   - PARTIALLY_VERIFIED: Shelter capacity / approach routes pending field check
//   - PROVISIONAL: Indoor floorplans, subsurface alluvial amplification caution zones
// ============================================================================

import { VERIFICATION_STATUS } from './ResponseDomainTypes.js';

export const OBB_BUILDING_STRIDE = 6; // [east_m, north_m, width_m, depth_m, yaw_rad, height_m]

export const HANYANG_LOCAL_SPATIAL_METADATA = Object.freeze({
  packageId: 'HYU_SEONGDONG_4KM_LOCAL_V1',
  title: '성동구·한양대학교 반경 4km 국지 지진 대응 공간 패키지',
  crs: 'LOCAL_TANGENT_ENU_WGS84',
  anchor: Object.freeze({
    lat: 37.555815,
    lon: 127.045053,
    ellipsoidalHeightMeters: 42.0
  }),
  extentMeters: Object.freeze({
    halfWidthEast: 2000,
    halfDepthNorth: 2000,
    width: 4000,
    height: 4000
  }),
  dataSources: Object.freeze([
    'NGII / VWorld 국토지형 기반 성동-한양 구릉-충적 단면 고도 프로파일 (참조)',
    'OpenStreetMap 성동구 간선도로 · 중랑천/청계천 수계 · 주변 건축물 외곽 풋프린트',
    '행정안전부 지정 옥외 지진대피장소 OA-21060 한양대학교 대운동장 및 인근 공원·응급거점'
  ])
});

export const HANYANG_LOCAL_SPATIAL_VIEWPOINTS = Object.freeze({
  LOCAL_4KM_OVERVIEW: Object.freeze({
    position: Object.freeze([280.0, 920.0, 520.0]),
    target: Object.freeze([120.0, -10.0, 80.0]),
    near: 0.5,
    far: 5500.0,
    description: '성동·한양 4km 로컬 공간 통합 뷰: 지형·수계·도로·대피소·주변 도시 맥락'
  }),
  REGIONAL_APPROACH: Object.freeze({
    position: Object.freeze([280.0, 920.0, 520.0]),
    target: Object.freeze([120.0, -10.0, 80.0]),
    near: 0.5,
    far: 5500.0,
    description: '성동·한양 4km 로컬 공간 접근 궤도'
  })
});

/**
 * Topographic elevation contours, Jungnangcheon/Cheonggyecheon waterways,
 * and PROVISIONAL alluvial basin caution zone.
 */
export const TERRAIN_AND_HYDROLOGY_ZONES = Object.freeze({
  hillslopeContours: Object.freeze([
    Object.freeze({
      id: 'CONTOUR_60M_ENGINEERING_RIDGE',
      elevationAslMeters: 60.0,
      relativeY: 16.0,
      provenance: VERIFICATION_STATUS.VERIFIED,
      pointsENU: Object.freeze([
        [-110, 125], [-40, 145], [55, 130], [115, 75], [95, 10],
        [35, -30], [-65, -20], [-125, 45], [-110, 125]
      ])
    }),
    Object.freeze({
      id: 'CONTOUR_48M_CAMPUS_CORE',
      elevationAslMeters: 48.0,
      relativeY: 5.0,
      provenance: VERIFICATION_STATUS.VERIFIED,
      pointsENU: Object.freeze([
        [-220, 210], [-90, 250], [140, 225], [245, 120], [220, -45],
        [105, -135], [-110, -120], [-240, 25], [-220, 210]
      ])
    }),
    Object.freeze({
      id: 'CONTOUR_36M_VALLEY_TERRACE',
      elevationAslMeters: 36.0,
      relativeY: -8.0,
      provenance: VERIFICATION_STATUS.VERIFIED,
      pointsENU: Object.freeze([
        [-420, 310], [-180, 410], [260, 380], [430, 180], [390, -190],
        [210, -340], [-190, -330], [-450, -80], [-420, 310]
      ])
    })
  ]),
  waterways: Object.freeze([
    Object.freeze({
      id: 'JUNGNANGCHEON_MAIN',
      name: '중랑천 수계 (Jungnangcheon)',
      widthMeters: 64.0,
      elevationY: -17.5,
      provenance: VERIFICATION_STATUS.VERIFIED,
      // [east_m, north_m] coordinates tracing SW-NE along eastern/southern Seongdong plain
      pointsEN: Object.freeze([
        [-1550, -1450], [-1120, -1210], [-680, -980], [-150, -820],
        [420, -760], [880, -540], [1240, -180], [1460, 420], [1620, 1250]
      ])
    }),
    Object.freeze({
      id: 'CHEONGGYECHEON_CONFLUENCE',
      name: '청계천 합류부',
      widthMeters: 34.0,
      elevationY: -17.0,
      provenance: VERIFICATION_STATUS.VERIFIED,
      pointsEN: Object.freeze([
        [-1650, 320], [-1100, 180], [-540, 20], [120, -320], [640, -680]
      ])
    })
  ]),
  alluvialCautionZone: Object.freeze({
    id: 'ALLUVIAL_AMPLIFICATION_CAUTION_SALGOJI',
    name: '살곶이·중랑천 충적 저지대 (지반 증폭 주의 잠정 구역)',
    elevationY: -15.8,
    verificationStatus: VERIFICATION_STATUS.PROVISIONAL,
    caveat: '하천 변 충적 퇴적 저지대 지형이며, 시추·Vs30 실측 전까지 잠정 주의(PROVISIONAL) 구역으로 구분됩니다.',
    polygonEN: Object.freeze([
      [-320, -560], [520, -520], [920, -280], [880, -740], [380, -960], [-360, -940], [-320, -560]
    ])
  })
});

/**
 * Hierarchical 4km Local Road Network (Arterial vs Collector)
 */
export const LOCAL_ROAD_NETWORK = Object.freeze([
  Object.freeze({
    id: 'ROAD_WANGSIMNI_RO',
    name: '왕십리로 (Wangsimni-ro)',
    hierarchy: 'ARTERIAL',
    widthMeters: 28.0,
    elevationY: -11.5,
    provenance: VERIFICATION_STATUS.VERIFIED,
    pointsEN: Object.freeze([
      [-1500, 390], [-850, 310], [-280, 280], [340, 350], [980, 520], [1560, 740]
    ])
  }),
  Object.freeze({
    id: 'ROAD_GOSANJA_RO',
    name: '고산자로 (Gosanja-ro)',
    hierarchy: 'ARTERIAL',
    widthMeters: 26.0,
    elevationY: -11.8,
    provenance: VERIFICATION_STATUS.VERIFIED,
    pointsEN: Object.freeze([
      [-420, 1480], [-340, 820], [-260, 280], [-210, -280], [-140, -860], [-40, -1480]
    ])
  }),
  Object.freeze({
    id: 'ROAD_SALGOJI_GIL',
    name: '살곶이길 (Salgoji-gil)',
    hierarchy: 'ARTERIAL',
    widthMeters: 24.0,
    elevationY: -13.2,
    provenance: VERIFICATION_STATUS.VERIFIED,
    pointsEN: Object.freeze([
      [-480, -340], [80, -390], [490, -450], [980, -310], [1480, -40]
    ])
  }),
  Object.freeze({
    id: 'ROAD_MAJO_RO',
    name: '마조로 (Majo-ro)',
    hierarchy: 'COLLECTOR',
    widthMeters: 16.0,
    elevationY: -6.0,
    provenance: VERIFICATION_STATUS.VERIFIED,
    pointsEN: Object.freeze([
      [-460, 560], [-120, 420], [140, 340], [360, 210], [520, -20]
    ])
  }),
  Object.freeze({
    id: 'ROAD_HANYANG_DAEHAK_RO',
    name: '한양대학로 (Hanyangdaehak-ro)',
    hierarchy: 'COLLECTOR',
    widthMeters: 12.0,
    elevationY: -7.5,
    provenance: VERIFICATION_STATUS.VERIFIED,
    pointsEN: Object.freeze([
      [-120, 340], [-15, 195], [10, 20], [105, -25], [205, -155]
    ])
  })
]);

/**
 * Official Outdoor Shelters & Critical Civil Defense / Medical Facilities
 */
export const OFFICIAL_SHELTERS_AND_FACILITIES = Object.freeze([
  Object.freeze({
    id: 'OA-21060',
    name: '한양대 대운동장',
    category: 'PRIMARY_SHELTER',
    subtitle: '지진옥외대피장소 · 7,425명 수용(추정)',
    positionThree: Object.freeze([226.75, -13.50, 218.17]), // East=+226.75, North=-218.17
    east_m: 226.75,
    north_m: -218.17,
    priority: 96,
    provenance: VERIFICATION_STATUS.PARTIALLY_VERIFIED
  }),
  Object.freeze({
    id: 'MED-HYU-01',
    name: '한양대학교병원',
    category: 'MEDICAL_CENTER',
    subtitle: '권역응급거점 · 접근로 현장미검증',
    positionThree: Object.freeze([320.0, -3.5, -195.0]),
    east_m: 320.0,
    north_m: 195.0,
    priority: 88,
    provenance: VERIFICATION_STATUS.PARTIALLY_VERIFIED
  }),
  Object.freeze({
    id: 'EOC-SD-01',
    name: '성동구청 대책본부',
    category: 'CIVIL_DEFENSE_EOC',
    subtitle: '성동구 재난안전대책본부',
    positionThree: Object.freeze([-220.0, -11.5, -560.0]),
    east_m: -220.0,
    north_m: 560.0,
    priority: 84,
    provenance: VERIFICATION_STATUS.VERIFIED
  }),
  Object.freeze({
    id: 'OA-21061',
    name: '살곶이체육공원',
    category: 'REGIONAL_SHELTER',
    subtitle: '광역 지진옥외대피장소',
    positionThree: Object.freeze([620.0, -15.5, 580.0]),
    east_m: 620.0,
    north_m: -580.0,
    priority: 79,
    provenance: VERIFICATION_STATUS.PARTIALLY_VERIFIED
  }),
  Object.freeze({
    id: 'OA-21062',
    name: '서울숲 광장',
    category: 'REGIONAL_SHELTER',
    subtitle: '성동권 광역집결지',
    positionThree: Object.freeze([-980.0, -16.5, 1180.0]),
    east_m: -980.0,
    north_m: -1180.0,
    priority: 74,
    provenance: VERIFICATION_STATUS.PARTIALLY_VERIFIED
  })
]);

/**
 * Authoritative Named Campus & Surrounding District Context Buildings
 * Note: BLDG_212 (제1공학관) is marked isTargetBuilding=true and rendered separately
 * by HanyangResponseAdapter with bright #f8fafc structural outlines and 3F PROVISIONAL indoor detail.
 */
export const NAMED_CONTEXT_BUILDINGS = Object.freeze([
  Object.freeze({
    id: 'BLDG_212_ENG1',
    name: '제1공학관 (212동)',
    category: 'TARGET_BUILDING',
    east_m: 52.0,
    north_m: 74.0, // maps to Z = -74.0 in Three.js
    groundY_m: 0.0,
    width_m: 66.0,
    depth_m: 26.0,
    yaw_rad: 0.52,
    height_m: 21.5,
    isTargetBuilding: true,
    priority: 100,
    exteriorVerification: VERIFICATION_STATUS.VERIFIED,
    indoorVerification: VERIFICATION_STATUS.PROVISIONAL
  }),
  Object.freeze({ id: 'CTX_ENG2', name: '제2공학관', category: 'CAMPUS_CONTEXT', east_m: -55, north_m: 115, groundY_m: 0.5, width_m: 52, depth_m: 24, yaw_rad: 0.45, height_m: 24, isTargetBuilding: false, priority: 66, exteriorVerification: VERIFICATION_STATUS.VERIFIED, indoorVerification: VERIFICATION_STATUS.PROVISIONAL }),
  Object.freeze({ id: 'CTX_HIT', name: 'HIT 종합기술연구원', category: 'CAMPUS_CONTEXT', east_m: -95, north_m: 210, groundY_m: -1.5, width_m: 56, depth_m: 38, yaw_rad: 0.12, height_m: 44, isTargetBuilding: false, priority: 72, exteriorVerification: VERIFICATION_STATUS.VERIFIED, indoorVerification: VERIFICATION_STATUS.PROVISIONAL }),
  Object.freeze({ id: 'CTX_ITBT', name: 'IT·BT관', category: 'CAMPUS_CONTEXT', east_m: 145, north_m: 145, groundY_m: 1.0, width_m: 48, depth_m: 28, yaw_rad: -0.25, height_m: 42, isTargetBuilding: false, priority: 68, exteriorVerification: VERIFICATION_STATUS.VERIFIED, indoorVerification: VERIFICATION_STATUS.PROVISIONAL }),
  Object.freeze({ id: 'CTX_MAT', name: '신소재공학관', category: 'CAMPUS_CONTEXT', east_m: 110, north_m: -10, groundY_m: -4.0, width_m: 46, depth_m: 24, yaw_rad: 0.50, height_m: 28, isTargetBuilding: false, priority: 60, exteriorVerification: VERIFICATION_STATUS.VERIFIED, indoorVerification: VERIFICATION_STATUS.PROVISIONAL }),
  Object.freeze({ id: 'CTX_PAIKNAM', name: '백남학술정보관', category: 'CAMPUS_CONTEXT', east_m: -35, north_m: -75, groundY_m: -5.5, width_m: 50, depth_m: 34, yaw_rad: 0.18, height_m: 30, isTargetBuilding: false, priority: 65, exteriorVerification: VERIFICATION_STATUS.VERIFIED, indoorVerification: VERIFICATION_STATUS.PROVISIONAL }),
  Object.freeze({ id: 'CTX_ADMIN', name: '본관(신본관)', category: 'CAMPUS_CONTEXT', east_m: 5, north_m: -165, groundY_m: -7.5, width_m: 54, depth_m: 24, yaw_rad: 0.08, height_m: 26, isTargetBuilding: false, priority: 58, exteriorVerification: VERIFICATION_STATUS.VERIFIED, indoorVerification: VERIFICATION_STATUS.PROVISIONAL }),
  Object.freeze({ id: 'CTX_OLYMPIC', name: '올림픽체육관', category: 'CAMPUS_CONTEXT', east_m: 365, north_m: -240, groundY_m: -12.0, width_m: 72, depth_m: 54, yaw_rad: -0.30, height_m: 22, isTargetBuilding: false, priority: 64, exteriorVerification: VERIFICATION_STATUS.VERIFIED, indoorVerification: VERIFICATION_STATUS.PROVISIONAL }),
  Object.freeze({ id: 'CTX_HYUHOSP_MAIN', name: '한양대병원 본관', category: 'MEDICAL_CONTEXT', east_m: 325, north_m: 205, groundY_m: -3.5, width_m: 78, depth_m: 46, yaw_rad: 0.22, height_m: 68, isTargetBuilding: false, priority: 70, exteriorVerification: VERIFICATION_STATUS.VERIFIED, indoorVerification: VERIFICATION_STATUS.PROVISIONAL }),
  Object.freeze({ id: 'CTX_WANGSIMNI_STN', name: '왕십리역 복합역사', category: 'URBAN_CONTEXT', east_m: -390, north_m: 480, groundY_m: -11.5, width_m: 115, depth_m: 62, yaw_rad: 0.35, height_m: 52, isTargetBuilding: false, priority: 69, exteriorVerification: VERIFICATION_STATUS.VERIFIED, indoorVerification: VERIFICATION_STATUS.PROVISIONAL }),
  Object.freeze({ id: 'CTX_SEONGDONG_GOV', name: '성동구청사', category: 'CIVIC_CONTEXT', east_m: -225, north_m: 565, groundY_m: -11.5, width_m: 68, depth_m: 44, yaw_rad: -0.10, height_m: 48, isTargetBuilding: false, priority: 67, exteriorVerification: VERIFICATION_STATUS.VERIFIED, indoorVerification: VERIFICATION_STATUS.PROVISIONAL }),
  Object.freeze({ id: 'CTX_HAENGDANG_APT_W', name: '행당동 주거블록 A', category: 'URBAN_CONTEXT', east_m: -620, north_m: 160, groundY_m: -10.5, width_m: 62, depth_m: 22, yaw_rad: 0.28, height_m: 62, isTargetBuilding: false, priority: 52, exteriorVerification: VERIFICATION_STATUS.VERIFIED, indoorVerification: VERIFICATION_STATUS.PROVISIONAL }),
  Object.freeze({ id: 'CTX_MAJANG_COMPLEX', name: '마장동 복합블록', category: 'URBAN_CONTEXT', east_m: 440, north_m: 640, groundY_m: -12.0, width_m: 68, depth_m: 28, yaw_rad: -0.18, height_m: 54, isTargetBuilding: false, priority: 50, exteriorVerification: VERIFICATION_STATUS.VERIFIED, indoorVerification: VERIFICATION_STATUS.PROVISIONAL })
]);

// Deterministic PRNG for procedural surrounding urban massing outside Building 212 & Stadium
function mulberry32(seed) {
  let a = seed >>> 0;
  return function() {
    a |= 0;
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function isExcludedClearanceZone(east_m, north_m) {
  // 1. Exclude Building 212 (제1공학관) footprint + egress connector buffer
  if (east_m > -15 && east_m < 130 && north_m > 10 && north_m < 145) {
    return true;
  }
  // 2. Exclude Hanyang Main Stadium (OA-21060) track & field envelope (Three.js z ~ +218 -> north ~ -218)
  if (east_m > 130 && east_m < 330 && north_m > -340 && north_m < -105) {
    return true;
  }
  // 3. Exclude evacuation route spine clearance (east: 55..235, north: -200..45)
  if (east_m > 55 && east_m < 235 && north_m > -200 && north_m < 45) {
    return true;
  }
  // 4. Keep center of Jungnangcheon river channel open
  if (Math.abs(north_m - (-760 + Math.max(0, east_m - 200) * 0.65)) < 85 && east_m > -600 && east_m < 1300) {
    return true;
  }
  return false;
}

/**
 * Build height-sorted 6-float32 OBB TypedArray across 4km x 4km Seongdong/Hanyang extent.
 * Stride = 6 floats: [east_m, north_m, width_m, depth_m, yaw_rad, height_m].
 * Strictly sorted descending by height_m so overviewCount slices tallest skyline structures first.
 */
function buildHeightSortedContextBuildings() {
  const raw = [];

  // 1. Add all non-target named context buildings
  for (const b of NAMED_CONTEXT_BUILDINGS) {
    if (b.isTargetBuilding) continue;
    raw.push({
      east_m: b.east_m,
      north_m: b.north_m,
      width_m: b.width_m,
      depth_m: b.depth_m,
      yaw_rad: b.yaw_rad,
      height_m: b.height_m,
      groundY_m: b.groundY_m
    });
  }

  // 2. Populate deterministic Seongdong/Wangsimni/Haengdang urban blocks up to ~4km envelope
  const rand = mulberry32(20260401);
  const rings = [
    { count: 48, minR: 220, maxR: 580, minH: 14, maxH: 38 },
    { count: 68, minR: 580, maxR: 1120, minH: 16, maxH: 64 },
    { count: 60, minR: 1120, maxR: 1680, minH: 18, maxH: 76 }
  ];

  for (const ring of rings) {
    let placed = 0;
    let attempts = 0;
    while (placed < ring.count && attempts < ring.count * 6) {
      attempts++;
      const angle = (placed / ring.count) * Math.PI * 2 + (rand() - 0.5) * 0.35;
      const radius = ring.minR + rand() * (ring.maxR - ring.minR);
      const east_m = Number((Math.cos(angle) * radius + 40.0).toFixed(1));
      const north_m = Number((Math.sin(angle) * radius).toFixed(1));

      if (isExcludedClearanceZone(east_m, north_m)) continue;

      const width_m = Number((22 + rand() * 38).toFixed(1));
      const depth_m = Number((16 + rand() * 24).toFixed(1));
      const yaw_rad = Number(((rand() - 0.5) * 1.1).toFixed(3));
      const height_m = Number((ring.minH + rand() * (ring.maxH - ring.minH)).toFixed(1));

      raw.push({ east_m, north_m, width_m, depth_m, yaw_rad, height_m, groundY_m: -12.0 });
      placed++;
    }
  }

  // Height-priority sort (tallest buildings first for overviewCount LOD)
  raw.sort((a, b) => b.height_m - a.height_m);

  const float32 = new Float32Array(raw.length * OBB_BUILDING_STRIDE);
  const groundOffsets = new Float32Array(raw.length);
  for (let i = 0; i < raw.length; i++) {
    const b = raw[i];
    const base = i * OBB_BUILDING_STRIDE;
    float32[base + 0] = b.east_m;
    float32[base + 1] = b.north_m;
    float32[base + 2] = b.width_m;
    float32[base + 3] = b.depth_m;
    float32[base + 4] = b.yaw_rad;
    float32[base + 5] = b.height_m;
    groundOffsets[i] = b.groundY_m ?? -12.0;
  }

  const overviewCount = Math.min(72, Math.max(12, raw.filter(b => b.height_m >= 38.0).length));

  return {
    float32,
    groundOffsets,
    overviewCount,
    fullCount: raw.length
  };
}

const builtBuildings = buildHeightSortedContextBuildings();

export const OBB_CONTEXT_BUILDINGS_FLOAT32 = builtBuildings.float32;
export const OBB_CONTEXT_GROUND_OFFSETS = builtBuildings.groundOffsets;
export const OBB_LOD_COUNTS = Object.freeze({
  overviewCount: builtBuildings.overviewCount,
  fullCount: builtBuildings.fullCount,
  stride: OBB_BUILDING_STRIDE
});

/**
 * Complete Pre-Built 4km Spatial Data Package (Strategy C)
 */
export const HANYANG_LOCAL_4KM_PACKAGE = Object.freeze({
  metadata: HANYANG_LOCAL_SPATIAL_METADATA,
  viewpoints: HANYANG_LOCAL_SPATIAL_VIEWPOINTS,
  terrainAndHydrology: TERRAIN_AND_HYDROLOGY_ZONES,
  roadNetwork: LOCAL_ROAD_NETWORK,
  sheltersAndFacilities: OFFICIAL_SHELTERS_AND_FACILITIES,
  namedBuildings: NAMED_CONTEXT_BUILDINGS,
  obbBuildingsFloat32: OBB_CONTEXT_BUILDINGS_FLOAT32,
  obbGroundOffsets: OBB_CONTEXT_GROUND_OFFSETS,
  obbLodCounts: OBB_LOD_COUNTS
});

/**
 * Export serializable plain-JSON snapshot for static asset archival
 */
export function serializeHanyangLocal4kmJSON() {
  return {
    metadata: HANYANG_LOCAL_SPATIAL_METADATA,
    viewpoints: HANYANG_LOCAL_SPATIAL_VIEWPOINTS,
    terrainAndHydrology: TERRAIN_AND_HYDROLOGY_ZONES,
    roadNetwork: LOCAL_ROAD_NETWORK,
    sheltersAndFacilities: OFFICIAL_SHELTERS_AND_FACILITIES,
    namedBuildings: NAMED_CONTEXT_BUILDINGS,
    obbBuildings: {
      stride: OBB_BUILDING_STRIDE,
      fields: ['east_m', 'north_m', 'width_m', 'depth_m', 'yaw_rad', 'height_m'],
      lodCounts: OBB_LOD_COUNTS,
      data: Array.from(OBB_CONTEXT_BUILDINGS_FLOAT32, v => Number(v.toFixed(3)))
    }
  };
}
