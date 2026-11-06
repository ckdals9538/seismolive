# ============================================================================
# SEISMOLIVE v4.0 — Tier 2 Copernicus DEM Inset Extractor (True LibTIFF Decoder)
# File: scripts/build_tier2_inset.py
# ============================================================================

import zlib, struct, math, os

def read_tiff_tiles(filepath):
    with open(filepath, 'rb') as f:
        f.seek(192) # directory 0
        num_tags = struct.unpack('<H', f.read(2))[0]
        offsets = []
        bytecounts = []
        for _ in range(num_tags):
            tag, typ, cnt, val = struct.unpack('<HHII', f.read(12))
            if tag == 324: # TileOffsets
                p = f.tell(); f.seek(val); offsets = struct.unpack(f'<{cnt}I', f.read(cnt*4)); f.seek(p)
            elif tag == 325: # TileByteCounts
                p = f.tell(); f.seek(val); bytecounts = struct.unpack(f'<{cnt}I', f.read(cnt*4)); f.seek(p)
    return offsets, bytecounts

def decode_tile(filepath, offset, bytecount, width=1024, height=1024):
    with open(filepath, 'rb') as f:
        f.seek(offset)
        compressed = f.read(bytecount)
        raw_bytes = zlib.decompress(compressed)

    row_bytes = width * 4
    out_floats = []
    for r in range(height):
        row = bytearray(raw_bytes[r * row_bytes : (r + 1) * row_bytes])
        # LibTIFF horizontal difference accumulation (stride 1 across row)
        for i in range(1, len(row)):
            row[i] = (row[i] + row[i - 1]) & 0xFF
        # Reorder from 4 planar bytes to IEEE 754 32-bit floats
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

# Function to sample Copernicus DEM at any (lat, lon) using N38_E128 and N37_E128
class CopernicusDEMProvider:
    def __init__(self):
        self.tiles_meta = {
            'N38_E128': {
                'path': 'assets/terrain/copernicus/Copernicus_DSM_COG_10_N38_00_E128_00_DEM.tif',
                'lat_min': 38.0, 'lat_max': 39.0, 'lon_min': 128.0, 'lon_max': 129.0
            },
            'N37_E128': {
                'path': 'assets/terrain/copernicus/Copernicus_DSM_COG_10_N37_00_E128_00_DEM.tif',
                'lat_min': 37.0, 'lat_max': 38.0, 'lon_min': 128.0, 'lon_max': 129.0
            }
        }
        for k, v in self.tiles_meta.items():
            offsets, bytecounts = read_tiff_tiles(v['path'])
            v['offsets'] = offsets
            v['bytecounts'] = bytecounts
            v['cached_tiles'] = {}

    def get_elevation(self, lat, lon):
        tile_key = None
        if 38.0 <= lat <= 39.0 and 128.0 <= lon <= 129.0:
            tile_key = 'N38_E128'
        elif 37.0 <= lat < 38.0 and 128.0 <= lon <= 129.0:
            tile_key = 'N37_E128'
        
        if not tile_key:
            return 0.0

        meta = self.tiles_meta[tile_key]
        c = (lon - meta['lon_min']) * 3600.0
        r = (meta['lat_max'] - lat) * 3600.0

        c0 = int(math.floor(c))
        r0 = int(math.floor(r))
        c0 = max(0, min(3599, c0))
        r0 = max(0, min(3599, r0))

        tile_col = c0 // 1024
        tile_row = r0 // 1024
        sub_c = c0 % 1024
        sub_r = r0 % 1024
        tile_idx = tile_row * 4 + tile_col

        if tile_idx not in meta['cached_tiles']:
            meta['cached_tiles'][tile_idx] = decode_tile(
                meta['path'], meta['offsets'][tile_idx], meta['bytecounts'][tile_idx]
            )
        
        tile_data = meta['cached_tiles'][tile_idx]
        val = tile_data[sub_r * 1024 + sub_c]
        return val if -100.0 < val < 9000.0 else 0.0

def build_inset_binary(provider, lat_min, lat_max, lon_min, lon_max, resolution, out_path):
    out_floats = []
    for r in range(resolution):
        v = r / (resolution - 1)
        lat = lat_max - v * (lat_max - lat_min)
        for c in range(resolution):
            u = c / (resolution - 1)
            lon = lon_min + u * (lon_max - lon_min)
            elev = provider.get_elevation(lat, lon)
            out_floats.append(elev)

    raw_bytes = struct.pack(f'<{len(out_floats)}f', *out_floats)
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    with open(out_path, 'wb') as f:
        f.write(raw_bytes)
    
    print(f"Created {out_path}: {len(raw_bytes)} bytes ({resolution}x{resolution})")
    print(f"  Min elev: {min(out_floats):.2f} m, Max elev: {max(out_floats):.2f} m, Mean: {sum(out_floats)/len(out_floats):.2f} m")

if __name__ == '__main__':
    provider = CopernicusDEMProvider()
    
    # 44km x 44km Inset centered on Yangyang coastal land & Seoraksan corridor:
    # Lat: 37.80°N to 38.20°N (0.40° = ~44.4 km)
    # Lon: 128.45°E to 128.95°E (0.50° = ~43.8 km)
    # Includes Seoraksan Daecheongbong (38.119°N, 128.465°E, ~1703m in DEM)
    lat_min, lat_max = 37.80, 38.20
    lon_min, lon_max = 128.45, 128.95

    build_inset_binary(provider, lat_min, lat_max, lon_min, lon_max, 256, 'assets/terrain/copernicus/tier2_yangyang_256.bin')
    build_inset_binary(provider, lat_min, lat_max, lon_min, lon_max, 512, 'assets/terrain/copernicus/tier2_yangyang_512.bin')
    build_inset_binary(provider, lat_min, lat_max, lon_min, lon_max, 768, 'assets/terrain/copernicus/tier2_yangyang_768.bin')
