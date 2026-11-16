// ============================================================================
// SEISMOLIVE v4.0 — Phase P1.1 Hanyang Single-Building Response Test Suite
// File: tests/test_hanyang_response_system.js
// Run via: deno run --allow-all tests/test_hanyang_response_system.js
// ============================================================================

import {
  LocalTangentAnchor,
  HANYANG_BLDG212_ANCHOR
} from '../js/response/LocalTangentAnchor.js';
import {
  IndoorOutdoorConnector,
  HANYANG_BLDG212_SE_CONNECTOR,
  PORTAL_DOOR_TYPES,
  LOCK_MECHANISMS,
  EGRESS_STATUS
} from '../js/response/IndoorOutdoorConnector.js';
import {
  HANYANG_BUILDING_METADATA,
  HANYANG_3F_INDOOR_GRAPH,
  HANYANG_1F_INDOOR_GRAPH,
  HANYANG_MAIN_STADIUM_SHELTER,
  ROUTE_BASELINES,
  DATA_PROVENANCE_SOURCE,
  VERIFICATION_STATUS
} from '../js/response/HanyangBuildingData.js';
import {
  PedestrianRoutingEngine,
  PATH_TYPE,
  USER_MOBILITY_PROFILE
} from '../js/response/PedestrianRoutingEngine.js';
import {
  ResponseStateMachine,
  RESPONSE_STATES
} from '../js/response/ResponseStateMachine.js';

let passed = 0;
let failed = 0;

function assert(condition, message, detail = '') {
  if (condition) {
    passed++;
    console.log(`  [PASS] ${message}`);
  } else {
    failed++;
    console.error(`  [FAIL] ${message} -> ${detail}`);
  }
}

console.log('====================================================================');
console.log('SEISMOLIVE v4.0 — Phase P1.1 Response System Test Suite');
console.log('Rigorous Coordinate Anchor · Connector · Routing · State Machine');
console.log('====================================================================\n');

// ----------------------------------------------------------------------------
// CATEGORY 1: Local Tangent Anchor & Coordinate Transform Rigor
// ----------------------------------------------------------------------------
console.log('--- Category 1: Local Tangent Anchor (WGS84 <-> ENU <-> Three.js) ---');

const anchor = new LocalTangentAnchor(HANYANG_BLDG212_ANCHOR);

// 1.1 Anchor position ENU must be [0, 0, 0]
const [e0, n0, u0] = anchor.geodeticToENU(HANYANG_BLDG212_ANCHOR.lat, HANYANG_BLDG212_ANCHOR.lon, HANYANG_BLDG212_ANCHOR.h);
const originError = Math.hypot(e0, n0, u0);
assert(originError < 1e-6, '1.1: Anchor Origin is exactly [0, 0, 0] in local ENU', `error=${originError.toExponential(3)}m`);

// 1.2 Moving East 100m -> Three.js [+100, 0, 0]
const threeEast = anchor.enuToLocalThree(100.0, 0.0, 0.0);
assert(
  Math.abs(threeEast[0] - 100.0) < 1e-9 &&
  Math.abs(threeEast[1] - 0.0) < 1e-9 &&
  Math.abs(threeEast[2] - 0.0) < 1e-9,
  '1.2: Moving +100m East maps strictly to Three.js [+100, 0, 0]',
  `actual=${JSON.stringify(threeEast)}`
);

// 1.3 Moving North 100m -> Three.js [0, 0, -100]
const threeNorth = anchor.enuToLocalThree(0.0, 100.0, 0.0);
assert(
  Math.abs(threeNorth[0] - 0.0) < 1e-9 &&
  Math.abs(threeNorth[1] - 0.0) < 1e-9 &&
  Math.abs(threeNorth[2] - (-100.0)) < 1e-9,
  '1.3: Moving +100m North maps strictly to Three.js [0, 0, -100]',
  `actual=${JSON.stringify(threeNorth)}`
);

// 1.4 Moving Up 10m -> Three.js [0, +10, 0]
const threeUp = anchor.enuToLocalThree(0.0, 0.0, 10.0);
assert(
  Math.abs(threeUp[0] - 0.0) < 1e-9 &&
  Math.abs(threeUp[1] - 10.0) < 1e-9 &&
  Math.abs(threeUp[2] - 0.0) < 1e-9,
  '1.4: Moving +10m Up maps strictly to Three.js [0, +10, 0] (Zenith normal)',
  `actual=${JSON.stringify(threeUp)}`
);

// 1.5 Roundtrip Conversion: WGS84 -> Three.js Local -> WGS84
const testGeoPoints = [
  { name: 'Anchor Origin', lat: 37.555815, lon: 127.045053, h: 42.0 },
  { name: '3F Classroom 301 Approx', lat: 37.555800, lon: 127.045000, h: 49.2 },
  { name: '1F SE Exit Portal', lat: 37.555620, lon: 127.045180, h: 42.0 },
  { name: 'Main Stadium Centroid', lat: 37.553850, lon: 127.047620, h: 28.5 }
];

testGeoPoints.forEach((pt, idx) => {
  const [xL, yL, zL] = anchor.geodeticToLocalThree(pt.lat, pt.lon, pt.h);
  const backGeo = anchor.localThreeToGeodetic(xL, yL, zL);

  const latErr = Math.abs(backGeo.lat - pt.lat);
  const lonErr = Math.abs(backGeo.lon - pt.lon);
  const hErr = Math.abs(backGeo.h - pt.h);

  // Sub-millimeter accuracy worldwide
  const ok = latErr < 1e-8 && lonErr < 1e-8 && hErr < 1e-3;
  assert(
    ok,
    `1.5.${idx + 1}: Roundtrip Geodetic <-> Three.js Local: ${pt.name}`,
    `latErr=${latErr.toExponential(3)}, lonErr=${lonErr.toExponential(3)}, hErr=${hErr.toExponential(3)}m`
  );
});

// 1.6 Anchor placement relative to Global Three.js Scene Origin
const placementCoincident = anchor.computeScenePlacement(HANYANG_BLDG212_ANCHOR.lat, HANYANG_BLDG212_ANCHOR.lon);
assert(
  placementCoincident.isCoincidentWithSceneOrigin === true &&
  Math.hypot(...placementCoincident.worldPositionUnits) < 1e-9,
  '1.6.1: When scene origin is the anchor, world position is strictly [0, 0, 0]'
);

// When scene origin is Gyeongju Epicenter (35.76N, 129.19E)
const gyeongjuOrigin = { lat: 35.76, lon: 129.19 };
const placementRemote = anchor.computeScenePlacement(gyeongjuOrigin.lat, gyeongjuOrigin.lon);
const remoteDistUnits = Math.hypot(...placementRemote.worldPositionUnits);
// Distance ~ 200 km -> ~2.0 Three.js units (scale 1 unit = 100km)
assert(
  remoteDistUnits > 1.5 && remoteDistUnits < 3.0,
  '1.6.2: When scene origin is remote epicenter, anchor places correctly in global units',
  `distUnits=${remoteDistUnits.toFixed(4)}`
);

// ----------------------------------------------------------------------------
// CATEGORY 2: Explicit Indoor-Outdoor Connector Verification
// ----------------------------------------------------------------------------
console.log('\n--- Category 2: Explicit Indoor-Outdoor Connector ---');

// 2.1 Connector Geometry & Hardware Integrity
assert(
  HANYANG_BLDG212_SE_CONNECTOR.geometry.lengthMeters === 4.0,
  '2.1: Connector spans exactly 4.0m physical transition between 1F exit and OSM node 6415394841'
);
assert(
  HANYANG_BLDG212_SE_CONNECTOR.hardware.doorType === PORTAL_DOOR_TYPES.DOUBLE_LEAF_FIRE_DOOR &&
  HANYANG_BLDG212_SE_CONNECTOR.hardware.clearWidthMeters === 1.80,
  '2.2: Door hardware specifies double-leaf fire door with 1.80m clear width'
);

// 2.3 Normal Operation Passability
const normalEval = HANYANG_BLDG212_SE_CONNECTOR.evaluatePassability({});
assert(normalEval.isPassable === true, '2.3: Passable under normal operational conditions');

// 2.4 Power Outage Fail-Safe Behavior
const powerOutEval = HANYANG_BLDG212_SE_CONNECTOR.evaluatePassability({ isPowerOut: true });
assert(
  powerOutEval.isPassable === true,
  '2.4: Magnetic lock drops on power outage (FAIL_SAFE); door remains passable'
);

// 2.5 Mechanical Door Jamming Impasse
const jammedEval = HANYANG_BLDG212_SE_CONNECTOR.evaluatePassability({ isDoorMechanicallyJammed: true });
assert(
  jammedEval.isPassable === false && jammedEval.reason.includes('DOOR_MECHANICALLY_JAMMED'),
  '2.5: Mechanical deformation correctly blocks door passability and warns for alternative egress'
);

// 2.6 Wheelchair Accessibility Evaluation
const wheelchairEval = HANYANG_BLDG212_SE_CONNECTOR.evaluatePassability({ requiresWheelchair: true });
assert(
  wheelchairEval.isPassable === true,
  '2.6: Wheelchair passability confirmed with 1.80m width and 1:12 ramp specification'
);

// 2.7 Provenance Classification: Hardware & Lock must be PROVISIONAL
assert(
  HANYANG_BLDG212_SE_CONNECTOR.provenance.status === EGRESS_STATUS.PROVISIONAL &&
  HANYANG_BLDG212_SE_CONNECTOR.hardware.hardwareProvenance === EGRESS_STATUS.PROVISIONAL,
  '2.7: Connector door hardware and lock mechanism are strictly classified as PROVISIONAL'
);

// ----------------------------------------------------------------------------
// CATEGORY 3: Pedestrian Routing Engine & Baseline Recomputation
// ----------------------------------------------------------------------------
console.log('\n--- Category 3: Pedestrian Routing Engine & Dual-Path Recomputation ---');

const router = new PedestrianRoutingEngine();

// 3.1 Shortest Outdoor Path Recomputation
const shortestPath = router.findOutdoorShortestPath();
assert(
  shortestPath.found === true,
  '3.1.1: Shortest outdoor path resolved via Dijkstra'
);
assert(
  Math.abs(shortestPath.totalDistanceMeters - ROUTE_BASELINES.PATH_SHORTEST_RAPID.targetLengthMeters) < 0.5,
  `3.1.2: Shortest path distance matches P0.2 baseline (Found: ${shortestPath.totalDistanceMeters}m | Baseline: ${ROUTE_BASELINES.PATH_SHORTEST_RAPID.targetLengthMeters}m)`
);
assert(
  shortestPath.stairFlightCount === ROUTE_BASELINES.PATH_SHORTEST_RAPID.stairSegmentCount &&
  Math.abs(shortestPath.totalStairsDistanceMeters - ROUTE_BASELINES.PATH_SHORTEST_RAPID.stairTotalLengthMeters) < 0.5,
  `3.1.3: Shortest path correctly traverses 4 outdoor flights of stairs (${shortestPath.totalStairsDistanceMeters}m of stairs)`
);
assert(
  shortestPath.isWheelchairPassable === false,
  '3.1.4: Shortest path correctly flags isWheelchairPassable = false due to outdoor stairways'
);

// 3.2 Step-Free Detour Path Recomputation
const stepFreePath = router.findOutdoorStepFreePath();
assert(
  stepFreePath.found === true,
  '3.2.1: Step-Free detour path resolved via Dijkstra'
);
assert(
  Math.abs(stepFreePath.totalDistanceMeters - ROUTE_BASELINES.PATH_STEP_FREE_DETOUR.targetLengthMeters) < 0.5,
  `3.2.2: Step-free path distance matches P0.2 baseline (Found: ${stepFreePath.totalDistanceMeters}m | Baseline: ${ROUTE_BASELINES.PATH_STEP_FREE_DETOUR.targetLengthMeters}m)`
);
assert(
  stepFreePath.hasStairs === false && stepFreePath.totalStairsDistanceMeters === 0.0,
  '3.2.3: Step-free detour path contains strictly ZERO stairs (0.0m)'
);
assert(
  stepFreePath.isWheelchairPassable === true,
  '3.2.4: Step-free detour path is fully accessible for wheelchair and mobility-impaired users'
);

// 3.3 Dynamic Obstruction: Blocking Staircase 1 forces detour
router.blockedEdges.add('NODE_STAIR1_TOP->NODE_STAIR1_BOT');
const reroutedPath = router.findPath('OSM_NODE_6415394841', 'OSM_NODE_8577408700', { excludeStairs: false });
assert(
  reroutedPath.totalDistanceMeters === ROUTE_BASELINES.PATH_STEP_FREE_DETOUR.targetLengthMeters,
  `3.3: Stair blockage dynamically reroutes to step-free path (${reroutedPath.totalDistanceMeters}m)`
);
router.blockedEdges.clear(); // Reset

// 3.4 Complete Evacuation: 3F Classroom 301 to Stadium Shelter Centroid
const completePath = router.findCompleteIndoorOutdoorPath('ROOM_301', { excludeStairs: false });
assert(
  completePath.found === true,
  `3.4.1: Complete path resolved from Room 301 to Stadium Pitch Centroid`
);
// Total = Indoor (3.5 + 10 + 10 + 8.5 + 24.8 + 3.5 = 60.3m) + Connector (4.0m) + Outdoor (651.9m) + Ingress (21.7m) = 737.9m
assert(
  completePath.totalDistanceMeters > 730 && completePath.totalDistanceMeters < 745,
  `3.4.2: Complete path distance verified (Found: ${completePath.totalDistanceMeters}m | Expected: ~737.9m)`
);

// ----------------------------------------------------------------------------
// CATEGORY 4: Response State Machine & Non-Timer Behavioral Rigor
// ----------------------------------------------------------------------------
console.log('\n--- Category 4: Response State Machine & Observable-Cue Triggers ---');

const sm = new ResponseStateMachine();

// 4.1 Initial State is S1_SHAKING
assert(sm.currentState === RESPONSE_STATES.S1_SHAKING, '4.1: Initial state is S1_SHAKING');

// 4.2 Zero Timer Auto-Transition: Stepping while shaking must NOT transition
const earlyStep = sm.stepTransition();
assert(
  earlyStep.success === false && sm.currentState === RESPONSE_STATES.S1_SHAKING,
  '4.2: Zero auto-transition: remains in S1_SHAKING while ground motion is active'
);

// 4.3 Station confirms shaking stopped for >= 10s -> Transitions to S2
sm.updateStationObservation(0.01, false, 12.0); // PGA 0.01g, inactive, 12s quiescent
const toS2 = sm.stepTransition();
assert(
  toS2.success === true && sm.currentState === RESPONSE_STATES.S2_POST_SHAKING_ASSESSMENT,
  '4.3: Transitions to S2_POST_SHAKING_ASSESSMENT when station confirms stable quiescence'
);

// 4.4 Hazard Priority Branch: Fire/Smoke reports immediately trigger S3 evacuation
sm.submitUserReport({ hasFireOrSmoke: true });
const fireEscalation = sm.stepTransition();
assert(
  fireEscalation.success === true && sm.currentState === RESPONSE_STATES.S3_ACTION_DECISION,
  '4.4: Priority emergency branch: Fire report immediately triggers S3_ACTION_DECISION'
);

// 4.5 Egress Blocked Branch: Jammed door branches to SHELTER_IN_PLACE
sm.submitUserReport({ isExitDoorJammed: true });
const jamBranch = sm.stepTransition();
assert(
  jamBranch.success === true && sm.currentState === RESPONSE_STATES.SHELTER_IN_PLACE,
  '4.5: Jammed door correctly branches to SHELTER_IN_PLACE safety protocol'
);

// 4.6 Rescue unblocking re-opens evacuation
sm.submitUserReport({ isExitDoorJammed: false, isStairwellBlocked: false });
sm.stepTransition(); // Back to S3
assert(sm.currentState === RESPONSE_STATES.S3_ACTION_DECISION, '4.6.1: Cleared obstacle returns to S3_ACTION_DECISION');

const toS4 = sm.stepTransition(); // To S4
assert(toS4.success === true && sm.currentState === RESPONSE_STATES.S4_EXTERIOR_EGRESS, '4.6.2: S3 transitions to S4_EXTERIOR_EGRESS');

// 4.7 Exterior Egress to Pedestrian Transit
sm.updateMilestone('groundExitPassed', true);
sm.updateMilestone('debrisZoneCleared', true);
const toS5 = sm.stepTransition();
assert(
  toS5.success === true && sm.currentState === RESPONSE_STATES.S5_PEDESTRIAN_TRANSIT,
  '4.7: Clearing 1F exit door and 6m debris zone transitions to S5_PEDESTRIAN_TRANSIT'
);

// 4.8 Pedestrian Transit to Shelter Arrival
sm.updateMilestone('stadiumBoundaryReached', true);
const toS6 = sm.stepTransition();
assert(
  toS6.success === true && sm.currentState === RESPONSE_STATES.S6_SHELTER_ARRIVAL,
  '4.8: Reaching stadium perimeter node transitions to S6_SHELTER_ARRIVAL'
);

// 4.9 Aftershock Regression Test
// Reset to S2 and trigger sudden strong aftershock (PGA 0.12g)
const sm2 = new ResponseStateMachine(RESPONSE_STATES.S2_POST_SHAKING_ASSESSMENT);
sm2.updateStationObservation(0.12, true, 0.0);
assert(
  sm2.currentState === RESPONSE_STATES.S1_SHAKING,
  '4.9: Severe aftershock during S2 instantly triggers regression back to S1_SHAKING'
);

// ----------------------------------------------------------------------------
// CATEGORY 5: Data Provenance & Scientific Integrity
// ----------------------------------------------------------------------------
console.log('\n--- Category 5: Data Provenance & Anti-Pseudoscience Standards ---');

// 5.1 3F Indoor Graph remains PROVISIONAL
assert(
  HANYANG_3F_INDOOR_GRAPH.provenance === VERIFICATION_STATUS.PROVISIONAL,
  '5.1: 3F indoor spatial graph remains strictly classified as PROVISIONAL'
);

// 5.2 Building Metadata holds explicit verification tags
assert(
  HANYANG_BUILDING_METADATA.osmReference.provenance === VERIFICATION_STATUS.VERIFIED &&
  HANYANG_BUILDING_METADATA.seismicAttributes.provenance === VERIFICATION_STATUS.PARTIALLY_VERIFIED,
  '5.2: Building attributes preserve separate VERIFIED vs PARTIALLY_VERIFIED provenance'
);

// 5.3 Behavior instruction tags distinguish station observation vs user reports
const smS1 = new ResponseStateMachine(RESPONSE_STATES.S1_SHAKING);
const s1Instruction = smS1.getCurrentInstruction();
assert(
  s1Instruction.sourceTag === DATA_PROVENANCE_SOURCE.OBSERVED_STATION,
  '5.3.1: S1 instruction is attributed to OBSERVED_STATION'
);
const s2Instruction = (new ResponseStateMachine(RESPONSE_STATES.S2_POST_SHAKING_ASSESSMENT)).getCurrentInstruction();
assert(
  s2Instruction.sourceTag === DATA_PROVENANCE_SOURCE.USER_FIELD_REPORT,
  '5.3.2: S2 assessment instruction is attributed to USER_FIELD_REPORT'
);

console.log('\n====================================================================');
console.log(`TEST SUITE RESULTS: ${passed} PASSED | ${failed} FAILED`);
console.log('====================================================================');

if (failed > 0) {
  Deno.exit(1);
}
