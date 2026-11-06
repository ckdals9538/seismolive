// ============================================================================
// SEISMOLIVE v4.0 — G1 / Step 3 Coastline Seam Audit (Copernicus vs ETOPO)
// ============================================================================

import { fromFile } from "npm:geotiff";

const WORKSPACE = "/Users/katsina/Downloads/seismolive-clean";
const ETOPO_TIFF = `${WORKSPACE}/assets/terrain/bathymetry/ETOPO_2022_v1_15s_N45E120_surface.tif`;
const N38_TIFF = `${WORKSPACE}/assets/terrain/copernicus/Copernicus_DSM_COG_10_N38_00_E128_00_DEM.tif`;
const N37_TIFF = `${WORKSPACE}/assets/terrain/copernicus/Copernicus_DSM_COG_10_N37_00_E128_00_DEM.tif`;

console.log("=== COASTLINE SEAM AUDIT: COPERNICUS DEM (30m) vs ETOPO 2022 (15s) ===");

// 1. Open GeoTIFFs
const etopoTiff = await fromFile(ETOPO_TIFF);
const etopoImg = await etopoTiff.getImage();
const etopoOrigin = etopoImg.getOrigin();
const etopoRes = etopoImg.getResolution();

const n38Tiff = await fromFile(N38_TIFF);
const n38Img = await n38Tiff.getImage();
const n38Origin = n38Img.getOrigin();
const n38Res = n38Img.getResolution();

const n37Tiff = await fromFile(N37_TIFF);
const n37Img = await n37Tiff.getImage();
const n37Origin = n37Img.getOrigin();
const n37Res = n37Img.getResolution();

// 2. Sample 10 points along the East Sea shoreline (Yangyang to Gangneung)
const coastalPoints = [
  { name: "Sokcho Coast (속초 해안)", lat: 38.20, lon: 128.60 },
  { name: "Daepo Port (대포항)", lat: 38.17, lon: 128.61 },
  { name: "Naksansa Coast (낙산사 해안)", lat: 38.12, lon: 128.63 },
  { name: "Yangyang Namdaecheon Estuary (남대천 하구)", lat: 38.075, lon: 128.63 },
  { name: "Hajodae (하조대 해안)", lat: 38.02, lon: 128.72 },
  { name: "Jumam Port (주문진 북방)", lat: 37.95, lon: 128.82 },
  { name: "Jumunjin Coast (주문진 해안)", lat: 37.89, lon: 128.83 },
  { name: "Sacheon Beach (사천진 해변)", lat: 37.83, lon: 128.87 },
  { name: "Gyeongpo Beach (경포 해변)", lat: 37.80, lon: 128.91 },
  { name: "Gangneung Anmok Beach (안목 해변)", lat: 37.77, lon: 128.95 }
];

async function samplePoint(img, origin, res, lat, lon) {
  const col = Math.round((lon - origin[0]) / res[0]);
  const row = Math.round((origin[1] - lat) / Math.abs(res[1]));
  const w = await img.readRasters({ window: [col, row, col + 1, row + 1] });
  return w[0][0];
}

console.log("\nComparison along Shoreline Points:");
console.log("Point Name                      | Lat, Lon           | Copernicus (30m) | ETOPO 2022 (15s) | Diff (Cop - ETOPO)");
console.log("--------------------------------+--------------------+------------------+------------------+-------------------");

for (const pt of coastalPoints) {
  const etopoVal = await samplePoint(etopoImg, etopoOrigin, etopoRes, pt.lat, pt.lon);
  
  let copVal = null;
  if (pt.lat >= 38.0) {
    copVal = await samplePoint(n38Img, n38Origin, n38Res, pt.lat, pt.lon);
  } else {
    copVal = await samplePoint(n37Img, n37Origin, n37Res, pt.lat, pt.lon);
  }

  const diffStr = (copVal !== null && etopoVal !== null) ? `${(copVal - etopoVal).toFixed(2).padStart(7, " ")} m` : "    N/A";
  const copStr = (copVal !== null) ? `${copVal.toFixed(2).padStart(7, " ")} m` : "    N/A";
  const etopoStr = (etopoVal !== null) ? `${etopoVal.toFixed(2).padStart(7, " ")} m` : "    N/A";

  console.log(`${pt.name.padEnd(31, " ")} | ${pt.lat.toFixed(3)}°N, ${pt.lon.toFixed(3)}°E | ${copStr}        | ${etopoStr}        | ${diffStr}`);
}
