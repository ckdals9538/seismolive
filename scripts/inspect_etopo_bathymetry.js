// ============================================================================
// SEISMOLIVE v4.0 — G1 / Step 3 ETOPO 2022 Bathymetry Inspection & Profile
// ============================================================================

import { fromFile } from "npm:geotiff";
import { crypto } from "https://deno.land/std@0.224.0/crypto/mod.ts";
import { encodeHex } from "https://deno.land/std@0.224.0/encoding/hex.ts";

const WORKSPACE = "/Users/katsina/Downloads/seismolive-clean";
const BATHY_DIR = `${WORKSPACE}/assets/terrain/bathymetry`;
const ETOPO_TIFF = `${BATHY_DIR}/ETOPO_2022_v1_15s_N45E120_surface.tif`;
const SID_TIFF = `${BATHY_DIR}/ETOPO_2022_v1_15s_N45E120_surface_sid.tif`;

console.log("=== SEISMOLIVE v4.0 — G1-STEP 3 ETOPO 2022 BATHYMETRY INSPECTION ===");

// 1. Check File Stats & Hash
const stat = await Deno.stat(ETOPO_TIFF);
console.log(`ETOPO Surface File Size: ${stat.size} bytes (${(stat.size / (1024 * 1024)).toFixed(2)} MB)`);

const bytes = await Deno.readFile(ETOPO_TIFF);
const hashBuf = await crypto.subtle.digest("SHA-256", bytes);
const sha256 = encodeHex(new Uint8Array(hashBuf));
console.log(`SHA-256: ${sha256}`);

// 2. Open GeoTIFF and Metadata
const tiff = await fromFile(ETOPO_TIFF);
const image = await tiff.getImage();

const width = image.getWidth();
const height = image.getHeight();
const origin = image.getOrigin();
const resolution = image.getResolution();
const bbox = image.getBoundingBox();
const noDataValue = image.getGDALNoData();
const sampleFormat = image.getSampleFormat();
const bitsPerSample = image.getBitsPerSample();

console.log(`\n--- ETOPO GeoTIFF Metadata ---`);
console.log(`Dimensions: ${width} x ${height}`);
console.log(`Origin: Lon=${origin[0]}, Lat=${origin[1]}`);
console.log(`Resolution: ResX=${resolution[0]} deg (${(resolution[0] * 3600).toFixed(1)}"), ResY=${resolution[1]} deg (${(Math.abs(resolution[1]) * 3600).toFixed(1)}")`);
console.log(`Bounding Box: [${bbox.join(", ")}]`);
console.log(`Sample Format: ${sampleFormat}, Bits: ${bitsPerSample}`);
console.log(`GDAL NoData: ${noDataValue}`);

// 3. Inspect Sub-region: East Sea & Ulleung Basin
// Lat: 37.0°N ~ 38.5°N, Lon: 128.0°E ~ 131.5°E
const minLat = 37.0, maxLat = 38.5;
const minLon = 128.0, maxLon = 131.5;

const resX = resolution[0];
const resY = Math.abs(resolution[1]);

const colMin = Math.round((minLon - origin[0]) / resX);
const colMax = Math.round((maxLon - origin[0]) / resX);
const rowMin = Math.round((origin[1] - maxLat) / resY);
const rowMax = Math.round((origin[1] - minLat) / resY);

console.log(`\n--- East Sea & Ulleung Basin Crop Window ---`);
console.log(`Cols: ${colMin} ~ ${colMax} (width: ${colMax - colMin})`);
console.log(`Rows: ${rowMin} ~ ${rowMax} (height: ${rowMax - rowMin})`);

const windowData = await image.readRasters({
  window: [colMin, rowMin, colMax, rowMax]
});

const raster = windowData[0];
console.log(`Read ${raster.length} raster samples.`);

let minVal = Infinity, maxVal = -Infinity;
let minOcean = 0, maxOcean = -Infinity;
let minLand = Infinity, maxLand = -Infinity;
let oceanCount = 0, landCount = 0;

for (let i = 0; i < raster.length; i++) {
  const val = raster[i];
  if (val < minVal) minVal = val;
  if (val > maxVal) maxVal = val;
  if (val < 0) {
    oceanCount++;
    if (val < minOcean) minOcean = val;
    if (val > maxOcean) maxOcean = val;
  } else {
    landCount++;
    if (val < minLand) minLand = val;
    if (val > maxLand) maxLand = val;
  }
}

console.log(`\n--- Regional Elevation & Bathymetry Statistics ---`);
console.log(`Total Samples: ${raster.length}`);
console.log(`Land Samples: ${landCount} (${((landCount / raster.length) * 100).toFixed(1)}%)`);
console.log(`Ocean Samples: ${oceanCount} (${((oceanCount / raster.length) * 100).toFixed(1)}%)`);
console.log(`Overall Range: ${minVal.toFixed(2)} m ~ ${maxVal.toFixed(2)} m`);
console.log(`Land Elevation Range: ${minLand.toFixed(2)} m ~ ${maxLand.toFixed(2)} m`);
console.log(`Ocean Bathymetry Range: ${minOcean.toFixed(2)} m (Deepest Basin) ~ ${maxOcean.toFixed(2)} m (Shallow Coast)`);

// 4. East-West Transect Profile across Latitude 37.75°N (Gangneung -> Ulleung Basin)
console.log(`\n--- E-W Profile Transect across Lat 37.75°N (Gangneung eastward into Ulleung Basin) ---`);
const targetLat = 37.75;
const targetRow = Math.round((origin[1] - targetLat) / resY);
const cropRow = targetRow - rowMin;
const subW = colMax - colMin;

const testLons = [128.80, 128.90, 129.00, 129.20, 129.40, 129.70, 130.00, 130.50, 130.86, 131.20];

for (const tLon of testLons) {
  const tCol = Math.round((tLon - origin[0]) / resX) - colMin;
  const idx = cropRow * subW + tCol;
  const h = raster[idx];
  let feature = "Ocean";
  if (tLon === 128.80) feature = "Coastline / Shelf edge";
  else if (tLon < 129.10) feature = "Continental Shelf";
  else if (tLon < 129.80) feature = "Continental Slope (대륙사면 급강하)";
  else if (tLon >= 130.80 && tLon <= 130.90) feature = "Ulleungdo Seamount flank";
  else feature = "Ulleung Basin Abyssal Floor (울릉분지 평원)";

  console.log(`Lon ${tLon.toFixed(2)}°E | Lat ${targetLat.toFixed(2)}°N : ${h.toFixed(1).padStart(7, " ")} m | ${feature}`);
}

// 5. Inspect SID (Source Identifier)
console.log(`\n--- Inspecting Source ID (SID) ---`);
const sidTiff = await fromFile(SID_TIFF);
const sidImg = await sidTiff.getImage();
const sidWindow = await sidImg.readRasters({
  window: [colMin, rowMin, colMax, rowMax]
});
const sidRaster = sidWindow[0];
const sidCounts = {};
for (let i = 0; i < sidRaster.length; i++) {
  const sid = sidRaster[i];
  sidCounts[sid] = (sidCounts[sid] || 0) + 1;
}
console.log("SID Distribution in East Sea / Gangwon Region:", sidCounts);
