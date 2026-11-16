// ============================================================================
// SEISMOLIVE v4.0 — Phase P3.0 Ground Data Ingestion Preparation Test Suite
// File: tests/test_p3_0_ground_data_ingestion.js
// Run via: deno run --allow-all tests/test_p3_0_ground_data_ingestion.js
// ============================================================================

import {
  GroundDataManager,
  GROUND_DATA_TYPE,
  GROUND_DATA_PROVENANCE_SOURCE,
  APPROVAL_WORKFLOW_STATUS,
  validateGroundDataContract,
  validateBlueprintAlignment,
  isValidSpatialIdentifier
} from '../js/response/GroundDataContract.js';

import {
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
console.log('SEISMOLIVE v4.0 — Phase P3.0 Ground Data Ingestion Preparation Tests');
console.log('Blueprint Alignment · Spatial IDs · Field Schemas · Dual-Key Approval');
console.log('====================================================================\n');

const gdm = new GroundDataManager();

// ============================================================================
// CATEGORY 1: OFFICIAL FIRE EVACUATION BLUEPRINT & ALIGNMENT SCHEMA
// ============================================================================
console.log('--- Category 1: Blueprint Registration & Spatial Alignment Schema ---');
{
  const validAlignment = {
    scaleMetersPerUnit: 0.02, // 1:50 scale
    rotationZDegrees: -14.5,  // Orient building along true North
    anchorOffsetLocal: [70.16, 9.2, -45.51], // Offset in meters relative to local tangent anchor
    cadReferenceDatum: 'EPSG:5186_KOREA_CENTRAL'
  };

  const alignResult = validateBlueprintAlignment(validAlignment);
  assert(
    alignResult.valid === true,
    '1.1: 도면 축척(scale), 회전각(rotation), 기준점 오프셋(anchorOffset) 검증 통과',
    'CAD 벡터 도면을 로컬 접평면 물리 미터 좌표계로 정사 투영하기 위한 파라미터 확인'
  );

  const invalidAlignment = {
    scaleMetersPerUnit: -0.5, // Negative scale invalid!
    rotationZDegrees: 450.0,  // Out of range!
    anchorOffsetLocal: [10]   // Missing y, z!
  };
  const invalidResult = validateBlueprintAlignment(invalidAlignment);
  assert(
    invalidResult.valid === false && invalidResult.errors.length >= 3,
    '1.2: 비정상 축척, 초과 각도, 차원 누락 시 도면 정합 거부',
    '공간 왜곡을 유발하는 부적격 도면 메타데이터 원천 차단'
  );

  // Full Blueprint Record Registration (Draft Stage)
  const blueprintRecord = {
    id: 'GDC_HY_ENG1_3F_OFFICIAL_BLUEPRINT_2026',
    dataType: GROUND_DATA_TYPE.ARCHITECTURAL_FLOOR_PLAN,
    targetSpace: { buildingId: 'BLDG_212_ENG1', floor: 3, spaceId: 'ZONE_3F_EAST_CORRIDOR' },
    source: {
      organization: 'Hanyang University Facility Planning Division',
      documentRef: 'HY-ENG1-DWG-ARCH-2024-F3-V04',
      provenanceType: GROUND_DATA_PROVENANCE_SOURCE.OFFICIAL_BLUEPRINT
    },
    acquiredAt: '2026-11-11T14:00:00Z',
    verifiedAt: null,
    verifiedBy: null,
    status: VERIFICATION_STATUS.PROVISIONAL,
    version: '1.0.0',
    previousVersion: null,
    changes: ['제1공학관 3층 소방 피난 계획도 원본 DXF/PDF 등록'],
    blueprintAlignment: validAlignment,
    attributes: {
      corridorClearWidthMeters: 2.40,
      fireDoorCount: 2,
      stairLandingClearAreaSqM: 6.8
    }
  };

  const regRes = gdm.registerRecord(blueprintRecord);
  assert(
    regRes.success === true,
    '1.3: 공식 소방 피난도 원본 등록 및 프로비저널 상태 보존',
    '현장 실측 전까지 PROVISIONAL 상태를 엄격히 유지'
  );
}

// ============================================================================
// CATEGORY 2: STANDARDIZED SPATIAL AND PORTAL IDENTIFIERS
// ============================================================================
console.log('\n--- Category 2: Standardized Spatial and Egress Identifiers ---');
{
  assert(
    isValidSpatialIdentifier('BLDG212_F03_ROOM_301') &&
    isValidSpatialIdentifier('BLDG212_F01_EXIT_SE_PORTAL') &&
    isValidSpatialIdentifier('BLDG212_F03_CORRIDOR_E') &&
    isValidSpatialIdentifier('BLDG212_OUTDOOR_SERVICE_JUNCTION'),
    '2.1: 표준 공간/출입구 식별자 구문(BLDG{num}_F{floor}_{type}_{id}) 검증 통과',
    '3층 301호, 1층 남동출구 포털, 동측 복도 표준 명명 규격 부합'
  );

  assert(
    !isValidSpatialIdentifier('room301') &&
    !isValidSpatialIdentifier('1F_exit') &&
    !isValidSpatialIdentifier('TEMP_CORRIDOR'),
    '2.2: 비표준 및 임의 작성된 공간 식별자 구문 거부',
    '시스템 데이터베이스 간의 고유 키 무결성 확보'
  );
}

// ============================================================================
// CATEGORY 3: FIELD MEASUREMENT SCHEMAS (F-01 ~ F-06)
// ============================================================================
console.log('\n--- Category 3: Field Checklist Measurement Schemas (F-01 ~ F-06) ---');
{
  // F-02 Exit Door Specification
  const exitDoorRecord = {
    id: 'GDC_HY_ENG1_1F_EXIT_F02_MEASUREMENT',
    dataType: GROUND_DATA_TYPE.EXIT_DOOR_SPECIFICATION,
    targetSpace: { buildingId: 'BLDG_212_ENG1', floor: 1, spaceId: 'BLDG212_F01_EXIT_SE_PORTAL' },
    source: {
      organization: 'Campus Safety Field Inspection Team',
      documentRef: 'FIELD-SURVEY-2026-F02',
      provenanceType: GROUND_DATA_PROVENANCE_SOURCE.AUTHORIZED_FIELD_SURVEY
    },
    acquiredAt: '2026-11-11T15:30:00Z',
    verifiedAt: null,
    verifiedBy: null,
    status: VERIFICATION_STATUS.PARTIALLY_VERIFIED,
    version: '1.0.0',
    previousVersion: null,
    changes: ['1층 남동 비상출구 유효폭 및 문턱 실측'],
    attributes: {
      clearOpeningWidthMeters: 1.82,
      thresholdHeightCm: 1.8, // <= 2.0cm satisfies standard
      panicHardwarePresent: true,
      magneticReleaseOnPowerLoss: true
    }
  };
  const regDoor = gdm.registerRecord(exitDoorRecord);
  assert(
    regDoor.success === true,
    '3.1: F-02 비상출구 유효폭(1.82m) 및 문턱(1.8cm) 실측 스키마 등록 성공',
    '1층 출구의 물리적 통과 가능성 측정 파라미터 보존'
  );

  // F-03 Accessibility Ramp
  const rampRecord = {
    id: 'GDC_HY_CAMPUS_RAMP_F03_MEASUREMENT',
    dataType: GROUND_DATA_TYPE.ACCESSIBILITY_RAMP,
    targetSpace: { buildingId: 'BLDG_212_ENG1', floor: 1, spaceId: 'BLDG212_F01_OUTDOOR_RAMP' },
    source: {
      organization: 'Campus Safety Field Inspection Team',
      provenanceType: GROUND_DATA_PROVENANCE_SOURCE.AUTHORIZED_FIELD_SURVEY
    },
    acquiredAt: '2026-11-11T15:45:00Z',
    verifiedAt: null,
    verifiedBy: null,
    status: VERIFICATION_STATUS.PARTIALLY_VERIFIED,
    version: '1.0.0',
    previousVersion: null,
    changes: ['무단차 우회 지선 진입 램프 경사도 측정'],
    attributes: {
      curbRampSlopePercent: 5.4, // <= 8.3% (1:12) satisfies standard
      crossSlopePercent: 1.2,
      thresholdHeightCm: 1.5
    }
  };
  const regRamp = gdm.registerRecord(rampRecord);
  assert(
    regRamp.success === true,
    '3.2: F-03 접근 램프 경사도(5.4%) 및 단차(1.5cm) 실측 스키마 등록 성공',
    '휠체어 접근성 검증을 위한 핵심 물리 파라미터 구조화'
  );

  // F-05 Bollard Clearance
  const bollardRecord = {
    id: 'GDC_HY_STADIUM_BOLLARD_F05_MEASUREMENT',
    dataType: GROUND_DATA_TYPE.BOLLARD_CLEARANCE,
    targetSpace: { buildingId: 'BLDG_OUTDOOR_STADIUM', spaceId: 'BLDG_OUTDOOR_BOLLARD_GATE' },
    source: {
      organization: 'Campus Safety Field Inspection Team',
      provenanceType: GROUND_DATA_PROVENANCE_SOURCE.AUTHORIZED_FIELD_SURVEY
    },
    acquiredAt: '2026-11-11T16:00:00Z',
    verifiedAt: null,
    verifiedBy: null,
    status: VERIFICATION_STATUS.PARTIALLY_VERIFIED,
    version: '1.0.0',
    previousVersion: null,
    changes: ['대운동장 진입 차량 진입 억제용 볼라드 간격 실측'],
    attributes: {
      minBollardSpacingMeters: 1.35, // >= 1.20m satisfies standard
      bollardHeightCm: 80.0
    }
  };
  const regBollard = gdm.registerRecord(bollardRecord);
  assert(
    regBollard.success === true,
    '3.3: F-05 대운동장 진입 볼라드 유효 간격(1.35m) 실측 스키마 등록 성공',
    '보행 보조기 및 휠체어 통과 가능 폭 검증 규격 확보'
  );
}

// ============================================================================
// CATEGORY 4: DUAL-KEY SEPARATION: AUTOMATION VS HUMAN OFFICIAL APPROVAL
// ============================================================================
console.log('\n--- Category 4: Separation of Automation vs Human Official Approval ---');
{
  const targetId = 'GDC_HY_CAMPUS_RAMP_F03_MEASUREMENT';

  // Attempting to elevate without human authority approval
  assert(
    gdm.isOfficiallyVerified(targetId) === false,
    '4.1: 자동 구문 검증 완료 상태에서도 isOfficiallyVerified = false 유지',
    '기계적 형식 검증만으로는 결코 최종 VERIFIED로 승격되지 않음'
  );

  // Human Authority Sign-off
  const approvalRes = gdm.approveRecord(targetId, {
    approvedByAuthority: '성동소방서 예방과 공인 소방점검관 #07',
    approvalDocumentRef: 'SD-FIRE-INSPECT-2026-11-042',
    approvedAt: '2026-11-11T17:00:00Z',
    notes: '현장 휠체어 주행 및 경사도 5.4% 실측 공인 완료'
  });

  assert(
    approvalRes.success === true,
    '4.2: 공인 소방 점검관의 전자 서명 및 문서 참조 첨부 시 정식 승인 완료',
    '적격 검증 주체에 의한 공식 확인'
  );

  assert(
    gdm.isOfficiallyVerified(targetId) === true,
    '4.3: 공인 승인 완료 후에만 isOfficiallyVerified = true 활성화',
    '인간 책임자의 법적·기술적 승인과 시스템 데이터 상태의 엄격한 일치'
  );

  // Rejection handling test
  const rejectedRecord = {
    id: 'GDC_HY_DEFICIENT_RAMP_TEST',
    dataType: GROUND_DATA_TYPE.ACCESSIBILITY_RAMP,
    targetSpace: { buildingId: 'BLDG_212_ENG1', floor: 1 },
    source: {
      organization: 'Field Survey Team',
      provenanceType: GROUND_DATA_PROVENANCE_SOURCE.AUTHORIZED_FIELD_SURVEY
    },
    acquiredAt: '2026-11-11T16:30:00Z',
    verifiedAt: null,
    verifiedBy: null,
    status: VERIFICATION_STATUS.PARTIALLY_VERIFIED,
    version: '1.0.0',
    previousVersion: null,
    changes: ['단차 5cm 초과 경사로 측정']
  };
  gdm.registerRecord(rejectedRecord);

  gdm.rejectRecord('GDC_HY_DEFICIENT_RAMP_TEST', {
    rejectedBy: '성동소방서 점검관 #07',
    reason: '문턱 단차 5.2cm로 장애인등편의법 기준(2.0cm 이하) 초과 불합격',
    rejectedAt: '2026-11-11T17:15:00Z'
  });

  const rejectedData = gdm.getRecord('GDC_HY_DEFICIENT_RAMP_TEST');
  assert(
    rejectedData.status === VERIFICATION_STATUS.REJECTED &&
    rejectedData.approvalWorkflow.status === APPROVAL_WORKFLOW_STATUS.REJECTED,
    '4.4: 기준 미달 현장 데이터에 대한 공식 거부(REJECTED) 및 결함 사유 보존',
    '안전 기준을 충족하지 못한 경로 요소를 공식 차단'
  );
}

// ============================================================================
// CATEGORY 5: VERSION PROGRESSION & AUDIT TRAIL DIFFING
// ============================================================================
console.log('\n--- Category 5: Version Progression & Audit Trail Diffing ---');
{
  const diff = gdm.getDiff('GDC_HY_CAMPUS_RAMP_F03_MEASUREMENT');
  assert(
    diff !== null &&
    diff.fromVersion === '1.0.0' &&
    diff.toVersion === '1.1.0' &&
    diff.statusTransition.includes('VERIFIED'),
    '5.1: 도면/실측 데이터 버전 간 변경 내역 및 상태 전이 이력 정상 추적',
    '감사 추적성(Audit Trail) 및 데이터 변경 이력 완벽 보존'
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
