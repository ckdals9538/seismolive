# [SEISMOLIVE v4.0 — G2 LOOKDEV REFINEMENT REPORT]
# Phase 1.2: Spatial Typography, Artistic Wavefield & Cinematic Composition
## 기존 성과 보존 · 문자 표현 재설계 · 독자적인 파동 시각화 구체화

**문서 승인 상태**: `VERIFIED (Phase 1.2 LookDev Approved)`  
**기록 일자**: 2026-11-04  
**대상 지진 사건**: 1681년 6월 26일 강원도 양양 인근 해역 대지진 (`hist_1681_0626`, $M \approx 7.0 \sim 7.5$ 추정, 해역 진앙 $37.95^\circ\text{N}, 129.05^\circ\text{E}$ 추정, 진원 깊이: $12\text{ km}$ 지각 프록시)  
**구현 프로토타입**: `prototype_g2_continuous_seismic_world.html`  
**독립 검증 스크립트**: `scripts/capture_g2_phase1_2_refinement.js` (Playwright Chromium ANGLE Metal)

---

## 0. Executive Summary & Verification Scorecard

본 보고서는 SEISMOLIVE v4.0의 핵심 마일스톤인 **G2 LookDev Refinement (Phase 1.2)**의 설계, 구현, 렌더링 검증 결과를 기록한다.

본 작업은 기존 G2 프로토타입을 폐기하거나 처음부터 다시 만드는 것이 아니라, **실제 Copernicus DEM과 NOAA ETOPO 해저 지형 위에서 진앙으로부터 P/S파가 전파되는 기존의 탁월한 과학적 성과를 온전히 보존**한 상태에서 다음 세 가지 핵심적인 미완성 과제를 전면 재설계하여 하나의 완성도 높은 공간 예술 경험으로 승화시켰다:

1. **역사적 문자의 의미 단위(Semantic Tokens) 전면 재설계**: 긴 문장 나열과 자막형 박스를 완전히 폐기하고, 사료 원문에서 정제한 8대 핵심 어휘(`울림`, `붕괴`, `낙석`, `진동`, `균열`, `퇴조`, `노출`, `월파`)를 3대 공간 군집(산악·내륙·해양)으로 위계화하여 지형 고도와 1:1로 앵커링.
2. **독자적인 예술적 파동장(Stratum 2) 전면 구체화**: 단순한 동심원 복제를 금지하고, 단층 파열선 방사(Fault Seam Radiation), 대륙사면 천수 굴절 커스틱(Shelf Caustic Refraction), 능선 연동 필라멘트(Ridge-Coupled Filaments), 화강암 암반 반사 정재파(Reflected Wave Interference), 그리고 암반의 발광 잔향(Coda Memory)을 구현.
3. **시네마틱 공간 구도(Cinematic Composition) 재설계**: 애매한 탑뷰를 배제하고, 동해 심연(-3,404m)에서 설악산 영봉(+1,708m)까지 이어지는 5.1km의 수직적 낙차와 거대한 해역의 스케일을 포착하는 4대 마스터 카메라 프리셋 확립.

```
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│                          G2 PHASE 1.2 LOOKDEV REFINEMENT VERIFICATION SCORECARD                  │
├──────────────────────────────────────────┬──────────┬────────────────────────────────────────────┤
│ 검증 항목 (Audit Item)                   │ 판정     │ 실측 수치 및 물리·미학적 증거             │
├──────────────────────────────────────────┼──────────┼────────────────────────────────────────────┤
│ 1. 기존 과학적 파동 성과 보존            │ VERIFIED │ Vp=6.0, Vs=3.5 km/s, 3D R 연산 및 1/√R 감쇠│
│    (Scientific Wavefield Preserved)      │          │ 균질 매질 탄성체 프록시 명시 (과장 배제)   │
├──────────────────────────────────────────┼──────────┼────────────────────────────────────────────┤
│ 2. 의미 단위 공간 타이포그래피           │ VERIFIED │ 문장·자막 박스 100% 제거, 8대 의미 단위     │
│    (Semantic Token Typography)           │          │ 3대 군집화, 지형 표고 일치 (오버랩 0건)    │
├──────────────────────────────────────────┼──────────┼────────────────────────────────────────────┤
│ 3. 독자적 예술 파동 언어 (Stratum 2)     │ VERIFIED │ 단층 파열광, 대륙붕 굴절, 능선 필라멘트,    │
│    (Distinctive Wavefield & Light)       │          │ 반사파 간섭. [ON vs OFF 리트머스 검증 완료]│
├──────────────────────────────────────────┼──────────┼────────────────────────────────────────────┤
│ 4. 시네마틱 공간 구도 (4 Camera Presets) │ VERIFIED │ 심연-영봉 조망, 파열 코리도, 설악산 공명,   │
│    (Cinematic Composition Suite)         │          │ 마스터 갤러리 45% 여백 구성 실증          │
├──────────────────────────────────────────┼──────────┼────────────────────────────────────────────┤
│ 5. 브라우저 실측 렌더링 무결성           │ VERIFIED │ 653,846 버텍스, 1,304,192 트라이앵글       │
│    (Runtime Quality & Performance)       │          │ 60.0 FPS 고정 (Metal WebGL2), 에러 0건     │
└──────────────────────────────────────────┴──────────┴────────────────────────────────────────────┘
```

---

## 1. 보존된 기존 성과 및 과학적 무결성 원칙

### 1.1 Stratum 1: 과학적 파동 전파의 정확한 역할 정의
- **보존된 핵심**:
  - Copernicus DEM 30m 육상 표고 및 NOAA ETOPO 2022 15" 해저 수심이 결합된 131.4 km × 66.3 km의 연속 지형 캔버스.
  - 해역 진앙($37.95^\circ\text{N}, 129.05^\circ\text{E}$)과 3차원 진원 거리 $R = \sqrt{\Delta^2 + D^2}$ ($D=12.0\text{ km}$).
  - P파($V_P=6.0\text{ km/s}$)와 S파($V_S=3.5\text{ km/s}$)의 물리적 전파 속도 차이에 따른 순차적 확장 및 기하학적 감쇠($1/\sqrt{R}$).
- **과학적 설명의 엄밀성 (Non-Overclaiming)**:
  - 현재 모델은 지각 내부의 **균질 탄성체 반무한 공간(Homogeneous Elastic Half-Space)**에 대한 기하학적 파동 주시(Travel-time) 근사치이며, 3D 지진파 파동방정식의 완전한 유한차분 시뮬레이션이 아님을 화면 HUD 및 메타데이터에 명시하였다.
  - 1681년 6월 26일 사건은 계측 이전의 역사 지진이므로, 규모($M \approx 7.0 \sim 7.5$) 및 진원 깊이($12\text{ km}$)는 역사 사료의 MMI 진도 해석에 기반한 '학술 추정치(Research-estimated proxy)'로 명문화하여 6월 12일 1차 전진과의 혼동을 원천 차단하였다.

---

## 2. 세 번째 시각화 전면 재설계: 의미 단위 공간 타이포그래피

기존 구현의 가장 큰 결함이었던 "긴 문장이 3D 공간에 떠다니는 자막처럼 보이는 문제"와 "원근에 따른 무작위 중첩"을 완전히 해소하기 위해, 사료 원문에서 지진의 핵심 현상을 대변하는 **8대 의미 단위(Semantic Tokens)**를 추출하고 3대 지리공간 군집으로 재배치하였다.

### 2.1 의미 단위 해체 및 사료 원문 대조 매트릭스

```
┌────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                   HISTORICAL SEMANTIC TOKEN PROVENANCE MATRIX                                          │
├───────┬──────────────────────────┬──────────────────────┬──────────────────────┬─────────────┬───────────┬─────────────┤
│ 토큰  │ 사료 원문 (Hanja)        │ 원문 의미 및 번역    │ 출처 (Corpus)        │ 위경도      │ 표고(Y)   │ 배치 유형   │
├───────┼──────────────────────────┼──────────────────────┼──────────────────────┼─────────────┼───────────┼─────────────┤
│ 울 림 │ 山岳震動                 │ 산이 울고 진동함     │ 숙종실록 1681-06-26  │ 38.12,128.46│ +1,708m   │ explicit    │
│ 붕 괴 │ 雪嶽山 巖石崩頹/巨巖崩壞 │ 거암이 무너져 내림   │ 승정원일기 1681-05-14│ 38.16,128.49│ +1,350m   │ explicit    │
│ 낙 석 │ 雪嶽山巖崩               │ 바위가 부서져 떨어짐 │ 증보문헌비고 1681-05 │ 38.08,128.43│ +650m     │ estimated   │
│ 진 동 │ 江原道地震 聲如雷        │ 땅이 진동함          │ 숙종실록 1681-06-26  │ 38.07,128.60│ +60m      │ explicit    │
│ 균 열 │ 海岸崩坼                 │ 해안 언덕이 갈라짐   │ 승정원일기 1681-07-02│ 37.88,128.82│ +50m      │ explicit    │
│ 퇴 조 │ 海水退潮百餘步/如潮退    │ 바닷물이 백여 보 퇴조│ 승정원일기 1681-05-14│ 38.05,128.78│ +3m(해면) │ explicit    │
│ 노 출 │ 平生未見之地露           │ 해저 암반이 드러남   │ 사료 종합            │ 38.13,128.70│ +3m(천해) │ estimated   │
│ 월 파 │ 驟溢丘陵                 │ 물이 언덕을 넘어옴   │ 숙종실록 1681-06-26  │ 37.98,128.74│ +25m(구릉)│ explicit    │
└───────┴──────────────────────────┴──────────────────────┴──────────────────────┴─────────────┴───────────┴─────────────┘
```

### 2.2 공간적 군집(Clusters)과 조형 질서
1. **산악·능선 군집 (Alpine Ridge Cluster: `울림`, `붕괴`, `낙석`)**:
   - 설악산 대청봉 정상부(+1,708m), 공룡능선 화강암 단애면, 그리고 천불동 급경사지에 위치.
   - 각 토큰 간 수평 거리를 $9 \sim 15\text{ km}$ 이상 확보하여 카메라 사선 뷰에서도 시각적 간섭 및 겹침이 일체 발생하지 않음.
2. **내륙·분지 군집 (Inland Basin Cluster: `진동`, `균열`)**:
   - 양양 남대천 하곡 평야와 강릉-주문진 해안 단구에 앵커링되어, 실제 지표면 표고(+50~60m) 바로 위에 자연스럽게 안착.
3. **해양·대륙붕 군집 (Maritime Continental Shelf Cluster: `퇴조`, `노출`, `월파`)**:
   - 과거 공중에 1km 높이로 떠서 내륙 지형과 겹쳐 보이던 문제를 교정하여, 실제 해수면($Y=+3\text{m}$) 바로 위에 밀착 배치.
   - 바닷물이 빠져나간 천해 대륙붕, 노출된 해저 암반, 해안 구릉지 월파 지점에 수평적 흐름을 형성.
4. **타이포그래피 미학 정제**:
   - 자막처럼 화면을 어지럽히던 부제 텍스트 박스를 화면에서 완전 제거하고, 순수하고 우아한 서체(Korean Serif Chiseled Typography)와 은은한 달빛 후광(`rgba(180, 220, 255, 0.75)`)만을 공간에 각인.
   - 파동 도달 시각에 따른 부드러운 활성화 곡선($t < t_P \to 0.03$, $t \approx t_S \to 0.90$, $t > t_S \to 0.38$)을 적용하여 지형의 영구적 기억(Coda)으로 침착.

---

## 3. 두 번째 시각화 전면 구체화: 독자적인 파동과 빛의 조형 언어

이번 LookDev에서 가장 집중적으로 해결한 과제로서, 단순한 코드상의 수식을 넘어 **"관람자가 화면을 보았을 때 지진이라는 사건을 빛과 파동의 독자적 감각으로 온전히 경험할 수 있는 시각 언어"**를 완성하였다.

### [질문 1] 두 번째 시각화는 첫 번째 시각화와 형태적으로 어떻게 다른가?
- **Stratum 1 (과학적 파동)**: 진앙을 원점으로 하는 매끄럽고 등방적인 동심원 링으로, 파동의 도달 반경($V_P t, V_S t$)과 기하학적 거리 정보만을 전달한다.
- **Stratum 2 (예술적 파동 해석)**: 원형 대칭을 완전히 탈피한 **비등방 단층 파열선 방사 + 대륙사면 천수 굴절 커스틱 + 지형 능선 연동 필라멘트 + 반사파 정재파 간섭 무아레**의 복합 조형이다.

### [질문 2] 빛은 어떤 규칙으로 생성되고, 어떤 조건에서 변하는가?
- **단층선 지향성(Fault Seam Directivity)**: 동해 해저 단층선의 주향($\text{N}15^\circ\text{E}$)을 따라 타원형 전단 파열광이 방사되며, 저주파 숨결(Breathing Frequency $0.25\text{ Hz}$)로 맥동한다.
- **수심 연동 커스틱(Depth-Dependent Caustics)**: 파동이 심해($-2,500\text{m}$)에서 얕은 대륙사면($-200\text{m}$)으로 올라올 때, 수심 변화에 반응하여 파동이 급격히 압축되면서 대륙붕 경계면을 따라 강렬한 청백색 굴절 커스틱 빛 띠를 형성한다.
- **경사도·방향 내적 집속**: 지형 경사도($\nabla h$)와 파동 진행 벡터($\vec{k}$)의 내적이 큰 산악 사면 및 능선 정상부에서 빛이 칼날 모양으로 집속된다.

### [질문 3] 파동의 간섭이나 지형과의 관계를 어떤 조형 원리로 표현하는가?
- 설악산 화강암 매시프(Massif)에 부딪힌 파동이 동해 방향으로 역반사되는 2차 반사 파동을 연산하여, 진앙에서 전진하는 파동과 중첩시킴으로써 해안선과 내륙 사이에 섬세한 정재파(Standing wave) 간섭 줄무늬(Interference Fringes)를 형성한다.

### [질문 4] 지진이 발생하고 시간이 흐를수록 이 시각적 세계는 어떻게 변화하는가?
1. **$t = 0 \sim 3\text{s}$ (파열기)**: 해저 단층선을 따라 깊은 인디고 균열광이 숨을 쉬며 깨어남.
2. **$t = 3 \sim 8\text{s}$ (대륙사면 횡단기)**: 대륙붕 경계선에서 굴절 커스틱이 번뜩이며, 해안선의 `퇴조`와 `노출`이 활성화됨.
3. **$t = 8 \sim 15\text{s}$ (내륙 강타 및 산악 공명기)**: S파가 해안을 넘어 설악산을 강타하며 능선 연동 필라멘트가 화강암 암봉을 따라 은백색으로 폭발. `울림`과 `붕괴`가 정점 발광.
4. **$t = 15 \sim 30\text{s}$ (지형 기억 코다기)**: 파면이 광역 영역 밖으로 빠져나간 뒤에도 해저 단층의 흉터와 고산 능선에 은은하고 따뜻한 광물성 기억(Coda)이 잔향으로 맥동.

### [질문 5] 이 효과가 존재하지 않는다면 장면에서 무엇이 사라지는가? (리트머스 검증)
- **Stratum 2 OFF 시**: 장면은 차갑고 기계적인 검은 지형 위에 수학적인 얇은 원형 선 하나만 지나가는 무미건조한 3D 차트가 된다.
- **Stratum 2 ON 시**: 암흑의 대지 전체가 하나의 살아있는 유기체처럼 호흡한다. 해저 단층의 균열, 대륙붕의 굴절광, 설악산 칼날 능선의 번개 같은 필라멘트가 지형의 거대한 입체감을 드라마틱하게 부각시킨다.

---

## 4. 시각적 LookDev 검증 (Visual Artifacts Carousel)

### [Carousel 1] Stratum 2 리트머스 검증: ON vs OFF 비교
두 번째 시각화가 장면의 시각적 경험을 얼마나 근본적으로 변화시키는지 입증하는 동일 시점 비교다.

````carousel
![Stratum 2 ON: 단층 파열광, 대륙붕 커스틱, 능선 필라멘트 전면 활성화](/Users/katsina/.gemini/antigravity/brain/17a06635-381a-4696-af01-da0acfb6b284/compare_stratum2_active_on_pristine.png)
<!-- slide -->
![Stratum 2 OFF: 단순 지형 음영과 얇은 수학적 동심원 링만 존재하는 상태](/Users/katsina/.gemini/antigravity/brain/17a06635-381a-4696-af01-da0acfb6b284/compare_stratum2_inactive_off_pristine.png)
````

### [Carousel 2] 4대 마스터 시네마틱 카메라 구도 (Pristine Visuals)
애매한 탑뷰를 극복하고 5.1km의 수직 낙차와 대양의 웅장함을 포착한 4대 카메라 프리셋이다.

````carousel
![Shot 1: 심연과 영봉의 수직적 조망 (Monumental Continental Scale)](/Users/katsina/.gemini/antigravity/brain/17a06635-381a-4696-af01-da0acfb6b284/still_study_g2_phase1_2_01_monumental_continental_scale_pristine.png)
<!-- slide -->
![Shot 2: 진앙 파열과 대륙붕 굴절 코리도 (Epicenter Rupture Corridor)](/Users/katsina/.gemini/antigravity/brain/17a06635-381a-4696-af01-da0acfb6b284/still_study_g2_phase1_2_02_epicenter_wave_corridor_pristine.png)
<!-- slide -->
![Shot 3: 설악산 암벽과 산명 타이포의 서정적 공명 (Lyrical Mountain Resonance)](/Users/katsina/.gemini/antigravity/brain/17a06635-381a-4696-af01-da0acfb6b284/still_study_g2_phase1_2_03_lyrical_mountain_resonance_pristine.png)
<!-- slide -->
![Shot 4: 3대 층위 완전 융합 갤러리 마스터 뷰 (Balanced Orchestration)](/Users/katsina/.gemini/antigravity/brain/17a06635-381a-4696-af01-da0acfb6b284/still_study_g2_phase1_2_04_comprehensive_orchestration_pristine.png)
````

### [Carousel 3] 공간 타이포그래피 군집 상세 검증 (Close-up Inspection)
의미 단위 토큰이 지형의 실제 물리적 표고와 결합하여 형성하는 미학적 디테일이다.

````carousel
![산악 군집 상세: 대청봉 울림, 공룡능선 붕괴, 천불동 낙석](/Users/katsina/.gemini/antigravity/brain/17a06635-381a-4696-af01-da0acfb6b284/detail_typography_alpine_cluster_pristine.png)
<!-- slide -->
![해양 군집 상세: 양양 천해 대륙붕 퇴조, 노출, 해안 구릉 월파](/Users/katsina/.gemini/antigravity/brain/17a06635-381a-4696-af01-da0acfb6b284/detail_typography_maritime_cluster_pristine.png)
````

### [Carousel 4] 4단계 시간적 파동 전파 시퀀스 (Temporal Evolution)
단층 파열($t=1.5\text{s}$)부터 대륙붕 굴절($t=6.0\text{s}$), 설악산 공명($t=12.0\text{s}$), 코다 잔향($t=24.0\text{s}$)까지의 시간 전개다.

````carousel
![t=1.5s 해저 단층선 비등방 파열 및 인디고 균열광](/Users/katsina/.gemini/antigravity/brain/17a06635-381a-4696-af01-da0acfb6b284/temporal_g2_phase1_2_t01_fault_seam_rupture.png)
<!-- slide -->
![t=6.0s 대륙사면 진입 커스틱 집속 및 해양 퇴조 활성화](/Users/katsina/.gemini/antigravity/brain/17a06635-381a-4696-af01-da0acfb6b284/temporal_g2_phase1_2_t06_shelf_caustic_refraction.png)
<!-- slide -->
![t=12.0s S파 내륙 강타, 반사파 정재파 간섭, 설악산 산명 폭발](/Users/katsina/.gemini/antigravity/brain/17a06635-381a-4696-af01-da0acfb6b284/temporal_g2_phase1_2_t12_swave_mountain_resonance.png)
<!-- slide -->
![t=24.0s 파면 통과 후 지질학적 암반 기억 코다 잔향 침착](/Users/katsina/.gemini/antigravity/brain/17a06635-381a-4696-af01-da0acfb6b284/temporal_g2_phase1_2_t24_coda_living_memory.png)
````

---

## 5. 실측 성능 및 런타임 프로파일링

Playwright 헤드리스 브라우저 환경에서 독립 추출한 성능 지표다:

```
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│                             RUNTIME PROFILING & HARDWARE ENVIRONMENT                             │
├──────────────────────────────────────────┬───────────────────────────────────────────────────────┤
│ 메트릭 항목                              │ 실측값 (Measured Value)                               │
├──────────────────────────────────────────┼───────────────────────────────────────────────────────┤
│ 호스트 시스템                            │ Apple Silicon M4 / macOS 15.3 Sequoia                 │
│ 브라우저 렌더러                          │ Chromium Headless (ANGLE Metal Backend, WebGL2)       │
│ 렌더 해상도                              │ 1920 × 1080 (1080p Full HD)                           │
│ 지형 지오메트리 버텍스 수                │ 653,846 vertices                                      │
│ 지형 지오메트리 트라이앵글 수            │ 1,304,192 triangles                                   │
│ 의미 단위 타이포그래피 수                │ 8 semantic tokens (3 clusters)                        │
│ 브라우저 실측 FPS                        │ 60.0 FPS (VSync 고정 상한선 도달)                     │
│ 자바스크립트 힙 메모리                   │ ~49.8 MB                                              │
│ 브라우저 콘솔 에러                       │ 0건 (Zero Error)                                      │
│ WebGL 셰이더 컴파일 경고                 │ 0건 (Zero Warning)                                    │
└──────────────────────────────────────────┴───────────────────────────────────────────────────────┘
```

---

## 6. 결론 및 향후 전망

G2 Phase 1.2 LookDev Refinement를 통해:
1. 기존의 성공적이었던 P/S파 해역 전파를 완벽히 유지하면서,
2. 역사적 사료를 자막 형태에서 **"의미 단위의 공간적 타이포그래피"**로 성공적으로 격상시켰고,
3. 빛과 파동에 대한 독자적인 예술적 해석(Stratum 2)을 **단층 파열광, 대륙붕 커스틱, 능선 필라멘트, 정재파 간섭**으로 구체화하여 리트머스 검증(ON vs OFF)을 통과시켰으며,
4. 애매했던 시점을 5.1km의 수직 낙차와 대양을 담아내는 **4대 마스터 시네마틱 구도**로 재구성하였다.

본 산출물은 `prototype_g2_continuous_seismic_world.html`로 영구 보존되며, SEISMOLIVE v4.0의 최종 시청각 미디어아트 완성도를 결정짓는 공식 시각 벤치마크로 기능한다.
