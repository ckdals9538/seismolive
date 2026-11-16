// ============================================================================
// SEISMOLIVE v4.0 — Phase D5 Unit Test: Historical Error Ellipse & Isoseismal Field
// File: tests/test_phase_d5_error_ellipse.js
// ============================================================================

import { assertEquals, assert, assertNotEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { HISTORICAL_EVENTS } from "../js/data/historicalArchiveDB.js";
import { SeismicSourceModel, RadiationPatternStatus } from "../js/3d/seismicSourceModel.js";

console.log("====================================================================");
console.log("SEISMOLIVE v4.0 — Phase D5 Error Ellipse & Isoseismals Unit Test");
console.log("====================================================================");

// --- 1. Schema Completeness for All 34 Historical Events ---
console.log("\n--- 1. Schema Completeness for All 34 Historical Events ---");
assertEquals(HISTORICAL_EVENTS.length, 34, "Total historical events count must be 34");

HISTORICAL_EVENTS.forEach((ev) => {
  const prefix = `[${ev.id}]`;

  // Error Ellipse assertions
  assert(ev.errorEllipse, `${prefix} Must have errorEllipse object`);
  assert(typeof ev.errorEllipse.centerLat === "number", `${prefix} centerLat must be number`);
  assert(typeof ev.errorEllipse.centerLon === "number", `${prefix} centerLon must be number`);
  assert(ev.errorEllipse.semiMajorKm > 0, `${prefix} semiMajorKm must be > 0 (got ${ev.errorEllipse.semiMajorKm})`);
  assert(ev.errorEllipse.semiMinorKm > 0, `${prefix} semiMinorKm must be > 0 (got ${ev.errorEllipse.semiMinorKm})`);
  assert(ev.errorEllipse.semiMajorKm >= ev.errorEllipse.semiMinorKm, `${prefix} semiMajorKm must be >= semiMinorKm`);
  assertEquals(ev.errorEllipse.confidenceLevel, 0.95, `${prefix} confidenceLevel must be 0.95 (95%)`);
  assertEquals(ev.errorEllipse.chiSquareCritical, 5.991, `${prefix} chiSquareCritical must be 5.991`);
  assertEquals(ev.errorEllipse.degreesOfFreedom, 2, `${prefix} degreesOfFreedom must be 2`);
  assert(ev.errorEllipse.formula.includes("\\chi^2"), `${prefix} formula must include LaTeX chi^2`);
  assertEquals(ev.errorEllipse.epistemicStatus, "HISTORICAL_MACROSEISMIC_COVARIANCE_INFERRED");

  // Isoseismal Contours assertions
  assert(Array.isArray(ev.isoseismalContours), `${prefix} isoseismalContours must be array`);
  assert(ev.isoseismalContours.length >= 3, `${prefix} Must have at least 3 isoseismal contour rings`);
  ev.isoseismalContours.forEach((iso, idx) => {
    assert(iso.mmi, `${prefix} Contour ${idx} must have MMI string`);
    assert(iso.semiMajorKm > 0, `${prefix} Contour ${idx} semiMajorKm must be > 0`);
    assert(iso.semiMinorKm > 0, `${prefix} Contour ${idx} semiMinorKm must be > 0`);
    assert(iso.label, `${prefix} Contour ${idx} must have descriptive label`);
    assert(iso.attenuationEquation, `${prefix} Contour ${idx} must have empirical equation`);
  });

  console.log(`  [PASS] ${prefix} Error Ellipse (a=${ev.errorEllipse.semiMajorKm}km, b=${ev.errorEllipse.semiMinorKm}km, θ=${ev.errorEllipse.azimuthDeg}°) & ${ev.isoseismalContours.length} Isoseismals`);
});

// --- 2. Bespoke Benchmark Events Calibration ---
console.log("\n--- 2. Bespoke Benchmark Events Calibration ---");

// 1681 Yangyang
const ev1681 = HISTORICAL_EVENTS.find(e => e.id === "hist_1681_0626");
assert(ev1681, "1681 Yangyang event must exist");
assertEquals(ev1681.errorEllipse.centerLat, 37.90);
assertEquals(ev1681.errorEllipse.centerLon, 129.05);
assertEquals(ev1681.errorEllipse.semiMajorKm, 38.0);
assertEquals(ev1681.errorEllipse.semiMinorKm, 24.0);
assertEquals(ev1681.errorEllipse.azimuthDeg, 25.0);
assertEquals(ev1681.isoseismalContours.length, 4);
assertEquals(ev1681.isoseismalContours[0].mmi, "VIII~IX");
assertEquals(ev1681.isoseismalContours[0].semiMajorKm, 65.0);
console.log("  [PASS] 1681 Yangyang calibrated: 38x24km @ 25°, MMI VIII~IX (65km)");

// 1643 Ulsan
const ev1643 = HISTORICAL_EVENTS.find(e => e.id === "hist_1643_ulsan");
assert(ev1643, "1643 Ulsan event must exist");
assertEquals(ev1643.errorEllipse.centerLat, 35.54);
assertEquals(ev1643.errorEllipse.centerLon, 129.35);
assertEquals(ev1643.errorEllipse.semiMajorKm, 35.0);
assertEquals(ev1643.errorEllipse.semiMinorKm, 22.0);
assertEquals(ev1643.errorEllipse.azimuthDeg, 28.0);
assertEquals(ev1643.isoseismalContours.length, 5);
assertEquals(ev1643.isoseismalContours[0].mmi, "IX");
assertEquals(ev1643.isoseismalContours[0].semiMajorKm, 35.0);
console.log("  [PASS] 1643 Ulsan calibrated: 35x22km @ 28°, MMI IX liquefaction zone (35km)");

// 1518 Seoul
const ev1518 = HISTORICAL_EVENTS.find(e => e.id === "hist_1518_seoul");
assert(ev1518, "1518 Seoul event must exist");
assertEquals(ev1518.errorEllipse.centerLat, 37.57);
assertEquals(ev1518.errorEllipse.centerLon, 126.98);
assertEquals(ev1518.errorEllipse.semiMajorKm, 32.0);
assertEquals(ev1518.errorEllipse.semiMinorKm, 20.0);
assertEquals(ev1518.errorEllipse.azimuthDeg, 42.0);
assertEquals(ev1518.isoseismalContours.length, 4);
assertEquals(ev1518.isoseismalContours[0].mmi, "VIII");
assertEquals(ev1518.isoseismalContours[0].semiMajorKm, 45.0);
console.log("  [PASS] 1518 Seoul calibrated: 32x20km @ 42°, MMI VIII fortress zone (45km)");

// 0779 Gyeongju
const ev0779 = HISTORICAL_EVENTS.find(e => e.id === "hist_0779_gyeongju");
assert(ev0779, "0779 Gyeongju event must exist");
assertEquals(ev0779.errorEllipse.centerLat, 35.84);
assertEquals(ev0779.errorEllipse.centerLon, 129.22);
assertEquals(ev0779.errorEllipse.semiMajorKm, 48.0);
assertEquals(ev0779.errorEllipse.semiMinorKm, 32.0);
assertEquals(ev0779.errorEllipse.azimuthDeg, 25.0);
assertEquals(ev0779.isoseismalContours.length, 4);
assertEquals(ev0779.isoseismalContours[0].mmi, "IX");
assertEquals(ev0779.isoseismalContours[0].semiMajorKm, 28.0);
console.log("  [PASS] 0779 Gyeongju calibrated: 48x32km @ 25°, MMI IX Silla capital zone (28km)");

// --- 3. Seismic Source Model Dynamic Resolution Verification ---
console.log("\n--- 3. Seismic Source Model Dynamic Resolution Verification ---");

// Test that historical events resolve to their TRUE coordinates, not Yangyang fallback!
const src1643 = SeismicSourceModel.createBenchmarkSource("hist_1643_ulsan", ev1643);
assertEquals(src1643.hypocenter.lat, 35.54, "1643 Ulsan source lat must be 35.54 (not Yangyang 37.90)");
assertEquals(src1643.hypocenter.lon, 129.35, "1643 Ulsan source lon must be 129.35 (not Yangyang 129.05)");
assertEquals(src1643.sourceType, "HISTORICAL_INFERRED");
assertEquals(src1643.magnitude, null, "Historical magnitude must remain strictly null");
assertEquals(src1643.focalMechanism, null, "Historical focal mechanism must remain null");
assertEquals(src1643.finiteFault, null, "Historical finite fault must remain null");
assertEquals(src1643.radiationStatus, RadiationPatternStatus.AZIMUTHALLY_NEUTRAL_VISUAL_APPROXIMATION);
console.log("  [PASS] 1643 Ulsan source resolved to Ulsan coordinates (lat 35.54, lon 129.35)");

const src1518 = SeismicSourceModel.createBenchmarkSource("hist_1518_seoul", ev1518);
assertEquals(src1518.hypocenter.lat, 37.57, "1518 Seoul source lat must be 37.57");
assertEquals(src1518.hypocenter.lon, 126.98, "1518 Seoul source lon must be 126.98");
console.log("  [PASS] 1518 Seoul source resolved to Seoul coordinates (lat 37.57, lon 126.98)");

const src0779 = SeismicSourceModel.createBenchmarkSource("hist_0779_gyeongju", ev0779);
assertEquals(src0779.hypocenter.lat, 35.84, "0779 Gyeongju source lat must be 35.84");
assertEquals(src0779.hypocenter.lon, 129.22, "0779 Gyeongju source lon must be 129.22");
console.log("  [PASS] 0779 Gyeongju source resolved to Gyeongju coordinates (lat 35.84, lon 129.22)");

// Universal fallback for an arbitrary historical event
const ev1036 = HISTORICAL_EVENTS.find(e => e.id === "hist_1036_0617_gaegyeong");
const src1036 = SeismicSourceModel.createBenchmarkSource("hist_1036_0617_gaegyeong", ev1036);
assertEquals(src1036.hypocenter.lat, 37.97, "1036 Kaesong source lat must be 37.97");
assertEquals(src1036.hypocenter.lon, 126.55, "1036 Kaesong source lon must be 126.55");
assertEquals(src1036.magnitude, null);
console.log("  [PASS] Arbitrary historical event (1036 Kaesong) resolved dynamically (lat 37.97, lon 126.55)");

// Modern instrumental event preservation
const srcTurkey = SeismicSourceModel.createBenchmarkSource("global_2023_turkey");
assertEquals(srcTurkey.sourceType, "FINITE_FAULT");
assertEquals(srcTurkey.magnitude, 7.8);
assert(srcTurkey.finiteFault != null);
console.log("  [PASS] Modern finite-fault source (2023 Turkey) preserved intact");

// --- 4. DOM Template & CSS Stylesheet Verification ---
console.log("\n--- 4. DOM Template & CSS Stylesheet Verification ---");
const html = Deno.readTextFileSync("index.html");
assert(html.includes('id="hist-ellipse-section"'), "index.html must contain #hist-ellipse-section");
console.log("  [PASS] index.html contains #hist-ellipse-section");

const css = Deno.readTextFileSync("css/surface.css");
assert(css.includes(".hist-ellipse-section"), "css/surface.css must contain .hist-ellipse-section");
assert(css.includes(".hist-ellipse-grid"), "css/surface.css must contain .hist-ellipse-grid");
assert(css.includes(".hist-ellipse-svg-box"), "css/surface.css must contain .hist-ellipse-svg-box");
assert(css.includes(".hist-param-pill"), "css/surface.css must contain .hist-param-pill");
assert(css.includes(".hist-iso-table"), "css/surface.css must contain .hist-iso-table");
console.log("  [PASS] css/surface.css contains all Phase D5 style rules");

// --- 5. Main.js Shader Uniforms Verification ---
console.log("\n--- 5. Main.js Shader Uniforms Verification ---");
const mainJs = Deno.readTextFileSync("js/main.js");
assert(mainJs.includes("u_errorEllipseAxes"), "main.js must declare u_errorEllipseAxes");
assert(mainJs.includes("u_errorEllipseAngle"), "main.js must declare u_errorEllipseAngle");
assert(mainJs.includes("u_isoseismalRadii"), "main.js must declare u_isoseismalRadii");
assert(mainJs.includes("u_hasErrorEllipse"), "main.js must declare u_hasErrorEllipse");
assert(mainJs.includes("stipple95"), "main.js must compute stipple95 in terrain shader");
assert(mainJs.includes("stipple95G"), "main.js must compute stipple95G in Tier 0 globe shader");
console.log("  [PASS] main.js properly declares and renders error ellipse and isoseismals in both terrain & globe shaders");

console.log("\n====================================================================");
console.log("Phase D5 Error Ellipse Unit Test: ALL ASSERTIONS PASSED (100%)");
console.log("====================================================================");
