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
  HANYANG_BUILDING_METADATA,
  HANYANG_3F_INDOOR_GRAPH,
  HANYANG_1F_INDOOR_GRAPH,
  HANYANG_MAIN_STADIUM_SHELTER,
  ROUTE_BASELINES,
  VERIFICATION_STATUS
} from './HanyangBuildingData.js';
import { HANYANG_BLDG212_SE_CONNECTOR } from './IndoorOutdoorConnector.js';
import { PedestrianRoutingEngine, PATH_TYPE } from './PedestrianRoutingEngine.js';

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

export const BLDG_212_OSM_FOOTPRINT_METERS = Object.freeze([
  [21.53, -110.44],
  [17.39, -103.34],
  [11.83, -93.90],
  [22.68, -87.58],
  [25.59, -92.35],
  [69.63, -66.49],
  [60.54, -51.17],
  [70.16, -45.51], // South-East Corner (Exit side)
  [78.81, -40.51],
  [94.78, -67.60],
  [51.01, -93.24],
  [21.53, -110.44]
]);

export class HanyangResponseAdapter {
  /**
   * @param {Object} options
   * @param {THREE.Scene} [options.scene]
   * @param {number} [options.visualScale=1.0] - Visual magnification scale factor
   */
  constructor(options = {}) {
    this.scene = options.scene || null;
    this.anchor = new LocalTangentAnchor(HANYANG_BLDG212_ANCHOR);
    this.router = new PedestrianRoutingEngine();

    // Explicit Separation: Physical vs Visual Coordinate System
    this.config = {
      visualScale: options.visualScale ?? 1.0,
      worldUnitScale: 1.0e-5, // 1 Three.js unit = 100km in global continuous Earth
      floorHeightMeters: 3.6,
      totalLevels: 5,
      selectedFloor: 3, // Default to 3F
      activeRoute: 'ALL' // 'ALL' | 'SHORTEST' | 'STEP_FREE' | 'NONE'
    };

    // Root Group anchored in Three.js Local Space
    this.rootGroup = new THREE.Group();
    this.rootGroup.name = 'HanyangBldg212_ResponseRoot';

    this.floorGroups = new Map();
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
    const footprint = BLDG_212_OSM_FOOTPRINT_METERS;
    const hFloor = this.config.floorHeightMeters;

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

      // Add schematic partitions if 3F (PROVISIONAL)
      if (level === 3) {
        const interiorGroup = this.build3FProvisionalInterior(yBottom);
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

    // Add South-East Vertical Stair Core (Zinc line cylinder/box)
    this.buildStairCoreWireframe();

    // Add Explicit 1F SE Connector Egress Portal
    this.build1FEgressConnector();
  }

  /**
   * Build 3F Schematic Classrooms & Corridors (Tagged strictly as PROVISIONAL).
   */
  build3FProvisionalInterior(yLevel) {
    const interiorGroup = new THREE.Group();
    interiorGroup.name = 'Interior_3F_Provisional';

    // Room 301, 302, 303 schematic partitions
    // Using clean rectilinear wall lines inside building envelope
    const wallLines = [];

    // Main corridor line from West wing to East stairwell
    wallLines.push(new THREE.Vector3(25.0, yLevel, -90.0));
    wallLines.push(new THREE.Vector3(70.0, yLevel, -46.0));

    // Classroom 301 partition
    wallLines.push(new THREE.Vector3(25.0, yLevel, -90.0));
    wallLines.push(new THREE.Vector3(38.0, yLevel, -78.0));
    wallLines.push(new THREE.Vector3(38.0, yLevel, -78.0));
    wallLines.push(new THREE.Vector3(50.0, yLevel, -90.0));

    // Classroom 302 partition
    wallLines.push(new THREE.Vector3(42.0, yLevel, -74.0));
    wallLines.push(new THREE.Vector3(56.0, yLevel, -62.0));

    // Classroom 303 (Research Lab) partition
    wallLines.push(new THREE.Vector3(58.0, yLevel, -60.0));
    wallLines.push(new THREE.Vector3(70.0, yLevel, -48.0));

    const wallGeo = new THREE.BufferGeometry().setFromPoints(wallLines);
    const wallMat = new THREE.LineBasicMaterial({
      color: VISUAL_THEME.SELECTED_FLOOR_LINE,
      transparent: true,
      opacity: 0.85
    });
    const walls = new THREE.LineSegments(wallGeo, wallMat);
    walls.name = '3F_Provisional_Partitions';
    interiorGroup.add(walls);

    this.disposables.push(wallGeo, wallMat);
    return interiorGroup;
  }

  /**
   * Vertical Stair Core Wireframe at South-East Egress Corner.
   */
  buildStairCoreWireframe() {
    const pSE = [70.16, -45.51];
    const w = 4.0;
    const d = 5.0;
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
   * Explicit 1F SE Doorway Portal and 4.0m Transition Vector.
   */
  build1FEgressConnector() {
    const doorPos = new THREE.Vector3(70.16, 0.0, -45.51);
    const footwayPos = new THREE.Vector3(73.68, -0.15, -43.61); // OSM Node 6415394841 (Bearing 118.4°, 4.0m)

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

    // 4.0m Vector line connecting door to outdoor pedestrian node
    const connLinePoints = [doorPos, footwayPos];
    const connGeo = new THREE.BufferGeometry().setFromPoints(connLinePoints);
    const connMat = new THREE.LineDashedMaterial({
      color: VISUAL_THEME.CONNECTOR_WIRE,
      dashSize: 0.4,
      gapSize: 0.2
    });
    const connLine = new THREE.Line(connGeo, connMat);
    connLine.computeLineDistances();
    connLine.name = 'Connector_1F_SE_Line';
    this.rootGroup.add(connLine);

    this.disposables.push(doorGeo, doorMat, connGeo, connMat);
  }

  // --------------------------------------------------------------------------
  // 3. PEDESTRIAN PATH RENDERING (Shortest vs Step-Free)
  // --------------------------------------------------------------------------

  buildPedestrianPaths() {
    const egressNode = new THREE.Vector3(73.68, -0.15, -41.98); // OSM Node 6415394841
    const stadiumNode = new THREE.Vector3(226.75, -13.50, 218.17); // OSM Node 8577408700

    // Shortest Path (651.9m) with 4 outdoor stair flights
    // Intermediate waypoints in local metric coordinates
    const shortestWaypoints = [
      egressNode,
      new THREE.Vector3(77.0, -1.0, -38.0),   // Stair 1 Top (Way 684692285, 19.1m)
      new THREE.Vector3(88.0, -4.5, -23.0),   // Stair 1 Bot
      new THREE.Vector3(95.0, -5.0, -16.0),   // Living street
      new THREE.Vector3(104.0, -5.5, -12.0),  // Stair 2 Top (Way 187409275, 23.0m)
      new THREE.Vector3(118.0, -9.0, 5.0),    // Stair 2 Bot
      new THREE.Vector3(135.0, -9.5, 30.0),   // Pedestrian way
      new THREE.Vector3(145.0, -10.0, 45.0),  // Stair 3 Top (Way 409637898, 16.5m)
      new THREE.Vector3(155.0, -12.5, 57.0),  // Stair 3 Bot
      new THREE.Vector3(175.0, -12.8, 95.0),  // Footway
      new THREE.Vector3(182.0, -13.0, 110.0), // Stair 4 (Way 187436400, 9.9m)
      new THREE.Vector3(190.0, -13.2, 125.0), // Service junction
      new THREE.Vector3(210.0, -13.4, 175.0), // Secondary link
      stadiumNode
    ];

    const shortestGeo = new THREE.BufferGeometry().setFromPoints(shortestWaypoints);
    const shortestMat = new THREE.LineBasicMaterial({
      color: VISUAL_THEME.PATH_SHORTEST,
      linewidth: 2.0
    });
    const shortestLine = new THREE.Line(shortestGeo, shortestMat);
    shortestLine.name = 'Path_Shortest_651m';
    this.pathGroup.add(shortestLine);

    // Highlight the 4 Stair Segments in Amber Caution Tone
    const stairSegments = [
      [shortestWaypoints[1], shortestWaypoints[2]],
      [shortestWaypoints[4], shortestWaypoints[5]],
      [shortestWaypoints[6], shortestWaypoints[7]],
      [shortestWaypoints[9], shortestWaypoints[10]]
    ];
    const stairPoints = [];
    stairSegments.forEach(pair => {
      stairPoints.push(pair[0]);
      stairPoints.push(pair[1]);
    });
    const stairGeo = new THREE.BufferGeometry().setFromPoints(stairPoints);
    const stairMat = new THREE.LineBasicMaterial({
      color: VISUAL_THEME.PATH_STAIRS_HAZARD,
      linewidth: 3.0
    });
    const stairLines = new THREE.LineSegments(stairGeo, stairMat);
    stairLines.name = 'Stairs_Hazard_Segments';
    this.pathGroup.add(stairLines);

    // Step-Free Detour Path (769.1m) - Bypasses stair hill via gradual service road curve
    const stepFreeWaypoints = [
      egressNode,
      new THREE.Vector3(55.0, -0.5, -25.0),
      new THREE.Vector3(45.0, -2.0, 15.0),
      new THREE.Vector3(65.0, -5.0, 65.0),
      new THREE.Vector3(110.0, -8.5, 110.0),
      new THREE.Vector3(160.0, -11.0, 135.0),
      new THREE.Vector3(190.0, -13.2, 125.0), // Merges at service junction
      new THREE.Vector3(210.0, -13.4, 175.0),
      stadiumNode
    ];

    const stepFreeGeo = new THREE.BufferGeometry().setFromPoints(stepFreeWaypoints);
    const stepFreeMat = new THREE.LineDashedMaterial({
      color: VISUAL_THEME.PATH_STEP_FREE,
      dashSize: 2.0,
      gapSize: 1.0,
      linewidth: 1.5
    });
    const stepFreeLine = new THREE.Line(stepFreeGeo, stepFreeMat);
    stepFreeLine.computeLineDistances();
    stepFreeLine.name = 'Path_StepFree_769m';
    this.pathGroup.add(stepFreeLine);

    this.disposables.push(shortestGeo, shortestMat, stairGeo, stairMat, stepFreeGeo, stepFreeMat);
  }

  /**
   * Hanyang Main Stadium (Athletics Track & Central Pitch Polygon).
   */
  buildShelterRepresentation() {
    const center = new THREE.Vector3(226.75, -13.50, 218.17);
    const trackRadiusX = 40.0;
    const trackRadiusZ = 65.0;

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
    trackLine.name = 'Stadium_Track_Outline';
    this.shelterGroup.add(trackLine);

    // Central Safe Gathering Zone (Grass Pitch Box)
    const pitchPoints = [
      new THREE.Vector3(center.x - 20, center.y, center.z - 35),
      new THREE.Vector3(center.x + 20, center.y, center.z - 35),
      new THREE.Vector3(center.x + 20, center.y, center.z + 35),
      new THREE.Vector3(center.x - 20, center.y, center.z + 35),
      new THREE.Vector3(center.x - 20, center.y, center.z - 35)
    ];
    const pitchGeo = new THREE.BufferGeometry().setFromPoints(pitchPoints);
    const pitchMat = new THREE.LineBasicMaterial({
      color: VISUAL_THEME.SELECTED_FLOOR_LINE,
      transparent: true,
      opacity: 0.75
    });
    const pitchLine = new THREE.Line(pitchGeo, pitchMat);
    pitchLine.name = 'Stadium_Pitch_Safe_Zone';
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
   * @param {number} targetLevel - Floor level (1 to 5)
   */
  highlightFloor(targetLevel) {
    if (targetLevel < 1 || targetLevel > this.config.totalLevels) return;
    this.config.selectedFloor = targetLevel;

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
        if (child.name === 'Interior_3F_Provisional') {
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
      if (child.name === 'Path_Shortest_651m' || child.name === 'Stairs_Hazard_Segments') {
        child.visible = mode === 'ALL' || mode === 'SHORTEST';
      }
      if (child.name === 'Path_StepFree_769m') {
        child.visible = mode === 'ALL' || mode === 'STEP_FREE';
      }
    });
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
