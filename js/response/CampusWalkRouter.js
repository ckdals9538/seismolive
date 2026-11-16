// ============================================================================
// SEISMOLIVE v4.0 — Real OSM Campus Pedestrian & OBB Obstacle-Aware Router
// File: js/response/CampusWalkRouter.js
//
// Combines real OpenStreetMap campus walkable topology (footway, pedestrian,
// living_street, service, steps) with analytical Liang-Barsky 2D OBB obstacle
// intersection checks, 2D Visibility Graph corner detours, terrain-slope
// weighting, and seismic facade-debris clearance weighting.
//
// Zero circular dependencies; consumed by HanyangBuildingData,
// PedestrianRoutingEngine, and HanyangResponseAdapter.
// ============================================================================

import { HANYANG_CAMPUS_WALK_GRAPH } from './HanyangCampusWalkData.js';
import {
  OBB_BUILDING_STRIDE,
  sampleTerrainHeight
} from './HanyangLocalSpatialData.js';
import { REAL_OSM_BUILDINGS_FLAT } from './HanyangRealSpatialPayload.js';

const GRAPH_ADJ_CACHE = new WeakMap();
const OBB_LIST_CACHE = new WeakMap();
const OBB_SPATIAL_CACHE = new WeakMap();

const SPATIAL_GRID_CELL_M = 64.0;

function getSpatialOBBIndex(obbSource) {
  if (!obbSource) return null;
  if (typeof obbSource === 'object' && OBB_SPATIAL_CACHE.has(obbSource)) {
    return OBB_SPATIAL_CACHE.get(obbSource);
  }
  const all = normalizeOBBList(obbSource);
  const cells = new Map();
  for (let i = 0; i < all.length; i++) {
    const ob = all[i];
    const r = ob.boundR;
    const minCx = Math.floor((ob.east_m - r) / SPATIAL_GRID_CELL_M);
    const maxCx = Math.floor((ob.east_m + r) / SPATIAL_GRID_CELL_M);
    const minCz = Math.floor(((-ob.north_m) - r) / SPATIAL_GRID_CELL_M);
    const maxCz = Math.floor(((-ob.north_m) + r) / SPATIAL_GRID_CELL_M);
    for (let cx = minCx; cx <= maxCx; cx++) {
      for (let cz = minCz; cz <= maxCz; cz++) {
        const key = (cx + 1024) * 2048 + (cz + 1024);
        let bucket = cells.get(key);
        if (!bucket) {
          bucket = [];
          cells.set(key, bucket);
        }
        bucket.push(ob);
      }
    }
  }
  const idxObj = { all, cells };
  if (typeof obbSource === 'object') {
    OBB_SPATIAL_CACHE.set(obbSource, idxObj);
  }
  return idxObj;
}

function shouldExcludeOBB(ob, excludeCentroidXZ, excludeRad2, excludeGoalXZ) {
  if (excludeRad2 > 0 && excludeCentroidXZ) {
    const dx = ob.east_m - excludeCentroidXZ[0];
    const dz = -ob.north_m - excludeCentroidXZ[1];
    if (dx * dx + dz * dz <= excludeRad2) return true;
  }
  // Only skip a goal-covering OBB when the goal point itself lies strictly inside that single OBB
  if (excludeGoalXZ && doesSegmentIntersectOBBXZ(excludeGoalXZ, excludeGoalXZ, ob, 0.0)) {
    return true;
  }
  return false;
}

function querySpatialOBBsInBounds(spatialIndex, minX, minZ, maxX, maxZ, excludeCentroidXZ = null, excludeRad2 = 0, excludeGoalXZ = null) {
  if (!spatialIndex) return [];
  const minCx = Math.floor(minX / SPATIAL_GRID_CELL_M);
  const maxCx = Math.floor(maxX / SPATIAL_GRID_CELL_M);
  const minCz = Math.floor(minZ / SPATIAL_GRID_CELL_M);
  const maxCz = Math.floor(maxZ / SPATIAL_GRID_CELL_M);
  const seen = new Set();
  const out = [];
  for (let cx = minCx; cx <= maxCx; cx++) {
    for (let cz = minCz; cz <= maxCz; cz++) {
      const bucket = spatialIndex.cells.get((cx + 1024) * 2048 + (cz + 1024));
      if (!bucket) continue;
      for (let i = 0; i < bucket.length; i++) {
        const ob = bucket[i];
        if (seen.has(ob)) continue;
        seen.add(ob);
        if (shouldExcludeOBB(ob, excludeCentroidXZ, excludeRad2, excludeGoalXZ)) continue;
        out.push(ob);
      }
    }
  }
  return out;
}

function isSegmentClearSpatial(aXZ, bXZ, spatialIndex, marginMeters = -0.02, excludeCentroidXZ = null, excludeRad2 = 0, excludeGoalXZ = null) {
  if (!spatialIndex || spatialIndex.all.length === 0) return true;
  const pad = Math.max(0.5, marginMeters) + 4.0;
  const minX = Math.min(aXZ[0], bXZ[0]) - pad;
  const maxX = Math.max(aXZ[0], bXZ[0]) + pad;
  const minZ = Math.min(aXZ[1], bXZ[1]) - pad;
  const maxZ = Math.max(aXZ[1], bXZ[1]) + pad;

  const minCx = Math.floor(minX / SPATIAL_GRID_CELL_M);
  const maxCx = Math.floor(maxX / SPATIAL_GRID_CELL_M);
  const minCz = Math.floor(minZ / SPATIAL_GRID_CELL_M);
  const maxCz = Math.floor(maxZ / SPATIAL_GRID_CELL_M);

  for (let cx = minCx; cx <= maxCx; cx++) {
    for (let cz = minCz; cz <= maxCz; cz++) {
      const bucket = spatialIndex.cells.get((cx + 1024) * 2048 + (cz + 1024));
      if (!bucket) continue;
      for (let i = 0; i < bucket.length; i++) {
        const ob = bucket[i];
        if (shouldExcludeOBB(ob, excludeCentroidXZ, excludeRad2, excludeGoalXZ)) continue;
        if (doesSegmentIntersectOBBXZ(aXZ, bXZ, ob, marginMeters)) {
          return false;
        }
      }
    }
  }
  return true;
}

function pushPointOutsideSpatialOBBs(ptXZ, spatialIndex, clearanceMeters = 1.6, excludeCentroidXZ = null, excludeRad2 = 0, excludeGoalXZ = null) {
  if (!spatialIndex || spatialIndex.all.length === 0) return ptXZ;
  const near = querySpatialOBBsInBounds(
    spatialIndex,
    ptXZ[0] - 40, ptXZ[1] - 40, ptXZ[0] + 40, ptXZ[1] + 40,
    excludeCentroidXZ, excludeRad2, excludeGoalXZ
  );
  if (near.length === 0 || !isPointInsideAnyOBB(ptXZ, near, 0.25)) {
    return ptXZ;
  }
  const radii = [2.5, 5.0, 8.5, 13.0, 19.0, 27.0, 36.0];
  for (const r of radii) {
    for (let s = 0; s < 16; s++) {
      const ang = (s / 16) * Math.PI * 2;
      const cand = [ptXZ[0] + Math.cos(ang) * r, ptXZ[1] + Math.sin(ang) * r];
      if (!isPointInsideAnyOBB(cand, near, clearanceMeters * 0.5)) {
        return cand;
      }
    }
  }
  return ptXZ;
}

export const WALK_ROUTING_WEIGHTS = Object.freeze({
  distanceBase: 1.0,
  walkwaySurfaceMultipliers: Object.freeze({
    footway: 1.0,
    pedestrian: 0.96,
    living_street: 1.0,
    steps: 1.15,
    path: 1.05,
    cycleway: 1.06,
    service: 1.12,
    residential: 1.12,
    secondary: 1.24,
    primary: 1.28,
    crossing: 1.04
  }),
  uphillGainPerMeter: 0.35,
  steepRampAccessibleSlopeThreshold: 0.14,
  steepRampAccessiblePenalty: 1.35,
  debrisRiskMultiplierGain: 0.14,
  bridgeInspectionMultiplier: 1.08,
  alternativeEdgePenalty: 2.6,
  maxStartSnapMeters: 260,
  maxGoalSnapMeters: 260
});

export function getOrCompileWalkAdjacency(walkGraph) {
  const source = walkGraph || HANYANG_CAMPUS_WALK_GRAPH;
  if (GRAPH_ADJ_CACHE.has(source)) {
    return GRAPH_ADJ_CACHE.get(source);
  }
  const nodes = source.nodes || [];
  const edges = source.edges || [];
  const adj = Array.from({ length: nodes.length }, () => []);
  for (let idx = 0; idx < edges.length; idx++) {
    const [u, v, dist, hw, hasStairs, debrisRisk, isBridge, isCrossing] = edges[idx];
    const nu = nodes[u];
    const nv = nodes[v];
    if (!nu || !nv) continue;
    const dy = (nv[3] ?? 0) - (nu[3] ?? 0);
    const bridgeFlag = Boolean(isBridge || hw === 'bridge');
    const crossFlag = Boolean(isCrossing || hw === 'crossing');
    adj[u].push({ to: v, dist, dy, hw, hasStairs: !!hasStairs, isBridge: bridgeFlag, isCrossing: crossFlag, debrisRisk: debrisRisk ?? 0, edgeKey: `${nu[0]}->${nv[0]}` });
    adj[v].push({ to: u, dist, dy: -dy, hw, hasStairs: !!hasStairs, isBridge: bridgeFlag, isCrossing: crossFlag, debrisRisk: debrisRisk ?? 0, edgeKey: `${nv[0]}->${nu[0]}` });
  }
  const compiled = { nodes, edges, adj };
  GRAPH_ADJ_CACHE.set(source, compiled);
  return compiled;
}

const CAMPUS_GRAPH_ADJ = getOrCompileWalkAdjacency(HANYANG_CAMPUS_WALK_GRAPH);

/**
 * Normalize OBB sources (Float32Array stride-6 or Array of 6-tuples) into lightweight objects.
 * Coordinate frame: [east_m, north_m, width_m, depth_m, yaw_rad, height_m], Three.js Z = -north_m.
 */
export function normalizeOBBList(obbSource, excludeCenterXZ = null, excludeRadiusMeters = 0.0) {
  if (!obbSource) return [];
  const list = [];
  const ex = excludeCenterXZ ? excludeCenterXZ[0] : 0;
  const ez = excludeCenterXZ ? excludeCenterXZ[1] : 0;
  const exR2 = excludeRadiusMeters > 0 ? excludeRadiusMeters * excludeRadiusMeters : 0;

  const maybePush = (east_m, north_m, width_m, depth_m, yaw_rad, height_m) => {
    if (exR2 > 0) {
      const dx = east_m - ex;
      const dz = -north_m - ez;
      if (dx * dx + dz * dz <= exR2) return;
    }
    list.push({
      east_m,
      north_m,
      width_m,
      depth_m,
      yaw_rad,
      height_m,
      boundR: Math.hypot(width_m, depth_m) * 0.5
    });
  };

  if (ArrayBuffer.isView(obbSource) || (Array.isArray(obbSource) && typeof obbSource[0] === 'number')) {
    for (let i = 0; i + 5 < obbSource.length; i += OBB_BUILDING_STRIDE) {
      maybePush(
        obbSource[i],
        obbSource[i + 1],
        obbSource[i + 2],
        obbSource[i + 3],
        obbSource[i + 4],
        obbSource[i + 5]
      );
    }
  } else if (Array.isArray(obbSource)) {
    for (const ob of obbSource) {
      if (Array.isArray(ob) && ob.length >= 6) {
        maybePush(ob[0], ob[1], ob[2], ob[3], ob[4], ob[5]);
      } else if (ob && typeof ob.east_m === 'number') {
        maybePush(ob.east_m, ob.north_m, ob.width_m, ob.depth_m, ob.yaw_rad || 0, ob.height_m || 10);
      }
    }
  }
  return list;
}

/**
 * Analytical Liang-Barsky 2D segment-vs-OBB intersection test in horizontal XZ space.
 * Coordinates: aXZ = [x, z], bXZ = [x, z]; OBB aligned with Three.js rotation.y = yaw_rad.
 */
export function doesSegmentIntersectOBBXZ(aXZ, bXZ, obb, marginMeters = 0.0) {
  const cx = obb.east_m;
  const cz = -obb.north_m;
  const hw = obb.width_m * 0.5 + marginMeters;
  const hd = obb.depth_m * 0.5 + marginMeters;
  if (hw <= 0 || hd <= 0) return false;

  const rad = (obb.boundR ?? Math.hypot(obb.width_m, obb.depth_m) * 0.5) + marginMeters;
  if (Math.max(aXZ[0], bXZ[0]) < cx - rad || Math.min(aXZ[0], bXZ[0]) > cx + rad) return false;
  if (Math.max(aXZ[1], bXZ[1]) < cz - rad || Math.min(aXZ[1], bXZ[1]) > cz + rad) return false;

  // Map segment endpoints into OBB local (de, dn) space where local coords match Three.js R_y(-yaw)
  const ca = Math.cos(obb.yaw_rad);
  const sa = Math.sin(obb.yaw_rad);
  const de0 = aXZ[0] - cx;
  const dn0 = -(aXZ[1] - cz);
  const de1 = bXZ[0] - cx;
  const dn1 = -(bXZ[1] - cz);

  const lx0 = ca * de0 + sa * dn0;
  const lz0 = sa * de0 - ca * dn0;
  const lx1 = ca * de1 + sa * dn1;
  const lz1 = sa * de1 - ca * dn1;

  let tMin = 0.0;
  let tMax = 1.0;
  const dx = lx1 - lx0;
  const dz = lz1 - lz0;

  const clips = [
    [-dx, lx0 + hw],
    [dx, hw - lx0],
    [-dz, lz0 + hd],
    [dz, hd - lz0]
  ];
  for (let i = 0; i < 4; i++) {
    const p = clips[i][0];
    const q = clips[i][1];
    if (Math.abs(p) < 1e-12) {
      if (q < 0) return false;
    } else {
      const r = q / p;
      if (p < 0) {
        if (r > tMax) return false;
        if (r > tMin) tMin = r;
      } else {
        if (r < tMin) return false;
        if (r < tMax) tMax = r;
      }
    }
  }
  return tMin <= tMax;
}

/**
 * Generate the 4 expanded exterior corner points of an OBB in [x, z] coordinates.
 */
export function getExpandedOBBCornersXZ(obb, marginMeters = 1.8) {
  const cx = obb.east_m;
  const cz = -obb.north_m;
  const hw = obb.width_m * 0.5 + marginMeters;
  const hd = obb.depth_m * 0.5 + marginMeters;
  const ca = Math.cos(obb.yaw_rad);
  const sa = Math.sin(obb.yaw_rad);

  const signs = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
  return signs.map(([sx, sz]) => {
    const lx = sx * hw;
    const lz = sz * hd;
    // R_y(yaw) * (lx, 0, lz) = (ca*lx + sa*lz, -sa*lx + ca*lz)
    return [cx + ca * lx + sa * lz, cz - sa * lx + ca * lz];
  });
}

function isPointInsideAnyOBB(ptXZ, obstaclesOBB, marginMeters = 0.0) {
  for (let i = 0; i < obstaclesOBB.length; i++) {
    if (doesSegmentIntersectOBBXZ(ptXZ, ptXZ, obstaclesOBB[i], marginMeters)) {
      return true;
    }
  }
  return false;
}

function isSegmentClearOfOBBs(aXZ, bXZ, obstaclesOBB, marginMeters = 0.25) {
  for (let i = 0; i < obstaclesOBB.length; i++) {
    if (doesSegmentIntersectOBBXZ(aXZ, bXZ, obstaclesOBB[i], marginMeters)) {
      return false;
    }
  }
  return true;
}

/**
 * 2D OBB-Corner Visibility Graph A* solver.
 * Guarantees any segment between startXZ and goalXZ smoothly walks around obstructing
 * 3D building boxes instead of piercing them.
 */
export function isSegmentClearOfWaterXZ(aXZ, bXZ, waterPolygons = [], waterways = []) {
  const samples = 5;
  for (let s = 0; s <= samples; s++) {
    const t = s / samples;
    const px = aXZ[0] + (bXZ[0] - aXZ[0]) * t;
    const pz = aXZ[1] + (bXZ[1] - aXZ[1]) * t;
    const pn = -pz;
    for (const item of waterPolygons || []) {
      const poly = item?.outer || item;
      if (Array.isArray(poly) && poly.length >= 3 && pointInPoly2D(px, pn, poly)) {
        return false;
      }
    }
    // Also reject unbridged crossing over wide waterway ribbons (>18m)
    if (s > 0 && s < samples) {
      for (const w of waterways || []) {
        const halfW = (w?.widthMeters || 14) * 0.45;
        if (halfW < 8 || !Array.isArray(w.pointsEN)) continue;
        for (let k = 0; k < w.pointsEN.length - 1; k++) {
          const [e0, n0] = w.pointsEN[k];
          const [e1, n1] = w.pointsEN[k + 1];
          const vx = e1 - e0, vy = n1 - n0;
          const len2 = vx * vx + vy * vy || 1;
          const proj = Math.max(0, Math.min(1, ((px - e0) * vx + (pn - n0) * vy) / len2));
          const dist = Math.hypot(px - (e0 + proj * vx), pn - (n0 + proj * vy));
          if (dist < halfW) return false;
        }
      }
    }
  }
  return true;
}

export function findVisibilityDetourXZ(startXZ, goalXZ, obstaclesOBB = [], marginMeters = 1.35, waterPolygons = [], waterways = []) {
  const spatial = Array.isArray(obstaclesOBB) ? getSpatialOBBIndex(obstaclesOBB) : obstaclesOBB;
  const hasObs = Boolean(spatial && spatial.all && spatial.all.length > 0);
  const isClear = (a, b) =>
    (!hasObs || isSegmentClearSpatial(a, b, spatial, 0.12)) &&
    (waterPolygons.length === 0 && waterways.length === 0 ? true : isSegmentClearOfWaterXZ(a, b, waterPolygons, waterways));

  if (!hasObs && waterPolygons.length === 0 && waterways.length === 0) {
    return [startXZ, goalXZ];
  }
  if (isClear(startXZ, goalXZ)) {
    return [startXZ, goalXZ];
  }

  // Collect blocking OBBs via Spatial Grid Index along corridor envelope (+150m buffer)
  const minX = Math.min(startXZ[0], goalXZ[0]) - 150;
  const maxX = Math.max(startXZ[0], goalXZ[0]) + 150;
  const minZ = Math.min(startXZ[1], goalXZ[1]) - 150;
  const maxZ = Math.max(startXZ[1], goalXZ[1]) + 150;

  const localOBBs = querySpatialOBBsInBounds(spatial, minX, minZ, maxX, maxZ);

  const vertices = [startXZ];
  for (const ob of localOBBs) {
    if (!doesSegmentIntersectOBBXZ(startXZ, goalXZ, ob, 48.0)) continue;
    const corners = getExpandedOBBCornersXZ(ob, marginMeters);
    for (const c of corners) {
      if (!isPointInsideAnyOBB(c, localOBBs, 0.05)) {
        vertices.push(c);
        if (vertices.length >= 112) break;
      }
    }
    if (vertices.length >= 112) break;
  }
  vertices.push(goalXZ);

  const n = vertices.length;
  const startIdx = 0;
  const goalIdx = n - 1;
  const dist = new Float64Array(n).fill(1e18);
  const fScore = new Float64Array(n).fill(1e18);
  const prev = new Int32Array(n).fill(-1);
  const visited = new Uint8Array(n);

  const heuristic = (i) => Math.hypot(vertices[i][0] - goalXZ[0], vertices[i][1] - goalXZ[1]);
  dist[startIdx] = 0;
  fScore[startIdx] = heuristic(startIdx);
  const open = [startIdx];

  while (open.length > 0) {
    let bestOpenIdx = 0;
    for (let k = 1; k < open.length; k++) {
      if (fScore[open[k]] < fScore[open[bestOpenIdx]]) bestOpenIdx = k;
    }
    const u = open.splice(bestOpenIdx, 1)[0];
    if (u === goalIdx) break;
    if (visited[u]) continue;
    visited[u] = 1;

    for (let v = 0; v < n; v++) {
      if (v === u || visited[v]) continue;
      if (!isSegmentClearOfOBBs(vertices[u], vertices[v], localOBBs, 0.08)) continue;
      if ((waterPolygons.length > 0 || waterways.length > 0) && !isSegmentClearOfWaterXZ(vertices[u], vertices[v], waterPolygons, waterways)) continue;
      const stepD = Math.hypot(vertices[v][0] - vertices[u][0], vertices[v][1] - vertices[u][1]);
      const tentative = dist[u] + stepD;
      if (tentative < dist[v]) {
        dist[v] = tentative;
        prev[v] = u;
        fScore[v] = tentative + heuristic(v);
        if (!open.includes(v)) open.push(v);
      }
    }
  }

  if (prev[goalIdx] === -1) {
    return null; // Reject uncrossable OBB/water barriers instead of returning a pierced straight line!
  }
  const chain = [];
  for (let cur = goalIdx; cur !== -1; cur = prev[cur]) {
    chain.push(vertices[cur]);
  }
  chain.reverse();
  return chain;
}

function getHighwayWalkMultiplier(hw) {
  return WALK_ROUTING_WEIGHTS.walkwaySurfaceMultipliers[hw] ?? 1.24;
}

function tryVisibilityDetourXZ(startXZ, goalXZ, localOBBs, waterPolygons = [], waterways = []) {
  return (
    findVisibilityDetourXZ(startXZ, goalXZ, localOBBs, 1.35, waterPolygons, waterways) ||
    findVisibilityDetourXZ(startXZ, goalXZ, localOBBs, 0.45, waterPolygons, waterways)
  );
}

/**
 * Sample bilinear/local DEM elevation along polyline chains every <= maxSegMeters so
 * 3D routes hug hillsides and bridges cleanly without burrowing underground.
 */
function subdivideAndElevateChainXZ(chainXZ, elevationSampler, maxSegMeters = 8.0, extraLift = 0.42, isBridge = false) {
  if (!Array.isArray(chainXZ) || chainXZ.length === 0) return [];
  const sampleH = (x, z) => (typeof elevationSampler === 'function' ? elevationSampler(x, -z) : sampleTerrainHeight(x, -z));
  const out = [];
  const pushPoint = (x, z, yOverride = null) => {
    const prev = out[out.length - 1];
    if (prev && Math.hypot(prev[0] - x, prev[2] - z) <= 0.05) return;
    const rawY = sampleH(x, z) + extraLift;
    const y = yOverride !== null ? Math.max(rawY, yOverride) : rawY;
    out.push([Number(x.toFixed(2)), Number(y.toFixed(2)), Number(z.toFixed(2))]);
  };

  for (let i = 0; i < chainXZ.length - 1; i++) {
    const a = chainXZ[i];
    const b = chainXZ[i + 1];
    const segLen = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const steps = Math.max(1, Math.ceil(segLen / maxSegMeters));
    const deckA = isBridge ? sampleH(a[0], a[1]) + extraLift : null;
    const deckB = isBridge ? sampleH(b[0], b[1]) + extraLift : null;
    for (let s = (i === 0 ? 0 : 1); s <= steps; s++) {
      const t = s / steps;
      const x = a[0] + (b[0] - a[0]) * t;
      const z = a[1] + (b[1] - a[1]) * t;
      const deckY = isBridge ? deckA + (deckB - deckA) * t : null;
      pushPoint(x, z, deckY);
    }
  }
  if (chainXZ.length === 1) {
    pushPoint(chainXZ[0][0], chainXZ[0][1]);
  }
  return out;
}

/**
 * Find closest orthogonal projection points onto walkable road/footway segments within maxDistMeters.
 * Eliminates [NO PATH] and yard-cutting when intersection nodes are >60m apart along long blocks.
 */
function findNearestEdgeProjectionsXZ(
  ptXZ,
  nodes,
  edges,
  maxDistMeters,
  limit,
  excludeStairs,
  blockedEdges
) {
  if (!Array.isArray(edges) || edges.length === 0) return [];
  const [px, pz] = ptXZ;
  const cands = [];
  for (let idx = 0; idx < edges.length; idx++) {
    const e = edges[idx];
    const [u, v, rawDist, hw, hasStairs, debrisRisk, isBridge, isCrossing] = e;
    if (excludeStairs && hasStairs) continue;
    const nu = nodes[u];
    const nv = nodes[v];
    if (!nu || !nv) continue;
    const keyUV = `${nu[0]}->${nv[0]}`;
    const keyVU = `${nv[0]}->${nu[0]}`;
    if (blockedEdges && blockedEdges.has(keyUV) && blockedEdges.has(keyVU)) continue;

    const ux = nu[1], uz = -nu[2];
    const vx = nv[1], vz = -nv[2];
    if (Math.min(ux, vx) - maxDistMeters > px || Math.max(ux, vx) + maxDistMeters < px) continue;
    if (Math.min(uz, vz) - maxDistMeters > pz || Math.max(uz, vz) + maxDistMeters < pz) continue;

    const abx = vx - ux;
    const abz = vz - uz;
    const len2 = abx * abx + abz * abz;
    if (len2 < 4.0) continue;

    const t = Math.max(0.02, Math.min(0.98, ((px - ux) * abx + (pz - uz) * abz) / len2));
    const projX = ux + abx * t;
    const projZ = uz + abz * t;
    const d = Math.hypot(projX - px, projZ - pz);
    if (d <= maxDistMeters) {
      cands.push({
        edgeIdx: idx,
        u,
        v,
        t,
        xz: [projX, projZ],
        dist: d,
        uXZ: [ux, uz],
        vXZ: [vx, vz],
        edgeObj: {
          dist: rawDist,
          hw,
          hasStairs: !!hasStairs,
          isBridge: Boolean(isBridge || hw === 'bridge'),
          isCrossing: Boolean(isCrossing || hw === 'crossing'),
          debrisRisk: debrisRisk ?? 0,
          keyUV,
          keyVU
        }
      });
    }
  }
  cands.sort((a, b) => a.dist - b.dist);
  const distinct = [];
  for (const c of cands) {
    if (distinct.length >= limit) break;
    // Keep projections spaced >= 2.5m or referencing distinct edge corridors
    const tooClose = distinct.some(d => Math.hypot(d.xz[0] - c.xz[0], d.xz[1] - c.xz[1]) < 2.5);
    if (!tooClose) distinct.push(c);
  }
  return distinct;
}

/**
 * Solve optimal pedestrian evacuation route across real OpenStreetMap campus paths
 * using Euclidean A* with strict building-OBB collision avoidance, virtual street-edge
 * snapping, terrain elevation subdivision, slope weighting, and seismic debris awareness.
 *
 * @param {Object} options
 * @returns {{
 *   found: boolean,
 *   totalDistanceMeters: number,
 *   totalStairsDistanceMeters: number,
 *   hasStairs: boolean,
 *   stairFlightCount: number,
 *   isStepFree: boolean,
 *   edges: Array,
 *   waypoints3D: Array<[number, number, number]>,
 *   startNodeId: string,
 *   targetNodeId: string
 * }}
 */
export function solveCampusWalkGraph(options = {}) {
  const {
    startXZ = [73.68, -41.98],
    goalXZ = [222.89, 196.71],
    excludeStairs = false,
    buildingOBBs = REAL_OSM_BUILDINGS_FLAT,
    customWalkGraph = null,
    elevationSampler = sampleTerrainHeight,
    targetShelterId = 'SHELTER_HANYANG_STADIUM',
    originExclusionRadius = 0.0,
    originCentroidXZ = startXZ,
    seismicDebrisAware = true,
    blockedEdges = null,
    avoidPolygons = null,
    waterPolygons = [],
    waterways = [],
    penalizeEdgeKeys = null,
    overlapPenaltyMultiplier = WALK_ROUTING_WEIGHTS.alternativeEdgePenalty,
    maxStartSnapMeters = WALK_ROUTING_WEIGHTS.maxStartSnapMeters,
    maxGoalSnapMeters = WALK_ROUTING_WEIGHTS.maxGoalSnapMeters
  } = options;

  const activeAvoid = Array.isArray(avoidPolygons) ? avoidPolygons.filter(p => p && Array.isArray(p.polygonXZ)) : [];
  const segHitsAvoidPoly = (ax, az, bx, bz) => {
    for (let pi = 0; pi < activeAvoid.length; pi++) {
      const poly = activeAvoid[pi];
      if (poly.mode !== 'BLOCK') continue;
      const ring = poly.polygonXZ;
      for (let k = 0; k <= 6; k++) {
        const t = k / 6;
        const px = ax + (bx - ax) * t;
        const pz = az + (bz - az) * t;
        let inside = false;
        for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
          const xi = ring[i][0], zi = ring[i][1];
          const xj = ring[j][0], zj = ring[j][1];
          if (((zi > pz) !== (zj > pz)) && (px < ((xj - xi) * (pz - zi)) / ((zj - zi) || 1e-12) + xi)) {
            inside = !inside;
          }
        }
        if (inside) return true;
      }
    }
    return false;
  };

  const { nodes, edges, adj } = customWalkGraph ? getOrCompileWalkAdjacency(customWalkGraph) : CAMPUS_GRAPH_ADJ;
  if (nodes.length === 0) {
    return { found: false, reason: 'NO_WALKABLE_NETWORK_NODES', totalDistanceMeters: 0, totalStairsDistanceMeters: 0, hasStairs: false, stairFlightCount: 0, isStepFree: false, edges: [], waypoints3D: [] };
  }

  const spatialOBBs = getSpatialOBBIndex(buildingOBBs);
  const excludeRad2 = originExclusionRadius > 0 ? originExclusionRadius * originExclusionRadius : 0;

  // Push start point cleanly outside any containing neighbor/origin OBB unless Hanyang legacy bypass is active
  const safeStartXZ = (spatialOBBs && spatialOBBs.all.length > 0 && excludeRad2 <= 0)
    ? pushPointOutsideSpatialOBBs(startXZ, spatialOBBs, 1.4, originCentroidXZ, excludeRad2, goalXZ)
    : startXZ;
  const safeGoalXZ = (spatialOBBs && spatialOBBs.all.length > 0)
    ? pushPointOutsideSpatialOBBs(goalXZ, spatialOBBs, 1.2, originCentroidXZ, excludeRad2, goalXZ)
    : goalXZ;

  // Local OBB window around start portal / goal ingress (for visibility corner detour)
  const localPortalOBBs = querySpatialOBBsInBounds(
    spatialOBBs,
    safeStartXZ[0] - 280, safeStartXZ[1] - 280, safeStartXZ[0] + 280, safeStartXZ[1] + 280,
    originCentroidXZ, excludeRad2, goalXZ
  );
  const localGoalOBBs = querySpatialOBBsInBounds(
    spatialOBBs,
    safeGoalXZ[0] - 280, safeGoalXZ[1] - 280, safeGoalXZ[0] + 280, safeGoalXZ[1] + 280,
    originCentroidXZ, excludeRad2, goalXZ
  );

  // Select candidate walkable entry nodes AND orthogonal mid-edge street projections
  const startNodeCands = nodes
    .map((nd, idx) => ({
      kind: 'node',
      idx,
      xz: [nd[1], -nd[2]],
      dist: Math.hypot(nd[1] - safeStartXZ[0], -nd[2] - safeStartXZ[1])
    }))
    .filter(c => c.dist <= maxStartSnapMeters)
    .sort((a, b) => a.dist - b.dist)
    .slice(0, 10);

  const startEdgeProjs = findNearestEdgeProjectionsXZ(
    safeStartXZ, nodes, edges, maxStartSnapMeters, 10, excludeStairs, blockedEdges
  ).map(p => ({ kind: 'edge', ...p }));

  const startCands = [...startEdgeProjs, ...startNodeCands].sort((a, b) => a.dist - b.dist);

  // Select candidate goal nodes AND orthogonal mid-edge projections without dropping perimeter sides
  const rawGoalNodeCands = nodes
    .map((nd, idx) => ({
      kind: 'node',
      idx,
      xz: [nd[1], -nd[2]],
      dist: Math.hypot(nd[1] - safeGoalXZ[0], -nd[2] - safeGoalXZ[1])
    }))
    .filter(c => c.dist <= maxGoalSnapMeters)
    .sort((a, b) => a.dist - b.dist)
    .slice(0, 12);

  const goalEdgeProjs = findNearestEdgeProjectionsXZ(
    safeGoalXZ, nodes, edges, maxGoalSnapMeters, 10, excludeStairs, blockedEdges
  ).map(p => ({ kind: 'edge', ...p }));

  const goalCands = [...goalEdgeProjs, ...rawGoalNodeCands].sort((a, b) => a.dist - b.dist);

  if (startCands.length === 0 || goalCands.length === 0) {
    return { found: false, reason: 'ORIGIN_OR_GOAL_OUT_OF_GRAPH_RANGE', totalDistanceMeters: 0, totalStairsDistanceMeters: 0, hasStairs: false, stairFlightCount: 0, isStepFree: false, edges: [], waypoints3D: [] };
  }

  const measureChainLen = (chainXZ) => {
    let total = 0;
    for (let i = 0; i < chainXZ.length - 1; i++) {
      total += Math.hypot(chainXZ[i + 1][0] - chainXZ[i][0], chainXZ[i + 1][1] - chainXZ[i][1]);
    }
    return total;
  };

  // Validate virtual & node goal exits -> validGoals maps graph nodeIdx -> best exit specification
  const validGoals = new Map();
  const validGoalEdgeProjs = [];
  const registerGoalForNode = (nodeIdx, spec) => {
    const prev = validGoals.get(nodeIdx);
    if (!prev || spec.goalIngressLen < prev.goalIngressLen) {
      validGoals.set(nodeIdx, spec);
    }
  };

  let validatedGoalEntries = 0;
  for (const gCand of goalCands) {
    if (validatedGoalEntries >= 10 && gCand.dist > 95.0) break;
    const goalIngressChainXZ = tryVisibilityDetourXZ(gCand.xz, safeGoalXZ, localGoalOBBs, waterPolygons, waterways);
    if (!goalIngressChainXZ) continue;
    const ingressLen = measureChainLen(goalIngressChainXZ);

    if (gCand.kind === 'node') {
      validatedGoalEntries++;
      registerGoalForNode(gCand.idx, {
        idx: gCand.idx,
        goalIngressChainXZ,
        goalIngressLen: ingressLen,
        virtualEdge: null
      });
    } else {
      const eo = gCand.edgeObj;
      let addedEndpoint = false;
      const tryGoalEndpoint = (endIdx, endXZ, key) => {
        if (blockedEdges && blockedEdges.has(key)) return;
        if (spatialOBBs && spatialOBBs.all.length > 0 &&
          !isSegmentClearSpatial(endXZ, gCand.xz, spatialOBBs, -0.02, originCentroidXZ, excludeRad2, goalXZ)) {
          return;
        }
        if ((waterPolygons.length > 0 || waterways.length > 0) && !eo.isBridge &&
          !isSegmentClearOfWaterXZ(endXZ, gCand.xz, waterPolygons, waterways)) {
          return;
        }
        if (activeAvoid.length > 0 && segHitsAvoidPoly(endXZ[0], endXZ[1], gCand.xz[0], gCand.xz[1])) {
          return;
        }
        const subLen = Math.hypot(gCand.xz[0] - endXZ[0], gCand.xz[1] - endXZ[1]);
        registerGoalForNode(endIdx, {
          idx: endIdx,
          goalIngressChainXZ,
          goalIngressLen: ingressLen + subLen * getHighwayWalkMultiplier(eo.hw),
          rawSubLen: subLen,
          virtualEdge: {
            fromIdx: endIdx,
            projXZ: gCand.xz,
            subLen,
            edgeObj: eo
          }
        });
        addedEndpoint = true;
      };
      tryGoalEndpoint(gCand.u, gCand.uXZ, eo.keyUV);
      tryGoalEndpoint(gCand.v, gCand.vXZ, eo.keyVU);
      if (addedEndpoint) {
        validatedGoalEntries++;
        validGoalEdgeProjs.push({ ...gCand, goalIngressChainXZ, ingressLen });
      }
    }
  }
  if (validGoals.size === 0) {
    return { found: false, reason: 'NO_COLLISION_FREE_PATH_FOUND', totalDistanceMeters: 0, totalStairsDistanceMeters: 0, hasStairs: false, stairFlightCount: 0, isStepFree: false, edges: [], waypoints3D: [] };
  }

  // Validate virtual & node start entries -> seed Start entries into A*
  const validStarts = [];
  const validStartEdgeProjs = [];
  const collectStarts = (activeWaterways) => {
    let validatedStartEntries = 0;
    for (const sCand of startCands) {
      if (validatedStartEntries >= 8 && sCand.dist > 55.0) break;
      const portalChainXZ = tryVisibilityDetourXZ(safeStartXZ, sCand.xz, localPortalOBBs, waterPolygons, activeWaterways);
      if (!portalChainXZ) continue;
      const portalLen = measureChainLen(portalChainXZ);

      if (sCand.kind === 'node') {
        validatedStartEntries++;
        validStarts.push({
          idx: sCand.idx,
          portalChainXZ,
          portalLen,
          virtualEdge: null
        });
      } else {
        const eo = sCand.edgeObj;
        let addedEndpoint = false;
        const tryStartEndpoint = (endIdx, endXZ, key) => {
          if (blockedEdges && blockedEdges.has(key)) return;
          if (spatialOBBs && spatialOBBs.all.length > 0 &&
            !isSegmentClearSpatial(sCand.xz, endXZ, spatialOBBs, -0.02, originCentroidXZ, excludeRad2, goalXZ)) {
            return;
          }
          if ((waterPolygons.length > 0 || activeWaterways.length > 0) && !eo.isBridge &&
            !isSegmentClearOfWaterXZ(sCand.xz, endXZ, waterPolygons, activeWaterways)) {
            return;
          }
          if (activeAvoid.length > 0 && segHitsAvoidPoly(sCand.xz[0], sCand.xz[1], endXZ[0], endXZ[1])) {
            return;
          }
          const subLen = Math.hypot(endXZ[0] - sCand.xz[0], endXZ[1] - sCand.xz[1]);
          validStarts.push({
            idx: endIdx,
            portalChainXZ,
            portalLen: portalLen + subLen * getHighwayWalkMultiplier(eo.hw),
            rawPortalLen: portalLen,
            virtualEdge: {
              toIdx: endIdx,
              projXZ: sCand.xz,
              subLen,
              edgeObj: eo
            }
          });
          addedEndpoint = true;
        };
        tryStartEndpoint(sCand.u, sCand.uXZ, eo.keyUV);
        tryStartEndpoint(sCand.v, sCand.vXZ, eo.keyVU);
        if (addedEndpoint) {
          validatedStartEntries++;
          validStartEdgeProjs.push({ ...sCand, portalChainXZ, portalLen });
        }
      }
    }
  };
  collectStarts(waterways);
  if (validStarts.length === 0 && waterways.length > 0) {
    // Allow abutment footways near mapped bridge centerlines while still strictly avoiding water polygons & building OBBs
    collectStarts([]);
  }

  // Evaluate direct corridor when start and goal sit along the SAME road edge or within clear courtyard reach
  let directCandidate = null;
  for (const sProj of validStartEdgeProjs) {
    for (const gProj of validGoalEdgeProjs) {
      if (sProj.edgeIdx !== gProj.edgeIdx) continue;
      const segLen = Math.hypot(gProj.xz[0] - sProj.xz[0], gProj.xz[1] - sProj.xz[1]);
      if (spatialOBBs && spatialOBBs.all.length > 0 &&
        !isSegmentClearSpatial(sProj.xz, gProj.xz, spatialOBBs, -0.02, originCentroidXZ, excludeRad2, goalXZ)) {
        continue;
      }
      if ((waterPolygons.length > 0 || waterways.length > 0) && !sProj.edgeObj.isBridge &&
        !isSegmentClearOfWaterXZ(sProj.xz, gProj.xz, waterPolygons, waterways)) {
        continue;
      }
      if (activeAvoid.length > 0 && segHitsAvoidPoly(sProj.xz[0], sProj.xz[1], gProj.xz[0], gProj.xz[1])) {
        continue;
      }
      const totalScore = sProj.portalLen * 1.4 + segLen * getHighwayWalkMultiplier(sProj.edgeObj.hw) + gProj.ingressLen * 1.3;
      if (!directCandidate || totalScore < directCandidate.totalScore) {
        directCandidate = { sProj, gProj, segLen, totalScore };
      }
    }
  }

  if (validStarts.length === 0 && !directCandidate) {
    return { found: false, reason: 'NO_COLLISION_FREE_PATH_FOUND', totalDistanceMeters: 0, totalStairsDistanceMeters: 0, hasStairs: false, stairFlightCount: 0, isStepFree: false, edges: [], waypoints3D: [] };
  }

  // Single unified Multi-Source -> Multi-Goal A* over spatially hashed OBBs
  const n = nodes.length;
  const hCost = (idx) => Math.hypot(nodes[idx][1] - safeGoalXZ[0], -nodes[idx][2] - safeGoalXZ[1]);

  const runAStarPass = (allowOverhangFallback, ignoreWaterwayCenterline = false) => {
    const activeWaterways = ignoreWaterwayCenterline ? [] : waterways;
    const dist = new Float64Array(n).fill(1e18);
    const fScore = new Float64Array(n).fill(1e18);
    const prevNode = new Int32Array(n).fill(-1);
    const prevEdge = new Array(n).fill(null);
    const seedStartMap = new Map();
    const closed = new Uint8Array(n);
    const inOpen = new Uint8Array(n);
    const open = [];

    for (const s of validStarts) {
      const seedCost = s.portalLen * 1.4;
      if (seedCost < dist[s.idx]) {
        dist[s.idx] = seedCost;
        fScore[s.idx] = seedCost + hCost(s.idx);
        seedStartMap.set(s.idx, s);
        if (!inOpen[s.idx]) {
          open.push(s.idx);
          inOpen[s.idx] = 1;
        }
      }
    }

    let bestSolution = null;
    let bestScore = directCandidate ? directCandidate.totalScore : Infinity;

    while (open.length > 0) {
      let bestPos = 0;
      let bestF = fScore[open[0]];
      for (let k = 1; k < open.length; k++) {
        const f = fScore[open[k]];
        if (f < bestF) { bestF = f; bestPos = k; }
      }
      if ((bestSolution || (!allowOverhangFallback && directCandidate)) && bestF >= bestScore) break;

      const u = open[bestPos];
      open[bestPos] = open[open.length - 1];
      open.pop();
      inOpen[u] = 0;
      if (closed[u]) continue;
      closed[u] = 1;

      if (validGoals.has(u)) {
        const gInfo = validGoals.get(u);
        const totalScore = dist[u] + gInfo.goalIngressLen * 1.3;
        if (totalScore < bestScore) {
          bestScore = totalScore;
          bestSolution = { goalIdx: u, gInfo, totalScore };
        }
      }

      const uXZ = [nodes[u][1], -nodes[u][2]];
      const neighbors = adj[u];
      for (let i = 0; i < neighbors.length; i++) {
        const edge = neighbors[i];
        if (closed[edge.to]) continue;
        if (excludeStairs && edge.hasStairs) continue;
        if (blockedEdges && blockedEdges.has(edge.edgeKey)) continue;

        const vXZ = [nodes[edge.to][1], -nodes[edge.to][2]];
        let hitsOBB = false;
        if (spatialOBBs && spatialOBBs.all.length > 0 &&
          !isSegmentClearSpatial(uXZ, vXZ, spatialOBBs, -0.02, originCentroidXZ, excludeRad2, goalXZ)) {
          if (!allowOverhangFallback) continue;
          hitsOBB = true;
        }
        if ((waterPolygons.length > 0 || activeWaterways.length > 0) && !edge.isBridge &&
          !isSegmentClearOfWaterXZ(uXZ, vXZ, waterPolygons, activeWaterways)) {
          continue;
        }
        if (activeAvoid.length > 0 && segHitsAvoidPoly(uXZ[0], uXZ[1], vXZ[0], vXZ[1])) {
          continue;
        }

        let mult = getHighwayWalkMultiplier(edge.hw);
        if (edge.isBridge) mult *= WALK_ROUTING_WEIGHTS.bridgeInspectionMultiplier;
        if (excludeStairs && edge.dist > 1.0 && Math.abs(edge.dy) / edge.dist > WALK_ROUTING_WEIGHTS.steepRampAccessibleSlopeThreshold) {
          mult *= WALK_ROUTING_WEIGHTS.steepRampAccessiblePenalty;
        }
        if (seismicDebrisAware && edge.debrisRisk > 0) {
          mult *= (1.0 + edge.debrisRisk * WALK_ROUTING_WEIGHTS.debrisRiskMultiplierGain);
        }
        if (penalizeEdgeKeys && penalizeEdgeKeys.has(edge.edgeKey)) {
          mult *= overlapPenaltyMultiplier;
        }
        const overhangPenalty = hitsOBB ? (edge.dist * 26.0 + 110.0) : 0.0;
        const uphill = Math.max(0, edge.dy) * WALK_ROUTING_WEIGHTS.uphillGainPerMeter;
        const nextCost = dist[u] + edge.dist * mult + uphill + overhangPenalty;

        if (nextCost < dist[edge.to]) {
          dist[edge.to] = nextCost;
          prevNode[edge.to] = u;
          prevEdge[edge.to] = edge;
          fScore[edge.to] = nextCost + hCost(edge.to);
          if (!inOpen[edge.to]) {
            open.push(edge.to);
            inOpen[edge.to] = 1;
          }
        }
      }
    }

    return { bestSolution, prevNode, prevEdge, seedStartMap };
  };

  let astarResult = runAStarPass(false, false);
  let usedOverhangFallback = false;
  if (!astarResult.bestSolution && !directCandidate && waterways.length > 0) {
    // Retry mapped bridge-abutment OSM footways without 1D waterway centerline ribbon while preserving strict OBB & waterPolygon checks
    astarResult = runAStarPass(false, true);
  }
  if (!astarResult.bestSolution && !directCandidate) {
    // Fallback strictly when a walled courtyard/compound only exits through a mapped OSM gatehouse/archway
    astarResult = runAStarPass(true, true);
    usedOverhangFallback = Boolean(astarResult.bestSolution);
  }
  const { bestSolution, prevNode, prevEdge, seedStartMap } = astarResult;

  const outEdges = [];
  let totalDist = 0;
  let totalStairDist = 0;
  let stairFlights = 0;
  let prevWasStairs = false;
  const branchLabel = excludeStairs ? 'STEP_FREE' : 'SHORTEST';

  // Return direct same-edge route if optimal
  if (!bestSolution && directCandidate) {
    const { sProj, gProj, segLen } = directCandidate;
    if (sProj.portalLen > 0.6) {
      outEdges.push({
        edgeId: `PORTAL_APPROACH->EDGE_${sProj.edgeIdx}`,
        from: 'PORTAL_APPROACH',
        to: `OSM_EDGE_${sProj.edgeIdx}_ENTRY`,
        distance: Number(sProj.portalLen.toFixed(1)),
        hasStairs: false,
        isWheelchairPassable: true,
        highway: 'footway',
        branch: branchLabel,
        waypoints: subdivideAndElevateChainXZ(sProj.portalChainXZ, elevationSampler, 8.0, 0.42, false)
      });
      totalDist += sProj.portalLen;
    }
    if (segLen > 0.4) {
      outEdges.push({
        edgeId: `OSM_SEG_${sProj.edgeIdx}`,
        from: `OSM_EDGE_${sProj.edgeIdx}_ENTRY`,
        to: `OSM_EDGE_${sProj.edgeIdx}_EXIT`,
        distance: Number(segLen.toFixed(1)),
        hasStairs: sProj.edgeObj.hasStairs,
        isWheelchairPassable: !sProj.edgeObj.hasStairs,
        highway: sProj.edgeObj.hw,
        hazardRisk: sProj.edgeObj.debrisRisk > 0.45 ? 'MODERATE' : (sProj.edgeObj.hasStairs ? 'HIGH' : 'LOW'),
        branch: branchLabel,
        waypoints: subdivideAndElevateChainXZ([sProj.xz, gProj.xz], elevationSampler, 8.0, 0.42, sProj.edgeObj.isBridge)
      });
      totalDist += segLen;
    }
    if (gProj.ingressLen > 0.6) {
      outEdges.push({
        edgeId: `OSM_EDGE_${sProj.edgeIdx}->SHELTER_INGRESS`,
        from: `OSM_EDGE_${sProj.edgeIdx}_EXIT`,
        to: targetShelterId,
        distance: Number(gProj.ingressLen.toFixed(1)),
        hasStairs: false,
        isWheelchairPassable: true,
        highway: 'shelter_ingress',
        branch: branchLabel,
        waypoints: subdivideAndElevateChainXZ(gProj.goalIngressChainXZ, elevationSampler, 8.0, 0.42, false)
      });
      totalDist += gProj.ingressLen;
    }
    const waypoints3D = [];
    for (const e of outEdges) {
      for (const wp of e.waypoints) {
        const prev = waypoints3D[waypoints3D.length - 1];
        if (!prev || Math.hypot(prev[0] - wp[0], prev[2] - wp[2]) > 0.05) waypoints3D.push(wp);
      }
    }
    return {
      portalIdx: sProj.u,
      goalIdx: gProj.v,
      found: true,
      totalDistanceMeters: Number(totalDist.toFixed(1)),
      totalStairsDistanceMeters: 0,
      hasStairs: false,
      stairFlightCount: 0,
      isStepFree: true,
      edges: outEdges,
      waypoints3D,
      startNodeId: `OSM_NODE_${nodes[sProj.u][0]}`,
      targetNodeId: `OSM_NODE_${nodes[gProj.v][0]}`
    };
  }

  if (!bestSolution) {
    return { found: false, reason: 'NO_COLLISION_FREE_PATH_FOUND', totalDistanceMeters: 0, totalStairsDistanceMeters: 0, hasStairs: false, stairFlightCount: 0, isStepFree: false, edges: [], waypoints3D: [] };
  }

  const rawEdges = [];
  let portalIdx = bestSolution.goalIdx;
  while (prevNode[portalIdx] !== -1) {
    const p = prevNode[portalIdx];
    rawEdges.push({ uNd: nodes[p], vNd: nodes[portalIdx], edge: prevEdge[portalIdx] });
    portalIdx = p;
  }
  rawEdges.reverse();

  const chosenStart = seedStartMap.get(portalIdx) || validStarts[0];
  const goalIdx = bestSolution.goalIdx;
  const gInfo = bestSolution.gInfo;

  // Emit Portal (and optional virtual edge entry sub-segment [P_start -> portalNode])
  const startRawPortalLen = chosenStart.virtualEdge ? chosenStart.rawPortalLen : chosenStart.portalLen;
  if (startRawPortalLen > 0.6) {
    outEdges.push({
      edgeId: `PORTAL_APPROACH->OSM_${nodes[portalIdx][0]}`,
      from: 'PORTAL_APPROACH',
      to: chosenStart.virtualEdge ? `OSM_ENTRY_PROJ_${nodes[portalIdx][0]}` : `OSM_NODE_${nodes[portalIdx][0]}`,
      distance: Number(startRawPortalLen.toFixed(1)),
      hasStairs: false,
      isWheelchairPassable: true,
      highway: 'footway',
      branch: branchLabel,
      waypoints: subdivideAndElevateChainXZ(chosenStart.portalChainXZ, elevationSampler, 8.0, 0.42, false)
    });
    totalDist += startRawPortalLen;
  }
  if (chosenStart.virtualEdge && chosenStart.virtualEdge.subLen > 0.4) {
    const ve = chosenStart.virtualEdge;
    const toXZ = [nodes[ve.toIdx][1], -nodes[ve.toIdx][2]];
    outEdges.push({
      edgeId: `OSM_PROJ->OSM_${nodes[ve.toIdx][0]}`,
      from: `OSM_ENTRY_PROJ_${nodes[portalIdx][0]}`,
      to: `OSM_NODE_${nodes[ve.toIdx][0]}`,
      distance: Number(ve.subLen.toFixed(1)),
      hasStairs: ve.edgeObj.hasStairs,
      isWheelchairPassable: !ve.edgeObj.hasStairs,
      highway: ve.edgeObj.hw,
      hazardRisk: ve.edgeObj.debrisRisk > 0.45 ? 'MODERATE' : (ve.edgeObj.hasStairs ? 'HIGH' : 'LOW'),
      branch: branchLabel,
      waypoints: subdivideAndElevateChainXZ([ve.projXZ, toXZ], elevationSampler, 8.0, 0.42, ve.edgeObj.isBridge)
    });
    totalDist += ve.subLen;
  }

  for (let ei = 0; ei < rawEdges.length; ei++) {
    const item = rawEdges[ei];
    const { uNd, vNd, edge } = item;
    const uXZ = [uNd[1], -uNd[2]];
    const vXZ = [vNd[1], -vNd[2]];

    // When gatehouse/overhang fallback is used, route cleanly around that isolated OBB flank whenever passable
    if (usedOverhangFallback && spatialOBBs && spatialOBBs.all.length > 0 &&
      !isSegmentClearSpatial(uXZ, vXZ, spatialOBBs, -0.02, originCentroidXZ, excludeRad2, goalXZ)) {
      let endEi = ei;
      while (endEi + 1 < rawEdges.length && endEi - ei < 5) {
        const curVXZ = [rawEdges[endEi].vNd[1], -rawEdges[endEi].vNd[2]];
        const nextVXZ = [rawEdges[endEi + 1].vNd[1], -rawEdges[endEi + 1].vNd[2]];
        const vInside = !isSegmentClearSpatial(curVXZ, curVXZ, spatialOBBs, 0.05, originCentroidXZ, excludeRad2, goalXZ);
        const nextBlocked = !isSegmentClearSpatial(curVXZ, nextVXZ, spatialOBBs, -0.02, originCentroidXZ, excludeRad2, goalXZ);
        if (vInside || nextBlocked) {
          endEi++;
        } else {
          break;
        }
      }
      const endVNd = rawEdges[endEi].vNd;
      const endVXZ = pushPointOutsideSpatialOBBs([endVNd[1], -endVNd[2]], spatialOBBs, 1.2, originCentroidXZ, excludeRad2, goalXZ);
      const minX = Math.min(uXZ[0], endVXZ[0]) - 85;
      const maxX = Math.max(uXZ[0], endVXZ[0]) + 85;
      const minZ = Math.min(uXZ[1], endVXZ[1]) - 85;
      const maxZ = Math.max(uXZ[1], endVXZ[1]) + 85;
      const blockOBBs = querySpatialOBBsInBounds(spatialOBBs, minX, minZ, maxX, maxZ, originCentroidXZ, excludeRad2, goalXZ);
      const flankChain = tryVisibilityDetourXZ(uXZ, endVXZ, blockOBBs, waterPolygons, waterways);
      if (flankChain && flankChain.length >= 2) {
        const flankDist = measureChainLen(flankChain);
        let anyStairs = false;
        let anyBridge = false;
        let maxRisk = 0;
        for (let k = ei; k <= endEi; k++) {
          if (rawEdges[k].edge.hasStairs) {
            anyStairs = true;
            totalStairDist += rawEdges[k].edge.dist;
          }
          if (rawEdges[k].edge.isBridge) anyBridge = true;
          if ((rawEdges[k].edge.debrisRisk ?? 0) > maxRisk) maxRisk = rawEdges[k].edge.debrisRisk;
        }
        if (anyStairs && !prevWasStairs) stairFlights++;
        prevWasStairs = anyStairs;
        totalDist += flankDist;
        outEdges.push({
          edgeId: `OSM_${uNd[0]}->OSM_${endVNd[0]}`,
          from: `OSM_NODE_${uNd[0]}`,
          to: `OSM_NODE_${endVNd[0]}`,
          distance: Number(flankDist.toFixed(1)),
          hasStairs: anyStairs,
          isWheelchairPassable: !anyStairs,
          highway: edge.hw,
          hazardRisk: maxRisk > 0.45 ? 'MODERATE' : (anyStairs ? 'HIGH' : 'LOW'),
          branch: branchLabel,
          waypoints: subdivideAndElevateChainXZ(flankChain, elevationSampler, 8.0, 0.42, anyBridge)
        });
        ei = endEi;
        continue;
      }
    }

    totalDist += edge.dist;
    if (edge.hasStairs) {
      totalStairDist += edge.dist;
      if (!prevWasStairs) stairFlights++;
    }
    prevWasStairs = edge.hasStairs;

    outEdges.push({
      edgeId: `OSM_${uNd[0]}->OSM_${vNd[0]}`,
      from: `OSM_NODE_${uNd[0]}`,
      to: `OSM_NODE_${vNd[0]}`,
      distance: Number(edge.dist.toFixed(1)),
      hasStairs: edge.hasStairs,
      isWheelchairPassable: !edge.hasStairs,
      highway: edge.hw,
      hazardRisk: edge.debrisRisk > 0.45 ? 'MODERATE' : (edge.hasStairs ? 'HIGH' : 'LOW'),
      branch: branchLabel,
      waypoints: subdivideAndElevateChainXZ([uXZ, vXZ], elevationSampler, 8.0, 0.42, edge.isBridge)
    });
  }

  // Emit optional virtual edge exit sub-segment [goalNode -> G_P] and final Shelter Ingress
  if (gInfo.virtualEdge && gInfo.virtualEdge.subLen > 0.4) {
    const ge = gInfo.virtualEdge;
    const fromXZ = [nodes[ge.fromIdx][1], -nodes[ge.fromIdx][2]];
    outEdges.push({
      edgeId: `OSM_${nodes[ge.fromIdx][0]}->OSM_EXIT_PROJ`,
      from: `OSM_NODE_${nodes[ge.fromIdx][0]}`,
      to: `OSM_EXIT_PROJ_${nodes[goalIdx][0]}`,
      distance: Number(ge.subLen.toFixed(1)),
      hasStairs: ge.edgeObj.hasStairs,
      isWheelchairPassable: !ge.edgeObj.hasStairs,
      highway: ge.edgeObj.hw,
      hazardRisk: ge.edgeObj.debrisRisk > 0.45 ? 'MODERATE' : (ge.edgeObj.hasStairs ? 'HIGH' : 'LOW'),
      branch: branchLabel,
      waypoints: subdivideAndElevateChainXZ([fromXZ, ge.projXZ], elevationSampler, 8.0, 0.42, ge.edgeObj.isBridge)
    });
    totalDist += ge.subLen;
  }

  const finalIngressLen = measureChainLen(gInfo.goalIngressChainXZ);
  if (finalIngressLen > 0.6) {
    outEdges.push({
      edgeId: `OSM_${nodes[goalIdx][0]}->SHELTER_INGRESS`,
      from: gInfo.virtualEdge ? `OSM_EXIT_PROJ_${nodes[goalIdx][0]}` : `OSM_NODE_${nodes[goalIdx][0]}`,
      to: targetShelterId,
      distance: Number(finalIngressLen.toFixed(1)),
      hasStairs: false,
      isWheelchairPassable: true,
      highway: 'shelter_ingress',
      branch: branchLabel,
      waypoints: subdivideAndElevateChainXZ(gInfo.goalIngressChainXZ, elevationSampler, 8.0, 0.42, false)
    });
    totalDist += finalIngressLen;
  }

  // Merge flattened 3D waypoints
  const waypoints3D = [];
  for (const e of outEdges) {
    for (const wp of e.waypoints) {
      const prev = waypoints3D[waypoints3D.length - 1];
      if (!prev || Math.hypot(prev[0] - wp[0], prev[2] - wp[2]) > 0.05) {
        waypoints3D.push(wp);
      }
    }
  }

  return {
    portalIdx,
    goalIdx,
    found: true,
    totalDistanceMeters: Number(totalDist.toFixed(1)),
    totalStairsDistanceMeters: Number(totalStairDist.toFixed(1)),
    hasStairs: stairFlights > 0,
    stairFlightCount: stairFlights,
    isStepFree: stairFlights === 0,
    edges: outEdges,
    waypoints3D,
    startNodeId: `OSM_NODE_${nodes[portalIdx][0]}`,
    targetNodeId: `OSM_NODE_${nodes[goalIdx][0]}`
  };
}

function pointInPoly2D(x, y, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i][0], yi = poly[i][1];
    const xj = poly[j][0], yj = poly[j][1];
    if (((yi > y) !== (yj > y)) && (x < ((xj - xi) * (y - yi)) / ((yj - yi) || 1e-12) + xi)) {
      inside = !inside;
    }
  }
  return inside;
}

export function polygonArea2D(pts) {
  let s = 0;
  for (let i = 0; i < pts.length; i++) {
    const j = (i + 1) % pts.length;
    s += pts[i][0] * pts[j][1] - pts[j][0] * pts[i][1];
  }
  return Math.abs(s) * 0.5;
}

/**
 * Pure JS port of multi-wing concave OBB decomposition for live nationwide OSM buildings.
 * Converts L/U/courtyard shapes into crisp rectangular OBB wings so walkways stay unobstructed.
 */
export function decomposePolygonToOBBs(ptsEN, heightMeters = 12.0) {
  if (!Array.isArray(ptsEN) || ptsEN.length < 3) return [];
  const first = ptsEN[0];
  const last = ptsEN[ptsEN.length - 1];
  const ring = (ptsEN.length > 3 && Math.hypot(first[0] - last[0], first[1] - last[1]) < 1e-3)
    ? ptsEN.slice(0, -1)
    : ptsEN;
  if (ring.length < 3) return [];

  let best = null;
  for (let i = 0; i < ring.length; i++) {
    const p1 = ring[i];
    const p2 = ring[(i + 1) % ring.length];
    const ang = Math.atan2(p2[1] - p1[1], p2[0] - p1[0]);
    const ca = Math.cos(ang);
    const sa = Math.sin(ang);
    let u0 = Infinity, u1 = -Infinity, v0 = Infinity, v1 = -Infinity;
    for (let k = 0; k < ring.length; k++) {
      const u = ring[k][0] * ca + ring[k][1] * sa;
      const v = -ring[k][0] * sa + ring[k][1] * ca;
      if (u < u0) u0 = u;
      if (u > u1) u1 = u;
      if (v < v0) v0 = v;
      if (v > v1) v1 = v;
    }
    const areaBox = (u1 - u0) * (v1 - v0);
    if (!best || areaBox < best.areaBox) {
      best = { areaBox, ang, ca, sa, u0, u1, v0, v1 };
    }
  }
  if (!best) return [];

  const { areaBox, ang, ca, sa, u0, u1, v0, v1 } = best;
  const polyA = polygonArea2D(ring);
  const fill = polyA / Math.max(1.0, areaBox);
  if (fill >= 0.74 || (u1 - u0) < 15.0 || (v1 - v0) < 15.0) {
    const uc = (u0 + u1) * 0.5;
    const vc = (v0 + v1) * 0.5;
    return [[uc * ca - vc * sa, uc * sa + vc * ca, u1 - u0, v1 - v0, ang, heightMeters]];
  }

  const nu = Math.max(2, Math.min(12, Math.round((u1 - u0) / 6.0)));
  const nv = Math.max(2, Math.min(12, Math.round((v1 - v0) / 6.0)));
  const du = (u1 - u0) / nu;
  const dv = (v1 - v0) / nv;
  const grid = Array.from({ length: nv }, (_, iv) =>
    Array.from({ length: nu }, (_, iu) => {
      const uc = u0 + (iu + 0.5) * du;
      const vc = v0 + (iv + 0.5) * dv;
      return pointInPoly2D(uc * ca - vc * sa, uc * sa + vc * ca, ring);
    })
  );
  const covered = Array.from({ length: nv }, () => Array(nu).fill(false));
  const obbs = [];
  for (let iv = 0; iv < nv; iv++) {
    for (let iu = 0; iu < nu; iu++) {
      if (!grid[iv][iu] || covered[iv][iu]) continue;
      let eu = iu;
      while (eu + 1 < nu && grid[iv][eu + 1] && !covered[iv][eu + 1]) eu++;
      let ev = iv;
      outer: while (ev + 1 < nv) {
        for (let k = iu; k <= eu; k++) {
          if (!grid[ev + 1][k] || covered[ev + 1][k]) break outer;
        }
        ev++;
      }
      for (let kv = iv; kv <= ev; kv++) {
        for (let ku = iu; ku <= eu; ku++) covered[kv][ku] = true;
      }
      const uc = (u0 + iu * du + u0 + (eu + 1) * du) * 0.5;
      const vc = (v0 + iv * dv + v0 + (ev + 1) * dv) * 0.5;
      obbs.push([uc * ca - vc * sa, uc * sa + vc * ca, (eu - iu + 1) * du, (ev - iv + 1) * dv, ang, heightMeters]);
    }
  }
  return obbs;
}

/**
 * Construct a dynamic provenance-tagged FacilityPackage from ANY selected 3D building
 * OBB (supports arbitrary clicked buildings in Hanyang or nationwide OSM regions).
 */
export function buildDynamicFacilityFromPoint({
  buildingId = 'DYNAMIC_BLDG',
  name = '선택 건축물',
  unitNumber = '',
  east_m = 0,
  north_m = 0,
  width_m = 28,
  depth_m = 20,
  yaw_rad = 0,
  height_m = 18,
  anchor = { lat: 37.555815, lon: 127.045053, h: 42.0 },
  walkGraph = null,
  buildingOBBs = REAL_OSM_BUILDINGS_FLAT,
  shelter = null,
  waterPolygons = [],
  waterways = [],
  indoorScope = 'HEIGHT_ONLY_3D',
  elevationSampler = sampleTerrainHeight
} = {}) {
  const groundY = Number(((typeof elevationSampler === 'function' ? elevationSampler(east_m, north_m) : 0) || 0).toFixed(2));
  const totalLevels = Math.max(1, Math.min(30, Math.round(height_m / 3.6)));
  const floorHeightMeters = 3.6;
  const hasIndoorData = indoorScope === 'PROVISIONAL_FLOORPLAN' || indoorScope === 'VERIFIED_INDOOR';
  const defaultFloor = hasIndoorData ? Math.min(totalLevels, Math.max(2, Math.round(totalLevels * 0.5))) : 1;
  const targetY = groundY + (defaultFloor - 1) * floorHeightMeters;

  const centerX = east_m;
  const centerZ = -north_m;
  const obbObj = { east_m, north_m, width_m, depth_m, yaw_rad, height_m, boundR: Math.hypot(width_m, depth_m) * 0.5 };
  const corners = getExpandedOBBCornersXZ(obbObj, 0.0);
  const footprint = [...corners, corners[0]].map(p => Object.freeze([Number(p[0].toFixed(2)), Number(p[1].toFixed(2))]));

  const hasValidShelter = Boolean(
    shelter && (shelter.localCenter || shelter.positionThree || (typeof shelter.east_m === 'number' && typeof shelter.north_m === 'number'))
  );
  const shelterXZ = hasValidShelter
    ? (shelter.localCenter
      ? [shelter.localCenter[0], shelter.localCenter[2]]
      : (shelter.positionThree
        ? [shelter.positionThree[0], shelter.positionThree[2]]
        : [shelter.east_m, -shelter.north_m]))
    : null;
  const shelterY = shelterXZ
    ? Number(
      (shelter?.localCenter?.[1] ??
        shelter?.positionThree?.[1] ??
        (typeof elevationSampler === 'function' ? elevationSampler(shelterXZ[0], -shelterXZ[1]) : groundY) ??
        groundY).toFixed(2)
    )
    : groundY;

  const spatialIdx = getSpatialOBBIndex(buildingOBBs);
  const allNearOBBs = querySpatialOBBsInBounds(
    spatialIdx,
    centerX - 75, centerZ - 75, centerX + 75, centerZ + 75,
    null, 0, null
  );
  // Exclude ONLY the exact clicked OBB footprint when picking exterior doorway candidates; neighbor wings/buildings stay active
  const nearOBBs = allNearOBBs.filter(ob =>
    !(Math.hypot(ob.east_m - obbObj.east_m, ob.north_m - obbObj.north_m) < 0.25 &&
      Math.abs(ob.width_m - obbObj.width_m) < 0.25 &&
      Math.abs(ob.depth_m - obbObj.depth_m) < 0.25)
  );

  // Collect local road/footway segments around building so doorway selection strongly prefers street-facing exits
  const gNodes = walkGraph?.nodes || [];
  const gEdges = walkGraph?.edges || [];
  const localRoadSegs = [];
  for (let i = 0; i < gEdges.length; i++) {
    const nu = gNodes[gEdges[i][0]];
    const nv = gNodes[gEdges[i][1]];
    if (!nu || !nv) continue;
    const ux = nu[1], uz = -nu[2], vx = nv[1], vz = -nv[2];
    if (Math.max(ux, vx) < centerX - 110 || Math.min(ux, vx) > centerX + 110) continue;
    if (Math.max(uz, vz) < centerZ - 110 || Math.min(uz, vz) > centerZ + 110) continue;
    localRoadSegs.push([ux, uz, vx, vz]);
  }
  const distToNearestStreet = (px, pz) => {
    if (localRoadSegs.length === 0) return 0;
    let best = 140.0;
    for (let i = 0; i < localRoadSegs.length; i++) {
      const [ax, az, bx, bz] = localRoadSegs[i];
      const abx = bx - ax, abz = bz - az;
      const l2 = abx * abx + abz * abz;
      const t = l2 > 1e-6 ? Math.max(0, Math.min(1, ((px - ax) * abx + (pz - az) * abz) / l2)) : 0;
      const d = Math.hypot(px - (ax + abx * t), pz - (az + abz * t));
      if (d < best) best = d;
    }
    return best;
  };

  const exitCandidates = [];
  for (let i = 0; i < 4; i++) {
    const a = corners[i];
    const b = corners[(i + 1) % 4];
    const mx = (a[0] + b[0]) * 0.5;
    const mz = (a[1] + b[1]) * 0.5;
    const vx = mx - centerX;
    const vz = mz - centerZ;
    const vLen = Math.max(1e-6, Math.hypot(vx, vz));
    const ux = vx / vLen, uz = vz / vLen;
    for (const pushOut of [3.2, 6.2]) {
      const fx = mx + ux * pushOut;
      const fz = mz + uz * pushOut;
      const blocked = allNearOBBs.length > 0 && isPointInsideAnyOBB([fx, fz], allNearOBBs, 0.35);
      const streetDist = distToNearestStreet(fx, fz);
      const outDist = shelterXZ ? Math.hypot(mx - shelterXZ[0], mz - shelterXZ[1]) : Math.hypot(mx - centerX, mz - centerZ);
      exitCandidates.push({
        mx, mz, fx, fz, vx: ux, vz: uz, blocked,
        score: streetDist * 1.85 + outDist * 0.25 + (pushOut > 4.0 ? 3.5 : 0)
      });
    }
    // Also test corner exit candidates for L-shaped/tight courtyard buildings
    const cx = a[0] - centerX, cz = a[1] - centerZ;
    const cLen = Math.max(1e-6, Math.hypot(cx, cz));
    const cux = cx / cLen, cuz = cz / cLen;
    const cfx = a[0] + cux * 3.8, cfz = a[1] + cuz * 3.8;
    const cBlocked = allNearOBBs.length > 0 && isPointInsideAnyOBB([cfx, cfz], allNearOBBs, 0.35);
    const cStreetDist = distToNearestStreet(cfx, cfz);
    const cOutDist = shelterXZ ? Math.hypot(a[0] - shelterXZ[0], a[1] - shelterXZ[1]) : cLen;
    exitCandidates.push({
      mx: a[0], mz: a[1], fx: cfx, fz: cfz, vx: cux, vz: cuz, blocked: cBlocked,
      score: cStreetDist * 1.85 + cOutDist * 0.25 + 2.0
    });
  }
  exitCandidates.sort((a, b) => (a.blocked === b.blocked ? a.score - b.score : (a.blocked ? 1 : -1)));

  const bestExit = exitCandidates[0];
  const doorXZ = [bestExit.mx, bestExit.mz];
  const vecOutX = bestExit.vx;
  const vecOutZ = bestExit.vz;
  const normOut = 1.0;
  const footwayXZ = bestExit.blocked
    ? pushPointOutsideSpatialOBBs([bestExit.fx, bestExit.fz], spatialIdx, 1.5, null, 0, shelterXZ)
    : [bestExit.fx, bestExit.fz];
  const footwayY = Number(((typeof elevationSampler === 'function' ? elevationSampler(footwayXZ[0], -footwayXZ[1]) : groundY) + 0.25).toFixed(2));

  // Only bypass strict building OBB collision for legacy Hanyang Engineering I calibrated courtyard
  const originBypassRad = buildingId === 'BLDG_212_ENG1' ? 32.0 : 0.0;
  const targetShelterId = shelter?.shelterId || shelter?.id || null;
  const emptySol = { found: false, totalDistanceMeters: 0, hasStairs: false, edges: [], targetNodeId: null };
  const shortestSol = hasValidShelter
    ? solveCampusWalkGraph({
      startXZ: footwayXZ,
      goalXZ: shelterXZ,
      excludeStairs: false,
      buildingOBBs,
      customWalkGraph: walkGraph,
      elevationSampler,
      targetShelterId,
      waterPolygons,
      waterways,
      originCentroidXZ: [centerX, centerZ],
      originExclusionRadius: originBypassRad
    })
    : emptySol;
  const stepFreeSol = hasValidShelter
    ? solveCampusWalkGraph({
      startXZ: footwayXZ,
      goalXZ: shelterXZ,
      excludeStairs: true,
      buildingOBBs,
      customWalkGraph: walkGraph,
      elevationSampler,
      targetShelterId,
      waterPolygons,
      waterways,
      originCentroidXZ: [centerX, centerZ],
      originExclusionRadius: originBypassRad
    })
    : emptySol;

  // Genuine distinct alternative path using edge-overlap penalty (only on real graph)
  const usedShortKeys = new Set((shortestSol.edges || []).map(e => e.edgeId?.replace('OSM_', '').replace('->OSM_', '->')));
  const altSol = (hasValidShelter && shortestSol.found)
    ? solveCampusWalkGraph({
      startXZ: footwayXZ,
      goalXZ: shelterXZ,
      excludeStairs: false,
      buildingOBBs,
      customWalkGraph: walkGraph,
      elevationSampler,
      targetShelterId,
      waterPolygons,
      waterways,
      penalizeEdgeKeys: usedShortKeys,
      overlapPenaltyMultiplier: WALK_ROUTING_WEIGHTS.alternativeEdgePenalty,
      originCentroidXZ: [centerX, centerZ],
      originExclusionRadius: originBypassRad
    })
    : emptySol;

  const roomId = `ROOM_${defaultFloor}01`;
  const roomNodeId = `NODE_${roomId}`;
  const stairTopId = `NODE_STAIR_${defaultFloor}F_SE`;
  const stairBotId = 'NODE_STAIR_1F_SE';
  const exitNodeId = 'NODE_EXIT_1F_SE';
  const outdoorEgressId = `${buildingId}_OUTDOOR_EGRESS`;
  const targetNodeId = shortestSol.targetNodeId || stepFreeSol.targetNodeId || 'OSM_TARGET_INGRESS';

  const nodesMap = new Map();
  nodesMap.set(outdoorEgressId, { id: outdoorEgressId, name: `${name} 외곽 출구 접속점`, localPos: Object.freeze([footwayXZ[0], footwayY, footwayXZ[1]]) });
  if (hasValidShelter && shelterXZ) {
    nodesMap.set(targetNodeId, { id: targetNodeId, name: shelter?.officialName || shelter?.name || '대피 후보 지점', localPos: Object.freeze([shelterXZ[0], shelterY, shelterXZ[1]]) });
  }

  const edges = [];
  const ingest = (sol, tag) => {
    if (!sol || !sol.found || sol.edges.length === 0) return;
    sol.edges.forEach((e, idx) => {
      const src = idx === 0 ? outdoorEgressId : `${buildingId}_${tag}_${idx}`;
      const dst = idx === sol.edges.length - 1 ? targetNodeId : `${buildingId}_${tag}_${idx + 1}`;
      if (!nodesMap.has(src) && e.waypoints?.[0]) nodesMap.set(src, { id: src, name: `${tag}_${idx}`, localPos: Object.freeze([...e.waypoints[0]]) });
      if (!nodesMap.has(dst) && e.waypoints?.[e.waypoints.length - 1]) nodesMap.set(dst, { id: dst, name: `${tag}_${idx + 1}`, localPos: Object.freeze([...e.waypoints[e.waypoints.length - 1]]) });
      edges.push({
        edgeId: `${src}->${dst}`,
        source: src,
        target: dst,
        distance: e.distance,
        hasStairs: !!e.hasStairs,
        isWheelchairPassable: !e.hasStairs,
        highway: e.highway || 'footway',
        hazardRisk: e.hazardRisk || (e.hasStairs ? 'HIGH' : 'LOW'),
        branch: tag === 'S' ? 'SHORTEST' : tag === 'A' ? 'ALTERNATIVE' : 'STEP_FREE',
        waypoints: Object.freeze((e.waypoints || []).map(wp => Object.freeze([...wp])))
      });
    });
  };
  ingest(shortestSol, 'S');
  ingest(stepFreeSol, 'F');
  if (altSol.found && altSol.totalDistanceMeters !== shortestSol.totalDistanceMeters) {
    ingest(altSol, 'A');
  }

  const hwHalf = Math.max(8.0, Math.min(width_m, depth_m) * 0.35);
  return Object.freeze({
    packageId: `FACILITY_${buildingId}`,
    hasIndoorData,
    indoorScope,
    dynamicOriginMeta: Object.freeze({ id: buildingId, name, east_m, north_m, height_m }),
    anchor: Object.freeze({ lat: anchor.lat, lon: anchor.lon, h: anchor.h ?? 42.0 }),
    buildingMetadata: Object.freeze({
      id: buildingId,
      name,
      unitNumber: unitNumber || '',
      structureType: hasIndoorData ? '잠정 실내 공간 포함 건축물' : `외곽 3D 모델 (${indoorScope} · 실내 도면 미확보)`,
      levels: Object.freeze({ aboveGround: totalLevels, underground: 0 }),
      anchorCoordinates: Object.freeze({ lat: anchor.lat, lon: anchor.lon, ellipsoidalHeightMeters: anchor.h ?? 42.0 }),
      provenance: 'PARTIALLY_VERIFIED'
    }),
    groundElevationY: groundY,
    footprintMeters: Object.freeze(footprint),
    floorHeightMeters,
    totalLevels,
    defaultFloor: hasIndoorData ? defaultFloor : null,
    defaultRoomId: hasIndoorData ? roomId : null,
    defaultRoomNodeId: hasIndoorData ? roomNodeId : outdoorEgressId,
    defaultExitNodeId: hasIndoorData ? exitNodeId : outdoorEgressId,
    defaultOutdoorEgressNodeId: outdoorEgressId,
    defaultOutdoorTargetNodeId: hasValidShelter ? targetNodeId : null,
    indoorGraphs: hasIndoorData ? Object.freeze({
      [defaultFloor]: Object.freeze({
        floorId: `FLOOR_${defaultFloor}F`,
        levelIndex: defaultFloor,
        elevationOffsetMeters: targetY,
        provenance: 'PROVISIONAL',
        rooms: Object.freeze([{ roomId, name: `${defaultFloor}층 실내 공간 (잠정)`, type: 'ROOM', centerLocalPos: Object.freeze([centerX, targetY, centerZ]), nodeId: roomNodeId, provenance: 'PROVISIONAL' }]),
        stairwells: Object.freeze([{ stairwellId: `STAIR_${defaultFloor}F`, name: '주 피난계단 (PROVISIONAL)', landingNodeId: stairTopId, localPos: Object.freeze([doorXZ[0] - (vecOutX / normOut) * 2.5, targetY, doorXZ[1] - (vecOutZ / normOut) * 2.5]), provenance: 'PROVISIONAL' }])
      }),
      1: Object.freeze({
        floorId: 'FLOOR_1F',
        levelIndex: 1,
        elevationOffsetMeters: groundY,
        provenance: 'PROVISIONAL',
        stairwells: Object.freeze([{ stairwellId: 'STAIR_1F', landingNodeId: stairBotId, localPos: Object.freeze([doorXZ[0] - (vecOutX / normOut) * 2.5, groundY, doorXZ[1] - (vecOutZ / normOut) * 2.5]), provenance: 'PROVISIONAL' }]),
        exits: Object.freeze([{ exitId: 'EXIT_1F', name: '1층 출구 (잠정)', portalNodeId: exitNodeId, localPos: Object.freeze([doorXZ[0], groundY, doorXZ[1]]), provenance: 'PROVISIONAL' }])
      })
    }) : Object.freeze({}),
    indoorEdges: hasIndoorData ? Object.freeze([
      { source: roomNodeId, target: stairTopId, distance: Number(hwHalf.toFixed(1)), hasStairs: false, isWheelchairPassable: true, edgeType: 'CORRIDOR_PROVISIONAL' },
      { source: stairTopId, target: stairBotId, distance: Number(((defaultFloor - 1) * 8.4).toFixed(1)), hasStairs: true, isWheelchairPassable: false, edgeType: 'VERTICAL_STAIR_DESCENT' },
      { source: stairBotId, target: exitNodeId, distance: 4.5, hasStairs: false, isWheelchairPassable: true, edgeType: 'CORRIDOR_TO_EXIT' }
    ]) : Object.freeze([]),
    connector: Object.freeze({
      connectorId: `CONN_${buildingId}`,
      source: hasIndoorData ? exitNodeId : outdoorEgressId,
      target: outdoorEgressId,
      distance: 4.0,
      hasStairs: false,
      isWheelchairPassable: false,
      doorPos: Object.freeze([doorXZ[0], groundY, doorXZ[1]]),
      footwayPos: Object.freeze([footwayXZ[0], footwayY, footwayXZ[1]]),
      stairCoreCorner: Object.freeze([doorXZ[0] - 2.0, doorXZ[1] - 2.0]),
      stairCoreSize: Object.freeze({ width: 4.0, depth: 5.0 })
    }),
    outdoorGraph: Object.freeze({
      egressNodeId: outdoorEgressId,
      targetNodeId: hasValidShelter ? targetNodeId : null,
      nodes: Object.freeze([...nodesMap.values()]),
      edges: Object.freeze(edges)
    }),
    shelter: hasValidShelter ? Object.freeze({
      shelterId: targetShelterId,
      officialId: shelter?.officialId || shelter?.id || 'CONDITIONAL_SHELTER',
      officialCode: shelter?.officialCode || shelter?.id || 'CONDITIONAL_SHELTER',
      officialName: shelter?.officialName || shelter?.name || '확인 대피 후보',
      candidateStatus: shelter?.candidateStatus || 'CONDITIONAL',
      ingressDistanceMeters: shelter?.ingressDistanceMeters ?? 15.0,
      localCenter: Object.freeze([shelterXZ[0], shelterY, shelterXZ[1]]),
      trackRadiusX: shelter?.trackRadiusX ?? 34.0,
      trackRadiusZ: shelter?.trackRadiusZ ?? 52.0,
      pitchHalfWidth: shelter?.pitchHalfWidth ?? 18.0,
      pitchHalfLength: shelter?.pitchHalfLength ?? 30.0,
      geometry: shelter?.geometry || Object.freeze({
        areaSqMeters: shelter?.justification?.areaSqMeters || null,
        capacityPeople: shelter?.justification?.capacityEstimate || null
      })
    }) : null,
    routeBaselines: Object.freeze({
      PATH_SHORTEST_RAPID: Object.freeze({ name: `${name} 보행 경로`, targetLengthMeters: shortestSol.found ? shortestSol.totalDistanceMeters : 0, hasStairs: shortestSol.hasStairs, isWheelchairPassable: !shortestSol.hasStairs, provenance: 'PROVISIONAL' }),
      PATH_STEP_FREE_DETOUR: Object.freeze({ name: `${name} 계단 회피 경로`, targetLengthMeters: stepFreeSol.found ? stepFreeSol.totalDistanceMeters : 0, hasStairs: false, isWheelchairPassable: true, provenance: 'PROVISIONAL' }),
      PATH_ALTERNATIVE: Object.freeze({ name: `${name} 대체 보행 경로`, targetLengthMeters: altSol.found ? altSol.totalDistanceMeters : 0, hasStairs: altSol.hasStairs, isWheelchairPassable: !altSol.hasStairs, provenance: 'PROVISIONAL' })
    }),
    routeDisplayNames: Object.freeze({
      shortestLineName: `Path_Shortest_${buildingId}`,
      stepFreeLineName: `Path_StepFree_${buildingId}`,
      stairHazardsName: `Stairs_Hazard_${buildingId}`,
      connectorLineName: `Connector_${buildingId}`,
      shelterTrackName: 'Stadium_Track_Outline',
      shelterPitchName: 'Stadium_Pitch_Safe_Zone',
      interiorGroupName: `Interior_${defaultFloor}F_Provisional`
    }),
    cameraViewpoints: Object.freeze({
      REGIONAL_APPROACH: Object.freeze({ position: Object.freeze([-320, 480, 760]), target: Object.freeze([centerX, groundY, centerZ]), near: 0.5, far: 6500 }),
      CAMPUS_OVERVIEW: Object.freeze({
        position: Object.freeze([
          (centerX + (shelterXZ ? shelterXZ[0] : centerX)) * 0.5 + 240,
          320,
          (centerZ + (shelterXZ ? shelterXZ[1] : centerZ)) * 0.5 - 220
        ]),
        target: Object.freeze([
          (centerX + (shelterXZ ? shelterXZ[0] : centerX)) * 0.5,
          (groundY + (shelter?.localCenter?.[1] ?? -13.5)) * 0.5,
          (centerZ + (shelterXZ ? shelterXZ[1] : centerZ)) * 0.5
        ]),
        near: 0.25,
        far: 6500
      }),
      BUILDING_INSPECTION: Object.freeze({ position: Object.freeze([centerX + 85, groundY + 68, centerZ + 65]), target: Object.freeze([centerX, targetY, centerZ]), near: 0.1, far: 1500 }),
      PERSONAL_LOCATION: Object.freeze({ position: Object.freeze([doorXZ[0] + 28, targetY + 20, doorXZ[1] + 24]), target: Object.freeze([centerX, targetY, centerZ]), near: 0.05, far: 1200 })
    })
  });
}
