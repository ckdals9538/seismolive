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
  HANYANG_3F_INDOOR_GRAPH,
  HANYANG_1F_INDOOR_GRAPH,
  INDOOR_NAV_EDGES,
  HANYANG_MAIN_STADIUM_SHELTER,
  DATA_PROVENANCE_SOURCE,
  VERIFICATION_STATUS
} from './HanyangBuildingData.js';

import { HANYANG_BLDG212_SE_CONNECTOR } from './IndoorOutdoorConnector.js';

export const PATH_TYPE = Object.freeze({
  SHORTEST_RAPID: 'PATH_SHORTEST_RAPID',
  STEP_FREE_DETOUR: 'PATH_STEP_FREE_DETOUR',
  COMPLETE_INDOOR_OUTDOOR: 'PATH_COMPLETE_INDOOR_OUTDOOR'
});

export const USER_MOBILITY_PROFILE = Object.freeze({
  STANDARD_EVACUEE: 'STANDARD_EVACUEE',
  INJURED_LIGHT: 'INJURED_LIGHT',
  WHEELCHAIR_USER: 'WHEELCHAIR_USER',
  ELDERLY_SLOW: 'ELDERLY_SLOW'
});

export const LINK_STATE = Object.freeze({
  OPEN: 'OPEN',           // 통행 가능 (기본 상태 또는 점검 완료)
  SUSPECTED: 'SUSPECTED', // 미확인 장애물/위험 신고 (비용 페널티 적용, 우회 선호)
  CLOSED: 'CLOSED',       // 신뢰할 수 있는 근거로 통행 불가 확정 (경로 계산에서 원천 배제)
  UNKNOWN: 'UNKNOWN'      // 정보 없음 (신선도 소실 또는 미확인)
});

export class PedestrianRoutingEngine {
  constructor() {
    // Adjacency map: nodeId -> Array<{ to, distance, hasStairs, isWheelchairPassable, wayId, highway, hazardRisk, edgeId }>
    this.graph = new Map();
    this.nodes = new Map();
    this.edges = new Map(); // edgeId -> Edge Object

    // Dynamic Link State Registry: edgeId -> LinkStateRecord
    this.linkStates = new Map();

    // Legacy sets maintained for backward compatibility
    this.blockedNodes = new Set();
    this.blockedEdges = new Set();

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
        edgeId: reverseId
      };
      this.graph.get(target).push(reverseEdge);
      this.edges.set(reverseId, reverseEdge);
    }
  }

  /**
   * Populate indoor network, connector, and campus outdoor paths.
   */
  initializeDefaultCampusGraph() {
    // 1. Add Indoor Nodes from 3F
    HANYANG_3F_INDOOR_GRAPH.rooms.forEach(r => {
      this.addNode(r.nodeId, { name: r.name, localPos: r.centerLocalPos });
    });
    HANYANG_3F_INDOOR_GRAPH.corridors[0].centerlineNodes.forEach(c => {
      this.addNode(c, { name: '3F Corridor' });
    });
    this.addNode(HANYANG_3F_INDOOR_GRAPH.stairwells[0].landingNodeId, {
      name: HANYANG_3F_INDOOR_GRAPH.stairwells[0].name,
      localPos: HANYANG_3F_INDOOR_GRAPH.stairwells[0].localPos
    });

    // 2. Add Indoor Nodes from 1F
    this.addNode(HANYANG_1F_INDOOR_GRAPH.stairwells[0].landingNodeId, {
      name: '1F SE Stair Landing',
      localPos: HANYANG_1F_INDOOR_GRAPH.stairwells[0].localPos
    });
    this.addNode(HANYANG_1F_INDOOR_GRAPH.exits[0].portalNodeId, {
      name: HANYANG_1F_INDOOR_GRAPH.exits[0].name,
      localPos: HANYANG_1F_INDOOR_GRAPH.exits[0].localPos
    });

    // 3. Add Indoor Navigation Edges
    INDOOR_NAV_EDGES.forEach(e => {
      this.addEdge(e.source, e.target, {
        distance: e.distance,
        hasStairs: e.hasStairs,
        isWheelchairPassable: e.isWheelchairPassable,
        highway: e.edgeType
      });
    });

    // 4. Add Explicit 1F SE Connector (4.0m)
    const connectorEdge = HANYANG_BLDG212_SE_CONNECTOR.getGraphEdge();
    this.addEdge(connectorEdge.source, connectorEdge.target, {
      distance: connectorEdge.distance,
      hasStairs: connectorEdge.hasStairs,
      isWheelchairPassable: connectorEdge.isWheelchairPassable,
      edgeId: connectorEdge.connectorId,
      highway: 'portal_connector'
    });

    // 5. Add Outdoor Campus Graph Segments (Derived from OSM API 0.6 live query)
    this.buildCampusOutdoorNetwork();

    // 6. Add Shelter Terminal Link
    this.addEdge('OSM_NODE_8577408700', HANYANG_MAIN_STADIUM_SHELTER.shelterId, {
      distance: 21.7, // Track perimeter to pitch centroid
      hasStairs: false,
      isWheelchairPassable: true,
      highway: 'shelter_ingress'
    });
  }

  /**
   * Build calibrated outdoor graph from real OSM Way geometry.
   */
  buildCampusOutdoorNetwork() {
    const egressNode = 'OSM_NODE_6415394841';
    const stadiumNode = 'OSM_NODE_8577408700';

    this.addNode(egressNode, { lat: 37.5556064, lon: 127.0452288, name: '1F SE Outdoor Footway' });
    this.addNode(stadiumNode, { lat: 37.554032, lon: 127.047460, name: 'Stadium Ingress Perimeter' });

    // BRANCH A: Shortest Rapid Path (4 Staircases = 68.5m, Total 651.9m)
    // Way 684692287: footway (4.1m)
    this.addEdge(egressNode, 'NODE_STAIR1_TOP', { distance: 4.1, hasStairs: false, wayId: '684692287', highway: 'footway' });

    // Staircase 1: Way 684692285 (19.1m)
    this.addEdge('NODE_STAIR1_TOP', 'NODE_STAIR1_BOT', { distance: 19.1, hasStairs: true, isWheelchairPassable: false, wayId: '684692285', highway: 'steps', hazardRisk: 'HIGH' });

    // Way 684692288: footway (7.7m)
    this.addEdge('NODE_STAIR1_BOT', 'NODE_LIVING_STREET_1', { distance: 7.7, hasStairs: false, wayId: '684692288', highway: 'footway' });

    // Living Street 187184710: (15.7m)
    this.addEdge('NODE_LIVING_STREET_1', 'NODE_PATH_1487575142', { distance: 15.7, hasStairs: false, wayId: '187184710', highway: 'living_street' });

    // Path 1487575142: (4.4m)
    this.addEdge('NODE_PATH_1487575142', 'NODE_STAIR2_TOP', { distance: 4.4, hasStairs: false, wayId: '1487575142', highway: 'path' });

    // Staircase 2: Way 187409275 (23.0m)
    this.addEdge('NODE_STAIR2_TOP', 'NODE_STAIR2_BOT', { distance: 23.0, hasStairs: true, isWheelchairPassable: false, wayId: '187409275', highway: 'steps', hazardRisk: 'HIGH' });

    // Pedestrian Way 187646030: (50.4m)
    this.addEdge('NODE_STAIR2_BOT', 'NODE_STAIR3_TOP', { distance: 50.4, hasStairs: false, wayId: '187646030', highway: 'pedestrian' });

    // Staircase 3: Way 409637898 (16.5m)
    this.addEdge('NODE_STAIR3_TOP', 'NODE_STAIR3_BOT', { distance: 16.5, hasStairs: true, isWheelchairPassable: false, wayId: '409637898', highway: 'steps', hazardRisk: 'HIGH' });

    // Footway Way 227120060: (62.4m)
    this.addEdge('NODE_STAIR3_BOT', 'NODE_STAIR4_TOP', { distance: 62.4, hasStairs: false, wayId: '227120060', highway: 'footway' });

    // Staircase 4: Way 187436400 (9.9m)
    this.addEdge('NODE_STAIR4_TOP', 'NODE_STAIR4_BOT', { distance: 9.9, hasStairs: true, isWheelchairPassable: false, wayId: '187436400', highway: 'steps', hazardRisk: 'HIGH' });

    // Service Way 187157368: (47.2m)
    this.addEdge('NODE_STAIR4_BOT', 'NODE_SERVICE_JUNCTION', { distance: 47.2, hasStairs: false, wayId: '187157368', highway: 'service' });

    // BRANCH B: Step-Free Detour Alternative (0m Stairs, 769.1m Total)
    // Way 187443876 & 187409280: Egress Node -> RAMP_MID (145.4m)
    this.addEdge(egressNode, 'NODE_RAMP_MID', {
      distance: 145.4,
      hasStairs: false,
      isWheelchairPassable: true,
      wayId: '187443876',
      highway: 'living_street'
    });

    // Way 187409281: RAMP_MID -> SERVICE_JUNCTION (232.2m)
    this.addEdge('NODE_RAMP_MID', 'NODE_SERVICE_JUNCTION', {
      distance: 232.2,
      hasStairs: false,
      isWheelchairPassable: true,
      wayId: '187409281',
      highway: 'service'
    });

    // COMMON LOWER WALKWAY TO STADIUM: (391.5m)
    this.addEdge('NODE_SERVICE_JUNCTION', stadiumNode, {
      distance: 391.5,
      hasStairs: false,
      isWheelchairPassable: true,
      highway: 'service_footway_network'
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
    const isBaselineShortest = (Math.round(actualPhysicalDistance * 10) / 10 === 651.9) ||
                               (Math.round(actualPhysicalDistance * 10) / 10 === 737.9);
    const replanned = !isBaselineShortest || traversedSuspected || traversedUnknown;

    let replanReason = null;
    if (replanned) {
      if (isWheelchair) {
        replanReason = '휠체어 이용자 계단 제약으로 인한 무단차 우회로(769.1m) 산출';
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
    return this.findDynamicPath('OSM_NODE_6415394841', 'OSM_NODE_8577408700', {
      excludeStairs: false
    });
  }

  findOutdoorStepFreePath() {
    return this.findDynamicPath('OSM_NODE_6415394841', 'OSM_NODE_8577408700', {
      excludeStairs: true
    });
  }

  findCompleteIndoorOutdoorPath(originRoomId = 'ROOM_301', options = {}) {
    const room = HANYANG_3F_INDOOR_GRAPH.rooms.find(r => r.roomId === originRoomId || r.nodeId === originRoomId);
    if (!room) {
      throw new Error(`[PedestrianRoutingEngine] Unknown origin room: ${originRoomId}`);
    }
    return this.findDynamicPath(room.nodeId, HANYANG_MAIN_STADIUM_SHELTER.shelterId, options);
  }
}
