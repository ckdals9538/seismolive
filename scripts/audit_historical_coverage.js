import { HISTORICAL_EVENTS, SOURCE_RECORDS, EVENT_SOURCE_LINKS } from '../js/data/historicalArchiveDB.js';
import { INSTRUMENTAL_EVENTS } from '../js/data/instrumentalCatalogDB.js';

console.log("====================================================================");
console.log("SEISMOLIVE v4.0 — Phase E: 48-Event Historical Geographic Coverage Audit");
console.log("====================================================================");

const allEvents = [...HISTORICAL_EVENTS, ...INSTRUMENTAL_EVENTS];

const auditResults = [];

let tier3Count = 0;
let tier2Count = 0;
let tier1Count = 0;
let uncertainCount = 0;

for (const ev of allEvents) {
  const id = ev.id || ev.eventId;
  const title = (ev.titleKo || ev.place || ev.canonicalName || '지진').replace(/[\u4e00-\u9fff]/g, '').trim();
  const lat = ev.lat?.v ?? ev.spatial?.inferredCoordinates?.lat ?? null;
  const lon = ev.lon?.v ?? ev.spatial?.inferredCoordinates?.lon ?? null;

  let coordinateStatus = "DEFINITE_COORDINATES";
  let tierLevel = "TIER_1_GLOBAL_RELIEF";
  let assignedRegion = "GLOBAL_TERRAIN";

  if (lat == null || lon == null) {
    coordinateStatus = "COORDINATES_UNCERTAIN";
    tierLevel = "TIER_0_ORBIT_THEATER";
    assignedRegion = "UNCERTAIN_ANCIENT_RECORD";
    uncertainCount++;
  } else {
    // Check Tier 3 availability (Copernicus 30m DEM)
    if (lat >= 37.80 && lat <= 38.25 && lon >= 128.45 && lon <= 129.25 && id.includes('1681')) {
      tierLevel = "TIER_3_LOCAL_HIGHRES_DEM";
      assignedRegion = "GANGWON_SEORAK_OFFSHORE";
      tier3Count++;
      tier2Count++;
      tier1Count++;
    }
    // Check Tier 2 availability (Korean Peninsula Macro 15-arcsec: Lat 33-42, Lon 124-132)
    else if (lat >= 33.0 && lat <= 42.0 && lon >= 124.0 && lon <= 132.0) {
      tierLevel = "TIER_2_REGIONAL_MACRO_GRID";
      if (lat >= 35.0 && lat <= 36.3 && lon >= 128.5) {
        assignedRegion = "GYEONGSANG_FAULT_BASIN";
      } else if (lat >= 37.0 && lat <= 38.5 && lon >= 126.3 && lon <= 127.5) {
        assignedRegion = "CENTRAL_HANYANG_GAEGYEONG";
      } else if (lat >= 38.5 && lon <= 126.5) {
        assignedRegion = "NORTHERN_PYONGYANG_BASIN";
      } else {
        assignedRegion = "KOREAN_PENINSULA_MACRO";
      }
      tier2Count++;
      tier1Count++;
    }
    // Check Japan Kyushu
    else if (lat >= 31.0 && lat <= 34.0 && lon >= 129.5 && lon <= 132.0) {
      tierLevel = "TIER_2_REGIONAL_MACRO_GRID";
      assignedRegion = "JAPAN_KYUSHU_VOLCANIC_RIFT";
      tier2Count++;
      tier1Count++;
    }
    // Check Turkey Anatolia
    else if (lat >= 36.0 && lat <= 39.0 && lon >= 35.0 && lon <= 39.0) {
      tierLevel = "TIER_2_REGIONAL_MACRO_GRID";
      assignedRegion = "TURKEY_EAST_ANATOLIA_FAULT";
      tier2Count++;
      tier1Count++;
    }
    else {
      tierLevel = "TIER_1_GLOBAL_RELIEF";
      assignedRegion = "GLOBAL_CONTINENTAL_TERRAIN";
      tier1Count++;
    }
  }

  auditResults.push({
    id,
    title,
    lat,
    lon,
    coordinateStatus,
    tierLevel,
    assignedRegion,
    primarySource: ev.primaryText?.citation || ev.sourceCitation || "관측/문헌 카탈로그"
  });
}

console.log(`\nTotal Audited Events: ${allEvents.length}`);
console.log(`- Tier 3 (Local 30m DEM) Capable: ${tier3Count}`);
console.log(`- Tier 2 (Regional Macro 15s) Capable: ${tier2Count}`);
console.log(`- Tier 1 (Global Elevation/Bathymetry) Capable: ${tier1Count}`);
console.log(`- Uncertain / Unverified Coordinates: ${uncertainCount}`);

console.log("\nSample Breakdown across Geographic Theaters:");
const regions = {};
for (const res of auditResults) {
  regions[res.assignedRegion] = (regions[res.assignedRegion] || 0) + 1;
}
for (const [r, cnt] of Object.entries(regions)) {
  console.log(`  * ${r.padEnd(30)}: ${cnt} events`);
}

import { writeFileSync } from "node:fs";
writeFileSync(
  "assets/terrain/historical_event_coverage_assessment.json",
  JSON.stringify({
    generatedAt: new Date().toISOString(),
    totalEvents: allEvents.length,
    tierCounts: {
      tier3_localHighRes: tier3Count,
      tier2_regionalMacro: tier2Count,
      tier1_globalRelief: tier1Count,
      uncertainCoordinates: uncertainCount
    },
    regionDistribution: regions,
    events: auditResults
  }, null, 2)
);
console.log("\n[Saved] assets/terrain/historical_event_coverage_assessment.json");
