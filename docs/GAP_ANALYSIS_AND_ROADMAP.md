# GAP_ANALYSIS_AND_ROADMAP.md
> SEISMOLIVE 제품 방향성 통합 갭 분석 및 우선순위 로드맵

---

## 1. 현재 구현 vs 최종 비전 갭(Gap) 요약

최근 범용 위치 엔진 리팩토링으로 **하부 코어(7개 프로바이더, 수계/교량 회피 A* 라우팅, 데이터 부족 지역 정직 표기, 타임라인 스크러버)** 는 견고하게 구축되었다.  
하지만 제품 전체 경험(`GLOBAL EARTH → EARTHQUAKE → LOCAL SPACE → HUMAN RESPONSE`)의 관점에서는 **상부 연결층과 UX 진입 구조**에 4가지 근본 갭이 남아 있다.

1. **여정 단절**: 지구본에서 지진을 보고 있어도 해당 지진 맥락을 들고 지역 대응 단계로 이어갈 UI·데이터 다리가 없다.
2. **초기 진입의 한양대 귀속**: 실험실이 "내 위치 기준 / 자유 모드"로 시작하지 않고 여전히 한양대 212동(3층 301호) 및 개발자 타임라인(`T+0s..110s`, `P3.1`) 상태로 부팅된다.
3. **수동 시나리오 설정**: 사용자가 진앙 위도·경도·규모·깊이를 직접 입력하는 UI가 팝오버에 들어 있고, 위치/지역 기반 자동 지진 매칭(`AutoScenarioResolver`)이 미완성이다.
4. **기구현 과학 데이터의 단절**: 지구본 도시에 이미 구현된 USGS ShakeMap/OAF 브리지(`UsgsOfficialProductsBridge.js`)와 관측 파형(`StationWaveformBridge.js`)이 지역 대응 엔진의 위험 판단에 연결되지 않고, 대신 `0.08g`/`0.22g` 하드코딩 모션 값이 쓰이고 있다.

---

## 2. 우선순위별 통합 개발 로드맵

### 🔴 CRITICAL — 전체 경험의 연결을 막는 문제

#### [C-1] 지구본 선택 지진 → 지역 대응 연속 진입 파이프라인 연결
* **현재 갭**: [UnifiedControlSurface.js](file:///Users/katsina/Downloads/earth/js/ui/UnifiedControlSurface.js#L121-L138)의 `updateGlobalDevLabVisibility()`가 `EXPLORE` 유휴 상태 외에는 실험실 진입 UI를 숨겨버린다. `#view-selected` 및 `#view-performance` ([index.html](file:///Users/katsina/Downloads/earth/index.html#L305-L358))에 **"이 지진으로 지역 대응 분석"** 버튼이 없어 선택한 지진이 전달되지 않는다.
* **기존 코드 재사용**:
  - `UnifiedControlSurface`의 `this.selectedEvent` / `appContext.currentParsedEvent` 보존
  - `window.enterInSceneLocalResponse`, [ExhibitionModeManager.js](file:///Users/katsina/Downloads/earth/js/ui/ExhibitionModeManager.js#L197-L255), [main.js](file:///Users/katsina/Downloads/earth/js/main.js#L532-L544) 단일 캔버스 전환 재사용
* **수정 범위**: [index.html](file:///Users/katsina/Downloads/earth/index.html), [UnifiedControlSurface.js](file:///Users/katsina/Downloads/earth/js/ui/UnifiedControlSurface.js), [ExhibitionModeManager.js](file:///Users/katsina/Downloads/earth/js/ui/ExhibitionModeManager.js), [EvacuationExperienceController.js](file:///Users/katsina/Downloads/earth/js/ui/EvacuationExperienceController.js)
* **구체 작업**:
  1. `#view-selected` 및 `#view-performance` 액션 바에 **`지역 대응 시뮬레이션 →`** 버튼 추가.
  2. 클릭 시 현재 선택된 `NormalizedEarthquakeEvent`(좌표·규모·깊이·출처·detail)를 넘기며 `enterInSceneLocalResponse` 호출.
  3. 로컬 진입 시 `진앙 주변 분석` 또는 `내 GPS 위치 기준 영향 확인`을 즉시 선택/적용.
* **선행 조건**: 없음(기존 `ActiveHazardContext` 직렬화 포맷만 통일).
* **검증 방법**:
  - 지구본에서 USGS 지진(예: 경주 M5.8 또는 실시간 태평양/한반도 지진) 선택 → 상세/공연 진입 → 지역 대응 버튼 클릭 → 동일한 사건 제목·진앙·거리가 로컬 HUD에 그대로 반영되고 서울 vs 경주 위치에 따라 `OUTSIDE_IMPACT_ZONE` vs `IN_IMPACT_ZONE`이 다르게 분기되는지 Headless Chrome E2E 검증.

#### [C-2] 한양대 기본 부팅 제거 및 '내 위치 기준 / 자유 모드' 2-트랙 진입 관문 구현
* **현재 갭**: [EvacuationExperienceController.js](file:///Users/katsina/Downloads/earth/js/ui/EvacuationExperienceController.js#L319-L360) 생성자가 `HANYANG_LOCAL_4KM_PACKAGE` + `BLDG_212_ENG1`(3층 301호)을 무조건 부팅하며, 초기 화면에서 "내 위치 / 자유 모드" 선택 흐름이 없고 하단에 한양대 3개 건물 버튼이 기본 노출된다.
* **기존 코드 재사용**:
  - `SpatialDataProviders.js`의 `LocationProvider.detectBrowserLocation()` 및 `parseCoordinateInput()` 100% 재사용
  - `NationwideKoreaSpatialEngine.js`의 `geocodeKoreaQuery()` 및 `loadRegionalSpatialPackage()` 재사용
* **수정 범위**: [EvacuationExperienceController.js](file:///Users/katsina/Downloads/earth/js/ui/EvacuationExperienceController.js), [css/evacuation.css](file:///Users/katsina/Downloads/earth/css/evacuation.css)
* **구체 작업**:
  1. 지구본 사건 없이 실험실에 직접 진입할 때 **2-트랙 진입 오버레이**(`A. 내 위치 기준` / `B. 자유 모드: 지역·주소 검색 또는 지도 선택`) 표시.
  2. 두 모드 모두 동일한 `loadRegionalSpatialPackage(anchorLat, anchorLon)` 파이프라인으로 진입하도록 통합.
  3. 초기 UX에서 층수/호실/내부방 입력 요소 및 한양대 기본 3개 건물 프리셋 강제 노출 제거 (한양대 지역이 실제로 선택된 경우에만 보조 프리셋 허용 또는 개발자 실험실 서랍 내부로 격리).
  4. `LocationProvider` 권한 거부 시 즉시 자유 모드 검색창으로 매끄럽게 폴백.
* **선행 조건**: 없음.
* **검증 방법**: E2E에서 (1) Geolocation 허용 모의 시 현위치 기준 로딩, (2) Geolocation 거부 모의 시 자유 모드 전환 및 지명 검색 후 정상 분석, (3) 초기화 직후 212동 3층 301호 강제 문구가 노출되지 않는지 검증.

#### [C-3] 지진 시나리오 자동화 엔진 (`AutoScenarioResolver`) 구축 및 수동 진앙 입력창 제거
* **현재 갭**: 현재 [EvacuationExperienceController.js](file:///Users/katsina/Downloads/earth/js/ui/EvacuationExperienceController.js#L121-L133) 팝오버에 `#custom-epi-lat`, `#custom-epi-lon`, `#custom-mag`, `#custom-depth` 수동 입력 폼이 노출되어 있고, 비(非)벤치마크 좌표는 무조건 `lat+0.032, lon+0.045, M5.2` 고정값만 반환한다([NationwideKoreaSpatialEngine.js](file:///Users/katsina/Downloads/earth/js/response/NationwideKoreaSpatialEngine.js#L820-L832)).
* **기존 코드 재사용**:
  - `HazardProvider.createScenario()`, `evaluateRegionalHazard()`, `PRESET_EARTHQUAKE_SCENARIOS`, `HISTORICAL_EVENTS`, `INSTRUMENTAL_EVENTS`, `usgsFeedConnector` 재사용.
* **수정 범위**: [SpatialDataProviders.js](file:///Users/katsina/Downloads/earth/js/response/SpatialDataProviders.js), [NationwideKoreaSpatialEngine.js](file:///Users/katsina/Downloads/earth/js/response/NationwideKoreaSpatialEngine.js), [EvacuationExperienceController.js](file:///Users/katsina/Downloads/earth/js/ui/EvacuationExperienceController.js)
* **구체 작업**:
  1. `AutoScenarioResolver.resolveForLocation(anchor, catalog, spatialPkg)` 구현:
     - (우선순위 1) 지구본에서 전달된 `ActiveHazardContext` 유지
     - (우선순위 2) 통합 관측 카탈로그(KMA+USGS) 중 반경/영향권 내 최근 실제 지진 자동 연결
     - (우선순위 3) 해당 권역의 대표 과거 실측 지진(예: 경주 2016, 포항 2017, 부안 2024) 또는 지질·해안/도심 맥락 기반 **`EDUCATIONAL_SYNTHETIC` 시나리오** 자동 생성 + 선정 이유(`selectionReasonKo`) 생성
  2. UI에서는 수동 위경도/규모/깊이 입력 폼을 기본 화면에서 제거하고 **`[실제 지진 기록]` ↔ `[교육용 시나리오]`** 전환 컨트롤과 선정 이유 설명 1줄만 노출.
* **선행 조건**: `[C-1]`, `[C-2]`.
* **검증 방법**: 전국 다수 지역(경주·속초·서울 강남·제주·설악산) 입력 시 사용자 추가 조작 없이 지역 맥락에 맞는 실제/교육용 시나리오가 자동 선정되고 출처 배지(`OBSERVED` vs `SYNTHETIC` vs `HISTORICAL`)와 이유가 일관되게 표시되는지 단위·E2E 테스트.

---

### 🟠 HIGH — 핵심 기능의 정확성과 범용성을 저해하는 문제

#### [H-1] USGS 공식 산출물(ShakeMap/OAF) & 관측 파형 연계 및 가짜 PGA 하드코딩 제거
* **현재 갭**: [UsgsOfficialProductsBridge.js](file:///Users/katsina/Downloads/earth/js/data/UsgsOfficialProductsBridge.js)가 `GeophysicsFolioView`에서만 사용되고 로컬 대응 엔진과 단절됨. 반면 `ResponseUIAdapter` 생성자([ResponseUIAdapter.js](file:///Users/katsina/Downloads/earth/js/response/ResponseUIAdapter.js#L110-L120))와 `EvacuationExperienceController`([EvacuationExperienceController.js](file:///Users/katsina/Downloads/earth/js/ui/EvacuationExperienceController.js#L455))는 `0.08g / 0.01g / 0.22g` 하드코딩 모션을 주입함.
* **기존 코드 재사용**: `extractOfficialUsgsProducts()`, `parseShakeMapMmiContours()`, `StationWaveformBridge.js`의 `computePacketPeakMetrics()` 재사용.
* **수정 범위**: [SpatialDataProviders.js](file:///Users/katsina/Downloads/earth/js/response/SpatialDataProviders.js), [ResponseUIAdapter.js](file:///Users/katsina/Downloads/earth/js/response/ResponseUIAdapter.js), [EvacuationExperienceController.js](file:///Users/katsina/Downloads/earth/js/ui/EvacuationExperienceController.js), [LocalSpatialMapLayer.js](file:///Users/katsina/Downloads/earth/js/response/LocalSpatialMapLayer.js)
* **구체 작업**:
  1. `ResponseUIAdapter` 초기 상태를 관측소 실측 없음(`station: null`, `provenance: UNKNOWN`) 또는 활성 시나리오 단계 기반으로 분리해 실제 관측 PGA로 오인되지 않게 교정.
  2. USGS detail 내 `shakemap` / `oaf`가 존재할 경우 `HazardProvider`에 전달하여 영향권 판단 및 `LocalSpatialMapLayer` 등진도/경계 참고에 반영(단, 공식 산출물이 없으면 `null` 유지 원칙 준수).
* **선행 조건**: `[C-1]`.
* **검증 방법**: ShakeMap 포함 Mock/실제 USGS JSON 전달 시 로컬 엔진에 MMI 참고값이 전파되고, 없는 사건에서는 `null` 보존 및 모델 한계 경고가 유지되는지 단위 테스트.

#### [H-2] `SeismicImpactContext.resolveActiveSeismicEvent()` 한양대 고정 앵커 제거 & 기관 간 지진 중복 병합
* **현재 갭**: [SeismicImpactContext.js](file:///Users/katsina/Downloads/earth/js/response/SeismicImpactContext.js#L110)가 `options.anchor` 미전달 시 `DEFAULT_LOCAL_ANCHOR_COORDS`(한양대)를 쓰고 `usgs_4.5_month.geojson`을 매번 fetch한다. [usgsFeedConnector.js](file:///Users/katsina/Downloads/earth/js/data/usgsFeedConnector.js#L205)는 ID 문자열만 비교해 KMA-USGS 동일 사건을 중복 제거하지 못한다.
* **기존 코드 재사용**: `geodesicDistanceKm`([SpatialDataProviders.js](file:///Users/katsina/Downloads/earth/js/response/SpatialDataProviders.js)), `INSTRUMENTAL_EVENTS`, `usgsFeedConnector`.
* **수정 범위**: [SeismicImpactContext.js](file:///Users/katsina/Downloads/earth/js/response/SeismicImpactContext.js), [usgsFeedConnector.js](file:///Users/katsina/Downloads/earth/js/data/usgsFeedConnector.js)
* **구체 작업**:
  1. `resolveActiveSeismicEvent()` 호출 시 현재 `analysisAnchor`를 필수 전달받도록 정리하고 글로벌 캐시된 통합 카탈로그를 직접 참조.
  2. `buildUnifiedMasterCatalog()`에 시공간 매칭(`|Δt|<=120s`, 거리 `<=50km`, `|ΔM|<=1.0`) 기반 기관 중복 통합 및 KMA/USGS 출처 병합 로직 구현.
* **선행 조건**: 없음.
* **검증 방법**: 2016 경주/2017 포항 동일 시공간 이중 레코드 입력 시 1건으로 통합되며 두 출처가 `alternateSources`에 보존되는지 단위 테스트.

#### [H-3] 동적 분석 범위 4km 이상 확장 & 개발자 전용 디버그 UI 격리
* **현재 갭**: OSM 조회가 900m→2000m(4km 영역)까지만 확장되어 외곽/농어촌에서 인근 대피 후보가 2.5~3.5km 거리에 있으면 탐색 범위 밖으로 누락될 수 있다. 또한 `EvacuationExperienceController` 상단 캡슐에 `개발자 실험실 ▾`(`T+0s/40s/67s/110s`, `P3.1 0/6`, `3F 실내 진입`)이 일반 사용자와 같은 위계로 노출되어 있다.
* **기존 코드 재사용**: `NationwideKoreaSpatialEngine.fetchOsmRegionElements()`, Overpass QL 쿼리.
* **수정 범위**: [NationwideKoreaSpatialEngine.js](file:///Users/katsina/Downloads/earth/js/response/NationwideKoreaSpatialEngine.js), [EvacuationExperienceController.js](file:///Users/katsina/Downloads/earth/js/ui/EvacuationExperienceController.js)
* **구체 작업**:
  1. 1차(900m) → 2차(2000m) 후에도 시설/보행연결 후보가 부족할 경우 Overpass 필터링 경량 쿼리로 최대 3.5~4km 반경(시설·주요 도로 중심) 3차 확장 지원.
  2. `T+0..110s`, `P3.1` 체크리스트 등 개발/연구자용 검증 도구는 URL 파라미터(`?dev=1`) 또는 접힌 실험실 메뉴 깊숙이로 분리해 일반 대응 경험이 대시보드처럼 보이지 않게 정제.
* **선행 조건**: `[C-2]`.
* **검증 방법**: 2km 밖 학교/공설운동장만 존재하는 교외 OSM 픽스처에서 3차 확장 후 정상 연결되는지 단위 테스트.

#### [H-4] 공식 대피소 데이터 연동 어댑터 마련 (`CONFIRMED` 승격 경로)
* **현재 갭**: 현재 한양대 외 전국 모든 지역은 OSM 공원·학교·집결지 태그에만 의존해 `CONDITIONAL`로만 표시된다.
* **기존 코드 재사용**: `FacilityProvider.discoverAndEvaluateCandidates()`의 다차원 평가 프레임워크 그대로 유지.
* **수정 범위**: [SpatialDataProviders.js](file:///Users/katsina/Downloads/earth/js/response/SpatialDataProviders.js), 정적/API 공용 어댑터 신설(필요 시)
* **구체 작업**:
  1. `OfficialShelterCatalogProvider` 인터페이스 정의 (행안부 지진옥외대피장소 스냅샷 JSON 또는 공공 API 응답 매핑).
  2. 매칭되는 공식 대피소는 `CONFIRMED`(수용인원·지정번호 포함)로 표기하고, 미매칭 OSM 공터는 기존처럼 `CONDITIONAL` 유지.
* **선행 조건**: 공공 대피소 JSON 정제 데이터셋 또는 CORS 가능 엔드포인트 확보.
* **검증 방법**: 경주/속초 공식 대피소 샘플 데이터 주입 시 공식 대피소와 일반 공원의 배지/우선순위가 정확히 구분되는지 검증.

---

### 🟡 MEDIUM — 경험 완성도와 UX를 높이는 문제

#### [M-1] Global → Local 카메라 하강 연속성 및 지형 시각 언어 통일
* **현재 갭**: [main.js](file:///Users/katsina/Downloads/earth/js/main.js#L532-L544)에서 `startDescentFlight()` 종료 후 즉시 global 오브젝트를 숨기고 `localWorldGroup`을 켜기 때문에 짧은 컷 전환 느낌이 남는다.
* **기존 코드 재사용**: [FlightController.js](file:///Users/katsina/Downloads/earth/js/3d/FlightController.js), [GlobalLocalCameraTransition.js](file:///Users/katsina/Downloads/earth/js/response/GlobalLocalCameraTransition.js), [LocalSpatialMapLayer.js](file:///Users/katsina/Downloads/earth/js/response/LocalSpatialMapLayer.js).
* **수정 범위**: [main.js](file:///Users/katsina/Downloads/earth/js/main.js), [ExhibitionModeManager.js](file:///Users/katsina/Downloads/earth/js/ui/ExhibitionModeManager.js)
* **구체 작업**: 강하 비행 마지막 25% 구간에서 로컬 지형 메쉬 페이드-인/고도 맞춤 및 카메라 피치·방위 연속 보간 적용. 또한 `LOCAL` 복귀 시 지구본 상의 해당 사건 상태를 유지한 채 돌아가거나 궤도로 매끄럽게 상승.
* **선행 조건**: `[C-1]`.
* **검증 방법**: 브라우저 E2E에서 프레임 캡처로 강하→로컬 전환 시 튐/깜빡임 없이 전환되는지 시각 점검.

#### [M-2] 사용자 위치 마커와 주변 출발 건물 외곽의 시각/상태 분리
* **현재 갭**: `compileOsmJsonToSpatialPackage`의 `pickDefaultOriginBuilding`이 분석 중심 근처의 명명된 건물을 자동으로 출발 건물(`내 위치 · ○○상가`)로 잡는 경우가 있어, 섹션 2.3("주변 건물이 사용자 현재 위치라고 단정하지 말 것")과 어긋날 수 있다.
* **기존 코드 재사용**: [SpatialDataProviders.js](file:///Users/katsina/Downloads/earth/js/response/SpatialDataProviders.js), [LocalSpatialMapLayer.js](file:///Users/katsina/Downloads/earth/js/response/LocalSpatialMapLayer.js).
* **수정 범위**: [NationwideKoreaSpatialEngine.js](file:///Users/katsina/Downloads/earth/js/response/NationwideKoreaSpatialEngine.js), [LocalSpatialMapLayer.js](file:///Users/katsina/Downloads/earth/js/response/LocalSpatialMapLayer.js), [EvacuationExperienceController.js](file:///Users/katsina/Downloads/earth/js/ui/EvacuationExperienceController.js)
* **구체 작업**: GPS/자유 지정 좌표는 기본 출발점을 **`지정 위치(야외 보행망 접속점)`** 으로 설정하고, 사용자가 3D 건물을 **직접 클릭해 선택했을 때만** 해당 건물 외곽 출발 모드로 전환.
* **선행 조건**: `[C-2]`.
* **검증 방법**: 임의 좌표 로딩 시 특정 상가 건물 내부에 있다고 단정하지 않고 분석 기준점(핀)에서 가장 가까운 도로 노드로 출발 경로가 연결되는지 확인.

#### [M-3] `index.html` 단일 캔버스와 `viewer_p2_6.html` 진입 규약 일원화
* **현재 갭**: [viewer_p2_6.html](file:///Users/katsina/Downloads/earth/viewer_p2_6.html#L94)이 여전히 `initialEventId: requestedEventId || 'hist_1681_0626'`로 열리며 URL 파라미터 전달(`lat`, `lon`, `mode`)이 불완전하다.
* **기존 코드 재사용**: `EvacuationExperienceController` 공유 구조 그대로 유지.
* **수정 범위**: [viewer_p2_6.html](file:///Users/katsina/Downloads/earth/viewer_p2_6.html), [index.html](file:///Users/katsina/Downloads/earth/index.html)
* **구체 작업**: `viewer_p2_6.html` 기본 하드코딩 이벤트 제거 및 동일한 `MY_LOCATION / FREE_MODE` 파라미터(`?lat=&lon=&event=`) 지원.
* **선행 조건**: `[C-1]`, `[C-2]`.
* **검증 방법**: `viewer_p2_6.html?lat=35.8347&lon=129.2190&event=hist_2016_gyeongju` 직접 오픈 시 1681 양양 없이 즉시 경주 M5.8 분석 화면으로 열리는지 확인.

---

### 🟢 LATER — 추후 확장 기능

#### [L-1] 기상청(KMA) 실시간 지진속보/API 프록시 연동
* CORS 제약으로 브라우저 직접 호출이 어려운 KMA 공공데이터포털 OpenAPI를 Cloudflare Workers/Pages Functions 경유 정규화 엔드포인트로 연결해 `ActiveHazardContext`의 실시간 국내 사건 커버리지를 확장한다.

#### [L-2] 공인 실내 공간 도면 확장 (Optional Schema)
* 현재 UX에서 제외한 층·방·비상계단 안내는 향후 공공/학교 시설물의 공식 실내 공간정보(IndoorGML/BIM)가 `INDOOR_SPATIAL_SCOPE.VERIFIED_INDOOR` 등급으로 확보되는 시설에 한해 선택적으로 활성화할 수 있도록 스키마만 보존한다.

#### [L-3] 여진·낙하물 동적 위험 구역 기반 다중 대피소 재분배
* `AvoidPolygon`과 `OAF(USGS 여진 확률)`를 결합해 주 경로 차단 시 실시간 대체 대피소 재탐색 및 야외 체류 가능 면적 안내를 고도화한다.

---

## 3. 권장 통합 개발 순서 (Phased Execution Plan)

1. **1단계 (연결 복구 — Critical C-1, C-2, M-2)**: 지구본 사건 선택 → 로컬 엔진 데이터 전달 다리 연결 + 실험실 첫 진입을 `내 위치 / 자유 모드` 2트랙으로 재구성 + 한양대 212동/층수 기본 가정 제거.
2. **2단계 (지진 시나리오 자동화 & 과학 데이터 결합 — Critical C-3, High H-1, H-2)**: `AutoScenarioResolver` 적용, 수동 진앙 입력창 격리, `UsgsOfficialProductsBridge` 및 `CrossAgencyDeduplicator` 통합, 가짜 PGA 하드코딩 제거.
3. **3단계 (반경 확장 & 시각 연속성 완성 — High H-3, H-4, Medium M-1, M-3)**: 4km+ 외곽 시설 확장 쿼리, 행안부 대피소 스냅샷 연동, 지구본→로컬 카메라/지형 연속 트랜지션 및 통합 E2E 검증.
