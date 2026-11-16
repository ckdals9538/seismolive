// ============================================================================
// SEISMOLIVE v4.0 — Global-to-Personal Spatial Continuity Camera Controller
// File: js/response/GlobalLocalCameraTransition.js
//
// Smooth, non-linear, staged spatial transition from global Earth orbit
// down to Hanyang University Engineering Building 1 (제1공학관) local space.
//
// Directives:
//   - Staged spatial resolution transition (not a jump cut or cartoon zoom).
//   - WGS84 geographic alignment preserved.
//   - User manual interaction immediately yields control.
//   - Cancellation and return-to-global capability.
// ============================================================================

import * as THREE from '../lib/three.module.js';

export const CAMERA_STAGES = Object.freeze({
  GLOBAL_ORBIT: 'GLOBAL_ORBIT',           // Cosmic view of Earth (r ~ 140 units)
  REGIONAL_APPROACH: 'REGIONAL_APPROACH', // Korean peninsula & Seoul metropolitan scale
  CAMPUS_OVERVIEW: 'CAMPUS_OVERVIEW',     // Aerial view: Bldg 212, evacuation paths, Stadium
  BUILDING_INSPECTION: 'BUILDING_INSPECTION', // Axonometric close-up of Bldg 212 & selected 3F
  PERSONAL_LOCATION: 'PERSONAL_LOCATION'  // Immersive close-up on user 3F Room 301 & egress core
});

export const TRANSITION_STATUS = Object.freeze({
  IDLE: 'IDLE',
  TRANSITIONING: 'TRANSITIONING',
  USER_OVERRIDE: 'USER_OVERRIDE',
  COMPLETED: 'COMPLETED'
});

export class GlobalLocalCameraTransition {
  /**
   * @param {Object} config
   * @param {THREE.PerspectiveCamera} config.camera
   * @param {Object} [config.controls] - OrbitControls instance
   * @param {THREE.Vector3} [config.anchorWorldPosition] - Local tangent anchor origin in world units
   */
  constructor(config = {}) {
    if (!config.camera) {
      throw new Error('[GlobalLocalCameraTransition] Camera instance is required.');
    }

    this.camera = config.camera;
    this.controls = config.controls || null;
    this.anchorWorldPos = config.anchorWorldPosition || new THREE.Vector3(0, 0, 0);

    this.status = TRANSITION_STATUS.IDLE;
    this.currentStage = CAMERA_STAGES.GLOBAL_ORBIT;

    // Viewpoint Definitions (Positions and LookAt Targets)
    // Note: Coordinates in metric/scaled visual space
    this.viewpoints = Object.freeze({
      [CAMERA_STAGES.GLOBAL_ORBIT]: {
        position: new THREE.Vector3(10.0, 140.0, 40.0),
        target: new THREE.Vector3(0.0, 0.0, 0.0),
        near: 0.1,
        far: 2000.0,
        description: '글로벌 우주 궤도 (전 지구적 지진학적 맥락)'
      },
      [CAMERA_STAGES.REGIONAL_APPROACH]: {
        position: new THREE.Vector3(1.2, 8.5, 3.0),
        target: new THREE.Vector3(0.0, 0.0, 0.0),
        near: 0.05,
        far: 1500.0,
        description: '한반도 및 수도권 광역 접근 궤도'
      },
      [CAMERA_STAGES.CAMPUS_OVERVIEW]: {
        position: new THREE.Vector3(230.0, 240.0, -90.0),
        target: new THREE.Vector3(145.0, -8.0, 80.0),
        near: 0.1,
        far: 1500.0,
        description: '캠퍼스 전체 조망: 제1공학관, 대피 경로 및 대운동장'
      },
      [CAMERA_STAGES.BUILDING_INSPECTION]: {
        position: new THREE.Vector3(135.0, 68.0, -12.0),
        target: new THREE.Vector3(50.0, 9.0, -75.0),
        near: 0.1,
        far: 1000.0,
        description: '제1공학관 엑소노메트릭 상세: 3층 피난 평면 및 수직 코어'
      },
      [CAMERA_STAGES.PERSONAL_LOCATION]: {
        position: new THREE.Vector3(88.0, 32.0, -35.0),
        target: new THREE.Vector3(68.0, 9.2, -45.0),
        near: 0.05,
        far: 800.0,
        description: '개인화 위치 상세: 제1공학관 3층 301호 및 비상계단 진입부'
      }
    });

    // Interpolation state
    this.anim = {
      startTime: 0,
      duration: 3.5, // seconds
      startPos: new THREE.Vector3(),
      targetPos: new THREE.Vector3(),
      startLookAt: new THREE.Vector3(),
      targetLookAt: new THREE.Vector3(),
      currentLookAt: new THREE.Vector3(),
      startNear: 0.1,
      targetNear: 0.1,
      startFar: 2000.0,
      targetFar: 1000.0,
      onComplete: null,
      onInterrupt: null
    };

    if (this.controls) {
      this.attachControlsListener();
    }
  }

  /**
   * Listen for user manual intervention. If user drags or scrolls, auto-transition cancels immediately.
   */
  attachControlsListener() {
    if (this.controls && this.controls.addEventListener) {
      this.controls.addEventListener('start', () => {
        if (this.status === TRANSITION_STATUS.TRANSITIONING) {
          this.cancelTransition('ORBIT_CONTROLS_START');
        }
      });
    }
  }

  /**
   * Attach direct DOM interrupt listeners to canvas or container.
   *
   * @param {HTMLElement} domElement
   */
  attachUserInterruptListeners(domElement) {
    if (!domElement || !domElement.addEventListener) return;

    const onInterrupt = () => {
      if (this.status === TRANSITION_STATUS.TRANSITIONING) {
        this.cancelTransition('USER_DIRECT_INPUT');
      }
    };

    domElement.addEventListener('pointerdown', onInterrupt, { passive: true });
    domElement.addEventListener('wheel', onInterrupt, { passive: true });
    domElement.addEventListener('touchstart', onInterrupt, { passive: true });
  }

  /**
   * Cancel ongoing camera transition.
   *
   * @param {string} reason
   */
  cancelTransition(reason = 'USER_OVERRIDE') {
    if (this.status !== TRANSITION_STATUS.TRANSITIONING) return;

    this.status = TRANSITION_STATUS.USER_OVERRIDE;
    if (typeof this.anim.onInterrupt === 'function') {
      this.anim.onInterrupt(reason, this.currentStage);
    }
  }

  /**
   * Initiate staged transition to a target viewpoint.
   *
   * @param {string} targetStage - CAMERA_STAGES key
   * @param {number} [durationSeconds=3.5]
   * @param {Function} [callback]
   */
  transitionTo(targetStage, durationSeconds = 3.5, callback = null) {
    if (!this.viewpoints[targetStage]) {
      throw new Error(`[GlobalLocalCameraTransition] Unknown target stage: ${targetStage}`);
    }

    const vp = this.viewpoints[targetStage];
    this.status = TRANSITION_STATUS.TRANSITIONING;
    this.currentStage = targetStage;

    this.anim.startTime = performance.now();
    this.anim.duration = durationSeconds;
    this.anim.startPos.copy(this.camera.position);
    this.anim.targetPos.copy(vp.position);

    if (this.controls) {
      this.anim.startLookAt.copy(this.controls.target);
    } else {
      this.anim.startLookAt.copy(this.anim.currentLookAt);
    }
    this.anim.targetLookAt.copy(vp.target);

    this.anim.startNear = this.camera.near;
    this.anim.targetNear = vp.near;
    this.anim.startFar = this.camera.far;
    this.anim.targetFar = vp.far;

    this.anim.onComplete = callback;
  }

  /**
   * Return smoothly to Global Orbit view.
   */
  returnToGlobal(durationSeconds = 2.8, callback = null) {
    this.transitionTo(CAMERA_STAGES.GLOBAL_ORBIT, durationSeconds, callback);
  }

  /**
   * Update camera position and lookAt each animation frame.
   * Uses smooth Quintic ease-in-out curve for gentle acceleration and deceleration.
   *
   * @param {number} nowMs - Current performance.now() timestamp
   * @returns {boolean} Whether transition is still running
   */
  update(nowMs = performance.now()) {
    if (this.status !== TRANSITION_STATUS.TRANSITIONING) {
      return false;
    }

    const elapsed = (nowMs - this.anim.startTime) / 1000.0;
    const rawProgress = Math.min(elapsed / this.anim.duration, 1.0);

    // Quintic Ease-In-Out: 6t^5 - 15t^4 + 10t^3
    const t = rawProgress * rawProgress * rawProgress * (rawProgress * (rawProgress * 6.0 - 15.0) + 10.0);

    // Interpolate camera position
    this.camera.position.lerpVectors(this.anim.startPos, this.anim.targetPos, t);

    // Safety Mandate: Prevent subterranean penetration
    // Ensures camera altitude stays strictly above campus terrain and building floors
    if (this.currentStage === CAMERA_STAGES.CAMPUS_OVERVIEW) {
      this.camera.position.y = Math.max(this.camera.position.y, 40.0);
    } else if (this.currentStage === CAMERA_STAGES.BUILDING_INSPECTION) {
      this.camera.position.y = Math.max(this.camera.position.y, 25.0);
    } else if (this.currentStage === CAMERA_STAGES.PERSONAL_LOCATION) {
      this.camera.position.y = Math.max(this.camera.position.y, 16.0);
    }

    // Interpolate target lookAt
    this.anim.currentLookAt.lerpVectors(this.anim.startLookAt, this.anim.targetLookAt, t);

    if (this.controls) {
      this.controls.target.copy(this.anim.currentLookAt);
      this.controls.update();
    } else {
      this.camera.lookAt(this.anim.currentLookAt);
    }

    // Interpolate near and far clipping planes
    this.camera.near = THREE.MathUtils.lerp(this.anim.startNear, this.anim.targetNear, t);
    this.camera.far = THREE.MathUtils.lerp(this.anim.startFar, this.anim.targetFar, t);
    this.camera.updateProjectionMatrix();

    if (rawProgress >= 1.0) {
      this.status = TRANSITION_STATUS.IDLE;
      if (typeof this.anim.onComplete === 'function') {
        this.anim.onComplete(this.currentStage);
      }
      return false;
    }

    return true;
  }

  /**
   * Instant snap to a stage (for testing or initial state setup).
   */
  snapTo(stage) {
    if (!this.viewpoints[stage]) return;
    const vp = this.viewpoints[stage];
    this.status = TRANSITION_STATUS.IDLE;
    this.currentStage = stage;

    this.camera.position.copy(vp.position);
    this.anim.currentLookAt.copy(vp.target);
    if (this.controls) {
      this.controls.target.copy(vp.target);
      this.controls.update();
    } else {
      this.camera.lookAt(vp.target);
    }
    this.camera.near = vp.near;
    this.camera.far = vp.far;
    this.camera.updateProjectionMatrix();
  }

  /**
   * Run the deliberate 5-stage progressive exhibition sequence.
   * Monotonic descent: GLOBAL_ORBIT -> REGIONAL_APPROACH -> CAMPUS_OVERVIEW -> BUILDING_INSPECTION -> PERSONAL_LOCATION.
   *
   * @param {Object} [options]
   * @param {Function} [options.onStageReached]
   * @param {Function} [options.onComplete]
   */
  startExhibitionSequence(options = {}) {
    const sequence = [
      { stage: CAMERA_STAGES.GLOBAL_ORBIT, duration: 2.0, pause: 0.8 },
      { stage: CAMERA_STAGES.REGIONAL_APPROACH, duration: 2.5, pause: 0.8 },
      { stage: CAMERA_STAGES.CAMPUS_OVERVIEW, duration: 2.8, pause: 0.8 },
      { stage: CAMERA_STAGES.BUILDING_INSPECTION, duration: 2.2, pause: 0.6 },
      { stage: CAMERA_STAGES.PERSONAL_LOCATION, duration: 1.8, pause: 0.0 }
    ];

    let index = 0;
    const runNext = () => {
      if (this.status === TRANSITION_STATUS.USER_OVERRIDE) return;
      if (index >= sequence.length) {
        this.status = TRANSITION_STATUS.COMPLETED;
        if (typeof options.onComplete === 'function') options.onComplete();
        return;
      }

      const item = sequence[index++];
      this.transitionTo(item.stage, item.duration, (stage) => {
        if (typeof options.onStageReached === 'function') {
          options.onStageReached(stage);
        }
        if (item.pause > 0) {
          setTimeout(runNext, item.pause * 1000);
        } else {
          runNext();
        }
      });
    };

    runNext();
  }
}
