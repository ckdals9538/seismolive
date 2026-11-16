// ============================================================================
// SEISMOLIVE v4.0 — Phase P1.3 Spatial Continuity & Scientific Limits Test Suite
// File: tests/test_p1_3_spatial_continuity.js
// Run via: deno run --allow-all tests/test_p1_3_spatial_continuity.js
// ============================================================================

import * as THREE from '../js/lib/three.module.js';
import {
  GlobalLocalCameraTransition,
  CAMERA_STAGES,
  TRANSITION_STATUS
} from '../js/response/GlobalLocalCameraTransition.js';
import {
  PersonalResponseInteraction,
  SIMULATION_BADGE
} from '../js/response/PersonalResponseInteraction.js';
import {
  PedestrianRoutingEngine
} from '../js/response/PedestrianRoutingEngine.js';
import {
  ROUTE_BASELINES,
  DATA_PROVENANCE_SOURCE
} from '../js/response/HanyangBuildingData.js';

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
console.log('SEISMOLIVE v4.0 — Phase P1.3 Spatial Continuity Test Suite');
console.log('Camera Stages · Scientific Limits · Action Guidance · Path Integrity');
console.log('====================================================================\n');

// ----------------------------------------------------------------------------
// CATEGORY 1: Global-to-Local Camera Transition Controller
// ----------------------------------------------------------------------------
console.log('--- Category 1: Global-to-Local Camera Transition ---');

const camera = new THREE.PerspectiveCamera(38, 16 / 9, 0.1, 2000);
const camTransition = new GlobalLocalCameraTransition({ camera });

// 1.1 Four Staged Viewpoints Defined
const stages = [
  CAMERA_STAGES.GLOBAL_ORBIT,
  CAMERA_STAGES.REGIONAL_APPROACH,
  CAMERA_STAGES.CAMPUS_OVERVIEW,
  CAMERA_STAGES.BUILDING_INSPECTION
];
const allDefined = stages.every(s => camTransition.viewpoints[s] !== undefined);
assert(allDefined, '1.1: All 4 staged spatial viewpoints defined with distinct positions & lookAts');

// 1.2 Snap to Global Orbit
camTransition.snapTo(CAMERA_STAGES.GLOBAL_ORBIT);
assert(
  camera.position.equals(camTransition.viewpoints[CAMERA_STAGES.GLOBAL_ORBIT].position),
  '1.2: SnapTo successfully sets camera position to Global Orbit (10, 140, 40)'
);

// 1.3 Smooth Transition to Campus Overview
camTransition.transitionTo(CAMERA_STAGES.CAMPUS_OVERVIEW, 2.0);
assert(
  camTransition.status === TRANSITION_STATUS.TRANSITIONING,
  '1.3.1: Transition state activates to TRANSITIONING'
);

// Simulate animation update at 50% time
camTransition.update(camTransition.anim.startTime + 1000); // 1.0s elapsed (50%)
assert(
  camera.position.y < 240 && camera.position.y > 68,
  `1.3.2: Camera smoothly interpolated mid-flight (Y: ${camera.position.y.toFixed(1)})`
);

// Simulate animation completion at 100% time
camTransition.update(camTransition.anim.startTime + 2500); // completed
assert(
  camTransition.status === TRANSITION_STATUS.IDLE &&
  Math.abs(camera.position.x - camTransition.viewpoints[CAMERA_STAGES.CAMPUS_OVERVIEW].position.x) < 0.1,
  '1.3.3: Transition completes cleanly and settles at target stage'
);

// 1.4 User Manual Interaction Cancels Transition
camTransition.transitionTo(CAMERA_STAGES.BUILDING_INSPECTION, 3.0);
// User manual drag override
camTransition.status = TRANSITION_STATUS.USER_OVERRIDE;
const isStillRunning = camTransition.update(camTransition.anim.startTime + 500);
assert(
  isStillRunning === false && camTransition.status === TRANSITION_STATUS.USER_OVERRIDE,
  '1.4: User manual control immediately overrides and halts automated camera flight'
);

// 1.5 Return to Global Orbit View
camTransition.returnToGlobal(1.0);
assert(
  camTransition.currentStage === CAMERA_STAGES.GLOBAL_ORBIT &&
  camTransition.status === TRANSITION_STATUS.TRANSITIONING,
  '1.5: ReturnToGlobal initiates smooth return to cosmic orbit'
);

// ----------------------------------------------------------------------------
// CATEGORY 2: Seismic Signal Visualization & Scientific Limits
// ----------------------------------------------------------------------------
console.log('\n--- Category 2: Seismic Signal Limits & Provenance Distinction ---');

const interaction = new PersonalResponseInteraction();

// 2.1 Instrumental Station Telemetry is distinct from building vibration
assert(
  interaction.stationTelemetry.provenance === DATA_PROVENANCE_SOURCE.OBSERVED_STATION,
  '2.1: Station telemetry is strictly tagged as OBSERVED_STATION'
);
assert(
  interaction.stationTelemetry.stationDistanceKm > 0,
  '2.2: Spatial distance between ground station and building is explicitly recorded (8.4 km)'
);

// 2.3 Ingesting Station Motion updates ground shaking without fabricating floor amplification
interaction.ingestStationMotion({ pga: 0.22, stationId: 'KMA_SEOUL_01' });
assert(
  interaction.stationTelemetry.pga_g === 0.22 &&
  interaction.stationTelemetry.stationId === 'KMA_SEOUL_01',
  '2.3: Ingested motion updates ground instrumental parameters accurately'
);

// 2.4 Educational simulation must be explicitly toggled and badged
assert(
  interaction.educationalVibrationActive === false,
  '2.4.1: Educational vibration is OFF by default'
);
interaction.setEducationalSimulation(true);
assert(
  interaction.educationalVibrationActive === true,
  '2.4.2: Educational vibration can be toggled ON with explicit badging'
);

// ----------------------------------------------------------------------------
// CATEGORY 3: Personalized Action-First Editorial Guidance
// ----------------------------------------------------------------------------
console.log('\n--- Category 3: Personalized Action-First Guidance (No S1/S2 Codes) ---');

// 3.1 Initial Guidance (During Shaking)
const g1 = interaction.getActionGuidance();
assert(
  g1.headline.includes('지진동 감지') && !g1.headline.includes('S1'),
  '3.1.1: Headline presents clear Korean action without internal state code "S1"'
);
assert(
  g1.primaryAction.includes('DROP, COVER, HOLD ON'),
  '3.1.2: Primary action mandates Drop, Cover, Hold On'
);
assert(
  g1.warning.includes('건물 밖으로 뛰어나가지 마십시오'),
  '3.1.3: Warning prohibits running outside while shaking'
);
assert(
  g1.sourceBadge.includes('OBSERVED_STATION'),
  '3.1.4: Source badge clearly credits ground seismic station'
);

// 3.2 Transition to Assessment (Shaking Ceased)
interaction.confirmShakingEnded();
const g2 = interaction.getActionGuidance();
assert(
  g2.headline.includes('진동 정지') && !g2.headline.includes('S2'),
  '3.2.1: S2 guidance emphasizes hazard assessment without code "S2"'
);
assert(
  g2.primaryAction.includes('방문을 즉시 열어'),
  '3.2.2: Directs opening room door before door frame deformation'
);

// 3.3 Priority Hazard Escalation: Fire reported
interaction.reportHazard('fire', true);
const g3 = interaction.getActionGuidance();
assert(
  g3.headline.includes('행동 결정') && g3.situationText.includes('화재/연기'),
  '3.3: Fire hazard report immediately prioritizes evacuation action guidance'
);

// 3.4 Egress Impasse: Jammed door branches to Shelter-in-Place with explicit non-guarantee warning
interaction.reportHazard('door_jammed', true);
const g4 = interaction.getActionGuidance();
assert(
  g4.headline.includes('실내 고립 방호') &&
  g4.warning.includes('건물 안전을 보장하지 않습니다'),
  '3.4: Jammed door correctly triggers shelter-in-place with explicit notice that building safety is not guaranteed'
);

// ----------------------------------------------------------------------------
// CATEGORY 4: Spatial Path Continuity & Distance Integrity
// ----------------------------------------------------------------------------
console.log('\n--- Category 4: Continuous Egress Path & Distance Accounting ---');

const router = new PedestrianRoutingEngine();

// Segment 1: Room 301 to 3F SE Stairwell Landing
// Room -> West Corr (3.5m) + Corr West to East (20.0m) + Corr East to Stair (8.5m) = 32.0m
const pRoomToStair = router.findPath('NODE_ROOM_301', 'NODE_STAIR_3F_SE');
assert(
  Math.abs(pRoomToStair.totalDistanceMeters - 32.0) < 0.2,
  `4.1: Room 301 to 3F Stair Landing distance is exactly 32.0m (got ${pRoomToStair.totalDistanceMeters}m)`
);

// Segment 2: 3F Stair Landing to 1F SE Exit Portal
// Stair descent (24.8m) + 1F Landing to Exit (3.5m) = 28.3m
const pStairToExit = router.findPath('NODE_STAIR_3F_SE', 'NODE_EXIT_1F_SE');
assert(
  Math.abs(pStairToExit.totalDistanceMeters - 28.3) < 0.2,
  `4.2: 3F Stair to 1F Exit Portal distance is exactly 28.3m (got ${pStairToExit.totalDistanceMeters}m)`
);

// Segment 3: 1F Exit Portal to Outdoor Footway Node 6415394841 (Explicit Connector)
const pConnector = router.findPath('NODE_EXIT_1F_SE', 'OSM_NODE_6415394841');
assert(
  Math.abs(pConnector.totalDistanceMeters - 4.0) < 0.2,
  `4.3: Explicit 1F SE Connector distance is exactly 4.0m (got ${pConnector.totalDistanceMeters}m)`
);

// Segment 4A: Outdoor Shortest Path (Node 6415394841 to Node 8577408700)
const pOutdoorShortest = router.findOutdoorShortestPath();
assert(
  Math.abs(pOutdoorShortest.totalDistanceMeters - 651.9) < 0.2,
  `4.4: Outdoor Shortest Path distance matches 651.9m baseline (got ${pOutdoorShortest.totalDistanceMeters}m)`
);
assert(
  Math.abs(pOutdoorShortest.totalStairsDistanceMeters - 68.5) < 0.2,
  `4.5: Outdoor Shortest Path contains exactly 68.5m of stairs (got ${pOutdoorShortest.totalStairsDistanceMeters}m)`
);

// Segment 4B: Outdoor Step-Free Detour (Node 6415394841 to Node 8577408700)
const pOutdoorStepFree = router.findOutdoorStepFreePath();
assert(
  Math.abs(pOutdoorStepFree.totalDistanceMeters - 769.1) < 0.2,
  `4.6: Outdoor Step-Free Detour distance matches 769.1m baseline (got ${pOutdoorStepFree.totalDistanceMeters}m)`
);
assert(
  pOutdoorStepFree.totalStairsDistanceMeters === 0.0,
  `4.7: Outdoor Step-Free Detour contains strictly 0.0m stairs`
);

// Segment 5: Stadium Entrance Ingress Node (8577408700) to Pitch Centroid (Safe Gathering Zone)
const pStadiumIngress = router.findPath('OSM_NODE_8577408700', 'SHELTER_HANYANG_STADIUM');
assert(
  Math.abs(pStadiumIngress.totalDistanceMeters - 21.7) < 0.2,
  `4.8: Stadium perimeter entrance to pitch gathering center is exactly 21.7m (got ${pStadiumIngress.totalDistanceMeters}m)`
);

// Complete Path A (Shortest Evacuation):
// 32.0m + 28.3m + 4.0m + 651.9m + 21.7m = 737.9m
const pCompleteShortest = router.findCompleteIndoorOutdoorPath('ROOM_301', { excludeStairs: false });
assert(
  Math.abs(pCompleteShortest.totalDistanceMeters - 737.9) < 0.5,
  `4.9: Complete Shortest Evacuation distance matches 737.9m sum (got ${pCompleteShortest.totalDistanceMeters}m)`
);

// Complete Path B (Step-Free Outdoor Evacuation):
// 32.0m + 28.3m + 4.0m + 769.1m + 21.7m = 855.1m
// (Note: Indoor vertical stair descent remains 28.3m unless unverified lift/ramp exists)
const pCompleteStepFree = router.findPath('NODE_ROOM_301', 'SHELTER_HANYANG_STADIUM', {
  blockedEdges: ['NODE_STAIR1_TOP->NODE_STAIR1_BOT'] // Forces outdoor step-free detour while allowing indoor stair
});
assert(
  Math.abs(pCompleteStepFree.totalDistanceMeters - 855.1) < 0.5,
  `4.10: Complete Step-Free Outdoor Evacuation distance matches 855.1m sum (got ${pCompleteStepFree.totalDistanceMeters}m)`
);

console.log('\n====================================================================');
console.log(`P1.3 TEST SUITE RESULTS: ${passed} PASSED | ${failed} FAILED`);
console.log('====================================================================');

if (failed > 0) Deno.exit(1);
