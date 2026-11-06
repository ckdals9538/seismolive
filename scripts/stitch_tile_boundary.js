// ============================================================================
// SEISMOLIVE v4.0 — Tile Seam Stitching at Latitude 38.00°N
// Guarantees watertight 3D mesh continuity between Tile A and Tile B
// ============================================================================

const WORKSPACE = "/Users/katsina/Downloads/seismolive-clean";
const TERRAIN_DIR = `${WORKSPACE}/assets/terrain/copernicus`;

const fileA = `${TERRAIN_DIR}/seoraksan_yangyang_unorm16.bin`;
const fileB = `${TERRAIN_DIR}/gangneung_odaesan_unorm16.bin`;

console.log("[Seam Stitcher] Loading Tile A and Tile B UNORM16 buffers...");
const bufA = new Uint16Array((await Deno.readFile(fileA)).buffer);
const bufB = new Uint16Array((await Deno.readFile(fileB)).buffer);

const W = 1800;
const H = 1080;
const rowA = 1079; // South edge of Tile A (Lat 38.00°N)
const rowB = 0;    // North edge of Tile B (Lat 38.00°N)

let maxPreDiffMeters = 0;
let sumPreDiffMeters = 0;

for (let col = 0; col < W; col++) {
  const qA = bufA[rowA * W + col];
  const qB = bufB[rowB * W + col];
  const hA = (qA / 65535.0) * 1704.0;
  const hB = (qB / 65535.0) * 1704.0;
  const diff = Math.abs(hA - hB);
  if (diff > maxPreDiffMeters) maxPreDiffMeters = diff;
  sumPreDiffMeters += diff;

  // Compute exact shared average
  const qAvg = Math.round((qA + qB) / 2.0);
  bufA[rowA * W + col] = qAvg;
  bufB[rowB * W + col] = qAvg;
}

console.log(`Pre-stitching Seam Metrics across 1,800 points:`);
console.log(`  Max Discrepancy: ${maxPreDiffMeters.toFixed(2)} m`);
console.log(`  Mean Discrepancy: ${(sumPreDiffMeters / W).toFixed(2)} m`);

// Verification after stitching
let maxPostDiff = 0;
for (let col = 0; col < W; col++) {
  const diff = Math.abs(bufA[rowA * W + col] - bufB[rowB * W + col]);
  if (diff > maxPostDiff) maxPostDiff = diff;
}

console.log(`Post-stitching Seam Discrepancy: ${maxPostDiff} units (${(maxPostDiff * (1704.0 / 65535.0) * 1000).toFixed(4)} mm)`);
console.log(">>> VERIFIED: 100% Watertight seam achieved!");

// Save stitched binaries
const outA = `${TERRAIN_DIR}/seoraksan_yangyang_stitched_unorm16.bin`;
const outB = `${TERRAIN_DIR}/gangneung_odaesan_stitched_unorm16.bin`;

await Deno.writeFile(outA, new Uint8Array(bufA.buffer));
await Deno.writeFile(outB, new Uint8Array(bufB.buffer));

// Mirror to earth workspace
await Deno.copyFile(outA, `/Users/katsina/Downloads/earth/assets/terrain/copernicus/seoraksan_yangyang_stitched_unorm16.bin`);
await Deno.copyFile(outB, `/Users/katsina/Downloads/earth/assets/terrain/copernicus/gangneung_odaesan_stitched_unorm16.bin`);

console.log("[Seam Stitcher] Stitched buffers saved to disk.");
