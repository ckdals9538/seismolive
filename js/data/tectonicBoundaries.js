// ============================================================================
// SEISMOLIVE v4.0 — Tectonic Plate Boundaries & Regional Fault Linework
// Cartographic micro-hairlines for the Nocturnal Monolith Globe (anti-game-VFX).
// ============================================================================

import { geodeticToThree } from '../3d/geodeticEllipsoidCoord.js';

/**
 * Simplified scientifically grounded coordinates (lat, lon) for Western Pacific
 * subduction trenches, Korean active fault belts, and Anatolian fault zones.
 */
export const TECTONIC_ARCS = Object.freeze([
  {
    id: 'kuril_japan_trench',
    label: 'Kuril-Japan Subduction Trench',
    opacity: 0.16,
    coords: [
      [48.5, 155.5], [45.8, 152.0], [43.2, 148.0], [41.5, 144.8],
      [39.8, 144.2], [38.0, 143.9], [36.2, 142.8], [34.4, 141.9], [33.2, 141.6]
    ]
  },
  {
    id: 'izu_bonin_trench',
    label: 'Izu-Bonin Arc',
    opacity: 0.13,
    coords: [
      [33.2, 141.6], [30.8, 142.2], [28.0, 142.8], [25.2, 143.3], [22.0, 144.5]
    ]
  },
  {
    id: 'nankai_ryukyu_trench',
    label: 'Nankai Trough & Ryukyu Trench',
    opacity: 0.15,
    coords: [
      [34.6, 138.6], [33.4, 136.5], [32.3, 134.2], [31.1, 132.2],
      [29.5, 130.9], [27.4, 129.2], [25.2, 127.0], [23.8, 124.2], [23.6, 121.8]
    ]
  },
  {
    id: 'sagami_suruga_trough',
    label: 'Sagami-Suruga Trough',
    opacity: 0.12,
    coords: [
      [35.1, 138.5], [34.8, 139.5], [34.4, 140.8], [33.8, 141.8]
    ]
  },
  {
    id: 'donghae_back_arc',
    label: 'East Sea Back-Arc Thrust Corridor',
    opacity: 0.14,
    coords: [
      [39.6, 129.4], [38.6, 129.25], [37.85, 129.15], [37.1, 129.4], [36.2, 129.55]
    ]
  },
  {
    id: 'yangsan_fault_belt',
    label: 'Yangsan Fault System',
    opacity: 0.14,
    coords: [
      [36.65, 129.38], [36.15, 129.28], [35.84, 129.21], [35.50, 129.11], [35.12, 128.98]
    ]
  },
  {
    id: 'chugaryeong_rift',
    label: 'Chugaryeong Fault Belt',
    opacity: 0.11,
    coords: [
      [38.55, 127.42], [38.05, 127.22], [37.62, 127.03], [37.28, 126.92]
    ]
  },
  {
    id: 'north_anatolian_fault',
    label: 'North Anatolian Fault Zone',
    opacity: 0.14,
    coords: [
      [40.7, 27.5], [40.75, 30.8], [40.95, 34.4], [40.45, 37.8], [39.65, 40.9]
    ]
  },
  {
    id: 'east_anatolian_fault',
    label: 'East Anatolian Fault Zone',
    opacity: 0.14,
    coords: [
      [39.4, 41.0], [38.35, 39.2], [37.72, 37.9], [37.18, 36.9], [36.2, 36.1]
    ]
  }
]);

function densifyArc(coords, stepDeg = 0.65) {
  const dense = [];
  for (let i = 0; i < coords.length - 1; i++) {
    const [latA, lonA] = coords[i];
    const [latB, lonB] = coords[i + 1];
    const dist = Math.hypot(latB - latA, lonB - lonA);
    const steps = Math.max(1, Math.ceil(dist / stepDeg));
    for (let s = 0; s < steps; s++) {
      const t = s / steps;
      dense.push([latA + (latB - latA) * t, lonA + (lonB - lonA) * t]);
    }
  }
  dense.push(coords[coords.length - 1]);
  return dense;
}

/**
 * Create a disposable THREE.Group of subtle curved plate/fault hairlines anchored to (lat0, lon0).
 */
export function buildTectonicBoundaryGroup(THREE, lat0, lon0) {
  const group = new THREE.Group();
  group.name = 'TectonicBoundaryHairlines';

  for (const arc of TECTONIC_ARCS) {
    const samples = densifyArc(arc.coords, 0.55);
    const pts = [];
    for (const [lat, lon] of samples) {
      const [x, y, z] = geodeticToThree(lat, lon, 750.0, lat0, lon0, 0.0);
      pts.push(new THREE.Vector3(x, y, z));
    }
    if (pts.length < 2) continue;
    const geo = new THREE.BufferGeometry().setFromPoints(pts);
    const mat = new THREE.LineBasicMaterial({
      color: 0x5682ae,
      transparent: true,
      opacity: arc.opacity,
      depthWrite: false,
      depthTest: true
    });
    const line = new THREE.Line(geo, mat);
    line.name = arc.id;
    line.renderOrder = 3;
    group.add(line);
  }

  return group;
}

export function disposeTectonicBoundaryGroup(group) {
  if (!group) return;
  group.traverse((child) => {
    if (child.geometry) child.geometry.dispose();
    if (child.material) child.material.dispose();
  });
}
