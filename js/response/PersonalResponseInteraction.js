// ============================================================================
// SEISMOLIVE v4.0 — Personalized Response Interaction Manager
// File: js/response/PersonalResponseInteraction.js
//
// Bridges real-time station waveform observations and user situational reports
// into an action-first, non-slop Korean editorial guidance interface.
//
// Scientific Mandates:
//   - Zero fake structural collapse or floor amplification formulas.
//   - Clear distinction: Instrumental station ground motion vs. on-site user reports.
//   - Educational conceptual simulation explicitly badged as EDUCATIONAL_SIMULATION.
//   - Internal state codes (S1, S2...) hidden from user; action-first presentation.
// ============================================================================

import {
  ResponseStateMachine,
  RESPONSE_STATES
} from './ResponseStateMachine.js';
import {
  DATA_PROVENANCE_SOURCE,
  VERIFICATION_STATUS,
  isProtectiveShakingOnset,
  isInstrumentMotionDetected
} from './ResponseDomainTypes.js';

export const SIMULATION_BADGE = Object.freeze({
  OBSERVED: 'REAL_STATION_OBSERVATION',
  EDUCATIONAL: 'EDUCATIONAL_SIMULATION'
});

export class PersonalResponseInteraction {
  /**
   * @param {Object} [options]
   * @param {ResponseStateMachine} [options.stateMachine]
   * @param {Function} [options.onActionChange]
   */
  constructor(options = {}) {
    this.sm = options.stateMachine || new ResponseStateMachine();
    this.onActionChange = options.onActionChange || null;

    // Simulation toggle for educational demonstration
    this.educationalVibrationActive = false;

    // Station Waveform Telemetry (from StationWaveformBridge)
    this.stationTelemetry = {
      stationId: 'SNU_KMA_ACC',
      stationDistanceKm: 8.4,
      pga_g: 0.18,
      intensityMMI: 'VI',
      isInstrumentActive: true,
      lastWaveformTimestamp: new Date().toISOString(),
      provenance: DATA_PROVENANCE_SOURCE.OBSERVED_STATION
    };
  }

  /**
   * Ingest live or replay instrumental station data from StationWaveformBridge.
   * Strict scientific boundary: Station PGA is ground motion, NOT building floor acceleration.
   *
   * @param {Object} packet
   */
  ingestStationMotion(packet = {}) {
    if (typeof packet.pga === 'number') {
      this.stationTelemetry.pga_g = packet.pga;
    }
    if (packet.stationId) {
      this.stationTelemetry.stationId = packet.stationId;
    }
    if (packet.provenance) {
      this.stationTelemetry.provenance = packet.provenance;
    }
    const effectivePga = packet.pga ?? this.stationTelemetry.pga_g;
    // Lower bound (>= 0.02g): Instrument motion active threshold
    this.stationTelemetry.isInstrumentActive = isInstrumentMotionDetected(effectivePga);
    // Upper bound (>= 0.05g): Protective action onset threshold (aligned with SituationAssessmentEngine / ResponseStateMachine)
    const isProtectiveShaking = isProtectiveShakingOnset(effectivePga);
    this.stationTelemetry.lastWaveformTimestamp = packet.timestamp || new Date().toISOString();

    // Forward to state machine
    this.sm.updateStationObservation(
      this.stationTelemetry.pga_g,
      isProtectiveShaking,
      packet.quiescentSeconds ?? (isProtectiveShaking ? 0.0 : 12.0)
    );

    this.notifyChange();
  }

  /**
   * Toggle educational wireframe conceptual oscillation.
   * Must never be represented as measured structural response.
   */
  setEducationalSimulation(enabled = true) {
    this.educationalVibrationActive = enabled;
    this.notifyChange();
  }

  // --------------------------------------------------------------------------
  // USER SITUATIONAL ACTIONS (Observable Cues)
  // --------------------------------------------------------------------------

  confirmShakingEnded() {
    this.sm.updateStationObservation(0.01, false, 15.0);
    const res = this.sm.stepTransition();
    this.notifyChange();
    return res;
  }

  reportHazard(type, value = true) {
    if (type === 'fire') {
      this.sm.submitUserReport({ hasFireOrSmoke: value });
    } else if (type === 'gas') {
      this.sm.submitUserReport({ hasGasLeakOdor: value });
    } else if (type === 'door_jammed') {
      this.sm.submitUserReport({ isExitDoorJammed: value });
    } else if (type === 'stair_blocked') {
      this.sm.submitUserReport({ isStairwellBlocked: value });
    }
    const res = this.sm.stepTransition();
    this.notifyChange();
    return res;
  }

  confirmRoomDoorOpened() {
    this.sm.updateMilestone('roomDoorOpened', true);
    const res = this.sm.stepTransition();
    this.notifyChange();
    return res;
  }

  confirmEgressProgress(stage) {
    if (stage === 'stair') {
      this.sm.updateMilestone('stairLandingReached', true);
    } else if (stage === 'exterior_exit') {
      this.sm.updateMilestone('groundExitPassed', true);
      this.sm.updateMilestone('debrisZoneCleared', true);
    } else if (stage === 'shelter_arrived') {
      this.sm.updateMilestone('stadiumBoundaryReached', true);
    }
    const res = this.sm.stepTransition();
    this.notifyChange();
    return res;
  }

  // --------------------------------------------------------------------------
  // ACTION-FIRST EDITORIAL GUIDANCE (No Raw S1/S2 Codes)
  // --------------------------------------------------------------------------

  /**
   * Return clean, typography-led editorial guidance for the current situational context.
   */
  getActionGuidance() {
    const s = this.sm.currentState;
    const ctx = this.sm.context;

    switch (s) {
      case RESPONSE_STATES.S1_SHAKING:
        return {
          headline: '지진동 감지 — 즉각 현 위치 방호',
          primaryAction: '몸 낮추고, 머리 감싸고, 튼튼한 탁자 잡기 (DROP, COVER, HOLD ON)',
          warning: '흔들리는 동안 건물 밖으로 뛰어나가지 마십시오. (낙하물 두부 충격 위험 70% 초과)',
          situationText: `관측소 실측 지반가속도 ${this.stationTelemetry.pga_g.toFixed(2)}g (진도 ${this.stationTelemetry.intensityMMI} 상당) · 지반 진동 진행 중`,
          sourceBadge: '관측소 실측 신호 (OBSERVED_STATION)',
          exitStatus: '출구 이동 금지 (진동 안정화 대기)',
          pathOption: '대피 경로 판단 대기',
          shelterTarget: '한양대학교 대운동장 (지진옥외대피장소)'
        };

      case RESPONSE_STATES.S2_POST_SHAKING_ASSESSMENT:
        return {
          headline: '진동 정지 — 주변 위험 점검 및 탈출로 확보',
          primaryAction: '방문을 즉시 열어 탈출로를 확보하고 화재·가스 냄새를 확인하십시오.',
          warning: '문틀이 뒤틀려 갇히기 전에 문을 개방하십시오. 성냥/라이터 사용 금지.',
          situationText: '주요 지진동 멈춤 확인 · 실내 주변 안전 3점 점검 (화재 / 가스 / 출입문)',
          sourceBadge: '사용자 현장 점검 (USER_FIELD_REPORT)',
          exitStatus: ctx.userReport.isExitDoorJammed ? '출입문 뒤틀림 차단' : '방문 개방 진행 중',
          pathOption: '비상계단 수직 피난로 점검',
          shelterTarget: '한양대학교 대운동장'
        };

      case RESPONSE_STATES.S3_ACTION_DECISION:
        return {
          headline: '행동 결정 — 비상계단 피난 하향 이동',
          primaryAction: '소지품을 최소화하고 가방 등으로 머리를 보호하며 비상계단으로 이동하십시오.',
          warning: '엘리베이터 이용 절대 금지 (가이드레일 변형 및 정전 고립 위험).',
          situationText: ctx.userReport.hasFireOrSmoke
            ? '긴급 화재/연기 감지 · 최단 시간 신속 탈출 진행'
            : '실내 이탈 결정 · 3층 복도 경유 남동측 주계단실 이동',
          sourceBadge: '상황 판단 (ACTION_DECISION)',
          exitStatus: '1층 남동측 주 비상구로 이동 중',
          pathOption: '경로 A: 최단 경로 651.9m / 경로 B: 무단차 우회로 769.1m',
          shelterTarget: '한양대학교 대운동장'
        };

      case RESPONSE_STATES.S4_EXTERIOR_EGRESS:
        return {
          headline: '건물 탈출 — 외벽 낙하물 위험구역 즉시 이탈',
          primaryAction: '1층 남동측 비상구를 통과하여 외벽으로부터 20m 이상 신속히 떨어지십시오.',
          warning: '머리 위를 주시하십시오 (외벽 마감재 타일 및 유리창 낙하 위험).',
          situationText: '1층 외부 도달 · 4.0m 전이 보행로 통과 중',
          sourceBadge: '현장 탈출 (EXTERIOR_EGRESS)',
          exitStatus: '1층 남동측 출구 통과 완료',
          pathOption: '캠퍼스 보행로 진입: 최단로(계단 4구간) vs 무단차로(경사로)',
          shelterTarget: '한양대학교 대운동장'
        };

      case RESPONSE_STATES.S5_PEDESTRIAN_TRANSIT:
        return {
          headline: '옥외 이동 — 캠퍼스 대피 경로 보행',
          primaryAction: '안내된 경로를 따라 대운동장으로 이동하십시오. 옹벽과 전신주를 멀리하십시오.',
          warning: '부상자나 휠체어 이용자는 야외 계단을 피해 무단차 우회로를 이용하십시오.',
          situationText: '캠퍼스 보행 네트워크 이동 중 · 대운동장까지 약 650m ~ 770m',
          sourceBadge: '보행 네트워크 (PEDESTRIAN_TRANSIT)',
          exitStatus: '건물 위험반경 완전 이탈',
          pathOption: '최단 경로 651.9m (계단 68.5m) / 무단차 우회로 769.1m (계단 0m)',
          shelterTarget: '한양대학교 대운동장'
        };

      case RESPONSE_STATES.S6_SHELTER_ARRIVAL:
        return {
          headline: '대피소 안착 — 한양대 대운동장 중앙 집결',
          primaryAction: '스탠드 구조물을 벗어나 운동장 중앙 잔디 구역에 안착하고 공식 방송을 청취하십시오.',
          warning: '임의로 실내 건물로 다시 들어가지 마십시오.',
          situationText: '공식 지진옥외대피장소(OA-21060) 도착 완료 · 체온 유지 및 안전 확인',
          sourceBadge: '공식 재난 대피소 (OFFICIAL_DISASTER_INFO)',
          exitStatus: '대피 완료',
          pathOption: '이동 완료',
          shelterTarget: '한양대학교 대운동장 중앙 (집결 완료)'
        };

      case RESPONSE_STATES.SHELTER_IN_PLACE:
        return {
          headline: '실내 고립 방호 — 문틈 밀폐 및 구조 요청',
          primaryAction: '문틈을 옷으로 밀폐하고, 119 및 캠퍼스 상황실에 위치를 알린 후 창가에서 구조 신호를 보내십시오.',
          warning: '연기가 찬 복도로 맹목적 돌진 금지. (주의: 본 조치는 탈출로 차단 시 비상 대응일 뿐 건물 안전을 보장하지 않습니다.)',
          situationText: '출입문 변형 또는 복도 차단 감지 · 실내 안전 잔류 조치 발령',
          sourceBadge: '비상 고립 방호 (SHELTER_IN_PLACE)',
          exitStatus: '탈출로 차단 (실내 방호 전환)',
          pathOption: '보행 이동 불가',
          shelterTarget: '구조대 대기'
        };

      default:
        return {
          headline: '상황 파악 중',
          primaryAction: '안내 방송 청취',
          warning: '',
          situationText: '',
          sourceBadge: '',
          exitStatus: '',
          pathOption: '',
          shelterTarget: ''
        };
    }
  }

  notifyChange() {
    if (typeof this.onActionChange === 'function') {
      this.onActionChange(this.getActionGuidance());
    }
  }
}
