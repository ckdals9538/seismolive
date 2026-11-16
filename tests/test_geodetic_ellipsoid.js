// ============================================================================
// SEISMOLIVE v4.0 — Geodetic Ellipsoid Coordinate Unit Test Suite
// File: tests/test_geodetic_ellipsoid.js
// Run via: deno run -A tests/test_geodetic_ellipsoid.js
// ============================================================================

import {
  WGS84,
  DATUM_STATUS,
  geodeticToECEF,
  ecefToGeodetic,
  computeLocalENURotationMatrix,
  geodeticToCenterRelativeENU,
  centerRelativeENUToThree,
  geodeticToThree,
  computeGlobeCenterAndPolarAxis,
  computeEllipsoidalHeight
} from '../js/3d/geodeticEllipsoidCoord.js';

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
console.log('SEISMOLIVE v4.0 — WGS84 Geodetic & Ellipsoid Unit Test Suite');
console.log('====================================================================\n');

// ----------------------------------------------------------------------------
// 1. ECEF <-> Geodetic Roundtrip Conversion Across Worldwide Test Coordinates
// ----------------------------------------------------------------------------
console.log('--- Test Group 1: ECEF <-> Geodetic Roundtrip Conversion ---');

const testCases = [
  { name: 'Equator (0°N, 0°E, 0m)', lat: 0.0, lon: 0.0, h: 0.0 },
  { name: 'Equator High Altitude (0°N, 100°E, 5000m)', lat: 0.0, lon: 100.0, h: 5000.0 },
  { name: 'Yangyang 1681 Epicenter (37.90°N, 129.10°E, -1200m depth)', lat: 37.90, lon: 129.10, h: -1200.0 },
  { name: 'Gyeongju 2016 Epicenter (35.76°N, 129.19°E, 150m)', lat: 35.76, lon: 129.19, h: 150.0 },
  { name: 'Seoraksan Summit (38.12°N, 128.46°E, 1708m)', lat: 38.12, lon: 128.46, h: 1708.0 },
  { name: 'Tohoku 2011 Epicenter (38.30°N, 142.37°E, -3000m depth)', lat: 38.30, lon: 142.37, h: -3000.0 },
  { name: 'North Pole (90°N, 0°E, 100m)', lat: 90.0, lon: 0.0, h: 100.0 },
  { name: 'South Pole (-90°N, 0°E, 2800m Antarctica)', lat: -90.0, lon: 0.0, h: 2800.0 }
];

testCases.forEach(tc => {
  const [X, Y, Z] = geodeticToECEF(tc.lat, tc.lon, tc.h);
  const back = ecefToGeodetic(X, Y, Z);

  const latErr = Math.abs(back.latDeg - tc.lat);
  const lonErr = Math.abs(back.lonDeg - tc.lon);
  const hErr = Math.abs(back.h - tc.h);

  // Bowring's algorithm gives < 1e-9 degrees and < 1e-4 meters error in Float64
  const ok = latErr < 1e-8 && lonErr < 1e-8 && hErr < 1e-3;
  assert(ok, `Roundtrip: ${tc.name}`, `latErr=${latErr.toExponential(3)}, lonErr=${lonErr.toExponential(3)}, hErr=${hErr.toExponential(3)}m`);
});

// ----------------------------------------------------------------------------
// 2. Numerical Precision Breakdown: Float64 Math vs Float32 GPU Units
// ----------------------------------------------------------------------------
console.log('\n--- Test Group 2: Numerical Precision (Float64 Math vs Float32 GPU) ---');

const yangyangEpi = { lat: 37.90, lon: 129.10, h: 0.0 };
const seorakSummit = { lat: 38.12, lon: 128.46, h: 1708.0 };

const [e64, n64, u64] = geodeticToCenterRelativeENU(
  seorakSummit.lat, seorakSummit.lon, seorakSummit.h,
  yangyangEpi.lat, yangyangEpi.lon, yangyangEpi.h
);
const three64 = centerRelativeENUToThree(e64, n64, u64);

// Convert to Float32 array (as WebGL GPU would see it)
const three32 = new Float32Array(three64);
const float32DiscrepancyX = Math.abs(three64[0] - three32[0]) * WGS84.METERS_PER_UNIT;
const float32DiscrepancyY = Math.abs(three64[1] - three32[1]) * WGS84.METERS_PER_UNIT;
const float32DiscrepancyZ = Math.abs(three64[2] - three32[2]) * WGS84.METERS_PER_UNIT;

console.log(`  Float64 Three.js Position: [${three64.map(v => v.toFixed(6)).join(', ')}]`);
console.log(`  Float32 Three.js Position: [${Array.from(three32).map(v => v.toFixed(6)).join(', ')}]`);
console.log(`  GPU Float32 Spatial Quantization Error: X=${float32DiscrepancyX.toFixed(4)}m, Y=${float32DiscrepancyY.toFixed(4)}m, Z=${float32DiscrepancyZ.toFixed(4)}m`);

assert(
  float32DiscrepancyX < 0.05 && float32DiscrepancyY < 0.05 && float32DiscrepancyZ < 0.05,
  'Center-Relative coordinate origin eliminates precision loss: GPU Float32 error is < 0.05m across 60km regional distance'
);

// ----------------------------------------------------------------------------
// 3. Epicenter Tangent Zero-Offset & Polar Axis Geometry
// ----------------------------------------------------------------------------
console.log('\n--- Test Group 3: Epicenter Origin & Tier 0 Spheroid Alignment ---');

const originThree = geodeticToThree(yangyangEpi.lat, yangyangEpi.lon, 0.0, yangyangEpi.lat, yangyangEpi.lon, 0.0);
assert(
  Math.hypot(...originThree) === 0.0,
  `Epicenter surface (h=0) strictly maps to [0, 0, 0] in Three.js (got [${originThree.join(', ')}])`
);

const globeData = computeGlobeCenterAndPolarAxis(yangyangEpi.lat, yangyangEpi.lon);
const polarLen = Math.hypot(...globeData.polarAxisThree);
assert(Math.abs(polarLen - 1.0) < 1e-12, `Polar axis vector is normalized unit vector: length=${polarLen}`);

// Check polar axis orientation at latitude 37.9°:
// In Three.js: East -> +X, Up -> +Y, North -> -Z
// polarAxisThree = [0, sin(phi), -cos(phi)]
const expectedSinPhi = Math.sin((yangyangEpi.lat * Math.PI) / 180.0);
const expectedCosPhi = Math.cos((yangyangEpi.lat * Math.PI) / 180.0);
assert(
  Math.abs(globeData.polarAxisThree[1] - expectedSinPhi) < 1e-12 &&
  Math.abs(globeData.polarAxisThree[2] - (-expectedCosPhi)) < 1e-12,
  `Polar axis tilts correctly with latitude: Y(Up)=${globeData.polarAxisThree[1].toFixed(4)}, Z(North)=${globeData.polarAxisThree[2].toFixed(4)}`
);

// Verify Earth center depth in Three.js
// At Yangyang (37.9°N), geocentric radius is ~6,370.07 km = 63.7007 units
const centerDistUnits = Math.hypot(...globeData.centerThree);
assert(
  Math.abs(centerDistUnits - 63.70) < 0.1,
  `Earth center distance from surface origin is ${centerDistUnits.toFixed(4)} units (expected ~63.70 units = 6,370 km)`
);

// ----------------------------------------------------------------------------
// 4. Geoid Height & Datum Status Tracking
// ----------------------------------------------------------------------------
console.log('\n--- Test Group 4: Geoid Height Transformation & Status Management ---');

const verifiedDatum = computeEllipsoidalHeight(1708.0, 17.60, true);
assert(
  verifiedDatum.status === DATUM_STATUS.VERIFIED && verifiedDatum.h === 1725.60,
  `Verified datum correctly evaluates h = H + N (1708m + 17.6m = 1725.6m)`
);

const incompleteDatum = computeEllipsoidalHeight(1708.0, null, false);
assert(
  incompleteDatum.status === DATUM_STATUS.INCOMPLETE && incompleteDatum.h === 1708.0 && !!incompleteDatum.warning,
  `Missing geoid data flags GEODETIC_DATUM_INCOMPLETE and attaches warning without faking N`
);

// ----------------------------------------------------------------------------
// Summary
// ----------------------------------------------------------------------------
console.log('\n====================================================================');
console.log(`UNIT TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
console.log('====================================================================\n');

if (failed > 0) {
  Deno.exit(1);
}
