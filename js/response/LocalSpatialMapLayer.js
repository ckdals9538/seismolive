// ============================================================================
// SEISMOLIVE v4.0 — 4km Local Spatial Map Layer & HUD-Avoiding Labeler
// File: js/response/LocalSpatialMapLayer.js
//
// Strategy C Implementation (Unified Three.js ESM Runtime):
//   - Consumes pre-built 4km package (HanyangLocalSpatialData.js)
//   - Renders urban context massing via single 6-float32 OBB THREE.InstancedMesh
//   - Height-priority LOD (overviewCount vs fullCount) + Eco Mode
//   - Two-group hierarchy (muted #111827/#141d2e context vs #f8fafc active egress)
//   - X-Ray context transparency (opacity ~0.16) in building/indoor stages
//   - Cumulative 3D arc-length route interpolation (samplePointAlong3D)
//   - Priority-sorted 2D AABB HTML overlay labeler avoiding HUD panels
// ============================================================================

import * as THREE from '../lib/three.module.js';
import {
  HANYANG_LOCAL_4KM_PACKAGE,
  OBB_BUILDING_STRIDE,
  sampleTerrainHeight
} from './HanyangLocalSpatialData.js';
import { CAMERA_STAGES } from './GlobalLocalCameraTransition.js';
import { VERIFICATION_STATUS } from './ResponseDomainTypes.js';
import { SpatialChunkManager } from './SpatialChunkManager.js';

export const LOCAL_VISUAL_THEMES = Object.freeze({
  MONOLITH_NIGHT: Object.freeze({
    id: 'MONOLITH_NIGHT',
    label: '야간 모놀리스',
    background: 0x050912,
    fogColor: 0x050912,
    fogDensity: 0.00027,
    terrainLow: 0x0b121e,
    terrainMid: 0x132033,
    terrainHigh: 0x20324c,
    terrainGreen: 0x122624,
    greenOverlay: 0x152e29,
    skirt: 0x090f19,
    water: 0x0f3b5c,
    roadCasing: 0x080d16,
    roadMajor: 0x52657f,
    roadPrimary: 0x3b4d65,
    roadMinor: 0x223044,
    rail: 0x5b6c82,
    bridgeDeck: 0x2c3a4f,
    contour: 0x283c58,
    contourOpacity: 0.36,
    bldgLow: 0x62738c,
    bldgMid: 0x8094b0,
    bldgHigh: 0xa4b8d2,
    hemiSky: 0x9fb8dc,
    hemiGround: 0x1d293a,
    hemiIntensity: 1.42,
    sunColor: 0xfff3de,
    sunIntensity: 2.25,
    rimColor: 0x6b93c4,
    rimIntensity: 0.68,
    xrayColor: 0x1e293b,
    treeConifer: 0x1b3933,
    treeBroadleaf: 0x24473f,
    horizonRing: 0x334155,
    epicenterRay: 0xe2c799
  }),
  ARCHITECTURAL_DAY: Object.freeze({
    id: 'ARCHITECTURAL_DAY',
    label: '주간 레퍼런스',
    background: 0xe5e9e2,
    fogColor: 0xe5e9e2,
    fogDensity: 0.00021,
    terrainLow: 0xdfe3da,
    terrainMid: 0xcbd5c1,
    terrainHigh: 0xa1b294,
    terrainGreen: 0xc9d8bd,
    greenOverlay: 0xc5d6b9,
    skirt: 0xb7c0ae,
    water: 0x5394ab,
    roadCasing: 0xb4aea1,
    roadMajor: 0xedcb76,
    roadPrimary: 0xf1df9e,
    roadMinor: 0xf5f2eb,
    rail: 0x9ea799,
    bridgeDeck: 0xc6cdc4,
    contour: 0x8d9b85,
    contourOpacity: 0.28,
    bldgLow: 0xd9dbd5,
    bldgMid: 0xcacdc7,
    bldgHigh: 0xb6c1c3,
    hemiSky: 0xddeaf4,
    hemiGround: 0xb5bfa8,
    hemiIntensity: 1.9,
    sunColor: 0xfff2d8,
    sunIntensity: 2.65,
    rimColor: 0xcce0f2,
    rimIntensity: 0.42,
    xrayColor: 0x64748b,
    treeConifer: 0x55724d,
    treeBroadleaf: 0x6c885f,
    horizonRing: 0x94a38a,
    epicenterRay: 0xc2410c
  })
});

function getXYZ(p) {
  if (Array.isArray(p)) return [p[0] || 0, p[1] || 0, p[2] || 0];
  return [p?.x || 0, p?.y || 0, p?.z || 0];
}

/**
 * Sample a position at normalized arc-length parameter t in [0, 1]
 * along a 3D polyline using cumulative Euclidean distances (Mini Seoul 3D pattern).
 *
 * @param {Array<[number,number,number]|{x:number,y:number,z:number}>} points3D
 * @param {number} normalizedT
 * @returns {{ point: [number, number, number], totalLength: number, segmentIndex: number, segmentFraction: number }}
 */
export function samplePointAlong3D(points3D, normalizedT = 0.0) {
  if (!Array.isArray(points3D) || points3D.length === 0) {
    return { point: [0, 0, 0], totalLength: 0, segmentIndex: 0, segmentFraction: 0 };
  }
  if (points3D.length === 1) {
    return { point: getXYZ(points3D[0]), totalLength: 0, segmentIndex: 0, segmentFraction: 0 };
  }

  const pts = points3D.map(getXYZ);
  const cumLengths = new Float64Array(pts.length);
  cumLengths[0] = 0;

  for (let i = 1; i < pts.length; i++) {
    const dx = pts[i][0] - pts[i - 1][0];
    const dy = pts[i][1] - pts[i - 1][1];
    const dz = pts[i][2] - pts[i - 1][2];
    cumLengths[i] = cumLengths[i - 1] + Math.hypot(dx, dy, dz);
  }

  const totalLength = cumLengths[pts.length - 1];
  const clampedT = Math.max(0.0, Math.min(1.0, Number.isFinite(normalizedT) ? normalizedT : 0.0));

  if (totalLength <= 1e-9) {
    return { point: pts[0], totalLength: 0, segmentIndex: 0, segmentFraction: 0 };
  }

  const targetDist = clampedT * totalLength;
  for (let i = 1; i < pts.length; i++) {
    if (targetDist <= cumLengths[i] || i === pts.length - 1) {
      const segStart = cumLengths[i - 1];
      const segLen = Math.max(1e-9, cumLengths[i] - segStart);
      const frac = Math.max(0.0, Math.min(1.0, (targetDist - segStart) / segLen));
      return {
        point: [
          pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * frac,
          pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * frac,
          pts[i - 1][2] + (pts[i][2] - pts[i - 1][2]) * frac
        ],
        totalLength,
        segmentIndex: i - 1,
        segmentFraction: frac
      };
    }
  }

  return {
    point: pts[pts.length - 1],
    totalLength,
    segmentIndex: pts.length - 2,
    segmentFraction: 1.0
  };
}

function rectsOverlap(a, b, pad = 0) {
  return !(
    a.right + pad <= b.left ||
    a.left - pad >= b.right ||
    a.bottom + pad <= b.top ||
    a.top - pad >= b.bottom
  );
}

/**
 * Priority-sorted 2D AABB label collision solver (StationLabels pattern).
 * Avoids overlaps with both fixed HUD panels (obstacleRects) and higher-priority labels.
 *
 * @param {Array<{ id: string, screenX: number, screenY: number, width: number, height: number, priority: number, inFront?: boolean }>} candidates
 * @param {Array<{ left: number, top: number, right: number, bottom: number }>} obstacleRects
 * @param {{ width: number, height: number }} viewport
 * @param {number} [padding=6]
 * @returns {{ visibleLabels: Array<Object>, hiddenIds: Array<string> }}
 */
export function solveLabelCollisions2D(
  candidates = [],
  obstacleRects = [],
  viewport = { width: 1280, height: 800 },
  padding = 6
) {
  const sorted = [...candidates].sort((a, b) => (b.priority || 0) - (a.priority || 0));
  const placedRects = [];
  const visibleLabels = [];
  const hiddenIds = [];

  const margin = 8;
  const vpW = Math.max(1, viewport?.width || 1280);
  const vpH = Math.max(1, viewport?.height || 800);

  for (const item of sorted) {
    if (item.inFront === false) {
      hiddenIds.push(item.id);
      continue;
    }

    const w = item.width || 120;
    const h = item.height || 26;
    const rect = {
      left: item.screenX - w * 0.5,
      top: item.screenY - h - 8,
      right: item.screenX + w * 0.5,
      bottom: item.screenY - 8
    };

    if (
      rect.left < margin ||
      rect.right > vpW - margin ||
      rect.top < margin ||
      rect.bottom > vpH - margin
    ) {
      hiddenIds.push(item.id);
      continue;
    }

    let blocked = false;
    for (const hudRect of obstacleRects) {
      if (rectsOverlap(rect, hudRect, padding)) {
        blocked = true;
        break;
      }
    }
    if (!blocked) {
      for (const prevRect of placedRects) {
        if (rectsOverlap(rect, prevRect, padding)) {
          blocked = true;
          break;
        }
      }
    }

    if (blocked) {
      hiddenIds.push(item.id);
    } else {
      placedRects.push(rect);
      visibleLabels.push({ ...item, rect });
    }
  }

  return { visibleLabels, hiddenIds };
}

function buildingHash(east_m, north_m) {
  const n = Math.sin(east_m * 0.13243 + north_m * 0.21973) * 43758.5453;
  return n - Math.floor(n);
}

/**
 * Sample terrain elevation (meters) from an arbitrary spatial package's bilinear grid,
 * falling back seamlessly to Hanyang baseline sampler if no custom grid is provided.
 */
export function sampleGridHeightAt(grid, east_m = 0, north_m = 0) {
  if (!grid || !Array.isArray(grid.heights) || grid.heights.length === 0) {
    return sampleTerrainHeight(east_m, north_m);
  }
  const { nx, nz, halfExtentMeters, heights } = grid;
  const span = (halfExtentMeters || 1100) * 2.0;
  const gx = Math.max(0, Math.min(nx - 1e-6, ((east_m + (halfExtentMeters || 1100)) / span) * nx));
  const gn = Math.max(0, Math.min(nz - 1e-6, ((north_m + (halfExtentMeters || 1100)) / span) * nz));
  const ix = Math.floor(gx);
  const inIdx = Math.floor(gn);
  const fx = gx - ix;
  const fn = gn - inIdx;
  const row = nx + 1;
  const idx0 = inIdx * row + ix;
  const h00 = heights[idx0] ?? 0;
  const h10 = heights[idx0 + 1] ?? h00;
  const h01 = heights[idx0 + row] ?? h00;
  const h11 = heights[idx0 + row + 1] ?? h00;
  return (h00 * (1.0 - fx) + h10 * fx) * (1.0 - fn) + (h01 * (1.0 - fx) + h11 * fx) * fn;
}

/**
 * Convert an array of [east_m, north_m] pairs into a terrain-draped Three.js BufferGeometry ribbon
 * oriented in the X=East, Y=elevation, Z=-North horizontal plane.
 */
function createRibbonGeometry(pointsEN, widthMeters, fixedElevationY = null, elevationOffset = 0.22, terrainGrid = null) {
  if (!pointsEN || pointsEN.length < 2) return new THREE.BufferGeometry();

  const halfW = widthMeters * 0.5;
  const positions = [];
  const indices = [];

  for (let i = 0; i < pointsEN.length; i++) {
    const pPrev = pointsEN[Math.max(0, i - 1)];
    const pNext = pointsEN[Math.min(pointsEN.length - 1, i + 1)];
    const pCur = pointsEN[i];

    let dx = pNext[0] - pPrev[0];
    let dz = -(pNext[1] - pPrev[1]);
    const len = Math.hypot(dx, dz) || 1.0;
    dx /= len;
    dz /= len;

    const nx = -dz;
    const nz = dx;

    const cx = pCur[0];
    const cz = -pCur[1];
    const cy = fixedElevationY !== null
      ? fixedElevationY
      : sampleGridHeightAt(terrainGrid, pCur[0], pCur[1]) + elevationOffset;

    positions.push(
      cx + nx * halfW, cy, cz + nz * halfW,
      cx - nx * halfW, cy, cz - nz * halfW
    );

    if (i > 0) {
      const base = (i - 1) * 2;
      indices.push(base, base + 1, base + 2);
      indices.push(base + 1, base + 3, base + 2);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

/**
 * Subdivide polyline edges exceeding maxStepMeters so long road ribbons follow terrain relief smoothly.
 */
function subdividePolylineEN(pointsEN, maxStepMeters = 45.0) {
  if (!pointsEN || pointsEN.length < 2) return pointsEN || [];
  const out = [pointsEN[0]];
  for (let i = 1; i < pointsEN.length; i++) {
    const a = pointsEN[i - 1];
    const b = pointsEN[i];
    const dist = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const steps = Math.max(1, Math.ceil(dist / maxStepMeters));
    for (let s = 1; s <= steps; s++) {
      const t = s / steps;
      out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
    }
  }
  return out;
}

/**
 * Merge many [cls, bridge, pointsEN] chains into a single BufferGeometry for minimal draw calls.
 * Supports optional width delta (for outer street casing/curbs) and elevation delta.
 */
function createMergedRoadGeometry(segments, widthResolver, terrainGrid = null, opts = {}) {
  const { widthPad = 0, elevDelta = 0 } = opts;
  const positions = [];
  const indices = [];

  for (const seg of segments) {
    const cls = seg[0];
    const bridge = seg[1];
    const rawPts = seg[2];
    if (!rawPts || rawPts.length < 2) continue;

    const pts = subdividePolylineEN(rawPts, 42.0);
    const halfW = Math.max(0.6, (widthResolver(cls) + widthPad) * 0.5);
    const baseVertex = positions.length / 3;

    for (let i = 0; i < pts.length; i++) {
      const pPrev = pts[Math.max(0, i - 1)];
      const pNext = pts[Math.min(pts.length - 1, i + 1)];
      const pCur = pts[i];

      let dx = pNext[0] - pPrev[0];
      let dz = -(pNext[1] - pPrev[1]);
      const len = Math.hypot(dx, dz) || 1.0;
      dx /= len;
      dz /= len;

      const nx = -dz;
      const nz = dx;
      const h = sampleGridHeightAt(terrainGrid, pCur[0], pCur[1]);
      const elev = (bridge
        ? Math.max(h, -15.6) + 3.6
        : h + (cls === 'motorway' || cls === 'trunk' ? 0.52 : cls === 'primary' ? 0.42 : 0.30)) + elevDelta;

      positions.push(
        pCur[0] + nx * halfW, elev, -pCur[1] + nz * halfW,
        pCur[0] - nx * halfW, elev, -pCur[1] - nz * halfW
      );

      if (i > 0) {
        const v0 = baseVertex + (i - 1) * 2;
        indices.push(v0, v0 + 1, v0 + 2);
        indices.push(v0 + 1, v0 + 3, v0 + 2);
      }
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

/**
 * Build single merged architectural bridge slab + side parapet rails + support piers
 * for road segments carrying bridge=1.
 */
function createBridgeStructuresGeometry(segments, widthResolver, terrainGrid = null) {
  const positions = [];
  const indices = [];

  const pushBox = (cx, cy, cz, w, h, d, yaw) => {
    const hw = w * 0.5;
    const hh = h * 0.5;
    const hd = d * 0.5;
    const cos = Math.cos(yaw);
    const sin = Math.sin(yaw);
    const base = positions.length / 3;
    const corners = [
      [-hw, -hh, -hd], [hw, -hh, -hd], [hw, hh, -hd], [-hw, hh, -hd],
      [-hw, -hh, hd], [hw, -hh, hd], [hw, hh, hd], [-hw, hh, hd]
    ];
    for (const [lx, ly, lz] of corners) {
      positions.push(cx + lx * cos + lz * sin, cy + ly, cz - lx * sin + lz * cos);
    }
    const faces = [
      0, 2, 1, 0, 3, 2,
      4, 5, 6, 4, 6, 7,
      0, 1, 5, 0, 5, 4,
      2, 3, 7, 2, 7, 6,
      1, 2, 6, 1, 6, 5,
      3, 0, 4, 3, 4, 7
    ];
    for (const f of faces) indices.push(base + f);
  };

  for (const seg of segments) {
    if (!seg[1]) continue;
    const cls = seg[0];
    const pts = subdividePolylineEN(seg[2], 32.0);
    if (!pts || pts.length < 2) continue;
    const roadW = widthResolver(cls) + 1.2;

    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1];
      const b = pts[i];
      const segLen = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (segLen < 1.5) continue;

      const mx = (a[0] + b[0]) * 0.5;
      const mn = (a[1] + b[1]) * 0.5;
      const mz = -mn;
      const ha = Math.max(sampleGridHeightAt(terrainGrid, a[0], a[1]), -15.6) + 3.6;
      const hb = Math.max(sampleGridHeightAt(terrainGrid, b[0], b[1]), -15.6) + 3.6;
      const deckTop = (ha + hb) * 0.5 - 0.08;
      const yaw = Math.atan2(-(b[0] - a[0]), -(b[1] - a[1]));

      // Deck slab + crisp left/right parapet rails
      pushBox(mx, deckTop - 0.55, mz, roadW, 1.1, segLen + 0.6, yaw);
      const rx = Math.cos(yaw) * (roadW * 0.5 - 0.25);
      const rz = -Math.sin(yaw) * (roadW * 0.5 - 0.25);
      pushBox(mx + rx, deckTop + 0.42, mz + rz, 0.42, 0.85, segLen + 0.4, yaw);
      pushBox(mx - rx, deckTop + 0.42, mz - rz, 0.42, 0.85, segLen + 0.4, yaw);

      // Vertical support pier every bridge segment >= 12m
      if (segLen >= 10.0) {
        const groundY = sampleGridHeightAt(terrainGrid, mx, mn);
        const pierH = Math.max(2.0, deckTop - 0.9 - (groundY - 2.0));
        pushBox(mx, deckTop - 0.9 - pierH * 0.5, mz, Math.min(2.6, roadW * 0.38), pierH, 1.4, yaw);
      }
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

/**
 * Append non-indexed positions from a unit Three.js geometry with offset/scale transform into buffers.
 */
function appendPartGeometry(srcGeo, sx, sy, sz, ox, oy, oz, posOut, normOut, toneOut, toneVal) {
  const g = srcGeo.index ? srcGeo.toNonIndexed() : srcGeo;
  const pAttr = g.getAttribute('position');
  const nAttr = g.getAttribute('normal');
  for (let i = 0; i < pAttr.count; i++) {
    posOut.push(
      pAttr.getX(i) * sx + ox,
      pAttr.getY(i) * sy + oy,
      pAttr.getZ(i) * sz + oz
    );
    normOut.push(
      nAttr ? nAttr.getX(i) : 0,
      nAttr ? nAttr.getY(i) : 1,
      nAttr ? nAttr.getZ(i) : 0
    );
    toneOut.push(toneVal, toneVal, toneVal);
  }
  if (g !== srcGeo) g.dispose();
}

/**
 * Sculpted architectural maquette canopy geometries (multi-tier stepped crown + micro-trunk,
 * replacing harsh cartoon ConeGeometry pyramids).
 */
function createConiferMaquetteGeometry() {
  const pos = [];
  const norm = [];
  const col = [];
  const trunk = new THREE.CylinderGeometry(0.06, 0.11, 0.45, 5);
  appendPartGeometry(trunk, 1, 1, 1, 0, 0.22, 0, pos, norm, col, 0.56);
  const c1 = new THREE.CylinderGeometry(0.24, 0.62, 0.62, 7);
  appendPartGeometry(c1, 1, 1, 1, 0, 0.68, 0, pos, norm, col, 0.90);
  const c2 = new THREE.CylinderGeometry(0.14, 0.48, 0.58, 7);
  appendPartGeometry(c2, 1, 1, 1, 0, 1.12, 0, pos, norm, col, 1.00);
  const c3 = new THREE.CylinderGeometry(0.02, 0.30, 0.48, 7);
  appendPartGeometry(c3, 1, 1, 1, 0, 1.52, 0, pos, norm, col, 1.08);
  trunk.dispose(); c1.dispose(); c2.dispose(); c3.dispose();
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(norm, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  return geo;
}

function createBroadleafMaquetteGeometry() {
  const pos = [];
  const norm = [];
  const col = [];
  const trunk = new THREE.CylinderGeometry(0.07, 0.12, 0.44, 5);
  appendPartGeometry(trunk, 1, 1, 1, 0, 0.22, 0, pos, norm, col, 0.55);
  const mainCrown = new THREE.IcosahedronGeometry(0.56, 1);
  appendPartGeometry(mainCrown, 1.05, 0.78, 1.02, 0, 0.80, 0, pos, norm, col, 0.98);
  const sideA = new THREE.IcosahedronGeometry(0.36, 1);
  appendPartGeometry(sideA, 1.0, 0.72, 1.0, 0.28, 0.66, 0.14, pos, norm, col, 0.90);
  const sideB = new THREE.IcosahedronGeometry(0.32, 1);
  appendPartGeometry(sideB, 1.0, 0.76, 1.0, -0.24, 0.72, -0.16, pos, norm, col, 1.04);
  trunk.dispose(); mainCrown.dispose(); sideA.dispose(); sideB.dispose();
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(norm, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  return geo;
}

/**
 * Spatial hash grid blocking tree placement inside building footprints and road corridors.
 */
function buildTreeExclusionChecker(pkg) {
  const CELL = 16.0;
  const occupiedCells = new Set();
  const markPt = (e, n, rCells = 0) => {
    const cx = Math.floor(e / CELL);
    const cz = Math.floor(n / CELL);
    for (let dx = -rCells; dx <= rCells; dx++) {
      for (let dz = -rCells; dz <= rCells; dz++) {
        occupiedCells.add(`${cx + dx}:${cz + dz}`);
      }
    }
  };

  const obb = pkg.obbBuildingsFloat32;
  if (obb && obb.length >= OBB_BUILDING_STRIDE) {
    const count = Math.floor(obb.length / OBB_BUILDING_STRIDE);
    for (let i = 0; i < count; i++) {
      const base = i * OBB_BUILDING_STRIDE;
      const e = obb[base + 0];
      const n = obb[base + 1];
      const rad = Math.ceil(Math.max(obb[base + 2], obb[base + 3]) * 0.5 / CELL);
      markPt(e, n, Math.min(2, rad));
    }
  }

  const roads = pkg.denseRoadNetwork || [];
  for (const r of roads) {
    const pts = r[2];
    if (!pts || pts.length < 2) continue;
    const isWide = r[0] === 'motorway' || r[0] === 'trunk' || r[0] === 'primary';
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1];
      const b = pts[i];
      const dist = Math.hypot(b[0] - a[0], b[1] - a[1]);
      const steps = Math.max(1, Math.ceil(dist / 10.0));
      for (let s = 0; s <= steps; s++) {
        const t = s / steps;
        markPt(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, isWide ? 1 : 0);
      }
    }
  }

  return (e, n) => {
    const key = `${Math.floor(e / CELL)}:${Math.floor(n / CELL)}`;
    return occupiedCells.has(key);
  };
}

/**
 * Triangulate polygon features in ENU coords ([east_m, north_m]) into a single BufferGeometry.
 */
function createTriangulatedPolygonsGeometry(polyItems, isWater = false, terrainGrid = null) {
  const positions = [];
  for (const item of polyItems) {
    const outerPts = isWater ? item.outer : item;
    if (!Array.isArray(outerPts) || outerPts.length < 3) continue;

    const cleanOuter = outerPts.slice();
    if (cleanOuter.length > 2) {
      const first = cleanOuter[0];
      const last = cleanOuter[cleanOuter.length - 1];
      if (Math.hypot(first[0] - last[0], first[1] - last[1]) < 0.05) {
        cleanOuter.pop();
      }
    }
    if (cleanOuter.length < 3) continue;

    const outer2D = cleanOuter.map(([e, n]) => new THREE.Vector2(e, -n));
    const hole2Ds = [];
    if (isWater && Array.isArray(item.holes)) {
      for (const hr of item.holes) {
        const cleanHole = hr.slice();
        if (cleanHole.length > 2) {
          const f = cleanHole[0];
          const l = cleanHole[cleanHole.length - 1];
          if (Math.hypot(f[0] - l[0], f[1] - l[1]) < 0.05) cleanHole.pop();
        }
        if (cleanHole.length >= 3) {
          hole2Ds.push(cleanHole.map(([e, n]) => new THREE.Vector2(e, -n)));
        }
      }
    }

    const faces = THREE.ShapeUtils.triangulateShape(outer2D, hole2Ds);
    const flatPts = [outer2D, ...hole2Ds].flat();
    const fixedY = (isWater && Number.isFinite(item.y)) ? item.y : null;

    for (const face of faces) {
      const a = flatPts[face[0]];
      const b = flatPts[face[1]];
      const c = flatPts[face[2]];
      if (!a || !b || !c) continue;
      const cross = (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
      if (Math.abs(cross) < 1e-6) continue;
      // Ensure +Y upward winding in Three.js XZ plane
      const order = cross > 0 ? [face[0], face[2], face[1]] : face;
      for (const k of order) {
        const p = flatPts[k];
        const rawY = fixedY !== null ? fixedY : sampleGridHeightAt(terrainGrid, p.x, -p.y) + 0.14;
        const yVal = Number.isFinite(rawY) ? rawY : -12.0;
        positions.push(p.x, yVal, p.y);
      }
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.computeVertexNormals();
  return geo;
}

export class LocalSpatialMapLayer {
  constructor(arg1 = null, arg2 = {}) {
    let scene = null;
    let options = {};
    if (arg1 && (arg1.isScene || typeof arg1.add === 'function')) {
      scene = arg1;
      options = arg2 || {};
    } else {
      options = arg1 || {};
      scene = options.scene || null;
    }

    this.scene = scene;
    this.renderer = options.renderer || null;
    this.pkg = options.spatialPackage || HANYANG_LOCAL_4KM_PACKAGE;
    this.disposables = [];

    this.rootGroup = new THREE.Group();
    this.rootGroup.name = 'LocalSpatial4kmRoot';

    const requestedTheme = options.theme === 'ARCHITECTURAL_DAY' ? 'ARCHITECTURAL_DAY' : 'MONOLITH_NIGHT';
    this.state = {
      theme: requestedTheme,
      lodMode: 'FULL', // 'OVERVIEW' | 'FULL'
      xRayEnabled: false,
      xRayOpacity: 0.16,
      xRayManualOverride: null,
      ecoMode: Boolean(options.ecoMode),
      visibleLabelCount: 0,
      hiddenLabelCount: 0,
      lastLabelUpdateMs: 0,
      currentStage: CAMERA_STAGES.CAMPUS_OVERVIEW
    };

    this.instancedBuildings = null;
    this.extrudedBuildingsMesh = null;
    this._extrudedTriMeta = [];
    this._extrudedPolygonsRef = [];
    this._extrudedOverviewVertexCount = 0;
    this._extrudedFullVertexCount = 0;
    this.buildingMaterial = null;
    this._buildingDataRef = null;
    this.terrainMesh = null;
    this.terrainBaseFloor = null;
    this.terrainSkirtMesh = null;
    this.waterPolygonMat = null;
    this.waterRibbonMat = null;
    this.waterBankMat = null;
    this.greenOverlayMat = null;
    this.contourMat = null;
    this.roadMats = {};
    this.roadCasingMat = null;
    this.bridgeMat = null;
    this._terrainUniforms = null;
    this._buildingUniforms = null;
    this._waterUniforms = null;
    this._envMaps = null;
    this.hemiLight = null;
    this.sunLight = null;
    this.rimLight = null;
    this.coniferTreesMesh = null;
    this.broadleafTreesMesh = null;
    this.nightWindowsPoints = null;
    this.horizonCompassMat = null;
    this.epicenterGuideGroup = new THREE.Group();
    this.epicenterGuideGroup.name = 'EpicenterBearingHorizonGuide';
    this._epicenterRayMat = null;
    this._epicenterWaveArcs = [];
    const initOrig = this.pkg?.defaultOriginMeta || (this.pkg?.isHanyangNative !== false && this.pkg?.metadata?.packageId?.includes('HANYANG')
      ? { id: 'BLDG_212_ENG1', name: '제1공학관(212동)', east_m: 52.0, north_m: 74.0, height_m: 21.5 }
      : null);
    this._activeOriginMeta = initOrig
      ? {
          id: initOrig.id || 'DYNAMIC_ORIGIN',
          title: initOrig.markerMode === 'USER_GPS'
            ? `내 현재 위치(GPS) · ${initOrig.name || '분석 지점'}`
            : (initOrig.originHasBuilding === false ? `분석 기준 · ${initOrig.name || '지정 지점'}` : `출발 기준 · ${initOrig.name || '지정 건물'}`),
          east_m: initOrig.east_m ?? 0,
          north_m: initOrig.north_m ?? 0,
          height_m: initOrig.height_m ?? 18,
          hasBuilding: initOrig.originHasBuilding !== false,
          markerMode: initOrig.markerMode || (initOrig.originHasBuilding === false ? 'FREE_MODE_ANCHOR' : 'PICKED_BUILDING')
        }
      : { id: 'ANALYSIS_ORIGIN', title: '분석 기준 지점', east_m: 0, north_m: 0, height_m: 0, hasBuilding: false, markerMode: 'UNSELECTED' };

    this.unitBoxGeometry = this._track(new THREE.BoxGeometry(1, 1, 1));
    this.chunkManager = options.chunkManager || new SpatialChunkManager();
    this.chunkGroup = new THREE.Group();
    this.chunkGroup.name = 'StreamedSpatialChunks3km';
    this.chunkMeshes = new Map();
    this.hazardPolygonGroup = new THREE.Group();
    this.hazardPolygonGroup.name = 'HazardAvoidPolygonsGroup';
    this.activeHazardPolygons = [];
    this.labelAnchors = [];
    this._labelDomMap = new Map();

    this._buildLocalLighting();
    this._buildTerrainMesh();
    this._buildTerrainContours();
    this._buildWaterwaysAndAlluvialCaution();
    this._buildRoadNetwork();
    this._buildContextBuildingsInstancedMesh();
    this._buildTrees();
    this._buildNightWindows();
    this._buildHorizonCompassAndEpicenterGuide();
    this._buildSheltersAndFacilities();
    this._buildLabelAnchors();
    this.rootGroup.add(this.epicenterGuideGroup);
    this.rootGroup.add(this.chunkGroup);
    this.rootGroup.add(this.hazardPolygonGroup);

    this.setVisualTheme(this.state.theme);

    if (this.state.ecoMode) {
      this.setEcoMode(true);
    }

    if (this.scene) {
      this.scene.add(this.rootGroup);
    }
  }

  _getThemePalette() {
    return LOCAL_VISUAL_THEMES[this.state.theme] || LOCAL_VISUAL_THEMES.MONOLITH_NIGHT;
  }

  _sampleTerrainHeight(east_m = 0, north_m = 0) {
    return sampleGridHeightAt(this.pkg?.terrainGrid, east_m, north_m);
  }

  /**
   * Pick a rendered building (either extruded OSM polygon or OBB instance) via Three.js Raycaster.
   */
  _getNamedBuildingMap() {
    if (this._namedByObbIdx && this._namedMapPkgRef === this.pkg) {
      return this._namedByObbIdx;
    }
    const map = new Map();
    const namedList = this.pkg?.namedBuildings || [];
    const data = this._buildingDataRef;
    const nObb = data ? Math.floor(data.length / OBB_BUILDING_STRIDE) : 0;
    if (namedList.length > 0 && nObb > 0) {
      for (const nb of namedList) {
        let bestIdx = -1;
        let bestD = 22.0;
        for (let i = 0; i < nObb; i++) {
          const base = i * OBB_BUILDING_STRIDE;
          const d = Math.hypot(data[base] - nb.east_m, data[base + 1] - nb.north_m);
          if (d < bestD) {
            bestD = d;
            bestIdx = i;
          }
        }
        if (bestIdx >= 0 && !map.has(bestIdx)) {
          map.set(bestIdx, nb);
        }
      }
    }
    this._namedByObbIdx = map;
    this._namedMapPkgRef = this.pkg;
    return map;
  }

  _resolvePickedBuildingIdentity(idx, east_m, north_m, width_m, depth_m, fallbackId, fallbackName) {
    const exactNamed = this._getNamedBuildingMap().get(idx) || null;
    if (exactNamed) {
      return { buildingId: exactNamed.id, name: exactNamed.name };
    }
    const nearNamed = (this.pkg?.namedBuildings || []).find(b =>
      Math.hypot(b.east_m - east_m, b.north_m - north_m) < Math.max(width_m, depth_m, 22)
    );
    return {
      buildingId: fallbackId,
      name: nearNamed ? `${nearNamed.name} 인근 #${idx}` : fallbackName
    };
  }

  pickBuildingOBBAtRaycast(raycaster) {
    if (!raycaster) return null;

    if (this.extrudedBuildingsMesh && this._extrudedTriMeta.length > 0) {
      const polyHits = raycaster.intersectObject(this.extrudedBuildingsMesh, false);
      if (polyHits && polyHits.length > 0 && typeof polyHits[0].faceIndex === 'number') {
        const vertIdx = polyHits[0].faceIndex * 3;
        let lo = 0;
        let hi = this._extrudedTriMeta.length - 1;
        let found = null;
        while (lo <= hi) {
          const mid = (lo + hi) >> 1;
          const entry = this._extrudedTriMeta[mid];
          if (vertIdx < entry.startVertex) hi = mid - 1;
          else if (vertIdx >= entry.endVertex) lo = mid + 1;
          else { found = entry; break; }
        }
        if (found) {
          const b = found.bldg;
          const exact = (this.pkg?.namedBuildings || []).find(nb =>
            nb.id === b.buildingId || Math.hypot(nb.east_m - b.east_m, nb.north_m - b.north_m) < 12
          );
          return {
            instanceId: found.bldgIdx,
            buildingId: exact ? exact.id : b.buildingId,
            name: exact ? exact.name : b.name,
            east_m: b.east_m,
            north_m: b.north_m,
            width_m: b.width_m,
            depth_m: b.depth_m,
            yaw_rad: b.yaw_rad,
            height_m: b.height_m,
            hitPoint: polyHits[0].point
          };
        }
      }
    }

    if (!this.instancedBuildings) return null;
    const hits = raycaster.intersectObject(this.instancedBuildings, false);
    if (!hits || hits.length === 0) return null;
    const idx = hits[0].instanceId;
    const data = this._buildingDataRef;
    if (typeof idx !== 'number' || !data || idx * OBB_BUILDING_STRIDE + 5 >= data.length) {
      return null;
    }
    const base = idx * OBB_BUILDING_STRIDE;
    const east_m = data[base + 0];
    const north_m = data[base + 1];
    const width_m = data[base + 2];
    const depth_m = data[base + 3];
    const yaw_rad = data[base + 4];
    const height_m = data[base + 5];
    const identity = this._resolvePickedBuildingIdentity(
      idx, east_m, north_m, width_m, depth_m, `OSM_OBB_${idx}`, `도시 건축물 #${idx}`
    );
    return {
      instanceId: idx,
      buildingId: identity.buildingId,
      name: identity.name,
      east_m,
      north_m,
      width_m,
      depth_m,
      yaw_rad,
      height_m,
      hitPoint: hits[0].point
    };
  }

  /**
   * Swap out the rendered 3D urban spatial package dynamically (enables nationwide Korea
   * regions such as Gyeongju, Pohang, Yangyang, Busan, or live coordinates without page reload).
   */
  setSpatialPackage(newSpatialPackage) {
    if (!newSpatialPackage) return;
    this._namedByObbIdx = null;
    this._namedMapPkgRef = null;
    this.setEpicenterContext(null);
    this.setHazardAvoidPolygons([]);
    this.chunkMeshes.clear();
    this.chunkManager.clear();
    while (this.rootGroup.children.length > 0) {
      this.rootGroup.remove(this.rootGroup.children[0]);
    }
    for (const d of this.disposables) {
      if (d && typeof d.dispose === 'function') d.dispose();
    }
    this.disposables = [];
    for (const el of this._labelDomMap.values()) {
      el.remove();
    }
    this._labelDomMap.clear();

    this.pkg = newSpatialPackage;
    this.instancedBuildings = null;
    this.extrudedBuildingsMesh = null;
    this._extrudedTriMeta = [];
    this._extrudedPolygonsRef = [];
    this._extrudedOverviewVertexCount = 0;
    this._extrudedFullVertexCount = 0;
    this._buildingDataRef = null;
    this.terrainMesh = null;
    this.terrainBaseFloor = null;
    this.terrainSkirtMesh = null;
    this.coniferTreesMesh = null;
    this.broadleafTreesMesh = null;
    this.nightWindowsPoints = null;
    this.roadCasingMat = null;
    this.bridgeMat = null;
    this._terrainUniforms = null;
    this._buildingUniforms = null;
    this._waterUniforms = null;
    this.epicenterGuideGroup = new THREE.Group();
    this.epicenterGuideGroup.name = 'EpicenterBearingHorizonGuide';
    this.unitBoxGeometry = this._track(new THREE.BoxGeometry(1, 1, 1));
    this.chunkGroup = new THREE.Group();
    this.chunkGroup.name = 'StreamedSpatialChunks3km';
    this.hazardPolygonGroup = new THREE.Group();
    this.hazardPolygonGroup.name = 'HazardAvoidPolygonsGroup';

    const origMeta = newSpatialPackage.defaultOriginMeta || newSpatialPackage.namedBuildings?.[0] || null;
    if (origMeta) {
      this._activeOriginMeta = {
        id: origMeta.id || 'DYNAMIC_ORIGIN',
        title: `내 위치 · ${origMeta.name || '출발 건물'}`,
        east_m: origMeta.east_m ?? 0,
        north_m: origMeta.north_m ?? 0,
        height_m: origMeta.height_m ?? 18,
        hasBuilding: origMeta.originHasBuilding !== false
      };
    } else if (newSpatialPackage.isHanyangNative) {
      this._activeOriginMeta = { id: 'BLDG_212_ENG1', title: '내 위치 · 제1공학관(212동)', east_m: 52.0, north_m: 74.0, height_m: 21.5, hasBuilding: true };
    } else {
      this._activeOriginMeta = {
        id: 'ANALYSIS_ORIGIN',
        title: newSpatialPackage.dataCompleteness === 'INSUFFICIENT' ? '분석 위치 · 데이터 부족' : '분석 기준 위치',
        east_m: 0,
        north_m: 0,
        height_m: 0,
        hasBuilding: false
      };
    }

    this._buildLocalLighting();
    this._buildTerrainMesh();
    this._buildTerrainContours();
    this._buildWaterwaysAndAlluvialCaution();
    this._buildRoadNetwork();
    this._buildContextBuildingsInstancedMesh();
    this._buildTrees();
    this._buildNightWindows();
    this._buildHorizonCompassAndEpicenterGuide();
    this._buildSheltersAndFacilities();
    this._buildLabelAnchors();
    this.rootGroup.add(this.epicenterGuideGroup);
    this.rootGroup.add(this.chunkGroup);
    this.rootGroup.add(this.hazardPolygonGroup);
    this.setVisualTheme(this.state.theme);
  }

  _track(resource) {
    if (resource) this.disposables.push(resource);
    return resource;
  }

  _buildLocalLighting() {
    const palette = this._getThemePalette();
    const lights = new THREE.Group();
    lights.name = 'LocalSpatialLights4km';

    this.hemiLight = new THREE.HemisphereLight(palette.hemiSky, palette.hemiGround, palette.hemiIntensity);
    lights.add(this.hemiLight);

    this.sunLight = new THREE.DirectionalLight(palette.sunColor, palette.sunIntensity);
    this.sunLight.position.set(-950, 1450, 750);
    this.sunLight.target.position.set(60, 0, 40);
    this.sunLight.castShadow = true;
    this.sunLight.shadow.mapSize.set(2048, 2048);
    Object.assign(this.sunLight.shadow.camera, {
      left: -850,
      right: 850,
      top: 850,
      bottom: -850,
      near: 200,
      far: 3600
    });
    this.sunLight.shadow.bias = -0.0005;
    this.sunLight.shadow.normalBias = 1.5;
    lights.add(this.sunLight);
    lights.add(this.sunLight.target);

    this.rimLight = new THREE.DirectionalLight(palette.rimColor, palette.rimIntensity);
    this.rimLight.position.set(900, 650, -800);
    lights.add(this.rimLight);

    this.rootGroup.add(lights);
  }

  _applyTerrainVertexColors(geometry, grid) {
    const palette = this._getThemePalette();
    const cLow = new THREE.Color(palette.terrainLow);
    const cMid = new THREE.Color(palette.terrainMid);
    const cHigh = new THREE.Color(palette.terrainHigh);
    const cGreen = new THREE.Color(palette.terrainGreen);
    const tmp = new THREE.Color();

    const { nx, nz, heights, greenMask } = grid;
    const count = (nx + 1) * (nz + 1);
    const colors = new Float32Array(count * 3);

    for (let i = 0; i < count; i++) {
      const h = heights[i];
      const tLowMid = Math.max(0, Math.min(1, (h + 15.0) / 16.0));
      const tMidHigh = Math.max(0, Math.min(1, (h - 2.0) / 22.0));
      tmp.copy(cLow).lerp(cMid, tLowMid).lerp(cHigh, tMidHigh);
      if (greenMask && greenMask[i]) {
        tmp.lerp(cGreen, 0.58);
      }
      colors[i * 3 + 0] = tmp.r;
      colors[i * 3 + 1] = tmp.g;
      colors[i * 3 + 2] = tmp.b;
    }

    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    if (geometry.attributes.color) {
      geometry.attributes.color.needsUpdate = true;
    }
  }

  _buildProceduralEnvTexture(isDay) {
    if (typeof document === 'undefined') return null;
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 32;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    const grad = ctx.createLinearGradient(0, 0, 0, 32);
    if (isDay) {
      grad.addColorStop(0.0, '#cfe2f3');
      grad.addColorStop(0.45, '#e8eef0');
      grad.addColorStop(0.55, '#d9dfd2');
      grad.addColorStop(1.0, '#aeb6a4');
    } else {
      grad.addColorStop(0.0, '#101d32');
      grad.addColorStop(0.45, '#1d3252');
      grad.addColorStop(0.55, '#0e1726');
      grad.addColorStop(1.0, '#050810');
    }
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 64, 32);
    const tex = new THREE.CanvasTexture(canvas);
    tex.mapping = THREE.EquirectangularReflectionMapping;
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.needsUpdate = true;
    return tex;
  }

  _applyProceduralEnvironmentIBL(isDay) {
    if (!this.renderer || typeof this.renderer.getContext !== 'function' || !this.scene || this.scene.userData?.preserveGlobalBackground) {
      return;
    }
    try {
      if (!this._envMaps) {
        const pmrem = new THREE.PMREMGenerator(this.renderer);
        pmrem.compileEquirectangularShader();
        const nightSrc = this._buildProceduralEnvTexture(false);
        const daySrc = this._buildProceduralEnvTexture(true);
        const nightRT = nightSrc ? pmrem.fromEquirectangular(nightSrc) : null;
        const dayRT = daySrc ? pmrem.fromEquirectangular(daySrc) : null;
        if (nightSrc) nightSrc.dispose();
        if (daySrc) daySrc.dispose();
        pmrem.dispose();
        this._envMaps = { night: nightRT, day: dayRT };
      }
      const chosen = isDay ? this._envMaps.day : this._envMaps.night;
      if (chosen?.texture) {
        this.scene.environment = chosen.texture;
        this.scene.environmentIntensity = isDay ? 0.52 : 0.45;
      }
    } catch (_) {
      // Safe fallback in headless/stubbed WebGL test environments
    }
  }

  _injectTerrainShader(terrainMat, palette) {
    this._terrainUniforms = {
      uContourColor: { value: new THREE.Color(palette.contour) },
      uContourOpacity: { value: palette.contourOpacity }
    };
    terrainMat.customProgramCacheKey = () => 'seismolive_terrain_contour_v1';
    terrainMat.onBeforeCompile = (shader) => {
      shader.uniforms.uContourColor = this._terrainUniforms.uContourColor;
      shader.uniforms.uContourOpacity = this._terrainUniforms.uContourOpacity;

      shader.vertexShader = shader.vertexShader
        .replace(
          '#include <common>',
          `#include <common>
           varying vec3 vSeismoTerrainWPos;`
        )
        .replace(
          '#include <project_vertex>',
          `#include <project_vertex>
           vSeismoTerrainWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;`
        );

      shader.fragmentShader = shader.fragmentShader
        .replace(
          '#include <common>',
          `#include <common>
           varying vec3 vSeismoTerrainWPos;
           uniform vec3 uContourColor;
           uniform float uContourOpacity;`
        )
        .replace(
          '#include <color_fragment>',
          `#include <color_fragment>
           float hT = vSeismoTerrainWPos.y;
           #if __VERSION__ >= 300 || defined(GL_OES_standard_derivatives)
             float fwH = clamp(fwidth(hT), 0.04, 0.9);
           #else
             float fwH = 0.22;
           #endif
           float minorBand = 1.0 - smoothstep(0.0, fwH * 1.4, abs(fract(hT / 5.0 + 0.5) - 0.5) * 5.0);
           float majorBand = 1.0 - smoothstep(0.0, fwH * 1.7, abs(fract(hT / 25.0 + 0.5) - 0.5) * 25.0);
           float camD = length(cameraPosition - vSeismoTerrainWPos);
           float distFade = 1.0 - smoothstep(380.0, 2100.0, camD);
           float contourStrength = max(minorBand * 0.42, majorBand * 0.92) * distFade * uContourOpacity;
           diffuseColor.rgb = mix(diffuseColor.rgb, uContourColor, clamp(contourStrength, 0.0, 0.52));
           float paperGrain = (fract(sin(dot(floor(vSeismoTerrainWPos.xz * 0.55), vec2(12.9898, 78.233))) * 43758.5453) - 0.5) * 0.012;
           diffuseColor.rgb = max(vec3(0.015), diffuseColor.rgb + paperGrain * (0.35 + 0.65 * distFade));`
        );
    };
  }

  _injectBuildingShader(bldgMat, palette) {
    this._buildingUniforms = {
      uIsDay: { value: this.state.theme === 'ARCHITECTURAL_DAY' ? 1.0 : 0.0 },
      uXRay: { value: this.state.xRayEnabled ? 1.0 : 0.0 }
    };
    bldgMat.customProgramCacheKey = () => 'seismolive_arch_bldg_v1';
    bldgMat.onBeforeCompile = (shader) => {
      shader.uniforms.uIsDay = this._buildingUniforms.uIsDay;
      shader.uniforms.uXRay = this._buildingUniforms.uXRay;

      shader.vertexShader = shader.vertexShader
        .replace(
          '#include <common>',
          `#include <common>
           attribute float aGroundY;
           attribute float aBldgHeight;
           varying vec3 vBldgWPos;
           varying vec3 vBldgWNorm;
           varying float vBldgGroundY;
           varying float vBldgHeight;`
        )
        .replace(
          '#include <project_vertex>',
          `#include <project_vertex>
           vec4 seismoBPos = vec4(transformed, 1.0);
           vec3 seismoBNorm = vec3(objectNormal);
           #ifdef USE_INSTANCING
             seismoBPos = instanceMatrix * seismoBPos;
             seismoBNorm = mat3(instanceMatrix) * seismoBNorm;
           #endif
           vBldgWPos = (modelMatrix * seismoBPos).xyz;
           vBldgWNorm = normalize(mat3(modelMatrix) * seismoBNorm);
           vBldgGroundY = aGroundY;
           vBldgHeight = aBldgHeight;`
        );

      shader.fragmentShader = shader.fragmentShader
        .replace(
          '#include <common>',
          `#include <common>
           varying vec3 vBldgWPos;
           varying vec3 vBldgWNorm;
           varying float vBldgGroundY;
           varying float vBldgHeight;
           uniform float uIsDay;
           uniform float uXRay;`
        )
        .replace(
          '#include <color_fragment>',
          `#include <color_fragment>
           float seismoHAbove = max(0.0, vBldgWPos.y - vBldgGroundY);
           float seismoCamDist = length(cameraPosition - vBldgWPos);
           float seismoWallMask = 0.0;
           float seismoWindowHit = 0.0;
           if (uXRay < 0.5) {
             // Ground street-plinth ambient occlusion
             float plinthAO = mix(0.68, 1.0, smoothstep(0.0, 2.8, seismoHAbove));
             diffuseColor.rgb *= plinthAO;

             float isWall = step(abs(vBldgWNorm.y), 0.55);
             float nearFade = 1.0 - smoothstep(240.0, 820.0, seismoCamDist);
             if (isWall > 0.5 && vBldgHeight >= 6.8 && nearFade > 0.01) {
               float floorPhase = fract(seismoHAbove / 3.4);
               float bandV = smoothstep(0.22, 0.34, floorPhase) * (1.0 - smoothstep(0.66, 0.78, floorPhase));
               float bayPhase = fract((vBldgWPos.x * 0.72 + vBldgWPos.z * 0.69) / 3.0);
               float bandH = smoothstep(0.14, 0.24, bayPhase) * (1.0 - smoothstep(0.76, 0.86, bayPhase));
               // Subtle parapet / top cornice rim
               float cornice = smoothstep(vBldgHeight - 0.95, vBldgHeight - 0.15, seismoHAbove);
               diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * 1.10, cornice * 0.40);
               seismoWallMask = bandV * bandH * nearFade * smoothstep(2.2, 4.5, seismoHAbove);
               vec3 glassTint = mix(vec3(0.10, 0.14, 0.21), vec3(0.62, 0.69, 0.75), uIsDay);
               diffuseColor.rgb = mix(diffuseColor.rgb, glassTint, seismoWallMask * mix(0.32, 0.14, uIsDay));
               if (uIsDay < 0.5 && vBldgHeight >= 11.0 && seismoWallMask > 0.25) {
                 vec2 cellId = vec2(floor((vBldgWPos.x * 0.72 + vBldgWPos.z * 0.69) / 3.0), floor(seismoHAbove / 3.4));
                 float cellRnd = fract(sin(dot(cellId, vec2(127.1, 311.7))) * 43758.5453);
                 if (cellRnd > 0.85) seismoWindowHit = cellRnd;
               }
             } else if (vBldgWNorm.y > 0.65) {
               diffuseColor.rgb *= mix(1.04, 1.07, uIsDay);
             }
           }`
        )
        .replace(
          '#include <emissivemap_fragment>',
          `#include <emissivemap_fragment>
           if (seismoWindowHit > 0.0) {
             vec3 winTone = seismoWindowHit > 0.93
               ? vec3(0.56, 0.75, 0.90)
               : vec3(0.90, 0.78, 0.56);
             totalEmissiveRadiance += winTone * 0.22 * seismoWallMask;
           }`
        );
    };
  }

  _injectWaterShader(waterMat) {
    if (!this._waterUniforms) {
      this._waterUniforms = {
        uTime: { value: 0 },
        uIsDay: { value: this.state.theme === 'ARCHITECTURAL_DAY' ? 1.0 : 0.0 }
      };
    }
    waterMat.customProgramCacheKey = () => 'seismolive_water_v1';
    waterMat.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = this._waterUniforms.uTime;
      shader.uniforms.uIsDay = this._waterUniforms.uIsDay;

      shader.vertexShader = shader.vertexShader
        .replace(
          '#include <common>',
          `#include <common>
           varying vec3 vWaterWPos;`
        )
        .replace(
          '#include <project_vertex>',
          `#include <project_vertex>
           vWaterWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;`
        );

      shader.fragmentShader = shader.fragmentShader
        .replace(
          '#include <common>',
          `#include <common>
           varying vec3 vWaterWPos;
           uniform float uTime;
           uniform float uIsDay;`
        )
        .replace(
          '#include <color_fragment>',
          `#include <color_fragment>
           float wRipple = sin(vWaterWPos.x * 0.11 + uTime * 0.65) * cos(vWaterWPos.z * 0.13 - uTime * 0.52);
           float wHighlight = smoothstep(0.35, 0.95, wRipple) * 0.06;
           diffuseColor.rgb += mix(vec3(0.04, 0.10, 0.16), vec3(0.08, 0.12, 0.14), uIsDay) * wHighlight;`
        );
    };
  }

  _buildTerrainMesh() {
    const grid = this.pkg.terrainGrid;
    const palette = this._getThemePalette();

    const baseGeo = this._track(new THREE.PlaneGeometry(14000, 14000));
    baseGeo.rotateX(-Math.PI / 2);
    const baseMat = this._track(new THREE.MeshStandardMaterial({
      color: palette.background,
      roughness: 1.0,
      metalness: 0.0
    }));
    this.terrainBaseFloor = new THREE.Mesh(baseGeo, baseMat);
    this.terrainBaseFloor.position.set(0, -24.5, 0);
    this.terrainBaseFloor.receiveShadow = true;
    this.terrainBaseFloor.name = 'ExtendedGroundHorizon';
    this.rootGroup.add(this.terrainBaseFloor);

    if (!grid || !Array.isArray(grid.heights)) return;

    const { nx, nz, halfExtentMeters, heights } = grid;
    const span = halfExtentMeters * 2.0;
    const positions = [];
    const indices = [];

    for (let j = 0; j <= nz; j++) {
      const north_m = -halfExtentMeters + (j / nz) * span;
      const cz = -north_m;
      for (let i = 0; i <= nx; i++) {
        const east_m = -halfExtentMeters + (i / nx) * span;
        const h = heights[j * (nx + 1) + i];
        positions.push(east_m, h, cz);
        if (i < nx && j < nz) {
          const k = j * (nx + 1) + i;
          indices.push(k, k + 1, k + nx + 1);
          indices.push(k + 1, k + nx + 2, k + nx + 1);
        }
      }
    }

    const geo = this._track(new THREE.BufferGeometry());
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setIndex(indices);
    this._applyTerrainVertexColors(geo, grid);
    geo.computeVertexNormals();

    const terrainMat = this._track(new THREE.MeshStandardMaterial({
      color: 0xffffff,
      vertexColors: true,
      roughness: 0.94,
      metalness: 0.01
    }));
    this._injectTerrainShader(terrainMat, palette);

    this.terrainMesh = new THREE.Mesh(geo, terrainMat);
    this.terrainMesh.name = 'SeongdongTerrainMesh4km';
    this.terrainMesh.receiveShadow = true;
    this.rootGroup.add(this.terrainMesh);

    // Outer architectural slab skirt framing the 4.4km terrain cut
    const baseBottom = -24.2;
    const skirtPos = [];
    const pushQuad = (e0, n0, e1, n1) => {
      const h0 = this._sampleTerrainHeight(e0, n0);
      const h1 = this._sampleTerrainHeight(e1, n1);
      const z0 = -n0;
      const z1 = -n1;
      skirtPos.push(
        e0, baseBottom, z0, e1, h1, z1, e0, h0, z0,
        e0, baseBottom, z0, e1, baseBottom, z1, e1, h1, z1
      );
    };
    const eMin = -halfExtentMeters;
    const eMax = halfExtentMeters;
    for (let i = 0; i < nx; i++) {
      const x0 = eMin + (i / nx) * span;
      const x1 = eMin + ((i + 1) / nx) * span;
      pushQuad(x0, eMin, x1, eMin);
      pushQuad(x1, eMax, x0, eMax);
    }
    for (let j = 0; j < nz; j++) {
      const y0 = eMin + (j / nz) * span;
      const y1 = eMin + ((j + 1) / nz) * span;
      pushQuad(eMax, y0, eMax, y1);
      pushQuad(eMin, y1, eMin, y0);
    }
    const skirtGeo = this._track(new THREE.BufferGeometry());
    skirtGeo.setAttribute('position', new THREE.Float32BufferAttribute(skirtPos, 3));
    skirtGeo.computeVertexNormals();
    const skirtMat = this._track(new THREE.MeshStandardMaterial({
      color: palette.skirt,
      roughness: 0.9,
      side: THREE.DoubleSide
    }));
    this.terrainSkirtMesh = new THREE.Mesh(skirtGeo, skirtMat);
    this.terrainSkirtMesh.name = 'TerrainCutSkirt4km';
    this.rootGroup.add(this.terrainSkirtMesh);
  }

  _buildTerrainContours() {
    const palette = this._getThemePalette();
    const group = new THREE.Group();
    group.name = 'HillslopeContours4km';
    this.contourMat = this._track(new THREE.LineBasicMaterial({
      color: palette.contour,
      transparent: true,
      opacity: palette.contourOpacity
    }));

    const contours = this.pkg.terrainAndHydrology?.hillslopeContours || [];
    for (const c of contours) {
      const pts = c.pointsENU.map(([e, n]) => new THREE.Vector3(e, this._sampleTerrainHeight(e, n) + 0.45, -n));
      const geo = this._track(new THREE.BufferGeometry().setFromPoints(pts));
      const line = new THREE.Line(geo, this.contourMat);
      line.name = c.id;
      group.add(line);
    }

    // In offshore/sparse data voids with zero contours & buildings, draw a faint cartographic graticule so the canvas remains spatially readable
    if (contours.length === 0 && (!this.pkg.obbBuildingsFloat32 || this.pkg.obbBuildingsFloat32.length === 0)) {
      const half = this.pkg.terrainGrid?.halfExtentMeters || 1800;
      const step = 450;
      const gridMat = this._track(new THREE.LineBasicMaterial({
        color: palette.contour,
        transparent: true,
        opacity: Math.max(0.14, palette.contourOpacity * 0.65)
      }));
      const verts = [];
      for (let v = -half; v <= half; v += step) {
        verts.push(v, this._sampleTerrainHeight(v, 0) + 0.6, -half, v, this._sampleTerrainHeight(v, 0) + 0.6, half);
        verts.push(-half, this._sampleTerrainHeight(0, v) + 0.6, -v, half, this._sampleTerrainHeight(0, v) + 0.6, -v);
      }
      const gridGeo = this._track(new THREE.BufferGeometry());
      gridGeo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
      const gridLines = new THREE.LineSegments(gridGeo, gridMat);
      gridLines.name = 'SparseCartographicGraticule';
      group.add(gridLines);
    }
    this.rootGroup.add(group);
  }

  _buildWaterwaysAndAlluvialCaution() {
    const palette = this._getThemePalette();
    const group = new THREE.Group();
    group.name = 'HydrologyAndAlluvialCaution4km';

    this.waterPolygonMat = this._track(new THREE.MeshStandardMaterial({
      color: palette.water,
      roughness: 0.16,
      metalness: 0.22,
      envMapIntensity: 1.35,
      side: THREE.DoubleSide
    }));
    this._injectWaterShader(this.waterPolygonMat);

    this.waterRibbonMat = this._track(new THREE.MeshStandardMaterial({
      color: palette.water,
      roughness: 0.18,
      metalness: 0.20,
      envMapIntensity: 1.28,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.88
    }));
    this._injectWaterShader(this.waterRibbonMat);

    this.greenOverlayMat = this._track(new THREE.MeshStandardMaterial({
      color: palette.greenOverlay,
      roughness: 0.93,
      metalness: 0.0,
      side: THREE.DoubleSide
    }));

    // 1. Real Triangulated Green/Park Polygons
    const greenPolys = this.pkg.terrainAndHydrology?.greenPolygons || [];
    if (greenPolys.length > 0) {
      const greenGeo = this._track(createTriangulatedPolygonsGeometry(greenPolys, false, this.pkg.terrainGrid));
      const greenMesh = new THREE.Mesh(greenGeo, this.greenOverlayMat);
      greenMesh.name = 'RealGreenParkPolygons4km';
      greenMesh.receiveShadow = true;
      group.add(greenMesh);
    }

    // 2. Real Triangulated Water Polygons
    const waterPolys = this.pkg.terrainAndHydrology?.waterPolygons || [];
    if (waterPolys.length > 0) {
      const waterGeo = this._track(createTriangulatedPolygonsGeometry(waterPolys, true, this.pkg.terrainGrid));
      const waterMesh = new THREE.Mesh(waterGeo, this.waterPolygonMat);
      waterMesh.name = 'RealWaterwayPolygons4km';
      waterMesh.receiveShadow = true;
      group.add(waterMesh);
    }

    // 3. Fallback / Named River Centerline Ribbons (smooth water surface without jagged wireframe line clutter)
    const waterways = this.pkg.terrainAndHydrology?.waterways || [];
    for (const w of waterways) {
      if (waterPolys.length === 0) {
        const ribbonGeo = this._track(createRibbonGeometry(w.pointsEN, w.widthMeters, w.elevationY, 0.22, this.pkg.terrainGrid));
        const ribbonMesh = new THREE.Mesh(ribbonGeo, this.waterRibbonMat);
        ribbonMesh.name = w.id;
        ribbonMesh.receiveShadow = true;
        group.add(ribbonMesh);
      }
    }

    // 4. PROVISIONAL Alluvial Basin Caution Zone (strictly dashed subtle slate — zero rainbow heatmap)
    const caution = this.pkg.terrainAndHydrology?.alluvialCautionZone;
    if (caution && Array.isArray(caution.polygonEN)) {
      const pts = caution.polygonEN.map(([e, n]) => new THREE.Vector3(e, Math.max(caution.elevationY, this._sampleTerrainHeight(e, n) + 0.55), -n));
      const lineGeo = this._track(new THREE.BufferGeometry().setFromPoints(pts));
      const dashMat = this._track(new THREE.LineDashedMaterial({
        color: 0x64748b,
        dashSize: 22.0,
        gapSize: 14.0,
        transparent: true,
        opacity: 0.72
      }));
      const cautionOutline = new THREE.Line(lineGeo, dashMat);
      cautionOutline.computeLineDistances();
      cautionOutline.name = caution.id;
      cautionOutline.userData.verificationStatus = VERIFICATION_STATUS.PROVISIONAL;
      group.add(cautionOutline);
    }

    this.rootGroup.add(group);
  }

  _buildRoadNetwork() {
    const palette = this._getThemePalette();
    const group = new THREE.Group();
    group.name = 'LocalRoadNetwork4km';

    this.roadCasingMat = this._track(new THREE.MeshStandardMaterial({
      color: palette.roadCasing,
      roughness: 0.96,
      metalness: 0.0,
      side: THREE.DoubleSide
    }));
    this.bridgeMat = this._track(new THREE.MeshStandardMaterial({
      color: palette.bridgeDeck,
      roughness: 0.85,
      metalness: 0.06
    }));
    this.roadMats = {
      major: this._track(new THREE.MeshStandardMaterial({
        color: palette.roadMajor,
        roughness: 0.88,
        metalness: 0.04,
        side: THREE.DoubleSide
      })),
      primary: this._track(new THREE.MeshStandardMaterial({
        color: palette.roadPrimary,
        roughness: 0.90,
        metalness: 0.03,
        side: THREE.DoubleSide
      })),
      minor: this._track(new THREE.MeshStandardMaterial({
        color: palette.roadMinor,
        roughness: 0.94,
        metalness: 0.02,
        side: THREE.DoubleSide
      })),
      rail: this._track(new THREE.MeshStandardMaterial({
        color: palette.rail,
        roughness: 0.78,
        metalness: 0.14,
        side: THREE.DoubleSide
      }))
    };

    const denseRoads = this.pkg.denseRoadNetwork || [];
    if (denseRoads.length > 0) {
      const majorSegs = denseRoads.filter(r => r[0] === 'motorway' || r[0] === 'trunk');
      const primarySegs = denseRoads.filter(r => r[0] === 'primary');
      const minorSegs = denseRoads.filter(r => r[0] === 'secondary' || r[0] === 'tertiary');
      const footwaySegs = denseRoads.filter(r => r[0] === 'footway');
      const railSegs = denseRoads.filter(r => r[0] === 'rail');
      const casedSegs = denseRoads.filter(r =>
        r[0] === 'motorway' || r[0] === 'trunk' || r[0] === 'primary' || r[0] === 'secondary' || r[0] === 'tertiary'
      );
      const bridgeSegs = denseRoads.filter(r => r[1] === 1 && r[0] !== 'rail');
      const stdWidthFn = c => (c === 'motorway' ? 26.0 : c === 'trunk' ? 22.0 : c === 'primary' ? 17.5 : c === 'secondary' ? 10.5 : c === 'tertiary' ? 6.8 : 2.6);

      if (casedSegs.length > 0) {
        const casingGeo = this._track(createMergedRoadGeometry(casedSegs, stdWidthFn, this.pkg.terrainGrid, {
          widthPad: 2.2,
          elevDelta: -0.08
        }));
        const casingMesh = new THREE.Mesh(casingGeo, this.roadCasingMat);
        casingMesh.name = 'DenseRoads_Casing4km';
        casingMesh.receiveShadow = true;
        group.add(casingMesh);
      }

      if (bridgeSegs.length > 0) {
        const bridgeGeo = this._track(createBridgeStructuresGeometry(bridgeSegs, stdWidthFn, this.pkg.terrainGrid));
        const bridgeMesh = new THREE.Mesh(bridgeGeo, this.bridgeMat);
        bridgeMesh.name = 'LocalBridgeStructures4km';
        bridgeMesh.castShadow = true;
        bridgeMesh.receiveShadow = true;
        group.add(bridgeMesh);
      }

      const tiers = [
        { segs: footwaySegs, mat: this.roadMats.minor, widthFn: () => 2.6, name: 'DenseRoads_Footways4km' },
        { segs: minorSegs, mat: this.roadMats.minor, widthFn: stdWidthFn, name: 'DenseRoads_Minor4km' },
        { segs: primarySegs, mat: this.roadMats.primary, widthFn: stdWidthFn, name: 'DenseRoads_Primary4km' },
        { segs: majorSegs, mat: this.roadMats.major, widthFn: stdWidthFn, name: 'DenseRoads_Major4km' },
        { segs: railSegs, mat: this.roadMats.rail, widthFn: () => 6.2, name: 'DenseRoads_Rail4km' }
      ];

      for (const tier of tiers) {
        if (tier.segs.length === 0) continue;
        const geo = this._track(createMergedRoadGeometry(tier.segs, tier.widthFn, this.pkg.terrainGrid));
        const mesh = new THREE.Mesh(geo, tier.mat);
        mesh.name = tier.name;
        mesh.receiveShadow = true;
        group.add(mesh);
      }
    } else {
      const roads = this.pkg.roadNetwork || [];
      for (const r of roads) {
        const mat = r.hierarchy === 'ARTERIAL' ? this.roadMats.primary : this.roadMats.minor;
        const geo = this._track(createRibbonGeometry(r.pointsEN, r.widthMeters, null, 0.35, this.pkg.terrainGrid));
        const mesh = new THREE.Mesh(geo, mat);
        mesh.name = r.id;
        mesh.receiveShadow = true;
        group.add(mesh);
      }
    }

    this.rootGroup.add(group);
  }

  _resolveBuildingToneColor(east_m, north_m, h, cLow, cMid, cHigh, outColor) {
    const baseHex = h >= 42 ? cHigh : (h >= 14 ? cMid : cLow);
    const toneVar = 0.87 + buildingHash(east_m, north_m) * 0.22;
    return outColor.copy(baseHex).multiplyScalar(toneVar);
  }

  _applyBuildingInstanceColors(mesh, data) {
    if (!mesh || !data) return;
    const palette = this._getThemePalette();
    const cLow = new THREE.Color(palette.bldgLow);
    const cMid = new THREE.Color(palette.bldgMid);
    const cHigh = new THREE.Color(palette.bldgHigh);
    const color = new THREE.Color();
    const count = Math.floor(data.length / OBB_BUILDING_STRIDE);

    for (let i = 0; i < count; i++) {
      const base = i * OBB_BUILDING_STRIDE;
      this._resolveBuildingToneColor(data[base + 0], data[base + 1], data[base + 5], cLow, cMid, cHigh, color);
      mesh.setColorAt(i, color);
    }
    if (mesh.instanceColor) {
      mesh.instanceColor.needsUpdate = true;
    }
  }

  _applyExtrudedPolygonColors() {
    if (!this.extrudedBuildingsMesh?.geometry || !this._extrudedTriMeta.length) return;
    const palette = this._getThemePalette();
    const cLow = new THREE.Color(palette.bldgLow);
    const cMid = new THREE.Color(palette.bldgMid);
    const cHigh = new THREE.Color(palette.bldgHigh);
    const color = new THREE.Color();
    const colAttr = this.extrudedBuildingsMesh.geometry.getAttribute('color');
    if (!colAttr) return;

    for (const meta of this._extrudedTriMeta) {
      const b = meta.bldg;
      this._resolveBuildingToneColor(b.east_m, b.north_m, b.height_m, cLow, cMid, cHigh, color);
      for (let v = meta.startVertex; v < meta.endVertex; v++) {
        colAttr.setXYZ(v, color.r, color.g, color.b);
      }
    }
    colAttr.needsUpdate = true;
  }

  /**
   * Shared OBB InstancedMesh builder with sunken hillside skirt (-2.0m) and per-instance architectural attributes.
   * @private
   */
  _createOBBInstancedMesh(data, grounds, material, name) {
    const fullCount = Math.floor((data?.length || 0) / OBB_BUILDING_STRIDE);
    if (fullCount <= 0) return null;

    const instGeo = this._track(this.unitBoxGeometry.clone());
    const groundYArr = new Float32Array(fullCount);
    const heightArr = new Float32Array(fullCount);
    const mesh = new THREE.InstancedMesh(instGeo, material, fullCount);
    mesh.name = name;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    const dummy = new THREE.Object3D();
    const SKIRT_M = 2.0;

    for (let i = 0; i < fullCount; i++) {
      const base = i * OBB_BUILDING_STRIDE;
      const east_m = data[base + 0];
      const north_m = data[base + 1];
      const width_m = data[base + 2];
      const depth_m = data[base + 3];
      const yaw_rad = data[base + 4];
      const height_m = data[base + 5];
      const groundY = (grounds && i < grounds.length)
        ? grounds[i]
        : this._sampleTerrainHeight(east_m, north_m);

      groundYArr[i] = groundY;
      heightArr[i] = height_m;

      const totalH = height_m + SKIRT_M;
      dummy.position.set(east_m, groundY + (height_m - SKIRT_M) * 0.5, -north_m);
      dummy.rotation.set(0, yaw_rad, 0);
      dummy.scale.set(width_m, totalH, depth_m);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }

    instGeo.setAttribute('aGroundY', new THREE.InstancedBufferAttribute(groundYArr, 1));
    instGeo.setAttribute('aBldgHeight', new THREE.InstancedBufferAttribute(heightArr, 1));
    mesh.instanceMatrix.needsUpdate = true;
    this._applyBuildingInstanceColors(mesh, data);
    mesh.computeBoundingSphere();
    return mesh;
  }

  /**
   * Build Stage 2 true-footprint extruded architectural buildings from OSM ptsEN polygons
   * with chamfered roof crowns, hillside foundation skirts, and binary-search raycast lookup.
   * @private
   */
  _buildExtrudedPolygonBuildingsMesh(polygons, material) {
    if (!Array.isArray(polygons) || polygons.length === 0) return null;
    const MAX_EXTRUSIONS = 2800;
    const capped = polygons.slice(0, MAX_EXTRUSIONS);

    const pos = [];
    const norm = [];
    const col = [];
    const gY = [];
    const bH = [];
    const metaList = [];
    const SKIRT_M = 2.0;
    const palette = this._getThemePalette();
    const cLow = new THREE.Color(palette.bldgLow);
    const cMid = new THREE.Color(palette.bldgMid);
    const cHigh = new THREE.Color(palette.bldgHigh);
    const tmpColor = new THREE.Color();

    const tallCount = capped.filter(b => b.height_m >= 18).length;
    const overviewTargetCount = Math.min(capped.length, Math.max(96, tallCount));
    let overviewVertexCount = 0;

    for (let idx = 0; idx < capped.length; idx++) {
      const b = capped[idx];
      if (!Array.isArray(b.ptsEN) || b.ptsEN.length < 3) continue;

      try {
        const cleanedPts = [];
        for (const p of b.ptsEN) {
          if (cleanedPts.length === 0 || Math.hypot(p[0] - cleanedPts[cleanedPts.length - 1][0], p[1] - cleanedPts[cleanedPts.length - 1][1]) >= 0.15) {
            cleanedPts.push(p);
          }
        }
        if (cleanedPts.length < 3) continue;

        const shape = new THREE.Shape();
        shape.moveTo(cleanedPts[0][0], cleanedPts[0][1]);
        for (let i = 1; i < cleanedPts.length; i++) {
          shape.lineTo(cleanedPts[i][0], cleanedPts[i][1]);
        }
        shape.closePath();

        const ex = new THREE.ExtrudeGeometry(shape, {
          depth: Math.max(2.0, b.height_m + SKIRT_M),
          bevelEnabled: true,
          bevelThickness: 0.22,
          bevelSize: 0.16,
          bevelSegments: 1,
          curveSegments: 1,
          steps: 1
        });
        ex.rotateX(-Math.PI / 2);
        const nonIdx = ex.index ? ex.toNonIndexed() : ex;
        const pAttr = nonIdx.getAttribute('position');
        const nAttr = nonIdx.getAttribute('normal');
        if (!pAttr || pAttr.count === 0) {
          ex.dispose();
          if (nonIdx !== ex) nonIdx.dispose();
          continue;
        }

        const startVertex = pos.length / 3;
        const baseShiftY = (Number.isFinite(b.groundY_m) ? b.groundY_m : this._sampleTerrainHeight(b.east_m, b.north_m)) - SKIRT_M;
        this._resolveBuildingToneColor(b.east_m, b.north_m, b.height_m, cLow, cMid, cHigh, tmpColor);

        for (let v = 0; v < pAttr.count; v++) {
          pos.push(pAttr.getX(v), pAttr.getY(v) + baseShiftY, pAttr.getZ(v));
          norm.push(nAttr ? nAttr.getX(v) : 0, nAttr ? nAttr.getY(v) : 1, nAttr ? nAttr.getZ(v) : 0);
          col.push(tmpColor.r, tmpColor.g, tmpColor.b);
          gY.push(baseShiftY + SKIRT_M);
          bH.push(b.height_m);
        }

        const endVertex = pos.length / 3;
        metaList.push({ startVertex, endVertex, bldgIdx: idx, bldg: b });
        if (idx < overviewTargetCount) {
          overviewVertexCount = endVertex;
        }

        ex.dispose();
        if (nonIdx !== ex) nonIdx.dispose();
      } catch (_) {
        // Skip malformed individual OSM building ring cleanly without failing entire scene
      }
    }

    if (pos.length === 0) return null;

    const mergedGeo = this._track(new THREE.BufferGeometry());
    mergedGeo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    mergedGeo.setAttribute('normal', new THREE.Float32BufferAttribute(norm, 3));
    mergedGeo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    mergedGeo.setAttribute('aGroundY', new THREE.Float32BufferAttribute(gY, 1));
    mergedGeo.setAttribute('aBldgHeight', new THREE.Float32BufferAttribute(bH, 1));
    mergedGeo.computeBoundingSphere();

    const mesh = new THREE.Mesh(mergedGeo, material);
    mesh.name = 'NationwideExtrudedBuildings4km';
    mesh.castShadow = true;
    mesh.receiveShadow = true;

    this._extrudedTriMeta = metaList;
    this._extrudedPolygonsRef = capped;
    this._extrudedOverviewVertexCount = overviewVertexCount || mergedGeo.getAttribute('position').count;
    this._extrudedFullVertexCount = mergedGeo.getAttribute('position').count;
    return mesh;
  }

  _buildContextBuildingsInstancedMesh() {
    const data = this.pkg.obbBuildingsFloat32;
    const grounds = this.pkg.obbGroundOffsets;
    const fullCount = Math.floor((data?.length || 0) / OBB_BUILDING_STRIDE);
    const polys = this.pkg.buildingPolygons;
    const hasPolygons = Array.isArray(polys) && polys.length > 0;

    if (fullCount <= 0 && !hasPolygons) return;

    this._buildingDataRef = data;
    this.buildingMaterial = this._track(new THREE.MeshStandardMaterial({
      color: 0xffffff,
      vertexColors: false, // InstancedMesh uses instanceColor automatically; enabled only for ExtrudeGeometry below
      roughness: 0.78,
      metalness: 0.06,
      envMapIntensity: 0.85,
      transparent: false,
      opacity: 0.96,
      depthWrite: true
    }));
    this._injectBuildingShader(this.buildingMaterial, this._getThemePalette());

    if (hasPolygons) {
      this.extrudedBuildingsMesh = this._buildExtrudedPolygonBuildingsMesh(polys, this.buildingMaterial);
      if (this.extrudedBuildingsMesh) {
        this.buildingMaterial.vertexColors = true;
        this.buildingMaterial.needsUpdate = true;
        this.rootGroup.add(this.extrudedBuildingsMesh);
        return;
      }
    }

    this.instancedBuildings = this._createOBBInstancedMesh(
      data,
      grounds,
      this.buildingMaterial,
      'SeongdongContextBuildingsOBB'
    );
    if (this.instancedBuildings) {
      this.rootGroup.add(this.instancedBuildings);
    }
  }

  _buildSheltersAndFacilities() {
    const group = new THREE.Group();
    group.name = 'OfficialSheltersAndFacilities';

    const ringGeo = this._track(new THREE.RingGeometry(14.0, 17.5, 32));
    ringGeo.rotateX(-Math.PI / 2);

    const shelters = this.pkg.sheltersAndFacilities || [];
    for (const s of shelters) {
      const isPrimary = s.category === 'PRIMARY_SHELTER' && s.candidateStatus !== 'UNAVAILABLE';
      const isConditional = s.candidateStatus === 'CONDITIONAL';
      const isUnavailable = s.candidateStatus === 'UNAVAILABLE';
      const isMedical = s.category === 'MEDICAL_CENTER';
      const color = isUnavailable
        ? 0x475569
        : isConditional
          ? (isPrimary ? 0xfbbf24 : 0x94a3b8)
          : (isPrimary ? 0xe2e8f0 : (isMedical ? 0x94a3b8 : 0x64748b));
      const groundY = Number.isFinite(s.positionThree?.[1])
        ? s.positionThree[1]
        : this._sampleTerrainHeight(s.east_m, s.north_m);

      const sGroup = new THREE.Group();
      sGroup.name = `FacilityPin_${s.id}`;
      sGroup.position.set(s.positionThree[0], groundY, s.positionThree[2]);

      const ringMat = this._track(new THREE.MeshBasicMaterial({
        color,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: isUnavailable ? 0.22 : isPrimary ? 0.65 : 0.45
      }));
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.position.y = 0.35;
      sGroup.add(ring);

      // Subtle vertical architectural plumb line (non-glowing, thin slate/ivory line)
      const lineGeo = this._track(new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, 0.35, 0),
        new THREE.Vector3(0, isUnavailable ? 12.0 : isPrimary ? 26.0 : 20.0, 0)
      ]));
      const lineMat = this._track(new THREE.LineBasicMaterial({
        color,
        transparent: true,
        opacity: isUnavailable ? 0.28 : isPrimary ? 0.68 : 0.48
      }));
      sGroup.add(new THREE.Line(lineGeo, lineMat));

      group.add(sGroup);
    }

    this.rootGroup.add(group);
  }

  _buildTrees() {
    const grid = this.pkg.terrainGrid;
    if (!grid || !Array.isArray(grid.greenMask)) return;

    const palette = this._getThemePalette();
    const { nx, nz, halfExtentMeters, greenMask } = grid;
    const span = halfExtentMeters * 2.0;
    const isBlockedByUrban = buildTreeExclusionChecker(this.pkg);

    const conifers = [];
    const broadleaf = [];
    let seed = 90210;
    const rand = () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed / 4294967296;
    };

    for (let j = 1; j < nz; j += 1) {
      for (let i = 1; i < nx; i += 1) {
        const idx = j * (nx + 1) + i;
        if (!greenMask[idx]) continue;

        const baseE = -halfExtentMeters + (i / nx) * span;
        const baseN = -halfExtentMeters + (j / nz) * span;
        if (this._activeOriginMeta && Math.hypot(baseE - this._activeOriginMeta.east_m, baseN - this._activeOriginMeta.north_m) < 42) continue;
        const primaryShelter = (this.pkg.sheltersAndFacilities || [])[0];
        if (primaryShelter && Math.hypot(baseE - primaryShelter.east_m, baseN - primaryShelter.north_m) < 60) continue;

        const samples = 2;
        for (let s = 0; s < samples; s++) {
          const e = baseE + (rand() - 0.5) * 28.0;
          const n = baseN + (rand() - 0.5) * 28.0;
          if (isBlockedByUrban(e, n)) continue;
          const h = this._sampleTerrainHeight(e, n);
          if (h < -15.2) continue;
          const sc = 4.2 + rand() * 4.8;
          const yaw = rand() * Math.PI * 2;
          const tone = 0.85 + rand() * 0.28;
          if ((i + j + s) % 3 === 0) {
            conifers.push([e, h, -n, sc, yaw, tone]);
          } else {
            broadleaf.push([e, h, -n, sc, yaw, tone]);
          }
        }
      }
    }

    const dummy = new THREE.Object3D();
    const tmpColor = new THREE.Color();
    if (conifers.length > 0) {
      const conGeo = this._track(createConiferMaquetteGeometry());
      const conMat = this._track(new THREE.MeshStandardMaterial({
        color: palette.treeConifer,
        vertexColors: true,
        roughness: 0.90,
        metalness: 0.0
      }));
      this.coniferTreesMesh = new THREE.InstancedMesh(conGeo, conMat, conifers.length);
      this.coniferTreesMesh.name = 'LocalConiferTrees4km';
      conifers.forEach(([x, y, z, s, yaw, tone], idx) => {
        dummy.position.set(x, y - 0.35, z);
        dummy.rotation.set(0, yaw, 0);
        dummy.scale.set(s, s * 1.05, s);
        dummy.updateMatrix();
        this.coniferTreesMesh.setMatrixAt(idx, dummy.matrix);
        tmpColor.setRGB(tone, tone, tone);
        this.coniferTreesMesh.setColorAt(idx, tmpColor);
      });
      this.coniferTreesMesh.instanceMatrix.needsUpdate = true;
      if (this.coniferTreesMesh.instanceColor) this.coniferTreesMesh.instanceColor.needsUpdate = true;
      this.coniferTreesMesh.castShadow = true;
      this.coniferTreesMesh.receiveShadow = true;
      this.rootGroup.add(this.coniferTreesMesh);
    }

    if (broadleaf.length > 0) {
      const broadGeo = this._track(createBroadleafMaquetteGeometry());
      const broadMat = this._track(new THREE.MeshStandardMaterial({
        color: palette.treeBroadleaf,
        vertexColors: true,
        roughness: 0.90,
        metalness: 0.0
      }));
      this.broadleafTreesMesh = new THREE.InstancedMesh(broadGeo, broadMat, broadleaf.length);
      this.broadleafTreesMesh.name = 'LocalBroadleafTrees4km';
      broadleaf.forEach(([x, y, z, s, yaw, tone], idx) => {
        dummy.position.set(x, y - 0.35, z);
        dummy.rotation.set(0, yaw, 0);
        dummy.scale.set(s * 1.12, s * 0.92, s * 1.04);
        dummy.updateMatrix();
        this.broadleafTreesMesh.setMatrixAt(idx, dummy.matrix);
        tmpColor.setRGB(tone, tone, tone);
        this.broadleafTreesMesh.setColorAt(idx, tmpColor);
      });
      this.broadleafTreesMesh.instanceMatrix.needsUpdate = true;
      if (this.broadleafTreesMesh.instanceColor) this.broadleafTreesMesh.instanceColor.needsUpdate = true;
      this.broadleafTreesMesh.castShadow = true;
      this.broadleafTreesMesh.receiveShadow = true;
      this.rootGroup.add(this.broadleafTreesMesh);
    }
  }

  _buildNightWindows() {
    // Window glazing rhythm & calm nocturnal warmth now render directly in the architectural
    // building facade shader instead of detached floating THREE.Points rectangles.
    this.nightWindowsPoints = null;
  }

  _buildHorizonCompassAndEpicenterGuide() {
    const palette = this._getThemePalette();
    const radius = 2210.0;
    const pts = [];
    for (let i = 0; i <= 128; i++) {
      const a = (i / 128) * Math.PI * 2;
      pts.push(new THREE.Vector3(Math.cos(a) * radius, -15.0, Math.sin(a) * radius));
    }
    const ringGeo = this._track(new THREE.BufferGeometry().setFromPoints(pts));
    this.horizonCompassMat = this._track(new THREE.LineBasicMaterial({
      color: palette.horizonRing,
      transparent: true,
      opacity: 0.42
    }));
    const ring = new THREE.Line(ringGeo, this.horizonCompassMat);
    ring.name = 'HorizonCompassPerimeterRing';
    this.rootGroup.add(ring);

    // North cardinal architectural tick (0° = North -> -Z)
    const tickGeo = this._track(new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, -14.5, -radius + 35),
      new THREE.Vector3(0, -14.5, -radius - 65)
    ]));
    const tickLine = new THREE.Line(tickGeo, this.horizonCompassMat);
    tickLine.name = 'HorizonNorthTick';
    this.rootGroup.add(tickLine);
  }

  /**
   * Draw razor-thin non-VFX architectural epicenter bearing sightline & terrain-level
   * wavefront arc segments on the outer horizon perimeter indicating epicenter direction.
   */
  setEpicenterContext(seismicCtx) {
    while (this.epicenterGuideGroup.children.length > 0) {
      const ch = this.epicenterGuideGroup.children[0];
      this.epicenterGuideGroup.remove(ch);
      if (ch.geometry) ch.geometry.dispose();
      if (ch.material && ch.material !== this._epicenterRayMat) ch.material.dispose();
    }
    this._epicenterWaveArcs = [];
    this._waveUniforms = null;
    this._facadeRiskMat = null;
    this._waveLastElapsed = 0;
    this._waveStartSec = null;

    if (!seismicCtx || !Number.isFinite(seismicCtx.bearingDeg)) return;

    const palette = this._getThemePalette();
    const isDay = this.state.theme === 'ARCHITECTURAL_DAY';
    const rad = (seismicCtx.bearingDeg * Math.PI) / 180.0;
    // Bearing: 0 deg = North (-Z), 90 deg = East (+X)
    const dirX = Math.sin(rad);
    const dirZ = -Math.cos(rad);
    const ox = this._activeOriginMeta?.east_m ?? 0;
    const oz = -(this._activeOriginMeta?.north_m ?? 0);

    // 1. Subdivided sightline along outer approach zone (r = 480m -> 2210m) so campus stays uncluttered
    if (!this._epicenterRayMat) {
      this._epicenterRayMat = this._track(new THREE.LineDashedMaterial({
        color: palette.epicenterRay,
        dashSize: 28.0,
        gapSize: 18.0,
        transparent: true,
        opacity: 0.65
      }));
    } else {
      this._epicenterRayMat.color.setHex(palette.epicenterRay);
    }
    const rayPts = [];
    for (let step = 0; step <= 16; step++) {
      const r = 480.0 + (step / 16) * (2210.0 - 480.0);
      const px = ox + dirX * r;
      const pz = oz + dirZ * r;
      if (Math.abs(px) > 2200 || Math.abs(pz) > 2200) continue;
      rayPts.push(new THREE.Vector3(px, this._sampleTerrainHeight(px, -pz) + 3.5, pz));
    }
    if (rayPts.length >= 2) {
      const rayGeo = new THREE.BufferGeometry().setFromPoints(rayPts);
      const rayLine = new THREE.Line(rayGeo, this._epicenterRayMat);
      rayLine.computeLineDistances();
      rayLine.name = 'EpicenterBearingVectorLine';
      this.epicenterGuideGroup.add(rayLine);
    }

    // 2. Outer directional horizon arcs
    for (let k = 0; k < 2; k++) {
      const baseRadius = 1150.0 + k * 520.0;
      const arcPts = [];
      for (let s = -18; s <= 18; s++) {
        const theta = rad + (s * Math.PI) / 180.0;
        const px = Math.sin(theta) * baseRadius;
        const pz = -Math.cos(theta) * baseRadius;
        if (Math.abs(px) <= 2190 && Math.abs(pz) <= 2190) {
          arcPts.push(new THREE.Vector3(px, this._sampleTerrainHeight(px, -pz) + 2.8, pz));
        }
      }
      if (arcPts.length >= 2) {
        const arcGeo = new THREE.BufferGeometry().setFromPoints(arcPts);
        const arcMat = new THREE.LineBasicMaterial({
          color: palette.epicenterRay,
          transparent: true,
          opacity: 0.28
        });
        const arcLine = new THREE.Line(arcGeo, arcMat);
        arcLine.name = `EpicenterHorizonWaveArc_${k}`;
        arcLine.userData = { baseRadius, phaseOffset: k * 0.5, dirRad: rad };
        this.epicenterGuideGroup.add(arcLine);
        this._epicenterWaveArcs.push(arcLine);
      }
    }

    // 3. Monochromatic terrain-hugging seismic wavefront sweep (strictly non-VFX P/S crest over DEM hills)
    const distKm = Number.isFinite(seismicCtx.distanceKm) ? seismicCtx.distanceKm : 12.0;
    const isRadialLocal = distKm <= 2.4;
    const epiM = isRadialLocal ? distKm * 1000.0 : 0;
    const epiX = isRadialLocal ? ox + dirX * epiM : ox + dirX * 2600.0;
    const epiZ = isRadialLocal ? oz + dirZ * epiM : oz + dirZ * 2600.0;

    const waveGeo = new THREE.PlaneGeometry(4200, 4200, 56, 56);
    waveGeo.rotateX(-Math.PI / 2);
    const posAttr = waveGeo.attributes.position;
    for (let i = 0; i < posAttr.count; i++) {
      const vx = posAttr.getX(i);
      const vz = posAttr.getZ(i);
      posAttr.setY(i, this._sampleTerrainHeight(vx, -vz) + 0.58);
    }
    posAttr.needsUpdate = true;

    this._waveUniforms = {
      u_age: { value: 0.0 },
      u_isRadial: { value: isRadialLocal ? 1.0 : 0.0 },
      u_epiXZ: { value: new THREE.Vector2(epiX, epiZ) },
      u_dirXZ: { value: new THREE.Vector2(-dirX, -dirZ) },
      u_originXZ: { value: new THREE.Vector2(ox, oz) },
      u_pColor: { value: new THREE.Color(isDay ? 0x0284c7 : 0x38bdf8) },
      u_sColor: { value: new THREE.Color(isDay ? 0x0f172a : 0xf8fafc) },
      u_alphaScale: { value: isDay ? 0.34 : 0.42 }
    };
    const waveMat = new THREE.ShaderMaterial({
      uniforms: this._waveUniforms,
      vertexShader: `
        varying vec3 vWorldPos;
        void main() {
          vec4 wp = modelMatrix * vec4(position, 1.0);
          vWorldPos = wp.xyz;
          gl_Position = projectionMatrix * viewMatrix * wp;
        }
      `,
      fragmentShader: `
        uniform float u_age;
        uniform float u_isRadial;
        uniform vec2 u_epiXZ;
        uniform vec2 u_dirXZ;
        uniform vec2 u_originXZ;
        uniform vec3 u_pColor;
        uniform vec3 u_sColor;
        uniform float u_alphaScale;
        varying vec3 vWorldPos;
        void main() {
          float cycle = mod(u_age, 7.5);
          float initialBoost = u_age < 4.5 ? 1.0 : 0.24;
          float tWave = u_age < 4.5 ? (u_age / 4.2) : ((cycle) / 6.8);
          float distFromStart = u_isRadial > 0.5
            ? length(vWorldPos.xz - u_epiXZ)
            : dot(vWorldPos.xz - u_epiXZ, u_dirXZ);
          float sweepFrontP = tWave * 3600.0;
          float sweepFrontS = tWave * 2450.0;
          float bandP = exp(-pow((distFromStart - sweepFrontP) / 48.0, 2.0));
          float bandS = exp(-pow((distFromStart - sweepFrontS) / 34.0, 2.0));
          float fadeOut = smoothstep(1.0, 0.82, tWave) * smoothstep(0.0, 0.08, tWave);
          float edgeMask = smoothstep(2150.0, 1400.0, length(vWorldPos.xz - u_originXZ));
          vec3 col = mix(u_pColor, u_sColor, clamp(bandS * 1.25, 0.0, 1.0));
          float alpha = (bandP * 0.42 + bandS * 0.92) * fadeOut * edgeMask * u_alphaScale * initialBoost;
          if (alpha < 0.012) discard;
          gl_FragColor = vec4(col, alpha);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: isDay ? THREE.NormalBlending : THREE.AdditiveBlending
    });
    const waveMesh = new THREE.Mesh(waveGeo, waveMat);
    waveMesh.name = 'SeismicTerrainWavefrontSweep';
    waveMesh.renderOrder = 2;
    this.epicenterGuideGroup.add(waveMesh);

    // 4. Subtle tall-building architectural facade setback base hairlines (height >= 20m, no rainbow heatmap)
    const obbList = this.pkg?.obbRawList || [];
    const segVerts = [];
    for (let i = 0; i < obbList.length; i++) {
      const ob = obbList[i];
      if ((ob.height_m || 0) < 20.0) continue;
      if (Math.hypot(ob.east_m - ox, -ob.north_m - oz) > 1550) continue;
      const hw = ob.width_m * 0.5 + 1.8;
      const hd = ob.depth_m * 0.5 + 1.8;
      const ca = Math.cos(ob.yaw_rad || 0);
      const sa = Math.sin(ob.yaw_rad || 0);
      const cx = ob.east_m;
      const cz = -ob.north_m;
      const baseY = this._sampleTerrainHeight(cx, -cz) + 0.48;
      const cPts = [[-hw, -hd], [hw, -hd], [hw, hd], [-hw, hd]].map(([lx, lz]) => [
        cx + ca * lx + sa * lz,
        baseY,
        cz - sa * lx + ca * lz
      ]);
      for (let k = 0; k < 4; k++) {
        const a = cPts[k];
        const b = cPts[(k + 1) % 4];
        segVerts.push(a[0], a[1], a[2], b[0], b[1], b[2]);
      }
      if (segVerts.length >= 24000) break;
    }
    if (segVerts.length >= 6) {
      const facadeGeo = new THREE.BufferGeometry();
      facadeGeo.setAttribute('position', new THREE.Float32BufferAttribute(segVerts, 3));
      this._facadeRiskMat = new THREE.LineBasicMaterial({
        color: isDay ? 0xb45309 : 0xd4a359,
        transparent: true,
        opacity: 0.24
      });
      const facadeLines = new THREE.LineSegments(facadeGeo, this._facadeRiskMat);
      facadeLines.name = 'FacadeRiskBaseHairlines';
      this.epicenterGuideGroup.add(facadeLines);
    }
  }

  replaySeismicWavefront() {
    this._waveStartSec = this._waveLastElapsed;
    if (this._waveUniforms) {
      this._waveUniforms.u_age.value = 0.0;
    }
  }

  /**
   * Update active building ("내 위치 · 출발지") label anchor and mask overlapping solid
   * InstancedMesh building box so the active wireframe & floorplan display cleanly without Z-fighting.
   */
  setActiveOriginFacility(originSpec) {
    if (!originSpec) {
      this._activeOriginMeta = {
        id: 'ANALYSIS_ORIGIN',
        title: '분석 기준 위치',
        east_m: 0,
        north_m: 0,
        height_m: 0,
        hasBuilding: false,
        markerMode: 'UNSELECTED'
      };
    } else {
      const { id, name, east_m, north_m, height_m, originHasBuilding, hasIndoorData, markerMode } = originSpec;
      const resolvedMode = markerMode || (originHasBuilding === false ? 'FREE_MODE_ANCHOR' : 'PICKED_BUILDING');
      const rawName = name || '지정 위치';
      const formattedTitle =
        resolvedMode === 'USER_GPS' ? `내 현재 위치(GPS) · ${rawName}` :
        resolvedMode === 'PICKED_BUILDING' ? `선택 건물 · ${rawName}` :
        resolvedMode === 'FREE_MODE_ANCHOR' ? `분석 기준(자유 모드) · ${rawName}` :
        `출발 기준 · ${rawName}`;
      this._activeOriginMeta = {
        id: id || 'DYNAMIC_ORIGIN',
        title: formattedTitle,
        east_m: east_m ?? 0,
        north_m: north_m ?? 0,
        height_m: height_m ?? 18.0,
        hasBuilding: originHasBuilding !== false,
        hasIndoorData: Boolean(hasIndoorData),
        markerMode: resolvedMode
      };
    }

    if (this.instancedBuildings && this._buildingDataRef) {
      const data = this._buildingDataRef;
      const grounds = this.pkg.obbGroundOffsets;
      const total = Math.floor(data.length / OBB_BUILDING_STRIDE);
      const maskCenterE = this._activeOriginMeta.east_m;
      const maskCenterN = this._activeOriginMeta.north_m;
      const isDefault212 = this._activeOriginMeta.id === 'BLDG_212_ENG1';
      const shouldMaskBuilding = Boolean(this._activeOriginMeta.hasBuilding && !isDefault212);
      const maskRadius = this._activeOriginMeta.hasIndoorData ? 32.0 : 12.0;
      const dummy = new THREE.Object3D();

      for (let i = 0; i < total; i++) {
        const base = i * OBB_BUILDING_STRIDE;
        const e = data[base + 0];
        const n = data[base + 1];
        const w = data[base + 2];
        const d = data[base + 3];
        const yaw = data[base + 4];
        const h = data[base + 5];
        const groundY = (grounds && i < grounds.length) ? grounds[i] : this._sampleTerrainHeight(e, n);
        const overlapsOrigin = shouldMaskBuilding && Math.hypot(e - maskCenterE, n - maskCenterN) < maskRadius;

        dummy.position.set(e, overlapsOrigin ? -500 : groundY + h * 0.5, -n);
        dummy.rotation.set(0, yaw, 0);
        if (overlapsOrigin) {
          dummy.scale.set(0.001, 0.001, 0.001);
        } else {
          dummy.scale.set(w, h, d);
        }
        dummy.updateMatrix();
        this.instancedBuildings.setMatrixAt(i, dummy.matrix);
      }
      this.instancedBuildings.instanceMatrix.needsUpdate = true;
    }

    this._buildLabelAnchors();
    for (const el of this._labelDomMap.values()) {
      el.remove();
    }
    this._labelDomMap.clear();
  }

  /**
   * Switch between 'MONOLITH_NIGHT' (high-contrast nocturnal monolith) and
   * 'ARCHITECTURAL_DAY' (warm daylight urban atlas reference).
   */
  setVisualTheme(themeName = 'MONOLITH_NIGHT') {
    const key = themeName === 'ARCHITECTURAL_DAY' ? 'ARCHITECTURAL_DAY' : 'MONOLITH_NIGHT';
    const isDay = key === 'ARCHITECTURAL_DAY';
    this.state.theme = key;
    const palette = this._getThemePalette();

    this._applyProceduralEnvironmentIBL(isDay);

    if (this.hemiLight) {
      this.hemiLight.color.setHex(palette.hemiSky);
      this.hemiLight.groundColor.setHex(palette.hemiGround);
      this.hemiLight.intensity = palette.hemiIntensity;
    }
    if (this.sunLight) {
      this.sunLight.color.setHex(palette.sunColor);
      this.sunLight.intensity = palette.sunIntensity;
    }
    if (this.rimLight) {
      this.rimLight.color.setHex(palette.rimColor);
      this.rimLight.intensity = palette.rimIntensity;
    }
    if (this.terrainBaseFloor?.material) {
      this.terrainBaseFloor.material.color.setHex(palette.background);
    }
    if (this.terrainMesh?.geometry && this.pkg.terrainGrid) {
      this._applyTerrainVertexColors(this.terrainMesh.geometry, this.pkg.terrainGrid);
    }
    if (this.terrainSkirtMesh?.material) {
      this.terrainSkirtMesh.material.color.setHex(palette.skirt);
    }
    if (this._terrainUniforms) {
      this._terrainUniforms.uContourColor.value.setHex(palette.contour);
      this._terrainUniforms.uContourOpacity.value = palette.contourOpacity;
    }
    if (this._buildingUniforms) {
      this._buildingUniforms.uIsDay.value = isDay ? 1.0 : 0.0;
    }
    if (this._waterUniforms) {
      this._waterUniforms.uIsDay.value = isDay ? 1.0 : 0.0;
    }
    if (this.contourMat) {
      this.contourMat.color.setHex(palette.contour);
      this.contourMat.opacity = palette.contourOpacity;
    }
    if (this.waterPolygonMat) this.waterPolygonMat.color.setHex(palette.water);
    if (this.waterRibbonMat) this.waterRibbonMat.color.setHex(palette.water);
    if (this.greenOverlayMat) this.greenOverlayMat.color.setHex(palette.greenOverlay);

    if (this.coniferTreesMesh?.material) this.coniferTreesMesh.material.color.setHex(palette.treeConifer);
    if (this.broadleafTreesMesh?.material) this.broadleafTreesMesh.material.color.setHex(palette.treeBroadleaf);
    if (this.horizonCompassMat) this.horizonCompassMat.color.setHex(palette.horizonRing);
    if (this._epicenterRayMat) this._epicenterRayMat.color.setHex(palette.epicenterRay);

    if (this.roadCasingMat) this.roadCasingMat.color.setHex(palette.roadCasing);
    if (this.bridgeMat) this.bridgeMat.color.setHex(palette.bridgeDeck);
    if (this.roadMats.major) this.roadMats.major.color.setHex(palette.roadMajor);
    if (this.roadMats.primary) this.roadMats.primary.color.setHex(palette.roadPrimary);
    if (this.roadMats.minor) this.roadMats.minor.color.setHex(palette.roadMinor);
    if (this.roadMats.rail) this.roadMats.rail.color.setHex(palette.rail);

    if (this.extrudedBuildingsMesh) {
      this._applyExtrudedPolygonColors();
    }
    if (this.instancedBuildings && this._buildingDataRef) {
      this._applyBuildingInstanceColors(this.instancedBuildings, this._buildingDataRef);
    }
    for (const entry of this.chunkMeshes.values()) {
      this._applyBuildingInstanceColors(entry.mesh, entry.chunk.obbBuildingsFloat32);
    }

    if (this.buildingMaterial) {
      this.buildingMaterial.color.setHex(this.state.xRayEnabled ? palette.xrayColor : 0xffffff);
    }

    return palette;
  }

  _buildLabelAnchors() {
    this.labelAnchors = [];
    const orig = this._activeOriginMeta;

    // 1. User Origin Facility / Analysis Point
    if (orig) {
      const origGroundY = this._sampleTerrainHeight(orig.east_m, orig.north_m);
      this.labelAnchors.push({
        id: orig.id,
        title: orig.title.replace(/^내 위치\s*·\s*/, ''),
        subtitle: orig.markerMode === 'USER_GPS'
          ? '실측 GPS 위치 기준'
          : (orig.markerMode === 'FREE_MODE_ANCHOR'
            ? (this.pkg?.dataCompleteness === 'INSUFFICIENT' ? '데이터 부족 (실제 건물 미확인)' : '자유 모드 지정 기준(GPS 아님)')
            : (orig.hasBuilding ? '선택 건물 외곽 기준' : '야외 기준 위치')),
        category: 'TARGET_BUILDING',
        provisional: !orig.hasBuilding,
        priority: 100,
        worldPos: new THREE.Vector3(orig.east_m, origGroundY + (orig.height_m || 0) + 8.0, -orig.north_m)
      });
    }

    // 2. Primary Destination Candidate & Regional Hubs (reflecting honest confirmation tier)
    for (const s of (this.pkg.sheltersAndFacilities || [])) {
      const isPrimary = s.category === 'PRIMARY_SHELTER';
      const status = s.candidateStatus || (this.pkg?.isHanyangNative ? 'CONFIRMED' : 'CONDITIONAL');
      if (status === 'UNAVAILABLE' && !isPrimary) continue;
      const baseY = Number.isFinite(s.positionThree?.[1])
        ? s.positionThree[1]
        : this._sampleTerrainHeight(s.east_m, s.north_m);
      const isConditional = status === 'CONDITIONAL';
      const titlePrefix = status === 'UNAVAILABLE'
        ? '단절 · '
        : isConditional
          ? ''
          : (isPrimary ? '대피소 · ' : '');
      const capText = s.justification?.capacityEstimate
        ? `약 ${Number(s.justification.capacityEstimate).toLocaleString()}명`
        : '';
      const defaultSub = isConditional
        ? `개활 후보${capText ? ` · ${capText}` : ''}`
        : (s.subtitle || (isPrimary ? `대피 목적지${capText ? ` · ${capText}` : ''}` : ''));

      this.labelAnchors.push({
        id: s.id,
        title: `${titlePrefix}${s.name}`,
        subtitle: defaultSub,
        category: s.category,
        provisional: isConditional || status === 'UNAVAILABLE',
        priority: isPrimary ? 98 : 68,
        worldPos: new THREE.Vector3(s.positionThree[0], baseY + 22.0, s.positionThree[2])
      });
    }

    // 3. Natural Hydrology Whisper Labels (strictly Hanyang-specific OR derived from actual OSM waterways)
    const isHanyangPkg = Boolean(this.pkg?.isHanyangNative || String(this.pkg?.metadata?.packageId || '').includes('HANYANG'));
    if (isHanyangPkg) {
      this.labelAnchors.push(
        {
          id: 'HYDRO_JUNGNANGCHEON',
          title: '중랑천',
          subtitle: '',
          category: 'WATERWAY_GEO',
          provisional: false,
          priority: 72,
          worldPos: new THREE.Vector3(780.0, -14.0, 560.0)
        },
        {
          id: 'HYDRO_HANGANG',
          title: '한강',
          subtitle: '',
          category: 'WATERWAY_GEO',
          provisional: false,
          priority: 71,
          worldPos: new THREE.Vector3(-420.0, -16.0, 1780.0)
        }
      );
    } else {
      const seenWaterNames = new Set();
      for (const w of (this.pkg.terrainAndHydrology?.waterways || [])) {
        if (!w.name || w.name === '하천' || seenWaterNames.has(w.name)) continue;
        const pts = w.pointsEN || [];
        if (pts.length === 0) continue;
        const mid = pts[Math.floor(pts.length * 0.5)];
        if (!mid) continue;
        seenWaterNames.add(w.name);
        this.labelAnchors.push({
          id: `HYDRO_${w.id}`,
          title: w.name,
          subtitle: '수계 (보행 주의)',
          category: 'WATERWAY_GEO',
          provisional: false,
          priority: 70,
          worldPos: new THREE.Vector3(mid[0], this._sampleTerrainHeight(mid[0], mid[1]) + 2.5, -mid[1])
        });
        if (seenWaterNames.size >= 3) break;
      }
    }

    // 4. Secondary Named Context Landmarks
    for (const b of (this.pkg.namedBuildings || [])) {
      const matchesOrigin = orig && (
        b.id === orig.id ||
        (orig.id === 'BLDG_701_HIT' && b.id === 'CTX_HIT') ||
        (orig.id === 'BLDG_104_PAIKNAM' && b.id === 'CTX_PAIKNAM')
      );
      if (b.isTargetBuilding || matchesOrigin || b.id === 'CTX_HYUHOSP_MAIN') continue;
      this.labelAnchors.push({
        id: b.id,
        title: b.name,
        subtitle: '',
        category: b.category || 'URBAN_BUILDING',
        provisional: false,
        priority: Math.min(62, b.priority || 52),
        worldPos: new THREE.Vector3(b.east_m, this._sampleTerrainHeight(b.east_m, b.north_m) + (b.height_m || 10) + 5.0, -b.north_m)
      });
    }
  }

  /**
   * Toggle surrounding building LOD (`OVERVIEW` = tallest buildings only, `FULL` = all context buildings).
   */
  setLodMode(mode = 'FULL') {
    const counts = this.pkg.obbLodCounts || { overviewCount: 64, fullCount: 180 };
    const normalized = (mode === 'OVERVIEW') ? 'OVERVIEW' : 'FULL';
    this.state.lodMode = normalized;
    if (this.extrudedBuildingsMesh?.geometry && this._extrudedFullVertexCount > 0) {
      const range = normalized === 'OVERVIEW' ? this._extrudedOverviewVertexCount : this._extrudedFullVertexCount;
      this.extrudedBuildingsMesh.geometry.setDrawRange(0, range);
    }
    if (this.instancedBuildings) {
      this.instancedBuildings.count = normalized === 'OVERVIEW'
        ? counts.overviewCount
        : counts.fullCount;
    }
    for (const entry of this.chunkMeshes.values()) {
      entry.mesh.count = normalized === 'OVERVIEW'
        ? entry.chunk.overviewCount
        : entry.chunk.buildingCount;
    }
    return this.state.lodMode;
  }

  /**
   * Stream adjacent 3km x 3km spatial tiles based on focal camera/target XZ position (Tier 2.2).
   */
  updateSpatialChunks(posOrCamera, options = {}) {
    // Only skip Hanyang chunks when explicitly in a non-Hanyang nationwide OSM region
    if (this.pkg?.isHanyangNative === false) {
      return { loadedKeys: [], unloadedKeys: [] };
    }
    const pos = posOrCamera?.position || posOrCamera || { x: 0, z: 0 };
    const status = this.chunkManager.updateForPosition(pos.x || 0, pos.z || 0, options);

    for (const unloadedKey of status.unloadedKeys) {
      const entry = this.chunkMeshes.get(unloadedKey);
      if (entry) {
        this.chunkGroup.remove(entry.mesh);
        this.chunkMeshes.delete(unloadedKey);
      }
    }

    for (const loadedKey of status.loadedKeys) {
      const chunk = this.chunkManager.activeChunks.get(loadedKey);
      if (!chunk || chunk.isCorePrebuilt || chunk.buildingCount === 0 || !this.buildingMaterial) continue;
      const mesh = this._createOBBInstancedMesh(
        chunk.obbBuildingsFloat32,
        null,
        this.buildingMaterial,
        `ChunkOBB_${loadedKey}`
      );
      if (mesh) {
        mesh.count = this.state.lodMode === 'OVERVIEW' ? chunk.overviewCount : chunk.buildingCount;
        this.chunkGroup.add(mesh);
        this.chunkMeshes.set(loadedKey, { chunk, mesh });
      }
    }

    return status;
  }

  /**
   * Render subdued dashed architectural outlines for active `avoid_polygons` (Tier 2.1).
   */
  setHazardAvoidPolygons(polygons = []) {
    while (this.hazardPolygonGroup.children.length > 0) {
      const child = this.hazardPolygonGroup.children[0];
      this.hazardPolygonGroup.remove(child);
      if (child.geometry) child.geometry.dispose();
      if (child.material) child.material.dispose();
    }

    this.activeHazardPolygons = Array.isArray(polygons) ? [...polygons] : [];
    for (const poly of this.activeHazardPolygons) {
      if (!Array.isArray(poly.polygonXZ) || poly.polygonXZ.length < 3) continue;
      const pts = poly.polygonXZ.map(([x, z]) => new THREE.Vector3(x, this._sampleTerrainHeight(x, -z) + 1.4, z));
      pts.push(new THREE.Vector3(poly.polygonXZ[0][0], this._sampleTerrainHeight(poly.polygonXZ[0][0], -poly.polygonXZ[0][1]) + 1.4, poly.polygonXZ[0][1]));

      const geo = new THREE.BufferGeometry().setFromPoints(pts);
      const mat = new THREE.LineDashedMaterial({
        color: poly.mode === 'BLOCK' ? 0xf59e0b : 0x94a3b8,
        dashSize: 6.0,
        gapSize: 3.5,
        transparent: true,
        opacity: 0.85
      });
      const outline = new THREE.Line(geo, mat);
      outline.computeLineDistances();
      outline.name = `AvoidPoly_${poly.id}`;
      this.hazardPolygonGroup.add(outline);
    }
    return this.activeHazardPolygons.length;
  }

  /**
   * Ghost surrounding urban buildings into X-Ray silhouette (`opacity ~0.16`) during indoor/building closeups.
   */
  setXRayMode(enabled, opacity = 0.16, isManual = false) {
    if (isManual) {
      this.state.xRayManualOverride = Boolean(enabled);
    }
    this.state.xRayEnabled = Boolean(enabled);
    this.state.xRayOpacity = enabled ? opacity : 0.96;
    const palette = this._getThemePalette();

    if (this._buildingUniforms) {
      this._buildingUniforms.uXRay.value = enabled ? 1.0 : 0.0;
    }
    if (this.buildingMaterial) {
      this.buildingMaterial.transparent = Boolean(enabled);
      this.buildingMaterial.opacity = this.state.xRayOpacity;
      this.buildingMaterial.depthWrite = !enabled;
      this.buildingMaterial.color.setHex(enabled ? palette.xrayColor : 0xffffff);
      this.buildingMaterial.needsUpdate = true;
    }
    if (this.coniferTreesMesh) this.coniferTreesMesh.visible = !enabled;
    if (this.broadleafTreesMesh) this.broadleafTreesMesh.visible = !enabled;
    return this.state.xRayEnabled;
  }

  clearXRayManualOverride() {
    this.state.xRayManualOverride = null;
  }

  /**
   * Eco / Classroom performance mode: slices instanced building count to `overviewCount`
   * and increases label layout throttle interval.
   */
  setEcoMode(enabled) {
    this.state.ecoMode = Boolean(enabled);
    if (this.state.ecoMode) {
      this.setLodMode('OVERVIEW');
    } else if (this.state.currentStage !== CAMERA_STAGES.GLOBAL_ORBIT) {
      this.setLodMode('FULL');
    }
    return this.state.ecoMode;
  }

  /**
   * Synchronize LOD & X-Ray visibility with the active camera stage.
   */
  syncWithCameraStage(stageKey) {
    this.state.currentStage = stageKey;

    if (stageKey === CAMERA_STAGES.GLOBAL_ORBIT) {
      this.setLodMode('OVERVIEW');
      if (this.state.xRayManualOverride === null) {
        this.setXRayMode(false);
      }
    } else if (stageKey === CAMERA_STAGES.REGIONAL_APPROACH || stageKey === CAMERA_STAGES.CAMPUS_OVERVIEW) {
      this.setLodMode(this.state.ecoMode ? 'OVERVIEW' : 'FULL');
      if (this.state.xRayManualOverride === null) {
        this.setXRayMode(false);
      }
    } else if (stageKey === CAMERA_STAGES.BUILDING_INSPECTION || stageKey === CAMERA_STAGES.PERSONAL_LOCATION) {
      this.setLodMode(this.state.ecoMode ? 'OVERVIEW' : 'FULL');
      if (this.state.xRayManualOverride === null) {
        this.setXRayMode(true, 0.16);
      }
    }
  }

  /**
   * Project 3D label anchors into 2D screen coordinates, solve AABB HUD & label collisions,
   * and update DOM elements cleanly in `containerEl`.
   */
  updateOverlayLabels(camera, containerEl, options = {}) {
    if (!camera || !containerEl) return { visibleLabels: [], hiddenIds: [] };

    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    const minIntervalMs = this.state.ecoMode ? 120 : 32;
    if (!options.force && (now - this.state.lastLabelUpdateMs) < minIntervalMs) {
      return null;
    }
    this.state.lastLabelUpdateMs = now;

    const width = options.width || (typeof window !== 'undefined' ? window.innerWidth : 1280);
    const height = options.height || (typeof window !== 'undefined' ? window.innerHeight : 800);

    // Hide all local map labels in cosmic Earth orbit to preserve clean silhouette
    if (this.state.currentStage === CAMERA_STAGES.GLOBAL_ORBIT) {
      for (const el of this._labelDomMap.values()) {
        el.style.display = 'none';
      }
      this.state.visibleLabelCount = 0;
      this.state.hiddenLabelCount = this.labelAnchors.length;
      return { visibleLabels: [], hiddenIds: this.labelAnchors.map(a => a.id) };
    }

    // Collect fixed HUD obstacle bounding rects
    const avoidSelector = options.avoidSelector || '#header-overlay, #evac-header-overlay, #handoff-context-strip, #entry-mode-gate, #exhibition-bar, #guidance-container, #bottom-stage-stack, #evac-dock, #safety-rule-popup, #map-controls';
    const obstacleRects = [];
    if (typeof document !== 'undefined' && avoidSelector) {
      document.querySelectorAll(avoidSelector).forEach((el) => {
        const r = el.getBoundingClientRect();
        if (r.width > 0 && r.height > 0) {
          obstacleRects.push({ left: r.left, top: r.top, right: r.right, bottom: r.bottom });
        }
      });
    }

    const camDist = camera.position ? camera.position.length() : 1000;
    const isMacroView = camDist > 920;

    const vec = new THREE.Vector3();
    const candidates = [];

    for (const anchor of this.labelAnchors) {
      // Suppress cluttering secondary context labels in zoomed-out macro views
      if (isMacroView && anchor.priority < 68 && anchor.category !== 'WATERWAY_GEO') {
        continue;
      }
      vec.copy(anchor.worldPos).project(camera);
      const inFront = vec.z >= -1.0 && vec.z <= 1.0;
      const screenX = (vec.x * 0.5 + 0.5) * width;
      const screenY = (-vec.y * 0.5 + 0.5) * height;
      const hasSub = Boolean(anchor.subtitle && anchor.subtitle.length > 0);
      const isHero = anchor.category === 'PRIMARY_SHELTER' || anchor.category === 'ORIGIN_BUILDING' || anchor.category === 'TARGET_BUILDING';
      const maxCap = isHero ? 248 : 224;
      const titleW = Math.min(isHero ? 172 : 148, anchor.title.length * 10.5);
      const subW = hasSub ? Math.min(88, anchor.subtitle.length * 8.5 + 8) : 0;
      const estW = Math.max(82, Math.min(maxCap, Math.ceil(titleW + subW + 26)));
      const estH = 26;

      candidates.push({
        ...anchor,
        screenX,
        screenY,
        width: estW,
        height: estH,
        inFront
      });
    }

    const result = solveLabelCollisions2D(candidates, obstacleRects, { width, height }, 14);
    const visibleSet = new Set(result.visibleLabels.map(v => v.id));

    for (const el of this._labelDomMap.values()) {
      el.style.display = 'none';
    }

    for (const item of candidates) {
      let el = this._labelDomMap.get(item.id);
      if (!el && typeof document !== 'undefined') {
        el = document.createElement('div');
        el.className = `spatial-map-label cat-${item.category.toLowerCase()}${item.provisional ? ' is-provisional' : ''}`;
        el.dataset.labelId = item.id;
        const titleSpan = document.createElement('span');
        titleSpan.className = 'sml-title';
        titleSpan.textContent = item.title || '';
        el.appendChild(titleSpan);
        if (item.subtitle) {
          const subSpan = document.createElement('span');
          subSpan.className = 'sml-sub';
          subSpan.textContent = item.subtitle;
          el.appendChild(subSpan);
        }
        containerEl.appendChild(el);
        this._labelDomMap.set(item.id, el);
      }
      if (!el) continue;

      if (visibleSet.has(item.id)) {
        const placed = result.visibleLabels.find(v => v.id === item.id);
        el.style.display = 'flex';
        el.style.transform = `translate3d(${Math.round(placed.rect.left)}px, ${Math.round(placed.rect.top)}px, 0)`;
      } else {
        el.style.display = 'none';
      }
    }

    this.state.visibleLabelCount = result.visibleLabels.length;
    this.state.hiddenLabelCount = result.hiddenIds.length;
    return result;
  }

  /**
   * Subtle non-VFX outer horizon seismic arrival opacity breathing.
   */
  updateAtmosphericPulse(elapsedSec = 0) {
    this._waveLastElapsed = elapsedSec;
    if (this._waveStartSec === null) this._waveStartSec = elapsedSec;
    const sweepAge = Math.max(0, elapsedSec - this._waveStartSec);
    if (this._waterUniforms) {
      this._waterUniforms.uTime.value = elapsedSec;
    }
    if (this._waveUniforms) {
      this._waveUniforms.u_age.value = sweepAge;
    }
    if (this._facadeRiskMat) {
      this._facadeRiskMat.opacity = sweepAge < 4.5
        ? 0.22 + 0.34 * Math.sin(Math.min(1, sweepAge / 4.2) * Math.PI)
        : 0.16;
    }
    if (!this._epicenterWaveArcs || this._epicenterWaveArcs.length === 0) return;
    for (const arc of this._epicenterWaveArcs) {
      if (!arc?.material) continue;
      const ph = ((elapsedSec * 0.22 + (arc.userData?.phaseOffset || 0)) % 1.0);
      arc.material.opacity = 0.08 + 0.26 * Math.sin(ph * Math.PI);
    }
  }

  getLayerDiagnostics() {
    const counts = this.pkg.obbLodCounts || { overviewCount: 0, fullCount: 0 };
    let streamedChunkBuildingCount = 0;
    for (const entry of this.chunkMeshes.values()) {
      streamedChunkBuildingCount += entry.mesh.count;
    }
    const polyCount = this._extrudedPolygonsRef.length;
    const polyOverview = polyCount > 0
      ? Math.min(polyCount, Math.max(96, this._extrudedPolygonsRef.filter(b => b.height_m >= 18).length))
      : 0;
    const activeInstanceCount = this.instancedBuildings
      ? this.instancedBuildings.count
      : (this.extrudedBuildingsMesh ? (this.state.lodMode === 'OVERVIEW' ? polyOverview : polyCount) : 0);
    return {
      packageId: this.pkg.metadata?.packageId || 'UNKNOWN',
      theme: this.state.theme,
      fullCount: counts.fullCount,
      overviewCount: counts.overviewCount,
      activeInstanceCount,
      buildingPolygonMode: Boolean(this.extrudedBuildingsMesh),
      treeCount: (this.coniferTreesMesh?.count || 0) + (this.broadleafTreesMesh?.count || 0),
      activeChunkKeys: [...this.chunkManager.activeChunks.keys()],
      activeChunkCount: this.chunkManager.activeChunks.size,
      streamedChunkBuildingCount,
      hazardPolygonCount: this.activeHazardPolygons.length,
      lodMode: this.state.lodMode,
      xRayEnabled: this.state.xRayEnabled,
      xRayOpacity: this.state.xRayOpacity,
      ecoMode: this.state.ecoMode,
      currentStage: this.state.currentStage,
      visibleLabelCount: this.state.visibleLabelCount,
      hiddenLabelCount: this.state.hiddenLabelCount,
      shelterCount: (this.pkg.sheltersAndFacilities || []).length,
      roadCount: (this.pkg.roadNetwork || []).length,
      denseRoadCount: (this.pkg.denseRoadNetwork || []).length,
      waterwayCount: (this.pkg.terrainAndHydrology?.waterways || []).length,
      waterPolygonCount: (this.pkg.terrainAndHydrology?.waterPolygons || []).length
    };
  }

  dispose() {
    this.setEpicenterContext(null);
    this.setHazardAvoidPolygons([]);
    this.chunkMeshes.clear();
    this.chunkManager.clear();
    if (this._envMaps) {
      if (this.scene && !this.scene.userData?.preserveGlobalBackground &&
        (this.scene.environment === this._envMaps.night?.texture || this.scene.environment === this._envMaps.day?.texture)) {
        this.scene.environment = null;
      }
      this._envMaps.night?.dispose?.();
      this._envMaps.day?.dispose?.();
      this._envMaps = null;
    }
    if (this.scene && this.rootGroup) {
      this.scene.remove(this.rootGroup);
    }
    for (const d of this.disposables) {
      if (d && typeof d.dispose === 'function') d.dispose();
    }
    this.disposables = [];
    for (const el of this._labelDomMap.values()) {
      el.remove();
    }
    this._labelDomMap.clear();
  }
}
