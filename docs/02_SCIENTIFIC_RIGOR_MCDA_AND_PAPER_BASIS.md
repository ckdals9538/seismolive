# SEISMOLIVE v4.0 — Scientific Rigor, Historiography, Seismic-MCDA Routing & Research Paper Basis

> **Academic Consolidation Document** synthesizing Historical Epigraphy, 3D Elastic Wavefield & Hydrodynamic Models, Modern Instrumental Seismology Solvers, and Urban-Seismic Multi-Criteria Evacuation Routing (`J(S | o)`). Every equation, constant, and epistemic classification below maps directly to verified modules in this repository.

---

## 1. Epistemological Boundaries & Archival Historiography

### 1.1 Scientific Honesty Rules
1. **Pre-1905 Null Magnitude Integrity**: Pre-instrumental chronicles (e.g., 1681 Yangyang, 1338 Gaegyeong) store quantitative instrumental `magnitude` as `null` (`UNKNOWN_UNRECORDED` for focal depth unless constrained by external literature), visually separated from modern catalog events (`OBSERVED` / `OFFICIAL`).
2. **Evidence-Grounded Phenomenon Segregation ("No Fabrication")**: Effects observed only in oceanic events (marine drawback `퇴조`) never leak into inland basin or continental fault profiles (2016 Gyeongju, 2023 Türkiye), while sedimentary liquefaction (`솟구치다`) is isolated to coastal deltaic alluvium (2017 Pohang).
3. **Uncertainty Visualization via Probabilistic Ellipses**: Instead of claiming point precision for pre-instrumental earthquakes, macroseismic epicentral uncertainty is represented via 95% confidence covariance ellipses (toggleable contour mode).

### 1.2 Tri-Layer Archival Schema (`ArchivalSemanticParser.js`)
Every historical or institutional record is strictly separated across three traceable strata:

| Layer | Identifier | Data Source / Constraints | Examples (1681 Yangyang) |
| :--- | :--- | :--- | :--- |
| **Layer A** | `SOURCE EVIDENCE` | Verbatim Sino-Korean chronicles (*Veritable Records of King Sukjong*, *Seungjeongwon Ilgi*, *Jeungbo Munheon Bigo*) or institutional reports (KMA, USGS, JMA, AFAD) with recording date & credibility tier (`PRIMARY_CHRONICLE`, `PRIMARY_OFFICIAL`) | `海水如潮退而溢`, `襄陽洛山寺雪嶽山神興寺巖石崩頹`, `海水退潮百餘步` |
| **Layer B** | `SEMANTIC MOTIF` | Objective physical/natural phenomenon class derived from Layer A | `TSUNAMI_RECESSION`, `ALPINE_ROAR`, `ALPINE_ROCKFALL`, `SUBSEA_EXPOSURE` |
| **Layer C** | `EDITORIAL EXPRESSION` | 1–4 syllable pure Korean/native token classified as `DIRECT_ARCHIVAL_CITATION` or `EDITORIAL_DISTILLATION`; full explanatory sentences are strictly banned in 3D space | `퇴조`, `드러나다`, `울다`, `무너지다` |

### 1.3 Benchmark Event Coverage Matrix ([`EventTerrainCatalog.js`](../js/data/EventTerrainCatalog.js))
| Event ID | Geological Setting | Physical Extent & Elev. Range (`h`) | Key Analytical Motif |
| :--- | :--- | :--- | :--- |
| `hist_1681_0626` (1681 Yangyang) | Offshore East Sea Shelf + Taebaek Granite Alps | `1800×1440` (`-2350m` to `+1675m`), Tier 2 inset | Bathymetric tsunami drawback (`퇴조`) & rockfall (`무너지다`) |
| `hist_1338_gaegyeong` (1338 Gaegyeong) | Inland Granitic Basin (`hasOcean: false`) | `900×720` (`-120m` to `+1420m`) | Multi-day continental intracratonic tremor (`흔들리다`) |
| `global_2016_gyeongju` (2016 Gyeongju, $M_L$ 5.8) | Inland Fault Basin (`Yangsan Fault`, `hasOcean: false`) | `900×720` (`-3500m` to `+2500m` scale) | Subsurface acoustic resonance (`굉음`) & heritage structural drift (`기울다`) |
| `global_2017_pohang` (2017 Pohang, $M_w$ 5.4) | Alluvial Coastal Basin (`Yeongil Bay`) | `900×720` | Shallow rupture (`t*`/low stress drop) & sand-boil liquefaction (`솟구치다`) |
| `global_2016_kumamoto` (2016 Kumamoto, $M_w$ 7.0) | Volcanic Graben & Caldera (`Aso/Futagawa`) | `900×720` (`ocean: 17.3%`) | Graben surface rupture (`割れる` / `갈라지다`) |
| `global_2023_turkey` (2023 Türkiye, $M_w$ 7.8) | Continental Strike-Slip Fault (`East Anatolian`, `hasOcean: false`) | `900×720` (`227m` to `2302.6m`) | Bilateral 300 km continental rupture (`Kırılma` / `파열`) |
| `global_2011_tohoku` (2011 Tohoku, $M_w$ 9.1) | Subduction Trench (`Japan Trench`) | Planetary Global Relief (`hasOcean: true`) | Mega-thrust subduction & ocean-scale Rayleigh radiation |

---

## 2. Wavefield, Travel-Time & Tsunami Hydrodynamics

### 2.1 3D Elastic Vector Displacement ([`UniversalWavefieldEngine.js`](../js/3d/universalWavefieldEngine.js))
Rather than scalar height additions, the engine evaluates vector displacement along ray-path azimuth and retrograde Rayleigh polarity:
$$\mathbf{u}(\mathbf{x}, t) = \mathbf{u}_P(\mathbf{x}, t) + \mathbf{u}_S(\mathbf{x}, t) + \mathbf{u}_R(\mathbf{x}, t)$$
- **Plummer Hypocenter Regularization**: Uses numerical radius `r0_body` / `delta0_surf` (`NUMERICAL_REGULARIZATION_PARAMETER`) to guarantee smooth finite bounds as $R \to 0$ without misrepresenting it as a physical fault radius.
- **Rayleigh Wave Retrograde Orbit**: Enforces Poisson-solid reference vertical-to-horizontal ellipticity ratio $1.47$ (`REFERENCE_APPROXIMATION`) and retrograde particle motion along the surface arrival isochrone $t_R = h_{\text{hypo}} / V_S + \Delta_{\text{epi}} / V_R$.

### 2.2 Refracted Head-Wave & Tsunami Shoaling ([`TravelTimeSolvers.js`](../js/geophysics/TravelTimeSolvers.js))
Domain-pure geophysical solvers separated completely from DOM/SVG rendering ([`GeophysicsFolioView.js`](../js/ui/GeophysicsFolioView.js)):
- **Omori Triangulation Constant & Moho Critical Refraction** (crustal $V_1$, upper-mantle $V_2$, shear $V_S$):
  $$K_{\text{Omori}} = \frac{V_1 V_S}{V_1 - V_S}, \quad X_{\text{crit}} = \frac{2 h V_1}{\sqrt{V_2^2 - V_1^2}}, \quad X_{\text{cross}} = 2 h \sqrt{\frac{V_2 + V_1}{V_2 - V_1}}, \quad t_i = \frac{2 h \sqrt{V_2^2 - V_1^2}}{V_1 V_2}$$
- **Airy Shallow-Water Speed & Green's Law Shoaling Amplification**:
  $$c = \sqrt{g H}, \quad \frac{A_{\text{coast}}}{A_{\text{deep}}} = \left(\frac{H_{\text{deep}}}{H_{\text{coast}}}\right)^{1/4}, \quad \tau_{\text{slope}} = \frac{2L}{\sqrt{g}\left(\sqrt{H_{\text{deep}}} + \sqrt{H_{\text{coast}}}\right)}$$
  *(Used to quantify why East Sea continental-slope bathymetry produces non-linear tsunami shoaling and ~13-minute coastal onset timing in the 1681 Yangyang historical model.)*

---

## 3. Modern Instrumental Seismology Pipeline ([`ModernSeismicSolvers.js`](../js/geophysics/ModernSeismicSolvers.js))

Designed for direct 100 Hz 3-component (`Z`, `N`, `E`) broadband station packets ([`StationWaveformBridge.js`](../js/data/StationWaveformBridge.js), [`sacBinaryDecoder.js`](../js/data/sacBinaryDecoder.js)) following IASPEI / ObsPy conventions:

| Module Group | Implemented Formulation & Standard | Verification Status & Benchmarks |
| :--- | :--- | :--- |
| **Source Parameter Inversion** (`SOLV-01..04`) | Brune (1970) $M_0 = \frac{4\pi \rho V_S^3 R \Omega_0^{\text{corr}}}{\mathcal{R}_{\theta\phi} F_S}$, $M_w = \frac{2}{3}\log_{10} M_0 - 6.07$, attenuation $t^* = R/(Q V_S)$, Madariaga (1976) $r = \frac{2.34 V_S}{2\pi f_c}$, Eshelby (1957) $\Delta\sigma = \frac{7}{16}\frac{M_0}{r^3}$ | **`VERIFIED`**: Reproduces 경주 $\Delta\sigma \approx 5.46\text{ MPa}$ vs. 포항 저응력 $\Delta\sigma \approx 2.18\text{ MPa}$ ($t^* = 0.0400\text{s}$ at $R=35\text{km}, Q=250$) |
| **Phase Picking** (`SOLV-05..08`) | Recursive STA/LTA (`0.2s`/`2.0s`) trigger-windowing + Maeda (1985) AR-AIC minimum-information picker on P (vertical $Z$) and S (transverse $T$) | **`VERIFIED`**: $\text{SNR} \ge 5.0$ P-pick median error $\le 10.0\text{ ms}$; S-pick within $\le 20\text{ ms}$ |
| **Coordinate Symmetry & Polarization** (`SOLV-09..10`) | 4-azimuth symmetric $Z-N-E \to Z-R-T$ rotation ($R$ away from source, $T_{\text{ObsPy}}$ $90^\circ$ clockwise of $R$) + Jurkevics (1988) $3\times 3$ covariance polarization | **`VERIFIED`**: Rectilinearity $L = 1.000$, Planarity $P = 0.000$ on synthetic linear P-wave |
| **3D Fault Plane Fitting (ODR)** (`SOLV-12..15`) | 50-iter Jacobi $3\times 3$ eigensolver ($<10^{-15}$ convergence) for Orthogonal Distance Regression on relocated aftershocks, outlier trimming, and conjugate coplanarity rejection | **`VERIFIED`**: Recovers `strike=25.0°, dip=70.0°` with $\text{RMS}=2.8\text{ m}$; trims 10% extreme outliers ($\text{RMS } 498\text{m}\to 31\text{m}$); rejects $90^\circ$ conjugate clouds (`isCoplanar = false`) |
| **Sensor PAZ & Live GPU Texture** (`INGEST-03/04`, `GPU-02/03`) | SAC binary parser (`VERIFIED`); Poles & Zeros deconvolution, miniseed streaming, and 1D→2D IDW GPU terrain driving (`DESIGNED` interface ready) | **`DESIGNED`** (explicitly separated from synthetic shader drivers; zero false claims) |

---

## 4. Urban-Seismic Pedestrian Evacuation Routing & Seismic-MCDA Model

The local spatial response engine ([`CampusWalkRouter.js`](../js/response/CampusWalkRouter.js), [`NationwideKoreaSpatialEngine.js`](../js/response/NationwideKoreaSpatialEngine.js), [`ResponseDomainTypes.js`](../js/response/ResponseDomainTypes.js)) replaces naive Euclidean shelter distance with a physically grounded **Urban-Seismic Multi-Criteria Pedestrian Network Solver**.

### 4.1 Hard Physical Feasibility Guards
1. **Non-Bridge Water Exclusion (`isSegmentClearOfWaterXZ`)**: Pedestrian edges cannot cross mapped rivers/streams (polygons or linear waterways such as Jungnangcheon / Hangang / Cheongchocheon) unless the edge carries an explicit bridge attribute (`bridge=yes`). Resolves the cross-river Euclidean trap (e.g., Building `#1847` across Jungnangcheon selecting a walkable bridge route over an unreachable Euclidean-nearest across-river point).
2. **2D Spatial OBB Obstacle Avoidance & Exit Projection**: Dynamically built or OSM building footprints act as Oriented Bounding Boxes (`[east_m, north_m, width_m, depth_m, yaw_rad, height_m]`), computing perimeter street-facing portal exits and 2D visibility-graph corner detours so rendered polylines never slice through concrete walls.
3. **Facility Filtering & `PROVISIONAL` Governance**: Filters non-evacuation micro-structures (e.g., OSM gazebos/pagodas) out of valid open assembly candidates while preserving `CONDITIONAL` provenance for unverified municipal tags, alongside strict P3.1 statutory threshold blocking (`F-01..F-06`, missing `null` fields block promotion to `VERIFIED`).

### 4.2 Urban-Seismic Edge Traversal Cost (`computeSegmentAStarMultiplier`)
For every pedestrian graph segment $e = (u, v)$ of Euclidean slope length $d_e$ (m), A* evaluates hazard-adjusted effective risk distance:
$$w(e) = d_e \cdot \Big[ m_{\text{hw}}(e) \cdot m_{\text{bridge}}(e) \cdot m_{\text{slope}}(e) + g_{\text{stairs}}(e) + \gamma(\text{MMI})\,\big(0.90\,r_{\text{debris}}(e) + 1.15\,r_{\text{canyon}}(e)\big) + g_{\text{narrow}}(W_e) \Big] + C_{\text{bridge}}(e)$$

Where key empirically calibrated parameters in `WALK_ROUTING_WEIGHTS` are:
- **Facade Collapse Reach (`debrisFallRatioOfHeight = 0.45`, Hirokawa & Osaragi / ATC-138 envelope)**: Each nearby building OBB of height $h \ge 4\text{ m}$ projects a falling-debris envelope $\text{reach} = \text{clamp}(0.45h, 4.5, 28.0)\text{ m}$ perpendicular to segment $u \to v$, yielding asymmetric left/right threat $t_L, t_R = \max(0, 1 - \text{clear}/\text{reach})$ and corridor debris risk $r_{\text{debris}} = \max(t_L, t_R)$.
- **Bilateral Urban Canyon Trapping (`bilateralCanyonGain = 1.15`)**: When tall facades encroach on both sides ($t_L > 0.12$ and $t_R > 0.12$), mutual debris entanglement risk is $r_{\text{canyon}} = \min(1.0, 1.5\sqrt{t_L t_R})$.
- **Narrow Alley Penalty (`narrowCorridorThresholdM = 6.5 m`, `narrowCorridorMaxGain = 0.35`)**: Clear corridor widths below $6.5\text{ m}$ smoothly add up to $+0.35$ multiplier.
- **Bridge Inspection Overhead**: Bridge crossings apply `bridgeInspectionMultiplier = 1.45` plus a one-time post-quake structural abutment inspection penalty `bridgeFixedInspectionMeters = 160.0` (scaled by $\gamma$).
- **MMI Intensity Modulation (`computeShakingIntensityFactor`)**: Scales debris/canyon/bridge risk via $\gamma(\text{MMI}) = \text{clamp}(0.75 + 0.22\max(0, \text{MMI} - 5.0), 0.75, 1.80)$, defaulting cleanly to $\gamma = 1.0$ whenever ShakeMap/MMI is unavailable (zero fabricated intensity).

### 4.3 Multi-Criteria Destination Objective $J(S \mid o)$ (`evaluateDestinationMcdaScore`)
Candidate destinations $S$ are ranked in **risk-equivalent meters** (lower $J$ is preferred) from origin $o$:
$$J(S \mid o) = \max\Big(1,\; C_{\text{risk}}(\pi^*_{o \to S}) + P_{\text{water}}(S) + P_{\text{standoff}}(S) - B_{\text{official}}(S) - B_{\text{standoff}}(S) - B_{\text{area}}(S)\Big)$$
- $C_{\text{risk}}(\pi^*_{o \to S})$: Total A* risk-equivalent distance along the verified collision-free walkable path.
- **Destination Hazard Penalties**: $P_{\text{water}} = +75\text{ m}$ if near unconfirmed waterway zone; $P_{\text{standoff}} = +85\text{ m}$ if clearance $< 6\text{ m}$ or $+30\text{ m}$ if $< 12\text{ m}$.
- **Destination Safety Bonuses**: Official confirmation bonus ($B_{\text{official}} = 75\text{ m}$ for confirmed national shelter vs. $22\text{ m}$ for OSM assembly tag), facade standoff bonus ($\min(40, (\text{clearance} - 8) \cdot 1.6)\text{ m}$), and large open-ground area capacity bonus ($\min(25, 0.25\sqrt{\text{area}})$ for area $\ge 1500\text{ m}^2$).

### 4.4 Protective Hold vs. Egress Hysteresis (`SEISMIC_MOTION_POLICY`)
Reconciled across `ResponseDomainTypes.js`, `ResponseStateMachine.js`, `SituationAssessmentEngine.js`, and `PersonalResponseInteraction.js`:
- **Onset (`PROTECTIVE_ONSET_PGA_G = 0.05 g`)**: Enforces `S1_SHAKING` (`Drop, Cover, Hold On`) and prohibits walking.
- **Quiescence Release (`QUIESCENCE_RELEASE_PGA_G = 0.02 g`, `QUIESCENCE_MIN_DURATION_SEC = 10.0 s`)**: Requires sustained motion below $0.02\text{ g}$ for $\ge 10\text{ s}$ before advancing to `S2_POST_SHAKING_ASSESSMENT`, preventing oscillation across the `[0.02g, 0.05g)` hysteresis band.
