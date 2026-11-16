// ============================================================================
// SEISMOLIVE v4.0 — Phase P2.4 Dynamic Route Replanning Test Suite
// File: tests/test_p2_4_dynamic_replanning.js
// Run via: deno run --allow-all tests/test_p2_4_dynamic_replanning.js
// ============================================================================

import {
  PedestrianRoutingEngine,
  LINK_STATE,
  USER_MOBILITY_PROFILE,
  PATH_TYPE
} from '../js/response/PedestrianRoutingEngine.js';

import {
  ResponseUIAdapter
} from '../js/response/ResponseUIAdapter.js';

import {
  SituationAssessmentEngine,
  LOCATION_CERTAINTY,
  MOBILITY_PROFILE
} from '../js/response/SituationAssessmentEngine.js';

import {
  DATA_PROVENANCE_SOURCE,
  VERIFICATION_STATUS
} from '../js/response/HanyangBuildingData.js';

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
console.log('SEISMOLIVE v4.0 — Phase P2.4 Dynamic Route Replanning Tests');
console.log('Link States · Dynamic Dijkstra · Mobility Restrictions · Fail-Safes');
console.log('====================================================================\n');

const router = new PedestrianRoutingEngine();
const adapter = new ResponseUIAdapter({ router });

// ----------------------------------------------------------------------------
// TEST 1: 기존 최단 경로의 단일 링크 CLOSED (Single Link Closed)
// ----------------------------------------------------------------------------
console.log('--- Test 1: Single Link Closed on Shortest Path ---');
{
  router.resetAllLinkStates();
  const stair1Edge = 'NODE_STAIR1_TOP->NODE_STAIR1_BOT';
  
  router.setLinkState(stair1Edge, LINK_STATE.CLOSED, {
    source: DATA_PROVENANCE_SOURCE.USER_FIELD_REPORT,
    detail: '계단 1구간 콘크리트 박리 및 난간 붕괴'
  });

  const res = router.findOutdoorShortestPath();

  assert(
    res.found === true,
    '대체 경로 탐색 성공',
    '계단 1구간이 폐쇄되어도 무단차 우회로가 존재하여 대피 경로 연결 성공'
  );
  assert(
    res.isStepFree === true && res.totalDistanceMeters === 769.1,
    '최단 경로 단일 링크 폐쇄 시 무단차 우회로(769.1m, 계단 0m)로 자동 재탐색됨',
    '폐쇄된 계단을 우회하여 0m 계단의 안전한 무단차 도로로 전환됨 (+117.2m 우회)'
  );
  assert(
    res.replanned === true && res.replanReason.includes('대체 우회로 산출'),
    '재탐색 상태(replanned: true) 및 사유가 명시됨',
    '사용자에게 기존 최단로가 아닌 우회로로 안내됨을 알림'
  );
}

// ----------------------------------------------------------------------------
// TEST 2: 여러 링크 동시 CLOSED (Multiple Links Closed)
// ----------------------------------------------------------------------------
console.log('\n--- Test 2: Multiple Links Concurrently Closed ---');
{
  router.resetAllLinkStates();
  router.setLinkState('NODE_STAIR1_TOP->NODE_STAIR1_BOT', LINK_STATE.CLOSED);
  router.setLinkState('NODE_STAIR2_TOP->NODE_STAIR2_BOT', LINK_STATE.CLOSED);
  router.setLinkState('NODE_STAIR3_TOP->NODE_STAIR3_BOT', LINK_STATE.CLOSED);

  const res = router.findOutdoorShortestPath();

  assert(
    res.found === true && res.totalDistanceMeters === 769.1 && res.stairFlightCount === 0,
    '3개 계단 동시 폐쇄 시에도 무단차 우회로(769.1m)로 정상 우회',
    '계단 구간 전체가 마비되어도 독립된 무단차 서비스 도로 지선을 통해 집결지로 연결됨'
  );
}

// ----------------------------------------------------------------------------
// TEST 3: SUSPECTED 신고만 존재 (Unverified Hazard Report Penalty)
// ----------------------------------------------------------------------------
console.log('\n--- Test 3: SUSPECTED Hazard Report Penalty ---');
{
  router.resetAllLinkStates();
  // 계단 1구간에 미확인 위험(SUSPECTED) 신고 접수
  router.setLinkState('NODE_STAIR1_TOP->NODE_STAIR1_BOT', LINK_STATE.SUSPECTED, {
    source: DATA_PROVENANCE_SOURCE.USER_FIELD_REPORT,
    detail: '계단 부근 연기 냄새 의심 제보'
  });

  const res = router.findOutdoorShortestPath();

  assert(
    res.totalDistanceMeters === 769.1 && res.isStepFree === true,
    'SUSPECTED 링크의 비용 페널티(5.0x)로 인해 깨끗한 우회로(769.1m)로 능동 회피',
    '미확인 제보라도 안전한 대안 도로가 있는 경우 위험 구간을 선제적으로 우회하도록 유도함'
  );
}

// ----------------------------------------------------------------------------
// TEST 4: 서로 다른 출처의 상충 신고 (Conflicting Reports: Official vs Citizen)
// ----------------------------------------------------------------------------
console.log('\n--- Test 4: Conflicting Reports (Official vs Citizen) ---');
{
  router.resetAllLinkStates();
  const stair1Edge = 'NODE_STAIR1_TOP->NODE_STAIR1_BOT';

  // 일반 시민: 통행 가능 제보 vs 캠퍼스 방재팀/공식: 계단 폐쇄 공고
  // 방재팀 공식 공고가 입력됨
  router.setLinkState(stair1Edge, LINK_STATE.CLOSED, {
    source: DATA_PROVENANCE_SOURCE.OFFICIAL_DISASTER_INFO,
    verificationStatus: VERIFICATION_STATUS.VERIFIED,
    confidence: 1.0,
    detail: '성동소방서 현장 확인: 계단 1구간 폐쇄'
  });

  const stateRec = router.getLinkState(stair1Edge);
  assert(
    stateRec.state === LINK_STATE.CLOSED && stateRec.verificationStatus === VERIFICATION_STATUS.VERIFIED,
    '공식 방재팀 확인 폐쇄가 최우선으로 등록됨',
    '공식 기관의 현장 확인 폐쇄는 일반 제보보다 높은 신뢰도(1.0)를 유지함'
  );

  const res = router.findOutdoorShortestPath();
  assert(
    res.totalDistanceMeters === 769.1,
    '공식 폐쇄에 따라 우회로(769.1m) 강제 적용',
    '폐쇄된 계단 통행을 원천 차단함'
  );
}

// ----------------------------------------------------------------------------
// TEST 5: 장애물 해제 후 재탐색 (Obstacle Cleared Without Auto-Verification)
// ----------------------------------------------------------------------------
console.log('\n--- Test 5: Obstacle Cleared Without Auto-Verification ---');
{
  router.resetAllLinkStates();
  const stair1Edge = 'NODE_STAIR1_TOP->NODE_STAIR1_BOT';

  // 1. 폐쇄 등록
  router.setLinkState(stair1Edge, LINK_STATE.CLOSED);
  // 2. 비공식 시민 제보로 "장애물 치워짐" 접수
  router.clearLinkState(stair1Edge, false); // verifiedByOfficial = false

  const stateRec = router.getLinkState(stair1Edge);
  assert(
    stateRec.state === LINK_STATE.UNKNOWN,
    '비공식 해제 신고 시 즉각 OPEN으로 맹신하지 않고 UNKNOWN(재확인 대기)으로 유지',
    '현장 안전이 공식 확인되기 전까지 섣불리 완전 개방 상태로 전환하지 않음'
  );

  // 3. 공식 기관의 현장 확인 해제 접수
  router.clearLinkState(stair1Edge, true); // verifiedByOfficial = true
  const clearedState = router.getLinkState(stair1Edge);
  assert(
    clearedState.state === LINK_STATE.OPEN,
    '공식 확인 후 정상 OPEN으로 복원됨',
    '공식 확인에 의해 안전성이 보장된 후에만 정상 복원'
  );
}

// ----------------------------------------------------------------------------
// TEST 6: 대체 경로가 없는 경우 (Fail-Safe: All Routes Severed)
// ----------------------------------------------------------------------------
console.log('\n--- Test 6: Fail-Safe when All Routes are Severed ---');
{
  router.resetAllLinkStates();
  // 최단 계단 구간과 우회로 램프 구간, 공통 진입로 전면 폐쇄
  router.setLinkState('NODE_STAIR1_TOP->NODE_STAIR1_BOT', LINK_STATE.CLOSED);
  router.setLinkState('OSM_NODE_6415394841->NODE_RAMP_MID', LINK_STATE.CLOSED);

  const res = router.findOutdoorShortestPath();

  assert(
    res.found === false,
    '모든 대피로 차단 시 found: false 반환',
    '갈 수 없는 경로를 억지로 가공하여 안내하지 않음'
  );
  assert(
    res.failSafeGuidance.includes('안전 호실에 잔류(Shelter-in-Place)'),
    '경로 부재 시 실내 잔류 방호(Shelter-in-Place) 안전 지침 제시',
    '무리한 탈출로 인한 2차 사고를 방지하고 방어 대기 유도'
  );
}

// ----------------------------------------------------------------------------
// TEST 7: 계단 제약이 있는 사용자 (Mobility Stair Restriction)
// ----------------------------------------------------------------------------
console.log('\n--- Test 7: Mobility Stair Restriction ---');
{
  router.resetAllLinkStates();
  // 장애물 보고가 전혀 없는 평시 상태에서도 이동 제약 조건 적용
  const res = router.findDynamicPath('OSM_NODE_6415394841', 'OSM_NODE_8577408700', {
    mobilityProfile: USER_MOBILITY_PROFILE.WHEELCHAIR_USER
  });

  assert(
    res.isStepFree === true && res.totalStairsDistanceMeters === 0.0 && res.totalDistanceMeters === 769.1,
    '휠체어 프로필: 최단 계단로를 건너뛰고 무단차 우회로(769.1m) 즉각 선택',
    '장애물 유무와 무관하게 사용자 이동 능력에 맞춰 계단을 배제함'
  );
}

// ----------------------------------------------------------------------------
// TEST 8: 휠체어 접근성 정보가 부족한 사용자 (Wheelchair Verification Caveat)
// ----------------------------------------------------------------------------
console.log('\n--- Test 8: Wheelchair Accessibility Caveat ---');
{
  router.resetAllLinkStates();
  const res = router.findDynamicPath('OSM_NODE_6415394841', 'OSM_NODE_8577408700', {
    mobilityProfile: USER_MOBILITY_PROFILE.WHEELCHAIR_USER
  });

  assert(
    res.isWheelchairVerified === false,
    '무단차 경로라도 현장 실측 전에는 isWheelchairVerified = false 유지',
    '지도상 계단 없음(Step-Free)과 현장 휠체어 접근성 검증(F-03/F-05)을 엄격히 구분'
  );
  assert(
    res.hazardAlerts.some(a => a.includes('현장 경사도/단차 실측(F-03/F-05) 전이므로 안전을 보증하지 않습니다')),
    '안전 미보증 경고 문구가 필수 포함됨',
    '사용자에게 과도한 안전 확신을 주지 않도록 과학적 한계 명시'
  );
}

// ----------------------------------------------------------------------------
// TEST 9: 기존 경로의 정보가 오래된 경우 (Stale Link Report)
// ----------------------------------------------------------------------------
console.log('\n--- Test 9: Stale Link Report Handling ---');
{
  router.resetAllLinkStates();
  const stair1Edge = 'NODE_STAIR1_TOP->NODE_STAIR1_BOT';
  
  // 300초 전 오래된 신고
  router.setLinkState(stair1Edge, LINK_STATE.UNKNOWN, {
    observedAt: Date.now() - 300000,
    confidence: 0.8
  });
  // receivedAt 강제 조정
  router.linkStates.get(stair1Edge).receivedAt = Date.now() - 300000;

  const stateRec = router.getLinkState(stair1Edge);
  assert(
    stateRec.isStale === true && stateRec.effectiveConfidence < 0.8,
    '180초 이상 경과된 신고는 isStale = true 및 신뢰도 감쇄(confidence decay) 적용',
    '오래된 현장 제보의 유효성을 점진적으로 감쇄하여 최신 정보와 구분함'
  );
}

// ----------------------------------------------------------------------------
// TEST 10: 이동 중 여진 발생 (Aftershock during Transit via UI Adapter)
// ----------------------------------------------------------------------------
console.log('\n--- Test 10: Aftershock during Transit (UI Adapter) ---');
{
  adapter.updateStationMotion(0.01);
  adapter.setAftershock(true);
  const g = adapter.reassess();

  assert(
    g.canMove === false && g.routeStatus.displayMode === 'HIDDEN',
    '여진 발생 시 이동 차단 및 3D 경로선 자동 숨김(HIDDEN)',
    '이동을 즉시 멈추고 낙하물 방호 자세를 취하도록 화면 경로를 제거'
  );
  adapter.setAftershock(false); // reset
}

// ----------------------------------------------------------------------------
// TEST 11: 경로 갱신 도중 사용자 위치 변경 (User Origin Change to 1F Exit)
// ----------------------------------------------------------------------------
console.log('\n--- Test 11: Dynamic Origin Change (1F Exit) ---');
{
  adapter.updateStationMotion(0.01);
  // 사용자가 3층에서 1층 출구로 도달함
  adapter.setUserLocation({ locationType: 'INDOOR', floor: 1, room: null, certainty: LOCATION_CERTAINTY.FLOOR_ONLY });
  const g = adapter.reassess();

  assert(
    g.replanStatus.isReplanned === true || g.replanStatus.totalDistanceMeters < 700,
    '1층 출구 위치 시 남은 대피 거리(약 650m 수준)로 실시간 재계산됨',
    '실내 3층 수직 이동 거리가 제외되고 1층 출구 기점으로 재산출됨'
  );
}

// ----------------------------------------------------------------------------
// TEST 12: 현장 신고와 공식 통행 제한 정보의 충돌 (Local Report vs Official)
// ----------------------------------------------------------------------------
console.log('\n--- Test 12: Local Report vs Official Directive ---');
{
  adapter.resetRouteObstacles();
  // 공식 재난문자: 실내 대기 지침
  adapter.setOfficialAlert({
    issued: true,
    authority: 'MOIS',
    instructionCode: 'STAY_INDOORS_HOLD',
    instruction: '실내 대기 권고'
  });
  // 1층 출구 장애물 보고
  adapter.reportLinkObstacle('NODE_STAIR1_TOP->NODE_STAIR1_BOT', LINK_STATE.CLOSED, {
    source: DATA_PROVENANCE_SOURCE.OFFICIAL_DISASTER_INFO,
    detail: '소방서 폐쇄 조치'
  });

  const g = adapter.reassess();

  assert(
    g.routeStatus.displayMode === 'STEP_FREE',
    '공식 계단 폐쇄 시 3D 경로 표시가 무단차 우회로(STEP_FREE)로 즉각 변경됨',
    '폐쇄된 계단 통행을 막고 열려 있는 대체 우회로를 렌더링하도록 UI 어댑터 동기화'
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
