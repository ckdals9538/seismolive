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

function getOrCompileWalkAdjacency(walkGraph) {
  const source = walkGraph || HANYANG_CAMPUS_WALK_GRAPH;
  if (GRAPH_ADJ_CACHE.has(source)) {
    return GRAPH_ADJ_CACHE.get(source);
  }
  const nodes = source.nodes || [];
  const edges = source.edges || [];
  const adj = Array.from({ length: nodes.length }, () => []);
  for (let idx = 0; idx < edges.length; idx++) {
    const [u, v, dist, hw, hasStairs, debrisRisk] = edges[idx];
    const nu = nodes[u];
    const nv = nodes[v];
    if (!nu || !nv) continue;
    const dy = (nv[3] ?? 0) - (nu[3] ?? 0);
    adj[u].push({ to: v, dist, dy, hw, hasStairs: !!hasStairs, debrisRisk: debrisRisk ?? 0, edgeKey: `${nu[0]}->${nv[0]}` });
    adj[v].push({ to: u, dist, dy: -dy, hw, hasStairs: !!hasStairs, debrisRisk: debrisRisk ?? 0, edgeKey: `${nv[0]}->${nu[0]}` });
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
export function findVisibilityDetourXZ(startXZ, goalXZ, obstaclesOBB = [], marginMeters = 1.6) {
  if (!obstaclesOBB || obstaclesOBB.length === 0) {
    return [startXZ, goalXZ];
  }
  if (isSegmentClearOfOBBs(startXZ, goalXZ, obstaclesOBB, 0.25)) {
    return [startXZ, goalXZ];
  }

  // Collect blocking OBBs along direct corridor envelope (+120m lateral buffer)
  const minX = Math.min(startXZ[0], goalXZ[0]) - 120;
  const maxX = Math.max(startXZ[0], goalXZ[0]) + 120;
  const minZ = Math.min(startXZ[1], goalXZ[1]) - 120;
  const maxZ = Math.max(startXZ[1], goalXZ[1]) + 120;

  const localOBBs = obstaclesOBB.filter(
    ob => ob.east_m >= minX && ob.east_m <= maxX && (-ob.north_m) >= minZ && (-ob.north_m) <= maxZ
  );

  const vertices = [startXZ];
  for (const ob of localOBBs) {
    // Only add corners of buildings close enough to affect the corridor
    if (!doesSegmentIntersectOBBXZ(startXZ, goalXZ, ob, 36.0)) continue;
    const corners = getExpandedOBBCornersXZ(ob, marginMeters);
    for (const c of corners) {
      if (!isPointInsideAnyOBB(c, localOBBs, 0.25)) {
        vertices.push(c);
      }
    }
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
      if (!isSegmentClearOfOBBs(vertices[u], vertices[v], localOBBs, 0.2)) continue;
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
    return [startXZ, goalXZ];
  }
  const chain = [];
  for (let cur = goalIdx; cur !== -1; cur = prev[cur]) {
    chain.push(vertices[cur]);
  }
  chain.reverse();
  return chain;
}

function getHighwayWalkMultiplier(hw) {
  switch (hw) {
    case 'footway':
    case 'pedestrian':
    case 'living_street':
    case 'steps':
      return 1.0;
    case 'path':
    case 'cycleway':
      return 1.05;
    case 'service':
      return 1.12;
    default:
      return 1.24;
  }
}

/**
 * Solve optimal pedestrian evacuation route across real OpenStreetMap campus paths
 * using Euclidean A* with strict building-OBB collision avoidance, stair constraints,
 * slope weighting, and seismic facade-debris proximity penalty.
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
    originExclusionRadius = 26.0,
    originCentroidXZ = startXZ,
    seismicDebrisAware = true,
    blockedEdges = null,
    avoidPolygons = null
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

  const { nodes, adj } = customWalkGraph ? getOrCompileWalkAdjacency(customWalkGraph) : CAMPUS_GRAPH_ADJ;
  if (nodes.length === 0) {
    return { found: false, totalDistanceMeters: 0, totalStairsDistanceMeters: 0, hasStairs: false, stairFlightCount: 0, isStepFree: false, edges: [], waypoints3D: [] };
  }

  const obstacles = normalizeOBBList(buildingOBBs, originCentroidXZ, originExclusionRadius)
    .filter(ob => {
      // Do not allow an OBB centered directly inside the shelter goal ring to block target ingress
      const dx = ob.east_m - goalXZ[0];
      const dz = -ob.north_m - goalXZ[1];
      return Math.hypot(dx, dz) > 22.0;
    });

  // Select top candidate walkable entry nodes sorted by distance from startXZ, preferring clear LOS
  const startCands = nodes
    .map((nd, idx) => ({
      idx,
      xz: [nd[1], -nd[2]],
      dist: Math.hypot(nd[1] - startXZ[0], -nd[2] - startXZ[1])
    }))
    .sort((a, b) => a.dist - b.dist)
    .slice(0, 12);

  // Select nearest target node on shelter perimeter
  let goalIdx = 0;
  let bestGoalDist = 1e18;
  for (let i = 0; i < nodes.length; i++) {
    const d = Math.hypot(nodes[i][1] - goalXZ[0], -nodes[i][2] - goalXZ[1]);
    if (d < bestGoalDist) {
      bestGoalDist = d;
      goalIdx = i;
    }
  }
  const targetNodeXZ = [nodes[goalIdx][1], -nodes[goalIdx][2]];

  const runAStarFromPortal = (portalIdx) => {
    const n = nodes.length;
    const dist = new Float64Array(n).fill(1e18);
    const fScore = new Float64Array(n).fill(1e18);
    const prevNode = new Int32Array(n).fill(-1);
    const prevEdge = new Array(n).fill(null);
    const closed = new Uint8Array(n);

    const hCost = (idx) => Math.hypot(nodes[idx][1] - targetNodeXZ[0], -nodes[idx][2] - targetNodeXZ[1]);
    dist[portalIdx] = 0.0;
    fScore[portalIdx] = hCost(portalIdx);
    const open = [portalIdx];

    while (open.length > 0) {
      let bestPos = 0;
      for (let k = 1; k < open.length; k++) {
        if (fScore[open[k]] < fScore[open[bestPos]]) bestPos = k;
      }
      const u = open.splice(bestPos, 1)[0];
      if (u === goalIdx) break;
      if (closed[u]) continue;
      closed[u] = 1;

      const uXZ = [nodes[u][1], -nodes[u][2]];
      const neighbors = adj[u];
      for (let i = 0; i < neighbors.length; i++) {
        const edge = neighbors[i];
        if (closed[edge.to]) continue;
        if (excludeStairs && edge.hasStairs) continue;
        if (blockedEdges && blockedEdges.has(edge.edgeKey)) continue;

        const vXZ = [nodes[edge.to][1], -nodes[edge.to][2]];
        if (obstacles.length > 0 && !isSegmentClearOfOBBs(uXZ, vXZ, obstacles, -0.02)) {
          continue;
        }
        if (activeAvoid.length > 0 && segHitsAvoidPoly(uXZ[0], uXZ[1], vXZ[0], vXZ[1])) {
          continue;
        }

        let mult = getHighwayWalkMultiplier(edge.hw);
        if (excludeStairs && edge.dist > 1.0 && Math.abs(edge.dy) / edge.dist > 0.14) {
          mult *= 1.35; // Penalize steep ungraded ramps when computing accessible detour
        }
        if (seismicDebrisAware && edge.debrisRisk > 0) {
          mult *= (1.0 + edge.debrisRisk * 0.14);
        }
        const uphill = Math.max(0, edge.dy) * 0.35;
        const nextCost = dist[u] + edge.dist * mult + uphill;

        if (nextCost < dist[edge.to]) {
          dist[edge.to] = nextCost;
          prevNode[edge.to] = u;
          prevEdge[edge.to] = edge;
          fScore[edge.to] = nextCost + hCost(edge.to);
          if (!open.includes(edge.to)) open.push(edge.to);
        }
      }
    }

    if (dist[goalIdx] >= 1e17) return null;

    // Reconstruct raw graph edges
    const rawEdges = [];
    for (let cur = goalIdx; cur !== portalIdx; cur = prevNode[cur]) {
      const e = prevEdge[cur];
      const uNd = nodes[prevNode[cur]];
      const vNd = nodes[cur];
      rawEdges.push({ uNd, vNd, edge: e });
    }
    rawEdges.reverse();
    return { portalIdx, rawEdges, graphCost: dist[goalIdx] };
  };

  // Pick candidate portal yielding shortest valid doorway + walkable graph route
  let bestSolution = null;
  for (const cand of startCands) {
    const sol = runAStarFromPortal(cand.idx);
    if (!sol) continue;
    const portalChainXZ = findVisibilityDetourXZ(startXZ, cand.xz, obstacles, 1.5);
    let portalLen = 0;
    for (let i = 0; i < portalChainXZ.length - 1; i++) {
      portalLen += Math.hypot(portalChainXZ[i + 1][0] - portalChainXZ[i][0], portalChainXZ[i + 1][1] - portalChainXZ[i][1]);
    }
    const totalScore = sol.graphCost + portalLen * 1.4;
    if (!bestSolution || totalScore < bestSolution.totalScore) {
      bestSolution = { ...sol, portalChainXZ, portalLen, totalScore };
    }
    if (cand.dist < 18.0 && portalChainXZ.length === 2) break;
  }

  if (!bestSolution) {
    return { found: false, totalDistanceMeters: 0, totalStairsDistanceMeters: 0, hasStairs: false, stairFlightCount: 0, isStepFree: false, edges: [], waypoints3D: [] };
  }

  const elevateXZ = ([x, z]) => [
    Number(x.toFixed(2)),
    Number(((typeof elevationSampler === 'function' ? elevationSampler(x, -z) : sampleTerrainHeight(x, -z)) + 0.35).toFixed(2)),
    Number(z.toFixed(2))
  ];

  // Build unified edges (Portal visibility entry -> OSM edges -> Goal ingress)
  const outEdges = [];
  let totalDist = 0;
  let totalStairDist = 0;
  let stairFlights = 0;
  let prevWasStairs = false;

  const branchLabel = excludeStairs ? 'STEP_FREE' : 'SHORTEST';

  if (bestSolution.portalLen > 0.6) {
    const portalWps = bestSolution.portalChainXZ.map(elevateXZ);
    outEdges.push({
      edgeId: `PORTAL_APPROACH->OSM_${nodes[bestSolution.portalIdx][0]}`,
      from: 'PORTAL_APPROACH',
      to: `OSM_NODE_${nodes[bestSolution.portalIdx][0]}`,
      distance: Number(bestSolution.portalLen.toFixed(1)),
      hasStairs: false,
      isWheelchairPassable: true,
      highway: 'footway',
      branch: branchLabel,
      waypoints: portalWps
    });
    totalDist += bestSolution.portalLen;
  }

  for (const item of bestSolution.rawEdges) {
    const { uNd, vNd, edge } = item;
    const pU = elevateXZ([uNd[1], -uNd[2]]);
    const pV = elevateXZ([vNd[1], -vNd[2]]);
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
      waypoints: [pU, pV]
    });
  }

  // Final ingress segment onto exact shelter center/perimeter goalXZ
  const goalIngressChainXZ = findVisibilityDetourXZ(targetNodeXZ, goalXZ, obstacles, 1.4);
  let goalIngressLen = 0;
  for (let i = 0; i < goalIngressChainXZ.length - 1; i++) {
    goalIngressLen += Math.hypot(
      goalIngressChainXZ[i + 1][0] - goalIngressChainXZ[i][0],
      goalIngressChainXZ[i + 1][1] - goalIngressChainXZ[i][1]
    );
  }
  if (goalIngressLen > 0.6) {
    outEdges.push({
      edgeId: `OSM_${nodes[goalIdx][0]}->SHELTER_INGRESS`,
      from: `OSM_NODE_${nodes[goalIdx][0]}`,
      to: targetShelterId,
      distance: Number(goalIngressLen.toFixed(1)),
      hasStairs: false,
      isWheelchairPassable: true,
      highway: 'shelter_ingress',
      branch: branchLabel,
      waypoints: goalIngressChainXZ.map(elevateXZ)
    });
    totalDist += goalIngressLen;
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
    found: true,
    totalDistanceMeters: Number(totalDist.toFixed(1)),
    totalStairsDistanceMeters: Number(totalStairDist.toFixed(1)),
    hasStairs: stairFlights > 0,
    stairFlightCount: stairFlights,
    isStepFree: stairFlights === 0,
    edges: outEdges,
    waypoints3D,
    startNodeId: `OSM_NODE_${nodes[bestSolution.portalIdx][0]}`,
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
  elevationSampler = sampleTerrainHeight
} = {}) {
  const groundY = Number(((typeof elevationSampler === 'function' ? elevationSampler(east_m, north_m) : 0) || 0).toFixed(2));
  const totalLevels = Math.max(2, Math.min(20, Math.round(height_m / 3.6)));
  const floorHeightMeters = 3.6;
  const defaultFloor = Math.min(totalLevels, Math.max(2, Math.round(totalLevels * 0.5)));
  const targetY = groundY + (defaultFloor - 1) * floorHeightMeters;

  const centerX = east_m;
  const centerZ = -north_m;
  const obbObj = { east_m, north_m, width_m, depth_m, yaw_rad, height_m, boundR: Math.hypot(width_m, depth_m) * 0.5 };
  const corners = getExpandedOBBCornersXZ(obbObj, 0.0);
  const footprint = [...corners, corners[0]].map(p => Object.freeze([Number(p[0].toFixed(2)), Number(p[1].toFixed(2))]));

  const shelterXZ = shelter?.localCenter
    ? [shelter.localCenter[0], shelter.localCenter[2]]
    : (shelter?.positionThree
      ? [shelter.positionThree[0], shelter.positionThree[2]]
      : (typeof shelter?.east_m === 'number' && typeof shelter?.north_m === 'number'
        ? [shelter.east_m, -shelter.north_m]
        : [222.89, 196.71]));
  const shelterY = Number(
    (shelter?.localCenter?.[1] ??
      shelter?.positionThree?.[1] ??
      (typeof elevationSampler === 'function' ? elevationSampler(shelterXZ[0], -shelterXZ[1]) : -13.5) ??
      -13.5).toFixed(2)
  );

  // Choose perimeter side closest to the shelter / nearest unobstructed walk node
  const sideMids = [0, 1, 2, 3].map(i => {
    const a = corners[i];
    const b = corners[(i + 1) % 4];
    const mx = (a[0] + b[0]) * 0.5;
    const mz = (a[1] + b[1]) * 0.5;
    const outDist = Math.hypot(mx - shelterXZ[0], mz - shelterXZ[1]);
    return { mx, mz, outDist };
  }).sort((a, b) => a.outDist - b.outDist);
  const doorXZ = [sideMids[0].mx, sideMids[0].mz];
  const vecOutX = doorXZ[0] - centerX;
  const vecOutZ = doorXZ[1] - centerZ;
  const normOut = Math.max(1e-6, Math.hypot(vecOutX, vecOutZ));
  const footwayXZ = [doorXZ[0] + (vecOutX / normOut) * 3.5, doorXZ[1] + (vecOutZ / normOut) * 3.5];
  const footwayY = Number(((typeof elevationSampler === 'function' ? elevationSampler(footwayXZ[0], -footwayXZ[1]) : groundY) + 0.25).toFixed(2));

  const targetShelterId = shelter?.shelterId || shelter?.id || 'SHELTER_HANYANG_STADIUM';
  const shortestSol = solveCampusWalkGraph({
    startXZ: footwayXZ,
    goalXZ: shelterXZ,
    excludeStairs: false,
    buildingOBBs,
    customWalkGraph: walkGraph,
    elevationSampler,
    targetShelterId,
    originCentroidXZ: [centerX, centerZ],
    originExclusionRadius: Math.max(26.0, obbObj.boundR + 6.0)
  });
  const stepFreeSol = solveCampusWalkGraph({
    startXZ: footwayXZ,
    goalXZ: shelterXZ,
    excludeStairs: true,
    buildingOBBs,
    customWalkGraph: walkGraph,
    elevationSampler,
    targetShelterId,
    originCentroidXZ: [centerX, centerZ],
    originExclusionRadius: Math.max(26.0, obbObj.boundR + 6.0)
  });

  const roomId = `ROOM_${defaultFloor}01`;
  const roomNodeId = `NODE_${roomId}`;
  const stairTopId = `NODE_STAIR_${defaultFloor}F_SE`;
  const stairBotId = 'NODE_STAIR_1F_SE';
  const exitNodeId = 'NODE_EXIT_1F_SE';
  const outdoorEgressId = `${buildingId}_OUTDOOR_EGRESS`;
  const targetNodeId = shortestSol.targetNodeId || stepFreeSol.targetNodeId || 'OSM_TARGET_INGRESS';

  const nodesMap = new Map();
  nodesMap.set(outdoorEgressId, { id: outdoorEgressId, name: `${name} 출구 접속점`, localPos: Object.freeze([footwayXZ[0], footwayY, footwayXZ[1]]) });
  nodesMap.set(targetNodeId, { id: targetNodeId, name: shelter?.officialName || shelter?.name || '대피소 진입점', localPos: Object.freeze([shelterXZ[0], shelterY, shelterXZ[1]]) });

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
        branch: tag === 'S' ? 'SHORTEST' : 'STEP_FREE',
        waypoints: Object.freeze((e.waypoints || []).map(wp => Object.freeze([...wp])))
      });
    });
  };
  ingest(shortestSol, 'S');
  ingest(stepFreeSol, 'F');

  const hwHalf = Math.max(8.0, Math.min(width_m, depth_m) * 0.35);
  return Object.freeze({
    packageId: `FACILITY_${buildingId}`,
    anchor: Object.freeze({ lat: anchor.lat, lon: anchor.lon, h: anchor.h ?? 42.0 }),
    buildingMetadata: Object.freeze({
      id: buildingId,
      name,
      unitNumber: unitNumber || '',
      structureType: 'OSM 건물 동적 선택 (PROVISIONAL 실내)',
      levels: Object.freeze({ aboveGround: totalLevels, underground: 0 }),
      anchorCoordinates: Object.freeze({ lat: anchor.lat, lon: anchor.lon, ellipsoidalHeightMeters: anchor.h ?? 42.0 }),
      provenance: 'PARTIALLY_VERIFIED'
    }),
    groundElevationY: groundY,
    footprintMeters: Object.freeze(footprint),
    floorHeightMeters,
    totalLevels,
    defaultFloor,
    defaultRoomId: roomId,
    defaultRoomNodeId: roomNodeId,
    defaultExitNodeId: exitNodeId,
    defaultOutdoorEgressNodeId: outdoorEgressId,
    defaultOutdoorTargetNodeId: targetNodeId,
    indoorGraphs: Object.freeze({
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
    }),
    indoorEdges: Object.freeze([
      { source: roomNodeId, target: stairTopId, distance: Number(hwHalf.toFixed(1)), hasStairs: false, isWheelchairPassable: true, edgeType: 'CORRIDOR_PROVISIONAL' },
      { source: stairTopId, target: stairBotId, distance: Number(((defaultFloor - 1) * 8.4).toFixed(1)), hasStairs: true, isWheelchairPassable: false, edgeType: 'VERTICAL_STAIR_DESCENT' },
      { source: stairBotId, target: exitNodeId, distance: 4.5, hasStairs: false, isWheelchairPassable: true, edgeType: 'CORRIDOR_TO_EXIT' }
    ]),
    connector: Object.freeze({
      connectorId: `CONN_${buildingId}`,
      source: exitNodeId,
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
      targetNodeId,
      nodes: Object.freeze([...nodesMap.values()]),
      edges: Object.freeze(edges)
    }),
    shelter: Object.freeze({
      shelterId: targetShelterId,
      officialId: shelter?.officialId || shelter?.id || 'OA-21060',
      officialCode: shelter?.officialCode || shelter?.id || 'OA-21060',
      officialName: shelter?.officialName || shelter?.name || '한양대학교 대운동장',
      ingressDistanceMeters: shelter?.ingressDistanceMeters ?? 15.0,
      localCenter: Object.freeze([shelterXZ[0], shelterY, shelterXZ[1]]),
      trackRadiusX: shelter?.trackRadiusX ?? 34.0,
      trackRadiusZ: shelter?.trackRadiusZ ?? 52.0,
      pitchHalfWidth: shelter?.pitchHalfWidth ?? 18.0,
      pitchHalfLength: shelter?.pitchHalfLength ?? 30.0,
      geometry: shelter?.geometry || Object.freeze({
        areaSqMeters: shelter?.justification?.areaSqMeters || 14850,
        capacityPeople: shelter?.justification?.capacityEstimate || 7425
      })
    }),
    routeBaselines: Object.freeze({
      PATH_SHORTEST_RAPID: Object.freeze({ name: `${name} 최단 경로`, targetLengthMeters: shortestSol.found ? shortestSol.totalDistanceMeters : 0, hasStairs: shortestSol.hasStairs, isWheelchairPassable: !shortestSol.hasStairs, provenance: 'PARTIALLY_VERIFIED' }),
      PATH_STEP_FREE_DETOUR: Object.freeze({ name: `${name} 무단차 우회 경로`, targetLengthMeters: stepFreeSol.found ? stepFreeSol.totalDistanceMeters : 0, hasStairs: false, isWheelchairPassable: true, provenance: 'PARTIALLY_VERIFIED' })
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
        position: Object.freeze([(centerX + shelterXZ[0]) * 0.5 + 240, 320, (centerZ + shelterXZ[1]) * 0.5 - 220]),
        target: Object.freeze([(centerX + shelterXZ[0]) * 0.5, (groundY + (shelter?.localCenter?.[1] ?? -13.5)) * 0.5, (centerZ + shelterXZ[1]) * 0.5]),
        near: 0.25,
        far: 6500
      }),
      BUILDING_INSPECTION: Object.freeze({ position: Object.freeze([centerX + 85, groundY + 68, centerZ + 65]), target: Object.freeze([centerX, targetY, centerZ]), near: 0.1, far: 1500 }),
      PERSONAL_LOCATION: Object.freeze({ position: Object.freeze([doorXZ[0] + 28, targetY + 20, doorXZ[1] + 24]), target: Object.freeze([centerX, targetY, centerZ]), near: 0.05, far: 1200 })
    })
  });
}
