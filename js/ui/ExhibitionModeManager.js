// ============================================================================
// SEISMOLIVE v4.0 — Single-Canvas Global Exhibition <-> Local Response Mode Manager
// File: js/ui/ExhibitionModeManager.js
//
// Bridges Global Spherical Earth Orbit (Stage 1) <-> Nationwide 3D Local
// Topography/Evacuation Mode (Stage 4/5) on ONE WebGLRenderer without
// WebGL context duplication or near/far frustum Z-fighting.
//
// In browser runtime (when hudMountRoot + renderer are supplied), mounts the
// shared EvacuationExperienceController for full Korea 3D & interactive UX.
// In headless Deno tests, mounts pure LocalSpatialMapLayer + adapters cleanly.
// ============================================================================

import * as THREE from '../lib/three.module.js';
import { HANYANG_LOCAL_4KM_PACKAGE, HANYANG_LOCAL_SPATIAL_VIEWPOINTS } from '../response/HanyangLocalSpatialData.js';
import { DEFAULT_HANYANG_FACILITY_PACKAGE } from '../response/HanyangBuildingData.js';
import { LocalSpatialMapLayer, LOCAL_VISUAL_THEMES } from '../response/LocalSpatialMapLayer.js';
import { HanyangResponseAdapter } from '../response/HanyangResponseAdapter.js';
import { PedestrianRoutingEngine } from '../response/PedestrianRoutingEngine.js';
import { ResponseUIAdapter } from '../response/ResponseUIAdapter.js';
import { GlobalLocalCameraTransition, CAMERA_STAGES } from '../response/GlobalLocalCameraTransition.js';
import { UnifiedExperienceSession } from '../response/SpatialDataProviders.js';
import { EvacuationExperienceController } from './EvacuationExperienceController.js';

export const EXHIBITION_MODES = Object.freeze({
  GLOBAL_EXHIBITION: 'MODE_GLOBAL_EXHIBITION',
  LOCAL_4KM_RESPONSE: 'MODE_LOCAL_4KM_RESPONSE'
});

export class ExhibitionModeManager {
  constructor(options = {}) {
    if (!options.scene || !options.camera) {
      throw new Error('[ExhibitionModeManager] requires existing `scene` and `camera`.');
    }

    this.scene = options.scene;
    this.camera = options.camera;
    this.renderer = options.renderer || null;
    this.controls = options.controls || null;
    this.hudMountRoot = options.hudMountRoot || null;
    this.appContext = options.appContext || null;
    this.session = options.session || this.appContext?.getSession?.() || new UnifiedExperienceSession();
    if (this.appContext && typeof this.appContext.attachSession === 'function') {
      this.appContext.attachSession(this.session);
    }
    this.onReturnToGlobe = typeof options.onReturnToGlobe === 'function' ? options.onReturnToGlobe : null;
    this.getGlobalSceneObjects = typeof options.getGlobalSceneObjects === 'function'
      ? options.getGlobalSceneObjects
      : () => [];

    this.activeMode = EXHIBITION_MODES.GLOBAL_EXHIBITION;
    this.activeLocalStage = CAMERA_STAGES.REGIONAL_APPROACH;
    this._hiddenGlobalVisibility = new Map();
    this._savedGlobalState = null;

    // Isolated 3D Group inside the single scene for local metric city coordinates
    this.localWorldGroup = new THREE.Group();
    this.localWorldGroup.name = 'UnifiedSingleCanvasLocal4kmGroup';
    this.localWorldGroup.visible = false;
    this.scene.add(this.localWorldGroup);

    const hasBrowserDom =
      typeof document !== 'undefined' &&
      Boolean(this.hudMountRoot) &&
      Boolean(this.renderer?.domElement);

    if (hasBrowserDom) {
      this.controller = new EvacuationExperienceController({
        scene: this.scene,
        localWorldGroup: this.localWorldGroup,
        camera: this.camera,
        renderer: this.renderer,
        controls: this.controls,
        mountRoot: this.hudMountRoot,
        domElement: this.renderer.domElement,
        session: this.session,
        deferInitialBoot: true,
        initialTheme: options.initialTheme || 'MONOLITH_NIGHT',
        autoPlay: false,
        onReturnToGlobe: () => {
          if (this.onReturnToGlobe) this.onReturnToGlobe();
          else this.exitToGlobalExhibition();
        }
      });
      this.localSpatialLayer = this.controller.localSpatialLayer;
      this.router = this.controller.router;
      this.hanyangAdapter = this.controller.hanyangAdapter;
      this.uiAdapter = this.controller.uiAdapter;
      this.camTransition = this.controller.camTransition;
    } else {
      // Headless Deno unit-test lightweight mode
      this.controller = null;
      this.localSpatialLayer = new LocalSpatialMapLayer(this.localWorldGroup, {
        spatialPackage: options.spatialPackage || HANYANG_LOCAL_4KM_PACKAGE,
        theme: options.theme || 'MONOLITH_NIGHT'
      });
      this.router = new PedestrianRoutingEngine({
        useRealMapRouting: true,
        buildingOBBs: HANYANG_LOCAL_4KM_PACKAGE.obbBuildingsFloat32
      });
      this.hanyangAdapter = new HanyangResponseAdapter(this.localWorldGroup, {
        scale: 1.0,
        visualScaleFactor: 4.5,
        useRealMapRouting: true,
        buildingOBBs: HANYANG_LOCAL_4KM_PACKAGE.obbBuildingsFloat32,
        router: this.router
      });
      this.uiAdapter = new ResponseUIAdapter({
        router: this.router,
        hanyangAdapter: this.hanyangAdapter
      });
      this.camTransition = new GlobalLocalCameraTransition({
        camera: this.camera,
        viewpoints: {
          ...HANYANG_LOCAL_SPATIAL_VIEWPOINTS,
          ...(this.hanyangAdapter.facility?.cameraViewpoints || DEFAULT_HANYANG_FACILITY_PACKAGE.cameraViewpoints)
        }
      });
    }
  }

  _captureGlobalState() {
    this._savedGlobalState = {
      position: this.camera.position.clone ? this.camera.position.clone() : { ...this.camera.position },
      quaternion: this.camera.quaternion?.clone ? this.camera.quaternion.clone() : null,
      fov: this.camera.fov,
      near: this.camera.near,
      far: this.camera.far,
      controlTarget: this.controls?.target?.clone ? this.controls.target.clone() : null,
      minDistance: this.controls?.minDistance,
      maxDistance: this.controls?.maxDistance,
      minPolarAngle: this.controls?.minPolarAngle,
      maxPolarAngle: this.controls?.maxPolarAngle,
      controlsEnabled: this.controls?.enabled,
      backgroundHex: this.scene.background?.getHex ? this.scene.background.getHex() : null,
      fogColorHex: this.scene.fog?.color?.getHex ? this.scene.fog.color.getHex() : null,
      fogDensity: this.scene.fog?.density,
      shadowEnabled: this.renderer?.shadowMap?.enabled,
      toneMappingExposure: this.renderer?.toneMappingExposure
    };
  }

  _restoreGlobalState() {
    const s = this._savedGlobalState;
    if (!s) return;
    if (typeof s.fov === 'number') this.camera.fov = s.fov;
    if (typeof s.near === 'number') this.camera.near = s.near;
    if (typeof s.far === 'number') this.camera.far = s.far;
    if (typeof this.camera.updateProjectionMatrix === 'function') {
      this.camera.updateProjectionMatrix();
    }
    if (s.position && this.camera.position) {
      if (this.camera.position.copy) this.camera.position.copy(s.position);
      else Object.assign(this.camera.position, s.position);
    }
    if (s.quaternion && this.camera.quaternion?.copy) {
      this.camera.quaternion.copy(s.quaternion);
    }
    if (this.controls) {
      if (s.controlTarget && this.controls.target?.copy) this.controls.target.copy(s.controlTarget);
      if (typeof s.minDistance === 'number') this.controls.minDistance = s.minDistance;
      if (typeof s.maxDistance === 'number') this.controls.maxDistance = s.maxDistance;
      if (typeof s.minPolarAngle === 'number') this.controls.minPolarAngle = s.minPolarAngle;
      if (typeof s.maxPolarAngle === 'number') this.controls.maxPolarAngle = s.maxPolarAngle;
      if (typeof s.controlsEnabled === 'boolean') this.controls.enabled = s.controlsEnabled;
      this.controls.update?.();
    }
    if (typeof s.backgroundHex === 'number' && this.scene.background?.setHex) {
      this.scene.background.setHex(s.backgroundHex);
    }
    if (typeof s.fogColorHex === 'number' && this.scene.fog?.color?.setHex) {
      this.scene.fog.color.setHex(s.fogColorHex);
      if (typeof s.fogDensity === 'number') this.scene.fog.density = s.fogDensity;
    }
    if (this.renderer) {
      if (typeof s.shadowEnabled === 'boolean' && this.renderer.shadowMap) {
        this.renderer.shadowMap.enabled = s.shadowEnabled;
      }
      if (typeof s.toneMappingExposure === 'number') {
        this.renderer.toneMappingExposure = s.toneMappingExposure;
      }
    }
    if (typeof document !== 'undefined') {
      document.body.classList.remove('theme-day');
    }
  }

  _isolateGlobalSceneChildren(hideGlobal) {
    const globalObjs = this.getGlobalSceneObjects();
    if (hideGlobal) {
      this._hiddenGlobalVisibility.clear();
      for (const obj of globalObjs) {
        if (!obj || obj === this.localWorldGroup) continue;
        this._hiddenGlobalVisibility.set(obj, obj.visible);
        obj.visible = false;
      }
    } else {
      for (const [obj, prevVisible] of this._hiddenGlobalVisibility.entries()) {
        if (obj) obj.visible = prevVisible;
      }
      this._hiddenGlobalVisibility.clear();
    }
  }

  enterLocalResponseMode(stageKey = CAMERA_STAGES.REGIONAL_APPROACH, opts = {}) {
    if (this.activeMode !== EXHIBITION_MODES.LOCAL_4KM_RESPONSE) {
      this._captureGlobalState();
    }

    this._isolateGlobalSceneChildren(true);
    this.localWorldGroup.visible = true;
    this.activeMode = EXHIBITION_MODES.LOCAL_4KM_RESPONSE;

    // Switch frustum & orbit constraints seamlessly to metric 4km city space
    this.camera.fov = 42;
    this.camera.near = 0.25;
    this.camera.far = 6500.0;
    if (typeof this.camera.updateProjectionMatrix === 'function') {
      this.camera.updateProjectionMatrix();
    }
    if (this.controls) {
      this.controls.minDistance = 8.0;
      this.controls.maxDistance = 4200.0;
      this.controls.minPolarAngle = 0.02;
      this.controls.maxPolarAngle = Math.PI * 0.475;
      this.controls.enabled = true;
    }
    if (this.renderer?.shadowMap) {
      this.renderer.shadowMap.enabled = true;
    }

    if (this.hudMountRoot) {
      this.hudMountRoot.classList.add('is-visible');
    }

    if (this.controller) {
      const palette = LOCAL_VISUAL_THEMES[this.controller.activeVisualTheme] || LOCAL_VISUAL_THEMES.MONOLITH_NIGHT;
      if (this.scene.background?.setHex) this.scene.background.setHex(palette.background);
      if (this.scene.fog?.color?.setHex) {
        this.scene.fog.color.setHex(palette.fogColor);
        this.scene.fog.density = palette.fogDensity;
      }
      if (this.renderer) {
        this.renderer.toneMappingExposure = 1.06;
      }

      if (typeof this.controller.applySessionHandoff === 'function') {
        this.controller.applySessionHandoff(opts, stageKey);
      } else if (opts.lat && opts.lon && opts.regionId !== this.controller.activeRegionId) {
        this.controller.switchToRegion(opts.lat, opts.lon, {
          regionId: opts.regionId,
          name: opts.name,
          shortName: opts.shortName
        });
      } else {
        this.controller.applyVisualTheme(this.controller.activeVisualTheme);
        if (opts.eventId) {
          this.controller.loadAndBindSeismicEvent(opts.eventId);
        }
        this.setLocalStage(stageKey || CAMERA_STAGES.CAMPUS_OVERVIEW);
        if (opts.withSeismicBrief !== false) {
          this.controller.enterWithSeismicBrief({ durationMs: opts.briefDurationMs || 2200 });
        } else {
          this.controller.beginActiveEvacuation();
        }
      }
    } else {
      this.setLocalStage(stageKey);
    }

    return this.getDiagnostics();
  }

  setLocalStage(stageKey = CAMERA_STAGES.REGIONAL_APPROACH) {
    this.activeLocalStage = stageKey;
    if (this.controller) {
      this.controller.setCameraStage(stageKey);
    } else {
      this.localSpatialLayer.syncWithCameraStage(stageKey);
      this.camTransition.snapTo(stageKey);
      if (stageKey === CAMERA_STAGES.BUILDING_INSPECTION || stageKey === CAMERA_STAGES.PERSONAL_LOCATION) {
        this.hanyangAdapter.highlightFloor(this.uiAdapter.context?.user?.floor ?? 3);
      } else {
        this.hanyangAdapter.highlightFloor(null);
      }
    }
    return this.getDiagnostics();
  }

  exitToGlobalExhibition() {
    if (this.hudMountRoot) {
      this.hudMountRoot.classList.remove('is-visible');
    }
    if (this.controller) {
      if (this.controller.briefTimerId) {
        clearTimeout(this.controller.briefTimerId);
        this.controller.briefTimerId = null;
      }
      this.controller.walkPlaying = false;
      this.controller._el('seismic-brief-banner')?.classList.remove('is-active');
    }

    this.localWorldGroup.visible = false;
    this.activeMode = EXHIBITION_MODES.GLOBAL_EXHIBITION;
    this._isolateGlobalSceneChildren(false);
    this._restoreGlobalState();

    return this.getDiagnostics();
  }

  update(dt = 0.016, elapsed = 0) {
    if (!this.isLocalModeActive()) return;
    if (this.controller) {
      this.controller.update(dt, elapsed);
    } else {
      this.camTransition.update();
    }
  }

  isLocalModeActive() {
    return this.activeMode === EXHIBITION_MODES.LOCAL_4KM_RESPONSE;
  }

  getDiagnostics() {
    return {
      activeMode: this.activeMode,
      localWorldVisible: this.localWorldGroup.visible,
      localStage: this.activeLocalStage,
      localDiagnostics: this.localSpatialLayer.getLayerDiagnostics(),
      guidanceSummary: this.uiAdapter.lastGuidance?.phaseHeadline || null,
      controllerDiagnostics: this.controller ? this.controller.getDiagnostics() : null
    };
  }

  dispose() {
    if (this.controller) {
      this.controller.dispose();
    } else {
      this.localSpatialLayer.dispose();
    }
    this.scene.remove(this.localWorldGroup);
  }
}
