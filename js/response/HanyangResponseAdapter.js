// ============================================================================
// SEISMOLIVE v4.0 — Hanyang Single-Building Response Spatial Adapter
// File: js/response/HanyangResponseAdapter.js
//
// Minimal Three.js architectural visualizer bridging physical WGS84/ENU
// coordinates to visual presentation space without altering real distances.
//
// Key Architectural Directives:
//   - Physical Local Coordinates (meters) strictly preserved for routing.
//   - Visual Local Coordinates (scaled for legibility) strictly separated.
//   - Selected floor (3F) accented with ivory lines; unselected floors ghosted.
//   - Nocturnal Monolith aesthetic (deep basalt/black, no game VFX).
//   - Indoor layouts and door hardware strictly tagged as PROVISIONAL.
// ============================================================================

import * as THREE from '../lib/three.module.js';
import {
  LocalTangentAnchor,
  HANYANG_BLDG212_ANCHOR
} from './LocalTangentAnchor.js';
import {
  DEFAULT_HANYANG_FACILITY_PACKAGE,
  BLDG_212_OSM_FOOTPRINT_METERS,
  VERIFICATION_STATUS
} from './HanyangBuildingData.js';
import { PedestrianRoutingEngine } from './PedestrianRoutingEngine.js';

export { BLDG_212_OSM_FOOTPRINT_METERS };

export const VISUAL_THEME = Object.freeze({
  BACKGROUND: 0x020408,
  SELECTED_FLOOR_LINE: 0xf8fafc,       // Pure crisp ivory/white line
  SELECTED_FLOOR_FILL: 0x0f172a,       // Deep basalt slate
  UNSELECTED_FLOOR_LINE: 0x334155,     // Muted charcoal wireframe
  UNSELECTED_FLOOR_FILL: 0x05080f,     // Faded obsidian
  STAIR_CORE_WIRE: 0x94a3b8,           // Cool zinc
  CONNECTOR_WIRE: 0xe2e8f0,            // Stark ivory
  PATH_SHORTEST: 0xffffff,             // Stark white line
  PATH_STAIRS_HAZARD: 0xf59e0b,        // Subdued amber caution for stairs
  PATH_STEP_FREE: 0x64748b,            // Subtle slate detour line
  STADIUM_TRACK: 0x475569              // Muted athletics perimeter
});

export class HanyangResponseAdapter {
  /**
   * Supports both `new HanyangResponseAdapter(options)` and `new HanyangResponseAdapter(scene, options)`.
   * @param {Object|THREE.Scene} [arg1]
   * @param {Object} [arg2]
   */
  constructor(arg1 = {}, arg2 = null) {
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
    this.facility = options.facilityPackage || DEFAULT_HANYANG_FACILITY_PACKAGE;
    this.anchor = new LocalTangentAnchor(this.facility.anchor || HANYANG_BLDG212_ANCHOR);
    this.useRealMapRouting = Boolean(options.useRealMapRouting);
    this.buildingOBBs = options.buildingOBBs || null;
    this.customWalkGraph = options.customWalkGraph || null;
    this.elevationSampler = options.elevationSampler || null;
    this.router = options.router || new PedestrianRoutingEngine({
      facilityPackage: this.facility,
      useRealMapRouting: this.useRealMapRouting,
      buildingOBBs: this.buildingOBBs,
      customWalkGraph: this.customWalkGraph,
      elevationSampler: this.elevationSampler
    });

    const bldgMeta = this.facility.buildingMetadata || {};

    // Explicit Separation: Physical vs Visual Coordinate System
    this.config = {
      visualScale: options.visualScale ?? options.scale ?? 1.0,
      worldUnitScale: 1.0e-5, // 1 Three.js unit = 100km in global continuous Earth
      floorHeightMeters: options.floorHeightMeters ?? this.facility.floorHeightMeters ?? 3.6,
      totalLevels: options.totalLevels ?? bldgMeta.levels?.aboveGround ?? this.facility.totalLevels ?? 5,
      selectedFloor: options.selectedFloor ?? this.facility.defaultFloor ?? 3,
      activeRoute: 'ALL' // 'ALL' | 'SHORTEST' | 'STEP_FREE' | 'NONE'
    };

    // Root Group anchored in Three.js Local Space
    this.rootGroup = new THREE.Group();
    const bldgId = bldgMeta.id || 'FACILITY';
    this.rootGroup.name = bldgId === 'BLDG_212_ENG1' ? 'HanyangBldg212_ResponseRoot' : `${bldgId}_ResponseRoot`;

    this.floorGroups = new Map();
    this.routePolylines = { SHORTEST: [], STEP_FREE: [] };
    this.pathGroup = new THREE.Group();
    this.pathGroup.name = 'PedestrianPathsGroup';
    this.shelterGroup = new THREE.Group();
    this.shelterGroup.name = 'ShelterGroup';

    this.rootGroup.add(this.pathGroup);
    this.rootGroup.add(this.shelterGroup);

    this.disposables = [];
    this.routeRibbonMaterials = [];
    this.routeProgressT = 0.0;

    this.buildBuildingStructure();
    this.buildPedestrianPaths();
    this.buildShelterRepresentation();
    this.highlightFloor(this.config.selectedFloor);

    if (this.config.visualScale !== 1.0) {
      this.rootGroup.scale.set(this.config.visualScale, this.config.visualScale, this.config.visualScale);
    }

    if (this.scene) {
      this.scene.add(this.rootGroup);
    }
  }

  // --------------------------------------------------------------------------
  // 1. COORDINATE SEPARATION ENGINE (Physical ENU <-> Visual Local)
  // --------------------------------------------------------------------------

  /**
   * Transform Physical Metric Coordinate [x, y, z] to Visual Local Coordinate.
   *
   * @param {[number, number, number]|THREE.Vector3} physicalPos - Meters in ENU (Three.js orientation)
   * @returns {[number, number, number]} Visual local coordinates
   */
  physicalToVisual(physicalPos) {
    const x = Array.isArray(physicalPos) ? physicalPos[0] : physicalPos.x;
    const y = Array.isArray(physicalPos) ? physicalPos[1] : physicalPos.y;
    const z = Array.isArray(physicalPos) ? physicalPos[2] : physicalPos.z;

    const s = this.config.visualScale;
    return [x * s, y * s, z * s];
  }

  /**
   * Transform Visual Local Coordinate back to Physical Metric Coordinate.
   *
   * @param {[number, number, number]|THREE.Vector3} visualPos
   * @returns {[number, number, number]} Physical meters in ENU
   */
  visualToPhysical(visualPos) {
    const x = Array.isArray(visualPos) ? visualPos[0] : visualPos.x;
    const y = Array.isArray(visualPos) ? visualPos[1] : visualPos.y;
    const z = Array.isArray(visualPos) ? visualPos[2] : visualPos.z;

    const s = this.config.visualScale;
    if (s <= 0) throw new Error('[HanyangResponseAdapter] Invalid visual scale.');
    return [x / s, y / s, z / s];
  }

  /**
   * Calculate Real Physical Metric Distance between two points, regardless of visual scale.
   *
   * @param {[number, number, number]} posA - Visual or physical vector
   * @param {[number, number, number]} posB - Visual or physical vector
   * @param {boolean} [isInputVisual=false] - Whether input coordinates are visual
   * @returns {number} Distance in exact real-world meters
   */
  computePhysicalDistance(posA, posB, isInputVisual = false) {
    const pA = isInputVisual ? this.visualToPhysical(posA) : posA;
    const pB = isInputVisual ? this.visualToPhysical(posB) : posB;

    const dx = pB[0] - pA[0];
    const dy = pB[1] - pA[1];
    const dz = pB[2] - pA[2];
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }

  /**
   * Set visual magnification scale. Automatically updates root group transform.
   * Note: Routing algorithms and physical distances remain strictly invariant.
   */
  setVisualScale(newScale) {
    if (newScale <= 0) return;
    this.config.visualScale = newScale;
    // Re-render geometry or update visual scale group
    this.rootGroup.scale.set(newScale, newScale, newScale);
  }

  // --------------------------------------------------------------------------
  // 2. PROCEDURAL ARCHITECTURAL WIREFRAME (Nocturnal Monolith Aesthetic)
  // --------------------------------------------------------------------------

  buildBuildingStructure() {
    const footprint = this.facility.footprintMeters || BLDG_212_OSM_FOOTPRINT_METERS;
    const hFloor = this.config.floorHeightMeters;
    const baseY = this.facility.groundElevationY ?? 0.0;
    const interiorTargetFloor = this.facility.hasIndoorData === false ? null : (this.facility.defaultFloor ?? 3);

    for (let level = 1; level <= this.config.totalLevels; level++) {
      const floorGroup = new THREE.Group();
      floorGroup.name = `Floor_${level}F`;
      const yBottom = baseY + (level - 1) * hFloor;
      const yTop = baseY + level * hFloor;

      // Slab perimeter lines
      const slabPoints = [];
      for (let i = 0; i < footprint.length - 1; i++) {
        const p1 = footprint[i];
        const p2 = footprint[i + 1];
        slabPoints.push(new THREE.Vector3(p1[0], yBottom, p1[1]));
        slabPoints.push(new THREE.Vector3(p2[0], yBottom, p2[1]));
      }

      const slabGeo = new THREE.BufferGeometry().setFromPoints(slabPoints);
      const slabMat = new THREE.LineBasicMaterial({
        color: VISUAL_THEME.UNSELECTED_FLOOR_LINE,
        transparent: true,
        opacity: 0.35,
        linewidth: 1
      });
      const slabLines = new THREE.LineSegments(slabGeo, slabMat);
      slabLines.name = `SlabLines_${level}F`;
      floorGroup.add(slabLines);

      // Floor slab plate (semi-transparent basalt fill)
      const shape = new THREE.Shape();
      shape.moveTo(footprint[0][0], footprint[0][1]);
      for (let i = 1; i < footprint.length; i++) {
        shape.lineTo(footprint[i][0], footprint[i][1]);
      }
      const plateGeo = new THREE.ShapeGeometry(shape);
      plateGeo.rotateX(Math.PI / 2); // Place on XZ plane
      plateGeo.translate(0, yBottom + 0.02, 0);

      const plateMat = new THREE.MeshBasicMaterial({
        color: VISUAL_THEME.UNSELECTED_FLOOR_FILL,
        transparent: true,
        opacity: 0.3,
        side: THREE.DoubleSide,
        depthWrite: false
      });
      const plateMesh = new THREE.Mesh(plateGeo, plateMat);
      plateMesh.name = `PlateMesh_${level}F`;
      floorGroup.add(plateMesh);

      // Vertical structural corner columns
      const colPoints = [];
      for (let i = 0; i < footprint.length - 1; i++) {
        const p = footprint[i];
        colPoints.push(new THREE.Vector3(p[0], yBottom, p[1]));
        colPoints.push(new THREE.Vector3(p[0], yTop, p[1]));
      }
      const colGeo = new THREE.BufferGeometry().setFromPoints(colPoints);
      const colMat = new THREE.LineBasicMaterial({
        color: VISUAL_THEME.UNSELECTED_FLOOR_LINE,
        transparent: true,
        opacity: 0.25
      });
      const colLines = new THREE.LineSegments(colGeo, colMat);
      colLines.name = `Columns_${level}F`;
      floorGroup.add(colLines);

      // Add schematic partitions on default target floor (PROVISIONAL)
      if (level === interiorTargetFloor) {
        const interiorGroup = this.build3FProvisionalInterior(yBottom, level);
        floorGroup.add(interiorGroup);
      }

      this.disposables.push(slabGeo, slabMat, plateGeo, plateMat, colGeo, colMat);
      this.floorGroups.set(level, floorGroup);
      this.rootGroup.add(floorGroup);
    }

    // Add Roof Slab
    const yRoof = baseY + this.config.totalLevels * hFloor;
    const roofPoints = [];
    for (let i = 0; i < footprint.length - 1; i++) {
      const p1 = footprint[i];
      const p2 = footprint[i + 1];
      roofPoints.push(new THREE.Vector3(p1[0], yRoof, p1[1]));
      roofPoints.push(new THREE.Vector3(p2[0], yRoof, p2[1]));
    }
    const roofGeo = new THREE.BufferGeometry().setFromPoints(roofPoints);
    const roofMat = new THREE.LineBasicMaterial({
      color: VISUAL_THEME.UNSELECTED_FLOOR_LINE,
      transparent: true,
      opacity: 0.4
    });
    this.rootGroup.add(new THREE.LineSegments(roofGeo, roofMat));
    this.disposables.push(roofGeo, roofMat);

    // Add Vertical Stair Core (Zinc wireframe)
    this.buildStairCoreWireframe();

    // Add Explicit Connector Egress Portal
    this.build1FEgressConnector();
  }

  /**
   * Build Target-Floor Schematic Classrooms & Corridors (Tagged strictly as PROVISIONAL).
   */
  build3FProvisionalInterior(yLevel, level = 3) {
    const interiorGroup = new THREE.Group();
    const names = this.facility.routeDisplayNames || {};
    interiorGroup.name = names.interiorGroupName || `Interior_${level}F_Provisional`;

    const floorGraph = this.facility.indoorGraphs?.[level];
    const wallLines = [];

    if (Array.isArray(floorGraph?.wallSegments) && floorGraph.wallSegments.length > 0) {
      floorGraph.wallSegments.forEach(([a, b]) => {
        wallLines.push(new THREE.Vector3(a[0], yLevel, a[1] ?? a[2] ?? 0));
        wallLines.push(new THREE.Vector3(b[0], yLevel, b[1] ?? b[2] ?? 0));
      });
    } else if (this.facility.packageId === 'FACILITY_HANYANG_BLDG_212' || this.facility.buildingMetadata?.id === 'BLDG_212_ENG1') {
      // Hanyang Bldg 212 3F Provisional Classroom Partitions
      wallLines.push(new THREE.Vector3(25.0, yLevel, -90.0), new THREE.Vector3(70.0, yLevel, -46.0));
      wallLines.push(new THREE.Vector3(25.0, yLevel, -90.0), new THREE.Vector3(38.0, yLevel, -78.0));
      wallLines.push(new THREE.Vector3(38.0, yLevel, -78.0), new THREE.Vector3(50.0, yLevel, -90.0));
      wallLines.push(new THREE.Vector3(42.0, yLevel, -74.0), new THREE.Vector3(56.0, yLevel, -62.0));
      wallLines.push(new THREE.Vector3(58.0, yLevel, -60.0), new THREE.Vector3(70.0, yLevel, -48.0));
    } else if (Array.isArray(floorGraph?.rooms) && floorGraph.rooms.length > 0) {
      // Generic schematic room frames from centerLocalPos for arbitrary facilities
      floorGraph.rooms.forEach(r => {
        const cx = r.centerLocalPos?.[0] ?? 0;
        const cz = r.centerLocalPos?.[2] ?? 0;
        const hw = 4.0;
        const hd = 3.0;
        wallLines.push(
          new THREE.Vector3(cx - hw, yLevel, cz - hd), new THREE.Vector3(cx + hw, yLevel, cz - hd),
          new THREE.Vector3(cx + hw, yLevel, cz - hd), new THREE.Vector3(cx + hw, yLevel, cz + hd),
          new THREE.Vector3(cx + hw, yLevel, cz + hd), new THREE.Vector3(cx - hw, yLevel, cz + hd),
          new THREE.Vector3(cx - hw, yLevel, cz + hd), new THREE.Vector3(cx - hw, yLevel, cz - hd)
        );
      });
    }

    if (wallLines.length >= 2) {
      const wallGeo = new THREE.BufferGeometry().setFromPoints(wallLines);
      const wallMat = new THREE.LineBasicMaterial({
        color: VISUAL_THEME.SELECTED_FLOOR_LINE,
        transparent: true,
        opacity: 0.85
      });
      const walls = new THREE.LineSegments(wallGeo, wallMat);
      walls.name = `${level}F_Provisional_Partitions`;
      interiorGroup.add(walls);
      this.disposables.push(wallGeo, wallMat);
    }

    return interiorGroup;
  }

  /**
   * Vertical Stair Core Wireframe at Facility Egress Corner.
   */
  buildStairCoreWireframe() {
    const conn = this.facility.connector || {};
    const pSE = conn.stairCoreCorner || conn.doorPos ? [
      (conn.stairCoreCorner?.[0] ?? conn.doorPos[0]),
      (conn.stairCoreCorner?.[1] ?? conn.doorPos[2])
    ] : [70.16, -45.51];
    const w = conn.stairCoreSize?.width ?? 4.0;
    const d = conn.stairCoreSize?.depth ?? 5.0;
    const baseY = this.facility.groundElevationY ?? 0.0;
    const h = baseY + this.config.totalLevels * this.config.floorHeightMeters;

    const corePoints = [
      // Base rectangle
      new THREE.Vector3(pSE[0] - w, baseY, pSE[1] - d), new THREE.Vector3(pSE[0], baseY, pSE[1] - d),
      new THREE.Vector3(pSE[0], baseY, pSE[1] - d), new THREE.Vector3(pSE[0], baseY, pSE[1]),
      new THREE.Vector3(pSE[0], baseY, pSE[1]), new THREE.Vector3(pSE[0] - w, baseY, pSE[1]),
      new THREE.Vector3(pSE[0] - w, baseY, pSE[1]), new THREE.Vector3(pSE[0] - w, baseY, pSE[1] - d),
      // Top rectangle
      new THREE.Vector3(pSE[0] - w, h, pSE[1] - d), new THREE.Vector3(pSE[0], h, pSE[1] - d),
      new THREE.Vector3(pSE[0], h, pSE[1] - d), new THREE.Vector3(pSE[0], h, pSE[1]),
      new THREE.Vector3(pSE[0], h, pSE[1]), new THREE.Vector3(pSE[0] - w, h, pSE[1]),
      new THREE.Vector3(pSE[0] - w, h, pSE[1]), new THREE.Vector3(pSE[0] - w, h, pSE[1] - d),
      // Vertical pillars
      new THREE.Vector3(pSE[0] - w, baseY, pSE[1] - d), new THREE.Vector3(pSE[0] - w, h, pSE[1] - d),
      new THREE.Vector3(pSE[0], baseY, pSE[1] - d), new THREE.Vector3(pSE[0], h, pSE[1] - d),
      new THREE.Vector3(pSE[0], baseY, pSE[1]), new THREE.Vector3(pSE[0], h, pSE[1]),
      new THREE.Vector3(pSE[0] - w, baseY, pSE[1]), new THREE.Vector3(pSE[0] - w, h, pSE[1])
    ];

    const coreGeo = new THREE.BufferGeometry().setFromPoints(corePoints);
    const coreMat = new THREE.LineBasicMaterial({
      color: VISUAL_THEME.STAIR_CORE_WIRE,
      transparent: true,
      opacity: 0.65
    });
    const coreLines = new THREE.LineSegments(coreGeo, coreMat);
    coreLines.name = 'SE_StairCore_Wireframe';
    this.rootGroup.add(coreLines);

    this.disposables.push(coreGeo, coreMat);
  }

  /**
   * Explicit 1F Doorway Portal and Transition Vector to Outdoor Pedestrian Network.
   */
  build1FEgressConnector() {
    const conn = this.facility.connector || {};
    const dp = conn.doorPos || [70.16, 0.0, -45.51];
    const fp = conn.footwayPos || [73.68, -0.15, -43.61];
    const doorPos = new THREE.Vector3(dp[0], dp[1], dp[2]);
    const footwayPos = new THREE.Vector3(fp[0], fp[1], fp[2]);

    // Doorway frame (width 1.8m, height 2.1m) anchored at ground level
    const dw = 1.8;
    const dh = 2.1;
    const dy = doorPos.y;
    const doorFramePoints = [
      new THREE.Vector3(doorPos.x, dy, doorPos.z), new THREE.Vector3(doorPos.x, dy + dh, doorPos.z),
      new THREE.Vector3(doorPos.x, dy + dh, doorPos.z), new THREE.Vector3(doorPos.x + dw * 0.7, dy + dh, doorPos.z + dw * 0.7),
      new THREE.Vector3(doorPos.x + dw * 0.7, dy + dh, doorPos.z + dw * 0.7), new THREE.Vector3(doorPos.x + dw * 0.7, dy, doorPos.z + dw * 0.7)
    ];
    const doorGeo = new THREE.BufferGeometry().setFromPoints(doorFramePoints);
    const doorMat = new THREE.LineBasicMaterial({
      color: VISUAL_THEME.CONNECTOR_WIRE,
      linewidth: 2
    });
    this.rootGroup.add(new THREE.LineSegments(doorGeo, doorMat));

    // Vector line connecting door to outdoor pedestrian node
    const connLinePoints = [doorPos, footwayPos];
    const connGeo = new THREE.BufferGeometry().setFromPoints(connLinePoints);
    const connMat = new THREE.LineDashedMaterial({
      color: VISUAL_THEME.CONNECTOR_WIRE,
      dashSize: 0.4,
      gapSize: 0.2
    });
    const connLine = new THREE.Line(connGeo, connMat);
    connLine.computeLineDistances();
    const names = this.facility.routeDisplayNames || {};
    connLine.name = names.connectorLineName || 'Connector_1F_SE_Line';
    this.rootGroup.add(connLine);

    // Architectural Origin Marker ("내 위치" 출발지 표식 — 논-글로우 동심 링 + 점)
    const originGroup = new THREE.Group();
    originGroup.name = 'Origin_Marker_Group';
    originGroup.position.set(doorPos.x, Math.max(0.25, doorPos.y + 0.35), doorPos.z);

    const oInnerGeo = new THREE.RingGeometry(2.2, 3.2, 32);
    oInnerGeo.rotateX(-Math.PI / 2);
    const oInnerMat = new THREE.MeshBasicMaterial({
      color: 0xf8fafc,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.92
    });
    originGroup.add(new THREE.Mesh(oInnerGeo, oInnerMat));

    const oOuterGeo = new THREE.RingGeometry(5.8, 6.8, 36);
    oOuterGeo.rotateX(-Math.PI / 2);
    const oOuterMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.68
    });
    originGroup.add(new THREE.Mesh(oOuterGeo, oOuterMat));

    this.rootGroup.add(originGroup);

    this.disposables.push(doorGeo, doorMat, connGeo, connMat, oInnerGeo, oInnerMat, oOuterGeo, oOuterMat);
  }

  /**
   * Fillet sharp corners with smooth quadratic arcs and densely resample terrain elevation
   * so navigation ribbons hug street slopes without cylindrical corner kinks.
   * @private
   */
  _buildFilletedRoutePoints(waypoints, elevOffset = 0.46) {
    const sampler = typeof this.elevationSampler === 'function'
      ? this.elevationSampler
      : (typeof this.facility?.elevationSampler === 'function' ? this.facility.elevationSampler : null);

    // 1. Deduplicate near-identical points
    const deduped = [];
    for (const p of waypoints) {
      if (deduped.length === 0 || Math.hypot(p.x - deduped[deduped.length - 1].x, p.z - deduped[deduped.length - 1].z) > 0.25) {
        deduped.push(new THREE.Vector3(p.x, p.y, p.z));
      }
    }
    if (deduped.length < 2) return [];

    // 2. Smooth corners > 16 deg cleanly for visual elegance while keeping turn locations faithful
    const filleted = [deduped[0].clone()];
    const turnMarkers = [];
    for (let i = 1; i < deduped.length - 1; i++) {
      const a = deduped[i - 1];
      const b = deduped[i];
      const c = deduped[i + 1];
      const v1x = b.x - a.x;
      const v1z = b.z - a.z;
      const v2x = c.x - b.x;
      const v2z = c.z - b.z;
      const l1 = Math.hypot(v1x, v1z);
      const l2 = Math.hypot(v2x, v2z);
      if (l1 < 2.0 || l2 < 2.0) {
        filleted.push(b.clone());
        continue;
      }
      const dot = (v1x * v2x + v1z * v2z) / (l1 * l2);
      const clampedDot = Math.max(-1, Math.min(1, dot));
      const turnAngle = Math.acos(clampedDot);
      if (turnAngle > 0.28) {
        const radius = Math.min(3.4, l1 * 0.34, l2 * 0.34);
        const pIn = new THREE.Vector3(
          b.x - (v1x / l1) * radius,
          b.y - ((b.y - a.y) / l1) * radius,
          b.z - (v1z / l1) * radius
        );
        const pOut = new THREE.Vector3(
          b.x + (v2x / l2) * radius,
          b.y + ((c.y - b.y) / l2) * radius,
          b.z + (v2z / l2) * radius
        );
        filleted.push(pIn);
        // Quadratic mid-arc
        const mid = new THREE.Vector3(
          0.25 * pIn.x + 0.5 * b.x + 0.25 * pOut.x,
          0.25 * pIn.y + 0.5 * b.y + 0.25 * pOut.y,
          0.25 * pIn.z + 0.5 * b.z + 0.25 * pOut.z
        );
        filleted.push(mid, pOut);
        if (turnAngle > 0.42) {
          turnMarkers.push({
            pos: new THREE.Vector3(mid.x, mid.y, mid.z),
            dir: new THREE.Vector3(v2x / l2, 0, v2z / l2)
          });
        }
      } else {
        filleted.push(b.clone());
      }
    }
    filleted.push(deduped[deduped.length - 1].clone());

    // 3. Resample edges > 6m onto terrain height so ribbons never slice hills or hover
    const elevated = [];
    for (let i = 0; i < filleted.length; i++) {
      const cur = filleted[i];
      if (i > 0) {
        const prev = filleted[i - 1];
        const span = Math.hypot(cur.x - prev.x, cur.z - prev.z);
        if (span > 6.0) {
          const steps = Math.ceil(span / 5.5);
          for (let s = 1; s < steps; s++) {
            const t = s / steps;
            const mx = prev.x + (cur.x - prev.x) * t;
            const mz = prev.z + (cur.z - prev.z) * t;
            const my = sampler ? Math.max(prev.y + (cur.y - prev.y) * t, sampler(mx, -mz) + 0.16) : (prev.y + (cur.y - prev.y) * t);
            elevated.push(new THREE.Vector3(mx, my + elevOffset, mz));
          }
        }
      }
      const cy = sampler ? Math.max(cur.y, sampler(cur.x, -cur.z) + 0.16) : cur.y;
      elevated.push(new THREE.Vector3(cur.x, cy + elevOffset, cur.z));
    }

    return { elevated, turnMarkers };
  }

  /**
   * Build a clean beveled architectural route ribbon geometry (outer sloped skirt + crowned deck)
   * with normalized across-width UVs [-1..+1] and exact arc-length meter UVs in v.
   * @private
   */
  _createBeveledRibbonGeometry(points, halfWidth = 2.1, thickness = 0.28) {
    const n = points.length;
    if (n < 2) return null;

    const cumDist = new Float32Array(n);
    cumDist[0] = 0;
    for (let i = 1; i < n; i++) {
      cumDist[i] = cumDist[i - 1] + points[i - 1].distanceTo(points[i]);
    }
    const totalMeters = Math.max(0.1, cumDist[n - 1]);

    // 4 vertices per cross-section: outer-left, inner-left, inner-right, outer-right
    const positions = [];
    const normals = [];
    const uvs = [];
    const indices = [];

    const innerW = halfWidth * 0.74;
    const outerW = halfWidth * 1.08;

    for (let i = 0; i < n; i++) {
      const pPrev = points[Math.max(0, i - 1)];
      const pCur = points[i];
      const pNext = points[Math.min(n - 1, i + 1)];

      let tx1 = pCur.x - pPrev.x;
      let tz1 = pCur.z - pPrev.z;
      const l1 = Math.hypot(tx1, tz1);
      if (l1 > 1e-5) { tx1 /= l1; tz1 /= l1; }

      let tx2 = pNext.x - pCur.x;
      let tz2 = pNext.z - pCur.z;
      const l2 = Math.hypot(tx2, tz2);
      if (l2 > 1e-5) { tx2 /= l2; tz2 /= l2; }

      let mx, mz;
      let miterScale = 1.0;
      if (i === 0) {
        mx = -tz2; mz = tx2;
      } else if (i === n - 1) {
        mx = -tz1; mz = tx1;
      } else {
        const n1x = -tz1, n1z = tx1;
        const n2x = -tz2, n2z = tx2;
        mx = n1x + n2x;
        mz = n1z + n2z;
        const mLen = Math.hypot(mx, mz);
        const turnDot = tx1 * tx2 + tz1 * tz2;
        if (mLen < 1e-4 || turnDot < -0.15) {
          // Hairpin / sharp zig-zag fold: clamp miter cleanly to outgoing normal to prevent inverted ribbon bowties
          mx = n2x; mz = n2z;
          miterScale = 1.0;
        } else {
          mx /= mLen; mz /= mLen;
          const dot = mx * n1x + mz * n1z;
          miterScale = Math.min(1.42, 1.0 / Math.max(0.65, dot));
        }
      }

      const d = cumDist[i];
      const oW = outerW * miterScale;
      const iW = innerW * miterScale;

      positions.push(
        pCur.x - mx * oW, pCur.y - thickness * 0.45, pCur.z - mz * oW,
        pCur.x - mx * iW, pCur.y + thickness * 0.45, pCur.z - mz * iW,
        pCur.x + mx * iW, pCur.y + thickness * 0.45, pCur.z + mz * iW,
        pCur.x + mx * oW, pCur.y - thickness * 0.45, pCur.z + mz * oW
      );
      normals.push(
        -mx * 0.35, 0.94, -mz * 0.35,
        0, 1, 0,
        0, 1, 0,
        mx * 0.35, 0.94, mz * 0.35
      );
      uvs.push(
        -1.0, d,
        -0.72, d,
        0.72, d,
        1.0, d
      );

      if (i > 0) {
        const a = (i - 1) * 4;
        const b = i * 4;
        for (let k = 0; k < 3; k++) {
          indices.push(a + k, b + k, a + k + 1);
          indices.push(b + k, b + k + 1, a + k + 1);
        }
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geo.setIndex(indices);
    return { geo, totalMeters };
  }

  /**
   * Single-pass navigation ribbon shader: crisp border casing, traveled-vs-remaining progress fade,
   * and embedded smooth forward chevron SDFs.
   * @private
   */
  _createNavigationRibbonMaterial(options = {}) {
    const {
      coreHex = 0xf8fafc,
      casingHex = 0x09111f,
      walkedHex = 0x334155,
      chevronHex = 0x38bdf8,
      opacity = 0.96,
      totalMeters = 100.0,
      isStepFree = false
    } = options;

    const uniforms = {
      uCoreColor: { value: new THREE.Color(coreHex) },
      uCasingColor: { value: new THREE.Color(casingHex) },
      uWalkedColor: { value: new THREE.Color(walkedHex) },
      uChevronColor: { value: new THREE.Color(chevronHex) },
      uTotalMeters: { value: totalMeters },
      uProgress: { value: this.routeProgressT || 0.0 },
      uTime: { value: 0.0 },
      uOpacity: { value: opacity },
      uIsStepFree: { value: isStepFree ? 1.0 : 0.0 }
    };

    const mat = new THREE.ShaderMaterial({
      uniforms,
      transparent: true,
      depthWrite: true,
      side: THREE.DoubleSide,
      extensions: { derivatives: true },
      vertexShader: `
        varying vec2 vNavUv;
        void main() {
          vNavUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        varying vec2 vNavUv;
        uniform vec3 uCoreColor;
        uniform vec3 uCasingColor;
        uniform vec3 uWalkedColor;
        uniform vec3 uChevronColor;
        uniform float uTotalMeters;
        uniform float uProgress;
        uniform float uTime;
        uniform float uOpacity;
        uniform float uIsStepFree;

        void main() {
          float absU = abs(vNavUv.x);
          #if __VERSION__ >= 300 || defined(GL_OES_standard_derivatives)
            float aaU = max(0.02, fwidth(absU) * 1.3);
            float aaV = max(0.04, fwidth(vNavUv.y) * 1.4);
          #else
            float aaU = 0.05;
            float aaV = 0.25;
          #endif

          // Crisp outer casing frame
          float coreMask = 1.0 - smoothstep(0.68 - aaU, 0.72 + aaU, absU);
          float outerAlpha = 1.0 - smoothstep(0.95 - aaU, 1.0, absU);

          // Traveled vs Ahead progress split
          float progMeters = uProgress * uTotalMeters;
          float aheadFactor = smoothstep(progMeters - 2.5, progMeters + 2.5, vNavUv.y);

          // Embedded smooth directional chevrons scrolling gently along ahead path
          float spacing = mix(14.0, 18.0, uIsStepFree);
          float phase = vNavUv.y - uTime * mix(7.2, 5.4, uIsStepFree);
          float localV = mod(phase, spacing);
          // V-chevron shape: center points forward (+V), wings trail backward
          float chevTarget = 4.6 - absU * 4.2;
          float chevDist = abs(localV - chevTarget);
          float chevShape = (1.0 - smoothstep(0.55 - aaV * 0.4, 0.95 + aaV * 0.4, chevDist))
                          * (1.0 - smoothstep(0.42, 0.56, absU));

          // Secondary dashed break on step-free alternate route
          float dashMask = uIsStepFree > 0.5
            ? mix(0.62, 1.0, smoothstep(1.2, 2.2, abs(mod(vNavUv.y, 9.0) - 4.5)))
            : 1.0;

          vec3 activeCore = mix(uCoreColor, uChevronColor, chevShape * 0.92 * aheadFactor);
          vec3 traveledCore = mix(uWalkedColor, activeCore, 0.26);
          vec3 finalCore = mix(traveledCore, activeCore, aheadFactor);

          // Subtle spine luminance along dead center
          finalCore += vec3(0.05) * (1.0 - smoothstep(0.0, 0.35, absU)) * aheadFactor;

          vec3 rgb = mix(uCasingColor, finalCore, coreMask);
          float alpha = outerAlpha * uOpacity * mix(0.54, 1.0, aheadFactor) * dashMask;
          if (alpha < 0.02) discard;
          gl_FragColor = vec4(rgb, alpha);
        }
      `
    });
    // Expose color alias cleanly so existing theme code never breaks
    mat.color = mat.uniforms.uCoreColor.value;
    this.routeRibbonMaterials.push(mat);
    return mat;
  }

  /**
   * Build sleek Apple/Naver-style beveled architectural ribbon with smooth corner fillets,
   * outer border casing, embedded directional chevrons, and turn markers.
   * @private
   */
  _addVolumetricRouteMeshes(waypoints, options = {}) {
    if (!waypoints || waypoints.length < 2) return;
    const {
      tubeRadius = 1.45,
      color = 0xf8fafc,
      opacity = 0.95,
      elevOffset = 0.52,
      name = 'Route_Tube',
      routeKind = 'SHORTEST',
      chevronColor = 0x38bdf8,
      identicalToShortest = false
    } = options;

    const built = this._buildFilletedRoutePoints(waypoints, elevOffset);
    if (!built || !built.elevated || built.elevated.length < 2) return;

    const halfW = Math.max(1.5, tubeRadius * 1.55);
    const ribbonBuilt = this._createBeveledRibbonGeometry(built.elevated, halfW, 0.30);
    if (!ribbonBuilt) return;

    const isStepFree = routeKind === 'STEP_FREE';
    const ribbonMat = this._createNavigationRibbonMaterial({
      coreHex: color,
      casingHex: 0x08111f,
      walkedHex: 0x334155,
      chevronHex: chevronColor,
      opacity,
      totalMeters: ribbonBuilt.totalMeters,
      isStepFree
    });

    const ribbonMesh = new THREE.Mesh(ribbonBuilt.geo, ribbonMat);
    ribbonMesh.name = name;
    ribbonMesh.renderOrder = isStepFree ? 3 : 4;
    ribbonMesh.userData.routeKind = routeKind;
    ribbonMesh.userData.identicalToShortest = identicalToShortest;
    this.pathGroup.add(ribbonMesh);
    this.disposables.push(ribbonBuilt.geo, ribbonMat);

    // Soft ground contact shadow halo beneath ribbon
    const haloBuilt = this._createBeveledRibbonGeometry(built.elevated, halfW * 1.48, 0.06);
    if (haloBuilt) {
      const haloMat = new THREE.MeshBasicMaterial({
        color: 0x050a14,
        transparent: true,
        opacity: 0.28,
        depthWrite: false
      });
      const haloMesh = new THREE.Mesh(haloBuilt.geo, haloMat);
      haloMesh.position.y = -0.18;
      haloMesh.name = `${name}_Halo`;
      haloMesh.renderOrder = 2;
      haloMesh.userData.routeKind = routeKind;
      haloMesh.userData.identicalToShortest = identicalToShortest;
      this.pathGroup.add(haloMesh);
      this.disposables.push(haloBuilt.geo, haloMat);
    }

    // Minimalist flat architectural turn-node markers ONLY at genuine turn vertices (> 24 deg)
    const markers = built.turnMarkers.slice(0, 14);
    if (markers.length === 0 && built.elevated.length >= 2) {
      const midPt = built.elevated[Math.floor(built.elevated.length / 2)];
      const nextPt = built.elevated[Math.min(built.elevated.length - 1, Math.floor(built.elevated.length / 2) + 1)];
      const dir = new THREE.Vector3(nextPt.x - midPt.x, 0, nextPt.z - midPt.z).normalize();
      if (dir.lengthSq() > 0.01) markers.push({ pos: midPt, dir });
    }
    if (markers.length > 0) {
      const turnShape = new THREE.Shape();
      const s = halfW * 0.56;
      turnShape.moveTo(0, s * 1.25);
      turnShape.lineTo(s * 0.9, -s * 0.55);
      turnShape.lineTo(0, -s * 0.15);
      turnShape.lineTo(-s * 0.9, -s * 0.55);
      turnShape.closePath();
      const chevGeo = new THREE.ShapeGeometry(turnShape);
      chevGeo.rotateX(Math.PI * 0.5); // Tip points cleanly toward +Z matching Object3D.lookAt

      const chevMat = new THREE.MeshBasicMaterial({
        color: chevronColor,
        transparent: true,
        opacity: 0.92,
        side: THREE.DoubleSide,
        depthWrite: false
      });
      const chevInst = new THREE.InstancedMesh(chevGeo, chevMat, markers.length);
      chevInst.name = `${name}_Chevrons`;
      chevInst.renderOrder = 5;
      chevInst.userData.routeKind = routeKind;
      chevInst.userData.identicalToShortest = identicalToShortest;

      const dummy = new THREE.Object3D();
      const lookTarget = new THREE.Vector3();
      for (let i = 0; i < markers.length; i++) {
        const mk = markers[i];
        dummy.position.set(mk.pos.x, mk.pos.y + 0.24, mk.pos.z);
        lookTarget.copy(dummy.position).add(mk.dir);
        dummy.lookAt(lookTarget);
        dummy.updateMatrix();
        chevInst.setMatrixAt(i, dummy.matrix);
      }
      chevInst.instanceMatrix.needsUpdate = true;
      this.pathGroup.add(chevInst);
      this.disposables.push(chevGeo, chevMat);
    }
  }

  // --------------------------------------------------------------------------
  // 3. PEDESTRIAN PATH RENDERING (Graph-Driven Shortest vs Step-Free)
  // --------------------------------------------------------------------------

  /**
   * Resolve sequential 3D waypoints directly from routing graph edges.
   * Eliminates manual coordinate duplication between Dijkstra topology and Three.js rendering.
   *
   * @param {Array} edges - Ordered edges returned by PedestrianRoutingEngine
   * @returns {THREE.Vector3[]}
   */
  _extractRoutePoints(edges = []) {
    const pts = [];
    const pushPoint = (coords) => {
      if (!Array.isArray(coords) || coords.length < 3) return;
      const v = new THREE.Vector3(coords[0], coords[1], coords[2]);
      if (pts.length === 0 || pts[pts.length - 1].distanceToSquared(v) > 1e-8) {
        pts.push(v);
      }
    };

    edges.forEach(edge => {
      if (Array.isArray(edge.waypoints) && edge.waypoints.length >= 2) {
        edge.waypoints.forEach(wp => pushPoint(wp));
      } else {
        const fromPos = this.router.nodes.get(edge.from)?.localPos;
        const toPos = this.router.nodes.get(edge.to)?.localPos;
        if (fromPos) pushPoint(fromPos);
        if (toPos) pushPoint(toPos);
      }
    });

    return pts;
  }

  buildPedestrianPaths() {
    const names = this.facility.routeDisplayNames || {};
    const shortestRoute = this.router.findOutdoorShortestPath();
    const stepFreeRoute = this.router.findOutdoorStepFreePath();

    // 1. Shortest Path Polyline & Stair Hazard Segments (Derived directly by edge.hasStairs / edgeId / wayId)
    const shortestEdges = shortestRoute?.found ? shortestRoute.edges : [];
    const shortestWaypoints = this._extractRoutePoints(shortestEdges);
    this.routePolylines.SHORTEST = shortestWaypoints;

    if (shortestWaypoints.length >= 2) {
      const shortestGeo = new THREE.BufferGeometry().setFromPoints(shortestWaypoints);
      const shortestMat = new THREE.LineBasicMaterial({
        color: VISUAL_THEME.PATH_SHORTEST,
        transparent: true,
        opacity: 0.0
      });
      const shortestLine = new THREE.Line(shortestGeo, shortestMat);
      shortestLine.name = names.shortestLineName || 'Path_Shortest_651m';
      shortestLine.userData.routeKind = 'SHORTEST';
      shortestLine.userData.edgeIds = shortestEdges.map(e => e.edgeId);
      this.pathGroup.add(shortestLine);
      this.disposables.push(shortestGeo, shortestMat);

      this._addVolumetricRouteMeshes(shortestWaypoints, {
        tubeRadius: 1.55,
        color: 0xe2f1ff,
        opacity: 0.96,
        elevOffset: 0.50,
        name: 'Ribbon_Shortest_Volume',
        routeKind: 'SHORTEST',
        chevronColor: 0x38bdf8
      });
    }

    // Highlight exact stair edges identified by graph metadata (edge.hasStairs === true)
    const stairPoints = [];
    const stairSegmentsMeta = [];
    shortestEdges
      .filter(edge => edge.hasStairs === true)
      .forEach(edge => {
        const edgePts = this._extractRoutePoints([edge]);
        if (edgePts.length >= 2) {
          for (let i = 0; i < edgePts.length - 1; i++) {
            stairPoints.push(edgePts[i], edgePts[i + 1]);
          }
          stairSegmentsMeta.push({
            edgeId: edge.edgeId,
            wayId: edge.wayId,
            source: edge.from,
            target: edge.to,
            distance: edge.distance,
            startPos: [edgePts[0].x, edgePts[0].y, edgePts[0].z],
            endPos: [edgePts[edgePts.length - 1].x, edgePts[edgePts.length - 1].y, edgePts[edgePts.length - 1].z]
          });
        }
      });

    if (stairPoints.length >= 2) {
      const stairGeo = new THREE.BufferGeometry().setFromPoints(stairPoints);
      const stairMat = new THREE.LineBasicMaterial({
        color: VISUAL_THEME.PATH_STAIRS_HAZARD,
        transparent: true,
        opacity: 0.0
      });
      const stairLines = new THREE.LineSegments(stairGeo, stairMat);
      stairLines.name = names.stairHazardsName || 'Stairs_Hazard_Segments';
      stairLines.userData.routeKind = 'SHORTEST';
      stairLines.userData.stairSegments = Object.freeze(stairSegmentsMeta);
      this.pathGroup.add(stairLines);
      this.disposables.push(stairGeo, stairMat);

      for (let i = 0; i < stairSegmentsMeta.length; i++) {
        const sm = stairSegmentsMeta[i];
        const sPts = [
          new THREE.Vector3(sm.startPos[0], sm.startPos[1] + 0.56, sm.startPos[2]),
          new THREE.Vector3(sm.endPos[0], sm.endPos[1] + 0.56, sm.endPos[2])
        ];
        const stairRib = this._createBeveledRibbonGeometry(sPts, 2.75, 0.34);
        if (!stairRib) continue;
        const sTubeMat = new THREE.MeshBasicMaterial({
          color: VISUAL_THEME.PATH_STAIRS_HAZARD,
          transparent: true,
          opacity: 0.88,
          side: THREE.DoubleSide
        });
        const sTube = new THREE.Mesh(stairRib.geo, sTubeMat);
        sTube.name = `Ribbon_StairHazard_${i}`;
        sTube.renderOrder = 5;
        sTube.userData.routeKind = 'SHORTEST';
        this.pathGroup.add(sTube);
        this.disposables.push(stairRib.geo, sTubeMat);
      }
    }

    // 2. Step-Free Detour Path Polyline
    const stepFreeEdges = stepFreeRoute?.found ? stepFreeRoute.edges : [];
    const stepFreeWaypoints = this._extractRoutePoints(stepFreeEdges);
    this.routePolylines.STEP_FREE = stepFreeWaypoints;

    const arePolylinesIdentical = (a, b) => {
      if (!a || !b || a.length !== b.length || a.length === 0) return false;
      for (const idx of [0, Math.floor(a.length / 2), a.length - 1]) {
        if (Math.hypot(a[idx].x - b[idx].x, a[idx].z - b[idx].z) > 0.5) return false;
      }
      return true;
    };
    const identicalToShortest = arePolylinesIdentical(shortestWaypoints, stepFreeWaypoints);

    if (stepFreeWaypoints.length >= 2) {
      const stepFreeGeo = new THREE.BufferGeometry().setFromPoints(stepFreeWaypoints);
      const stepFreeMat = new THREE.LineDashedMaterial({
        color: VISUAL_THEME.PATH_STEP_FREE,
        dashSize: 2.0,
        gapSize: 1.0,
        transparent: true,
        opacity: 0.0
      });
      const stepFreeLine = new THREE.Line(stepFreeGeo, stepFreeMat);
      stepFreeLine.computeLineDistances();
      stepFreeLine.name = names.stepFreeLineName || 'Path_StepFree_769m';
      stepFreeLine.userData.routeKind = 'STEP_FREE';
      stepFreeLine.userData.identicalToShortest = identicalToShortest;
      stepFreeLine.userData.edgeIds = stepFreeEdges.map(e => e.edgeId);
      this.pathGroup.add(stepFreeLine);
      this.disposables.push(stepFreeGeo, stepFreeMat);

      this._addVolumetricRouteMeshes(stepFreeWaypoints, {
        tubeRadius: 1.28,
        color: 0x38bdf8,
        opacity: 0.90,
        elevOffset: 0.40,
        name: 'Ribbon_StepFree_Volume',
        routeKind: 'STEP_FREE',
        chevronColor: 0xe0f2fe,
        identicalToShortest
      });
    }

    this.setRouteDisplay(this.config.activeRoute || 'ALL');
  }

  _sampleTerrainY(x, z, fallbackY = 0) {
    const sampler = this.elevationSampler || this.facility?.elevationSampler || this.router?.elevationSampler;
    if (typeof sampler === 'function') {
      const h = sampler(x, -z);
      if (Number.isFinite(h)) return h;
    }
    return Number.isFinite(fallbackY) ? fallbackY : 0;
  }

  _buildTerrainDrapedLoop(pointsXZ, yOffset, fallbackY, color, opacity, name) {
    const densePts = [];
    for (let i = 0; i < pointsXZ.length; i++) {
      const a = pointsXZ[i];
      const b = pointsXZ[(i + 1) % pointsXZ.length];
      const dist = Math.hypot(b[0] - a[0], b[1] - a[1]);
      const steps = Math.max(1, Math.ceil(dist / 3.5));
      for (let s = 0; s < steps; s++) {
        const t = s / steps;
        const px = a[0] + (b[0] - a[0]) * t;
        const pz = a[1] + (b[1] - a[1]) * t;
        densePts.push(new THREE.Vector3(px, this._sampleTerrainY(px, pz, fallbackY) + yOffset, pz));
      }
    }
    const geo = new THREE.BufferGeometry().setFromPoints(densePts);
    const mat = new THREE.LineBasicMaterial({ color, transparent: true, opacity });
    const loop = new THREE.LineLoop(geo, mat);
    loop.name = name;
    loop.renderOrder = 3;
    return { loop, geo, mat };
  }

  _buildSoftRadialArrivalPadGeometry(cx, cz, fallbackY, radius, radSegs = 6, angSegs = 36) {
    const positions = [];
    const uvs = [];
    const indices = [];

    // Ring 0 center vertex
    positions.push(cx, this._sampleTerrainY(cx, cz, fallbackY) + 0.16, cz);
    uvs.push(0.0, 0.0);

    for (let r = 1; r <= radSegs; r++) {
      const u = r / radSegs;
      const rad = u * radius;
      for (let a = 0; a < angSegs; a++) {
        const theta = (a / angSegs) * Math.PI * 2;
        const px = cx + Math.cos(theta) * rad;
        const pz = cz + Math.sin(theta) * rad;
        positions.push(px, this._sampleTerrainY(px, pz, fallbackY) + 0.16, pz);
        uvs.push(u, theta);
      }
    }

    // Center fan
    for (let a = 0; a < angSegs; a++) {
      const nextA = (a + 1) % angSegs;
      indices.push(0, 1 + nextA, 1 + a);
    }
    // Outer rings
    for (let r = 1; r < radSegs; r++) {
      const r0 = 1 + (r - 1) * angSegs;
      const r1 = 1 + r * angSegs;
      for (let a = 0; a < angSegs; a++) {
        const nextA = (a + 1) % angSegs;
        indices.push(r0 + a, r0 + nextA, r1 + a);
        indices.push(r0 + nextA, r1 + nextA, r1 + a);
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geo.setIndex(indices);
    return geo;
  }

  _buildTerrainDrapedBoxPadGeometry(cx, cz, fallbackY, halfW, halfL, segW = 10, segL = 14) {
    const positions = [];
    const uvs = [];
    const indices = [];
    for (let j = 0; j <= segL; j++) {
      const vNorm = j / segL;
      const pz = cz - halfL + vNorm * (halfL * 2);
      const dv = Math.abs(vNorm * 2 - 1);
      for (let i = 0; i <= segW; i++) {
        const uNorm = i / segW;
        const px = cx - halfW + uNorm * (halfW * 2);
        const du = Math.abs(uNorm * 2 - 1);
        positions.push(px, this._sampleTerrainY(px, pz, fallbackY) + 0.16, pz);
        uvs.push(Math.max(du, dv), 0);
      }
    }
    const stride = segW + 1;
    for (let j = 0; j < segL; j++) {
      for (let i = 0; i < segW; i++) {
        const k = j * stride + i;
        indices.push(k, k + stride, k + 1);
        indices.push(k + 1, k + stride, k + stride + 1);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geo.setIndex(indices);
    return geo;
  }

  _buildTerrainDrapedRingGeometry(cx, cz, fallbackY, innerR, outerR, yOffset = 0.24, angSegs = 36) {
    const positions = [];
    const indices = [];
    for (let a = 0; a <= angSegs; a++) {
      const theta = (a / angSegs) * Math.PI * 2;
      const cos = Math.cos(theta);
      const sin = Math.sin(theta);
      const ix = cx + cos * innerR;
      const iz = cz + sin * innerR;
      const ox = cx + cos * outerR;
      const oz = cz + sin * outerR;
      positions.push(
        ix, this._sampleTerrainY(ix, iz, fallbackY) + yOffset, iz,
        ox, this._sampleTerrainY(ox, oz, fallbackY) + yOffset, oz
      );
      if (a > 0) {
        const base = (a - 1) * 2;
        indices.push(base, base + 1, base + 2);
        indices.push(base + 1, base + 3, base + 2);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setIndex(indices);
    return geo;
  }

  /**
   * Shelter Representation draped conformally to local terrain DEM relief
   * (stadium pitch & track for athletic venues; sleek circular arrival plaza elsewhere).
   */
  buildShelterRepresentation() {
    if (!this.facility?.shelter || !this.facility.shelter.localCenter) {
      return;
    }
    const shelter = this.facility.shelter;
    const names = this.facility.routeDisplayNames || {};
    const lc = shelter.localCenter;
    const cx = lc[0];
    const cy = lc[1];
    const cz = lc[2];
    const shelterId = String(shelter.shelterId || shelter.officialId || '');
    const shelterName = String(shelter.officialName || shelter.name || '');
    const isStadium = shelterId.includes('STADIUM') ||
      shelterId === 'OA-21060' ||
      /대운동장|운동장|체육관|경기장|stadium/i.test(shelterName);

    const trackRadiusX = isStadium ? (shelter.trackRadiusX ?? 40.0) : 13.5;
    const trackRadiusZ = isStadium ? (shelter.trackRadiusZ ?? 65.0) : 13.5;
    const pitchHalfWidth = shelter.pitchHalfWidth ?? 20.0;
    const pitchHalfLength = shelter.pitchHalfLength ?? 35.0;

    // 1. Terrain-draped outer zone boundary (stadium oval OR compact plaza ring)
    const outerPtsXZ = [];
    const segs = 56;
    for (let i = 0; i < segs; i++) {
      const theta = (i / segs) * Math.PI * 2;
      outerPtsXZ.push([cx + Math.cos(theta) * trackRadiusX, cz + Math.sin(theta) * trackRadiusZ]);
    }
    const trackBuilt = this._buildTerrainDrapedLoop(
      outerPtsXZ,
      0.26,
      cy,
      VISUAL_THEME.STADIUM_TRACK,
      isStadium ? 0.65 : 0.42,
      names.shelterTrackName || 'Stadium_Track_Outline'
    );
    this.shelterGroup.add(trackBuilt.loop);

    // 2. Terrain-draped inner zone border & subdivided soft radial pad (zero rigid floating rectangles!)
    let pitchBuilt;
    let safeMatGeo;
    if (isStadium) {
      const boxPtsXZ = [
        [cx - pitchHalfWidth, cz - pitchHalfLength],
        [cx + pitchHalfWidth, cz - pitchHalfLength],
        [cx + pitchHalfWidth, cz + pitchHalfLength],
        [cx - pitchHalfWidth, cz + pitchHalfLength]
      ];
      pitchBuilt = this._buildTerrainDrapedLoop(
        boxPtsXZ,
        0.28,
        cy,
        VISUAL_THEME.SELECTED_FLOOR_LINE,
        0.78,
        names.shelterPitchName || 'Stadium_Pitch_Safe_Zone'
      );
      safeMatGeo = this._buildTerrainDrapedBoxPadGeometry(cx, cz, cy, pitchHalfWidth, pitchHalfLength);
    } else {
      const padRadius = 9.0;
      const circlePtsXZ = [];
      for (let i = 0; i < 40; i++) {
        const theta = (i / 40) * Math.PI * 2;
        circlePtsXZ.push([cx + Math.cos(theta) * padRadius, cz + Math.sin(theta) * padRadius]);
      }
      pitchBuilt = this._buildTerrainDrapedLoop(
        circlePtsXZ,
        0.28,
        cy,
        0x2dd4bf,
        0.62,
        names.shelterPitchName || 'Stadium_Pitch_Safe_Zone'
      );
      safeMatGeo = this._buildSoftRadialArrivalPadGeometry(cx, cz, cy, padRadius);
    }
    this.shelterGroup.add(pitchBuilt.loop);

    const safeMatMat = new THREE.ShaderMaterial({
      uniforms: {
        uColor: { value: new THREE.Color(0x2dd4bf) },
        uOpacity: { value: isStadium ? 0.16 : 0.22 }
      },
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
      vertexShader: `
        varying float vEdge;
        void main() {
          vEdge = uv.x;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        varying float vEdge;
        uniform vec3 uColor;
        uniform float uOpacity;
        void main() {
          float fade = 1.0 - smoothstep(0.45, 1.0, vEdge);
          gl_FragColor = vec4(uColor, uOpacity * fade);
        }
      `
    });
    safeMatMat.color = safeMatMat.uniforms.uColor.value;
    const safePad = new THREE.Mesh(safeMatGeo, safeMatMat);
    safePad.name = 'Shelter_Pitch_SafePad';
    safePad.renderOrder = 2;
    this.shelterGroup.add(safePad);

    // 3. Terrain-draped arrival target ring
    const destRingGeo = this._buildTerrainDrapedRingGeometry(cx, cz, cy, isStadium ? 8.5 : 4.2, isStadium ? 11.2 : 5.8, 0.25, 36);
    const destRingMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.78,
      depthWrite: false
    });
    const destRing = new THREE.Mesh(destRingGeo, destRingMat);
    destRing.name = 'Shelter_Center_Arrival_Ring';
    destRing.renderOrder = 3;
    this.shelterGroup.add(destRing);

    this.disposables.push(trackBuilt.geo, trackBuilt.mat, pitchBuilt.geo, pitchBuilt.mat, safeMatGeo, safeMatMat, destRingGeo, destRingMat);
  }

  // --------------------------------------------------------------------------
  // 4. INTERACTION & FLOOR HIGHLIGHTING
  // --------------------------------------------------------------------------

  /**
   * Accentuate a specific floor (e.g. 3F) with high-contrast ivory lines,
   * while ghosting other floors to subtle dark basalt tones.
   *
   * @param {number} targetLevel - Floor level (1 to totalLevels)
   */
  highlightFloor(targetLevel) {
    if (targetLevel < 1 || targetLevel > this.config.totalLevels) return;
    this.config.selectedFloor = targetLevel;

    const interiorGroupName = this.facility.routeDisplayNames?.interiorGroupName || `Interior_${this.facility.defaultFloor ?? 3}F_Provisional`;

    this.floorGroups.forEach((group, level) => {
      const isSelected = level === targetLevel;

      group.traverse(child => {
        if (child.isLineSegments || child.isLine) {
          if (child.name.startsWith('SlabLines')) {
            child.material.color.setHex(
              isSelected ? VISUAL_THEME.SELECTED_FLOOR_LINE : VISUAL_THEME.UNSELECTED_FLOOR_LINE
            );
            child.material.opacity = isSelected ? 0.95 : 0.25;
            child.material.linewidth = isSelected ? 2 : 1;
          }
        }
        if (child.isMesh && child.name.startsWith('PlateMesh')) {
          child.material.color.setHex(
            isSelected ? VISUAL_THEME.SELECTED_FLOOR_FILL : VISUAL_THEME.UNSELECTED_FLOOR_FILL
          );
          child.material.opacity = isSelected ? 0.65 : 0.15;
        }
        if (child.name === interiorGroupName || child.name === 'Interior_3F_Provisional' || child.name.startsWith('Interior_')) {
          child.visible = isSelected;
        }
      });
    });
  }

  /**
   * Set active route display.
   * @param {'ALL' | 'SHORTEST' | 'STEP_FREE' | 'NONE'} mode
   */
  setRouteDisplay(mode) {
    this.config.activeRoute = mode;
    this.pathGroup.traverse(child => {
      if (child.userData?.routeKind === 'SHORTEST' || child.name === 'Path_Shortest_651m' || child.name === 'Stairs_Hazard_Segments') {
        child.visible = mode === 'ALL' || mode === 'SHORTEST';
      }
      if (child.userData?.routeKind === 'STEP_FREE' || child.name === 'Path_StepFree_769m') {
        if (child.userData?.identicalToShortest) {
          child.visible = mode === 'STEP_FREE';
        } else {
          child.visible = mode === 'ALL' || mode === 'STEP_FREE';
        }
      }
    });
  }

  setRouteProgress(normalizedT = 0.0) {
    this.routeProgressT = Math.max(0.0, Math.min(1.0, Number.isFinite(normalizedT) ? normalizedT : 0.0));
    for (const mat of this.routeRibbonMaterials) {
      if (mat?.uniforms?.uProgress) {
        mat.uniforms.uProgress.value = this.routeProgressT;
      }
    }
  }

  update(elapsedSec = 0) {
    for (const mat of this.routeRibbonMaterials) {
      if (mat?.uniforms?.uTime) {
        mat.uniforms.uTime.value = elapsedSec;
      }
    }
  }

  /**
   * Adjust high-contrast evacuation tube colors cleanly between Nocturnal Night
   * and Daylight Reference themes.
   */
  setThemeColors(isDay = false) {
    const applyRibbonPalette = (mesh, opts) => {
      const m = mesh?.material;
      if (!m) return;
      if (m.uniforms) {
        m.uniforms.uCoreColor.value.setHex(opts.core);
        m.uniforms.uCasingColor.value.setHex(opts.casing);
        m.uniforms.uWalkedColor.value.setHex(opts.walked);
        m.uniforms.uChevronColor.value.setHex(opts.chevron);
      } else if (m.color?.setHex) {
        m.color.setHex(opts.core);
      }
    };

    applyRibbonPalette(this.pathGroup.getObjectByName('Ribbon_Shortest_Volume'), isDay
      ? { core: 0x0d9488, casing: 0x0f3b38, walked: 0x94a3b8, chevron: 0xffffff }
      : { core: 0xe2f1ff, casing: 0x08111f, walked: 0x334155, chevron: 0x38bdf8 }
    );
    applyRibbonPalette(this.pathGroup.getObjectByName('Ribbon_StepFree_Volume'), isDay
      ? { core: 0x0284c7, casing: 0x073b5c, walked: 0x94a3b8, chevron: 0xe0f2fe }
      : { core: 0x38bdf8, casing: 0x071424, walked: 0x334155, chevron: 0xe0f2fe }
    );
    const chevShort = this.pathGroup.getObjectByName('Ribbon_Shortest_Volume_Chevrons');
    if (chevShort?.material?.color) {
      chevShort.material.color.setHex(isDay ? 0xffffff : 0x38bdf8);
    }
    const chevStep = this.pathGroup.getObjectByName('Ribbon_StepFree_Volume_Chevrons');
    if (chevStep?.material?.color) {
      chevStep.material.color.setHex(isDay ? 0xffffff : 0xe0f2fe);
    }
    const safePad = this.shelterGroup?.getObjectByName('Shelter_Pitch_SafePad');
    if (safePad?.material?.color) {
      safePad.material.color.setHex(isDay ? 0x0d9488 : 0x2dd4bf);
    }
    const destRing = this.shelterGroup?.getObjectByName('Shelter_Center_Arrival_Ring');
    if (destRing?.material?.color) {
      destRing.material.color.setHex(isDay ? 0x0284c7 : 0x38bdf8);
    }
  }

  /**
   * Return the calibrated 3D polyline matching the current active route display mode.
   */
  getActiveRoutePoints() {
    if (this.config.activeRoute === 'NONE') return [];
    if (this.config.activeRoute === 'STEP_FREE') return this.routePolylines.STEP_FREE || [];
    return this.routePolylines.SHORTEST || [];
  }

  /**
   * Hot-swap the active FacilityPackage at runtime (Tier 2.4 Multi-Building Switcher)
   * without leaving stale Three.js geometries/materials in memory.
   */
  setFacilityPackage(facilityPackage) {
    if (!facilityPackage) {
      throw new Error('[HanyangResponseAdapter] facilityPackage is required.');
    }

    // Dispose prior child meshes and clear rootGroup cleanly
    while (this.rootGroup.children.length > 0) {
      this.rootGroup.remove(this.rootGroup.children[0]);
    }
    this.disposables.forEach(item => {
      if (item && typeof item.dispose === 'function') item.dispose();
    });
    this.disposables.length = 0;
    this.floorGroups.clear();

    this.facility = facilityPackage;
    this.anchor = new LocalTangentAnchor(this.facility.anchor || HANYANG_BLDG212_ANCHOR);
    if (typeof this.router?.loadFacilityPackage === 'function') {
      this.router.loadFacilityPackage(this.facility);
      // Do NOT overwrite active region walkGraph / OBBs if adapter holds stale constructor defaults
      if (this.useRealMapRouting && typeof this.router?.setRealMapRouting === 'function' && (this.customWalkGraph || !this.router.customWalkGraph)) {
        this.router.setRealMapRouting({
          enabled: true,
          buildingOBBs: this.router.buildingOBBs || this.buildingOBBs,
          customWalkGraph: this.customWalkGraph ?? this.router.customWalkGraph,
          elevationSampler: this.elevationSampler ?? this.router.elevationSampler
        });
      }
    }

    const bldgMeta = this.facility.buildingMetadata || {};
    const bldgId = bldgMeta.id || 'FACILITY';
    this.rootGroup.name = bldgId === 'BLDG_212_ENG1' ? 'HanyangBldg212_ResponseRoot' : `${bldgId}_ResponseRoot`;
    this.config.floorHeightMeters = this.facility.floorHeightMeters ?? 3.6;
    this.config.totalLevels = bldgMeta.levels?.aboveGround ?? this.facility.totalLevels ?? 5;
    this.config.selectedFloor = this.facility.defaultFloor ?? 3;

    this.routePolylines = { SHORTEST: [], STEP_FREE: [] };
    this.routeRibbonMaterials = [];
    this.pathGroup = new THREE.Group();
    this.pathGroup.name = 'PedestrianPathsGroup';
    this.shelterGroup = new THREE.Group();
    this.shelterGroup.name = 'ShelterGroup';
    this.rootGroup.add(this.pathGroup);
    this.rootGroup.add(this.shelterGroup);

    this.buildBuildingStructure();
    this.buildPedestrianPaths();
    this.buildShelterRepresentation();
    this.highlightFloor(this.config.selectedFloor);
    this.setRouteDisplay(this.config.activeRoute || 'ALL');
  }

  /**
   * Clear active facility & evacuation route geometry when switching to unavailable/outside-impact regions.
   */
  clearVisuals() {
    while (this.rootGroup.children.length > 0) {
      this.rootGroup.remove(this.rootGroup.children[0]);
    }
    this.disposables.forEach(item => {
      if (item && typeof item.dispose === 'function') item.dispose();
    });
    this.disposables.length = 0;
    this.floorGroups.clear();
    this.routePolylines = { SHORTEST: [], STEP_FREE: [] };
    this.routeRibbonMaterials = [];
    this.pathGroup = new THREE.Group();
    this.pathGroup.name = 'PedestrianPathsGroup';
    this.shelterGroup = new THREE.Group();
    this.shelterGroup.name = 'ShelterGroup';
    this.rootGroup.add(this.pathGroup);
    this.rootGroup.add(this.shelterGroup);
  }

  /**
   * Complete memory cleanup.
   */
  dispose() {
    if (this.scene && this.rootGroup) {
      this.scene.remove(this.rootGroup);
    }
    this.disposables.forEach(item => {
      if (item && typeof item.dispose === 'function') {
        item.dispose();
      }
    });
    this.disposables.length = 0;
    this.floorGroups.clear();
  }
}
