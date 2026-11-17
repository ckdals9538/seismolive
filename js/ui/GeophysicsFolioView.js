// ============================================================================
// SEISMOLIVE v4.0 — Geophysics Folio SVG & Interactive Probe View
// Module: js/ui/GeophysicsFolioView.js
// Extracted from js/geophysics/TravelTimeSolvers.js in Stage R2 so pure
// seismological/hydrodynamic physics stays isolated from DOM & SVG rendering.
// ============================================================================

import { computeTravelTimeParams } from '../geophysics/TravelTimeSolvers.js';
import { synthesizeDualBandAudifiedSamples } from '../audio/livingSoundfieldEngine.js';
import { extractOfficialUsgsProducts, USGS_PRODUCT_STATUS } from '../data/UsgsOfficialProductsBridge.js';

/**
 * Deterministic P + S + Rayleigh synthetic waveform packet for classroom demonstration
 * when no real SAC trace is attached (explicitly labeled synthetic).
 */
export function buildDemoAudificationWaveform(depthKm = 10.0, sampleRateHz = 100, durationSec = 16) {
  const n = Math.max(2, Math.floor(sampleRateHz * durationSec));
  const samples = new Float32Array(n);
  const tP = 1.5;
  const tS = Math.min(durationSec * 0.55, tP + Math.max(1.2, depthKm * 0.18));
  const tR = Math.min(durationSec * 0.72, tS + 1.8);

  for (let i = 0; i < n; i++) {
    const t = i / sampleRateHz;
    const pEnv = Math.exp(-Math.pow((t - tP) / 0.7, 2)) * (t >= tP - 0.5 ? 1 : 0);
    const sEnv = Math.exp(-Math.pow((t - tS) / 1.1, 2)) * (t >= tS - 0.8 ? 1 : 0);
    const rEnv = Math.exp(-Math.pow((t - tR) / 2.6, 2)) * (t >= tR - 1.2 ? 1 : 0);

    const pSig = 0.7e-4 * Math.sin(2 * Math.PI * 3.8 * (t - tP)) * pEnv;
    const sSig = 1.4e-4 * Math.sin(2 * Math.PI * 1.9 * (t - tS)) * sEnv;
    const rSig = 2.2e-4 * Math.sin(2 * Math.PI * 0.18 * (t - tR)) * rEnv;
    samples[i] = pSig + sSig + rSig;
  }
  return samples;
}

export function generateTravelTimeCurveSVG(params, width = 580, height = 155) {
  const { V1, V2, ti, xCrit, xCross, t0 } = params;

  const padL = 45;
  const padR = 25;
  const padT = 28;
  const padB = 25;
  const plotW = width - padL - padR;
  const plotH = height - padT - padB;

  const maxDist = Math.max(300, Math.ceil(xCross * 1.5 / 50) * 50);
  const maxTime = Math.max(50, Math.ceil((ti + maxDist / V2) * 1.15 / 10) * 10);

  const x = (d) => (padL + (d / maxDist) * plotW).toFixed(1);
  const y = (t) => (padT + plotH - (t / maxTime) * plotH).toFixed(1);

  let gridSvg = "";
  const distStep = maxDist > 300 ? 100 : 50;
  for (let d = distStep; d <= maxDist; d += distStep) {
    gridSvg += `<line x1="${x(d)}" y1="${padT}" x2="${x(d)}" y2="${padT + plotH}" stroke="rgba(255,255,255,0.06)" stroke-width="1"/>`;
    gridSvg += `<text x="${x(d)}" y="${padT + plotH + 14}" fill="#8797AC" font-size="8.5" text-anchor="middle" font-family="'SF Mono', Menlo, monospace">${d}</text>`;
  }
  const timeStep = maxTime > 60 ? 20 : 10;
  for (let t = timeStep; t <= maxTime; t += timeStep) {
    gridSvg += `<line x1="${padL}" y1="${y(t)}" x2="${padL + plotW}" y2="${y(t)}" stroke="rgba(255,255,255,0.06)" stroke-width="1"/>`;
    gridSvg += `<text x="${padL - 6}" y="${Number(y(t)) + 3}" fill="#8797AC" font-size="8.5" text-anchor="end" font-family="'SF Mono', Menlo, monospace">${t}s</text>`;
  }

  // Direct wave path: t = d / V1
  let dirPath = `M ${x(0)} ${y(0)}`;
  for (let d = 5; d <= maxDist; d += 5) {
    const t = d / V1;
    if (t <= maxTime) dirPath += ` L ${x(d)} ${y(t)}`;
  }

  // Head wave path: t = ti + d / V2 (only valid for d >= xCrit)
  let headPath = `M ${x(xCrit)} ${y(ti + xCrit / V2)}`;
  for (let d = xCrit + 5; d <= maxDist; d += 5) {
    const t = ti + d / V2;
    if (t <= maxTime) headPath += ` L ${x(d)} ${y(t)}`;
  }

  // Reflected wave path: t = sqrt(t0^2 + d^2 / V1^2)
  let reflPath = `M ${x(0)} ${y(t0)}`;
  for (let d = 5; d <= maxDist; d += 5) {
    const t = Math.sqrt(t0 * t0 + (d * d) / (V1 * V1));
    if (t <= maxTime) reflPath += ` L ${x(d)} ${y(t)}`;
  }

  const readoutHtml = `
    <div class="tx-probe-readout-panel" id="tx-probe-readout-bar">
      <div class="tx-readout-item">
        <span class="tx-r-lbl">오프셋 X</span>
        <span class="tx-r-val" id="tx-val-dist">— km</span>
      </div>
      <div class="tx-readout-item">
        <span class="tx-r-lbl">직접파 P</span>
        <span class="tx-r-val" id="tx-val-dir">— s</span>
      </div>
      <div class="tx-readout-item">
        <span class="tx-r-lbl">모호면 두부파</span>
        <span class="tx-r-val" id="tx-val-head" style="color:var(--cinnabar);">— s</span>
      </div>
      <div class="tx-readout-item">
        <span class="tx-r-lbl">반사파 쌍곡선</span>
        <span class="tx-r-val" id="tx-val-refl" style="color:#5EA8FF;">— s</span>
      </div>
      <div class="tx-readout-regime">
        <span class="tx-regime-badge" id="tx-regime-status">T-X 주시 곡선 위로 마우스를 올려 3D 지형 파동과 실시간 연동하십시오</span>
      </div>
    </div>
  `;

  return `
    ${readoutHtml}
    <svg viewBox="0 0 ${width} ${height}" class="tx-curve-svg" style="width:100%; height:auto; max-height:170px; background:rgba(0,0,0,0.45); border-radius:2px; border:1px solid rgba(255,255,255,0.08); margin:4px 0 8px 0; cursor:crosshair; touch-action:none;">
      <!-- Axes -->
      <line x1="${padL}" y1="${padT + plotH}" x2="${padL + plotW}" y2="${padT + plotH}" stroke="rgba(255,255,255,0.22)" stroke-width="1"/>
      <line x1="${padL}" y1="${padT}" x2="${padL}" y2="${padT + plotH}" stroke="rgba(255,255,255,0.22)" stroke-width="1"/>
      ${gridSvg}

      <!-- Critical & Crossover Annotations -->
      <line x1="${x(xCross)}" y1="${padT}" x2="${x(xCross)}" y2="${padT + plotH}" stroke="#C89D54" stroke-dasharray="3 3" stroke-width="1" opacity="0.6"/>
      <text x="${x(xCross)}" y="${padT + plotH - 6}" fill="#C89D54" font-size="8" text-anchor="middle" font-family="'SF Mono', Menlo, monospace">Xcross (${xCross.toFixed(1)}km)</text>

      <line x1="${x(xCrit)}" y1="${padT}" x2="${x(xCrit)}" y2="${padT + plotH}" stroke="#8797AC" stroke-dasharray="2 2" stroke-width="1" opacity="0.45"/>
      <text x="${x(xCrit)}" y="${padT + 12}" fill="#8797AC" font-size="8" text-anchor="middle" font-family="'SF Mono', Menlo, monospace">Xcrit (${xCrit.toFixed(1)}km)</text>

      <!-- Wavefield Curves -->
      <path d="${reflPath}" fill="none" stroke="#5EA8FF" stroke-dasharray="4 2" stroke-width="1.3"/>
      <path d="${dirPath}" fill="none" stroke="#EAE4D5" stroke-width="1.6"/>
      <path d="${headPath}" fill="none" stroke="#D94E34" stroke-width="1.6"/>

      <!-- Interactive Probe Cursor Elements (Dynamic Hover) -->
      <g id="tx-probe-cursor-group" style="display:none; pointer-events:none;">
        <line id="tx-probe-cursor" x1="0" y1="${padT}" x2="0" y2="${padT + plotH}" stroke="rgba(234, 228, 213, 0.75)" stroke-width="1.2" stroke-dasharray="2 2"/>
        <circle id="tx-probe-dot-refl" cx="0" cy="0" r="3.5" fill="#5EA8FF" stroke="#161A22" stroke-width="1.5"/>
        <circle id="tx-probe-dot-dir" cx="0" cy="0" r="3.5" fill="#EAE4D5" stroke="#161A22" stroke-width="1.5"/>
        <circle id="tx-probe-dot-head" cx="0" cy="0" r="3.5" fill="#D94E34" stroke="#161A22" stroke-width="1.5"/>
      </g>

      <!-- Legend -->
      <g transform="translate(${padL + 80}, 13)">
        <line x1="0" y1="0" x2="14" y2="0" stroke="#EAE4D5" stroke-width="1.8"/>
        <text x="18" y="3" fill="#EAE4D5" font-size="8.5" font-family="'SF Mono', Menlo, monospace">직접파 (V₁=${V1}km/s)</text>

        <line x1="125" y1="0" x2="139" y2="0" stroke="#D94E34" stroke-width="1.8"/>
        <text x="143" y="3" fill="#D94E34" font-size="8.5" font-family="'SF Mono', Menlo, monospace">두부파 (V₂=${V2}km/s)</text>

        <line x1="250" y1="0" x2="264" y2="0" stroke="#5EA8FF" stroke-dasharray="3 2" stroke-width="1.5"/>
        <text x="268" y="3" fill="#5EA8FF" font-size="8.5" font-family="'SF Mono', Menlo, monospace">반사파 쌍곡선 (t₀=${t0.toFixed(1)}s)</text>
      </g>

      <!-- Axis Titles -->
      <text x="${width - padR}" y="${padT + plotH + 18}" fill="#8797AC" font-size="8.5" text-anchor="end" font-family="'SF Mono', Menlo, monospace">오프셋 x (km) →</text>
      <text x="${padL - 4}" y="14" fill="#8797AC" font-size="8.5" text-anchor="start" font-family="'SF Mono', Menlo, monospace">도달 주시 t (초)</text>
    </svg>
  `;
}

export function renderGeophysicsFolioHTML(depthKm = 10.0, options = {}) {
  const p = computeTravelTimeParams(depthKm);
  const svgHtml = generateTravelTimeCurveSVG(p);
  const official = options.officialProducts || extractOfficialUsgsProducts(options.usgsDetailJson || null);

  const officialSummaryText = official.status === USGS_PRODUCT_STATUS.UNAVAILABLE
    ? '공식 ShakeMap / OAF 산출물: 미제공 (null 유지 · 경험식 대체 금지)'
    : `USGS 공식 산출물 검증: ShakeMap ${official.shakemap ? `MMI ${official.shakemap.maxMmi ?? 'N/A'}` : 'null'} · OAF ${official.oaf ? '제공' : 'null'}`;

  return `
    <!-- Section 01: P-S Wavefield & Epicentral Triangulation -->
    <div class="editorial-section">
      <div class="editorial-sec-header">01 / P파·S파 도달 시차를 이용한 진앙 찾기</div>
      <div class="editorial-formula-box">
        <div class="editorial-formula-main">
          d = k · (t_S - t_P) &nbsp;&nbsp;[k = (V_P · V_S) / (V_P - V_S) ≈ ${p.omoriK} km/s] &nbsp;&nbsp;&nbsp;&nbsp; Δ = √(d² - h²)
        </div>
        <div class="editorial-formula-sub">
          (x - xᵢ)² + (y - yᵢ)² = Δᵢ² &nbsp;&nbsp;(i = 1, 2, 3 관측소 삼각 측량 교점 연립)
        </div>
      </div>
      <p class="editorial-narrative">
        지하 진원에서 동시 방출된 P파(체적압축파, Vp ≈ ${p.V1} km/s)와 S파(전단파, Vs ≈ ${p.VS} km/s, Vp/Vs = ${p.vpVsRatio})는 매질 탄성계수 차이로 인해 거리가 멀어질수록 도달 시각차(t_S - t_P)가 선형적으로 증가합니다.
        오모리(Omori) 계수(k ≈ ${p.omoriK} km/s)를 지진계에 기록된 P-S 도달 시각차에 곱하면 관측소로부터의 진원거리(d)가 즉시 도출되며, 진원 심도(h = ${p.depth.toFixed(1)} km) 보정을 거쳐 수평 진앙거리(Δ)가 확정됩니다.
        최소 3개 관측소에서 도출된 진앙거리를 반지름으로 하는 동심원을 작도할 때 3개 원이 교차하는 공통 지점이 진앙(Epicenter)으로 공간 결정(3원 측량법)됩니다.
      </p>
      <div class="editorial-grounding-line">
        <div class="eg-item"><span class="eg-tag obs">[실측값]</span> <span class="eg-val">3성분 광대역 지진계 P/S 도달 시각차 (t_S - t_P)</span></div>
        <div class="eg-item"><span class="eg-tag inv">[역산값]</span> <span class="eg-val">3원 교점 진앙 좌표 및 오차 타원(Error Ellipse) 최소제곱법</span></div>
        <div class="eg-item"><span class="eg-tag mod">[모델 가정]</span> <span class="eg-val">상부 지각 균질 등방 매질 (Vp=${p.V1}, Vs=${p.VS} km/s, 포아송비 ν=0.25)</span></div>
      </div>
    </div>

    <!-- Section 02: Refraction Seismology & Moho Discontinuity -->
    <div class="editorial-section">
      <div class="editorial-sec-header">02 / 지층 경계면 굴절파와 모호면 깊이 분석</div>
      <div class="editorial-formula-box">
        <div class="editorial-formula-main">
          sin i_c = V₁ / V₂ = ${(p.V1 / p.V2).toFixed(3)} &nbsp;&nbsp;(임계각 i_c ≈ ${p.icDeg}°) &nbsp;&nbsp;&nbsp;&nbsp; t_head(x) = x / V₂ + t_i
        </div>
        <div class="editorial-formula-sub">
          t_i = 2h√(V₂² - V₁²) / (V₁V₂) = ${p.ti.toFixed(2)} s &nbsp;&nbsp;&nbsp;&nbsp; X_cross = 2h√((V₂ + V₁) / (V₂ - V₁)) = ${p.xCross.toFixed(1)} km &nbsp;&nbsp;&nbsp;&nbsp; h = ${p.depth.toFixed(1)} km
        </div>
      </div>
      ${svgHtml}
      <p class="editorial-narrative">
        상부 지각(V₁ = ${p.V1} km/s)에서 밀도가 높은 모호면 하부 상부 맨틀(V₂ = ${p.V2} km/s)로 지진파가 입사할 때, 스넬(Snell)의 법칙에 따라 굴절각이 90°가 되는 <strong>임계각(i_c ≈ ${p.icDeg}°)</strong>에서 경계면을 따라 초고속 전파되는 <strong>두부파(Head Wave)</strong>가 방출됩니다.
        오프셋 x &lt; ${p.xCross.toFixed(1)} km 구간에서는 지표면을 따라 직진하는 <strong>직접파(Direct Wave)</strong>가 먼저 도달하지만, 교차거리(X_cross ≈ ${p.xCross.toFixed(1)} km)를 넘어서면 고속층을 통과한 굴절 두부파가 직접파를 추월하여 지진계에 최초 도달파(First Arrival)로 기록됩니다.
        주시 곡선의 절편 시간(t_i ≈ ${p.ti.toFixed(2)} s)과 교차거리를 분석함으로써 진원 심도(h = ${p.depth.toFixed(1)} km)를 수학적으로 역산합니다.
      </p>
      <div class="editorial-grounding-line">
        <div class="eg-item"><span class="eg-tag obs">[실측값]</span> <span class="eg-val">오프셋(x)별 지진계 초동 주시 곡선 (First Arrival t-x)</span></div>
        <div class="eg-item"><span class="eg-tag inv">[역산값]</span> <span class="eg-val">모호면 심도 h=${p.depth.toFixed(1)} km 및 상·하부 층속도 (V1=${p.V1}, V2=${p.V2} km/s)</span></div>
        <div class="eg-item"><span class="eg-tag mod">[모델 가정]</span> <span class="eg-val">수평 2층 평탄 매질 (경사각 0°)</span></div>
      </div>
    </div>

    <!-- Section 03: Reflection Seismology & Dix Interval Velocity -->
    <div class="editorial-section">
      <div class="editorial-sec-header">03 / 지진파 반사 분석과 지하 지층 속도</div>
      <div class="editorial-formula-box">
        <div class="editorial-formula-main">
          t² = t₀² + x² / V_rms² &nbsp;&nbsp;[t₀ = 2h / V₁ = ${p.t0.toFixed(2)} s] &nbsp;&nbsp;&nbsp;&nbsp; Δt_NMO ≈ x² / (2 V_rms² t₀)
        </div>
        <div class="editorial-formula-sub">
          V_int,n² = (V_rms,n² · t_n - V_rms,n-1² · t_n-1) / (t_n - t_n-1) &nbsp;&nbsp;&nbsp;&nbsp; S/N 개선비 = √N (N: CMP Fold 중합수)
        </div>
      </div>
      <p class="editorial-narrative">
        진앙 음원에서 방출되어 지하 불연속면에서 반사되어 되돌아오는 파동은 오프셋(x)이 증가함에 따라 주시가 쌍곡선(Hyperbola)으로 지연됩니다.
        수직주시편차(Normal Moveout, NMO) 보정을 통해 오프셋에 따른 주시 왜곡을 평탄화하고, 동일 반사점을 공유하는 공통반사점(CMP) 트레이스를 중합(Stacking)하여 무작위 잡음을 소거하고 신호대잡음비(S/N ∝ √N)를 극대화합니다.
        중합된 반사 파형에 딕스(Dix) 역산 공식을 적용함으로써 지각 각 층의 구간속도(Interval Velocity)와 층후(Thickness)를 정밀하게 분리 해석합니다.
      </p>
      <div class="editorial-grounding-line">
        <div class="eg-item"><span class="eg-tag obs">[실측값]</span> <span class="eg-val">다채널 CMP 탄성파 반사 기록 트레이스</span></div>
        <div class="eg-item"><span class="eg-tag inv">[역산값]</span> <span class="eg-val">지각 층별 RMS 속도 및 Dix 구간속도 (지층 경계면 해석)</span></div>
        <div class="eg-item"><span class="eg-tag mod">[모델 가정]</span> <span class="eg-val">1D 평탄 수평 음향 임피던스 경계 및 CMP Fold 중합</span></div>
      </div>
    </div>

    <!-- Section 04: Dual-Band Seismic Audification & Official Products -->
    <div class="editorial-section">
      <div class="editorial-sec-header">04 / 지진파 소리 변환(청각화) 및 USGS 공식 자료 확인</div>
      <div class="editorial-formula-box" style="display:flex; flex-direction:column; gap:8px;">
        <div style="display:flex; align-items:center; justify-content:space-between; gap:10px; flex-wrap:wrap;">
          <button id="btn-audify-waveform" type="button" class="surface-btn secondary compact" style="font-size:11px; padding:5px 10px;">
            이중 대역 파형 청각화 재생 (0.5Hz 분리 · Arctan 압축)
          </button>
          <span id="audify-status-readout" style="font-size:10.5px; color:#8797AC; font-family:'SF Mono', Menlo, monospace;">대기 중 (L: ≥0.5Hz 실체파 가속 | R: &lt;0.5Hz 표면파 VCO FM)</span>
        </div>
        <div id="usgs-official-products-strip" style="font-size:10.5px; color:${official.status === USGS_PRODUCT_STATUS.UNAVAILABLE ? '#8797AC' : '#EAE4D5'}; border-top:1px solid rgba(255,255,255,0.08); padding-top:6px;">
          ${officialSummaryText}
        </div>
      </div>
    </div>
  `;
}

/**
 * Initializes interactive cursor probe on T-X curve SVG and connects to 3D wavefield
 * @param {HTMLElement} container
 * @param {number} depthKm
 * @param {Function|null} [onProbeUpdate=null] - Explicit probe callback(dist, xCrit, xCross)
 */
export function initTravelTimeInteractiveProbe(container, depthKm = 10.0, onProbeUpdate = null, options = {}) {
  if (!container) return;

  // Bind Dual-Band Seismic Audification button even independently of SVG cursor move
  const btnAudify = container.querySelector('#btn-audify-waveform');
  const audifyReadout = container.querySelector('#audify-status-readout');
  if (btnAudify) {
    btnAudify.addEventListener('click', () => {
      const sampleRate = options.sampleRateHz || 100;
      const samples = options.waveformSamples || buildDemoAudificationWaveform(depthKm, sampleRate, 16);
      const synth = synthesizeDualBandAudifiedSamples(samples, sampleRate, {
        audioSampleRate: 8000,
        speedFactor: 60
      });
      if (audifyReadout) {
        audifyReadout.textContent = `청각화 계산 완료 · L(실체파 RMS ${synth.bodyBandRms.toFixed(3)}) | R(표면파 VCO RMS ${synth.surfaceBandRms.toFixed(3)})`;
      }
      if (typeof options.onAudifyTrigger === 'function') {
        options.onAudifyTrigger(samples, sampleRate, synth);
      } else if (typeof globalThis !== 'undefined' && typeof globalThis.livingSoundfield?.playAudifiedWaveform === 'function') {
        globalThis.livingSoundfield.playAudifiedWaveform(samples, sampleRate).catch(() => {});
      }
    });
  }

  const svg = container.querySelector('.tx-curve-svg');
  if (!svg) return;

  const params = computeTravelTimeParams(depthKm);
  const { V1, V2, ti, xCrit, xCross, t0 } = params;

  const width = 580;
  const height = 155;
  const padL = 45;
  const padR = 25;
  const padT = 28;
  const padB = 25;
  const plotW = width - padL - padR;
  const plotH = height - padT - padB;
  const maxDist = Math.max(300, Math.ceil(xCross * 1.5 / 50) * 50);
  const maxTime = Math.max(50, Math.ceil((ti + maxDist / V2) * 1.15 / 10) * 10);

  const yCoord = (t) => padT + plotH - (t / maxTime) * plotH;

  const probeGroup = svg.querySelector('#tx-probe-cursor-group');
  const lineCursor = svg.querySelector('#tx-probe-cursor');
  const dotDir = svg.querySelector('#tx-probe-dot-dir');
  const dotHead = svg.querySelector('#tx-probe-dot-head');
  const dotRefl = svg.querySelector('#tx-probe-dot-refl');

  const valDist = container.querySelector('#tx-val-dist');
  const valDir = container.querySelector('#tx-val-dir');
  const valHead = container.querySelector('#tx-val-head');
  const valRefl = container.querySelector('#tx-val-refl');
  const regimeStatus = container.querySelector('#tx-regime-status');

  const dispatchProbe = (dist, xc, xcr) => {
    if (typeof onProbeUpdate === 'function') {
      onProbeUpdate(dist, xc, xcr);
    } else if (typeof globalThis !== 'undefined' && typeof globalThis.setGeophysics3DProbe === 'function') {
      globalThis.setGeophysics3DProbe(dist, xc, xcr);
    }
  };

  function updateProbe(clientX) {
    const rect = svg.getBoundingClientRect();
    if (rect.width <= 0) return;
    const svgX = ((clientX - rect.left) / rect.width) * width;
    const clampedSvgX = Math.max(padL, Math.min(padL + plotW, svgX));
    const dist = ((clampedSvgX - padL) / plotW) * maxDist;

    const tDir = dist / V1;
    const tRefl = Math.sqrt(t0 * t0 + (dist * dist) / (V1 * V1));
    const hasHead = dist >= xCrit;
    const tHead = hasHead ? (ti + dist / V2) : null;

    if (probeGroup) probeGroup.style.display = 'block';

    if (lineCursor) {
      lineCursor.setAttribute('x1', clampedSvgX.toFixed(1));
      lineCursor.setAttribute('x2', clampedSvgX.toFixed(1));
    }

    if (dotDir) {
      dotDir.setAttribute('cx', clampedSvgX.toFixed(1));
      dotDir.setAttribute('cy', yCoord(tDir).toFixed(1));
    }

    if (dotRefl) {
      dotRefl.setAttribute('cx', clampedSvgX.toFixed(1));
      dotRefl.setAttribute('cy', yCoord(tRefl).toFixed(1));
    }

    if (dotHead) {
      if (hasHead) {
        dotHead.style.display = 'block';
        dotHead.setAttribute('cx', clampedSvgX.toFixed(1));
        dotHead.setAttribute('cy', yCoord(tHead).toFixed(1));
      } else {
        dotHead.style.display = 'none';
      }
    }

    if (valDist) valDist.textContent = `${dist.toFixed(1)} km`;
    if (valDir) valDir.textContent = `${tDir.toFixed(2)} s`;
    if (valRefl) valRefl.textContent = `${tRefl.toFixed(2)} s`;
    if (valHead) {
      valHead.textContent = hasHead ? `${tHead.toFixed(2)} s` : '미발생 (X < Xcrit)';
    }

    if (regimeStatus) {
      if (dist < xCrit) {
        regimeStatus.innerHTML = `<span style="color:var(--mist);">직접파 대역 (x &lt; X<sub>crit</sub> ${xCrit.toFixed(1)}km, 굴절파 미생성)</span>`;
      } else if (dist < xCross) {
        regimeStatus.innerHTML = `<span style="color:var(--hanji);">직접파 최초 도달 대역 (x &lt; X<sub>cross</sub> ${xCross.toFixed(1)}km)</span>`;
      } else {
        regimeStatus.innerHTML = `<span style="color:var(--cinnabar); font-weight:600;">★ 모호면 굴절 두부파 역전 최초 도달 (First Arrival, x &gt; X<sub>cross</sub>)</span>`;
      }
    }

    dispatchProbe(dist, xCrit, xCross);
  }

  function resetProbe() {
    if (probeGroup) probeGroup.style.display = 'none';
    if (valDist) valDist.textContent = '— km';
    if (valDir) valDir.textContent = '— s';
    if (valHead) valHead.textContent = '— s';
    if (valRefl) valRefl.textContent = '— s';
    if (regimeStatus) {
      regimeStatus.innerHTML = 'T-X 주시 곡선 위로 마우스를 올려 3D 지형 파동과 실시간 연동하십시오';
    }
    dispatchProbe(0, 0, 0);
  }

  svg.addEventListener('pointermove', (e) => updateProbe(e.clientX));
  svg.addEventListener('mousemove', (e) => updateProbe(e.clientX));
  svg.addEventListener('pointerleave', resetProbe);
  svg.addEventListener('mouseleave', resetProbe);
  svg.addEventListener('touchmove', (e) => {
    if (e.touches && e.touches[0]) updateProbe(e.touches[0].clientX);
  }, { passive: true });
  svg.addEventListener('touchend', resetProbe);
}

export function generateTsunamiBathymetrySVG(params, width = 560, height = 182) {
  const { deepDepthM, coastalDepthM, vDeepKmH, vMidKmH, vCoastKmH, shoalingFactor, travelTimeMin } = params;

  const padL = 24;
  const padR = 24;
  const padT = 34;
  const padB = 34;
  const plotW = width - padL - padR;
  const plotH = height - padT - padB;

  const ySeaLevel = padT + 26;
  const yBedDeep = padT + plotH - 4;
  const yBedSlopeBreak = padT + plotH * 0.62;
  const yBedShelf = padT + plotH * 0.36;
  const yBedCoast = ySeaLevel + 2;

  const x0 = padL;
  const x1 = padL + plotW * 0.34;
  const x2 = padL + plotW * 0.72;
  const x3 = padL + plotW;

  const bedPath = `M ${x0} ${yBedDeep} L ${x1} ${yBedDeep} Q ${(x1 + x2) / 2} ${yBedSlopeBreak} ${x2} ${yBedShelf} L ${x3} ${yBedCoast} L ${x3} ${padT + plotH} L ${x0} ${padT + plotH} Z`;

  const wavePath = `
    M ${x0} ${ySeaLevel}
    L ${x1} ${ySeaLevel}
    Q ${x1 + plotW * 0.18} ${ySeaLevel - 2} ${x2 - 10} ${ySeaLevel - 5}
    C ${x2 + 25} ${ySeaLevel - 10} ${x3 - 38} ${ySeaLevel - 20} ${x3 - 22} ${ySeaLevel - 22}
    C ${x3 - 13} ${ySeaLevel - 22} ${x3 - 7} ${ySeaLevel + 7} ${x3} ${ySeaLevel + 2}
  `;

  return `
    <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" class="tsunami-bathymetry-svg" style="width:100%; height:auto; display:block;">
      <defs>
        <linearGradient id="tsunamiWaterGrad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stop-color="rgba(30, 60, 100, 0.45)"/>
          <stop offset="70%" stop-color="rgba(30, 85, 140, 0.35)"/>
          <stop offset="100%" stop-color="rgba(200, 157, 84, 0.22)"/>
        </linearGradient>
        <linearGradient id="bedrockGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="rgba(20, 24, 32, 0.95)"/>
          <stop offset="100%" stop-color="rgba(10, 12, 16, 0.98)"/>
        </linearGradient>
      </defs>

      <polygon points="${x0},${ySeaLevel} ${x1},${ySeaLevel} ${x2},${ySeaLevel} ${x3},${ySeaLevel} ${x3},${yBedCoast} ${x2},${yBedShelf} ${x1},${yBedDeep} ${x0},${yBedDeep}" fill="url(#tsunamiWaterGrad)"/>
      <path d="${bedPath}" fill="url(#bedrockGrad)" stroke="rgba(255,255,255,0.22)" stroke-width="1.2"/>
      <line x1="${x0}" y1="${ySeaLevel}" x2="${x3}" y2="${ySeaLevel}" stroke="rgba(255,255,255,0.18)" stroke-dasharray="3 3" stroke-width="0.9"/>
      <path d="${wavePath}" fill="none" stroke="#5EA8FF" stroke-width="2"/>

      <!-- Left: Ulleung Basin Abyssal Zone -->
      <text x="${x0 + 6}" y="${padT - 12}" fill="#94A3B8" font-size="9" font-family="'SF Mono', Menlo, monospace">울릉분지 심해 (${deepDepthM}m)</text>
      <text x="${x0 + 6}" y="${padT + 2}" fill="#5EA8FF" font-size="9" font-family="'SF Mono', Menlo, monospace">v = ${vDeepKmH} km/h (고속 전파)</text>

      <!-- Middle: Continental Slope Zone -->
      <text x="${padL + plotW * 0.48}" y="${padT - 12}" fill="#94A3B8" font-size="9" text-anchor="middle" font-family="'SF Mono', Menlo, monospace">대륙사면 (200m)</text>
      <text x="${padL + plotW * 0.48}" y="${padT + 2}" fill="#CBD5E1" font-size="9" text-anchor="middle" font-family="'SF Mono', Menlo, monospace">v = ${vMidKmH} km/h</text>

      <!-- Right: Coastal Shoaling Zone -->
      <text x="${x3 - 6}" y="${padT - 12}" fill="#E2B96F" font-size="9" font-family="'SF Mono', Menlo, monospace" text-anchor="end">강원 연안 (${coastalDepthM}m · 파고 ${shoalingFactor}배)</text>
      <text x="${x3 - 6}" y="${padT + 2}" fill="#C89D54" font-size="8.5" font-family="'SF Mono', Menlo, monospace" text-anchor="end">v = ${vCoastKmH} km/h (감속 · 퇴조 후 내습)</text>

      <!-- Footer -->
      <text x="${(x0 + x3) / 2}" y="${height - 10}" fill="#BAC3CE" font-size="9" font-family="'SF Mono', Menlo, monospace" text-anchor="middle">대륙사면 전파 소요 시간: 약 ${travelTimeMin}분 (실록 '잠시 후 해일 내습' 기록과 일치)</text>
    </svg>
  `;
}
