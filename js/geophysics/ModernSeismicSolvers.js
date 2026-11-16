// ============================================================================
// SEISMOLIVE v4.0 — Modern Instrumental Seismology Solvers
// Modules:
//   1. Brune (1970) Source Parameter Inversion & Path Attenuation (t*)
//   2. STA/LTA Detection & Maeda (1985) AR-AIC P/S Phase Onset Refinement
//   3. Three-Component Rotation (Z-R-T) & Jurkevics (1988) 3D Polarization
//   4. Relocated Aftershock PCA Fault Plane ODR & Quality Diagnostics
//   5. Waveform Ingestion Architecture & Provenance Metadata Container
// ============================================================================

/**
 * ----------------------------------------------------------------------------
 * 1. Brune (1970) / Madariaga (1976) Source Parameter Inversion
 * ----------------------------------------------------------------------------
 *
 * Physical Units:
 *   - omega0: Low-frequency spectral displacement plateau [m·s] (or [m/Hz])
 *   - fc: Spectral corner frequency [Hz]
 *   - vsKmS: S-wave velocity at hypocenter [km/s] (default 3.50 km/s = 3500 m/s)
 *   - hypoDistKm: 3D Hypocentral distance R [km] (default 20.0 km = 20,000 m)
 *   - densityKgM3: Crustal density rho [kg/m³] (default 2700 kg/m³)
 *   - radiationCoeff: S-wave radiation pattern spatial average R_theta_phi (default 0.60)
 *   - freeSurfaceAmp: Free-surface reflection amplification factor F_S (default 2.0)
 *   - qFactor: Medium quality factor Q for path anelastic attenuation (optional, null if pre-corrected)
 *   - freqRefHz: Reference frequency for Q correction (default 1.0 Hz)
 *
 * Attenuation Formulation:
 *   Travel time: t = R / Vs
 *   Attenuation parameter: t* = t / Q = R / (Q * Vs)
 *   Correction factor: Omega0_corr = Omega0_raw * exp(pi * f_ref * t*)
 *
 * Scientific Inversion Logic:
 *   - M0 is derived from Omega0 (spectral plateau).
 *   - Mw is derived from M0 via Hanks & Kanamori (1979).
 *   - Rupture radius r is derived from fc via Madariaga (1976).
 *   - Stress drop Delta Sigma is derived from M0 and r^3 (Eshelby 1957).
 *   - CRITICAL: fc and Mw are mathematically and observationally independent.
 */

/**
 * Calculate path attenuation parameter t* [seconds]
 * @param {number} hypoDistKm - Hypocentral distance [km]
 * @param {number} vsKmS - Shear wave velocity [km/s]
 * @param {number} qFactor - Dimensionless quality factor Q
 * @returns {number} t* in seconds
 */
export function computePathAttenuationTStar(hypoDistKm, vsKmS, qFactor) {
  if (!qFactor || qFactor <= 0) return 0.0;
  const travelTimeSec = (hypoDistKm * 1000.0) / (vsKmS * 1000.0);
  return travelTimeSec / qFactor;
}

/**
 * Invert Brune source parameters
 * @param {Object} params
 * @returns {Object}
 */
export function invertBruneSourceParams(params) {
  const {
    omega0,
    fc,
    vsKmS = 3.5,
    hypoDistKm = 20.0,
    densityKgM3 = 2700.0,
    radiationCoeff = 0.6,
    freeSurfaceAmp = 2.0,
    qFactor = null,
    freqRefHz = 1.0
  } = params;

  if (omega0 == null || omega0 <= 0 || !Number.isFinite(omega0)) {
    throw new Error(`[ModernSeismicSolvers] Invalid omega0: ${omega0}. Must be positive finite number in [m·s].`);
  }
  if (fc == null || fc <= 0 || !Number.isFinite(fc)) {
    throw new Error(`[ModernSeismicSolvers] Invalid fc: ${fc}. Must be positive finite number in [Hz].`);
  }

  const vs_m_s = vsKmS * 1000.0;
  const dist_m = hypoDistKm * 1000.0;

  // Q attenuation correction: Omega0_corr = Omega0_raw * exp(pi * f_ref * t*)
  const tStarSec = computePathAttenuationTStar(hypoDistKm, vsKmS, qFactor);
  const qCorrectionFactor = Math.exp(Math.PI * freqRefHz * tStarSec);
  const omega0Corr = omega0 * qCorrectionFactor;

  // 1. Seismic Moment: M0 = (4 * pi * rho * Vs^3 * R * Omega0_corr) / (R_theta_phi * F_S)
  // [kg/m³] * [m³/s³] * [m] * [m·s] / [dimensionless] = [kg·m²/s²] = [N·m]
  const m0 = (4.0 * Math.PI * densityKgM3 * Math.pow(vs_m_s, 3) * dist_m * omega0Corr) / (radiationCoeff * freeSurfaceAmp);

  // 2. Moment Magnitude: Hanks & Kanamori (1979) standard: Mw = (2/3) * (log10(M0) - 9.1)
  const mw = (2.0 / 3.0) * (Math.log10(Math.max(1.0, m0)) - 9.1);

  // 3. Circular Rupture Radius: Madariaga (1976) dynamic shear crack: r = (2.34 * Vs) / (2 * pi * fc)
  const kMadariaga = 2.34;
  const ruptureRadiusM = (kMadariaga * vs_m_s) / (2.0 * Math.PI * fc);
  const ruptureRadiusKm = ruptureRadiusM / 1000.0;

  // 4. Static Stress Drop: Eshelby (1957) circular crack: Delta Sigma = (7/16) * (M0 / r^3)
  const stressDropPa = (7.0 / 16.0) * (m0 / Math.pow(ruptureRadiusM, 3));
  const stressDropMPa = stressDropPa / 1e6;
  const stressDropBar = stressDropMPa * 10.0;

  return {
    inputParams: {
      omega0Raw: omega0,
      omega0Corrected: omega0Corr,
      fcHz: fc,
      vsKmS,
      hypoDistKm,
      densityKgM3,
      radiationCoeff,
      freeSurfaceAmp,
      qFactor,
      freqRefHz,
      tStarSec: Number(tStarSec.toFixed(5)),
      qCorrectionFactor: Number(qCorrectionFactor.toFixed(4))
    },
    seismicMomentNm: m0,
    momentMagnitudeMw: Number(mw.toFixed(2)),
    ruptureRadiusKm: Number(ruptureRadiusKm.toFixed(3)),
    stressDropMPa: Number(stressDropMPa.toFixed(2)),
    stressDropBar: Number(stressDropBar.toFixed(1)),
    spectralEquations: {
      tStar: "t^* = \\frac{R}{Q V_S} = \\frac{t_{\\text{travel}}}{Q}",
      qCorrection: "\\Omega_0^{\\text{corr}} = \\Omega_0^{\\text{raw}} \\exp(\\pi f_{\\text{ref}} t^*)",
      m0: "M_0 = \\frac{4\\pi \\rho V_S^3 R \\Omega_0^{\\text{corr}}}{\\mathcal{R}_{\\theta\\phi} F_S}",
      mw: "M_w = \\frac{2}{3} (\\log_{10} M_0 - 9.1)",
      radius: "r = \\frac{2.34 V_S}{2\\pi f_c}",
      stressDrop: "\\Delta \\sigma = \\frac{7}{16} \\frac{M_0}{r^3}"
    }
  };
}

/**
 * ----------------------------------------------------------------------------
 * 2. STA/LTA Event Triggering & Maeda (1985) AR-AIC P/S Phase Onset Refinement
 * ----------------------------------------------------------------------------
 */

/**
 * Standard 1-Pole Highpass Filter for Baseline Drift & Microseismic Noise Removal
 * y[i] = alpha * (y[i-1] + x[i] - x[i-1])
 *
 * @param {Float32Array|number[]} waveform - Input trace
 * @param {number} dt - Sampling interval [s]
 * @param {number} [cutoffHz=1.0] - Corner frequency [Hz]
 * @returns {Float32Array} Filtered trace
 */
export function applyHighpassFilter(waveform, dt, cutoffHz = 1.0) {
  const n = waveform.length;
  const out = new Float32Array(n);
  const rc = 1.0 / (2.0 * Math.PI * cutoffHz);
  const alpha = rc / (rc + dt);

  out[0] = waveform[0];
  for (let i = 1; i < n; i++) {
    out[i] = alpha * (out[i - 1] + waveform[i] - waveform[i - 1]);
  }
  return out;
}

/**
 * Classic recursive STA/LTA energy ratio
 * @param {Float32Array|number[]} waveform
 * @param {number} dt
 * @param {number} [staSec=0.2]
 * @param {number} [ltaSec=2.0]
 * @returns {Float32Array}
 */
export function computeSTALTA(waveform, dt, staSec = 0.2, ltaSec = 2.0) {
  const n = waveform.length;
  const staLen = Math.max(1, Math.round(staSec / dt));
  const ltaLen = Math.max(staLen + 1, Math.round(ltaSec / dt));
  const ratio = new Float32Array(n);

  let staSum = 0.0;
  let ltaSum = 0.0;

  for (let i = 0; i < ltaLen && i < n; i++) {
    const valSq = waveform[i] * waveform[i];
    ltaSum += valSq;
    if (i >= ltaLen - staLen) {
      staSum += valSq;
    }
  }

  for (let i = ltaLen; i < n; i++) {
    const newValSq = waveform[i] * waveform[i];
    const oldStaValSq = waveform[i - staLen] * waveform[i - staLen];
    const oldLtaValSq = waveform[i - ltaLen] * waveform[i - ltaLen];

    staSum += newValSq - oldStaValSq;
    ltaSum += newValSq - oldLtaValSq;

    const sta = staSum / staLen;
    const lta = Math.max(1e-14, ltaSum / ltaLen);
    ratio[i] = sta / lta;
  }

  return ratio;
}

/**
 * Detect event trigger activation and deactivation intervals
 * @param {Float32Array} staLtaRatio
 * @param {number} dt
 * @param {number} [triggerThreshold=3.5]
 * @param {number} [detriggerThreshold=1.5]
 * @returns {Object}
 */
export function detectEventTrigger(staLtaRatio, dt, triggerThreshold = 3.5, detriggerThreshold = 1.5) {
  const n = staLtaRatio.length;
  const triggers = [];
  let isTriggered = false;
  let currentOnIdx = -1;

  for (let i = 0; i < n; i++) {
    const r = staLtaRatio[i];
    if (!isTriggered && r >= triggerThreshold) {
      isTriggered = true;
      currentOnIdx = i;
    } else if (isTriggered && r < detriggerThreshold) {
      isTriggered = false;
      triggers.push({
        onIdx: currentOnIdx,
        offIdx: i,
        onSec: currentOnIdx * dt,
        offSec: i * dt
      });
    }
  }

  if (isTriggered) {
    triggers.push({
      onIdx: currentOnIdx,
      offIdx: n - 1,
      onSec: currentOnIdx * dt,
      offSec: (n - 1) * dt
    });
  }

  const firstTrigger = triggers.length > 0 ? triggers[0] : null;
  return {
    triggerIndex: firstTrigger ? firstTrigger.onIdx : null,
    triggerTimeSec: firstTrigger ? firstTrigger.onSec : null,
    triggers
  };
}

/**
 * Maeda (1985) Autoregressive Akaike Information Criterion (AR-AIC) Phase Onset Picker
 * Evaluates the point of minimum information entropy separating pre-arrival noise from arrival signal.
 *
 * AIC(k) = k * log(var(x[1..k])) + (N - k - 1) * log(var(x[k+1..N]))
 *
 * @param {Float32Array|number[]} waveform - Seismogram trace
 * @param {number} dt - Sampling interval [s]
 * @param {number} triggerIdx - Index where trigger occurred
 * @param {Object} [options]
 * @param {number} [options.searchPreSec=1.5] - Pre-trigger search window [s]
 * @param {number} [options.searchPostSec=0.5] - Post-trigger search window [s]
 * @returns {{ onsetIndex: number, onsetTimeSec: number, latencySec: number, method: string }}
 */
export function refinePhaseArrivalAIC(waveform, dt, triggerIdx, options = {}) {
  const { searchPreSec = 1.5, searchPostSec = 0.5 } = options;
  const preLen = Math.round(searchPreSec / dt);
  const postLen = Math.round(searchPostSec / dt);

  const startIdx = Math.max(2, triggerIdx - preLen);
  const endIdx = Math.min(waveform.length - 3, triggerIdx + postLen);
  const windowLen = endIdx - startIdx + 1;

  if (windowLen < 10) {
    return {
      onsetIndex: triggerIdx,
      onsetTimeSec: triggerIdx * dt,
      latencySec: 0.0,
      method: "FALLBACK_TRIGGER_DUE_TO_SHORT_WINDOW"
    };
  }

  const x = new Float64Array(windowLen);
  for (let i = 0; i < windowLen; i++) {
    x[i] = waveform[startIdx + i];
  }

  let minAIC = Infinity;
  let bestK = Math.floor(windowLen / 2);

  // Prefix sums for O(N) evaluation of running variance
  const prefSum = new Float64Array(windowLen + 1);
  const prefSumSq = new Float64Array(windowLen + 1);
  for (let i = 0; i < windowLen; i++) {
    prefSum[i + 1] = prefSum[i] + x[i];
    prefSumSq[i + 1] = prefSumSq[i] + x[i] * x[i];
  }

  for (let k = 3; k < windowLen - 3; k++) {
    const sum1 = prefSum[k];
    const sumSq1 = prefSumSq[k];
    const mean1 = sum1 / k;
    const var1 = Math.max(1e-18, (sumSq1 / k) - mean1 * mean1);

    const len2 = windowLen - k;
    const sum2 = prefSum[windowLen] - prefSum[k];
    const sumSq2 = prefSumSq[windowLen] - prefSumSq[k];
    const mean2 = sum2 / len2;
    const var2 = Math.max(1e-18, (sumSq2 / len2) - mean2 * mean2);

    const aic = k * Math.log(var1) + (windowLen - k - 1) * Math.log(var2);
    if (aic < minAIC) {
      minAIC = aic;
      bestK = k;
    }
  }

  const onsetIndex = startIdx + bestK;
  const onsetTimeSec = onsetIndex * dt;
  const latencySec = (triggerIdx - onsetIndex) * dt;

  return {
    onsetIndex,
    onsetTimeSec: Number(onsetTimeSec.toFixed(4)),
    latencySec: Number(latencySec.toFixed(4)),
    method: "MAEDA_1985_AIC_MINIMUM"
  };
}

/**
 * ----------------------------------------------------------------------------
 * 3. Three-Component Rotation (Z-R-T) & Jurkevics (1988) 3D Polarization
 * ----------------------------------------------------------------------------
 *
 * Coordinate & Sign Conventions:
 *   - Z: Vertical (positive UP)
 *   - N: North (geographic North 000°)
 *   - E: East (geographic East 090°)
 *   - backAzimuthDeg (theta_BA): Azimuth from station to epicenter [0°, 360°)
 *   - epicentralAzimuthDeg (theta_AZ): Azimuth from epicenter to station:
 *       theta_AZ = (theta_BA + 180°) % 360°
 *
 * Radial Component (R):
 *   Directed along the ray path AWAY from the epicenter:
 *     R(t) = -N(t) * cos(theta_BA) - E(t) * sin(theta_BA)
 *          =  N(t) * cos(theta_AZ) + E(t) * sin(theta_AZ)
 *
 * Transverse Component (T):
 *   Convention A (ObsPy / SAC standard default, 'RIGHT_HANDED_Z_DOWN' or 'OBSPY_RIGHT'):
 *     Points to the right looking away from epicenter (clockwise by 90° from R):
 *     T_right(t) = N(t) * sin(theta_BA) - E(t) * cos(theta_BA)
 *     In Geographic (E, N, Z_up): R_hat x T_right_hat = -Z_up (Z_down).
 *
 *   Convention B ('RIGHT_HANDED_Z_UP' or 'AKI_RICHARDS_LEFT'):
 *     Points to the left looking away from epicenter (counter-clockwise by 90° from R):
 *     T_left(t) = -T_right(t) = -N(t) * sin(theta_BA) + E(t) * cos(theta_BA)
 *     In Geographic (E, N, Z_up): R_hat x T_left_hat = +Z_up (Right-handed Cartesian).
 */

/**
 * Rotate N and E horizontal seismograms into Radial (R) and Transverse (T) components
 *
 * @param {Float32Array|number[]} nComp - North component
 * @param {Float32Array|number[]} eComp - East component
 * @param {number} backAzimuthDeg - Station-to-epicenter back-azimuth [0°, 360°)
 * @param {Object} [options]
 * @param {string} [options.transverseConvention='OBSPY_RIGHT'] - 'OBSPY_RIGHT' or 'RIGHT_HANDED_Z_UP'
 * @returns {{ radial: Float32Array, transverse: Float32Array, convention: string, epicentralAzimuthDeg: number }}
 */
export function rotateZNEtoZRT(nComp, eComp, backAzimuthDeg, options = {}) {
  const convention = options.transverseConvention || 'OBSPY_RIGHT';
  const len = Math.min(nComp.length, eComp.length);
  const thetaBA = (backAzimuthDeg * Math.PI) / 180.0;
  const cosT = Math.cos(thetaBA);
  const sinT = Math.sin(thetaBA);

  const radial = new Float32Array(len);
  const transverse = new Float32Array(len);

  const isLeftHandedZUp = convention === 'RIGHT_HANDED_Z_UP';

  for (let i = 0; i < len; i++) {
    // Radial: always pointing away from epicenter
    radial[i] = -nComp[i] * cosT - eComp[i] * sinT;

    if (isLeftHandedZUp) {
      // Points left of R: R x T_left = +Z_up
      transverse[i] = -nComp[i] * sinT + eComp[i] * cosT;
    } else {
      // ObsPy/SAC default: points right of R: R x T_right = -Z_up (Z_down)
      transverse[i] = nComp[i] * sinT - eComp[i] * cosT;
    }
  }

  const epicentralAzimuthDeg = (backAzimuthDeg + 180.0) % 360.0;

  return {
    radial,
    transverse,
    convention,
    backAzimuthDeg,
    epicentralAzimuthDeg
  };
}

/**
 * Jurkevics (1988) 3D polarization analysis using covariance matrix eigensystem
 *
 * @param {Object} components - { z, r, t } or { z, n, e }
 * @param {number} [startIdx=0]
 * @param {number} [windowLen=null]
 * @returns {Object}
 */
export function computeJurkevicsPolarization(components, startIdx = 0, windowLen = null) {
  const z = components.z || components.vertical;
  const r = components.r || components.radial || components.n;
  const t = components.t || components.transverse || components.e;

  const n = windowLen != null ? Math.min(windowLen, z.length - startIdx) : z.length - startIdx;
  if (n < 4) {
    return { rectilinearity: 0.0, planarity: 0.0, status: "INSUFFICIENT_WINDOW" };
  }

  let meanZ = 0, meanR = 0, meanT = 0;
  for (let i = 0; i < n; i++) {
    meanZ += z[startIdx + i];
    meanR += r[startIdx + i];
    meanT += t[startIdx + i];
  }
  meanZ /= n; meanR /= n; meanT /= n;

  let czz = 0, crr = 0, ctt = 0;
  let czr = 0, czt = 0, crt = 0;

  for (let i = 0; i < n; i++) {
    const dz = z[startIdx + i] - meanZ;
    const dr = r[startIdx + i] - meanR;
    const dt = t[startIdx + i] - meanT;

    czz += dz * dz;
    crr += dr * dr;
    ctt += dt * dt;
    czr += dz * dr;
    czt += dz * dt;
    crt += dr * dt;
  }

  czz /= n; crr /= n; ctt /= n;
  czr /= n; czt /= n; crt /= n;

  const eigenvalues = solveSymmetric3x3Eigenvalues([
    [czz, czr, czt],
    [czr, crr, crt],
    [czt, crt, ctt]
  ]);

  const l1 = eigenvalues[0];
  const l2 = eigenvalues[1];
  const l3 = eigenvalues[2];

  const rectilinearity = l1 > 1e-16 ? 1.0 - (l2 + l3) / (2.0 * l1) : 0.0;
  const planarity = (l1 + l2) > 1e-16 ? 1.0 - (2.0 * l3) / (l1 + l2) : 0.0;

  return {
    rectilinearity: Number(Math.max(0.0, Math.min(1.0, rectilinearity)).toFixed(4)),
    planarity: Number(Math.max(0.0, Math.min(1.0, planarity)).toFixed(4)),
    eigenvalues: [Number(l1.toExponential(3)), Number(l2.toExponential(3)), Number(l3.toExponential(3))]
  };
}

/**
 * 3D Particle Motion Hodogram Builder
 * Produces interleaved [x, y, z] buffer for Three.js Line or Particle system
 * Mapping: X = East, Y = Up, Z = North (Three.js standard Y-up coordinate system)
 *
 * @param {Object} components - { z: Float32Array, n: Float32Array, e: Float32Array }
 * @param {number} backAzimuthDeg
 * @param {Object} [windowOptions] - Optional { startIdx, length, transverseConvention }
 * @returns {Object}
 */
export function analyze3DHodogram(components, backAzimuthDeg, windowOptions = {}) {
  const { z, n, e } = components;
  const start = windowOptions.startIdx || 0;
  const len = windowOptions.length != null
    ? Math.min(windowOptions.length, z.length - start, n.length - start, e.length - start)
    : Math.min(z.length - start, n.length - start, e.length - start);

  const { radial, transverse, convention } = rotateZNEtoZRT(n, e, backAzimuthDeg, windowOptions);
  const hodogram3D = new Float32Array(len * 3);

  for (let i = 0; i < len; i++) {
    const idx = start + i;
    // Three.js world frame: X=East, Y=Up, Z=North
    hodogram3D[i * 3 + 0] = e[idx];
    hodogram3D[i * 3 + 1] = z[idx];
    hodogram3D[i * 3 + 2] = n[idx];
  }

  const polWindow = computeJurkevicsPolarization({
    z: z.subarray(start, start + len),
    r: radial.subarray(start, start + len),
    t: transverse.subarray(start, start + len)
  });

  return {
    radial,
    transverse,
    vertical: z,
    hodogram3D,
    sampleCount: len,
    polarization: polWindow,
    backAzimuthDeg,
    convention
  };
}

/**
 * ----------------------------------------------------------------------------
 * 4. Relocated Aftershock PCA Fault Plane ODR & Quality Diagnostics
 * ----------------------------------------------------------------------------
 *
 * Post-Processing Role:
 *   - Receives 3D hypocenters [x: East, y: North, z: Depth down in km] from external hypoDD.
 *   - Computes 3D Orthogonal Distance Regression (ODR) plane via PCA.
 *   - Evaluates fault thickness (RMS residual), planarity ratio, and estimation confidence.
 */

/**
 * Fit a 3D planar fault model to relocated aftershock hypocenters using PCA/ODR
 *
 * @param {Array<{x: number, y: number, z: number}>} points - Hypocenters in km
 * @param {Object} [options]
 * @param {number} [options.hypocenterUncertaintyKm=0.05] - Estimated hypoDD relocation uncertainty (km)
 * @param {boolean} [options.trimOutliers=false] - Whether to trim top 10% residual outliers
 * @returns {Object}
 */
export function fitFaultPlaneFromAftershocks(points, options = {}) {
  if (!points || points.length < 3) {
    return {
      status: "INSUFFICIENT_POINTS",
      error: "At least 3 non-collinear aftershock hypocenters are required for 3D plane fitting."
    };
  }

  const hypoUncertaintyKm = options.hypocenterUncertaintyKm || 0.05;

  let workingPoints = points;
  let outliersRemoved = 0;

  // Function to solve plane for a given subset
  function solveODR(subset) {
    const n = subset.length;
    let cx = 0, cy = 0, cz = 0;
    for (let i = 0; i < n; i++) {
      cx += subset[i].x;
      cy += subset[i].y;
      cz += subset[i].z;
    }
    cx /= n; cy /= n; cz /= n;

    let cxx = 0, cxy = 0, cxz = 0;
    let cyy = 0, cyz = 0, czz = 0;
    for (let i = 0; i < n; i++) {
      const dx = subset[i].x - cx;
      const dy = subset[i].y - cy;
      const dz = subset[i].z - cz;
      cxx += dx * dx;
      cxy += dx * dy;
      cxz += dx * dz;
      cyy += dy * dy;
      cyz += dy * dz;
      czz += dz * dz;
    }
    cxx /= n; cxy /= n; cxz /= n;
    cyy /= n; cyz /= n; czz /= n;

    const covMatrix = [
      [cxx, cxy, cxz],
      [cxy, cyy, cyz],
      [cxz, cyz, czz]
    ];

    const { eigenvalues, eigenvectors } = solveSymmetric3x3EigenSystem(covMatrix);
    let normal = eigenvectors[2];

    if (normal[2] < 0) {
      normal = [-normal[0], -normal[1], -normal[2]];
    }

    const nx = normal[0];
    const ny = normal[1];
    const nz = normal[2];

    const dipRad = Math.acos(Math.max(0.0, Math.min(1.0, nz)));
    const dipDeg = (dipRad * 180.0) / Math.PI;

    // Right-Hand Rule strike: for downward-pointing normal (nz > 0),
    // dip is to the right of strike vector s = [sin(phi), cos(phi), 0]:
    // nx = -cos(phi)*sin(dip), ny = sin(phi)*sin(dip)
    // -> sin(phi) = ny/sin(dip), cos(phi) = -nx/sin(dip)
    // -> phi = atan2(ny, -nx)
    let strikeRad = Math.atan2(ny, -nx);
    let strikeDeg = (strikeRad * 180.0) / Math.PI;
    if (strikeDeg < 0) strikeDeg += 360.0;

    const residuals = new Float64Array(n);
    let sumDistSq = 0.0;
    for (let i = 0; i < n; i++) {
      const dx = subset[i].x - cx;
      const dy = subset[i].y - cy;
      const dz = subset[i].z - cz;
      const dist = dx * nx + dy * ny + dz * nz;
      residuals[i] = dist;
      sumDistSq += dist * dist;
    }
    const rmsResidualKm = Math.sqrt(sumDistSq / n);

    return {
      cx, cy, cz,
      nx, ny, nz,
      strikeDeg, dipDeg,
      rmsResidualKm,
      eigenvalues,
      residuals
    };
  }

  // Initial solve
  let sol = solveODR(workingPoints);

  // Optional 10% outlier trimming
  if (options.trimOutliers && workingPoints.length >= 10) {
    const indexed = workingPoints.map((pt, idx) => ({ pt, absRes: Math.abs(sol.residuals[idx]) }));
    indexed.sort((a, b) => a.absRes - b.absRes);
    const keepCount = Math.floor(workingPoints.length * 0.90);
    outliersRemoved = workingPoints.length - keepCount;
    workingPoints = indexed.slice(0, keepCount).map(item => item.pt);
    sol = solveODR(workingPoints);
  }

  // Diagnostic Ratios
  const l1 = sol.eigenvalues[0];
  const l2 = sol.eigenvalues[1];
  const l3 = sol.eigenvalues[2];

  // Planarity index: 1 - 2*l3 / (l1 + l2) [1.0 = perfect plane, 0.0 = spherical diffuse]
  const planarityIndex = (l1 + l2) > 1e-12
    ? 1.0 - (2.0 * l3) / (l1 + l2)
    : 0.0;

  // Thickness-to-length ratio: sqrt(l3 / l1)
  const thicknessRatio = l1 > 1e-12 ? Math.sqrt(Math.max(0.0, l3 / l1)) : 1.0;

  // Condition number: l1 / l3
  const conditionNumber = l3 > 1e-14 ? l1 / l3 : 1e6;

  // Dip Uncertainty Estimation (propagated from hypoDD location uncertainty):
  // delta_dip ~ arctan(hypoUncertainty / sqrt(l2)) in degrees
  const faultDimensionKm = Math.sqrt(l2);
  const dipUncertaintyDeg = faultDimensionKm > 1e-4
    ? (Math.atan(hypoUncertaintyKm / faultDimensionKm) * 180.0) / Math.PI
    : 45.0;

  const isCoplanar = planarityIndex > 0.40 && thicknessRatio < 0.25;

  return {
    status: "SUCCESS",
    centroidKm: { x: Number(sol.cx.toFixed(3)), y: Number(sol.cy.toFixed(3)), z: Number(sol.cz.toFixed(3)) },
    normalVector: [Number(sol.nx.toFixed(4)), Number(sol.ny.toFixed(4)), Number(sol.nz.toFixed(4))],
    strikeDeg: Number(sol.strikeDeg.toFixed(1)),
    dipDeg: Number(sol.dipDeg.toFixed(1)),
    rmsResidualKm: Number(sol.rmsResidualKm.toFixed(4)),
    rmsResidualMeters: Number((sol.rmsResidualKm * 1000.0).toFixed(1)),
    eigenvalues: [Number(l1.toFixed(4)), Number(l2.toFixed(4)), Number(l3.toFixed(4))],
    diagnostics: {
      planarityIndex: Number(planarityIndex.toFixed(3)),
      thicknessRatio: Number(thicknessRatio.toFixed(3)),
      conditionNumber: Number(conditionNumber.toFixed(1)),
      dipUncertaintyDeg: Number(dipUncertaintyDeg.toFixed(1)),
      hypoUncertaintyKm,
      isCoplanar,
      outliersRemoved
    },
    pointCount: workingPoints.length,
    method: "AFTERSHOCK_PCA_ORTHOGONAL_DISTANCE_REGRESSION"
  };
}

/**
 * ----------------------------------------------------------------------------
 * 5. Waveform Ingestion Architecture & Provenance Metadata Container
 * ----------------------------------------------------------------------------
 *
 * Designed schema to ingest real lab observational records (SAC / miniSEED).
 * Ensures raw data immutability, component pairing, and processing provenance.
 */

/**
 * Single Component Seismological Trace Container
 */
export class SeismologicalTrace {
  /**
   * @param {Object} meta
   */
  constructor(meta = {}) {
    this.network = meta.network || "KS";            // e.g. 'KS' (KMA), 'KG' (KIGAM)
    this.station = meta.station || "UNKNOWN";        // e.g. 'YND', 'USN'
    this.location = meta.location || "00";          // e.g. '00', '--'
    this.channel = meta.channel || "HHZ";           // e.g. 'HHZ', 'HHN', 'HHE'
    this.component = meta.component || "Z";         // 'Z', 'N', 'E'
    this.startTimeUTC = meta.startTimeUTC || null;  // ISO 8601 string
    this.sampleRateHz = meta.sampleRateHz || 100.0; // 100 Hz
    this.dt = 1.0 / this.sampleRateHz;

    // Time-series buffer
    this.samples = meta.samples instanceof Float32Array ? meta.samples : new Float32Array(meta.samples || []);
    this.sampleCount = this.samples.length;
    this.durationSec = this.sampleCount * this.dt;

    // Calibration & Units
    this.units = meta.units || "COUNTS"; // 'COUNTS', 'M/S', 'M/S2', 'M'
    this.sensitivity = meta.sensitivity || 1.0; // counts per physical unit
    this.hasResponseRemoved = meta.hasResponseRemoved ?? false;

    // Quality & Integrity
    this.qualityFlags = {
      isClipped: meta.isClipped ?? false,
      hasGaps: meta.hasGaps ?? false,
      maxAmplitude: this.evaluateMaxAmp(),
      checksumSHA256: meta.checksumSHA256 || null
    };

    // Immutable Provenance Log
    this.provenance = meta.provenance || [
      { step: "INGEST_RAW", timestamp: new Date().toISOString(), detail: "Initial trace instantiation" }
    ];
  }

  evaluateMaxAmp() {
    let maxA = 0.0;
    for (let i = 0; i < this.samples.length; i++) {
      const a = Math.abs(this.samples[i]);
      if (a > maxA) maxA = a;
    }
    return maxA;
  }

  recordProvenance(step, detail) {
    this.provenance.push({
      step,
      timestamp: new Date().toISOString(),
      detail
    });
  }
}

/**
 * 3-Component Seismic Station Packet (Z, N, E synchronized)
 */
export class SeismicStationPacket {
  /**
   * @param {Object} options
   */
  constructor(options = {}) {
    this.stationCode = options.stationCode || "UNKNOWN";
    this.latitude = options.latitude ?? null;
    this.longitude = options.longitude ?? null;
    this.elevationM = options.elevationM ?? 0.0;

    this.traceZ = options.traceZ || null;
    this.traceN = options.traceN || null;
    this.traceE = options.traceE || null;

    this.isSynchronized = this.verifySynchronization();
  }

  verifySynchronization() {
    if (!this.traceZ || !this.traceN || !this.traceE) return false;
    const sameLen = (this.traceZ.sampleCount === this.traceN.sampleCount) &&
                    (this.traceN.sampleCount === this.traceE.sampleCount);
    const sameRate = (this.traceZ.sampleRateHz === this.traceN.sampleRateHz) &&
                     (this.traceN.sampleRateHz === this.traceE.sampleRateHz);
    return sameLen && sameRate;
  }
}

/**
 * ----------------------------------------------------------------------------
 * Helper: Exact 3x3 Symmetric Matrix Eigenvalue & Eigenvector Solver
 * Using iterative Jacobi Rotations
 * ----------------------------------------------------------------------------
 */
export function solveSymmetric3x3EigenSystem(A_in) {
  const A = [
    [A_in[0][0], A_in[0][1], A_in[0][2]],
    [A_in[1][0], A_in[1][1], A_in[1][2]],
    [A_in[2][0], A_in[2][1], A_in[2][2]]
  ];

  const V = [
    [1, 0, 0],
    [0, 1, 0],
    [0, 0, 1]
  ];

  const maxIter = 50;
  for (let iter = 0; iter < maxIter; iter++) {
    let p = 0, q = 1;
    let maxOff = Math.abs(A[0][1]);
    if (Math.abs(A[0][2]) > maxOff) { maxOff = Math.abs(A[0][2]); p = 0; q = 2; }
    if (Math.abs(A[1][2]) > maxOff) { maxOff = Math.abs(A[1][2]); p = 1; q = 2; }

    if (maxOff < 1e-15) break;

    const theta = (A[q][q] - A[p][p]) / (2.0 * A[p][q]);
    const t = theta >= 0
      ? 1.0 / (theta + Math.sqrt(theta * theta + 1.0))
      : -1.0 / (-theta + Math.sqrt(theta * theta + 1.0));
    const c = 1.0 / Math.sqrt(t * t + 1.0);
    const s = t * c;

    const tau = s / (1.0 + c);
    const app = A[p][p];
    const aqq = A[q][q];
    const apq = A[p][q];

    A[p][p] = app - t * apq;
    A[q][q] = aqq + t * apq;
    A[p][q] = 0.0;
    A[q][p] = 0.0;

    for (let r = 0; r < 3; r++) {
      if (r !== p && r !== q) {
        const arp = A[r][p];
        const arq = A[r][q];
        A[r][p] = arp - s * (arq + tau * arp);
        A[p][r] = A[r][p];
        A[r][q] = arq + s * (arp - tau * arq);
        A[q][r] = A[r][q];
      }
    }

    for (let r = 0; r < 3; r++) {
      const vrp = V[r][p];
      const vrq = V[r][q];
      V[r][p] = vrp - s * (vrq + tau * vrp);
      V[r][q] = vrq + s * (vrp - tau * vrq);
    }
  }

  const pairs = [
    { val: A[0][0], vec: [V[0][0], V[1][0], V[2][0]] },
    { val: A[1][1], vec: [V[0][1], V[1][1], V[2][1]] },
    { val: A[2][2], vec: [V[0][2], V[1][2], V[2][2]] }
  ];

  pairs.sort((a, b) => b.val - a.val);

  return {
    eigenvalues: [pairs[0].val, pairs[1].val, pairs[2].val],
    eigenvectors: [pairs[0].vec, pairs[1].vec, pairs[2].vec]
  };
}

export function solveSymmetric3x3Eigenvalues(A) {
  const res = solveSymmetric3x3EigenSystem(A);
  return res.eigenvalues;
}
