# SEISMOLIVE v4.0 — Development Chronicle, Human–AI Co-Design Lessons & Validation Ledger

> **Consolidated Chronicle & Verification Record** unifying all historical milestones (`ENTRY-01`–`ENTRY-40`), architectural refactors (`R1 → R3`), productization phases (`Phase 3–6`, Workers security, mobile UX, Seismic-MCDA routing, globe wavefield upgrade), repository consolidation, and verified test counts.

---

## 1. Chronological Development Arc (`2026-10` → `2026-11-17`)

| Stage / Commits | Milestone | Key Technical & Aesthetic Transformation |
| :--- | :--- | :--- |
| **Phase 0 (v1–v3)** `ENTRY-01..05` | *Earthquake Live Pulse* → Art Turn | Initial 2D Leaflet USGS viewer & dual LLM (`cl.html`/`gem.html`) comparative audit; resolved CARTO tile issues; separated 1681 Yangyang into primary vs. secondary chronicles; pivoted away from "dashboard fatigue" toward gallery media art (`SEISMOLIVE v4.0`). |
| **Artistic Reset & Governance** `ENTRY-06..19` | Anti-Game-VFX Charter & Rules | Rejected translucent volumetric domes, laser beams, fake `sin()` coastlines (`terrainElevation.js`), fake GMPE constants (`impactFieldEngine.js`), and hardcoded metrics (`reclaimed_validation_metrics.json`). Institutionalized `GEMINI.md`, `.agents/rules/art_direction.md`, 7 domain skills, and headless Chromium CDP visual verification. |
| **G1 & Phase A–B** `ENTRY-20..25`, `ENTRY-36..37` | WGS84 3-Tier Earth & Real DEMs | Acquired Copernicus GLO-30 (`30m`) & NOAA ETOPO 2022 bathymetry; implemented WGS84 ECEF/ENU transforms with Center-Relative quantization (`<0.05 m`), anisotropic pixel ratio (`1:1.262`), `0.0000 mm` coastline seam stitching, 8-region stress testing, and Python LOD verification (`test_seorak_profile_lod.py`). |
| **G2 & Phase C–D** `ENTRY-26..39`, `7f5b04a..e6626a3` | Vector Wavefield, Living Memory & Soundfield | Implemented $\mathbf{u}(\mathbf{x}, t) = \mathbf{u}_P + \mathbf{u}_S + \mathbf{u}_R$ with Plummer regularization and retrograde Rayleigh orbits; tri-layer historical semantic parser (`ArchivalSemanticParser.js`) with Pre-1905 Null Magnitudes; Dual-Pass Gaussian Cushion editorial typography (`LATENT→DEAD`); 5 event-specific procedural Web Audio graphs with $-12\text{ dB}$ compressor; 95% confidence covariance ellipses (Phase D5) and Green's Law tsunami shoaling (Phase D6). |
| **Modern Seismology Core** `test_modern_seismic_solvers.js` | Quantitative Waveform & ODR Suite | Added Brune/Madariaga/Eshelby source inversion (`SOLV-01..04`), STA/LTA + Maeda AR-AIC picking (`SOLV-05..08`), `ZNE→ZRT` symmetry & Jurkevics Jacobi polarization (`SOLV-09..12`), 3D ODR fault-plane fitting & outlier trimming (`SOLV-13..15`), and binary SAC decoding (`sacBinaryDecoder.js`). |
| **Repo & Architecture Refactor (`R1→R3`)** `fef3fd6..bcef2d8` | Clean ESM Modularization | Restored `.gitignore` coverage for `tests/` & `docs/`, removed UMD `three.min.js`/`OrbitControls.js` onto unified ES module `three-runtime.js`, extracted 7 GLSL shaders (`SeismicTerrainShaders.js`) and `FlightController.js`, decoupled facility data (`FacilityPackage` DI), fixed Stair 3/4 off-by-one highlights, and unified PGA `0.05g`/`0.02g` hysteresis (`SEISMIC_MOTION_POLICY`). |
| **Local 4km Spatial & Nationwide Engine** `9bcaa60..cea91d4` | Global-to-Local Unified Product | Integrated 6,343-building 4km Hanyang OSM package (`InstancedMesh` OBBs), P3.1 statutory verification contract (`F-01..F-06`), `AutoScenarioResolver`, non-bridge river exclusions, dynamic regional DEM/OSM loading across Korea, and USGS ShakeMap/OAF product bridging. |
| **Security Hardening** `35ad746` | Cloudflare Workers & Strict CSP | Added [`worker.js`](../worker.js) & [`functions/_shared/security.js`](../functions/_shared/security.js) enforcing strict `script-src 'self'` CSP, CORS origin allowlist, `escapeHtml()` XSS sanitization, edge `Cache-Control`, and CSP-compliant `viewer_p2_6_boot.js`. |
| **Mobile UX & Seismic-MCDA** `886ad42`, `f3cddc7`, `a8f2eec` | App-Grade Mobile & $J(S \mid o)$ Routing | Delivered `<= 640px` map-first mobile layout with Retina `DPR=2` & expanded portrait FOV; implemented Hirokawa/ATC-138 facade debris, bilateral canyon, narrow-alley, bridge fixed/multiplier penalties, MMI scaling, and $J(S \mid o)$ destination scoring in `CampusWalkRouter.js`; solved cross-river Euclidean trap (`#1847`). **Resolved iOS/Metal black globe** by packing UNORM16 heights into universal `RGBA8 + UnsignedByteType + NearestFilter`. |
| **Globe Fusion & Camera Fix** `ec45b3e` | Seamless Earth & Wavefield Upgrades | Fused Global ETOPO with feathered Korea 15" macro DEM (`sampleEarthMeters`), replaced static square cutout with tectonic micro-hairlines (`tectonicBoundaries.js`), upgraded wavefield shaders & optional error ellipse toggle, fixed `getTerrainMetricsAt()` `RGBA8` unpacking stride, and locked post-descent `OrbitControls` stability. |
| **Repository & Doc Consolidation** *(Current)* | Unified Canonical Baseline | Removed ~2 GB of redundant sibling backups, untracked captures/videos/scratch dumps, unused source GeoTIFFs (preserving `N38_00_E128_00_DEM.tif` for LOD verification), deprecated UMD libs, legacy viewers, and intermediate scripts; fixed `.assetsignore`/`.cfignore` so Desktop 4K ETOPO (`16.00 MiB`) deploys cleanly; consolidated 47+ scattered Markdown reports into `README.md` + 3 master docs. |

---

## 2. Documented Failure Modes & Engineering Corrections (Human–AI Audit Evidence)

Preserved explicitly as empirical methodology records for academic analysis:

| Failure ID | Origin / Agent Mistake | Detection & Human Intervention | Architectural Resolution & Guardrail |
| :--- | :--- | :--- | :--- |
| **`FAIL-01`** (`ENTRY-07`) | Procedural translucent glowing sphere domes and vertical epicenter laser beams mimicking WebGL game VFX | Rejected visually by user (`ANTI-REF-01`) | Enforced Nocturnal Monolith shader-only relief rules in `.agents/rules/art_direction.md` and [`SeismicTerrainShaders.js`](../js/3d/shaders/SeismicTerrainShaders.js) |
| **`FAIL-02`** (`ENTRY-09`) | Coastline and GMPE intensity approximated via synthetic `Math.sin()` and arbitrary constants (`terrainElevation.js`, `impactFieldEngine.js`) | Code audit revealed mock math labeled as physical DEM/GMPE | Quarantined mock files; enforced disk-backed Copernicus/ETOPO DEMs & explicit `PROVISIONAL` / `null` provenance tracking |
| **`FAIL-03`** (`ENTRY-10`) | Auto-generated JSON metrics claiming hardcoded FPS (`30`) and `"ACCEPTED_FOUNDATIONAL_RECONSTRUCTION"` without human review | Audit revealed self-reporting loop hallucination | Separated headless script exit status from human artistic sign-off; live metrics measured in headless Chrome CDP |
| **`FAIL-04`** (`Stage R1`) | Stair 3 (`Way 409637898`) and Stair 4 (`Way 187436400`) highlighted one segment too early | Graph-vs-WebGL coordinate verification (`test_r1_architecture_refactoring.js`) | Replaced magic polyline slice indices (`[6..7]`, `[9..10]`) with edge-metadata filtering (`edge.hasStairs === true`) on single-source `HANYANG_OUTDOOR_GRAPH` |
| **`FAIL-05`** (`#1847`) | Straight-line Euclidean proximity selected across-river candidate shelters unreachable without a crossing bridge | Inspection of anomalous mobile/desktop routing candidates (`media_1794857739820`) | Integrated `isSegmentClearOfWaterXZ`, bridge inspection costs (`1.45× + 160m`), urban-canyon OBB risk & MCDA destination ranking `J(S \| o)` |
| **`FAIL-06`** (`a8f2eec`) | Global ETOPO globe rendered completely black on iOS Safari / Apple Metal devices | Live mobile device screenshots showing starfield over pitch-black sphere | Replaced GPU float texture filtering (`FloatType + LinearFilter`) with lossless `RGBA8` (`R=hi, G=lo`, `NearestFilter`) packed CPU-side and bilinearly reconstructed in GLSL + `getTerrainMetricsAt()` |
| **`FAIL-07`** *(Consolidation)* | `.assetsignore` & `.cfignore` excluded `global_etopo_elevation_4096_unorm16.*`, blocking Desktop `HIGH` 4K relief on Cloudflare Workers despite being `16.00 MiB <= 25 MiB` limit | Audit of `.assetsignore` against `js/main.js` fetch calls | Removed `global_etopo_elevation_4096_unorm16.*` exclusion from `.assetsignore` & `.cfignore` and removed obsolete entries (`95` assets, `44.55 MiB` total) |

---

## 3. Post-Cleanup Verification Matrix (All Suites Executed on Clean Tree)

### 3.1 JavaScript Unit & Integration Suites (Deno 2.x — `35 / 35` Suites Passed)
Executed sequentially via `deno run --allow-read --allow-write --allow-net`:

| Test Suite | Passed \| Failed / Notes | Coverage Scope |
| :--- | :---: | :--- |
| `tests/test_geodetic_ellipsoid.js` | `15 PASSED \| 0 FAILED` | WGS84 ECEF/ENU roundtrip, Float32 jitter (`< 0.05m`), geoid status |
| `tests/test_hanyang_adapter.js` | `16 PASSED \| 0 FAILED` | Physical-vs-visual invariance (`651.9m` / `769.1m`), slabs, route display |
| `tests/test_hanyang_response_system.js` | `42 PASSED \| 0 FAILED` | Tangent anchor, indoor-outdoor connector, routing graph, state machine |
| `tests/test_modern_seismic_solvers.js` | `exit 0` (`11` section `[PASS]` checks) | Brune $M_0/M_w$, $t^*$, Madariaga, Eshelby, STA/LTA, AR-AIC, ZRT, Jacobi ODR |
| `tests/test_p1_3_spatial_continuity.js` | `30 PASSED \| 0 FAILED` | Continuous spatial transforms & multi-floor visibility |
| `tests/test_p2_3_interface_integration.js` | `30 PASSED \| 0 FAILED` | `ResponseUIAdapter` ↔ routing & state machine interface contracts |
| `tests/test_p2_4_dynamic_replanning.js` | `18 PASSED \| 0 FAILED` | Closed/blocked edge replanning & detour recovery |
| `tests/test_p2_5_end_to_end_timeline.js` | `33 PASSED \| 0 FAILED` | P2.5 timeline progression (`T+0s`..`T+110s`) & provenance guards |
| `tests/test_p2_6_global_to_personal.js` | `15 PASSED \| 0 FAILED` | Global-to-personal camera flight & local stage synchronization |
| `tests/test_p2_situation_assessment.js` | `23 PASSED \| 0 FAILED` | `SituationAssessmentEngine` hazard & location certainty logic |
| `tests/test_p3_0_ground_data_ingestion.js` | `13 PASSED \| 0 FAILED` | OSM & DEM ingestion normalization (`GroundDataContract`) |
| `tests/test_p3_1_ground_truth_validation.js` | `15 PASSED \| 0 FAILED` | Statutory checklist (`F-01..F-06`), provisional lock |
| `tests/test_phase3_r2_r3_architecture.js` | `27 PASSED \| 0 FAILED` | `R1→R3` ESM unification, `FlightController`, `ExhibitionAppContext`, no UMD refs |
| `tests/test_phase3_to_6_spatial_integration.js` | `18 PASSED \| 0 FAILED` | `hanyang_local_spatial_4km.json` runtime parity, OBBs, UI HUD collision |
| `tests/test_phase_c_wavefield.js` | `74 PASSED \| 0 FAILED` | 3D P/S/R displacement vectors, Rayleigh ellipticity, travel-time physics |
| `tests/test_phase_d2_archival_expansion.js` | `263 PASSED \| 0 FAILED` | 5 benchmark events archival expansion & multilingual toggles |
| `tests/test_phase_d3_soundfield_integrity.js` | `52 PASSED \| 0 FAILED` | 5 event soundfields, compressor/highpass safety, strict `0.0` silence |
| `tests/test_phase_d4_historical_dossier.js` | `393 PASSED \| 0 FAILED` | Historical corpus cross-check, 8-province felt network, methodology |
| `tests/test_phase_d5_error_ellipse.js` | `exit 0` (`47` `[PASS]` checks) | 95% confidence macroseismic error ellipses |
| `tests/test_phase_d6_tsunami_felt.js` | `exit 0` (`6` `[PASS]` checks) | Airy velocity & Green's Law tsunami bathymetric shoaling |
| `tests/test_phase_d_living_memory.js` | `239 PASSED \| 0 FAILED` | 8-field schema, 6-stage lifecycle, kinetic archetypes, pure Hangul |
| `tests/test_phase_e_continuous_earth.js` | `146 PASSED \| 0 FAILED` | Global 4096/2048 relief binaries, Korea macro integration, continuous catalog |
| `tests/test_product_integrated_flow.js` | `23 PASSED \| 0 FAILED` | Unified USGS/Korea feed connector & product UX flow |
| `tests/test_r1_architecture_refactoring.js` | `14 PASSED \| 0 FAILED` | Stair 3/4 alignment, `0.05g`/`0.02g` hysteresis, 2nd facility DI |
| `tests/test_sac_binary_decoder.js` | `exit 0` (`1` suite `[PASS]`) | Binary SAC endianness, header offsets, trace payload decoding |
| `tests/test_security_and_worker.js` | `11 PASSED \| 0 FAILED` | Worker `/api/*` routing, CORS allowlist, CSP header, `htmlEscape()` |
| `tests/test_seismic_mcda_routing.js` | `10 PASSED \| 0 FAILED` | Facade debris, canyon risk, bridge penalties, MMI scaling, `J(S \| o)` scoring |
| `tests/test_stage3_p31_and_single_canvas.js` | `13 PASSED \| 0 FAILED` | `p3_1_field_survey_template.json` null rejection & `ExhibitionModeManager` |
| `tests/test_stage4_evacuation_ux_and_seismic_context.js` | `16 PASSED \| 0 FAILED` | Impact context separation, chase camera, 4km OSM payload integration |
| `tests/test_stage5_nationwide_and_flight_ux.js` | `31 PASSED \| 0 FAILED` | Nationwide Korea spatial engine, `osm_hanyang_campus.json`, Earth→Local flight |
| `tests/test_station_waveform_bridge.js` | `exit 0` (`1` suite `[PASS]`) | `SeismologicalTrace` & `SeismicStationPacket` 3C synchronization |
| `tests/test_terrain_resolver.js` | `68 PASSED \| 0 FAILED` | `tier2_yangyang_{256,512,768}.bin` sizing, UNORM16 decoding, surface class |
| `tests/test_tier2_spatial_intelligence.js` | `19 PASSED \| 0 FAILED` | `avoid_polygons`, 3km spatial chunk streaming, USGS/audification bridges |
| `tests/test_universal_location_engine.js` | `23 PASSED \| 0 FAILED` | Seoul outside-zone vs Gyeongju inside-zone, Sokcho bridge routing, sparse `INSUFFICIENT` |
| `tests/test_universal_stress_matrix.js` | `32 PASSED \| 0 FAILED` | Everest, Challenger Deep, High Arctic, Shinan, Pacific ocean fallbacks |

### 3.2 Python Copernicus 30m DEM Verification (`test_seorak_profile_lod.py`)
- Executed directly against raw GeoTIFF `assets/terrain/copernicus/Copernicus_DSM_COG_10_N38_00_E128_00_DEM.tif`:
  - `Reference Raw DEM 30m Peak: 1612.71 m (Profile Mean: 1194.18 m)`
  - `LOD 768 Peak: 1608.52 m (Trunc: 4.19 m, RMSE: 3.59 m)`
  - `LOD 512 Peak: 1606.15 m (Trunc: 6.56 m, RMSE: 4.46 m)`
  - `LOD 256 Peak: 1606.15 m (Trunc: 6.56 m, RMSE: 9.72 m)`

### 3.3 Headless Chrome WebGL2 End-to-End Suites (`0` Errors, `0` Failures)
1. **`verify_globe_upgrades.js` (`PASS`, `0` errors)**: Verified `4096×2048` global relief + Korea macro fusion (`hasKoreaMacro: 1`), `tectonicBoundaries` hairlines, contours off by default (`0`), `STATE_PERFORMANCE` camera orbit drag (`movedDuringDrag: 0.3053`) & zoom stability (`zoomDistBefore: 0.62 → 0.6476`), Turkey finite fault (`faultLength: 3.1`), and toggleable `#btn-toggle-isoseismal-3d`.
2. **`e2e_phase5_verify.js` (`21 PASSED | 0 FAILED`, `pageErrors=[]`, `consoleErrors=[]`)**: Verified `S1–S16b` desktop workflows (Earth→Gyeongju handoff, Seoul `276.87 km` outside-zone suppression, GPS permission flow, Sokcho free mode + Day Map contrast, sparse OSM `INSUFFICIENT` guard, `6,407`-OBB Hanyang rapid click responsiveness `<= 220 ms`, 1681 Yangyang coastal evacuation handoff) and `M1–M6` cross-device responsive viewports (`360×800`, `375×667`, `393×852`, `844×390`, `768×1024`).
3. **`e2e_mobile_4screens.js` (`PASS`, `0` errors)**: Verified dedicated iPhone `393×852` (`Retina DPR=2`, canvas `786×1704`) across Explore, Selected, Performance, Local Brief, Active Routes, and Walking views with zero horizontal overflow and clear map viewports.
