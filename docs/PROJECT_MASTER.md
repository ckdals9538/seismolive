# [SEISMOLIVE v4.0 — PROJECT MASTER SPECIFICATION]
## 단일 기준 문서 (Single Source of Truth)
### Status: Active Governance Baseline | Target: Three.js Web Media Art
### Calibrated: 2026-11-06 (Post-Restructuring Baseline)

---

## 1. 프로젝트의 본질과 정체성 (Core Identity)

SEISMOLIVE는 일반적인 지진 모니터링 대시보드, 지진 교육용 시뮬레이터, 또는 3D 게임 비주얼라이저가 아니다.

본 작품은 **지구의 실제 지형과 해저를 무대로, 지진이라는 지구물리학적 사건이 공간 전체의 빛·형태·소리를 변화시키고, 그 변화 속에서 인류의 역사적 기록이 숭고한(Sublime) 시각적 언어로 피어나는 몰입형 시청각 미디어아트(Sublime Audiovisual Media Art)**다.

- **서사적 구조 (The Grand Arc)**:
  $$\text{Earth is the Stage} \longrightarrow \text{Earthquake is the Event} \longrightarrow \text{History is the Memory} \longrightarrow \text{Light, Space, Motion, Sound are the Language}$$
- **미학적 기조**: 차분하고 서늘한 숭고한 야간 지구(Sublime Nocturnal Earth)와 야간 암석권(Nocturnal Lithosphere). 어떠한 인공 기념비나 비석도 배제하며 지구 자체가 무대다.
- **관람자의 첫인상**: 기술적 복잡성이나 계측기 UI보다 먼저 압도적인 공간의 깊이, 장엄한 어둠, 절제된 시각적 아름다움을 마주해야 하며, 이후에야 그 공간이 실제 지진과 역사 기록의 데이터로 호흡하고 있음을 발견해야 한다.

---

## 2. 4대 핵심 공간 및 시각 철학 (Foundational Principles)

### 2.1 단일 연속 3D 세계 (Continuous World)
- 지구본(Tier 0 Global Ellipsoid), 지역 지형(Tier 1 Regional Terrain), 국소 고해상도 지형(Tier 2 Local Inset), 지평선, 심연의 해저는 분절된 개별 씬(Scene)이 아니라 **하나의 연속된 3D 물리 공간(Continuous 3D World)**에 존재한다.
- 씬 전환 시 화면을 암전시키거나 별도 2D 지도로 튕기지 않고, 우아한 카메라 궤적을 통해 대기권 밖에서 국소 산맥과 해구로 끊김 없이 이동한다.

### 2.2 암흑의 미학과 정지 화면의 완성도 (Nocturnal Restraint & Still Frame Perfection)
- **화면의 75% ~ 88%는 깊고 고요한 어둠이 지배**한다. 빛은 지질학적 균열, 파동 필라멘트, 대기 지평선의 경계에서만 절제되어 응축된다.
- 어떠한 파동 애니메이션이나 음향이 없는 **정지 화면(Still Frame) 1장만으로도 미술관에 전시할 수 있는 수준의 구도, 빛, 조각적 질감, 미학적 자립성**을 증명해야 한다. 움직임이나 소리로 지형과 조명의 조잡함을 가리지 않는다.

### 2.3 게임 VFX 및 대시보드 요소 영구 금지 (Strict Anti-VFX Guardrails)
다음 요소는 코드베이스에서 영구히 금지된다:
1. **거대한 반투명 구체 돔 (Spherical Volume Shells)**: SF 에너지 실드/방어막 형태의 P/S파.
2. **수직 발광 실린더 및 기둥 (Vertical Laser Beams / Cylinders)**: 포털이나 비콘 형태의 광선 기둥.
3. **무지개색 히트맵 (Rainbow / Jet Colormap)**: 원색 등진도선 그래픽.
4. **한자(漢字) 및 3D 묘비 (Stele)**: 공간을 오염시키는 3D 비석 오브젝트 및 현판 텍스트.
5. **HUD 계측 카드 및 범례**: 화면 모서리를 차지하는 디지털 UI 박스, 고도계, 나침반.

### 2.4 과학적 무결성과 예술적 번역 (Scientific Integrity)
- 실측되거나 사료로 검증되지 않은 수치(진원 깊이, 규모, 진앙 좌표, 단층면)는 임의의 숫자를 날조하지 않고 `uncertain` 또는 `null`로 유지한다.
- 검증되지 않은 수학식을 '실측 GMPE'로 거짓 명명하지 않는다.
- 데이터는 UI 카드로 나열되는 대신, 지형과 해양 셰이더의 파라미터(고도 변위, 균열 발광, 대기 산란, 지진파 주파수 및 지각 감쇠)로 직접 번역된다.

---

## 3. 핵심 4대 예술·물리 계층 (The Four Foundational Layers)

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                        SEISMOLIVE v4.0 FOUR-LAYER ARCHITECTURE                         │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ Layer 4: Living Soundfield   │ Procedural Web Audio Synth, Event-Specific Resonators,  │
│                              │ Infrasound Bedrock Rumble, Strict Silence Protocols     │
├──────────────────────────────┼─────────────────────────────────────────────────────────┤
│ Layer 3: Living Memory       │ 8-Field Archival Metadata, Dual-Pass Soft Dark Cushion, │
│                              │ 6-Stage Temporal Lifecycle, Terrain-Aware 3D Typography │
├──────────────────────────────┼─────────────────────────────────────────────────────────┤
│ Layer 2: Universal Wavefield │ 3D Vector Displacement: u(x,t) = uP + uS + uR,          │
│                              │ Poisson Solid Rayleigh Ellipticity, GPU Vertex Shader   │
├──────────────────────────────┼─────────────────────────────────────────────────────────┤
│ Layer 1: Earth Foundation    │ WGS84 / ECEF / ENU Continuous 3D Coordinate Space,      │
│                              │ 3-Tier Copernicus DEM + NOAA ETOPO Bathymetry Inset     │
└──────────────────────────────┴─────────────────────────────────────────────────────────┘
```

1. **Earth Foundation (무대로서의 지구)**:
   - WGS84 회전 타원체 ($a=6378137.0\text{m}, f=1/298.257223563$) 기반 ECEF 및 국소 ENU 좌표계.
   - 중심 상대 원점(Center-Relative Origin) 변환을 통해 60km 지역 거리에서 GPU Float32 공간 양자화 오차를 $<0.05\text{m}$로 억제.
   - Copernicus DEM 30m 육상 표고와 NOAA ETOPO 해저 수심의 $0.0000\text{mm}$ 무봉 접합.
2. **Universal Wavefield (사건으로서의 지진)**:
   - 3차원 벡터 변위장: $\mathbf{u}(\mathbf{x},t) = \mathbf{u}_P(\mathbf{x},t) + \mathbf{u}_S(\mathbf{x},t) + \mathbf{u}_R(\mathbf{x},t)$.
   - 이론적 포아송 고체 레일리파 타원율(Ellipticity Ratio $\approx 1.47$)과 역행(Retrograde) 궤도 보존.
   - 현대 계측 사건의 유한 단층 모델(Finite Fault)과 역사 사건(1681 양양)의 등방성 방사 시각적 근사 의미 분리.
3. **Living Memory (기억으로서의 역사)**:
   - 8필드 사료 메타데이터 스키마 (`token`, `sourceId`, `originalPassage`, `translation`, `evidenceClass`, `editorialRationale`, `confidence`, `spatialMotif`).
   - 단어 단위의 순수 한국어/현지어 정제 언어만 허용 (문장형 텍스트 및 한자 비석 배제).
   - 듀얼 패스 암흑 쿠션(Dual-Pass Soft Ambient Dark Cushion) 셰이더로 지형 요철과의 분리 및 시인성 보장.
4. **Living Soundfield (청각적 공간 공명)**:
   - Web Audio API 기반 지진학적 변수($f_0, Q, D$) 직결 실시간 프로시저럴 합성.
   - 사건별 독립적 음향 아키텍처 (양양 심해 공명, 경주 화강암 충격, 포항 연약지반 불협화음, 구마모토 단층마찰, 튀르키예 300km 다중 지연망).
   - 엄격한 침묵 규약(Silence Protocols): $t_{sim} \ge 34.0\text{s}$ 후 음향 잔향 0.0 수렴, 정지 화면 갤러리 모드 완전 무음.

---

## 4. 정제된 코드베이스 구조 (Cleaned Codebase Directory Map)

```
seismolive/
├── index.html                           # 클린 루트 진입점 (3D 연속 세계 자동 기동)
├── prototype_g2_continuous_seismic_world.html # 통합 3D 연속 세계 메인 애플리케이션 (모듈화 완료, 2,657행)
├── js/
│   ├── 3d/
│   │   ├── geodeticEllipsoid.js         # WGS84 / ECEF / ENU 측지학적 좌표 기반 모듈
│   │   ├── terrainDataResolver.js       # 3-Tier DEM/수심 데이터 리졸버 & 표고 분류기
│   │   ├── seismicSourceModel.js        # 유한 단층 및 속도 구조 모델
│   │   ├── universalWavefieldEngine.js  # 3차원 벡터 파동장 물리 엔진
│   │   ├── universalStressMatrix.js     # 전 지구 지형 적응 스트레스 매트릭스
│   │   ├── livingMemoryEngine.js        # 사료 시맨틱 파서, 타이포그래피 & 키네틱 엔진 (1,654행)
│   │   └── wavefieldVisualOrchestrator.js# 셰이더 및 시각화 오케스트레이터
│   ├── audio/
│   │   └── livingSoundfieldEngine.js    # 사건별 프로시저럴 Web Audio 사운드필드 엔진 (685행)
│   ├── data/
│   │   ├── historicalArchiveDB.js       # 1681 양양 승정원일기/조선왕조실록 사료 DB
│   │   └── instrumentalCatalogDB.js     # 4대 계측 지진학 카탈로그 DB
│   └── lib/
│       └── three.module.js              # Standalone Three.js r160 ES Module
├── assets/
│   └── terrain/
│       ├── Copernicus_DSM_COG_*.tif     # 원본 Copernicus GeoTIFF 파일
│       └── bathymetry/                  # 5대 사건 육해상 융합 UNORM16 DEM 바이너리
├── captures/
│   ├── g1_lookdev/                      # G1 무대 LookDev 검증 캡처
│   └── g2_phase1/                       # G2 초기 시각화 캡처
├── tests/
│   ├── test_geodetic_ellipsoid.js       # 15 tests (PASS)
│   ├── test_terrain_resolver.js         # 68 tests (PASS)
│   ├── test_universal_stress_matrix.js  # 32 tests (PASS)
│   ├── test_phase_c_wavefield.js        # 74 tests (PASS)
│   ├── test_phase_d_living_memory.js    # 72 tests (PASS)
│   ├── test_phase_d2_archival_expansion.js # 252 tests (PASS)
│   └── test_phase_d3_soundfield_integrity.js # 52 tests (PASS)
│                                        # [Total: 565 Unit Tests Passed]
├── scratch/
│   └── verify_phase_d3_prototype.mjs    # 21 Browser Acceptance Tests (PASS)
├── archive/
│   ├── legacy_2d/                       # 과거 2D Leaflet 대시보드 코드 및 모듈 격리
│   ├── legacy_3d/                       # 구형 구면 프로토타입 격리
│   ├── legacy_prototypes/               # 중간 검증용 LookDev HTML 아카이브
│   ├── legacy_docs/                     # 과거 2D CARTO 문서 아카이브
│   ├── legacy_scripts/                  # 과거 일회성 생성 스크립트 아카이브
│   └── legacy_captures/                 # 이전 단계 캡처 아카이브
└── docs/
    ├── PROJECT_MASTER.md                # [본 문서] 단일 기준 규격서
    ├── CURRENT_STATUS.md                # 실질적 진척도 및 테스트 현황
    ├── DEVELOPMENT_ROADMAP.md           # 5단계 전진 개발 로드맵
    ├── TECHNICAL_CONSTRAINTS.md         # 기술적 제약 및 지리공간 파이프라인
    ├── DESIGN_DECISIONS.md              # 설계 결정 및 아키텍처 타협 해소 기록
    └── DEVELOPMENT_JOURNAL.md           # 프로젝트 연구 일지 및 크로니클
```

---

## 5. 프로젝트 현재 상태 및 다음 개발 단계

- **현재 확정 상태**: Phase A(WGS84 기반), Phase B(범용 지형 적응), Phase C(3D 벡터 파동장), Phase D(리빙 메모리 & 사운드필드), 및 코드베이스 전면 최적화/모듈화 완료.
- **다음 마일스톤**: **`Phase E: Grand Unification & Master Exhibition Experience`**
  - 대기권 궤도(Tier 0)에서 진앙 지표면(Tier 1/2)으로 이어지는 무봉 연속 카메라 비행 연출.
  - 5개 벤치마크 지진의 자동 순환 갤러리 전시 모드(Gallery Exhibition Mode) 구축.
