# SEISMOLIVE — Architecture Integration Plan
## 기존 시스템 실제 현황 대조 · 4km 지역 공간맵 엔진 전략(A/B/C) 비교 · 글로벌-로컬 통합 아키텍처

**작성일**: 2026-11-16  
**목표**: SEISMOLIVE의 실제 현재 코드베이스(Phase 3 `R1→R2→R3` 커밋 `bcef2d8` 이후 기준)를 정확히 진단하고, 글로벌 지구 경험(`index.html`)을 훼손하지 않으면서 일반화된 4km+ 지역 공간맵 및 개인화 지진 대응을 통합하는 최적 기술 아키텍처를 확정한다.

---

## 1. 기존 SEISMOLIVE 시스템 실사 및 과거 문서 대비 검증 (Section 6)

과거 보고서([`docs/CURRENT_STATUS.md`](file:///Users/katsina/Downloads/earth/docs/CURRENT_STATUS.md), 2026-11-06 교정본)의 설명을 그대로 믿지 않고, 실제 현재 저장소 파일과 진입점·모듈 의존성을 직접 검증한 결과는 다음과 같다.

### 1.1 과거 보고서 vs. 실제 현재 코드베이스 차이점
1. **엔진 런타임 및 진입점 변화 (해소 완료)**:
   - 과거 보고서는 `prototype_g2_continuous_seismic_world.html` + `three.min.js` UMD를 주 진입점으로 서술했으나, 실제 현재 저장소에서는 `prototype_g2_continuous_seismic_world.html`이 `archive/legacy_prototypes/`로 격리되었고, 배포 주 진입점 [`index.html`](file:///Users/katsina/Downloads/earth/index.html) → [`js/main.js`](file:///Users/katsina/Downloads/earth/js/main.js)(2,739행)이 **완전한 ES 모듈(`type="module"`)** 로 동작한다.
   - 과거에 지적되었던 **UMD `three.min.js` vs ESM `three.module.js` 이중 런타임 문제**는 [`js/lib/three-runtime.js`](file:///Users/katsina/Downloads/earth/js/lib/three-runtime.js) 및 [`js/lib/OrbitControls.module.js`](file:///Users/katsina/Downloads/earth/js/lib/OrbitControls.module.js) 도입으로 **이미 단일 `three.module.js` 런타임으로 통일**되었다.
2. **듀얼 실행 트리(글로벌 vs 지역 대응) 잔존 (현재 사실)**:
   - 글로벌 지진 전시([`index.html`](file:///Users/katsina/Downloads/earth/index.html))와 개인화 건물 대응([`viewer_p2_6.html`](file:///Users/katsina/Downloads/earth/viewer_p2_6.html))은 여전히 **두 개의 분리된 HTML 실행 진입점**이다. 다만 이제 양쪽 모두 동일한 `three.module.js` ESM 런타임을 공유하므로 통합 장애물 하나가 제거된 상태다.
3. **유령 유니폼 버그 발견 (`js/main.js` vs `SeismicTerrainShaders.js`)**:
   - [`js/main.js`](file:///Users/katsina/Downloads/earth/js/main.js)(867–870행, 1824–1830행)는 `GeophysicsFolioView`의 T-X 주시곡선 호버에 맞춰 `terrainUniforms.u_probeDistUnits`, `u_probeCritUnits`, `u_probeCrossUnits`, `u_purePhysicalMode` 값을 갱신하고 있으나, 실제 셰이더 파일([`js/3d/shaders/SeismicTerrainShaders.js`](file:///Users/katsina/Downloads/earth/js/3d/shaders/SeismicTerrainShaders.js) 448–576행)의 `REGIONAL_TERRAIN_FRAGMENT_SHADER`에는 **해당 4개 uniform 선언과 렌더링 로직이 누락**되어 있어 현재 3D 지형 위 프로브 고리가 그려지지 않는다.
4. **지하 카메라 관통 방지 가드 범위 제한**:
   - [`js/main.js`](file:///Users/katsina/Downloads/earth/js/main.js) 2658행의 지표면 클램핑은 `PERFORMANCE`/`CODA` 상태에만 걸려 있어 `DESCEND`/`ASCEND` 자동 비행 중 저고도 산악 스침 가능성이 남아 있으며, [`GlobalLocalCameraTransition.js`](file:///Users/katsina/Downloads/earth/js/response/GlobalLocalCameraTransition.js) 227–233행의 고도 클램핑은 `CAMPUS_OVERVIEW`/`BUILDING_INSPECTION`/`PERSONAL_LOCATION`에는 적용되나 `REGIONAL_APPROACH`에는 명시되어 있지 않다.
5. **대응 모듈 13종의 실제 구현 및 결합 상태 (전수 확인 완료)**:
   - [`ResponseDomainTypes.js`](file:///Users/katsina/Downloads/earth/js/response/ResponseDomainTypes.js) 도입과 `FacilityPackage` 의존성 주입 리팩터링(Phase 3 R1)으로 엔진 계층(`ResponseStateMachine`, `SituationAssessmentEngine`, `GroundDataContract`, `PedestrianRoutingEngine`, `PersonalResponseInteraction`, `ResponseUIAdapter`, `GlobalLocalCameraTransition`, `HanyangResponseAdapter`, `ResponseTimelineSimulator`)은 **한양대 212동 하드코딩과 수학적으로 분리 완료**되었다.
   - 단, `viewer_p2_6.html` UI 문구("제1공학관", "한양대학교 대운동장")와 `SituationAssessmentEngine.js` 271행 등 일부 문자열, 그리고 **실제 4km 주변 도시·지형·다중 건물 컨텍스트 데이터**는 아직 한양대 단일 파일럿 수준에 머물러 있다.

### 1.2 기능별 현재 상태 정밀 분류 (6단계 의무 분류)

| 기능 / 역량 | 현재 모듈 근거 | 판정 분류 | 상세 진단 |
| :--- | :--- | :---: | :--- |
| **WGS84 타원체 ↔ ECEF ↔ ENU ↔ Three.js 연속 좌표계** | `geodeticEllipsoidCoord.js`, [`LocalTangentAnchor.js`](file:///Users/katsina/Downloads/earth/js/response/LocalTangentAnchor.js) | **이미 구현됨** | Float64 타원체 연산과 중심 상대 원점(Float32 오차 `<0.05m`), 17개 단위 테스트 통과 |
| **3-Tier 실측 DEM/해저지형 & 3D P/S/Rayleigh 변위장** | `terrainDataResolver.js`, `EventTerrainCatalog.js`, `universalWavefieldEngine.js` | **이미 구현됨** | Copernicus 30m + NOAA ETOPO 2022 무봉 접합, 유한단층·Q감쇠·타원율 1.47 실물리 전파 |
| **한국어 사료 의미 파싱 & 3D 리빙 타이포그래피 · 사운드스케이프** | `ArchivalSemanticParser.js`, `livingMemoryEngine.js`, `LivingSoundfieldEngine.js` | **이미 구현됨** | 한자 배제 순수 한국어 단어, 6단계 생명주기, 5종 사건별 Web Audio 공명 합성기 |
| **시설 독립적 재난 상태머신 · 상황평가 · 데이터 신뢰도 계약 · PGA 히스테리시스** | `ResponseDomainTypes.js`, `ResponseStateMachine.js`, `SituationAssessmentEngine.js`, `GroundDataContract.js` | **이미 구현됨** | `0.05g` 발동/`0.02g+10s` 해제, `OBSERVED_STATION`/`PROVISIONAL` 구분, 사람 승인 게이트 |
| **단일 건물·보행 경로·동적 우회 재탐색 (`FacilityPackage` DI)** | `HanyangBuildingData.js`, `PedestrianRoutingEngine.js`, `HanyangResponseAdapter.js`, `IndoorOutdoorConnector.js` | **구현되어 있으나 개선 필요** | 단일 건물 파일럿은 작동하나 **4km 주변 건물/도로/지반 컨텍스트 부재**, `avoid_polygons` 면단위 회피 미구현 |
| **궤도→지역 카메라 연속 전환 & 지하 관통 방지** | `FlightController.js`, `js/main.js`, [`GlobalLocalCameraTransition.js`](file:///Users/katsina/Downloads/earth/js/response/GlobalLocalCameraTransition.js) | **구현되어 있으나 개선 필요** | `viewer_p2_6.html`에서는 아직 와이어프레임 지구본을 사용하며 `index.html` 실제 지구본과 **단일 경험으로 연결되지 않음**; 비행 중 클램핑 보강 필요 |
| **T-X 주시곡선 3D 지형 프로브 연동** | `js/main.js`, `GeophysicsFolioView.js`, `SeismicTerrainShaders.js` | **부분 구현** | JS 핸들러와 UI 호버는 동작하나 GLSL 프래그먼트 셰이더에 `u_probe*` uniform/렌더링이 빠져 있어 시각 미표출 |
| **약 4km(및 가변 확장) 지역 3D 공간맵 패키지(지형·건물·도로·다중 시설)** | `viewer_p2_6.html` 바닥 그리드만 존재 (`GridHelper`) | **설계만 존재함** (또는 미구현) | `P0.1` 보고서에 개념 조사만 있고 실제 4km 건물 OBB/도로망/하천/다중 대피소 3D 레이어가 없음 |
| **글로벌(`index.html`) ↔ 로컬 공간맵(`4km+`) 단일 사용자 흐름 연결** | `index.html` ↔ `viewer_p2_6.html` 완전 분리 | **설계만 존재함** | 두 뷰어를 잇는 URL 브릿지나 통합 공간 전환 계층이 현재 부재 |
| **휠체어 전용 진동 중 대응(`Lock, Cover, Hold On`)** | `SituationAssessmentEngine.js` (이동 경로만 구분) | **부분 구현** | 경로 탐색(`WHEELCHAIR`)은 구분되나 진동 중(`S1_SHAKING`) 행동 지침에 바퀴 잠금 프로토콜 누락 |
| **실측 지진파 이중대역 스테레오 청각화 (`SEIS-SOUND` + `Earthtunes` 방식)** | `StationWaveformBridge.js` (파형 브리지), `LivingSoundfieldEngine.js` | **새롭게 도입할 가치 있음** | 기존 전시 음향을 보완해 계측 사건 상세 패널에서 실제 관측 파형을 직접 소리로 변환·재생 |
| **공식 USGS ShakeMap 등진도(`cont_mmi.json`) & OAF 여진 확률 연동** | `usgsFeedConnector.js` (목록 피드만 수신) | **새롭게 도입할 가치 있음** | 공인 계측·모델 산출물만 선택적 표기 (Tremor의 자체 MMI 공식은 도입 제외) |
| **화면 공간 HUD 회피 AABB 충돌 제거 라벨러 & X-Ray 주변 건물 투시** | 미구현 (`Mini Seoul` / `S-Map` 기법) | **새롭게 도입할 가치 있음** | 4km 도심 밀집 환경에서 대피소/건물 라벨 시인성과 1층 출구 가시성 확보에 필수 |
| **CesiumJS / MapLibre+deck.gl 전면 교체, Tremor식 가짜 GMPE, 합성 실내 도면** | — | **도입할 필요 없음** | 기존 셰이더/좌표계 자산 파괴, 저사양 WebGL 컨텍스트 충돌, `GEMINI.md` 과학 윤리 위반 |

---

## 2. 지역 공간맵 렌더링 엔진 전략 비교: A vs. B vs. C (Section 7)

약 4km 반경(필요 시 8~12km 확장)의 지역 3D 공간맵을 SEISMOLIVE에 통합하는 세 가지 후보 아키텍처를 11개 공학 기준으로 비교한다.

- **후보 A (Three.js 중심 확장)**: 기존 `three-runtime.js` 기반 Three.js 단일 WebGL 씬 위에서 지형 DEM 메쉬 + 사전 빌드 바이너리 OBB 건물(`InstancedMesh`) + 도로/보행 폴리라인 + HTML 충돌회피 라벨을 직접 렌더링.
- **후보 B (MapLibre 기반 지역 지도)**: 지역맵 단계로 들어가면 MapLibre GL JS (또는 MapLibre + deck.gl) WebGL 인스턴스를 띄워 벡터 타일/건물 압출을 처리하고, 글로벌 Three.js와 별도 캔버스/뷰로 전환.
- **후보 C (하이브리드 구조 — Three.js 단일 WebGL 코어 + 타일형 정적 벡터/OBB 공간엔진)**: 렌더링 캔버스와 WebGL 컨텍스트는 Three.js 하나로 단일화(`Seoul 3D Atlas` + `Mini Seoul` 패턴)하되, 데이터 계층은 3km 타일 단위로 분할·스트리밍되는 독립적 공간 데이터/LOD/라벨/라우팅 엔진으로 관리(글로벌↔로컬 카메라·좌표 100% 연속).

### 11개 기준 정량·정성 비교표

| 평가 기준 | 전략 A: 순수 Three.js 단일 확장 | 전략 B: MapLibre (+deck.gl) 분리/오버레이 | 전략 C: 하이브리드 (Three.js 단일 WebGL + 타일 공간엔진) | 판단 근거 |
| :--- | :---: | :---: | :---: | :--- |
| **1. 기존 코드 재사용성** | 매우 높음 (100%) | 낮음 (`ResponseAdapter`, `LocalTangentAnchor` 등 재작성/이중 어댑터) | **매우 높음 (100%)** | 기존 [`HanyangResponseAdapter`](file:///Users/katsina/Downloads/earth/js/response/HanyangResponseAdapter.js)와 [`SeismicTerrainShaders`](file:///Users/katsina/Downloads/earth/js/3d/shaders/SeismicTerrainShaders.js) 그대로 결합 |
| **2. 글로벌-지역 전환 자연스러움** | 높음 | **낮음 (화면 전환/프로젝션 점프 발생)** | **최상** | 전략 B는 WGS84 구면→Web Mercator 평면 투영 간 시점 튐(Jump cut) 및 스타일 불일치 발생 |
| **3. 좌표계 일관성 (`WGS84→ENU`)** | 높음 | 중간 (WGS84 ↔ Mercator 재투영 오차 및 고도 스케일 차이) | **최상 (단일 ENU 미터 공간)** | [`LocalTangentAnchor`](file:///Users/katsina/Downloads/earth/js/response/LocalTangentAnchor.js)가 전 지형·건물·보행망·실내 좌표를 동일 미터계로 통일 |
| **4. 렌더링 성능 (드로우콜/FPS)** | 높음 | 높음 (단, 동시 2개 엔진 시 하락) | **최상 (`InstancedMesh` + 3km 타일 `mesh.count` LOD)** | `Seoul 3D Atlas` 실측처럼 1~4 드로우콜로 수천 동 처리 |
| **5. WebGL 리소스 충돌 가능성** | 낮음 | **높음 (이중 WebGL 컨텍스트 또는 깊이 버퍼 찢어짐)** | **매우 낮음 (단일 WebGL 컨텍스트)** | `kra51-geospatial`에서도 MapLibre+deck.gl 깊이 공유 시 찢어짐 문제 확인됨. 학교 PC 컨텍스트 손실 방지에 전략 C 절대 유리 |
| **6. 메모리 사용량** | 낮음 | 높음 (Three.js + MapLibre 벡터 타일 디코딩 워커 동시 상주) | **낮음 (`buildings.bin` 24B/건물 + 경량 JSON)** | 4km 반경 건물 수천 동을 수백 KB 메모리에 적재 |
| **7. 저사양 학교 PC 호환성** | 높음 | 중간 (외부 타일서버·듀얼 WebGL 부담) | **최상 (오프라인 로컬 패키지 + Eco `overviewCount`)** | 외부 네트워크 장애/방화벽 환경에서도 100% 작동 |
| **8. 데이터 로컬 패키징** | 높음 | 중간 (PMTiles / 자체 스프라이트/글리프 번들링 필요) | **매우 높음 (정적 JSON/BIN 즉시 서빙)** | `.cfignore` 배포 구조에 수백 KB 단위로 자연스럽게 편입 |
| **9. 건물 및 실내 확장성** | 높음 | 낮음 (`fill-extrusion`은 단면/층별 와이어프레임/내부 3D 계단 표현 한계) | **최상 (층 슬래브, 투명 X-Ray, 수직 계단코어 직접 메쉬화)** | MapLibre 2.5D 압출과 달리 다층 실내 그래프(`IMDF`)를 자유롭게 절단·투시 |
| **10. 유지보수 난이도** | 낮음 (단일 엔진) | 높음 (Three.js + MapLibre + GLSL + StyleSpec 이중 스택) | **낮음~중간 (모듈 경계 명확)** | 팀이 하나의 3D 런타임만 유지보수 |
| **11. 구현 시간** | 빠름 | 길음 (두 엔진 카메라/피킹/스타일 동기화 비용) | **빠름 (1차 프로토타입 즉시 구현 가능)** | 이미 3-Tier 지구본과 `HanyangResponseAdapter`가 Three.js ESM으로 준비됨 |

### 최종 전략 결정 및 검증 실험 제안
- **최종 권고: 전략 C (Three.js 단일 WebGL 코어 + 타일형 사전 빌드 지역 공간엔진)**  
  MapLibre를 런타임 렌더링 엔진으로 `index.html`에 끼워 넣지 않는다. 대신 **MapLibre/Mini Seoul/Seoul 3D Atlas의 데이터·시각 설계 역량(오프라인 PBF/OSM 전처리 → 6-float OBB `InstancedMesh` 타일, 누적거리 보간, 2군 레이어 위계, HTML HUD 회피 AABB 라벨러, X-Ray 투시)** 을 SEISMOLIVE의 기존 Three.js + `LocalTangentAnchor` 엔진 안에 통합한다.
- **소규모 사전 검증 실험 (Prototype Gate)**:
  - `HANYANG_BLDG212_ANCHOR` 기준 반경 4km(`±2km` 확장) 지역의 건물·간선도로·하천·다중 대피소 정적 패키지를 구성하고, ① 통합 그래픽/헤드리스 Chromium에서 `InstancedMesh` LOD 전환 속도, ② `OrbitControls` 사선 구도(`pitch 45~66°`)에서 HTML AABB 라벨 충돌 `0`건 달성 여부, ③ `WGS84 → ENU → Three.js` 역변환 거리 오차(`< 0.01m`)를 실측해 전략 C의 타당성을 검증한다.

---

## 3. 글로벌-로컬-개인화 통합 아키텍처 (`Global → Local 4km+ → Building → Indoor → Personal`)

### 3.1 공간 계층 및 좌표 전환 파이프라인
```
[Tier 0 Global Earth]  WGS84 Ellipsoid (1 unit = 100 km)
        │  FlightController 구면 SLERP + ECEF 리앵커링 (threeToECEF / ecefToThree)
        ▼
[Local Anchor Setup]   selectedAnchor = RegionPackage.anchor (예: 성동/왕십리 37.5558°N, 127.0451°E)
        │  LocalTangentAnchor.geodeticToLocalThree(lat, lon, h)  [단위: 실측 ENU 미터]
        ▼
[Local Spatial Map]    초기 반경 4 km (3 km × 3 km 청크 타일 단위, 목적지 초과 시 인접 청크 동적 적재)
  ├── Static Urban Fabric: InstancedMesh OBB 건물(#0A1118), 지형/하천(중랑천), 간선도로망
  ├── Ground Hazards: 충적층 주의 구역(PROVISIONAL), 건물 높이 비례 낙하 반경(avoid_polygons)
  └── Verified Shelters: 공식 지진옥외대피장소(OA-21060), 응급의료기관, 재난지휘소
        │  객체 클릭 선택 → 주변 건물 X-Ray(opacity 0.16) + FacilityPackage 주입
        ▼
[Building & Indoor]    선택 건물 12각 이상 정밀 외곽 + 층별 슬래브 + 수직 코어 + 1F 포털 커넥터
                       (도면 미확보 시 PROVISIONAL 배지 및 점선 와이어프레임 고정)
        │
        ▼
[Personal Response]    SituationAssessmentEngine + ResponseStateMachine + PedestrianRoutingEngine
                       (최단 경로 vs 무단차 우회로 vs avoid_polygons 회피 + 출처/불확실성 배지)
```

### 3.2 일반화(Facility-Agnostic) 및 4km 경계 확장 설계
1. **한양대 종속성 탈피**:
   - 시스템의 최상위 도메인은 "한양대 앱"이 아니라 **`RegionalSpatialPackageRegistry`** 이다.
   - 사용자가 글로벌 지구(`index.html`)에서 한국/특정 도시를 탐색하거나 지역 공간 대응 모드로 진입하면, 등록된 지역 패키지(예: `seoul_seongdong_4km`, 향후 `gyeongju_historic_4km`, `haeundae_coastal_4km` 등)와 시설 패키지(`FacilityPackage`) 목록에서 선택한다. 한양대 제1공학관은 첫 번째 완전 실증 테스트 패키지(`PILOT_FACILITY_BLDG212`)일 뿐이다.
2. **4km 초기 범위의 가변 확장 (Spatial Chunking beyond 4km)**:
   - `Seoul 3D Atlas`의 `Math.floor(east_km / 3) + ',' + Math.floor(north_km / 3)` 타일 인덱스 방식을 채택한다.
   - 초기 로드 시 기준 앵커 중심 `3×3` 또는 `4km` 반경 타일(약 4개~9개 `3km` 타일)을 먼저 올리고, 사용자의 출발지나 선정된 대피 목적지/이동 경로 바운딩 박스가 현재 로드된 타일 밖으로 벗어나면 해당 타일 JSON/BIN 청크만 비동기 추가 로드한다.
3. **공통 Three.js 씬 vs 전환 아키텍처**:
   - `index.html`의 *Living Earth* 경험은 작품 고유의 정적/침묵/시청각 갤러리 무결성을 지켜야 하므로, 기본 Explore/Performance 화면에는 어떠한 재난 대시보드 HUD도 띄우지 않는다.
   - 대신 ① 글로벌 아카이브 도크에 절제된 보조 진입 링크(`지역 공간 대응 (4km)`), ② 향후 `Stage R4` 통합 시에는 동일 WebGL 캔버스 내에서 `GLOBAL_ORBIT → REGIONAL_EARTHQUAKE → LOCAL_SPATIAL_4KM → BUILDING → PERSONAL_RESPONSE` 모드를 전환할 수 있는 `ExhibitionModeManager`로 발전시킨다.

---
*다음 문서: [`VISUAL_DIRECTION_EXTRACTION.md`](file:///Users/katsina/Downloads/earth/docs/research/VISUAL_DIRECTION_EXTRACTION.md) (10대 시각 디자인 차원 역설계 및 Nocturnal Monolith 통합 미학 원칙)*
