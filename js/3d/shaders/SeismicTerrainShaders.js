// ============================================================================
// SEISMOLIVE v4.0 — Nocturnal Monolith & Seismic Wavefield GLSL Shaders
// Module: js/3d/shaders/SeismicTerrainShaders.js
//
// Extracted from js/main.js in Stage R3 so inline WebGL shaders are modularly
// maintainable and independently testable.
// Strictly preserves GEMINI.md Rule 2 (Anti-Game-VFX) and Nocturnal Monolith palette.
// ============================================================================

export const MONOLITH_SURFACE_GLSL = `
  float decodeUnorm16Rgba(vec4 c) {
    return (c.r * 65280.0 + c.g * 255.0) / 65535.0;
  }
  float sampleUnorm16Linear(sampler2D tex, vec2 uv, vec2 texSize) {
    vec2 texelPos = uv * texSize - 0.5;
    vec2 f = fract(texelPos);
    vec2 baseUv = (floor(texelPos) + 0.5) / texSize;
    vec2 stepUv = 1.0 / texSize;
    float h00 = decodeUnorm16Rgba(texture2D(tex, baseUv));
    float h10 = decodeUnorm16Rgba(texture2D(tex, baseUv + vec2(stepUv.x, 0.0)));
    float h01 = decodeUnorm16Rgba(texture2D(tex, baseUv + vec2(0.0, stepUv.y)));
    float h11 = decodeUnorm16Rgba(texture2D(tex, baseUv + vec2(stepUv.x, stepUv.y)));
    return mix(mix(h00, h10, f.x), mix(h01, h11, f.x), f.y);
  }
  float sampleEarthMeters(
    sampler2D globalTex, vec2 globalSize,
    sampler2D koreaTex, float hasKorea,
    float latDeg, float lonDeg,
    float gMin, float gMax,
    out float koreaWeight
  ) {
    vec2 gUv = vec2((lonDeg + 180.0) / 360.0, (90.0 - latDeg) / 180.0);
    float hGlobal = gMin + sampleUnorm16Linear(globalTex, gUv, globalSize) * (gMax - gMin);
    koreaWeight = 0.0;
    if (hasKorea > 0.5 && latDeg >= 33.0 && latDeg <= 42.0 && lonDeg >= 124.0 && lonDeg <= 132.0) {
      float mLat = min(latDeg - 33.0, 42.0 - latDeg);
      float mLon = min(lonDeg - 124.0, 132.0 - lonDeg);
      koreaWeight = smoothstep(0.0, 0.85, min(mLat, mLon));
      if (koreaWeight > 0.001) {
        vec2 kUv = vec2((lonDeg - 124.0) / 8.0, (42.0 - latDeg) / 9.0);
        float hKorea = -3500.0 + sampleUnorm16Linear(koreaTex, kUv, vec2(960.0, 1080.0)) * 6000.0;
        return mix(hGlobal, hKorea, koreaWeight);
      }
    }
    return hGlobal;
  }
  vec3 monolithOceanAlbedo(float elev) {
    float depthAbsorption = exp(elev * 0.00042);
    float shelfT = clamp((elev + 3200.0) / 3200.0, 0.0, 1.0);
    vec3 deepAbyss = mix(vec3(0.004, 0.010, 0.020), vec3(0.016, 0.036, 0.072), depthAbsorption);
    return mix(deepAbyss, vec3(0.038, 0.100, 0.178), shelfT);
  }
  vec3 monolithLandAlbedo(float elev, float slopeRelief) {
    float elevNorm = clamp((elev - 25.0) / 1450.0, 0.0, 1.0);
    float valleyCavity = mix(0.86, 1.0, smoothstep(0.0, 0.28, slopeRelief + elevNorm * 0.35));
    float relief = max(slopeRelief, elevNorm);
    vec3 c = mix(vec3(0.090, 0.116, 0.162), vec3(0.214, 0.258, 0.326), relief * 0.88);
    c = mix(c, vec3(0.292, 0.350, 0.430), pow(max(1e-5, relief), 1.80) * 0.82);
    return c * valleyCavity;
  }
  vec3 computeMonolithLighting(vec3 albedo, vec3 N, vec3 V, vec3 L, vec3 ambientCol, vec3 lightCol, float isOcean) {
    float NdotL = dot(N, L);
    float wrapDiffuse = pow(max(0.0, (NdotL + 0.40) / 1.40), 1.38);
    vec3 H = normalize(L + V);
    float NdotH = max(0.0, dot(N, H));
    float spec = pow(NdotH, 42.0) * isOcean * 0.48;
    float rim = pow(1.0 - max(0.0, dot(N, V)), 2.8) * max(0.0, dot(L, -V) + 0.35);
    vec3 lit = albedo * (ambientCol + lightCol * (wrapDiffuse * 1.55)) + lightCol * spec;
    vec3 atmosphereColor = vec3(0.26, 0.48, 0.82);
    lit += atmosphereColor * (rim * 0.35);
    return lit;
  }
`;

export const TIER0_GLOBE_VERTEX_SHADER = `
  precision highp float;
  uniform sampler2D u_globalElevation;
  uniform vec2 u_globalTexSize;
  uniform sampler2D u_koreaMacro;
  uniform float u_hasKoreaMacro;
  uniform float u_globalHMin;
  uniform float u_globalHMax;
  uniform float u_metersToUnits;
  uniform float u_verticalExag;
  uniform vec2 u_regionCenter;
  uniform vec2 u_regionHalfSize;
  uniform float u_regionActive;
  uniform float u_simTime;
  uniform float u_vS;
  uniform float u_dominantFreq;
  uniform float u_physicalDisplacement;

  varying vec3 vWorldNormal;
  varying vec3 vViewPos;
  varying vec2 vUv;
  varying float vElevation;
  varying vec3 vLocalPos;

  float decodeUnorm16RgbaV(vec4 c) {
    return (c.r * 65280.0 + c.g * 255.0) / 65535.0;
  }
  float sampleUnorm16LinearV(sampler2D tex, vec2 uv, vec2 texSize) {
    vec2 texelPos = uv * texSize - 0.5;
    vec2 f = fract(texelPos);
    vec2 baseUv = (floor(texelPos) + 0.5) / texSize;
    vec2 stepUv = 1.0 / texSize;
    float h00 = decodeUnorm16RgbaV(texture2D(tex, baseUv));
    float h10 = decodeUnorm16RgbaV(texture2D(tex, baseUv + vec2(stepUv.x, 0.0)));
    float h01 = decodeUnorm16RgbaV(texture2D(tex, baseUv + vec2(0.0, stepUv.y)));
    float h11 = decodeUnorm16RgbaV(texture2D(tex, baseUv + vec2(stepUv.x, stepUv.y)));
    return mix(mix(h00, h10, f.x), mix(h01, h11, f.x), f.y);
  }

  void main() {
    vUv = uv;
    vLocalPos = position;
    float lat = 90.0 - uv.y * 180.0;
    float lon = -180.0 + uv.x * 360.0;
    float normElev = sampleUnorm16LinearV(u_globalElevation, uv, u_globalTexSize);
    float rawMeters = u_globalHMin + normElev * (u_globalHMax - u_globalHMin);

    if (u_hasKoreaMacro > 0.5 && lat >= 33.0 && lat <= 42.0 && lon >= 124.0 && lon <= 132.0) {
      float mLat = min(lat - 33.0, 42.0 - lat);
      float mLon = min(lon - 124.0, 132.0 - lon);
      float kWeight = smoothstep(0.0, 0.85, min(mLat, mLon));
      if (kWeight > 0.001) {
        vec2 kUv = vec2((lon - 124.0) / 8.0, (42.0 - lat) / 9.0);
        float kMeters = -3500.0 + sampleUnorm16LinearV(u_koreaMacro, kUv, vec2(960.0, 1080.0)) * 6000.0;
        rawMeters = mix(rawMeters, kMeters, kWeight);
      }
    }

    vElevation = rawMeters;

    float dispMeters = (rawMeters > 0.0) ? rawMeters : (rawMeters * 0.15);
    float finalDisp = dispMeters * u_metersToUnits * u_verticalExag;

    // Subtle physical vertex heave along Rayleigh wavefront without polygon distortion
    if (u_simTime > 0.0 && u_physicalDisplacement > 0.01) {
      float phi0Rad = radians(u_regionCenter.x);
      float dLatM = (lat - u_regionCenter.x) * 110996.0;
      float dLonDeg = lon - u_regionCenter.y;
      if (dLonDeg > 180.0) dLonDeg -= 360.0;
      if (dLonDeg < -180.0) dLonDeg += 360.0;
      float dLonM = dLonDeg * 111319.0 * cos(phi0Rad);
      float rEpi = length(vec2(dLonM * 0.00001, dLatM * 0.00001));
      if (rEpi < 14.0) {
        float tFront = rEpi / max(0.001, u_vS * 0.92);
        float dtWave = u_simTime - tFront;
        if (dtWave > -0.2 && dtWave < 7.0) {
          float env = exp(-pow(dtWave / 1.8, 2.0)) * smoothstep(-0.2, 0.25, dtWave);
          float phase = sin(dtWave * 6.2831853 * clamp(u_dominantFreq, 0.5, 1.8) * 0.5);
          float dec = 1.0 / sqrt(max(0.15, rEpi * 3.0));
          finalDisp += phase * env * dec * 0.00085 * min(2.2, u_physicalDisplacement);
        }
      }
    }

    vec3 displacedPos = position + normal * finalDisp;

    vWorldNormal = normalize(normal);
    vec4 mvPosition = modelViewMatrix * vec4(displacedPos, 1.0);
    vViewPos = -mvPosition.xyz;
    gl_Position = projectionMatrix * mvPosition;
  }
`;

export const TIER0_GLOBE_FRAGMENT_SHADER = `
  precision highp float;
  uniform sampler2D u_globalElevation;
  uniform vec2 u_globalTexSize;
  uniform sampler2D u_koreaMacro;
  uniform float u_hasKoreaMacro;
  uniform float u_globalHMin;
  uniform float u_globalHMax;
  uniform vec3 u_lightDir;
  uniform vec3 u_lightColor;
  uniform vec3 u_ambientColor;
  uniform float u_simTime;
  uniform float u_vP;
  uniform float u_vS;
  uniform float u_dominantFreq;
  uniform float u_faultLength;
  uniform float u_faultStrike;
  uniform float u_ruptureVelocity;
  uniform float u_isFiniteFault;
  uniform float u_depthUnits;
  uniform vec2 u_regionCenter;
  uniform vec2 u_regionHalfSize;
  uniform float u_regionActive;
  uniform float u_regionFade;
  uniform vec2 u_errorEllipseAxes;
  uniform float u_errorEllipseAngle;
  uniform vec4 u_isoseismalRadii;
  uniform float u_hasErrorEllipse;
  uniform float u_showIsoseismalContours;
  uniform float u_hasTsunamiMode;

  varying vec3 vWorldNormal;
  varying vec3 vViewPos;
  varying vec2 vUv;
  varying float vElevation;
  varying vec3 vLocalPos;
  ${MONOLITH_SURFACE_GLSL}

  void main() {
    vec3 N = normalize(vWorldNormal);
    vec3 V = normalize(vViewPos);
    vec3 L_view = normalize((viewMatrix * vec4(u_lightDir, 0.0)).xyz);

    float lat = 90.0 - vUv.y * 180.0;
    float lon = -180.0 + vUv.x * 360.0;

    float kWeightC = 0.0;
    float fragElev = sampleEarthMeters(u_globalElevation, u_globalTexSize, u_koreaMacro, u_hasKoreaMacro, lat, lon, u_globalHMin, u_globalHMax, kWeightC);

    float degStepGlobalLon = 360.0 / max(1.0, u_globalTexSize.x);
    float degStepGlobalLat = 180.0 / max(1.0, u_globalTexSize.y);
    float degStepKoreaLon = 8.0 / 960.0;
    float degStepKoreaLat = 9.0 / 1080.0;
    float stepDegLon = mix(degStepGlobalLon, degStepKoreaLon, kWeightC);
    float stepDegLat = mix(degStepGlobalLat, degStepKoreaLat, kWeightC);

    float kwTmp = 0.0;
    float hL = sampleEarthMeters(u_globalElevation, u_globalTexSize, u_koreaMacro, u_hasKoreaMacro, lat, lon - stepDegLon, u_globalHMin, u_globalHMax, kwTmp);
    float hR = sampleEarthMeters(u_globalElevation, u_globalTexSize, u_koreaMacro, u_hasKoreaMacro, lat, lon + stepDegLon, u_globalHMin, u_globalHMax, kwTmp);
    float hD = sampleEarthMeters(u_globalElevation, u_globalTexSize, u_koreaMacro, u_hasKoreaMacro, clamp(lat - stepDegLat, -89.9, 89.9), lon, u_globalHMin, u_globalHMax, kwTmp);
    float hU = sampleEarthMeters(u_globalElevation, u_globalTexSize, u_koreaMacro, u_hasKoreaMacro, clamp(lat + stepDegLat, -89.9, 89.9), lon, u_globalHMin, u_globalHMax, kwTmp);

    float metricSpanX = max(1200.0, 2.0 * stepDegLon * 111319.0 * max(0.32, cos(radians(lat))));
    float metricSpanY = max(1200.0, 2.0 * stepDegLat * 110996.0);
    float dh_dx = (hR - hL) / metricSpanX;
    float dh_dy = (hD - hU) / metricSpanY;

    vec3 upRef = (abs(N.z) < 0.90) ? vec3(0.0, 0.0, 1.0) : vec3(0.0, 1.0, 0.0);
    vec3 tangent = normalize(cross(upRef, N));
    vec3 bitangent = normalize(cross(N, tangent));

    float normalBoost = mix(3.25, 2.15, kWeightC);
    vec3 perturbedWorldN = normalize(N - tangent * (dh_dx * normalBoost) - bitangent * (dh_dy * normalBoost));

    float isOcean = step(fragElev, 0.0);
    float slopeMag = length(vec2(dh_dx, dh_dy));
    float slopeLow = mix(0.0014, 0.0050, kWeightC);
    float slopeHigh = mix(0.0155, 0.0360, kWeightC);
    float slopeRelief = smoothstep(slopeLow, slopeHigh, slopeMag);

    vec3 baseColor;
    if (fragElev < 0.0) {
      baseColor = monolithOceanAlbedo(fragElev);
    } else {
      baseColor = monolithLandAlbedo(fragElev, slopeRelief);
    }

    float phi0Rad = radians(u_regionCenter.x);
    float dLatM = (lat - u_regionCenter.x) * 110996.0;
    float dLonDeg = lon - u_regionCenter.y;
    if (dLonDeg > 180.0) dLonDeg -= 360.0;
    if (dLonDeg < -180.0) dLonDeg += 360.0;
    float dLonM = dLonDeg * 111319.0 * cos(phi0Rad);
    vec2 dEpiG = vec2(dLonM * 0.00001, dLatM * 0.00001);

    float rEpiG = length(dEpiG);
    float tSlipG = 0.0;
    float effDistG = rEpiG;
    float seamLine = 0.0;
    float faultDist = 0.0;

    if (u_isFiniteFault > 0.5 && u_faultLength > 0.001) {
      vec2 uFG = vec2(sin(u_faultStrike), cos(u_faultStrike));
      vec2 nFG = vec2(cos(u_faultStrike), -sin(u_faultStrike));
      float sFaultG = dot(dEpiG, uFG);
      float dFaultG = dot(dEpiG, nFG);
      float halfLG = 0.5 * u_faultLength;
      // Smooth bilateral elliptical strike propagation (eliminates L1 Mach-diamond & chevron corners)
      float activeHalfLG = min(halfLG, max(0.12, u_ruptureVelocity * u_simTime * 0.72));
      float strikeStretchG = 1.0 + clamp(activeHalfLG * 0.58, 0.0, 0.92);
      effDistG = sqrt((sFaultG / strikeStretchG) * (sFaultG / strikeStretchG) + dFaultG * dFaultG);

      float sClampedG = clamp(sFaultG, -halfLG, halfLG);
      faultDist = length(vec2(sFaultG - sClampedG, dFaultG));
      if (u_simTime > 0.0) {
        float dtRupt = u_simTime - (abs(sClampedG) / max(0.001, u_ruptureVelocity));
        float faultEnvG = exp(-pow(sFaultG / max(0.18, 0.30 * u_faultLength), 2.0)) * smoothstep(halfLG, halfLG * 0.42, abs(sFaultG));
        seamLine = exp(-pow(faultDist / 0.0038, 2.0)) * smoothstep(-0.08, 0.22, dtRupt) * exp(-max(0.0, dtRupt) * 0.14) * faultEnvG;
      }
    }
    effDistG = sqrt(effDistG * effDistG + u_depthUnits * u_depthUnits);

    float angleG = atan(dEpiG.y, dEpiG.x);
    float lobeG = 0.5 + 0.5 * cos(2.0 * (angleG - u_faultStrike));
    float dirAniso = (u_isFiniteFault > 0.5)
      ? mix(0.66, 1.0, lobeG)
      : mix(0.84, 1.0, 0.5 + 0.5 * cos(angleG - 0.436));

    if (u_simTime > 0.0 && rEpiG < 18.0) {
      float dtG = u_simTime - tSlipG;
      float waveRP = (dtG > 0.0) ? (u_vP * dtG) : -1.0;
      float waveRS = (dtG > 0.0) ? (u_vS * dtG) : -1.0;
      float waveRR = (dtG > 0.0) ? (u_vS * 0.9194 * dtG) : -1.0;
      vec2 waveDirG = (rEpiG > 0.0001) ? normalize(dEpiG) : vec2(0.0);
      vec3 waveTiltVec = normalize(tangent * waveDirG.x + bitangent * waveDirG.y);

      float distToFrontP = abs(effDistG - waveRP);
      if (distToFrontP < 0.055 && dtG > 0.0) {
        float envP = exp(-pow(distToFrontP / 0.024, 2.0)) * smoothstep(-0.015, 0.03, dtG - effDistG / max(0.001, u_vP));
        float attenP = 1.0 / sqrt(max(0.14, effDistG * 3.8));
        float phaseP = (u_simTime - effDistG / max(0.001, u_vP)) * 6.2831853 * u_dominantFreq * 1.4;
        perturbedWorldN = normalize(perturbedWorldN + waveTiltVec * (sin(phaseP * 1.6) * envP * attenP * 0.13 * dirAniso));
      }

      float distToFrontG = abs(effDistG - waveRS);
      if (distToFrontG < 0.095 && dtG > 0.0) {
        float waveEnvG = exp(-pow(distToFrontG / 0.042, 2.0)) * smoothstep(-0.02, 0.04, dtG - effDistG / max(0.001, u_vS));
        float attenG = 1.0 / sqrt(max(0.10, effDistG * 3.0));
        float wavePhase = (u_simTime - effDistG / max(0.001, u_vS)) * 6.2831853 * u_dominantFreq;
        float tiltMag = sin(wavePhase * 2.0) * waveEnvG * attenG * dirAniso * (isOcean > 0.5 ? 0.34 : 0.24);
        perturbedWorldN = normalize(perturbedWorldN + waveTiltVec * tiltMag);
      }

      // Trailing Rayleigh dispersive wave-train ripples in normal field
      float dtR = dtG - (effDistG / max(0.001, u_vS * 0.9194));
      if (dtR > 0.0 && dtR < 6.5) {
        float rTailEnv = exp(-dtR * 0.38) * smoothstep(0.0, 0.35, dtR);
        float rAtten = 1.0 / pow(max(0.12, effDistG * 3.5), 0.35);
        float rPhase = sin(dtR * 6.2831853 * clamp(u_dominantFreq, 0.5, 1.8) * 0.55);
        perturbedWorldN = normalize(perturbedWorldN + waveTiltVec * (rPhase * rTailEnv * rAtten * dirAniso * 0.16));
      }
    }

    vec3 perturbedN_view = normalize((viewMatrix * vec4(perturbedWorldN, 0.0)).xyz);
    vec3 lit = computeMonolithLighting(baseColor, perturbedN_view, V, L_view, u_ambientColor, u_lightColor, isOcean);

    // 0m Coastline Cartographic Hairline: keeps dark nocturnal land & sea crisp without clutter
    float elevStepDiff = length(vec2(hR - hL, hD - hU));
    float shoreNormDist = abs(fragElev) / max(18.0, elevStepDiff * 0.42);
    float shoreHairline = exp(-pow(shoreNormDist / 1.35, 2.0)) * smoothstep(0.5, 4.0, elevStepDiff);
    lit += vec3(0.42, 0.60, 0.80) * (shoreHairline * mix(0.19, 0.22, kWeightC));

    if (u_simTime > 0.0 && rEpiG < 18.0) {
      float dtGlow = u_simTime - tSlipG;
      float waveRP = (dtGlow > 0.0) ? (u_vP * dtGlow) : -1.0;
      float waveRS = (dtGlow > 0.0) ? (u_vS * dtGlow) : -1.0;
      float attenGlow = 1.0 / sqrt(max(0.16, effDistG * 3.6));
      float regionAtten = mix(1.0, 0.22, clamp(u_regionFade, 0.0, 1.0));

      // Subtle cool P-wave precursor filament
      float pPulse = exp(-pow(abs(effDistG - waveRP) / 0.014, 2.0)) * smoothstep(0.0, 0.25, u_simTime);
      lit += vec3(0.46, 0.72, 0.96) * (pPulse * attenGlow * dirAniso * mix(0.06, 0.11, 1.0 - isOcean) * regionAtten);

      // Topographic Mountain Spine Resonance coupled to S + Rayleigh surface waves (anti-cartoon-ring)
      float mountainSpine = (1.0 - isOcean) * (0.20 + 0.80 * smoothstep(0.16, 0.75, slopeRelief)) * smoothstep(20.0, 850.0, max(0.0, fragElev));
      float sPulse = exp(-pow(abs(effDistG - waveRS) / 0.028, 2.0)) * smoothstep(0.0, 0.40, u_simTime);
      float dtR = dtGlow - (effDistG / max(0.001, u_vS * 0.9194));
      float rayleighCrests = (dtR > 0.0 && dtR < 6.5)
        ? (exp(-dtR * 0.36) * smoothstep(0.0, 0.4, dtR) * (0.5 + 0.5 * cos(dtR * 6.2831853 * clamp(u_dominantFreq, 0.5, 1.8) * 0.52 - 0.6)))
        : 0.0;

      float landWeight = mix(0.07, 0.28, mountainSpine);
      float oceanWeight = mix(0.055, 0.10, smoothstep(-3200.0, -40.0, fragElev));
      float surfaceRes = (sPulse * 0.80 + rayleighCrests * 0.46) * attenGlow * dirAniso * mix(landWeight, oceanWeight, isOcean) * regionAtten;
      lit += mix(vec3(0.84, 0.90, 0.98), vec3(0.56, 0.78, 0.94), isOcean) * surfaceRes;

      // Epicenter rupture ignition: Restrained valley fault trace or serene point pulse
      if (u_isFiniteFault > 0.5) {
        lit += vec3(0.75, 0.86, 0.96) * (seamLine * 0.16 * regionAtten);
      } else {
        float coreIgnite = exp(-pow(rEpiG / 0.024, 2.0)) * smoothstep(0.0, 0.35, u_simTime) * exp(-u_simTime * 0.24);
        lit += vec3(0.80, 0.88, 0.98) * (coreIgnite * 0.24 * regionAtten);
      }

      // Shallow-water tsunami / historical drawback & coastal shoaling swell (1681, Tohoku)
      if (u_hasTsunamiMode > 0.5 && isOcean > 0.5) {
        float shelfShallow = smoothstep(-750.0, -5.0, fragElev);
        float celerityFactor = mix(1.0, 0.46, shelfShallow);
        float tTsunami = effDistG / max(0.001, u_vS * 0.42 * celerityFactor);
        float dtT = dtGlow - tTsunami;
        if (dtT > -0.5 && dtT < 4.5 && shelfShallow > 0.01) {
          float drawbackTrough = exp(-pow((dtT - 0.2) / 0.55, 2.0));
          float shoalingCrest = exp(-pow((dtT - 1.6) / 0.85, 2.0)) * pow(shelfShallow, 1.45);
          lit *= (1.0 - drawbackTrough * 0.30 * shelfShallow);
          lit += vec3(0.36, 0.76, 0.92) * (shoalingCrest * attenGlow * 0.24);
        }
      }
    }

    // Historical Uncertainty: Whisper-subtle ambient mist by default; explicit stippled contours only when requested
    if (u_hasErrorEllipse > 0.5 && u_errorEllipseAxes.x > 0.005) {
      float cosThG = cos(-u_errorEllipseAngle);
      float sinThG = sin(-u_errorEllipseAngle);
      vec2 rotPG = vec2(dEpiG.x * cosThG - dEpiG.y * sinThG, dEpiG.x * sinThG + dEpiG.y * cosThG);
      float ellDistG = length(rotPG / max(vec2(0.001), u_errorEllipseAxes));

      if (u_showIsoseismalContours < 0.5) {
        float softMist = exp(-pow(ellDistG * 0.95, 2.0)) * 0.032;
        lit += vec3(0.76, 0.64, 0.42) * softMist;
      } else {
        float distToEllG = abs(ellDistG - 1.0) * min(u_errorEllipseAxes.x, u_errorEllipseAxes.y);
        float angleAzG = atan(rotPG.y, rotPG.x);
        float stipple95G = step(0.32, fract(angleAzG * 24.0 / 6.2831853));
        float line95G = exp(-pow(distToEllG / 0.0035, 2.0)) * stipple95G;
        lit += vec3(0.78, 0.62, 0.33) * (line95G * 0.25);

        if (u_isoseismalRadii.x > 0.01) {
          float dIso8G = abs(length(rotPG / (u_errorEllipseAxes * (u_isoseismalRadii.x / u_errorEllipseAxes.x))) - 1.0) * u_isoseismalRadii.x;
          float stipple8G = step(0.40, fract(angleAzG * 16.0 / 6.2831853));
          float line8G = exp(-pow(dIso8G / 0.0035, 2.0)) * stipple8G;
          lit += vec3(0.68, 0.58, 0.40) * (line8G * 0.16);
        }
        if (u_isoseismalRadii.y > 0.01) {
          float dIso7G = abs(length(rotPG / (u_errorEllipseAxes * (u_isoseismalRadii.y / u_errorEllipseAxes.x))) - 1.0) * u_isoseismalRadii.y;
          float stipple7G = step(0.45, fract(angleAzG * 12.0 / 6.2831853));
          float line7G = exp(-pow(dIso7G / 0.0035, 2.0)) * stipple7G;
          lit += vec3(0.53, 0.59, 0.67) * (line7G * 0.14);
        }
        if (u_isoseismalRadii.z > 0.01) {
          float dIso6G = abs(length(rotPG / (u_errorEllipseAxes * (u_isoseismalRadii.z / u_errorEllipseAxes.x))) - 1.0) * u_isoseismalRadii.z;
          float stipple6G = step(0.50, fract(angleAzG * 10.0 / 6.2831853));
          float line6G = exp(-pow(dIso6G / 0.0035, 2.0)) * stipple6G;
          lit += vec3(0.45, 0.50, 0.58) * (line6G * 0.10);
        }
      }
    }

    gl_FragColor = vec4(lit, 1.0);
  }
`;

export const REGIONAL_TERRAIN_VERTEX_SHADER = `
  precision highp float;
  attribute vec2 a_uvGlobal;
  uniform sampler2D u_demTexture;
  uniform float u_hMin;
  uniform float u_hMax;
  uniform sampler2D u_globalElevation;
  uniform vec2 u_globalTexSize;
  uniform sampler2D u_koreaMacro;
  uniform float u_hasKoreaMacro;
  uniform float u_globalHMin;
  uniform float u_globalHMax;
  uniform float u_verticalExag;
  uniform float u_metersToUnits;
  uniform vec2 u_texelSize;
  uniform vec2 u_metricSpacing;
  uniform vec2 u_physicalSize;
  uniform float u_regionFade;

  uniform vec2 u_epiPos;
  uniform float u_depthUnits;
  uniform float u_focalDepthKm;
  uniform float u_dominantFreq;
  uniform float u_attenuationQ;
  uniform float u_physicalDisplacement;
  uniform float u_faultStrike;
  uniform float u_radiationDirectivity;
  uniform float u_modeP;
  uniform float u_modeS;
  uniform float u_vP;
  uniform float u_vS;
  uniform float u_vR;
  uniform float u_simTime;
  uniform float u_faultLength;
  uniform float u_ruptureVelocity;
  uniform float u_isFiniteFault;
  uniform vec2 u_errorEllipseAxes;
  uniform float u_errorEllipseAngle;
  uniform vec4 u_isoseismalRadii;
  uniform float u_hasErrorEllipse;

  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vWorldNormal;
  varying vec3 vViewPos;
  varying float vElevation;
  varying float vSlope;
  varying float vRidgeConvexity;
  varying float vIsUnderwater;
  varying vec2 vPhysicalCoords;
  varying float vDisplacementMag;
  varying float vEdgeTaper;
  varying float vRRegion;
  varying float vDistHypo;
  varying float vDtS;
  varying float vDtP;
  varying vec2 vDh;

  float decodeUnorm16RgbaR(vec4 c) {
    return (c.r * 65280.0 + c.g * 255.0) / 65535.0;
  }
  float sampleUnorm16LinearR(sampler2D tex, vec2 uv, vec2 texSize) {
    vec2 texelPos = uv * texSize - 0.5;
    vec2 f = fract(texelPos);
    vec2 baseUv = (floor(texelPos) + 0.5) / texSize;
    vec2 stepUv = 1.0 / texSize;
    float h00 = decodeUnorm16RgbaR(texture2D(tex, baseUv));
    float h10 = decodeUnorm16RgbaR(texture2D(tex, baseUv + vec2(stepUv.x, 0.0)));
    float h01 = decodeUnorm16RgbaR(texture2D(tex, baseUv + vec2(0.0, stepUv.y)));
    float h11 = decodeUnorm16RgbaR(texture2D(tex, baseUv + vec2(stepUv.x, stepUv.y)));
    return mix(mix(h00, h10, f.x), mix(h01, h11, f.x), f.y);
  }

  void main() {
    vUv = uv;
    vec2 demUv = uv;
    vec2 demSize = 1.0 / max(u_texelSize, vec2(1e-6));
    vec2 gTexSize = max(vec2(1024.0, 512.0), u_globalTexSize);

    float normH = sampleUnorm16LinearR(u_demTexture, demUv, demSize);
    float rawMeters = u_hMin + normH * (u_hMax - u_hMin);

    float latG = 90.0 - a_uvGlobal.y * 180.0;
    float lonG = -180.0 + a_uvGlobal.x * 360.0;
    float normGlobal = sampleUnorm16LinearR(u_globalElevation, a_uvGlobal, gTexSize);
    float hGlobal = u_globalHMin + normGlobal * (u_globalHMax - u_globalHMin);
    if (u_hasKoreaMacro > 0.5 && latG >= 33.0 && latG <= 42.0 && lonG >= 124.0 && lonG <= 132.0) {
      float mLat = min(latG - 33.0, 42.0 - latG);
      float mLon = min(lonG - 124.0, 132.0 - lonG);
      float kW = smoothstep(0.0, 0.85, min(mLat, mLon));
      if (kW > 0.001) {
        vec2 kUv = vec2((lonG - 124.0) / 8.0, (42.0 - latG) / 9.0);
        float hK = -3500.0 + sampleUnorm16LinearR(u_koreaMacro, kUv, vec2(960.0, 1080.0)) * 6000.0;
        hGlobal = mix(hGlobal, hK, kW);
      }
    }

    vec2 cUv = (uv - vec2(0.5)) * 2.0;
    float ax = max(1e-5, abs(cUv.x));
    float ay = max(1e-5, abs(cUv.y));
    float rSquircle = pow(max(1e-6, pow(ax, 2.4) + pow(ay, 2.4)), 1.0 / 2.4);
    float edgeTaper = 1.0 - smoothstep(0.58, 0.96, rSquircle);
    float reconciledElevation = mix(hGlobal, rawMeters, edgeTaper);
    vEdgeTaper = edgeTaper;
    vRRegion = edgeTaper;

    vElevation = reconciledElevation;
    vIsUnderwater = (reconciledElevation < 0.0) ? 1.0 : 0.0;

    vec2 tDem = u_texelSize;
    float z00 = sampleUnorm16LinearR(u_demTexture, demUv + vec2(-tDem.x, -tDem.y), demSize);
    float z01 = sampleUnorm16LinearR(u_demTexture, demUv + vec2(-tDem.x, 0.0), demSize);
    float z02 = sampleUnorm16LinearR(u_demTexture, demUv + vec2(-tDem.x, +tDem.y), demSize);
    float z10 = sampleUnorm16LinearR(u_demTexture, demUv + vec2(0.0, -tDem.y), demSize);
    float z12 = sampleUnorm16LinearR(u_demTexture, demUv + vec2(0.0, +tDem.y), demSize);
    float z20 = sampleUnorm16LinearR(u_demTexture, demUv + vec2(+tDem.x, -tDem.y), demSize);
    float z21 = sampleUnorm16LinearR(u_demTexture, demUv + vec2(+tDem.x, 0.0), demSize);
    float z22 = sampleUnorm16LinearR(u_demTexture, demUv + vec2(+tDem.x, +tDem.y), demSize);

    float dH_dx_raw = ((z20 + 2.0 * z21 + z22) - (z00 + 2.0 * z01 + z02)) * (u_hMax - u_hMin) * 0.125;
    float dH_dy_raw = ((z00 + 2.0 * z10 + z20) - (z02 + 2.0 * z12 + z22)) * (u_hMax - u_hMin) * 0.125;

    float dh_dx_dem = (dH_dx_raw * u_verticalExag) / u_metricSpacing.x;
    float dh_dy_dem = (dH_dy_raw * u_verticalExag) / u_metricSpacing.y;

    vec2 gTexel = 1.0 / gTexSize;
    float hL_g = (u_globalHMin + sampleUnorm16LinearR(u_globalElevation, a_uvGlobal - vec2(gTexel.x, 0.0), gTexSize) * (u_globalHMax - u_globalHMin)) * u_verticalExag;
    float hR_g = (u_globalHMin + sampleUnorm16LinearR(u_globalElevation, a_uvGlobal + vec2(gTexel.x, 0.0), gTexSize) * (u_globalHMax - u_globalHMin)) * u_verticalExag;
    float hD_g = (u_globalHMin + sampleUnorm16LinearR(u_globalElevation, a_uvGlobal - vec2(0.0, gTexel.y), gTexSize) * (u_globalHMax - u_globalHMin)) * u_verticalExag;
    float hU_g = (u_globalHMin + sampleUnorm16LinearR(u_globalElevation, a_uvGlobal + vec2(0.0, gTexel.y), gTexSize) * (u_globalHMax - u_globalHMin)) * u_verticalExag;

    float gSpanX = max(1200.0, (2.0 * 360.0 / gTexSize.x) * 111319.0 * max(0.32, cos(radians(latG))));
    float gSpanY = max(1200.0, (2.0 * 180.0 / gTexSize.y) * 110996.0);
    float dh_dx_global = (hR_g - hL_g) / gSpanX;
    float dh_dy_global = (hD_g - hU_g) / gSpanY;

    float dh_dx = mix(dh_dx_global, dh_dx_dem, edgeTaper);
    float dh_dy = mix(dh_dy_global, dh_dy_dem, edgeTaper);
    vDh = vec2(dh_dx, dh_dy);

    vec3 localNormal = normalize(vec3(-dh_dx, 1.0, -dh_dy));
    float slopeRad = acos(clamp(localNormal.y, 0.0, 1.0));
    vSlope = slopeRad * (180.0 / 3.14159265);

    float h_C = normH * (u_hMax - u_hMin) * u_verticalExag;
    float laplacian = ((z10 + z12 + z01 + z21) * (u_hMax - u_hMin) * u_verticalExag - 4.0 * h_C);
    vRidgeConvexity = clamp(-laplacian * 0.15, 0.0, 1.0) * edgeTaper;

    float x_units = (uv.x - 0.5) * u_physicalSize.x;
    float z_units = (0.5 - uv.y) * u_physicalSize.y;
    vPhysicalCoords = vec2(x_units, z_units);

    vec2 dEpi = vec2(x_units - u_epiPos.x, z_units - u_epiPos.y);
    float rEpi = length(dEpi);

    float tSlip = 0.0;
    float effDist = rEpi;
    if (u_isFiniteFault > 0.5 && u_faultLength > 0.001) {
      vec2 uF = vec2(sin(u_faultStrike), -cos(u_faultStrike));
      vec2 nF = vec2(cos(u_faultStrike), sin(u_faultStrike));
      float sFault = dot(dEpi, uF);
      float dFault = dot(dEpi, nF);
      float halfL = 0.5 * u_faultLength;
      float activeHalfL = min(halfL, max(0.12, u_ruptureVelocity * u_simTime * 0.72));
      float strikeStretch = 1.0 + clamp(activeHalfL * 0.58, 0.0, 0.92);
      effDist = sqrt((sFault / strikeStretch) * (sFault / strikeStretch) + dFault * dFault);
    }
    float effHypoDist = sqrt(effDist * effDist + u_depthUnits * u_depthUnits);
    vDistHypo = effHypoDist;

    vec2 dirRadial = (rEpi > 0.0001) ? (dEpi / rEpi) : vec2(1.0, 0.0);
    vec2 dirTransverse = vec2(-dirRadial.y, dirRadial.x);

    float angleEpi = atan(dEpi.y, dEpi.x);
    float radP = 0.5 + 0.5 * cos(2.0 * (angleEpi - u_faultStrike));
    float radS = 0.5 + 0.5 * sin(2.0 * (angleEpi - u_faultStrike));
    float fRadP = mix(1.0, mix(0.45, 1.0, radP), u_radiationDirectivity);
    float fRadS = mix(1.0, mix(0.55, 1.0, radS), u_radiationDirectivity);

    float bathyDepth = max(0.0, -rawMeters);
    float shelfFactor = smoothstep(60.0, 380.0, bathyDepth);
    float localVelP = u_vP * mix(0.80, 1.0, shelfFactor);
    float localVelS = u_vS * mix(0.74, 1.0, shelfFactor);

    float t_P = tSlip + (effHypoDist / max(0.001, localVelP));
    float t_S = tSlip + (effHypoDist / max(0.001, localVelS));
    float dt_P = u_simTime - t_P;
    float dt_S = u_simTime - t_S;
    vDtP = dt_P;
    vDtS = dt_S;

    float omega = 6.2831853 * u_dominantFreq;
    float packetDurP = 1.6 / max(0.4, u_dominantFreq);
    float packetDurS = 2.2 / max(0.4, u_dominantFreq);

    float gammaP = (3.14159 * u_dominantFreq) / (max(40.0, u_attenuationQ) * localVelP);
    float gammaS = (3.14159 * u_dominantFreq) / (max(40.0, u_attenuationQ) * localVelS);
    float geomAtten = 1.0 / sqrt(max(0.06, effHypoDist * 4.5));
    float attenP = geomAtten * exp(-gammaP * effHypoDist * 0.16);
    float attenS = geomAtten * exp(-gammaS * effHypoDist * 0.16);

    float cosEmergence = clamp(u_depthUnits / effHypoDist, 0.12, 1.0);
    float sinEmergence = sqrt(max(0.0, 1.0 - cosEmergence * cosEmergence));

    float pEnv = exp(-dt_P * dt_P / (2.0 * packetDurP * packetDurP * 0.25)) * step(0.0, dt_P);
    float pPhase = sin(omega * dt_P) * pEnv * fRadP * u_modeP;

    float sEnv = exp(-dt_S * dt_S / (2.0 * packetDurS * packetDurS * 0.25)) * step(0.0, dt_S);
    float sPhase = sin(omega * dt_S) * sEnv * fRadS * u_modeS;

    float topoAmp = 1.0 + 0.65 * smoothstep(14.0, 40.0, vSlope) * step(0.0, rawMeters);

    float depthAmpScale = clamp(15.0 / max(5.0, u_focalDepthKm), 0.55, 1.8);
    float baseAmpP = 0.00008 * depthAmpScale * u_physicalDisplacement;
    float baseAmpS = 0.00020 * depthAmpScale * u_physicalDisplacement;

    vec3 vecP = vec3(dirRadial.x * sinEmergence, 0.40 * cosEmergence, dirRadial.y * sinEmergence) * (pPhase * attenP * baseAmpP);
    vec3 vecS = vec3(dirTransverse.x * cosEmergence, 0.60 * sinEmergence, dirTransverse.y * cosEmergence) * (sPhase * attenS * baseAmpS * topoAmp);

    float t_R = (u_depthUnits / max(0.001, localVelS)) + (effDist / max(0.001, u_vR));
    float dt_R = u_simTime - t_R;
    float packetDurR = 3.6 / max(0.3, u_dominantFreq);
    float rEnv = exp(-dt_R * dt_R / (2.0 * packetDurR * packetDurR * 0.35)) * step(0.0, dt_R);
    float geomAttenSurf = 1.0 / pow(max(0.04, effDist * 3.5), 0.25);
    float gammaR = (3.14159 * u_dominantFreq) / (max(30.0, u_attenuationQ * 0.7) * u_vR);
    float attenR = geomAttenSurf * exp(-gammaR * effDist * 0.12);
    float rRadOsc = cos(omega * 0.45 * dt_R) * rEnv * attenR;
    float rVertOsc = +sin(omega * 0.45 * dt_R) * rEnv * attenR;
    float baseAmpR = 0.00028 * depthAmpScale * u_physicalDisplacement;
    vec3 vecR = vec3(dirRadial.x * rRadOsc, 0.65 * rVertOsc, dirRadial.y * rRadOsc) * baseAmpR;

    vec3 disp3D = vecP + vecS + vecR;
    vDisplacementMag = length(disp3D);

    float k_P = omega / max(0.001, localVelP);
    float k_S = omega / max(0.001, localVelS);
    float waveSlopeP = cos(omega * dt_P) * pEnv * attenP * fRadP * u_modeP * baseAmpP * k_P;
    float waveSlopeS = cos(omega * dt_S) * sEnv * attenS * fRadS * u_modeS * baseAmpS * k_S;
    vec2 waveSlopeHoriz = dirRadial * (waveSlopeP + waveSlopeS * 0.30) + dirTransverse * (waveSlopeS * 0.45);

    vec3 perturbedLocalNormal = normalize(localNormal - vec3(waveSlopeHoriz.x * 0.15, 0.0, waveSlopeHoriz.y * 0.15));

    vec3 N = normalize(normal);
    vec3 n0 = vec3(0.0, 1.0, 0.0);
    vec3 vRot = cross(n0, N);
    float cRot = dot(n0, N);
    float kRot = 1.0 / (1.0 + cRot);
    vec3 worldN = perturbedLocalNormal + cross(vRot, perturbedLocalNormal) + cross(vRot, cross(vRot, perturbedLocalNormal)) * kRot;
    worldN = normalize(worldN);
    vWorldNormal = worldN;
    vNormal = normalize((viewMatrix * vec4(worldN, 0.0)).xyz);

    float dispMeters = (reconciledElevation > 0.0) ? reconciledElevation : (reconciledElevation * 0.15);
    float displacedElevation = dispMeters * u_verticalExag * u_metersToUnits;
    vec3 displacedPos = position + normal * displacedElevation + (disp3D * edgeTaper);

    vec4 mvPosition = modelViewMatrix * vec4(displacedPos, 1.0);
    vViewPos = -mvPosition.xyz;
    gl_Position = projectionMatrix * mvPosition;
  }
`;

export const REGIONAL_TERRAIN_FRAGMENT_SHADER = `
  precision highp float;
  uniform vec3 u_lightDir;
  uniform vec3 u_lightColor;
  uniform vec3 u_ambientColor;
  uniform float u_simTime;
  uniform vec2 u_epiPos;
  uniform float u_depthUnits;
  uniform float u_focalDepthKm;
  uniform float u_dominantFreq;
  uniform float u_faultStrike;
  uniform float u_modeP;
  uniform float u_modeS;
  uniform float u_vP;
  uniform float u_vS;
  uniform float u_enableStratum2;
  uniform float u_uncertaintyRadiusUnits;
  uniform float u_faultLength;
  uniform float u_ruptureVelocity;
  uniform float u_isFiniteFault;
  uniform vec2 u_errorEllipseAxes;
  uniform float u_errorEllipseAngle;
  uniform vec4 u_isoseismalRadii;
  uniform float u_hasErrorEllipse;
  uniform float u_probeDistUnits;
  uniform float u_probeCritUnits;
  uniform float u_probeCrossUnits;
  uniform float u_purePhysicalMode;
  uniform float u_regionFade;
  uniform float u_showIsoseismalContours;

  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vWorldNormal;
  varying vec3 vViewPos;
  varying float vElevation;
  varying float vSlope;
  varying float vRidgeConvexity;
  varying float vIsUnderwater;
  varying vec2 vPhysicalCoords;
  varying float vDisplacementMag;
  varying float vEdgeTaper;
  varying float vRRegion;
  varying float vDistHypo;
  varying float vDtS;
  varying float vDtP;
  varying vec2 vDh;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
  }
  ${MONOLITH_SURFACE_GLSL}

  void main() {
    float regionAlpha = vRRegion * smoothstep(-28.0, 6.0, vElevation) * clamp(u_regionFade, 0.0, 1.0);
    if (regionAlpha < 0.01) {
      discard;
    }

    vec3 N = normalize(vNormal);
    vec3 V = normalize(vViewPos);
    vec3 L = normalize((viewMatrix * vec4(u_lightDir, 0.0)).xyz);

    float grain = (hash(vUv * 3600.0) - 0.5) * 0.025;

    float slopeRelief = smoothstep(3.5, 30.0, vSlope);
    float microRelief = smoothstep(1.2, 12.0, vSlope) * 0.14;
    vec3 baseAlbedo = (vElevation < 0.0)
      ? monolithOceanAlbedo(vElevation)
      : monolithLandAlbedo(vElevation, max(slopeRelief, microRelief));
    baseAlbedo = clamp(baseAlbedo + grain, 0.0, 1.0);

    vec3 lit = computeMonolithLighting(baseAlbedo, N, V, L, u_ambientColor, u_lightColor, 0.0);

    float opticalMask = 1.0 - step(0.5, u_purePhysicalMode);
    float crestFactor = smoothstep(14.0, 38.0, vSlope) * (0.35 + 0.65 * vRidgeConvexity);
    float mountainRim = pow(1.0 - max(0.0, dot(N, V)), 2.8) * max(0.0, dot(L, -V) + 0.45);
    lit += vec3(0.65, 0.78, 0.92) * (mountainRim * crestFactor * 0.35 * vEdgeTaper * opticalMask);

    if (opticalMask > 0.5 && u_enableStratum2 > 0.5 && u_simTime > 0.0) {
      float dtS = vDtS;

      if (dtS > -0.15 && dtS < 10.0) {
        float waveFrontPulse = exp(-pow(dtS / 1.0, 2.0)) * smoothstep(-0.15, 0.10, dtS);
        float geomDecay = 1.0 / sqrt(max(0.08, vDistHypo * 3.8));
        float sWaveAmp = waveFrontPulse * geomDecay * u_modeS;

        float ridgeResonance = smoothstep(10.0, 36.0, vSlope) * (0.45 + 0.55 * vRidgeConvexity);

        float surfaceRidgeStream = sWaveAmp * ridgeResonance * 1.65;
        float summitCondensation = smoothstep(900.0, 1750.0, vElevation) * sWaveAmp * 1.2;

        lit += vec3(0.84, 0.88, 0.96) * (surfaceRidgeStream * 0.36 * vEdgeTaper);
        lit += vec3(0.88, 0.94, 1.00) * (summitCondensation * 0.32 * vEdgeTaper);

        float dtP = vDtP;
        float pFrontPulse = exp(-pow(dtP / 0.45, 2.0)) * smoothstep(-0.08, 0.06, dtP) * u_modeP;
        float pTrace = (0.25 + 0.75 * ridgeResonance) * pFrontPulse * geomDecay * 0.42;
        lit += vec3(0.68, 0.86, 1.00) * (pTrace * 0.22 * vEdgeTaper);
      }

      if (u_isFiniteFault > 0.5 && u_faultLength > 0.001) {
        vec2 dEpiR = vPhysicalCoords - u_epiPos;
        vec2 uFR = vec2(sin(u_faultStrike), -cos(u_faultStrike));
        vec2 nFR = vec2(cos(u_faultStrike), sin(u_faultStrike));
        float sFR = dot(dEpiR, uFR);
        float dFR = dot(dEpiR, nFR);
        float hLR = 0.5 * u_faultLength;
        float sCR = clamp(sFR, -hLR, hLR);
        float tRuptR = abs(sCR) / max(0.001, u_ruptureVelocity);
        float dSegR = length(vec2(sFR - sCR, dFR));
        float dtR = u_simTime - tRuptR;
        float faultEnvR = exp(-pow(sFR / max(0.18, 0.30 * u_faultLength), 2.0)) * smoothstep(hLR, hLR * 0.42, abs(sFR));
        float seamR = exp(-pow(dSegR / 0.0036, 2.0)) * smoothstep(-0.08, 0.22, dtR) * exp(-max(0.0, dtR) * 0.14) * faultEnvR * vEdgeTaper;
        lit += vec3(0.75, 0.86, 0.96) * (seamR * 0.24);
      }
    }

    if (u_showIsoseismalContours > 0.5 && u_hasErrorEllipse > 0.5 && u_errorEllipseAxes.x > 0.005) {
      vec2 dEpi = vPhysicalCoords - u_epiPos;
      float cosTh = cos(-u_errorEllipseAngle);
      float sinTh = sin(-u_errorEllipseAngle);
      vec2 rotP = vec2(dEpi.x * cosTh - dEpi.y * sinTh, dEpi.x * sinTh + dEpi.y * cosTh);

      float ellDist = length(rotP / max(vec2(0.001), u_errorEllipseAxes));
      float distToEll = abs(ellDist - 1.0) * min(u_errorEllipseAxes.x, u_errorEllipseAxes.y);
      float angleAz = atan(rotP.y, rotP.x);
      float stipple95 = step(0.32, fract(angleAz * 24.0 / 6.2831853));
      float line95 = exp(-pow(distToEll / 0.0035, 2.0)) * stipple95 * vEdgeTaper;
      lit += vec3(0.78, 0.62, 0.33) * (line95 * 0.22);

      if (u_isoseismalRadii.x > 0.01) {
        float dIso8 = abs(length(rotP / (u_errorEllipseAxes * (u_isoseismalRadii.x / u_errorEllipseAxes.x))) - 1.0) * u_isoseismalRadii.x;
        float stipple8 = step(0.40, fract(angleAz * 16.0 / 6.2831853));
        float line8 = exp(-pow(dIso8 / 0.0035, 2.0)) * stipple8 * vEdgeTaper;
        lit += vec3(0.68, 0.58, 0.40) * (line8 * 0.14);
      }
      if (u_isoseismalRadii.y > 0.01) {
        float dIso7 = abs(length(rotP / (u_errorEllipseAxes * (u_isoseismalRadii.y / u_errorEllipseAxes.x))) - 1.0) * u_isoseismalRadii.y;
        float stipple7 = step(0.45, fract(angleAz * 12.0 / 6.2831853));
        float line7 = exp(-pow(dIso7 / 0.0035, 2.0)) * stipple7 * vEdgeTaper;
        lit += vec3(0.53, 0.59, 0.67) * (line7 * 0.12);
      }
      if (u_isoseismalRadii.z > 0.01) {
        float dIso6 = abs(length(rotP / (u_errorEllipseAxes * (u_isoseismalRadii.z / u_errorEllipseAxes.x))) - 1.0) * u_isoseismalRadii.z;
        float stipple6 = step(0.50, fract(angleAz * 10.0 / 6.2831853));
        float line6 = exp(-pow(dIso6 / 0.0035, 2.0)) * stipple6 * vEdgeTaper;
        lit += vec3(0.45, 0.50, 0.58) * (line6 * 0.09);
      }
    }

    // Geophysics-to-Wavefield T-X Probe Rings (Anti-Game-VFX Stippled Hairlines)
    if (u_probeDistUnits > 0.002 || u_probeCritUnits > 0.002 || u_probeCrossUnits > 0.002) {
      vec2 probeVec = vPhysicalCoords - u_epiPos;
      float probeR = length(probeVec);
      float probeAngle = atan(probeVec.y, probeVec.x);

      if (u_probeDistUnits > 0.002) {
        float stippleProbe = step(0.28, fract(probeAngle * 48.0 / 6.2831853));
        float ringProbe = exp(-pow(abs(probeR - u_probeDistUnits) / 0.0025, 2.0)) * stippleProbe * vEdgeTaper;
        lit += vec3(0.88, 0.86, 0.80) * (ringProbe * 0.24);
      }
      if (u_probeCritUnits > 0.002) {
        float stippleCrit = step(0.48, fract(probeAngle * 24.0 / 6.2831853));
        float ringCrit = exp(-pow(abs(probeR - u_probeCritUnits) / 0.0028, 2.0)) * stippleCrit * vEdgeTaper;
        lit += vec3(0.45, 0.62, 0.78) * (ringCrit * 0.16);
      }
      if (u_probeCrossUnits > 0.002) {
        float stippleCross = step(0.55, fract(probeAngle * 18.0 / 6.2831853));
        float ringCross = exp(-pow(abs(probeR - u_probeCrossUnits) / 0.0028, 2.0)) * stippleCross * vEdgeTaper;
        lit += vec3(0.78, 0.60, 0.30) * (ringCross * 0.18);
      }
    }

    gl_FragColor = vec4(lit, regionAlpha);
  }
`;

export const OCEAN_WATER_VERTEX_SHADER = `
  precision highp float;
  uniform vec2 u_physicalSize;
  uniform vec2 u_epiPos;
  uniform float u_depthUnits;
  uniform float u_simTime;
  uniform float u_dominantFreq;
  uniform float u_physicalDisplacement;
  uniform float u_vP;
  uniform float u_vS;
  uniform sampler2D u_demTexture;
  uniform vec2 u_texelSize;
  uniform float u_hMin;
  uniform float u_hMax;

  varying vec3 vViewPos;
  varying vec3 vNormal;
  varying vec2 vWorldPos;
  varying float vWaterSwell;
  varying float vWaveFrontFactor;
  varying float vShelfFactor;
  varying float vBathyDepth;
  varying float vWaterEdgeTaper;

  float decodeUnorm16RgbaW(vec4 c) {
    return (c.r * 65280.0 + c.g * 255.0) / 65535.0;
  }

  void main() {
    float x_units = (uv.x - 0.5) * u_physicalSize.x;
    float z_units = (0.5 - uv.y) * u_physicalSize.y;
    vWorldPos = vec2(x_units, z_units);

    vec2 demUv = clamp(vec2(x_units / 0.80 + 0.5, 0.5 - z_units / 0.4038), 0.001, 0.999);
    float normH = decodeUnorm16RgbaW(texture2D(u_demTexture, demUv));
    float rawMeters = u_hMin + normH * (u_hMax - u_hMin);
    float bathyDepth = max(0.0, -rawMeters);
    vBathyDepth = bathyDepth;

    float shelfFactor = smoothstep(320.0, 25.0, bathyDepth);
    vShelfFactor = shelfFactor;

    vec2 dEpi = vec2(x_units - u_epiPos.x, z_units - u_epiPos.y);
    float rEpi = length(dEpi);
    float hypoDist = sqrt(rEpi * rEpi + u_depthUnits * u_depthUnits);

    float localVelS = u_vS * mix(0.74, 1.0, smoothstep(60.0, 380.0, bathyDepth));
    float t_wave = hypoDist / localVelS;
    float dt_wave = u_simTime - t_wave;

    float omega = 6.2831853 * u_dominantFreq;
    float packetDur = 2.4 / max(0.4, u_dominantFreq);
    float env = exp(-dt_wave * dt_wave / (2.0 * packetDur * packetDur * 0.25)) * smoothstep(-0.02, 0.04, dt_wave);
    vWaveFrontFactor = env;

    vec2 normWaterUv = (uv - vec2(0.5)) * 2.0;
    float rWaterSuper = pow(pow(abs(normWaterUv.x), 4.0) + pow(abs(normWaterUv.y), 4.0), 0.25);
    float edgeTaper = 1.0 - smoothstep(0.68, 0.96, rWaterSuper);
    vWaterEdgeTaper = edgeTaper;

    float shoalingAmp = mix(1.0, 1.85, shelfFactor);
    float waveSwell = sin(omega * dt_wave) * env * (0.00035 * u_physicalDisplacement * shoalingAmp) / sqrt(max(0.20, hypoDist * 2.5));

    float totalSwell = waveSwell * edgeTaper;
    vWaterSwell = totalSwell;

    vec3 displacedPos = vec3(position.x, position.y + totalSwell, position.z);
    vec4 mvPosition = modelViewMatrix * vec4(displacedPos, 1.0);
    vViewPos = -mvPosition.xyz;

    float waveSlope = cos(omega * dt_wave) * env * 0.45 * shoalingAmp * edgeTaper;
    vec2 dir = (rEpi > 0.0001) ? (dEpi / rEpi) : vec2(0.0);
    vec3 localN = normalize(vec3(-dir.x * waveSlope, 1.0, -dir.y * waveSlope));
    vNormal = normalMatrix * localN;

    gl_Position = projectionMatrix * mvPosition;
  }
`;

export const OCEAN_WATER_FRAGMENT_SHADER = `
  precision highp float;
  uniform vec3 u_lightDir;
  uniform vec3 u_lightColor;
  uniform float u_simTime;
  uniform vec2 u_epiPos;
  uniform float u_dominantFreq;
  uniform float u_enableStratum2;
  uniform float u_purePhysicalMode;
  uniform float u_oceanBloomMode;

  varying vec3 vViewPos;
  varying vec3 vNormal;
  varying vec2 vWorldPos;
  varying float vWaterSwell;
  varying float vWaveFrontFactor;
  varying float vShelfFactor;
  varying float vBathyDepth;
  varying float vWaterEdgeTaper;

  void main() {
    vec3 N = normalize(vNormal);
    vec3 V = normalize(vViewPos);
    vec3 L_view = normalize((viewMatrix * vec4(u_lightDir, 0.0)).xyz);

    float NdotV = max(0.0, dot(N, V));
    float fresnel = pow(1.0 - NdotV, 3.4);
    vec3 H = normalize(L_view + V);
    float spec = pow(max(0.0, dot(N, H)), 90.0);

    float depthAbsorption = exp(-vBathyDepth * 0.00065);
    vec3 abyssalVoid = vec3(0.002, 0.005, 0.010);
    vec3 abyssalTone = vec3(0.012, 0.024, 0.048);
    vec3 deepBathymetryTone = mix(abyssalVoid, abyssalTone, depthAbsorption);
    vec3 shelfTone   = vec3(0.028, 0.075, 0.135);
    vec3 waterTint = mix(deepBathymetryTone, shelfTone, vShelfFactor);

    vec3 crestSilver = u_lightColor * (pow(max(0.0, dot(N, H)), 60.0) * 0.45);
    vec3 finalColor = waterTint + u_lightColor * spec * 0.45 + crestSilver * (vWaveFrontFactor * 0.20);
    float alpha = 0.25 + fresnel * 0.35;

    float boundaryAlpha = smoothstep(0.000, 0.180, vWaterEdgeTaper);
    gl_FragColor = vec4(finalColor, clamp(alpha, 0.0, 0.85) * boundaryAlpha);
  }
`;
