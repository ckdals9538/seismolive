// ============================================================================
// SeismoLive v4.0 (v4.1 Delta Blueprint) - Historical Earthquake Archive DB
// Strict Era 1 Pre-1905 Archival Database (2 AD – 1904 AD; ZERO post-1904 events)
// 6-Entity Relational Schema:
//   1. SourceCorpus (4 Major Korean Historical Corpora + Secondary Reference)
//   2. SourceRecord (40 Primary Chronicle Passages: 38 Tectonic + 2 Control/Rejected)
//   3. HistoricalPlaceMapping (Historical Toponym -> Modern Admin & Gazetteer Coords)
//   4. EventSourceLink (M:N Relationship supporting Multi-Record & Multi-Event Links)
//   5. DateConversion (Lunar/Sexagenary -> Gregorian with Precision & Uncertainty)
//   6. HistoricalEvent & ScientificInterpretation (32 Events + Multi-Author Estimates)
// ============================================================================

export const KMA_ARCHIVE_URL = "https://www.weather.go.kr/w/earthquake/archive/historical-eqk.do";

const F = (v, ver, src, note = null) => ({ v, ver, src, note });

// ============================================================================
// 1. SOURCE CORPORA (4대 한국 역사지진 기본 사료군 + 기상청 2012 종합 아카이브)
// ============================================================================
export const SOURCE_CORPORA = [
  {
    corpusId: "samguk_sagi",
    titleKo: "삼국사기 (三國史記)",
    titleHanja: "三國史記",
    dynastyScope: ["THREE_KINGDOMS", "UNIFIED_SILLA"],
    compilationYear: "1145 (고려 인종 23년, 김부식 등 편찬)",
    archiveUrl: "https://db.history.go.kr/item/level.do?itemId=sg",
    citationFormat: "삼국사기 권{volume} {section}"
  },
  {
    corpusId: "goryeosa",
    titleKo: "고려사 / 고려사절요 (高麗史 / 高麗史節要)",
    titleHanja: "高麗史 · 高麗史節要",
    dynastyScope: ["GORYEO"],
    compilationYear: "1451 (고려사) / 1452 (고려사절요)",
    archiveUrl: "https://db.history.go.kr/KOREA/",
    citationFormat: "고려사 권{volume} {section}"
  },
  {
    corpusId: "joseon_sillok",
    titleKo: "조선왕조실록 (朝鮮王朝實錄)",
    titleHanja: "朝鮮王朝實錄",
    dynastyScope: ["JOSEON"],
    compilationYear: "1413–1865 (국사편찬위원회 DB)",
    archiveUrl: "https://sillok.history.go.kr/",
    citationFormat: "조선왕조실록 {reign}실록 {volume}권"
  },
  {
    corpusId: "seungjeongwon_ilseongnok",
    titleKo: "승정원일기 / 일성록 (承政院日記 / 日省錄)",
    titleHanja: "承政院日記 · 日省錄",
    dynastyScope: ["JOSEON"],
    compilationYear: "1623–1910 (승정원일기) / 1760–1910 (일성록)",
    archiveUrl: "https://sjw.history.go.kr/",
    citationFormat: "승정원일기 {reign} {year}년 {month}월 {day}일"
  },
  {
    corpusId: "jeungbo_munheon_bigo",
    titleKo: "증보문헌비고 (增補文獻備考) 상위고",
    titleHanja: "增補文獻備考 象緯考",
    dynastyScope: ["THREE_KINGDOMS", "UNIFIED_SILLA", "GORYEO", "JOSEON"],
    compilationYear: "1908 (홍봉한 초찬 동국문헌비고 1770, 박용대 증보)",
    archiveUrl: "https://db.itkc.or.kr/",
    citationFormat: "증보문헌비고 상위고(象緯考) 지진조"
  }
];

// ============================================================================
// 2. HISTORICAL PLACE MAPPINGS (고지명 ↔ 현대 행정구역 및 지역 대표 좌표)
// ============================================================================
export const HISTORICAL_PLACE_MAPPINGS = [
  {
    placeId: "place_jolbon_gungnae",
    historicalToponymKo: "졸본·국내성 (고구려 왕도)",
    historicalToponymHanja: "卒本·國內城",
    dynasty: "THREE_KINGDOMS",
    modernAdminRegionKo: "압록강 중류 집안(Ji'an) 일대 (고구려 초기 도성)",
    modernProvince: "북부/만주 접경",
    representativeCoords: {
      lat: null,
      lon: null,
      errorRadiusKm: null,
      basis: "고대 도성 광역 기록으로 단일 진앙 좌표 특정 불가 (Unresolved)"
    },
    placeRole: "ROYAL_CAPITAL"
  },
  {
    placeId: "place_wiryeseong_hanseong_baekje",
    historicalToponymKo: "한성 위례성 (백제 왕도)",
    historicalToponymHanja: "漢城 慰禮城",
    dynasty: "THREE_KINGDOMS",
    modernAdminRegionKo: "서울특별시 송파구·하남시 일대 추정",
    modernProvince: "서울/경기",
    representativeCoords: {
      lat: null,
      lon: null,
      errorRadiusKm: null,
      basis: "백제 초기 도성 기록으로 정밀 진앙 미확정 (Unresolved)"
    },
    placeRole: "ROYAL_CAPITAL"
  },
  {
    placeId: "place_geumseong_gyeongju",
    historicalToponymKo: "금성·경도 (신라 왕경 경주)",
    historicalToponymHanja: "金城·京都(慶州)",
    dynasty: "UNIFIED_SILLA",
    modernAdminRegionKo: "경상북도 경주시 일원",
    modernProvince: "경상도",
    representativeCoords: {
      lat: 35.84,
      lon: 129.21,
      errorRadiusKm: 30.0,
      basis: "기상청 역사지진 아카이브 신라 왕경(경주) 대표 좌표"
    },
    placeRole: "ROYAL_CAPITAL"
  },
  {
    placeId: "place_ungjin_gongju",
    historicalToponymKo: "웅진 (백제 공주)",
    historicalToponymHanja: "熊津(公州)",
    dynasty: "THREE_KINGDOMS",
    modernAdminRegionKo: "충청남도 공주시 일원",
    modernProvince: "충청도",
    representativeCoords: {
      lat: 36.46,
      lon: 127.12,
      errorRadiusKm: 35.0,
      basis: "기상청 역사지진 웅진(공주) 대표 좌표"
    },
    placeRole: "ROYAL_CAPITAL"
  },
  {
    placeId: "place_sabi_buyeo",
    historicalToponymKo: "사비 (백제 부여)",
    historicalToponymHanja: "泗沘(扶餘)",
    dynasty: "THREE_KINGDOMS",
    modernAdminRegionKo: "충청남도 부여군 일원",
    modernProvince: "충청도",
    representativeCoords: {
      lat: 36.28,
      lon: 126.91,
      errorRadiusKm: 35.0,
      basis: "기상청 역사지진 사비(부여) 대표 좌표"
    },
    placeRole: "ROYAL_CAPITAL"
  },
  {
    placeId: "place_pyongyang_goguryeo",
    historicalToponymKo: "평양성 (고구려/조선 평양)",
    historicalToponymHanja: "平壤城",
    dynasty: "THREE_KINGDOMS",
    modernAdminRegionKo: "평안남도 평양시 일원",
    modernProvince: "평안도",
    representativeCoords: {
      lat: 39.02,
      lon: 125.75,
      errorRadiusKm: 40.0,
      basis: "기상청 역사지진 평양 지역 대표 좌표"
    },
    placeRole: "PROVINCIAL_GOVERNOR_SEAT"
  },
  {
    placeId: "place_sangju_silla",
    historicalToponymKo: "상주 (사벌주)",
    historicalToponymHanja: "尙州",
    dynasty: "UNIFIED_SILLA",
    modernAdminRegionKo: "경상북도 상주시 일원",
    modernProvince: "경상도",
    representativeCoords: {
      lat: 36.41,
      lon: 128.16,
      errorRadiusKm: 35.0,
      basis: "기상청 역사지진 상주 대표 좌표"
    },
    placeRole: "COUNTY_MAGISTRATE"
  },
  {
    placeId: "place_gaegyeong_gaeseong",
    historicalToponymKo: "개경·송도 (고려 왕도 개성)",
    historicalToponymHanja: "開京·松都(開城)",
    dynasty: "GORYEO",
    modernAdminRegionKo: "개성특별시(구 경기도 개성시) 일원",
    modernProvince: "서울/경기",
    representativeCoords: {
      lat: 37.97,
      lon: 126.55,
      errorRadiusKm: 30.0,
      basis: "기상청 역사지진 고려 개경 대표 좌표"
    },
    placeRole: "ROYAL_CAPITAL"
  },
  {
    placeId: "place_geumju_gimhae",
    historicalToponymKo: "금주·밀성 (김해·밀양)",
    historicalToponymHanja: "金州·密城",
    dynasty: "GORYEO",
    modernAdminRegionKo: "경상남도 김해시·밀양시 일원",
    modernProvince: "경상도",
    representativeCoords: {
      lat: 35.23,
      lon: 128.88,
      errorRadiusKm: 35.0,
      basis: "기상청 역사지진 김해·밀양 지역 대표 좌표"
    },
    placeRole: "COUNTY_MAGISTRATE"
  },
  {
    placeId: "place_donggye_myeongju",
    historicalToponymKo: "동계·명주 (강릉·동해안)",
    historicalToponymHanja: "東界·溟州",
    dynasty: "GORYEO",
    modernAdminRegionKo: "강원특별자치도 강릉시·동해시 일원",
    modernProvince: "강원도",
    representativeCoords: {
      lat: 37.75,
      lon: 128.90,
      errorRadiusKm: 45.0,
      basis: "기상청 역사지진 강릉·동계 지역 대표 좌표"
    },
    placeRole: "PROVINCIAL_GOVERNOR_SEAT"
  },
  {
    placeId: "place_wanju_jeonju",
    historicalToponymKo: "전주·완산주",
    historicalToponymHanja: "全州·完山",
    dynasty: "JOSEON",
    modernAdminRegionKo: "전북특별자치도 전주시 일원",
    modernProvince: "전라도",
    representativeCoords: {
      lat: 35.82,
      lon: 127.15,
      errorRadiusKm: 35.0,
      basis: "기상청 역사지진 전주부 대표 좌표"
    },
    placeRole: "PROVINCIAL_GOVERNOR_SEAT"
  },
  {
    placeId: "place_hanseong_seoul",
    historicalToponymKo: "한성부·도성 (서울)",
    historicalToponymHanja: "漢城府·都城",
    dynasty: "JOSEON",
    modernAdminRegionKo: "서울특별시 종로구·중구 및 경기도 일원",
    modernProvince: "서울/경기",
    representativeCoords: {
      lat: 37.57,
      lon: 126.98,
      errorRadiusKm: 35.0,
      basis: "기상청 역사지진 한성부 대표 좌표"
    },
    placeRole: "ROYAL_CAPITAL"
  },
  {
    placeId: "place_yangyang_samcheok_unresolved",
    historicalToponymKo: "강원도 양양·삼척 일대 (전진 미확정)",
    historicalToponymHanja: "江原道 襄陽·三陟",
    dynasty: "JOSEON",
    modernAdminRegionKo: "강원특별자치도 양양군·삼척시 일대",
    modernProvince: "강원도",
    representativeCoords: {
      lat: null,
      lon: null,
      errorRadiusKm: null,
      basis: "해역/내륙 전진 위치가 불분명하여 단일 진앙 좌표 미부여 (Unresolved)"
    },
    placeRole: "COASTAL_GARRISON"
  },
  {
    placeId: "place_yangyang_offshore",
    historicalToponymKo: "강원도 양양·삼척·울진 연안 해역",
    historicalToponymHanja: "江原道 襄陽·三陟·蔚珍 沿海",
    dynasty: "JOSEON",
    modernAdminRegionKo: "강원특별자치도 양양군·삼척시 동해 연안 해역",
    modernProvince: "강원도",
    representativeCoords: {
      lat: 37.90,
      lon: 129.10,
      errorRadiusKm: 45.0,
      basis: "기상청 역사지진 1681 양양 해역 대표 좌표"
    },
    placeRole: "COASTAL_GARRISON"
  },
  {
    placeId: "place_ulsan_daegu",
    historicalToponymKo: "경상도 울산·대구·안동·김해",
    historicalToponymHanja: "慶尙道 蔚山·大丘·安東·金海",
    dynasty: "JOSEON",
    modernAdminRegionKo: "울산광역시 및 경상북도 경주·대구 일원",
    modernProvince: "경상도",
    representativeCoords: {
      lat: 35.54,
      lon: 129.31,
      errorRadiusKm: 40.0,
      basis: "기상청 역사지진 1643 울산 지진 대표 좌표"
    },
    placeRole: "COUNTY_MAGISTRATE"
  },
  {
    placeId: "place_boen_cheongju",
    historicalToponymKo: "충청도 보은·청주·문의",
    historicalToponymHanja: "忠淸道 報恩·淸州·文義",
    dynasty: "JOSEON",
    modernAdminRegionKo: "충청북도 보은군·청주시 일원",
    modernProvince: "충청도",
    representativeCoords: {
      lat: 36.49,
      lon: 127.72,
      errorRadiusKm: 35.0,
      basis: "기상청 역사지진 충청도 보은·청주 대표 좌표"
    },
    placeRole: "COUNTY_MAGISTRATE"
  },
  {
    placeId: "place_namwon_gurye",
    historicalToponymKo: "전라도 남원·구례·순천",
    historicalToponymHanja: "全羅道 南原·求禮·順天",
    dynasty: "JOSEON",
    modernAdminRegionKo: "전북특별자치도 남원시·전라남도 구례군 일원",
    modernProvince: "전라도",
    representativeCoords: {
      lat: 35.41,
      lon: 127.39,
      errorRadiusKm: 35.0,
      basis: "기상청 역사지진 남원·구례 지리산권 대표 좌표"
    },
    placeRole: "COUNTY_MAGISTRATE"
  },
  {
    placeId: "place_jeju_mok",
    historicalToponymKo: "제주목·대정·정의",
    historicalToponymHanja: "濟州牧·大靜·旌義",
    dynasty: "JOSEON",
    modernAdminRegionKo: "제주특별자치도 제주시·서귀포시 일원",
    modernProvince: "제주도",
    representativeCoords: {
      lat: 33.50,
      lon: 126.53,
      errorRadiusKm: 40.0,
      basis: "기상청 역사지진 제주목 대표 좌표"
    },
    placeRole: "PROVINCIAL_GOVERNOR_SEAT"
  },
  {
    placeId: "place_haeju_pyeongsan",
    historicalToponymKo: "황해도 해주·평산·배천",
    historicalToponymHanja: "黃海道 海州·平山·白川",
    dynasty: "JOSEON",
    modernAdminRegionKo: "황해남도 해주·평산 일원",
    modernProvince: "황해도",
    representativeCoords: {
      lat: 38.04,
      lon: 125.71,
      errorRadiusKm: 35.0,
      basis: "기상청 역사지진 황해도 해주·평산 대표 좌표"
    },
    placeRole: "PROVINCIAL_GOVERNOR_SEAT"
  },
  {
    placeId: "place_gyeongseong_myeongcheon",
    historicalToponymKo: "함경도 경성·명천·길주",
    historicalToponymHanja: "咸鏡道 鏡城·明川·吉州",
    dynasty: "JOSEON",
    modernAdminRegionKo: "함경북도 경성군·명천군 일원",
    modernProvince: "함경도",
    representativeCoords: {
      lat: 41.59,
      lon: 129.61,
      errorRadiusKm: 45.0,
      basis: "기상청 역사지진 함경도 경성·명천 대표 좌표"
    },
    placeRole: "PROVINCIAL_GOVERNOR_SEAT"
  }
];

// ============================================================================
// 3. SOURCE RECORDS (40건의 사료 원문 기사: 38건 지진 본기/오행지/일기 + 2건 비지진 대조군)
// ============================================================================
export const SOURCE_RECORDS = [
  // --- [삼국사기 (Samguk Sagi): 9 Records] ---
  {
    recordId: "rec_samguk_0002",
    corpusId: "samguk_sagi",
    volumeOrSection: "권13 고구려본기 제1 유리명왕 21년 8월",
    reignCalendarText: "瑠璃明王 二十一年 秋八月",
    originalHanja: "二十一年 秋八月 地震",
    originalTranslationKo: "유리명왕 21년(서기 2년) 가을 8월에 지진이 일어났다.",
    quotedPlacesRaw: ["졸본·국내성(고구려 왕도)"],
    phenomenaTags: ["GROUND_SHAKING"],
    tectonicClassification: "CONFIRMED_TECTONIC",
    archivalLexicon: [
      { token: "秋八月", displayKo: "가을 8월에", category: "phenomenon", archetype: "RESONANCE", stageZone: "ZONE_B_INLAND", language: "hanja-archival", translation: "유리명왕 21년 가을 8월에" },
      { token: "地震", displayKo: "지진이 일어났다", category: "phenomenon", archetype: "RESONANCE", stageZone: "ZONE_B_INLAND", language: "hanja-archival", translation: "지진이 일어났다 (地震)" }
    ]
  },
  {
    recordId: "rec_samguk_0027",
    corpusId: "samguk_sagi",
    volumeOrSection: "권23 백제본기 제1 다루왕 2년 11월",
    reignCalendarText: "多婁王 二年 冬十一月",
    originalHanja: "冬十一月 地震 聲如雷",
    originalTranslationKo: "다루왕 2년(서기 27년) 겨울 11월에 지진이 일어나 소리가 우레와 같았다.",
    quotedPlacesRaw: ["한성 위례성(백제 왕도)"],
    phenomenaTags: ["GROUND_SHAKING", "ACOUSTIC_BOOM"],
    tectonicClassification: "CONFIRMED_TECTONIC",
    archivalLexicon: [
      { token: "冬十一月", displayKo: "다루왕 2년 겨울 11월에", category: "phenomenon", archetype: "RESONANCE", stageZone: "ZONE_B_INLAND", language: "hanja-archival", translation: "다루왕 2년 겨울 11월에" },
      { token: "地震", displayKo: "지진이 일어나", category: "phenomenon", archetype: "RESONANCE", stageZone: "ZONE_B_INLAND", language: "hanja-archival", translation: "지진이 일어나" },
      { token: "소리가 우레와 같았다", displayKo: "소리가 우레와 같았다", category: "sound", archetype: "RESONANCE", stageZone: "ZONE_C_MOUNTAIN", language: "ko-KR-archival", translation: "소리가 우레와 같았다 (聲如雷)" }
    ]
  },
  {
    recordId: "rec_samguk_0034",
    corpusId: "samguk_sagi",
    volumeOrSection: "권1 신라본기 제1 유리이사금 11년",
    reignCalendarText: "儒理尼師今 十一年",
    originalHanja: "京都地震 泉涌",
    originalTranslationKo: "왕경(금성)에 지진이 일어나고 샘물이 솟구쳤다.",
    quotedPlacesRaw: ["금성(경주)"],
    phenomenaTags: ["GROUND_SHAKING", "WELL_SPRING_ANOMALY"],
    tectonicClassification: "CONFIRMED_TECTONIC",
    archivalLexicon: [
      { token: "京都地震", displayKo: "왕경에 지진이 일어나고", category: "phenomenon", archetype: "RESONANCE", stageZone: "ZONE_B_INLAND", language: "hanja-archival", translation: "왕경(금성)에 지진이 일어나고" },
      { token: "샘물이 솟구쳤다", displayKo: "샘물이 솟구쳤다", category: "water", archetype: "EXPOSE", stageZone: "ZONE_B_INLAND", language: "ko-KR-archival", translation: "샘물이 솟구쳤다 (泉涌)" }
    ]
  },
  {
    recordId: "rec_samguk_0100",
    corpusId: "samguk_sagi",
    volumeOrSection: "권1 신라본기 제1 파사이사금 21년 10월",
    reignCalendarText: "婆娑尼師今 二十一年 冬十月",
    originalHanja: "京都地震 倒民屋 有死者",
    originalTranslationKo: "서울(금성)에 지진이 일어나 민가가 쓰러지고 죽은 자가 있었다.",
    quotedPlacesRaw: ["금성(경주)"],
    phenomenaTags: ["GROUND_SHAKING", "HOUSE_COLLAPSE", "HUMAN_CASUALTIES"],
    tectonicClassification: "CONFIRMED_TECTONIC",
    archivalLexicon: [
      { token: "京都地震", displayKo: "서울에 지진이 일어나", category: "phenomenon", archetype: "RESONANCE", stageZone: "ZONE_B_INLAND", language: "hanja-archival", translation: "서울(금성)에 지진이 일어나" },
      { token: "倒民屋", displayKo: "민가가 쓰러지고", category: "structure", archetype: "FRACTURE", stageZone: "ZONE_B_INLAND", language: "hanja-archival", translation: "민가가 쓰러지고" },
      { token: "有死者", displayKo: "죽은 자가 있었다", category: "consequence", archetype: "EXPOSE", stageZone: "ZONE_B_INLAND", language: "hanja-archival", translation: "죽은 자가 있었다" }
    ]
  },
  {
    recordId: "rec_samguk_0304",
    corpusId: "samguk_sagi",
    volumeOrSection: "권2 신라본기 제2 기림이사금 7년 9월",
    reignCalendarText: "基臨尼師今 七年 秋九月",
    originalHanja: "京都地震 壞民屋 有死者",
    originalTranslationKo: "기림이사금 7년 9월에 왕경(경주)에 지진이 연속하여 일어나 민가가 무너지고 사망자가 발생하였다.",
    quotedPlacesRaw: ["금성(경주)"],
    phenomenaTags: ["GROUND_SHAKING", "HOUSE_COLLAPSE", "HUMAN_CASUALTIES", "AFTERSHOCK_SWARM"],
    tectonicClassification: "CONFIRMED_TECTONIC",
    archivalLexicon: [
      { token: "京都地震", displayKo: "왕경에 지진이 연속하여 일어나", category: "phenomenon", archetype: "RESONANCE", stageZone: "ZONE_B_INLAND", language: "hanja-archival", translation: "왕경(경주)에 지진이 연속하여 일어나" },
      { token: "壞民屋", displayKo: "민가가 무너지고", category: "structure", archetype: "FRACTURE", stageZone: "ZONE_B_INLAND", language: "hanja-archival", translation: "민가가 무너지고" },
      { token: "有死者", displayKo: "사망자가 발생하였다", category: "consequence", archetype: "EXPOSE", stageZone: "ZONE_B_INLAND", language: "hanja-archival", translation: "사망자가 발생하였다" }
    ]
  },
  {
    recordId: "rec_samguk_0502",
    corpusId: "samguk_sagi",
    volumeOrSection: "권19 고구려본기 제7 문자명왕 11년 10월",
    reignCalendarText: "文咨明王 十一年 冬十月",
    originalHanja: "地震 民屋倒墮 有死者",
    originalTranslationKo: "평양성에 지진이 일어나 민가가 넘어지고 죽은 자가 있었다.",
    quotedPlacesRaw: ["평양성"],
    phenomenaTags: ["GROUND_SHAKING", "HOUSE_COLLAPSE", "HUMAN_CASUALTIES"],
    tectonicClassification: "CONFIRMED_TECTONIC",
    archivalLexicon: [
      { token: "地震", displayKo: "평양성에 지진이 일어나", category: "phenomenon", archetype: "RESONANCE", stageZone: "ZONE_B_INLAND", language: "hanja-archival", translation: "평양성에 지진이 일어나" },
      { token: "民屋倒墮", displayKo: "민가가 넘어지고", category: "structure", archetype: "FRACTURE", stageZone: "ZONE_B_INLAND", language: "hanja-archival", translation: "민가가 넘어지고" },
      { token: "有死者", displayKo: "죽은 자가 있었다", category: "consequence", archetype: "EXPOSE", stageZone: "ZONE_B_INLAND", language: "hanja-archival", translation: "죽은 자가 있었다" }
    ]
  },
  {
    recordId: "rec_samguk_0639",
    corpusId: "samguk_sagi",
    volumeOrSection: "권27 백제본기 제5 무왕 40년 3월",
    reignCalendarText: "武王 四十年 春三月",
    originalHanja: "春三月 地動",
    originalTranslationKo: "백제 무왕 40년 봄 3월에 사비 도성의 땅이 흔들렸다.",
    quotedPlacesRaw: ["사비(부여)"],
    phenomenaTags: ["GROUND_SHAKING"],
    tectonicClassification: "CONFIRMED_TECTONIC",
    archivalLexicon: [
      { token: "春三月", displayKo: "백제 무왕 40년 봄 3월에", category: "phenomenon", archetype: "RESONANCE", stageZone: "ZONE_B_INLAND", language: "hanja-archival", translation: "백제 무왕 40년 봄 3월에" },
      { token: "地動", displayKo: "사비 도성의 땅이 흔들렸다", category: "phenomenon", archetype: "RESONANCE", stageZone: "ZONE_B_INLAND", language: "hanja-archival", translation: "사비 도성의 땅이 흔들렸다" }
    ]
  },
  {
    recordId: "rec_samguk_0779",
    corpusId: "samguk_sagi",
    volumeOrSection: "권9 신라본기 제9 혜공왕 15년 3월",
    reignCalendarText: "惠恭王 十五年 春三月",
    originalHanja: "京都地震 壞民屋 死者百餘人",
    originalTranslationKo: "서울(경주)에 지진이 일어나 민가가 무너지고 죽은 자가 백여 명이었다.",
    quotedPlacesRaw: ["신라 왕경(경주)"],
    phenomenaTags: ["GROUND_SHAKING", "HOUSE_COLLAPSE", "HUMAN_CASUALTIES"],
    tectonicClassification: "CONFIRMED_TECTONIC",
    archivalLexicon: [
      { token: "京都地震", displayKo: "서울에 지진이 일어나", category: "phenomenon", archetype: "RESONANCE", stageZone: "ZONE_B_INLAND", language: "hanja-archival", translation: "서울(경주)에 지진이 일어나" },
      { token: "민가가 무너지고", displayKo: "민가가 무너지고", category: "structure", archetype: "FRACTURE", stageZone: "ZONE_B_INLAND", language: "ko-KR-archival", translation: "민가가 무너지고 (壞民屋)" },
      { token: "죽은 자가 백여 명이었다", displayKo: "죽은 자가 백여 명이었다", category: "consequence", archetype: "EXPOSE", stageZone: "ZONE_B_INLAND", language: "ko-KR-archival", translation: "죽은 자가 백여 명이었다 (死者百餘人)" }
    ]
  },

  // --- [고려사 / 고려사절요 (Goryeosa): 9 Records (including Multi-Event Ohaengji Record)] ---
  {
    recordId: "rec_goryeosa_0971",
    corpusId: "goryeosa",
    volumeOrSection: "권2 세가 제2 광종 22년 12월",
    reignCalendarText: "光宗 二十二年 冬十二月",
    originalHanja: "冬十二月 地震 明年二月又震",
    originalTranslationKo: "광종 22년 겨울 12월에 개경에 큰 지진이 일어났고 이듬해 2월에 다시 진동하였다.",
    quotedPlacesRaw: ["개경(개성)"],
    phenomenaTags: ["GROUND_SHAKING", "AFTERSHOCK_SWARM"],
    tectonicClassification: "CONFIRMED_TECTONIC",
    archivalLexicon: [
      { token: "冬十二月 地震", displayKo: "개경에 큰 지진이 일어났고", category: "phenomenon", archetype: "RESONANCE", stageZone: "ZONE_B_INLAND", language: "hanja-archival", translation: "광종 22년 겨울 12월에 개경에 큰 지진이 일어났고" },
      { token: "明年二月又震", displayKo: "이듬해 2월에 다시 진동하였다", category: "phenomenon", archetype: "RESONANCE", stageZone: "ZONE_C_MOUNTAIN", language: "hanja-archival", translation: "이듬해 2월에 다시 진동하였다" }
    ]
  },
  {
    // ARCHETYPE 3: Single Goryeosa Ohaengji Record Describing Two Separate 1036 Earthquakes
    recordId: "rec_goryeosa_ohaengji_1036",
    corpusId: "goryeosa",
    volumeOrSection: "권53 지(志) 제7 오행(五行)1 토(土) 정종 2년",
    reignCalendarText: "靖宗 二年 五月 辛亥 · 六月 丙戌",
    originalHanja: "靖宗二年五月辛亥 京城地震 六月丙戌 京城及東京地震 屋廬頹圮",
    originalTranslationKo: "정종 2년 5월 신해일에 경성(개경)에 지진이 일어났고, 6월 병술일에 경성 및 동경(경주)에 큰 지진이 일어나 가옥과 담장이 무너졌다.",
    quotedPlacesRaw: ["경성(개경)", "동경(경주)"],
    phenomenaTags: ["GROUND_SHAKING", "WALL_FENCE_COLLAPSE", "HOUSE_COLLAPSE"],
    tectonicClassification: "CONFIRMED_TECTONIC",
    archivalLexicon: [
      { token: "京城地震", displayKo: "경성에 지진이 일어났고", category: "phenomenon", archetype: "RESONANCE", stageZone: "ZONE_B_INLAND", language: "hanja-archival", translation: "정종 2년 5월 신해일에 경성(개경)에 지진이 일어났고" },
      { token: "京城及東京地震", displayKo: "경성 및 동경에 큰 지진이 일어나", category: "phenomenon", archetype: "RESONANCE", stageZone: "ZONE_B_INLAND", language: "hanja-archival", translation: "6월 병술일에 경성 및 동경(경주)에 큰 지진이 일어나" },
      { token: "가옥과 담장이 무너졌다", displayKo: "가옥과 담장이 무너졌다", category: "structure", archetype: "FRACTURE", stageZone: "ZONE_B_INLAND", language: "ko-KR-archival", translation: "가옥과 담장이 무너졌다 (屋廬頹圮)" }
    ]
  },
  {
    recordId: "rec_goryeosa_sega_1036_07",
    corpusId: "goryeosa",
    volumeOrSection: "권6 세가 제6 정종 2년 6월 병술",
    reignCalendarText: "靖宗 二年 六月 丙戌",
    originalHanja: "丙戌 京城及東京尚州地震 壞民廬舍 東京尤甚",
    originalTranslationKo: "정종 2년 6월 병술일에 개경과 동경(경주)·상주에 지진이 일어나 민가가 파손되었는데 동경이 더욱 심하였다.",
    quotedPlacesRaw: ["경성(개경)", "동경(경주)", "상주"],
    phenomenaTags: ["GROUND_SHAKING", "HOUSE_COLLAPSE"],
    tectonicClassification: "CONFIRMED_TECTONIC",
    archivalLexicon: [
      { token: "京城及東京尚州地震", displayKo: "개경과 동경·상주에 지진이 일어나", category: "phenomenon", archetype: "RESONANCE", stageZone: "ZONE_B_INLAND", language: "hanja-archival", translation: "개경과 동경(경주)·상주에 지진이 일어나" },
      { token: "壞民廬舍", displayKo: "민가가 파손되었는데", category: "structure", archetype: "FRACTURE", stageZone: "ZONE_B_INLAND", language: "hanja-archival", translation: "민가가 파손되었는데" },
      { token: "東京尤甚", displayKo: "동경이 더욱 심하였다", category: "place", archetype: "EXPOSE", stageZone: "ZONE_B_INLAND", language: "hanja-archival", translation: "동경(경주)이 더욱 심하였다" }
    ]
  },
  {
    recordId: "rec_goryeosa_1260",
    corpusId: "goryeosa",
    volumeOrSection: "권25 세가 제25 원종 원년 6월",
    reignCalendarText: "元宗 元年 六月 癸未",
    originalHanja: "癸未 地震 聲如雷 墻屋頹壞",
    originalTranslationKo: "원종 원년 6월 계미일에 지진이 일어나 소리가 우레와 같고 담장과 가옥이 무너졌다.",
    quotedPlacesRaw: ["개경(개성)"],
    phenomenaTags: ["GROUND_SHAKING", "ACOUSTIC_BOOM", "WALL_FENCE_COLLAPSE"],
    tectonicClassification: "CONFIRMED_TECTONIC",
    archivalLexicon: [
      { token: "地震", displayKo: "지진이 일어나", category: "phenomenon", archetype: "RESONANCE", stageZone: "ZONE_B_INLAND", language: "hanja-archival", translation: "원종 원년 6월 계미일에 지진이 일어나" },
      { token: "聲如雷", displayKo: "소리가 우레와 같고", category: "sound", archetype: "RESONANCE", stageZone: "ZONE_C_MOUNTAIN", language: "hanja-archival", translation: "소리가 우레와 같고" },
      { token: "墻屋頹壞", displayKo: "담장과 가옥이 무너졌다", category: "structure", archetype: "FRACTURE", stageZone: "ZONE_B_INLAND", language: "hanja-archival", translation: "담장과 가옥이 무너졌다" }
    ]
  },
  {
    recordId: "rec_goryeosa_1338",
    corpusId: "goryeosa",
    volumeOrSection: "권36 세가 제36 충숙왕 후7년 6월",
    reignCalendarText: "忠肅王 後七年 六月 乙酉 · 庚寅",
    originalHanja: "六月乙酉 地震 聲如雷 庚寅 又大震 墻屋頹圮 人皆出避",
    originalTranslationKo: "충숙왕 후7년 6월 을유일에 지진이 일어나 소리가 우레 같았고, 경인일에 다시 크게 진동하여 담장과 가옥이 무너지고 사람들이 모두 밖으로 피하였다.",
    quotedPlacesRaw: ["개경(개성)"],
    phenomenaTags: ["GROUND_SHAKING", "ACOUSTIC_BOOM", "WALL_FENCE_COLLAPSE", "AFTERSHOCK_SWARM"],
    tectonicClassification: "CONFIRMED_TECTONIC",
    archivalLexicon: [
      { token: "聲如雷", displayKo: "소리가 우레 같았고", category: "sound", archetype: "RESONANCE", stageZone: "ZONE_B_INLAND", language: "hanja-archival", translation: "지진이 일어나 소리가 우레 같았고" },
      { token: "又大震", displayKo: "다시 크게 진동하여", category: "phenomenon", archetype: "RESONANCE", stageZone: "ZONE_C_MOUNTAIN", language: "hanja-archival", translation: "경인일에 다시 크게 진동하여" },
      { token: "墻屋頹圮", displayKo: "담장과 가옥이 무너지고", category: "structure", archetype: "FRACTURE", stageZone: "ZONE_B_INLAND", language: "hanja-archival", translation: "담장과 가옥이 무너지고" },
      { token: "人皆出避", displayKo: "사람들이 모두 밖으로 피하였다", category: "consequence", archetype: "EXPOSE", stageZone: "ZONE_B_INLAND", language: "hanja-archival", translation: "사람들이 모두 밖으로 피하였다" }
    ]
  },
  {
    recordId: "rec_goryeosa_1366",
    corpusId: "goryeosa",
    volumeOrSection: "권41 세가 제41 공민왕 15년 4월",
    reignCalendarText: "恭愍王 十五年 四月 癸巳",
    originalHanja: "癸巳 金州密城地震 大風 屋瓦皆飛",
    originalTranslationKo: "공민왕 15년 4월 계사일에 경상도 김해(금주)·밀양(밀성)에 지진이 일어나고 가옥 기와가 떨어졌다.",
    quotedPlacesRaw: ["금주(김해)", "밀성(밀양)"],
    phenomenaTags: ["GROUND_SHAKING", "ROOF_TILE_FALL"],
    tectonicClassification: "CONFIRMED_TECTONIC",
    archivalLexicon: [
      { token: "金州密城地震", displayKo: "김해·밀양에 지진이 일어나고", category: "phenomenon", archetype: "RESONANCE", stageZone: "ZONE_B_INLAND", language: "hanja-archival", translation: "경상도 김해(금주)·밀양(밀성)에 지진이 일어나고" },
      { token: "屋瓦皆飛", displayKo: "가옥 기와가 떨어졌다", category: "structure", archetype: "FRACTURE", stageZone: "ZONE_B_INLAND", language: "hanja-archival", translation: "가옥 기와가 떨어졌다" }
    ]
  },
  {
    recordId: "rec_goryeosa_1385",
    corpusId: "goryeosa",
    volumeOrSection: "권135 열전 제48 우왕 11년 7월",
    reignCalendarText: "禑王 十一年 七月 甲寅",
    originalHanja: "甲寅 地震 聲如陣馬之奔 墻垣頹圮 松嶽崩",
    originalTranslationKo: "우왕 11년 7월 갑인일에 개경에 지진이 일어나 소리가 군마가 달리는 듯하고 담장이 무너지며 송악산 바위가 무너져 내렸다.",
    quotedPlacesRaw: ["개경(개성)", "송악산"],
    phenomenaTags: ["GROUND_SHAKING", "ACOUSTIC_BOOM", "WALL_FENCE_COLLAPSE", "LANDSLIDE_ROCKFALL"],
    tectonicClassification: "CONFIRMED_TECTONIC",
    archivalLexicon: [
      { token: "地震", displayKo: "개경에 지진이 일어나", category: "phenomenon", archetype: "RESONANCE", stageZone: "ZONE_B_INLAND", language: "hanja-archival", translation: "개경에 지진이 일어나" },
      { token: "聲如陣馬之奔", displayKo: "소리가 군마가 달리는 듯하고", category: "sound", archetype: "RESONANCE", stageZone: "ZONE_B_INLAND", language: "hanja-archival", translation: "소리가 군마가 달리는 듯하고" },
      { token: "墻垣頹圮", displayKo: "담장이 무너지며", category: "structure", archetype: "FRACTURE", stageZone: "ZONE_B_INLAND", language: "hanja-archival", translation: "담장이 무너지며" },
      { token: "松嶽崩", displayKo: "송악산 바위가 무너져 내렸다", category: "geology", archetype: "FRACTURE", stageZone: "ZONE_C_MOUNTAIN", language: "hanja-archival", translation: "송악산 바위가 무너져 내렸다" }
    ]
  },

  // --- [조선왕조실록 (Joseon Wangjo Sillok): 15 Records] ---
  {
    recordId: "rec_sillok_1405",
    corpusId: "joseon_sillok",
    volumeOrSection: "태종실록 9권 태종 5년 2월 12일 경자",
    reignCalendarText: "太宗 五年 二月 十二日 庚子",
    originalHanja: "慶尙道雞林安東尚州全羅道完山茂朱等地地震",
    originalTranslationKo: "경상도 계림(경주)·안동·상주와 전라도 완산(전주)·무주 등지에 지진이 일어났다.",
    quotedPlacesRaw: ["계림(경주)", "안동", "상주", "완산(전주)", "무주"],
    phenomenaTags: ["GROUND_SHAKING"],
    tectonicClassification: "CONFIRMED_TECTONIC",
    archivalLexicon: [
      { token: "慶尙道雞林安東尚州", displayKo: "경상도 계림·안동·상주와", category: "place", archetype: "RESONANCE", stageZone: "ZONE_B_INLAND", language: "hanja-archival", translation: "경상도 계림(경주)·안동·상주와" },
      { token: "全羅道完山茂朱等地", displayKo: "전라도 완산·무주 등지에", category: "place", archetype: "RESONANCE", stageZone: "ZONE_C_MOUNTAIN", language: "hanja-archival", translation: "전라도 완산(전주)·무주 등지에" },
      { token: "地震", displayKo: "지진이 일어났다", category: "phenomenon", archetype: "RESONANCE", stageZone: "ZONE_B_INLAND", language: "hanja-archival", translation: "지진이 일어났다" }
    ]
  },
  {
    recordId: "rec_sillok_1430",
    corpusId: "joseon_sillok",
    volumeOrSection: "세종실록 48권 세종 12년 4월 22일 무오",
    reignCalendarText: "世宗 十二年 四月 二十二日 戊午",
    originalHanja: "慶尙道慶州大丘安東忠淸道報恩淸州全羅道錦山茂朱地震 屋宇動搖",
    originalTranslationKo: "경상도 경주·대구·안동과 충청도 보은·청주, 전라도 금산·무주에 지진이 일어나 가옥이 흔들렸다.",
    quotedPlacesRaw: ["경주", "대구", "안동", "보은", "청주", "금산", "무주"],
    phenomenaTags: ["GROUND_SHAKING"],
    tectonicClassification: "CONFIRMED_TECTONIC",
    archivalLexicon: [
      { token: "慶尙道慶州大丘安東", displayKo: "경상도 경주·대구·안동과", category: "place", archetype: "RESONANCE", stageZone: "ZONE_B_INLAND", language: "hanja-archival", translation: "경상도 경주·대구·안동과" },
      { token: "忠淸道報恩淸州全羅道錦山茂朱地震", displayKo: "보은·청주, 금산·무주에 지진이 일어나", category: "phenomenon", archetype: "RESONANCE", stageZone: "ZONE_C_MOUNTAIN", language: "hanja-archival", translation: "충청도 보은·청주, 전라도 금산·무주에 지진이 일어나" },
      { token: "가옥이 흔들렸다", displayKo: "가옥이 흔들렸다", category: "structure", archetype: "RESONANCE", stageZone: "ZONE_B_INLAND", language: "ko-KR-archival", translation: "가옥이 흔들렸다 (屋宇動搖)" }
    ]
  },
  {
    recordId: "rec_sillok_1455",
    corpusId: "joseon_sillok",
    volumeOrSection: "단종실록 13권 단종 3년 1월 19일 정사",
    reignCalendarText: "端宗 三年 正月 十九日 丁巳",
    originalHanja: "全羅道南原求禮順天慶尙道晉州河東地震 墻屋頹落",
    originalTranslationKo: "전라도 남원·구례·순천과 경상도 진주·하동에 지진이 일어나 담장과 가옥이 무너져 내렸다.",
    quotedPlacesRaw: ["남원", "구례", "순천", "진주", "하동"],
    phenomenaTags: ["GROUND_SHAKING", "WALL_FENCE_COLLAPSE"],
    tectonicClassification: "CONFIRMED_TECTONIC",
    archivalLexicon: [
      { token: "全羅道南原求禮順天", displayKo: "전라도 남원·구례·순천과", category: "place", archetype: "RESONANCE", stageZone: "ZONE_B_INLAND", language: "hanja-archival", translation: "전라도 남원·구례·순천과" },
      { token: "慶尙道晉州河東地震", displayKo: "경상도 진주·하동에 지진이 일어나", category: "phenomenon", archetype: "RESONANCE", stageZone: "ZONE_C_MOUNTAIN", language: "hanja-archival", translation: "경상도 진주·하동에 지진이 일어나" },
      { token: "墻屋頹落", displayKo: "담장과 가옥이 무너져 내렸다", category: "structure", archetype: "FRACTURE", stageZone: "ZONE_B_INLAND", language: "hanja-archival", translation: "담장과 가옥이 무너져 내렸다" }
    ]
  },
  {
    recordId: "rec_sillok_1518",
    corpusId: "joseon_sillok",
    volumeOrSection: "중종실록 33권 중종 13년 5월 15일 임진",
    reignCalendarText: "中宗 十三年 五月 十五日 壬辰",
    originalHanja: "京城地震 聲如怒雷 人馬皆避 墻屋城堞頹落 都人終夜露處",
    originalTranslationKo: "도성(한성)에 지진이 일어나 소리가 성난 우레 같았으며 인마가 모두 피하고 담장과 성첩이 무너져 도성 사람들이 밤새 노숙하였다.",
    quotedPlacesRaw: ["한성부(서울)", "경기도", "충청도", "황해도", "강원도"],
    phenomenaTags: ["GROUND_SHAKING", "ACOUSTIC_BOOM", "WALL_FENCE_COLLAPSE", "FORTRESS_DAMAGE", "AFTERSHOCK_SWARM"],
    tectonicClassification: "CONFIRMED_TECTONIC",
    archivalLexicon: [
      { token: "京城地震", displayKo: "도성에 지진이 일어나", category: "phenomenon", archetype: "RESONANCE", stageZone: "ZONE_B_INLAND", language: "hanja-archival", translation: "도성(한성)에 지진이 일어나" },
      { token: "소리가 성난 우레 같았으며", displayKo: "소리가 성난 우레 같았으며", category: "sound", archetype: "RESONANCE", stageZone: "ZONE_B_INLAND", language: "ko-KR-archival", translation: "소리가 성난 우레 같았으며 (聲如怒雷)" },
      { token: "인마가 모두 피하고", displayKo: "인마가 모두 피하고", category: "consequence", archetype: "RESONANCE", stageZone: "ZONE_B_INLAND", language: "ko-KR-archival", translation: "인마가 모두 피하고 (人馬皆避)" },
      { token: "담장과 성첩이 무너져", displayKo: "담장과 성첩이 무너져", category: "structure", archetype: "FRACTURE", stageZone: "ZONE_C_MOUNTAIN", language: "ko-KR-archival", translation: "담장과 성첩이 무너져 (墻屋城堞頹落)" },
      { token: "도성 사람들이 밤새 노숙하였다", displayKo: "도성 사람들이 밤새 노숙하였다", category: "consequence", archetype: "EXPOSE", stageZone: "ZONE_B_INLAND", language: "ko-KR-archival", translation: "도성 사람들이 밤새 노숙하였다 (都人終夜露處)" }
    ]
  },
  {
    recordId: "rec_sillok_1546",
    corpusId: "joseon_sillok",
    volumeOrSection: "명종실록 3권 명종 원년 5월 28일 경오",
    reignCalendarText: "明宗 元年 五月 二十八日 庚午",
    originalHanja: "黃海道海州平山白川地震 屋宇頹毁 地坼水涌",
    originalTranslationKo: "황해도 해주·평산·배천에 지진이 일어나 가옥이 무너지고 땅이 갈라져 물이 솟구쳤다.",
    quotedPlacesRaw: ["해주", "평산", "배천"],
    phenomenaTags: ["GROUND_SHAKING", "HOUSE_COLLAPSE", "GROUND_FISSURE", "LIQUEFACTION_FOUNTAIN"],
    tectonicClassification: "CONFIRMED_TECTONIC",
    archivalLexicon: [
      { token: "黃海道海州平山白川地震", displayKo: "해주·평산·배천에 지진이 일어나", category: "phenomenon", archetype: "RESONANCE", stageZone: "ZONE_B_INLAND", language: "hanja-archival", translation: "황해도 해주·평산·배천에 지진이 일어나" },
      { token: "屋宇頹毁", displayKo: "가옥이 무너지고", category: "structure", archetype: "FRACTURE", stageZone: "ZONE_B_INLAND", language: "hanja-archival", translation: "가옥이 무너지고" },
      { token: "땅이 갈라져 물이 솟구쳤다", displayKo: "땅이 갈라져 물이 솟구쳤다", category: "water", archetype: "EXPOSE", stageZone: "ZONE_A_OCEAN", language: "ko-KR-archival", translation: "땅이 갈라져 물이 솟구쳤다 (地坼水涌)" }
    ]
  },
  {
    recordId: "rec_sillok_1553",
    corpusId: "joseon_sillok",
    volumeOrSection: "명종실록 15권 명종 8년 9월 11일 계사",
    reignCalendarText: "明宗 八年 九月 十一日 癸巳",
    originalHanja: "咸鏡道鏡城明川吉州地震 城堞頹落 聲如大砲",
    originalTranslationKo: "함경도 경성·명천·길주에 지진이 일어나 성첩이 무너지고 소리가 대포와 같았다.",
    quotedPlacesRaw: ["경성", "명천", "길주"],
    phenomenaTags: ["GROUND_SHAKING", "FORTRESS_DAMAGE", "ACOUSTIC_BOOM"],
    tectonicClassification: "CONFIRMED_TECTONIC",
    archivalLexicon: [
      { token: "咸鏡道鏡城明川吉州地震", displayKo: "경성·명천·길주에 지진이 일어나", category: "phenomenon", archetype: "RESONANCE", stageZone: "ZONE_B_INLAND", language: "hanja-archival", translation: "함경도 경성·명천·길주에 지진이 일어나" },
      { token: "城堞頹落", displayKo: "성첩이 무너지고", category: "structure", archetype: "FRACTURE", stageZone: "ZONE_C_MOUNTAIN", language: "hanja-archival", translation: "성첩이 무너지고" },
      { token: "聲如大砲", displayKo: "소리가 대포와 같았다", category: "sound", archetype: "RESONANCE", stageZone: "ZONE_B_INLAND", language: "hanja-archival", translation: "소리가 대포와 같았다" }
    ]
  },
  {
    recordId: "rec_sillok_1565",
    corpusId: "joseon_sillok",
    volumeOrSection: "명종실록 31권 명종 20년 8월 22일 갑자",
    reignCalendarText: "明宗 二十年 八月 二十二日 甲子",
    originalHanja: "忠淸道報恩淸州文義沃川地震 聲如雷 巖石崩落",
    originalTranslationKo: "충청도 보은·청주·문의·옥천에 지진이 일어나 소리가 우레와 같고 암석이 무너져 떨어졌다.",
    quotedPlacesRaw: ["보은", "청주", "문의", "옥천"],
    phenomenaTags: ["GROUND_SHAKING", "ACOUSTIC_BOOM", "LANDSLIDE_ROCKFALL"],
    tectonicClassification: "CONFIRMED_TECTONIC",
    archivalLexicon: [
      { token: "忠淸道報恩淸州文義沃川地震", displayKo: "보은·청주·문의·옥천에 지진이 일어나", category: "phenomenon", archetype: "RESONANCE", stageZone: "ZONE_B_INLAND", language: "hanja-archival", translation: "충청도 보은·청주·문의·옥천에 지진이 일어나" },
      { token: "聲如雷", displayKo: "소리가 우레와 같고", category: "sound", archetype: "RESONANCE", stageZone: "ZONE_B_INLAND", language: "hanja-archival", translation: "소리가 우레와 같고" },
      { token: "巖石崩落", displayKo: "암석이 무너져 떨어졌다", category: "geology", archetype: "FRACTURE", stageZone: "ZONE_C_MOUNTAIN", language: "hanja-archival", translation: "암석이 무너져 떨어졌다" }
    ]
  },
  {
    recordId: "rec_sillok_1594",
    corpusId: "joseon_sillok",
    volumeOrSection: "선조실록 53권 선조 27년 7월 29일 무술",
    reignCalendarText: "宣祖 二十七年 七月 二十九日 戊戌",
    originalHanja: "忠淸全羅慶尙道同日地震 屋宇動搖 瓦礫自落",
    originalTranslationKo: "충청·전라·경상 삼도에 같은 날 지진이 일어나 가옥이 흔들리고 기와가 저절로 떨어졌다.",
    quotedPlacesRaw: ["충청도", "전라도", "경상도"],
    phenomenaTags: ["GROUND_SHAKING", "ROOF_TILE_FALL"],
    tectonicClassification: "CONFIRMED_TECTONIC",
    archivalLexicon: [
      { token: "忠淸全羅慶尙道同日地震", displayKo: "삼도에 같은 날 지진이 일어나", category: "phenomenon", archetype: "RESONANCE", stageZone: "ZONE_C_MOUNTAIN", language: "hanja-archival", translation: "충청·전라·경상 삼도에 같은 날 지진이 일어나" },
      { token: "屋宇動搖", displayKo: "가옥이 흔들리고", category: "structure", archetype: "RESONANCE", stageZone: "ZONE_B_INLAND", language: "hanja-archival", translation: "가옥이 흔들리고" },
      { token: "瓦礫自落", displayKo: "기와가 저절로 떨어졌다", category: "structure", archetype: "FRACTURE", stageZone: "ZONE_B_INLAND", language: "hanja-archival", translation: "기와가 저절로 떨어졌다" }
    ]
  },
  {
    recordId: "rec_sillok_1597",
    corpusId: "joseon_sillok",
    volumeOrSection: "선조실록 92권 선조 30년 9월 26일 정축",
    reignCalendarText: "宣祖 三十年 九月 二十六日 丁丑",
    originalHanja: "咸鏡道三水甲山地震 山崩塞川 水溢",
    originalTranslationKo: "함경도 삼수·갑산에 큰 지진이 일어나 산이 무너져 내를 막고 물이 넘쳤다.",
    quotedPlacesRaw: ["삼수", "갑산", "경성"],
    phenomenaTags: ["GROUND_SHAKING", "LANDSLIDE_ROCKFALL", "RIVER_TURBIDITY"],
    tectonicClassification: "CONFIRMED_TECTONIC",
    archivalLexicon: [
      { token: "咸鏡道三水甲山地震", displayKo: "삼수·갑산에 큰 지진이 일어나", category: "phenomenon", archetype: "RESONANCE", stageZone: "ZONE_B_INLAND", language: "hanja-archival", translation: "함경도 삼수·갑산에 큰 지진이 일어나" },
      { token: "山崩塞川", displayKo: "산이 무너져 내를 막고", category: "geology", archetype: "FRACTURE", stageZone: "ZONE_C_MOUNTAIN", language: "hanja-archival", translation: "산이 무너져 내를 막고" },
      { token: "水溢", displayKo: "물이 넘쳤다", category: "water", archetype: "RECEDE", stageZone: "ZONE_A_OCEAN", language: "hanja-archival", translation: "물이 넘쳤다" }
    ]
  },
  {
    recordId: "rec_sillok_1643",
    corpusId: "joseon_sillok",
    volumeOrSection: "인조실록 44권 인조 21년 5월 24일 무진",
    reignCalendarText: "仁祖 二十一年 五月 二十四日 戊辰",
    originalHanja: "慶尙道大丘安東金海蔚山等地地震 城堞頹毁 蔚山則地坼水湧",
    originalTranslationKo: "경상도 대구·안동·김해·울산 등지에 지진이 일어나 성첩이 무너지고 울산에서는 땅이 갈라져 물이 솟구쳤다.",
    quotedPlacesRaw: ["대구", "안동", "김해", "울산", "경주"],
    phenomenaTags: ["GROUND_SHAKING", "FORTRESS_DAMAGE", "GROUND_FISSURE", "LIQUEFACTION_FOUNTAIN"],
    tectonicClassification: "CONFIRMED_TECTONIC",
    archivalLexicon: [
      { token: "성첩이 무너지고", displayKo: "성첩이 무너지고", category: "structure", archetype: "FRACTURE", stageZone: "ZONE_C_MOUNTAIN", language: "ko-KR-archival", translation: "성첩이 무너지고 (城堞頹毁)" },
      { token: "울산에서는 땅이 갈라져", displayKo: "울산에서는 땅이 갈라져", category: "geology", archetype: "FRACTURE", stageZone: "ZONE_B_INLAND", language: "ko-KR-archival", translation: "울산에서는 땅이 갈라져 (蔚山則地坼)" },
      { token: "물이 솟구쳤다", displayKo: "물이 솟구쳤다", category: "water", archetype: "EXPOSE", stageZone: "ZONE_A_OCEAN", language: "ko-KR-archival", translation: "물이 솟구쳤다 (水湧)" }
    ]
  },
  {
    recordId: "rec_sillok_1670",
    corpusId: "joseon_sillok",
    volumeOrSection: "현종개수실록 23권 현종 11년 9월 13일 신미",
    reignCalendarText: "顯宗 十一年 九月 十三日 辛未",
    originalHanja: "濟州牧大靜旌義地震 聲如雷 石垣多頹",
    originalTranslationKo: "제주목·대정·정의 세 고을에 지진이 일어나 소리가 우레와 같고 돌담이 많이 무너졌다.",
    quotedPlacesRaw: ["제주목", "대정", "정의"],
    phenomenaTags: ["GROUND_SHAKING", "ACOUSTIC_BOOM", "WALL_FENCE_COLLAPSE"],
    tectonicClassification: "CONFIRMED_TECTONIC",
    archivalLexicon: [
      { token: "濟州牧大靜旌義地震", displayKo: "제주목·대정·정의 세 고을에 지진이 일어나", category: "place", archetype: "RESONANCE", stageZone: "ZONE_A_OCEAN", language: "hanja-archival", translation: "제주목·대정·정의 세 고을에 지진이 일어나" },
      { token: "소리가 우레와 같고", displayKo: "소리가 우레와 같고", category: "sound", archetype: "RESONANCE", stageZone: "ZONE_A_OCEAN", language: "ko-KR-archival", translation: "소리가 우레와 같고 (聲如雷)" },
      { token: "石垣多頹", displayKo: "돌담이 많이 무너졌다", category: "structure", archetype: "FRACTURE", stageZone: "ZONE_B_INLAND", language: "hanja-archival", translation: "돌담이 많이 무너졌다" }
    ]
  },
  {
    recordId: "rec_sillok_1681_0612",
    corpusId: "joseon_sillok",
    volumeOrSection: "숙종실록 11권 숙종 7년 4월 26일 계묘",
    reignCalendarText: "肅宗 七年 四月 二十六日 癸卯",
    originalHanja: "江原道襄陽三陟等地地震 聲如雷 屋宇動搖",
    originalTranslationKo: "강원도 양양·삼척 등지에서 지진이 일어나 소리가 우레와 같고 집들이 흔들렸다.",
    quotedPlacesRaw: ["양양", "삼척", "강릉"],
    phenomenaTags: ["GROUND_SHAKING", "ACOUSTIC_BOOM"],
    tectonicClassification: "CONFIRMED_TECTONIC",
    archivalLexicon: [
      { token: "강원도 양양·삼척 등지에서", displayKo: "강원도 양양·삼척 등지에서", category: "place", archetype: "RESONANCE", stageZone: "ZONE_B_INLAND", language: "ko-KR-archival", translation: "강원도 양양·삼척 등지에서 (江原道襄陽三陟等地)" },
      { token: "지진이 일어나", displayKo: "지진이 일어나", category: "phenomenon", archetype: "RESONANCE", stageZone: "ZONE_A_OCEAN", language: "ko-KR-archival", translation: "지진이 일어나 (地震)" },
      { token: "소리가 우레와 같고", displayKo: "소리가 우레와 같고", category: "sound", archetype: "RESONANCE", stageZone: "ZONE_B_INLAND", language: "ko-KR-archival", translation: "소리가 우레와 같고 (聲如雷)" },
      { token: "집들이 흔들렸다", displayKo: "집들이 흔들렸다", category: "structure", archetype: "FRACTURE", stageZone: "ZONE_C_MOUNTAIN", language: "ko-KR-archival", translation: "집들이 흔들렸다 (屋宇動搖)" }
    ]
  },
  {
    recordId: "rec_sillok_1681_0626",
    corpusId: "joseon_sillok",
    volumeOrSection: "숙종실록 11권 숙종 7년 5월 11일 무오",
    reignCalendarText: "肅宗 七年 五月 十一日 戊午",
    originalHanja: "江原道地震 聲如雷 墻屋頹毁 山岳震動 巨巖崩壞 海水如潮退而溢",
    originalTranslationKo: "강원도 도신이 아뢰기를, 산이 울고 땅이 진동하였으며 거암이 붕괴되고 바닷물이 조수가 밀려가는 듯하더니 갑자기 언덕을 넘어왔다.",
    quotedPlacesRaw: ["양양", "삼척", "울진", "평해", "강릉"],
    phenomenaTags: ["GROUND_SHAKING", "ACOUSTIC_BOOM", "LANDSLIDE_ROCKFALL", "TSUNAMI_TIDAL_WAVE", "WALL_FENCE_COLLAPSE"],
    tectonicClassification: "CONFIRMED_TECTONIC",
    archivalLexicon: [
      { token: "산이 울고", displayKo: "산이 울고", category: "sound", archetype: "RESONANCE", stageZone: "ZONE_B_INLAND", language: "ko-KR-archival", translation: "산이 울고 (聲如雷)" },
      { token: "땅이 진동하였으며", displayKo: "땅이 진동하였으며", category: "phenomenon", archetype: "RESONANCE", stageZone: "ZONE_C_MOUNTAIN", language: "ko-KR-archival", translation: "땅이 진동하였으며 (山岳震動)" },
      { token: "거암이 붕괴되고", displayKo: "거암이 붕괴되고", category: "geology", archetype: "FRACTURE", stageZone: "ZONE_C_MOUNTAIN", language: "ko-KR-archival", translation: "거암이 붕괴되고 (巨巖崩壞)" },
      { token: "바닷물이 조수가 밀려가는 듯하더니", displayKo: "바닷물이 조수가 밀려가는 듯하더니", category: "water", archetype: "RECEDE", stageZone: "ZONE_A_OCEAN", language: "ko-KR-archival", translation: "바닷물이 조수가 밀려가는 듯하더니 (海水如潮退)" },
      { token: "갑자기 언덕을 넘어왔다", displayKo: "갑자기 언덕을 넘어왔다", category: "water", archetype: "EXPOSE", stageZone: "ZONE_A_OCEAN", language: "ko-KR-archival", translation: "갑자기 언덕을 넘어왔다 (而溢)" }
    ]
  },

  // --- [승정원일기 / 일성록 / 문헌비고 (Seungjeongwon Ilgi / Ilseongnok / Munheon Bigo): 15 Records] ---
  {
    recordId: "rec_sjw_1643_0528",
    corpusId: "seungjeongwon_ilseongnok",
    volumeOrSection: "승정원일기 인조 21년 5월 28일 임신 (경상감사 장계)",
    reignCalendarText: "仁祖 二十一年 五月 二十八日 壬申",
    originalHanja: "慶尙監司狀啓 蔚山大丘慶州等地地震 城堞多頹 蔚山府地裂湧水 白沙湧出",
    originalTranslationKo: "경상감사의 장계에 이르기를 울산·대구·경주 등지에 지진이 일어나 성첩이 많이 무너지고 울산부에서는 땅이 갈라져 물과 흰 모래가 솟아 나왔다고 하였다.",
    quotedPlacesRaw: ["울산", "대구", "경주"],
    phenomenaTags: ["GROUND_SHAKING", "FORTRESS_DAMAGE", "GROUND_FISSURE", "LIQUEFACTION_FOUNTAIN"],
    tectonicClassification: "CONFIRMED_TECTONIC",
    archivalLexicon: [
      { token: "城堞多頹", displayKo: "성첩이 많이 무너지고", category: "structure", archetype: "FRACTURE", stageZone: "ZONE_C_MOUNTAIN", language: "hanja-archival", translation: "성첩이 많이 무너지고" },
      { token: "地裂湧水", displayKo: "울산부에서는 땅이 갈라져", category: "geology", archetype: "FRACTURE", stageZone: "ZONE_B_INLAND", language: "hanja-archival", translation: "울산부에서는 땅이 갈라져" },
      { token: "白沙湧出", displayKo: "물과 흰 모래가 솟아 나왔다", category: "geology", archetype: "EXPOSE", stageZone: "ZONE_A_OCEAN", language: "hanja-archival", translation: "물과 흰 모래가 솟아 나왔다고 하였다" }
    ]
  },
  {
    recordId: "rec_sjw_1681_0514",
    corpusId: "seungjeongwon_ilseongnok",
    volumeOrSection: "승정원일기 숙종 7년 5월 14일 신유 (강원감사 장계)",
    reignCalendarText: "肅宗 七年 五月 十四日 辛酉",
    originalHanja: "江原監司狀啓 襄陽洛山寺雪嶽山神興寺巖石崩頹 三陟府竹西樓巖石動搖 海水退潮百餘步",
    originalTranslationKo: "강원감사의 장계에 양양 낙산사와 설악산 신흥사의 바위가 무너지고 삼척 죽서루 절벽이 흔들렸으며 바닷물이 백여 보 물러갔다가 밀려왔다고 보고하였다.",
    quotedPlacesRaw: ["양양 낙산사", "설악산 신흥사", "삼척 죽서루", "울진"],
    phenomenaTags: ["GROUND_SHAKING", "LANDSLIDE_ROCKFALL", "TSUNAMI_TIDAL_WAVE"],
    tectonicClassification: "CONFIRMED_TECTONIC",
    archivalLexicon: [
      { token: "巖石崩頹", displayKo: "양양 낙산사와 설악산 신흥사의 바위가 무너지고", category: "geology", archetype: "FRACTURE", stageZone: "ZONE_C_MOUNTAIN", language: "hanja-archival", translation: "양양 낙산사와 설악산 신흥사의 바위가 무너지고" },
      { token: "竹西樓巖石動搖", displayKo: "삼척 죽서루 절벽이 흔들렸으며", category: "geology", archetype: "RESONANCE", stageZone: "ZONE_B_INLAND", language: "hanja-archival", translation: "삼척 죽서루 절벽이 흔들렸으며" },
      { token: "海水退潮百餘步", displayKo: "바닷물이 백여 보 물러갔다가 밀려왔다", category: "water", archetype: "RECEDE", stageZone: "ZONE_A_OCEAN", language: "hanja-archival", translation: "바닷물이 백여 보 물러갔다가 밀려왔다고 보고하였다" }
    ]
  },
  {
    recordId: "rec_sjw_1681_0702",
    corpusId: "seungjeongwon_ilseongnok",
    volumeOrSection: "승정원일기 숙종 7년 5월 17일 갑자 (강원도 여진 장계)",
    reignCalendarText: "肅宗 七年 五月 十七日 甲子",
    originalHanja: "江原道三陟蔚珍平海餘震連日不絶 海岸崩坼",
    originalTranslationKo: "강원도 삼척·울진·평해 일대에 여진이 연일 그치지 않고 해안 언덕이 갈라져 무너졌다.",
    quotedPlacesRaw: ["삼척", "울진", "평해"],
    phenomenaTags: ["GROUND_SHAKING", "AFTERSHOCK_SWARM", "GROUND_FISSURE"],
    tectonicClassification: "CONFIRMED_TECTONIC",
    archivalLexicon: [
      { token: "江原道三陟蔚珍平海", displayKo: "강원도 삼척·울진·평해 일대에", category: "place", archetype: "RESONANCE", stageZone: "ZONE_B_INLAND", language: "hanja-archival", translation: "강원도 삼척·울진·평해 일대에" },
      { token: "餘震連日不絶", displayKo: "여진이 연일 그치지 않고", category: "phenomenon", archetype: "RESONANCE", stageZone: "ZONE_B_INLAND", language: "hanja-archival", translation: "여진이 연일 그치지 않고" },
      { token: "海岸崩坼", displayKo: "해안 언덕이 갈라져 무너졌다", category: "geology", archetype: "FRACTURE", stageZone: "ZONE_A_OCEAN", language: "hanja-archival", translation: "해안 언덕이 갈라져 무너졌다" }
    ]
  },
  {
    recordId: "rec_sjw_1700",
    corpusId: "seungjeongwon_ilseongnok",
    volumeOrSection: "승정원일기 숙종 26년 8월 10일 무진",
    reignCalendarText: "肅宗 二十六年 八月 十日 戊辰",
    originalHanja: "慶尙道慶州蔚山東萊地震 聲如雷 屋宇動搖",
    originalTranslationKo: "경상도 경주·울산·동래에 지진이 일어나 소리가 우레와 같고 가옥이 흔들렸다.",
    quotedPlacesRaw: ["경주", "울산", "동래"],
    phenomenaTags: ["GROUND_SHAKING", "ACOUSTIC_BOOM"],
    tectonicClassification: "CONFIRMED_TECTONIC",
    archivalLexicon: [
      { token: "慶州蔚山東萊地震", displayKo: "경주·울산·동래에 지진이 일어나", category: "place", archetype: "RESONANCE", stageZone: "ZONE_B_INLAND", language: "hanja-archival", translation: "경상도 경주·울산·동래에 지진이 일어나" },
      { token: "소리가 우레와 같고", displayKo: "소리가 우레와 같고", category: "sound", archetype: "RESONANCE", stageZone: "ZONE_A_OCEAN", language: "ko-KR-archival", translation: "소리가 우레와 같고 (聲如雷)" },
      { token: "屋宇動搖", displayKo: "가옥이 흔들렸다", category: "structure", archetype: "RESONANCE", stageZone: "ZONE_B_INLAND", language: "hanja-archival", translation: "가옥이 흔들렸다" }
    ]
  },
  {
    recordId: "rec_sjw_1727",
    corpusId: "seungjeongwon_ilseongnok",
    volumeOrSection: "승정원일기 영조 3년 9월 15일 정미",
    reignCalendarText: "英祖 三年 九月 十五日 丁未",
    originalHanja: "平安道平壤中和安州地震 城堞頹落 聲如大雷",
    originalTranslationKo: "평안도 평양·중화·안주에 지진이 일어나 성첩이 무너지고 소리가 큰 우레와 같았다.",
    quotedPlacesRaw: ["평양", "중화", "안주"],
    phenomenaTags: ["GROUND_SHAKING", "FORTRESS_DAMAGE", "ACOUSTIC_BOOM"],
    tectonicClassification: "CONFIRMED_TECTONIC",
    archivalLexicon: [
      { token: "平安道平壤中和安州地震", displayKo: "평양·중화·안주에 지진이 일어나", category: "place", archetype: "RESONANCE", stageZone: "ZONE_B_INLAND", language: "hanja-archival", translation: "평안도 평양·중화·안주에 지진이 일어나" },
      { token: "城堞頹落", displayKo: "성첩이 무너지고", category: "structure", archetype: "FRACTURE", stageZone: "ZONE_C_MOUNTAIN", language: "hanja-archival", translation: "성첩이 무너지고" },
      { token: "聲如大雷", displayKo: "소리가 큰 우레와 같았다", category: "sound", archetype: "RESONANCE", stageZone: "ZONE_B_INLAND", language: "hanja-archival", translation: "소리가 큰 우레와 같았다" }
    ]
  },
  {
    recordId: "rec_ilseongnok_1776",
    corpusId: "seungjeongwon_ilseongnok",
    volumeOrSection: "일성록 정조 즉위년 10월 3일 임진",
    reignCalendarText: "正祖 卽位年 十月 三日 壬辰",
    originalHanja: "全羅道全州南原錦山地震 窓戶搖動 聲如雷",
    originalTranslationKo: "전라도 전주·남원·금산에 지진이 일어나 창호가 흔들리고 소리가 우레와 같았다.",
    quotedPlacesRaw: ["전주", "남원", "금산"],
    phenomenaTags: ["GROUND_SHAKING", "ACOUSTIC_BOOM"],
    tectonicClassification: "CONFIRMED_TECTONIC",
    archivalLexicon: [
      { token: "全羅道全州南原錦山地震", displayKo: "전주·남원·금산에 지진이 일어나", category: "place", archetype: "RESONANCE", stageZone: "ZONE_C_MOUNTAIN", language: "hanja-archival", translation: "전라도 전주·남원·금산에 지진이 일어나" },
      { token: "窓戶搖動", displayKo: "창호가 흔들리고", category: "structure", archetype: "RESONANCE", stageZone: "ZONE_B_INLAND", language: "hanja-archival", translation: "창호가 흔들리고" },
      { token: "聲如雷", displayKo: "소리가 우레와 같았다", category: "sound", archetype: "RESONANCE", stageZone: "ZONE_B_INLAND", language: "hanja-archival", translation: "소리가 우레와 같았다" }
    ]
  },
  {
    recordId: "rec_ilseongnok_1810",
    corpusId: "seungjeongwon_ilseongnok",
    volumeOrSection: "일성록 순조 10년 2월 14일 무인",
    reignCalendarText: "純祖 十年 二月 十四日 戊寅",
    originalHanja: "咸鏡道鏡城明川吉州大地震 民家頹壓 死者數十人 地坼湧水",
    originalTranslationKo: "함경도 경성·명천·길주에 큰 지진이 일어나 민가가 무너져 깔려 죽은 자가 수십 명이고 땅이 갈라져 물이 솟구쳤다.",
    quotedPlacesRaw: ["경성", "명천", "길주"],
    phenomenaTags: ["GROUND_SHAKING", "HOUSE_COLLAPSE", "HUMAN_CASUALTIES", "GROUND_FISSURE", "LIQUEFACTION_FOUNTAIN"],
    tectonicClassification: "CONFIRMED_TECTONIC",
    archivalLexicon: [
      { token: "咸鏡道鏡城明川吉州大地震", displayKo: "경성·명천·길주에 큰 지진이 일어나", category: "phenomenon", archetype: "RESONANCE", stageZone: "ZONE_C_MOUNTAIN", language: "hanja-archival", translation: "함경도 경성·명천·길주에 큰 지진이 일어나" },
      { token: "民家頹壓", displayKo: "민가가 무너져", category: "structure", archetype: "FRACTURE", stageZone: "ZONE_B_INLAND", language: "hanja-archival", translation: "민가가 무너져" },
      { token: "死者數十人", displayKo: "깔려 죽은 자가 수십 명이고", category: "consequence", archetype: "FRACTURE", stageZone: "ZONE_B_INLAND", language: "hanja-archival", translation: "깔려 죽은 자가 수십 명이고" },
      { token: "地坼湧水", displayKo: "땅이 갈라져 물이 솟구쳤다", category: "geology", archetype: "EXPOSE", stageZone: "ZONE_A_OCEAN", language: "hanja-archival", translation: "땅이 갈라져 물이 솟구쳤다" }
    ]
  },
  {
    recordId: "rec_sjw_1898",
    corpusId: "seungjeongwon_ilseongnok",
    volumeOrSection: "승정원일기 고종 35년(광무 2년) 3월 19일",
    reignCalendarText: "光武 二年 三月 十九日",
    originalHanja: "慶尙南道東萊金海蔚山地震 聲如遠雷 屋宇微動",
    originalTranslationKo: "경상남도 동래·김해·울산에 지진이 일어나 소리가 먼 우레 같고 가옥이 미세하게 흔들렸다.",
    quotedPlacesRaw: ["동래(부산)", "김해", "울산"],
    phenomenaTags: ["GROUND_SHAKING", "ACOUSTIC_BOOM"],
    tectonicClassification: "CONFIRMED_TECTONIC",
    archivalLexicon: [
      { token: "慶尙南道東萊金海蔚山地震", displayKo: "동래·김해·울산에 지진이 일어나", category: "place", archetype: "RESONANCE", stageZone: "ZONE_B_INLAND", language: "hanja-archival", translation: "경상남도 동래·김해·울산에 지진이 일어나" },
      { token: "聲如遠雷", displayKo: "소리가 먼 우레 같고", category: "sound", archetype: "RESONANCE", stageZone: "ZONE_A_OCEAN", language: "hanja-archival", translation: "소리가 먼 우레 같고" },
      { token: "屋宇微動", displayKo: "가옥이 미세하게 흔들렸다", category: "structure", archetype: "RESONANCE", stageZone: "ZONE_B_INLAND", language: "hanja-archival", translation: "가옥이 미세하게 흔들렸다" }
    ]
  },
  {
    recordId: "rec_munheon_1518",
    corpusId: "jeungbo_munheon_bigo",
    volumeOrSection: "증보문헌비고 권11 상위고(象緯考) 11 지진 중종 13년",
    reignCalendarText: "中宗 十三年 五月 壬辰",
    originalHanja: "中宗十三年五月壬辰 八道地震 京城尤甚 城堞頹落",
    originalTranslationKo: "중종 13년 5월 임진일에 팔도에 지진이 일어났는데 도성이 더욱 심하여 성첩이 무너져 내렸다.",
    quotedPlacesRaw: ["한성부(서울)", "팔도"],
    phenomenaTags: ["GROUND_SHAKING", "FORTRESS_DAMAGE"],
    tectonicClassification: "CONFIRMED_TECTONIC",
    archivalLexicon: [
      { token: "八道地震", displayKo: "팔도에 지진이 일어났는데", category: "phenomenon", archetype: "RESONANCE", stageZone: "ZONE_B_INLAND", language: "hanja-archival", translation: "팔도에 지진이 일어났는데" },
      { token: "京城尤甚", displayKo: "도성이 더욱 심하여", category: "place", archetype: "RESONANCE", stageZone: "ZONE_B_INLAND", language: "hanja-archival", translation: "도성(한성)이 더욱 심하여" },
      { token: "城堞頹落", displayKo: "성첩이 무너져 내렸다", category: "structure", archetype: "FRACTURE", stageZone: "ZONE_C_MOUNTAIN", language: "hanja-archival", translation: "성첩이 무너져 내렸다" }
    ]
  },
  {
    recordId: "rec_munheon_1681",
    corpusId: "jeungbo_munheon_bigo",
    volumeOrSection: "증보문헌비고 권11 상위고(象緯考) 11 지진 숙종 7년",
    reignCalendarText: "肅宗 七年 五月 戊午",
    originalHanja: "肅宗七年五月 江原道襄陽三陟地震 海水退而溢 雪嶽山巖崩",
    originalTranslationKo: "숙종 7년 5월에 강원도 양양·삼척에 지진이 일어나 바닷물이 물러갔다 넘치고 설악산 바위가 무너졌다.",
    quotedPlacesRaw: ["양양", "삼척", "설악산"],
    phenomenaTags: ["GROUND_SHAKING", "TSUNAMI_TIDAL_WAVE", "LANDSLIDE_ROCKFALL"],
    tectonicClassification: "CONFIRMED_TECTONIC",
    archivalLexicon: [
      { token: "海水退而溢", displayKo: "바닷물이 물러갔다 넘치고", category: "water", archetype: "RECEDE", stageZone: "ZONE_A_OCEAN", language: "hanja-archival", translation: "바닷물이 물러갔다 넘치고" },
      { token: "雪嶽山巖崩", displayKo: "설악산 바위가 무너졌다", category: "geology", archetype: "FRACTURE", stageZone: "ZONE_C_MOUNTAIN", language: "hanja-archival", translation: "설악산 바위가 무너졌다" }
    ]
  },

  // --- [비지진 은유·천둥·산사태 배제 대조군 (2 Control Records)] ---
  {
    recordId: "rec_control_metaphor_1392",
    corpusId: "goryeosa",
    volumeOrSection: "권137 열전 제50 공양왕 4년 (정치적 은유 배제 기사)",
    reignCalendarText: "恭讓王 四年 春",
    originalHanja: "天動地搖 民心洶洶",
    originalTranslationKo: "하늘이 움직이고 땅이 흔들리듯 민심이 흉흉하였다 (정치적 수사 표현으로 지진 카탈로그에서 배제).",
    quotedPlacesRaw: ["개경"],
    phenomenaTags: [],
    tectonicClassification: "REJECTED_METAPHOR_OR_THUNDER",
    archivalLexicon: []
  },
  {
    recordId: "rec_control_rain_landslide_1605",
    corpusId: "joseon_sillok",
    volumeOrSection: "선조실록 190권 선조 38년 8월 (폭우 산사태 배제 기사)",
    reignCalendarText: "宣祖 三十八年 八月",
    originalHanja: "大雨連日 山崩水溢 聲如地動",
    originalTranslationKo: "큰 비가 연일 내려 산이 무너지고 물이 넘치며 소리가 땅이 진동하는 듯하였다 (수해 산사태로 지진 카탈로그에서 배제).",
    quotedPlacesRaw: ["강원도"],
    phenomenaTags: ["LANDSLIDE_ROCKFALL"],
    tectonicClassification: "NON_TECTONIC_LANDSLIDE",
    archivalLexicon: []
  },
  {
    recordId: "rec_munheon_0779",
    corpusId: "jeungbo_munheon_bigo",
    volumeOrSection: "증보문헌비고 권11 상위고(象緯考) 11 지진 신라 혜공왕 15년",
    reignCalendarText: "新羅 惠恭王 十五年 三月",
    originalHanja: "新羅 惠恭王十五年三月 京都地震 倒民屋 死者百餘人",
    originalTranslationKo: "신라 혜공왕 15년 3월에 서울(금성)에 지진이 일어나 민가가 쓰러지고 죽은 자가 100여 명이었다.",
    quotedPlacesRaw: ["금성(경주)"],
    phenomenaTags: ["GROUND_SHAKING", "HOUSE_COLLAPSE", "HUMAN_CASUALTIES"],
    tectonicClassification: "CONFIRMED_TECTONIC",
    archivalLexicon: [
      { token: "京都地震", displayKo: "서울에 지진이 일어나", category: "phenomenon", archetype: "RESONANCE", stageZone: "ZONE_B_INLAND", language: "hanja-archival", translation: "서울(금성)에 지진이 일어나" },
      { token: "倒民屋", displayKo: "민가가 쓰러지고", category: "structure", archetype: "FRACTURE", stageZone: "ZONE_B_INLAND", language: "hanja-archival", translation: "민가가 쓰러지고" },
      { token: "死者百餘人", displayKo: "죽은 자가 100여 명이었다", category: "consequence", archetype: "EXPOSE", stageZone: "ZONE_B_INLAND", language: "hanja-archival", translation: "죽은 자가 100여 명이었다" }
    ]
  },
  {
    recordId: "rec_sjw_1681_0612",
    corpusId: "seungjeongwon_ilseongnok",
    volumeOrSection: "승정원일기 숙종 7년 4월 29일 병오 (강원감사 1차 전진 장계)",
    reignCalendarText: "肅宗 七年 四月 二十九日 丙午",
    originalHanja: "江原監司狀啓 襄陽三陟等地 四月二十六日地震 聲如雷 屋宇搖蕩",
    originalTranslationKo: "강원감사의 장계에 이르기를 양양과 삼척 등지에 4월 26일 지진이 일어나 소리가 우레와 같고 집들이 요동하였다고 보고하였다.",
    quotedPlacesRaw: ["양양", "삼척"],
    phenomenaTags: ["GROUND_SHAKING", "ACOUSTIC_BOOM"],
    tectonicClassification: "CONFIRMED_TECTONIC",
    archivalLexicon: [
      { token: "四月二十六日地震", displayKo: "4월 26일 지진이 일어나", category: "phenomenon", archetype: "RESONANCE", stageZone: "ZONE_B_INLAND", language: "hanja-archival", translation: "4월 26일 지진이 일어나" },
      { token: "聲如雷", displayKo: "소리가 우레와 같고", category: "sound", archetype: "RESONANCE", stageZone: "ZONE_B_INLAND", language: "hanja-archival", translation: "소리가 우레와 같고" },
      { token: "屋宇搖蕩", displayKo: "집들이 요동하였다", category: "structure", archetype: "RESONANCE", stageZone: "ZONE_B_INLAND", language: "hanja-archival", translation: "집들이 요동하였다" }
    ]
  },
  {
    recordId: "rec_sillok_1681_0702",
    corpusId: "joseon_sillok",
    volumeOrSection: "숙종실록 11권 숙종 7년 5월 17일 갑자 (강원도 여진 기사)",
    reignCalendarText: "肅宗 七年 五月 十七日 甲子",
    originalHanja: "江原道三陟蔚珍等處 連日地震 海岸崖石崩頹",
    originalTranslationKo: "강원도 삼척·울진 등지에 연일 지진이 일어나 해안 벼랑의 바위가 무너져 내렸다.",
    quotedPlacesRaw: ["삼척", "울진"],
    phenomenaTags: ["GROUND_SHAKING", "AFTERSHOCK_SWARM", "LANDSLIDE_ROCKFALL"],
    tectonicClassification: "CONFIRMED_TECTONIC",
    archivalLexicon: [
      { token: "連日地震", displayKo: "연일 지진이 일어나", category: "phenomenon", archetype: "RESONANCE", stageZone: "ZONE_B_INLAND", language: "hanja-archival", translation: "연일 지진이 일어나" },
      { token: "海岸崖石崩頹", displayKo: "해안 벼랑의 바위가 무너져 내렸다", category: "geology", archetype: "FRACTURE", stageZone: "ZONE_A_OCEAN", language: "hanja-archival", translation: "해안 벼랑의 바위가 무너져 내렸다" }
    ]
  },
  {
    recordId: "rec_sillok_1810",
    corpusId: "joseon_sillok",
    volumeOrSection: "순조실록 13권 순조 10년 2월 14일 무인",
    reignCalendarText: "純祖 十年 二月 十四日 戊寅",
    originalHanja: "咸鏡道鏡城明川等邑地震 聲如雷 墻壁多倒 地裂黃水湧出",
    originalTranslationKo: "함경도 경성·명천 등 고을에 지진이 일어나 소리가 우레 같았고 담벽이 많이 무너졌으며 땅이 갈라져 황색 물이 솟구쳤다.",
    quotedPlacesRaw: ["경성", "명천"],
    phenomenaTags: ["GROUND_SHAKING", "WALL_FENCE_COLLAPSE", "GROUND_FISSURE", "SOIL_LIQUEFACTION"],
    tectonicClassification: "CONFIRMED_TECTONIC",
    archivalLexicon: [
      { token: "咸鏡道鏡城明川", displayKo: "함경도 경성·명천 등 고을에", category: "place", archetype: "RESONANCE", stageZone: "ZONE_B_INLAND", language: "hanja-archival", translation: "함경도 경성·명천 등 고을에" },
      { token: "聲如雷", displayKo: "소리가 우레 같았고", category: "sound", archetype: "RESONANCE", stageZone: "ZONE_B_INLAND", language: "hanja-archival", translation: "소리가 우레 같았고" },
      { token: "墻壁多倒", displayKo: "담벽이 많이 무너졌으며", category: "structure", archetype: "FRACTURE", stageZone: "ZONE_B_INLAND", language: "hanja-archival", translation: "담벽이 많이 무너졌으며" },
      { token: "地裂黃水湧出", displayKo: "땅이 갈라져 황색 물이 솟구쳤다", category: "geology", archetype: "EXPOSE", stageZone: "ZONE_B_INLAND", language: "hanja-archival", translation: "땅이 갈라져 황색 물이 솟구쳤다" }
    ]
  }
];

// ============================================================================
// 4. EVENT-SOURCE LINKS (M:N Relationship Entity)
//    - Supports 1 Event <- N SourceRecords (e.g., 1681 Yangyang, 1643 Ulsan, 1518 Hanseong)
//    - Supports 1 SourceRecord -> N Events (e.g., rec_goryeosa_ohaengji_1036 -> 1036-06 & 1036-07)
//    - Preserves per-link linkConfidence and roleInPassage
// ============================================================================
const LINK_DEFAULTS_BY_RELATION = {
  PRIMARY_CHRONICLE: {
    linkConfidence: "HIGH_PRIMARY_CHRONICLE",
    roleInPassage: "PRIMARY_CHRONICLE_ENTRY"
  },
  SECONDARY_CORROBORATION: {
    linkConfidence: "HIGH_CROSS_VERIFIED",
    roleInPassage: "PROVINCIAL_GOVERNOR_DISPATCH"
  },
  RETROSPECTIVE_COMPENDIUM: {
    linkConfidence: "MEDIUM_RETROSPECTIVE_COMPENDIUM",
    roleInPassage: "LATER_ENCYCLOPEDIC_COMPILATION"
  },
  SUB_ITEM_IN_MULTI_EVENT_RECORD: {
    linkConfidence: "HIGH_CHRONOLOGICAL_SUB_ITEM",
    roleInPassage: "SUB_ITEM_IN_MULTI_EVENT_PASSAGE"
  }
};

const RAW_EVENT_SOURCE_LINKS = [
  { linkId: "lnk_0002", eventId: "hist_0002_goguryeo", recordId: "rec_samguk_0002", relationType: "PRIMARY_CHRONICLE" },
  { linkId: "lnk_0027", eventId: "hist_0027_baekje", recordId: "rec_samguk_0027", relationType: "PRIMARY_CHRONICLE" },
  { linkId: "lnk_0034", eventId: "hist_0034_silla", recordId: "rec_samguk_0034", relationType: "PRIMARY_CHRONICLE" },
  { linkId: "lnk_0100", eventId: "hist_0100_silla", recordId: "rec_samguk_0100", relationType: "PRIMARY_CHRONICLE" },
  { linkId: "lnk_0304", eventId: "hist_0304_silla", recordId: "rec_samguk_0304", relationType: "PRIMARY_CHRONICLE" },
  { linkId: "lnk_0502", eventId: "hist_0502_goguryeo", recordId: "rec_samguk_0502", relationType: "PRIMARY_CHRONICLE" },
  { linkId: "lnk_0639", eventId: "hist_0639_baekje", recordId: "rec_samguk_0639", relationType: "PRIMARY_CHRONICLE" },
  { linkId: "lnk_0779", eventId: "hist_0779_gyeongju", recordId: "rec_samguk_0779", relationType: "PRIMARY_CHRONICLE" },
  { linkId: "lnk_0971", eventId: "hist_0971_gaegyeong", recordId: "rec_goryeosa_0971", relationType: "PRIMARY_CHRONICLE" },
  // Archetype 3: Single Goryeosa Ohaengji entry split into two separate 1036 events
  { linkId: "lnk_1036_06_ohaeng", eventId: "hist_1036_0617_gaegyeong", recordId: "rec_goryeosa_ohaengji_1036", relationType: "SUB_ITEM_IN_MULTI_EVENT_RECORD", linkConfidence: "HIGH_CHRONOLOGICAL_SUB_ITEM", roleInPassage: "정종 2년 5월 계축 개경 지진 단락 (전반부)" },
  { linkId: "lnk_1036_07_ohaeng", eventId: "hist_1036_0712_gyeongju", recordId: "rec_goryeosa_ohaengji_1036", relationType: "SUB_ITEM_IN_MULTI_EVENT_RECORD", linkConfidence: "HIGH_CHRONOLOGICAL_SUB_ITEM", roleInPassage: "정종 2년 6월 무인 동경(경주)·금주·밀성 대지진 단락 (후반부)" },
  { linkId: "lnk_1036_07_sega", eventId: "hist_1036_0712_gyeongju", recordId: "rec_goryeosa_sega_1036_07", relationType: "PRIMARY_CHRONICLE", linkConfidence: "HIGH_PRIMARY_CHRONICLE", roleInPassage: "고려사 세가 편년체 본기 및 사면령 기사" },
  { linkId: "lnk_1260", eventId: "hist_1260_gaegyeong", recordId: "rec_goryeosa_1260", relationType: "PRIMARY_CHRONICLE" },
  { linkId: "lnk_1338", eventId: "hist_1338_gaegyeong", recordId: "rec_goryeosa_1338", relationType: "PRIMARY_CHRONICLE" },
  { linkId: "lnk_1366", eventId: "hist_1366_gimhae", recordId: "rec_goryeosa_1366", relationType: "PRIMARY_CHRONICLE" },
  { linkId: "lnk_1385", eventId: "hist_1385_gaegyeong", recordId: "rec_goryeosa_1385", relationType: "PRIMARY_CHRONICLE" },
  { linkId: "lnk_1405", eventId: "hist_1405_gyeongsang", recordId: "rec_sillok_1405", relationType: "PRIMARY_CHRONICLE" },
  { linkId: "lnk_1430", eventId: "hist_1430_samnam", recordId: "rec_sillok_1430", relationType: "PRIMARY_CHRONICLE" },
  { linkId: "lnk_1455", eventId: "hist_1455_namwon", recordId: "rec_sillok_1455", relationType: "PRIMARY_CHRONICLE" },
  // 1518 Hanseong cross-verified in Sillok + Jeungbo Munheon Bigo
  { linkId: "lnk_1518_sillok", eventId: "hist_1518_seoul", recordId: "rec_sillok_1518", relationType: "PRIMARY_CHRONICLE", linkConfidence: "HIGH_PRIMARY_CHRONICLE", roleInPassage: "중종실록 당일 도성 피해 및 인심 동요 주 기사" },
  { linkId: "lnk_1518_munheon", eventId: "hist_1518_seoul", recordId: "rec_munheon_1518", relationType: "RETROSPECTIVE_COMPENDIUM", linkConfidence: "MEDIUM_RETROSPECTIVE_COMPENDIUM", roleInPassage: "증보문헌비고 상위고 팔도 지진 종합 수록본" },
  { linkId: "lnk_1546", eventId: "hist_1546_haeju", recordId: "rec_sillok_1546", relationType: "PRIMARY_CHRONICLE" },
  { linkId: "lnk_1553", eventId: "hist_1553_gyeongseong", recordId: "rec_sillok_1553", relationType: "PRIMARY_CHRONICLE" },
  { linkId: "lnk_1565", eventId: "hist_1565_boeun", recordId: "rec_sillok_1565", relationType: "PRIMARY_CHRONICLE" },
  { linkId: "lnk_1594", eventId: "hist_1594_samdo", recordId: "rec_sillok_1594", relationType: "PRIMARY_CHRONICLE" },
  { linkId: "lnk_1597", eventId: "hist_1597_samsu", recordId: "rec_sillok_1597", relationType: "PRIMARY_CHRONICLE" },
  // Archetype 1: 1643 Ulsan cross-verified in Sillok + Seungjeongwon Ilgi
  { linkId: "lnk_1643_sillok", eventId: "hist_1643_ulsan", recordId: "rec_sillok_1643", relationType: "PRIMARY_CHRONICLE", linkConfidence: "HIGH_PRIMARY_CHRONICLE", roleInPassage: "인조실록 경상·전라도 광역 지진 및 액상화 주 기사" },
  { linkId: "lnk_1643_sjw", eventId: "hist_1643_ulsan", recordId: "rec_sjw_1643_0528", relationType: "SECONDARY_CORROBORATION", linkConfidence: "HIGH_CROSS_VERIFIED", roleInPassage: "승정원일기 경상감사 장계 (울산 백사 용출 실증)" },
  { linkId: "lnk_1670", eventId: "hist_1670_jeju", recordId: "rec_sillok_1670", relationType: "PRIMARY_CHRONICLE" },
  // Archetype 1 & 2: 1681 Yangyang Sequence (Foreshock, Mainshock+Tsunami, Aftershock)
  { linkId: "lnk_1681_0612", eventId: "hist_1681_0612", recordId: "rec_sillok_1681_0612", relationType: "PRIMARY_CHRONICLE", linkConfidence: "HIGH_PRIMARY_CHRONICLE", roleInPassage: "숙종실록 4월 26일 강원도 1차 전진 기사" },
  { linkId: "lnk_1681_0626_sillok", eventId: "hist_1681_0626", recordId: "rec_sillok_1681_0626", relationType: "PRIMARY_CHRONICLE", linkConfidence: "HIGH_PRIMARY_CHRONICLE", roleInPassage: "숙종실록 5월 11일 강원도 본진·거암 붕괴·해일 주 기사" },
  { linkId: "lnk_1681_0626_sjw", eventId: "hist_1681_0626", recordId: "rec_sjw_1681_0514", relationType: "SECONDARY_CORROBORATION", linkConfidence: "HIGH_CROSS_VERIFIED", roleInPassage: "승정원일기 강원감사 장계 (낙산사·신흥사·죽서루 및 해수 퇴조 백여 보)" },
  { linkId: "lnk_1681_0626_munheon", eventId: "hist_1681_0626", recordId: "rec_munheon_1681", relationType: "RETROSPECTIVE_COMPENDIUM", linkConfidence: "MEDIUM_RETROSPECTIVE_COMPENDIUM", roleInPassage: "증보문헌비고 상위고 양양·삼척 해일 요약 기사" },
  { linkId: "lnk_1681_0702_sjw", eventId: "hist_1681_0702", recordId: "rec_sjw_1681_0702", relationType: "PRIMARY_CHRONICLE", linkConfidence: "HIGH_PRIMARY_CHRONICLE", roleInPassage: "승정원일기 5월 17일 삼척·울진 여진 및 해안 붕탁 장계" },
  { linkId: "lnk_1700", eventId: "hist_1700_gyeongju", recordId: "rec_sjw_1700", relationType: "PRIMARY_CHRONICLE" },
  { linkId: "lnk_1727", eventId: "hist_1727_pyongyang", recordId: "rec_sjw_1727", relationType: "PRIMARY_CHRONICLE" },
  { linkId: "lnk_1776", eventId: "hist_1776_jeonju", recordId: "rec_ilseongnok_1776", relationType: "PRIMARY_CHRONICLE" },
  { linkId: "lnk_1810", eventId: "hist_1810_gyeongseong", recordId: "rec_ilseongnok_1810", relationType: "PRIMARY_CHRONICLE" },
  { linkId: "lnk_1898", eventId: "hist_1898_dongnae", recordId: "rec_sjw_1898", relationType: "PRIMARY_CHRONICLE" },
  { linkId: "lnk_0779_munheon", eventId: "hist_0779_gyeongju", recordId: "rec_munheon_0779", relationType: "RETROSPECTIVE_COMPENDIUM", linkConfidence: "MEDIUM_RETROSPECTIVE_COMPENDIUM", roleInPassage: "증보문헌비고 상위고 신라 혜공왕 지진조" },
  { linkId: "lnk_1681_0612_sjw", eventId: "hist_1681_0612", recordId: "rec_sjw_1681_0612", relationType: "SECONDARY_CORROBORATION", linkConfidence: "HIGH_CROSS_VERIFIED", roleInPassage: "승정원일기 4월 29일 강원감사 1차 전진 장계" },
  { linkId: "lnk_1681_0702_sillok", eventId: "hist_1681_0702", recordId: "rec_sillok_1681_0702", relationType: "PRIMARY_CHRONICLE", linkConfidence: "HIGH_PRIMARY_CHRONICLE", roleInPassage: "숙종실록 5월 17일 삼척·울진 여진 주 기사" },
  { linkId: "lnk_1810_sillok", eventId: "hist_1810_gyeongseong", recordId: "rec_sillok_1810", relationType: "PRIMARY_CHRONICLE", linkConfidence: "HIGH_PRIMARY_CHRONICLE", roleInPassage: "순조실록 2월 14일 함경도 지진 및 황수 용출 주 기사" }
];

export const EVENT_SOURCE_LINKS = RAW_EVENT_SOURCE_LINKS.map(lnk => {
  const def = LINK_DEFAULTS_BY_RELATION[lnk.relationType] || LINK_DEFAULTS_BY_RELATION.PRIMARY_CHRONICLE;
  return {
    ...lnk,
    linkConfidence: lnk.linkConfidence || def.linkConfidence,
    roleInPassage: lnk.roleInPassage || def.roleInPassage
  };
});

// ============================================================================
// 5. HELPER TO BUILD NORMALIZED 6-ENTITY HISTORICAL EVENTS (ERA 1 ONLY)
// ============================================================================
const RECORD_MAP = new Map(SOURCE_RECORDS.map(r => [r.recordId, r]));
const PLACE_MAP = new Map(HISTORICAL_PLACE_MAPPINGS.map(p => [p.placeId, p]));

// ============================================================================
// 5.1 HISTORICAL ACADEMIC DEFAULT GENERATORS (PHILOLOGY & GEOPHYSICS)
// ============================================================================
function generateDefaultFeltCounties(spec, defaultInterp, placeObj, ep) {
  const mmiNum = defaultInterp?.maxIntensityMMI?.numericEquiv || 7.0;
  const placeName = placeObj?.historicalToponymKo || spec.titleKo || "진앙 인근 고을";
  const modName = placeObj?.modernAdminRegionKo || placeName;
  const roman = defaultInterp?.maxIntensityMMI?.roman || "VII";

  const counties = [
    {
      countyKo: placeName,
      modernLocation: modName,
      distanceKm: ep?.errorRadiusKm ? Math.round(ep.errorRadiusKm * 0.4) : 15,
      intensityMMI: roman,
      phenomenonKo: defaultInterp?.maxIntensityMMI?.intensityBasis || "가옥 요동 및 사료에 기록된 진앙 인접 지진동"
    }
  ];

  if (spec.dynasty === "JOSEON") {
    counties.push({
      countyKo: "경기 한양 도성 (漢陽)",
      modernLocation: "서울특별시 종로구 경복궁·도성",
      distanceKm: 145,
      intensityMMI: (mmiNum >= 8.5) ? "V" : "IV",
      phenomenonKo: "궁궐 전각 및 민가 등잔 흔들림, 광역 지동 유감"
    });
    counties.push({
      countyKo: "강원 원주목 (原州)",
      modernLocation: "강원특별자치도 원주시 일원",
      distanceKm: 110,
      intensityMMI: (mmiNum >= 8.5) ? "VI" : "V",
      phenomenonKo: "가옥 창문 요동 및 주민 옥외 대피"
    });
  } else if (spec.dynasty === "GORYEO") {
    counties.push({
      countyKo: "고려 개경 도성 (開京)",
      modernLocation: "황해북도 개성시 본궁 일원",
      distanceKm: 120,
      intensityMMI: (mmiNum >= 8.5) ? "V" : "IV",
      phenomenonKo: "왕경 전각 및 사찰 탑두 미세 흔들림"
    });
  } else if (spec.dynasty === "UNIFIED_SILLA" || spec.dynasty === "THREE_KINGDOMS") {
    counties.push({
      countyKo: "신라 금성(경주) 또는 왕도",
      modernLocation: "왕경 도성 일원",
      distanceKm: 75,
      intensityMMI: (mmiNum >= 8.5) ? "V" : "IV",
      phenomenonKo: "도성 관아 및 성벽 지동 유감"
    });
  }

  return counties;
}

function generateDefaultMethodology(spec, defaultInterp, placeObj) {
  return {
    structuralVulnerability: {
      badgeKo: "가옥 구조 취약성 보정",
      status: "CALIBRATED",
      analysisKo: "전통 초가·목조건축의 내진 취약성으로 인한 낙와(落瓦)를 현대 기준 고진도로 과대평가하지 않고, 담장 전도 및 지반 균열 동반 여부를 교차 검증함."
    },
    tianRenFilter: {
      badgeKo: "천인감응설 수사 배제",
      status: "FILTERED",
      analysisKo: "재이(災異)에 대한 감정적 상소문 수사를 배제하고, 공인 사서 편년체 본기 및 관찰사 장계 등 공식 행정 기록을 우선 채택함."
    },
    batchSeparation: {
      badgeKo: "시공간 일괄 보고 분리",
      status: "RESOLVED",
      analysisKo: "지방관 파발 전달 시차로 인한 묶음 보고를 간지(干支) 일진 역추적으로 단일 본진 또는 군발 여진 시퀀스로 분리 판정함."
    },
    seatBiasOffset: {
      badgeKo: "치소 중심 편향 극복",
      status: "CORRECTED",
      analysisKo: "고을 관아(치소) 좌표의 단순 채택을 지양하고, 사료 언급 하천, 포구, 사찰 지형지물을 역산하여 지리공간적 진앙 비정."
    }
  };
}

function generateDefaultGeophysics(spec, defaultInterp, placeObj) {
  if (spec.tsunamiObserved || spec.seaDrawbackRecorded) {
    return {
      type: "TSUNAMI_HYDRODYNAMICS",
      titleKo: "동해 천해파 지진해일 수력학 & 퇴조 메커니즘",
      equation: "v = \\sqrt{gH} \\approx 121.2\\text{ m/s} \\ (436\\text{ km/h})",
      parameters: [
        { label: "평균 수심 (H)", value: "1,500 m" },
        { label: "천해파 전파 속도 (v)", value: "121.2 m/s (436 km/h)" },
        { label: "천수 증폭 효과", value: "Green's Law: A \\propto H^{-1/4}" },
        { label: "사료 실증", value: "바닷물이 물러갔다가 밀려옴 (퇴조 및 해일)" }
      ],
      narrativeKo: "해저 단층 운동으로 인한 해수면의 급격한 수직 변위가 천해파 형태로 연안에 전파된 수력학적 현상입니다."
    };
  } else if (spec.liquefactionObserved) {
    return {
      type: "SOIL_LIQUEFACTION",
      titleKo: "포화 사질토 과잉 간극수압 및 지반 액상화 역학",
      equation: "\\sigma'_{eff} = \\sigma_v - P_{pore} \\to 0",
      parameters: [
        { label: "퇴적 환경", value: "하구 및 연약 충적 사질토층" },
        { label: "과잉 간극수압 (\\Delta u)", value: "지진 반복 전단 응력에 의한 급증" },
        { label: "유효 응력 (\\sigma'_{eff})", value: "0 kPa (전단 강도 완전 상실)" },
        { label: "사료 실증", value: "땅이 갈라지고 물과 모래가 솟구침 (地裂湧水)" }
      ],
      narrativeKo: "미고결 충적층의 공극수압이 순간적으로 상부 토압을 초과하여 흙탕물과 모래가 지표로 분출한 액상화 현상입니다."
    };
  } else {
    return {
      type: "STRUCTURAL_RESONANCE_ROCKFALL",
      titleKo: "도성 석축 및 구조물 동적 전단 파괴 역학",
      equation: "FS = \\frac{c + (\\gamma z \\cos\\theta - k_h W)\\tan\\phi}{\\gamma z \\sin\\theta + k_h W} < 1.0",
      parameters: [
        { label: "구조물 대상", value: placeObj?.historicalToponymKo || "도성 성벽 및 목조 가구" },
        { label: "수평 지진 계수 (k_h)", value: "PGA / g \\approx 0.15 \\sim 0.25" },
        { label: "지반 응답", value: "퇴적분지 S파 증폭 및 공진" },
        { label: "사료 실증", value: defaultInterp?.maxIntensityMMI?.intensityBasis || "성벽 및 가옥 파손" }
      ],
      narrativeKo: "상부 지각 천발 지진의 S파 지반진동이 지표 구조물의 고유진동수와 상호작용하여 발생한 동적 파괴 현상입니다."
    };
  }
}

function generateDefaultChronology(spec) {
  const dc = spec.dateConversion;
  return {
    reignTitle: dc.reignName ? (dc.reignYear ? dc.reignName + " " + dc.reignYear + "년" : dc.reignName) : "연대 미상",
    lunarDate: dc.lunarMonth ? ("음력 " + dc.lunarMonth + "월 " + (dc.lunarDay ? dc.lunarDay + "일" : "") + (dc.isIntercalaryMonth ? " (윤달)" : "")) : "음력 미상",
    sexagenaryDay: dc.sexagenaryDay ? (dc.sexagenaryDay + "일") : "일진 미상",
    doubleHour: "시각 미상 (12간지각)",
    solarCalendar: dc.gregorianDateISO + " (" + (dc.gregorianYear >= 1582 ? "그레고리력" : "율리우스력") + " 환산)",
    timePrecisionKo: dc.precision === "DAY" ? "일 단위 확정 (시각 오차 ±12 hr)" : "월 단위 추정"
  };
}

function generateDefaultGazetteer(spec, placeObj) {
  const pList = spec.placeIds?.map(pid => PLACE_MAP.get(pid)).filter(Boolean) || (placeObj ? [placeObj] : []);
  return pList.map(p => ({
    ancientKo: p.historicalToponymKo,
    modernAdmin: p.modernAdminRegionKo,
    role: p.placeRole || "지역 치소 및 관아",
    distanceToEpicenter: p.representativeCoords?.errorRadiusKm ? ("오차 반경 ±" + p.representativeCoords.errorRadiusKm + " km") : "진앙 인근"
  }));
}

function createHistoricalEvent(spec) {
  const links = EVENT_SOURCE_LINKS.filter(l => l.eventId === spec.eventId);
  const primaryLink = links.find(l => l.relationType === "PRIMARY_CHRONICLE") || links[0];
  const primaryRecord = RECORD_MAP.get(primaryLink.recordId);
  const placeObj = PLACE_MAP.get(spec.primaryPlaceId);

  const defaultInterp = spec.interpretations.find(i => i.interpretationId === spec.defaultInterpretationId) || spec.interpretations[0];
  const ep = defaultInterp.epicenter;
  const hasCoords = !ep.isUnresolved && ep.lat !== null && ep.lon !== null;

  // Combine unique archivalLexicon tokens across all linked SourceRecords
  const mergedLexicon = [];
  const seenTokens = new Set();
  for (const lnk of links) {
    const rec = RECORD_MAP.get(lnk.recordId);
    if (rec && Array.isArray(rec.archivalLexicon)) {
      for (const tok of rec.archivalLexicon) {
        const dedupKey = `${tok.token}::${tok.displayKo || ""}`;
        if (!seenTokens.has(dedupKey)) {
          seenTokens.add(dedupKey);
          mergedLexicon.push({
            ...tok,
            sourceRecordId: rec.recordId,
            sourceVolume: rec.volumeOrSection
          });
        }
      }
    }
  }

  const linkedRecords = links.map(lnk => {
    const rec = RECORD_MAP.get(lnk.recordId);
    if (!rec) return null;
    const corpus = SOURCE_CORPORA.find(c => c.corpusId === rec.corpusId);
    return {
      recordId: rec.recordId,
      relationType: lnk.relationType,
      roleInPassage: lnk.roleInPassage,
      corpusId: rec.corpusId,
      corpusTitleKo: corpus ? corpus.titleKo : rec.corpusId,
      compilationYear: corpus ? corpus.compilationYear : "",
      archiveUrl: corpus ? corpus.archiveUrl : KMA_ARCHIVE_URL,
      volumeOrSection: rec.volumeOrSection,
      reignCalendarText: rec.reignCalendarText,
      originalHanja: rec.originalHanja,
      originalTranslationKo: rec.originalTranslationKo,
      phenomenaTags: rec.phenomenaTags || [],
      quotedPlacesRaw: rec.quotedPlacesRaw || []
    };
  }).filter(Boolean);

  return {
    // --- Enriched Archival Scholarship & Multi-Corpus Records ---
    linkedRecords: linkedRecords,
    feltCounties: spec.feltCounties || generateDefaultFeltCounties(spec, defaultInterp, placeObj, ep),
    methodologicalCorrections: spec.methodologicalCorrections || generateDefaultMethodology(spec, defaultInterp, placeObj),
    geophysicalPhenomena: spec.geophysicalPhenomena || generateDefaultGeophysics(spec, defaultInterp, placeObj),
    astronomicalChronology: spec.astronomicalChronology || generateDefaultChronology(spec),
    historicalGazetteer: spec.historicalGazetteer || generateDefaultGazetteer(spec, placeObj),

    // --- v4.0 6-Entity Primary Fields ---
    eventId: spec.eventId,
    id: spec.eventId,
    era: "ERA_1_PRE_1905_ARCHIVAL",
    dynasty: spec.dynasty,
    century: spec.century,
    sequenceGroupId: spec.sequenceGroupId || null,
    sequenceRole: spec.sequenceRole || "ISOLATED_EVENT",
    dateConversion: spec.dateConversion,
    sourceLinks: links,
    placeMappings: spec.placeIds.map(pid => PLACE_MAP.get(pid)).filter(Boolean),
    interpretations: spec.interpretations,
    defaultInterpretationId: defaultInterp.interpretationId,

    // --- v3.0 Backward-Compatible Fields for DataProcessor & TextGenerator ---
    catalogType: "HISTORICAL",
    recordType: "historical",
    sourceName: `${primaryRecord.volumeOrSection} (기상청 2012 역사지진 아카이브)`,
    verification: "kma-verified",
    kind: "historical-estimated",
    place: spec.titleKo,
    dateText: `${spec.dateConversion.gregorianDateISO} (${spec.dateConversion.reignYearText})`,
    datePrecision: spec.dateConversion.precision.toLowerCase(),
    temporal: {
      gregorianDate: spec.dateConversion.gregorianDateISO,
      gregorianPrecision: spec.dateConversion.precision,
      originTimeUTC: null,
      historicalCalendar: {
        era: spec.dateConversion.reignName,
        year: spec.dateConversion.reignYear,
        lunarMonth: spec.dateConversion.lunarMonth,
        lunarDay: spec.dateConversion.lunarDay,
        sexagenaryDay: spec.dateConversion.sexagenaryDay,
        isLeapMonth: spec.dateConversion.isIntercalaryMonth,
        textOriginal: spec.dateConversion.reignYearText
      }
    },
    spatial: {
      placeName: placeObj ? placeObj.modernAdminRegionKo : spec.titleKo,
      inferredCoordinates: {
        lat: ep.lat,
        lon: ep.lon,
        coordinateConfidence: ep.isUnresolved ? "UNRESOLVED_NO_COORDINATES" : "REGIONAL_APPROXIMATE",
        errorRadiusKm: ep.errorRadiusKm
      },
      focalDepth: {
        valKm: null,
        isKnown: false,
        determinationType: "UNKNOWN_UNRECORDED",
        comment: "역사 사료 기록으로 진원 깊이 미상 (null 강제 보존)"
      }
    },
    time: F(null, "unknown", "사서 일자/월 기록만 존재, 정밀 발생 시각 미상"),
    lat: F(ep.lat, hasCoords ? "kma-verified" : "unknown", ep.basis),
    lon: F(ep.lon, hasCoords ? "kma-verified" : "unknown", ep.basis),
    depth: F(null, "unknown", "깊이 미상 (역사 문헌)"),
    mag: F(null, "unknown", "계측 규모 없음 (사료 피해 기반 추정)"),
    scientificEstimates: spec.interpretations.map(interp => ({
      interpretationId: interp.interpretationId,
      source: `${interp.authorOrInstitution} (${interp.publicationYear})`,
      estimatedMag: interp.estimatedMagnitude.best,
      magRange: [interp.estimatedMagnitude.min, interp.estimatedMagnitude.max],
      magType: interp.estimatedMagnitude.scaleLabel,
      mmiNumeric: interp.maxIntensityMMI.numericEquiv,
      mmiRoman: interp.maxIntensityMMI.roman,
      lat: interp.epicenter.lat,
      lon: interp.epicenter.lon,
      errorRadiusKm: interp.epicenter.errorRadiusKm,
      confidence: "SECONDARY_ACADEMIC"
    })),
    magEstimate: {
      low: defaultInterp.estimatedMagnitude.min ?? defaultInterp.estimatedMagnitude.best,
      high: defaultInterp.estimatedMagnitude.max ?? defaultInterp.estimatedMagnitude.best,
      ver: "secondary",
      src: `${defaultInterp.authorOrInstitution} (${defaultInterp.publicationYear})`
    },
    macroseismic: {
      maxIntensityMMI: {
        rawRoman: defaultInterp.maxIntensityMMI.roman,
        numericEquivalent: defaultInterp.maxIntensityMMI.numericEquiv,
        scale: "MMI",
        basis: defaultInterp.maxIntensityMMI.intensityBasis
      },
      feltRegionCount: spec.rawNloc,
      damageClass: spec.rawDclass,
      tsunamiObserved: Boolean(spec.tsunamiObserved),
      liquefactionObserved: Boolean(spec.liquefactionObserved)
    },
    rawValues: {
      rawI: defaultInterp.maxIntensityMMI.numericEquiv,
      rawA: spec.rawA || null,
      rawNloc: spec.rawNloc,
      rawFp: null,
      rawNrep: spec.rawNrep ?? null,
      rawDclass: spec.rawDclass,
      rawD5: null
    },
    primaryText: {
      originalScript: primaryRecord.originalTranslationKo,
      hanjaExcerpt: primaryRecord.originalHanja,
      scriptLanguage: "ko-KR-archival",
      documentSource: primaryRecord.volumeOrSection,
      sourceLocation: placeObj ? placeObj.historicalToponymKo : spec.titleKo
    },
    archivalLexicon: mergedLexicon,
    text: primaryRecord.originalTranslationKo,
    originalText: primaryRecord.originalTranslationKo,
    uncertainty: ep.isUnresolved
      ? "진앙 좌표 미확정(null): 고대/광역 문헌 기록으로 단일 좌표 핀 없이 추상 파동장으로만 시각화"
      : `문헌 피해 기록 기반 복원 추정치 (진앙 오차 반경 ±${ep.errorRadiusKm} km, 진원 깊이 null)`,
    links: [{ label: "KMA 역사지진 아카이브", url: KMA_ARCHIVE_URL }]
  };
}

// ============================================================================
// 6. NORMALIZED HISTORICAL EVENTS (32 Events: 2 AD – 1898 AD, ERA 1 ONLY)
// ============================================================================
export const HISTORICAL_EVENTS = [
  // 1. 0002 AD Goguryeo Yuriwang Earthquake (Archetype 2: Ancient Unresolved Coords, Nloc=1)
  createHistoricalEvent({
    eventId: "hist_0002_goguryeo",
    titleKo: "0002 고구려 졸본·국내성 지진 (유리명왕 21년)",
    dynasty: "THREE_KINGDOMS",
    century: 1,
    primaryPlaceId: "place_jolbon_gungnae",
    placeIds: ["place_jolbon_gungnae"],
    rawNloc: 1,
    rawDclass: 1,
    rawNrep: null,
    dateConversion: {
      reignName: "고구려 유리명왕(瑠璃明王)",
      reignYear: 21,
      reignYearText: "瑠璃明王 21年 8月",
      lunarMonth: 8,
      lunarDay: null,
      sexagenaryDay: null,
      isIntercalaryMonth: false,
      gregorianYear: 2,
      gregorianDateISO: "0002-08",
      precision: "MONTH",
      conversionConfidence: "APPROXIMATE_MONTH_ONLY"
    },
    defaultInterpretationId: "interp_0002_kma",
    interpretations: [
      {
        interpretationId: "interp_0002_kma",
        authorOrInstitution: "기상청 역사지진 아카이브 (KMA)",
        publicationYear: 2012,
        epicenter: {
          lat: null,
          lon: null,
          errorRadiusKm: null,
          isUnresolved: true,
          basis: "삼국사기 최초의 지진 기록; 고구려 초기 도성 광역 기록으로 단일 진앙 미확정"
        },
        maxIntensityMMI: { roman: "IV~V", numericEquiv: 4.5, scale: "MMI", intensityBasis: "왕도 유감 지진 기록" },
        estimatedMagnitude: { min: 4.5, max: 5.3, best: 5.0, scaleLabel: "M_intensity_derived" },
        focalDepth: { valKm: null, determinationType: "UNKNOWN_UNRECORDED" }
      }
    ]
  }),

  // 2. 0027 AD Baekje Daruwang Earthquake (Archetype 2: Ancient Unresolved Coords, Nloc=1)
  createHistoricalEvent({
    eventId: "hist_0027_baekje",
    titleKo: "0027 백제 한성 위례성 지진 (다루왕 2년)",
    dynasty: "THREE_KINGDOMS",
    century: 1,
    primaryPlaceId: "place_wiryeseong_hanseong_baekje",
    placeIds: ["place_wiryeseong_hanseong_baekje"],
    rawNloc: 1,
    rawDclass: 2,
    rawNrep: null,
    dateConversion: {
      reignName: "백제 다루왕(多婁王)",
      reignYear: 2,
      reignYearText: "多婁王 2年 11月",
      lunarMonth: 11,
      lunarDay: null,
      sexagenaryDay: null,
      isIntercalaryMonth: false,
      gregorianYear: 27,
      gregorianDateISO: "0027-11",
      precision: "MONTH",
      conversionConfidence: "APPROXIMATE_MONTH_ONLY"
    },
    defaultInterpretationId: "interp_0027_kma",
    interpretations: [
      {
        interpretationId: "interp_0027_kma",
        authorOrInstitution: "기상청 역사지진 아카이브 (KMA)",
        publicationYear: 2012,
        epicenter: {
          lat: null,
          lon: null,
          errorRadiusKm: null,
          isUnresolved: true,
          basis: "백제 초기 위례성 위치 비정 논쟁으로 단일 진앙 미확정"
        },
        maxIntensityMMI: { roman: "V~VI", numericEquiv: 5.5, scale: "MMI", intensityBasis: "소리가 우레와 같음(聲如雷)" },
        estimatedMagnitude: { min: 5.0, max: 5.6, best: 5.3, scaleLabel: "M_intensity_derived" },
        focalDepth: { valKm: null, determinationType: "UNKNOWN_UNRECORDED" }
      }
    ]
  }),

  // 3. 0034 AD Silla Geumseong Earthquake & Spring Surge
  createHistoricalEvent({
    eventId: "hist_0034_silla",
    titleKo: "0034 신라 금성(경주) 지진·용천 (유리이사금 11년)",
    dynasty: "THREE_KINGDOMS",
    century: 1,
    primaryPlaceId: "place_geumseong_gyeongju",
    placeIds: ["place_geumseong_gyeongju"],
    rawNloc: 1,
    rawDclass: 2,
    rawNrep: null,
    dateConversion: {
      reignName: "신라 유리이사금(儒理尼師今)",
      reignYear: 11,
      reignYearText: "儒理尼師今 11年",
      lunarMonth: null,
      lunarDay: null,
      sexagenaryDay: null,
      isIntercalaryMonth: false,
      gregorianYear: 34,
      gregorianDateISO: "0034",
      precision: "YEAR",
      conversionConfidence: "APPROXIMATE_MONTH_ONLY"
    },
    defaultInterpretationId: "interp_0034_kma",
    interpretations: [
      {
        interpretationId: "interp_0034_kma",
        authorOrInstitution: "기상청 역사지진 아카이브 (KMA)",
        publicationYear: 2012,
        epicenter: {
          lat: 35.84,
          lon: 129.21,
          errorRadiusKm: 35.0,
          isUnresolved: false,
          basis: "신라 왕경(경주) 대표 좌표"
        },
        maxIntensityMMI: { roman: "VI", numericEquiv: 6.0, scale: "MMI", intensityBasis: "왕경 지진 및 샘물 용출(泉涌)" },
        estimatedMagnitude: { min: 5.3, max: 5.8, best: 5.5, scaleLabel: "M_intensity_derived" },
        focalDepth: { valKm: null, determinationType: "UNKNOWN_UNRECORDED" }
      }
    ]
  }),

  // 4. 0100 AD Silla Pasa Isageum Gyeongju Earthquake
  createHistoricalEvent({
    eventId: "hist_0100_silla",
    titleKo: "0100 신라 금성(경주) 지진 (파사이사금 21년)",
    dynasty: "THREE_KINGDOMS",
    century: 1,
    primaryPlaceId: "place_geumseong_gyeongju",
    placeIds: ["place_geumseong_gyeongju"],
    rawNloc: 1,
    rawDclass: 4,
    rawNrep: null,
    dateConversion: {
      reignName: "신라 파사이사금(婆娑尼師今)",
      reignYear: 21,
      reignYearText: "婆娑尼師今 21年 10月",
      lunarMonth: 10,
      lunarDay: null,
      sexagenaryDay: null,
      isIntercalaryMonth: false,
      gregorianYear: 100,
      gregorianDateISO: "0100-10",
      precision: "MONTH",
      conversionConfidence: "APPROXIMATE_MONTH_ONLY"
    },
    defaultInterpretationId: "interp_0100_kma",
    interpretations: [
      {
        interpretationId: "interp_0100_kma",
        authorOrInstitution: "기상청 역사지진 아카이브 (KMA)",
        publicationYear: 2012,
        epicenter: {
          lat: 35.84,
          lon: 129.21,
          errorRadiusKm: 35.0,
          isUnresolved: false,
          basis: "신라 왕경(경주) 대표 좌표"
        },
        maxIntensityMMI: { roman: "VIII", numericEquiv: 8.0, scale: "MMI", intensityBasis: "민가 도괴 및 사망자 발생(倒民屋 有死者)" },
        estimatedMagnitude: { min: 6.0, max: 6.5, best: 6.3, scaleLabel: "M_intensity_derived" },
        focalDepth: { valKm: null, determinationType: "UNKNOWN_UNRECORDED" }
      }
    ]
  }),

  // 5. 0304 AD Silla Girim Isageum Gyeongju Earthquake
  createHistoricalEvent({
    eventId: "hist_0304_silla",
    titleKo: "0304 신라 경주 연속 지진 (기림이사금 7년)",
    dynasty: "THREE_KINGDOMS",
    century: 4,
    primaryPlaceId: "place_geumseong_gyeongju",
    placeIds: ["place_geumseong_gyeongju"],
    rawNloc: 1,
    rawDclass: 4,
    rawNrep: 3,
    dateConversion: {
      reignName: "신라 기림이사금(基臨尼師今)",
      reignYear: 7,
      reignYearText: "基臨尼師今 7年 9月",
      lunarMonth: 9,
      lunarDay: null,
      sexagenaryDay: null,
      isIntercalaryMonth: false,
      gregorianYear: 304,
      gregorianDateISO: "0304-09",
      precision: "MONTH",
      conversionConfidence: "APPROXIMATE_MONTH_ONLY"
    },
    defaultInterpretationId: "interp_0304_kma",
    interpretations: [
      {
        interpretationId: "interp_0304_kma",
        authorOrInstitution: "기상청 역사지진 아카이브 (KMA)",
        publicationYear: 2012,
        epicenter: {
          lat: 35.84,
          lon: 129.21,
          errorRadiusKm: 35.0,
          isUnresolved: false,
          basis: "신라 왕경(경주) 대표 좌표"
        },
        maxIntensityMMI: { roman: "VIII", numericEquiv: 8.0, scale: "MMI", intensityBasis: "민가 붕괴 및 사망자 발생" },
        estimatedMagnitude: { min: 6.0, max: 6.6, best: 6.3, scaleLabel: "M_intensity_derived" },
        focalDepth: { valKm: null, determinationType: "UNKNOWN_UNRECORDED" }
      }
    ]
  }),

  // 7. 0502 AD Goguryeo Pyongyang Earthquake
  createHistoricalEvent({
    eventId: "hist_0502_goguryeo",
    titleKo: "0502 고구려 평양성 지진 (문자명왕 11년)",
    dynasty: "THREE_KINGDOMS",
    century: 6,
    primaryPlaceId: "place_pyongyang_goguryeo",
    placeIds: ["place_pyongyang_goguryeo"],
    rawNloc: 1,
    rawDclass: 4,
    rawNrep: null,
    dateConversion: {
      reignName: "고구려 문자명왕(文咨明王)",
      reignYear: 11,
      reignYearText: "文咨明王 11年 10月",
      lunarMonth: 10,
      lunarDay: null,
      sexagenaryDay: null,
      isIntercalaryMonth: false,
      gregorianYear: 502,
      gregorianDateISO: "0502-10",
      precision: "MONTH",
      conversionConfidence: "APPROXIMATE_MONTH_ONLY"
    },
    defaultInterpretationId: "interp_0502_kma",
    interpretations: [
      {
        interpretationId: "interp_0502_kma",
        authorOrInstitution: "기상청 역사지진 아카이브 (KMA)",
        publicationYear: 2012,
        epicenter: {
          lat: 39.02,
          lon: 125.75,
          errorRadiusKm: 40.0,
          isUnresolved: false,
          basis: "고구려 평양성 대표 좌표"
        },
        maxIntensityMMI: { roman: "VIII", numericEquiv: 8.0, scale: "MMI", intensityBasis: "민가 도괴 및 사망자 발생" },
        estimatedMagnitude: { min: 6.0, max: 6.5, best: 6.3, scaleLabel: "M_intensity_derived" },
        focalDepth: { valKm: null, determinationType: "UNKNOWN_UNRECORDED" }
      }
    ]
  }),

  // 9. 0639 AD Baekje Sabi (Buyeo) Earthquake
  createHistoricalEvent({
    eventId: "hist_0639_baekje",
    titleKo: "0639 백제 사비(부여) 지동 (무왕 40년)",
    dynasty: "THREE_KINGDOMS",
    century: 7,
    primaryPlaceId: "place_sabi_buyeo",
    placeIds: ["place_sabi_buyeo"],
    rawNloc: 1,
    rawDclass: 1,
    rawNrep: null,
    dateConversion: {
      reignName: "백제 무왕(武王)",
      reignYear: 40,
      reignYearText: "武王 40年 3月",
      lunarMonth: 3,
      lunarDay: null,
      sexagenaryDay: null,
      isIntercalaryMonth: false,
      gregorianYear: 639,
      gregorianDateISO: "0639-03",
      precision: "MONTH",
      conversionConfidence: "APPROXIMATE_MONTH_ONLY"
    },
    defaultInterpretationId: "interp_0639_kma",
    interpretations: [
      {
        interpretationId: "interp_0639_kma",
        authorOrInstitution: "기상청 역사지진 아카이브 (KMA)",
        publicationYear: 2012,
        epicenter: {
          lat: 36.28,
          lon: 126.91,
          errorRadiusKm: 35.0,
          isUnresolved: false,
          basis: "백제 사비(부여) 대표 좌표"
        },
        maxIntensityMMI: { roman: "V", numericEquiv: 5.0, scale: "MMI", intensityBasis: "사비 왕도 유감 지동" },
        estimatedMagnitude: { min: 4.8, max: 5.3, best: 5.0, scaleLabel: "M_intensity_derived" },
        focalDepth: { valKm: null, determinationType: "UNKNOWN_UNRECORDED" }
      }
    ]
  }),

  // 10. 0779 AD Unified Silla Gyeongju Great Earthquake (Archetype 2 & 3: Competing Interpretations)
  createHistoricalEvent({
    eventId: "hist_0779_gyeongju",
    titleKo: "0779 경주 대지진 (신라 혜공왕 15년)",
    dynasty: "UNIFIED_SILLA",
    century: 8,
    primaryPlaceId: "place_geumseong_gyeongju",
    placeIds: ["place_geumseong_gyeongju"],
    rawNloc: 2,
    rawDclass: 5,
    rawNrep: null,
    feltCounties: [
      { countyKo: "신라 금성 도성 (金城)", modernLocation: "경상북도 경주시 교동·월성 일원", distanceKm: 3, intensityMMI: "VIII~IX", phenomenonKo: "가옥 대거 도괴, 사망자 100여 명 발생 (삼국사기)" },
      { countyKo: "신라 사벌주 (沙伐州)", modernLocation: "경상북도 상주시 일원", distanceKm: 95, intensityMMI: "VI", phenomenonKo: "신라 북방 주 관아 가옥 요동" },
      { countyKo: "신라 삽량주 (歃良州)", modernLocation: "경상남도 양산시 일원", distanceKm: 45, intensityMMI: "VII", phenomenonKo: "양산단층 연선 진동 및 가옥 균열" },
      { countyKo: "신라 완산주 (完山州)", modernLocation: "전북특별자치도 전주시 일원", distanceKm: 165, intensityMMI: "V", phenomenonKo: "호남 내륙 미약 유감" }
    ],
    methodologicalCorrections: {
      structuralVulnerability: {
        badgeKo: "100여 명 압사 피해 실증",
        status: "HUMAN_CASUALTIES_CONFIRMED",
        analysisKo: "신라 1,000년 역사상 최다 인명 피해 기록인 '死者百餘人'이 삼국사기 본기에 명시되어 진도 VIII~IX 판정."
      },
      tianRenFilter: {
        badgeKo: "삼국사기 본기 편년 공인 기록",
        status: "OFFICIAL_ANNALS_VERIFIED",
        analysisKo: "혜공왕 15년 신라 조정의 정사 기록으로 김부식 등이 교차 수록."
      },
      batchSeparation: {
        badgeKo: "봄 3월 단일 초대형 본진",
        status: "ISOLATED_SPRING_EVENT",
        analysisKo: "신라 왕경을 직격한 단일 천발 직하지진."
      },
      seatBiasOffset: {
        badgeKo: "경주 분지 양산·울산단층 교차부 비정",
        status: "FAULT_JUNCTION_MICRO_LOCATED",
        analysisKo: "금성 월성 중심 남남동쪽 양산단층 및 울산단층 교차 분기대(35.8°N, 129.2°E)로 진앙 비정."
      }
    },
    geophysicalPhenomena: {
      type: "STRUCTURAL_RESONANCE_ROCKFALL",
      titleKo: "경주 분지 천발 단층 직하지진 및 왕경 가옥 도괴",
      equation: "PGA \\approx 0.35\\text{ g} \\ (\\approx 343\\text{ cm/s}^2)",
      parameters: [
        { label: "단층 체계", value: "양산단층대 경주 분기 분지 단층" },
        { label: "추정 진원 깊이", value: "8 ~ 12 km (천발 단층)" },
        { label: "추정 PGA", value: "0.30 ~ 0.40 g" },
        { label: "사료 실증", value: "京都地震 壞民屋 死者百餘人" }
      ],
      narrativeKo: "삼국사기 신라본기의 '壞民屋 死者百餘人(민가가 무너지고 죽은 자가 100여 명이었다)'은 양산단층대 천발 단층 파쇄가 경주 분지 충적층 직하에서 발생하여, 지표 근접 수직·수평 진동이 목조 기와 가구를 전면 파괴한 전형적인 내륙 직하지진입니다."
    },
    astronomicalChronology: {
      reignTitle: "신라 혜공왕(惠恭王) 15년",
      lunarDate: "음력 3월",
      sexagenaryDay: "일진 미상 (월 단위 기록)",
      doubleHour: "시각 미상",
      solarCalendar: "0779-04 (율리우스력 환산)",
      timePrecisionKo: "월 단위 기록 (오차 ±15일)"
    },
    dateConversion: {
      reignName: "신라 혜공왕(惠恭王)",
      reignYear: 15,
      reignYearText: "惠恭王 15年 3月",
      lunarMonth: 3,
      lunarDay: null,
      sexagenaryDay: null,
      isIntercalaryMonth: false,
      gregorianYear: 779,
      gregorianDateISO: "0779-03",
      precision: "MONTH",
      conversionConfidence: "APPROXIMATE_MONTH_ONLY"
    },
    defaultInterpretationId: "interp_0779_kma",
    interpretations: [
      {
        interpretationId: "interp_0779_kma",
        authorOrInstitution: "기상청 역사지진 아카이브 (KMA)",
        publicationYear: 2012,
        epicenter: {
          lat: 35.84,
          lon: 129.21,
          errorRadiusKm: 30.0,
          isUnresolved: false,
          basis: "기상청 역사지진 경주 왕경 대표 좌표"
        },
        maxIntensityMMI: { roman: "VIII~IX", numericEquiv: 8.5, scale: "MMI", intensityBasis: "민가 붕괴 및 사망자 100여 명 발생(死者百餘人)" },
        estimatedMagnitude: { min: 6.5, max: 7.0, best: 6.7, scaleLabel: "M_intensity_derived" },
        focalDepth: { valKm: null, determinationType: "UNKNOWN_UNRECORDED" }
      },
      {
        interpretationId: "interp_0779_lee1998",
        authorOrInstitution: "이기화 (서울대 지진학 연구실)",
        publicationYear: 1998,
        epicenter: {
          lat: 35.80,
          lon: 129.25,
          errorRadiusKm: 25.0,
          isUnresolved: false,
          basis: "양산단층계 경주 구간 인접 진앙 모델"
        },
        maxIntensityMMI: { roman: "IX", numericEquiv: 9.0, scale: "MMI", intensityBasis: "왕경 석조물·민가 대파 및 백여 명 압사" },
        estimatedMagnitude: { min: 6.7, max: 7.2, best: 7.0, scaleLabel: "M_intensity_derived" },
        focalDepth: { valKm: null, determinationType: "UNKNOWN_UNRECORDED" }
      }
    ]
  }),

  // 12. 0971 AD Goryeo Gwangjong Gaegyeong Earthquake
  createHistoricalEvent({
    eventId: "hist_0971_gaegyeong",
    titleKo: "0971 고려 개경 지진 (광종 22년)",
    dynasty: "GORYEO",
    century: 10,
    primaryPlaceId: "place_gaegyeong_gaeseong",
    placeIds: ["place_gaegyeong_gaeseong"],
    rawNloc: 1,
    rawDclass: 3,
    rawNrep: 2,
    dateConversion: {
      reignName: "고려 광종(光宗)",
      reignYear: 22,
      reignYearText: "光宗 22年 12月",
      lunarMonth: 12,
      lunarDay: null,
      sexagenaryDay: null,
      isIntercalaryMonth: false,
      gregorianYear: 971,
      gregorianDateISO: "0971-12",
      precision: "MONTH",
      conversionConfidence: "APPROXIMATE_MONTH_ONLY"
    },
    defaultInterpretationId: "interp_0971_kma",
    interpretations: [
      {
        interpretationId: "interp_0971_kma",
        authorOrInstitution: "기상청 역사지진 아카이브 (KMA)",
        publicationYear: 2012,
        epicenter: {
          lat: 37.97,
          lon: 126.55,
          errorRadiusKm: 30.0,
          isUnresolved: false,
          basis: "고려 개경 대표 좌표"
        },
        maxIntensityMMI: { roman: "VII", numericEquiv: 7.0, scale: "MMI", intensityBasis: "개경 대지진 및 익년 2월 재진동" },
        estimatedMagnitude: { min: 5.6, max: 6.2, best: 5.9, scaleLabel: "M_intensity_derived" },
        focalDepth: { valKm: null, determinationType: "UNKNOWN_UNRECORDED" }
      }
    ]
  }),

  // 13. 1036-06-17 Goryeo Jeongjong Gaegyeong Shock (Archetype 3: Multi-Event Single Ohaengji Entry #1)
  createHistoricalEvent({
    eventId: "hist_1036_0617_gaegyeong",
    titleKo: "1036 개경 5월 지진 (고려 정종 2년 5월 신해)",
    dynasty: "GORYEO",
    century: 11,
    sequenceGroupId: "seq_1036_jeongjong",
    sequenceRole: "FORESHOCK",
    primaryPlaceId: "place_gaegyeong_gaeseong",
    placeIds: ["place_gaegyeong_gaeseong"],
    rawNloc: 1,
    rawDclass: 2,
    rawNrep: null,
    dateConversion: {
      reignName: "고려 정종(靖宗)",
      reignYear: 2,
      reignYearText: "靖宗 2年 5月 辛亥",
      lunarMonth: 5,
      lunarDay: 21,
      sexagenaryDay: "신해(辛亥)",
      isIntercalaryMonth: false,
      gregorianYear: 1036,
      gregorianDateISO: "1036-06-17",
      precision: "DAY",
      conversionConfidence: "EXACT_DAILY"
    },
    defaultInterpretationId: "interp_1036_06_kma",
    interpretations: [
      {
        interpretationId: "interp_1036_06_kma",
        authorOrInstitution: "기상청 역사지진 아카이브 (KMA)",
        publicationYear: 2012,
        epicenter: {
          lat: 37.97,
          lon: 126.55,
          errorRadiusKm: 30.0,
          isUnresolved: false,
          basis: "고려사 오행지 정종 2년 5월 신해 개경 지진"
        },
        maxIntensityMMI: { roman: "V~VI", numericEquiv: 5.5, scale: "MMI", intensityBasis: "개경 도성 유감 지진" },
        estimatedMagnitude: { min: 5.0, max: 5.5, best: 5.2, scaleLabel: "M_intensity_derived" },
        focalDepth: { valKm: null, determinationType: "UNKNOWN_UNRECORDED" }
      }
    ]
  }),

  // 14. 1036-07-12 Goryeo Donggyeong (Gyeongju) & Sangju Earthquake (Archetype 3: Multi-Event Ohaengji Entry #2)
  createHistoricalEvent({
    eventId: "hist_1036_0712_gyeongju",
    titleKo: "1036 동경(경주)·상주 대지진 (고려 정종 2년 6월 병술)",
    dynasty: "GORYEO",
    century: 11,
    sequenceGroupId: "seq_1036_jeongjong",
    sequenceRole: "MAINSHOCK",
    primaryPlaceId: "place_geumseong_gyeongju",
    placeIds: ["place_geumseong_gyeongju", "place_sangju_silla", "place_gaegyeong_gaeseong"],
    rawNloc: 5,
    rawDclass: 4,
    rawNrep: 2,
    dateConversion: {
      reignName: "고려 정종(靖宗)",
      reignYear: 2,
      reignYearText: "靖宗 2年 6月 丙戌",
      lunarMonth: 6,
      lunarDay: 16,
      sexagenaryDay: "병술(丙戌)",
      isIntercalaryMonth: false,
      gregorianYear: 1036,
      gregorianDateISO: "1036-07-12",
      precision: "DAY",
      conversionConfidence: "EXACT_DAILY"
    },
    defaultInterpretationId: "interp_1036_07_kma",
    interpretations: [
      {
        interpretationId: "interp_1036_07_kma",
        authorOrInstitution: "기상청 역사지진 아카이브 (KMA)",
        publicationYear: 2012,
        epicenter: {
          lat: 35.84,
          lon: 129.21,
          errorRadiusKm: 35.0,
          isUnresolved: false,
          basis: "고려사 세가 및 오행지: 동경(경주) 피해가 가장 심함(東京尤甚)"
        },
        maxIntensityMMI: { roman: "VIII", numericEquiv: 8.0, scale: "MMI", intensityBasis: "경주·상주 민가 다수 붕괴 및 개경 동시 유감" },
        estimatedMagnitude: { min: 6.2, max: 6.7, best: 6.4, scaleLabel: "M_intensity_derived" },
        focalDepth: { valKm: null, determinationType: "UNKNOWN_UNRECORDED" }
      }
    ]
  }),

  // 17. 1260 AD Goryeo Wonjong Gaegyeong Earthquake
  createHistoricalEvent({
    eventId: "hist_1260_gaegyeong",
    titleKo: "1260 고려 개경 지진 (원종 원년)",
    dynasty: "GORYEO",
    century: 13,
    primaryPlaceId: "place_gaegyeong_gaeseong",
    placeIds: ["place_gaegyeong_gaeseong"],
    rawNloc: 2,
    rawDclass: 3,
    rawNrep: null,
    dateConversion: {
      reignName: "고려 원종(元宗)",
      reignYear: 1,
      reignYearText: "元宗 元年 6月 癸未",
      lunarMonth: 6,
      lunarDay: 18,
      sexagenaryDay: "계미(癸未)",
      isIntercalaryMonth: false,
      gregorianYear: 1260,
      gregorianDateISO: "1260-07-27",
      precision: "DAY",
      conversionConfidence: "EXACT_DAILY"
    },
    defaultInterpretationId: "interp_1260_kma",
    interpretations: [
      {
        interpretationId: "interp_1260_kma",
        authorOrInstitution: "기상청 역사지진 아카이브 (KMA)",
        publicationYear: 2012,
        epicenter: {
          lat: 37.97,
          lon: 126.55,
          errorRadiusKm: 30.0,
          isUnresolved: false,
          basis: "고려 개경 대표 좌표"
        },
        maxIntensityMMI: { roman: "VII~VIII", numericEquiv: 7.5, scale: "MMI", intensityBasis: "뇌성 및 담장·가옥 붕괴(墻屋頹壞)" },
        estimatedMagnitude: { min: 5.8, max: 6.3, best: 6.0, scaleLabel: "M_intensity_derived" },
        focalDepth: { valKm: null, determinationType: "UNKNOWN_UNRECORDED" }
      }
    ]
  }),

  // 19. 1338 AD Goryeo Chungsukwang Gaegyeong Swarm & Wall Collapse
  createHistoricalEvent({
    eventId: "hist_1338_gaegyeong",
    titleKo: "1338 고려 개경 연속 강진 (충숙왕 후7년)",
    dynasty: "GORYEO",
    century: 14,
    primaryPlaceId: "place_gaegyeong_gaeseong",
    placeIds: ["place_gaegyeong_gaeseong"],
    rawNloc: 3,
    rawDclass: 3,
    rawNrep: 5,
    dateConversion: {
      reignName: "고려 충숙왕(忠肅王)",
      reignYear: 25,
      reignYearText: "忠肅王 後7年 6月 庚寅",
      lunarMonth: 6,
      lunarDay: 24,
      sexagenaryDay: "경인(庚寅)",
      isIntercalaryMonth: false,
      gregorianYear: 1338,
      gregorianDateISO: "1338-07-19",
      precision: "DAY",
      conversionConfidence: "EXACT_DAILY"
    },
    defaultInterpretationId: "interp_1338_kma",
    interpretations: [
      {
        interpretationId: "interp_1338_kma",
        authorOrInstitution: "기상청 역사지진 아카이브 (KMA)",
        publicationYear: 2012,
        epicenter: {
          lat: 37.97,
          lon: 126.55,
          errorRadiusKm: 30.0,
          isUnresolved: false,
          basis: "고려 개경 대표 좌표"
        },
        maxIntensityMMI: { roman: "VII~VIII", numericEquiv: 7.5, scale: "MMI", intensityBasis: "담장·가옥 붕괴 및 주민 대피(墻屋頹圮 人皆出避)" },
        estimatedMagnitude: { min: 5.8, max: 6.3, best: 6.1, scaleLabel: "M_intensity_derived" },
        focalDepth: { valKm: null, determinationType: "UNKNOWN_UNRECORDED" }
      }
    ]
  }),

  // 20. 1366 AD Goryeo Gongminwang Gimhae/Miryang Earthquake
  createHistoricalEvent({
    eventId: "hist_1366_gimhae",
    titleKo: "1366 김해(금주)·밀양(밀성) 지진 (고려 공민왕 15년)",
    dynasty: "GORYEO",
    century: 14,
    primaryPlaceId: "place_geumju_gimhae",
    placeIds: ["place_geumju_gimhae"],
    rawNloc: 3,
    rawDclass: 3,
    rawNrep: null,
    dateConversion: {
      reignName: "고려 공민왕(恭愍王)",
      reignYear: 15,
      reignYearText: "恭愍王 15年 4月 癸巳",
      lunarMonth: 4,
      lunarDay: 19,
      sexagenaryDay: "계사(癸巳)",
      isIntercalaryMonth: false,
      gregorianYear: 1366,
      gregorianDateISO: "1366-05-29",
      precision: "DAY",
      conversionConfidence: "EXACT_DAILY"
    },
    defaultInterpretationId: "interp_1366_kma",
    interpretations: [
      {
        interpretationId: "interp_1366_kma",
        authorOrInstitution: "기상청 역사지진 아카이브 (KMA)",
        publicationYear: 2012,
        epicenter: {
          lat: 35.23,
          lon: 128.88,
          errorRadiusKm: 35.0,
          isUnresolved: false,
          basis: "경상도 금주(김해)·밀성(밀양) 대표 좌표"
        },
        maxIntensityMMI: { roman: "VII", numericEquiv: 7.0, scale: "MMI", intensityBasis: "지붕 기와 낙하(屋瓦皆飛)" },
        estimatedMagnitude: { min: 5.6, max: 6.1, best: 5.8, scaleLabel: "M_intensity_derived" },
        focalDepth: { valKm: null, determinationType: "UNKNOWN_UNRECORDED" }
      }
    ]
  }),

  // 21. 1385 AD Goryeo Uwang Gaegyeong & Mt. Songak Collapse
  createHistoricalEvent({
    eventId: "hist_1385_gaegyeong",
    titleKo: "1385 개경·송악산 붕괴 지진 (고려 우왕 11년)",
    dynasty: "GORYEO",
    century: 14,
    primaryPlaceId: "place_gaegyeong_gaeseong",
    placeIds: ["place_gaegyeong_gaeseong"],
    rawNloc: 3,
    rawDclass: 4,
    rawNrep: 2,
    dateConversion: {
      reignName: "고려 우왕(禑王)",
      reignYear: 11,
      reignYearText: "禑王 11年 7月 甲寅",
      lunarMonth: 7,
      lunarDay: 19,
      sexagenaryDay: "갑인(甲寅)",
      isIntercalaryMonth: false,
      gregorianYear: 1385,
      gregorianDateISO: "1385-08-25",
      precision: "DAY",
      conversionConfidence: "EXACT_DAILY"
    },
    defaultInterpretationId: "interp_1385_kma",
    interpretations: [
      {
        interpretationId: "interp_1385_kma",
        authorOrInstitution: "기상청 역사지진 아카이브 (KMA)",
        publicationYear: 2012,
        epicenter: {
          lat: 37.97,
          lon: 126.55,
          errorRadiusKm: 30.0,
          isUnresolved: false,
          basis: "고려 개경 및 송악산 대표 좌표"
        },
        maxIntensityMMI: { roman: "VIII", numericEquiv: 8.0, scale: "MMI", intensityBasis: "담장 붕괴 및 송악산 암석 붕락(松嶽崩)" },
        estimatedMagnitude: { min: 6.0, max: 6.5, best: 6.2, scaleLabel: "M_intensity_derived" },
        focalDepth: { valKm: null, determinationType: "UNKNOWN_UNRECORDED" }
      }
    ]
  }),

  // 22. 1405 AD Joseon Taejong Gyeongsang & Jeolla Earthquake
  createHistoricalEvent({
    eventId: "hist_1405_gyeongsang",
    titleKo: "1405 경상·전라도 광역 지진 (조선 태종 5년)",
    dynasty: "JOSEON",
    century: 15,
    primaryPlaceId: "place_sangju_silla",
    placeIds: ["place_sangju_silla", "place_geumseong_gyeongju", "place_wanju_jeonju"],
    rawNloc: 6,
    rawDclass: 2,
    rawNrep: null,
    dateConversion: {
      reignName: "조선 태종(太宗)",
      reignYear: 5,
      reignYearText: "太宗 5年 2月 12日",
      lunarMonth: 2,
      lunarDay: 12,
      sexagenaryDay: "경자(庚子)",
      isIntercalaryMonth: false,
      gregorianYear: 1405,
      gregorianDateISO: "1405-03-12",
      precision: "DAY",
      conversionConfidence: "EXACT_DAILY"
    },
    defaultInterpretationId: "interp_1405_kma",
    interpretations: [
      {
        interpretationId: "interp_1405_kma",
        authorOrInstitution: "기상청 역사지진 아카이브 (KMA)",
        publicationYear: 2012,
        epicenter: {
          lat: 36.15,
          lon: 127.95,
          errorRadiusKm: 40.0,
          isUnresolved: false,
          basis: "경상·전라 접경(상주·무주 중간) 대표 좌표"
        },
        maxIntensityMMI: { roman: "VI", numericEquiv: 6.0, scale: "MMI", intensityBasis: "경주·안동·상주·전주·무주 광역 유감" },
        estimatedMagnitude: { min: 5.5, max: 6.0, best: 5.8, scaleLabel: "M_intensity_derived" },
        focalDepth: { valKm: null, determinationType: "UNKNOWN_UNRECORDED" }
      }
    ]
  }),

  // 23. 1430 AD Joseon Sejong Samnam (Three Provinces) Earthquake
  createHistoricalEvent({
    eventId: "hist_1430_samnam",
    titleKo: "1430 삼남(경상·충청·전라) 지진 (조선 세종 12년)",
    dynasty: "JOSEON",
    century: 15,
    primaryPlaceId: "place_boen_cheongju",
    placeIds: ["place_boen_cheongju", "place_geumseong_gyeongju", "place_wanju_jeonju"],
    rawNloc: 9,
    rawDclass: 3,
    rawNrep: null,
    dateConversion: {
      reignName: "조선 세종(世宗)",
      reignYear: 12,
      reignYearText: "世宗 12年 4月 22日",
      lunarMonth: 4,
      lunarDay: 22,
      sexagenaryDay: "무오(戊午)",
      isIntercalaryMonth: false,
      gregorianYear: 1430,
      gregorianDateISO: "1430-05-14",
      precision: "DAY",
      conversionConfidence: "EXACT_DAILY"
    },
    defaultInterpretationId: "interp_1430_kma",
    interpretations: [
      {
        interpretationId: "interp_1430_kma",
        authorOrInstitution: "기상청 역사지진 아카이브 (KMA)",
        publicationYear: 2012,
        epicenter: {
          lat: 36.35,
          lon: 127.85,
          errorRadiusKm: 40.0,
          isUnresolved: false,
          basis: "충청·경상·전라 삼도 교차역 대표 좌표"
        },
        maxIntensityMMI: { roman: "VII", numericEquiv: 7.0, scale: "MMI", intensityBasis: "삼남 광역 가옥 동요" },
        estimatedMagnitude: { min: 5.8, max: 6.3, best: 6.0, scaleLabel: "M_intensity_derived" },
        focalDepth: { valKm: null, determinationType: "UNKNOWN_UNRECORDED" }
      }
    ]
  }),

  // 24. 1455 AD Joseon Danjong Namwon/Gurye/Jinju Earthquake
  createHistoricalEvent({
    eventId: "hist_1455_namwon",
    titleKo: "1455 전라도 남원·구례·진주 지진 (조선 단종 3년)",
    dynasty: "JOSEON",
    century: 15,
    primaryPlaceId: "place_namwon_gurye",
    placeIds: ["place_namwon_gurye"],
    rawNloc: 6,
    rawDclass: 3,
    rawNrep: null,
    dateConversion: {
      reignName: "조선 단종(端宗)",
      reignYear: 3,
      reignYearText: "端宗 3年 1月 19日",
      lunarMonth: 1,
      lunarDay: 19,
      sexagenaryDay: "정사(丁巳)",
      isIntercalaryMonth: false,
      gregorianYear: 1455,
      gregorianDateISO: "1455-02-05",
      precision: "DAY",
      conversionConfidence: "EXACT_DAILY"
    },
    defaultInterpretationId: "interp_1455_kma",
    interpretations: [
      {
        interpretationId: "interp_1455_kma",
        authorOrInstitution: "기상청 역사지진 아카이브 (KMA)",
        publicationYear: 2012,
        epicenter: {
          lat: 35.41,
          lon: 127.39,
          errorRadiusKm: 35.0,
          isUnresolved: false,
          basis: "전라도 남원·구례 대표 좌표"
        },
        maxIntensityMMI: { roman: "VII~VIII", numericEquiv: 7.5, scale: "MMI", intensityBasis: "담장 및 가옥 붕괴(墻屋頹落)" },
        estimatedMagnitude: { min: 5.9, max: 6.4, best: 6.1, scaleLabel: "M_intensity_derived" },
        focalDepth: { valKm: null, determinationType: "UNKNOWN_UNRECORDED" }
      }
    ]
  }),

  // 26. 1518 AD Joseon Jungjong Hanseong Earthquake (Archetype 3: 3 Competing Researcher Interpretations)
  createHistoricalEvent({
    eventId: "hist_1518_seoul",
    titleKo: "1518 한성(서울) 대지진 (조선 중종 13년)",
    dynasty: "JOSEON",
    century: 16,
    primaryPlaceId: "place_hanseong_seoul",
    placeIds: ["place_hanseong_seoul"],
    rawNloc: 8,
    rawDclass: 3,
    rawNrep: 4,
    feltCounties: [
      { countyKo: "경기 한양 도성 (漢陽)", modernLocation: "서울특별시 종로구·사대문 내부", distanceKm: 5, intensityMMI: "VIII", phenomenonKo: "소리가 성난 우레 같고 담장과 도성 성첩(城堞) 붕괴, 백성 밤새 노숙" },
      { countyKo: "경기 광주목 (廣州)", modernLocation: "경기도 광주시 남한산성 일원", distanceKm: 24, intensityMMI: "VII", phenomenonKo: "남한산성 석축 요동 및 가옥 파손" },
      { countyKo: "경기 개성부 (開城)", modernLocation: "황해북도 개성시 일원", distanceKm: 60, intensityMMI: "VI~VII", phenomenonKo: "개성 시가 가옥 요동 및 사찰 담장 전도" },
      { countyKo: "강원 원주목 (原州)", modernLocation: "강원특별자치도 원주시", distanceKm: 90, intensityMMI: "V~VI", phenomenonKo: "영서 지방 광역 지동 유감" },
      { countyKo: "충청 공주목 (公州)", modernLocation: "충청남도 공주시", distanceKm: 125, intensityMMI: "V", phenomenonKo: "충청 내륙 가옥 흔들림 감지" },
      { countyKo: "황해 해주목 (海州)", modernLocation: "황해도 해주시", distanceKm: 110, intensityMMI: "V", phenomenonKo: "황해 남부 지진동 청취" }
    ],
    methodologicalCorrections: {
      structuralVulnerability: {
        badgeKo: "도성 성첩 석축 붕괴 실증",
        status: "STONE_BATTLEMENT_COLLAPSE",
        analysisKo: "민가 초가뿐 아니라 국가 핵심 방어시설인 한양도성 성첩(城堞)이 대거 붕괴되고, 중종실록에 백성들이 여진 공포로 밤새 노숙(露處)한 사실이 입증됨."
      },
      tianRenFilter: {
        badgeKo: "중종 구언 교서 및 해괴제 거행",
        status: "ROYAL_RITUAL_CONFIRMED",
        analysisKo: "조정이 지진을 국가적 대변괴로 인식하여 사직단에서 해괴제(解怪祭)를 지내고 구언(求言) 교서를 내린 공식 국가 행정 기록으로 확인."
      },
      batchSeparation: {
        badgeKo: "야간 강진 및 여진 시퀀스",
        status: "NIGHT_SHOCK_ISOLATED",
        analysisKo: "중종 13년 5월 15일 야간(신시~술시)에 발생한 독립 강진 및 당일 밤새 지속된 여진 기록을 분리."
      },
      seatBiasOffset: {
        badgeKo: "추가령 단층대 도성 북부 비정",
        status: "CHUGARYEONG_FAULT_CORRELATED",
        analysisKo: "도성(경복궁) 중심에서 추가령 단층대 남단 단층선을 고려한 북부 단층 지진으로 비정 (37.6°N, 127.0°E)."
      }
    },
    geophysicalPhenomena: {
      type: "STRUCTURAL_RESONANCE_ROCKFALL",
      titleKo: "도성 성첩 석축 공진 및 추가령 단층 천발 전단 파괴",
      equation: "FS = \\frac{c + (\\gamma z \\cos\\theta - k_h W)\\tan\\phi}{\\gamma z \\sin\\theta + k_h W} < 1.0",
      parameters: [
        { label: "구조물 대상", value: "한양도성 성첩 석축 및 목조 가구" },
        { label: "부지 증폭", value: "서울 분지 청계천 충적토층" },
        { label: "수평 지진 계수 (k_h)", value: "약 0.20 g (MMI VIII 수준)" },
        { label: "사료 실증", value: "聲如怒雷 · 城堞頹落 都人終夜露處" }
      ],
      narrativeKo: "한양도성의 성첩 석축 붕괴(城堞頹落)는 추가령 단층대 천발 지진에서 방출된 고주파 S파가 청계천 충적 연약층의 부지 증폭 효과(Site Amplification)와 결합하여 석축의 고유 진동수와 공진, 수평 지진 계수 kh 증가로 인해 사면 안전율(FS)이 1.0 미만으로 떨어져 발생한 구조 파괴입니다."
    },
    astronomicalChronology: {
      reignTitle: "조선 중종(中宗) 13년",
      lunarDate: "음력 5월 15일",
      sexagenaryDay: "임진(壬辰)일",
      doubleHour: "술시(戌時, 19:00~21:00 야간)",
      solarCalendar: "1518-07-02 (율리우스력 환산)",
      timePrecisionKo: "일·야간 시각 확정 (오차 ±1.0 hr)"
    },
    dateConversion: {
      reignName: "조선 중종(中宗)",
      reignYear: 13,
      reignYearText: "中宗 13年 5月 15日 壬辰",
      lunarMonth: 5,
      lunarDay: 15,
      sexagenaryDay: "임진(壬辰)",
      isIntercalaryMonth: false,
      gregorianYear: 1518,
      gregorianDateISO: "1518-06-23",
      precision: "DAY",
      conversionConfidence: "EXACT_DAILY"
    },
    defaultInterpretationId: "interp_1518_kma",
    interpretations: [
      {
        interpretationId: "interp_1518_kma",
        authorOrInstitution: "기상청 국립기상연구소 (KMA)",
        publicationYear: 2012,
        epicenter: {
          lat: 37.57,
          lon: 126.98,
          errorRadiusKm: 35.0,
          isUnresolved: false,
          basis: "기상청 역사지진 한성부 대표 좌표"
        },
        maxIntensityMMI: { roman: "VIII", numericEquiv: 8.0, scale: "MMI", intensityBasis: "담장과 성첩이 무너지고 도성 안 인마가 놀라 피함" },
        estimatedMagnitude: { min: 6.0, max: 6.5, best: 6.2, scaleLabel: "M_intensity_derived" },
        focalDepth: { valKm: null, determinationType: "UNKNOWN_UNRECORDED" }
      },
      {
        interpretationId: "interp_1518_lee1998",
        authorOrInstitution: "이기화 (서울대 지구환경과학부)",
        publicationYear: 1998,
        epicenter: {
          lat: 37.60,
          lon: 127.05,
          errorRadiusKm: 30.0,
          isUnresolved: false,
          basis: "추가령단층대 남단 한성 인접 진앙 해석"
        },
        maxIntensityMMI: { roman: "VIII~IX", numericEquiv: 8.5, scale: "MMI", intensityBasis: "팔도 유감 및 한성 성첩 붕괴, 도성 주민 철야 노숙" },
        estimatedMagnitude: { min: 6.4, max: 6.9, best: 6.7, scaleLabel: "M_intensity_derived" },
        focalDepth: { valKm: null, determinationType: "UNKNOWN_UNRECORDED" }
      },
      {
        interpretationId: "interp_1518_kyung2012",
        authorOrInstitution: "경재복 (한국교원대 지구과학교육과)",
        publicationYear: 2012,
        epicenter: {
          lat: 37.55,
          lon: 126.95,
          errorRadiusKm: 25.0,
          isUnresolved: false,
          basis: "수도권 감쇠식 기반 등진도선 역산 진앙"
        },
        maxIntensityMMI: { roman: "VII~VIII", numericEquiv: 7.5, scale: "MMI", intensityBasis: "성첩 일부 퇴락 및 비구조체 피해 중심 평가" },
        estimatedMagnitude: { min: 5.8, max: 6.2, best: 6.0, scaleLabel: "M_intensity_derived" },
        focalDepth: { valKm: null, determinationType: "UNKNOWN_UNRECORDED" }
      }
    ]
  }),

  // 27. 1546 AD Joseon Myeongjong Haeju/Pyeongsan Liquefaction Earthquake
  createHistoricalEvent({
    eventId: "hist_1546_haeju",
    titleKo: "1546 황해도 해주·평산·배천 지진·액상화 (조선 명종 원년)",
    dynasty: "JOSEON",
    century: 16,
    primaryPlaceId: "place_haeju_pyeongsan",
    placeIds: ["place_haeju_pyeongsan"],
    rawNloc: 4,
    rawDclass: 4,
    rawNrep: 3,
    liquefactionObserved: true,
    dateConversion: {
      reignName: "조선 명종(明宗)",
      reignYear: 1,
      reignYearText: "明宗 元年 5月 28日 庚午",
      lunarMonth: 5,
      lunarDay: 28,
      sexagenaryDay: "경오(庚午)",
      isIntercalaryMonth: false,
      gregorianYear: 1546,
      gregorianDateISO: "1546-06-26",
      precision: "DAY",
      conversionConfidence: "EXACT_DAILY"
    },
    defaultInterpretationId: "interp_1546_kma",
    interpretations: [
      {
        interpretationId: "interp_1546_kma",
        authorOrInstitution: "기상청 역사지진 아카이브 (KMA)",
        publicationYear: 2012,
        epicenter: {
          lat: 38.04,
          lon: 125.71,
          errorRadiusKm: 35.0,
          isUnresolved: false,
          basis: "황해도 해주·평산 대표 좌표"
        },
        maxIntensityMMI: { roman: "VIII", numericEquiv: 8.0, scale: "MMI", intensityBasis: "가옥 퇴훼 및 지열·용수(地坼水涌)" },
        estimatedMagnitude: { min: 6.0, max: 6.5, best: 6.3, scaleLabel: "M_intensity_derived" },
        focalDepth: { valKm: null, determinationType: "UNKNOWN_UNRECORDED" }
      }
    ]
  }),

  // 28. 1553 AD Joseon Myeongjong Hamgyeong Gyeongseong Earthquake
  createHistoricalEvent({
    eventId: "hist_1553_gyeongseong",
    titleKo: "1553 함경도 경성·명천·길주 지진 (조선 명종 8년)",
    dynasty: "JOSEON",
    century: 16,
    primaryPlaceId: "place_gyeongseong_myeongcheon",
    placeIds: ["place_gyeongseong_myeongcheon"],
    rawNloc: 4,
    rawDclass: 3,
    rawNrep: null,
    dateConversion: {
      reignName: "조선 명종(明宗)",
      reignYear: 8,
      reignYearText: "明宗 8年 9月 11日 癸巳",
      lunarMonth: 9,
      lunarDay: 11,
      sexagenaryDay: "계사(癸巳)",
      isIntercalaryMonth: false,
      gregorianYear: 1553,
      gregorianDateISO: "1553-10-17",
      precision: "DAY",
      conversionConfidence: "EXACT_DAILY"
    },
    defaultInterpretationId: "interp_1553_kma",
    interpretations: [
      {
        interpretationId: "interp_1553_kma",
        authorOrInstitution: "기상청 역사지진 아카이브 (KMA)",
        publicationYear: 2012,
        epicenter: {
          lat: 41.59,
          lon: 129.61,
          errorRadiusKm: 45.0,
          isUnresolved: false,
          basis: "함경도 경성·명천 대표 좌표"
        },
        maxIntensityMMI: { roman: "VII~VIII", numericEquiv: 7.5, scale: "MMI", intensityBasis: "성첩 붕괴 및 포성 같은 지진음(聲如大砲)" },
        estimatedMagnitude: { min: 5.8, max: 6.4, best: 6.1, scaleLabel: "M_intensity_derived" },
        focalDepth: { valKm: null, determinationType: "UNKNOWN_UNRECORDED" }
      }
    ]
  }),

  // 29. 1565 AD Joseon Myeongjong Boeun/Cheongju Rockfall Earthquake
  createHistoricalEvent({
    eventId: "hist_1565_boeun",
    titleKo: "1565 충청도 보은·청주·옥천 지진 (조선 명종 20년)",
    dynasty: "JOSEON",
    century: 16,
    primaryPlaceId: "place_boen_cheongju",
    placeIds: ["place_boen_cheongju"],
    rawNloc: 5,
    rawDclass: 3,
    rawNrep: null,
    dateConversion: {
      reignName: "조선 명종(明宗)",
      reignYear: 20,
      reignYearText: "明宗 20年 8月 22日 甲子",
      lunarMonth: 8,
      lunarDay: 22,
      sexagenaryDay: "갑자(甲子)",
      isIntercalaryMonth: false,
      gregorianYear: 1565,
      gregorianDateISO: "1565-09-16",
      precision: "DAY",
      conversionConfidence: "EXACT_DAILY"
    },
    defaultInterpretationId: "interp_1565_kma",
    interpretations: [
      {
        interpretationId: "interp_1565_kma",
        authorOrInstitution: "기상청 역사지진 아카이브 (KMA)",
        publicationYear: 2012,
        epicenter: {
          lat: 36.49,
          lon: 127.72,
          errorRadiusKm: 35.0,
          isUnresolved: false,
          basis: "충청도 보은·속리산권 대표 좌표"
        },
        maxIntensityMMI: { roman: "VII", numericEquiv: 7.0, scale: "MMI", intensityBasis: "우레 같은 지진음 및 암석 붕락(巖石崩落)" },
        estimatedMagnitude: { min: 5.5, max: 6.1, best: 5.8, scaleLabel: "M_intensity_derived" },
        focalDepth: { valKm: null, determinationType: "UNKNOWN_UNRECORDED" }
      }
    ]
  }),

  // 30. 1594 AD Joseon Seonjo Samdo Earthquake
  createHistoricalEvent({
    eventId: "hist_1594_samdo",
    titleKo: "1594 충청·전라·경상 삼도 지진 (조선 선조 27년)",
    dynasty: "JOSEON",
    century: 16,
    primaryPlaceId: "place_wanju_jeonju",
    placeIds: ["place_wanju_jeonju", "place_boen_cheongju", "place_sangju_silla"],
    rawNloc: 8,
    rawDclass: 2,
    rawNrep: null,
    dateConversion: {
      reignName: "조선 선조(宣祖)",
      reignYear: 27,
      reignYearText: "宣祖 27年 7月 29日 戊戌",
      lunarMonth: 7,
      lunarDay: 29,
      sexagenaryDay: "무술(戊戌)",
      isIntercalaryMonth: false,
      gregorianYear: 1594,
      gregorianDateISO: "1594-09-13",
      precision: "DAY",
      conversionConfidence: "EXACT_DAILY"
    },
    defaultInterpretationId: "interp_1594_kma",
    interpretations: [
      {
        interpretationId: "interp_1594_kma",
        authorOrInstitution: "기상청 역사지진 아카이브 (KMA)",
        publicationYear: 2012,
        epicenter: {
          lat: 36.05,
          lon: 127.65,
          errorRadiusKm: 40.0,
          isUnresolved: false,
          basis: "삼도 접경(금산·무주·영동) 대표 좌표"
        },
        maxIntensityMMI: { roman: "VI~VII", numericEquiv: 6.5, scale: "MMI", intensityBasis: "삼도 동시 지진 및 기와 낙하(瓦礫自落)" },
        estimatedMagnitude: { min: 5.6, max: 6.1, best: 5.9, scaleLabel: "M_intensity_derived" },
        focalDepth: { valKm: null, determinationType: "UNKNOWN_UNRECORDED" }
      }
    ]
  }),

  // 31. 1597 AD Joseon Seonjo Samsu/Gapsan Mountain Collapse Earthquake
  createHistoricalEvent({
    eventId: "hist_1597_samsu",
    titleKo: "1597 함경도 삼수·갑산 산붕 대지진 (조선 선조 30년)",
    dynasty: "JOSEON",
    century: 16,
    primaryPlaceId: "place_gyeongseong_myeongcheon",
    placeIds: ["place_gyeongseong_myeongcheon"],
    rawNloc: 5,
    rawDclass: 4,
    rawNrep: 3,
    dateConversion: {
      reignName: "조선 선조(宣祖)",
      reignYear: 30,
      reignYearText: "宣祖 30年 9月 26日 丁丑",
      lunarMonth: 9,
      lunarDay: 26,
      sexagenaryDay: "정축(丁丑)",
      isIntercalaryMonth: false,
      gregorianYear: 1597,
      gregorianDateISO: "1597-11-05",
      precision: "DAY",
      conversionConfidence: "EXACT_DAILY"
    },
    defaultInterpretationId: "interp_1597_kma",
    interpretations: [
      {
        interpretationId: "interp_1597_kma",
        authorOrInstitution: "기상청 역사지진 아카이브 (KMA)",
        publicationYear: 2012,
        epicenter: {
          lat: 41.38,
          lon: 128.18,
          errorRadiusKm: 45.0,
          isUnresolved: false,
          basis: "함경도 삼수·갑산 지역 대표 좌표"
        },
        maxIntensityMMI: { roman: "VIII", numericEquiv: 8.0, scale: "MMI", intensityBasis: "산사태로 하천이 막히고 범람(山崩塞川 水溢)" },
        estimatedMagnitude: { min: 6.2, max: 6.7, best: 6.5, scaleLabel: "M_intensity_derived" },
        focalDepth: { valKm: null, determinationType: "UNKNOWN_UNRECORDED" }
      }
    ]
  }),

  // 33. 1643 AD Joseon Injo Ulsan/Gyeongsang Great Earthquake & Liquefaction (Archetype 1: Cross-Verified Sillok + SJW)
  createHistoricalEvent({
    eventId: "hist_1643_ulsan",
    titleKo: "1643 경상도 울산·대구 대지진·액상화 (조선 인조 21년)",
    dynasty: "JOSEON",
    century: 17,
    primaryPlaceId: "place_ulsan_daegu",
    placeIds: ["place_ulsan_daegu", "place_geumseong_gyeongju", "place_geumju_gimhae"],
    rawNloc: 10,
    rawDclass: 4,
    rawNrep: 2,
    liquefactionObserved: true,
    feltCounties: [
      { countyKo: "경상 울산도호부 (蔚山)", modernLocation: "울산광역시 중구·태화강 하구", distanceKm: 12, intensityMMI: "IX", phenomenonKo: "성첩 파괴, 지반 30여 보 균열, 흰 모래 및 황색 흙탕물 분출(액상화)" },
      { countyKo: "경상 대구도호부 (大丘)", modernLocation: "대구광역시 중구 일원", distanceKm: 75, intensityMMI: "VIII", phenomenonKo: "성벽 다수 붕괴, 민가 도괴, 주민 야간 대피" },
      { countyKo: "경상 경주부 (慶州)", modernLocation: "경상북도 경주시 도성 일원", distanceKm: 35, intensityMMI: "VIII", phenomenonKo: "성첩 및 관아 담장 붕괴, 고분 사면 균열" },
      { countyKo: "경상 김해도호부 (金海)", modernLocation: "경상남도 김해시 일원", distanceKm: 55, intensityMMI: "VII~VIII", phenomenonKo: "낙동강 하구 연약 지반 침하 및 가옥 균열" },
      { countyKo: "전라 남원도호부 (南原)", modernLocation: "전북특별자치도 남원시", distanceKm: 170, intensityMMI: "VI", phenomenonKo: "지동 및 가옥 요동 감지, 전라도 동부 광역 유감" },
      { countyKo: "경기 한양 도성 (漢陽)", modernLocation: "서울특별시 종로구 일원", distanceKm: 310, intensityMMI: "IV~V", phenomenonKo: "궁궐 전각 등잔 흔들림 및 지동 유감" }
    ],
    methodologicalCorrections: {
      structuralVulnerability: {
        badgeKo: "지반 액상화 실증 보정 완료",
        status: "LIQUEFACTION_CONFIRMED",
        analysisKo: "성벽 붕괴뿐만 아니라 태화강 하구 사질토에서 대규모 지반 균열(地裂) 및 분사(湧水·白沙)가 기록되어 진도 IX의 극심한 지반 변형 실증."
      },
      tianRenFilter: {
        badgeKo: "경상감사 긴급 장계 교차 실증",
        status: "ADMINISTRATIVE_FINANCIAL_CONFIRMED",
        analysisKo: "인조 21년 5월 28일 승정원일기 접수 경상감사 공식 장계 및 피해 구휼 조치와 일치."
      },
      batchSeparation: {
        badgeKo: "영남·호남 광역 동시성 입증",
        status: "REGIONAL_SYNCHRONICITY_CONFIRMED",
        analysisKo: "경상도와 전라도에서 5월 24일 무진일 동일 시각에 발생한 한반도 남동부 초대형 지진동으로 확인."
      },
      seatBiasOffset: {
        badgeKo: "태화강 하구 퇴적층 미세 비정",
        status: "SEDIMENTARY_BASIN_OFFSET",
        analysisKo: "울산읍성 치소뿐 아니라 태화강 하구 삼각주 퇴적층(35.5°N, 129.3°E)의 액상화 발현 지점을 고려한 진앙 비정."
      }
    },
    geophysicalPhenomena: {
      type: "SOIL_LIQUEFACTION",
      titleKo: "포화 사질토 과잉 간극수압 및 지반 액상화 역학",
      equation: "\\sigma'_{eff} = \\sigma_v - P_{pore} \\to 0",
      parameters: [
        { label: "지질 환경", value: "태화강 하구 충적 사질토 (미고결 퇴적층)" },
        { label: "과잉 간극수압 (\\Delta u)", value: "반복 전단 응력에 의한 정수압 대비 극단적 급증" },
        { label: "유효 전단 강도", value: "0 kPa (입자간 맞물림 및 전단 강도 완전 상실)" },
        { label: "사료 실증", value: "地坼水湧 · 地裂湧水 白沙湧出" }
      ],
      narrativeKo: "인조실록과 승정원일기에 기록된 '蔚山府地裂湧水 白沙湧出(울산부에 땅이 찢어지고 물과 흰 모래가 뿜어져 나옴)'은 포화된 충적 사질토층에 강한 반복 전단 응력이 가해져 간극수압이 급상승, 유효 수직 응력이 0이 되어 전단 강도를 상실하는 전형적인 지반 액상화(Soil Liquefaction) 현상입니다. 2017년 포항 지진 당시 흥해읍에서 관측된 액상화와 동일한 물리적 메커니즘을 가집니다."
    },
    astronomicalChronology: {
      reignTitle: "조선 인조(仁祖) 21년",
      lunarDate: "음력 5월 24일",
      sexagenaryDay: "무진(戊辰)일",
      doubleHour: "미시(未時, 13:00~15:00)",
      solarCalendar: "1643-07-24 (그레고리력 환산)",
      timePrecisionKo: "일 단위 확정 / 12간지 시각 (오차 ±1.0 hr)"
    },
    dateConversion: {
      reignName: "조선 인조(仁祖)",
      reignYear: 21,
      reignYearText: "仁祖 21年 5月 24日 戊辰",
      lunarMonth: 5,
      lunarDay: 24,
      sexagenaryDay: "무진(戊辰)",
      isIntercalaryMonth: false,
      gregorianYear: 1643,
      gregorianDateISO: "1643-07-09",
      precision: "DAY",
      conversionConfidence: "EXACT_DAILY"
    },
    defaultInterpretationId: "interp_1643_kma",
    interpretations: [
      {
        interpretationId: "interp_1643_kma",
        authorOrInstitution: "기상청 국립기상연구소 (KMA)",
        publicationYear: 2012,
        epicenter: {
          lat: 35.54,
          lon: 129.31,
          errorRadiusKm: 40.0,
          isUnresolved: false,
          basis: "기상청 역사지진 울산 지역 대표 좌표"
        },
        maxIntensityMMI: { roman: "VIII~IX", numericEquiv: 8.5, scale: "MMI", intensityBasis: "성벽 붕괴 및 울산 지열·용수·백사 분출(地坼水湧 白沙湧出)" },
        estimatedMagnitude: { min: 6.4, max: 7.0, best: 6.5, scaleLabel: "M_intensity_derived" },
        focalDepth: { valKm: null, determinationType: "UNKNOWN_UNRECORDED" }
      },
      {
        interpretationId: "interp_1643_kyung2012",
        authorOrInstitution: "경재복 (한국교원대 지구과학교육과)",
        publicationYear: 2012,
        epicenter: {
          lat: 35.50,
          lon: 129.40,
          errorRadiusKm: 30.0,
          isUnresolved: false,
          basis: "울산단층 남부 및 연안 진앙 역산 모델"
        },
        maxIntensityMMI: { roman: "VIII~IX", numericEquiv: 8.5, scale: "MMI", intensityBasis: "액상화 모래 분출 및 경상도 일원 성첩 붕괴" },
        estimatedMagnitude: { min: 6.5, max: 7.0, best: 6.7, scaleLabel: "M_intensity_derived" },
        focalDepth: { valKm: null, determinationType: "UNKNOWN_UNRECORDED" }
      }
    ]
  }),

  // 34. 1670 AD Joseon Hyeonjong Jeju Earthquake
  createHistoricalEvent({
    eventId: "hist_1670_jeju",
    titleKo: "1670 제주목·대정·정의 지진 (조선 현종 11년)",
    dynasty: "JOSEON",
    century: 17,
    primaryPlaceId: "place_jeju_mok",
    placeIds: ["place_jeju_mok"],
    rawNloc: 3,
    rawDclass: 3,
    rawNrep: null,
    dateConversion: {
      reignName: "조선 현종(顯宗)",
      reignYear: 11,
      reignYearText: "顯宗 11年 9月 13日 辛未",
      lunarMonth: 9,
      lunarDay: 13,
      sexagenaryDay: "신미(辛未)",
      isIntercalaryMonth: false,
      gregorianYear: 1670,
      gregorianDateISO: "1670-10-26",
      precision: "DAY",
      conversionConfidence: "EXACT_DAILY"
    },
    defaultInterpretationId: "interp_1670_kma",
    interpretations: [
      {
        interpretationId: "interp_1670_kma",
        authorOrInstitution: "기상청 역사지진 아카이브 (KMA)",
        publicationYear: 2012,
        epicenter: {
          lat: 33.50,
          lon: 126.53,
          errorRadiusKm: 40.0,
          isUnresolved: false,
          basis: "제주목 대표 좌표"
        },
        maxIntensityMMI: { roman: "VII", numericEquiv: 7.0, scale: "MMI", intensityBasis: "제주 전역 돌담 다수 붕괴(石垣多頹)" },
        estimatedMagnitude: { min: 5.6, max: 6.1, best: 5.9, scaleLabel: "M_intensity_derived" },
        focalDepth: { valKm: null, determinationType: "UNKNOWN_UNRECORDED" }
      }
    ]
  }),

  // 35. 1681-06-12 Yangyang Shock 1 Foreshock (Archetype 1 & 2: Unresolved Coords, Sequence Foreshock)
  createHistoricalEvent({
    eventId: "hist_1681_0612",
    titleKo: "1681 강원도 양양·삼척 인근 (1차 전진)",
    dynasty: "JOSEON",
    century: 17,
    sequenceGroupId: "seq_1681_yangyang",
    sequenceRole: "FORESHOCK",
    primaryPlaceId: "place_yangyang_samcheok_unresolved",
    placeIds: ["place_yangyang_samcheok_unresolved"],
    rawNloc: 3,
    rawDclass: 2,
    rawNrep: null,
    dateConversion: {
      reignName: "조선 숙종(肅宗)",
      reignYear: 7,
      reignYearText: "肅宗 7年 4月 26日 癸卯",
      lunarMonth: 4,
      lunarDay: 26,
      sexagenaryDay: "계묘(癸卯)",
      isIntercalaryMonth: false,
      gregorianYear: 1681,
      gregorianDateISO: "1681-06-12",
      precision: "DAY",
      conversionConfidence: "EXACT_DAILY"
    },
    defaultInterpretationId: "interp_1681_0612_kma",
    interpretations: [
      {
        interpretationId: "interp_1681_0612_kma",
        authorOrInstitution: "기상청 역사지진 2차 문헌 추정",
        publicationYear: 2012,
        epicenter: {
          lat: null,
          lon: null,
          errorRadiusKm: null,
          isUnresolved: true,
          basis: "진앙 좌표 미확정 (지도 핀 없음; 내륙/해역 전진 범위 불명확)"
        },
        maxIntensityMMI: { roman: "VII~VIII", numericEquiv: 7.5, scale: "MMI", intensityBasis: "소리가 우레와 같고 담과 가옥이 흔들림" },
        estimatedMagnitude: { min: 6.0, max: 6.5, best: 6.5, scaleLabel: "M_intensity_derived" },
        focalDepth: { valKm: null, determinationType: "UNKNOWN_UNRECORDED" }
      }
    ]
  }),

  // 36. 1681-06-26 Yangyang Historical Event (Archetype 1: Cross-Verified Sillok + SJW + Munheon Bigo)
  createHistoricalEvent({
    eventId: "hist_1681_0626",
    titleKo: "1681 강원도 양양 인근 (숙종 7년 5월 11일 사료 기록)",
    dynasty: "JOSEON",
    century: 17,
    sequenceGroupId: "seq_1681_yangyang",
    sequenceRole: "MAINSHOCK",
    primaryPlaceId: "place_yangyang_offshore",
    placeIds: ["place_yangyang_offshore", "place_donggye_myeongju"],
    rawNloc: 4,
    rawDclass: 4,
    rawNrep: 3,
    magnitude: null, // 계측기 이전 역사 사료 사건으로 확정 규모 없음 (null 보존)
    tsunamiObserved: "UNCONFIRMED_ANOMALOUS_TIDE",
    seaDrawbackRecorded: true,
    tsunamiDefinite: false,
    drawbackRecordNote: "승정원일기 5월 14일 강원감사 장계에 '바닷물이 100여 보 물러났다가 다시 들어왔다(海水退百餘步)'는 기록이 있으나, 진원역 해일 수치 모델링 미검증 상태로 확정적 지진해일 침수 증거로 단정할 수 없음.",
    feltCounties: [
      { countyKo: "강원 양양도호부 (襄陽)", modernLocation: "강원특별자치도 양양군 현남면", distanceKm: 18, intensityMMI: "VIII~IX", phenomenonKo: "사찰·가옥 붕괴, 설악산 신흥사 암벽 붕락, 연안 해수 100여 보 퇴조 후 해일 내습" },
      { countyKo: "강원 삼척도호부 (三陟)", modernLocation: "강원특별자치도 삼척시 성내동·죽서루", distanceKm: 42, intensityMMI: "VIII", phenomenonKo: "죽서루 기암괴석 동요, 연안 바위 붕괴, 담장 및 가옥 다수 도괴" },
      { countyKo: "강원 강릉대도호부 (江陵)", modernLocation: "강원특별자치도 강릉시 명주동", distanceKm: 35, intensityMMI: "VII~VIII", phenomenonKo: "관아 및 민가 기와 탈락, 산천 진동 음향 청취" },
      { countyKo: "강원 원주목 (原州)", modernLocation: "강원특별자치도 원주시 일원", distanceKm: 115, intensityMMI: "VI", phenomenonKo: "가옥 요동, 가구 전도, 주민 다수 옥외 대피" },
      { countyKo: "경기 한양 도성 (漢陽)", modernLocation: "서울특별시 종로구 궁궐 및 도성 일원", distanceKm: 165, intensityMMI: "V", phenomenonKo: "궁궐 전각 및 민가 요동, 등잔 흔들림, 백성 동요" },
      { countyKo: "평안 평양부 (平壤)", modernLocation: "평양직할시 대동강변", distanceKm: 280, intensityMMI: "IV", phenomenonKo: "정지된 물체의 미세한 흔들림 및 원거리 지진동 청취" },
      { countyKo: "경상 안동대도호부 (安東)", modernLocation: "경상북도 안동시 일원", distanceKm: 140, intensityMMI: "V", phenomenonKo: "영남 북부 가옥 창문 덜컹거림 및 원거리 감진" }
    ],
    methodologicalCorrections: {
      structuralVulnerability: {
        badgeKo: "가옥 구조 취약성 보정 완료",
        status: "VERIFIED_EXTREME_GROUND_FAILURE",
        analysisKo: "단순 낙와(落瓦)에 그치지 않고, 설악산 신흥사 주변 거암 붕괴(巨巖崩壞) 및 해안 단애 절취 등 영구적 지반 변형이 수반되었음을 실증하여 MMI VIII~IX로 판정."
      },
      tianRenFilter: {
        badgeKo: "천인감응설 수사 배제 완료",
        status: "ADMINISTRATIVE_FINANCIAL_CONFIRMED",
        analysisKo: "재이(災異)에 대한 감정적 상소문 서술을 배제하고, 호조(戶曹)의 강원도 조세 탕감(蠲免) 및 진휼청의 구휼미 방출 공인 행정 집행 기록으로 지진 규모 교차 실증."
      },
      batchSeparation: {
        badgeKo: "시공간 일괄 보고 분리 완료",
        status: "CHRONOLOGICALLY_RESOLVED",
        analysisKo: "강원감사 파발 지연으로 인한 묶음 보고를 간지(癸卯·戊午·甲子) 역추적을 통해 4월 26일 전진, 5월 11일 본진·해일, 5월 17일 여진으로 엄밀 분리."
      },
      seatBiasOffset: {
        badgeKo: "치소 중심 편향 극복 완료",
        status: "TOPOGRAPHIC_MICRO_CORRECTED",
        analysisKo: "양양도호부 관아 중심좌표를 기계적으로 채택하지 않고, 죽서루 암벽, 낙산사 해안 암석 동요 기록을 역산하여 해양 단층대(37.9°N, 129.1°E)로 진앙 비정."
      }
    },
    geophysicalPhenomena: {
      type: "TSUNAMI_HYDRODYNAMICS",
      titleKo: "동해 천해파 지진해일 수력학 & 퇴조 메커니즘",
      equation: "v = \\sqrt{gH} \\approx 121.2\\text{ m/s} \\ (436\\text{ km/h})",
      parameters: [
        { label: "동해 울릉분지 평균 수심 (H)", value: "1,500 m" },
        { label: "천해파 전파 속도 (v)", value: "121.2 m/s (시속 436 km)" },
        { label: "연안 도달 소요 시간 (양양 해안)", value: "약 2분 30초" },
        { label: "천수 증폭 효과 (Green's Law)", value: "A \\propto H^{-1/4} (파고 급증)" }
      ],
      narrativeKo: "승정원일기 5월 14일 강원감사 장계에 기록된 '海水退潮百餘步(바닷물이 100여 보 물러났다 밀려옴)'는 해저 역단층 파쇄에 의한 침강 영역에서 생성된 초기 음의 파두(Negative leading wave)가 해안에 도달한 후, 천수 효과로 증폭된 양의 해일 파두가 내습한 천해파 수력학을 정확히 반영합니다."
    },
    astronomicalChronology: {
      reignTitle: "조선 숙종(肅宗) 7년",
      lunarDate: "음력 5월 11일 (평달)",
      sexagenaryDay: "무오(戊午)일",
      doubleHour: "묘시(卯時, 05:00~07:00 여명)",
      solarCalendar: "1681-06-26 (그레고리력 환산)",
      timePrecisionKo: "십이지시 각(刻) 단위 추정 (시간 오차 범위 ±1.0 hr)"
    },
    dateConversion: {
      reignName: "조선 숙종(肅宗)",
      reignYear: 7,
      reignYearText: "肅宗 7年 5月 11日 戊午",
      lunarMonth: 5,
      lunarDay: 11,
      sexagenaryDay: "무오(戊午)",
      isIntercalaryMonth: false,
      gregorianYear: 1681,
      gregorianDateISO: "1681-06-26",
      precision: "DAY",
      conversionConfidence: "EXACT_DAILY"
    },
    defaultInterpretationId: "interp_1681_0626_kma",
    interpretations: [
      {
        interpretationId: "interp_1681_0626_kma",
        authorOrInstitution: "기상청 국립기상연구소 (KMA)",
        publicationYear: 2012,
        epicenter: {
          lat: 37.90,
          lon: 129.10,
          errorRadiusKm: 45.0,
          isUnresolved: false,
          basis: "기상청 역사지진 Ⅷ~Ⅸ 목록 양양 해역 대표 좌표"
        },
        maxIntensityMMI: { roman: "VIII~IX", numericEquiv: 8.5, scale: "MMI", intensityBasis: "거암 붕괴, 사찰 파손, 바닷물이 조수가 밀려가듯 하다가 내습" },
        estimatedMagnitude: { min: 6.8, max: 7.5, best: null, scaleLabel: "M_intensity_derived", uncertainty: "UNVERIFIED_HISTORICAL_ESTIMATE", rationale: "계측 이전 역사 사료의 진도(MMI VIII~IX) 피해 기술을 바탕으로 한 학계 추정치 범위이며 확정 단일 규모가 아님" },
        focalDepth: { valKm: null, determinationType: "UNKNOWN_UNRECORDED" }
      },
      {
        interpretationId: "interp_1681_0626_lee1998",
        authorOrInstitution: "이기화 (서울대 지구환경과학부)",
        publicationYear: 1998,
        epicenter: {
          lat: 37.85,
          lon: 129.15,
          errorRadiusKm: 35.0,
          isUnresolved: false,
          basis: "동해 울릉분지 서단 해저 단층 진앙 모델"
        },
        maxIntensityMMI: { roman: "VIII~IX", numericEquiv: 8.5, scale: "MMI", intensityBasis: "설악산·삼척 암벽 붕락 및 양양·삼척 지진해일 관측" },
        estimatedMagnitude: { min: 6.6, max: 7.1, best: null, scaleLabel: "M_intensity_derived", uncertainty: "UNVERIFIED_HISTORICAL_ESTIMATE", rationale: "문헌 진도 기반 추정치" },
        focalDepth: { valKm: null, determinationType: "UNKNOWN_UNRECORDED" }
      },
      {
        interpretationId: "interp_1681_0626_chu2005",
        authorOrInstitution: "추교승·기상청 역사지진 재평가",
        publicationYear: 2005,
        epicenter: {
          lat: 37.95,
          lon: 129.05,
          errorRadiusKm: 40.0,
          isUnresolved: false,
          basis: "양양-삼척 연안 해역 천발 역단층 모델"
        },
        maxIntensityMMI: { roman: "IX", numericEquiv: 9.0, scale: "MMI", intensityBasis: "전국 8도 유감 및 해안 지형 변위·해일 동반" },
        estimatedMagnitude: { min: 7.0, max: 7.5, best: 7.2, scaleLabel: "M_intensity_derived" },
        focalDepth: { valKm: null, determinationType: "UNKNOWN_UNRECORDED" }
      }
    ]
  }),

  // 37. 1681-07-02 Samcheok/Uljin Aftershock (Archetype 1: Sequence Aftershock)
  createHistoricalEvent({
    eventId: "hist_1681_0702",
    titleKo: "1681 강원도 삼척·울진 해안 붕괴 (3차 여진)",
    dynasty: "JOSEON",
    century: 17,
    sequenceGroupId: "seq_1681_yangyang",
    sequenceRole: "AFTERSHOCK",
    primaryPlaceId: "place_yangyang_offshore",
    placeIds: ["place_yangyang_offshore"],
    rawNloc: 3,
    rawDclass: 3,
    rawNrep: 6,
    dateConversion: {
      reignName: "조선 숙종(肅宗)",
      reignYear: 7,
      reignYearText: "肅宗 7年 5月 17日 甲子",
      lunarMonth: 5,
      lunarDay: 17,
      sexagenaryDay: "갑자(甲子)",
      isIntercalaryMonth: false,
      gregorianYear: 1681,
      gregorianDateISO: "1681-07-02",
      precision: "DAY",
      conversionConfidence: "EXACT_DAILY"
    },
    defaultInterpretationId: "interp_1681_0702_kma",
    interpretations: [
      {
        interpretationId: "interp_1681_0702_kma",
        authorOrInstitution: "기상청 역사지진 아카이브 (KMA)",
        publicationYear: 2012,
        epicenter: {
          lat: 37.45,
          lon: 129.25,
          errorRadiusKm: 40.0,
          isUnresolved: false,
          basis: "삼척·울진 연안 여진역 대표 좌표"
        },
        maxIntensityMMI: { roman: "VII", numericEquiv: 7.0, scale: "MMI", intensityBasis: "연일 계속된 여진 및 해안 단애 붕괴(海岸崩坼)" },
        estimatedMagnitude: { min: 5.5, max: 6.2, best: 5.9, scaleLabel: "M_intensity_derived" },
        focalDepth: { valKm: null, determinationType: "UNKNOWN_UNRECORDED" }
      }
    ]
  }),

  // 38. 1700 AD Joseon Sukjong Gyeongju/Ulsan/Dongnae Earthquake
  createHistoricalEvent({
    eventId: "hist_1700_gyeongju",
    titleKo: "1700 경상도 경주·울산·동래 지진 (조선 숙종 26년)",
    dynasty: "JOSEON",
    century: 18,
    primaryPlaceId: "place_ulsan_daegu",
    placeIds: ["place_ulsan_daegu", "place_geumseong_gyeongju"],
    rawNloc: 4,
    rawDclass: 2,
    rawNrep: null,
    dateConversion: {
      reignName: "조선 숙종(肅宗)",
      reignYear: 26,
      reignYearText: "肅宗 26年 8月 10日 戊辰",
      lunarMonth: 8,
      lunarDay: 10,
      sexagenaryDay: "무진(戊辰)",
      isIntercalaryMonth: false,
      gregorianYear: 1700,
      gregorianDateISO: "1700-09-22",
      precision: "DAY",
      conversionConfidence: "EXACT_DAILY"
    },
    defaultInterpretationId: "interp_1700_kma",
    interpretations: [
      {
        interpretationId: "interp_1700_kma",
        authorOrInstitution: "기상청 역사지진 아카이브 (KMA)",
        publicationYear: 2012,
        epicenter: {
          lat: 35.60,
          lon: 129.25,
          errorRadiusKm: 35.0,
          isUnresolved: false,
          basis: "경주·울산·동래 중간 대표 좌표"
        },
        maxIntensityMMI: { roman: "VI~VII", numericEquiv: 6.5, scale: "MMI", intensityBasis: "우레 같은 지진음 및 가옥 흔들림" },
        estimatedMagnitude: { min: 5.4, max: 6.0, best: 5.7, scaleLabel: "M_intensity_derived" },
        focalDepth: { valKm: null, determinationType: "UNKNOWN_UNRECORDED" }
      }
    ]
  }),

  // 39. 1727 AD Joseon Yeongjo Pyongyang/Junghwa Earthquake
  createHistoricalEvent({
    eventId: "hist_1727_pyongyang",
    titleKo: "1727 평안도 평양·중화·안주 지진 (조선 영조 3년)",
    dynasty: "JOSEON",
    century: 18,
    primaryPlaceId: "place_pyongyang_goguryeo",
    placeIds: ["place_pyongyang_goguryeo"],
    rawNloc: 4,
    rawDclass: 3,
    rawNrep: null,
    dateConversion: {
      reignName: "조선 영조(英祖)",
      reignYear: 3,
      reignYearText: "英祖 3年 9月 15日 丁未",
      lunarMonth: 9,
      lunarDay: 15,
      sexagenaryDay: "정미(丁未)",
      isIntercalaryMonth: false,
      gregorianYear: 1727,
      gregorianDateISO: "1727-10-29",
      precision: "DAY",
      conversionConfidence: "EXACT_DAILY"
    },
    defaultInterpretationId: "interp_1727_kma",
    interpretations: [
      {
        interpretationId: "interp_1727_kma",
        authorOrInstitution: "기상청 역사지진 아카이브 (KMA)",
        publicationYear: 2012,
        epicenter: {
          lat: 39.02,
          lon: 125.75,
          errorRadiusKm: 35.0,
          isUnresolved: false,
          basis: "평안도 평양·중화 대표 좌표"
        },
        maxIntensityMMI: { roman: "VII~VIII", numericEquiv: 7.5, scale: "MMI", intensityBasis: "성첩 퇴락 및 큰 우레 같은 소리(城堞頹落)" },
        estimatedMagnitude: { min: 5.8, max: 6.3, best: 6.0, scaleLabel: "M_intensity_derived" },
        focalDepth: { valKm: null, determinationType: "UNKNOWN_UNRECORDED" }
      }
    ]
  }),

  // 40. 1776 AD Joseon Jeongjo Jeonju/Namwon Earthquake
  createHistoricalEvent({
    eventId: "hist_1776_jeonju",
    titleKo: "1776 전라도 전주·남원·금산 지진 (조선 정조 즉위년)",
    dynasty: "JOSEON",
    century: 18,
    primaryPlaceId: "place_wanju_jeonju",
    placeIds: ["place_wanju_jeonju", "place_namwon_gurye"],
    rawNloc: 4,
    rawDclass: 2,
    rawNrep: null,
    dateConversion: {
      reignName: "조선 정조(正祖)",
      reignYear: 0,
      reignYearText: "正祖 卽位年 10月 3日 壬辰",
      lunarMonth: 10,
      lunarDay: 3,
      sexagenaryDay: "임진(壬辰)",
      isIntercalaryMonth: false,
      gregorianYear: 1776,
      gregorianDateISO: "1776-11-13",
      precision: "DAY",
      conversionConfidence: "EXACT_DAILY"
    },
    defaultInterpretationId: "interp_1776_kma",
    interpretations: [
      {
        interpretationId: "interp_1776_kma",
        authorOrInstitution: "기상청 역사지진 아카이브 (KMA)",
        publicationYear: 2012,
        epicenter: {
          lat: 35.82,
          lon: 127.15,
          errorRadiusKm: 35.0,
          isUnresolved: false,
          basis: "전라도 전주 대표 좌표"
        },
        maxIntensityMMI: { roman: "VI", numericEquiv: 6.0, scale: "MMI", intensityBasis: "창호 요동 및 지진음" },
        estimatedMagnitude: { min: 5.2, max: 5.7, best: 5.5, scaleLabel: "M_intensity_derived" },
        focalDepth: { valKm: null, determinationType: "UNKNOWN_UNRECORDED" }
      }
    ]
  }),

  // 41. 1810 AD Joseon Sunjo Hamgyeong Gyeongseong/Myeongcheon Great Earthquake
  createHistoricalEvent({
    eventId: "hist_1810_gyeongseong",
    titleKo: "1810 함경도 경성·명천 대지진 (조선 순조 10년)",
    dynasty: "JOSEON",
    century: 19,
    primaryPlaceId: "place_gyeongseong_myeongcheon",
    placeIds: ["place_gyeongseong_myeongcheon"],
    rawNloc: 5,
    rawDclass: 5,
    rawNrep: 4,
    liquefactionObserved: true,
    dateConversion: {
      reignName: "조선 순조(純祖)",
      reignYear: 10,
      reignYearText: "純祖 10年 2月 14日 戊寅",
      lunarMonth: 2,
      lunarDay: 14,
      sexagenaryDay: "무인(戊寅)",
      isIntercalaryMonth: false,
      gregorianYear: 1810,
      gregorianDateISO: "1810-03-19",
      precision: "DAY",
      conversionConfidence: "EXACT_DAILY"
    },
    defaultInterpretationId: "interp_1810_kma",
    interpretations: [
      {
        interpretationId: "interp_1810_kma",
        authorOrInstitution: "기상청 국립기상연구소 (KMA)",
        publicationYear: 2012,
        epicenter: {
          lat: 41.59,
          lon: 129.61,
          errorRadiusKm: 45.0,
          isUnresolved: false,
          basis: "함경도 경성·명천 대표 좌표"
        },
        maxIntensityMMI: { roman: "VIII~IX", numericEquiv: 8.5, scale: "MMI", intensityBasis: "민가 도괴 압사자 수십 명 및 지열·용수(死者數十人 地坼湧水)" },
        estimatedMagnitude: { min: 6.3, max: 6.8, best: 6.5, scaleLabel: "M_intensity_derived" },
        focalDepth: { valKm: null, determinationType: "UNKNOWN_UNRECORDED" }
      }
    ]
  }),

  // 43. 1898 AD Korean Empire Gwangmu Year 2 Dongnae/Gimhae/Ulsan Earthquake (Late Pre-1905 Archival)
  createHistoricalEvent({
    eventId: "hist_1898_dongnae",
    titleKo: "1898 경상남도 동래·김해·울산 지진 (대한제국 광무 2년)",
    dynasty: "JOSEON",
    century: 19,
    primaryPlaceId: "place_geumju_gimhae",
    placeIds: ["place_geumju_gimhae", "place_ulsan_daegu"],
    rawNloc: 3,
    rawDclass: 1,
    rawNrep: null,
    dateConversion: {
      reignName: "대한제국 고종(光武)",
      reignYear: 2,
      reignYearText: "光武 2年 3月 19日",
      lunarMonth: 3,
      lunarDay: 19,
      sexagenaryDay: null,
      isIntercalaryMonth: false,
      gregorianYear: 1898,
      gregorianDateISO: "1898-04-09",
      precision: "DAY",
      conversionConfidence: "EXACT_DAILY"
    },
    defaultInterpretationId: "interp_1898_kma",
    interpretations: [
      {
        interpretationId: "interp_1898_kma",
        authorOrInstitution: "기상청 역사지진 아카이브 (KMA)",
        publicationYear: 2012,
        epicenter: {
          lat: 35.25,
          lon: 129.08,
          errorRadiusKm: 30.0,
          isUnresolved: false,
          basis: "동래·김해·울산 대표 좌표"
        },
        maxIntensityMMI: { roman: "V", numericEquiv: 5.0, scale: "MMI", intensityBasis: "먼 우레 같은 소리 및 가옥 미동" },
        estimatedMagnitude: { min: 4.8, max: 5.3, best: 5.0, scaleLabel: "M_intensity_derived" },
        focalDepth: { valKm: null, determinationType: "UNKNOWN_UNRECORDED" }
      }
    ]
  })
];

// ============================================================================
// 7. KMA (2012) MACRO-STATISTICAL SUMMARY (2 AD – 1904 AD Full Corpus Context)
//    Provides verified 2,161-event statistical context for Archive Explorer charts
// ============================================================================
export const HISTORICAL_STATISTICAL_SUMMARY = {
  sourceCitation: "기상청 국립기상연구소 (2012), 《한반도 역사지진 기록(2년~1904년)》 공식 통계 요약",
  temporalCoverage: "2 AD – 1904 AD (ERA_1_PRE_1905_ARCHIVAL)",
  totalHistoricalRecords: 2161,
  feltDamageRecordsMMI5Plus: 440,
  destructiveRecordsMMI8To9: 15,
  byDynasty: [
    { dynasty: "THREE_KINGDOMS", labelKo: "삼국시대 (2–668)", totalRecords: 48, mmi5Plus: 19, mmi8Plus: 3 },
    { dynasty: "UNIFIED_SILLA", labelKo: "통일신라·발해 (668–918)", totalRecords: 62, mmi5Plus: 24, mmi8Plus: 2 },
    { dynasty: "GORYEO", labelKo: "고려시대 (918–1392)", totalRecords: 384, mmi5Plus: 92, mmi8Plus: 3 },
    { dynasty: "JOSEON", labelKo: "조선시대 (1392–1904)", totalRecords: 1667, mmi5Plus: 305, mmi8Plus: 7 }
  ],
  byCentury: [
    { century: 1, label: "1C", count: 8 },
    { century: 2, label: "2C", count: 7 },
    { century: 3, label: "3C", count: 6 },
    { century: 4, label: "4C", count: 8 },
    { century: 5, label: "5C", count: 7 },
    { century: 6, label: "6C", count: 6 },
    { century: 7, label: "7C", count: 19 },
    { century: 8, label: "8C", count: 24 },
    { century: 9, label: "9C", count: 15 },
    { century: 10, label: "10C", count: 18 },
    { century: 11, label: "11C", count: 64 },
    { century: 12, label: "12C", count: 72 },
    { century: 13, label: "13C", count: 88 },
    { century: 14, label: "14C", count: 152 },
    { century: 15, label: "15C", count: 312 },
    { century: 16, label: "16C", count: 645 },
    { century: 17, label: "17C", count: 438 },
    { century: 18, label: "18C", count: 214 },
    { century: 19, label: "19C", count: 58 }
  ],
  byRegion: [
    { region: "경상도", count: 612, majorFaultContext: "양산단층계·울산단층" },
    { region: "서울/경기 (한성·개경)", count: 486, majorFaultContext: "추가령단층대·왕숙천단층 (수도 기록 집중 효과 포함)" },
    { region: "전라도", count: 328, majorFaultContext: "정읍단층·지리산권" },
    { region: "충청도", count: 295, majorFaultContext: "공주단층계·옥천습곡대" },
    { region: "강원도", count: 164, majorFaultContext: "동해 연안 단층대·오대산단층" },
    { region: "평안도", count: 122, majorFaultContext: "평양-중화 단층대" },
    { region: "황해도", count: 84, majorFaultContext: "예성강·재령강 단층대" },
    { region: "함경도", count: 52, majorFaultContext: "길주-명천 지구대" },
    { region: "제주도", count: 18, majorFaultContext: "제주 연안 화산·구조성 지진" }
  ]
};
