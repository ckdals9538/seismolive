// ============================================================================
// SEISMOLIVE v4.0 — Phase 3~6 Spatial Integration & Tier 1 Verification Suite
// File: tests/test_phase3_to_6_spatial_integration.js
// Run via: deno run --allow-all tests/test_phase3_to_6_spatial_integration.js
// ============================================================================

import * as THREE from '../js/lib/three.module.js';
import { REGIONAL_TERRAIN_FRAGMENT_SHADER } from '../js/3d/shaders/SeismicTerrainShaders.js';
import {
  GlobalLocalCameraTransition,
  CAMERA_STAGES,
  TRANSITION_STATUS
} from '../js/response/GlobalLocalCameraTransition.js';
import {
  softClipArctanNormalize,
  splitDualBandSeismicSignal
} from '../js/data/StationWaveformBridge.js';
import {
  synthesizeDualBandAudifiedSamples
} from '../js/audio/livingSoundfieldEngine.js';
import {
  SituationAssessmentEngine,
  MOBILITY_PROFILE,
  LOCATION_CERTAINTY,
  ASSESSMENT_URGENCY
} from '../js/response/SituationAssessmentEngine.js';
import {
  ResponseStateMachine,
  RESPONSE_STATES
} from '../js/response/ResponseStateMachine.js';
import {
  VERIFICATION_STATUS
} from '../js/response/ResponseDomainTypes.js';
import {
  HANYANG_LOCAL_4KM_PACKAGE,
  HANYANG_LOCAL_SPATIAL_VIEWPOINTS,
  OBB_BUILDING_STRIDE,
  OBB_LOD_COUNTS
} from '../js/response/HanyangLocalSpatialData.js';
import {
  LocalSpatialMapLayer,
  samplePointAlong3D,
  solveLabelCollisions2D
} from '../js/response/LocalSpatialMapLayer.js';

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
    if (detail) console.error(`         -> FAIL: ${detail}`);
  }
}

console.log('====================================================================');
console.log('SEISMOLIVE v4.0 — Phase 3~6 Strategy C & Tier 1 Integration Tests');
console.log('====================================================================\n');

// ----------------------------------------------------------------------------
// 1. T-X Probe Uniforms & Pure Physical Mode Shader Integrity
// ----------------------------------------------------------------------------
console.log('--- 1. Shader Uniforms & Pure Physical Mode Parity ---');
{
  assert(
    REGIONAL_TERRAIN_FRAGMENT_SHADER.includes('uniform float u_probeDistUnits;') &&
    REGIONAL_TERRAIN_FRAGMENT_SHADER.includes('uniform float u_probeCritUnits;') &&
    REGIONAL_TERRAIN_FRAGMENT_SHADER.includes('uniform float u_probeCrossUnits;') &&
    REGIONAL_TERRAIN_FRAGMENT_SHADER.includes('uniform float u_purePhysicalMode;'),
    '1.1: REGIONAL_TERRAIN_FRAGMENT_SHADER declares all 4 previously ghosted T-X/physical uniforms'
  );
  assert(
    REGIONAL_TERRAIN_FRAGMENT_SHADER.includes('opticalMask > 0.5 && u_enableStratum2 > 0.5'),
    '1.2: Stratum 2 optical synthesis gated cleanly by u_purePhysicalMode'
  );
}

// ----------------------------------------------------------------------------
// 2. Expanded Camera Subterranean Guards
// ----------------------------------------------------------------------------
console.log('\n--- 2. Subterranean Camera Guard across REGIONAL_APPROACH ---');
{
  const camera = new THREE.PerspectiveCamera(40, 1.77, 0.1, 5000);
  const camTransition = new GlobalLocalCameraTransition({ camera });
  camTransition.transitionTo(CAMERA_STAGES.REGIONAL_APPROACH, 2.0);
  camera.position.set(100, -120, 100);
  camTransition.anim.startPos.set(100, -120, 100);
  camTransition.anim.targetPos.set(100, -30, 100);
  camTransition.update(camTransition.anim.startTime + 500);

  assert(
    camera.position.y >= 45.0,
    '2.1: REGIONAL_APPROACH camera transition prevents subterranean dive (y >= 45m)',
    `Clamped altitude: ${camera.position.y.toFixed(1)}m`
  );
}

// ----------------------------------------------------------------------------
// 3. Dual-Band Seismic Audification & Soft Clipping (SEIS-SOUND + Earthtunes)
// ----------------------------------------------------------------------------
console.log('\n--- 3. Dual-Band Audification & Arctan Soft-Clipping ---');
{
  const sr = 100; // Hz
  const durationSec = 20;
  const n = sr * durationSec;
  const composite = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / sr;
    // Combine 0.15 Hz surface wave + 3.5 Hz body wave
    composite[i] = 2.0e-4 * Math.sin(2 * Math.PI * 0.15 * t) + 1.2e-4 * Math.sin(2 * Math.PI * 3.5 * t);
  }

  const clipped = softClipArctanNormalize(new Float32Array([0, 1e-4, 4e-4, -1e-2]), 1e-4);
  assert(
    clipped[0] === 0 &&
    clipped[1] > clipped[0] &&
    clipped[2] > clipped[1] &&
    clipped[2] < 1.0 &&
    clipped[3] > -1.0 &&
    clipped[3] < 0,
    '3.1: softClipArctanNormalize stays strictly bounded in (-1, 1) while preserving relative order'
  );

  const split = splitDualBandSeismicSignal(composite, sr, 0.5);
  let bodyRms = 0;
  let surfRms = 0;
  for (let i = 200; i < n; i++) {
    bodyRms += split.bodyWave[i] * split.bodyWave[i];
    surfRms += split.surfaceWave[i] * split.surfaceWave[i];
  }
  bodyRms = Math.sqrt(bodyRms / (n - 200));
  surfRms = Math.sqrt(surfRms / (n - 200));
  assert(
    bodyRms > 5e-5 && surfRms > 8e-5,
    '3.2: splitDualBandSeismicSignal cleanly separates >=0.5Hz body wave and <0.5Hz surface wave energy',
    `bodyRms=${bodyRms.toExponential(2)}, surfRms=${surfRms.toExponential(2)}`
  );

  const synth = synthesizeDualBandAudifiedSamples(composite, sr, {
    audioSampleRate: 8000,
    speedFactor: 40
  });
  assert(
    synth.leftBodyChannel.length > 0 &&
    synth.rightSurfaceChannel.length === synth.leftBodyChannel.length &&
    synth.bodyBandRms > 0.05 &&
    synth.surfaceBandRms > 0.05,
    '3.3: synthesizeDualBandAudifiedSamples produces stereo body+VCO surface channels',
    `samples=${synth.leftBodyChannel.length}, L_rms=${synth.bodyBandRms.toFixed(3)}, R_rms=${synth.surfaceBandRms.toFixed(3)}`
  );
}

// ----------------------------------------------------------------------------
// 4. Wheelchair "Lock, Cover, Hold On" Protocol During Active Shaking
// ----------------------------------------------------------------------------
console.log('\n--- 4. Wheelchair Shaking Protocol (Lock, Cover, Hold On) ---');
{
  const engine = new SituationAssessmentEngine();
  const res = engine.assess({
    disaster: { isShakingActive: true, pga_g: 0.19 },
    user: {
      locationType: 'INDOOR',
      floor: 3,
      locationCertainty: LOCATION_CERTAINTY.EXACT_ROOM,
      mobilityLimitation: MOBILITY_PROFILE.WHEELCHAIR
    }
  });

  assert(
    res.recommendedAction.urgency === ASSESSMENT_URGENCY.IMMEDIATE &&
    res.canMove === false &&
    res.canNavigate === false &&
    res.recommendedAction.primary.includes('Lock, Cover, Hold On') &&
    res.recommendedAction.primary.includes('바퀴'),
    '4.1: Active indoor shaking with WHEELCHAIR profile emits "Lock, Cover, Hold On" with wheel-lock directive'
  );

  const fsm = new ResponseStateMachine(RESPONSE_STATES.S1_SHAKING);
  fsm.submitUserReport({ requiresWheelchair: true });
  const instr = fsm.getCurrentInstruction();
  assert(
    instr.coreAction.includes('LOCK, COVER, HOLD ON'),
    '4.2: ResponseStateMachine S1_SHAKING instruction switches to LOCK, COVER, HOLD ON for wheelchair user'
  );
}

// ----------------------------------------------------------------------------
// 5. 4km Local Spatial Data Package & Static JSON Mirror
// ----------------------------------------------------------------------------
console.log('\n--- 5. 4km Local Spatial Package & Height-Sorted OBB Array ---');
{
  const { obbBuildingsFloat32, obbLodCounts, terrainAndHydrology, sheltersAndFacilities } = HANYANG_LOCAL_4KM_PACKAGE;
  const count = obbLodCounts.fullCount;

  assert(
    obbBuildingsFloat32 instanceof Float32Array &&
    obbBuildingsFloat32.length === count * OBB_BUILDING_STRIDE &&
    obbLodCounts.overviewCount < count,
    '5.1: 6-float32 OBB TypedArray and LOD overview/full counts initialized',
    `overview=${obbLodCounts.overviewCount}, full=${count}`
  );

  let sortedDesc = true;
  for (let i = 0; i < count - 1; i++) {
    const hCur = obbBuildingsFloat32[i * OBB_BUILDING_STRIDE + 5];
    const hNext = obbBuildingsFloat32[(i + 1) * OBB_BUILDING_STRIDE + 5];
    if (hCur < hNext) {
      sortedDesc = false;
      break;
    }
  }
  assert(sortedDesc, '5.2: OBB context buildings strictly sorted in descending height order');

  assert(
    terrainAndHydrology.alluvialCautionZone.verificationStatus === VERIFICATION_STATUS.PROVISIONAL &&
    sheltersAndFacilities.some(s => s.id === 'OA-21060'),
    '5.3: Alluvial basin caution zone tagged PROVISIONAL and OA-21060 Hanyang Stadium shelter present'
  );

  const jsonText = Deno.readTextFileSync('assets/data/hanyang_local_spatial_4km.json');
  const parsed = JSON.parse(jsonText);
  assert(
    parsed.obbBuildings?.lodCounts?.fullCount === count &&
    parsed.obbBuildings?.data?.length === count * 6,
    '5.4: Static JSON package assets/data/hanyang_local_spatial_4km.json matches runtime package'
  );
}

// ----------------------------------------------------------------------------
// 6. LocalSpatialMapLayer InstancedMesh, X-Ray, Arc-Length & AABB Labeler
// ----------------------------------------------------------------------------
console.log('\n--- 6. LocalSpatialMapLayer (InstancedMesh, X-Ray, Eco, ArcLength, AABB) ---');
{
  const scene = new THREE.Scene();
  const layer = new LocalSpatialMapLayer(scene);

  const initDiag = layer.getLayerDiagnostics();
  assert(
    layer.instancedBuildings?.isInstancedMesh === true &&
    initDiag.activeInstanceCount === OBB_LOD_COUNTS.fullCount,
    '6.1: LocalSpatialMapLayer mounts 6-float32 OBB THREE.InstancedMesh cleanly'
  );

  layer.syncWithCameraStage(CAMERA_STAGES.BUILDING_INSPECTION);
  const bldgDiag = layer.getLayerDiagnostics();
  assert(
    bldgDiag.xRayEnabled === true &&
    bldgDiag.xRayOpacity <= 0.20 &&
    layer.buildingMaterial.transparent === true &&
    layer.buildingMaterial.depthWrite === false,
    '6.2: BUILDING_INSPECTION automatically engages translucent X-Ray context buildings'
  );

  layer.syncWithCameraStage(CAMERA_STAGES.REGIONAL_APPROACH);
  const regDiag = layer.getLayerDiagnostics();
  assert(
    regDiag.xRayEnabled === false &&
    layer.buildingMaterial.depthWrite === true,
    '6.3: REGIONAL_APPROACH restores opaque basalt urban context'
  );

  layer.setEcoMode(true);
  const ecoDiag = layer.getLayerDiagnostics();
  assert(
    ecoDiag.ecoMode === true &&
    ecoDiag.lodMode === 'OVERVIEW' &&
    ecoDiag.activeInstanceCount === OBB_LOD_COUNTS.overviewCount,
    '6.4: Eco Mode reduces InstancedMesh count from fullCount to height-prioritized overviewCount',
    `${OBB_LOD_COUNTS.fullCount} -> ${ecoDiag.activeInstanceCount} instances`
  );

  // Arc-length route interpolation (3 + 4 -> 5m segment + 10m vertical/Z segment = 15m total)
  const mid = samplePointAlong3D([[0, 0, 0], [3, 4, 0], [3, 4, 10]], 0.5);
  assert(
    Math.abs(mid.totalLength - 15.0) < 1e-6 &&
    Math.abs(mid.point[0] - 3.0) < 1e-6 &&
    Math.abs(mid.point[1] - 4.0) < 1e-6 &&
    Math.abs(mid.point[2] - 2.5) < 1e-6,
    '6.5: samplePointAlong3D computes exact cumulative 3D Euclidean arc-length interpolation',
    `midpoint=[${mid.point.join(', ')}], totalLength=${mid.totalLength}`
  );

  // 2D AABB collision solver (HUD obstacle + overlapping lower-priority label)
  const hudRects = [{ left: 20, top: 20, right: 320, bottom: 120 }];
  const labelResult = solveLabelCollisions2D(
    [
      { id: 'TOP_PRIO', screenX: 600, screenY: 400, width: 140, height: 32, priority: 100, inFront: true },
      { id: 'OVERLAP_PRIO', screenX: 620, screenY: 405, width: 140, height: 32, priority: 60, inFront: true },
      { id: 'HUD_COLLIDE', screenX: 160, screenY: 90, width: 140, height: 32, priority: 90, inFront: true }
    ],
    hudRects,
    { width: 1280, height: 800 },
    6
  );

  const visibleIds = labelResult.visibleLabels.map(v => v.id);
  assert(
    visibleIds.includes('TOP_PRIO') &&
    !visibleIds.includes('OVERLAP_PRIO') &&
    !visibleIds.includes('HUD_COLLIDE'),
    '6.6: solveLabelCollisions2D blocks HUD collisions and keeps higher-priority non-overlapping label'
  );

  layer.dispose();
}

// ----------------------------------------------------------------------------
// SUMMARY
// ----------------------------------------------------------------------------
console.log('\n====================================================================');
console.log(`PHASE 3~6 INTEGRATION TESTS: ${passed} PASSED | ${failed} FAILED`);
console.log('====================================================================\n');

if (failed > 0) {
  Deno.exit(1);
}
