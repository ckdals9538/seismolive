// ============================================================================
// SEISMOLIVE v4.0 — Public Product Integrated Flow & Scientific Integrity Tests
// File: tests/test_product_integrated_flow.js
// Run via: deno run --allow-all tests/test_product_integrated_flow.js
// ============================================================================

import * as THREE from '../js/lib/three.module.js';
import {
  EXPERIENCE_ENTRY_MODES,
  UnifiedExperienceSession,
  AutoScenarioResolver,
  LocationProvider,
  HazardProvider
} from '../js/response/SpatialDataProviders.js';
import { mergeCatalogWithUncertaintyPreservation } from '../js/data/usgsFeedConnector.js';
import { ExhibitionAppContext } from '../js/ui/ExhibitionAppContext.js';
import { ResponseUIAdapter } from '../js/response/ResponseUIAdapter.js';
import { LocalSpatialMapLayer } from '../js/response/LocalSpatialMapLayer.js';
import { EvacuationExperienceController, renderEvacuationHudMarkup } from '../js/ui/EvacuationExperienceController.js';
import { SCENARIO_TYPES, IMPACT_ZONE_STATUS, CANDIDATE_STATUS } from '../js/response/ResponseDomainTypes.js';
import { PRESET_EARTHQUAKE_SCENARIOS, loadRegionalSpatialPackage, compileOsmJsonToSpatialPackage } from '../js/response/NationwideKoreaSpatialEngine.js';
import { LiveSeismicDataService, LIVE_FEED_STATUS, parseShakeMapStations } from '../js/data/LiveSeismicDataService.js';
import {
  buildDynamicFacilityFromPoint,
  doesSegmentIntersectOBBXZ,
  normalizeOBBList
} from '../js/response/CampusWalkRouter.js';
import { PedestrianRoutingEngine } from '../js/response/PedestrianRoutingEngine.js';
import { HanyangResponseAdapter } from '../js/response/HanyangResponseAdapter.js';
import { HANYANG_LOCAL_4KM_PACKAGE, OFFICIAL_SHELTERS_AND_FACILITIES } from '../js/response/HanyangLocalSpatialData.js';
import { HANYANG_CAMPUS_WALK_GRAPH } from '../js/response/HanyangCampusWalkData.js';

let passed = 0;
let failed = 0;

function assert(cond, msg, detail = '') {
  if (cond) {
    passed++;
    console.log(`  [PASS] ${msg}`);
    if (detail) console.log(`         -> ${detail}`);
  } else {
    failed++;
    console.error(`  [FAIL] ${msg}`);
    if (detail) console.error(`         -> FAIL: ${detail}`);
  }
}

console.log('====================================================================');
console.log('SEISMOLIVE v4.0 — Integrated Public Product Flow & Integrity Tests');
console.log('====================================================================\n');

// ----------------------------------------------------------------------------
// 1. UnifiedExperienceSession + Globe Event Handoff
// ----------------------------------------------------------------------------
console.log('--- 1. Globe Event Handoff & Session State Separation ---');
{
  const appCtx = new ExhibitionAppContext();
  const session = new UnifiedExperienceSession();
  appCtx.attachSession(session);

  let receivedPayload = null;
  appCtx.registerHandlers({
    enterInSceneLocalResponse: async (payload) => {
      receivedPayload = payload;
      return payload;
    }
  });

  const sampleUsgsEvent = {
    id: 'us7000product1',
    eventId: 'us7000product1',
    titleKo: '속초 동쪽 해역 관측 지진',
    lat: 38.22,
    lon: 128.68,
    mag: 5.3,
    magType: 'Mw',
    depth: 11.4,
    dateText: '2026-11-10 04:12 UTC',
    recordType: 'usgs-live',
    sourceName: 'USGS 실시간 관측망',
    officialProducts: {
      status: 'READY',
      shakemap: { maxMmi: 5.6 },
      oaf: { p5plusProbNextWeek: 0.08 }
    }
  };

  await appCtx.handoffEventToLocalResponse(sampleUsgsEvent, { withFlight: false });
  assert(
    session.entryMode === EXPERIENCE_ENTRY_MODES.FROM_GLOBE_EVENT &&
    session.handedGlobeEvent?.id === 'us7000product1' &&
    receivedPayload?.entryMode === 'FROM_GLOBE_EVENT' &&
    receivedPayload?.handedEvent?.officialProducts?.shakemap?.maxMmi === 5.6 &&
    receivedPayload?.handedEvent?.epicenterLat === 38.22,
    '1.1: Globe event hands off coordinates, magnitude, depth, and officialProducts intact'
  );

  // Check OAF is never treated as current PGA / ShakeMap, and null depth/mag stay null
  const noShakeNormalized = HazardProvider.normalizeGlobeEvent({
    id: 'us7000oafonly',
    titleKo: 'OAF 전용 레코드',
    lat: 36.1,
    lon: 129.3,
    mag: 4.9,
    officialProducts: { shakemap: null, oaf: { p5plusProbNextWeek: 0.12 } }
  });
  assert(
    noShakeNormalized.officialProducts.shakemap === null &&
    noShakeNormalized.officialProducts.aftershockForecast !== null &&
    noShakeNormalized.pga === undefined,
    '1.2: Absence of ShakeMap preserves null even when OAF forecast exists (no synthetic PGA)'
  );
}

// ----------------------------------------------------------------------------
// 2. LocationProvider & Free Mode vs Actual GPS Strict Isolation
// ----------------------------------------------------------------------------
console.log('\n--- 2. LocationProvider GPS vs Free Mode Isolation ---');
{
  const lp = new LocationProvider();
  assert(
    lp.getActiveAnalysisLocation() === null &&
    lp.userCurrentLocation === null,
    '2.1: Fresh LocationProvider returns null instead of silent Hanyang fallback'
  );

  lp.setUserSelectedLocation(35.1587, 129.1604, '부산 해운대 자유선택');
  const freeLoc = lp.getActiveAnalysisLocation();
  assert(
    freeLoc !== null &&
    freeLoc.isActualUserGps === false &&
    lp.userCurrentLocation === null,
    '2.2: Free Mode sets analysis anchor with isActualUserGps=false and keeps userCurrentLocation null'
  );

  lp.setGpsLocation(37.5665, 126.9780, 18, '내 현재 위치(GPS)');
  const gpsLoc = lp.getActiveAnalysisLocation();
  assert(
    gpsLoc !== null &&
    gpsLoc.isActualUserGps === true &&
    lp.userCurrentLocation?.lat === 37.5665,
    '2.3: Real GPS sets isActualUserGps=true distinctly from Free Mode'
  );
}

// ----------------------------------------------------------------------------
// 3. Conservative KMA + USGS Catalog Merging
// ----------------------------------------------------------------------------
console.log('\n--- 3. Multi-Agency Conservative Linking (KMA + USGS) ---');
{
  const baseMs = Date.UTC(2024, 5, 12, 0, 26, 49);
  const kmaEvents = [
    { id: 'kma_buan_2024', lat: 35.70, lon: 126.71, mag: 4.8, occurredAtMs: baseMs, sourceName: '기상청(KMA)' },
    { id: 'kma_divergent', lat: 35.90, lon: 128.10, mag: 3.1, occurredAtMs: baseMs + 200000, sourceName: '기상청(KMA)' }
  ];
  const usgsEvents = [
    { id: 'us_buan_match', lat: 35.72, lon: 126.74, mag: 4.7, occurredAtMs: baseMs + 8000, sourceName: 'USGS' },
    { id: 'us_separate', lat: 36.40, lon: 128.90, mag: 4.4, occurredAtMs: baseMs + 205000, sourceName: 'USGS' }
  ];
  const merged = mergeCatalogWithUncertaintyPreservation(kmaEvents, usgsEvents);
  const linkedBuan = merged.find(e => e.id === 'kma_buan_2024');
  const sepUsgs = merged.find(e => e.id === 'us_separate');
  assert(
    merged.length === 3 &&
    linkedBuan?.alternateAgencyRecords?.length === 1 &&
    linkedBuan.alternateAgencyRecords[0].eventId === 'us_buan_match' &&
    Boolean(sepUsgs),
    '3.1: Links close KMA/USGS match with alternateAgencyRecords preserved while keeping ambiguous events separate',
    `mergedCount=${merged.length}`
  );
}

// ----------------------------------------------------------------------------
// 4. AutoScenarioResolver (Handed -> Regional Observed -> Educational General)
// ----------------------------------------------------------------------------
console.log('\n--- 4. AutoScenarioResolver Context Selection ---');
{
  const handedRes = AutoScenarioResolver.resolveForLocation({
    anchorLat: 37.55,
    anchorLon: 127.04,
    anchorLabel: '서울 성동',
    catalogEvents: PRESET_EARTHQUAKE_SCENARIOS,
    handedEvent: {
      eventId: 'us7000handed',
      title: '포항 인근 실측 지진',
      epicenterLat: 36.11,
      epicenterLon: 129.36,
      mag: 5.4,
      magScale: 'Mw',
      depthKm: 4.3,
      sourceName: 'USGS'
    }
  });
  const evalDist = HazardProvider.evaluateSeismicImpactAtLocation(handedRes, 37.55, 127.04);
  assert(
    handedRes.id === 'us7000handed' &&
    evalDist.impactStatus === IMPACT_ZONE_STATUS.OUTSIDE_IMPACT_ZONE,
    '4.1: Handed event near Pohang from Seoul evaluates honestly as OUTSIDE_IMPACT_ZONE'
  );

  const gyeongjuAuto = AutoScenarioResolver.resolveForLocation({
    anchorLat: 35.8347,
    anchorLon: 129.2190,
    anchorLabel: '경주 도심',
    catalogEvents: PRESET_EARTHQUAKE_SCENARIOS
  });
  assert(
    gyeongjuAuto.scenarioType === SCENARIO_TYPES.OBSERVED_EVENT &&
    gyeongjuAuto.id === 'KMA-2016-GYEONGJU',
    '4.2: Location inside Gyeongju auto-resolves real KMA 2016 observed earthquake'
  );

  const seoulAuto = AutoScenarioResolver.resolveForLocation({
    anchorLat: 37.5596,
    anchorLon: 127.0410,
    anchorLabel: '서울 성동',
    catalogEvents: PRESET_EARTHQUAKE_SCENARIOS
  });
  assert(
    seoulAuto.scenarioType === SCENARIO_TYPES.EDUCATIONAL_SYNTHETIC &&
    seoulAuto.isGeneralAssumptionOnly === true &&
    seoulAuto.selectionReasonKo.includes('교육용'),
    '4.3: Location outside observed impact zones auto-resolves clearly marked educational assumption (no fake fault claims)'
  );
}

// ----------------------------------------------------------------------------
// 5. Origin Marker Semantics + Sparse Adaptive OSM + Station Null Telemetry
// ----------------------------------------------------------------------------
console.log('\n--- 5. Origin Marker Semantics, Adaptive Origin & Telemetry Null Safety ---');
{
  const scene = new THREE.Scene();
  const layer = new LocalSpatialMapLayer(scene, {
    spatialPackage: await loadRegionalSpatialPackage(38.2070, 128.5918, {
      regionId: 'sokcho',
      useOfflineFallback: true
    })
  });

  layer.setActiveOriginFacility({
    id: 'ANCHOR_GPS',
    name: '성동구 인근',
    east_m: 10,
    north_m: 10,
    originHasBuilding: false,
    markerMode: 'USER_GPS'
  });
  const gpsLabel = layer._activeOriginMeta.title;

  layer.setActiveOriginFacility({
    id: 'ANCHOR_FREE',
    name: '속초 청초',
    east_m: 10,
    north_m: 10,
    originHasBuilding: false,
    markerMode: 'FREE_MODE_ANCHOR'
  });
  const freeLabel = layer._activeOriginMeta.title;

  layer.setActiveOriginFacility({
    id: 'BLDG_CAFE',
    name: '테스트 상가',
    east_m: 20,
    north_m: 20,
    originHasBuilding: true,
    markerMode: 'PICKED_BUILDING'
  });
  const bldgLabel = layer._activeOriginMeta.title;

  assert(
    gpsLabel.includes('GPS') &&
    !freeLabel.includes('내 위치') &&
    freeLabel.includes('자유 모드') &&
    bldgLabel.includes('선택 건물') &&
    !bldgLabel.includes('내 위치'),
    '5.1: 3D origin markers cleanly distinguish GPS vs Free Mode vs explicitly clicked building',
    `gps="${gpsLabel}" | free="${freeLabel}" | bldg="${bldgLabel}"`
  );
  layer.dispose();

  const adapter = new ResponseUIAdapter();
  assert(
    adapter.context.sources.station === null &&
    adapter.context.disaster.pga_g === null,
    '5.2: ResponseUIAdapter initializes cleanly with null station telemetry (no fake 0.08g)'
  );
  adapter.updateStationMotion(0.18);
  adapter.clearStationTelemetry();
  assert(
    adapter.context.sources.station === null &&
    adapter.context.disaster.isShakingActive === false,
    '5.3: clearStationTelemetry resets PGA & shaking flag honestly back to null'
  );
}

// ----------------------------------------------------------------------------
// 6. Developer Diagnostics Isolation (?dev=1) & Entry Gate HUD Contract
// ----------------------------------------------------------------------------
console.log('\n--- 6. Public UI vs ?dev=1 Diagnostics Markup Contract ---');
{
  const makeFakeEl = () => ({
    classList: {
      set: new Set(),
      add(c) { this.set.add(c); },
      remove(c) { this.set.delete(c); },
      toggle(c, force) { force === undefined ? (this.set.has(c) ? this.set.delete(c) : this.set.add(c)) : (force ? this.set.add(c) : this.set.delete(c)); },
      contains(c) { return this.set.has(c); }
    },
    innerHTML: ''
  });

  const pubRoot = makeFakeEl();
  renderEvacuationHudMarkup(pubRoot, { devMode: false });
  const devRoot = makeFakeEl();
  renderEvacuationHudMarkup(devRoot, { devMode: true });

  assert(
    !pubRoot.classList.contains('is-dev-mode') &&
    devRoot.classList.contains('is-dev-mode') &&
    pubRoot.innerHTML.includes('id="entry-mode-gate"') &&
    pubRoot.innerHTML.includes('id="handoff-context-strip"') &&
    pubRoot.innerHTML.includes('class="ctrl-btn dev-only-control" id="btn-dev-lab-toggle"') &&
    !pubRoot.innerHTML.includes('212동 제1공학관'),
    '6.1: Normal user markup omits Hanyang 3-building strip, gates dev drawer behind .dev-only-control, and mounts Entry Gate + Handoff Strip'
  );
}

// ----------------------------------------------------------------------------
// 7. LiveSeismicDataService Catalog Merge (KMA + USGS Live & Offline Fallback)
// ----------------------------------------------------------------------------
console.log('\n--- 7. LiveSeismicDataService Multi-Agency Catalog & Fallback ---');
{
  const baseMs = Date.UTC(2026, 10, 14, 6, 15, 0);
  const mockLiveSvc = new LiveSeismicDataService({
    apiBase: 'https://seismolive.test',
    fetchFn: async (url) => {
      if (url.includes('/api/earthquakes')) {
        return {
          ok: true,
          headers: { get: () => 'application/json' },
          json: async () => ({
            ok: true,
            agencies: { kma: { status: 'LIVE' } },
            kmaEvents: [
              { id: 'kma_live_1', lat: 36.11, lon: 129.36, mag: 3.8, occurredAtMs: baseMs, sourceName: '기상청(KMA)', titleKo: '포항 북구 실시간' }
            ],
            usgsGlobalFeatures: [
              {
                id: 'us7000match_ph',
                type: 'Feature',
                geometry: { coordinates: [129.37, 36.12, 9.2] },
                properties: { mag: 3.9, time: baseMs + 4000, title: 'M 3.9 - Pohang', place: 'Pohang', detail: 'https://earthquake.usgs.gov/mock/detail.json', magType: 'mb', status: 'reviewed' }
              },
              {
                id: 'us7000global_jp',
                type: 'Feature',
                geometry: { coordinates: [142.3, 38.1, 32.0] },
                properties: { mag: 6.1, time: baseMs + 90000, title: 'M 6.1 - Honshu', place: 'Japan', detail: 'https://earthquake.usgs.gov/mock/jp.json', magType: 'mww', status: 'reviewed' }
              }
            ],
            usgsRegionalFeatures: []
          })
        };
      }
      return { ok: false, json: async () => null };
    }
  });

  const liveRes = await mockLiveSvc.fetchLiveEarthquakeCatalog({ forceRefresh: true });
  const linkedKma = liveRes.events.find(e => e.id === 'kma_live_1');
  assert(
    liveRes.feedStatus === LIVE_FEED_STATUS.LIVE_MULTI_AGENCY &&
    liveRes.kmaCount === 1 &&
    liveRes.usgsCount === 2 &&
    liveRes.events.length === 2 &&
    linkedKma?.alternateAgencyRecords?.length === 1,
    '7.1: Merges KMA + USGS proxy feeds with LIVE_MULTI_AGENCY status & conservative cross-agency linking',
    `feed=${liveRes.feedStatus}, events=${liveRes.events.length}`
  );

  // Offline snapshot fallback when /api/earthquakes & upstream USGS fail
  const mockOfflineSvc = new LiveSeismicDataService({
    apiBase: 'https://seismolive.test',
    fetchFn: async (url) => {
      if (url.includes('usgs_4.5_month.geojson')) {
        return {
          ok: true,
          headers: { get: () => 'application/geo+json' },
          json: async () => ({
            type: 'FeatureCollection',
            features: [
              {
                id: 'snap_ev_1',
                type: 'Feature',
                geometry: { coordinates: [140.5, 35.8, 22] },
                properties: { mag: 5.1, time: baseMs, title: 'M 5.1 Snapshot', place: 'Chiba' }
              }
            ]
          })
        };
      }
      return { ok: false, json: async () => null };
    }
  });
  const snapRes = await mockOfflineSvc.fetchLiveEarthquakeCatalog({ forceRefresh: true });
  assert(
    snapRes.feedStatus === LIVE_FEED_STATUS.OFFLINE_SNAPSHOT &&
    snapRes.events.length === 1 &&
    snapRes.events[0].id === 'snap_ev_1',
    '7.2: Falls back cleanly to local snapshot when live proxy & USGS are unreachable',
    `feed=${snapRes.feedStatus}`
  );
}

// ----------------------------------------------------------------------------
// 8. Observed ShakeMap Stationlist Parsing (%g -> g) & Null Honesty
// ----------------------------------------------------------------------------
console.log('\n--- 8. ShakeMap Stationlist Strong-Motion Parsing & Null Safety ---');
{
  const parsedStations = parseShakeMapStations([
    {
      id: 'stn-kma-ph',
      geometry: { coordinates: [129.36, 36.11] },
      properties: { code: 'PHA2', network: 'KS', name: 'Pohang Station', station_type: 'seismic', pga: 12.4, pgv: 9.8, mmi: 5.5 }
    },
    {
      id: 'stn-dyfi-ignored',
      geometry: { coordinates: [129.40, 36.15] },
      properties: { code: 'DYFI1', station_type: 'DYFI', mmi: 4.1 }
    },
    {
      id: 'stn-chan-amp',
      geometry: { coordinates: [129.50, 36.20] },
      properties: {
        code: 'YSU',
        network: 'KG',
        station_type: 'seismic',
        channels: [{ amplitudes: [{ name: 'pga', value: 4.5 }, { name: 'pgv', value: 2.1 }] }]
      }
    }
  ], 36.10, 129.35);

  assert(
    parsedStations.length === 2 &&
    parsedStations[0].code === 'PHA2' &&
    Math.abs(parsedStations[0].pga_g - 0.124) < 1e-6 &&
    Math.abs(parsedStations[1].pga_g - 0.045) < 1e-6 &&
    parsedStations.every(s => s.isInstrument),
    '8.1: Extracts real strong-motion PGA (%g -> g) from ShakeMap stationlist & ignores unmeasured DYFI reports',
    `stns=${parsedStations.length}, topPga=${parsedStations[0]?.pga_g}g`
  );

  const mockProductSvc = new LiveSeismicDataService({
    fetchFn: async () => ({
      ok: true,
      headers: { get: () => 'application/json' },
      json: async () => ({
        ok: true,
        detailJson: {
          properties: { mag: 4.6, magType: 'mww', products: {} }
        },
        stationFeatures: []
      })
    })
  });
  const emptyProducts = await mockProductSvc.fetchOfficialEventProducts({ usgsDetailUrl: 'https://earthquake.usgs.gov/mock/empty.json' });
  assert(
    emptyProducts.shakemap === null &&
    emptyProducts.oaf === null &&
    Array.isArray(emptyProducts.stations) &&
    emptyProducts.stations.length === 0,
    '8.2: Missing ShakeMap / OAF / stations strictly return null & [] (never fabricated)'
  );
}

// ----------------------------------------------------------------------------
// 9. MOIS Official Shelter API Promotion -> CONFIRMED w/ UNVERIFIED_IN_DISASTER
// ----------------------------------------------------------------------------
console.log('\n--- 9. Official MOIS Shelter API Promotion & Operational Uncertainty ---');
{
  const anchorLat = 38.2070;
  const anchorLon = 128.5918;
  const mockOsm = {
    elements: [
      { type: 'node', id: 101, lat: 38.2070, lon: 128.5918 },
      { type: 'node', id: 102, lat: 38.2082, lon: 128.5918 },
      { type: 'way', id: 201, nodes: [101, 102], tags: { highway: 'footway', name: '청초 보행길' } }
    ]
  };
  const pkgWithOfficial = compileOsmJsonToSpatialPackage(mockOsm, {
    lat: anchorLat,
    lon: anchorLon,
    regionId: 'sokcho_test_official',
    officialShelters: [
      {
        id: 'MOIS_38207_01',
        name: '속초초등학교 운동장',
        lat: 38.2081,
        lon: 128.5919,
        capacity: 1400,
        facilityType: 'EARTHQUAKE_OUTDOOR_SHELTER',
        isOfficialDesignated: true,
        verificationSource: 'MOIS_EARTHQUAKE_SHELTER_API'
      }
    ]
  });

  const officialCand = pkgWithOfficial.destinationAssessment?.candidates?.find(c => c.id === 'MOIS_38207_01');
  assert(
    Boolean(officialCand) &&
    officialCand.candidateStatus === CANDIDATE_STATUS.CONFIRMED &&
    String(officialCand.dimensions?.officialDesignation || '').includes('OFFICIAL_DESIGNATED') &&
    String(officialCand.dimensions?.openStatus || '').includes('UNVERIFIED_IN_DISASTER'),
    '9.1: MOIS /api/shelters entry promotes reachable candidate to CONFIRMED while retaining UNVERIFIED_IN_DISASTER operational note',
    `status=${officialCand?.candidateStatus}, op="${officialCand?.dimensions?.openStatus}"`
  );
}

// ----------------------------------------------------------------------------
// 10. Null-Shelter Guard & Rapid Hanyang Multi-Building Click Performance
// ----------------------------------------------------------------------------
console.log('\n--- 10. Null Shelter Guard & Hanyang Dense OBB Click Latency (< 150ms) ---');
{
  const nullRoutePkg = buildDynamicFacilityFromPoint({
    originId: 'TEST_NULL_SHELTER',
    originName: '무대피소 테스트 건물',
    east_m: 12,
    north_m: 15,
    shelter: null,
    obbObstacles: []
  });
  assert(
    nullRoutePkg !== null &&
    nullRoutePkg.shelter === null &&
    Array.isArray(nullRoutePkg.cameraViewpoints?.CAMPUS_OVERVIEW?.target),
    '10.1: buildDynamicFacilityFromPoint handles shelter: null safely with zero TypeError'
  );

  // Stress-click 10 spread Hanyang buildings against the full 6,407-OBB mesh
  const hanyangObbCount = Math.floor(HANYANG_LOCAL_4KM_PACKAGE.obbBuildingsFloat32.length / 6);
  const sampleOrigins = [
    { id: 'HY_1', name: '제1공학관', e: 52, n: -74 },
    { id: 'HY_2', name: 'HIT', e: 78, n: 18 },
    { id: 'HY_3', name: '백남학술정보관', e: -42, n: 18 },
    { id: 'HY_4', name: '신본관', e: -12, n: 45 },
    { id: 'HY_5', name: 'IT·BT관', e: 145, n: -25 },
    { id: 'HY_6', name: '올림픽체육관', e: 230, n: -180 },
    { id: 'HY_7', name: '행당동 주거', e: -260, n: 220 },
    { id: 'HY_8', name: '사근동 주거', e: 310, n: 165 },
    { id: 'HY_9', name: '왕십리역 인근', e: -320, n: -140 },
    { id: 'HY_10', name: '중랑천 북단', e: 120, n: -340 }
  ];

  const primaryShelter = OFFICIAL_SHELTERS_AND_FACILITIES[0];
  // Warmup once (spatial grid builds and caches on OBB array)
  buildDynamicFacilityFromPoint({
    buildingId: 'WARMUP',
    name: '워밍업',
    east_m: 52,
    north_m: -74,
    buildingOBBs: HANYANG_LOCAL_4KM_PACKAGE.obbBuildingsFloat32,
    walkGraph: HANYANG_CAMPUS_WALK_GRAPH,
    shelter: primaryShelter
  });

  let maxClickMs = 0;
  let allResolved = true;
  for (const b of sampleOrigins) {
    const t0 = performance.now();
    const res = buildDynamicFacilityFromPoint({
      buildingId: b.id,
      name: b.name,
      east_m: b.e,
      north_m: b.n,
      buildingOBBs: HANYANG_LOCAL_4KM_PACKAGE.obbBuildingsFloat32,
      walkGraph: HANYANG_CAMPUS_WALK_GRAPH,
      shelter: primaryShelter
    });
    const elapsed = performance.now() - t0;
    if (elapsed > maxClickMs) maxClickMs = elapsed;
    const lenM = res?.routeBaselines?.PATH_SHORTEST_RAPID?.targetLengthMeters || 0;
    if (!(lenM > 0)) allResolved = false;
  }

  assert(
    allResolved && maxClickMs < 150,
    `10.2: 10 rapid building clicks across ${hanyangObbCount} Hanyang OBBs resolve cleanly without freezing (max=${maxClickMs.toFixed(1)}ms < 150ms)`
  );
}

// ----------------------------------------------------------------------------
// 11. Nationwide Urban Block Avoidance, Mid-Edge Snap, Ridge DEM & Z-Fighting Guard
// ----------------------------------------------------------------------------
console.log('\n--- 11. Non-Hanyang Urban Block Routing, DEM Ridge Following & Z-Fighting Guard ---');
{
  // Synthetic dense urban block:
  // - Origin building [0, 0] (east=0, north=0 => XZ=[0, 0])
  // - Neighbor rowhouses at [-22, 0], [22, 0] and blocking long hall at [0, 34] (inside legacy 52m exclusion!)
  // - Street loop whose intersections are >160m apart: south ave (north=14 => z=-14), north ave (north=78 => z=-78),
  //   west/east avenues at east=-80, +80; plus a blocked alley straight through [0, 34].
  const hillSampler = (eastM, northM) => 10.0 + 8.0 * Math.exp(-((eastM * eastM) / 420.0));
  const obbRaw = [
    0, 0, 18, 12, 0, 12,     // Origin building
    -22, 0, 18, 12, 0, 12,   // West neighbor wing
    22, 0, 18, 12, 0, 12,    // East neighbor wing
    0, 34, 44, 16, 0, 15     // Neighbor apartment block at 34m (< 52m legacy exclusion radius!)
  ];
  const obbFloat = new Float32Array(obbRaw);
  const blockGraph = {
    nodes: [
      ['S_W', -80, 14, hillSampler(-80, 14)],
      ['S_E', 80, 14, hillSampler(80, 14)],
      ['N_W', -80, 78, hillSampler(-80, 78)],
      ['N_E', 80, 78, hillSampler(80, 78)],
      ['MID_S', -2, 18, hillSampler(-2, 18)],
      ['MID_N', 2, 74, hillSampler(2, 74)]
    ],
    edges: [
      [0, 1, 160, 'residential', false, 0, false, false],
      [2, 3, 160, 'residential', false, 0, false, false],
      [0, 2, 64, 'residential', false, 0, false, false],
      [1, 3, 64, 'residential', false, 0, false, false],
      // Alley segment slicing directly through the [0, 34] apartment OBB (must be rejected!)
      [4, 5, 56, 'service', false, 0, false, false]
    ]
  };
  const shelterDest = {
    shelterId: 'SHELTER_PARK_N',
    officialName: '북측 개활 광장',
    east_m: 0,
    north_m: 92
  };
  const dynPkg = buildDynamicFacilityFromPoint({
    buildingId: 'URBAN_TEST_01',
    name: '도시 연립 A동',
    east_m: 0,
    north_m: 0,
    width_m: 18,
    depth_m: 12,
    yaw_rad: 0,
    height_m: 12,
    walkGraph: blockGraph,
    buildingOBBs: obbFloat,
    shelter: shelterDest,
    elevationSampler: hillSampler
  });
  const engine = new PedestrianRoutingEngine({
    facilityPackage: dynPkg,
    useRealMapRouting: true,
    buildingOBBs: obbFloat,
    customWalkGraph: blockGraph,
    elevationSampler: hillSampler
  });
  const route = engine.findOutdoorShortestPath();
  const wps = route.waypoints3D || [];
  const obbList = normalizeOBBList(obbFloat);
  let neighborHits = 0;
  let submergedMidpoints = 0;
  let maxSegSpan = 0;
  for (let i = 1; i < wps.length; i++) {
    const aXZ = [wps[i - 1][0], wps[i - 1][2]];
    const bXZ = [wps[i][0], wps[i][2]];
    const span = Math.hypot(bXZ[0] - aXZ[0], bXZ[1] - aXZ[1]);
    if (span > maxSegSpan) maxSegSpan = span;
    for (let oi = 1; oi < obbList.length; oi++) {
      if (doesSegmentIntersectOBBXZ(aXZ, bXZ, obbList[oi], 0.0)) neighborHits++;
    }
    const mx = (aXZ[0] + bXZ[0]) * 0.5;
    const mz = (aXZ[1] + bXZ[1]) * 0.5;
    const my = (wps[i - 1][1] + wps[i][1]) * 0.5;
    const groundY = hillSampler(mx, -mz);
    if (my < groundY + 0.1) submergedMidpoints++;
  }
  assert(
    route.found === true &&
    neighborHits === 0 &&
    submergedMidpoints === 0 &&
    maxSegSpan <= 9.5,
    '11.1: Non-Hanyang urban block projects onto long streets, clears 34m neighbor OBBs, and hugs hill ridges',
    `found=${route.found}, dist=${route.totalDistanceMeters}m, hits=${neighborHits}, submerged=${submergedMidpoints}, maxSpan=${maxSegSpan.toFixed(1)}m`
  );

  // Verify identical SHORTEST/STEP_FREE routes suppress duplicate Z-fighting ribbon in ALL mode
  const mockScene = new THREE.Scene();
  const adapter = new HanyangResponseAdapter(mockScene, {
    facilityPackage: dynPkg,
    router: engine,
    elevationSampler: hillSampler
  });
  const shortVol = adapter.pathGroup.children.find(c => c.name === 'Ribbon_Shortest_Volume');
  const stepVol = adapter.pathGroup.children.find(c => c.name === 'Ribbon_StepFree_Volume');
  const hiddenInAllMode = Boolean(stepVol && stepVol.userData.identicalToShortest === true && stepVol.visible === false && shortVol?.visible === true);
  adapter.setRouteDisplay('STEP_FREE');
  const shownInStepFree = Boolean(stepVol && stepVol.visible === true && shortVol?.visible === false);
  adapter.dispose();

  assert(
    hiddenInAllMode && shownInStepFree,
    '11.2: Identical SHORTEST/STEP_FREE routes suppress overlapping tube in ALL mode while toggling cleanly in STEP_FREE mode',
    `hiddenInAll=${hiddenInAllMode}, shownInStepFree=${shownInStepFree}`
  );

  // 11.3: Dynamic building selection re-evaluates candidate distances, re-sorts closest-first,
  // and automatically selects the true shortest shelter instead of sticking to previous selection
  const mockScene2 = new THREE.Scene();
  const mockCam2 = new THREE.PerspectiveCamera(45, 1.6, 0.25, 4000);
  const ctrl = new EvacuationExperienceController({
    scene: mockScene2,
    camera: mockCam2,
    deferInitialBoot: true,
    useLegacyCampusBoot: false
  });
  ctrl.activeSpatialPkg = {
    metadata: { anchor: { lat: 37.55, lon: 127.04 } },
    terrainGrid: { nx: 4, nz: 4, halfExtentMeters: 300, heights: new Array(25).fill(0) },
    obbBuildingsFloat32: new Float32Array(0),
    walkGraph: {
      nodes: [
        ['N0', 0, 0, 0],
        ['N1', 120, 0, 0],
        ['N2', 260, 0, 0],
        ['N3', -100, 0, 0]
      ],
      edges: [
        [3, 0, 100, 'residential', false, 0, false, false],
        [0, 1, 120, 'residential', false, 0, false, false],
        [1, 2, 140, 'residential', false, 0, false, false]
      ]
    },
    sheltersAndFacilities: [
      { id: 'SH_FAR', name: '먼 대피소', east_m: 260, north_m: 0, candidateStatus: CANDIDATE_STATUS.CONDITIONAL, dimensions: { distanceMeters: 900 } },
      { id: 'SH_WEST', name: '서쪽 광장', east_m: -100, north_m: 0, candidateStatus: CANDIDATE_STATUS.CONDITIONAL, dimensions: { distanceMeters: 150 } },
      { id: 'SH_MID', name: '가까운 운동장', east_m: 120, north_m: 0, candidateStatus: CANDIDATE_STATUS.CONDITIONAL, dimensions: { distanceMeters: 400 } }
    ]
  };
  ctrl.activeWalkGraph = ctrl.activeSpatialPkg.walkGraph;
  ctrl.router.setRealMapRouting({
    enabled: true,
    buildingOBBs: ctrl.activeSpatialPkg.obbBuildingsFloat32,
    customWalkGraph: ctrl.activeWalkGraph,
    elevationSampler: () => 0
  });
  // Simulate user had previously selected SH_MID or SH_WEST, then clicks a building right next to SH_FAR (east=250)
  ctrl.selectedCandidateIndex = 1;
  ctrl.selectShortestOriginAndBuildFacility({
    id: 'BLDG_EAST', name: '동측 신축동', east_m: 245, north_m: 0, width_m: 10, depth_m: 10, yaw_rad: 0, height_m: 12
  }, { snapStage: false, autoPlay: true, markerMode: 'PICKED_BUILDING' });

  const sortedIds = ctrl.activeSpatialPkg.sheltersAndFacilities.map(c => c.id);
  const topDist = ctrl.activeSpatialPkg.sheltersAndFacilities[0]?.dimensions?.distanceMeters;
  assert(
    ctrl.selectedCandidateIndex === 0 &&
    sortedIds[0] === 'SH_FAR' &&
    sortedIds[1] === 'SH_MID' &&
    sortedIds[2] === 'SH_WEST' &&
    topDist < 50,
    '11.3: Selecting a different building dynamically updates pill distances, re-sorts shortest-first, and selects index 0',
    `idx=${ctrl.selectedCandidateIndex}, order=${sortedIds.join('>')}, topDist=${topDist}m`
  );
  ctrl.dispose?.();
}

console.log('\n====================================================================');
console.log(`INTEGRATED PRODUCT FLOW TESTS: ${passed} PASSED | ${failed} FAILED`);
console.log('====================================================================');

if (failed > 0) {
  Deno.exit(1);
}
