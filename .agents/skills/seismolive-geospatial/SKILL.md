---
name: seismolive-geospatial
description: Scientific standards and geospatial data processing pipelines for SEISMOLIVE v4.0. Covers DEM elevation, ocean bathymetry, GeoTIFF, WGS84 and local tangent projection, vertical datums, tiling/LOD, data provenance/licensing, and field-based seismic parameter mapping.
---

# SEISMOLIVE Geospatial Skill

This skill governs the scientific integrity, geographical coordinate conversions, raster terrain pipelines, and data provenance standards for SEISMOLIVE v4.0.

---

## 1. Topographic Elevation & Marine Bathymetry Datasets

Never generate synthetic sine-wave coastlines or procedural landmasses for production environments. Always utilize verified open geographical raster sources.

| Domain | Recommended Dataset | Resolution | Vertical Range | Provenance & License |
|:---|:---|:---|:---|:---|
| **Land Elevation (DEM)** | Copernicus DEM (GLO-30) | ~30 meters (1 arcsec) | 0m to +8,848m | European Space Agency (ESA) / Open Access |
| **Alternative Land DEM** | NASA SRTM v3.0 | ~30 meters (1 arcsec) | 0m to +6,000m | NASA / USGS Public Domain |
| **Ocean Bathymetry** | GEBCO 2023 Grid | 15 arc-seconds (~450m) | -11,000m to 0m | IHO-IOC GEBCO / CC-BY 4.0 |
| **Combined Relief** | ETOPO 2022 | 15 arc-seconds | -11,000m to +8,848m | NOAA National Centers for Environmental Information |

### Vertical Datum & Normalization
- **Land Datum**: Heights ($h > 0$) referenced to EGM96 or EGM2008 Geoid approximating Mean Sea Level (MSL).
- **Marine Datum**: Depths ($d < 0$) referenced to Mean Sea Level (MSL).
- **16-Bit Normalization Formula for GPU Textures**:
  $$\text{Normalized Value } N \in [0.0, 1.0]$$
  $$N = \frac{h - H_{\min}}{H_{\max} - H_{\min}} \quad \text{where } H_{\min} = -10,000\text{ m}, \; H_{\max} = +4,000\text{ m}$$
  $$h = N \cdot (H_{\max} - H_{\min}) + H_{\min}$$

---

## 2. Coordinate Reference Systems (CRS) & Projections

SEISMOLIVE operates across two coupled spatial scales to eliminate 32-bit floating point precision jitter (z-fighting):

### Level 1: Global Planetary Curved Space (WGS84 Ellipsoid)
- **Input**: Geographic Coordinates $(\phi, \lambda, h)$ where $\phi = \text{Latitude}$, $\lambda = \text{Longitude}$, $h = \text{Height in meters}$.
- **Ellipsoid Parameters** (WGS84):
  - Semi-major axis $a = 6,378.137\text{ km}$
  - Semi-minor axis $b = 6,356.7523\text{ km}$
  - Flattening $f = 1/298.257223563$
- **Geocentric Cartesian Conversion** ([`sphericalCoord.js`](file:///Users/katsina/Downloads/earth/js/3d/sphericalCoord.js)):
  $$N(\phi) = \frac{a}{\sqrt{1 - e^2 \sin^2 \phi}}$$
  $$X = (N(\phi) + h) \cos \phi \cos \lambda$$
  $$Y = (N(\phi) + h) \cos \phi \sin \lambda$$
  $$Z = \left(N(\phi)(1 - e^2) + h\right) \sin \phi$$

### Level 2: Regional Focus Space (Local Tangent Plane / ENU)
- For high-resolution event scenes (e.g., $300\text{ km} \times 300\text{ km}$ surrounding Gyeongju or Yangyang):
  - Project geographic coordinates into an East-North-Up (ENU) Cartesian frame centered at the event epicenter $(\phi_0, \lambda_0)$.
  - Prevents floating-point sub-millimeter precision loss in vertex shaders.

---

## 3. Data-Driven Seismic Fields vs Artificial VFX

Seismic phenomena must be treated as continuous scalar/vector **fields** sampled by surface shaders:

### A. Kinematic Wavefield Arrival Field $T(x, y)$
- For homogeneous crustal approximations:
  $$T_P(x, y) = \frac{\sqrt{\Delta(x, y)^2 + D^2}}{V_P}, \quad T_S(x, y) = \frac{\sqrt{\Delta(x, y)^2 + D^2}}{V_S}$$
  - $V_P = 6.0\text{ km/s}$, $V_S = 3.5\text{ km/s}$ (standard Korean crustal average).
  - $D = \text{Focal depth in km}$ (if known; if uncertain, keep parameter explicit or sample local crustal depth $10\text{ km}$).
- Shaders evaluate wave activation when simulation time $t \ge T(x, y)$.

### B. Observed Intensity / Attenuation Field $I(x, y)$
- When USGS ShakeMap or KMA observational grids exist (e.g., 2016 Gyeongju, 2017 Pohang, 2011 Tohoku):
  - Ingest the actual MMI / PGA raster grid directly into a 2D float texture.
  - Do NOT multiply arbitrary trigonometric noise (e.g., $\sin(5\phi)$) to fake asymmetry. Nature already provides anisotropic ground shaking through geology and fault strike.

---

## 4. Scientific Honesty & Provenance Integrity

### Strict Rules on Uncertain Historical Records
1. **Never Invent Exact Values**:
   - For the 1681 Yangyang earthquake, hypocentral depth is scientifically unknown. Do NOT assign an arbitrary 13.5 km. Mark depth as `null` or `uncertain: true`.
   - The first foreshock (June 12) coordinates are unknown; only the second shock (June 26) has an estimated offshore epicenter. Keep them rigorously distinct.
2. **Primary Citation Preservation**:
   - Every historical event must link directly to primary records in [`historicalArchiveDB.js`](file:///Users/katsina/Downloads/earth/js/data/historicalArchiveDB.js) (`rec_sillok_1681_0626`, `rec_sjw_1681_0514`, KMA Historical Catalog).
3. **Transparent Separation**:
   - Clearly delineate between **Observed/Documented Facts** (shaking duration, felt intensity, rockfalls recorded in annals) and **Artistic Metaphors** (luminance of the fault seam, mist color).
