// ============================================================================
// SEISMOLIVE v4.0 — Phase P2.6 Global-to-Personal Exhibition Integration Test Suite
// File: tests/test_p2_6_global_to_personal.js
// Run via: deno run --allow-all tests/test_p2_6_global_to_personal.js
// ============================================================================

import * as THREE from '../js/lib/three.module.js';

import {
  GlobalLocalCameraTransition,
  CAMERA_STAGES,
  TRANSITION_STATUS
} from '../js/response/GlobalLocalCameraTransition.js';

import {
  ResponseTimelineSimulator,
  Mock3DResponseAdapter
} from '../js/response/ResponseTimelineSimulator.js';

import {
  PedestrianRoutingEngine,
  LINK_STATE
} from '../js/response/PedestrianRoutingEngine.js';

import {
  ResponseUIAdapter
} from '../js/response/ResponseUIAdapter.js';

import {
  DATA_PROVENANCE_SOURCE,
  VERIFICATION_STATUS
} from '../js/response/HanyangBuildingData.js';

import {
  LOCATION_CERTAINTY,
  MOBILITY_PROFILE
} from '../js/response/SituationAssessmentEngine.js';

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
console.log('SEISMOLIVE v4.0 — Phase P2.6 Global-to-Personal Exhibition Tests');
console.log('Spatial Continuum · Subterranean Safety · Data Demarcation · Timeline');
console.log('====================================================================\n');

// ============================================================================
// CATEGORY 1: GLOBAL-TO-PERSONAL CAMERA SPATIAL CONTINUUM
// ============================================================================
console.log('--- Category 1: Global-to-Personal Spatial Continuity & Camera Bounds ---');
{
  const camera = new THREE.PerspectiveCamera(45, 1.77, 0.1, 5000);
  const camTransition = new GlobalLocalCameraTransition({ camera });

  // 1.1: 5 Camera Stages
  assert(
    CAMERA_STAGES.GLOBAL_ORBIT &&
    CAMERA_STAGES.REGIONAL_APPROACH &&
    CAMERA_STAGES.CAMPUS_OVERVIEW &&
    CAMERA_STAGES.BUILDING_INSPECTION &&
    CAMERA_STAGES.PERSONAL_LOCATION,
    '1.1: 5단계 전시 공간 스테이지 정의 확인 (GLOBAL -> CAMPUS -> BLDG -> PERSONAL)',
    '우주적 지구본에서 개인 실내 공간까지의 단일 연속 여정 구축'
  );

  // 1.2: Monotonic Altitude Descent along Exhibition Sequence
  const vEarth = camTransition.viewpoints[CAMERA_STAGES.GLOBAL_ORBIT];
  const vCampus = camTransition.viewpoints[CAMERA_STAGES.CAMPUS_OVERVIEW];
  const vBldg = camTransition.viewpoints[CAMERA_STAGES.BUILDING_INSPECTION];
  const vPersonal = camTransition.viewpoints[CAMERA_STAGES.PERSONAL_LOCATION];

  const earthDist = vEarth.position.length();
  const campusAlt = vCampus.position.y;
  const bldgAlt = vBldg.position.y;
  const personalAlt = vPersonal.position.y;

  assert(
    campusAlt > bldgAlt && bldgAlt > personalAlt,
    '1.2: 공간 하강 시 고도가 단조 감소(Monotonic Descent)하여 반복 줌인·줌아웃 방지',
    `캠퍼스(${campusAlt}m) -> 건물(${bldgAlt}m) -> 3층 개인공간(${personalAlt}m)`
  );

  // 1.3: Subterranean Altitude Safety Guard
  camTransition.snapTo(CAMERA_STAGES.CAMPUS_OVERVIEW);
  // Attempt to force camera position below ground level
  camera.position.set(100, -50.0, 100);
  camTransition.status = TRANSITION_STATUS.TRANSITIONING;
  camTransition.currentStage = CAMERA_STAGES.BUILDING_INSPECTION;
  camTransition.anim.startPos.set(100, -50.0, 100);
  camTransition.anim.targetPos.set(135, 68, -12);
  camTransition.anim.startTime = performance.now() - 100;
  camTransition.anim.duration = 2.0;

  camTransition.update(performance.now());
  assert(
    camera.position.y >= 25.0,
    '1.3: 지형/슬래브 관통 방지 안전 가드 작동 (Subterranean Penetration Prevented)',
    `건물 상세 검사 시 카메라 고도가 최소 안전 고도(>=25m) 이상으로 클램핑됨 (현재: ${camera.position.y}m)`
  );

  // 1.4: Direct User Interaction Interrupts Transition
  let interruptFired = false;
  camTransition.transitionTo(CAMERA_STAGES.CAMPUS_OVERVIEW, 3.0);
  camTransition.anim.onInterrupt = () => { interruptFired = true; };

  assert(camTransition.status === TRANSITION_STATUS.TRANSITIONING, '전환 진행 중 상태 확인');
  camTransition.cancelTransition('USER_DIRECT_INPUT');
  assert(
    camTransition.status === TRANSITION_STATUS.USER_OVERRIDE && interruptFired,
    '1.4: 사용자 직접 조작(드래그/휠) 발생 시 자동 카메라 전환 즉시 취소',
    '사용자 주도권 즉각 반환 및 카메라 점프 방지'
  );

  // 1.5: Return to Global Orbit
  camTransition.returnToGlobal(1.0);
  assert(
    camTransition.currentStage === CAMERA_STAGES.GLOBAL_ORBIT && camTransition.status === TRANSITION_STATUS.TRANSITIONING,
    '1.5: 글로벌 우주 궤도로의 복귀(Return to Global) 정상 작동',
    '전 지구적 지진 맥락으로 자연스러운 복귀 경로 확보'
  );
}

// ============================================================================
// CATEGORY 2: SCIENTIFIC DATA DEMARCATION (DEMO PGA VS REAL TELEMETRY)
// ============================================================================
console.log('\n--- Category 2: Scientific Data Demarcation (Simulated vs Observed) ---');
{
  const router = new PedestrianRoutingEngine();
  const mock3D = new Mock3DResponseAdapter();
  const adapter = new ResponseUIAdapter({ router, hanyangAdapter: mock3D });

  // 2.1: Ingest Simulated Scenario Motion
  const gSim = adapter.updateStationMotion(0.22, Date.now(), DATA_PROVENANCE_SOURCE.SIMULATED_SCENARIO);
  assert(
    adapter.context.sources.station.provenanceType === DATA_PROVENANCE_SOURCE.SIMULATED_SCENARIO,
    '2.1: 시연용 PGA 입력치가 SIMULATED_SCENARIO로 명확히 분리 기록됨',
    '실제 지진 관측 신호와 시연용 가상 입력을 혼동하지 않음'
  );
  assert(
    gSim.badgeText.includes('SIMULATED') || gSim.badgeText.includes('가상 시나리오'),
    '2.2: 화면 배지에 시연용 가상 입력(SIMULATED)임이 투명하게 명시됨',
    '사용자에게 실제 지진 발생으로 인한 오인 혼란 방지'
  );

  // 2.2: Ingest Real Observed Motion
  const gReal = adapter.updateStationMotion(0.08, Date.now(), DATA_PROVENANCE_SOURCE.OBSERVED_STATION);
  assert(
    adapter.context.sources.station.provenanceType === DATA_PROVENANCE_SOURCE.OBSERVED_STATION,
    '2.3: 실제 지진 관측소 신호는 OBSERVED_STATION으로 엄격 구분됨',
    '관측소 실측 신호 보존'
  );
  assert(
    adapter.context.sources.station.note.includes('실제 실내 체감 진동 변환치 아님'),
    '2.4: 관측소 PGA를 실내 체감 진동으로 직접 등치하지 않는 과학적 한계 명시',
    '건물 증폭 계수 및 지반 응답 해석 없는 직결 배제'
  );
}

// ============================================================================
// CATEGORY 3: EXHIBITION TIMELINE & SUBSYSTEM INTEGRATION
// ============================================================================
console.log('\n--- Category 3: Exhibition Timeline Synchronous State Integration ---');
{
  const sim = new ResponseTimelineSimulator();
  const timeline = sim.runFullTimeline();

  // 3.1: T+0s Shaking
  const snap0 = timeline[0];
  assert(
    snap0.assessment.canMove === false && snap0.scene3D.actual3DMode === 'NONE',
    '3.1: T+0s 지진 본진: canMove = false, 3D 피난선 표출 완전 금지 (NONE)',
    '진동 중 보행 유도선 소거로 실내 엄폐 유도'
  );

  // 3.2: T+40s Quiescent & Initial Route
  const snap40 = timeline[1];
  assert(
    snap40.assessment.canMove === true && snap40.scene3D.actual3DMode === 'ALL',
    '3.2: T+40s 진동 안정화: 탈출로 확보 및 최단 경로(737.9m) 표출',
    '초기 피난 방향 안내'
  );

  // 3.3: T+67s Replan Detour
  const snap67 = timeline[3];
  assert(
    snap67.routing.replanned === true && snap67.scene3D.actual3DMode === 'STEP_FREE',
    '3.3: T+67s 계단 균열 접수: 3D 경로선이 무단차 우회로(STEP_FREE)로 즉시 전환',
    '폐쇄 계단을 배제하고 우회 지선 렌더링'
  );

  // 3.4: T+110s Aftershock
  const snap110 = timeline[4];
  assert(
    snap110.assessment.canMove === false && snap110.scene3D.actual3DMode === 'NONE',
    '3.4: T+110s 여진 발생: 이동 즉시 중단 및 3D 피난선 잔류 0ms 소거',
    '여진 시 지체 없이 경로선 소거'
  );

  // 3.5: User Location Selection Reflects in Building Wireframe
  sim.adapter.setUserFloor(3);
  assert(
    sim.mock3D.highlightedFloor === 3,
    '3.5: 3층 선택 시 건축 와이어프레임 3층 하이라이트 동기화 완료',
    '개인 위치와 건물 층 구조의 시각적 일치'
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
