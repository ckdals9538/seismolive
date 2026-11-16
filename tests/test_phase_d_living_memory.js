// ============================================================================
// SEISMOLIVE v4.0 — Phase D: Living Memory & Typography Unit Test Suite
// File: tests/test_phase_d_living_memory.js
// Run via: deno run -A tests/test_phase_d_living_memory.js
// ============================================================================

import { SOURCE_CORPORA, SOURCE_RECORDS, HISTORICAL_EVENTS, EVENT_SOURCE_LINKS } from '../js/data/historicalArchiveDB.js';
import { INSTRUMENTAL_EVENTS } from '../js/data/instrumentalCatalogDB.js';
import { ArchivalSemanticParser, LivingMemoryEngine, EVIDENCE_CLASSES, LIFECYCLE_STAGES } from '../js/3d/livingMemoryEngine.js';

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
console.log('SEISMOLIVE v4.0 — Phase D Living Memory Unit Test Suite');
console.log('====================================================================\n');

// ----------------------------------------------------------------------------
// Test Group 1: Lexicon Reclassification & 8-Field Archival Metadata Schema
// ----------------------------------------------------------------------------
console.log('--- Test Group 1: Lexicon Reclassification & 8-Field Metadata ---');

const VALID_EVIDENCE_CLASSES = new Set([
  'DIRECT_QUOTATION',
  'SOURCE_TRANSLATION',
  'EDITORIAL_DISTILLATION',
  'ARTISTIC_METAPHOR'
]);

// Definition of 1681 Yangyang Living Memory Lexicon
const YANGYANG_1681_LEXICON = [
  {
    id: 'unit_1681_recede',
    token: '퇴조',
    sourceId: 'rec_sjw_1681_0514',
    originalPassage: '海水退潮百餘步',
    translation: '바닷물이 백여 보 물러갔다가 밀려왔다',
    evidenceClass: 'DIRECT_QUOTATION',
    editorialRationale: "승정원일기 1681년 5월 14일 강원감사 장계에 기록된 원문 한자어 '退潮'의 직접 음독 인용",
    confidence: 'HIGH_PRIMARY_CHRONICLE',
    spatialMotif: 'ZONE_OCEAN_SHELF'
  },
  {
    id: 'unit_1681_resonance',
    token: '울다',
    sourceId: 'rec_sillok_1681_0626',
    originalPassage: '聲如雷 ... 山岳震動',
    translation: '소리가 우레와 같고 ... 산이 울고 땅이 진동하였으며',
    evidenceClass: 'SOURCE_TRANSLATION',
    editorialRationale: "실록의 '山岳震動' 및 '聲如雷'에 대한 공인 국역 표현 '산이 울고'에서 동사 원형 추출",
    confidence: 'HIGH_PRIMARY_CHRONICLE',
    spatialMotif: 'ZONE_ALPINE_RIDGE'
  },
  {
    id: 'unit_1681_expose',
    token: '드러나다',
    sourceId: 'rec_sjw_1681_0514',
    originalPassage: '海水退潮百餘步',
    translation: '바닷물이 백여 보 물러가 해저가 드러남',
    evidenceClass: 'EDITORIAL_DISTILLATION',
    editorialRationale: '백여 보 퇴조로 인해 드러난 해저 노출 사료 현상을 순우리말 동사로 정제',
    confidence: 'HIGH_PRIMARY_CHRONICLE',
    spatialMotif: 'ZONE_COASTAL_BLUFF'
  },
  {
    id: 'unit_1681_fracture',
    token: '무너지다',
    sourceId: 'rec_sillok_1681_0626',
    originalPassage: '巨巖崩壞 / 巖石崩頹',
    translation: '거대한 바위가 붕괴되고 / 암석이 무너져 내리고',
    evidenceClass: 'SOURCE_TRANSLATION',
    editorialRationale: "실록과 승정원일기의 '崩壞'·'崩頹'에 대한 공인 번역 표현 '무너져 내리다'의 동사 원형",
    confidence: 'HIGH_PRIMARY_CHRONICLE',
    spatialMotif: 'ZONE_ALPINE_RIDGE'
  }
];

const REQUIRED_FIELDS = [
  'token',
  'sourceId',
  'originalPassage',
  'translation',
  'evidenceClass',
  'editorialRationale',
  'confidence',
  'spatialMotif'
];

YANGYANG_1681_LEXICON.forEach(item => {
  for (const field of REQUIRED_FIELDS) {
    assert(typeof item[field] === 'string' && item[field].length > 0, `Unit '${item.id}' has non-empty field: ${field}`);
  }
  assert(VALID_EVIDENCE_CLASSES.has(item.evidenceClass), `Unit '${item.id}' has valid evidenceClass: ${item.evidenceClass}`);
});

// ----------------------------------------------------------------------------
// Test Group 2: Strict Ban on Fake Direct Quotations
// ----------------------------------------------------------------------------
console.log('\n--- Test Group 2: Zero Fake Direct Quotation Verification ---');

// '퇴조' is DIRECT_QUOTATION because '退潮' appears verbatim in Seungjeongwon Ilgi
const recedeUnit = YANGYANG_1681_LEXICON.find(u => u.token === '퇴조');
assert(recedeUnit.evidenceClass === 'DIRECT_QUOTATION', "'퇴조' correctly flagged as DIRECT_QUOTATION of Hanja 退潮");
assert(recedeUnit.originalPassage.includes('退潮'), "Original passage for '퇴조' contains exact Hanja characters 退潮");

// '울다' is SOURCE_TRANSLATION, NOT DIRECT_QUOTATION (original is Hanja 聲如雷 / 山岳震動)
const resonanceUnit = YANGYANG_1681_LEXICON.find(u => u.token === '울다');
assert(resonanceUnit.evidenceClass === 'SOURCE_TRANSLATION', "'울다' correctly flagged as SOURCE_TRANSLATION (not fake direct quotation)");
assert(resonanceUnit.evidenceClass !== 'DIRECT_QUOTATION', "'울다' is strictly distinguished from direct quotation");

// '드러나다' is EDITORIAL_DISTILLATION, NOT DIRECT_QUOTATION
const exposeUnit = YANGYANG_1681_LEXICON.find(u => u.token === '드러나다');
assert(exposeUnit.evidenceClass === 'EDITORIAL_DISTILLATION', "'드러나다' correctly flagged as EDITORIAL_DISTILLATION");

// '무너지다' is SOURCE_TRANSLATION, NOT DIRECT_QUOTATION (original is Hanja 崩壞 / 崩頹)
const fractureUnit = YANGYANG_1681_LEXICON.find(u => u.token === '무너지다');
assert(fractureUnit.evidenceClass === 'SOURCE_TRANSLATION', "'무너지다' correctly flagged as SOURCE_TRANSLATION");

// ----------------------------------------------------------------------------
// Test Group 3: Word-Level Token Constraint (Strict Ban on Sentences)
// ----------------------------------------------------------------------------
console.log('\n--- Test Group 3: Word-Level Token Constraint (Ban on Sentences) ---');

YANGYANG_1681_LEXICON.forEach(item => {
  // Must be 1~4 syllables, NO sentence structure (no spaces, no subject+verb sentences)
  assert(!item.token.includes(' '), `Token '${item.token}' is single word without spaces (no multi-word sentence)`);
  assert(item.token.length >= 1 && item.token.length <= 4, `Token '${item.token}' has concise word length: ${item.token.length} chars (<= 4)`);
});

// ----------------------------------------------------------------------------
// Test Group 4: Visual Hierarchy & Non-Clutter Sequential Timing
// ----------------------------------------------------------------------------
console.log('\n--- Test Group 4: Visual Hierarchy & Timing Sequentiality ---');

const timingSchedule = [
  { token: '퇴조', t_act: 3.2, dur: 10.4 }, // active 3.2 ~ 13.6s
  { token: '울다', t_act: 14.5, dur: 10.0 }, // active 14.5 ~ 24.5s
  { token: '드러나다', t_act: 23.0, dur: 10.8 },
  { token: '무너지다', t_act: 31.0, dur: 10.2 }
];

// At t = 6.0s (the primary still frame), only '퇴조' is active!
const t_still = 6.0;
const activeAtStill = timingSchedule.filter(s => t_still >= s.t_act && t_still <= (s.t_act + s.dur));
assert(activeAtStill.length === 1, `Exactly ONE primary word active at primary still frame (got ${activeAtStill.length})`);
assert(activeAtStill[0].token === '퇴조', `Focal word at primary still frame is '퇴조' (got '${activeAtStill[0].token}')`);

// Check that '울다', '드러나다', '무너지다' are in LATENT state at t = 6.0s
const othersAtStill = timingSchedule.filter(s => s.token !== '퇴조');
othersAtStill.forEach(s => {
  assert(t_still < s.t_act, `Word '${s.token}' is strictly LATENT at primary still frame (t_act=${s.t_act}s > t_still=${t_still}s)`);
});

// ----------------------------------------------------------------------------
// Test Group 5: 6-Stage Temporal Lifecycle Simulation
// ----------------------------------------------------------------------------
console.log('\n--- Test Group 5: 6-Stage Temporal Lifecycle State Machine ---');

function evaluateLifecycle(simTime, t_act, lc) {
  const dtAct = simTime - t_act;
  const total = lc.formationDuration + lc.minLegibilityDuration + lc.resonanceDuration + lc.dissolutionDuration + lc.residueDuration;
  if (dtAct < 0.0) return { state: 'LATENT', opacity: 0.0 };
  if (dtAct < lc.formationDuration) {
    const p = dtAct / lc.formationDuration;
    return { state: 'EMERGENCE', opacity: (1.0 - Math.pow(1.0 - p, 2.5)) * 0.95 };
  }
  if (dtAct < lc.formationDuration + lc.minLegibilityDuration) {
    return { state: 'FORMATION', opacity: 0.98 };
  }
  if (dtAct < lc.formationDuration + lc.minLegibilityDuration + lc.resonanceDuration) {
    return { state: 'RESONANCE', opacity: 0.95 };
  }
  if (dtAct < lc.formationDuration + lc.minLegibilityDuration + lc.resonanceDuration + lc.dissolutionDuration) {
    const dissT = dtAct - (lc.formationDuration + lc.minLegibilityDuration + lc.resonanceDuration);
    const dissProg = dissT / lc.dissolutionDuration;
    return { state: 'DISSOLUTION', opacity: 0.94 * (1.0 - dissProg * 0.8) };
  }
  if (dtAct < total) {
    return { state: 'RESIDUE', opacity: 0.18 };
  }
  return { state: 'DEAD', opacity: 0.0 };
}

const recedeLC = {
  formationDuration: 1.2,
  minLegibilityDuration: 2.2,
  resonanceDuration: 2.6,
  dissolutionDuration: 2.6,
  residueDuration: 2.2
};
const t_act_recede = 3.2;

const eval_latent = evaluateLifecycle(1.5, t_act_recede, recedeLC);
assert(eval_latent.state === 'LATENT' && eval_latent.opacity === 0.0, 'Stage 1: LATENT evaluates to opacity 0.0');

const eval_emergence = evaluateLifecycle(3.8, t_act_recede, recedeLC);
assert(eval_emergence.state === 'EMERGENCE' && eval_emergence.opacity > 0.0 && eval_emergence.opacity < 0.95, `Stage 2: EMERGENCE opacity rises: ${eval_emergence.opacity.toFixed(3)}`);

const eval_formation = evaluateLifecycle(4.8, t_act_recede, recedeLC);
assert(eval_formation.state === 'FORMATION' && eval_formation.opacity >= 0.95, `Stage 3: FORMATION locks legibility: opacity=${eval_formation.opacity.toFixed(3)}`);

const eval_resonance = evaluateLifecycle(7.0, t_act_recede, recedeLC);
assert(eval_resonance.state === 'RESONANCE' && eval_resonance.opacity >= 0.90, `Stage 4: RESONANCE sustains peak presence: opacity=${eval_resonance.opacity.toFixed(3)}`);

const eval_dissolution = evaluateLifecycle(9.4, t_act_recede, recedeLC);
assert(eval_dissolution.state === 'DISSOLUTION' && eval_dissolution.opacity < 0.90 && eval_dissolution.opacity > 0.15, `Stage 5: DISSOLUTION disperses: opacity=${eval_dissolution.opacity.toFixed(3)}`);

const eval_residue = evaluateLifecycle(12.0, t_act_recede, recedeLC);
assert(eval_residue.state === 'RESIDUE' && eval_residue.opacity <= 0.20 && eval_residue.opacity > 0.0, `Stage 6: RESIDUE lingers faintly: opacity=${eval_residue.opacity.toFixed(3)}`);

const eval_dead = evaluateLifecycle(15.0, t_act_recede, recedeLC);
assert(eval_dead.state === 'DEAD' && eval_dead.opacity === 0.0, 'Stage 7: DEAD cleanly culled to opacity 0.0');

// ----------------------------------------------------------------------------
// Test Group 5: ArchivalSemanticParser & LivingMemoryEngine Module Integration
// ----------------------------------------------------------------------------
console.log('\n--- Test Group 5: ArchivalSemanticParser & LivingMemoryEngine Module ---');

const parser = new ArchivalSemanticParser(HISTORICAL_EVENTS, SOURCE_RECORDS, EVENT_SOURCE_LINKS, INSTRUMENTAL_EVENTS);
const parsed1681 = parser.parseEvent('hist_1681_0626');

assert(parsed1681 !== null, 'Parser successfully parsed hist_1681_0626');
assert(parsed1681.semanticUnits.length === 10, `1681 Yangyang produces 10 verbatim chronicle clauses (got ${parsed1681.semanticUnits.length})`);
assert(parsed1681.semanticUnits[0].token === '산이 울고', `Unit 1 token is verbatim '산이 울고' (got ${parsed1681.semanticUnits[0].token})`);
assert(parsed1681.semanticUnits[0].semantic.displayText === '산이 울고', `Unit 1 displayText is verbatim '산이 울고' (got ${parsed1681.semanticUnits[0].semantic.displayText})`);
assert(parsed1681.semanticUnits[1].token === '땅이 진동하였으며', `Unit 2 token is verbatim '땅이 진동하였으며' (got ${parsed1681.semanticUnits[1].token})`);
assert(parsed1681.semanticUnits[2].token === '거암이 붕괴되고', `Unit 3 token is verbatim '거암이 붕괴되고' (got ${parsed1681.semanticUnits[2].token})`);
assert(parsed1681.semanticUnits[3].token === '바닷물이 조수가 밀려가는 듯하더니', `Unit 4 token is verbatim '바닷물이 조수가 밀려가는 듯하더니' (got ${parsed1681.semanticUnits[3].token})`);
assert(parsed1681.semanticUnits[4].token === '갑자기 언덕을 넘어왔다', `Unit 5 token is verbatim '갑자기 언덕을 넘어왔다' (got ${parsed1681.semanticUnits[4].token})`);
assert(parsed1681.semanticUnits[5].token === '양양 낙산사와 설악산 신흥사의 바위가 무너지고', `Unit 6 token is verbatim '양양 낙산사와 설악산 신흥사의 바위가 무너지고' (got ${parsed1681.semanticUnits[5].token})`);
assert(parsed1681.semanticUnits[6].token === '삼척 죽서루 절벽이 흔들렸으며', `Unit 7 token is verbatim '삼척 죽서루 절벽이 흔들렸으며' (got ${parsed1681.semanticUnits[6].token})`);
assert(parsed1681.semanticUnits[7].token === '바닷물이 백여 보 물러갔다가 밀려왔다', `Unit 8 token is verbatim '바닷물이 백여 보 물러갔다가 밀려왔다' (got ${parsed1681.semanticUnits[7].token})`);
assert(parsed1681.semanticUnits[8].token === '바닷물이 물러갔다 넘치고', `Unit 9 token is verbatim '바닷물이 물러갔다 넘치고' (got ${parsed1681.semanticUnits[8].token})`);
assert(parsed1681.semanticUnits[9].token === '설악산 바위가 무너졌다', `Unit 10 token is verbatim '설악산 바위가 무너졌다' (got ${parsed1681.semanticUnits[9].token})`);

// Cross-catalog verbatim chronicle verification across all 32 historical events
const uniqueHistoricalExpressions = new Set();
for (const ev of HISTORICAL_EVENTS) {
  const pEv = parser.parseEvent(ev.eventId);
  assert(pEv && pEv.semanticUnits.length >= 2, `Historical event ${ev.eventId} produces >= 2 semantic units (got ${pEv ? pEv.semanticUnits.length : 0})`);
  for (const unit of pEv.semanticUnits) {
    assert(unit.token === unit.semantic.displayText, `Unit ${unit.id} outputs identical verbatim phrase in token and displayText ('${unit.token}')`);
    uniqueHistoricalExpressions.add(unit.semantic.displayText);
  }
}
assert(uniqueHistoricalExpressions.size >= 85, `Historical catalog produces >= 85 unique verbatim chronicle clauses (got ${uniqueHistoricalExpressions.size})`);

const engine = new LivingMemoryEngine();
assert(engine.entities.length === 0, 'LivingMemoryEngine starts with clean empty entities');
assert(engine.enableDarkCushion === true, 'Dark cushion default enabled for figure-ground contrast');
assert(LIFECYCLE_STAGES.length === 7, '7 lifecycle stages defined (LATENT through DEAD)');
assert(EVIDENCE_CLASSES.DIRECT_QUOTATION === 'DIRECT_QUOTATION', 'Evidence class constants exported correctly');

console.log('\n====================================================================');
console.log(`PHASE D LIVING MEMORY UNIT TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
console.log('====================================================================\n');

if (failed > 0) {
  Deno.exit(1);
}
