# SEISMOLIVE — Reference Reverse Engineering Report
## 2차 조사: 분야별 심층 역설계 (글로벌 지구 · 지진 과학 · 사운드 미디어아트 · 지역 3D 공간맵 · 실내 디지털 트윈 · 재난 대응 경로)

**작성일**: 2026-11-16  
**대상**: 1차 인벤토리에서 선별한 핵심 레퍼런스의 실제 동작 원리·코드 구조·렌더링 파이프라인·데이터 스키마·과학적 한계 분석

---

## 4-1. 글로벌 지구 경험 (Global Earth & Multi-Scale Continuity)

### 분석 대상: `NASA Eyes` · `NASA WebWorldWind` · `CesiumJS`

| 비교 차원 | NASA Eyes (`science.nasa.gov/eyes/`) | WebWorldWind (`NASAWorldWind/WebWorldWind`) | CesiumJS (`CesiumGS/cesium`) | 현재 SEISMOLIVE (`js/main.js`, `geodeticEllipsoidCoord.js`) |
| :--- | :--- | :--- | :--- | :--- |
| **좌표·타원체 모델** | Three.js 기반 행성 중심/미션 프레임 | WGS84 회전타원체 + 타일 쿼드트리 | WGS84 ECEF (Double->RTC Emulated Two-Float Shader) | **WGS84 타원체 + Center-Relative Origin + Local ENU** (`1 unit = 100 km`, Float32 오차 `< 0.05m`) |
| **지형 LOD·타일링** | 행성/소행성 레벨 메쉬 + 고해상도 패치 | WMTS/TMS 피라미드 라스터·엘리베이션 타일 | Quantized-Mesh 지형 타일 + 3D Tiles 1.0/1.1 HLOD | 3-Tier (Tier 0 `ETOPO 2022` 지구본 → Tier 1/2 `Copernicus 30m` UNORM16 곡면 DEM 패치) |
| **카메라·깊이 정밀도** | 타겟 락(Target Lock) + 부드러운 궤도 보간 | 지표면 충돌 회피 고도 클램핑 | **Logarithmic Depth Buffer** (`10cm ~ 10^8m` Z-fighting 제거) | [`FlightController.js`](file:///Users/katsina/Downloads/earth/js/3d/FlightController.js) 구면 SLERP + 아크 홉 + `near: 0.1 → 0.02`, 지하 관통 방지 가드 |
| **시각·예술적 자유도** | 과학 우주 다큐멘터리 스타일 | 표준 GIS 뷰어 스타일 | 범용 디지털 트윈 (포토리얼리즘 지향) | **맞춤 GLSL *Nocturnal Monolith* 셰이더** (해저 감쇠, 산맥 능선 공명, P/S/R 3D 벡터 변위) |

### SEISMOLIVE 관점 핵심 진단
1. **엔진 교체 불필요**: SEISMOLIVE는 이미 WGS84 회전타원체 기하 위에 P/S파 물리 변위장과 한반도 사료 타이포그래피가 직접 GPU 셰이더(`REGIONAL_TERRAIN_VERTEX_SHADER`, `TIER0_GLOBE_VERTEX_SHADER`)로 결합되어 있다. CesiumJS로 전환할 경우 이 정교한 커스텀 셰이더 파이프라인을 모두 버리고 재작성해야 하며 번들 크기와 저사양 PC GPU 부하가 폭증한다.
2. **가져올 3가지 구조적 원리**:
   - **전환 구간 전 프레임 지하 관통 클램핑**: 현재 `js/main.js`(2658–2667행)의 `camera.position.y` 최소 고도 클램핑은 `PERFORMANCE`/`CODA` 상태에만 적용된다. [`FlightController.js`](file:///Users/katsina/Downloads/earth/js/3d/FlightController.js)가 동작하는 `DESCEND`/`ASCEND` 구간에도 지형 표고 샘플링을 연속 적용해 초근접 산악 지형 비행 시 절단면을 완전히 차단해야 한다.
   - **다이나믹 프러스텀 평면 스케일링**: 우주(`r=140`)에서 4km 지역맵(`4,000m` 범위) 및 실내(`1m` 단위)까지 내려가려면 고정 `near=0.02, far=600` 대신 카메라 고도/단계에 연동되는 동적 `near/far` 스케줄(또는 Three.js `logarithmicDepthBuffer` 대안 검토)이 필수적이다.
   - **지형 경계 스커트(Skirt) 및 연속 이음매**: [`Seoul 3D Atlas`](file:///Users/katsina/.gemini/antigravity/brain/6a51ec9e-de1e-4cbc-8dd0-919ae91c4f3f/scratch/seoul-3d-atlas/dist/app.js) 84–88행은 컷아웃 지형 패치 가장자리의 틈을 메우기 위해 하단 스커트 메쉬를 생성한다. SEISMOLIVE도 Tier 1/2 지역 패치가 Tier 0 지구본과 겹칠 때 발생하는 미세 경계 틈새를 `edgeTaper` 셰이더 블렌딩 + 스커트/스텐실로 더욱 견고히 봉합할 수 있다.

---

## 4-2. 지진 과학 시각화 (Scientific Integrity & Empirical Hazard)

### 분석 대상: `Tremor (tremorhq.com)` vs. `USGS ComCat / ShakeMap Products`

라이브 서비스 `https://tremorhq.com/`의 프로덕션 번들(`/assets/index-BBPSN9Xa.js`, 170,998 bytes)을 직접 추출해 역공학한 결과는 다음과 같다.

#### 1) 실제 구현 코드 확인 (`index-BBPSN9Xa.js` 발췌 분석)
- **렌더링 엔진**: Three.js 기반 `three-globe` 위성 야간 텍스처 지구본 + 정적 판 경계(`/assets/plates-*.json`), 단층선(`/assets/faults-*.json`), 화산 데이터.
- **실시간 USGS 이벤트 상세 제품 연동 (`ye()` 함수)**:
  - 이벤트의 `properties.products`에서 3가지 공식 USGS 과학 제품을 동적으로 페치한다:
    1. `shakemap[0].contents["download/cont_mmi.json"]` 및 `download/intensity.jpg` / `pga.jpg` (실측·보간 기반 ShakeMap 등진도선 및 PGA 래스터)
    2. `dyfi[0].contents["download/intensity.jpg"]` ("Did You Feel It?" 시민 체감진도 보고)
    3. `oaf[0].contents["forecast.json"]` (USGS Operational Aftershock Forecast, 시간창별 여진 확률 `bins[].{magnitude, probability}`)
- **시나리오/도시 영향용 자체 MMI 추정식 (`Ot()` 함수)**:
  ```javascript
  // tremorhq.com /assets/index-BBPSN9Xa.js 직접 역공학 결과
  var Tt = 1, Et = 3, Dt = 4.5;
  function Ot(e, t, n) {
    // e = Magnitude, t = Depth (km), n = Epicentral Distance (km)
    let r = Math.sqrt(n * n + t * t); // 진원 거리 R_hypo (km)
    return clamp(Tt * e - Et * Math.log10(Math.max(1, r)) + Dt, 1, 10);
  }
  ```
  - 즉 `MMI = clamp(1.0 * M - 3.0 * log10(R_hypo) + 4.5, 1, 10)`라는 극도로 단순화된 등방성 점진원 경험식을 사용해 도시 목록(`Pe`)의 추정 MMI(`u >= 2.5`)를 산출하고 있다.

#### 2) SEISMOLIVE 과학적 무결성 기준에 따른 판정
| 요소 | Tremor 방식 | SEISMOLIVE 적용 판단 | 근거 |
| :--- | :--- | :--- | :--- |
| **USGS `shakemap` (`cont_mmi.json`) / `oaf` 제품 연동** | 공식 ComCat Event Detail JSON에서 실제 관측·역산 산출물 페치 | **적용 가치 높음** | 공인 기관(USGS)이 관측소 PGA·단층모델·부지증폭(Vs30)을 반영해 산출한 공식 제품이므로 `OFFICIAL_DISASTER_INFO`/`OBSERVED_STATION` 출처로 신뢰성 높게 표시 가능 |
| **자체 단순 MMI 공식 `Ot(M, h, d)`** | 지반 조건·감쇠($Q$)·지향성 없이 `M - 3*log10(R) + 4.5`로 모든 도시 MMI 계산 | **절대 도입 금지** | `GEMINI.md`의 "가짜 GMPE 공식 날조 금지" 원칙에 정면 위배. 특히 국내 연약 충적층(예: 중랑천변)과 화강암 기반암(캠퍼스 구릉)의 차이를 왜곡함 |
| **등진도선 무지개 5색 팔레트 (`Se`)** | 빨강→주황→노랑→초록→파랑 원색 램프 | **절대 도입 금지** | SEISMOLIVE의 *Nocturnal Monolith* 팔레트(이미 [`SeismicTerrainShaders.js`](file:///Users/katsina/Downloads/earth/js/3d/shaders/SeismicTerrainShaders.js) 541–571행에서 95% 신뢰오차타원과 등진도선을 절제된 황동/슬레이트 점선으로 구현)와 충돌 |

---

## 4-3. 지진 사운드와 미디어 아트 (Waveform Audification vs. Generative Soundscape)

### 분석 대상: `EarthScope / SEIS-SOUND` · `Earthtunes (GitHub)` · `soundQuake`

1. **`EarthScope / SEIS-SOUND` (`gage-data.earthscope.org/app/products/portal/seissound/`, Grade A)**:
   - **이중 대역 스테레오 청각화 (Dual-Band Stereo Sonification)**:
     - 지진파는 인간 가청 하한(`20 Hz`)보다 훨씬 낮은 초저주파(`0.01 ~ 10 Hz`)에 주 에너지가 집중되어 있어 단순 가속 재생만으로는 장주기 표면파(Rayleigh/Love)와 고주파 실체파(P/S)를 **동시에** 들을 수 없다.
     - SEIS-SOUND는 원 지진계(`BHZ` 등) 신호에 **0.5 Hz 하이패스 필터**를 적용한 뒤 $200\times \sim 500\times$ 시간 압축(`예: 0.5~40 Hz × 500 = 250~20,000 Hz`)해 한 채널에 배치하고, `< 0.5 Hz` 장주기 표면파의 진폭 포락선으로 가청 중심 주파수를 **전압 제어 발진기(VCO/FM) 변조**하여 같은 길이에 맞춘 뒤 **스테레오 페어**로 합성한다.
   - **4패널 시각 동기화**: ① 원본 지진파, ② 0.5 Hz 필터 파형, ③ 로그 스펙트로그램(`10 * log10`), ④ 시간축 진행에 따라 회색→진검정으로 변하는 궤적과 수직 핑크 재생 커서.
2. **`Earthtunes` (`cooperbarth/Earthtunes`, `Windows/getSoundAndGraph.py`, MIT License, Grade B)**:
   - **실측 파형 다운로드**: `service.iris.edu/irisws/timeseries/1/query`로 `BHZ` 채널 ASCII/시계열 데이터를 획득.
   - **대역별 시간 압축 계수**: 목표 대역(`0.1 Hz → 64,000x`, `0.5 Hz → 16,000x`, `5 Hz → 1,600x`, `20 Hz → 400x`, `50 Hz → 160x`)으로 샘플링 레이트 `ssps = bandsHZ * fsps`를 스케일링.
   - **아크탄젠트 소프트 클리핑 정규화 (Soft-Clipping Normalization)**:
     ```python
     # Earthtunes/Windows/getSoundAndGraph.py (L127-L128)
     halfpi = 0.5 * np.pi
     scaledsound = (2**31) * np.arctan(sound / fixedamp) / halfpi
     ```
     - 선형 정규화(`x / max(|x|)`)를 쓰면 거대한 S파/표면파 피크 때문에 미세한 P파 초동이 들리지 않게 되고, 단순 클리핑은 파형 왜곡 노이즈를 만든다. $\frac{2}{\pi}\arctan(x/A_0)$ 함수를 쓰면 미세한 P파는 선형적으로 증폭하고 대진폭 S파는 포화 없이 부드럽게 압축한다.
3. **`soundQuake` (Gray Area SF, 2012, Grade C/D)**:
   - USGS 베이 지역 카탈로그 규모를 흰색 3D 수직 막대 높이와 밴조 코드 볼륨에 매핑해 군발 지진의 리듬을 다성부 화음으로 들려주었다.
4. **SEISMOLIVE 적용 설계 분리 원칙**:
   - **채널 A (예술 전시 계층 — 기존 유지)**: [`LivingSoundfieldEngine.js`](file:///Users/katsina/Downloads/earth/js/audio/livingSoundfieldEngine.js)의 사건별 프로시저럴 공명 아키텍처(양양·경주·포항·구마모토·튀르키예)와 30 Hz 서브컷 컴프레서 및 침묵 규약은 그대로 보존한다.
   - **채널 B (과학 청각화 계층 — 신규 추가 가치 높음)**: [`StationWaveformBridge.js`](file:///Users/katsina/Downloads/earth/js/data/StationWaveformBridge.js)가 보유한 실측 `SeismicStationPacket`(또는 SAC 디코더 출력)을 `GeophysicsFolioView` 또는 계측 사건 상세 뷰에서 **이중 대역 스테레오 + $\arctan$ 압축 Web Audio `AudioBufferSourceNode`**로 재생하고, 파형/스펙트로그램 커서를 3D 파동장 `simTime` 또는 재생 커서와 동기화한다. 이 기능은 반드시 `[실측 파형 청각화 · 시간 압축 k배]`로 배지해 절차적 전시 음향과 구분한다.

---

## 4-4. 지역 3D 공간맵 (Mini Seoul 이중 역설계 · Seoul 3D Atlas · Seoul Data Atlas · S-Map)

이번 연구의 핵심 영역이다. **반드시 라이브 서비스(`https://metro.kgenots.com/`)와 공개 GitHub 저장소(`seongilp/mini-seoul-3d`)를 분리해 대조해야 한다.**

### 4-4-1. Mini Seoul 3D: 실제 서비스(`metro.kgenots.com`) vs. 공개 저장소(`seongilp/mini-seoul-3d`) 정밀 대조

| 비교 항목 | A. 실제 서비스 (`https://metro.kgenots.com/map` · `/changelog`, **Grade A**) | B. 공개 저장소 (`https://github.com/seongilp/mini-seoul-3d`, **Grade B**) | 분석 및 판정 |
| :--- | :--- | :--- | :--- |
| **기반 엔진 및 아키텍처** | `mini-tokyo-3d` (`nagix`, MIT) 직접 포크 (`window.mt3d`, `{Map, Marker, Panel, Popup, THREE, ThreeLayer}`) + Mapbox/MapLibre 스타일 호환 어댑터 | **독립 TypeScript/Vite 재구현** (`MapLibre GL 5.7.3` + `Three.js 0.170.0` `CustomLayerInterface`, `mt3d` 없음) | **서로 다른 코드베이스·세대임 확인.** 공개 저장소 README가 서비스와 다르다고 가정하면 안 됨 |
| **규모·데이터 패키지** | **33개 노선 · 808개 역 · 24,745편성**. `/data/*.json.gz` (railways, stations, features, congestion, timetable 등 12종) + Blob Worker 병렬 파싱 | **24개 노선 · 634개 역 · 32개 경로** (`public/data/network.json` 239KB + 4종 JSON, 총 ~701 KB 평문 JSON) | 라이브 서비스가 더 넓은 노선/시간표 볼륨 보유 및 `.json.gz` + Web Worker 파싱 사용 |
| **실시간 위치·지연 전략** | 호스트 cron이 6분마다 굽는 **`/live/delays.json` 지연 델타 피드**(실측 57건 지연 레코드). 피드에 없는 열차는 시간표대로 이동 | `README.md`는 "절차적 시뮬레이션"으로 서술되나, 실제 최신 `src/`에는 `state.live = true` 및 Vercel 프록시 `/api/subway/position` + **`LiveFleet` 추측항법 보정(`SNAP=1500m`, `CORRECTION_HALF_LIFE=2.5s`)** 구현됨 | **저장소 내부에서도 README가 구버전이고 코드(`src/live/`)가 더 앞서 있음**을 직접 코드 열람으로 확인. 라이브 서비스는 여기서 한 단계 더 나아가 서버 cron 정적 JSON 캐싱 구조 채택 |
| **3D 열차/객체 LOD** | 선택 열차를 편성 전체 량 단위로 렌더링(객체 텍스처 빈 필드에 선두 오프셋을 실어 셰이더에서 노선 거리 차감), 혼잡도 띠 색상 덮기 | `TrainLayer` (`THREE.InstancedMesh` 6종: body/roof/window/cab/headlight/taillight, `MAX_INSTANCES=4600`), **`MIN_TRAIN_PX=15`/`MIN_WIDTH_PX=5` 줌 픽셀 하한 보정**, **`CONSIST_ZOOM=13.2`에서 1덩어리→N량 분리 LOD** | 공개 저장소의 `TrainLayer`는 TypeScript + Three.js 표준 코드라 SEISMOLIVE가 직접 학습·재사용하기 매우 깔끔함 |
| **지하/투시·선택 강조** | 지상+지하 기본 모드(지하 열차 반투명), 역 선택 시 하단 시트 3단 드래그, 시네마 모드(30초 자동 전환 + UI 전체 숨김) | `setUnderground`: **건물 `fill-extrusion-opacity`를 `0.72 → 0.08`로 낮추어 지하/노선 강조**, `StationFocus`: 선택 역 펄스 링 | 건물/지형 불투명도를 낮춰 실내·지하·경로를 드러내는 **X-Ray 계층 분리 원리**가 SEISMOLIVE 건물/실내 진입에 직접 유효 |
| **삭제된 기능 사례 (`/changelog`)** | **"막차로 갈 수 있는 곳" 기능 의도적 삭제**: 환승 도보 시간을 3분 상수로 가정해 실제(종로3가·고속터미널 등)보다 낙관적으로 오인시켜 사람이 길에 남을 위험 때문에 폐기 | 해당 기능 미포함 | **"검증되지 않은 보행·환승 가정은 시각화에서 제거해야 한다"**는 SEISMOLIVE `GEMINI.md` / `GroundDataContract.js` 윤리와 정확히 공명 |

#### Mini Seoul 3D 공개 코드(`seongilp/mini-seoul-3d`)에서 추출된 핵심 알고리즘 3선
1. **화면 공간 AABB 충돌 회피 DOM 라벨러 (`src/map/stationLabels.ts`)**:
   - 중요도(환승 노선 수) 내림차순 사전 정렬 → 낮은 중요도 라벨이 높은 중요도 라벨과 겹치면 숨김.
   - `obstacles(container)`로 HUD 요소들(`#hud .brand, #hud .search, ...`)의 bounding box를 매 프레임 한 번에 읽어 `placed[]` 초기 장애물로 등록 → **라벨이 반투명 UI 카드 뒤로 비치는 현상 원천 차단**.
   - `document.fonts.ready` 이후 `item.width = 0` 초기화로 웹폰트 로딩 후 폭 재측정.
2. **누적 거리 테이블 + 이진 탐색 경로 보간 (`src/geo.ts` `cumulative`, `pointAlong`)**:
   - 폴리라인 정점별 누적 미터 거리 `dist[]`를 사전 계산하고, 임의 거리 `along`에 대해 `O(log N)` 이진 탐색으로 정확 좌표와 방위각(`headingDeg`)을 추출. SEISMOLIVE의 `651.9m` / `769.1m` 보행 경로 상 사용자·안내 마커 이동에 즉시 활용 가능.
3. **Eco 모드 프레임 격차 완화 (`src/main.ts` 603행) & 지오메트리 재사용**:
   - `const step = !state.eco || frameNo++ % 2 === 0`로 시뮬레이션/인스턴스 업데이트 주기를 절반으로 줄이고, GeoJSON 워커 재파싱 비용이 큰 라벨/기둥 갱신은 `250ms`~`400ms` 간격으로 쓰로틀링.

---

### 4-4-2. `Seoul 3D Atlas` (`synabreu/seoul-3d-atlas`, Grade B) — 자족형 오프라인 도시 3D 엔진 역설계

`mini-seoul-3d`와 달리 MapLibre 없이 **순수 Three.js만으로 서울 전역 건물·도로·하천·지형을 오프라인 패키징**한 사례다.

1. **초경량 Oriented Bounding Box (OBB) 바이너리 포맷 (`build_buildings.py` L23–37 & README L22)**:
   - OpenMapTiles zoom-14 PBF 벡터 타일의 건물 폴리곤에서 **가장 긴 변을 주축 각도 $a = \text{atan2}(\Delta y, \Delta x)$**로 삼아 회전 직교 좌표계 $(u, v)$로 정사영한 뒤, 중심·폭·깊이·각도·높이 6개 `float32` (`[x_km, z_km, w_km, d_km, a_rad, h_m]`, **건물당 24바이트**)만 `buildings.bin`에 패킹한다.
   - 복잡한 수십만 개 다각형 삼각분할 대신 단일 단위 `BoxGeometry(1,1,1)` + `THREE.InstancedMesh`로 렌더링하므로 드로우콜이 극도로 적고 API 키나 런타임 타일 서버가 전혀 필요 없다!
2. **$3\text{ km} \times 3\text{ km}$ 공간 타일 버킷 + 높이 우선순위 `InstancedMesh.count` LOD (`dist/app.js` L146–158)**:
   ```javascript
   // seoul-3d-atlas/dist/app.js 직접 분석 결과
   const key = Math.floor(row[0] / 3) + ',' + Math.floor(row[1] / 3); // 3km 타일 분할
   // 타일 내부에서 높이 >= 25m 랜드마크/고층건물을 앞쪽 인덱스로 정렬!
   rows.sort((a, b) => (b[5] >= 25 ? 2 + b[5]/555 : hash(b)) - (a[5] >= 25 ? 2 + a[5]/555 : hash(a)));
   const tall = rows.filter(r => r[5] >= 25).length;
   mesh.userData.overviewCount = tall + Math.ceil((rows.length - tall) * (mobile() ? 0.25 : 0.4));
   mesh.count = mesh.userData.overviewCount; // 광역 조망 시 mesh.count만 줄여 즉시 프러스텀/GPU 부하 감소!
   ```
   - 이 기법은 **버퍼를 재할당하지 않고 정수 `mesh.count` 속성 하나만 바꿔** 광역 카메라(고층 100% + 저층 25~40% 유지)와 근접 카메라(100% 전수 표시) 간 연속 LOD를 달성한다.
   - **약 4km 목표 반경(±2km, 또는 확장 시 3km 타일 단위 스트리밍)**인 SEISMOLIVE 지역 공간맵에 정확히 부합하는 데이터·렌더링 구조다.

---

### 4-4-3. `Seoul Data Atlas` (`urban-ai-institute/kra51-geospatial-visualization-module`, Grade B) — 야간 도시 정보 위계 역설계

1. **2군 레이어 위계 (`js/map.js` L2–135)**:
   - **Static Geo Fabric (물리적 야간 도시 배경)**: 경계선, 짙은 남청 무채색 건물(`#0A1118`, `minZoom: 11.25`), 2단계 도로 글로우(`arterial` vs `mid`, 주거 세도로는 과부하 방지를 위해 제외). 지표 데이터와 경쟁하지 않도록 어둡고 낮게 억제한 배경.
   - **Temporal Data Layers (동적 현상 레이어)**: 포인트 코어, 애디티브 할로, 영향 링.
2. **비시각 피킹 레이어 (`invisible pick layer`, `js/map.js` L8, 412)**:
   - 시각적 가독성을 위해 넣은 할로·글로우·반투명 폴리곤은 모두 `pickable: false`로 두고, 별도의 투명 피킹 지오메트리가 호버/클릭 이벤트를 전담해 GPU 피킹 오탐과 프레임 저하를 방지한다.
3. **카메라 범위(Camera Scope)와 데이터 입도(Data Grain)의 명시적 분리 (`js/map.js` L151–153)**:
   - 카메라가 서울 전역을 비추고 있더라도 데이터 레이어는 동(Dong) 단위나 특정 시설 단위를 유지할 수 있고, 반대로 근접 카메라에서도 광역 위험 경계를 함께 볼 수 있게 상태를 분리한다.
4. **Overlaid vs Interleaved WebGL 분리 (`js/map.js` L218–223)**:
   - README 및 코드 주석에 명시된 실측 교훈: *"deck.gl `MapboxOverlay`를 `interleaved: true`로 MapLibre와 깊이 버퍼 공유 시 히트맵/대형 할로가 찢어지는 현상(tearing)이 발생하여 의도적으로 `interleaved: false`로 분리했다."* → 이는 MapLibre+외부 3D 엔진 혼합 시 깊이 버퍼 통합의 난이도를 실증하는 중요한 근거다.

---

### 4-4-4. `서울 S-Map` (`smap.seoul.go.kr`, Grade A/C)

- HTML/JS 검사 결과 `ol3d_230328.min.js` + `three.js` + `proj4.js` + `FirstPersonControls.js` 조합으로 `eseoul.go.kr:5432` 자체 3D 타일을 스트리밍한다. 모바일 접속 시 *"현재 모바일 환경에서는 서울3D지도를 지원하지 않습니다"* 팝업을 띄우도록 하드웨어 제약이 걸려 있다.
- **참고 기능**: 2013~2025 연도별 건물, 건물/지형 투명화(`투명화 건물/지형`), 저화질 모드 토글, 경사도 분석, 실내공간 검색 탭 분리. **배제 대상**: 구형 jQuery/무거운 실사 3D 메쉬 타일(일반 학교 PC/모바일 호환 저하, 공공 포털 타일 무단 복제 불가).

---

## 4-5. 실내 디지털 트윈 및 건물 공간 표현

### 분석 대상: `ArcGIS Indoors` · `Apple IMDF (OGC Standard)` · `OpenIndoor / IndoorEqual (OSM Simple Indoor Tagging)`

1. **표준 실내 공간 계층 모델 (`IMDF` / `ArcGIS Indoors` 공통 원리)**:
   - `Building` (외곽, 주소/PNU) → `Level` (층 인덱스 `z`, 층고 `ordinal`, 도면 정합 변환 행렬) → `Unit` (`room`, `corridor`, `stairwell`, `elevator`, `restroom`) → `Opening / Detail` (문 폭·여닫이 방향·잠금 방식) → `Transition / Relationship` (층간 수직 엣지 + 실내외 포털 엣지).
2. **`OpenIndoor` / `IndoorEqual` 및 `Simple Indoor Tagging` 주의점**:
   - OSM `indoor=room|corridor|area|door`, `level=0;1`, `highway=steps|elevator` 태그는 데이터 모델로 매우 깔끔하다.
   - 단, `openindoor6` 및 `indoorequal` 코어 앱은 **`AGPL-3.0`** 라이선스이므로 소스 코드를 SEISMOLIVE에 직접 복사할 수 없다 (`maplibre-gl-indoorequal` 플러그인만 `BSD-3-Clause`).
3. **도면 미보유 건물의 정직한 표현 원칙**:
   - 국내 대다수 대학·일반 건물은 건축도면이 인터넷 비공개(`RESTRICTED`)이므로, OpenStreetMap `building:levels`와 건축물대장 `useAprDay`/`strctCdNm`/`rserthqkDsgnApplyYn`으로 **건물 외형(LOD1~2)과 층 슬래브 골격만 `VERIFIED`/`PARTIALLY_VERIFIED`로 표현**하고, 실제 현장 `KS S ISO 23601` 피난안내도 사진·측량(`GroundDataContract.js` 승인 절차)이 확보되기 전까지 내부 복도·호실·문 잠금 속성은 엄격히 **`PROVISIONAL` 반투명 와이어프레임**으로 유지해야 한다.

---

## 4-6. 지진 대응 및 경로 안내 (Hazard-Aware Routing & Behavioral Guidance)

### 분석 대상: `OpenRouteService (ORS)` · `Valhalla` · `OSRM` · `Ready.gov` · `FEMA App`

| 엔진 / 가이드 | 핵심 기술 메커니즘 | SEISMOLIVE 적용 가능성 |
| :--- | :--- | :--- |
| **OpenRouteService (`Apache-2.0`)** | ① **`wheelchair` 프로파일**: 단순 `steps=no`를 넘어 경사(`incline`), 연석 높이(`sloped_curb`), 노면 포장(`surface`/`smoothness`), 통과 폭(`width`)을 그래프로 필터링.<br>② **`avoid_polygons`**: 요청 시 GeoJSON 위험 폴리곤(붕괴 외벽 반경, 낙하물 구역, 침수/액상화 구역)을 동적으로 우회. | [`PedestrianRoutingEngine.js`](file:///Users/katsina/Downloads/earth/js/response/PedestrianRoutingEngine.js)의 "무단차(Step-Free) ≠ 휠체어 검증 완료" 구분 및 `Hazard Polygon Exclusion` 확장에 직접 적용 가능. |
| **Valhalla (`MIT`)** | **동적 런타임 비용 함수(`costing_options`)**: 미리 고정 가중치(Contraction Hierarchies)로 구운 그래프와 달리, 요청마다 `step_penalty`, `max_grade`, `walkway_factor`를 즉시 바꿔 경로를 재탐색. | 지진 발생 직후(야간·여진 경보·사용자 부상 여부)에 따라 동일 그래프의 비용 파라미터만 즉시 바꾸는 설계 원리 흡수. |
| **OSRM (`BSD-2-Clause`)** | CH(초고속 정적) vs MLD(계층 분할 동적 가중치). 광역 대도시 차량망에 최적화. | 4km 반경 정밀 보행망에는 오버스펙이며 계단/실내외/볼라드 속성 표현력이 ORS/Valhalla보다 제한적. |
| **Ready.gov Earthquakes & FEMA App** | 상황별 구체적 행동 분기:<br>• **실내**: `Drop, Cover, Hold On` (외벽/유리창/무거운 가구 회피, 흔들리는 중 탈출 금지)<br>• **휠체어 이용자**: **`Lock, Cover, Hold On` (바퀴 잠금 후 이동·하차 금지, 엎드려 머리/목 방호)**<br>• **야외/대피소**: 전선/건물/옹벽 이격, 통신 두절 대비 오프라인 대피소 조회(SMS `43362` 패턴 → 로컬 프리패키지 대응). | [`SituationAssessmentEngine.js`](file:///Users/katsina/Downloads/earth/js/response/SituationAssessmentEngine.js)의 `isWheelchair` 지침을 단순 안내에서 **`Lock, Cover, Hold On`** 프로토콜로 격상하고, 4km 로컬 패키지의 완전 오프라인 대피소 조회로 연결. |

---
*다음 문서: [`SEISMOLIVE_ASSET_EXTRACTION.md`](file:///Users/katsina/Downloads/earth/docs/research/SEISMOLIVE_ASSET_EXTRACTION.md) (추출 가능한 12대 핵심 구현 자산 상세 스펙)*
