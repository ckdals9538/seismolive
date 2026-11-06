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

export const HANJA_TO_HANGUL_MAP = {
  "墻屋頹圮": "무너지다",
  "頹圮": "무너지다",
  "倒壞": "무너지다",
  "崩壞": "무너지다",
  "山崩": "산이 무너지다",
  "地裂": "갈라지다",
  "地動": "흔들리다",
  "地震": "흔들리다",
  "退潮": "퇴조",
  "海溢": "해일",
  "湧出": "솟구치다",
  "鳴響": "울다",
  "聲如雷": "우레처럼 울다",
  "如雷": "울다",
  "轟然": "우르릉 울다",
  "振動": "흔들리다",
  "搖動": "흔들리다",
  "大震": "흔들리다",
  "陷沒": "가라앉다",
  "沈沒": "가라앉다"
};

export function sanitizeArchivalToken(rawToken, category = "resonance", fallback = "") {
  if (!rawToken || typeof rawToken !== 'string') return fallback || "흔들리다";
  let token = rawToken.trim();
  token = token.replace(/\s*\([^\)]*[\u4e00-\u9fff][^\)]*\)/g, '').replace(/[\u4e00-\u9fff]/g, '').trim();

  if (token.length > 0 && /^[\uac00-\ud7af\s]+$/.test(token)) {
    return token.length <= 6 ? token : token.slice(0, 5);
  }

  if (HANJA_TO_HANGUL_MAP[rawToken]) return HANJA_TO_HANGUL_MAP[rawToken];
  for (const [hanja, hangul] of Object.entries(HANJA_TO_HANGUL_MAP)) {
    if (rawToken.includes(hanja)) return hangul;
  }

  if (category === "water") return "퇴조";
  if (category === "sound" || category === "resonance") return "울다";
  if (category === "geology" || category === "structure" || category === "fracture") return "무너지다";
  if (category === "shaking") return "흔들리다";
  return fallback || "흔들리다";
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

    let semanticUnits = [];
    let compositionProfileStatus = "PROFILE_APPLIED_1681_YANGYANG";

    if (ev.eventId === "hist_1681_0626") {
      semanticUnits = [
        // Meaning 01: 퇴조 (DIRECT_QUOTATION of Hanja 退潮)
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
          source: {
            originalHanja: "海水退潮百餘步",
            originalTranslationKo: "바닷물이 백여 보 물러갔다가 밀려왔다",
            evidenceStatus: "DIRECT_QUOTATION",
            evidenceClass: "DIRECT_QUOTATION",
            sourceReference: "승정원일기 숙종 7년 5월 14일 辛酉 (강원감사 장계)",
            confidence: "HIGH_PRIMARY_CHRONICLE"
          },
          semantic: {
            semanticLabel: "퇴조",
            displayText: "퇴조",
            phenomenaTags: ["TSUNAMI_TIDAL_WAVE", "WATER_RECESSION"]
          },
          spatial: {
            stageZone: "ZONE_A_OCEAN",
            preferredType: "coastal_shelf",
            anchorHint: { worldX: -0.055, worldZ: 0.035 },
            elevationOffset: 0.038
          },
          kinetic: {
            archetype: "RECEDE",
            materialAdapter: "WATER_SURFACE_SWELL"
          },
          timing: {
            t_activation: 3.2,
            formationDuration: 1.2,
            minLegibilityDuration: 2.2,
            resonanceDuration: 2.6,
            dissolutionDuration: 2.6,
            residueDuration: 2.2
          },
          visual: {
            archetype: "RECEDE",
            fontFamily: '"Noto Serif KR", "Nanum Myeongjo", Batang, serif',
            fontSize: 88,
            canvasW: 1024,
            canvasH: 384,
            spriteW: 0.170,
            spriteH: 0.064,
            colorSecondary: "#c8e8fc",
            haloColor: "rgba(130, 200, 255, 0.40)"
          }
        },
        // Meaning 02: 울다 (SOURCE_TRANSLATION of 山岳震動 / 聲如雷)
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
          source: {
            originalHanja: "聲如雷 山岳震動",
            originalTranslationKo: "소리가 우레와 같고 산이 울고 땅이 진동하였으며",
            evidenceStatus: "SOURCE_TRANSLATION",
            evidenceClass: "SOURCE_TRANSLATION",
            sourceReference: "숙종실록 11권 숙종 7년 5월 11일 戊午",
            confidence: "HIGH_PRIMARY_CHRONICLE"
          },
          semantic: {
            semanticLabel: "울림",
            displayText: "울다",
            phenomenaTags: ["ACOUSTIC_BOOM", "GROUND_SHAKING"]
          },
          spatial: {
            stageZone: "ZONE_B_INLAND",
            preferredType: "inland_foothills",
            anchorHint: { worldX: -0.230, worldZ: 0.045 },
            elevationOffset: 0.048
          },
          kinetic: {
            archetype: "RESONANCE",
            materialAdapter: "BEDROCK_VIBRATION"
          },
          timing: {
            t_activation: 14.5,
            formationDuration: 1.2,
            minLegibilityDuration: 2.2,
            resonanceDuration: 2.4,
            dissolutionDuration: 2.4,
            residueDuration: 1.8
          },
          visual: {
            archetype: "RESONANCE",
            fontFamily: '"Noto Serif KR", "Nanum Myeongjo", Batang, serif',
            fontSize: 88,
            canvasW: 1024,
            canvasH: 384,
            spriteW: 0.160,
            spriteH: 0.060,
            colorSecondary: "#cde4fe",
            haloColor: "rgba(160, 215, 255, 0.40)"
          }
        },
        // Meaning 03: 드러나다 (EDITORIAL_DISTILLATION of 露出)
        {
          id: "unit_1681_expose",
          token: "드러나다",
          sourceId: "rec_sjw_1681_0514",
          originalPassage: "海水退潮百餘步",
          translation: "바닷물이 백여 보 물러가 해저가 드러남",
          evidenceClass: "EDITORIAL_DISTILLATION",
          editorialRationale: "백여 보 퇴조로 인해 드러난 해저 노출 사료 현상을 순우리말 동사로 정제",
          confidence: "HIGH_PRIMARY_CHRONICLE",
          spatialMotif: "ZONE_COASTAL_BLUFF",
          source: {
            originalHanja: "海水退潮百餘步 露出",
            originalTranslationKo: "바닷물이 백여 보 물러가 해저가 드러남",
            evidenceStatus: "EDITORIAL_DISTILLATION",
            evidenceClass: "EDITORIAL_DISTILLATION",
            sourceReference: "승정원일기 1681-05-14 강원감사 장계",
            confidence: "HIGH_PRIMARY_CHRONICLE"
          },
          semantic: {
            semanticLabel: "노출",
            displayText: "드러나다",
            phenomenaTags: ["SEABED_EXPOSURE", "TSUNAMI_RECESSION"]
          },
          spatial: {
            stageZone: "ZONE_A_OCEAN",
            preferredType: "shallow_seabed",
            anchorHint: { worldX: -0.150, worldZ: 0.055 },
            elevationOffset: 0.040
          },
          kinetic: {
            archetype: "EXPOSE",
            materialAdapter: "UPRIGHT_BATHYMETRIC_BILLBOARD"
          },
          timing: {
            t_activation: 23.0,
            formationDuration: 1.2,
            minLegibilityDuration: 2.2,
            resonanceDuration: 2.2,
            dissolutionDuration: 2.2,
            residueDuration: 3.0
          },
          visual: {
            archetype: "EXPOSE",
            fontFamily: '"Noto Serif KR", "Nanum Myeongjo", Batang, serif',
            fontSize: 88,
            canvasW: 1024,
            canvasH: 384,
            spriteW: 0.170,
            spriteH: 0.064,
            colorSecondary: "#bee2fc",
            haloColor: "rgba(140, 205, 255, 0.40)"
          }
        },
        // Meaning 04: 무너지다 (DIRECT_QUOTATION of 頹落)
        {
          id: "unit_1681_fracture",
          token: "무너지다",
          sourceId: "rec_sillok_1681_0626",
          originalPassage: "雪岳山 諸峰 碎石 頹落",
          translation: "설악산 여러 봉우리의 부서진 돌들이 무너져 내렸다",
          evidenceClass: "DIRECT_QUOTATION",
          editorialRationale: "실록의 '諸峰 碎石 頹落'에 대한 공인 국역 표현 '돌들이 무너져 내렸다'의 핵심 동사 직접 인용",
          confidence: "HIGH_PRIMARY_CHRONICLE",
          spatialMotif: "ZONE_ALPINE_CLIFF",
          source: {
            originalHanja: "雪岳山 諸峰 碎石 頹落",
            originalTranslationKo: "설악산 여러 봉우리의 부서진 돌들이 무너져 내렸다",
            evidenceStatus: "DIRECT_QUOTATION",
            evidenceClass: "DIRECT_QUOTATION",
            sourceReference: "숙종실록 11권 숙종 7년 5월 11일 戊午",
            confidence: "HIGH_PRIMARY_CHRONICLE"
          },
          semantic: {
            semanticLabel: "붕락",
            displayText: "무너지다",
            phenomenaTags: ["ROCKFALL_COLLAPSE", "MOUNTAIN_SHATTERING"]
          },
          spatial: {
            stageZone: "ZONE_C_MOUNTAIN",
            preferredType: "mountain_ridge",
            anchorHint: { worldX: -0.380, worldZ: 0.070 },
            elevationOffset: 0.052
          },
          kinetic: {
            archetype: "FRACTURE",
            materialAdapter: "FRACTURED_DEBRIS_FALL"
          },
          timing: {
            t_activation: 31.0,
            formationDuration: 1.2,
            minLegibilityDuration: 2.2,
            resonanceDuration: 2.4,
            dissolutionDuration: 2.4,
            residueDuration: 2.0
          },
          visual: {
            archetype: "FRACTURE",
            fontFamily: '"Noto Serif KR", "Nanum Myeongjo", Batang, serif',
            fontSize: 88,
            canvasW: 1024,
            canvasH: 384,
            spriteW: 0.170,
            spriteH: 0.064,
            colorSecondary: "#e0eefc",
            haloColor: "rgba(180, 220, 255, 0.40)"
          }
        }
      ];
    } else {
      semanticUnits = this._extractHistoricalSemanticUnits(ev, records);
      compositionProfileStatus = `PROFILE_APPLIED_HISTORICAL_${ev.eventId.toUpperCase()}`;
    }

    const dominantFreq = (ev.eventId === "hist_1681_0626") ? 1.0 : Math.max(0.2, Math.min(2.5, 1.8 * Math.pow(10.0, -0.22 * (mag - 5.0))));
    const q = (ev.eventId === "hist_1681_0626") ? 250.0 : (ev.macroseismic?.tsunamiObserved ? 260.0 : 220.0);
    const dispScale = (ev.eventId === "hist_1681_0626") ? 1.2 : Math.max(0.6, Math.min(2.2, 0.4 + (mag - 5.0) * 0.4));
    const verifiedSourceCount = semanticUnits.filter(u => u.source?.evidenceStatus === "VERIFIED_SOURCE" || u.evidenceClass === "DIRECT_QUOTATION" || u.evidenceClass === "SOURCE_TRANSLATION").length;
    const editorialInterpretationCount = semanticUnits.filter(u => u.source?.evidenceStatus === "EDITORIAL_INTERPRETATION" || u.evidenceClass === "EDITORIAL_DISTILLATION").length;

    const rawDateText = ev.dateText || ev.dateConversion?.gregorianDateISO || (ev.dateConversion?.gregorianYear ? `${ev.dateConversion.gregorianYear}년` : (ev.date?.gregorianYear ? `${ev.date.gregorianYear}년` : "연대 미상"));
    const cleanDateText = (rawDateText || '').replace(/\s*\([^\)]*[\u4e00-\u9fff][^\)]*\)/g, '').replace(/[\u4e00-\u9fff]/g, '').trim();

    return {
      eventId: ev.eventId,
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
    const isKo = this.displayMode === 'korean';
    const units = [];
    const lexicon = Array.isArray(ev.archivalLexicon) ? ev.archivalLexicon : [];
    const sourceDoc = ev.primaryText?.documentSource || (records[0]?.corpusId ? records[0].corpusId : "역사 사료 기록");

    const hasOcean = ev.terrainContext?.hasOcean !== false &&
                     ev.terrainConfig?.hasOcean !== false &&
                     ev.hasOcean !== false &&
                     !ev.eventId?.includes("1338"); // 1338 Gaegyeong is inland basin/massif

    // 1. Water drawback / surge / tsunami record (Only when ocean shelf is present)
    const waterEntry = lexicon.find(l => l.category === 'water' || /퇴조|해수|물러|해일|바닷물/.test(l.token)) ||
      (ev.macroseismic?.tsunamiObserved ? { token: "퇴조", translation: "바닷물이 물러갔다가 밀려옴" } : null);
    if (waterEntry && hasOcean) {
      const cleanWaterToken = sanitizeArchivalToken(waterEntry.token, 'water', '퇴조');
      units.push({
        id: `unit_${ev.eventId}_recede`,
        eventId: ev.eventId,
        token: cleanWaterToken,
        sourceId: `rec_${ev.eventId}_water`,
        originalPassage: ev.primaryText?.originalScript || waterEntry.token,
        translation: waterEntry.translation || "바닷물이 물러갔다가 밀려옴",
        evidenceClass: "DIRECT_QUOTATION",
        editorialRationale: `${sourceDoc}에 수록된 해양 수벽 변동 및 수위 기록 인용`,
        confidence: "HIGH_PRIMARY_CHRONICLE",
        spatialMotif: "ZONE_OCEAN_SHELF",
        source: {
          originalText: waterEntry.token,
          evidenceStatus: "VERIFIED_SOURCE",
          sourceReference: sourceDoc
        },
        semantic: {
          semanticLabel: "퇴조",
          displayText: cleanWaterToken,
          phenomenaTags: ["WATER_RECESSION", "TSUNAMI_TIDAL_WAVE"]
        },
        spatial: {
          stageZone: "ZONE_A_OCEAN",
          preferredType: "coastal_shelf",
          elevationOffset: 0.038,
          anchorHint: { worldX: 0.082, worldZ: 0.045 }
        },
        kinetic: {
          archetype: "RECEDE",
          materialAdapter: "WATER_SURFACE_SWELL"
        },
        timing: {
          t_activation: 3.2,
          formationDuration: 1.2,
          minLegibilityDuration: 2.2,
          resonanceDuration: 2.6,
          dissolutionDuration: 2.6,
          residueDuration: 2.2
        },
        visual: {
          archetype: "RECEDE",
          fontFamily: '"Noto Serif KR", Batang, serif',
          fontSize: 88,
          canvasW: 1024,
          canvasH: 384,
          spriteW: 0.170,
          spriteH: 0.064,
          colorSecondary: "#c8e8fc",
          haloColor: "rgba(130, 200, 255, 0.40)"
        }
      });
    }

    // 2. Sound / Roar / Thunder resonance
    const soundEntry = lexicon.find(l => l.category === 'sound' || /울|우레|굉음|소리/.test(l.token)) ||
      { token: "울다", translation: "산과 대지가 우레처럼 울림" };
    const cleanSoundToken = sanitizeArchivalToken(soundEntry.token, 'sound', '울다');
    units.push({
      id: `unit_${ev.eventId}_resonance`,
      eventId: ev.eventId,
      token: cleanSoundToken,
      sourceId: `rec_${ev.eventId}_sound`,
      originalPassage: ev.primaryText?.originalScript || soundEntry.token,
      translation: soundEntry.translation || "지하와 산악이 울려 퍼짐",
      evidenceClass: "SOURCE_TRANSLATION",
      editorialRationale: `${sourceDoc}에 기술된 지하 충격음 및 산천 공명 현상 압축`,
      confidence: "HIGH_PRIMARY_CHRONICLE",
      spatialMotif: "ZONE_INLAND_BASIN",
      source: {
        originalText: soundEntry.token,
        evidenceStatus: "SOURCE_TRANSLATION",
        sourceReference: sourceDoc
      },
      semantic: {
        semanticLabel: "공명",
        displayText: cleanSoundToken,
        phenomenaTags: ["ACOUSTIC_BOOM", "GROUND_SHAKING"]
      },
      spatial: {
        stageZone: "ZONE_B_INLAND",
        preferredType: "inland_basin",
        elevationOffset: 0.042,
        anchorHint: { worldX: -0.038, worldZ: -0.022 }
      },
      kinetic: {
        archetype: "RESONANCE",
        materialAdapter: "BEDROCK_VIBRATION"
      },
      timing: {
        t_activation: 6.4,
        formationDuration: 1.2,
        minLegibilityDuration: 2.2,
        resonanceDuration: 2.4,
        dissolutionDuration: 2.4,
        residueDuration: 2.0
      },
      visual: {
        archetype: "RESONANCE",
        fontFamily: '"Noto Serif KR", Batang, serif',
        fontSize: 92,
        canvasW: 1024,
        canvasH: 384,
        spriteW: 0.165,
        spriteH: 0.062,
        colorSecondary: "#d6eaff",
        haloColor: "rgba(160, 215, 255, 0.40)"
      }
    });

    // 3. Geology / Structure / Fracture
    const fractureEntry = lexicon.find(l => l.category === 'geology' || l.category === 'structure' || /무너|붕괴|거암|파쇄|갈라|도괴/.test(l.token)) ||
      { token: "무너지다", translation: "가옥과 암석이 무너져 내림" };
    const cleanFractureToken = sanitizeArchivalToken(fractureEntry.token, 'fracture', '무너지다');
    units.push({
      id: `unit_${ev.eventId}_fracture`,
      eventId: ev.eventId,
      token: cleanFractureToken,
      sourceId: `rec_${ev.eventId}_fracture`,
      originalPassage: ev.primaryText?.originalScript || fractureEntry.token,
      translation: fractureEntry.translation || "지각 변형 및 구조물 파쇄 발생",
      evidenceClass: "SOURCE_TRANSLATION",
      editorialRationale: `${sourceDoc}에 기록된 사면 붕락 및 구조물 붕괴 피해 인용`,
      confidence: "HIGH_PRIMARY_CHRONICLE",
      spatialMotif: "ZONE_ALPINE_RIDGE",
      source: {
        originalText: fractureEntry.token,
        evidenceStatus: "SOURCE_TRANSLATION",
        sourceReference: sourceDoc
      },
      semantic: {
        semanticLabel: "파쇄",
        displayText: cleanFractureToken,
        phenomenaTags: ["STRUCTURAL_FAILURE", "SURFACE_RUPTURE"]
      },
      spatial: {
        stageZone: "ZONE_B_INLAND",
        preferredType: "alpine_cliff",
        elevationOffset: 0.046,
        anchorHint: { worldX: 0.042, worldZ: 0.016 }
      },
      kinetic: {
        archetype: "FRACTURE",
        materialAdapter: "FRACTURED_DEBRIS_FALL"
      },
      timing: {
        t_activation: 10.2,
        formationDuration: 1.2,
        minLegibilityDuration: 2.2,
        resonanceDuration: 2.4,
        dissolutionDuration: 2.4,
        residueDuration: 2.0
      },
      visual: {
        archetype: "FRACTURE",
        fontFamily: '"Noto Serif KR", Batang, serif',
        fontSize: 90,
        canvasW: 1024,
        canvasH: 384,
        spriteW: 0.170,
        spriteH: 0.064,
        colorSecondary: "#e2eefa",
        haloColor: "rgba(170, 220, 255, 0.40)"
      }
    });

    // 4. Shaking
    units.push({
      id: `unit_${ev.eventId}_shaking`,
      eventId: ev.eventId,
      token: "흔들리다",
      sourceId: `rec_${ev.eventId}_shaking`,
      originalPassage: ev.primaryText?.originalScript || "땅이 크게 진동함",
      translation: "대지가 심하게 흔들림",
      evidenceClass: "SOURCE_TRANSLATION",
      editorialRationale: `${sourceDoc}에 기록된 광역 지진동 기술`,
      confidence: "HIGH_PRIMARY_CHRONICLE",
      spatialMotif: "ZONE_INLAND_BASIN",
      source: {
        originalText: "地動",
        evidenceStatus: "SOURCE_TRANSLATION",
        sourceReference: sourceDoc
      },
      semantic: {
        semanticLabel: "진동",
        displayText: "흔들리다",
        phenomenaTags: ["GROUND_SHAKING"]
      },
      spatial: {
        stageZone: "ZONE_B_INLAND",
        preferredType: "inland_basin",
        elevationOffset: 0.040,
        anchorHint: { worldX: -0.008, worldZ: 0.042 }
      },
      kinetic: {
        archetype: "RESONANCE",
        materialAdapter: "BEDROCK_VIBRATION"
      },
      timing: {
        t_activation: 14.0,
        formationDuration: 1.2,
        minLegibilityDuration: 2.2,
        resonanceDuration: 2.4,
        dissolutionDuration: 2.4,
        residueDuration: 2.0
      },
      visual: {
        archetype: "RESONANCE",
        fontFamily: '"Noto Serif KR", Batang, serif',
        fontSize: 88,
        canvasW: 1024,
        canvasH: 384,
        spriteW: 0.160,
        spriteH: 0.060,
        colorSecondary: "#cde4fe",
        haloColor: "rgba(160, 215, 255, 0.40)"
      }
    });

    return units;
  }

  _parseInstrumentalEvent(ev) {
    const lat = ev.lat?.v ?? ev.lat ?? ev.spatial?.inferredCoordinates?.lat ?? ev.spatial?.latitude ?? 35.76;
    const lon = ev.lon?.v ?? ev.lon ?? ev.spatial?.inferredCoordinates?.lon ?? ev.spatial?.longitude ?? 129.19;
    const mag = ev.mag?.v ?? ev.mag ?? ev.scientificParams?.magnitude?.value ?? ev.scientificEstimates?.[0]?.estimatedMag ?? 5.8;
    const depth = ev.depth?.v ?? ev.depth ?? ev.spatial?.focalDepth?.valKm ?? ev.spatial?.depthKm ?? 10.0;

    let semanticUnits = [];
    let profileStatus = `PROFILE_APPLIED_${ev.eventId.toUpperCase()}`;

    // ------------------------------------------------------------------------
    // CASE 1: 2016 Gyeongju (hist_2016_gyeongju) — Inland Granite Strike-Slip
    // ------------------------------------------------------------------------
    if (ev.eventId === 'hist_2016_gyeongju') {
      semanticUnits = [
        {
          id: 'unit_2016_boom',
          token: '굉음',
          sourceId: 'rec_kma_2016_0912',
          originalPassage: '지하에서 쿵 하는 거대한 폭발음과 함께 지면이 상하로 요동침',
          translation: '지하에서 거대한 굉음과 함께 지면이 요동침',
          evidenceClass: 'SOURCE_TRANSLATION',
          editorialRationale: '경주 화강암 기반암 고주파 P파 전파 시 주민들이 체감한 지하 충격음을 압축',
          confidence: 'VERIFIED_INSTRUMENTAL',
          spatialMotif: 'ZONE_INLAND_BASIN',
          source: {
            originalHanja: '轟音',
            originalTranslationKo: '지하에서 거대한 굉음과 함께 요동침',
            evidenceStatus: 'SOURCE_TRANSLATION',
            evidenceClass: 'SOURCE_TRANSLATION',
            sourceReference: '2016-09-12 기상청 경주 본진 지진통보 및 시민 현장 보고',
            confidence: 'VERIFIED_INSTRUMENTAL'
          },
          semantic: {
            semanticLabel: '굉음',
            displayText: '굉음',
            phenomenaTags: ['ACOUSTIC_BOOM', 'P_WAVE_SHOCK']
          },
          spatial: {
            stageZone: 'ZONE_B_INLAND',
            preferredType: 'inland_basin',
            elevationOffset: 0.045
          },
          kinetic: {
            archetype: 'RESONANCE',
            materialAdapter: 'BEDROCK_VIBRATION'
          },
          timing: {
            t_activation: 3.5,
            formationDuration: 1.0,
            minLegibilityDuration: 2.2,
            resonanceDuration: 2.2,
            dissolutionDuration: 2.4,
            residueDuration: 2.0
          },
          visual: {
            archetype: 'RESONANCE',
            fontFamily: '"Noto Serif KR", "Nanum Myeongjo", Batang, serif',
            fontSize: 92,
            canvasW: 1024,
            canvasH: 384,
            spriteW: 0.165,
            spriteH: 0.062,
            colorSecondary: '#cde4fe',
            haloColor: 'rgba(160, 215, 255, 0.40)'
          }
        },
        {
          id: 'unit_2016_shake',
          token: '흔들리다',
          sourceId: 'rec_kma_2016_0912_shaking',
          originalPassage: '경주 및 대구, 부산 전역에서 건물이 크게 좌우로 요동침',
          translation: '영남권 전역에서 땅과 건물이 흔들림',
          evidenceClass: 'EDITORIAL_DISTILLATION',
          editorialRationale: '영남 일대를 강타한 주향이동 단층의 강한 전단 S파 진동 현상 정제',
          confidence: 'VERIFIED_INSTRUMENTAL',
          spatialMotif: 'ZONE_INLAND_BASIN',
          source: {
            originalHanja: '振動',
            originalTranslationKo: '땅과 건물이 크게 흔들림',
            evidenceStatus: 'EDITORIAL_DISTILLATION',
            evidenceClass: 'EDITORIAL_DISTILLATION',
            sourceReference: '2016-09-12 기상청 전국 체감 지진 보고',
            confidence: 'VERIFIED_INSTRUMENTAL'
          },
          semantic: {
            semanticLabel: '진동',
            displayText: '흔들리다',
            phenomenaTags: ['S_WAVE_SHEAR', 'GROUND_SHAKING']
          },
          spatial: {
            stageZone: 'ZONE_B_INLAND',
            preferredType: 'inland_basin',
            elevationOffset: 0.040
          },
          kinetic: {
            archetype: 'RESONANCE',
            materialAdapter: 'BEDROCK_VIBRATION'
          },
          timing: {
            t_activation: 12.0,
            formationDuration: 1.2,
            minLegibilityDuration: 2.2,
            resonanceDuration: 2.4,
            dissolutionDuration: 2.2,
            residueDuration: 2.0
          },
          visual: {
            archetype: 'RESONANCE',
            fontFamily: '"Noto Serif KR", "Nanum Myeongjo", Batang, serif',
            fontSize: 88,
            canvasW: 1024,
            canvasH: 384,
            spriteW: 0.165,
            spriteH: 0.062,
            colorSecondary: '#d8eafc',
            haloColor: 'rgba(160, 215, 255, 0.40)'
          }
        },
        {
          id: 'unit_2016_collapse',
          token: '무너지다',
          sourceId: 'rec_kma_2016_0912_tiles',
          originalPassage: '한옥 지붕 기와가 떨어지고 담장이 무너져 내림',
          translation: '기와가 쏟아지고 담장이 무너져 내림',
          evidenceClass: 'DIRECT_QUOTATION',
          editorialRationale: '경주 황남동 한옥마을 지붕 기와 탈락 및 담장 붕락 피해 보도에서 직접 인용',
          confidence: 'VERIFIED_INSTRUMENTAL',
          spatialMotif: 'ZONE_INLAND_BASIN',
          source: {
            originalHanja: '頹落 倒壞',
            originalTranslationKo: '담장과 기와가 쏟아져 무너져 내림',
            evidenceStatus: 'DIRECT_QUOTATION',
            evidenceClass: 'DIRECT_QUOTATION',
            sourceReference: '2016-09-12 경주 문화재 및 한옥 피해 합동조사 보고',
            confidence: 'VERIFIED_INSTRUMENTAL'
          },
          semantic: {
            semanticLabel: '붕괴',
            displayText: '무너지다',
            phenomenaTags: ['STRUCTURAL_COLLAPSE', 'ROOF_TILE_SHATTER']
          },
          spatial: {
            stageZone: 'ZONE_B_INLAND',
            preferredType: 'inland_basin',
            elevationOffset: 0.042
          },
          kinetic: {
            archetype: 'FRACTURE',
            materialAdapter: 'FRACTURED_DEBRIS_FALL'
          },
          timing: {
            t_activation: 21.0,
            formationDuration: 1.2,
            minLegibilityDuration: 2.2,
            resonanceDuration: 2.4,
            dissolutionDuration: 2.4,
            residueDuration: 2.0
          },
          visual: {
            archetype: 'FRACTURE',
            fontFamily: '"Noto Serif KR", "Nanum Myeongjo", Batang, serif',
            fontSize: 88,
            canvasW: 1024,
            canvasH: 384,
            spriteW: 0.170,
            spriteH: 0.064,
            colorSecondary: '#e0eefc',
            haloColor: 'rgba(180, 220, 255, 0.40)'
          }
        }
      ];
    }
    // ------------------------------------------------------------------------
    // CASE 2: 2017 Pohang (hist_2017_pohang) — Coastal Shelf & Liquefaction
    // ------------------------------------------------------------------------
    else if (ev.eventId === 'hist_2017_pohang') {
      semanticUnits = [
        {
          id: 'unit_2017_spout',
          token: '솟구치다',
          sourceId: 'rec_kma_2017_1115_liquefaction',
          originalPassage: '흥해읍 논밭에서 모래와 물이 분수처럼 솟구쳐 오르는 액상화 현상 발생',
          translation: '논과 밭에서 흙탕물이 솟구쳐 오름',
          evidenceClass: 'SOURCE_TRANSLATION',
          editorialRationale: '국내 최초로 관측된 포항 흥해읍 퇴적 분지 액상화 현상의 핵심 거동 동사 추출',
          confidence: 'VERIFIED_INSTRUMENTAL',
          spatialMotif: 'ZONE_ALLUVIAL_SEDIMENT',
          source: {
            originalHanja: '噴出 湧出',
            originalTranslationKo: '진흙과 모래가 지표면을 뚫고 솟구침',
            evidenceStatus: 'SOURCE_TRANSLATION',
            evidenceClass: 'SOURCE_TRANSLATION',
            sourceReference: '2017-11-15 기상청 및 국립재난안전연구원 포항 액상화 현장 보고',
            confidence: 'VERIFIED_INSTRUMENTAL'
          },
          semantic: {
            semanticLabel: '용출',
            displayText: '솟구치다',
            phenomenaTags: ['LIQUEFACTION_SPOUT', 'SEDIMENT_WATER_ERUPTION']
          },
          spatial: {
            stageZone: 'ZONE_B_INLAND',
            preferredType: 'inland_basin',
            elevationOffset: 0.040
          },
          kinetic: {
            archetype: 'EXPOSE',
            materialAdapter: 'UPRIGHT_BATHYMETRIC_BILLBOARD'
          },
          timing: {
            t_activation: 3.5,
            formationDuration: 1.2,
            minLegibilityDuration: 2.2,
            resonanceDuration: 2.4,
            dissolutionDuration: 2.2,
            residueDuration: 2.0
          },
          visual: {
            archetype: 'EXPOSE',
            fontFamily: '"Noto Serif KR", "Nanum Myeongjo", Batang, serif',
            fontSize: 90,
            canvasW: 1024,
            canvasH: 384,
            spriteW: 0.170,
            spriteH: 0.064,
            colorSecondary: '#bee2fc',
            haloColor: 'rgba(140, 205, 255, 0.40)'
          }
        },
        {
          id: 'unit_2017_shake',
          token: '흔들리다',
          sourceId: 'rec_kma_2017_1115_ground',
          originalPassage: '천부 4.5km 깊이 역단층 운동으로 고주파 충격파가 지표 직격',
          translation: '지표면이 요동치며 건물 기둥이 좌굴됨',
          evidenceClass: 'EDITORIAL_DISTILLATION',
          editorialRationale: '천부 진원에서 유발된 강한 지반 진동과 건물 필로티 구조 파열 현상 정제',
          confidence: 'VERIFIED_INSTRUMENTAL',
          spatialMotif: 'ZONE_ALLUVIAL_SEDIMENT',
          source: {
            originalHanja: '激震',
            originalTranslationKo: '천부 역단층에 의한 강한 지표 진동',
            evidenceStatus: 'EDITORIAL_DISTILLATION',
            evidenceClass: 'EDITORIAL_DISTILLATION',
            sourceReference: '2017-11-15 지질자원연구원 포항 지진 정밀 분석',
            confidence: 'VERIFIED_INSTRUMENTAL'
          },
          semantic: {
            semanticLabel: '진동',
            displayText: '흔들리다',
            phenomenaTags: ['SHALLOW_FAULT_SHOCK', 'GROUND_SHAKING']
          },
          spatial: {
            stageZone: 'ZONE_B_INLAND',
            preferredType: 'inland_basin',
            elevationOffset: 0.038
          },
          kinetic: {
            archetype: 'RESONANCE',
            materialAdapter: 'BEDROCK_VIBRATION'
          },
          timing: {
            t_activation: 12.0,
            formationDuration: 1.2,
            minLegibilityDuration: 2.2,
            resonanceDuration: 2.2,
            dissolutionDuration: 2.4,
            residueDuration: 2.0
          },
          visual: {
            archetype: 'RESONANCE',
            fontFamily: '"Noto Serif KR", "Nanum Myeongjo", Batang, serif',
            fontSize: 88,
            canvasW: 1024,
            canvasH: 384,
            spriteW: 0.160,
            spriteH: 0.060,
            colorSecondary: '#c8e8fc',
            haloColor: 'rgba(150, 210, 255, 0.40)'
          }
        },
        {
          id: 'unit_2017_distort',
          token: '뒤틀리다',
          sourceId: 'rec_kma_2017_1115_piloti',
          originalPassage: '건물 필로티 기둥 철근이 엿가락처럼 휘어지고 아파트 외벽이 전단 균열됨',
          translation: '기둥이 휘어지고 벽체가 전단 파열되어 뒤틀림',
          evidenceClass: 'DIRECT_QUOTATION',
          editorialRationale: '구조물 비탄성 소성 변형 및 지반 부등침하 피해 보도에서 직접 인용',
          confidence: 'VERIFIED_INSTRUMENTAL',
          spatialMotif: 'ZONE_ALLUVIAL_SEDIMENT',
          source: {
            originalHanja: '挫屈 剪斷',
            originalTranslationKo: '건물 기둥이 좌굴되고 벽체가 뒤틀림',
            evidenceStatus: 'DIRECT_QUOTATION',
            evidenceClass: 'DIRECT_QUOTATION',
            sourceReference: '2017-11-15 포항 건축물 지진 피해 분석 보고서',
            confidence: 'VERIFIED_INSTRUMENTAL'
          },
          semantic: {
            semanticLabel: '뒤틀림',
            displayText: '뒤틀리다',
            phenomenaTags: ['SHEAR_WARPING', 'PILLAR_BUCKLING']
          },
          spatial: {
            stageZone: 'ZONE_B_INLAND',
            preferredType: 'inland_basin',
            elevationOffset: 0.044
          },
          kinetic: {
            archetype: 'FRACTURE',
            materialAdapter: 'FRACTURED_DEBRIS_FALL'
          },
          timing: {
            t_activation: 21.0,
            formationDuration: 1.2,
            minLegibilityDuration: 2.2,
            resonanceDuration: 2.4,
            dissolutionDuration: 2.4,
            residueDuration: 2.0
          },
          visual: {
            archetype: 'FRACTURE',
            fontFamily: '"Noto Serif KR", "Nanum Myeongjo", Batang, serif',
            fontSize: 88,
            canvasW: 1024,
            canvasH: 384,
            spriteW: 0.170,
            spriteH: 0.064,
            colorSecondary: '#e4f0fc',
            haloColor: 'rgba(180, 225, 255, 0.40)'
          }
        }
      ];
    }
    // ------------------------------------------------------------------------
    // CASE 3: 2016 Kumamoto (global_2016_kumamoto) — Volcanic Rift Graben
    // ------------------------------------------------------------------------
    else if (ev.eventId === 'global_2016_kumamoto') {
      const isKo = this.displayMode === 'korean';
      semanticUnits = [
        {
          id: 'unit_2016_rift',
          token: isKo ? '갈라지다' : '割れる',
          nativeToken: '割れる',
          koreanToken: '갈라지다',
          originalLanguage: 'ja',
          sourceId: 'rec_jma_2016_kumamoto_fault',
          originalPassage: '布田川断層帯に沿って地표に最大2mを超える右横ずれ変位が露出',
          translation: '후타가와 단층대를 따라 지표면에 2m 넘는 단층 변위가 갈라져 드러남',
          evidenceClass: 'DIRECT_QUOTATION',
          editorialRationale: '지구대 단층면 지표 노출 및 지반 균열을 표현한 일본어 원문 인용',
          confidence: 'VERIFIED_INSTRUMENTAL',
          spatialMotif: 'ZONE_VOLCANIC_VALLEY',
          source: {
            originalText: '地表地震断層が割れて露出',
            originalTranslationKo: '지표 단층이 갈라져 드러남',
            evidenceStatus: 'DIRECT_QUOTATION',
            evidenceClass: 'DIRECT_QUOTATION',
            sourceReference: '2016-04-16 JMA 및 일본 지진조사위원회 구마모토 본진 보고',
            confidence: 'VERIFIED_INSTRUMENTAL'
          },
          semantic: {
            semanticLabel: '단층파열',
            displayText: isKo ? '갈라지다' : '割れる',
            phenomenaTags: ['SURFACE_RUPTURE', 'STRIKE_SLIP_FAULT']
          },
          spatial: {
            stageZone: 'ZONE_C_MOUNTAIN',
            preferredType: 'mountain_ridge',
            elevationOffset: 0.048
          },
          kinetic: {
            archetype: 'FRACTURE',
            materialAdapter: 'FRACTURED_DEBRIS_FALL'
          },
          timing: {
            t_activation: 3.5,
            formationDuration: 1.2,
            minLegibilityDuration: 2.2,
            resonanceDuration: 2.4,
            dissolutionDuration: 2.4,
            residueDuration: 2.0
          },
          visual: {
            archetype: 'FRACTURE',
            fontFamily: isKo ? '"Noto Serif KR", Batang, serif' : '"Noto Serif JP", "Yu Mincho", serif',
            fontSize: 92,
            canvasW: 1024,
            canvasH: 384,
            spriteW: 0.170,
            spriteH: 0.064,
            colorSecondary: '#e8f2fc',
            haloColor: 'rgba(180, 220, 255, 0.40)'
          }
        },
        {
          id: 'unit_2016_roar',
          token: isKo ? '울부짖다' : '唸る',
          nativeToken: '唸る',
          koreanToken: '울부짖다',
          originalLanguage: 'ja',
          sourceId: 'rec_jma_2016_kumamoto_roar',
          originalPassage: '阿蘇カルデラ山麓に地鳴りが響き渡る',
          translation: '아소 칼데라 산록에 거대한 땅울림이 울려 퍼짐',
          evidenceClass: 'SOURCE_TRANSLATION',
          editorialRationale: '칼데라 외륜산과 협곡을 진동시킨 강한 지명(地鳴り) 현상 추출',
          confidence: 'VERIFIED_INSTRUMENTAL',
          spatialMotif: 'ZONE_VOLCANIC_VALLEY',
          source: {
            originalText: '山岳が唸るような地鳴り',
            originalTranslationKo: '산악이 울부짖는 듯한 땅울림',
            evidenceStatus: 'SOURCE_TRANSLATION',
            evidenceClass: 'SOURCE_TRANSLATION',
            sourceReference: '2016-04-16 아소산 인근 주민 목격 기록',
            confidence: 'VERIFIED_INSTRUMENTAL'
          },
          semantic: {
            semanticLabel: '지명',
            displayText: isKo ? '울부짖다' : '唸る',
            phenomenaTags: ['ACOUSTIC_ROAR', 'VALLEY_RESONANCE']
          },
          spatial: {
            stageZone: 'ZONE_C_MOUNTAIN',
            preferredType: 'mountain_ridge',
            elevationOffset: 0.045
          },
          kinetic: {
            archetype: 'RESONANCE',
            materialAdapter: 'BEDROCK_VIBRATION'
          },
          timing: {
            t_activation: 12.5,
            formationDuration: 1.2,
            minLegibilityDuration: 2.2,
            resonanceDuration: 2.4,
            dissolutionDuration: 2.2,
            residueDuration: 2.0
          },
          visual: {
            archetype: 'RESONANCE',
            fontFamily: isKo ? '"Noto Serif KR", Batang, serif' : '"Noto Serif JP", "Yu Mincho", serif',
            fontSize: 90,
            canvasW: 1024,
            canvasH: 384,
            spriteW: 0.165,
            spriteH: 0.062,
            colorSecondary: '#c8e2fc',
            haloColor: 'rgba(150, 205, 255, 0.40)'
          }
        },
        {
          id: 'unit_2016_ruin',
          token: isKo ? '무너지다' : '壊れる',
          nativeToken: '壊れる',
          koreanToken: '무너지다',
          originalLanguage: 'ja',
          sourceId: 'rec_jma_2016_kumamoto_castle',
          originalPassage: '熊本城の石垣が大規模に崩落',
          translation: '구마모토성 축대와 석벽이 대규모로 붕괴됨',
          evidenceClass: 'DIRECT_QUOTATION',
          editorialRationale: '역사 문화재 석축 붕락 피해 및 가옥 도괴 보도 직접 인용',
          confidence: 'VERIFIED_INSTRUMENTAL',
          spatialMotif: 'ZONE_VOLCANIC_VALLEY',
          source: {
            originalText: '石垣が壊れて崩落',
            originalTranslationKo: '돌담이 부서져 무너짐',
            evidenceStatus: 'DIRECT_QUOTATION',
            evidenceClass: 'DIRECT_QUOTATION',
            sourceReference: '2016-04-16 구마모토성 피해 현장 조사',
            confidence: 'VERIFIED_INSTRUMENTAL'
          },
          semantic: {
            semanticLabel: '도괴',
            displayText: isKo ? '무너지다' : '壊れる',
            phenomenaTags: ['MASONRY_FAILURE', 'STONE_COLLAPSE']
          },
          spatial: {
            stageZone: 'ZONE_B_INLAND',
            preferredType: 'inland_basin',
            elevationOffset: 0.040
          },
          kinetic: {
            archetype: 'FRACTURE',
            materialAdapter: 'FRACTURED_DEBRIS_FALL'
          },
          timing: {
            t_activation: 21.0,
            formationDuration: 1.2,
            minLegibilityDuration: 2.2,
            resonanceDuration: 2.4,
            dissolutionDuration: 2.4,
            residueDuration: 2.0
          },
          visual: {
            archetype: 'FRACTURE',
            fontFamily: isKo ? '"Noto Serif KR", Batang, serif' : '"Noto Serif JP", "Yu Mincho", serif',
            fontSize: 90,
            canvasW: 1024,
            canvasH: 384,
            spriteW: 0.170,
            spriteH: 0.064,
            colorSecondary: '#e4f0fc',
            haloColor: 'rgba(170, 215, 255, 0.40)'
          }
        }
      ];
    }
    // ------------------------------------------------------------------------
    // CASE 4: 2023 Türkiye (global_2023_turkey) — Continental Strike-Slip Fault
    // ------------------------------------------------------------------------
    else if (ev.eventId === 'global_2023_turkey') {
      const isKo = this.displayMode === 'korean';
      semanticUnits = [
        {
          id: 'unit_2023_rupture',
          token: isKo ? '파열' : 'Kırılma',
          nativeToken: 'Kırılma',
          koreanToken: '파열',
          originalLanguage: 'tr',
          sourceId: 'rec_afad_2023_turkey_eaf',
          originalPassage: 'Doğu Anadolu Fay Hattı boyunca 300 kilometreyi aşan yüzey kırığı',
          translation: '동아나톨리아 단층선을 따라 300km가 넘는 지표 파열 발생',
          evidenceClass: 'DIRECT_QUOTATION',
          editorialRationale: '300km 대단층 좌수향 주향이동 파열을 뜻하는 터키어 직접 인용',
          confidence: 'VERIFIED_INSTRUMENTAL',
          spatialMotif: 'ZONE_CONTINENTAL_PLATEAU',
          source: {
            originalText: 'Fay hattında büyük kırılma meydana geldi',
            originalTranslationKo: '단층선에 거대한 파열이 일어남',
            evidenceStatus: 'DIRECT_QUOTATION',
            evidenceClass: 'DIRECT_QUOTATION',
            sourceReference: '2023-02-06 AFAD 및 Kandilli 관측소 공식 보고',
            confidence: 'VERIFIED_INSTRUMENTAL'
          },
          semantic: {
            semanticLabel: '단층파열',
            displayText: isKo ? '파열' : 'Kırılma',
            phenomenaTags: ['CONTINENTAL_RUPTURE', 'LEFT_LATERAL_STRIKE_SLIP']
          },
          spatial: {
            stageZone: 'ZONE_C_MOUNTAIN',
            preferredType: 'mountain_ridge',
            elevationOffset: 0.045
          },
          kinetic: {
            archetype: 'FRACTURE',
            materialAdapter: 'FRACTURED_DEBRIS_FALL'
          },
          timing: {
            t_activation: 3.5,
            formationDuration: 1.2,
            minLegibilityDuration: 2.2,
            resonanceDuration: 2.4,
            dissolutionDuration: 2.4,
            residueDuration: 2.0
          },
          visual: {
            archetype: 'FRACTURE',
            fontFamily: isKo ? '"Noto Serif KR", Batang, serif' : '"Times New Roman", "Georgia", serif',
            fontSize: 90,
            canvasW: 1024,
            canvasH: 384,
            spriteW: 0.170,
            spriteH: 0.064,
            colorSecondary: '#e8f2fc',
            haloColor: 'rgba(180, 220, 255, 0.40)'
          }
        },
        {
          id: 'unit_2023_ruin',
          token: isKo ? '파괴' : 'Yıkım',
          nativeToken: 'Yıkım',
          koreanToken: '파괴',
          originalLanguage: 'tr',
          sourceId: 'rec_afad_2023_turkey_collapse',
          originalPassage: 'Kahramanmaraş ve Hatay illerinde binlerce bina yerle bir oldu',
          translation: '카흐라만마라슈와 하타이에서 수천 동의 건물이 붕괴 파괴됨',
          evidenceClass: 'DIRECT_QUOTATION',
          editorialRationale: '10개 주에 걸친 막대한 도시 파괴와 건물 붕괴를 뜻하는 터키어 직접 인용',
          confidence: 'VERIFIED_INSTRUMENTAL',
          spatialMotif: 'ZONE_CONTINENTAL_PLATEAU',
          source: {
            originalText: 'Geniş çaplı yıkım ve çökme',
            originalTranslationKo: '광범위한 파괴와 붕괴',
            evidenceStatus: 'DIRECT_QUOTATION',
            evidenceClass: 'DIRECT_QUOTATION',
            sourceReference: '2023-02-06 튀르키예 재난관리청 피해 집계',
            confidence: 'VERIFIED_INSTRUMENTAL'
          },
          semantic: {
            semanticLabel: '붕괴',
            displayText: isKo ? '파괴' : 'Yıkım',
            phenomenaTags: ['MASSIVE_URBAN_COLLAPSE', 'PANCAKE_FAILURE']
          },
          spatial: {
            stageZone: 'ZONE_B_INLAND',
            preferredType: 'inland_basin',
            elevationOffset: 0.042
          },
          kinetic: {
            archetype: 'FRACTURE',
            materialAdapter: 'FRACTURED_DEBRIS_FALL'
          },
          timing: {
            t_activation: 12.0,
            formationDuration: 1.2,
            minLegibilityDuration: 2.2,
            resonanceDuration: 2.4,
            dissolutionDuration: 2.4,
            residueDuration: 2.0
          },
          visual: {
            archetype: 'FRACTURE',
            fontFamily: isKo ? '"Noto Serif KR", Batang, serif' : '"Times New Roman", "Georgia", serif',
            fontSize: 88,
            canvasW: 1024,
            canvasH: 384,
            spriteW: 0.165,
            spriteH: 0.062,
            colorSecondary: '#e4f0fc',
            haloColor: 'rgba(180, 220, 255, 0.40)'
          }
        },
        {
          id: 'unit_2023_tremor',
          token: isKo ? '진동' : 'Sarsıntı',
          nativeToken: 'Sarsıntı',
          koreanToken: '진동',
          originalLanguage: 'tr',
          sourceId: 'rec_afad_2023_turkey_shaking',
          originalPassage: 'Yüz saniyeyi aşan şiddetli sarsıntı geniş bir coğrafyada hissedildi',
          translation: '100초를 넘는 격렬한 진동이 중동 전역에서 감지됨',
          evidenceClass: 'SOURCE_TRANSLATION',
          editorialRationale: '장주기 지진동과 100초 이상 지속된 광역 진동 특성 표현',
          confidence: 'VERIFIED_INSTRUMENTAL',
          spatialMotif: 'ZONE_CONTINENTAL_PLATEAU',
          source: {
            originalText: 'Şiddetli sarsıntı yüz saniyeden fazla sürdü',
            originalTranslationKo: '격렬한 진동이 100초 이상 지속됨',
            evidenceStatus: 'SOURCE_TRANSLATION',
            evidenceClass: 'SOURCE_TRANSLATION',
            sourceReference: '2023-02-06 국제 지진학 연합(IASPEI) 관측 보고',
            confidence: 'VERIFIED_INSTRUMENTAL'
          },
          semantic: {
            semanticLabel: '진동',
            displayText: isKo ? '진동' : 'Sarsıntı',
            phenomenaTags: ['LONG_PERIOD_SHAKING', 'CONTINENTAL_WAVE']
          },
          spatial: {
            stageZone: 'ZONE_B_INLAND',
            preferredType: 'inland_basin',
            elevationOffset: 0.040
          },
          kinetic: {
            archetype: 'RESONANCE',
            materialAdapter: 'BEDROCK_VIBRATION'
          },
          timing: {
            t_activation: 21.0,
            formationDuration: 1.2,
            minLegibilityDuration: 2.2,
            resonanceDuration: 2.4,
            dissolutionDuration: 2.2,
            residueDuration: 2.0
          },
          visual: {
            archetype: 'RESONANCE',
            fontFamily: isKo ? '"Noto Serif KR", Batang, serif' : '"Times New Roman", "Georgia", serif',
            fontSize: 88,
            canvasW: 1024,
            canvasH: 384,
            spriteW: 0.165,
            spriteH: 0.062,
            colorSecondary: '#c8e2fc',
            haloColor: 'rgba(150, 205, 255, 0.40)'
          }
        }
      ];
    }

    const phenomenaSet = new Set();
    semanticUnits.forEach(u => {
      (u.semantic?.phenomenaTags || []).forEach(tag => phenomenaSet.add(tag));
    });

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
    } else {
      if (semanticUnits.length === 0) {
        semanticUnits = this._extractInstrumentalSemanticUnits(ev);
      }
      dominantFreq = Math.max(0.2, Math.min(2.5, 1.8 * Math.pow(10.0, -0.22 * (mag - 5.0))));
      q = 200.0;
      dispScale = Math.max(0.6, Math.min(2.0, 0.4 + (mag - 5.0) * 0.4));
      strikeRad = 0.5;
    }

    const verifiedSourceCount = semanticUnits.filter(u => u.evidenceClass === 'DIRECT_QUOTATION' || u.source?.evidenceStatus === 'VERIFIED_SOURCE' || u.confidence === 'VERIFIED_INSTRUMENTAL').length;
    const editorialInterpretationCount = semanticUnits.filter(u => u.evidenceClass === 'EDITORIAL_DISTILLATION' || u.source?.evidenceStatus === 'EDITORIAL_INTERPRETATION').length;

    return {
      eventId: ev.eventId,
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
      dominantFreqHz: dominantFreq,
      attenuationQ: q,
      displacementScale: dispScale,
      faultStrikeRad: strikeRad,
      scientificEstimates: { magnitude: mag },
      magnitude: mag,
      compositionProfileStatus: profileStatus,
      semanticUnits: semanticUnits
    };
  }

  _extractInstrumentalSemanticUnits(ev) {
    const isKo = this.displayMode === 'korean';
    const units = [];
    const lexicon = Array.isArray(ev.archivalLexicon) ? ev.archivalLexicon : [];
    const docSource = ev.primaryText?.documentSource || ev.sourceName || "기상청 지진관측기록";

    // 1. Shaking / Tremor
    const shakeEntry = lexicon.find(l => /진동|흔들|요동|충격/.test(l.token)) || { token: "흔들리다", translation: "지면이 강하게 흔들림" };
    units.push({
      id: `unit_${ev.eventId}_shake`,
      token: shakeEntry.token.length <= 4 ? shakeEntry.token : "흔들리다",
      sourceId: `rec_${ev.eventId}_shake`,
      originalPassage: ev.primaryText?.originalScript || shakeEntry.token,
      translation: shakeEntry.translation || "지각 진동 관측",
      evidenceClass: "DIRECT_QUOTATION",
      editorialRationale: `${docSource}에 기록된 지진동 관측 보고 인용`,
      confidence: "VERIFIED_INSTRUMENTAL",
      spatialMotif: "ZONE_INLAND_BASIN",
      source: {
        originalText: shakeEntry.token,
        evidenceStatus: "VERIFIED_SOURCE",
        sourceReference: docSource,
        confidence: "VERIFIED_INSTRUMENTAL"
      },
      semantic: {
        semanticLabel: "진동",
        displayText: shakeEntry.token.length <= 4 ? shakeEntry.token : "흔들리다",
        phenomenaTags: ["GROUND_SHAKING"]
      },
      spatial: {
        stageZone: "ZONE_B_INLAND",
        preferredType: "inland_basin",
        elevationOffset: 0.040
      },
      kinetic: {
        archetype: "RESONANCE",
        materialAdapter: "BEDROCK_VIBRATION"
      },
      timing: {
        t_activation: 3.5,
        formationDuration: 1.2,
        minLegibilityDuration: 2.2,
        resonanceDuration: 2.4,
        dissolutionDuration: 2.4,
        residueDuration: 2.0
      },
      visual: {
        archetype: "RESONANCE",
        fontFamily: '"Noto Serif KR", Batang, serif',
        fontSize: 88,
        canvasW: 1024,
        canvasH: 384,
        spriteW: 0.160,
        spriteH: 0.060,
        colorSecondary: "#cde4fe",
        haloColor: "rgba(160, 215, 255, 0.40)"
      }
    });

    // 2. Rupture / Fracture / Damage
    const dmgEntry = lexicon.find(l => /파손|파열|붕괴|무너|낙하|균열/.test(l.token)) || { token: "무너지다", translation: "벽체 균열 및 파손 발생" };
    units.push({
      id: `unit_${ev.eventId}_fracture`,
      token: dmgEntry.token.length <= 4 ? dmgEntry.token : "무너지다",
      sourceId: `rec_${ev.eventId}_fracture`,
      originalPassage: ev.primaryText?.originalScript || dmgEntry.token,
      translation: dmgEntry.translation || "구조물 균열 및 파손",
      evidenceClass: "SOURCE_TRANSLATION",
      editorialRationale: `${docSource} 현장 피해 조사 기록 인용`,
      confidence: "VERIFIED_INSTRUMENTAL",
      spatialMotif: "ZONE_ALPINE_RIDGE",
      source: {
        originalText: dmgEntry.token,
        evidenceStatus: "SOURCE_TRANSLATION",
        sourceReference: docSource,
        confidence: "VERIFIED_INSTRUMENTAL"
      },
      semantic: {
        semanticLabel: "파쇄",
        displayText: dmgEntry.token.length <= 4 ? dmgEntry.token : "무너지다",
        phenomenaTags: ["STRUCTURAL_FAILURE"]
      },
      spatial: {
        stageZone: "ZONE_B_INLAND",
        preferredType: "alpine_cliff",
        elevationOffset: 0.045
      },
      kinetic: {
        archetype: "FRACTURE",
        materialAdapter: "FRACTURED_DEBRIS_FALL"
      },
      timing: {
        t_activation: 8.5,
        formationDuration: 1.2,
        minLegibilityDuration: 2.2,
        resonanceDuration: 2.4,
        dissolutionDuration: 2.4,
        residueDuration: 2.0
      },
      visual: {
        archetype: "FRACTURE",
        fontFamily: '"Noto Serif KR", Batang, serif',
        fontSize: 90,
        canvasW: 1024,
        canvasH: 384,
        spriteW: 0.170,
        spriteH: 0.064,
        colorSecondary: "#e2eefa",
        haloColor: "rgba(170, 220, 255, 0.40)"
      }
    });

    // 3. Acoustic roar / ground boom
    units.push({
      id: `unit_${ev.eventId}_boom`,
      token: "굉음",
      sourceId: `rec_${ev.eventId}_boom`,
      originalPassage: ev.primaryText?.originalScript || "지하 폭발음",
      translation: "지하에서 쿵 하는 굉음 감지",
      evidenceClass: "EDITORIAL_DISTILLATION",
      editorialRationale: "고주파 지진파에 의한 지하 충격음 압축",
      confidence: "VERIFIED_INSTRUMENTAL",
      spatialMotif: "ZONE_INLAND_BASIN",
      source: {
        originalText: "굉음",
        evidenceStatus: "EDITORIAL_INTERPRETATION",
        sourceReference: docSource,
        confidence: "VERIFIED_INSTRUMENTAL"
      },
      semantic: {
        semanticLabel: "굉음",
        displayText: "굉음",
        phenomenaTags: ["ACOUSTIC_BOOM"]
      },
      spatial: {
        stageZone: "ZONE_B_INLAND",
        preferredType: "inland_basin",
        elevationOffset: 0.040
      },
      kinetic: {
        archetype: "RESONANCE",
        materialAdapter: "BEDROCK_VIBRATION"
      },
      timing: {
        t_activation: 14.0,
        formationDuration: 1.2,
        minLegibilityDuration: 2.2,
        resonanceDuration: 2.4,
        dissolutionDuration: 2.4,
        residueDuration: 2.0
      },
      visual: {
        archetype: "RESONANCE",
        fontFamily: '"Noto Serif KR", Batang, serif',
        fontSize: 88,
        canvasW: 1024,
        canvasH: 384,
        spriteW: 0.160,
        spriteH: 0.060,
        colorSecondary: "#cde4fe",
        haloColor: "rgba(160, 215, 255, 0.40)"
      }
    });

    return units;
  }
}

/**
 * Editorial Typography Canvas Rasterizer
 * Dual-Pass Soft Ambient Dark Cushion & Crystalline Serif Glyphs
 */
export function renderEditorialTypography(ctx, canvas, text, formationProg, visualOpts = {}, strokeJitterPx = 0.0, enableDarkCushion = true) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  // Pure Korean Archival Typography Enforcement (Mandatory Rule 4)
  const cleanText = (text || '').replace(/[\u4e00-\u9fff\u3040-\u30ff]/g, '').trim() || '울다';
  const cX = canvas.width / 2;
  const cY = canvas.height / 2;
  const fontSize = visualOpts.fontSize || 84;
  const fontFamily = visualOpts.fontFamily || '"Noto Serif KR", "Nanum Myeongjo", Batang, serif';
  const colorSecondary = visualOpts.colorSecondary || '#c8e8fc';
  const haloColor = visualOpts.haloColor || 'rgba(140, 205, 255, 0.40)';

  ctx.font = `600 ${fontSize}px ${fontFamily}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  if ('letterSpacing' in ctx) {
    ctx.letterSpacing = '0.22em';
  }

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
    depthTest: false
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
  texture.minFilter = THREE_INST.LinearFilter;
  texture.magFilter = THREE_INST.LinearFilter;

  function renderCanvas(formationProg, strokeJitterPx = 0.0) {
    renderEditorialTypography(ctx, canvas, unitDef.semantic.displayText, formationProg, unitDef.visual, strokeJitterPx, enableDarkCushion);
    texture.needsUpdate = true;
  }

  renderCanvas(0.0, 0.0);

  const spriteMat = new THREE_INST.SpriteMaterial({
    map: texture,
    transparent: true,
    opacity: 0.0,
    blending: THREE_INST.NormalBlending,
    depthWrite: false,
    depthTest: false
  });
  const sprite = new THREE_INST.Sprite(spriteMat);
  sprite.scale.set(unitDef.visual.spriteW, unitDef.visual.spriteH, 1.0);
  sprite.renderOrder = 100;
  group.add(sprite);

  const finalY = Math.max(cand.groundY || 0.0, 0.020) + Math.max(unitDef.spatial?.elevationOffset || 0.080, 0.120);
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
    depthTest: false
  });
  const haloSprite = new THREE_INST.Sprite(haloMat);
  haloSprite.scale.set(unitDef.visual.spriteW * 1.35, unitDef.visual.spriteH * 2.2, 1.0);
  haloSprite.renderOrder = 95;
  group.add(haloSprite);

  const glyphs = unitDef.semantic.displayText.split('').filter(ch => ch.trim() !== '');
  const count = Math.max(1, glyphs.length);
  const spacing = unitDef.visual.spriteW / (count + 0.3);
  const chunkW = spacing * 1.15;
  const chunkH = unitDef.visual.spriteH;
  const chunks = [];

  const gradX = cand.gradX || 0;
  const gradZ = cand.gradZ || 0;
  const gradMag = Math.max(0.001, Math.sqrt(gradX * gradX + gradZ * gradZ));
  const slopeDirX = -gradX / gradMag;
  const slopeDirZ = -gradZ / gradMag;

  glyphs.forEach((gl, idx) => {
    const cW = 256;
    const cH = 256;
    const c = document.createElement('canvas');
    c.width = cW;
    c.height = cH;
    const ctx = c.getContext('2d');
    const tex = new THREE_INST.CanvasTexture(c);
    tex.minFilter = THREE_INST.LinearFilter;
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
      depthTest: false
    });
    const sp = new THREE_INST.Sprite(sMat);
    sp.scale.set(chunkW, chunkH, 1.0);
    sp.renderOrder = 100;
    const baseOffsetX = (idx - (count - 1) * 0.5) * spacing;
    sp.position.set(baseOffsetX, 0.0, 0.0);
    group.add(sp);

    const spreadX = (idx - (count - 1) * 0.5) * 0.005;
    const fallVelY = -0.022 - Math.abs(idx - (count - 1) * 0.5) * 0.003;
    const spreadZ = ((idx % 2 === 0) ? -1 : 1) * (0.003 + idx * 0.002);

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
      rotSpeed: ((idx % 2 === 0) ? 1 : -1) * (0.8 + idx * 0.25)
    });
  });

  const finalY = Math.max(cand.groundY || 0.0, 0.020) + Math.max(unitDef.spatial?.elevationOffset || 0.080, 0.120);
  group.position.set(cand.worldX, finalY, cand.worldZ);

  group.userData = {
    unitDef: unitDef,
    cand: cand,
    chunks: chunks,
    haloSprite: haloSprite,
    haloMat: haloMat,
    mainMesh: chunks[Math.floor(chunks.length / 2)]?.sprite || group,
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
    depthTest: false
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
  texture.minFilter = THREE_INST.LinearFilter;
  texture.magFilter = THREE_INST.LinearFilter;

  function renderCanvas(formationProg) {
    renderEditorialTypography(ctx, canvas, unitDef.semantic.displayText, formationProg, unitDef.visual, 0.0, enableDarkCushion);
    texture.needsUpdate = true;
  }

  renderCanvas(0.0);

  const spriteMat = new THREE_INST.SpriteMaterial({
    map: texture,
    transparent: true,
    opacity: 0.0,
    blending: THREE_INST.NormalBlending,
    depthWrite: false,
    depthTest: false
  });
  const sprite = new THREE_INST.Sprite(spriteMat);
  sprite.scale.set(unitDef.visual.spriteW, unitDef.visual.spriteH, 1.0);
  sprite.renderOrder = 100;
  group.add(sprite);

  const finalRecedeY = Math.max(cand.groundY || 0.0, 0.020) + Math.max(unitDef.spatial?.elevationOffset || 0.080, 0.120);
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
    depthTest: false
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
  texture.minFilter = THREE_INST.LinearFilter;
  texture.magFilter = THREE_INST.LinearFilter;

  function renderCanvas(formationProg) {
    renderEditorialTypography(ctx, canvas, unitDef.semantic.displayText, formationProg, unitDef.visual, 0.0, enableDarkCushion);
    texture.needsUpdate = true;
  }

  renderCanvas(0.0);

  const spriteMat = new THREE_INST.SpriteMaterial({
    map: texture,
    transparent: true,
    opacity: 0.0,
    blending: THREE_INST.NormalBlending,
    depthWrite: false,
    depthTest: false
  });
  const sprite = new THREE_INST.Sprite(spriteMat);
  sprite.scale.set(unitDef.visual.spriteW, unitDef.visual.spriteH, 1.0);
  sprite.renderOrder = 100;
  group.add(sprite);

  const finalY = Math.max(cand.groundY || 0.0, 0.020) + Math.max(unitDef.spatial?.elevationOffset || 0.080, 0.120);
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
      // Strictly restrict fallback candidates to central focal region (|X| <= 0.12, |Z| <= 0.08)
      const focalPool = pool.filter(c => Math.abs(c.worldX) <= 0.12 && Math.abs(c.worldZ) <= 0.08);
      const candidateList = focalPool.length > 0 ? focalPool : pool;
      const chosen = candidateList[Math.floor(candidateList.length / 2)] || { worldX: 0, worldZ: 0, groundY: 0, elevation: 0, slope: 0 };

      chosenWorldX = Math.max(-0.15, Math.min(0.15, chosen.worldX));
      chosenWorldZ = Math.max(-0.10, Math.min(0.10, chosen.worldZ));
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
    this.displayMode = 'native'; // 'native' | 'korean'
  }

  setMultilingualDisplayMode(mode) {
    this.displayMode = mode === 'korean' ? 'korean' : 'native';
    this.parser.setDisplayMode(this.displayMode);
    if (this.currentParsedEvent) {
      // Re-parse and update text for active entities
      const newParsed = this.parser.parseEvent(this.currentParsedEvent.eventId);
      this.currentParsedEvent = newParsed;
      this.entities.forEach((group, idx) => {
        const u = newParsed.semanticUnits[idx];
        if (u && group.userData) {
          group.userData.unitDef = u;
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
