// ============================================================================
// SEISMOLIVE v4.0 — Stage 3: P3.1 Field Verification Workflow & Stage R4 Tests
// File: tests/test_stage3_p31_and_single_canvas.js
// Run via: deno run --allow-all tests/test_stage3_p31_and_single_canvas.js
// ============================================================================

import * as THREE from '../js/lib/three.module.js';
import {
  GroundDataManager,
  GROUND_DATA_TYPE,
  GROUND_DATA_PROVENANCE_SOURCE,
  FIELD_SURVEY_CHECKLIST_F01_F06,
  evaluateStatutoryCompliance,
  buildSimulatedDrillSurveyPacket
} from '../js/response/GroundDataContract.js';
import { VERIFICATION_STATUS, MOBILITY_PROFILE } from '../js/response/ResponseDomainTypes.js';
import { ResponseUIAdapter } from '../js/response/ResponseUIAdapter.js';
import { USER_MOBILITY_PROFILE } from '../js/response/PedestrianRoutingEngine.js';
import { ExhibitionModeManager, EXHIBITION_MODES } from '../js/ui/ExhibitionModeManager.js';
import { CAMERA_STAGES } from '../js/response/GlobalLocalCameraTransition.js';

let passed = 0;
let failed = 0;

function assert(condition, message, detail = '') {
  if (condition) {
    passed++;
    console.log(`  [PASS] ${message}`);
    if (detail) console.log(`         -> ${detail}`);
  } else {
    failed++;
    console.error(`  [FAIL] ${message}`);
    if (detail) console.error(`         -> FAIL: ${detail}`);
  }
}

console.log('====================================================================');
console.log('SEISMOLIVE v4.0 — Stage 3: P3.1 Field Audit & Stage R4 Single-Canvas');
console.log('====================================================================\n');

// ----------------------------------------------------------------------------
// 1. P3.1 STATUTORY COMPLIANCE EVALUATOR & CHECKLIST (F-01 ~ F-06)
// ----------------------------------------------------------------------------
console.log('--- 1. P3.1 Statutory Compliance & Checklist Governance ---');
{
  assert(
    FIELD_SURVEY_CHECKLIST_F01_F06.length === 6 &&
    FIELD_SURVEY_CHECKLIST_F01_F06[0].code === 'F-01' &&
    FIELD_SURVEY_CHECKLIST_F01_F06[5].code === 'F-06',
    '1.1: Canonical P3.1 checklist defines all 6 survey items F-01 through F-06'
  );

  const badCompliance = evaluateStatutoryCompliance({
    attributes: {
      clearWidthMeters: 1.05,
      thresholdHeightCm: 2.8,
      rampSlopePercent: 10.5,
      gratingSlotWidthMm: 16.0,
      bollardSpacingMeters: 0.90
    }
  });
  assert(
    badCompliance.compliant === false && badCompliance.violations.length === 5,
    '1.2: evaluateStatutoryCompliance catches all 5 Korean accessibility/egress statutory violations'
  );

  const mgr = new GroundDataManager();
  const baseReg = mgr.registerRecord({
    id: 'REC_F02_NONCOMPLIANT',
    checklistCode: 'F-02',
    dataType: GROUND_DATA_TYPE.EXIT_DOOR_SPECIFICATION,
    targetSpace: { buildingId: 'BLDG_212_ENG1', spaceId: 'BLDG212_F01_EXIT_SE_PORTAL' },
    source: { provenanceType: GROUND_DATA_PROVENANCE_SOURCE.AUTHORIZED_FIELD_SURVEY },
    acquiredAt: '2026-11-16T06:00:00Z',
    status: VERIFICATION_STATUS.PROVISIONAL,
    version: '1.0.0',
    previousVersion: null,
    changes: ['초기 비적합 문턱 측정'],
    attributes: { clearWidthMeters: 1.25, thresholdHeightCm: 3.1 }
  });
  const blockedApprove = mgr.approveRecord('REC_F02_NONCOMPLIANT', {
    approvedByAuthority: '성동소방서 예방과',
    approvalDocumentRef: 'DOC-TEST-01',
    approvedAt: '2026-11-16T06:10:00Z'
  });
  assert(
    baseReg.success && blockedApprove.success === false && !mgr.isOfficiallyVerified('REC_F02_NONCOMPLIANT'),
    '1.3: GroundDataManager blocks official approval when statutory threshold check fails'
  );
}

// ----------------------------------------------------------------------------
// 2. END-TO-END P3.1 INTEGRATION INTO ROUTING & GUIDANCE ADAPTER
// ----------------------------------------------------------------------------
console.log('\n--- 2. End-to-End P3.1 PROVISIONAL -> VERIFIED Promotion ---');
{
  const adapter = new ResponseUIAdapter();
  adapter.updateStationMotion(0.01);
  adapter.setUserLocation({ locationType: 'OUTDOOR' });
  adapter.setMobility(MOBILITY_PROFILE.WHEELCHAIR);

  const initialChecklist = adapter.getFieldChecklistSummary();
  assert(
    initialChecklist.verifiedCount === 0 &&
    initialChecklist.overallStatus === VERIFICATION_STATUS.PROVISIONAL &&
    adapter.lastRouteResult?.isWheelchairVerified === false,
    '2.1: Default system keeps P3.1 checklist PROVISIONAL (0/6) and isWheelchairVerified === false'
  );

  const specs = [
    { code: 'F-01', type: GROUND_DATA_TYPE.ARCHITECTURAL_FLOOR_PLAN, attrs: { clearWidthMeters: 1.24 } },
    { code: 'F-02', type: GROUND_DATA_TYPE.EXIT_DOOR_SPECIFICATION, attrs: { clearWidthMeters: 1.40, thresholdHeightCm: 1.2 } },
    { code: 'F-03', type: GROUND_DATA_TYPE.ACCESSIBILITY_RAMP, attrs: { rampSlopePercent: 6.2 } },
    { code: 'F-04', type: GROUND_DATA_TYPE.PAVEMENT_SURFACE, attrs: { gratingSlotWidthMm: 10.0 } },
    { code: 'F-05', type: GROUND_DATA_TYPE.BOLLARD_CLEARANCE, attrs: { bollardSpacingMeters: 1.35 } },
    { code: 'F-06', type: GROUND_DATA_TYPE.SHELTER_CAPACITY, attrs: { gateOpen: true } }
  ];

  // Register first 3 items as APPROVED -> must remain PARTIALLY_VERIFIED & isWheelchairVerified still false
  for (let i = 0; i < 3; i++) {
    const s = specs[i];
    const id = `SURVEY_${s.code}`;
    adapter.submitFieldSurveyRecord({
      id,
      checklistCode: s.code,
      dataType: s.type,
      targetSpace: { buildingId: 'BLDG_212_ENG1', spaceId: s.code },
      source: { provenanceType: GROUND_DATA_PROVENANCE_SOURCE.AUTHORIZED_FIELD_SURVEY },
      acquiredAt: '2026-11-16T06:15:00Z',
      status: VERIFICATION_STATUS.PROVISIONAL,
      version: '1.0.0',
      previousVersion: null,
      changes: ['현장 실측 등록'],
      attributes: s.attrs
    });
    adapter.approveFieldSurveyRecord(id, {
      approvedByAuthority: '성동구 현장점검관',
      approvalDocumentRef: `SD-2026-${s.code}`,
      approvedAt: '2026-11-16T06:20:00Z'
    });
  }

  const partial = adapter.getFieldChecklistSummary();
  assert(
    partial.verifiedCount === 3 &&
    partial.overallStatus === VERIFICATION_STATUS.PARTIALLY_VERIFIED &&
    adapter.lastRouteResult?.isWheelchairVerified === false,
    '2.2: Partial verification (3/6) yields PARTIALLY_VERIFIED while keeping wheelchair route unverified'
  );

  // Approve remaining 3 items -> 6/6 VERIFIED & outdoor step-free route verified!
  for (let i = 3; i < 6; i++) {
    const s = specs[i];
    const id = `SURVEY_${s.code}`;
    adapter.submitFieldSurveyRecord({
      id,
      checklistCode: s.code,
      dataType: s.type,
      targetSpace: { buildingId: 'BLDG_212_ENG1', spaceId: s.code },
      source: { provenanceType: GROUND_DATA_PROVENANCE_SOURCE.AUTHORIZED_FIELD_SURVEY },
      acquiredAt: '2026-11-16T06:25:00Z',
      status: VERIFICATION_STATUS.PROVISIONAL,
      version: '1.0.0',
      previousVersion: null,
      changes: ['현장 실측 등록'],
      attributes: s.attrs
    });
    adapter.approveFieldSurveyRecord(id, {
      approvedByAuthority: '성동구 현장점검관',
      approvalDocumentRef: `SD-2026-${s.code}`,
      approvedAt: '2026-11-16T06:30:00Z'
    });
  }

  const full = adapter.getFieldChecklistSummary();
  const verifiedOutdoor = adapter.router.findDynamicPath('OSM_NODE_6415394841', 'OSM_NODE_8577408700', {
    mobilityProfile: USER_MOBILITY_PROFILE.WHEELCHAIR_USER
  });
  assert(
    full.verifiedCount === 6 &&
    full.overallStatus === VERIFICATION_STATUS.VERIFIED &&
    full.isIndoorFullyVerified === true &&
    full.isWheelchairRouteFullyVerified === true &&
    verifiedOutdoor.isWheelchairVerified === true,
    '2.3: Completing all 6 compliant official approvals promotes checklist to VERIFIED (6/6) & outdoor wheelchair route verified'
  );

  // 2.4 Template (null measurements) batch ingestion must NEVER approve any item
  adapter.resetFieldChecklist();
  const templatePacket = JSON.parse(Deno.readTextFileSync('assets/data/p3_1_field_survey_template.json'));
  const tplRes = adapter.ingestFieldSurveyPacket(templatePacket, {
    approve: true,
    approvalMetadata: {
      approvedByAuthority: '테스트 점검관',
      approvalDocumentRef: 'DOC-NULL-BLOCK',
      approvedAt: '2026-11-16T06:40:00Z'
    }
  });
  assert(
    tplRes.registeredCount === 6 &&
    tplRes.approvedCount === 0 &&
    adapter.getFieldChecklistSummary().overallStatus === VERIFICATION_STATUS.PROVISIONAL,
    '2.4: p3_1_field_survey_template.json with null attributes registers cleanly but blocks VERIFIED promotion (0/6 approved)'
  );

  // 2.5 Non-compliant grating (16.5mm > 13.0mm) batch drill blocks F-04 and keeps wheelchair unverified
  adapter.resetFieldChecklist();
  const badDrill = buildSimulatedDrillSurveyPacket('NON_COMPLIANT_GRATING');
  const badRes = adapter.ingestFieldSurveyPacket(badDrill, {
    approve: true,
    approvalMetadata: {
      approvedByAuthority: '성동 합동 점검반',
      approvalDocumentRef: 'DOC-DRILL-BAD',
      approvedAt: '2026-11-16T06:45:00Z'
    }
  });
  const badSummary = adapter.getFieldChecklistSummary();
  assert(
    badRes.approvedCount === 5 &&
    badSummary.overallStatus === VERIFICATION_STATUS.PARTIALLY_VERIFIED &&
    badSummary.isWheelchairRouteFullyVerified === false,
    '2.5: Non-compliant 16.5mm grating drill rejects F-04 approval and preserves isWheelchairRouteFullyVerified === false'
  );

  // 2.6 Reset restores PROVISIONAL (0/6)
  adapter.resetFieldChecklist();
  assert(
    adapter.getFieldChecklistSummary().verifiedCount === 0 &&
    adapter.getFieldChecklistSummary().overallStatus === VERIFICATION_STATUS.PROVISIONAL,
    '2.6: resetFieldChecklist cleanly restores baseline PROVISIONAL (0/6) state'
  );
}

// ----------------------------------------------------------------------------
// 3. STAGE R4 SINGLE-CANVAS EXHIBITION MODE MANAGER
// ----------------------------------------------------------------------------
console.log('\n--- 3. Stage R4 Single-Canvas Seamless Mode Switching ---');
{
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(40, 1.77, 0.1, 6000);
  camera.position.set(10, 140, 40);

  const mockGlobe = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial());
  mockGlobe.visible = true;
  scene.add(mockGlobe);

  const mgr = new ExhibitionModeManager({
    scene,
    camera,
    getGlobalSceneObjects: () => [mockGlobe]
  });

  assert(
    mgr.activeMode === EXHIBITION_MODES.GLOBAL_EXHIBITION && mgr.localWorldGroup.visible === false,
    '3.1: ExhibitionModeManager boots in MODE_GLOBAL_EXHIBITION with local group hidden'
  );

  const localDiag = mgr.enterLocalResponseMode(CAMERA_STAGES.REGIONAL_APPROACH);
  assert(
    mgr.isLocalModeActive() === true &&
    mockGlobe.visible === false &&
    localDiag.localWorldVisible === true &&
    localDiag.localDiagnostics?.activeInstanceCount === localDiag.localDiagnostics?.fullCount,
    '3.2: enterLocalResponseMode isolates global globe cleanly and shows 4km metric spatial world'
  );

  mgr.setLocalStage(CAMERA_STAGES.BUILDING_INSPECTION);
  assert(
    mgr.getDiagnostics().localDiagnostics?.xRayEnabled === true,
    '3.3: Single-canvas BUILDING_INSPECTION activates X-Ray context buildings'
  );

  const exitDiag = mgr.exitToGlobalExhibition();
  assert(
    exitDiag.activeMode === EXHIBITION_MODES.GLOBAL_EXHIBITION &&
    mockGlobe.visible === true &&
    exitDiag.localWorldVisible === false &&
    Math.abs(camera.position.y - 140) < 1e-6,
    '3.4: exitToGlobalExhibition restores global globe visibility and original cosmic orbit pose'
  );

  mgr.dispose();
}

// ----------------------------------------------------------------------------
// SUMMARY
// ----------------------------------------------------------------------------
console.log('\n====================================================================');
console.log(`STAGE 3 P3.1 & SINGLE-CANVAS TESTS: ${passed} PASSED | ${failed} FAILED`);
console.log('====================================================================\n');

if (failed > 0) {
  Deno.exit(1);
}
