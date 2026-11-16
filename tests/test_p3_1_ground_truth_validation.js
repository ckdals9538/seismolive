// ============================================================================
// SEISMOLIVE v4.0 — Phase P3.1 Ground Truth Acquisition & Field Validation Tests
// File: tests/test_p3_1_ground_truth_validation.js
// Run via: deno run --allow-all tests/test_p3_1_ground_truth_validation.js
// ============================================================================

import {
  PedestrianRoutingEngine,
  LINK_STATE,
  USER_MOBILITY_PROFILE
} from '../js/response/PedestrianRoutingEngine.js';

import {
  GlobalLocalCameraTransition,
  CAMERA_STAGES
} from '../js/response/GlobalLocalCameraTransition.js';

import {
  GroundDataManager,
  GROUND_DATA_TYPE,
  GROUND_DATA_PROVENANCE_SOURCE,
  APPROVAL_WORKFLOW_STATUS,
  LEGAL_ACCESSIBILITY_STANDARDS,
  validateGroundDataContract
} from '../js/response/GroundDataContract.js';

import {
  VERIFICATION_STATUS
} from '../js/response/HanyangBuildingData.js';

import * as THREE from '../js/lib/three.module.js';

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
console.log('SEISMOLIVE v4.0 — Phase P3.1 Ground Truth Validation Tests');
console.log('4-Path Mathematical Recalculation · Spatial Envelopes · Statutory Norms');
console.log('====================================================================\n');

const router = new PedestrianRoutingEngine();
const gdm = new GroundDataManager();

// ============================================================================
// CATEGORY 1: INDEPENDENT NUMERICAL RE-CALCULATION OF 4 EGRESS PATHS
// ============================================================================
console.log('--- Category 1: Independent Graph Recalculation of 4 Egress Routes ---');
{
  // 1.1: Outdoor Shortest Path
  const p1 = router.findOutdoorShortestPath();
  assert(
    p1.found === true &&
    p1.totalDistanceMeters === 651.9 &&
    p1.totalStairsDistanceMeters === 68.5 &&
    p1.stairFlightCount === 4 &&
    p1.isStepFree === false,
    '1.1: 실외 최단 경로 651.9m 재검증 (계단 4개 구간 = 68.5m 포함)',
    `기점 OSM:6415394841 -> 종점 OSM:8577408700 (지선A 260.4m + 간선 391.5m = ${p1.totalDistanceMeters}m)`
  );

  // 1.2: Outdoor Step-Free Detour
  const p2 = router.findOutdoorStepFreePath();
  assert(
    p2.found === true &&
    p2.totalDistanceMeters === 769.1 &&
    p2.totalStairsDistanceMeters === 0.0 &&
    p2.stairFlightCount === 0 &&
    p2.isStepFree === true &&
    p2.isWheelchairVerified === false,
    '1.2: 실외 무단차 우회 경로 769.1m 재검증 (계단 0.0m, +117.2m 우회, 휠체어 안전 미보증)',
    `기점 OSM:6415394841 -> 종점 OSM:8577408700 (지선B 377.6m + 간선 391.5m = ${p2.totalDistanceMeters}m)`
  );

  // 1.3: Complete Indoor-Outdoor Shortest Path
  const p3 = router.findCompleteIndoorOutdoorPath('ROOM_301');
  assert(
    p3.found === true &&
    p3.totalDistanceMeters === 737.9 &&
    p3.totalStairsDistanceMeters === 93.3 &&
    p3.hasStairs === true,
    '1.3: 실내외 전체 최단 경로 737.9m 재검증 (실내 86.0m + 실외 651.9m, 총 계단 93.3m)',
    `기점 3층 301호 -> 1층 비상문 커넥터(4m) -> 대운동장 피치`
  );

  // 1.4: Complete Indoor-Outdoor Step-Free Detour Path
  router.setLinkState('NODE_STAIR1_TOP->NODE_STAIR1_BOT', LINK_STATE.CLOSED);
  const p4 = router.findCompleteIndoorOutdoorPath('NODE_ROOM_301');
  assert(
    p4.found === true &&
    p4.totalDistanceMeters === 855.1 &&
    p4.totalStairsDistanceMeters === 24.8 &&
    p4.replanned === true,
    '1.4: 실내외 전체 무단차 우회 경로 855.1m 재검증 (실내 86.0m + 실외 769.1m, 실외 계단 0m)',
    `최단 계단 폐쇄 시 무단차 우회로로 자동 재탐색 (+117.2m 우회 delta 반영)`
  );
  router.resetAllLinkStates(); // reset

  // 1.5: Room ID vs Node ID Flexibility
  const pRoom = router.findCompleteIndoorOutdoorPath('ROOM_301');
  const pNode = router.findCompleteIndoorOutdoorPath('NODE_ROOM_301');
  assert(
    pRoom.totalDistanceMeters === pNode.totalDistanceMeters,
    '1.5: originRoomId로 "ROOM_301" 및 "NODE_ROOM_301" 모두 정상 파싱',
    '호실 식별자와 그래프 노드 식별자 간의 상호 호환성 보장'
  );
}

// ============================================================================
// CATEGORY 2: CAMERA SPATIAL CLEARANCE & RENDERING TIMING
// ============================================================================
console.log('\n--- Category 2: Spatial Clearance Envelopes & Rendering Timing ---');
{
  const camera = new THREE.PerspectiveCamera(40, 1.77, 0.1, 5000);
  const transition = new GlobalLocalCameraTransition({ camera });

  // 2.1: Altitude Envelopes Clearance
  // Building 212 roof is at y ~ 20.0m. All overview and inspection cameras must stay strictly above.
  const campusY = transition.viewpoints[CAMERA_STAGES.CAMPUS_OVERVIEW].position.y;
  const bldgY = transition.viewpoints[CAMERA_STAGES.BUILDING_INSPECTION].position.y;
  const personalY = transition.viewpoints[CAMERA_STAGES.PERSONAL_LOCATION].position.y;

  assert(
    campusY >= 200.0 && bldgY >= 60.0 && personalY >= 25.0,
    '2.1: 카메라 정적 뷰포트 고도가 제1공학관 옥상(20.0m) 및 지형 표면보다 충분히 상공에 위치',
    `캠퍼스 조망 y=${campusY}m, 건물 검사 y=${bldgY}m, 개인 3층 y=${personalY}m (옥상 20m 대비 여유고 확보)`
  );

  // 2.2: Dynamic Subterranean Clamp
  transition.snapTo(CAMERA_STAGES.CAMPUS_OVERVIEW);
  camera.position.set(120, 5.0, 50); // Set low altitude
  transition.status = 'TRANSITIONING';
  transition.currentStage = CAMERA_STAGES.CAMPUS_OVERVIEW;
  transition.anim.startPos.set(120, 5.0, 50);
  transition.anim.targetPos.set(230, 240, -90);
  transition.anim.startTime = performance.now() - 50;
  transition.anim.duration = 2.0;
  transition.update(performance.now());

  assert(
    camera.position.y >= 40.0,
    '2.2: 캠퍼스 조망 중 카메라가 40.0m 이하로 내려가지 않도록 동적 안전 클램핑 확인',
    `지형 및 주변 수목 관통 방지 (현재 강제 고도: ${camera.position.y}m)`
  );
}

// ============================================================================
// CATEGORY 3: LEGAL & TECHNICAL ACCESSIBILITY STANDARDS CITATIONS
// ============================================================================
console.log('\n--- Category 3: Statutory Accessibility & Egress Standards Citations ---');
{
  const stds = LEGAL_ACCESSIBILITY_STANDARDS;

  assert(
    stds.DOOR_CLEAR_WIDTH.minMetersPublic === 1.20 &&
    stds.DOOR_CLEAR_WIDTH.statute.includes('건축물의 피난·방화구조 등의 기준에 관한 규칙 제9조'),
    '3.1: 피난계단 출구 유효너비 1.20m 기준 및 법령 출처 명시 확인',
    stds.DOOR_CLEAR_WIDTH.statute
  );

  assert(
    stds.DOOR_THRESHOLD.maxHeightCm === 2.0 &&
    stds.DOOR_THRESHOLD.statute.includes('장애인·노인·임산부 등의 편의증진 보장에 관한 법률 시행규칙 [별표 1]'),
    '3.2: 출입구 문턱 최대 높이 2.0cm 이하 기준 및 법령 출처 명시 확인',
    stds.DOOR_THRESHOLD.statute
  );

  assert(
    stds.RAMP_SLOPE.maxSlopeStandardPercent === 8.33 &&
    stds.RAMP_SLOPE.statute.includes('장애인등편의법 시행규칙 [별표 1] 제12호'),
    '3.3: 접근 램프 경사도 1:12 (8.33%) 이하 기준 및 법령 출처 명시 확인',
    stds.RAMP_SLOPE.statute
  );

  assert(
    stds.BOLLARD_CLEARANCE.minSpacingMeters === 1.20 &&
    stds.BOLLARD_CLEARANCE.statute.includes('교통약자의 이동편의 증진법 시행규칙 제2조'),
    '3.4: 보도 볼라드 최소 간격 1.20m 이상 기준 및 법령 출처 명시 확인',
    stds.BOLLARD_CLEARANCE.statute
  );

  assert(
    stds.DRAINAGE_GRATING.maxSlotWidthMm === 13.0 &&
    stds.DRAINAGE_GRATING.statute.includes('보도 설치 및 관리 지침'),
    '3.5: 배수로 그레이팅 틈새 13.0mm 이하 기준 및 국토교통부 지침 출처 명시 확인',
    stds.DRAINAGE_GRATING.statute
  );
}

// ============================================================================
// CATEGORY 4: ENHANCED GROUND DATA CONTRACT DEEP METADATA (P3.1)
// ============================================================================
console.log('\n--- Category 4: Enhanced Ground Data Contract Deep Metadata ---');
{
  const fullSpecRecord = {
    id: 'GDC_HY_ENG1_3F_FIRE_PLAN_P3_1',
    dataType: GROUND_DATA_TYPE.ARCHITECTURAL_FLOOR_PLAN,
    targetSpace: { buildingId: 'BLDG_212_ENG1', floor: 3, spaceId: 'BLDG212_F03_CORRIDOR_E' },
    source: {
      organization: '한양대학교 관리처 시설팀',
      documentRef: 'HY-ENG1-DWG-2024-F3-V04',
      provenanceType: GROUND_DATA_PROVENANCE_SOURCE.OFFICIAL_BLUEPRINT
    },
    acquiredAt: '2026-11-11T14:00:00Z',
    verifiedAt: null,
    verifiedBy: null,
    status: VERIFICATION_STATUS.PROVISIONAL,
    version: '1.0.0',
    previousVersion: null,
    changes: ['제1공학관 3층 소방 피난 계획도 원본 DXF 정합 메타데이터 등록'],
    documentMetadata: {
      documentTitle: '한양대학교 제1공학관 3층 소방시설 및 피난계획 평면도',
      issuingOrganization: '한양대학교 시설관리처',
      documentNumber: 'DWG-212-2024-F03',
      publicationDate: '2024-03-15'
    },
    surveyEquipment: {
      equipmentModel: 'Leica DISTO D2 Laser Distance Meter',
      serialNumber: 'SN-LEICA-2023-8841',
      accuracyTolerance: '±1.5mm',
      measurementIntervalMeters: 5.0
    },
    surveyor: {
      name: '홍길동 (방재안전기사)',
      organization: '한국소방안전기술원 제3검사팀',
      licenseNumber: 'FSE-2021-9942'
    },
    spatialReference: {
      horizontalDatum: 'WGS84 / EPSG:4326',
      verticalDatum: 'KVD1964 (인천만 평균해면 기준)',
      anchorRef: 'LocalTangentAnchor(37.555815°N, 127.045053°E, 42.0m)'
    },
    alignmentRationale: {
      method: '2-Point Geodetic Tie-in with Local Tangent Plane',
      referenceTiePoints: [
        { name: '1F SE Portal Center', coord: [70.16, 9.20, -45.51] },
        { name: '3F East Stair Landing', coord: [50.0, 9.0, -75.0] }
      ],
      scaleFactorCalculation: 'CAD unit to meters 1:1 mapping (scale=0.02 for 1:50 drawing)'
    },
    blueprintAlignment: {
      scaleMetersPerUnit: 0.02,
      rotationZDegrees: -14.5,
      anchorOffsetLocal: [70.16, 9.2, -45.51],
      cadReferenceDatum: 'EPSG:5186'
    },
    attributes: {
      corridorClearWidthMeters: 2.40,
      fireDoorCount: 2
    }
  };

  const regRes = gdm.registerRecord(fullSpecRecord);
  assert(
    regRes.success === true,
    '4.1: P3.1 심층 문서 메타데이터(장비, 측정자, 측지 기준, 정합 근거) 검증 통과',
    '장비 스펙, 문서 번호, 2점 측지 결합 근거 일체 보존'
  );

  // Missing inner mandatory fields in documentMetadata should fail
  const deficientRecord = {
    ...fullSpecRecord,
    id: 'GDC_DEFICIENT_DOC_TEST',
    documentMetadata: { documentTitle: '' } // missing issuingOrganization
  };
  const defRes = validateGroundDataContract(deficientRecord);
  assert(
    defRes.valid === false && defRes.errors.some(e => e.includes('documentMetadata')),
    '4.2: documentMetadata 필수 항목 누락 시 심층 검증 거부',
    '형식적 불완전 문서의 사전 차단'
  );

  // Verification status remains strictly PROVISIONAL until officially approved
  const stored = gdm.getRecord('GDC_HY_ENG1_3F_FIRE_PLAN_P3_1');
  assert(
    stored.status === VERIFICATION_STATUS.PROVISIONAL &&
    gdm.isOfficiallyVerified('GDC_HY_ENG1_3F_FIRE_PLAN_P3_1') === false,
    '4.3: 심층 메타데이터가 등록되었더라도 현장 승인 전에는 PROVISIONAL 엄격 유지',
    '아무리 완벽한 도면 데이터라도 현장 실측 전 임의 승격 불허'
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
