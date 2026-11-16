// ============================================================================
// SEISMOLIVE v4.0 — Pure Travel-Time & Exploration Geophysics Solvers
// Equations: Omori Triangulation, Snell's Law & Moho Head Wave, Dix Inversion,
//            Airy Shallow-Water Wave Speed & Green's Law Shoaling
// Domain-pure physics module (DOM & SVG presentation separated to GeophysicsFolioView.js)
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

// Backward-compatible presentation re-exports (Stage R2 separation)
export {
  generateTravelTimeCurveSVG,
  renderGeophysicsFolioHTML,
  initTravelTimeInteractiveProbe,
  generateTsunamiBathymetrySVG
} from '../ui/GeophysicsFolioView.js';
