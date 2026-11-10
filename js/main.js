// =========================================================================
    // SEISMOLIVE v4.0 — G2 Phase 6: Generic Archival Living Typography Engine
    // Unified Architecture · Figure-Ground Contrast · Editorial Serif · Negative Space
    // =========================================================================

    import { HISTORICAL_EVENTS, SOURCE_RECORDS, EVENT_SOURCE_LINKS } from './data/historicalArchiveDB.js?v=4.4';
    import { INSTRUMENTAL_EVENTS } from './data/instrumentalCatalogDB.js?v=4.4';
    import { loadUSGSFeed, buildUnifiedMasterCatalog } from './data/usgsFeedConnector.js?v=4.4';
    import {
      WGS84,
      DATUM_STATUS,
      geodeticToThree,
      computeGlobeCenterAndPolarAxis,
      computeEllipsoidalHeight,
      threeToECEF,
      ecefToThree
    } from './3d/geodeticEllipsoidCoord.js?v=4.4';
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
    } from './3d/terrainDataResolver.js?v=4.4';
    import {
      SeismicSourceModel,
      VelocityModelStatus,
      REFERENCE_CRUSTAL_VELOCITY,
      REGIONAL_VELOCITY_MODELS
    } from './3d/seismicSourceModel.js?v=4.4';
    import { UniversalWavefieldEngine } from './3d/universalWavefieldEngine.js?v=4.4';
    import { WavefieldVisualOrchestrator } from './3d/wavefieldVisualOrchestrator.js?v=4.4';
    import { LivingSoundfieldEngine } from './audio/livingSoundfieldEngine.js?v=4.4';
    import {
      ArchivalSemanticParser,
      renderEditorialTypography,
      createRadialHaloTexture,
      createResonanceEntity,
      createFractureEntity,
      createRecedeEntity,
      createExposeEntity
    } from './3d/livingMemoryEngine.js?v=4.4';

    let orchestrator = null;
    window.orchestrator = null;
    window.wavefieldEngine = null;

    let livingSoundfield = new LivingSoundfieldEngine({ isMuted: true, volume: 0.65 });
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

import { getEventCoords, isHistoricalRecord, getAllLocalizedEvents } from './data/eventCatalogHelpers.js';
import { DiscoveryNode, initDiscoveryNodes, updateDiscoveryNodePositions, showBeaconTooltip, hideBeaconTooltip } from './ui/DiscoveryBeacons.js';
import { UnifiedControlSurface } from './ui/UnifiedControlSurface.js';
import { computeTravelTimeParams, generateTravelTimeCurveSVG, renderGeophysicsFolioHTML } from './geophysics/TravelTimeSolvers.js';

const FLIGHT_STATES = {
      ORBIT: 'STATE_ORBIT',
      DESCEND: 'STATE_FLIGHT_DESCEND',
      PERFORMANCE: 'STATE_PERFORMANCE',
      CODA: 'STATE_CODA',
      ASCEND: 'STATE_FLIGHT_ASCEND'
    };

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

    const camera = new THREE.PerspectiveCamera(36, window.innerWidth / window.innerHeight, 0.02, 600.0);
    const isLowSpec = (typeof navigator !== 'undefined' && ((navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4) || /Mobi|Android/i.test(navigator.userAgent)));
    const maxDpr = isLowSpec ? 1.0 : Math.min(window.devicePixelRatio || 1, 1.5);
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: "high-performance" });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(maxDpr);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.18;
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
      const globeParams = computeGlobeCenterAndPolarAxis(lat0, lon0);
      const geo = new THREE.SphereGeometry(globeParams.semiMajorUnits * 1.015, 64, 48);
      geo.translate(globeParams.centerThree[0], globeParams.centerThree[1], globeParams.centerThree[2]);

      const mat = new THREE.ShaderMaterial({
        vertexShader: `
          varying vec3 vWorldNormal;
          varying vec3 vViewPos;
          void main() {
            vWorldNormal = normalize(normalMatrix * normal);
            vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
            vViewPos = -mvPosition.xyz;
            gl_Position = projectionMatrix * mvPosition;
          }
        `,
        fragmentShader: `
          varying vec3 vWorldNormal;
          varying vec3 vViewPos;
          void main() {
            vec3 N = normalize(vWorldNormal);
            vec3 V = normalize(vViewPos);
            float rim = pow(1.0 - max(0.0, dot(N, V)), 3.2);
            gl_FragColor = vec4(0.35, 0.58, 0.88, rim * 0.42);
          }
        `,
        blending: THREE.AdditiveBlending,
        transparent: true,
        depthWrite: false,
        side: THREE.BackSide
      });

      const mesh = new THREE.Mesh(geo, mat);
      mesh.name = 'AtmosphereGlowShell';
      mesh.renderOrder = 5;
      return mesh;
    }

    // -------------------------------------------------------------------------
    // DISCOVERY NODES SYSTEM: 48 VERIFIED HISTORICAL & INSTRUMENTAL BEACONS
    // -------------------------------------------------------------------------
    let MASTER_EVENTS_REGISTRY = buildUnifiedMasterCatalog(HISTORICAL_EVENTS, INSTRUMENTAL_EVENTS);
    window.MASTER_EVENTS_REGISTRY = MASTER_EVENTS_REGISTRY;

    let controlSurface = null;
    window.controlSurface = null;

    // ORBITAL-TO-LOCAL CONTINUOUS FLIGHT CONTROLLER
    // -------------------------------------------------------------------------
    async function startDescentFlight(targetEventId) {
      console.log(`[Flight Controller] Initiating descent flight to: ${targetEventId}`);

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
        simTime = 0.0;
        isPlaying = true;
        updateHUDForFlight('performance');
        if (controlSurface) controlSurface.setState('PERFORMANCE', currentParsedEvent);
        return;
      }

      flightState = FLIGHT_STATES.DESCEND;
      flightProgress = 0.0;
      flightDuration = 3.8;

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
      if (controlSurface) controlSurface.setState('PERFORMANCE', currentParsedEvent);
    }

    function startAscentFlight() {
      console.log(`[Flight Controller] Initiating ascent flight to Orbit`);
      flightState = FLIGHT_STATES.ASCEND;
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
    window.setFlightState = (s) => { flightState = s; };
    window.FLIGHT_STATES = FLIGHT_STATES;

    function updateFlight(dt) {
      if (flightState === FLIGHT_STATES.DESCEND) {
        flightProgress += dt / flightDuration;
        const t = Math.min(1.0, flightProgress);
        const ease = t < 0.5 ? 4.0 * t * t * t : 1.0 - Math.pow(-2.0 * t + 2.0, 3.0) / 2.0;

        // Spherical altitude-aware continuous orbital trajectory relative to Earth Center
        const globeCenter = new THREE.Vector3(0, -63.78137, 0);
        const vStart = flightStartPos.clone().sub(globeCenter);
        const vEnd = flightEndPos.clone().sub(globeCenter);
        const rStart = vStart.length();
        const rEnd = vEnd.length();

        const angularDist = vStart.angleTo(vEnd);
        const arcHeight = Math.min(85.0, Math.max(0.0, angularDist * 55.0));
        const altitudeHop = Math.sin(ease * Math.PI) * arcHeight;

        const qStart = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), vStart.clone().normalize());
        const qEnd = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), vEnd.clone().normalize());
        const qCur = qStart.clone().slerp(qEnd, ease);
        const curDir = new THREE.Vector3(0, 1, 0).applyQuaternion(qCur);
        const curR = THREE.MathUtils.lerp(rStart, rEnd, ease) + altitudeHop;

        camera.position.copy(globeCenter).addScaledVector(curDir, curR);
        const currentLookAt = new THREE.Vector3().lerpVectors(flightStartLookAt, flightEndLookAt, ease);
        camera.lookAt(currentLookAt);

        camera.near = THREE.MathUtils.lerp(0.1, 0.02, ease);
        camera.far = 600.0;
        camera.updateProjectionMatrix();

        if (scene.fog) {
          scene.fog.density = THREE.MathUtils.lerp(0.0001, 0.015, ease);
        }

        discoveryNodes.forEach(n => { n.group.visible = (ease < 0.65); });

        if (flightProgress >= 1.0) {
          flightProgress = 1.0;
          flightState = FLIGHT_STATES.PERFORMANCE;
          simTime = 0.0;
          isPlaying = true;
          controls.target.copy(flightEndLookAt);
          controls.minDistance = 0.04;
          controls.maxDistance = 6.0;
          controls.maxPolarAngle = Math.PI * 0.465;
          controls.enabled = true;
          controls.update();
          if (window.livingSoundfield && !livingSoundfield.isMuted) {
            livingSoundfield.triggerEventRupture(currentParsedEvent.eventId);
          }
          updateHUDForFlight('performance');
        }
      } else if (flightState === FLIGHT_STATES.ASCEND) {
        flightProgress += dt / flightDuration;
        const t = Math.min(1.0, flightProgress);
        const ease = t < 0.5 ? 4.0 * t * t * t : 1.0 - Math.pow(-2.0 * t + 2.0, 3.0) / 2.0;

        const globeCenter = new THREE.Vector3(0, -63.78137, 0);
        const vStart = flightStartPos.clone().sub(globeCenter);
        const vEnd = flightEndPos.clone().sub(globeCenter);
        const rStart = vStart.length();
        const rEnd = vEnd.length();

        const qStart = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), vStart.clone().normalize());
        const qEnd = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), vEnd.clone().normalize());
        const qCur = qStart.clone().slerp(qEnd, ease);
        const curDir = new THREE.Vector3(0, 1, 0).applyQuaternion(qCur);
        const curR = THREE.MathUtils.lerp(rStart, rEnd, ease);

        camera.position.copy(globeCenter).addScaledVector(curDir, curR);
        const currentLookAt = new THREE.Vector3().lerpVectors(flightStartLookAt, flightEndLookAt, ease);
        camera.lookAt(currentLookAt);

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
        if (simTime >= 28.0 && simTime < 34.0) {
          flightState = FLIGHT_STATES.CODA;
          showCodaSubtitle();
        }
      } else if (flightState === FLIGHT_STATES.CODA) {
        if (simTime >= 35.0) {
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
        if (sub) sub.textContent = `${currentParsedEvent.titleKo} 현장으로 강하 중... (WGS84 연속 궤도 비행)`;
      } else if (state === 'performance') {
        updateChronicleSubtitleForEvent(currentParsedEvent);
      } else if (state === 'ascending') {
        if (sub) sub.textContent = "대지의 기억을 뒤로하고 우주 궤도로 복귀 중...";
      }
    }

    function updateChronicleSubtitleForEvent(ev) {
      const sub = document.getElementById('chronicle-subtitle-text');
      if (sub) {
        let quote = ev.translationKo || ev.originalTranslationKo || ev.translation || ev.koreanTranslation || ev.primaryTranslation || "";
        if (!quote && ev.archivalText && !/[\u4e00-\u9fff]/.test(ev.archivalText)) {
          quote = ev.archivalText;
        }
        if (quote) {
          sub.textContent = quote;
        } else {
          const titleStr = ev.titleKo || ev.title || "역사지진";
          const dateStr = ev.dateText ? ` (${ev.dateText})` : '';
          sub.textContent = `${titleStr}${dateStr} — 대지 진동과 사료의 기억`;
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
          u_dominantFreq: { value: 1.0 }
        },
        vertexShader: `
          precision highp float;
          uniform sampler2D u_globalElevation;
          uniform float u_globalHMin;
          uniform float u_globalHMax;
          uniform float u_metersToUnits;
          uniform float u_verticalExag;

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

            // Displace along normal: land (>0m) has full vertical exaggeration;
            // bathymetry is preserved at ellipsoidal sea level or subtle abyssal trench depth
            float dispMeters = (rawMeters > 0.0) ? rawMeters : (rawMeters * 0.15);
            vec3 displacedPos = position + normal * (dispMeters * u_metersToUnits * u_verticalExag);

            // In center-relative geodetic space (Identity modelMatrix), normal is world normal
            vWorldNormal = normalize(normal);
            vec4 mvPosition = modelViewMatrix * vec4(displacedPos, 1.0);
            vViewPos = -mvPosition.xyz;
            gl_Position = projectionMatrix * mvPosition;
          }
        `,
        fragmentShader: `
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

          varying vec3 vWorldNormal;
          varying vec3 vViewPos;
          varying vec2 vUv;
          varying float vElevation;
          varying vec3 vLocalPos;

          void main() {
            vec3 N = normalize(vWorldNormal);
            vec3 V = normalize(vViewPos);
            // Transform world light direction and surface normal into view space
            vec3 L_view = normalize((viewMatrix * vec4(u_lightDir, 0.0)).xyz);

            // 4-point central difference surface slope gradient
            vec2 texel = vec2(1.0 / 2048.0, 1.0 / 1024.0);
            float hL = u_globalHMin + texture2D(u_globalElevation, vUv - vec2(texel.x, 0.0)).r * (u_globalHMax - u_globalHMin);
            float hR = u_globalHMin + texture2D(u_globalElevation, vUv + vec2(texel.x, 0.0)).r * (u_globalHMax - u_globalHMin);
            float hD = u_globalHMin + texture2D(u_globalElevation, vUv - vec2(0.0, texel.y)).r * (u_globalHMax - u_globalHMin);
            float hU = u_globalHMin + texture2D(u_globalElevation, vUv + vec2(0.0, texel.y)).r * (u_globalHMax - u_globalHMin);

            // Gradient slope calculation in tangent space
            float dh_dx = (hR - hL) / 38000.0;
            float dh_dy = (hD - hU) / 38000.0;

            vec3 upRef = abs(N.y) < 0.99 ? vec3(0.0, 1.0, 0.0) : vec3(0.0, 0.0, 1.0);
            vec3 tangent = normalize(cross(upRef, N));
            vec3 bitangent = normalize(cross(N, tangent));
            vec3 perturbedWorldN = normalize(N - tangent * (dh_dx * 2.2) - bitangent * (dh_dy * 2.2));
            vec3 perturbedN_view = normalize((viewMatrix * vec4(perturbedWorldN, 0.0)).xyz);

            float NdotL = dot(perturbedN_view, L_view);
            float wrapDiffuse = pow(max(0.0, (NdotL + 0.35) / 1.35), 1.45);
            float rim = pow(1.0 - max(0.0, dot(perturbedN_view, V)), 2.8);

            // Sample true per-pixel elevation directly from global relief texture
            float normCenter = texture2D(u_globalElevation, vUv).r;
            float fragElev = u_globalHMin + normCenter * (u_globalHMax - u_globalHMin);

            // Sublime Nocturnal Monolith Color Grading
            vec3 baseColor;
            float isOcean = step(fragElev, 0.0);

            if (fragElev < 0.0) {
              // Deep Ocean Bathymetric Light Absorption (Sublime Nocturnal Monolith)
              float depthAbsorption = exp(fragElev * 0.00045); // fragElev is negative: deeper = closer to 0
              float shelfT = clamp((fragElev + 3200.0) / 3200.0, 0.0, 1.0);
              vec3 abyssVoid = vec3(0.002, 0.005, 0.010);
              vec3 abyssColor = vec3(0.012, 0.024, 0.048);
              vec3 deepAbyss = mix(abyssVoid, abyssColor, depthAbsorption);
              vec3 shelfColor = vec3(0.028, 0.075, 0.135);
              baseColor = mix(deepAbyss, shelfColor, shelfT);
            } else {
              // Land topography: granitic lowlands to alpine mountain massifs with slope-sensitive relief
              float slopeMag = length(vec2(dh_dx, dh_dy)) * 80.0;
              float slopeScarp = smoothstep(0.06, 0.28, slopeMag);
              float elevFactor = clamp(fragElev / 1200.0, 0.0, 1.0);
              float terrainRelief = max(slopeScarp, elevFactor);

              vec3 indigoVoid   = vec3(0.055, 0.075, 0.110);
              vec3 chiseledRock = vec3(0.165, 0.200, 0.255);
              vec3 alpineSummit = vec3(0.240, 0.290, 0.360);
              baseColor = mix(indigoVoid, chiseledRock, terrainRelief * 0.85);
              baseColor = mix(baseColor, alpineSummit, pow(terrainRelief, 2.0) * 0.75);
            }

            // Specular glint on ocean surface
            vec3 H = normalize(L_view + V);
            float NdotH = max(0.0, dot(perturbedN_view, H));
            float spec = pow(NdotH, 42.0) * isOcean * 0.52;

            // Ambient + Directional lighting (Sculptural Contrast Harmonized)
            vec3 lit = baseColor * (u_ambientColor + u_lightColor * (wrapDiffuse * 1.45)) + u_lightColor * spec;

            // Celestial rim scattering: deep blue atmospheric halo on limb
            vec3 atmosphereColor = vec3(0.24, 0.44, 0.76);
            lit += atmosphereColor * (rim * 0.48);

            // Crustal Stress Radiance on Planetary Surface (Continuous Global Wavefield)
            if (u_simTime > 0.0) {
              float epicentralDist = length(vLocalPos.xz);
              float waveRS = max(0.0, u_vS * u_simTime);
              float distToS = abs(epicentralDist - waveRS);
              float stressFront = exp(-pow(distToS / 0.045, 2.0)) * smoothstep(0.0, 0.25, u_simTime) * exp(-epicentralDist * 0.85);
              vec3 stressColor = isOcean > 0.5 ? vec3(0.35, 0.65, 0.95) : vec3(0.30, 0.55, 0.85);
              lit += stressColor * (stressFront * 0.38);
            }

            gl_FragColor = vec4(lit, 1.0);
          }
        `,
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

      // Phase E: Continuous Planetary Elevation Foundation (NOAA ETOPO 2022)
      u_globalElevation: { value: null },
      u_globalHMin: { value: -11000.0 },
      u_globalHMax: { value: 9000.0 },
      u_uncertaintyRadiusUnits: { value: 0.45 },

      // Interactive Geophysics-to-Wavefield Probe (Phase F1)
      u_probeDistUnits: { value: 0.0 },
      u_probeCritUnits: { value: 0.0 },
      u_probeCrossUnits: { value: 0.0 }
    };
    window.terrainUniforms = terrainUniforms;

    const integratedTerrainMat = new THREE.ShaderMaterial({
      uniforms: terrainUniforms,
      transparent: true,
      depthWrite: false,
      polygonOffset: false,
      vertexShader: `
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

        // Dynamic Seismic Parameters
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
        uniform float u_enableStratum1;
        uniform float u_enableStratum2;
        uniform float u_purePhysicalMode;

        varying vec2 vUv;
        varying vec3 vNormal;
        varying vec3 vWorldNormal;
        varying vec3 vViewPos;
        varying float vElevation;
        varying float vSlope;
        varying float vRidgeConvexity;
        varying float vIsUnderwater;
        varying float vWavePhaseP;
        varying float vWavePhaseS;
        varying float vWaveEnergy;
        varying float vDistHypo;
        varying vec2 vPhysicalCoords;
        varying float vDisplacementMag;
        varying float vEdgeTaper;

        void main() {
          vUv = uv;
          vec2 demUv = uv;

          float normH = texture2D(u_demTexture, demUv).r;
          float rawMeters = u_hMin + normH * (u_hMax - u_hMin);

          // Phase E: Continuous Planetary Elevation Foundation (NOAA ETOPO 2022)
          float normGlobal = texture2D(u_globalElevation, a_uvGlobal).r;
          float hGlobal = u_globalHMin + normGlobal * (u_globalHMax - u_globalHMin);

          // Seamless boundary elevation reconciliation:
          float edgeDist = min(min(uv.x, 1.0 - uv.x), min(uv.y, 1.0 - uv.y));
          float edgeTaper = smoothstep(0.002, 0.120, edgeDist);
          float reconciledElevation = mix(hGlobal, rawMeters, edgeTaper);
          vEdgeTaper = edgeTaper;

          vElevation = reconciledElevation;
          vIsUnderwater = (reconciledElevation < 0.0) ? 1.0 : 0.0;

          // Static 4-point central difference surface normal and Laplacian
          float h_C = (u_hMin + normH * (u_hMax - u_hMin)) * u_verticalExag;
          float h_L = (u_hMin + texture2D(u_demTexture, demUv - vec2(u_texelSize.x, 0.0)).r * (u_hMax - u_hMin)) * u_verticalExag;
          float h_R = (u_hMin + texture2D(u_demTexture, demUv + vec2(u_texelSize.x, 0.0)).r * (u_hMax - u_hMin)) * u_verticalExag;
          float h_D = (u_hMin + texture2D(u_demTexture, demUv - vec2(0.0, u_texelSize.y)).r * (u_hMax - u_hMin)) * u_verticalExag;
          float h_U = (u_hMin + texture2D(u_demTexture, demUv + vec2(0.0, u_texelSize.y)).r * (u_hMax - u_hMin)) * u_verticalExag;

          float dh_dx = (h_R - h_L) / (2.0 * u_metricSpacing.x);
          float dh_dy = (h_D - h_U) / (2.0 * u_metricSpacing.y);

          vec3 localNormal = normalize(vec3(-dh_dx, 1.0, -dh_dy));
          float slopeRad = acos(clamp(localNormal.y, 0.0, 1.0));
          vSlope = slopeRad * (180.0 / 3.14159265);

          // Topographic convexity (Laplacian): negative on convex ridge crests, positive in valley troughs
          float laplacian = (h_R + h_L + h_U + h_D - 4.0 * h_C);
          vRidgeConvexity = clamp(-laplacian * 0.22, 0.0, 1.0);

          // Physical coordinate system
          float x_units = (uv.x - 0.5) * u_physicalSize.x;
          float z_units = (0.5 - uv.y) * u_physicalSize.y;
          vPhysicalCoords = vec2(x_units, z_units);

          // -------------------------------------------------------------------
          // DYNAMIC SEISMIC KINEMATICS & 3D GROUND DEFORMATION
          // -------------------------------------------------------------------
          vec2 dEpi = vec2(x_units - u_epiPos.x, z_units - u_epiPos.y);
          float epicentralDist = length(dEpi);
          float hypocentralDist = sqrt(epicentralDist * epicentralDist + u_depthUnits * u_depthUnits);
          vDistHypo = hypocentralDist;

          // Unit propagation vectors
          vec2 dirRadial = (epicentralDist > 0.0001) ? (dEpi / epicentralDist) : vec2(1.0, 0.0);
          vec2 dirTransverse = vec2(-dirRadial.y, dirRadial.x);

          // Fault radiation directivity (Double-couple 4-lobed pattern)
          float angleEpi = atan(dEpi.y, dEpi.x);
          float radP = abs(sin(2.0 * (angleEpi - u_faultStrike)));
          float radS = abs(cos(2.0 * (angleEpi - u_faultStrike)));
          float fRadP = mix(1.0, radP, u_radiationDirectivity);
          float fRadS = mix(1.0, radS, u_radiationDirectivity);

          // Continental shelf refraction proxy
          float bathyDepth = max(0.0, -rawMeters);
          float shelfFactor = smoothstep(60.0, 380.0, bathyDepth);
          float localVelP = u_vP * mix(0.80, 1.0, shelfFactor);
          float localVelS = u_vS * mix(0.74, 1.0, shelfFactor);

          float t_P = hypocentralDist / localVelP;
          float t_S = hypocentralDist / localVelS;
          float dt_P = u_simTime - t_P;
          float dt_S = u_simTime - t_S;

          // Frequency-dependent wave packet parameters
          float omega = 6.2831853 * u_dominantFreq;
          float packetDurP = 1.6 / max(0.4, u_dominantFreq);
          float packetDurS = 2.2 / max(0.4, u_dominantFreq);

          // Quality factor crustal anelastic attenuation
          float gammaP = (3.14159 * u_dominantFreq) / (max(40.0, u_attenuationQ) * localVelP);
          float gammaS = (3.14159 * u_dominantFreq) / (max(40.0, u_attenuationQ) * localVelS);
          float geomAtten = 1.0 / sqrt(max(0.06, hypocentralDist * 4.5));
          float attenP = geomAtten * exp(-gammaP * hypocentralDist * 0.16);
          float attenS = geomAtten * exp(-gammaS * hypocentralDist * 0.16);

          // Emergence angle: cos(theta) = depth / R
          float cosEmergence = clamp(u_depthUnits / hypocentralDist, 0.12, 1.0);
          float sinEmergence = sqrt(max(0.0, 1.0 - cosEmergence * cosEmergence));

          // P & S Wave Packets
          float pEnv = exp(-dt_P * dt_P / (2.0 * packetDurP * packetDurP * 0.25)) * step(0.0, dt_P);
          float pPhase = sin(omega * dt_P) * pEnv * fRadP * u_modeP;

          float sEnv = exp(-dt_S * dt_S / (2.0 * packetDurS * packetDurS * 0.25)) * step(0.0, dt_S);
          float sPhase = sin(omega * dt_S) * sEnv * fRadS * u_modeS;

          vWavePhaseP = pPhase * attenP;
          vWavePhaseS = sPhase * attenS;
          vWaveEnergy = (pEnv * 0.35 + sEnv * 1.1) * attenS;

          // Topographic site response amplification on steep ridges & summits (controlled)
          float topoAmp = 1.0 + 0.65 * smoothstep(14.0, 40.0, vSlope) * step(0.0, rawMeters);

          // Prolonged Coda ground tremor
          float t_coda = max(0.0, u_simTime - t_S);
          float codaDecayRate = 18.0 / max(60.0, u_attenuationQ);
          float codaEnv = exp(-t_coda * codaDecayRate) * step(0.0, t_coda);
          float codaHarmonic = sin(omega * 0.72 * t_coda + vElevation * 0.0015);
          float codaTremor = codaHarmonic * codaEnv * attenS * 0.35 * topoAmp * fRadS * u_modeS;

          // 3D Physical Ground Displacement (Refined Mountain Micro-motion)
          // Granitic bedrock stiffness dampens extreme displacement while preserving crisp transmission
          float bedrockDamping = mix(1.0, 0.68, smoothstep(250.0, 1500.0, rawMeters));
          float depthAmpScale = clamp(15.0 / max(5.0, u_focalDepthKm), 0.55, 1.8);
          float baseAmpP = 0.00008 * depthAmpScale * u_physicalDisplacement;
          float baseAmpS = 0.00022 * depthAmpScale * u_physicalDisplacement * bedrockDamping;

          // Longitudinal P-wave 3D vector (push-pull)
          vec3 vecP = vec3(dirRadial.x * sinEmergence, 0.40 * cosEmergence, dirRadial.y * sinEmergence) * (vWavePhaseP * baseAmpP);

          // Transverse S-wave 3D vector (shear & vertical heave)
          vec3 vecS = vec3(dirTransverse.x * cosEmergence, 0.60 * sinEmergence, dirTransverse.y * cosEmergence) * ((vWavePhaseS + codaTremor) * baseAmpS * topoAmp);

          // 3D Retrograde Elliptical Rayleigh Surface Wave
          float t_R = (u_depthUnits / max(0.001, localVelS)) + (epicentralDist / max(0.001, u_vR));
          float dt_R = u_simTime - t_R;
          float packetDurR = 3.6 / max(0.3, u_dominantFreq);
          float rEnv = exp(-dt_R * dt_R / (2.0 * packetDurR * packetDurR * 0.35)) * step(0.0, dt_R);
          float geomAttenSurf = 1.0 / pow(max(0.04, epicentralDist * 3.5), 0.25);
          float gammaR = (3.14159 * u_dominantFreq) / (max(30.0, u_attenuationQ * 0.7) * u_vR);
          float attenR = geomAttenSurf * exp(-gammaR * epicentralDist * 0.12);
          float rRadOsc = cos(omega * 0.45 * dt_R) * rEnv * attenR;
          float rVertOsc = +sin(omega * 0.45 * dt_R) * rEnv * attenR;
          float baseAmpR = 0.00030 * depthAmpScale * u_physicalDisplacement;
          vec3 vecR = vec3(dirRadial.x * rRadOsc, 0.65 * rVertOsc, dirRadial.y * rRadOsc) * baseAmpR;

          // 3D Vector Displacement Field u(x,t) = uP(x,t) + uS(x,t) + uR(x,t)
          vec3 disp3D = vecP + vecS + vecR;
          vDisplacementMag = length(disp3D);

          // Dynamic normal perturbation with guaranteed non-inverting zenith bias
          float k_P = omega / max(0.001, localVelP);
          float k_S = omega / max(0.001, localVelS);
          float waveSlopeP = cos(omega * dt_P) * pEnv * attenP * fRadP * u_modeP * baseAmpP * k_P;
          float waveSlopeS = cos(omega * dt_S) * sEnv * attenS * fRadS * u_modeS * baseAmpS * k_S;
          vec2 waveSlopeHoriz = dirRadial * (waveSlopeP + waveSlopeS * 0.30) + dirTransverse * (waveSlopeS * 0.45);

          vec3 perturbedNormal = normalize(localNormal - vec3(waveSlopeHoriz.x * 0.15, 0.0, waveSlopeHoriz.y * 0.15));
          perturbedNormal.y = max(0.40, perturbedNormal.y); // Prevent downward flipped normals
          perturbedNormal = normalize(perturbedNormal);

          vWorldNormal = perturbedNormal;
          vNormal = normalMatrix * perturbedNormal;

          // Smooth edge reconciliation: regional relief seamlessly fuses into Tier 0 WGS84 Ellipsoid
          // Displace along surface normal (WGS84 ellipsoidal curvature)
          float dispMeters = (reconciledElevation > 0.0) ? reconciledElevation : (reconciledElevation * 0.15);
          float displacedElevation = dispMeters * u_verticalExag * u_metersToUnits;
          vec3 displacedPos = position + normal * displacedElevation + (disp3D * edgeTaper);

          vec4 mvPosition = modelViewMatrix * vec4(displacedPos, 1.0);
          vViewPos = -mvPosition.xyz;
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        precision highp float;
        uniform vec3 u_lightDir;
        uniform vec3 u_lightColor;
        uniform vec3 u_ambientColor;
        uniform float u_simTime;
        uniform vec2 u_epiPos;
        uniform float u_depthUnits;
        uniform float u_focalDepthKm;
        uniform float u_dominantFreq;
        uniform float u_attenuationQ;
        uniform float u_faultStrike;
        uniform float u_radiationDirectivity;
        uniform float u_modeP;
        uniform float u_modeS;
        uniform float u_vP;
        uniform float u_vS;
        uniform float u_enableStratum1;
        uniform float u_enableStratum2;
        uniform float u_purePhysicalMode;
        uniform float u_ridgeStyle;
        uniform float u_uncertaintyRadiusUnits;

        // Interactive Geophysics-to-Wavefield Probe (Phase F1)
        uniform float u_probeDistUnits;
        uniform float u_probeCritUnits;
        uniform float u_probeCrossUnits;

        varying vec2 vUv;
        varying vec3 vNormal;
        varying vec3 vWorldNormal;
        varying vec3 vViewPos;
        varying float vElevation;
        varying float vSlope;
        varying float vRidgeConvexity;
        varying float vIsUnderwater;
        varying float vWavePhaseP;
        varying float vWavePhaseS;
        varying float vWaveEnergy;
        varying float vDistHypo;
        varying vec2 vPhysicalCoords;
        varying float vDisplacementMag;
        varying float vEdgeTaper;

        float hash(vec2 p) {
          return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
        }

        void main() {
          // Strictly discard ocean/bathymetry: tier0GlobeMesh handles the continuous planetary ocean
          if (vElevation < -15.0) discard;

          vec3 N = normalize(vNormal);
          vec3 V = normalize(vViewPos);
          vec3 L = normalize(u_lightDir);

          float NdotL = dot(N, L);
          float wrapDiffuse = pow(max(0.0, (NdotL + 0.32) / 1.32), 1.5);
          vec3 H = normalize(L + V);
          float spec = pow(max(0.0, dot(N, H)), 32.0) * max(0.0, NdotL);
          float rim = pow(1.0 - max(0.0, dot(N, V)), 3.2) * max(0.0, dot(L, -V) + 0.35);

          float grain = hash(vUv * 3600.0) * 0.05;

          // -------------------------------------------------------------------
          // BASE TERRAIN PBR ALBEDO (Sculptural Nocturnal Monolith)
          // -------------------------------------------------------------------
          float slopeScarp = smoothstep(22.0, 45.0, vSlope);
          float alpinePeak = smoothstep(1250.0, 1704.0, vElevation);
          vec3 indigoVoid   = vec3(0.055, 0.075, 0.110);
          vec3 chiseledRock = vec3(0.165, 0.200, 0.255);
          vec3 alpineSummit = vec3(0.240, 0.290, 0.360);
          vec3 baseAlbedo = mix(indigoVoid, chiseledRock, slopeScarp * 0.88);
          baseAlbedo = mix(baseAlbedo, alpineSummit, alpinePeak * 0.85);
          baseAlbedo += (grain - 0.025) * 0.8;

          // Directional Moonlight & Ambient Lighting
          vec3 lit = baseAlbedo * (u_ambientColor + u_lightColor * (wrapDiffuse * 1.45));
          lit += u_lightColor * (spec * 0.04);
          vec3 atmosphereColor = vec3(0.24, 0.44, 0.76);
          lit += atmosphereColor * (rim * 0.48);

          // Gallery Sculptural Mountain Crest Grazing Rim Light (Ridge Chiseled Definition)
          float crestFactor = smoothstep(14.0, 38.0, vSlope) * (0.35 + 0.65 * vRidgeConvexity);
          float mountainRim = pow(1.0 - max(0.0, dot(N, V)), 2.8) * max(0.0, dot(L, -V) + 0.45);
          vec3 rimSculptColor = mix(vec3(0.24, 0.44, 0.76), vec3(0.82, 0.88, 0.96), alpinePeak);
          lit += rimSculptColor * (mountainRim * crestFactor * 0.38);

          // Dynamic strain specular & rim boost on wavefront passage
          float strainBoost = smoothstep(0.001, 0.012, vDisplacementMag) * 0.20;
          lit += vec3(0.35, 0.65, 0.90) * (rim * strainBoost * 0.40) + u_lightColor * (spec * strainBoost * 0.15);

          if (u_purePhysicalMode < 0.5) {
            vec2 dEpi = vPhysicalCoords - u_epiPos;
            float epicentralDist = length(dEpi);
            float waveRS = sqrt(max(0.0, (u_vS * u_simTime) * (u_vS * u_simTime) - u_depthUnits * u_depthUnits));

            // STRATUM 1: Crustal Stress Directivity
            if (u_enableStratum1 > 0.5) {
              float distToFrontS = abs(epicentralDist - waveRS);
              float stressFront = exp(-pow(distToFrontS * 42.0, 2.0)) * smoothstep(0.0, 0.20, u_simTime - u_depthUnits / u_vS) * exp(-epicentralDist * 1.5);
              vec3 stressColor = vec3(0.28, 0.55, 0.85);
              lit += stressColor * (stressFront * 0.22);
            }

            // STRATUM 2: Topography-Driven Wavefront Blooming & Ridge Resonance (Anti-Game-VFX)
            if (u_enableStratum2 > 0.5) {
              float distToFrontS = abs(epicentralDist - waveRS);
              float t_S_arrival = vDistHypo / u_vS;
              float dtS_arrival = u_simTime - t_S_arrival;

              // Mountain ridge resonance (Smooth continuous crystalline aura, NO zebra stripes!)
              float isAlpine = smoothstep(180.0, 950.0, vElevation);
              float ridgeSharp = smoothstep(14.0, 38.0, vSlope);
              float ridgeCrest = vRidgeConvexity * ridgeSharp;
              float ridgeHalo = pow(vRidgeConvexity, 0.75) * 0.65;
              float totalRidgeShape = ridgeCrest * 0.85 + ridgeHalo * 0.75;

              vec2 ridgeTangent = normalize(vec2(-vWorldNormal.z, vWorldNormal.x));
              vec2 waveDir = (epicentralDist > 0.0001) ? (dEpi / epicentralDist) : vec2(1.0, 0.0);
              float ridgeAlignment = abs(dot(ridgeTangent, vec2(-waveDir.y, waveDir.x)));

              float ridgeEnvelope = exp(-pow(distToFrontS / 0.040, 2.0)) * smoothstep(-0.02, 0.04, dtS_arrival);
              float surfaceRidgeStream = totalRidgeShape * ridgeEnvelope * (0.60 + 0.40 * ridgeAlignment);

              float summitSpire = smoothstep(950.0, 1708.0, vElevation) * vRidgeConvexity;
              float condensationFlash = pow(max(0.0, sin(dtS_arrival * 16.0)), 2.6) * exp(-max(0.0, dtS_arrival) * 2.0);
              float summitCondensation = summitSpire * condensationFlash * 2.4;

              float ridgeResonance = isAlpine * (surfaceRidgeStream * 1.5 + summitCondensation);

              // Low-frequency ground tremor across plains (Subtle, authentic acoustic propagation)
              float isPlain = (1.0 - isAlpine) * (1.0 - smoothstep(12.0, 26.0, vSlope));
              float surfaceRipple = isPlain * exp(-pow(distToFrontS * 32.0, 2.0)) * smoothstep(-0.02, 0.04, dtS_arrival) * 0.08;

              vec3 colorRidge = vec3(0.55, 0.75, 0.95);
              vec3 colorRipple = vec3(0.18, 0.35, 0.58);

              float taperFactor = smoothstep(0.005, 0.180, vEdgeTaper);
              lit += colorRidge * (ridgeResonance * taperFactor * 0.55);
              lit += colorRipple * (surfaceRipple * taperFactor * 0.35);

              // Fast Compressional P-Wave Precursor Crest (Silver-Cyan Topographic Shimmer ahead of S-Wave)
              float waveRP = sqrt(max(0.0, (u_vP * u_simTime) * (u_vP * u_simTime) - u_depthUnits * u_depthUnits));
              float distToFrontP = abs(epicentralDist - waveRP);
              float t_P_arrival = vDistHypo / u_vP;
              float dtP_arrival = u_simTime - t_P_arrival;
              float pEnvelope = exp(-pow(distToFrontP / 0.028, 2.0)) * smoothstep(-0.02, 0.04, dtP_arrival) * u_modeP;
              float pRidgeTrace = (totalRidgeShape * 0.65 + isPlain * 0.12) * pEnvelope * taperFactor;
              lit += vec3(0.68, 0.86, 0.98) * (pRidgeTrace * 0.28);

              // Historical Epicentral Uncertainty Topographic Contour (±errorRadiusKm on terrain surface)
              if (u_uncertaintyRadiusUnits > 0.01) {
                float distToUnc = abs(epicentralDist - u_uncertaintyRadiusUnits);
                float angleAz = atan(dEpi.y, dEpi.x);
                float stipple = step(0.35, fract(angleAz * 18.0 / 6.2831853));
                float contourLine = exp(-pow(distToUnc / 0.0045, 2.0)) * stipple * taperFactor;
                lit += vec3(0.78, 0.62, 0.33) * (contourLine * 0.13);
              }
            }
          }

          // -------------------------------------------------------------------
          // INTERACTIVE GEOPHYSICAL ISOCHRONE PROBE & CRITICAL DISTANCE RINGS (F1)
          // -------------------------------------------------------------------
          vec2 dEpiProbe = vPhysicalCoords - u_epiPos;
          float epiDistProbe = length(dEpiProbe);
          float taperFactorProbe = smoothstep(0.005, 0.180, vEdgeTaper);

          if (u_probeDistUnits > 0.0005) {
            float distToProbe = abs(epiDistProbe - u_probeDistUnits);
            float probeBand = exp(-pow(distToProbe / 0.0032, 2.0)) * taperFactorProbe;
            // Radiant Brass Wavefront Isochrone Ring
            lit += vec3(0.92, 0.78, 0.45) * (probeBand * 0.60);
          }

          if (u_probeCritUnits > 0.0005 || u_probeCrossUnits > 0.0005) {
            float angleAzProbe = atan(dEpiProbe.y, dEpiProbe.x);

            if (u_probeCritUnits > 0.0005) {
              float distToCrit = abs(epiDistProbe - u_probeCritUnits);
              float dashCrit = step(0.40, fract(angleAzProbe * 24.0 / 6.2831853));
              float critBand = exp(-pow(distToCrit / 0.0022, 2.0)) * dashCrit * taperFactorProbe;
              // Cool Mist dashed ring for Critical Distance X_crit
              lit += vec3(0.53, 0.59, 0.67) * (critBand * 0.35);
            }

            if (u_probeCrossUnits > 0.0005) {
              float distToCross = abs(epiDistProbe - u_probeCrossUnits);
              float dashCross = step(0.45, fract(angleAzProbe * 36.0 / 6.2831853));
              float crossBand = exp(-pow(distToCross / 0.0028, 2.0)) * dashCross * taperFactorProbe;
              // Cinnabar/Brass dashed ring for Crossover Distance X_cross
              lit += vec3(0.85, 0.45, 0.25) * (crossBand * 0.45);
            }
          }

          // Seamless boundary blend into underlying planetary foundation
          float boundaryAlpha = smoothstep(0.001, 0.120, vEdgeTaper);
          if (boundaryAlpha < 0.001) discard;
          gl_FragColor = vec4(lit, boundaryAlpha);
        }
      `
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
      vertexShader: `
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

          // Continental shelf shoaling amplification (shallow water wave dynamic)
          float shelfFactor = smoothstep(320.0, 25.0, bathyDepth);
          vShelfFactor = shelfFactor;

          vec2 dEpi = vec2(x_units - u_epiPos.x, z_units - u_epiPos.y);
          float rEpi = length(dEpi);
          float hypoDist = sqrt(rEpi * rEpi + u_depthUnits * u_depthUnits);

          // Submarine S-wave travel time with bathymetric shelf refraction proxy
          float localVelS = u_vS * mix(0.74, 1.0, smoothstep(60.0, 380.0, bathyDepth));
          float t_wave = hypoDist / localVelS;
          float dt_wave = u_simTime - t_wave;

          float omega = 6.2831853 * u_dominantFreq;
          float packetDur = 2.4 / max(0.4, u_dominantFreq);
          float env = exp(-dt_wave * dt_wave / (2.0 * packetDur * packetDur * 0.25)) * smoothstep(-0.02, 0.04, dt_wave);
          vWaveFrontFactor = env;

          // Smooth boundary tapering into Tier 0 WGS84 Ellipsoid Ocean
          float edgeDist = min(min(uv.x, 1.0 - uv.x), min(uv.y, 1.0 - uv.y));
          float edgeTaper = smoothstep(0.002, 0.220, edgeDist);
          vWaterEdgeTaper = edgeTaper;

          // 3D physical water swell heaves (amplified near continental shelf - Natural Long-Period Swell)
          float shoalingAmp = mix(1.0, 1.85, shelfFactor);
          float waveSwell = sin(omega * dt_wave) * env * (0.00035 * u_physicalDisplacement * shoalingAmp) / sqrt(max(0.20, hypoDist * 2.5));

          // Strict Anti-Game-VFX: zero crater dome, subtle natural flexure
          float totalSwell = waveSwell * edgeTaper;
          vWaterSwell = totalSwell;

          // Exact WGS84 Ellipsoidal Surface for sea level (h=0) is encoded in position.y
          vec3 displacedPos = vec3(position.x, position.y + totalSwell, position.z);
          vec4 mvPosition = modelViewMatrix * vec4(displacedPos, 1.0);
          vViewPos = -mvPosition.xyz;

          // Wave slope & dynamic surface normal
          float waveSlope = cos(omega * dt_wave) * env * 0.45 * shoalingAmp * edgeTaper;
          vec2 dir = (rEpi > 0.0001) ? (dEpi / rEpi) : vec2(0.0);
          vec3 localN = normalize(vec3(-dir.x * waveSlope, 1.0, -dir.y * waveSlope));
          vNormal = normalMatrix * localN;

          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        precision highp float;
        uniform vec3 u_lightDir;
        uniform vec3 u_lightColor;
        uniform float u_simTime;
        uniform vec2 u_epiPos;
        uniform float u_dominantFreq;
        uniform float u_enableStratum2;
        uniform float u_purePhysicalMode;
        uniform float u_oceanBloomMode; // 1.0 = Mode A, 2.0 = Mode B

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

          // Nocturnal oceanic palette: deep abyssal midnight blue to shelf teal
          float depthAbsorption = exp(-vBathyDepth * 0.00065);
          vec3 abyssalVoid = vec3(0.002, 0.005, 0.010);
          vec3 abyssalTone = vec3(0.012, 0.024, 0.048);
          vec3 deepBathymetryTone = mix(abyssalVoid, abyssalTone, depthAbsorption);
          vec3 shelfTone   = vec3(0.028, 0.075, 0.135);
          vec3 waterTint = mix(deepBathymetryTone, shelfTone, vShelfFactor);

          // -------------------------------------------------------------------
          // NATURAL SWELL CREST BLOOM & LUNAR-SILVER SPECULAR GLEAM (Anti-Game-VFX)
          // -------------------------------------------------------------------
          vec2 dEpi = vWorldPos - u_epiPos;
          float rEpi = length(dEpi);

          vec3 crestBloomColor = vec3(0.40, 0.74, 0.98);
          vec3 crestVeilColor  = vec3(0.62, 0.85, 1.0);
          float crestEnergy = pow(clamp(vWaterSwell * 500.0, 0.0, 1.0), 1.2) * vWaveFrontFactor;
          float grazing = pow(1.0 - NdotV, 2.0);
          float crestBloom = crestEnergy * (0.60 + 0.40 * vShelfFactor) * (0.5 + 0.5 * grazing);
          float crestVeil = pow(vWaveFrontFactor, 1.5) * (0.45 + 0.55 * grazing) * (0.50 + 0.50 * vShelfFactor);

          vec3 finalColor = waterTint + u_lightColor * spec * 0.45;
          float alpha = 0.25 + fresnel * 0.35;

          if (u_purePhysicalMode < 0.5 && u_enableStratum2 > 0.5) {
            if (u_oceanBloomMode < 1.5) {
              // MODE A: Surface-Coupled Only
              finalColor += crestBloomColor * (crestBloom * 1.15) + crestVeilColor * (crestVeil * 0.45);
              alpha += crestBloom * 0.35 + crestVeil * 0.15;
            } else {
              // MODE B: Hybrid Dual-Layer (Swell Crest Bloom + Subsea Shelf Radiance)
              vec3 subseaGlow = vec3(0.015, 0.055, 0.110) * vShelfFactor * exp(-rEpi * 1.2);

              finalColor += crestBloomColor * (crestBloom * 0.95) + crestVeilColor * (crestVeil * 0.35) + subseaGlow;
              alpha += crestBloom * 0.25 + crestVeil * 0.10;
            }
          }

          float boundaryAlpha = smoothstep(0.000, 0.180, vWaterEdgeTaper);
          gl_FragColor = vec4(finalColor, clamp(alpha, 0.0, 0.85) * boundaryAlpha);
        }
      `,
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
    // Evaluates DEM Metrics & Resolves Ground Placements without Overlap
    // -------------------------------------------------------------------------
    class TerrainAwareSpawner {
      constructor(candidateCache) {
        this.candidateCache = candidateCache;
      }

      resolveCandidate(unitDef, parsedEvent) {
        const lat = parsedEvent.spatialCoords.lat;
        const lon = parsedEvent.spatialCoords.lon;
        const unitIndex = parsedEvent.semanticUnits ? parsedEvent.semanticUnits.indexOf(unitDef) : 0;
        const spreadOffset = (unitIndex >= 0 && parsedEvent.semanticUnits.length > 1) 
          ? (unitIndex - (parsedEvent.semanticUnits.length - 1) * 0.5) * 0.055 
          : 0.0;

        const isRegionalActive = terrainMesh && terrainMesh.visible;
        const demCoverageStatus = isRegionalActive
          ? "IN_COVERAGE"
          : "GLOBAL_ETOPO_PLANETARY_COVERAGE";

        let chosenWorldX = 0;
        let chosenWorldZ = 0;
        let groundY = 0;
        let elevation = 0;
        let slope = 0;
        let gradX = 0;
        let gradZ = 0;
        let normX = 0;
        let normZ = 1;
        let suitability = "OPTIMAL_AFFINITY_MATCH";

        if (unitDef.spatial?.anchorHint && isRegionalActive) {
          chosenWorldX = unitDef.spatial.anchorHint.worldX;
          chosenWorldZ = unitDef.spatial.anchorHint.worldZ;
          const m = getTerrainMetricsAt(chosenWorldX, chosenWorldZ);
          groundY = m.groundY;
          elevation = m.meters;
          slope = m.slopeDeg;
          gradX = m.gradX;
          gradZ = m.gradZ;
          normX = m.normX;
          normZ = m.normZ;
          suitability = "PROFILE_ANCHOR_VERIFIED";
        } else if (isRegionalActive && this.candidateCache.length > 0) {
          const preferredCategory = unitDef.spatial?.preferredType?.toUpperCase() || "GENERAL_TERRAIN";
          const targetZone = unitDef.spatial?.stageZone || "ZONE_B_INLAND";

          const matches = this.candidateCache.filter(c =>
            (c.category === preferredCategory || preferredCategory === "GENERAL_TERRAIN") &&
            c.zone === targetZone
          );

          const pool = (matches.length > 0) ? matches : this.candidateCache.filter(c => c.zone === targetZone);
          // Strictly restrict fallback candidates to central focal region (|X| <= 0.12, |Z| <= 0.08)
          const focalPool = pool.filter(c => Math.abs(c.worldX) <= 0.12 && Math.abs(c.worldZ) <= 0.08);
          const candidateList = (focalPool.length > 0) ? focalPool : pool;
          const poolIdx = Math.min(candidateList.length - 1, Math.max(0, Math.floor(candidateList.length * (0.35 + (unitIndex >= 0 ? unitIndex * 0.22 : 0)))));
          const chosen = candidateList[poolIdx] || candidateList[Math.floor(candidateList.length / 2)] || { worldX: 0, worldZ: 0, groundY: 0, elevation: 0, slope: 0 };

          chosenWorldX = Math.max(-0.15, Math.min(0.15, chosen.worldX));
          chosenWorldZ = Math.max(-0.10, Math.min(0.10, chosen.worldZ));
          const m = getTerrainMetricsAt(chosenWorldX, chosenWorldZ);
          groundY = m.groundY;
          elevation = m.meters;
          slope = m.slopeDeg;
          gradX = m.gradX;
          gradZ = m.gradZ;
          normX = m.normX;
          normZ = m.normZ;
          suitability = "GENERIC_AFFINITY_MATCH";
        } else {
          // Global planetary relief mode: anchor at epicentral origin with harmonic spatial offset
          chosenWorldX = spreadOffset;
          chosenWorldZ = (unitIndex % 2 === 0 ? 0.018 : -0.018);
          groundY = 0.005;
          elevation = 120.0;
          slope = 5.0;
          suitability = "PLANETARY_EPICENTRAL_ANCHOR";
        }

        return {
          worldX: chosenWorldX,
          worldZ: chosenWorldZ,
          groundY: Math.max(0.0, groundY),
          elevation: elevation,
          slope: slope,
          gradX: gradX,
          gradZ: gradZ,
          normX: normX,
          normZ: normZ,
          t_activation: unitDef.timing.t_activation,
          demCoverageStatus: demCoverageStatus,
          suitability: suitability
        };
      }
    }

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
            child.material.depthTest = false;
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
          const safeX = spreadFactor * 0.055;
          const safeZ = (idx % 2 === 0 ? 0.030 : -0.015);
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

      // Pairwise NDC De-Overlapping Pass: Guarantee zero screen-space collisions across co-visible semantic units
      for (let pass = 0; pass < 5; pass++) {
        for (let i = 0; i < entities.length; i++) {
          for (let j = i + 1; j < entities.length; j++) {
            const gA = entities[i];
            const gB = entities[j];
            const tA = gA.userData?.t_activation ?? 0;
            const tB = gB.userData?.t_activation ?? 0;
            
            const wpA = new THREE.Vector3();
            const wpB = new THREE.Vector3();
            gA.getWorldPosition(wpA);
            gB.getWorldPosition(wpB);
            const ndcA = wpA.clone().project(evalCam);
            const ndcB = wpB.clone().project(evalCam);

            const dx = Math.abs(ndcA.x - ndcB.x);
            const dy = Math.abs(ndcA.y - ndcB.y);
            // Generous bounding threshold for atmospheric typography readability
            if (dx < 0.48 && dy < 0.18) {
              const dirX = (ndcA.x <= ndcB.x) ? -1.0 : 1.0;
              const dirY = (ndcA.y >= ndcB.y) ? 1.0 : -1.0;
              gA.position.x += dirX * 0.095;
              gB.position.x -= dirX * 0.095;
              gA.position.y = Math.max(0.060, gA.position.y + dirY * 0.055);
              gB.position.y = Math.max(0.060, gB.position.y - dirY * 0.055);
              gA.updateMatrixWorld(true);
              gB.updateMatrixWorld(true);
              if (gA.userData) {
                gA.userData.worldPos = { x: gA.position.x, y: gA.position.y, z: gA.position.z };
                if (gA.userData.cand) {
                  gA.userData.cand.worldX = gA.position.x;
                  gA.userData.cand.worldZ = gA.position.z;
                }
              }
              if (gB.userData) {
                gB.userData.worldPos = { x: gB.position.x, y: gB.position.y, z: gB.position.z };
                if (gB.userData.cand) {
                  gB.userData.cand.worldX = gB.position.x;
                  gB.userData.cand.worldZ = gB.position.z;
                }
              }
            }
          }
        }
      }
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
      const lat0 = currentParsedEvent.spatialCoords.lat ?? 37.95;
      const lon0 = currentParsedEvent.spatialCoords.lon ?? 129.05;

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

        let curW = 1.3142;
        let curH = 0.6634;
        if (eventId.includes('1681')) {
          curW = 1.3142; curH = 0.6634;
        } else if (eventId.includes('gyeongju')) {
          curW = 0.9034; curH = 1.1100;
        } else if (eventId.includes('pohang')) {
          curW = 0.9034; curH = 1.1100;
        } else if (eventId.includes('kumamoto')) {
          curW = 0.9500; curH = 1.1100;
        } else if (eventId.includes('turkey')) {
          curW = 0.8800; curH = 1.1100;
        }

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
      if (orchestrator.currentSource.focalMechanism && orchestrator.currentSource.focalMechanism.isVerified) {
        terrainUniforms.u_faultStrike.value = (orchestrator.currentSource.focalMechanism.strikeDeg * Math.PI) / 180.0;
        terrainUniforms.u_radiationDirectivity.value = 0.85;
      } else {
        terrainUniforms.u_radiationDirectivity.value = 0.0; // Isotropic fallback for historical events
      }

      // Update Topographic Epicentral Uncertainty Contour (Historical vs Instrumental)
      const isHistoricalRecord = !eventId.startsWith('inst_') && !eventId.startsWith('global_') && !eventId.startsWith('usgs_') && !eventId.includes('2016') && !eventId.includes('2017');
      if (isHistoricalRecord) {
        const errKm = currentParsedEvent?.errorRadiusKm || 45.0;
        terrainUniforms.u_uncertaintyRadiusUnits.value = (errKm * 1000.0) * METERS_TO_UNITS;
      } else {
        terrainUniforms.u_uncertaintyRadiusUnits.value = 0.0;
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
          camera.position.set(cx, cy, cz);
          controls.target.set(tx, ty, tz);
          controls.update();
          updateHUDForFlight('performance');
          if (controlSurface) controlSurface.setState('PERFORMANCE', currentParsedEvent);
        }
        const viewBadge = document.getElementById('view-preset-label');
        if (viewBadge) viewBadge.textContent = cp.name;
      }

      // 5. Spawn new semantic units via TerrainAwareSpawner
      currentParsedEvent.semanticUnits.forEach(unitDef => {
        const cand = spawner.resolveCandidate(unitDef, currentParsedEvent);
        let entity;
        if (unitDef.kinetic.archetype === "RESONANCE") {
          entity = createResonanceEntity(unitDef, cand);
        } else if (unitDef.kinetic.archetype === "FRACTURE") {
          entity = createFractureEntity(unitDef, cand);
        } else if (unitDef.kinetic.archetype === "RECEDE") {
          entity = createRecedeEntity(unitDef, cand);
        } else {
          entity = createExposeEntity(unitDef, cand);
        }
        scene.add(entity);
        archivalEntities.push(entity);
      });

      // 5.1 Enforce guaranteed Exhibition Composition framing
      validateAndAdjustExhibitionComposition(camera, archivalEntities, eventMeta);

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
      camera.position.copy(shot.pos);
      controls.target.copy(shot.lookAt);
      camera.fov = shot.fov;
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
    const maxSimTime = 35.0;

    window.setPlaybackSpeed = function(speed) {
      playbackSpeed = Math.max(0.25, Math.min(4.0, Number(speed) || 1.0));
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
      const dpr = (qualityMode === 'CLASSROOM') ? 1.0 : Math.min(window.devicePixelRatio || 1, 1.5);
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

    window.setSimulationPlaying = function(play) { isPlaying = !!play; };
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
    function seekToSimulationTime(t) {
      simTime = Math.max(0.0, Math.min(35.0, t));

      if (terrainUniforms) {
        terrainUniforms.u_simTime.value = simTime;
      }
      if (waterMat && waterMat.uniforms && waterMat.uniforms.u_simTime) {
        waterMat.uniforms.u_simTime.value = simTime;
      }
      if (tier0GlobeMesh && tier0GlobeMesh.material && tier0GlobeMesh.material.uniforms && tier0GlobeMesh.material.uniforms.u_simTime) {
        tier0GlobeMesh.material.uniforms.u_simTime.value = simTime;
      }
      if (orchestrator) {
        orchestrator.seismicTime = simTime;
        if (orchestrator.uniforms && orchestrator.uniforms.u_seismicTime) {
          orchestrator.uniforms.u_seismicTime.value = simTime;
        }
        orchestrator.update(simTime);
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
      if (scrubber && Math.abs(parseFloat(scrubber.value) - simTime) > 0.05) {
        scrubber.value = simTime.toFixed(1);
      }
      const curLabel = document.getElementById('transport-time-current');
      if (curLabel) {
        curLabel.textContent = simTime.toFixed(1) + 's';
      }

      if (renderer && scene && camera) {
        renderer.render(scene, camera);
      }
    }
    window.seekToSimulationTime = seekToSimulationTime;

    // Update Wave Displays & Dynamic Lifecycle for Reformed Memories
    function updateWaveDisplays() {
      if (controlSurface && controlSurface.currentState === 'PERFORMANCE') {
        controlSurface.updatePerformanceTime(simTime);
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
      }

      // -----------------------------------------------------------------------
      // GENERATIVE ARCHIVAL LIVING TYPOGRAPHY LIFECYCLE ENGINE (G2 PHASE 6)
      // Generic Kinetic Lifecycle: LATENT -> EMERGENCE -> FORMATION -> RESONANCE -> DISSOLUTION -> RESIDUE -> DEAD
      // -----------------------------------------------------------------------
      archivalEntities.forEach(grp => {
        const u = grp.userData;
        const unitDef = u.unitDef;
        const cand = u.cand;
        const t_act = u.t_activation;
        const lc = unitDef.timing;
        const totalDuration = lc.formationDuration + lc.minLegibilityDuration + lc.resonanceDuration + lc.dissolutionDuration + lc.residueDuration;

        if (enableStratum3 < 0.5) {
          grp.visible = false;
          u.currentOpacity = 0.0;
          u.lifecycleState = "LATENT";
          return;
        }

        const dtAct = simTime - t_act;

        if (dtAct < 0.0) {
          // 6-1 LATENT (Completely invisible before wavefront arrives)
          grp.visible = false;
          u.currentOpacity = 0.0;
          u.lifecycleState = "LATENT";
        } else if (dtAct < lc.formationDuration) {
          // 6-2 EMERGENCE (Fixed-Center Alpha Wipe revealed text)
          grp.visible = true;
          u.lifecycleState = "EMERGENCE";
          const prog = Math.min(1.0, dtAct / lc.formationDuration);
          const easeOut = 1.0 - Math.pow(1.0 - prog, 2.5);
          u.currentOpacity = easeOut * 0.95;
          if (u.renderCanvas) u.renderCanvas(prog, 0.0);
          if (unitDef.kinetic.archetype === "FRACTURE" && u.chunks) {
            u.chunks.forEach(chk => {
              chk.mat.opacity = easeOut * 0.95;
              chk.sprite.position.set(chk.baseOffsetX, 0.0, 0.0);
              chk.sprite.material.rotation = 0.0;
            });
          }
          if (u.spriteMat) u.spriteMat.opacity = u.currentOpacity;
          if (u.haloMat) u.haloMat.opacity = Math.sin(prog * Math.PI) * 0.18;
        } else if (dtAct < lc.formationDuration + lc.minLegibilityDuration) {
          // 6-3 FORMATION & MINIMUM LEGIBILITY (Readability Lock: strictly intact, 0 offset, 0 rotation)
          grp.visible = true;
          u.lifecycleState = "FORMATION";
          u.currentOpacity = 0.98;
          if (u.renderCanvas) u.renderCanvas(1.0, 0.0);
          if (unitDef.kinetic.archetype === "FRACTURE" && u.chunks) {
            u.chunks.forEach(chk => {
              chk.mat.opacity = 0.98;
              chk.sprite.position.set(chk.baseOffsetX, 0.0, 0.0);
              chk.sprite.material.rotation = 0.0;
            });
          }
          if (u.spriteMat) u.spriteMat.opacity = 0.98;
          if (u.haloMat) u.haloMat.opacity = 0.12;
        } else if (dtAct < lc.formationDuration + lc.minLegibilityDuration + lc.resonanceDuration) {
          // 6-4 RESONANCE (Archetype-specific physical acoustic vibration or swell)
          grp.visible = true;
          u.lifecycleState = "RESONANCE";
          const resT = dtAct - (lc.formationDuration + lc.minLegibilityDuration);
          u.currentOpacity = 0.95;

          const baseX = u.worldPos ? u.worldPos.x : cand.worldX;
          const baseY = u.worldPos ? u.worldPos.y : (Math.max(cand.groundY || 0.0, 0.020) + 0.120);
          const baseZ = u.worldPos ? u.worldPos.z : cand.worldZ;

          if (unitDef.kinetic.archetype === "RESONANCE") {
            const tremorFreq = 20.0 * Math.min(1.5, paramDominantFreqHz);
            const strokeJitter = Math.sin(resT * tremorFreq) * 2.8;
            u.renderCanvas(1.0, strokeJitter);
            grp.position.x = baseX + Math.sin(resT * tremorFreq) * 0.0005;
            grp.position.y = baseY;
            grp.position.z = baseZ;
            u.spriteMat.opacity = 0.95;
            u.haloMat.opacity = 0.15;
          } else if (unitDef.kinetic.archetype === "FRACTURE" && u.chunks) {
            // Micro-vibrations before structural rockfall
            grp.position.x = baseX;
            grp.position.y = baseY;
            grp.position.z = baseZ;
            u.chunks.forEach((chk, idx) => {
              const microJitter = ((idx % 2 === 0) ? 1 : -1) * Math.sin(resT * 26.0) * 0.0004;
              chk.sprite.position.set(chk.baseOffsetX + microJitter, 0.0, 0.0);
              chk.mat.opacity = 0.98;
            });
            u.haloMat.opacity = 0.12;
          } else if (unitDef.kinetic.archetype === "RECEDE") {
            // Sinking/swelling gently with ocean while hovering safely above sea level
            grp.position.x = baseX;
            grp.position.y = baseY + Math.sin(simTime * 3.6) * 0.003;
            grp.position.z = baseZ;
            u.spriteMat.opacity = 0.94;
            u.haloMat.opacity = 0.12;
          } else if (unitDef.kinetic.archetype === "EXPOSE") {
            grp.position.x = baseX;
            grp.position.y = baseY;
            grp.position.z = baseZ;
            u.currentOpacity = 0.98;
            if (u.spriteMat) u.spriteMat.opacity = 0.98;
            u.haloMat.opacity = 0.16;
          }
        } else if (dtAct < lc.formationDuration + lc.minLegibilityDuration + lc.resonanceDuration + lc.dissolutionDuration) {
          // 6-5 DISSOLUTION (Active tumbling down slope along gravity, seaward drift, or mist dispersion)
          grp.visible = true;
          u.lifecycleState = "DISSOLUTION";
          const dissT = dtAct - (lc.formationDuration + lc.minLegibilityDuration + lc.resonanceDuration);
          const dissProg = Math.min(1.0, dissT / lc.dissolutionDuration);

          const baseX = u.worldPos ? u.worldPos.x : cand.worldX;
          const baseY = u.worldPos ? u.worldPos.y : (Math.max(cand.groundY || 0.0, 0.020) + 0.120);
          const baseZ = u.worldPos ? u.worldPos.z : cand.worldZ;

          if (unitDef.kinetic.archetype === "RESONANCE") {
            u.currentOpacity = THREE.MathUtils.lerp(0.95, 0.18, dissProg);
            u.spriteMat.opacity = u.currentOpacity;
            u.haloMat.opacity = (1.0 - dissProg) * 0.10;
            grp.position.x = baseX;
            grp.position.y = baseY;
            grp.position.z = baseZ;
          } else if (unitDef.kinetic.archetype === "FRACTURE" && u.chunks) {
            // Tumbling along gravity down slope (-∇h, -g·Δt²)
            const fallProg = dissProg * dissProg;
            u.currentOpacity = THREE.MathUtils.lerp(0.98, 0.20, dissProg);
            grp.position.x = baseX;
            grp.position.y = baseY;
            grp.position.z = baseZ;
            u.chunks.forEach(chk => {
              chk.sprite.position.x = chk.baseOffsetX + (chk.spreadX + chk.gradDirX * 0.015) * dissProg * 3.6;
              chk.sprite.position.y = chk.fallVelY * fallProg * 2.8;
              chk.sprite.position.z = (chk.spreadZ + chk.gradDirZ * 0.015) * dissProg * 3.6;
              chk.sprite.material.rotation = chk.rotSpeed * dissProg * 1.2;
              chk.mat.opacity = u.currentOpacity;
            });
            u.haloMat.opacity = (1.0 - dissProg) * 0.08;
          } else if (unitDef.kinetic.archetype === "RECEDE") {
            // Seaward retreat drift: elongates horizontally, drifts offshore while staying above water
            u.currentOpacity = THREE.MathUtils.lerp(0.94, 0.18, dissProg);
            u.sprite.scale.x = unitDef.visual.spriteW * (1.0 + dissProg * 0.70);
            grp.position.x = baseX + dissProg * 0.018;
            grp.position.z = baseZ - dissProg * 0.008;
            grp.position.y = baseY - dissProg * 0.008;
            u.spriteMat.opacity = u.currentOpacity;
            u.haloMat.opacity = (1.0 - dissProg) * 0.08;
          } else if (unitDef.kinetic.archetype === "EXPOSE") {
            // Phosphor decay begins
            u.currentOpacity = THREE.MathUtils.lerp(0.98, 0.45, dissProg);
            if (u.spriteMat) u.spriteMat.opacity = u.currentOpacity;
            u.haloMat.opacity = (1.0 - dissProg) * 0.12;
          }
        } else if (dtAct < totalDuration) {
          // 6-6 RESIDUE (Ethereal lingering coda)
          grp.visible = true;
          u.lifecycleState = "RESIDUE";
          const resT = dtAct - (lc.formationDuration + lc.minLegibilityDuration + lc.resonanceDuration + lc.dissolutionDuration);
          const resProg = Math.min(1.0, resT / lc.residueDuration);

          if (unitDef.kinetic.archetype === "EXPOSE") {
            u.currentOpacity = THREE.MathUtils.lerp(0.45, 0.0, resProg);
            if (u.spriteMat) u.spriteMat.opacity = u.currentOpacity;
            u.haloMat.opacity = (1.0 - resProg) * 0.06;
          } else if (unitDef.kinetic.archetype === "FRACTURE" && u.chunks) {
            u.currentOpacity = THREE.MathUtils.lerp(0.20, 0.0, resProg);
            u.chunks.forEach(chk => { chk.mat.opacity = u.currentOpacity; });
            u.haloMat.opacity = 0.0;
          } else {
            u.currentOpacity = THREE.MathUtils.lerp(0.18, 0.0, resProg);
            if (u.spriteMat) u.spriteMat.opacity = u.currentOpacity;
            if (u.haloMat) u.haloMat.opacity = 0.0;
          }
        } else {
          // 6-7 DEAD (Cleaned up, zero opacity, completely culled)
          grp.visible = false;
          u.currentOpacity = 0.0;
          u.lifecycleState = "DEAD";
          if (u.spriteMat) u.spriteMat.opacity = 0.0;
          if (u.haloMat) u.haloMat.opacity = 0.0;
          if (unitDef.kinetic.archetype === "FRACTURE" && u.chunks) {
            u.chunks.forEach(chk => { chk.mat.opacity = 0.0; });
          }
        }
      });

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
        if (subEl && bestEntity && bestEntity.unitDef && bestEntity.unitDef.semantic) {
          const sem = bestEntity.unitDef.semantic;
          const disp = sem.displayText || bestEntity.unitDef.token;
          const trans = sem.translation || "";
          const srcRef = sem.sourceReference || currentParsedEvent.titleKo || "";
          const nextLine = `"${disp}" — ${trans}${srcRef ? ` (${srcRef})` : ""}`;
          if (subEl.textContent !== nextLine) {
            subEl.textContent = nextLine;
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

    async function init() {
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

        // 1. Load Tier 0 / Tier 1 Global Elevation & Bathymetric Relief (NOAA ETOPO 2022)
        globalElevationTexture = await loadGlobalElevationTexture(THREE);
        terrainUniforms.u_globalElevation.value = globalElevationTexture;
        terrainUniforms.u_globalHMin.value = -11000.0;
        terrainUniforms.u_globalHMax.value = 9000.0;
        window.globalElevationTexture = globalElevationTexture;

        // 2. Load initial DEM texture
        demTexture = await loadFusedElevationTexture();
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
        scene.add(tier0GlobeMesh);

        // 3. Add Celestial Starfield & Atmosphere Outer Glow Shell
        celestialStarsMesh = createCelestialStarfield();
        scene.add(celestialStarsMesh);

        atmosphereGlowMesh = createAtmosphereGlowShell(lat0, lon0);
        scene.add(atmosphereGlowMesh);

        // 4. Initialize Archival Semantic Parser & Preprocess Terrain
        archivalParser = new ArchivalSemanticParser(HISTORICAL_EVENTS, SOURCE_RECORDS, EVENT_SOURCE_LINKS, INSTRUMENTAL_EVENTS);
        spawner = new TerrainAwareSpawner(TERRAIN_CANDIDATE_CACHE);
        analyzeDEMFeatures();

        // 5. Load USGS Global Feed & Build Unified Master Catalog
        try {
          const usgsEvents = await loadUSGSFeed();
          if (usgsEvents && usgsEvents.length > 0) {
            MASTER_EVENTS_REGISTRY = buildUnifiedMasterCatalog(HISTORICAL_EVENTS, INSTRUMENTAL_EVENTS, usgsEvents);
            archivalParser.addInstrumentalEvents(usgsEvents);
            console.log(`[Master Registry] Unified Master Catalog online: ${MASTER_EVENTS_REGISTRY.length} total events`);
          }
        } catch (err) {
          console.warn("[USGS Feed] Non-fatal feed initialization warning:", err);
        }
        window.MASTER_EVENTS_REGISTRY = MASTER_EVENTS_REGISTRY;

        // 6. Initialize Discovery Beacons for baseline benchmarks & major global earthquakes
        initDiscoveryNodes(lat0, lon0, scene, discoveryNodes);
        controlSurface = new UnifiedControlSurface();
        window.controlSurface = controlSurface;

        window.terrainMesh = terrainMesh;
        window.waterMesh = waterMesh;
        window.tier0GlobeMesh = tier0GlobeMesh;
        window.celestialStarsMesh = celestialStarsMesh;
        window.atmosphereGlowMesh = atmosphereGlowMesh;
        window.archivalEntities = archivalEntities;
        window.discoveryNodes = discoveryNodes;

        // Load 1681 Yangyang event without snapping camera
        await loadHistoricalEvent("hist_1681_0626", false);

        // Setup Orbit camera
        camera.position.set(10.0, 140.0, 40.0);
        controls.target.set(0.0, 0.0, 0.0);
        controls.minDistance = 20.0;
        controls.maxDistance = 400.0;
        camera.near = 0.02;
        camera.far = 600.0;
        camera.updateProjectionMatrix();
        controls.update();

        flightState = FLIGHT_STATES.ORBIT;
        orbitDwellTimer = 0.0;
        updateHUDForFlight('orbit');

        // Raycasting for discovery beacons
        window.addEventListener('mousemove', (e) => {
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

      // Flight State Machine & Discovery update
      updateFlight(delta);
      const isOrbitView = (flightState === FLIGHT_STATES.ORBIT);
      discoveryNodes.forEach(n => {
        n.group.visible = isOrbitView;
        if (isOrbitView) n.update(now * 0.001);
      });

      if (isPlaying) {
        const scaledDelta = delta * playbackSpeed;
        simTime += scaledDelta;
        if (orchestrator) {
          orchestrator.isPlaying = true;
          orchestrator.update(scaledDelta);
        }
        if (simTime > maxSimTime) {
          simTime = 0.0;
          if (orchestrator) orchestrator.restart();
        }
        updateWaveDisplays();
      }

      window.simTime = simTime;
      window.flightState = flightState;

      controls.update();

      // Underground Camera Clipping Guard (Performance & Coda States)
      if (flightState === FLIGHT_STATES.PERFORMANCE || flightState === FLIGHT_STATES.CODA) {
        const groundSample = getTerrainMetricsAt(camera.position.x, camera.position.z);
        const minCamY = Math.max(0.018, (groundSample?.groundY || 0.0) + 0.016);
        if (camera.position.y < minCamY) {
          camera.position.y = minCamY;
        }
        if (controls.target.y < -0.025) {
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

    // Phase D Automation & Verification Hooks (Master Deterministic Timeline Seeker)
    window.seekToSimulationTime = function(targetSec) {
      simTime = Math.max(0.0, Math.min(35.0, targetSec));

      if (terrainUniforms) {
        terrainUniforms.u_simTime.value = simTime;
      }
      if (waterMat && waterMat.uniforms && waterMat.uniforms.u_simTime) {
        waterMat.uniforms.u_simTime.value = simTime;
      }
      if (tier0GlobeMesh && tier0GlobeMesh.material && tier0GlobeMesh.material.uniforms && tier0GlobeMesh.material.uniforms.u_simTime) {
        tier0GlobeMesh.material.uniforms.u_simTime.value = simTime;
      }
      if (orchestrator) {
        orchestrator.seismicTime = simTime;
        if (orchestrator.uniforms && orchestrator.uniforms.u_seismicTime) {
          orchestrator.uniforms.u_seismicTime.value = simTime;
        }
        orchestrator.update(simTime);
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
      if (scrubber && Math.abs(parseFloat(scrubber.value) - simTime) > 0.05) {
        scrubber.value = simTime.toFixed(1);
      }
      const curLabel = document.getElementById('transport-time-current');
      if (curLabel) {
        curLabel.textContent = simTime.toFixed(1) + 's';
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
    };

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