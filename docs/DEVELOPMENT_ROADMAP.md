# [SEISMOLIVE v4.0 — DEVELOPMENT ROADMAP]
## 전진 개발 파이프라인 및 최종 통합 로드맵
### Calibrated: 2026-11-06 (Post-Restructuring Baseline) | Target: Exhibition-Ready Masterpiece

---

## 1. 완료 및 동결된 기반 단계 (Completed & Locked Baselines)

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                        COMPLETED & LOCKED FOUNDATIONS (PHASES A ~ D)                   │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ [ Phase A: Earth Foundation ] ──▶ WGS84 3-Tier 연속 좌표계, Copernicus DEM 무봉 접합   │
│                                  (Unit Tests 15 + 68 Passed)                           │
│                 │                                                                      │
│ [ Phase B: Universal Adaptation ] ──▶ 5개 지진 사건 DEM 바이너리 & 8대 극단 지형 적응   │
│                                  (Stress Tests 32 Passed)                              │
│                 │                                                                      │
│ [ Phase C: Universal Wavefield ] ──▶ 3차원 벡터 변위장 u(x,t), 레일리파 타원율, 관측속도│
│                                  (Physics Tests 74 Passed)                             │
│                 │                                                                      │
│ [ Phase D: Living Memory & Sound ] ──▶ 8필드 사료 스키마, 타이포그래피, 프로시저럴 음향│
│                                  (Archival & Audio Tests 376 Passed, Browser 21 Passed)│
│                 │                                                                      │
│ [ Codebase Restructuring ] ──▶ HTML 4,074행->2,657행 경량화, 레거시 2D 완전 격리 아카이브│
│                                  (565 Unit Tests + 21 Browser Tests All Passed)        │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. 향후 집중 마일스톤: Phase E (Grand Unification & Master Exhibition)

앞으로의 모든 작업은 파편화된 기능 추가나 중복 엔진 개발을 영구히 중단하고, **이미 구축된 4대 핵심 계층을 하나의 장엄한 인터랙티브 시청각 예술 작품으로 결합하는 Phase E**에 집중된다.

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                  PHASE E: GRAND UNIFICATION & MASTER EXHIBITION ROADMAP                │
├────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                        │
│   [ E1: Grand Interactive Experience Architecture ]                                    │
│   - 무대(Earth) ──▶ 사건(Event) ──▶ 기억(Memory) ──▶ 침묵(Silence)으로 이어지는         │
│     장엄한 서사 생명주기 및 관람자 인터랙션 상태 머신 정립.                              │
│                                                                                        │
│   [ E2: Continuous Orbit-to-Epicenter Camera Flight ]                                  │
│   - 대기권 밖 야간 지구본(Tier 0)에서 시작하여 구면 곡선 궤적을 그리며                   │
│     국소 진앙 지표면(Tier 1/2)으로 매끄럽게 활강하는 무봉 시네마틱 카메라 안무.         │
│                                                                                        │
│   [ E3: Master LookDev Refinement & Still-Frame Perfection ]                           │
│   - 4K 대형 스크린 미술관 전시 환경에 맞춘 조각적 지형 사광, 산악 능선 미스트,        │
│     서늘한 달빛 림 라이트 튜닝 (정지 화면 1장만으로도 미술관 전시 수준 검증).            │
│                                                                                        │
│   [ E4: Autonomous Gallery Exhibition Mode ]                                           │
│   - 5개 지진 사건(양양 ──▶ 경주 ──▶ 포항 ──▶ 구마모토 ──▶ 튀르키예)을                    │
│     인간의 조작 없이도 자율적으로 순환하며, 각 사건마다 장엄한 파동과 사료,             │
│     그리고 엄격한 침묵을 거쳐 다음 사건으로 이어지는 무한 루프 전시 모드.               │
│                                                                                        │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. 세부 실행 계획 및 수락 기준 (Acceptance Criteria)

### E1. Grand Interactive Experience Architecture
- **목표**: 관람자가 지진을 '데이터'가 아니라 '공간적 사건'과 '인류의 기억'으로 체험하도록 돕는 통일된 인터랙션 설계.
- **수락 기준**:
  - `EARTH_STAGE` (고요한 지구 무대) $\to$ `EVENT_STRIKE` (지진 파동 전파) $\to$ `MEMORY_EMERGENCE` (사료 단어 생성 및 공명) $\to$ `SILENT_AFTERMATH` (완전한 무음 잔광)의 4단계 인터랙션 시퀀스 정상 작동.
  - 관람자 상호작용(사건 선택, 카메라 시점 전환, 언어 모드 변경) 시 렌더링 끊김 0.0ms.

### E2. Continuous Orbit-to-Epicenter Camera Choreography
- **목표**: 씬 분절이나 로딩 화면 없이, 단일 연속 3D 공간에서 대기권 궤도부터 국소 산악 진앙지까지 끊김 없이 비행.
- **수락 기준**:
  - Tier 0 타원체 중심 상대 거리에서 Tier 1/2 국소 진앙지로 진입할 때 쿼터니언 보간(SLERP) 및 부드러운 감속 곡선(Smoothstep) 적용.
  - 비행 중 카메라 젬(Gimbal Lock) 및 지형 메시 관통(Clipping) 0건.

### E3. Master LookDev Refinement & Still-Frame Perfection
- **목표**: 어떠한 움직임과 소리가 없는 상태에서도 정지 화면 한 장이 조각품 수준의 미학적 자립성을 지니도록 완성.
- **수락 기준**:
  - 5개 사건 전부에 대해 1920×1080 및 4K 해상도 정지 캡처 수행.
  - 암흑 대비(화면의 75~88% 고요한 어둠 유지)와 사광 림 라이트 아래 지형 굴곡 요철 식별성 동시 확보.
  - 게임식 화려한 블룸, 파티클 폭발, 레이저 기둥 0건 원칙 엄수.

### E4. Autonomous Gallery Exhibition Mode
- **목표**: 미술관 및 갤러리 미디어월 환경에서 24시간 자율 구동되는 신뢰성 높은 전시 모드.
- **수락 기준**:
  - 5개 사건 순환 주기(각 사건당 약 35~40초, 전체 1사이클 약 3분) 동안 메모리 누수(Memory Leak) 0건.
  - 사건 전환 시 이전 사건의 사운드 및 GPU 버퍼 잔류 0건.
  - 최소 60.0 FPS 유지.
