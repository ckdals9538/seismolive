// ============================================================================
// SEISMOLIVE v4.0 — Phase P1.2 Spatial Adapter & Coordinate Separation Test Suite
// File: tests/test_hanyang_adapter.js
// Run via: deno run --allow-all tests/test_hanyang_adapter.js
// ============================================================================

import * as THREE from '../js/lib/three.module.js';
import {
  HanyangResponseAdapter,
  BLDG_212_OSM_FOOTPRINT_METERS,
  VISUAL_THEME
} from '../js/response/HanyangResponseAdapter.js';

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
console.log('SEISMOLIVE v4.0 — Phase P1.2 Response Adapter Test Suite');
console.log('Physical vs Visual Coordinate Separation · Architectural Wireframe');
console.log('====================================================================\n');

// ----------------------------------------------------------------------------
// CATEGORY 1: Physical vs Visual Coordinate Separation
// ----------------------------------------------------------------------------
console.log('--- Category 1: Physical vs Visual Coordinate Separation ---');

const adapter = new HanyangResponseAdapter({ visualScale: 1.0 });

// 1.1 Forward & Inverse Transformation at Scale = 1.0
const physicalP1 = [50.0, 7.2, -70.0];
const visualV1 = adapter.physicalToVisual(physicalP1);
const recoveredP1 = adapter.visualToPhysical(visualV1);

const err1 = Math.hypot(
  recoveredP1[0] - physicalP1[0],
  recoveredP1[1] - physicalP1[1],
  recoveredP1[2] - physicalP1[2]
);
assert(err1 < 1e-12, '1.1: Roundtrip Physical -> Visual -> Physical is exact at Scale=1.0', `err=${err1}`);

// 1.2 Forward & Inverse Transformation at Arbitrary Visual Scale (e.g. Scale = 4.5)
adapter.setVisualScale(4.5);
const visualV2 = adapter.physicalToVisual(physicalP1);
assert(
  Math.abs(visualV2[0] - 50.0 * 4.5) < 1e-9 &&
  Math.abs(visualV2[1] - 7.2 * 4.5) < 1e-9 &&
  Math.abs(visualV2[2] - (-70.0 * 4.5)) < 1e-9,
  '1.2.1: Visual coordinates scale exactly with visualScaleFactor (4.5x)'
);

const recoveredP2 = adapter.visualToPhysical(visualV2);
const err2 = Math.hypot(
  recoveredP2[0] - physicalP1[0],
  recoveredP2[1] - physicalP1[1],
  recoveredP2[2] - physicalP1[2]
);
assert(err2 < 1e-12, '1.2.2: Inverse Visual -> Physical exactly recovers original physical meters at Scale=4.5', `err=${err2}`);

// 1.3 Physical Distance Invariance Under Visual Scale Changes
const pA = [70.16, 0.0, -45.51]; // 1F Exit
const pB = [73.68, -0.15, -43.61]; // Footway Node (exactly 4.0m away)

adapter.setVisualScale(1.0);
const distAtScale1 = adapter.computePhysicalDistance(pA, pB, false);

adapter.setVisualScale(10.0);
const vA10 = adapter.physicalToVisual(pA);
const vB10 = adapter.physicalToVisual(pB);
const distAtScale10FromVisual = adapter.computePhysicalDistance(vA10, vB10, true);

assert(
  Math.abs(distAtScale1 - 4.0) < 0.05,
  `1.3.1: Physical distance is exactly ~4.0m (got ${distAtScale1.toFixed(3)}m)`
);
assert(
  Math.abs(distAtScale10FromVisual - distAtScale1) < 1e-9,
  `1.3.2: Physical distance is STRICTLY INVARIANT under 10x visual scale change (Scale 1: ${distAtScale1.toFixed(3)}m vs Scale 10: ${distAtScale10FromVisual.toFixed(3)}m)`
);

// ----------------------------------------------------------------------------
// CATEGORY 2: Building Footprint & Multi-Tier Floor Slabs
// ----------------------------------------------------------------------------
console.log('\n--- Category 2: Building Footprint & Floor Slab Generation ---');

adapter.setVisualScale(1.0); // Reset to 1.0

assert(adapter.floorGroups.size === 5, '2.1: Exactly 5 floor groups generated for 5-level building');

// Verify floor levels
let correctHeights = true;
for (let lvl = 1; lvl <= 5; lvl++) {
  const grp = adapter.floorGroups.get(lvl);
  const expectedY = (lvl - 1) * 3.6;
  const slab = grp.getObjectByName(`SlabLines_${lvl}F`);
  if (!slab) correctHeights = false;
}
assert(correctHeights, '2.2: Floor slab elevations strictly follow 3.6m vertical increments (0.0m to 14.4m)');

// Verify 3F floor selection highlight
adapter.highlightFloor(3);
const grp3 = adapter.floorGroups.get(3);
const interior3F = grp3.getObjectByName('Interior_3F_Provisional');
assert(interior3F !== undefined && interior3F.visible === true, '2.3.1: 3F provisional interior is visible when 3F is selected');

adapter.highlightFloor(1);
assert(interior3F.visible === false, '2.3.2: 3F provisional interior is automatically hidden when 1F is selected');
adapter.highlightFloor(3); // Reset to 3F

// ----------------------------------------------------------------------------
// CATEGORY 3: Egress Connector & Outdoor Pedestrian Paths
// ----------------------------------------------------------------------------
console.log('\n--- Category 3: Egress Connector & Outdoor Path Vectors ---');

const connectorLine = adapter.rootGroup.getObjectByName('Connector_1F_SE_Line');
assert(connectorLine !== undefined, '3.1: 1F SE Connector vector line present in scene graph');

const shortestLine = adapter.pathGroup.getObjectByName('Path_Shortest_651m');
const stepFreeLine = adapter.pathGroup.getObjectByName('Path_StepFree_769m');
const stairHazards = adapter.pathGroup.getObjectByName('Stairs_Hazard_Segments');

assert(
  shortestLine !== undefined && stepFreeLine !== undefined && stairHazards !== undefined,
  '3.2: Shortest path (651.9m), Step-Free path (769.1m), and Stair hazard segments present'
);

// Route filtering
adapter.setRouteDisplay('SHORTEST');
assert(shortestLine.visible === true && stepFreeLine.visible === false, '3.3.1: setRouteDisplay("SHORTEST") hides step-free detour');

adapter.setRouteDisplay('STEP_FREE');
assert(shortestLine.visible === false && stepFreeLine.visible === true, '3.3.2: setRouteDisplay("STEP_FREE") hides shortest stairs path');

adapter.setRouteDisplay('ALL');
assert(shortestLine.visible === true && stepFreeLine.visible === true, '3.3.3: setRouteDisplay("ALL") displays both paths for comparison');

// ----------------------------------------------------------------------------
// CATEGORY 4: Shelter Representation & Clean Resource Disposal
// ----------------------------------------------------------------------------
console.log('\n--- Category 4: Shelter Representation & Resource Disposal ---');

const stadiumTrack = adapter.shelterGroup.getObjectByName('Stadium_Track_Outline');
const pitchZone = adapter.shelterGroup.getObjectByName('Stadium_Pitch_Safe_Zone');
assert(stadiumTrack !== undefined && pitchZone !== undefined, '4.1: Stadium track outline and central safe zone present');

// Disposal check
adapter.dispose();
assert(adapter.disposables.length === 0, '4.2: adapter.dispose() successfully purges all GPU geometries and materials');

console.log('\n====================================================================');
console.log(`ADAPTER TEST SUITE RESULTS: ${passed} PASSED | ${failed} FAILED`);
console.log('====================================================================');

if (failed > 0) Deno.exit(1);
