// ============================================================================
// SEISMOLIVE v4.0 — Universal Location-Aware Engine Verification Suite
// File: tests/test_universal_location_engine.js
// Run via: deno run --allow-all tests/test_universal_location_engine.js
//
// Verifies:
//   - BUG 1: Earth/Sokcho 50s/120s timeline scrubber + WavefieldVisualOrchestrator.seekToTime
//   - BUG 1 Part 2: Evacuation #route-scrubber (pause, backward/forward, 0/1 bounds)
//   - Test A: Hanyang multi-building (decoupled from 1681 Yangyang default)
//   - Test B: Gyeongju urban non-campus labels & Section 8 indoor scoping
//   - Test C: Sokcho benchmark + River/Bridge exclusion + edge-penalized alternative routes
//   - Test D: Arbitrary coordinate parsing + OUTSIDE_IMPACT_ZONE vs IN_IMPACT_ZONE
//   - Test E: Sparse / empty region -> honest INSUFFICIENT / UNAVAILABLE (0 fake cities)
// ============================================================================

import * as THREE from '../js/lib/three.module.js';
import {
  SCENARIO_TYPES,
  IMPACT_ZONE_STATUS,
  CANDIDATE_STATUS,
  INDOOR_SPATIAL_SCOPE
} from '../js/response/ResponseDomainTypes.js';
import {
  LocationProvider,
  HazardProvider
} from '../js/response/SpatialDataProviders.js';
import {
  KOREA_BENCHMARK_REGIONS,
  PRESET_EARTHQUAKE_SCENARIOS,
  compileOsmJsonToSpatialPackage,
  loadRegionalSpatialPackage,
  localENUToLatLon
} from '../js/response/NationwideKoreaSpatialEngine.js';
import {
  doesSegmentIntersectOBBXZ,
  buildDynamicFacilityFromPoint,
  solveCampusWalkGraph
} from '../js/response/CampusWalkRouter.js';
import { PedestrianRoutingEngine } from '../js/response/PedestrianRoutingEngine.js';
import { ResponseUIAdapter } from '../js/response/ResponseUIAdapter.js';
import { LocalSpatialMapLayer } from '../js/response/LocalSpatialMapLayer.js';
import { WavefieldVisualOrchestrator } from '../js/3d/wavefieldVisualOrchestrator.js';
import { UnifiedControlSurface } from '../js/ui/UnifiedControlSurface.js';

let passed = 0;
let failed = 0;

function assert(cond, msg, detail = '') {
  if (cond) {
    console.log(`  [PASS] ${msg}${detail ? ` (${detail})` : ''}`);
    passed++;
  } else {
    console.error(`  [FAIL] ${msg}${detail ? ` (${detail})` : ''}`);
    failed++;
  }
}

console.log('\n====================================================================');
console.log('SEISMOLIVE UNIVERSAL LOCATION-AWARE ENGINE SUITE');
console.log('====================================================================');

// ----------------------------------------------------------------------------
// 1. BUG 1: Earth / Sokcho / 1681 Timeline Scrubber & Seek Synchronization
// ----------------------------------------------------------------------------
console.log('\n--- 1. BUG 1: Timeline Scrubber Sync (Orchestrator & Control Surface) ---');
{
  // 1.1 WavefieldVisualOrchestrator.seekToTime works while paused, forward, backward, edge-clamped
  const mockScene = new THREE.Scene();
  const mockOrchestrator = new WavefieldVisualOrchestrator({ scene: mockScene });
  mockOrchestrator.isPlaying = false;
  let subCalls = 0;
  let lastSubT = -1;
  mockOrchestrator.subscribe((evType, payload) => {
    if (evType === 'FRAME_PULSE') {
      subCalls++;
      lastSubT = payload.seismicTime;
    }
  });

  mockOrchestrator.seekToTime(44.5);
  assert(
    Math.abs(mockOrchestrator.seismicTime - 44.5) < 1e-6 &&
    Math.abs(mockOrchestrator.uniforms.u_seismicTime.value - 44.5) < 1e-6 &&
    lastSubT === 44.5 &&
    subCalls >= 1,
    '1.1: Orchestrator.seekToTime(44.5s) advances seismicTime & uniforms.u_seismicTime while paused (past 35s cap)'
  );

  mockOrchestrator.seekToTime(12.25);
  assert(
    Math.abs(mockOrchestrator.seismicTime - 12.25) < 1e-6 &&
    Math.abs(mockOrchestrator.uniforms.u_seismicTime.value - 12.25) < 1e-6,
    '1.2: Orchestrator.seekToTime(12.25s) scrubs backward cleanly without doubling'
  );

  mockOrchestrator.seekToTime(-5);
  assert(mockOrchestrator.seismicTime === 0, '1.3: seekToTime clamps negative seek cleanly to 0');

  // 1.4 UnifiedControlSurface #transport-scrubber dragging & dynamic max sync
  const elStore = new Map();
  const listenersById = new Map();
  const mkDomEl = id => {
    const classSet = new Set();
    const ev = {};
    listenersById.set(id, ev);
    const node = {
      id,
      value: '0',
      min: '0',
      max: '35',
      textContent: '',
      innerHTML: '',
      disabled: false,
      style: { display: 'none', opacity: '1', background: '' },
      classList: {
        add: (...c) => c.forEach(x => classSet.add(x)),
        remove: (...c) => c.forEach(x => classSet.delete(x)),
        toggle: (c, f) => (typeof f === 'boolean' ? (f ? classSet.add(c) : classSet.delete(c)) : (classSet.has(c) ? classSet.delete(c) : classSet.add(c))),
        contains: c => classSet.has(c)
      },
      setAttribute: () => {},
      getAttribute: () => '',
      addEventListener: (name, fn) => {
        if (!ev[name]) ev[name] = [];
        ev[name].push(fn);
      },
      removeEventListener: () => {},
      appendChild: () => {},
      querySelectorAll: () => [],
      querySelector: () => null
    };
    if (id) elStore.set(id, node);
    return node;
  };
  [
    'unified-control-surface', 'view-discover', 'view-explore', 'view-performance',
    'transport-scrubber', 'transport-time-current', 'transport-time-total',
    'btn-play-pause', 'perf-stage-indicator', 'perf-event-title',
    'contextual-benchmarks-shelf', 'shelf-items-container', 'shelf-category-title',
    'discover-btn-label', 'chronicle-subtitle-text', 'chronicle-subtitle-container',
    'tab-cat-historical', 'tab-cat-usgs', 'dev-lab-global-wrap'
  ].forEach(mkDomEl);

  const prevDoc = globalThis.document;
  const prevWin = globalThis.window;
  const winListeners = {};
  globalThis.document = {
    getElementById: id => elStore.get(id) || null,
    createElement: () => mkDomEl(null),
    querySelectorAll: () => [],
    addEventListener: () => {}
  };
  globalThis.window = {
    addEventListener: (name, fn) => {
      if (!winListeners[name]) winListeners[name] = [];
      winListeners[name].push(fn);
    }
  };

  const seekCalls = [];
  const appCtx = {
    flightState: 'STATE_PERFORMANCE',
    FLIGHT_STATES: { ORBIT: 'STATE_ORBIT', PERFORMANCE: 'STATE_PERFORMANCE' },
    isScrubbing: false,
    seekToSimulationTime: t => seekCalls.push(t),
    setSimulationPlaying: () => {},
    getAllEvents: () => [],
    getBenchmarks: () => []
  };
  const surface = new UnifiedControlSurface({ appContext: appCtx });
  surface.updatePerformanceTime(5, 50); // Configure 50s timeline (e.g. Sokcho/1681)
  const scrub = elStore.get('transport-scrubber');
  const ev = listenersById.get('transport-scrubber');

  assert(scrub.max === '50', `1.4: ControlSurface updates transport-scrubber max to 50s (got ${scrub.max})`);

  const mockEv = { target: scrub, stopPropagation: () => {} };
  ev.pointerdown?.forEach(fn => fn(mockEv));
  assert(surface.isScrubbing === true && appCtx.isScrubbing === true, '1.5: pointerdown engages both surface & appContext isScrubbing lock');

  scrub.value = '44.5';
  ev.input?.forEach(fn => fn(mockEv));
  // Attempt frame update while dragging — must NOT overwrite thumb position!
  surface.updatePerformanceTime(6.0, 50);
  assert(
    seekCalls[seekCalls.length - 1] === 44.5 && scrub.value === '44.5',
    '1.6: Dragging scrubber past 35s to 44.5s preserves thumb position & dispatches exact seek(44.5)'
  );

  ev.pointerup?.forEach(fn => fn(mockEv));
  assert(surface.isScrubbing === false && appCtx.isScrubbing === false, '1.7: pointerup releases scrubbing lock cleanly');

  surface.updatePerformanceTime(10, 120);
  assert(elStore.get('transport-time-total').textContent === '120.0s' && scrub.max === '120', '1.8: Switching to 120s event updates scrubber max to 120s');

  globalThis.document = prevDoc;
  globalThis.window = prevWin;
}

// ----------------------------------------------------------------------------
// 2. TEST A & D: Hanyang Decoupled Default & Scenario/Impact Zone Demarcation
// ----------------------------------------------------------------------------
console.log('\n--- 2. Test A & D: Scenario Demarcation & Impact Zone Discrimination ---');
{
  const hanyangPkg = await loadRegionalSpatialPackage(37.555815, 127.045053, { regionId: 'seoul_hanyang' });
  assert(
    hanyangPkg.isHanyangNative === true &&
    hanyangPkg.regionInfo?.scenarioEvent?.scenarioType === SCENARIO_TYPES.EDUCATIONAL_SYNTHETIC &&
    !hanyangPkg.regionInfo?.scenarioEvent?.title.includes('1681 양양'),
    '2.1 (Test A): Hanyang region uses decoupled EDUCATIONAL_SYNTHETIC local drill instead of 1681 Yangyang'
  );

  const coord = LocationProvider.parseCoordinateInput(' 38.2070 , 128.5918 ');
  assert(
    coord && Math.abs(coord.lat - 38.207) < 1e-4 && Math.abs(coord.lon - 128.5918) < 1e-4,
    '2.2 (Test D): LocationProvider parses manual "lat, lon" input cleanly'
  );

  const gyeongjuObs = PRESET_EARTHQUAKE_SCENARIOS.find(s => s.id === 'KMA-2016-GYEONGJU');
  const hazard = HazardProvider.createScenario(gyeongjuObs);

  const impactInSeoul = HazardProvider.evaluateSeismicImpactAtLocation(hazard, 37.555815, 127.045053);
  assert(
    impactInSeoul.impactStatus === IMPACT_ZONE_STATUS.OUTSIDE_IMPACT_ZONE &&
    impactInSeoul.shouldRecommendLocalEvacuation === false &&
    impactInSeoul.distanceKm > 200,
    `2.3 (Test D): 2016 Gyeongju observed event evaluated from Seoul is OUTSIDE_IMPACT_ZONE (${impactInSeoul.distanceKm} km, evac=${impactInSeoul.shouldRecommendLocalEvacuation})`
  );

  const impactInGyeongju = HazardProvider.evaluateSeismicImpactAtLocation(hazard, 35.8347, 129.2190);
  assert(
    impactInGyeongju.impactStatus === IMPACT_ZONE_STATUS.IN_IMPACT_ZONE &&
    impactInGyeongju.shouldRecommendLocalEvacuation === true,
    `2.4 (Test D): Same Gyeongju event evaluated inside Gyeongju is IN_IMPACT_ZONE (${impactInGyeongju.distanceKm} km)`
  );

  const hist1681 = HazardProvider.createScenario(PRESET_EARTHQUAKE_SCENARIOS.find(s => s.id === 'HIST-1681-YANGYANG'));
  const histImpact = HazardProvider.evaluateSeismicImpactAtLocation(hist1681, 38.2070, 128.5918);
  assert(
    histImpact.impactStatus === IMPACT_ZONE_STATUS.HISTORICAL_REFERENCE_ONLY &&
    histImpact.shouldRecommendLocalEvacuation === false,
    '2.5 (Test D): Historical 1681 record stays HISTORICAL_REFERENCE_ONLY without firing active panic alert'
  );

  // Check SituationAssessmentEngine + ResponseUIAdapter respects OUTSIDE_IMPACT_ZONE
  const uiAdapter = new ResponseUIAdapter();
  uiAdapter.setRegionContext({ impactStatus: IMPACT_ZONE_STATUS.OUTSIDE_IMPACT_ZONE, regionLabel: '서울 성동' });
  assert(
    uiAdapter.lastGuidance.canNavigate === false &&
    uiAdapter.lastGuidance.phaseHeadline.includes('영향권 외'),
    '2.6: ResponseUIAdapter suppresses fake evacuation routes when OUTSIDE_IMPACT_ZONE'
  );
}

// ----------------------------------------------------------------------------
// 3. TEST B & C: Sokcho River/Bridge Exclusion, Alternative Routes & Non-Campus Labels
// ----------------------------------------------------------------------------
console.log('\n--- 3. Test B & C: River/Bridge Exclusion, Distinct Alternatives & Non-Campus Labels ---');
{
  const sokchoBench = KOREA_BENCHMARK_REGIONS.find(r => r.id === 'sokcho');
  assert(Boolean(sokchoBench && sokchoBench.shortName.includes('속초')), '3.1 (Test C): Sokcho registered as first-class benchmark region');

  const lat0 = sokchoBench.lat;
  const lon0 = sokchoBench.lon;
  const elements = [];
  const nodeMap = new Map();
  let nextId = 500000;
  const nidAt = (e, n) => {
    const k = `${e}_${n}`;
    if (nodeMap.has(k)) return nodeMap.get(k);
    const ll = localENUToLatLon(e, n, lat0, lon0);
    const id = nextId++;
    elements.push({ type: 'node', id, lat: ll.lat, lon: ll.lon });
    nodeMap.set(k, id);
    return id;
  };
  const wayEN = (pts, tags, close = false, shareNodes = true) => {
    const nodeIds = pts.map(([e, n]) => shareNodes ? nidAt(e, n) : (() => {
      const ll = localENUToLatLon(e, n, lat0, lon0);
      const id = nextId++;
      elements.push({ type: 'node', id, lat: ll.lat, lon: ll.lon });
      return id;
    })());
    if (close && nodeIds.length) nodeIds.push(nodeIds[0]);
    elements.push({ type: 'way', id: nextId++, nodes: nodeIds, tags });
  };

  // Water polygon river canal splitting East (+E) & West (-E) along E=15..65, N=-200..200
  wayEN([[15, -220], [65, -220], [65, 220], [15, 220]], { natural: 'water', name: '청초수로' }, true, false);
  wayEN([[40, -220], [40, 220]], { waterway: 'river', name: '청초천' }, false, false);

  // Two routes across the canal: ONLY one has bridge=yes at N=120! A bad non-bridge edge at N=0 must be dropped!
  wayEN([[-120, 0], [-20, 0], [-20, 120], [10, 120]], { highway: 'footway' });
  wayEN([[10, 120], [70, 120]], { highway: 'footway', bridge: 'yes' }); // Valid bridge across water!
  wayEN([[-20, 0], [80, 0]], { highway: 'footway' }); // Illegal non-bridge segment straight through river at N=0!
  // East bank with TWO alternative sidewalks leading to Sokcho Park at (160, 40)
  wayEN([[70, 120], [160, 120], [160, 40]], { highway: 'pedestrian' });
  wayEN([[70, 120], [70, 40], [160, 40]], { highway: 'footway' });

  // Origin building on West bank (-100, 0) + coastal/urban apartment + Park/School on East bank
  wayEN([[-115, -18], [-75, -18], [-75, 18], [-115, 18]], { building: 'yes', 'building:levels': '5', name: '속초 교동 상가' }, true, false);
  wayEN([[125, 10], [195, 10], [195, 70], [125, 70]], { leisure: 'park', name: '속초 청초 호수공원' }, true, false);

  const sokchoPkg = await loadRegionalSpatialPackage(lat0, lon0, {
    regionId: 'sokcho',
    osmJsonOverride: { elements }
  });

  assert(
    sokchoPkg.initialFacilityPackage !== null &&
    sokchoPkg.initialFacilityPackage.hasIndoorData === false &&
    Object.keys(sokchoPkg.initialFacilityPackage.indoorGraphs || {}).length === 0,
    '3.2 (Test B/C): Non-campus Sokcho package enforces Section 8 indoor scoping (0 fake 3F rooms/stairs)'
  );

  // Verify the compiled route uses the bridge (z <= -100 => north >= 100) and NEVER crosses river at N=0!
  const shortEdges = sokchoPkg.initialFacilityPackage.outdoorGraph.edges.filter(e => e.branch === 'SHORTEST');
  const crossesIllegalCanal = shortEdges.some(e =>
    (e.waypoints || []).some(wp => wp[0] > 18 && wp[0] < 62 && Math.abs(-wp[2]) < 40)
  );
  const usesBridge = shortEdges.some(e =>
    (e.waypoints || []).some(wp => wp[0] >= 10 && wp[0] <= 70 && Math.abs(-wp[2] - 120) < 12)
  );
  assert(!crossesIllegalCanal && usesBridge, '3.3 (River/Bridge): Route strictly rejects non-bridge water crossing and routes over bridge=yes');

  // Verify candidate status is honestly CONDITIONAL (never fakes MOIS official VERIFIED)
  const cand = sokchoPkg.destinationAssessment?.primaryCandidate;
  assert(
    cand && cand.candidateStatus === CANDIDATE_STATUS.CONDITIONAL,
    `3.4: Discovered park "${cand?.name}" marked CONDITIONAL pending field/open confirmation`
  );

  // Verify edge-penalized alternative routes yield genuinely distinct routes
  const router = new PedestrianRoutingEngine({
    useRealMapRouting: true,
    buildingOBBs: sokchoPkg.obbBuildingsFloat32,
    customWalkGraph: sokchoPkg.walkGraph,
    waterPolygons: sokchoPkg.terrainAndHydrology.waterPolygons,
    waterways: sokchoPkg.terrainAndHydrology.waterways
  });
  router.loadFacilityPackage(sokchoPkg.initialFacilityPackage);
  const altBundle = router.findAlternativeRoutes();
  assert(
    Boolean(altBundle.primaryRoute?.found && altBundle.alternativeRoute?.found) &&
    JSON.stringify(altBundle.primaryRoute.waypoints3D) !== JSON.stringify(altBundle.alternativeRoute.waypoints3D),
    `3.5: Genuine edge-penalized alternative routes computed (${altBundle.primaryRoute?.totalDistanceMeters}m vs ${altBundle.alternativeRoute?.totalDistanceMeters}m)`
  );

  // Verify LocalSpatialMapLayer injects NO Hanyang labels ("중랑천"/"한강") on Gyeongju/Sokcho
  const scene = new THREE.Scene();
  const layer = new LocalSpatialMapLayer(scene, { spatialPackage: sokchoPkg });
  const labelTitles = layer.labelAnchors.map(a => a.title);
  assert(
    !labelTitles.includes('중랑천') && !labelTitles.includes('한강') && labelTitles.some(t => t.includes('청초천')),
    `3.6 (Test B): LocalSpatialMapLayer shows region waterway "${labelTitles.find(t => t.includes('청초천'))}" & omits Hanyang Jungrangcheon/Hangang`
  );
  layer.dispose();
}

// ----------------------------------------------------------------------------
// 4. TEST E: Sparse / Empty Data Region -> Honest INSUFFICIENT / UNAVAILABLE
// ----------------------------------------------------------------------------
console.log('\n--- 4. Test E: Sparse / Empty Data Region Returns Honest INSUFFICIENT (0 Fake Objects) ---');
{
  // Case E1: Completely empty mountainous region (Seoraksan peak, 0 OSM elements)
  const sparsePkg = await loadRegionalSpatialPackage(38.1194, 128.4656, {
    regionId: 'seorak_sparse',
    name: '설악산 대청봉 고지',
    shortName: '설악산 능선',
    osmJsonOverride: { elements: [] }
  });
  assert(
    sparsePkg.dataCompleteness === 'INSUFFICIENT' &&
    sparsePkg.obbLodCounts.fullCount === 0 &&
    sparsePkg.walkGraph.edges.length === 0 &&
    sparsePkg.sheltersAndFacilities.length === 0 &&
    sparsePkg.initialFacilityPackage === null &&
    sparsePkg.destinationAssessment.overallStatus === CANDIDATE_STATUS.UNKNOWN,
    '4.1 (Test E1): Empty OSM mountain region returns INSUFFICIENT, UNKNOWN status, null route/package & 0 fake items'
  );

  // Case E2: Isolated cabin building with 0 roads and 0 shelters -> UNAVAILABLE/UNKNOWN, still 0 fake parks/routes
  const cabinOsm = {
    elements: [
      { type: 'node', id: 1, lat: 38.1194, lon: 128.4656 },
      { type: 'node', id: 2, lat: 38.1195, lon: 128.4656 },
      { type: 'node', id: 3, lat: 38.1195, lon: 128.4657 },
      { type: 'node', id: 4, lat: 38.1194, lon: 128.4657 },
      { type: 'way', id: 10, nodes: [1, 2, 3, 4, 1], tags: { building: 'cabin', name: '대청봉 대피 오두막' } }
    ]
  };
  const partialNoRoadPkg = await loadRegionalSpatialPackage(38.1194, 128.4656, {
    osmJsonOverride: cabinOsm
  });
  assert(
    partialNoRoadPkg.dataCompleteness === 'PARTIAL' &&
    partialNoRoadPkg.walkGraph.edges.length === 0 &&
    partialNoRoadPkg.sheltersAndFacilities.length === 0 &&
    partialNoRoadPkg.initialFacilityPackage === null,
    '4.2 (Test E2): Region with isolated building and 0 walkable roads returns null initialFacilityPackage (zero fake orthogonal grid)'
  );

  // Verify LocalSpatialMapLayer renders cleanly without throwing even on 0 OBBs / 0 shelters
  const emptyScene = new THREE.Scene();
  const emptyLayer = new LocalSpatialMapLayer(emptyScene, { spatialPackage: sparsePkg });
  assert(
    !emptyLayer.labelAnchors.some(a => a.title.includes('한양') || a.title.includes('212동')),
    '4.3 (Test E3): LocalSpatialMapLayer mounts 0-OBB/0-shelter package cleanly without Hanyang 212 fallback labels'
  );
  emptyLayer.dispose();
}

console.log('\n====================================================================');
console.log(`UNIVERSAL LOCATION ENGINE RESULTS: ${passed} PASSED | ${failed} FAILED`);
console.log('====================================================================');
if (failed > 0) Deno.exit(1);
