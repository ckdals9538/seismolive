// ============================================================================
// SEISMOLIVE v4.0 — Stage 4 Evacuation UX, Seismic Context & Volumetric Path Tests
// File: tests/test_stage4_evacuation_ux_and_seismic_context.js
// Run via: deno run --allow-all tests/test_stage4_evacuation_ux_and_seismic_context.js
// ============================================================================

import * as THREE from '../js/lib/three.module.js';
import {
  DEFAULT_LOCAL_ANCHOR_COORDS,
  computeGeodesicBearingAndDistanceKm,
  resolveActiveSeismicEvent,
  buildEvacuationSafetyCheckpoints,
  evaluatePathProgressState
} from '../js/response/SeismicImpactContext.js';
import { HanyangResponseAdapter } from '../js/response/HanyangResponseAdapter.js';
import { LocalSpatialMapLayer } from '../js/response/LocalSpatialMapLayer.js';

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
console.log('SEISMOLIVE v4.0 — Stage 4 Evacuation UX & Seismic Context Suite');
console.log('====================================================================\n');

// ----------------------------------------------------------------------------
// 1. GEODESIC EPICENTER DISTANCE, BEARING & PROVENANCE INTEGRITY
// ----------------------------------------------------------------------------
console.log('--- 1. Geodesic Epicenter Context & Scientific Provenance ---');
{
  const g = computeGeodesicBearingAndDistanceKm(
    DEFAULT_LOCAL_ANCHOR_COORDS.lat,
    DEFAULT_LOCAL_ANCHOR_COORDS.lon,
    35.7610,
    129.1878
  );
  assert(
    g.distanceKm > 265 && g.distanceKm < 290 &&
    g.bearingDeg > 120 && g.bearingDeg < 155 &&
    g.compassDirKo === '남동',
    '1.1: Hanyang->Gyeongju geodesic distance & bearing match true SE azimuth',
    `dist=${g.distanceKm} km, bearing=${g.bearingDeg}° (${g.compassDirKo})`
  );

  const resolvedGyeongju = resolveActiveSeismicEvent('hist_2016_gyeongju');
  assert(
    resolvedGyeongju.mag === 5.8 &&
    resolvedGyeongju.pWaveEtaSec > 40 &&
    resolvedGyeongju.sWaveEtaSec > resolvedGyeongju.pWaveEtaSec,
    '1.2: resolveActiveSeismicEvent resolves real KMA 2016 Gyeongju parameters & P/S arrival windows'
  );

  const histUnknown = resolveActiveSeismicEvent('hist_1681_0626');
  assert(
    histUnknown.isHistorical === true &&
    histUnknown.depthKm === null &&
    histUnknown.mag === null,
    '1.3: Historical event preserves unknown depth/magnitude strictly as null (no fake fallback)'
  );

  const mockUsgs = resolveActiveSeismicEvent('us7000test', {
    usgsFeatures: [{
      id: 'us7000test',
      properties: { place: '12 km SE of Pohang, South Korea', mag: 5.4, magType: 'mww', time: 1793899305897 },
      geometry: { coordinates: [129.36, 36.11, 10.0] }
    }]
  });
  assert(
    mockUsgs.mag === 5.4 && mockUsgs.distanceKm > 250 && mockUsgs.verification === 'usgs-official',
    '1.4: USGS GeoJSON feature lookup computes true distance & official provenance'
  );
}

// ----------------------------------------------------------------------------
// 2. PATH-SYNCHRONIZED EVACUATION SAFETY CHECKPOINTS
// ----------------------------------------------------------------------------
console.log('\n--- 2. Path-Synchronized Evacuation Safety Checkpoints ---');
{
  const cps = buildEvacuationSafetyCheckpoints({
    facilityName: '212동',
    floor: 3,
    room: '301',
    shelterName: '한양대 대운동장',
    shortestMeters: 737.9,
    stepFreeMeters: 855.1,
    isStepFree: false,
    hasObstacles: false
  });
  assert(
    cps.length === 5 && cps[0].stepNo === '01' && cps[4].stepNo === '05',
    '2.1: Builds 5 ordered contextual safety checkpoints from indoor exit to shelter'
  );

  const pStart = evaluatePathProgressState(cps, 0.05, 737.9);
  const pMid = evaluatePathProgressState(cps, 0.50, 737.9);
  const pEnd = evaluatePathProgressState(cps, 0.98, 737.9);
  assert(
    pStart.activeCheckpoint.id === 'CP_01_INDOOR_HOLD' &&
    pMid.activeCheckpoint.id === 'CP_03_FACADE_CLEARANCE' &&
    pEnd.activeCheckpoint.id === 'CP_05_SHELTER_ARRIVAL' &&
    pEnd.remainingMeters < pMid.remainingMeters &&
    pMid.remainingMeters < pStart.remainingMeters,
    '2.2: evaluatePathProgressState maps t in [0,1] accurately to active rule & monotonic remaining meters',
    `start=${pStart.remainingMeters}m, mid=${pMid.remainingMeters}m, end=${pEnd.remainingMeters}m`
  );
}

// ----------------------------------------------------------------------------
// 3. VOLUMETRIC 3D PATH RIBBONS, TREES, & HORIZON EPICENTER VECTOR
// ----------------------------------------------------------------------------
console.log('\n--- 3. Volumetric 3D Path Tubes, Chevrons, Trees & Epicenter Vector ---');
{
  const scene = new THREE.Scene();
  const adapter = new HanyangResponseAdapter(scene, { scale: 1.0 });

  const tubeShort = adapter.pathGroup.getObjectByName('Ribbon_Shortest_Volume');
  const chevShort = adapter.pathGroup.getObjectByName('Ribbon_Shortest_Volume_Chevrons');
  const tubeFree = adapter.pathGroup.getObjectByName('Ribbon_StepFree_Volume');
  const originMarker = adapter.rootGroup.getObjectByName('Origin_Marker_Group');
  const safePad = adapter.shelterGroup.getObjectByName('Shelter_Pitch_SafePad');

  assert(
    tubeShort?.isMesh && chevShort?.isInstancedMesh && tubeFree?.isMesh &&
    originMarker !== undefined && safePad !== undefined,
    '3.1: HanyangResponseAdapter mounts volumetric tubes, directional chevrons, origin beacon, & shelter pad'
  );

  adapter.setRouteDisplay('STEP_FREE');
  assert(
    tubeShort.visible === false && chevShort.visible === false && tubeFree.visible === true,
    '3.2: setRouteDisplay("STEP_FREE") toggles volumetric tubes & chevrons together'
  );

  adapter.setThemeColors(true);
  adapter.dispose();
  assert(adapter.disposables.length === 0, '3.3: Adapter disposes all volumetric tube geometries cleanly');

  const layerScene = new THREE.Scene();
  const layer = new LocalSpatialMapLayer(layerScene);
  const ctx = resolveActiveSeismicEvent('hist_2016_gyeongju');
  layer.setEpicenterContext(ctx);
  const ray = layer.epicenterGuideGroup.getObjectByName('EpicenterBearingVectorLine');
  const diag = layer.getLayerDiagnostics();

  assert(
    diag.treeCount > 500 && ray !== undefined,
    '3.4: LocalSpatialMapLayer renders instanced park/hill trees and horizon epicenter bearing sightline',
    `trees=${diag.treeCount}, ray=${ray?.name}`
  );

  layer.setActiveOriginFacility({ id: 'BLDG_701_HIT', name: '701동 HIT', east_m: -95, north_m: 210, height_m: 44 });
  assert(
    layer.labelAnchors.some(a => a.id === 'BLDG_701_HIT' && a.title.includes('701동')),
    '3.5: setActiveOriginFacility updates dynamic origin label anchor cleanly'
  );

  layer.dispose();
}

// ----------------------------------------------------------------------------
// SUMMARY
// ----------------------------------------------------------------------------
console.log('\n====================================================================');
console.log(`STAGE 4 EVACUATION UX & CONTEXT TESTS: ${passed} PASSED | ${failed} FAILED`);
console.log('====================================================================\n');

if (failed > 0) {
  Deno.exit(1);
}
