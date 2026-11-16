# ============================================================================
# SEISMOLIVE v4.0 — Seoraksan Ridge Cross-Section LOD Profiling Test
# File: tests/test_seorak_profile_lod.py (True LibTIFF Decoder)
# ============================================================================

import zlib, struct, math

def decode_fp_predictor_tiff(raw_bytes, width, height):
    row_bytes = width * 4
    out_floats = []
    for r in range(height):
        row = bytearray(raw_bytes[r * row_bytes : (r + 1) * row_bytes])
        for i in range(1, len(row)):
            row[i] = (row[i] + row[i - 1]) & 0xFF
        row_floats = []
        for c in range(width):
            b0 = row[c]
            b1 = row[width + c]
            b2 = row[2 * width + c]
            b3 = row[3 * width + c]
            val = struct.unpack('>f', bytes([b0, b1, b2, b3]))[0]
            row_floats.append(val)
        out_floats.extend(row_floats)
    return out_floats

# Read Seoraksan Tile (Tile 13: row 3, col 1) from N38_E128
dem_path = 'assets/terrain/copernicus/Copernicus_DSM_COG_10_N38_00_E128_00_DEM.tif'

with open(dem_path, 'rb') as f:
    f.seek(192)
    num_tags = struct.unpack('<H', f.read(2))[0]
    offsets = []
    bytecounts = []
    for _ in range(num_tags):
        tag, typ, cnt, val = struct.unpack('<HHII', f.read(12))
        if tag == 324:
            p = f.tell(); f.seek(val); offsets = struct.unpack(f'<{cnt}I', f.read(cnt*4)); f.seek(p)
        elif tag == 325:
            p = f.tell(); f.seek(val); bytecounts = struct.unpack(f'<{cnt}I', f.read(cnt*4)); f.seek(p)
    
    tile_idx = 13
    f.seek(offsets[tile_idx])
    decomp = zlib.decompress(f.read(bytecounts[tile_idx]))
    floats = decode_fp_predictor_tiff(decomp, 1024, 1024)

# Ridge traverse across high mountain zone (Daecheongbong summit ridge: sub_r ~99, sub_c ~650)
sample_points = []
for i in range(100):
    r = 90 + i
    c = 630 + int(i * 0.4)
    elev = floats[r * 1024 + c]
    sample_points.append(elev)

ref_peak = max(sample_points)
ref_mean = sum(sample_points) / len(sample_points)

def resample_profile(step):
    resampled = []
    curr = 0.0
    while curr < len(sample_points) - 1:
        i0 = int(math.floor(curr))
        i1 = min(i0 + 1, len(sample_points) - 1)
        frac = curr - i0
        val = sample_points[i0] * (1.0 - frac) + sample_points[i1] * frac
        resampled.append(val)
        curr += step
    return resampled

prof_768 = resample_profile(52.0 / 30.0)
prof_512 = resample_profile(78.0 / 30.0)
prof_256 = resample_profile(156.0 / 30.0)

peak_768 = max(prof_768)
peak_512 = max(prof_512)
peak_256 = max(prof_256)

def compute_rmse(prof, step):
    sq_err = 0.0
    count = 0
    for idx, raw_val in enumerate(sample_points):
        t = idx / step
        t0 = int(math.floor(t))
        t1 = min(t0 + 1, len(prof) - 1)
        if t0 < len(prof):
            frac = t - t0
            interp = prof[t0] * (1.0 - frac) + prof[t1] * frac
            sq_err += (raw_val - interp)**2
            count += 1
    return math.sqrt(sq_err / max(1, count))

rmse_768 = compute_rmse(prof_768, 52.0 / 30.0)
rmse_512 = compute_rmse(prof_512, 78.0 / 30.0)
rmse_256 = compute_rmse(prof_256, 156.0 / 30.0)

print(f"Reference Raw DEM 30m Peak: {ref_peak:.2f} m (Profile Mean: {ref_mean:.2f} m)")
print(f"LOD 768 Peak: {peak_768:.2f} m (Trunc: {ref_peak - peak_768:.2f} m, RMSE: {rmse_768:.2f} m)")
print(f"LOD 512 Peak: {peak_512:.2f} m (Trunc: {ref_peak - peak_512:.2f} m, RMSE: {rmse_512:.2f} m)")
print(f"LOD 256 Peak: {peak_256:.2f} m (Trunc: {ref_peak - peak_256:.2f} m, RMSE: {rmse_256:.2f} m)")
