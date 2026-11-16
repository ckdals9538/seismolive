# SEISMOLIVE — Asset Extraction Specification
## 외부 레퍼런스로부터 추출한 12대 핵심 기술·디자인 자산 명세서

**작성일**: 2026-11-16  
**목적**: 1·2차 역설계에서 검증된 구현 원리 중 SEISMOLIVE의 기존 아키텍처에 실질적 이득을 주는 **12가지 구현 자산**의 이식 명세, 위험, 과학적 경계 및 라이선스 준수 조건을 정의한다. (본 단계에서는 코드 수정을 수행하지 않는다.)

---

## 요약 매트릭스 (12대 추출 자산)

| ID | 추출 자산 명칭 | 핵심 원천 | 적용 대상 SEISMOLIVE 모듈 | 우선순위 | 라이선스 |
| :---: | :--- | :--- | :--- | :---: | :--- |
| **A-01** | **6-Float32 OBB 바이너리 건물 + 3km 타일 `InstancedMesh` 높이 우선순위 LOD** | `Seoul 3D Atlas` (`build_buildings.py`, `dist/app.js`) | 신규 `LocalSpatialMapLayer` + 오프라인 빌드 스크립트 | **Tier 1** | MIT + ODbL 표기 |
| **A-02** | **우선순위 기반 HTML 오버레이 + HUD 회피 AABB 충돌 제거 라벨러** | `Mini Seoul 3D` (`src/map/stationLabels.ts`) | 신규 `LocalSpatialLabels` + [`DiscoveryBeacons.js`](file:///Users/katsina/Downloads/earth/js/ui/DiscoveryBeacons.js) | **Tier 1** | MIT |
| **A-03** | **누적 호장 거리 테이블 + $O(\log N)$ 이진 탐색 보간 + 줌 픽셀 하한 스케일링** | `Mini Seoul 3D` (`src/geo.ts`, `src/map/trains.ts`) | [`PedestrianRoutingEngine.js`](file:///Users/katsina/Downloads/earth/js/response/PedestrianRoutingEngine.js) + `HanyangResponseAdapter` | **Tier 1** | MIT |
| **A-04** | **사전 빌드 정적 지역 공간 패키지(`.json.gz`/`.bin`) + 경량 실시간 델타 피드 분리** | `Mini Seoul 3D` Live (`/data/*.json.gz` + `/live/delays.json`) | `EventTerrainCatalog` + `LocalSpatialData` 파이프라인 | **Tier 1** | MIT / 공공누리 / ODbL |
| **A-05** | **2군 레이어 시각 위계(무채색 정적 배경 vs 동적 신호) + 비시각 피킹 레이어** | `Seoul Data Atlas` (`kra51-geospatial/js/map.js`) | `LocalSpatialMapLayer` + `ResponseUIAdapter` | **Tier 1** | MIT |
| **A-06** | **이중 대역 스테레오 지진파 청각화(VCO+시간압축) & $\arctan$ 소프트 클리핑** | `EarthScope SEIS-SOUND` + `Earthtunes` | [`StationWaveformBridge.js`](file:///Users/katsina/Downloads/earth/js/data/StationWaveformBridge.js) + [`GeophysicsFolioView.js`](file:///Users/katsina/Downloads/earth/js/ui/GeophysicsFolioView.js) | **Tier 1** | MIT / NSF EarthScope 출처 |
| **A-07** | **공식 USGS ShakeMap 등진도(`cont_mmi.json`) & OAF 여진 확률 제품 연동** | `Tremor` (`ye()` Fetcher) + `USGS ComCat` | [`usgsFeedConnector.js`](file:///Users/katsina/Downloads/earth/js/data/usgsFeedConnector.js) + [`UnifiedControlSurface.js`](file:///Users/katsina/Downloads/earth/js/ui/UnifiedControlSurface.js) | **Tier 2** | Public Domain (CC0 / USGS) |
| **A-08** | **동적 위험구역 회피 폴리곤(`avoid_polygons`) + 다중 물리 속성 기반 엣지 비용** | `OpenRouteService` + `Valhalla` | [`PedestrianRoutingEngine.js`](file:///Users/katsina/Downloads/earth/js/response/PedestrianRoutingEngine.js) | **Tier 1** | Apache-2.0 / MIT (개념·스키마 차용) |
| **A-09** | **IMDF/Simple Indoor 호환 다중 건물 `FacilityPackage` 계층 스키마** | `Apple IMDF` + `OSM Simple Indoor` | [`HanyangBuildingData.js`](file:///Users/katsina/Downloads/earth/js/response/HanyangBuildingData.js) + [`GroundDataContract.js`](file:///Users/katsina/Downloads/earth/js/response/GroundDataContract.js) | **Tier 2** | Open Standard / ODbL |
| **A-10** | **이동 약자(휠체어 `Lock, Cover, Hold On`) 상황별 행동 지침 매트릭스** | `Ready.gov Earthquakes` + `FEMA` | [`SituationAssessmentEngine.js`](file:///Users/katsina/Downloads/earth/js/response/SituationAssessmentEngine.js) + [`ResponseStateMachine.js`](file:///Users/katsina/Downloads/earth/js/response/ResponseStateMachine.js) | **Tier 1** | Public Domain (US Gov) |
| **A-11** | **주변 건물 X-Ray/반투명화 투시 모드 + 지상/실내/지하 계층 전환** | `서울 S-Map` + `Mini Seoul 3D` (`setUnderground`) | [`HanyangResponseAdapter.js`](file:///Users/katsina/Downloads/earth/js/response/HanyangResponseAdapter.js) + `LocalSpatialMapLayer` | **Tier 1** | UI/Shader 패턴 차용 (타일 미사용) |
| **A-12** | **저사양 PC/강의실용 통합 Eco 60FPS 모드 + `prefers-reduced-motion` 준수** | `Mini Seoul 3D` + `Seoul 3D Atlas` | [`js/main.js`](file:///Users/katsina/Downloads/earth/js/main.js) + `viewer_p2_6.html` | **Tier 1** | MIT |

---

## 2. 자산별 상세 명세 (8대 필수 검토 항목 완비)

### Asset A-01: 6-Float32 OBB 바이너리 건물 포맷 & 3km 타일 `InstancedMesh` LOD
- **출처**: `Seoul 3D Atlas` ([`build_buildings.py`](file:///Users/katsina/.gemini/antigravity/brain/6a51ec9e-de1e-4cbc-8dd0-919ae91c4f3f/scratch/seoul-3d-atlas/build_buildings.py), [`dist/app.js`](file:///Users/katsina/.gemini/antigravity/brain/6a51ec9e-de1e-4cbc-8dd0-919ae91c4f3f/scratch/seoul-3d-atlas/dist/app.js) L142–158).
- **가져올 기능 또는 기술**: 건물 외곽선에서 주축 방위각을 뽑아 `[east_m, north_m, width_m, depth_m, yaw_rad, height_m]` 6개 `Float32`(건물당 24B)로 직렬화하고, 3km 공간 타일별로 고층(`>= 25m`) 우선 정렬 후 카메라 거리·저사양 모드에 따라 `InstancedMesh.count`를 `overviewCount ↔ fullCount`로 재할당 없이 즉시 조절하는 기법.
- **적용할 기존 모듈**: 신규 `js/response/LocalSpatialMapLayer.js`, 신규 전처리 스크립트 `scripts/build_local_spatial_4km.py`, [`LocalTangentAnchor.js`](file:///Users/katsina/Downloads/earth/js/response/LocalTangentAnchor.js).
- **필요한 변경**: [`LocalTangentAnchor`](file:///Users/katsina/Downloads/earth/js/response/LocalTangentAnchor.js) 기준 원점(`originECEF`) 대비 미터(m) OBB 배열 생성기 작성; L/C형 복합 건물(예: 제1공학관 212동)처럼 상세 외곽이 중요한 핵심 거점 건물만 별도 `ShapeGeometry`/와이어프레임으로 렌더링하고 나머지 4km 주변 건물은 `InstancedMesh` 배치로 통합.
- **기대 효과**: 반경 4km(`~50 km²`) 내 수천~1만 동 규모 도시 건물을 1~4개 드로우콜(< 300 KB 바이너리)로 렌더링해 학교 통합 그래픽 PC에서도 안정적 프레임 확보.
- **기술적 위험**: ㄷ자·ㅁ자·복합 폴리곤 건물을 단일 직사각형 OBB로 단순화하면 마당·필로티가 메워져 보일 수 있음. 따라서 **대피 목적지·선택 거점 건물(Hero Building)은 반드시 원본 OSM/V-World 12각 이상 다각형 폴리곤을 사용**해야 함.
- **과학적 주의점**: `render_height` 또는 층수(`building:levels * 3.6m`) 기반 추정 높이는 실제 건축물대장 정밀 높이가 아닐 수 있으므로 메타데이터에 `heightSource` (`VERIFIED_REGISTRY` vs `ESTIMATED_LEVELS`)를 구분하고 `PROVISIONAL` 표시를 유지.
- **라이선스 및 출처 표기 조건**: 코드 패턴 MIT (`Jinho Seo`), 원천 OSM 건물 데이터 ODbL 1.0 (`OpenStreetMap contributors`) 및 국토교통부 V-World/건축HUB 출처 명시 필수.

### Asset A-02: 우선순위 기반 HTML 오버레이 + HUD 회피 AABB 충돌 제거 라벨러
- **출처**: `Mini Seoul 3D` ([`src/map/stationLabels.ts`](file:///Users/katsina/.gemini/antigravity/brain/6a51ec9e-de1e-4cbc-8dd0-919ae91c4f3f/scratch/mini-seoul-3d/src/map/stationLabels.ts)).
- **가져올 기능 또는 기술**: ① 중요도(`선택 건물 > 공식 대피소 > 의료/방재 거점 > 일반 건물`) 사전 정렬, ② `getBoundingClientRect()`로 화면의 기존 HUD 카드(`.gallery-header`, `#unified-control-surface`, `#guidance-container`) 영역을 먼저 `placed[]` 장애물에 등록해 라벨이 UI 뒤로 겹치는 현상 차단, ③ `document.fonts.ready` 시 폭 캐시 초기화.
- **적용할 기존 모듈**: `viewer_p2_6.html`의 4km 라벨 레이어, 그리고 [`js/main.js`](file:///Users/katsina/Downloads/earth/js/main.js)의 [`DiscoveryBeacons.js`](file:///Users/katsina/Downloads/earth/js/ui/DiscoveryBeacons.js) 및 [`livingMemoryEngine.js`](file:///Users/katsina/Downloads/earth/js/3d/livingMemoryEngine.js) NDC 충돌 가드 보강.
- **필요한 변경**: `vector.project(camera)` 기반 Three.js → CSS `translate(x, y)` 투영 어댑터 작성 및 AABB `overlaps(a, b, PAD)` 루프 구현. 매 프레임 `offsetWidth` 리플로우를 막기 위해 `obstacles` 일괄 읽기 후 CSS `transform`만 일괄 기록(batch read → batch write).
- **기대 효과**: 4km 지역맵에서 수십 개의 대피소·병원·건물 라벨이 서로 겹치거나 하단 대응 지침 카드를 가리는 난잡함을 제거해 *Nocturnal Monolith*의 여백 미학 유지.
- **기술적 위험**: 3D 구면 뒷면(z > 1)이나 카메라 바로 뒤 좌표가 잘못 투영될 수 있으므로 `ndc.z < -1 || ndc.z > 1` 컬링 검사 필수.
- **과학적 주의점**: 중요도 낮은 라벨을 숨길 때 공식 대피소(`SHELTER`)와 위험 통행불가 알림이 일반 건물명 때문에 가려지지 않도록 **방재·안전 우선순위 가중치**를 최상위에 고정.
- **라이선스 및 출처 표기 조건**: MIT License (`Seongil Park`).

### Asset A-03: 누적 호장 거리 보간 (`cumulative`, `pointAlong`) & 줌 픽셀 하한 스케일링
- **출처**: `Mini Seoul 3D` ([`src/geo.ts`](file:///Users/katsina/.gemini/antigravity/brain/6a51ec9e-de1e-4cbc-8dd0-919ae91c4f3f/scratch/mini-seoul-3d/src/geo.ts), [`src/map/trains.ts`](file:///Users/katsina/.gemini/antigravity/brain/6a51ec9e-de1e-4cbc-8dd0-919ae91c4f3f/scratch/mini-seoul-3d/src/map/trains.ts) L49–53, L243–250).
- **가져올 기능 또는 기술**: ① 폴리라인 정점별 누적 미터 거리 배열 구축 후 $O(\log N)$ 이진 탐색으로 임의 거리 위치·진행 방위각 추출, ② 카메라 거리(`metersPerPixel`)에 연동해 멀리 떨어져도 주요 포털/마커/경로선 두께가 1px 미만으로 소멸하지 않도록 픽셀 하한 보정.
- **적용할 기존 모듈**: [`PedestrianRoutingEngine.js`](file:///Users/katsina/Downloads/earth/js/response/PedestrianRoutingEngine.js), [`HanyangResponseAdapter.js`](file:///Users/katsina/Downloads/earth/js/response/HanyangResponseAdapter.js).
- **필요한 변경**: `HanyangResponseAdapter._extractRoutePoints`의 3D 정점 배열에 `cumulativeDistance3D`와 `pointAlong3D` 유틸리티를 추가해 651.9m 최단경로 및 769.1m 무단차 우회로 상의 보행 진행 지점(`T+67s` 우회 분기점, `1층 출구 → 4m 포털 → 계단 1~4`)을 정확 미터 거리로 표기·추적.
- **기대 효과**: 시각 확대 배율(`visualScaleFactor`)과 무관하게 실제 WGS84/ENU 미터 단위로 경로상 위치·잔여 거리를 정확히 연산.
- **기술적 위험**: 3D 꺾임이 큰 실내외 계단 구간에서는 수직 고도 $\Delta y$가 포함되므로 수평 2D Haversine 거리와 3D 유클리드 거리(`sqrt(dx^2 + dy^2 + dz^2)`) 혼용 주의.
- **과학적 주의점**: 경로상 이동 애니메이션이나 시간 추정은 보행 속도 가정을 동반하므로, 실제 소요 시간/속도를 확정값으로 단정하지 않고 참고 거리(`m`) 중심으로 표시.
- **라이선스 및 출처 표기 조건**: MIT License (`Seongil Park`).

### Asset A-04: 사전 빌드 정적 지역 공간 패키지 + 경량 실시간 델타 피드 분리
- **출처**: `Mini Seoul 3D` Live ([`metro.kgenots.com`](https://metro.kgenots.com/)) & GitHub ([`scripts/build-network.mjs`](file:///Users/katsina/.gemini/antigravity/brain/6a51ec9e-de1e-4cbc-8dd0-919ae91c4f3f/scratch/mini-seoul-3d/scripts/build-network.mjs), `api/subway/position.ts`).
- **가져올 기능 또는 기술**: 런타임에 클라이언트 브라우저가 직접 OSM Overpass API나 건축물대장 OpenAPI를 대량 호출하지 않도록, **정적 공간 구조(지형·건물·도로·대피소 정적 스키마)는 빌드 타임에 정제해 `.json`/`.bin`으로 로컬 패키징**하고, 런타임에는 **지진/경보/현장 제보 델타 패킷만 수신**하는 구조.
- **적용할 기존 모듈**: `assets/data/`, `.cfignore` 배포 자산 목록, [`EventTerrainCatalog.js`](file:///Users/katsina/Downloads/earth/js/data/EventTerrainCatalog.js), [`HanyangBuildingData.js`](file:///Users/katsina/Downloads/earth/js/response/HanyangBuildingData.js).
- **필요한 변경**: 지역별 공간 패키지 JSON/BIN 로더(`LocalSpatialDataLoader`) 추가 및 Cloudflare Pages 배포 용량(`.cfignore`, 목표 `< 35 MB`, 현재 `29.308 MB`) 내에 맞춘 경량 패키지(4km 기준 `< 1 MB`) 구성.
- **기대 효과**: 전시 현장·학교 PC·재난 시 외부 API 장애 환경에서도 0.2초 이내 즉시 로딩 및 API 키 노출/쿼터 초과 원천 차단.
- **기술적 위험**: 정적 패키지가 오래되면 신축 건물이나 변경된 도로 공사가 미반영될 수 있음.
- **과학적 주의점**: 정적 패키지 메타데이터에 반드시 `generatedAt`, `sourceDates`를 기록해 출처 기준 시점을 사용자에게 투명하게 공개.
- **라이선스 및 출처 표기 조건**: MIT + 각 공공데이터 원출처(OSM ODbL 1.0, 국토부/행안부 공공누리 1유형) 표시.

### Asset A-05: 2군 레이어 시각 위계 & 비시각 투명 피킹 레이어
- **출처**: `Seoul Data Atlas` ([`kra51-geospatial/js/map.js`](file:///Users/katsina/.gemini/antigravity/brain/6a51ec9e-de1e-4cbc-8dd0-919ae91c4f3f/scratch/kra51-geospatial/js/map.js) L2–135).
- **가져올 기능 또는 기술**: ① 도시 배경(지형·건물 `#0A1118`·간선도로)은 철저히 채도를 낮춘 `Static Geo Fabric`으로 깔고, 지진파·대피 경로·선택 건물·대피소만 고명도(`#f8fafc` / 호박색 주의선 `#f59e0b`)의 `Signal Layer`로 분리, ② 투명/글로우 메시와 분리된 단순 박스/히트 프록시로 Raycasting 수행.
- **적용할 기존 모듈**: `LocalSpatialMapLayer`, [`HanyangResponseAdapter.js`](file:///Users/katsina/Downloads/earth/js/response/HanyangResponseAdapter.js), [`DiscoveryBeacons.js`](file:///Users/katsina/Downloads/earth/js/ui/DiscoveryBeacons.js)(이미 `hitMesh` 패턴 부분 적용 중).
- **필요한 변경**: 4km 지역맵 내 70~수천 개 건물에 대해 개별 마테리얼 대신 `InstancedMesh.instanceId` 직접 Raycasting + 선택된 1개 건물만 하이라이트 와이어프레임으로 승격.
- **기대 효과**: 수천 개의 도시 건물이 올라와도 대피 경로와 위험 계단 세그먼트의 가독성이 묻히지 않음(Visual Signal-to-Noise Ratio 극대화).
- **기술적 위험**: 선택 강조 시 원색 네온/블룸을 쓰면 *Nocturnal Monolith*(`GEMINI.md` Rule 2) 위반 소지 발생.
- **과학적 주의점**: 건물의 채도/명도를 건물 내진 위험도 점수로 자의적 착색(`빨간 위험 건물`)하지 않고 **단순 선택/비선택 위계**만 구분.
- **라이선스 및 출처 표기 조건**: MIT License (`KAIST Urban AI Institute`).

### Asset A-06: 이중 대역 스테레오 지진파 청각화 & $\arctan$ 소프트 클리핑 정규화
- **출처**: `EarthScope SEIS-SOUND` (`gage-data.earthscope.org/app/products/portal/seissound/`) + `Earthtunes` ([`getSoundAndGraph.py`](file:///Users/katsina/.gemini/antigravity/brain/6a51ec9e-de1e-4cbc-8dd0-919ae91c4f3f/scratch/earthtunes/Windows/getSoundAndGraph.py) L127–130).
- **가져올 기능 또는 기술**: ① `> 0.5 Hz` 실체파(P/S)는 시간 압축(`200x~500x`)해 왼쪽/주 채널로 가청화하고, `< 0.5 Hz` 장주기 표면파 진폭 포락선은 VCO(FM 발진기) 주파수를 변조해 동일 시간 길이의 스테레오 페어로 동기화, ② $\frac{2}{\pi}\arctan(x/A_0)$ 압축으로 P파 초동과 거대 S파를 동시에 클리핑 없이 청취.
- **적용할 기존 모듈**: [`StationWaveformBridge.js`](file:///Users/katsina/Downloads/earth/js/data/StationWaveformBridge.js), [`GeophysicsFolioView.js`](file:///Users/katsina/Downloads/earth/js/ui/GeophysicsFolioView.js), [`LivingSoundfieldEngine.js`](file:///Users/katsina/Downloads/earth/js/audio/livingSoundfieldEngine.js).
- **필요한 변경**: [`LivingSoundfieldEngine.js`](file:///Users/katsina/Downloads/earth/js/audio/livingSoundfieldEngine.js)의 전시용 사운드스케이프를 건드리지 않고, 계측 관측소 패킷(`SeismicStationPacket`)이 존재하는 현대 지진(예: 경주·포항·구마모토·튀르키예)의 탐사 패널(`GeophysicsFolioView`)에 **"실측 파형 청각화 재생"** 서브 모듈(`playAudifiedTrace(trace, speedupFactor)`)을 추가.
- **기대 효과**: SEISMOLIVE 철학 *"Data Made Audible"*을 추상 합성음(예술 계층)에서 **실제 지진계 파형의 물리적 청각화(과학 계층)**까지 완결.
- **기술적 위험**: 초저주파/과도한 게인 출력 시 청각 피로 유발 가능 → 기존 [`LivingSoundfieldEngine.js`](file:///Users/katsina/Downloads/earth/js/audio/livingSoundfieldEngine.js)의 30 Hz 2단 하이패스 필터 및 `-12dB` 컴프레서 마스터 버스를 공유해 청각 안전 보장.
- **과학적 주의점**: 시간 압축 배율(`예: 250×`)과 비선형 `arctan` 다이내믹 압축 사용 사실을 UI에 명확히 표기해 원 물리 진폭 왜곡 오해 방지.
- **라이선스 및 출처 표기 조건**: `Earthtunes` MIT License (`Cooper Barth`); `SEIS-SOUND` 학술 방법론 출처 표기 (`NSF NGF / EarthScope SEIS-SOUND`).

### Asset A-07: 공식 USGS ShakeMap 등진도(`cont_mmi.json`) & OAF 여진 확률 연동
- **출처**: `Tremor` (`tremorhq.com` 번들 `ye()`, `xe()`, `be()`) + USGS ComCat API.
- **가져올 기능 또는 기술**: `earthquake.usgs.gov` 상세 JSON의 `properties.products.shakemap[0].contents["download/cont_mmi.json"]` GeoJSON 등진도 선분과 `oaf[0].contents["forecast.json"]` 여진 확률 데이터를 온디맨드 페치(단, 오프라인 폴백 포함).
- **적용할 기존 모듈**: [`usgsFeedConnector.js`](file:///Users/katsina/Downloads/earth/js/data/usgsFeedConnector.js), [`UnifiedControlSurface.js`](file:///Users/katsina/Downloads/earth/js/ui/UnifiedControlSurface.js).
- **필요한 변경**: 이벤트 선택 시 ComCat `detail` URL이 존재하면 `shakemap`/`oaf` 존재 여부 및 실측 최대 MMI를 표기하고, `Tremor`식의 임의 계산 공식 `Ot(M, h, d)`는 일절 구현하지 않음.
- **기대 효과**: 실시간 USGS 피드에서 단순 진앙 점 1개만 보여주는 한계를 넘어 공식 계측 기반 지반 흔들림 분포와 여진 전망 정보 보강.
- **기술적 위험**: USGS ComCat 상세 엔드포인트는 실시간 네트워크 환경이나 CORS/타임아웃 영향을 받을 수 있으므로 캐싱 및 우아한 폴백(`null` 유지) 필수.
- **과학적 주의점**: ShakeMap이 없는 소규모 지진이나 역사 지진에서 임의 보간 등진도선을 날조하지 않으며, USGS 제품에는 `OFFICIAL_DISASTER_INFO` 출처와 불확실성을 함께 표시.
- **라이선스 및 출처 표기 조건**: USGS 데이터 Public Domain (U.S. Government Works), 출처 `U.S. Geological Survey`.

### Asset A-08: 동적 위험구역 회피 폴리곤(`avoid_polygons`) & 다중 물리 속성 엣지 비용
- **출처**: `OpenRouteService` (`Apache-2.0`) + `Valhalla` (`MIT`).
- **가져올 기능 또는 기술**: ① 건물 높이 비례 외벽 낙하 위험 반경($H_{\text{bldg}}$ 이상 이격구역) 또는 하천변 충적층 액상화 주의 구역을 `avoid_polygons`로 등록해 경로 탐색 시 해당 구간을 자동 회피하거나 페널티 부여, ② 그래프 재구축 없이 요청 시점 프로파일(`STANDARD`, `INJURED`, `WHEELCHAIR`, `AFTERSHOCK`)별 엣지 비용 함수만 교체.
- **적용할 기존 모듈**: [`PedestrianRoutingEngine.js`](file:///Users/katsina/Downloads/earth/js/response/PedestrianRoutingEngine.js), [`IndoorOutdoorConnector.js`](file:///Users/katsina/Downloads/earth/js/response/IndoorOutdoorConnector.js).
- **필요한 변경**: `PedestrianRoutingEngine.findDynamicPath`에 `avoidZones: Polygon[]` 및 `profileOptions` 파라미터 추가 (링크 중점이 회피 폴리곤 내부면 `HIGH_PENALTY` 또는 배제, 폴리곤 밖 우회로 우선).
- **기대 효과**: 단순 선분 1개(`NODE_STAIR1_TOP->NODE_STAIR1_BOT`) 폐쇄를 넘어 **면(Area) 단위 지진 위험 구역(외벽 파손 반경·지반 취약구간)**까지 포괄하는 공간 지능형 재탐색 가능.
- **기술적 위험**: 출발지나 1층 출구가 회피 폴리곤 경계에 걸쳐 있으면 경로가 아예 막힐 수 있으므로, 출구 직후 탈출 구간(S4 Egress)은 폴리곤 배제 예외(`ESCAPE_ZONE`)로 두고 나머지 보행망에만 적용해야 함.
- **과학적 주의점**: 모든 경로가 위험구역에 걸치면 억지로 안전 경로라고 출력하지 말고 기존 `NO_VIABLE_PATH` + `SHELTER_IN_PLACE` 전환 규칙 엄수.
- **라이선스 및 출처 표기 조건**: OpenRouteService Apache-2.0 / Valhalla MIT (알고리즘 원리 자체 설계 구현).

### Asset A-09: IMDF / OSM Simple Indoor 호환 다중 건물 `FacilityPackage` 계층 스키마
- **출처**: `Apple IMDF 1.0.0` (OGC Standard) + `OSM Simple Indoor Tagging` (`OpenIndoor` / `IndoorEqual` 스키마).
- **가져올 기능 또는 기술**: 특정 대학/건물 이름에 종속되지 않는 표준 실내 계층(`Facility → Building → Level(ordinal) → Unit(room/corridor/stairwell) → Opening(door, width, lock) → Relationship/Connector`)과 요소별 `provenance` 및 `blueprintAlignment` 결합.
- **적용할 기존 모듈**: [`HanyangBuildingData.js`](file:///Users/katsina/Downloads/earth/js/response/HanyangBuildingData.js), [`GroundDataContract.js`](file:///Users/katsina/Downloads/earth/js/response/GroundDataContract.js), [`ResponseDomainTypes.js`](file:///Users/katsina/Downloads/earth/js/response/ResponseDomainTypes.js).
- **필요한 변경**: 현재 한양대 212동 중심의 `DEFAULT_HANYANG_FACILITY_PACKAGE`를 임의 지역 JSON 패키지에서 로드되는 `GenericFacilityPackage` 스키마로 문서화·표준화.
- **기대 효과**: 향후 제2공학관·서울시 공공기관·타 대학 건물을 추가할 때 코드 수정 없이 데이터 패키지만 교체하면 실내외 대응이 자동 작동.
- **기술적 위험**: `OpenIndoor`/`IndoorEqual` 코어 저장소는 **`AGPL-3.0`** 이므로 코드를 그대로 가져오지 않도록 주의.
- **과학적 주의점**: 실측 도면이 없는 건물에서는 `units`와 `openings`를 `PROVISIONAL`로 강제 태깅해 미검증 실내 구조를 확정 정보로 오인시키지 않음.
- **라이선스 및 출처 표기 조건**: OGC IMDF Open Standard, OSM ODbL 1.0 (`AGPL-3.0` 코드는 일절 복사하지 않음).

### Asset A-10: 이동 약자(`Lock, Cover, Hold On`) 상황별 행동 지침 매트릭스
- **출처**: `Ready.gov Earthquakes` (`ready.gov/earthquakes`, Grade A) + `FEMA App` 가이드.
- **가져올 기능 또는 기술**: 흔들림 발생 중(`S1_SHAKING`) 일반 보행자의 `Drop, Cover, Hold On`과 구분되는 휠체어 이용자 전용 행동 지침 **`Lock, Cover, Hold On` (바퀴 잠금 → 휠체어에서 내리지 않고 상체를 숙여 머리·목 보호 → 흔들림 종료 대기)** 및 고층 건물 내 엘레베이터 정지 시 방화구획 대기 지침 반영.
- **적용할 기존 모듈**: [`SituationAssessmentEngine.js`](file:///Users/katsina/Downloads/earth/js/response/SituationAssessmentEngine.js), [`PersonalResponseInteraction.js`](file:///Users/katsina/Downloads/earth/js/response/PersonalResponseInteraction.js).
- **필요한 변경**: `SituationAssessmentEngine.assess`의 `CASE 1 (isIndoor && (isShakingActive || hasAftershock))` 분기에서 `if (isWheelchair)` 조건 추가해 휠체어 맞춤형 방호 행동 우선 출력.
- **기대 효과**: 물리 경로 탐색(`isWheelchair`)뿐 아니라 진동 중 생명을 지키는 행동 지침 단계에서도 실질적 맞춤형 대응 제공.
- **기술적 위험**: 없음 (순수 논리 분기 보강).
- **과학적 주의점**: 무단차 경로가 `VERIFIED`가 아니더라도 지진동 중 휠체어 이동 금지(`Lock`)는 공인 방재 원칙(`Ready.gov`)으로 유효함을 명시.
- **라이선스 및 출처 표기 조건**: US Government Public Domain (`Ready.gov / FEMA`).

### Asset A-11: 주변 건물 X-Ray/반투명화 & 지상·지하·실내 계층 투시 모드
- **출처**: `Mini Seoul 3D` ([`src/map/createMap.ts`](file:///Users/katsina/.gemini/antigravity/brain/6a51ec9e-de1e-4cbc-8dd0-919ae91c4f3f/scratch/mini-seoul-3d/src/map/createMap.ts) L89–98 `setUnderground`) + `서울 S-Map` (`투명화 건물/지형`).
- **가져올 기능 또는 기술**: `BUILDING_INSPECTION` 및 `PERSONAL_LOCATION` 단계로 진입할 때 주변 4km 컨텍스트 건물 메쉬의 불투명도를 `0.72 → 0.14`로 낮춰 대상 건물의 5층 슬래브, 3층 `PROVISIONAL` 내부, 1층 포털, 옥외 보행 경로가 다른 건물에 가려지지 않도록 자동 투시 처리.
- **적용할 기존 모듈**: `LocalSpatialMapLayer`, [`HanyangResponseAdapter.js`](file:///Users/katsina/Downloads/earth/js/response/HanyangResponseAdapter.js).
- **필요한 변경**: `InstancedMesh` 재질에 `transparent: true`, `opacity` 제어 추가 및 카메라 단계 연동.
- **기대 효과**: 고밀도 도심(왕십리·한양대) 사선 카메라 각도에서도 인접 건물이 피난 계단이나 1층 출구를 가리는 폐색(Occlusion) 문제 해소.
- **기술적 위험**: 반투명 `InstancedMesh`에서 `depthWrite: true`를 끄면 원근 정렬이 깨질 수 있으므로, 정상 모드에서는 `transparent: false, depthWrite: true`를 유지하고 투시(X-Ray) 모드에서만 `transparent: true, opacity: 0.16, depthWrite: false`로 전환.
- **과학적 주의점**: X-Ray 투시로 보이는 실내 구조는 여전히 `PROVISIONAL` 배지를 유지해야 함.
- **라이선스 및 출처 표기 조건**: MIT License 패턴 참고 (`Seongil Park`).

### Asset A-12: 저사양/학교 PC용 통합 Eco 60FPS 모드 & 접근성 모션 감속 준수
- **출처**: `Mini Seoul 3D` (`state.eco` 프레임 스킵 + 250~400ms UI 스로틀링) + `Seoul 3D Atlas` (`prefers-reduced-motion`, `mobile()` `overviewCount`).
- **가져올 기능 또는 기술**: 현재 [`js/main.js`](file:///Users/katsina/Downloads/earth/js/main.js)에 이미 존재하는 `CLASSROOM` 모드(`setQualityMode`)를 지역 공간맵(`viewer_p2_6.html` 및 향후 통합 뷰어)까지 확장해 ① `DPR <= 1.0`, ② 4km `InstancedMesh` 인스턴스를 `overviewCount`로 제한, ③ 라벨·호버 레이캐스팅 주기 `150ms` 스로틀링, ④ `prefers-reduced-motion` 시 카메라 스냅 전환 지원.
- **적용할 기존 모듈**: [`js/main.js`](file:///Users/katsina/Downloads/earth/js/main.js) (`CLASSROOM` 모드), `viewer_p2_6.html`, 신규 `LocalSpatialMapLayer`.
- **필요한 변경**: 통합 Eco 설정 객체와 UI 토글 연동 및 [`GlobalLocalCameraTransition.js`](file:///Users/katsina/Downloads/earth/js/response/GlobalLocalCameraTransition.js)에 `reducedMotion` 옵션 추가.
- **기대 효과**: M4 Mac mini뿐 아니라 외장 GPU가 없는 일반 학교 실습실/사무실 노트북에서도 프레임 드롭과 발열을 방지.
- **기술적 위험**: 30fps 프레임 스킵 시 카메라 궤도 드래그까지 건너뛰면 조작감이 끊기므로 **렌더 루프·OrbitControls는 60fps를 유지하고 무거운 라벨/인스턴스 데이터 동기화만 간격을 조절**해야 함.
- **과학적 주의점**: 성능 절감 모드에서도 위험 경고·통행불가·불확실성 배지는 절대 생략하지 않음.
- **라이선스 및 출처 표기 조건**: MIT License (`Seongil Park`, `Jinho Seo`).

---
*다음 문서: [`SEISMOLIVE_ARCHITECTURE_INTEGRATION_PLAN.md`](file:///Users/katsina/Downloads/earth/docs/research/SEISMOLIVE_ARCHITECTURE_INTEGRATION_PLAN.md) (기존 시스템 전수 대조, A/B/C 지도 엔진 전략 비교, 4km+ 확장 아키텍처 설계)*
