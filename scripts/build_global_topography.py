#!/usr/bin/env python3
"""
SEISMOLIVE v4.0 — Phase E: Global Topography & Bathymetry Pipeline
Extracts high-fidelity planetary relief from NOAA ETOPO 2022 (60-arc-second) GeoTIFF:
  - Global 4096x2048 UNORM16 elevation/bathymetry raster
  - Global 2048x1024 UNORM16 fallback raster
  - Preserves exact scientific vertical range: H_MIN = -11,000m to H_MAX = +9,000m
  - Zero fake procedural noise; 100% grounded in empirical geodetic bathymetry & topography
"""

import struct, zlib, json, os, time, math

class GlobalETOPOReader:
    def __init__(self, tif_path):
        self.tif_path = tif_path
        self.cached_tiles = {}
        self.max_cache = 256  # Keep up to 256 tiles in memory (~64 MB)
        self.cache_queue = []

        with open(tif_path, 'rb') as f:
            f.seek(8)
            num_tags = struct.unpack('<H', f.read(2))[0]
            self.tile_offsets = []
            self.tile_bytecounts = []
            self.scales = None
            self.tiepoint = None
            self.img_w = 0
            self.img_h = 0
            self.tile_w = 256
            self.tile_h = 256

            for _ in range(num_tags):
                tag, typ, cnt, val = struct.unpack('<HHII', f.read(12))
                p = f.tell()
                if tag == 256: # ImageWidth
                    self.img_w = val
                elif tag == 257: # ImageLength
                    self.img_h = val
                elif tag == 322: # TileWidth
                    self.tile_w = val
                elif tag == 323: # TileLength
                    self.tile_h = val
                elif tag == 324: # TileOffsets
                    f.seek(val)
                    self.tile_offsets = struct.unpack(f'<{cnt}I', f.read(cnt * 4))
                    f.seek(p)
                elif tag == 325: # TileByteCounts
                    f.seek(val)
                    self.tile_bytecounts = struct.unpack(f'<{cnt}I', f.read(cnt * 4))
                    f.seek(p)
                elif tag == 33550: # ModelPixelScale
                    f.seek(val)
                    self.scales = struct.unpack('<3d', f.read(24))
                    f.seek(p)
                elif tag == 33922: # ModelTiepoint
                    f.seek(val)
                    self.tiepoint = struct.unpack('<6d', f.read(48))
                    f.seek(p)

        self.west = self.tiepoint[3]
        self.north = self.tiepoint[4]
        self.pixel_w = self.scales[0]
        self.pixel_h = self.scales[1]
        self.east = self.west + self.img_w * self.pixel_w
        self.south = self.north - self.img_h * self.pixel_h

        self.tiles_x = (self.img_w + self.tile_w - 1) // self.tile_w
        self.tiles_y = (self.img_h + self.tile_h - 1) // self.tile_h

        print(f"[GlobalETOPOReader] Loaded {tif_path}")
        print(f"  Raster Size: {self.img_w} x {self.img_h} ({self.tiles_x} x {self.tiles_y} = {len(self.tile_offsets)} tiles)")
        print(f"  Geodetic Bounds: Lon [{self.west:.1f}, {self.east:.1f}], Lat [{self.south:.1f}, {self.north:.1f}]")
        print(f"  Pixel Scale: {self.pixel_w:.6f} deg ({self.pixel_w*3600:.1f} arc-sec)")

    def _decode_tile(self, tile_idx):
        if tile_idx in self.cached_tiles:
            return self.cached_tiles[tile_idx]

        offset = self.tile_offsets[tile_idx]
        bytecount = self.tile_bytecounts[tile_idx]
        if bytecount == 0 or offset == 0:
            return None

        with open(self.tif_path, 'rb') as f:
            f.seek(offset)
            raw_comp = f.read(bytecount)
            decomp = zlib.decompress(raw_comp)

        # Decompress horizontal differencing (Predictor 3 for Float32)
        width = self.tile_w
        height = self.tile_h
        bps = 4
        stride = 1
        row_bytes = width * bps
        floats = []
        for r in range(height):
            cp = bytearray(decomp[r * row_bytes : (r + 1) * row_bytes])
            for i in range(len(cp) - stride):
                cp[i + stride] = (cp[i + stride] + cp[i]) & 0xFF
            reordered = bytearray(row_bytes)
            for count in range(width):
                for byte in range(bps):
                    reordered[bps * count + byte] = cp[(bps - byte - 1) * width + count]
            row_floats = struct.unpack(f'<{width}f', reordered)
            floats.extend(row_floats)

        if len(self.cache_queue) >= self.max_cache:
            evict = self.cache_queue.pop(0)
            if evict in self.cached_tiles:
                del self.cached_tiles[evict]

        self.cached_tiles[tile_idx] = floats
        self.cache_queue.append(tile_idx)
        return floats

    def sample_elevation(self, lat, lon):
        # Wrap longitude to [-180, 180)
        while lon < -180.0: lon += 360.0
        while lon >= 180.0: lon -= 360.0
        lat = max(-90.0, min(90.0, lat))

        c = (lon - self.west) / self.pixel_w
        r = (self.north - lat) / self.pixel_h

        c = max(0.0, min(self.img_w - 1.0, c))
        r = max(0.0, min(self.img_h - 1.0, r))

        col_tile = int(c // self.tile_w)
        row_tile = int(r // self.tile_h)
        col_tile = min(self.tiles_x - 1, col_tile)
        row_tile = min(self.tiles_y - 1, row_tile)
        tile_idx = row_tile * self.tiles_x + col_tile

        floats = self._decode_tile(tile_idx)
        if floats is None:
            return 0.0

        sub_c = int(c % self.tile_w)
        sub_r = int(r % self.tile_h)
        return floats[sub_r * self.tile_w + sub_c]


def generate_global_relief_binary(reader, out_w, out_h, out_bin, out_json):
    print(f"\n[Processing] Generating {out_w}x{out_h} planetary relief raster -> {out_bin}...")
    t0 = time.time()

    H_MIN = -11000.0  # Mariana Trench depth -10,920m + margin
    H_MAX = 9000.0    # Mount Everest summit +8,848m + margin
    DELTA_H = H_MAX - H_MIN

    min_seen = 99999.0
    max_seen = -99999.0

    u16_bytes = bytearray(out_w * out_h * 2)
    idx = 0

    # Scan row by row from North (+90) to South (-90)
    # matching standard UV mapping (v=0 is North, v=1 is South)
    for y in range(out_h):
        # v goes from 0 (North Pole) to 1 (South Pole)
        lat = 90.0 - (y + 0.5) / out_h * 180.0
        for x in range(out_w):
            # u goes from 0 (-180 Lon) to 1 (+180 Lon)
            lon = -180.0 + (x + 0.5) / out_w * 360.0

            elev = reader.sample_elevation(lat, lon)
            if elev < min_seen: min_seen = elev
            if elev > max_seen: max_seen = elev

            # Normalize to [0.0, 1.0]
            clamped = max(H_MIN, min(H_MAX, elev))
            norm = (clamped - H_MIN) / DELTA_H
            u16 = int(norm * 65535.0 + 0.5)
            u16 = max(0, min(65535, u16))

            struct.pack_into('<H', u16_bytes, idx, u16)
            idx += 2

        if (y + 1) % 256 == 0 or (y + 1) == out_h:
            pct = (y + 1) / out_h * 100.0
            print(f"  Progress: {pct:5.1f}% ({y+1}/{out_h} rows) | Current elev range: [{min_seen:.1f}m, {max_seen:.1f}m]")

    with open(out_bin, 'wb') as f:
        f.write(u16_bytes)

    meta = {
        "datasetName": "NOAA ETOPO 2022 Global Relief Model (Planetary Elevation & Bathymetry)",
        "source": "NOAA National Centers for Environmental Information (NCEI)",
        "doi": "10.25921/fd10-nh44",
        "license": "Public Domain / U.S. Government Work (CC0 Compatible)",
        "dimensions": { "width": out_w, "height": out_h },
        "bounds": { "lat_min": -90.0, "lat_max": 90.0, "lon_min": -180.0, "lon_max": 180.0 },
        "verticalDatum": "EGM2008 Geoid approximating Mean Sea Level (MSL)",
        "elevationRangeMeters": {
            "hMin": H_MIN,
            "hMax": H_MAX,
            "minSampled": min_seen,
            "maxSampled": max_seen
        },
        "normalization": {
            "format": "UNORM16",
            "bytesPerPixel": 2,
            "byteOrder": "LITTLE_ENDIAN",
            "formula": "h = norm * (H_MAX - H_MIN) + H_MIN",
            "resolutionMetersPerStep": DELTA_H / 65535.0
        }
    }

    with open(out_json, 'w', encoding='utf-8') as f:
        json.dump(meta, f, indent=2)

    dur = time.time() - t0
    size_mb = len(u16_bytes) / (1024 * 1024)
    print(f"[Done] Generated {out_bin} ({size_mb:.2f} MB) in {dur:.2f}s")
    print(f"  Physical sampled elevation range: {min_seen:.1f}m to {max_seen:.1f}m\n")


if __name__ == '__main__':
    tif_path = 'assets/terrain/bathymetry/ETOPO_2022_v1_60s_N90W180_surface.tif'
    if not os.path.exists(tif_path):
        print(f"Error: {tif_path} does not exist yet. Please wait for download.")
        exit(1)

    reader = GlobalETOPOReader(tif_path)
    
    # 1. High-fidelity 4096x2048 planetary relief
    generate_global_relief_binary(
        reader,
        4096, 2048,
        'assets/terrain/bathymetry/global_etopo_elevation_4096_unorm16.bin',
        'assets/terrain/bathymetry/global_etopo_elevation_4096_unorm16.json'
    )

    # 2. Fast 2048x1024 baseline relief
    generate_global_relief_binary(
        reader,
        2048, 1024,
        'assets/terrain/bathymetry/global_etopo_elevation_2048_unorm16.bin',
        'assets/terrain/bathymetry/global_etopo_elevation_2048_unorm16.json'
    )
