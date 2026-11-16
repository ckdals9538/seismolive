// ============================================================================
// SEISMOLIVE v4.0 — Phase D2: Universal Living Memory Archival Expansion
// File: tests/test_phase_d2_archival_expansion.js
// Run via: deno run -A tests/test_phase_d2_archival_expansion.js
// ============================================================================

import { LivingSoundfieldEngine } from '../js/audio/livingSoundfieldEngine.js';
import { HISTORICAL_EVENTS, SOURCE_RECORDS, EVENT_SOURCE_LINKS } from '../js/data/historicalArchiveDB.js';
import { INSTRUMENTAL_EVENTS } from '../js/data/instrumentalCatalogDB.js';
import { ArchivalSemanticParser } from '../js/3d/livingMemoryEngine.js';

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
console.log('SEISMOLIVE v4.0 — Phase D2 Universal Archival Expansion Unit Test');
console.log('====================================================================\n');

// ----------------------------------------------------------------------------
// Universal 5-Event Canonical Lexicon Database (8 Mandatory Fields)
// ----------------------------------------------------------------------------
const UNIVERSAL_LEXICON_DB = {
  hist_1681_0626: [
    {
      id: "unit_1681_recede",
      token: "퇴조",
      sourceId: "rec_sjw_1681_0514",
      originalPassage: "海水退潮百餘步",
      translation: "바닷물이 백여 보 물러갔다가 밀려왔다",
      evidenceClass: "DIRECT_QUOTATION",
      editorialRationale: "승정원일기 1681년 5월 14일 강원감사 장계에 기록된 원문 한자어 '退潮'의 직접 음독 인용",
      confidence: "HIGH_PRIMARY_CHRONICLE",
      spatialMotif: "ZONE_OCEAN_SHELF",
      sourceType: "PRIMARY_CHRONICLE_OFFICIAL",
      timing: { t_activation: 3.2, dur: 10.4 }
    },
    {
      id: "unit_1681_resonance",
      token: "울다",
      sourceId: "rec_sillok_1681_0626",
      originalPassage: "聲如雷 ... 山岳震動",
      translation: "소리가 우레와 같고 ... 산이 울고 땅이 진동하였으며",
      evidenceClass: "SOURCE_TRANSLATION",
      editorialRationale: "실록의 '山岳震動' 및 '聲如雷'에 대한 공인 국역 표현 '산이 울고'에서 동사 원형 추출",
      confidence: "HIGH_PRIMARY_CHRONICLE",
      spatialMotif: "ZONE_ALPINE_RIDGE",
      sourceType: "PRIMARY_CHRONICLE_OFFICIAL",
      timing: { t_activation: 14.5, dur: 10.0 }
    },
    {
      id: "unit_1681_expose",
      token: "드러나다",
      sourceId: "rec_sjw_1681_0514",
      originalPassage: "海水退潮百餘步 露出",
      translation: "바닷물이 물러나 바다 밑이 드러났다",
      evidenceClass: "EDITORIAL_DISTILLATION",
      editorialRationale: "승정원일기 '海水退潮百餘步 露出'에 묘사된 해저 노출 현상의 공인 국역 표현에서 동사 추출",
      confidence: "HIGH_PRIMARY_CHRONICLE",
      spatialMotif: "ZONE_COASTAL_BLUFF",
      sourceType: "PRIMARY_CHRONICLE_OFFICIAL",
      timing: { t_activation: 23.0, dur: 10.8 }
    },
    {
      id: "unit_1681_fracture",
      token: "무너지다",
      sourceId: "rec_sillok_1681_0626",
      originalPassage: "巨巖崩壞 巖石崩頹",
      translation: "큰 바위가 무너져 내리고 돌이 떨어졌다",
      evidenceClass: "SOURCE_TRANSLATION",
      editorialRationale: "실록과 승정원일기의 '崩壞'·'崩頹'에 대한 공인 번역 표현 '무너져 내리다'의 동사 원형",
      confidence: "HIGH_PRIMARY_CHRONICLE",
      spatialMotif: "ZONE_ALPINE_RIDGE",
      sourceType: "PRIMARY_CHRONICLE_OFFICIAL",
      timing: { t_activation: 31.0, dur: 10.2 }
    }
  ],

  hist_2016_gyeongju: [
    {
      id: "unit_2016_acoustic",
      token: "굉음",
      sourceId: "rec_kma_2016_report_p14",
      originalPassage: "천부 지표 진동에 앞서 '쿵', '쾅' 하는 폭발성 저주파 지하 굉음이 선행 감지됨",
      translation: "지하 단층 파열 시 수반된 고주파 P파 충격음 및 지중 굉음",
      evidenceClass: "SOURCE_TRANSLATION",
      editorialRationale: "기상청 보고서 및 시민 구술에서 공통적으로 기록된 지중 음향 현상 '굉음' 추출",
      confidence: "PRIMARY_OFFICIAL",
      spatialMotif: "ZONE_INLAND_BASIN",
      sourceType: "OFFICIAL_INSTRUMENTAL_REPORT",
      timing: { t_activation: 2.4, dur: 10.0 }
    },
    {
      id: "unit_2016_tilt",
      token: "기울다",
      sourceId: "rec_nrich_2016_cheomseongdae",
      originalPassage: "국보 첨성대 상부 정자석 북측 이격 및 중심축 북북서 방향으로 2.25cm 변위 발생",
      translation: "첨성대 상부 석축이 흔들려 북쪽으로 기울다",
      evidenceClass: "EDITORIAL_DISTILLATION",
      editorialRationale: "첨성대 중심축 변위 실측 조사 결과를 단일 동사 '기울다'로 정제",
      confidence: "PRIMARY_OFFICIAL",
      spatialMotif: "ZONE_HISTORIC_SITE",
      sourceType: "OFFICIAL_FIELD_INVESTIGATION",
      timing: { t_activation: 14.0, dur: 10.2 }
    },
    {
      id: "unit_2016_shaking",
      token: "흔들리다",
      sourceId: "rec_gyeongju_oral_2016_09",
      originalPassage: "집채 전체가 사방으로 요동치며 기와가 흔들려 쏟아져 내렸다",
      translation: "내남면과 시가지 전역의 가옥과 기와가 흔들리다",
      evidenceClass: "DIRECT_QUOTATION",
      editorialRationale: "주민 구술 채록에 반복 등장하는 신체적 체감 핵심 동사 '흔들리다'",
      confidence: "PRIMARY_EYEWITNESS",
      spatialMotif: "ZONE_ALLUVIAL_PLAIN",
      sourceType: "RESIDENT_TESTIMONY",
      timing: { t_activation: 24.0, dur: 10.4 }
    }
  ],

  hist_2017_pohang: [
    {
      id: "unit_2017_liquefaction",
      token: "솟구치다",
      sourceId: "rec_kigam_2018_sandboil",
      originalPassage: "흥해읍 곡강천 유역 200여 개소에서 모래와 물이 분수처럼 지표 위로 솟구쳐 올랐다",
      translation: "연약 퇴적층의 간극수압 상승으로 모래와 지하수가 솟구치다",
      evidenceClass: "DIRECT_QUOTATION",
      editorialRationale: "KIGAM 현장 조사 채록 및 주민 증언의 핵심 표출 동사 '솟구치다'",
      confidence: "PRIMARY_OFFICIAL",
      spatialMotif: "ZONE_ALLUVIAL_SEDIMENT",
      sourceType: "FIELD_INVESTIGATION_AND_TESTIMONY",
      timing: { t_activation: 2.4, dur: 10.2 }
    },
    {
      id: "unit_2017_fissure",
      token: "갈라지다",
      sourceId: "rec_kma_2018_surface_fissure",
      originalPassage: "진앙 주변 도로 및 아스팔트 포장면에 최대 폭 5~10cm의 인장 균열선 형성",
      translation: "천부 단층 연장에 의해 아스팔트와 지반이 갈라지다",
      evidenceClass: "SOURCE_TRANSLATION",
      editorialRationale: "기상청 지표 균열 관측을 직관적 지형 변화 동사로 환원",
      confidence: "PRIMARY_OFFICIAL",
      spatialMotif: "ZONE_URBAN_FAULT",
      sourceType: "OFFICIAL_INSTRUMENTAL_REPORT",
      timing: { t_activation: 14.0, dur: 10.0 }
    },
    {
      id: "unit_2017_fracture",
      token: "부서지다",
      sourceId: "rec_mois_2018_piloti",
      originalPassage: "필로티 기둥 콘크리트 압쇄 및 비구조 조적 외벽의 광범위한 탈락·전단 파괴",
      translation: "원룸 필로티 외벽과 기둥이 전단력을 견디지 못하고 부서지다",
      evidenceClass: "EDITORIAL_DISTILLATION",
      editorialRationale: "행안부 피해 보고서의 '압쇄·파괴'를 1음절 어근의 순수어 '부서지다'로 정제",
      confidence: "PRIMARY_OFFICIAL",
      spatialMotif: "ZONE_URBAN_BUILDING",
      sourceType: "DAMAGE_ASSESSMENT_REPORT",
      timing: { t_activation: 24.0, dur: 10.4 }
    }
  ],

  global_2016_kumamoto: [
    {
      id: "unit_2016_kumamoto_rift",
      token: "割れる",
      tokenNative: "割れる",
      tokenKo: "갈라지다",
      originalLanguage: "ja",
      sourceId: "rec_gsi_2016_futagawa",
      originalPassage: "布田川断層帯に沿って地表地震断層が出現し、アスファルトや田畑が大きく割れた",
      translation: "후타가와 단층대를 따라 지표면과 아스팔트가 크게 쪼개져 갈라지다",
      evidenceClass: "DIRECT_QUOTATION",
      editorialRationale: "GSI 지표 단층 조사 및 구마모토현 기록지 원문 어휘 '割れる'",
      confidence: "PRIMARY_OFFICIAL",
      spatialMotif: "ZONE_VOLCANIC_GRABEN",
      sourceType: "OFFICIAL_FIELD_SURVEY_AND_CHRONICLE",
      timing: { t_activation: 2.4, dur: 10.4 }
    },
    {
      id: "unit_2016_kumamoto_castle",
      token: "崩れる",
      tokenNative: "崩れる",
      tokenKo: "무너지다",
      originalLanguage: "ja",
      sourceId: "rec_kumamoto_2018_castle",
      originalPassage: "熊本城の石垣が激しく崩れ、阿蘇山外輪山の斜面が一斉に崩落した",
      translation: "구마모토성 석축이 무너지고 아소 화산 외륜산 사면이 일제히 무너지다",
      evidenceClass: "DIRECT_QUOTATION",
      editorialRationale: "구마모토성 이시가키 파괴 및 아소대교 붕괴 기록의 핵심 동사 '崩れる'",
      confidence: "PRIMARY_OFFICIAL",
      spatialMotif: "ZONE_CASTLE_MASONRY",
      sourceType: "DAMAGE_ASSESSMENT_CHRONICLE",
      timing: { t_activation: 14.0, dur: 10.2 }
    },
    {
      id: "unit_2016_kumamoto_rumble",
      token: "唸る",
      tokenNative: "唸る",
      tokenKo: "울부짖다",
      originalLanguage: "ja",
      sourceId: "rec_nied_2016_rumble",
      originalPassage: "山底から湧き上がるような激しい地鳴りが唸りを上げ、夜空を震わせた",
      translation: "아소 칼데라 바닥에서 솟구친 지명(地鳴り)이 맹수처럼 포효하다",
      evidenceClass: "SOURCE_TRANSLATION",
      editorialRationale: "아소 화산지대 저주파 지명(땅울림)의 음향적 공포를 상징하는 일본어 고유어 '唸る'",
      confidence: "PRIMARY_EYEWITNESS",
      spatialMotif: "ZONE_CALDERA_RIM",
      sourceType: "RESIDENT_TESTIMONY",
      timing: { t_activation: 24.0, dur: 10.4 }
    }
  ],

  global_2023_turkey: [
    {
      id: "unit_2023_turkey_rupture",
      token: "Kırılma",
      tokenNative: "Kırılma",
      tokenKo: "파열",
      originalLanguage: "tr",
      sourceId: "rec_afad_2023_fault_break",
      originalPassage: "Doğu Anadolu Fay Zonu boyunca 300 kilometreyi aşan yüzey kırılması meydana gelmiştir",
      translation: "동아나톨리아 단층대를 따라 300km를 넘는 지표 단열 파열이 발생하다",
      evidenceClass: "DIRECT_QUOTATION",
      editorialRationale: "터키 지진학 및 재난관리청(AFAD) 공식 문서에서 지표 단층 파열을 지칭하는 표준 어휘 'Kırılma'",
      confidence: "PRIMARY_OFFICIAL",
      spatialMotif: "ZONE_CONTINENTAL_FAULT",
      sourceType: "OFFICIAL_SEISMOLOGICAL_REPORT",
      timing: { t_activation: 2.4, dur: 10.4 }
    },
    {
      id: "unit_2023_turkey_collapse",
      token: "Yıkım",
      tokenNative: "Yıkım",
      tokenKo: "붕괴",
      originalLanguage: "tr",
      sourceId: "rec_odtu_2023_collapse",
      originalPassage: "Antakya ve Kahramanmaraş kent merkezlerinde toptan göçme ile tarifsiz bir yıkım yaşandı",
      translation: "안타키아와 카흐라만마라슈 도심에 총체적 전도와 극심한 붕괴가 발생하다",
      evidenceClass: "DIRECT_QUOTATION",
      editorialRationale: "도시 건축물 붕괴와 지질학적 파괴를 통틀어 터키 전역에서 채택된 공식 어휘 'Yıkım'",
      confidence: "PRIMARY_OFFICIAL",
      spatialMotif: "ZONE_VALLEY_RIFT",
      sourceType: "FIELD_DAMAGE_INVESTIGATION",
      timing: { t_activation: 14.0, dur: 10.2 }
    },
    {
      id: "unit_2023_turkey_canyon",
      token: "Yarılmak",
      tokenNative: "Yarılmak",
      tokenKo: "갈라지다",
      originalLanguage: "tr",
      sourceId: "rec_turkey_eyewitness_2023_goksun",
      originalPassage: "Zeytinlikler ve dağlar ortadan ikiye yarıldı, devasa yarıklar açıldı",
      translation: "올리브 과수원과 산맥이 반으로 쪼개져 갈라지다",
      evidenceClass: "DIRECT_QUOTATION",
      editorialRationale: "지표 파쇄를 목격한 현지 주민들의 증언에서 직관적으로 튀어나온 터키어 동사 'Yarılmak'",
      confidence: "PRIMARY_EYEWITNESS",
      spatialMotif: "ZONE_TAURUS_RANGE",
      sourceType: "RESIDENT_TESTIMONY",
      timing: { t_activation: 24.0, dur: 10.4 }
    }
  ]
};

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

const VALID_EVIDENCE_CLASSES = new Set([
  'DIRECT_QUOTATION',
  'SOURCE_TRANSLATION',
  'EDITORIAL_DISTILLATION',
  'ARTISTIC_METAPHOR'
]);

// ----------------------------------------------------------------------------
// Test Group 1: 8 Mandatory Fields Completeness across All 5 Events
// ----------------------------------------------------------------------------
console.log('--- Test Group 1: 8 Mandatory Fields Completeness ---');

for (const [eventId, units] of Object.entries(UNIVERSAL_LEXICON_DB)) {
  units.forEach(u => {
    for (const field of REQUIRED_FIELDS) {
      assert(typeof u[field] === 'string' && u[field].trim().length > 0, `[${eventId}] Unit '${u.id}' has non-empty field: ${field}`);
    }
    assert(VALID_EVIDENCE_CLASSES.has(u.evidenceClass), `[${eventId}] Unit '${u.id}' has valid evidenceClass: ${u.evidenceClass}`);
  });
}

// ----------------------------------------------------------------------------
// Test Group 2: Word-Level Token Constraint (Strict Ban on Sentences)
// ----------------------------------------------------------------------------
console.log('\n--- Test Group 2: Word-Level Token Constraint (Ban on Sentences) ---');

for (const [eventId, units] of Object.entries(UNIVERSAL_LEXICON_DB)) {
  units.forEach(u => {
    assert(!u.token.includes(' '), `[${eventId}] Token '${u.token}' is single word without spaces`);
    assert(u.token.length >= 1 && u.token.length <= 8, `[${eventId}] Token '${u.token}' is concise (length: ${u.token.length} chars)`);
  });
}

// ----------------------------------------------------------------------------
// Test Group 3: Multilingual Preservation for Kumamoto & Turkey
// ----------------------------------------------------------------------------
console.log('\n--- Test Group 3: Multilingual Native Language Preservation ---');

const kumamotoUnits = UNIVERSAL_LEXICON_DB.global_2016_kumamoto;
kumamotoUnits.forEach(u => {
  assert(u.originalLanguage === 'ja', `Kumamoto unit '${u.id}' language is Japanese ('ja')`);
  assert(typeof u.tokenNative === 'string' && u.tokenNative.length > 0, `Kumamoto unit '${u.id}' has native Japanese token: ${u.tokenNative}`);
  assert(typeof u.tokenKo === 'string' && u.tokenKo.length > 0, `Kumamoto unit '${u.id}' has paired Korean translation: ${u.tokenKo}`);
});

const turkeyUnits = UNIVERSAL_LEXICON_DB.global_2023_turkey;
turkeyUnits.forEach(u => {
  assert(u.originalLanguage === 'tr', `Turkey unit '${u.id}' language is Turkish ('tr')`);
  assert(typeof u.tokenNative === 'string' && u.tokenNative.length > 0, `Turkey unit '${u.id}' has native Turkish token: ${u.tokenNative}`);
  assert(typeof u.tokenKo === 'string' && u.tokenKo.length > 0, `Turkey unit '${u.id}' has paired Korean translation: ${u.tokenKo}`);
});

// ----------------------------------------------------------------------------
// Test Group 4: Geographic Motifs Differentiation (Anti-Monoculture)
// ----------------------------------------------------------------------------
console.log('\n--- Test Group 4: Geographically Distinct Spatial Motifs ---');

const eventMotifs = {};
for (const [eventId, units] of Object.entries(UNIVERSAL_LEXICON_DB)) {
  eventMotifs[eventId] = units.map(u => u.spatialMotif);
}

// Yangyang must contain marine motif
assert(eventMotifs.hist_1681_0626.includes('ZONE_OCEAN_SHELF'), 'Yangyang includes ocean shelf motif (offshore earthquake)');

// Gyeongju must be inland basin / historic masonry
assert(eventMotifs.hist_2016_gyeongju.includes('ZONE_INLAND_BASIN'), 'Gyeongju includes inland basin motif');
assert(eventMotifs.hist_2016_gyeongju.includes('ZONE_HISTORIC_SITE'), 'Gyeongju includes historic heritage site motif');

// Pohang must have alluvial sediment / urban fault
assert(eventMotifs.hist_2017_pohang.includes('ZONE_ALLUVIAL_SEDIMENT'), 'Pohang includes liquefaction sediment motif');
assert(eventMotifs.hist_2017_pohang.includes('ZONE_URBAN_FAULT'), 'Pohang includes urban surface fault motif');

// Kumamoto must have volcanic graben & caldera rim
assert(eventMotifs.global_2016_kumamoto.includes('ZONE_VOLCANIC_GRABEN'), 'Kumamoto includes volcanic graben motif');
assert(eventMotifs.global_2016_kumamoto.includes('ZONE_CALDERA_RIM'), 'Kumamoto includes caldera rim motif');

// Turkey must have continental fault & valley rift
assert(eventMotifs.global_2023_turkey.includes('ZONE_CONTINENTAL_FAULT'), 'Turkey includes massive continental fault motif');
assert(eventMotifs.global_2023_turkey.includes('ZONE_VALLEY_RIFT'), 'Turkey includes valley rift motif');

// ----------------------------------------------------------------------------
// Test Group 5: Still Frame Visual Hierarchy (t = 6.0s Single-Word Isolation)
// ----------------------------------------------------------------------------
console.log('\n--- Test Group 5: Still Frame (t = 6.0s) Single Focal Word Isolation ---');

const t_still = 6.0;

for (const [eventId, units] of Object.entries(UNIVERSAL_LEXICON_DB)) {
  const activeAtStill = units.filter(u => t_still >= u.timing.t_activation && t_still <= (u.timing.t_activation + u.timing.dur));
  assert(activeAtStill.length === 1, `[${eventId}] Exactly ONE focal word active at still frame (got ${activeAtStill.length}: ${activeAtStill.map(u=>u.token).join(', ')})`);

  const latentAtStill = units.filter(u => u !== activeAtStill[0]);
  latentAtStill.forEach(u => {
    assert(t_still < u.timing.t_activation, `[${eventId}] Sequential word '${u.token}' is strictly LATENT at still frame (t_act=${u.timing.t_activation}s > ${t_still}s)`);
  });
}

// ----------------------------------------------------------------------------
// Test Group 6: Living Soundfield State Machine & Safe Gain Culling
// ----------------------------------------------------------------------------
console.log('\n--- Test Group 6: Living Soundfield State Machine & Gain Culling ---');

const soundEngine = new LivingSoundfieldEngine({ volume: 0.65, isMuted: false });
assert(soundEngine.isMuted === false, 'Soundfield initially unmuted');
assert(soundEngine.masterVolume === 0.65, 'Soundfield initial volume is 0.65');

// Test stage tracking without Web Audio context (pure state machine check)
soundEngine.updateLifecycle('LATENT', 0.0, 1.0);
assert(soundEngine.currentStage === 'LATENT', 'Stage updated to LATENT');

soundEngine.updateLifecycle('EMERGENCE', 0.5, 3.8);
assert(soundEngine.currentStage === 'EMERGENCE', 'Stage updated to EMERGENCE');

soundEngine.updateLifecycle('FORMATION', 1.0, 4.8);
assert(soundEngine.currentStage === 'FORMATION', 'Stage updated to FORMATION');

soundEngine.updateLifecycle('RESONANCE', 0.5, 7.0);
assert(soundEngine.currentStage === 'RESONANCE', 'Stage updated to RESONANCE');

soundEngine.updateLifecycle('DISSOLUTION', 0.5, 9.4);
assert(soundEngine.currentStage === 'DISSOLUTION', 'Stage updated to DISSOLUTION');

soundEngine.updateLifecycle('RESIDUE', 0.8, 12.0);
assert(soundEngine.currentStage === 'RESIDUE', 'Stage updated to RESIDUE');

soundEngine.updateLifecycle('DEAD', 1.0, 15.0);
assert(soundEngine.currentStage === 'DEAD', 'Stage updated to DEAD');

// Test mute toggling
const mutedState = soundEngine.setMuted(true);
assert(mutedState === true, 'Mute toggle set to true');
assert(soundEngine.isMuted === true, 'soundEngine.isMuted reflects true');

const unmutedState = soundEngine.setMuted(false);
assert(unmutedState === false, 'Mute toggle set to false');
assert(soundEngine.isMuted === false, 'soundEngine.isMuted reflects false');

// ----------------------------------------------------------------------------
// Test Group 7: Universal ArchivalSemanticParser Integration across 4 Events
// ----------------------------------------------------------------------------
console.log('\n--- Test Group 7: Universal ArchivalSemanticParser Integration ---');

const parser = new ArchivalSemanticParser(HISTORICAL_EVENTS, SOURCE_RECORDS, EVENT_SOURCE_LINKS, INSTRUMENTAL_EVENTS);

// Gyeongju
const pGyeongju = parser.parseEvent('hist_2016_gyeongju');
assert(pGyeongju.semanticUnits.length === 4, `Parser parses 4 verbatim clauses for Gyeongju (got ${pGyeongju.semanticUnits.length})`);
assert(pGyeongju.semanticUnits[0].token === '경주 남남서쪽 8.7km 지역에서 발생한', 'Gyeongju unit 1 token is verbatim 경주 남남서쪽 8.7km 지역에서 발생한');
assert(pGyeongju.semanticUnits[0].semantic.displayText === '경주 남남서쪽 8.7km 지역에서 발생한', 'Gyeongju unit 1 displayText is verbatim 경주 남남서쪽 8.7km 지역에서 발생한');
assert(pGyeongju.semanticUnits[1].token === '계측 사상 최대 규모 5.8 지진으로', 'Gyeongju unit 2 token is verbatim 계측 사상 최대 규모 5.8 지진으로');
assert(pGyeongju.semanticUnits[2].token === '전국에서 진동을 감지하고', 'Gyeongju unit 3 token is verbatim 전국에서 진동을 감지하고');
assert(pGyeongju.semanticUnits[3].token === '첨성대 미세 균열 등 발생', 'Gyeongju unit 4 token is verbatim 첨성대 미세 균열 등 발생');

// Pohang
const pPohang = parser.parseEvent('hist_2017_pohang');
assert(pPohang.semanticUnits.length === 4, `Parser parses 4 verbatim clauses for Pohang (got ${pPohang.semanticUnits.length})`);
assert(pPohang.semanticUnits[0].token === '포항 북구 북쪽 9km 지역에서 발생한 규모 5.4 지진으로', 'Pohang unit 1 token is verbatim 포항 북구 북쪽 9km 지역에서 발생한 규모 5.4 지진으로');
assert(pPohang.semanticUnits[1].token === '필로티 기둥 붕괴', 'Pohang unit 2 token is verbatim 필로티 기둥 붕괴');
assert(pPohang.semanticUnits[2].token === '지표 균열 및 액상화 현상이 계측 사상 최초로 확인됨', 'Pohang unit 3 token is verbatim 지표 균열 및 액상화 현상이 계측 사상 최초로 확인됨');
assert(pPohang.semanticUnits[3].token === '지표 파열 및 액상화 현상과 필로티 구조물 파손 발생', 'Pohang unit 4 token is verbatim 지표 파열 및 액상화 현상과 필로티 구조물 파손 발생');

// Kumamoto Native vs Korean Mode
parser.setDisplayMode('native');
const pKumamotoNative = parser.parseEvent('global_2016_kumamoto');
assert(pKumamotoNative.semanticUnits.length === 4, 'Kumamoto native parses 4 units');
assert(pKumamotoNative.semanticUnits[0].token === '布田川断層帯', 'Kumamoto native unit 1 token is 布田川断層帯');
assert(pKumamotoNative.semanticUnits[1].token === '震度7観測', 'Kumamoto native unit 2 token is 震度7観測');
assert(pKumamotoNative.semanticUnits[2].token === '地表変位 2m', 'Kumamoto native unit 3 token is 地表変位 2m');
assert(pKumamotoNative.semanticUnits[3].token === '崩壊', 'Kumamoto native unit 4 token is 崩壊');

parser.setDisplayMode('korean');
const pKumamotoKo = parser.parseEvent('global_2016_kumamoto');
assert(pKumamotoKo.semanticUnits.length === 4, 'Kumamoto Korean parses 4 units');
assert(pKumamotoKo.semanticUnits[0].token === '후타가와 단층대', 'Kumamoto Korean unit 1 token is 후타가와 단층대');
assert(pKumamotoKo.semanticUnits[1].token === '진도 7 관측', 'Kumamoto Korean unit 2 token is 진도 7 관측');
assert(pKumamotoKo.semanticUnits[2].token === '지표 변위 2m', 'Kumamoto Korean unit 3 token is 지표 변위 2m');
assert(pKumamotoKo.semanticUnits[3].token === '무너지다', 'Kumamoto Korean unit 4 token is 무너지다');

// Turkey Native vs Korean Mode
parser.setDisplayMode('native');
const pTurkeyNative = parser.parseEvent('global_2023_turkey');
assert(pTurkeyNative.semanticUnits.length === 4, 'Turkey native parses 4 units');
assert(pTurkeyNative.semanticUnits[0].token === 'Doğu Anadolu Fayı', 'Turkey native unit 1 token is Doğu Anadolu Fayı');
assert(pTurkeyNative.semanticUnits[1].token === '310 km Yüzey Kırığı', 'Turkey native unit 2 token is 310 km Yüzey Kırığı');
assert(pTurkeyNative.semanticUnits[2].token === 'Maksimum 6.5 m Kayma', 'Turkey native unit 3 token is Maksimum 6.5 m Kayma');
assert(pTurkeyNative.semanticUnits[3].token === 'Yarılmak', 'Turkey native unit 4 token is Yarılmak');

parser.setDisplayMode('korean');
const pTurkeyKo = parser.parseEvent('global_2023_turkey');
assert(pTurkeyKo.semanticUnits.length === 4, 'Turkey Korean parses 4 units');
assert(pTurkeyKo.semanticUnits[0].token === '동아나톨리아 대단층', 'Turkey Korean unit 1 token is 동아나톨리아 대단층');
assert(pTurkeyKo.semanticUnits[1].token === '지표 파열 310km', 'Turkey Korean unit 2 token is 지표 파열 310km');
assert(pTurkeyKo.semanticUnits[2].token === '최대 변위 6.5m', 'Turkey Korean unit 3 token is 최대 변위 6.5m');
assert(pTurkeyKo.semanticUnits[3].token === '갈라지다', 'Turkey Korean unit 4 token is 갈라지다');

console.log('\n====================================================================');
console.log(`PHASE D2 ARCHIVAL EXPANSION UNIT TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
console.log('====================================================================\n');

if (failed > 0) {
  Deno.exit(1);
}
