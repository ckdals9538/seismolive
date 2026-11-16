// ============================================================================
// SEISMOLIVE v4.0 — Dynamic Campus Pedestrian Routing Engine
// File: js/response/PedestrianRoutingEngine.js
//
// Dual-Path graph routing engine supporting Shortest Rapid Path (651.9m)
// and Step-Free Detour Path (769.1m) from Room 301 down to Hanyang Main Stadium.
//
// Enhanced (Phase P2.4):
//   - Dynamic Link State Model: OPEN, SUSPECTED, CLOSED, UNKNOWN.
//   - Source Provenance Tracking: User report vs Official closure distinction.
//   - Penalized Cost Dijkstra: Diverts around SUSPECTED edges when viable alternatives exist.
//   - Rigorous Mobility Distinction: "Step-Free" does NOT equal "Wheelchair Verified".
//   - Fail-Safe: Severe multi-link blockage triggers graceful NO_VIABLE_PATH.
//   - Zero Fake Data: Graph topology strictly matches calibrated OSM Way geometry.
// ============================================================================

import {
  DEFAULT_HANYANG_FACILITY_PACKAGE
} from './HanyangBuildingData.js';
import {
  DATA_PROVENANCE_SOURCE,
  VERIFICATION_STATUS,
  PATH_TYPE,
  USER_MOBILITY_PROFILE,
  LINK_STATE
} from './ResponseDomainTypes.js';

export {
  PATH_TYPE,
  USER_MOBILITY_PROFILE,
  LINK_STATE,
  DATA_PROVENANCE_SOURCE,
  VERIFICATION_STATUS
};

export class PedestrianRoutingEngine {
  /**
   * @param {Object} [options]
   * @param {Object} [options.facilityPackage] - Injectable building/campus dataset (defaults to Hanyang Bldg 212)
   */
  constructor(options = {}) {
    // Adjacency map: nodeId -> Array<{ to, distance, hasStairs, isWheelchairPassable, wayId, highway, hazardRisk, edgeId, branch, waypoints }>
    this.graph = new Map();
    this.nodes = new Map();
    this.edges = new Map(); // edgeId -> Edge Object

    // Dynamic Link State Registry: edgeId -> LinkStateRecord
    this.linkStates = new Map();

    // Legacy sets maintained for backward compatibility
    this.blockedNodes = new Set();
    this.blockedEdges = new Set();

    this.facility = options.facilityPackage || DEFAULT_HANYANG_FACILITY_PACKAGE;
    this.initializeDefaultCampusGraph();
  }

  /**
   * Load or switch to a new FacilityPackage cleanly (supports multi-building / multi-campus injection).
   * @param {Object} facilityPackage
   */
  loadFacilityPackage(facilityPackage) {
    if (!facilityPackage) {
      throw new Error('[PedestrianRoutingEngine] facilityPackage is required.');
    }
    this.facility = facilityPackage;
    this.graph.clear();
    this.nodes.clear();
    this.edges.clear();
    this.linkStates.clear();
    this.blockedNodes.clear();
    this.blockedEdges.clear();
    this.initializeDefaultCampusGraph();
  }

  /**
   * Add a node to the spatial graph.
   */
  addNode(nodeId, metadata = {}) {
    if (!this.nodes.has(nodeId)) {
      this.nodes.set(nodeId, {
        id: nodeId,
        ...metadata
      });
    } else if (metadata && Object.keys(metadata).length > 0) {
      this.nodes.set(nodeId, {
        ...this.nodes.get(nodeId),
        ...metadata
      });
    }
    if (!this.graph.has(nodeId)) {
      this.graph.set(nodeId, []);
    }
  }

  /**
   * Add an edge between two nodes (bidirectional or directed).
   */
  addEdge(source, target, options = {}) {
    this.addNode(source);
    this.addNode(target);

    const edgeId = options.edgeId || `${source}->${target}`;

    const edgeObj = {
      from: source,
      to: target,
      distance: options.distance ?? 1.0,
      hasStairs: options.hasStairs ?? false,
      isWheelchairPassable: options.isWheelchairPassable ?? !options.hasStairs,
      wayId: options.wayId || 'virtual_link',
      highway: options.highway || 'footway',
      hazardRisk: options.hazardRisk || 'LOW',
      branch: options.branch || null,
      waypoints: options.waypoints || null,
      edgeId
    };

    this.graph.get(source).push(edgeObj);
    this.edges.set(edgeId, edgeObj);

    if (options.bidirectional !== false) {
      const reverseId = `${target}->${source}`;
      const reverseEdge = {
        ...edgeObj,
        from: target,
        to: source,
        waypoints: Array.isArray(edgeObj.waypoints) ? [...edgeObj.waypoints].reverse() : null,
        edgeId: reverseId
      };
      this.graph.get(target).push(reverseEdge);
      this.edges.set(reverseId, reverseEdge);
    }
  }

  /**
   * Populate indoor network, connector, and campus outdoor paths from the injected FacilityPackage.
   */
  initializeDefaultCampusGraph() {
    const f = this.facility || DEFAULT_HANYANG_FACILITY_PACKAGE;

    // 1. Add Indoor Nodes across all configured floors
    Object.values(f.indoorGraphs || {}).forEach(floorGraph => {
      (floorGraph.rooms || []).forEach(r => {
        this.addNode(r.nodeId, { name: r.name, localPos: r.centerLocalPos, floor: floorGraph.levelIndex });
      });
      (floorGraph.corridors || []).forEach(corr => {
        (corr.centerlineNodes || []).forEach(c => {
          this.addNode(c, { name: `${floorGraph.floorId || 'Floor'} Corridor`, floor: floorGraph.levelIndex });
        });
      });
      (floorGraph.stairwells || []).forEach(sw => {
        this.addNode(sw.landingNodeId, {
          name: sw.name || sw.stairwellId,
          localPos: sw.localPos,
          floor: floorGraph.levelIndex
        });
      });
      (floorGraph.exits || []).forEach(ex => {
        this.addNode(ex.portalNodeId, {
          name: ex.name || ex.exitId,
          localPos: ex.localPos,
          floor: floorGraph.levelIndex
        });
      });
    });

    // 2. Add Indoor Navigation Edges
    (f.indoorEdges || []).forEach(e => {
      this.addEdge(e.source, e.target, {
        distance: e.distance,
        hasStairs: e.hasStairs,
        isWheelchairPassable: e.isWheelchairPassable,
        highway: e.edgeType,
        edgeId: e.edgeId
      });
    });

    // 3. Add Explicit Indoor-Outdoor Connector Portal
    if (f.connector) {
      this.addEdge(f.connector.source, f.connector.target, {
        distance: f.connector.distance,
        hasStairs: f.connector.hasStairs ?? false,
        isWheelchairPassable: f.connector.isWheelchairPassable ?? false,
        edgeId: f.connector.connectorId,
        highway: 'portal_connector'
      });
    }

    // 4. Add Outdoor Campus Graph Segments
    this.buildCampusOutdoorNetwork();

    // 5. Add Shelter Terminal Link
    if (f.shelter && f.defaultOutdoorTargetNodeId) {
      this.addEdge(f.defaultOutdoorTargetNodeId, f.shelter.shelterId, {
        distance: f.shelter.ingressDistanceMeters ?? 21.7,
        hasStairs: false,
        isWheelchairPassable: true,
        highway: 'shelter_ingress'
      });
    }
  }

  /**
   * Build calibrated outdoor graph from the injected FacilityPackage.outdoorGraph.
   */
  buildCampusOutdoorNetwork() {
    const outdoorGraph = this.facility?.outdoorGraph;
    if (!outdoorGraph) return;

    (outdoorGraph.nodes || []).forEach(node => {
      this.addNode(node.id, {
        lat: node.lat,
        lon: node.lon,
        name: node.name,
        localPos: node.localPos
      });
    });

    (outdoorGraph.edges || []).forEach(edge => {
      this.addEdge(edge.source, edge.target, {
        edgeId: edge.edgeId || `${edge.source}->${edge.target}`,
        distance: edge.distance,
        hasStairs: !!edge.hasStairs,
        isWheelchairPassable: edge.isWheelchairPassable,
        wayId: edge.wayId,
        highway: edge.highway,
        hazardRisk: edge.hazardRisk,
        branch: edge.branch,
        waypoints: edge.waypoints
      });
    });
  }

  // --------------------------------------------------------------------------
  // DYNAMIC LINK STATE MANAGEMENT (Phase P2.4)
  // --------------------------------------------------------------------------

  /**
   * Register or update the dynamic state of a route link.
   *
   * @param {string} edgeId - Unique ID (e.g. 'NODE_STAIR1_TOP->NODE_STAIR1_BOT')
   * @param {string} state - LINK_STATE.OPEN | SUSPECTED | CLOSED | UNKNOWN
   * @param {Object} [metadata]
   */
  setLinkState(edgeId, state, metadata = {}) {
    const now = Date.now();
    const record = {
      edgeId,
      state,
      source: metadata.source || DATA_PROVENANCE_SOURCE.USER_FIELD_REPORT,
      observedAt: metadata.observedAt || now,
      receivedAt: now,
      verificationStatus: metadata.verificationStatus || (
        metadata.source === DATA_PROVENANCE_SOURCE.OFFICIAL_DISASTER_INFO ? VERIFICATION_STATUS.VERIFIED : VERIFICATION_STATUS.PROVISIONAL
      ),
      confidence: metadata.confidence ?? (state === LINK_STATE.CLOSED ? 0.9 : 0.6),
      location: metadata.location || edgeId,
      reportId: metadata.reportId || `REP_${now}_${Math.floor(Math.random() * 1000)}`,
      detail: metadata.detail || ''
    };

    this.linkStates.set(edgeId, record);

    // Sync with legacy blockedEdges set if CLOSED
    if (state === LINK_STATE.CLOSED) {
      this.blockedEdges.add(edgeId);
    } else {
      this.blockedEdges.delete(edgeId);
    }

    return record;
  }

  /**
   * Get dynamic state record for a link.
   */
  getLinkState(edgeId) {
    if (this.linkStates.has(edgeId)) {
      const rec = this.linkStates.get(edgeId);
      // Freshness check: if older than 180 seconds and unverified, degrade confidence
      const ageSec = (Date.now() - rec.receivedAt) / 1000;
      const isStale = ageSec > 180;
      return {
        ...rec,
        isStale,
        effectiveConfidence: isStale ? Math.max(0.2, rec.confidence * 0.5) : rec.confidence
      };
    }
    return {
      edgeId,
      state: LINK_STATE.OPEN,
      verificationStatus: VERIFICATION_STATUS.PARTIALLY_VERIFIED,
      confidence: 1.0,
      isStale: false
    };
  }

  /**
   * Clear obstacle on a link. Note: strictly marks as RE_VERIFICATION_PENDING if unverified.
   */
  clearLinkState(edgeId, verifiedByOfficial = false) {
    if (!this.linkStates.has(edgeId)) return;

    if (verifiedByOfficial) {
      this.linkStates.delete(edgeId);
      this.blockedEdges.delete(edgeId);
    } else {
      // Conservative normalization: set to UNKNOWN pending re-verification
      this.setLinkState(edgeId, LINK_STATE.UNKNOWN, {
        source: DATA_PROVENANCE_SOURCE.USER_FIELD_REPORT,
        detail: '장애물 해제 보고 접수됨 (공식 현장 확인 대기)'
      });
      this.blockedEdges.delete(edgeId);
    }
  }

  /**
   * Reset all dynamic states back to baseline.
   */
  resetAllLinkStates() {
    this.linkStates.clear();
    this.blockedEdges.clear();
    this.blockedNodes.clear();
  }

  // --------------------------------------------------------------------------
  // DYNAMIC REPLANNING DIJKSTRA (Phase P2.4 / P2.5 Refined)
  // --------------------------------------------------------------------------

  /**
   * Execute dynamic multi-criteria route replanning.
   *
   * Routing Cost & Heuristic Principles (P2.5 Pre-implementation Refinement):
   *   1. CLOSED links are excluded from route candidates completely (cost = Infinity).
   *   2. SUSPECTED links receive an empirical heuristic search penalty:
   *      cost = length * 2.0 + 200.0m.
   *      NOTE: This numerical formula is strictly an empirical routing search heuristic
   *      to detour around reported hazard spots when alternative paths exist.
   *      It does NOT represent a physical risk probability, accident rate, or structural safety score.
   *   3. UNKNOWN links are NOT treated as verified OPEN; an empirical search penalty is applied
   *      (cost = length * 1.5 + 50.0m) to prioritize verified open segments.
   *   4. An unverified alternative path is NEVER described as "safe" (안전한 경로);
   *      any uncertainty on candidate links is propagated to the UI.
   *   5. If mobility is WHEELCHAIR, exclude all stairs, but mark wheelchair verification as PROVISIONAL.
   *   6. If no path is viable, returns found: false with failSafeGuidance (Shelter-in-Place).
   *      NOTE: Shelter-in-Place is temporary defensive action guidance due to severed paths,
   *      NOT a guarantee of building structural safety.
   *
   * @param {string} startNodeId
   * @param {string} targetNodeId
   * @param {Object} [options]
   */
  findDynamicPath(startNodeId, targetNodeId, options = {}) {
    const isWheelchair = options.mobilityProfile === USER_MOBILITY_PROFILE.WHEELCHAIR_USER;
    const excludeStairs = (options.excludeStairs ?? false) || isWheelchair;

    const dynamicBlockedNodes = new Set([...this.blockedNodes, ...(options.blockedNodes || [])]);
    const dynamicBlockedEdges = new Set([...this.blockedEdges, ...(options.blockedEdges || [])]);

    const dist = new Map();
    const prev = new Map();
    const visited = new Set();

    // Priority queue sorted by cost
    const queue = [{ id: startNodeId, cost: 0.0 }];
    dist.set(startNodeId, 0.0);

    while (queue.length > 0) {
      queue.sort((a, b) => a.cost - b.cost);
      const current = queue.shift();
      const u = current.id;

      if (u === targetNodeId) break;
      if (visited.has(u)) continue;
      visited.add(u);

      const neighbors = this.graph.get(u) || [];
      for (const edge of neighbors) {
        const v = edge.to;
        if (visited.has(v)) continue;
        if (dynamicBlockedNodes.has(v)) continue;

        // 1. Check Link State
        const linkRec = this.getLinkState(edge.edgeId);
        if (linkRec.state === LINK_STATE.CLOSED || dynamicBlockedEdges.has(edge.edgeId)) {
          continue; // Rule 1: Exclude CLOSED edges completely
        }

        // 2. Check Stair / Mobility Constraints
        if (excludeStairs && edge.hasStairs) continue;

        // 3. Compute Effective Search Heuristic Cost
        let costMultiplier = 1.0;
        let additivePenalty = 0.0;
        if (linkRec.state === LINK_STATE.SUSPECTED) {
          // Empirical heuristic search penalty (NOT a physical risk probability)
          // Prefers clean alternatives (such as the +117.2m detour) when available
          costMultiplier = 2.0;
          additivePenalty = 200.0;
        } else if (linkRec.state === LINK_STATE.UNKNOWN) {
          // UNKNOWN is not assumed open; empirical heuristic to prefer verified open links
          costMultiplier = 1.5;
          additivePenalty = 50.0;
        }

        const edgeWeight = edge.distance * costMultiplier + additivePenalty;
        const currentDist = dist.get(u);
        const newDist = currentDist + edgeWeight;

        if (!dist.has(v) || newDist < dist.get(v)) {
          dist.set(v, newDist);
          prev.set(v, { from: u, edge, linkRec });
          queue.push({ id: v, cost: newDist });
        }
      }
    }

    // FAIL-SAFE: No viable path found
    if (!dist.has(targetNodeId)) {
      return Object.freeze({
        found: false,
        totalDistanceMeters: 0,
        totalStairsDistanceMeters: 0,
        hasStairs: false,
        stairFlightCount: 0,
        isStepFree: false,
        isWheelchairPassable: false,
        isWheelchairVerified: false,
        pathType: 'NONE',
        replanned: true,
        replanReason: '모든 주요 대피 경로가 차단되었거나 안전 통행 조건을 만족하지 못함',
        failSafeGuidance: '이동 가능한 대피 경로가 모두 차단되었습니다. 무리한 탈출을 멈추고 안전 호실에 잔류(Shelter-in-Place)하며 구조를 요청하십시오. (주의: 실내 잔류는 건물의 구조적 안전성을 보증하는 것이 아니며, 탈출로 단절에 따른 임시 방호 조치입니다)',
        nodes: [],
        edges: [],
        hazardAlerts: ['NO_VIABLE_PATH: Egress route severed or blocked by constraints.'],
        unverifiedSegments: []
      });
    }

    // Reconstruct Path
    const pathEdges = [];
    const pathNodes = [targetNodeId];
    let curr = targetNodeId;
    let actualPhysicalDistance = 0.0;
    let totalStairsDistance = 0.0;
    let stairFlightCount = 0;
    let traversedSuspected = false;
    let traversedUnknown = false;
    const hazardAlerts = [];
    const unverifiedSegments = [];

    while (prev.has(curr)) {
      const step = prev.get(curr);
      pathEdges.unshift(step.edge);
      pathNodes.unshift(step.from);

      actualPhysicalDistance += step.edge.distance;

      if (step.edge.hasStairs) {
        totalStairsDistance += step.edge.distance;
        stairFlightCount++;
      }

      if (step.linkRec.state === LINK_STATE.SUSPECTED) {
        traversedSuspected = true;
        hazardAlerts.push(`경고: 산출 경로 구간 [${step.edge.edgeId}]에 미확인 위험 신고(SUSPECTED)가 있습니다. 주변 낙하물 및 균열에 각별히 주의하십시오.`);
      }
      if (step.linkRec.state === LINK_STATE.UNKNOWN || step.linkRec.isStale) {
        traversedUnknown = true;
        unverifiedSegments.push(step.edge.edgeId);
        hazardAlerts.push(`주의: 산출 경로 구간 [${step.edge.edgeId}]은 현장 안전이 미확인된 구간(UNKNOWN)입니다. 안전을 확신하지 말고 육안 확인 후 통행하십시오.`);
      }

      curr = step.from;
    }

    const isStepFree = stairFlightCount === 0;

    // Detect if this path was replanned / diverted from baseline shortest
    const roundedDist = Math.round(actualPhysicalDistance * 10) / 10;
    const outdoorBaselineLen = this.facility?.routeBaselines?.PATH_SHORTEST_RAPID?.targetLengthMeters ?? 651.9;
    const stepFreeBaselineLen = this.facility?.routeBaselines?.PATH_STEP_FREE_DETOUR?.targetLengthMeters ?? 769.1;
    const completeBaselineLen = this.facility?.routeBaselines?.COMPLETE_SHORTEST?.targetLengthMeters ?? 737.9;
    const isBaselineShortest = (roundedDist === outdoorBaselineLen) || (roundedDist === completeBaselineLen);
    const replanned = !isBaselineShortest || traversedSuspected || traversedUnknown;

    let replanReason = null;
    if (replanned) {
      if (isWheelchair) {
        replanReason = `휠체어 이용자 계단 제약으로 인한 무단차 우회로(${stepFreeBaselineLen}m) 산출`;
      } else if (traversedSuspected) {
        replanReason = '최단 경로 상 미확인 위험(SUSPECTED) 회피 불가로 주의 통행 적용';
      } else {
        replanReason = '기존 최단 경로 상 장애물(CLOSED/SUSPECTED)로 인한 대체 우회로 산출';
      }
    }

    // Strict Directive: "Step-free" in OSM does NOT mean "Wheelchair Verified" on-site
    const isWheelchairVerified = false; // Always false until F-03/F-05 on-site measurements!

    if (isWheelchair) {
      hazardAlerts.push('주의: 무단차 우회로는 지도 데이터상 계단이 없는 경로이나, 현장 경사도/단차 실측(F-03/F-05) 전이므로 안전을 보증하지 않습니다.');
    }

    return Object.freeze({
      found: true,
      totalDistanceMeters: Math.round(actualPhysicalDistance * 10) / 10,
      totalStairsDistanceMeters: Math.round(totalStairsDistance * 10) / 10,
      hasStairs: stairFlightCount > 0,
      stairFlightCount,
      isStepFree,
      isWheelchairPassable: isStepFree, // Backward-compatible boolean
      isWheelchairVerified,
      pathType: isStepFree ? PATH_TYPE.STEP_FREE_DETOUR : PATH_TYPE.SHORTEST_RAPID,
      replanned,
      replanReason,
      traversedSuspected,
      traversedUnknown,
      nodes: Object.freeze(pathNodes),
      edges: Object.freeze(pathEdges),
      hazardAlerts: Object.freeze(hazardAlerts),
      unverifiedSegments: Object.freeze(unverifiedSegments)
    });
  }

  // --------------------------------------------------------------------------
  // LEGACY CONVENIENCE WRAPPERS (Maintained for Backward Compatibility)
  // --------------------------------------------------------------------------

  findPath(startNodeId, targetNodeId, options = {}) {
    return this.findDynamicPath(startNodeId, targetNodeId, options);
  }

  findOutdoorShortestPath() {
    const startId = this.facility?.defaultOutdoorEgressNodeId || 'OSM_NODE_6415394841';
    const targetId = this.facility?.defaultOutdoorTargetNodeId || 'OSM_NODE_8577408700';
    return this.findDynamicPath(startId, targetId, {
      excludeStairs: false
    });
  }

  findOutdoorStepFreePath() {
    const startId = this.facility?.defaultOutdoorEgressNodeId || 'OSM_NODE_6415394841';
    const targetId = this.facility?.defaultOutdoorTargetNodeId || 'OSM_NODE_8577408700';
    return this.findDynamicPath(startId, targetId, {
      excludeStairs: true
    });
  }

  findCompleteIndoorOutdoorPath(originRoomId = null, options = {}) {
    const lookupRoomId = originRoomId || this.facility?.defaultRoomId || 'ROOM_301';
    let room = null;
    for (const floorGraph of Object.values(this.facility?.indoorGraphs || {})) {
      const found = (floorGraph.rooms || []).find(r => r.roomId === lookupRoomId || r.nodeId === lookupRoomId);
      if (found) {
        room = found;
        break;
      }
    }
    if (!room) {
      throw new Error(`[PedestrianRoutingEngine] Unknown origin room: ${lookupRoomId}`);
    }
    const targetShelterId = this.facility?.shelter?.shelterId || 'SHELTER_HANYANG_STADIUM';
    return this.findDynamicPath(room.nodeId, targetShelterId, options);
  }
}
