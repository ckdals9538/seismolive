// ============================================================================
// SeismoLive v4.0 (v4.1 Delta Blueprint) - Instrumental Earthquake Catalog DB
// Post-1905 Instrumental Catalogs (ERA 2, ERA 3, ERA 4; strictly >= 1905 AD)
// Separated from historicalArchiveDB.js to enforce 4-Era Epistemological Boundary:
//   - ERA_2_1905_1977_EARLY_HYBRID   (1905–1977 Early Mechanical / Wiechert Era)
//   - ERA_3_1978_1998_ANALOG_NETWORK (1978–1998 KMA Early Analog Network)
//   - ERA_4_1999_PRESENT_DIGITAL     (1999–Present Modern Broadband Digital Network)
// ============================================================================

import { KMA_ARCHIVE_URL } from './historicalArchiveDB.js';

const F = (v, ver, src, note = null) => ({ v, ver, src, note });

export const INSTRUMENTAL_EVENTS = [
  // ==========================================================================
  // ERA 2: 1905–1977 EARLY HYBRID / MECHANICAL SEISMOGRAPH ERA
  // ==========================================================================
  {
    eventId: "inst_1936_ssanggyesa",
    id: "inst_1936_ssanggyesa",
    era: "ERA_2_1905_1977_EARLY_HYBRID",
    century: 20,
    catalogType: "INSTRUMENTAL_EARLY",
    country: "KOREA",
    recordType: "instrumental-early",
    sourceName: "조선총독부 관측소 지진연보 및 기상청 주요지진 기록",
    verification: "kma-verified",
    kind: "instrumental-early",
    place: "1936 지리산 쌍계사 지진",
    dateText: "1936-07-04 06:02:16 KST",
    datePrecision: "second",
    temporal: {
      gregorianDate: "1936-07-04",
      gregorianPrecision: "SECOND",
      originTimeUTC: "1936-07-03T21:02:16Z"
    },
    spatial: {
      placeName: "경상남도 하동군 화개면 지리산 쌍계사 일원",
      inferredCoordinates: {
        lat: 35.23,
        lon: 127.65,
        coordinateConfidence: "INSTRUMENTAL_ANALOG_EARLY",
        errorRadiusKm: 18.0
      },
      focalDepth: {
        valKm: null,
        isKnown: false,
        determinationType: "UNKNOWN_UNRECORDED",
        comment: "근대 초기 기계식 지진계 관측으로 정밀 진원 깊이 미산출"
      }
    },
    time: F(Date.parse("1936-07-03T21:02:16Z"), "kma-verified", "근대 기계식 지진계 관측 시각"),
    lat: F(35.23, "kma-verified", "하동 쌍계사 일대 진앙 추정치"),
    lon: F(127.65, "kma-verified", "하동 쌍계사 일대 진앙 추정치"),
    depth: F(null, "unknown", "진원 깊이 미상"),
    mag: F(5.1, "secondary", "M 5.1 (초기 계측 추정 규모)"),
    magType: "ML",
    scientificEstimates: [
      {
        source: "기상청 주요지진 아카이브 (KMA)",
        estimatedMag: 5.1,
        magType: "ML",
        confidence: "OFFICIAL_HISTORICAL_REPORT"
      }
    ],
    macroseismic: {
      maxIntensityMMI: {
        rawRoman: "VII~VIII",
        numericEquivalent: 7.5,
        scale: "MMI",
        basis: "쌍계사 대웅전 천장 낙하, 담장 붕괴 및 산사태 발생"
      },
      feltRegionCount: 7,
      damageClass: 3,
      tsunamiObserved: false
    },
    rawValues: {
      rawI: 7.5,
      rawA: 30000,
      rawNloc: 7,
      rawFp: 3.2,
      rawNrep: 8,
      rawDclass: 3,
      rawD5: null
    },
    primaryText: {
      originalScript: "지리산 쌍계사 부근에서 발생한 규모 5.1 지진으로 쌍계사 경내 전각과 돌담이 파손되고 바위가 무너져 내림.",
      scriptLanguage: "ko-KR-modern",
      documentSource: "기상청 주요지진 아카이브 (1936 쌍계사 지진)",
      sourceLocation: "경상남도 하동군 화개면"
    },
    archivalLexicon: [
      { token: "지리산 쌍계사 부근에서 발생한 규모 5.1 지진", displayKo: "지리산 쌍계사 부근에서 발생한 규모 5.1 지진", category: "place", archetype: "RESONANCE", stageZone: "ZONE_B_INLAND", language: "ko-KR-official", translation: "지리산 쌍계사 부근에서 발생한 규모 5.1 지진" },
      { token: "쌍계사 경내 전각과 돌담이 파손되고", displayKo: "쌍계사 경내 전각과 돌담이 파손되고", category: "structure", archetype: "FRACTURE", stageZone: "ZONE_B_INLAND", language: "ko-KR-official", translation: "쌍계사 경내 전각과 돌담이 파손되고" },
      { token: "바위가 무너져 내림", displayKo: "바위가 무너져 내림", category: "geology", archetype: "FRACTURE", stageZone: "ZONE_C_MOUNTAIN", language: "ko-KR-official", translation: "바위가 무너져 내림" }
    ],
    text: "지리산 쌍계사 부근에서 발생한 규모 5.1 지진으로 전각과 돌담이 파손되고 바위가 무너져 내림.",
    originalText: "지리산 쌍계사 부근에서 발생한 규모 5.1 지진으로 전각과 돌담이 파손되고 바위가 무너져 내림.",
    uncertainty: "근대 초기 지진계(인천·부산·대구 관측소) 관측 자료로 진원 깊이 미상, 위치 오차 ±18km",
    links: [{ label: "KMA 지진 아카이브", url: KMA_ARCHIVE_URL }]
  },

  {
    eventId: "inst_1952_pyongyang",
    id: "inst_1952_pyongyang",
    era: "ERA_2_1905_1977_EARLY_HYBRID",
    century: 20,
    catalogType: "INSTRUMENTAL_EARLY",
    country: "KOREA",
    recordType: "instrumental-early",
    sourceName: "ISC / USGS Historical Instrumental Catalog",
    verification: "secondary",
    kind: "instrumental-early",
    place: "1952 평양 서쪽(강서·증산) 지진",
    dateText: "1952-03-19 18:04:19 KST",
    datePrecision: "second",
    temporal: {
      gregorianDate: "1952-03-19",
      gregorianPrecision: "SECOND",
      originTimeUTC: "1952-03-19T09:04:19Z"
    },
    spatial: {
      placeName: "평안남도 강서군·온천군 일원",
      inferredCoordinates: {
        lat: 38.90,
        lon: 125.40,
        coordinateConfidence: "INSTRUMENTAL_ANALOG_EARLY",
        errorRadiusKm: 20.0
      },
      focalDepth: {
        valKm: null,
        isKnown: false,
        determinationType: "UNKNOWN_UNRECORDED",
        comment: "한국전쟁기 국외 원거리 지진계 관측으로 정밀 진원 깊이 불확실"
      }
    },
    time: F(Date.parse("1952-03-19T09:04:19Z"), "secondary", "ISC 국제지진센터 원거리 관측"),
    lat: F(38.90, "secondary", "ISC/USGS 원거리 역산 좌표"),
    lon: F(125.40, "secondary", "ISC/USGS 원거리 역산 좌표"),
    depth: F(null, "unknown", "정밀 진원 깊이 미확정"),
    mag: F(6.2, "secondary", "Mw 6.2 (ISC-GEM 재결정)"),
    magType: "Mw",
    scientificEstimates: [
      {
        source: "ISC-GEM Global Instrumental Catalog",
        estimatedMag: 6.2,
        magType: "Mw",
        confidence: "PRIMARY_OFFICIAL"
      }
    ],
    macroseismic: {
      maxIntensityMMI: {
        rawRoman: "VII~VIII",
        numericEquivalent: 7.5,
        scale: "MMI",
        basis: "평남 서부 강진동 및 구조물 피해"
      },
      feltRegionCount: 10,
      damageClass: 3,
      tsunamiObserved: false
    },
    rawValues: {
      rawI: 7.5,
      rawA: 70000,
      rawNloc: 10,
      rawFp: 2.4,
      rawNrep: 6,
      rawDclass: 3,
      rawD5: null
    },
    primaryText: {
      originalScript: "평양 서쪽 강서·온천 일대에서 발생한 규모 6.2 지진으로 20세기 한반도 내륙 최대 규모 계기지진으로 기록됨.",
      scriptLanguage: "ko-KR-modern",
      documentSource: "ISC-GEM 글로벌 계기지진 목록",
      sourceLocation: "평안남도 강서군 일원"
    },
    archivalLexicon: [
      { token: "평양 서쪽 강서·온천 일대에서 발생한 규모 6.2 지진", displayKo: "평양 서쪽 강서·온천 일대에서 발생한 규모 6.2 지진", category: "place", archetype: "RESONANCE", stageZone: "ZONE_B_INLAND", language: "ko-KR-official", translation: "평양 서쪽 강서·온천 일대에서 발생한 규모 6.2 지진" },
      { token: "20세기 한반도 내륙 최대 규모 계기지진으로 기록됨", displayKo: "20세기 한반도 내륙 최대 규모 계기지진으로 기록됨", category: "phenomenon", archetype: "RESONANCE", stageZone: "ZONE_B_INLAND", language: "ko-KR-official", translation: "20세기 한반도 내륙 최대 규모 계기지진으로 기록됨" },
      { token: "평남 서부 강진동 및 구조물 피해", displayKo: "평남 서부 강진동 및 구조물 피해", category: "structure", archetype: "FRACTURE", stageZone: "ZONE_C_MOUNTAIN", language: "ko-KR-official", translation: "평남 서부 강진동 및 구조물 피해" }
    ],
    text: "평양 서쪽 강서·온천 일대에서 발생한 규모 6.2 지진으로 20세기 한반도 내륙 최대 규모 계기지진.",
    originalText: "평양 서쪽 강서·온천 일대에서 발생한 규모 6.2 지진으로 20세기 한반도 내륙 최대 규모 계기지진.",
    uncertainty: "전쟁기 국외 원거리 관측소 자료 역산 (위치 오차 ±20km, 심도 미확정)",
    links: [{ label: "KMA 지진 아카이브", url: KMA_ARCHIVE_URL }]
  },

  // ==========================================================================
  // ERA 3: 1978–1998 EARLY KMA ANALOG SEISMOGRAPH NETWORK ERA
  // ==========================================================================
  {
    eventId: "hist_1978_songnisan",
    id: "hist_1978_songnisan",
    era: "ERA_3_1978_1998_ANALOG_NETWORK",
    century: 20,
    catalogType: "INSTRUMENTAL_EARLY",
    country: "KOREA",
    recordType: "instrumental-early",
    sourceName: "기상청 지진관측보고 인용 학술 논문 (대한지질공학회지)",
    verification: "secondary",
    kind: "instrumental-early",
    place: "1978 속리산 지진",
    dateText: "1978-09-16 02:07:05.8 KST",
    datePrecision: "second",
    temporal: {
      gregorianDate: "1978-09-16",
      gregorianPrecision: "SECOND",
      originTimeUTC: "1978-09-15T17:07:05.8Z"
    },
    spatial: {
      placeName: "충청북도 보은군 속리산 일대",
      inferredCoordinates: {
        lat: 36.6,
        lon: 127.9,
        coordinateConfidence: "INSTRUMENTAL_ANALOG_EARLY",
        errorRadiusKm: 15.0
      },
      focalDepth: {
        valKm: null,
        isKnown: false,
        determinationType: "UNKNOWN_UNRECORDED",
        comment: "초기 아날로그 지진계 관측망으로 진원 깊이 산출 불가"
      }
    },
    time: F(Date.parse("1978-09-15T17:07:05.8Z"), "secondary", "지진관측보고 1978–2000 재인용"),
    lat: F(36.6, "secondary", "초기 아날로그 지진계 분석치 (오차 수십 km)"),
    lon: F(127.9, "secondary", "초기 아날로그 지진계 분석치"),
    depth: F(null, "unknown", "기록 없음 (깊이 미상)"),
    mag: F(5.2, "secondary", "ML 5.2 (KMA)"),
    magType: "ML",
    scientificEstimates: [
      {
        source: "기상청 공식 (지진관측보고)",
        estimatedMag: 5.2,
        magType: "ML",
        confidence: "OFFICIAL_HISTORICAL_REPORT"
      }
    ],
    macroseismic: {
      maxIntensityMMI: {
        rawRoman: "VI",
        numericEquivalent: 6.0,
        scale: "MMI",
        basis: "가옥 균열, 낙석, 충청·전라·경상 유감"
      },
      feltRegionCount: 8,
      damageClass: 2,
      tsunamiObserved: false
    },
    rawValues: {
      rawI: 6.0,
      rawA: 40000,
      rawNloc: 8,
      rawFp: 3.5,
      rawNrep: 10,
      rawDclass: 2,
      rawD5: null
    },
    primaryText: {
      originalScript: "충북 속리산 부근에서 발생한 규모 5.2 지진으로 한반도 중남부 전역에서 강한 진동이 감지되고 가옥 균열이 발생함.",
      scriptLanguage: "ko-KR-modern",
      documentSource: "기상청 지진관측보고 1978-2000",
      sourceLocation: "충청북도 보은군 속리산 일대"
    },
    archivalLexicon: [
      { token: "충북 속리산 부근에서 발생한 규모 5.2 지진", displayKo: "충북 속리산 부근에서 발생한 규모 5.2 지진", category: "place", archetype: "RESONANCE", stageZone: "ZONE_B_INLAND", language: "ko-KR-official", translation: "충북 속리산 부근에서 발생한 규모 5.2 지진" },
      { token: "한반도 중남부 전역에서 강한 진동이 감지되고", displayKo: "한반도 중남부 전역에서 강한 진동이 감지되고", category: "phenomenon", archetype: "RESONANCE", stageZone: "ZONE_B_INLAND", language: "ko-KR-official", translation: "한반도 중남부 전역에서 강한 진동이 감지되고" },
      { token: "가옥 균열이 발생함", displayKo: "가옥 균열이 발생함", category: "structure", archetype: "FRACTURE", stageZone: "ZONE_B_INLAND", language: "ko-KR-official", translation: "가옥 균열이 발생함" },
      { token: "암석 낙하가 발생함", displayKo: "암석 낙하가 발생함", category: "geology", archetype: "FRACTURE", stageZone: "ZONE_C_MOUNTAIN", language: "ko-KR-official", translation: "속리산 일대에서 강한 지동을 느끼고 가옥 균열과 암석 낙하가 발생함" }
    ],
    text: "속리산 일대에서 강한 지동을 느끼고 가옥 균열과 암석 낙하가 발생함.",
    originalText: "속리산 일대에서 강한 지동을 느끼고 가옥 균열과 암석 낙하가 발생함.",
    uncertainty: "초기 아날로그 관측망으로 진앙 위치 오차(±10~15km) 및 진원 깊이 미상",
    links: [{ label: "지질공학회지 논문 원문 (PDF)", url: "https://www.jgsk.or.kr/xml/38531/38531.pdf" }]
  },

  {
    eventId: "hist_1978_hongseong",
    id: "hist_1978_hongseong",
    era: "ERA_3_1978_1998_ANALOG_NETWORK",
    century: 20,
    catalogType: "INSTRUMENTAL_EARLY",
    country: "KOREA",
    recordType: "instrumental-early",
    sourceName: "기상청 지진관측보고 1978–2000",
    verification: "kma-verified",
    kind: "instrumental-early",
    place: "1978 홍성 지진",
    dateText: "1978-10-07 18:19:52 KST",
    datePrecision: "second",
    temporal: {
      gregorianDate: "1978-10-07",
      gregorianPrecision: "SECOND",
      originTimeUTC: "1978-10-07T09:19:52Z"
    },
    spatial: {
      placeName: "충청남도 홍성군 홍성읍 일대",
      inferredCoordinates: {
        lat: 36.60,
        lon: 126.66,
        coordinateConfidence: "INSTRUMENTAL_ANALOG_EARLY",
        errorRadiusKm: 10.0
      },
      focalDepth: {
        valKm: null,
        isKnown: false,
        determinationType: "UNKNOWN_UNRECORDED",
        comment: "초기 계측 자료로 진원 깊이 미확정"
      }
    },
    time: F(Date.parse("1978-10-07T09:19:52Z"), "kma-verified", "기상청 지진관측보고 공식 시각"),
    lat: F(36.60, "kma-verified", "기상청 공식 보고치: 36.60°N"),
    lon: F(126.66, "kma-verified", "기상청 공식 보고치: 126.66°E"),
    depth: F(null, "unknown", "깊이 미상"),
    mag: F(5.0, "kma-verified", "ML 5.0 (KMA)"),
    magType: "ML",
    scientificEstimates: [
      {
        source: "기상청 (KMA)",
        estimatedMag: 5.0,
        magType: "ML",
        confidence: "PRIMARY_OFFICIAL"
      }
    ],
    macroseismic: {
      maxIntensityMMI: {
        rawRoman: "VI~VII",
        numericEquivalent: 6.5,
        scale: "MMI",
        basis: "홍주성 성곽 붕괴, 건물 균열 1,100여 동, 지면 균열 관측"
      },
      feltRegionCount: 9,
      damageClass: 3,
      tsunamiObserved: false
    },
    rawValues: {
      rawI: 6.5,
      rawA: 35000,
      rawNloc: 9,
      rawFp: 3.2,
      rawNrep: 6,
      rawDclass: 3,
      rawD5: null
    },
    primaryText: {
      originalScript: "충남 홍성읍 일대에서 발생한 규모 5.0 지진으로 홍주성 성곽 일부가 무너지고 건물 균열 및 지면 갈라짐 현상이 발생함.",
      scriptLanguage: "ko-KR-modern",
      documentSource: "기상청 지진관측보고 1978-2000",
      sourceLocation: "충청남도 홍성군 홍성읍"
    },
    archivalLexicon: [
      { token: "충남 홍성읍 일대에서 발생한 규모 5.0 지진", displayKo: "충남 홍성읍 일대에서 발생한 규모 5.0 지진", category: "place", archetype: "RESONANCE", stageZone: "ZONE_B_INLAND", language: "ko-KR-official", translation: "충남 홍성읍 일대에서 발생한 규모 5.0 지진" },
      { token: "홍주성 성곽 일부가 무너지고", displayKo: "홍주성 성곽 일부가 무너지고", category: "structure", archetype: "FRACTURE", stageZone: "ZONE_C_MOUNTAIN", language: "ko-KR-official", translation: "홍주성 성곽 일부가 무너지고" },
      { token: "건물 균열 및 지면 갈라짐 현상이 발생함", displayKo: "건물 균열 및 지면 갈라짐 현상이 발생함", category: "geology", archetype: "EXPOSE", stageZone: "ZONE_B_INLAND", language: "ko-KR-official", translation: "건물 균열 및 지면 갈라짐 현상이 발생함" }
    ],
    text: "홍주성 성곽 일부가 무너지고 건물 균열 및 지면 갈라짐 현상이 발생함.",
    originalText: "홍주성 성곽 일부가 무너지고 건물 균열 및 지면 갈라짐 현상이 발생함.",
    uncertainty: "초기 아날로그 지진계 관측으로 진원 깊이 미상",
    links: [{ label: "KMA 주요지진 아카이브", url: KMA_ARCHIVE_URL }]
  },

  {
    eventId: "inst_1996_yeongwol",
    id: "inst_1996_yeongwol",
    era: "ERA_3_1978_1998_ANALOG_NETWORK",
    century: 20,
    catalogType: "INSTRUMENTAL_EARLY",
    country: "KOREA",
    recordType: "instrumental-early",
    sourceName: "기상청 지진관측보고 1978–2000 (1996 영월 지진)",
    verification: "kma-verified",
    kind: "instrumental-early",
    place: "1996 강원 영월 지진",
    dateText: "1996-12-13 13:10:17 KST",
    datePrecision: "second",
    temporal: {
      gregorianDate: "1996-12-13",
      gregorianPrecision: "SECOND",
      originTimeUTC: "1996-12-13T04:10:17Z"
    },
    spatial: {
      placeName: "강원특별자치도 영월군 동쪽 20km 지역",
      inferredCoordinates: {
        lat: 37.20,
        lon: 128.80,
        coordinateConfidence: "INSTRUMENTAL_ANALOG_EARLY",
        errorRadiusKm: 8.0
      },
      focalDepth: {
        valKm: 10.0,
        isKnown: true,
        determinationType: "INSTRUMENTAL_FIXED_DEFAULT",
        comment: "10.0 km 고정 기본값 산출 (Fixed Default Depth)"
      }
    },
    time: F(Date.parse("1996-12-13T04:10:17Z"), "kma-verified", "기상청 공식 시각"),
    lat: F(37.20, "kma-verified", "기상청 공식 좌표"),
    lon: F(128.80, "kma-verified", "기상청 공식 좌표"),
    depth: F(10.0, "secondary", "10.0 km (초기 고정 심도 기본값)"),
    mag: F(4.5, "kma-verified", "ML 4.5 (KMA)"),
    magType: "ML",
    scientificEstimates: [
      {
        source: "기상청 (KMA)",
        estimatedMag: 4.5,
        magType: "ML",
        confidence: "PRIMARY_OFFICIAL"
      }
    ],
    macroseismic: {
      maxIntensityMMI: {
        rawRoman: "V",
        numericEquivalent: 5.5,
        scale: "MMI",
        basis: "영월·정선 담장 균열 및 낙석 보고"
      },
      feltRegionCount: 8,
      damageClass: 2,
      tsunamiObserved: false
    },
    rawValues: {
      rawI: 5.5,
      rawA: 32000,
      rawNloc: 8,
      rawFp: 4.0,
      rawNrep: 5,
      rawDclass: 2,
      rawD5: 6.5
    },
    primaryText: {
      originalScript: "강원 영월군 동쪽 지역에서 규모 4.5 지진이 발생하여 영월·태백 일대 건물 벽체 균열 및 낙석이 보고됨.",
      scriptLanguage: "ko-KR-modern",
      documentSource: "기상청 지진연보 (1996)",
      sourceLocation: "강원특별자치도 영월군 동쪽 20km"
    },
    archivalLexicon: [
      { token: "강원 영월군 동쪽 지역에서 규모 4.5 지진이 발생하여", displayKo: "강원 영월군 동쪽 지역에서 규모 4.5 지진이 발생하여", category: "place", archetype: "RESONANCE", stageZone: "ZONE_B_INLAND", language: "ko-KR-official", translation: "강원 영월군 동쪽 지역에서 규모 4.5 지진이 발생하여" },
      { token: "영월·태백 일대 건물 벽체 균열", displayKo: "영월·태백 일대 건물 벽체 균열", category: "structure", archetype: "FRACTURE", stageZone: "ZONE_B_INLAND", language: "ko-KR-official", translation: "영월·태백 일대 건물 벽체 균열" },
      { token: "낙석이 보고됨", displayKo: "낙석이 보고됨", category: "geology", archetype: "FRACTURE", stageZone: "ZONE_C_MOUNTAIN", language: "ko-KR-official", translation: "낙석이 보고됨" }
    ],
    text: "강원 영월군 동쪽 지역에서 규모 4.5 지진이 발생하여 건물 벽체 균열 및 낙석이 보고됨.",
    originalText: "강원 영월군 동쪽 지역에서 규모 4.5 지진이 발생하여 건물 벽체 균열 및 낙석이 보고됨.",
    uncertainty: "아날로그-디지털 전환기 관측 자료 (심도 10.0km 고정 기본값 적용)",
    links: [{ label: "KMA 지진 아카이브", url: KMA_ARCHIVE_URL }]
  },

  // ==========================================================================
  // ERA 4: 1999–PRESENT MODERN DIGITAL BROADBAND NETWORK ERA
  // ==========================================================================
  {
    eventId: "inst_2004_uljin",
    id: "inst_2004_uljin",
    era: "ERA_4_1999_PRESENT_DIGITAL",
    century: 21,
    catalogType: "INSTRUMENTAL_MODERN",
    country: "KOREA",
    recordType: "instrumental-modern",
    sourceName: "기상청 지진연보 (2004 울진 해역 지진)",
    verification: "kma-verified",
    kind: "instrumental-modern",
    place: "2004 경북 울진 동남동쪽 해역 지진",
    dateText: "2004-05-29 19:14:24 KST",
    datePrecision: "second",
    temporal: {
      gregorianDate: "2004-05-29",
      gregorianPrecision: "SECOND",
      originTimeUTC: "2004-05-29T10:14:24Z"
    },
    spatial: {
      placeName: "경상북도 울진군 동남동쪽 80km 해역",
      inferredCoordinates: {
        lat: 36.80,
        lon: 130.20,
        coordinateConfidence: "HIGH_PRECISION_INSTRUMENTAL",
        errorRadiusKm: 2.0
      },
      focalDepth: {
        valKm: 19.0,
        isKnown: true,
        determinationType: "INSTRUMENTAL_FREE_INVERSION",
        comment: "디지털 지진관측망 자유 역산 심도 19.0 km"
      }
    },
    time: F(Date.parse("2004-05-29T10:14:24Z"), "kma-verified", "기상청 공식 시각"),
    lat: F(36.80, "kma-verified", "기상청 공식 좌표"),
    lon: F(130.20, "kma-verified", "기상청 공식 좌표"),
    depth: F(19.0, "kma-verified", "기상청 공식 심도 19.0 km"),
    mag: F(5.2, "kma-verified", "KMA ML 5.2 / USGS Mw 5.1"),
    magType: "ML",
    faultStrikeDeg: 350,
    scientificEstimates: [
      { source: "기상청 (KMA)", estimatedMag: 5.2, magType: "ML", confidence: "PRIMARY_OFFICIAL" },
      { source: "미국지질조사국 (USGS)", estimatedMag: 5.1, magType: "Mw", confidence: "PRIMARY_OFFICIAL" }
    ],
    macroseismic: {
      maxIntensityMMI: {
        rawRoman: "V",
        numericEquivalent: 5.0,
        scale: "KMA 계기진도",
        basis: "동해안 및 영남 내륙 전역 유감"
      },
      feltRegionCount: 12,
      damageClass: 1,
      tsunamiObserved: false
    },
    rawValues: {
      rawI: 5.0,
      rawA: 65000,
      rawNloc: 12,
      rawFp: 2.8,
      rawNrep: 4,
      rawDclass: 1,
      rawD5: 12.0
    },
    primaryText: {
      originalScript: "경북 울진 동남동쪽 80km 해역에서 규모 5.2 지진이 발생하여 동해안 및 내륙 전역에서 진동이 감지됨.",
      scriptLanguage: "ko-KR-modern",
      documentSource: "기상청 지진연보 (2004)",
      sourceLocation: "경상북도 울진군 동남동쪽 80km 해역"
    },
    archivalLexicon: [
      { token: "경북 울진 동남동쪽 80km 해역에서", displayKo: "경북 울진 동남동쪽 80km 해역에서", category: "place", archetype: "RESONANCE", stageZone: "ZONE_A_OCEAN", language: "ko-KR-official", translation: "경북 울진 동남동쪽 80km 해역에서" },
      { token: "규모 5.2 지진이 발생하여", displayKo: "규모 5.2 지진이 발생하여", category: "geology", archetype: "FRACTURE", stageZone: "ZONE_A_OCEAN", language: "ko-KR-official", translation: "규모 5.2 지진이 발생하여" },
      { token: "동해안 및 내륙 전역에서 진동이 감지됨", displayKo: "동해안 및 내륙 전역에서 진동이 감지됨", category: "phenomenon", archetype: "RESONANCE", stageZone: "ZONE_B_INLAND", language: "ko-KR-official", translation: "동해안 및 내륙 전역에서 진동이 감지됨" }
    ],
    text: "경북 울진 동남동쪽 80km 해역에서 규모 5.2 지진이 발생하여 동해안 및 내륙에서 진동이 감지됨.",
    originalText: "경북 울진 동남동쪽 80km 해역에서 규모 5.2 지진이 발생하여 동해안 및 내륙에서 진동이 감지됨.",
    uncertainty: "현대 디지털 관측망 계측 (KMA ML 5.2 / USGS Mw 5.1)",
    links: [{ label: "KMA 지진 아카이브", url: KMA_ARCHIVE_URL }]
  },

  {
    eventId: "inst_2007_odaesan",
    id: "inst_2007_odaesan",
    era: "ERA_4_1999_PRESENT_DIGITAL",
    century: 21,
    catalogType: "INSTRUMENTAL_MODERN",
    country: "KOREA",
    recordType: "instrumental-modern",
    sourceName: "기상청 2007 오대산 지진 정밀분석 보고서",
    verification: "kma-verified",
    kind: "instrumental-modern",
    place: "2007 강원 평창(오대산) 지진",
    dateText: "2007-01-20 20:56:53 KST",
    datePrecision: "second",
    temporal: {
      gregorianDate: "2007-01-20",
      gregorianPrecision: "SECOND",
      originTimeUTC: "2007-01-20T11:56:53Z"
    },
    spatial: {
      placeName: "강원특별자치도 평창군 북북동쪽 39km 지역 (오대산)",
      inferredCoordinates: {
        lat: 37.68,
        lon: 128.59,
        coordinateConfidence: "HIGH_PRECISION_INSTRUMENTAL",
        errorRadiusKm: 0.8
      },
      focalDepth: {
        valKm: 13.0,
        isKnown: true,
        determinationType: "INSTRUMENTAL_FREE_INVERSION",
        comment: "디지털 지진관측망 정밀 역산 심도 13.0 km"
      }
    },
    time: F(Date.parse("2007-01-20T11:56:53Z"), "kma-verified", "기상청 공식 시각"),
    lat: F(37.68, "kma-verified", "기상청 공식 좌표"),
    lon: F(128.59, "kma-verified", "기상청 공식 좌표"),
    depth: F(13.0, "kma-verified", "기상청 공식 심도 13.0 km"),
    mag: F(4.8, "kma-verified", "KMA ML 4.8 / USGS Mw 4.6"),
    magType: "ML",
    faultStrikeDeg: 335,
    scientificEstimates: [
      { source: "기상청 (KMA)", estimatedMag: 4.8, magType: "ML", confidence: "PRIMARY_OFFICIAL" },
      { source: "미국지질조사국 (USGS)", estimatedMag: 4.6, magType: "Mw", confidence: "PRIMARY_OFFICIAL" }
    ],
    macroseismic: {
      maxIntensityMMI: {
        rawRoman: "V",
        numericEquivalent: 5.5,
        scale: "KMA 계기진도",
        basis: "강원 영동·영서 강한 진동 및 월정사 일대 유감"
      },
      feltRegionCount: 11,
      damageClass: 2,
      tsunamiObserved: false
    },
    rawValues: {
      rawI: 5.5,
      rawA: 52000,
      rawNloc: 11,
      rawFp: 4.2,
      rawNrep: 7,
      rawDclass: 2,
      rawD5: 9.0
    },
    primaryText: {
      originalScript: "강원 평창군 오대산 부근에서 발생한 규모 4.8 주향이동단층 지진으로 강원·수도권 전역에서 진동이 감지됨.",
      scriptLanguage: "ko-KR-modern",
      documentSource: "기상청 지진연보 (2007)",
      sourceLocation: "강원특별자치도 평창군 오대산 일원"
    },
    archivalLexicon: [
      { token: "강원 평창군 오대산 부근에서 발생한", displayKo: "강원 평창군 오대산 부근에서 발생한", category: "place", archetype: "RESONANCE", stageZone: "ZONE_C_MOUNTAIN", language: "ko-KR-official", translation: "강원 평창군 오대산 부근에서 발생한" },
      { token: "규모 4.8 주향이동단층 지진으로", displayKo: "규모 4.8 주향이동단층 지진으로", category: "geology", archetype: "FRACTURE", stageZone: "ZONE_C_MOUNTAIN", language: "ko-KR-official", translation: "규모 4.8 주향이동단층 지진으로" },
      { token: "강원·수도권 전역에서 진동이 감지됨", displayKo: "강원·수도권 전역에서 진동이 감지됨", category: "phenomenon", archetype: "RESONANCE", stageZone: "ZONE_B_INLAND", language: "ko-KR-official", translation: "강원·수도권 전역에서 진동이 감지됨" }
    ],
    text: "강원 평창군 오대산 부근에서 발생한 규모 4.8 지진으로 강원·수도권 전역에서 진동이 감지됨.",
    originalText: "강원 평창군 오대산 부근에서 발생한 규모 4.8 지진으로 강원·수도권 전역에서 진동이 감지됨.",
    uncertainty: "현대 디지털 관측망 정밀 분석 (KMA ML 4.8 / USGS Mw 4.6)",
    links: [{ label: "KMA 지진 아카이브", url: KMA_ARCHIVE_URL }]
  },

  {
    eventId: "inst_2014_taean",
    id: "inst_2014_taean",
    era: "ERA_4_1999_PRESENT_DIGITAL",
    century: 21,
    catalogType: "INSTRUMENTAL_MODERN",
    country: "KOREA",
    recordType: "instrumental-modern",
    sourceName: "기상청 지진연보 (2014 태안 해역 지진)",
    verification: "kma-verified",
    kind: "instrumental-modern",
    place: "2014 충남 태안 서격렬비도 서북서쪽 해역 지진",
    dateText: "2014-04-11 04:48:35 KST",
    datePrecision: "second",
    temporal: {
      gregorianDate: "2014-04-11",
      gregorianPrecision: "SECOND",
      originTimeUTC: "2014-04-10T19:48:35Z"
    },
    spatial: {
      placeName: "충청남도 태안군 서격렬비도 서북서쪽 100km 해역",
      inferredCoordinates: {
        lat: 36.95,
        lon: 124.50,
        coordinateConfidence: "HIGH_PRECISION_INSTRUMENTAL",
        errorRadiusKm: 2.5
      },
      focalDepth: {
        valKm: 14.0,
        isKnown: true,
        determinationType: "INSTRUMENTAL_FREE_INVERSION",
        comment: "디지털 지진관측망 심도 14.0 km"
      }
    },
    time: F(Date.parse("2014-04-10T19:48:35Z"), "kma-verified", "기상청 공식 시각"),
    lat: F(36.95, "kma-verified", "기상청 공식 좌표"),
    lon: F(124.50, "kma-verified", "기상청 공식 좌표"),
    depth: F(14.0, "kma-verified", "기상청 공식 심도 14.0 km"),
    mag: F(5.1, "kma-verified", "KMA ML 5.1 / USGS Mw 4.8"),
    magType: "ML",
    scientificEstimates: [
      { source: "기상청 (KMA)", estimatedMag: 5.1, magType: "ML", confidence: "PRIMARY_OFFICIAL" },
      { source: "미국지질조사국 (USGS)", estimatedMag: 4.8, magType: "Mw", confidence: "PRIMARY_OFFICIAL" }
    ],
    macroseismic: {
      maxIntensityMMI: {
        rawRoman: "IV",
        numericEquivalent: 4.5,
        scale: "KMA 계기진도",
        basis: "충남 서해안 및 수도권 유감"
      },
      feltRegionCount: 10,
      damageClass: 1,
      tsunamiObserved: false
    },
    rawValues: {
      rawI: 4.5,
      rawA: 55000,
      rawNloc: 10,
      rawFp: 2.6,
      rawNrep: 5,
      rawDclass: 1,
      rawD5: 11.5
    },
    primaryText: {
      originalScript: "충남 태안 서격렬비도 서북서쪽 100km 해역에서 규모 5.1 지진이 발생하여 서해안 및 수도권에서 진동이 감지됨.",
      scriptLanguage: "ko-KR-modern",
      documentSource: "기상청 지진연보 (2014)",
      sourceLocation: "충청남도 태안군 서격렬비도 서북서쪽 100km 해역"
    },
    archivalLexicon: [
      { token: "충남 태안 서격렬비도 서북서쪽 100km 해역에서", displayKo: "충남 태안 서격렬비도 서북서쪽 100km 해역에서", category: "place", archetype: "RESONANCE", stageZone: "ZONE_A_OCEAN", language: "ko-KR-official", translation: "충남 태안 서격렬비도 서북서쪽 100km 해역에서" },
      { token: "규모 5.1 지진이 발생하여", displayKo: "규모 5.1 지진이 발생하여", category: "phenomenon", archetype: "RESONANCE", stageZone: "ZONE_A_OCEAN", language: "ko-KR-official", translation: "규모 5.1 지진이 발생하여" },
      { token: "서해안 및 수도권에서 진동이 감지됨", displayKo: "서해안 및 수도권에서 진동이 감지됨", category: "phenomenon", archetype: "RESONANCE", stageZone: "ZONE_B_INLAND", language: "ko-KR-official", translation: "서해안 및 수도권에서 진동이 감지됨" }
    ],
    text: "충남 태안 서격렬비도 서북서쪽 100km 해역에서 규모 5.1 지진이 발생하여 수도권까지 진동이 감지됨.",
    originalText: "충남 태안 서격렬비도 서북서쪽 100km 해역에서 규모 5.1 지진이 발생하여 수도권까지 진동이 감지됨.",
    uncertainty: "서해 원거리 해역 디지털 관측 자료 (KMA ML 5.1 / USGS Mw 4.8)",
    links: [{ label: "KMA 지진 아카이브", url: KMA_ARCHIVE_URL }]
  },

  {
    eventId: "inst_2016_gyeongju_foreshock",
    id: "inst_2016_gyeongju_foreshock",
    era: "ERA_4_1999_PRESENT_DIGITAL",
    century: 21,
    sequenceGroupId: "seq_2016_gyeongju",
    sequenceRole: "FORESHOCK",
    catalogType: "INSTRUMENTAL_MODERN",
    country: "KOREA",
    recordType: "instrumental-modern",
    sourceName: "기상청 9.12 지진 정밀분석 보고서 (전진)",
    verification: "kma-verified",
    kind: "instrumental-modern",
    place: "2016 경주 지진 (전진 ML 5.1)",
    dateText: "2016-09-12 19:44:32 KST",
    datePrecision: "second",
    temporal: {
      gregorianDate: "2016-09-12",
      gregorianPrecision: "SECOND",
      originTimeUTC: "2016-09-12T10:44:32Z"
    },
    spatial: {
      placeName: "경상북도 경주시 남남서쪽 8.2km 지역",
      inferredCoordinates: {
        lat: 35.7666,
        lon: 129.1889,
        coordinateConfidence: "HIGH_PRECISION_INSTRUMENTAL",
        errorRadiusKm: 0.5
      },
      focalDepth: {
        valKm: 15.0,
        isKnown: true,
        determinationType: "INSTRUMENTAL_FREE_INVERSION",
        comment: "기상청 정밀분석 전진 심도 15.0 km"
      }
    },
    time: F(Date.parse("2016-09-12T10:44:32Z"), "kma-verified", "기상청 공식: 10:44:32 UTC"),
    lat: F(35.7666, "kma-verified", "기상청 공식 좌표"),
    lon: F(129.1889, "kma-verified", "기상청 공식 좌표"),
    depth: F(15.0, "kma-verified", "기상청 공식: 15.0 km"),
    mag: F(5.1, "kma-verified", "KMA ML 5.1 / USGS Mw 4.9"),
    magType: "ML",
    faultStrikeDeg: 26,
    scientificEstimates: [
      { source: "기상청 (KMA)", estimatedMag: 5.1, magType: "ML", confidence: "PRIMARY_OFFICIAL" },
      { source: "미국지질조사국 (USGS)", estimatedMag: 4.9, magType: "Mw", confidence: "PRIMARY_OFFICIAL" }
    ],
    macroseismic: {
      maxIntensityMMI: {
        rawRoman: "VI",
        numericEquivalent: 6.0,
        scale: "KMA 계기진도",
        basis: "본진 48분 전 발생한 대규모 전진"
      },
      feltRegionCount: 14,
      damageClass: 2,
      tsunamiObserved: false
    },
    rawValues: {
      rawI: 6.0,
      rawA: 65000,
      rawNloc: 14,
      rawFp: 3.1,
      rawNrep: 12,
      rawDclass: 2,
      rawD5: 11.0
    },
    primaryText: {
      originalScript: "경주 남남서쪽 8.2km 지역에서 본진 48분 전에 발생한 규모 5.1 전진으로 영남권 전역에서 강한 진동이 감지됨.",
      scriptLanguage: "ko-KR-modern",
      documentSource: "기상청 9.12 지진 정밀분석 보고서",
      sourceLocation: "경상북도 경주시 남남서쪽 8.2km"
    },
    archivalLexicon: [
      { token: "경주 남남서쪽 8.2km 지역에서", displayKo: "경주 남남서쪽 8.2km 지역에서", category: "place", archetype: "RESONANCE", stageZone: "ZONE_B_INLAND", language: "ko-KR-official", translation: "경주 남남서쪽 8.2km 지역에서" },
      { token: "본진 48분 전에 발생한 규모 5.1 전진으로", displayKo: "본진 48분 전에 발생한 규모 5.1 전진으로", category: "phenomenon", archetype: "RESONANCE", stageZone: "ZONE_B_INLAND", language: "ko-KR-official", translation: "본진 48분 전에 발생한 규모 5.1 전진으로" },
      { token: "영남권 전역에서 강한 진동이 감지됨", displayKo: "영남권 전역에서 강한 진동이 감지됨", category: "phenomenon", archetype: "RESONANCE", stageZone: "ZONE_B_INLAND", language: "ko-KR-official", translation: "영남권 전역에서 강한 진동이 감지됨" }
    ],
    text: "경주 남남서쪽 8.2km 지역에서 본진 48분 전에 발생한 규모 5.1 전진.",
    originalText: "경주 남남서쪽 8.2km 지역에서 본진 48분 전에 발생한 규모 5.1 전진.",
    uncertainty: "현대 디지털 광대역 관측 자료 (KMA ML 5.1 / USGS Mw 4.9)",
    links: [{ label: "KMA 9.12 경주지진 페이지", url: "https://www.weather.go.kr/w/earthquake/archive/major-eqk/912.do" }]
  },

  {
    eventId: "hist_2016_gyeongju",
    id: "hist_2016_gyeongju",
    era: "ERA_4_1999_PRESENT_DIGITAL",
    century: 21,
    sequenceGroupId: "seq_2016_gyeongju",
    sequenceRole: "MAINSHOCK",
    catalogType: "INSTRUMENTAL_MODERN",
    country: "KOREA",
    recordType: "instrumental-modern",
    sourceName: "기상청 9.12 지진 정밀분석 보고서",
    verification: "kma-verified",
    kind: "instrumental-modern",
    place: "2016 경주 지진 (본진)",
    dateText: "2016-09-12 20:32:54 KST",
    datePrecision: "second",
    temporal: {
      gregorianDate: "2016-09-12",
      gregorianPrecision: "SECOND",
      originTimeUTC: "2016-09-12T11:32:54Z"
    },
    spatial: {
      placeName: "경상북도 경주시 남남서쪽 8.7km 지역",
      inferredCoordinates: {
        lat: 35.7610,
        lon: 129.1878,
        coordinateConfidence: "HIGH_PRECISION_INSTRUMENTAL",
        errorRadiusKm: 0.5
      },
      focalDepth: {
        valKm: 15.0,
        isKnown: true,
        determinationType: "INSTRUMENTAL_FREE_INVERSION",
        comment: "기상청 정밀분석 보고치 (오차 ±1.5km)"
      }
    },
    time: F(Date.parse("2016-09-12T11:32:54Z"), "kma-verified", "기상청 공식: 11:32:54 UTC"),
    lat: F(35.7610, "kma-verified", "기상청 정밀분석 공식 좌표: 35.7610°N"),
    lon: F(129.1878, "kma-verified", "기상청 정밀분석 공식 좌표: 129.1878°E"),
    depth: F(15.0, "kma-verified", "기상청 공식: 15.0 km 내외", "approx."),
    mag: F(5.8, "kma-verified", "기상청 공식 ML 5.8"),
    magType: "ML",
    faultStrikeDeg: 26,
    scientificEstimates: [
      {
        source: "기상청 (KMA)",
        estimatedMag: 5.8,
        magType: "ML",
        confidence: "PRIMARY_OFFICIAL"
      },
      {
        source: "미국지질조사국 (USGS)",
        estimatedMag: 5.4,
        magType: "Mw",
        confidence: "PRIMARY_OFFICIAL"
      }
    ],
    macroseismic: {
      maxIntensityMMI: {
        rawRoman: "VI",
        numericEquivalent: 6.5,
        scale: "KMA 계기진도",
        basis: "첨성대 등 구조물 변위, 전국 유감"
      },
      feltRegionCount: 16,
      damageClass: 3,
      tsunamiObserved: false
    },
    rawValues: {
      rawI: 6.5,
      rawA: 80000,
      rawNloc: 16,
      rawFp: 2.5,
      rawNrep: 50,
      rawDclass: 3,
      rawD5: 15.0
    },
    primaryText: {
      originalScript: "경주 남남서쪽 8.7km 지역에서 발생한 계측 사상 최대 규모 5.8 지진으로 전국에서 진동을 감지하고 첨성대 미세 균열 등 발생.",
      scriptLanguage: "ko-KR-modern",
      documentSource: "기상청 9.12 지진 정밀분석 보고서",
      sourceLocation: "경상북도 경주시 남남서쪽 8.7km"
    },
    archivalLexicon: [
      { token: "경주 남남서쪽 8.7km 지역에서 발생한", displayKo: "경주 남남서쪽 8.7km 지역에서 발생한", category: "geology", archetype: "FRACTURE", stageZone: "ZONE_C_MOUNTAIN", language: "ko-KR-official", translation: "경주 남남서쪽 8.7km 지역에서 발생한" },
      { token: "계측 사상 최대 규모 5.8 지진으로", displayKo: "계측 사상 최대 규모 5.8 지진으로", category: "phenomenon", archetype: "RESONANCE", stageZone: "ZONE_B_INLAND", language: "ko-KR-official", translation: "계측 사상 최대 규모 5.8 지진으로" },
      { token: "전국에서 진동을 감지하고", displayKo: "전국에서 진동을 감지하고", category: "phenomenon", archetype: "RESONANCE", stageZone: "ZONE_C_MOUNTAIN", language: "ko-KR-official", translation: "전국에서 진동을 감지하고" },
      { token: "첨성대 미세 균열 등 발생", displayKo: "첨성대 미세 균열 등 발생", category: "structure", archetype: "RESONANCE", stageZone: "ZONE_B_INLAND", language: "ko-KR-official", translation: "첨성대 미세 균열 등 발생" }
    ],
    text: "기상청 계측 사상 최대 규모 5.8 지진으로 첨성대 등 진동 감지.",
    originalText: "기상청 계측 사상 최대 규모 5.8 지진으로 첨성대 등 진동 감지.",
    uncertainty: "현대 디지털 광대역 지진계 관측 자료; 진원 깊이 정밀도 ±1.5 km (KMA ML 5.8 / USGS Mw 5.4 병기)",
    links: [{ label: "KMA 9.12 경주지진 페이지", url: "https://www.weather.go.kr/w/earthquake/archive/major-eqk/912.do" }]
  },

  {
    eventId: "hist_2017_pohang",
    id: "hist_2017_pohang",
    era: "ERA_4_1999_PRESENT_DIGITAL",
    century: 21,
    sequenceGroupId: "seq_2017_pohang",
    sequenceRole: "MAINSHOCK",
    catalogType: "INSTRUMENTAL_MODERN",
    country: "KOREA",
    recordType: "instrumental-modern",
    sourceName: "학술 연구 논문 및 기상청 정밀분석",
    verification: "secondary",
    kind: "instrumental-modern",
    place: "2017 포항 지진",
    dateText: "2017-11-15 14:29:31 KST",
    datePrecision: "second",
    temporal: {
      gregorianDate: "2017-11-15",
      gregorianPrecision: "SECOND",
      originTimeUTC: "2017-11-15T05:29:31Z"
    },
    spatial: {
      placeName: "경상북도 포항시 북구 북쪽 9km 지역",
      inferredCoordinates: {
        lat: 36.109,
        lon: 129.366,
        coordinateConfidence: "HIGH_PRECISION_INSTRUMENTAL",
        errorRadiusKm: 0.8
      },
      focalDepth: {
        valKm: 7.0,
        isKnown: true,
        determinationType: "MODEL_CONSTRAINED_RANGE",
        comment: "기상청 및 다수 학술논문 대표값 (연구별 3~7km 편차 존재)"
      }
    },
    time: F(Date.parse("2017-11-15T05:29:31Z"), "secondary", "논문 수록: 05:29:31 UTC"),
    lat: F(36.109, "secondary", "KMA 및 지자체 분석치"),
    lon: F(129.366, "secondary", "KMA 분석치"),
    depth: F(7.0, "secondary", "대표값 7.0 km (연구별 3~7 km 범위)", "3–7 km range"),
    depthRange: { min: 3.0, max: 7.0 },
    mag: F(5.4, "secondary", "KMA ML 5.4 / USGS Mw 5.5"),
    magType: "ML",
    faultStrikeDeg: 214,
    scientificEstimates: [
      {
        source: "기상청 (KMA)",
        estimatedMag: 5.4,
        magType: "ML",
        confidence: "PRIMARY_OFFICIAL"
      },
      {
        source: "미국지질조사국 (USGS)",
        estimatedMag: 5.5,
        magType: "Mw",
        confidence: "PRIMARY_OFFICIAL"
      }
    ],
    macroseismic: {
      maxIntensityMMI: {
        rawRoman: "VI",
        numericEquivalent: 7.0,
        scale: "KMA 계기진도",
        basis: "필로티 구조물 파손, 지표 파열 및 액상화 현상 관측"
      },
      feltRegionCount: 14,
      damageClass: 4,
      tsunamiObserved: false,
      liquefactionObserved: true
    },
    rawValues: {
      rawI: 7.0,
      rawA: 65000,
      rawNloc: 14,
      rawFp: 4.0,
      rawNrep: 35,
      rawDclass: 4,
      rawD5: 10.0
    },
    primaryText: {
      originalScript: "포항 북구 북쪽 9km 지역에서 발생한 규모 5.4 지진으로 필로티 기둥 붕괴, 지표 균열 및 액상화 현상이 계측 사상 최초로 확인됨.",
      scriptLanguage: "ko-KR-modern",
      documentSource: "Tectonophysics 논문 및 KMA 포항지진 보고서",
      sourceLocation: "경상북도 포항시 북구 북쪽 9km"
    },
    archivalLexicon: [
      { token: "포항 북구 북쪽 9km 지역에서 발생한 규모 5.4 지진으로", displayKo: "포항 북구 북쪽 9km 지역에서 발생한 규모 5.4 지진으로", category: "place", archetype: "RESONANCE", stageZone: "ZONE_B_INLAND", language: "ko-KR-official", translation: "포항 북구 북쪽 9km 지역에서 발생한 규모 5.4 지진으로" },
      { token: "필로티 기둥 붕괴", displayKo: "필로티 기둥 붕괴", category: "structure", archetype: "FRACTURE", stageZone: "ZONE_B_INLAND", language: "ko-KR-official", translation: "필로티 기둥 붕괴" },
      { token: "지표 균열 및 액상화 현상이 계측 사상 최초로 확인됨", displayKo: "지표 균열 및 액상화 현상이 계측 사상 최초로 확인됨", category: "water", archetype: "EXPOSE", stageZone: "ZONE_A_OCEAN", language: "ko-KR-official", translation: "지표 균열 및 액상화 현상이 계측 사상 최초로 확인됨" },
      { token: "지표 파열 및 액상화 현상과 필로티 구조물 파손 발생", displayKo: "지표 파열 및 액상화 현상과 필로티 구조물 파손 발생", category: "geology", archetype: "FRACTURE", stageZone: "ZONE_C_MOUNTAIN", language: "ko-KR-official", translation: "지표 파열 및 액상화 현상과 필로티 구조물 파손 발생" }
    ],
    text: "지표 파열 및 액상화 현상과 필로티 구조물 파손 발생.",
    originalText: "지표 파열 및 액상화 현상과 필로티 구조물 파손 발생.",
    uncertainty: "진원 깊이에 대해 단층 모델 및 관측소 조합별로 3~7 km 편차 존재 (KMA ML 5.4 / USGS Mw 5.5)",
    links: [{ label: "Tectonophysics 논문", url: "https://www.sciencedirect.com/science/article/pii/S0040195119304214" }]
  },

  {
    eventId: "inst_2018_pohang_aftershock",
    id: "inst_2018_pohang_aftershock",
    era: "ERA_4_1999_PRESENT_DIGITAL",
    century: 21,
    sequenceGroupId: "seq_2017_pohang",
    sequenceRole: "AFTERSHOCK",
    catalogType: "INSTRUMENTAL_MODERN",
    country: "KOREA",
    recordType: "instrumental-modern",
    sourceName: "기상청 포항지진 최대 여진 분석 보고서",
    verification: "kma-verified",
    kind: "instrumental-modern",
    place: "2018 포항 최대 여진 (ML 4.6)",
    dateText: "2018-02-11 05:03:03 KST",
    datePrecision: "second",
    temporal: {
      gregorianDate: "2018-02-11",
      gregorianPrecision: "SECOND",
      originTimeUTC: "2018-02-10T20:03:03Z"
    },
    spatial: {
      placeName: "경상북도 포항시 북구 서북서쪽 5km 지역",
      inferredCoordinates: {
        lat: 36.08,
        lon: 129.33,
        coordinateConfidence: "HIGH_PRECISION_INSTRUMENTAL",
        errorRadiusKm: 0.7
      },
      focalDepth: {
        valKm: 9.0,
        isKnown: true,
        determinationType: "INSTRUMENTAL_FREE_INVERSION",
        comment: "기상청 공식 여진 심도 9.0 km"
      }
    },
    time: F(Date.parse("2018-02-10T20:03:03Z"), "kma-verified", "기상청 공식 시각"),
    lat: F(36.08, "kma-verified", "기상청 공식 좌표"),
    lon: F(129.33, "kma-verified", "기상청 공식 좌표"),
    depth: F(9.0, "kma-verified", "기상청 공식 심도 9.0 km"),
    mag: F(4.6, "kma-verified", "KMA ML 4.6 / USGS Mw 4.7"),
    magType: "ML",
    faultStrikeDeg: 214,
    scientificEstimates: [
      { source: "기상청 (KMA)", estimatedMag: 4.6, magType: "ML", confidence: "PRIMARY_OFFICIAL" },
      { source: "미국지질조사국 (USGS)", estimatedMag: 4.7, magType: "Mw", confidence: "PRIMARY_OFFICIAL" }
    ],
    macroseismic: {
      maxIntensityMMI: {
        rawRoman: "V",
        numericEquivalent: 5.5,
        scale: "KMA 계기진도",
        basis: "포항 시내 외벽 추가 탈락 및 영남권 유감"
      },
      feltRegionCount: 10,
      damageClass: 2,
      tsunamiObserved: false
    },
    rawValues: {
      rawI: 5.5,
      rawA: 42000,
      rawNloc: 10,
      rawFp: 4.3,
      rawNrep: 14,
      rawDclass: 2,
      rawD5: 8.0
    },
    primaryText: {
      originalScript: "포항 북구 서북서쪽 5km 지역에서 발생한 2017 포항지진의 최대 여진(규모 4.6)으로 기존 피해 건축물의 추가 균열 발생.",
      scriptLanguage: "ko-KR-modern",
      documentSource: "기상청 지진연보 (2018)",
      sourceLocation: "경상북도 포항시 북구 서북서쪽 5km"
    },
    archivalLexicon: [
      { token: "포항 북구 서북서쪽 5km 지역에서 발생한", displayKo: "포항 북구 서북서쪽 5km 지역에서 발생한", category: "place", archetype: "RESONANCE", stageZone: "ZONE_B_INLAND", language: "ko-KR-official", translation: "포항 북구 서북서쪽 5km 지역에서 발생한" },
      { token: "2017 포항지진의 최대 여진으로", displayKo: "2017 포항지진의 최대 여진으로", category: "phenomenon", archetype: "RESONANCE", stageZone: "ZONE_C_MOUNTAIN", language: "ko-KR-official", translation: "2017 포항지진의 최대 여진으로" },
      { token: "기존 피해 건축물의 추가 균열 발생", displayKo: "기존 피해 건축물의 추가 균열 발생", category: "structure", archetype: "FRACTURE", stageZone: "ZONE_B_INLAND", language: "ko-KR-official", translation: "기존 피해 건축물의 추가 균열 발생" }
    ],
    text: "포항 북구 서북서쪽 5km 지역에서 발생한 2017 포항지진의 최대 여진(규모 4.6).",
    originalText: "포항 북구 서북서쪽 5km 지역에서 발생한 2017 포항지진의 최대 여진(규모 4.6).",
    uncertainty: "현대 디지털 관측망 정밀 분석 (KMA ML 4.6 / USGS Mw 4.7)",
    links: [{ label: "KMA 지진 아카이브", url: KMA_ARCHIVE_URL }]
  },

  {
    eventId: "inst_2022_goesan",
    id: "inst_2022_goesan",
    era: "ERA_4_1999_PRESENT_DIGITAL",
    century: 21,
    catalogType: "INSTRUMENTAL_MODERN",
    country: "KOREA",
    recordType: "instrumental-modern",
    sourceName: "기상청 2022 괴산 지진 분석 보고서",
    verification: "kma-verified",
    kind: "instrumental-modern",
    place: "2022 충북 괴산 지진",
    dateText: "2022-10-29 08:27:49 KST",
    datePrecision: "second",
    temporal: {
      gregorianDate: "2022-10-29",
      gregorianPrecision: "SECOND",
      originTimeUTC: "2022-10-28T23:27:49Z"
    },
    spatial: {
      placeName: "충청북도 괴산군 북동쪽 11km 지역",
      inferredCoordinates: {
        lat: 36.88,
        lon: 127.88,
        coordinateConfidence: "HIGH_PRECISION_INSTRUMENTAL",
        errorRadiusKm: 0.5
      },
      focalDepth: {
        valKm: 12.0,
        isKnown: true,
        determinationType: "INSTRUMENTAL_FREE_INVERSION",
        comment: "기상청 공식 심도 12.0 km"
      }
    },
    time: F(Date.parse("2022-10-28T23:27:49Z"), "kma-verified", "기상청 공식 시각"),
    lat: F(36.88, "kma-verified", "기상청 공식 좌표"),
    lon: F(127.88, "kma-verified", "기상청 공식 좌표"),
    depth: F(12.0, "kma-verified", "기상청 공식 심도 12.0 km"),
    mag: F(4.1, "kma-verified", "KMA ML 4.1 / USGS Mw 3.8"),
    magType: "ML",
    faultStrikeDeg: 298,
    scientificEstimates: [
      { source: "기상청 (KMA)", estimatedMag: 4.1, magType: "ML", confidence: "PRIMARY_OFFICIAL" },
      { source: "미국지질조사국 (USGS)", estimatedMag: 3.8, magType: "Mw", confidence: "PRIMARY_OFFICIAL" }
    ],
    macroseismic: {
      maxIntensityMMI: {
        rawRoman: "V",
        numericEquivalent: 5.0,
        scale: "KMA 계기진도",
        basis: "충북 최대 계기진도 V, 지붕 기와 및 벽체 미세 균열"
      },
      feltRegionCount: 10,
      damageClass: 1,
      tsunamiObserved: false
    },
    rawValues: {
      rawI: 5.0,
      rawA: 38000,
      rawNloc: 10,
      rawFp: 4.5,
      rawNrep: 16,
      rawDclass: 1,
      rawD5: 7.5
    },
    primaryText: {
      originalScript: "충북 괴산군 북동쪽 11km 지역에서 규모 4.1 지진이 발생하여 충청·경북·경기 내륙에서 진동이 감지됨.",
      scriptLanguage: "ko-KR-modern",
      documentSource: "기상청 지진연보 (2022)",
      sourceLocation: "충청북도 괴산군 북동쪽 11km"
    },
    archivalLexicon: [
      { token: "충북 괴산군 북동쪽 11km 지역에서", displayKo: "충북 괴산군 북동쪽 11km 지역에서", category: "place", archetype: "RESONANCE", stageZone: "ZONE_B_INLAND", language: "ko-KR-official", translation: "충북 괴산군 북동쪽 11km 지역에서" },
      { token: "규모 4.1 지진이 발생하여", displayKo: "규모 4.1 지진이 발생하여", category: "phenomenon", archetype: "RESONANCE", stageZone: "ZONE_B_INLAND", language: "ko-KR-official", translation: "규모 4.1 지진이 발생하여" },
      { token: "충청·경북·경기 내륙에서 진동이 감지됨", displayKo: "충청·경북·경기 내륙에서 진동이 감지됨", category: "phenomenon", archetype: "RESONANCE", stageZone: "ZONE_B_INLAND", language: "ko-KR-official", translation: "충청·경북·경기 내륙에서 진동이 감지됨" },
      { token: "지붕 기와 및 벽체 미세 균열", displayKo: "지붕 기와 및 벽체 미세 균열", category: "structure", archetype: "FRACTURE", stageZone: "ZONE_B_INLAND", language: "ko-KR-official", translation: "지붕 기와 및 벽체 미세 균열" }
    ],
    text: "충북 괴산군 북동쪽 11km 지역에서 규모 4.1 지진이 발생하여 중부 내륙에서 진동이 감지됨.",
    originalText: "충북 괴산군 북동쪽 11km 지역에서 규모 4.1 지진이 발생하여 중부 내륙에서 진동이 감지됨.",
    uncertainty: "현대 디지털 관측망 정밀 분석 (KMA ML 4.1 / USGS Mw 3.8)",
    links: [{ label: "KMA 지진 아카이브", url: KMA_ARCHIVE_URL }]
  },

  {
    eventId: "inst_2023_donghae",
    id: "inst_2023_donghae",
    era: "ERA_4_1999_PRESENT_DIGITAL",
    century: 21,
    catalogType: "INSTRUMENTAL_MODERN",
    country: "KOREA",
    recordType: "instrumental-modern",
    sourceName: "기상청 2023 동해 해역 연속지진 분석 보고서",
    verification: "kma-verified",
    kind: "instrumental-modern",
    place: "2023 강원 동해시 북동쪽 해역 지진",
    dateText: "2023-05-15 06:27:37 KST",
    datePrecision: "second",
    temporal: {
      gregorianDate: "2023-05-15",
      gregorianPrecision: "SECOND",
      originTimeUTC: "2023-05-14T21:27:37Z"
    },
    spatial: {
      placeName: "강원특별자치도 동해시 북동쪽 52km 해역",
      inferredCoordinates: {
        lat: 37.87,
        lon: 129.52,
        coordinateConfidence: "HIGH_PRECISION_INSTRUMENTAL",
        errorRadiusKm: 1.0
      },
      focalDepth: {
        valKm: 31.0,
        isKnown: true,
        determinationType: "INSTRUMENTAL_FREE_INVERSION",
        comment: "기상청 공식 심도 31.0 km"
      }
    },
    time: F(Date.parse("2023-05-14T21:27:37Z"), "kma-verified", "기상청 공식 시각"),
    lat: F(37.87, "kma-verified", "기상청 공식 좌표"),
    lon: F(129.52, "kma-verified", "기상청 공식 좌표"),
    depth: F(31.0, "kma-verified", "기상청 공식 심도 31.0 km"),
    mag: F(4.5, "kma-verified", "KMA ML 4.5 / USGS Mw 4.4"),
    magType: "ML",
    faultStrikeDeg: 342,
    scientificEstimates: [
      { source: "기상청 (KMA)", estimatedMag: 4.5, magType: "ML", confidence: "PRIMARY_OFFICIAL" },
      { source: "미국지질조사국 (USGS)", estimatedMag: 4.4, magType: "Mw", confidence: "PRIMARY_OFFICIAL" }
    ],
    macroseismic: {
      maxIntensityMMI: {
        rawRoman: "III",
        numericEquivalent: 3.5,
        scale: "KMA 계기진도",
        basis: "강원·경북 최대 계기진도 III, 연속 군발지진의 본진"
      },
      feltRegionCount: 6,
      damageClass: 1,
      tsunamiObserved: false
    },
    rawValues: {
      rawI: 3.5,
      rawA: 30000,
      rawNloc: 6,
      rawFp: 3.6,
      rawNrep: 32,
      rawDclass: 1,
      rawD5: 9.5
    },
    primaryText: {
      originalScript: "강원 동해시 북동쪽 52km 해역에서 발생한 규모 4.5 지진으로 2023년 봄 동해 연속 군발지진 중 최대 규모를 기록함.",
      scriptLanguage: "ko-KR-modern",
      documentSource: "기상청 지진연보 (2023)",
      sourceLocation: "강원특별자치도 동해시 북동쪽 52km 해역"
    },
    archivalLexicon: [
      { token: "강원 동해시 북동쪽 52km 해역에서 발생한 규모 4.5 지진으로", displayKo: "강원 동해시 북동쪽 52km 해역에서 발생한 규모 4.5 지진으로", category: "place", archetype: "RESONANCE", stageZone: "ZONE_A_OCEAN", language: "ko-KR-official", translation: "강원 동해시 북동쪽 52km 해역에서 발생한 규모 4.5 지진으로" },
      { token: "2023년 봄 동해 연속 군발지진 중 최대 규모를 기록함", displayKo: "2023년 봄 동해 연속 군발지진 중 최대 규모를 기록함", category: "phenomenon", archetype: "RESONANCE", stageZone: "ZONE_A_OCEAN", language: "ko-KR-official", translation: "2023년 봄 동해 연속 군발지진 중 최대 규모를 기록함" }
    ],
    text: "강원 동해시 북동쪽 52km 해역에서 발생한 규모 4.5 군발지진 본진.",
    originalText: "강원 동해시 북동쪽 52km 해역에서 발생한 규모 4.5 군발지진 본진.",
    uncertainty: "현대 디지털 관측망 정밀 분석 (KMA ML 4.5 / USGS Mw 4.4)",
    links: [{ label: "KMA 지진 아카이브", url: KMA_ARCHIVE_URL }]
  },

  {
    eventId: "hist_2024_buan",
    id: "hist_2024_buan",
    era: "ERA_4_1999_PRESENT_DIGITAL",
    century: 21,
    catalogType: "INSTRUMENTAL_MODERN",
    country: "KOREA",
    recordType: "instrumental-modern",
    sourceName: "기상청 2024 부안 지진 분석 보고서",
    verification: "kma-verified",
    kind: "instrumental-modern",
    place: "2024 전북 부안 지진",
    dateText: "2024-06-12 08:26:49 KST",
    datePrecision: "second",
    temporal: {
      gregorianDate: "2024-06-12",
      gregorianPrecision: "SECOND",
      originTimeUTC: "2024-06-11T23:26:49Z"
    },
    spatial: {
      placeName: "전북특별자치도 부안군 남남서쪽 4km 지역",
      inferredCoordinates: {
        lat: 35.70,
        lon: 126.71,
        coordinateConfidence: "HIGH_PRECISION_INSTRUMENTAL",
        errorRadiusKm: 0.5
      },
      focalDepth: {
        valKm: 8.0,
        isKnown: true,
        determinationType: "INSTRUMENTAL_FREE_INVERSION",
        comment: "기상청 공식 발표 진원 깊이 8.0 km"
      }
    },
    time: F(Date.parse("2024-06-11T23:26:49Z"), "kma-verified", "기상청 공식: 2024-06-11 23:26:49 UTC"),
    lat: F(35.70, "kma-verified", "기상청 공식 좌표: 35.70°N"),
    lon: F(126.71, "kma-verified", "기상청 공식 좌표: 126.71°E"),
    depth: F(8.0, "kma-verified", "기상청 공식: 8.0 km"),
    mag: F(4.8, "kma-verified", "기상청 공식 ML 4.8 (USGS Mw 4.4)"),
    magType: "ML",
    faultStrikeDeg: 45,
    scientificEstimates: [
      {
        source: "기상청 (KMA)",
        estimatedMag: 4.8,
        magType: "ML",
        confidence: "PRIMARY_OFFICIAL"
      },
      {
        source: "미국지질조사국 (USGS)",
        estimatedMag: 4.4,
        magType: "Mw",
        confidence: "PRIMARY_OFFICIAL"
      }
    ],
    macroseismic: {
      maxIntensityMMI: {
        rawRoman: "V",
        numericEquivalent: 5.0,
        scale: "KMA 계기진도",
        basis: "전북 최대 계기진도 V, 벽체 균열 및 유리창 파손 보고"
      },
      feltRegionCount: 12,
      damageClass: 2,
      tsunamiObserved: false
    },
    rawValues: {
      rawI: 5.0,
      rawA: 45000,
      rawNloc: 12,
      rawFp: 3.8,
      rawNrep: 21,
      rawDclass: 2,
      rawD5: 8.5
    },
    primaryText: {
      originalScript: "전북 부안군 남남서쪽 4km 지역에서 규모 4.8 지진이 발생하여 최대 계기진도 V의 진동과 벽체 균열 피해가 보고됨.",
      scriptLanguage: "ko-KR-modern",
      documentSource: "기상청 지진화산국 공식 발표",
      sourceLocation: "전북특별자치도 부안군 남남서쪽 4km"
    },
    archivalLexicon: [
      { token: "전북 부안군 남남서쪽 4km 지역에서", displayKo: "전북 부안군 남남서쪽 4km 지역에서", category: "place", archetype: "RESONANCE", stageZone: "ZONE_B_INLAND", language: "ko-KR-official", translation: "전북 부안군 남남서쪽 4km 지역에서" },
      { token: "규모 4.8 지진이 발생하여", displayKo: "규모 4.8 지진이 발생하여", category: "phenomenon", archetype: "RESONANCE", stageZone: "ZONE_A_OCEAN", language: "ko-KR-official", translation: "규모 4.8 지진이 발생하여" },
      { token: "최대 계기진도 V의 진동과", displayKo: "최대 계기진도 V의 진동과", category: "structure", archetype: "RESONANCE", stageZone: "ZONE_B_INLAND", language: "ko-KR-official", translation: "최대 계기진도 V의 진동과" },
      { token: "벽체 균열 피해가 보고됨", displayKo: "벽체 균열 피해가 보고됨", category: "structure", archetype: "FRACTURE", stageZone: "ZONE_C_MOUNTAIN", language: "ko-KR-official", translation: "벽체 균열 피해가 보고됨" }
    ],
    text: "전북 부안군 남남서쪽 4km 지역에서 규모 4.8 지진이 발생하여 최대 계기진도 V의 진동과 벽체 균열 피해가 보고됨.",
    originalText: "전북 부안군 남남서쪽 4km 지역에서 규모 4.8 지진이 발생하여 최대 계기진도 V의 진동과 벽체 균열 피해가 보고됨.",
    uncertainty: "현대 디지털 관측망 정밀 계측 (KMA ML 4.8 / USGS Mw 4.4)",
    links: [{ label: "KMA 지진 아카이브", url: KMA_ARCHIVE_URL }]
  },

  // ==========================================================================
  // PHASE B: UNIVERSAL EARTHQUAKE ADAPTATION INTERNATIONAL BENCHMARKS
  // ==========================================================================
  {
    eventId: "global_2016_kumamoto",
    id: "global_2016_kumamoto",
    era: "ERA_4_1999_PRESENT_DIGITAL",
    century: 21,
    sequenceGroupId: "seq_2016_kumamoto",
    sequenceRole: "MAINSHOCK",
    catalogType: "INSTRUMENTAL_GLOBAL",
    recordType: "instrumental-global",
    sourceName: "일본 기상청(JMA) 및 미국지질조사국(USGS) 정밀 관측 보고",
    verification: "jma-usgs-verified",
    kind: "instrumental-global",
    place: "2016 일본 구마모토 지진 (본진)",
    dateText: "2016-04-16 01:25:06 JST",
    datePrecision: "second",
    temporal: {
      gregorianDate: "2016-04-16",
      gregorianPrecision: "SECOND",
      originTimeUTC: "2016-04-15T16:25:06Z"
    },
    spatial: {
      placeName: "일본 규슈 구마모토현 구마모토 평야 및 아소산 서측 지구대",
      inferredCoordinates: {
        lat: 32.7540,
        lon: 130.7630,
        coordinateConfidence: "HIGH_PRECISION_INSTRUMENTAL",
        errorRadiusKm: 0.3
      },
      focalDepth: {
        valKm: 10.0,
        isKnown: true,
        determinationType: "INSTRUMENTAL_FREE_INVERSION",
        comment: "후타가와-히나구 단층대 천발 지진 (깊이 10km, 지표 파쇄대 30km 노출)"
      }
    },
    time: F(Date.parse("2016-04-15T16:25:06Z"), "jma-verified", "JMA/USGS 공식 시각"),
    lat: F(32.7540, "jma-verified", "32.7540°N"),
    lon: F(130.7630, "jma-verified", "130.7630°E"),
    depth: F(10.0, "jma-verified", "10.0 km (천발 주향이동)"),
    mag: F(7.0, "jma-verified", "USGS Mw 7.0 / JMA Mj 7.3"),
    magType: "Mw",
    faultStrikeDeg: 60,
    geographicType: "INLAND_VOLCANIC_RIFT",
    scientificEstimates: [
      {
        source: "일본 기상청 (JMA)",
        estimatedMag: 7.3,
        magType: "Mj",
        confidence: "PRIMARY_OFFICIAL"
      },
      {
        source: "미국지질조사국 (USGS)",
        estimatedMag: 7.0,
        magType: "Mw",
        confidence: "PRIMARY_OFFICIAL"
      }
    ],
    primaryText: {
      originalScript: "平成28年4月16日01時25分 熊本県熊本地方を震源とするM7.3の地震 布田川断層帯に沿って最大震度7を観測 地表地震断層が出現",
      scriptLanguage: "ja-JP",
      translationKo: "2016년 4월 16일 구마모토현 구마모토 지방을 진원으로 하는 M7.3 지진 발생. 후타가와 단층대를 따라 최대 진도 7을 관측하고 지표 지진단층이 노출됨.",
      editorialPhraseKo: "화산 분지 대지가 찢어지다",
      evidenceStatus: "VERIFIED_PRIMARY_INSTRUMENTAL",
      documentSource: "일본 기상청 지진화산부 공식 보고서 (2016)",
      sourceLocation: "일본 규슈 구마모토현 및 아소 칼데라 서익"
    },
    archivalLexicon: [
      { token: "후타가와 단층대", displayKo: "후타가와 단층대", nativeText: "布田川断層帯", category: "geology", archetype: "FRACTURE", stageZone: "ZONE_B_INLAND", language: "ja-JP", translation: "후타가와 단층대" },
      { token: "진도 7 관측", displayKo: "진도 7 관측", nativeText: "震度7観測", category: "structure", archetype: "FRACTURE", stageZone: "ZONE_C_MOUNTAIN", language: "ja-JP", translation: "진도 7 관측" },
      { token: "지표 변위 2m", displayKo: "지표 변위 2m", nativeText: "地表変位 2m", category: "geology", archetype: "EXPOSE", stageZone: "ZONE_B_INLAND", language: "ja-JP", translation: "지표 변위 2m" },
      { token: "무너지다", displayKo: "무너지다", nativeText: "崩壊", category: "structure", archetype: "FRACTURE", stageZone: "ZONE_C_MOUNTAIN", language: "ja-JP", translation: "무너지다" }
    ],
    text: "구마모토 후타가와 단층대를 따라 M7.3 대지진 발생, 아소 화산 분지 지표 단층 파쇄.",
    originalText: "平成28年4月16日01時25分 熊本県熊本地方 M7.3 地震 布田川断層帯 震度7",
    uncertainty: "현대 정밀 디지털 관측망 (JMA/USGS); 진원 깊이 10km, 지표 단층 변위 최대 2m 실측",
    links: [{ label: "USGS Kumamoto Earthquake Event Page", url: "https://earthquake.usgs.gov/earthquakes/eventpage/us20005iis" }]
  },

  {
    eventId: "global_2023_turkey",
    id: "global_2023_turkey",
    era: "ERA_4_1999_PRESENT_DIGITAL",
    century: 21,
    sequenceGroupId: "seq_2023_turkey_syria",
    sequenceRole: "MAINSHOCK_1",
    catalogType: "INSTRUMENTAL_GLOBAL",
    recordType: "instrumental-global",
    sourceName: "튀르키예 AFAD 및 미국지질조사국(USGS) 정밀 관측 보고",
    verification: "afad-usgs-verified",
    kind: "instrumental-global",
    place: "2023 튀르키예 카흐라만마라슈 대단층 지진 (M7.8)",
    dateText: "2023-02-06 04:17:34 TRT",
    datePrecision: "second",
    temporal: {
      gregorianDate: "2023-02-06",
      gregorianPrecision: "SECOND",
      originTimeUTC: "2023-02-06T01:17:34Z"
    },
    spatial: {
      placeName: "튀르키예 중남부 카흐라만마라슈주 파자르즈크 및 동아나톨리아 단층대",
      inferredCoordinates: {
        lat: 37.1660,
        lon: 37.0420,
        coordinateConfidence: "HIGH_PRECISION_INSTRUMENTAL",
        errorRadiusKm: 0.2
      },
      focalDepth: {
        valKm: 10.0,
        isKnown: true,
        determinationType: "INSTRUMENTAL_FREE_INVERSION",
        comment: "동아나톨리아 대단층대 좌수향 주향이동 (깊이 10km, 단층 파쇄 길이 300km)"
      }
    },
    time: F(Date.parse("2023-02-06T01:17:34Z"), "usgs-verified", "USGS/AFAD 공식 시각"),
    lat: F(37.1660, "usgs-verified", "37.1660°N"),
    lon: F(37.0420, "usgs-verified", "37.0420°E"),
    depth: F(10.0, "usgs-verified", "10.0 km (천발 주향이동)"),
    mag: F(7.8, "usgs-verified", "Mw 7.8 (USGS / AFAD)"),
    magType: "Mw",
    faultStrikeDeg: 40,
    geographicType: "CONTINENTAL_STRIKE_SLIP_FAULT",
    scientificEstimates: [
      {
        source: "미국지질조사국 (USGS)",
        estimatedMag: 7.8,
        magType: "Mw",
        confidence: "PRIMARY_OFFICIAL"
      },
      {
        source: "튀르키예 재난위기관리청 (AFAD)",
        estimatedMag: 7.7,
        magType: "Mw",
        confidence: "PRIMARY_OFFICIAL"
      }
    ],
    primaryText: {
      originalScript: "06 Şubat 2023 saat 04:17 Kahramanmaraş Pazarcık Mw 7.8",
      scriptLanguage: "tr-TR",
      translationKo: "2023년 2월 6일 동아나톨리아 단층대 Mw 7.8 지진 · 단층 파쇄 길이 310km",
      editorialPhraseKo: "동아나톨리아 대단층 파쇄",
      evidenceStatus: "VERIFIED_PRIMARY_INSTRUMENTAL",
      documentSource: "AFAD 지진국 종합 분석 보고서 (2023)",
      sourceLocation: "튀르키예 카흐라만마라슈주 타우루스 산맥 및 동아나톨리아 단층 회랑"
    },
    archivalLexicon: [
      { token: "동아나톨리아 대단층", displayKo: "동아나톨리아 대단층", nativeText: "Doğu Anadolu Fayı", category: "geology", archetype: "FRACTURE", stageZone: "ZONE_B_INLAND", language: "tr-TR", translation: "동아나톨리아 대단층" },
      { token: "지표 파열 310km", displayKo: "지표 파열 310km", nativeText: "310 km Yüzey Kırığı", category: "geology", archetype: "FRACTURE", stageZone: "ZONE_C_MOUNTAIN", language: "tr-TR", translation: "지표 파열 310km" },
      { token: "최대 변위 6.5m", displayKo: "최대 변위 6.5m", nativeText: "Maksimum 6.5 m Kayma", category: "phenomenon", archetype: "EXPOSE", stageZone: "ZONE_B_INLAND", language: "tr-TR", translation: "최대 변위 6.5m" },
      { token: "갈라지다", displayKo: "갈라지다", nativeText: "Yarılmak", category: "geology", archetype: "FRACTURE", stageZone: "ZONE_C_MOUNTAIN", language: "tr-TR", translation: "갈라지다" }
    ],
    text: "동아나톨리아 대단층을 따라 Mw 7.8 대지진 발생, 타우루스 산맥 협곡 300km 단층 파쇄.",
    originalText: "06 Şubat 2023 saat 04:17 Kahramanmaraş Pazarcık Mw 7.8 Depremi",
    uncertainty: "현대 전 지구 광대역 지진계 및 InSAR 위성 관측; 지표 변위 최대 7m 측정",
    links: [{ label: "USGS Kahramanmaras Event Page", url: "https://earthquake.usgs.gov/earthquakes/eventpage/us6000jllz" }]
  },

  {
    eventId: "global_2011_tohoku",
    id: "global_2011_tohoku",
    era: "ERA_4_1999_PRESENT_DIGITAL",
    century: 21,
    sequenceGroupId: "seq_2011_tohoku",
    sequenceRole: "MAINSHOCK",
    catalogType: "INSTRUMENTAL_GLOBAL",
    recordType: "instrumental-global",
    sourceName: "일본 기상청(JMA) 및 미국지질조사국(USGS) 정밀 관측 보고",
    verification: "jma-usgs-verified",
    kind: "instrumental-global",
    place: "2011 동일본 대지진 (도호쿠 거대해구역단층 지진)",
    dateText: "2011-03-11 14:46:23 JST",
    datePrecision: "second",
    temporal: {
      gregorianDate: "2011-03-11",
      gregorianPrecision: "SECOND",
      originTimeUTC: "2011-03-11T05:46:23Z"
    },
    spatial: {
      placeName: "일본 도호쿠 미야기현 오시카 반도 동남동 130km 해역 (일본해구 섭입대)",
      inferredCoordinates: {
        lat: 38.2970,
        lon: 142.3730,
        coordinateConfidence: "HIGH_PRECISION_INSTRUMENTAL",
        errorRadiusKm: 0.1
      },
      focalDepth: {
        valKm: 29.0,
        isKnown: true,
        determinationType: "INSTRUMENTAL_FREE_INVERSION",
        comment: "태평양판-북미판 섭입대 메가스러스트 저경사 역단층 (심도 29km, 파쇄길이 500km)"
      }
    },
    time: F(Date.parse("2011-03-11T05:46:23Z"), "usgs-verified", "JMA/USGS 공식 시각"),
    lat: F(38.2970, "usgs-verified", "38.2970°N"),
    lon: F(142.3730, "usgs-verified", "142.3730°E"),
    depth: F(29.0, "usgs-verified", "29.0 km (해구 섭입대 역단층)"),
    mag: F(9.1, "usgs-verified", "Mw 9.1 (USGS / JMA)"),
    magType: "Mw",
    faultStrikeDeg: 203,
    geographicType: "OCEAN_TRENCH_SUBDUCTION",
    scientificEstimates: [
      {
        source: "미국지질조사국 (USGS)",
        estimatedMag: 9.1,
        magType: "Mw",
        confidence: "PRIMARY_OFFICIAL"
      },
      {
        source: "일본 기상청 (JMA)",
        estimatedMag: 9.0,
        magType: "Mw",
        confidence: "PRIMARY_OFFICIAL"
      }
    ],
    primaryText: {
      originalScript: "平成23年3月11日14時46分 三陸沖を震源とするMw 9.1の巨大地震 プレート境界断層が500kmにわたり破壊 最大波高40mを超える大津波が発生",
      scriptLanguage: "ja-JP",
      translationKo: "2011년 3월 11일 산리쿠 오프 해역을 진원으로 하는 Mw 9.1 거대 지진 발생. 판 경계 단층이 500km에 걸쳐 파쇄되고 최대 파고 40m를 초과하는 거대 지진해일(쓰나미)이 발생함.",
      editorialPhraseKo: "바다의 바닥이 솟구치다",
      evidenceStatus: "VERIFIED_PRIMARY_INSTRUMENTAL",
      documentSource: "JMA 지진화산부 공식 보고서 및 USGS Global CMT Analysis",
      sourceLocation: "일본 미야기현 앞바다 일본해구 섭입대"
    },
    archivalLexicon: [
      { token: "판 경계 파열 500km", displayKo: "판 경계 파열 500km", nativeText: "断層破壊 500km", category: "geology", archetype: "FRACTURE", stageZone: "ZONE_A_SEAWARD", language: "ja-JP", translation: "판 경계 파열 500km" },
      { token: "최대 파고 40m", displayKo: "최대 파고 40m", nativeText: "最大波高 40m", category: "phenomenon", archetype: "RECEDE", stageZone: "ZONE_A_SEAWARD", language: "ja-JP", translation: "최대 파고 40m" },
      { token: "해저 지반 융기 5m", displayKo: "해저 지반 융기 5m", nativeText: "海底隆起 5m", category: "geology", archetype: "EXPOSE", stageZone: "ZONE_A_SEAWARD", language: "ja-JP", translation: "해저 지반 융기 5m" },
      { token: "솟구치다", displayKo: "솟구치다", nativeText: "湧き上がる", category: "phenomenon", archetype: "RESONANCE", stageZone: "ZONE_A_SEAWARD", language: "ja-JP", translation: "솟구치다" }
    ],
    text: "일본해구 메가스러스트 단층 500km 파쇄, Mw 9.1 거대해구역단층 지진 및 40m 쓰나미 유발.",
    originalText: "平成23年3月11日 三陸沖 Mw 9.1 東日本大震災 プレート境界破壊",
    uncertainty: "현대 글로벌 광대역 관측망(GSN) 및 해저 수압계 실측 자료; 진원 깊이 29km, 해저 최대 미끄러짐 50m 역산",
    links: [{ label: "USGS Tohoku Earthquake Event Page", url: "https://earthquake.usgs.gov/earthquakes/eventpage/official20110311054624120_30" }]
  }
];

// Ensure all entries are explicitly marked as modern instrumental
INSTRUMENTAL_EVENTS.forEach(ev => {
  ev.isInstrumental = true;
});

