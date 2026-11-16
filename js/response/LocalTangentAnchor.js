// ============================================================================
// SEISMOLIVE v4.0 — Local Tangent Anchor (LTA) Coordinate Engine
// File: js/response/LocalTangentAnchor.js
//
// Rigorous topocentric coordinate bridge connecting WGS84 Geodetic,
// ECEF, Local ENU, and Three.js Local Metric Space without floating-point jitter.
//
// Pipeline:
//   WGS84 Geodetic (lat, lon, h)
//     --> ECEF [X, Y, Z] (meters)
//     --> Anchor-Relative ECEF [dX, dY, dZ] (meters)
//     --> Local ENU [East, North, Up] (meters)
//     --> Three.js Local Metric Coordinates [X=East, Y=Up, Z=-North] (meters)
// ============================================================================

import {
  WGS84,
  geodeticToECEF,
  ecefToGeodetic,
  computeLocalENURotationMatrix,
  ecefToThree,
  threeToECEF
} from '../3d/geodeticEllipsoidCoord.js';

export const HANYANG_BLDG212_ANCHOR = Object.freeze({
  lat: 37.555815,
  lon: 127.045053,
  h: 42.0 // Campus terrain surface elevation above WGS84 ellipsoid (meters)
});

export class LocalTangentAnchor {
  /**
   * @param {{ lat: number, lon: number, h: number }} [origin=HANYANG_BLDG212_ANCHOR]
   */
  constructor(origin = HANYANG_BLDG212_ANCHOR) {
    if (!origin || typeof origin.lat !== 'number' || typeof origin.lon !== 'number') {
      throw new Error('[LocalTangentAnchor] Invalid origin coordinates supplied.');
    }
    this.origin = Object.freeze({
      lat: origin.lat,
      lon: origin.lon,
      h: typeof origin.h === 'number' ? origin.h : 0.0
    });

    // Anchor Origin in ECEF meters (Float64)
    this.originECEF = Object.freeze(
      geodeticToECEF(this.origin.lat, this.origin.lon, this.origin.h)
    );

    // 3x3 Orthonormal Rotation Matrix from ECEF to local ENU at anchor origin
    // R_enu[0] = East basis vector [-sinLam, cosLam, 0]
    // R_enu[1] = North basis vector [-sinPhi*cosLam, -sinPhi*sinLam, cosPhi]
    // R_enu[2] = Up basis vector [cosPhi*cosLam, cosPhi*sinLam, sinPhi]
    this.R_enu = Object.freeze(
      computeLocalENURotationMatrix(this.origin.lat, this.origin.lon)
    );
  }

  /**
   * Transform WGS84 Geodetic (lat, lon, h) directly to Anchor-Relative Local ENU (meters).
   *
   * @param {number} latDeg - Geodetic latitude
   * @param {number} lonDeg - Geodetic longitude
   * @param {number} [hMeters=0.0] - Height above WGS84 ellipsoid
   * @returns {[number, number, number]} [eastMeters, northMeters, upMeters]
   */
  geodeticToENU(latDeg, lonDeg, hMeters = 0.0) {
    const P = geodeticToECEF(latDeg, lonDeg, hMeters);
    const dX = P[0] - this.originECEF[0];
    const dY = P[1] - this.originECEF[1];
    const dZ = P[2] - this.originECEF[2];

    const R = this.R_enu;
    const east = R[0][0] * dX + R[0][1] * dY + R[0][2] * dZ;
    const north = R[1][0] * dX + R[1][1] * dY + R[1][2] * dZ;
    const up = R[2][0] * dX + R[2][1] * dY + R[2][2] * dZ;

    return [east, north, up];
  }

  /**
   * Convert Local ENU (meters) to Three.js Local Metric Coordinates.
   * Coordinate convention:
   *   +X_local: East (m)
   *   +Y_local: Up (m, Zenith)
   *   +Z_local: South (m), so -Z_local is North (m)
   *
   * @param {number} east - Meters East
   * @param {number} north - Meters North
   * @param {number} up - Meters Up
   * @returns {[number, number, number]} [x, y, z] in Three.js local metric meters
   */
  enuToLocalThree(east, north, up) {
    return [east, up, -north];
  }

  /**
   * Convert Three.js Local Metric Coordinates back to Local ENU (meters).
   *
   * @param {number} x - Three.js local X (East, m)
   * @param {number} y - Three.js local Y (Up, m)
   * @param {number} z - Three.js local Z (-North, m)
   * @returns {[number, number, number]} [east, north, up] in meters
   */
  localThreeToENU(x, y, z) {
    return [x, -z, y];
  }

  /**
   * Complete Forward Pipeline: WGS84 Geodetic -> Three.js Local Metric Coordinates (meters).
   *
   * @param {number} latDeg
   * @param {number} lonDeg
   * @param {number} [hMeters=0.0]
   * @returns {[number, number, number]} [xLocal, yLocal, zLocal] in meters
   */
  geodeticToLocalThree(latDeg, lonDeg, hMeters = 0.0) {
    const [e, n, u] = this.geodeticToENU(latDeg, lonDeg, hMeters);
    return this.enuToLocalThree(e, n, u);
  }

  /**
   * Complete Inverse Pipeline: Three.js Local Metric Coordinates (meters) -> WGS84 Geodetic.
   *
   * @param {number} xLocal - Three.js local X (East, m)
   * @param {number} yLocal - Three.js local Y (Up, m)
   * @param {number} zLocal - Three.js local Z (-North, m)
   * @returns {{ lat: number, lon: number, h: number }}
   */
  localThreeToGeodetic(xLocal, yLocal, zLocal) {
    const [east, north, up] = this.localThreeToENU(xLocal, yLocal, zLocal);
    const R = this.R_enu;

    // Inverse of orthonormal rotation matrix R is its transpose R^T
    const dX = R[0][0] * east + R[1][0] * north + R[2][0] * up;
    const dY = R[0][1] * east + R[1][1] * north + R[2][1] * up;
    const dZ = R[0][2] * east + R[1][2] * north + R[2][2] * up;

    const X = this.originECEF[0] + dX;
    const Y = this.originECEF[1] + dY;
    const Z = this.originECEF[2] + dZ;

    const geo = ecefToGeodetic(X, Y, Z);
    return {
      lat: geo.latDeg,
      lon: geo.lonDeg,
      h: geo.h
    };
  }

  /**
   * Compute placement of this Local Tangent Anchor in an arbitrary Global Three.js Scene.
   * The global scene origin may be the global epicenter or Earth center.
   *
   * @param {number} sceneLat0 - Global scene epicenter latitude
   * @param {number} sceneLon0 - Global scene epicenter longitude
   * @param {number} [sceneH0=null] - Global scene surface elevation (m). If null and coincident, defaults to origin.h
   * @returns {{
   *   worldPositionUnits: [number, number, number],
   *   metersToUnitsScale: number,
   *   isCoincidentWithSceneOrigin: boolean
   * }}
   */
  computeScenePlacement(sceneLat0, sceneLon0, sceneH0 = null) {
    const isCoincident = Math.abs(sceneLat0 - this.origin.lat) < 1e-7 &&
                         Math.abs(sceneLon0 - this.origin.lon) < 1e-7;

    const effSceneH0 = sceneH0 !== null ? sceneH0 : (isCoincident ? this.origin.h : 0.0);
    const sceneP0_ECEF = geodeticToECEF(sceneLat0, sceneLon0, effSceneH0);

    const dX = this.originECEF[0] - sceneP0_ECEF[0];
    const dY = this.originECEF[1] - sceneP0_ECEF[1];
    const dZ = this.originECEF[2] - sceneP0_ECEF[2];

    const R_scene = computeLocalENURotationMatrix(sceneLat0, sceneLon0);
    const east = R_scene[0][0] * dX + R_scene[0][1] * dY + R_scene[0][2] * dZ;
    const north = R_scene[1][0] * dX + R_scene[1][1] * dY + R_scene[1][2] * dZ;
    const up = R_scene[2][0] * dX + R_scene[2][1] * dY + R_scene[2][2] * dZ;

    const worldPosUnits = [
      east * WGS84.UNITS_PER_METER,
      up * WGS84.UNITS_PER_METER,
      -north * WGS84.UNITS_PER_METER
    ];

    return {
      worldPositionUnits: worldPosUnits,
      metersToUnitsScale: WGS84.UNITS_PER_METER, // 1e-5
      isCoincidentWithSceneOrigin: isCoincident
    };
  }
}
