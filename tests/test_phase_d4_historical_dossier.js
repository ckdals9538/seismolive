// ============================================================================
// SEISMOLIVE v4.0 — Phase D4: Enriched Historical Dossier & Archival Data
// File: tests/test_phase_d4_historical_dossier.js
// Run via: deno run -A tests/test_phase_d4_historical_dossier.js
// ============================================================================

import { HISTORICAL_EVENTS, SOURCE_RECORDS, EVENT_SOURCE_LINKS, SOURCE_CORPORA } from '../js/data/historicalArchiveDB.js';

let passed = 0;
let failed = 0;

function assert(condition, message, detail = '') {
  if (condition) {
    passed++;
    console.log(`  [PASS] ${message}`);
  } else {
    failed++;
    console.error(`  [FAIL] ${message} -> ${detail}`);
  }
}

console.log('====================================================================');
console.log('SEISMOLIVE v4.0 — Phase D4 Enriched Historical Dossier Unit Test');
console.log('====================================================================\n');

// 1. Check all 34 historical events have complete 6 enriched fields
console.log('--- 1. Schema Completeness for All 34 Historical Events ---');
assert(HISTORICAL_EVENTS.length === 34, `Total historical events is 34 (got ${HISTORICAL_EVENTS.length})`);

for (const ev of HISTORICAL_EVENTS) {
  assert(Array.isArray(ev.linkedRecords) && ev.linkedRecords.length > 0,
    `[${ev.id}] Has non-empty linkedRecords (count: ${ev.linkedRecords?.length})`);
  assert(Array.isArray(ev.feltCounties) && ev.feltCounties.length >= 1,
    `[${ev.id}] Has feltCounties human sensor network (count: ${ev.feltCounties?.length})`);
  assert(ev.methodologicalCorrections && typeof ev.methodologicalCorrections === 'object',
    `[${ev.id}] Has methodologicalCorrections object`);
  assert(Boolean(ev.methodologicalCorrections.structuralVulnerability?.badgeKo),
    `[${ev.id}] Has structuralVulnerability bias correction badge`);
  assert(Boolean(ev.methodologicalCorrections.tianRenFilter?.badgeKo),
    `[${ev.id}] Has tianRenFilter bias correction badge`);
  assert(Boolean(ev.methodologicalCorrections.batchSeparation?.badgeKo),
    `[${ev.id}] Has batchSeparation bias correction badge`);
  assert(Boolean(ev.methodologicalCorrections.seatBiasOffset?.badgeKo),
    `[${ev.id}] Has seatBiasOffset bias correction badge`);
  assert(Boolean(ev.geophysicalPhenomena?.titleKo) && Boolean(ev.geophysicalPhenomena?.equation),
    `[${ev.id}] Has geophysicalPhenomena title & equation (${ev.geophysicalPhenomena?.titleKo})`);
  assert(Boolean(ev.astronomicalChronology?.reignTitle) && Boolean(ev.astronomicalChronology?.solarCalendar),
    `[${ev.id}] Has astronomicalChronology (${ev.astronomicalChronology?.reignTitle})`);
  assert(Array.isArray(ev.historicalGazetteer) && ev.historicalGazetteer.length > 0,
    `[${ev.id}] Has historicalGazetteer toponym mapping`);
}

// 2. Deep Benchmark Verification: 1681 Yangyang Mainshock & Tsunami
console.log('\n--- 2. Deep Benchmark: 1681 Yangyang Mainshock & Tsunami ---');
const y1681 = HISTORICAL_EVENTS.find(e => e.id === 'hist_1681_0626');
assert(Boolean(y1681), 'Found 1681 Yangyang event (hist_1681_0626)');
assert(y1681.linkedRecords.length === 3, `1681 has 3 multi-corpus linked records (got ${y1681.linkedRecords.length})`);
assert(y1681.linkedRecords.some(r => r.corpusId === 'joseon_sillok'), '1681 links to Joseon Sillok (Annals)');
assert(y1681.linkedRecords.some(r => r.corpusId === 'seungjeongwon_ilseongnok'), '1681 links to Seungjeongwon Ilgi (Governor Dispatch)');
assert(y1681.linkedRecords.some(r => r.corpusId === 'jeungbo_munheon_bigo'), '1681 links to Jeungbo Munheon Bigo');

assert(y1681.feltCounties.length === 7, `1681 has 7 macroseismic felt counties (got ${y1681.feltCounties.length})`);
assert(y1681.feltCounties[0].countyKo.includes('양양'), '1681 epicenter county is Yangyang');
assert(y1681.feltCounties[0].intensityMMI === 'VIII~IX', '1681 Yangyang MMI is VIII~IX');
assert(y1681.feltCounties[0].distanceKm === 18, '1681 Yangyang distance is 18 km');

assert(y1681.geophysicalPhenomena.type === 'TSUNAMI_HYDRODYNAMICS', '1681 physics type is TSUNAMI_HYDRODYNAMICS');
assert(y1681.geophysicalPhenomena.equation.includes('\\sqrt{gH}'), '1681 physics equation includes shallow water wave speed');
assert(y1681.astronomicalChronology.reignTitle.includes('숙종'), '1681 reign title is Sukjong');
assert(y1681.astronomicalChronology.sexagenaryDay.includes('무오'), '1681 sexagenary day is Mu-o');
assert(y1681.astronomicalChronology.solarCalendar.includes('1681-06-26'), '1681 solar calendar is 1681-06-26');

// 3. Deep Benchmark Verification: 1643 Ulsan Great Quake & Liquefaction
console.log('\n--- 3. Deep Benchmark: 1643 Ulsan Great Quake & Liquefaction ---');
const u1643 = HISTORICAL_EVENTS.find(e => e.id === 'hist_1643_ulsan');
assert(Boolean(u1643), 'Found 1643 Ulsan event (hist_1643_ulsan)');
assert(u1643.linkedRecords.length === 2, `1643 has 2 linked records (got ${u1643.linkedRecords.length})`);
assert(u1643.feltCounties.length === 6, `1643 has 6 felt counties (got ${u1643.feltCounties.length})`);
assert(u1643.feltCounties[0].countyKo.includes('울산'), '1643 epicenter county is Ulsan');
assert(u1643.feltCounties[0].intensityMMI === 'IX', '1643 Ulsan MMI is IX');
assert(u1643.geophysicalPhenomena.type === 'SOIL_LIQUEFACTION', '1643 physics type is SOIL_LIQUEFACTION');
assert(u1643.geophysicalPhenomena.equation.includes('P_{pore}'), '1643 equation includes pore water pressure');
assert(u1643.astronomicalChronology.reignTitle.includes('인조'), '1643 reign title is Injo');
assert(u1643.astronomicalChronology.solarCalendar.includes('1643-07-24'), '1643 solar calendar is 1643-07-24');

// 4. Deep Benchmark Verification: 1518 Seoul Battlement Collapse
console.log('\n--- 4. Deep Benchmark: 1518 Seoul Battlement Collapse ---');
const s1518 = HISTORICAL_EVENTS.find(e => e.id === 'hist_1518_seoul');
assert(Boolean(s1518), 'Found 1518 Seoul event (hist_1518_seoul)');
assert(s1518.linkedRecords.length === 2, `1518 has 2 linked records (got ${s1518.linkedRecords.length})`);
assert(s1518.feltCounties.length === 6, `1518 has 6 felt counties (got ${s1518.feltCounties.length})`);
assert(s1518.geophysicalPhenomena.type === 'STRUCTURAL_RESONANCE_ROCKFALL', '1518 physics type is STRUCTURAL_RESONANCE_ROCKFALL');
assert(s1518.geophysicalPhenomena.equation.includes('FS ='), '1518 equation includes safety factor FS');

// 5. Deep Benchmark Verification: 0779 Silla Gyeongju Quake
console.log('\n--- 5. Deep Benchmark: 0779 Silla Gyeongju Quake ---');
const g0779 = HISTORICAL_EVENTS.find(e => e.id === 'hist_0779_gyeongju');
assert(Boolean(g0779), 'Found 0779 Gyeongju event (hist_0779_gyeongju)');
assert(g0779.linkedRecords.length === 2, `0779 has 2 linked records (got ${g0779.linkedRecords.length})`);
assert(g0779.feltCounties.length === 4, `0779 has 4 felt counties (got ${g0779.feltCounties.length})`);
assert(g0779.feltCounties[0].countyKo.includes('금성'), '0779 epicenter county is Geumseong (Gyeongju)');
assert(g0779.geophysicalPhenomena.equation.includes('PGA'), '0779 equation includes PGA acceleration');

// 6. UI & HTML Integration Verifications
console.log('\n--- 6. UI DOM & Template Verification ---');
const indexHtml = Deno.readTextFileSync('index.html');
assert(indexHtml.includes('data-dossier-tab="hist_corpus"'), 'index.html contains hist_corpus tab button');
assert(indexHtml.includes('data-dossier-tab="hist_academic"'), 'index.html contains hist_academic tab button');
assert(indexHtml.includes('data-dossier-tab="hist_geophysics"'), 'index.html contains hist_geophysics tab button');
assert(indexHtml.includes('id="tab-pane-hist-corpus"'), 'index.html contains tab-pane-hist-corpus');
assert(indexHtml.includes('id="tab-pane-hist-academic"'), 'index.html contains tab-pane-hist-academic');
assert(indexHtml.includes('id="tab-pane-hist-geophysics"'), 'index.html contains tab-pane-hist-geophysics');
assert(indexHtml.includes('id="hist-corpus-source-bar"'), 'index.html contains hist-corpus-source-bar for multi-corpus switcher');
assert(indexHtml.includes('id="hist-felt-counties-section"'), 'index.html contains hist-felt-counties-section');
assert(indexHtml.includes('id="hist-methodology-section"'), 'index.html contains hist-methodology-section');
assert(indexHtml.includes('id="hist-geophysics-container"'), 'index.html contains hist-geophysics-container');
assert(indexHtml.includes('id="hist-chronology-container"'), 'index.html contains hist-chronology-container');
assert(indexHtml.includes('id="hist-gazetteer-container"'), 'index.html contains hist-gazetteer-container');

// 7. Surface CSS Rule Verification
console.log('\n--- 7. Surface CSS Stylesheet Verification ---');
const surfaceCss = Deno.readTextFileSync('css/surface.css');
assert(surfaceCss.includes('.hist-corpus-source-bar'), 'surface.css contains .hist-corpus-source-bar');
assert(surfaceCss.includes('.hist-source-pill'), 'surface.css contains .hist-source-pill');
assert(surfaceCss.includes('.quote-archive-link'), 'surface.css contains .quote-archive-link');
assert(surfaceCss.includes('.hist-felt-table'), 'surface.css contains .hist-felt-table');
assert(surfaceCss.includes('.hist-mmi-badge'), 'surface.css contains .hist-mmi-badge');
assert(surfaceCss.includes('.hist-method-grid'), 'surface.css contains .hist-method-grid');
assert(surfaceCss.includes('.hist-chrono-grid'), 'surface.css contains .hist-chrono-grid');

console.log('\n====================================================================');
console.log(`Phase D4 Historical Dossier Unit Test Summary: ${passed} PASSED, ${failed} FAILED`);
console.log('====================================================================\n');

if (failed > 0) Deno.exit(1);
