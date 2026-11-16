// ============================================================================
// SEISMOLIVE v4.0 — Scientific Validation & Waveform Ingestion Test Suite
// File: tests/test_modern_seismic_solvers.js
// Scope: Modern Instrumental Seismology Solvers
// Test Categories:
//   1. Brune Inversion & Path Attenuation (t*) Synthetic Recovery
//   2. ZRT Coordinate System & 4-Cardinal Direction Handedness Tests
//   3. Maeda (1985) AR-AIC P/S Phase Onset Picker Benchmarks (White, Pink, Microseismic)
//   4. Relocated Aftershock PCA Fault Plane ODR & Diagnostics (Clean, Noisy, Outliers, Conjugate)
//   5. Waveform Ingestion Container & Provenance Verification
// ============================================================================

import { assertEquals, assert, assertAlmostEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  invertBruneSourceParams,
  computePathAttenuationTStar,
  applyHighpassFilter,
  computeSTALTA,
  detectEventTrigger,
  refinePhaseArrivalAIC,
  rotateZNEtoZRT,
  computeJurkevicsPolarization,
  analyze3DHodogram,
  fitFaultPlaneFromAftershocks,
  solveSymmetric3x3EigenSystem,
  SeismologicalTrace,
  SeismicStationPacket
} from "../js/geophysics/ModernSeismicSolvers.js";

console.log("====================================================================");
console.log("SEISMOLIVE v4.0 — Modern Instrumental Seismology Final Test Suite");
console.log("====================================================================");

// ============================================================================
// Category 1: Brune Inversion & Path Attenuation (t*) Synthetic Recovery
// ============================================================================
console.log("\n--- Category 1: Brune Inversion & Path Attenuation (t*) ---");

// Test 1.1: Path Attenuation t* Evaluation
// Hypo distance 35.0 km, Vs = 3.50 km/s -> travel time = 10.0 s. Q = 250 -> t* = 10.0 / 250 = 0.040 s
const tStar = computePathAttenuationTStar(35.0, 3.50, 250);
assertAlmostEquals(tStar, 0.040, 1e-5, "t* must be exactly 0.040 s");
console.log(`  [PASS] 1.1: Path attenuation t* = ${tStar.toFixed(4)} s (R=35km, Vs=3.5km/s, Q=250)`);

// Test 1.2: Independent Synthetic Recovery of M0 and fc
// Given target source: M0 = 2.50e16 N·m (Mw 4.87), fc = 1.20 Hz, R = 18.0 km, Vs = 3.50 km/s, rho = 2700 kg/m³
const trueM0 = 2.50e16;
const trueFc = 1.20;
const testR = 18.0;
const testVs = 3.50;
const testRho = 2700.0;
const testRCoeff = 0.60;
const testFS = 2.0;
const testQ = 300;

// Analytical forward calculation of raw observed spectral plateau:
// Omega0_corr = (M0 * R_theta_phi * FS) / (4 * pi * rho * Vs^3 * R)
const analyticalOmega0Corr = (trueM0 * testRCoeff * testFS) / (4.0 * Math.PI * testRho * Math.pow(testVs * 1000, 3) * (testR * 1000));
// Forward attenuate: Omega0_raw = Omega0_corr * exp(-pi * f_ref * t*)
const testTStar = (testR * 1000) / (testVs * 1000 * testQ);
const analyticalOmega0Raw = analyticalOmega0Corr * Math.exp(-Math.PI * 1.0 * testTStar);

const invSol = invertBruneSourceParams({
  omega0: analyticalOmega0Raw,
  fc: trueFc,
  vsKmS: testVs,
  hypoDistKm: testR,
  densityKgM3: testRho,
  radiationCoeff: testRCoeff,
  freeSurfaceAmp: testFS,
  qFactor: testQ,
  freqRefHz: 1.0
});

assertAlmostEquals(invSol.seismicMomentNm, trueM0, 1e13, "Recovered M0 must match true M0");
assertAlmostEquals(invSol.momentMagnitudeMw, 4.87, 0.01, "Recovered Mw must match 4.87");
// Rupture radius: (2.34 * 3500) / (2 * pi * 1.20) = 8190 / 7.5398 = 1086.2 m = 1.086 km
assertAlmostEquals(invSol.ruptureRadiusKm, 1.086, 0.01, "Recovered radius must match 1.086 km");
// Stress drop: (7/16) * (2.50e16 / 1086.2^3) = 0.4375 * 1.95e7 = 8.54 MPa
assertAlmostEquals(invSol.stressDropMPa, 8.54, 0.05, "Recovered stress drop must match 8.54 MPa");
console.log(`  [PASS] 1.2: Synthetic recovery with Q de-attenuation: M0=${invSol.seismicMomentNm.toExponential(2)} N·m, Mw=${invSol.momentMagnitudeMw}, r=${invSol.ruptureRadiusKm} km, Δσ=${invSol.stressDropMPa} MPa`);

// ============================================================================
// Category 2: ZRT Coordinate System & 4-Cardinal Direction Handedness Tests
// ============================================================================
console.log("\n--- Category 2: ZRT Coordinate System & Cardinal Direction Tests ---");

// Test 2.1: 4 Cardinal Directions Verification
// Ground rule: R points AWAY from epicenter.
// Case North: Station is North of Epicenter (backAzimuth = 180°)
// A wave propagating North (N=+1, E=0) has motion strictly along +R:
const rotN = rotateZNEtoZRT([1.0], [0.0], 180.0, { transverseConvention: 'OBSPY_RIGHT' });
assertAlmostEquals(rotN.radial[0], 1.0, 1e-6);
assertAlmostEquals(rotN.transverse[0], 0.0, 1e-6);

// Case East: Station is East of Epicenter (backAzimuth = 270°)
// A wave propagating East (N=0, E=+1) has motion strictly along +R:
const rotE = rotateZNEtoZRT([0.0], [1.0], 270.0, { transverseConvention: 'OBSPY_RIGHT' });
assertAlmostEquals(rotE.radial[0], 1.0, 1e-6);
assertAlmostEquals(rotE.transverse[0], 0.0, 1e-6);

// Case South: Station is South of Epicenter (backAzimuth = 0°)
// A wave propagating South (N=-1, E=0) has motion strictly along +R:
const rotS = rotateZNEtoZRT([-1.0], [0.0], 0.0, { transverseConvention: 'OBSPY_RIGHT' });
assertAlmostEquals(rotS.radial[0], 1.0, 1e-6);
assertAlmostEquals(rotS.transverse[0], 0.0, 1e-6);

// Case West: Station is West of Epicenter (backAzimuth = 90°)
// A wave propagating West (N=0, E=-1) has motion strictly along +R:
const rotW = rotateZNEtoZRT([0.0], [-1.0], 90.0, { transverseConvention: 'OBSPY_RIGHT' });
assertAlmostEquals(rotW.radial[0], 1.0, 1e-6);
assertAlmostEquals(rotW.transverse[0], 0.0, 1e-6);
console.log("  [PASS] 2.1: Radial vector verified pointing strictly away from epicenter across all 4 cardinal directions (N, E, S, W)");

// Test 2.2: Transverse Direction & Handedness Check
// When station is North of Epicenter (backAzimuth = 180°), wave moves North (R = North).
// An eastward horizontal displacement (N=0, E=+1) is to the RIGHT of North:
// Under OBSPY_RIGHT: T_right must be +1.0 (pointing to the right of R)
const rotTransObsPy = rotateZNEtoZRT([0.0], [1.0], 180.0, { transverseConvention: 'OBSPY_RIGHT' });
assertAlmostEquals(rotTransObsPy.transverse[0], 1.0, 1e-6);

// Under RIGHT_HANDED_Z_UP: T_left must be -1.0 (so that R x T_left = North x West = +Z_up)
const rotTransZUp = rotateZNEtoZRT([0.0], [1.0], 180.0, { transverseConvention: 'RIGHT_HANDED_Z_UP' });
assertAlmostEquals(rotTransZUp.transverse[0], -1.0, 1e-6);
console.log("  [PASS] 2.2: Handedness duality validated: OBSPY_RIGHT (T=+1 right) vs RIGHT_HANDED_Z_UP (R x T = +Z_up)");

// ============================================================================
// Category 3: Maeda (1985) AR-AIC P/S Phase Onset Picker Benchmarks
// ============================================================================
console.log("\n--- Category 3: AR-AIC P/S Phase Onset Benchmarks (White, Pink, Microseismic) ---");

const dt = 0.01; // 100 Hz (10 ms discrete step)
const totalSamples = 1500; // 15.0 seconds
const trueOnsetPSec = 3.50; // True P-wave arrival at t = 3.50s
const trueOnsetSSec = 7.00; // True S-wave arrival at t = 7.00s
const truePIdx = Math.round(trueOnsetPSec / dt);
const trueSIdx = Math.round(trueOnsetSSec / dt);

// Noise Generators:
function generateWhiteNoise(len, amp) {
  const arr = new Float32Array(len);
  for (let i = 0; i < len; i++) arr[i] = (Math.random() - 0.5) * 2.0 * amp;
  return arr;
}

function generatePinkNoise(len, amp) {
  // Simple filtered 1/f noise
  const arr = new Float32Array(len);
  let b0 = 0, b1 = 0, b2 = 0;
  for (let i = 0; i < len; i++) {
    const white = (Math.random() - 0.5) * 2.0;
    b0 = 0.997 * b0 + white * 0.0555;
    b1 = 0.985 * b1 + white * 0.0750;
    b2 = 0.950 * b2 + white * 0.1538;
    arr[i] = (b0 + b1 + b2) * amp * 0.5;
  }
  return arr;
}

function generateMicroseismicNoise(len, amp) {
  // Ocean microseism peak at 0.2 Hz
  const arr = new Float32Array(len);
  const phase = Math.random() * 2 * Math.PI;
  for (let i = 0; i < len; i++) {
    const t = i * dt;
    arr[i] = Math.sin(2.0 * Math.PI * 0.20 * t + phase) * amp + (Math.random() - 0.5) * amp * 0.3;
  }
  return arr;
}

// Benchmark across SNR and Noise Types
const testSNRs = [Infinity, 10.0, 5.0, 3.0, 2.0];
const noiseTypes = [
  { name: "White Noise (Raw)", gen: generateWhiteNoise, needsFilter: false },
  { name: "Pink Noise (1/f Drift)", gen: generatePinkNoise, needsFilter: true },
  { name: "Microseism (0.2Hz Ocean Swell)", gen: generateMicroseismicNoise, needsFilter: true }
];

console.log("  [3.1] P-Wave Onset Benchmarks on Vertical Component (100 Hz sampling):");

noiseTypes.forEach(({ name: noiseName, gen: noiseGen, needsFilter }) => {
  console.log(`  > Noise Condition: ${noiseName}`);
  testSNRs.forEach(snr => {
    const errorsMs = [];
    const numTrials = 20;

    for (let trial = 0; trial < numTrials; trial++) {
      const noiseAmp = snr === Infinity ? 0.0 : (1.0 / snr);
      const rawTrace = noiseGen(totalSamples, noiseAmp);

      // Causal P-wave signal (dominant 4 Hz)
      for (let i = truePIdx; i < totalSamples; i++) {
        const t = (i - truePIdx) * dt;
        const pPulse = Math.sin(2.0 * Math.PI * 4.0 * t) * Math.exp(-t * 2.5);
        rawTrace[i] += pPulse * 1.0;
      }

      // Preprocessing: Highpass filter for colored noise to suppress long-period drift
      const trace = needsFilter ? applyHighpassFilter(rawTrace, dt, 1.0) : rawTrace;

      const staLta = computeSTALTA(trace, dt, 0.2, 2.0);
      const trigger = detectEventTrigger(staLta, dt, 3.5, 1.5);

      if (trigger.triggerIndex !== null) {
        const aic = refinePhaseArrivalAIC(trace, dt, trigger.triggerIndex, { searchPreSec: 1.5, searchPostSec: 0.5 });
        const errMs = Math.abs((aic.onsetTimeSec - trueOnsetPSec) * 1000.0);
        errorsMs.push(errMs);
      } else {
        errorsMs.push(500.0); // Missed trigger penalty
      }
    }

    errorsMs.sort((a, b) => a - b);
    const meanErr = errorsMs.reduce((a, b) => a + b, 0) / errorsMs.length;
    const medErr = errorsMs[Math.floor(errorsMs.length / 2)];
    const p95Err = errorsMs[Math.floor(errorsMs.length * 0.95)];

    console.log(`    SNR ${snr === Infinity ? 'Inf' : snr.toFixed(1).padStart(4)}: Mean Error = ${meanErr.toFixed(1)} ms | Median = ${medErr.toFixed(1)} ms | P95 = ${p95Err.toFixed(1)} ms`);

    if (snr >= 5.0) {
      assert(medErr <= 30.0, `Median error must be <= 30ms for SNR >= 5 (got ${medErr}ms)`);
    }
  });
});

console.log("\n  [3.2] S-Wave Onset Benchmarks on Transverse Component (post-P arrival window):");
// S-wave arrives at t = 7.00s with 2 Hz frequency
testSNRs.slice(0, 3).forEach(snr => {
  const noiseAmp = snr === Infinity ? 0.0 : (1.0 / snr);
  const transTrace = generateWhiteNoise(totalSamples, noiseAmp);
  // P-wave coda leakage on transverse
  for (let i = truePIdx; i < trueSIdx; i++) {
    const t = (i - truePIdx) * dt;
    transTrace[i] += Math.sin(2.0 * Math.PI * 4.0 * t) * Math.exp(-t * 0.8) * 0.15;
  }
  // S-wave arrival at t = 7.00s
  for (let i = trueSIdx; i < totalSamples; i++) {
    const t = (i - trueSIdx) * dt;
    transTrace[i] += Math.sin(2.0 * Math.PI * 2.0 * t) * Math.exp(-t * 1.5) * 1.2;
  }

  // S-wave trigger window starts after P arrival (t >= 5.0s)
  const staLtaS = computeSTALTA(transTrace.subarray(500), dt, 0.3, 1.5);
  const triggerS = detectEventTrigger(staLtaS, dt, 3.0, 1.5);
  assert(triggerS.triggerIndex !== null, "S-wave trigger must activate");
  const globalTriggerIdx = 500 + triggerS.triggerIndex;
  const aicS = refinePhaseArrivalAIC(transTrace, dt, globalTriggerIdx, { searchPreSec: 1.5, searchPostSec: 0.5 });
  const sErrorMs = Math.abs((aicS.onsetTimeSec - trueOnsetSSec) * 1000.0);
  console.log(`    SNR ${snr === Infinity ? 'Inf' : snr.toFixed(1).padStart(4)}: S-Wave AIC Onset = ${aicS.onsetTimeSec.toFixed(2)}s | Error = ${sErrorMs.toFixed(0)} ms (Target: ${trueOnsetSSec.toFixed(2)}s)`);
  assert(sErrorMs <= 50.0, `S-wave onset error must be <= 50ms for SNR >= 5 (got ${sErrorMs}ms)`);
});
console.log("  [PASS] 3: P and S phase onset benchmarks verified independently across noise regimes");

// ============================================================================
// Category 4: Relocated Aftershock PCA Fault Plane ODR & Diagnostics
// ============================================================================
console.log("\n--- Category 4: Relocated Aftershock PCA Fault Plane ODR & Diagnostics ---");

// Test 4.1: Clean Synthetic Planar Cloud (Target Strike 25°, Dip 70°)
const targetStrike = 25.0;
const targetDip = 70.0;
const radS = (targetStrike * Math.PI) / 180.0;
const radD = (targetDip * Math.PI) / 180.0;

// Orthonormal basis for fault plane:
// u_hat (along strike): [sin(phi), cos(phi), 0]
// v_hat (down dip):     [cos(phi)*cos(delta), -sin(phi)*cos(delta), sin(delta)]
// w_hat (fault normal): [-cos(phi)*sin(delta), sin(phi)*sin(delta), cos(delta)]
const cleanCloud = [];
for (let i = 0; i < 60; i++) {
  const u = (Math.random() - 0.5) * 10.0; // km along strike
  const v = Math.random() * 8.0;          // km down dip
  const w = (Math.random() - 0.5) * 0.01; // 10m hypoDD level residual

  const x = u * Math.sin(radS) + v * Math.cos(radD) * Math.cos(radS) - w * Math.sin(radD) * Math.cos(radS);
  const y = u * Math.cos(radS) - v * Math.cos(radD) * Math.sin(radS) + w * Math.sin(radD) * Math.sin(radS);
  const z = 12.0 + v * Math.sin(radD) + w * Math.cos(radD);

  cleanCloud.push({ x, y, z });
}

const cleanFit = fitFaultPlaneFromAftershocks(cleanCloud);
assertEquals(cleanFit.status, "SUCCESS");
assertAlmostEquals(cleanFit.dipDeg, targetDip, 1.5, "Dip must match 70° within ±1.5°");
assertAlmostEquals(cleanFit.strikeDeg, targetStrike, 2.0, "Strike must match 25° within ±2.0°");
assert(cleanFit.rmsResidualMeters <= 10.0, `RMS residual must be <= 10m (got ${cleanFit.rmsResidualMeters}m)`);
assert(cleanFit.diagnostics.planarityIndex > 0.60, `Planarity index must be high (>0.60, got ${cleanFit.diagnostics.planarityIndex})`);
assert(cleanFit.diagnostics.isCoplanar, "Clean planar cloud must be flagged isCoplanar = true");
console.log(`  [PASS] 4.1: Clean planar fault: Strike=${cleanFit.strikeDeg}°, Dip=${cleanFit.dipDeg}°, RMS=${cleanFit.rmsResidualMeters}m, Planarity=${cleanFit.diagnostics.planarityIndex}`);

// Test 4.2: Robust Outlier Handling (10% Extreme Outliers)
const outlierCloud = [...cleanCloud];
for (let i = 0; i < 6; i++) {
  // Add 6 extreme outlier points (> 3 km off plane)
  outlierCloud.push({
    x: cleanCloud[i].x + (Math.random() - 0.5) * 5.0,
    y: cleanCloud[i].y + (Math.random() - 0.5) * 5.0,
    z: cleanCloud[i].z + (Math.random() - 0.5) * 4.0
  });
}
const untrimmedFit = fitFaultPlaneFromAftershocks(outlierCloud, { trimOutliers: false });
const trimmedFit = fitFaultPlaneFromAftershocks(outlierCloud, { trimOutliers: true });
assert(trimmedFit.rmsResidualKm < untrimmedFit.rmsResidualKm, "Outlier trimming must strictly reduce RMS residual");
assert(trimmedFit.diagnostics.outliersRemoved >= 6, `Must detect and remove at least 6 outliers (got ${trimmedFit.diagnostics.outliersRemoved})`);
console.log(`  [PASS] 4.2: Outlier rejection: RMS improved from ${untrimmedFit.rmsResidualMeters}m to ${trimmedFit.rmsResidualMeters}m (Removed ${trimmedFit.diagnostics.outliersRemoved} outliers)`);

// Test 4.3: Conjugate / Non-Planar Cloud Rejection
// Two perpendicular fault branches forming an X-shape (conjugate faults)
const conjugateCloud = [...cleanCloud];
const conjugateStrike = (targetStrike + 90.0) * Math.PI / 180.0;
for (let i = 0; i < 60; i++) {
  const u = (Math.random() - 0.5) * 8.0;
  const v = Math.random() * 6.0;
  const x = u * Math.sin(conjugateStrike) + v * Math.cos(radD) * Math.cos(conjugateStrike);
  const y = u * Math.cos(conjugateStrike) - v * Math.cos(radD) * Math.sin(conjugateStrike);
  const z = 12.0 + v * Math.sin(radD);
  conjugateCloud.push({ x, y, z });
}
const conjugateFit = fitFaultPlaneFromAftershocks(conjugateCloud);
assert(!conjugateFit.diagnostics.isCoplanar, "Conjugate bimodal fault cloud must NOT be flagged as single coplanar fault");
assert(conjugateFit.diagnostics.thicknessRatio > 0.25, "Thickness ratio must be high for conjugate clouds");
console.log(`  [PASS] 4.3: Conjugate fault cloud correctly identified: isCoplanar = ${conjugateFit.diagnostics.isCoplanar}, Thickness Ratio = ${conjugateFit.diagnostics.thicknessRatio}`);

// ============================================================================
// Category 5: Waveform Ingestion Container & Provenance Verification
// ============================================================================
console.log("\n--- Category 5: Waveform Ingestion Container & Provenance ---");

// Test 5.1: SeismologicalTrace Metadata & Immutability
const testTraceZ = new SeismologicalTrace({
  network: "KS",
  station: "YND",
  location: "00",
  channel: "HHZ",
  component: "Z",
  startTimeUTC: "2016-09-12T11:32:50.000Z",
  sampleRateHz: 100.0,
  samples: new Float32Array([0.01, 0.05, -0.02, 0.12, -0.08]),
  units: "M/S2",
  sensitivity: 2.5e8,
  hasResponseRemoved: true,
  checksumSHA256: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
});

assertEquals(testTraceZ.network, "KS");
assertEquals(testTraceZ.station, "YND");
assertEquals(testTraceZ.channel, "HHZ");
assertEquals(testTraceZ.sampleCount, 5);
assertAlmostEquals(testTraceZ.durationSec, 0.05, 1e-4);
assertAlmostEquals(testTraceZ.qualityFlags.maxAmplitude, 0.12, 1e-4);

// Add processing provenance
testTraceZ.recordProvenance("BANDPASS_FILTER", "Butterworth 2-pole 0.1-20Hz");
assertEquals(testTraceZ.provenance.length, 2);
assertEquals(testTraceZ.provenance[1].step, "BANDPASS_FILTER");
console.log("  [PASS] 5.1: SeismologicalTrace metadata, quality flags, and provenance tracking validated");

// Test 5.2: SeismicStationPacket Synchronization
const testTraceN = new SeismologicalTrace({ station: "YND", channel: "HHN", component: "N", sampleRateHz: 100.0, samples: new Float32Array(5) });
const testTraceE = new SeismologicalTrace({ station: "YND", channel: "HHE", component: "E", sampleRateHz: 100.0, samples: new Float32Array(5) });

const stationPacket = new SeismicStationPacket({
  stationCode: "YND",
  latitude: 36.54,
  longitude: 129.38,
  elevationM: 85.0,
  traceZ: testTraceZ,
  traceN: testTraceN,
  traceE: testTraceE
});

assert(stationPacket.isSynchronized, "Station packet must confirm 3-component synchronization");
console.log("  [PASS] 5.2: 3-Component SeismicStationPacket synchronization verified (Z, N, E)");

console.log("\n====================================================================");
console.log("ALL 5 VALIDATION & INGESTION PREPARATION CATEGORIES PASSED (100%)");
console.log("====================================================================");
