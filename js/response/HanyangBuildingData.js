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

import {
  DATA_PROVENANCE_SOURCE,
  VERIFICATION_STATUS,
  SEISMIC_MOTION_POLICY,
  isProtectiveShakingOnset,
  isInstrumentMotionDetected,
  isQuiescenceSubsided
} from './ResponseDomainTypes.js';

export {
  DATA_PROVENANCE_SOURCE,
  VERIFICATION_STATUS,
  SEISMIC_MOTION_POLICY,
  isProtectiveShakingOnset,
  isInstrumentMotionDetected,
  isQuiescenceSubsided
};

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

export const BLDG_212_OSM_FOOTPRINT_METERS = Object.freeze([
  Object.freeze([21.53, -110.44]),
  Object.freeze([17.39, -103.34]),
  Object.freeze([11.83, -93.90]),
  Object.freeze([22.68, -87.58]),
  Object.freeze([25.59, -92.35]),
  Object.freeze([69.63, -66.49]),
  Object.freeze([60.54, -51.17]),
  Object.freeze([70.16, -45.51]), // South-East Corner (Exit side)
  Object.freeze([78.81, -40.51]),
  Object.freeze([94.78, -67.60]),
  Object.freeze([51.01, -93.24]),
  Object.freeze([21.53, -110.44])
]);

/**
 * Calibrated Campus Outdoor Graph with explicit 3D local metric coordinates and waypoints.
 * Serves as the single source of truth for both Dijkstra routing and Three.js path rendering.
 */
export const HANYANG_OUTDOOR_GRAPH = Object.freeze({
  egressNodeId: 'OSM_NODE_6415394841',
  targetNodeId: 'OSM_NODE_8577408700',
  nodes: Object.freeze([
    { id: 'OSM_NODE_6415394841', lat: 37.5556064, lon: 127.0452288, name: '1F SE Outdoor Footway', localPos: Object.freeze([73.68, -0.15, -41.98]) },
    { id: 'NODE_STAIR1_TOP', name: 'Stair 1 Top', localPos: Object.freeze([77.0, -1.0, -38.0]) },
    { id: 'NODE_STAIR1_BOT', name: 'Stair 1 Bottom', localPos: Object.freeze([88.0, -4.5, -23.0]) },
    { id: 'NODE_LIVING_STREET_1', name: 'Living Street Junction', localPos: Object.freeze([95.0, -5.0, -16.0]) },
    { id: 'NODE_PATH_1487575142', name: 'Pathway 1487575142 Junction', localPos: Object.freeze([99.5, -5.25, -14.0]) },
    { id: 'NODE_STAIR2_TOP', name: 'Stair 2 Top', localPos: Object.freeze([104.0, -5.5, -12.0]) },
    { id: 'NODE_STAIR2_BOT', name: 'Stair 2 Bottom', localPos: Object.freeze([118.0, -9.0, 5.0]) },
    { id: 'NODE_STAIR3_TOP', name: 'Stair 3 Top', localPos: Object.freeze([145.0, -10.0, 45.0]) },
    { id: 'NODE_STAIR3_BOT', name: 'Stair 3 Bottom', localPos: Object.freeze([155.0, -12.5, 57.0]) },
    { id: 'NODE_STAIR4_TOP', name: 'Stair 4 Top', localPos: Object.freeze([182.0, -13.0, 110.0]) },
    { id: 'NODE_STAIR4_BOT', name: 'Stair 4 Bottom', localPos: Object.freeze([186.0, -13.1, 117.5]) },
    { id: 'NODE_SERVICE_JUNCTION', name: 'Lower Service Road Junction', localPos: Object.freeze([190.0, -13.2, 125.0]) },
    { id: 'NODE_RAMP_MID', name: 'Step-Free Ramp Midpoint', localPos: Object.freeze([65.0, -5.0, 65.0]) },
    { id: 'OSM_NODE_8577408700', lat: 37.554032, lon: 127.047460, name: 'Stadium Ingress Perimeter', localPos: Object.freeze([226.75, -13.50, 218.17]) }
  ]),
  edges: Object.freeze([
    {
      edgeId: 'OSM_NODE_6415394841->NODE_STAIR1_TOP',
      source: 'OSM_NODE_6415394841',
      target: 'NODE_STAIR1_TOP',
      distance: 4.1,
      hasStairs: false,
      wayId: '684692287',
      highway: 'footway',
      branch: 'SHORTEST',
      waypoints: Object.freeze([[73.68, -0.15, -41.98], [77.0, -1.0, -38.0]])
    },
    {
      edgeId: 'NODE_STAIR1_TOP->NODE_STAIR1_BOT',
      source: 'NODE_STAIR1_TOP',
      target: 'NODE_STAIR1_BOT',
      distance: 19.1,
      hasStairs: true,
      isWheelchairPassable: false,
      wayId: '684692285',
      highway: 'steps',
      hazardRisk: 'HIGH',
      branch: 'SHORTEST',
      waypoints: Object.freeze([[77.0, -1.0, -38.0], [88.0, -4.5, -23.0]])
    },
    {
      edgeId: 'NODE_STAIR1_BOT->NODE_LIVING_STREET_1',
      source: 'NODE_STAIR1_BOT',
      target: 'NODE_LIVING_STREET_1',
      distance: 7.7,
      hasStairs: false,
      wayId: '684692288',
      highway: 'footway',
      branch: 'SHORTEST',
      waypoints: Object.freeze([[88.0, -4.5, -23.0], [95.0, -5.0, -16.0]])
    },
    {
      edgeId: 'NODE_LIVING_STREET_1->NODE_PATH_1487575142',
      source: 'NODE_LIVING_STREET_1',
      target: 'NODE_PATH_1487575142',
      distance: 15.7,
      hasStairs: false,
      wayId: '187184710',
      highway: 'living_street',
      branch: 'SHORTEST',
      waypoints: Object.freeze([[95.0, -5.0, -16.0], [99.5, -5.25, -14.0]])
    },
    {
      edgeId: 'NODE_PATH_1487575142->NODE_STAIR2_TOP',
      source: 'NODE_PATH_1487575142',
      target: 'NODE_STAIR2_TOP',
      distance: 4.4,
      hasStairs: false,
      wayId: '1487575142',
      highway: 'path',
      branch: 'SHORTEST',
      waypoints: Object.freeze([[99.5, -5.25, -14.0], [104.0, -5.5, -12.0]])
    },
    {
      edgeId: 'NODE_STAIR2_TOP->NODE_STAIR2_BOT',
      source: 'NODE_STAIR2_TOP',
      target: 'NODE_STAIR2_BOT',
      distance: 23.0,
      hasStairs: true,
      isWheelchairPassable: false,
      wayId: '187409275',
      highway: 'steps',
      hazardRisk: 'HIGH',
      branch: 'SHORTEST',
      waypoints: Object.freeze([[104.0, -5.5, -12.0], [118.0, -9.0, 5.0]])
    },
    {
      edgeId: 'NODE_STAIR2_BOT->NODE_STAIR3_TOP',
      source: 'NODE_STAIR2_BOT',
      target: 'NODE_STAIR3_TOP',
      distance: 50.4,
      hasStairs: false,
      wayId: '187646030',
      highway: 'pedestrian',
      branch: 'SHORTEST',
      waypoints: Object.freeze([[118.0, -9.0, 5.0], [135.0, -9.5, 30.0], [145.0, -10.0, 45.0]])
    },
    {
      edgeId: 'NODE_STAIR3_TOP->NODE_STAIR3_BOT',
      source: 'NODE_STAIR3_TOP',
      target: 'NODE_STAIR3_BOT',
      distance: 16.5,
      hasStairs: true,
      isWheelchairPassable: false,
      wayId: '409637898',
      highway: 'steps',
      hazardRisk: 'HIGH',
      branch: 'SHORTEST',
      waypoints: Object.freeze([[145.0, -10.0, 45.0], [155.0, -12.5, 57.0]])
    },
    {
      edgeId: 'NODE_STAIR3_BOT->NODE_STAIR4_TOP',
      source: 'NODE_STAIR3_BOT',
      target: 'NODE_STAIR4_TOP',
      distance: 62.4,
      hasStairs: false,
      wayId: '227120060',
      highway: 'footway',
      branch: 'SHORTEST',
      waypoints: Object.freeze([[155.0, -12.5, 57.0], [175.0, -12.8, 95.0], [182.0, -13.0, 110.0]])
    },
    {
      edgeId: 'NODE_STAIR4_TOP->NODE_STAIR4_BOT',
      source: 'NODE_STAIR4_TOP',
      target: 'NODE_STAIR4_BOT',
      distance: 9.9,
      hasStairs: true,
      isWheelchairPassable: false,
      wayId: '187436400',
      highway: 'steps',
      hazardRisk: 'HIGH',
      branch: 'SHORTEST',
      waypoints: Object.freeze([[182.0, -13.0, 110.0], [186.0, -13.1, 117.5]])
    },
    {
      edgeId: 'NODE_STAIR4_BOT->NODE_SERVICE_JUNCTION',
      source: 'NODE_STAIR4_BOT',
      target: 'NODE_SERVICE_JUNCTION',
      distance: 47.2,
      hasStairs: false,
      wayId: '187157368',
      highway: 'service',
      branch: 'SHORTEST',
      waypoints: Object.freeze([[186.0, -13.1, 117.5], [190.0, -13.2, 125.0]])
    },
    {
      edgeId: 'OSM_NODE_6415394841->NODE_RAMP_MID',
      source: 'OSM_NODE_6415394841',
      target: 'NODE_RAMP_MID',
      distance: 145.4,
      hasStairs: false,
      isWheelchairPassable: true,
      wayId: '187443876',
      highway: 'living_street',
      branch: 'STEP_FREE',
      waypoints: Object.freeze([[73.68, -0.15, -41.98], [55.0, -0.5, -25.0], [45.0, -2.0, 15.0], [65.0, -5.0, 65.0]])
    },
    {
      edgeId: 'NODE_RAMP_MID->NODE_SERVICE_JUNCTION',
      source: 'NODE_RAMP_MID',
      target: 'NODE_SERVICE_JUNCTION',
      distance: 232.2,
      hasStairs: false,
      isWheelchairPassable: true,
      wayId: '187409281',
      highway: 'service',
      branch: 'STEP_FREE',
      waypoints: Object.freeze([[65.0, -5.0, 65.0], [110.0, -8.5, 110.0], [160.0, -11.0, 135.0], [190.0, -13.2, 125.0]])
    },
    {
      edgeId: 'NODE_SERVICE_JUNCTION->OSM_NODE_8577408700',
      source: 'NODE_SERVICE_JUNCTION',
      target: 'OSM_NODE_8577408700',
      distance: 391.5,
      hasStairs: false,
      isWheelchairPassable: true,
      highway: 'service_footway_network',
      branch: 'COMMON',
      waypoints: Object.freeze([[190.0, -13.2, 125.0], [210.0, -13.4, 175.0], [226.75, -13.50, 218.17]])
    }
  ])
});

/**
 * Default FacilityPackage for dependency injection across PedestrianRoutingEngine,
 * HanyangResponseAdapter, GlobalLocalCameraTransition, and ResponseUIAdapter.
 */
export const DEFAULT_HANYANG_FACILITY_PACKAGE = Object.freeze({
  packageId: 'FACILITY_HANYANG_BLDG_212',
  anchor: Object.freeze({
    lat: HANYANG_BUILDING_METADATA.anchorCoordinates.lat,
    lon: HANYANG_BUILDING_METADATA.anchorCoordinates.lon,
    h: HANYANG_BUILDING_METADATA.anchorCoordinates.ellipsoidalHeightMeters
  }),
  buildingMetadata: HANYANG_BUILDING_METADATA,
  footprintMeters: BLDG_212_OSM_FOOTPRINT_METERS,
  floorHeightMeters: 3.6,
  totalLevels: HANYANG_BUILDING_METADATA.levels.aboveGround,
  defaultFloor: 3,
  defaultRoomId: 'ROOM_301',
  defaultRoomNodeId: 'NODE_ROOM_301',
  defaultExitNodeId: 'NODE_EXIT_1F_SE',
  defaultOutdoorEgressNodeId: HANYANG_OUTDOOR_GRAPH.egressNodeId,
  defaultOutdoorTargetNodeId: HANYANG_OUTDOOR_GRAPH.targetNodeId,
  indoorGraphs: Object.freeze({
    3: HANYANG_3F_INDOOR_GRAPH,
    1: HANYANG_1F_INDOOR_GRAPH
  }),
  indoorEdges: INDOOR_NAV_EDGES,
  connector: Object.freeze({
    connectorId: 'CONN_BLDG212_1F_SE_EXIT',
    source: 'NODE_EXIT_1F_SE',
    target: 'OSM_NODE_6415394841',
    distance: 4.0,
    hasStairs: false,
    isWheelchairPassable: false,
    doorPos: Object.freeze([70.16, 0.0, -45.51]),
    footwayPos: Object.freeze([73.68, -0.15, -43.61]),
    stairCoreCorner: Object.freeze([70.16, -45.51]),
    stairCoreSize: Object.freeze({ width: 4.0, depth: 5.0 })
  }),
  outdoorGraph: HANYANG_OUTDOOR_GRAPH,
  shelter: Object.freeze({
    ...HANYANG_MAIN_STADIUM_SHELTER,
    ingressDistanceMeters: 21.7,
    localCenter: Object.freeze([226.75, -13.50, 218.17]),
    trackRadiusX: 40.0,
    trackRadiusZ: 65.0,
    pitchHalfWidth: 20.0,
    pitchHalfLength: 35.0
  }),
  routeBaselines: ROUTE_BASELINES,
  routeDisplayNames: Object.freeze({
    shortestLineName: 'Path_Shortest_651m',
    stepFreeLineName: 'Path_StepFree_769m',
    stairHazardsName: 'Stairs_Hazard_Segments',
    connectorLineName: 'Connector_1F_SE_Line',
    shelterTrackName: 'Stadium_Track_Outline',
    shelterPitchName: 'Stadium_Pitch_Safe_Zone',
    interiorGroupName: 'Interior_3F_Provisional'
  }),
  cameraViewpoints: Object.freeze({
    GLOBAL_ORBIT: Object.freeze({
      position: Object.freeze([10.0, 140.0, 40.0]),
      target: Object.freeze([0.0, 0.0, 0.0]),
      near: 0.1,
      far: 2000.0,
      description: '글로벌 우주 궤도 (전 지구적 지진학적 맥락)'
    }),
    REGIONAL_APPROACH: Object.freeze({
      position: Object.freeze([1.2, 8.5, 3.0]),
      target: Object.freeze([0.0, 0.0, 0.0]),
      near: 0.05,
      far: 1500.0,
      description: '한반도 및 수도권 광역 접근 궤도'
    }),
    CAMPUS_OVERVIEW: Object.freeze({
      position: Object.freeze([230.0, 240.0, -90.0]),
      target: Object.freeze([145.0, -8.0, 80.0]),
      near: 0.1,
      far: 1500.0,
      description: '캠퍼스 전체 조망: 제1공학관, 대피 경로 및 대운동장'
    }),
    BUILDING_INSPECTION: Object.freeze({
      position: Object.freeze([135.0, 68.0, -12.0]),
      target: Object.freeze([50.0, 9.0, -75.0]),
      near: 0.1,
      far: 1000.0,
      description: '제1공학관 엑소노메트릭 상세: 3층 피난 평면 및 수직 코어'
    }),
    PERSONAL_LOCATION: Object.freeze({
      position: Object.freeze([88.0, 32.0, -35.0]),
      target: Object.freeze([68.0, 9.2, -45.0]),
      near: 0.05,
      far: 800.0,
      description: '개인화 위치 상세: 제1공학관 3층 301호 및 비상계단 진입부'
    })
  })
});

/**
 * Shared factory to construct strictly provenance-tagged campus FacilityPackages
 * without duplicating routing/adapter boilerplate (Tier 2.4).
 */
function createCampusFacilityPackage({
  packageId,
  buildingId,
  name,
  unitNumber,
  centerX,
  centerZ,
  halfW,
  halfD,
  totalLevels = 5,
  defaultFloor = 3,
  floorHeightMeters = 3.6,
  roomName = `${defaultFloor}01호 세미나실 (잠정)`,
  shortestLenMeters = 520.0,
  stepFreeLenMeters = 640.0
}) {
  const footprint = Object.freeze([
    Object.freeze([centerX - halfW, centerZ - halfD]),
    Object.freeze([centerX + halfW, centerZ - halfD]),
    Object.freeze([centerX + halfW, centerZ + halfD]),
    Object.freeze([centerX - halfW, centerZ + halfD]),
    Object.freeze([centerX - halfW, centerZ - halfD])
  ]);

  const targetY = (defaultFloor - 1) * floorHeightMeters;
  const exitX = centerX + halfW;
  const exitZ = centerZ + halfD * 0.5;
  const footwayX = exitX + 4.5;
  const footwayZ = exitZ + 2.0;

  const roomId = `ROOM_${defaultFloor}01`;
  const roomNodeId = `NODE_${roomId}`;
  const stairTopId = `NODE_STAIR_${defaultFloor}F_SE`;
  const stairBotId = 'NODE_STAIR_1F_SE';
  const exitNodeId = 'NODE_EXIT_1F_SE';
  const outdoorEgressId = `${buildingId}_OUTDOOR_EGRESS`;
  const outdoorMidStairId = `${buildingId}_MID_STAIR`;
  const outdoorMidRampId = `${buildingId}_MID_RAMP`;
  const stadiumIngressId = HANYANG_OUTDOOR_GRAPH.targetNodeId;

  const indoorGraphs = Object.freeze({
    [defaultFloor]: Object.freeze({
      floorId: `FLOOR_${defaultFloor}F`,
      levelIndex: defaultFloor,
      elevationOffsetMeters: targetY,
      provenance: VERIFICATION_STATUS.PROVISIONAL,
      rooms: Object.freeze([
        {
          roomId,
          name: roomName,
          type: 'SEMINAR_HALL',
          centerLocalPos: Object.freeze([centerX - halfW * 0.35, targetY, centerZ]),
          nodeId: roomNodeId,
          provenance: VERIFICATION_STATUS.PROVISIONAL
        }
      ]),
      stairwells: Object.freeze([
        {
          stairwellId: `STAIRWELL_${defaultFloor}F_SE`,
          name: '남동측 피난계단실 (PROVISIONAL)',
          landingNodeId: stairTopId,
          localPos: Object.freeze([exitX - 3.0, targetY, exitZ]),
          provenance: VERIFICATION_STATUS.PROVISIONAL
        }
      ])
    }),
    1: Object.freeze({
      floorId: 'FLOOR_1F',
      levelIndex: 1,
      elevationOffsetMeters: 0.0,
      provenance: VERIFICATION_STATUS.PROVISIONAL,
      stairwells: Object.freeze([
        {
          stairwellId: 'STAIRWELL_1F_SE',
          landingNodeId: stairBotId,
          localPos: Object.freeze([exitX - 3.0, 0.0, exitZ]),
          provenance: VERIFICATION_STATUS.PROVISIONAL
        }
      ]),
      exits: Object.freeze([
        {
          exitId: 'EXIT_1F_SE',
          name: '1층 남동측 주 출구 (잠정)',
          portalNodeId: exitNodeId,
          localPos: Object.freeze([exitX, 0.0, exitZ]),
          provenance: VERIFICATION_STATUS.PROVISIONAL
        }
      ])
    })
  });

  const indoorEdges = Object.freeze([
    { source: roomNodeId, target: stairTopId, distance: Number((halfW * 1.1).toFixed(1)), hasStairs: false, isWheelchairPassable: true, edgeType: 'CORRIDOR_PROVISIONAL' },
    { source: stairTopId, target: stairBotId, distance: Number(((defaultFloor - 1) * 8.4).toFixed(1)), hasStairs: true, isWheelchairPassable: false, edgeType: 'VERTICAL_STAIR_DESCENT' },
    { source: stairBotId, target: exitNodeId, distance: 4.5, hasStairs: false, isWheelchairPassable: true, edgeType: 'CORRIDOR_TO_EXIT' }
  ]);

  const outdoorGraph = Object.freeze({
    egressNodeId: outdoorEgressId,
    targetNodeId: stadiumIngressId,
    nodes: Object.freeze([
      { id: outdoorEgressId, name: `${name} 외부 보행 접속점`, localPos: Object.freeze([footwayX, -0.5, footwayZ]) },
      { id: outdoorMidStairId, name: '직선 계단 경유점', localPos: Object.freeze([(footwayX + 226.75) * 0.5, -7.0, (footwayZ + 218.17) * 0.5 - 12.0]) },
      { id: outdoorMidRampId, name: '완경사 우회 경유점', localPos: Object.freeze([footwayX - 35.0, -7.5, 165.0]) },
      { id: stadiumIngressId, name: 'Stadium Ingress Perimeter', localPos: Object.freeze([226.75, -13.50, 218.17]) }
    ]),
    edges: Object.freeze([
      {
        edgeId: `${outdoorEgressId}->${outdoorMidStairId}`,
        source: outdoorEgressId,
        target: outdoorMidStairId,
        distance: Number((shortestLenMeters * 0.48).toFixed(1)),
        hasStairs: true,
        isWheelchairPassable: false,
        highway: 'steps',
        branch: 'SHORTEST',
        waypoints: Object.freeze([[footwayX, -0.5, footwayZ], [(footwayX + 226.75) * 0.5, -7.0, (footwayZ + 218.17) * 0.5 - 12.0]])
      },
      {
        edgeId: `${outdoorMidStairId}->${stadiumIngressId}`,
        source: outdoorMidStairId,
        target: stadiumIngressId,
        distance: Number((shortestLenMeters * 0.52).toFixed(1)),
        hasStairs: false,
        isWheelchairPassable: true,
        highway: 'footway',
        branch: 'SHORTEST',
        waypoints: Object.freeze([[(footwayX + 226.75) * 0.5, -7.0, (footwayZ + 218.17) * 0.5 - 12.0], [226.75, -13.50, 218.17]])
      },
      {
        edgeId: `${outdoorEgressId}->${outdoorMidRampId}`,
        source: outdoorEgressId,
        target: outdoorMidRampId,
        distance: Number((stepFreeLenMeters * 0.46).toFixed(1)),
        hasStairs: false,
        isWheelchairPassable: true,
        highway: 'footway',
        branch: 'STEP_FREE',
        waypoints: Object.freeze([[footwayX, -0.5, footwayZ], [footwayX - 35.0, -7.5, 165.0]])
      },
      {
        edgeId: `${outdoorMidRampId}->${stadiumIngressId}`,
        source: outdoorMidRampId,
        target: stadiumIngressId,
        distance: Number((stepFreeLenMeters * 0.54).toFixed(1)),
        hasStairs: false,
        isWheelchairPassable: true,
        highway: 'footway',
        branch: 'STEP_FREE',
        waypoints: Object.freeze([[footwayX - 35.0, -7.5, 165.0], [226.75, -13.50, 218.17]])
      }
    ])
  });

  return Object.freeze({
    packageId,
    anchor: DEFAULT_HANYANG_FACILITY_PACKAGE.anchor,
    buildingMetadata: Object.freeze({
      id: buildingId,
      name,
      unitNumber,
      structureType: '철근콘크리트구조 (프로파일 추정치)',
      levels: Object.freeze({ aboveGround: totalLevels, underground: 0 }),
      anchorCoordinates: DEFAULT_HANYANG_FACILITY_PACKAGE.buildingMetadata.anchorCoordinates,
      provenance: VERIFICATION_STATUS.PARTIALLY_VERIFIED
    }),
    footprintMeters: footprint,
    floorHeightMeters,
    totalLevels,
    defaultFloor,
    defaultRoomId: roomId,
    defaultRoomNodeId: roomNodeId,
    defaultExitNodeId: exitNodeId,
    defaultOutdoorEgressNodeId: outdoorEgressId,
    defaultOutdoorTargetNodeId: stadiumIngressId,
    indoorGraphs,
    indoorEdges,
    connector: Object.freeze({
      connectorId: `CONN_${buildingId}_1F_SE_EXIT`,
      source: exitNodeId,
      target: outdoorEgressId,
      distance: 4.5,
      hasStairs: false,
      isWheelchairPassable: false,
      doorPos: Object.freeze([exitX, 0.0, exitZ]),
      footwayPos: Object.freeze([footwayX, -0.5, footwayZ]),
      stairCoreCorner: Object.freeze([exitX - 3.0, exitZ]),
      stairCoreSize: Object.freeze({ width: 4.0, depth: 5.0 })
    }),
    outdoorGraph,
    shelter: DEFAULT_HANYANG_FACILITY_PACKAGE.shelter,
    routeBaselines: Object.freeze({
      PATH_SHORTEST_RAPID: Object.freeze({
        name: `${unitNumber}동 최단 대피 경로 (잠정)`,
        targetLengthMeters: shortestLenMeters,
        hasStairs: true,
        isWheelchairPassable: false,
        provenance: VERIFICATION_STATUS.PROVISIONAL
      }),
      PATH_STEP_FREE_DETOUR: Object.freeze({
        name: `${unitNumber}동 무단차 우회 경로 (잠정)`,
        targetLengthMeters: stepFreeLenMeters,
        hasStairs: false,
        isWheelchairPassable: true,
        provenance: VERIFICATION_STATUS.PROVISIONAL
      })
    }),
    routeDisplayNames: Object.freeze({
      shortestLineName: `Path_Shortest_${buildingId}`,
      stepFreeLineName: `Path_StepFree_${buildingId}`,
      stairHazardsName: `Stairs_Hazard_${buildingId}`,
      connectorLineName: `Connector_1F_SE_${buildingId}`,
      shelterTrackName: 'Stadium_Track_Outline',
      shelterPitchName: 'Stadium_Pitch_Safe_Zone',
      interiorGroupName: `Interior_${defaultFloor}F_Provisional`
    }),
    cameraViewpoints: Object.freeze({
      GLOBAL_ORBIT: DEFAULT_HANYANG_FACILITY_PACKAGE.cameraViewpoints.GLOBAL_ORBIT,
      REGIONAL_APPROACH: DEFAULT_HANYANG_FACILITY_PACKAGE.cameraViewpoints.REGIONAL_APPROACH,
      CAMPUS_OVERVIEW: DEFAULT_HANYANG_FACILITY_PACKAGE.cameraViewpoints.CAMPUS_OVERVIEW,
      BUILDING_INSPECTION: Object.freeze({
        position: Object.freeze([centerX + 85.0, 68.0, centerZ + 65.0]),
        target: Object.freeze([centerX, targetY, centerZ]),
        near: 0.1,
        far: 1200.0,
        description: `${name} 엑소노메트릭 상세: ${defaultFloor}층 피난 평면 (PROVISIONAL)`
      }),
      PERSONAL_LOCATION: Object.freeze({
        position: Object.freeze([exitX + 26.0, Math.max(24.0, targetY + 18.0), exitZ + 22.0]),
        target: Object.freeze([exitX - 6.0, targetY, exitZ]),
        near: 0.05,
        far: 900.0,
        description: `${name} ${defaultFloor}층 ${roomId} 개인화 대응 위치 (PROVISIONAL)`
      })
    })
  });
}

export const HANYANG_HIT_FACILITY_PACKAGE = createCampusFacilityPackage({
  packageId: 'FACILITY_HANYANG_HIT_701',
  buildingId: 'BLDG_701_HIT',
  name: '한양종합기술연구원 (HIT · 701동)',
  unitNumber: '701',
  centerX: -95.0,
  centerZ: -210.0, // north_m = +210 -> Three.js Z = -210
  halfW: 28.0,
  halfD: 19.0,
  totalLevels: 6,
  defaultFloor: 4,
  roomName: '401호 연구실 (PROVISIONAL)',
  shortestLenMeters: 545.0,
  stepFreeLenMeters: 675.0
});

export const HANYANG_PAIKNAM_FACILITY_PACKAGE = createCampusFacilityPackage({
  packageId: 'FACILITY_HANYANG_PAIKNAM_104',
  buildingId: 'BLDG_104_PAIKNAM',
  name: '백남학술정보관 (104동)',
  unitNumber: '104',
  centerX: -35.0,
  centerZ: 75.0, // north_m = -75 -> Three.js Z = +75
  halfW: 25.0,
  halfD: 17.0,
  totalLevels: 5,
  defaultFloor: 3,
  roomName: '301호 열람실 (PROVISIONAL)',
  shortestLenMeters: 315.0,
  stepFreeLenMeters: 398.0
});

export const FACILITY_PACKAGE_REGISTRY = Object.freeze({
  BLDG_212_ENG1: DEFAULT_HANYANG_FACILITY_PACKAGE,
  BLDG_701_HIT: HANYANG_HIT_FACILITY_PACKAGE,
  BLDG_104_PAIKNAM: HANYANG_PAIKNAM_FACILITY_PACKAGE
});

export function getFacilityPackageById(facilityId) {
  return FACILITY_PACKAGE_REGISTRY[facilityId] || DEFAULT_HANYANG_FACILITY_PACKAGE;
}
