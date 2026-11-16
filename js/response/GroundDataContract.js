// ============================================================================
// SEISMOLIVE v4.0 — Ground Data Input Contract Schema & Governance (P2.5 & P3.0)
// Module: js/response/GroundDataContract.js
// Scientific standards: Demarcates real on-site measurements from provisional assumptions.
// Mandates:
//   1. Never elevates PROVISIONAL data to VERIFIED without verifiedBy, verifiedAt,
//      and official/authorized field survey provenance.
//   2. Strict separation of automated syntax validation from human official authority approval.
//   3. Mathematical alignment schema (scale, rotation, local anchor offset) for CAD/blueprints.
// ============================================================================

import {
  DATA_PROVENANCE_SOURCE,
  VERIFICATION_STATUS
} from './ResponseDomainTypes.js';

/**
 * Statutory and Technical Legal Standards for Evacuation & Accessibility (P3.1 Foundation)
 */
export const LEGAL_ACCESSIBILITY_STANDARDS = Object.freeze({
  DOOR_CLEAR_WIDTH: {
    minMetersPublic: 1.20,
    minMetersStandard: 0.90,
    statute: '건축물의 피난·방화구조 등의 기준에 관한 규칙 제9조 (피난계단의 구조)',
    clause: '건축물 각 층의 계단실 출입구 유효너비는 1.2미터 이상으로 하여야 한다.'
  },
  DOOR_THRESHOLD: {
    maxHeightCm: 2.0,
    optimalHeightCm: 1.5,
    statute: '장애인·노인·임산부 등의 편의증진 보장에 관한 법률 시행규칙 [별표 1] 제1호 (출입구)',
    clause: '출입구의 바닥면에는 턱을 두어서는 아니 된다. 다만, 턱을 설치할 수밖에 없는 경우에는 그 높이를 2센티미터 이하로 하여야 한다.'
  },
  RAMP_SLOPE: {
    maxSlopeStandardPercent: 8.33, // 1:12
    maxSlopeOptimalPercent: 5.56,  // 1:18
    statute: '장애인등편의법 시행규칙 [별표 1] 제12호 (경사로)',
    clause: '경사로의 기울기는 12분의 1 이하로 하여야 한다. 다만, 높이 1미터 이하인 경우에는 8분의 1까지 완화할 수 있다.'
  },
  BOLLARD_CLEARANCE: {
    minSpacingMeters: 1.20,
    maxHeightCm: 80.0,
    statute: '교통약자의 이동편의 증진법 시행규칙 제2조 [별표 1] 제1호 (보도 볼라드)',
    clause: '보행우선구역 및 보도의 볼라드 간격은 1.2미터 이상으로 하여 휠체어의 통행을 방해하지 아니하여야 한다.'
  },
  DRAINAGE_GRATING: {
    maxSlotWidthMm: 13.0,
    statute: '보도 설치 및 관리 지침 (국토교통부 예규)',
    clause: '배수구 덮개(그레이팅)의 틈새는 13밀리미터 이하로 하여 휠체어 바퀴나 지팡이가 끼이지 아니하여야 한다.'
  }
});

/**
 * Standard Ground Data Provenance Sources
 */
export const GROUND_DATA_PROVENANCE_SOURCE = Object.freeze({
  OFFICIAL_BLUEPRINT:        'OFFICIAL_BLUEPRINT',
  OFFICIAL_FIRE_DEPARTMENT: 'OFFICIAL_FIRE_DEPARTMENT',
  AUTHORIZED_FIELD_SURVEY:   'AUTHORIZED_FIELD_SURVEY',
  OFFICIAL_DISASTER_INFO:    'OFFICIAL_DISASTER_INFO',
  USER_FIELD_REPORT:         'USER_FIELD_REPORT',
  ESTIMATED_PROVISIONAL:     'ESTIMATED_PROVISIONAL'
});

/**
 * Standard Ground Data Types corresponding to Field Checklists F-01 through F-06
 */
export const GROUND_DATA_TYPE = Object.freeze({
  ARCHITECTURAL_FLOOR_PLAN: 'ARCHITECTURAL_FLOOR_PLAN', // F-01: 3F evacuation plan, corridor width, fire doors
  EXIT_DOOR_SPECIFICATION:  'EXIT_DOOR_SPECIFICATION',  // F-02: 1F SE exit clear width, swing, hardware
  ACCESSIBILITY_RAMP:       'ACCESSIBILITY_RAMP',       // F-03: Threshold height (<=2cm), curb ramp slope
  PAVEMENT_SURFACE:         'PAVEMENT_SURFACE',         // F-04: Campus asphalt/paver, drainage grating clearance
  BOLLARD_CLEARANCE:        'BOLLARD_CLEARANCE',        // F-05: Vehicle bollard spacing (>=1.2m)
  SHELTER_CAPACITY:         'SHELTER_CAPACITY'          // F-06: Main Stadium perimeter gate & open status
});

/**
 * Canonical P3.1 Field Verification Checklist (F-01 through F-06)
 */
export const FIELD_SURVEY_CHECKLIST_F01_F06 = Object.freeze([
  Object.freeze({
    code: 'F-01',
    dataType: GROUND_DATA_TYPE.ARCHITECTURAL_FLOOR_PLAN,
    title: '3층 실내 피난안내도 및 남동측 계단실 방화문 실측',
    statutoryBenchmark: '피난계단 출입구 유효너비 >= 1.20m'
  }),
  Object.freeze({
    code: 'F-02',
    dataType: GROUND_DATA_TYPE.EXIT_DOOR_SPECIFICATION,
    title: '1층 남동측 주 비상출구 문턱 높이 및 유효폭 실측',
    statutoryBenchmark: '문턱 <= 2.0cm, 유효너비 >= 1.20m'
  }),
  Object.freeze({
    code: 'F-03',
    dataType: GROUND_DATA_TYPE.ACCESSIBILITY_RAMP,
    title: '캠퍼스 무단차 우회 경사로 기울기 실측',
    statutoryBenchmark: '경사도 <= 8.33% (1:12)'
  }),
  Object.freeze({
    code: 'F-04',
    dataType: GROUND_DATA_TYPE.PAVEMENT_SURFACE,
    title: '배수로 덮개(그레이팅) 틈새 및 노면 상태 실측',
    statutoryBenchmark: '그레이팅 틈새 <= 13.0mm'
  }),
  Object.freeze({
    code: 'F-05',
    dataType: GROUND_DATA_TYPE.BOLLARD_CLEARANCE,
    title: '보행로 차량 진입 차단 볼라드 유효 간격 실측',
    statutoryBenchmark: '볼라드 간격 >= 1.20m'
  }),
  Object.freeze({
    code: 'F-06',
    dataType: GROUND_DATA_TYPE.SHELTER_CAPACITY,
    title: '한양대 대운동장(OA-21060) 진입구 개방·유효폭 및 수용 상태 확인',
    statutoryBenchmark: '주 출입구 개방 및 수용 면적 검증'
  })
]);

/**
 * Evaluate physical field measurements in `record.attributes` against LEGAL_ACCESSIBILITY_STANDARDS.
 */
export function evaluateStatutoryCompliance(record) {
  const attrs = record?.attributes || {};
  const violations = [];

  for (const key of ['clearWidthMeters', 'thresholdHeightCm', 'rampSlopePercent', 'gratingSlotWidthMm', 'bollardSpacingMeters', 'gateOpen']) {
    if (Object.prototype.hasOwnProperty.call(attrs, key) && attrs[key] === null) {
      violations.push(`미측정 현장 항목 (${key} === null)`);
    }
  }
  if (attrs.gateOpen === false) {
    violations.push('대피소 주 진입구 폐쇄 상태 (gateOpen === false)');
  }

  if (typeof attrs.clearWidthMeters === 'number' && attrs.clearWidthMeters < LEGAL_ACCESSIBILITY_STANDARDS.DOOR_CLEAR_WIDTH.minMetersPublic) {
    violations.push(`출입구 유효폭 ${attrs.clearWidthMeters}m < 법정 기준 ${LEGAL_ACCESSIBILITY_STANDARDS.DOOR_CLEAR_WIDTH.minMetersPublic}m`);
  }
  if (typeof attrs.thresholdHeightCm === 'number' && attrs.thresholdHeightCm > LEGAL_ACCESSIBILITY_STANDARDS.DOOR_THRESHOLD.maxHeightCm) {
    violations.push(`출입구 문턱 높이 ${attrs.thresholdHeightCm}cm > 법정 기준 ${LEGAL_ACCESSIBILITY_STANDARDS.DOOR_THRESHOLD.maxHeightCm}cm`);
  }
  if (typeof attrs.rampSlopePercent === 'number' && attrs.rampSlopePercent > LEGAL_ACCESSIBILITY_STANDARDS.RAMP_SLOPE.maxSlopeStandardPercent) {
    violations.push(`경사로 기울기 ${attrs.rampSlopePercent}% > 법정 기준 ${LEGAL_ACCESSIBILITY_STANDARDS.RAMP_SLOPE.maxSlopeStandardPercent}% (1:12)`);
  }
  if (typeof attrs.gratingSlotWidthMm === 'number' && attrs.gratingSlotWidthMm > LEGAL_ACCESSIBILITY_STANDARDS.DRAINAGE_GRATING.maxSlotWidthMm) {
    violations.push(`배수로 그레이팅 틈새 ${attrs.gratingSlotWidthMm}mm > 기준 ${LEGAL_ACCESSIBILITY_STANDARDS.DRAINAGE_GRATING.maxSlotWidthMm}mm`);
  }
  if (typeof attrs.bollardSpacingMeters === 'number' && attrs.bollardSpacingMeters < LEGAL_ACCESSIBILITY_STANDARDS.BOLLARD_CLEARANCE.minSpacingMeters) {
    violations.push(`볼라드 간격 ${attrs.bollardSpacingMeters}m < 법정 기준 ${LEGAL_ACCESSIBILITY_STANDARDS.BOLLARD_CLEARANCE.minSpacingMeters}m`);
  }

  return Object.freeze({
    compliant: violations.length === 0,
    violations: Object.freeze(violations)
  });
}

/**
 * Human Official Authority Approval Workflow States (P3.0 Ingestion Standard)
 * Automated validation can only promote to SYNTAX_VALIDATED or PENDING_OFFICIAL_APPROVAL.
 * Transition to VERIFIED strictly requires an official human inspector sign-off.
 */
export const APPROVAL_WORKFLOW_STATUS = Object.freeze({
  DRAFT:                     'DRAFT',
  SYNTAX_VALIDATED:          'SYNTAX_VALIDATED',          // Automated schema & coordinate checks passed
  PENDING_OFFICIAL_APPROVAL: 'PENDING_OFFICIAL_APPROVAL', // Awaiting certified fire marshal / building official
  APPROVED:                  'APPROVED',                  // Officially signed off by verified human authority
  REJECTED:                  'REJECTED'                   // Rejected with formal deficiency reason
});

/**
 * Standardized Spatial and Egress Identifier Naming Syntax:
 * Format: BLDG{unit}_F{floor:02d}_{TYPE}_{descriptor}
 * Examples: BLDG212_F03_ROOM_301, BLDG212_F01_EXIT_SE_PORTAL, BLDG212_F03_CORRIDOR_E
 */
export const SPATIAL_IDENTIFIER_REGEX = /^BLDG\d{3}_(F\d{2}|OUTDOOR)_[A-Z0-9_]+$/;

export function isValidSpatialIdentifier(id) {
  if (typeof id !== 'string') return false;
  return SPATIAL_IDENTIFIER_REGEX.test(id);
}

/**
 * Validates blueprint spatial alignment properties (scale, rotation, anchor offset)
 */
export function validateBlueprintAlignment(alignment) {
  const errors = [];
  if (!alignment || typeof alignment !== 'object') {
    return { valid: false, errors: ['blueprintAlignment must be an object.'] };
  }
  if (typeof alignment.scaleMetersPerUnit !== 'number' || alignment.scaleMetersPerUnit <= 0) {
    errors.push('blueprintAlignment.scaleMetersPerUnit must be a positive number.');
  }
  if (typeof alignment.rotationZDegrees !== 'number' || alignment.rotationZDegrees < -360 || alignment.rotationZDegrees > 360) {
    errors.push('blueprintAlignment.rotationZDegrees must be a number between -360 and +360.');
  }
  if (!Array.isArray(alignment.anchorOffsetLocal) || alignment.anchorOffsetLocal.length !== 3) {
    errors.push('blueprintAlignment.anchorOffsetLocal must be a 3-element array [dx, dy, dz].');
  }
  return { valid: errors.length === 0, errors };
}

/**
 * Validates a ground data record against the strict P2.5 & P3.0 contract schema.
 *
 * @param {Object} record
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateGroundDataContract(record) {
  const errors = [];

  if (!record || typeof record !== 'object') {
    return { valid: false, errors: ['Record must be a non-null object.'] };
  }

  // 1. Unique Data ID
  if (!record.id || typeof record.id !== 'string' || record.id.trim().length === 0) {
    errors.push('id is required and must be a non-empty string.');
  }

  // 2. Data Type
  if (!record.dataType || !Object.values(GROUND_DATA_TYPE).includes(record.dataType)) {
    errors.push(`dataType must be one of: ${Object.values(GROUND_DATA_TYPE).join(', ')}`);
  }

  // 3. Target Space & Coordinates
  if (!record.targetSpace || typeof record.targetSpace !== 'object') {
    errors.push('targetSpace must be an object specifying building, floor, or spatial coordinates.');
  } else {
    if (!record.targetSpace.buildingId && !record.targetSpace.spaceId) {
      errors.push('targetSpace must specify at least buildingId or spaceId.');
    }
  }

  // 4. Source & Provenance
  if (!record.source || typeof record.source !== 'object') {
    errors.push('source must be an object with organization, documentRef, or method.');
  } else {
    const recognizedSources = [
      ...Object.values(GROUND_DATA_PROVENANCE_SOURCE),
      ...Object.values(DATA_PROVENANCE_SOURCE)
    ];
    if (!record.source.provenanceType || !recognizedSources.includes(record.source.provenanceType)) {
      errors.push(`source.provenanceType must be a recognized provenance source.`);
    }
  }

  // 5. Acquisition Time
  if (!record.acquiredAt || (typeof record.acquiredAt !== 'string' && typeof record.acquiredAt !== 'number')) {
    errors.push('acquiredAt is required (timestamp or ISO string).');
  }

  // 6. Verification Status
  if (!record.status || !Object.values(VERIFICATION_STATUS).includes(record.status)) {
    errors.push(`status must be one of: ${Object.values(VERIFICATION_STATUS).join(', ')}`);
  }

  // 7. Version & Changelog
  if (!record.version || typeof record.version !== 'string' || !/^\d+\.\d+\.\d+$/.test(record.version)) {
    errors.push('version must be a valid SemVer string (e.g. "1.0.0").');
  }

  if (record.previousVersion !== null && typeof record.previousVersion !== 'string') {
    errors.push('previousVersion must be a SemVer string or null.');
  }

  if (!Array.isArray(record.changes)) {
    errors.push('changes must be an array of modification descriptions.');
  }

  // 8. Blueprint Alignment Check (Optional for tabular measurements, mandatory if drawingAttachment exists)
  if (record.blueprintAlignment) {
    const alignCheck = validateBlueprintAlignment(record.blueprintAlignment);
    if (!alignCheck.valid) {
      errors.push(...alignCheck.errors);
    }
  }

  // 8.1. Document Metadata Validation (P3.1 Optional Deep Verification)
  if (record.documentMetadata) {
    if (typeof record.documentMetadata !== 'object') {
      errors.push('documentMetadata must be an object.');
    } else if (!record.documentMetadata.documentTitle || !record.documentMetadata.issuingOrganization) {
      errors.push('documentMetadata requires documentTitle and issuingOrganization.');
    }
  }

  // 8.2. Survey Equipment & Surveyor Validation (P3.1 Optional Deep Verification)
  if (record.surveyEquipment) {
    if (typeof record.surveyEquipment !== 'object' || !record.surveyEquipment.equipmentModel) {
      errors.push('surveyEquipment requires an equipmentModel.');
    }
  }
  if (record.surveyor) {
    if (typeof record.surveyor !== 'object' || !record.surveyor.name) {
      errors.push('surveyor requires a name.');
    }
  }

  // 8.3. Spatial Reference & Alignment Rationale (P3.1 Optional Deep Verification)
  if (record.spatialReference) {
    if (typeof record.spatialReference !== 'object' || !record.spatialReference.horizontalDatum) {
      errors.push('spatialReference requires horizontalDatum.');
    }
  }
  if (record.alignmentRationale) {
    if (typeof record.alignmentRationale !== 'object' || !record.alignmentRationale.method) {
      errors.push('alignmentRationale requires method.');
    }
  }

  // 9. STRICT VERIFICATION ELEVATION RULE (P2.5 & P3.0 Gate):
  // Cannot be VERIFIED without verifiedAt, verifiedBy, and official provenance!
  if (record.status === VERIFICATION_STATUS.VERIFIED) {
    if (!record.verifiedAt) {
      errors.push('VERIFIED status strictly requires a valid verifiedAt timestamp.');
    }
    if (!record.verifiedBy || typeof record.verifiedBy !== 'string' || record.verifiedBy.trim().length === 0) {
      errors.push('VERIFIED status strictly requires an identified verifiedBy authority/surveyor.');
    }
    const nonOfficialSources = [
      DATA_PROVENANCE_SOURCE.USER_FIELD_REPORT,
      DATA_PROVENANCE_SOURCE.DEFAULT_FALLBACK
    ];
    if (nonOfficialSources.includes(record.source?.provenanceType)) {
      errors.push(`Status cannot be VERIFIED when provenanceType is '${record.source?.provenanceType}'. Official verification is mandatory.`);
    }

    // P3.0 Human Authority Approval Gate:
    if (record.approvalWorkflow && record.approvalWorkflow.status !== APPROVAL_WORKFLOW_STATUS.APPROVED) {
      errors.push(`Record cannot be VERIFIED when approvalWorkflow.status is '${record.approvalWorkflow.status}'. Human official sign-off is required.`);
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * GroundDataManager: Manages ground data records, schema validation,
 * version progression, changelog diffs, and official human approval workflows.
 */
export class GroundDataManager {
  constructor() {
    this.records = new Map();
    this.versionHistory = new Map(); // id -> array of records
  }

  /**
   * Register or update a ground data contract record.
   *
   * @param {Object} record
   * @returns {{ success: boolean, record: Object, errors?: string[] }}
   */
  registerRecord(record) {
    const validation = validateGroundDataContract(record);
    if (!validation.valid) {
      return {
        success: false,
        record: null,
        errors: validation.errors
      };
    }

    const frozenRecord = Object.freeze(JSON.parse(JSON.stringify(record)));
    const existing = this.records.get(record.id);

    if (existing) {
      // Validate version progression
      const prevVer = existing.version.split('.').map(Number);
      const newVer = record.version.split('.').map(Number);
      const isHigher = (newVer[0] > prevVer[0]) ||
                       (newVer[0] === prevVer[0] && newVer[1] > prevVer[1]) ||
                       (newVer[0] === prevVer[0] && newVer[1] === prevVer[1] && newVer[2] > prevVer[2]);
      if (!isHigher) {
        return {
          success: false,
          record: null,
          errors: [`New version ${record.version} must be strictly higher than existing version ${existing.version}.`]
        };
      }
      if (record.previousVersion !== existing.version) {
        return {
          success: false,
          record: null,
          errors: [`previousVersion '${record.previousVersion}' does not match current version '${existing.version}'.`]
        };
      }
    } else {
      if (record.previousVersion !== null) {
        return {
          success: false,
          record: null,
          errors: [`Initial record must have previousVersion = null.`]
        };
      }
    }

    // Store in active registry
    this.records.set(record.id, frozenRecord);

    // Append to version history
    if (!this.versionHistory.has(record.id)) {
      this.versionHistory.set(record.id, []);
    }
    this.versionHistory.get(record.id).push(frozenRecord);

    return {
      success: true,
      record: frozenRecord
    };
  }

  /**
   * Human Official Authority Approval Gate (P3.0)
   * Digitally signs off an inspected ground record.
   *
   * @param {string} id
   * @param {Object} approval
   * @param {string} approval.approvedByAuthority
   * @param {string} approval.approvalDocumentRef
   * @param {string} approval.approvedAt
   */
  approveRecord(id, approval = {}) {
    const existing = this.records.get(id);
    if (!existing) {
      return { success: false, error: `Record ID ${id} not found.` };
    }

    if (!approval.approvedByAuthority || !approval.approvalDocumentRef || !approval.approvedAt) {
      return {
        success: false,
        error: 'approvedByAuthority, approvalDocumentRef, and approvedAt are strictly required.'
      };
    }

    const compliance = evaluateStatutoryCompliance(existing);
    if (!compliance.compliant) {
      return {
        success: false,
        error: `법정 기준 미달로 공식 승인 거부: ${compliance.violations.join('; ')}`,
        violations: compliance.violations
      };
    }

    const verParts = existing.version.split('.').map(Number);
    const bumpedVersion = approval.version || `${verParts[0]}.${verParts[1] + 1}.0`;

    const updated = {
      ...existing,
      version: bumpedVersion,
      previousVersion: existing.version,
      status: VERIFICATION_STATUS.VERIFIED,
      verifiedAt: approval.approvedAt,
      verifiedBy: approval.approvedByAuthority,
      changes: [...(existing.changes || []), `공식 승인 완료: ${approval.approvalDocumentRef}`],
      approvalWorkflow: {
        status: APPROVAL_WORKFLOW_STATUS.APPROVED,
        approvedByAuthority: approval.approvedByAuthority,
        approvalDocumentRef: approval.approvalDocumentRef,
        approvedAt: approval.approvedAt,
        notes: approval.notes || '공인 현장 실측 및 관할 소방서 최종 날인 완료'
      }
    };

    return this.registerRecord(updated);
  }

  /**
   * Reject an unverified or deficient ground submission.
   */
  rejectRecord(id, rejection = {}) {
    const existing = this.records.get(id);
    if (!existing) {
      return { success: false, error: `Record ID ${id} not found.` };
    }

    const verParts = existing.version.split('.').map(Number);
    const bumpedVersion = rejection.version || `${verParts[0]}.${verParts[1] + 1}.0`;

    const updated = {
      ...existing,
      version: bumpedVersion,
      previousVersion: existing.version,
      status: VERIFICATION_STATUS.REJECTED,
      changes: [...(existing.changes || []), `공식 거부: ${rejection.reason || '기준 미달'}`],
      approvalWorkflow: {
        status: APPROVAL_WORKFLOW_STATUS.REJECTED,
        rejectedBy: rejection.rejectedBy || 'Inspection Authority',
        reason: rejection.reason || '현장 실측 기준 미달 (단차 초과 또는 유효폭 협소)',
        rejectedAt: rejection.rejectedAt || new Date().toISOString()
      }
    };

    return this.registerRecord(updated);
  }

  /**
   * Get current active record by ID.
   */
  getRecord(id) {
    return this.records.get(id) || null;
  }

  /**
   * Get version history for a given record ID.
   */
  getVersionHistory(id) {
    return this.versionHistory.get(id) || [];
  }

  /**
   * Check whether a given ground element has been confirmed as VERIFIED by an authority.
   */
  isOfficiallyVerified(id) {
    const rec = this.records.get(id);
    if (!rec) return false;
    const isApproved = !rec.approvalWorkflow || rec.approvalWorkflow.status === APPROVAL_WORKFLOW_STATUS.APPROVED;
    return rec.status === VERIFICATION_STATUS.VERIFIED && !!rec.verifiedBy && !!rec.verifiedAt && isApproved;
  }

  /**
   * Evaluate F-01 through F-06 checklist completeness for a facility (defaults to PROVISIONAL 0/6).
   */
  getChecklistSummary(buildingId = 'BLDG_212_ENG1') {
    const matchingRecords = Array.from(this.records.values()).filter(
      r => !r.targetSpace?.buildingId || r.targetSpace.buildingId === buildingId
    );

    const items = FIELD_SURVEY_CHECKLIST_F01_F06.map(spec => {
      const rec = matchingRecords.find(
        r => r.checklistCode === spec.code || r.dataType === spec.dataType
      ) || null;
      const verified = Boolean(rec && this.isOfficiallyVerified(rec.id));
      const compliance = rec ? evaluateStatutoryCompliance(rec) : { compliant: true, violations: [] };
      return Object.freeze({
        code: spec.code,
        dataType: spec.dataType,
        title: spec.title,
        statutoryBenchmark: spec.statutoryBenchmark,
        recordId: rec ? rec.id : null,
        status: verified ? VERIFICATION_STATUS.VERIFIED : (rec ? rec.status : VERIFICATION_STATUS.PROVISIONAL),
        compliant: compliance.compliant,
        violations: compliance.violations,
        verified
      });
    });

    const verifiedCount = items.filter(i => i.verified).length;
    const totalCount = items.length;
    const isCodeVerified = (code) => items.some(i => i.code === code && i.verified);

    const isIndoorFullyVerified = isCodeVerified('F-01') && isCodeVerified('F-02');
    const isWheelchairRouteFullyVerified =
      isCodeVerified('F-02') &&
      isCodeVerified('F-03') &&
      isCodeVerified('F-04') &&
      isCodeVerified('F-05') &&
      isCodeVerified('F-06');

    let overallStatus = VERIFICATION_STATUS.PROVISIONAL;
    if (verifiedCount === totalCount) overallStatus = VERIFICATION_STATUS.VERIFIED;
    else if (verifiedCount > 0) overallStatus = VERIFICATION_STATUS.PARTIALLY_VERIFIED;

    return Object.freeze({
      buildingId,
      verifiedCount,
      totalCount,
      overallStatus,
      isIndoorFullyVerified,
      isWheelchairRouteFullyVerified,
      items: Object.freeze(items)
    });
  }

  /**
   * Compute differences between current version and previous version.
   */
  getDiff(id) {
    const history = this.versionHistory.get(id);
    if (!history || history.length < 2) return null;

    const curr = history[history.length - 1];
    const prev = history[history.length - 2];

    return {
      id,
      fromVersion: prev.version,
      toVersion: curr.version,
      statusTransition: `${prev.status} -> ${curr.status}`,
      declaredChanges: curr.changes,
      previousAttributes: prev.attributes || {},
      currentAttributes: curr.attributes || {},
      alignmentDiff: {
        previous: prev.blueprintAlignment || null,
        current: curr.blueprintAlignment || null
      }
    };
  }

  /**
   * Clear all registered records (restores baseline PROVISIONAL state).
   */
  resetRegistry() {
    this.records.clear();
    this.versionHistory.clear();
  }

  /**
   * Batch ingest a P3.1 JSON field survey packet (F-01..F-06).
   * Records remain PROVISIONAL unless explicit `approve: true` + human authority metadata is passed
   * and statutory compliance succeeds.
   */
  ingestBatchSurveyPacket(packet, options = {}) {
    const records = Array.isArray(packet?.records) ? packet.records : (Array.isArray(packet) ? packet : []);
    const results = [];
    let registeredCount = 0;
    let approvedCount = 0;
    const errors = [];

    for (const rawRec of records) {
      const existing = this.records.get(rawRec.id);
      const rec = { ...rawRec };
      if (existing) {
        const prevParts = existing.version.split('.').map(Number);
        rec.previousVersion = existing.version;
        rec.version = `${prevParts[0]}.${prevParts[1] + 1}.0`;
      } else {
        rec.previousVersion = null;
        rec.version = rec.version || '1.0.0';
      }

      const regRes = this.registerRecord(rec);
      if (!regRes.success) {
        errors.push({ id: rec.id, stage: 'REGISTER', errors: regRes.errors });
        results.push({ id: rec.id, success: false, errors: regRes.errors });
        continue;
      }
      registeredCount++;

      if (options.approve && options.approvalMetadata) {
        const appRes = this.approveRecord(rec.id, options.approvalMetadata);
        if (!appRes.success) {
          errors.push({ id: rec.id, stage: 'APPROVE', errors: [appRes.error] });
          results.push({ id: rec.id, success: false, approved: false, error: appRes.error });
        } else {
          approvedCount++;
          results.push({ id: rec.id, success: true, approved: true });
        }
      } else {
        results.push({ id: rec.id, success: true, approved: false });
      }
    }

    return {
      registeredCount,
      approvedCount,
      totalCount: records.length,
      errors,
      results
    };
  }

  /**
   * Export all active records as JSON.
   */
  exportRegistryJson() {
    const list = Array.from(this.records.values());
    return JSON.stringify(list, null, 2);
  }
}

/**
 * Construct an explicitly labeled P3.1 Field Survey Rehearsal Packet (DRILL ONLY).
 * Used to verify statutory compliance approval & rejection gates in UI/tests without
 * fabricating real on-site survey measurements.
 */
export function buildSimulatedDrillSurveyPacket(mode = 'COMPLIANT', buildingId = 'BLDG_212_ENG1') {
  const isNonCompliant = mode === 'NON_COMPLIANT_GRATING';
  return {
    schemaVersion: 'P3.1-FIELD-SURVEY-1.0',
    drillSimulation: true,
    buildingId,
    records: [
      {
        id: `${buildingId}_DRILL_F01`,
        checklistCode: 'F-01',
        dataType: GROUND_DATA_TYPE.ARCHITECTURAL_FLOOR_PLAN,
        targetSpace: { buildingId, spaceId: 'BLDG212_F03_STAIR_SE' },
        source: { provenanceType: GROUND_DATA_PROVENANCE_SOURCE.AUTHORIZED_FIELD_SURVEY },
        acquiredAt: '2026-11-16T06:00:00Z',
        status: VERIFICATION_STATUS.PROVISIONAL,
        version: '1.0.0',
        previousVersion: null,
        changes: ['[DRILL] F-01 방화문 유효폭 1.24m 시연 입력'],
        attributes: { clearWidthMeters: 1.24, corridorWidthMeters: 2.40 }
      },
      {
        id: `${buildingId}_DRILL_F02`,
        checklistCode: 'F-02',
        dataType: GROUND_DATA_TYPE.EXIT_DOOR_SPECIFICATION,
        targetSpace: { buildingId, spaceId: 'BLDG212_F01_EXIT_SE_PORTAL' },
        source: { provenanceType: GROUND_DATA_PROVENANCE_SOURCE.AUTHORIZED_FIELD_SURVEY },
        acquiredAt: '2026-11-16T06:05:00Z',
        status: VERIFICATION_STATUS.PROVISIONAL,
        version: '1.0.0',
        previousVersion: null,
        changes: ['[DRILL] F-02 1층 주출구 유효폭 1.42m · 문턱 1.2cm'],
        attributes: { clearWidthMeters: 1.42, thresholdHeightCm: 1.2 }
      },
      {
        id: `${buildingId}_DRILL_F03`,
        checklistCode: 'F-03',
        dataType: GROUND_DATA_TYPE.ACCESSIBILITY_RAMP,
        targetSpace: { buildingId, spaceId: 'BLDG212_OUTDOOR_RAMP_DETOUR' },
        source: { provenanceType: GROUND_DATA_PROVENANCE_SOURCE.AUTHORIZED_FIELD_SURVEY },
        acquiredAt: '2026-11-16T06:10:00Z',
        status: VERIFICATION_STATUS.PROVISIONAL,
        version: '1.0.0',
        previousVersion: null,
        changes: ['[DRILL] F-03 경사로 기울기 6.2% (1:16)'],
        attributes: { rampSlopePercent: 6.2 }
      },
      {
        id: `${buildingId}_DRILL_F04`,
        checklistCode: 'F-04',
        dataType: GROUND_DATA_TYPE.PAVEMENT_SURFACE,
        targetSpace: { buildingId, spaceId: 'BLDG212_OUTDOOR_DRAINAGE_PATH' },
        source: { provenanceType: GROUND_DATA_PROVENANCE_SOURCE.AUTHORIZED_FIELD_SURVEY },
        acquiredAt: '2026-11-16T06:15:00Z',
        status: VERIFICATION_STATUS.PROVISIONAL,
        version: '1.0.0',
        previousVersion: null,
        changes: [isNonCompliant ? '[DRILL] F-04 기준 미달 그레이팅 16.5mm (>13mm)' : '[DRILL] F-04 그레이팅 틈새 10.5mm'],
        attributes: { gratingSlotWidthMm: isNonCompliant ? 16.5 : 10.5 }
      },
      {
        id: `${buildingId}_DRILL_F05`,
        checklistCode: 'F-05',
        dataType: GROUND_DATA_TYPE.BOLLARD_CLEARANCE,
        targetSpace: { buildingId, spaceId: 'BLDG212_OUTDOOR_BOLLARD_GATE' },
        source: { provenanceType: GROUND_DATA_PROVENANCE_SOURCE.AUTHORIZED_FIELD_SURVEY },
        acquiredAt: '2026-11-16T06:20:00Z',
        status: VERIFICATION_STATUS.PROVISIONAL,
        version: '1.0.0',
        previousVersion: null,
        changes: ['[DRILL] F-05 볼라드 유효 간격 1.35m'],
        attributes: { bollardSpacingMeters: 1.35 }
      },
      {
        id: `${buildingId}_DRILL_F06`,
        checklistCode: 'F-06',
        dataType: GROUND_DATA_TYPE.SHELTER_CAPACITY,
        targetSpace: { buildingId, spaceId: 'BLDG212_OUTDOOR_STADIUM_OA21060' },
        source: { provenanceType: GROUND_DATA_PROVENANCE_SOURCE.OFFICIAL_DISASTER_INFO },
        acquiredAt: '2026-11-16T06:25:00Z',
        status: VERIFICATION_STATUS.PROVISIONAL,
        version: '1.0.0',
        previousVersion: null,
        changes: ['[DRILL] F-06 대운동장 주 진입구 개방 (유효폭 4.2m)'],
        attributes: { clearWidthMeters: 4.20, gateOpen: true }
      }
    ]
  };
}

