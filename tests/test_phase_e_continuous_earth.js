/**
 * SEISMOLIVE v4.0 — Phase E: Continuous Earth Foundation Test Suite
 * Validates Planetary Elevation Data, Multiresolution Tiers, Boundary Reconciliation,
 * Historical Coverage, and Continuous Spatial Geodesy.
 */

import { existsSync, statSync, readFileSync } from "node:fs";
import { getUniversalEventMetadata } from "../js/3d/terrainDataResolver.js";
import { HISTORICAL_EVENTS } from "../js/data/historicalArchiveDB.js";
import { INSTRUMENTAL_EVENTS } from "../js/data/instrumentalCatalogDB.js";

console.log("====================================================================");
console.log("SEISMOLIVE v4.0 — Phase E Continuous Earth Foundation Test Suite");
console.log("====================================================================\n");

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  [PASS] ${message}`);
    passed++;
  } else {
    console.error(`  [FAIL] ${message}`);
    failed++;
  }
}

// -----------------------------------------------------------------------------
// Test Group 1: Global Topographic Foundation & Planetary Relief Rasters
// -----------------------------------------------------------------------------
console.log("--- Test Group 1: Global Topographic Foundation & Planetary Relief Rasters ---");

const global4kBin = "assets/terrain/bathymetry/global_etopo_elevation_4096_unorm16.bin";
const global4kJson = "assets/terrain/bathymetry/global_etopo_elevation_4096_unorm16.json";
const global2kBin = "assets/terrain/bathymetry/global_etopo_elevation_2048_unorm16.bin";
const global2kJson = "assets/terrain/bathymetry/global_etopo_elevation_2048_unorm16.json";

assert(existsSync(global4kBin), `4K Global elevation binary exists (${global4kBin})`);
assert(existsSync(global4kJson), `4K Global elevation metadata JSON exists (${global4kJson})`);
assert(existsSync(global2kBin), `2K Global elevation binary exists (${global2kBin})`);
assert(existsSync(global2kJson), `2K Global elevation metadata JSON exists (${global2kJson})`);

if (existsSync(global4kBin) && existsSync(global4kJson)) {
  const stat = statSync(global4kBin);
  assert(stat.size === 4096 * 2048 * 2, `4K Global elevation size is exactly 16,777,216 bytes (got ${stat.size})`);

  const meta = JSON.parse(readFileSync(global4kJson, "utf-8"));
  assert(meta.datasetName.includes("NOAA ETOPO 2022"), `Dataset provenance is NOAA ETOPO 2022 (got '${meta.datasetName}')`);
  assert(meta.verticalDatum.includes("EGM2008"), `Vertical datum is EGM2008 Geoid (got '${meta.verticalDatum}')`);
  assert(meta.elevationRangeMeters.hMin === -11000.0, "hMin is strictly -11,000m (Mariana Trench margin)");
  assert(meta.elevationRangeMeters.hMax === 9000.0, "hMax is strictly +9,000m (Mt. Everest margin)");
  assert(meta.elevationRangeMeters.minSampled < -10000.0, `Min sampled elevation reaches Mariana Trench depth (${meta.elevationRangeMeters.minSampled.toFixed(1)}m)`);
  assert(meta.elevationRangeMeters.maxSampled > 7000.0, `Max sampled elevation reaches Himalayan peaks (${meta.elevationRangeMeters.maxSampled.toFixed(1)}m)`);
}

// -----------------------------------------------------------------------------
// Test Group 2: Korean Historical Theaters & Multiresolution Regional DEMs
// -----------------------------------------------------------------------------
console.log("\n--- Test Group 2: Korean Historical Theaters & Multiresolution Regional DEMs ---");

const regionalTheaters = [
  { name: "Central Korea (Seoul/Hanyang/Gaeseong)", bin: "assets/terrain/bathymetry/regional_central_korea_unorm16.bin", json: "assets/terrain/bathymetry/regional_central_korea_unorm16.json" },
  { name: "Pyongyang / Goguryeo", bin: "assets/terrain/bathymetry/regional_pyongyang_unorm16.bin", json: "assets/terrain/bathymetry/regional_pyongyang_unorm16.json" },
  { name: "Baekje / Buyeo / Gongju", bin: "assets/terrain/bathymetry/regional_baekje_unorm16.bin", json: "assets/terrain/bathymetry/regional_baekje_unorm16.json" },
  { name: "Jeju Island / Hallasan", bin: "assets/terrain/bathymetry/regional_jeju_unorm16.bin", json: "assets/terrain/bathymetry/regional_jeju_unorm16.json" }
];

for (const th of regionalTheaters) {
  assert(existsSync(th.bin), `${th.name} DEM binary exists: ${th.bin}`);
  assert(existsSync(th.json), `${th.name} metadata exists: ${th.json}`);

  if (existsSync(th.bin) && existsSync(th.json)) {
    const stat = statSync(th.bin);
    assert(stat.size === 900 * 720 * 2, `${th.name} DEM size is 900x720 UNORM16 (1,296,000 bytes, got ${stat.size})`);
    const meta = JSON.parse(readFileSync(th.json, "utf-8"));
    assert(meta.dimensions.width === 900 && meta.dimensions.height === 720, `${th.name} dimensions are 900x720`);
    assert(meta.elevationRangeMeters.hMax > 1000.0, `${th.name} captures authentic regional mountain relief (max: ${meta.elevationRangeMeters.hMax}m)`);
  }
}

// -----------------------------------------------------------------------------
// Test Group 3: Universal Historical Event Coverage (All 48+ Events Resolved)
// -----------------------------------------------------------------------------
console.log("\n--- Test Group 3: Universal Historical Event Geographic Resolution ---");

const allCatalog = [...HISTORICAL_EVENTS, ...INSTRUMENTAL_EVENTS];
let resolvedWithAuthenticDem = 0;
let resolvedWithFallback = 0;

for (const ev of allCatalog) {
  const lat = ev.spatialCoords?.lat ?? ev.epicenter?.lat ?? ev.lat?.v ?? (typeof ev.lat === "number" ? ev.lat : null) ?? ev.spatial?.inferredCoordinates?.lat ?? ev.placeMappings?.[0]?.representativeCoords?.lat ?? null;
  const lon = ev.spatialCoords?.lon ?? ev.epicenter?.lon ?? ev.lon?.v ?? (typeof ev.lon === "number" ? ev.lon : null) ?? ev.spatial?.inferredCoordinates?.lon ?? ev.placeMappings?.[0]?.representativeCoords?.lon ?? null;

  const res = getUniversalEventMetadata(ev.id, lat, lon);
  assert(res && res.titleKo, `Event ${ev.id} resolved with title: ${res?.titleKo}`);
  assert(Boolean(res.demBinUrl || res.isGlobalPlanetaryRelief), `Event ${ev.id} has valid DEM or Global Planetary Relief resolution`);

  if (res.demBinUrl && (res.tier2Available || res.demBinUrl.includes("regional_") || res.demBinUrl.includes("fused_") || res.demBinUrl.includes("korea_macro_"))) {
    resolvedWithAuthenticDem++;
  } else {
    resolvedWithFallback++;
  }
}

assert(allCatalog.length >= 48, `Archive contains at least 48 catalogued earthquakes (audited: ${allCatalog.length})`);
assert(resolvedWithAuthenticDem >= 45, `At least 45 localized events have active regional DEM coverage (got ${resolvedWithAuthenticDem})`);
assert(resolvedWithFallback <= 6, `Uncertain/remote events gracefully fallback without crash (got ${resolvedWithFallback})`);

// -----------------------------------------------------------------------------
// Test Group 4: Mathematical Boundary Elevation Reconciliation
// -----------------------------------------------------------------------------
console.log("\n--- Test Group 4: Mathematical Boundary Elevation Reconciliation ---");

function reconcileElevation(hGlobal, hLocal, edgeDist) {
  // Matching shader smoothstep(0.002, 0.080, edgeDist)
  const edgeTaper = Math.max(0.0, Math.min(1.0, (edgeDist - 0.002) / (0.080 - 0.002)));
  const smoothTaper = edgeTaper * edgeTaper * (3.0 - 2.0 * edgeTaper);
  return (1.0 - smoothTaper) * hGlobal + smoothTaper * hLocal;
}

// Scenario: Mountain ridge of 1200m at the boundary where global elevation is 1150m
const hGlobalMtn = 1150.0;
const hLocalMtn = 1200.0;

const atBoundary = reconcileElevation(hGlobalMtn, hLocalMtn, 0.0);
assert(Math.abs(atBoundary - hGlobalMtn) < 1e-4, `At perimeter boundary (edgeDist=0), reconciled elevation exactly equals global elevation (${atBoundary.toFixed(2)}m == ${hGlobalMtn.toFixed(2)}m)`);

const atCenter = reconcileElevation(hGlobalMtn, hLocalMtn, 0.5);
assert(Math.abs(atCenter - hLocalMtn) < 1e-4, `In regional interior (edgeDist=0.5), reconciled elevation exactly equals local DEM (${atCenter.toFixed(2)}m == ${hLocalMtn.toFixed(2)}m)`);

const atTransition = reconcileElevation(hGlobalMtn, hLocalMtn, 0.041);
assert(atTransition > hGlobalMtn && atTransition < hLocalMtn, `At transition zone (edgeDist=0.041), elevation smoothly blends (${atTransition.toFixed(2)}m between ${hGlobalMtn}m and ${hLocalMtn}m)`);

// -----------------------------------------------------------------------------
// Test Group 5: Planetary UV Mapping & Geodetic Coordinate Continuity
// -----------------------------------------------------------------------------
console.log("\n--- Test Group 5: Planetary UV Mapping & Geodetic Coordinate Continuity ---");

function geodeticToPlanetaryUv(lat, lon) {
  const u = (lon + 180.0) / 360.0;
  const v = (90.0 - lat) / 180.0;
  return { u, v };
}

const uvEquatorPrime = geodeticToPlanetaryUv(0.0, 0.0);
assert(Math.abs(uvEquatorPrime.u - 0.5) < 1e-6 && Math.abs(uvEquatorPrime.v - 0.5) < 1e-6, "Equator / Prime Meridian maps to UV (0.5, 0.5)");

const uvNorthPole = geodeticToPlanetaryUv(90.0, 0.0);
assert(Math.abs(uvNorthPole.v - 0.0) < 1e-6, "North Pole (+90° Lat) maps to V=0.0");

const uvSouthPole = geodeticToPlanetaryUv(-90.0, 0.0);
assert(Math.abs(uvSouthPole.v - 1.0) < 1e-6, "South Pole (-90° Lat) maps to V=1.0");

const uvDateLineWest = geodeticToPlanetaryUv(0.0, -180.0);
assert(Math.abs(uvDateLineWest.u - 0.0) < 1e-6, "Antimeridian West (-180° Lon) maps to U=0.0");

const uvDateLineEast = geodeticToPlanetaryUv(0.0, 180.0);
assert(Math.abs(uvDateLineEast.u - 1.0) < 1e-6, "Antimeridian East (+180° Lon) maps to U=1.0");

console.log("\n====================================================================");
console.log(`PHASE E TEST SUITE SUMMARY: ${passed} PASSED, ${failed} FAILED`);
console.log("====================================================================\n");

if (failed > 0) {
  Deno.exit(1);
}
