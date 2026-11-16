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
  OBB_BUILDING_STRIDE
} from './HanyangLocalSpatialData.js';
import { CAMERA_STAGES } from './GlobalLocalCameraTransition.js';
import { VERIFICATION_STATUS } from './ResponseDomainTypes.js';

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

/**
 * Convert an array of [east_m, north_m] pairs into a flat Three.js BufferGeometry ribbon
 * oriented in the X=East, Y=elevation, Z=-North horizontal plane.
 */
function createRibbonGeometry(pointsEN, widthMeters, elevationY) {
  if (!pointsEN || pointsEN.length < 2) return new THREE.BufferGeometry();

  const halfW = widthMeters * 0.5;
  const positions = [];
  const indices = [];

  for (let i = 0; i < pointsEN.length; i++) {
    const pPrev = pointsEN[Math.max(0, i - 1)];
    const pNext = pointsEN[Math.min(pointsEN.length - 1, i + 1)];
    const pCur = pointsEN[i];

    // Direction in (X=East, Z=-North)
    let dx = pNext[0] - pPrev[0];
    let dz = -(pNext[1] - pPrev[1]);
    const len = Math.hypot(dx, dz) || 1.0;
    dx /= len;
    dz /= len;

    // Perpendicular normal in XZ plane
    const nx = -dz;
    const nz = dx;

    const cx = pCur[0];
    const cz = -pCur[1];

    positions.push(
      cx + nx * halfW, elevationY, cz + nz * halfW,
      cx - nx * halfW, elevationY, cz - nz * halfW
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

    this.state = {
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
    this.labelAnchors = [];
    this._labelDomMap = new Map();

    this._buildTerrainContours();
    this._buildWaterwaysAndAlluvialCaution();
    this._buildRoadNetwork();
    this._buildContextBuildingsInstancedMesh();
    this._buildSheltersAndFacilities();
    this._buildLabelAnchors();

    if (this.state.ecoMode) {
      this.setEcoMode(true);
    }

    if (this.scene) {
      this.scene.add(this.rootGroup);
    }
  }

  _track(resource) {
    if (resource) this.disposables.push(resource);
    return resource;
  }

  _buildTerrainContours() {
    const group = new THREE.Group();
    group.name = 'HillslopeContours4km';
    const mat = this._track(new THREE.LineBasicMaterial({
      color: 0x1e293b,
      transparent: true,
      opacity: 0.55
    }));

    const contours = this.pkg.terrainAndHydrology?.hillslopeContours || [];
    for (const c of contours) {
      const pts = c.pointsENU.map(([e, n]) => new THREE.Vector3(e, c.relativeY, -n));
      const geo = this._track(new THREE.BufferGeometry().setFromPoints(pts));
      const line = new THREE.Line(geo, mat);
      line.name = c.id;
      group.add(line);
    }
    this.rootGroup.add(group);
  }

  _buildWaterwaysAndAlluvialCaution() {
    const group = new THREE.Group();
    group.name = 'HydrologyAndAlluvialCaution4km';

    const waterMat = this._track(new THREE.MeshBasicMaterial({
      color: 0x091628,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.88
    }));
    const bankMat = this._track(new THREE.LineBasicMaterial({
      color: 0x1e3a5f,
      transparent: true,
      opacity: 0.55
    }));

    const waterways = this.pkg.terrainAndHydrology?.waterways || [];
    for (const w of waterways) {
      const ribbonGeo = this._track(createRibbonGeometry(w.pointsEN, w.widthMeters, w.elevationY));
      const ribbonMesh = new THREE.Mesh(ribbonGeo, waterMat);
      ribbonMesh.name = w.id;
      group.add(ribbonMesh);

      const centerPts = w.pointsEN.map(([e, n]) => new THREE.Vector3(e, w.elevationY + 0.25, -n));
      const centerGeo = this._track(new THREE.BufferGeometry().setFromPoints(centerPts));
      const centerLine = new THREE.Line(centerGeo, bankMat);
      group.add(centerLine);
    }

    // PROVISIONAL Alluvial Basin Caution Zone (strictly dashed subtle slate — zero rainbow heatmap)
    const caution = this.pkg.terrainAndHydrology?.alluvialCautionZone;
    if (caution && Array.isArray(caution.polygonEN)) {
      const pts = caution.polygonEN.map(([e, n]) => new THREE.Vector3(e, caution.elevationY, -n));
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
    const group = new THREE.Group();
    group.name = 'LocalRoadNetwork4km';

    const arterialMat = this._track(new THREE.MeshBasicMaterial({
      color: 0x1e293b,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.75
    }));
    const collectorMat = this._track(new THREE.MeshBasicMaterial({
      color: 0x151e2e,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.65
    }));

    const roads = this.pkg.roadNetwork || [];
    for (const r of roads) {
      const mat = r.hierarchy === 'ARTERIAL' ? arterialMat : collectorMat;
      const geo = this._track(createRibbonGeometry(r.pointsEN, r.widthMeters, r.elevationY));
      const mesh = new THREE.Mesh(geo, mat);
      mesh.name = r.id;
      group.add(mesh);
    }

    this.rootGroup.add(group);
  }

  _buildContextBuildingsInstancedMesh() {
    const data = this.pkg.obbBuildingsFloat32;
    const grounds = this.pkg.obbGroundOffsets;
    const fullCount = Math.floor((data?.length || 0) / OBB_BUILDING_STRIDE);

    if (fullCount <= 0) return;

    const unitBox = this._track(new THREE.BoxGeometry(1, 1, 1));
    this.buildingMaterial = this._track(new THREE.MeshBasicMaterial({
      color: 0x111827,
      transparent: false,
      opacity: 0.94,
      depthWrite: true
    }));

    this.instancedBuildings = new THREE.InstancedMesh(unitBox, this.buildingMaterial, fullCount);
    this.instancedBuildings.name = 'SeongdongContextBuildingsOBB';

    const dummy = new THREE.Object3D();
    const roofEdgeMat = this._track(new THREE.EdgesGeometry(unitBox));
    void roofEdgeMat;

    for (let i = 0; i < fullCount; i++) {
      const base = i * OBB_BUILDING_STRIDE;
      const east_m = data[base + 0];
      const north_m = data[base + 1];
      const width_m = data[base + 2];
      const depth_m = data[base + 3];
      const yaw_rad = data[base + 4];
      const height_m = data[base + 5];
      const groundY = (grounds && i < grounds.length) ? grounds[i] : -12.0;

      dummy.position.set(east_m, groundY + height_m * 0.5, -north_m);
      dummy.rotation.set(0, yaw_rad, 0);
      dummy.scale.set(width_m, height_m, depth_m);
      dummy.updateMatrix();
      this.instancedBuildings.setMatrixAt(i, dummy.matrix);
    }

    this.instancedBuildings.instanceMatrix.needsUpdate = true;
    this.rootGroup.add(this.instancedBuildings);
  }

  _buildSheltersAndFacilities() {
    const group = new THREE.Group();
    group.name = 'OfficialSheltersAndFacilities';

    const ringGeo = this._track(new THREE.RingGeometry(14.0, 17.5, 32));
    ringGeo.rotateX(-Math.PI / 2);

    const shelters = this.pkg.sheltersAndFacilities || [];
    for (const s of shelters) {
      const isPrimary = s.category === 'PRIMARY_SHELTER';
      const isMedical = s.category === 'MEDICAL_CENTER';
      const color = isPrimary ? 0xe2e8f0 : (isMedical ? 0x94a3b8 : 0x64748b);

      const sGroup = new THREE.Group();
      sGroup.name = `FacilityPin_${s.id}`;
      sGroup.position.set(s.positionThree[0], s.positionThree[1], s.positionThree[2]);

      const ringMat = this._track(new THREE.MeshBasicMaterial({
        color,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: isPrimary ? 0.65 : 0.45
      }));
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.position.y = 0.25;
      sGroup.add(ring);

      // Subtle vertical architectural plumb line (non-glowing, thin slate/ivory line)
      const lineGeo = this._track(new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, 0.25, 0),
        new THREE.Vector3(0, isPrimary ? 24.0 : 18.0, 0)
      ]));
      const lineMat = this._track(new THREE.LineBasicMaterial({
        color,
        transparent: true,
        opacity: isPrimary ? 0.68 : 0.48
      }));
      sGroup.add(new THREE.Line(lineGeo, lineMat));

      group.add(sGroup);
    }

    this.rootGroup.add(group);
  }

  _buildLabelAnchors() {
    this.labelAnchors = [];

    // 1. Target Building 212
    const b212 = (this.pkg.namedBuildings || []).find(b => b.isTargetBuilding);
    if (b212) {
      this.labelAnchors.push({
        id: b212.id,
        title: b212.name,
        subtitle: '선택 건물 · 실내 3F PROVISIONAL',
        category: 'TARGET_BUILDING',
        provisional: true,
        priority: 100,
        worldPos: new THREE.Vector3(b212.east_m, b212.height_m + 6.0, -b212.north_m)
      });
    }

    // 2. Shelters & Emergency Facilities
    for (const s of (this.pkg.sheltersAndFacilities || [])) {
      this.labelAnchors.push({
        id: s.id,
        title: s.name,
        subtitle: s.subtitle,
        category: s.category,
        provisional: s.provenance === VERIFICATION_STATUS.PROVISIONAL,
        priority: s.priority || 75,
        worldPos: new THREE.Vector3(s.positionThree[0], s.positionThree[1] + 22.0, s.positionThree[2])
      });
    }

    // 3. Key Named Campus/Urban Context Landmarks
    for (const b of (this.pkg.namedBuildings || [])) {
      if (b.isTargetBuilding || b.id === 'CTX_HYUHOSP_MAIN') continue;
      this.labelAnchors.push({
        id: b.id,
        title: b.name,
        subtitle: b.category === 'CAMPUS_CONTEXT' ? '캠퍼스 주변 맥락' : '성동 권역 주요 시설',
        category: b.category,
        provisional: false,
        priority: b.priority || 55,
        worldPos: new THREE.Vector3(b.east_m, b.groundY_m + b.height_m + 5.0, -b.north_m)
      });
    }

    // 4. Alluvial Basin Caution Zone (explicit PROVISIONAL marker)
    const alluvial = this.pkg.terrainAndHydrology?.alluvialCautionZone;
    if (alluvial) {
      this.labelAnchors.push({
        id: alluvial.id,
        title: '살곶이·중랑천 충적 저지대',
        subtitle: '지반 증폭 주의 · PROVISIONAL',
        category: 'HAZARD_CONTEXT',
        provisional: true,
        priority: 62,
        worldPos: new THREE.Vector3(240.0, alluvial.elevationY + 8.0, 680.0)
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
    return this.state.lodMode;
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

    if (this.buildingMaterial) {
      this.buildingMaterial.transparent = Boolean(enabled);
      this.buildingMaterial.opacity = this.state.xRayOpacity;
      this.buildingMaterial.depthWrite = !enabled;
      this.buildingMaterial.color.setHex(enabled ? 0x0f172a : 0x111827);
      this.buildingMaterial.needsUpdate = true;
    }
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
    const avoidSelector = options.avoidSelector || '#header-overlay, #exhibition-bar, #guidance-container';
    const obstacleRects = [];
    if (typeof document !== 'undefined' && avoidSelector) {
      document.querySelectorAll(avoidSelector).forEach((el) => {
        const r = el.getBoundingClientRect();
        if (r.width > 0 && r.height > 0) {
          obstacleRects.push({ left: r.left, top: r.top, right: r.right, bottom: r.bottom });
        }
      });
    }

    const vec = new THREE.Vector3();
    const candidates = [];

    for (const anchor of this.labelAnchors) {
      vec.copy(anchor.worldPos).project(camera);
      const inFront = vec.z >= -1.0 && vec.z <= 1.0;
      const screenX = (vec.x * 0.5 + 0.5) * width;
      const screenY = (-vec.y * 0.5 + 0.5) * height;
      const estW = Math.max(110, Math.min(200, anchor.title.length * 10 + 36));
      const estH = 34;

      candidates.push({
        ...anchor,
        screenX,
        screenY,
        width: estW,
        height: estH,
        inFront
      });
    }

    const result = solveLabelCollisions2D(candidates, obstacleRects, { width, height }, 8);
    const visibleSet = new Set(result.visibleLabels.map(v => v.id));

    for (const item of candidates) {
      let el = this._labelDomMap.get(item.id);
      if (!el && typeof document !== 'undefined') {
        el = document.createElement('div');
        el.className = `spatial-map-label cat-${item.category.toLowerCase()}${item.provisional ? ' is-provisional' : ''}`;
        el.dataset.labelId = item.id;
        el.innerHTML = `<span class="sml-title">${item.title}</span><span class="sml-sub">${item.subtitle}</span>`;
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

  getLayerDiagnostics() {
    const counts = this.pkg.obbLodCounts || { overviewCount: 0, fullCount: 0 };
    return {
      packageId: this.pkg.metadata?.packageId || 'UNKNOWN',
      fullCount: counts.fullCount,
      overviewCount: counts.overviewCount,
      activeInstanceCount: this.instancedBuildings ? this.instancedBuildings.count : 0,
      lodMode: this.state.lodMode,
      xRayEnabled: this.state.xRayEnabled,
      xRayOpacity: this.state.xRayOpacity,
      ecoMode: this.state.ecoMode,
      currentStage: this.state.currentStage,
      visibleLabelCount: this.state.visibleLabelCount,
      hiddenLabelCount: this.state.hiddenLabelCount,
      shelterCount: (this.pkg.sheltersAndFacilities || []).length,
      roadCount: (this.pkg.roadNetwork || []).length,
      waterwayCount: (this.pkg.terrainAndHydrology?.waterways || []).length
    };
  }

  dispose() {
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
