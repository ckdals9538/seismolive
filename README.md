# SEISMOLIVE v4.0 — The Continuous Living Earth

> **Gallery-grade geospatial seismic media art & evidence-grounded pedestrian evacuation platform**
> Built on a unified WGS84 Three.js ES-module engine connecting global planetary relief, Korean archival epigraphy, modern instrumental seismology, and urban-seismic pedestrian evacuation routing.

- **Live Cloudflare Workers Deployment**: https://seismolive.ckdals9538.workers.dev
- **Core Artistic Governance**: [`GEMINI.md`](GEMINI.md) · [`.agents/rules/art_direction.md`](.agents/rules/art_direction.md)

---

## Documentation Architecture

All project knowledge, mathematical formulations, and development records have been consolidated into three canonical documents in [`docs/`](docs/):

1. **[`docs/01_ARCHITECTURE_AND_GEOSPATIAL.md`](docs/01_ARCHITECTURE_AND_GEOSPATIAL.md)**
   System architecture, 4-stage product flow (`GLOBAL EARTH → EARTHQUAKE → LOCAL SPACE → HUMAN RESPONSE`), WGS84 3-tier ellipsoid math, Float32 Center-Relative Origin quantization control, UNORM16 `RGBA8` WebGL2 texture packing (iOS/Metal & Desktop 4K compatibility), continuous global/Korea DEM shader fusion, tectonic hairlines, Cloudflare Workers edge proxy + strict CSP/CORS security, dedicated mobile UX (`<= 640px`), Living Memory typography & 5-event procedural Web Audio synthesis.
2. **[`docs/02_SCIENTIFIC_RIGOR_MCDA_AND_PAPER_BASIS.md`](docs/02_SCIENTIFIC_RIGOR_MCDA_AND_PAPER_BASIS.md)**
   Research-paper technical basis covering: (a) Historiographic Epigraphy & Tri-Layer Semantic Schema (`SOURCE EVIDENCE` / `SEMANTIC MOTIF` / `EDITORIAL EXPRESSION`) with Pre-1905 Null Magnitude integrity across the 5 core benchmarks (1681 Yangyang, 2016 Gyeongju, 2017 Pohang, 2016 Kumamoto, 2023 Türkiye) plus 2011 Tohoku & 1338 Gaegyeong; (b) 3D vector wavefield equations, Omori/Moho travel-time curves, and Green's Law tsunami shoaling; (c) Modern Instrumental Seismology solvers (Brune $M_0/M_w$, Madariaga $r$, Eshelby $\Delta\sigma$, STA/LTA, Maeda AR-AIC, `Z-N-E → Z-R-T` rotation, Jurkevics Jacobi polarization, ODR fault-plane fitting); and (d) Urban-Seismic Pedestrian Evacuation Graph & Multi-Criteria Destination Objective $J(S \mid o)$ in risk-equivalent meters.
3. **[`docs/03_DEVELOPMENT_CHRONICLE_AND_VALIDATION.md`](docs/03_DEVELOPMENT_CHRONICLE_AND_VALIDATION.md)**
   Chronological Human–AI co-design chronicle (`ENTRY-01` through the `R1→R3` refactor, 4km local spatial upgrade, Workers security hardening, mobile UX redesign, Seismic-MCDA routing, globe wavefield upgrade, and repository consolidation), documented AI failure/correction logs (Anti-Game-VFX charter, synthetic terrain/GMPE rejection, stair highlight index bug, `#1847` cross-river trap, iOS WebGL2 texture fix, `.assetsignore` 4096 DEM deployment fix), and complete post-cleanup regression verification results.

---

## Repository Layout

```text
.
├── index.html                    # Main production entrypoint (Continuous Earth, CSP 'self')
├── viewer_p2_6.html              # Standalone local evacuation simulation & P3.1 inspection entrypoint
├── worker.js                     # Cloudflare Workers gateway (/api/* proxy + strict security headers)
├── wrangler.jsonc                # Cloudflare Workers deployment manifest (ASSETS + run_worker_first)
├── functions/
│   ├── _shared/security.js       # Strict CSP, CORS origin allowlist, cache-control headers
│   └── api/                      # Edge API endpoints (earthquakes.js, shakemap.js, shelters.js)
├── css/                          # theme.css, surface.css, evacuation.css, mobile-app.css (<= 640px)
├── js/
│   ├── main.js                   # Exhibition orchestrator, global/regional shader uniforms, flight loop
│   ├── viewer_p2_6_boot.js       # CSP-compliant bootstrap module for viewer_p2_6.html
│   ├── 3d/                       # WGS84 ECEF, DEM/ETOPO loader, wavefield, Living Memory, GLSL shaders
│   ├── audio/                    # Procedural Web Audio Living Soundfield engine
│   ├── data/                     # Archival/instrumental DBs, SAC decoder, USGS/Live feed, tectonic arcs
│   ├── geophysics/               # Brune/AR-AIC/ODR modern solvers & pure travel-time/tsunami solvers
│   ├── lib/                      # Standalone Three.js r160 ES modules, OrbitControls, htmlEscape
│   ├── response/                 # Nationwide Korea OSM/DEM engine, Seismic-MCDA CampusWalkRouter, P3.1 contracts
│   └── ui/                       # UnifiedControlSurface, DiscoveryBeacons, GeophysicsFolioView, Mobile/Evacuation UI
├── assets/
│   ├── data/                     # USGS fallback GeoJSON, Hanyang 4km OSM/spatial packages & P3.1 survey JSON
│   └── terrain/                  # Global 2048/4096 & Korea 15" macro + regional UNORM16 DEM/bathymetry .bin/.json
├── scripts/                      # Offline DEM/bathymetry preprocessors & scientific coastline seam auditors
├── tests/                        # 35 Deno unit/integration suites + 1 Python DEM LOD validation suite
├── docs/                         # Consolidated 3-volume canonical documentation
├── GEMINI.md                     # Top-level project mandate
└── .agents/                      # Art-direction rules & Three.js/Geospatial skills
```

---

## Quick Verification & Deployment

### Unit & Geodetic Verification (Local)
```bash
# Run all 35 JavaScript/ESM unit & integration suites
for t in tests/test_*.js; do
  deno run --allow-read --allow-write --allow-net "$t" || exit 1
done

# Run Copernicus 30m DEM profile LOD verification (RMSE / peak accuracy)
python3 tests/test_seorak_profile_lod.py
```

### Cloudflare Workers Deployment
Static bundle filtering is controlled by [`.assetsignore`](.assetsignore) (and mirrored in [`.cfignore`](.cfignore)), excluding developer/test trees (`tests/`, `scripts/`, `docs/`, `.agents/`) and server worker code (`worker.js`, `functions/`, `wrangler.jsonc`) while deploying **all** runtime topography assets—including Desktop 4K global ETOPO relief (`global_etopo_elevation_4096_unorm16.bin`, 16.00 MiB, within Workers' 25 MiB per-asset limit).
