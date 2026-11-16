# [SEISMOLIVE v4.0 — MODERN SEISMIC ANALYSIS & PRECISION REPRESENTATION BLUEPRINT]
## 현대 지진 초정밀 분석 및 시청각 물리 복원 시스템 공학 청사진

---

## 1. 개요 및 패러다임 전환 (From Macroseismic to Instrumental)

역사 지진(Historical Seismology)이 문헌 기록의 고증, 불완전한 사료의 신뢰도 공분산 타원, 정성적 진도(MMI) 복원에 집중했다면, **현대 지진학(Modern Instrumental Seismology)**은 **초당 100회(100 Hz) 샘플링되는 3성분 디지털 광대역 지진계 파형, 푸리에 주파수 스펙트럼 역산, 모멘트 텐서 단층면해, 그리고 수천 개 여진의 이중차분법(hypoDD) 재결정을 통한 지하 단층면 기하구조의 물리적 복원**을 핵심으로 합니다.

본 문서는 교수님의 "sec 데이터" 및 관측망 데이터셋을 즉시 연계하여 구현할 수 있는 **현대 지진 정밀 분석 5대 핵심 모듈과 시각화 파이프라인**을 정의합니다.

```
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│                         MODERN SEISMIC ANALYSIS & RENDERING PIPELINE                             │
├──────────────────────────────────────────────────────────────────────────────────────────────────┤
│ 1. 3-Component Waveform (Z, N, E)   ──► STA/LTA P·S Picking & 3D Hodogram Orbit                  │
│ 2. Fourier & Response Spectrum (Sa) ──► Brune (1970) Inversion: M₀, f_c, Stress Drop Δσ         │
│ 3. Moment Tensor & Focal Mechanism  ──► Aki & Richards Double-Couple & 3D Interactive Beachball   │
│ 4. Double-Difference (hypoDD)       ──► Relocated Aftershocks & 3D Subsurface Fault Geometry      │
│ 5. GPU Ground-Motion Driving Engine ──► Observed 1D/2D Waveform DataTexture on Terrain Shader    │
└──────────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. 현대 지진 5대 핵심 분석 모듈 및 정밀 수식

### 2.1 모듈 01: 3성분 시계열 파형 처리 및 호도그램 (3-Component Waveform & Hodogram)

지진계는 지표면의 3차원 운동을 수직(UD, $Z$), 남북(NS, $N$), 동서(EW, $E$) 성분으로 분리 기록합니다.

1. **센서 계측 응답 디컨볼루션 (Instrument Response Deconvolution)**:
   - 디지털 지진계 기록(디지털 카운트 $c(t)$)을 극-영점(Poles and Zeros, PAZ) 전달함수 $H(s)$로 디컨볼루션하여 실제 물리량인 가속도($\text{m/s}^2$), 속도($\text{m/s}$), 변위($\text{m}$)를 복원합니다.
   $$A(f) = \frac{C(f)}{S_0 \cdot H(f)}, \quad H(s) = \frac{\prod_{n=1}^N (s - z_n)}{\prod_{m=1}^M (s - p_m)}$$
2. **P/S파 초동 자동 피킹 (STA/LTA Triggering)**:
   - 단기 평균(STA, Short-Term Average $\sim 0.5\text{s}$)과 장기 평균(LTA, Long-Term Average $\sim 10\text{s}$)의 에너지 비율을 통해 P파 초동과 S파 도달 시각을 서브밀리초 단위로 자동 분리합니다.
   $$R_{\text{STA/LTA}}(t) = \frac{\frac{1}{T_{\text{STA}}} \int_{t - T_{\text{STA}}}^t x^2(\tau) d\tau}{\frac{1}{T_{\text{LTA}}} \int_{t - T_{\text{LTA}}}^t x^2(\tau) d\tau} \ge \gamma_{\text{threshold}}$$
3. **3D 입자 운동 궤적 (Hodogram Orbit)**:
   - 관측소 지점에서 입자의 $(E(t), N(t), Z(t))$ 궤적을 3차원 곡선으로 투영하여, P파의 종파(Longitudinal) 선형 운동, S파의 횡파(Transverse) 전단 운동, Rayleigh파의 역행 타원 운동(Retrograde Elliptic Motion)을 실측 데이터로 증명합니다.

---

### 2.2 모듈 02: 주파수 스펙트럼 및 Brune 지진원 모델 역산 (Source Parameter Inversion)

관측된 지진파를 고속 푸리에 변환(FFT)하여 주파수 영역에서 분석함으로써, 지진을 일으킨 지하 단층의 물리적 특성을 역산합니다.

1. **푸리에 가속도 진폭 스펙트럼 (Fourier Amplitude Spectrum, FAS)**:
   $$\Omega(f) = \int_{-\infty}^{\infty} u(t) e^{-i 2\pi f t} dt$$
2. **Brune (1970) 원형 단층 모델 피팅**:
   변위 스펙트럼 $\Omega(f)$는 저주파 평탄 대역($\Omega_0$)과 코너 주파수($f_c$) 이후 $f^{-2}$로 감쇠하는 이론 곡선을 따릅니다:
   $$\Omega(f) = \frac{\Omega_0}{1 + (f / f_c)^2} \cdot \exp\left( - \frac{\pi f R}{Q V} \right) \cdot \exp(-\pi \kappa_0 f)$$
3. **핵심 지진원 파라미터 역산 공식**:
   - **지진 모멘트 ($M_0$)**:
     $$M_0 = \frac{4\pi \rho V^3 R \Omega_0}{\mathcal{R}_{\theta\phi} \cdot F_S} \quad (\mathcal{R}_{\theta\phi}: \text{방사 패턴 계수}, F_S: \text{자유표면 증폭 } \approx 2)$$
   - **모멘트 규모 ($M_w$)**:
     $$M_w = \frac{2}{3} \log_{10} M_0 - 6.07 \quad (M_0 \text{ 단위: } \text{N}\cdot\text{m})$$
   - **단층 파열 반경 ($r$) (Madariaga 1976 모델)**:
     $$r = \frac{2.34 \cdot V_S}{2\pi f_c}$$
   - **정적 응력 강하 (Static Stress Drop, $\Delta \sigma$)**:
     $$\Delta \sigma = \frac{7}{16} \frac{M_0}{r^3} \quad (\text{단위: MPa})$$
     *(경주 지진 $\Delta \sigma \approx 4\sim 6\text{ MPa}$, 포항 지진 $\Delta \sigma \approx 2\sim 3\text{ MPa}$의 물리적 응력 방출 차이 입증)*
4. **구조물 내진 5% 감쇠 가속도 응답 스펙트럼 ($Sa$)**:
   - 단자유도(SDOF) 진동계의 고유주기($T$)별 최대 응답 가속도를 산출하여 고주파 진동(저층 조적조 취약)과 저주파 진동(초고층 건물 취약) 구역을 정밀 진단합니다.

---

### 2.3 모듈 03: 3D 모멘트 텐서 & 인터랙티브 비치볼 (Moment Tensor & Beachball)

1. **지진 모멘트 텐서 6성분 행렬 ($M_{ij}$)**:
   $$\mathbf{M} = \begin{bmatrix} M_{xx} & M_{xy} & M_{xz} \\ M_{yx} & M_{yy} & M_{yz} \\ M_{zx} & M_{zy} & M_{zz} \end{bmatrix}$$
2. **모멘트 텐서 분해 (Decomposition)**:
   $$\mathbf{M} = \mathbf{M}_{\text{ISO}} + \mathbf{M}_{\text{DC}} + \mathbf{M}_{\text{CLVD}}$$
   - **ISO (등방체 성분)**: $\frac{1}{3}\text{Tr}(\mathbf{M})\mathbf{I}$ (핵실험 폭발 또는 화산 마그마 체적 팽창/수축).
   - **DC (Double Couple, 이중쌍)**: 순수 전단 단층 미끄러짐 (자연 지진의 90% 이상).
   - **CLVD (보상선형벡터이중극자)**: 복합 단층 또는 유체 주입 지진 (포항 지열발전 유도지진 분석 시 필수 지표).
3. **Three.js 3D 비치볼 렌더링**:
   - 주향($\phi_s$), 경사($\delta$), 주향이동각($\lambda$)에 의해 정의되는 2개의 절리면(Nodal Planes)을 단위 구면(Sphere) 위에 압축(+) 사분면(백색/흑색)과 인장(-) 사분면(주홍색/청색)으로 3차원 메쉬 분할하여 씬 내에 인터랙티브하게 투영.

---

### 2.4 모듈 04: 이중차분법(hypoDD) 기반 3D 단층면 입체 복원 (Hypocenter Relocation)

현대 지진 분석의 가장 강력한 시각적 도구 중 하나는 **여진(Aftershocks)의 정밀 재결정을 통한 '보이지 않는 단층면'의 3차원 복원**입니다.

1. **Waldhauser & Ellsworth (2000) hypoDD 원리**:
   두 지진 $j$와 $k$ 사이의 공통 관측소 $i$에서의 도달 주시차 잔차(Double-Difference residual)를 최소화하여 지각 속도 불균질에 의한 오차를 소거합니다:
   $$(t_k - t_j)^{\text{obs}} - (t_k - t_j)^{\text{calc}} = \sum_{m=1}^3 \frac{\partial t_k}{\partial x_m} \Delta x_{k,m} - \sum_{m=1}^3 \frac{\partial t_j}{\partial x_m} \Delta x_{j,m} + \Delta \tau_k - \Delta \tau_j$$
2. **3D 지질학적 표출 효과**:
   - **기존 관측**: 진원 오차 $\pm 2\text{km}$로 인해 지하에 무작위 구름처럼 퍼져 있는 여진 점군.
   - **hypoDD 적용 후**: 오차 $\pm 50\text{m}$로 수렴하여, 본진 파열면을 따라 정렬된 **두께 수십 미터의 날카로운 3차원 평면(단층 파열면, Fault Plane Surface)**이 지하 지형 속에서 명확한 기하구조로 드러남.
   - 2016 경주: 양산단층 동편 12~15km 심도의 주향이동 단층면 3D 시각화.
   - 2017 포항: 지열정 PX-1, PX-2 하부의 $43^\circ$ 서경사 역단층면 3D 슬라이스 시각화.

---

### 2.5 모듈 05: 실측 지진파형 GPU 셰이더 직결 구동 (Observed Waveform Driven Terrain)

현재 구현된 가상의 소스 함수(Ricker Wavelet/정현파 감쇠)를 넘어, **교수님이 제공해주실 관측소 실측 가속도/변위 시계열 데이터가 지형과 사운드를 직접 진동시키는 파이프라인**입니다.

```glsl
// WebGL2 Vertex Shader: 실측 관측망 파형 텍스처 보간 구동
uniform sampler2D u_waveformTexture; // 1D Float32: 관측소별 시간축 변위 [Station x Time]
uniform vec2 u_waveformDimensions;   // [관측소 수, 시간 샘플 수]
uniform float u_currentTimeIndex;     // 실시간 재생 인덱스 (0.0 ~ N_samples)
uniform mat4 u_stationWeights;        // 버텍스 인근 관측소 거리 역자승 가중치

vec3 calculateEmpiricalDisplacement(vec2 terrainCoord) {
    // 인근 3개 관측소의 실측 3성분 변위 보간
    vec3 u_obs = interpolateStationWaveforms(terrainCoord, u_currentTimeIndex);
    return u_obs * u_siteAmplification; // 부지 증폭률(Vs30) 합성
}
```

---

## 3. 정밀도 수준 (Resolution & Precision Targets)

현대 지진 분석 시스템이 달성하는 과학적 해상도 규격:

| 구분 | 목표 정밀도 (Precision Level) | 기술적 구현 메커니즘 |
| :--- | :--- | :--- |
| **시간 정밀도 (Temporal)** | **10 ms (100 Hz 샘플링)** | 오디오 레이트 및 Web Worker 실시간 100Hz 파형 스트리밍 |
| **변위 정밀도 (Displacement)** | **서브밀리미터 ($< 0.1\text{ mm}$)** | 더블 인테그레이션(가속도 $\to$ 속도 $\to$ 변위) 및 베이스라인 필터링 |
| **진원 공간 정밀도 (Spatial)** | **오차 반경 $< 50\text{ m}$** | WGS84 중심 상대 원점 + hypoDD 이중차분 상대 진원 재결정 |
| **주파수 분석 대역 (Bandwidth)**| **0.05 Hz ~ 25.0 Hz** | 광대역(Broadband) 속도계 및 가속도계 전 대역 FFT 스펙트럼 |
| **단층 파열 분해능 (Slip Grid)** | **$500\text{ m} \times 500\text{ m}$ 서브단층** | 유한단층 역산 키네마틱스 격자 매핑 |

---

## 4. 파일럿 구현 로드맵 (Execution Roadmap)

### Step 1: 지진학적 파형 파서 및 표준 컨버터 구축 (1~2일)
- SAC(Seismic Analysis Code) 바이너리 및 miniSEED 파서를 자바스크립트/WebAssembly로 작성하여 브라우저에서 드래그 앤 드롭으로 3성분 실측 데이터를 즉시 로드.

### Step 2: 실시간 분석 패널 (Seismic Analysis Workbench) 인터페이스 (2~3일)
- 3성분 파형 뷰어, P/S 피커 인터랙션, FFT 진폭 스펙트럼 곡선, Brune 모델 피팅($M_0, f_c, \Delta \sigma$ 자동 계산 표시).

### Step 3: 3D 인터랙티브 비치볼 및 지하 단층면 hypoDD 렌더러 (2일)
- 모멘트 텐서 주향/경사/주향이동각 입력에 따른 실시간 3D 비치볼 절리면 생성.
- 지하 지형 내부에 경주/포항 여진 클라우드 및 복원된 단층면 폴리곤 투영.

### Step 4: 실측 파형 기반 3D 지형 실시간 요동 구동 (3일)
- 관측소 실측 파형 데이터를 GPU DataTexture로 전환하여, 재생 바를 드래그할 때 실제 지진계에 기록된 진동이 3D 지형 전체로 리얼타임 전파되는 물리 렌더링 완성.
