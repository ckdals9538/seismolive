# CURRENT_PRODUCT_STATE.md
> 작성일: 2026-11-16  
> 대상: SEISMOLIVE v4.0 코드베이스 전반 ([index.html](file:///Users/katsina/Downloads/earth/index.html), [viewer_p2_6.html](file:///Users/katsina/Downloads/earth/viewer_p2_6.html), `js/3d/*`, `js/data/*`, `js/response/*`, `js/ui/*`)

---

## 0. 총평: "개별 엔진은 고도화되었으나, 하나의 제품 여정으로는 아직 단절되어 있음"

현재 SEISMOLIVE는 **글로벌 3D 지구본/파동/사운드 아카이브 시스템**과 **지역 3D 공간/보행 대피 시스템**이 각각 높은 완성도로 구현되어 있다. 최근 범용 지역 엔진 개편으로 7개 정규화 프로바이더([SpatialDataProviders.js](file:///Users/katsina/Downloads/earth/js/response/SpatialDataProviders.js)), 비교량 수계 횡단 배제 라우팅([CampusWalkRouter.js](file:///Users/katsina/Downloads/earth/js/response/CampusWalkRouter.js)), 데이터 부족 지역에 대한 가짜 데이터 생성 차단([NationwideKoreaSpatialEngine.js](file:///Users/katsina/Downloads/earth/js/response/NationwideKoreaSpatialEngine.js)), 타임라인 스크러버 동기화도 확보되었다.

그러나 **제품 최종 비전(`GLOBAL EARTH → EARTHQUAKE → LOCAL SPACE → HUMAN RESPONSE`)** 관점에서 실제 사용자가 처음 진입해 끝까지 경험하는 흐름을 검증하면 다음과 같은 구조적 문제가 확인된다.

1. **지구본 사건과 지역 실험실이 UI/데이터 흐름상 분리되어 있음**: 사용자가 지구본에서 특정 지진(USGS 실시간 지진, 역사지진, 계측 지진)을 선택해 상세 정보나 3D 전파를 보는 동안 실험실 진입 버튼이 아예 숨겨지며, 선택한 지진의 맥락을 그대로 이어서 지역 대응으로 확장하는 경로가 없다.
2. **실험실 첫 진입 UX가 여전히 '한양대 212동 3층 시뮬레이터'를 전제로 시작됨**: 처음 진입 시 "내 위치 기준 / 자유 모드"의 간결한 선택 대신 즉시 서울 한양대 제1공학관(212동) 3층 301호(`737.9m`) 대피 상태가 열리고, 하단 독에 한양대 건물 프리셋(`212동/HIT/백남학술정보관`)과 `P3.1 현장 실측`·`T+0s/40s/67s/110s` 실험실 UI가 기본 결합되어 있다.
3. **수동 지진 설정 중심 UX & 과학 산출물 미연결**: 팝오버 내에 진앙 위도·경도·규모·깊이를 직접 입력하는 폼이 존재하며, 지구본 쪽에서 이미 구현된 USGS 공식 ShakeMap/OAF 브리지([UsgsOfficialProductsBridge.js](file:///Users/katsina/Downloads/earth/js/data/UsgsOfficialProductsBridge.js)) 및 관측 파형([StationWaveformBridge.js](file:///Users/katsina/Downloads/earth/js/data/StationWaveformBridge.js))이 지역 대응 엔진의 위험 평가(`HazardProvider`, `ResponseUIAdapter`)로는 전달되지 않는다.

---

## 1. 기능별 상태 분류표

상태 기준:
- `IMPLEMENTED`: 코드가 존재하고 실제 사용자 경험 흐름에서도 의도대로 작동함
- `PARTIALLY IMPLEMENTED`: 핵심 기능은 동작하나 제품 비전(범용성·자동화·통합 UX) 기준 일부 공백이 있음
- `DISCONNECTED`: 모듈 자체는 동작하지만 앞/뒤 단계의 데이터나 UI 경험과 이어지지 않고 따로 노는 상태
- `BROKEN`: 사용자 관점에서 오류가 나거나 제품 규칙과 정면으로 충돌해 정상 여정을 방해하는 상태
- `NOT IMPLEMENTED`: 아직 구현되지 않음

| 영역 | 세부 기능 | 주요 코드 | 상태 | 코드 존재 vs 실제 UX 진단 |
| :--- | :--- | :--- | :--- | :--- |
| **1. 글로벌 지구본 & 탐색** | 3D 지구본 궤도, 역사/계측/USGS 비콘 탐색, 아카이브 목록·상세 도시에 | [main.js](file:///Users/katsina/Downloads/earth/js/main.js), [UnifiedControlSurface.js](file:///Users/katsina/Downloads/earth/js/ui/UnifiedControlSurface.js), [DiscoveryBeacons.js](file:///Users/katsina/Downloads/earth/js/ui/DiscoveryBeacons.js) | **IMPLEMENTED** | 궤도 카메라, 한반도 역사·계측·USGS 지진 노드 클릭, 도시에(`SELECTED`) 및 3D 공연 전환이 안정적으로 작동함. |
| **2. 지진 데이터 수집/정규화** | 역사 사료 DB, 국내 주요 계측 DB, USGS GeoJSON 피드 커넥터 | [historicalArchiveDB.js](file:///Users/katsina/Downloads/earth/js/data/historicalArchiveDB.js), [instrumentalCatalogDB.js](file:///Users/katsina/Downloads/earth/js/data/instrumentalCatalogDB.js), [usgsFeedConnector.js](file:///Users/katsina/Downloads/earth/js/data/usgsFeedConnector.js) | **PARTIALLY IMPLEMENTED** | 역사·USGS 정적/실시간 피드는 잘 정규화되나, **KMA 실시간 국내 지진 피드 연동이 없고** `buildUnifiedMasterCatalog`는 ID 문자열 중복만 막을 뿐 KMA-USGS 동일 사건 시공간 병합은 없음. |
| **3. 지진 시각화 & 사운드** | P/S/표면파 전파 셰이더, 리빙 타이포그래피, 리빙 사운드필드, 타임라인 스크러버 | [wavefieldVisualOrchestrator.js](file:///Users/katsina/Downloads/earth/js/3d/wavefieldVisualOrchestrator.js), [livingMemoryEngine.js](file:///Users/katsina/Downloads/earth/js/3d/livingMemoryEngine.js), [livingSoundfieldEngine.js](file:///Users/katsina/Downloads/earth/js/audio/livingSoundfieldEngine.js) | **IMPLEMENTED** | `seekToTime()` 및 `#transport-scrubber` 수정으로 50초/120초 공연 타임라인 전진·후진 스크러빙과 셰이더 동기화가 정상 작동함. |
| **4. 공식 위험 산출물 (ShakeMap/OAF)** | USGS ComCat `detail` 기반 ShakeMap 등진도·OAF 여진 확률 파싱 및 투영 | [UsgsOfficialProductsBridge.js](file:///Users/katsina/Downloads/earth/js/data/UsgsOfficialProductsBridge.js), [GeophysicsFolioView.js](file:///Users/katsina/Downloads/earth/js/ui/GeophysicsFolioView.js) | **DISCONNECTED** | `GeophysicsFolioView` 지구물리 탭에만 머물러 있으며, `HazardProvider`·`LocalSpatialMapLayer`·`EvacuationExperienceController`의 위험 분석/대피 판단 입력으로 전혀 전달되지 않음. |
| **5. 지구본 → 실험실 진입·전환** | 우상단 메뉴(`#dev-lab-global-wrap`), 강하/상승 비행, 단일 캔버스 전환 | [index.html](file:///Users/katsina/Downloads/earth/index.html#L22-L43), [main.js](file:///Users/katsina/Downloads/earth/js/main.js#L532-L544), [ExhibitionModeManager.js](file:///Users/katsina/Downloads/earth/js/ui/ExhibitionModeManager.js) | **DISCONNECTED** | `UnifiedControlSurface.updateGlobalDevLabVisibility()`가 `EXPLORE` 유휴 상태 외(사건 탐색/선택/공연)에서는 실험실 진입 UI를 숨김. 지구본에서 선택한 사건(`selectedEvent`)을 바로 지역 대응으로 넘기는 연결 버튼이 없음. `viewer_p2_6.html`은 별도 페이지로 이원화되어 있음. |
| **6. 실험실 최초 진입 (내 위치 vs 자유 모드)** | GPS 위치 수집(`LocationProvider`), 지역 검색·좌표 입력 | [SpatialDataProviders.js](file:///Users/katsina/Downloads/earth/js/response/SpatialDataProviders.js#L89-L162), [EvacuationExperienceController.js](file:///Users/katsina/Downloads/earth/js/ui/EvacuationExperienceController.js#L110-L135) | **PARTIALLY IMPLEMENTED** | `LocationProvider`와 지역 검색 팝오버는 구현되었으나, **"내 위치 기준 / 자유 모드" 진입 관문은 없음.** 팝오버를 열지 않으면 즉시 한양대 212동 3층 301호(`DEFAULT_HANYANG_FACILITY_PACKAGE`)로 들어가며 GPS는 버튼 클릭형 보조 수단으로만 숨겨져 있음. |
| **7. 지진 시나리오 자동화** | 지역 기반 지진 자동 선정 (과거 이력 + 교육용 합성 + 실제 관측 연동) | [NationwideKoreaSpatialEngine.js](file:///Users/katsina/Downloads/earth/js/response/NationwideKoreaSpatialEngine.js#L260-L320), [EvacuationExperienceController.js](file:///Users/katsina/Downloads/earth/js/ui/EvacuationExperienceController.js#L121-L134) | **PARTIALLY IMPLEMENTED** | 벤치마크 7개 권역(`seoul_hanyang`, `sokcho`, `gyeongju`, `pohang`, `yangyang`, `buan`, `busan_haeundae`)은 기본 시나리오가 있으나, 미등록 임의 좌표는 무조건 `북동쪽 ~5.4km M5.2` 고정 오프셋만 생성함. UI에는 반대로 수동 진앙/규모/깊이 입력창이 노출되어 있음. |
| **8. 지역 지형·건물·도로 수집** | AWS Terrarium DEM, OSM `0.6/map.json` + Overpass(최대 4km 확장), OBB 분해 | [NationwideKoreaSpatialEngine.js](file:///Users/katsina/Downloads/earth/js/response/NationwideKoreaSpatialEngine.js), [SpatialDataProviders.js](file:///Users/katsina/Downloads/earth/js/response/SpatialDataProviders.js) | **IMPLEMENTED** | 건물/도로 미확인 시 가짜 격자나 가짜 블록을 만들지 않고 `INSUFFICIENT`를 반환함. 단, 지구본에서 사용하던 Copernicus 30m(`.bin`) DEM과는 파이프라인이 분리되어 Terrarium 타일을 별도 조회함. |
| **9. 보행 네트워크 & 경로 계산** | A* 기반 건물 OBB 회피, 수계/교량 제약, 무단차/대체 경로 산출 | [CampusWalkRouter.js](file:///Users/katsina/Downloads/earth/js/response/CampusWalkRouter.js), [PedestrianRoutingEngine.js](file:///Users/katsina/Downloads/earth/js/response/PedestrianRoutingEngine.js) | **IMPLEMENTED** | 비교량 하천·수계 횡단 차단, OBB 우회, 엣지 중복 페널티 기반 대체 경로 산출이 검증됨. 계산된 그래프 웨이포인트가 그대로 3D 튜브 리본(`CurvePath + LineCurve3`)에 사용되어 기하 정합성이 확보됨. |
| **10. 대피 후보지 평가** | 다차원 평가(`CONFIRMED / CONDITIONAL / UNKNOWN / UNAVAILABLE`) | [SpatialDataProviders.js](file:///Users/katsina/Downloads/earth/js/response/SpatialDataProviders.js#L707-L925), [NationwideKoreaSpatialEngine.js](file:///Users/katsina/Downloads/earth/js/response/NationwideKoreaSpatialEngine.js) | **PARTIALLY IMPLEMENTED** | 보행망 도달성·건물 이격거리·수계 인접성은 정량 평가하지만, **공식 행정안전부 지진옥외대피소 DB/API 연동이 없어** 한양대 외 지역 후보는 모두 `CONDITIONAL`로만 판정됨. |
| **11. 상황 판단 & 대응 지침** | 영향권 판정(`HazardProvider`), 6상태 머신, 교육적 행동 카드 | [SituationAssessmentEngine.js](file:///Users/katsina/Downloads/earth/js/response/SituationAssessmentEngine.js), [ResponseStateMachine.js](file:///Users/katsina/Downloads/earth/js/response/ResponseStateMachine.js), [ResponseUIAdapter.js](file:///Users/katsina/Downloads/earth/js/response/ResponseUIAdapter.js) | **PARTIALLY IMPLEMENTED** | `OUTSIDE_IMPACT_ZONE` 시 거짓 대피 경로를 억제하는 구조는 갖췄으나, 실제 런타임에서는 `ResponseUIAdapter`가 생성자 기본값으로 `station.pga_g: 0.08`을 들고 시작하고 `EvacuationExperienceController`가 `0.01/0.22/0.16g` 가짜 PGA 수치를 하드코딩 호출함. |
| **12. 대응 시뮬레이션 UX & 시각화** | 3D 보행 마커, 경로 스크러버, 시점 추적, 단계별 안전수칙 팝업 | [EvacuationExperienceController.js](file:///Users/katsina/Downloads/earth/js/ui/EvacuationExperienceController.js), [LocalSpatialMapLayer.js](file:///Users/katsina/Downloads/earth/js/response/LocalSpatialMapLayer.js), [HanyangResponseAdapter.js](file:///Users/katsina/Downloads/earth/js/response/HanyangResponseAdapter.js) | **PARTIALLY IMPLEMENTED** | `#route-scrubber` 조작·시점 추적·도착 교육 패널은 작동함. 그러나 **한양대 212동 3층 301호 / `T+0s..110s` / `F-01..F-06` UI가 한양대 외 범용 제품의 흐름과 충돌**하며, 출발 위치가 지정 건물 중심(`Building` 가정)으로 묶이는 경향이 남아 있음. |
| **13. Global ↔ Local 카메라·좌표 연속성** | 지구본 구면 좌표 → 지역 ENU 투영 → 카메라 강하/복귀 | [geodeticEllipsoidCoord.js](file:///Users/katsina/Downloads/earth/js/3d/geodeticEllipsoidCoord.js), [GlobalLocalCameraTransition.js](file:///Users/katsina/Downloads/earth/js/response/GlobalLocalCameraTransition.js), [main.js](file:///Users/katsina/Downloads/earth/js/main.js#L2827-L2883) | **PARTIALLY IMPLEMENTED** | `startDescentFlight()` 후 캔버스 내부에서 `localWorldGroup`으로 전환되는 단일 WebGL 구조는 구현되어 있음. 그러나 비행 대상(`flightTargetEvent`)과 로컬 지역(`req.regionId`) 간 좌표·시각적 지형 연속성(지구본 지진 전파 → 같은 지형의 로컬 3D 진입)은 컷 전환에 가깝고, `SeismicImpactContext.resolveActiveSeismicEvent()`는 `options.anchor` 미전달 시 한양대 좌표로 폴백함. |

---

## 2. Section 8 핵심 점검 7대 질문 검증 결과

1. **지구본에서 선택한 지진 데이터가 지역 실험실에 정확히 전달되는가?**
   - **아니오 (`DISCONNECTED`)**. 지구본에서 사건(`hist_1681_0626` 외 USGS 실시간 사건 포함)을 탐색/선택(`SELECTED` 또는 `PERFORMANCE`)해도 실험실 진입 버튼이 숨겨져 있어 해당 사건 ID/객체를 그대로 지역 실험실로 넘길 수 없다. 우상단 메뉴의 칩은 정적 HTML `onclick` 인자(`gyeongju`, `pohang`, `sokcho`, `seoul_hanyang`)로 고정되어 있고, `viewer_p2_6.html`은 기본 `initialEventId: requestedEventId || 'hist_1681_0626'`로 열린다.
2. **지역 실험실에서 사용자 위치와 진앙을 혼동하지 않는가?**
   - **데이터 레이어에서는 분리, 초기 UX에서는 혼재 (`PARTIALLY IMPLEMENTED`)**. `HazardProvider.evaluateSeismicImpactAtLocation(hazard, userLat, userLon)`는 둘을 엄격히 분리해 거리·방위·영향권 여부를 계산한다. 하지만 실험실 초기 진입 시 `activeRegionInfo`의 기준 좌표를 사용자 위치로 간주해 즉시 **한양대 212동 건물 안**으로 가정하며, 사용자 위치 확보(`GPS/직접지정`)보다 먼저 건물 출발 대피 화면을 보여준다.
3. **실제 지진과 교육용 시나리오가 명확히 구분되는가?**
   - **엔진과 배지에서는 구분됨 (`IMPLEMENTED`)**. `SCENARIO_TYPES`(`OBSERVED_EVENT`, `EDUCATIONAL_SYNTHETIC`, `HISTORICAL_RECORD`) 및 `DATA_ORIGIN_TYPES`로 엄격히 분리되어 UI 배지(`실제 계기 관측`, `교육용 인공`, `역사 사료`)로 표출된다. 다만 `applyTimelineStep()`·`ResponseUIAdapter` 초기값(`station: { pga_g: 0.08 }`, `0.22g`) 같은 시연용 상수가 아직 UI 어댑터 내부에 남아 있어 "실제 지진 관측 기반 대응"과 "타임라인 시연" 경계가 모호해질 수 있다.
4. **지역 공간 분석이 특정 대학이나 특정 지역에 종속되지 않는가?**
   - **코어 공간/라우팅 엔진은 독립, 진입/UI 프리셋은 종속 잔존 (`PARTIALLY IMPLEMENTED`)**. `SpatialDataProviders.js`와 `NationwideKoreaSpatialEngine.js`는 임의 위경도를 처리하고 데이터 부족 시 `INSUFFICIENT`를 정직하게 반환한다. 반면 초기 `EvacuationExperienceController` 생성자는 여전히 `HANYANG_LOCAL_4KM_PACKAGE` + `DEFAULT_HANYANG_FACILITY_PACKAGE`로 부팅되며, `P3.1` 체크리스트·`BLDG_212_ENG1`·`T+67s 계단 균열` 같은 한양대 전용 데모 버튼이 툴바에 남아 있다.
5. **대피 목적지가 실제 주변 시설과 공간 데이터에 기반하는가?**
   - **기반함 (단, 공식 대피소 API는 미연동)**. 한양대 외 지역에서는 OSM의 `emergency=assembly_point`, `amenity=school`, `leisure=park/pitch/stadium` 다각형 및 `walkGraph` 연결성을 기반으로 후보를 추출하며 가짜 대피소를 만들지 않는다. 다만 행안부 공공 대피소 데이터가 아직 연동되지 않아 공식 지정 여부를 `CONFIRMED`로 검증하지 못한다.
6. **경로 계산 결과와 3D 경로 애니메이션이 동일한 좌표를 사용하는가?**
   - **일치함 (`IMPLEMENTED`)**. `CampusWalkRouter`가 계산한 `waypoints3D`([East, Up, -North])를 `HanyangResponseAdapter._addVolumetricRouteMeshes()`가 구간 직선(`CurvePath` + `LineCurve3`)으로 렌더링하고, `EvacuationExperienceController`의 보행 마커와 5단계 체크포인트가 동일한 `routePolylines`를 샘플링한다.
7. **분석 결과가 교육적 대응 지침으로 연결되는가?**
   - **부분적으로 연결됨 (`PARTIALLY IMPLEMENTED`)**. `OUTSIDE_IMPACT_ZONE`, `INSUFFICIENT`, `S1~S6` 상태에 따라 행동 지침과 도착 후 3단계 안전 프로토콜을 표시한다. 그러나 `btn-fac-212` 등 초기 화면에서는 여전히 한양대 3층 실내 출발 카드(`212동 3층 301호`)가 먼저 뜨고, 지역 데이터나 지진 이력에 맞춘 **"왜 이 지진이 이곳에서 의미가 있으며 지금 무엇을 해야 하는지"**에 대한 통합 내러티브(교육적 시나리오 자동 구성)는 약하다.

---

## 3. 지금 사용자가 실제로 겪는 흐름 요약

- **흐름 A (지구본 사용자)**: `index.html`에서 1681 양양이나 2023 튀르키예 또는 실시간 USGS 지진을 클릭 → 도시에 확인 → `현장 강하 및 3D 시각화 재생 시작` 클릭 → 지진파/아카이브 공연 감상 → **"이 지진으로 주변 대응을 보자"**라는 연결 버튼이 없어 다시 `궤도 [ESC]`로 올라와야 함 → 올라와도 방금 본 지진은 초기화되고 우측 상단에서 고정된 서울/속초/경주/포항 중 하나를 새로 눌러야 함.
- **흐름 B (실험실 진입 사용자)**: 우측 상단 버튼으로 서울에 진입하면 **"내 위치 기준 / 자유 모드"** 선택 없이 곧바로 **한양대 212동 3층 301호 -> 대운동장 `737.9m` 대피 동선**이 열림. 사용자가 자기 집이나 다른 지역에 대해 알아보고 싶으면 상단 `KR 3D` 팝오버를 찾아 열어 지명/좌표를 입력해야 하며, 팝오버 안에는 전문가가 아니면 채우기 어려운 `진앙 위도·경도·규모·깊이` 입력창까지 함께 노출되어 있음.
