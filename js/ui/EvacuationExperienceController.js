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
import { escapeHtml } from '../lib/htmlEscape.js';
import { HanyangResponseAdapter } from '../response/HanyangResponseAdapter.js';
import { GlobalLocalCameraTransition, CAMERA_STAGES } from '../response/GlobalLocalCameraTransition.js';
import { ResponseUIAdapter } from '../response/ResponseUIAdapter.js';
import { PedestrianRoutingEngine, LINK_STATE } from '../response/PedestrianRoutingEngine.js';
import {
  buildDynamicFacilityFromPoint,
  buildNeutralStreetExit,
  evaluateDestinationMcdaScore,
  solveCampusWalkGraph
} from '../response/CampusWalkRouter.js';
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
  SCENARIO_TYPES,
  IMPACT_ZONE_STATUS,
  CANDIDATE_STATUS
} from '../response/ResponseDomainTypes.js';
import {
  EXPERIENCE_ENTRY_MODES,
  UnifiedExperienceSession,
  AutoScenarioResolver,
  LocationProvider,
  HazardProvider
} from '../response/SpatialDataProviders.js';
import {
  KOREA_BENCHMARK_REGIONS,
  PRESET_EARTHQUAKE_SCENARIOS,
  HANYANG_SHELTER_JUSTIFICATION,
  POST_ARRIVAL_SAFETY_PROTOCOLS,
  evaluateRegionalHazard,
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

export function renderEvacuationHudMarkup(mountRoot, { devMode = false } = {}) {
  mountRoot.classList.add('evac-hud-root');
  mountRoot.classList.toggle('is-dev-mode', Boolean(devMode));
  mountRoot.innerHTML = `
    <div id="spatial-label-layer"></div>
    <div id="walker-callout">이동 안내 · 잔여 -- m</div>
    <div id="building-hover-pill">건물 · 클릭하여 여기서 대피 동선 보기</div>

    <div id="entry-mode-gate" role="dialog" aria-label="위치 분석 방식 선택">
      <span class="emg-eyebrow">LOCAL RESPONSE · 분석 위치 선택</span>
      <h2 class="emg-title" id="emg-title">어느 위치를 기준으로 지진 대응을 확인할까요?</h2>
      <p class="emg-subtitle" id="emg-subtitle">내 실제 GPS 위치로 바로 주변 대피 공간을 조회하거나, GPS 없이 원하는 지역·좌표를 자유롭게 탐색할 수 있습니다.</p>
      <div class="emg-notice" id="emg-notice"></div>
      <div class="emg-track-grid">
        <button type="button" class="emg-track-btn is-primary" id="btn-gate-my-location">
          <strong>내 현재 위치 기준 (GPS)</strong>
          <small>브라우저 위치 권한을 확인해 내 주변 지형·도로와 대피 후보를 자동 조회합니다.</small>
        </button>
        <button type="button" class="emg-track-btn" id="btn-gate-free-mode">
          <strong>자유 모드 (지역 검색 · 선택)</strong>
          <small>원하는 시·군·구나 좌표를 지정해 탐색합니다. 실제 GPS 위치로 오인하지 않습니다.</small>
        </button>
      </div>
      <div class="emg-free-quick">
        <span style="font-size:10px; color:var(--evac-muted); align-self:center; margin-right:4px;">바로 탐색 (자유 모드):</span>
        <button type="button" class="emg-quick-chip" data-gate-region="seoul_seongdong" data-lat="37.5596" data-lon="127.0410" data-name="서울 성동 · 사근·행당 도심" data-short="서울 성동">서울 성동</button>
        <button type="button" class="emg-quick-chip" data-gate-region="sokcho" data-lat="38.2070" data-lon="128.5918" data-name="강원 속초 · 청초·교동 연안 도심" data-short="속초 도심">강원 속초</button>
        <button type="button" class="emg-quick-chip" data-gate-region="gyeongju" data-lat="35.8347" data-lon="129.2190" data-name="경북 경주 · 황남·월성 지구" data-short="경주 도심">경북 경주</button>
        <button type="button" class="emg-quick-chip" data-gate-region="pohang" data-lat="36.1086" data-lon="129.3490" data-name="경북 포항 · 흥해·중앙 지구" data-short="포항 흥해권">경북 포항</button>
      </div>
    </div>

    <div id="seismic-brief-banner" role="dialog" aria-label="지진 발생 및 대피 개시 안내">
      <div class="sb-eyebrow" id="sb-eyebrow">SEISMIC CONTEXT · 지진 영향 및 대응 안내</div>
      <h2 class="sb-title" id="sb-title">주 진동 통과 확인 · 보행 대피 동선을 확인합니다</h2>
      <p class="sb-detail" id="sb-detail">진앙 방향과 주변 건축물 낙하물 위험 구역을 피하는 도보 경로를 산출했습니다.</p>
      <div class="sb-actions">
        <button type="button" class="sb-start-btn" id="btn-sb-start-evac">동선 안내 시작</button>
      </div>
    </div>

    <header id="evac-header-overlay">
      <div class="top-capsule evac-left-capsule">
        <button type="button" class="ctrl-btn region-switcher-btn" id="btn-region-switcher" title="지역 검색 · 내 위치(GPS) · 지진 시나리오 전환">
          <span class="reg-tag">위치</span>
          <span id="region-active-label">지역 선택 필요</span>
          <span class="reg-caret">▾</span>
        </button>

        <span class="top-divider"></span>
        <button type="button" class="ctrl-btn" id="btn-toggle-context-details" aria-expanded="false" title="대피 경로 요약 · 지진 출처 · 진동 파동 · 진앙 주변 보기">상세 <span class="reg-caret">▾</span></button>
        <button type="button" class="ctrl-btn" id="btn-handoff-nearest-urban" style="display:none; color:var(--evac-brass); border-color:var(--evac-brass);" title="인근 도심 대피 동선으로 이동"></button>
      </div>

      <div id="region-search-popover" aria-label="분석 위치 선택">
        <form class="region-search-form" id="korea-region-search-form">
          <input type="search" id="korea-region-search-input" class="region-search-input"
            placeholder="지역명 또는 위·경도" aria-label="지명 또는 좌표 입력" />
          <button type="submit" class="region-search-submit">이동</button>
          <button type="button" class="gps-locate-btn" id="btn-locate-me" title="현재 브라우저 GPS 위치 기준 분석">현위치(GPS)</button>
        </form>
        <div id="region-search-results"></div>
        <div class="lab-title">국내 주요 지역 (자유 모드)</div>
        <div class="region-chips-grid" id="region-chips-grid"></div>

        <div class="region-popover-scenario-section">
          <div class="lab-title" style="margin-top:6px;">적용 지진 맥락 (관측 · 역사 · 교육용 일반 가정)</div>
          <div class="scenario-mode-row" id="scenario-preset-list"></div>
        </div>
        <div class="dev-only-control">
          <div class="lab-title" style="margin-top:8px;">[개발 진단] 임의 단층 수치 입력</div>
          <div class="custom-quake-grid" aria-label="개발 진단용 가상 지진">
            <input type="number" step="0.001" id="custom-epi-lat" class="custom-quake-input" placeholder="진앙 위도" aria-label="진앙 위도" />
            <input type="number" step="0.001" id="custom-epi-lon" class="custom-quake-input" placeholder="진앙 경도" aria-label="진앙 경도" />
            <input type="number" step="0.1" min="2.0" max="9.0" id="custom-mag" class="custom-quake-input" value="5.4" placeholder="규모 M" aria-label="지진 규모" />
            <input type="number" step="1" min="1" max="300" id="custom-depth" class="custom-quake-input" value="12" placeholder="깊이 km" aria-label="진원 깊이" />
          </div>
          <div style="display:flex; gap:6px; margin-top:4px;">
            <button type="button" class="region-search-submit" style="flex:1;" id="btn-apply-custom-quake">수치 가정 적용</button>
            <button type="button" class="gps-locate-btn" id="btn-snap-local-quake" title="현재 분석 위치 북동측 5km 가상 진앙 설정">현지역 근거리 가정</button>
          </div>
        </div>
      </div>

      <div class="evac-summary-card" id="evac-detail-panel" aria-hidden="true">
        <div class="evac-summary-top-meta">
          <span class="header-eyebrow"><span class="live-dot"></span><span>SEISMOLIVE · 대피 경로</span></span>
          <div class="evac-top-meta-right">
            <span class="route-delta-note" id="route-delta-note"></span>
            <span class="mode-badge-pill" id="analysis-mode-badge">위치 미선택</span>
          </div>
        </div>
        <h1 class="header-route-headline" id="evac-route-headline">위치 선택 후 대피 동선·영향 분석</h1>
        <div class="header-quake-impact" id="quake-impact-summary">
          <div class="quake-line">
            <span class="quake-tag" id="quake-provenance-tag">지진 맥락</span>
            <span id="quake-origin-line">내 위치 또는 지역을 선택하면 자동 분석됩니다</span>
          </div>
        </div>
        <div id="data-quality-strip">
          <span class="dq-badge" id="dq-completeness-badge">공간 데이터 대기</span>
          <span class="dq-sep" aria-hidden="true">·</span>
          <span class="dq-badge" id="dq-destination-badge">목적지 상태 대기</span>
        </div>
        <div id="evac-context-drawer" aria-hidden="true">
          <div class="impact-sub" id="mcda-routing-audit-line">경로 선정 근거: 대피 경로 산출 대기 중</div>
          <div class="impact-sub" id="quake-impact-line">관측 · 사료 · 교육용 가정 구분 및 거리·방위 산출 대기 중</div>
          <div class="dq-lim-text" id="dq-limitation-summary">위치 선택 시 실제 도로망·개활 공간 데이터를 조회합니다</div>
        </div>
        <div class="evac-detail-footer">
          <div id="handoff-context-strip" aria-label="지구본 연동 지진 기준 전환">
            <div class="handoff-meta-line" id="handoff-quake-meta"></div>
          </div>
          <div class="evac-detail-actions">
            <button type="button" class="handoff-action-btn" id="btn-replay-wave" title="반경 4km 지진 파동 전파 및 위험군 재표시">진동 파동</button>
            <button type="button" class="handoff-action-btn" id="btn-handoff-epicenter" title="현재 연동된 지진의 진앙 주변 공간으로 이동">진앙 주변</button>
            <button type="button" class="handoff-action-btn" id="btn-handoff-my-location" title="내 현재 위치(GPS)로 전환">내 위치(GPS)</button>
            <button type="button" class="handoff-action-btn" id="btn-handoff-pick-region" title="지역 검색 창 열기">지역 변경</button>
          </div>
        </div>
      </div>
    </header>

    <div id="exhibition-bar">
      <div class="top-capsule">
        <button type="button" class="ctrl-btn" id="btn-stage-local4km" title="반경 4km 지형 · 진앙 파동 방향 한눈에 보기">4km 전체</button>
        <button type="button" class="ctrl-btn active" id="btn-stage-campus" title="선택된 대피 동선 구간 확대 보기">경로 집중</button>
        <button type="button" class="ctrl-btn dev-only-control" id="btn-stage-bldg" title="출발 지점 구조 확인">내 건물</button>
        <span class="top-divider"></span>
        <button type="button" class="ctrl-btn active" id="btn-route-shortest" title="건물 외벽 낙하물 반경 · 협소 골목 · 교량 위험 · 대피지 이격을 반영한 지진 안전 최적 경로">안전최적</button>
        <button type="button" class="ctrl-btn" id="btn-route-stepfree" title="계단·단차를 피해 평지로 돌아가는 경로">계단회피</button>
        <button type="button" class="ctrl-btn" id="btn-route-alt" title="보행망 기반 우회 대안 경로 전환" style="display:none;">우회</button>
        <span class="top-divider"></span>
        <button type="button" class="ctrl-btn" id="btn-theme-toggle" title="야간 · 주간 지도 테마 전환">주간</button>
        <button type="button" class="ctrl-btn active" id="btn-toggle-rules" title="하단 행동 수칙 안내 켜기/끄기">수칙</button>
        <span class="top-divider dev-only-control"></span>
        <button type="button" class="ctrl-btn dev-only-control" id="btn-dev-lab-toggle" title="현장검증·시나리오·공간진단 (?dev=1)">진단 ▾</button>
        <span class="top-divider"></span>
        <button type="button" class="mini-globe-exit-btn" id="btn-evac-back-globe" title="3D 지구본 화면으로 돌아가기">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="12" cy="12" r="9.5"/>
            <ellipse cx="12" cy="12" rx="4.2" ry="9.5"/>
            <path d="M2.8 12h18.4M4.5 7.5h15M4.5 16.5h15"/>
          </svg>
          <span>지구본</span>
        </button>
      </div>

      <aside id="dev-lab-drawer" class="dev-only-control" aria-label="진단 및 현장 검증 도구 (?dev=1)">
        <div class="lab-section">
          <span class="lab-title">카메라 스케일 & 파일럿 점검</span>
          <div class="lab-row">
            <button type="button" class="lab-btn" id="btn-stage-earth">지구 궤도 시점</button>
            <button type="button" class="lab-btn" id="btn-stage-personal">실내 진입부(파일럿)</button>
            <button type="button" class="lab-btn" id="btn-replay-seismic-brief">지진 도달 연출 재생</button>
          </div>
        </div>

        <div class="lab-section">
          <span class="lab-title">타임라인 상태 검증 (?dev=1)</span>
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
          <span class="lab-title">지진 사건 연동 프리셋</span>
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
              <span id="field-audit-overall" style="color:var(--evac-muted);">현장 확인 전 (0/6)</span>
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

    <div id="empty-region-callout" aria-live="polite" aria-hidden="true">
      <span class="erc-eyebrow">해상 · 공간 데이터 공백 구역</span>
      <h3 class="erc-title" id="erc-title">이 좌표 반경에는 도로·건축물 데이터가 없습니다</h3>
      <p class="erc-body" id="erc-body">임의 경로를 생성하지 않고 실측 공백 상태로 표시합니다. 가까운 연안·내륙 도심이나 내 위치로 이동해 3D 대피 동선을 확인하십시오.</p>
      <div class="erc-actions">
        <button type="button" class="erc-primary-btn" id="btn-erc-nearest-urban" style="display:none;"></button>
        <button type="button" class="erc-secondary-btn" id="btn-erc-gps">현위치(GPS)</button>
        <button type="button" class="erc-secondary-btn" id="btn-erc-pick-region">다른 지역 검색</button>
      </div>
    </div>

    <div id="bottom-stage-stack">
      <section id="safety-rule-popup" aria-live="polite">
        <div class="sr-top">
          <span class="sr-step-meta" id="sr-step-meta">안내 준비</span>
          <button type="button" class="sr-close-btn" id="btn-close-rule-popup" title="수칙 팝업 잠시 접기">&times;</button>
        </div>
        <h2 class="sr-headline" id="sr-headline">위치 선택 후 상황에 맞는 행동 수칙을 안내합니다</h2>
        <p class="sr-body" id="sr-body">실외·보행 가능 여부는 실제 지진 정보와 도로·목적지 확인 수준을 함께 표시합니다.</p>
        <div class="sr-caution" id="sr-caution">승강기(엘리베이터)는 절대 이용하지 마십시오.</div>

        <div id="arrival-education-panel">
          <div class="arrival-metrics-strip" id="arrival-metrics-strip"></div>
          <p class="arrival-why-text" id="arrival-why-text"></p>
          <div class="arrival-protocol-row" id="arrival-protocol-row"></div>
          <div class="arrival-footer-bar">
            <span id="arrival-protocol-feedback">위 항목을 눌러 도착 후 현장 안전 절차를 확인하십시오.</span>
            <button type="button" class="arrival-replay-btn" id="btn-replay-route">동선 다시 보기</button>
          </div>
        </div>
      </section>

      <nav id="evac-dock" aria-label="대피 동선 주행 및 기준 위치">
        <div class="dock-origin-strip">
          <div class="dock-origin-route">
            <span class="dock-origin-label">출발 기준</span>
            <div class="origin-select-group" id="origin-select-group">
              <button type="button" class="origin-pill active" id="btn-fac-dynamic">위치 미지정</button>
            </div>
            <span style="color:var(--evac-muted);">→</span>
            <strong id="dock-shelter-target" style="color:var(--evac-brass); font-weight:600;">목적지 확인 대기</strong>
          </div>
          <span class="dock-click-hint" id="dock-click-hint">건물 클릭으로 출발 위치 변경</span>
        </div>
        <div class="candidate-pills-row" id="candidate-pills-row" aria-label="목적지 후보 선택"></div>

        <div class="dock-controls-row">
          <button type="button" class="play-route-btn" id="btn-walk-play" title="내 대피 동선 따라가기 재생/일시정지">
            <svg id="walk-play-icon" viewBox="0 0 16 16"><path d="M4 2.5l9 5.5-9 5.5z"/></svg>
            <span id="walk-play-label">동선 안내</span>
          </button>
          <button type="button" class="follow-btn" id="btn-follow-cam" title="보행자를 따라 3D 시점이 함께 이동합니다">시점 따라가기</button>
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

function buildIdleNeutralSpatialPackage() {
  const heights = new Float32Array(64);
  heights.fill(0);
  return {
    metadata: { packageId: 'EMPTY_IDLE', anchor: null },
    terrainGrid: { width: 8, height: 8, halfSpanMeters: 2200, heights },
    obbBuildingsFloat32: new Float32Array(0),
    buildings: [],
    namedBuildings: [],
    sheltersAndFacilities: [],
    terrainAndHydrology: { waterPolygons: [], waterways: [], roads: [], greenZones: [] },
    isHanyangNative: false,
    dataCompleteness: 'INSUFFICIENT',
    dataLimitations: ['분석할 위치(내 현재 위치 GPS 또는 자유 모드 지역)를 선택하십시오.']
  };
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

    this.devMode = Boolean(
      options.devMode ||
      (typeof window !== 'undefined' && /[?&]dev=1(?:&|$)/.test(window.location?.search || ''))
    );
    this.session = options.session || new UnifiedExperienceSession();
    this.originMarkerMode = 'UNSELECTED';

    this.activeVisualTheme = options.initialTheme === 'ARCHITECTURAL_DAY' ? 'ARCHITECTURAL_DAY' : 'MONOLITH_NIGHT';
    const useLegacyCampusBoot = Boolean(options.useLegacyCampusBoot || (this.devMode && options.initialRegionId === 'seoul_hanyang'));

    this.activeRegionId = useLegacyCampusBoot ? 'seoul_hanyang' : null;
    this.activeSpatialPkg = useLegacyCampusBoot
      ? {
          ...HANYANG_LOCAL_4KM_PACKAGE,
          isHanyangNative: true,
          initialFacilityPackage: DEFAULT_HANYANG_FACILITY_PACKAGE,
          dataCompleteness: 'SUFFICIENT',
          dataLimitations: [
            '제1공학관(212동)은 파일럿 3층 실내망(현장 검증 대기)을 포함합니다.',
            '701동 HIT 및 104동 백남학술정보관은 실측 외곽 기반 출발점이며 상세 전층 평면도는 미포함입니다.'
          ],
          destinationAssessment: {
            candidates: (HANYANG_LOCAL_4KM_PACKAGE.sheltersAndFacilities || []).map(s => ({
              ...s,
              candidateStatus: HANYANG_SHELTER_JUSTIFICATION[s.id] ? CANDIDATE_STATUS.CONFIRMED : CANDIDATE_STATUS.CONDITIONAL,
              justification: HANYANG_SHELTER_JUSTIFICATION[s.id] || s.justification || null
            })),
            primaryCandidate: HANYANG_LOCAL_4KM_PACKAGE.sheltersAndFacilities?.[0] || null,
            overallStatus: CANDIDATE_STATUS.CONFIRMED,
            limitations: '공식 지진옥외대피장소(OA-21060) 개방 여부 및 현장 접근로는 재난 당시 안전 점검을 우선하십시오.'
          }
        }
      : buildIdleNeutralSpatialPackage();

    this.activeWalkGraph = useLegacyCampusBoot ? HANYANG_CAMPUS_WALK_GRAPH : { nodes: [], edges: [] };
    this.activeRegionInfo = useLegacyCampusBoot ? KOREA_BENCHMARK_REGIONS[0] : null;
    this.locationProvider = new LocationProvider(
      useLegacyCampusBoot
        ? { lat: KOREA_BENCHMARK_REGIONS[0].lat, lon: KOREA_BENCHMARK_REGIONS[0].lon, label: KOREA_BENCHMARK_REGIONS[0].name, source: 'PRESET_PILOT' }
        : {}
    );
    this.activeScenarioSpec = useLegacyCampusBoot
      ? {
          ...PRESET_EARTHQUAKE_SCENARIOS[0],
          epicenterLat: KOREA_BENCHMARK_REGIONS[0].scenarioEvent.epicenterLat,
          epicenterLon: KOREA_BENCHMARK_REGIONS[0].scenarioEvent.epicenterLon
        }
      : null;
    this.activeImpactEval = null;
    this.selectedCandidateIndex = 0;
    this.alternativeRoutes = [];
    this.activeAltRouteIndex = 0;
    this.activeFacilityId = useLegacyCampusBoot ? 'BLDG_212_ENG1' : null;
    this.activeFacilityPkg = useLegacyCampusBoot ? DEFAULT_HANYANG_FACILITY_PACKAGE : null;
    this.activeShelterJustification = useLegacyCampusBoot ? HANYANG_SHELTER_JUSTIFICATION['OA-21060'] : null;
    this.activeArrivalProtocolId = POST_ARRIVAL_SAFETY_PROTOCOLS[0].id;

    this.experiencePhase = EXPERIENCE_PHASES.EVACUATION_ACTIVE;
    this.briefTimerId = null;
    this.hazardPolyActive = false;
    this.routeProgressT = 0.04;
    this.walkPlaying = Boolean(useLegacyCampusBoot && options.autoPlay !== false);
    this.followCameraEnabled = false;
    this.safetyPopupDismissed = false;
    this._isScrubbingRoute = false;
    this.activeSeismicCtx = null;
    this.activeCheckpoints = [];
    this.hoveredBuilding = null;
    this._prevStepId = null;
    this._lastHoverCheckMs = 0;
    this._pointerDownPos = { x: 0, y: 0 };
    this._regionRequestSeq = 0;
    this._isLoadingRegion = false;

    if (this.mountRoot) {
      renderEvacuationHudMarkup(this.mountRoot, { devMode: this.devMode });
    }
    this.labelContainer = this._el('spatial-label-layer');

    // Local 3D spatial layer anchored inside localWorldGroup so Single-Canvas isolates cleanly
    this.localSpatialLayer = new LocalSpatialMapLayer(this.localWorldGroup, {
      spatialPackage: this.activeSpatialPkg,
      theme: this.activeVisualTheme,
      renderer: this.renderer
    });

    this.router = new PedestrianRoutingEngine({
      useRealMapRouting: true,
      buildingOBBs: this.activeSpatialPkg.obbBuildingsFloat32,
      customWalkGraph: this.activeWalkGraph,
      elevationSampler: (e, n) => sampleGridHeightAt(this.activeSpatialPkg.terrainGrid, e, n)
    });

    this.hanyangAdapter = new HanyangResponseAdapter(this.localWorldGroup, {
      scale: 1.0,
      visualScaleFactor: 4.5,
      useRealMapRouting: true,
      buildingOBBs: this.activeSpatialPkg.obbBuildingsFloat32,
      router: this.router,
      elevationSampler: (e, n) => sampleGridHeightAt(this.activeSpatialPkg.terrainGrid, e, n)
    });
    this.uiAdapter = new ResponseUIAdapter({
      router: this.router,
      hanyangAdapter: this.hanyangAdapter,
      initialStation: null
    });

    this.camTransition = new GlobalLocalCameraTransition({
      camera: this.camera,
      controls: this.controls,
      viewpoints: withExtendedFar({
        ...DEFAULT_HANYANG_FACILITY_PACKAGE.cameraViewpoints,
        REGIONAL_APPROACH: HANYANG_LOCAL_SPATIAL_VIEWPOINTS.REGIONAL_APPROACH,
        CAMPUS_OVERVIEW: HANYANG_LOCAL_SPATIAL_VIEWPOINTS.CAMPUS_OVERVIEW
      })
    });
    if (this._onWindowResizeSync && typeof window !== 'undefined') {
      window.removeEventListener('resize', this._onWindowResizeSync);
    }
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
      this._renderScenarioPresets();
      this._bindDomEvents();
      this._bindCanvasRaycastEvents();
    }

    if (this.controls) {
      if (THREE.TOUCH) {
        this.controls.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN };
      }
      this._onControlStart = () => {
        if (this.followCameraEnabled) {
          this.followCameraEnabled = false;
          this._syncFollowButton();
        }
      };
      this.controls.addEventListener('start', this._onControlStart);
    }

    const stageBtn = this._el('btn-stage-campus');
    if (stageBtn) stageBtn.textContent = '경로 집중';

    this.applyVisualTheme(this.activeVisualTheme);

    if (!useLegacyCampusBoot) {
      this.hanyangAdapter.clearVisuals();
      this.walkerGroup.visible = false;
      this.shelterSetbackGroup.visible = false;
    }

    if (!options.deferInitialBoot) {
      if (useLegacyCampusBoot) {
        this.uiAdapter.setUserFloor(3);
        if (options.initialEventId) {
          this.loadAndBindSeismicEvent(options.initialEventId);
        } else if (this.activeScenarioSpec) {
          this.applyScenarioSpec(this.activeScenarioSpec, { skipBrief: true });
        }
        this._updateModeAndHandoffUi();
        this._renderDataQualityStrip();
        this._renderCandidatePills();
        this.renderUI();
      } else {
        this.applySessionHandoff({
          entryMode: options.entryMode || (Number.isFinite(options.lat) && Number.isFinite(options.lon) ? EXPERIENCE_ENTRY_MODES.FREE_MODE : (options.handedEvent || options.initialEventId ? EXPERIENCE_ENTRY_MODES.FROM_GLOBE_EVENT : EXPERIENCE_ENTRY_MODES.UNSELECTED)),
          lat: options.lat,
          lon: options.lon,
          regionId: options.initialRegionId || options.regionId || null,
          name: options.name || null,
          shortName: options.shortName || null,
          eventId: options.initialEventId || options.eventId || null,
          handedEvent: options.handedEvent || null,
          withSeismicBrief: false
        }, options.initialStage || CAMERA_STAGES.CAMPUS_OVERVIEW);
      }
    }

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
      new THREE.RingGeometry(3.2, 5.2, 36).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: 0x38bdf8, side: THREE.DoubleSide, transparent: true, opacity: 0.72, depthWrite: false })
    );
    this.walkerHalo.position.y = -0.35;
    this.walkerGroup.add(this.walkerHalo);

    // Subtle dark circular navigation puck collar + crisp architectural direction arrow
    const puckGeo = new THREE.CylinderGeometry(2.5, 2.75, 0.55, 28);
    const puckMat = new THREE.MeshBasicMaterial({ color: 0x0b1220, transparent: true, opacity: 0.92 });
    const puckBase = new THREE.Mesh(puckGeo, puckMat);
    puckBase.position.y = 0.05;
    puckBase.renderOrder = 7;
    this.walkerGroup.add(puckBase);

    const arrowShape = new THREE.Shape();
    arrowShape.moveTo(0, 2.45);
    arrowShape.lineTo(1.75, -1.55);
    arrowShape.lineTo(0, -0.75);
    arrowShape.lineTo(-1.75, -1.55);
    arrowShape.closePath();
    const walkerChevronGeo = new THREE.ExtrudeGeometry(arrowShape, {
      depth: 0.58,
      bevelEnabled: true,
      bevelThickness: 0.14,
      bevelSize: 0.12,
      bevelSegments: 1
    });
    walkerChevronGeo.rotateX(Math.PI * 0.5); // Tip points +Z cleanly under Object3D.lookAt
    this.walkerChevron = new THREE.Mesh(
      walkerChevronGeo,
      new THREE.MeshBasicMaterial({ color: 0xf8fafc })
    );
    this.walkerChevron.position.y = 1.05;
    this.walkerChevron.renderOrder = 8;
    this.walkerGroup.add(this.walkerChevron);

    this.walkerMast = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 1.2, 0), new THREE.Vector3(0, 12.5, 0)]),
      new THREE.LineBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.48 })
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

    // Calm concentric shelter safety setback rings draped cleanly onto local slope upon arrival
    this.shelterSetbackGroup = new THREE.Group();
    this.shelterSetbackGroup.name = 'ShelterSafetySetbackRings3D';
    this.shelterSetbackGroup.visible = false;
    this._lastSetbackKey = null;

    this.setbackInnerRing = new THREE.Mesh(
      new THREE.RingGeometry(14.0, 15.4, 48).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: 0xC89D54, side: THREE.DoubleSide, transparent: true, opacity: 0.78, depthWrite: false })
    );
    this.setbackOuterRing = new THREE.Mesh(
      new THREE.RingGeometry(24.0, 25.3, 64).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: 0x38bdf8, side: THREE.DoubleSide, transparent: true, opacity: 0.42, depthWrite: false })
    );
    this.shelterSetbackGroup.add(this.setbackInnerRing);
    this.shelterSetbackGroup.add(this.setbackOuterRing);
    this.localWorldGroup.add(this.shelterSetbackGroup);
  }

  _drapeSetbackRingMesh(mesh, centerX, centerZ, innerR, outerR, angSegs = 56) {
    if (!mesh) return;
    const grid = this.activeSpatialPkg?.terrainGrid;
    const positions = [];
    const indices = [];
    for (let a = 0; a <= angSegs; a++) {
      const theta = (a / angSegs) * Math.PI * 2;
      const cos = Math.cos(theta);
      const sin = Math.sin(theta);
      const ix = cos * innerR;
      const iz = sin * innerR;
      const ox = cos * outerR;
      const oz = sin * outerR;
      const iy = sampleGridHeightAt(grid, centerX + ix, -(centerZ + iz)) + 0.34;
      const oy = sampleGridHeightAt(grid, centerX + ox, -(centerZ + oz)) + 0.34;
      positions.push(ix, iy, iz, ox, oy, oz);
      if (a > 0) {
        const base = (a - 1) * 2;
        indices.push(base, base + 1, base + 2);
        indices.push(base + 1, base + 3, base + 2);
      }
    }
    const prevGeo = mesh.geometry;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setIndex(indices);
    mesh.geometry = geo;
    prevGeo?.dispose?.();
  }

  _renderScenarioPresets() {
    const row = this._el('scenario-preset-list');
    if (!row) return;
    const typeLabel = t => (
      t === SCENARIO_TYPES.OBSERVED_EVENT ? '관측' :
      t === SCENARIO_TYPES.HISTORICAL_RECORD ? '사료' : '교육'
    );
    row.innerHTML = PRESET_EARTHQUAKE_SCENARIOS.map(sc => `
      <button type="button" class="scenario-tab-btn ${this.activeScenarioSpec?.id === sc.id ? 'active' : ''}" data-scenario-id="${escapeHtml(sc.id)}">
        [${typeLabel(sc.scenarioType)}] ${escapeHtml(sc.title.split('(')[0].trim())}
      </button>
    `).join('');
    row.querySelectorAll('[data-scenario-id]').forEach(btn => {
      btn.addEventListener('click', () => {
        const sc = PRESET_EARTHQUAKE_SCENARIOS.find(s => s.id === btn.dataset.scenarioId);
        if (sc) {
          this.applyScenarioSpec(sc, { skipBrief: false });
        }
      });
    });
  }

  _syncCustomQuakeInputs(hazardEval) {
    if (!hazardEval) return;
    const latEl = this._el('custom-epi-lat');
    const lonEl = this._el('custom-epi-lon');
    const magEl = this._el('custom-mag');
    const depEl = this._el('custom-depth');
    if (latEl && Number.isFinite(hazardEval.epicenterLat)) latEl.value = hazardEval.epicenterLat.toFixed(4);
    if (lonEl && Number.isFinite(hazardEval.epicenterLon)) lonEl.value = hazardEval.epicenterLon.toFixed(4);
    if (magEl && typeof hazardEval.magnitude === 'number') magEl.value = String(hazardEval.magnitude);
    if (depEl && typeof hazardEval.depthKm === 'number') depEl.value = String(hazardEval.depthKm);
  }

  /**
   * Apply any independent OBSERVED_EVENT, EDUCATIONAL_SYNTHETIC, or HISTORICAL_RECORD
   * earthquake against the currently analyzed location, checking IMPACT_ZONE vs OUTSIDE_IMPACT_ZONE.
   */
  applyScenarioSpec(scenarioSpec, opts = {}) {
    if (!scenarioSpec) return null;
    this.activeScenarioSpec = { ...scenarioSpec };
    const anchor = this.activeSpatialPkg?.metadata?.anchor || (this.activeRegionInfo ? {
      lat: this.activeRegionInfo.lat,
      lon: this.activeRegionInfo.lon
    } : null);
    if (!anchor || !Number.isFinite(anchor.lat) || !Number.isFinite(anchor.lon)) {
      return null;
    }

    const evaluated = evaluateRegionalHazard(this.activeScenarioSpec, anchor.lat, anchor.lon);
    this.activeImpactEval = evaluated.impactAssessment;
    this._syncCustomQuakeInputs(evaluated);

    const compassLabel = Number.isFinite(evaluated.azimuthDeg)
      ? `${Math.round(evaluated.azimuthDeg)}° 방위`
      : '방위 미상';
    const typeBadge =
      evaluated.scenarioType === SCENARIO_TYPES.OBSERVED_EVENT ? '계기 관측' :
      evaluated.scenarioType === SCENARIO_TYPES.HISTORICAL_RECORD ? '역사 사료' :
      '교육용 가정';

    this.activeSeismicCtx = {
      eventId: evaluated.id,
      scenarioType: evaluated.scenarioType,
      titleKo: evaluated.title,
      provenanceBadge: typeBadge,
      magSummary: evaluated.magnitudeText || (evaluated.magnitude !== null ? `${evaluated.magScale || 'M'}${evaluated.magnitude}` : '규모 미상'),
      compassDirKo: compassLabel,
      distanceKm: evaluated.distanceKm,
      bearingDeg: evaluated.azimuthDeg,
      epicenterLat: evaluated.epicenterLat,
      epicenterLon: evaluated.epicenterLon,
      pWaveEtaSec: evaluated.pArrivalSec,
      sWaveEtaSec: evaluated.sArrivalSec,
      officialProducts: evaluated.officialProducts || null,
      selectionReasonKo: evaluated.selectionReasonKo || null,
      isGeneralAssumptionOnly: Boolean(evaluated.isGeneralAssumptionOnly),
      impactAssessment: evaluated.impactAssessment
    };

    this.localSpatialLayer.setEpicenterContext(this.activeSeismicCtx);
    this._renderScenarioPresets();

    const impStatus = evaluated.impactAssessment?.impactStatus || IMPACT_ZONE_STATUS.UNKNOWN;
    const isOutsideImpact = impStatus === IMPACT_ZONE_STATUS.OUTSIDE_IMPACT_ZONE;

    // Promote verified observed USGS ShakeMap StationList PGA when available near anchor
    const liveStations = Array.isArray(this.activeSeismicCtx?.officialProducts?.stations)
      ? this.activeSeismicCtx.officialProducts.stations
      : [];
    const usableStation = liveStations.find(st =>
      st.isInstrument !== false &&
      Number.isFinite(st.pga_g) &&
      (st.distanceKm === null || st.distanceKm <= 120)
    );
    if (usableStation && !isOutsideImpact) {
      this.uiAdapter.updateStationMotion(
        usableStation.pga_g,
        Date.now(),
        DATA_PROVENANCE_SOURCE.OBSERVED_STATION,
        { distanceKm: usableStation.distanceKm }
      );
    } else if (!this.devMode || !opts.preserveStationTelemetry) {
      this.uiAdapter.clearStationTelemetry();
    }

    if (isOutsideImpact) {
      this._enterOutsideImpactState(evaluated);
    } else if (!this.activeSpatialPkg?.initialFacilityPackage && !this.activeSpatialPkg?.isHanyangNative) {
      this._enterUnavailableDestinationState(this.activeSpatialPkg);
    } else {
      const destMeta = this.activeFacilityPkg?.shelter;
      this.uiAdapter.setRegionContext({
        impactStatus: impStatus,
        destinationStatus: destMeta ? (destMeta.destinationStatus || (this.activeSpatialPkg.isHanyangNative ? 'CONFIRMED' : 'CONDITIONAL')) : 'UNAVAILABLE',
        destinationName: destMeta?.officialName || destMeta?.name || null,
        regionLabel: this.activeRegionInfo?.shortName || this.activeRegionInfo?.name || null,
        facilityName: this.activeFacilityPkg?.buildingMetadata?.name || null,
        hasIndoorData: Boolean(this.activeSpatialPkg?.isHanyangNative && this.activeFacilityPkg?.buildingMetadata?.id === 'BLDG_212_ENG1')
      });
      this.hanyangAdapter.setRouteDisplay(this.uiAdapter.preferredRouteMode || 'ALL');
      if (!opts.skipBrief) {
        this.enterWithSeismicBrief({ durationMs: 2000 });
      }
    }

    this._renderDataQualityStrip();
    this._renderEarthquakeImpactHeader();
    this.renderUI();
    return evaluated;
  }

  _enterOutsideImpactState(evaluatedQuake) {
    if (this.briefTimerId) {
      clearTimeout(this.briefTimerId);
      this.briefTimerId = null;
    }
    this._el('seismic-brief-banner')?.classList.remove('is-active');
    this.walkPlaying = false;
    this.routeProgressT = 0;
    this.alternativeRoutes = [];
    this.activeAltRouteIndex = 0;
    this.experiencePhase = EXPERIENCE_PHASES.EVACUATION_ACTIVE;
    this.walkerGroup.visible = false;
    this.shelterSetbackGroup.visible = false;
    this.hanyangAdapter.setRouteDisplay('NONE');

    this.uiAdapter.setRegionContext({
      impactStatus: evaluatedQuake.impactAssessment?.impactStatus || IMPACT_ZONE_STATUS.OUTSIDE_IMPACT_ZONE,
      destinationStatus: this.activeSpatialPkg?.destinationAssessment?.overallStatus || CANDIDATE_STATUS.CONDITIONAL,
      regionLabel: this.activeRegionInfo?.shortName || this.activeRegionInfo?.name || null,
      hasIndoorData: false
    });

    const scrub = this._el('route-scrubber');
    if (scrub) { scrub.value = '0'; scrub.disabled = true; }
    const remEl = this._el('dock-remaining-dist');
    const etaEl = this._el('dock-walk-eta');
    if (remEl) remEl.textContent = '현 위치 영향권 외';
    if (etaEl) etaEl.textContent = `진앙 거리 ${evaluatedQuake.distanceKm ?? '--'} km`;
    this._syncPlayButton();
    this._syncUtilityButtons();
  }

  _enterUnavailableDestinationState(pkg) {
    if (this.briefTimerId) {
      clearTimeout(this.briefTimerId);
      this.briefTimerId = null;
    }
    this._el('seismic-brief-banner')?.classList.remove('is-active');
    this.walkPlaying = false;
    this.routeProgressT = 0;
    this.activeFacilityPkg = null;
    this.activeFacilityId = 'UNAVAILABLE';
    this.alternativeRoutes = [];
    this.activeAltRouteIndex = 0;
    this.walkerGroup.visible = false;
    this.shelterSetbackGroup.visible = false;
    this.hanyangAdapter.clearVisuals();
    this.hanyangAdapter.setRouteDisplay('NONE');
    this.localSpatialLayer.setActiveOriginFacility(pkg?.defaultOriginMeta || null);

    this.uiAdapter.setRegionContext({
      impactStatus: this.activeImpactEval?.impactStatus || IMPACT_ZONE_STATUS.EDUCATIONAL_DRILL,
      destinationStatus: pkg?.destinationAssessment?.overallStatus || CANDIDATE_STATUS.UNAVAILABLE,
      destinationName: null,
      regionLabel: this.activeRegionInfo?.shortName || this.activeRegionInfo?.name || null,
      facilityName: pkg?.defaultOriginMeta?.name || null,
      hasIndoorData: false
    });

    const scrub = this._el('route-scrubber');
    if (scrub) { scrub.value = '0'; scrub.disabled = true; }
    const remEl = this._el('dock-remaining-dist');
    const etaEl = this._el('dock-walk-eta');
    if (remEl) remEl.textContent = '경로 산출 불가';
    if (etaEl) etaEl.textContent = '확인된 목적지·보행망 부족';
    this._syncPlayButton();
    this._syncUtilityButtons();
    this._renderCandidatePills();
    this._renderDataQualityStrip();
  }

  _renderDataQualityStrip() {
    const pkg = this.activeSpatialPkg;
    const compEl = this._el('dq-completeness-badge');
    const destEl = this._el('dq-destination-badge');
    const limEl = this._el('dq-limitation-summary');
    if (!compEl && !destEl && !limEl) return;

    const comp = pkg?.dataCompleteness || (pkg?.isHanyangNative ? 'SUFFICIENT' : 'PARTIAL');
    if (compEl) {
      compEl.textContent = comp === 'SUFFICIENT' ? '공간망 확인' : comp === 'PARTIAL' ? '일부 추정' : '데이터 부족 (INSUFFICIENT)';
      compEl.className = `dq-badge ${comp === 'INSUFFICIENT' ? 'is-insufficient' : comp === 'PARTIAL' ? 'is-conditional' : ''}`;
    }
    const destStatus = pkg?.destinationAssessment?.overallStatus || (pkg?.isHanyangNative ? CANDIDATE_STATUS.CONFIRMED : CANDIDATE_STATUS.UNKNOWN);
    if (destEl) {
      destEl.textContent =
        destStatus === CANDIDATE_STATUS.CONFIRMED ? '공식 대피소' :
        destStatus === CANDIDATE_STATUS.CONDITIONAL ? '개활 후보' :
        destStatus === CANDIDATE_STATUS.UNKNOWN ? '목적지 미확인 (UNKNOWN)' :
        '대피 후보 없음';
      destEl.className = `dq-badge ${(destStatus === CANDIDATE_STATUS.UNAVAILABLE || destStatus === CANDIDATE_STATUS.UNKNOWN) ? 'is-insufficient' : destStatus === CANDIDATE_STATUS.CONDITIONAL ? 'is-conditional' : ''}`;
    }
    if (limEl) {
      const firstLim = pkg?.dataLimitations?.[0] || this.activeImpactEval?.limitations || '';
      limEl.textContent = firstLim;
    }
  }

  _renderCandidatePills() {
    const row = this._el('candidate-pills-row');
    if (!row) return;
    const cands = this.activeSpatialPkg?.sheltersAndFacilities || [];
    if (cands.length === 0) {
      row.innerHTML = `<span style="font-size:10px; color:var(--evac-muted);">반경 내 확인 가능한 대피 목적지 후보 없음</span>`;
      return;
    }
    row.innerHTML = cands.slice(0, 4).map((c, idx) => {
      const unreachable = Boolean(c.dimensions?._unreachableFromOrigin) || c.candidateStatus === CANDIDATE_STATUS.UNAVAILABLE;
      const st = unreachable ? CANDIDATE_STATUS.UNAVAILABLE : (c.candidateStatus || (this.activeSpatialPkg?.isHanyangNative ? CANDIDATE_STATUS.CONFIRMED : CANDIDATE_STATUS.CONDITIONAL));
      const dotCls = st === CANDIDATE_STATUS.CONFIRMED ? 'is-confirmed' : (st === CANDIDATE_STATUS.UNAVAILABLE ? 'is-unavail' : 'is-conditional');
      const distTxt = unreachable
        ? '단절'
        : (Number.isFinite(c.dimensions?.distanceMeters) ? `${c.dimensions.distanceMeters}m` : '미상');
      const mcdaTitle = c.dimensions?.mcdaSummaryKo
        ? `title="${escapeHtml(c.dimensions.mcdaSummaryKo)}"`
        : '';
      return `
        <button type="button" class="candidate-pill-btn ${idx === this.selectedCandidateIndex ? 'active' : ''}" data-cand-idx="${idx}" ${mcdaTitle} ${unreachable ? 'disabled' : ''}>
          <span class="cand-dot ${dotCls}" aria-hidden="true"></span>
          <span class="cand-name">${escapeHtml(c.name)}</span>
          <span class="cand-dist">${escapeHtml(distTxt)}</span>
        </button>
      `;
    }).join('');
    row.querySelectorAll('[data-cand-idx]').forEach(btn => {
      btn.addEventListener('click', () => {
        this.selectDestinationCandidate(Number(btn.dataset.candIdx));
      });
    });
  }

  _getActiveShakingMmi() {
    const smMmi = this.activeSeismicCtx?.officialProducts?.shakemap?.maxMmi;
    if (Number.isFinite(Number(smMmi))) return Number(smMmi);
    const estMmi = this.activeSeismicCtx?.estimatedMmi;
    return Number.isFinite(Number(estMmi)) ? Number(estMmi) : null;
  }

  _buildFacilitySpec(orig, targetShelter) {
    const anchor = this.activeSpatialPkg?.metadata?.anchor;
    if (!anchor || !Number.isFinite(anchor.lat) || !Number.isFinite(anchor.lon)) return null;
    const isHanyang = Boolean(this.activeSpatialPkg?.isHanyangNative);
    const hasOriginBuilding = orig?.originHasBuilding !== undefined
      ? Boolean(orig.originHasBuilding)
      : (orig?.id !== 'OUTDOOR_ANALYSIS_ORIGIN' && orig?.indoorScope !== 'OUTDOOR_ONLY');
    return buildDynamicFacilityFromPoint({
      buildingId: orig.id,
      name: orig.name,
      east_m: orig.east_m,
      north_m: orig.north_m,
      width_m: orig.width_m || (hasOriginBuilding ? 18 : 4),
      depth_m: orig.depth_m || (hasOriginBuilding ? 18 : 4),
      yaw_rad: orig.yaw_rad || 0,
      height_m: hasOriginBuilding ? (orig.height_m || 18) : 0,
      originHasBuilding: hasOriginBuilding,
      indoorScope: orig.indoorScope || (hasOriginBuilding ? 'HEIGHT_ONLY_3D' : 'OUTDOOR_ONLY'),
      hasIndoorData: Boolean(orig.hasIndoorData),
      anchor,
      walkGraph: this.activeWalkGraph,
      buildingOBBs: this.activeSpatialPkg.obbBuildingsFloat32,
      waterPolygons: this.activeSpatialPkg.terrainAndHydrology?.waterPolygons || [],
      waterways: this.activeSpatialPkg.terrainAndHydrology?.waterways || [],
      shelter: targetShelter || null,
      destinationStatus: targetShelter?.candidateStatus || (isHanyang ? CANDIDATE_STATUS.CONFIRMED : CANDIDATE_STATUS.CONDITIONAL),
      shakingMmi: this._getActiveShakingMmi(),
      elevationSampler: (e, n) => sampleGridHeightAt(this.activeSpatialPkg.terrainGrid, e, n)
    });
  }

  /**
   * Evaluate candidate destinations via neutral exterior portal & Seismic Multi-Criteria
   * Optimization (walk distance + facade collapse/canyon exposure + bridge risk + shelter safety),
   * eliminating across-river Euclidean traps and routing failure misordering.
   */
  selectShortestOriginAndBuildFacility(originMeta, opts = {}) {
    const pkg = this.activeSpatialPkg;
    const rawCands = Array.isArray(pkg?.sheltersAndFacilities) ? pkg.sheltersAndFacilities : [];
    const originE = originMeta?.east_m ?? 0;
    const originN = originMeta?.north_m ?? 0;

    if (rawCands.length === 0) {
      this.selectedCandidateIndex = 0;
      const dynPkg = this._buildFacilitySpec(originMeta, null);
      if (dynPkg) this.switchToDynamicFacility(dynPkg, opts);
      this._renderCandidatePills();
      return null;
    }

    const withEuclid = rawCands.map((c) => {
      const euclid = Number.isFinite(c.east_m) && Number.isFinite(c.north_m)
        ? Math.round(Math.hypot(c.east_m - originE, c.north_m - originN))
        : 99999;
      return {
        ...c,
        dimensions: { ...(c.dimensions || {}), distanceMeters: euclid, _unreachableFromOrigin: false },
        _euclidMeters: euclid,
        _routedMeters: Infinity,
        _mcdaScore: Infinity
      };
    });
    withEuclid.sort((a, b) => {
      const aAvail = a.candidateStatus !== CANDIDATE_STATUS.UNAVAILABLE;
      const bAvail = b.candidateStatus !== CANDIDATE_STATUS.UNAVAILABLE;
      if (aAvail !== bAvail) return aAvail ? -1 : 1;
      return a._euclidMeters - b._euclidMeters;
    });

    const firstValid = withEuclid.find(c => c.candidateStatus !== CANDIDATE_STATUS.UNAVAILABLE) || null;
    if (!firstValid) {
      pkg.sheltersAndFacilities = withEuclid;
      this.selectedCandidateIndex = 0;
      const dynPkg = this._buildFacilitySpec(originMeta, null);
      if (dynPkg) this.switchToDynamicFacility(dynPkg, opts);
      this._renderCandidatePills();
      return null;
    }

    const hasOriginBuilding = originMeta?.originHasBuilding !== undefined
      ? Boolean(originMeta.originHasBuilding)
      : (originMeta?.id !== 'OUTDOOR_ANALYSIS_ORIGIN' && originMeta?.indoorScope !== 'OUTDOOR_ONLY');
    const bWidth = originMeta?.width_m || (hasOriginBuilding ? 18 : 4);
    const bDepth = originMeta?.depth_m || (hasOriginBuilding ? 18 : 4);
    const originBypassRad = 0.0;

    // Step 1: Neutral street-adjacent doorway for buildings, or direct street anchor for outdoor origins
    const evalStartXZ = hasOriginBuilding
      ? buildNeutralStreetExit({
          east_m: originE,
          north_m: originN,
          width_m: bWidth,
          depth_m: bDepth,
          yaw_rad: originMeta?.yaw_rad || 0,
          height_m: originMeta?.height_m || 18,
          walkGraph: this.activeWalkGraph,
          buildingOBBs: pkg.obbBuildingsFloat32,
          preferredTargetXZ: null
        }).footwayXZ
      : [originE, -originN];
    const evalSampler = (e, n) => sampleGridHeightAt(pkg.terrainGrid, e, n);
    const shakingMmi = this._getActiveShakingMmi();
    const waterPolys = pkg.terrainAndHydrology?.waterPolygons || [];
    const waterways = pkg.terrainAndHydrology?.waterways || [];

    // Step 2: Evaluate top 10 closest candidates + any confirmed official shelters cleanly on graph
    const availList = withEuclid.filter(c => c.candidateStatus !== CANDIDATE_STATUS.UNAVAILABLE);
    const evalSet = new Set(availList.slice(0, 10));
    availList.forEach(c => {
      if (c.candidateStatus === CANDIDATE_STATUS.CONFIRMED && evalSet.size < 14) {
        evalSet.add(c);
      }
    });

    let solvedCount = 0;
    let bestRouted = Infinity;
    for (const cand of evalSet) {
      // Early stop: a candidate whose straight-line distance already exceeds the best routed walk
      // cannot be shorter on foot; skipping it avoids multi-second exhaustive searches on large graphs.
      if (solvedCount >= 3 || (solvedCount > 0 && cand._euclidMeters > bestRouted * 1.15)) {
        cand._routedMeters = Infinity;
        cand._mcdaScore = Infinity;
        cand.dimensions._unreachableFromOrigin = false;
        continue;
      }
      let sol = solveCampusWalkGraph({
        startXZ: evalStartXZ,
        goalXZ: [cand.east_m, -cand.north_m],
        excludeStairs: false,
        shakingMmi,
        buildingOBBs: pkg.obbBuildingsFloat32,
        customWalkGraph: this.activeWalkGraph,
        elevationSampler: evalSampler,
        targetShelterId: cand.officialId || cand.id || 'SHELTER',
        waterPolygons: waterPolys,
        waterways,
        originCentroidXZ: [originE, -originN],
        originExclusionRadius: originBypassRad
      });
      // Fallback: if single street portal lies on wrong side of an enclosed block, test origin perimeter
      if (!sol.found && hasOriginBuilding) {
        sol = solveCampusWalkGraph({
          startXZ: [originE, -originN],
          goalXZ: [cand.east_m, -cand.north_m],
          excludeStairs: false,
          shakingMmi,
          buildingOBBs: pkg.obbBuildingsFloat32,
          customWalkGraph: this.activeWalkGraph,
          elevationSampler: evalSampler,
          targetShelterId: cand.officialId || cand.id || 'SHELTER',
          waterPolygons: waterPolys,
          waterways,
          originCentroidXZ: [originE, -originN],
          originExclusionRadius: originBypassRad
        });
      }

      if (sol.found && sol.totalDistanceMeters > 0) {
        solvedCount++;
        bestRouted = Math.min(bestRouted, sol.totalDistanceMeters);
        const mcda = evaluateDestinationMcdaScore(cand, sol, { shakingMmi });
        cand._routedMeters = sol.totalDistanceMeters;
        cand._mcdaScore = mcda.totalScore;
        cand.dimensions.distanceMeters = Math.round(sol.totalDistanceMeters);
        cand.dimensions.mcdaScore = mcda.totalScore;
        cand.dimensions.routeAudit = sol.routeAudit || null;
        cand.dimensions.mcdaSummaryKo = mcda.summaryKo;
        cand.dimensions._unreachableFromOrigin = false;
      } else {
        cand._routedMeters = Infinity;
        cand._mcdaScore = Infinity;
        cand.dimensions._unreachableFromOrigin = true;
        cand.dimensions.mcdaSummaryKo = '선택 건물에서 도보 연결 경로 미확인(하천·단절)';
      }
    }

    withEuclid.sort((a, b) => {
      const aUnavail = a.candidateStatus === CANDIDATE_STATUS.UNAVAILABLE || a.dimensions._unreachableFromOrigin;
      const bUnavail = b.candidateStatus === CANDIDATE_STATUS.UNAVAILABLE || b.dimensions._unreachableFromOrigin;
      if (aUnavail !== bUnavail) return aUnavail ? 1 : -1;
      const aKey = Number.isFinite(a._mcdaScore) ? a._mcdaScore : (1e7 + a._euclidMeters);
      const bKey = Number.isFinite(b._mcdaScore) ? b._mcdaScore : (1e7 + b._euclidMeters);
      return aKey - bKey;
    });

    pkg.sheltersAndFacilities = withEuclid.map(({ _euclidMeters, _routedMeters, _mcdaScore, ...clean }) => clean);
    this.selectedCandidateIndex = 0;

    const winner = pkg.sheltersAndFacilities[0];
    this.activeShelterJustification = winner?.justification || null;
    const winnerPkg = this._buildFacilitySpec(originMeta, winner);

    if (winnerPkg) {
      this.switchToDynamicFacility(winnerPkg, opts);
      const exactTotal = this.uiAdapter?.lastGuidance?.replanStatus?.totalDistanceMeters
        || winnerPkg?.routeBaselines?.PATH_SHORTEST_RAPID?.targetLengthMeters;
      if (exactTotal > 0 && winner) {
        winner.dimensions = { ...(winner.dimensions || {}), distanceMeters: Math.round(exactTotal) };
      }
    }
    this._renderCandidatePills();
    return winnerPkg;
  }

  selectDestinationCandidate(candIdx) {
    const cands = this.activeSpatialPkg?.sheltersAndFacilities || [];
    const target = cands[candIdx];
    if (!target || target.candidateStatus === CANDIDATE_STATUS.UNAVAILABLE) return null;
    this.selectedCandidateIndex = candIdx;
    const orig = this.activeFacilityPkg?.dynamicOriginMeta || this.activeSpatialPkg?.defaultOriginMeta || {
      id: this.activeFacilityId || 'DYNAMIC_ORIGIN',
      name: this.activeFacilityPkg?.buildingMetadata?.name || '출발 위치',
      east_m: this.activeFacilityPkg?.connector?.doorPos?.[0] ?? 0,
      north_m: -(this.activeFacilityPkg?.connector?.doorPos?.[2] ?? 0),
      width_m: 18,
      depth_m: 18,
      yaw_rad: 0,
      height_m: 18
    };

    const dynPkg = this._buildFacilitySpec(orig, target);
    if (!dynPkg) return null;
    this.switchToDynamicFacility(dynPkg, { snapStage: false, autoPlay: true, markerMode: this.originMarkerMode });
    const routedLen = this.uiAdapter?.lastGuidance?.replanStatus?.totalDistanceMeters
      || dynPkg?.routeBaselines?.PATH_SHORTEST_RAPID?.targetLengthMeters;
    if (routedLen > 0) {
      target.dimensions = { ...(target.dimensions || {}), distanceMeters: Math.round(routedLen) };
    }
    this._renderCandidatePills();
    return target;
  }

  _renderRegionBenchmarkChips() {
    const grid = this._el('region-chips-grid');
    if (!grid) return;
    grid.innerHTML = KOREA_BENCHMARK_REGIONS.map(r => `
      <button type="button" class="region-chip-btn ${r.id === this.activeRegionId ? 'active' : ''}" data-kr-region="${escapeHtml(r.id)}">
        <strong>${escapeHtml(r.shortName)}</strong>
        <small>${r.lat.toFixed(3)}°N, ${r.lon.toFixed(3)}°E</small>
      </button>
    `).join('');
    grid.querySelectorAll('[data-kr-region]').forEach(btn => {
      btn.addEventListener('click', () => {
        const reg = KOREA_BENCHMARK_REGIONS.find(item => item.id === btn.dataset.krRegion);
        if (reg) {
          this._setRegionPopoverOpen(false);
          this.switchToRegion(reg.lat, reg.lon, { regionId: reg.id, locationSource: 'FREE_MODE', name: reg.name, shortName: reg.shortName });
        }
      });
    });
  }

  async _handleRegionSearchSubmit(query) {
    const parsedCoord = LocationProvider.parseCoordinateInput(query);
    if (parsedCoord) {
      this._setRegionPopoverOpen(false);
      return this.switchToRegion(parsedCoord.lat, parsedCoord.lon, {
        regionId: `COORD_${parsedCoord.lat.toFixed(3)}_${parsedCoord.lon.toFixed(3)}`,
        name: `지정 좌표 (${parsedCoord.lat.toFixed(4)}°N, ${parsedCoord.lon.toFixed(4)}°E)`,
        shortName: `${parsedCoord.lat.toFixed(3)}, ${parsedCoord.lon.toFixed(3)}`
      });
    }

    const resultsEl = this._el('region-search-results');
    if (resultsEl) {
      resultsEl.innerHTML = `<div style="font-size:10.5px; color:var(--evac-muted); padding:4px 2px;">검색 중...</div>`;
    }
    const hits = await geocodeKoreaQuery(query);
    if (!resultsEl) return;
    if (!hits || hits.length === 0) {
      resultsEl.innerHTML = `<div style="font-size:10.5px; color:var(--evac-muted); padding:4px 2px;">검색 결과 없음 (예: 속초, 경주, 또는 38.207, 128.592)</div>`;
      return;
    }
    resultsEl.innerHTML = hits.map((h, idx) => `
      <button type="button" class="region-result-row" data-hit-idx="${idx}">
        ${escapeHtml(h.displayName)} <span style="color:var(--evac-muted); font-size:9.5px;">(${h.lat.toFixed(3)}, ${h.lon.toFixed(3)})</span>
      </button>
    `).join('');
    resultsEl.querySelectorAll('[data-hit-idx]').forEach(btn => {
      btn.addEventListener('click', () => {
        const hit = hits[Number(btn.dataset.hitIdx)];
        if (hit) {
          this._setRegionPopoverOpen(false);
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
   * Show / hide the clean 2-track Entry Mode Gate (#entry-mode-gate).
   */
  _showEntryModeGate(noticeText = '', titleText = null) {
    if (this.briefTimerId) {
      clearTimeout(this.briefTimerId);
      this.briefTimerId = null;
    }
    this._el('seismic-brief-banner')?.classList.remove('is-active');
    if (this.mountRoot) this.mountRoot.classList.add('has-entry-gate-open');
    const gate = this._el('entry-mode-gate');
    if (gate) gate.classList.add('is-visible');
    const titleEl = this._el('emg-title');
    if (titleEl && titleText) titleEl.textContent = titleText;
    const noticeEl = this._el('emg-notice');
    if (noticeEl) {
      if (noticeText) {
        noticeEl.textContent = noticeText;
        noticeEl.classList.add('is-visible');
      } else {
        noticeEl.textContent = '';
        noticeEl.classList.remove('is-visible');
      }
    }
    this._renderSafetyRuleCard();
    this._updateModeAndHandoffUi();
    this._syncResponsiveTopBarOffset();
  }

  _hideEntryModeGate() {
    if (this.mountRoot) this.mountRoot.classList.remove('has-entry-gate-open');
    this._el('entry-mode-gate')?.classList.remove('is-visible');
    const noticeEl = this._el('emg-notice');
    if (noticeEl) {
      noticeEl.textContent = '';
      noticeEl.classList.remove('is-visible');
    }
    this._renderSafetyRuleCard();
    this._syncResponsiveTopBarOffset();
  }

  _updateModeAndHandoffUi() {
    const modeBadge = this._el('analysis-mode-badge');
    if (modeBadge) {
      if (this.originMarkerMode === 'USER_GPS' || this.session?.userActualLocation) {
        if (this.originMarkerMode === 'USER_GPS') {
          modeBadge.className = 'mode-badge-pill is-gps';
          modeBadge.textContent = '내 현재 위치 · GPS';
        } else if (this.originMarkerMode === 'PICKED_BUILDING' || this.originMarkerMode === 'FREE_MODE_ANCHOR') {
          modeBadge.className = 'mode-badge-pill is-free-mode';
          modeBadge.textContent = '자유 모드 (실제 GPS 아님)';
        }
      } else if (this.originMarkerMode === 'FREE_MODE_ANCHOR' || this.originMarkerMode === 'PICKED_BUILDING') {
        modeBadge.className = 'mode-badge-pill is-free-mode';
        modeBadge.textContent = '자유 모드 (실제 GPS 아님)';
      } else {
        modeBadge.className = 'mode-badge-pill';
        modeBadge.textContent = '위치 미선택';
      }
    }

    const handoffStrip = this._el('handoff-context-strip');
    const handed = this.session?.handedGlobeEvent || null;
    if (handoffStrip) {
      handoffStrip.classList.toggle('is-visible', Boolean(handed));
      const metaEl = this._el('handoff-quake-meta');
      if (metaEl && handed) {
        const magVal = handed.magnitude ?? handed.mag ?? null;
        const hasValidMag = magVal !== null && magVal !== undefined && Number.isFinite(Number(magVal)) && Number(magVal) > 0;
        const magStr = hasValidMag ? `${handed.magScale || 'M'} ${Number(magVal).toFixed(1)}` : '규모 미상';
        const depthVal = handed.depthKm;
        const hasValidDepth = depthVal !== null && depthVal !== undefined && Number.isFinite(Number(depthVal)) && Number(depthVal) > 0;
        const depthStr = hasValidDepth ? `깊이 ${Number(depthVal).toFixed(1)} km` : '깊이 미상';
        const smMmi = handed.officialProducts?.shakemap?.maxMmi;
        const smStr = Number.isFinite(smMmi) ? `USGS ShakeMap MMI ${smMmi}` : 'ShakeMap 미수신';
        const hasOaf = Boolean(handed.officialProducts?.aftershockForecast || handed.officialProducts?.oaf);
        const oafNote = hasOaf ? ' · OAF(여진 예측≠현재 흔들림)' : '';
        metaEl.innerHTML = `지구본 연동 사건: <strong>${escapeHtml(handed.title || '선택 지진')}</strong> (${escapeHtml(magStr)} · ${escapeHtml(depthStr)} · ${escapeHtml(handed.provenance?.source || handed.sourceName || '출처 확인')}) · ${escapeHtml(smStr)}${escapeHtml(oafNote)}`;
      }
      const epiBtn = this._el('btn-handoff-epicenter');
      if (epiBtn) {
        const hasEpicenter = Boolean(handed && Number.isFinite(handed?.epicenterLat) && Number.isFinite(handed?.epicenterLon));
        epiBtn.style.display = handed ? 'inline-flex' : 'none';
        epiBtn.disabled = !hasEpicenter;
      }
      const nearUrbanBtn = this._el('btn-handoff-nearest-urban');
      const anchor = this.activeSpatialPkg?.metadata?.anchor;
      const missingLocalRoutes = Boolean(anchor && !this.activeSpatialPkg?.initialFacilityPackage && !this.activeSpatialPkg?.isHanyangNative);
      let bestUrban = null;
      if (missingLocalRoutes && Number.isFinite(anchor.lat) && Number.isFinite(anchor.lon)) {
        const toRad = d => (d * Math.PI) / 180;
        for (const reg of KOREA_BENCHMARK_REGIONS) {
          if (reg.isHanyangDefault) continue;
          const dLat = toRad(reg.lat - anchor.lat);
          const dLon = toRad(reg.lon - anchor.lon);
          const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(anchor.lat)) * Math.cos(toRad(reg.lat)) * Math.sin(dLon / 2) ** 2;
          const km = 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(Math.max(0, 1 - a)));
          if (km > 1.2 && km <= 85.0 && (!bestUrban || km < bestUrban.km)) {
            bestUrban = { reg, km: Number(km.toFixed(1)) };
          }
        }
      }
      if (nearUrbanBtn) {
        if (bestUrban) {
          nearUrbanBtn.style.display = 'inline-flex';
          nearUrbanBtn.textContent = `인근 도심(${bestUrban.reg.shortName} · ${bestUrban.km}km) 대피 동선 보기`;
          nearUrbanBtn.dataset.lat = String(bestUrban.reg.lat);
          nearUrbanBtn.dataset.lon = String(bestUrban.reg.lon);
          nearUrbanBtn.dataset.regionId = bestUrban.reg.id;
          nearUrbanBtn.dataset.name = bestUrban.reg.name;
          nearUrbanBtn.dataset.shortName = bestUrban.reg.shortName;
        } else {
          nearUrbanBtn.style.display = 'none';
        }
      }
      this._syncEmptyRegionCallout(bestUrban);
    } else {
      const epiBtn = this._el('btn-handoff-epicenter');
      if (epiBtn) epiBtn.style.display = 'none';
      const nearUrbanBtn = this._el('btn-handoff-nearest-urban');
      if (nearUrbanBtn) nearUrbanBtn.style.display = 'none';
      this._syncEmptyRegionCallout(null);
    }
  }

  _syncEmptyRegionCallout(bestUrban = null) {
    const callout = this._el('empty-region-callout');
    if (!callout) return;
    const gateOpen = Boolean(this._el('entry-mode-gate')?.classList.contains('is-visible'));
    const anchor = this.activeSpatialPkg?.metadata?.anchor;
    const obbCount = this.activeSpatialPkg?.obbBuildingsFloat32?.length || 0;
    const edgeCount = this.activeWalkGraph?.edges?.length || 0;
    const show = Boolean(
      !gateOpen &&
      !this._isLoadingRegion &&
      anchor &&
      !this.activeSpatialPkg?.isHanyangNative &&
      !this.activeSpatialPkg?.initialFacilityPackage &&
      obbCount === 0 &&
      edgeCount === 0
    );
    callout.classList.toggle('is-visible', show);
    callout.setAttribute('aria-hidden', show ? 'false' : 'true');

    const cta = this._el('btn-erc-nearest-urban');
    if (cta) {
      if (bestUrban) {
        cta.style.display = 'inline-flex';
        cta.textContent = `${bestUrban.reg.shortName} (${bestUrban.km}km) 대피 동선 열기 →`;
        cta.dataset.lat = String(bestUrban.reg.lat);
        cta.dataset.lon = String(bestUrban.reg.lon);
        cta.dataset.regionId = bestUrban.reg.id;
        cta.dataset.name = bestUrban.reg.name;
        cta.dataset.shortName = bestUrban.reg.shortName;
      } else {
        cta.style.display = 'none';
      }
    }
  }

  async _handleGateMyLocation() {
    this._showEntryModeGate('브라우저 현재 위치(GPS) 권한을 확인하고 있습니다...', '현재 위치를 확인하는 중입니다');
    const pos = await this.locationProvider.detectBrowserLocation();
    this.session?.setGpsLocationResult(pos);
    if (pos.ok) {
      this._hideEntryModeGate();
      await this.switchToRegion(pos.lat, pos.lon, {
        regionId: 'USER_GPS_CURRENT',
        locationSource: 'GPS',
        name: `내 현재 위치 (${pos.lat.toFixed(4)}°N, ${pos.lon.toFixed(4)}°E)`,
        shortName: '내 현재 위치(GPS)',
        gpsAccuracyMeters: pos.accuracyMeters ?? null
      });
      return { ok: true, pos };
    }

    // Honest GPS denied / unavailable auto-fallback to Free Mode without forging GPS coordinates
    this.session?.setEntryMode(EXPERIENCE_ENTRY_MODES.FREE_MODE);
    this._showEntryModeGate(
      `${pos.error || '위치 권한을 사용할 수 없습니다.'} — 자동으로 자유 모드 전환을 안내합니다 (선택 지역은 실제 내 GPS 위치로 간주되지 않습니다).`,
      '위치 확인 불가 · 자유 모드로 지역을 선택하세요'
    );
    return { ok: false, error: pos.error || 'GPS_UNAVAILABLE' };
  }

  /**
   * Single unified entry orchestrator called by ExhibitionModeManager (Globe <-> Local) and viewer_p2_6.html.
   */
  async applySessionHandoff(opts = {}, stageKey = CAMERA_STAGES.CAMPUS_OVERVIEW) {
    const handed = opts.handedEvent || null;
    if (handed && this.session) {
      this.session.setGlobeEventHandoff(handed);
    } else if (opts.clearHandedEvent && this.session) {
      this.session.clearEventHandoff();
    }

    const activeHanded = this.session?.handedGlobeEvent || handed || null;
    const entryMode = opts.entryMode || (activeHanded ? EXPERIENCE_ENTRY_MODES.FROM_GLOBE_EVENT : (Number.isFinite(opts.lat) && Number.isFinite(opts.lon) ? EXPERIENCE_ENTRY_MODES.FREE_MODE : EXPERIENCE_ENTRY_MODES.UNSELECTED));
    if (this.session) {
      this.session.setEntryMode(entryMode);
    }

    if (entryMode === EXPERIENCE_ENTRY_MODES.MY_LOCATION) {
      this._updateModeAndHandoffUi();
      return this._handleGateMyLocation();
    }

    if (entryMode === EXPERIENCE_ENTRY_MODES.FROM_GLOBE_EVENT) {
      this._updateModeAndHandoffUi();
      if (Number.isFinite(opts.lat) && Number.isFinite(opts.lon)) {
        this._hideEntryModeGate();
        return this.switchToRegion(opts.lat, opts.lon, {
          ...opts,
          locationSource: opts.locationSource || 'FREE_MODE',
          handedEvent: activeHanded
        });
      }
      if (Number.isFinite(activeHanded?.epicenterLat) && Number.isFinite(activeHanded?.epicenterLon)) {
        this._hideEntryModeGate();
        return this.switchToRegion(activeHanded.epicenterLat, activeHanded.epicenterLon, {
          regionId: `EPI_${activeHanded.eventId || 'GLOBE'}`,
          locationSource: 'FREE_MODE',
          name: `${activeHanded.placeName || activeHanded.title || '진앙'} 주변 공간`,
          shortName: '진앙 주변',
          handedEvent: activeHanded
        });
      }
      this._showEntryModeGate(
        '선택한 역사 기록은 진앙 좌표가 불명확합니다. 내 현재 위치(GPS) 또는 탐색할 지역을 선택하십시오.',
        `${activeHanded?.title || '지진 기록'} · 기준 위치 선택`
      );
      return { waitingForAnchor: true };
    }

    if (Number.isFinite(opts.lat) && Number.isFinite(opts.lon)) {
      this._hideEntryModeGate();
      this.session?.setFreeModeLocation(opts.lat, opts.lon, opts.name || opts.shortName || '지정 지역', 'PRESET_REGION');
      return this.switchToRegion(opts.lat, opts.lon, {
        ...opts,
        locationSource: 'FREE_MODE',
        stage: stageKey
      });
    }

    this._showEntryModeGate();
    return { waitingForEntryGate: true };
  }

  /**
   * Switch entire 3D topography + OSM buildings + walk graph + shelters to any coordinate in Korea.
   */
  async switchToRegion(lat, lon, opts = {}) {
    const reqSeq = ++this._regionRequestSeq;
    this._isLoadingRegion = true;
    const labelEl = this._el('region-active-label');
    if (labelEl) labelEl.textContent = `${opts.shortName || opts.name || '지역'} 불러오는 중...`;
    this._hideEntryModeGate();

    // Clear previous region's active routes/alt buttons immediately so stale telemetry never bleeds across switches
    this.activeFacilityPkg = null;
    this.alternativeRoutes = [];
    this.activeAltRouteIndex = 0;
    this.walkPlaying = false;
    this.hanyangAdapter?.clearVisuals?.();
    if (this.walkerGroup) this.walkerGroup.visible = false;
    this._syncPlayButton();
    this._syncUtilityButtons();

    const isActualGps = opts.locationSource === 'GPS' || opts.regionId === 'USER_GPS_CURRENT';
    if (isActualGps) {
      this.locationProvider.setGpsLocation(lat, lon, opts.gpsAccuracyMeters ?? null, opts.shortName || opts.name || '내 현재 위치(GPS)');
      this.originMarkerMode = 'USER_GPS';
      this.session?.setEntryMode(EXPERIENCE_ENTRY_MODES.MY_LOCATION);
    } else {
      this.locationProvider.setUserSelectedLocation(lat, lon, opts.shortName || opts.name || '지정 분석 위치');
      this.originMarkerMode = 'FREE_MODE_ANCHOR';
      if (this.session && this.session.entryMode !== EXPERIENCE_ENTRY_MODES.FROM_GLOBE_EVENT) {
        this.session.setFreeModeLocation(lat, lon, opts.name || opts.shortName || '지정 분석 위치', 'MANUAL_REGION');
      }
    }
    this._updateModeAndHandoffUi();

    let pkg = null;
    try {
      pkg = await loadRegionalSpatialPackage(lat, lon, {
        ...opts,
        usePilotPreset: Boolean(opts.usePilotPreset && this.devMode)
      });
    } finally {
      if (reqSeq === this._regionRequestSeq) {
        this._isLoadingRegion = false;
      }
    }
    if (reqSeq !== this._regionRequestSeq || !pkg) return pkg;
    this.activeRegionId = pkg.regionInfo?.id || opts.regionId || 'custom_loc';
    this.activeRegionInfo = pkg.regionInfo || { id: this.activeRegionId, name: opts.name || '선택 지역', shortName: opts.shortName || '선택 지역', lat, lon };
    this.activeSpatialPkg = pkg;
    this.activeWalkGraph = pkg.walkGraph || { nodes: [], edges: [] };
    this.selectedCandidateIndex = 0;

    this.localSpatialLayer.setSpatialPackage(pkg);
    this.router.setRealMapRouting({
      enabled: true,
      buildingOBBs: pkg.obbBuildingsFloat32,
      customWalkGraph: this.activeWalkGraph,
      waterPolygons: pkg.terrainAndHydrology?.waterPolygons || [],
      waterways: pkg.terrainAndHydrology?.waterways || [],
      elevationSampler: (e, n) => sampleGridHeightAt(pkg.terrainGrid, e, n)
    });
    if (this.hanyangAdapter) {
      this.hanyangAdapter.buildingOBBs = pkg.obbBuildingsFloat32;
      this.hanyangAdapter.customWalkGraph = this.activeWalkGraph;
      this.hanyangAdapter.waterPolygons = pkg.terrainAndHydrology?.waterPolygons || [];
      this.hanyangAdapter.waterways = pkg.terrainAndHydrology?.waterways || [];
      this.hanyangAdapter.elevationSampler = (e, n) => sampleGridHeightAt(pkg.terrainGrid, e, n);
    }
    this.uiAdapter.clearStationTelemetry();

    if (labelEl) labelEl.textContent = this.activeRegionInfo.shortName || this.activeRegionInfo.name;
    const stageBtn = this._el('btn-stage-campus');
    if (stageBtn) stageBtn.textContent = '경로 집중';
    const personalBtn = this._el('btn-stage-personal');
    if (personalBtn) {
      personalBtn.disabled = !(pkg.isHanyangNative && this.devMode);
      personalBtn.title = (pkg.isHanyangNative && this.devMode) ? '파일럿 실내 진입 확인' : '범용 지역은 실내 평면도 미제공';
    }

    this._renderRegionBenchmarkChips();
    this._renderCandidatePills();
    this._renderDataQualityStrip();
    this._updateModeAndHandoffUi();

    // Update origin pills & active destination OR cleanly clear visuals if data is insufficient
    const activeOriginLabel = isActualGps ? '내 현재 위치(GPS)' : (pkg.initialFacilityPackage?.buildingMetadata?.name || '분석 기준(자유 모드)');
    if (pkg.isHanyangNative && this.devMode && opts.usePilotPreset) {
      this.switchFacilityPackage('BLDG_212_ENG1', { skipBrief: true });
      this._toggleHanyangOriginButtons(true);
    } else if (pkg.initialFacilityPackage) {
      const initOriginMeta = pkg.initialFacilityPackage.dynamicOriginMeta || pkg.defaultOriginMeta;
      if (initOriginMeta && Array.isArray(pkg.sheltersAndFacilities) && pkg.sheltersAndFacilities.length > 0) {
        this.selectShortestOriginAndBuildFacility(initOriginMeta, {
          snapStage: true,
          skipBrief: true,
          markerMode: this.originMarkerMode
        });
      } else {
        const firstShelter = pkg.sheltersAndFacilities?.[0] || null;
        this.activeShelterJustification = firstShelter?.justification || null;
        this.switchToDynamicFacility(pkg.initialFacilityPackage, { skipBrief: true, markerMode: this.originMarkerMode });
      }
      this._toggleHanyangOriginButtons(false, activeOriginLabel);
    } else {
      this._toggleHanyangOriginButtons(false, activeOriginLabel);
      const regVps = pkg.viewpoints || HANYANG_LOCAL_SPATIAL_VIEWPOINTS;
      this.camTransition.setFacilityViewpoints(withExtendedFar({
        REGIONAL_APPROACH: regVps.REGIONAL_APPROACH || HANYANG_LOCAL_SPATIAL_VIEWPOINTS.REGIONAL_APPROACH,
        CAMPUS_OVERVIEW: regVps.CAMPUS_OVERVIEW || HANYANG_LOCAL_SPATIAL_VIEWPOINTS.CAMPUS_OVERVIEW
      }));
      this.setCameraStage(opts.stage || CAMERA_STAGES.CAMPUS_OVERVIEW);
      this._enterUnavailableDestinationState(pkg);
    }

    // Automatic location-aware scenario selection via AutoScenarioResolver unless overridden
    const handed = opts.handedEvent || this.session?.handedGlobeEvent || null;
    const scToApply = opts.customScenario || AutoScenarioResolver.resolveForLocation({
      anchorLat: lat,
      anchorLon: lon,
      anchorLabel: this.activeRegionInfo.shortName || this.activeRegionInfo.name,
      catalogEvents: PRESET_EARTHQUAKE_SCENARIOS,
      handedEvent: handed
    });
    this.applyScenarioSpec(scToApply, { skipBrief: !pkg.initialFacilityPackage || opts.withSeismicBrief === false });
    return pkg;
  }

  _toggleHanyangOriginButtons(isHanyangPilot, customOriginLabel = '분석 기준(자유 모드)') {
    const group = this._el('origin-select-group');
    if (!group) return;
    if (isHanyangPilot && this.devMode) {
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
        <button type="button" class="origin-pill active" id="btn-fac-dynamic">${escapeHtml(customOriginLabel)}</button>
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
    this.walkerGroup.visible = Boolean(this.activeFacilityPkg);
    this._syncShelterSetbackVisuals?.();
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

    const holdMs = opts.durationMs || 900;
    this.briefTimerId = setTimeout(() => {
      this.beginActiveEvacuation();
    }, holdMs);
  }

  beginActiveEvacuation() {
    if (this.briefTimerId) {
      clearTimeout(this.briefTimerId);
      this.briefTimerId = null;
    }
    this._isScrubbingRoute = false;
    this._el('seismic-brief-banner')?.classList.remove('is-active');
    this.experiencePhase = EXPERIENCE_PHASES.EVACUATION_ACTIVE;
    this._syncShelterSetbackVisuals?.();
    this.walkPlaying = true;
    if (this.routeProgressT >= 0.99) this.routeProgressT = 0.0;
    this._syncPlayButton();
    this._updateSafetyRuleForProgress();
    this._syncResponsiveTopBarOffset();
  }

  /**
   * Switch to any dynamic 3D building picked on the map or loaded nationwide (피드백 5 & 6).
   */
  switchToDynamicFacility(facilityPkg, opts = {}) {
    if (!facilityPkg) {
      this._enterUnavailableDestinationState(this.activeSpatialPkg);
      return null;
    }
    if (this.briefTimerId) {
      clearTimeout(this.briefTimerId);
      this.briefTimerId = null;
    }
    this._el('seismic-brief-banner')?.classList.remove('is-active');
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
    const hasIndoorData = Boolean(
      this.activeSpatialPkg?.isHanyangNative && this.activeFacilityId === 'BLDG_212_ENG1'
    );
    this.uiAdapter.setUserFloor(hasIndoorData ? (facilityPkg.defaultFloor ?? 3) : 1);
    if (!opts.preserveStationTelemetry) {
      this.uiAdapter.clearStationTelemetry();
    }

    // Query optional edge-penalized alternative routes if pedestrian router supports it
    this.alternativeRoutes = [];
    this.activeAltRouteIndex = 0;
    if (typeof this.router?.findAlternativeRoutes === 'function' && facilityPkg.outdoorGraph?.edges?.length > 0) {
      const altBundle = this.router.findAlternativeRoutes();
      if (Array.isArray(altBundle)) {
        this.alternativeRoutes = altBundle.filter(r => r && r.found);
      } else if (altBundle && typeof altBundle === 'object') {
        const list = [];
        if (altBundle.primaryRoute?.found) list.push(altBundle.primaryRoute);
        if (
          altBundle.alternativeRoute?.found &&
          !this._areRoutesIdentical3D(altBundle.alternativeRoute.waypoints3D, altBundle.primaryRoute?.waypoints3D)
        ) {
          list.push(altBundle.alternativeRoute);
        }
        this.alternativeRoutes = list;
      }
    }
    const altBtn = this._el('btn-route-alt');
    if (altBtn) {
      altBtn.style.display = this.alternativeRoutes.length > 1 ? 'inline-block' : 'none';
      altBtn.classList.remove('active');
      altBtn.textContent = '대체 경로';
    }

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
      height_m: facilityPkg.originHasBuilding === false ? 0 : 18,
      originHasBuilding: facilityPkg.originHasBuilding !== false && this.activeFacilityId !== 'OUTDOOR_ANALYSIS_ORIGIN',
      hasIndoorData
    };
    const effectiveMarkerMode = opts.markerMode || this.originMarkerMode || (originMeta.originHasBuilding === false ? 'FREE_MODE_ANCHOR' : 'PICKED_BUILDING');
    this.localSpatialLayer.setActiveOriginFacility({ ...originMeta, hasIndoorData, markerMode: effectiveMarkerMode });
    if (this.activeSeismicCtx) {
      this.localSpatialLayer.setEpicenterContext(this.activeSeismicCtx);
    }

    const scrub = this._el('route-scrubber');
    if (scrub) scrub.disabled = false;

    const originGroup = this._el('origin-select-group');
    const originPillLabel = effectiveMarkerMode === 'USER_GPS'
      ? '내 현재 위치(GPS)'
      : (effectiveMarkerMode === 'FREE_MODE_ANCHOR' ? `분석 기준 · ${originMeta.name}` : `선택 건물 · ${originMeta.name}`);
    if (originGroup && this.activeSpatialPkg.isHanyangNative && this.devMode) {
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
        dynPill.textContent = originPillLabel;
      }
    } else if (originGroup) {
      originGroup.innerHTML = `<button type="button" class="origin-pill active" id="btn-fac-dynamic">${escapeHtml(originPillLabel)}</button>`;
    }

    if (opts.snapStage !== false || this.camTransition.currentStage === CAMERA_STAGES.GLOBAL_ORBIT) {
      this.setCameraStage(CAMERA_STAGES.CAMPUS_OVERVIEW);
    }
    this.hanyangAdapter.setThemeColors(this.activeVisualTheme === 'ARCHITECTURAL_DAY');
    this.routeProgressT = 0.02;
    this.experiencePhase = EXPERIENCE_PHASES.EVACUATION_ACTIVE;
    this._syncShelterSetbackVisuals?.();
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
    const origE = namedMatch ? namedMatch.east_m : connDoor[0];
    const origN = namedMatch ? namedMatch.north_m : -connDoor[2];
    this.localSpatialLayer.setActiveOriginFacility({
      id: this.activeFacilityId,
      name: `${pkg.buildingMetadata?.unitNumber || '212'}동`,
      east_m: origE,
      north_m: origN,
      height_m: namedMatch ? namedMatch.height_m : 24
    });
    if (Array.isArray(this.activeSpatialPkg?.sheltersAndFacilities)) {
      const targetLen = pkg.routeBaselines?.PATH_SHORTEST_RAPID?.targetLengthMeters;
      this.activeSpatialPkg.sheltersAndFacilities.forEach((c) => {
        const matchesPkg = c.id === shelterId || c.officialId === shelterId;
        const d = (matchesPkg && targetLen > 0)
          ? Math.round(targetLen)
          : Math.round(Math.hypot((c.east_m ?? 0) - origE, (c.north_m ?? 0) - origN));
        c.dimensions = { ...(c.dimensions || {}), distanceMeters: d };
      });
      const matchIdx = this.activeSpatialPkg.sheltersAndFacilities.findIndex(c => c.id === shelterId || c.officialId === shelterId);
      if (matchIdx >= 0) this.selectedCandidateIndex = matchIdx;
      this._renderCandidatePills();
    }
    if (this.activeSeismicCtx) {
      this.localSpatialLayer.setEpicenterContext(this.activeSeismicCtx);
    }

    // Update origin pill consistently for both devMode presets and standard mode
    this._el('btn-fac-dynamic')?.remove();
    const originGroup = this._el('origin-select-group');
    if (originGroup && this.activeSpatialPkg?.isHanyangNative && this.devMode) {
      this._qAll('#btn-fac-212, #btn-fac-hit, #btn-fac-paiknam').forEach(b => b.classList.remove('active'));
      if (this.activeFacilityId === 'BLDG_701_HIT') this._el('btn-fac-hit')?.classList.add('active');
      else if (this.activeFacilityId === 'BLDG_104_PAIKNAM') this._el('btn-fac-paiknam')?.classList.add('active');
      else this._el('btn-fac-212')?.classList.add('active');
    } else if (originGroup) {
      const originLabel = `선택 건물 · ${pkg.buildingMetadata?.name || `${pkg.buildingMetadata?.unitNumber || '212'}동`}`;
      originGroup.innerHTML = `<button type="button" class="origin-pill active" id="btn-fac-dynamic">${escapeHtml(originLabel)}</button>`;
    }

    if (opts.snapStage !== false || this.camTransition.currentStage === CAMERA_STAGES.GLOBAL_ORBIT) {
      this.setCameraStage(CAMERA_STAGES.CAMPUS_OVERVIEW);
    }
    this.hanyangAdapter.setThemeColors(this.activeVisualTheme === 'ARCHITECTURAL_DAY');
    this.routeProgressT = 0.04;
    this.experiencePhase = opts.skipBrief === false ? EXPERIENCE_PHASES.SEISMIC_BRIEF : EXPERIENCE_PHASES.EVACUATION_ACTIVE;
    this._syncShelterSetbackVisuals?.();
    if (opts.autoPlay !== false && this.experiencePhase === EXPERIENCE_PHASES.EVACUATION_ACTIVE) {
      this.walkPlaying = true;
      this._syncPlayButton();
    }
    this.renderUI();
    return this.activeFacilityId;
  }

  async loadAndBindSeismicEvent(eventId) {
    // Route catalog presets cleanly through HazardProvider so impact radius checks apply universally
    const presetMap = {
      hist_2016_gyeongju: 'KMA-2016-GYEONGJU',
      hist_2017_pohang: 'KMA-2017-POHANG',
      hist_2024_buan: 'KMA-2024-BUAN',
      hist_1681_0626: 'HIST-1681-YANGYANG'
    };
    if (presetMap[eventId]) {
      const matched = PRESET_EARTHQUAKE_SCENARIOS.find(s => s.id === presetMap[eventId]);
      if (matched) return this.applyScenarioSpec(matched, { skipBrief: false });
    }

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
    const resolved = resolveActiveSeismicEvent(eventId, { usgsFeatures });
    if (resolved && Number.isFinite(resolved.lat) && Number.isFinite(resolved.lon)) {
      return this.applyScenarioSpec({
        id: resolved.eventId,
        scenarioType: eventId?.startsWith('hist_1681') ? SCENARIO_TYPES.HISTORICAL_RECORD : SCENARIO_TYPES.OBSERVED_EVENT,
        title: resolved.titleKo,
        epicenterLat: resolved.lat,
        epicenterLon: resolved.lon,
        magnitude: resolved.mag ?? null,
        depthKm: resolved.depthKm ?? null,
        originText: resolved.provenanceBadge || '관측·카탈로그 사건'
      }, { skipBrief: true });
    }

    this.activeSeismicCtx = resolved;
    this.localSpatialLayer.setEpicenterContext(this.activeSeismicCtx);
    this._renderEarthquakeImpactHeader();
    return this.activeSeismicCtx;
  }

  _renderEarthquakeImpactHeader() {
    if (!this.activeSeismicCtx) return;
    const g = this.uiAdapter.lastGuidance;
    const pkg = this.activeFacilityPkg;
    const regionLabel = this.activeRegionInfo?.shortName || this.activeRegionInfo?.name || '분석 지역';
    const rawName = pkg?.buildingMetadata?.name?.split('(')[0]?.trim() || this.activeSpatialPkg?.defaultOriginMeta?.name || regionLabel;
    const unitNo = pkg?.buildingMetadata?.unitNumber;
    const displayOrigin = unitNo ? `${rawName}(${unitNo}동)` : rawName;
    const shelterName = pkg?.shelter?.officialName || this.activeSpatialPkg?.sheltersAndFacilities?.[0]?.name || null;
    const activeTotalDist = g?.replanStatus?.totalDistanceMeters
      || (this.uiAdapter.preferredRouteMode === 'STEP_FREE'
        ? pkg?.routeBaselines?.PATH_STEP_FREE_DETOUR?.targetLengthMeters
        : pkg?.routeBaselines?.PATH_SHORTEST_RAPID?.targetLengthMeters)
      || null;

    const impStatus = this.activeImpactEval?.impactStatus;
    const isOutside = impStatus === IMPACT_ZONE_STATUS.OUTSIDE_IMPACT_ZONE;
    const isHistRecord = impStatus === IMPACT_ZONE_STATUS.HISTORICAL_REFERENCE_ONLY;

    const hl = this._el('evac-route-headline');
    if (hl) {
      if (isOutside) {
        hl.textContent = `${regionLabel} · 분석 위치 영향권 외 (거리 ${this.activeSeismicCtx.distanceKm ?? '--'} km)`;
      } else if (!pkg || !shelterName || !activeTotalDist) {
        hl.textContent = isHistRecord
          ? `${displayOrigin} · 역사 사료 재현 (현 위치 주변 대피 경로 미확보)`
          : `${displayOrigin} · 확인된 대피 경로·목적지 미확보`;
      } else {
        const mins = Math.max(1, Math.ceil(activeTotalDist / 72));
        const prefix = isHistRecord ? '사료 재현 · ' : '';
        hl.textContent = `${prefix}${displayOrigin} → ${shelterName} · 도보 ${mins}분 (${Math.round(activeTotalDist)}m)`;
      }
    }
    const dockTarget = this._el('dock-shelter-target');
    if (dockTarget) {
      dockTarget.textContent = isOutside
        ? '영향권 외 · 대피 안내 비활성'
        : (shelterName || '확인된 대피 후보 없음');
    }

    const tagEl = this._el('quake-provenance-tag');
    if (tagEl) tagEl.textContent = this.activeSeismicCtx.provenanceBadge || '지진 정보';
    const origEl = this._el('quake-origin-line');
    if (origEl) {
      const anchorWord = this.originMarkerMode === 'USER_GPS' ? '내 위치(GPS)' : '현 지점';
      const titleKo = this.activeSeismicCtx.titleKo || '지진 정보';
      const magSum = this.activeSeismicCtx.magSummary || '';
      const titleWithMag = magSum && !titleKo.includes(magSum) ? `${titleKo} ${magSum}` : titleKo;
      origEl.textContent = `${titleWithMag} · ${anchorWord} 기준 ${this.activeSeismicCtx.compassDirKo} ${this.activeSeismicCtx.distanceKm ?? '--'}km`;
    }
    const impEl = this._el('quake-impact-line');
    if (impEl) {
      const op = this.activeSeismicCtx.officialProducts;
      const smText = Number.isFinite(op?.shakemap?.maxMmi) ? `ShakeMap MMI ${op.shakemap.maxMmi}` : 'ShakeMap 미제공';
      const oafText = op?.oaf ? ' · OAF 여진 통계 존재(현재 PGA 아님)' : '';
      const stationMissing = !this.uiAdapter?.context?.sources?.station;
      const stationCaveat = stationMissing ? ' · 관측소 실측 파형 미수신' : '';
      const baseNote = this.activeImpactEval?.explanationKo || (g?.canMove ? '후보 도보 동선 산출(사전 계산 · 현장 안전 미보증)' : '이동 보류 · 주변 위험 우선 확인');
      impEl.textContent = `${baseNote} · 이론 P파 ${this.activeSeismicCtx.pWaveEtaSec ?? '--'}s / S파 ${this.activeSeismicCtx.sWaveEtaSec ?? '--'}s · ${smText}${oafText}${stationCaveat}`;
    }
    this._updateModeAndHandoffUi();
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
      themeBtn.textContent = isDay ? '야간' : '주간';
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

    const shortest = this.activeFacilityPkg?.routeBaselines?.PATH_SHORTEST_RAPID;
    const stepFree = this.activeFacilityPkg?.routeBaselines?.PATH_STEP_FREE_DETOUR;
    const stairDist = shortest?.totalStairsDistanceMeters || 0;
    const hasStairFreeAlt = Boolean(stairDist > 0 && stepFree && Number.isFinite(stepFree.targetLengthMeters));
    if (!hasStairFreeAlt && this.uiAdapter.preferredRouteMode === 'STEP_FREE') {
      this.uiAdapter.setPreferredRouteMode('ALL');
    }

    const mode = this.uiAdapter.preferredRouteMode;
    const shortBtn = this._el('btn-route-shortest');
    const stepBtn = this._el('btn-route-stepfree');
    const altBtn = this._el('btn-route-alt');
    if (shortBtn) shortBtn.classList.toggle('active', (mode === 'ALL' || mode === 'SHORTEST') && this.activeAltRouteIndex === 0);
    if (stepBtn) {
      stepBtn.style.display = hasStairFreeAlt ? 'inline-flex' : 'none';
      const diffM = hasStairFreeAlt ? Math.round((stepFree.targetLengthMeters || 0) - (shortest?.targetLengthMeters || 0)) : 0;
      stepBtn.textContent = diffM > 0 ? `계단회피 +${diffM}m` : '계단회피';
      stepBtn.classList.toggle('active', mode === 'STEP_FREE');
    }

    const hasDistinctAlt = Array.isArray(this.alternativeRoutes) && this.alternativeRoutes.length > 1;
    if (altBtn) {
      altBtn.style.display = hasDistinctAlt ? 'inline-flex' : 'none';
      if (hasDistinctAlt) {
        const altRoute = this.alternativeRoutes[1];
        const diffA = Math.round((altRoute?.totalDistanceMeters || 0) - (shortest?.targetLengthMeters || 0));
        altBtn.textContent = this.activeAltRouteIndex > 0
          ? `우회중 (${altRoute.totalDistanceMeters}m)`
          : (diffA > 0 ? `우회 +${diffA}m` : '우회');
      }
    }

    const themeBtn = this._el('btn-theme-toggle');
    if (themeBtn) {
      themeBtn.textContent = this.activeVisualTheme === 'ARCHITECTURAL_DAY' ? '야간' : '주간';
    }

    const deltaEl = this._el('route-delta-note');
    const activeAudit = shortest?.routeAudit || this.activeSpatialPkg?.sheltersAndFacilities?.[this.selectedCandidateIndex]?.dimensions?.routeAudit || null;
    if (deltaEl) {
      if (!this.activeFacilityPkg) {
        deltaEl.textContent = '';
      } else if (mode === 'STEP_FREE' && hasStairFreeAlt) {
        deltaEl.textContent = `계단 ${Math.round(stairDist)}m 회피 중`;
      } else if (this.activeAltRouteIndex > 0) {
        deltaEl.textContent = '우회 대안 경로 활성';
      } else if (activeAudit) {
        const debrisPct = Math.round((activeAudit.meanDebrisRisk || 0) * 100);
        const brTxt = activeAudit.bridgeCount > 0 ? `교량 ${activeAudit.bridgeCount}회` : '교량 0회';
        const naiveDelta = (shortest?.naiveShortestMeters && shortest.targetLengthMeters - shortest.naiveShortestMeters >= 8)
          ? ` · 위험우회 +${Math.round(shortest.targetLengthMeters - shortest.naiveShortestMeters)}m`
          : '';
        deltaEl.textContent = `낙하위험 ${debrisPct}% · ${brTxt}${naiveDelta}`;
      } else if (hasStairFreeAlt) {
        deltaEl.textContent = `계단 ${Math.round(stairDist)}m 포함`;
      } else {
        deltaEl.textContent = '평탄 보행 · 계단 없음';
      }
    }

    const auditLine = this._el('mcda-routing-audit-line');
    if (auditLine) {
      const selCand = this.activeSpatialPkg?.sheltersAndFacilities?.[this.selectedCandidateIndex];
      const clr = selCand?.dimensions?.clearanceRadiusMeters;
      if (activeAudit) {
        const debrisPct = Math.round((activeAudit.meanDebrisRisk || 0) * 100);
        const canyonStr = activeAudit.canyonMeters > 0 ? `협소협곡(H/W) ${Math.round(activeAudit.canyonMeters)}m` : '양측협곡 위험 없음';
        const bypassNote = (shortest?.naiveShortestMeters && shortest.targetLengthMeters - shortest.naiveShortestMeters >= 8)
          ? ` · 단순최단(${Math.round(shortest.naiveShortestMeters)}m) 대비 낙하·교량 리스크 회피`
          : '';
        auditLine.textContent =
          `선정 근거(MCDA): 실보행 ${Math.round(activeAudit.physicalDistanceMeters)}m (위험등가 ${Math.round(activeAudit.effectiveRiskCostMeters)}m) · ` +
          `외벽붕괴위험 ${debrisPct}% · ${canyonStr} · 교량 ${activeAudit.bridgeCount || 0}회 · 평균 가로폭 ${activeAudit.meanCorridorWidthM}m` +
          `${Number.isFinite(clr) ? ` · 목적지 이격 ${clr}m` : ''}${bypassNote}`;
      } else if (this.activeFacilityPkg) {
        auditLine.textContent = `선정 근거: 실보행 ${Math.round(shortest?.targetLengthMeters || 0)}m · 보행 네트워크 기반 경로 산출`;
      } else {
        auditLine.textContent = '선정 근거: 대피 경로 산출 대기 중';
      }
    }
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
    const pkg = this.activeFacilityPkg;
    const g = this.uiAdapter.lastGuidance;
    const msRow = this._el('milestones-row');

    if (!pkg || !pkg.shelter || this.activeImpactEval?.impactStatus === IMPACT_ZONE_STATUS.OUTSIDE_IMPACT_ZONE) {
      this.activeCheckpoints = [];
      if (msRow) msRow.innerHTML = '';
      this._updateSafetyRuleForProgress();
      return;
    }

    const isStepFree = Boolean(g?.replanStatus?.isStepFree || this.uiAdapter.preferredRouteMode === 'STEP_FREE');
    const shortestLen = pkg.routeBaselines?.PATH_SHORTEST_RAPID?.targetLengthMeters || g?.replanStatus?.totalDistanceMeters || 0;
    const stepFreeLen = pkg.routeBaselines?.PATH_STEP_FREE_DETOUR?.targetLengthMeters || shortestLen;
    const isHanyangNative = Boolean(this.activeSpatialPkg?.isHanyangNative);
    const hasIndoorData = Boolean(isHanyangNative && this.activeFacilityId === 'BLDG_212_ENG1');

    const unitNum = pkg.buildingMetadata?.unitNumber;
    const facLabel = unitNum ? `${unitNum}동` : (pkg.buildingMetadata?.name || this.activeRegionInfo?.shortName || '출발 위치');
    this.activeCheckpoints = buildEvacuationSafetyCheckpoints({
      facilityName: facLabel,
      regionLabel: this.activeRegionInfo?.shortName || this.activeRegionInfo?.name || facLabel,
      floor: hasIndoorData ? (this.uiAdapter.context?.user?.floor ?? (pkg.defaultFloor ?? 3)) : 1,
      room: hasIndoorData ? ((this.uiAdapter.context?.user?.room || '1F').replace('ROOM_', '') + '호') : '',
      shelterName: pkg.shelter?.officialName || pkg.shelter?.name || '개활 대피 후보',
      shortestMeters: shortestLen,
      stepFreeMeters: stepFreeLen,
      isStepFree,
      isCampusRegion: isHanyangNative,
      hasIndoorData,
      hasObstacles: Boolean(this.hazardPolyActive || g?.replanStatus?.isReplanned)
    });

    if (msRow) {
      msRow.innerHTML = this.activeCheckpoints.map((cp, idx) => `
        <button type="button" class="milestone-btn" data-cp-idx="${idx}" data-cp-t="${cp.tAnchor}">
          <span class="m-dot"></span>
          <span>${escapeHtml(cp.stepNo)} ${escapeHtml(cp.shortLabel)}</span>
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
    const gateOpen = Boolean(this._el('entry-mode-gate')?.classList.contains('is-visible'));
    const hideForBrief = this.experiencePhase === EXPERIENCE_PHASES.SEISMIC_BRIEF || gateOpen;
    const isHiddenNow = Boolean(this.safetyPopupDismissed || hideForBrief);
    const wasHidden = popupEl.classList.contains('is-hidden');
    popupEl.classList.toggle('is-hidden', isHiddenNow);

    const g = this.uiAdapter.lastGuidance;
    const impStatus = this.activeImpactEval?.impactStatus;
    const isOutside = impStatus === IMPACT_ZONE_STATUS.OUTSIDE_IMPACT_ZONE;
    const isArrived = !isOutside && Boolean(this.activeFacilityPkg) && (this.experiencePhase === EXPERIENCE_PHASES.SHELTER_ARRIVED || this.routeProgressT >= 0.996);
    if (wasHidden !== isHiddenNow || this._lastPopupArrivedState !== isArrived) {
      this._lastPopupArrivedState = isArrived;
      this._syncResponsiveTopBarOffset();
    }
    popupEl.classList.toggle('is-arrived', isArrived && Boolean(g?.canMove));

    if (isOutside || !this.activeFacilityPkg || (g && (!g.canMove || !g.canNavigate))) {
      const noDest = !this.activeFacilityPkg || g?.decisionMeta?.destinationStatus === CANDIDATE_STATUS.UNAVAILABLE || g?.decisionMeta?.destinationStatus === CANDIDATE_STATUS.UNKNOWN;
      this._el('sr-step-meta').textContent = isOutside
        ? '현 위치 영향권 외 · 이동 불필요'
        : (impStatus === IMPACT_ZONE_STATUS.HISTORICAL_REFERENCE_ONLY && noDest ? '역사 사료 기준 · 공백 구역' : (noDest ? '데이터/후보 미확인 · 임의 경로 없음' : '긴급 대처 · 이동 보류'));
      this._el('sr-headline').textContent = isOutside
        ? '현 위치는 직접 영향 반경 밖입니다'
        : (g?.phaseHeadline || '대피 후보 · 경로 판단 불가 (데이터 부족)');
      this._el('sr-body').textContent = isOutside
        ? (this.activeImpactEval?.explanationKo || g?.primaryAction || '')
        : (noDest ? (this.activeSpatialPkg?.dataLimitations?.[0] || g?.primaryAction || '확인 가능한 보행망/대피소 데이터가 부족하여 임의 경로를 표시하지 않습니다.') : (g?.primaryAction || ''));
      const warnEl = this._el('sr-caution');
      warnEl.textContent = isOutside
        ? (this.activeImpactEval?.limitations || '진앙 부근 지역으로 이동해 대응 상황을 분석할 수 있습니다.')
        : (g?.warnings?.[0] || '공식 대피소 표지 및 건물 외벽 낙하물 안전을 직접 확인하십시오.');
      warnEl.classList.toggle('is-critical', !isOutside && Boolean(g && !g.canMove));
      return;
    }

    if (isArrived) {
      const pkg = this.activeFacilityPkg;
      const shelterName = pkg?.shelter?.officialName || this.activeSpatialPkg?.sheltersAndFacilities?.[0]?.name || '대피 후보';
      const shelterCand = this.activeSpatialPkg?.sheltersAndFacilities?.[this.selectedCandidateIndex] || this.activeSpatialPkg?.sheltersAndFacilities?.[0];
      const just = this.activeShelterJustification || shelterCand?.justification || null;
      const candStatus = shelterCand?.candidateStatus || (this.activeSpatialPkg?.isHanyangNative ? CANDIDATE_STATUS.CONFIRMED : CANDIDATE_STATUS.CONDITIONAL);

      this._el('sr-step-meta').textContent = candStatus === CANDIDATE_STATUS.CONFIRMED
        ? '도착 완료 · 공식 대피소'
        : '도착 완료 · 개활 후보';
      this._el('sr-headline').textContent = `${shelterName} 도달`;
      this._el('sr-body').textContent = candStatus === CANDIDATE_STATUS.CONFIRMED
        ? '보행 이동이 완료되었습니다. 현장 대피소 안내를 따라 주변 건물과 거리를 두고 대기하십시오.'
        : '지정 외 개활 후보지입니다. 출입 가능 여부와 주변 낙하물 안전을 직접 확인하십시오.';
      const warnEl = this._el('sr-caution');
      warnEl.textContent = just?.hazardCaveat || '여진에 대비해 주변 전신주·외벽으로부터 건물 높이 1/2 이상 떨어져 대기하십시오.';
      warnEl.classList.remove('is-critical');

      const metricsEl = this._el('arrival-metrics-strip');
      if (metricsEl) {
        metricsEl.innerHTML = `
          <div class="arrival-metric-item"><span class="am-label">개활 면적</span><strong class="am-val">${just?.areaSqMeters ? just.areaSqMeters.toLocaleString() + '㎡' : '미확인'}</strong></div>
          <div class="arrival-metric-item"><span class="am-label">수용 추정</span><strong class="am-val">${just?.capacityEstimate ? just.capacityEstimate.toLocaleString() + '명' : '미확인'}</strong></div>
          <div class="arrival-metric-item"><span class="am-label">이격 반경</span><strong class="am-val">${just?.clearanceRadiusMeters ? just.clearanceRadiusMeters + 'm' : '미확인'}</strong></div>
          <div class="arrival-metric-item"><span class="am-label">판정 상태</span><strong class="am-val">${escapeHtml(just?.provenanceLabel || candStatus)}</strong></div>
        `;
      }
      const whyEl = this._el('arrival-why-text');
      if (whyEl) {
        whyEl.textContent = just?.selectionReason || '인접 건축물 낙하 반경 밖의 보행 연결 가능 개활 후보입니다.';
      }
      const protoRow = this._el('arrival-protocol-row');
      if (protoRow) {
        protoRow.innerHTML = POST_ARRIVAL_SAFETY_PROTOCOLS.map(p => `
          <button type="button" class="arrival-proto-btn ${this.activeArrivalProtocolId === p.id ? 'active' : ''}" data-proto-id="${escapeHtml(p.id)}">
            <span class="ap-step">${escapeHtml(p.stepNumber)} · ${escapeHtml(p.title)}</span>
            <span class="ap-action">${escapeHtml(p.actionLabel)}</span>
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
      const totalD = g?.replanStatus?.totalDistanceMeters || 0;
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
    if (fb) fb.textContent = `${proto.stepNumber} · ${proto.title} — ${proto.summary}`;

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

  _syncShelterSetbackVisuals() {
    if (!this.shelterSetbackGroup) return;
    const g = this.uiAdapter?.lastGuidance;
    const isOutside = this.activeImpactEval?.impactStatus === IMPACT_ZONE_STATUS.OUTSIDE_IMPACT_ZONE;
    const activePts = this.hanyangAdapter?.getActiveRoutePoints?.() || [];
    if (!this.activeFacilityPkg || isOutside || activePts.length < 2 || (g && !g.canNavigate)) {
      this.shelterSetbackGroup.visible = false;
      return;
    }
    const endPt = activePts[activePts.length - 1];
    const ex = Array.isArray(endPt) ? (endPt[0] || 0) : (endPt?.x || 0);
    const ez = Array.isArray(endPt) ? (endPt[2] || 0) : (endPt?.z || 0);
    const key = `${this.activeSpatialPkg?.metadata?.packageId}:${ex.toFixed(1)}:${ez.toFixed(1)}`;
    if (this._lastSetbackKey !== key) {
      this._lastSetbackKey = key;
      this._drapeSetbackRingMesh(this.setbackInnerRing, ex, ez, 14.0, 15.4, 56);
      this._drapeSetbackRingMesh(this.setbackOuterRing, ex, ez, 24.0, 25.3, 64);
    }
    const isArrived = this.experiencePhase === EXPERIENCE_PHASES.SHELTER_ARRIVED || this.routeProgressT >= 0.996;
    if (this.setbackInnerRing?.material) {
      this.setbackInnerRing.material.opacity = isArrived ? 0.88 : 0.56;
    }
    if (this.setbackOuterRing?.material) {
      this.setbackOuterRing.material.opacity = isArrived ? 0.52 : 0.34;
    }
    this.shelterSetbackGroup.visible = true;
    this.shelterSetbackGroup.position.set(ex, 0, ez);
  }

  _updateSafetyRuleForProgress() {
    const g = this.uiAdapter.lastGuidance;
    const impStatus = this.activeImpactEval?.impactStatus;
    const isOutside = impStatus === IMPACT_ZONE_STATUS.OUTSIDE_IMPACT_ZONE;

    if (!this.activeCheckpoints.length || !this.activeFacilityPkg || isOutside) {
      this._renderSafetyRuleCard(null);
      for (const mesh of this.milestoneMeshes) mesh.visible = false;
      this.shelterSetbackGroup.visible = false;
      return;
    }

    const totalDist = g?.replanStatus?.totalDistanceMeters
      || this.activeFacilityPkg?.routeBaselines?.PATH_SHORTEST_RAPID?.targetLengthMeters
      || 0;
    const prog = evaluatePathProgressState(this.activeCheckpoints, this.routeProgressT, totalDist);
    const cp = prog.activeCheckpoint;

    const remEl = this._el('dock-remaining-dist');
    const etaEl = this._el('dock-walk-eta');
    const scrubber = this._el('route-scrubber');
    if (remEl) remEl.textContent = prog.normalizedT >= 0.996 ? '목적지 도착 완료' : `잔여 ${prog.remainingMeters} m`;
    if (etaEl) etaEl.textContent = prog.normalizedT >= 0.996 ? `총 ${prog.totalMeters} m 이동` : `약 ${prog.remainingMinutes}분 (${prog.totalMeters} m 중)`;
    if (scrubber && !this._isScrubbingRoute) scrubber.value = String(Math.round(prog.normalizedT * 1000));

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

    // Keep terrain-draped shelter safety zone rings visible throughout approach & emphasized on arrival
    this._syncShelterSetbackVisuals();
    this._syncResponsiveTopBarOffset();
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

  setCameraStage(stageKey, opts = {}) {
    this.followCameraEnabled = false;
    this._syncFollowButton();
    this._qAll('#btn-stage-local4km, #btn-stage-campus, #btn-stage-bldg, #btn-stage-earth, #btn-stage-personal')
      .forEach(b => b.classList.remove('active'));

    const applyStagePose = (targetStage) => {
      if (opts.animate && this.camTransition?.viewpoints?.[targetStage] && this.camTransition.currentStage !== CAMERA_STAGES.GLOBAL_ORBIT) {
        this.camTransition.transitionTo(targetStage, opts.durationSec || 0.72, () => {
          if (this.labelContainer) {
            this.localSpatialLayer.updateOverlayLabels(this.camera, this.labelContainer, { force: true });
          }
        });
      } else {
        this.camTransition.snapTo(targetStage);
      }
    };

    if (stageKey === CAMERA_STAGES.GLOBAL_ORBIT) {
      this._el('btn-stage-earth')?.classList.add('active');
      this.camTransition.snapTo(CAMERA_STAGES.GLOBAL_ORBIT);
      this.hanyangAdapter.setRouteDisplay('NONE');
    } else if (stageKey === CAMERA_STAGES.REGIONAL_APPROACH) {
      this._el('btn-stage-local4km')?.classList.add('active');
      applyStagePose(CAMERA_STAGES.REGIONAL_APPROACH);
      this.uiAdapter.sync3DScene();
    } else if (stageKey === CAMERA_STAGES.CAMPUS_OVERVIEW) {
      this._el('btn-stage-campus')?.classList.add('active');
      applyStagePose(CAMERA_STAGES.CAMPUS_OVERVIEW);
      this.uiAdapter.sync3DScene();
    } else if (stageKey === CAMERA_STAGES.BUILDING_INSPECTION) {
      this._el('btn-stage-bldg')?.classList.add('active');
      applyStagePose(CAMERA_STAGES.BUILDING_INSPECTION);
      this.hanyangAdapter.highlightFloor(this.uiAdapter.context?.user?.floor ?? 1);
      this.uiAdapter.sync3DScene();
    } else if (stageKey === CAMERA_STAGES.PERSONAL_LOCATION) {
      this._el('btn-stage-personal')?.classList.add('active');
      applyStagePose(CAMERA_STAGES.PERSONAL_LOCATION);
      this.hanyangAdapter.highlightFloor(this.uiAdapter.context?.user?.floor ?? 1);
      this.uiAdapter.sync3DScene();
    } else {
      stageKey = CAMERA_STAGES.CAMPUS_OVERVIEW;
      this._el('btn-stage-campus')?.classList.add('active');
      applyStagePose(CAMERA_STAGES.CAMPUS_OVERVIEW);
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
    const pkg = this.activeFacilityPkg;
    const hasIndoorData = Boolean(this.activeSpatialPkg?.isHanyangNative && this.activeFacilityId === 'BLDG_212_ENG1');
    if (tSec === 0) {
      this.setCameraStage(hasIndoorData ? CAMERA_STAGES.PERSONAL_LOCATION : CAMERA_STAGES.CAMPUS_OVERVIEW);
      this.uiAdapter.resetRouteObstacles();
      this.uiAdapter.setAftershock(false);
      this.uiAdapter.setUserLocation({
        locationType: hasIndoorData ? 'INDOOR' : 'OUTDOOR',
        buildingId: this.activeFacilityId,
        floor: hasIndoorData ? (pkg?.defaultFloor ?? 3) : 1,
        room: hasIndoorData ? (pkg?.defaultRoomId || 'ROOM_301') : null,
        certainty: LOCATION_CERTAINTY.MANUAL_EXACT
      });
      this.uiAdapter.updateStationMotion(0.22, Date.now(), DATA_PROVENANCE_SOURCE.SIMULATED_SCENARIO);
    } else if (tSec === 40) {
      this.setCameraStage(CAMERA_STAGES.BUILDING_INSPECTION);
      this.uiAdapter.resetRouteObstacles();
      this.uiAdapter.setAftershock(false);
      this.uiAdapter.setUserFloor(hasIndoorData ? (pkg?.defaultFloor ?? 3) : 1);
      this.uiAdapter.updateStationMotion(0.01, Date.now(), DATA_PROVENANCE_SOURCE.SIMULATED_SCENARIO);
    } else if (tSec === 67) {
      this.setCameraStage(CAMERA_STAGES.CAMPUS_OVERVIEW);
      this.uiAdapter.setAftershock(false);
      this.uiAdapter.updateStationMotion(0.01, Date.now(), DATA_PROVENANCE_SOURCE.SIMULATED_SCENARIO);
      const firstOutdoorEdge = pkg?.outdoorGraph?.edges?.[0];
      const obstacleEdgeId = hasIndoorData
        ? 'NODE_STAIR1_TOP->NODE_STAIR1_BOT'
        : (firstOutdoorEdge ? `${firstOutdoorEdge.source}->${firstOutdoorEdge.target}` : null);
      if (obstacleEdgeId) {
        this.uiAdapter.reportLinkObstacle(obstacleEdgeId, LINK_STATE.SUSPECTED, {
          source: DATA_PROVENANCE_SOURCE.USER_FIELD_REPORT,
          detail: hasIndoorData ? '1층 연결 계단 균열 및 파편 목격 제보' : '보행 경로 구간 낙하물·장애 제보'
        });
      }
      this.uiAdapter.reassess();
    } else if (tSec === 110) {
      this.setCameraStage(hasIndoorData ? CAMERA_STAGES.PERSONAL_LOCATION : CAMERA_STAGES.CAMPUS_OVERVIEW);
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
        name: '노천극장·외벽 낙하물 주의 구역 (현장 미검증 추정치)',
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

  _syncResponsiveTopBarOffset() {
    if (typeof window === 'undefined') return;
    const bar = this._el('exhibition-bar');
    const hdr = this._el('evac-header-overlay');
    const stack = this._el('bottom-stage-stack');
    const mapCtrl = this._el('map-controls');
    if (!bar || !hdr) return;

    const isMobileLandscape = window.innerWidth > window.innerHeight && window.innerHeight <= 520;
    bar.style.top = '';

    if (this.localWorldGroup?.visible && this.camera?.isPerspectiveCamera) {
      const isPortraitPhone = window.innerWidth <= 640 && window.innerHeight > window.innerWidth;
      const targetFov = isPortraitPhone ? 56 : 45;
      if (Math.abs(this.camera.fov - targetFov) > 0.5) {
        this.camera.fov = targetFov;
        this.camera.updateProjectionMatrix();
      }
    }

    if (mapCtrl && stack) {
      if (window.innerWidth <= 640 && !isMobileLandscape) {
        const stackRect = stack.getBoundingClientRect();
        if (stackRect.height > 30) {
          const safeOffset = Math.max(96, Math.round(stackRect.height + 16));
          mapCtrl.style.setProperty('bottom', `calc(${safeOffset}px + env(safe-area-inset-bottom, 0px))`, 'important');
        }
      } else {
        mapCtrl.style.removeProperty('bottom');
      }
    }
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
      if (auditOverall) {
        const overallLabel = fc.overallStatus === 'VERIFIED' ? '현장 확인 완료' : fc.overallStatus === 'PARTIALLY_VERIFIED' ? '일부 확인' : '현장 확인 전';
        auditOverall.textContent = `${overallLabel} (${fc.verifiedCount}/${fc.totalCount})`;
      }
      if (auditList) {
        auditList.innerHTML = fc.items.map(it =>
          `<div style="display:flex; justify-content:space-between; gap:8px;">
            <span><strong>${escapeHtml(it.code)}</strong> ${escapeHtml(it.title)}</span>
            <span style="color:${it.verified ? '#38bdf8' : '#94a3b8'}; white-space:nowrap;">${escapeHtml(it.status)}</span>
          </div>`
        ).join('');
      }
    }
    this._syncUtilityButtons();
    this._syncResponsiveTopBarOffset();
  }

  _bindDomEvents() {
    // Persistent Top-Left Mini-Globe Return (피드백 2)
    this._el('btn-evac-back-globe')?.addEventListener('click', () => {
      if (this.onReturnToGlobe) this.onReturnToGlobe();
      else if (typeof window !== 'undefined') window.location.href = './index.html';
    });

    // Entry Mode Gate controls (#entry-mode-gate)
    this._el('btn-gate-my-location')?.addEventListener('click', () => {
      this._handleGateMyLocation();
    });
    this._el('btn-gate-free-mode')?.addEventListener('click', () => {
      this.session?.setEntryMode(EXPERIENCE_ENTRY_MODES.FREE_MODE);
      this._hideEntryModeGate();
      this._setRegionPopoverOpen(true);
      this._updateModeAndHandoffUi();
    });
    this._qAll('.emg-quick-chip').forEach(btn => {
      btn.addEventListener('click', () => {
        const lat = Number(btn.dataset.lat);
        const lon = Number(btn.dataset.lon);
        const regId = btn.dataset.gateRegion || 'custom_free';
        const name = btn.dataset.name || btn.dataset.short || '선택 지역';
        const shortName = btn.dataset.short || name;
        this._hideEntryModeGate();
        this.session?.setFreeModeLocation(lat, lon, name, 'PRESET_REGION');
        this.switchToRegion(lat, lon, {
          regionId: regId,
          locationSource: 'FREE_MODE',
          name,
          shortName
        });
      });
    });

    // Unified Detail Panel Handoff & Context Actions
    this._el('btn-handoff-epicenter')?.addEventListener('click', () => {
      const handed = this.session?.handedGlobeEvent;
      if (!handed || !Number.isFinite(handed.epicenterLat) || !Number.isFinite(handed.epicenterLon)) return;
      this._setDetailOpen(false);
      this.switchToRegion(handed.epicenterLat, handed.epicenterLon, {
        regionId: `EPI_${handed.eventId || 'GLOBE'}`,
        locationSource: 'FREE_MODE',
        name: `${handed.placeName || handed.title || '진앙'} 주변 공간`,
        shortName: '진앙 주변',
        handedEvent: handed
      });
    });
    this._el('btn-handoff-my-location')?.addEventListener('click', () => {
      this._setDetailOpen(false);
      this._handleGateMyLocation();
    });
    this._el('btn-handoff-pick-region')?.addEventListener('click', () => {
      this._setDetailOpen(false);
      this._hideEntryModeGate();
      this._setRegionPopoverOpen(true);
    });
    this._el('btn-handoff-nearest-urban')?.addEventListener('click', () => {
      const btn = this._el('btn-handoff-nearest-urban');
      if (!btn?.dataset.lat) return;
      this._setDetailOpen(false);
      this.switchToRegion(Number(btn.dataset.lat), Number(btn.dataset.lon), {
        regionId: btn.dataset.regionId || 'urban_fallback',
        locationSource: 'FREE_MODE',
        name: btn.dataset.name,
        shortName: btn.dataset.shortName
      });
    });
    this._el('btn-erc-nearest-urban')?.addEventListener('click', () => {
      const btn = this._el('btn-erc-nearest-urban');
      if (!btn?.dataset.lat) return;
      this.switchToRegion(Number(btn.dataset.lat), Number(btn.dataset.lon), {
        regionId: btn.dataset.regionId || 'urban_fallback',
        locationSource: 'FREE_MODE',
        name: btn.dataset.name,
        shortName: btn.dataset.shortName
      });
    });
    this._el('btn-erc-gps')?.addEventListener('click', () => {
      this._handleGateMyLocation();
    });
    this._el('btn-erc-pick-region')?.addEventListener('click', () => {
      this._hideEntryModeGate();
      this._setRegionPopoverOpen(true);
    });

    // Nationwide Korea Region Switcher Popover (피드백 6)
    const regBtn = this._el('btn-region-switcher');
    const regPopover = this._el('region-search-popover');
    regBtn?.addEventListener('click', e => {
      e.stopPropagation();
      const willOpen = !regPopover?.classList.contains('open');
      this._setRegionPopoverOpen(willOpen);
    });
    this._el('korea-region-search-form')?.addEventListener('submit', e => {
      e.preventDefault();
      const val = this._el('korea-region-search-input')?.value || '';
      if (val.trim()) this._handleRegionSearchSubmit(val);
    });

    // Location GPS + Custom Earthquake Scenario Controls
    this._el('btn-locate-me')?.addEventListener('click', async () => {
      const btn = this._el('btn-locate-me');
      if (btn) btn.textContent = '위치 확인 중...';
      const pos = await this.locationProvider.detectBrowserLocation();
      this.session?.setGpsLocationResult(pos);
      if (btn) btn.textContent = '현위치(GPS)';
      if (pos.ok) {
        this._setRegionPopoverOpen(false);
        this._hideEntryModeGate();
        await this.switchToRegion(pos.lat, pos.lon, {
          regionId: 'USER_GPS_CURRENT',
          locationSource: 'GPS',
          name: `내 현재 위치 (${pos.lat.toFixed(4)}°N, ${pos.lon.toFixed(4)}°E)`,
          shortName: '내 현재 위치(GPS)',
          gpsAccuracyMeters: pos.accuracyMeters ?? null
        });
      } else {
        const resEl = this._el('region-search-results');
        if (resEl) {
          resEl.innerHTML = `<div style="font-size:10.5px; color:#fb7185; padding:4px 2px;">${escapeHtml(pos.error || '위치 권한을 확인할 수 없어 자유 모드 검색으로 전환합니다.')}</div>`;
        }
      }
    });

    this._el('btn-snap-local-quake')?.addEventListener('click', () => {
      const anchor = this.activeSpatialPkg?.metadata?.anchor || {
        lat: this.activeRegionInfo?.lat ?? 37.555815,
        lon: this.activeRegionInfo?.lon ?? 127.045053
      };
      this.applyScenarioSpec({
        id: 'SYNTH-LOCAL-SNAP',
        scenarioType: SCENARIO_TYPES.EDUCATIONAL_SYNTHETIC,
        title: `${this.activeRegionInfo?.shortName || '현위치'} 근거리 가상 지진 (교육용)`,
        epicenterLat: Number((anchor.lat + 0.032).toFixed(4)),
        epicenterLon: Number((anchor.lon + 0.045).toFixed(4)),
        magnitude: Number(this._el('custom-mag')?.value || 5.2),
        depthKm: Number(this._el('custom-depth')?.value || 10),
        originText: '분석 지점 북동측 약 5.4km 인근 가상 진앙'
      }, { skipBrief: false });
    });

    this._el('btn-apply-custom-quake')?.addEventListener('click', () => {
      const anchor = this.activeSpatialPkg?.metadata?.anchor || { lat: 37.555815, lon: 127.045053 };
      const latVal = parseFloat(this._el('custom-epi-lat')?.value || '');
      const lonVal = parseFloat(this._el('custom-epi-lon')?.value || '');
      const magVal = parseFloat(this._el('custom-mag')?.value || '5.2');
      const depthVal = parseFloat(this._el('custom-depth')?.value || '10');
      const epiLat = Number.isFinite(latVal) && latVal >= -90 && latVal <= 90 ? latVal : anchor.lat + 0.032;
      const epiLon = Number.isFinite(lonVal) && lonVal >= -180 && lonVal <= 180 ? lonVal : anchor.lon + 0.045;
      const mag = Number.isFinite(magVal) ? Math.max(1.0, Math.min(9.5, magVal)) : 5.2;
      const depthKm = Number.isFinite(depthVal) ? Math.max(0, Math.min(700, depthVal)) : 10;

      this._setRegionPopoverOpen(false);
      this.applyScenarioSpec({
        id: 'SYNTH-CUSTOM-USER',
        scenarioType: SCENARIO_TYPES.EDUCATIONAL_SYNTHETIC,
        title: `사용자 설정 가상 지진 M${mag.toFixed(1)} (교육용 합성)`,
        epicenterLat: epiLat,
        epicenterLon: epiLon,
        magnitude: mag,
        depthKm,
        originText: `지정 진앙 (${epiLat.toFixed(4)}°N, ${epiLon.toFixed(4)}°E)`
      }, { skipBrief: false });
    });

    this._el('btn-route-alt')?.addEventListener('click', () => {
      if (!this.alternativeRoutes || this.alternativeRoutes.length <= 1) return;
      this.activeAltRouteIndex = (this.activeAltRouteIndex + 1) % this.alternativeRoutes.length;
      const alt = this.alternativeRoutes[this.activeAltRouteIndex];
      const altBtn = this._el('btn-route-alt');
      if (altBtn) {
        altBtn.classList.toggle('active', this.activeAltRouteIndex > 0);
        altBtn.textContent = this.activeAltRouteIndex > 0 ? `대체 경로 #${this.activeAltRouteIndex + 1} (${alt.totalDistanceMeters}m)` : '대체 경로';
      }
      if (alt && Array.isArray(alt.waypoints3D) && alt.waypoints3D.length >= 2) {
        this.hanyangAdapter.routePolylines.SHORTEST = alt.waypoints3D;
        this.uiAdapter.setPreferredRouteMode('SHORTEST');
        this.routeProgressT = 0.02;
        this._updateSafetyRuleForProgress();
        this.renderUI();
      }
    });

    // Seismic Brief Start
    this._el('btn-sb-start-evac')?.addEventListener('click', () => this.beginActiveEvacuation());
    this._el('btn-replay-seismic-brief')?.addEventListener('click', () => this.enterWithSeismicBrief({ durationMs: 2400 }));

    // Top-Right Navigation & Lab
    this._el('btn-stage-earth')?.addEventListener('click', () => {
      if (this.onReturnToGlobe) this.onReturnToGlobe();
      else this.setCameraStage(CAMERA_STAGES.GLOBAL_ORBIT);
    });
    this._el('btn-replay-wave')?.addEventListener('click', () => {
      this.localSpatialLayer.replaySeismicWavefront?.();
      this._setDetailOpen(false);
    });
    this._el('btn-toggle-context-details')?.addEventListener('click', () => {
      const isOpen = Boolean(this._el('evac-header-overlay')?.classList.contains('is-detail-open'));
      this._setDetailOpen(!isOpen);
    });

    this._el('btn-stage-local4km')?.addEventListener('click', () => this.setCameraStage(CAMERA_STAGES.REGIONAL_APPROACH, { animate: true }));
    this._el('btn-stage-campus')?.addEventListener('click', () => this.setCameraStage(CAMERA_STAGES.CAMPUS_OVERVIEW, { animate: true }));
    this._el('btn-stage-bldg')?.addEventListener('click', () => this.setCameraStage(CAMERA_STAGES.BUILDING_INSPECTION, { animate: true }));
    this._el('btn-stage-personal')?.addEventListener('click', () => this.setCameraStage(CAMERA_STAGES.PERSONAL_LOCATION, { animate: true }));

    this._el('btn-route-shortest')?.addEventListener('click', () => {
      this.activeAltRouteIndex = 0;
      if (this.alternativeRoutes?.[0]?.waypoints3D?.length >= 2) {
        this.hanyangAdapter.routePolylines.SHORTEST = this.alternativeRoutes[0].waypoints3D;
      }
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

    const p31Authority = this.activeSpatialPkg?.isHanyangNative
      ? '성동소방서·한양대 합동 점검반 (리허설)'
      : '관할 재난안전 합동 점검반 (리허설)';
    const p31MsgEl = this._el('p31-audit-message');
    this._el('btn-p31-drill-approve')?.addEventListener('click', () => {
      const res = this.uiAdapter.ingestFieldSurveyPacket(buildSimulatedDrillSurveyPacket('COMPLIANT', this.activeFacilityId), {
        approve: true,
        approvalMetadata: {
          approvedByAuthority: p31Authority,
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
          approvedByAuthority: p31Authority,
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

    // Route Player, Pause/Resume Toggle & Replay (피드백 4 non-looping)
    this._el('btn-walk-play')?.addEventListener('click', () => {
      if (!this.activeFacilityPkg || this.activeImpactEval?.impactStatus === IMPACT_ZONE_STATUS.OUTSIDE_IMPACT_ZONE) return;
      if (this.briefTimerId) {
        clearTimeout(this.briefTimerId);
        this.briefTimerId = null;
      }
      this._isScrubbingRoute = false;
      this._el('seismic-brief-banner')?.classList.remove('is-active');
      if (this.routeProgressT >= 0.996) {
        this.routeProgressT = 0.0;
        this.experiencePhase = EXPERIENCE_PHASES.EVACUATION_ACTIVE;
        this._syncShelterSetbackVisuals();
        this.walkPlaying = true;
      } else {
        const nextPlaying = !this.walkPlaying;
        this.walkPlaying = nextPlaying;
        if (nextPlaying) {
          this.experiencePhase = EXPERIENCE_PHASES.EVACUATION_ACTIVE;
          this._syncShelterSetbackVisuals();
        }
      }
      this._syncPlayButton();
      this._updateSafetyRuleForProgress();
      this._syncResponsiveTopBarOffset();
    });
    this._el('btn-replay-route')?.addEventListener('click', () => {
      if (!this.activeFacilityPkg) return;
      this.routeProgressT = 0.0;
      this.experiencePhase = EXPERIENCE_PHASES.EVACUATION_ACTIVE;
      this._syncShelterSetbackVisuals();
      this.walkPlaying = true;
      this._syncPlayButton();
      this._updateSafetyRuleForProgress();
    });
    this._el('btn-follow-cam')?.addEventListener('click', () => {
      this.followCameraEnabled = !this.followCameraEnabled;
      if (this.followCameraEnabled) {
        this.camTransition?.cancelTransition?.('FOLLOW_CAM');
        if (this.camTransition?.currentStage === CAMERA_STAGES.GLOBAL_ORBIT && this.localWorldGroup?.visible) {
          this.camTransition.currentStage = CAMERA_STAGES.CAMPUS_OVERVIEW;
        }
        if ((!this.walkPlaying || this.routeProgressT >= 0.996) && this.activeFacilityPkg) {
          this.beginActiveEvacuation();
        }
      }
      this._syncFollowButton();
    });

    // Fix BUG 1 Part 2: Route scrubber lock + clean pause/seek across dragging & edge jumps
    const routeScrubber = this._el('route-scrubber');
    if (routeScrubber) {
      const startRouteScrub = () => {
        this._isScrubbingRoute = true;
        this.walkPlaying = false;
        if (this.briefTimerId) {
          clearTimeout(this.briefTimerId);
          this.briefTimerId = null;
        }
        this._el('seismic-brief-banner')?.classList.remove('is-active');
        this._syncPlayButton();
      };
      const applyRouteScrub = e => {
        if (!this.activeFacilityPkg) return;
        const raw = Number(e?.target?.value ?? routeScrubber.value);
        if (!Number.isFinite(raw)) return;
        this.walkPlaying = false;
        if (this.briefTimerId) {
          clearTimeout(this.briefTimerId);
          this.briefTimerId = null;
        }
        this._el('seismic-brief-banner')?.classList.remove('is-active');
        this._syncPlayButton();
        this.setRouteProgress(raw / 1000, this.followCameraEnabled);
      };
      const endRouteScrub = () => {
        this._isScrubbingRoute = false;
      };
      routeScrubber.addEventListener('pointerdown', startRouteScrub);
      routeScrubber.addEventListener('mousedown', startRouteScrub);
      routeScrubber.addEventListener('touchstart', startRouteScrub, { passive: true });
      routeScrubber.addEventListener('input', applyRouteScrub);
      routeScrubber.addEventListener('change', e => {
        applyRouteScrub(e);
        endRouteScrub();
      });
      routeScrubber.addEventListener('pointerup', endRouteScrub);
      routeScrubber.addEventListener('pointercancel', endRouteScrub);
      routeScrubber.addEventListener('touchend', endRouteScrub, { passive: true });
      routeScrubber.addEventListener('touchcancel', endRouteScrub, { passive: true });
      routeScrubber.addEventListener('blur', endRouteScrub);
      this._onWindowRouteScrubEnd = () => {
        endRouteScrub();
      };
      this._onWindowResizeSync = () => this._syncResponsiveTopBarOffset();
      if (typeof window !== 'undefined') {
        window.addEventListener('pointerup', this._onWindowRouteScrubEnd);
        window.addEventListener('touchend', this._onWindowRouteScrubEnd, { passive: true });
        window.addEventListener('resize', this._onWindowResizeSync);
      }
    }

    this._onDocumentPointerDownOutsidePopover = e => {
      const pop = this._el('region-search-popover');
      if (pop?.classList.contains('open')) {
        if (!e.target?.closest?.('#region-search-popover, #btn-region-switcher, #btn-erc-pick-region, #btn-gate-free-mode')) {
          this._setRegionPopoverOpen(false);
        }
      }
      const hdr = this._el('evac-header-overlay');
      if (hdr?.classList.contains('is-detail-open')) {
        if (!e.target?.closest?.('#evac-detail-panel, #btn-toggle-context-details')) {
          this._setDetailOpen(false);
        }
      }
    };
    if (typeof document !== 'undefined') {
      document.addEventListener('pointerdown', this._onDocumentPointerDownOutsidePopover);
    }

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
    const activeTouchPointers = new Set();
    let multiTouchActive = false;

    this._onPointerDown = e => {
      if (e.pointerType === 'touch') {
        activeTouchPointers.add(e.pointerId);
        if (activeTouchPointers.size > 1) multiTouchActive = true;
      }
      if (e.isPrimary === false) return;
      this._pointerDownPos.x = e.clientX;
      this._pointerDownPos.y = e.clientY;
    };

    this._onPointerMove = e => {
      if (e.pointerType === 'touch') return; // Skip expensive hover raycast during touch drag/pinch on mobile
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
      if (e.pointerType === 'touch') {
        activeTouchPointers.delete(e.pointerId);
        if (activeTouchPointers.size === 0 && multiTouchActive) {
          multiTouchActive = false;
          return; // Pinch gesture just ended — never interpret as building click
        }
      }
      if (e.isPrimary === false) return;
      if (e.target && e.target !== this.domElement) return;
      if (!this.localWorldGroup.visible || !this.camera || !this.activeSpatialPkg?.metadata?.anchor) return;
      const moveDist = Math.hypot(e.clientX - this._pointerDownPos.x, e.clientY - this._pointerDownPos.y);
      if (moveDist > 7) return; // Ignore orbit camera drags

      const rect = this.domElement.getBoundingClientRect();
      this._pointerNDC.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      this._pointerNDC.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      this._raycaster.setFromCamera(this._pointerNDC, this.camera);

      const picked = this.localSpatialLayer.pickBuildingOBBAtRaycast(this._raycaster);
      if (!picked) return;
      const prevMeta = this.activeFacilityPkg?.dynamicOriginMeta;
      const sameSpot = prevMeta && Math.hypot((picked.east_m ?? 0) - (prevMeta.east_m ?? 0), (picked.north_m ?? 0) - (prevMeta.north_m ?? 0)) < 1.5;
      if (picked.buildingId === this.activeFacilityId && sameSpot && this.walkPlaying) return;

      // Smart Match pilot indoor facility packages ONLY in devMode; standard clicks route dynamically via MCDA
      if (this.activeSpatialPkg.isHanyangNative && this.devMode) {
        if (picked.buildingId === 'BLDG_212_ENG1' || picked.name.includes('제1공학관')) {
          this.switchFacilityPackage('BLDG_212_ENG1', { snapStage: false, autoPlay: true });
          return;
        }
        if (picked.buildingId === 'CTX_HIT' || picked.name.includes('HIT')) {
          this.switchFacilityPackage('BLDG_701_HIT', { snapStage: false, autoPlay: true });
          return;
        }
        if (picked.buildingId === 'CTX_PAIKNAM' || picked.name.includes('백남')) {
          this.switchFacilityPackage('BLDG_104_PAIKNAM', { snapStage: false, autoPlay: true });
          return;
        }
      }

      this.originMarkerMode = 'PICKED_BUILDING';
      this.selectShortestOriginAndBuildFacility({
        id: picked.buildingId,
        name: picked.name,
        east_m: picked.east_m,
        north_m: picked.north_m,
        width_m: picked.width_m,
        depth_m: picked.depth_m,
        yaw_rad: picked.yaw_rad,
        height_m: picked.height_m,
        hasIndoorData: false
      }, { snapStage: false, autoPlay: true, markerMode: 'PICKED_BUILDING' });
      this._updateModeAndHandoffUi();
    };

    this.domElement.addEventListener('pointerdown', this._onPointerDown);
    this.domElement.addEventListener('pointermove', this._onPointerMove);
    this.domElement.addEventListener('pointerup', this._onPointerUp);
  }

  _areRoutesIdentical3D(a, b) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      const p = a[i];
      const q = b[i];
      if (!p || !q || Math.abs(p[0] - q[0]) > 0.05 || Math.abs(p[1] - q[1]) > 0.05 || Math.abs(p[2] - q[2]) > 0.05) {
        return false;
      }
    }
    return true;
  }

  /**
   * Frame tick driven cleanly either by viewer_p2_6.html or ExhibitionModeManager.
   */
  update(dt = 0.016, elapsed = 0) {
    const isTransitioning = this.camTransition.update();
    if (!isTransitioning && !this.followCameraEnabled && this.controls) {
      this.controls.update();
    }

    if (!this._compassNeedleEl) this._compassNeedleEl = this._el('compass-needle');
    const needle = this._compassNeedleEl;
    if (needle && this.controls && this.camera) {
      const angleDeg = -Math.atan2(
        this.camera.position.x - this.controls.target.x,
        this.camera.position.z - this.controls.target.z
      ) * 180 / Math.PI;
      if (this._lastNeedleDeg === undefined || Math.abs(angleDeg - this._lastNeedleDeg) > 0.05) {
        this._lastNeedleDeg = angleDeg;
        needle.style.transform = `rotate(${angleDeg.toFixed(1)}deg)`;
      }
    }

    this.localSpatialLayer.updateAtmosphericPulse(elapsed);
    this.hanyangAdapter.setRouteProgress?.(this.routeProgressT);
    this.hanyangAdapter.update?.(elapsed);

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
      const activeAlt = this.activeAltRouteIndex > 0 ? this.alternativeRoutes?.[this.activeAltRouteIndex] : null;
      const totalD = activeAlt?.totalDistanceMeters
        || guidance.replanStatus?.totalDistanceMeters
        || this.activeFacilityPkg?.routeBaselines?.PATH_SHORTEST_RAPID?.targetLengthMeters
        || 0;

      if (this.walkPlaying && !this._isScrubbingRoute && this.experiencePhase === EXPERIENCE_PHASES.EVACUATION_ACTIVE) {
        // Scale playback speed proportionally to physical route length (~38 m/s 3D map speed, clamped 4.5s..22.0s)
        // so short routes play briskly instead of crawling at a fixed 22.2s normalized duration.
        const effectiveMeters = totalD > 0 ? totalD : 400;
        const targetDurationSec = Math.min(22.0, Math.max(4.5, 2.5 + effectiveMeters / 38.0));
        const nextT = this.routeProgressT + dt / targetDurationSec;
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
            const prog = evaluatePathProgressState(this.activeCheckpoints, this.routeProgressT, totalD);
            const remEl = this._el('dock-remaining-dist');
            const etaEl = this._el('dock-walk-eta');
            const scrub = this._el('route-scrubber');
            if (remEl) remEl.textContent = `잔여 ${prog.remainingMeters} m`;
            if (etaEl) etaEl.textContent = `약 ${prog.remainingMinutes}분 (${prog.totalMeters} m 중)`;
            if (scrub && !this._isScrubbingRoute) scrub.value = String(Math.round(this.routeProgressT * 1000));
          }
        }
      }

      const lookAheadT = totalD > 0 ? Math.min(0.03, Math.max(0.005, 4.0 / totalD)) : 0.02;
      const curSample = samplePointAlong3D(activePts, this.routeProgressT);
      const lookSample = samplePointAlong3D(activePts, Math.min(1.0, this.routeProgressT + lookAheadT));
      this.walkerGroup.position.set(curSample.point[0], curSample.point[1] + 1.35, curSample.point[2]);
      this._walkerNextVec.set(lookSample.point[0], lookSample.point[1] + 1.35, lookSample.point[2]);

      if (this.walkerGroup.position.distanceToSquared(this._walkerNextVec) > 0.01) {
        this.walkerChevron.lookAt(this._walkerNextVec);
        this._tangentDir.copy(this._walkerNextVec).sub(this.walkerGroup.position).normalize();
      } else {
        this._tangentDir.set(0.4, 0, 0.9).normalize();
      }

      const pulse = 1.0 + Math.sin(elapsed * 4.0) * 0.14;
      this.walkerHalo.scale.set(pulse, pulse, 1);

      // Calm setback ring pulse upon arrival (scale radially in XZ plane so terrain Y vertices stay anchored)
      if (this.shelterSetbackGroup.visible) {
        const ringPulse = 1.0 + Math.sin(elapsed * 2.1) * 0.05;
        const outerPulse = 1.0 + Math.cos(elapsed * 1.5) * 0.04;
        this.setbackInnerRing.scale.set(ringPulse, 1, ringPulse);
        this.setbackOuterRing.scale.set(outerPulse, 1, outerPulse);
      }

      if (this.followCameraEnabled && !isTransitioning && this.controls) {
        this._desiredTargetPos.copy(this.walkerGroup.position).addScaledVector(this._tangentDir, 18.0);
        this._desiredCamPos.copy(this.walkerGroup.position)
          .addScaledVector(this._tangentDir, -105.0);
        this._desiredCamPos.x -= 42.0;
        this._desiredCamPos.y += 82.0;
        this.controls.target.lerp(this._desiredTargetPos, 0.06);
        this.camera.position.lerp(this._desiredCamPos, 0.05);
        this.controls.update();
      }

      if (!this._walkerCalloutEl) this._walkerCalloutEl = this._el('walker-callout');
      const walkerCalloutEl = this._walkerCalloutEl;
      if (walkerCalloutEl) {
        this._walkerProjVec.copy(this.walkerGroup.position);
        this._walkerProjVec.y += 15.5;
        this._walkerProjVec.project(this.camera);
        const inFront = this._walkerProjVec.z >= -1 && this._walkerProjVec.z <= 1;
        const vw = typeof window !== 'undefined' ? window.innerWidth : 1280;
        const vh = typeof window !== 'undefined' ? window.innerHeight : 800;
        const sx = (this._walkerProjVec.x * 0.5 + 0.5) * vw;
        const sy = (-this._walkerProjVec.y * 0.5 + 0.5) * vh;
        if (inFront && sx > 40 && sx < vw - 40 && sy > 70 && sy < vh - 165) {
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
      if (!this._walkerCalloutEl) this._walkerCalloutEl = this._el('walker-callout');
      const wc = this._walkerCalloutEl;
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

  _setDetailOpen(open) {
    const next = Boolean(open);
    const hdr = this._el('evac-header-overlay');
    const panel = this._el('evac-detail-panel');
    const drawer = this._el('evac-context-drawer');
    const btn = this._el('btn-toggle-context-details');
    if (next) this._setRegionPopoverOpen(false);
    hdr?.classList.toggle('is-detail-open', next);
    panel?.setAttribute('aria-hidden', next ? 'false' : 'true');
    drawer?.classList.toggle('is-open', next);
    drawer?.setAttribute('aria-hidden', next ? 'false' : 'true');
    btn?.classList.toggle('active', next);
    btn?.setAttribute('aria-expanded', next ? 'true' : 'false');
    this._el('handoff-context-strip')?.classList.toggle('is-mobile-expanded', next);
    if (btn) {
      btn.innerHTML = next ? '상세 <span class="reg-caret">▴</span>' : '상세 <span class="reg-caret">▾</span>';
    }
    this._syncResponsiveTopBarOffset();
  }

  _setRegionPopoverOpen(open, { focusDesktop = true } = {}) {
    const pop = this._el('region-search-popover');
    const btn = this._el('btn-region-switcher');
    const next = Boolean(open);
    pop?.classList.toggle('open', next);
    btn?.classList.toggle('open', next);
    if (next) {
      this._setDetailOpen(false);
      // Avoid auto-opening mobile/tablet keyboard on touch taps when preset chips are right inside the popover.
      const isCoarseTouch = typeof window !== 'undefined' && Boolean(
        window.matchMedia?.('(pointer: coarse)')?.matches ||
        ('ontouchstart' in window && window.innerWidth <= 1024)
      );
      if (focusDesktop && (typeof window === 'undefined' || (window.innerWidth > 1024 && !isCoarseTouch))) {
        this._el('korea-region-search-input')?.focus();
      }
    }
    this._syncResponsiveTopBarOffset();
  }

  dispose() {
    if (this.briefTimerId) clearTimeout(this.briefTimerId);
    if (this._onWindowRouteScrubEnd && typeof window !== 'undefined') {
      window.removeEventListener('pointerup', this._onWindowRouteScrubEnd);
      window.removeEventListener('touchend', this._onWindowRouteScrubEnd);
    }
    if (this._onWindowResizeSync && typeof window !== 'undefined') {
      window.removeEventListener('resize', this._onWindowResizeSync);
    }
    if (this._onDocumentPointerDownOutsidePopover && typeof document !== 'undefined') {
      document.removeEventListener('pointerdown', this._onDocumentPointerDownOutsidePopover);
    }
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
