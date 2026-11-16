// ============================================================================
// SEISMOLIVE v4.0 — Situation Assessment to UI/3D Bridge Adapter
// File: js/response/ResponseUIAdapter.js
//
// Pure presentation & coordinator layer bridging SituationAssessmentEngine
// with PedestrianRoutingEngine (dynamic replanning), HanyangResponseAdapter (3D scene graph),
// and typography-led editorial text delivery.
//
// Design Mandates:
//   - Decoupled: UI or 3D code never mutates evaluation rules directly.
//   - Dynamic Route Replanning: Coordinates link obstacles and dynamic Dijkstra.
//   - Action-First Korean presentation: No internal S1/S2 codes or enum strings exposed.
//   - Safe Path Guarantee: If canMove or canNavigate is false or path is severed, 3D path vectors are disabled.
//   - Unverified Caveats: Explicitly distinguishes "Step-Free" from "Wheelchair Verified".
//   - Aesthetic Integrity: Nocturnal Monolith (deep black, white wireframe, no card clutter).
// ============================================================================

import {
  SituationAssessmentEngine,
  LOCATION_CERTAINTY,
  MOBILITY_PROFILE
} from './SituationAssessmentEngine.js';

import {
  PedestrianRoutingEngine,
  LINK_STATE,
  USER_MOBILITY_PROFILE,
  PATH_TYPE
} from './PedestrianRoutingEngine.js';

import {
  DEFAULT_HANYANG_FACILITY_PACKAGE
} from './HanyangBuildingData.js';
import {
  DATA_PROVENANCE_SOURCE,
  VERIFICATION_STATUS,
  isProtectiveShakingOnset
} from './ResponseDomainTypes.js';
import { GroundDataManager } from './GroundDataContract.js';

export class ResponseUIAdapter {
  /**
   * @param {Object} [options]
   * @param {SituationAssessmentEngine} [options.engine]
   * @param {PedestrianRoutingEngine} [options.router]
   * @param {GroundDataManager} [options.groundDataManager]
   * @param {Object} [options.hanyangAdapter] - Instance of HanyangResponseAdapter (optional)
   * @param {Object} [options.facilityPackage] - Injectable FacilityPackage (defaults to Hanyang Bldg 212)
   * @param {Function} [options.onGuidanceUpdate] - Callback receiving UserFacingGuidance
   */
  constructor(options = {}) {
    this.facility = options.facilityPackage || options.hanyangAdapter?.facility || DEFAULT_HANYANG_FACILITY_PACKAGE;
    this.groundDataManager = options.groundDataManager || new GroundDataManager();
    this.engine = options.engine || new SituationAssessmentEngine();
    this.router = options.router || new PedestrianRoutingEngine({
      facilityPackage: this.facility,
      groundDataManager: this.groundDataManager
    });
    if (!this.router.groundDataManager) {
      this.router.groundDataManager = this.groundDataManager;
    }
    this.hanyangAdapter = options.hanyangAdapter || null;
    this.onGuidanceUpdate = options.onGuidanceUpdate || null;

    // Preferred route display mode when navigation is enabled
    this.preferredRouteMode = 'ALL'; // 'ALL' | 'SHORTEST' | 'STEP_FREE'

    const meta = this.facility.buildingMetadata || {};
    const hasIndoorData = meta.indoorScope
      ? Boolean(meta.indoorScope.hasIndoorData)
      : Object.keys(this.facility.indoorGraphs || {}).length > 0;

    // Canonical Assessment Input Context
    this.context = {
      timestamp: Date.now(),
      disaster: {
        isShakingActive: false,
        hasAftershock: false,
        reportedFireOrSmoke: false,
        reportedGasLeak: false,
        pga_g: options.initialStation?.pga_g ?? null
      },
      user: {
        locationType: hasIndoorData ? 'INDOOR' : 'OUTDOOR',
        buildingId: meta.id || 'BLDG_212_ENG1',
        floor: hasIndoorData ? (this.facility.defaultFloor ?? 3) : 1,
        room: hasIndoorData ? (this.facility.defaultRoomId || 'ROOM_301') : null,
        locationCertainty: LOCATION_CERTAINTY.MANUAL_EXACT,
        mobilityLimitation: MOBILITY_PROFILE.NONE
      },
      spatial: {
        corridorPassable: true,
        exitPassable: true,
        stairsPassable: true,
        outdoorPathStatus: 'UNVERIFIED', // Default unverified until field checked
        hasIndoorData,
        impactStatus: meta.impactStatus || 'IN_IMPACT_ZONE',
        destinationStatus: meta.destinationStatus || (this.facility.shelter ? 'CONFIRMED' : 'UNAVAILABLE'),
        destinationName: meta.shelterName || this.facility.shelter?.name || null,
        regionLabel: meta.regionLabel || meta.name || null,
        facilityName: meta.name || null
      },
      sources: {
        station: options.initialStation || null,
        official: null,
        userReports: []
      }
    };

    // Last evaluated results
    this.lastAssessment = null;
    this.lastRouteResult = null;
    this.lastGuidance = null;
  }

  // --------------------------------------------------------------------------
  // DYNAMIC LINK OBSTACLE MANAGEMENT (Phase P2.4)
  // --------------------------------------------------------------------------

  /**
   * Report an obstacle or blockage on a specific route link.
   * @param {string} edgeId - e.g. 'NODE_STAIR1_TOP->NODE_STAIR1_BOT'
   * @param {string} state - LINK_STATE.SUSPECTED | CLOSED | UNKNOWN
   * @param {Object} [metadata]
   */
  reportLinkObstacle(edgeId, state = LINK_STATE.CLOSED, metadata = {}) {
    this.router.setLinkState(edgeId, state, metadata);
    return this.reassess();
  }

  /**
   * Clear an obstacle on a route link.
   * @param {string} edgeId
   * @param {boolean} [verifiedByOfficial=false]
   */
  clearLinkObstacle(edgeId, verifiedByOfficial = false) {
    this.router.clearLinkState(edgeId, verifiedByOfficial);
    return this.reassess();
  }

  /**
   * Reset all route link obstacles back to baseline.
   */
  resetRouteObstacles() {
    this.router.resetAllLinkStates();
    return this.reassess();
  }

  /**
   * Register a spatial hazard avoidance polygon (Tier 2.1).
   */
  addAvoidPolygon(polyDef) {
    const rec = this.router.addAvoidPolygon(polyDef);
    this.reassess();
    return rec;
  }

  removeAvoidPolygon(polyId) {
    const removed = this.router.removeAvoidPolygon(polyId);
    this.reassess();
    return removed;
  }

  clearAvoidPolygons() {
    this.router.clearAvoidPolygons();
    return this.reassess();
  }

  getAvoidPolygons() {
    return this.router.getAvoidPolygons();
  }

  // --------------------------------------------------------------------------
  // P3.1 RUNTIME FIELD VERIFICATION WORKFLOW (GroundDataManager Gate)
  // --------------------------------------------------------------------------

  submitFieldSurveyRecord(record) {
    const res = this.groundDataManager.registerRecord(record);
    if (res.success) this.reassess();
    return res;
  }

  approveFieldSurveyRecord(id, approval) {
    const res = this.groundDataManager.approveRecord(id, approval);
    if (res.success) this.reassess();
    return res;
  }

  rejectFieldSurveyRecord(id, rejection) {
    const res = this.groundDataManager.rejectRecord(id, rejection);
    if (res.success) this.reassess();
    return res;
  }

  ingestFieldSurveyPacket(packet, options = {}) {
    const res = this.groundDataManager.ingestBatchSurveyPacket(packet, options);
    this.reassess();
    return res;
  }

  resetFieldChecklist() {
    this.groundDataManager.resetRegistry();
    return this.reassess();
  }

  getFieldChecklistSummary() {
    const bldgId = this.facility?.buildingMetadata?.id || 'BLDG_212_ENG1';
    return this.groundDataManager.getChecklistSummary(bldgId);
  }

  /**
   * Switch active FacilityPackage across router, 3D adapter, and user location context (Tier 2.4).
   */
  setFacilityPackage(facilityPackage) {
    if (!facilityPackage) {
      throw new Error('[ResponseUIAdapter] facilityPackage is required.');
    }
    this.facility = facilityPackage;
    if (typeof this.router?.loadFacilityPackage === 'function') {
      this.router.loadFacilityPackage(facilityPackage);
    }
    if (this.hanyangAdapter && typeof this.hanyangAdapter.setFacilityPackage === 'function') {
      this.hanyangAdapter.setFacilityPackage(facilityPackage);
    }
    const meta = facilityPackage.buildingMetadata || {};
    const hasIndoorData = meta.indoorScope
      ? Boolean(meta.indoorScope.hasIndoorData)
      : Object.keys(facilityPackage.indoorGraphs || {}).length > 0;

    this.context.user.buildingId = meta.id || 'FACILITY';
    this.context.user.floor = hasIndoorData ? (facilityPackage.defaultFloor ?? 3) : 1;
    this.context.user.room = hasIndoorData ? (facilityPackage.defaultRoomId || 'ROOM_301') : null;
    this.context.user.locationType = hasIndoorData ? 'INDOOR' : 'OUTDOOR';
    this.context.user.locationCertainty = LOCATION_CERTAINTY.MANUAL_EXACT;
    this.context.spatial.hasIndoorData = hasIndoorData;
    this.context.spatial.impactStatus = meta.impactStatus || this.context.spatial.impactStatus || 'IN_IMPACT_ZONE';
    this.context.spatial.destinationStatus = meta.destinationStatus || (facilityPackage.shelter ? 'CONFIRMED' : 'UNAVAILABLE');
    this.context.spatial.destinationName = meta.shelterName || facilityPackage.shelter?.name || null;
    this.context.spatial.regionLabel = meta.regionLabel || meta.name || null;
    this.context.spatial.facilityName = meta.name || null;
    return this.reassess();
  }

  /**
   * Update region-independent hazard impact, destination availability, and labels.
   */
  setRegionContext(regionMeta = {}) {
    if (!regionMeta || typeof regionMeta !== 'object') return this.reassess();
    if (regionMeta.impactStatus !== undefined) {
      this.context.spatial.impactStatus = regionMeta.impactStatus;
      this.context.disaster.impactStatus = regionMeta.impactStatus;
    }
    if (regionMeta.destinationStatus !== undefined) {
      this.context.spatial.destinationStatus = regionMeta.destinationStatus;
    }
    if (regionMeta.destinationName !== undefined) {
      this.context.spatial.destinationName = regionMeta.destinationName;
    }
    if (regionMeta.regionLabel !== undefined) {
      this.context.spatial.regionLabel = regionMeta.regionLabel;
    }
    if (regionMeta.facilityName !== undefined) {
      this.context.spatial.facilityName = regionMeta.facilityName;
    }
    if (regionMeta.hasIndoorData !== undefined) {
      this.context.spatial.hasIndoorData = Boolean(regionMeta.hasIndoorData);
      if (!this.context.spatial.hasIndoorData) {
        this.context.user.locationType = 'OUTDOOR';
        this.context.user.floor = 1;
        this.context.user.room = null;
      }
    }
    return this.reassess();
  }

  // --------------------------------------------------------------------------
  // CONTEXT MUTATION METHODS
  // --------------------------------------------------------------------------

  /**
   * Set user floor selection
   * @param {number} floor - 1 to 5
   */
  setUserFloor(floor) {
    this.context.user.floor = floor;
    if (this.context.user.locationCertainty === LOCATION_CERTAINTY.BUILDING_ONLY) {
      this.context.user.locationCertainty = LOCATION_CERTAINTY.FLOOR_ONLY;
    }
    return this.reassess();
  }

  /**
   * Set detailed user location
   */
  setUserLocation({ locationType, buildingId, floor, room, certainty }) {
    if (locationType !== undefined) this.context.user.locationType = locationType;
    if (buildingId !== undefined) this.context.user.buildingId = buildingId;
    if (floor !== undefined) this.context.user.floor = floor;
    if (room !== undefined) this.context.user.room = room;
    if (certainty !== undefined) this.context.user.locationCertainty = certainty;
    return this.reassess();
  }

  /**
   * Set mobility limitation
   */
  setMobility(profile = MOBILITY_PROFILE.NONE) {
    this.context.user.mobilityLimitation = profile;
    return this.reassess();
  }

  /**
   * Report an on-site sensory hazard
   */
  reportHazard(hazardType, isReported = true, detail = '') {
    if (hazardType === 'FIRE_OR_SMOKE') {
      this.context.disaster.reportedFireOrSmoke = isReported;
    } else if (hazardType === 'GAS_LEAK') {
      this.context.disaster.reportedGasLeak = isReported;
    } else if (hazardType === 'EXIT_BLOCKED') {
      this.context.spatial.exitPassable = !isReported;
    } else if (hazardType === 'CORRIDOR_BLOCKED') {
      this.context.spatial.corridorPassable = !isReported;
    } else if (hazardType === 'STAIRS_BLOCKED') {
      this.context.spatial.stairsPassable = !isReported;
    }

    const existingIdx = this.context.sources.userReports.findIndex(r => r.hazardType === hazardType);
    if (isReported) {
      const reportItem = {
        hazardType,
        isVerified: false,
        detail,
        timestamp: Date.now()
      };
      if (existingIdx >= 0) {
        this.context.sources.userReports[existingIdx] = reportItem;
      } else {
        this.context.sources.userReports.push(reportItem);
      }
    } else if (existingIdx >= 0) {
      this.context.sources.userReports.splice(existingIdx, 1);
    }

    return this.reassess();
  }

  /**
   * Clear hazard report
   */
  clearHazard(hazardType) {
    return this.reportHazard(hazardType, false);
  }

  clearStationTelemetry() {
    this.context.disaster.pga_g = null;
    this.context.disaster.isShakingActive = false;
    this.context.sources.station = null;
    return this.reassess();
  }

  /**
   * Ingest ground station motion telemetry or simulation scenario event.
   *
   * @param {number|null} pga - Peak Ground Acceleration in g (null when station telemetry unavailable)
   * @param {number} [timestamp=Date.now()]
   * @param {string} [provenance=DATA_PROVENANCE_SOURCE.OBSERVED_STATION] - OBSERVED_STATION | SIMULATED_SCENARIO
   * @param {Object} [stationMeta] - Optional station distance / metadata
   */
  updateStationMotion(pga, timestamp = Date.now(), provenance = DATA_PROVENANCE_SOURCE.OBSERVED_STATION, stationMeta = {}) {
    this.context.timestamp = timestamp;
    if (pga === null || pga === undefined || !Number.isFinite(pga)) {
      return this.clearStationTelemetry();
    }
    this.context.disaster.pga_g = pga;
    this.context.disaster.isShakingActive = isProtectiveShakingOnset(pga);

    this.context.sources.station = {
      timestamp,
      pga_g: pga,
      distanceKm: Number.isFinite(stationMeta.distanceKm) ? stationMeta.distanceKm : null,
      provenanceType: provenance,
      note: provenance === DATA_PROVENANCE_SOURCE.SIMULATED_SCENARIO
        ? '시연 및 훈련 목적의 가상 시나리오 입력치 (DEMO SIMULATION)'
        : '관측소 계측 지반 가속도 (실제 실내 체감 진동 변환치 아님)'
    };

    return this.reassess();
  }

  /**
   * Set or update official disaster broadcast
   */
  setOfficialAlert(alert = null) {
    this.context.sources.official = alert;
    return this.reassess();
  }

  /**
   * Set outdoor path status
   */
  setOutdoorPathStatus(status = 'UNVERIFIED') {
    this.context.spatial.outdoorPathStatus = status;
    return this.reassess();
  }

  /**
   * Set aftershock status
   */
  setAftershock(hasAftershock = true) {
    this.context.disaster.hasAftershock = hasAftershock;
    return this.reassess();
  }

  /**
   * Set preferred route display mode
   */
  setPreferredRouteMode(mode = 'ALL') {
    this.preferredRouteMode = mode;
    this.sync3DScene();
  }

  // --------------------------------------------------------------------------
  // CORE ASSESSMENT, DYNAMIC REPLANNING & 3D SYNC
  // --------------------------------------------------------------------------

  /**
   * Execute situation assessment, dynamic route replanning, and update UI / 3D layers.
   */
  reassess() {
    this.context.timestamp = Date.now();
    const assessment = this.engine.assess(this.context);
    this.lastAssessment = assessment;

    // 1. Dynamic Routing Replanning
    let routeResult = null;
    const user = this.context.user;
    const isWheelchair = user.mobilityLimitation === MOBILITY_PROFILE.WHEELCHAIR;

    const targetNode = this.facility.shelter?.shelterId || null;

    if (assessment.canMove && assessment.canNavigate && targetNode) {
      // Determine Start Node from injected FacilityPackage
      let startNode = this.context.spatial?.hasIndoorData === false
        ? (this.facility.defaultOutdoorEgressNodeId || this.facility.defaultExitNodeId || 'NODE_EXIT_1F_SE')
        : (this.facility.defaultRoomNodeId || 'NODE_ROOM_301');
      if (user.locationType === 'OUTDOOR') {
        startNode = this.facility.defaultOutdoorEgressNodeId || this.facility.defaultExitNodeId || 'OSM_NODE_6415394841';
      } else if (user.floor === 1) {
        startNode = this.facility.defaultExitNodeId || 'NODE_EXIT_1F_SE';
      } else if (user.room) {
        for (const fg of Object.values(this.facility.indoorGraphs || {})) {
          const match = (fg.rooms || []).find(r => r.roomId === user.room || r.nodeId === user.room);
          if (match) {
            startNode = match.nodeId;
            break;
          }
        }
      }

      const mobilityProfile = isWheelchair
        ? USER_MOBILITY_PROFILE.WHEELCHAIR_USER
        : USER_MOBILITY_PROFILE.STANDARD_EVACUEE;

      routeResult = this.router.findDynamicPath(startNode, targetNode, {
        mobilityProfile
      });
      this.lastRouteResult = routeResult;
    } else {
      this.lastRouteResult = null;
    }

    const guidance = this.formatUserFacingGuidance(assessment, routeResult);
    this.lastGuidance = guidance;

    this.sync3DScene();

    if (typeof this.onGuidanceUpdate === 'function') {
      this.onGuidanceUpdate(guidance);
    }

    return guidance;
  }

  /**
   * Synchronize 3D scene elements in HanyangResponseAdapter
   */
  sync3DScene() {
    if (!this.hanyangAdapter || !this.lastAssessment) return;

    const assessment = this.lastAssessment;
    const route = this.lastRouteResult;
    const user = this.context.user;

    // 1. Highlight user floor if indoor
    if (user.locationType === 'INDOOR' && typeof user.floor === 'number') {
      if (typeof this.hanyangAdapter.highlightFloor === 'function') {
        this.hanyangAdapter.highlightFloor(user.floor);
      } else if (typeof this.hanyangAdapter.setSelectedFloor === 'function') {
        this.hanyangAdapter.setSelectedFloor(user.floor);
      }
    }

    // 2. Control Route Display based on movement/navigation safety and replanned path
    if (!assessment.canMove || !assessment.canNavigate || !route || !route.found) {
      // Prohibit misleading route display when immobile, blocked, or no viable path exists
      this.hanyangAdapter.setRouteDisplay('NONE');
    } else {
      if (route.isStepFree || (route.replanned && route.replanReason?.includes('우회로'))) {
        // Enforce Step-Free route display for wheelchair users or stair-blocked detours
        this.hanyangAdapter.setRouteDisplay('STEP_FREE');
      } else {
        // Normal shortest or user preferred
        this.hanyangAdapter.setRouteDisplay(this.preferredRouteMode);
      }
    }
  }

  // --------------------------------------------------------------------------
  // USER-FACING EDITORIAL FORMATTER (Anti-Slop / No Raw S1-S6 Codes)
  // --------------------------------------------------------------------------

  /**
   * Transform raw assessment and route replan result into clean, typography-led Korean guidance
   */
  formatUserFacingGuidance(assessment, routeResult) {
    const act = assessment.recommendedAction;
    const isWheelchair = this.context.user.mobilityLimitation === MOBILITY_PROFILE.WHEELCHAIR;

    // 1. Determine Korean Phase Headline (Region-Agnostic)
    let phaseHeadline = '';
    let badgeKorean = '';
    const isSimulatedScenario = this.context.sources.station?.provenanceType === DATA_PROVENANCE_SOURCE.SIMULATED_SCENARIO;
    const regionLabel = this.context.spatial?.regionType === 'CAMPUS' ? '캠퍼스' : (this.context.spatial?.regionLabel || '도심/지역');
    const isOutsideImpact = this.context.disaster?.impactStatus === 'OUTSIDE_IMPACT_ZONE';
    const isDestinationUnavailable = this.context.spatial?.destinationStatus === 'UNAVAILABLE' || this.context.spatial?.destinationStatus === 'UNKNOWN';

    if (isOutsideImpact && !this.context.disaster.isShakingActive) {
      phaseHeadline = '지진 영향권 외 — 현 위치 일상 대기';
      badgeKorean = '원거리 사건 · 대피 불필요';
    } else if (isDestinationUnavailable && act.tacticalState !== 'S1_SHAKING') {
      phaseHeadline = '대피 후보 · 경로 판단 불가 (데이터 부족)';
      badgeKorean = '지역 공간/대피소 정보 부족';
    } else if (act.tacticalState === 'S1_SHAKING') {
      phaseHeadline = '지진동 진행 중 — 현 위치 즉각 엄폐';
      badgeKorean = isSimulatedScenario ? '가상 시나리오 지반 가속도 연동 (SIMULATED)' : '실시간 지반 가속도 계측 연동';
    } else if (act.tacticalState === 'S2_POST_SHAKING_ASSESSMENT') {
      phaseHeadline = '진동 멈춤 — 탈출로 확보 및 안전 점검';
      badgeKorean = '현장 3점 점검 단계';
    } else if (act.tacticalState === 'S3_ACTION_DECISION') {
      phaseHeadline = this.facility?.hasIndoorData === false
        ? '외곽 보행 피난 개시 — 낙하물 주의 이탈'
        : '이동 판단 — 비상계단 피난 하향 이동';
      badgeKorean = isWheelchair ? '이동 약자 대기 지원' : (this.facility?.hasIndoorData === false ? '건물 외곽 기준 대피 개시' : '비상계단 피난 개시');
    } else if (act.tacticalState === 'S4_EXTERIOR_EGRESS') {
      phaseHeadline = '건물 탈출 — 외벽 낙하물 위험구역 신속 이탈';
      badgeKorean = '출구 통과 및 옥외 전이';
    } else if (act.tacticalState === 'S5_PEDESTRIAN_TRANSIT') {
      phaseHeadline = `옥외 보행 — ${regionLabel} 안전 이동`;
      badgeKorean = `${regionLabel} 보행 네트워크 이동 중`;
    } else if (act.tacticalState === 'S6_SHELTER_ARRIVAL') {
      const shelterName = this.facility?.shelter?.officialName || this.context.spatial?.destinationName || '개활 대피 후보지';
      phaseHeadline = `목적지 도달 — ${shelterName}`;
      badgeKorean = this.facility?.shelter?.candidateStatus === 'CONFIRMED' ? '공식 지진옥외대피장소' : '조건부 개활 후보지 (현장 확인 필요)';
    } else if (act.tacticalState === 'SHELTER_IN_PLACE') {
      phaseHeadline = '탈출로 차단 — 실내 격리 방호 및 구조 요청 (건물 안전 보증 아님)';
      badgeKorean = '실내 방호 격리 조치 발령';
    } else {
      phaseHeadline = '상황 파악 및 위치 확인 단계';
      badgeKorean = '위치 확인 대기';
    }

    // 2. Synthesize Warnings & Unverified Items (propagating P3.1 Field Checklist state)
    const fieldChecklist = this.getFieldChecklistSummary();
    const warnings = [...assessment.warnings];
    const unverifiedItems = [];

    if (this.facility?.hasIndoorData === false) {
      unverifiedItems.push('선택 건축물의 실내 평면도 및 출입구 위치 미확보 (외곽 기준 안내)');
    } else if (assessment.verificationStatus.spatialVerification === VERIFICATION_STATUS.PROVISIONAL && !fieldChecklist.isIndoorFullyVerified) {
      unverifiedItems.push('실내 평면도 및 비상문 규격 (현장 미실측 추정치)');
    }
    if (assessment.verificationStatus.routeVerification === VERIFICATION_STATUS.PROVISIONAL && !fieldChecklist.isWheelchairRouteFullyVerified) {
      unverifiedItems.push('옥외 대피 경로 지진 후 통행 안전성 (사전 계산된 후보 경로)');
    }
    for (const item of assessment.indeterminateItems) {
      if (!unverifiedItems.includes(item)) {
        unverifiedItems.push(item);
      }
    }

    // 3. Dynamic Route Status & Caveats
    let routeDisplayMode = 'HIDDEN';
    let routeCaveat = '';
    let replanStatus = null;

    if (!assessment.canMove) {
      routeDisplayMode = 'HIDDEN';
      routeCaveat = '현재 이동이 금지된 상황이므로 대피 경로 안내를 중단합니다.';
    } else if (!assessment.canNavigate) {
      routeDisplayMode = 'HIDDEN';
      routeCaveat = (this.context.user.floor === null || this.context.user.floor === undefined)
        ? '정확한 층수 위치(1~5층)가 확인되지 않아 상세 피난 경로 표시가 제한됩니다. 현재 층수를 수동 선택하십시오.'
        : '정확한 위치 또는 피난 조건이 확인되지 않아 경로 표시가 제한됩니다.';
    } else if (!routeResult || !routeResult.found) {
      routeDisplayMode = 'HIDDEN';
      routeCaveat = '통행 가능한 대피 경로가 모두 차단되었습니다. 실내 격리 방호(Shelter-in-Place)로 전환하십시오. (주의: 실내 잔류는 건물의 안전성을 보증하는 것이 아닙니다)';
      warnings.push(routeResult?.failSafeGuidance || '모든 대피 경로가 차단되었습니다.');
      replanStatus = {
        isReplanned: true,
        replanReason: '모든 경로 폐쇄로 인한 탐색 실패',
        alternativeAvailable: false
      };
    } else {
      // Path found!
      if (routeResult.replanned) {
        warnings.push(`경로 재탐색: ${routeResult.replanReason}`);
      }
      if (routeResult.hazardAlerts && routeResult.hazardAlerts.length > 0) {
        warnings.push(...routeResult.hazardAlerts);
      }

      if (routeResult.traversedSuspected) {
        unverifiedItems.push('산출 경로 상 미확인 위험(SUSPECTED) 구간 포함 — 현장 주의 요망');
      }
      if (routeResult.traversedUnknown) {
        unverifiedItems.push('산출 경로 상 미검증(UNKNOWN) 구간 포함 — 안전 미보증');
      }

      if (routeResult.isStepFree || (routeResult.replanned && routeResult.replanReason?.includes('우회로'))) {
        routeDisplayMode = 'STEP_FREE';
        routeCaveat = isWheelchair
          ? `휠체어 무단차 우회로(${routeResult.totalDistanceMeters}m) 산출. 현장 휠체어 접근성(단차/경사) 미검증 상태(PROVISIONAL).`
          : `최단 계단로 폐쇄/위험으로 무단차 우회로(${routeResult.totalDistanceMeters}m)로 동적 변경되었습니다.`;
      } else {
        routeDisplayMode = this.preferredRouteMode;
        routeCaveat = `최단 경로(${routeResult.totalDistanceMeters}m, 계단 ${routeResult.stairFlightCount}구간)가 산출되었습니다. 사전 후보 경로이며 현장 균열을 주의하십시오.`;
      }

      replanStatus = {
        isReplanned: routeResult.replanned,
        replanReason: routeResult.replanReason,
        alternativeAvailable: true,
        totalDistanceMeters: routeResult.totalDistanceMeters,
        totalStairsDistanceMeters: routeResult.totalStairsDistanceMeters,
        isStepFree: routeResult.isStepFree,
        isWheelchairVerified: routeResult.isWheelchairVerified,
        traversedSuspected: routeResult.traversedSuspected ?? false,
        traversedUnknown: routeResult.traversedUnknown ?? false
      };
    }

    return Object.freeze({
      timestamp: assessment.timestamp,
      phaseHeadline,
      badgeText: badgeKorean,
      primaryAction: act.primary,
      secondaryAction: act.secondary,
      urgency: act.urgency,
      canMove: assessment.canMove,
      canNavigate: assessment.canNavigate && (routeResult?.found ?? false),
      rationale: assessment.rationale,
      warnings: Object.freeze(warnings),
      unverifiedItems: Object.freeze(unverifiedItems),
      neededInformation: assessment.neededForNextAssessment,
      routeStatus: Object.freeze({
        displayMode: routeDisplayMode,
        caveat: routeCaveat
      }),
      replanStatus: Object.freeze(replanStatus),
      fieldChecklist,
      conflictResolution: assessment.conflictResolution
    });
  }
}
