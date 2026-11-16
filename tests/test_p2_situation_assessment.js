// ============================================================================
// SEISMOLIVE v4.0 — Phase P2.2 Situation Assessment Engine Test Suite
// File: tests/test_p2_situation_assessment.js
// Run via: deno run --allow-all tests/test_p2_situation_assessment.js
// ============================================================================

import {
  SituationAssessmentEngine,
  ASSESSMENT_URGENCY,
  LOCATION_CERTAINTY,
  MOBILITY_PROFILE,
  CONFLICT_RESOLUTION_STRATEGY
} from '../js/response/SituationAssessmentEngine.js';

import {
  DATA_PROVENANCE_SOURCE,
  VERIFICATION_STATUS
} from '../js/response/HanyangBuildingData.js';

import { RESPONSE_STATES } from '../js/response/ResponseStateMachine.js';

let passed = 0;
let failed = 0;

function assert(condition, message, rationale = '') {
  if (condition) {
    passed++;
    console.log(`  [PASS] ${message}`);
    if (rationale) {
      console.log(`         -> 타당성: ${rationale}`);
    }
  } else {
    failed++;
    console.error(`  [FAIL] ${message}`);
    if (rationale) {
      console.error(`         -> 실패 원인/타당성: ${rationale}`);
    }
  }
}

console.log('====================================================================');
console.log('SEISMOLIVE v4.0 — Phase P2.2 Situation Assessment Engine Tests');
console.log('Multi-Hazard · Conflict Resolution · Provenance · Safe Fallbacks');
console.log('====================================================================\n');

const engine = new SituationAssessmentEngine();

// ----------------------------------------------------------------------------
// TEST 1: 각 입력의 출처 및 신뢰도 보존 (Provenance & Confidence Preservation)
// ----------------------------------------------------------------------------
console.log('--- Test 1: Data Provenance & Verification Tracking ---');
{
  const input = {
    timestamp: 1700000000000,
    disaster: { isShakingActive: false },
    user: {
      locationType: 'INDOOR',
      buildingId: 'BLDG_212_ENG1',
      floor: 3,
      locationCertainty: LOCATION_CERTAINTY.MANUAL_EXACT
    },
    sources: {
      station: {
        timestamp: 1700000000000,
        pga_g: 0.08,
        distanceKm: 8.4
      },
      official: {
        issued: true,
        authority: 'MOIS',
        scope: 'REGIONAL',
        instruction: '여진 주의 및 낙하물 경계'
      },
      userReports: [
        {
          hazardType: 'FIRE_OR_SMOKE',
          isVerified: false,
          detail: '3층 복도 연기 냄새'
        }
      ]
    }
  };

  const res = engine.assess(input);

  assert(
    res.informationSources.length === 3,
    '모든 3개 입력 소스(관측소, 공식정보, 사용자보고)의 메타데이터가 보존됨',
    '관측소 실측, 정부 공보, 사용자 현장 보고를 소실 없이 메타데이터로 추적해야 함'
  );

  const stationSrc = res.informationSources.find(s => s.type === DATA_PROVENANCE_SOURCE.OBSERVED_STATION);
  assert(
    stationSrc && stationSrc.status === 'ACTIVE' && stationSrc.authority === 'KMA_INSTRUMENTAL',
    '관측소 소스는 KMA_INSTRUMENTAL 및 ACTIVE 상태로 정확히 태깅됨',
    '기상청 가속도계 실측치는 계측 신뢰도를 유지해야 함'
  );

  const userReportSrc = res.informationSources.find(s => s.type === DATA_PROVENANCE_SOURCE.USER_FIELD_REPORT);
  assert(
    userReportSrc && (userReportSrc.status === 'UNVERIFIED' || userReportSrc.status === 'UNVERIFIED_SUSPECTED'),
    '사용자 화재 보고는 미검증/의심(UNVERIFIED_SUSPECTED) 상태로 보존됨 (사실 단정 금지)',
    '단일 사용자 현장 제보는 화재가 실측 확인되기 전까지 미검증 상태를 유지해야 함'
  );
}

// ----------------------------------------------------------------------------
// TEST 2: 복수 위험 동시 발생 (지진 흔들림 + 화재 보고)
// ----------------------------------------------------------------------------
console.log('\n--- Test 2: Multiple Hazards (Shaking Active + Fire Report) ---');
{
  const input = {
    disaster: {
      isShakingActive: true,
      pga_g: 0.15,
      reportedFireOrSmoke: true
    },
    user: {
      locationType: 'INDOOR',
      floor: 3,
      locationCertainty: LOCATION_CERTAINTY.MANUAL_EXACT
    },
    sources: {
      station: { pga_g: 0.15, timestamp: Date.now() },
      userReports: [{ hazardType: 'FIRE_OR_SMOKE', isVerified: false }]
    }
  };

  const res = engine.assess(input);

  assert(
    res.recommendedAction.urgency === ASSESSMENT_URGENCY.IMMEDIATE,
    '복합 위험 상황에서 긴급도 IMMEDIATE 판정',
    '강한 지진 진동과 화재 위험이 겹치면 즉각적인 생명 위협 등급이 부여되어야 함'
  );

  assert(
    res.canMove === false && res.recommendedAction.tacticalState === RESPONSE_STATES.S1_SHAKING,
    '강한 흔들림 진행 중에는 화재 보고가 있어도 뛰어나가지 않고 머리 보호를 우선함',
    '진동 중 이동 시 뇌진탕/골절 등 치명상을 입어 화재 탈출 자체가 불가능해지므로 두부 보호가 물리적 선행 조건임'
  );
}

// ----------------------------------------------------------------------------
// TEST 3: 공식 지시와 현장 보고 충돌 (공식 대기 권고 vs 현장 화재 보고)
// ----------------------------------------------------------------------------
console.log('\n--- Test 3: Conflict (Official Stay-Indoors vs Local Fire Report) ---');
{
  const input = {
    disaster: { isShakingActive: false },
    user: {
      locationType: 'INDOOR',
      floor: 3,
      locationCertainty: LOCATION_CERTAINTY.MANUAL_EXACT
    },
    sources: {
      official: {
        issued: true,
        authority: 'MOIS',
        scope: 'REGIONAL',
        instructionCode: 'STAY_INDOORS_HOLD',
        instruction: '실내에서 질서를 유지하고 대기하십시오'
      },
      userReports: [
        {
          hazardType: 'FIRE_OR_SMOKE',
          isVerified: false,
          detail: '3층 배전반에서 불꽃과 짙은 연기 발생'
        }
      ]
    }
  };

  const res = engine.assess(input);

  assert(
    res.conflictResolution.strategy === CONFLICT_RESOLUTION_STRATEGY.LOCAL_UNVERIFIED_HAZARD_PRECAUTION,
    '국소 화재 의심 시 공식 지침을 무효화하지 않고 보수적 예비 조치(LOCAL_UNVERIFIED_HAZARD_PRECAUTION) 발동',
    '공식 대기 지침을 임의로 취소하지 않으면서도, 현장의 생명안전 위협에 대비해 보수적으로 저자세 예비 대피를 권고함'
  );

  assert(
    res.indeterminateItems.some(i => i.includes('상황 불일치') || i.includes('화재·연기')),
    '공식 지침과 현장 보고 간의 불일치 및 불확실성이 indeterminateItems에 명시됨',
    '정보 충돌이 해소되지 않은 경우 불확실성을 사실대로 사용자에게 공표해야 함'
  );

  assert(
    res.recommendedAction.tacticalState === RESPONSE_STATES.S4_EXTERIOR_EGRESS && res.canMove === true,
    '화재 연기 직면 가능성에 대비한 예비 탈출(S4_EXTERIOR_EGRESS) 및 이동 허용 판정',
    '연기 질식 위험에 대응하여 저자세 피난 준비를 유도함'
  );
}

// ----------------------------------------------------------------------------
// TEST 4: 출구 차단과 화재 동시 발생 (탈출 불가 + 화재)
// ----------------------------------------------------------------------------
console.log('\n--- Test 4: Exit Blocked + Fire Reported (Shelter-in-Place Fallback) ---');
{
  const input = {
    disaster: { isShakingActive: false, reportedFireOrSmoke: true },
    user: {
      locationType: 'INDOOR',
      floor: 3,
      locationCertainty: LOCATION_CERTAINTY.MANUAL_EXACT
    },
    spatial: {
      corridorPassable: false, // 복도 매몰
      exitPassable: false      // 문틀 뒤틀림
    },
    sources: {
      userReports: [
        { hazardType: 'FIRE_OR_SMOKE', isVerified: false },
        { hazardType: 'CORRIDOR_BLOCKED', isVerified: true }
      ]
    }
  };

  const res = engine.assess(input);

  assert(
    res.recommendedAction.tacticalState === RESPONSE_STATES.SHELTER_IN_PLACE,
    '탈출로가 차단된 경우 화재가 있더라도 무모한 돌파 대신 SHELTER_IN_PLACE 방어 격리 발동',
    '매몰된 복도로 돌진하면 유독가스에 즉사하므로, 문틈을 막고 창가에서 구조를 요청하는 실내 방어가 유일한 합리적 선택임'
  );

  assert(
    res.canMove === false && res.canNavigate === false,
    '이동 및 일반 경로 안내 비활성화',
    '물리적으로 차단된 통로로의 맹목적인 경로 안내를 차단하여 패닉을 방지해야 함'
  );
}

// ----------------------------------------------------------------------------
// TEST 5: 대피 이동 중 여진 발생 (Transit Interrupted by Aftershock)
// ----------------------------------------------------------------------------
console.log('\n--- Test 5: Aftershock during Transit ---');
{
  const input = {
    disaster: {
      isShakingActive: true,
      hasAftershock: true,
      pga_g: 0.09
    },
    user: {
      locationType: 'INDOOR',
      floor: 2,
      locationCertainty: LOCATION_CERTAINTY.MANUAL_EXACT
    }
  };

  const res = engine.assess(input);

  assert(
    res.recommendedAction.tacticalState === RESPONSE_STATES.S1_SHAKING,
    '이동 중 여진 발생 시 S1_SHAKING 상태로 즉시 회귀',
    '이동 중 강한 여진이 발생하면 계단 낙상 및 잔해 낙하 위험이 급증하므로 즉시 멈추고 엄폐해야 함'
  );

  assert(
    res.canMove === false,
    '여진 진행 중 이동 금지(canMove = false)',
    '진동이 지속되는 동안 보행은 극히 위험하므로 이동을 일시 중지시킴'
  );
}

// ----------------------------------------------------------------------------
// TEST 6: 사용자 위치 불명 (Unknown Location / Missing Floor)
// ----------------------------------------------------------------------------
console.log('\n--- Test 6: Unknown User Location / Missing Floor ---');
{
  const input = {
    disaster: { isShakingActive: false },
    user: {
      locationType: 'INDOOR',
      buildingId: 'BLDG_212_ENG1',
      locationCertainty: LOCATION_CERTAINTY.BUILDING_ONLY // 건물만 선택, 층수 미선택
    }
  };

  const res = engine.assess(input);

  assert(
    res.indeterminateItems.includes('실내 위치한 층수 미선택'),
    '층수 미선택이 판단 불가 항목으로 명시됨',
    'GPS로 실내 층을 판별할 수 없으므로 층수 부재를 사실대로 보고해야 함'
  );

  assert(
    res.neededForNextAssessment.includes('현재 위치한 층수(1~5층) 수동 선택'),
    '다음 판단을 위해 층수 수동 선택을 요구함',
    '수직 피난 경로를 산출하기 위해 사용자로부터 층수 입력을 받아야 함'
  );
}

// ----------------------------------------------------------------------------
// TEST 7: 옥외 경로 미검증 상태 (Unverified Outdoor Path)
// ----------------------------------------------------------------------------
console.log('\n--- Test 7: Unverified Outdoor Path Safeguard ---');
{
  const input = {
    disaster: { isShakingActive: false },
    user: {
      locationType: 'OUTDOOR',
      locationCertainty: LOCATION_CERTAINTY.ESTIMATED_COARSE
    },
    spatial: {
      outdoorPathStatus: 'UNVERIFIED'
    }
  };

  const res = engine.assess(input);

  assert(
    res.verificationStatus.routeVerification === VERIFICATION_STATUS.PROVISIONAL,
    '경로 검증 상태가 PROVISIONAL로 유지됨',
    '현장 실측 전에는 절대 VERIFIED 또는 안전 경로로 표기할 수 없음'
  );

  assert(
    res.warnings.some(w => w.includes('사전 계산된 "후보 경로"')),
    '후보 경로 및 현장 미검증 경고 문구가 반드시 포함됨',
    '지진 직후 지반 균열, 낙하물 위험이 있으므로 사용자가 맹신하지 않도록 경고해야 함'
  );
}

// ----------------------------------------------------------------------------
// TEST 8: 이동 제한 사용자 (Wheelchair User)
// ----------------------------------------------------------------------------
console.log('\n--- Test 8: Mobility-Impaired User Handling ---');
{
  const input = {
    disaster: { isShakingActive: false },
    user: {
      locationType: 'INDOOR',
      floor: 3,
      locationCertainty: LOCATION_CERTAINTY.MANUAL_EXACT,
      mobilityLimitation: MOBILITY_PROFILE.WHEELCHAIR
    }
  };

  const res = engine.assess(input);

  assert(
    res.canMove === false && res.canNavigate === false,
    '3층 휠체어 이용자의 단독 계단 이동 및 맹목적 경로 안내 차단',
    '엘리베이터가 금지되고 계단 단차가 존재하므로 단독 피난을 유도해서는 안 됨'
  );

  assert(
    res.recommendedAction.primary.includes('승강기는 전원 차단 위험이 있으므로 절대 탑승하지 마십시오'),
    '지진 시 승강기 탑승 엄금 및 보조인 지원 대기 안내',
    '승강기 갇힘 사고를 방지하고 안전구획 대기 및 구조 요청을 유도해야 함'
  );
}

// ----------------------------------------------------------------------------
// TEST 9: 데이터 지연 및 소실 (Stale Station Telemetry)
// ----------------------------------------------------------------------------
console.log('\n--- Test 9: Stale Telemetry Handling ---');
{
  const input = {
    timestamp: 1700000100000,
    disaster: { isShakingActive: false },
    user: {
      locationType: 'INDOOR',
      floor: 3,
      locationCertainty: LOCATION_CERTAINTY.MANUAL_EXACT
    },
    sources: {
      station: {
        timestamp: 1700000000000, // 100초 전 데이터 (30초 이상 지연)
        pga_g: 0.12
      }
    }
  };

  const res = engine.assess(input);

  const stationSrc = res.informationSources.find(s => s.type === DATA_PROVENANCE_SOURCE.OBSERVED_STATION);
  assert(
    stationSrc && stationSrc.status === 'STALE',
    '지연된 관측소 데이터가 STALE로 정확히 분류됨',
    '오래된 가속도 계측값으로 현재의 안전 여부를 섣불리 단정해서는 안 됨'
  );

  assert(
    res.warnings.some(w => w.includes('30초 이상 지연')),
    '데이터 지연 경고가 사용자에게 출력됨',
    '통신 단절이나 지연에 대한 인식을 사용자에게 명확히 전달해야 함'
  );
}

// ----------------------------------------------------------------------------
// TEST 10: 판단 불가 상황의 안전한 처리 (Indeterminate Safe Fallback)
// ----------------------------------------------------------------------------
console.log('\n--- Test 10: Safe Fallback under Total Uncertainty ---');
{
  const input = {
    // 모든 필드 결측 (완전 불확실 상태)
    user: {},
    disaster: {},
    sources: {}
  };

  const res = engine.assess(input);

  assert(
    res.recommendedAction.urgency === ASSESSMENT_URGENCY.CAUTION,
    '완전 불확실 상태에서 CAUTION 등급 부여',
    '정보가 없을 때 과도하게 낙관하거나 패닉을 조장하지 않고 방어적 주의 수준 유지'
  );

  assert(
    res.canMove === false && res.canNavigate === false,
    '정보 부족 시 무리한 이동을 유도하지 않음',
    '위치와 상황을 모르는 상태에서 임의로 경로를 안내하는 것은 치명적 사고를 유발함'
  );

  assert(
    res.neededForNextAssessment.length > 0,
    '필요한 정보 목록(위치 확인 등)을 명확하게 제시함',
    '사용자에게 다음 입력을 안내하여 점진적으로 불확실성을 해소해야 함'
  );
}

// ----------------------------------------------------------------------------
// SUMMARY
// ----------------------------------------------------------------------------
console.log('\n====================================================================');
console.log(`TEST SUITE RESULTS: ${passed} PASSED | ${failed} FAILED`);
console.log('====================================================================\n');

if (failed > 0) {
  Deno.exit(1);
}
