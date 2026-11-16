// ============================================================================
// SEISMOLIVE v4.0 — Generic Response Domain Types, Provenance & Motion Policies
// File: js/response/ResponseDomainTypes.js
//
// Facility-agnostic domain enums and scientific seismic motion policies.
// Zero dependencies on concrete building datasets (e.g., HanyangBuildingData.js)
// or Three.js / DOM runtime APIs.
// ============================================================================

export const DATA_PROVENANCE_SOURCE = Object.freeze({
  OBSERVED_STATION: 'OBSERVED_STATION',             // 실측 관측소 계측 파형 (PGA/PGV)
  SIMULATED_SCENARIO: 'SIMULATED_SCENARIO',         // 시연 및 훈련용 가상 시나리오 입력치 (DEMO / DRILL)
  OFFICIAL_DISASTER_INFO: 'OFFICIAL_DISASTER_INFO', // 정부/기상청/행안부 공식 긴급재난문자
  USER_FIELD_REPORT: 'USER_FIELD_REPORT',           // 사용자의 실시간 현장 보고 (화재, 가스, 문틀 뒤틀림 등)
  ESTIMATED_PROVISIONAL: 'ESTIMATED_PROVISIONAL'    // 도면 비공개로 인한 표준 규격(ISO 23601) 기반 잠정 추정치
});

export const VERIFICATION_STATUS = Object.freeze({
  VERIFIED: 'VERIFIED',
  PARTIALLY_VERIFIED: 'PARTIALLY_VERIFIED',
  PROVISIONAL: 'PROVISIONAL',
  UNAVAILABLE: 'UNAVAILABLE',
  RESTRICTED: 'RESTRICTED',
  REJECTED: 'REJECTED'
});

/**
 * Scientifically Demarcated PGA Hysteresis Policy (Stage R1):
 * Resolves the distinction between:
 *  - PROTECTIVE_ONSET_PGA_G (0.05g, ~49 gal / KMA MMI V): Onset of hazardous structural/non-structural
 *    furnishing displacement. Triggers S1_SHAKING / Drop-Cover-Hold-On and blocks egress movement.
 *  - QUIESCENCE_RELEASE_PGA_G (0.02g, ~19.6 gal / KMA MMI IV): Lower instrument quiescence boundary
 *    indicating ground motion detection at station sensors and confirming post-shaking stillness
 *    (S1_SHAKING -> S2_POST_SHAKING_ASSESSMENT requires PGA < 0.02g sustained >= 10s).
 * Note: The intermediate [0.02g, 0.05g) band acts as a physical hysteresis buffer to prevent oscillation.
 */
export const SEISMIC_MOTION_POLICY = Object.freeze({
  PROTECTIVE_ONSET_PGA_G: 0.05,
  QUIESCENCE_RELEASE_PGA_G: 0.02,
  QUIESCENCE_MIN_DURATION_SEC: 10.0,
  SIGNIFICANT_DAMAGE_PGA_G: 0.10,
  SEVERE_DAMAGE_PGA_G: 0.15
});

export function isProtectiveShakingOnset(pga_g) {
  return typeof pga_g === 'number' && Number.isFinite(pga_g) && pga_g >= SEISMIC_MOTION_POLICY.PROTECTIVE_ONSET_PGA_G;
}

export function isInstrumentMotionDetected(pga_g) {
  return typeof pga_g === 'number' && Number.isFinite(pga_g) && pga_g >= SEISMIC_MOTION_POLICY.QUIESCENCE_RELEASE_PGA_G;
}

export function isQuiescenceSubsided(pga_g, quiescentSeconds = 0.0) {
  return (
    typeof pga_g === 'number' &&
    Number.isFinite(pga_g) &&
    pga_g < SEISMIC_MOTION_POLICY.QUIESCENCE_RELEASE_PGA_G &&
    typeof quiescentSeconds === 'number' &&
    quiescentSeconds >= SEISMIC_MOTION_POLICY.QUIESCENCE_MIN_DURATION_SEC
  );
}

export const ASSESSMENT_URGENCY = Object.freeze({
  IMMEDIATE: 'IMMEDIATE', // 즉각 방어/대피 행동 필요 (흔들림 중 엄폐, 화재 연기 직면)
  HIGH: 'HIGH',           // 높은 주의: 탈출로 확보 및 조심스러운 이동 단계
  CAUTION: 'CAUTION',     // 주의 관찰: 여진 대비, 낙하물 경계, 미확인 정보 확인
  STABLE: 'STABLE'        // 안전 집결지 도착 및 안정 상태
});

export const LOCATION_CERTAINTY = Object.freeze({
  MANUAL_EXACT: 'MANUAL_EXACT',         // 사용자가 직접 호실(Room 301 등)을 선택함
  FLOOR_ONLY: 'FLOOR_ONLY',             // 층(3층)만 선택하고 세부 호실 미지정
  BUILDING_ONLY: 'BUILDING_ONLY',       // 건물(제1공학관)만 선택하고 층 미지정
  ESTIMATED_COARSE: 'ESTIMATED_COARSE', // 단말 대략적 위치(캠퍼스 반경 수백미터)
  UNKNOWN: 'UNKNOWN'                    // 위치 정보 없음
});

export const MOBILITY_PROFILE = Object.freeze({
  NONE: 'NONE',                         // 이동 제약 없음 (일반 보행 가능)
  WHEELCHAIR: 'WHEELCHAIR',             // 휠체어 이용자 (계단 단차 원천 불가)
  CRUTCHES: 'CRUTCHES',                 // 목발/지팡이 이용 (경사로 선호, 계단 지양)
  INJURED_WALKING: 'INJURED_WALKING',   // 보행 가능한 경상자 (속도 저하, 난간 필요)
  UNKNOWN: 'UNKNOWN'                    // 이동 특성 미입력
});

export const CONFLICT_RESOLUTION_STRATEGY = Object.freeze({
  NO_CONFLICT: 'NO_CONFLICT',
  LOCAL_UNVERIFIED_HAZARD_PRECAUTION: 'LOCAL_UNVERIFIED_HAZARD_PRECAUTION',
  CONSERVATIVE_PHYSICAL_BARRIER_HOLD: 'CONSERVATIVE_PHYSICAL_BARRIER_HOLD',
  UNRESOLVED_CONFLICT_CAUTIONARY_DEFENSE: 'UNRESOLVED_CONFLICT_CAUTIONARY_DEFENSE'
});

export const PATH_TYPE = Object.freeze({
  SHORTEST_RAPID: 'PATH_SHORTEST_RAPID',
  STEP_FREE_DETOUR: 'PATH_STEP_FREE_DETOUR',
  COMPLETE_INDOOR_OUTDOOR: 'PATH_COMPLETE_INDOOR_OUTDOOR'
});

export const USER_MOBILITY_PROFILE = Object.freeze({
  STANDARD_EVACUEE: 'STANDARD_EVACUEE',
  INJURED_LIGHT: 'INJURED_LIGHT',
  WHEELCHAIR_USER: 'WHEELCHAIR_USER',
  ELDERLY_SLOW: 'ELDERLY_SLOW'
});

export const LINK_STATE = Object.freeze({
  OPEN: 'OPEN',           // 통행 가능 (기본 상태 또는 점검 완료)
  SUSPECTED: 'SUSPECTED', // 미확인 장애물/위험 신고 (비용 페널티 적용, 우회 선호)
  CLOSED: 'CLOSED',       // 신뢰할 수 있는 근거로 통행 불가 확정 (경로 계산에서 원천 배제)
  UNKNOWN: 'UNKNOWN'      // 정보 없음 (신선도 소실 또는 미확인)
});

/**
 * Standardized Spatial Object Data Quality & Source Classification (Section 7)
 */
export const DATA_ORIGIN_TYPES = Object.freeze({
  OBSERVED: 'OBSERVED',       // 실시간 관측소·센서 계측 데이터
  OFFICIAL: 'OFFICIAL',       // 행정안전부·기상청·지자체 등 공공 공식 데이터
  MODELLED: 'MODELLED',       // 수치 모델·이론적 주시 계산
  SYNTHETIC: 'SYNTHETIC',     // 교육/훈련용 사용자 설정 인공지진 매개변수
  PROVISIONAL: 'PROVISIONAL', // 미실측·OSM 추출 등 잠정 추정 데이터
  UNKNOWN: 'UNKNOWN'          // 확인 불가 / 데이터 부재
});

/**
 * Clear Demarcation of Earthquake Scenario Modes (DATA 1)
 */
export const SCENARIO_TYPES = Object.freeze({
  OBSERVED_EVENT: 'OBSERVED_EVENT',               // 실제 계기 관측 지진 (USGS / KMA)
  EDUCATIONAL_SYNTHETIC: 'EDUCATIONAL_SYNTHETIC', // 사용자 지역·규모 지정 교육용 인공지진
  HISTORICAL_RECORD: 'HISTORICAL_RECORD'          // 역사 문헌 지진 사료 (위치·규모 불확실성 보존)
});

/**
 * Seismic Impact Zone Evaluation relative to User Position (Section 2-1 & DATA 1)
 */
export const IMPACT_ZONE_STATUS = Object.freeze({
  IN_IMPACT_ZONE: 'IN_IMPACT_ZONE',
  MARGINAL_FELT_ZONE: 'MARGINAL_FELT_ZONE',
  OUTSIDE_IMPACT_ZONE: 'OUTSIDE_IMPACT_ZONE',
  EDUCATIONAL_DRILL: 'EDUCATIONAL_DRILL',
  HISTORICAL_REFERENCE_ONLY: 'HISTORICAL_REFERENCE_ONLY',
  UNKNOWN: 'UNKNOWN'
});

/**
 * Evacuation Destination Candidate Verification Result (Section 3-4)
 */
export const CANDIDATE_STATUS = Object.freeze({
  CONFIRMED: 'CONFIRMED',     // 공식 지정·실존·접근성 근거 확인됨
  CONDITIONAL: 'CONDITIONAL', // 개활/임시 후보이나 개방·현장 점검 조건부 확인 필요
  UNKNOWN: 'UNKNOWN',         // 주변 공간 데이터/시설 정보 부족으로 판단 불가
  UNAVAILABLE: 'UNAVAILABLE'  // 후보 시설 없음 또는 보행 경로 단절로 이용 불가
});

export const CANDIDATE_FACILITY_TYPES = Object.freeze({
  OFFICIALLY_DESIGNATED: 'OFFICIALLY_DESIGNATED',
  LOCAL_DESIGNATED: 'LOCAL_DESIGNATED',
  CONFIRMED_PUBLIC_FACILITY: 'CONFIRMED_PUBLIC_FACILITY',
  OPEN_SPACE_ALTERNATIVE: 'OPEN_SPACE_ALTERNATIVE'
});

/**
 * Indoor Spatial Data Scope Tiers (Section 8)
 */
export const INDOOR_SPATIAL_SCOPE = Object.freeze({
  FOOTPRINT_ONLY: 'FOOTPRINT_ONLY',           // 외곽 풋프린트만 확보
  HEIGHT_ONLY_3D: 'HEIGHT_ONLY_3D',           // 3D 외형 높이 확보 (실내 미확보)
  LEVEL_COUNT_ONLY: 'LEVEL_COUNT_ONLY',       // 지상 층수 확보 (평면도 미확보)
  PROVISIONAL_FLOORPLAN: 'PROVISIONAL_FLOORPLAN', // 잠정 실내 도면(파일럿 등)
  VERIFIED_INDOOR: 'VERIFIED_INDOOR'          // 공식 도면+현장 실측(F-01~F-06) 완료
});

/**
 * Build standardized metadata envelope attached to every provider output and spatial entity.
 */
export function createProvenanceRecord({
  source = 'UNKNOWN',
  sourceType = DATA_ORIGIN_TYPES.UNKNOWN,
  updatedAt = null,
  geometryAccuracy = 'UNKNOWN',
  completeness = 'UNKNOWN',
  verificationStatus = VERIFICATION_STATUS.PROVISIONAL,
  confidence = 0.0,
  limitations = '현장 확인 필요'
} = {}) {
  return Object.freeze({
    source,
    sourceType,
    updatedAt: updatedAt || new Date().toISOString().slice(0, 10),
    geometryAccuracy,
    completeness,
    verificationStatus,
    confidence: Math.max(0, Math.min(1, Number(confidence) || 0)),
    limitations
  });
}
