// ============================================================================
// SEISMOLIVE v4.0 — Stage 5: Nationwide 3D Expansion, Dynamic Click & UX Tests
// File: tests/test_stage5_nationwide_and_flight_ux.js
// Run via: deno run --allow-all tests/test_stage5_nationwide_and_flight_ux.js
// ============================================================================

import * as THREE from '../js/lib/three.module.js';
import {
  KOREA_BENCHMARK_REGIONS,
  HANYANG_SHELTER_JUSTIFICATION,
  POST_ARRIVAL_SAFETY_PROTOCOLS,
  compileOsmJsonToSpatialPackage,
  loadRegionalSpatialPackage
} from '../js/response/NationwideKoreaSpatialEngine.js';
import {
  buildDynamicFacilityFromPoint,
  doesSegmentIntersectOBBXZ
} from '../js/response/CampusWalkRouter.js';
import { PedestrianRoutingEngine } from '../js/response/PedestrianRoutingEngine.js';
import { LocalSpatialMapLayer } from '../js/response/LocalSpatialMapLayer.js';

let passed = 0;
let failed = 0;

function assert(cond, msg) {
  if (cond) {
    console.log(`  [PASS] ${msg}`);
    passed++;
  } else {
    console.error(`  [FAIL] ${msg}`);
    failed++;
  }
}

console.log('\n=== STAGE 5 TEST SUITE: NATIONWIDE KOREA 3D, DYNAMIC ROUTING & ORBIT RETURN FIX ===\n');

// ----------------------------------------------------------------------------
// 1. Real OpenStreetMap 0.6 JSON Compilation + Zero-Collision Verification
// ----------------------------------------------------------------------------
console.log('1. Real OSM 0.6 JSON Compilation (Hanyang/Wangsimni) + Concave OBB Check');
{
  const osmRawText = await Deno.readTextFile('./assets/data/osm_hanyang_campus.json');
  const osmJson = JSON.parse(osmRawText);

  const compiled = compileOsmJsonToSpatialPackage(osmJson, {
    lat: 37.555815,
    lon: 127.045053,
    regionId: 'test_osm_hanyang_real',
    title: '실측 OSM 컴파일 검증 패키지',
    halfExtentMeters: 1400
  });

  assert(compiled.obbLodCounts.fullCount >= 140, `1.1: Compiled ${compiled.obbLodCounts.fullCount} decomposed OBB volumes from real OSM buildings`);
  assert(compiled.walkGraph.edges.length > 100, `1.2: Compiled ${compiled.walkGraph.edges.length} walkable pedestrian edges`);
  assert(compiled.sheltersAndFacilities.length >= 1, `1.3: Auto-discovered ${compiled.sheltersAndFacilities.length} justified shelters`);

  const topShelter = compiled.sheltersAndFacilities[0];
  assert(
    Boolean(topShelter?.justification?.areaSqMeters > 500 && topShelter?.justification?.selectionReason),
    `1.4: Shelter "${topShelter?.name}" includes area (${topShelter?.justification?.areaSqMeters}m²) & selection rationale`
  );

  // Verify shortest evacuation route from compiled initialFacilityPackage has 0 OBB interior collisions
  const pkg = compiled.initialFacilityPackage;
  assert(Boolean(pkg?.outdoorGraph?.nodes?.length && pkg?.outdoorGraph?.edges?.length >= 1), '1.5: initialFacilityPackage generated valid indoor/outdoor route graph');

  const nodeMap = new Map(pkg.outdoorGraph.nodes.map(n => [n.id, n]));
  const obbs = compiled.obbBuildingsFloat32;
  let collisions = 0;
  for (const e of pkg.outdoorGraph.edges.filter(x => x.branch === 'SHORTEST')) {
    const u = nodeMap.get(e.source);
    const v = nodeMap.get(e.target);
    if (!u || !v) continue;
    const aXZ = [u.localPos[0], u.localPos[2]];
    const bXZ = [v.localPos[0], v.localPos[2]];
    for (let i = 0; i < obbs.length; i += 6) {
      const obb = {
        east_m: obbs[i + 0],
        north_m: obbs[i + 1],
        width_m: obbs[i + 2],
        depth_m: obbs[i + 3],
        yaw_rad: obbs[i + 4],
        height_m: obbs[i + 5]
      };
      // Skip origin building itself (allow exit door to egress edge)
      const ox = pkg.connector?.doorPos?.[0] ?? 99999;
      const oz = pkg.connector?.doorPos?.[2] ?? 99999;
      if (Math.hypot(obb.east_m - ox, -obb.north_m - oz) < 28) continue;
      if (doesSegmentIntersectOBBXZ(aXZ, bXZ, obb, 1.2)) collisions++;
    }
  }
  assert(collisions === 0, `1.6: Shortest evacuation route avoids ALL unrelated context OBB buildings (collisions=${collisions})`);
}

// ----------------------------------------------------------------------------
// 2. Nationwide Korea Benchmark Regions (Gyeongju, Pohang, Yangyang, Buan, Busan)
// ----------------------------------------------------------------------------
console.log('\n2. Nationwide Korea Regions + Dynamic Building Click Rerouting');
{
  for (const reg of KOREA_BENCHMARK_REGIONS.filter(r => !r.isHanyangDefault)) {
    const pkg = await loadRegionalSpatialPackage(reg.lat, reg.lon, {
      regionId: reg.id,
      name: reg.name,
      shortName: reg.shortName,
      offlineOnly: true
    });
    assert(
      pkg.obbLodCounts.fullCount >= 4 && pkg.sheltersAndFacilities.length >= 1,
      `2.1 (${reg.shortName}): Loaded ${pkg.obbLodCounts.fullCount} OBBs & shelter "${pkg.sheltersAndFacilities[0].name}"`
    );

    const engine = new PedestrianRoutingEngine({
      useRealMapRouting: true,
      buildingOBBs: pkg.obbBuildingsFloat32,
      customWalkGraph: pkg.walkGraph
    });
    engine.loadFacilityPackage(pkg.initialFacilityPackage);
    const route = engine.findOutdoorShortestPath();
    assert(
      route.found && route.totalDistanceMeters > 20,
      `2.2 (${reg.shortName}): Computed route distance = ${route.totalDistanceMeters}m`
    );
  }

  // Test Direct 3D Building Click Factory
  const gyeongjuPkg = await loadRegionalSpatialPackage(35.8347, 129.2190, { regionId: 'gyeongju', offlineOnly: true });
  const clickedDyn = buildDynamicFacilityFromPoint({
    buildingId: 'CLICKED_TEST_99',
    name: '경주 클릭 건물 A',
    east_m: -160,
    north_m: 90,
    width_m: 32,
    depth_m: 22,
    yaw_rad: 0.2,
    height_m: 15,
    anchor: { lat: 35.8347, lon: 129.2190, h: 42 },
    walkGraph: gyeongjuPkg.walkGraph,
    buildingOBBs: gyeongjuPkg.obbBuildingsFloat32,
    shelter: gyeongjuPkg.sheltersAndFacilities[0]
  });
  assert(
    clickedDyn.buildingMetadata.name === '경주 클릭 건물 A' &&
    clickedDyn.outdoorGraph.edges.length >= 2 &&
    clickedDyn.routeBaselines.PATH_SHORTEST_RAPID.targetLengthMeters > 20,
    `2.3: Direct 3D clicked building generated full egress graph (${clickedDyn.outdoorGraph.edges.length} edges, ${clickedDyn.routeBaselines.PATH_SHORTEST_RAPID.targetLengthMeters}m)`
  );
}

// ----------------------------------------------------------------------------
// 3. Feedback 1 Bug Fix Verification (Historical -> Orbit restores Top-Right Entry)
// ----------------------------------------------------------------------------
console.log('\n3. Feedback 1 Bug Fix: Orbit Return After Historical Viewing Restores Entry');
{
  const fakeDom = new Map();
  const makeEl = id => {
    const classSet = new Set();
    const el = {
      id,
      style: { display: 'none', opacity: '1.0' },
      textContent: '',
      innerHTML: '',
      value: '',
      classList: {
        add: (...cls) => cls.forEach(c => classSet.add(c)),
        remove: (...cls) => cls.forEach(c => classSet.delete(c)),
        toggle: (c, f) => (typeof f === 'boolean' ? (f ? classSet.add(c) : classSet.delete(c)) : (classSet.has(c) ? classSet.delete(c) : classSet.add(c))),
        contains: c => classSet.has(c)
      },
      setAttribute: () => {},
      getAttribute: () => '',
      addEventListener: () => {},
      appendChild: () => {},
      querySelectorAll: () => [],
      querySelector: () => null
    };
    if (id) fakeDom.set(id, el);
    return el;
  };
  const ids = [
    'unified-control-surface', 'dev-lab-global-wrap', 'global-dev-lab-menu',
    'tab-cat-historical', 'tab-cat-usgs', 'contextual-benchmarks-shelf',
    'shelf-category-title', 'shelf-items-container', 'brand-count-sub',
    'discover-btn-label', 'chronicle-subtitle-text', 'chronicle-subtitle-container'
  ];
  ids.forEach(makeEl);

  const prevDoc = globalThis.document;
  globalThis.document = {
    getElementById: id => fakeDom.get(id) || null,
    createElement: tag => makeEl(null),
    querySelectorAll: () => [],
    addEventListener: () => {}
  };
  const { UnifiedControlSurface } = await import('../js/ui/UnifiedControlSurface.js');
  const mockCtx = {
    flightState: 'STATE_ORBIT',
    FLIGHT_STATES: { ORBIT: 'STATE_ORBIT', PERFORMANCE: 'STATE_PERFORMANCE' },
    getAllEvents: () => [],
    getBenchmarks: () => []
  };
  const surface = new UnifiedControlSurface({ appContext: mockCtx });

  assert(
    fakeDom.get('dev-lab-global-wrap').style.display === 'inline-flex',
    '3.1: Initial idle Main Globe shows Top-Right Evacuation Lab trigger'
  );

  surface.setExploreCategory('historical');
  assert(
    fakeDom.get('dev-lab-global-wrap').style.display === 'none',
    '3.2: Clicking Historical Archive hides Top-Right trigger during exploration'
  );

  // User navigates into DISCOVER or PERFORMANCE and returns back to Main Globe ('EXPLORE')
  surface.setState('DISCOVER');
  surface.setState('EXPLORE');
  assert(
    surface.exploreCategory === null &&
    fakeDom.get('dev-lab-global-wrap').style.display === 'inline-flex',
    '3.3 (피드백 1): Returning from historical exploration to Main Globe resets exploreCategory & restores entry trigger'
  );

  surface.setExploreCategory('usgs');
  surface.setState('PERFORMANCE', { id: 'us_test' });
  surface.setState('EXPLORE');
  assert(
    surface.exploreCategory === null &&
    fakeDom.get('dev-lab-global-wrap').style.display === 'inline-flex',
    '3.4 (피드백 1): Returning from Performance via Ascent resets exploreCategory & restores entry trigger'
  );

  globalThis.document = prevDoc;
}

// ----------------------------------------------------------------------------
// 4. LocalSpatialMapLayer Hot-Swap + Shelter Arrival Protocol Data Check
// ----------------------------------------------------------------------------
console.log('\n4. LocalSpatialMapLayer.setSpatialPackage Hot-Swap & Shelter Education Metadata');
{
  const scene = new THREE.Scene();
  const layer = new LocalSpatialMapLayer(scene, { theme: 'MONOLITH_NIGHT' });
  const initialCount = layer.getLayerDiagnostics().fullCount;

  const gyeongjuPkg = await loadRegionalSpatialPackage(35.8347, 129.2190, { regionId: 'gyeongju', offlineOnly: true });
  layer.setSpatialPackage(gyeongjuPkg);
  const nextDiag = layer.getLayerDiagnostics();

  assert(
    initialCount > 100 && nextDiag.fullCount === gyeongjuPkg.obbLodCounts.fullCount,
    `4.1: LocalSpatialMapLayer hot-swapped Hanyang (${initialCount} OBBs) -> Gyeongju (${nextDiag.fullCount} OBBs)`
  );
  assert(
    Boolean(HANYANG_SHELTER_JUSTIFICATION['OA-21060']?.selectionReason) &&
    POST_ARRIVAL_SAFETY_PROTOCOLS.length === 3,
    '4.2: Verified Shelter Justification & 3-Step Interactive Post-Arrival Safety Protocols exist'
  );
  layer.dispose();
}

console.log('\n====================================================================');
console.log(`STAGE 5 NATIONWIDE & FLIGHT UX TESTS: ${passed} PASSED | ${failed} FAILED`);
console.log('====================================================================\n');

if (failed > 0) {
  Deno.exit(1);
}
