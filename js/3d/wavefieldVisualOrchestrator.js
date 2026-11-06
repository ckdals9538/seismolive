// ============================================================================
// SEISMOLIVE v4.0 — Wavefield Visual Orchestrator (C3: Cinematic Orchestration)
// File: js/3d/wavefieldVisualOrchestrator.js
// ============================================================================

import { SeismicSourceModel } from './seismicSourceModel.js';
import { UniversalWavefieldEngine } from './universalWavefieldEngine.js';

/**
 * Universal Seismic Event State & Wavefield Orchestrator
 * Coordinates source activation, P/S/Rayleigh wavefield propagation,
 * GPU PBR terrain material shader hooks, and cinematic temporal staging.
 */
export class WavefieldVisualOrchestrator {
  /**
   * @param {Object} options
   * @param {THREE.Scene} options.scene
   * @param {Object} [options.eventMetadata]
   */
  constructor(options = {}) {
    this.scene = options.scene || null;
    this.eventMetadata = options.eventMetadata || null;

    // Seismic Event State
    this.currentSource = null;
    this.wavefieldEngine = null;
    this.seismicTime = 0.0;
    this.isPlaying = false;
    this.playbackSpeed = 1.0;

    // Temporal Staging Phases
    // 'DORMANT' -> 'ACTIVATION' -> 'P_WAVE' -> 'S_WAVE' -> 'SURFACE_WAVE' -> 'AFTERMATH'
    this.stagingPhase = 'DORMANT';

    // Subscribed listeners (Living Typography, Audio Synthesizer)
    this.subscribers = new Set();

    // Reusable Pre-allocated GPU Uniforms (Zero Allocation Render Loop)
    this.uniforms = {
      u_seismicTime: { value: 0.0 },
      u_vP_units: { value: 0.0 },
      u_vS_units: { value: 0.0 },
      u_vR_units: { value: 0.0 },
      u_hypoPosUnits: { value: new Float32Array([0.0, -0.05, 0.0]) },
      u_focalMech: { value: new Float32Array([0.0, 0.0, 0.0, 1.0]) }, // [strikeRad, dipRad, rakeRad, isVerified]
      u_artisticScale: { value: 1.8 },
      u_activeWavefield: { value: 1.0 }
    };

    // Staging parameters
    this.metersToUnits = 0.80 / 131420.0; // Standard SEISMOLIVE world unit scale

    if (this.eventMetadata) {
      this.configureEvent(this.eventMetadata);
    }
  }

  /**
   * Configure seismic source and wavefield engine for an event
   */
  configureEvent(eventMeta) {
    this.eventMetadata = eventMeta;
    const eventId = eventMeta.eventId || eventMeta.id || 'hist_1681_0626';

    // Build authentic source representation
    this.currentSource = SeismicSourceModel.createBenchmarkSource(eventId);
    this.wavefieldEngine = new UniversalWavefieldEngine(this.currentSource, {
      artisticGain: 1.8
    });

    // Reset timeline
    this.seismicTime = 0.0;
    this.stagingPhase = 'ACTIVATION';

    // Update GPU uniforms
    this.uniforms.u_seismicTime.value = 0.0;
    this.uniforms.u_vP_units.value = this.wavefieldEngine.vP * this.metersToUnits;
    this.uniforms.u_vS_units.value = this.wavefieldEngine.vS * this.metersToUnits;
    this.uniforms.u_vR_units.value = this.wavefieldEngine.vR * this.metersToUnits;

    const hypoDepthUnits = (this.currentSource.hypocenter.depthKm * 1000.0) * this.metersToUnits;
    this.uniforms.u_hypoPosUnits.value[0] = 0.0;
    this.uniforms.u_hypoPosUnits.value[1] = -hypoDepthUnits;
    this.uniforms.u_hypoPosUnits.value[2] = 0.0;

    if (this.currentSource.focalMechanism && this.currentSource.focalMechanism.isVerified) {
      this.uniforms.u_focalMech.value[0] = (this.currentSource.focalMechanism.strikeDeg * Math.PI) / 180.0;
      this.uniforms.u_focalMech.value[1] = (this.currentSource.focalMechanism.dipDeg * Math.PI) / 180.0;
      this.uniforms.u_focalMech.value[2] = (this.currentSource.focalMechanism.rakeDeg * Math.PI) / 180.0;
      this.uniforms.u_focalMech.value[3] = 1.0; // Verified
    } else {
      // Historical or unverified event: Double-couple disabled, isotropic radial mode
      this.uniforms.u_focalMech.value[0] = 0.0;
      this.uniforms.u_focalMech.value[1] = 0.0;
      this.uniforms.u_focalMech.value[2] = 0.0;
      this.uniforms.u_focalMech.value[3] = 0.0; // Unverified
    }

    this.notifySubscribers('EVENT_CONFIGURED', {
      eventId,
      sourceType: this.currentSource.sourceType,
      velocityModel: this.wavefieldEngine.velocityModel.name,
      depthKm: this.currentSource.hypocenter.depthKm
    });
  }

  /**
   * Attach wavefield shaders to a Three.js MeshStandardMaterial
   * Uses onBeforeCompile to inject physical 3D vector displacement and stress-normal refraction
   */
  attachTerrainShader(material) {
    if (!material) return;

    material.onBeforeCompile = (shader) => {
      // Inject uniforms
      shader.uniforms.u_seismicTime = this.uniforms.u_seismicTime;
      shader.uniforms.u_vP_units = this.uniforms.u_vP_units;
      shader.uniforms.u_vS_units = this.uniforms.u_vS_units;
      shader.uniforms.u_vR_units = this.uniforms.u_vR_units;
      shader.uniforms.u_hypoPosUnits = this.uniforms.u_hypoPosUnits;
      shader.uniforms.u_focalMech = this.uniforms.u_focalMech;
      shader.uniforms.u_artisticScale = this.uniforms.u_artisticScale;
      shader.uniforms.u_activeWavefield = this.uniforms.u_activeWavefield;

      // 1. Vertex Shader: 3D Vector Wavefield Displacement
      shader.vertexShader = shader.vertexShader.replace(
        '#include <common>',
        `
        #include <common>
        uniform float u_seismicTime;
        uniform float u_vP_units;
        uniform float u_vS_units;
        uniform float u_vR_units;
        uniform vec3  u_hypoPosUnits;
        uniform vec4  u_focalMech;
        uniform float u_artisticScale;
        uniform float u_activeWavefield;
        varying vec3  v_waveNormalShear;
        `
      );

      shader.vertexShader = shader.vertexShader.replace(
        '#include <begin_vertex>',
        `
        #include <begin_vertex>
        if (u_activeWavefield > 0.5 && u_seismicTime > 0.0) {
          // Distance from hypocenter in Three.js units
          vec3 toVertex = position - u_hypoPosUnits;
          float dist3D = length(toVertex);
          vec3 k_hat = toVertex / max(0.0001, dist3D);

          float dist2D = length(position.xz - u_hypoPosUnits.xz);
          vec3 r_hat_h = vec3(toVertex.x / max(0.0001, dist2D), 0.0, toVertex.z / max(0.0001, dist2D));

          // Eikonal travel times
          float tP = dist3D / max(0.001, u_vP_units);
          float tS = dist3D / max(0.001, u_vS_units);
          float tR = (abs(u_hypoPosUnits.y) / max(0.001, u_vS_units)) + (dist2D / max(0.001, u_vR_units));

          // Singularity-free spreading
          float r0 = 0.015;
          float spreadBody = 1.0 / sqrt(dist3D * dist3D + r0 * r0);
          float spreadSurf = 1.0 / pow(dist2D * dist2D + r0 * r0 * 1.5, 0.25);

          // Radiation modulation
          float radFactor = 1.0;
          if (u_focalMech.w > 0.5) {
            float az = atan(toVertex.x, toVertex.z);
            radFactor = 0.4 + 0.6 * abs(sin(2.0 * (az - u_focalMech.x)));
          }

          // 1. P-Wave (Longitudinal)
          float dtP = u_seismicTime - tP;
          vec3 uP = vec3(0.0);
          if (dtP > 0.0 && dtP < 3.0) {
            float envP = sin(clamp(dtP * 3.14159 / 3.0, 0.0, 3.14159)) * exp(-dtP * 0.8);
            float oscP = sin(dtP * 6.28318 * 1.6);
            uP = k_hat * (oscP * envP * spreadBody * radFactor * 0.0004);
          }

          // 2. S-Wave (Transverse Shear)
          float dtS = u_seismicTime - tS;
          vec3 uS = vec3(0.0);
          if (dtS > 0.0 && dtS < 4.5) {
            float envS = sin(clamp(dtS * 3.14159 / 4.5, 0.0, 3.14159)) * exp(-dtS * 0.5);
            float oscS = sin(dtS * 6.28318 * 0.9 + 1.5707);
            vec3 transDir = cross(vec3(0.0, 1.0, 0.0), k_hat);
            uS = transDir * (oscS * envS * spreadBody * radFactor * 0.0012);
          }

          // 3. Rayleigh Wave (Retrograde Elliptical Ground Roll)
          float dtR = u_seismicTime - tR;
          vec3 uR = vec3(0.0);
          if (dtR > 0.0 && dtR < 6.0) {
            float envR = sin(clamp(dtR * 3.14159 / 6.0, 0.0, 3.14159)) * exp(-dtR * 0.35);
            float radComp = cos(dtR * 6.28318 * 0.45);
            float vertComp = -sin(dtR * 6.28318 * 0.45);
            uR = (r_hat_h * radComp + vec3(0.0, 1.47 * vertComp, 0.0)) * (envR * spreadSurf * 0.0022);
          }

          vec3 totalDisp = (uP + uS + uR) * u_artisticScale;
          transformed += totalDisp;
          v_waveNormalShear = totalDisp * 40.0;
        } else {
          v_waveNormalShear = vec3(0.0);
        }
        `
      );

      // 2. Fragment Shader: Subtle Stress Normal Distortion (No game VFX)
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <common>',
        `
        #include <common>
        varying vec3 v_waveNormalShear;
        `
      );

      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <normal_fragment_begin>',
        `
        #include <normal_fragment_begin>
        normal = normalize(normal + v_waveNormalShear);
        `
      );
    };

    material.needsUpdate = true;
  }

  /**
   * Update per-frame wavefield timeline (Zero Object Allocation)
   * @param {number} deltaSec - Frame delta in seconds
   */
  update(deltaSec) {
    if (!this.isPlaying || !this.wavefieldEngine) return;

    this.seismicTime += deltaSec * this.playbackSpeed;
    this.uniforms.u_seismicTime.value = this.seismicTime;

    // Update temporal staging phase
    const t = this.seismicTime;
    if (t < 0.2) {
      this.stagingPhase = 'ACTIVATION';
    } else if (t < 4.0) {
      this.stagingPhase = 'P_WAVE';
    } else if (t < 10.0) {
      this.stagingPhase = 'S_WAVE';
    } else if (t < 25.0) {
      this.stagingPhase = 'SURFACE_WAVE';
    } else {
      this.stagingPhase = 'AFTERMATH';
    }

    // Broadcast frame pulse to subscribed components (Living Typography & Audio)
    if (this.subscribers.size > 0) {
      this.notifySubscribers('FRAME_PULSE', {
        seismicTime: this.seismicTime,
        stagingPhase: this.stagingPhase
      });
    }
  }

  /**
   * Subscription interface for Living Typography and Audio Synthesizer
   */
  subscribe(callback) {
    this.subscribers.add(callback);
    return () => this.subscribers.delete(callback);
  }

  notifySubscribers(eventType, payload) {
    for (const callback of this.subscribers) {
      try {
        callback(eventType, payload);
      } catch (err) {
        console.warn('[WavefieldVisualOrchestrator] Subscriber error:', err);
      }
    }
  }

  play() {
    this.isPlaying = true;
  }

  pause() {
    this.isPlaying = false;
  }

  restart() {
    this.seismicTime = 0.0;
    this.uniforms.u_seismicTime.value = 0.0;
    this.stagingPhase = 'ACTIVATION';
    this.play();
  }
}
