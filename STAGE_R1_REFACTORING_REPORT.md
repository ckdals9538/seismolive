# SEISMOLIVE v4.0 — Stage R1 Architecture Refactoring Report

> **작업 범위**: Stage R1 단독 실행 (제1공학관 데이터와 범용 대응 엔진 분리, 다중 건물/캠퍼스 DI 기반 마련, 계단 3·4 강조 인덱스 오류 수정, PGA 히스테리시스 정책 통합)  
> **제약 준수**: Stage R2(`TravelTimeSolvers.js`·`terrainDataResolver.js`), Stage R3(`main.js`·Three.js ESM), Stage R4(단일 캔버스 통합)는 착수하지 않았습니다. 미확인 현장 공간 데이터의 `PROVISIONAL` 상태를 100% 보존했습니다.

---

## 1. 실제 변경된 파일 및 수정 이유

| 파일 경로 | 변경 유형 | 수정 내용 및 이유 |
| :--- | :---: | :--- |
| [js/response/HanyangBuildingData.js](file:///Users/katsina/Downloads/earth/js/response/HanyangBuildingData.js) | 수정 | `SEISMIC_MOTION_POLICY` 및 헬퍼(`isProtectiveShakingOnset`, `isInstrumentMotionDetected`, `isQuiescenceSubsided`), `BLDG_212_OSM_FOOTPRINT_METERS`, 3D 웨이포인트 포함 `HANYANG_OUTDOOR_GRAPH`, 통합 주입 계약 `DEFAULT_HANYANG_FACILITY_PACKAGE` 추가 |
| [js/response/PedestrianRoutingEngine.js](file:///Users/katsina/Downloads/earth/js/response/PedestrianRoutingEngine.js) | 수정 | 생성자 `options.facilityPackage` 주입 및 `loadFacilityPackage()` 추가, 전 층 노드·에지·웨이포인트 동적 적재, `findCompleteIndoorOutdoorPath`/`findOutdoor*Path`/`replanReason`의 시설 비종속화 |
| [js/response/HanyangResponseAdapter.js](file:///Users/katsina/Downloads/earth/js/response/HanyangResponseAdapter.js) | 수정 | `facilityPackage` 및 `router` 주입, `(scene, options)` 이중 생성자 서명 지원(P2.5/P2.6 뷰어 씬 연결 복구), 하드코딩 폴리라인/계단 인덱스 슬라이싱 제거 → `router.findOutdoor*()` 및 `edge.hasStairs` 기반 그래프 직접 렌더링 |
| [js/response/GlobalLocalCameraTransition.js](file:///Users/katsina/Downloads/earth/js/response/GlobalLocalCameraTransition.js) | 수정 | `config.facilityPackage` / `config.viewpoints` 주입 및 `setFacilityViewpoints()` 추가 |
| [js/response/ResponseUIAdapter.js](file:///Users/katsina/Downloads/earth/js/response/ResponseUIAdapter.js) | 수정 | `options.facilityPackage` 기반 출발 호실·출구·대피소 ID·안내 문구 동적 해결, `isProtectiveShakingOnset(pga)` 적용 |
| [js/response/SituationAssessmentEngine.js](file:///Users/katsina/Downloads/earth/js/response/SituationAssessmentEngine.js) | 수정 | `stationPga >= 0.05` 매직 넘버를 `isProtectiveShakingOnset(stationPga)` 호출로 통일 |
| [js/response/ResponseStateMachine.js](file:///Users/katsina/Downloads/earth/js/response/ResponseStateMachine.js) | 수정 | 여진 회귀(`isProtectiveShakingOnset(pga_g)`, `>= 0.05g`)와 진동 종료 전이(`isQuiescenceSubsided(pga_g, quiescentSec)`, `< 0.02g && >= 10s`)의 과학적 히스테리시스 조건 정식 코드화 |
| [js/response/PersonalResponseInteraction.js](file:///Users/katsina/Downloads/earth/js/response/PersonalResponseInteraction.js) | 수정 | `0.02g` 계측 활성화(`isInstrumentMotionDetected`)와 `0.05g` 방호 진동 발동(`isProtectiveShakingOnset`) 역할 분리 |
| [tests/test_r1_architecture_refactoring.js](file:///Users/katsina/Downloads/earth/tests/test_r1_architecture_refactoring.js) | 신규 | 계단 3·4 그래프/정점 일치, PGA `0.05g`/`0.02g` 히스테리시스, 2번째 가상 건물 패키지(`BLDG_TEST_ITBT`) 주입 검증 14건 테스트 추가 |

---

## 2. 계단 3·4 강조 인덱스 오류 해결 내역 (Issue A)

### 2.1 원인 진단
기존 `HanyangResponseAdapter.js`의 `buildPedestrianPaths()`는 14개 수동 정점 배열 `shortestWaypoints`의 **고정 배열 인덱스**로 계단 4개 구간을 잘라 강조했습니다:
- `[shortestWaypoints[6], shortestWaypoints[7]]`: 인덱스 `6`은 `NODE_STAIR2_BOT`과 `NODE_STAIR3_TOP` 사이의 평탄 보행로 중간점(`[135.0, -9.5, 30.0]`)이었고 `7`은 계단 3 시점(`[145.0, -10.0, 45.0]`)이어서, **실제 계단 3(OSM Way `409637898`)이 아니라 그 직전 평지 보행로가 황색 계단 위험 구간으로 표시**되고 있었습니다.
- `[shortestWaypoints[9], shortestWaypoints[10]]`: 인덱스 `9`는 평탄 보도(`Footway`, `[175.0, -12.8, 95.0]`), `10`은 계단 4 시점(`[182.0, -13.0, 110.0]`)으로, **계단 4(OSM Way `187436400`) 역시 한 칸 어긋나 평지 구간이 강조**되는 동일한 버그가 존재했습니다.

### 2.2 구조적 해결 (안정적 그래프 ID·속성 기반 식별)
1. [HanyangBuildingData.js](file:///Users/katsina/Downloads/earth/js/response/HanyangBuildingData.js)의 `HANYANG_OUTDOOR_GRAPH.edges`에 각 에지별 `edgeId`, `wayId`, `hasStairs`, 3D `waypoints`를 단일 진실 원천으로 통합하고 `NODE_STAIR4_BOT`(`[186.0, -13.1, 117.5]`) 정점을 명시적으로 분리했습니다.
2. [HanyangResponseAdapter.js](file:///Users/katsina/Downloads/earth/js/response/HanyangResponseAdapter.js)는 `this.router.findOutdoorShortestPath()`가 반환한 에지 목록 중 **`edge.hasStairs === true` 인 에지만 필터링**하여 `Stairs_Hazard_Segments`를 생성하며, `stairLines.userData.stairSegments`에 `{ edgeId, wayId, source, target, distance, startPos, endPos }`를 기록합니다.
3. 결과적으로 계단 3(`NODE_STAIR3_TOP->NODE_STAIR3_BOT`, `wayId: '409637898'`, `[145.0, -10.0, 45.0] -> [155.0, -12.5, 57.0]`)과 계단 4(`NODE_STAIR4_TOP->NODE_STAIR4_BOT`, `wayId: '187436400'`, `[182.0, -13.0, 110.0] -> [186.0, -13.1, 117.5]`)의 WebGL 정점이 그래프 위상과 100% 일치함이 테스트 `1.2`·`1.3`으로 검증되었습니다.

---

## 3. PGA 임계값 불일치 조사 및 히스테리시스 정책 통합 (Issue B)

코드 및 주석 조사 결과 `0.05g`와 `0.02g`는 오타가 아니라 **서로 다른 물리적·행동적 임계치**였으나, 모듈 간 적용이 어긋나 있었습니다.

| 임계값 | 물리적 의미 | 판단 목적 및 적용 위치 | 통합 전 불일치 상태 | 통합 후 정책 (`SEISMIC_MOTION_POLICY`) |
| :--- | :--- | :--- | :--- | :--- |
| **`>= 0.05g`**<br/>($\approx 49\text{ gal}$, KMA 진도 V 하한 / MMI V 시작) | 비고정 실내 가구·기기의 이동/전도 및 보행 균형 상실 위험이 시작되는 강진동 | **방호 자세 발동 & 이동 금지** (`S1_SHAKING`, `canMove = false`, 여진 시 `S2/S3 → S1` 회귀).<br/>적용: `SituationAssessmentEngine`, `ResponseUIAdapter`, `ResponseStateMachine.updateStationObservation`, `PersonalResponseInteraction` | `PersonalResponseInteraction.js`만 `> 0.02g`로 판정해 경미 진동도 즉시 방호 진동(`isShaking`)으로 오판; `ResponseStateMachine` L86은 `> 0.05` 엄격 부등호 사용 | **`PROTECTIVE_ONSET_PGA_G = 0.05`** (`isProtectiveShakingOnset`: `pga_g >= 0.05`)로 4개 모듈 완전 통일 |
| **`< 0.02g`**<br/>($\approx 19.6\text{ gal}$, KMA 진도 IV / MMI IV 구간) | 지반 계측기에서 약한 여진·배경 진동이 잦아든 안정화 경계 | **계측 감지 및 진동 종료 해제** (`isInstrumentActive` 판정 및 `S1_SHAKING → S2` 전이 조건 `pga_g < 0.02 && >= 10s`).<br/>적용: `PersonalResponseInteraction.isInstrumentActive`, `ResponseStateMachine.stepTransition` | `ResponseStateMachine` L147 문자열은 `PGA < 0.02g`라 명시했으나 실제 `if`문 L144는 `pga_g`를 검사하지 않아 `0.03g` 상태에서도 `S1→S2` 통과 가능 | **`QUIESCENCE_RELEASE_PGA_G = 0.02`** (`isInstrumentMotionDetected`: `>= 0.02`, `isQuiescenceSubsided`: `< 0.02 && >= 10.0s`)로 실제 히스테리시스 `[0.02g, 0.05g)` 대역 보장 |

- **출처/성격 구분**: 두 기준 모두 **지진 관측소 지반 가속도(`OBSERVED_STATION`) 또는 훈련 시나리오(`SIMULATED_SCENARIO`)**에만 적용되며, 건물 개별 층의 증폭 응답을 계산하거나 예측하는 수식으로 사용하지 않습니다.

---

## 4. 다중 건물·캠퍼스 Dependency Injection 구조 요약

- `DEFAULT_HANYANG_FACILITY_PACKAGE` 계약 도입: 건물 메타데이터·외곽선·층수·충별 실내 그래프·입출구 커넥터·실외 OSM 보행 그래프(노드 좌표 + 에지 웨이포인트)·대피소 정보·카메라 뷰포인트를 하나의 불변 객체 규격으로 정의했습니다.
- `PedestrianRoutingEngine`, `HanyangResponseAdapter`, `GlobalLocalCameraTransition`, `ResponseUIAdapter` 모두 `facilityPackage`를 선택 인자로 주입받으며, 생략 시 기존 `DEFAULT_HANYANG_FACILITY_PACKAGE`를 기본 적재하므로 기존 API 및 235개 개인화 대응 테스트와 100% 하위 호환됩니다.
- 부수 결함 수정: `viewer_p2_5.html`·`viewer_p2_6.html`이 `new HanyangResponseAdapter(scene, opts)` 순으로 호출하던 시그니처를 정식 지원해 `this.scene.add(this.rootGroup)`이 실제로 실행되도록 보완했습니다.

---

## 5. 전체 회귀 테스트 및 라이브 뷰어 검증 결과

### 5.1 Deno JS 25개 스위트 + Python 1개 스위트 (전수 통과 · 회귀 0건)

| 스위트 구분 | 기준선 (Stage R1 전) | Stage R1 후 결과 | 비고 |
| :--- | :--- | :--- | :--- |
| 개인화 대응 9개 기본 스위트 (`P1.1~P3.0`) | 220 PASSED \| 0 FAILED | **220 PASSED \| 0 FAILED** | 100% 무회귀 |
| 현장 검증 준비 (`test_p3_1_ground_truth_validation.js`) | 15 PASSED \| 0 FAILED | **15 PASSED \| 0 FAILED** | 4개 경로(651.9/769.1/737.9/855.1m) 일치 |
| **신규 Stage R1 스위트 (`test_r1_architecture_refactoring.js`)** | *(신규)* | **14 PASSED \| 0 FAILED** | 계단 3·4 정점(3건), PGA 히스테리시스(6건), 2번째 건물 DI(5건) |
| 지구·지형·사료·음향·파동·현대지진학 14개 JS 스위트 | ALL PASSED | **ALL PASSED (0 FAILED)** | 1,282+ 명시 카운트 + D5/D6/현대지진학 100% |
| Python LOD 테스트 (`test_seorak_profile_lod.py`) | exit 0 | **exit 0** (Peak 1608.52m, RMSE 3.59m) | 무회귀 |

### 5.2 Headless Chromium 실행 검증
- [`viewer_p2_6.html`](file:///Users/katsina/Downloads/earth/viewer_p2_6.html): `pageerror: 0`, `console error: 0`, 스테이지/타임라인 인터랙션(`T+0s`, `T+40s`, `T+67s`, `T+110s`) 정상 동작.
- [`viewer_p1_3.html`](file:///Users/katsina/Downloads/earth/viewer_p1_3.html): `PersonalResponseInteraction` 연동 화면 `pageerror: 0`, `console error: 0` 확인.

---

## 6. 데이터 무결성 영향 (Data Integrity Impact)

1. **실측 미완료 상태 보존**: `HANYANG_3F_INDOOR_GRAPH`, `HANYANG_1F_INDOOR_GRAPH`, 출구 폭·문턱·경사·대운동장 야간 접근 등 미확인 현장 데이터는 전부 `VERIFICATION_STATUS.PROVISIONAL` 또는 `PARTIALLY_VERIFIED` 상태를 그대로 유지했습니다.
2. **테스트 Fixture 경계 엄수**: `tests/test_r1_architecture_refactoring.js`에 포함된 `MOCK_ITBT_FACILITY_PACKAGE`는 다중 건물 DI 아키텍처 검증용 **합성 테스트 픽스처(`TEST_FIXTURE_ITBT_BLDG`)**로 명시 분리되었으며, 프로덕션 기본 데이터셋(`HanyangBuildingData.js`)에 혼합하지 않았습니다.
3. **경로 거리 및 위상 보존**: 한양대 제1공학관 기준 거리(실외 최단 `651.9m`, 실외 무단차 `769.1m`, 실내외 최단 `737.9m`, 실내외 무단차 `855.1m`)는 수정 전후 소수점 첫째 자리까지 100% 동일합니다.

---

## 7. 미해결 문제 및 다음 단계 권고

1. **미해결 항목 (Stage R1 범위 외)**:
   - `HanyangResponseAdapter.buildPedestrianPaths()`는 초기에 `Path_Shortest`/`Path_StepFree` 선분을 생성하므로, 실시간 `CLOSED`/`SUSPECTED` 링크의 개별 세그먼트 색상 동적 재채색은 향후 P3.1 실측 이후 또는 R2+ 시각화 보강 시 반영 가능합니다.
   - `viewer_p2_6.html` L286은 `{ scale: 1.0, visualScaleFactor: 4.5 }`를 전달하고 있으며, 이번 수정으로 `scene`에 정상 마운트될 때 카메라 좌표계와 일치하도록 `visualScale` 기본값 `options.visualScale ?? options.scale ?? 1.0`을 적용했습니다.
   - `ResponseTimelineSimulator.js`의 P2.5 타임라인 시나리오 상수(`P2_5_TIMELINE_EVENTS`)는 여전히 한양대 타임라인 시나리오 전용이므로, 향후 다중 건물 시연 시 시나리오 주입형 확장을 고려할 수 있습니다.
2. **다음 단계 권고**:
   - **일정 우선 (P3.1 Ground Truth Acquisition)**: 제1공학관 현장 조사(`F-01` 3F 소방 피난 안내도 → `F-02` 출구 유효폭 → `F-03` 문턱·경사로 → `F-06` 대운동장 접근성 → `F-04` 실외 계단 → `F-05` 볼라드)를 우선 진행하여 `GroundDataContract.js` 기반 공식 실측 데이터를 확보할 것을 권고합니다.
   - **아키텍처 후속 (사용자 별도 승인 시)**: Stage R1 검토 완료 후 **Stage R2 (`TravelTimeSolvers.js` 및 `terrainDataResolver.js` 도메인/표현 분리)** 진행 여부를 결정해 주십시오.
