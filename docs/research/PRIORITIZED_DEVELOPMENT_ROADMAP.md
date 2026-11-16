# SEISMOLIVE — Prioritized Development Roadmap
## 7축 기술 평가 매트릭스 및 3단계 개발 우선순위 로드맵

**작성일**: 2026-11-16  
**기반 문서**: `REFERENCE_MASTER_INDEX.md` · `REFERENCE_REVERSE_ENGINEERING_REPORT.md` · `SEISMOLIVE_ASSET_EXTRACTION.md` · `SEISMOLIVE_ARCHITECTURE_INTEGRATION_PLAN.md` · `VISUAL_DIRECTION_EXTRACTION.md`

---

## 1. 7축 평가 기준 및 종합 점수표

모든 제안 항목은 다음 7가지 기준으로 평가하였다 (5점 만점, 단 **과학적 신뢰성**과 **저사양/성능 영향**은 결격 가중치로 작용):
1. **사용자 가치 (UV)**: 글로벌 지구 경험 및 개인화 지진 대응 이해도를 얼마나 실질적으로 높이는가
2. **시각적 효과 (VE)**: *Nocturnal Monolith* 갤러리 미학 및 공간 가독성을 해치지 않고 높이는가
3. **기술적 실현 가능성 (TF)**: 외부 유료/인증키/법적 제약 없이 현재 스택으로 구현 가능한가
4. **기존 코드 재사용성 (CR)**: 기존 `js/3d/*`, `js/response/*`, `three-runtime.js`를 얼마나 재사용하는가
5. **구현 비용 (IC)**: 개발 공수가 낮을수록 고점 (`5 = 낮음/신속`, `1 = 높음/장기`)
6. **과학적 신뢰성 (SI)**: 관측·시뮬레이션·잠정(`PROVISIONAL`) 구분 및 `null ≠ 0` 원칙을 엄수하는가
7. **성능 영향 (PI)**: 일반 학교/사무실 통합 GPU PC 호환성 유지 (`5 = 성능 개선/부하 극소`, `1 = 성능 악화`)

| 순위 | 제안 항목 | 출처 | UV | VE | TF | CR | IC | SI | PI | 총점(/35) | 단계 분류 |
| :---: | :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **1** | **T-X 주시곡선 3D 지형 프로브 셰이더 완성 & 계곡 캐비티 음영 보강** | 기존 미완성 결손 + `Seoul 3D Atlas` | 4 | 5 | 5 | 5 | 5 | 5 | 5 | **34** | **Tier 1 (즉시)** |
| **2** | **사전 빌드 4km 지역 공간맵 패키지 (`6-float32` OBB `InstancedMesh` + 간선도로 + 수계 + 다중 대피소)** | `Seoul 3D Atlas` + `Mini Seoul` | 5 | 5 | 5 | 5 | 4 | 5 | 5 | **34** | **Tier 1 (즉시)** |
| **3** | **우선순위 HTML AABB HUD 회피 충돌 제거 라벨러 & X-Ray 주변 건물 투시** | `Mini Seoul` + `Seoul Data Atlas` + `S-Map` | 5 | 5 | 5 | 4 | 4 | 5 | 5 | **33** | **Tier 1 (즉시)** |
| **4** | **전 구간 지하 관통 방지 카메라 가드 & 통합 Eco(Classroom) 60FPS 모드** | `NASA Eyes` + `Mini Seoul` + `Seoul 3D Atlas` | 4 | 4 | 5 | 5 | 5 | 5 | 5 | **33** | **Tier 1 (즉시)** |
| **5** | **휠체어 `Lock, Cover, Hold On` 대응 & 누적 호장(`pointAlong`) 경로 추적** | `Ready.gov` + `Mini Seoul` | 5 | 3 | 5 | 5 | 5 | 5 | 5 | **33** | **Tier 1 (즉시)** |
| **6** | **글로벌(`index.html`) ↔ 4km 지역 공간 대응 연결 브릿지 (독립 미학 보존)** | SEISMOLIVE 전략 목표 | 5 | 4 | 5 | 5 | 5 | 5 | 5 | **34** | **Tier 1 (즉시)** |
| **7** | **이중 대역 스테레오 지진파 청각화(`>0.5Hz` 가속 + `<0.5Hz` VCO) & `arctan` 압축** | `SEIS-SOUND` + `Earthtunes` | 5 | 4 | 4 | 4 | 3 | 5 | 5 | **30** | **Tier 1 (즉시)** |
| **8** | **동적 위험구역 회피 폴리곤(`avoid_polygons`: 외벽낙하반경·충적층) 라우팅** | `OpenRouteService` + `Valhalla` | 5 | 4 | 4 | 5 | 3 | 5 | 4 | **30** | **Tier 2 (검증 후)** |
| **9** | **4km 경계 초과 시 `3km × 3km` 공간 청크 동적 확장 스트리밍** | `Seoul 3D Atlas` 타일 구조 | 4 | 4 | 4 | 4 | 3 | 5 | 4 | **28** | **Tier 2 (검증 후)** |
| **10** | **공식 USGS ShakeMap(`cont_mmi.json`) & OAF 여진 확률 제품 연동** | `Tremor`(`ye()`) + `USGS` | 4 | 4 | 4 | 4 | 3 | 5 | 4 | **28** | **Tier 2 (검증 후)** |
| **11** | **IMDF / Simple Indoor 호환 다중 지역·다중 건물 `FacilityPackage` 로더 일반화** | `Apple IMDF` + `ArcGIS Indoors` | 5 | 4 | 4 | 4 | 2 | 5 | 4 | **28** | **Tier 2 (검증 후)** |
| **—** | **CesiumJS / WebWorldWind 지구본 교체 · MapLibre+deck.gl 2중 WebGL 주입** | #2, #3, #4, #5, #16 | 2 | 2 | 2 | 1 | 1 | 3 | 1 | **12** | **Tier 3 (비도입)** |
| **—** | **Tremor 단순 MMI 경험식 `1*M - 3*log10(R) + 4.5` · 미검증 막차/도달 등시선 · 가상 실내 도면** | #6(`Ot()`), #11(삭제기능), 합성도면 | 1 | 2 | 5 | 2 | 4 | **1 (결격)** | 5 | **—** | **Tier 3 (비도입)** |

---

## 2. 단계별 실행 로드맵 (3 Phases)

### Stage 1: 즉시 흡수할 가치가 높은 항목 (Immediate High-Value Absorption — Tier 1)
기존 SEISMOLIVE(`index.html` 및 `js/response/*`, `viewer_p2_6.html`)의 미완성 결손을 먼저 메우고, 4km 로컬 공간맵의 핵심 기반을 가볍고 안전하게 세우는 단계.

1. **[기존 작품 개선] T-X 주시곡선 3D 지형 프로브 & 지형 미세 기복 음영 복원**
   - 대상: [`js/3d/shaders/SeismicTerrainShaders.js`](file:///Users/katsina/Downloads/earth/js/3d/shaders/SeismicTerrainShaders.js), [`js/main.js`](file:///Users/katsina/Downloads/earth/js/main.js).
   - 작업: `REGIONAL_TERRAIN_FRAGMENT_SHADER`에 누락된 `u_probeDistUnits`, `u_probeCritUnits`, `u_probeCrossUnits`, `u_purePhysicalMode` uniform을 선언하고 절제된 점선 고리 렌더링을 구현; `monolithLandAlbedo` 저지대·계곡 캐비티 명암 개선; `FLIGHT_STATES.DESCEND`/`ASCEND` 구간에 지하 관통 방지 고도 클램핑 적용.
   - 검증: 헤드리스 Chromium에서 `setGeophysics3DProbe(45, 28, 62)` 호출 시 셰이더 컴파일 오류 0건 및 픽셀 변화 확인.
2. **[사전 빌드 4km 공간 데이터 패키지] 반경 4km 정적 공간 데이터셋 & `LocalSpatialMapLayer` 구축**
   - 대상: `assets/data/seongdong_hanyang_local_4km.json`(또는 `.bin`), `js/response/LocalSpatialMapLayer.js`.
   - 작업: `LocalTangentAnchor` 원점 기준 4km 반경(`±2,000m`~`4,000m`) 내 실제 좌표 기반 주요 건물(`InstancedMesh` OBB), 간선 도로 폴리라인, 중랑천 수계, 충적층 주의 영역(`PROVISIONAL`), 다중 대피소/의료기관(`OA-21060` 한양대 대운동장·살곶이공원·서울숲·한양대병원·성동구청)을 사전 패키징.
   - 원칙: 외부 Overpass API 런타임 호출 `0`회; `.cfignore` 배포 용량 `< 35 MB` 유지.
3. **[시각/UX 개선] HTML AABB 충돌 회피 라벨러 + X-Ray 주변 건물 투시 + Eco 모드**
   - 대상: `viewer_p2_6.html`, `LocalSpatialMapLayer.js`, [`GlobalLocalCameraTransition.js`](file:///Users/katsina/Downloads/earth/js/response/GlobalLocalCameraTransition.js).
   - 작업: `Mini Seoul` `StationLabels` 패턴(HUD 박스 회피 + 안전 우선순위 정렬) 적용; `BUILDING_INSPECTION`/`PERSONAL_LOCATION` 진입 시 주변 건물 `opacity → 0.16` 투시; `REGIONAL_APPROACH` 4km 조망 단계 활성화 및 Eco 60FPS 모드(`overviewCount` + 스로틀링) + `index.html` ↔ `viewer_p2_6.html?stage=local4km` 양방향 내비게이션 연결.
4. **[대응·청각 과학 강화] `Lock, Cover, Hold On` 및 이중 대역 지진파 청각화**
   - 대상: [`SituationAssessmentEngine.js`](file:///Users/katsina/Downloads/earth/js/response/SituationAssessmentEngine.js), [`StationWaveformBridge.js`](file:///Users/katsina/Downloads/earth/js/data/StationWaveformBridge.js), [`GeophysicsFolioView.js`](file:///Users/katsina/Downloads/earth/js/ui/GeophysicsFolioView.js).
   - 작업: `isWheelchair` 사용자의 `S1_SHAKING` 행동을 `Ready.gov` 표준 **`LOCK, COVER, HOLD ON`** 으로 구체화; 계측 파형 브리지에 `Earthtunes` `arctan` 소프트 클리핑 + `SEIS-SOUND` 이중 대역(`>0.5Hz` 시간압축 + `<0.5Hz` VCO) Web Audio 재생기 추가(전시용 `LivingSoundfieldEngine`과 완전 분리).

---

### Stage 2: 프로토타입 검증 후 도입할 항목 (Adopt After Prototype Validation — Tier 2)
Stage 1의 4km 프로토타입이 학교/일반 PC 60FPS 기준과 좌표 정합성 검증을 통과한 뒤 단계적으로 확장하는 기능.

1. **4km 경계 초과 시 `3km × 3km` 다중 타일 온디맨드 확장 (`SpatialChunkManager`)**
   - 이유: 초기 4km는 데이터 기준선이나, 실제 대피 경로(예: 왕십리·서울숲 외곽)가 4km를 넘을 경우 인접 청크(`tile_E1_N0.bin` 등)를 동적 적재해야 함.
2. **동적 위험구역 회피 폴리곤 (`avoid_polygons`) 보행 재탐색**
   - 이유: 건물 높이($H$) 비례 외벽 낙하 위험 반경, 변압기·옹벽·충적층 액상화 주의 구역을 면 단위 회피 대상으로 반영하되, 출발 포털 직후 탈출 구간 고립 예외 처리 검증이 선행되어야 함.
3. **공식 USGS ShakeMap (`cont_mmi.json`) & OAF 여진 확률 제품 뷰어 통합**
   - 이유: 실시간 USGS 이벤트 조회 시 ComCat `detail` JSON에서 공식 산출물만 조건부 파싱하고 오프라인/미존재 시 `null` 표기 검증 필요.
4. **일반화된 다중 지역·다중 건물 `RegionPackage` / IMDF 실내 스키마 로더**
   - 이유: 한양대(`BLDG_212_ENG1`) UI 레이블까지 완전히 데이터 드리븐(`FacilityPackage.displayName`)으로 치환하고, 현장 P3.1 측량(`GroundDataContract.js` 사람 승인 게이트) 완료 시점마다 `PROVISIONAL → VERIFIED` 상태 승격 파이프라인 실증.
5. **단일 Three.js 캔버스 통합 (`Stage R4` ExhibitionModeManager)**
   - 이유: 현재 URL 브릿지로 연결되는 `index.html`(글로벌 지구)과 `viewer_p2_6.html`(로컬 4km/개인 대응)을 장기적으로 단일 씬 모드 매니저로 합쳐 페이지 전환 없는 완벽한 `GLOBAL → LOCAL 4KM → BUILDING → INDOOR → RESPONSE` 구현 (단, 글로벌 단독 전시 모드의 순수성을 깨지 않는 조건 하에 진행).

---

### Stage 3: 현재 도입하지 않는 것이 좋은 항목 (Explicit Non-Adoption Decisions — Tier 3)

| 비도입 결정 항목 | 출처 | 배제 사유 (기술·미학·윤리) |
| :--- | :--- | :--- |
| **CesiumJS / NASA WebWorldWind 엔진 전면 교체** | #2, #3 | 기존 커스텀 GLSL 웨이브필드·한국어 리빙 타이포그래피 파이프라인을 폐기해야 하며, 3D Tiles 런타임 스트리밍은 오프라인 전시·학교 저사양 PC 안정성에 불리함. |
| **MapLibre + deck.gl 별도 WebGL 캔버스 상시 병행** | #4, #5, #16 | `index.html`과 동시에 WebGL 컨텍스트 2개를 유지할 시 통합 GPU 메모리 부족(WebGL Context Lost) 위험이 크고, 곡면 지구에서 평면 Web Mercator로 전환 시 카메라 연속성이 깨짐. |
| **Tremor식 자체 MMI 경험식 (`1*M - 3*log10(R) + 4.5`)** | #6 (`index-BBPSN9Xa.js`) | 부지 증폭(연약층 vs 암반), 단층 파쇄 방향성, 지역 $Q(f)$를 무시한 가짜 정량화이므로 과학적 무결성(`GEMINI.md`) 위반. |
| **미검증 도보·환승 시간 기반 "도달 가능 범위" 시각화** | #11 (`metro.kgenots.com` 삭제 사례) | `Mini Seoul` 운영자 스스로도 3분 상수 환승 가정의 위험성 때문에 삭제했듯, 검증 안 된 현장 속도로 대피 가능 여부를 오인시키는 것은 생명 안전에 유해함. |
| **도면 없는 건물의 절차적/상상 실내 평면도 자동 생성** | 일반 AI 생성 기법 | 건축도면이 비공개인 건물 내부 복도·문 개방 여부를 추측으로 채워 `VERIFIED`처럼 보이게 하는 것은 재난 대응에서 치명적 허위 정보 유발. |
| **OpenIndoor / IndoorEqual 코어 코드 직접 차용** | #19, #28 | **AGPL-3.0** 카피레프트 라이선스로 프로젝트 전체 라이선스 전염 위험이 있음(`Simple Indoor Tagging` 데이터 규칙과 `MIT` 프로젝트 패턴만 참고). |
| **클라이언트 런타임 무제한 Overpass / V-World API 호출** | #13, #16 | `kra51` 및 `Mini Seoul` 사례 모두 API 쿼터·타임아웃·지연 때문에 정적 전처리 패키지 + 경량 캐시 프록시로 전환했음. |

---

## 3. 향후 연구·개발 검증 게이트 (Success Criteria)

다음 개발 단계로 진입할 때 모든 기능 구현은 아래 5가지 게이트를 통과해야 완료(`VERIFIED`)로 판정한다:
1. **글로벌 작품 무결성 보존**: `index.html` 첫 화면 및 자동 전시 루프의 어둠 비율(75~88%), 한글 사료 타이포그래피, 음향 동기화 및 기존 Deno 26종/Python 1종 회귀 테스트 100% 통과.
2. **좌표 정합성**: `WGS84 ↔ ECEF ↔ ENU ↔ Three.js` 왕복 변환 및 4km 반경 건물·도로·대피소 거리 오차 `< 0.01 m`.
3. **성능 및 학교 PC 호환성**: Eco/Classroom 모드에서 4km 공간맵 렌더링 시 통합 GPU 기준 메모리 폭증·WebGL 컨텍스트 손실 `0`건, 라벨 AABB 겹침 `0`건.
4. **과학적·안전성 불변식**: `PROVISIONAL`, `OBSERVED_STATION`, `SIMULATED_SCENARIO`, `USER_FIELD_REPORT`, `OFFICIAL_DISASTER_INFO` 구분과 `null ≠ 0` 유지; P2.5 타임라인(`canMove === false` 시 3D 경로 즉시 소거) 불변.
5. **실행 vs 현장 실측 구분**: 단위/E2E 소프트웨어 테스트 통과를 P3.1 현장 실측(`F-01~F-06`) 완료로 혼동해 표기하지 않음.
