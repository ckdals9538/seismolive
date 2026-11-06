# SEISMOLIVE v4.0 — PHASE D FIRST PROTOTYPE REPORT
## 1681 Yangyang · Living Memory Spatial Prototype Acceptance & Lookdev Audit

> **Executive Summary & Baseline Status**
> - **Phases A, B, C Frozen**: WGS84 3-Tier Earth Foundation (A), Universal Earthquake Adaptation (B), and Universal 3D Vector Wavefield ($u = u_P + u_S + u_R$) Engine (C) are strictly preserved with zero regression.
> - **사료 어휘 4분류 교정 완료**: 1681년 양양 어휘 4개(`퇴조`, `울다`, `드러나다`, `무너지다`)에 대해 8개 필수 메타데이터 필드를 완전히 부여하고, 가짜 직접 인용(Fake Direct Quotation) 및 문장형 텍스트를 전면 제거하였습니다.
> - **정지 화면(Still Frame) 중심 공간 위계 확립**: $t = 6.0\text{s}$ 기준 단 하나의 핵심 의미 단어인 `퇴조`만 화면에 형성되도록 시차 활성화($t_{\text{act}} = 3.2, 14.5, 23.0, 31.0\text{s}$)를 설계하여 문자 난립(Word Clutter)을 방지하고 동해 해안붕단 여백의 숭고미를 구현했습니다.
> - **Dark Ambient Cushion(소프트 가우시안 차폐) 검증**: 조잡한 검은 외곽선 스트로크(`strokeText`)를 완전히 폐기하고, 글리프 배면에 $40\%$ 반경의 가우시안 알파 감쇄 쿠션을 적용하여 야간 심해 수면 위에서 광학적 자연스러움과 가독성을 동시 달성했습니다.
> - **검증 통과 현황**: 단위 테스트 **251개 전항 PASS** (0 FAIL), Chrome Headless CDP 실사 **19개 항목 PASS** (0 FAIL), 8종 고해상도 시각 자산(1920×993) 수집 완료.

---

## 1. 사료 어휘 분류 정밀 교정 (Archival Lexicon Reclassification)

1681년 6월 26일(음력 5월 11일~14일) 강원도 양양·삼척·통천 지진 및 동해안 쓰나미 기록에서 추출된 4개 어휘에 대해, 사료의 성격과 번역 계통을 엄격히 구분하여 4대 범주(`DIRECT_QUOTATION`, `SOURCE_TRANSLATION`, `EDITORIAL_DISTILLATION`, `ARTISTIC_METAPHOR`)로 재분류했습니다.

모든 토큰은 문장형 표현을 배제한 **1~4음절의 순수 단어**로 제한되었으며, 8개 필수 필드가 누락 없이 보존되었습니다.

### 1681 양양 4대 어휘 공인 스키마 (8개 필수 필드)

| 필드 | 단위 01 (`퇴조`) | 단위 02 (`울다`) | 단위 03 (`드러나다`) | 단위 04 (`무너지다`) |
| :--- | :--- | :--- | :--- | :--- |
| **`token`** | **`퇴조`** | **`울다`** | **`드러나다`** | **`무너지다`** |
| **`evidenceClass`** | `DIRECT_QUOTATION` | `SOURCE_TRANSLATION` | `EDITORIAL_DISTILLATION` | `SOURCE_TRANSLATION` |
| **`sourceId`** | `rec_sjw_1681_0514` | `rec_sillok_1681_0626` | `rec_sjw_1681_0514` | `rec_sillok_1681_0626` |
| **`originalPassage`** | `海水退潮百餘步` | `聲如雷 ... 山岳震動` | `海水退潮百餘步 露出` | `巨巖崩壞 巖石崩頹` |
| **`translation`** | 바닷물이 백여 보 물러갔다가 밀려왔다 | 소리가 우레와 같고 산이 울고 땅이 진동하였으며 | 바닷물이 물러나 바다 밑이 드러났다 | 큰 바위가 무너져 내리고 돌이 떨어졌다 |
| **`editorialRationale`**| 승정원일기 원문 한자어 `退潮`의 직접 음독 인용 | 실록의 `山岳震動`·`聲如雷` 공인 번역어 '산이 울고'에서 동사 추출 | 승정원일기 `海水退潮百餘步 露出` 현상의 편집적 압축 정제어 | 실록의 `崩壞`·`崩頹` 공인 번역 '무너져 내리다'의 동사 원형 |
| **`confidence`** | `HIGH_PRIMARY_CHRONICLE` | `HIGH_PRIMARY_CHRONICLE` | `HIGH_PRIMARY_CHRONICLE` | `HIGH_PRIMARY_CHRONICLE` |
| **`spatialMotif`** | `ZONE_OCEAN_SHELF` (동해 대륙붕 수면) | `ZONE_ALPINE_RIDGE` (설악산 능선 공명) | `ZONE_COASTAL_BLUFF` (양양 해안단애 조간대) | `ZONE_ALPINE_RIDGE` (대청봉 화강암 단애) |

---

## 2. 1681 양양 정지 화면 (Still Frame First)

### 미술관 갤러리 수준의 정지 화면 ($t = 6.0\text{s}$, Cushion Active)
단일 단어 `퇴조`가 동해 심해 수면과 설악산 산맥 실루엣 사이에 고요히 부유하며, 사료에 기록된 해수 후퇴의 원초적 공포와 정적을 전달합니다.

![1681 Yangyang Still Frame with Cushion](../captures/phase_d_01_yangyang_still_frame_with_cushion.png)

### 화면 구도 및 미학적 분석
1. **시각적 위계의 절대적 고립 (Zero Clutter)**:
   - $t = 6.0\text{s}$ 시점에서 화면상에 유일하게 가시화된 단어는 `퇴조`뿐입니다.
   - `울다`($t_{\text{act}} = 14.5\text{s}$), `드러나다`($t_{\text{act}} = 23.0\text{s}$), `무너지다`($t_{\text{act}} = 31.0\text{s}$)는 완전한 잠복(`LATENT`, $\alpha = 0.0$) 상태를 유지합니다.
   - 단어가 동시에 쏟아져 나오지 않으므로 관람객의 시선이 분산되지 않고, 광막한 밤바다 위에 맺힌 단 하나의 역사적 증언에 침잠하게 됩니다.
2. **지형과 단어의 공간적 공명 (Continuous Spatial World)**:
   - `퇴조` 글리프는 2D HUD 카드나 오버레이 UI가 아닌, WGS84 ECEF 로컬 탄젠트 좌표계 상의 실제 동해 대륙붕 상공($X = -0.055, Z = 0.035$, 고도 $Y = +0.038$)에 3차원 빌보드로 위치합니다.
   - 좌측 하단 칠흑 같은 동해 해구와 우측 상단 설악산 화강암 산맥 능선 사이의 대각선 시선 유도선 상에 정확히 안착하여 대지의 침식과 바다의 흔들림을 연결합니다.
3. **여백(餘白)과 숭고미(Sublime)**:
   - 화면의 $85\%$ 이상이 어둡고 묵직한 모노리스 톤의 음영과 안개로 채워져 있으며, 인위적인 레이저 기둥이나 네온 박스가 일체 배제되었습니다.
   - 백자(白磁)의 담백함을 닮은 미색(#f5f8fc) 명조 서체(Nanum Myeongjo / Noto Serif KR)가 은은한 청백색 후광(#c8e8fc, $\alpha = 0.12$)과 결합되어 한 폭의 수묵 실경산수화와 같은 정서를 형성합니다.

---

## 3. Dark Ambient Cushion 비교 검증 (Optical Cushioning Audit)

글리프의 시인성을 확보하기 위해 게임 UI에서 흔히 쓰이는 검은 외곽선 스트로크(`ctx.strokeText`)를 적용할 경우, 글자가 종이 스티커처럼 떠서 3차원 공간의 숭고한 분위기를 즉각 파괴합니다.

이를 해결하기 위해 개발된 **Dark Ambient Cushion**(가우시안 알파 음영 차폐)의 적용 전후를 동일 시점($t = 6.0\text{s}$)에서 정밀 실사 비교했습니다.

| Cushion Active (소프트 쿠션 적용) | Cushion Disabled (쿠션 미적용) |
| :---: | :---: |
| ![With Cushion](../captures/phase_d_01_yangyang_still_frame_with_cushion.png) | ![Without Cushion](../captures/phase_d_02_yangyang_still_frame_without_cushion.png) |

### 비교 분석 데이터

| 비교 항목 | Cushion Active (소프트 쿠션 적용) | Cushion Disabled (원형 글리프 단독) | 판정 및 미학적 평가 |
| :--- | :--- | :--- | :--- |
| **렌더링 방식** | 글리프 배면 가우시안 소프트 섀도우 (`blur = 0.4 \times \text{fontSize}`, `rgba(2,6,14,0.55)`) | 그림자 차폐 없이 단일 획 직접 렌더링 (`fillText` only) | **Cushion Active 압도적 우위** |
| **파도 위 가독성** | PBR 수면의 백색 반사광 및 파선(Crest)과 중첩되어도 획의 윤곽이 뭉개지지 않고 선명히 분리됨 | 밝은 파선 및 안개 하이라이트와 겹칠 때 획 경계가 번져 가독성이 저하됨 | 파도 반사광 간섭 완벽 억제 |
| **경계부 자연스러움** | 외곽선 턱(Hard Edge)이 전혀 없어 공기 원근감(Aerial Perspective) 속에 글자가 자연스레 융해됨 | 경계는 얇으나 하이라이트 대비 시 배경과 분리되지 못함 | 인위적인 스티커 느낌 제로 |
| **렌더링 비용** | Canvas 2D 오프스크린 텍스처 베이킹 단계에서 1회 렌더링 (GPU 부하 0) | 동일 (추가 패스 없음) | 60.0 FPS 유지에 완벽 부합 |

---

## 4. 독립적인 6단계 생명주기 검증 (Temporal Lifecycle Audit)

단어 `퇴조`의 6단계 시간 생명주기가 물리적 파동 전달 시간과 완전히 독립된 시적 호흡에 따라 매끄럽게 전개됨을 확인했습니다.

### 단계별 브라우저 실사 캡처 목록

| Stage 1: LATENT ($t = 1.0\text{s}$) | Stage 2: EMERGENCE ($t = 3.8\text{s}$) | Stage 3: FORMATION ($t = 4.8\text{s}$) |
| :---: | :---: | :---: |
| ![Stage 1](../captures/phase_d_03_stage1_latent.png) | ![Stage 2](../captures/phase_d_04_stage2_emergence.png) | ![Stage 3](../captures/phase_d_05_stage3_formation.png) |
| **Stage 4: RESONANCE ($t = 7.0\text{s}$)** | **Stage 5: DISSOLUTION ($t = 9.4\text{s}$)** | **Stage 6: RESIDUE ($t = 12.0\text{s}$)** |
| ![Stage 4](../captures/phase_d_06_stage4_resonance.png) | ![Stage 5](../captures/phase_d_07_stage5_dissolution.png) | ![Stage 6](../captures/phase_d_08_stage6_residue.png) |

### 단계별 상태 진단표

| 단계 | 시점 ($t$) | 상태 (`state`) | 투명도 ($\alpha$) | 시각적 특징 및 지형 상호작용 |
| :--- | :---: | :--- | :---: | :--- |
| **Stage 1: LATENT** | $1.0\text{s}$ | `LATENT` | $0.000$ | 완전한 비가시성. 해저 지형과 동해 수면만이 침묵 속에 존재. |
| **Stage 2: EMERGENCE** | $3.8\text{s}$ | `EMERGENCE` | $0.939$ | 중앙 고정 알파 와이프(Fixed-Center Wipe)로 수면 위에서 서서히 피어오름. |
| **Stage 3: FORMATION** | $4.8\text{s}$ | `FORMATION` | $0.980$ | 획의 왜곡 및 진동 없이 완벽한 단어 형태와 최고 가독성 유지. |
| **Stage 4: RESONANCE** | $7.0\text{s}$ | `RESONANCE` | $0.950$ | 동해 해수면 파동에 동기화되어 상하 미세 진폭($\Delta y \approx \pm 0.0022$)으로 호흡. |
| **Stage 5: DISSOLUTION** | $9.4\text{s}$ | `DISSOLUTION` | $0.765$ | 입자상 안개 속으로 서서히 획이 흩어지며 투명도 점진 감쇄. |
| **Stage 6: RESIDUE** | $12.0\text{s}$ | `RESIDUE` | $0.130$ | 희미한 기억의 잔상으로 대륙붕 가장자리에 극저채도로 머무름. |

---

## 5. 단위 테스트 및 브라우저 실사 검증 결과

- 단위 테스트 스위트: **251개 전항 PASS** (0 FAIL)
  * `test_geodetic_ellipsoid.js`: 15 passed
  * `test_terrain_resolver.js`: 68 passed
  * `test_universal_stress_matrix.js`: 32 passed
  * `test_phase_c_wavefield.js`: 74 passed
  * `test_phase_d_living_memory.js`: 62 passed
- Chrome Headless CDP 브라우저 실사: **19개 항목 PASS** (0 FAIL, 콘솔/페이지 예외 0건, 60.0 FPS 유지)
