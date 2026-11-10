// ============================================================================
// SEISMOLIVE v4.0 — Seismic Source Model (C1: Source Representation)
// File: js/3d/seismicSourceModel.js
// ============================================================================

/**
 * Velocity Model Provenance Status
 */
export const VelocityModelStatus = Object.freeze({
  OBSERVED_REGIONAL: 'OBSERVED_OR_PUBLISHED_REGIONAL_MODEL',
  REFERENCE_CRUSTAL: 'REFERENCE_CRUSTAL_MODEL',
  EDUCATIONAL_APPROXIMATION: 'EDUCATIONAL_APPROXIMATION',
  UNAVAILABLE: 'UNAVAILABLE'
});

/**
 * Radiation Pattern Provenance Status
 */
export const RadiationPatternStatus = Object.freeze({
  DOUBLE_COUPLE_VERIFIED: 'DOUBLE_COUPLE_VERIFIED',
  AZIMUTHALLY_NEUTRAL_VISUAL_APPROXIMATION: 'AZIMUTHALLY_NEUTRAL_VISUAL_APPROXIMATION'
});

/**
 * Reference Upper Crustal Velocity Model (IASPEI91 / AK135 Upper Crust Standard)
 * Used as standard 1D global radially symmetric reference model.
 * NOTE: This is a GLOBAL REFERENCE MODEL, not a calibrated local basin model.
 */
export const REFERENCE_CRUSTAL_VELOCITY = Object.freeze({
  name: 'Standard Upper Crust Reference Model (IASPEI91 / AK135)',
  status: VelocityModelStatus.REFERENCE_CRUSTAL,
  citation: 'Kennett & Engdahl (1991), Geophys. J. Int., 105(2), 429-465, DOI:10.1111/j.1365-246X.1991.tb06724.x',
  doi: '10.1111/j.1365-246X.1991.tb06724.x',
  depthRangeKm: [0.0, 20.0],
  vP_km_s: 5.80,         // P-wave speed: 5.80 km/s (5800 m/s)
  vS_km_s: 3.35,         // S-wave speed: 3.35 km/s (3350 m/s)
  vRayleigh_km_s: 3.08,  // Rayleigh wave speed: ~0.9194 * Vs = 3.08 km/s
  rayleighDerivation: 'REFERENCE_APPROXIMATION (Poisson solid half-space root vR ~ 0.9194 * vS)',
  vpVsRatio: 1.731,      // Poisson solid ratio
  density_kg_m3: 2700.0, // Density: 2.7 g/cm^3
  q0P: 350.0,            // P-wave Q at 1 Hz
  q0S: 200.0,            // S-wave Q at 1 Hz
  q0R: 150.0,            // Rayleigh wave Q at 1 Hz
  qAlpha: 0.5,           // Frequency exponent: Q(f) = Q0 * (f / 1.0Hz)^alpha
  frequencyRefHz: 1.0
});

/**
 * Regional Published Crustal Velocity Models
 */
export const REGIONAL_VELOCITY_MODELS = Object.freeze({
  // Korean Peninsula (Kim et al., 2011 / KIGAM Crustal Model)
  KOREA_PENINSULA: {
    name: 'KIGAM Korean Crustal Velocity Model (Kim et al. 2011)',
    status: VelocityModelStatus.OBSERVED_REGIONAL,
    citation: 'Kim, K.-Y., et al. (2011), Geosciences Journal, 15(4), 387-398, DOI:10.1007/s12303-011-0037-4; Chang & Baag (2006), BSSA, DOI:10.1785/0120060014',
    doi: '10.1007/s12303-011-0037-4',
    appliedRegion: 'Southern Korean Peninsula (Gyeongju, Pohang, Eastern Margin)',
    depthRangeKm: [0.0, 15.0], // Upper crust layer
    vP_km_s: 5.95,
    vS_km_s: 3.50,
    vRayleigh_km_s: 3.22,
    rayleighDerivation: 'REFERENCE_APPROXIMATION via Rayleigh root (vR ~ 0.92 * vS)',
    vpVsRatio: 1.70,
    density_kg_m3: 2720.0,
    q0P: 450.0,
    q0S: 250.0,
    q0R: 180.0,
    qAlpha: 0.6,
    frequencyRefHz: 1.0
  },
  // Kyushu Japan (JMA / NIED F-net Velocity Model)
  JAPAN_KYUSHU: {
    name: 'NIED Kyushu Crustal Velocity Model',
    status: VelocityModelStatus.OBSERVED_REGIONAL,
    citation: 'Kubo, T., et al. (2002), Tectonophysics, 356(1-3), 23-48, DOI:10.1016/S0040-1951(02)00375-X; Saiga et al. (2017), Earth Planets Space, 69:81, DOI:10.1186/s40623-017-0667-0',
    doi: '10.1016/S0040-1951(02)00375-X',
    appliedRegion: 'Kyushu, Japan (Kumamoto-Aso graben zone)',
    depthRangeKm: [0.0, 14.0], // Upper crust layer
    vP_km_s: 5.80,
    vS_km_s: 3.30,
    vRayleigh_km_s: 3.03,
    rayleighDerivation: 'REFERENCE_APPROXIMATION via Rayleigh root (vR ~ 0.918 * vS)',
    vpVsRatio: 1.758,
    density_kg_m3: 2680.0,
    q0P: 280.0,
    q0S: 150.0,
    q0R: 110.0,
    qAlpha: 0.45,
    frequencyRefHz: 1.0
  },
  // East Anatolian Fault Zone (AFAD / KOERI Turkey Model)
  TURKEY_ANATOLIA: {
    name: 'KOERI East Anatolian Crustal Model',
    status: VelocityModelStatus.OBSERVED_REGIONAL,
    citation: 'Karabulut, H., et al. (2011), Geophys. J. Int., DOI:10.1111/j.1365-246X.2011.05036.x; Bindi et al. (2023), Seismic Record, 3(2), 126-137, DOI:10.1785/0320230009',
    doi: '10.1111/j.1365-246X.2011.05036.x',
    appliedRegion: 'East Anatolian Fault Zone (Kahramanmaras - Malatya - Antakya)',
    depthRangeKm: [0.0, 15.0], // Upper crust layer
    vP_km_s: 6.00,
    vS_km_s: 3.45,
    vRayleigh_km_s: 3.17,
    rayleighDerivation: 'REFERENCE_APPROXIMATION via Rayleigh root (vR ~ 0.919 * vS)',
    vpVsRatio: 1.739,
    density_kg_m3: 2750.0,
    q0P: 220.0,
    q0S: 120.0,
    q0R: 90.0,
    qAlpha: 0.4,
    frequencyRefHz: 1.0
  }
});

/**
 * Source Representation Class
 * Handles Point Source, Double-Couple radiation, and Finite Fault geometry.
 * Strictly avoids inventing fake fault planes for historical or unverified events.
 */
export class SeismicSourceModel {
  /**
   * @param {Object} config
   */
  constructor(config = {}) {
    this.sourceType = config.sourceType || 'POINT_SOURCE'; // 'POINT_SOURCE' | 'FINITE_FAULT' | 'HISTORICAL_INFERRED'
    this.eventId = config.eventId || 'unspecified';
    
    // Hypocenter in WGS84 and depth
    this.hypocenter = {
      lat: config.lat ?? 0.0,
      lon: config.lon ?? 0.0,
      depthKm: config.depthKm ?? 10.0
    };

    // Focal Mechanism (Strike, Dip, Rake in degrees)
    // Nodal Plane 1 & Nodal Plane 2 ambiguity is preserved if unresolved
    this.focalMechanism = config.focalMechanism ? {
      strikeDeg: config.focalMechanism.strikeDeg,
      dipDeg: config.focalMechanism.dipDeg,
      rakeDeg: config.focalMechanism.rakeDeg,
      isVerified: config.focalMechanism.isVerified ?? false,
      rupturePlaneResolved: config.focalMechanism.rupturePlaneResolved ?? false,
      alternateNodalPlane: config.focalMechanism.alternateNodalPlane || null
    } : null;

    // Finite Fault Geometry (null for historical/unverified events!)
    this.finiteFault = config.finiteFault ? {
      lengthKm: config.finiteFault.lengthKm,
      widthKm: config.finiteFault.widthKm,
      topDepthKm: config.finiteFault.topDepthKm ?? 0.0,
      ruptureVelocityKmS: config.finiteFault.ruptureVelocityKmS ?? 2.8,
      strikeDeg: config.finiteFault.strikeDeg,
      dipDeg: config.finiteFault.dipDeg,
      rakeDeg: config.finiteFault.rakeDeg,
      directivity: config.finiteFault.directivity || 'BILATERAL', // 'UNILATERAL' | 'BILATERAL'
      isVerified: config.finiteFault.isVerified ?? false
    } : null;

    // Velocity Model Assignment
    this.velocityModel = config.velocityModel || REFERENCE_CRUSTAL_VELOCITY;

    // Magnitude & Uncertainty
    this.magnitude = config.magnitude ?? null;
    this.magnitudeScale = config.magnitudeScale || 'UNKNOWN';
    this.uncertainty = config.uncertainty || null;

    // Radiation Pattern Status & Provenance
    this.radiationStatus = config.radiationStatus || (this.focalMechanism?.isVerified ? RadiationPatternStatus.DOUBLE_COUPLE_VERIFIED : RadiationPatternStatus.AZIMUTHALLY_NEUTRAL_VISUAL_APPROXIMATION);
    this.radiationNote = config.radiationNote || (this.focalMechanism?.isVerified ? '관측된 단층면해 기반 Double-Couple 4분면 방사 패턴 적용.' : '방위각 중립적 시각화 근사 (Azimuthally Neutral Visual Approximation)');
  }

  /**
   * Calculate Double-Couple Radiation Pattern factor
   * @param {number} azimuthRad - Azimuth from epicenter to station/vertex (clockwise from North, in radians)
   * @param {number} takeoffAngleRad - Takeoff angle from hypocenter (from vertical downward, in radians)
   * @returns {{ pFactor: number, svFactor: number, shFactor: number }} Radiation amplitudes [-1.0, 1.0]
   */
  evaluateDoubleCoupleRadiation(azimuthRad, takeoffAngleRad) {
    if (!this.focalMechanism || !this.focalMechanism.isVerified) {
      // AZIMUTHALLY_NEUTRAL_VISUAL_APPROXIMATION:
      // Due to unrecorded historical focal mechanism, an azimuthally neutral 
      // visual approximation is applied. This is NOT an observed or reconstructed physical radiation pattern.
      return {
        pFactor: 1.0,
        svFactor: 1.0,
        shFactor: 1.0,
        status: RadiationPatternStatus.AZIMUTHALLY_NEUTRAL_VISUAL_APPROXIMATION,
        isIsotropicFallback: true
      };
    }

    const phiS = (this.focalMechanism.strikeDeg * Math.PI) / 180.0;
    const delta = (this.focalMechanism.dipDeg * Math.PI) / 180.0;
    const lambda = (this.focalMechanism.rakeDeg * Math.PI) / 180.0;

    // Relative azimuth: station azimuth minus fault strike
    const phi = azimuthRad - phiS;
    const ih = takeoffAngleRad;

    const sinL = Math.sin(lambda);
    const cosL = Math.cos(lambda);
    const sinD = Math.sin(delta);
    const cosD = Math.cos(delta);
    const sin2D = Math.sin(2.0 * delta);
    const cos2D = Math.cos(2.0 * delta);

    const sinIh = Math.sin(ih);
    const cosIh = Math.cos(ih);
    const sin2Ih = Math.sin(2.0 * ih);
    const cos2Ih = Math.cos(2.0 * ih);

    const sinPhi = Math.sin(phi);
    const cosPhi = Math.cos(phi);
    const sin2Phi = Math.sin(2.0 * phi);
    const cos2Phi = Math.cos(2.0 * phi);

    // Standard Aki & Richards (2002) Double-Couple Radiation Pattern:
    // P-wave radiation
    const pFactor = cosL * sinD * (sinIh * sinIh) * sin2Phi
                  - cosL * cosD * sin2Ih * cosPhi
                  + sinL * sin2D * ((cosIh * cosIh) - (sinIh * sinIh) * (sinPhi * sinPhi))
                  + sinL * cos2D * sin2Ih * sinPhi;

    // SV-wave radiation (in vertical-radial plane)
    const svFactor = 0.5 * cosL * sinD * sin2Ih * sin2Phi
                   - cosL * cosD * cos2Ih * cosPhi
                   - 0.5 * sinL * sin2D * sin2Ih * (1.0 + (sinPhi * sinPhi))
                   + sinL * cos2D * cos2Ih * sinPhi;

    // SH-wave radiation (transverse horizontal)
    const shFactor = cosL * sinD * sinIh * cos2Phi
                   + cosL * cosD * cosIh * sinPhi
                   - 0.5 * sinL * sin2D * sinIh * sin2Phi
                   - sinL * cos2D * cosIh * cosPhi;

    return {
      pFactor: Math.max(-1.0, Math.min(1.0, pFactor)),
      svFactor: Math.max(-1.0, Math.min(1.0, svFactor)),
      shFactor: Math.max(-1.0, Math.min(1.0, shFactor)),
      status: RadiationPatternStatus.DOUBLE_COUPLE_VERIFIED,
      isIsotropicFallback: false
    };
  }

  /**
   * Build factory for standard benchmark events
   */
  static createBenchmarkSource(eventId) {
    switch (eventId) {
      case 'global_2023_turkey':
        return new SeismicSourceModel({
          eventId,
          sourceType: 'FINITE_FAULT',
          sourceCitation: 'USGS Finite Fault (Hayes et al., 2023) / AFAD / Melgar et al. (2023, Science)',
          kinematicDirectivityStatus: 'EDUCATIONAL_KINEMATIC_APPROXIMATION',
          lat: 37.17,
          lon: 37.03,
          depthKm: 10.0,
          magnitude: 7.8,
          magnitudeScale: 'Mw',
          velocityModel: REGIONAL_VELOCITY_MODELS.TURKEY_ANATOLIA,
          focalMechanism: {
            strikeDeg: 65.0,
            dipDeg: 85.0,
            rakeDeg: 5.0, // Left-lateral strike-slip along East Anatolian Fault
            isVerified: true,
            rupturePlaneResolved: true,
            alternateNodalPlane: { strikeDeg: 334.0, dipDeg: 85.0, rakeDeg: 175.0 }
          },
          finiteFault: {
            lengthKm: 310.0,
            widthKm: 25.0,
            topDepthKm: 0.0,
            ruptureVelocityKmS: 2.9,
            strikeDeg: 65.0,
            dipDeg: 85.0,
            rakeDeg: 5.0,
            directivity: 'BILATERAL',
            isVerified: true
          }
        });

      case 'global_2016_kumamoto':
        return new SeismicSourceModel({
          eventId,
          sourceType: 'FINITE_FAULT',
          sourceCitation: 'USGS Finite Fault (Ji et al., 2016) / NIED / Kobayashi et al. (2017, EPS)',
          kinematicDirectivityStatus: 'EDUCATIONAL_KINEMATIC_APPROXIMATION',
          lat: 32.75,
          lon: 130.76,
          depthKm: 11.0,
          magnitude: 7.0,
          magnitudeScale: 'Mw',
          velocityModel: REGIONAL_VELOCITY_MODELS.JAPAN_KYUSHU,
          focalMechanism: {
            strikeDeg: 225.0,
            dipDeg: 65.0,
            rakeDeg: -150.0, // Right-lateral strike-slip with normal component along Futagawa fault
            isVerified: true,
            rupturePlaneResolved: true,
            alternateNodalPlane: { strikeDeg: 118.0, dipDeg: 63.0, rakeDeg: -28.0 }
          },
          finiteFault: {
            lengthKm: 34.0,
            widthKm: 18.0,
            topDepthKm: 0.0,
            ruptureVelocityKmS: 2.8,
            strikeDeg: 225.0,
            dipDeg: 65.0,
            rakeDeg: -150.0,
            directivity: 'UNILATERAL',
            isVerified: true
          }
        });

      case 'hist_2016_gyeongju':
        return new SeismicSourceModel({
          eventId,
          sourceType: 'FINITE_FAULT',
          sourceCitation: 'KMA/KIGAM (2017) Comprehensive Report / Kim et al. (2017, GRL)',
          kinematicDirectivityStatus: 'EDUCATIONAL_KINEMATIC_APPROXIMATION',
          lat: 35.76,
          lon: 129.19,
          depthKm: 15.0,
          magnitude: 5.8,
          magnitudeScale: 'ML',
          velocityModel: REGIONAL_VELOCITY_MODELS.KOREA_PENINSULA,
          focalMechanism: {
            strikeDeg: 214.0,
            dipDeg: 70.0,
            rakeDeg: 16.0, // Right-lateral strike-slip branch of Yangsan Fault
            isVerified: true,
            rupturePlaneResolved: true,
            alternateNodalPlane: { strikeDeg: 117.0, dipDeg: 75.0, rakeDeg: 159.0 }
          },
          finiteFault: {
            lengthKm: 5.2,
            widthKm: 4.0,
            topDepthKm: 12.0,
            ruptureVelocityKmS: 2.9,
            strikeDeg: 214.0,
            dipDeg: 70.0,
            rakeDeg: 16.0,
            directivity: 'BILATERAL',
            isVerified: true
          }
        });

      case 'hist_2017_pohang':
        return new SeismicSourceModel({
          eventId,
          sourceType: 'FINITE_FAULT',
          sourceCitation: 'Korean Government Investigation Commission (2019) / Kim et al. (2018, Science)',
          kinematicDirectivityStatus: 'EDUCATIONAL_KINEMATIC_APPROXIMATION',
          lat: 36.11,
          lon: 129.37,
          depthKm: 4.3,
          magnitude: 5.4,
          magnitudeScale: 'ML',
          velocityModel: REGIONAL_VELOCITY_MODELS.KOREA_PENINSULA,
          focalMechanism: {
            strikeDeg: 228.0,
            dipDeg: 64.0,
            rakeDeg: 140.0, // Oblique thrust fault
            isVerified: true,
            rupturePlaneResolved: true,
            alternateNodalPlane: { strikeDeg: 343.0, dipDeg: 54.0, rakeDeg: 32.0 }
          },
          finiteFault: {
            lengthKm: 4.0,
            widthKm: 3.5,
            topDepthKm: 2.0,
            ruptureVelocityKmS: 2.7,
            strikeDeg: 228.0,
            dipDeg: 64.0,
            rakeDeg: 140.0,
            directivity: 'UNILATERAL',
            isVerified: true
          }
        });

      case 'global_2011_tohoku':
        return new SeismicSourceModel({
          eventId,
          sourceType: 'FINITE_FAULT',
          sourceCitation: 'USGS Finite Fault (Hayes et al., 2011) / JMA / Ide et al. (2011, Science)',
          kinematicDirectivityStatus: 'EDUCATIONAL_KINEMATIC_APPROXIMATION',
          lat: 38.30,
          lon: 142.37,
          depthKm: 29.0,
          magnitude: 9.1,
          magnitudeScale: 'Mw',
          velocityModel: REGIONAL_VELOCITY_MODELS.KYUSHU_JAPAN,
          focalMechanism: {
            strikeDeg: 203.0,
            dipDeg: 12.0,
            rakeDeg: 88.0, // Megathrust subduction reverse fault
            isVerified: true,
            rupturePlaneResolved: true,
            alternateNodalPlane: { strikeDeg: 27.0, dipDeg: 78.0, rakeDeg: 91.0 }
          },
          finiteFault: {
            lengthKm: 500.0,
            widthKm: 200.0,
            topDepthKm: 5.0,
            ruptureVelocityKmS: 2.8,
            strikeDeg: 203.0,
            dipDeg: 12.0,
            rakeDeg: 88.0,
            directivity: 'BILATERAL',
            isVerified: true
          }
        });

      case 'hist_1681_0626':
      default:
        // 1681 Yangyang (Historical Inferred):
        // STRICT RULE: No unverified fault plane or rupture directivity generated!
        // Radiation model is strictly an AZIMUTHALLY_NEUTRAL_VISUAL_APPROXIMATION.
        return new SeismicSourceModel({
          eventId: 'hist_1681_0626',
          sourceType: 'HISTORICAL_INFERRED',
          radiationStatus: RadiationPatternStatus.AZIMUTHALLY_NEUTRAL_VISUAL_APPROXIMATION,
          radiationNote: '발진기구 미상에 따른 방위각 중립적 시각화 근사이며, 실제 물리적 지진 방사 패턴을 관측하거나 복원한 결과가 아님.',
          lat: 37.90,
          lon: 129.05,
          depthKm: 12.0,
          magnitude: null, // Strictly null for pre-instrumental event
          magnitudeScale: 'UNVERIFIED_HISTORICAL',
          uncertainty: 'Pre-instrumental historical record. Rupture geometry and fault plane are geologically unconfirmed; azimuthally neutral visual approximation applied.',
          velocityModel: REGIONAL_VELOCITY_MODELS.KOREA_PENINSULA,
          focalMechanism: null, // Explicitly NULL: Zero fake strike/dip/rake!
          finiteFault: null    // Explicitly NULL: Zero fake fault plane!
        });
    }
  }
}
