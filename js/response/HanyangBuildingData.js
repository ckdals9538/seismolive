// ============================================================================
// SEISMOLIVE v4.0 — Hanyang Single-Building & Campus Pedestrian Dataset
// File: js/response/HanyangBuildingData.js
//
// Authoritative dataset for Hanyang University Engineering Bldg 1 (제1공학관),
// 3F provisional indoor space graph, explicit 1F SE connector, and campus pedestrian network.
//
// Adheres strictly to scientific provenance, anti-game-VFX standards,
// and zero-fake structural prediction principles.
// ============================================================================

export const DATA_PROVENANCE_SOURCE = Object.freeze({
  OBSERVED_STATION: 'OBSERVED_STATION',             // 실측 관측소 계측 파형 (PGA/PGV)
  SIMULATED_SCENARIO: 'SIMULATED_SCENARIO',         // 시연 및 훈련용 가상 시나리오 입력치 (DEMO / DRILL)
  OFFICIAL_DISASTER_INFO: 'OFFICIAL_DISASTER_INFO', // 정부/기상청/행안부 공식 긴급재난문자
  USER_FIELD_REPORT: 'USER_FIELD_REPORT',           // 사용자의 실시간 현장 보고 (화재, 가스, 문틀 뒤틀림 등)
  ESTIMATED_PROVISIONAL: 'ESTIMATED_PROVISIONAL'    // 도면 비공개로 인한 표준 규격(ISO 23601) 기반 잠정 추정치
});

export const VERIFICATION_STATUS = Object.freeze({
  VERIFIED: 'VERIFIED',
  PARTIALLY_VERIFIED: 'PARTIALLY_VERIFIED',
  PROVISIONAL: 'PROVISIONAL',
  UNAVAILABLE: 'UNAVAILABLE',
  RESTRICTED: 'RESTRICTED',
  REJECTED: 'REJECTED'
});

export const HANYANG_BUILDING_METADATA = Object.freeze({
  id: 'BLDG_212_ENG1',
  name: '한양대학교 제1공학관 (Engineering Building 1)',
  unitNumber: '212',
  address: '서울특별시 성동구 왕십리로 222 (행당동 17번지)',
  pnu: '1120010700100170000',
  bdMgtSn: '1120010700100170000000000', // PNU 19자리 + 건물번호 (PARTIALLY_VERIFIED)
  structureType: '철근콘크리트구조 (Reinforced Concrete)',
  levels: Object.freeze({
    aboveGround: 5,
    underground: 0
  }),
  anchorCoordinates: Object.freeze({
    lat: 37.555815,
    lon: 127.045053,
    ellipsoidalHeightMeters: 42.0
  }),
  seismicAttributes: Object.freeze({
    designApplied: null, // Pending live EAIS API key query
    abilityCode: null,
    approvalDate: '1960s (수차례 증개축 및 내진보강 이력 확인 필요)',
    provenance: VERIFICATION_STATUS.PARTIALLY_VERIFIED
  }),
  osmReference: Object.freeze({
    wayId: '187181237',
    perimeterNodeCount: 12,
    provenance: VERIFICATION_STATUS.VERIFIED
  })
});

/**
 * 3F Provisional Indoor Spatial Graph (Classrooms, Corridor, Stairwell)
 * Classified strictly as PROVISIONAL until on-site ISO 23601 photo survey F-01 is executed.
 */
export const HANYANG_3F_INDOOR_GRAPH = Object.freeze({
  floorId: 'FLOOR_3F',
  levelIndex: 3,
  elevationOffsetMeters: 7.2, // ~3.6m per floor level
  provenance: VERIFICATION_STATUS.PROVISIONAL,
  rooms: Object.freeze([
    {
      roomId: 'ROOM_301',
      name: '301호 대형강의실',
      type: 'LECTURE_HALL',
      capacity: 80,
      centerLocalPos: Object.freeze([-15.0, 7.2, 5.0]), // Local ENU meters [X=East, Y=Up, Z=-North]
      nodeId: 'NODE_ROOM_301',
      provenance: VERIFICATION_STATUS.PROVISIONAL
    },
    {
      roomId: 'ROOM_302',
      name: '302호 전산실습실',
      type: 'COMPUTER_LAB',
      capacity: 40,
      centerLocalPos: Object.freeze([-5.0, 7.2, 5.0]),
      nodeId: 'NODE_ROOM_302',
      provenance: VERIFICATION_STATUS.PROVISIONAL
    },
    {
      roomId: 'ROOM_303',
      name: '303호 지진공학연구실',
      type: 'RESEARCH_LAB',
      capacity: 15,
      centerLocalPos: Object.freeze([5.0, 7.2, 5.0]),
      nodeId: 'NODE_ROOM_303',
      provenance: VERIFICATION_STATUS.PROVISIONAL
    }
  ]),
  corridors: Object.freeze([
    {
      corridorId: 'CORRIDOR_3F_MAIN',
      widthMeters: 2.40,
      clearHeightMeters: 2.70,
      centerlineNodes: Object.freeze(['NODE_CORR_3F_W', 'NODE_CORR_3F_C', 'NODE_CORR_3F_E'])
    }
  ]),
  stairwells: Object.freeze([
    {
      stairwellId: 'STAIRWELL_3F_SE',
      name: '남동측 주 피난계단실 (SE Core)',
      landingNodeId: 'NODE_STAIR_3F_SE',
      localPos: Object.freeze([12.4, 7.2, -4.2]),
      hasFireDoor: true,
      fireDoorClearWidthMeters: 1.20,
      provenance: VERIFICATION_STATUS.PROVISIONAL
    }
  ])
});

/**
 * 1F Indoor Egress & Landing Graph
 */
export const HANYANG_1F_INDOOR_GRAPH = Object.freeze({
  floorId: 'FLOOR_1F',
  levelIndex: 1,
  elevationOffsetMeters: 0.0,
  provenance: VERIFICATION_STATUS.PROVISIONAL,
  stairwells: Object.freeze([
    {
      stairwellId: 'STAIRWELL_1F_SE',
      landingNodeId: 'NODE_STAIR_1F_SE',
      localPos: Object.freeze([12.4, 0.0, -4.2]),
      provenance: VERIFICATION_STATUS.PROVISIONAL
    }
  ]),
  exits: Object.freeze([
    {
      exitId: 'EXIT_1F_SE',
      name: '1층 남동측 주 비상출구',
      portalNodeId: 'NODE_EXIT_1F_SE',
      localPos: Object.freeze([12.8, 0.0, -4.5]),
      provenance: VERIFICATION_STATUS.PARTIALLY_VERIFIED
    }
  ])
});

/**
 * Indoor Navigation Links (Classrooms -> Corridor -> Stairwell -> 1F Exit)
 */
export const INDOOR_NAV_EDGES = Object.freeze([
  {
    source: 'NODE_ROOM_301',
    target: 'NODE_CORR_3F_W',
    distance: 3.5,
    hasStairs: false,
    isWheelchairPassable: true,
    edgeType: 'DOOR_ROOM_CORRIDOR'
  },
  {
    source: 'NODE_ROOM_302',
    target: 'NODE_CORR_3F_C',
    distance: 3.5,
    hasStairs: false,
    isWheelchairPassable: true,
    edgeType: 'DOOR_ROOM_CORRIDOR'
  },
  {
    source: 'NODE_ROOM_303',
    target: 'NODE_CORR_3F_E',
    distance: 3.5,
    hasStairs: false,
    isWheelchairPassable: true,
    edgeType: 'DOOR_ROOM_CORRIDOR'
  },
  {
    source: 'NODE_CORR_3F_W',
    target: 'NODE_CORR_3F_C',
    distance: 10.0,
    hasStairs: false,
    isWheelchairPassable: true,
    edgeType: 'CORRIDOR_SEGMENT'
  },
  {
    source: 'NODE_CORR_3F_C',
    target: 'NODE_CORR_3F_E',
    distance: 10.0,
    hasStairs: false,
    isWheelchairPassable: true,
    edgeType: 'CORRIDOR_SEGMENT'
  },
  {
    source: 'NODE_CORR_3F_E',
    target: 'NODE_STAIR_3F_SE',
    distance: 8.5,
    hasStairs: false,
    isWheelchairPassable: true,
    edgeType: 'CORRIDOR_TO_STAIR'
  },
  {
    source: 'NODE_STAIR_3F_SE',
    target: 'NODE_STAIR_1F_SE',
    distance: 24.8, // 2 stories down: 4 flights, landings, risers
    hasStairs: true,
    isWheelchairPassable: false,
    stairRiserHeightMeters: 0.17,
    edgeType: 'VERTICAL_STAIR_DESCENT'
  },
  {
    source: 'NODE_STAIR_1F_SE',
    target: 'NODE_EXIT_1F_SE',
    distance: 3.5,
    hasStairs: false,
    isWheelchairPassable: true,
    edgeType: 'CORRIDOR_TO_EXIT'
  }
]);

/**
 * Hanyang Main Stadium Official Shelter Metadata
 */
export const HANYANG_MAIN_STADIUM_SHELTER = Object.freeze({
  shelterId: 'SHELTER_HANYANG_STADIUM',
  officialCode: 'OA-21060',
  officialName: '한양대학교 대운동장',
  authority: '행정안전부 / 서울특별시 성동구청',
  shelterType: 'OUTDOOR_SEISMIC_EVACUATION_FACILITY',
  ingressNodeId: 'OSM_NODE_8577408700',
  centroidCoordinates: Object.freeze({
    lat: 37.55385,
    lon: 127.04762,
    ellipsoidalHeightMeters: 28.5
  }),
  geometry: Object.freeze({
    trackWayId: '1507365593',
    pitchWayId: '1507365595',
    areaSqMeters: 14850.0,
    capacityPeople: 7425, // 2.0 sq meters per evacuee standard
    boundaryAccess: 'OPEN_PERIMETER_FOOTWAY'
  }),
  provenance: VERIFICATION_STATUS.VERIFIED
});

/**
 * Verified Baseline Pedestrian Routes from P0.2
 */
export const ROUTE_BASELINES = Object.freeze({
  PATH_SHORTEST_RAPID: Object.freeze({
    name: 'PATH_SHORTEST_RAPID (최단 경로)',
    targetLengthMeters: 651.9,
    segmentCount: 66,
    stairSegmentCount: 4,
    stairTotalLengthMeters: 68.5,
    hasStairs: true,
    isWheelchairPassable: false,
    provenance: VERIFICATION_STATUS.PARTIALLY_VERIFIED,
    stairWays: Object.freeze([
      { wayId: '684692285', lengthMeters: 19.1 },
      { wayId: '187409275', lengthMeters: 23.0 },
      { wayId: '409637898', lengthMeters: 16.5 },
      { wayId: '187436400', lengthMeters: 9.9 }
    ])
  }),
  PATH_STEP_FREE_DETOUR: Object.freeze({
    name: 'PATH_STEP_FREE_DETOUR (무단차 우회 경로)',
    targetLengthMeters: 769.1,
    segmentCount: 57,
    stairSegmentCount: 0,
    stairTotalLengthMeters: 0.0,
    hasStairs: false,
    isWheelchairPassable: true,
    provenance: VERIFICATION_STATUS.PARTIALLY_VERIFIED
  })
});
