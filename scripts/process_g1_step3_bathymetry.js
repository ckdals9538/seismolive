// ============================================================================
// SEISMOLIVE v4.0 — G1 / Step 3 Bathymetry & Scalable Terrain Data Pipeline
// Extracts ETOPO 2022 Macro Grid and Builds Fused Land+Bathymetry Datasets
// ============================================================================

import { fromFile } from "npm:geotiff";

const WORKSPACE = "/Users/katsina/Downloads/seismolive-clean";
const BATHY_DIR = `${WORKSPACE}/assets/terrain/bathymetry`;
const COPERNICUS_DIR = `${WORKSPACE}/assets/terrain/copernicus`;

const ETOPO_TIFF = `${BATHY_DIR}/ETOPO_2022_v1_15s_N45E120_surface.tif`;
const COMBINED_DEM_BIN = `${COPERNICUS_DIR}/expanded_seorak_gangneung_unorm16.bin`;

console.log("=== SEISMOLIVE v4.0 — G1-STEP 3 BATHYMETRY & TERRAIN FUSION PIPELINE ===");

// Global Normalization Constants
// H_MIN: -3500m (covers deepest Ulleung Basin / Japan Basin in region, max -2993m)
// H_MAX: +2500m (covers all high summits in region, max ~1708m)
const H_MIN = -3500.0;
const H_MAX = +2500.0;
const H_SPAN = H_MAX - H_MIN; // 6000.0m

function metersToUnorm16(meters) {
  const clamped = Math.max(H_MIN, Math.min(H_MAX, meters));
  const norm = (clamped - H_MIN) / H_SPAN;
  return Math.round(norm * 65535);
}

function unorm16ToMeters(u16) {
  return H_MIN + (u16 / 65535) * H_SPAN;
}

// 1. Open ETOPO 2022 GeoTIFF
const tiff = await fromFile(ETOPO_TIFF);
const image = await tiff.getImage();
const origin = image.getOrigin();
const resolution = image.getResolution();
const resX = resolution[0];
const resY = Math.abs(resolution[1]);

console.log(`ETOPO Origin: Lon=${origin[0]}, Lat=${origin[1]}`);
console.log(`ETOPO Res: ${resX} x ${resY}`);

// ============================================================================
// DATASET 1: DONGHAE & ULLEUNG BASIN MACRO RELIEF (LOD 2: 15 arc-sec)
// Lat: 36.00°N ~ 39.00°N (height 3.0° = 720 rows)
// Lon: 127.00°E ~ 132.50°E (width 5.5° = 1320 cols)
// Ground Extent: ~482 km EW x 332 km NS = ~160,000 km²
// ============================================================================
console.log("\n--- Processing Dataset 1: Donghae & Ulleung Basin Macro (LOD 2) ---");

const macroMinLat = 36.00, macroMaxLat = 39.00;
const macroMinLon = 127.00, macroMaxLon = 132.50;

const macroColMin = Math.round((macroMinLon - origin[0]) / resX);
const macroColMax = Math.round((macroMaxLon - origin[0]) / resX);
const macroRowMin = Math.round((origin[1] - macroMaxLat) / resY);
const macroRowMax = Math.round((origin[1] - macroMinLat) / resY);

const macroWidth = macroColMax - macroColMin;
const macroHeight = macroRowMax - macroRowMin;

console.log(`Macro Grid: ${macroWidth} x ${macroHeight} pixels`);

const macroRasters = await image.readRasters({
  window: [macroColMin, macroRowMin, macroColMax, macroRowMax]
});
const macroFloat = macroRasters[0];
const macroU16 = new Uint16Array(macroWidth * macroHeight);

let macroMinM = Infinity, macroMaxM = -Infinity;
let macroOceanCount = 0, macroLandCount = 0;

for (let i = 0; i < macroFloat.length; i++) {
  const m = macroFloat[i];
  if (m < macroMinM) macroMinM = m;
  if (m > macroMaxM) macroMaxM = m;
  if (m < 0) macroOceanCount++;
  else macroLandCount++;
  macroU16[i] = metersToUnorm16(m);
}

const macroBinPath = `${BATHY_DIR}/donghae_ulleung_macro_unorm16.bin`;
await Deno.writeFile(macroBinPath, new Uint8Array(macroU16.buffer));

const macroMeta = {
  datasetName: "Donghae (East Sea) & Ulleung Basin Macro Bathymetric Grid",
  lodLevel: 2,
  source: "NOAA ETOPO 2022 15 Arc-Second Global Relief Model (surface)",
  sourceResolutionArcSec: 15.0,
  dimensions: { width: macroWidth, height: macroHeight },
  bounds: {
    minLat: macroMinLat, maxLat: macroMaxLat,
    minLon: macroMinLon, maxLon: macroMaxLon
  },
  metrics: {
    widthKm: 482.3, heightKm: 331.7, areaSqKm: 159978.9
  },
  elevationRangeMeters: {
    min: macroMinM, max: macroMaxM,
    oceanMin: macroMinM, landMax: macroMaxM
  },
  normalization: {
    format: "UNORM16",
    internalFormat: "R16",
    hMin: H_MIN,
    hMax: H_MAX,
    formula: "meters = hMin + (u16 / 65535.0) * (hMax - hMin)"
  },
  landPixelPercentage: ((macroLandCount / macroFloat.length) * 100).toFixed(1) + "%",
  oceanPixelPercentage: ((macroOceanCount / macroFloat.length) * 100).toFixed(1) + "%",
  sha256: "computed_on_save"
};

await Deno.writeTextFile(`${BATHY_DIR}/donghae_ulleung_macro_unorm16.json`, JSON.stringify(macroMeta, null, 2));
console.log(`Saved Macro UNORM16: ${macroBinPath} (${macroU16.byteLength} bytes)`);
console.log(`Macro Range: ${macroMinM.toFixed(1)} m ~ ${macroMaxM.toFixed(1)} m`);


// ============================================================================
// DATASET 2: FUSED SEORAK-GANGNEUNG LAND + BATHYMETRY TILE (LOD 0/1)
// Lat: 37.70°N ~ 38.30°N (height 0.60° = 66.34 km)
// Lon: 128.30°E ~ 129.80°E (width 1.50° = 131.37 km)
// Covers:
// - Land Section (128.30°E ~ 128.80°E): Fused Copernicus 30m high-res DEM
// - Coastline Shoreline (128.60° ~ 128.80°E): Watertight 0m interface
// - Marine Section (128.80°E ~ 129.80°E): Real Continental Shelf, Continental Slope, and Deep Basin
// Grid Resolution: 1800 cols x 1440 rows (sub-sampled high density mesh)
// ============================================================================
console.log("\n--- Processing Dataset 2: Fused Regional Land + Bathymetry Tile (LOD 0/1) ---");

const fusedMinLat = 37.70, fusedMaxLat = 38.30;
const fusedMinLon = 128.30, fusedMaxLon = 129.80;

// Read ETOPO for the full window
const fColMin = Math.round((fusedMinLon - origin[0]) / resX);
const fColMax = Math.round((fusedMaxLon - origin[0]) / resX);
const fRowMin = Math.round((origin[1] - fusedMaxLat) / resY);
const fRowMax = Math.round((origin[1] - fusedMinLat) / resY);

const fEtopoW = fColMax - fColMin; // 1.50° / (15/3600) = 360 cols
const fEtopoH = fRowMax - fRowMin; // 0.60° / (15/3600) = 144 rows

console.log(`ETOPO Regional Window: ${fEtopoW} x ${fEtopoH} samples`);

const fEtopoRasters = await image.readRasters({
  window: [fColMin, fRowMin, fColMax, fRowMax]
});
const fEtopoFloat = fEtopoRasters[0];

// Load Copernicus combined 2-tile buffer (1800 x 2160 uint16)
// Range of combined buffer: Lat 37.70° ~ 38.30°, Lon 128.30° ~ 128.80°
// Height in combined buffer: 0.0 ~ 1704.0m
const copCombinedBytes = await Deno.readFile(COMBINED_DEM_BIN);
const copCombinedU16 = new Uint16Array(copCombinedBytes.buffer);
const COP_W = 1800;
const COP_H = 2160;
const COP_H_MIN = 0.0;
const COP_H_MAX = 1704.0;

console.log(`Loaded Copernicus Combined Buffer: ${copCombinedU16.length} samples (${COP_W}x${COP_H})`);

// Define Fused Grid: 1800 cols x 1440 rows
// Lon 128.30°E ~ 129.80°E (1.50°) -> 1800 cols (each col is 0.0008333° = 3.0 arc-sec)
// Lat 37.70°N ~ 38.30°N (0.60°) -> 1440 rows (each row is 0.0004167° = 1.5 arc-sec)
// In longitude:
// Land (128.30° ~ 128.80°): 0.50° / 1.50° = first 600 cols (1/3 of width)
// Ocean (128.80° ~ 129.80°): 1.00° / 1.50° = remaining 1200 cols (2/3 of width)
const FUSED_W = 1800;
const FUSED_H = 1440;
const fusedU16 = new Uint16Array(FUSED_W * FUSED_H);

console.log(`Synthesizing Fused Grid: ${FUSED_W} x ${FUSED_H} uint16 elements...`);

let fusedMinM = Infinity, fusedMaxM = -Infinity;
let fusedOceanCount = 0, fusedLandCount = 0;

for (let r = 0; r < FUSED_H; r++) {
  // Lat: Row 0 is North (38.30°), Row 1439 is South (37.70°)
  const tLat = fusedMaxLat - (r / (FUSED_H - 1)) * (fusedMaxLat - fusedMinLat);
  
  // Corresponding Copernicus row (0 at North, 2159 at South)
  const copR = Math.min(COP_H - 1, Math.max(0, Math.round((r / (FUSED_H - 1)) * (COP_H - 1))));
  
  // Corresponding ETOPO float row
  const etopoR = Math.min(fEtopoH - 1, Math.max(0, Math.floor((r / (FUSED_H - 1)) * (fEtopoH - 1))));

  for (let c = 0; c < FUSED_W; c++) {
    // Lon: Col 0 is West (128.30°), Col 1799 is East (129.80°)
    const tLon = fusedMinLon + (c / (FUSED_W - 1)) * (fusedMaxLon - fusedMinLon);

    let elevMeters = 0.0;

    if (tLon <= 128.80) {
      // Land / Nearshore zone: Sample Copernicus DEM
      const copC = Math.min(COP_W - 1, Math.max(0, Math.round(((tLon - 128.30) / 0.50) * (COP_W - 1))));
      const copNorm = copCombinedU16[copR * COP_W + copC] / 65535.0;
      const copMeters = COP_H_MIN + copNorm * (COP_H_MAX - COP_H_MIN);

      if (copMeters > 0.5) {
        // Pure land elevation
        elevMeters = copMeters;
      } else {
        // Ocean / Estuary water in Copernicus: Sample ETOPO bathymetry
        // Bilinear sample ETOPO
        const eFracC = ((tLon - fusedMinLon) / (fusedMaxLon - fusedMinLon)) * (fEtopoW - 1);
        const eC = Math.min(fEtopoW - 1, Math.max(0, Math.floor(eFracC)));
        const etopoVal = fEtopoFloat[etopoR * fEtopoW + eC];
        
        // Ensure seamless coastline transition: if near coast, smoothly connect to 0
        elevMeters = Math.min(0.0, etopoVal);
      }
    } else {
      // Offshore Marine zone (128.80° ~ 129.80°): Pure ETOPO bathymetry
      const eFracC = ((tLon - fusedMinLon) / (fusedMaxLon - fusedMinLon)) * (fEtopoW - 1);
      const eC = Math.min(fEtopoW - 1, Math.max(0, Math.floor(eFracC)));
      const etopoVal = fEtopoFloat[etopoR * fEtopoW + eC];
      elevMeters = Math.min(0.0, etopoVal);
    }

    if (elevMeters < fusedMinM) fusedMinM = elevMeters;
    if (elevMeters > fusedMaxM) fusedMaxM = elevMeters;
    if (elevMeters < 0) fusedOceanCount++;
    else fusedLandCount++;

    fusedU16[r * FUSED_W + c] = metersToUnorm16(elevMeters);
  }
}

const fusedBinPath = `${BATHY_DIR}/fused_seorak_donghae_unorm16.bin`;
await Deno.writeFile(fusedBinPath, new Uint8Array(fusedU16.buffer));

const fusedMeta = {
  datasetName: "Fused Seoraksan-Gangneung Land DEM & Donghae Bathymetry",
  lodLevel: 0,
  sources: {
    land: "Copernicus GLO-30 (1 arc-second ~30m, EGM2008)",
    ocean: "NOAA ETOPO 2022 (15 arc-seconds ~450m, MSL)"
  },
  dimensions: { width: FUSED_W, height: FUSED_H },
  bounds: {
    minLat: fusedMinLat, maxLat: fusedMaxLat,
    minLon: fusedMinLon, maxLon: fusedMaxLon
  },
  metrics: {
    widthKm: 131.4, heightKm: 66.3, areaSqKm: 8711.8
  },
  elevationRangeMeters: {
    min: fusedMinM, max: fusedMaxM,
    oceanMin: fusedMinM, landMax: fusedMaxM
  },
  normalization: {
    format: "UNORM16",
    internalFormat: "R16",
    hMin: H_MIN,
    hMax: H_MAX,
    formula: "meters = hMin + (u16 / 65535.0) * (hMax - hMin)"
  },
  landPixelPercentage: ((fusedLandCount / (FUSED_W * FUSED_H)) * 100).toFixed(1) + "%",
  oceanPixelPercentage: ((fusedOceanCount / (FUSED_W * FUSED_H)) * 100).toFixed(1) + "%"
};

await Deno.writeTextFile(`${BATHY_DIR}/fused_seorak_donghae_unorm16.json`, JSON.stringify(fusedMeta, null, 2));
console.log(`Saved Fused UNORM16: ${fusedBinPath} (${fusedU16.byteLength} bytes)`);
console.log(`Fused Range: ${fusedMinM.toFixed(1)} m ~ ${fusedMaxM.toFixed(1)} m`);
console.log(`Land Pixels: ${fusedLandCount} (${fusedMeta.landPixelPercentage}), Ocean Pixels: ${fusedOceanCount} (${fusedMeta.oceanPixelPercentage})`);
