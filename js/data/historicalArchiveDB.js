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
      { token: "二十一年 秋八月 地震", displayKo: "유리명왕 21년 가을 8월에 지진이 일어났다", category: "phenomenon", archetype: "RESONANCE", stageZone: "ZONE_B_INLAND", language: "ko-KR-archival", translation: "유리명왕 21년(서기 2년) 가을 8월에 지진이 일어났다" }
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
  { linkId: "lnk_1898", eventId: "hist_1898_dongnae", recordId: "rec_sjw_1898", relationType: "PRIMARY_CHRONICLE" }
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

  return {
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
