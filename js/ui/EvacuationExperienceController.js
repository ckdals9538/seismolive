// ============================================================================
// SEISMOLIVE v4.0 — Unified 3D City Evacuation & Nationwide Experience Controller
// File: js/ui/EvacuationExperienceController.js
//
// Shared across BOTH:
//   1) index.html Single-Canvas ExhibitionModeManager (MODE_LOCAL_4KM_RESPONSE)
//   2) viewer_p2_6.html standalone URL
//
// Features:
//   - Persistent Mini-Globe Exit (피드백 2)
//   - Nationwide Korea Geocoding + Live Terrarium DEM & OSM 3D Loading (피드백 6)
//   - Seamless Intro Seismic Brief -> Evacuation -> Educational Shelter Arrival (피드백 3 & 4)
//   - Direct 3D Building Hover/Click Raycasting + Bottom Origin-to-Shelter Strip (피드백 5)
//   - Non-looping Arrival Finale with Justification & Interactive Safety Protocols (피드백 4)
// ============================================================================

import * as THREE from '../lib/three.module.js';
import { HanyangResponseAdapter } from '../response/HanyangResponseAdapter.js';
import { GlobalLocalCameraTransition, CAMERA_STAGES } from '../response/GlobalLocalCameraTransition.js';
import { ResponseUIAdapter } from '../response/ResponseUIAdapter.js';
import { PedestrianRoutingEngine, LINK_STATE } from '../response/PedestrianRoutingEngine.js';
import { buildDynamicFacilityFromPoint } from '../response/CampusWalkRouter.js';
import {
  DATA_PROVENANCE_SOURCE,
  DEFAULT_HANYANG_FACILITY_PACKAGE,
  getFacilityPackageById
} from '../response/HanyangBuildingData.js';
import { buildSimulatedDrillSurveyPacket } from '../response/GroundDataContract.js';
import { LOCATION_CERTAINTY } from '../response/SituationAssessmentEngine.js';
import { HANYANG_LOCAL_4KM_PACKAGE, HANYANG_LOCAL_SPATIAL_VIEWPOINTS } from '../response/HanyangLocalSpatialData.js';
import { HANYANG_CAMPUS_WALK_GRAPH } from '../response/HanyangCampusWalkData.js';
import {
  LocalSpatialMapLayer,
  LOCAL_VISUAL_THEMES,
  samplePointAlong3D,
  sampleGridHeightAt
} from '../response/LocalSpatialMapLayer.js';
import {
  resolveActiveSeismicEvent,
  buildEvacuationSafetyCheckpoints,
  evaluatePathProgressState
} from '../response/SeismicImpactContext.js';
import {
  KOREA_BENCHMARK_REGIONS,
  HANYANG_SHELTER_JUSTIFICATION,
  POST_ARRIVAL_SAFETY_PROTOCOLS,
  geocodeKoreaQuery,
  loadRegionalSpatialPackage
} from '../response/NationwideKoreaSpatialEngine.js';

export const EXPERIENCE_PHASES = Object.freeze({
  SEISMIC_BRIEF: 'PHASE_SEISMIC_BRIEF',
  EVACUATION_ACTIVE: 'PHASE_EVACUATION_ACTIVE',
  SHELTER_ARRIVED: 'PHASE_SHELTER_ARRIVED'
});

function withExtendedFar(viewpoints) {
  const out = {};
  for (const [k, vp] of Object.entries(viewpoints || {})) {
    out[k] = { ...vp, far: Math.max(vp?.far || 6500, 6500) };
  }
  return out;
}

export function renderEvacuationHudMarkup(mountRoot) {
  mountRoot.classList.add('evac-hud-root');
  mountRoot.innerHTML = `
    <div id="spatial-label-layer"></div>
    <div id="walker-callout">이동 안내 · 잔여 -- m</div>
    <div id="building-hover-pill">건물 · 클릭하여 여기서 대피 시작</div>

    <div id="seismic-brief-banner" role="dialog" aria-label="지진 발생 및 대피 개시 안내">
      <div class="sb-eyebrow" id="sb-eyebrow">SEISMIC ARRIVAL · 진원 도달 확인</div>
      <h2 class="sb-title" id="sb-title">주 진동 통과 완료 · 보행 대피를 개시합니다</h2>
      <p class="sb-detail" id="sb-detail">진앙 방향과 주변 건축물 낙하물 위험 구역을 피하는 최적 도보 경로를 산출했습니다.</p>
      <div class="sb-actions">
        <button type="button" class="sb-start-btn" id="btn-sb-start-evac">대피 동선 바로 시작</button>
      </div>
    </div>

    <header id="evac-header-overlay">
      <div class="evac-top-action-row">
        <button type="button" class="mini-globe-exit-btn" id="btn-evac-back-globe" title="지구본 메인 화면으로 돌아갑니다">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="12" cy="12" r="9.5"/>
            <ellipse cx="12" cy="12" rx="4.2" ry="9.5"/>
            <path d="M2.8 12h18.4M4.5 7.5h15M4.5 16.5h15"/>
          </svg>
          <span>← 지구본</span>
        </button>

        <div class="region-picker-wrap">
          <button type="button" class="region-switcher-btn" id="btn-region-switcher" title="대한민국 전역 3D 지형·건물·대피 경로 전환">
            <span class="reg-tag">KR 3D</span>
            <span id="region-active-label">서울 성동 · 한양대</span>
            <span>▾</span>
          </button>

          <div id="region-search-popover" aria-label="대한민국 지역 검색 및 전환">
            <form class="region-search-form" id="korea-region-search-form">
              <input type="search" id="korea-region-search-input" class="region-search-input"
                placeholder="국내 지명·주소 검색 (예: 경주, 해운대, 강남역)" aria-label="국내 지명 검색" />
              <button type="submit" class="region-search-submit">이동</button>
            </form>
            <div id="region-search-results"></div>
            <div class="lab-title">국내 주요 지진·도심 기준 권역</div>
            <div class="region-chips-grid" id="region-chips-grid"></div>
          </div>
        </div>
      </div>

      <div class="header-eyebrow">
        <span class="live-dot"></span>
        <span>SEISMOLIVE · 국지 지진 대응 안내</span>
      </div>
      <h1 class="header-route-headline" id="evac-route-headline">제1공학관(212동) → 한양대 대운동장 (737.9 m)</h1>
      <div class="header-quake-impact" id="quake-impact-summary">
        <div class="quake-line">
          <span class="quake-tag" id="quake-provenance-tag">진앙 기준 확인</span>
          <span id="quake-origin-line">진앙 거리·방위 산출 중...</span>
        </div>
        <div class="impact-sub" id="quake-impact-line">현재 위치 영향 평가 중...</div>
      </div>
    </header>

    <div id="exhibition-bar">
      <div class="top-capsule">
        <button type="button" class="ctrl-btn" id="btn-stage-local4km" title="광역 지형·진앙 방향 조망">광역 4km</button>
        <button type="button" class="ctrl-btn active" id="btn-stage-campus" title="내 건물·대피동선·대피소 전체 조망">캠퍼스 동선</button>
        <button type="button" class="ctrl-btn" id="btn-stage-bldg" title="출발 건물 구조 확인">내 건물</button>
        <span class="top-divider"></span>
        <button type="button" class="ctrl-btn active" id="btn-route-shortest" title="가장 빠른 최단 경로 우선 표시">최단 경로</button>
        <button type="button" class="ctrl-btn" id="btn-route-stepfree" title="계단·낙하위험을 피하는 무단차 우회 경로 표시">무단차 우회</button>
        <span class="top-divider"></span>
        <button type="button" class="ctrl-btn" id="btn-theme-toggle" title="야간 모놀리스 ↔ 주간 지도 테마 전환">주간 지도</button>
        <button type="button" class="ctrl-btn active" id="btn-toggle-rules" title="동선 안전수칙 팝업 켜기/끄기">수칙 팝업</button>
        <span class="top-divider"></span>
        <button type="button" class="ctrl-btn" id="btn-dev-lab-toggle" title="시뮬레이션 조건·현장실측 F-01~F-06·전시 궤도 개발자 실험실">개발자 실험실 ▾</button>
      </div>

      <aside id="dev-lab-drawer" aria-label="개발자 실험실 및 현장 검증 도구">
        <div class="lab-section">
          <span class="lab-title">카메라 스케일 & 실내 점검</span>
          <div class="lab-row">
            <button type="button" class="lab-btn" id="btn-stage-earth">지구 궤도 시점</button>
            <button type="button" class="lab-btn" id="btn-stage-personal">3F 실내 진입부</button>
            <button type="button" class="lab-btn" id="btn-replay-seismic-brief">지진 도달 연출 재생</button>
          </div>
        </div>

        <div class="lab-section">
          <span class="lab-title">지진 시나리오 단계 테스트 (Simulation Timeline)</span>
          <div class="lab-row">
            <button type="button" class="lab-btn" id="btn-t0">T+0s 진동 엄폐</button>
            <button type="button" class="lab-btn" id="btn-t40">T+40s 탈출 개방</button>
            <button type="button" class="lab-btn" id="btn-t67">T+67s 우회 재탐색</button>
            <button type="button" class="lab-btn" id="btn-t110">T+110s 여진 차단</button>
          </div>
          <div class="lab-row">
            <button type="button" class="lab-btn" id="btn-hazard-poly-toggle">위험폴리곤 회피 테스트</button>
            <button type="button" class="lab-btn" id="btn-xray-toggle">주변건물 X-Ray</button>
            <button type="button" class="lab-btn" id="btn-eco-toggle">Eco 60fps</button>
          </div>
        </div>

        <div class="lab-section">
          <span class="lab-title">지진 사건 연동 테스트 (Catalog / USGS Event)</span>
          <div class="lab-row">
            <button type="button" class="lab-btn" data-event-preset="hist_2016_gyeongju">2016 경주 M5.8</button>
            <button type="button" class="lab-btn" data-event-preset="hist_2017_pohang">2017 포항 M5.4</button>
            <button type="button" class="lab-btn" data-event-preset="hist_2024_buan">2024 부안 M4.8</button>
          </div>
        </div>

        <div class="lab-section">
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <span class="lab-title">P3.1 현장 실측 검증 (F-01~F-06)</span>
            <button type="button" class="lab-btn" id="btn-field-audit-toggle">체크리스트 열기 (0/6)</button>
          </div>
          <div id="field-audit-drawer">
            <div style="display:flex; justify-content:space-between; margin-bottom:6px; border-bottom:1px solid var(--evac-hairline); padding-bottom:4px;">
              <strong style="color:var(--evac-ink);">F-01~F-06 점검</strong>
              <span id="field-audit-overall" style="color:var(--evac-muted);">PROVISIONAL (0/6)</span>
            </div>
            <div id="field-audit-list" style="display:flex; flex-direction:column; gap:3px;"></div>
            <div class="lab-row" style="margin-top:8px;">
              <button type="button" class="lab-btn" id="btn-p31-drill-approve">6/6 적격 승인(리허설)</button>
              <button type="button" class="lab-btn" id="btn-p31-drill-reject">미달 거부(리허설)</button>
              <button type="button" class="lab-btn" id="btn-p31-reset">초기화</button>
            </div>
            <div id="p31-audit-message" style="margin-top:5px; font-size:9.5px; color:var(--evac-muted);">현장 실측 전 기본 상태</div>
          </div>
        </div>

        <div class="lab-section">
          <span class="lab-title">공간 엔진 진단 및 불확실성 로그</span>
          <div class="telemetry-list">
            <div>상태: <strong id="meta-camera-stage">--</strong> · 이동: <strong id="meta-can-move">--</strong> · 경로: <strong id="meta-route-mode">--</strong></div>
            <div id="meta-detail">--</div>
            <div id="meta-unverified">--</div>
          </div>
        </div>
      </aside>
    </div>

    <div id="map-controls">
      <button type="button" class="compass-btn" id="btn-compass-north" title="북쪽을 위로 정렬">
        <span>N</span>
        <svg id="compass-needle" viewBox="0 0 24 28" aria-hidden="true">
          <path d="M12 2 18 22 12 17 6 22Z" fill="currentColor" opacity="0.85"/>
        </svg>
      </button>
      <div class="zoom-stack">
        <button type="button" class="zoom-btn" id="btn-zoom-in" title="확대">+</button>
        <button type="button" class="zoom-btn" id="btn-zoom-out" title="축소">−</button>
        <button type="button" class="zoom-btn" id="btn-reset-view" title="동선 전체 보기로 복귀">↺</button>
      </div>
    </div>

    <div id="bottom-stage-stack">
      <section id="safety-rule-popup" aria-live="polite">
        <div class="sr-top">
          <span class="sr-step-meta" id="sr-step-meta">STEP 01 · 실내 출발</span>
          <button type="button" class="sr-close-btn" id="btn-close-rule-popup" title="수칙 팝업 잠시 접기">&times;</button>
        </div>
        <h2 class="sr-headline" id="sr-headline">진동 멈춤 확인 후 이동을 시작하십시오</h2>
        <p class="sr-body" id="sr-body">흔들림 중엔 책상 아래서 머리를 보호하세요.</p>
        <div class="sr-caution" id="sr-caution">승강기(엘리베이터)는 절대 이용하지 마십시오.</div>

        <div id="arrival-education-panel">
          <div class="arrival-metrics-strip" id="arrival-metrics-strip"></div>
          <p class="arrival-why-text" id="arrival-why-text"></p>
          <div class="arrival-protocol-row" id="arrival-protocol-row"></div>
          <div class="arrival-footer-bar">
            <span id="arrival-protocol-feedback">대피소 도착 완료 · 위 행동 수칙 항목을 눌러 현장 안전 절차를 확인하십시오.</span>
            <button type="button" class="arrival-replay-btn" id="btn-replay-route">동선 처음부터 다시 보기</button>
          </div>
        </div>
      </section>

      <nav id="evac-dock" aria-label="대피 동선 주행 및 출발지 선택">
        <div class="dock-origin-strip">
          <div class="dock-origin-route">
            <span class="dock-origin-label">출발지</span>
            <div class="origin-select-group" id="origin-select-group">
              <button type="button" class="origin-pill active" id="btn-fac-212">212동 제1공학관</button>
              <button type="button" class="origin-pill" id="btn-fac-hit">701동 HIT</button>
              <button type="button" class="origin-pill" id="btn-fac-paiknam">백남학술정보관</button>
            </div>
            <span style="color:var(--evac-muted);">→</span>
            <strong id="dock-shelter-target" style="color:var(--evac-brass); font-weight:600;">한양대 대운동장</strong>
          </div>
          <span class="dock-click-hint" id="dock-click-hint">지도 위 3D 건물을 클릭해 출발 위치 변경 가능</span>
        </div>

        <div class="dock-controls-row">
          <button type="button" class="play-route-btn" id="btn-walk-play" title="내 대피 동선 따라가기 재생/일시정지">
            <svg id="walk-play-icon" viewBox="0 0 16 16"><path d="M4 2.5l9 5.5-9 5.5z"/></svg>
            <span id="walk-play-label">동선 안내</span>
          </button>
          <button type="button" class="follow-btn" id="btn-follow-cam" title="대피자를 따라 3D 시점이 함께 이동합니다">시점 추적</button>
          <div class="scrubber-wrap">
            <input type="range" id="route-scrubber" min="0" max="1000" value="0" step="1" aria-label="대피 경로 위치 조절" />
          </div>
          <div class="dock-metrics">
            <span class="dock-dist-strong" id="dock-remaining-dist">잔여 -- m</span>
            <span id="dock-walk-eta">약 --분</span>
          </div>
        </div>
        <div class="milestones-row" id="milestones-row"></div>
      </nav>
    </div>
  `;
}

export class EvacuationExperienceController {
  constructor(options = {}) {
    this.scene = options.scene;
    this.localWorldGroup = options.localWorldGroup || options.scene;
    this.camera = options.camera;
    this.renderer = options.renderer;
    this.controls = options.controls;
    this.mountRoot = options.mountRoot;
    this.domElement = options.domElement || options.renderer?.domElement || null;
    this.onReturnToGlobe = typeof options.onReturnToGlobe === 'function' ? options.onReturnToGlobe : null;
    this.baseDpr = Math.min((typeof window !== 'undefined' ? window.devicePixelRatio : 1) || 1, 2);

    this.activeVisualTheme = options.initialTheme === 'ARCHITECTURAL_DAY' ? 'ARCHITECTURAL_DAY' : 'MONOLITH_NIGHT';
    this.activeRegionId = 'seoul_hanyang';
    this.activeSpatialPkg = HANYANG_LOCAL_4KM_PACKAGE;
    this.activeWalkGraph = HANYANG_CAMPUS_WALK_GRAPH;
    this.activeRegionInfo = KOREA_BENCHMARK_REGIONS[0];
    this.activeFacilityId = 'BLDG_212_ENG1';
    this.activeFacilityPkg = DEFAULT_HANYANG_FACILITY_PACKAGE;
    this.activeShelterJustification = HANYANG_SHELTER_JUSTIFICATION['OA-21060'];
    this.activeArrivalProtocolId = POST_ARRIVAL_SAFETY_PROTOCOLS[0].id;

    this.experiencePhase = EXPERIENCE_PHASES.EVACUATION_ACTIVE;
    this.briefTimerId = null;
    this.hazardPolyActive = false;
    this.routeProgressT = 0.04;
    this.walkPlaying = options.autoPlay !== false;
    this.followCameraEnabled = false;
    this.safetyPopupDismissed = false;
    this.activeSeismicCtx = null;
    this.activeCheckpoints = [];
    this.hoveredBuilding = null;
    this._prevStepId = null;
    this._lastHoverCheckMs = 0;
    this._pointerDownPos = { x: 0, y: 0 };

    if (this.mountRoot) {
      renderEvacuationHudMarkup(this.mountRoot);
    }
    this.labelContainer = this._el('spatial-label-layer');

    // Local 3D spatial layer anchored inside localWorldGroup so Single-Canvas isolates cleanly
    this.localSpatialLayer = new LocalSpatialMapLayer(this.localWorldGroup, {
      spatialPackage: HANYANG_LOCAL_4KM_PACKAGE,
      theme: this.activeVisualTheme
    });

    this.router = new PedestrianRoutingEngine({
      useRealMapRouting: true,
      buildingOBBs: HANYANG_LOCAL_4KM_PACKAGE.obbBuildingsFloat32,
      customWalkGraph: HANYANG_CAMPUS_WALK_GRAPH,
      elevationSampler: (e, n) => sampleGridHeightAt(this.activeSpatialPkg.terrainGrid, e, n)
    });

    this.hanyangAdapter = new HanyangResponseAdapter(this.localWorldGroup, {
      scale: 1.0,
      visualScaleFactor: 4.5,
      useRealMapRouting: true,
      buildingOBBs: HANYANG_LOCAL_4KM_PACKAGE.obbBuildingsFloat32,
      router: this.router
    });
    this.uiAdapter = new ResponseUIAdapter({ router: this.router, hanyangAdapter: this.hanyangAdapter });

    this.camTransition = new GlobalLocalCameraTransition({
      camera: this.camera,
      controls: this.controls,
      viewpoints: withExtendedFar({
        ...DEFAULT_HANYANG_FACILITY_PACKAGE.cameraViewpoints,
        REGIONAL_APPROACH: HANYANG_LOCAL_SPATIAL_VIEWPOINTS.REGIONAL_APPROACH,
        CAMPUS_OVERVIEW: HANYANG_LOCAL_SPATIAL_VIEWPOINTS.CAMPUS_OVERVIEW
      })
    });
    if (this.domElement) {
      this.camTransition.attachUserInterruptListeners(this.domElement);
    }

    // 3D Directional Guide, 5 Checkpoints, and Arrival Setback Safety Rings
    this._build3DWalkerAndSetbackVisuals();

    // Raycaster & temporary vectors
    this._raycaster = new THREE.Raycaster();
    this._pointerNDC = new THREE.Vector2();
    this._walkerNextVec = new THREE.Vector3();
    this._walkerProjVec = new THREE.Vector3();
    this._desiredCamPos = new THREE.Vector3();
    this._desiredTargetPos = new THREE.Vector3();
    this._tangentDir = new THREE.Vector3();

    if (this.mountRoot) {
      this._renderRegionBenchmarkChips();
      this._bindDomEvents();
      this._bindCanvasRaycastEvents();
    }

    if (this.controls) {
      this._onControlStart = () => {
        if (this.followCameraEnabled) {
          this.followCameraEnabled = false;
          this._syncFollowButton();
        }
      };
      this.controls.addEventListener('start', this._onControlStart);
    }

    // Default clean ready state
    this.applyVisualTheme(this.activeVisualTheme);
    this.uiAdapter.setUserFloor(3);
    this.uiAdapter.updateStationMotion(0.01, Date.now(), DATA_PROVENANCE_SOURCE.SIMULATED_SCENARIO);
    this.loadAndBindSeismicEvent(options.initialEventId || 'hist_1681_0626');
    this.renderUI();
    this._syncPlayButton();
    this._syncFollowButton();
  }

  _el(id) {
    if (!this.mountRoot) return typeof document !== 'undefined' ? document.getElementById(id) : null;
    return this.mountRoot.querySelector(`#${id}`) || document.getElementById(id);
  }

  _qAll(selector) {
    if (!this.mountRoot) return [];
    return this.mountRoot.querySelectorAll(selector);
  }

  _build3DWalkerAndSetbackVisuals() {
    this.walkerGroup = new THREE.Group();
    this.walkerGroup.name = 'EvacueeDirectionalGuide';
    this.walkerGroup.visible = false;

    this.walkerHalo = new THREE.Mesh(
      new THREE.RingGeometry(3.0, 4.8, 32).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: 0x38bdf8, side: THREE.DoubleSide, transparent: true, opacity: 0.85 })
    );
    this.walkerGroup.add(this.walkerHalo);

    const walkerChevronGeo = new THREE.ConeGeometry(2.8, 6.8, 3);
    walkerChevronGeo.rotateX(Math.PI * 0.5);
    this.walkerChevron = new THREE.Mesh(
      walkerChevronGeo,
      new THREE.MeshBasicMaterial({ color: 0xf8fafc })
    );
    this.walkerChevron.position.y = 1.8;
    this.walkerChevron.scale.set(1.0, 0.55, 1.0);
    this.walkerGroup.add(this.walkerChevron);

    this.walkerMast = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 1.5, 0), new THREE.Vector3(0, 14.0, 0)]),
      new THREE.LineBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.72 })
    );
    this.walkerGroup.add(this.walkerMast);
    this.localWorldGroup.add(this.walkerGroup);

    this.milestones3DGroup = new THREE.Group();
    this.milestones3DGroup.name = 'RouteSafetyCheckpoints3D';
    this.localWorldGroup.add(this.milestones3DGroup);

    const milestoneRingGeo = new THREE.RingGeometry(2.1, 3.0, 24).rotateX(-Math.PI / 2);
    this.milestoneMeshes = [];
    for (let i = 0; i < 5; i++) {
      const m = new THREE.Mesh(
        milestoneRingGeo,
        new THREE.MeshBasicMaterial({ color: 0x94a3b8, side: THREE.DoubleSide, transparent: true, opacity: 0.65 })
      );
      m.visible = false;
      this.milestones3DGroup.add(m);
      this.milestoneMeshes.push(m);
    }

    // Calm concentric shelter safety setback rings shown upon arrival (피드백 4)
    this.shelterSetbackGroup = new THREE.Group();
    this.shelterSetbackGroup.name = 'ShelterSafetySetbackRings3D';
    this.shelterSetbackGroup.visible = false;

    this.setbackInnerRing = new THREE.Mesh(
      new THREE.RingGeometry(14.0, 15.6, 48).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: 0xC89D54, side: THREE.DoubleSide, transparent: true, opacity: 0.78 })
    );
    this.setbackOuterRing = new THREE.Mesh(
      new THREE.RingGeometry(26.0, 27.4, 64).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: 0x38bdf8, side: THREE.DoubleSide, transparent: true, opacity: 0.42 })
    );
    this.shelterSetbackGroup.add(this.setbackInnerRing);
    this.shelterSetbackGroup.add(this.setbackOuterRing);
    this.localWorldGroup.add(this.shelterSetbackGroup);
  }

  _renderRegionBenchmarkChips() {
    const grid = this._el('region-chips-grid');
    if (!grid) return;
    grid.innerHTML = KOREA_BENCHMARK_REGIONS.map(r => `
      <button type="button" class="region-chip-btn ${r.id === this.activeRegionId ? 'active' : ''}" data-kr-region="${r.id}">
        <strong>${r.shortName}</strong>
        <small>${r.lat.toFixed(3)}°N, ${r.lon.toFixed(3)}°E</small>
      </button>
    `).join('');
    grid.querySelectorAll('[data-kr-region]').forEach(btn => {
      btn.addEventListener('click', () => {
        const reg = KOREA_BENCHMARK_REGIONS.find(item => item.id === btn.dataset.krRegion);
        if (reg) {
          this._el('region-search-popover')?.classList.remove('open');
          this._el('btn-region-switcher')?.classList.remove('open');
          this.switchToRegion(reg.lat, reg.lon, { regionId: reg.id, name: reg.name, shortName: reg.shortName });
        }
      });
    });
  }

  async _handleRegionSearchSubmit(query) {
    const resultsEl = this._el('region-search-results');
    if (resultsEl) {
      resultsEl.innerHTML = `<div style="font-size:10.5px; color:var(--evac-muted); padding:4px 2px;">검색 중...</div>`;
    }
    const hits = await geocodeKoreaQuery(query);
    if (!resultsEl) return;
    if (!hits || hits.length === 0) {
      resultsEl.innerHTML = `<div style="font-size:10.5px; color:var(--evac-muted); padding:4px 2px;">검색 결과 없음 (예: 경주, 포항, 부산 해운대)</div>`;
      return;
    }
    resultsEl.innerHTML = hits.map((h, idx) => `
      <button type="button" class="region-result-row" data-hit-idx="${idx}">
        ${h.displayName} <span style="color:var(--evac-muted); font-size:9.5px;">(${h.lat.toFixed(3)}, ${h.lon.toFixed(3)})</span>
      </button>
    `).join('');
    resultsEl.querySelectorAll('[data-hit-idx]').forEach(btn => {
      btn.addEventListener('click', () => {
        const hit = hits[Number(btn.dataset.hitIdx)];
        if (hit) {
          this._el('region-search-popover')?.classList.remove('open');
          this._el('btn-region-switcher')?.classList.remove('open');
          this.switchToRegion(hit.lat, hit.lon, {
            regionId: hit.id,
            name: hit.displayName,
            shortName: hit.shortName
          });
        }
      });
    });
  }

  /**
   * Switch entire 3D topography + OSM buildings + walk graph + shelters to any coordinate in Korea.
   */
  async switchToRegion(lat, lon, opts = {}) {
    const labelEl = this._el('region-active-label');
    if (labelEl) labelEl.textContent = `${opts.shortName || opts.name || '지역'} 불러오는 중...`;

    const pkg = await loadRegionalSpatialPackage(lat, lon, opts);
    this.activeRegionId = pkg.regionInfo?.id || opts.regionId || 'custom_kr';
    this.activeRegionInfo = pkg.regionInfo || KOREA_BENCHMARK_REGIONS[0];
    this.activeSpatialPkg = pkg;
    this.activeWalkGraph = pkg.walkGraph || HANYANG_CAMPUS_WALK_GRAPH;

    this.localSpatialLayer.setSpatialPackage(pkg);
    this.router.setRealMapRouting({
      enabled: true,
      buildingOBBs: pkg.obbBuildingsFloat32,
      customWalkGraph: this.activeWalkGraph,
      elevationSampler: (e, n) => sampleGridHeightAt(pkg.terrainGrid, e, n)
    });

    if (labelEl) labelEl.textContent = this.activeRegionInfo.shortName || this.activeRegionInfo.name;
    this._renderRegionBenchmarkChips();

    // Update origin pills & active shelter for Hanyang vs Nationwide dynamic regions
    if (pkg.isHanyangNative) {
      this.switchFacilityPackage('BLDG_212_ENG1', { skipBrief: false });
      this._toggleHanyangOriginButtons(true);
    } else {
      const firstShelter = pkg.sheltersAndFacilities?.[0] || null;
      this.activeShelterJustification = firstShelter?.justification || null;
      this.switchToDynamicFacility(pkg.initialFacilityPackage, { skipBrief: false });
      this._toggleHanyangOriginButtons(false, pkg.initialFacilityPackage?.buildingMetadata?.name);
    }

    // Bind region seismic event context smoothly
    const sc = this.activeRegionInfo.scenarioEvent;
    if (sc) {
      this.activeSeismicCtx = {
        eventId: sc.id,
        titleKo: sc.title,
        provenanceBadge: pkg.isHanyangNative ? '역사 실록 기반 시나리오' : '대한민국 권역 지진 시나리오',
        magSummary: sc.magnitudeText,
        compassDirKo: `${Math.round(sc.azimuthDeg)}° 방위`,
        distanceKm: sc.distanceKm,
        bearingDeg: sc.azimuthDeg,
        pWaveEtaSec: sc.pArrivalSec,
        sWaveEtaSec: sc.sArrivalSec
      };
      this.localSpatialLayer.setEpicenterContext(this.activeSeismicCtx);
      this._renderEarthquakeImpactHeader();
    }

    this.enterWithSeismicBrief({ durationMs: 2200 });
    return pkg;
  }

  _toggleHanyangOriginButtons(isHanyang, customBuildingName = '선택 건물') {
    const group = this._el('origin-select-group');
    if (!group) return;
    if (isHanyang) {
      group.innerHTML = `
        <button type="button" class="origin-pill ${this.activeFacilityId === 'BLDG_212_ENG1' ? 'active' : ''}" id="btn-fac-212">212동 제1공학관</button>
        <button type="button" class="origin-pill ${this.activeFacilityId === 'BLDG_701_HIT' ? 'active' : ''}" id="btn-fac-hit">701동 HIT</button>
        <button type="button" class="origin-pill ${this.activeFacilityId === 'BLDG_104_PAIKNAM' ? 'active' : ''}" id="btn-fac-paiknam">백남학술정보관</button>
      `;
      this._el('btn-fac-212')?.addEventListener('click', () => this.switchFacilityPackage('BLDG_212_ENG1'));
      this._el('btn-fac-hit')?.addEventListener('click', () => this.switchFacilityPackage('BLDG_701_HIT'));
      this._el('btn-fac-paiknam')?.addEventListener('click', () => this.switchFacilityPackage('BLDG_104_PAIKNAM'));
    } else {
      group.innerHTML = `
        <button type="button" class="origin-pill active" id="btn-fac-dynamic">${customBuildingName}</button>
      `;
    }
  }

  /**
   * Intro seismic arrival narrative step right after landing from Globe (피드백 3).
   */
  enterWithSeismicBrief(opts = {}) {
    if (this.briefTimerId) {
      clearTimeout(this.briefTimerId);
      this.briefTimerId = null;
    }
    if (opts.skipBrief) {
      this.beginActiveEvacuation();
      return;
    }

    this.experiencePhase = EXPERIENCE_PHASES.SEISMIC_BRIEF;
    this.walkPlaying = false;
    this.routeProgressT = 0.0;
    this.shelterSetbackGroup.visible = false;
    this._syncPlayButton();
    this._renderSafetyRuleCard();

    const banner = this._el('seismic-brief-banner');
    const titleEl = this._el('sb-title');
    const detailEl = this._el('sb-detail');
    if (titleEl && this.activeSeismicCtx) {
      titleEl.textContent = `${this.activeSeismicCtx.titleKo || '지진 진동 도달'}`;
    }
    if (detailEl && this.activeSeismicCtx) {
      detailEl.textContent =
        `진원 거리 약 ${this.activeSeismicCtx.distanceKm ?? '--'} km (${this.activeSeismicCtx.magSummary || '기록'}) · ` +
        `주 진동 통과를 확인한 뒤, 건물 외벽 낙하물과 계단을 회피하는 최단 대피 경로로 안내합니다.`;
    }
    banner?.classList.add('is-active');

    const holdMs = opts.durationMs || 2300;
    this.briefTimerId = setTimeout(() => {
      this.beginActiveEvacuation();
    }, holdMs);
  }

  beginActiveEvacuation() {
    if (this.briefTimerId) {
      clearTimeout(this.briefTimerId);
      this.briefTimerId = null;
    }
    this._el('seismic-brief-banner')?.classList.remove('is-active');
    this.experiencePhase = EXPERIENCE_PHASES.EVACUATION_ACTIVE;
    this.shelterSetbackGroup.visible = false;
    this.walkPlaying = true;
    if (this.routeProgressT >= 0.99) this.routeProgressT = 0.0;
    this._syncPlayButton();
    this._updateSafetyRuleForProgress();
  }

  /**
   * Switch to any dynamic 3D building picked on the map or loaded nationwide (피드백 5 & 6).
   */
  switchToDynamicFacility(facilityPkg, opts = {}) {
    if (!facilityPkg) return null;
    this.activeFacilityPkg = facilityPkg;
    this.activeFacilityId = facilityPkg.buildingMetadata?.id || 'DYNAMIC_ORIGIN';
    const shelterId = facilityPkg.shelter?.officialId || 'PRIMARY_SHELTER';
    const shelterMatch = (this.activeSpatialPkg.sheltersAndFacilities || []).find(s => s.id === shelterId) ||
      this.activeSpatialPkg.sheltersAndFacilities?.[0];
    this.activeShelterJustification =
      HANYANG_SHELTER_JUSTIFICATION[shelterId] ||
      shelterMatch?.justification ||
      null;

    this.uiAdapter.setFacilityPackage(facilityPkg);
    this.uiAdapter.setUserFloor(facilityPkg.defaultFloor ?? 1);
    this.uiAdapter.updateStationMotion(0.01, Date.now(), DATA_PROVENANCE_SOURCE.SIMULATED_SCENARIO);

    const vps = this.activeSpatialPkg.viewpoints || HANYANG_LOCAL_SPATIAL_VIEWPOINTS;
    this.camTransition.setFacilityViewpoints(withExtendedFar({
      REGIONAL_APPROACH: vps.REGIONAL_APPROACH || HANYANG_LOCAL_SPATIAL_VIEWPOINTS.REGIONAL_APPROACH,
      CAMPUS_OVERVIEW: vps.CAMPUS_OVERVIEW || HANYANG_LOCAL_SPATIAL_VIEWPOINTS.CAMPUS_OVERVIEW,
      ...facilityPkg.cameraViewpoints
    }));

    const originMeta = facilityPkg.dynamicOriginMeta || {
      id: this.activeFacilityId,
      name: facilityPkg.buildingMetadata?.name || '출발 건물',
      east_m: (facilityPkg.connector?.doorPos?.[0] ?? 0),
      north_m: -(facilityPkg.connector?.doorPos?.[2] ?? 0),
      height_m: 18
    };
    this.localSpatialLayer.setActiveOriginFacility(originMeta);
    if (this.activeSeismicCtx) {
      this.localSpatialLayer.setEpicenterContext(this.activeSeismicCtx);
    }

    const originGroup = this._el('origin-select-group');
    if (originGroup && this.activeSpatialPkg.isHanyangNative) {
      this._qAll('.origin-pill').forEach(b => b.classList.remove('active'));
      if (this.activeFacilityId === 'BLDG_212_ENG1') this._el('btn-fac-212')?.classList.add('active');
      else if (this.activeFacilityId === 'BLDG_701_HIT') this._el('btn-fac-hit')?.classList.add('active');
      else if (this.activeFacilityId === 'BLDG_104_PAIKNAM') this._el('btn-fac-paiknam')?.classList.add('active');
      else {
        let dynPill = this._el('btn-fac-dynamic');
        if (!dynPill) {
          dynPill = document.createElement('button');
          dynPill.type = 'button';
          dynPill.className = 'origin-pill active';
          dynPill.id = 'btn-fac-dynamic';
          originGroup.appendChild(dynPill);
        }
        dynPill.classList.add('active');
        dynPill.textContent = originMeta.name;
      }
    } else if (originGroup) {
      originGroup.innerHTML = `<button type="button" class="origin-pill active" id="btn-fac-dynamic">${originMeta.name}</button>`;
    }

    if (opts.snapStage !== false) {
      this.setCameraStage(CAMERA_STAGES.CAMPUS_OVERVIEW);
    }
    this.hanyangAdapter.setThemeColors(this.activeVisualTheme === 'ARCHITECTURAL_DAY');
    this.routeProgressT = 0.02;
    this.experiencePhase = EXPERIENCE_PHASES.EVACUATION_ACTIVE;
    this.shelterSetbackGroup.visible = false;
    if (opts.autoPlay !== false) {
      this.walkPlaying = true;
      this._syncPlayButton();
    }
    this.renderUI();
    return this.activeFacilityId;
  }

  switchFacilityPackage(facilityId, opts = {}) {
    const pkg = getFacilityPackageById(facilityId);
    this.activeFacilityPkg = pkg;
    this.activeFacilityId = pkg.buildingMetadata?.id || facilityId;
    const shelterId = pkg.shelter?.officialId || 'OA-21060';
    this.activeShelterJustification = HANYANG_SHELTER_JUSTIFICATION[shelterId] || null;

    this.uiAdapter.setFacilityPackage(pkg);
    this.camTransition.setFacilityViewpoints(withExtendedFar({
      REGIONAL_APPROACH: HANYANG_LOCAL_SPATIAL_VIEWPOINTS.REGIONAL_APPROACH,
      CAMPUS_OVERVIEW: HANYANG_LOCAL_SPATIAL_VIEWPOINTS.CAMPUS_OVERVIEW,
      ...pkg.cameraViewpoints
    }));

    const namedMatch = (this.activeSpatialPkg.namedBuildings || []).find(b =>
      b.id === this.activeFacilityId ||
      (this.activeFacilityId === 'BLDG_701_HIT' && b.id === 'CTX_HIT') ||
      (this.activeFacilityId === 'BLDG_104_PAIKNAM' && b.id === 'CTX_PAIKNAM') ||
      b.name.includes(pkg.buildingMetadata?.unitNumber || '999')
    );
    const connDoor = pkg.connector?.doorPos || [52, 0, -74];
    this.localSpatialLayer.setActiveOriginFacility({
      id: this.activeFacilityId,
      name: `${pkg.buildingMetadata?.unitNumber || '212'}동`,
      east_m: namedMatch ? namedMatch.east_m : connDoor[0],
      north_m: namedMatch ? namedMatch.north_m : -connDoor[2],
      height_m: namedMatch ? namedMatch.height_m : 24
    });
    if (this.activeSeismicCtx) {
      this.localSpatialLayer.setEpicenterContext(this.activeSeismicCtx);
    }

    // Remove temporary dynamic origin pill if switching back to named Hanyang preset
    this._el('btn-fac-dynamic')?.remove();
    this._qAll('#btn-fac-212, #btn-fac-hit, #btn-fac-paiknam').forEach(b => b.classList.remove('active'));
    if (this.activeFacilityId === 'BLDG_701_HIT') this._el('btn-fac-hit')?.classList.add('active');
    else if (this.activeFacilityId === 'BLDG_104_PAIKNAM') this._el('btn-fac-paiknam')?.classList.add('active');
    else this._el('btn-fac-212')?.classList.add('active');

    if (opts.snapStage !== false) {
      this.setCameraStage(CAMERA_STAGES.CAMPUS_OVERVIEW);
    }
    this.hanyangAdapter.setThemeColors(this.activeVisualTheme === 'ARCHITECTURAL_DAY');
    this.routeProgressT = 0.04;
    this.experiencePhase = opts.skipBrief === false ? EXPERIENCE_PHASES.SEISMIC_BRIEF : EXPERIENCE_PHASES.EVACUATION_ACTIVE;
    this.shelterSetbackGroup.visible = false;
    this.renderUI();
    return this.activeFacilityId;
  }

  async loadAndBindSeismicEvent(eventId) {
    let usgsFeatures = null;
    if (eventId && eventId.startsWith('us')) {
      try {
        const resp = await fetch('./assets/data/usgs_4.5_month.geojson');
        if (resp.ok) {
          const gj = await resp.json();
          usgsFeatures = gj.features || [];
        }
      } catch (_) {}
    }
    this.activeSeismicCtx = resolveActiveSeismicEvent(eventId, { usgsFeatures });
    this.localSpatialLayer.setEpicenterContext(this.activeSeismicCtx);
    this._renderEarthquakeImpactHeader();
    return this.activeSeismicCtx;
  }

  _renderEarthquakeImpactHeader() {
    if (!this.activeSeismicCtx) return;
    const g = this.uiAdapter.lastGuidance;
    const pkg = this.activeFacilityPkg || getFacilityPackageById(this.activeFacilityId);
    const rawName = pkg.buildingMetadata?.name?.split('(')[0]?.trim() || '출발 건물';
    const unitNo = pkg.buildingMetadata?.unitNumber;
    const displayOrigin = unitNo ? `${rawName}(${unitNo}동)` : rawName;
    const shelterName = pkg.shelter?.officialName || this.activeSpatialPkg.sheltersAndFacilities?.[0]?.name || '한양대 대운동장';
    const activeTotalDist = g?.replanStatus?.totalDistanceMeters
      || (this.uiAdapter.preferredRouteMode === 'STEP_FREE'
        ? pkg.routeBaselines?.PATH_STEP_FREE_DETOUR?.targetLengthMeters
        : pkg.routeBaselines?.PATH_SHORTEST_RAPID?.targetLengthMeters)
      || 737.9;

    const hl = this._el('evac-route-headline');
    if (hl) {
      hl.textContent = `${displayOrigin} → ${shelterName} (${activeTotalDist} m · 도보 약 ${Math.max(1, Math.ceil(activeTotalDist / 72))}분)`;
    }
    const dockTarget = this._el('dock-shelter-target');
    if (dockTarget) dockTarget.textContent = shelterName;

    const tagEl = this._el('quake-provenance-tag');
    if (tagEl) tagEl.textContent = this.activeSeismicCtx.provenanceBadge || '지진 정보';
    const origEl = this._el('quake-origin-line');
    if (origEl) {
      origEl.textContent = `${this.activeSeismicCtx.titleKo} (${this.activeSeismicCtx.magSummary}) · 여기서 ${this.activeSeismicCtx.compassDirKo} ${this.activeSeismicCtx.distanceKm ?? '--'} km (${this.activeSeismicCtx.bearingDeg ?? '--'}°)`;
    }
    const actionSnippet = g?.canMove
      ? `현재 지반 흔들림 멈춤 · ${g.replanStatus?.isStepFree ? '무단차 우회 대피 가능' : '보행 대피 가능'}`
      : '진동/차단 감지 · 즉시 현 위치 엄폐 대기';
    const impEl = this._el('quake-impact-line');
    if (impEl) {
      impEl.textContent = `이론상 P파 ${this.activeSeismicCtx.pWaveEtaSec ?? '--'}s / S파 ${this.activeSeismicCtx.sWaveEtaSec ?? '--'}s 도달 권역 · ${actionSnippet}`;
    }
  }

  applyVisualTheme(themeKey) {
    const normalized = themeKey === 'ARCHITECTURAL_DAY' ? 'ARCHITECTURAL_DAY' : 'MONOLITH_NIGHT';
    this.activeVisualTheme = normalized;
    const isDay = normalized === 'ARCHITECTURAL_DAY';
    const palette = this.localSpatialLayer.setVisualTheme(normalized);
    this.hanyangAdapter.setThemeColors(isDay);

    if (this.scene && !this.scene.userData?.preserveGlobalBackground) {
      if (this.scene.background?.setHex) this.scene.background.setHex(palette.background);
      if (this.scene.fog) {
        this.scene.fog.color.setHex(palette.fogColor);
        this.scene.fog.density = palette.fogDensity;
      }
    }

    if (this.mountRoot) {
      this.mountRoot.classList.toggle('theme-day', isDay);
    }
    if (typeof document !== 'undefined') {
      document.body.classList.toggle('theme-day', isDay);
    }
    const themeBtn = this._el('btn-theme-toggle');
    if (themeBtn) {
      themeBtn.textContent = isDay ? '야간 모놀리스' : '주간 지도';
      themeBtn.classList.toggle('active', isDay);
    }
    this.walkerChevron.material.color.setHex(isDay ? 0x0f172a : 0xf8fafc);
    this.walkerHalo.material.color.setHex(isDay ? 0x0284c7 : 0x38bdf8);
    return normalized;
  }

  _syncUtilityButtons() {
    const diag = this.localSpatialLayer.getLayerDiagnostics();
    this._el('btn-xray-toggle')?.classList.toggle('active', diag.xRayEnabled);
    this._el('btn-eco-toggle')?.classList.toggle('active', diag.ecoMode);

    const mode = this.uiAdapter.preferredRouteMode;
    this._el('btn-route-shortest')?.classList.toggle('active', mode === 'ALL' || mode === 'SHORTEST');
    this._el('btn-route-stepfree')?.classList.toggle('active', mode === 'STEP_FREE');
  }

  _syncFollowButton() {
    this._el('btn-follow-cam')?.classList.toggle('active', this.followCameraEnabled);
  }

  _syncPlayButton() {
    const btn = this._el('btn-walk-play');
    const lbl = this._el('walk-play-label');
    const icon = this._el('walk-play-icon');
    if (btn) btn.classList.toggle('is-playing', this.walkPlaying);
    if (lbl) lbl.textContent = this.walkPlaying ? '안내 일시정지' : (this.routeProgressT >= 0.996 ? '다시 안내' : '동선 안내');
    if (icon) {
      icon.innerHTML = this.walkPlaying
        ? '<path d="M3.5 2.5h3v11h-3zM9.5 2.5h3v11h-3z"/>'
        : '<path d="M4 2.5l9 5.5-9 5.5z"/>';
    }
  }

  _refreshCheckpointsAndMilestones() {
    const pkg = this.activeFacilityPkg || getFacilityPackageById(this.activeFacilityId);
    const g = this.uiAdapter.lastGuidance;
    const isStepFree = Boolean(g?.replanStatus?.isStepFree || this.uiAdapter.preferredRouteMode === 'STEP_FREE');
    const shortestLen = pkg.routeBaselines?.PATH_SHORTEST_RAPID?.targetLengthMeters || 737.9;
    const stepFreeLen = pkg.routeBaselines?.PATH_STEP_FREE_DETOUR?.targetLengthMeters || 855.1;

    const unitNum = pkg.buildingMetadata?.unitNumber;
    const facLabel = unitNum ? `${unitNum}동` : (pkg.buildingMetadata?.name || '출발 건물');
    this.activeCheckpoints = buildEvacuationSafetyCheckpoints({
      facilityName: facLabel,
      floor: this.uiAdapter.context?.user?.floor ?? (pkg.defaultFloor ?? 1),
      room: (this.uiAdapter.context?.user?.room || '1F').replace('ROOM_', '') + '호',
      shelterName: pkg.shelter?.officialName || '지정 대피장소',
      shortestMeters: shortestLen,
      stepFreeMeters: stepFreeLen,
      isStepFree,
      hasObstacles: Boolean(this.hazardPolyActive || g?.replanStatus?.isReplanned)
    });

    const msRow = this._el('milestones-row');
    if (msRow) {
      msRow.innerHTML = this.activeCheckpoints.map((cp, idx) => `
        <button type="button" class="milestone-btn" data-cp-idx="${idx}" data-cp-t="${cp.tAnchor}">
          <span class="m-dot"></span>
          <span>${cp.stepNo} ${cp.shortLabel}</span>
        </button>
      `).join('');
      msRow.querySelectorAll('.milestone-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          this.beginActiveEvacuation();
          this.setRouteProgress(Number(btn.dataset.cpT), true);
        });
      });
    }
    this._updateSafetyRuleForProgress();
  }

  _renderSafetyRuleCard(prog = null) {
    const popupEl = this._el('safety-rule-popup');
    if (!popupEl) return;
    const hideForBrief = this.experiencePhase === EXPERIENCE_PHASES.SEISMIC_BRIEF;
    popupEl.classList.toggle('is-hidden', this.safetyPopupDismissed || hideForBrief);

    const g = this.uiAdapter.lastGuidance;
    const isArrived = this.experiencePhase === EXPERIENCE_PHASES.SHELTER_ARRIVED || this.routeProgressT >= 0.996;
    popupEl.classList.toggle('is-arrived', isArrived && Boolean(g?.canMove));

    if (g && !g.canMove) {
      this._el('sr-step-meta').textContent = '긴급 대처 · 이동 금지';
      this._el('sr-headline').textContent = g.phaseHeadline;
      this._el('sr-body').textContent = g.primaryAction;
      const warnEl = this._el('sr-caution');
      warnEl.textContent = g.warnings[0] || '흔들림이 멈출 때까지 승강기를 이용하지 마십시오.';
      warnEl.classList.add('is-critical');
      return;
    }

    if (isArrived) {
      const pkg = this.activeFacilityPkg || getFacilityPackageById(this.activeFacilityId);
      const shelterName = pkg.shelter?.officialName || this.activeSpatialPkg.sheltersAndFacilities?.[0]?.name || '지정 옥외 대피장소';
      const just = this.activeShelterJustification || HANYANG_SHELTER_JUSTIFICATION['OA-21060'];
      this._el('sr-step-meta').textContent = `STEP 05 · 대피소 도착 완료 (100%)`;
      this._el('sr-headline').textContent = `${shelterName} 안전 권역 도달`;
      this._el('sr-body').textContent = '이동 단계가 종료되었습니다. 이제 아래 선정 근거와 도착 후 안전 행동 수칙을 확인하십시오.';
      const warnEl = this._el('sr-caution');
      warnEl.textContent = just?.hazardCaveat || '여진 발생 가능성이 있으므로 주변 전신주·외벽으로부터 충분히 떨어져 대기하십시오.';
      warnEl.classList.remove('is-critical');

      // Populate Educational Shelter Selection Reasons + Interactive Post-Arrival Safety Protocols (피드백 4)
      const metricsEl = this._el('arrival-metrics-strip');
      if (metricsEl) {
        metricsEl.innerHTML = `
          <span class="arrival-metric-item">개활 면적 <strong>${just?.areaSqMeters ? just.areaSqMeters.toLocaleString() + '㎡' : '--'}</strong></span>
          <span class="arrival-metric-item">수용 추정 <strong>${just?.capacityEstimate ? just.capacityEstimate.toLocaleString() + '명' : '--'}</strong></span>
          <span class="arrival-metric-item">건물 이격 반경 <strong>${just?.clearanceRadiusMeters ? just.clearanceRadiusMeters + 'm' : '--'}</strong></span>
          <span class="arrival-metric-item">출처 <strong>${just?.provenanceLabel || '현장 확인 권장'}</strong></span>
        `;
      }
      const whyEl = this._el('arrival-why-text');
      if (whyEl) {
        whyEl.textContent = `선정 근거: ${just?.selectionReason || '인접 건축물 붕괴 낙하물 반경 밖의 충분한 개활 공터입니다.'}`;
      }
      const protoRow = this._el('arrival-protocol-row');
      if (protoRow) {
        protoRow.innerHTML = POST_ARRIVAL_SAFETY_PROTOCOLS.map(p => `
          <button type="button" class="arrival-proto-btn ${this.activeArrivalProtocolId === p.id ? 'active' : ''}" data-proto-id="${p.id}">
            <span>${p.stepNumber} · ${p.title}</span>
            ${p.actionLabel}
          </button>
        `).join('');
        protoRow.querySelectorAll('.arrival-proto-btn').forEach(btn => {
          btn.addEventListener('click', () => {
            this.triggerPostArrivalProtocol(btn.dataset.protoId);
          });
        });
      }
      return;
    }

    if (!prog && this.activeCheckpoints.length) {
      const totalD = g?.replanStatus?.totalDistanceMeters || 737.9;
      prog = evaluatePathProgressState(this.activeCheckpoints, this.routeProgressT, totalD);
    }
    const cp = prog?.activeCheckpoint || this.activeCheckpoints[0];
    if (!cp) return;

    this._el('sr-step-meta').textContent = `STEP ${cp.stepNo} · ${cp.shortLabel} (${Math.round((prog?.normalizedT ?? 0) * 100)}%)`;
    this._el('sr-headline').textContent = cp.title;
    this._el('sr-body').textContent = cp.instruction;
    const warnEl = this._el('sr-caution');
    warnEl.textContent = cp.caution;
    warnEl.classList.toggle('is-critical', Boolean(cp.isAlert));
  }

  /**
   * Interactive post-arrival motion & educational feedback inside shelter (피드백 4).
   */
  triggerPostArrivalProtocol(protoId) {
    const proto = POST_ARRIVAL_SAFETY_PROTOCOLS.find(p => p.id === protoId) || POST_ARRIVAL_SAFETY_PROTOCOLS[0];
    this.activeArrivalProtocolId = proto.id;
    this._qAll('.arrival-proto-btn').forEach(b => b.classList.toggle('active', b.dataset.protoId === proto.id));

    const fb = this._el('arrival-protocol-feedback');
    if (fb) fb.textContent = `[${proto.stepNumber} ${proto.title}] ${proto.summary}`;

    if (proto.motionMode === 'SETBACK_RING') {
      this.setbackOuterRing.material.color.setHex(0xC89D54);
      this.setbackOuterRing.material.opacity = 0.72;
    } else if (proto.motionMode === 'EPICENTER_SCAN') {
      this.setbackOuterRing.material.color.setHex(0x38bdf8);
      this.setbackOuterRing.material.opacity = 0.65;
    } else {
      this.setbackOuterRing.material.color.setHex(0x34d399);
      this.setbackOuterRing.material.opacity = 0.68;
    }
  }

  _updateSafetyRuleForProgress() {
    if (!this.activeCheckpoints.length) return;
    const g = this.uiAdapter.lastGuidance;
    const pkg = this.activeFacilityPkg || getFacilityPackageById(this.activeFacilityId);
    const totalDist = g?.replanStatus?.totalDistanceMeters
      || (this.uiAdapter.preferredRouteMode === 'STEP_FREE' ? 855.1 : 737.9);
    const prog = evaluatePathProgressState(this.activeCheckpoints, this.routeProgressT, totalDist);
    const cp = prog.activeCheckpoint;

    const remEl = this._el('dock-remaining-dist');
    const etaEl = this._el('dock-walk-eta');
    const scrubber = this._el('route-scrubber');
    if (remEl) remEl.textContent = prog.normalizedT >= 0.996 ? '대피소 도착 완료' : `잔여 ${prog.remainingMeters} m`;
    if (etaEl) etaEl.textContent = prog.normalizedT >= 0.996 ? `총 ${prog.totalMeters} m 이동` : `약 ${prog.remainingMinutes}분 (${prog.totalMeters} m 중)`;
    if (scrubber) scrubber.value = String(Math.round(prog.normalizedT * 1000));

    this._qAll('.milestone-btn').forEach(btn => {
      const idx = Number(btn.dataset.cpIdx);
      btn.classList.toggle('active', this.activeCheckpoints[idx]?.id === cp.id);
    });

    this._renderSafetyRuleCard(prog);

    const activePts = this.hanyangAdapter.getActiveRoutePoints();
    for (let i = 0; i < this.milestoneMeshes.length; i++) {
      const mesh = this.milestoneMeshes[i];
      const mcp = this.activeCheckpoints[i];
      if (activePts.length >= 2 && mcp && g?.canMove) {
        const sample = samplePointAlong3D(activePts, mcp.tAnchor);
        mesh.visible = true;
        mesh.position.set(sample.point[0], sample.point[1] + 0.45, sample.point[2]);
        const isCur = mcp.id === cp.id;
        mesh.material.color.setHex(isCur ? 0x38bdf8 : 0x94a3b8);
        mesh.material.opacity = isCur ? 0.92 : 0.42;
        mesh.scale.setScalar(isCur ? 1.45 : 1.0);
      } else {
        mesh.visible = false;
      }
    }

    // Position shelter setback ring cleanly at destination
    if (activePts.length >= 2 && this.experiencePhase === EXPERIENCE_PHASES.SHELTER_ARRIVED) {
      const endPt = activePts[activePts.length - 1];
      this.shelterSetbackGroup.visible = true;
      this.shelterSetbackGroup.position.set(endPt[0], endPt[1] + 0.5, endPt[2]);
    } else {
      this.shelterSetbackGroup.visible = false;
    }
  }

  setRouteProgress(nextT, focusCamera = false) {
    this.routeProgressT = Math.max(0, Math.min(1, nextT));
    if (this.routeProgressT >= 0.996) {
      this.routeProgressT = 1.0;
      this.experiencePhase = EXPERIENCE_PHASES.SHELTER_ARRIVED;
      this.walkPlaying = false;
      this._syncPlayButton();
    } else if (this.experiencePhase === EXPERIENCE_PHASES.SHELTER_ARRIVED) {
      this.experiencePhase = EXPERIENCE_PHASES.EVACUATION_ACTIVE;
      this._syncPlayButton();
    }

    this._updateSafetyRuleForProgress();
    if (focusCamera && this.controls) {
      const activePts = this.hanyangAdapter.getActiveRoutePoints();
      if (activePts.length >= 2) {
        const sample = samplePointAlong3D(activePts, this.routeProgressT);
        const pos = new THREE.Vector3(sample.point[0], sample.point[1], sample.point[2]);
        this.controls.target.lerp(pos, 0.75);
        this.controls.update();
      }
    }
  }

  setCameraStage(stageKey) {
    this.followCameraEnabled = false;
    this._syncFollowButton();
    this._qAll('#btn-stage-local4km, #btn-stage-campus, #btn-stage-bldg, #btn-stage-earth, #btn-stage-personal')
      .forEach(b => b.classList.remove('active'));

    if (stageKey === CAMERA_STAGES.GLOBAL_ORBIT) {
      this._el('btn-stage-earth')?.classList.add('active');
      this.camTransition.snapTo(CAMERA_STAGES.GLOBAL_ORBIT);
      this.hanyangAdapter.setRouteDisplay('NONE');
    } else if (stageKey === CAMERA_STAGES.REGIONAL_APPROACH) {
      this._el('btn-stage-local4km')?.classList.add('active');
      this.camTransition.snapTo(CAMERA_STAGES.REGIONAL_APPROACH);
      this.uiAdapter.sync3DScene();
    } else if (stageKey === CAMERA_STAGES.CAMPUS_OVERVIEW) {
      this._el('btn-stage-campus')?.classList.add('active');
      this.camTransition.snapTo(CAMERA_STAGES.CAMPUS_OVERVIEW);
      this.uiAdapter.sync3DScene();
    } else if (stageKey === CAMERA_STAGES.BUILDING_INSPECTION) {
      this._el('btn-stage-bldg')?.classList.add('active');
      this.camTransition.snapTo(CAMERA_STAGES.BUILDING_INSPECTION);
      this.hanyangAdapter.highlightFloor(this.uiAdapter.context?.user?.floor ?? 1);
      this.uiAdapter.sync3DScene();
    } else if (stageKey === CAMERA_STAGES.PERSONAL_LOCATION) {
      this._el('btn-stage-personal')?.classList.add('active');
      this.camTransition.snapTo(CAMERA_STAGES.PERSONAL_LOCATION);
      this.hanyangAdapter.highlightFloor(this.uiAdapter.context?.user?.floor ?? 1);
      this.uiAdapter.sync3DScene();
    } else {
      stageKey = CAMERA_STAGES.CAMPUS_OVERVIEW;
      this._el('btn-stage-campus')?.classList.add('active');
      this.camTransition.snapTo(CAMERA_STAGES.CAMPUS_OVERVIEW);
      this.uiAdapter.sync3DScene();
    }

    this.localSpatialLayer.syncWithCameraStage(stageKey);
    this._syncUtilityButtons();
    if (this.labelContainer) {
      this.localSpatialLayer.updateOverlayLabels(this.camera, this.labelContainer, { force: true });
    }
    const stageMetaEl = this._el('meta-camera-stage');
    if (stageMetaEl) stageMetaEl.textContent = stageKey;
  }

  applyTimelineStep(tSec) {
    this.beginActiveEvacuation();
    const pkg = this.activeFacilityPkg || getFacilityPackageById(this.activeFacilityId);
    if (tSec === 0) {
      this.setCameraStage(CAMERA_STAGES.PERSONAL_LOCATION);
      this.uiAdapter.resetRouteObstacles();
      this.uiAdapter.setAftershock(false);
      this.uiAdapter.setUserLocation({
        locationType: 'INDOOR',
        buildingId: this.activeFacilityId,
        floor: pkg.defaultFloor ?? 3,
        room: pkg.defaultRoomId || 'ROOM_301',
        certainty: LOCATION_CERTAINTY.MANUAL_EXACT
      });
      this.uiAdapter.updateStationMotion(0.22, Date.now(), DATA_PROVENANCE_SOURCE.SIMULATED_SCENARIO);
    } else if (tSec === 40) {
      this.setCameraStage(CAMERA_STAGES.BUILDING_INSPECTION);
      this.uiAdapter.resetRouteObstacles();
      this.uiAdapter.setAftershock(false);
      this.uiAdapter.setUserFloor(pkg.defaultFloor ?? 3);
      this.uiAdapter.updateStationMotion(0.01, Date.now(), DATA_PROVENANCE_SOURCE.SIMULATED_SCENARIO);
    } else if (tSec === 67) {
      this.setCameraStage(CAMERA_STAGES.CAMPUS_OVERVIEW);
      this.uiAdapter.setAftershock(false);
      this.uiAdapter.updateStationMotion(0.01, Date.now(), DATA_PROVENANCE_SOURCE.SIMULATED_SCENARIO);
      this.uiAdapter.reportLinkObstacle('NODE_STAIR1_TOP->NODE_STAIR1_BOT', LINK_STATE.SUSPECTED, {
        source: DATA_PROVENANCE_SOURCE.USER_FIELD_REPORT,
        detail: '1층 연결 계단 균열 및 파편 목격 제보'
      });
      this.uiAdapter.reassess();
    } else if (tSec === 110) {
      this.setCameraStage(CAMERA_STAGES.PERSONAL_LOCATION);
      this.uiAdapter.setAftershock(true);
      this.uiAdapter.updateStationMotion(0.16, Date.now(), DATA_PROVENANCE_SOURCE.SIMULATED_SCENARIO);
    }
    this.renderUI();
  }

  toggleHazardAvoidPolygon(forceState) {
    this.hazardPolyActive = typeof forceState === 'boolean' ? forceState : !this.hazardPolyActive;
    this._el('btn-hazard-poly-toggle')?.classList.toggle('active', this.hazardPolyActive);
    if (this.hazardPolyActive) {
      this.uiAdapter.addAvoidPolygon({
        id: 'HAZARD_POLY_STAIR_CORRIDOR',
        name: '노천극장·외벽 낙하물 주의 구역 (PROVISIONAL)',
        mode: 'BLOCK',
        polygonXZ: [[-12, 15], [48, 15], [48, 105], [-12, 105]],
        exemptEdgeIds: ['NODE_EXIT_1F_SE->OSM_NODE_6415394841']
      });
      this.localSpatialLayer.setHazardAvoidPolygons(this.uiAdapter.getAvoidPolygons());
    } else {
      this.uiAdapter.clearAvoidPolygons();
      this.localSpatialLayer.setHazardAvoidPolygons([]);
    }
    this.renderUI();
    return this.hazardPolyActive;
  }

  renderUI() {
    const g = this.uiAdapter.lastGuidance;
    if (!g) return;
    this._renderEarthquakeImpactHeader();
    this._refreshCheckpointsAndMilestones();

    const canMoveEl = this._el('meta-can-move');
    if (canMoveEl) {
      canMoveEl.textContent = g.canMove ? '가능 (허용)' : '금지 (엄폐 대기)';
      canMoveEl.style.color = g.canMove ? '#38bdf8' : '#f43f5e';
    }
    const routeModeEl = this._el('meta-route-mode');
    if (routeModeEl) routeModeEl.textContent = g.routeStatus.displayMode;
    const detailEl = this._el('meta-detail');
    if (detailEl) detailEl.textContent = g.replanStatus?.replanReason || g.routeStatus.caveat;
    const unvEl = this._el('meta-unverified');
    if (unvEl) {
      unvEl.textContent = g.unverifiedItems.length > 0
        ? `불확실성: ${g.unverifiedItems.join(' | ')}`
        : '미확인 항목 없음';
    }

    const fc = g.fieldChecklist || this.uiAdapter.getFieldChecklistSummary();
    if (fc) {
      const auditBtn = this._el('btn-field-audit-toggle');
      const auditOverall = this._el('field-audit-overall');
      const auditList = this._el('field-audit-list');
      if (auditBtn) auditBtn.textContent = `체크리스트 열기 (${fc.verifiedCount}/${fc.totalCount})`;
      if (auditOverall) auditOverall.textContent = `${fc.overallStatus} (${fc.verifiedCount}/${fc.totalCount})`;
      if (auditList) {
        auditList.innerHTML = fc.items.map(it =>
          `<div style="display:flex; justify-content:space-between; gap:8px;">
            <span><strong>${it.code}</strong> ${it.title}</span>
            <span style="color:${it.verified ? '#38bdf8' : '#94a3b8'}; white-space:nowrap;">${it.status}</span>
          </div>`
        ).join('');
      }
    }
    this._syncUtilityButtons();
  }

  _bindDomEvents() {
    // Persistent Top-Left Mini-Globe Return (피드백 2)
    this._el('btn-evac-back-globe')?.addEventListener('click', () => {
      if (this.onReturnToGlobe) this.onReturnToGlobe();
      else if (typeof window !== 'undefined') window.location.href = './index.html';
    });

    // Nationwide Korea Region Switcher Popover (피드백 6)
    const regBtn = this._el('btn-region-switcher');
    const regPopover = this._el('region-search-popover');
    regBtn?.addEventListener('click', e => {
      e.stopPropagation();
      const isOpen = regPopover?.classList.toggle('open');
      regBtn.classList.toggle('open', Boolean(isOpen));
      if (isOpen) this._el('korea-region-search-input')?.focus();
    });
    this._el('korea-region-search-form')?.addEventListener('submit', e => {
      e.preventDefault();
      const val = this._el('korea-region-search-input')?.value || '';
      if (val.trim()) this._handleRegionSearchSubmit(val);
    });

    // Seismic Brief Start
    this._el('btn-sb-start-evac')?.addEventListener('click', () => this.beginActiveEvacuation());
    this._el('btn-replay-seismic-brief')?.addEventListener('click', () => this.enterWithSeismicBrief({ durationMs: 2400 }));

    // Top-Right Navigation & Lab
    this._el('btn-stage-earth')?.addEventListener('click', () => {
      if (this.onReturnToGlobe) this.onReturnToGlobe();
      else this.setCameraStage(CAMERA_STAGES.GLOBAL_ORBIT);
    });
    this._el('btn-stage-local4km')?.addEventListener('click', () => this.setCameraStage(CAMERA_STAGES.REGIONAL_APPROACH));
    this._el('btn-stage-campus')?.addEventListener('click', () => this.setCameraStage(CAMERA_STAGES.CAMPUS_OVERVIEW));
    this._el('btn-stage-bldg')?.addEventListener('click', () => this.setCameraStage(CAMERA_STAGES.BUILDING_INSPECTION));
    this._el('btn-stage-personal')?.addEventListener('click', () => this.setCameraStage(CAMERA_STAGES.PERSONAL_LOCATION));

    this._el('btn-route-shortest')?.addEventListener('click', () => {
      this.uiAdapter.setPreferredRouteMode('ALL');
      this.hanyangAdapter.setThemeColors(this.activeVisualTheme === 'ARCHITECTURAL_DAY');
      this.renderUI();
    });
    this._el('btn-route-stepfree')?.addEventListener('click', () => {
      this.uiAdapter.setPreferredRouteMode('STEP_FREE');
      this.hanyangAdapter.setThemeColors(this.activeVisualTheme === 'ARCHITECTURAL_DAY');
      this.renderUI();
    });
    this._el('btn-theme-toggle')?.addEventListener('click', () => {
      this.applyVisualTheme(this.activeVisualTheme === 'ARCHITECTURAL_DAY' ? 'MONOLITH_NIGHT' : 'ARCHITECTURAL_DAY');
    });
    this._el('btn-toggle-rules')?.addEventListener('click', () => {
      this.safetyPopupDismissed = !this.safetyPopupDismissed;
      this._el('btn-toggle-rules')?.classList.toggle('active', !this.safetyPopupDismissed);
      this._updateSafetyRuleForProgress();
    });
    this._el('btn-close-rule-popup')?.addEventListener('click', () => {
      this.safetyPopupDismissed = true;
      this._el('btn-toggle-rules')?.classList.remove('active');
      this._updateSafetyRuleForProgress();
    });

    this._el('btn-dev-lab-toggle')?.addEventListener('click', () => {
      const drawer = this._el('dev-lab-drawer');
      const isOpen = drawer?.classList.toggle('open');
      this._el('btn-dev-lab-toggle')?.classList.toggle('active', Boolean(isOpen));
      if (this.labelContainer) {
        this.localSpatialLayer.updateOverlayLabels(this.camera, this.labelContainer, { force: true });
      }
    });

    this._el('btn-t0')?.addEventListener('click', () => this.applyTimelineStep(0));
    this._el('btn-t40')?.addEventListener('click', () => this.applyTimelineStep(40));
    this._el('btn-t67')?.addEventListener('click', () => this.applyTimelineStep(67));
    this._el('btn-t110')?.addEventListener('click', () => this.applyTimelineStep(110));
    this._qAll('[data-event-preset]').forEach(btn => {
      btn.addEventListener('click', () => this.loadAndBindSeismicEvent(btn.dataset.eventPreset));
    });

    this._el('btn-xray-toggle')?.addEventListener('click', () => {
      this.localSpatialLayer.setXRayMode(!this.localSpatialLayer.state.xRayEnabled, 0.16, true);
      this._syncUtilityButtons();
    });
    this._el('btn-eco-toggle')?.addEventListener('click', () => {
      const next = !this.localSpatialLayer.state.ecoMode;
      this.localSpatialLayer.setEcoMode(next);
      this.renderer?.setPixelRatio(next ? 1.0 : this.baseDpr);
      this._syncUtilityButtons();
    });
    this._el('btn-hazard-poly-toggle')?.addEventListener('click', () => this.toggleHazardAvoidPolygon());

    this._el('btn-field-audit-toggle')?.addEventListener('click', () => {
      const drawer = this._el('field-audit-drawer');
      const isOpen = drawer && drawer.style.display !== 'none' && drawer.style.display !== '';
      if (drawer) drawer.style.display = isOpen ? 'none' : 'block';
    });

    const p31MsgEl = this._el('p31-audit-message');
    this._el('btn-p31-drill-approve')?.addEventListener('click', () => {
      const res = this.uiAdapter.ingestFieldSurveyPacket(buildSimulatedDrillSurveyPacket('COMPLIANT', this.activeFacilityId), {
        approve: true,
        approvalMetadata: {
          approvedByAuthority: '성동소방서·한양대 합동 점검반 (리허설)',
          approvalDocumentRef: `DRILL-PASS-${this.activeFacilityId}`,
          approvedAt: new Date().toISOString()
        }
      });
      this.renderUI();
      if (p31MsgEl) {
        p31MsgEl.style.color = '#38bdf8';
        p31MsgEl.textContent = `[리허설 완료] ${res.approvedCount}/${res.totalCount} 승인 (VERIFIED 전환)`;
      }
    });
    this._el('btn-p31-drill-reject')?.addEventListener('click', () => {
      this.uiAdapter.resetFieldChecklist();
      const res = this.uiAdapter.ingestFieldSurveyPacket(buildSimulatedDrillSurveyPacket('NON_COMPLIANT_GRATING', this.activeFacilityId), {
        approve: true,
        approvalMetadata: {
          approvedByAuthority: '성동소방서·한양대 합동 점검반 (리허설)',
          approvalDocumentRef: `DRILL-FAIL-${this.activeFacilityId}`,
          approvedAt: new Date().toISOString()
        }
      });
      this.renderUI();
      if (p31MsgEl) {
        p31MsgEl.style.color = '#fb7185';
        p31MsgEl.textContent = `[승인 차단됨] ${(res.errors?.[0]?.errors?.[0] || '기준 미달')} (${res.approvedCount}/${res.totalCount})`;
      }
    });
    this._el('btn-p31-reset')?.addEventListener('click', () => {
      this.uiAdapter.resetFieldChecklist();
      this.renderUI();
      if (p31MsgEl) {
        p31MsgEl.style.color = 'var(--evac-muted)';
        p31MsgEl.textContent = '초기화 완료: 기본 현장 실측 대기 상태 복원';
      }
    });

    // Origin Preset Pills inside Bottom Dock
    this._el('btn-fac-212')?.addEventListener('click', () => this.switchFacilityPackage('BLDG_212_ENG1'));
    this._el('btn-fac-hit')?.addEventListener('click', () => this.switchFacilityPackage('BLDG_701_HIT'));
    this._el('btn-fac-paiknam')?.addEventListener('click', () => this.switchFacilityPackage('BLDG_104_PAIKNAM'));

    // Route Player & Replay (피드백 4 non-looping)
    this._el('btn-walk-play')?.addEventListener('click', () => {
      this.beginActiveEvacuation();
      if (this.routeProgressT >= 0.996) {
        this.routeProgressT = 0.0;
        this.experiencePhase = EXPERIENCE_PHASES.EVACUATION_ACTIVE;
        this.shelterSetbackGroup.visible = false;
        this.walkPlaying = true;
      } else {
        this.walkPlaying = !this.walkPlaying;
      }
      this._syncPlayButton();
      this._updateSafetyRuleForProgress();
    });
    this._el('btn-replay-route')?.addEventListener('click', () => {
      this.routeProgressT = 0.0;
      this.experiencePhase = EXPERIENCE_PHASES.EVACUATION_ACTIVE;
      this.shelterSetbackGroup.visible = false;
      this.walkPlaying = true;
      this._syncPlayButton();
      this._updateSafetyRuleForProgress();
    });
    this._el('btn-follow-cam')?.addEventListener('click', () => {
      this.followCameraEnabled = !this.followCameraEnabled;
      if (this.followCameraEnabled && !this.walkPlaying) {
        this.beginActiveEvacuation();
      }
      this._syncFollowButton();
    });
    this._el('route-scrubber')?.addEventListener('input', e => {
      const nextT = Number(e.target.value) / 1000;
      this.beginActiveEvacuation();
      this.walkPlaying = false;
      this._syncPlayButton();
      this.setRouteProgress(nextT, this.followCameraEnabled);
    });

    this._el('btn-compass-north')?.addEventListener('click', () => {
      if (!this.controls || !this.camera) return;
      this.followCameraEnabled = false;
      this._syncFollowButton();
      const dist = this.camera.position.distanceTo(this.controls.target);
      this.camera.position.set(this.controls.target.x, this.controls.target.y + dist * 0.62, this.controls.target.z + dist * 0.78);
      this.controls.update();
    });
    this._el('btn-zoom-in')?.addEventListener('click', () => {
      if (!this.controls || !this.camera) return;
      const delta = this.camera.position.clone().sub(this.controls.target).multiplyScalar(0.75);
      this.camera.position.copy(this.controls.target).add(delta);
      this.controls.update();
    });
    this._el('btn-zoom-out')?.addEventListener('click', () => {
      if (!this.controls || !this.camera) return;
      const delta = this.camera.position.clone().sub(this.controls.target).multiplyScalar(1.32);
      this.camera.position.copy(this.controls.target).add(delta);
      this.controls.update();
    });
    this._el('btn-reset-view')?.addEventListener('click', () => {
      this.setCameraStage(CAMERA_STAGES.CAMPUS_OVERVIEW);
    });
  }

  _bindCanvasRaycastEvents() {
    if (!this.domElement) return;
    const hoverPill = this._el('building-hover-pill');

    this._onPointerDown = e => {
      this._pointerDownPos.x = e.clientX;
      this._pointerDownPos.y = e.clientY;
    };

    this._onPointerMove = e => {
      if (!this.localWorldGroup.visible || !this.camera) return;
      const now = performance.now();
      if (now - this._lastHoverCheckMs < 48) return;
      this._lastHoverCheckMs = now;

      const rect = this.domElement.getBoundingClientRect();
      this._pointerNDC.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      this._pointerNDC.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      this._raycaster.setFromCamera(this._pointerNDC, this.camera);

      const picked = this.localSpatialLayer.pickBuildingOBBAtRaycast(this._raycaster);
      this.hoveredBuilding = picked;
      if (picked && hoverPill) {
        this.domElement.style.cursor = 'pointer';
        hoverPill.style.display = 'inline-flex';
        hoverPill.textContent = `${picked.name} · 클릭하여 여기서 대피 시작`;
        hoverPill.style.transform = `translate3d(${Math.round(e.clientX + 14)}px, ${Math.round(e.clientY - 14)}px, 0)`;
      } else {
        this.domElement.style.cursor = '';
        if (hoverPill) hoverPill.style.display = 'none';
      }
    };

    this._onPointerUp = e => {
      if (!this.localWorldGroup.visible || !this.camera) return;
      const moveDist = Math.hypot(e.clientX - this._pointerDownPos.x, e.clientY - this._pointerDownPos.y);
      if (moveDist > 5) return; // Ignore orbit camera drags

      const rect = this.domElement.getBoundingClientRect();
      this._pointerNDC.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      this._pointerNDC.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      this._raycaster.setFromCamera(this._pointerNDC, this.camera);

      const picked = this.localSpatialLayer.pickBuildingOBBAtRaycast(this._raycaster);
      if (!picked) return;

      // Smart Match named Hanyang buildings when in Hanyang
      if (this.activeSpatialPkg.isHanyangNative) {
        if (picked.buildingId === 'BLDG_212_ENG1' || picked.name.includes('제1공학관')) {
          this.switchFacilityPackage('BLDG_212_ENG1', { snapStage: false });
          return;
        }
        if (picked.buildingId === 'CTX_HIT' || picked.name.includes('HIT')) {
          this.switchFacilityPackage('BLDG_701_HIT', { snapStage: false });
          return;
        }
        if (picked.buildingId === 'CTX_PAIKNAM' || picked.name.includes('백남')) {
          this.switchFacilityPackage('BLDG_104_PAIKNAM', { snapStage: false });
          return;
        }
      }

      const primaryShelter = this.activeSpatialPkg.sheltersAndFacilities?.[0] || null;
      const dynPkg = buildDynamicFacilityFromPoint({
        buildingId: picked.buildingId,
        name: picked.name,
        east_m: picked.east_m,
        north_m: picked.north_m,
        width_m: picked.width_m,
        depth_m: picked.depth_m,
        yaw_rad: picked.yaw_rad,
        height_m: picked.height_m,
        anchor: this.activeSpatialPkg.metadata?.anchor || { lat: 37.555815, lon: 127.045053, h: 42 },
        walkGraph: this.activeWalkGraph,
        buildingOBBs: this.activeSpatialPkg.obbBuildingsFloat32,
        shelter: primaryShelter,
        elevationSampler: (east, north) => sampleGridHeightAt(this.activeSpatialPkg.terrainGrid, east, north)
      });
      this.switchToDynamicFacility(dynPkg, { snapStage: false, autoPlay: true });
    };

    this.domElement.addEventListener('pointerdown', this._onPointerDown);
    this.domElement.addEventListener('pointermove', this._onPointerMove);
    this.domElement.addEventListener('pointerup', this._onPointerUp);
  }

  /**
   * Frame tick driven cleanly either by viewer_p2_6.html or ExhibitionModeManager.
   */
  update(dt = 0.016, elapsed = 0) {
    const isTransitioning = this.camTransition.update();
    if (!isTransitioning && !this.followCameraEnabled && this.controls) {
      this.controls.update();
    }

    const needle = this._el('compass-needle');
    if (needle && this.controls && this.camera) {
      const angleDeg = -Math.atan2(
        this.camera.position.x - this.controls.target.x,
        this.camera.position.z - this.controls.target.z
      ) * 180 / Math.PI;
      needle.style.transform = `rotate(${angleDeg.toFixed(1)}deg)`;
    }

    this.localSpatialLayer.updateAtmosphericPulse(elapsed);

    const guidance = this.uiAdapter.lastGuidance;
    const activePts = this.hanyangAdapter.getActiveRoutePoints();
    const canShowWalker = Boolean(
      guidance &&
      guidance.canMove &&
      activePts.length >= 2 &&
      this.camTransition.currentStage !== CAMERA_STAGES.GLOBAL_ORBIT
    );
    this.walkerGroup.visible = canShowWalker;

    if (canShowWalker) {
      if (this.walkPlaying && this.experiencePhase === EXPERIENCE_PHASES.EVACUATION_ACTIVE) {
        const nextT = this.routeProgressT + dt * 0.045;
        if (nextT >= 0.996) {
          // 피드백 4: STOP cleanly at shelter arrival instead of infinite jarring loop
          this.routeProgressT = 1.0;
          this.walkPlaying = false;
          this.experiencePhase = EXPERIENCE_PHASES.SHELTER_ARRIVED;
          this._syncPlayButton();
          this._updateSafetyRuleForProgress();
        } else {
          this.routeProgressT = nextT;
          const prevId = this.activeCheckpoints.find(c => this.routeProgressT >= c.range[0] && this.routeProgressT < c.range[1])?.id;
          if (prevId !== this._prevStepId) {
            this._prevStepId = prevId;
            this._updateSafetyRuleForProgress();
          } else {
            const totalD = guidance.replanStatus?.totalDistanceMeters || 737.9;
            const prog = evaluatePathProgressState(this.activeCheckpoints, this.routeProgressT, totalD);
            const remEl = this._el('dock-remaining-dist');
            const etaEl = this._el('dock-walk-eta');
            const scrub = this._el('route-scrubber');
            if (remEl) remEl.textContent = `잔여 ${prog.remainingMeters} m`;
            if (etaEl) etaEl.textContent = `약 ${prog.remainingMinutes}분 (${prog.totalMeters} m 중)`;
            if (scrub) scrub.value = String(Math.round(this.routeProgressT * 1000));
          }
        }
      }

      const curSample = samplePointAlong3D(activePts, this.routeProgressT);
      const lookSample = samplePointAlong3D(activePts, Math.min(1.0, this.routeProgressT + 0.02));
      this.walkerGroup.position.set(curSample.point[0], curSample.point[1] + 0.85, curSample.point[2]);
      this._walkerNextVec.set(lookSample.point[0], lookSample.point[1] + 0.85, lookSample.point[2]);

      if (this.walkerGroup.position.distanceToSquared(this._walkerNextVec) > 0.01) {
        this.walkerChevron.lookAt(this._walkerNextVec);
        this._tangentDir.copy(this._walkerNextVec).sub(this.walkerGroup.position).normalize();
      } else {
        this._tangentDir.set(0.4, 0, 0.9).normalize();
      }

      const pulse = 1.0 + Math.sin(elapsed * 4.0) * 0.14;
      this.walkerHalo.scale.set(pulse, pulse, 1);

      // Calm setback ring pulse upon arrival (피드백 4)
      if (this.shelterSetbackGroup.visible) {
        const ringPulse = 1.0 + Math.sin(elapsed * 2.1) * 0.05;
        this.setbackInnerRing.scale.set(ringPulse, ringPulse, 1);
        this.setbackOuterRing.scale.set(1.0 + Math.cos(elapsed * 1.5) * 0.04, 1.0 + Math.cos(elapsed * 1.5) * 0.04, 1);
      }

      if (this.followCameraEnabled && !isTransitioning && this.controls) {
        this._desiredTargetPos.copy(this.walkerGroup.position).addScaledVector(this._tangentDir, 18.0);
        this._desiredCamPos.copy(this.walkerGroup.position)
          .addScaledVector(this._tangentDir, -105.0)
          .add(new THREE.Vector3(-42.0, 82.0, 0));
        this.controls.target.lerp(this._desiredTargetPos, 0.06);
        this.camera.position.lerp(this._desiredCamPos, 0.05);
        this.controls.update();
      }

      const walkerCalloutEl = this._el('walker-callout');
      if (walkerCalloutEl) {
        this._walkerProjVec.copy(this.walkerGroup.position).add(new THREE.Vector3(0, 15.5, 0)).project(this.camera);
        const inFront = this._walkerProjVec.z >= -1 && this._walkerProjVec.z <= 1;
        const vw = typeof window !== 'undefined' ? window.innerWidth : 1280;
        const vh = typeof window !== 'undefined' ? window.innerHeight : 800;
        const sx = (this._walkerProjVec.x * 0.5 + 0.5) * vw;
        const sy = (-this._walkerProjVec.y * 0.5 + 0.5) * vh;
        if (inFront && sx > 40 && sx < vw - 40 && sy > 70 && sy < vh - 165) {
          const totalD = guidance.replanStatus?.totalDistanceMeters || 737.9;
          const remM = Math.max(0, Math.round((1 - this.routeProgressT) * totalD));
          walkerCalloutEl.style.display = 'inline-flex';
          walkerCalloutEl.textContent = (this.experiencePhase === EXPERIENCE_PHASES.SHELTER_ARRIVED || remM <= 10)
            ? '대피소 도착 완료'
            : `대피 이동 · 잔여 ${remM}m`;
          walkerCalloutEl.style.transform = `translate3d(${Math.round(sx - 48)}px, ${Math.round(sy - 26)}px, 0)`;
        } else {
          walkerCalloutEl.style.display = 'none';
        }
      }
    } else {
      const wc = this._el('walker-callout');
      if (wc) wc.style.display = 'none';
    }

    this.localSpatialLayer.updateSpatialChunks(this.camera);
    if (this.labelContainer) {
      this.localSpatialLayer.updateOverlayLabels(this.camera, this.labelContainer);
    }
  }

  getDiagnostics() {
    return {
      ...this.localSpatialLayer.getLayerDiagnostics(),
      activeRegionId: this.activeRegionId,
      activeFacilityId: this.activeFacilityId,
      experiencePhase: this.experiencePhase,
      hazardPolyActive: this.hazardPolyActive,
      routeProgressT: this.routeProgressT,
      followCameraEnabled: this.followCameraEnabled,
      activeEventId: this.activeSeismicCtx?.eventId || null,
      canMove: this.uiAdapter.lastGuidance?.canMove ?? null,
      routeMode: this.hanyangAdapter.config.activeRoute,
      renderCalls: this.renderer?.info?.render?.calls ?? 0,
      pixelRatio: this.renderer?.getPixelRatio?.() ?? 1,
      hasOrbitControls: Boolean(this.controls && this.controls.enabled)
    };
  }

  dispose() {
    if (this.briefTimerId) clearTimeout(this.briefTimerId);
    if (this.domElement) {
      this.domElement.removeEventListener('pointerdown', this._onPointerDown);
      this.domElement.removeEventListener('pointermove', this._onPointerMove);
      this.domElement.removeEventListener('pointerup', this._onPointerUp);
    }
    if (this.controls && this._onControlStart) {
      this.controls.removeEventListener('start', this._onControlStart);
    }
    this.localSpatialLayer.dispose();
  }
}
