// ============================================================================
// SEISMOLIVE v4.0 — Multi-Hazard Situation Assessment & Decision Engine
// File: js/response/SituationAssessmentEngine.js
//
// Pure situation assessment & behavioral decision layer.
// Decoupled from UI/DOM, preserving existing ResponseStateMachine & adapters.
//
// Strict Directives (Phase P2.3):
//   - Zero timer-based auto-transitions.
//   - Zero arbitrary building collapse or structural vulnerability calculations.
//   - Never confirm fire or gas leaks as absolute facts from uncorroborated user reports.
//   - Never ignore local life-safety hazard reports; provide precautionary guidance.
//   - Never arbitrarily invalidate official disaster orders based on unverified reports.
//   - Explicitly evaluate authority, spatial scope, temporal freshness, and verification state.
//   - Declare uncertainty explicitly when information conflicts cannot be fully resolved.
//   - Disallow assumption of indoor GPS for room/floor identification.
//   - No claiming exits or paths are "safe" without verified ground inspection.
// ============================================================================

import {
  DATA_PROVENANCE_SOURCE,
  VERIFICATION_STATUS,
  SEISMIC_MOTION_POLICY,
  isProtectiveShakingOnset,
  isQuiescenceSubsided,
  ASSESSMENT_URGENCY,
  LOCATION_CERTAINTY,
  MOBILITY_PROFILE,
  CONFLICT_RESOLUTION_STRATEGY
} from './ResponseDomainTypes.js';

import { RESPONSE_STATES } from './ResponseStateMachine.js';

export {
  ASSESSMENT_URGENCY,
  LOCATION_CERTAINTY,
  MOBILITY_PROFILE,
  CONFLICT_RESOLUTION_STRATEGY,
  DATA_PROVENANCE_SOURCE,
  VERIFICATION_STATUS,
  SEISMIC_MOTION_POLICY
};

/**
 * SituationAssessmentEngine
 *
 * 다차원 재난·사용자·공간 입력을 종합하여 권고 행동 및 경로 안내 가능성을 판정하는 순수 엔진.
 */
export class SituationAssessmentEngine {
  constructor(options = {}) {
    this.options = options;
  }

  /**
   * 상황 종합 평가 실행
   * @param {Object} input - 다차원 입력 데이터
   * @returns {Object} assessmentResult - 평가 결과 객체
   */
  assess(input = {}) {
    const disaster = input.disaster || {};
    const user = input.user || {};
    const spatial = input.spatial || {};
    const sources = input.sources || {};

    const rationale = [];
    const warnings = [];
    const indeterminateItems = [];
    const neededForNextAssessment = [];
    const informationSourcesUsed = [];

    const now = input.timestamp || Date.now();

    // ------------------------------------------------------------------------
    // 1. 정보 출처별 다차원 메타데이터 평가 (권한, 공간범위, 신선도, 확인상태)
    // ------------------------------------------------------------------------
    let stationStatus = 'ABSENT';
    let stationPga = null;
    let isStationStale = false;

    if (sources.station) {
      const latencySec = (now - (sources.station.timestamp || now)) / 1000;
      isStationStale = latencySec > 30.0;
      stationPga = sources.station.pga_g ?? null;
      stationStatus = isStationStale ? 'STALE' : 'ACTIVE';

      informationSourcesUsed.push({
        type: DATA_PROVENANCE_SOURCE.OBSERVED_STATION,
        authority: 'KMA_INSTRUMENTAL',
        spatialScope: 'STATION_SITE',
        status: stationStatus,
        latencySeconds: Math.max(0, latencySec),
        detail: `PGA: ${stationPga ?? 'N/A'}g, Stale: ${isStationStale}`
      });

      if (isStationStale) {
        warnings.push('지진관측소 실측 신호 수신이 30초 이상 지연되었습니다 (신호 소실 또는 통신 두절 가능성).');
        indeterminateItems.push('실시간 지반 가속도 연속성 (최신 계측치 미확보)');
      }
    } else {
      indeterminateItems.push('관측소 실측 지반 가속도 신호 부재');
      neededForNextAssessment.push('지진관측소 실시간 계측 스트림');
    }

    let officialAlert = sources.official || null;
    if (officialAlert && officialAlert.issued) {
      informationSourcesUsed.push({
        type: DATA_PROVENANCE_SOURCE.OFFICIAL_DISASTER_INFO,
        authority: officialAlert.authority || 'DISASTER_AUTHORITY',
        spatialScope: officialAlert.scope || 'REGIONAL',
        instruction: officialAlert.instruction || '공식 지침 없음',
        status: 'ACTIVE',
        isStatutory: true
      });
    }

    const userReports = [];
    if (sources.userReports && Array.isArray(sources.userReports)) {
      for (const rep of sources.userReports) {
        userReports.push(rep);
        informationSourcesUsed.push({
          type: DATA_PROVENANCE_SOURCE.USER_FIELD_REPORT,
          authority: 'USER_LOCAL_OBSERVATION',
          spatialScope: 'ROOM_COMPARTMENT',
          status: rep.isVerified ? 'VERIFIED' : 'UNVERIFIED_SUSPECTED',
          hazard: rep.hazardType,
          detail: rep.detail || ''
        });
      }
    }

    // ------------------------------------------------------------------------
    // 2. 사용자 위치 특정 수준 검증 (GPS 맹신 배제)
    // ------------------------------------------------------------------------
    const locationCertainty = user.locationCertainty || LOCATION_CERTAINTY.UNKNOWN;
    const isIndoor = user.locationType === 'INDOOR';
    const isOutdoor = user.locationType === 'OUTDOOR';

    if (user.locationType === 'UNKNOWN' || !user.locationType) {
      indeterminateItems.push('사용자 실내/실외 구분 미상');
      neededForNextAssessment.push('실내 또는 실외 위치 확인');
    }

    if (isIndoor) {
      if (locationCertainty === LOCATION_CERTAINTY.UNKNOWN || locationCertainty === LOCATION_CERTAINTY.BUILDING_ONLY) {
        indeterminateItems.push('실내 위치한 층수 미선택');
        neededForNextAssessment.push('현재 위치한 층수(1~5층) 수동 선택');
        warnings.push('정확한 층수가 선택되지 않아 수직 피난 경로를 산출할 수 없습니다.');
      } else if (locationCertainty === LOCATION_CERTAINTY.FLOOR_ONLY) {
        warnings.push('현재 층의 기준 복도를 기점으로 경로를 안내합니다 (상세 호실 미지정).');
      }
    }

    // 이동 특성
    const mobility = user.mobilityLimitation || MOBILITY_PROFILE.NONE;
    const isWheelchair = mobility === MOBILITY_PROFILE.WHEELCHAIR;

    // ------------------------------------------------------------------------
    // 3. 재난 위험 요인 다차원 평가 (Multi-Hazard Synthesis)
    // ------------------------------------------------------------------------
    const isShakingActive = disaster.isShakingActive === true || (stationPga !== null && isProtectiveShakingOnset(stationPga) && !isStationStale);
    const hasAftershock = disaster.hasAftershock === true;

    // 사용자 보고 기반 위험 (절대 '사실로 단정'하지 않고 '보고됨/의심됨'으로 처리)
    const fireReport = userReports.find(r => r.hazardType === 'FIRE_OR_SMOKE');
    const hasReportedFire = disaster.reportedFireOrSmoke === true || !!fireReport;
    const isFireVerified = fireReport?.isVerified === true;

    const gasReport = userReports.find(r => r.hazardType === 'GAS_LEAK');
    const hasReportedGas = disaster.reportedGasLeak === true || !!gasReport;
    const isGasVerified = gasReport?.isVerified === true;

    if (hasReportedFire && !isFireVerified) {
      indeterminateItems.push('화재·연기 발생 진위 여부 (미확인 국소 제보)');
      warnings.push('현장 화재·연기 의심 보고가 접수되었으나, 공인 감지기나 소방대에 의해 확인되지 않은 상태입니다.');
    }
    if (hasReportedGas && !isGasVerified) {
      indeterminateItems.push('가스 누출 진위 여부 (미확인 국소 냄새 제보)');
      warnings.push('현장 가스 냄새 의심 보고는 미검증 상태입니다. 점화원(스위치/라이터) 사용을 금지합니다.');
    }

    const exitBlockedReport = userReports.find(r => r.hazardType === 'EXIT_BLOCKED');
    const isExitBlocked = spatial.exitPassable === false || !!exitBlockedReport;

    const corridorBlockedReport = userReports.find(r => r.hazardType === 'CORRIDOR_BLOCKED');
    const isCorridorBlocked = spatial.corridorPassable === false || !!corridorBlockedReport;

    const stairsBlockedReport = userReports.find(r => r.hazardType === 'STAIRS_BLOCKED');
    const isStairsBlocked = spatial.stairsPassable === false || !!stairsBlockedReport;

    // ------------------------------------------------------------------------
    // 4. 정보 충돌 처리 (Conflict Resolution) — 단순 Override 배제
    // ------------------------------------------------------------------------
    let conflictResolution = CONFLICT_RESOLUTION_STRATEGY.NO_CONFLICT;
    let conflictRationale = null;

    if (officialAlert && officialAlert.issued) {
      const isOfficialHold = officialAlert.instructionCode === 'STAY_INDOORS_HOLD' || officialAlert.instructionCode === 'MAINTAIN_CALM';
      const isOfficialEvacuate = officialAlert.instructionCode === 'EVACUATE_IMMEDIATELY';

      if (isOfficialHold && (hasReportedFire || hasReportedGas)) {
        // 공식 지침은 '광역 실내 대기'이나 현장에서 '미확인 국소 화재/가스' 보고 접수됨
        // 공식 지침을 무효화하지 않고, 국소 감각 위험에 대비한 보수적 예비 대피를 안내함.
        conflictResolution = CONFLICT_RESOLUTION_STRATEGY.LOCAL_UNVERIFIED_HAZARD_PRECAUTION;
        conflictRationale = '공식 지침(광역 실내 대기)은 유효하나, 현장 미확인 화재·가스 의심 보고에 대비하여 생명보호 차원의 보수적 저자세 예비 대피를 안내합니다. 공식 지침을 무효화하지 않으며 현장 연기 확산 위험을 우선 경계합니다.';
        warnings.push('공식 광역 지침(실내 대기)이 유지 중이나, 현장 의심 위험에 대비하여 코와 입을 가리고 출구를 점검하십시오.');
        indeterminateItems.push('공식 광역 대기 지침과 국소 화재 의심 보고 간 상황 불일치');
      } else if (isOfficialEvacuate && (isExitBlocked || isCorridorBlocked)) {
        // 공식 지침은 '외부 대피'이나 출구가 물리적으로 차단된 경우
        conflictResolution = CONFLICT_RESOLUTION_STRATEGY.CONSERVATIVE_PHYSICAL_BARRIER_HOLD;
        conflictRationale = '공식 대피 지침에도 불구하고 물리적 출구/복도 차단으로 탈출이 불가능하여, 억지 돌파를 지양하고 실내 안전구획 대기(Shelter-in-Place)를 적용합니다.';
        warnings.push('출구가 물리적으로 차단되어 외부 대피가 불가능합니다. 무리한 탈출을 멈추고 실내 격리 방어를 수행하십시오.');
        indeterminateItems.push('출구 차단으로 인한 공식 대피 지침 이행 불가');
      }
    }

    // ------------------------------------------------------------------------
    // 5. 전술적 행동 판정 매트릭스 (Tactical Decision Matrix)
    // ------------------------------------------------------------------------
    let primaryAction = '';
    let secondaryAction = null;
    let urgency = ASSESSMENT_URGENCY.CAUTION;
    let tacticalState = RESPONSE_STATES.S2_POST_SHAKING_ASSESSMENT;
    let canMove = true;
    let canNavigate = true;

    // CASE 1: 실내 흔들림 진행 중 (또는 여진 발생)
    if (isIndoor && (isShakingActive || hasAftershock)) {
      urgency = ASSESSMENT_URGENCY.IMMEDIATE;
      tacticalState = RESPONSE_STATES.S1_SHAKING;
      canMove = false;
      canNavigate = false;

      if (hasAftershock) {
        primaryAction = '여진 발생: 즉시 이동을 멈추고 튼튼한 탁자 아래나 내벽 모서리에 웅크려 머리를 감싸십시오.';
        rationale.push('여진(Aftershock) 감지: 보행 중 낙상 및 천장 낙하물 위험으로 인한 즉각 엄폐 복귀');
      } else {
        primaryAction = '몸을 낮추고 튼튼한 탁자 아래로 들어가 머리를 보호하십시오.';
        rationale.push('지반 흔들림(PGA 계측치 감지) 진행 중: 실내 두부 보호 최우선 원칙');
      }
      secondaryAction = '흔들림이 완전히 멈출 때까지 절대 밖으로 뛰어나가지 마십시오.';
      warnings.push('진동 중 이동 시 실내 비구조재(조명, 천장재, 가구) 낙하로 인한 부상 위험이 큽니다.');
    }
    // CASE 2: 실외에 위치한 사용자
    else if (isOutdoor) {
      tacticalState = RESPONSE_STATES.S5_PEDESTRIAN_TRANSIT;
      urgency = isShakingActive ? ASSESSMENT_URGENCY.IMMEDIATE : ASSESSMENT_URGENCY.HIGH;

      if (isShakingActive) {
        primaryAction = '가방이나 손으로 머리를 보호하고, 건물 외벽과 유리창에서 최소 10m 이상 떨어지십시오.';
        secondaryAction = '넓은 공터나 대운동장 방향으로 이동하십시오.';
        canMove = true;
        canNavigate = true;
        rationale.push('실외 진동 감지: 외벽 타일 및 유리창 낙하 반경 회피 조치');
      } else {
        primaryAction = '넓은 공터나 지정 대피소(한양대 대운동장)로 질서 있게 이동하십시오.';
        secondaryAction = '주변 담장, 옹벽, 전신주 주변을 피하십시오.';
        canMove = true;
        canNavigate = true;
        rationale.push('실외 피난 보행: 낙하 위험원 회피 및 옥외 대피소 집결');
      }
    }
    // CASE 3: 출구/복도/계단 복합 차단 상황 (화재 유무에 따른 분기)
    else if (isIndoor && (isExitBlocked || isCorridorBlocked || isStairsBlocked)) {
      canMove = false;
      canNavigate = false;
      tacticalState = RESPONSE_STATES.SHELTER_IN_PLACE;
      urgency = ASSESSMENT_URGENCY.HIGH;

      if (hasReportedFire) {
        primaryAction = '탈출로가 차단되었습니다. 화재 연기가 들어오지 않도록 옷가지나 물로 문틈을 막고 창가에서 구조를 요청하십시오.';
        secondaryAction = '119에 현재 위치(제1공학관 ' + (user.floor ? user.floor + '층' : '내부') + ')를 알리고 창밖으로 수건을 흔드십시오.';
        urgency = ASSESSMENT_URGENCY.IMMEDIATE;
        rationale.push('화재 의심 보고 접수 및 출구 차단: 유독가스 유입 차단 실내 격리 방어 및 긴급 구조 요청');
      } else {
        primaryAction = '탈출로가 차단되었습니다. 억지로 문을 부수지 말고, 안전한 호실 내부에서 대기하며 구조를 기다리십시오.';
        secondaryAction = '통신이 가능한 경우 방재실 또는 119에 위치를 알리십시오.';
        rationale.push('물리적 출구/복도 폐쇄 확인: 무리한 탈출 시 압사/낙상 위험 방지 및 실내 대기 지침 적용');
      }
      warnings.push('손상된 비상계단이나 변형된 문틀에 무리한 힘을 가하지 마십시오.');
    }
    // CASE 4: 화재 또는 가스 누출 의심 (탈출로 개방 상태)
    else if (isIndoor && (hasReportedFire || hasReportedGas)) {
      urgency = ASSESSMENT_URGENCY.IMMEDIATE;
      tacticalState = RESPONSE_STATES.S4_EXTERIOR_EGRESS;
      canMove = true;
      canNavigate = true;

      if (hasReportedFire) {
        primaryAction = '미확인 화재·연기 의심 보고 접수: 젖은 수건이나 옷으로 코와 입을 막고 낮은 자세로 비상계단을 통해 예비 대피하십시오.';
        secondaryAction = '이동하면서 반드시 방화문을 닫아 연기 확산을 차단하고, 실제 화재 여부를 신중히 확인하십시오.';
        rationale.push('현장 화재·연기 의심 제보: 질식 위험 방지를 위한 즉각적인 저자세 예비 피난');
      } else {
        primaryAction = '가스 누출 의심 보고 접수: 전기 스위치나 라이터를 절대 켜지 말고 계단을 통해 신속히 외부로 대피하십시오.';
        secondaryAction = '스파크로 인한 폭발 위험이 있으므로 전자기기 조작을 금합니다.';
        rationale.push('가스 냄새 의심: 점화원 차단 및 외부 신속 환기 피난');
      }

      if (isWheelchair) {
        warnings.push('화재 의심 시 승강기 탑승은 전원 차단 위험으로 절대 금지됩니다. 계단실 앞 방화구획에서 보조인의 구조를 기다려야 합니다.');
        secondaryAction = '혼자 이동할 수 없는 경우 주변에 즉시 도움을 요청하고 계단실 안전구획에 대기하십시오.';
        canNavigate = false;
      }
    }
    // CASE 5: 이동 제한 사용자 (휠체어/보행 장애)
    else if (isIndoor && isWheelchair) {
      tacticalState = RESPONSE_STATES.S3_ACTION_DECISION;
      urgency = ASSESSMENT_URGENCY.HIGH;
      primaryAction = '지진 시 승강기는 전원 차단 위험이 있으므로 절대 탑승하지 마십시오. 주변 보조인의 도움을 요청하십시오.';
      secondaryAction = '계단 진입이 불가하므로 3층 완만한 피난 대기구획에서 보조인과 함께 행동하십시오.';
      canMove = false; // 보조 인력 확보 전 계단 단독 이동 불가
      canNavigate = false;
      rationale.push('휠체어 이용자: 지진 중 승강기 탑승 금지 규정 및 계단 단차 이동 불가에 따른 보조 지원 대기');
      warnings.push('제1공학관 3층에서 1층 출구까지 계단 단차가 존재하여 단독 휠체어 피난이 불가능합니다.');
      neededForNextAssessment.push('피난 보조인 확보 여부');
    }
    // CASE 6: 진동 종료 직후 정상 점검 및 이동 결정 (Default Indoor Stable)
    else if (isIndoor) {
      tacticalState = RESPONSE_STATES.S3_ACTION_DECISION;
      urgency = ASSESSMENT_URGENCY.HIGH;
      canMove = true;
      const hasFloor = user.floor !== null && user.floor !== undefined;
      canNavigate = locationCertainty !== LOCATION_CERTAINTY.UNKNOWN &&
                    locationCertainty !== LOCATION_CERTAINTY.BUILDING_ONLY &&
                    hasFloor;

      primaryAction = '출구 쪽 문을 열어 탈출로를 확보하고, 머리를 보호하며 비상계단을 향해 이동하십시오.';
      secondaryAction = '전열기 코드를 뽑고 가스 밸브를 잠근 후 이동하십시오.';
      rationale.push('지반 흔들림 안정화: 문틀 변형 방지를 위한 개방 및 질서 있는 외부 피난 착수');
      warnings.push('엘리베이터는 절대 탑승하지 말고 반드시 계단을 이용하십시오.');
    }
    // CASE 7: 위치 불명 상태 (Unknown Context)
    else {
      tacticalState = RESPONSE_STATES.S2_POST_SHAKING_ASSESSMENT;
      urgency = ASSESSMENT_URGENCY.CAUTION;
      canMove = false;
      canNavigate = false;
      primaryAction = '현재 위치(실내 또는 실외)를 화면에서 선택하십시오.';
      secondaryAction = '안전한 장소에서 주변 상황을 먼저 살피십시오.';
      rationale.push('사용자 기본 위치 정보 결여로 인해 상황별 행동 특정 불가');
    }

    // ------------------------------------------------------------------------
    // 6. 경로 검증 상태 및 주의 문구 부가
    // ------------------------------------------------------------------------
    let routeVerificationStatus = VERIFICATION_STATUS.PROVISIONAL;
    if (spatial.outdoorPathStatus === 'UNVERIFIED' || !spatial.outdoorPathStatus) {
      warnings.push('제시되는 옥외 대피 경로는 사전 계산된 "후보 경로"이며, 실제 현장 안전 점검이 완료되지 않았습니다.');
      routeVerificationStatus = VERIFICATION_STATUS.PROVISIONAL;
    } else if (spatial.outdoorPathStatus === 'CLEAR') {
      routeVerificationStatus = VERIFICATION_STATUS.PARTIALLY_VERIFIED;
    }

    return Object.freeze({
      timestamp: now,
      summary: `[상황 종합] ${urgency} 등급 | 이동가능: ${canMove} | 경로안내: ${canNavigate}`,
      recommendedAction: Object.freeze({
        primary: primaryAction,
        secondary: secondaryAction,
        urgency,
        tacticalState
      }),
      rationale: Object.freeze(rationale),
      informationSources: Object.freeze(informationSourcesUsed),
      verificationStatus: Object.freeze({
        hazardVerification: hasReportedFire || hasReportedGas ? VERIFICATION_STATUS.PROVISIONAL : VERIFICATION_STATUS.PARTIALLY_VERIFIED,
        spatialVerification: isIndoor ? VERIFICATION_STATUS.PROVISIONAL : VERIFICATION_STATUS.PARTIALLY_VERIFIED,
        routeVerification: routeVerificationStatus
      }),
      canMove,
      canNavigate,
      warnings: Object.freeze(warnings),
      indeterminateItems: Object.freeze(indeterminateItems),
      neededForNextAssessment: Object.freeze(neededForNextAssessment),
      conflictResolution: Object.freeze({
        strategy: conflictResolution,
        rationale: conflictRationale
      })
    });
  }
}
