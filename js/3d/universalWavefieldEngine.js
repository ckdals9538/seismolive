// ============================================================================
// SEISMOLIVE v4.0 — Universal Wavefield Engine (C2: Wavefield Physics)
// File: js/3d/universalWavefieldEngine.js
// ============================================================================

import { SeismicSourceModel, REFERENCE_CRUSTAL_VELOCITY } from './seismicSourceModel.js';

/**
 * Universal Wavefield Engine
 * Computes 3D Vector Displacement Field u(x, t) = uP(x, t) + uS(x, t) + uR(x, t)
 * with singularity-free geometrical spreading, frequency-dependent attenuation,
 * and rigorous longitudinal/transverse/elliptical polarizations.
 */
export class UniversalWavefieldEngine {
  /**
   * @param {SeismicSourceModel} sourceModel
   * @param {Object} [options]
   */
  constructor(sourceModel, options = {}) {
    this.source = sourceModel || new SeismicSourceModel();
    this.velocityModel = this.source.velocityModel || REFERENCE_CRUSTAL_VELOCITY;
    
    // Physical Parameters
    this.vP = this.velocityModel.vP_km_s * 1000.0; // m/s
    this.vS = this.velocityModel.vS_km_s * 1000.0; // m/s
    this.vR = this.velocityModel.vRayleigh_km_s * 1000.0; // m/s
    
    // NUMERICAL_REGULARIZATION_PARAMETER (Singularity Guard)
    // R0 is a Plummer-type numerical regularization radius to prevent 1/R division-by-zero
    // divergence at hypocenter (R -> 0). It is NOT an observed physical fault radius.
    const sourceDim = this.source.finiteFault ? Math.max(2500.0, this.source.finiteFault.widthKm * 500.0) : 2500.0;
    this.r0_body = sourceDim;       // meters (numerical regularization)
    this.r0_body_status = 'NUMERICAL_REGULARIZATION_PARAMETER';
    this.delta0_surf = sourceDim * 1.2; // meters (numerical regularization)
    this.delta0_surf_status = 'NUMERICAL_REGULARIZATION_PARAMETER';

    // Rayleigh wave surface ellipticity ratio status
    this.ellipticityRatio = 1.47;
    this.ellipticityStatus = 'REFERENCE_APPROXIMATION';

    // Dominant source frequency for kinetic wavefield rendering
    // M~7: ~0.2-0.5 Hz; M~5.5: ~1.0-2.0 Hz
    const mag = this.source.magnitude ?? 6.5;
    this.dominantFreqHz = Math.max(0.15, Math.min(2.5, 1.8 * Math.pow(10.0, -0.22 * (mag - 5.0))));

    // Artistic visual modulation scale (kept separate from physical meters!)
    this.artisticGain = options.artisticGain ?? 1.8;
  }

  /**
   * Evaluate travel-time field (Eikonal Ray Isochrone) at an arbitrary observation point
   * @param {number} dist3D_m - 3D Euclidean distance from hypocenter (meters)
   * @param {number} epicentralDist_m - 2D Horizontal distance along ellipsoid (meters)
   * @param {number} hypocenterDepth_m - Hypocenter depth (meters)
   * @returns {{ tP: number, tS: number, tR: number }} Travel times in seconds
   */
  evaluateTravelTimes(dist3D_m, epicentralDist_m, hypocenterDepth_m) {
    // Eikonal Ray Arrival Time calculations:
    const tP = dist3D_m / this.vP;
    const tS = dist3D_m / this.vS;
    
    // Rayleigh surface wave generation requires energy to reach the surface,
    // plus propagation along the free surface at vR:
    const surfaceExcitationDelay = hypocenterDepth_m / this.vS;
    const tR = surfaceExcitationDelay + (epicentralDist_m / this.vR);

    return { tP, tS, tR };
  }

  /**
   * Evaluate Singularity-Free Geometrical Spreading
   * Uses Plummer/finite-source smoothed kernel: 1 / sqrt(R^2 + R0^2)
   * Prevents division-by-zero divergence at R -> 0 while preserving physical 1/R at distance
   */
  evaluateGeometricalSpreading(dist3D_m, epicentralDist_m) {
    // Body wave spherical spreading (finite source regularization)
    const spreadingBody = 1.0 / Math.sqrt(dist3D_m * dist3D_m + this.r0_body * this.r0_body);

    // Surface wave cylindrical 2D spreading: 1 / (Delta^2 + Delta0^2)^(1/4)
    const spreadingSurf = 1.0 / Math.pow(epicentralDist_m * epicentralDist_m + this.delta0_surf * this.delta0_surf, 0.25);

    return { spreadingBody, spreadingSurf };
  }

  /**
   * Evaluate Frequency-Dependent Anelastic Attenuation:
   * A(R, f) = exp( - pi * f * R / (Q(f) * V) )
   * Q(f) = Q0 * (f / 1.0Hz)^alpha
   */
  evaluateAttenuation(dist3D_m, epicentralDist_m) {
    const f = this.dominantFreqHz;
    const fRef = this.velocityModel.frequencyRefHz || 1.0;
    const freqFactor = Math.pow(f / fRef, this.velocityModel.qAlpha);

    const qP = Math.max(20.0, this.velocityModel.q0P * freqFactor);
    const qS = Math.max(15.0, this.velocityModel.q0S * freqFactor);
    const qR = Math.max(10.0, this.velocityModel.q0R * freqFactor);

    const attenP = Math.exp(- (Math.PI * f * dist3D_m) / (qP * this.vP));
    const attenS = Math.exp(- (Math.PI * f * dist3D_m) / (qS * this.vS));
    const attenR = Math.exp(- (Math.PI * f * epicentralDist_m) / (qR * this.vR));

    return { attenP, attenS, attenR, qP, qS, qR };
  }

  /**
   * Compute 3D Vector Displacement Field u(x, t) in local ENU / Surface frame
   *
   * @param {Object} params
   * @param {number} params.obsE_m - Observation point East coordinate (meters from epicenter)
   * @param {number} params.obsN_m - Observation point North coordinate (meters from epicenter)
   * @param {number} params.obsU_m - Observation point Up coordinate (meters elevation)
   * @param {number} params.timeSec - Seconds elapsed since seismic rupture initiation
   * @param {number[]} [params.surfaceNormal] - Unit surface normal [nx, ny, nz] (defaults to [0, 0, 1] in ENU)
   *
   * @returns {Object} 3D vector physical displacement and artistic visual displacement
   */
  evaluateVectorDisplacement(params) {
    const { obsE_m, obsN_m, obsU_m, timeSec } = params;
    const surfNormal = params.surfaceNormal || [0.0, 0.0, 1.0]; // Local Up

    const hypoDepth_m = this.source.hypocenter.depthKm * 1000.0;
    // Hypocenter in ENU: [0, 0, -hypoDepth_m]
    const dE = obsE_m;
    const dN = obsN_m;
    const dU = obsU_m - (-hypoDepth_m);

    const epicentralDist_m = Math.sqrt(dE * dE + dN * dN);
    const dist3D_m = Math.sqrt(dE * dE + dN * dN + dU * dU);

    // 1. Ray unit vector from hypocenter to observation point
    const invDist = 1.0 / Math.max(1e-4, dist3D_m);
    const k_hat = [dE * invDist, dN * invDist, dU * invDist];

    // Horizontal radial unit vector
    const invH = 1.0 / Math.max(1e-4, epicentralDist_m);
    const r_hat_h = [dE * invH, dN * invH, 0.0];

    // Transverse unit vector (theta_hat = cross(k_hat, up) or cross(z_hat, r_hat_h))
    const phi_hat = [-dN * invH, dE * invH, 0.0];

    // Station azimuth and takeoff angle
    const azimuthRad = Math.atan2(dE, dN); // Radians clockwise from North
    const takeoffAngleRad = Math.acos(Math.max(-1.0, Math.min(1.0, dU * invDist)));

    // 2. Double-Couple Radiation pattern
    const rad = this.source.evaluateDoubleCoupleRadiation(azimuthRad, takeoffAngleRad);

    // 3. Travel-time field (Eikonal)
    const { tP, tS, tR } = this.evaluateTravelTimes(dist3D_m, epicentralDist_m, hypoDepth_m);

    // 4. Singularity-free Spreading & Attenuation
    const { spreadingBody, spreadingSurf } = this.evaluateGeometricalSpreading(dist3D_m, epicentralDist_m);
    const { attenP, attenS, attenR } = this.evaluateAttenuation(dist3D_m, epicentralDist_m);

    // Base seismic moment scaling
    const mag = this.source.magnitude ?? 6.5;
    const m0_scale = Math.pow(10.0, 1.5 * mag + 9.0) * 1e-19; // Relative displacement amplitude (meters)

    // Waveform envelope parameters
    const omega = 2.0 * Math.PI * this.dominantFreqHz;

    // ------------------------------------------------------------------------
    // P-WAVE: Longitudinal Polarization (parallel to k_hat)
    // ------------------------------------------------------------------------
    let uP = [0.0, 0.0, 0.0];
    const dtP = timeSec - tP;
    if (dtP >= 0.0) {
      // Pulse duration ~ 2 full cycles with smooth causal onset & decay
      const pulseT = 2.0 / this.dominantFreqHz;
      if (dtP < pulseT * 3.0) {
        const env = Math.sin((Math.PI * dtP) / (pulseT * 3.0)) * Math.exp(-dtP / pulseT);
        const pOsc = Math.sin(omega * dtP);
        const ampP = m0_scale * rad.pFactor * spreadingBody * attenP * env * 1.2;
        uP = [
          ampP * k_hat[0],
          ampP * k_hat[1],
          ampP * k_hat[2]
        ];
      }
    }

    // ------------------------------------------------------------------------
    // S-WAVE: Transverse Polarization (perpendicular to k_hat, decomposed into SV & SH)
    // ------------------------------------------------------------------------
    let uS = [0.0, 0.0, 0.0];
    const dtS = timeSec - tS;
    if (dtS >= 0.0) {
      const pulseT = 2.5 / this.dominantFreqHz;
      if (dtS < pulseT * 3.5) {
        const env = Math.sin((Math.PI * dtS) / (pulseT * 3.5)) * Math.exp(-dtS / (pulseT * 1.2));
        const sOsc = Math.sin(omega * dtS + 0.5 * Math.PI);
        const ampSV = m0_scale * rad.svFactor * spreadingBody * attenS * env * 2.4;
        const ampSH = m0_scale * rad.shFactor * spreadingBody * attenS * env * 2.0;

        // SV polarization vector: perpendicular to k_hat in vertical-radial plane
        // sv_hat = cross(phi_hat, k_hat)
        const sv_hat = [
          phi_hat[1] * k_hat[2] - phi_hat[2] * k_hat[1],
          phi_hat[2] * k_hat[0] - phi_hat[0] * k_hat[2],
          phi_hat[0] * k_hat[1] - phi_hat[1] * k_hat[0]
        ];

        uS = [
          ampSV * sv_hat[0] + ampSH * phi_hat[0],
          ampSV * sv_hat[1] + ampSH * phi_hat[1],
          ampSV * sv_hat[2] + ampSH * phi_hat[2]
        ];
      }
    }

    // ------------------------------------------------------------------------
    // RAYLEIGH WAVE: Retrograde Elliptical Polarization
    // Combines horizontal radial motion (r_hat_h) and vertical motion (surfNormal) with 90° phase shift
    // ------------------------------------------------------------------------
    let uR = [0.0, 0.0, 0.0];
    const dtR = timeSec - tR;
    if (dtR >= 0.0) {
      const pulseT = 4.0 / this.dominantFreqHz;
      if (dtR < pulseT * 4.0) {
        const env = Math.sin((Math.PI * dtR) / (pulseT * 4.0)) * Math.exp(-dtR / (pulseT * 1.8));
        // Vertical-to-horizontal surface displacement ratio (chi ~ 1.47)
        // Theoretical value for an isotropic homogeneous Poisson half-space (nu = 0.25).
        // Classified as REFERENCE_APPROXIMATION (not a universal physical constant).
        const chi = this.ellipticityRatio;
        const ampR = m0_scale * spreadingSurf * attenR * env * 3.5;

        // Retrograde elliptical particle motion sign verification:
        // With wave propagating along +r_hat_h and surfNormal as +z (Up),
        // at the wave crest (vertOsc = +1, u_z > 0), the particle moves backward (d(radOsc)/dt < 0, towards -r_hat_h).
        // Setting radOsc = cos(omega * dtR) and vertOsc = +sin(omega * dtR):
        // At dtR = T/4 (omega*dtR = pi/2): vertOsc = +1 (crest), d(radOsc)/dt = -omega*sin(pi/2) = -omega < 0 (moving backwards).
        // At dtR = 3T/4 (omega*dtR = 3pi/2): vertOsc = -1 (trough), d(radOsc)/dt = -omega*sin(3pi/2) = +omega > 0 (moving forward).
        const radOsc = Math.cos(omega * dtR);
        const vertOsc = Math.sin(omega * dtR);

        uR = [
          ampR * radOsc * r_hat_h[0],
          ampR * radOsc * r_hat_h[1],
          ampR * chi * vertOsc * surfNormal[2]
        ];
      }
    }

    // Total 3D Physical Vector Displacement: u(x, t) = uP + uS + uR
    const uTotalPhysical_m = [
      uP[0] + uS[0] + uR[0],
      uP[1] + uS[1] + uR[1],
      uP[2] + uS[2] + uR[2]
    ];

    // Separate Artistic Visual Transformation (Scaled for sublime perceptual clarity)
    const uArtistic = [
      uTotalPhysical_m[0] * this.artisticGain,
      uTotalPhysical_m[1] * this.artisticGain,
      uTotalPhysical_m[2] * this.artisticGain
    ];

    return {
      physicalDisplacement: uTotalPhysical_m,
      artisticDisplacement: uArtistic,
      components: { uP, uS, uR },
      travelTimes: { tP, tS, tR },
      isochrones: {
        pArrived: timeSec >= tP,
        sArrived: timeSec >= tS,
        rArrived: timeSec >= tR
      },
      waveState: {
        dist3D_km: dist3D_m / 1000.0,
        epicentralDist_km: epicentralDist_m / 1000.0,
        dominantFreqHz: this.dominantFreqHz,
        velocityModelName: this.velocityModel.name,
        velocityModelStatus: this.velocityModel.status
      }
    };
  }
}
