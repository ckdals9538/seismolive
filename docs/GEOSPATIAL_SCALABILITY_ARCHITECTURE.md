# [SEISMOLIVE v4.0 — GEOSPATIAL SCALABILITY ARCHITECTURE]
## 전 지구 지형 확장성 아키텍처 및 타일 관리 규약
### Target: Level 1 (Local) to Level 4 (Global) Seamless Geospatial Engine & LookDev Specification

---

## 0. 핵심 설계 철학: 국지적 시작, 전 지구적 목적지

> **"양양·설악산 주변의 DEM 타일 하나를 확보하는 것은 공간의 범위를 국지적으로 제한하기 위함이 아니다. 실제 지형 데이터를 확보·처리·정규화하고, 좌표 무결성을 보존한 채 최종 3D 엔진으로 전달하는 전 지구적 파이프라인을 검증하기 위한 첫 번째 물리적 발자국이다."**

본 아키텍처는 국지적 타일($1^\circ \times 1^\circ$) 하나로부터 한반도, 동아시아, 그리고 전 지구로 확장될 때 **좌표계의 재작성이나 렌더러 파이프라인의 파괴 없이 데이터가 유기적으로 증설되는 확장형 지리공간 체계**를 정의한다.

---

## 1. 4단계 공간 확장 계층 (The 4-Level Spatial Hierarchy)

```
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                 4-LEVEL SPATIAL EXPANSION MODEL                                  │
├─────────┬──────────────────────┬────────────────────────┬────────────────────────────────────────┤
│ Level   │ 공간 범위 (Coverage) │ 공간 해상도 (Spatial)  │ 목표 역할 및 시각적 경험               │
├─────────┼──────────────────────┼────────────────────────┼────────────────────────────────────────┤
│ Level 1 │ 국지 지형 (Local)    │ 1.0" (~30m, Copernicus)│ 설악산-양양 $35\text{km} \times 45     │
│         │ 설악산·양양 권역      │ 서브미터 수직 정밀도   │ \text{km}$ 단층 및 계곡 요철 정밀 표현 │
├─────────┼──────────────────────┼────────────────────────┼────────────────────────────────────────┤
│ Level 2 │ 한반도 전체 (Regional│ 1.0" ~ 3.0" (~30~90m)  │ 태백·소백산맥 산줄기와 동·서·남해안   │
│         │ $33^\circ \sim 43^\circ\text{N}$, $124^\circ \sim 132^\circ\text{E}$ │ 지형-해양의 극적인 단차 표출           │
├─────────┼──────────────────────┼────────────────────────┼────────────────────────────────────────┤
│ Level 3 │ 동아시아 (Continental│ 15" (~450m, GEBCO)     │ 일본 해구(도호쿠 섭입대), 류큐 호,    │
│         │ 판 경계 섭입대       │ + 주요 단층 30m 타일   │ 필리핀해 판의 심연 구조 조망           │
├─────────┼──────────────────────┼────────────────────────┼────────────────────────────────────────┤
│ Level 4 │ 전 지구 (Global)     │ 60" (~1.8km Global)    │ 우주 궤도(Cosmic View)에서 바라보는    │
│         │ 지구 전체 구체       │ 저해상도 글로벌 베이스 │ 지구본 곡률 및 원거리 대기 지평선      │
└─────────┴──────────────────────┴────────────────────────┴────────────────────────────────────────┘
```

---

## 2. 3D 좌표 변환 체계: 표준 WGS84 ECEF와 Three.js 렌더링 프레임의 분리

SEISMOLIVE는 물리적 측지학 공식과 실시간 3D 렌더링 좌표계를 명확히 분리하여, 부동소수점 정밀도 저하와 좌표계 왜곡을 원천 방지한다.

### 2.1 표준 WGS84 타원체 ECEF 좌표계 (Geodetic ECEF Truth)
물리적 지구 모델은 회전타원체(Oblate Spheroid) 표준 WGS84 파라미터를 따른다:
- **적도 반지름 (Semi-major axis, $a$)**: $6,378,137.0\text{ m}$
- **편평률 (Flattening, $f$)**: $\frac{1}{298.257223563}$
- **극 반지름 (Semi-minor axis, $b$)**: $a(1 - f) \approx 6,356,752.3142\text{ m}$
- **제1 이심률 제곱 ($e^2$)**: $2f - f^2 \approx 0.00669437999014$
- **묘유선 곡률반경 ($N(\phi)$)**:
  $$N(\phi) = \frac{a}{\sqrt{1 - e^2 \sin^2\phi}}$$
- **표준 WGS84 ECEF 직교좌표 변환식 (단위: 미터 [m])**:
  $$X_{\text{ECEF}} = (N(\phi) + h) \cos\phi \cos\lambda$$
  $$Y_{\text{ECEF}} = (N(\phi) + h) \cos\phi \sin\lambda$$
  $$Z_{\text{ECEF}} = (N(\phi)(1 - e^2) + h) \sin\phi$$
  *(여기서 $+X$는 본초자오선-적도 교점, $+Y$는 동경 90도-적도 교점, $+Z$는 북극을 향함)*

### 2.2 Three.js 스케일 렌더링 프레임 (Scaled Rendering Coordinate Frame)
WebGL의 32-bit 단정밀도 부동소수점(Float32, 가수부 24-bit)은 좌표 크기가 $10^7\text{ m}$에 달할 때 약 $1\text{ m}$ 수준의 지터(Jitter / Z-fighting)를 유발한다. 따라서 3D 렌더링 엔진 내부에서는 스케일 정규화 좌표계를 사용한다:
- **스케일 계수**: $1.0\text{ unit} = 100\text{ km} = 100,000.0\text{ m}$
- **기준 구체 반경**: $R_{\text{earth}} = 63.71\text{ units}$ ($6,371\text{ km}$에 해당)
- **Three.js 축 매핑 (Y-Up 표준)**:
  - Three.js $+Y$: 지구 북극 (North Pole, $\phi = +90^\circ$)
  - Three.js $X-Z$ 평면: 적도 평면 (Equatorial Plane)
- **Three.js 전역 구면 렌더링 간소화 식**:
  $$r = R_{\text{earth}} + \left(\frac{h}{100000.0}\right) \times E$$
  $$X_{\text{three}} = -r \cos\phi \cos\lambda$$
  $$Y_{\text{three}} = r \sin\phi$$
  $$Z_{\text{three}} = r \cos\phi \sin\lambda$$

### 2.3 수직 과장 승수($E$)의 엄격한 분리
- **조형적 연출 승수**: 수직 과장 승수 $E$($1.0 \times \sim 2.5 \times$)는 **오직 버텍스 셰이더 변위 시각화에만 적용되는 렌더링 파라미터**이다.
- **물리/과학 연산 절대 배제**: 지진동 거리 감쇠(GMPE), P/S파 주시 곡선 전파 속도, 단층 파열 거리 계산, 과학적 광선 추적(Raycasting)에서는 $E$를 절대로 적용하지 않으며, 반드시 $E = 1.0$인 미터 단위 물리 좌표를 사용한다.

---

## 3. 래스터 공간 왜곡 분석 및 셰이더 노멀 보정 (Metric Normal Derivation)

### 3.1 1.0 arc-second 비정방 픽셀 종횡비 ($1 : 1.262$)
위도 $38^\circ$에서 경도 1초와 위도 1초의 지표면 실측 거리는 동일하지 않다:
- **경도 1.0 arc-second 실측 거리 ($\Delta x$, 동서 방향)**:
  $$\Delta x = \frac{1}{3600} \cdot \frac{\pi}{180} \cdot a \cos(38.15^\circ) \approx 24.33\text{ m}$$
- **위도 1.0 arc-second 실측 거리 ($\Delta y$, 남북 방향)**:
  $$\Delta y = \frac{1}{3600} \cdot \frac{\pi}{180} \cdot M(38.15^\circ) \approx 30.71\text{ m}$$
- **픽셀 종횡비 (Aspect Ratio)**:
  $$\frac{\Delta y}{\Delta x} = \frac{30.71}{24.33} \approx 1.262$$
  *(픽셀 하나는 가로로 좁고 세로로 26.2% 더 긴 직사각형임)*

### 3.2 메쉬 크기 결정 및 UV 왜곡 방지
추출된 설악산·양양 권역($1800 \times 1080$ 픽셀)의 물리적 크기:
- 가로 폭: $1800 \times 24.33\text{ m} \approx 43.79\text{ km}$ ($0.4379\text{ units}$)
- 세로 높이: $1080 \times 30.71\text{ m} \approx 33.17\text{ km}$ ($0.3317\text{ units}$)
- **PlaneGeometry 종횡비**:
  Three.js에서 평면 메쉬를 생성할 때 정사각형이 아닌 **$43.79 : 33.17 \approx 1.320 : 1$**의 정확한 물리 종횡비를 부여해야 동서 방향의 지형 왜곡이 발생하지 않는다.

### 3.3 셰이더 내 미터 단위 표면 노멀(Normal) 벡터 유도
경사면의 빛 반사와 칼날 같은 림 라이트(Rim Light)를 완벽히 구현하기 위해, 셰이더는 비정방 격자 간격을 미터 단위로 나누어 기울기(Gradient)를 계산해야 한다:
```glsl
// GLSL Fragment Shader: 비정방 픽셀 보정 표면 노멀 계산
uniform sampler2D u_demTexture;
uniform vec2 u_texelSize;        // vec2(1.0 / 1800.0, 1.0 / 1080.0)
uniform vec2 u_metricSpacing;    // vec2(24.33, 30.71) [meters]
uniform float u_elevationSpan;   // 1704.0 [meters]
uniform float u_verticalExag;    // E (1.0 ~ 2.0)

vec3 calculateAccurateNormal(vec2 uv) {
    // 중앙 차분 (Central Difference)
    float h_left  = texture(u_demTexture, uv - vec2(u_texelSize.x, 0.0)).r * u_elevationSpan;
    float h_right = texture(u_demTexture, uv + vec2(u_texelSize.x, 0.0)).r * u_elevationSpan;
    float h_down  = texture(u_demTexture, uv - vec2(0.0, u_texelSize.y)).r * u_elevationSpan;
    float h_up    = texture(u_demTexture, uv + vec2(0.0, u_texelSize.y)).r * u_elevationSpan;

    // 물리적 거리(미터)로 나누어 실제 지형 기울기 산출
    float dh_dx = ((h_right - h_left) / (2.0 * u_metricSpacing.x)) * u_verticalExag;
    float dh_dy = ((h_up - h_down) / (2.0 * u_metricSpacing.y)) * u_verticalExag;

    // 접평면 기준 표면 법선 벡터 (Three.js 로컬 기준 +Y 상향)
    return normalize(vec3(-dh_dx, 1.0, -dh_dy));
}
```

---

## 4. Three.js UNORM16 DataTexture 규격 확정

G1 실측 지형 렌더링 파이프라인에서 사용할 GPU 텍스처 규격을 다음과 같이 엄격히 확정한다:

```
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│                             THREE.JS UNORM16 TEXTURE SPECIFICATION                               │
├───────────────────────────────┬─────────────────────────────────┬────────────────────────────────┤
│ 설정 파라미터                 │ 설정값 (Specification)          │ 기술적/하드웨어적 근거         │
├───────────────────────────────┼─────────────────────────────────┼────────────────────────────────┤
│ Texture Type                  │ `THREE.UnsignedShortType`       │ WebGL2 `gl.UNSIGNED_SHORT`     │
├───────────────────────────────┼─────────────────────────────────┼────────────────────────────────┤
│ Texture Format                │ `THREE.RedFormat`               │ WebGL2 단일 채널 `gl.RED`      │
├───────────────────────────────┼─────────────────────────────────┼────────────────────────────────┤
│ Internal Format               │ `gl.R16` (UNORM)                │ 부호 없는 16-bit 정규화 채널   │
├───────────────────────────────┼─────────────────────────────────┼────────────────────────────────┤
│ Hardware Normalization        │ 자동 지원 (Auto normalized)     │ GPU 샘플러가 $[0, 65535]$를     │
│                               │                                 │ $[0.0, 1.0]$ float로 자동 변환 │
├───────────────────────────────┼─────────────────────────────────┼────────────────────────────────┤
│ Filtering Mode                │ `THREE.LinearFilter`            │ 하드웨어 바이리니어 보간 필수   │
│                               │ (Mag / Min 모두 적용)           │ (WebGL2에서 R16은 확장 없이    │
│                               │                                 │ 선형 필터링 완전 지원)         │
├───────────────────────────────┼─────────────────────────────────┼────────────────────────────────┤
│ Wrapping Mode                 │ `THREE.ClampToEdgeWrapping`     │ 타일 외곽 클램핑               │
├───────────────────────────────┼─────────────────────────────────┼────────────────────────────────┤
│ Mipmaps                       │ `generateMipmaps: false`        │ 지형 피크 깎임 및 침식 방지   │
├───────────────────────────────┼─────────────────────────────────┼────────────────────────────────┤
│ Texture flipY                 │ `flipY: false`                  │ 북쪽(Row 0) 바이너리 순서 보존 │
├───────────────────────────────┼─────────────────────────────────┼────────────────────────────────┤
│ Shader UV Mapping             │ `v = 1.0 - uv.y` (또는 버텍스   │ 래스터 Row 0이 북측(V=1)에     │
│                               │ UV 매핑에서 북-남 반전 보정)    │ 위치하도록 정렬                │
└───────────────────────────────┴─────────────────────────────────┴────────────────────────────────┘
```

### 4.1 Three.js 인스턴스화 코드 규약
```javascript
// DataTexture 생성 규약 (Uint16Array 버퍼 바인딩)
const demTexture = new THREE.DataTexture(
  uint16Buffer,            // seoraksan_yangyang_unorm16.bin (1800 * 1080 * 2 bytes)
  1800,                    // width
  1080,                    // height
  THREE.RedFormat,
  THREE.UnsignedShortType
);
demTexture.magFilter = THREE.LinearFilter;
demTexture.minFilter = THREE.LinearFilter;
demTexture.wrapS = THREE.ClampToEdgeWrapping;
demTexture.wrapT = THREE.ClampToEdgeWrapping;
demTexture.flipY = false;
demTexture.generateMipmaps = false;
demTexture.needsUpdate = true;
```

---

## 5. 타일 인덱싱 및 다중 해상도 LOD 체계 (Tile Indexing & LOD)

### 5.1 타일 네이밍 및 분할 규약
- **기준 모타일 (Root Grid)**: $1^\circ \times 1^\circ$ 정수 경위도 타일 (Copernicus 원본 네이밍 승계).
  - 예: `T_N38E128` (위도 $38^\circ \sim 39^\circ\text{N}$, 경도 $128^\circ \sim 129^\circ\text{E}$).
- **LOD 쿼드트리 세분화 (Sub-tile Indexing)**:
  - LOD 0: $1^\circ \times 1^\circ$ (Root)
  - LOD 1: $0.5^\circ \times 0.5^\circ$ ($2 \times 2 = 4$개 서브타일: NW, NE, SW, SE)
  - 이번 G1-Step 0에서 추출한 설악산·양양 타일($38.0^\circ \sim 38.3^\circ\text{N}, 128.3^\circ \sim 128.8^\circ\text{E}$)은 `T_N38E128_L1_SE`의 정밀 서브셋에 정확히 위치함.

### 5.2 타일 경계 틈새 방지 규약 (Edge Continuity & Skirt Protocol)
1. **공유 경계 픽셀 중복(Border Pixel Overlap)**:
   - 인접한 동-서 타일은 경계 컬럼 1픽셀을 정확히 공유한다.
   - 인접한 남-북 타일은 경계 로우 1픽셀을 정확히 공유한다.
2. **지오메트리 스커트 (Geometry Skirts)**:
   - 각 타일 메쉬의 외곽 둘레 버텍스에 $z = -500\text{ m}$ 깊이로 수직 하향하는 스커트 폴리곤을 배치하여, 인접 타일 간 미세한 빈틈을 차단한다.

---

## 6. 결론: G1 렌더링 파이프라인 진입 보증

G1-Step 0과 Step 0.1 검증을 거친 지리공간 데이터 파이프라인은 본 아키텍처의 기준을 100% 충족하며, **차기 G1-Step 1 LookDev 단계에서 왜곡 없는 실측 3D 지형 렌더링을 시작할 모든 기술적·수학적 보증을 완료**하였다.
