// ============================================================================
// SEISMOLIVE v4.0 — Phase C Wavefield & Source Unit Test Suite
// File: tests/test_phase_c_wavefield.js
// Run via: deno run -A tests/test_phase_c_wavefield.js
// ============================================================================

import {
  SeismicSourceModel,
  VelocityModelStatus,
  RadiationPatternStatus,
  REFERENCE_CRUSTAL_VELOCITY,
  REGIONAL_VELOCITY_MODELS
} from '../js/3d/seismicSourceModel.js';

import { UniversalWavefieldEngine } from '../js/3d/universalWavefieldEngine.js';

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
console.log('SEISMOLIVE v4.0 — Phase C Wavefield & Source Unit Test Suite');
console.log('====================================================================\n');

// ----------------------------------------------------------------------------
// Test Group 1: Source Representation & Historical Fault Nullification
// ----------------------------------------------------------------------------
console.log('--- Test Group 1: Source Representation & Historical Fault Nullification ---');

const turkeySource = SeismicSourceModel.createBenchmarkSource('global_2023_turkey');
assert(turkeySource.sourceType === 'FINITE_FAULT', 'Turkey source is FINITE_FAULT');
assert(turkeySource.finiteFault !== null, 'Turkey finite fault geometry is present');
assert(turkeySource.finiteFault.lengthKm === 310.0, 'Turkey rupture length is 310km (EAF)');
assert(turkeySource.focalMechanism.strikeDeg === 65.0, 'Turkey fault strike is 65°');
assert(turkeySource.focalMechanism.rakeDeg === 5.0, 'Turkey fault is left-lateral strike-slip (rake 5°)');

const kumamotoSource = SeismicSourceModel.createBenchmarkSource('global_2016_kumamoto');
assert(kumamotoSource.finiteFault !== null, 'Kumamoto finite fault geometry is present');
assert(kumamotoSource.finiteFault.lengthKm === 34.0, 'Kumamoto rupture length is 34km (Futagawa)');

const gyeongjuSource = SeismicSourceModel.createBenchmarkSource('hist_2016_gyeongju');
assert(gyeongjuSource.finiteFault !== null, 'Gyeongju finite fault geometry is present');
assert(gyeongjuSource.finiteFault.lengthKm === 5.2, 'Gyeongju rupture length is 5.2km');

// 1681 Yangyang (Historical Inferred)
const yangyangSource = SeismicSourceModel.createBenchmarkSource('hist_1681_0626');
assert(yangyangSource.sourceType === 'HISTORICAL_INFERRED', '1681 Yangyang is HISTORICAL_INFERRED');
assert(yangyangSource.magnitude === null, '1681 Yangyang magnitude is strictly null (unverified)');
assert(yangyangSource.finiteFault === null, '1681 Yangyang finite fault is STRICTLY NULL (zero fake fault plane)');
assert(yangyangSource.focalMechanism === null, '1681 Yangyang focal mechanism is STRICTLY NULL (no fake strike/dip/rake)');
assert(yangyangSource.radiationStatus === RadiationPatternStatus.AZIMUTHALLY_NEUTRAL_VISUAL_APPROXIMATION, '1681 Yangyang radiation status is AZIMUTHALLY_NEUTRAL_VISUAL_APPROXIMATION');
assert(yangyangSource.radiationNote.includes('방위각 중립적 시각화 근사'), '1681 Yangyang explicitly documents visual approximation semantics (not observed pattern)');

// ----------------------------------------------------------------------------
// Test Group 2: Regional Velocity Model Provenance & Parameter Integrity
// ----------------------------------------------------------------------------
console.log('\n--- Test Group 2: Regional Velocity Model Provenance & Status ---');

assert(REFERENCE_CRUSTAL_VELOCITY.status === VelocityModelStatus.REFERENCE_CRUSTAL, 'Reference model flagged as REFERENCE_CRUSTAL');
assert(REFERENCE_CRUSTAL_VELOCITY.vP_km_s === 5.80, 'Reference vP is 5.80 km/s');
assert(REFERENCE_CRUSTAL_VELOCITY.vS_km_s === 3.35, 'Reference vS is 3.35 km/s');
assert(REFERENCE_CRUSTAL_VELOCITY.vRayleigh_km_s === 3.08, 'Reference vRayleigh is 3.08 km/s');

assert(REGIONAL_VELOCITY_MODELS.KOREA_PENINSULA.status === VelocityModelStatus.OBSERVED_REGIONAL, 'Korean model is OBSERVED_REGIONAL');
assert(REGIONAL_VELOCITY_MODELS.KOREA_PENINSULA.vP_km_s === 5.95, 'Korean vP is 5.95 km/s');
assert(REGIONAL_VELOCITY_MODELS.KOREA_PENINSULA.citation.includes('Kim') && REGIONAL_VELOCITY_MODELS.KOREA_PENINSULA.citation.includes('2011'), 'Korean velocity model has formal literature citation');
assert(REGIONAL_VELOCITY_MODELS.KOREA_PENINSULA.doi.startsWith('10.1007/'), 'Korean velocity model has valid DOI');

assert(REGIONAL_VELOCITY_MODELS.TURKEY_ANATOLIA.status === VelocityModelStatus.OBSERVED_REGIONAL, 'Turkey model is OBSERVED_REGIONAL');
assert(REGIONAL_VELOCITY_MODELS.TURKEY_ANATOLIA.vP_km_s === 6.00, 'Turkey vP is 6.00 km/s');
assert(REGIONAL_VELOCITY_MODELS.TURKEY_ANATOLIA.citation.includes('Karabulut') && REGIONAL_VELOCITY_MODELS.TURKEY_ANATOLIA.citation.includes('2011'), 'Turkey velocity model has formal literature citation');
assert(REGIONAL_VELOCITY_MODELS.TURKEY_ANATOLIA.doi.startsWith('10.1111/'), 'Turkey velocity model has valid DOI');

assert(REGIONAL_VELOCITY_MODELS.JAPAN_KYUSHU.citation.includes('Kubo') && REGIONAL_VELOCITY_MODELS.JAPAN_KYUSHU.citation.includes('2002'), 'Kyushu velocity model has formal literature citation');
assert(REGIONAL_VELOCITY_MODELS.JAPAN_KYUSHU.doi.startsWith('10.1016/'), 'Kyushu velocity model has valid DOI');

assert(REFERENCE_CRUSTAL_VELOCITY.citation.includes('Kennett & Engdahl (1991)'), 'Reference crustal velocity model has formal IASPEI91/AK135 citation');
assert(REFERENCE_CRUSTAL_VELOCITY.doi.startsWith('10.1111/'), 'Reference crustal velocity model has valid DOI');

// ----------------------------------------------------------------------------
// Test Group 3: Travel-Time Field & Physical Arrival Order (tP < tS < tR)
// ----------------------------------------------------------------------------
console.log('\n--- Test Group 3: Travel-Time Field & Arrival Order (tP < tS < tR) ---');

const engine = new UniversalWavefieldEngine(gyeongjuSource);
const testDistances = [5000.0, 20000.0, 50000.0, 100000.0]; // 5km, 20km, 50km, 100km

for (const d of testDistances) {
  const hypoDepth = 15000.0; // 15km
  const dist3D = Math.sqrt(d * d + hypoDepth * hypoDepth);
  const times = engine.evaluateTravelTimes(dist3D, d, hypoDepth);

  assert(times.tP < times.tS, `Distance ${(d/1000).toFixed(0)}km: tP (${times.tP.toFixed(2)}s) < tS (${times.tS.toFixed(2)}s)`);
  assert(times.tS < times.tR, `Distance ${(d/1000).toFixed(0)}km: tS (${times.tS.toFixed(2)}s) < tR (${times.tR.toFixed(2)}s)`);
  assert(Number.isFinite(times.tP) && times.tP > 0.0, `tP is positive finite number`);
}

// ----------------------------------------------------------------------------
// Test Group 4: Singularity-Free Geometrical Spreading at R -> 0
// ----------------------------------------------------------------------------
console.log('\n--- Test Group 4: Singularity-Free Geometrical Spreading (No 1/R Divergence) ---');

// Hypocenter exact origin (R = 0)
const spreadingZero = engine.evaluateGeometricalSpreading(0.0, 0.0);
assert(Number.isFinite(spreadingZero.spreadingBody), `Spreading at R=0 is finite: ${spreadingZero.spreadingBody.toFixed(6)}`);
assert(Number.isFinite(spreadingZero.spreadingSurf), `Surface spreading at Delta=0 is finite: ${spreadingZero.spreadingSurf.toFixed(6)}`);
assert(spreadingZero.spreadingBody > 0.0 && spreadingZero.spreadingBody <= 0.001, 'Spreading at R=0 correctly bounded by regularization radius R0');
assert(engine.r0_body_status === 'NUMERICAL_REGULARIZATION_PARAMETER', 'R0 status is explicitly NUMERICAL_REGULARIZATION_PARAMETER (not physical fault radius)');
assert(engine.delta0_surf_status === 'NUMERICAL_REGULARIZATION_PARAMETER', 'Delta0 status is explicitly NUMERICAL_REGULARIZATION_PARAMETER');

// Spreading at 100km should match ~ 1/100000 = 1e-5
const spreading100k = engine.evaluateGeometricalSpreading(100000.0, 100000.0);
const expected100k = 1.0 / 100000.0;
const relDiff = Math.abs(spreading100k.spreadingBody - expected100k) / expected100k;
assert(relDiff < 0.001, `Spreading at 100km matches physical 1/R (diff = ${(relDiff * 100).toFixed(4)}%)`);

// ----------------------------------------------------------------------------
// Test Group 5: Frequency-Dependent Anelastic Attenuation
// ----------------------------------------------------------------------------
console.log('\n--- Test Group 5: Anelastic Attenuation (Q(f) = Q0 * f^alpha) ---');

const atten = engine.evaluateAttenuation(50000.0, 50000.0); // 50km
assert(atten.attenP > 0.0 && atten.attenP <= 1.0, `P-wave attenuation factor is within (0, 1]: ${atten.attenP.toFixed(4)}`);
assert(atten.attenS > 0.0 && atten.attenS <= 1.0, `S-wave attenuation factor is within (0, 1]: ${atten.attenS.toFixed(4)}`);
assert(atten.attenP > atten.attenS, `P-wave attenuates less than S-wave over 50km (attenP > attenS: ${atten.attenP.toFixed(3)} > ${atten.attenS.toFixed(3)})`);

// ----------------------------------------------------------------------------
// Test Group 6: 3D Vector Polarization (P: Longitudinal, S: Transverse, R: Elliptical)
// ----------------------------------------------------------------------------
console.log('\n--- Test Group 6: 3D Vector Polarization ---');

// Station due East at 40km, elevation 0m
const eastStation = {
  obsE_m: 40000.0,
  obsN_m: 0.0,
  obsU_m: 0.0
};
const hypoDepth_m = 15000.0;
const d3d = Math.sqrt(40000 * 40000 + hypoDepth_m * hypoDepth_m);
const tTimes = engine.evaluateTravelTimes(d3d, 40000.0, hypoDepth_m);

// 1. Sample at P-wave arrival time (t = tP + 0.3s)
const pArrivalRes = engine.evaluateVectorDisplacement({
  ...eastStation,
  timeSec: tTimes.tP + 0.3
});
const uP = pArrivalRes.components.uP;
assert(Math.abs(uP[0]) > 0.0, `P-wave has longitudinal Eastward component: ${uP[0].toExponential(3)} m`);
assert(Math.abs(uP[1]) < 1e-12, `P-wave has zero transverse Northward component due East: ${uP[1]} m`);

// Check dot product of uP with propagation direction k_hat:
const k_hat = [40000 / d3d, 0.0, hypoDepth_m / d3d];
const uP_len = Math.sqrt(uP[0]*uP[0] + uP[1]*uP[1] + uP[2]*uP[2]);
const pDotK = (uP[0]*k_hat[0] + uP[1]*k_hat[1] + uP[2]*k_hat[2]) / (uP_len || 1);
assert(Math.abs(Math.abs(pDotK) - 1.0) < 1e-4, `P-wave polarization strictly parallel to propagation direction (dot product = ${pDotK.toFixed(4)})`);

// 2. Sample at S-wave arrival time (t = tS + 0.4s)
const sArrivalRes = engine.evaluateVectorDisplacement({
  ...eastStation,
  timeSec: tTimes.tS + 0.4
});
const uS = sArrivalRes.components.uS;
const uS_len = Math.sqrt(uS[0]*uS[0] + uS[1]*uS[1] + uS[2]*uS[2]);
const sDotK = (uS[0]*k_hat[0] + uS[1]*k_hat[1] + uS[2]*k_hat[2]) / (uS_len || 1);
assert(Math.abs(sDotK) < 1e-4, `S-wave polarization strictly perpendicular to propagation direction (dot product = ${sDotK.toExponential(3)})`);

// 3. Sample at Rayleigh arrival time (t = tR + 1.0s)
const rArrivalRes = engine.evaluateVectorDisplacement({
  ...eastStation,
  timeSec: tTimes.tR + 1.0
});
const uR = rArrivalRes.components.uR;
assert(Math.abs(uR[0]) > 0.0, `Rayleigh wave has horizontal radial component: ${uR[0].toExponential(3)} m`);
assert(Math.abs(uR[2]) > 0.0, `Rayleigh wave has vertical normal component: ${uR[2].toExponential(3)} m`);
assert(engine.ellipticityStatus === 'REFERENCE_APPROXIMATION', 'Rayleigh wave ellipticity is flagged as REFERENCE_APPROXIMATION');
assert(engine.ellipticityRatio === 1.47, 'Rayleigh wave theoretical Poisson solid ellipticity is 1.47');

// Retrograde sign verification:
// At wave crest (u_z > 0), horizontal particle velocity d(u_r)/dt must be negative (moving backwards)
const tCrest = tTimes.tR + (Math.PI / 2.0) / (2.0 * Math.PI * engine.dominantFreqHz);
const dtEps = 0.005; // 5ms finite difference
const uR_prev = engine.evaluateVectorDisplacement({ ...eastStation, timeSec: tCrest - dtEps }).components.uR;
const uR_crest = engine.evaluateVectorDisplacement({ ...eastStation, timeSec: tCrest }).components.uR;
const uR_next = engine.evaluateVectorDisplacement({ ...eastStation, timeSec: tCrest + dtEps }).components.uR;

const dur_dt_crest = (uR_next[0] - uR_prev[0]) / (2.0 * dtEps);
assert(uR_crest[2] > 0.0, `At crest time, vertical displacement u_z is positive (u_z = ${uR_crest[2].toExponential(3)} m)`);
assert(dur_dt_crest < 0.0, `At wave crest, horizontal particle velocity d(u_r)/dt is negative (retrograde backward motion: ${dur_dt_crest.toExponential(3)} m/s)`);

// At wave trough (u_z < 0), horizontal particle velocity d(u_r)/dt must be positive (moving forwards)
const tTrough = tTimes.tR + (3.0 * Math.PI / 2.0) / (2.0 * Math.PI * engine.dominantFreqHz);
const uR_prev_tr = engine.evaluateVectorDisplacement({ ...eastStation, timeSec: tTrough - dtEps }).components.uR;
const uR_trough = engine.evaluateVectorDisplacement({ ...eastStation, timeSec: tTrough }).components.uR;
const uR_next_tr = engine.evaluateVectorDisplacement({ ...eastStation, timeSec: tTrough + dtEps }).components.uR;

const dur_dt_trough = (uR_next_tr[0] - uR_prev_tr[0]) / (2.0 * dtEps);
assert(uR_trough[2] < 0.0, `At trough time, vertical displacement u_z is negative (u_z = ${uR_trough[2].toExponential(3)} m)`);
assert(dur_dt_trough > 0.0, `At wave trough, horizontal particle velocity d(u_r)/dt is positive (prograde forward motion: ${dur_dt_trough.toExponential(3)} m/s)`);

// ----------------------------------------------------------------------------
// Test Group 7: Double-Couple Radiation Pattern Verification
// ----------------------------------------------------------------------------
console.log('\n--- Test Group 7: Double-Couple Radiation Pattern ---');

// Pure strike-slip fault: strike 0°, dip 90°, rake 0°
const strikeSlipSource = new SeismicSourceModel({
  focalMechanism: { strikeDeg: 0.0, dipDeg: 90.0, rakeDeg: 0.0, isVerified: true }
});

// Azimuths: 45° (compression lobe maximum), 135° (dilatation lobe maximum), 0° and 90° (nodes = 0)
const takeoff = Math.PI / 2.0; // Horizontal ray
const rad45 = strikeSlipSource.evaluateDoubleCoupleRadiation((45 * Math.PI) / 180.0, takeoff);
const rad135 = strikeSlipSource.evaluateDoubleCoupleRadiation((135 * Math.PI) / 180.0, takeoff);
const rad0 = strikeSlipSource.evaluateDoubleCoupleRadiation(0.0, takeoff);
const rad90 = strikeSlipSource.evaluateDoubleCoupleRadiation((90 * Math.PI) / 180.0, takeoff);

assert(rad45.pFactor > 0.9, `Azimuth 45° is compression quadrant maximum: ${rad45.pFactor.toFixed(3)}`);
assert(rad135.pFactor < -0.9, `Azimuth 135° is dilatation quadrant maximum: ${rad135.pFactor.toFixed(3)}`);
assert(Math.abs(rad0.pFactor) < 1e-6, `Azimuth 0° is fault strike node: ${rad0.pFactor.toExponential(3)}`);
assert(Math.abs(rad90.pFactor) < 1e-6, `Azimuth 90° is auxiliary plane node: ${rad90.pFactor.toExponential(3)}`);

// Historical 1681 Yangyang fallback (isotropic mode)
const radYangyang = yangyangSource.evaluateDoubleCoupleRadiation((45 * Math.PI) / 180.0, takeoff);
assert(radYangyang.isIsotropicFallback === true, '1681 Yangyang correctly falls back to isotropic mode without fake lobes');
assert(radYangyang.pFactor === 1.0, '1681 Yangyang isotropic factor is 1.0');
assert(radYangyang.status === RadiationPatternStatus.AZIMUTHALLY_NEUTRAL_VISUAL_APPROXIMATION, '1681 Yangyang radiation status evaluates to AZIMUTHALLY_NEUTRAL_VISUAL_APPROXIMATION');

// ----------------------------------------------------------------------------
// Test Group 8: Physical vs Artistic Displacement Separation
// ----------------------------------------------------------------------------
console.log('\n--- Test Group 8: Physical vs Artistic Displacement Separation ---');

const testPoint = { obsE_m: 10000.0, obsN_m: 10000.0, obsU_m: 50.0, timeSec: 15.0 };
const dispEval = engine.evaluateVectorDisplacement(testPoint);

const phys = dispEval.physicalDisplacement;
const art = dispEval.artisticDisplacement;

assert(Array.isArray(phys) && phys.length === 3, 'Physical displacement is 3D vector [ux, uy, uz]');
assert(Array.isArray(art) && art.length === 3, 'Artistic displacement is 3D vector [vx, vy, vz]');
assert(Math.abs(art[0] - phys[0] * engine.artisticGain) < 1e-6, 'Artistic displacement cleanly scales by artisticGain without modifying physical meters');

console.log('\n====================================================================');
console.log(`PHASE C WAVEFIELD UNIT TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
console.log('====================================================================\n');

if (failed > 0) {
  Deno.exit(1);
}
