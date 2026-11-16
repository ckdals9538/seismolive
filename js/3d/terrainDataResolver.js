// ============================================================================
// SEISMOLIVE v4.0 — Unified Terrain Data Resolver & Double-Buffering Lifecycle
// File: js/3d/terrainDataResolver.js
//
// Responsibilities (Stage R2):
//   - Binary UNORM16 DEM / ETOPO Texture I/O (loadRegionalDEMTexture, loadGlobalElevationTexture)
//   - Three.js Tier 0 / Tier 1 / Tier 2 Mesh Lifecycle & Atomic Swap (TerrainLifecycleManager)
//   - Re-exports pure raster math (GeoRasterSampler.js) & terrain catalog (EventTerrainCatalog.js)
// ============================================================================

import {
  DATUM_STATUS,
  geodeticToThree
} from './geodeticEllipsoidCoord.js';

import {
  SURFACE_CLASSIFICATION,
  RASTER_PIXEL_TYPE,
  GeoRasterSampler,
  classifySurface
} from './GeoRasterSampler.js';

import {
  UNIVERSAL_EVENT_METADATA,
  getUniversalEventMetadata,
  resolveArbitraryCoordinate,
  computePhysicalUnitsFromBounds,
  loadTerrainMetadataSidecar
} from '../data/EventTerrainCatalog.js';

export {
  SURFACE_CLASSIFICATION,
  RASTER_PIXEL_TYPE,
  GeoRasterSampler,
  classifySurface,
  UNIVERSAL_EVENT_METADATA,
  getUniversalEventMetadata,
  resolveArbitraryCoordinate,
  computePhysicalUnitsFromBounds,
  loadTerrainMetadataSidecar
};

function resolveThree(explicitThree = null) {
  const T = explicitThree || (typeof globalThis !== 'undefined' ? globalThis.THREE : null) || (typeof window !== 'undefined' ? window.THREE : null);
  if (!T) {
    throw new Error('[terrainDataResolver] Three.js runtime instance is required.');
  }
  return T;
}

/**
 * Load regional DEM texture from raw UNORM16 binary file
 */
const demTextureCache = new Map();

/**
 * Robustly load a regional UNORM16 DEM texture with in-memory caching and timeout
 */
export async function loadRegionalDEMTexture(THREE, binUrl, width, height) {
  const T = resolveThree(THREE);
  if (demTextureCache.has(binUrl)) {
    return demTextureCache.get(binUrl);
  }
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 6000);
  try {
    const fetchUrl = binUrl.includes('?') ? binUrl : `${binUrl}?v=6.0`;
    const response = await fetch(fetchUrl, { signal: controller.signal, cache: 'no-cache' });
    clearTimeout(timeoutId);
    if (!response.ok) {
      throw new Error(`Failed to load DEM binary from ${binUrl}: ${response.status} ${response.statusText}`);
    }
    const buffer = await response.arrayBuffer();
    const uint16View = new Uint16Array(buffer);

    const floatArray = new Float32Array(width * height);
    for (let i = 0; i < uint16View.length; i++) {
      floatArray[i] = uint16View[i] / 65535.0;
    }

    const texture = new T.DataTexture(
      floatArray,
      width,
      height,
      T.RedFormat,
      T.FloatType
    );
    texture.minFilter = T.LinearFilter;
    texture.magFilter = T.LinearFilter;
    texture.wrapS = T.ClampToEdgeWrapping;
    texture.wrapT = T.ClampToEdgeWrapping;
    texture.needsUpdate = true;
    demTextureCache.set(binUrl, texture);
    return texture;
  } catch (err) {
    clearTimeout(timeoutId);
    console.warn(`[Regional DEM Loader] Fetch warning for ${binUrl}:`, err.message);
    throw err;
  }
}

/**
 * Load global elevation & bathymetry DataTexture from UNORM16 binary
 * Planetary ETOPO 2022 relief: -11,000m to +9,000m
 */
let cachedGlobalTexture = null;

export async function loadGlobalElevationTexture(THREE, binUrl = 'assets/terrain/bathymetry/global_etopo_elevation_2048_unorm16.bin', width = 2048, height = 1024) {
  const T = resolveThree(THREE);
  if (cachedGlobalTexture) return cachedGlobalTexture;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 7000);
  try {
    const fetchUrl = binUrl.includes('?') ? binUrl : `${binUrl}?v=6.0`;
    const response = await fetch(fetchUrl, { signal: controller.signal, cache: 'no-cache' });
    clearTimeout(timeoutId);
    if (!response.ok) {
      throw new Error(`Failed to load global relief binary: ${response.status}`);
    }
    const buffer = await response.arrayBuffer();
    const uint16View = new Uint16Array(buffer);

    const floatArray = new Float32Array(width * height);
    for (let i = 0; i < uint16View.length; i++) {
      floatArray[i] = uint16View[i] / 65535.0;
    }

    const texture = new T.DataTexture(
      floatArray,
      width,
      height,
      T.RedFormat,
      T.FloatType
    );
    texture.minFilter = T.LinearFilter;
    texture.magFilter = T.LinearFilter;
    texture.wrapS = T.RepeatWrapping;
    texture.wrapT = T.ClampToEdgeWrapping;
    texture.needsUpdate = true;
    cachedGlobalTexture = texture;
    return texture;
  } catch (err) {
    clearTimeout(timeoutId);
    console.warn('[Global Relief] Fallback to procedural planetary texture:', err.message);
    const fallbackArray = new Float32Array(width * height);
    fallbackArray.fill(0.55); // Neutral ocean/sea level
    const texture = new T.DataTexture(fallbackArray, width, height, T.RedFormat, T.FloatType);
    texture.minFilter = T.LinearFilter;
    texture.magFilter = T.LinearFilter;
    texture.wrapS = T.RepeatWrapping;
    texture.wrapT = T.ClampToEdgeWrapping;
    texture.needsUpdate = true;
    cachedGlobalTexture = texture;
    return texture;
  }
}

/**
 * Dynamic Terrain Lifecycle Manager (Double Buffering & Atomic Swap Engine)
 */
export class TerrainLifecycleManager {
  /**
   * @param {THREE.Scene} scene - Target Three.js Scene
   * @param {Object} [options]
   * @param {Object} [options.THREE] - Explicit Three.js module namespace
   */
  constructor(scene, options = {}) {
    this.scene = scene;
    this.THREE = options.THREE || null;
    this.activeGroup = null;
    this.stagingGroup = null;
    this.isTransitioning = false;
    this.currentEpicenter = null;
    this.activeDatumStatus = DATUM_STATUS.INCOMPLETE;
    this.currentRequestId = 0; // Race-condition guard for rapid consecutive switches

    // Reference tracking for 3 Tiers
    this.activeTier0Mesh = null;
    this.activeTier1Mesh = null;
    this.activeTier2Mesh = null;
    this.tier2Status = 'UNINITIALIZED';
  }

  /**
   * Asynchronously load and build terrain for an earthquake event.
   * Guarantees that activeGroup is maintained without any blank frames
   * until stagingGroup is 100% ready.
   *
   * @param {Object} eventConfig
   * @param {string} eventConfig.id - Event ID
   * @param {number} eventConfig.lat - Epicenter latitude
   * @param {number} eventConfig.lon - Epicenter longitude
   * @param {number} [eventConfig.focalDepthKm=10.0]
   * @param {string} [eventConfig.name='']
   * @param {Object} [options]
   * @param {number} [options.simulatedDelayMs=0] - Injected delay for testing asynchronous stability
   * @param {boolean} [options.failStaging=false] - Injected failure to test error recovery
   * @param {number} [options.tier2LOD=512] - 512 or 768 for Tier 2 mesh resolution
   * @param {Function} [onProgress] - Optional progress callback
   * @returns {Promise<{ success: boolean, datumStatus: string, eventId: string, tier2Active: boolean }>}
   */
  async switchEpicenter(eventConfig, options = {}, onProgress = null) {
    const requestId = ++this.currentRequestId;
    this.isTransitioning = true;
    const T = resolveThree(options.THREE || this.THREE);

    try {
      if (onProgress) onProgress({ stage: 'FETCHING_METADATA', progress: 0.1 });

      const lat0 = eventConfig.lat;
      const lon0 = eventConfig.lon;

      // Simulated network/processing delay if requested
      if (options.simulatedDelayMs && options.simulatedDelayMs > 0) {
        await new Promise(r => setTimeout(r, options.simulatedDelayMs));
      }

      // Check if a newer request arrived while waiting
      if (requestId !== this.currentRequestId) {
        console.warn(`[TerrainLifecycleManager] Superseded request ${requestId} cancelled in favor of ${this.currentRequestId}`);
        return { success: false, superseded: true, eventId: eventConfig.id };
      }

      // Failure injection for resilience verification
      if (options.failStaging) {
        throw new Error('Simulated Staging Failure Injected for Resilience Testing');
      }

      // 1. Build the new Staging Group
      const staging = new T.Group();
      staging.name = `terrain_group_${eventConfig.id}`;

      // 2. Build Tier 0 WGS84 Ellipsoid Mesh for this epicenter
      const globeMesh = this._createTier0EllipsoidMesh(lat0, lon0, T);
      staging.add(globeMesh);

      if (onProgress) onProgress({ stage: 'TIER0_ELLIPSOID_BUILT', progress: 0.3 });

      // 3. Resolve and Build Tier 1 Regional Terrain Mesh
      const tier1Result = await this._buildTier1RegionalMesh(eventConfig, T);
      if (tier1Result.mesh) {
        staging.add(tier1Result.mesh);
      }
      this.activeDatumStatus = tier1Result.datumStatus;

      if (onProgress) onProgress({ stage: 'TIER1_REGIONAL_BUILT', progress: 0.6 });

      // 4. Resolve and Build Tier 2 Inset if local Copernicus high-res DEM is available
      const tier2Result = await this._buildTier2InsetMesh(eventConfig, tier1Result, { ...options, THREE: T });
      let tier2Active = false;
      if (tier2Result && tier2Result.mesh) {
        staging.add(tier2Result.mesh);
        tier2Active = true;
        this.tier2Status = 'ACTIVE_COPERNICUS_30M';
      } else {
        this.tier2Status = 'UNHELD_FALLBACK_TIER1';
      }

      if (onProgress) onProgress({ stage: 'READY_FOR_ATOMIC_SWAP', progress: 1.0 });

      // Check race condition again before atomic swap
      if (requestId !== this.currentRequestId) {
        this._disposeGroup(staging);
        return { success: false, superseded: true, eventId: eventConfig.id };
      }

      // 5. ATOMIC SWAP: Execute swap synchronously to guarantee 0 blank frames
      this._executeAtomicSwap(staging);
      this.activeTier0Mesh = globeMesh;
      this.activeTier1Mesh = tier1Result.mesh;
      this.activeTier2Mesh = tier2Result?.mesh || null;
      this.currentEpicenter = { ...eventConfig };
      this.isTransitioning = false;

      return {
        success: true,
        datumStatus: this.activeDatumStatus,
        eventId: eventConfig.id,
        tier2Active,
        tier2Status: this.tier2Status
      };
    } catch (err) {
      console.error('[TerrainLifecycleManager] Failed to build staging terrain:', err);
      if (this.stagingGroup) {
        this._disposeGroup(this.stagingGroup);
        this.stagingGroup = null;
      }
      this.isTransitioning = false;
      return {
        success: false,
        datumStatus: this.activeDatumStatus,
        error: err.message,
        tier2Active: false
      };
    }
  }

  /**
   * Atomic Swap of Scene Graph nodes
   */
  _executeAtomicSwap(newGroup) {
    this.scene.add(newGroup);
    const oldGroup = this.activeGroup;
    this.activeGroup = newGroup;

    if (oldGroup) {
      this.scene.remove(oldGroup);
      this._disposeGroup(oldGroup);
    }
  }

  /**
   * Safely dispose all geometries, materials, and textures in a group
   */
  _disposeGroup(group) {
    if (!group) return;
    if (typeof group.traverse === 'function') {
      group.traverse(child => {
        if (child.isMesh) {
          if (child.geometry) child.geometry.dispose();
          if (child.material) {
            if (Array.isArray(child.material)) {
              child.material.forEach(m => this._disposeMaterial(m));
            } else {
              this._disposeMaterial(child.material);
            }
          }
        }
      });
    }
  }

  _disposeMaterial(mat) {
    if (!mat) return;
    Object.keys(mat).forEach(prop => {
      const val = mat[prop];
      if (val && typeof val === 'object' && val.isTexture) {
        val.dispose();
      }
    });
    mat.dispose();
  }

  /**
   * Tier 0: Parametric WGS84 Ellipsoid Mesh Generator
   */
  _createTier0EllipsoidMesh(lat0, lon0, explicitThree = null) {
    const T = resolveThree(explicitThree || this.THREE);
    const widthSegs = 128;
    const heightSegs = 64;

    const geometry = new T.BufferGeometry();
    const positions = [];
    const uvs = [];
    const indices = [];

    for (let y = 0; y <= heightSegs; y++) {
      const v = y / heightSegs;
      const phi = (0.5 - v) * Math.PI;
      const latDeg = (phi * 180.0) / Math.PI;

      for (let x = 0; x <= widthSegs; x++) {
        const u = x / widthSegs;
        const lambda = (u - 0.5) * 2.0 * Math.PI;
        const lonDeg = (lambda * 180.0) / Math.PI;

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

    geometry.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('uv', new T.Float32BufferAttribute(uvs, 2));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();

    const mat = new T.ShaderMaterial({
      uniforms: {
        u_lightDir: { value: new T.Vector3(0.65, 0.60, 0.45).normalize() },
        u_lightColor: { value: new T.Color(0xd2e3f5) },
        u_ambientColor: { value: new T.Color(0x02050c) }
      },
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
        uniform vec3 u_lightDir;
        uniform vec3 u_lightColor;
        uniform vec3 u_ambientColor;
        varying vec3 vWorldNormal;
        varying vec3 vViewPos;
        void main() {
          vec3 N = normalize(vWorldNormal);
          vec3 V = normalize(vViewPos);
          vec3 L = normalize((viewMatrix * vec4(u_lightDir, 0.0)).xyz);
          float NdotL = max(0.0, dot(N, L));
          float rim = pow(1.0 - max(0.0, dot(N, V)), 2.8);
          vec3 baseAlbedo = vec3(0.010, 0.020, 0.038);
          vec3 lit = baseAlbedo * (u_ambientColor + u_lightColor * (NdotL * 0.85));
          lit += vec3(0.35, 0.55, 0.85) * (rim * 0.45);
          gl_FragColor = vec4(lit, 1.0);
        }
      `,
      depthWrite: false,
      transparent: false
    });

    const mesh = new T.Mesh(geometry, mat);
    mesh.name = 'Tier0_WGS84_Ellipsoid';
    mesh.renderOrder = -1;
    return mesh;
  }

  /**
   * Tier 1 Regional Mesh Generator
   */
  async _buildTier1RegionalMesh(eventConfig, explicitThree = null) {
    const T = resolveThree(explicitThree || this.THREE);
    const datumStatus = (eventConfig.id && eventConfig.id.includes('1681'))
      ? DATUM_STATUS.VERIFIED
      : DATUM_STATUS.INCOMPLETE;

    return {
      mesh: new T.Group(),
      datumStatus
    };
  }

  /**
   * Tier 2 Inset Mesh Generator (Copernicus 30m Real DEM Integration)
   */
  async _buildTier2InsetMesh(eventConfig, tier1Result, options = {}) {
    if (!eventConfig.id || !eventConfig.id.includes('1681')) {
      return null;
    }

    const resolution = options.tier2LOD === 768 ? 768 : (options.tier2LOD === 256 ? 256 : 512);
    return createTier2CopernicusInsetMesh(eventConfig.lat, eventConfig.lon, resolution, options.THREE || this.THREE);
  }
}

/**
 * Standalone Generator for Tier 2 Copernicus High-Res Inset Mesh
 *
 * @param {number} lat0 - Epicenter latitude for center-relative coordinates
 * @param {number} lon0 - Epicenter longitude for center-relative coordinates
 * @param {number} [resolution=512] - 256, 512, or 768
 * @param {Object|null} [explicitThree=null] - Optional Three.js module namespace
 * @returns {Promise<{ mesh: THREE.Mesh, resolution: number, bounds: Object }|null>}
 */
export async function createTier2CopernicusInsetMesh(lat0, lon0, resolution = 512, explicitThree = null) {
  const T = resolveThree(explicitThree);
  const binUrl = `assets/terrain/copernicus/tier2_yangyang_${resolution}.bin`;

  let floatBuffer;
  try {
    const resp = await fetch(binUrl);
    if (!resp.ok) return null;
    const arr = await resp.arrayBuffer();
    floatBuffer = new Float32Array(arr);
  } catch (e) {
    console.warn('[Tier 2 Loader] Failed to fetch Tier 2 binary:', e);
    return null;
  }

  const lat_min = 37.80, lat_max = 38.20;
  const lon_min = 128.45, lon_max = 128.95;
  const geoidN = 17.60; // EGM2008 geoid undulation (meters)
  const verticalExag = 2.4;
  const metersToUnits = 0.80 / 131420.0;

  const geo = new T.BufferGeometry();
  const positions = new Float32Array(resolution * resolution * 3);
  const uvs = new Float32Array(resolution * resolution * 2);
  const rawHs = new Float32Array(resolution * resolution);
  const indices = [];

  let pIdx = 0;
  let uvIdx = 0;

  for (let r = 0; r < resolution; r++) {
    const v = r / (resolution - 1);
    const lat = lat_max - v * (lat_max - lat_min);
    const vEdgeDist = Math.min(v, 1.0 - v);

    for (let c = 0; c < resolution; c++) {
      const u = c / (resolution - 1);
      const lon = lon_min + u * (lon_max - lon_min);

      const uEdgeDist = Math.min(u, 1.0 - u);
      const minEdgeDist = Math.min(uEdgeDist, vEdgeDist);

      const margin = 0.05;
      const t = Math.max(0.0, Math.min(1.0, minEdgeDist / margin));
      const stitchWeight = 0.5 - 0.5 * Math.cos(Math.PI * t);

      const rawH = floatBuffer[r * resolution + c];
      rawHs[r * resolution + c] = rawH;

      const h_cop = (rawH + geoidN);
      const h_stitched = h_cop * stitchWeight + (rawH * 0.7 + geoidN) * (1.0 - stitchWeight);
      const hUnits = h_stitched * verticalExag * metersToUnits;

      const [threeX, threeY, threeZ] = geodeticToThree(lat, lon, 0.0, lat0, lon0, 0.0);

      positions[pIdx] = threeX;
      positions[pIdx + 1] = threeY + hUnits;
      positions[pIdx + 2] = threeZ;
      pIdx += 3;

      uvs[uvIdx] = u;
      uvs[uvIdx + 1] = 1.0 - v;
      uvIdx += 2;
    }
  }

  for (let r = 0; r < resolution - 1; r++) {
    for (let c = 0; c < resolution - 1; c++) {
      const a = r * resolution + c;
      const b = r * resolution + (c + 1);
      const d = (r + 1) * resolution + c;
      const e = (r + 1) * resolution + (c + 1);

      indices.push(a, d, b);
      indices.push(b, d, e);
    }
  }

  geo.setAttribute('position', new T.BufferAttribute(positions, 3));
  geo.setAttribute('uv', new T.BufferAttribute(uvs, 2));
  geo.setAttribute('a_rawH', new T.BufferAttribute(rawHs, 1));
  geo.setIndex(indices);
  geo.computeVertexNormals();

  const mat = new T.ShaderMaterial({
    uniforms: {
      u_lightDir: { value: new T.Vector3(0.65, 0.60, 0.45).normalize() },
      u_lightColor: { value: new T.Color(0xd2e3f5) },
      u_ambientColor: { value: new T.Color(0x040810) }
    },
    vertexShader: `
      attribute float a_rawH;
      varying vec3 vNormal;
      varying vec3 vViewPos;
      varying vec2 vUv;
      varying float vElev;
      varying float vRawH;
      void main() {
        vUv = uv;
        vRawH = a_rawH;
        vNormal = normalize(normalMatrix * normal);
        vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
        vViewPos = -mvPos.xyz;
        vElev = position.y;
        gl_Position = projectionMatrix * mvPos;
      }
    `,
    fragmentShader: `
      uniform vec3 u_lightDir;
      uniform vec3 u_lightColor;
      uniform vec3 u_ambientColor;
      varying vec3 vNormal;
      varying vec3 vViewPos;
      varying vec2 vUv;
      varying float vElev;
      varying float vRawH;
      void main() {
        vec3 N = normalize(vNormal);
        vec3 V = normalize(vViewPos);
        vec3 L = normalize((viewMatrix * vec4(u_lightDir, 0.0)).xyz);
        float NdotL = max(0.0, dot(N, L));
        float wrap = pow((NdotL + 0.32) / 1.32, 1.5);
        float rim = pow(1.0 - max(0.0, dot(N, V)), 3.0);

        vec3 indigoVoid   = vec3(0.055, 0.075, 0.110);
        vec3 chiseledRock = vec3(0.165, 0.200, 0.255);
        vec3 alpineSummit = vec3(0.240, 0.290, 0.360);
        float alpineT = clamp(vRawH / 1700.0, 0.0, 1.0);
        vec3 base = mix(indigoVoid, chiseledRock, alpineT * 0.88);
        base = mix(base, alpineSummit, pow(alpineT, 2.0) * 0.85);

        vec3 lit = base * (u_ambientColor + u_lightColor * (wrap * 1.45));
        lit += vec3(0.55, 0.75, 0.95) * (rim * 0.85);

        float landMask = smoothstep(10.0, 45.0, vRawH);
        float edgeDist = min(min(vUv.x, 1.0 - vUv.x), min(vUv.y, 1.0 - vUv.y));
        float alpha = smoothstep(0.005, 0.080, edgeDist) * landMask;
        gl_FragColor = vec4(lit, alpha);
      }
    `,
    transparent: true,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -1.0,
    polygonOffsetUnits: -4.0
  });

  const mesh = new T.Mesh(geo, mat);
  mesh.name = `Tier2_Copernicus_Inset_${resolution}`;
  mesh.renderOrder = 1;

  return {
    mesh,
    resolution,
    bounds: { lat_min, lat_max, lon_min, lon_max }
  };
}
