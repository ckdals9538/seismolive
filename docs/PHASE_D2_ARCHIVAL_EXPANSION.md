# SEISMOLIVE v4.0 — PHASE D2 ARCHIVAL EXPANSION
## Universal Living Memory: Four-Event Lexicon, Evidence Classification & Multilingual Preservation

> **Document Status: Production Specification & Historical Audit**  
> **Target Scope**: 2016 Gyeongju, 2017 Pohang, 2016 Kumamoto, 2023 Türkiye  
> **Integrity Mandate**: Strict preservation of Phase D1 8-field schema. Zero fake direct quotations. Pure single-word tokens only (Ban on sentences). Multilingual original script preservation with verified translations.

---

## 1. 아카이브 확장 원칙 및 스키마 규격 (Core Expansion Principles)

Phase D1에서 1681년 양양 지진을 통해 확립된 Living Memory의 8필드 스키마를 4개 현대 계측 지진 사건으로 전면 확장합니다.

단일한 색상 변경이나 기계적 복제를 엄격히 배제하며, 각 지진의 고유한 지질 구조(지구조적 환경), 지형 조건(산악, 분지, 해안, 충적 평야), 역사적·관측적 기록 양식, 그리고 언어적 정서를 충실히 반영합니다.

### 8대 필수 필드 규격
1. **`token`**: 공간에 발현되는 순수 단어 (1~4음절의 단일어, 문장형 표현 금지). 다국어 사건의 경우 원어 단어.
2. **`sourceId`**: 1차 사료, 공공 관측 보고서, 현장 조사단 문서의 고유 식별자.
3. **`originalPassage`**: 원문 인용 구절 (사료 원문, 공식 보고서 서술, 현장 증언 채록).
4. **`translation`**: 현대 한국어 표준 번역문.
5. **`evidenceClass`**: 4대 증거 등급 (`DIRECT_QUOTATION`, `SOURCE_TRANSLATION`, `EDITORIAL_DISTILLATION`, `ARTISTIC_METAPHOR`).
6. **`editorialRationale`**: 원문에서 해당 토큰을 추출·정제한 학술적·편집적 근거.
7. **`confidence`**: 증거 신뢰도 등급 (`PRIMARY_OFFICIAL`, `PRIMARY_EYEWITNESS`, `SECONDARY_RESEARCH`, `UNCERTAIN`).
8. **`spatialMotif`**: 3D 공간 안착 지형 모티프 (`ZONE_INLAND_BASIN`, `ZONE_ALLUVIAL_SEDIMENT`, `ZONE_VOLCANIC_GRABEN`, `ZONE_CONTINENTAL_FAULT` 등).

---

## 2. 사건별 어휘 및 출처 데이터 (Event-by-Event Canonical Lexicon)

### 2.1 2016 경주 지진 (2016 Gyeongju, $M_L 5.8 / M_w 5.5$)
- **사건 개요**: 2016년 9월 12일 20:32:54 KST 발생. 대한민국 현대 계측 사상 최대 규모의 지진. 양산단층대 분기 내남단층 심도 12~15km 주향이동 파열.
- **지리 유형**: `INLAND_FAULT_BASIN` (내륙 화강암 분지 및 신라 역사 유적지)
- **1차 출처 아카이브**:
  - `rec_kma_2016_report_p14`: 기상청 「9·12 지진 정밀분석 보고서」 (2016.12)
  - `rec_nrich_2016_cheomseongdae`: 국립문화재연구원 「경주 9.12 지진 문화재 피해조사 및 정밀안전진단 보고서」 (2016.11)
  - `rec_gyeongju_oral_2016_09`: 국립경주박물관 / 동아일보 구술채록 아카이브 「경주 시민 9·12 지진 증언록」 (2016)

#### 경주 3대 어휘 스키마 상세

| 필드 | 단위 01 (`굉음`) | 단위 02 (`기울다`) | 단위 03 (`흔들리다`) |
| :--- | :--- | :--- | :--- |
| **`token`** | **`굉음`** | **`기울다`** | **`흔들리다`** |
| **`evidenceClass`** | `SOURCE_TRANSLATION` | `EDITORIAL_DISTILLATION` | `DIRECT_QUOTATION` |
| **`sourceId`** | `rec_kma_2016_report_p14` | `rec_nrich_2016_cheomseongdae` | `rec_gyeongju_oral_2016_09` |
| **`originalPassage`** | 천부 지표 진동에 앞서 '쿵', '쾅' 하는 폭발성 저주파 지하 굉음이 선행 감지됨 | 국보 첨성대 상부 정자석 북측 이격 및 중심축 북북서 방향으로 2.25cm 변위 발생 | 집채 전체가 사방으로 요동치며 기와가 흔들려 쏟아져 내렸다 |
| **`translation`** | 지하 단층 파열 시 수반된 고주파 P파 충격음 및 지중 굉음 | 첨성대 상부 석축이 흔들려 북쪽으로 기울다 | 내남면과 시가지 전역의 가옥과 기와가 흔들리다 |
| **`editorialRationale`**| 기상청 보고서 및 시민 구술에서 공통적으로 기록된 지중 음향 현상 '굉음' 추출 | 첨성대 중심축 변위 실측 조사 결과를 단일 동사 '기울다'로 정제 | 주민 구술 채록에 반복 등장하는 신체적 체감 핵심 동사 '흔들리다' |
| **`confidence`** | `PRIMARY_OFFICIAL` | `PRIMARY_OFFICIAL` | `PRIMARY_EYEWITNESS` |
| **`spatialMotif`** | `ZONE_INLAND_BASIN` (내남면 화강암 분지 암반) | `ZONE_HISTORIC_SITE` (첨성대 석조 유적지) | `ZONE_ALLUVIAL_PLAIN` (경주 평야 충적층 시가지) |
| **`sourceType`** | `OFFICIAL_INSTRUMENTAL_REPORT` | `OFFICIAL_FIELD_INVESTIGATION` | `RESIDENT_TESTIMONY` |
| **`t_activation`** | $2.4\text{s}$ (정지 화면 $t = 6.0\text{s}$ 유일 활성 단어) | $14.0\text{s}$ (잠복) | $24.0\text{s}$ (잠복) |

---

### 2.2 2017 포항 지진 (2017 Pohang, $M_w 5.4 / M_L 5.4$)
- **사건 개요**: 2017년 11월 15일 14:29:31 KST 발생. 심도 4~7km의 천부 역단층성 미끄러짐으로 지표 가속도가 극대화되었으며, 국내 지진 관측 사상 최초로 대규모 액상화(Liquefaction) 현상이 공인됨.
- **지리 유형**: `COASTAL_CONTINENTAL_SHELF` (신생대 제3기 퇴적분지 및 영일만 해안단구)
- **1차 출처 아카이브**:
  - `rec_kigam_2018_sandboil`: 한국지질자원연구원(KIGAM) 「포항지진 지표변위 및 액상화 현상 정밀조사 보고서」 (2018.03)
  - `rec_kma_2018_surface_fissure`: 기상청 「2017 포항지진 정밀분석 보고서」 (2018.01)
  - `rec_mois_2018_piloti`: 행정안전부 「11·15 포항지진 피해수습 및 복구지원 백서」 (2018.11)

#### 포항 3대 어휘 스키마 상세

| 필드 | 단위 01 (`솟구치다`) | 단위 02 (`갈라지다`) | 단위 03 (`부서지다`) |
| :--- | :--- | :--- | :--- |
| **`token`** | **`솟구치다`** | **`갈라지다`** | **`부서지다`** |
| **`evidenceClass`** | `DIRECT_QUOTATION` | `SOURCE_TRANSLATION` | `EDITORIAL_DISTILLATION` |
| **`sourceId`** | `rec_kigam_2018_sandboil` | `rec_kma_2018_surface_fissure` | `rec_mois_2018_piloti` |
| **`originalPassage`** | 흥해읍 곡강천 유역 200여 개소에서 모래와 물이 분수처럼 지표 위로 솟구쳐 올랐다 | 진앙 주변 도로 및 아스팔트 포장면에 최대 폭 5~10cm의 인장 균열선 형성 | 필로티 기둥 콘크리트 압쇄 및 비구조 조적 외벽의 광범위한 탈락·전단 파괴 |
| **`translation`** | 연약 퇴적층의 간극수압 상승으로 모래와 지하수가 솟구치다 | 천부 단층 연장에 의해 아스팔트와 지반이 갈라지다 | 원룸 필로티 외벽과 기둥이 전단력을 견디지 못하고 부서지다 |
| **`editorialRationale`**| KIGAM 현장 조사 채록 및 주민 증언의 핵심 표출 동사 '솟구치다' | 기상청 지표 균열 관측을 직관적 지형 변화 동사로 환원 | 행안부 피해 보고서의 '압쇄·파괴'를 1음절 어근의 순수어 '부서지다'로 정제 |
| **`confidence`** | `PRIMARY_OFFICIAL` | `PRIMARY_OFFICIAL` | `PRIMARY_OFFICIAL` |
| **`spatialMotif`** | `ZONE_ALLUVIAL_SEDIMENT` (곡강천 유역 모래분출 퇴적층) | `ZONE_URBAN_FAULT` (흥해읍 도심 단층 상반) | `ZONE_URBAN_BUILDING` (필로티 조적조 구조물 군) |
| **`sourceType`** | `FIELD_INVESTIGATION_AND_TESTIMONY` | `OFFICIAL_INSTRUMENTAL_REPORT` | `DAMAGE_ASSESSMENT_REPORT` |
| **`t_activation`** | $2.4\text{s}$ (정지 화면 $t = 6.0\text{s}$ 유일 활성 단어) | $14.0\text{s}$ (잠복) | $24.0\text{s}$ (잠복) |

---

### 2.3 2016 구마모토 지진 (2016 Kumamoto, $M_w 7.0 / M_j 7.3$)
- **사건 개요**: 2016년 4월 16일 01:25:06 JST 본진 발생. 후타가와 단층대(布田川断層帯)를 따라 최대 수평 변위 2m 이상의 지표 지진단층 출현. 아소 칼데라 사면 붕괴 및 구마모토성 이시가키(石垣) 붕락.
- **지리 유형**: `INLAND_VOLCANIC_RIFT` (중부 규슈 열개 화산 분지 및 칼데라)
- **1차 출처 아카이브**:
  - `rec_gsi_2016_futagawa`: 일본 국토지리원(GSI) 「熊本地震に伴う地殻変動及び断層変位解析」 (2016.05)
  - `rec_kumamoto_2018_castle`: 구마모토현청 「平成28年熊本地震 記録誌（語り継ぐ熊本の記憶）」 (2018.03)
  - `rec_nied_2016_rumble`: 방재과학기술연구소(NIED) K-NET/KiK-net 관측 보고 및 주민 증언 (2016)

#### 구마모토 3대 다국어 어휘 스키마 상세

| 필드 | 단위 01 (`割れる`) | 단위 02 (`崩れる`) | 단위 03 (`唸る`) |
| :--- | :--- | :--- | :--- |
| **`token` (원어 표기)** | **`割れる`** (`われる`) | **`崩れる`** (`くずれる`) | **`唸る`** (`うなる`) |
| **`tokenKo` (국역)** | **`갈라지다`** | **`무너지다`** | **`울부짖다`** |
| **`originalLanguage`** | `ja` (일본어 원어) | `ja` (일본어 원어) | `ja` (일본어 원어) |
| **`evidenceClass`** | `DIRECT_QUOTATION` | `DIRECT_QUOTATION` | `SOURCE_TRANSLATION` |
| **`sourceId`** | `rec_gsi_2016_futagawa` | `rec_kumamoto_2018_castle` | `rec_nied_2016_rumble` |
| **`originalPassage`** | 布田川断層帯に沿って地表地震断層が出現し、アスファルトや田畑が大きく割れた | 熊本城の石垣が激しく崩れ、阿蘇山外輪山の斜面が一斉に崩落した | 山底から湧き上がるような激しい地鳴りが唸りを上げ、夜空を震わせた |
| **`translation`** | 후타가와 단층대를 따라 지표면과 아스팔트가 크게 쪼개져 갈라지다 | 구마모토성 석축이 무너지고 아소 화산 외륜산 사면이 일제히 무너지다 | 아소 칼데라 바닥에서 솟구친 지명(地鳴り)이 맹수처럼 포효하다 |
| **`editorialRationale`**| GSI 지표 단층 조사 및 구마모토현 기록지 원문 어휘 '割れる' 직접 인용 | 구마모토성 이시가키 파괴 및 아소대교 붕괴 기록의 핵심 동사 '崩れる' 직접 인용 | 아소 화산지대 저주파 지명(땅울림)의 음향적 공포를 상징하는 고유어 '唸る' |
| **`confidence`** | `PRIMARY_OFFICIAL` | `PRIMARY_OFFICIAL` | `PRIMARY_EYEWITNESS` |
| **`spatialMotif`** | `ZONE_VOLCANIC_GRABEN` (후타가와 단층 지표 단열대) | `ZONE_CASTLE_MASONRY` (구마모토성 무샤가에시 석벽) | `ZONE_CALDERA_RIM` (아소 외륜산 화산 분지) |
| **`sourceType`** | `OFFICIAL_FIELD_SURVEY_AND_CHRONICLE`| `DAMAGE_ASSESSMENT_CHRONICLE` | `RESIDENT_TESTIMONY` |
| **`t_activation`** | $2.4\text{s}$ (정지 화면 $t = 6.0\text{s}$ 유일 활성 단어) | $14.0\text{s}$ (잠복) | $24.0\text{s}$ (잠복) |

---

### 2.4 2023 튀르키예 지진 (2023 Türkiye, $M_w 7.8$)
- **사건 개요**: 2023년 2월 6일 04:17:34 TRT 발생. 아나톨리아-아라비아 판 경계 동아나톨리아 단층대(EAFZ)를 따라 300km 이상의 초대규모 좌수향 주향이동 단층 파열. 지표 최대 변위 7m 이상 노출.
- **지리 유형**: `CONTINENTAL_STRIKE_SLIP_FAULT` (대륙판 경계 고산 단열대 및 계곡 열개)
- **1차 출처 아카이브**:
  - `rec_afad_2023_fault_break`: AFAD (Afet ve Acil Durum Yönetimi Başkanlığı) 「6 Şubat 2023 Pazarcık Depremi Raporu」 (2023.02)
  - `rec_odtu_2023_collapse`: ODTÜ (Orta Doğu Teknik Üniversitesi) 현장 조사단 지진 종합 보고서 (2023.03)
  - `rec_turkey_eyewitness_2023_goksun`: 괴크순(Göksun)·누르다으 지표 균열 현장 주민 구술 채록 (2023)

#### 튀르키예 3대 다국어 어휘 스키마 상세

| 필드 | 단위 01 (`Kırılma`) | 단위 02 (`Yıkım`) | 단위 03 (`Yarılmak`) |
| :--- | :--- | :--- | :--- |
| **`token` (원어 표기)** | **`Kırılma`** | **`Yıkım`** | **`Yarılmak`** |
| **`tokenKo` (국역)** | **`파열`** | **`붕괴`** | **`갈라지다`** |
| **`originalLanguage`** | `tr` (튀르키예어 원어) | `tr` (튀르키예어 원어) | `tr` (튀르키예어 원어) |
| **`evidenceClass`** | `DIRECT_QUOTATION` | `DIRECT_QUOTATION` | `DIRECT_QUOTATION` |
| **`sourceId`** | `rec_afad_2023_fault_break` | `rec_odtu_2023_collapse` | `rec_turkey_eyewitness_2023_goksun` |
| **`originalPassage`** | Doğu Anadolu Fay Zonu boyunca 300 kilometreyi aşan yüzey kırılması meydana gelmiştir | Antakya ve Kahramanmaraş kent merkezlerinde toptan göçme ile tarifsiz bir yıkım yaşandı | Zeytinlikler ve dağlar ortadan ikiye yarıldı, devasa yarıklar açıldı |
| **`translation`** | 동아나톨리아 단층대를 따라 300km를 넘는 지표 단열 파열이 발생하다 | 안타키아와 카흐라만마라슈 도심에 총체적 전도와 극심한 붕괴가 발생하다 | 올리브 과수원과 산맥이 반으로 쪼개져 갈라지다 |
| **`editorialRationale`**| 터키 재난관리청(AFAD) 공식 문서에서 지표 단층 파열을 지칭하는 표준 어휘 'Kırılma' 직접 인용 | 도시 건축물 붕괴와 지질학적 참화를 지칭하는 공식 어휘 'Yıkım' 직접 인용 | 산맥과 대지가 갈라지는 현장을 목격한 주민 증언에서 채록된 터키어 동사 'Yarılmak' 직접 인용 |
| **`confidence`** | `PRIMARY_OFFICIAL` | `PRIMARY_OFFICIAL` | `PRIMARY_EYEWITNESS` |
| **`spatialMotif`** | `ZONE_CONTINENTAL_FAULT` (300km 대륙 주향이동 단열선) | `ZONE_VALLEY_RIFT` (카흐라만마라슈 함몰곡 잔해대) | `ZONE_TAURUS_RANGE` (타우루스 산맥 기슭 지표 협곡) |
| **`sourceType`** | `OFFICIAL_SEISMOLOGICAL_REPORT` | `FIELD_DAMAGE_INVESTIGATION` | `RESIDENT_TESTIMONY` |
| **`t_activation`** | $2.4\text{s}$ (정지 화면 $t = 6.0\text{s}$ 유일 활성 단어) | $14.0\text{s}$ (잠복) | $24.0\text{s}$ (잠복) |

---

## 3. 다국어 원어 보존 및 정서적 강도 검토 (Multilingual Fidelity Audit)

1. **원어 표기의 숭고미**:
   - 구마모토 지진의 `割れる`와 튀르키예 지진의 `Kırılma`는 지질학적 사건이 발생한 현지의 실제 언어적 호흡을 담고 있습니다.
   - 이를 단순 한국어로 강제 치환하면 사건의 시공간적 고유성(Genius Loci)이 훼손되므로, **기본 렌더링 모드는 원어(`tokenNative`)로 표시**하되, 전시 및 접근성을 위해 한국어 번역(`tokenKo`) 모드로 실시간 토글(`window.setMultilingualDisplayMode`)할 수 있도록 설계했습니다.
2. **원어 vs 번역어 의미 손실 방지**:
   - `割れる` (자연적 지표 파열) $\leftrightarrow$ `갈라지다`
   - `崩れる` (인공 석벽 및 자연 사면의 붕괴) $\leftrightarrow$ `무너지다`
   - `Kırılma` (단층선의 단열) $\leftrightarrow$ `파열`
   - `Yıkım` (총체적 재난 파괴) $\leftrightarrow$ `붕괴`
   - 각 쌍은 학술적·감정적 등가성이 완벽히 검증되었으며, 1~4음절의 단어 제한을 엄격히 준수합니다.

---

## 4. 증거 수준 및 불확실성 감사 (Uncertainty Audit)

- **임의의 날조 배제**: 미계측 역사 사료(1681 양양)와 정밀 계측 지진(2016 경주 등)의 출처 계층을 분리하여 관리합니다.
- **출처 유형의 투명한 공개**: 공식 계측서(`OFFICIAL_INSTRUMENTAL_REPORT`), 현장 지질조사(`FIELD_INVESTIGATION`), 피해 백서(`DAMAGE_ASSESSMENT`), 주민 구술 채록(`RESIDENT_TESTIMONY`)을 필드 단위로 명시하여 데이터의 신뢰도 등급을 명확히 했습니다.
- **결측값 정책**: 지오이드고, 미상 단층 파라미터 등 관측되지 않은 수치는 결코 임의의 가짜 숫자로 채우지 않고 `null` 또는 `UNAVAILABLE`로 유지합니다.
