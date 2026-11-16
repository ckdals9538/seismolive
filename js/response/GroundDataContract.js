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
} from './HanyangBuildingData.js';

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
   * Export all active records as JSON.
   */
  exportRegistryJson() {
    const list = Array.from(this.records.values());
    return JSON.stringify(list, null, 2);
  }
}

