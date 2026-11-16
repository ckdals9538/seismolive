// ============================================================================
// SEISMOLIVE v4.0 — Phase 3 Stage R1 / R2 / R3 Architecture Refactoring Tests
// File: tests/test_phase3_r2_r3_architecture.js
// Run via: deno run -A tests/test_phase3_r2_r3_architecture.js
// ============================================================================

import {
  DATA_PROVENANCE_SOURCE,
  VERIFICATION_STATUS,
  SEISMIC_MOTION_POLICY,
  isProtectiveShakingOnset,
  isInstrumentMotionDetected,
  isQuiescenceSubsided,
  ASSESSMENT_URGENCY,
  LOCATION_CERTAINTY,
  MOBILITY_PROFILE,
  CONFLICT_RESOLUTION_STRATEGY,
  PATH_TYPE,
  USER_MOBILITY_PROFILE,
  LINK_STATE
} from '../js/response/ResponseDomainTypes.js';

import { computeTravelTimeParams, computeTsunamiHydrodynamicParams } from '../js/geophysics/TravelTimeSolvers.js';
import { GeoRasterSampler, classifySurface, SURFACE_CLASSIFICATION, RASTER_PIXEL_TYPE } from '../js/3d/GeoRasterSampler.js';
import {
  UNIVERSAL_EVENT_METADATA,
  getUniversalEventMetadata,
  resolveArbitraryCoordinate,
  computePhysicalUnitsFromBounds
} from '../js/data/EventTerrainCatalog.js';
import { ArchivalSemanticParser } from '../js/data/ArchivalSemanticParser.js';
import { HISTORICAL_EVENTS, SOURCE_RECORDS, EVENT_SOURCE_LINKS } from '../js/data/historicalArchiveDB.js';
import { INSTRUMENTAL_EVENTS } from '../js/data/instrumentalCatalogDB.js';
import { updateEntitiesLifecycle, LivingMemoryEngine, TerrainAwareSpawner } from '../js/3d/livingMemoryEngine.js';
import {
  MONOLITH_SURFACE_GLSL,
  TIER0_GLOBE_VERTEX_SHADER,
  TIER0_GLOBE_FRAGMENT_SHADER,
  REGIONAL_TERRAIN_VERTEX_SHADER,
  REGIONAL_TERRAIN_FRAGMENT_SHADER,
  OCEAN_WATER_VERTEX_SHADER,
  OCEAN_WATER_FRAGMENT_SHADER
} from '../js/3d/shaders/SeismicTerrainShaders.js';
import { FLIGHT_STATES, computeSphericalFlightPose } from '../js/3d/FlightController.js';
import { ExhibitionAppContext } from '../js/ui/ExhibitionAppContext.js';
import { SeismologicalTrace, SeismicStationPacket } from '../js/geophysics/ModernSeismicSolvers.js';
import { getSampleAt, getMotionQuality } from '../js/data/StationWaveformBridge.js';

let passed = 0;
let failed = 0;

function assert(cond, msg, detail = '') {
  if (cond) {
    passed++;
    console.log(`  [PASS] ${msg}`);
  } else {
    failed++;
    console.error(`  [FAIL] ${msg}${detail ? ' -> ' + detail : ''}`);
  }
}

console.log('====================================================================');
console.log('SEISMOLIVE v4.0 — Phase 3 (R1 / R2 / R3) Architecture Test Suite');
console.log('====================================================================\n');

// ----------------------------------------------------------------------------
// Group 1: Stage R1 Domain Type Separation
// ----------------------------------------------------------------------------
console.log('--- Group 1: Stage R1 Pure Domain Types & Engine Decoupling ---');

assert(
  globalThis.document === undefined && globalThis.THREE === undefined,
  '1.1: R1 and R2 pure domain modules import cleanly without DOM or Three.js'
);

assert(
  SEISMIC_MOTION_POLICY.PROTECTIVE_ONSET_PGA_G === 0.05 &&
  SEISMIC_MOTION_POLICY.QUIESCENCE_RELEASE_PGA_G === 0.02 &&
  SEISMIC_MOTION_POLICY.QUIESCENCE_MIN_DURATION_SEC === 10.0 &&
  isProtectiveShakingOnset(0.05) &&
  !isProtectiveShakingOnset(0.03) &&
  isInstrumentMotionDetected(0.03) &&
  !isQuiescenceSubsided(0.03, 15.0) &&
  isQuiescenceSubsided(0.015, 10.0),
  '1.2: ResponseDomainTypes exports valid hysteresis policy & helpers'
);

assert(
  Boolean(DATA_PROVENANCE_SOURCE.OBSERVED_STATION) &&
  Boolean(VERIFICATION_STATUS.PROVISIONAL) &&
  Boolean(ASSESSMENT_URGENCY.IMMEDIATE) &&
  Boolean(LOCATION_CERTAINTY.MANUAL_EXACT) &&
  Boolean(MOBILITY_PROFILE.WHEELCHAIR) &&
  Boolean(CONFLICT_RESOLUTION_STRATEGY.LOCAL_UNVERIFIED_HAZARD_PRECAUTION) &&
  Boolean(PATH_TYPE.STEP_FREE_DETOUR) &&
  Boolean(USER_MOBILITY_PROFILE.WHEELCHAIR_USER) &&
  Boolean(LINK_STATE.SUSPECTED),
  '1.3: ResponseDomainTypes contains all generic enums required by state machine, routing, and situation engines'
);

const domainPureResponseFiles = [
  'js/response/ResponseStateMachine.js',
  'js/response/SituationAssessmentEngine.js',
  'js/response/GroundDataContract.js',
  'js/response/PersonalResponseInteraction.js',
  'js/response/ResponseTimelineSimulator.js'
];
for (const filePath of domainPureResponseFiles) {
  const src = await Deno.readTextFile(filePath);
  assert(
    !src.includes('./HanyangBuildingData.js'),
    `1.4: ${filePath} has zero direct imports from concrete HanyangBuildingData.js`
  );
}

// ----------------------------------------------------------------------------
// Group 2: Stage R2 Domain / I/O / Presentation Separation
// ----------------------------------------------------------------------------
console.log('\n--- Group 2: Stage R2 Domain / I/O / Presentation Separation ---');

// 2.1 Pure Geophysics Solvers
const ttParams = computeTravelTimeParams(12.0, 5.8, 7.8, 3.35);
const tsunamiParams = computeTsunamiHydrodynamicParams(2000.0, 20.0, 60.0);
assert(
  ttParams.depth === 12.0 && Number(ttParams.icDeg) > 40.0 && ttParams.xCross > ttParams.xCrit &&
  tsunamiParams.vDeepKmH === 504 && tsunamiParams.shoalingFactor === 3.16,
  '2.1: TravelTimeSolvers pure physics calculations run cleanly without DOM or Three.js'
);

const travelTimeSrc = await Deno.readTextFile('js/geophysics/TravelTimeSolvers.js');
assert(
  !travelTimeSrc.includes('document.') && !travelTimeSrc.includes('window.') && !travelTimeSrc.includes('<svg'),
  '2.2: js/geophysics/TravelTimeSolvers.js contains zero DOM/window/SVG code'
);

// 2.3 Pure GeoRasterSampler & EventTerrainCatalog
const rasterData = new Float32Array([100, 200, -50, -500]);
const sampler = new GeoRasterSampler({
  data: rasterData,
  width: 2,
  height: 2,
  west: 128.0,
  north: 39.0,
  pixelWidth: 0.5,
  pixelHeight: 0.5,
  pixelType: RASTER_PIXEL_TYPE.PIXEL_IS_POINT
});
assert(
  sampler.sampleElevation(39.0, 128.0).elevation === 100 &&
  classifySurface(-1200, -1200, 1.0) === SURFACE_CLASSIFICATION.OCEAN &&
  classifySurface(1200, 1100, 15.0) === SURFACE_CLASSIFICATION.LAND,
  '2.3: GeoRasterSampler executes pure sampling & surface classification without Three.js/DOM'
);

const meta1681 = getUniversalEventMetadata('hist_1681_0626');
const metaGyeongju = getUniversalEventMetadata('hist_2016_gyeongju');
const metaTurkey = getUniversalEventMetadata('global_2023_turkey');
const derivedBounds = computePhysicalUnitsFromBounds({ minLat: 37.7, maxLat: 38.3, minLon: 128.3, maxLon: 129.8 });
assert(
  meta1681.physicalWidthUnits === 1.3142 &&
  meta1681.physicalHeightUnits === 0.6634 &&
  metaGyeongju.physicalWidthUnits === 0.9034 &&
  metaGyeongju.physicalHeightUnits === 1.1100 &&
  metaTurkey.physicalWidthUnits === 0.8800 &&
  derivedBounds.physicalWidthUnits > 1.30 && derivedBounds.physicalHeightUnits > 0.65 &&
  resolveArbitraryCoordinate(37.55, 127.04).success === true,
  '2.4: EventTerrainCatalog resolves event physical extent units & coordinates without Three.js/DOM'
);

// 2.5 Pure ArchivalSemanticParser
const parser = new ArchivalSemanticParser(HISTORICAL_EVENTS, SOURCE_RECORDS, EVENT_SOURCE_LINKS, INSTRUMENTAL_EVENTS);
const parsed1681 = parser.parseEvent('hist_1681_0626');
const parsedGyeongju = parser.parseEvent('hist_2016_gyeongju');
assert(
  parsed1681.semanticUnits.length >= 6 &&
  parsed1681.sceneEpicenter.x === 0 && parsed1681.sceneEpicenter.y === 0.03365 &&
  parsedGyeongju.semanticUnits.length === 4 &&
  parsedGyeongju.isInstrumental === true,
  '2.5: ArchivalSemanticParser parses historical & instrumental chronicles cleanly with zero DOM/Three.js'
);

const parserSrc = await Deno.readTextFile('js/data/ArchivalSemanticParser.js');
assert(
  !parserSrc.includes('document.') && !parserSrc.includes('THREE'),
  '2.6: ArchivalSemanticParser.js has zero DOM or THREE references'
);

// 2.7 StationWaveformBridge shadowed window fix
const bridgeSrc = await Deno.readTextFile('js/data/StationWaveformBridge.js');
assert(
  !/const\s+window\s*=/.test(bridgeSrc) && /const\s+obsWindow\s*=/.test(bridgeSrc),
  '2.7: StationWaveformBridge.js no longer shadows global window with local const window'
);

const traceCfg = (comp, samples) => {
  const tr = new SeismologicalTrace({
    network: 'KS', station: 'YANG1', location: '00', channel: `HH${comp}`,
    component: comp, sampleRateHz: 10, startTimeUTC: '2026-01-01T00:00:00.000Z',
    samples, units: 'm/s^2', sensitivity: 1.0, hasResponseRemoved: true
  });
  tr.orientationVerified = true;
  tr.cmpinc = comp === 'Z' ? 0.0 : 90.0;
  tr.cmpaz = comp === 'E' ? 90.0 : 0.0;
  return tr;
};
const packet = new SeismicStationPacket({
  stationCode: 'YANG1', latitude: 38.07, longitude: 128.62,
  traceZ: traceCfg('Z', new Float32Array([0, 0.2, 0.4, 0.1])),
  traceN: traceCfg('N', new Float32Array([0, 0.1, 0.2, 0.0])),
  traceE: traceCfg('E', new Float32Array([0, 0.1, 0.3, 0.0]))
});
const sampleMid = getSampleAt(packet, 0.2);
const qualityRes = getMotionQuality(packet);
assert(
  sampleMid.status === 'SUCCESS' &&
  Math.abs(sampleMid.samples.z - 0.4) < 1e-6 &&
  qualityRes.pga > 0.5 &&
  qualityRes.analysisWindow.hasCommonWindow === true,
  '2.8: StationWaveformBridge getSampleAt & getMotionQuality function correctly with obsWindow'
);

// ----------------------------------------------------------------------------
// Group 3: Stage R3 Three.js ESM Unification, Shaders & main.js Modularization
// ----------------------------------------------------------------------------
console.log('\n--- Group 3: Stage R3 Runtime Unification & Main App Refactoring ---');

const runtime = await import('../js/lib/three-runtime.js');
assert(
  runtime.THREE.__SEISMOLIVE_UNIFIED_ESM__ === true &&
  runtime.THREE.Vector3 === globalThis.THREE.Vector3 &&
  typeof runtime.OrbitControls === 'function' &&
  typeof runtime.MapControls === 'function' &&
  runtime.THREE.OrbitControls === runtime.OrbitControls,
  '3.1: three-runtime.js exports single unified Three.js ESM runtime with OrbitControls'
);

const indexHtml = await Deno.readTextFile('index.html');
assert(
  !indexHtml.includes('three.min.js') && !indexHtml.includes('js/lib/OrbitControls.js'),
  '3.2: index.html no longer loads legacy three.min.js or UMD OrbitControls.js'
);

assert(
  typeof MONOLITH_SURFACE_GLSL === 'string' && MONOLITH_SURFACE_GLSL.includes('monolithOceanAlbedo') &&
  typeof TIER0_GLOBE_VERTEX_SHADER === 'string' && TIER0_GLOBE_VERTEX_SHADER.includes('u_globalElevation') &&
  typeof TIER0_GLOBE_FRAGMENT_SHADER === 'string' && TIER0_GLOBE_FRAGMENT_SHADER.includes('computeMonolithLighting') &&
  typeof REGIONAL_TERRAIN_VERTEX_SHADER === 'string' && REGIONAL_TERRAIN_VERTEX_SHADER.includes('u_demTexture') &&
  typeof REGIONAL_TERRAIN_FRAGMENT_SHADER === 'string' && REGIONAL_TERRAIN_FRAGMENT_SHADER.includes('u_enableStratum2') &&
  typeof OCEAN_WATER_VERTEX_SHADER === 'string' && OCEAN_WATER_VERTEX_SHADER.includes('u_physicalSize') &&
  typeof OCEAN_WATER_FRAGMENT_SHADER === 'string' && OCEAN_WATER_FRAGMENT_SHADER.includes('u_oceanBloomMode'),
  '3.3: SeismicTerrainShaders.js exports all 7 GLSL shaders'
);

// Test FlightController spherical trajectory never intersects Earth interior
const globeCenter = new runtime.THREE.Vector3(0, -63.78137, 0);
const poseMid = computeSphericalFlightPose({
  THREE: runtime.THREE,
  startPos: new runtime.THREE.Vector3(10.0, 140.0, 40.0),
  endPos: new runtime.THREE.Vector3(0.36, 0.22, 0.24),
  startLookAt: new runtime.THREE.Vector3(0, 0, 0),
  endLookAt: new runtime.THREE.Vector3(-0.14, 0.045, -0.04),
  progress: 0.5,
  withArcHop: true
});
const radiusAtMid = poseMid.position.distanceTo(globeCenter);
assert(
  FLIGHT_STATES.ORBIT === 'STATE_ORBIT' &&
  radiusAtMid > 63.78137,
  `3.4: FlightController mid-descent spherical radius stays cleanly above WGS84 globe (${radiusAtMid.toFixed(2)} > 63.78)`
);

// Test ExhibitionAppContext explicit wiring
const appCtx = new ExhibitionAppContext();
let capturedProbe = null;
let capturedShot = null;
appCtx.registerHandlers({
  setGeophysics3DProbe: (d, xc, xcr) => { capturedProbe = { d, xc, xcr }; },
  applyCameraShot: (k) => { capturedShot = k; }
});
appCtx.setGeophysics3DProbe(120, 45, 92);
appCtx.applyCameraShot('epicenter_wave_corridor');
assert(
  capturedProbe?.d === 120 && capturedProbe?.xc === 45 && capturedProbe?.xcr === 92 &&
  capturedShot === 'epicenter_wave_corridor' && appCtx.currentShotKey === 'epicenter_wave_corridor',
  '3.5: ExhibitionAppContext dispatches explicit handlers without window globals'
);

// Test LivingMemoryEngine.update() & TerrainAwareSpawner planetary fallback
const lmEngine = new LivingMemoryEngine({ livingSoundfield: null });
const fallbackCand = new TerrainAwareSpawner([]).resolveCandidate(parsedGyeongju.semanticUnits[0], parsedGyeongju, { isRegionalActive: false });
assert(
  fallbackCand.suitability === 'PLANETARY_EPICENTRAL_ANCHOR' &&
  fallbackCand.demCoverageStatus === 'GLOBAL_ETOPO_PLANETARY_COVERAGE',
  '3.6: Official TerrainAwareSpawner handles planetary fallback mode when regional DEM is inactive'
);

const mockGroup = new runtime.THREE.Group();
mockGroup.userData = {
  unitDef: parsed1681.semanticUnits[0],
  cand: fallbackCand,
  sprite: new runtime.THREE.Sprite(),
  spriteMat: { opacity: 0.0 },
  haloMat: { opacity: 0.0 },
  t_activation: 2.4,
  lifecycleState: 'LATENT',
  currentOpacity: 0.0
};
lmEngine.entities = [mockGroup];
lmEngine.update(3.0);
assert(mockGroup.userData.lifecycleState === 'EMERGENCE' && mockGroup.userData.currentOpacity > 0.0, '3.7: LivingMemoryEngine.update advances entity to EMERGENCE');
lmEngine.update(4.0);
assert(mockGroup.userData.lifecycleState === 'FORMATION' && Math.abs(mockGroup.userData.currentOpacity - 0.98) < 1e-6, '3.8: LivingMemoryEngine.update advances entity to FORMATION');
lmEngine.update(20.0);
assert(mockGroup.userData.lifecycleState === 'DEAD' && mockGroup.visible === false, '3.9: LivingMemoryEngine.update culls entity cleanly to DEAD');

// Inspect main.js & UnifiedControlSurface.js cleanliness
const mainSrc = await Deno.readTextFile('js/main.js');
const ucsSrc = await Deno.readTextFile('js/ui/UnifiedControlSurface.js');
assert(
  !mainSrc.includes('class TerrainAwareSpawner') &&
  (mainSrc.match(/function seekToSimulationTime/g) || []).length === 1 &&
  !mainSrc.includes("if (eventId.includes('1681')) {\n          curW = 1.3142;") &&
  mainSrc.includes('new LivingMemoryEngine') &&
  mainSrc.includes('MONOLITH_SURFACE_GLSL') &&
  mainSrc.includes('exhibitionAppContext'),
  '3.10: js/main.js eliminates duplicates/hardcoded extent switches and uses modular R2/R3 components'
);

assert(
  !/^\s*autonomousMode\s*=/m.test(ucsSrc) &&
  !/indexOf\(currentShotKey\)/.test(ucsSrc) &&
  !/this\.selectedEvent\s*\|\|\s*currentParsedEvent\b/.test(ucsSrc) &&
  ucsSrc.includes('this.appContext.'),
  '3.11: UnifiedControlSurface.js replaces undeclared bare globals with explicit appContext'
);

console.log('\n====================================================================');
console.log(`PHASE 3 ARCHITECTURE SUITE SUMMARY: ${passed} PASSED | ${failed} FAILED`);
console.log('====================================================================\n');

if (failed > 0) {
  Deno.exit(1);
}
