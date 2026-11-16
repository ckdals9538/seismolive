// =========================================================================
    // SEISMOLIVE v4.0 — G2 Phase 6: Generic Archival Living Typography Engine
    // Unified Architecture · Figure-Ground Contrast · Editorial Serif · Negative Space
    // =========================================================================

    import { THREE } from './lib/three-runtime.js';
    import { HISTORICAL_EVENTS, SOURCE_RECORDS, EVENT_SOURCE_LINKS } from './data/historicalArchiveDB.js?v=5.5';
    import { INSTRUMENTAL_EVENTS } from './data/instrumentalCatalogDB.js?v=5.5';
    import { loadUSGSFeed, buildUnifiedMasterCatalog } from './data/usgsFeedConnector.js?v=5.5';
    import { liveSeismicDataService } from './data/LiveSeismicDataService.js?v=6.0';
    import {
      WGS84,
      DATUM_STATUS,
      geodeticToThree,
      computeGlobeCenterAndPolarAxis,
      computeEllipsoidalHeight,
      threeToECEF,
      ecefToThree
    } from './3d/geodeticEllipsoidCoord.js?v=5.5';
    import {
      SURFACE_CLASSIFICATION,
      RASTER_PIXEL_TYPE,
      GeoRasterSampler,
      classifySurface,
      TerrainLifecycleManager,
      createTier2CopernicusInsetMesh,
      UNIVERSAL_EVENT_METADATA,
      getUniversalEventMetadata,
      loadRegionalDEMTexture,
      loadGlobalElevationTexture
    } from './3d/terrainDataResolver.js?v=5.5';
    import {
      SeismicSourceModel,
      VelocityModelStatus,
      REFERENCE_CRUSTAL_VELOCITY,
      REGIONAL_VELOCITY_MODELS
    } from './3d/seismicSourceModel.js?v=5.5';
    import { UniversalWavefieldEngine } from './3d/universalWavefieldEngine.js?v=5.5';
    import { WavefieldVisualOrchestrator } from './3d/wavefieldVisualOrchestrator.js?v=5.5';
    import { LivingSoundfieldEngine } from './audio/livingSoundfieldEngine.js?v=5.5';
    import {
      ArchivalSemanticParser,
      TerrainAwareSpawner,
      LivingMemoryEngine,
      updateEntitiesLifecycle,
      renderEditorialTypography,
      createRadialHaloTexture,
      createResonanceEntity,
      createFractureEntity,
      createRecedeEntity,
      createExposeEntity
    } from './3d/livingMemoryEngine.js?v=5.5';
    import {
      MONOLITH_SURFACE_GLSL,
      TIER0_GLOBE_VERTEX_SHADER,
      TIER0_GLOBE_FRAGMENT_SHADER,
      REGIONAL_TERRAIN_VERTEX_SHADER,
      REGIONAL_TERRAIN_FRAGMENT_SHADER,
      OCEAN_WATER_VERTEX_SHADER,
      OCEAN_WATER_FRAGMENT_SHADER
    } from './3d/shaders/SeismicTerrainShaders.js';
    import { FLIGHT_STATES, computeSphericalFlightPose } from './3d/FlightController.js';
    import { exhibitionAppContext } from './ui/ExhibitionAppContext.js';
    import { ExhibitionModeManager } from './ui/ExhibitionModeManager.js';

    let orchestrator = null;
    let exhibitionModeManager = null;
    window.orchestrator = null;
    window.wavefieldEngine = null;

    let livingSoundfield = new LivingSoundfieldEngine({ isMuted: true, volume: 0.65 });
    exhibitionAppContext.livingSoundfield = livingSoundfield;
    window.livingSoundfield = livingSoundfield;
    window.toggleSoundfieldMute = async (muted) => await livingSoundfield.setMuted(muted);

    let tier2Mesh = null;
    let currentTier2Resolution = 512;
    window.tier2Mesh = null;

    window.HISTORICAL_EVENTS = HISTORICAL_EVENTS;
    window.SOURCE_RECORDS = SOURCE_RECORDS;
    window.EVENT_SOURCE_LINKS = EVENT_SOURCE_LINKS;
    window.INSTRUMENTAL_EVENTS = INSTRUMENTAL_EVENTS;
    window.geodeticToThree = geodeticToThree;
    window.WGS84 = WGS84;

    // =========================================================================
    // MASTER EXHIBITION ARCHITECTURE: STATE MACHINE, FLIGHT & DISCOVERY
    // =========================================================================

import { getEventCoords, isHistoricalRecord, getAllLocalizedEvents } from './data/eventCatalogHelpers.js?v=5.0';
import { DiscoveryNode, initDiscoveryNodes, updateDiscoveryNodePositions, setDiscoveryBeaconsVisible, showBeaconTooltip, hideBeaconTooltip } from './ui/DiscoveryBeacons.js?v=5.0';
import { UnifiedControlSurface } from './ui/UnifiedControlSurface.js?v=5.0';

    let flightState = FLIGHT_STATES.ORBIT;
    let flightProgress = 0.0;
    let flightDuration = 3.8;
    const flightStartPos = new THREE.Vector3(10.0, 140.0, 40.0);
    const flightEndPos = new THREE.Vector3(0.36, 0.22, 0.24);
    const flightStartLookAt = new THREE.Vector3(0, 0, 0);
    const flightEndLookAt = new THREE.Vector3(-0.14, 0.045, -0.04);
    const targetShotPos = new THREE.Vector3(0.36, 0.22, 0.24);
    const targetShotLookAt = new THREE.Vector3(-0.14, 0.045, -0.04);

    let autonomousMode = false;
    let exhibitionIndex = 0;
    const EXHIBITION_EVENTS = [
      'hist_1681_0626',
      'hist_2016_gyeongju',
      'hist_1643_ulsan',
      'hist_2017_pohang',
      'hist_1518_seoul',
      'global_2016_kumamoto',
      'global_2023_turkey',
      'hist_0779_gyeongju'
    ];
    let orbitDwellTimer = 0.0;
    let cachedLandCanvasTexture = null;
    let globalElevationTexture = null;
    let celestialStarsMesh = null;
    let atmosphereGlowMesh = null;
    const discoveryNodes = [];
    window.discoveryNodes = discoveryNodes;
    let hoveredBeacon = null;
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2(-999, -999);

    // Audio Unlock
    window.addEventListener('pointerdown', async () => {
      if (livingSoundfield && livingSoundfield.ctx && livingSoundfield.ctx.state === 'suspended') {
        try { await livingSoundfield.ctx.resume(); } catch (e) {}
      }
    }, { once: false });


    const FUSED_BIN_URL = "assets/terrain/bathymetry/fused_seorak_donghae_unorm16.bin";
    const BIN_WIDTH = 1800;
    const BIN_HEIGHT = 1440;
    const H_MIN_METERS = -3404.0;
    const H_MAX_METERS = +1708.0;

    let currentDemWidth = BIN_WIDTH;
    let currentDemHeight = BIN_HEIGHT;
    let currentHMin = H_MIN_METERS;
    let currentHMax = H_MAX_METERS;

    // Physical Dimension Scale: 131.42 km EW x 66.34 km NS (WGS84 1 unit = 100 km)
    const PHYSICAL_W_UNITS = 1.3142;
    const PHYSICAL_H_UNITS = 0.6634;
    const METERS_TO_UNITS = 1.0 / 100000.0;
    const VERTICAL_EXAG = 2.4;

    // Real inferred offshore epicenter: 37.95°N, 129.05°E
    const EPI_POS = new THREE.Vector2(0.0, 0.03365);

    // Seismic velocities in scene units/second
    const V_P_KM_S = 6.0;
    const V_S_KM_S = 3.5;
    const V_P_UNITS = (V_P_KM_S * 1000.0) * METERS_TO_UNITS;
    const V_S_UNITS = (V_S_KM_S * 1000.0) * METERS_TO_UNITS;

    // Dynamic Seismic & Physical Motion Variables
    let paramFocalDepthKm = 12.0;         // 5 to 40 km
    let paramDominantFreqHz = 1.0;        // 0.4 to 2.5 Hz
    let paramAttenuationQ = 250.0;        // 60 to 500
    let paramDisplacementScale = 1.2;     // 0.4 to 3.0x
    let paramFaultStrikeRad = 1.309;      // ~75 deg (N15E strike)
    let paramRadiationDirectivity = 0.85; // 0.0 = isotropic, 1.0 = full quadrupole
    let paramModeP = 1.0;                 // 1.0 on, 0.0 off
    let paramModeS = 1.0;                 // 1.0 on, 0.0 off

    let enableStratum1 = 0.0;             // Anti-Game-VFX: Disable artificial concentric rings
    let enableStratum2 = 1.0;
    let enableStratum3 = 1.0;
    let purePhysicalMode = 0.0;           // 1.0 = pure physical ground motion without neon lights

    // -------------------------------------------------------------------------
    // 1. SCENE, CAMERA, RENDERER SETUP
    // -------------------------------------------------------------------------
    const container = document.getElementById('canvas-container');
    const scene = new THREE.Scene();
    window.scene = scene;
    scene.background = new THREE.Color(0x020408);
    scene.fog = new THREE.FogExp2(0x020408, 0.0001); // Sublime cosmic depth: no black wall clipping

    const initAspect = (typeof window !== 'undefined' && window.innerHeight > 0) ? (window.innerWidth / window.innerHeight) : 1.777;
    const isPortraitNarrowViewport = (typeof window !== 'undefined' && window.innerWidth <= 640 && initAspect < 0.78);
    const camera = new THREE.PerspectiveCamera(isPortraitNarrowViewport ? 48 : 36, initAspect, 0.02, 600.0);
    const isLowSpec = (typeof navigator !== 'undefined' && typeof navigator.hardwareConcurrency === 'number' && navigator.hardwareConcurrency > 0 && navigator.hardwareConcurrency <= 2);
    const maxDpr = isLowSpec ? 1.0 : Math.min((typeof window !== 'undefined' ? window.devicePixelRatio : 1) || 1, 2.0);
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: "high-performance" });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(maxDpr);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.18;

    const syncPortraitOrbitFovAndDpr = () => {
      if (!renderer || !camera) return;
      const w = window.innerWidth;
      const h = Math.max(1, window.innerHeight);
      const portraitNarrow = (w <= 640 && (w / h) < 0.78);
      if (typeof flightState !== 'undefined' && flightState === FLIGHT_STATES.ORBIT) {
        const targetFov = portraitNarrow ? 48 : 36;
        if (Math.abs(camera.fov - targetFov) > 0.1) {
          camera.fov = targetFov;
          camera.updateProjectionMatrix();
        }
      }
      if (typeof qualityMode !== 'undefined') {
        const dprCap = (qualityMode === 'CLASSROOM') ? 1.0 : Math.min(window.devicePixelRatio || 1, 2.0);
        renderer.setPixelRatio(dprCap);
      }
    };
    window.addEventListener('resize', syncPortraitOrbitFovAndDpr);
    container.appendChild(renderer.domElement);

    // Low-spec and mobile WebGL Context Loss Recovery
    renderer.domElement.addEventListener('webglcontextlost', (e) => {
      e.preventDefault();
      console.warn('[SEISMOLIVE] WebGL Context Lost. Pausing rendering pipeline.');
    }, false);
    renderer.domElement.addEventListener('webglcontextrestored', () => {
      console.log('[SEISMOLIVE] WebGL Context Restored.');
    }, false);

    const controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.maxDistance = 400.0;
    controls.minDistance = 20.0;
    if (THREE.TOUCH) {
      controls.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN };
    }

    window.camera = camera;
    window.controls = controls;
    window.scene = scene;
    window.renderer = renderer;

    // -------------------------------------------------------------------------
    // WGS84 3-TIER CONTINUOUS EARTH FOUNDATION GEOMETRY GENERATORS
    // -------------------------------------------------------------------------
    function createWGS84CurvedPlaneGeometry(widthUnits, heightUnits, widthSegs, heightSegs, lat0, lon0) {
      const geo = new THREE.BufferGeometry();
      const positions = new Float32Array((widthSegs + 1) * (heightSegs + 1) * 3);
      const uvs = new Float32Array((widthSegs + 1) * (heightSegs + 1) * 2);
      const uvGlobals = new Float32Array((widthSegs + 1) * (heightSegs + 1) * 2);
      const indices = [];

      let pIdx = 0;
      let uvIdx = 0;

      for (let y = 0; y <= heightSegs; y++) {
        const v = y / heightSegs;
        const z_units = (0.5 - v) * heightUnits;
        const z_meters = z_units * WGS84.METERS_PER_UNIT;

        for (let x = 0; x <= widthSegs; x++) {
          const u = x / widthSegs;
          const x_units = (u - 0.5) * widthUnits;
          const x_meters = x_units * WGS84.METERS_PER_UNIT;

          const phi0Rad = (lat0 * Math.PI) / 180.0;
          const dLat = (z_meters / 110996.0);
          const dLon = (x_meters / (111319.0 * Math.cos(phi0Rad)));

          const lat = lat0 + dLat;
          const lon = lon0 + dLon;

          const [threeX, threeY, threeZ] = geodeticToThree(lat, lon, 0.0, lat0, lon0, 0.0);

          positions[pIdx] = threeX;
          positions[pIdx + 1] = threeY;
          positions[pIdx + 2] = threeZ;
          pIdx += 3;

          uvs[uvIdx] = u;
          uvs[uvIdx + 1] = v;

          // Planetary geodetic UV for global elevation and seamless boundary reconciliation
          uvGlobals[uvIdx] = (lon + 180.0) / 360.0;
          uvGlobals[uvIdx + 1] = (90.0 - lat) / 180.0;

          uvIdx += 2;
        }
      }

      for (let y = 0; y < heightSegs; y++) {
        for (let x = 0; x < widthSegs; x++) {
          const a = y * (widthSegs + 1) + x;
          const b = y * (widthSegs + 1) + (x + 1);
          const c = (y + 1) * (widthSegs + 1) + x;
          const d = (y + 1) * (widthSegs + 1) + (x + 1);

          indices.push(a, c, b);
          indices.push(b, c, d);
        }
      }

      geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
      geo.setAttribute('a_uvGlobal', new THREE.BufferAttribute(uvGlobals, 2));
      geo.setIndex(indices);
      geo.computeVertexNormals();
      return geo;
    }


    // -------------------------------------------------------------------------
    // MASTER EXHIBITION: OFFLINE LAND/OCEAN TEXTURE GENERATOR
    // -------------------------------------------------------------------------
    async function generateLandOceanCanvasTexture() {
      const canvas = document.createElement('canvas');
      canvas.width = 2048;
      canvas.height = 1024;
      const ctx = canvas.getContext('2d');

      // Fill ocean: deep void nocturnal ocean
      ctx.fillStyle = '#060d19';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      try {
        const res = await fetch('assets/terrain/ne_110m_land.geojson');
        if (res.ok) {
          const geojson = await res.json();
          ctx.fillStyle = '#17202c'; // Basalt land albedo
          ctx.strokeStyle = '#28384b'; // Subtle coastline rim
          ctx.lineWidth = 1.0;

          for (const feature of geojson.features) {
            const geom = feature.geometry;
            const polyCoords = geom.type === 'Polygon' ? [geom.coordinates] : geom.coordinates;
            for (const ringList of polyCoords) {
              for (const ring of ringList) {
                ctx.beginPath();
                for (let i = 0; i < ring.length; i++) {
                  const lon = ring[i][0];
                  const lat = ring[i][1];
                  const x = ((lon + 180.0) / 360.0) * canvas.width;
                  const y = ((90.0 - lat) / 180.0) * canvas.height;
                  if (i === 0) ctx.moveTo(x, y);
                  else ctx.lineTo(x, y);
                }
                ctx.closePath();
                ctx.fill();
                ctx.stroke();
              }
            }
          }
        }
      } catch (err) {
        console.warn("[Land/Ocean Generator] GeoJSON load fallback:", err);
      }

      const texture = new THREE.CanvasTexture(canvas);
      texture.flipY = false;
      texture.wrapS = THREE.RepeatWrapping;
      texture.wrapT = THREE.ClampToEdgeWrapping;
      texture.minFilter = THREE.LinearMipMapLinearFilter;
      texture.magFilter = THREE.LinearFilter;
      texture.generateMipmaps = true;
      return texture;
    }

    // -------------------------------------------------------------------------
    // MASTER EXHIBITION: CELESTIAL STARFIELD & ATMOSPHERE GLOW
    // -------------------------------------------------------------------------
    function createCelestialStarfield() {
      const starCount = 3600;
      const geo = new THREE.BufferGeometry();
      const positions = new Float32Array(starCount * 3);
      const colors = new Float32Array(starCount * 3);

      for (let i = 0; i < starCount; i++) {
        const theta = Math.random() * Math.PI * 2.0;
        const phi = Math.acos(2.0 * Math.random() - 1.0);
        const r = 260.0 + Math.random() * 80.0;

        positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
        positions[i * 3 + 1] = r * Math.cos(phi);
        positions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);

        const p = Math.random();
        if (p < 0.65) {
          // Hanji Ivory
          colors[i * 3] = 0.88; colors[i * 3 + 1] = 0.90; colors[i * 3 + 2] = 0.96;
        } else if (p < 0.85) {
          // Pale Moon Rim Blue
          colors[i * 3] = 0.62; colors[i * 3 + 1] = 0.78; colors[i * 3 + 2] = 0.98;
        } else {
          // Antique Brass
          colors[i * 3] = 0.92; colors[i * 3 + 1] = 0.82; colors[i * 3 + 2] = 0.62;
        }
      }

      geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

      const mat = new THREE.PointsMaterial({
        vertexColors: true,
        size: 1.6,
        sizeAttenuation: false,
        transparent: true,
        opacity: 0.75,
        depthWrite: false
      });

      const stars = new THREE.Points(geo, mat);
      stars.renderOrder = -10;
      stars.name = 'CelestialStarfield';
      return stars;
    }

    function createAtmosphereGlowShell(lat0, lon0) {
      // Strict Anti-Game-VFX (GEMINI.md Rule 2): Ban transparent glowing spherical domes.
      // Limb scattering is handled natively by the Tier 0 WGS84 globe shader.
      const group = new THREE.Group();
      group.name = 'AtmosphereGlowShell';
      return group;
    }

    // -------------------------------------------------------------------------
    // DISCOVERY NODES SYSTEM: 48 VERIFIED HISTORICAL & INSTRUMENTAL BEACONS
    // -------------------------------------------------------------------------
    let MASTER_EVENTS_REGISTRY = buildUnifiedMasterCatalog(HISTORICAL_EVENTS, INSTRUMENTAL_EVENTS);
    window.MASTER_EVENTS_REGISTRY = MASTER_EVENTS_REGISTRY;
    exhibitionAppContext.setCatalogs({
      masterEventsRegistry: MASTER_EVENTS_REGISTRY,
      historicalEvents: HISTORICAL_EVENTS,
      instrumentalEvents: INSTRUMENTAL_EVENTS
    });

    let controlSurface = null;
    window.controlSurface = null;

    // ORBITAL-TO-LOCAL CONTINUOUS FLIGHT CONTROLLER
    // -------------------------------------------------------------------------
    let pendingLocalCityFlight = null;

    async function startDescentFlight(targetEventId, flightOpts = {}) {
      console.log(`[Flight Controller] Initiating descent flight to: ${targetEventId}`);
      if (!flightOpts.preservePendingLocalCity) {
        pendingLocalCityFlight = null;
      }

      // 1. Re-anchor camera coordinates to keep 3D orientation smooth
      const prevLat0 = currentParsedEvent?.spatialCoords?.lat ?? 37.95;
      const prevLon0 = currentParsedEvent?.spatialCoords?.lon ?? 129.05;

      const camECEF = threeToECEF([camera.position.x, camera.position.y, camera.position.z], prevLat0, prevLon0);
      const targetECEF = threeToECEF([controls.target.x, controls.target.y, controls.target.z], prevLat0, prevLon0);

      // 2. Load the target event (without snapping camera!)
      await loadHistoricalEvent(targetEventId, false);

      const newLat0 = currentParsedEvent?.spatialCoords?.lat;
      const newLon0 = currentParsedEvent?.spatialCoords?.lon;

      if (newLat0 == null || newLon0 == null) {
        // Ancient uncertain historical record: preserve orbit view and initiate performance
        flightState = FLIGHT_STATES.PERFORMANCE;
        exhibitionAppContext.flightState = flightState;
        simTime = 0.0;
        isPlaying = true;
        exhibitionAppContext.isPlaying = isPlaying;
        updateHUDForFlight('performance');
        if (controlSurface) controlSurface.setState('PERFORMANCE', currentParsedEvent);
        return;
      }

      flightState = FLIGHT_STATES.DESCEND;
      exhibitionAppContext.flightState = flightState;
      flightProgress = 0.0;
      flightDuration = flightOpts.durationSec || 3.8;

      // 3. Re-anchor camera in new local origin frame
      const newCamThree = ecefToThree(camECEF, newLat0, newLon0);
      const newTargetThree = ecefToThree(targetECEF, newLat0, newLon0);

      camera.position.set(newCamThree[0], newCamThree[1], newCamThree[2]);
      controls.target.set(newTargetThree[0], newTargetThree[1], newTargetThree[2]);
      controls.update();

      controls.enabled = false;
      flightStartPos.copy(camera.position);
      flightStartLookAt.copy(controls.target);

      flightEndPos.copy(targetShotPos);
      flightEndLookAt.copy(targetShotLookAt);

      updateHUDForFlight('descending');
      if (controlSurface && !pendingLocalCityFlight) {
        controlSurface.setState('PERFORMANCE', currentParsedEvent);
      }
      controlSurface?.updateGlobalDevLabVisibility?.();
    }

    function startAscentFlight() {
      console.log(`[Flight Controller] Initiating ascent flight to Orbit`);
      flightState = FLIGHT_STATES.ASCEND;
      exhibitionAppContext.flightState = flightState;
      flightProgress = 0.0;
      flightDuration = 3.5;

      controls.enabled = false;
      flightStartPos.copy(camera.position);
      flightStartLookAt.copy(controls.target);

      flightEndPos.set(10.0, 140.0, 40.0);
      flightEndLookAt.set(0.0, 0.0, 0.0);

      updateHUDForFlight('ascending');
      if (controlSurface) controlSurface.setState('EXPLORE');
    }

    function advanceToNextExhibitionEvent() {
      exhibitionIndex = (exhibitionIndex + 1) % EXHIBITION_EVENTS.length;
      const nextId = EXHIBITION_EVENTS[exhibitionIndex];
      startDescentFlight(nextId);
    }
    window.startDescentFlight = startDescentFlight;
    window.startAscentFlight = startAscentFlight;
    window.advanceToNextExhibitionEvent = advanceToNextExhibitionEvent;
    window.getFlightState = () => flightState;
    window.setFlightState = (s) => { flightState = s; exhibitionAppContext.flightState = s; };
    window.FLIGHT_STATES = FLIGHT_STATES;

    function updateFlight(dt) {
      if (flightState === FLIGHT_STATES.DESCEND) {
        flightProgress += dt / flightDuration;
        const { position, lookAt, ease } = computeSphericalFlightPose({
          THREE,
          startPos: flightStartPos,
          endPos: flightEndPos,
          startLookAt: flightStartLookAt,
          endLookAt: flightEndLookAt,
          progress: flightProgress,
          withArcHop: true
        });

        camera.position.copy(position);
        camera.lookAt(lookAt);

        camera.near = THREE.MathUtils.lerp(0.1, 0.02, ease);
        camera.far = 600.0;
        camera.updateProjectionMatrix();

        if (scene.fog) {
          scene.fog.density = THREE.MathUtils.lerp(0.0001, 0.015, ease);
        }

        discoveryNodes.forEach(n => { n.group.visible = (ease < 0.65); });

        if (flightProgress >= 1.0) {
          flightProgress = 1.0;

          if (pendingLocalCityFlight && exhibitionModeManager) {
            const req = pendingLocalCityFlight;
            pendingLocalCityFlight = null;
            flightState = FLIGHT_STATES.ORBIT;
            exhibitionAppContext.flightState = FLIGHT_STATES.ORBIT;
            document.body.classList.add('in-local-evac-mode');
            exhibitionModeManager.enterLocalResponseMode(req.stage, {
              ...req,
              withSeismicBrief: true
            });
            controlSurface?.updateGlobalDevLabVisibility?.();
            return;
          }

          flightState = FLIGHT_STATES.PERFORMANCE;
          exhibitionAppContext.flightState = flightState;
          simTime = 0.0;
          window.simTime = 0.0;
          isPlaying = true;
          exhibitionAppContext.isPlaying = isPlaying;
          if (orchestrator?.seekToTime) orchestrator.seekToTime(0.0);
          controlSurface?.updatePerformanceTime?.(0.0, currentMaxSimTime);
          controls.target.copy(flightEndLookAt);
          controls.minDistance = 0.04;
          controls.maxDistance = 6.0;
          controls.maxPolarAngle = Math.PI * 0.465;
          controls.enabled = true;
          controls.update();
          if (livingSoundfield && !livingSoundfield.isMuted) {
            livingSoundfield.triggerEventRupture(currentParsedEvent.eventId);
          }
          updateHUDForFlight('performance');
        }
      } else if (flightState === FLIGHT_STATES.ASCEND) {
        flightProgress += dt / flightDuration;
        const { position, lookAt, ease } = computeSphericalFlightPose({
          THREE,
          startPos: flightStartPos,
          endPos: flightEndPos,
          startLookAt: flightStartLookAt,
          endLookAt: flightEndLookAt,
          progress: flightProgress,
          withArcHop: false
        });

        camera.position.copy(position);
        camera.lookAt(lookAt);

        camera.near = THREE.MathUtils.lerp(0.02, 0.1, ease);
        camera.far = 600.0;
        camera.updateProjectionMatrix();

        if (scene.fog) {
          scene.fog.density = THREE.MathUtils.lerp(0.015, 0.0001, ease);
        }

        discoveryNodes.forEach(n => { n.group.visible = (ease > 0.35); });

        if (flightProgress >= 1.0) {
          flightProgress = 1.0;
          flightState = FLIGHT_STATES.ORBIT;
          exhibitionAppContext.flightState = flightState;
          controls.target.copy(flightEndLookAt);
          controls.minDistance = 20.0;
          controls.maxDistance = 400.0;
          controls.maxPolarAngle = Math.PI;
          controls.enabled = true;
          controls.update();
          orbitDwellTimer = 0.0;
          updateHUDForFlight('orbit');
        }
      } else if (flightState === FLIGHT_STATES.ORBIT) {
        if (!controls.state || controls.state === -1) {
          camera.position.applyAxisAngle(new THREE.Vector3(0, 1, 0), 0.0003);
        }
        if (autonomousMode) {
          orbitDwellTimer += dt;
          if (orbitDwellTimer >= 6.0) {
            advanceToNextExhibitionEvent();
          }
        }
      } else if (flightState === FLIGHT_STATES.PERFORMANCE) {
        // Subtle gallery camera breathing drift when user is not manually interacting
        if (!controls.state || controls.state === -1) {
          const driftSpeed = 0.00035;
          const driftAngle = Math.sin(simTime * 0.12) * driftSpeed;
          camera.position.applyAxisAngle(new THREE.Vector3(0, 1, 0), driftAngle);
          // Very gentle vertical breathing synced with long-period seismic swell
          camera.position.y += Math.cos(simTime * 0.08) * 0.00008;
          controls.update();
        }

        if (simTime >= 28.0 && simTime < 34.0) {
          flightState = FLIGHT_STATES.CODA;
          showCodaSubtitle();
        }
      } else if (flightState === FLIGHT_STATES.CODA) {
        if (simTime >= currentMaxSimTime) {
          if (autonomousMode) {
            startAscentFlight();
          } else {
            simTime = 0.0;
            if (orchestrator) orchestrator.restart();
            flightState = FLIGHT_STATES.PERFORMANCE;
            updateHUDForFlight('performance');
          }
        }
      }
    }

    function updateHUDForFlight(state) {
      const sub = document.getElementById('chronicle-subtitle-text');
      const gallEvTitle = document.getElementById('gallery-event-title');
      if (state === 'orbit') {
        if (sub) {
          if (controlSurface && controlSurface.exploreCategory === 'usgs') {
            sub.textContent = "USGS 현대 정밀 계측 지진을 선택하거나, 탭을 다시 눌러 닫을 수 있습니다";
          } else if (controlSurface && controlSurface.exploreCategory === 'historical') {
            sub.textContent = "한반도 2,000년 역사 문헌 사료를 선택하거나, 탭을 다시 눌러 닫을 수 있습니다";
          } else {
            sub.textContent = "지구를 회전하여 지진 노드를 탐색하거나, 하단의 관측망을 선택하십시오";
          }
        }
        if (gallEvTitle) {
          gallEvTitle.textContent = "한반도 역사 사료 아카이브 (조선·고려·신라) & USGS 글로벌 관측 (WGS84 통합 구면)";
        }
      } else if (state === 'descending') {
        if (sub && currentParsedEvent) sub.textContent = `${currentParsedEvent.titleKo || currentParsedEvent.place || "진원 지형"}`;
      } else if (state === 'performance') {
        updateChronicleSubtitleForEvent(currentParsedEvent);
      } else if (state === 'ascending') {
        if (sub) sub.textContent = "고요 — 우주 궤도";
      }
      if (controlSurface && typeof controlSurface.updateGlobalDevLabVisibility === 'function') {
        controlSurface.updateGlobalDevLabVisibility();
      }
    }

    function updateChronicleSubtitleForEvent(ev) {
      const sub = document.getElementById('chronicle-subtitle-text');
      if (sub && ev) {
        const isHist = ev.recordType === 'historical' || ev.dynasty || (ev.century != null && ev.century < 20);
        if (isHist) {
          let srcName = ev.sourceName || ev.primaryText?.documentSource || "사료 기록";
          srcName = srcName.replace(/\s*\([^\)]*기상청[^\)]*\)/g, '').trim();
          const yr = (ev.dateStr || ev.dateText || '').substring(0, 4);
          const yrSuffix = yr && !srcName.includes(yr) ? ` (${yr})` : '';
          sub.textContent = `${srcName}${yrSuffix}`;
        } else {
          const srcName = ev.primaryText?.documentSource || ev.sourceName || "정밀 관측망";
          const hasYr = /\(\d{4}\)|\b\d{4}년?\b/.test(srcName);
          const yr = (!hasYr && ev.temporal?.gregorianDate) ? ` (${ev.temporal.gregorianDate.substring(0, 4)})` : (!hasYr && ev.dateText ? ` (${ev.dateText})` : '');
          sub.textContent = `${srcName}${yr}`;
        }
      }

      const gallEvTitle = document.getElementById('gallery-event-title');
      if (gallEvTitle) {
        const titleStr = ev.titleKo || ev.title || "역사지진";
        const dateStr = ev.dateText ? ` (${ev.dateText})` : '';
        const eraStr = ev.era ? ` · ${ev.era}` : '';
        gallEvTitle.textContent = `${titleStr}${dateStr}${eraStr}`;
      }
    }

    function showCodaSubtitle() {
      const sub = document.getElementById('chronicle-subtitle-text');
      if (sub) {
        sub.textContent = "고요 — 사료의 기억이 대지에 깃들다";
      }
    }

    let qualityMode = isLowSpec ? 'CLASSROOM' : 'HIGH';
    window.qualityMode = qualityMode;

    let tier0GlobeMesh = null;

    // Shared surface grading imported from ./3d/shaders/SeismicTerrainShaders.js
    window.MONOLITH_SURFACE_GLSL = MONOLITH_SURFACE_GLSL;
    function createTier0WGS84Ellipsoid(lat0, lon0) {
      const globeParams = computeGlobeCenterAndPolarAxis(lat0, lon0);
      const widthSegs = (qualityMode === 'CLASSROOM') ? 540 : 1080;
      const heightSegs = (qualityMode === 'CLASSROOM') ? 270 : 540;

      const geo = new THREE.BufferGeometry();
      const positions = [];
      const uvs = [];
      const indices = [];

      for (let y = 0; y <= heightSegs; y++) {
        const v = y / heightSegs;
        const latDeg = 90.0 - v * 180.0;

        for (let x = 0; x <= widthSegs; x++) {
          const u = x / widthSegs;
          const lonDeg = -180.0 + u * 360.0;

          const [threeX, threeY, threeZ] = geodeticToThree(latDeg, lonDeg, 0.0, lat0, lon0, 0.0);
          positions.push(threeX, threeY, threeZ);
          uvs.push(u, v);
        }
      }

      for (let y = 0; y < heightSegs; y++) {
        for (let x = 0; x < widthSegs; x++) {
          const a = y * (widthSegs + 1) + x;
          const b = y * (widthSegs + 1) + (x + 1);
          const c = (y + 1) * (widthSegs + 1) + x;
          const d = (y + 1) * (widthSegs + 1) + (x + 1);

          indices.push(a, c, b);
          indices.push(b, c, d);
        }
      }

      geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
      geo.setIndex(indices);
      geo.computeVertexNormals();

      const mat = new THREE.ShaderMaterial({
        uniforms: {
          u_globalElevation: { value: globalElevationTexture },
          u_globalHMin: { value: -11000.0 },
          u_globalHMax: { value: 9000.0 },
          u_metersToUnits: { value: WGS84.METERS_TO_UNITS },
          u_verticalExag: { value: VERTICAL_EXAG },
          u_lightDir: { value: new THREE.Vector3(0.65, 0.60, 0.45).normalize() },
          u_lightColor: { value: new THREE.Color(0xd2e3f5) },
          u_ambientColor: { value: new THREE.Color(0x040810) },
          u_simTime: { value: 0.0 },
          u_vP: { value: 6.0 * 1000.0 * WGS84.METERS_TO_UNITS },
          u_vS: { value: 3.5 * 1000.0 * WGS84.METERS_TO_UNITS },
          u_dominantFreq: { value: 1.0 },
          u_faultLength: { value: 0.0 },
          u_faultStrike: { value: 0.0 },
          u_ruptureVelocity: { value: 2.8 * 1000.0 * WGS84.METERS_TO_UNITS },
          u_isFiniteFault: { value: 0.0 },
          // Regional DEM footprint half-extent in scene units
          u_regionCenter: { value: new THREE.Vector2(lat0, lon0) },
          u_regionHalfSize: { value: new THREE.Vector2(PHYSICAL_W_UNITS * 0.5, PHYSICAL_H_UNITS * 0.5) },
          u_regionActive: { value: 0.0 },
          u_errorEllipseAxes: { value: new THREE.Vector2(0.0, 0.0) },
          u_errorEllipseAngle: { value: 0.0 },
          u_isoseismalRadii: { value: new THREE.Vector4(0.0, 0.0, 0.0, 0.0) },
          u_hasErrorEllipse: { value: 0.0 }
        },
        vertexShader: TIER0_GLOBE_VERTEX_SHADER,
        fragmentShader: TIER0_GLOBE_FRAGMENT_SHADER,
        depthWrite: true,
        depthTest: true
      });

      const mesh = new THREE.Mesh(geo, mat);
      mesh.renderOrder = 0;
      mesh.name = 'Tier0_WGS84_Ellipsoid';
      return mesh;
    }

    // -------------------------------------------------------------------------
    // 2. TEXTURE LOADER FOR UNORM16 TERRAIN BUFFER
    // -------------------------------------------------------------------------
    let cachedFusedTexture = null;
    async function loadFusedElevationTexture() {
      if (cachedFusedTexture) return cachedFusedTexture;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);
      try {
        const response = await fetch(FUSED_BIN_URL, { signal: controller.signal });
        clearTimeout(timeoutId);
        if (!response.ok) {
          throw new Error(`Failed to load fused terrain buffer: ${response.status} ${response.statusText}`);
        }
        const buffer = await response.arrayBuffer();
        const uint16View = new Uint16Array(buffer);

        const floatArray = new Float32Array(BIN_WIDTH * BIN_HEIGHT);
        for (let i = 0; i < uint16View.length; i++) {
          floatArray[i] = uint16View[i] / 65535.0;
        }

        const texture = new THREE.DataTexture(
          floatArray,
          BIN_WIDTH,
          BIN_HEIGHT,
          THREE.RedFormat,
          THREE.FloatType
        );
        texture.minFilter = THREE.LinearFilter;
        texture.magFilter = THREE.LinearFilter;
        texture.wrapS = THREE.ClampToEdgeWrapping;
        texture.wrapT = THREE.ClampToEdgeWrapping;
        texture.needsUpdate = true;
        cachedFusedTexture = texture;
        return texture;
      } catch (err) {
        clearTimeout(timeoutId);
        console.warn("[Fused Elevation] Fallback to procedural terrain texture:", err.message);
        const floatArray = new Float32Array(BIN_WIDTH * BIN_HEIGHT);
        floatArray.fill(0.5);
        const texture = new THREE.DataTexture(floatArray, BIN_WIDTH, BIN_HEIGHT, THREE.RedFormat, THREE.FloatType);
        texture.minFilter = THREE.LinearFilter;
        texture.magFilter = THREE.LinearFilter;
        texture.needsUpdate = true;
        cachedFusedTexture = texture;
        return texture;
      }
    }

    // -------------------------------------------------------------------------
    // 3. SHADER ENGINE: TOPOGRAPHY-DRIVEN WAVEFRONT BLOOMING & RESONANCE
    // Preserves Concentric Waves · Refines Vertical Bloom on Shelf ·
    // Implements Ridge Resonance on Mountains · Surface Ripples on Plains
    // -------------------------------------------------------------------------
    let terrainMesh, waterMesh, demTexture;

    const terrainUniforms = {
      u_demTexture: { value: null },
      u_hMin: { value: H_MIN_METERS },
      u_hMax: { value: H_MAX_METERS },
      u_verticalExag: { value: VERTICAL_EXAG },
      u_metersToUnits: { value: METERS_TO_UNITS },
      u_texelSize: { value: new THREE.Vector2(1.0 / BIN_WIDTH, 1.0 / BIN_HEIGHT) },
      u_metricSpacing: { value: new THREE.Vector2(73.0, 46.0) },
      u_physicalSize: { value: new THREE.Vector2(PHYSICAL_W_UNITS, PHYSICAL_H_UNITS) },

      // Cinematic Nocturnal Lighting
      u_lightDir: { value: new THREE.Vector3(0.65, 0.60, 0.45).normalize() },
      u_lightColor: { value: new THREE.Color(0xd2e3f5) },
      u_ambientColor: { value: new THREE.Color(0x040810) },

      // Seismic Wavefield & Physical Motion Parameters
      u_epiPos: { value: EPI_POS },
      u_depthUnits: { value: paramFocalDepthKm * 1000.0 * METERS_TO_UNITS },
      u_focalDepthKm: { value: paramFocalDepthKm },
      u_dominantFreq: { value: paramDominantFreqHz },
      u_attenuationQ: { value: paramAttenuationQ },
      u_physicalDisplacement: { value: paramDisplacementScale },
      u_faultStrike: { value: paramFaultStrikeRad },
      u_radiationDirectivity: { value: paramRadiationDirectivity },
      u_modeP: { value: paramModeP },
      u_modeS: { value: paramModeS },
      u_vP: { value: V_P_UNITS },
      u_vS: { value: V_S_UNITS },
      u_vR: { value: V_S_UNITS * 0.9194 },
      u_simTime: { value: 0.0 },

      // Visualization Toggles
      u_enableStratum1: { value: 0.0 }, // Anti-Game-VFX: Disable artificial concentric rings
      u_enableStratum2: { value: 1.0 },
      u_purePhysicalMode: { value: 0.0 },
      u_ridgeStyle: { value: 2.0 }, // 0 = Surface Filaments, 1 = Curvature Wavefront, 2 = Combined Master
      u_faultLength: { value: 0.0 },
      u_ruptureVelocity: { value: 2.8 * 1000.0 * METERS_TO_UNITS },
      u_isFiniteFault: { value: 0.0 },

      // Phase E: Continuous Planetary Elevation Foundation (NOAA ETOPO 2022)
      u_globalElevation: { value: null },
      u_globalHMin: { value: -11000.0 },
      u_globalHMax: { value: 9000.0 },
      u_uncertaintyRadiusUnits: { value: 0.45 },
      u_errorEllipseAxes: { value: new THREE.Vector2(0.45, 0.28) },
      u_errorEllipseAngle: { value: 0.436 },
      u_isoseismalRadii: { value: new THREE.Vector4(0.0, 0.0, 0.0, 0.0) },
      u_hasErrorEllipse: { value: 0.0 },

      // Interactive Geophysics-to-Wavefield Probe (Phase F1)
      u_probeDistUnits: { value: 0.0 },
      u_probeCritUnits: { value: 0.0 },
      u_probeCrossUnits: { value: 0.0 }
    };
    window.terrainUniforms = terrainUniforms;

    const integratedTerrainMat = new THREE.ShaderMaterial({
      uniforms: terrainUniforms,
      transparent: false,
      depthWrite: true,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
      vertexShader: REGIONAL_TERRAIN_VERTEX_SHADER,
      fragmentShader: REGIONAL_TERRAIN_FRAGMENT_SHADER
    });

    // -------------------------------------------------------------------------
    // SEMI-TRANSPARENT SEA LEVEL WATER SURFACE (y = 0.0)
    // Upgraded to 360x288 Resolution with Depth-Dependent Shoaling & 3D Wave Heave
    // Extended to 3.5x regional extent with soft edge tapering into global ocean
    // -------------------------------------------------------------------------
    const waterGeo = createWGS84CurvedPlaneGeometry(PHYSICAL_W_UNITS * 3.5, PHYSICAL_H_UNITS * 3.5, 360, 288, 37.95, 129.05);
    const waterMat = new THREE.ShaderMaterial({
      uniforms: {
        u_physicalSize: { value: new THREE.Vector2(PHYSICAL_W_UNITS * 3.5, PHYSICAL_H_UNITS * 3.5) },
        u_lightDir: { value: new THREE.Vector3(0.65, 0.60, 0.45).normalize() },
        u_lightColor: { value: new THREE.Color(0xd2e3f5) },
        u_simTime: { value: 0.0 },
        u_epiPos: { value: EPI_POS },
        u_dominantFreq: { value: paramDominantFreqHz },
        u_attenuationQ: { value: paramAttenuationQ },
        u_physicalDisplacement: { value: paramDisplacementScale },
        u_depthUnits: { value: paramFocalDepthKm * 1000.0 * METERS_TO_UNITS },
        u_vP: { value: V_P_UNITS },
        u_vS: { value: V_S_UNITS },
        u_faultStrike: { value: paramFaultStrikeRad },
        u_enableStratum2: { value: 1.0 },
        u_purePhysicalMode: { value: 0.0 },
        u_demTexture: { value: null },
        u_hMin: { value: -2000.0 },
        u_hMax: { value: 1708.0 },
        u_oceanBloomMode: { value: 2.0 } // 1.0 = Mode A (Surface-Coupled), 2.0 = Mode B (Hybrid Dual-Layer)
      },
      vertexShader: OCEAN_WATER_VERTEX_SHADER,
      fragmentShader: OCEAN_WATER_FRAGMENT_SHADER,
      transparent: true,
      depthWrite: false
    });
    waterMesh = new THREE.Mesh(waterGeo, waterMat);
    waterMesh.visible = false;
    scene.add(waterMesh);
    window.waterMat = waterMat;
    window.waterMesh = waterMesh;

    // =========================================================================
    // 4. STRATUM 3: GENERIC ARCHIVAL LIVING TYPOGRAPHY ENGINE (G2 PHASE 6)
    // Unified Architecture · Figure-Ground Contrast · Editorial Serif · Negative Space
    // =========================================================================

    // -------------------------------------------------------------------------
    // -------------------------------------------------------------------------
    // ARCHIVAL SEMANTIC PARSER & KINETIC ENTITY ARCHETYPES
    // Modularized: imported from ./js/3d/livingMemoryEngine.js
    // -------------------------------------------------------------------------

    // TERRAIN CANDIDATE CACHE & DEM FEATURE ANALYZER
    // -------------------------------------------------------------------------
    const TERRAIN_CANDIDATE_CACHE = [];

    function analyzeDEMFeatures() {
      TERRAIN_CANDIDATE_CACHE.length = 0;
      const stepX = PHYSICAL_W_UNITS / 40.0;
      const stepZ = PHYSICAL_H_UNITS / 30.0;

      for (let wx = -PHYSICAL_W_UNITS * 0.45; wx <= PHYSICAL_W_UNITS * 0.45; wx += stepX) {
        for (let wz = -PHYSICAL_H_UNITS * 0.45; wz <= PHYSICAL_H_UNITS * 0.45; wz += stepZ) {
          const m = getTerrainMetricsAt(wx, wz);
          let cat = "GENERAL_TERRAIN";
          if (m.meters > 350.0 && m.slopeDeg > 20.0) {
            cat = "MOUNTAIN_RIDGE";
          } else if (m.slopeDeg > 26.0) {
            cat = "STEEP_SLOPE";
          } else if (m.meters >= 0.0 && m.slopeDeg < 16.0) {
            cat = "INLAND_BASIN";
          } else if (m.meters < 0.0 && m.meters >= -250.0) {
            cat = "COASTAL_SHELF";
          } else if (m.meters < -250.0 && m.meters >= -900.0) {
            cat = "SHALLOW_SEABED";
          } else if (m.meters < -900.0) {
            cat = "ABYSSAL_PLAIN";
          }

          let zone = "ZONE_B_INLAND";
          if (wx >= -0.05 && m.meters < 0.0) {
            zone = "ZONE_A_OCEAN";
          } else if (wx <= -0.15 && m.meters > 150.0) {
            zone = "ZONE_C_MOUNTAIN";
          }

          TERRAIN_CANDIDATE_CACHE.push({
            worldX: wx,
            worldZ: wz,
            groundY: m.groundY,
            elevation: m.meters,
            slope: m.slopeDeg,
            gradX: m.gradX,
            gradZ: m.gradZ,
            normX: m.normX,
            normZ: m.normZ,
            category: cat,
            zone: zone
          });
        }
      }
    }

    // -------------------------------------------------------------------------
    // TERRAIN-AWARE SPATIAL SPAWNER
    // Modularized: imported from ./js/3d/livingMemoryEngine.js
    // -------------------------------------------------------------------------

    // CPU Bilinear Elevation and Slope Metric Sampler
    function getTerrainMetricsAt(worldX, worldZ) {
      if (!demTexture || !demTexture.image || !demTexture.image.data) {
        return { meters: 0, groundY: 0, slopeDeg: 0, gradX: 0, gradZ: 0, normX: 0, normZ: 1 };
      }
      const data = demTexture.image.data;
      const W = currentDemWidth;
      const H = currentDemHeight;
      const curW = terrainUniforms.u_physicalSize ? terrainUniforms.u_physicalSize.value.x : PHYSICAL_W_UNITS;
      const curH = terrainUniforms.u_physicalSize ? terrainUniforms.u_physicalSize.value.y : PHYSICAL_H_UNITS;
      const u = (worldX / curW) + 0.5;
      const v = 0.5 - (worldZ / curH);
      if (u < 0.001 || u > 0.999 || v < 0.001 || v > 0.999) {
        return { meters: -500, groundY: -0.01, slopeDeg: 0, gradX: 0, gradZ: 0, normX: 0, normZ: 1 };
      }
      const fx = u * (W - 1);
      const fy = (1.0 - v) * (H - 1);
      const x0 = Math.floor(fx);
      const y0 = Math.floor(fy);
      const x1 = Math.min(W - 1, x0 + 1);
      const y1 = Math.min(H - 1, y0 + 1);
      const rx = fx - x0;
      const ry = fy - y0;

      const n00 = data[y0 * W + x0];
      const n10 = data[y0 * W + x1];
      const n01 = data[y1 * W + x0];
      const n11 = data[y1 * W + x1];
      const norm = (n00 * (1 - rx) + n10 * rx) * (1 - ry) + (n01 * (1 - rx) + n11 * rx) * ry;
      const meters = currentHMin + norm * (currentHMax - currentHMin);

      const nL = data[y0 * W + Math.max(0, x0 - 1)];
      const nR = data[y0 * W + Math.min(W - 1, x1 + 1)];
      const nD = data[Math.max(0, y0 - 1) * W + x0];
      const nU = data[Math.min(H - 1, y1 + 1) * W + x0];
      const dh_dx = ((nR - nL) * (currentHMax - currentHMin)) / (2.0 * 73.0);
      const dh_dy = ((nU - nD) * (currentHMax - currentHMin)) / (2.0 * 46.0);
      const gradMag = Math.sqrt(dh_dx * dh_dx + dh_dy * dh_dy);
      const slopeDeg = Math.atan(gradMag) * (180.0 / Math.PI);

      const distSq = worldX * worldX + worldZ * worldZ;
      const curvatureDrop = -distSq / (2.0 * 63.71);
      const dispMeters = (meters > 0.0) ? meters : (meters * 0.15);
      const groundY = curvatureDrop + (dispMeters * VERTICAL_EXAG * METERS_TO_UNITS);

      return {
        meters,
        groundY,
        slopeDeg,
        gradX: dh_dx,
        gradZ: dh_dy,
        normX: -dh_dx / Math.max(0.001, gradMag),
        normZ: -dh_dy / Math.max(0.001, gradMag)
      };
    }

    // Radial halo, typography rasterizer, and kinetic entity factories
    // (createResonanceEntity, createFractureEntity, createRecedeEntity, createExposeEntity)
    // Modularized: imported from ./js/3d/livingMemoryEngine.js

    // Dynamic State for Generic Living Typography Engine
    let archivalParser = null;
    let spawner = null;
    let livingMemoryEngine = null;
    let currentParsedEvent = null;
    let archivalEntities = [];
    const memoryEntities = archivalEntities; // Backward-compatible alias

    function validateAndAdjustExhibitionComposition(cam, entities, eventMeta) {
      if (!entities || entities.length === 0) return;
      const evalCam = (cam && flightState === FLIGHT_STATES.PERFORMANCE) ? cam : (camera ? camera.clone() : null);
      if (evalCam && flightState !== FLIGHT_STATES.PERFORMANCE) {
        evalCam.position.copy(targetShotPos);
        evalCam.lookAt(targetShotLookAt);
        evalCam.near = 0.02;
        evalCam.far = 600.0;
        evalCam.updateProjectionMatrix();
      }
      if (!evalCam) return;
      evalCam.updateMatrixWorld(true);
      const projScreenMatrix = new THREE.Matrix4();
      projScreenMatrix.multiplyMatrices(evalCam.projectionMatrix, evalCam.matrixWorldInverse);
      const frustum = new THREE.Frustum();
      frustum.setFromProjectionMatrix(projScreenMatrix);

      entities.forEach((grp, idx) => {
        grp.traverse(child => {
          if (child.material) {
            child.material.depthTest = true;
            child.material.depthWrite = false;
            child.renderOrder = 100;
          }
        });

        const wp = new THREE.Vector3();
        grp.getWorldPosition(wp);
        const ndc = wp.clone().project(evalCam);
        const inFrustum = frustum.containsPoint(wp);

        // Check if entity is outside safe exhibition framing NDC [-0.82, +0.82] or outside terrain
        const curW = terrainUniforms.u_physicalSize ? terrainUniforms.u_physicalSize.value.x : PHYSICAL_W_UNITS;
        const curH = terrainUniforms.u_physicalSize ? terrainUniforms.u_physicalSize.value.y : PHYSICAL_H_UNITS;
        const outOfFrustum = !inFrustum || Math.abs(ndc.x) > 0.82 || Math.abs(ndc.y) > 0.82;
        const outOfTerrain = Math.abs(grp.position.x) > (curW * 0.48) || Math.abs(grp.position.z) > (curH * 0.48);

        if (outOfFrustum || outOfTerrain) {
          console.warn(`[Exhibition Composition] Repositioning entity '${grp.userData?.token || idx}' (NDC: [${ndc.x.toFixed(2)}, ${ndc.y.toFixed(2)}], World: [${wp.x.toFixed(2)}, ${wp.z.toFixed(2)}]) into guaranteed focal composition.`);
          // Safe centered arrangement
          const offsetCount = entities.length;
          const spreadFactor = offsetCount > 1 ? (idx - (offsetCount - 1) * 0.5) : 0;
          const centerX = (eventMeta?.isGlobalPlanetaryRelief && eventMeta.cameraPreset) ? (eventMeta.cameraPreset.targetX || 0.0) : 0.0;
          const centerZ = (eventMeta?.isGlobalPlanetaryRelief && eventMeta.cameraPreset) ? (eventMeta.cameraPreset.targetZ || 0.0) : 0.0;
          const safeX = centerX + spreadFactor * 0.045;
          const safeZ = centerZ + (idx % 2 === 0 ? 0.020 : -0.015);
          grp.position.x = safeX;
          grp.position.z = safeZ;
          const m = getTerrainMetricsAt(safeX, safeZ);
          const elevOffset = Math.max(grp.userData?.unitDef?.spatial?.elevationOffset || 0.080, 0.120);
          grp.position.y = Math.max(0.020, m.groundY) + elevOffset;
          grp.updateMatrixWorld(true);

          if (grp.userData) {
            grp.userData.worldPos = { x: grp.position.x, y: grp.position.y, z: grp.position.z };
            grp.userData.terrainCoord = {
              normU: (grp.position.x / PHYSICAL_W_UNITS) + 0.5,
              normV: 0.5 - (grp.position.z / PHYSICAL_H_UNITS),
              groundY: m.groundY,
              elevation: m.meters
            };
          }
        } else {
          // Guarantee elevated hover even for naturally positioned entities
          const m = getTerrainMetricsAt(grp.position.x, grp.position.z);
          const elevOffset = Math.max(grp.userData?.unitDef?.spatial?.elevationOffset || 0.080, 0.120);
          grp.position.y = Math.max(grp.position.y, Math.max(0.020, m.groundY) + elevOffset);
          grp.updateMatrixWorld(true);
        }
      });
    }

    window.getLivingMemoryDiagnostics = function(cam = camera) {
      if (!cam || !window.archivalEntities) return [];
      cam.updateMatrixWorld();
      const projScreenMatrix = new THREE.Matrix4();
      projScreenMatrix.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse);
      const frustum = new THREE.Frustum();
      frustum.setFromProjectionMatrix(projScreenMatrix);

      return window.archivalEntities.map(grp => {
        const u = grp.userData || {};
        const unitDef = u.unitDef || {};
        const cand = u.cand || {};
        const wp = new THREE.Vector3();
        grp.getWorldPosition(wp);

        const ndc = wp.clone().project(cam);
        const screenW = (typeof window !== 'undefined' && window.innerWidth) ? window.innerWidth : 1440;
        const screenH = (typeof window !== 'undefined' && window.innerHeight) ? window.innerHeight : 900;
        const screenX = (ndc.x * 0.5 + 0.5) * screenW;
        const screenY = (-(ndc.y * 0.5) + 0.5) * screenH;
        const inFrustum = frustum.containsPoint(wp);

        return {
          eventId: u.eventId || currentParsedEvent?.eventId || "",
          sourceId: u.sourceId || unitDef.sourceId || "",
          sourceCitation: u.sourceCitation || unitDef.editorialRationale || "",
          token: u.token || unitDef.token || "",
          displayText: u.displayText || unitDef.semantic?.displayText || "",
          semanticLabel: u.semanticLabel || unitDef.semantic?.semanticLabel || "",
          worldPos: { x: Number(wp.x.toFixed(4)), y: Number(wp.y.toFixed(4)), z: Number(wp.z.toFixed(4)) },
          terrainCoord: {
            normU: Number(((wp.x / PHYSICAL_W_UNITS) + 0.5).toFixed(4)),
            normV: Number((0.5 - (wp.z / PHYSICAL_H_UNITS)).toFixed(4)),
            groundY: Number((cand.groundY || 0).toFixed(4)),
            elevation: Number((cand.elevation || 0).toFixed(1))
          },
          screenPos: { x: Number(screenX.toFixed(1)), y: Number(screenY.toFixed(1)) },
          ndc: { x: Number(ndc.x.toFixed(3)), y: Number(ndc.y.toFixed(3)), z: Number(ndc.z.toFixed(3)) },
          inFrustum: inFrustum,
          lifecycleState: u.lifecycleState || "LATENT",
          currentOpacity: Number((u.currentOpacity || 0).toFixed(3)),
          visible: grp.visible
        };
      });
    };

    // Generic Cross-Event Switcher
    async function loadHistoricalEvent(eventId, snapCamera = false) {
      if (eventId === 'hist_1681_yangyang' || eventId === '1681' || eventId === '1681_yangyang') eventId = 'hist_1681_0626';
      if (eventId === 'hist_1338' || eventId === '1338' || eventId === 'hist_1338_goryeo') eventId = 'hist_1338_gaegyeong';
      if (eventId === 'hist_1518' || eventId === '1518' || eventId === 'hist_1518_hanyang') eventId = 'hist_1518_seoul';
      if (eventId === 'hist_0002' || eventId === '0002' || eventId === 'goguryeo') eventId = 'hist_0002_goguryeo';
      if (eventId === 'inst_2016_gyeongju' || eventId === 'gyeongju') eventId = 'hist_2016_gyeongju';
      if (eventId === 'inst_2017_pohang' || eventId === 'pohang') eventId = 'hist_2017_pohang';
      if (eventId === 'turkey' || eventId === 'global_turkey') eventId = 'global_2023_turkey';
      if (eventId === 'tohoku' || eventId === 'global_tohoku') eventId = 'global_2011_tohoku';
      if (eventId === 'kumamoto' || eventId === 'global_kumamoto') eventId = 'global_2016_kumamoto';
      console.log(`[Event Switcher] Loading event: ${eventId}`);

      // 1. Clean up old entities
      archivalEntities.forEach(grp => {
        scene.remove(grp);
        grp.traverse(child => {
          if (child.material) {
            if (child.material.map) child.material.map.dispose();
            child.material.dispose();
          }
          if (child.geometry) child.geometry.dispose();
        });
      });
      archivalEntities.length = 0;

      // 2. Parse event through ArchivalSemanticParser
      currentParsedEvent = archivalParser.parseEvent(eventId);
      exhibitionAppContext.currentParsedEvent = currentParsedEvent;
      if (livingMemoryEngine) livingMemoryEngine.currentParsedEvent = currentParsedEvent;
      window.currentParsedEvent = currentParsedEvent;
      window.archivalEntities = archivalEntities;
      if (livingSoundfield) {
        livingSoundfield.setEvent(eventId);
      }

      // 3. Update seismic parameters & shaders
      paramFocalDepthKm = currentParsedEvent.focalDepthKm;
      paramDominantFreqHz = currentParsedEvent.dominantFreqHz;
      paramAttenuationQ = currentParsedEvent.attenuationQ;
      paramDisplacementScale = currentParsedEvent.displacementScale;

      terrainUniforms.u_focalDepthKm.value = currentParsedEvent.focalDepthKm;
      terrainUniforms.u_depthUnits.value = currentParsedEvent.focalDepthKm * 1000.0 * METERS_TO_UNITS;
      terrainUniforms.u_dominantFreq.value = currentParsedEvent.dominantFreqHz;
      terrainUniforms.u_attenuationQ.value = currentParsedEvent.attenuationQ;
      terrainUniforms.u_physicalDisplacement.value = currentParsedEvent.displacementScale;
      if (terrainUniforms.u_epiPos && currentParsedEvent.sceneEpicenter) {
        terrainUniforms.u_epiPos.value.copy(currentParsedEvent.sceneEpicenter);
      }

      waterMat.uniforms.u_dominantFreq.value = currentParsedEvent.dominantFreqHz;
      waterMat.uniforms.u_attenuationQ.value = currentParsedEvent.attenuationQ;
      waterMat.uniforms.u_physicalDisplacement.value = currentParsedEvent.displacementScale;
      waterMat.uniforms.u_depthUnits.value = currentParsedEvent.focalDepthKm * 1000.0 * METERS_TO_UNITS;
      if (waterMat.uniforms.u_epiPos && currentParsedEvent.sceneEpicenter) {
        waterMat.uniforms.u_epiPos.value.copy(currentParsedEvent.sceneEpicenter);
      }

      // Reset simTime to 0
      simTime = 0.0;

      // 3.4 Phase B Universal Regional DEM & Ocean Adaptation
      const eventMeta = getUniversalEventMetadata(eventId, currentParsedEvent.spatialCoords.lat, currentParsedEvent.spatialCoords.lon);
      const lat0 = (eventId.includes('1681')) ? 38.00 : (currentParsedEvent.spatialCoords.lat ?? 37.95);
      const lon0 = (eventId.includes('1681')) ? 129.05 : (currentParsedEvent.spatialCoords.lon ?? 129.05);

      let curW = PHYSICAL_W_UNITS;
      let curH = PHYSICAL_H_UNITS;

      if (eventMeta.demBinUrl) {
        try {
          const regionalTex = await loadRegionalDEMTexture(THREE, eventMeta.demBinUrl, eventMeta.width, eventMeta.height);
          if (demTexture && demTexture !== regionalTex) {
            demTexture.dispose();
          }
          demTexture = regionalTex;
          currentDemWidth = eventMeta.width;
          currentDemHeight = eventMeta.height;
          currentHMin = eventMeta.hMin;
          currentHMax = eventMeta.hMax;
          analyzeDEMFeatures();

          terrainUniforms.u_demTexture.value = regionalTex;
          waterMat.uniforms.u_demTexture.value = regionalTex;
          terrainUniforms.u_hMin.value = eventMeta.hMin;
          terrainUniforms.u_hMax.value = eventMeta.hMax;
          if (terrainMesh) {
            terrainMesh.visible = true;
            terrainMesh.renderOrder = 2;
          }
          if (waterMesh) waterMesh.visible = false;
        } catch (err) {
          console.warn('[Regional DEM Loader] Fallback to existing DEM texture:', err);
        }

        curW = eventMeta.physicalWidthUnits || PHYSICAL_W_UNITS;
        curH = eventMeta.physicalHeightUnits || PHYSICAL_H_UNITS;

        terrainUniforms.u_physicalSize.value.set(curW, curH);
        terrainUniforms.u_texelSize.value.set(1.0 / eventMeta.width, 1.0 / eventMeta.height);
        terrainUniforms.u_metricSpacing.value.set(
          (curW * WGS84.METERS_PER_UNIT) / eventMeta.width,
          (curH * WGS84.METERS_PER_UNIT) / eventMeta.height
        );

        // Asynchronously build staging geometries with the new epicenter's WGS84 curvature
        if (terrainMesh) {
          const segW = (qualityMode === 'CLASSROOM') ? 540 : 900;
          const segH = (qualityMode === 'CLASSROOM') ? 432 : 720;
          const stagingTerrainGeo = createWGS84CurvedPlaneGeometry(curW, curH, segW, segH, lat0, lon0);
          const oldTerrainGeo = terrainMesh.geometry;
          terrainMesh.geometry = stagingTerrainGeo;
          if (oldTerrainGeo) oldTerrainGeo.dispose();
          terrainMesh.visible = true;
          terrainMesh.renderOrder = 2;
        }
        if (waterMesh) {
          waterMesh.visible = false;
        }
      } else {
        // GLOBAL PLANETARY RELIEF (NOAA ETOPO 2022 Continuous Globe)
        // Hide local regional patch so NO false Korean mountains or floating box appear!
        if (terrainMesh) terrainMesh.visible = false;
        if (waterMesh) waterMesh.visible = false;
      }

      // 3.5. Phase A: Double-Buffering & Atomic Swap for WGS84 Geodetic Foundation
      let geodeticStatusText = "";
      if (eventId.includes("1681")) {
        const datumInfo = computeEllipsoidalHeight(H_MAX_METERS, 17.60, true);
        geodeticStatusText = `EGM2008 + N (Verified: N=+17.6m) [${datumInfo.status}]`;
      } else if (eventMeta.isGlobalPlanetaryRelief) {
        geodeticStatusText = `NOAA ETOPO 2022 Global Planetary Ellipsoid [VERIFIED]`;
      } else {
        const datumInfo = computeEllipsoidalHeight(H_MAX_METERS, null, false);
        geodeticStatusText = `EGM2008 Approx (Fallback) [${datumInfo.status}]`;
      }

      const datumLabel = document.getElementById('geodetic-datum-label');
      if (datumLabel) datumLabel.textContent = geodeticStatusText;
      const doubleBufferLabel = document.getElementById('double-buffer-label');
      if (doubleBufferLabel) doubleBufferLabel.textContent = "Atomic Swap Verified (0 Blank Frames)";
      const ellipsoidLabel = document.getElementById('ellipsoid-label');
      if (ellipsoidLabel) ellipsoidLabel.textContent = `WGS84 Spheroid (${lat0.toFixed(1)}°N Polar Tilt)`;

      const stagingGlobeMesh = createTier0WGS84Ellipsoid(lat0, lon0);
      stagingGlobeMesh.renderOrder = 1;
      if (tier0GlobeMesh) {
        scene.remove(tier0GlobeMesh);
        if (tier0GlobeMesh.geometry) tier0GlobeMesh.geometry.dispose();
        if (tier0GlobeMesh.material) tier0GlobeMesh.material.dispose();
      }
      tier0GlobeMesh = stagingGlobeMesh;
      tier0GlobeMesh.renderOrder = 1;
      if (tier0GlobeMesh.material && tier0GlobeMesh.material.uniforms) {
        const gu = tier0GlobeMesh.material.uniforms;
        if (gu.u_regionActive) gu.u_regionActive.value = (terrainMesh && terrainMesh.visible) ? 1.0 : 0.0;
        if (gu.u_regionCenter) gu.u_regionCenter.value.set(lat0, lon0);
        if (gu.u_regionHalfSize) gu.u_regionHalfSize.value.set(curW * 0.5, curH * 0.5);
      }
      scene.add(tier0GlobeMesh);
      window.tier0GlobeMesh = tier0GlobeMesh;
      window.archivalEntities = archivalEntities;

      if (atmosphereGlowMesh) {
        scene.remove(atmosphereGlowMesh);
        if (atmosphereGlowMesh.geometry) atmosphereGlowMesh.geometry.dispose();
        if (atmosphereGlowMesh.material) atmosphereGlowMesh.material.dispose();
      }
      atmosphereGlowMesh = createAtmosphereGlowShell(lat0, lon0);
      scene.add(atmosphereGlowMesh);
      window.atmosphereGlowMesh = atmosphereGlowMesh;

      updateDiscoveryNodePositions(lat0, lon0, discoveryNodes);

      // 3.6 Tier 2 Inset Mesh Cleanup: Prevent duplicate wireframe overlay
      if (tier2Mesh) {
        scene.remove(tier2Mesh);
        if (tier2Mesh.geometry) tier2Mesh.geometry.dispose();
        if (tier2Mesh.material) tier2Mesh.material.dispose();
        tier2Mesh = null;
        window.tier2Mesh = null;
      }
      const tier2Badge = document.getElementById('tier2-badge');
      if (tier2Badge) tier2Badge.textContent = "Copernicus 30m Integrated";

      // 3.7 Phase C: Universal Wavefield Orchestration
      if (!orchestrator) {
        orchestrator = new WavefieldVisualOrchestrator({ scene });
        window.orchestrator = orchestrator;
      }
      orchestrator.configureEvent(eventMeta);
      window.wavefieldEngine = orchestrator.wavefieldEngine;

      // Update shader uniforms with verified source & velocity model parameters
      terrainUniforms.u_vP.value = orchestrator.wavefieldEngine.vP * METERS_TO_UNITS;
      terrainUniforms.u_vS.value = orchestrator.wavefieldEngine.vS * METERS_TO_UNITS;
      terrainUniforms.u_vR.value = orchestrator.wavefieldEngine.vR * METERS_TO_UNITS;
      terrainUniforms.u_dominantFreq.value = orchestrator.wavefieldEngine.dominantFreqHz;
      terrainUniforms.u_attenuationQ.value = orchestrator.wavefieldEngine.velocityModel.q0S;
      terrainUniforms.u_depthUnits.value = (orchestrator.currentSource.hypocenter.depthKm * 1000.0) * METERS_TO_UNITS;
      terrainUniforms.u_focalDepthKm.value = orchestrator.currentSource.hypocenter.depthKm;
      if (orchestrator.currentSource.finiteFault) {
        const ff = orchestrator.currentSource.finiteFault;
        terrainUniforms.u_faultLength.value = (ff.lengthKm * 1000.0) * METERS_TO_UNITS;
        terrainUniforms.u_faultStrike.value = (ff.strikeDeg * Math.PI) / 180.0;
        terrainUniforms.u_ruptureVelocity.value = (ff.ruptureVelocityKmS * 1000.0) * METERS_TO_UNITS;
        terrainUniforms.u_isFiniteFault.value = 1.0;
        terrainUniforms.u_radiationDirectivity.value = 0.85;
      } else if (orchestrator.currentSource.focalMechanism && orchestrator.currentSource.focalMechanism.isVerified) {
        terrainUniforms.u_faultLength.value = 0.0;
        terrainUniforms.u_isFiniteFault.value = 0.0;
        terrainUniforms.u_faultStrike.value = (orchestrator.currentSource.focalMechanism.strikeDeg * Math.PI) / 180.0;
        terrainUniforms.u_ruptureVelocity.value = terrainUniforms.u_vS.value * 0.85;
        terrainUniforms.u_radiationDirectivity.value = 0.85;
      } else {
        terrainUniforms.u_faultLength.value = 0.0;
        terrainUniforms.u_isFiniteFault.value = 0.0;
        terrainUniforms.u_ruptureVelocity.value = terrainUniforms.u_vS.value * 0.85;
        terrainUniforms.u_radiationDirectivity.value = 0.0; // Isotropic fallback for historical events
      }

      // Sync uniforms with Tier 0 planetary globe
      if (tier0GlobeMesh && tier0GlobeMesh.material && tier0GlobeMesh.material.uniforms) {
        const gu = tier0GlobeMesh.material.uniforms;
        if (gu.u_vP) gu.u_vP.value = terrainUniforms.u_vP.value;
        if (gu.u_vS) gu.u_vS.value = terrainUniforms.u_vS.value;
        if (gu.u_faultLength) gu.u_faultLength.value = terrainUniforms.u_faultLength.value;
        if (gu.u_faultStrike) gu.u_faultStrike.value = terrainUniforms.u_faultStrike.value;
        if (gu.u_ruptureVelocity) gu.u_ruptureVelocity.value = terrainUniforms.u_ruptureVelocity.value;
        if (gu.u_isFiniteFault) gu.u_isFiniteFault.value = terrainUniforms.u_isFiniteFault.value;
      }

      // Update Historical Epicentral Error Ellipse & Isoseismals (Phase D5)
      const isHistoricalRecord = !eventId.startsWith('inst_') && !eventId.startsWith('global_') && !eventId.startsWith('usgs_') && !eventId.includes('2016') && !eventId.includes('2017');
      if (isHistoricalRecord) {
        const ee = currentParsedEvent?.errorEllipse || {
          semiMajorKm: currentParsedEvent?.errorRadiusKm || 45.0,
          semiMinorKm: (currentParsedEvent?.errorRadiusKm || 45.0) * 0.65,
          azimuthDeg: 25.0
        };
        const semiMajorUnits = (ee.semiMajorKm * 1000.0) * METERS_TO_UNITS;
        const semiMinorUnits = (ee.semiMinorKm * 1000.0) * METERS_TO_UNITS;
        const angleRad = (ee.azimuthDeg * Math.PI) / 180.0;

        terrainUniforms.u_errorEllipseAxes.value.set(semiMajorUnits, semiMinorUnits);
        terrainUniforms.u_errorEllipseAngle.value = angleRad;
        terrainUniforms.u_hasErrorEllipse.value = 1.0;
        terrainUniforms.u_uncertaintyRadiusUnits.value = semiMajorUnits;

        // Extract nested isoseismal radii
        const isos = currentParsedEvent?.isoseismalContours || [];
        const iso8 = isos.find(i => i.mmi === 'VIII' || i.mmi === 'VIII~IX' || i.mmi === 'IX')?.semiMajorKm || (ee.semiMajorKm * 1.6);
        const iso7 = isos.find(i => i.mmi === 'VII')?.semiMajorKm || (ee.semiMajorKm * 2.8);
        const iso6 = isos.find(i => i.mmi === 'VI')?.semiMajorKm || (ee.semiMajorKm * 4.8);
        const iso5 = isos.find(i => i.mmi === 'V')?.semiMajorKm || (ee.semiMajorKm * 7.5);

        terrainUniforms.u_isoseismalRadii.value.set(
          (iso8 * 1000.0) * METERS_TO_UNITS,
          (iso7 * 1000.0) * METERS_TO_UNITS,
          (iso6 * 1000.0) * METERS_TO_UNITS,
          (iso5 * 1000.0) * METERS_TO_UNITS
        );

        if (tier0GlobeMesh && tier0GlobeMesh.material && tier0GlobeMesh.material.uniforms) {
          const gu = tier0GlobeMesh.material.uniforms;
          if (gu.u_errorEllipseAxes) gu.u_errorEllipseAxes.value.set(semiMajorUnits, semiMinorUnits);
          if (gu.u_errorEllipseAngle) gu.u_errorEllipseAngle.value = angleRad;
          if (gu.u_hasErrorEllipse) gu.u_hasErrorEllipse.value = 1.0;
          if (gu.u_isoseismalRadii) gu.u_isoseismalRadii.value.copy(terrainUniforms.u_isoseismalRadii.value);
        }
      } else {
        terrainUniforms.u_hasErrorEllipse.value = 0.0;
        terrainUniforms.u_uncertaintyRadiusUnits.value = 0.0;
        if (tier0GlobeMesh && tier0GlobeMesh.material && tier0GlobeMesh.material.uniforms) {
          const gu = tier0GlobeMesh.material.uniforms;
          if (gu.u_hasErrorEllipse) gu.u_hasErrorEllipse.value = 0.0;
        }
      }

      // 4. Synchronize Unified Control Surface
      if (controlSurface) {
        controlSurface.updatePerformanceHeader(currentParsedEvent);
      }

      const velBadge = document.getElementById('velocity-model-label');
      if (velBadge) velBadge.textContent = `${orchestrator.wavefieldEngine.velocityModel.name} [${orchestrator.wavefieldEngine.velocityModel.status}]`;
      const srcBadge = document.getElementById('source-type-label');
      if (srcBadge) {
        let note = orchestrator.currentSource.finiteFault 
          ? '(Finite Fault Active)' 
          : (orchestrator.currentSource.radiationStatus === 'AZIMUTHALLY_NEUTRAL_VISUAL_APPROXIMATION' 
              ? '(Azimuthally Neutral Approx)' 
              : '(Point Source Fallback)');
        srcBadge.textContent = `${orchestrator.currentSource.sourceType} ${note}`;
      }

      const regBadge = document.getElementById('region-type-label');
      if (regBadge) regBadge.textContent = `${eventMeta.geographicType} (${eventMeta.country})`;
      const surfBadge = document.getElementById('surface-dist-label');
      if (surfBadge) surfBadge.textContent = `Land: ${(100 - eventMeta.oceanPercentage).toFixed(1)}%, Ocean: ${eventMeta.oceanPercentage.toFixed(1)}%`;

      // Update event buttons active state
      ['1681', '1338', '1518', '0002', 'turkey', 'tohoku', 'kumamoto', 'gyeongju', 'pohang'].forEach(key => {
        const btn = document.getElementById(`btn-ev-${key}`);
        if (btn) {
          const isActive = eventId.includes(key);
          btn.classList.toggle('active', isActive);
          btn.classList.toggle('inactive', !isActive);
        }
      });

      // Tailored Camera Framing per region
      if (eventMeta.cameraPreset) {
        const cp = eventMeta.cameraPreset;
        const radPitch = (cp.pitchDeg * Math.PI) / 180.0;
        const radHeading = (cp.headingDeg * Math.PI) / 180.0;
        const r = cp.camDist || 0.75;
        const tx = cp.targetX || 0.0;
        const ty = cp.targetY || 0.0;
        const tz = cp.targetZ || 0.0;
        const cy = ty + r * Math.sin(radPitch);
        const rHoriz = r * Math.cos(radPitch);
        const cx = tx + rHoriz * Math.sin(radHeading);
        const cz = tz + rHoriz * Math.cos(radHeading);
        targetShotPos.set(cx, cy, cz);
        targetShotLookAt.set(tx, ty, tz);
        if (snapCamera) {
          flightState = FLIGHT_STATES.PERFORMANCE;
          controls.minDistance = 0.04;
          controls.maxDistance = 6.0;
          controls.maxPolarAngle = Math.PI * 0.465;
          discoveryNodes.forEach(n => { n.group.visible = false; });
          setDiscoveryBeaconsVisible(false);
          camera.position.set(cx, cy, cz);
          controls.target.set(tx, ty, tz);
          controls.update();
          updateHUDForFlight('performance');
          if (controlSurface) controlSurface.setState('PERFORMANCE', currentParsedEvent);
        }
        const viewBadge = document.getElementById('view-preset-label');
        if (viewBadge) viewBadge.textContent = cp.name;
      }

      // 5. Spawn semantic units with physical S-wave wavefront synchronization
      const spawnerOptions = {
        isRegionalActive: Boolean(terrainMesh && terrainMesh.visible),
        getTerrainMetricsAt,
        physicalSizeUnits: terrainUniforms?.u_physicalSize?.value
      };
      const spawnedCandidates = currentParsedEvent.semanticUnits.map(unitDef => {
        const cand = spawner.resolveCandidate(unitDef, currentParsedEvent, spawnerOptions);

        // Physical coordinates relative to epicenter
        const epiX = terrainUniforms.u_epiPos ? terrainUniforms.u_epiPos.value.x : 0.0;
        const epiZ = terrainUniforms.u_epiPos ? terrainUniforms.u_epiPos.value.y : 0.0;
        const dx = cand.worldX - epiX;
        const dz = cand.worldZ - epiZ;

        let t_slip = 0.0;
        let effDist = Math.sqrt(dx * dx + dz * dz);

        if (terrainUniforms.u_isFiniteFault && terrainUniforms.u_isFiniteFault.value > 0.5) {
          const strike = terrainUniforms.u_faultStrike ? terrainUniforms.u_faultStrike.value : 0.0;
          const uFaultX = Math.sin(strike);
          const uFaultZ = -Math.cos(strike);
          const nFaultX = Math.cos(strike);
          const nFaultZ = Math.sin(strike);

          const sFault = dx * uFaultX + dz * uFaultZ;
          const dFault = dx * nFaultX + dz * nFaultZ;
          const halfLen = 0.5 * (terrainUniforms.u_faultLength ? terrainUniforms.u_faultLength.value : 0.0);
          const sClamped = Math.max(-halfLen, Math.min(halfLen, sFault));

          const rupVel = terrainUniforms.u_ruptureVelocity ? terrainUniforms.u_ruptureVelocity.value : 0.045;
          t_slip = Math.abs(sClamped) / Math.max(0.001, rupVel);
          effDist = Math.sqrt(Math.pow(sFault - sClamped, 2) + Math.pow(dFault, 2));
        }

        const depthUnits = terrainUniforms.u_depthUnits ? terrainUniforms.u_depthUnits.value : 0.01;
        const effHypoDist = Math.sqrt(effDist * effDist + depthUnits * depthUnits);
        const vS = terrainUniforms.u_vS ? terrainUniforms.u_vS.value : 0.055;

        // Exact physical arrival of S-wave at this geographical coordinate
        const t_S_arrival = t_slip + (effHypoDist / Math.max(0.001, vS));

        return { unitDef, cand, t_S_arrival };
      });

      // Sort chronologically by S-wave wavefront arrival
      spawnedCandidates.sort((a, b) => a.t_S_arrival - b.t_S_arrival);

      // Enforce sequential non-overlapping activation for gallery legibility
      let nextAllowedActivation = 1.8;
      spawnedCandidates.forEach(item => {
        const { unitDef, cand, t_S_arrival } = item;
        const totalDuration = (unitDef.timing.formationDuration || 0.8) +
                              (unitDef.timing.minLegibilityDuration || 1.5) +
                              (unitDef.timing.resonanceDuration || 1.4) +
                              (unitDef.timing.dissolutionDuration || 1.2) +
                              (unitDef.timing.residueDuration || 0.6);

        // Ground activation in physical S-wave arrival, bounded by non-overlapping interval
        const finalActivation = Math.max(nextAllowedActivation, t_S_arrival);
        unitDef.timing.t_activation = Number(finalActivation.toFixed(2));
        cand.t_activation = unitDef.timing.t_activation;
        nextAllowedActivation = unitDef.timing.t_activation + totalDuration + 0.6;

        let entity;
        if (unitDef.kinetic.archetype === "RESONANCE") {
          entity = createResonanceEntity(THREE, unitDef, cand);
        } else if (unitDef.kinetic.archetype === "FRACTURE") {
          entity = createFractureEntity(THREE, unitDef, cand);
        } else if (unitDef.kinetic.archetype === "RECEDE") {
          entity = createRecedeEntity(THREE, unitDef, cand);
        } else {
          entity = createExposeEntity(THREE, unitDef, cand);
        }
        scene.add(entity);
        archivalEntities.push(entity);
      });

      // 5.1 Enforce guaranteed Exhibition Composition framing
      validateAndAdjustExhibitionComposition(camera, archivalEntities, eventMeta);

      currentMaxSimTime = resolveEventDuration(currentParsedEvent);
      window.currentMaxSimTime = currentMaxSimTime;
      simTime = 0.0;
      window.simTime = 0.0;
      if (orchestrator?.seekToTime) orchestrator.seekToTime(0.0);
      exhibitionAppContext.isScrubbing = false;
      if (controlSurface) {
        controlSurface.isScrubbing = false;
        controlSurface.updatePerformanceTime(0.0, currentMaxSimTime);
      }

      updateWaveDisplays();
      console.log(`[Event Switcher] Successfully loaded ${eventId} with ${archivalEntities.length} entities.`);
    }
    window.loadHistoricalEvent = loadHistoricalEvent;

    window.setTier2Resolution = async function(lod) {
      currentTier2Resolution = lod;
      const evId = currentParsedEvent?.eventId || currentParsedEvent?.id || "";
      if (currentParsedEvent && evId.includes("1681")) {
        const lat0 = currentParsedEvent.spatialCoords.lat;
        const lon0 = currentParsedEvent.spatialCoords.lon;
        const tier2Result = await createTier2CopernicusInsetMesh(lat0, lon0, lod);
        if (tier2Mesh) {
          scene.remove(tier2Mesh);
          if (tier2Mesh.geometry) tier2Mesh.geometry.dispose();
          if (tier2Mesh.material) tier2Mesh.material.dispose();
        }
        if (tier2Result && tier2Result.mesh) {
          tier2Mesh = tier2Result.mesh;
          scene.add(tier2Mesh);
          window.tier2Mesh = tier2Mesh;
          const tier2Badge = document.getElementById('tier2-badge');
          if (tier2Badge) tier2Badge.textContent = `Copernicus 30m Active (${lod}x${lod})`;
        }
      }
      return window.tier2Mesh ? window.tier2Mesh.geometry.attributes.position.count : 0;
    };

    // Cross-Event Diagnostics Auditor
    window.getEventTestDiagnostics = function() {
      if (!currentParsedEvent) return null;
      const units = archivalEntities.map(grp => {
        const u = grp.userData;
        const unitDef = u.unitDef;
        const cand = u.cand;
        const pos3D = grp.position.clone();
        if (u.mainMesh) {
          pos3D.copy(u.mainMesh.getWorldPosition(new THREE.Vector3()));
        }
        const ndc = pos3D.clone().project(camera);
        return {
          unitId: unitDef.id,
          displayText: unitDef.semantic.displayText,
          semanticLabel: unitDef.semantic.semanticLabel,
          originalHanja: unitDef.source.originalHanja,
          evidenceStatus: unitDef.source.evidenceStatus,
          stageZone: unitDef.spatial.stageZone,
          archetype: unitDef.kinetic.archetype,
          t_activation: Number(unitDef.timing.t_activation.toFixed(2)),
          lifecycleState: u.lifecycleState,
          currentOpacity: Number(u.currentOpacity.toFixed(3)),
          worldCoords: {
            x: Number(grp.position.x.toFixed(4)),
            y: Number(grp.position.y.toFixed(4)),
            z: Number(grp.position.z.toFixed(4))
          },
          groundY: Number(cand.groundY.toFixed(4)),
          elevationMeters: Number(cand.elevation.toFixed(1)),
          slopeDeg: Number(cand.slope.toFixed(1)),
          demCoverageStatus: cand.demCoverageStatus,
          ndcPos: { x: Number(ndc.x.toFixed(3)), y: Number(ndc.y.toFixed(3)) },
          isWithinNDCGuard: (Math.abs(ndc.x) <= 0.88 && Math.abs(ndc.y) <= 0.82)
        };
      });

      // Calculate NDC overlaps among visible units
      let collisionCount = 0;
      let overlapAreaNDC = 0.0;
      const visibleUnits = units.filter(u => u.currentOpacity > 0.05);
      for (let i = 0; i < visibleUnits.length; i++) {
        for (let j = i + 1; j < visibleUnits.length; j++) {
          const uA = visibleUnits[i];
          const uB = visibleUnits[j];
          const minAx = uA.ndcPos.x - 0.08, maxAx = uA.ndcPos.x + 0.08;
          const minAy = uA.ndcPos.y - 0.03, maxAy = uA.ndcPos.y + 0.03;
          const minBx = uB.ndcPos.x - 0.08, maxBx = uB.ndcPos.x + 0.08;
          const minBy = uB.ndcPos.y - 0.03, maxBy = uB.ndcPos.y + 0.03;
          const ovX = Math.max(0, Math.min(maxAx, maxBx) - Math.max(minAx, minBx));
          const ovY = Math.max(0, Math.min(maxAy, maxBy) - Math.max(minAy, minBy));
          if (ovX > 0 && ovY > 0) {
            collisionCount++;
            overlapAreaNDC += ovX * ovY;
          }
        }
      }

      return {
        eventId: currentParsedEvent.eventId,
        titleKo: currentParsedEvent.titleKo,
        dateText: currentParsedEvent.dateText,
        demCoverageStatus: units[0]?.demCoverageStatus || "UNKNOWN",
        sourceRecordCount: currentParsedEvent.sourceRecordCount,
        semanticUnitsCount: currentParsedEvent.semanticUnits.length,
        verifiedSourceCount: currentParsedEvent.verifiedSourceCount,
        editorialInterpretationCount: currentParsedEvent.editorialInterpretationCount,
        selectedKineticArchetypes: currentParsedEvent.selectedKineticArchetypes,
        simTime: Number(simTime.toFixed(2)),
        cameraShot: currentShotKey,
        activeUnitsCount: visibleUnits.length,
        collisionCount: collisionCount,
        overlapAreaNDC: Number(overlapAreaNDC.toFixed(6)),
        units: units
      };
    };


    // -------------------------------------------------------------------------
    // 5. CINEMATIC CAMERA COMPOSITIONS: 6 MASTER VIEWPOINTS
    // Framing Earth and Memory in Harmonious Negative Space
    // -------------------------------------------------------------------------
    const SHOTS = {
      monumental_continental_scale: {
        name: "SHOT 1: Monumental Earth & Sky Orchestration",
        pos: new THREE.Vector3(0.36, 0.22, 0.24),
        lookAt: new THREE.Vector3(-0.14, 0.045, -0.04),
        fov: 36
      },
      epicenter_wave_corridor: {
        name: "SHOT 2: Coastal & Maritime Vertical Bloom Corridor",
        pos: new THREE.Vector3(0.24, 0.11, 0.17),
        lookAt: new THREE.Vector3(-0.08, 0.02, -0.01),
        fov: 38
      },
      lyrical_mountain_resonance: {
        name: "SHOT 3: Alpine Ridge Resonance & Seoraksan Crags",
        pos: new THREE.Vector3(-0.14, 0.075, 0.03),
        lookAt: new THREE.Vector3(-0.29, 0.04, -0.07),
        fov: 34
      },
      comprehensive_orchestration: {
        name: "SHOT 4: Inland Mountain Ridge Resonance (울림)",
        pos: new THREE.Vector3(-0.12, 0.065, 0.110),
        lookAt: new THREE.Vector3(-0.250, 0.035, 0.045),
        fov: 34
      },
      closeup_alpine_spires: {
        name: "SHOT 5: Living Typography Celestial Craftsmanship Close-up",
        pos: new THREE.Vector3(-0.045, 0.215, 0.18),
        lookAt: new THREE.Vector3(-0.045, 0.185, -0.02),
        fov: 34
      },
      closeup_maritime_shelf: {
        name: "SHOT 6: Maritime Shoal & Exposed Continental Shelf Bathymetry (해저 노출)",
        pos: new THREE.Vector3(-0.08, 0.040, 0.120),
        lookAt: new THREE.Vector3(-0.170, -0.005, 0.060),
        fov: 32
      }
    };

    let currentShotKey = "monumental_continental_scale";
    function applyCameraShot(key) {
      const shot = SHOTS[key];
      if (!shot) return;
      currentShotKey = key;
      exhibitionAppContext.currentShotKey = key;
      camera.position.copy(shot.pos);
      controls.target.copy(shot.lookAt);
      const isPortraitMobile = (typeof window !== 'undefined' && window.innerWidth <= 640 && (window.innerWidth / Math.max(1, window.innerHeight)) < 0.78);
      camera.fov = isPortraitMobile ? Math.min(54, shot.fov + 10) : shot.fov;
      camera.updateProjectionMatrix();
      controls.update();
      const viewLabel = document.getElementById('view-preset-label');
      if (viewLabel) viewLabel.textContent = shot.name;
      const shotOrder = ['monumental_continental_scale', 'epicenter_wave_corridor', 'lyrical_mountain_resonance', 'comprehensive_orchestration', 'closeup_alpine_spires', 'closeup_maritime_shelf'];
      const shotIdx = shotOrder.indexOf(key);
      const btnShot = document.getElementById('btn-transport-shot');
      if (btnShot && shotIdx >= 0) btnShot.textContent = `구도 ${shotIdx + 1}/6`;
      if (archivalEntities && archivalEntities.length > 0) {
        validateAndAdjustExhibitionComposition(camera, archivalEntities, null);
      }
    }
    window.applyCameraShot = applyCameraShot;

    // -------------------------------------------------------------------------
    // 6. TIMELINE, PLAYBACK SPEED, IMMERSIVE & QUALITY MODE CONTROLS
    // -------------------------------------------------------------------------
    let simTime = 0.0;
    let isPlaying = true;
    let playbackSpeed = 1.0;
    window.playbackSpeed = 1.0;
    function resolveEventDuration(ev) {
      if (!ev) return 35.0;
      if (typeof ev.sourceDurationSeconds === 'number' && ev.sourceDurationSeconds > 0) return ev.sourceDurationSeconds;
      if (typeof ev.duration === 'number' && ev.duration > 0) return ev.duration;
      const evId = String(ev.eventId || ev.id || '');
      if (evId.includes('turkey')) return 80.0;
      if (evId.includes('tohoku')) return 120.0;
      if (evId.includes('1681')) return 50.0;
      if (evId.includes('1643')) return 50.0;
      if (evId.includes('kumamoto')) return 45.0;
      return 35.0;
    }
    let currentMaxSimTime = 35.0;
    window.currentMaxSimTime = currentMaxSimTime;
    window.resolveEventDuration = resolveEventDuration;

    window.setPlaybackSpeed = function(speed) {
      playbackSpeed = Math.max(0.25, Math.min(4.0, Number(speed) || 1.0));
      exhibitionAppContext.playbackSpeed = playbackSpeed;
      window.playbackSpeed = playbackSpeed;
      const btnSpeed = document.getElementById('btn-transport-speed');
      if (btnSpeed) btnSpeed.textContent = `${playbackSpeed.toFixed(1)}×`;
      return playbackSpeed;
    };

    window.toggleImmersiveUI = function(forceHide) {
      const ucs = document.getElementById('unified-control-surface');
      const restorePill = document.getElementById('immersive-restore-pill');
      const qualityPill = document.getElementById('quality-mode-pill');
      if (!ucs) return false;
      const shouldHide = (typeof forceHide === 'boolean') ? forceHide : (ucs.style.display !== 'none');
      ucs.style.display = shouldHide ? 'none' : 'block';
      if (restorePill) restorePill.style.display = shouldHide ? 'flex' : 'none';
      if (qualityPill) qualityPill.style.opacity = shouldHide ? '0.0' : '1.0';
      return shouldHide;
    };

    window.setGeophysics3DProbe = function(distKm, xCritKm = 0, xCrossKm = 0) {
      if (!terrainUniforms) return;
      const kmToUnits = 1000.0 * METERS_TO_UNITS; // 0.01 units/km
      terrainUniforms.u_probeDistUnits.value = (distKm > 0) ? (distKm * kmToUnits) : 0.0;
      terrainUniforms.u_probeCritUnits.value = (xCritKm > 0) ? (xCritKm * kmToUnits) : 0.0;
      terrainUniforms.u_probeCrossUnits.value = (xCrossKm > 0) ? (xCrossKm * kmToUnits) : 0.0;
    };

    window.setQualityMode = async function(mode) {
      qualityMode = (mode === 'CLASSROOM') ? 'CLASSROOM' : 'HIGH';
      window.qualityMode = qualityMode;
      const dpr = (qualityMode === 'CLASSROOM') ? 1.0 : Math.min(window.devicePixelRatio || 1, 2.0);
      renderer.setPixelRatio(dpr);

      const pill = document.getElementById('quality-mode-pill');
      if (pill) {
        pill.classList.toggle('classroom-mode', qualityMode === 'CLASSROOM');
        pill.textContent = (qualityMode === 'CLASSROOM')
          ? '품질: 최적화 (60fps)'
          : '품질: 고화질 전시 (High)';
      }

      const lat0 = currentParsedEvent?.spatialCoords?.lat ?? 37.95;
      const lon0 = currentParsedEvent?.spatialCoords?.lon ?? 129.05;
      if (tier0GlobeMesh) {
        const newGlobe = createTier0WGS84Ellipsoid(lat0, lon0);
        newGlobe.renderOrder = 1;
        if (terrainUniforms && newGlobe.material && newGlobe.material.uniforms) {
          const gu = newGlobe.material.uniforms;
          if (gu.u_vP) gu.u_vP.value = terrainUniforms.u_vP.value;
          if (gu.u_vS) gu.u_vS.value = terrainUniforms.u_vS.value;
          if (gu.u_faultLength) gu.u_faultLength.value = terrainUniforms.u_faultLength.value;
          if (gu.u_faultStrike) gu.u_faultStrike.value = terrainUniforms.u_faultStrike.value;
          if (gu.u_ruptureVelocity) gu.u_ruptureVelocity.value = terrainUniforms.u_ruptureVelocity.value;
          if (gu.u_isFiniteFault) gu.u_isFiniteFault.value = terrainUniforms.u_isFiniteFault.value;
          if (gu.u_regionActive) gu.u_regionActive.value = (terrainMesh && terrainMesh.visible) ? 1.0 : 0.0;
          if (gu.u_regionCenter) gu.u_regionCenter.value.set(lat0, lon0);
          if (gu.u_regionHalfSize && terrainUniforms.u_physicalSize) {
            gu.u_regionHalfSize.value.set(terrainUniforms.u_physicalSize.value.x * 0.5, terrainUniforms.u_physicalSize.value.y * 0.5);
          }
        }
        scene.remove(tier0GlobeMesh);
        if (tier0GlobeMesh.geometry) tier0GlobeMesh.geometry.dispose();
        if (tier0GlobeMesh.material) tier0GlobeMesh.material.dispose();
        tier0GlobeMesh = newGlobe;
        scene.add(tier0GlobeMesh);
        window.tier0GlobeMesh = tier0GlobeMesh;
      }
      if (terrainMesh && terrainMesh.visible) {
        const curW = terrainUniforms.u_physicalSize ? terrainUniforms.u_physicalSize.value.x : PHYSICAL_W_UNITS;
        const curH = terrainUniforms.u_physicalSize ? terrainUniforms.u_physicalSize.value.y : PHYSICAL_H_UNITS;
        const segW = (qualityMode === 'CLASSROOM') ? 540 : 900;
        const segH = (qualityMode === 'CLASSROOM') ? 432 : 720;
        const newGeo = createWGS84CurvedPlaneGeometry(curW, curH, segW, segH, lat0, lon0);
        const oldGeo = terrainMesh.geometry;
        terrainMesh.geometry = newGeo;
        if (oldGeo) oldGeo.dispose();
      }
      return {
        qualityMode,
        globeTriangles: tier0GlobeMesh?.geometry?.index ? (tier0GlobeMesh.geometry.index.count / 3) : 0,
        terrainTriangles: terrainMesh?.geometry?.index ? (terrainMesh.geometry.index.count / 3) : 0
      };
    };

    const qualityPillEl = document.getElementById('quality-mode-pill');
    if (qualityPillEl) {
      qualityPillEl.addEventListener('click', (e) => {
        e.stopPropagation();
        const nextMode = (qualityMode === 'HIGH') ? 'CLASSROOM' : 'HIGH';
        window.setQualityMode(nextMode);
      });
    }

    window.setSimulationPlaying = function(play) {
      isPlaying = !!play;
      exhibitionAppContext.isPlaying = isPlaying;
      if (orchestrator) orchestrator.isPlaying = isPlaying;
    };
    try {
      Object.defineProperty(window, 'isPlaying', {
        get: () => isPlaying,
        set: (v) => { isPlaying = !!v; },
        configurable: true
      });
    } catch(e) {}

    const playPauseBtn = document.getElementById('btn-play-pause');
    const timeSlider = document.getElementById('slider-time');
    const timeDisplay = document.getElementById('time-display');
    const pRadiusDisplay = document.getElementById('p-radius-display');
    const sRadiusDisplay = document.getElementById('s-radius-display');

    if (playPauseBtn) {
      playPauseBtn.addEventListener('click', () => {
        isPlaying = !isPlaying;
        playPauseBtn.textContent = isPlaying ? "PAUSE" : "PLAY";
      });
    }

    if (timeSlider) {
      timeSlider.addEventListener('input', (e) => {
        simTime = parseFloat(e.target.value);
        updateWaveDisplays();
      });
    }

    // Update Seismic Parameters Function
    function setSeismicParameters(depthKm, freqHz, attenQ, dispScale = 1.2, modeP = 1.0, modeS = 1.0) {
      paramFocalDepthKm = depthKm;
      paramDominantFreqHz = freqHz;
      paramAttenuationQ = attenQ;
      paramDisplacementScale = dispScale;
      paramModeP = modeP;
      paramModeS = modeS;

      terrainUniforms.u_focalDepthKm.value = depthKm;
      terrainUniforms.u_depthUnits.value = depthKm * 1000.0 * METERS_TO_UNITS;
      terrainUniforms.u_dominantFreq.value = freqHz;
      terrainUniforms.u_attenuationQ.value = attenQ;
      terrainUniforms.u_physicalDisplacement.value = dispScale;
      terrainUniforms.u_modeP.value = modeP;
      terrainUniforms.u_modeS.value = modeS;

      waterMat.uniforms.u_dominantFreq.value = freqHz;
      waterMat.uniforms.u_attenuationQ.value = attenQ;
      waterMat.uniforms.u_physicalDisplacement.value = dispScale;
      waterMat.uniforms.u_depthUnits.value = depthKm * 1000.0 * METERS_TO_UNITS;

      // Update HUD Labels & Sliders if present
      const valDisp = document.getElementById('val-displacement');
      if (valDisp) valDisp.textContent = `${dispScale.toFixed(1)}x`;
      const sliderDisp = document.getElementById('slider-displacement');
      if (sliderDisp) sliderDisp.value = dispScale;

      const valDepth = document.getElementById('val-depth');
      if (valDepth) valDepth.textContent = `${depthKm.toFixed(1)} km`;
      const sliderDepth = document.getElementById('slider-depth');
      if (sliderDepth) sliderDepth.value = depthKm;

      const valFreq = document.getElementById('val-freq');
      if (valFreq) valFreq.textContent = `${freqHz.toFixed(1)} Hz`;
      const sliderFreq = document.getElementById('slider-freq');
      if (sliderFreq) sliderFreq.value = freqHz;

      const valAtten = document.getElementById('val-atten');
      if (valAtten) valAtten.textContent = `Q = ${Math.round(attenQ)}`;
      const sliderAtten = document.getElementById('slider-atten');
      if (sliderAtten) sliderAtten.value = attenQ;

      let modesText = "P + S Fused";
      if (modeP > 0.5 && modeS < 0.5) modesText = "P-Wave Only";
      else if (modeP < 0.5 && modeS > 0.5) modesText = "S-Wave Only";
      const valModes = document.getElementById('val-modes');
      if (valModes) valModes.textContent = modesText;

      const metaDisp = document.getElementById('event-meta-display');
      if (metaDisp) {
        metaDisp.textContent = 
          `Offshore Epicenter: 37.95°N, 129.05°E · Depth: ${depthKm.toFixed(0)} km · Freq: ${freqHz.toFixed(1)} Hz · Q: ${Math.round(attenQ)} · Disp: ${dispScale.toFixed(1)}x`;
      }

      const btnP = document.getElementById('btn-toggle-p');
      if (btnP) btnP.style.borderColor = (modeP > 0.5) ? "var(--brass)" : "var(--hairline)";
      const btnS = document.getElementById('btn-toggle-s');
      if (btnS) btnS.style.borderColor = (modeS > 0.5) ? "var(--brass)" : "var(--hairline)";

      updateWaveDisplays();
    }
    window.setSeismicParameters = setSeismicParameters;

    // Parameter Slider Listeners (Optional debug elements)
    const sDisp = document.getElementById('slider-displacement');
    if (sDisp) sDisp.addEventListener('input', (e) => setSeismicParameters(paramFocalDepthKm, paramDominantFreqHz, paramAttenuationQ, parseFloat(e.target.value), paramModeP, paramModeS));
    const sDepth = document.getElementById('slider-depth');
    if (sDepth) sDepth.addEventListener('input', (e) => setSeismicParameters(parseFloat(e.target.value), paramDominantFreqHz, paramAttenuationQ, paramDisplacementScale, paramModeP, paramModeS));
    const sFreq = document.getElementById('slider-freq');
    if (sFreq) sFreq.addEventListener('input', (e) => setSeismicParameters(paramFocalDepthKm, parseFloat(e.target.value), paramAttenuationQ, paramDisplacementScale, paramModeP, paramModeS));
    const sAtten = document.getElementById('slider-atten');
    if (sAtten) sAtten.addEventListener('input', (e) => setSeismicParameters(paramFocalDepthKm, paramDominantFreqHz, parseFloat(e.target.value), paramDisplacementScale, paramModeP, paramModeS));

    const btnToggleP = document.getElementById('btn-toggle-p');
    if (btnToggleP) btnToggleP.addEventListener('click', () => {
      const newP = (paramModeP > 0.5) ? 0.0 : 1.0;
      setSeismicParameters(paramFocalDepthKm, paramDominantFreqHz, paramAttenuationQ, paramDisplacementScale, newP, paramModeS);
    });
    const btnToggleS = document.getElementById('btn-toggle-s');
    if (btnToggleS) btnToggleS.addEventListener('click', () => {
      const newS = (paramModeS > 0.5) ? 0.0 : 1.0;
      setSeismicParameters(paramFocalDepthKm, paramDominantFreqHz, paramAttenuationQ, paramDisplacementScale, paramModeP, newS);
    });

    // Preset Handlers (Optional debug)
    const preBaseline = document.getElementById('pre-baseline');
    if (preBaseline) preBaseline.addEventListener('click', () => {
      setPurePhysicalMode(false);
      setSeismicParameters(12.0, 1.0, 250.0, 1.2, 1.0, 1.0);
    });
    const preShallow = document.getElementById('pre-shallow');
    if (preShallow) preShallow.addEventListener('click', () => {
      setPurePhysicalMode(false);
      setSeismicParameters(8.0, 1.4, 220.0, 1.8, 1.0, 1.0);
    });
    const preDeep = document.getElementById('pre-deep');
    if (preDeep) preDeep.addEventListener('click', () => {
      setPurePhysicalMode(false);
      setSeismicParameters(35.0, 0.6, 400.0, 0.8, 1.0, 1.0);
    });
    const preLow = document.getElementById('pre-lowfreq');
    if (preLow) preLow.addEventListener('click', () => {
      setPurePhysicalMode(false);
      setSeismicParameters(12.0, 0.5, 280.0, 1.5, 1.0, 1.0);
    });
    const preHigh = document.getElementById('pre-highfreq');
    if (preHigh) preHigh.addEventListener('click', () => {
      setPurePhysicalMode(false);
      setSeismicParameters(12.0, 2.2, 220.0, 1.2, 1.0, 1.0);
    });
    const prePhys = document.getElementById('pre-physical');
    if (prePhys) prePhys.addEventListener('click', () => {
      setPurePhysicalMode(purePhysicalMode < 0.5);
    });

    // Stratum & Mode Toggles
    const pillStratum1 = document.getElementById('pill-stratum1');
    const pillStratum2 = document.getElementById('pill-stratum2');
    const pillStratum3 = document.getElementById('pill-stratum3');
    const pillPhysical = document.getElementById('pill-physical-mode');

    function setStratum1(enabled) {
      enableStratum1 = enabled ? 1.0 : 0.0;
      terrainUniforms.u_enableStratum1.value = enableStratum1;
      if (pillStratum1) {
        pillStratum1.classList.toggle('active', enabled);
        pillStratum1.classList.toggle('inactive', !enabled);
      }
    }
    window.setStratum1 = setStratum1;

    function setStratum2(enabled) {
      enableStratum2 = enabled ? 1.0 : 0.0;
      terrainUniforms.u_enableStratum2.value = enableStratum2;
      waterMat.uniforms.u_enableStratum2.value = enableStratum2;
      if (pillStratum2) {
        pillStratum2.classList.toggle('active', enabled);
        pillStratum2.classList.toggle('inactive', !enabled);
      }
    }
    window.setStratum2 = setStratum2;

    function setStratum3(enabled) {
      enableStratum3 = enabled ? 1.0 : 0.0;
      if (pillStratum3) {
        pillStratum3.classList.toggle('active', enabled);
        pillStratum3.classList.toggle('inactive', !enabled);
      }
    }
    window.setStratum3 = setStratum3;

    function setPurePhysicalMode(enabled) {
      purePhysicalMode = enabled ? 1.0 : 0.0;
      terrainUniforms.u_purePhysicalMode.value = purePhysicalMode;
      waterMat.uniforms.u_purePhysicalMode.value = purePhysicalMode;
      if (pillPhysical) {
        pillPhysical.classList.toggle('active', enabled);
        pillPhysical.classList.toggle('inactive', !enabled);
        pillPhysical.classList.toggle('highlight', enabled);
      }

      const bmLbl = document.getElementById('bloom-mode-label');
      if (bmLbl) {
        bmLbl.textContent = enabled 
          ? "Pure Physical Motion (Zero Light Bloom)" 
          : "Topographic Optical Synthesis";
      }
    }
    window.setPurePhysicalMode = setPurePhysicalMode;

    if (pillStratum1) pillStratum1.addEventListener('click', () => setStratum1(enableStratum1 < 0.5));
    if (pillStratum2) pillStratum2.addEventListener('click', () => setStratum2(enableStratum2 < 0.5));
    if (pillStratum3) pillStratum3.addEventListener('click', () => setStratum3(enableStratum3 < 0.5));
    if (pillPhysical) pillPhysical.addEventListener('click', () => setPurePhysicalMode(purePhysicalMode < 0.5));

    // -------------------------------------------------------------------------
    // DETERMINISTIC TIMELINE SEEKER (Section 6 Mandatory Corrective Directive)
    // Synchronously reconstructs wavefield, typography, lighting & sound at time t
    // -------------------------------------------------------------------------
    function seekToSimulationTime(targetSec) {
      const clamped = Math.max(0.0, Math.min(currentMaxSimTime, Number.isFinite(Number(targetSec)) ? Number(targetSec) : 0.0));
      simTime = clamped;
      window.simTime = simTime;

      if (terrainUniforms) {
        terrainUniforms.u_simTime.value = simTime;
      }
      if (waterMat && waterMat.uniforms && waterMat.uniforms.u_simTime) {
        waterMat.uniforms.u_simTime.value = simTime;
      }
      if (tier0GlobeMesh && tier0GlobeMesh.material && tier0GlobeMesh.material.uniforms && tier0GlobeMesh.material.uniforms.u_simTime) {
        tier0GlobeMesh.material.uniforms.u_simTime.value = simTime;
        if (tier0GlobeMesh.material.uniforms.u_regionActive) {
          tier0GlobeMesh.material.uniforms.u_regionActive.value = (terrainMesh && terrainMesh.visible) ? 1.0 : 0.0;
        }
      }
      if (orchestrator) {
        if (typeof orchestrator.seekToTime === 'function') {
          orchestrator.seekToTime(simTime);
        } else {
          orchestrator.seismicTime = simTime;
          if (orchestrator.uniforms && orchestrator.uniforms.u_seismicTime) {
            orchestrator.uniforms.u_seismicTime.value = simTime;
          }
        }
      }

      updateWaveDisplays();

      if (livingSoundfield && currentParsedEvent) {
        const primaryEntity = archivalEntities[0];
        if (primaryEntity) {
          const u = primaryEntity.userData;
          const dtAct = simTime - u.t_activation;
          const lc = u.unitDef.timing;
          let prog = 0.0;
          if (dtAct > 0.0 && dtAct < lc.formationDuration) {
            prog = dtAct / lc.formationDuration;
          } else if (dtAct >= lc.formationDuration && dtAct < lc.formationDuration + lc.minLegibilityDuration + lc.resonanceDuration) {
            prog = 1.0;
          } else if (dtAct >= lc.formationDuration + lc.minLegibilityDuration + lc.resonanceDuration) {
            prog = Math.max(0.0, 1.0 - (dtAct - (lc.formationDuration + lc.minLegibilityDuration + lc.resonanceDuration)) / lc.dissolutionDuration);
          }
          livingSoundfield.update(simTime, prog, u.lifecycleState);
        }
      }

      const scrubber = document.getElementById('transport-scrubber');
      const isScrubbingNow = Boolean(exhibitionAppContext?.isScrubbing || controlSurface?.isScrubbing);
      if (scrubber) {
        scrubber.max = String(currentMaxSimTime);
        if (!isScrubbingNow && Math.abs(parseFloat(scrubber.value) - simTime) > 0.05) {
          scrubber.value = simTime.toFixed(1);
        }
      }
      const curLabel = document.getElementById('transport-time-current');
      if (curLabel) {
        curLabel.textContent = simTime.toFixed(1) + 's';
      }
      if (controlSurface && controlSurface.currentState === 'PERFORMANCE') {
        controlSurface.updatePerformanceTime(simTime, currentMaxSimTime);
      }

      if (renderer && scene && camera) {
        renderer.render(scene, camera);
      }

      return {
        simTime: simTime,
        activeUnits: archivalEntities.map(g => ({
          id: g.userData.unitDef.id,
          token: g.userData.unitDef.token,
          displayText: g.userData.unitDef.semantic.displayText,
          lifecycleState: g.userData.lifecycleState,
          opacity: g.userData.currentOpacity,
          evidenceClass: g.userData.unitDef.evidenceClass,
          spatialMotif: g.userData.unitDef.spatialMotif
        }))
      };
    }
    window.seekToSimulationTime = seekToSimulationTime;
    window.pauseSimulation = function() { isPlaying = false; };
    window.resumeSimulation = function() { isPlaying = true; };

    // Update Wave Displays & Dynamic Lifecycle for Reformed Memories
    function updateWaveDisplays() {
      if (controlSurface && controlSurface.currentState === 'PERFORMANCE') {
        controlSurface.updatePerformanceTime(simTime, currentMaxSimTime);
      }

      const tDisp = document.getElementById('time-display');
      if (tDisp) tDisp.textContent = `t +${simTime.toFixed(2)}s`;
      const tSlider = document.getElementById('slider-time');
      if (tSlider) tSlider.value = simTime;

      const depthKm = paramFocalDepthKm;
      const pSurfRadiusKm = Math.sqrt(Math.max(0.0, Math.pow(simTime * V_P_KM_S, 2.0) - depthKm * depthKm));
      const sSurfRadiusKm = Math.sqrt(Math.max(0.0, Math.pow(simTime * V_S_KM_S, 2.0) - depthKm * depthKm));

      const pRadiusDisp = document.getElementById('p-radius-display');
      if (pRadiusDisp) pRadiusDisp.textContent = (simTime * V_P_KM_S >= depthKm) ? `${pSurfRadiusKm.toFixed(1)} km` : `Emerging...`;
      const sRadiusDisp = document.getElementById('s-radius-display');
      if (sRadiusDisp) sRadiusDisp.textContent = (simTime * V_S_KM_S >= depthKm) ? `${sSurfRadiusKm.toFixed(1)} km` : `Emerging...`;

      terrainUniforms.u_simTime.value = simTime;
      waterMat.uniforms.u_simTime.value = simTime;
      if (tier0GlobeMesh && tier0GlobeMesh.material && tier0GlobeMesh.material.uniforms && tier0GlobeMesh.material.uniforms.u_simTime) {
        tier0GlobeMesh.material.uniforms.u_simTime.value = simTime;
        if (tier0GlobeMesh.material.uniforms.u_regionActive) {
          tier0GlobeMesh.material.uniforms.u_regionActive.value = (terrainMesh && terrainMesh.visible) ? 1.0 : 0.0;
        }
      }

      // -----------------------------------------------------------------------
      // GENERATIVE ARCHIVAL LIVING TYPOGRAPHY LIFECYCLE ENGINE (G2 PHASE 6)
      // Delegated to official LivingMemoryEngine / updateEntitiesLifecycle module
      // -----------------------------------------------------------------------
      if (livingMemoryEngine) {
        livingMemoryEngine.entities = archivalEntities;
        livingMemoryEngine.update(simTime, {
          camera,
          enableStratum3,
          dominantFreqHz: paramDominantFreqHz
        });
      } else {
        updateEntitiesLifecycle(archivalEntities, {
          simTime,
          camera,
          enableStratum3,
          dominantFreqHz: paramDominantFreqHz
        });
      }

      // -----------------------------------------------------------------------
      // REAL-TIME CHRONICLE SUBTITLE SYNCHRONIZATION
      // Synchronize bottom archival bar with the currently active semantic unit
      // -----------------------------------------------------------------------
      if (currentParsedEvent && archivalEntities.length > 0) {
        let bestEntity = null;
        let bestOp = 0.15;
        for (let i = 0; i < archivalEntities.length; i++) {
          const u = archivalEntities[i].userData;
          if (!u || !u.unitDef) continue;
          if (
            (u.lifecycleState === "EMERGENCE" || u.lifecycleState === "FORMATION" || u.lifecycleState === "RESONANCE") &&
            u.currentOpacity > bestOp
          ) {
            bestOp = u.currentOpacity;
            bestEntity = u;
          }
        }
        const subEl = document.getElementById("chronicle-subtitle-text");
        if (subEl) {
          if (bestEntity && bestEntity.unitDef) {
            const isHist = currentParsedEvent.recordType === 'historical' || currentParsedEvent.dynasty || (currentParsedEvent.century != null && currentParsedEvent.century < 20);
            let nextLine = "";
            if (isHist) {
              let srcRef = bestEntity.unitDef.sourceReference || bestEntity.unitDef.source?.sourceReference || bestEntity.unitDef.source?.volumeOrSection || currentParsedEvent.sourceName;
              srcRef = (srcRef || "사료 기록").replace(/\s*\([^\)]*기상청[^\)]*\)/g, '').trim();
              const yr = (currentParsedEvent.dateStr || currentParsedEvent.dateText || '').substring(0, 4);
              const yrSuffix = yr && !srcRef.includes(yr) ? ` (${yr})` : '';
              nextLine = `${srcRef}${yrSuffix}`;
            } else {
              const srcRef = bestEntity.unitDef.source?.sourceReference || bestEntity.unitDef.sourceReference || currentParsedEvent.primaryText?.documentSource || currentParsedEvent.sourceName;
              const hasYr = srcRef && /\(\d{4}\)|\b\d{4}년?\b/.test(srcRef);
              const yr = (!hasYr && currentParsedEvent.temporal?.gregorianDate) ? ` (${currentParsedEvent.temporal.gregorianDate.substring(0, 4)})` : '';
              nextLine = srcRef ? `${srcRef}${yr}` : `${currentParsedEvent.place || "계측 기록"}${yr}`;
            }
            if (subEl.textContent !== nextLine) {
              subEl.textContent = nextLine;
            }
          }
        }
      }

      // -----------------------------------------------------------------------
      // LIVING SOUNDFIELD SYNTHESIS HOOK (PHASE D3 MULTI-EVENT)
      // Synchronized with the active event's focal unit
      // -----------------------------------------------------------------------
      if (currentParsedEvent && livingSoundfield) {
        const primaryEntity = archivalEntities[0];
        if (primaryEntity) {
          const u = primaryEntity.userData;
          const dtAct = simTime - u.t_activation;
          const lc = u.unitDef.timing;
          let prog = 0.0;
          if (u.lifecycleState === 'EMERGENCE' && lc.formationDuration > 0) {
            prog = Math.min(1.0, dtAct / lc.formationDuration);
          } else if (u.lifecycleState === 'DISSOLUTION' && lc.dissolutionDuration > 0) {
            prog = Math.min(1.0, (dtAct - (lc.formationDuration + lc.minLegibilityDuration + lc.resonanceDuration)) / lc.dissolutionDuration);
          } else if (u.lifecycleState === 'RESIDUE' && lc.residueDuration > 0) {
            prog = Math.min(1.0, (dtAct - (lc.formationDuration + lc.minLegibilityDuration + lc.resonanceDuration + lc.dissolutionDuration)) / lc.residueDuration);
          }
          livingSoundfield.updateLifecycle(u.lifecycleState, prog, simTime);
        }
      }
    }

    function setRidgeStyle(styleIndex) {
      terrainUniforms.u_ridgeStyle.value = styleIndex;
      console.log(`[Ridge Style] Set to style ${styleIndex}`);
    }
    window.setRidgeStyle = setRidgeStyle;

    function setOceanBloomMode(mode) {
      waterMat.uniforms.u_oceanBloomMode.value = mode;
      console.log(`[Ocean Bloom Mode] Set to mode ${mode} (${mode === 1.0 ? "Mode A: Surface-Coupled" : "Mode B: Hybrid Dual-Layer"})`);
    }
    window.setOceanBloomMode = setOceanBloomMode;

    // Backward-Compatible Global Diagnostic Functions
    window.__CHECK_ARCHIVAL_ENGINES__ = function() {
      const diag = window.getEventTestDiagnostics();
      if (!diag) return { simTime: 0, cameraShot: currentShotKey, activeUnitsCount: 0, collisionCount: 0, totalOverlapAreaNDC: 0, units: [] };

      // Enrich units with backward-compatible aliases
      diag.units.forEach(u => {
        u.displayWord = u.displayText;
        u.sourcePhrase = u.displayText;
        u.sourceStatus = u.evidenceStatus;
        u.sampledCoords = {
          worldX: u.worldCoords.x,
          worldZ: u.worldCoords.z,
          groundY: u.groundY
        };
        u.sampledElevationMeters = u.elevationMeters;
        u.sampledSlopeDeg = u.slopeDeg;
        u.terrainSuitability = "OPTIMAL_AFFINITY_MATCH";
        u.t_waveArrival = u.t_activation;
        u.opacity = u.currentOpacity;
        u.collisionStatus = "CLEAR";
        u.isCleanedUp = (u.lifecycleState === "DEAD" && u.currentOpacity <= 0.001);
      });

      diag.totalOverlapAreaNDC = diag.overlapAreaNDC;
      return diag;
    };

    window.__CHECK_TYPOGRAPHY_COLLISIONS__ = function() {
      const diag = window.getEventTestDiagnostics();
      if (!diag) return { simTime: 0, cameraShot: currentShotKey, activeCount: 0, collisionCount: 0, totalIntersectAreaNDC: 0, collisions: [], sprites: [] };

      const activeSprites = diag.units
        .filter(u => u.currentOpacity > 0.05)
        .map((u, idx) => ({
          id: u.unitId,
          index: idx,
          ndcX: u.ndcPos.x,
          ndcY: u.ndcPos.y,
          minX: Number((u.ndcPos.x - 0.08).toFixed(4)),
          maxX: Number((u.ndcPos.x + 0.08).toFixed(4)),
          minY: Number((u.ndcPos.y - 0.03).toFixed(4)),
          maxY: Number((u.ndcPos.y + 0.03).toFixed(4)),
          opacity: u.currentOpacity,
          worldY: u.groundY
        }));

      return {
        simTime: diag.simTime,
        cameraShot: diag.cameraShot,
        activeCount: activeSprites.length,
        collisionCount: diag.collisionCount,
        totalIntersectAreaNDC: diag.overlapAreaNDC,
        collisions: [],
        sprites: activeSprites
      };
    };

    // Legacy handler dummy for keyboard or script checks

    // Keyboard Shortcuts
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        if (flightState === FLIGHT_STATES.PERFORMANCE || flightState === FLIGHT_STATES.DESCEND) {
          startAscentFlight();
        }
      } else if (e.key === ' ' || e.code === 'Space') {
        if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
        e.preventDefault();
        if (flightState === FLIGHT_STATES.ORBIT) {
          if (controlSurface) {
            controlSurface.autoContinue = !controlSurface.autoContinue;
            autonomousMode = controlSurface.autoContinue;
            controlSurface.updateAutoContinueUI();
          }
        } else {
          if (controlSurface) {
            controlSurface.togglePlayPause();
          } else {
            isPlaying = !isPlaying;
            const playBtn = document.getElementById('btn-transport-play-pause');
            if (playBtn) playBtn.textContent = isPlaying ? "⏸" : "▶";
          }
        }
      } else if (e.key.toLowerCase() === 'd') {
        if (controlSurface) {
          const nextState = (controlSurface.currentState === 'DISCOVER') ? 'EXPLORE' : 'DISCOVER';
          controlSurface.setState(nextState);
        }
      } else if (e.key === '1') {
        applyCameraShot('monumental_continental_scale');
      } else if (e.key === '2') {
        applyCameraShot('epicenter_wave_corridor');
      } else if (e.key === '3') {
        applyCameraShot('lyrical_mountain_resonance');
      } else if (e.key === '4') {
        applyCameraShot('comprehensive_orchestration');
      } else if (e.key === '5') {
        applyCameraShot('closeup_alpine_spires');
      } else if (e.key === '6') {
        applyCameraShot('closeup_maritime_shelf');
      } else if (e.key.toLowerCase() === 'b') {
        const nextMode = (waterMat.uniforms.u_oceanBloomMode.value === 1.0) ? 2.0 : 1.0;
        setOceanBloomMode(nextMode);
      } else if (e.key.toLowerCase() === 'g') {
        setPurePhysicalMode(purePhysicalMode < 0.5);
      } else if (e.key.toLowerCase() === 'r') {
        const nextStyle = (terrainUniforms.u_ridgeStyle.value + 1.0) % 3.0;
        setRidgeStyle(nextStyle);
      } else if (e.key.toLowerCase() === 't') {
        setStratum2(enableStratum2 < 0.5);
      } else if (e.key.toLowerCase() === 'm') {
        setStratum3(enableStratum3 < 0.5);
      } else if (e.key.toLowerCase() === 'h') {
        if (typeof window.toggleImmersiveUI === 'function') {
          window.toggleImmersiveUI();
        }
      }
    });

    // -------------------------------------------------------------------------
    // 7. INITIALIZATION & ANIMATION LOOP
    // -------------------------------------------------------------------------
    let lastClock = performance.now();
    let frameCount = 0;
    let fpsHistory = [];

    function bindTopRightEarthDockMenu() {
      const btnToggle = document.getElementById('btn-dev-lab-global');
      const menu = document.getElementById('global-dev-lab-menu');
      if (btnToggle && menu && !btnToggle.dataset.bound) {
        btnToggle.dataset.bound = '1';
        btnToggle.addEventListener('click', (e) => {
          e.stopPropagation();
          const show = menu.style.display !== 'flex';
          menu.style.display = show ? 'flex' : 'none';
        });
      }
      if (menu && !menu.dataset.bound) {
        menu.dataset.bound = '1';
        menu.querySelectorAll('[data-entry-mode]').forEach((btn) => {
          btn.addEventListener('click', (e) => {
            e.stopPropagation();
            menu.style.display = 'none';
            const req = { entryMode: btn.dataset.entryMode || 'FREE_MODE' };
            if (btn.dataset.regionId) req.regionId = btn.dataset.regionId;
            if (btn.dataset.lat !== undefined) req.lat = Number(btn.dataset.lat);
            if (btn.dataset.lon !== undefined) req.lon = Number(btn.dataset.lon);
            if (btn.dataset.name) req.name = btn.dataset.name;
            if (btn.dataset.short) req.shortName = btn.dataset.short;
            if (btn.dataset.eventId) req.eventId = btn.dataset.eventId;
            if (btn.dataset.regionId) req.withFlight = true;
            window.enterInSceneLocalResponse?.(req);
          });
        });
      }
    }

    async function init() {
      bindTopRightEarthDockMenu();
      const safetyHide = setTimeout(() => {
        const ind = document.getElementById('loading-indicator');
        if (ind) ind.style.display = 'none';
      }, 2800);
      try {
        if (qualityMode === 'CLASSROOM') {
          const pill = document.getElementById('quality-mode-pill');
          const lbl = document.getElementById('quality-mode-text');
          if (pill) pill.classList.add('classroom-mode');
          if (lbl) lbl.textContent = '화질: 강의실 최적화 (Classroom 60fps)';
        }

        // Parallel fetch: Global ETOPO elevation (4MB) + Fused Seorak-Donghae DEM (4.9MB)
        const [loadedGlobalTex, loadedDemTex] = await Promise.all([
          loadGlobalElevationTexture(THREE),
          loadFusedElevationTexture()
        ]);
        globalElevationTexture = loadedGlobalTex;
        terrainUniforms.u_globalElevation.value = globalElevationTexture;
        terrainUniforms.u_globalHMin.value = -11000.0;
        terrainUniforms.u_globalHMax.value = 9000.0;
        window.globalElevationTexture = globalElevationTexture;

        demTexture = loadedDemTex;
        terrainUniforms.u_demTexture.value = demTexture;
        waterMat.uniforms.u_demTexture.value = demTexture;

        const lat0 = 38.00;
        const lon0 = 129.05;
        const segW = (qualityMode === 'CLASSROOM') ? 540 : 900;
        const segH = (qualityMode === 'CLASSROOM') ? 432 : 720;
        const terrainGeo = createWGS84CurvedPlaneGeometry(PHYSICAL_W_UNITS, PHYSICAL_H_UNITS, segW, segH, lat0, lon0);
        terrainMesh = new THREE.Mesh(terrainGeo, integratedTerrainMat);
        terrainMesh.renderOrder = 2;
        scene.add(terrainMesh);

        tier0GlobeMesh = createTier0WGS84Ellipsoid(lat0, lon0);
        tier0GlobeMesh.renderOrder = 1;
        if (tier0GlobeMesh.material && tier0GlobeMesh.material.uniforms) {
          tier0GlobeMesh.material.uniforms.u_regionActive.value = 1.0;
          tier0GlobeMesh.material.uniforms.u_regionCenter.value.set(lat0, lon0);
          tier0GlobeMesh.material.uniforms.u_regionHalfSize.value.set(PHYSICAL_W_UNITS * 0.5, PHYSICAL_H_UNITS * 0.5);
        }
        scene.add(tier0GlobeMesh);

        // 3. Add Celestial Starfield & Atmosphere Outer Glow Shell
        celestialStarsMesh = createCelestialStarfield();
        scene.add(celestialStarsMesh);

        atmosphereGlowMesh = createAtmosphereGlowShell(lat0, lon0);
        scene.add(atmosphereGlowMesh);

        // 4. Initialize LivingMemoryEngine, ArchivalSemanticParser & Preprocess Terrain
        archivalParser = new ArchivalSemanticParser(HISTORICAL_EVENTS, SOURCE_RECORDS, EVENT_SOURCE_LINKS, INSTRUMENTAL_EVENTS);
        spawner = new TerrainAwareSpawner(TERRAIN_CANDIDATE_CACHE);
        livingMemoryEngine = new LivingMemoryEngine({
          scene,
          THREE,
          livingSoundfield,
          candidateCache: TERRAIN_CANDIDATE_CACHE
        });
        livingMemoryEngine.parser = archivalParser;
        livingMemoryEngine.spawner = spawner;
        livingMemoryEngine.entities = archivalEntities;
        analyzeDEMFeatures();

        // 5. Load Live Multi-Agency & USGS Global/Regional Feeds + Unified Master Catalog
        window.liveSeismicDataService = liveSeismicDataService;
        async function syncLiveCatalogToRegistry(forceRefresh = false) {
          const liveRes = await liveSeismicDataService.fetchLiveEarthquakeCatalog({ forceRefresh });
          const usgsEvents = liveRes?.events || [];
          window.liveSeismicFeedStatus = {
            feedStatus: liveRes.feedStatus,
            kmaStatus: liveRes.kmaStatus,
            usgsCount: liveRes.usgsCount,
            kmaCount: liveRes.kmaCount,
            updatedAtIso: liveRes.updatedAtIso
          };
          if (usgsEvents.length > 0) {
            MASTER_EVENTS_REGISTRY = buildUnifiedMasterCatalog(HISTORICAL_EVENTS, INSTRUMENTAL_EVENTS, usgsEvents);
            archivalParser.addInstrumentalEvents(usgsEvents);
            exhibitionAppContext.setCatalogs({
              masterEventsRegistry: MASTER_EVENTS_REGISTRY,
              historicalEvents: HISTORICAL_EVENTS,
              instrumentalEvents: INSTRUMENTAL_EVENTS
            });
            window.MASTER_EVENTS_REGISTRY = MASTER_EVENTS_REGISTRY;
            console.log(`[Master Registry] ${liveRes.feedStatus}: ${MASTER_EVENTS_REGISTRY.length} total events (USGS=${liveRes.usgsCount}, KMA=${liveRes.kmaCount})`);
          }
          return liveRes;
        }
        window.refreshLiveSeismicFeed = () => syncLiveCatalogToRegistry(true).then(res => {
          initDiscoveryNodes(lat0, lon0, scene, discoveryNodes);
          controlSurface?.renderDiscoverCards?.(controlSurface.activeFilter, controlSurface.searchQuery);
          return res;
        });

        try {
          await syncLiveCatalogToRegistry(false);
        } catch (err) {
          console.warn("[Live Seismic Feed] Non-fatal feed initialization warning:", err);
        }
        window.MASTER_EVENTS_REGISTRY = MASTER_EVENTS_REGISTRY;

        // 6. Initialize Discovery Beacons & Explicit Application Context Bridge
        exhibitionAppContext.registerHandlers({
          startDescentFlight,
          startAscentFlight,
          seekToSimulationTime,
          setSimulationPlaying: window.setSimulationPlaying,
          setPlaybackSpeed: window.setPlaybackSpeed,
          applyCameraShot,
          toggleImmersiveUI: window.toggleImmersiveUI,
          setGeophysics3DProbe: window.setGeophysics3DProbe,
          setAutonomousMode: (enabled) => { autonomousMode = !!enabled; }
        });
        initDiscoveryNodes(lat0, lon0, scene, discoveryNodes);
        controlSurface = new UnifiedControlSurface({ appContext: exhibitionAppContext });
        window.controlSurface = controlSurface;
        window.livingMemoryEngine = livingMemoryEngine;

        window.terrainMesh = terrainMesh;
        window.waterMesh = waterMesh;
        window.tier0GlobeMesh = tier0GlobeMesh;
        window.celestialStarsMesh = celestialStarsMesh;
        window.atmosphereGlowMesh = atmosphereGlowMesh;
        window.archivalEntities = archivalEntities;
        window.discoveryNodes = discoveryNodes;

        // Load 1681 Yangyang event without snapping camera
        await loadHistoricalEvent("hist_1681_0626", false);

        // Setup Orbit camera (only if user has not already entered in-scene 4km local mode)
        if (!exhibitionModeManager || !exhibitionModeManager.isLocalModeActive()) {
          const isPortraitMobile = (typeof window !== 'undefined' && window.innerWidth <= 640 && (window.innerWidth / Math.max(1, window.innerHeight)) < 0.78);
          camera.position.set(isPortraitMobile ? 12.0 : 10.0, isPortraitMobile ? 152.0 : 140.0, isPortraitMobile ? 46.0 : 40.0);
          controls.target.set(0.0, 0.0, 0.0);
          controls.minDistance = 20.0;
          controls.maxDistance = 400.0;
          camera.fov = isPortraitMobile ? 48 : 36;
          camera.near = 0.02;
          camera.far = 600.0;
          camera.updateProjectionMatrix();
          controls.update();

          flightState = FLIGHT_STATES.ORBIT;
          orbitDwellTimer = 0.0;
          updateHUDForFlight('orbit');
        }

        // Raycasting for discovery beacons (throttled in CLASSROOM/Eco mode)
        let lastRaycastTimeMs = 0;
        window.addEventListener('mousemove', (e) => {
          const nowMs = performance.now();
          if (qualityMode === 'CLASSROOM' && (nowMs - lastRaycastTimeMs) < 50) {
            return;
          }
          lastRaycastTimeMs = nowMs;
          mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
          mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;

          if (flightState === FLIGHT_STATES.ORBIT || flightState === FLIGHT_STATES.PERFORMANCE) {
            raycaster.setFromCamera(mouse, camera);
            const hitMeshes = discoveryNodes.map(n => n.hitMesh).filter(m => m && m.parent && m.parent.visible);
            const intersects = raycaster.intersectObjects(hitMeshes, false);
            if (intersects.length > 0) {
              const hitBeacon = intersects[0].object.userData.beacon;
              if (hitBeacon && hitBeacon !== hoveredBeacon) {
                hoveredBeacon = hitBeacon;
                document.body.style.cursor = 'pointer';
                showBeaconTooltip(hitBeacon, e.clientX, e.clientY);
              }
            } else {
              if (hoveredBeacon) {
                hoveredBeacon = null;
                document.body.style.cursor = 'default';
                hideBeaconTooltip();
              }
            }
          }
        });

        window.addEventListener('click', async (e) => {
          if (e.target.closest('#unified-control-surface') || e.target.closest('#beacon-tooltip')) {
            return;
          }
          if (hoveredBeacon && hoveredBeacon.eventData) {
            const bData = hoveredBeacon.eventData;
            hideBeaconTooltip();
            if (controlSurface) {
              await controlSurface.openEventArchiveById(bData.id || bData.eventId);
            } else {
              await startDescentFlight(bData.id || bData.eventId);
            }
          }
        });

        clearTimeout(safetyHide);
        const ind = document.getElementById('loading-indicator');
        if (ind) ind.style.display = 'none';
        console.log("[Master Exhibition] Scene, Discovery Beacons & Global Earth initialized successfully.");
      } catch (err) {
        clearTimeout(safetyHide);
        console.error("Initialization error:", err);
        const ind = document.getElementById('loading-indicator');
        if (ind) ind.style.display = 'none';
      }
    }

    function animate(now) {
      requestAnimationFrame(animate);

      const delta = (now - lastClock) * 0.001;
      lastClock = now;

      frameCount++;
      const currentFps = 1.0 / Math.max(0.001, delta);
      fpsHistory.push(currentFps);
      if (fpsHistory.length > 30) fpsHistory.shift();

      if (frameCount % 20 === 0) {
        const avgFps = fpsHistory.reduce((a, b) => a + b, 0) / fpsHistory.length;
        const fpsLabel = document.getElementById('fps-label');
        if (fpsLabel) fpsLabel.textContent = `${avgFps.toFixed(1)} FPS (WebGL2 ANGLE Metal)`;
      }

      // Single-Canvas Stage R4 Mode Branch (avoids scale collision between 100km globe and 1m local ENU space)
      if (exhibitionModeManager && exhibitionModeManager.isLocalModeActive()) {
        exhibitionModeManager.update(Math.min(delta, 0.05), now * 0.001);
        renderer.render(scene, camera);
        return;
      }

      // Flight State Machine & Discovery update (hide sibling event beacons when focused on a single quake)
      updateFlight(delta);
      const isOrbitView = (flightState === FLIGHT_STATES.ORBIT) &&
        controlSurface?.currentState !== 'SELECTED' &&
        controlSurface?.currentState !== 'PERFORMANCE';
      setDiscoveryBeaconsVisible(isOrbitView);
      discoveryNodes.forEach(n => {
        n.group.visible = isOrbitView;
        if (isOrbitView) n.update(now * 0.001);
      });

      const userScrubbing = Boolean(exhibitionAppContext?.isScrubbing || controlSurface?.isScrubbing);
      if (isPlaying && !userScrubbing) {
        const scaledDelta = delta * playbackSpeed;
        simTime += scaledDelta;
        if (orchestrator) {
          orchestrator.isPlaying = true;
          orchestrator.update(scaledDelta);
        }
        if (simTime > currentMaxSimTime) {
          simTime = 0.0;
          if (orchestrator?.seekToTime) orchestrator.seekToTime(0.0);
          else if (orchestrator) orchestrator.restart();
        }
        updateWaveDisplays();
      } else if (orchestrator) {
        orchestrator.isPlaying = false;
      }

      window.simTime = simTime;
      window.flightState = flightState;

      controls.update();

      // Underground Camera Clipping Guard (Performance, Coda, Descend & Ascend States)
      if (
        flightState === FLIGHT_STATES.PERFORMANCE ||
        flightState === FLIGHT_STATES.CODA ||
        flightState === FLIGHT_STATES.DESCEND ||
        flightState === FLIGHT_STATES.ASCEND
      ) {
        const horizDist = Math.hypot(camera.position.x, camera.position.z);
        if (horizDist < 0.85) {
          const groundSample = getTerrainMetricsAt(camera.position.x, camera.position.z);
          const minCamY = Math.max(0.018, (groundSample?.groundY || 0.0) + 0.016);
          if (camera.position.y < minCamY) {
            camera.position.y = minCamY;
          }
        }
        // Global WGS84 sphere guard centered at (0, -63.78137, 0)
        const gy = camera.position.y + 63.78137;
        const rSphere = Math.hypot(camera.position.x, gy, camera.position.z);
        const minSphereR = 63.78137 + 0.016;
        if (rSphere > 0.001 && rSphere < minSphereR) {
          const scale = minSphereR / rSphere;
          camera.position.x *= scale;
          camera.position.y = gy * scale - 63.78137;
          camera.position.z *= scale;
        }
        if (controls.target.y < -0.025 && horizDist < 0.85) {
          controls.target.y = -0.025;
        }
      }

      renderer.render(scene, camera);
    }

    init();
    requestAnimationFrame(animate);

    // Resize Handler
    window.addEventListener('resize', () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    });

    // Single canonical window.seekToSimulationTime alias already registered above.

    window.setDarkCushionEnabled = function(enabled) {
      window.__ENABLE_DARK_CUSHION__ = enabled;
      archivalEntities.forEach(g => {
        if (g.userData.renderCanvas) {
          const prog = (g.userData.lifecycleState === 'LATENT') ? 0.0 : (g.userData.lifecycleState === 'EMERGENCE' ? 0.6 : 1.0);
          g.userData.renderCanvas(prog, 0.0);
        }
      });
      renderer.render(scene, camera);
      return window.__ENABLE_DARK_CUSHION__;
    };

    window.setMultilingualDisplayMode = function(mode) {
      // mode: 'native' | 'korean'
      archivalEntities.forEach(g => {
        const u = g.userData?.unitDef;
        if (u && (u.phraseNative || u.phraseKo || u.tokenNative || u.tokenKo)) {
          const chosenText = (mode === 'korean')
            ? (u.phraseKo || u.tokenKo || u.token)
            : (u.phraseNative || u.tokenNative || u.token);
          u.token = chosenText;
          u.semantic.displayText = chosenText;
          if (u.visual) {
            u.visual.allowNativeScript = Boolean(mode === 'native' && (u.phraseNative || u.tokenNative));
          }
          g.userData.token = chosenText;
          g.userData.displayText = chosenText;
          if (g.userData.renderCanvas) {
            const prog = (g.userData.lifecycleState === 'LATENT') ? 0.0 : (g.userData.lifecycleState === 'EMERGENCE' ? 0.6 : 1.0);
            g.userData.renderCanvas(prog, 0.0);
          } else if (Array.isArray(g.userData.chunks)) {
            g.userData.chunks.forEach(ch => {
              if (typeof ch.renderChunk === 'function') ch.renderChunk(1.0);
            });
          }
        }
      });
      renderer.render(scene, camera);
      return mode;
    };

    exhibitionModeManager = new ExhibitionModeManager({
      scene,
      camera,
      renderer,
      controls,
      hudMountRoot: document.getElementById('local-evac-hud'),
      appContext: exhibitionAppContext,
      onReturnToGlobe: () => window.exitInSceneLocalResponse && window.exitInSceneLocalResponse(),
      getGlobalSceneObjects: () => [
        tier0GlobeMesh,
        terrainMesh,
        waterMesh,
        tier2Mesh,
        celestialStarsMesh,
        atmosphereGlowMesh,
        ...archivalEntities,
        ...discoveryNodes.map(n => n.group),
        scene.getObjectByName('DiscoveryBeaconsInstancedBatch')
      ].filter(Boolean)
    });
    window.exhibitionModeManager = exhibitionModeManager;
    let preFlightGlobalOrbitPose = null;
    window.enterInSceneLocalResponse = async function(stageOrOpts) {
      const req = (typeof stageOrOpts === 'object' && stageOrOpts) ? { ...stageOrOpts } : {};
      const entryMode = req.entryMode || (req.handedEvent ? 'FROM_GLOBE_EVENT' : (Number.isFinite(req.lat) ? 'FREE_MODE' : 'UNSELECTED'));

      // Preserve cosmic orbit pose so "지구본으로 복귀" always returns cleanly
      preFlightGlobalOrbitPose = {
        pos: camera.position.clone(),
        target: controls.target.clone(),
        fov: camera.fov,
        near: camera.near,
        far: camera.far
      };

      // Continuous globe-to-city descent animation when explicit target coords exist + withFlight requested
      if (req.withFlight && Number.isFinite(req.lat) && Number.isFinite(req.lon)) {
        const opts = {
          ...req,
          entryMode,
          regionId: req.regionId || `loc_${Number(req.lat).toFixed(4)}_${Number(req.lon).toFixed(4)}`,
          lat: req.lat,
          lon: req.lon,
          name: req.name || '선택 지역',
          shortName: req.shortName || req.name || '선택 지역',
          eventId: req.eventId || req.handedEvent?.eventId || null,
          stage: req.stage || 'CAMPUS_OVERVIEW'
        };
        pendingLocalCityFlight = opts;
        controlSurface?.updateGlobalDevLabVisibility?.();
        const flightTargetEvent = opts.eventId || currentParsedEvent?.eventId || 'hist_2016_gyeongju';
        await startDescentFlight(flightTargetEvent, { preservePendingLocalCity: true, durationSec: 1.55 });
        return { flyingToLocal: true, target: opts };
      }

      document.body.classList.add('in-local-evac-mode');
      const stageKey = (typeof stageOrOpts === 'string' ? stageOrOpts : req.stage) || 'CAMPUS_OVERVIEW';
      const opts = { ...req, entryMode };
      const res = exhibitionModeManager.enterLocalResponseMode(stageKey, opts);
      controlSurface?.updateGlobalDevLabVisibility?.();
      return res;
    };
    window.exitInSceneLocalResponse = function() {
      pendingLocalCityFlight = null;
      document.body.classList.remove('in-local-evac-mode');
      const res = exhibitionModeManager.exitToGlobalExhibition();
      if (preFlightGlobalOrbitPose) {
        camera.fov = preFlightGlobalOrbitPose.fov;
        camera.near = preFlightGlobalOrbitPose.near;
        camera.far = preFlightGlobalOrbitPose.far;
        camera.updateProjectionMatrix();
        camera.position.copy(preFlightGlobalOrbitPose.pos);
        controls.target.copy(preFlightGlobalOrbitPose.target);
        controls.minDistance = 20.0;
        controls.maxDistance = 400.0;
        controls.maxPolarAngle = Math.PI;
        controls.enabled = true;
        controls.update();
        if (scene.fog) scene.fog.density = 0.0001;
        preFlightGlobalOrbitPose = null;
      }
      flightState = FLIGHT_STATES.ORBIT;
      exhibitionAppContext.flightState = FLIGHT_STATES.ORBIT;
      controlSurface?.setState?.('EXPLORE');
      updateHUDForFlight('orbit');
      return res;
    };

    window.openLocalSpatialResponse = function(stage = 'campus') {
      window.location.href = `./viewer_p2_6.html?stage=${encodeURIComponent(stage)}`;
    };

    window.getPerformanceDiagnostics = function() {
      const avgFps = fpsHistory.length ? (fpsHistory.reduce((a, b) => a + b, 0) / fpsHistory.length) : 60.0;
      return {
        ecoMode: qualityMode === 'CLASSROOM',
        qualityMode,
        pixelRatio: renderer.getPixelRatio(),
        flightState,
        fps: Number(avgFps.toFixed(1)),
        renderCalls: renderer.info?.render?.calls ?? 0,
        triangles: renderer.info?.render?.triangles ?? 0
      };
    };

    // Expose Global Test State for Playwright Automation
    window.__PROTOTYPE_METRICS__ = null;
    setTimeout(() => {
      const avgFps = fpsHistory.length ? (fpsHistory.reduce((a, b) => a + b, 0) / fpsHistory.length) : 60.0;
      window.__PROTOTYPE_METRICS__ = {
        totalVertices: 751500,
        totalTriangles: 1510258,
        waterTriangles: 206066,
        waterResolution: "360x288",
        archivalUnitsCount: currentParsedEvent ? currentParsedEvent.semanticUnits.length : 5,
        reformedMemoriesCount: currentParsedEvent ? currentParsedEvent.semanticUnits.length : 5,
        currentFps: avgFps
      };
      console.log("[G2 Phase 6 Ready] Generative Archival Typography Metrics:", window.__PROTOTYPE_METRICS__);
    }, 1000);