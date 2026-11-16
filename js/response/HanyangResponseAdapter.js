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
    this.router = options.router || new PedestrianRoutingEngine({ facilityPackage: this.facility });

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
    const interiorTargetFloor = this.facility.defaultFloor ?? 3;

    for (let level = 1; level <= this.config.totalLevels; level++) {
      const floorGroup = new THREE.Group();
      floorGroup.name = `Floor_${level}F`;
      const yBottom = (level - 1) * hFloor;
      const yTop = level * hFloor;

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
    const yRoof = this.config.totalLevels * hFloor;
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
    const h = this.config.totalLevels * this.config.floorHeightMeters;

    const corePoints = [
      // Base rectangle
      new THREE.Vector3(pSE[0] - w, 0, pSE[1] - d), new THREE.Vector3(pSE[0], 0, pSE[1] - d),
      new THREE.Vector3(pSE[0], 0, pSE[1] - d), new THREE.Vector3(pSE[0], 0, pSE[1]),
      new THREE.Vector3(pSE[0], 0, pSE[1]), new THREE.Vector3(pSE[0] - w, 0, pSE[1]),
      new THREE.Vector3(pSE[0] - w, 0, pSE[1]), new THREE.Vector3(pSE[0] - w, 0, pSE[1] - d),
      // Top rectangle
      new THREE.Vector3(pSE[0] - w, h, pSE[1] - d), new THREE.Vector3(pSE[0], h, pSE[1] - d),
      new THREE.Vector3(pSE[0], h, pSE[1] - d), new THREE.Vector3(pSE[0], h, pSE[1]),
      new THREE.Vector3(pSE[0], h, pSE[1]), new THREE.Vector3(pSE[0] - w, h, pSE[1]),
      new THREE.Vector3(pSE[0] - w, h, pSE[1]), new THREE.Vector3(pSE[0] - w, h, pSE[1] - d),
      // Vertical pillars
      new THREE.Vector3(pSE[0] - w, 0, pSE[1] - d), new THREE.Vector3(pSE[0] - w, h, pSE[1] - d),
      new THREE.Vector3(pSE[0], 0, pSE[1] - d), new THREE.Vector3(pSE[0], h, pSE[1] - d),
      new THREE.Vector3(pSE[0], 0, pSE[1]), new THREE.Vector3(pSE[0], h, pSE[1]),
      new THREE.Vector3(pSE[0] - w, 0, pSE[1]), new THREE.Vector3(pSE[0] - w, h, pSE[1])
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

    // Doorway frame (width 1.8m, height 2.1m)
    const dw = 1.8;
    const dh = 2.1;
    const doorFramePoints = [
      new THREE.Vector3(doorPos.x, 0, doorPos.z), new THREE.Vector3(doorPos.x, dh, doorPos.z),
      new THREE.Vector3(doorPos.x, dh, doorPos.z), new THREE.Vector3(doorPos.x + dw * 0.7, dh, doorPos.z + dw * 0.7),
      new THREE.Vector3(doorPos.x + dw * 0.7, dh, doorPos.z + dw * 0.7), new THREE.Vector3(doorPos.x + dw * 0.7, 0, doorPos.z + dw * 0.7)
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

    this.disposables.push(doorGeo, doorMat, connGeo, connMat);
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
        linewidth: 2.0
      });
      const shortestLine = new THREE.Line(shortestGeo, shortestMat);
      shortestLine.name = names.shortestLineName || 'Path_Shortest_651m';
      shortestLine.userData.routeKind = 'SHORTEST';
      shortestLine.userData.edgeIds = shortestEdges.map(e => e.edgeId);
      this.pathGroup.add(shortestLine);
      this.disposables.push(shortestGeo, shortestMat);
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
        linewidth: 3.0
      });
      const stairLines = new THREE.LineSegments(stairGeo, stairMat);
      stairLines.name = names.stairHazardsName || 'Stairs_Hazard_Segments';
      stairLines.userData.routeKind = 'SHORTEST';
      stairLines.userData.stairSegments = Object.freeze(stairSegmentsMeta);
      this.pathGroup.add(stairLines);
      this.disposables.push(stairGeo, stairMat);
    }

    // 2. Step-Free Detour Path Polyline
    const stepFreeEdges = stepFreeRoute?.found ? stepFreeRoute.edges : [];
    const stepFreeWaypoints = this._extractRoutePoints(stepFreeEdges);
    this.routePolylines.STEP_FREE = stepFreeWaypoints;

    if (stepFreeWaypoints.length >= 2) {
      const stepFreeGeo = new THREE.BufferGeometry().setFromPoints(stepFreeWaypoints);
      const stepFreeMat = new THREE.LineDashedMaterial({
        color: VISUAL_THEME.PATH_STEP_FREE,
        dashSize: 2.0,
        gapSize: 1.0,
        linewidth: 1.5
      });
      const stepFreeLine = new THREE.Line(stepFreeGeo, stepFreeMat);
      stepFreeLine.computeLineDistances();
      stepFreeLine.name = names.stepFreeLineName || 'Path_StepFree_769m';
      stepFreeLine.userData.routeKind = 'STEP_FREE';
      stepFreeLine.userData.edgeIds = stepFreeEdges.map(e => e.edgeId);
      this.pathGroup.add(stepFreeLine);
      this.disposables.push(stepFreeGeo, stepFreeMat);
    }
  }

  /**
   * Shelter Representation (Athletics Track & Central Pitch Polygon or Configured Shelter Bounds).
   */
  buildShelterRepresentation() {
    const shelter = this.facility.shelter || {};
    const names = this.facility.routeDisplayNames || {};
    const lc = shelter.localCenter || this.router.nodes.get(this.facility.defaultOutdoorTargetNodeId)?.localPos || [226.75, -13.50, 218.17];
    const center = new THREE.Vector3(lc[0], lc[1], lc[2]);
    const trackRadiusX = shelter.trackRadiusX ?? 40.0;
    const trackRadiusZ = shelter.trackRadiusZ ?? 65.0;
    const pitchHalfWidth = shelter.pitchHalfWidth ?? 20.0;
    const pitchHalfLength = shelter.pitchHalfLength ?? 35.0;

    // Elliptical track line
    const trackPoints = [];
    const segs = 48;
    for (let i = 0; i <= segs; i++) {
      const theta = (i / segs) * Math.PI * 2;
      trackPoints.push(new THREE.Vector3(
        center.x + Math.cos(theta) * trackRadiusX,
        center.y,
        center.z + Math.sin(theta) * trackRadiusZ
      ));
    }
    const trackGeo = new THREE.BufferGeometry().setFromPoints(trackPoints);
    const trackMat = new THREE.LineBasicMaterial({
      color: VISUAL_THEME.STADIUM_TRACK,
      transparent: true,
      opacity: 0.6
    });
    const trackLine = new THREE.Line(trackGeo, trackMat);
    trackLine.name = names.shelterTrackName || 'Stadium_Track_Outline';
    this.shelterGroup.add(trackLine);

    // Central Safe Gathering Zone (Grass Pitch Box)
    const pitchPoints = [
      new THREE.Vector3(center.x - pitchHalfWidth, center.y, center.z - pitchHalfLength),
      new THREE.Vector3(center.x + pitchHalfWidth, center.y, center.z - pitchHalfLength),
      new THREE.Vector3(center.x + pitchHalfWidth, center.y, center.z + pitchHalfLength),
      new THREE.Vector3(center.x - pitchHalfWidth, center.y, center.z + pitchHalfLength),
      new THREE.Vector3(center.x - pitchHalfWidth, center.y, center.z - pitchHalfLength)
    ];
    const pitchGeo = new THREE.BufferGeometry().setFromPoints(pitchPoints);
    const pitchMat = new THREE.LineBasicMaterial({
      color: VISUAL_THEME.SELECTED_FLOOR_LINE,
      transparent: true,
      opacity: 0.75
    });
    const pitchLine = new THREE.Line(pitchGeo, pitchMat);
    pitchLine.name = names.shelterPitchName || 'Stadium_Pitch_Safe_Zone';
    this.shelterGroup.add(pitchLine);

    this.disposables.push(trackGeo, trackMat, pitchGeo, pitchMat);
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
        child.visible = mode === 'ALL' || mode === 'STEP_FREE';
      }
    });
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
    }

    const bldgMeta = this.facility.buildingMetadata || {};
    const bldgId = bldgMeta.id || 'FACILITY';
    this.rootGroup.name = bldgId === 'BLDG_212_ENG1' ? 'HanyangBldg212_ResponseRoot' : `${bldgId}_ResponseRoot`;
    this.config.floorHeightMeters = this.facility.floorHeightMeters ?? 3.6;
    this.config.totalLevels = bldgMeta.levels?.aboveGround ?? this.facility.totalLevels ?? 5;
    this.config.selectedFloor = this.facility.defaultFloor ?? 3;

    this.routePolylines = { SHORTEST: [], STEP_FREE: [] };
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
