// ============================================================================
// SEISMOLIVE v4.0 — Terrain Data Resolver Unit Test Suite
// File: tests/test_terrain_resolver.js
// Run via: deno run -A tests/test_terrain_resolver.js
// ============================================================================

import {
  SURFACE_CLASSIFICATION,
  RASTER_PIXEL_TYPE,
  GeoRasterSampler,
  classifySurface,
  TerrainLifecycleManager
} from '../js/3d/terrainDataResolver.js';

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
console.log('SEISMOLIVE v4.0 — Terrain Resolver & Alignment Unit Test Suite');
console.log('====================================================================\n');

// ----------------------------------------------------------------------------
// 1. GeoRasterSampler Pixel Alignment: PixelIsPoint vs PixelIsArea
// ----------------------------------------------------------------------------
console.log('--- Test Group 1: GeoRasterSampler Pixel Alignment ---');

// Mock a 10x10 elevation grid spanning Lon 128.0 to 129.0 (0.1 deg/pixel), Lat 39.0 to 38.0 (0.1 deg/pixel)
const mockData = new Float32Array(100);
for (let y = 0; y < 10; y++) {
  for (let x = 0; x < 10; x++) {
    mockData[y * 10 + x] = y * 100 + x * 10; // predictable elevation
  }
}

// 1A. Test RasterPixelIsPoint (Copernicus DEM style: tiepoint is pixel center)
const samplerPoint = new GeoRasterSampler({
  data: mockData,
  width: 10,
  height: 10,
  west: 128.0,
  north: 39.0,
  pixelWidth: 0.1,
  pixelHeight: 0.1,
  pixelType: RASTER_PIXEL_TYPE.PIXEL_IS_POINT
});

// At exactly (39.0°N, 128.0°E), it is the center of pixel (0, 0)
const pPoint = samplerPoint.coordToPixel(39.0, 128.0);
assert(
  Math.abs(pPoint.px - 0.0) < 1e-6 && Math.abs(pPoint.py - 0.0) < 1e-6,
  `RasterPixelIsPoint: Tiepoint (39°N, 128°E) maps exactly to pixel center (0, 0)`
);

const sampleValPoint = samplerPoint.sampleElevation(39.0, 128.0);
assert(
  sampleValPoint.elevation === 0.0 && sampleValPoint.validity === 'VALID',
  `RasterPixelIsPoint: Sampled elevation at tiepoint is ${sampleValPoint.elevation} (expected 0.0)`
);

// 1B. Test RasterPixelIsArea (ETOPO style: tiepoint is outer corner, center is at (0.5, 0.5))
const samplerArea = new GeoRasterSampler({
  data: mockData,
  width: 10,
  height: 10,
  west: 128.0,
  north: 39.0,
  pixelWidth: 0.1,
  pixelHeight: 0.1,
  pixelType: RASTER_PIXEL_TYPE.PIXEL_IS_AREA
});

// At the outer corner (39.0°N, 128.0°E), px and py should be -0.5 relative to pixel center
const pArea = samplerArea.coordToPixel(39.0, 128.0);
assert(
  Math.abs(pArea.px - (-0.5)) < 1e-6 && Math.abs(pArea.py - (-0.5)) < 1e-6,
  `RasterPixelIsArea: Tiepoint (39°N, 128°E) reflects half-pixel offset (px=-0.5, py=-0.5)`
);

// At half a pixel inside (38.95°N, 128.05°E), it reaches the center of pixel (0, 0)
const pAreaCenter = samplerArea.coordToPixel(38.95, 128.05);
assert(
  Math.abs(pAreaCenter.px - 0.0) < 1e-6 && Math.abs(pAreaCenter.py - 0.0) < 1e-6,
  `RasterPixelIsArea: (38.95°N, 128.05°E) correctly maps to pixel (0, 0) center`
);

// ----------------------------------------------------------------------------
// 2. Multi-Criteria Land / Ocean / Coastal Classification
// ----------------------------------------------------------------------------
console.log('\n--- Test Group 2: Multi-Criteria Land / Ocean / Coastal Classification ---');

// Case A: High inland mountain (Daecheongbong)
const classA = classifySurface(1708.0, 1500.0, 25.0);
assert(classA === SURFACE_CLASSIFICATION.LAND, `H=1708m -> Classified as LAND (got ${classA})`);

// Case B: Deep open sea (East Sea bathymetry)
const classB = classifySurface(-1200.0, -1200.0, 2.0);
assert(classB === SURFACE_CLASSIFICATION.OCEAN, `H=-1200m -> Classified as OCEAN (got ${classB})`);

// Case C: Radar DSM flattened ocean (Copernicus 0.0f over deep ETOPO marine shelf)
const classC = classifySurface(0.0, -150.0, 0.0);
assert(
  classC === SURFACE_CLASSIFICATION.OCEAN,
  `Copernicus 0.0f with deep ETOPO (-150m) and zero gradient -> Classified as OCEAN (not land!)`
);

// Case D: Intertidal beach / tidal flat (H=0.5m near coast, ETOPO=-1.0m)
const classD = classifySurface(0.5, -1.0, 0.1);
assert(
  classD === SURFACE_CLASSIFICATION.COASTAL_UNCERTAIN,
  `H=0.5m near coast -> Classified as COASTAL_UNCERTAIN (requires tidal wetness transition)`
);

// Case E: Terrestrial plain (H=45m, ETOPO=40m)
const classE = classifySurface(45.0, 40.0, 1.5);
assert(classE === SURFACE_CLASSIFICATION.LAND, `H=45m inland -> Classified as LAND`);

// ----------------------------------------------------------------------------
// 3. Double-Buffering & Atomic Swap Architecture Simulation
// ----------------------------------------------------------------------------
console.log('\n--- Test Group 3: Double-Buffering & Atomic Swap Protocol ---');

// Mock Three.js scene structure
// Mock Three.js structure for full lifecycle testing
if (!globalThis.THREE) {
  globalThis.THREE = {
    Group: class {
      constructor() { this.children = []; this.isGroup = true; }
      add(c) { this.children.push(c); }
      traverse(fn) {
        fn(this);
        this.children.forEach(c => {
          if (c && typeof c.traverse === 'function') c.traverse(fn);
          else fn(c);
        });
      }
    },
    Mesh: class {
      constructor(g, m) { this.geometry = g; this.material = m; this.isMesh = true; }
    },
    BufferGeometry: class {
      constructor() { this.attributes = {}; }
      setAttribute(n, a) { this.attributes[n] = a; }
      setIndex(i) { this.indices = i; }
      computeVertexNormals() {}
      dispose() {}
    },
    BufferAttribute: class {
      constructor(arr, itemSize) { this.array = arr; this.itemSize = itemSize; this.count = arr.length / itemSize; }
    },
    Float32BufferAttribute: class {
      constructor(arr, itemSize) { this.array = arr; this.itemSize = itemSize; this.count = arr.length / itemSize; }
    },
    ShaderMaterial: class {
      constructor(p) { Object.assign(this, p); }
      dispose() {}
    },
    Vector3: class {
      constructor(x, y, z) { this.x = x; this.y = y; this.z = z; }
      normalize() { return this; }
    },
    Color: class {
      constructor(c) { this.c = c; }
    }
  };
}

class MockScene {
  constructor() {
    this.children = [];
  }
  add(obj) {
    this.children.push(obj);
  }
  remove(obj) {
    const idx = this.children.indexOf(obj);
    if (idx !== -1) this.children.splice(idx, 1);
  }
}

const mockScene = new MockScene();
const manager = new TerrainLifecycleManager(mockScene);

// Initial state
assert(manager.activeGroup === null, 'Initial activeGroup is null');
assert(!manager.isTransitioning, 'Initial isTransitioning is false');

// Execute atomic swap directly to test zero-blank-frame guarantee
const groupA = { name: 'MeshGroup_Yangyang', isMesh: true, geometry: { dispose: () => {} }, material: { dispose: () => {} } };
const groupB = { name: 'MeshGroup_Gyeongju', isMesh: true, geometry: { dispose: () => {} }, material: { dispose: () => {} } };

manager._executeAtomicSwap(groupA);
assert(
  manager.activeGroup === groupA && mockScene.children.includes(groupA),
  'First swap: Group A is immediately active in Scene'
);

manager._executeAtomicSwap(groupB);
assert(
  manager.activeGroup === groupB &&
  mockScene.children.includes(groupB) &&
  !mockScene.children.includes(groupA),
  'Second swap: Atomic replacement occurs synchronously (Group A removed, Group B added, 0 blank frame)'
);

// ----------------------------------------------------------------------------
// 4. Asynchronous Switch with Delay Injection & Active Scene Continuity
// ----------------------------------------------------------------------------
console.log('\n--- Test Group 4: Asynchronous Switch & Delay Injection ---');

const eventYangyang = { id: 'hist_1681_0626', lat: 37.95, lon: 129.05, name: '1681 Yangyang' };
const eventGyeongju = { id: 'hist_2016_gyeongju', lat: 35.76, lon: 129.19, name: '2016 Gyeongju' };

// Mock fetch for binary in Deno
globalThis.fetch = async (url) => {
  if (url.includes('.bin')) {
    const data = await Deno.readFile(url);
    return {
      ok: true,
      arrayBuffer: async () => data.buffer
    };
  }
  return { ok: false };
};

// Test switch with 60ms simulated delay
const activeBeforeDelay = manager.activeGroup;
const switchPromise = manager.switchEpicenter(eventYangyang, { simulatedDelayMs: 60 });
assert(manager.isTransitioning === true, 'Transition flag is true during asynchronous load');
assert(manager.activeGroup === activeBeforeDelay, 'activeGroup remains actively rendered during simulated network/build delay');

const switchResult = await switchPromise;
assert(switchResult.success === true, 'Asynchronous switch completed successfully after delay');
assert(manager.isTransitioning === false, 'Transition flag reset to false upon completion');
assert(manager.activeGroup !== activeBeforeDelay, 'New terrain group atomically swapped in');
assert(switchResult.tier2Active === true, 'Tier 2 Copernicus Inset is active for 1681 Yangyang');

// ----------------------------------------------------------------------------
// 5. Failure Injection & Resilience Recovery
// ----------------------------------------------------------------------------
console.log('\n--- Test Group 5: Failure Injection & Recovery ---');

const activeBeforeFail = manager.activeGroup;
const failResult = await manager.switchEpicenter(eventGyeongju, { failStaging: true });

assert(failResult.success === false, 'Injected failure correctly returned success: false');
assert(failResult.error.includes('Simulated Staging Failure'), `Error caught gracefully: "${failResult.error}"`);
assert(manager.activeGroup === activeBeforeFail, 'activeGroup remains 100% intact after failed switch (zero black screen)');
assert(manager.isTransitioning === false, 'isTransitioning cleanly reset after failure');

// ----------------------------------------------------------------------------
// 6. Race Condition & Superseded Request Rejection
// ----------------------------------------------------------------------------
console.log('\n--- Test Group 6: Race Condition Guard & Request Sequencing ---');

// Rapid consecutive calls: Call 1 has 80ms delay, Call 2 has 20ms delay
const req1 = manager.switchEpicenter(eventGyeongju, { simulatedDelayMs: 80 });
const req2 = manager.switchEpicenter(eventYangyang, { simulatedDelayMs: 20 });

const [res1, res2] = await Promise.all([req1, req2]);

assert(res1.superseded === true && res1.success === false, 'Superseded request 1 was cleanly aborted without applying to scene');
assert(res2.success === true, 'Latest request 2 completed successfully and won the atomic swap');
assert(manager.currentEpicenter.id === 'hist_1681_0626', 'Scene state corresponds to the latest winning epicenter (1681 Yangyang)');

// ----------------------------------------------------------------------------
// 7. Copernicus Inset Binary File & Real Elevation Range Verification
// ----------------------------------------------------------------------------
console.log('\n--- Test Group 7: Copernicus Inset Real Binary File Verification ---');

const lods = [
  { res: 256, path: 'assets/terrain/copernicus/tier2_yangyang_256.bin', expectedBytes: 256 * 256 * 4 },
  { res: 512, path: 'assets/terrain/copernicus/tier2_yangyang_512.bin', expectedBytes: 512 * 512 * 4 },
  { res: 768, path: 'assets/terrain/copernicus/tier2_yangyang_768.bin', expectedBytes: 768 * 768 * 4 }
];

for (const lod of lods) {
  const bytes = await Deno.readFile(lod.path);
  assert(bytes.length === lod.expectedBytes, `${lod.res}x${lod.res} file size matches exactly: ${bytes.length} bytes`);
  const floats = new Float32Array(bytes.buffer);
  let minH = Infinity, maxH = -Infinity;
  for (let i = 0; i < floats.length; i++) {
    const val = floats[i];
    if (val < minH) minH = val;
    if (val > maxH) maxH = val;
  }
  assert(maxH >= 1680.0 && maxH <= 1750.0, `${lod.res}x${lod.res} correctly preserves Seoraksan ridge peak 1680~1750m conforming to 1708m MSL datum (got ${maxH.toFixed(2)}m)`);
  assert(minH >= -5.0 && minH <= 2.0, `${lod.res}x${lod.res} coastal/ocean floor within valid range (got ${minH.toFixed(2)}m)`);
}

// ----------------------------------------------------------------------------
// 8. Phase B: Universal Earthquake Adaptation Regional Metadata & Binaries
// ----------------------------------------------------------------------------
console.log('\n--- Test Group 8: Universal Event Metadata & Regional DEM Binaries ---');

import { UNIVERSAL_EVENT_METADATA, getUniversalEventMetadata } from '../js/3d/terrainDataResolver.js';

const benchmarkEvents = [
  'hist_1681_0626',
  'hist_2016_gyeongju',
  'hist_2017_pohang',
  'global_2016_kumamoto',
  'global_2023_turkey'
];

for (const evId of benchmarkEvents) {
  const meta = getUniversalEventMetadata(evId);
  assert(meta.eventId === evId, `Event metadata resolved for ${evId}`);
  assert(typeof meta.geographicType === 'string' && meta.geographicType.length > 0, `${evId} has valid geographicType: ${meta.geographicType}`);
  assert(typeof meta.demBinUrl === 'string', `${evId} has demBinUrl: ${meta.demBinUrl}`);

  // Check file on disk
  const binBytes = await Deno.readFile(meta.demBinUrl);
  const expectedBytes = meta.width * meta.height * 2; // UNORM16
  assert(binBytes.length === expectedBytes, `${evId} DEM binary size is exactly ${binBytes.length} bytes (${meta.width}x${meta.height})`);

  // Verify elevation ranges
  const u16 = new Uint16Array(binBytes.buffer);
  let minNorm = 1.0, maxNorm = 0.0;
  for (let i = 0; i < u16.length; i++) {
    const n = u16[i] / 65535.0;
    if (n < minNorm) minNorm = n;
    if (n > maxNorm) maxNorm = n;
  }
  const minElev = meta.hMin + minNorm * (meta.hMax - meta.hMin);
  const maxElev = meta.hMin + maxNorm * (meta.hMax - meta.hMin);

  assert(minElev <= 300.0, `${evId} min elevation physically grounded (got ${minElev.toFixed(1)}m)`);
  assert(maxElev >= 1000.0, `${evId} max elevation captures regional mountain relief (got ${maxElev.toFixed(1)}m)`);
}

// Check specific geographic characteristics
const turkeyMeta = getUniversalEventMetadata('global_2023_turkey');
assert(turkeyMeta.hasOcean === false, 'Turkey event correctly flagged as 100% land (hasOcean: false, zero fake sea)');

const kumamotoMeta = getUniversalEventMetadata('global_2016_kumamoto');
assert(kumamotoMeta.geographicType === 'INLAND_VOLCANIC_RIFT', 'Kumamoto correctly classified as INLAND_VOLCANIC_RIFT');

const yangyangMeta = getUniversalEventMetadata('hist_1681_0626');
assert(yangyangMeta.tier2Available === true, '1681 Yangyang preserves Tier 2 high-res inset availability');

// ----------------------------------------------------------------------------
// Summary
// ----------------------------------------------------------------------------
console.log('\n====================================================================');
console.log(`UNIT TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
console.log('====================================================================\n');

if (failed > 0) {
  Deno.exit(1);
}
