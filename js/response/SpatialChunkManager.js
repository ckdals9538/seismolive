// ============================================================================
// SEISMOLIVE v4.0 — 3km x 3km Spatial Chunk Streaming Manager (Tier 2.2)
// File: js/response/SpatialChunkManager.js
//
// Manages on-demand spatial tiles beyond the 4km pre-built core package boundary
// (Seoul 3D Atlas tile architecture adapted to Local Tangent ENU meters).
// Deterministic offline tile synthesis + clean mount/unmount memory bounds.
// ============================================================================

import { VERIFICATION_STATUS } from './ResponseDomainTypes.js';

export const CHUNK_SIZE_METERS = 3000;
export const CHUNK_OBB_STRIDE = 6; // [east_m, north_m, width_m, depth_m, yaw_rad, height_m]

const DISTRICT_LABELS = Object.freeze({
  '0_0': '성동·한양 핵심 권역 (Core 4km Pre-Built)',
  '-1_0': '왕십리·신당·동대문 인접 타일 (W 3km)',
  '1_0': '장안·군자·중랑천 동안 타일 (E 3km)',
  '0_1': '서울숲·뚝섬·한강 북안 타일 (S 3km)',
  '0_-1': '안암·제기·고대 구릉지 타일 (N 3km)',
  '1_1': '성수·건대·광진 인접 타일 (SE 3km)',
  '-1_1': '금호·옥수·한남북단 타일 (SW 3km)',
  '1_-1': '답십리·전농·장안교 타일 (NE 3km)',
  '-1_-1': '신설동·보문·청계상류 타일 (NW 3km)'
});

function mulberry32(seed) {
  let a = seed >>> 0;
  return function() {
    a |= 0;
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class SpatialChunkManager {
  constructor(options = {}) {
    this.chunkSizeMeters = options.chunkSizeMeters || CHUNK_SIZE_METERS;
    this.loadMarginMeters = options.loadMarginMeters ?? 900;
    this.unloadMarginMeters = options.unloadMarginMeters ?? 2600;
    this.maxActiveRadiusChunks = options.maxActiveRadiusChunks ?? 2;
    this.activeChunks = new Map();
  }

  getChunkKey(cx, cz) {
    return `CHUNK_${cx}_${cz}`;
  }

  worldXZToChunkCoords(x, z) {
    return {
      cx: Math.round(x / this.chunkSizeMeters),
      cz: Math.round(z / this.chunkSizeMeters)
    };
  }

  /**
   * Shortest Euclidean distance in meters from horizontal point (x, z)
   * to the 3km x 3km bounding box of chunk (cx, cz).
   */
  distanceToChunkBoundaryXZ(x, z, cx, cz) {
    const half = this.chunkSizeMeters * 0.5;
    const centerX = cx * this.chunkSizeMeters;
    const centerZ = cz * this.chunkSizeMeters;
    const dx = Math.max(0, Math.abs(x - centerX) - half);
    const dz = Math.max(0, Math.abs(z - centerZ) - half);
    return Math.hypot(dx, dz);
  }

  loadChunk(cx, cz) {
    const key = this.getChunkKey(cx, cz);
    if (this.activeChunks.has(key)) {
      return this.activeChunks.get(key);
    }

    const half = this.chunkSizeMeters * 0.5;
    const centerX = cx * this.chunkSizeMeters;
    const centerZ = cz * this.chunkSizeMeters;
    const isCorePrebuilt = cx === 0 && cz === 0;
    const districtName = DISTRICT_LABELS[`${cx}_${cz}`] || `외곽 확장 타일 (${cx}, ${cz})`;

    // Core chunk (0,0) is already populated by HanyangLocalSpatialData; outer tiles stream compact OBB context
    let obbBuildingsFloat32 = new Float32Array(0);
    let buildingCount = 0;
    let overviewCount = 0;

    if (!isCorePrebuilt) {
      const count = 48;
      const raw = [];
      const seed = (((cx + 128) * 73856093) ^ ((cz + 128) * 19349663)) >>> 0;
      const rand = mulberry32(seed);

      for (let i = 0; i < count; i++) {
        const localX = (rand() - 0.5) * (this.chunkSizeMeters - 260);
        const localZ = (rand() - 0.5) * (this.chunkSizeMeters - 260);
        const east_m = Number((centerX + localX).toFixed(1));
        const north_m = Number((-(centerZ + localZ)).toFixed(1)); // Three.js Z = -North
        const width_m = Number((28 + rand() * 44).toFixed(1));
        const depth_m = Number((18 + rand() * 28).toFixed(1));
        const yaw_rad = Number(((rand() - 0.5) * 0.9).toFixed(3));
        const height_m = Number((18 + rand() * 58).toFixed(1));
        raw.push({ east_m, north_m, width_m, depth_m, yaw_rad, height_m });
      }

      raw.sort((a, b) => b.height_m - a.height_m);
      obbBuildingsFloat32 = new Float32Array(count * CHUNK_OBB_STRIDE);
      for (let i = 0; i < count; i++) {
        const b = raw[i];
        const base = i * CHUNK_OBB_STRIDE;
        obbBuildingsFloat32[base + 0] = b.east_m;
        obbBuildingsFloat32[base + 1] = b.north_m;
        obbBuildingsFloat32[base + 2] = b.width_m;
        obbBuildingsFloat32[base + 3] = b.depth_m;
        obbBuildingsFloat32[base + 4] = b.yaw_rad;
        obbBuildingsFloat32[base + 5] = b.height_m;
      }
      buildingCount = count;
      overviewCount = Math.min(20, count);
    }

    const chunk = Object.freeze({
      key,
      cx,
      cz,
      isCorePrebuilt,
      districtName,
      centerXZ: Object.freeze([centerX, centerZ]),
      boundsXZ: Object.freeze({
        minX: centerX - half,
        maxX: centerX + half,
        minZ: centerZ - half,
        maxZ: centerZ + half
      }),
      obbBuildingsFloat32,
      buildingCount,
      overviewCount,
      provenance: isCorePrebuilt ? VERIFICATION_STATUS.PARTIALLY_VERIFIED : VERIFICATION_STATUS.PROVISIONAL,
      loadedAt: Date.now()
    });

    this.activeChunks.set(key, chunk);
    return chunk;
  }

  unloadChunk(key) {
    if (!this.activeChunks.has(key)) return false;
    this.activeChunks.delete(key);
    return true;
  }

  /**
   * Stream in nearby 3km x 3km chunks within `loadMarginMeters` and evict chunks
   * beyond `unloadMarginMeters` from current focal XZ coordinate.
   */
  updateForPosition(x = 0, z = 0, options = {}) {
    const loadMargin = options.loadMarginMeters ?? this.loadMarginMeters;
    const unloadMargin = options.unloadMarginMeters ?? this.unloadMarginMeters;
    const current = this.worldXZToChunkCoords(x, z);

    const loadedKeys = [];
    const unloadedKeys = [];

    // 1. Evaluate neighboring chunk ring around focal position
    for (let dx = -this.maxActiveRadiusChunks; dx <= this.maxActiveRadiusChunks; dx++) {
      for (let dz = -this.maxActiveRadiusChunks; dz <= this.maxActiveRadiusChunks; dz++) {
        const cx = Math.max(-2, Math.min(2, current.cx + dx));
        const cz = Math.max(-2, Math.min(2, current.cz + dz));
        const key = this.getChunkKey(cx, cz);
        const edgeDist = this.distanceToChunkBoundaryXZ(x, z, cx, cz);

        if (edgeDist <= loadMargin && !this.activeChunks.has(key)) {
          this.loadChunk(cx, cz);
          loadedKeys.push(key);
        }
      }
    }

    // 2. Evict distant chunks beyond unload hysteresis radius (always retain CHUNK_0_0 metadata)
    for (const [key, chunk] of this.activeChunks.entries()) {
      if (chunk.isCorePrebuilt) continue;
      const edgeDist = this.distanceToChunkBoundaryXZ(x, z, chunk.cx, chunk.cz);
      if (edgeDist > unloadMargin) {
        this.activeChunks.delete(key);
        unloadedKeys.push(key);
      }
    }

    let totalStreamedBuildings = 0;
    for (const chunk of this.activeChunks.values()) {
      totalStreamedBuildings += chunk.buildingCount;
    }

    return {
      focalChunk: current,
      loadedKeys,
      unloadedKeys,
      activeChunkKeys: [...this.activeChunks.keys()],
      activeChunkCount: this.activeChunks.size,
      totalStreamedBuildings
    };
  }

  clear() {
    this.activeChunks.clear();
  }
}
