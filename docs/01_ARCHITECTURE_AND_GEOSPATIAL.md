# SEISMOLIVE v4.0 — Architecture & Geospatial Engineering Specification

> **Consolidated Reference** unifying System Architecture, Product User Journey, WGS84 3-Tier Ellipsoid Engineering, Global-to-Local Terrain Rendering, Security Infrastructure, Mobile App UX, Living Memory Typography, and Event Soundfields.

---

## 1. Artistic Governance & Product Identity

SEISMOLIVE v4.0 rejects dashboard fatigue and stylized "game VFX" in favor of a **Nocturnal Monolith** visual philosophy (deep abyssal blacks `#030508`–`#080B10`, grazing oblique illumination carving relief ridges, restrained ice/amber signal lines, and 75–88% spatial darkness).

### Core Non-Negotiable Invariants
1. **Strict Ban on Game VFX**: Zero glowing spherical energy domes, zero vertical laser beams above epicenters, zero floating 3D Kanji/Hanja tombstones (`GEMINI.md` Rule 2).
2. **Continuous Spatial Coordinate Integrity**: Orbital globe (`Tier 0`), continental/regional bathymetry (`Tier 1`), local Copernicus topography (`Tier 2`), and street-level 3D OSM evacuation space share one coherent geodetic transformation chain.
3. **Strict Entity Demarcation**: `EarthquakeOrigin`, `UserAnalysisLocation`, and `AnalysisAnchor` remain independent WGS84 coordinates. A user viewing a Gyeongju event from Seoul receives distant-field context (`OUTSIDE_IMPACT_ZONE`) rather than fabricated evacuation arrows.
4. **Honest `PROVISIONAL` / `null` Scientific Representation**: Unmeasured pre-1905 magnitudes remain `null`; unverified building exits/thresholds remain `VERIFICATION_STATUS.PROVISIONAL`; sparse OSM areas report `INSUFFICIENT` instead of fabricating fake roads or shelters.

---

## 2. Four-Stage Unified Experience Pipeline

```text
[Stage 1: GLOBAL EARTH]      Explore 4K/2K relief globe + Korea 15" macro overlay + USGS/KMA/Historical beacons
         │  Select EarthquakeEvent OR enter Location Gate ("내 위치 기준" / "자유 모드")
         ▼
[Stage 2: EARTHQUAKE]        FlightController ballistic SLERP arc glides to epicenter -> 3D Vector Wavefield,
         │                   Tectonic/Fault-Seam hairlines, Travel-Time & Tsunami Folio, Living Memory & Soundfield
         ▼  Pass NormalizedEarthquakeEvent -> ActiveHazardContext
[Stage 3: LOCAL SPACE]       NationwideKoreaSpatialEngine dynamically builds up to 4km+ local ENU terrain:
         │                   Mapzen Terrarium DEM, OSM Building OBBs (6,343 in Hanyang core), Walkways, Waterways, Shelters
         ▼
[Stage 4: HUMAN RESPONSE]    HazardAssessment + SituationAssessmentEngine + CampusWalkRouter (Seismic-MCDA)
                             -> Protection hold (PGA >= 0.05g) / Egress path avoiding rivers without bridges & debris canyons
```

### Dedicated Mobile App-Grade UX (`<= 640px`)
Implemented in [`css/mobile-app.css`](../css/mobile-app.css), [`js/main.js`](../js/main.js), [`js/ui/UnifiedControlSurface.js`](../js/ui/UnifiedControlSurface.js), and [`js/ui/EvacuationExperienceController.js`](../js/ui/EvacuationExperienceController.js):
- **Map-First Spatial Allocation**: Removes secondary desktop inspector badges and multi-choice clutter on phones, foregrounding the 3D globe/local evacuation map with single primary action cards following Korean map-navigation ergonomics.
- **Retina & Viewport Calibration**: Supports `DPR = 2` scaling on mobile viewports (`360x800`, `375x667`, `393x852`), expanded portrait camera FOV so orbital framing never clips the southern hemisphere or bottom dock, and zero sticky control collisions across landscape and tablet breakpoints.
- **2K Global Relief Tier on Mobile**: Automatically selects `global_etopo_elevation_2048_unorm16.bin` when `window.innerWidth <= 640` or `qualityMode === 'CLASSROOM'`, keeping Desktop `HIGH` mode (`window.innerWidth > 640`) on `global_etopo_elevation_4096_unorm16.bin`.

---

## 3. WGS84 Geodesy & 3-Tier Terrain Architecture

### 3.1 Standard Reference Ellipsoid & Coordinate Separation
Defined in [`js/3d/geodeticEllipsoidCoord.js`](../js/3d/geodeticEllipsoidCoord.js) and [`js/3d/FlightController.js`](../js/3d/FlightController.js):
- **WGS84 Parameters**:
  - Semi-major axis $a = 6{,}378{,}137.0\text{ m}$
  - Flattening $f = \frac{1}{298.257223563}$, first eccentricity squared $e^2 = 2f - f^2 \approx 0.00669437999014$
  - Meridian radius of curvature $M(\phi)$, prime vertical radius $N(\phi) = \frac{a}{\sqrt{1 - e^2\sin^2\phi}}$
- **Scale & Float32 Quantization Guard (`Center-Relative Origin`)**:
  - $1\text{ Three.js world unit} = 100{,}000.0\text{ m}$ ($100\text{ km}$); standard globe radius offset $R \approx 63.71\text{ units}$ (`globeCenter = [0, -63.78137, 0]` for tangent alignment).
  - Subtracting the local tangent origin $[X_0, Y_0, Z_0]$ in Double precision (`Float64`) before GPU upload eliminates 24-bit mantissa jitter, keeping spatial quantization error **$< 0.05\text{ m}$ across a $60\text{ km}$ regional theater**.
- **Anisotropic 1.0" Copernicus Pixel Aspect Ratio**: At $38.15^\circ\text{N}$, $\Delta x \approx 24.33\text{ m}$ vs. $\Delta y \approx 30.71\text{ m}$ ($\Delta y / \Delta x \approx 1.262$), explicitly compensated when generating physical extents (`physicalWidthUnits`, `physicalHeightUnits`) from sidecar JSON metadata in [`EventTerrainCatalog.js`](../js/data/EventTerrainCatalog.js).

### 3.2 Multi-Tier Terrain Datasets & Seamless Fusion
| Tier | Scope & Resolution | Storage & Format | Key Feature |
| :--- | :--- | :--- | :--- |
| **Tier 0** | Global Planetary Relief (`60"` / `30"`) | `global_etopo_elevation_{2048,4096}_unorm16.bin` | `-11,000 m` trench to `+9,000 m` Himalayan relief on WGS84 spheroid |
| **Tier 0.5** | Korean Peninsula Macro (`15"`, $960 \times 1080$) | `korea_macro_elevation_unorm16.bin` ($33^\circ$–$42^\circ\text{N}$, $124^\circ$–$132^\circ\text{E}$) | Smoothly edge-feathered (`smoothstep(0.0, 0.60, min(mLat, mLon))`) onto the globe via [`sampleEarthMeters`](../js/3d/shaders/SeismicTerrainShaders.js) so Korea renders without square cutouts |
| **Tier 1** | Regional Benchmark Theaters | `fused_seorak_donghae_unorm16.bin` (`1800x1440`), `regional_{2016_gyeongju,2017_pohang,2016_kumamoto,2023_turkey,baekje,central_korea,jeju,pyongyang}_unorm16.bin` (`900x720`) | `-3500 m` to `+2500 m` (`0.0000 mm` coastline step verified across land/ocean seams); double-buffered via `TerrainLifecycleManager` |
| **Tier 2** | Local Copernicus GLO-30 Inset (`30m`) | `tier2_yangyang_{256,512,768}.bin` | Progressive LOD inset; LOD `768` verified against raw GeoTIFF (`RMSE = 3.59 m`, summit peak `1608.52 m` vs `1612.71 m`) |

### 3.3 WebGL2 Universal UNORM16 `RGBA8` Packing (iOS Safari Fix)
Early builds using `RG`/`HalfFloatType`/`FloatType` textures rendered **pure black globes** on iOS Safari / Apple Metal devices lacking `OES_texture_float_linear`. Fixed cleanly across [`packUnorm16ToRgbaTexture`](../js/3d/terrainDataResolver.js) and [`decodeUnorm16Rgba` / `sampleUnorm16Linear`](../js/3d/shaders/SeismicTerrainShaders.js):
- Host JavaScript packs each 16-bit integer `v` into `RGBA8` (`UnsignedByteType`, `NearestFilter`):
  `R = (v >> 8) & 0xff`, `G = v & 0xff`, `B = 0`, `A = 255`.
- Both [`SeismicTerrainShaders.js`](../js/3d/shaders/SeismicTerrainShaders.js) and CPU-side height queries (`getTerrainMetricsAt()` in [`js/main.js`](../js/main.js)) reconstruct lossless 16-bit precision via manual texel-center bilinear filtering (`(c.r * 65280.0 + c.g * 255.0) / 65535.0`), guaranteeing identical relief across Desktop Metal, ANGLE Chrome, and iOS WebKit.

### 3.4 Tectonic Micro-Hairlines & Post-Descent Camera Control
- [`js/data/tectonicBoundaries.js`](../js/data/tectonicBoundaries.js) renders `TECTONIC_ARCS` (Kuril–Japan Trench, Izu–Bonin Arc, Nankai–Ryukyu Trench, Sagami–Suruga Trough, East Sea Back-Arc Thrust, Yangsan Fault, Chugaryeong Rift, North & East Anatolian Faults) as restrained Cartographic hairlines (`opacity: 0.11–0.16`).
- Optional toggle (`#btn-toggle-isoseismal-3d`) separates physical wave propagation from macroseismic confidence ellipses (`u_showContours`), avoiding initial visual clutter.
- `FlightController.computeSphericalFlightPose()` uses cubic easing + orbital apex hop + SLERP orientation transitions, followed by deterministic `OrbitControls` target/polar/azimuth synchronization so post-descent rotation and zoom remain locked cleanly to the tangent surface without flipping.

---

## 4. Runtime Module Graph, Cloudflare Workers & Security Architecture

### 4.1 Frontend Entrypoints & Core Modules
- **`index.html` → `js/main.js`**: Unified Three.js r160 ESM runtime via [`three-runtime.js`](../js/lib/three-runtime.js) + [`OrbitControls.module.js`](../js/lib/OrbitControls.module.js) (zero UMD scripts).
  - **Shading & Flight**: `SeismicTerrainShaders.js`, `FlightController.js`, `terrainDataResolver.js`, `EventTerrainCatalog.js`, `GeoRasterSampler.js`
  - **Wavefield & Memory**: `seismicSourceModel.js`, `universalWavefieldEngine.js`, `wavefieldVisualOrchestrator.js`, `livingMemoryEngine.js`, `ArchivalSemanticParser.js`, `livingSoundfieldEngine.js`
  - **Catalog & UI**: `historicalArchiveDB.js`, `instrumentalCatalogDB.js`, `usgsFeedConnector.js`, `LiveSeismicDataService.js`, `UsgsOfficialProductsBridge.js`, `DiscoveryBeacons.js`, `UnifiedControlSurface.js`, `GeophysicsFolioView.js`, `ExhibitionAppContext.js`, `ExhibitionModeManager.js`
  - **Local Evacuation Bridge**: `EvacuationExperienceController.js`, `NationwideKoreaSpatialEngine.js`, `CampusWalkRouter.js`, `LocalSpatialMapLayer.js`, `SpatialChunkManager.js`, `SpatialDataProviders.js`, `SeismicImpactContext.js`
- **`viewer_p2_6.html` → `js/viewer_p2_6_boot.js`**: CSP-compliant inline-free bootstrap module driving standalone evacuation simulation (`ResponseDomainTypes.js`, `HanyangBuildingData.js`, `PedestrianRoutingEngine.js`, `HanyangResponseAdapter.js`, `GlobalLocalCameraTransition.js`, `SituationAssessmentEngine.js`, `ResponseStateMachine.js`, `GroundDataContract.js`, `ResponseUIAdapter.js`).

### 4.2 Cloudflare Workers & Security Hardening
Configured in [`wrangler.jsonc`](../wrangler.jsonc), [`worker.js`](../worker.js), [`functions/_shared/security.js`](../functions/_shared/security.js), and [`js/lib/htmlEscape.js`](../js/lib/htmlEscape.js):
- **Edge Routing**: `run_worker_first: ["/api/*"]` intercepts API routes first; remaining asset requests fall through to `env.ASSETS.fetch(request)` with strict security headers injected on HTML responses.
- **Strict Content Security Policy (CSP)**:
  - `default-src 'self'`, `script-src 'self'` (zero inline `<script>` tags across HTML entrypoints), `object-src 'none'`, `frame-ancestors 'none'`, `base-uri 'self'`, `form-action 'self'`, plus scoped `connect-src` for USGS Earthquake API, Mapzen Terrarium DEM tiles, OSM/Nominatim/Overpass, and `upgrade-insecure-requests` on HTTPS.
- **Origin & XSS Defenses**:
  - `isAllowedOrigin()` restricts CORS to `https://(*. )?seismolive.ckdals9538.workers.dev` and `localhost`/`127.0.0.1`; API requests from unauthorized external origins return `403 FORBIDDEN_ORIGIN`.
  - All external API text (USGS titles, OSM tags, geocoder results) passes through `escapeHtml()` in `js/lib/htmlEscape.js` before DOM insertion.
- **Edge Caching & Deployment Bundle**:
  - Public JSON endpoints (`/api/earthquakes`, `/api/shakemap`, `/api/shelters`) use edge `Cache-Control` (`s-maxage` + `stale-while-revalidate`).
  - [`.assetsignore`](../.assetsignore) excludes developer scripts/docs/tests and server code (`worker.js`, `wrangler.jsonc`, `functions/`) while shipping all `95` runtime static files (`44.55 MiB` total; largest asset `global_etopo_elevation_4096_unorm16.bin` at `16.00 MiB <= 25 MiB` Workers cap).

---

## 5. Living Memory Typography & Event Soundfield Engine

### 5.1 Decoupled Memory Timeline & Dual-Pass Legibility
- **Temporal Decoupling**: Living Memory words traverse a 6-stage lifecycle (`LATENT → EMERGENCE → FORMATION → RESONANCE → DISSOLUTION → RESIDUE → DEAD`) decoupled from elastic P/S/R wave arrival times, preserving gallery poise without cluttering seismic wave crests.
- **4 Kinetic Archetypes** (`RESONANCE`, `FRACTURE` sliding down terrain gradient $(-\nabla h, -g\Delta t^2)$ after a readability lock, `RECEDE` vertical ocean drawback modulation, `EXPOSE` alluvial emergence), rendered via Dual-Pass Gaussian Ambient Cushion sprites (`NormalBlending`) with editorial serif typography tailored per language script (Nanum Myeongjo, Hiragino Mincho ProN, Cinzel).

### 5.2 Procedural Event-Specific Soundfields
Implemented in [`js/audio/livingSoundfieldEngine.js`](../js/audio/livingSoundfieldEngine.js) independently of Three.js render loops:
- **Five Distinct Synthesis Graphs**: `1681 Yangyang` (sub-void 54→38 Hz sine glide + oceanic delay feedback), `2016 Gyeongju` (48/82 Hz dual granite BPF resonators + highpass friction), `2017 Pohang` (asymmetric stereo triangle resonators `138 Hz` L / `104 Hz` R), `2016 Kumamoto` (32 Hz graben rumble + 65 ms slapback shear noise), `2023 Türkiye` (40 Hz pulse across 4-tap `0.18s–2.30s` continental fault delay network).
- **Silence & Safety Guarantee**: Browser `AudioContext` stays `suspended` until explicit user gesture; master bus enforces a 30 Hz high-pass sub-cut filter and Dynamics Compressor (`-12 dB`, `4:1`), converging strictly to `0.0` gain upon reaching `DEAD` or Mute.
