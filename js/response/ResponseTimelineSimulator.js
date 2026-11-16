// ============================================================================
// SEISMOLIVE v4.0 — End-to-End Response Timeline Simulator (Phase P2.5)
// Module: js/response/ResponseTimelineSimulator.js
// Purpose: Continuous simulation of earthquake response lifecycle:
//          T+0s (Shaking) -> T+40s (Calm) -> T+65s (Stair Crack) ->
//          T+67s (Detour Replan) -> T+110s (Aftershock & Immediate Suspension)
// Scientific Mandate: Explicit event injection only. No temporal auto-inference.
// ============================================================================

import {
  PedestrianRoutingEngine,
  LINK_STATE
} from './PedestrianRoutingEngine.js';

import {
  ResponseUIAdapter
} from './ResponseUIAdapter.js';

import {
  LOCATION_CERTAINTY,
  MOBILITY_PROFILE
} from './SituationAssessmentEngine.js';

import {
  DATA_PROVENANCE_SOURCE,
  VERIFICATION_STATUS
} from './ResponseDomainTypes.js';

/**
 * Standard P2.5 Timeline Event Definitions
 */
export const P2_5_TIMELINE_EVENTS = Object.freeze([
  {
    simTimeSec: 0,
    label: 'T+0s: 지진 본진 발생 및 실내 즉각 엄폐',
    description: '지반 가속도 계측치(PGA 0.22g) 급증. 실내 두부 보호 최우선 원칙 발동.',
    execute: (adapter) => {
      adapter.setUserLocation({
        locationType: 'INDOOR',
        buildingId: 'BLDG_212_ENG1',
        floor: 3,
        room: 'ROOM_301',
        certainty: LOCATION_CERTAINTY.EXACT_ROOM
      });
      adapter.setMobility(MOBILITY_PROFILE.NONE);
      adapter.setOutdoorPathStatus('UNVERIFIED');
      adapter.setAftershock(false);
      adapter.resetRouteObstacles();
      return adapter.updateStationMotion(0.22, Date.now(), DATA_PROVENANCE_SOURCE.SIMULATED_SCENARIO); // PGA 0.22g -> isShakingActive = true
    }
  },
  {
    simTimeSec: 40,
    label: 'T+40s: 진동 정지 입력 수신 및 3점 상황 점검',
    description: '지반 가속도 계측 안정화(PGA 0.01g). 출구 개방 및 비상계단 피난 결정.',
    execute: (adapter) => {
      return adapter.updateStationMotion(0.01, Date.now(), DATA_PROVENANCE_SOURCE.SIMULATED_SCENARIO); // PGA 0.01g -> isShakingActive = false
    }
  },
  {
    simTimeSec: 65,
    label: 'T+65s: 계단 1구간 균열 미확인 제보 접수',
    description: '일반 이용자로부터 제1계단 난간 균열 및 콘크리트 박리 의심 제보 접수 (SUSPECTED).',
    execute: (adapter) => {
      const stair1Edge = 'NODE_STAIR1_TOP->NODE_STAIR1_BOT';
      return adapter.reportLinkObstacle(stair1Edge, LINK_STATE.SUSPECTED, {
        source: DATA_PROVENANCE_SOURCE.USER_FIELD_REPORT,
        verificationStatus: VERIFICATION_STATUS.PROVISIONAL,
        confidence: 0.60,
        detail: '1층 연결 계단 균열 및 파편 목격 제보'
      });
    }
  },
  {
    simTimeSec: 67,
    label: 'T+67s: 동적 재탐색 적용 및 무단차 우회로 전환',
    description: '의심 계단에 탐색 휴리스틱 가중치 적용되어 무단차 완경사 지선(769.1m)으로 자율 우회.',
    execute: (adapter) => {
      // Re-trigger assessment & replanning with updated state
      return adapter.reassess();
    }
  },
  {
    simTimeSec: 110,
    label: 'T+110s: 여진 발생 입력 수신 및 이동 안내 즉각 차단',
    description: '여진 감지 신호 입력. 보행 이동 즉각 금지, 3D 경로선 화면에서 즉시 소거.',
    execute: (adapter) => {
      adapter.setAftershock(true);
      return adapter.updateStationMotion(0.16, Date.now(), DATA_PROVENANCE_SOURCE.SIMULATED_SCENARIO); // Aftershock PGA 0.16g
    }
  }
]);

/**
 * Mock 3D adapter for headless validation of WebGL synchronization
 */
export class Mock3DResponseAdapter {
  constructor() {
    this.routeDisplay = 'NONE';
    this.highlightedFloor = null;
    this.visible = true;
  }
  setRouteDisplay(mode) {
    this.routeDisplay = mode; // 'NONE' | 'ALL' | 'STEP_FREE'
  }
  highlightFloor(floor) {
    this.highlightedFloor = floor;
  }
  setSelectedFloor(floor) {
    this.highlightedFloor = floor;
  }
}

/**
 * ResponseTimelineSimulator: Orchestrates step-by-step or end-to-end timeline runs,
 * recording complete telemetry at each discrete time point.
 */
export class ResponseTimelineSimulator {
  constructor(options = {}) {
    this.router = options.router || new PedestrianRoutingEngine();
    this.mock3D = options.mock3D || new Mock3DResponseAdapter();
    this.adapter = options.adapter || new ResponseUIAdapter({
      router: this.router,
      hanyangAdapter: this.mock3D
    });

    this.snapshots = new Map(); // simTimeSec -> snapshot
    this.currentSimTime = 0;
  }

  /**
   * Reset simulator state
   */
  reset() {
    this.router.resetAllLinkStates();
    this.adapter.resetRouteObstacles();
    this.adapter.setAftershock(false);
    this.mock3D.routeDisplay = 'NONE';
    this.mock3D.highlightedFloor = null;
    this.snapshots.clear();
    this.currentSimTime = 0;
  }

  /**
   * Execute an explicit timeline event and record the state snapshot.
   */
  executeEvent(eventDef) {
    this.currentSimTime = eventDef.simTimeSec;
    const guidance = eventDef.execute(this.adapter);
    const snapshot = this.captureSnapshot(eventDef.simTimeSec, eventDef.label);
    this.snapshots.set(eventDef.simTimeSec, snapshot);
    return snapshot;
  }

  /**
   * Run the complete standard P2.5 baseline timeline.
   */
  runFullTimeline() {
    this.reset();
    const results = [];
    for (const eventDef of P2_5_TIMELINE_EVENTS) {
      const snap = this.executeEvent(eventDef);
      results.push(snap);
    }
    return results;
  }

  /**
   * Capture a full diagnostic snapshot across all subsystems.
   */
  captureSnapshot(simTimeSec, eventLabel) {
    const assessment = this.adapter.lastAssessment;
    const guidance = this.adapter.lastGuidance;
    const route = this.adapter.lastRouteResult;

    const linkStatesList = [];
    for (const [edgeId, stateRec] of this.router.linkStates.entries()) {
      linkStatesList.push({
        edgeId,
        state: stateRec.state,
        source: stateRec.source,
        confidence: stateRec.confidence,
        verificationStatus: stateRec.verificationStatus
      });
    }

    const snapshot = {
      simTimeSec,
      eventLabel,
      timestamp: Date.now(),
      // Situation Assessment Layer
      assessment: {
        tacticalState: assessment ? assessment.recommendedAction.tacticalState : null,
        urgency: assessment ? assessment.recommendedAction.urgency : null,
        canMove: assessment ? assessment.canMove : false,
        canNavigate: assessment ? assessment.canNavigate : false,
        isShakingActive: this.adapter.context.disaster.isShakingActive,
        hasAftershock: this.adapter.context.disaster.hasAftershock,
        conflictResolution: assessment ? assessment.conflictResolution : null
      },
      // UI Guidance Layer
      guidance: {
        phaseHeadline: guidance ? guidance.phaseHeadline : '',
        badgeText: guidance ? guidance.badgeText : '',
        primaryAction: guidance ? guidance.primaryAction : '',
        secondaryAction: guidance ? guidance.secondaryAction : '',
        warnings: guidance ? [...guidance.warnings] : [],
        unverifiedItems: guidance ? [...guidance.unverifiedItems] : [],
        replanStatus: guidance ? guidance.replanStatus : null
      },
      // Routing Subsystem
      routing: {
        found: route ? route.found : false,
        totalDistanceMeters: route ? route.totalDistanceMeters : 0,
        totalStairsDistanceMeters: route ? route.totalStairsDistanceMeters : 0,
        isStepFree: route ? route.isStepFree : false,
        isWheelchairVerified: route ? route.isWheelchairVerified : false,
        replanned: route ? route.replanned : false,
        replanReason: route ? route.replanReason : null,
        traversedSuspected: route ? route.traversedSuspected : false,
        traversedUnknown: route ? route.traversedUnknown : false,
        linkStates: linkStatesList
      },
      // 3D Scene Synchronization State
      scene3D: {
        routeDisplayMode: guidance?.routeStatus?.displayMode || 'HIDDEN',
        actual3DMode: this.mock3D.routeDisplay,
        highlightedFloor: this.mock3D.highlightedFloor
      }
    };

    return Object.freeze(snapshot);
  }

  /**
   * Verify all strict system integrity invariants on a given snapshot.
   */
  verifyInvariants(snapshot) {
    const violations = [];

    // Invariant 1: If canMove === false, 3D route MUST be NONE and routeDisplayMode MUST be HIDDEN
    if (!snapshot.assessment.canMove) {
      if (snapshot.scene3D.actual3DMode !== 'NONE') {
        violations.push(`Violation: canMove is false, but 3D route display is '${snapshot.scene3D.actual3DMode}' (must be 'NONE').`);
      }
      if (snapshot.scene3D.routeDisplayMode !== 'HIDDEN') {
        violations.push(`Violation: canMove is false, but guidance displayMode is '${snapshot.scene3D.routeDisplayMode}' (must be 'HIDDEN').`);
      }
    }

    // Invariant 2: If aftershock is active, canMove and canNavigate MUST both be false
    if (snapshot.assessment.hasAftershock) {
      if (snapshot.assessment.canMove) {
        violations.push('Violation: Aftershock active, but canMove is true.');
      }
      if (snapshot.assessment.canNavigate) {
        violations.push('Violation: Aftershock active, but canNavigate is true.');
      }
      if (snapshot.scene3D.actual3DMode !== 'NONE') {
        violations.push('Violation: Aftershock active, but 3D route remains displayed on screen.');
      }
    }

    // Invariant 3: Wheelchair verification must NEVER be true without field measurements
    if (snapshot.routing.isWheelchairVerified) {
      violations.push('Violation: isWheelchairVerified is true without F-03/F-05 on-site verification.');
    }

    // Invariant 4: If no route found, shelter in place guidance must be present
    if (!snapshot.routing.found && snapshot.assessment.canMove && snapshot.assessment.canNavigate) {
      if (snapshot.scene3D.actual3DMode !== 'NONE') {
        violations.push('Violation: Route not found, but 3D display is active.');
      }
    }

    return {
      passed: violations.length === 0,
      violations
    };
  }
}
