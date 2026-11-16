// ============================================================================
// SEISMOLIVE v4.0 — Stage R4 Single-Canvas Seamless Exhibition Mode Manager
// File: js/ui/ExhibitionModeManager.js
//
// Manages seamless in-place WebGL scene switching on index.html between:
//   - MODE_GLOBAL_EXHIBITION (Global Earth WGS84/100km scale wavefield & memory)
//   - MODE_LOCAL_4KM_RESPONSE (Local Tangent ENU 1m scale 4km spatial map + egress)
//
// Zero page reloads, clean visibility isolation, zero unit-scale crosstalk.
// ============================================================================

import * as THREE from '../lib/three.module.js';
import { HanyangResponseAdapter } from '../response/HanyangResponseAdapter.js';
import { LocalSpatialMapLayer } from '../response/LocalSpatialMapLayer.js';
import { HANYANG_LOCAL_4KM_PACKAGE, HANYANG_LOCAL_SPATIAL_VIEWPOINTS } from '../response/HanyangLocalSpatialData.js';
import { ResponseUIAdapter } from '../response/ResponseUIAdapter.js';
import { GlobalLocalCameraTransition, CAMERA_STAGES, TRANSITION_STATUS } from '../response/GlobalLocalCameraTransition.js';
import { DEFAULT_HANYANG_FACILITY_PACKAGE, DATA_PROVENANCE_SOURCE } from '../response/HanyangBuildingData.js';

export const EXHIBITION_MODES = Object.freeze({
  GLOBAL_EXHIBITION: 'MODE_GLOBAL_EXHIBITION',
  LOCAL_4KM_RESPONSE: 'MODE_LOCAL_4KM_RESPONSE'
});

export class ExhibitionModeManager {
  constructor(options = {}) {
    if (!options.scene || !options.camera) {
      throw new Error('[ExhibitionModeManager] scene and camera are required.');
    }
    this.scene = options.scene;
    this.camera = options.camera;
    this.controls = options.controls || null;
    this.getGlobalSceneObjects = options.getGlobalSceneObjects || (() => []);
    this.onModeChange = options.onModeChange || null;

    this.activeMode = EXHIBITION_MODES.GLOBAL_EXHIBITION;
    this.localStage = CAMERA_STAGES.REGIONAL_APPROACH;
    this.isLocalInitialized = false;

    this.localWorldGroup = new THREE.Group();
    this.localWorldGroup.name = 'InSceneLocal4kmWorldGroup';
    this.localWorldGroup.visible = false;
    this.scene.add(this.localWorldGroup);

    this.localSpatialLayer = null;
    this.hanyangAdapter = null;
    this.uiAdapter = null;
    this.camTransition = null;
    this.localGrid = null;

    this._savedGlobalSnapshot = null;
    this._savedVisibilityMap = new Map();
    this._overlayEl = null;
  }

  _isolateGlobalSceneChildren() {
    for (const child of this.scene.children) {
      if (child === this.localWorldGroup || child.isLight) continue;
      if (!this._savedVisibilityMap.has(child)) {
        this._savedVisibilityMap.set(child, child.visible);
      }
      child.visible = false;
    }
  }

  isLocalModeActive() {
    return this.activeMode === EXHIBITION_MODES.LOCAL_4KM_RESPONSE;
  }

  _ensureLocalSceneInitialized() {
    if (this.isLocalInitialized) return;

    this.localGrid = new THREE.GridHelper(3200, 80, 0x1e293b, 0x070b14);
    this.localGrid.position.set(120, -18, 50);
    this.localWorldGroup.add(this.localGrid);

    this.localSpatialLayer = new LocalSpatialMapLayer(this.localWorldGroup, {
      spatialPackage: HANYANG_LOCAL_4KM_PACKAGE
    });

    this.hanyangAdapter = new HanyangResponseAdapter(this.localWorldGroup, {
      scale: 1.0,
      visualScaleFactor: 4.5
    });

    this.uiAdapter = new ResponseUIAdapter({
      hanyangAdapter: this.hanyangAdapter
    });
    this.uiAdapter.setUserFloor(3);
    this.uiAdapter.updateStationMotion(0.01, Date.now(), DATA_PROVENANCE_SOURCE.SIMULATED_SCENARIO);

    this.camTransition = new GlobalLocalCameraTransition({
      camera: this.camera,
      controls: this.controls,
      viewpoints: {
        ...DEFAULT_HANYANG_FACILITY_PACKAGE.cameraViewpoints,
        REGIONAL_APPROACH: HANYANG_LOCAL_SPATIAL_VIEWPOINTS.REGIONAL_APPROACH
      }
    });

    this.isLocalInitialized = true;
  }

  _ensureOverlayDOM() {
    if (typeof document === 'undefined') return;
    if (this._overlayEl) return;

    const bar = document.createElement('div');
    bar.id = 'inscene-local-response-bar';
    bar.style.cssText = [
      'position:fixed',
      'top:22px',
      'right:28px',
      'z-index:1200',
      'display:none',
      'gap:6px',
      'align-items:center',
      'background:rgba(2,4,8,0.92)',
      'border:1px solid rgba(255,255,255,0.16)',
      'padding:6px 10px',
      'font-size:11px',
      'color:#e2e8f0'
    ].join(';');

    const stages = [
      { id: 'inscene-btn-local4km', stage: CAMERA_STAGES.REGIONAL_APPROACH, label: '4km 로컬맵' },
      { id: 'inscene-btn-campus', stage: CAMERA_STAGES.CAMPUS_OVERVIEW, label: '캠퍼스' },
      { id: 'inscene-btn-bldg', stage: CAMERA_STAGES.BUILDING_INSPECTION, label: '제1공학관' },
      { id: 'inscene-btn-personal', stage: CAMERA_STAGES.PERSONAL_LOCATION, label: '3F 301호' }
    ];

    for (const s of stages) {
      const btn = document.createElement('button');
      btn.id = s.id;
      btn.type = 'button';
      btn.className = 'surface-btn secondary compact';
      btn.textContent = s.label;
      btn.addEventListener('click', () => this.setLocalStage(s.stage));
      bar.appendChild(btn);
    }

    const exitBtn = document.createElement('button');
    exitBtn.id = 'inscene-btn-exit-global';
    exitBtn.type = 'button';
    exitBtn.className = 'surface-btn primary compact';
    exitBtn.textContent = '← 글로벌 궤도 복귀';
    exitBtn.addEventListener('click', () => this.exitToGlobalExhibition());
    bar.appendChild(exitBtn);

    document.body.appendChild(bar);
    this._overlayEl = bar;
  }

  enterLocalResponseMode(stageKey = CAMERA_STAGES.REGIONAL_APPROACH) {
    this._ensureLocalSceneInitialized();
    this._ensureOverlayDOM();

    if (this.activeMode !== EXHIBITION_MODES.LOCAL_4KM_RESPONSE) {
      this._savedVisibilityMap.clear();
      this._isolateGlobalSceneChildren();
      // Preserve explicit callback list items too if caller passed detached objects
      for (const obj of (this.getGlobalSceneObjects() || [])) {
        if (!obj || obj === this.localWorldGroup) continue;
        if (!this._savedVisibilityMap.has(obj)) {
          this._savedVisibilityMap.set(obj, obj.visible);
        }
        obj.visible = false;
      }

      const hiddenDomStates = [];
      if (typeof document !== 'undefined') {
        for (const domId of ['unified-control-surface', 'quality-mode-pill', 'chronicle-subtitle-container', 'immersive-restore-pill']) {
          const el = document.getElementById(domId);
          if (el) {
            hiddenDomStates.push({ el, prevDisplay: el.style.display });
            el.style.display = 'none';
          }
        }
      }
      this._savedGlobalSnapshot = {
        hiddenDomStates,
        camPos: this.camera.position.clone(),
        camNear: this.camera.near,
        camFar: this.camera.far,
        controlsTarget: this.controls ? this.controls.target.clone() : null,
        controlsMinDist: this.controls ? this.controls.minDistance : null,
        controlsMaxDist: this.controls ? this.controls.maxDistance : null,
        controlsMaxPolar: this.controls ? this.controls.maxPolarAngle : null,
        controlsEnabled: this.controls ? this.controls.enabled : null
      };
    }

    this.activeMode = EXHIBITION_MODES.LOCAL_4KM_RESPONSE;
    this.localWorldGroup.visible = true;

    if (this.controls) {
      this.controls.minDistance = 8.0;
      this.controls.maxDistance = 3200.0;
      this.controls.maxPolarAngle = Math.PI * 0.485;
      this.controls.enabled = true;
    }

    if (this._overlayEl) {
      this._overlayEl.style.display = 'flex';
    }

    this.setLocalStage(stageKey);
    if (typeof this.onModeChange === 'function') {
      this.onModeChange(this.activeMode, this.localStage);
    }
    return this.getDiagnostics();
  }

  setLocalStage(stageKey = CAMERA_STAGES.REGIONAL_APPROACH) {
    this._ensureLocalSceneInitialized();
    this.localStage = stageKey;
    this.camTransition.snapTo(stageKey);
    this.localSpatialLayer.syncWithCameraStage(stageKey);
    this.hanyangAdapter.highlightFloor(this.hanyangAdapter.facility.defaultFloor ?? 3);
    this.hanyangAdapter.setRouteDisplay('ALL');

    if (this._overlayEl) {
      const mapIds = {
        [CAMERA_STAGES.REGIONAL_APPROACH]: 'inscene-btn-local4km',
        [CAMERA_STAGES.CAMPUS_OVERVIEW]: 'inscene-btn-campus',
        [CAMERA_STAGES.BUILDING_INSPECTION]: 'inscene-btn-bldg',
        [CAMERA_STAGES.PERSONAL_LOCATION]: 'inscene-btn-personal'
      };
      this._overlayEl.querySelectorAll('button').forEach(b => b.classList.remove('active'));
      const activeEl = this._overlayEl.querySelector(`#${mapIds[stageKey]}`);
      if (activeEl) activeEl.classList.add('active');
    }
    return this.localStage;
  }

  exitToGlobalExhibition() {
    if (this.activeMode !== EXHIBITION_MODES.LOCAL_4KM_RESPONSE) {
      return this.getDiagnostics();
    }

    this.localWorldGroup.visible = false;
    if (this._overlayEl) {
      this._overlayEl.style.display = 'none';
    }

    const snap = this._savedGlobalSnapshot;
    for (const [obj, wasVisible] of this._savedVisibilityMap.entries()) {
      if (obj) obj.visible = wasVisible;
    }
    this._savedVisibilityMap.clear();

    if (snap) {
      this.camera.position.copy(snap.camPos);
      this.camera.near = snap.camNear;
      this.camera.far = snap.camFar;
      this.camera.updateProjectionMatrix();

      if (this.controls) {
        if (snap.controlsTarget) this.controls.target.copy(snap.controlsTarget);
        if (snap.controlsMinDist !== null) this.controls.minDistance = snap.controlsMinDist;
        if (snap.controlsMaxDist !== null) this.controls.maxDistance = snap.controlsMaxDist;
        if (snap.controlsMaxPolar !== null) this.controls.maxPolarAngle = snap.controlsMaxPolar;
        if (snap.controlsEnabled !== null) this.controls.enabled = snap.controlsEnabled;
        this.controls.update();
      }

      (snap.hiddenDomStates || []).forEach(({ el, prevDisplay }) => {
        if (el) el.style.display = prevDisplay || '';
      });
      this._savedGlobalSnapshot = null;
    }

    this.activeMode = EXHIBITION_MODES.GLOBAL_EXHIBITION;
    if (typeof this.onModeChange === 'function') {
      this.onModeChange(this.activeMode, null);
    }
    return this.getDiagnostics();
  }

  update() {
    if (!this.isLocalModeActive() || !this.isLocalInitialized) return;
    this._isolateGlobalSceneChildren();
    if (this.camTransition && this.camTransition.status === TRANSITION_STATUS.TRANSITIONING) {
      this.camTransition.update();
    }
    this.localSpatialLayer?.updateSpatialChunks(this.camera);
  }

  getDiagnostics() {
    return {
      activeMode: this.activeMode,
      localStage: this.localStage,
      isLocalInitialized: this.isLocalInitialized,
      localWorldVisible: this.localWorldGroup.visible,
      localDiagnostics: this.localSpatialLayer ? this.localSpatialLayer.getLayerDiagnostics() : null
    };
  }

  dispose() {
    this.exitToGlobalExhibition();
    this.localSpatialLayer?.dispose();
    this.hanyangAdapter?.dispose();
    if (this.localGrid) this.localGrid.dispose?.();
    if (this._overlayEl) {
      this._overlayEl.remove();
      this._overlayEl = null;
    }
    this.scene.remove(this.localWorldGroup);
  }
}
