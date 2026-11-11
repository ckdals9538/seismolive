// ============================================================================
// SEISMOLIVE v4.0 — Pillar 3: Living Memory & Archival Korean Typography Engine
// Module: js/3d/livingMemoryEngine.js
// Archival Semantic Parser · 4 Kinetic Archetypes · 6-Stage Atmospheric Lifecycle
// Strict Adherence to GEMINI.md: Pure Archival Words · Zero Game VFX · Still Frame Art
// ============================================================================

/**
 * Valid Evidence Classifications for Archival Words
 */
export const EVIDENCE_CLASSES = {
  DIRECT_QUOTATION: 'DIRECT_QUOTATION',
  SOURCE_TRANSLATION: 'SOURCE_TRANSLATION',
  EDITORIAL_DISTILLATION: 'EDITORIAL_DISTILLATION',
  ARTISTIC_METAPHOR: 'ARTISTIC_METAPHOR'
};

/**
 * 6-Stage Atmospheric Kinetic Lifecycle
 */
export const LIFECYCLE_STAGES = [
  'LATENT',
  'EMERGENCE',
  'FORMATION',
  'RESONANCE',
  'DISSOLUTION',
  'RESIDUE',
  'DEAD'
];

/**
 * Comprehensive Chronicle Hanja-to-Korean Archival Expression Database
 * Grounded in 삼국사기, 고려사, 조선왕조실록, 승정원일기, 일성록, 증보문헌비고
 */
export const ARCHIVAL_HANJA_LEXICON_DB = {
  // 1681 Yangyang & Marine / Tsunami Chronicles
  "海水退潮百餘步": { displayKo: "바닷물이 백여 보 물러나다", token: "퇴조", archetype: "RECEDE", stageZone: "ZONE_A_OCEAN" },
  "海水如潮退而溢": { displayKo: "해저가 드러나다", token: "드러나다", archetype: "EXPOSE", stageZone: "ZONE_A_OCEAN" },
  "海水退而溢": { displayKo: "바닷물이 물러갔다 넘치다", token: "해일", archetype: "RECEDE", stageZone: "ZONE_A_OCEAN" },
  "雪嶽山巖崩": { displayKo: "설악산 바위가 무너지다", token: "무너지다", archetype: "FRACTURE", stageZone: "ZONE_C_MOUNTAIN" },
  "巨巖崩壞": { displayKo: "설악 거암이 무너지다", token: "무너지다", archetype: "FRACTURE", stageZone: "ZONE_C_MOUNTAIN" },
  "巖石崩頹": { displayKo: "설악산 바위가 무너지다", token: "무너지다", archetype: "FRACTURE", stageZone: "ZONE_C_MOUNTAIN" },
  "竹西樓巖石動搖": { displayKo: "죽서루 절벽이 흔들리다", token: "흔들리다", archetype: "RESONANCE", stageZone: "ZONE_B_INLAND" },
  "海岸崩坼": { displayKo: "해안 언덕이 갈라지다", token: "갈라지다", archetype: "FRACTURE", stageZone: "ZONE_A_OCEAN" },
  "餘震連日不絶": { displayKo: "여진이 연일 그치지 않다", token: "여진", archetype: "RESONANCE", stageZone: "ZONE_B_INLAND" },
  "山岳震動": { displayKo: "산악이 진동하다", token: "진동하다", archetype: "RESONANCE", stageZone: "ZONE_C_MOUNTAIN" },

  // Samguk Sagi (AD 2 – 779)
  "國內地震": { displayKo: "국내의 땅이 흔들리다", token: "흔들리다", archetype: "RESONANCE", stageZone: "ZONE_B_INLAND" },
  "地動": { displayKo: "궁궐과 도성이 진동하다", token: "진동하다", archetype: "RESONANCE", stageZone: "ZONE_B_INLAND" },
  "聲如雷": { displayKo: "소리가 우레와 같다", token: "울다", archetype: "RESONANCE", stageZone: "ZONE_B_INLAND" },
  "漢山地震": { displayKo: "한산의 대지가 흔들리다", token: "흔들리다", archetype: "RESONANCE", stageZone: "ZONE_B_INLAND" },
  "泉涌": { displayKo: "땅이 갈라져 샘이 솟다", token: "솟구치다", archetype: "EXPOSE", stageZone: "ZONE_A_OCEAN" },
  "京都地震": { displayKo: "서라벌 도성이 흔들리다", token: "흔들리다", archetype: "RESONANCE", stageZone: "ZONE_B_INLAND" },
  "民屋倒وم": { displayKo: "민가가 쓰러져 무너지다", token: "무너지다", archetype: "FRACTURE", stageZone: "ZONE_B_INLAND" },
  "民屋倒墮": { displayKo: "민가가 쓰러져 무너지다", token: "무너지다", archetype: "FRACTURE", stageZone: "ZONE_B_INLAND" },
  "地陷": { displayKo: "땅이 꺼져 내려앉다", token: "가라앉다", archetype: "EXPOSE", stageZone: "ZONE_B_INLAND" },
  "地裂廣五尺": { displayKo: "땅이 다섯 자나 갈라지다", token: "갈라지다", archetype: "FRACTURE", stageZone: "ZONE_B_INLAND" },
  "地裂泉涌": { displayKo: "땅이 찢어져 샘물이 솟다", token: "솟구치다", archetype: "EXPOSE", stageZone: "ZONE_A_OCEAN" },
  "彌勒寺塔震": { displayKo: "미륵사 석탑이 흔들리다", token: "흔들리다", archetype: "RESONANCE", stageZone: "ZONE_B_INLAND" },
  "京都大震": { displayKo: "도성이 크게 진동하다", token: "진동하다", archetype: "RESONANCE", stageZone: "ZONE_B_INLAND" },
  "民屋壞": { displayKo: "민가가 무너져 내리다", token: "무너지다", archetype: "FRACTURE", stageZone: "ZONE_B_INLAND" },
  "死者百餘人": { displayKo: "백여 명이 목숨을 잃다", token: "스러지다", archetype: "FRACTURE", stageZone: "ZONE_B_INLAND" },

  // Goryeosa (971 – 1385)
  "京城地震": { displayKo: "개경 도성이 진동하다", token: "진동하다", archetype: "RESONANCE", stageZone: "ZONE_B_INLAND" },
  "東京管內地震": { displayKo: "동경과 경상 땅이 흔들리다", token: "흔들리다", archetype: "RESONANCE", stageZone: "ZONE_B_INLAND" },
  "城屋頹毁": { displayKo: "성곽과 가옥이 무너지다", token: "무너지다", archetype: "FRACTURE", stageZone: "ZONE_C_MOUNTAIN" },
  "屋瓦皆飛": { displayKo: "기와가 물결처럼 날다", token: "날다", archetype: "FRACTURE", stageZone: "ZONE_B_INLAND" },
  "人不能立": { displayKo: "사람이 서지 못하고 넘어지다", token: "넘어지다", archetype: "RESONANCE", stageZone: "ZONE_B_INLAND" },
  "金海府大震": { displayKo: "김해 땅이 크게 흔들리다", token: "흔들리다", archetype: "RESONANCE", stageZone: "ZONE_B_INLAND" },
  "墻屋頹圮": { displayKo: "담장과 가옥이 무너지다", token: "무너지다", archetype: "FRACTURE", stageZone: "ZONE_B_INLAND" },
  "墻垣頹圮": { displayKo: "담장이 무너져 내리다", token: "무너지다", archetype: "FRACTURE", stageZone: "ZONE_B_INLAND" },
  "松嶽崩": { displayKo: "송악산 바위가 무너지다", token: "무너지다", archetype: "FRACTURE", stageZone: "ZONE_C_MOUNTAIN" },

  // Joseon Wangjo Sillok & Seungjeongwon Ilgi & Ilseongnok (1405 – 1898)
  "屋宇動搖": { displayKo: "가옥이 크게 흔들리다", token: "흔들리다", archetype: "RESONANCE", stageZone: "ZONE_B_INLAND" },
  "墻屋頹落": { displayKo: "담장과 가옥이 무너지다", token: "무너지다", archetype: "FRACTURE", stageZone: "ZONE_B_INLAND" },
  "聲如怒雷": { displayKo: "소리가 성난 우레 같다", token: "울다", archetype: "RESONANCE", stageZone: "ZONE_B_INLAND" },
  "墻屋城堞頹落": { displayKo: "담장과 성첩이 무너지다", token: "무너지다", archetype: "FRACTURE", stageZone: "ZONE_C_MOUNTAIN" },
  "屋宇頹毁": { displayKo: "가옥이 무너져 내리다", token: "무너지다", archetype: "FRACTURE", stageZone: "ZONE_B_INLAND" },
  "地坼水涌": { displayKo: "땅이 갈라져 물이 솟다", token: "솟구치다", archetype: "EXPOSE", stageZone: "ZONE_A_OCEAN" },
  "地坼水湧": { displayKo: "땅이 갈라져 물이 솟다", token: "솟구치다", archetype: "EXPOSE", stageZone: "ZONE_A_OCEAN" },
  "地裂湧水": { displayKo: "땅이 갈라져 물이 솟다", token: "솟구치다", archetype: "EXPOSE", stageZone: "ZONE_B_INLAND" },
  "地坼湧水": { displayKo: "땅이 갈라져 물이 솟다", token: "솟구치다", archetype: "EXPOSE", stageZone: "ZONE_A_OCEAN" },
  "白沙湧出": { displayKo: "흰 모래가 솟아 나오다", token: "솟구치다", archetype: "EXPOSE", stageZone: "ZONE_A_OCEAN" },
  "城堞頹落": { displayKo: "성첩이 무너져 내리다", token: "무너지다", archetype: "FRACTURE", stageZone: "ZONE_C_MOUNTAIN" },
  "城堞頹毁": { displayKo: "읍성 성첩이 무너지다", token: "무너지다", archetype: "FRACTURE", stageZone: "ZONE_C_MOUNTAIN" },
  "城堞多頹": { displayKo: "성첩이 많이 무너지다", token: "무너지다", archetype: "FRACTURE", stageZone: "ZONE_C_MOUNTAIN" },
  "聲如大砲": { displayKo: "소리가 대포와 같다", token: "울다", archetype: "RESONANCE", stageZone: "ZONE_B_INLAND" },
  "聲如大雷": { displayKo: "소리가 큰 우레와 같다", token: "울다", archetype: "RESONANCE", stageZone: "ZONE_B_INLAND" },
  "聲如遠雷": { displayKo: "소리가 먼 우레 같다", token: "울다", archetype: "RESONANCE", stageZone: "ZONE_A_OCEAN" },
  "巖石崩落": { displayKo: "암석이 무너져 떨어지다", token: "무너지다", archetype: "FRACTURE", stageZone: "ZONE_C_MOUNTAIN" },
  "瓦礫自落": { displayKo: "기와가 저절로 떨어지다", token: "떨어지다", archetype: "FRACTURE", stageZone: "ZONE_B_INLAND" },
  "山崩塞川": { displayKo: "산이 무너져 내를 막다", token: "무너지다", archetype: "FRACTURE", stageZone: "ZONE_C_MOUNTAIN" },
  "水溢": { displayKo: "강물이 범람하여 넘치다", token: "넘치다", archetype: "RECEDE", stageZone: "ZONE_A_OCEAN" },
  "石垣多頹": { displayKo: "돌담이 많이 무너지다", token: "무너지다", archetype: "FRACTURE", stageZone: "ZONE_B_INLAND" },
  "窓戶搖動": { displayKo: "창호가 크게 흔들리다", token: "흔들리다", archetype: "RESONANCE", stageZone: "ZONE_B_INLAND" },
  "民家頹壓": { displayKo: "민가가 무너져 덮치다", token: "무너지다", archetype: "FRACTURE", stageZone: "ZONE_B_INLAND" },
  "死者數十人": { displayKo: "수십 명이 깔려 숨지다", token: "스러지다", archetype: "FRACTURE", stageZone: "ZONE_B_INLAND" },
  "屋宇微動": { displayKo: "가옥이 미세하게 흔들리다", token: "흔들리다", archetype: "RESONANCE", stageZone: "ZONE_B_INLAND" },
  "八道地震": { displayKo: "팔도에 지진이 일어나다", token: "진동하다", archetype: "RESONANCE", stageZone: "ZONE_B_INLAND" },
  "京城尤甚": { displayKo: "도성이 더욱 심하게 흔들리다", token: "흔들리다", archetype: "RESONANCE", stageZone: "ZONE_B_INLAND" }
};

export const HANJA_TO_HANGUL_MAP = {
  "墻屋頹圮": "담장과 가옥이 무너지다",
  "頹圮": "무너져 내리다",
  "倒壞": "쓰러져 무너지다",
  "崩壞": "거암이 무너지다",
  "山崩": "산이 무너지다",
  "地裂": "땅이 갈라지다",
  "地動": "대지가 진동하다",
  "地震": "땅이 흔들리다",
  "退潮": "바닷물이 물러나다",
  "海溢": "바닷물이 넘치다",
  "湧出": "물이 솟구치다",
  "鳴響": "지하가 울리다",
  "聲如雷": "소리가 우레와 같다",
  "如雷": "우레 같은 소리",
  "轟然": "우르릉 울리다",
  "振動": "산악이 진동하다",
  "搖動": "크게 흔들리다",
  "大震": "대지가 크게 울리다",
  "陷沒": "땅이 내려앉다",
  "沈沒": "물속에 잠기다"
};

/**
 * Verbatim Chronicle Clause Extractor
 * Directly splits a historical chronicle or instrumental record (`originalTranslationKo`, `translationKo`, `originalScript`)
 * into its constituent clauses as-is (`그대로`), removing only framing prefixes and parenthetical notes.
 */
export function extractVerbatimChronicleClauses(rawText, allowNative = false) {
  if (!rawText || typeof rawText !== "string") return [];
  let text = rawText
    .replace(/\s*\([^\)]*\)/g, "") // remove parenthetical notes like (서기 2년), (금성)
    .replace(/^(?:강원도 도신이 아뢰기를|강원감사의 장계에|경상감사의 장계에 이르기를|비변사에서 아뢰기를)\s*,?\s*/g, "")
    .replace(/^["'「『]|["'」』]$/g, "")
    .trim();

  if (!allowNative) {
    text = text.replace(/[\u4e00-\u9fff]/g, "").replace(/\s+/g, " ").trim();
  }

  // Remove leading date stamps if followed by spaces (e.g., "2016년 4월 16일 ", "2023년 2월 6일 ")
  text = text.replace(/^\d{4}년\s*\d{1,2}월\s*\d{1,2}일\s*/g, "").trim();

  // Split by sentence/clause boundaries first
  const primaryParts = text
    .split(/(?:\.\s+|\.$|,\s+|;\s+|—\s+)/)
    .map(s => s.replace(/[.。]+$/g, "").trim())
    .filter(s => s.length >= 2);

  const clauses = [];
  for (const part of primaryParts) {
    if (part.length <= 28) {
      clauses.push(part);
    } else {
      // Split longer compound clauses at natural Korean connective endings while keeping the ending intact
      const subParts = part
        .split(/(?<=(?:고|며|니|더니|하여|에서|으로|따라))\s+/)
        .map(s => s.trim())
        .filter(s => s.length >= 2);
      if (subParts.length > 1) {
        clauses.push(...subParts);
      } else {
        clauses.push(part);
      }
    }
  }
  return clauses;
}

/**
 * Extracts and returns the verbatim chronicle expression from a lexicon entry or raw token.
 * Never lumps or paraphrases into abstract 4-word labels (`퇴조`, `드러나다`, `울다`, `무너지다`).
 */
export function distillArchivalExpression(entryOrToken, category = "resonance", fallback = "") {
  if (!entryOrToken) return fallback || "땅이 진동하였으며";

  if (typeof entryOrToken === "object") {
    if (entryOrToken.displayKo && typeof entryOrToken.displayKo === "string") {
      const cleanDisp = entryOrToken.displayKo
        .replace(/\s*\([^\)]*\)/g, "")
        .replace(/[\u4e00-\u9fff]/g, "")
        .replace(/[.。]+$/g, "")
        .trim();
      if (cleanDisp.length >= 2) return cleanDisp;
    }
    if (entryOrToken.translation && typeof entryOrToken.translation === "string") {
      const extracted = extractVerbatimChronicleClauses(entryOrToken.translation, false);
      if (extracted.length > 0) return extracted[0];
    }
    if (entryOrToken.token && ARCHIVAL_HANJA_LEXICON_DB[entryOrToken.token]) {
      return ARCHIVAL_HANJA_LEXICON_DB[entryOrToken.token].displayKo;
    }
    return sanitizeArchivalToken(entryOrToken.token, entryOrToken.category || category, fallback);
  }

  return sanitizeArchivalToken(String(entryOrToken), category, fallback);
}

export function sanitizeArchivalToken(rawToken, category = "resonance", fallback = "") {
  if (!rawToken || typeof rawToken !== 'string') return fallback || "땅이 진동하였으며";
  const trimmed = rawToken.trim();

  if (ARCHIVAL_HANJA_LEXICON_DB[trimmed]) {
    return ARCHIVAL_HANJA_LEXICON_DB[trimmed].displayKo;
  }

  let token = trimmed
    .replace(/\s*\([^\)]*\)/g, '')
    .replace(/[\u4e00-\u9fff]/g, '')
    .replace(/[.。]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (token.length >= 2) {
    return token;
  }

  for (const [hanja, spec] of Object.entries(ARCHIVAL_HANJA_LEXICON_DB)) {
    if (trimmed.includes(hanja)) return spec.displayKo;
  }
  if (HANJA_TO_HANGUL_MAP[trimmed]) return HANJA_TO_HANGUL_MAP[trimmed];
  for (const [hanja, hangul] of Object.entries(HANJA_TO_HANGUL_MAP)) {
    if (trimmed.includes(hanja)) return hangul;
  }

  return fallback || "땅이 진동하였으며";
}

/**
 * Archival Semantic Parser
 * Parses Historical Chronicles & Instrumental Reports into Structured Semantic Units
 */
export class ArchivalSemanticParser {
  constructor(historicalEvents = [], sourceRecords = [], eventSourceLinks = [], instrumentalEvents = []) {
    this.historicalEvents = historicalEvents;
    this.sourceRecords = sourceRecords;
    this.eventSourceLinks = eventSourceLinks;
    this.instrumentalEvents = instrumentalEvents;
    this.recordMap = new Map(this.sourceRecords.map(r => [r.recordId, r]));
    // MANDATORY ARTISTIC DIRECTIVE: Pure Korean Archival Mode is the permanent exhibition aesthetic
    this.displayMode = 'korean';
  }

  addInstrumentalEvents(events = []) {
    if (Array.isArray(events)) {
      for (const ev of events) {
        const id = ev.id || ev.eventId;
        if (id && !this.instrumentalEvents.some(e => (e.id === id || e.eventId === id))) {
          this.instrumentalEvents.push(ev);
        }
      }
    }
  }

  setDisplayMode(mode) {
    this.displayMode = mode === 'native' ? 'native' : 'korean';
  }

  parseEvent(eventId) {
    if (eventId === 'hist_1681_yangyang' || eventId === '1681' || eventId === '1681_yangyang') eventId = 'hist_1681_0626';
    if (eventId === 'inst_2016_gyeongju') eventId = 'hist_2016_gyeongju';
    if (eventId === 'inst_2017_pohang') eventId = 'hist_2017_pohang';

    let histEv = this.historicalEvents.find(e => (e.eventId === eventId || e.id === eventId));
    let instEv = null;

    if (!histEv) {
      instEv = this.instrumentalEvents.find(e => (e.eventId === eventId || e.id === eventId));
    }

    if (!histEv && !instEv) {
      histEv = this.historicalEvents.find(e => (e.id && e.id.includes(eventId)) || (e.eventId && e.eventId.includes(eventId)));
      if (!histEv) {
        instEv = this.instrumentalEvents.find(e => (e.id && e.id.includes(eventId)) || (e.eventId && e.eventId.includes(eventId)));
      }
    }

    if (!histEv && !instEv) {
      throw new Error(`[ArchivalSemanticParser] Event '${eventId}' not found in database.`);
    }

    if (histEv) {
      return this._parseHistoricalEvent(histEv);
    } else {
      return this._parseInstrumentalEvent(instEv);
    }
  }

  _parseHistoricalEvent(ev) {
    const links = this.eventSourceLinks.filter(l => l.eventId === ev.eventId);
    const records = links.map(l => this.recordMap.get(l.recordId)).filter(Boolean);

    const phenomenaSet = new Set();
    records.forEach(r => {
      if (Array.isArray(r.phenomenaTags)) {
        r.phenomenaTags.forEach(tag => phenomenaSet.add(tag));
      }
    });

    let lat = null;
    let lon = null;
    const isUnresolved = ev.interpretations?.[0]?.epicenter?.isUnresolved === true || 
                         (ev.lat && ev.lat.v === null && ev.lat.ver === 'unknown') ||
                         (ev.spatial?.inferredCoordinates?.lat == null && ev.interpretations?.[0]?.epicenter?.lat == null && ev.placeMappings?.[0]?.representativeCoords?.lat == null && ev.lat?.v == null);

    if (!isUnresolved) {
      if (typeof ev.lat === 'number') lat = ev.lat;
      else if (ev.lat && typeof ev.lat.v === 'number') lat = ev.lat.v;
      else if (ev.spatial?.inferredCoordinates?.lat != null) lat = Number(ev.spatial.inferredCoordinates.lat);
      else if (ev.interpretations?.[0]?.epicenter?.lat != null) lat = Number(ev.interpretations[0].epicenter.lat);
      else if (ev.placeMappings?.[0]?.representativeCoords?.lat != null) lat = Number(ev.placeMappings[0].representativeCoords.lat);

      if (typeof ev.lon === 'number') lon = ev.lon;
      else if (ev.lon && typeof ev.lon.v === 'number') lon = ev.lon.v;
      else if (ev.spatial?.inferredCoordinates?.lon != null) lon = Number(ev.spatial.inferredCoordinates.lon);
      else if (ev.interpretations?.[0]?.epicenter?.lon != null) lon = Number(ev.interpretations[0].epicenter.lon);
      else if (ev.placeMappings?.[0]?.representativeCoords?.lon != null) lon = Number(ev.placeMappings[0].representativeCoords.lon);
    }
    const mag = ev.scientificEstimates?.[0]?.estimatedMag ?? ev.interpretations?.[0]?.estimatedMagnitude?.best ?? (ev.mag?.v ?? (ev.macroseismic?.maxIntensityMMI?.numericEquivalent ? (ev.macroseismic.maxIntensityMMI.numericEquivalent * 0.6 + 1.5) : 6.5));
    const depth = ev.spatial?.focalDepth?.valKm ?? ev.interpretations?.[0]?.focalDepth?.valKm ?? 12.0;

    let semanticUnits = this._extractHistoricalSemanticUnits(ev, records);
    let compositionProfileStatus = (ev.eventId === "hist_1681_0626")
      ? "PROFILE_APPLIED_1681_YANGYANG"
      : `PROFILE_APPLIED_HISTORICAL_${ev.eventId.toUpperCase()}`;

    const dominantFreq = (ev.eventId === "hist_1681_0626") ? 1.0 : Math.max(0.2, Math.min(2.5, 1.8 * Math.pow(10.0, -0.22 * (mag - 5.0))));
    const q = (ev.eventId === "hist_1681_0626") ? 250.0 : (ev.macroseismic?.tsunamiObserved ? 260.0 : 220.0);
    const dispScale = (ev.eventId === "hist_1681_0626") ? 1.2 : Math.max(0.6, Math.min(2.2, 0.4 + (mag - 5.0) * 0.4));
    const verifiedSourceCount = semanticUnits.filter(u => u.source?.evidenceStatus === "VERIFIED_SOURCE" || u.evidenceClass === "DIRECT_QUOTATION" || u.evidenceClass === "SOURCE_TRANSLATION").length;
    const editorialInterpretationCount = semanticUnits.filter(u => u.source?.evidenceStatus === "EDITORIAL_INTERPRETATION" || u.evidenceClass === "EDITORIAL_DISTILLATION").length;

    const rawDateText = ev.dateText || ev.dateConversion?.gregorianDateISO || (ev.dateConversion?.gregorianYear ? `${ev.dateConversion.gregorianYear}년` : (ev.date?.gregorianYear ? `${ev.date.gregorianYear}년` : "연대 미상"));
    const cleanDateText = (rawDateText || '').replace(/\s*\([^\)]*[\u4e00-\u9fff][^\)]*\)/g, '').replace(/[\u4e00-\u9fff]/g, '').trim();

    return {
      ...ev,
      eventId: ev.eventId,
      recordType: "historical",
      dynasty: ev.dynasty || "JOSEON",
      century: ev.century || 17,
      sourceName: ev.sourceName || (records[0]?.volumeOrSection ? `${records[0].volumeOrSection}` : "조선왕조실록 · 승정원일기"),
      title: ev.place || ev.titleKo || ev.titles?.ko || ev.canonicalName || "역사 사료 지진",
      titleKo: (ev.titleKo || ev.titles?.ko || ev.place || ev.canonicalName || (ev.dateConversion?.gregorianYear ? `${ev.dateConversion.gregorianYear}년 사료 지진` : "역사 사료 지진")).replace(/[\u4e00-\u9fff]/g, '').trim(),
      archivalText: ev.primaryText?.originalScript || ev.text || ev.originalText || "",
      dateText: cleanDateText,
      dateStr: ev.dateStr || ev.dateConversion?.gregorianDateISO || "1681-06-26",
      era: "ERA_1_HISTORICAL",
      sourceRecordCount: records.length,
      extractedSemanticUnitCount: semanticUnits.length,
      verifiedSourceCount,
      editorialInterpretationCount,
      phenomenaTags: Array.from(phenomenaSet),
      selectedKineticArchetypes: Array.from(new Set(semanticUnits.map(u => u.kinetic?.archetype || 'RESONANCE'))),
      lat: lat,
      lon: lon,
      isUncertainCoordinates: (lat == null || lon == null),
      spatialCoords: { lat, lon, depthKm: depth },
      sceneEpicenter: (typeof THREE !== 'undefined' && THREE.Vector2) ? new THREE.Vector2(0.0, 0.03365) : { x: 0, y: 0.03365 },
      focalDepthKm: depth,
      dominantFreqHz: dominantFreq,
      attenuationQ: q,
      displacementScale: dispScale,
      faultStrikeRad: 1.309,
      compositionProfileStatus,
      semanticUnits
    };
  }

  _extractHistoricalSemanticUnits(ev, records) {
    const units = [];
    const seenDisplays = new Set();
    const candidateEntries = [];

    // 1. First collect all verbatim chronicle entries from all linked SourceRecords' archivalLexicon
    for (const rec of records) {
      if (Array.isArray(rec.archivalLexicon)) {
        for (const lex of rec.archivalLexicon) {
          candidateEntries.push({
            ...lex,
            recordId: rec.recordId,
            volumeOrSection: rec.volumeOrSection,
            originalHanja: rec.originalHanja,
            originalTranslationKo: rec.originalTranslationKo
          });
        }
      }
    }
    // 2. Fallback: if a record had no archivalLexicon, directly extract clauses from its originalTranslationKo
    for (const rec of records) {
      if ((!Array.isArray(rec.archivalLexicon) || rec.archivalLexicon.length === 0) && rec.originalTranslationKo) {
        const directClauses = extractVerbatimChronicleClauses(rec.originalTranslationKo, false);
        for (const cl of directClauses) {
          candidateEntries.push({
            token: cl,
            displayKo: cl,
            category: /바닷물|조수|해일|물이|샘물/.test(cl) ? "water" : /소리|우레|울고|울리/.test(cl) ? "sound" : /무너|붕괴|갈라|파손|죽은/.test(cl) ? "structure" : "shaking",
            recordId: rec.recordId,
            volumeOrSection: rec.volumeOrSection,
            originalHanja: rec.originalHanja,
            originalTranslationKo: rec.originalTranslationKo,
            translation: cl
          });
        }
      }
    }
    if (Array.isArray(ev.archivalLexicon)) {
      for (const lex of ev.archivalLexicon) {
        candidateEntries.push({
          ...lex,
          recordId: lex.sourceRecordId || records[0]?.recordId || `rec_${ev.eventId}`,
          volumeOrSection: lex.sourceVolume || ev.primaryText?.documentSource || records[0]?.volumeOrSection || "역사 사료 기록",
          originalHanja: ev.primaryText?.originalScript || records[0]?.originalHanja || lex.token,
          originalTranslationKo: ev.text || records[0]?.originalTranslationKo || lex.translation
        });
      }
    }

    const hasOcean = ev.terrainContext?.hasOcean !== false &&
                     ev.terrainConfig?.hasOcean !== false &&
                     ev.hasOcean !== false &&
                     !ev.eventId?.includes("1338");

    const ANCHOR_RING = [
      { worldX: -0.055, worldZ: 0.032 },
      { worldX: 0.052, worldZ: -0.018 },
      { worldX: -0.024, worldZ: -0.034 },
      { worldX: 0.068, worldZ: 0.028 },
      { worldX: -0.072, worldZ: -0.012 },
      { worldX: 0.018, worldZ: 0.044 },
      { worldX: -0.042, worldZ: 0.015 },
      { worldX: 0.038, worldZ: -0.038 },
      { worldX: -0.062, worldZ: -0.028 },
      { worldX: 0.028, worldZ: 0.022 }
    ];

    const maxUnits = (ev.eventId === "hist_1681_0626") ? 10 : 6;

    for (const entry of candidateEntries) {
      if (units.length >= maxUnits) break;
      const displayKo = distillArchivalExpression(entry, entry.category || "resonance");
      if (!displayKo || seenDisplays.has(displayKo)) continue;
      if (!hasOcean && (entry.stageZone === "ZONE_A_OCEAN" || entry.category === "water") && /바닷물|해수|조수|해일/.test(displayKo)) {
        continue;
      }
      seenDisplays.add(displayKo);

      const idx = units.length;
      const dbSpec = ARCHIVAL_HANJA_LEXICON_DB[entry.token] || null;

      let archetype = entry.archetype || dbSpec?.archetype || "RESONANCE";
      if (!entry.archetype && !dbSpec) {
        if (entry.category === "water" || /물러|해일|넘치|범람|넘어왔|밀려왔/.test(displayKo)) archetype = "RECEDE";
        else if (/솟구치|솟다|솟아|드러나|꺼져|내려앉|모래/.test(displayKo)) archetype = "EXPOSE";
        else if (entry.category === "structure" || entry.category === "geology" || /무너|붕괴|갈라|찢어|떨어|날아|파손|죽은|압사/.test(displayKo)) archetype = "FRACTURE";
        else archetype = "RESONANCE";
      }

      let stageZone = entry.stageZone || dbSpec?.stageZone || "ZONE_B_INLAND";
      if (!hasOcean && stageZone === "ZONE_A_OCEAN") {
        stageZone = "ZONE_B_INLAND";
      } else if (hasOcean && /바닷물|조수|해일|언덕을 넘어/.test(displayKo)) {
        stageZone = "ZONE_A_OCEAN";
      } else if (/산이|설악|바위가|거암|절벽|성첩|산사태/.test(displayKo)) {
        stageZone = "ZONE_C_MOUNTAIN";
      }

      // Output the extracted chronicle clause AS-IS in both token and displayText (no lumping!)
      const verbatimPhrase = displayKo;
      const nativePhrase = entry.nativeText || entry.token || verbatimPhrase;
      const activeText = (this.displayMode === 'native' && entry.nativeText) ? nativePhrase : verbatimPhrase;

      const isHanjaSource = /[\u4e00-\u9fff]/.test(entry.originalHanja || entry.token || "");
      const evidenceClass = isHanjaSource ? "SOURCE_TRANSLATION" : "DIRECT_QUOTATION";
      const materialAdapter = archetype === "RECEDE"
        ? "WATER_SURFACE_SWELL"
        : archetype === "FRACTURE"
          ? "FRACTURED_DEBRIS_FALL"
          : archetype === "EXPOSE"
            ? "UPRIGHT_BATHYMETRIC_BILLBOARD"
            : "BEDROCK_VIBRATION";

      const preferredType = stageZone === "ZONE_A_OCEAN"
        ? "coastal_shelf"
        : stageZone === "ZONE_C_MOUNTAIN"
          ? "mountain_ridge"
          : "inland_basin";

      const spatialMotif = stageZone === "ZONE_A_OCEAN"
        ? "ZONE_OCEAN_SHELF"
        : stageZone === "ZONE_C_MOUNTAIN"
          ? "ZONE_ALPINE_RIDGE"
          : "ZONE_INLAND_BASIN";

      const stepSec = maxUnits > 6 ? 3.1 : 4.2;
      const t_act = Number((2.4 + idx * stepSec).toFixed(1));
      const anchor = ANCHOR_RING[idx % ANCHOR_RING.length];

      units.push({
        id: `unit_${ev.eventId}_${idx + 1}`,
        eventId: ev.eventId,
        token: activeText,
        tokenKo: verbatimPhrase,
        tokenNative: nativePhrase,
        phraseKo: verbatimPhrase,
        phraseNative: nativePhrase,
        sourceId: entry.recordId || `rec_${ev.eventId}_${idx + 1}`,
        originalPassage: entry.originalHanja || entry.token || verbatimPhrase,
        translation: entry.originalTranslationKo || entry.translation || verbatimPhrase,
        evidenceClass,
        editorialRationale: `${entry.volumeOrSection || "역사 사료"} 사료 문장('${verbatimPhrase}') 원문 그대로 추출`,
        confidence: "HIGH_PRIMARY_CHRONICLE",
        spatialMotif,
        source: {
          originalHanja: entry.originalHanja || entry.token || verbatimPhrase,
          originalText: entry.token || verbatimPhrase,
          originalTranslationKo: entry.originalTranslationKo || entry.translation || verbatimPhrase,
          evidenceStatus: evidenceClass === "DIRECT_QUOTATION" ? "VERIFIED_SOURCE" : "SOURCE_TRANSLATION",
          evidenceClass,
          sourceReference: entry.volumeOrSection || ev.primaryText?.documentSource || "역사 사료 기록",
          confidence: "HIGH_PRIMARY_CHRONICLE"
        },
        semantic: {
          semanticLabel: entry.category || "사료기록",
          displayText: activeText,
          phenomenaTags: Array.isArray(records[0]?.phenomenaTags) ? records[0].phenomenaTags : ["GROUND_SHAKING"]
        },
        spatial: {
          stageZone,
          preferredType,
          elevationOffset: 0.040 + (idx % 3) * 0.005,
          anchorHint: anchor
        },
        kinetic: {
          archetype,
          materialAdapter
        },
        timing: {
          t_activation: t_act,
          formationDuration: 0.9,
          minLegibilityDuration: 1.5,
          resonanceDuration: 1.5,
          dissolutionDuration: 1.2,
          residueDuration: 0.8
        },
        visual: {
          archetype,
          fontFamily: '"Noto Serif KR", "Nanum Myeongjo", Batang, serif',
          fontSize: 78,
          canvasW: 2048,
          canvasH: 384,
          spriteW: 0.235,
          spriteH: 0.062,
          colorSecondary: archetype === "RECEDE" ? "#c8e8fc" : archetype === "FRACTURE" ? "#e2eefa" : "#cde4fe",
          haloColor: "rgba(160, 215, 255, 0.40)"
        }
      });
    }

    return units;
  }

  _parseInstrumentalEvent(ev) {
    const lat = ev.lat?.v ?? ev.lat ?? ev.spatial?.inferredCoordinates?.lat ?? ev.spatial?.latitude ?? 35.76;
    const lon = ev.lon?.v ?? ev.lon ?? ev.spatial?.inferredCoordinates?.lon ?? ev.spatial?.longitude ?? 129.19;
    const mag = ev.mag?.v ?? ev.mag ?? ev.scientificParams?.magnitude?.value ?? ev.scientificEstimates?.[0]?.estimatedMag ?? 5.8;
    const depth = ev.depth?.v ?? ev.depth ?? ev.spatial?.focalDepth?.valKm ?? ev.spatial?.depthKm ?? 10.0;

    const semanticUnits = this._extractInstrumentalSemanticUnits(ev);
    const profileStatus = `PROFILE_APPLIED_${ev.eventId.toUpperCase()}`;

    let dominantFreq = 1.2;
    let q = 220.0;
    let dispScale = 1.0;
    let strikeRad = 0.0;
    const sceneEpi = (typeof THREE !== 'undefined' && THREE.Vector2) ? new THREE.Vector2(0.0, 0.0) : { x: 0, y: 0 };

    if (ev.eventId === 'hist_2016_gyeongju') {
      dominantFreq = 1.2;
      q = 220.0;
      dispScale = 0.95;
      strikeRad = 0.453; // N26°E Yangsan Fault strike
    } else if (ev.eventId === 'hist_2017_pohang') {
      dominantFreq = 1.47;
      q = 140.0;
      dispScale = 0.85;
      strikeRad = 0.785; // N45°E Gokgang Fault branch
    } else if (ev.eventId === 'global_2016_kumamoto') {
      dominantFreq = 0.65;
      q = 180.0;
      dispScale = 1.4;
      strikeRad = 1.047; // Futagawa-Hinagu fault strike
    } else if (ev.eventId === 'global_2023_turkey') {
      dominantFreq = 0.44;
      q = 320.0;
      dispScale = 2.2;
      strikeRad = 0.524; // East Anatolian Fault strike
    } else if (ev.eventId === 'global_2011_tohoku') {
      dominantFreq = 0.22;
      q = 360.0;
      dispScale = 2.5;
      strikeRad = 3.54; // Strike 203° (Japan Trench megathrust)
    } else {
      dominantFreq = Math.max(0.2, Math.min(2.5, 1.8 * Math.pow(10.0, -0.22 * (mag - 5.0))));
      q = 200.0;
      dispScale = Math.max(0.6, Math.min(2.0, 0.4 + (mag - 5.0) * 0.4));
      strikeRad = 0.5;
    }

    const phenomenaSet = new Set();
    semanticUnits.forEach(u => {
      (u.semantic?.phenomenaTags || []).forEach(tag => phenomenaSet.add(tag));
    });

    const verifiedSourceCount = semanticUnits.filter(u => u.evidenceClass === 'DIRECT_QUOTATION' || u.source?.evidenceStatus === 'VERIFIED_SOURCE' || u.confidence === 'VERIFIED_INSTRUMENTAL').length;
    const editorialInterpretationCount = semanticUnits.filter(u => u.evidenceClass === 'EDITORIAL_DISTILLATION' || u.source?.evidenceStatus === 'EDITORIAL_INTERPRETATION').length;

    return {
      ...ev,
      id: ev.id || ev.eventId,
      eventId: ev.eventId || ev.id,
      century: ev.century || (ev.temporal?.gregorianDate ? Math.floor(parseInt(ev.temporal.gregorianDate.substring(0, 4), 10) / 100) + 1 : 21),
      catalogType: ev.catalogType || "INSTRUMENTAL_GLOBAL",
      recordType: ev.recordType || "instrumental-global",
      country: ev.country || "GLOBAL",
      title: ev.place || ev.canonicalName || ev.titles?.ko || "계측 지진",
      titleKo: ev.place || ev.canonicalName || ev.titles?.ko || "계측 지진",
      archivalText: ev.primaryText?.originalScript || ev.text || ev.originalText || "",
      dateStr: ev.dateStr || ev.dateText || ev.temporal?.gregorianDate || "2016-09-12",
      dateText: ev.dateText || ev.dateStr || ev.temporal?.gregorianDate || "2016-09-12",
      era: "ERA_2_INSTRUMENTAL",
      sourceRecordCount: semanticUnits.length,
      extractedSemanticUnitCount: semanticUnits.length,
      verifiedSourceCount,
      editorialInterpretationCount,
      phenomenaTags: Array.from(phenomenaSet),
      selectedKineticArchetypes: Array.from(new Set(semanticUnits.map(u => u.kinetic?.archetype || 'RESONANCE'))),
      lat: lat,
      lon: lon,
      isUncertainCoordinates: (lat == null || lon == null),
      spatialCoords: { lat, lon, depthKm: depth },
      sceneEpicenter: sceneEpi,
      focalDepthKm: depth,
      depth: (typeof ev.depth === 'object' && ev.depth !== null) ? ev.depth : { valKm: depth, v: depth, unit: 'km', isKnown: true },
      mag: (typeof ev.mag === 'object' && ev.mag !== null) ? ev.mag : { v: mag, val: mag, type: ev.magType || 'Mw' },
      magType: ev.magType || 'Mw',
      dominantFreqHz: dominantFreq,
      attenuationQ: q,
      displacementScale: dispScale,
      faultStrikeRad: strikeRad,
      scientificEstimates: Array.isArray(ev.scientificEstimates) ? ev.scientificEstimates : [{ source: "USGS / ISC", estimatedMag: mag, magType: ev.magType || 'Mw' }],
      magnitude: mag,
      compositionProfileStatus: profileStatus,
      semanticUnits: semanticUnits,
      isInstrumental: true
    };
  }

  _buildStyledInstrumentalUnits(eventId, specs) {
    return specs.map(sp => ({
      id: sp.id,
      eventId: eventId,
      token: sp.token,
      nativeToken: sp.nativeToken,
      koreanToken: sp.koreanToken,
      originalLanguage: sp.originalLanguage || 'ko',
      sourceId: sp.sourceId,
      originalPassage: sp.originalPassage,
      translation: sp.translation,
      evidenceClass: sp.evidenceClass,
      editorialRationale: sp.editorialRationale,
      confidence: 'VERIFIED_INSTRUMENTAL',
      spatialMotif: sp.spatialMotif,
      source: {
        originalHanja: sp.originalPassage,
        originalText: sp.originalPassage,
        originalTranslationKo: sp.translation,
        evidenceStatus: sp.evidenceClass,
        evidenceClass: sp.evidenceClass,
        sourceReference: sp.sourceReference,
        confidence: 'VERIFIED_INSTRUMENTAL'
      },
      semantic: {
        semanticLabel: sp.semanticLabel,
        displayText: sp.displayText,
        phenomenaTags: sp.phenomenaTags
      },
      spatial: {
        stageZone: sp.stageZone,
        preferredType: sp.preferredType,
        anchorHint: sp.anchorHint,
        elevationOffset: 0.042
      },
      kinetic: {
        archetype: sp.archetype,
        materialAdapter: sp.materialAdapter
      },
      timing: {
        t_activation: sp.t_activation,
        formationDuration: 0.9,
        minLegibilityDuration: 1.6,
        resonanceDuration: 1.6,
        dissolutionDuration: 1.3,
        residueDuration: 0.9
      },
      visual: {
        archetype: sp.archetype,
        allowNativeScript: Boolean(sp.allowNativeScript),
        fontFamily: sp.allowNativeScript
          ? (sp.originalLanguage === 'ja' ? '"Noto Serif JP", "Yu Mincho", serif' : '"Times New Roman", "Georgia", serif')
          : '"Noto Serif KR", "Nanum Myeongjo", Batang, serif',
        fontSize: 82,
        canvasW: 2048,
        canvasH: 384,
        spriteW: 0.215,
        spriteH: 0.064,
        colorSecondary: sp.archetype === 'EXPOSE' ? '#bee2fc' : sp.archetype === 'FRACTURE' ? '#e4f0fc' : '#cde4fe',
        haloColor: 'rgba(160, 215, 255, 0.40)'
      }
    }));
  }

  _extractInstrumentalSemanticUnits(ev) {
    const units = [];
    const seenDisplays = new Set();
    const isKo = this.displayMode === 'korean';
    const docSource = ev.primaryText?.documentSource || ev.sourceName || "기상청 지진관측기록";
    const origLang = (ev.primaryText?.scriptLanguage || "").startsWith("ja")
      ? "ja"
      : (ev.primaryText?.scriptLanguage || "").startsWith("tr")
        ? "tr"
        : "ko";

    const candidateEntries = [];
    if (Array.isArray(ev.archivalLexicon) && ev.archivalLexicon.length > 0) {
      candidateEntries.push(...ev.archivalLexicon);
    } else {
      const rawChronicle = ev.primaryText?.translationKo || ev.primaryText?.originalScript || ev.text || "";
      if (rawChronicle) {
        const directClauses = extractVerbatimChronicleClauses(rawChronicle, false);
        for (const cl of directClauses) {
          candidateEntries.push({
            token: cl,
            displayKo: cl,
            category: /해역|바다|해일|액상화/.test(cl) ? "water" : /무너|붕괴|균열|파손|낙석|단층/.test(cl) ? "structure" : "phenomenon",
            translation: cl
          });
        }
      }
    }

    const ANCHOR_RING = [
      { worldX: -0.048, worldZ: 0.026 },
      { worldX: 0.050, worldZ: -0.018 },
      { worldX: -0.025, worldZ: -0.028 },
      { worldX: 0.058, worldZ: 0.030 },
      { worldX: -0.038, worldZ: 0.040 }
    ];

    for (const entry of candidateEntries) {
      if (units.length >= 4) break;
      const phraseKo = distillArchivalExpression(entry, entry.category || "resonance");
      if (!phraseKo || seenDisplays.has(phraseKo)) continue;
      seenDisplays.add(phraseKo);

      const phraseNative = entry.nativeText || entry.token || phraseKo;
      const activeText = (!isKo && entry.nativeText) ? phraseNative : phraseKo;

      const idx = units.length;
      const archetype = entry.archetype ||
        (entry.category === "water" ? "RECEDE" :
         (entry.category === "structure" || entry.category === "geology") ? "FRACTURE" : "RESONANCE");
      const stageZone = entry.stageZone || (entry.category === "water" ? "ZONE_A_OCEAN" : "ZONE_B_INLAND");
      const allowNativeScript = Boolean(!isKo && entry.nativeText);

      units.push({
        id: `unit_${ev.eventId}_${idx + 1}`,
        eventId: ev.eventId,
        token: activeText,
        tokenKo: phraseKo,
        tokenNative: phraseNative,
        phraseKo: phraseKo,
        phraseNative: phraseNative,
        nativeToken: phraseNative,
        koreanToken: phraseKo,
        originalLanguage: origLang,
        sourceId: `rec_${ev.eventId}_${idx + 1}`,
        originalPassage: ev.primaryText?.originalScript || entry.nativeText || entry.token || phraseKo,
        translation: entry.translation || ev.primaryText?.translationKo || ev.text || phraseKo,
        evidenceClass: "DIRECT_QUOTATION",
        editorialRationale: `${docSource} 원문 기록('${activeText}') 그대로 추출`,
        confidence: "VERIFIED_INSTRUMENTAL",
        spatialMotif: stageZone === "ZONE_A_OCEAN" ? "ZONE_OCEAN_SHELF" : stageZone === "ZONE_C_MOUNTAIN" ? "ZONE_ALPINE_RIDGE" : "ZONE_INLAND_BASIN",
        source: {
          originalHanja: ev.primaryText?.originalScript || entry.token || phraseKo,
          originalText: entry.nativeText || entry.token || phraseKo,
          originalTranslationKo: entry.translation || phraseKo,
          evidenceStatus: "VERIFIED_SOURCE",
          evidenceClass: "DIRECT_QUOTATION",
          sourceReference: docSource,
          confidence: "VERIFIED_INSTRUMENTAL"
        },
        semantic: {
          semanticLabel: entry.category || "관측기록",
          displayText: activeText,
          phenomenaTags: [archetype === "FRACTURE" ? "SURFACE_RUPTURE" : "GROUND_SHAKING"]
        },
        spatial: {
          stageZone,
          preferredType: stageZone === "ZONE_A_OCEAN" ? "coastal_shelf" : stageZone === "ZONE_C_MOUNTAIN" ? "mountain_ridge" : "inland_basin",
          anchorHint: ANCHOR_RING[idx % ANCHOR_RING.length],
          elevationOffset: 0.042 + idx * 0.004
        },
        kinetic: {
          archetype,
          materialAdapter: archetype === "FRACTURE" ? "FRACTURED_DEBRIS_FALL" : archetype === "RECEDE" ? "WATER_SURFACE_SWELL" : archetype === "EXPOSE" ? "UPRIGHT_BATHYMETRIC_BILLBOARD" : "BEDROCK_VIBRATION"
        },
        timing: {
          // Sequential non-overlapping activation: exactly one milestone active at any moment
          t_activation: Number((2.0 + idx * 6.5).toFixed(1)),
          formationDuration: 0.8,
          minLegibilityDuration: 1.5,
          resonanceDuration: 1.4,
          dissolutionDuration: 1.2,
          residueDuration: 0.6
        },
        visual: {
          archetype,
          allowNativeScript,
          fontFamily: allowNativeScript
            ? (origLang === 'ja' ? '"Noto Serif JP", "Yu Mincho", serif' : '"Times New Roman", "Georgia", serif')
            : '"Noto Serif KR", "Nanum Myeongjo", Batang, serif',
          fontSize: 78,
          canvasW: 2048,
          canvasH: 384,
          spriteW: 0.235,
          spriteH: 0.062,
          colorSecondary: archetype === "EXPOSE" ? "#bee2fc" : archetype === "FRACTURE" ? "#e2eefa" : "#cde4fe",
          haloColor: "rgba(160, 215, 255, 0.40)"
        }
      });
    }

    return units;
  }
}

/**
 * Editorial Typography Canvas Rasterizer
 * Dual-Pass Soft Ambient Dark Cushion & Crystalline Serif Glyphs
 * Automatically scales font size and letter spacing for multi-word chronicle expressions
 */
export function renderEditorialTypography(ctx, canvas, text, formationProg, visualOpts = {}, strokeJitterPx = 0.0, enableDarkCushion = true) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Pure Korean Archival Typography Enforcement (Mandatory Rule 4), with optional native mode for global benchmarks
  const rawStr = String(text || '').trim();
  const cleanText = visualOpts.allowNativeScript
    ? (rawStr || '대지가 진동하다')
    : (rawStr.replace(/[\u4e00-\u9fff\u3040-\u30ff]/g, '').replace(/\s+/g, ' ').trim() || '대지가 진동하다');

  const cX = canvas.width / 2;
  const cY = canvas.height / 2;
  const baseFontSize = visualOpts.fontSize || 82;
  const fontFamily = visualOpts.fontFamily || '"Noto Serif KR", "Nanum Myeongjo", Batang, serif';
  const colorSecondary = visualOpts.colorSecondary || '#c8e8fc';
  const haloColor = visualOpts.haloColor || 'rgba(140, 205, 255, 0.40)';

  // Adaptive sizing for single-character chunks vs. multi-word chronicle expressions
  let fontSize = baseFontSize;
  let letterSpacing = '0.18em';
  const charCount = cleanText.length;

  if (canvas.width <= 320 && charCount <= 2) {
    // Single glyph chunk canvas (256x256) in FRACTURE entity
    fontSize = Math.min(baseFontSize, Math.round(canvas.width * 0.40));
    letterSpacing = '0.02em';
  } else if (charCount <= 4) {
    fontSize = baseFontSize;
    letterSpacing = '0.20em';
  } else if (charCount <= 8) {
    fontSize = Math.round(baseFontSize * 0.88);
    letterSpacing = '0.12em';
  } else if (charCount <= 11) {
    fontSize = Math.round(baseFontSize * 0.78);
    letterSpacing = '0.08em';
  } else {
    fontSize = Math.round(baseFontSize * 0.70);
    letterSpacing = '0.05em';
  }

  if ('letterSpacing' in ctx) {
    ctx.letterSpacing = letterSpacing;
  }
  ctx.font = `600 ${fontSize}px ${fontFamily}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // Ensure text width never overflows the canvas width
  if (typeof ctx.measureText === 'function' && canvas.width > 320) {
    const measuredW = ctx.measureText(cleanText).width || 0;
    const maxAllowedW = canvas.width * 0.86;
    if (measuredW > maxAllowedW && measuredW > 0) {
      fontSize = Math.max(36, Math.floor(fontSize * (maxAllowedW / measuredW)));
      ctx.font = `600 ${fontSize}px ${fontFamily}`;
    }
  }
  canvas.finalFontSize = fontSize;

  // PASS 1: Soft Ambient Dark Cushion (Zero harsh black outlines, no boxes)
  if (enableDarkCushion && visualOpts.enableDarkCushion !== false) {
    ctx.save();
    ctx.shadowColor = 'rgba(2, 6, 14, 0.65)';
    ctx.shadowBlur = Math.round(fontSize * 0.40);
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 1;
    ctx.fillStyle = 'rgba(2, 6, 14, 0.55)';
    ctx.fillText(cleanText, cX + strokeJitterPx, cY);
    ctx.restore();
  }

  // PASS 2: Crystalline Editorial Serif with moonlight gradient
  ctx.save();
  ctx.shadowColor = haloColor;
  ctx.shadowBlur = Math.round(fontSize * 0.16);
  const grad = ctx.createLinearGradient(0, cY - fontSize * 0.45, 0, cY + fontSize * 0.45);
  grad.addColorStop(0.0, '#ffffff');
  grad.addColorStop(1.0, colorSecondary);
  ctx.fillStyle = grad;
  ctx.fillText(cleanText, cX + strokeJitterPx, cY);
  ctx.restore();

  // PASS 3: Fixed-Center Alpha Symmetric Wipe
  if (formationProg < 1.0) {
    ctx.save();
    ctx.globalCompositeOperation = 'destination-in';
    const halfSpan = (canvas.width * 0.52) * Math.min(1.0, formationProg * 1.15);
    const feather = canvas.width * 0.10;
    const x0 = Math.max(0, cX - halfSpan);
    const x1 = Math.min(canvas.width, cX + halfSpan);

    const wipeGrad = ctx.createLinearGradient(0, 0, canvas.width, 0);
    wipeGrad.addColorStop(0.0, 'rgba(255, 255, 255, 0.0)');
    const p0_start = Math.max(0.0, (x0 - feather) / canvas.width);
    const p0_end = Math.max(0.0, Math.min(1.0, x0 / canvas.width));
    const p1_start = Math.max(0.0, Math.min(1.0, x1 / canvas.width));
    const p1_end = Math.min(1.0, (x1 + feather) / canvas.width);

    if (p0_start > 0.0) wipeGrad.addColorStop(p0_start, 'rgba(255, 255, 255, 0.0)');
    wipeGrad.addColorStop(p0_end, 'rgba(255, 255, 255, 1.0)');
    wipeGrad.addColorStop(p1_start, 'rgba(255, 255, 255, 1.0)');
    if (p1_end < 1.0) wipeGrad.addColorStop(p1_end, 'rgba(255, 255, 255, 0.0)');
    wipeGrad.addColorStop(1.0, 'rgba(255, 255, 255, 0.0)');

    ctx.fillStyle = wipeGrad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.restore();
  }
}

/**
 * Generate soft radial atmospheric halo texture
 */
export function createRadialHaloTexture(arg1, arg2) {
  const THREE_INST = (arg1 && arg1.CanvasTexture) ? arg1 : (typeof window !== 'undefined' ? window.THREE : globalThis.THREE);
  const haloColorStr = typeof arg1 === 'string' ? arg1 : (arg2 || 'rgba(140, 205, 255, 0.35)');
  if (typeof document === 'undefined') return null;
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  const half = size / 2;
  const grad = ctx.createRadialGradient(half, half, 0, half, half, half);
  grad.addColorStop(0.0, haloColorStr);
  grad.addColorStop(0.35, haloColorStr.replace(/[\d\.]+\)$/, '0.15)'));
  grad.addColorStop(0.70, haloColorStr.replace(/[\d\.]+\)$/, '0.04)'));
  grad.addColorStop(1.0, 'rgba(0, 0, 0, 0)');

  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  const tex = new THREE_INST.CanvasTexture(canvas);
  tex.minFilter = THREE_INST.LinearFilter;
  tex.magFilter = THREE_INST.LinearFilter;
  return tex;
}

/**
 * Kinetic Archetype 1: RESONANCE (Bedrock Vibration & Harmonic Tremor)
 */
export function createResonanceEntity(arg1, arg2, arg3, arg4) {
  let THREE_INST, unitDef, cand, enableDarkCushion;
  if (arg1 && arg1.Group) {
    THREE_INST = arg1; unitDef = arg2; cand = arg3; enableDarkCushion = arg4 !== false;
  } else {
    THREE_INST = typeof window !== 'undefined' ? window.THREE : globalThis.THREE;
    unitDef = arg1; cand = arg2; enableDarkCushion = arg3 !== false;
  }
  const group = new THREE_INST.Group();

  const haloTex = createRadialHaloTexture(THREE_INST, unitDef.visual.haloColor);
  const haloMat = new THREE_INST.SpriteMaterial({
    map: haloTex,
    transparent: true,
    opacity: 0.0,
    blending: THREE_INST.AdditiveBlending,
    depthWrite: false,
    depthTest: true
  });
  const haloSprite = new THREE_INST.Sprite(haloMat);
  haloSprite.scale.set(unitDef.visual.spriteW * 1.35, unitDef.visual.spriteH * 2.2, 1.0);
  haloSprite.renderOrder = 95;
  group.add(haloSprite);

  const canvas = document.createElement('canvas');
  canvas.width = unitDef.visual.canvasW;
  canvas.height = unitDef.visual.canvasH;
  const ctx = canvas.getContext('2d');
  const texture = new THREE_INST.CanvasTexture(canvas);
  texture.generateMipmaps = true;
  texture.minFilter = THREE_INST.LinearMipmapLinearFilter;
  texture.magFilter = THREE_INST.LinearFilter;

  function renderCanvas(formationProg, strokeJitterPx = 0.0) {
    renderEditorialTypography(ctx, canvas, unitDef.semantic.displayText, formationProg, unitDef.visual, strokeJitterPx, enableDarkCushion);
    texture.needsUpdate = true;
    if (group.userData) {
      group.userData.finalFontSize = canvas.finalFontSize || unitDef.visual?.fontSize || 78;
    }
  }

  renderCanvas(0.0, 0.0);

  const spriteMat = new THREE_INST.SpriteMaterial({
    map: texture,
    transparent: true,
    opacity: 0.0,
    blending: THREE_INST.NormalBlending,
    depthWrite: false,
    depthTest: true
  });
  const sprite = new THREE_INST.Sprite(spriteMat);
  sprite.scale.set(unitDef.visual.spriteW, unitDef.visual.spriteH, 1.0);
  sprite.renderOrder = 100;
  group.add(sprite);

  const finalY = (cand.groundY || 0.0) + Math.max(0.010, unitDef.spatial?.elevationOffset || 0.020);
  group.position.set(cand.worldX, finalY, cand.worldZ);

  group.userData = {
    unitDef: unitDef,
    cand: cand,
    sprite: sprite,
    spriteMat: spriteMat,
    haloSprite: haloSprite,
    haloMat: haloMat,
    mainMesh: sprite,
    renderCanvas: renderCanvas,
    finalFontSize: canvas.finalFontSize || unitDef.visual?.fontSize || 78,
    canvasH: canvas.height,
    canvasW: canvas.width,
    t_activation: cand.t_activation,
    lifecycleState: 'LATENT',
    currentOpacity: 0.0,
    collisionStatus: 'CLEAR',
    eventId: unitDef.eventId || '',
    sourceId: unitDef.sourceId || '',
    token: unitDef.token || '',
    displayText: unitDef.semantic?.displayText || unitDef.token || '',
    semanticLabel: unitDef.semantic?.semanticLabel || '',
    sourceCitation: unitDef.editorialRationale || unitDef.source?.sourceReference || '',
    worldPos: { x: cand.worldX, y: finalY, z: cand.worldZ },
    terrainCoord: { normU: (cand.worldX / 0.72) + 0.5, normV: 0.5 - (cand.worldZ / 0.576), groundY: cand.groundY, elevation: cand.elevation }
  };

  return group;
}

/**
 * Kinetic Archetype 2: FRACTURE (Rock Shatter & Slope Tumbling)
 * Preserves word spaces and 1:1 square chunk aspect ratio for multi-word chronicle expressions
 */
export function createFractureEntity(arg1, arg2, arg3, arg4) {
  let THREE_INST, unitDef, cand, enableDarkCushion;
  if (arg1 && arg1.Group) {
    THREE_INST = arg1; unitDef = arg2; cand = arg3; enableDarkCushion = arg4 !== false;
  } else {
    THREE_INST = typeof window !== 'undefined' ? window.THREE : globalThis.THREE;
    unitDef = arg1; cand = arg2; enableDarkCushion = arg3 !== false;
  }
  const group = new THREE_INST.Group();

  const haloTex = createRadialHaloTexture(THREE_INST, unitDef.visual.haloColor);
  const haloMat = new THREE_INST.SpriteMaterial({
    map: haloTex,
    transparent: true,
    opacity: 0.0,
    blending: THREE_INST.AdditiveBlending,
    depthWrite: false,
    depthTest: true
  });
  const haloSprite = new THREE_INST.Sprite(haloMat);
  haloSprite.scale.set(unitDef.visual.spriteW * 1.35, unitDef.visual.spriteH * 2.2, 1.0);
  haloSprite.renderOrder = 95;
  group.add(haloSprite);

  const rawText = String(unitDef.semantic.displayText || unitDef.token || '거암이 붕괴되고').trim();
  const hasSpaces = rawText.includes(' ');
  // When multi-word chronicle clause has spaces, split by word chunks (어절 단위) so each word stays intact and legible before fracturing
  const tokenChunks = hasSpaces ? rawText.split(/\s+/).filter(Boolean) : rawText.split('');
  const chunkWeights = tokenChunks.map(tk => Math.max(1.0, tk.length * 0.85));
  const gapWeight = hasSpaces ? 0.45 : 0.0;
  const totalWeight = Math.max(1.0, chunkWeights.reduce((acc, w) => acc + w, 0) + Math.max(0, tokenChunks.length - 1) * gapWeight);
  const effectiveSpanW = Math.max(unitDef.visual.spriteW || 0.22, Math.min(0.32, totalWeight * 0.022));
  const unitAdvance = effectiveSpanW / totalWeight;
  const chunkBaseH = unitDef.visual.spriteH || 0.062;
  const chunks = [];

  const gradX = cand.gradX || 0;
  const gradZ = cand.gradZ || 0;
  const gradMag = Math.max(0.001, Math.sqrt(gradX * gradX + gradZ * gradZ));
  const slopeDirX = -gradX / gradMag;
  const slopeDirZ = -gradZ / gradMag;

  let cursorWeight = -totalWeight * 0.5;
  const chunkCount = Math.max(1, tokenChunks.length);

  tokenChunks.forEach((gl, glyphIdx) => {
    const w = chunkWeights[glyphIdx];
    const centerWeight = cursorWeight + w * 0.5;
    cursorWeight += w + gapWeight;

    const cW = gl.length > 2 ? 512 : 256;
    const cH = 256;
    const c = document.createElement('canvas');
    c.width = cW;
    c.height = cH;
    const ctx = c.getContext('2d');
    const tex = new THREE_INST.CanvasTexture(c);
    tex.generateMipmaps = true;
    tex.minFilter = THREE_INST.LinearMipmapLinearFilter;
    tex.magFilter = THREE_INST.LinearFilter;

    function renderChunk(prog) {
      renderEditorialTypography(ctx, c, gl, prog, unitDef.visual, 0.0, enableDarkCushion);
      tex.needsUpdate = true;
    }

    renderChunk(1.0);

    const sMat = new THREE_INST.SpriteMaterial({
      map: tex,
      transparent: true,
      opacity: 0.0,
      blending: THREE_INST.NormalBlending,
      depthWrite: false,
      depthTest: true
    });
    const sp = new THREE_INST.Sprite(sMat);
    const aspect = cW / cH;
    const spH = Math.max(0.038, Math.min(chunkBaseH, unitAdvance * 2.1));
    sp.scale.set(spH * aspect, spH, 1.0);
    sp.renderOrder = 100;
    const baseOffsetX = centerWeight * unitAdvance;
    sp.position.set(baseOffsetX, 0.0, 0.0);
    group.add(sp);

    const relIdx = glyphIdx - (chunkCount - 1) * 0.5;
    const spreadX = relIdx * 0.0045;
    const fallVelY = -0.022 - Math.abs(relIdx) * 0.0025;
    const spreadZ = ((glyphIdx % 2 === 0) ? -1 : 1) * (0.003 + glyphIdx * 0.0015);

    chunks.push({
      glyph: gl,
      sprite: sp,
      mat: sMat,
      baseOffsetX: baseOffsetX,
      renderChunk: renderChunk,
      spreadX: spreadX,
      fallVelY: fallVelY,
      spreadZ: spreadZ,
      gradDirX: slopeDirX,
      gradDirZ: slopeDirZ,
      rotSpeed: ((glyphIdx % 2 === 0) ? 1 : -1) * (0.75 + glyphIdx * 0.18)
    });
  });

  const finalY = (cand.groundY || 0.0) + Math.max(0.010, unitDef.spatial?.elevationOffset || 0.020);
  group.position.set(cand.worldX, finalY, cand.worldZ);

  group.userData = {
    unitDef: unitDef,
    cand: cand,
    chunks: chunks,
    haloSprite: haloSprite,
    haloMat: haloMat,
    mainMesh: chunks[Math.floor(chunks.length / 2)]?.sprite || group,
    chunkCanvasSize: 256,
    chunkFontSize: Math.min(unitDef.visual?.fontSize || 78, Math.round(256 * 0.40)),
    t_activation: cand.t_activation,
    lifecycleState: 'LATENT',
    currentOpacity: 0.0,
    collisionStatus: 'CLEAR',
    eventId: unitDef.eventId || '',
    sourceId: unitDef.sourceId || '',
    token: unitDef.token || '',
    displayText: unitDef.semantic?.displayText || unitDef.token || '',
    semanticLabel: unitDef.semantic?.semanticLabel || '',
    sourceCitation: unitDef.editorialRationale || unitDef.source?.sourceReference || '',
    worldPos: { x: cand.worldX, y: finalY, z: cand.worldZ },
    terrainCoord: { normU: (cand.worldX / 0.72) + 0.5, normV: 0.5 - (cand.worldZ / 0.576), groundY: cand.groundY, elevation: cand.elevation }
  };

  return group;
}

/**
 * Kinetic Archetype 3: RECEDE (Seaward Water Retreat & Void)
 */
export function createRecedeEntity(arg1, arg2, arg3, arg4) {
  let THREE_INST, unitDef, cand, enableDarkCushion;
  if (arg1 && arg1.Group) {
    THREE_INST = arg1; unitDef = arg2; cand = arg3; enableDarkCushion = arg4 !== false;
  } else {
    THREE_INST = typeof window !== 'undefined' ? window.THREE : globalThis.THREE;
    unitDef = arg1; cand = arg2; enableDarkCushion = arg3 !== false;
  }
  const group = new THREE_INST.Group();

  const haloTex = createRadialHaloTexture(THREE_INST, unitDef.visual.haloColor);
  const haloMat = new THREE_INST.SpriteMaterial({
    map: haloTex,
    transparent: true,
    opacity: 0.0,
    blending: THREE_INST.AdditiveBlending,
    depthWrite: false,
    depthTest: true
  });
  const haloSprite = new THREE_INST.Sprite(haloMat);
  haloSprite.scale.set(unitDef.visual.spriteW * 1.35, unitDef.visual.spriteH * 2.2, 1.0);
  haloSprite.renderOrder = 95;
  group.add(haloSprite);

  const canvas = document.createElement('canvas');
  canvas.width = unitDef.visual.canvasW;
  canvas.height = unitDef.visual.canvasH;
  const ctx = canvas.getContext('2d');
  const texture = new THREE_INST.CanvasTexture(canvas);
  texture.generateMipmaps = true;
  texture.minFilter = THREE_INST.LinearMipmapLinearFilter;
  texture.magFilter = THREE_INST.LinearFilter;

  function renderCanvas(formationProg) {
    renderEditorialTypography(ctx, canvas, unitDef.semantic.displayText, formationProg, unitDef.visual, 0.0, enableDarkCushion);
    texture.needsUpdate = true;
    if (group.userData) {
      group.userData.finalFontSize = canvas.finalFontSize || unitDef.visual?.fontSize || 78;
    }
  }

  renderCanvas(0.0);

  const spriteMat = new THREE_INST.SpriteMaterial({
    map: texture,
    transparent: true,
    opacity: 0.0,
    blending: THREE_INST.NormalBlending,
    depthWrite: false,
    depthTest: true
  });
  const sprite = new THREE_INST.Sprite(spriteMat);
  sprite.scale.set(unitDef.visual.spriteW, unitDef.visual.spriteH, 1.0);
  sprite.renderOrder = 100;
  group.add(sprite);

  const finalRecedeY = (cand.groundY || 0.0) + Math.max(0.010, unitDef.spatial?.elevationOffset || 0.020);
  const finalY = finalRecedeY;
  group.position.set(cand.worldX, finalRecedeY, cand.worldZ);

  group.userData = {
    unitDef: unitDef,
    cand: cand,
    sprite: sprite,
    spriteMat: spriteMat,
    haloSprite: haloSprite,
    haloMat: haloMat,
    mainMesh: sprite,
    renderCanvas: renderCanvas,
    finalFontSize: canvas.finalFontSize || unitDef.visual?.fontSize || 78,
    canvasH: canvas.height,
    canvasW: canvas.width,
    t_activation: cand.t_activation,
    lifecycleState: 'LATENT',
    currentOpacity: 0.0,
    collisionStatus: 'CLEAR',
    eventId: unitDef.eventId || '',
    sourceId: unitDef.sourceId || '',
    token: unitDef.token || '',
    displayText: unitDef.semantic?.displayText || unitDef.token || '',
    semanticLabel: unitDef.semantic?.semanticLabel || '',
    sourceCitation: unitDef.editorialRationale || unitDef.source?.sourceReference || '',
    worldPos: { x: cand.worldX, y: finalY, z: cand.worldZ },
    terrainCoord: { normU: (cand.worldX / 0.72) + 0.5, normV: 0.5 - (cand.worldZ / 0.576), groundY: cand.groundY, elevation: cand.elevation }
  };

  return group;
}

/**
 * Kinetic Archetype 4: EXPOSE (Upright Bathymetric Billboard / Sediment Venting)
 */
export function createExposeEntity(arg1, arg2, arg3, arg4) {
  let THREE_INST, unitDef, cand, enableDarkCushion;
  if (arg1 && arg1.Group) {
    THREE_INST = arg1; unitDef = arg2; cand = arg3; enableDarkCushion = arg4 !== false;
  } else {
    THREE_INST = typeof window !== 'undefined' ? window.THREE : globalThis.THREE;
    unitDef = arg1; cand = arg2; enableDarkCushion = arg3 !== false;
  }
  const group = new THREE_INST.Group();

  const haloTex = createRadialHaloTexture(THREE_INST, unitDef.visual.haloColor);
  const haloMat = new THREE_INST.SpriteMaterial({
    map: haloTex,
    transparent: true,
    opacity: 0.0,
    blending: THREE_INST.AdditiveBlending,
    depthWrite: false,
    depthTest: true
  });
  const haloSprite = new THREE_INST.Sprite(haloMat);
  haloSprite.scale.set(unitDef.visual.spriteW * 1.35, unitDef.visual.spriteH * 2.2, 1.0);
  haloSprite.renderOrder = 95;
  group.add(haloSprite);

  const canvas = document.createElement('canvas');
  canvas.width = unitDef.visual.canvasW;
  canvas.height = unitDef.visual.canvasH;
  const ctx = canvas.getContext('2d');
  const texture = new THREE_INST.CanvasTexture(canvas);
  texture.generateMipmaps = true;
  texture.minFilter = THREE_INST.LinearMipmapLinearFilter;
  texture.magFilter = THREE_INST.LinearFilter;

  function renderCanvas(formationProg) {
    renderEditorialTypography(ctx, canvas, unitDef.semantic.displayText, formationProg, unitDef.visual, 0.0, enableDarkCushion);
    texture.needsUpdate = true;
    if (group.userData) {
      group.userData.finalFontSize = canvas.finalFontSize || unitDef.visual?.fontSize || 78;
    }
  }

  renderCanvas(0.0);

  const spriteMat = new THREE_INST.SpriteMaterial({
    map: texture,
    transparent: true,
    opacity: 0.0,
    blending: THREE_INST.NormalBlending,
    depthWrite: false,
    depthTest: true
  });
  const sprite = new THREE_INST.Sprite(spriteMat);
  sprite.scale.set(unitDef.visual.spriteW, unitDef.visual.spriteH, 1.0);
  sprite.renderOrder = 100;
  group.add(sprite);

  const finalY = (cand.groundY || 0.0) + Math.max(0.010, unitDef.spatial?.elevationOffset || 0.020);
  group.position.set(cand.worldX, finalY, cand.worldZ);

  group.userData = {
    unitDef: unitDef,
    cand: cand,
    sprite: sprite,
    spriteMat: spriteMat,
    haloSprite: haloSprite,
    haloMat: haloMat,
    mainMesh: sprite,
    renderCanvas: renderCanvas,
    finalFontSize: canvas.finalFontSize || unitDef.visual?.fontSize || 78,
    canvasH: canvas.height,
    canvasW: canvas.width,
    t_activation: cand.t_activation,
    lifecycleState: 'LATENT',
    currentOpacity: 0.0,
    collisionStatus: 'CLEAR',
    eventId: unitDef.eventId || '',
    sourceId: unitDef.sourceId || '',
    token: unitDef.token || '',
    displayText: unitDef.semantic?.displayText || unitDef.token || '',
    semanticLabel: unitDef.semantic?.semanticLabel || '',
    sourceCitation: unitDef.editorialRationale || unitDef.source?.sourceReference || '',
    worldPos: { x: cand.worldX, y: finalY, z: cand.worldZ },
    terrainCoord: { normU: (cand.worldX / 0.72) + 0.5, normV: 0.5 - (cand.worldZ / 0.576), groundY: cand.groundY, elevation: cand.elevation }
  };

  return group;
}

/**
 * Terrain-Aware Spatial Spawner
 */
export class TerrainAwareSpawner {
  constructor(candidateCache = []) {
    this.candidateCache = candidateCache;
  }

  resolveCandidate(unitDef, parsedEvent, terrainMetricsLookup = null) {
    let chosenWorldX = 0;
    let chosenWorldZ = 0;
    let groundY = 0;
    let elevation = 0;
    let slope = 0;
    let gradX = 0;
    let gradZ = 0;
    let normX = 0;
    let normZ = 1;
    let suitability = 'OPTIMAL_AFFINITY_MATCH';

    if (unitDef.spatial?.anchorHint) {
      chosenWorldX = unitDef.spatial.anchorHint.worldX;
      chosenWorldZ = unitDef.spatial.anchorHint.worldZ;
      if (typeof terrainMetricsLookup === 'function') {
        const m = terrainMetricsLookup(chosenWorldX, chosenWorldZ);
        groundY = m.groundY;
        elevation = m.meters;
        slope = m.slopeDeg;
        gradX = m.gradX;
        gradZ = m.gradZ;
        normX = m.normX;
        normZ = m.normZ;
      }
      suitability = 'PROFILE_ANCHOR_VERIFIED';
    } else {
      const preferredCategory = unitDef.spatial?.preferredType?.toUpperCase() || 'GENERAL_TERRAIN';
      const targetZone = unitDef.spatial?.stageZone || 'ZONE_B_INLAND';

      const matches = this.candidateCache.filter(c =>
        (c.category === preferredCategory || preferredCategory === 'GENERAL_TERRAIN') &&
        c.zone === targetZone
      );

      const pool = (matches.length > 0) ? matches : this.candidateCache.filter(c => c.zone === targetZone);
      const focalPool = pool.filter(c => Math.abs(c.worldX) <= 0.12 && Math.abs(c.worldZ) <= 0.08);
      const candidateList = (targetZone === 'ZONE_C_MOUNTAIN' || focalPool.length === 0) ? pool : focalPool;
      const chosen = candidateList[Math.floor(candidateList.length / 2)] || { worldX: 0, worldZ: 0, groundY: 0, elevation: 0, slope: 0 };

      chosenWorldX = chosen.worldX;
      chosenWorldZ = chosen.worldZ;
      if (typeof terrainMetricsLookup === 'function') {
        const m = terrainMetricsLookup(chosenWorldX, chosenWorldZ);
        groundY = m.groundY;
        elevation = m.meters;
        slope = m.slopeDeg;
        gradX = m.gradX;
        gradZ = m.gradZ;
        normX = m.normX;
        normZ = m.normZ;
      } else {
        groundY = chosen.groundY;
        elevation = chosen.elevation;
        slope = chosen.slope;
        gradX = chosen.gradX || 0;
        gradZ = chosen.gradZ || 0;
        normX = chosen.normX || 0;
        normZ = chosen.normZ || 1;
      }
      suitability = 'GENERIC_AFFINITY_MATCH';
    }

    return {
      worldX: chosenWorldX,
      worldZ: chosenWorldZ,
      groundY: groundY,
      elevation: elevation,
      slope: slope,
      gradX: gradX,
      gradZ: gradZ,
      normX: normX,
      normZ: normZ,
      t_activation: unitDef.timing.t_activation,
      suitabilityStatus: suitability
    };
  }
}

/**
 * Modern Living Memory & Archival Korean Typography Engine
 * Coordinates parsing, terrain-aware spawning, kinetic rendering, and lifecycle state
 */
export class LivingMemoryEngine {
  constructor({ scene = null, THREE = null, livingSoundfield = null } = {}) {
    this.scene = scene;
    this.THREE = THREE;
    this.livingSoundfield = livingSoundfield;
    this.entities = [];
    this.currentParsedEvent = null;
    this.parser = new ArchivalSemanticParser();
    this.spawner = new TerrainAwareSpawner();
    this.enableDarkCushion = true;
    this.displayMode = 'korean'; // 'korean' default per Mandate 4; supports 'native'
  }

  setMultilingualDisplayMode(mode) {
    this.displayMode = mode === 'native' ? 'native' : 'korean';
    this.parser.setDisplayMode(this.displayMode);
    if (this.currentParsedEvent) {
      const newParsed = this.parser.parseEvent(this.currentParsedEvent.eventId);
      this.currentParsedEvent = newParsed;
      this.entities.forEach((group, idx) => {
        const u = newParsed.semanticUnits[idx];
        if (u && group.userData) {
          group.userData.unitDef = u;
          group.userData.token = u.token || '';
          group.userData.displayText = u.semantic?.displayText || u.token || '';
          if (typeof group.userData.renderCanvas === 'function') {
            group.userData.renderCanvas(1.0);
          } else if (Array.isArray(group.userData.chunks)) {
            group.userData.chunks.forEach(ch => {
              if (typeof ch.renderChunk === 'function') ch.renderChunk(1.0);
            });
          }
        }
      });
    }
  }

  setDarkCushionEnabled(enabled) {
    this.enableDarkCushion = !!enabled;
    this.entities.forEach(group => {
      if (typeof group.userData?.renderCanvas === 'function') {
        group.userData.renderCanvas(1.0);
      }
    });
  }

  getActiveEntities() {
    return this.entities.filter(e =>
      e.userData?.lifecycleState !== 'LATENT' && e.userData?.lifecycleState !== 'DEAD'
    );
  }

  dispose() {
    if (this.scene) {
      this.entities.forEach(group => {
        this.scene.remove(group);
        group.traverse(child => {
          if (child.material) {
            if (child.material.map) child.material.map.dispose();
            child.material.dispose();
          }
          if (child.geometry) child.geometry.dispose();
        });
      });
    }
    this.entities = [];
    this.currentParsedEvent = null;
  }
}
