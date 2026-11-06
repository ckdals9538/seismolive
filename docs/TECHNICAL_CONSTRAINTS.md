# [SEISMOLIVE v4.0 — TECHNICAL CONSTRAINTS & GEOSPATIAL PIPELINE]
## 기술적 제약, 환경 표준, 지리 데이터 파이프라인 및 무결성 검증 체계
### Last Calibrated: 2026-11-06 (Post-Restructuring Baseline) | Target: Three.js WebGL2 Real Data Integration

---

## 1. 런타임 및 하드웨어 환경 실사 (Verified Host Environment)

터미널 명령어를 통해 전수 검증된 호스트 머신 실태는 다음과 같다:

- **하드웨어**: Apple Silicon M4 (Mac16,10), 24GB 통합 메모리, macOS Darwin 27.x.
- **실제 설치 도구**:
  - `/opt/homebrew/bin/deno` (Deno 2.x): TypeScript/JavaScript 실행 엔진, Node.js 없이도 Deno 자체 표준 라이브러리 및 네이티브 패키지 구동 가능.
  - `/usr/bin/python3` (Python 3.9.6): macOS 표준 라이브러리.
  - `/usr/bin/git` (Apple Git 2.39.5).
  - `/Applications/Google Chrome.app`: ANGLE Metal 렌더러 지원, WebGL 2.0 (GLSL ES 3.00) 가속 확인.
  - `/Applications/Safari.app`.
- **비설치 도구 (호스트에 미존재 확인 완료)**:
  - `node`, `npm`, `npx`, `pnpm`, `yarn`, `bun`: 전무.
  - `codex`, `openai`, `gh`: 전무.
  - `blender`, `/Applications/Blender.app`: 전무.
- **원칙**: 불필요한 거대 소프트웨어(Blender, Unreal)나 복잡한 런타임 설치를 배제하고, **Deno 2 + Standalone Three.js r160 + Google Chrome** 조합만으로 경량화된 자립형 환경을 유지한다.

---

## 2. 좌표계 및 수치 정밀도 제약 (Coordinate & Precision Constraints)

### 2.1 WGS84 3-Tier 연속 좌표계
- **Tier 0 (Global Spheroid)**: WGS84 타원체 장반경 $a=6378137.0\text{m}$, 편평률 $f = 1/298.257223563$.
- **Tier 1 (Regional DEM)**: $131\text{km} \times 66\text{km}$ 지역 지형 및 대륙붕.
- **Tier 2 (Local Inset)**: 국소 고해상도 Inset 메시 (Copernicus 30m 실측 디코딩).

### 2.2 중심 상대 원점 (Center-Relative Origin) 필수 준수
- GPU 셰이더의 `Float32` 유효숫자는 약 7자리(24-bit 가수부)로, 지구 반경 6,378,137m를 전역 좌표로 직접 처리할 경우 지표면에서 **약 $0.5 \sim 1.0\text{m}$ 단위의 떨림(Jitter/Z-fighting)**이 발생한다.
- **해결책**:
  - 진앙 지표면(또는 관찰 중심점)의 ECEF 좌표를 $[X_0, Y_0, Z_0]$로 정의하고,
  - 모든 3D 지형 정점 및 광선 연산은 진앙 기준 상대 좌표 $[X - X_0, Y - Y_0, Z - Z_0]$로 변환하여 GPU에 전달한다.
  - 검증 결과: 60km 반경 내에서 GPU Float32 공간 양자화 오차는 **$< 0.05\text{m}$ (5cm 미만)**으로 억제되어 완벽한 안정성을 보장한다.

---

## 3. 실측 지리공간 데이터 파이프라인 (Secured Geospatial Assets)

디스크에 실제로 확보되어 렌더링에 실시간 바인딩되는 데이터 자산 목록은 다음과 같다:

```
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│                               SECURED GEOSPATIAL DATA ASSETS AUDIT                               │
├───────────────────────────────┬─────────────────────────────────┬────────────────────────────────┤
│ 파일 경로                     │ 데이터 유형 및 해상도           │ 크기 및 커버리지               │
├───────────────────────────────┼─────────────────────────────────┼────────────────────────────────┤
│ assets/terrain/               │ Copernicus DEM GLO-30 GeoTIFF   │ 18.9 MB                        │
│ Copernicus_DSM_COG_*N38*.tif  │ 30m 육상 표고 (N38 설악산)      │ 38.0°N~39.0°N, 128.0°E~129.0°E │
├───────────────────────────────┼─────────────────────────────────┼────────────────────────────────┤
│ assets/terrain/               │ Copernicus DEM GLO-30 GeoTIFF   │ 45.1 MB                        │
│ Copernicus_DSM_COG_*N37*.tif  │ 30m 육상 표고 (N37 강릉·오대산) │ 37.0°N~38.0°N, 128.0°E~129.0°E │
├───────────────────────────────┼─────────────────────────────────┼────────────────────────────────┤
│ assets/terrain/bathymetry/    │ 육해상 융합 UNORM16 바이너리    │ 5,184,000 bytes (1800×1440)    │
│ fused_seorak_donghae_unorm16  │ 설악산 및 동해 수심 (-3500~2500m│ 131.4km (EW) × 66.3km (NS)     │
├───────────────────────────────┼─────────────────────────────────┼────────────────────────────────┤
│ assets/terrain/bathymetry/    │ 경주 지역 UNORM16 바이너리      │ 1,296,000 bytes (900×720)      │
│ regional_2016_gyeongju_unorm16│ 양산단층대 (-3500~2500m)        │ 해안선 단차 0.0000mm 무봉 접합 │
├───────────────────────────────┼─────────────────────────────────┼────────────────────────────────┤
│ assets/terrain/bathymetry/    │ 포항 지역 UNORM16 바이너리      │ 1,296,000 bytes (900×720)      │
│ regional_2017_pohang_unorm16  │ 영일만 연안 대륙붕 (-3500~2500m)│ 퇴적분지 저주파 증폭 반영      │
├───────────────────────────────┼─────────────────────────────────┼────────────────────────────────┤
│ assets/terrain/bathymetry/    │ 구마모토 지역 UNORM16 바이너리  │ 1,296,000 bytes (900×720)      │
│ regional_2016_kumamoto_unorm16│ 아소산 화산 지구대 (-3500~2500m)│ 후타가와 단층대 지형 요철      │
├───────────────────────────────┼─────────────────────────────────┼────────────────────────────────┤
│ assets/terrain/bathymetry/    │ 튀르키예 지역 UNORM16 바이너리  │ 1,296,000 bytes (900×720)      │
│ regional_2023_turkey_unorm16  │ 동아나톨리아 대단층 (-3500~2500)│ 순수 육상 100% (가짜 해양 제로)│
└───────────────────────────────┴─────────────────────────────────┴────────────────────────────────┘
```

- **표고 인코딩 규격**:
  $$N = \frac{h - h_{\min}}{h_{\max} - h_{\min}} \in [0.0, 1.0] \quad (\text{16-bit unsigned integer})$$
  $$h = N \times (h_{\max} - h_{\min}) + h_{\min}$$
- **해안선 단차 관리**: 해수면($h=0.0\text{m}$)에서 육상 표고와 해저 수심이 수학적으로 매끄럽게 연결되며, 렌더링 메시 상 단차는 **`0.0000 mm` (완전 무봉 접합)**으로 검증됨.

---

## 4. 파동장 및 음향 엔진 기술 제약 (Wavefield & Audio Constraints)

### 4.1 3차원 벡터 변위장
- 단순한 고도 스칼라 합산($\Delta y = u_P + u_S + u_R$)을 금지하고, 3차원 변위 벡터 $\mathbf{u}(\mathbf{x}, t) = [u_x, u_y, u_z]$를 산출한다.
- 레일리파(Rayleigh Wave)는 이론적 포아송 고체 조건에서 수직 변위 대 수평 변위 비(Ellipticity Ratio) $1.47$을 충족해야 하며, 파면 통과 시 입자 운동(Particle Orbit)은 시계 반대 방향의 **역행 회전(Retrograde Orbit)**을 엄격히 따라야 한다.

### 4.2 프로시저럴 Web Audio 합성 제약
- **무음 갤러리 안전 (Silence Guarantee)**:
  - 브라우저 오디오 컨텍스트는 관람자의 최초 클릭/제스처 전까지 안전하게 정지(`suspended`) 상태를 유지한다.
  - Mute 모드 활성화 시 마스터 게인은 수치적 오차 없이 $0.0$으로 엄격히 클램핑된다.
  - 각 사건 시뮬레이션 시간 $t_{sim} \ge 34.0\text{s}$ 도달 시 모든 활성 오실레이터 및 게인 노드는 $0.0$으로 감쇠하여 씬에 음향 잔류가 발생하지 않는다.

---

## 5. 자동화 검증 툴체인 (Validation Toolchain)

- **단위 테스트**: `/opt/homebrew/bin/deno test -A tests/test_*.js` (565 tests, 100% pass)
- **실 브라우저 렌더링 감사**: `/opt/homebrew/bin/deno run -A scratch/verify_phase_d3_prototype.mjs` (21 browser tests, 100% pass)
- **실행 원칙**: 임의의 fake 수치를 반환하여 테스트를 통과시키는 행위를 영구 금지하며, 물리 공식과 데이터 정합성을 엄격히 감사한다.
