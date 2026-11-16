// ============================================================================
// SEISMOLIVE v4.0 — Exhibition Application Context & Explicit Dependency Bridge
// Module: js/ui/ExhibitionAppContext.js
//
// Replaces implicit `window.*` circular globals between js/main.js,
// js/ui/UnifiedControlSurface.js, and js/ui/GeophysicsFolioView.js (Stage R3)
// while preserving backward-compatible `window.*` aliases for E2E verification.
// ============================================================================

export class ExhibitionAppContext {
  constructor() {
    this.isPlaying = true;
    this.autonomousMode = false;
    this.playbackSpeed = 1.0;
    this.currentShotKey = 'monumental_continental_scale';
    this.flightState = 'STATE_ORBIT';
    this.FLIGHT_STATES = {
      ORBIT: 'STATE_ORBIT',
      DESCEND: 'STATE_FLIGHT_DESCEND',
      PERFORMANCE: 'STATE_PERFORMANCE',
      CODA: 'STATE_CODA',
      ASCEND: 'STATE_FLIGHT_ASCEND'
    };
    this.currentParsedEvent = null;
    this.masterEventsRegistry = [];
    this.historicalEvents = [];
    this.instrumentalEvents = [];
    this.livingSoundfield = null;
    this.controlSurface = null;

    this._handlers = {
      startDescentFlight: null,
      startAscentFlight: null,
      seekToSimulationTime: null,
      setSimulationPlaying: null,
      setPlaybackSpeed: null,
      applyCameraShot: null,
      toggleImmersiveUI: null,
      setGeophysics3DProbe: null,
      setAutonomousMode: null
    };
  }

  registerHandlers(handlers = {}) {
    Object.entries(handlers).forEach(([k, fn]) => {
      if ((k in this._handlers || k === 'enterInSceneLocalResponse') && typeof fn === 'function') {
        this._handlers[k] = fn;
      }
    });
  }

  setCatalogs({ masterEventsRegistry, historicalEvents, instrumentalEvents } = {}) {
    if (Array.isArray(masterEventsRegistry)) this.masterEventsRegistry = masterEventsRegistry;
    if (Array.isArray(historicalEvents)) this.historicalEvents = historicalEvents;
    if (Array.isArray(instrumentalEvents)) this.instrumentalEvents = instrumentalEvents;
  }

  getAllEvents() {
    if (this.masterEventsRegistry && this.masterEventsRegistry.length > 0) {
      return this.masterEventsRegistry;
    }
    return [...(this.historicalEvents || []), ...(this.instrumentalEvents || [])];
  }

  async startDescentFlight(targetId) {
    if (typeof this._handlers.startDescentFlight === 'function') {
      return await this._handlers.startDescentFlight(targetId);
    }
    if (typeof window !== 'undefined' && typeof window.startDescentFlight === 'function') {
      return await window.startDescentFlight(targetId);
    }
  }

  startAscentFlight() {
    if (typeof this._handlers.startAscentFlight === 'function') {
      return this._handlers.startAscentFlight();
    }
    if (typeof window !== 'undefined' && typeof window.startAscentFlight === 'function') {
      return window.startAscentFlight();
    }
  }

  seekToSimulationTime(t) {
    if (typeof this._handlers.seekToSimulationTime === 'function') {
      return this._handlers.seekToSimulationTime(t);
    }
    if (typeof window !== 'undefined' && typeof window.seekToSimulationTime === 'function') {
      return window.seekToSimulationTime(t);
    }
  }

  setSimulationPlaying(playing) {
    this.isPlaying = !!playing;
    if (typeof this._handlers.setSimulationPlaying === 'function') {
      this._handlers.setSimulationPlaying(this.isPlaying);
    } else if (typeof window !== 'undefined' && typeof window.setSimulationPlaying === 'function') {
      window.setSimulationPlaying(this.isPlaying);
    }
  }

  setPlaybackSpeed(speed) {
    const next = Math.max(0.25, Math.min(4.0, Number(speed) || 1.0));
    this.playbackSpeed = next;
    if (typeof this._handlers.setPlaybackSpeed === 'function') {
      return this._handlers.setPlaybackSpeed(next);
    }
    if (typeof window !== 'undefined' && typeof window.setPlaybackSpeed === 'function') {
      return window.setPlaybackSpeed(next);
    }
    return next;
  }

  setAutonomousMode(enabled) {
    this.autonomousMode = !!enabled;
    if (typeof this._handlers.setAutonomousMode === 'function') {
      this._handlers.setAutonomousMode(this.autonomousMode);
    }
  }

  applyCameraShot(key) {
    this.currentShotKey = key;
    if (typeof this._handlers.applyCameraShot === 'function') {
      return this._handlers.applyCameraShot(key);
    }
    if (typeof window !== 'undefined' && typeof window.applyCameraShot === 'function') {
      return window.applyCameraShot(key);
    }
  }

  toggleImmersiveUI(forceHide) {
    if (typeof this._handlers.toggleImmersiveUI === 'function') {
      return this._handlers.toggleImmersiveUI(forceHide);
    }
    if (typeof window !== 'undefined' && typeof window.toggleImmersiveUI === 'function') {
      return window.toggleImmersiveUI(forceHide);
    }
    return false;
  }

  setGeophysics3DProbe(distKm, xCritKm = 0, xCrossKm = 0) {
    if (typeof this._handlers.setGeophysics3DProbe === 'function') {
      return this._handlers.setGeophysics3DProbe(distKm, xCritKm, xCrossKm);
    }
    if (typeof window !== 'undefined' && typeof window.setGeophysics3DProbe === 'function') {
      return window.setGeophysics3DProbe(distKm, xCritKm, xCrossKm);
    }
  }

  /**
   * Bind the UnifiedExperienceSession instance owned by the runtime orchestrator.
   */
  attachSession(sessionInstance) {
    this.session = sessionInstance;
    return this.session;
  }

  getSession() {
    return this.session || null;
  }

  /**
   * Carry a selected globe earthquake cleanly into Local Response Space.
   */
  async handoffEventToLocalResponse(rawEvent, opts = {}) {
    const handed = this.session ? this.session.setGlobeEventHandoff(rawEvent) : rawEvent;
    const payload = {
      ...opts,
      entryMode: 'FROM_GLOBE_EVENT',
      handedEvent: handed,
      eventId: handed?.id || handed?.eventId || rawEvent?.eventId || rawEvent?.id || opts.eventId || null
    };
    if (typeof this._handlers.enterInSceneLocalResponse === 'function') {
      return this._handlers.enterInSceneLocalResponse(payload);
    }
    if (typeof window !== 'undefined' && typeof window.enterInSceneLocalResponse === 'function') {
      return window.enterInSceneLocalResponse(payload);
    }
    return payload;
  }

  async startMyLocationResponse(opts = {}) {
    if (this.session) {
      this.session.setEntryMode('MY_LOCATION');
    }
    const payload = { ...opts, entryMode: 'MY_LOCATION' };
    if (typeof this._handlers.enterInSceneLocalResponse === 'function') {
      return this._handlers.enterInSceneLocalResponse(payload);
    }
    if (typeof window !== 'undefined' && typeof window.enterInSceneLocalResponse === 'function') {
      return window.enterInSceneLocalResponse(payload);
    }
    return payload;
  }

  async startFreeModeResponse(opts = {}) {
    if (this.session) {
      this.session.setEntryMode('FREE_MODE');
    }
    const payload = { ...opts, entryMode: 'FREE_MODE' };
    if (typeof this._handlers.enterInSceneLocalResponse === 'function') {
      return this._handlers.enterInSceneLocalResponse(payload);
    }
    if (typeof window !== 'undefined' && typeof window.enterInSceneLocalResponse === 'function') {
      return window.enterInSceneLocalResponse(payload);
    }
    return payload;
  }
}

export const exhibitionAppContext = new ExhibitionAppContext();
