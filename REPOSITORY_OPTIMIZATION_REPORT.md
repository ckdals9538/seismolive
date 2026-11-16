# SEISMOLIVE v4.0 — Repository Optimization & Structural Consolidation Report

> **Phase 1 Deliverable (Inventory, Classification, Dependency Audit & Consolidation Plan)**  
> **Scope Constraint (Section 8)**: 본 1차 보고서는 전체 인벤토리·의존성 조사·분류·최적화 계획 수립 단계로, **기존 소스 코드·데이터·HTML·에셋 파일의 실제 삭제나 이동을 전혀 수행하지 않은 상태**에서 작성되었습니다. 실제 파일 정리·이동·삭제는 본 계획 검토 및 승인 이후 2차 실행 단계에서 최소 범위로 진행합니다.

---

## 1. 기존 프로젝트 구조 분석 (STEP A — Current State Preservation & Inventory)

### 1.1 Git 상태, 워크트리 및 미커밋 자산 현황

- **현재 브랜치**: `main` (`HEAD -> e6626a3`, `origin/main`과 동기화됨)
- **연결된 Git Worktree**: `/Users/katsina/Downloads/seismolive-clean` (`63b4c84 [v4-reconstruction]`)
- **`.git` 저장소 객체 크기**: **`1.00 GiB`** (`964`개 loose 객체, `0`개 packfile). 대용량 GeoTIFF 원본(`ETOPO_2022_v1_60s_N90W180_surface.tif` 465.97 MB, `Copernicus_DSM_COG_10_N37_00_E128_00_DEM.tif` 45.14 MB) 및 과거 G2 캡처 GIF/MP4 블롭이 `v4-reconstruction` 워크트리 커밋 이력에 참조되어 있으며 pack/gc가 수행되지 않은 상태입니다.
- **미추적(Untracked, `??`) 활성 파일 (23건)**:
  - **루트 (9건)**: `MODERN_SEISMIC_ANALYSIS_BLUEPRINT.md`, `MODERN_SEISMIC_SCIENTIFIC_AUDIT.md`, `MODERN_SEISMIC_VALIDATION_MATRIX.md`, `viewer_p1_2.html`, `viewer_p1_3.html`, `viewer_p2_3.html`, `viewer_p2_4.html`, `viewer_p2_5.html`, `viewer_p2_6.html`
  - **현대 지진학·파형 모듈 (3건)**: [StationWaveformBridge.js](file:///Users/katsina/Downloads/earth/js/data/StationWaveformBridge.js) (35,683 B), [sacBinaryDecoder.js](file:///Users/katsina/Downloads/earth/js/data/sacBinaryDecoder.js) (37,684 B), [ModernSeismicSolvers.js](file:///Users/katsina/Downloads/earth/js/geophysics/ModernSeismicSolvers.js) (29,802 B)
  - **개인화 지진 대응 엔진 (`js/response/`, 12건 · 175,350 B)**:
    - [LocalTangentAnchor.js](file:///Users/katsina/Downloads/earth/js/response/LocalTangentAnchor.js) (6,981 B)
    - [HanyangBuildingData.js](file:///Users/katsina/Downloads/earth/js/response/HanyangBuildingData.js) (8,442 B)
    - [IndoorOutdoorConnector.js](file:///Users/katsina/Downloads/earth/js/response/IndoorOutdoorConnector.js) (8,954 B)
    - [PedestrianRoutingEngine.js](file:///Users/katsina/Downloads/earth/js/response/PedestrianRoutingEngine.js) (22,031 B)
    - [ResponseStateMachine.js](file:///Users/katsina/Downloads/earth/js/response/ResponseStateMachine.js) (13,453 B)
    - [HanyangResponseAdapter.js](file:///Users/katsina/Downloads/earth/js/response/HanyangResponseAdapter.js) (23,319 B)
    - [GlobalLocalCameraTransition.js](file:///Users/katsina/Downloads/earth/js/response/GlobalLocalCameraTransition.js) (11,259 B)
    - [PersonalResponseInteraction.js](file:///Users/katsina/Downloads/earth/js/response/PersonalResponseInteraction.js) (11,187 B)
    - [SituationAssessmentEngine.js](file:///Users/katsina/Downloads/earth/js/response/SituationAssessmentEngine.js) (22,728 B)
    - [ResponseUIAdapter.js](file:///Users/katsina/Downloads/earth/js/response/ResponseUIAdapter.js) (18,618 B)
    - [ResponseTimelineSimulator.js](file:///Users/katsina/Downloads/earth/js/response/ResponseTimelineSimulator.js) (10,221 B)
    - [GroundDataContract.js](file:///Users/katsina/Downloads/earth/js/response/GroundDataContract.js) (18,157 B)

> [!CAUTION]
> **`.gitignore`와 `.cfignore` 혼용으로 인한 버전 관리 사각지대 발견**  
> 현재 [`.gitignore`](file:///Users/katsina/Downloads/earth/.gitignore)에 Cloudflare Pages 배포 제외 파일인 [`.cfignore`](file:///Users/katsina/Downloads/earth/.cfignore)와 거의 동일한 패턴(`tests/`, `scripts/`, `docs/`, `.agents/`)이 들어가 있습니다. 이로 인해 **`tests/` 내 25개 전체 테스트 스위트 및 2개 SAC 픽스처(tracked 0건)**, `scripts/` 신규 스크립트 2건(`capture_event_frames.js`, `verify_interactive_geophysics_and_lighting.js`), `.agents/skills/unslop-ui/SKILL.md`가 Git에서 무시(`!!`)되고 있어 커밋 보호를 받지 못하고 있습니다.

### 1.2 전체 디렉터리 및 파일 용량 인벤토리

`.git/`을 제외한 작업 디렉터리 전체는 **730개 파일, 1,207,959,190 B (`1,152.000 MB`)**로 구성됩니다.

| 디렉터리 | 파일 수 | 총 바이트 (B) | 용량 (MB) | 비중 | 주요 구성 내용 |
| :--- | ---: | ---: | ---: | ---: | :--- |
| `assets/` | 56 | 704,113,442 | 671.495 | 58.29% | 원본 GeoTIFF 8개 (590.132 MB), 파생 `.bin`/`.json` (79.908 MB), GeoJSON 2개 (0.614 MB), 시각 레퍼런스 4개 (1.493 MB) |
| `archive/` | 284 | 310,062,213 | 295.698 | 25.67% | 과거 G2 단계 캡처 GIF/MP4/PNG 182개 (293.920 MB), 레거시 2D/3D 엔진·프로토타입·문서·스크립트 |
| `captures/` | 75 | 99,699,274 | 95.081 | 8.25% | G1 LookDev 및 단계별 검증 PNG 캡처 74개 + `.DS_Store` |
| `scratch/` | 175 | 89,464,741 | 85.320 | 7.41% | 일회성 진단/빌드 스크립트 50개, 임시 PNG 캡처 119개 (83.490 MB), HTML 프로토타입 3개, `test_etopo_header.bin` (1.000 MB) |
| `js/` | 35 | 3,279,413 | 3.127 | 0.27% | 핵심 애플리케이션·지구/지형/파동/음향/데이터/현대지진학/개인대응 모듈 + `js/lib/` + `.DS_Store` |
| `docs/` | 32 | 599,637 | 0.572 | 0.05% | 아키텍처, 개발 일지(`DEVELOPMENT_JOURNAL.md`), G1/G2/Phase D 보고서 |
| `tests/` | 27 | 369,174 | 0.352 | 0.03% | Deno JS 테스트 24개, Python LOD 테스트 1개, binary SAC 테스트 픽스처 2개 |
| `(root)` | 15 | 142,306 | 0.136 | 0.01% | [index.html](file:///Users/katsina/Downloads/earth/index.html), `viewer_*.html` 6개, [GEMINI.md](file:///Users/katsina/Downloads/earth/GEMINI.md), `MODERN_SEISMIC_*.md` 3개, 설정/메타 파일 |
| `scripts/` | 20 | 127,090 | 0.121 | 0.01% | GeoTIFF → UNORM16 전처리(Python/Deno) 및 Playwright 검증 스크립트 |
| `.agents/` | 8 | 51,278 | 0.049 | <0.01% | [art_direction.md](file:///Users/katsina/Downloads/earth/.agents/rules/art_direction.md) 및 7개 에이전트 스킬 (`SKILL.md`) |
| `css/` | 2 | 50,632 | 0.048 | <0.01% | [theme.css](file:///Users/katsina/Downloads/earth/css/theme.css) (5,042 B), [surface.css](file:///Users/katsina/Downloads/earth/css/surface.css) (45,590 B) |
| **합계** | **730** | **1,207,959,190** | **1,152.000** | **100.00%** | `.git/` (`1.00 GiB`) 제외 기준 |

#### 상위 15개 대용량 파일 (2 MB 이상)

| 순위 | 파일 경로 | 용량 (Bytes) | 용량 (MB) | 분류 및 용도 |
| :---: | :--- | ---: | ---: | :--- |
| 1 | `assets/terrain/bathymetry/ETOPO_2022_v1_60s_N90W180_surface.tif` | 465,969,062 | 444.383 | 전지구 ETOPO 2022 60초 원본 GeoTIFF (로컬 빌드 소스) |
| 2 | `assets/terrain/copernicus/Copernicus_DSM_COG_10_N37_00_E128_00_DEM.tif` | 45,141,829 | 43.051 | Copernicus GLO-30 N37E128 원본 GeoTIFF |
| 3 | `assets/terrain/bathymetry/ETOPO_2022_v1_15s_N45E030_surface.tif` | 30,731,224 | 29.308 | ETOPO 2022 15초 튀르키예권 타일 원본 GeoTIFF |
| 4 | `archive/legacy_captures/g2_phase4_1/g2_phase4_1_full_sequence_20s.gif` | 26,934,791 | 25.687 | 과거 G2 Phase 4.1 프리뷰 GIF |
| 5 | `assets/terrain/bathymetry/ETOPO_2022_v1_15s_N45E120_surface.tif` | 20,965,352 | 19.994 | ETOPO 2022 15초 한반도 서·중부 타일 원본 GeoTIFF |
| 6 | `assets/terrain/bathymetry/ETOPO_2022_v1_15s_N45E120_geoid.tif` | 19,015,181 | 18.134 | ETOPO 2022 15초 N45E120 지오이드 기준 원본 GeoTIFF |
| 7 | `assets/terrain/copernicus/Copernicus_DSM_COG_10_N38_00_E128_00_DEM.tif` | 18,904,152 | 18.028 | Copernicus GLO-30 N38E128 원본 GeoTIFF (`test_seorak_profile_lod.py` 참조) |
| 8 | `assets/terrain/bathymetry/ETOPO_2022_v1_15s_N45E135_surface.tif` | 17,959,004 | 17.127 | ETOPO 2022 15초 동해·일본해역 타일 원본 GeoTIFF |
| 9 | `assets/terrain/bathymetry/global_etopo_elevation_4096_unorm16.bin` | 16,777,216 | 16.000 | 전지구 4K UNORM16 바이너리 (`test_phase_e_continuous_earth.js` 검증용) |
| 10 | `archive/legacy_captures/g2_phase5/g2_phase5_preview.gif` | 12,619,325 | 12.035 | 과거 G2 Phase 5 프리뷰 GIF |
| 11 | `archive/legacy_captures/g2_phase6/g2_phase6_preview.gif` | 12,377,394 | 11.804 | 과거 G2 Phase 6 프리뷰 GIF |
| 12 | `archive/legacy_captures/g2_phase5_2/g2_phase5_2_preview.gif` | 12,298,910 | 11.729 | 과거 G2 Phase 5.2 프리뷰 GIF |
| 13 | `archive/legacy_captures/g2_phase4/earth_moves_in_form_memory_rises_in_language.gif` | 10,692,228 | 10.197 | 과거 G2 Phase 4 프리뷰 GIF |
| 14 | `archive/legacy_captures/g2_phase3/earth_wave_blooms_memory_forms.gif` | 7,842,356 | 7.479 | 과거 G2 Phase 3 프리뷰 GIF |
| 15 | `assets/terrain/copernicus/expanded_seorak_gangneung_unorm16.bin` (+ `seoraksan_yangyang_float32.bin`, `gangneung_odaesan_float32.bin` 각 7,776,000 B) | 7,776,000 | 7.416 | G1 초기 중간 산출물 (현행 런타임·테스트 미참조) |

### 1.3 HTML 진입점 및 모듈 `import`/`export` 의존성 분석

1. **주 프로덕션 서비스 진입점: [`index.html`](file:///Users/katsina/Downloads/earth/index.html)**
   - CSS: [theme.css](file:///Users/katsina/Downloads/earth/css/theme.css), [surface.css](file:///Users/katsina/Downloads/earth/css/surface.css)
   - 전역 스크립트: [three.min.js](file:///Users/katsina/Downloads/earth/js/lib/three.min.js), [OrbitControls.js](file:///Users/katsina/Downloads/earth/js/lib/OrbitControls.js)
   - ES Module 진입점: [main.js](file:///Users/katsina/Downloads/earth/js/main.js) (3,832 lines) → 14개 핵심 모듈 import:
     - Data: [historicalArchiveDB.js](file:///Users/katsina/Downloads/earth/js/data/historicalArchiveDB.js), [instrumentalCatalogDB.js](file:///Users/katsina/Downloads/earth/js/data/instrumentalCatalogDB.js), [usgsFeedConnector.js](file:///Users/katsina/Downloads/earth/js/data/usgsFeedConnector.js), [eventCatalogHelpers.js](file:///Users/katsina/Downloads/earth/js/data/eventCatalogHelpers.js)
     - 3D/Geodetic/Wavefield: [geodeticEllipsoidCoord.js](file:///Users/katsina/Downloads/earth/js/3d/geodeticEllipsoidCoord.js), [terrainDataResolver.js](file:///Users/katsina/Downloads/earth/js/3d/terrainDataResolver.js), [seismicSourceModel.js](file:///Users/katsina/Downloads/earth/js/3d/seismicSourceModel.js), [universalWavefieldEngine.js](file:///Users/katsina/Downloads/earth/js/3d/universalWavefieldEngine.js), [wavefieldVisualOrchestrator.js](file:///Users/katsina/Downloads/earth/js/3d/wavefieldVisualOrchestrator.js), [livingMemoryEngine.js](file:///Users/katsina/Downloads/earth/js/3d/livingMemoryEngine.js)
     - Audio & Geophysics: [livingSoundfieldEngine.js](file:///Users/katsina/Downloads/earth/js/audio/livingSoundfieldEngine.js), [TravelTimeSolvers.js](file:///Users/katsina/Downloads/earth/js/geophysics/TravelTimeSolvers.js)
     - UI: [DiscoveryBeacons.js](file:///Users/katsina/Downloads/earth/js/ui/DiscoveryBeacons.js), [UnifiedControlSurface.js](file:///Users/katsina/Downloads/earth/js/ui/UnifiedControlSurface.js)
   - 런타임 정적 데이터 fetch: `assets/terrain/ne_110m_land.geojson`, `assets/terrain/bathymetry/fused_seorak_donghae_unorm16.bin`, [terrainDataResolver.js](file:///Users/katsina/Downloads/earth/js/3d/terrainDataResolver.js) 경유 전지구(`global_etopo_elevation_2048_unorm16.bin`)·지역(`regional_*_unorm16.bin`, `korea_macro_elevation_unorm16.bin`)·동적 템플릿 `assets/terrain/copernicus/tier2_yangyang_${resolution}.bin` (`256`/`512`/`768`), [usgsFeedConnector.js](file:///Users/katsina/Downloads/earth/js/data/usgsFeedConnector.js) 경유 `assets/data/usgs_4.5_month.geojson`.
2. **글로벌→개인화 통합 시연 진입점: [`viewer_p2_6.html`](file:///Users/katsina/Downloads/earth/viewer_p2_6.html)**
   - [three.module.js](file:///Users/katsina/Downloads/earth/js/lib/three.module.js) 및 `js/response/` 통합 모듈 6종([HanyangResponseAdapter.js](file:///Users/katsina/Downloads/earth/js/response/HanyangResponseAdapter.js), [GlobalLocalCameraTransition.js](file:///Users/katsina/Downloads/earth/js/response/GlobalLocalCameraTransition.js), [ResponseUIAdapter.js](file:///Users/katsina/Downloads/earth/js/response/ResponseUIAdapter.js), [PedestrianRoutingEngine.js](file:///Users/katsina/Downloads/earth/js/response/PedestrianRoutingEngine.js), [HanyangBuildingData.js](file:///Users/katsina/Downloads/earth/js/response/HanyangBuildingData.js), [SituationAssessmentEngine.js](file:///Users/katsina/Downloads/earth/js/response/SituationAssessmentEngine.js))을 직접 로드하며, 전이적 의존성으로 [LocalTangentAnchor.js](file:///Users/katsina/Downloads/earth/js/response/LocalTangentAnchor.js), [IndoorOutdoorConnector.js](file:///Users/katsina/Downloads/earth/js/response/IndoorOutdoorConnector.js), [ResponseStateMachine.js](file:///Users/katsina/Downloads/earth/js/response/ResponseStateMachine.js), [geodeticEllipsoidCoord.js](file:///Users/katsina/Downloads/earth/js/3d/geodeticEllipsoidCoord.js)를 사용합니다.
3. **테스트·검증 전용 독립 모듈 (프로덕션 HTML 미연결, 삭제 금지)**:
   - [ModernSeismicSolvers.js](file:///Users/katsina/Downloads/earth/js/geophysics/ModernSeismicSolvers.js), [sacBinaryDecoder.js](file:///Users/katsina/Downloads/earth/js/data/sacBinaryDecoder.js), [StationWaveformBridge.js](file:///Users/katsina/Downloads/earth/js/data/StationWaveformBridge.js): 각각 대응 테스트 스위트(`test_modern_seismic_solvers.js`, `test_sac_binary_decoder.js`, `test_station_waveform_bridge.js`)로 검증됨.
   - [GroundDataContract.js](file:///Users/katsina/Downloads/earth/js/response/GroundDataContract.js), [ResponseTimelineSimulator.js](file:///Users/katsina/Downloads/earth/js/response/ResponseTimelineSimulator.js): 각각 P2.5·P3.0·P3.1 테스트에서 검증됨.
   - [PersonalResponseInteraction.js](file:///Users/katsina/Downloads/earth/js/response/PersonalResponseInteraction.js): [viewer_p1_3.html](file:///Users/katsina/Downloads/earth/viewer_p1_3.html) 및 `test_p1_3_spatial_continuity.js`에서 사용.
4. **미참조 라이브러리 (0건 참조)**:
   - [geotiff.js](file:///Users/katsina/Downloads/earth/js/lib/geotiff.js) (235,433 B): 활성 앱·뷰어·테스트·스크립트 어디에서도 참조하지 않음 (`scripts/`는 Deno `npm:geotiff` 사용).

---

## 2. 파일 분류 (STEP B — File Classification Matrix)

| 영역 | 세부 경로 / 파일군 | 파일 수 | 용량 (MB) | 분류 (A~E) | 조치 태그 | 근거 |
| :--- | :--- | ---: | ---: | :--- | :--- | :--- |
| 핵심 3D·지리·파동 | `js/main.js`, `js/3d/*`, `js/audio/*`, `js/ui/*`, `css/*` | 12 | 0.440 | A. CORE SOURCE | **KEEP** | `index.html` 주 렌더링 및 아트 디렉션 파이프라인 |
| 데이터·지진학 | `js/data/*` (6), `js/geophysics/*` (2) | 8 | 0.383 | A. CORE SOURCE | **KEEP** | 역사·계측 카탈로그, 현대 지진학 역산·SAC 디코더 |
| 개인화 대응 엔진 | `js/response/*` (12) | 12 | 0.167 | A. CORE SOURCE | **KEEP** | P1.1~P3.1 개인화 대응 및 P3.1 데이터 적재 계약 |
| 서드파티 라이브러리 | `js/lib/{three.min.js,OrbitControls.js,three.module.js}` | 3 | 1.878 | A. CORE SOURCE / E. DEPLOYMENT | **KEEP** | 프로덕션 및 통합 뷰어 WebGL 런타임 |
| 미사용 라이브러리 | `js/lib/geotiff.js` | 1 | 0.225 | C. DEVELOPMENT | **ARCHIVE / DELETE_CANDIDATE** | 런타임·스크립트·테스트 0건 참조 (오프라인은 `npm:geotiff` 사용) |
| 원본 GeoTIFF | `assets/terrain/{bathymetry,copernicus}/*.tif` | 8 | 590.132 | B. SCIENTIFIC DATA | **KEEP** *(로컬 보존 / `.cfignore`)* | ETOPO 2022 및 Copernicus 30m 과학 원본 데이터 (`.tif` 배포 제외) |
| 활성 프로덕션 에셋 | `global_etopo_2048`, `fused_seorak_donghae`, `korea_macro`, 8종 `regional_*`, `tier2_yangyang_{256,512,768}.bin`, GeoJSON 2종 | 27 | 24.931 | B. SCIENTIFIC DATA / E. DEPLOYMENT | **KEEP** | `js/main.js`, `terrainDataResolver.js`, `usgsFeedConnector.js` 런타임 필수 파일 |
| 4K 테스트 지형 | `global_etopo_elevation_4096_unorm16.{bin,json}`, `historical_event_coverage_assessment.json` | 3 | 16.019 | B. SCIENTIFIC DATA / C. DEVELOPMENT | **KEEP** *(로컬 보존 / `.cfignore` 배포 제외)* | `test_phase_e_continuous_earth.js` 필수 픽스처 (프로덕션은 2048 사용) |
| G1 중간 파이프라인 `.bin` | `donghae_ulleung_macro*`, `expanded_seorak_gangneung*`, `{seoraksan_yangyang,gangneung_odaesan}_{float32,stitched_unorm16,unorm16}*`, `verification_log.txt` | 12 | 38.904 | B. SCIENTIFIC DATA (파생 중간체) | **ARCHIVE** *(외부 아카이브 이동/배포 제외)* | G1 Step 0~3 단계 중간 산출물. 현행 런타임·테스트 참조 0건 |
| 레퍼런스 보드 | `assets/references/*` | 4 | 1.493 | D. DOCUMENTATION | **MOVE / `.cfignore`** | `docs/references/`로 이동 또는 `.cfignore`에 추가해 웹 배포 제외 |
| 서비스 진입점 | `index.html`, `viewer_p2_6.html`, `.cfignore` | 3 | 0.034 | E. DEPLOYMENT | **KEEP** | 글로벌 지구본 및 P2.6 통합 전시 진입점 |
| 단계별 개발 뷰어 | `viewer_p1_2.html`, `viewer_p1_3.html`, `viewer_p2_3.html`, `viewer_p2_4.html`, `viewer_p2_5.html` | 5 | 0.047 | C. DEVELOPMENT | **MOVE** | `dev/viewers/`로 분리 (상대 import 경로 `./js/` → `../../js/` 보정 후 유지) |
| 테스트·스크립트 | `tests/` (27), `scripts/` (20) | 47 | 0.473 | C. DEVELOPMENT | **KEEP** | `.gitignore`에서 제외 해제해 Git 추적 복구, `.cfignore`로 배포 제외 유지 |
| 루트 과학 문서 | `MODERN_SEISMIC_{ANALYSIS_BLUEPRINT,SCIENTIFIC_AUDIT,VALIDATION_MATRIX}.md` | 3 | 0.040 | D. DOCUMENTATION | **MOVE** | `docs/` (또는 `docs/modern_seismology/`)로 정리 이동 |
| 기존 문서/규칙 | `docs/` (32), `GEMINI.md`, `.agents/` (8) | 41 | 0.622 | D. DOCUMENTATION | **KEEP / CONSOLIDATE** | 향후 승인 시 `docs/{architecture,validation,reports}/`로 하위 구조화 |
| 임시 스크래치 | `scratch/` (PNG 119개, 스크립트 50개, HTML 3개, `.bin` 1개 등) | 175 | 85.320 | C. DEVELOPMENT (임시) | **DELETE_CANDIDATE** *(일부 SCRIPT **ARCHIVE**)* | 개발 중 생성된 임시 캡처(83.49 MB) 및 일회성 진단 스크립트 |
| 개발 캡처 / 레거시 아카이브 | `captures/` (75), `archive/` (284) | 359 | 390.779 | C. DEVELOPMENT / ARCHIVE | **ARCHIVE / DELETE_CANDIDATE** *(중복분)* | 동일 SHA-256 중복 캡처 9건 우선 삭제, 장기 미사용 미디어 외부 백업 권장 |
| OS 메타·빈 파일 | `.DS_Store` (6), `favicon.ico` (0 B) | 7 | 0.057 | 기타 불필요 | **DELETE_CANDIDATE** | macOS Finder 메타데이터 및 빈 아이콘 파일 |

---

## 3. 삭제·통합·이동 파일 목록 및 근거 (STEP C — Optimization Candidates)

### 3.1 동일 SHA-256 완전 중복 파일 목록 (`DELETE_CANDIDATE` — 9개 그룹, 11,663,689 B / 11.123 MB 낭비)

해시 대조 결과 바이트 단위로 완전히 동일한 중복 파일 9개 그룹(총 10개 잉여 사본)을 식별했습니다.

| SHA-256 (앞 16자) | 단일 크기 (B) | 낭비 용량 (B) | 보존 대상 (원본) | 삭제 후보 (`DELETE_CANDIDATE`) |
| :--- | ---: | ---: | :--- | :--- |
| `d52bc535860b0c27` | 2,099,660 | 2,099,660 | `captures/g1_lookdev/still_study_g1_step2_02_seoraksan_closeup.png` | `captures/g1_lookdev/compare_material_C_sublime.png` |
| `4c48d3de2da5fadd` | 1,186,234 | 2,372,468 | `archive/legacy_captures/g2_phase4/capture_p4_03_mountain_approach3_combined_master.png` | `archive/legacy_captures/g2_phase4/capture_p4_19_shot3_lyrical_mountain_resonance.png`, `capture_p4_32_master_shot3_pristine.png` |
| `268828eb26d47821` | 1,333,006 | 1,333,006 | `archive/legacy_captures/g2_phase3/capture_p3_12_shot2_epicenter_wave_corridor.png` | `archive/legacy_captures/g2_phase3/capture_p3_27_master_shot2_pristine.png` |
| `6f480b85da4b799a` | 1,307,346 | 1,307,346 | `archive/legacy_captures/g2_phase3/capture_p3_13_shot3_lyrical_mountain_resonance.png` | `archive/legacy_captures/g2_phase3/capture_p3_28_master_shot3_pristine.png` |
| `aaf0bfd7aa2487df` | 1,246,158 | 1,246,158 | `archive/legacy_captures/g2_phase4/capture_p4_18_shot2_epicenter_wave_corridor.png` | `archive/legacy_captures/g2_phase4/capture_p4_31_master_shot2_pristine.png` |
| `ed88b6df8c825529` | 1,186,237 | 1,186,237 | `archive/legacy_captures/g2_phase4/capture_p4_02_mountain_approach2_curvature.png` | `archive/legacy_captures/g2_phase4/capture_p4_01_mountain_approach1_filaments.png` |
| `0c353b209621a569` | 1,026,894 | 1,026,894 | `archive/legacy_captures/g2_phase3/capture_p3_11_shot1_monumental_continental_scale.png` | `archive/legacy_captures/g2_phase3/capture_p3_26_master_shot1_pristine.png` |
| `d0a433f035c26d0f` | 919,640 | 919,640 | `archive/legacy_captures/g2_phase1_2/still_study_g2_phase1_2_01_monumental_continental_scale_pristine.png` | `archive/legacy_captures/g2_phase1_2/compare_stratum2_active_on_pristine.png` |
| `103b7d8c7a6911f7` | 172,280 | 172,280 | `archive/legacy_prototypes/prototype_g2_continuous_seismic_world.html` | `archive/legacy_prototypes/prototype_unified_surface.html` |

### 3.2 G1 중간 지형 빌드 산출물 (`ARCHIVE` — 12개 파일, 40,793,680 B / 38.904 MB)

원본 GeoTIFF로부터 최종 통합 그리드(`fused_seorak_donghae_unorm16.bin`)를 생성하는 과정에서 나온 중간 단계 바이너리들입니다. 현행 `index.html`, `js/main.js`, `js/3d/terrainDataResolver.js` 및 `tests/` 25개 스위트 어디에서도 참조하지 않으며, 오직 과거 문서(`docs/`)와 구형 G1 빌드 스크립트(`scripts/process_g1_*.js`, `scripts/stitch_tile_boundary.js`)에만 등장합니다.

- `assets/terrain/bathymetry/donghae_ulleung_macro_unorm16.{bin,json}` (1,901,668 B)
- `assets/terrain/copernicus/expanded_seorak_gangneung_unorm16.bin` (7,776,000 B)
- `assets/terrain/copernicus/gangneung_odaesan_float32.bin` (7,776,000 B)
- `assets/terrain/copernicus/gangneung_odaesan_stitched_unorm16.bin` (3,888,000 B)
- `assets/terrain/copernicus/gangneung_odaesan_unorm16.{bin,json}` (3,889,041 B)
- `assets/terrain/copernicus/seoraksan_yangyang_float32.bin` (7,776,000 B)
- `assets/terrain/copernicus/seoraksan_yangyang_stitched_unorm16.bin` (3,888,000 B)
- `assets/terrain/copernicus/seoraksan_yangyang_unorm16.{bin,json}` (3,894,004 B)
- `assets/terrain/copernicus/verification_log.txt` (4,967 B)

### 3.3 불필요 라이브러리·임시 스크래치·OS 파일 (`DELETE_CANDIDATE` / `ARCHIVE`)

- **미사용 서드파티 번들 (`js/lib/geotiff.js`, 235,433 B)**: 브라우저 런타임 및 전체 JS/HTML/Python 파일에서 0건 참조.
- **OS 메타 및 빈 파일 (59,416 B)**: `.DS_Store` 6개(`.DS_Store`, `archive/.DS_Store`, `assets/.DS_Store`, `assets/terrain/.DS_Store`, `captures/.DS_Store`, `js/.DS_Store`), 0-byte `favicon.ico`.
- **임시 스크래치 (`scratch/`, 175개 · 89,464,741 B / 85.320 MB)**: 119개 진단용 PNG(83.490 MB), `test_etopo_header.bin`(1.000 MB), `prototype_stage{1,2,3}.html`(0.363 MB), `test.pdf`(8,272 B), 일회성 QA/진단 스크립트 50개. 이미 `.gitignore` 및 `.cfignore`에 제외되어 있으므로 검토 후 정리 또는 외부 백업 대상.

### 3.4 이동·통합 대상 (`MOVE` / `CONSOLIDATE`)

1. **루트 문서 이동 (`MOVE`)**: 루트에 혼재된 `MODERN_SEISMIC_ANALYSIS_BLUEPRINT.md`, `MODERN_SEISMIC_SCIENTIFIC_AUDIT.md`, `MODERN_SEISMIC_VALIDATION_MATRIX.md` (총 41,724 B) → `docs/validation/` 또는 `docs/`로 이동.
2. **단계별 뷰어 분리 (`MOVE`)**: `viewer_p1_2.html`, `viewer_p1_3.html`, `viewer_p2_3.html`, `viewer_p2_4.html`, `viewer_p2_5.html` (총 49,805 B) → `dev/viewers/`로 이동 (실행 시 내부 `<script type="module">` import 경로 `./js/` → `../../js/` 치환 필수). 통합 시연 진입점인 [`viewer_p2_6.html`](file:///Users/katsina/Downloads/earth/viewer_p2_6.html)은 루트에 유지.
3. **코드 enum·로직 중복 점검 (`CONSOLIDATE` 보류 → 호환 브릿지 유지)**:
   - `PedestrianRoutingEngine.js`의 `USER_MOBILITY_PROFILE` (`STANDARD_EVACUEE`, `WHEELCHAIR_USER`)과 `SituationAssessmentEngine.js`의 `MOBILITY_PROFILE` (`NONE`, `WHEELCHAIR`)이 공존하나, [ResponseUIAdapter.js](file:///Users/katsina/Downloads/earth/js/response/ResponseUIAdapter.js#L294-L295)가 안전하게 매핑 중입니다.
   - `HanyangBuildingData.js`의 `DATA_PROVENANCE_SOURCE`와 `GroundDataContract.js`의 `GROUND_DATA_PROVENANCE_SOURCE`는 [GroundDataContract.js](file:///Users/katsina/Downloads/earth/js/response/GroundDataContract.js#L158-L159)가 통합 수용하고 있습니다. 24개 테스트 호환성 보존을 위해 기존 export 심볼은 삭제하지 않고 브릿지 패턴을 유지합니다.

---

## 4. 데이터 용량 최적화 전후 비교 (STEP C)

### 4.1 프로덕션 웹 배포 용량 (Cloudflare Pages / 정적 HTTP 호스팅 기준)

현재 `.cfignore` 규칙(`*.tif`, `*.tiff`, `archive/`, `captures/`, `scratch/`, `tests/`, `scripts/`, `docs/`, `.agents/`, `.git/`)만으로는 루트 마크다운, 단계별 뷰어, 레퍼런스 이미지, `geotiff.js`, **4K 테스트용 전지구 DEM(16.000 MB)**, **G1 중간 단계 `.bin` 12개(38.904 MB)**까지 모두 배포 패키지에 포함됩니다.

| 배포 항목 | 최적화 전 (현재 `.cfignore` 기준) | 최적화 후 (제안 계획) | 절감량 / 변화 |
| :--- | ---: | ---: | ---: |
| HTML 진입점 | 7개 (`index.html` + `viewer_*` 6개, 0.064 MB) | 2개 (`index.html` + `viewer_p2_6.html`, 0.033 MB) | -0.031 MB |
| CSS 스타일시트 | 2개 (0.048 MB) | 2개 (0.048 MB) | 변동 없음 (0 B) |
| JS 소스 및 라이브러리 | 35개 (`geotiff.js`·`.DS_Store` 포함, 3.127 MB) | 33개 (`geotiff.js`·`.DS_Store` 제외, 2.893 MB) | -0.234 MB |
| 프로덕션 지형/지진 데이터 | 27개 (24.931 MB) | 27개 (24.931 MB) | **변동 없음 (해상도 100% 보존)** |
| G1 중간 지형 `.bin`/`.json` | 12개 (38.904 MB) | 0개 (배포 제외 / 아카이브) | **-38.904 MB** |
| 4K 테스트 DEM & 커버리지 메타 | 3개 (16.019 MB) | 0개 (`.cfignore`로 배포 제외) | **-16.019 MB** |
| 레퍼런스 PNG/JPG·루트 MD·`.DS_Store` | 14개 (1.582 MB) | 0개 (`.cfignore` / `docs/` 정리) | **-1.582 MB** |
| **총 웹 배포 용량** | **100개 파일 · 84.675 MB (88,788,065 B)** | **64개 파일 · 27.905 MB (29,260,987 B)** | **-56.769 MB (-67.0% 절감)** |

### 4.2 로컬 작업 공간 및 아카이브 용량 (과학 데이터 무결성 100% 보존)

- **과학 원본 & 런타임 필수 데이터(절대 감축 금지)**: GeoTIFF 원본 **590.132 MB** + 런타임 `.bin`/GeoJSON **24.931 MB** + 4K 테스트 DEM **16.019 MB** = **631.082 MB 보존**.
- **회수 가능한 비생산적 용량**:
  - `scratch/` 정리: **85.320 MB**
  - 동일 SHA-256 중복 이미지/HTML 정리: **11.123 MB**
  - G1 중간 `.bin` 아카이브: **38.904 MB**
  - `js/lib/geotiff.js` + `.DS_Store`: **0.281 MB**
  - **1차 로컬 클린업 가능량**: **135.628 MB** (여기에 `archive/legacy_captures/` 293.920 MB 및 `captures/` 95.081 MB를 외부 백업 스토리지로 이관 시 추가 **377.88 MB+** 회수 가능).
- **통합 GPU 메모리 안전성**: 프로덕션 전지구 DEM은 `global_etopo_elevation_2048_unorm16.bin`(4.000 MB → GPU Float32 Texture **8 MB**)을 사용하므로, `4096` 버전(32 MB GPU 텍스처) 대비 통합 GPU 환경에서 안정적으로 동작하며 해상도 저하 없이 유지됩니다.

---

## 5. 배포 리소스 구성 (STEP E — Production Deployment Bundle)

2차 최적화 적용 후 웹 호스팅(Cloudflare Pages 등)에 실제 배포될 정확한 자산 목록은 다음과 같습니다 (**64개 파일 · 29,260,987 B / 27.905 MB**):

1. **진입점 (Root, 2개 · 35,012 B)**: [`index.html`](file:///Users/katsina/Downloads/earth/index.html) (17,794 B), [`viewer_p2_6.html`](file:///Users/katsina/Downloads/earth/viewer_p2_6.html) (17,218 B)
2. **스타일시트 (`css/`, 2개 · 50,632 B)**: `theme.css`, `surface.css`
3. **클라이언트 런타임 코드 (`js/`, 33개 · 3,033,736 B)**:
   - `js/main.js`, `js/3d/*` (6), `js/audio/*` (1), `js/data/*` (6), `js/geophysics/*` (2), `js/response/*` (12), `js/ui/*` (2), `js/lib/{three.min.js,OrbitControls.js,three.module.js}` (3)
4. **로컬 정적 과학 데이터 (`assets/`, 27개 · 26,141,607 B)**:
   - `assets/data/usgs_4.5_month.geojson` (505,386 B)
   - `assets/terrain/ne_110m_land.geojson` (138,160 B)
   - `assets/terrain/bathymetry/`: `global_etopo_elevation_2048_unorm16.{bin,json}`, `fused_seorak_donghae_unorm16.{bin,json}`, `korea_macro_elevation_unorm16.{bin,json}`, 8종 `regional_*_unorm16.{bin,json}` (22개 · 21,828,045 B)
   - `assets/terrain/copernicus/`: `tier2_yangyang_{256,512,768}.bin` (3개 · 3,670,016 B)

*(모든 `.tif`, `global_etopo_elevation_4096_unorm16.*`, `dev/`, `tests/`, `scripts/`, `docs/`, `archive/`, `captures/`, `scratch/`, `.agents/`는 `.cfignore`를 통해 배포에서 배제되며, 런타임은 100% 로컬 정적 파일만 사용하므로 외부 API/다운로드 의존성이 없습니다.)*

---

## 6. 최종 디렉터리 구조 제안 (STEP D — Target Repository Architecture)

```text
earth/
├── index.html                          # [DEPLOY] SEISMOLIVE v4.0 메인 작품 진입점
├── viewer_p2_6.html                    # [DEPLOY] Global-to-Personal 통합 전시 시연 진입점
├── GEMINI.md                           # [GOV] 프로젝트 최상위 거버넌스 규칙
├── .gitignore                          # [GIT] OS 메타/대용량 GeoTIFF/임시 산출물 제외 (tests·scripts 추적)
├── .cfignore                           # [DEPLOY] 프로덕션 웹 배포 제외 규칙
├── css/                                # [DEPLOY] Nocturnal Monolith UI 스타일시트
├── js/                                 # [DEPLOY] 핵심 애플리케이션 모듈
│   ├── main.js
│   ├── 3d/                             # 지구본·지형·파동·LivingMemory 엔진
│   ├── audio/                          # LivingSoundfield 오디오 합성 엔진
│   ├── data/                           # 역사/계측 카탈로그·SAC 디코더·StationBridge
│   ├── geophysics/                     # 주시곡선·지진해일·현대 지진학 솔버
│   ├── response/                       # 한양대 P1.1~P3.1 개인화 대응 아키텍처
│   ├── ui/                             # 통합 컨트롤 서피스·디스커버리 비콘
│   └── lib/                            # three.min.js, OrbitControls.js, three.module.js
├── assets/
│   ├── data/                           # usgs_4.5_month.geojson [DEPLOY]
│   └── terrain/
│       ├── ne_110m_land.geojson        # [DEPLOY]
│       ├── historical_event_coverage_assessment.json  # [LOCAL META / .cfignore]
│       ├── bathymetry/                 # 런타임 .bin/.json [DEPLOY] + 4K테스트/ETOPO .tif [.cfignore]
│       └── copernicus/                 # tier2_yangyang_{256,512,768}.bin [DEPLOY] + DSM .tif [.cfignore]
├── dev/                                # [DEV / .cfignore] (2차 승인 후 생성)
│   └── viewers/                        # viewer_p1_2 ~ viewer_p2_5.html (경로 보정)
├── tests/                              # [DEV / .cfignore, Git 추적 복구] 25개 테스트 스위트 + SAC 픽스처
├── scripts/                            # [DEV / .cfignore, Git 추적 복구] 오프라인 DEM 빌드 & Playwright QA
├── docs/                               # [DOC / .cfignore] 아키텍처·검증 보고서·개발 일지·레퍼런스
│   ├── MODERN_SEISMIC_*.md             # 루트에서 이동
│   ├── REPOSITORY_OPTIMIZATION_REPORT.md
│   └── references/                     # assets/references/ 이동 (또는 기존 위치 유지 후 .cfignore)
├── archive/                            # [ARCHIVE / .cfignore] 과거 2D/3D 프로토타입·G1 중간 `.bin`·레거시 캡처
└── .agents/                            # [DEV / .cfignore] 프로젝트 아트 디렉션 규칙 및 스킬
```

---

## 7. 테스트 결과 및 실행 성능 기준선 (STEP E — Baseline Execution)

모든 24개 Deno JS 테스트 스위트(`deno run --allow-all`) 및 1개 Python LOD 테스트(`python3 tests/test_seorak_profile_lod.py`)의 정리 전 기준선(Baseline) 실행 결과는 **100% 통과(0건 실패)**입니다.

### 7.1 개인화 대응 시스템 9개 기본 스위트 (+ P3.1 검증 스위트)

| # | 테스트 파일 | 통과 | 실패 | 실행 시간 | 비고 |
| :---: | :--- | ---: | ---: | ---: | :--- |
| 1 | [test_hanyang_response_system.js](file:///Users/katsina/Downloads/earth/tests/test_hanyang_response_system.js) | 42 | 0 | 17.0 ms | P1.1 앵커·건물·커넥터·경로·상태머신 |
| 2 | [test_hanyang_adapter.js](file:///Users/katsina/Downloads/earth/tests/test_hanyang_adapter.js) | 16 | 0 | 29.2 ms | P1.2 물리/시각 좌표 분리 어댑터 |
| 3 | [test_p1_3_spatial_continuity.js](file:///Users/katsina/Downloads/earth/tests/test_p1_3_spatial_continuity.js) | 30 | 0 | 18.8 ms | P1.3 글로벌-로컬 카메라 연속성 |
| 4 | [test_p2_situation_assessment.js](file:///Users/katsina/Downloads/earth/tests/test_p2_situation_assessment.js) | 23 | 0 | 13.7 ms | P2.2 상황 판단 엔진 |
| 5 | [test_p2_3_interface_integration.js](file:///Users/katsina/Downloads/earth/tests/test_p2_3_interface_integration.js) | 30 | 0 | 15.5 ms | P2.3 정보 충돌·UI 어댑터 통합 |
| 6 | [test_p2_4_dynamic_replanning.js](file:///Users/katsina/Downloads/earth/tests/test_p2_4_dynamic_replanning.js) | 18 | 0 | 14.9 ms | P2.4 동적 경로 재탐색 |
| 7 | [test_p2_5_end_to_end_timeline.js](file:///Users/katsina/Downloads/earth/tests/test_p2_5_end_to_end_timeline.js) | 33 | 0 | 23.7 ms | P2.5 E2E 지진 대응 타임라인 |
| 8 | [test_p2_6_global_to_personal.js](file:///Users/katsina/Downloads/earth/tests/test_p2_6_global_to_personal.js) | 15 | 0 | 25.6 ms | P2.6 지구본→개인공간 통합 검증 |
| 9 | [test_p3_0_ground_data_ingestion.js](file:///Users/katsina/Downloads/earth/tests/test_p3_0_ground_data_ingestion.js) | 13 | 0 | 13.3 ms | P3.0 실측/도면 데이터 계약 검증 |
| **소계** | **9개 필수 스위트 (P1.1~P3.0)** | **220** | **0** | **171.7 ms** | **220 / 220 단언 100% 일치** |
| 10 | [test_p3_1_ground_truth_validation.js](file:///Users/katsina/Downloads/earth/tests/test_p3_1_ground_truth_validation.js) | 15 | 0 | 19.8 ms | P3.1 4경로 수치 재계산·법규·메타 |
| **합계** | **10개 개인화 대응 스위트 전체** | **235** | **0** | **191.5 ms** | **100% 통과** |

### 7.2 지구본·지형·수심·파동·사료·현대 지진학 스위트 (14개 JS + 1개 Python)

| # | 테스트 파일 | 실행 결과 요약 | 실행 시간 |
| :---: | :--- | :--- | ---: |
| 11 | `tests/test_geodetic_ellipsoid.js` | `15 PASSED, 0 FAILED` | 965.3 ms |
| 12 | `tests/test_terrain_resolver.js` | `68 PASSED, 0 FAILED` | 236.4 ms |
| 13 | `tests/test_universal_stress_matrix.js` | `32 PASSED, 0 FAILED` | 14.0 ms |
| 14 | `tests/test_phase_c_wavefield.js` | `74 PASSED, 0 FAILED` | 15.7 ms |
| 15 | `tests/test_phase_d_living_memory.js` | `239 PASSED, 0 FAILED` | 18.2 ms |
| 16 | `tests/test_phase_d2_archival_expansion.js` | `263 PASSED, 0 FAILED` | 20.7 ms |
| 17 | `tests/test_phase_d3_soundfield_integrity.js` | `52 PASSED, 0 FAILED` | 20.4 ms |
| 18 | `tests/test_phase_d4_historical_dossier.js` | `393 PASSED, 0 FAILED` | 16.9 ms |
| 19 | `tests/test_phase_d5_error_ellipse.js` | `ALL ASSERTIONS PASSED (100%)` | 19.4 ms |
| 20 | `tests/test_phase_d6_tsunami_felt.js` | `ALL ASSERTIONS PASSED (100%)` | 18.3 ms |
| 21 | `tests/test_phase_e_continuous_earth.js` | `146 PASSED, 0 FAILED` | 31.8 ms |
| 22 | `tests/test_modern_seismic_solvers.js` | `ALL 5 VALIDATION & INGESTION PREPARATION CATEGORIES PASSED (100%)` | 44.8 ms |
| 23 | `tests/test_sac_binary_decoder.js` | `ALL 12 SAC INGESTION FIXTURES & PACKET ASSEMBLER TESTS PASSED (100%)` | 16.1 ms |
| 24 | `tests/test_station_waveform_bridge.js` | `ALL 15 STATION WAVEFORM BRIDGE BENCHMARKS PASSED (100%)` | 15.8 ms |
| 25 | `tests/test_seorak_profile_lod.py` | LOD 768 Peak 1608.52m / RMSE 3.59m (exit 0) | Python CLI |

### 7.3 렌더링·실행 성능 기준선 및 2차 단계 검증 조건

- 현재(정리 전) 1차 단계에서는 파일 변경이 없으므로 24개 JS 테스트 + Python 테스트 + HTML 진입점 매핑 검증을 완료했습니다.
- 2차 정리 실행 후에는 정적 HTTP 서버를 구동하여 Playwright/브라우저 실검증을 포함해 아래 항목의 정리 전후 회귀 비교를 수행합니다:
  - 9개+1개 개인화 대응 테스트(235건) 및 전체 25개 스위트 재실행
  - `index.html`: 글로벌 지구 렌더링, 지역 지형·수심(`global_etopo_elevation_2048_unorm16.bin`, `fused_seorak_donghae_unorm16.bin`, `regional_*`) 로딩, `usgs_4.5_month.geojson`·사료 지진 데이터 표시, 오프라인/로컬 리소스 HTTP 200 확인
  - `viewer_p2_6.html`: Global → Campus → Bldg 212 → Room 301 전환, 상황 판단·타임라인 이벤트, 동적 경로 재탐색 확인

---

## 8. 복구 방법 및 알려진 위험 (Recovery & Risks)

### 8.1 복구 지점 확보 및 롤백 절차

1. **사전 Git 안전장치 (2차 작업 개시 직전 실행 필수)**:
   - `.gitignore`에서 `tests/`, `scripts/`, `docs/`, `.agents/` 제외 규칙을 제거하여 `.cfignore`와 역할을 분리합니다.
   - 현재 미추적(`??`) 핵심 코드와 `tests/`를 안전 커밋 후 태그로 고정합니다:
     ```bash
     git add .gitignore js/ tests/ viewer_p2_6.html
     git commit -m "chore(backup): snapshot all untracked response/seismology modules and test suites before optimization"
     git tag -a backup/pre-optimization-v4.0 -m "Pre-optimization restore point"
     ```
2. **작업 중 롤백 방법**:
   - 추적 파일 원복: `git reset --hard backup/pre-optimization-v4.0`
   - 워크트리 보존 주의: `/Users/katsina/Downloads/seismolive-clean` 워크트리가 `v4-reconstruction` 브랜치를 참조 중이므로 `git gc --prune=now` 등 강제 히스토리 재작성(`git filter-repo`)은 사용자 승인 및 워크트리 확인 전까지 실행하지 않습니다.

### 8.2 알려진 위험 (Known Risks)

| 위험 항목 | 상세 원인 | 완화 대책 |
| :--- | :--- | :--- |
| **단계 뷰어 경로 깨짐** | `viewer_p1_2.html`~`viewer_p2_5.html`을 `dev/viewers/`로 이동 시 내부 상대 import(`./js/...`)가 `404` 발생 | 이동 시 `<script type="module">` 내 `./js/`를 `../../js/`로 일괄 보정하고 로컬 HTTP 로드 테스트 수행 |
| **4K 테스트 바이너리 오삭제** | `global_etopo_elevation_4096_unorm16.bin`(16 MB)은 `js/main.js`에서 미사용이나 `test_phase_e_continuous_earth.js`가 직접 읽음 | 로컬 디스크에서는 **절대 삭제 금지**, `.cfignore`에만 추가해 웹 배포 용량에서만 제외 |
| **동적 템플릿 경로(`tier2_yangyang_*`)** | `terrainDataResolver.js` L1224가 ``tier2_yangyang_${resolution}.bin`` 문자열 조합으로 로드해 단순 문자열 검색에 누락 가능 | `256`, `512`, `768` 3종 모두 프로덕션 필수 에셋으로 화이트리스트 확정 완료 |
| **`.git` 대용량(1.00 GiB)** | 과거 커밋에 465 MB `.tif` 및 85 MB `.gif`가 포함되어 일반 정리만으로는 `.git` 크기가 줄지 않음 | 2차 작업은 워킹 트리 및 배포 번들 최적화에 집중하고, Git 히스토리 스퀴징은 별도 합의 후 수행 |

---

## 9. 아직 정리하지 않은 항목 및 2차 실행 승인 대기 목록

1차 단계에서는 조사·분류·기준선 측정만 완료했으며, 아래 항목은 **사용자 검토 및 승인 후 2차 단계에서 실행**할 예정입니다:

- [ ] **우선순위 1 (무위험 · 버전 관리 복구)**: `.gitignore`와 `.cfignore` 분리, `tests/`·`js/response/`·현대지진학 모듈 커밋 및 `backup/pre-optimization-v4.0` 태그 생성.
- [ ] **우선순위 2 (무위험 · 배포 용량 67.0% 절감)**: `.cfignore`에 `assets/terrain/bathymetry/global_etopo_elevation_4096_unorm16.*`, `assets/terrain/historical_event_coverage_assessment.json`, `assets/references/`, `dev/`, `*.md`, `.DS_Store`, 미사용 중간 `.bin` 패턴을 추가하여 웹 배포 패키지 축소 (`84.675 MB → 27.905 MB`).
- [ ] **우선순위 3 (중복·정크 삭제)**: 동일 SHA-256 중복 캡처/HTML 10건 (`11.123 MB`), `.DS_Store` 6건 (`59,416 B`), `0 B` `favicon.ico` 삭제 및 미참조 `js/lib/geotiff.js` (`235,433 B`) 제거/아카이브.
- [ ] **우선순위 4 (구조 정리 · 경로 보정 동반)**: 루트 `MODERN_SEISMIC_*.md` 3건을 `docs/`로 이동, `viewer_p1_2`~`viewer_p2_5.html` 5건을 `dev/viewers/`로 이동(import 경로 보정 포함).
- [ ] **우선순위 5 (대용량 아카이브/스크래치 결정 대기)**: G1 중간 파이프라인 `.bin` 12건(`38.904 MB`), `scratch/` 175건(`85.320 MB`), `captures/`(`95.081 MB`), `archive/legacy_captures/`(`293.920 MB`)의 삭제 또는 외부 백업(Cold Storage) 이관 여부 최종 결정.
- [ ] **향후 과제 (범위 외)**: `seismolive-clean` 워크트리 정리 여부 및 `.git` 히스토리(`1.00 GiB`) 경량화, `ModernSeismicSolvers.js`·`StationWaveformBridge.js`의 메인 UI 연결.
