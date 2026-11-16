# SEISMOLIVE v4.0 — Phase 2 Repository Optimization & Preservation Report

> **작업 성격**: Phase 1 저장소 인벤토리·의존성 감사 결과를 바탕으로 한 **2차 실행 및 검증 보고서**  
> **최우선 목표**: (1) 핵심 소스와 테스트의 Git 추적 복구, (2) 실제 배포 파일 용량 절감, (3) 개발 기록 및 원본 데이터 무손실 보존, (4) 이후 P3.1 현장 검증을 위한 안정적인 저장소 구조 확보

---

## 1. 실제 변경된 파일 (Summary of All Changes)

이번 2차 작업에서 실제로 수정·추가·삭제·이동된 파일은 다음과 같습니다. 범위 밖의 소스 코드 로직 리팩터링, 단계별 뷰어 이동, 대용량 아카이브/데이터 삭제는 일절 수행하지 않았습니다.

| 분류 | 파일 경로 | 작업 내용 |
| :--- | :--- | :--- |
| Git 제외 규칙 | [`.gitignore`](file:///Users/katsina/Downloads/earth/.gitignore) | `.cfignore`와 혼용되어 있던 `tests/`, `scripts/`, `docs/`, `.agents/` 제외 규칙 제거 (총 4줄 삭제) |
| 배포 제외 규칙 | [`.cfignore`](file:///Users/katsina/Downloads/earth/.cfignore) | 비배포 문서(`*.md`), `assets/references/`, 4K 테스트 DEM, G1 중간 산출물 `.bin`, 구형 단계 뷰어(`viewer_p1_2`~`p2_5`), `.DS_Store`, `*.bak` 제외 규칙 추가 |
| 문서 이동 (3건) | `MODERN_SEISMIC_{ANALYSIS_BLUEPRINT,SCIENTIFIC_AUDIT,VALIDATION_MATRIX}.md` → `docs/` | 루트에서 [docs/](file:///Users/katsina/Downloads/earth/docs) 디렉터리로 `git mv` 이동 |
| 불필요 파일 삭제 | `favicon.ico` (0 B), `js/lib/geotiff.js` (235,433 B), `.DS_Store` 6개 (59,416 B) | 참조 감사 후 안전 삭제 (`git rm` 2건, 로컬 `rm -f` 6건) |
| 보고서 추가 | [REPOSITORY_OPTIMIZATION_REPORT.md](file:///Users/katsina/Downloads/earth/REPOSITORY_OPTIMIZATION_REPORT.md), [REPOSITORY_OPTIMIZATION_PHASE2_REPORT.md](file:///Users/katsina/Downloads/earth/REPOSITORY_OPTIMIZATION_PHASE2_REPORT.md) | Phase 1·Phase 2 완료 보고서 |

---

## 2. Git 추적 복구 내역 (STEP 1)

기존에 [`.gitignore`](file:///Users/katsina/Downloads/earth/.gitignore)가 Cloudflare 배포용 [`.cfignore`](file:///Users/katsina/Downloads/earth/.cfignore)와 중복 설정되어 있어 `tests/` 전체 및 신규 스크립트·스킬이 Git에서 무시(`!!`)되고 있었으며, 핵심 대응 모듈(`js/response/`)과 현대 지진학 모듈도 미추적(`??`) 상태였습니다. 두 파일의 역할을 분리해 총 **55개 핵심 파일(815,571 B / 0.778 MB)의 Git 추적을 복구**했습니다.

- **기존 추적 파일 수**: `130`개 (`HEAD: e6626a3`)
- **신규 추적 복구 (`55`개, 민감정보·대용량 바이너리 0건 확인 후 스테이징)**:
  - `js/response/` (**12개**, 175,350 B): `GlobalLocalCameraTransition.js`, `GroundDataContract.js`, `HanyangBuildingData.js`, `HanyangResponseAdapter.js`, `IndoorOutdoorConnector.js`, `LocalTangentAnchor.js`, `PedestrianRoutingEngine.js`, `PersonalResponseInteraction.js`, `ResponseStateMachine.js`, `ResponseTimelineSimulator.js`, `ResponseUIAdapter.js`, `SituationAssessmentEngine.js`
  - 현대 지진학 및 관측 파형 (**3개**, 103,169 B): [ModernSeismicSolvers.js](file:///Users/katsina/Downloads/earth/js/geophysics/ModernSeismicSolvers.js), [sacBinaryDecoder.js](file:///Users/katsina/Downloads/earth/js/data/sacBinaryDecoder.js), [StationWaveformBridge.js](file:///Users/katsina/Downloads/earth/js/data/StationWaveformBridge.js)
  - 테스트 스위트 및 픽스처 (**27개**, 369,174 B): `tests/` 내 Deno JS 테스트 24개, Python LOD 테스트 1개(`test_seorak_profile_lod.py`), SAC 바이너리 픽스처 2개(`tests/fixtures/test.sac`, `test.sac.swap`)
  - 스크립트 (**2개**, 9,435 B): `scripts/capture_event_frames.js`, `scripts/verify_interactive_geophysics_and_lighting.js`
  - 에이전트 스킬 (**1개**, 8,175 B): `.agents/skills/unslop-ui/SKILL.md`
  - HTML 뷰어 (**6개**, 67,023 B): `viewer_p1_2.html`, `viewer_p1_3.html`, `viewer_p2_3.html`, `viewer_p2_4.html`, `viewer_p2_5.html`, `viewer_p2_6.html`
  - 루트 마크다운 문서 (**4개**, 83,245 B): `MODERN_SEISMIC_{ANALYSIS_BLUEPRINT,SCIENTIFIC_AUDIT,VALIDATION_MATRIX}.md`, `REPOSITORY_OPTIMIZATION_REPORT.md`
- **최종 Git 추적 파일 수**: `130 + 55 - 2(삭제) + 1(Phase 2 보고서) = 184`개 (기존 커밋 이력 변경 없음).

---

## 3. 생성된 커밋 및 백업 태그 (STEP 1)

| 구분 | 식별자 / 태그명 | 대상 커밋 해시 | 용도 및 검증 |
| :--- | :--- | :--- | :--- |
| 복구 스냅샷 커밋 | `chore(backup): recover git tracking for tests, response modules, modern seismology, and viewers` | `fef3fd68ca9773a265c5d47eb2e593f2267e0018` | `.gitignore` 수정 + 미추적 55개 파일(총 56개 변경) 스냅샷 커밋 |
| **Annotated 백업 태그** | **`backup/pre-optimization-v4.0`** | **`fef3fd68ca9773a265c5d47eb2e593f2267e0018`** | `git rev-parse backup/pre-optimization-v4.0^{commit}` 일치 확인. 언제든 `git reset --hard backup/pre-optimization-v4.0`로 최적화 직전 상태 복원 가능 |
| Phase 2 정리 커밋 | `chore(repo): optimize deployment bundle via .cfignore, remove unused geotiff.js, and move modern seismic docs` | Phase 2 보고서 포함 본 작업 완료 직후 생성 | `.cfignore` 배포 슬림화, 불필요 파일 2종 삭제, `MODERN_SEISMIC_*.md` 3건 이동, Phase 2 보고서 반영 |

---

## 4. 삭제 파일과 삭제 근거 (STEP 3)

### 4.1 실제 삭제된 파일 (8개 · 294,849 B / 0.281 MB)

| 삭제 파일 | 크기 (B) | 참조 감사 결과 | 삭제 근거 |
| :--- | ---: | :--- | :--- |
| `js/lib/geotiff.js` | 235,433 | 활성 코드, 뷰어, 테스트, `scripts/` 전체에서 동적·정적 import 및 전역 `GeoTIFF.` 참조 **0건** | 오프라인 DEM 빌드는 `scripts/`에서 Deno `npm:geotiff`를 사용하므로 브라우저용 번들이 미사용 잔존물임을 확인 후 `git rm` 제거 |
| `favicon.ico` | 0 | `index.html` 및 모든 HTML `<link rel="icon">` 참조 없음 (과거 `archive/legacy_scripts`에만 console 404 필터용 문자열 존재) | 유효한 바이너리가 아닌 `0 B` 빈 플레이스홀더 파일 (`git rm` 제거) |
| `.DS_Store` (6개: 루트, `archive/`, `assets/`, `assets/terrain/`, `captures/`, `js/`) | 59,416 | macOS Finder 메타데이터 | 프로젝트 비관련 OS 메타 파일 (`rm -f` 제거) |

### 4.2 감사 후 삭제 보류(보존 확정)된 SHA-256 중복 파일 (9개 그룹 · 0개 삭제)

Phase 1에서 식별했던 동일 SHA-256 중복 파일 9개 그룹에 대해 참조 관계와 STEP 5 보존 원칙을 재검증한 결과, **전부 보존**으로 결정했습니다:

1. **그룹 1~8 (PNG 8그룹 · `captures/g1_lookdev/` 1건, `archive/legacy_captures/` 7건)**:
   - 두 파일명(`compare_*`, `capture_p*_master_shot*`, `still_study_*`)이 각각 `docs/G1_STEP2_EXPANSION_REPORT.md`, `docs/G2_PHASE1_2_LOOKDEV_REFINEMENT_REPORT.md`, `docs/G2_PHASE3_BLOOMING_WAVEFRONT_REPORT.md`, `docs/G2_PHASE4_CINEMATIC_REFINEMENT_REPORT.md` 및 `archive/legacy_scripts/capture_*.js`에서 개별 이름으로 참조되며, STEP 5에서 `captures/` 및 `archive/legacy_captures/` 삭제를 금지했기 때문에 보존했습니다.
2. **그룹 9 (`archive/legacy_prototypes/prototype_unified_surface.html` vs `prototype_g2_continuous_seismic_world.html`)**:
   - 두 파일 모두 `scratch/` 빌드/검증 스크립트(`build_unified_prototype.py`, `test_beacon_click.js`, `integrate_unified_controller.py`)와 다수의 G2 보고서에서 서로 다른 역할로 직접 참조되므로 보존했습니다.

---

## 5. 이동 파일 및 경로 수정 내역 (STEP 4)

| 원본 경로 | 이동 후 경로 | 참조 및 상대 링크 점검 결과 |
| :--- | :--- | :--- |
| `MODERN_SEISMIC_ANALYSIS_BLUEPRINT.md` | [docs/MODERN_SEISMIC_ANALYSIS_BLUEPRINT.md](file:///Users/katsina/Downloads/earth/docs/MODERN_SEISMIC_ANALYSIS_BLUEPRINT.md) | 내부 마크다운 링크 0건, 타 스크립트/테스트 참조 0건 → 경로 수정 불필요 |
| `MODERN_SEISMIC_SCIENTIFIC_AUDIT.md` | [docs/MODERN_SEISMIC_SCIENTIFIC_AUDIT.md](file:///Users/katsina/Downloads/earth/docs/MODERN_SEISMIC_SCIENTIFIC_AUDIT.md) | 내부 3개 링크 모두 절대 경로(`file:///Users/katsina/Downloads/earth/js/geophysics/ModernSeismicSolvers.js`)를 사용하므로 이동 후에도 링크 100% 유효 |
| `MODERN_SEISMIC_VALIDATION_MATRIX.md` | [docs/MODERN_SEISMIC_VALIDATION_MATRIX.md](file:///Users/katsina/Downloads/earth/docs/MODERN_SEISMIC_VALIDATION_MATRIX.md) | 내부 마크다운 링크 0건, 타 스크립트/테스트 참조 0건 → 경로 수정 불필요 |

- **단계별 뷰어(`viewer_p1_2.html` ~ `viewer_p2_6.html`)**: 지시사항에 따라 루트 위치 그대로 보존했습니다. 특히 [`viewer_p2_6.html`](file:///Users/katsina/Downloads/earth/viewer_p2_6.html)은 통합 전시 진입점으로 프로덕션 배포 번들에 유지됩니다.

---

## 6. 배포 용량 최적화 전후 비교 (STEP 2)

[`.cfignore`](file:///Users/katsina/Downloads/earth/.cfignore) 분리 및 최적화를 통해 로컬 원본 데이터·테스트 파일은 단 1바이트도 훼손하지 않으면서 실제 정적 웹 배포 번들 용량을 크게 줄였습니다.

| 구분 | 최적화 전 (기존 `.cfignore`) | 최적화 후 (실측 `.cfignore` 제외 결과) | 변화 / 절감률 |
| :--- | ---: | ---: | ---: |
| 총 배포 대상 파일 수 | 100개 | **66개** *(dotfile `.cfignore`·`.gitignore` 667 B 제외 시 64개)* | -34개 (-34.0%) |
| 총 배포 용량 (Bytes) | 88,788,065 B | **29,261,654 B** *(dotfile 제외 시 29,260,987 B)* | **-59,526,411 B** |
| 총 배포 용량 (MB) | **84.675 MB** | **27.906 MB** *(dotfile 제외 시 27.905 MB)* | **-56.769 MB (-67.0% 절감)** |

### 배포 번들 구성 내역 (27.906 MB / 66개 파일)
- **HTML 진입점 (2개 · 35,012 B)**: `index.html` (17,794 B), `viewer_p2_6.html` (17,218 B)
- **CSS (2개 · 50,632 B)**: `css/theme.css`, `css/surface.css`
- **JS 런타임 모듈 (33개 · 3,033,736 B)**: `js/main.js`, `js/3d/*` (6), `js/audio/*` (1), `js/data/*` (6), `js/geophysics/*` (2), `js/response/*` (12), `js/ui/*` (2), `js/lib/{three.min.js,OrbitControls.js,three.module.js}` (3)
- **로컬 정적 지형·지진 데이터 (27개 · 26,141,607 B)**: `assets/data/usgs_4.5_month.geojson`, `assets/terrain/ne_110m_land.geojson`, 활성 ETOPO/지역 `unorm16` `.bin`+`.json` 22개, `tier2_yangyang_{256,512,768}.bin` 3개
- **설정 파일 (2개 · 667 B)**: `.cfignore` (598 B), `.gitignore` (69 B)

---

## 7. 전체 테스트 및 배포 시뮬레이션 회귀 결과 (STEP 6)

### 7.1 단위·통합 테스트 스위트 (정리 전 기준선 vs 정리 후 100% 일치)

정리 후 `deno run --allow-all` 및 `python3`로 **전체 25개 테스트 스위트**를 재실행하여 기준선(Baseline)과 동일한 전수 통과를 확인했습니다.

| 구분 | 스위트 수 | 정리 전 기준선 (Baseline) | 정리 후 결과 | 회귀 여부 |
| :--- | :---: | :--- | :--- | :---: |
| 개인화 대응 9개 기본 스위트 (`P1.1~P3.0`) | 9 | **220 PASSED \| 0 FAILED** | **220 PASSED \| 0 FAILED** | **0 (일치)** |
| 현장 검증 준비 스위트 (`test_p3_1_ground_truth_validation.js`) | 1 | **15 PASSED \| 0 FAILED** | **15 PASSED \| 0 FAILED** | **0 (일치)** |
| 측지/지형/스트레스 (`geodetic_ellipsoid`, `terrain_resolver`, `universal_stress`) | 3 | `15 + 68 + 32 = 115 PASSED` | **115 PASSED \| 0 FAILED** | **0 (일치)** |
| 파동·사료·음향 (`phase_c`, `phase_d`, `d2`, `d3`, `d4`, `e`) | 6 | `74+239+263+52+393+146 = 1,167 PASSED` | **1,167 PASSED \| 0 FAILED** | **0 (일치)** |
| 오차타원·지진해일 (`phase_d5`, `phase_d6`) | 2 | `ALL ASSERTIONS PASSED (100%)` | **ALL ASSERTIONS PASSED (100%)** | **0 (일치)** |
| 현대 지진학·SAC·파형 (`modern_seismic`, `sac_binary`, `station_bridge`) | 3 | `5 Categories / 12 Fixtures / 15 Benchmarks PASSED (100%)` | **ALL PASSED (100%)** | **0 (일치)** |
| Python Copernicus LOD 검증 (`test_seorak_profile_lod.py`) | 1 | `LOD 768 Peak 1608.52m / RMSE 3.59m (exit 0)` | **Peak 1608.52m / RMSE 3.59m (exit 0)** | **0 (일치)** |

### 7.2 `.cfignore` 엄격 적용 정적 서버 + Headless Chromium 배포 환경 검증

`.cfignore`에 매칭되는 모든 경로를 `HTTP 404`로 차단하는 테스트 HTTP 서버(`localhost:18092`, `localhost:18093`) 위에서 Headless Chromium(WebGL/Metal)으로 실제 실행을 검증했습니다:

1. **[`index.html`](file:///Users/katsina/Downloads/earth/index.html) 검증**:
   - WebGL 캔버스 정상 렌더링 (`1280x800`), 로딩 배너 정상 해제 및 지구본 타이틀·모드 UI 표시 확인
   - ES 모듈·CSS·지형 바이너리(`global_etopo_elevation_2048_unorm16.bin`, `fused_seorak_donghae_unorm16.bin`) 포함 **31개 리소스 전부 HTTP 200** 로드, 런타임 `pageerror` **0건**
   - *(단, 0바이트 `favicon.ico` 삭제로 인해 브라우저 기본 `/favicon.ico` 요청 1건만 404 콘솔 로그 발생 — 섹션 8 참고)*
2. **[`viewer_p2_6.html`](file:///Users/katsina/Downloads/earth/viewer_p2_6.html) 검증**:
   - WebGL 캔버스 정상 렌더링 (`1280x800`), `js/response/*` 및 `geodeticEllipsoidCoord.js` 등 **12개 리소스 전부 HTTP 200** 로드
   - `Failed requests: 0`, `Console errors: 0`, `Page errors: 0`
   - 8개 인터랙티브 전시 제어 버튼 클릭 검증 전부 통과:
     - 카메라 단계: `#btn-stage-earth` (`GLOBAL_ORBIT`) → `#btn-stage-campus` (`CAMPUS_OVERVIEW`) → `#btn-stage-bldg` (`BUILDING_INSPECTION`) → `#btn-stage-personal` (`PERSONAL_LOCATION`)
     - 대응 타임라인: `#btn-t0` (`금지 (엄폐 대기)`, `HIDDEN`) → `#btn-t40` (`가능 (허용)`, `ALL`) → `#btn-t67` (`가능 (허용)`, `STEP_FREE`) → `#btn-t110` (`금지 (엄폐 대기)`, `HIDDEN`)

---

## 8. 미해결 문제 및 후속 권장 사항 (Open Issues)

1. **`/favicon.ico` 404 콘솔 메시지**:
   - `favicon.ico`(0 B) 제거 후 브라우저가 기본 요청하는 `/favicon.ico`에 대해 `index.html` 로드 시 404 콘솔 로그 1건이 발생합니다. 추후 정식 아이콘 추가 또는 `<link rel="icon" href="data:,">` 한 줄 삽입으로 간단히 해소할 수 있습니다. (이번 작업 범위 외이므로 임의 수정하지 않았습니다.)
2. **`.git` 내부 객체 크기(`1.00 GiB`) 및 워크트리 유지**:
   - `seismolive-clean` 워크트리가 `v4-reconstruction` 브랜치를 참조 중이며 과거 커밋에 대용량 `.tif`/`.gif`가 남아 있어 `.git/` 자체는 `1.00 GiB`입니다. 지시사항대로 기존 커밋 이력은 재작성하지 않았으며, 추후 저장소 이관 시 별도 합의 하에 `git gc` / BFG / Filter-Repo 여부를 결정할 수 있습니다.
3. **로컬 대용량 미디어(`scratch/` 85.32 MB, `captures/` 95.07 MB, `archive/legacy_captures/` 293.92 MB)**:
   - STEP 5에 따라 보존한 상태이며, 장기적으로는 외부 백업 스토리지 이관 여부를 별도 결정할 수 있습니다.
4. **`index.html`의 USGS 오프라인 폴백 경로**:
   - 네트워크 연결 시 `index.html`이 `https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/4.5_month.geojson`을 우선 조회하며, `assets/data/usgs_4.5_month.geojson`은 로컬 폴백으로 함께 배포 번들에 보존했습니다.

---

## 9. 보존된 대용량 데이터 및 보호 디렉터리 목록 (STEP 5 Verification)

최적화 완료 후 디스크 실측 결과 **모든 보호 대상 파일이 1바이트의 손실도 없이 100% 보존**되었음을 검증했습니다.

| 분류 | 파일 수 | 실측 용량 (Bytes) | 실측 용량 (MB) | 용도 및 보존 필요성 |
| :--- | ---: | ---: | ---: | :--- |
| **GeoTIFF 원본 8건** (`ETOPO_2022_*` 6건, `Copernicus_DSM_*` 2건) | 8 | 618,797,728 | 590.132 | 지구·한반도·설악/동해 지형·수심 재현을 위한 과학 원천 데이터 (`test_seorak_profile_lod.py`가 `Copernicus_DSM_COG_10_N38_00_E128_00_DEM.tif` 직접 참조) |
| **테스트 필수 4K DEM** (`global_etopo_elevation_4096_unorm16.{bin,json}`) | 2 | 16,778,080 | 16.001 | `tests/test_phase_e_continuous_earth.js`의 4K 전지구 고도 무결성 검증 필수 픽스처 (배포에서만 제외) |
| **G1 중간 파이프라인 산출물** (`donghae_ulleung_macro*`, `expanded_seorak_gangneung*`, `{seoraksan_yangyang,gangneung_odaesan}_{float32,stitched_unorm16,unorm16}*`, `verification_log.txt`) | 12 | 40,793,680 | 38.904 | G1 단계별DEM 융합·바운더리 스티칭 재현 및 검증 이력 증빙 자료 |
| **`archive/legacy_captures/`** (G2 Phase 1~6 GIF/MP4/PNG) | 182 | 308,197,396 | 293.920 | G2 시각 연출 진화 과정 및 아카이브 리포트 참조 원본 |
| **`captures/`** (`g1_lookdev/` 포함 PNG 스크린샷) | 74 | 99,693,126 | 95.075 | G1 LookDev 및 단계별 렌더링 품질 비교 레퍼런스 (`.DS_Store`만 제거) |
| **`scratch/`** (진단 스크립트, 임시 캡처 PNG, `prototype_stage*`, `test_etopo_header.bin`) | 175 | 89,464,741 | 85.320 | 개발·디버깅 중간 산출물 및 QA 회귀 진단 스크립트 보존 (Git/배포에서는 이미 제외) |
| **테스트 SAC 픽스처** (`tests/fixtures/test.sac`, `test.sac.swap`) | 2 | 2,064 | 0.002 | `test_sac_binary_decoder.js`의 리틀/빅 엔디안 SAC 파싱 검증 필수 바이너리 (Git 추적 복구 완료) |
