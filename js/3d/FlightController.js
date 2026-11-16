// ============================================================================
// SEISMOLIVE v4.0 — Orbital-to-Local Continuous Camera Flight Controller
// Module: js/3d/FlightController.js
//
// Encapsulates exhibition flight state constants and spherical altitude-aware
// continuous orbital-to-tangent-plane interpolation (Stage R3).
// ============================================================================

export const FLIGHT_STATES = Object.freeze({
  ORBIT: 'STATE_ORBIT',
  DESCEND: 'STATE_FLIGHT_DESCEND',
  PERFORMANCE: 'STATE_PERFORMANCE',
  CODA: 'STATE_CODA',
  ASCEND: 'STATE_FLIGHT_ASCEND'
});

/**
 * Compute continuous WGS84-centered spherical camera pose along an eased arc.
 * Prevents the camera from piercing Earth spheres or clipping terrain during long flights.
 *
 * @param {Object} params
 * @param {Object} params.THREE - Three.js namespace
 * @param {THREE.Vector3} params.startPos
 * @param {THREE.Vector3} params.endPos
 * @param {THREE.Vector3} params.startLookAt
 * @param {THREE.Vector3} params.endLookAt
 * @param {number} params.progress - Normalized flight progress [0, 1]
 * @param {boolean} [params.withArcHop=true] - Include orbital apex altitude hop during descent
 * @returns {{ position: THREE.Vector3, lookAt: THREE.Vector3, ease: number }}
 */
export function computeSphericalFlightPose({
  THREE,
  startPos,
  endPos,
  startLookAt,
  endLookAt,
  progress,
  withArcHop = true
}) {
  const t = Math.max(0.0, Math.min(1.0, progress));
  const ease = t < 0.5 ? 4.0 * t * t * t : 1.0 - Math.pow(-2.0 * t + 2.0, 3.0) / 2.0;

  const globeCenter = new THREE.Vector3(0, -63.78137, 0);
  const vStart = startPos.clone().sub(globeCenter);
  const vEnd = endPos.clone().sub(globeCenter);
  const rStart = vStart.length();
  const rEnd = vEnd.length();

  const angularDist = vStart.angleTo(vEnd);
  const arcHeight = withArcHop ? Math.min(85.0, Math.max(0.0, angularDist * 55.0)) : 0.0;
  const altitudeHop = Math.sin(ease * Math.PI) * arcHeight;

  const up = new THREE.Vector3(0, 1, 0);
  const qStart = new THREE.Quaternion().setFromUnitVectors(up, vStart.clone().normalize());
  const qEnd = new THREE.Quaternion().setFromUnitVectors(up, vEnd.clone().normalize());
  const qCur = qStart.clone().slerp(qEnd, ease);
  const curDir = up.clone().applyQuaternion(qCur);
  const curR = THREE.MathUtils.lerp(rStart, rEnd, ease) + altitudeHop;

  const position = globeCenter.clone().addScaledVector(curDir, curR);
  const lookAt = new THREE.Vector3().lerpVectors(startLookAt, endLookAt, ease);

  return { position, lookAt, ease };
}
