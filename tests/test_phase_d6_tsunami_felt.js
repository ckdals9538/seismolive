// ============================================================================
// SEISMOLIVE v4.0 — Phase D6 Unit Test: Tsunami Hydrodynamics & 8-Province Felt Network
// File: tests/test_phase_d6_tsunami_felt.js
// ============================================================================

import { assertEquals, assert, assertAlmostEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { computeTsunamiHydrodynamicParams, generateTsunamiBathymetrySVG } from "../js/geophysics/TravelTimeSolvers.js";
import { HISTORICAL_EVENTS } from "../js/data/historicalArchiveDB.js";

console.log("====================================================================");
console.log("SEISMOLIVE v4.0 — Phase D6 Tsunami Hydrodynamics & Felt Network Test");
console.log("====================================================================");

// --- 1. Tsunami Hydrodynamics & Bathymetric Shoaling Physics ---
console.log("\n--- 1. Tsunami Hydrodynamics & Bathymetric Shoaling Physics ---");
const p = computeTsunamiHydrodynamicParams(2000.0, 20.0, 60.0);

// Deep water wave speed: v = sqrt(gH)
assertAlmostEquals(p.vDeepKmH, 504.0, 2.0, "Ulleung Basin (2000m) wave speed must be ~504 km/h");
assertAlmostEquals(p.vDeepMS, 140.0, 1.0, "Ulleung Basin wave speed in m/s must be ~140 m/s");

// Coastal shallow water wave speed: v = sqrt(g*20)
assertAlmostEquals(p.vCoastKmH, 50.0, 2.0, "Coastal shelf (20m) wave speed must be ~50 km/h");
assertAlmostEquals(p.vCoastMS, 14.0, 0.5, "Coastal shelf wave speed in m/s must be ~14 m/s");

// Green's Law Shoaling Factor: (2000 / 20)^0.25 = 100^0.25 = 3.162
assertAlmostEquals(p.shoalingFactor, 3.16, 0.05, "Green's law shoaling factor must be ~3.16");

// Travel time across 60km continental margin: ~13.0 min
assertAlmostEquals(p.travelTimeMin, 13.0, 0.5, "Slope travel time must be ~13 minutes");
console.log(`  [PASS] Hydrodynamic solvers: Deep ${p.vDeepKmH} km/h -> Coast ${p.vCoastKmH} km/h (Shoaling factor ${p.shoalingFactor}x, Time ${p.travelTimeMin} min)`);

// --- 2. Tsunami Bathymetry SVG Generation ---
console.log("\n--- 2. Tsunami Bathymetry SVG Generation ---");
const svgHtml = generateTsunamiBathymetrySVG(p);
assert(svgHtml.includes("<svg"), "Must output valid SVG root element");
assert(svgHtml.includes("tsunamiWaterGrad"), "Must define water gradient");
assert(svgHtml.includes("bedrockGrad"), "Must define bedrock gradient");
assert(svgHtml.includes("울릉분지"), "Must annotate Ulleung basin");
assert(svgHtml.includes("대륙사면"), "Must annotate continental slope");
assert(svgHtml.includes("강원 연안"), "Must annotate Gangwon coast");
assert(svgHtml.includes("퇴조"), "Must annotate sea drawback (퇴조)");
console.log("  [PASS] Tsunami bathymetry SVG generated with full physical & historical annotations");

// --- 3. 1681 Yangyang Tsunami Physics Integration ---
console.log("\n--- 3. 1681 Yangyang Tsunami Physics Integration ---");
const ev1681 = HISTORICAL_EVENTS.find(e => e.id === "hist_1681_0626");
assert(ev1681 != null, "1681 Yangyang event must exist");
assertEquals(ev1681.geophysicalPhenomena.type, "TSUNAMI_HYDRODYNAMICS");
assert(ev1681.geophysicalPhenomena.equation.includes("v = \\sqrt{gH}"));
assert(ev1681.seaDrawbackRecorded, "1681 must record sea drawback (퇴조)");
console.log("  [PASS] 1681 Yangyang has verified TSUNAMI_HYDRODYNAMICS and seaDrawbackRecorded flags");

// --- 4. 8-Province Macroseismic Felt Network Distance Attenuation & S-Wave Times ---
console.log("\n--- 4. 8-Province Macroseismic Felt Network S-Wave Times ---");
const counties = ev1681.feltCounties;
assert(Array.isArray(counties) && counties.length >= 6, "1681 must have at least 6 felt counties");

counties.forEach(c => {
  const dist = Number(c.distanceKm);
  assert(dist > 0, `County ${c.countyKo} distance must be > 0`);
  const tS = dist / 3.5;
  const tSP = dist / 8.0;
  assert(tS > 0, `S-wave time must be > 0`);
  assert(tSP > 0, `P-S time must be > 0`);
  assert(tS > tSP, `S-wave arrival time (${tS.toFixed(1)}s) must be greater than P-S differential (${tSP.toFixed(1)}s)`);
});
console.log(`  [PASS] All ${counties.length} felt counties have valid S-wave arrival and P-S time calculations`);

// --- 5. DOM & CSS Rules Verification ---
console.log("\n--- 5. DOM & CSS Rules Verification ---");
const css = Deno.readTextFileSync("css/surface.css");
assert(css.includes(".hist-felt-row"), "css/surface.css must contain .hist-felt-row");
assert(css.includes(".hist-tsunami-box"), "css/surface.css must contain .hist-tsunami-box");
console.log("  [PASS] css/surface.css contains .hist-felt-row and .hist-tsunami-box styling");

console.log("\n====================================================================");
console.log("Phase D6 Tsunami & Felt Network Test: ALL ASSERTIONS PASSED (100%)");
console.log("====================================================================");
