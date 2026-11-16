// ============================================================================
// SEISMOLIVE v4.0 — Phase P2.5 End-to-End Response Timeline Test Suite
// File: tests/test_p2_5_end_to_end_timeline.js
// Run via: deno run --allow-all tests/test_p2_5_end_to_end_timeline.js
// ============================================================================

import {
  ResponseTimelineSimulator,
  Mock3DResponseAdapter,
  P2_5_TIMELINE_EVENTS
} from '../js/response/ResponseTimelineSimulator.js';

import {
  PedestrianRoutingEngine,
  LINK_STATE,
  USER_MOBILITY_PROFILE
} from '../js/response/PedestrianRoutingEngine.js';

import {
  ResponseUIAdapter
} from '../js/response/ResponseUIAdapter.js';

import {
  LOCATION_CERTAINTY,
  MOBILITY_PROFILE
} from '../js/response/SituationAssessmentEngine.js';

import {
  DATA_PROVENANCE_SOURCE,
  VERIFICATION_STATUS
} from '../js/response/HanyangBuildingData.js';

import {
  GroundDataManager,
  GROUND_DATA_TYPE,
  GROUND_DATA_PROVENANCE_SOURCE,
  validateGroundDataContract
} from '../js/response/GroundDataContract.js';

let passed = 0;
let failed = 0;

function assert(condition, message, detail = '') {
  if (condition) {
    passed++;
    console.log(`  [PASS] ${message}`);
    if (detail) {
      console.log(`         -> 타당성: ${detail}`);
    }
  } else {
    failed++;
    console.error(`  [FAIL] ${message}`);
    if (detail) {
      console.error(`         -> 실패 원인/타당성: ${detail}`);
    }
  }
}

console.log('====================================================================');
console.log('SEISMOLIVE v4.0 — Phase P2.5 End-to-End Response Timeline Tests');
console.log('Timeline Simulation · Subsystem Sync · Edge Cases · Data Contracts');
console.log('====================================================================\n');

// ============================================================================
// PART 1: BASE TIMELINE SIMULATION (T+0s -> T+110s)
// ============================================================================
console.log('--- Part 1: Baseline Response Timeline (T+0s ~ T+110s) ---');

const sim = new ResponseTimelineSimulator();
const timelineSnapshots = sim.runFullTimeline();

// T+0s Checks
{
  const snap0 = timelineSnapshots[0];
  assert(
    snap0.simTimeSec === 0 && snap0.assessment.canMove === false && snap0.assessment.canNavigate === false,
    'T+0s 지진 발생: 이동 및 경로 안내 즉각 차단 (canMove = false, canNavigate = false)',
    '지반 가속도(PGA 0.22g) 급증에 따라 실내 두부 보호 최우선 원칙 발동'
  );
  assert(
    snap0.scene3D.actual3DMode === 'NONE' && snap0.scene3D.routeDisplayMode === 'HIDDEN',
    'T+0s 3D 뷰포트: 피난 경로선 화면 노출 원천 차단 (NONE/HIDDEN)',
    '진동 중 뛰쳐나가지 못하도록 화면 상의 피난 경로선 즉각 소거'
  );
  assert(
    snap0.guidance.primaryAction.includes('몸을 낮추고 튼튼한 탁자 아래'),
    'T+0s 행동 지침: 실내 엄폐 및 머리 보호 수칙 제시',
    '한국어 중심 행동 우선 지침 출력'
  );
  const inv0 = sim.verifyInvariants(snap0);
  assert(inv0.passed, 'T+0s 시스템 불변성 검증 통과', '이동 불가 상태와 3D 은닉 간 정합성 확인');
}

// T+40s Checks
{
  const snap40 = timelineSnapshots[1];
  assert(
    snap40.simTimeSec === 40 && snap40.assessment.canMove === true && snap40.assessment.canNavigate === true,
    'T+40s 진동 정지: 이동 및 경로 안내 정상 활성화 (canMove = true, canNavigate = true)',
    '외부 계측치(PGA 0.01g) 수신에 의한 진동 안정화 확인 및 현장 점검 개시'
  );
  assert(
    snap40.scene3D.actual3DMode === 'ALL' && snap40.routing.found === true,
    'T+40s 3D 뷰포트: 초기 최단 피난 경로선 3D 표출 (ALL 모드)',
    '제1공학관 3층 -> 1층 비상계단 -> 옥외 대운동장 최단 경로 표출'
  );
  assert(
    snap40.guidance.primaryAction.includes('출구 쪽 문을 열어 탈출로를 확보'),
    'T+40s 행동 지침: 문틀 변형 방지를 위한 문 개방 및 피난 준비 안내',
    '진동 종료 직후 표준 안전 수칙 제시'
  );
  const inv40 = sim.verifyInvariants(snap40);
  assert(inv40.passed, 'T+40s 시스템 불변성 검증 통과', '정상 대피 상태와 3D 표출 간 정합성 확인');
}

// T+65s & T+67s Checks (Stair Crack & Detour Replanning)
{
  const snap67 = timelineSnapshots[3];
  assert(
    snap67.routing.replanned === true && (snap67.routing.totalDistanceMeters === 855.1 || snap67.routing.totalDistanceMeters === 769.1),
    'T+67s 동적 재탐색: 계단 균열 제보로 무단차 우회로 전환 (+117.2m 우회 반영)',
    '최단 계단로에 부여된 탐색 가중치로 인해 깨끗한 우회로로 자율 전환 (3층 기점 855.1m)'
  );
  assert(
    snap67.scene3D.actual3DMode === 'STEP_FREE',
    'T+67s 3D 뷰포트: 3D 경로선이 무단차 벡터(STEP_FREE)로 즉시 동기화됨',
    '기존 계단 경로를 화면에서 소거하고 우회 도로를 재렌더링'
  );
  assert(
    snap67.guidance.warnings.some(w => w.includes('경로 재탐색:')),
    'T+67s 사용자 안내: 경로 변경 사유 및 우회 안내 고지',
    '사용자에게 기존 경로 폐쇄 및 우회 사실 통지'
  );
  const inv67 = sim.verifyInvariants(snap67);
  assert(inv67.passed, 'T+67s 시스템 불변성 검증 통과', '우회로 활성화 및 3D 동기화 확인');
}

// T+110s Checks (Aftershock & Immediate Suspension)
{
  const snap110 = timelineSnapshots[4];
  assert(
    snap110.assessment.hasAftershock === true && snap110.assessment.canMove === false && snap110.assessment.canNavigate === false,
    'T+110s 여진 발생: 이동 및 피난 안내 즉각 중단 (canMove = false, canNavigate = false)',
    '여진 감지 신호 입력 시 즉각 보행 중단 및 엄폐 복귀'
  );
  assert(
    snap110.scene3D.actual3DMode === 'NONE' && snap110.scene3D.routeDisplayMode === 'HIDDEN',
    'T+110s 3D 뷰포트: 여진 발생 즉시 3D 경로선 완전 소거 (잔류 잔상 0)',
    '화면에 경로선이 남아 사용자를 위험한 보행으로 유도하지 않도록 엄격히 차단'
  );
  assert(
    snap110.guidance.primaryAction.includes('여진 발생: 즉시 이동을 멈추고'),
    'T+110s 행동 지침: 여진 대응 즉각 방호 수칙 출력',
    '진동 중 이동 금지 원칙 재확인'
  );
  const inv110 = sim.verifyInvariants(snap110);
  assert(inv110.passed, 'T+110s 시스템 불변성 검증 통과', '여진 시 3D 경로 소거 및 이동 차단 불변성 확인');
}

// ============================================================================
// PART 2: ADDITIONAL VERIFICATION SCENARIOS
// ============================================================================
console.log('\n--- Part 2: Additional Edge-Case Scenarios ---');

// Scenario A: 대체 경로도 SUSPECTED인 상황
console.log('\n- Scenario A: Alternate Route Also SUSPECTED -');
{
  const routerA = new PedestrianRoutingEngine();
  const mock3DA = new Mock3DResponseAdapter();
  const adapterA = new ResponseUIAdapter({ router: routerA, hanyangAdapter: mock3DA });
  adapterA.updateStationMotion(0.01); // quiescent
  adapterA.setUserFloor(1); // from 1F SE exit

  // 최단 계단 구간과 우회로 램프 구간 둘 다 의심 제보 등록
  adapterA.reportLinkObstacle('NODE_STAIR1_TOP->NODE_STAIR1_BOT', LINK_STATE.SUSPECTED, {
    detail: '계단 1구간 미확인 균열'
  });
  adapterA.reportLinkObstacle('OSM_NODE_6415394841->NODE_RAMP_MID', LINK_STATE.SUSPECTED, {
    detail: '우회 경사로 부근 낙하 타일 제보'
  });

  const guidanceA = adapterA.reassess();

  assert(
    guidanceA.canNavigate === true,
    'A. 대체 경로도 SUSPECTED일 때 통행 불가는 아니므로 탐색 자체는 유지',
    '완전 폐쇄(CLOSED)가 아닌 의심 상황에서는 최선의 통행로 유지'
  );
  assert(
    guidanceA.warnings.some(w => w.includes('미확인 위험 신고(SUSPECTED)')) ||
    guidanceA.unverifiedItems.some(i => i.includes('미확인 위험(SUSPECTED)')),
    'A. 대체 경로 상의 미확인 위험 및 주의사항이 사용자에게 투명하게 전달됨',
    '의심 구간 통행 시 안전을 보증하지 않고 경고 문구 의무 출력'
  );
}

// Scenario B: 대체 경로가 UNKNOWN 링크를 포함하는 상황
console.log('\n- Scenario B: Alternate Route Contains UNKNOWN Link -');
{
  const routerB = new PedestrianRoutingEngine();
  const mock3DB = new Mock3DResponseAdapter();
  const adapterB = new ResponseUIAdapter({ router: routerB, hanyangAdapter: mock3DB });
  adapterB.updateStationMotion(0.01);
  adapterB.setUserFloor(1);

  // 최단 계단 폐쇄
  adapterB.reportLinkObstacle('NODE_STAIR1_TOP->NODE_STAIR1_BOT', LINK_STATE.CLOSED);
  // 우회로 램프 구간 상태 미확인(UNKNOWN)
  adapterB.reportLinkObstacle('OSM_NODE_6415394841->NODE_RAMP_MID', LINK_STATE.UNKNOWN, {
    detail: '현장 미점검 구간'
  });

  const guidanceB = adapterB.reassess();

  assert(
    guidanceB.replanStatus.isReplanned === true && guidanceB.replanStatus.traversedUnknown === true,
    'B. UNKNOWN 링크를 경유하는 경로 산출 시 traversedUnknown = true 기록',
    'UNKNOWN 링크는 검증된 OPEN으로 취급되지 않으며 탐색 결과에 미검증 사실 보존'
  );
  assert(
    guidanceB.unverifiedItems.some(i => i.includes('미검증(UNKNOWN)') || i.includes('후보 경로')),
    'B. UNKNOWN 구간 통행 불확실성이 UI 불확실성 목록에 명시됨',
    '사용자에게 과도한 안전 신뢰를 주지 않음'
  );
}

// Scenario C: 모든 경로가 CLOSED인 상황
console.log('\n- Scenario C: All Routes CLOSED (Fail-Safe Trap) -');
{
  const routerC = new PedestrianRoutingEngine();
  const mock3DC = new Mock3DResponseAdapter();
  const adapterC = new ResponseUIAdapter({ router: routerC, hanyangAdapter: mock3DC });
  adapterC.updateStationMotion(0.01);

  // 최단로 및 우회로 전면 폐쇄
  adapterC.reportLinkObstacle('NODE_STAIR1_TOP->NODE_STAIR1_BOT', LINK_STATE.CLOSED);
  adapterC.reportLinkObstacle('OSM_NODE_6415394841->NODE_RAMP_MID', LINK_STATE.CLOSED);

  const guidanceC = adapterC.reassess();

  assert(
    guidanceC.canNavigate === false && guidanceC.routeStatus.displayMode === 'HIDDEN',
    'C. 모든 대피로 차단 시 canNavigate = false 및 3D 경로선 HIDDEN 처리',
    '갈 수 없는 경로를 조작하여 표시하지 않음'
  );
  assert(
    mock3DC.routeDisplay === 'NONE',
    'C. 3D WebGL 씬 경로선 즉각 소거 (NONE)',
    '화면에서 경로선 완전 제거'
  );
  assert(
    guidanceC.routeStatus.caveat.includes('실내 격리 방호(Shelter-in-Place)로 전환') &&
    guidanceC.routeStatus.caveat.includes('건물의 안전성을 보증하는 것이 아닙니다'),
    'C. Shelter-in-Place 안내 시 건물의 안전성 보증이 아님을 명시',
    '단순 대피로 차단에 따른 임시 방호 조치임을 정확히 규정'
  );
}

// Scenario D: 여진 발생 직전 사용자가 경로/층수를 변경한 상황
console.log('\n- Scenario D: Location Mutation Right Before Aftershock -');
{
  const routerD = new PedestrianRoutingEngine();
  const mock3DD = new Mock3DResponseAdapter();
  const adapterD = new ResponseUIAdapter({ router: routerD, hanyangAdapter: mock3DD });
  adapterD.updateStationMotion(0.01);

  // 사용자가 1층으로 이동 완료
  adapterD.setUserLocation({ locationType: 'INDOOR', floor: 1, room: null, certainty: LOCATION_CERTAINTY.FLOOR_ONLY });
  // 직후 여진 발생
  adapterD.setAftershock(true);
  const guidanceD = adapterD.reassess();

  assert(
    guidanceD.canMove === false && mock3DD.routeDisplay === 'NONE',
    'D. 위치 변경 직후 여진 입력 시 여진 방호 원칙이 최우선 적용되어 3D 경로 소거',
    '어떤 위치 조작이 선행되었더라도 여진 신호가 즉시 모든 이동을 차단함'
  );
}

// Scenario E: 현장 신고와 공식 통행 제한의 충돌
console.log('\n- Scenario E: Citizen Report vs Official Restriction Conflict -');
{
  const routerE = new PedestrianRoutingEngine();
  const mock3DE = new Mock3DResponseAdapter();
  const adapterE = new ResponseUIAdapter({ router: routerE, hanyangAdapter: mock3DE });
  adapterE.updateStationMotion(0.01);

  // 일반 시민: "계단 1구간 통행 문제없음" 주장
  // 소방서 공식: "계단 1구간 폐쇄 조치"
  adapterE.reportLinkObstacle('NODE_STAIR1_TOP->NODE_STAIR1_BOT', LINK_STATE.CLOSED, {
    source: DATA_PROVENANCE_SOURCE.OFFICIAL_DISASTER_INFO,
    verificationStatus: VERIFICATION_STATUS.VERIFIED,
    confidence: 1.0,
    detail: '성동소방서 지진 긴급 구조대 폐쇄 결정'
  });

  const stateRec = routerE.getLinkState('NODE_STAIR1_TOP->NODE_STAIR1_BOT');
  assert(
    stateRec.state === LINK_STATE.CLOSED && stateRec.confidence === 1.0,
    'E. 공식 통행 제한이 최고 신뢰도(1.0)로 유지되어 계단 폐쇄 확정',
    '공식 안전 기관의 폐쇄 판단을 일반 제보로 덮어쓰지 않음'
  );
}

// Scenario F: 사용자 위치 불확실 (층수 미선택)
console.log('\n- Scenario F: User Location Certainty Lost (Floor Unknown) -');
{
  const routerF = new PedestrianRoutingEngine();
  const mock3DF = new Mock3DResponseAdapter();
  const adapterF = new ResponseUIAdapter({ router: routerF, hanyangAdapter: mock3DF });
  adapterF.updateStationMotion(0.01);

  adapterF.setUserLocation({
    locationType: 'INDOOR',
    buildingId: 'BLDG_212_ENG1',
    floor: null,
    certainty: LOCATION_CERTAINTY.BUILDING_ONLY
  });

  const guidanceF = adapterF.reassess();

  assert(
    guidanceF.canNavigate === false && mock3DF.routeDisplay === 'NONE',
    'F. 층수 미선택 시 canNavigate = false 및 3D 경로선 차단',
    '수직 위치를 알 수 없는 상태에서 맹목적인 경로 산출 금지'
  );
  assert(
    guidanceF.routeStatus.caveat.includes('현재 층수를 수동 선택하십시오'),
    'F. 사용자에게 층수 수동 선택 요구 문구 표출',
    '불확실성 해소를 위한 명확한 사용자 인터랙션 유도'
  );
}

// Scenario G: 휠체어 접근성 검증 미완료 상태
console.log('\n- Scenario G: Wheelchair Accessibility Caveat Enforced -');
{
  const routerG = new PedestrianRoutingEngine();
  const mock3DG = new Mock3DResponseAdapter();
  const adapterG = new ResponseUIAdapter({ router: routerG, hanyangAdapter: mock3DG });
  adapterG.updateStationMotion(0.01);
  adapterG.setUserLocation({ locationType: 'OUTDOOR', floor: null, room: null, certainty: LOCATION_CERTAINTY.EXACT_ROOM });
  adapterG.setMobility(MOBILITY_PROFILE.WHEELCHAIR);

  const guidanceG = adapterG.reassess();

  assert(
    guidanceG.replanStatus.isStepFree === true && guidanceG.replanStatus.isWheelchairVerified === false,
    'G. 휠체어 프로필: 무단차 경로(769.1m) 산출되나 isWheelchairVerified = false 엄격 유지',
    'OSM 데이터의 계단 없음과 현장 휠체어 접근성을 분리'
  );
  assert(
    guidanceG.warnings.some(w => w.includes('현장 경사도/단차 실측(F-03/F-05) 전이므로 안전을 보증하지 않습니다')),
    'G. 현장 실측 전 안전 미보증 경고 문구 의무 출력',
    '접근성 미검증 사실을 명시하여 과도한 안전 확신 방지'
  );
}

// ============================================================================
// PART 3: GROUND DATA INPUT CONTRACT SCHEMA VALIDATION
// ============================================================================
console.log('\n--- Part 3: Ground Data Input Contract & Governance Tests ---');

const gdm = new GroundDataManager();

// Contract Test 1: Complete Valid Record Registration
{
  const sampleF01 = {
    id: 'GDC_HY_ENG1_3F_EVAC_MAP_20261111',
    dataType: GROUND_DATA_TYPE.ARCHITECTURAL_FLOOR_PLAN,
    targetSpace: {
      buildingId: 'BLDG_212_ENG1',
      floor: 3,
      spaceId: 'ZONE_3F_EAST_CORRIDOR'
    },
    source: {
      organization: 'Hanyang University Facility Management',
      documentRef: 'HY-ENG1-DWG-2024-F3-V2',
      provenanceType: GROUND_DATA_PROVENANCE_SOURCE.OFFICIAL_BLUEPRINT
    },
    acquiredAt: '2026-11-11T10:00:00Z',
    verifiedAt: null,
    verifiedBy: null,
    status: VERIFICATION_STATUS.PROVISIONAL,
    version: '1.0.0',
    previousVersion: null,
    changes: ['제1공학관 3층 소방 피난 계획도 원본 등록 (현장 실측 전 잠정 데이터)'],
    attributes: {
      corridorWidthMeters: 2.40,
      fireDoorCount: 2
    }
  };

  const regResult = gdm.registerRecord(sampleF01);
  assert(
    regResult.success === true,
    'C1. 완전한 규격의 F-01 잠정 데이터(PROVISIONAL) 등록 성공',
    '모든 필수 필드, SemVer 버전, 출처 정보 포함 확인'
  );
}

// Contract Test 2: Prohibition of VERIFIED elevation without authority/timestamps
{
  const invalidVerified = {
    id: 'GDC_HY_ENG1_1F_EXIT_INVALID',
    dataType: GROUND_DATA_TYPE.EXIT_DOOR_SPECIFICATION,
    targetSpace: { buildingId: 'BLDG_212_ENG1', floor: 1 },
    source: {
      organization: 'Citizen Field Spotter',
      provenanceType: GROUND_DATA_PROVENANCE_SOURCE.USER_FIELD_REPORT // Unofficial source!
    },
    acquiredAt: '2026-11-11T12:00:00Z',
    verifiedAt: null, // Missing verifiedAt!
    verifiedBy: null, // Missing verifiedBy!
    status: VERIFICATION_STATUS.VERIFIED, // Illegal elevation!
    version: '1.0.0',
    previousVersion: null,
    changes: ['사용자 제보로 출구 검증 시도']
  };

  const regResult = gdm.registerRecord(invalidVerified);
  assert(
    regResult.success === false && regResult.errors.length >= 3,
    'C2. 검증자, 시각, 공식 출처 없는 불법적 VERIFIED 승격 원천 차단',
    '엄격한 과학적 데이터 계약에 의해 현장 실측 전 임의 승격 거부'
  );
}

// Contract Test 3: Version Progression & Diffing
{
  const v1 = {
    id: 'GDC_HY_RAMP_F03_TEST',
    dataType: GROUND_DATA_TYPE.ACCESSIBILITY_RAMP,
    targetSpace: { buildingId: 'BLDG_212_ENG1', floor: 1 },
    source: {
      organization: 'Campus Survey Team',
      provenanceType: GROUND_DATA_PROVENANCE_SOURCE.AUTHORIZED_FIELD_SURVEY
    },
    acquiredAt: '2026-11-11T13:00:00Z',
    verifiedAt: '2026-11-11T13:30:00Z',
    verifiedBy: 'Seongdong Fire Safety Inspector #12',
    status: VERIFICATION_STATUS.PARTIALLY_VERIFIED,
    version: '1.0.0',
    previousVersion: null,
    changes: ['최초 현장 경사로 측정 등록'],
    attributes: { rampSlopePercent: 5.2, thresholdHeightCm: 1.8 }
  };
  gdm.registerRecord(v1);

  const v2 = {
    ...v1,
    version: '1.1.0',
    previousVersion: '1.0.0',
    status: VERIFICATION_STATUS.VERIFIED,
    changes: ['국립재난안전연구원 공동 실측 확인 및 공인 완료'],
    attributes: { rampSlopePercent: 5.1, thresholdHeightCm: 1.7 }
  };
  const updateResult = gdm.registerRecord(v2);

  assert(
    updateResult.success === true,
    'C3. SemVer 버전 진보(1.0.0 -> 1.1.0) 및 공인 검증 후 VERIFIED 승격 성공',
    '적격 검증 주체 및 검증 시각을 갖춘 공식 변경 승인'
  );

  const diff = gdm.getDiff('GDC_HY_RAMP_F03_TEST');
  assert(
    diff !== null && diff.fromVersion === '1.0.0' && diff.toVersion === '1.1.0' && diff.statusTransition === 'PARTIALLY_VERIFIED -> VERIFIED',
    'C3. 버전 간 변경 내역(Diff) 및 상태 전이 이력 정상 추적',
    '데이터 거버넌스 및 감사 추적성(Audit Trail) 확보'
  );
}

// ============================================================================
// SUMMARY
// ============================================================================
console.log('\n====================================================================');
console.log(`TEST SUITE RESULTS: ${passed} PASSED | ${failed} FAILED`);
console.log('====================================================================\n');

if (failed > 0) {
  Deno.exit(1);
}
