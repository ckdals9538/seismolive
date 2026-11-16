# DATA_FLOW_AND_INTEGRATION.md
> SEISMOLIVE 데이터 파이프라인·출처 추적·불확실성 전파 설계서

---

## 1. End-to-End 데이터 흐름 아키텍처

```
[1. 지진 데이터 소스]
  ├── KMA 국내 계측 피드(향후) + instrumentalCatalogDB.js   (OBSERVED / OFFICIAL)
  ├── USGS GeoJSON 4.5+ + Detail(ShakeMap/OAF)            (OBSERVED / OFFICIAL / PROVISIONAL)
  ├── historicalArchiveDB.js (조선왕조실록·승정원일기 등)     (HISTORICAL / UNCERTAIN)
  └── AutoScenarioResolver (지역 환경 기반 자동 시나리오)     (EDUCATIONAL_SYNTHETIC / MODELLED)
           │
           ▼  UnifiedEarthquakeNormalizer + CrossAgencyDeduplicator
  [ActiveHazardContext] { event, propagationModel, officialProducts, provenance }
           │
           ├───────────────────────────────────────────┐
           ▼                                           ▼
[2. 사용자/분석 위치 소스]                      [3. 지역 공간 데이터 소스]
  LocationProvider                             ├── AWS Mapzen Terrarium DEM (고도 + 오차/폴백 구분)
  ├── GPS (OBSERVED, ±accuracyMeters)          ├── 지구본 Copernicus 30m .bin (연속 지형 메타 공유)
  └── 지명검색/지도클릭/사건진앙 (USER_SELECTED) ├── OSM / Overpass (최대 4km+ 동적 확장)
           │                                   │     ├── BuildingProvider (외곽/높이만, 내부 미생성)
           │                                   │     ├── RoadNetworkProvider (도보, 교량, 수계)
           │                                   │     └── FacilityProvider (개활지/학교/집결지)
           │                                   └── (향후) 행정안전부 지진옥외대피장소 공식 API
           │                                           │
           └───────────────────┬───────────────────────┘
                               ▼
                 [4. HazardAssessment + SituationAssessmentEngine]
                   ├── 거리/방위/P·S파 이론 도달 (진앙 ≠ 분석위치)
                   ├── ShakeMap 실측 MMI/PGA 우선 적용 (없으면 보수적 거리 스크리닝)
                   ├── 수계 범람/저지대/낙하물 밀집 플래그
                   └── 공간 완전성 (SUFFICIENT / PARTIAL / INSUFFICIENT)
                               │
                               ▼  (대피 적합 시에만 라우팅 허용)
                 [5. PedestrianRoutingEngine + CampusWalkRouter]
                   ├── 건물 OBB 회피 (외벽 이격 고려)
                   ├── 비교량 수계/하천 횡단 원천 배제
                   └── 최단 / 계단회피 / 엣지 중복 페널티 대체 경로
                               │
                               ▼
                 [6. Unified 3D Visuals & Human Response UI]
                   ├── LocalSpatialMapLayer (실측 건물/도로/수계/신뢰도 핀)
                   ├── HanyangResponseAdapter (웨이포인트 직선 일치 3D 리본)
                   └── EvacuationExperienceController (안전수칙 · 선정근거 · 한계 배지)
```

---

## 2. 핵심 도메인 데이터 계약 & 불확실성 전파 규칙

모든 단계는 원시 숫자만 넘기지 않고 **`ProvenanceEnvelope`**를 동반 전달해야 한다([ResponseDomainTypes.js](file:///Users/katsina/Downloads/earth/js/response/ResponseDomainTypes.js)의 `createProvenanceRecord` 확장).

### 2.1 출처 등급 (`DATA_ORIGIN_TYPES`)
1. `OBSERVED`: 계기 관측값 (KMA/USGS 관측 지진, 관측소 파형, 브라우저 GPS 실측)
2. `OFFICIAL`: 국가·국제 공인 행정/과학 산출물 (USGS ShakeMap/OAF, 향후 행안부 공식 대피소 API, 공인 DEM)
3. `MODELLED`: 물리·거리 모델 산출값 (P/S파 주시 모델 `Vp=6.0, Vs=3.5 km/s`, 거리-규모 영향 반경)
4. `SYNTHETIC`: 교육·훈련용 가상 생성 시나리오 (`AutoScenarioResolver`가 생성한 가상 단층)
5. `PROVISIONAL`: 커뮤니티 매핑·미검증 데이터 (OSM 건물/공원/집결지 태그 — 현장 개방·내진성 미검증)
6. `UNKNOWN`: 결측 또는 확인 불가 (`null` 보존, 0 또는 임의 수치 치환 절대 금지)

### 2.2 지진 이벤트 정규화 및 중복 통합 (`CrossAgencyDeduplicator`)
* **문제**: [usgsFeedConnector.js](file:///Users/katsina/Downloads/earth/js/data/usgsFeedConnector.js)의 `buildUnifiedMasterCatalog`는 현재 문자열 `id` 중복만 검사한다. 동일 국내 지진에 대해 KMA(예: `KMA_20160912...`)와 USGS(예: `us10006p1f`)는 서로 다른 ID·규모(`ML 5.8` vs `Mw 5.4/5.5`)·진앙(±수 km 차이)을 가진다.
* **통합 규칙**:
  - **시공간 매칭 키**: `|Δt| ≤ 120초` AND `측지 거리 ≤ 50 km` AND `|ΔM| ≤ 1.0`.
  - **권위 우선 및 병합**: 한반도 내륙·연안 영역(`lat 32~40°N, lon 123~132°E`)에서는 **KMA 공식 진원/국내 규모(ML)** 를 주 값으로 채택하고, **USGS ComCat Detail(ShakeMap, MMI, OAF, 글로벌 단층 해)** 을 `supplementalProducts`로 병합한다.
  - **불확실성 보존**: 두 기관 진앙/규모가 다를 경우 덮어쓰지 않고 `primarySource` + `alternateSources[]`에 모두 보존한다.

### 2.3 공식 위험 산출물(ShakeMap/OAF)의 지역 전달 파이프라인
* 현재 [UsgsOfficialProductsBridge.js](file:///Users/katsina/Downloads/earth/js/data/UsgsOfficialProductsBridge.js)는 `GeophysicsFolioView`에서만 사용되고 있다.
* 목표 통합 흐름:
  1. 지구본 사건 선택 시 `detailUrl` 또는 로컬 스냅샷에서 `extractOfficialUsgsProducts(detailJson)` 실행.
  2. `shakemap`이 존재하고 `contMmiUrl`이 확보되면, 사용자 `analysisAnchor`가 속한 MMI 등진도 권역 또는 `maxPgaPctG`/`maxMmi` 정보를 `ActiveHazardContext.officialProducts`로 넘긴다.
  3. **전달 우선순위**:
     - 실측 관측소 파형([StationWaveformBridge.js](file:///Users/katsina/Downloads/earth/js/data/StationWaveformBridge.js))이 해당 사건·지역 인근에 존재하면 `OBSERVED_STATION` 지반 운동으로 활용 (없으면 `0.08g`/`0.22g` 하드코딩 금지, `null` 유지).
     - `shakemap` 등진도가 존재하면 거리 기반 단순 영향 반경보다 우선해 영향권 판단 참고(`OFFICIAL`)에 반영.
     - 둘 다 없으면 `MODELLED` 거리-규모 보수적 스크리닝 반경으로만 판단하고, *"실측 지반 가속도 미확보(모델 추정)"* 경고를 UI까지 전파.

### 2.4 사용자 위치 ↔ 분석 범위 ↔ 공간 데이터 연결 계약
| 데이터 필드 | 의미 및 책임 | 절대 금지 사항 |
| :--- | :--- | :--- |
| `userActualLocation` | GPS 등으로 확인된 사용자의 실제 좌표 | 지진 진앙이나 도시 중심과 덮어쓰지 말 것 |
| `analysisAnchor` | 현재 3D 공간 분석·DEM·OSM 조회 기준점 | 사용자가 특정 지역을 조회했다고 그곳을 사용자 거주 건물 내부로 가정하지 말 것 |
| `searchRadiusMeters` | 초기 `~900~2000m`(4km 영역) → 데이터 부족 시 동적 확장 | 4km를 넘어서는 시설이 필요한 외곽/농어촌에서 하드코딩 상한으로 탐색을 포기하지 말 것 |
| `building.indoorScope` | `HEIGHT_ONLY_3D` / `FOOTPRINT_ONLY` / `LEVEL_COUNT_ONLY` (범용 지역) | 미확인 건물에 가상 3층·계단·출구·호실을 만들어내지 말 것 |
| `facility.candidateStatus` | `CONFIRMED` / `CONDITIONAL` / `UNKNOWN` / `UNAVAILABLE` | OSM 공원·학교를 행안부 공식 대피소(`CONFIRMED`)로 과장 표기하지 말 것 |
| `route.safetyVerified` | `false` 기본 (기하학적 무충돌 계산 성공 ≠ 실제 지진 후 안전 보증) | 경로 탐색 `found: true`를 `"안전이 보장된 경로"`로 표현하지 말 것 |

### 2.5 단계 간 전달 불확실성 체크리스트 (UI Surface Contract)
최종 `EvacuationExperienceController`의 HUD는 반드시 다음 4개 출처 상태를 하나의 맥락으로 표시한다:
1. **지진 출처**: 실제 관측(`OBSERVED`) vs 교육용 자동 시나리오(`SYNTHETIC`) vs 역사 사료(`HISTORICAL · 규모 미상`)
2. **위치 출처**: 내 GPS 위치(`OBSERVED ±Xm`) vs 자유 지정 지역(`USER_SELECTED`)
3. **공간 완전성**: `SUFFICIENT` / `PARTIAL` / `INSUFFICIENT` (건물·도로·DEM 결측 명시)
4. **대피 후보지 상태**: `CONFIRMED` / `CONDITIONAL (개방·지정 여부 현장 확인 필요)` / `UNAVAILABLE`
