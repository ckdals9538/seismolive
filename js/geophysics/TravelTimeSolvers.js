// ============================================================================
// SEISMOLIVE v4.0 — Travel-Time & Exploration Geophysics Solvers
// Equations: Omori Triangulation, Snell's Law & Moho Head Wave, Dix Inversion
// ============================================================================

export function computeTravelTimeParams(depthKm = 10.0, V1 = 5.8, V2 = 7.8, VS = 3.35) {
  const depth = (depthKm != null && !isNaN(depthKm)) ? Math.max(1, depthKm) : 10.0;
  const vpVsRatio = (V1 / VS).toFixed(2);
  const omoriK = ((V1 * VS) / (V1 - VS)).toFixed(2);

  // Snell's critical angle
  const sinIc = V1 / V2;
  const icDeg = (Math.asin(sinIc) * 180 / Math.PI).toFixed(1);

  // Intercept time: ti = 2*h*sqrt(V2^2 - V1^2) / (V1 * V2)
  const ti = (2 * depth * Math.sqrt(V2 * V2 - V1 * V1)) / (V1 * V2);

  // Critical distance: X_crit = 2*h*tan(ic) = 2*h*V1 / sqrt(V2^2 - V1^2)
  const xCrit = (2 * depth * V1) / Math.sqrt(V2 * V2 - V1 * V1);

  // Crossover distance: X_cross = 2*h*sqrt((V2+V1)/(V2-V1))
  const xCross = 2 * depth * Math.sqrt((V2 + V1) / (V2 - V1));

  // Two-way vertical reflection zero-offset time
  const t0 = (2 * depth) / V1;

  return {
    depth,
    V1,
    V2,
    VS,
    vpVsRatio,
    omoriK,
    sinIc,
    icDeg,
    ti,
    xCrit,
    xCross,
    t0
  };
}

export function generateTravelTimeCurveSVG(params, width = 580, height = 155) {
  const { depth, V1, V2, ti, xCrit, xCross, t0 } = params;

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

export function renderGeophysicsFolioHTML(depthKm = 10.0) {
  const p = computeTravelTimeParams(depthKm);
  const svgHtml = generateTravelTimeCurveSVG(p);

  return `
    <!-- Section 01: P-S Wavefield & Epicentral Triangulation -->
    <div class="editorial-section">
      <div class="editorial-sec-header">01 / 진원 탐지 & P-S 파동 주시학 (EPICENTRAL TRIANGULATION & OMORI LAW)</div>
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
      <div class="editorial-sec-header">02 / 굴절법 탄성파 탐사 & 모호면 스넬 법칙 (REFRACTION & MOHO HEAD WAVE)</div>
      <div class="editorial-formula-box">
        <div class="editorial-formula-main">
          sin i_c = V₁ / V₂ = ${(p.V1/p.V2).toFixed(3)} &nbsp;&nbsp;(임계각 i_c ≈ ${p.icDeg}°) &nbsp;&nbsp;&nbsp;&nbsp; t_head(x) = x / V₂ + t_i
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
      <div class="editorial-sec-header">03 / 반사법 탐사 & 공통반사점(CMP) NMO · Dix 속도 역산 (REFLECTION & DIX EQUATION)</div>
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
  `;
}

/**
 * Initializes interactive cursor probe on T-X curve SVG and connects to 3D wavefield
 * @param {HTMLElement} container
 * @param {number} depthKm
 */
export function initTravelTimeInteractiveProbe(container, depthKm = 10.0) {
  if (!container) return;
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

    if (typeof window.setGeophysics3DProbe === 'function') {
      window.setGeophysics3DProbe(dist, xCrit, xCross);
    }
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
    if (typeof window.setGeophysics3DProbe === 'function') {
      window.setGeophysics3DProbe(0, 0, 0);
    }
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

// ============================================================================
// Phase D6: Tsunami Hydrodynamics & Bathymetric Shoaling Solver
// Equations: Airy Shallow-Water Wave Speed, Green's Law Shoaling Amplification
// ============================================================================

export function computeTsunamiHydrodynamicParams(deepDepthM = 2000.0, coastalDepthM = 20.0, slopeDistKm = 60.0) {
  const g = 9.80665;
  const vDeepMS = Math.sqrt(g * deepDepthM);
  const vDeepKmH = vDeepMS * 3.6;

  const vMidMS = Math.sqrt(g * 200.0);
  const vMidKmH = vMidMS * 3.6;

  const vCoastMS = Math.sqrt(g * coastalDepthM);
  const vCoastKmH = vCoastMS * 3.6;

  // Green's Law Shoaling Factor: A_coast / A_deep = (H_deep / H_coast)^(1/4)
  const shoalingFactor = Math.pow(deepDepthM / coastalDepthM, 0.25);

  // Exact Travel Time across linear bathymetric slope: tau = 2*L / (sqrt(g)*(sqrt(H1) + sqrt(H2)))
  const L = slopeDistKm * 1000.0;
  const travelTimeSec = (2.0 * L) / (Math.sqrt(g) * (Math.sqrt(deepDepthM) + Math.sqrt(coastalDepthM)));
  const travelTimeMin = travelTimeSec / 60.0;

  return {
    g,
    deepDepthM,
    coastalDepthM,
    slopeDistKm,
    vDeepMS: Math.round(vDeepMS * 10) / 10,
    vDeepKmH: Math.round(vDeepKmH),
    vMidMS: Math.round(vMidMS * 10) / 10,
    vMidKmH: Math.round(vMidKmH),
    vCoastMS: Math.round(vCoastMS * 10) / 10,
    vCoastKmH: Math.round(vCoastKmH),
    shoalingFactor: Math.round(shoalingFactor * 100) / 100,
    travelTimeSec: Math.round(travelTimeSec),
    travelTimeMin: Math.round(travelTimeMin * 10) / 10
  };
}

export function generateTsunamiBathymetrySVG(params, width = 560, height = 150) {
  const { deepDepthM, coastalDepthM, slopeDistKm, vDeepKmH, vMidKmH, vCoastKmH, shoalingFactor, travelTimeMin } = params;

  const padL = 40;
  const padR = 25;
  const padT = 26;
  const padB = 25;
  const plotW = width - padL - padR;
  const plotH = height - padT - padB;

  const ySeaLevel = padT + 22;
  const yBedDeep = padT + plotH - 6;
  const yBedSlopeBreak = padT + plotH * 0.65;
  const yBedShelf = padT + plotH * 0.35;
  const yBedCoast = ySeaLevel + 4;

  const x0 = padL;
  const x1 = padL + plotW * 0.35;
  const x2 = padL + plotW * 0.80;
  const x3 = padL + plotW;

  const bedPath = `M ${x0} ${yBedDeep} L ${x1} ${yBedDeep} Q ${(x1+x2)/2} ${yBedSlopeBreak} ${x2} ${yBedShelf} L ${x3} ${yBedCoast} L ${x3} ${padT + plotH} L ${x0} ${padT + plotH} Z`;

  const wavePath = `
    M ${x0} ${ySeaLevel}
    L ${x1} ${ySeaLevel}
    Q ${x1 + plotW*0.2} ${ySeaLevel - 2} ${x2 - 15} ${ySeaLevel - 4}
    C ${x2 + 10} ${ySeaLevel - 8} ${x3 - 35} ${ySeaLevel - 16} ${x3 - 22} ${ySeaLevel - 18}
    C ${x3 - 14} ${ySeaLevel - 18} ${x3 - 8} ${ySeaLevel + 8} ${x3} ${ySeaLevel + 2}
  `;

  return `
    <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" class="tsunami-bathymetry-svg" style="width:100%; height:auto; display:block;">
      <defs>
        <linearGradient id="tsunamiWaterGrad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stop-color="rgba(30, 60, 100, 0.45)"/>
          <stop offset="70%" stop-color="rgba(30, 85, 140, 0.35)"/>
          <stop offset="100%" stop-color="rgba(200, 157, 84, 0.20)"/>
        </linearGradient>
        <linearGradient id="bedrockGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="rgba(20, 24, 32, 0.95)"/>
          <stop offset="100%" stop-color="rgba(10, 12, 16, 0.98)"/>
        </linearGradient>
      </defs>

      <polygon points="${x0},${ySeaLevel} ${x1},${ySeaLevel} ${x2},${ySeaLevel} ${x3},${ySeaLevel} ${x3},${yBedCoast} ${x2},${yBedShelf} ${x1},${yBedDeep} ${x0},${yBedDeep}" fill="url(#tsunamiWaterGrad)"/>
      <path d="${bedPath}" fill="url(#bedrockGrad)" stroke="rgba(255,255,255,0.18)" stroke-width="1.2"/>
      <line x1="${x0}" y1="${ySeaLevel}" x2="${x3}" y2="${ySeaLevel}" stroke="rgba(255,255,255,0.15)" stroke-dasharray="3 3" stroke-width="0.8"/>
      <path d="${wavePath}" fill="none" stroke="#5EA8FF" stroke-width="1.8"/>

      <text x="${x0 + 15}" y="${padT + 12}" fill="#8797AC" font-size="8.5" font-family="'SF Mono', Menlo, monospace">울릉분지 (심해 ${deepDepthM}m)</text>
      <text x="${x0 + 15}" y="${ySeaLevel + 16}" fill="#5EA8FF" font-size="8" font-family="'SF Mono', Menlo, monospace">v = ${vDeepKmH} km/h (천해파 초고속 전파)</text>

      <text x="${x2 - 35}" y="${yBedSlopeBreak - 8}" fill="#8797AC" font-size="8" font-family="'SF Mono', Menlo, monospace">대륙사면 (200m)</text>
      <text x="${x2 - 35}" y="${yBedSlopeBreak + 5}" fill="#BAC3CE" font-size="7.5" font-family="'SF Mono', Menlo, monospace">v = ${vMidKmH} km/h</text>

      <text x="${x3 - 8}" y="${padT + 10}" fill="#C89D54" font-size="8.5" font-family="'SF Mono', Menlo, monospace" text-anchor="end">강원 연안 (천해 ${coastalDepthM}m)</text>
      <text x="${x3 - 8}" y="${padT + 22}" fill="#C89D54" font-size="8.5" font-family="'SF Mono', Menlo, monospace" text-anchor="end">파고 ${shoalingFactor}배 증폭 · 퇴조(海水退) 후 내습</text>
      <text x="${x3 - 8}" y="${ySeaLevel + 32}" fill="#8797AC" font-size="7.5" font-family="'SF Mono', Menlo, monospace" text-anchor="end">v = ${vCoastKmH} km/h (급격한 감속)</text>

      <text x="${(x1 + x2)/2}" y="${padT + plotH + 16}" fill="#BAC3CE" font-size="8" font-family="'SF Mono', Menlo, monospace" text-anchor="middle">사면 전파 소요 시간: 약 ${travelTimeMin}분 (사료 기록: '잠시 후 해일 내습'과 물리적 일치)</text>
    </svg>
  `;
}
