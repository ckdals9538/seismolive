// ============================================================================
// SEISMOLIVE v4.0 — Nocturnal Monolith & Seismic Wavefield GLSL Shaders
// Module: js/3d/shaders/SeismicTerrainShaders.js
//
// Extracted from js/main.js in Stage R3 so inline WebGL shaders are modularly
// maintainable and independently testable.
// Strictly preserves GEMINI.md Rule 2 (Anti-Game-VFX) and Nocturnal Monolith palette.
// ============================================================================

export const MONOLITH_SURFACE_GLSL = `
  vec3 monolithOceanAlbedo(float elev) {
    float depthAbsorption = exp(elev * 0.00045);
    float shelfT = clamp((elev + 3200.0) / 3200.0, 0.0, 1.0);
    vec3 deepAbyss = mix(vec3(0.002, 0.005, 0.010), vec3(0.012, 0.024, 0.048), depthAbsorption);
    return mix(deepAbyss, vec3(0.028, 0.075, 0.135), shelfT);
  }
  vec3 monolithLandAlbedo(float elev, float slopeRelief) {
    float elevNorm = clamp((elev - 80.0) / 1600.0, 0.0, 1.0);
    float valleyCavity = mix(0.84, 1.0, smoothstep(0.0, 0.30, slopeRelief + elevNorm * 0.35));
    float relief = max(slopeRelief, elevNorm);
    vec3 c = mix(vec3(0.055, 0.075, 0.110), vec3(0.165, 0.200, 0.255), relief * 0.85);
    c = mix(c, vec3(0.240, 0.290, 0.360), pow(relief, 2.0) * 0.75);
    return c * valleyCavity;
  }
  vec3 computeMonolithLighting(vec3 albedo, vec3 N, vec3 V, vec3 L, vec3 ambientCol, vec3 lightCol, float isOcean) {
    float NdotL = dot(N, L);
    float wrapDiffuse = pow(max(0.0, (NdotL + 0.35) / 1.35), 1.45);
    vec3 H = normalize(L + V);
    float NdotH = max(0.0, dot(N, H));
    float spec = pow(NdotH, 42.0) * isOcean * 0.52;
    float rim = pow(1.0 - max(0.0, dot(N, V)), 2.8) * max(0.0, dot(L, -V) + 0.35);
    vec3 lit = albedo * (ambientCol + lightCol * (wrapDiffuse * 1.45)) + lightCol * spec;
    vec3 atmosphereColor = vec3(0.24, 0.44, 0.76);
    lit += atmosphereColor * (rim * 0.32);
    return lit;
  }
`;

export const TIER0_GLOBE_VERTEX_SHADER = `
  precision highp float;
  uniform sampler2D u_globalElevation;
  uniform float u_globalHMin;
  uniform float u_globalHMax;
  uniform float u_metersToUnits;
  uniform float u_verticalExag;
  uniform vec2 u_regionHalfSize;
  uniform float u_regionActive;

  varying vec3 vWorldNormal;
  varying vec3 vViewPos;
  varying vec2 vUv;
  varying float vElevation;
  varying vec3 vLocalPos;

  void main() {
    vUv = uv;
    vLocalPos = position;
    float normElev = texture2D(u_globalElevation, uv).r;
    float rawMeters = u_globalHMin + normElev * (u_globalHMax - u_globalHMin);

    vElevation = rawMeters;

    float dispMeters = (rawMeters > 0.0) ? rawMeters : (rawMeters * 0.15);
    float finalDisp = dispMeters * u_metersToUnits * u_verticalExag;
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
  uniform vec2 u_regionCenter;
  uniform vec2 u_regionHalfSize;
  uniform float u_regionActive;
  uniform vec2 u_errorEllipseAxes;
  uniform float u_errorEllipseAngle;
  uniform vec4 u_isoseismalRadii;
  uniform float u_hasErrorEllipse;

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

    vec2 texel = vec2(1.0 / 2048.0, 1.0 / 1024.0);
    float hL = u_globalHMin + texture2D(u_globalElevation, vUv - vec2(texel.x, 0.0)).r * (u_globalHMax - u_globalHMin);
    float hR = u_globalHMin + texture2D(u_globalElevation, vUv + vec2(texel.x, 0.0)).r * (u_globalHMax - u_globalHMin);
    float hD = u_globalHMin + texture2D(u_globalElevation, vUv - vec2(0.0, texel.y)).r * (u_globalHMax - u_globalHMin);
    float hU = u_globalHMin + texture2D(u_globalElevation, vUv + vec2(0.0, texel.y)).r * (u_globalHMax - u_globalHMin);

    float dh_dx = (hR - hL) / 38000.0;
    float dh_dy = (hD - hU) / 38000.0;

    vec3 upRef = (abs(N.z) < 0.90) ? vec3(0.0, 0.0, 1.0) : vec3(0.0, 1.0, 0.0);
    vec3 tangent = normalize(cross(upRef, N));
    vec3 bitangent = normalize(cross(N, tangent));

    vec3 perturbedWorldN = normalize(N - tangent * (dh_dx * 2.2) - bitangent * (dh_dy * 2.2));

    float normCenter = texture2D(u_globalElevation, vUv).r;
    float fragElev = u_globalHMin + normCenter * (u_globalHMax - u_globalHMin);

    vec3 baseColor;
    float isOcean = step(fragElev, 0.0);

    float lat = 90.0 - vUv.y * 180.0;
    float lon = -180.0 + vUv.x * 360.0;
    float phi0Rad = radians(u_regionCenter.x);
    float dLatM = (lat - u_regionCenter.x) * 110996.0;
    float dLonDeg = lon - u_regionCenter.y;
    if (dLonDeg > 180.0) dLonDeg -= 360.0;
    if (dLonDeg < -180.0) dLonDeg += 360.0;
    float dLonM = dLonDeg * 111319.0 * cos(phi0Rad);
    vec2 dEpiG = vec2(dLonM * 0.00001, dLatM * 0.00001);

    if (u_regionActive > 0.5 && isOcean < 0.5) {
      float uNormX = abs(dEpiG.x) / max(0.0001, u_regionHalfSize.x);
      float uNormY = abs(dEpiG.y) / max(0.0001, u_regionHalfSize.y);
      float inBox = max(uNormX, uNormY);
      if (inBox < 0.86) {
        discard;
      }
    }

    if (fragElev < 0.0) {
      baseColor = monolithOceanAlbedo(fragElev);
    } else {
      float slopeMag = length(vec2(dh_dx, dh_dy));
      float slopeRelief = smoothstep(0.005, 0.032, slopeMag);
      baseColor = monolithLandAlbedo(fragElev, slopeRelief);
    }

    if (u_simTime > 0.0) {
      float rEpiG = length(dEpiG);
      float tSlipG = 0.0;
      float effDistG = rEpiG;
      if (u_isFiniteFault > 0.5 && u_faultLength > 0.001) {
        vec2 uFG = vec2(sin(u_faultStrike), cos(u_faultStrike));
        vec2 nFG = vec2(cos(u_faultStrike), -sin(u_faultStrike));
        float sFaultG = dot(dEpiG, uFG);
        float dFaultG = dot(dEpiG, nFG);
        float halfLG = 0.5 * u_faultLength;
        float sClampedG = clamp(sFaultG, -halfLG, halfLG);
        tSlipG = abs(sClampedG) / max(0.001, u_ruptureVelocity);
        effDistG = length(vec2(sFaultG - sClampedG, dFaultG));
      }

      float dtG = u_simTime - tSlipG;
      float waveRS = (dtG > 0.0) ? (u_vS * dtG) : -1.0;
      float distToFrontG = abs(effDistG - waveRS);
      if (distToFrontG < 0.075 && dtG > 0.0) {
        float waveEnvG = exp(-pow(distToFrontG / 0.038, 2.0)) * smoothstep(-0.02, 0.04, dtG - effDistG / u_vS);
        float attenG = 1.0 / sqrt(max(0.12, effDistG * 3.5));
        vec2 waveDirG = (rEpiG > 0.0001) ? normalize(dEpiG) : vec2(0.0);

        float wavePhase = (u_simTime - effDistG / u_vS) * 6.2831853 * u_dominantFreq;
        float tiltMag = sin(wavePhase * 2.0) * waveEnvG * attenG * (isOcean > 0.5 ? 0.32 : 0.22);
        vec3 waveTiltVec = normalize(tangent * waveDirG.x + bitangent * waveDirG.y);
        perturbedWorldN = normalize(perturbedWorldN + waveTiltVec * tiltMag);
      }
    }

    vec3 perturbedN_view = normalize((viewMatrix * vec4(perturbedWorldN, 0.0)).xyz);
    vec3 lit = computeMonolithLighting(baseColor, perturbedN_view, V, L_view, u_ambientColor, u_lightColor, isOcean);

    if (u_hasErrorEllipse > 0.5 && u_errorEllipseAxes.x > 0.005) {
      float cosThG = cos(-u_errorEllipseAngle);
      float sinThG = sin(-u_errorEllipseAngle);
      vec2 rotPG = vec2(dEpiG.x * cosThG - dEpiG.y * sinThG, dEpiG.x * sinThG + dEpiG.y * cosThG);

      float ellDistG = length(rotPG / max(vec2(0.001), u_errorEllipseAxes));
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
  uniform float u_globalHMin;
  uniform float u_globalHMax;
  uniform float u_verticalExag;
  uniform float u_metersToUnits;
  uniform vec2 u_texelSize;
  uniform vec2 u_metricSpacing;
  uniform vec2 u_physicalSize;

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

  void main() {
    vUv = uv;
    vec2 demUv = uv;

    float normH = texture2D(u_demTexture, demUv).r;
    float rawMeters = u_hMin + normH * (u_hMax - u_hMin);

    float normGlobal = texture2D(u_globalElevation, a_uvGlobal).r;
    float hGlobal = u_globalHMin + normGlobal * (u_globalHMax - u_globalHMin);

    float edgeDist = min(min(uv.x, 1.0 - uv.x), min(uv.y, 1.0 - uv.y));
    float edgeTaper = smoothstep(0.002, 0.100, edgeDist);
    float reconciledElevation = mix(hGlobal, rawMeters, edgeTaper);
    vEdgeTaper = edgeTaper;
    vRRegion = edgeDist;

    vElevation = reconciledElevation;
    vIsUnderwater = (reconciledElevation < 0.0) ? 1.0 : 0.0;

    vec2 tDem = u_texelSize;
    float z00 = texture2D(u_demTexture, demUv + vec2(-tDem.x, -tDem.y)).r;
    float z01 = texture2D(u_demTexture, demUv + vec2(-tDem.x, 0.0)).r;
    float z02 = texture2D(u_demTexture, demUv + vec2(-tDem.x, +tDem.y)).r;
    float z10 = texture2D(u_demTexture, demUv + vec2(0.0, -tDem.y)).r;
    float z12 = texture2D(u_demTexture, demUv + vec2(0.0, +tDem.y)).r;
    float z20 = texture2D(u_demTexture, demUv + vec2(+tDem.x, -tDem.y)).r;
    float z21 = texture2D(u_demTexture, demUv + vec2(+tDem.x, 0.0)).r;
    float z22 = texture2D(u_demTexture, demUv + vec2(+tDem.x, +tDem.y)).r;

    float dH_dx_raw = ((z20 + 2.0 * z21 + z22) - (z00 + 2.0 * z01 + z02)) * (u_hMax - u_hMin) * 0.125;
    float dH_dy_raw = ((z00 + 2.0 * z10 + z20) - (z02 + 2.0 * z12 + z22)) * (u_hMax - u_hMin) * 0.125;

    float dh_dx_dem = (dH_dx_raw * u_verticalExag) / u_metricSpacing.x;
    float dh_dy_dem = (dH_dy_raw * u_verticalExag) / u_metricSpacing.y;

    vec2 gTexel = vec2(1.0 / 2048.0, 1.0 / 1024.0);
    float hL_g = (u_globalHMin + texture2D(u_globalElevation, a_uvGlobal - vec2(gTexel.x, 0.0)).r * (u_globalHMax - u_globalHMin)) * u_verticalExag;
    float hR_g = (u_globalHMin + texture2D(u_globalElevation, a_uvGlobal + vec2(gTexel.x, 0.0)).r * (u_globalHMax - u_globalHMin)) * u_verticalExag;
    float hD_g = (u_globalHMin + texture2D(u_globalElevation, a_uvGlobal - vec2(0.0, gTexel.y)).r * (u_globalHMax - u_globalHMin)) * u_verticalExag;
    float hU_g = (u_globalHMin + texture2D(u_globalElevation, a_uvGlobal + vec2(0.0, gTexel.y)).r * (u_globalHMax - u_globalHMin)) * u_verticalExag;

    float dh_dx_global = (hR_g - hL_g) / 38000.0;
    float dh_dy_global = (hD_g - hU_g) / 38000.0;

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
      float sClamped = clamp(sFault, -halfL, halfL);
      tSlip = abs(sClamped) / max(0.001, u_ruptureVelocity);
      effDist = length(vec2(sFault - sClamped, dFault));
    }
    float effHypoDist = sqrt(effDist * effDist + u_depthUnits * u_depthUnits);
    vDistHypo = effHypoDist;

    vec2 dirRadial = (rEpi > 0.0001) ? (dEpi / rEpi) : vec2(1.0, 0.0);
    vec2 dirTransverse = vec2(-dirRadial.y, dirRadial.x);

    float angleEpi = atan(dEpi.y, dEpi.x);
    float radP = abs(sin(2.0 * (angleEpi - u_faultStrike)));
    float radS = abs(cos(2.0 * (angleEpi - u_faultStrike)));
    float fRadP = mix(1.0, radP, u_radiationDirectivity);
    float fRadS = mix(1.0, radS, u_radiationDirectivity);

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
    if (vElevation < -10.0) {
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

        float surfaceRidgeStream = sWaveAmp * ridgeResonance * 1.5;
        float summitCondensation = smoothstep(950.0, 1800.0, vElevation) * sWaveAmp * 1.1;

        lit += vec3(0.68, 0.82, 0.96) * (surfaceRidgeStream * 0.35 * vEdgeTaper);
        lit += vec3(0.85, 0.94, 1.00) * (summitCondensation * 0.30 * vEdgeTaper);

        float dtP = vDtP;
        float pFrontPulse = exp(-pow(dtP / 0.45, 2.0)) * smoothstep(-0.08, 0.06, dtP) * u_modeP;
        float pTrace = ridgeResonance * pFrontPulse * geomDecay * 0.35;
        lit += vec3(0.70, 0.88, 1.00) * (pTrace * 0.18 * vEdgeTaper);
      }
    }

    if (u_hasErrorEllipse > 0.5 && u_errorEllipseAxes.x > 0.005) {
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

    gl_FragColor = vec4(lit, 1.0);
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

  void main() {
    float x_units = (uv.x - 0.5) * u_physicalSize.x;
    float z_units = (0.5 - uv.y) * u_physicalSize.y;
    vWorldPos = vec2(x_units, z_units);

    vec2 demUv = clamp(vec2(x_units / 0.80 + 0.5, 0.5 - z_units / 0.4038), 0.001, 0.999);
    float normH = texture2D(u_demTexture, demUv).r;
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
