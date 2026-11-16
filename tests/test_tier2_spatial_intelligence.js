// ============================================================================
// SEISMOLIVE v4.0 — Stage 2 (Tier 2) Spatial Intelligence & Multi-Facility Tests
// File: tests/test_tier2_spatial_intelligence.js
// Run via: deno run --allow-all tests/test_tier2_spatial_intelligence.js
// ============================================================================

import * as THREE from '../js/lib/three.module.js';
import {
  PedestrianRoutingEngine,
  PATH_TYPE,
  isPointInPolygonXZ,
  doesEdgeIntersectPolygonXZ
} from '../js/response/PedestrianRoutingEngine.js';
import { ResponseUIAdapter } from '../js/response/ResponseUIAdapter.js';
import { HanyangResponseAdapter } from '../js/response/HanyangResponseAdapter.js';
import {
  DEFAULT_HANYANG_FACILITY_PACKAGE,
  HANYANG_HIT_FACILITY_PACKAGE,
  HANYANG_PAIKNAM_FACILITY_PACKAGE,
  getFacilityPackageById
} from '../js/response/HanyangBuildingData.js';
import { SpatialChunkManager } from '../js/response/SpatialChunkManager.js';
import { LocalSpatialMapLayer } from '../js/response/LocalSpatialMapLayer.js';
import {
  extractOfficialUsgsProducts,
  parseShakeMapMmiContours,
  USGS_PRODUCT_STATUS
} from '../js/data/UsgsOfficialProductsBridge.js';
import {
  renderGeophysicsFolioHTML,
  buildDemoAudificationWaveform
} from '../js/ui/GeophysicsFolioView.js';
import { synthesizeDualBandAudifiedSamples } from '../js/audio/livingSoundfieldEngine.js';
import {
  DATA_PROVENANCE_SOURCE,
  VERIFICATION_STATUS
} from '../js/response/ResponseDomainTypes.js';

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
console.log('SEISMOLIVE v4.0 — Stage 2 (Tier 2) Spatial Intelligence Suite');
console.log('====================================================================\n');

// ----------------------------------------------------------------------------
// 1. TIER 2.1: DYNAMIC HAZARD AVOIDANCE POLYGONS (`avoid_polygons`)
// ----------------------------------------------------------------------------
console.log('--- 1. Tier 2.1 Dynamic Hazard Avoidance Polygons ---');
{
  const squareXZ = [[82, -40], [165, -40], [165, 62], [82, 62]];
  assert(
    isPointInPolygonXZ([118, 5], squareXZ) === true &&
    isPointInPolygonXZ([65, 65], squareXZ) === false,
    '1.1: Ray-casting isPointInPolygonXZ accurately classifies interior vs exterior XZ points'
  );
  assert(
    doesEdgeIntersectPolygonXZ([[73, 0, 0], [190, 0, 0]], squareXZ) === true,
    '1.2: doesEdgeIntersectPolygonXZ detects segment crossing through hazard zone'
  );

  const router = new PedestrianRoutingEngine();
  const baseRoute = router.findCompleteIndoorOutdoorPath('ROOM_301');
  assert(
    baseRoute.found && baseRoute.totalDistanceMeters === 737.9 && !baseRoute.isStepFree,
    '1.3: Baseline route without hazard polygons takes 737.9m shortest stair route'
  );

  router.addAvoidPolygon({
    id: 'HAZARD_STAIR_FACADE',
    name: '동측 계단 낙하물 위험 구역',
    mode: 'BLOCK',
    polygonXZ: squareXZ,
    exemptEdgeIds: ['NODE_EXIT_1F_SE->OSM_NODE_6415394841']
  });
  const bypassed = router.findCompleteIndoorOutdoorPath('ROOM_301');
  const outdoorBypassed = router.findDynamicPath('OSM_NODE_6415394841', 'OSM_NODE_8577408700');
  assert(
    bypassed.found &&
    bypassed.totalDistanceMeters === 855.1 &&
    outdoorBypassed.found &&
    outdoorBypassed.isStepFree &&
    outdoorBypassed.pathType === PATH_TYPE.STEP_FREE_DETOUR &&
    outdoorBypassed.totalDistanceMeters === 769.1,
    '1.4: Blocking hazard polygon forces automatic outdoor detour to 769.1m Step-Free corridor (855.1m indoor+outdoor)',
    `completeDist=${bypassed.totalDistanceMeters}m, outdoorDist=${outdoorBypassed.totalDistanceMeters}m, outdoorStepFree=${outdoorBypassed.isStepFree}`
  );

  // Start-portal deadlock exemption check: polygon overlapping building exit door
  router.clearAvoidPolygons();
  router.addAvoidPolygon({
    id: 'EXIT_DEBRIS_APRON',
    name: '출구 전면 6m 낙하물 경계 구역',
    mode: 'BLOCK',
    allowStartPortalEscape: true,
    polygonXZ: [[68, -48], [76, -48], [76, -40], [68, -40]]
  });
  const portalEscape = router.findCompleteIndoorOutdoorPath('ROOM_301');
  assert(
    portalEscape.found === true,
    '1.5: Start-portal deadlock exemption prevents blocking evacuee exit right at 1F SE portal'
  );

  // LocalSpatialMapLayer visual outline sync
  const scene = new THREE.Scene();
  const layer = new LocalSpatialMapLayer(scene);
  const renderedCount = layer.setHazardAvoidPolygons(router.getAvoidPolygons());
  assert(
    renderedCount === 1 && layer.getLayerDiagnostics().hazardPolygonCount === 1,
    '1.6: LocalSpatialMapLayer mounts dashed architectural outline for active avoid_polygons'
  );
  layer.dispose();
}

// ----------------------------------------------------------------------------
// 2. TIER 2.2: 3KM x 3KM SPATIAL CHUNK STREAMING
// ----------------------------------------------------------------------------
console.log('\n--- 2. Tier 2.2 3km x 3km Spatial Chunk Streaming ---');
{
  const chunkMgr = new SpatialChunkManager();
  const c0 = chunkMgr.updateForPosition(0, 0);
  assert(
    c0.activeChunkKeys.includes('CHUNK_0_0') && !c0.activeChunkKeys.includes('CHUNK_1_0'),
    '2.1: At core origin (0,0), outer chunk CHUNK_1_0 stays unloaded until camera approaches east border'
  );

  const cEast = chunkMgr.updateForPosition(1350, 0);
  assert(
    cEast.activeChunkKeys.includes('CHUNK_1_0') && cEast.totalStreamedBuildings > 0,
    '2.2: Panning east to x=1350m triggers adjacent 3km CHUNK_1_0 streaming',
    `activeChunks=${cEast.activeChunkKeys.join(', ')}, buildings=${cEast.totalStreamedBuildings}`
  );

  const cWest = chunkMgr.updateForPosition(-2200, 0);
  assert(
    !cWest.activeChunkKeys.includes('CHUNK_1_0') && cWest.activeChunkKeys.includes('CHUNK_-1_0'),
    '2.3: Panning west evicts distant CHUNK_1_0 and streams CHUNK_-1_0 cleanly'
  );

  const scene = new THREE.Scene();
  const layer = new LocalSpatialMapLayer(scene);
  layer.updateSpatialChunks({ x: 1400, z: 0 });
  const diag = layer.getLayerDiagnostics();
  assert(
    diag.streamedChunkBuildingCount > 0 && diag.activeChunkKeys.includes('CHUNK_1_0'),
    '2.4: LocalSpatialMapLayer mounts THREE.InstancedMesh instances for streamed 3km chunks',
    `streamedChunkBuildings=${diag.streamedChunkBuildingCount}`
  );

  layer.setEcoMode(true);
  const ecoDiag = layer.getLayerDiagnostics();
  assert(
    ecoDiag.streamedChunkBuildingCount < diag.streamedChunkBuildingCount,
    '2.5: Eco Mode proportionally reduces streamed chunk InstancedMesh count too',
    `${diag.streamedChunkBuildingCount} -> ${ecoDiag.streamedChunkBuildingCount}`
  );
  layer.dispose();
}

// ----------------------------------------------------------------------------
// 3. TIER 2.3: OFFICIAL USGS PRODUCTS BRIDGE & AUDIFICATION FOLIO
// ----------------------------------------------------------------------------
console.log('\n--- 3. Tier 2.3 Official USGS Products & Audification Folio ---');
{
  const absent = extractOfficialUsgsProducts(null);
  assert(
    absent.status === USGS_PRODUCT_STATUS.UNAVAILABLE && absent.shakemap === null && absent.oaf === null,
    '3.1: Absent USGS products strictly preserved as null (no synthetic MMI fallback)'
  );

  const mockDetail = {
    properties: {
      products: {
        shakemap: [{
          id: 'us7000test',
          code: 'us7000test',
          source: 'us',
          properties: { maxmmi: '6.8', maxpga: '24.5', maxpgv: '19.2' },
          contents: { 'download/cont_mmi.json': { url: 'https://earthquake.usgs.gov/mock/cont_mmi.json' } }
        }]
      }
    }
  };
  const extracted = extractOfficialUsgsProducts(mockDetail);
  assert(
    extracted.status === USGS_PRODUCT_STATUS.PARTIAL &&
    extracted.shakemap?.maxMmi === 6.8 &&
    extracted.oaf === null,
    '3.2: Partial USGS ComCat detail parses available ShakeMap metadata while keeping absent OAF null'
  );

  const mockGeoJson = {
    type: 'FeatureCollection',
    features: [{
      type: 'Feature',
      properties: { value: 5.5, color: '#ffff00' },
      geometry: {
        type: 'LineString',
        coordinates: [[127.045053, 37.555815], [127.055053, 37.565815]]
      }
    }]
  };
  const contours = parseShakeMapMmiContours(mockGeoJson);
  assert(
    contours.length === 1 &&
    contours[0].mmiValue === 5.5 &&
    contours[0].provenance === DATA_PROVENANCE_SOURCE.OFFICIAL_DISASTER_INFO &&
    contours[0].verificationStatus === VERIFICATION_STATUS.VERIFIED &&
    contours[0].pointsENU[0][0] === 0 &&
    contours[0].pointsENU[1][0] > 800,
    '3.3: parseShakeMapMmiContours transforms WGS84 contours to verified ENU meters via LocalTangentAnchor',
    `projectedENU=[${contours[0].pointsENU[1].join(', ')}]m`
  );

  const folioHtml = renderGeophysicsFolioHTML(12.0, { officialProducts: extracted });
  assert(
    folioHtml.includes('id="btn-audify-waveform"') &&
    folioHtml.includes('id="usgs-official-products-strip"') &&
    folioHtml.includes('MMI 6.8'),
    '3.4: renderGeophysicsFolioHTML includes Section 04 dual-band audification button & official product strip'
  );

  const demoSamples = buildDemoAudificationWaveform(12.0, 100, 16);
  const demoSynth = synthesizeDualBandAudifiedSamples(demoSamples, 100, { audioSampleRate: 8000 });
  assert(
    demoSynth.bodyBandRms > 0.05 && demoSynth.surfaceBandRms > 0.05,
    '3.5: buildDemoAudificationWaveform feeds synthesizeDualBandAudifiedSamples with non-zero stereo output'
  );
}

// ----------------------------------------------------------------------------
// 4. TIER 2.4: MULTI-FACILITY REGISTRY & RUNTIME HOT-SWAP
// ----------------------------------------------------------------------------
console.log('\n--- 4. Tier 2.4 Multi-Facility Switcher (BLDG_212 / HIT / Paiknam) ---');
{
  const scene = new THREE.Scene();
  const hanyangAdapter = new HanyangResponseAdapter(scene);
  const uiAdapter = new ResponseUIAdapter({ hanyangAdapter });
  // Ensure quiescent ground motion so navigation is permitted
  uiAdapter.updateStationMotion(0.01, Date.now(), DATA_PROVENANCE_SOURCE.SIMULATED_SCENARIO);

  const pkgHit = getFacilityPackageById('BLDG_701_HIT');
  uiAdapter.setFacilityPackage(pkgHit);
  const hitRoute = uiAdapter.lastRouteResult;
  assert(
    hanyangAdapter.rootGroup.name === 'BLDG_701_HIT_ResponseRoot' &&
    hanyangAdapter.config.totalLevels === 6 &&
    hanyangAdapter.config.selectedFloor === 4 &&
    hitRoute?.found === true &&
    uiAdapter.lastGuidance?.canMove === true,
    '4.1: Switching to HANYANG_HIT_FACILITY_PACKAGE rebuilds 6-floor HIT geometry and computes path to stadium',
    `dist=${hitRoute?.totalDistanceMeters}m, group=${hanyangAdapter.rootGroup.name}`
  );

  const pkgPaiknam = getFacilityPackageById('BLDG_104_PAIKNAM');
  uiAdapter.setFacilityPackage(pkgPaiknam);
  assert(
    hanyangAdapter.rootGroup.name === 'BLDG_104_PAIKNAM_ResponseRoot' &&
    hanyangAdapter.config.totalLevels === 5 &&
    uiAdapter.lastRouteResult?.found === true,
    '4.2: Switching to HANYANG_PAIKNAM_FACILITY_PACKAGE rebuilds Paiknam Library geometry and routes cleanly'
  );

  uiAdapter.setFacilityPackage(DEFAULT_HANYANG_FACILITY_PACKAGE);
  assert(
    hanyangAdapter.rootGroup.name === 'HanyangBldg212_ResponseRoot' &&
    uiAdapter.lastRouteResult?.totalDistanceMeters === 737.9,
    '4.3: Switching back to BLDG_212_ENG1 restores baseline 737.9m Building 212 state cleanly'
  );

  hanyangAdapter.dispose();
}

// ----------------------------------------------------------------------------
// SUMMARY
// ----------------------------------------------------------------------------
console.log('\n====================================================================');
console.log(`TIER 2 SPATIAL INTELLIGENCE TESTS: ${passed} PASSED | ${failed} FAILED`);
console.log('====================================================================\n');

if (failed > 0) {
  Deno.exit(1);
}
