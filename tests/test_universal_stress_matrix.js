// ============================================================================
// SEISMOLIVE v4.0 — Phase B Universal Adaptation Stress Test Matrix
// File: tests/test_universal_stress_matrix.js
// Run via: deno run -A tests/test_universal_stress_matrix.js
// ============================================================================

import { resolveArbitraryCoordinate, getUniversalEventMetadata } from '../js/3d/terrainDataResolver.js';

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
console.log('SEISMOLIVE v4.0 — Phase B Universal Adaptation Stress Test Matrix');
console.log('====================================================================');

// ----------------------------------------------------------------------------
// Test 1: Region with NO Tier 2 (Paris Basin, Inland Plains)
// ----------------------------------------------------------------------------
console.log('\n--- Stress Case 1: Region with NO Tier 2 Inset (Paris Basin, 48.85°N, 2.35°E) ---');
const case1 = resolveArbitraryCoordinate(48.85, 2.35);
assert(case1.success === true, 'Arbitrary coordinate resolved successfully');
assert(case1.dataDeterminants.tier2Status === 'UNHELD_FALLBACK_TIER1', `Tier 2 cleanly unheld: ${case1.dataDeterminants.tier2Status}`);
assert(case1.dataDeterminants.surfaceClass === 'INLAND_BASIN_PLAIN', `Surface classified: ${case1.dataDeterminants.surfaceClass}`);
assert(case1.dataDeterminants.hasOcean === false, 'Land interior hasOcean is false');
assert(case1.editorialProfile === 'PROFILE_INLAND_PLAINS', `Editorial framing assigned: ${case1.editorialProfile}`);
assert(case1.geologicalStructure.verificationStatus === 'PENDING_PHASE_C_SPECIALIZED_DATA', 'Geological data strictly marked pending (no fake fault)');

// ----------------------------------------------------------------------------
// Test 2: Incomplete Regional Tier 1 DEM Coverage (Remote South Pacific Pitcairn)
// ----------------------------------------------------------------------------
console.log('\n--- Stress Case 2: Incomplete Tier 1 Coverage (Remote South Pacific, -25.07°S, -130.10°W) ---');
const case2 = resolveArbitraryCoordinate(-25.07, -130.10);
assert(case2.success === true, 'Remote ocean coordinate resolved successfully');
assert(case2.dataDeterminants.tier1Status === 'FALLBACK_GLOBAL_TIER0', `Fallback to Tier 0 triggered: ${case2.dataDeterminants.tier1Status}`);
assert(case2.fallbackState === 'GRACEFUL_TIER0_FALLBACK', `Fallback state clean (zero black screen): ${case2.fallbackState}`);
assert(case2.dataDeterminants.hasOcean === true, 'Open ocean surface detected');

// ----------------------------------------------------------------------------
// Test 3: Complex Coastline (Shinan / Jindo Archipelago, 34.40°N, 126.10°E)
// ----------------------------------------------------------------------------
console.log('\n--- Stress Case 3: Complex Coastline (Shinan Archipelago, 34.40°N, 126.10°E) ---');
const case3 = resolveArbitraryCoordinate(34.40, 126.10);
assert(case3.success === true, 'Archipelago coordinate resolved successfully');
assert(case3.dataDeterminants.surfaceClass === 'COASTAL_ARCHIPELAGO', `Complex coast classified: ${case3.dataDeterminants.surfaceClass}`);
assert(case3.dataDeterminants.hasOcean === true, 'Water surface enabled for island shallows');
assert(case3.editorialProfile === 'PROFILE_COASTAL_ARCHIPELAGO', `Archipelago framing applied: ${case3.editorialProfile}`);

// ----------------------------------------------------------------------------
// Test 4: Extreme High-Altitude Alpine Relief (Mt. Everest, 27.988°N, 86.925°E)
// ----------------------------------------------------------------------------
console.log('\n--- Stress Case 4: Extreme High Alpine Relief (Mt. Everest, 27.988°N, 86.925°E) ---');
const case4 = resolveArbitraryCoordinate(27.988, 86.925);
assert(case4.success === true, 'Extreme alpine coordinate resolved successfully');
assert(case4.dataDeterminants.approxElevM > 8000.0, `Extreme elevation handled (>8000m): ${case4.dataDeterminants.approxElevM}m`);
assert(case4.dataDeterminants.hasOcean === false, 'Extreme alpine interior has no water mesh');
assert(case4.editorialProfile === 'PROFILE_EXTREME_ALPINE', `Extreme alpine framing applied: ${case4.editorialProfile}`);

// ----------------------------------------------------------------------------
// Test 5: Ultra-Deep Pelagic Trench Epicenter (Mariana Trench, 11.35°N, 142.20°E)
// ----------------------------------------------------------------------------
console.log('\n--- Stress Case 5: Ultra-Deep Trench Epicenter (Challenger Deep, 11.35°N, 142.20°E) ---');
const case5 = resolveArbitraryCoordinate(11.35, 142.20);
assert(case5.success === true, 'Deep ocean trench resolved successfully');
assert(case5.dataDeterminants.surfaceClass === 'OCEAN_TRENCH', `Deep ocean trench classified: ${case5.dataDeterminants.surfaceClass}`);
assert(case5.dataDeterminants.approxElevM < -10000.0, `Trench depth properly recognized (<-10000m): ${case5.dataDeterminants.approxElevM}m`);
assert(case5.dataDeterminants.hasOcean === true, 'Water surface fully active over trench');

// ----------------------------------------------------------------------------
// Test 6: Incomplete Vertical Geodetic Datum (High Arctic Ocean, 85.0°N, 0.0°E)
// ----------------------------------------------------------------------------
console.log('\n--- Stress Case 6: Incomplete Vertical Geodetic Datum (High Arctic, 85.0°N, 0.0°E) ---');
const case6 = resolveArbitraryCoordinate(85.0, 0.0);
assert(case6.success === true, 'Polar coordinate resolved successfully');
assert(case6.dataDeterminants.datumStatus === 'GEODETIC_DATUM_INCOMPLETE', `Datum deficiency flagged without faking N: ${case6.dataDeterminants.datumStatus}`);
assert(case6.dataDeterminants.surfaceClass === 'POLAR_ICE_OR_BASIN', `Polar zone classified: ${case6.dataDeterminants.surfaceClass}`);

// ----------------------------------------------------------------------------
// Test 7: Out-of-Bounds & Malformed Coordinates Guard
// ----------------------------------------------------------------------------
console.log('\n--- Stress Case 7: Invalid Coordinates Guard ---');
const invalid1 = resolveArbitraryCoordinate(95.0, 120.0);
assert(invalid1.success === false, 'Out-of-bounds latitude (95°N) cleanly rejected');
assert(invalid1.fallbackState === 'REJECTED_INVALID_COORDINATES', 'Clean error fallback state returned');

const invalid2 = resolveArbitraryCoordinate(NaN, 120.0);
assert(invalid2.success === false, 'NaN coordinate cleanly rejected');

// ----------------------------------------------------------------------------
// Test 8: Strict A / B / C Data Separation Integrity
// ----------------------------------------------------------------------------
console.log('\n--- Stress Case 8: Strict Data Layer Separation Integrity ---');
const meta1681 = getUniversalEventMetadata('hist_1681_0626');
assert(meta1681.magnitude === null, '1681 Yangyang historical magnitude is strictly null (unverified)');
assert(meta1681.tsunamiDefinite === false, '1681 Yangyang sea drawback is NOT claimed as definite tsunami');
assert(typeof meta1681.editorialProfile === 'string', 'Editorial visualization profile exists as separate aesthetic layer');
assert(typeof meta1681.hasOcean === 'boolean', 'Physical ocean/land exists as data determinant layer');

console.log('\n====================================================================');
console.log(`PHASE B UNIVERSAL STRESS TEST MATRIX: ${passed} PASSED, ${failed} FAILED`);
console.log('====================================================================\n');

if (failed > 0) {
  Deno.exit(1);
}
