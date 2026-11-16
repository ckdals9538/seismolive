// ============================================================================
// SEISMOLIVE v4.0 — Observable-Cue-Driven Response State Machine
// File: js/response/ResponseStateMachine.js
//
// 6-State Non-Timer Finite State Machine governing behavioral response
// from initial ground shaking through stadium shelter arrival.
//
// Strict Directives:
//   - Zero timer-based auto-transitions.
//   - No arbitrary structural collapse predictions.
//   - Clear separation: Station Observation vs Official Alert vs User Field Report.
// ============================================================================

import {
  DATA_PROVENANCE_SOURCE,
  SEISMIC_MOTION_POLICY,
  isProtectiveShakingOnset,
  isQuiescenceSubsided
} from './ResponseDomainTypes.js';

export const RESPONSE_STATES = Object.freeze({
  S1_SHAKING: 'S1_SHAKING',
  S2_POST_SHAKING_ASSESSMENT: 'S2_POST_SHAKING_ASSESSMENT',
  S3_ACTION_DECISION: 'S3_ACTION_DECISION',
  S4_EXTERIOR_EGRESS: 'S4_EXTERIOR_EGRESS',
  S5_PEDESTRIAN_TRANSIT: 'S5_PEDESTRIAN_TRANSIT',
  S6_SHELTER_ARRIVAL: 'S6_SHELTER_ARRIVAL',
  SHELTER_IN_PLACE: 'SHELTER_IN_PLACE' // Emergency fallback when exit path is physically severed
});

export class ResponseStateMachine {
  constructor(initialState = RESPONSE_STATES.S1_SHAKING) {
    this.currentState = initialState;
    this.history = [];
    this.context = {
      // Station Instrumental Observation (StationWaveformBridge)
      stationObservation: {
        pga_g: 0.18,
        isShakingActive: true,
        quiescentDurationSeconds: 0.0,
        sourceType: DATA_PROVENANCE_SOURCE.OBSERVED_STATION
      },
      // Official Civil Defense / Government Alert
      officialAlert: {
        issued: false,
        level: 'NONE', // 'NONE' | 'ADVISORY' | 'EVACUATE_IMMEDIATELY'
        sourceType: DATA_PROVENANCE_SOURCE.OFFICIAL_DISASTER_INFO
      },
      // User On-Site Field Report
      userReport: {
        hasFireOrSmoke: false,
        hasGasLeakOdor: false,
        isExitDoorJammed: false,
        isStairwellBlocked: false,
        isInjured: false,
        requiresWheelchair: false,
        sourceType: DATA_PROVENANCE_SOURCE.USER_FIELD_REPORT
      },
      // Physical Navigation Milestones
      milestones: {
        roomDoorOpened: false,
        stairLandingReached: false,
        groundExitPassed: false,
        debrisZoneCleared: false,
        stadiumBoundaryReached: false
      }
    };

    this.recordTransition(null, this.currentState, 'INITIAL_SYSTEM_STATE');
  }

  recordTransition(from, to, reason) {
    this.history.push({
      timestamp: new Date().toISOString(),
      from,
      to,
      reason
    });
  }

  /**
   * Update instrumental station observation parameters (e.g. from StationWaveformBridge).
   * Note: Instrumental PGA is an environmental observation, NOT building floor amplification.
   */
  updateStationObservation(pga_g, isShakingActive, quiescentDurationSeconds = 0.0) {
    this.context.stationObservation.pga_g = pga_g;
    this.context.stationObservation.isShakingActive = isShakingActive;
    this.context.stationObservation.quiescentDurationSeconds = quiescentDurationSeconds;

    // Aftershock regression: If in any post-shaking state and severe shaking resumes (>= 0.05g protective onset)
    if (isShakingActive && isProtectiveShakingOnset(pga_g) && this.currentState !== RESPONSE_STATES.S1_SHAKING) {
      if (this.currentState === RESPONSE_STATES.S2_POST_SHAKING_ASSESSMENT ||
          this.currentState === RESPONSE_STATES.S3_ACTION_DECISION) {
        this.transitionTo(RESPONSE_STATES.S1_SHAKING, 'AFTERSHOCK_DETECTED: Resumed severe ground motion (PGA >= 0.05g). Return to protective posture.');
      }
    }
  }

  /**
   * Inject official government disaster notification.
   */
  updateOfficialAlert(level) {
    this.context.officialAlert.issued = level !== 'NONE';
    this.context.officialAlert.level = level;
  }

  /**
   * Submit on-site user observation checklist report.
   */
  submitUserReport(report = {}) {
    Object.assign(this.context.userReport, report);
  }

  /**
   * Update physical navigation milestones.
   */
  updateMilestone(milestoneKey, value = true) {
    if (milestoneKey in this.context.milestones) {
      this.context.milestones[milestoneKey] = value;
    }
  }

  /**
   * Perform state transition with guardrails.
   */
  transitionTo(nextState, reason) {
    const prev = this.currentState;
    this.currentState = nextState;
    this.recordTransition(prev, nextState, reason);
    return {
      success: true,
      previousState: prev,
      currentState: nextState,
      reason
    };
  }

  /**
   * Evaluate whether state transition conditions are satisfied.
   * Enforces strict event-driven triggers; zero timer-based transitions.
   */
  stepTransition() {
    const s = this.currentState;
    const ctx = this.context;

    switch (s) {
      case RESPONSE_STATES.S1_SHAKING: {
        // Condition: Severe shaking inactive AND ground motion subsided below quiescence bound (< 0.02g) for >= 10.0s
        const effectivePga = ctx.stationObservation.pga_g ?? 0.0;
        if (!ctx.stationObservation.isShakingActive && isQuiescenceSubsided(effectivePga, ctx.stationObservation.quiescentDurationSeconds)) {
          return this.transitionTo(
            RESPONSE_STATES.S2_POST_SHAKING_ASSESSMENT,
            'SHAKING_SUBSIDED: Station instruments indicate PGA < 0.02g and stable quiescence for >= 10s.'
          );
        }
        return { success: false, reason: 'SHAKING_IN_PROGRESS: Ground motion remains active or above 0.02g quiescence threshold. Maintain Drop, Cover, Hold On.' };
      }

      case RESPONSE_STATES.S2_POST_SHAKING_ASSESSMENT: {
        // Priority Hazard Check: Immediate threat requires urgent evacuation decision
        if (ctx.userReport.hasFireOrSmoke || ctx.userReport.hasGasLeakOdor) {
          return this.transitionTo(
            RESPONSE_STATES.S3_ACTION_DECISION,
            'HAZARD_PRIORITY_ESCALATION: Fire or gas leak reported on site. Evacuate immediately.'
          );
        }
        // Exit blocked check
        if (ctx.userReport.isExitDoorJammed) {
          return this.transitionTo(
            RESPONSE_STATES.SHELTER_IN_PLACE,
            'EGRESS_IMPASSE: Room door or main exit deformed. Transition to Shelter-In-Place safety protocol.'
          );
        }
        // Standard transition: User completed assessment and opened door
        if (ctx.milestones.roomDoorOpened) {
          return this.transitionTo(
            RESPONSE_STATES.S3_ACTION_DECISION,
            'ASSESSMENT_COMPLETED: Door opened to secure egress corridor. Proceed to action decision.'
          );
        }
        return { success: false, reason: 'AWAITING_USER_ASSESSMENT: Check fire/gas and open room door.' };
      }

      case RESPONSE_STATES.S3_ACTION_DECISION: {
        if (ctx.userReport.isExitDoorJammed || ctx.userReport.isStairwellBlocked) {
          return this.transitionTo(
            RESPONSE_STATES.SHELTER_IN_PLACE,
            'EGRESS_ROUTE_BLOCKED: Vertical stair core or door impassable. Stay in place and seal room.'
          );
        }
        // Proceed to exterior evacuation
        return this.transitionTo(
          RESPONSE_STATES.S4_EXTERIOR_EGRESS,
          'EVACUATION_DECISION_CONFIRMED: Proceed down SE stairwell. Elevator banned.'
        );
      }

      case RESPONSE_STATES.S4_EXTERIOR_EGRESS: {
        // Transition when 1F SE exterior door is cleared and user moves away from debris zone
        if (ctx.milestones.groundExitPassed && ctx.milestones.debrisZoneCleared) {
          return this.transitionTo(
            RESPONSE_STATES.S5_PEDESTRIAN_TRANSIT,
            'EXTERIOR_EGRESS_COMPLETED: Cleared 1F SE portal and 6m debris fall zone. Entering campus pedestrian network.'
          );
        }
        return { success: false, reason: 'IN_EXTERIOR_EGRESS: Descend stairs and clear building facade debris zone.' };
      }

      case RESPONSE_STATES.S5_PEDESTRIAN_TRANSIT: {
        // Transition when stadium perimeter node is reached
        if (ctx.milestones.stadiumBoundaryReached) {
          return this.transitionTo(
            RESPONSE_STATES.S6_SHELTER_ARRIVAL,
            'SHELTER_BOUNDARY_PASSED: Arrived at Hanyang Main Stadium perimeter. Move to pitch center.'
          );
        }
        return { success: false, reason: 'IN_TRANSIT: Traversing campus network towards Main Stadium.' };
      }

      case RESPONSE_STATES.S6_SHELTER_ARRIVAL: {
        return { success: true, message: 'FINAL_STAGE: Evacuation complete. Awaiting official emergency directives.' };
      }

      case RESPONSE_STATES.SHELTER_IN_PLACE: {
        // Can re-transition to egress only if user confirms secondary exit unblocked or rescue arrived
        if (!ctx.userReport.isExitDoorJammed && !ctx.userReport.isStairwellBlocked) {
          return this.transitionTo(
            RESPONSE_STATES.S3_ACTION_DECISION,
            'RESCUE_EGRESS_CLEARED: Alternative egress unblocked. Re-evaluating evacuation.'
          );
        }
        return { success: false, reason: 'SHELTER_IN_PLACE_ACTIVE: Remain in sealed room. Signal 119/campus police.' };
      }

      default:
        return { success: false, reason: `UNKNOWN_STATE: ${s}` };
    }
  }

  /**
   * Get formatted behavioral instructions for current state.
   */
  getCurrentInstruction(ctx = {}) {
    const destName = ctx.destinationName || '지정 대피장소';
    const regionLabel = ctx.regionLabel || '도심 보행로';
    const controlLabel = ctx.controlCenterLabel || '119 또는 관할 재난안전대책본부';
    switch (this.currentState) {
      case RESPONSE_STATES.S1_SHAKING:
        if (this.context.userReport.requiresWheelchair) {
          return {
            title: '지진동 지속 중 — 휠체어 즉각 고정 방호',
            coreAction: 'LOCK, COVER, HOLD ON (바퀴 잠그고, 머리 가리고, 손잡이 붙잡기)',
            details: '즉시 휠체어 바퀴 브레이크를 잠그고 하차하지 마십시오. 쿠션이나 팔로 머리와 목을 감싸고 휠체어 프레임을 붙잡으십시오.',
            bannedAction: '진동 중 이동, 휠체어 하차 및 승강기 접근 절대 금지',
            sourceTag: DATA_PROVENANCE_SOURCE.OBSERVED_STATION
          };
        }
        return {
          title: '지진동 지속 중 — 즉각 현 위치 방호',
          coreAction: 'DROP, COVER, HOLD ON (낮추고, 가리고, 붙잡기)',
          details: '절대로 흔들리는 동안 밖으로 뛰어나가지 마십시오. 책상 아래로 들어가 머리를 감싸고 다리를 꽉 잡으십시오.',
          bannedAction: '건물 밖으로 탈출 시도 절대 금지 (낙하물 두부 충격 위험)',
          sourceTag: DATA_PROVENANCE_SOURCE.OBSERVED_STATION
        };
      case RESPONSE_STATES.S2_POST_SHAKING_ASSESSMENT:
        return {
          title: '진동 정지 후 상황 평가 — 현장 위험 점검',
          coreAction: '출입문 개방 및 화재·가스 냄새 확인',
          details: '문틀이 뒤틀려 갇히기 전에 방문을 즉시 열어 탈출로를 확보하십시오. 가스 밸브를 잠그고 부상자를 확인하십시오.',
          bannedAction: '라이터/성냥 사용 금지 (가스 누출 폭발 위험)',
          sourceTag: DATA_PROVENANCE_SOURCE.USER_FIELD_REPORT
        };
      case RESPONSE_STATES.S3_ACTION_DECISION:
        return {
          title: '행동 판단 및 피난 결정 — 탈출 여부 결정',
          coreAction: '비상계단을 통한 침착한 하향 이동 결정',
          details: '가방이나 외투로 머리를 보호하고 계단으로 이동하십시오. 문이 막혔다면 실내 방호로 전환하십시오.',
          bannedAction: '엘리베이터 탑승 절대 금지 (가이드레일 변형 및 정전 고립)',
          sourceTag: DATA_PROVENANCE_SOURCE.OFFICIAL_DISASTER_INFO
        };
      case RESPONSE_STATES.S4_EXTERIOR_EGRESS:
        return {
          title: '건물 탈출 및 외벽 위험반경 이탈 — 1층 비상구',
          coreAction: '외벽 타일·유리창 낙하 구역 신속 이탈 (건물 높이 이상 이격)',
          details: '1층 출구를 통과한 후 건물 외벽으로부터 즉시 충분히 떨어지십시오. 머리 위를 지속적으로 주시하십시오.',
          bannedAction: '건물 직하부에 머무르거나 소지품을 줍기 위해 정지 금지',
          sourceTag: DATA_PROVENANCE_SOURCE.ESTIMATED_PROVISIONAL
        };
      case RESPONSE_STATES.S5_PEDESTRIAN_TRANSIT:
        return {
          title: `옥외 보행 이동 — ${regionLabel} 대피 경로`,
          coreAction: `안내된 경로를 따라 ${destName} 방향으로 이동`,
          details: '담장, 옹벽, 전신주, 변압기로부터 거리를 유지하고 이동하십시오. 계단/단차 회피 시 경사로 우회로를 따르십시오.',
          bannedAction: '좁은 골목길이나 차량 통행로 중앙 보행 금지',
          sourceTag: DATA_PROVENANCE_SOURCE.ESTIMATED_PROVISIONAL
        };
      case RESPONSE_STATES.S6_SHELTER_ARRIVAL:
        return {
          title: `목적지 도달 및 2차 대응 — ${destName}`,
          coreAction: '개활 안전 구역 집결 및 공식 정보 청취',
          details: '주변 건물·전신주 낙하 위험 구역을 피해 개활지 중앙으로 이동하십시오. 라디오나 재난문자로 공식 지침을 따르십시오.',
          bannedAction: '임의로 손상된 실내 건물로 재진입 금지',
          sourceTag: DATA_PROVENANCE_SOURCE.OFFICIAL_DISASTER_INFO
        };
      case RESPONSE_STATES.SHELTER_IN_PLACE:
        return {
          title: '실내 잔류 및 고립 방호 — 탈출로 차단 상황',
          coreAction: '문틈 밀폐, 위치 신호 발신 및 구조 대기',
          details: `문틀 변형이나 연기로 복도가 막혔습니다. 옷이나 커튼으로 문틈을 막고, ${controlLabel}에 위치를 알리십시오. (주의: 본 조치는 탈출로 차단 시 질식 및 낙하 위험을 회피하기 위한 비상 고립 대응일 뿐이며, 건물의 내진 안전성이나 붕괴 방지를 보장하는 상태가 아닙니다.)`,
          bannedAction: '연기가 찬 복도로 맹목적 돌진 금지 (질식 위험)',
          sourceTag: DATA_PROVENANCE_SOURCE.USER_FIELD_REPORT
        };
      default:
        return { title: 'Unknown', coreAction: '', details: '', sourceTag: 'UNKNOWN' };
    }
  }
}
