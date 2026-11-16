// ============================================================================
// SEISMOLIVE v4.0 — Stage R1 Architecture Refactoring Verification Test Suite
// File: tests/test_r1_architecture_refactoring.js
// Run via: deno run --allow-all tests/test_r1_architecture_refactoring.js
// ============================================================================

import * as THREE from '../js/lib/three.module.js';

import {
  VERIFICATION_STATUS,
  DATA_PROVENANCE_SOURCE,
  SEISMIC_MOTION_POLICY,
  isProtectiveShakingOnset,
  isInstrumentMotionDetected,
  isQuiescenceSubsided,
  DEFAULT_HANYANG_FACILITY_PACKAGE
} from '../js/response/HanyangBuildingData.js';

import {
  PedestrianRoutingEngine,
  LINK_STATE
} from '../js/response/PedestrianRoutingEngine.js';

import {
  HanyangResponseAdapter
} from '../js/response/HanyangResponseAdapter.js';

import {
  GlobalLocalCameraTransition,
  CAMERA_STAGES
} from '../js/response/GlobalLocalCameraTransition.js';

import {
  ResponseUIAdapter
} from '../js/response/ResponseUIAdapter.js';

import {
  ResponseStateMachine,
  RESPONSE_STATES
} from '../js/response/ResponseStateMachine.js';

import {
  SituationAssessmentEngine,
  LOCATION_CERTAINTY
} from '../js/response/SituationAssessmentEngine.js';

import {
  PersonalResponseInteraction
} from '../js/response/PersonalResponseInteraction.js';

let passed = 0;
let failed = 0;

function assert(condition, message, detail = '') {
  if (condition) {
    passed++;
    console.log(`  [PASS] ${message}`);
    if (detail) console.log(`         -> ${detail}`);
  } else {
    failed++;
    console.error(`  [FAIL] ${message}`);
    if (detail) console.error(`         -> FAIL DETAIL: ${detail}`);
  }
}

console.log('====================================================================');
console.log('SEISMOLIVE v4.0 — Stage R1 Architecture Refactoring Verification');
console.log('Graph-Driven Stairs · PGA Hysteresis Policy · Multi-Building DI');
console.log('====================================================================\n');

// ============================================================================
// CATEGORY 1: GRAPH-DRIVEN STAIR SEGMENT SYNCHRONIZATION (BLDG 212)
// ============================================================================
console.log('--- Category 1: Stair Segment Geometry & Topology Alignment ---');
{
  const scene = new THREE.Scene();
  const adapter = new HanyangResponseAdapter(scene, { scale: 1.0 });

  assert(
    scene.children.includes(adapter.rootGroup),
    '1.1: HanyangResponseAdapter(scene, opts) dual constructor signature attaches rootGroup to scene'
  );

  const stairMesh = adapter.pathGroup.getObjectByName('Stairs_Hazard_Segments');
  const stairMeta = stairMesh?.userData?.stairSegments || [];
  assert(
    stairMeta.length === 4,
    `1.2: Exactly 4 outdoor stair segments derived from PedestrianRoutingEngine graph (got ${stairMeta.length})`
  );

  const expectedStairIds = [
    { edgeId: 'NODE_STAIR1_TOP->NODE_STAIR1_BOT', wayId: '684692285', start: [77.0, -1.0, -38.0], end: [88.0, -4.5, -23.0] },
    { edgeId: 'NODE_STAIR2_TOP->NODE_STAIR2_BOT', wayId: '187409275', start: [104.0, -5.5, -12.0], end: [118.0, -9.0, 5.0] },
    { edgeId: 'NODE_STAIR3_TOP->NODE_STAIR3_BOT', wayId: '409637898', start: [145.0, -10.0, 45.0], end: [155.0, -12.5, 57.0] },
    { edgeId: 'NODE_STAIR4_TOP->NODE_STAIR4_BOT', wayId: '187436400', start: [182.0, -13.0, 110.0], end: [186.0, -13.1, 117.5] }
  ];

  const posAttr = stairMesh.geometry.getAttribute('position');
  let allStairVerticesMatch = posAttr.count === 8;

  for (let i = 0; i < expectedStairIds.length; i++) {
    const exp = expectedStairIds[i];
    const meta = stairMeta[i];
    const x0 = posAttr.getX(i * 2), y0 = posAttr.getY(i * 2), z0 = posAttr.getZ(i * 2);
    const x1 = posAttr.getX(i * 2 + 1), y1 = posAttr.getY(i * 2 + 1), z1 = posAttr.getZ(i * 2 + 1);
    const segMatch = (
      meta?.edgeId === exp.edgeId &&
      meta?.wayId === exp.wayId &&
      Math.abs(x0 - exp.start[0]) < 1e-6 &&
      Math.abs(y0 - exp.start[1]) < 1e-6 &&
      Math.abs(z0 - exp.start[2]) < 1e-6 &&
      Math.abs(x1 - exp.end[0]) < 1e-6 &&
      Math.abs(y1 - exp.end[1]) < 1e-6 &&
      Math.abs(z1 - exp.end[2]) < 1e-6
    );
    if (!segMatch) allStairVerticesMatch = false;
  }

  assert(
    allStairVerticesMatch,
    '1.3: Stair 1~4 (especially Stair 3 way 409637898 & Stair 4 way 187436400) WebGL BufferGeometry vertices match exact graph nodes without off-by-one shift'
  );
  adapter.dispose();
}

// ============================================================================
// CATEGORY 2: SCIENTIFIC PGA HYSTERESIS POLICY (0.05g ONSET vs 0.02g RELEASE)
// ============================================================================
console.log('\n--- Category 2: Unified PGA Hysteresis Policy (0.05g / 0.02g) ---');
{
  assert(
    SEISMIC_MOTION_POLICY.PROTECTIVE_ONSET_PGA_G === 0.05 &&
    SEISMIC_MOTION_POLICY.QUIESCENCE_RELEASE_PGA_G === 0.02 &&
    SEISMIC_MOTION_POLICY.QUIESCENCE_MIN_DURATION_SEC === 10.0,
    '2.1: Policy exports explicit physical thresholds (0.05g MMI V onset / 0.02g MMI IV quiescence / 10s hold)'
  );

  // Hysteresis band 0.03g checks:
  assert(
    isInstrumentMotionDetected(0.03) === true &&
    isProtectiveShakingOnset(0.03) === false &&
    isQuiescenceSubsided(0.03, 15.0) === false,
    '2.2: 0.03g falls in [0.02g, 0.05g) hysteresis buffer: instrument active, no automatic new onset, blocks quiescence release'
  );

  // ResponseStateMachine enforces hysteresis release check (< 0.02g + >= 10s)
  const sm = new ResponseStateMachine(RESPONSE_STATES.S1_SHAKING);
  sm.updateStationObservation(0.03, false, 15.0);
  const prematureRelease = sm.stepTransition();
  assert(
    prematureRelease.success === false && sm.currentState === RESPONSE_STATES.S1_SHAKING,
    '2.3: ResponseStateMachine blocks S1->S2 transition while station PGA is 0.03g (>= 0.02g) even after 15s'
  );

  sm.updateStationObservation(0.01, false, 12.0);
  const validRelease = sm.stepTransition();
  assert(
    validRelease.success === true && sm.currentState === RESPONSE_STATES.S2_POST_SHAKING_ASSESSMENT,
    '2.4: ResponseStateMachine transitions S1->S2 once PGA drops to 0.01g (< 0.02g) with 12s quiescence'
  );

  // In S2, 0.03g does NOT regress to S1 (below 0.05g onset)
  sm.updateStationObservation(0.03, true, 0.0);
  assert(
    sm.currentState === RESPONSE_STATES.S2_POST_SHAKING_ASSESSMENT,
    '2.5: Hysteresis prevents S2->S1 oscillation on mild 0.03g motion (< 0.05g onset)'
  );

  // PersonalResponseInteraction matches SituationAssessmentEngine onset threshold (0.05g)
  const pri = new PersonalResponseInteraction();
  pri.ingestStationMotion({ pga: 0.03, stationId: 'TEST_STA', quiescentSeconds: 0.0 });
  assert(
    pri.stationTelemetry.isInstrumentActive === true && pri.sm.context.stationObservation.isShakingActive === false,
    '2.6: PersonalResponseInteraction marks 0.03g as instrument-active (>= 0.02g) without misclassifying as severe onset (>= 0.05g)'
  );
}

// ============================================================================
// CATEGORY 3: MULTI-BUILDING DEPENDENCY INJECTION (SYNTHETIC 2ND FACILITY)
// ============================================================================
console.log('\n--- Category 3: Multi-Building Dependency Injection (2nd Building Fixture) ---');
{
  const MOCK_ITBT_FACILITY_PACKAGE = Object.freeze({
    packageId: 'TEST_FIXTURE_ITBT_BLDG',
    anchor: Object.freeze({ lat: 37.55620, lon: 127.04390, h: 48.0 }),
    buildingMetadata: Object.freeze({
      id: 'BLDG_TEST_ITBT',
      name: '가상 검증 건물 (Synthetic Multi-Building Test Fixture)',
      levels: Object.freeze({ aboveGround: 4, underground: 0 })
    }),
    footprintMeters: Object.freeze([
      [0, 0], [30, 0], [30, -20], [0, -20], [0, 0]
    ]),
    floorHeightMeters: 3.5,
    totalLevels: 4,
    defaultFloor: 2,
    defaultRoomId: 'ROOM_202',
    defaultRoomNodeId: 'NODE_ITBT_202',
    defaultExitNodeId: 'NODE_ITBT_EXIT_1F',
    defaultOutdoorEgressNodeId: 'NODE_OUT_ITBT_DOOR',
    defaultOutdoorTargetNodeId: 'NODE_OUT_PLAZA_GATE',
    indoorGraphs: Object.freeze({
      2: Object.freeze({
        floorId: 'FLOOR_2F',
        levelIndex: 2,
        rooms: Object.freeze([
          { roomId: 'ROOM_202', name: '202호 연구실', nodeId: 'NODE_ITBT_202', centerLocalPos: [8, 3.5, -10] }
        ]),
        corridors: Object.freeze([{ centerlineNodes: ['NODE_ITBT_CORR_2F'] }]),
        stairwells: Object.freeze([{ stairwellId: 'SW_2F', landingNodeId: 'NODE_ITBT_STAIR_2F', localPos: [26, 3.5, -4] }])
      }),
      1: Object.freeze({
        floorId: 'FLOOR_1F',
        levelIndex: 1,
        stairwells: Object.freeze([{ stairwellId: 'SW_1F', landingNodeId: 'NODE_ITBT_STAIR_1F', localPos: [26, 0, -4] }]),
        exits: Object.freeze([{ exitId: 'EXIT_1F', name: '1F North Exit', portalNodeId: 'NODE_ITBT_EXIT_1F', localPos: [29, 0, -3] }])
      })
    }),
    indoorEdges: Object.freeze([
      { source: 'NODE_ITBT_202', target: 'NODE_ITBT_CORR_2F', distance: 6.0, hasStairs: false, isWheelchairPassable: true, edgeType: 'DOOR' },
      { source: 'NODE_ITBT_CORR_2F', target: 'NODE_ITBT_STAIR_2F', distance: 12.0, hasStairs: false, isWheelchairPassable: true, edgeType: 'CORRIDOR' },
      { source: 'NODE_ITBT_STAIR_2F', target: 'NODE_ITBT_STAIR_1F', distance: 14.0, hasStairs: true, isWheelchairPassable: false, edgeType: 'STAIR' },
      { source: 'NODE_ITBT_STAIR_1F', target: 'NODE_ITBT_EXIT_1F', distance: 4.0, hasStairs: false, isWheelchairPassable: true, edgeType: 'EXIT' }
    ]),
    connector: Object.freeze({
      connectorId: 'CONN_ITBT_1F',
      source: 'NODE_ITBT_EXIT_1F',
      target: 'NODE_OUT_ITBT_DOOR',
      distance: 3.0,
      hasStairs: false,
      isWheelchairPassable: true,
      doorPos: [29, 0, -3],
      footwayPos: [32, 0, -3],
      stairCoreCorner: [28, -2],
      stairCoreSize: { width: 3.0, depth: 3.0 }
    }),
    outdoorGraph: Object.freeze({
      egressNodeId: 'NODE_OUT_ITBT_DOOR',
      targetNodeId: 'NODE_OUT_PLAZA_GATE',
      nodes: Object.freeze([
        { id: 'NODE_OUT_ITBT_DOOR', name: 'ITBT Door', localPos: [32, 0, -3] },
        { id: 'NODE_OUT_STEPS_TOP', name: 'Plaza Steps Top', localPos: [50, 0, -10] },
        { id: 'NODE_OUT_STEPS_BOT', name: 'Plaza Steps Bot', localPos: [65, -2, -15] },
        { id: 'NODE_OUT_RAMP', name: 'Plaza Detour Ramp', localPos: [60, -1, 15] },
        { id: 'NODE_OUT_PLAZA_GATE', name: 'North Plaza Gate', localPos: [120, -2, 0] }
      ]),
      edges: Object.freeze([
        { edgeId: 'OUT_DOOR->STEPS_TOP', source: 'NODE_OUT_ITBT_DOOR', target: 'NODE_OUT_STEPS_TOP', distance: 20.0, hasStairs: false, wayId: 'W1', waypoints: [[32, 0, -3], [50, 0, -10]] },
        { edgeId: 'OUT_STEPS', source: 'NODE_OUT_STEPS_TOP', target: 'NODE_OUT_STEPS_BOT', distance: 16.0, hasStairs: true, isWheelchairPassable: false, wayId: 'W_STAIR', waypoints: [[50, 0, -10], [65, -2, -15]] },
        { edgeId: 'OUT_STEPS_BOT->GATE', source: 'NODE_OUT_STEPS_BOT', target: 'NODE_OUT_PLAZA_GATE', distance: 60.0, hasStairs: false, wayId: 'W2', waypoints: [[65, -2, -15], [120, -2, 0]] },
        { edgeId: 'OUT_DOOR->RAMP', source: 'NODE_OUT_ITBT_DOOR', target: 'NODE_OUT_RAMP', distance: 35.0, hasStairs: false, isWheelchairPassable: true, wayId: 'W_RAMP_1', waypoints: [[32, 0, -3], [60, -1, 15]] },
        { edgeId: 'OUT_RAMP->GATE', source: 'NODE_OUT_RAMP', target: 'NODE_OUT_PLAZA_GATE', distance: 90.0, hasStairs: false, isWheelchairPassable: true, wayId: 'W_RAMP_2', waypoints: [[60, -1, 15], [120, -2, 0]] }
      ])
    }),
    shelter: Object.freeze({
      shelterId: 'SHELTER_NORTH_PLAZA',
      officialName: '테스트 북광장 대피소',
      ingressDistanceMeters: 15.0,
      localCenter: [135, -2, 0]
    }),
    routeBaselines: Object.freeze({
      PATH_SHORTEST_RAPID: Object.freeze({ targetLengthMeters: 96.0 }),
      PATH_STEP_FREE_DETOUR: Object.freeze({ targetLengthMeters: 125.0 }),
      COMPLETE_SHORTEST: Object.freeze({ targetLengthMeters: 150.0 })
    }),
    routeDisplayNames: Object.freeze({
      shortestLineName: 'ITBT_Path_Shortest',
      stepFreeLineName: 'ITBT_Path_StepFree',
      stairHazardsName: 'ITBT_Stair_Hazards',
      interiorGroupName: 'Interior_2F_Provisional'
    }),
    cameraViewpoints: Object.freeze({
      ...DEFAULT_HANYANG_FACILITY_PACKAGE.cameraViewpoints,
      BUILDING_INSPECTION: Object.freeze({
        position: [45, 35, 25],
        target: [15, 3.5, -10],
        near: 0.1,
        far: 500,
        description: 'ITBT Test Fixture Inspection'
      })
    })
  });

  const router2 = new PedestrianRoutingEngine({ facilityPackage: MOCK_ITBT_FACILITY_PACKAGE });
  assert(
    !router2.nodes.has('NODE_ROOM_301') && router2.nodes.has('NODE_ITBT_202'),
    '3.1: Injected router contains 2nd facility nodes without Hanyang Bldg 212 hardcoding leakage'
  );

  const outdoorShort2 = router2.findOutdoorShortestPath();
  const outdoorStepFree2 = router2.findOutdoorStepFreePath();
  const fullShort2 = router2.findCompleteIndoorOutdoorPath('ROOM_202');

  assert(
    outdoorShort2.totalDistanceMeters === 96.0 &&
    outdoorStepFree2.totalDistanceMeters === 125.0 &&
    fullShort2.totalDistanceMeters === 150.0,
    '3.2: Injected 2nd facility routing calculates exact synthetic distances (96m outdoor / 125m step-free / 150m full)',
    `short=${outdoorShort2.totalDistanceMeters}, stepFree=${outdoorStepFree2.totalDistanceMeters}, full=${fullShort2.totalDistanceMeters}`
  );

  const adapter2 = new HanyangResponseAdapter({ facilityPackage: MOCK_ITBT_FACILITY_PACKAGE, router: router2 });
  const stairMesh2 = adapter2.pathGroup.getObjectByName('ITBT_Stair_Hazards');
  const stairMeta2 = stairMesh2?.userData?.stairSegments || [];
  assert(
    adapter2.floorGroups.size === 4 &&
    stairMeta2.length === 1 &&
    stairMeta2[0].edgeId === 'OUT_STEPS' &&
    stairMeta2[0].wayId === 'W_STAIR',
    '3.3: HanyangResponseAdapter renders 4 levels and isolates exact 2nd-building stair edge (OUT_STEPS)'
  );

  const cam = new THREE.PerspectiveCamera(45, 1.77, 0.1, 1000);
  const camTrans2 = new GlobalLocalCameraTransition({ camera: cam, facilityPackage: MOCK_ITBT_FACILITY_PACKAGE });
  assert(
    camTrans2.viewpoints[CAMERA_STAGES.BUILDING_INSPECTION].target.x === 15 &&
    camTrans2.viewpoints[CAMERA_STAGES.BUILDING_INSPECTION].position.y === 35,
    '3.4: GlobalLocalCameraTransition uses injected facility viewpoints'
  );

  const ui2 = new ResponseUIAdapter({
    facilityPackage: MOCK_ITBT_FACILITY_PACKAGE,
    router: router2,
    hanyangAdapter: adapter2
  });
  ui2.updateStationMotion(0.01, Date.now(), DATA_PROVENANCE_SOURCE.SIMULATED_SCENARIO);
  const gNormal = ui2.reassess();
  const gDetour = ui2.reportLinkObstacle('OUT_STEPS', LINK_STATE.CLOSED, {
    source: DATA_PROVENANCE_SOURCE.OFFICIAL_DISASTER_INFO
  });
  assert(
    gNormal.replanStatus.totalDistanceMeters === 150.0 &&
    gDetour.replanStatus.totalDistanceMeters === 179.0 &&
    gDetour.routeStatus.displayMode === 'STEP_FREE',
    '3.5: ResponseUIAdapter dynamically replans 2nd building around closed stairs (150m -> 179m STEP_FREE)'
  );

  adapter2.dispose();
}

console.log('\n====================================================================');
console.log(`STAGE R1 REFACTORING SUITE RESULTS: ${passed} PASSED | ${failed} FAILED`);
console.log('====================================================================');

if (failed > 0) Deno.exit(1);
