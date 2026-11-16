// ============================================================================
// SEISMOLIVE v4.0 — Phase P2.3 Interface Integration Test Suite
// File: tests/test_p2_3_interface_integration.js
// Run via: deno run --allow-all tests/test_p2_3_interface_integration.js
// ============================================================================

import {
  ResponseUIAdapter
} from '../js/response/ResponseUIAdapter.js';

import {
  SituationAssessmentEngine,
  ASSESSMENT_URGENCY,
  LOCATION_CERTAINTY,
  MOBILITY_PROFILE,
  CONFLICT_RESOLUTION_STRATEGY
} from '../js/response/SituationAssessmentEngine.js';

import { VERIFICATION_STATUS } from '../js/response/HanyangBuildingData.js';

let passed = 0;
let failed = 0;

function assert(condition, message, detail = '') {
  if (condition) {
    passed++;
    console.log(`  [PASS] ${message}`);
    if (detail) {
      console.log(`         -> ${detail}`);
    }
  } else {
    failed++;
    console.error(`  [FAIL] ${message}`);
    if (detail) {
      console.error(`         -> ${detail}`);
    }
  }
}

console.log('====================================================================');
console.log('SEISMOLIVE v4.0 — Phase P2.3 Interface Integration Test Suite');
console.log('Assessment Engine -> UI Adapter -> 3D Scene Controls & 10 Scenarios');
console.log('====================================================================\n');

// Mock HanyangResponseAdapter to verify 3D scene synchronizations
class MockHanyangAdapter {
  constructor() {
    this.selectedFloor = 3;
    this.routeDisplay = 'ALL';
  }
  setSelectedFloor(f) {
    this.selectedFloor = f;
  }
  setRouteDisplay(mode) {
    this.routeDisplay = mode;
  }
}

const mock3D = new MockHanyangAdapter();
const adapter = new ResponseUIAdapter({ hanyangAdapter: mock3D });

// ----------------------------------------------------------------------------
// CATEGORY 1: 10대 재난 상황별 실제 안내 분기 검증 (10 Distinct Scenarios)
// ----------------------------------------------------------------------------
console.log('--- Category 1: 10 Distinct Situational Scenarios ---');

// 1. 흔들림 중 실내 사용자
{
  adapter.updateStationMotion(0.18);
  adapter.setUserLocation({ locationType: 'INDOOR', floor: 3, certainty: LOCATION_CERTAINTY.MANUAL_EXACT });
  const g = adapter.reassess();

  assert(
    g.canMove === false && g.canNavigate === false,
    '1. 흔들림 중 실내 사용자: 이동 및 경로 안내 엄격 비활성화 (canMove = false)',
    '진동 중 보행은 낙상 및 조명/천장재 낙하로 인한 치명상을 유발하므로 정지 상태 엄폐 유지'
  );
  assert(
    mock3D.routeDisplay === 'NONE',
    '1. 3D 어댑터: 이동 불가 상황에서 3D 피난 경로선이 화면에서 자동으로 숨겨짐 (NONE)',
    '이동이 금지된 엄폐 단계에서 대피 경로 화살표를 표시하는 것은 치명적인 오안내임'
  );
  assert(
    g.primaryAction.includes('몸을 낮추고 튼튼한 탁자 아래로 들어가 머리를 보호'),
    '1. 안내 문구: DROP, COVER, HOLD ON 한국어 권고 행동 표출',
    '내부 S1 코드 대신 명확한 행동 지침 출력'
  );
}

// 2. 흔들림이 멈춘 실내 사용자
{
  adapter.updateStationMotion(0.01); // 진동 멈춤
  adapter.setUserFloor(3);
  const g = adapter.reassess();

  assert(
    g.canMove === true && g.canNavigate === true,
    '2. 흔들림 멈춤 직후: 이동 가능 및 경로 안내 활성화',
    '진동이 안정화되면 실내 위험 점검 및 탈출로 확보 개시'
  );
  assert(
    mock3D.routeDisplay === 'ALL',
    '2. 3D 어댑터: 피난 경로선 정상 표출 (ALL)',
    '비상계단 및 옥외 경로 벡터 렌더링 재개'
  );
  assert(
    g.primaryAction.includes('출구 쪽 문을 열어 탈출로를 확보'),
    '2. 안내 문구: 문틀 뒤틀림 방지 및 문 개방 행동 지시',
    '지진 후 문틀 변형으로 실내 갇힘 방지를 최우선 안내'
  );
}

// 3. 여진이 발생한 상태에서 이동 중인 사용자
{
  adapter.setAftershock(true);
  const g = adapter.reassess();

  assert(
    g.canMove === false,
    '3. 이동 중 여진 발생: 즉시 보행 정지 및 엄폐 복귀',
    '이동 중 여진 발생 시 계단 낙상 위험으로 즉시 주저앉아야 함'
  );
  assert(
    g.primaryAction.includes('여진 발생: 즉시 이동을 멈추고'),
    '3. 안내 문구: 여진 감지에 따른 즉각적인 자세 낮춤 지침',
    '보행을 멈추고 내벽이나 기둥 옆 엄폐 지시'
  );
  assert(
    mock3D.routeDisplay === 'NONE',
    '3. 3D 어댑터: 여진 중 경로선 즉시 비활성화',
    '움직이지 못하게 경로를 차단함'
  );
  adapter.setAftershock(false); // reset
}

// 4. 출구 또는 복도가 차단된 사용자
{
  adapter.updateStationMotion(0.01);
  adapter.reportHazard('EXIT_BLOCKED', true, '1층 동남 비상문 변형');
  const g = adapter.reassess();

  assert(
    g.canMove === false && g.canNavigate === false,
    '4. 출구 차단 사용자: 억지 돌파 차단 및 실내 격리 방어 (SHELTER_IN_PLACE)',
    '차단된 출구로 무리하게 이동 시 압사 및 고립 위험'
  );
  assert(
    g.phaseHeadline.includes('탈출로 차단 — 실내 격리 방호 및 구조 요청'),
    '4. 안내 문구: 실내 안전 호실 대기 및 119 구조 요청 지시',
    '비상구 불통 시의 안전 방어 안내'
  );
  assert(
    mock3D.routeDisplay === 'NONE',
    '4. 3D 어댑터: 폐쇄된 출구 방향 경로선 즉각 차단',
    '차단된 경로로 사용자를 유도하지 않음'
  );
  adapter.clearHazard('EXIT_BLOCKED'); // reset
}

// 5. 화재·연기 의심 정보가 있는 사용자 (미확인 국소 위험)
{
  adapter.reportHazard('FIRE_OR_SMOKE', true, '3층 복도 연기 냄새');
  const g = adapter.reassess();

  assert(
    g.canMove === true && g.urgency === ASSESSMENT_URGENCY.IMMEDIATE,
    '5. 화재 의심 보고: 즉각적인 IMMEDIATE 긴급도 부여 및 저자세 피난 안내',
    '유독가스 확산 전 신속한 계단실 이동 권고'
  );
  assert(
    g.unverifiedItems.some(i => i.includes('화재·연기 발생 진위 여부')),
    '5. 미확인 정보 명시: 사용자 신고만으로 화재를 기정사실화하지 않고 미확인 의심 정보로 공표',
    '오인 보고나 악의적 루머에 의한 전체 혼란 방지 및 사실과 의심의 정직한 구분'
  );
  assert(
    g.primaryAction.includes('미확인 화재·연기 의심 보고 접수: 젖은 수건이나 옷으로 코와 입을 막고'),
    '5. 안내 문구: 미확인임을 명시하면서도 생명안전을 위한 보수적 방어 행동 지시',
    '질식 위험 대비 저자세 피난'
  );
  adapter.clearHazard('FIRE_OR_SMOKE'); // reset
}

// 6. 가스 누출 의심 정보가 있는 사용자
{
  adapter.reportHazard('GAS_LEAK', true, '연구실 가스 냄새');
  const g = adapter.reassess();

  assert(
    g.primaryAction.includes('전기 스위치나 라이터를 절대 켜지 말고'),
    '6. 가스 누출 의심: 스파크 폭발 위험 방지를 위한 점화원 차단 경고 필수 출력',
    '스위치 조작 금지가 가스 누출 시 최우선 안전 수칙'
  );
  assert(
    g.warnings.some(w => w.includes('가스 냄새 의심 보고는 미검증 상태')),
    '6. 미검증 상태 유지: 가스 누출을 절대 확정 사실로 단정하지 않음',
    '센서 계측이 아닌 사용자 후각 보고임을 보존'
  );
  adapter.clearHazard('GAS_LEAK'); // reset
}

// 7. 공식 대피 지시와 현장 신고가 충돌하는 상황
{
  adapter.setOfficialAlert({
    issued: true,
    authority: 'MOIS',
    instructionCode: 'STAY_INDOORS_HOLD',
    instruction: '실내에서 질서를 유지하고 대기하십시오'
  });
  adapter.reportHazard('FIRE_OR_SMOKE', true, '3층 배전반 불꽃 감지');
  const g = adapter.reassess();

  assert(
    g.conflictResolution.strategy === CONFLICT_RESOLUTION_STRATEGY.LOCAL_UNVERIFIED_HAZARD_PRECAUTION,
    '7. 정보 충돌: 공식 지침을 임의 무효화하지 않고 보수적 예비 조치(LOCAL_UNVERIFIED_HAZARD_PRECAUTION) 발동',
    '국가 공식 재난 문자를 취소할 권한은 없으나 현장 생명안전을 위해 예비 대피를 보수적으로 안내함'
  );
  assert(
    g.unverifiedItems.some(i => i.includes('상황 불일치')),
    '7. 불확실성 명시: 공식 광역 대기 지침과 국소 화재 의심 제보 간 불일치가 명시됨',
    '충돌이 해소되지 않았음을 사용자에게 투명하게 알림'
  );
  adapter.clearHazard('FIRE_OR_SMOKE');
  adapter.setOfficialAlert(null); // reset
}

// 8. 휠체어 등 이동 제약이 있는 사용자
{
  adapter.setMobility(MOBILITY_PROFILE.WHEELCHAIR);
  const g = adapter.reassess();

  assert(
    g.canMove === false && g.canNavigate === false,
    '8. 3층 휠체어 이용자: 단독 계단 피난 차단 및 보조인 대기 안내',
    '엘리베이터가 금지된 상태에서 계단 단차로 인해 단독 이동 불가능'
  );
  assert(
    g.primaryAction.includes('승강기는 전원 차단 위험이 있으므로 절대 탑승하지 마십시오'),
    '8. 휠체어 지침: 지진 중 승강기 탑승 엄금 및 피난 대기구획 보조인 지원 대기',
    '승강기 갇힘 사망사고 방지'
  );
  assert(
    mock3D.routeDisplay === 'NONE',
    '8. 3D 어댑터: 보조인 없는 3층 단독 이동 시 계단 경로선 차단',
    '휠체어 사용자에게 계단 경로를 표시하지 않음'
  );
  adapter.setMobility(MOBILITY_PROFILE.NONE); // reset
}

// 9. 현재 층이나 위치가 확인되지 않는 사용자
{
  adapter.setUserLocation({ locationType: 'INDOOR', buildingId: 'BLDG_212_ENG1', floor: null, certainty: LOCATION_CERTAINTY.BUILDING_ONLY });
  const g = adapter.reassess();

  assert(
    g.canNavigate === false,
    '9. 층수 미선택: 수직 피난 경로 산출 차단',
    'GPS로 층을 알 수 없으므로 맹목적 경로 안내 방지'
  );
  assert(
    g.neededInformation.includes('현재 위치한 층수(1~5층) 수동 선택'),
    '9. 필요 정보 제시: 사용자에게 층수 선택을 요구함',
    '불확실성을 해결하기 위한 다음 행동 제시'
  );
  adapter.setUserFloor(3); // reset
}

// 10. 경로 데이터가 오래되었거나 검증되지 않은 상황
{
  adapter.setOutdoorPathStatus('UNVERIFIED');
  const g = adapter.reassess();

  assert(
    g.unverifiedItems.some(i => i.includes('사전 계산된 후보 경로')),
    '10. 미검증 경로: "사전 계산된 후보 경로" 경고 및 현장 안전 미보증 공표',
    '지진 직후 지반 균열, 옹벽 낙석 가능성에 대한 안전 고지'
  );
  assert(
    g.routeStatus.caveat.includes('사전 후보 경로이며'),
    '10. 경로 표시가 통행 안전 보증을 의미하지 않음을 명시',
    '절대적 안전 경로라는 허위 안도감 배제'
  );
}

// ----------------------------------------------------------------------------
// CATEGORY 2: UI Adapter와 3D Scene의 일관성 및 입력 변경 반응성
// ----------------------------------------------------------------------------
console.log('\n--- Category 2: UI Consistency & Input Reactivity ---');

{
  // 층수 변경 시 3D 모델의 선택 층 즉각 갱신
  adapter.setUserFloor(1);
  assert(mock3D.selectedFloor === 1, '사용자 층수 변경(1층) 시 3D 어댑터 선택 층 즉각 연동');

  adapter.setUserFloor(4);
  assert(mock3D.selectedFloor === 4, '사용자 층수 변경(4층) 시 3D 어댑터 선택 층 즉각 연동');

  // 내부 상태 코드 노출 금지 확인
  const g = adapter.lastGuidance;
  assert(!g.phaseHeadline.includes('S1_') && !g.phaseHeadline.includes('S2_') && !g.phaseHeadline.includes('S3_'),
    '화면 헤드라인에 내부 상태 머신 코드(S1, S2, S3...)가 노출되지 않음'
  );
  assert(!g.badgeText.includes('DATA_PROVENANCE_SOURCE') && !g.badgeText.includes('RESPONSE_STATES'),
    '화면 배지에 개발자용 Enum 식별자가 노출되지 않음'
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
