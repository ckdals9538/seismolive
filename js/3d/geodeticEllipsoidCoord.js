// ============================================================================
// SEISMOLIVE v4.0 — Geodetic Ellipsoid Coordinate Engine
// File: js/3d/geodeticEllipsoidCoord.js
//
// Rigorous WGS84 Geodetic <-> ECEF <-> Local Tangent ENU <-> Three.js World
// Includes:
//   - Precise WGS84 Ellipsoidal curvature (eliminating redundant -d^2/2R approximations)
//   - Center-relative scaled ECEF (eliminating 32-bit floating point jitter)
//   - Latitude-dependent polar axis orientation & Earth center in Three.js coordinates
//   - EGM2008 Orthometric (H) -> WGS84 Ellipsoidal (h) geoid height transformation: h = H + N
//   - Rigorous Geodetic Datum Status tracking (GEODETIC_DATUM_VERIFIED vs GEODETIC_DATUM_INCOMPLETE)
// ============================================================================

export const WGS84 = Object.freeze({
  // Semi-major axis (meters)
  a: 6378137.0,
  // Semi-minor axis (meters)
  b: 6356752.31424518,
  // Flattening f = (a - b) / a
  f: 1.0 / 298.257223563,
  // First eccentricity squared e^2 = 2f - f^2 = (a^2 - b^2) / a^2
  e2: 0.0066943799901413165,
  // Second eccentricity squared e'^2 = (a^2 - b^2) / b^2
  ePrime2: 0.006739496742276434,
  // Scale factor: 1 Three.js world unit = 100 km = 100,000 meters
  METERS_PER_UNIT: 100000.0,
  UNITS_PER_METER: 1.0 / 100000.0,
  METERS_TO_UNITS: 1.0 / 100000.0
});

export const DATUM_STATUS = Object.freeze({
  VERIFIED: 'GEODETIC_DATUM_VERIFIED',
  INCOMPLETE: 'GEODETIC_DATUM_INCOMPLETE'
});

/**
 * Prime vertical radius of curvature N(phi) = a / sqrt(1 - e^2 * sin^2(phi))
 * @param {number} phiRad - Geodetic latitude in radians
 * @returns {number} Radius of curvature in prime vertical (meters)
 */
export function primeVerticalRadius(phiRad) {
  const s = Math.sin(phiRad);
  return WGS84.a / Math.sqrt(1.0 - WGS84.e2 * s * s);
}

/**
 * Meridional radius of curvature M(phi) = a*(1 - e^2) / (1 - e^2 * sin^2(phi))^(3/2)
 * @param {number} phiRad - Geodetic latitude in radians
 * @returns {number} Radius of curvature in meridian (meters)
 */
export function meridionalRadius(phiRad) {
  const s = Math.sin(phiRad);
  const denom = 1.0 - WGS84.e2 * s * s;
  return (WGS84.a * (1.0 - WGS84.e2)) / (denom * Math.sqrt(denom));
}

/**
 * Convert EGM2008 Orthometric Height (H) to WGS84 Ellipsoidal Height (h)
 * Formula: h = H + N
 *
 * @param {number} H - Orthometric height above EGM2008 geoid (meters)
 * @param {number|null} N - Geoid undulation in meters (from ETOPO geoid raster or EGM2008 table)
 * @param {boolean} [geoidAvailable=true] - Whether genuine geoid data was supplied
 * @returns {{ h: number, status: string, N: number, warning?: string }}
 */
export function computeEllipsoidalHeight(H, N, geoidAvailable = true) {
  if (geoidAvailable && typeof N === 'number' && !Number.isNaN(N)) {
    return {
      h: H + N,
      status: DATUM_STATUS.VERIFIED,
      N: N
    };
  }
  // Missing geoid data policy: explicitly record uncompensated approximate state
  return {
    h: H, // approx fallback without geoid undulation
    status: DATUM_STATUS.INCOMPLETE,
    N: 0.0,
    warning: 'EGM2008 geoid undulation unavailable; ellipsoidal height approximation active.'
  };
}

/**
 * Transform WGS84 Geodetic coordinates (lat, lon, h) to Earth-Centered, Earth-Fixed (ECEF) [X, Y, Z] in meters.
 *
 * @param {number} latDeg - Geodetic latitude in degrees [-90, +90]
 * @param {number} lonDeg - Geodetic longitude in degrees [-180, +180]
 * @param {number} [h_ellipsoid=0] - Height above WGS84 reference ellipsoid in meters
 * @returns {[number, number, number]} [X, Y, Z] in meters
 */
export function geodeticToECEF(latDeg, lonDeg, h_ellipsoid = 0.0) {
  const phi = (latDeg * Math.PI) / 180.0;
  const lambda = (lonDeg * Math.PI) / 180.0;
  const cosPhi = Math.cos(phi);
  const sinPhi = Math.sin(phi);
  const cosLambda = Math.cos(lambda);
  const sinLambda = Math.sin(lambda);

  const N = primeVerticalRadius(phi);
  const X = (N + h_ellipsoid) * cosPhi * cosLambda;
  const Y = (N + h_ellipsoid) * cosPhi * sinLambda;
  const Z = (N * (1.0 - WGS84.e2) + h_ellipsoid) * sinPhi;

  return [X, Y, Z];
}

/**
 * Inverse transformation: ECEF [X, Y, Z] in meters to WGS84 Geodetic (lat, lon, h).
 * Uses Bowring's highly accurate closed-form vector algorithm (sub-millimeter precision worldwide).
 *
 * @param {number} X - ECEF X in meters
 * @param {number} Y - ECEF Y in meters
 * @param {number} Z - ECEF Z in meters
 * @returns {{ latDeg: number, lonDeg: number, h: number }}
 */
export function ecefToGeodetic(X, Y, Z) {
  const p = Math.hypot(X, Y);
  if (p < 1e-6) {
    // Exactly at poles
    const latDeg = Z >= 0 ? 90.0 : -90.0;
    const h = Math.abs(Z) - WGS84.b;
    return { latDeg, lonDeg: 0.0, h };
  }

  const theta = Math.atan2(Z * WGS84.a, p * WGS84.b);
  const sinTheta = Math.sin(theta);
  const cosTheta = Math.cos(theta);

  const phi = Math.atan2(
    Z + WGS84.ePrime2 * WGS84.b * sinTheta * sinTheta * sinTheta,
    p - WGS84.e2 * WGS84.a * cosTheta * cosTheta * cosTheta
  );
  const lambda = Math.atan2(Y, X);

  const N = primeVerticalRadius(phi);
  const cosPhi = Math.cos(phi);
  const sinPhi = Math.sin(phi);
  const h = p * cosPhi + (Z + WGS84.e2 * N * sinPhi) * sinPhi - N;

  return {
    latDeg: (phi * 180.0) / Math.PI,
    lonDeg: (lambda * 180.0) / Math.PI,
    h: h
  };
}

/**
 * Construct the 3x3 orthonormal rotation matrix R_enu from ECEF to local East-North-Up (ENU).
 * R_enu rows are [e_east, e_north, e_up]^T.
 *
 * @param {number} lat0Deg - Origin latitude in degrees
 * @param {number} lon0Deg - Origin longitude in degrees
 * @returns {number[][]} 3x3 rotation matrix
 */
export function computeLocalENURotationMatrix(lat0Deg, lon0Deg) {
  const phi = (lat0Deg * Math.PI) / 180.0;
  const lambda = (lon0Deg * Math.PI) / 180.0;
  const cosPhi = Math.cos(phi);
  const sinPhi = Math.sin(phi);
  const cosLambda = Math.cos(lambda);
  const sinLambda = Math.sin(lambda);

  // Basis vectors
  // e_east  = [-sinLambda, cosLambda, 0]
  // e_north = [-sinPhi * cosLambda, -sinPhi * sinLambda, cosPhi]
  // e_up    = [cosPhi * cosLambda, cosPhi * sinLambda, sinPhi]
  return [
    [-sinLambda, cosLambda, 0.0],
    [-sinPhi * cosLambda, -sinPhi * sinLambda, cosPhi],
    [cosPhi * cosLambda, cosPhi * sinLambda, sinPhi]
  ];
}

/**
 * Convert Three.js world coordinates back to ECEF coordinates (meters).
 *
 * @param {[number, number, number]|{x:number, y:number, z:number}} threePos - [x, y, z] in Three.js world units
 * @param {number} lat0Deg - Epicenter latitude in degrees
 * @param {number} lon0Deg - Epicenter longitude in degrees
 * @returns {[number, number, number]} [X, Y, Z] in ECEF meters
 */
export function threeToECEF(threePos, lat0Deg, lon0Deg) {
  const x = Array.isArray(threePos) ? threePos[0] : threePos.x;
  const y = Array.isArray(threePos) ? threePos[1] : threePos.y;
  const z = Array.isArray(threePos) ? threePos[2] : threePos.z;

  const e = x * WGS84.METERS_PER_UNIT;
  const u = y * WGS84.METERS_PER_UNIT;
  const n = -z * WGS84.METERS_PER_UNIT;

  const P0 = geodeticToECEF(lat0Deg, lon0Deg, 0.0);
  const R = computeLocalENURotationMatrix(lat0Deg, lon0Deg);

  // R^T * [e, n, u]^T
  const dX = R[0][0] * e + R[1][0] * n + R[2][0] * u;
  const dY = R[0][1] * e + R[1][1] * n + R[2][1] * u;
  const dZ = R[0][2] * e + R[1][2] * n + R[2][2] * u;

  return [P0[0] + dX, P0[1] + dY, P0[2] + dZ];
}

/**
 * Convert ECEF coordinates (meters) to Three.js world coordinates relative to local epicenter (lat0, lon0).
 *
 * @param {[number, number, number]} ecefPos - [X, Y, Z] in ECEF meters
 * @param {number} lat0Deg - Epicenter latitude in degrees
 * @param {number} lon0Deg - Epicenter longitude in degrees
 * @returns {[number, number, number]} [x, y, z] in Three.js world units
 */
export function ecefToThree(ecefPos, lat0Deg, lon0Deg) {
  const P0 = geodeticToECEF(lat0Deg, lon0Deg, 0.0);
  const dX = ecefPos[0] - P0[0];
  const dY = ecefPos[1] - P0[1];
  const dZ = ecefPos[2] - P0[2];

  const R = computeLocalENURotationMatrix(lat0Deg, lon0Deg);
  const e = R[0][0] * dX + R[0][1] * dY + R[0][2] * dZ;
  const n = R[1][0] * dX + R[1][1] * dY + R[1][2] * dZ;
  const u = R[2][0] * dX + R[2][1] * dY + R[2][2] * dZ;

  return [
    e * WGS84.UNITS_PER_METER,
    u * WGS84.UNITS_PER_METER,
    -n * WGS84.UNITS_PER_METER
  ];
}

/**
 * Transform Geodetic coordinates to Center-Relative Local ENU (meters) relative to epicenter origin P0.
 *
 * @param {number} latDeg - Target latitude
 * @param {number} lonDeg - Target longitude
 * @param {number} h - Target ellipsoidal height (m)
 * @param {number} lat0Deg - Epicenter origin latitude
 * @param {number} lon0Deg - Epicenter origin longitude
 * @param {number} [h0=0.0] - Epicenter origin ellipsoidal height (m)
 * @returns {[number, number, number]} [eastMeters, northMeters, upMeters]
 */
export function geodeticToCenterRelativeENU(latDeg, lonDeg, h, lat0Deg, lon0Deg, h0 = 0.0) {
  const P = geodeticToECEF(latDeg, lonDeg, h);
  const P0 = geodeticToECEF(lat0Deg, lon0Deg, h0);
  const R = computeLocalENURotationMatrix(lat0Deg, lon0Deg);

  // Delta ECEF vector
  const dX = P[0] - P0[0];
  const dY = P[1] - P0[1];
  const dZ = P[2] - P0[2];

  // Rotate to ENU
  const east = R[0][0] * dX + R[0][1] * dY + R[0][2] * dZ;
  const north = R[1][0] * dX + R[1][1] * dY + R[1][2] * dZ;
  const up = R[2][0] * dX + R[2][1] * dY + R[2][2] * dZ;

  return [east, north, up];
}

/**
 * Convert Local ENU meters to Three.js world coordinates.
 * Three.js coordinate mapping:
 *   +X: East
 *   +Y: Up (Local Horizon Zenith)
 *   -Z: North
 * Scaled by 1 unit = 100 km (100,000 meters).
 *
 * @param {number} east - East offset in meters
 * @param {number} north - North offset in meters
 * @param {number} up - Up offset in meters
 * @returns {[number, number, number]} [x, y, z] in Three.js world units
 */
export function centerRelativeENUToThree(east, north, up) {
  return [
    east * WGS84.UNITS_PER_METER,
    up * WGS84.UNITS_PER_METER,
    -north * WGS84.UNITS_PER_METER
  ];
}

/**
 * Direct transformation pipeline: Geodetic (lat, lon, h) -> Three.js World Coordinates
 *
 * @param {number} latDeg - Target latitude
 * @param {number} lonDeg - Target longitude
 * @param {number} h_ellipsoid - Target ellipsoidal height (m)
 * @param {number} lat0Deg - Epicenter latitude
 * @param {number} lon0Deg - Epicenter longitude
 * @param {number} [h0_ellipsoid=0.0] - Epicenter height
 * @returns {[number, number, number]} [threeX, threeY, threeZ]
 */
export function geodeticToThree(latDeg, lonDeg, h_ellipsoid, lat0Deg, lon0Deg, h0_ellipsoid = 0.0) {
  const [e, n, u] = geodeticToCenterRelativeENU(latDeg, lonDeg, h_ellipsoid, lat0Deg, lon0Deg, h0_ellipsoid);
  return centerRelativeENUToThree(e, n, u);
}

/**
 * Compute the exact placement of the Tier 0 WGS84 Ellipsoid in Three.js world coordinates
 * such that its surface exactly touches the local epicenter tangent plane at [0, 0, 0].
 *
 * @param {number} lat0Deg - Epicenter latitude in degrees
 * @param {number} lon0Deg - Epicenter longitude in degrees
 * @returns {{
 *   centerThree: [number, number, number],
 *   polarAxisThree: [number, number, number],
 *   semiMajorUnits: number,
 *   semiMinorUnits: number,
 *   ratioBA: number
 * }}
 */
export function computeGlobeCenterAndPolarAxis(lat0Deg, lon0Deg) {
  const phi = (lat0Deg * Math.PI) / 180.0;
  const sinPhi = Math.sin(phi);
  const cosPhi = Math.cos(phi);

  const N0 = primeVerticalRadius(phi);

  // Exact center of Earth in local ENU coordinates relative to surface P0(lat0, lon0, 0):
  // C_enu_x = 0
  // C_enu_y = e^2 * N0 * sin(phi) * cos(phi)
  // C_enu_z = -N0 * (1 - e^2 * sin^2(phi))
  const cEnuX = 0.0;
  const cEnuY = WGS84.e2 * N0 * sinPhi * cosPhi;
  const cEnuZ = -N0 * (1.0 - WGS84.e2 * sinPhi * sinPhi);

  // In Three.js: East -> +X, Up -> +Y, North -> -Z
  const centerThree = [
    cEnuX * WGS84.UNITS_PER_METER,
    cEnuZ * WGS84.UNITS_PER_METER,
    -cEnuY * WGS84.UNITS_PER_METER
  ];

  // Polar Axis (ECEF [0, 0, 1]) in local ENU:
  // u_polar_enu = [0, cosPhi, sinPhi]^T
  // In Three.js: East -> +X, Up -> +Y, North -> -Z:
  // u_polar_three = [0, sinPhi, -cosPhi]^T
  const polarAxisThree = [0.0, sinPhi, -cosPhi];

  return {
    centerThree,
    polarAxisThree,
    semiMajorUnits: WGS84.a * WGS84.UNITS_PER_METER, // 63.78137
    semiMinorUnits: WGS84.b * WGS84.UNITS_PER_METER, // 63.567523142
    ratioBA: WGS84.b / WGS84.a // ~0.9966471893
  };
}
