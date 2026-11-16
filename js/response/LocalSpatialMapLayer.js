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
    fogDensity: 0.00028,
    terrainLow: 0x0c1422,
    terrainMid: 0x162235,
    terrainHigh: 0x243652,
    terrainGreen: 0x132926,
    greenOverlay: 0x17332e,
    skirt: 0x0a101b,
    water: 0x134266,
    roadMajor: 0x5c6f89,
    roadPrimary: 0x41536b,
    roadMinor: 0x27364b,
    rail: 0x64748b,
    contour: 0x263854,
    contourOpacity: 0.42,
    bldgLow: 0x73849c,
    bldgMid: 0x90a3bc,
    bldgHigh: 0xb2c3d9,
    hemiSky: 0x9eb8db,
    hemiGround: 0x202c3d,
    hemiIntensity: 1.45,
    sunColor: 0xfff3de,
    sunIntensity: 2.35,
    rimColor: 0x6b93c4,
    rimIntensity: 0.65,
    xrayColor: 0x1e293b,
    treeConifer: 0x1b3a34,
    treeBroadleaf: 0x254940,
    horizonRing: 0x334155,
    epicenterRay: 0xe2c799
  }),
  ARCHITECTURAL_DAY: Object.freeze({
    id: 'ARCHITECTURAL_DAY',
    label: '주간 레퍼런스',
    background: 0xe6ede7,
    fogColor: 0xe6ede7,
    fogDensity: 0.00022,
    terrainLow: 0xdbe3cd,
    terrainMid: 0xc2d0ae,
    terrainHigh: 0x97ab84,
    terrainGreen: 0xc5dbb1,
    greenOverlay: 0xc4deb0,
    skirt: 0xb9c4aa,
    water: 0x3d94b0,
    roadMajor: 0xf3cd6d,
    roadPrimary: 0xf4df9a,
    roadMinor: 0xf6f3eb,
    rail: 0xa6b0a0,
    contour: 0x95a48b,
    contourOpacity: 0.34,
    bldgLow: 0xd4d6d1,
    bldgMid: 0xc5c9c4,
    bldgHigh: 0xb0c2c3,
    hemiSky: 0xd8e7f2,
    hemiGround: 0xb5c4a3,
    hemiIntensity: 1.95,
    sunColor: 0xfff2d6,
    sunIntensity: 2.75,
    rimColor: 0xcce0f2,
    rimIntensity: 0.40,
    xrayColor: 0x64748b,
    treeConifer: 0x5c804e,
    treeBroadleaf: 0x739860,
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
 */
function createMergedRoadGeometry(segments, widthResolver, terrainGrid = null) {
  const positions = [];
  const indices = [];

  for (const seg of segments) {
    const cls = seg[0];
    const bridge = seg[1];
    const rawPts = seg[2];
    if (!rawPts || rawPts.length < 2) continue;

    const pts = subdividePolylineEN(rawPts, 42.0);
    const halfW = widthResolver(cls) * 0.5;
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
      const elev = bridge
        ? Math.max(h, -15.6) + 3.6
        : h + (cls === 'motorway' || cls === 'trunk' ? 0.52 : cls === 'primary' ? 0.42 : 0.30);

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
   * Pick a rendered building OBB via Three.js Raycaster for direct 3D origin selection.
   */
  pickBuildingOBBAtRaycast(raycaster) {
    if (!raycaster || !this.instancedBuildings) return null;
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
    const named = (this.pkg?.namedBuildings || []).find(b =>
      Math.hypot(b.east_m - east_m, b.north_m - north_m) < Math.max(width_m, depth_m, 35)
    );
    return {
      instanceId: idx,
      buildingId: named ? named.id : `OSM_OBB_${idx}`,
      name: named ? named.name : `도시 건축물 #${idx}`,
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
    this._buildingDataRef = null;
    this.terrainMesh = null;
    this.terrainBaseFloor = null;
    this.terrainSkirtMesh = null;
    this.coniferTreesMesh = null;
    this.broadleafTreesMesh = null;
    this.nightWindowsPoints = null;
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
          // In (east, z=-north): j increases northwards so z decreases!
          // Wind triangles for +Y upward normal: (k, k+1, k+nx+1) and (k+1, k+nx+2, k+nx+1)
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
      roughness: 0.92,
      metalness: 0.02
    }));

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
    this.rootGroup.add(group);
  }

  _buildWaterwaysAndAlluvialCaution() {
    const palette = this._getThemePalette();
    const group = new THREE.Group();
    group.name = 'HydrologyAndAlluvialCaution4km';

    this.waterPolygonMat = this._track(new THREE.MeshStandardMaterial({
      color: palette.water,
      roughness: 0.34,
      metalness: 0.16,
      side: THREE.DoubleSide
    }));
    this.waterRibbonMat = this._track(new THREE.MeshStandardMaterial({
      color: palette.water,
      roughness: 0.36,
      metalness: 0.14,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.85
    }));
    this.waterBankMat = this._track(new THREE.LineBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.35
    }));
    this.greenOverlayMat = this._track(new THREE.MeshStandardMaterial({
      color: palette.greenOverlay,
      roughness: 0.92,
      metalness: 0.0,
      side: THREE.DoubleSide
    }));

    // 1. Real Triangulated Green/Park Polygons (Seoul Forest, Salgoji, Eungbongsan)
    const greenPolys = this.pkg.terrainAndHydrology?.greenPolygons || [];
    if (greenPolys.length > 0) {
      const greenGeo = this._track(createTriangulatedPolygonsGeometry(greenPolys, false, this.pkg.terrainGrid));
      const greenMesh = new THREE.Mesh(greenGeo, this.greenOverlayMat);
      greenMesh.name = 'RealGreenParkPolygons4km';
      greenMesh.receiveShadow = true;
      group.add(greenMesh);
    }

    // 2. Real Triangulated Water Polygons (Han River, Jungnangcheon, Cheonggyecheon)
    const waterPolys = this.pkg.terrainAndHydrology?.waterPolygons || [];
    if (waterPolys.length > 0) {
      const waterGeo = this._track(createTriangulatedPolygonsGeometry(waterPolys, true, this.pkg.terrainGrid));
      const waterMesh = new THREE.Mesh(waterGeo, this.waterPolygonMat);
      waterMesh.name = 'RealWaterwayPolygons4km';
      waterMesh.receiveShadow = true;
      group.add(waterMesh);
    }

    // 3. Fallback / Named River Centerline Ribbons
    const waterways = this.pkg.terrainAndHydrology?.waterways || [];
    for (const w of waterways) {
      if (waterPolys.length === 0) {
        const ribbonGeo = this._track(createRibbonGeometry(w.pointsEN, w.widthMeters, w.elevationY, 0.22, this.pkg.terrainGrid));
        const ribbonMesh = new THREE.Mesh(ribbonGeo, this.waterRibbonMat);
        ribbonMesh.name = w.id;
        group.add(ribbonMesh);
      }

      const centerPts = w.pointsEN.map(([e, n]) => new THREE.Vector3(e, w.elevationY + 0.35, -n));
      const centerGeo = this._track(new THREE.BufferGeometry().setFromPoints(centerPts));
      const centerLine = new THREE.Line(centerGeo, this.waterBankMat);
      centerLine.name = `${w.id}_Axis`;
      group.add(centerLine);
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

      const tiers = [
        { segs: footwaySegs, mat: this.roadMats.minor, widthFn: () => 2.6, name: 'DenseRoads_Footways4km' },
        { segs: minorSegs, mat: this.roadMats.minor, widthFn: c => (c === 'secondary' ? 10.5 : 6.8), name: 'DenseRoads_Minor4km' },
        { segs: primarySegs, mat: this.roadMats.primary, widthFn: () => 17.5, name: 'DenseRoads_Primary4km' },
        { segs: majorSegs, mat: this.roadMats.major, widthFn: c => (c === 'motorway' ? 26.0 : 22.0), name: 'DenseRoads_Major4km' },
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
      const east_m = data[base + 0];
      const north_m = data[base + 1];
      const h = data[base + 5];
      const baseHex = h >= 42 ? cHigh : (h >= 16 ? cMid : cLow);
      const toneVar = 0.87 + buildingHash(east_m, north_m) * 0.22;
      color.copy(baseHex).multiplyScalar(toneVar);
      mesh.setColorAt(i, color);
    }
    if (mesh.instanceColor) {
      mesh.instanceColor.needsUpdate = true;
    }
  }

  /**
   * Shared OBB InstancedMesh builder used for both pre-built 4km core and streamed 3km chunks.
   * @private
   */
  _createOBBInstancedMesh(data, grounds, material, name) {
    const fullCount = Math.floor((data?.length || 0) / OBB_BUILDING_STRIDE);
    if (fullCount <= 0) return null;

    const mesh = new THREE.InstancedMesh(this.unitBoxGeometry, material, fullCount);
    mesh.name = name;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    const dummy = new THREE.Object3D();

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

      dummy.position.set(east_m, groundY + height_m * 0.5, -north_m);
      dummy.rotation.set(0, yaw_rad, 0);
      dummy.scale.set(width_m, height_m, depth_m);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }

    mesh.instanceMatrix.needsUpdate = true;
    this._applyBuildingInstanceColors(mesh, data);
    mesh.computeBoundingSphere();
    return mesh;
  }

  _buildContextBuildingsInstancedMesh() {
    const data = this.pkg.obbBuildingsFloat32;
    const grounds = this.pkg.obbGroundOffsets;
    const fullCount = Math.floor((data?.length || 0) / OBB_BUILDING_STRIDE);

    if (fullCount <= 0) return;

    this._buildingDataRef = data;
    this.buildingMaterial = this._track(new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.77,
      metalness: 0.06,
      transparent: false,
      opacity: 0.94,
      depthWrite: true
    }));

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
        // Skip active origin facility & primary destination clearance around open plaza
        if (this._activeOriginMeta && Math.hypot(baseE - this._activeOriginMeta.east_m, baseN - this._activeOriginMeta.north_m) < 42) continue;
        const primaryShelter = (this.pkg.sheltersAndFacilities || [])[0];
        if (primaryShelter && Math.hypot(baseE - primaryShelter.east_m, baseN - primaryShelter.north_m) < 60) continue;

        const samples = 2;
        for (let s = 0; s < samples; s++) {
          const e = baseE + (rand() - 0.5) * 28.0;
          const n = baseN + (rand() - 0.5) * 28.0;
          const h = this._sampleTerrainHeight(e, n);
          if (h < -15.2) continue;
          const sc = 4.5 + rand() * 5.2;
          const yaw = rand() * Math.PI * 2;
          if ((i + j + s) % 3 === 0) {
            conifers.push([e, h, -n, sc, yaw]);
          } else {
            broadleaf.push([e, h, -n, sc, yaw]);
          }
        }
      }
    }

    const dummy = new THREE.Object3D();
    if (conifers.length > 0) {
      const conGeo = this._track(new THREE.ConeGeometry(0.65, 1.85, 5));
      const conMat = this._track(new THREE.MeshStandardMaterial({
        color: palette.treeConifer,
        roughness: 0.92,
        metalness: 0.0
      }));
      this.coniferTreesMesh = new THREE.InstancedMesh(conGeo, conMat, conifers.length);
      this.coniferTreesMesh.name = 'LocalConiferTrees4km';
      conifers.forEach(([x, y, z, s, yaw], idx) => {
        dummy.position.set(x, y + s * 0.88, z);
        dummy.rotation.set(0, yaw, 0);
        dummy.scale.set(s, s, s);
        dummy.updateMatrix();
        this.coniferTreesMesh.setMatrixAt(idx, dummy.matrix);
      });
      this.coniferTreesMesh.instanceMatrix.needsUpdate = true;
      this.coniferTreesMesh.castShadow = true;
      this.rootGroup.add(this.coniferTreesMesh);
    }

    if (broadleaf.length > 0) {
      const broadGeo = this._track(new THREE.IcosahedronGeometry(0.85, 0));
      const broadMat = this._track(new THREE.MeshStandardMaterial({
        color: palette.treeBroadleaf,
        roughness: 0.92,
        metalness: 0.0
      }));
      this.broadleafTreesMesh = new THREE.InstancedMesh(broadGeo, broadMat, broadleaf.length);
      this.broadleafTreesMesh.name = 'LocalBroadleafTrees4km';
      broadleaf.forEach(([x, y, z, s, yaw], idx) => {
        dummy.position.set(x, y + s * 0.65, z);
        dummy.rotation.set(0, yaw, 0);
        dummy.scale.set(s * 1.15, s * 0.85, s * 1.05);
        dummy.updateMatrix();
        this.broadleafTreesMesh.setMatrixAt(idx, dummy.matrix);
      });
      this.broadleafTreesMesh.instanceMatrix.needsUpdate = true;
      this.broadleafTreesMesh.castShadow = true;
      this.rootGroup.add(this.broadleafTreesMesh);
    }
  }

  _buildNightWindows() {
    const data = this.pkg.obbBuildingsFloat32;
    const grounds = this.pkg.obbGroundOffsets;
    const fullCount = Math.floor((data?.length || 0) / OBB_BUILDING_STRIDE);
    if (fullCount <= 0) return;

    const positions = [];
    const colors = [];
    let seed = 4242;
    const rand = () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed / 4294967296;
    };

    const warmTone = new THREE.Color(0xe8d5b0);
    const coolTone = new THREE.Color(0xb8d4e8);

    for (let i = 0; i < fullCount; i++) {
      const base = i * OBB_BUILDING_STRIDE;
      const e = data[base + 0];
      const n = data[base + 1];
      const w = data[base + 2];
      const d = data[base + 3];
      const yaw = data[base + 4];
      const h = data[base + 5];
      if (h < 24.0 || rand() < 0.35) continue;

      const groundY = grounds && i < grounds.length ? grounds[i] : this._sampleTerrainHeight(e, n);
      const dots = Math.min(5, Math.ceil(h / 28));
      const cosY = Math.cos(yaw);
      const sinY = Math.sin(yaw);

      for (let k = 0; k < dots; k++) {
        const yPos = groundY + (0.28 + rand() * 0.64) * h;
        const side = rand() > 0.5 ? 1 : -1;
        const lx = side * w * 0.505;
        const lz = (rand() - 0.5) * d * 0.72;
        const wx = e + lx * cosY + lz * sinY;
        const wz = -n - lx * sinY + lz * cosY;
        positions.push(wx, yPos, wz);
        const c = rand() > 0.25 ? warmTone : coolTone;
        colors.push(c.r, c.g, c.b);
      }
    }

    if (positions.length === 0) return;
    const geo = this._track(new THREE.BufferGeometry());
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    const mat = this._track(new THREE.PointsMaterial({
      size: 1.45,
      sizeAttenuation: false,
      vertexColors: true,
      transparent: true,
      opacity: 0.36,
      depthWrite: false
    }));
    this.nightWindowsPoints = new THREE.Points(geo, mat);
    this.nightWindowsPoints.name = 'NocturnalWindowScaleFlecks4km';
    this.rootGroup.add(this.nightWindowsPoints);
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
    }
    this._epicenterWaveArcs = [];

    if (!seismicCtx || !Number.isFinite(seismicCtx.bearingDeg)) return;

    const palette = this._getThemePalette();
    const rad = (seismicCtx.bearingDeg * Math.PI) / 180.0;
    // Bearing: 0 deg = North (-Z), 90 deg = East (+X)
    const dirX = Math.sin(rad);
    const dirZ = -Math.cos(rad);
    const ox = this._activeOriginMeta?.east_m ?? 0;
    const oz = -(this._activeOriginMeta?.north_m ?? 0);

    if (!this._epicenterRayMat) {
      this._epicenterRayMat = this._track(new THREE.LineDashedMaterial({
        color: palette.epicenterRay,
        dashSize: 28.0,
        gapSize: 18.0,
        transparent: true,
        opacity: 0.72
      }));
    } else {
      this._epicenterRayMat.color.setHex(palette.epicenterRay);
    }

    // Subdivided sightline along outer approach zone (r = 480m -> 2210m) so campus stays uncluttered
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

    // Subtle concentric wavefront horizon arcs centered toward incoming azimuth
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
    this.state.theme = key;
    const palette = this._getThemePalette();

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
    if (this.nightWindowsPoints) {
      this.nightWindowsPoints.visible = key === 'MONOLITH_NIGHT' && !this.state.xRayEnabled;
    }

    if (this.roadMats.major) this.roadMats.major.color.setHex(palette.roadMajor);
    if (this.roadMats.primary) this.roadMats.primary.color.setHex(palette.roadPrimary);
    if (this.roadMats.minor) this.roadMats.minor.color.setHex(palette.roadMinor);
    if (this.roadMats.rail) this.roadMats.rail.color.setHex(palette.rail);

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
        ? '접근 불가 후보 · '
        : isConditional
          ? (isPrimary ? '개활 대피 후보(미확정) · ' : '후보 · ')
          : (isPrimary ? '대피소 · ' : '');
      const capText = s.justification?.capacityEstimate
        ? `약 ${Number(s.justification.capacityEstimate).toLocaleString()}명(추정)`
        : '';
      const defaultSub = isConditional
        ? `조건부 후보 · 개방 현장 확인 필요${capText ? ` · ${capText}` : ''}`
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
    this.state.xRayOpacity = enabled ? opacity : 0.94;
    const palette = this._getThemePalette();

    if (this.buildingMaterial) {
      this.buildingMaterial.transparent = Boolean(enabled);
      this.buildingMaterial.opacity = this.state.xRayOpacity;
      this.buildingMaterial.depthWrite = !enabled;
      this.buildingMaterial.color.setHex(enabled ? palette.xrayColor : 0xffffff);
      this.buildingMaterial.needsUpdate = true;
    }
    if (this.nightWindowsPoints) {
      this.nightWindowsPoints.visible = this.state.theme === 'MONOLITH_NIGHT' && !enabled;
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
        el.innerHTML = item.subtitle
          ? `<span class="sml-title">${item.title}</span><span class="sml-sub">${item.subtitle}</span>`
          : `<span class="sml-title">${item.title}</span>`;
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
    return {
      packageId: this.pkg.metadata?.packageId || 'UNKNOWN',
      theme: this.state.theme,
      fullCount: counts.fullCount,
      overviewCount: counts.overviewCount,
      activeInstanceCount: this.instancedBuildings ? this.instancedBuildings.count : 0,
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
