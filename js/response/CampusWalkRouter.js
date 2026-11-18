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
const WATER_POLY_BBOX_CACHE = new WeakMap();
const WATERWAY_BBOX_CACHE = new WeakMap();
const SOLVE_RESULT_CACHE = new Map();
const SOLVE_OBJ_IDS = new WeakMap();
let _nextSolveObjId = 1;
const getSolveObjId = (obj) => {
  if (!obj || (typeof obj !== 'object' && typeof obj !== 'function')) return String(obj ?? 'null');
  let id = SOLVE_OBJ_IDS.get(obj);
  if (!id) {
    id = String(_nextSolveObjId++);
    SOLVE_OBJ_IDS.set(obj, id);
  }
  return id;
};

function getWaterPolygonBBoxes(waterPolygons) {
  if (!Array.isArray(waterPolygons) || waterPolygons.length === 0) return [];
  if (WATER_POLY_BBOX_CACHE.has(waterPolygons)) return WATER_POLY_BBOX_CACHE.get(waterPolygons);
  const out = [];
  for (let i = 0; i < waterPolygons.length; i++) {
    const item = waterPolygons[i];
    const poly = item?.outer || item;
    if (!Array.isArray(poly) || poly.length < 3) continue;
    let minE = Infinity, maxE = -Infinity, minN = Infinity, maxN = -Infinity;
    for (let k = 0; k < poly.length; k++) {
      const e = poly[k][0], n = poly[k][1];
      if (e < minE) minE = e;
      if (e > maxE) maxE = e;
      if (n < minN) minN = n;
      if (n > maxN) maxN = n;
    }
    out.push({ poly, minE, maxE, minN, maxN });
  }
  WATER_POLY_BBOX_CACHE.set(waterPolygons, out);
  return out;
}

function getWaterwayBBoxes(waterways) {
  if (!Array.isArray(waterways) || waterways.length === 0) return [];
  if (WATERWAY_BBOX_CACHE.has(waterways)) return WATERWAY_BBOX_CACHE.get(waterways);
  const out = [];
  for (let i = 0; i < waterways.length; i++) {
    const w = waterways[i];
    const halfW = (w?.widthMeters || 14) * 0.45;
    if (halfW < 8 || !Array.isArray(w.pointsEN) || w.pointsEN.length < 2) continue;
    let minE = Infinity, maxE = -Infinity, minN = Infinity, maxN = -Infinity;
    for (let k = 0; k < w.pointsEN.length; k++) {
      const e = w.pointsEN[k][0], n = w.pointsEN[k][1];
      if (e < minE) minE = e;
      if (e > maxE) maxE = e;
      if (n < minN) minN = n;
      if (n > maxN) maxN = n;
    }
    out.push({ pointsEN: w.pointsEN, halfW, minE: minE - halfW, maxE: maxE + halfW, minN: minN - halfW, maxN: maxN + halfW });
  }
  WATERWAY_BBOX_CACHE.set(waterways, out);
  return out;
}

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

export function isSegmentClearOfBuildingOBBs(aXZ, bXZ, obbSource, marginMeters = 0.05) {
  const spatial = (obbSource && obbSource.cells && Array.isArray(obbSource.all))
    ? obbSource
    : getSpatialOBBIndex(obbSource);
  return isSegmentClearSpatial(aXZ, bXZ, spatial, marginMeters);
}

function isSegmentClearSpatial(aXZ, bXZ, spatialIndex, marginMeters = 0.05, excludeCentroidXZ = null, excludeRad2 = 0, excludeGoalXZ = null) {
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
  const checkSpan = Math.max(70, clearanceMeters + 60);
  const near = querySpatialOBBsInBounds(
    spatialIndex,
    ptXZ[0] - checkSpan, ptXZ[1] - checkSpan, ptXZ[0] + checkSpan, ptXZ[1] + checkSpan,
    excludeCentroidXZ, excludeRad2, excludeGoalXZ
  );
  if (near.length === 0 || !isPointInsideAnyOBB(ptXZ, near, Math.min(0.45, clearanceMeters * 0.35))) {
    return ptXZ;
  }

  const cands = [];
  // 1. Direct projection onto the 4 expanded faces & 4 corners of any containing OBB (handles arbitrary building sizes)
  for (let i = 0; i < near.length; i++) {
    const ob = near[i];
    if (!doesSegmentIntersectOBBXZ(ptXZ, ptXZ, ob, Math.min(0.6, clearanceMeters))) continue;
    const cx = ob.east_m;
    const cz = -ob.north_m;
    const hw = ob.width_m * 0.5 + clearanceMeters + 0.35;
    const hd = ob.depth_m * 0.5 + clearanceMeters + 0.35;
    const ca = ob.cosYaw ?? Math.cos(ob.yaw_rad);
    const sa = ob.sinYaw ?? Math.sin(ob.yaw_rad);
    const de = ptXZ[0] - cx;
    const dn = -(ptXZ[1] - cz);
    const lx = ca * de + sa * dn;
    const lz = sa * de - ca * dn;
    const clampX = Math.max(-hw, Math.min(hw, lx));
    const clampZ = Math.max(-hd, Math.min(hd, lz));
    const localPts = [
      [-hw, clampZ], [hw, clampZ], [clampX, -hd], [clampX, hd],
      [-hw, -hd], [hw, -hd], [hw, hd], [-hw, hd]
    ];
    for (let k = 0; k < localPts.length; k++) {
      const wx = localPts[k][0];
      const wz = localPts[k][1];
      const px = cx + ca * wx + sa * wz;
      const pz = cz - sa * wx + ca * wz;
      cands.push({ pt: [px, pz], d: Math.hypot(px - ptXZ[0], pz - ptXZ[1]) });
    }
  }

  // 2. Radial sweep backup around adjacent multi-building courtyards
  const radii = [2.5, 5.5, 9.5, 15.0, 22.0, 31.0, 42.0, 56.0];
  for (const r of radii) {
    for (let s = 0; s < 20; s++) {
      const ang = (s / 20) * Math.PI * 2;
      const px = ptXZ[0] + Math.cos(ang) * r;
      const pz = ptXZ[1] + Math.sin(ang) * r;
      cands.push({ pt: [px, pz], d: r });
    }
  }

  cands.sort((a, b) => a.d - b.d);
  const strictMargin = Math.min(0.4, clearanceMeters * 0.3);
  for (let i = 0; i < cands.length; i++) {
    if (!isPointInsideAnyOBB(cands[i].pt, near, strictMargin)) {
      return cands[i].pt;
    }
  }
  for (let i = 0; i < cands.length; i++) {
    if (!isPointInsideAnyOBB(cands[i].pt, near, 0.03)) {
      return cands[i].pt;
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
    path: 1.04,
    cycleway: 1.04,
    service: 1.06,
    residential: 1.04,
    secondary: 1.05,
    primary: 1.08,
    crossing: 1.02
  }),
  uphillGainPerMeter: 0.35,
  steepRampAccessibleSlopeThreshold: 0.14,
  steepRampAccessiblePenalty: 1.35,
  stairCautionGain: 0.18,
  // Urban-seismic engineering corridor parameters (Hirokawa & Osaragi / ATC-138 facade debris envelope)
  debrisFallRatioOfHeight: 0.45,
  debrisRiskMultiplierGain: 0.90,
  bilateralCanyonGain: 1.15,
  narrowCorridorThresholdM: 6.5,
  narrowCorridorMaxGain: 0.35,
  bridgeInspectionMultiplier: 1.45,
  bridgeFixedInspectionMeters: 160.0,
  alternativeEdgePenalty: 2.6,
  maxStartSnapMeters: 260,
  maxGoalSnapMeters: 260
});

const GRAPH_OBB_RISK_CACHE = new WeakMap();

/**
 * Compute smooth shaking intensity weighting gamma from estimated MMI (when available).
 * Never fabricates MMI when unknown; null defaults cleanly to baseline 1.0.
 */
export function computeShakingIntensityFactor(shakingMmi = null) {
  if (!Number.isFinite(Number(shakingMmi))) return 1.0;
  const mmi = Number(shakingMmi);
  return Number(Math.max(0.75, Math.min(1.80, 0.75 + Math.max(0, mmi - 5.0) * 0.22)).toFixed(3));
}

function estimateDefaultHighwayWidthMeters(hw = 'footway') {
  switch (String(hw || 'footway')) {
    case 'primary':
    case 'trunk':
      return 22.0;
    case 'secondary':
      return 16.0;
    case 'tertiary':
      return 12.0;
    case 'residential':
      return 8.0;
    case 'pedestrian':
      return 9.0;
    case 'living_street':
    case 'service':
      return 5.5;
    case 'steps':
      return 3.2;
    default:
      return 4.2;
  }
}

/**
 * Compute perpendicular signed clearance from segment AB midpoint/quarters to nearby OBBs,
 * yielding asymmetric left/right facade falling-debris hazard, bilateral canyon blockage,
 * and effective street clear width.
 */
function computeSegmentSeismicProfile(uXZ, vXZ, spatialOBBs, hw, isBridge, explicitWidthM = null, baseEdgeDebris = 0) {
  const dx = vXZ[0] - uXZ[0];
  const dz = vXZ[1] - uXZ[1];
  const segLen = Math.hypot(dx, dz);
  const defaultWidth = Number.isFinite(explicitWidthM) && explicitWidthM > 0
    ? explicitWidthM
    : estimateDefaultHighwayWidthMeters(hw);

  if (!spatialOBBs || spatialOBBs.all.length === 0 || segLen < 0.2) {
    const fallbackDebris = Math.max(baseEdgeDebris || 0, isBridge ? 0.25 : 0.05);
    return {
      debrisRisk: fallbackDebris,
      canyonRisk: 0,
      corridorWidthM: defaultWidth,
      tallestAdjacentH: 0
    };
  }

  const ux = dx / segLen;
  const uz = dz / segLen;
  // Unit normal pointing left of u->v
  const nx = -uz;
  const nz = ux;
  const midX = (uXZ[0] + vXZ[0]) * 0.5;
  const midZ = (uXZ[1] + vXZ[1]) * 0.5;
  const searchPad = Math.max(36.0, segLen * 0.5 + 24.0);
  const candidates = querySpatialOBBsInBounds(
    spatialOBBs,
    midX - searchPad, midZ - searchPad, midX + searchPad, midZ + searchPad,
    null, 0, null
  );

  let leftThreat = 0;
  let rightThreat = 0;
  let minLeftClear = 18.0;
  let minRightClear = 18.0;
  let tallestH = 0;

  for (let i = 0; i < candidates.length; i++) {
    const ob = candidates[i];
    const ocx = ob.east_m;
    const ocz = -ob.north_m;
    const relX = ocx - midX;
    const relZ = ocz - midZ;
    const along = relX * ux + relZ * uz;
    if (Math.abs(along) > segLen * 0.55 + ob.boundR + 4.0) continue;

    // Oriented bounding projection onto street normal direction
    const cosY = Math.cos(ob.yaw_rad || 0);
    const sinY = Math.sin(ob.yaw_rad || 0);
    const hx = (ob.width_m || 10) * 0.5;
    const hz = (ob.depth_m || 10) * 0.5;
    // Project local axes onto street normal (nx, nz): Three.js yaw rotation aligns local X with (cosY, -sinY), Z with (sinY, cosY)
    const projExtent = Math.abs(nx * cosY - nz * sinY) * hx + Math.abs(nx * sinY + nz * cosY) * hz;
    const signedCenterLat = relX * nx + relZ * nz;
    const perpClearance = Math.max(0.4, Math.abs(signedCenterLat) - projExtent);
    if (perpClearance > 34.0) continue;

    const h = Math.max(4.0, Number(ob.height_m) || 8.5);
    if (h > tallestH) tallestH = h;
    const fallReach = Math.max(4.5, Math.min(28.0, h * WALK_ROUTING_WEIGHTS.debrisFallRatioOfHeight));
    const threat = Math.max(0, 1.0 - perpClearance / fallReach);

    if (signedCenterLat >= 0) {
      if (threat > leftThreat) leftThreat = threat;
      if (perpClearance < minLeftClear) minLeftClear = perpClearance;
    } else {
      if (threat > rightThreat) rightThreat = threat;
      if (perpClearance < minRightClear) minRightClear = perpClearance;
    }
  }

  const maxSideThreat = Math.max(leftThreat, rightThreat);
  const canyonRisk = (leftThreat > 0.12 && rightThreat > 0.12)
    ? Math.min(1.0, Math.sqrt(leftThreat * rightThreat) * 1.5)
    : 0;
  const geomWidth = Math.max(2.2, Math.min(30.0, minLeftClear + minRightClear));
  const corridorWidthM = Number.isFinite(explicitWidthM) && explicitWidthM > 0
    ? Math.min(geomWidth, explicitWidthM)
    : Math.min(defaultWidth * 1.35, geomWidth);

  return {
    debrisRisk: Number(Math.max(isBridge ? 0.25 : 0.0, maxSideThreat, (baseEdgeDebris || 0) * 0.35).toFixed(3)),
    canyonRisk: Number(canyonRisk.toFixed(3)),
    corridorWidthM: Number(corridorWidthM.toFixed(1)),
    tallestAdjacentH: Number(tallestH.toFixed(1))
  };
}

/**
 * Enrich compiled adjacency edges with genuine geometric Urban-Seismic risk attributes
 * (cached per walkGraph x OBB spatial index).
 */
export function enrichWalkGraphWithSeismicRisk(walkGraph, buildingOBBs) {
  const source = walkGraph || HANYANG_CAMPUS_WALK_GRAPH;
  const compiled = getOrCompileWalkAdjacency(source);
  const spatialOBBs = getSpatialOBBIndex(buildingOBBs);
  const cacheKeyObj = spatialOBBs || compiled;
  let perGraphCache = GRAPH_OBB_RISK_CACHE.get(compiled);
  if (perGraphCache && perGraphCache.has(cacheKeyObj)) {
    return perGraphCache.get(cacheKeyObj);
  }
  if (!perGraphCache) {
    perGraphCache = new WeakMap();
    GRAPH_OBB_RISK_CACHE.set(compiled, perGraphCache);
  }

  const { nodes, adj } = compiled;
  const explicitWidths = source.edgeWidths || null;
  const edgeMetricsByKey = new Map();

  for (let u = 0; u < adj.length; u++) {
    const nu = nodes[u];
    if (!nu) continue;
    const uXZ = [nu[1], -nu[2]];
    const list = adj[u];
    for (let i = 0; i < list.length; i++) {
      const e = list[i];
      if (edgeMetricsByKey.has(e.edgeKey)) continue;
      const nv = nodes[e.to];
      if (!nv) continue;
      const vXZ = [nv[1], -nv[2]];
      const prof = computeSegmentSeismicProfile(
        uXZ, vXZ, spatialOBBs, e.hw, e.isBridge,
        explicitWidths?.[e.edgeIdx] ?? null, e.debrisRisk
      );
      edgeMetricsByKey.set(e.edgeKey, prof);
      const revKey = `${nv[0]}->${nu[0]}`;
      edgeMetricsByKey.set(revKey, prof);
    }
  }

  perGraphCache.set(cacheKeyObj, edgeMetricsByKey);
  return edgeMetricsByKey;
}

export function getOrCompileWalkAdjacency(walkGraph) {
  const source = walkGraph || HANYANG_CAMPUS_WALK_GRAPH;
  if (GRAPH_ADJ_CACHE.has(source)) {
    return GRAPH_ADJ_CACHE.get(source);
  }
  const nodes = source.nodes || [];
  const edges = source.edges || [];
  const adj = Array.from({ length: nodes.length }, () => []);
  for (let idx = 0; idx < edges.length; idx++) {
    const [u, v, dist, hw, hasStairs, debrisRisk, isBridge, isCrossing, trustedStreet] = edges[idx];
    const nu = nodes[u];
    const nv = nodes[v];
    if (!nu || !nv) continue;
    const dy = (nv[3] ?? 0) - (nu[3] ?? 0);
    const bridgeFlag = Boolean(isBridge || hw === 'bridge');
    const crossFlag = Boolean(isCrossing || hw === 'crossing');
    adj[u].push({ to: v, edgeIdx: idx, dist, dy, hw, hasStairs: !!hasStairs, isBridge: bridgeFlag, isCrossing: crossFlag, debrisRisk: debrisRisk ?? 0, trustedStreet: !!trustedStreet, edgeKey: `${nu[0]}->${nv[0]}` });
    adj[v].push({ to: u, edgeIdx: idx, dist, dy: -dy, hw, hasStairs: !!hasStairs, isBridge: bridgeFlag, isCrossing: crossFlag, debrisRisk: debrisRisk ?? 0, trustedStreet: !!trustedStreet, edgeKey: `${nv[0]}->${nu[0]}` });
  }
  const compOfNode = new Int32Array(nodes.length).fill(-1);
  const compSize = [];
  for (let i = 0; i < nodes.length; i++) {
    if (compOfNode[i] !== -1) continue;
    const cid = compSize.length;
    const q = [i];
    compOfNode[i] = cid;
    for (let h = 0; h < q.length; h++) {
      const neighbors = adj[q[h]];
      for (let k = 0; k < neighbors.length; k++) {
        const nb = neighbors[k].to;
        if (compOfNode[nb] === -1) {
          compOfNode[nb] = cid;
          q.push(nb);
        }
      }
    }
    compSize.push(q.length);
  }
  const compiled = { nodes, edges, adj, compOfNode, compSize };
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
    const boundR = Math.hypot(width_m, depth_m) * 0.5;
    const yaw = yaw_rad || 0;
    list.push({
      east_m,
      north_m,
      width_m,
      depth_m,
      yaw_rad: yaw,
      height_m,
      boundR,
      cosYaw: Math.cos(yaw),
      sinYaw: Math.sin(yaw),
      minX: east_m - boundR,
      maxX: east_m + boundR,
      minZ: -north_m - boundR,
      maxZ: -north_m + boundR
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
  const m = marginMeters > 0 ? marginMeters : 0;
  if (obb.minX !== undefined) {
    if (Math.max(aXZ[0], bXZ[0]) < obb.minX - m || Math.min(aXZ[0], bXZ[0]) > obb.maxX + m ||
        Math.max(aXZ[1], bXZ[1]) < obb.minZ - m || Math.min(aXZ[1], bXZ[1]) > obb.maxZ + m) {
      return false;
    }
  }
  const cx = obb.east_m;
  const cz = -obb.north_m;
  const hw = obb.width_m * 0.5 + marginMeters;
  const hd = obb.depth_m * 0.5 + marginMeters;
  if (hw <= 0 || hd <= 0) return false;

  if (obb.minX === undefined) {
    const rad = (obb.boundR ?? Math.hypot(obb.width_m, obb.depth_m) * 0.5) + marginMeters;
    if (Math.max(aXZ[0], bXZ[0]) < cx - rad || Math.min(aXZ[0], bXZ[0]) > cx + rad) return false;
    if (Math.max(aXZ[1], bXZ[1]) < cz - rad || Math.min(aXZ[1], bXZ[1]) > cz + rad) return false;
  }

  // Map segment endpoints into OBB local (de, dn) space where local coords match Three.js R_y(-yaw)
  const ca = obb.cosYaw ?? Math.cos(obb.yaw_rad);
  const sa = obb.sinYaw ?? Math.sin(obb.yaw_rad);
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
function isSegmentClearOfWaterBoxes(aXZ, bXZ, waterBoxes, waterwayBoxes) {
  if (waterBoxes.length === 0 && waterwayBoxes.length === 0) return true;
  const segMinE = Math.min(aXZ[0], bXZ[0]);
  const segMaxE = Math.max(aXZ[0], bXZ[0]);
  const segMinN = Math.min(-aXZ[1], -bXZ[1]);
  const segMaxN = Math.max(-aXZ[1], -bXZ[1]);

  let candPolys = null;
  if (waterBoxes.length > 0) {
    for (let i = 0; i < waterBoxes.length; i++) {
      const b = waterBoxes[i];
      if (segMaxE < b.minE || segMinE > b.maxE || segMaxN < b.minN || segMinN > b.maxN) continue;
      if (!candPolys) candPolys = [];
      candPolys.push(b);
    }
  }
  let candWays = null;
  if (waterwayBoxes.length > 0) {
    for (let i = 0; i < waterwayBoxes.length; i++) {
      const w = waterwayBoxes[i];
      if (segMaxE < w.minE || segMinE > w.maxE || segMaxN < w.minN || segMinN > w.maxN) continue;
      if (!candWays) candWays = [];
      candWays.push(w);
    }
  }
  if (!candPolys && !candWays) return true;

  const samples = 5;
  for (let s = 0; s <= samples; s++) {
    const t = s / samples;
    const px = aXZ[0] + (bXZ[0] - aXZ[0]) * t;
    const pz = aXZ[1] + (bXZ[1] - aXZ[1]) * t;
    const pn = -pz;
    if (candPolys) {
      for (let i = 0; i < candPolys.length; i++) {
        const b = candPolys[i];
        if (px < b.minE || px > b.maxE || pn < b.minN || pn > b.maxN) continue;
        if (pointInPoly2D(px, pn, b.poly)) return false;
      }
    }
    // Also reject unbridged crossing over wide waterway ribbons (>18m)
    if (candWays && s > 0 && s < samples) {
      for (let wi = 0; wi < candWays.length; wi++) {
        const w = candWays[wi];
        const halfW = w.halfW;
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

export function isSegmentClearOfWaterXZ(aXZ, bXZ, waterPolygons = [], waterways = []) {
  const waterBoxes = getWaterPolygonBBoxes(waterPolygons);
  const waterwayBoxes = getWaterwayBBoxes(waterways);
  return isSegmentClearOfWaterBoxes(aXZ, bXZ, waterBoxes, waterwayBoxes);
}

export function findVisibilityDetourXZ(startXZ, goalXZ, obstaclesOBB = [], marginMeters = 1.35, waterPolygons = [], waterways = []) {
  const spatial = (obstaclesOBB && obstaclesOBB.cells && Array.isArray(obstaclesOBB.all))
    ? obstaclesOBB
    : getSpatialOBBIndex(obstaclesOBB);
  const hasObs = Boolean(spatial && spatial.all && spatial.all.length > 0);
  const waterBoxes = getWaterPolygonBBoxes(waterPolygons);
  const waterwayBoxes = getWaterwayBBoxes(waterways);
  const isClear = (a, b) =>
    (!hasObs || isSegmentClearSpatial(a, b, spatial, 0.04)) &&
    (waterBoxes.length === 0 && waterwayBoxes.length === 0 ? true : isSegmentClearOfWaterBoxes(a, b, waterBoxes, waterwayBoxes));

  if (!hasObs && waterBoxes.length === 0 && waterwayBoxes.length === 0) {
    return [startXZ, goalXZ];
  }
  if (isClear(startXZ, goalXZ)) {
    return [startXZ, goalXZ];
  }

  // Collect blocking OBBs via Spatial Grid Index along corridor envelope (+170m buffer)
  const minX = Math.min(startXZ[0], goalXZ[0]) - 170;
  const maxX = Math.max(startXZ[0], goalXZ[0]) + 170;
  const minZ = Math.min(startXZ[1], goalXZ[1]) - 170;
  const maxZ = Math.max(startXZ[1], goalXZ[1]) + 170;

  const localWaterBoxes = waterBoxes.filter(b => !(maxX < b.minE || minX > b.maxE || -minZ < b.minN || -maxZ > b.maxN));
  const localWaterwayBoxes = waterwayBoxes.filter(w => !(maxX < w.minE || minX > w.maxE || -minZ < w.minN || -maxZ > w.maxN));

  const localOBBs = querySpatialOBBsInBounds(spatial, minX, minZ, maxX, maxZ);
  if (hasObs && (isPointInsideAnyOBB(startXZ, localOBBs, 0.01) || isPointInsideAnyOBB(goalXZ, localOBBs, 0.01))) {
    return null;
  }

  const directHitOBBs = [];
  const nearCorridorOBBs = [];
  const midX = (startXZ[0] + goalXZ[0]) * 0.5;
  const midZ = (startXZ[1] + goalXZ[1]) * 0.5;
  for (let i = 0; i < localOBBs.length; i++) {
    const ob = localOBBs[i];
    if (doesSegmentIntersectOBBXZ(startXZ, goalXZ, ob, 55.0)) {
      directHitOBBs.push(ob);
    } else if (doesSegmentIntersectOBBXZ(startXZ, goalXZ, ob, 125.0)) {
      nearCorridorOBBs.push(ob);
    }
  }
  const byMidDist = (a, b) =>
    Math.hypot(a.east_m - midX, -a.north_m - midZ) -
    Math.hypot(b.east_m - midX, -b.north_m - midZ);
  directHitOBBs.sort(byMidDist);
  nearCorridorOBBs.sort(byMidDist);
  const candidateOBBs = [...directHitOBBs, ...nearCorridorOBBs];

  const vertices = [startXZ];
  const pushVertexIfClear = (c) => {
    if (isPointInsideAnyOBB(c, localOBBs, 0.03)) return false;
    for (let k = 1; k < vertices.length; k++) {
      if (Math.hypot(vertices[k][0] - c[0], vertices[k][1] - c[1]) < 0.35) return false;
    }
    vertices.push(c);
    return true;
  };
  for (const ob of candidateOBBs) {
    const corners = getExpandedOBBCornersXZ(ob, marginMeters);
    let addedForOb = 0;
    for (const c of corners) {
      if (pushVertexIfClear(c)) {
        addedForOb++;
        if (vertices.length >= 120) break;
      }
    }
    // Adjacent L/U/courtyard wings can trap inner corners; probe wider exterior offset if fewer than 2 corners cleared
    if (addedForOb < 2 && vertices.length < 120) {
      for (const fallbackCorners of [getExpandedOBBCornersXZ(ob, marginMeters + 2.2), getExpandedOBBCornersXZ(ob, marginMeters + 4.8)]) {
        for (const c of fallbackCorners) {
          if (pushVertexIfClear(c) && vertices.length >= 120) break;
        }
        if (vertices.length >= 120) break;
      }
    }
    if (vertices.length >= 120) break;
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
      const stepD = Math.hypot(vertices[v][0] - vertices[u][0], vertices[v][1] - vertices[u][1]);
      const tentative = dist[u] + stepD;
      if (tentative >= dist[v]) continue;
      if (!isSegmentClearOfOBBs(vertices[u], vertices[v], localOBBs, 0.03)) continue;
      if ((localWaterBoxes.length > 0 || localWaterwayBoxes.length > 0) &&
        !isSegmentClearOfWaterBoxes(vertices[u], vertices[v], localWaterBoxes, localWaterwayBoxes)) continue;
      dist[v] = tentative;
      prev[v] = u;
      fScore[v] = tentative + heuristic(v);
      if (!open.includes(v)) open.push(v);
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

function tryVisibilityDetourXZ(startXZ, goalXZ, obbObstacleSource, waterPolygons = [], waterways = []) {
  const spatial = (obbObstacleSource && obbObstacleSource.cells && Array.isArray(obbObstacleSource.all))
    ? obbObstacleSource
    : getSpatialOBBIndex(obbObstacleSource);
  const margins = [1.65, 0.95, 0.35, 0.15];
  for (let i = 0; i < margins.length; i++) {
    const detour = findVisibilityDetourXZ(startXZ, goalXZ, spatial, margins[i], waterPolygons, waterways);
    if (detour) return detour;
  }
  // Never return a straight building-piercing line: only accept direct path if genuinely clear of OBBs & water
  const hasObs = Boolean(spatial && spatial.all && spatial.all.length > 0);
  if ((!hasObs || isSegmentClearSpatial(startXZ, goalXZ, spatial, 0.02)) &&
    isSegmentClearOfWaterXZ(startXZ, goalXZ, waterPolygons, waterways)) {
    return [startXZ, goalXZ];
  }
  return null;
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
function computeSegmentAStarMultiplier(edgeObj, prof, {
  seismicDebrisAware = true,
  shakingGamma = 1.0,
  excludeStairs = false,
  ignoreBridgePenalty = false
} = {}) {
  let mult = seismicDebrisAware ? getHighwayWalkMultiplier(edgeObj.hw) : 1.0;
  if (edgeObj.isBridge && !ignoreBridgePenalty) {
    mult *= WALK_ROUTING_WEIGHTS.bridgeInspectionMultiplier;
  }
  if (excludeStairs && edgeObj.dist > 1.0 && Math.abs(edgeObj.dy || 0) / edgeObj.dist > WALK_ROUTING_WEIGHTS.steepRampAccessibleSlopeThreshold) {
    mult *= WALK_ROUTING_WEIGHTS.steepRampAccessiblePenalty;
  }
  if (seismicDebrisAware) {
    if (edgeObj.hasStairs) mult += WALK_ROUTING_WEIGHTS.stairCautionGain;
    const effDebris = prof ? prof.debrisRisk : (edgeObj.debrisRisk || 0);
    const effCanyon = prof ? prof.canyonRisk : 0;
    const corrW = prof ? prof.corridorWidthM : estimateDefaultHighwayWidthMeters(edgeObj.hw);
    if (effDebris > 0) mult += effDebris * WALK_ROUTING_WEIGHTS.debrisRiskMultiplierGain * shakingGamma;
    if (effCanyon > 0) mult += effCanyon * WALK_ROUTING_WEIGHTS.bilateralCanyonGain * shakingGamma;
    if (corrW < WALK_ROUTING_WEIGHTS.narrowCorridorThresholdM) {
      const narrowFrac = (WALK_ROUTING_WEIGHTS.narrowCorridorThresholdM - corrW) / WALK_ROUTING_WEIGHTS.narrowCorridorThresholdM;
      mult += narrowFrac * WALK_ROUTING_WEIGHTS.narrowCorridorMaxGain;
    }
  }
  return mult;
}

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
    shakingMmi = null,
    ignoreBridgePenalty = false,
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
  const serializeAvoid = activeAvoid.length > 0 ? activeAvoid.map(p => `${p.id || ''}:${p.mode || ''}`).join('|') : '';
  const serializeBlocked = blockedEdges && blockedEdges.size > 0 ? [...blockedEdges].sort().join(',') : '';
  const serializePenalized = penalizeEdgeKeys && penalizeEdgeKeys.size > 0 ? [...penalizeEdgeKeys].sort().join(',') : '';
  const activeWalkSource = customWalkGraph || HANYANG_CAMPUS_WALK_GRAPH;
  const solveCacheKey = [
    getSolveObjId(activeWalkSource),
    getSolveObjId(buildingOBBs),
    getSolveObjId(waterPolygons),
    getSolveObjId(waterways),
    Math.round((startXZ[0] ?? 0) * 10), Math.round((startXZ[1] ?? 0) * 10),
    Math.round((goalXZ[0] ?? 0) * 10), Math.round((goalXZ[1] ?? 0) * 10),
    excludeStairs ? 1 : 0,
    seismicDebrisAware ? 1 : 0,
    shakingMmi ?? 'null',
    ignoreBridgePenalty ? 1 : 0,
    Math.round((originCentroidXZ?.[0] ?? 0) * 10), Math.round((originCentroidXZ?.[1] ?? 0) * 10),
    Math.round((originExclusionRadius || 0) * 10),
    overlapPenaltyMultiplier,
    maxStartSnapMeters,
    maxGoalSnapMeters,
    targetShelterId,
    serializeBlocked,
    serializeAvoid,
    serializePenalized
  ].join('|');

  if (SOLVE_RESULT_CACHE.has(solveCacheKey)) {
    const cached = SOLVE_RESULT_CACHE.get(solveCacheKey);
    SOLVE_RESULT_CACHE.delete(solveCacheKey);
    SOLVE_RESULT_CACHE.set(solveCacheKey, cached);
    return cached;
  }
  const cacheAndReturn = (res) => {
    if (SOLVE_RESULT_CACHE.size >= 64) {
      const oldestKey = SOLVE_RESULT_CACHE.keys().next().value;
      if (oldestKey !== undefined) SOLVE_RESULT_CACHE.delete(oldestKey);
    }
    SOLVE_RESULT_CACHE.set(solveCacheKey, res);
    return res;
  };

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

  const { nodes, edges, adj, compOfNode } = customWalkGraph ? getOrCompileWalkAdjacency(customWalkGraph) : CAMPUS_GRAPH_ADJ;
  if (nodes.length === 0) {
    return cacheAndReturn({ found: false, reason: 'NO_WALKABLE_NETWORK_NODES', totalDistanceMeters: 0, totalStairsDistanceMeters: 0, hasStairs: false, stairFlightCount: 0, isStepFree: false, edges: [], waypoints3D: [] });
  }

  const spatialOBBs = getSpatialOBBIndex(buildingOBBs);
  const hasSpatialOBBs = Boolean(spatialOBBs && spatialOBBs.all.length > 0);
  // Neighboring buildings must never be hidden behind an origin/goal radius exclusion;
  // instead push start and goal cleanly outside any containing OBB wall first.
  const excludeRad2 = 0;

  // Enrich walk edges once per (walkGraph x buildingOBBs) for genuine Urban-Seismic risk modeling
  const edgeSeismicMap = seismicDebrisAware ? enrichWalkGraphWithSeismicRisk(activeWalkSource, buildingOBBs) : null;
  const shakingGamma = computeShakingIntensityFactor(shakingMmi);

  // Push start and goal cleanly outside any containing OBB wall (never mask neighboring OBBs)
  const safeStartXZ = hasSpatialOBBs
    ? pushPointOutsideSpatialOBBs(startXZ, spatialOBBs, 1.5, null, 0, null)
    : startXZ;
  const safeGoalXZ = hasSpatialOBBs
    ? pushPointOutsideSpatialOBBs(goalXZ, spatialOBBs, 1.5, null, 0, null)
    : goalXZ;
  const isPointClearOfOBB = (ptXZ, marginMeters = 0.02) =>
    !hasSpatialOBBs || isSegmentClearSpatial(ptXZ, ptXZ, spatialOBBs, marginMeters);

  // Select candidate goal nodes AND orthogonal mid-edge projections (with wide fallback)
  const collectGoalCands = (snapLimit, candLimit = 20) => {
    const rawGoalNodeCands = nodes
      .map((nd, idx) => ({
        kind: 'node',
        idx,
        xz: [nd[1], -nd[2]],
        dist: Math.hypot(nd[1] - safeGoalXZ[0], -nd[2] - safeGoalXZ[1])
      }))
      .filter(c => c.dist <= snapLimit && isPointClearOfOBB(c.xz, 0.02))
      .sort((a, b) => a.dist - b.dist)
      .slice(0, candLimit);

    const goalEdgeProjs = findNearestEdgeProjectionsXZ(
      safeGoalXZ, nodes, edges, snapLimit, candLimit, excludeStairs, blockedEdges
    )
      .filter(p => isPointClearOfOBB(p.xz, 0.02))
      .map(p => ({ kind: 'edge', ...p }));

    return [...goalEdgeProjs, ...rawGoalNodeCands].sort((a, b) => a.dist - b.dist);
  };

  let goalCands = collectGoalCands(maxGoalSnapMeters);
  if (goalCands.length === 0) {
    goalCands = collectGoalCands(Math.max(520, maxGoalSnapMeters), 60);
  }
  if (goalCands.length === 0) {
    return cacheAndReturn({ found: false, reason: 'ORIGIN_OR_GOAL_OUT_OF_GRAPH_RANGE', totalDistanceMeters: 0, totalStairsDistanceMeters: 0, hasStairs: false, stairFlightCount: 0, isStepFree: false, edges: [], waypoints3D: [] });
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
  const goalCompIds = new Set();
  const registerGoalForNode = (nodeIdx, spec) => {
    const prev = validGoals.get(nodeIdx);
    if (!prev || spec.goalIngressLen < prev.goalIngressLen) {
      validGoals.set(nodeIdx, spec);
    }
    if (compOfNode && compOfNode[nodeIdx] >= 0) {
      goalCompIds.add(compOfNode[nodeIdx]);
    }
  };

  let validatedGoalEntries = 0;
  let minGoalSnapDist = Infinity;
  for (const gCand of goalCands) {
    // Prevent distant straight-line SHELTER_INGRESS portals from leaping past intermediate road network segments
    if (validatedGoalEntries >= 4 && gCand.dist > minGoalSnapDist + 18.0) break;
    if (validatedGoalEntries > 0 && gCand.dist > Math.max(45.0, minGoalSnapDist + 38.0)) break;
    const goalIngressChainXZ = tryVisibilityDetourXZ(gCand.xz, safeGoalXZ, spatialOBBs, waterPolygons, waterways);
    if (!goalIngressChainXZ) continue;
    const ingressLen = measureChainLen(goalIngressChainXZ);

    if (gCand.kind === 'node') {
      validatedGoalEntries++;
      minGoalSnapDist = Math.min(minGoalSnapDist, gCand.dist);
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
        if (hasSpatialOBBs && !isSegmentClearSpatial(endXZ, gCand.xz, spatialOBBs, 0.03)) {
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
        const gProf = edgeSeismicMap?.get(eo.keyUV);
        const gMult = computeSegmentAStarMultiplier(eo, gProf, { seismicDebrisAware, shakingGamma, excludeStairs, ignoreBridgePenalty });
        const gBridgeFix = (eo.isBridge && !ignoreBridgePenalty) ? WALK_ROUTING_WEIGHTS.bridgeFixedInspectionMeters * shakingGamma : 0;
        registerGoalForNode(endIdx, {
          idx: endIdx,
          goalIngressChainXZ,
          goalIngressLen: ingressLen + subLen * gMult + gBridgeFix,
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
        minGoalSnapDist = Math.min(minGoalSnapDist, gCand.dist);
        validGoalEdgeProjs.push({ ...gCand, goalIngressChainXZ, ingressLen });
      }
    }
  }
  if (validGoals.size === 0) {
    return cacheAndReturn({ found: false, reason: 'NO_COLLISION_FREE_PATH_FOUND', totalDistanceMeters: 0, totalStairsDistanceMeters: 0, hasStairs: false, stairFlightCount: 0, isStepFree: false, edges: [], waypoints3D: [] });
  }

  // Select candidate walkable entry nodes AND orthogonal mid-edge street projections
  const collectStartCands = (snapLimit, candLimit = 20) => {
    const startNodeCands = nodes
      .map((nd, idx) => ({
        kind: 'node',
        idx,
        xz: [nd[1], -nd[2]],
        dist: Math.hypot(nd[1] - safeStartXZ[0], -nd[2] - safeStartXZ[1])
      }))
      .filter(c => c.dist <= snapLimit && isPointClearOfOBB(c.xz, 0.02))
      .sort((a, b) => a.dist - b.dist)
      .slice(0, candLimit);

    const startEdgeProjs = findNearestEdgeProjectionsXZ(
      safeStartXZ, nodes, edges, snapLimit, candLimit, excludeStairs, blockedEdges
    )
      .filter(p => isPointClearOfOBB(p.xz, 0.02))
      .map(p => ({ kind: 'edge', ...p }));

    return [...startEdgeProjs, ...startNodeCands].sort((a, b) => a.dist - b.dist);
  };

  let startCands = collectStartCands(maxStartSnapMeters);
  const hasGoalCompMatch = (list) => list.some(c =>
    c.kind === 'node'
      ? goalCompIds.has(compOfNode[c.idx])
      : (goalCompIds.has(compOfNode[c.u]) || goalCompIds.has(compOfNode[c.v]))
  );
  if ((startCands.length === 0 || (goalCompIds.size > 0 && !hasGoalCompMatch(startCands))) && maxStartSnapMeters < 520) {
    startCands = collectStartCands(520, 40);
  }
  if (startCands.length === 0) {
    return cacheAndReturn({ found: false, reason: 'ORIGIN_OR_GOAL_OUT_OF_GRAPH_RANGE', totalDistanceMeters: 0, totalStairsDistanceMeters: 0, hasStairs: false, stairFlightCount: 0, isStepFree: false, edges: [], waypoints3D: [] });
  }
  if (goalCompIds.size > 0 && hasGoalCompMatch(startCands)) {
    startCands = startCands.filter(c =>
      c.kind === 'node'
        ? goalCompIds.has(compOfNode[c.idx])
        : (goalCompIds.has(compOfNode[c.u]) || goalCompIds.has(compOfNode[c.v]))
    );
  }

  // Validate virtual & node start entries -> seed Start entries into A*
  const validStarts = [];
  const validStartEdgeProjs = [];
  const collectStarts = (activeWaterways) => {
    let validatedStartEntries = 0;
    let minStartSnapDist = Infinity;
    for (const sCand of startCands) {
      // Prevent distant straight-line PORTAL_APPROACH segments from skipping real road edges & seismic weights
      if (validatedStartEntries >= 4 && sCand.dist > minStartSnapDist + 18.0) break;
      if (validatedStartEntries > 0 && sCand.dist > Math.max(45.0, minStartSnapDist + 38.0)) break;
      const portalChainXZ = tryVisibilityDetourXZ(safeStartXZ, sCand.xz, spatialOBBs, waterPolygons, activeWaterways);
      if (!portalChainXZ) continue;
      const portalLen = measureChainLen(portalChainXZ);

      if (sCand.kind === 'node') {
        validatedStartEntries++;
        minStartSnapDist = Math.min(minStartSnapDist, sCand.dist);
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
          if (hasSpatialOBBs && !isSegmentClearSpatial(sCand.xz, endXZ, spatialOBBs, 0.03)) {
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
          const sProf = edgeSeismicMap?.get(eo.keyUV);
          const sMult = computeSegmentAStarMultiplier(eo, sProf, { seismicDebrisAware, shakingGamma, excludeStairs, ignoreBridgePenalty });
          const sBridgeFix = (eo.isBridge && !ignoreBridgePenalty) ? WALK_ROUTING_WEIGHTS.bridgeFixedInspectionMeters * shakingGamma : 0;
          validStarts.push({
            idx: endIdx,
            portalChainXZ,
            portalLen: portalLen + subLen * sMult + sBridgeFix,
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
          minStartSnapDist = Math.min(minStartSnapDist, sCand.dist);
          validStartEdgeProjs.push({ ...sCand, portalChainXZ, portalLen });
        }
      }
    }
  };
  collectStarts(waterways);
  if (validStarts.length === 0) {
    startCands = collectStartCands(520, 80);
    if (goalCompIds.size > 0 && hasGoalCompMatch(startCands)) {
      startCands = startCands.filter(c =>
        c.kind === 'node'
          ? goalCompIds.has(compOfNode[c.idx])
          : (goalCompIds.has(compOfNode[c.u]) || goalCompIds.has(compOfNode[c.v]))
      );
    }
    collectStarts(waterways);
  }
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
      if (hasSpatialOBBs && !isSegmentClearSpatial(sProj.xz, gProj.xz, spatialOBBs, 0.03)) {
        continue;
      }
      if ((waterPolygons.length > 0 || waterways.length > 0) && !sProj.edgeObj.isBridge &&
        !isSegmentClearOfWaterXZ(sProj.xz, gProj.xz, waterPolygons, waterways)) {
        continue;
      }
      if (activeAvoid.length > 0 && segHitsAvoidPoly(sProj.xz[0], sProj.xz[1], gProj.xz[0], gProj.xz[1])) {
        continue;
      }
      const dProf = edgeSeismicMap?.get(sProj.edgeObj.keyUV);
      const dMult = computeSegmentAStarMultiplier(sProj.edgeObj, dProf, { seismicDebrisAware, shakingGamma, excludeStairs, ignoreBridgePenalty });
      const dBridgeFix = (sProj.edgeObj.isBridge && !ignoreBridgePenalty) ? WALK_ROUTING_WEIGHTS.bridgeFixedInspectionMeters * shakingGamma : 0;
      const totalScore = sProj.portalLen * 1.4 + segLen * dMult + dBridgeFix + gProj.ingressLen * 1.3;
      if (!directCandidate || totalScore < directCandidate.totalScore) {
        directCandidate = { sProj, gProj, segLen, totalScore };
      }
    }
  }

  if (validStarts.length === 0 && !directCandidate) {
    return cacheAndReturn({ found: false, reason: 'NO_COLLISION_FREE_PATH_FOUND', totalDistanceMeters: 0, totalStairsDistanceMeters: 0, hasStairs: false, stairFlightCount: 0, isStepFree: false, edges: [], waypoints3D: [] });
  }

  // Single unified Multi-Source -> Multi-Goal A* over spatially hashed OBBs
  const n = nodes.length;
  // Multiply admissible Euclidean lower bound by lowest possible surface multiplier (0.95) for global optimality
  const hCost = (idx) => Math.hypot(nodes[idx][1] - safeGoalXZ[0], -nodes[idx][2] - safeGoalXZ[1]) * 0.95;

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
        if (hasSpatialOBBs && !isSegmentClearSpatial(uXZ, vXZ, spatialOBBs, 0.05)) {
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

        const prof = edgeSeismicMap?.get(edge.edgeKey);
        let mult = computeSegmentAStarMultiplier(edge, prof, { seismicDebrisAware, shakingGamma, excludeStairs, ignoreBridgePenalty });
        let fixedBridgeEntry = 0.0;
        if (edge.isBridge && !ignoreBridgePenalty && (!prevEdge[u] || !prevEdge[u].isBridge)) {
          fixedBridgeEntry = WALK_ROUTING_WEIGHTS.bridgeFixedInspectionMeters * shakingGamma;
        }
        if (penalizeEdgeKeys && penalizeEdgeKeys.has(edge.edgeKey)) {
          mult *= overlapPenaltyMultiplier;
        }
        const overhangPenalty = hitsOBB ? (edge.dist * 26.0 + 110.0) : 0.0;
        const uphill = Math.max(0, edge.dy) * WALK_ROUTING_WEIGHTS.uphillGainPerMeter;
        const nextCost = dist[u] + edge.dist * mult + uphill + overhangPenalty + fixedBridgeEntry;

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
    const dirProf = edgeSeismicMap?.get(sProj.edgeObj.keyUV);
    const dirDebris = dirProf ? dirProf.debrisRisk : (sProj.edgeObj.debrisRisk ?? 0);
    const dirCanyon = dirProf ? dirProf.canyonRisk : 0;
    const dirWidth = dirProf ? dirProf.corridorWidthM : estimateDefaultHighwayWidthMeters(sProj.edgeObj.hw);
    if (segLen > 0.4) {
      outEdges.push({
        edgeId: `OSM_SEG_${sProj.edgeIdx}`,
        from: `OSM_EDGE_${sProj.edgeIdx}_ENTRY`,
        to: `OSM_EDGE_${sProj.edgeIdx}_EXIT`,
        distance: Number(segLen.toFixed(1)),
        hasStairs: sProj.edgeObj.hasStairs,
        isWheelchairPassable: !sProj.edgeObj.hasStairs,
        highway: sProj.edgeObj.hw,
        hazardRisk: dirDebris > 0.45 ? 'MODERATE' : (sProj.edgeObj.hasStairs ? 'HIGH' : 'LOW'),
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
    const dirBridgeCount = sProj.edgeObj.isBridge ? 1 : 0;
    return cacheAndReturn({
      portalIdx: sProj.u,
      goalIdx: gProj.v,
      found: true,
      totalDistanceMeters: Number(totalDist.toFixed(1)),
      effectiveRiskCostMeters: Number(directCandidate.totalScore.toFixed(1)),
      totalStairsDistanceMeters: 0,
      hasStairs: false,
      stairFlightCount: 0,
      isStepFree: true,
      routeAudit: {
        physicalDistanceMeters: Number(totalDist.toFixed(1)),
        effectiveRiskCostMeters: Number(directCandidate.totalScore.toFixed(1)),
        addedRiskEquivalentMeters: Number(Math.max(0, directCandidate.totalScore - totalDist).toFixed(1)),
        meanDebrisRisk: Number(dirDebris.toFixed(3)),
        maxDebrisRisk: Number(dirDebris.toFixed(3)),
        highDebrisMeters: Number((dirDebris >= 0.45 ? segLen : 0).toFixed(1)),
        canyonMeters: Number((dirCanyon >= 0.25 ? segLen : 0).toFixed(1)),
        narrowAlleyMeters: Number((dirWidth < WALK_ROUTING_WEIGHTS.narrowCorridorThresholdM ? segLen : 0).toFixed(1)),
        bridgeCount: dirBridgeCount,
        bridgeMeters: Number((sProj.edgeObj.isBridge ? segLen : 0).toFixed(1)),
        meanCorridorWidthM: Number(dirWidth.toFixed(1)),
        shakingIntensityFactor: shakingGamma
      },
      edges: outEdges,
      waypoints3D,
      startNodeId: `OSM_NODE_${nodes[sProj.u][0]}`,
      targetNodeId: `OSM_NODE_${nodes[gProj.v][0]}`
    });
  }

  if (!bestSolution) {
    return cacheAndReturn({ found: false, reason: 'NO_COLLISION_FREE_PATH_FOUND', totalDistanceMeters: 0, totalStairsDistanceMeters: 0, hasStairs: false, stairFlightCount: 0, isStepFree: false, edges: [], waypoints3D: [] });
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

    // Route cleanly around any intersecting OBB flank whenever passable (not limited to overhang fallback)
    if (hasSpatialOBBs && !isSegmentClearSpatial(uXZ, vXZ, spatialOBBs, 0.02)) {
      let endEi = ei;
      while (endEi + 1 < rawEdges.length && endEi - ei < 10) {
        const curVXZ = [rawEdges[endEi].vNd[1], -rawEdges[endEi].vNd[2]];
        const nextVXZ = [rawEdges[endEi + 1].vNd[1], -rawEdges[endEi + 1].vNd[2]];
        const vInside = !isSegmentClearSpatial(curVXZ, curVXZ, spatialOBBs, 0.04);
        const nextBlocked = !isSegmentClearSpatial(curVXZ, nextVXZ, spatialOBBs, 0.02);
        if (vInside || nextBlocked) {
          endEi++;
        } else {
          break;
        }
      }
      const startFixXZ = isPointClearOfOBB(uXZ, 0.04) ? uXZ : pushPointOutsideSpatialOBBs(uXZ, spatialOBBs, 1.35);
      const endVNd = rawEdges[endEi].vNd;
      const endRawXZ = [endVNd[1], -endVNd[2]];
      const endVXZ = isPointClearOfOBB(endRawXZ, 0.04) ? endRawXZ : pushPointOutsideSpatialOBBs(endRawXZ, spatialOBBs, 1.35);
      const flankChain = tryVisibilityDetourXZ(startFixXZ, endVXZ, spatialOBBs, waterPolygons, waterways);
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

  // Final strict OBB verification pass: guarantee zero residual waypoint segments intersect any OBB
  if (hasSpatialOBBs) {
    totalDist = 0;
    for (let ei = 0; ei < outEdges.length; ei++) {
      const oe = outEdges[ei];
      const wps = oe.waypoints || [];
      let edgeNeedsRepair = false;
      for (let wi = 0; wi + 1 < wps.length; wi++) {
        const aXZ = [wps[wi][0], wps[wi][2]];
        const bXZ = [wps[wi + 1][0], wps[wi + 1][2]];
        if (!isSegmentClearSpatial(aXZ, bXZ, spatialOBBs, 0.01)) {
          edgeNeedsRepair = true;
          break;
        }
      }
      if (edgeNeedsRepair && wps.length >= 2) {
        const a0 = [wps[0][0], wps[0][2]];
        const b0 = [wps[wps.length - 1][0], wps[wps.length - 1][2]];
        const clearA = isPointClearOfOBB(a0, 0.04) ? a0 : pushPointOutsideSpatialOBBs(a0, spatialOBBs, 1.35);
        const clearB = isPointClearOfOBB(b0, 0.04) ? b0 : pushPointOutsideSpatialOBBs(b0, spatialOBBs, 1.35);
        const fixedChain = tryVisibilityDetourXZ(clearA, clearB, spatialOBBs, waterPolygons, waterways);
        if (fixedChain && fixedChain.length >= 2) {
          oe.waypoints = subdivideAndElevateChainXZ(fixedChain, elevationSampler, 8.0, 0.42, oe.highway === 'bridge');
          oe.distance = Number(measureChainLen(fixedChain).toFixed(1));
        }
      }
      totalDist += oe.distance || 0;
    }
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

  // Compute physical & seismic route audit metrics across ALL traversed road sub-edges (start virtual + graph + goal virtual)
  let weightedDebrisSum = 0;
  let weightedWidthSum = 0;
  let auditedRoadLen = 0;
  let maxDebris = 0;
  let highDebrisMeters = 0;
  let canyonMeters = 0;
  let narrowAlleyMeters = 0;
  let bridgeMeters = 0;
  let bridgeCount = 0;
  let prevOnBridge = false;
  const auditSeg = (edgeObj, segLen) => {
    if (!edgeObj || !(segLen > 0)) return;
    const prof = edgeSeismicMap?.get(edgeObj.edgeKey || edgeObj.keyUV);
    const dRisk = prof ? prof.debrisRisk : (edgeObj.debrisRisk ?? 0);
    const cRisk = prof ? prof.canyonRisk : 0;
    const wClear = prof ? prof.corridorWidthM : estimateDefaultHighwayWidthMeters(edgeObj.hw);
    auditedRoadLen += segLen;
    weightedDebrisSum += dRisk * segLen;
    weightedWidthSum += wClear * segLen;
    if (dRisk > maxDebris) maxDebris = dRisk;
    if (dRisk >= 0.45) highDebrisMeters += segLen;
    if (cRisk >= 0.25) canyonMeters += segLen;
    if (wClear < WALK_ROUTING_WEIGHTS.narrowCorridorThresholdM) narrowAlleyMeters += segLen;
    if (edgeObj.isBridge) {
      bridgeMeters += segLen;
      if (!prevOnBridge) bridgeCount++;
    }
    prevOnBridge = Boolean(edgeObj.isBridge);
  };
  if (chosenStart?.virtualEdge) auditSeg(chosenStart.virtualEdge.edgeObj, chosenStart.virtualEdge.subLen);
  for (let ei = 0; ei < rawEdges.length; ei++) auditSeg(rawEdges[ei].edge, rawEdges[ei].edge.dist || 0);
  if (gInfo?.virtualEdge) auditSeg(gInfo.virtualEdge.edgeObj, gInfo.virtualEdge.subLen);

  const effectiveRiskCost = Number((bestSolution.totalScore || totalDist).toFixed(1));
  const routeAudit = {
    physicalDistanceMeters: Number(totalDist.toFixed(1)),
    effectiveRiskCostMeters: effectiveRiskCost,
    addedRiskEquivalentMeters: Number(Math.max(0, effectiveRiskCost - totalDist).toFixed(1)),
    meanDebrisRisk: Number((auditedRoadLen > 0 ? weightedDebrisSum / auditedRoadLen : 0).toFixed(3)),
    maxDebrisRisk: Number(maxDebris.toFixed(3)),
    highDebrisMeters: Number(highDebrisMeters.toFixed(1)),
    canyonMeters: Number(canyonMeters.toFixed(1)),
    narrowAlleyMeters: Number(narrowAlleyMeters.toFixed(1)),
    bridgeCount,
    bridgeMeters: Number(bridgeMeters.toFixed(1)),
    meanCorridorWidthM: Number((auditedRoadLen > 0 ? weightedWidthSum / auditedRoadLen : 8.0).toFixed(1)),
    shakingIntensityFactor: shakingGamma
  };

  return cacheAndReturn({
    portalIdx,
    goalIdx,
    found: true,
    totalDistanceMeters: Number(totalDist.toFixed(1)),
    effectiveRiskCostMeters: effectiveRiskCost,
    totalStairsDistanceMeters: Number(totalStairDist.toFixed(1)),
    hasStairs: stairFlights > 0,
    stairFlightCount: stairFlights,
    isStepFree: stairFlights === 0,
    routeAudit,
    edges: outEdges,
    waypoints3D,
    startNodeId: `OSM_NODE_${nodes[portalIdx][0]}`,
    targetNodeId: `OSM_NODE_${nodes[goalIdx][0]}`
  });
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
/**
 * Pick an unblocked exterior street-facing exit doorway for any selected building OBB.
 * Excludes the origin building footprint itself so narrow wings/corners never false-block portals.
 */
export function buildNeutralStreetExit({
  east_m = 0,
  north_m = 0,
  width_m = 28,
  depth_m = 20,
  yaw_rad = 0,
  height_m = 18,
  walkGraph = null,
  buildingOBBs = REAL_OSM_BUILDINGS_FLAT,
  preferredTargetXZ = null
} = {}) {
  const centerX = east_m;
  const centerZ = -north_m;
  const obbObj = { east_m, north_m, width_m, depth_m, yaw_rad, height_m, boundR: Math.hypot(width_m, depth_m) * 0.5 };
  const corners = getExpandedOBBCornersXZ(obbObj, 0.0);
  const spatialIdx = getSpatialOBBIndex(buildingOBBs);
  const allNearOBBs = querySpatialOBBsInBounds(
    spatialIdx,
    centerX - 75, centerZ - 75, centerX + 75, centerZ + 75,
    null, 0, null
  );
  // Exclude ONLY the clicked origin OBB footprint itself
  const nearOBBs = allNearOBBs.filter(ob =>
    !(Math.hypot(ob.east_m - obbObj.east_m, ob.north_m - obbObj.north_m) < 0.25 &&
      Math.abs(ob.width_m - obbObj.width_m) < 0.25 &&
      Math.abs(ob.depth_m - obbObj.depth_m) < 0.25)
  );

  const gNodes = walkGraph?.nodes || [];
  const gEdges = walkGraph?.edges || [];
  const collectRoadSegs = (radiusM) => {
    const segs = [];
    for (let i = 0; i < gEdges.length; i++) {
      const nu = gNodes[gEdges[i][0]];
      const nv = gNodes[gEdges[i][1]];
      if (!nu || !nv) continue;
      const ux = nu[1], uz = -nu[2], vx = nv[1], vz = -nv[2];
      if (Math.max(ux, vx) < centerX - radiusM || Math.min(ux, vx) > centerX + radiusM) continue;
      if (Math.max(uz, vz) < centerZ - radiusM || Math.min(uz, vz) > centerZ + radiusM) continue;
      segs.push([ux, uz, vx, vz]);
    }
    return segs;
  };
  let localRoadSegs = collectRoadSegs(110);
  if (localRoadSegs.length === 0) {
    localRoadSegs = collectRoadSegs(420);
  }
  const distToNearestStreet = (px, pz) => {
    if (localRoadSegs.length === 0) return 0;
    let best = 450.0;
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
      const blocked = nearOBBs.length > 0 && isPointInsideAnyOBB([fx, fz], nearOBBs, 0.35);
      const streetDist = distToNearestStreet(fx, fz);
      const outDist = preferredTargetXZ ? Math.hypot(mx - preferredTargetXZ[0], mz - preferredTargetXZ[1]) : 0;
      exitCandidates.push({
        mx, mz, fx, fz, vx: ux, vz: uz, blocked, streetDist,
        score: streetDist * 2.2 + outDist * 0.06 + (pushOut > 4.0 ? 3.5 : 0)
      });
    }
    const cx = a[0] - centerX, cz = a[1] - centerZ;
    const cLen = Math.max(1e-6, Math.hypot(cx, cz));
    const cux = cx / cLen, cuz = cz / cLen;
    const cfx = a[0] + cux * 3.8, cfz = a[1] + cuz * 3.8;
    const cBlocked = nearOBBs.length > 0 && isPointInsideAnyOBB([cfx, cfz], nearOBBs, 0.35);
    const cStreetDist = distToNearestStreet(cfx, cfz);
    const cOutDist = preferredTargetXZ ? Math.hypot(a[0] - preferredTargetXZ[0], a[1] - preferredTargetXZ[1]) : 0;
    exitCandidates.push({
      mx: a[0], mz: a[1], fx: cfx, fz: cfz, vx: cux, vz: cuz, blocked: cBlocked, streetDist: cStreetDist,
      score: cStreetDist * 2.2 + cOutDist * 0.06 + 2.0
    });
  }
  exitCandidates.sort((a, b) => (a.blocked === b.blocked ? a.score - b.score : (a.blocked ? 1 : -1)));
  const bestExit = exitCandidates[0];
  const footwayXZ = bestExit.blocked
    ? pushPointOutsideSpatialOBBs([bestExit.fx, bestExit.fz], spatialIdx, 1.5, null, 0, null)
    : [bestExit.fx, bestExit.fz];

  return {
    corners,
    nearOBBs,
    bestExit,
    doorXZ: [bestExit.mx, bestExit.mz],
    footwayXZ,
    vecOutX: bestExit.vx,
    vecOutZ: bestExit.vz,
    streetExitCount: exitCandidates.filter(c => !c.blocked).length
  };
}

/**
 * Paper-grade Seismic Multi-Criteria Destination Objective J(S | o) in risk-equivalent meters (lower is better).
 * Integrates verified walkable path distance, facade collapse/canyon exposure, bridge crossings,
 * destination standoff & capacity, official designation reliability, and waterway proximity hazard.
 */
export function evaluateDestinationMcdaScore(candidate, walkSol, options = {}) {
  if (!walkSol || !walkSol.found || !(walkSol.totalDistanceMeters > 0)) {
    return {
      reachable: false,
      totalScore: Infinity,
      physicalWalkMeters: Infinity,
      riskCostMeters: Infinity,
      summaryKo: '보행 연결 경로 없음'
    };
  }
  const dims = candidate?.dimensions || {};
  const audit = walkSol.routeAudit || {};
  const physicalWalkMeters = walkSol.totalDistanceMeters;
  const riskCostMeters = Number.isFinite(audit.effectiveRiskCostMeters)
    ? audit.effectiveRiskCostMeters
    : (walkSol.effectiveRiskCostMeters || physicalWalkMeters);

  const clearanceM = Number.isFinite(dims.clearanceRadiusMeters) ? dims.clearanceRadiusMeters : 15;
  const areaSqM = candidate?.justification?.areaSqMeters || candidate?.geometry?.areaSqMeters || 0;
  const isOfficial = dims.officialDesignation && !String(dims.officialDesignation).includes('UNCONFIRMED');
  const isOsmAssembly = Boolean(candidate?.facilityType === 'LOCAL_DESIGNATED' || candidate?.isOsmAssemblyTagged);
  const nearWater = Boolean(dims.waterProximityCaution);

  // Destination safety / hazard adjustments (all expressed cleanly in equivalent meters)
  const waterPenaltyMeters = (nearWater && !isOfficial) ? 75 : 0;
  const standoffPenaltyMeters = clearanceM < 6 ? 85 : clearanceM < 12 ? 30 : 0;
  const officialBonusMeters = isOfficial ? 75 : isOsmAssembly ? 22 : 0;
  const standoffBonusMeters = clearanceM > 8 ? Math.min(40, (clearanceM - 8) * 1.6) : 0;
  const areaBonusMeters = areaSqM >= 1500 ? Math.min(25, Math.sqrt(areaSqM) * 0.25) : 0;

  const destHazardPenaltyMeters = waterPenaltyMeters + standoffPenaltyMeters;
  const destSafetyBonusMeters = Number((officialBonusMeters + standoffBonusMeters + areaBonusMeters).toFixed(1));
  const totalScore = Number(Math.max(1, riskCostMeters + destHazardPenaltyMeters - destSafetyBonusMeters).toFixed(1));

  const debrisPct = Math.round((audit.meanDebrisRisk || 0) * 100);
  const bridges = audit.bridgeCount || 0;
  const widthM = audit.meanCorridorWidthM || 8.0;
  const summaryKo = `실보행 ${Math.round(physicalWalkMeters)}m (위험등가 ${Math.round(riskCostMeters)}m) · 붕괴위험 ${debrisPct}% · 교량 ${bridges}회 · 평균폭 ${widthM}m · 이격 ${Math.round(clearanceM)}m`;

  return {
    reachable: true,
    totalScore,
    physicalWalkMeters,
    riskCostMeters,
    bridgeCount: bridges,
    bridgePenaltyMeters: bridges * WALK_ROUTING_WEIGHTS.bridgeFixedInspectionMeters,
    debrisExposurePct: debrisPct,
    highDebrisMeters: audit.highDebrisMeters || 0,
    canyonMeters: audit.canyonMeters || 0,
    meanCorridorWidthM: widthM,
    waterPenaltyMeters,
    standoffPenaltyMeters,
    destHazardPenaltyMeters,
    destSafetyBonusMeters,
    summaryKo
  };
}

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
  originHasBuilding = undefined,
  anchor = { lat: 37.555815, lon: 127.045053, h: 42.0 },
  walkGraph = null,
  buildingOBBs = REAL_OSM_BUILDINGS_FLAT,
  shelter = null,
  waterPolygons = [],
  waterways = [],
  indoorScope = 'HEIGHT_ONLY_3D',
  shakingMmi = null,
  elevationSampler = sampleTerrainHeight
} = {}) {
  const hasOriginBuilding = originHasBuilding !== undefined
    ? Boolean(originHasBuilding)
    : (buildingId !== 'OUTDOOR_ANALYSIS_ORIGIN' && indoorScope !== 'OUTDOOR_ONLY' && Number(height_m) > 0);
  const effectiveHeightM = hasOriginBuilding ? Math.max(3.6, Number(height_m) || 18) : 0;
  const groundY = Number(((typeof elevationSampler === 'function' ? elevationSampler(east_m, north_m) : 0) || 0).toFixed(2));
  const totalLevels = hasOriginBuilding ? Math.max(1, Math.min(30, Math.round(effectiveHeightM / 3.6))) : 0;
  const floorHeightMeters = 3.6;
  const hasIndoorData = hasOriginBuilding && (indoorScope === 'PROVISIONAL_FLOORPLAN' || indoorScope === 'VERIFIED_INDOOR');
  const defaultFloor = hasIndoorData ? Math.min(totalLevels, Math.max(2, Math.round(totalLevels * 0.5))) : (hasOriginBuilding ? 1 : null);
  const targetY = groundY + Math.max(0, (defaultFloor || 1) - 1) * floorHeightMeters;

  const centerX = east_m;
  const centerZ = -north_m;

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

  let footprint;
  let doorXZ;
  let footwayXZ;
  let vecOutX = 1.0;
  let vecOutZ = 0.0;
  if (hasOriginBuilding) {
    const exitSpec = buildNeutralStreetExit({
      east_m, north_m, width_m, depth_m, yaw_rad, height_m: effectiveHeightM,
      walkGraph, buildingOBBs, preferredTargetXZ: shelterXZ
    });
    footprint = [...exitSpec.corners, exitSpec.corners[0]].map(p => Object.freeze([Number(p[0].toFixed(2)), Number(p[1].toFixed(2))]));
    doorXZ = exitSpec.doorXZ;
    footwayXZ = exitSpec.footwayXZ;
    vecOutX = exitSpec.vecOutX;
    vecOutZ = exitSpec.vecOutZ;
  } else {
    const spatialIdx = getSpatialOBBIndex(buildingOBBs);
    const clearStart = (spatialIdx && spatialIdx.all.length > 0)
      ? pushPointOutsideSpatialOBBs([centerX, centerZ], spatialIdx, 1.5)
      : [centerX, centerZ];
    doorXZ = clearStart;
    footwayXZ = clearStart;
    footprint = [
      [clearStart[0] - 2, clearStart[1] - 2],
      [clearStart[0] + 2, clearStart[1] - 2],
      [clearStart[0] + 2, clearStart[1] + 2],
      [clearStart[0] - 2, clearStart[1] + 2],
      [clearStart[0] - 2, clearStart[1] - 2]
    ].map(p => Object.freeze([Number(p[0].toFixed(2)), Number(p[1].toFixed(2))]));
  }
  const normOut = 1.0;
  const footwayY = Number(((typeof elevationSampler === 'function' ? elevationSampler(footwayXZ[0], -footwayXZ[1]) : groundY) + 0.25).toFixed(2));

  const originBypassRad = 0.0;
  const targetShelterId = shelter?.shelterId || shelter?.id || null;
  const emptySol = { found: false, totalDistanceMeters: 0, hasStairs: false, edges: [], targetNodeId: null, routeAudit: null };
  const shortestSol = hasValidShelter
    ? solveCampusWalkGraph({
      startXZ: footwayXZ,
      goalXZ: shelterXZ,
      excludeStairs: false,
      shakingMmi,
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
  const naiveShortestSol = (hasValidShelter && shortestSol.found && buildingId !== 'BLDG_212_ENG1')
    ? solveCampusWalkGraph({
      startXZ: footwayXZ,
      goalXZ: shelterXZ,
      excludeStairs: false,
      seismicDebrisAware: false,
      ignoreBridgePenalty: true,
      buildingOBBs,
      customWalkGraph: walkGraph,
      elevationSampler,
      targetShelterId,
      waterPolygons,
      waterways,
      originCentroidXZ: [centerX, centerZ],
      originExclusionRadius: originBypassRad
    })
    : shortestSol;
  const stepFreeSol = hasValidShelter
    ? solveCampusWalkGraph({
      startXZ: footwayXZ,
      goalXZ: shelterXZ,
      excludeStairs: true,
      shakingMmi,
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
      shakingMmi,
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
    originHasBuilding: hasOriginBuilding,
    indoorScope,
    dynamicOriginMeta: Object.freeze({ id: buildingId, name, east_m, north_m, width_m, depth_m, yaw_rad, height_m: effectiveHeightM, originHasBuilding: hasOriginBuilding }),
    anchor: Object.freeze({ lat: anchor.lat, lon: anchor.lon, h: anchor.h ?? 42.0 }),
    buildingMetadata: Object.freeze({
      id: buildingId,
      name,
      unitNumber: unitNumber || '',
      structureType: !hasOriginBuilding
        ? '실외 분석 기준 지점 (OUTDOOR_ONLY)'
        : (hasIndoorData ? '잠정 실내 공간 포함 건축물' : `외곽 3D 모델 (${indoorScope} · 실내 도면 미확보)`),
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
      PATH_SHORTEST_RAPID: Object.freeze({
        name: `${name} 지진 안전 최적 경로`,
        targetLengthMeters: shortestSol.found ? shortestSol.totalDistanceMeters : 0,
        hasStairs: shortestSol.hasStairs,
        isWheelchairPassable: !shortestSol.hasStairs,
        provenance: 'PROVISIONAL',
        routeAudit: shortestSol.routeAudit || null,
        naiveShortestMeters: naiveShortestSol?.found ? naiveShortestSol.totalDistanceMeters : null,
        naiveDebrisMeters: naiveShortestSol?.routeAudit?.highDebrisMeters ?? null
      }),
      PATH_STEP_FREE_DETOUR: Object.freeze({
        name: `${name} 계단 회피 경로`,
        targetLengthMeters: stepFreeSol.found ? stepFreeSol.totalDistanceMeters : 0,
        hasStairs: false,
        isWheelchairPassable: true,
        provenance: 'PROVISIONAL',
        routeAudit: stepFreeSol.routeAudit || null
      }),
      PATH_ALTERNATIVE: Object.freeze({
        name: `${name} 대체 보행 경로`,
        targetLengthMeters: altSol.found ? altSol.totalDistanceMeters : 0,
        hasStairs: altSol.hasStairs,
        isWheelchairPassable: !altSol.hasStairs,
        provenance: 'PROVISIONAL',
        routeAudit: altSol.routeAudit || null
      })
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
