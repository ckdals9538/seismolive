# ============================================================================
# SEISMOLIVE v4.0 — Phase B: Universal Earthquake DEM Extractor
# File: scripts/build_universal_event_dem.py
#
# Generates authentic regional DEM binaries & JSON metadata for 5 benchmark events
# from real NOAA ETOPO 2022 (15-arc-second ~450m) GeoTIFFs:
#   1. hist_1681_0626       (Yangyang, Korea - Offshore & Alpine Coast)
#   2. hist_2016_gyeongju   (Gyeongju, Korea - Inland Fault Basin)
#   3. hist_2017_pohang     (Pohang, Korea - Coastal Continental Shelf)
#   4. global_2016_kumamoto (Kumamoto, Japan - Inland Volcanic Rift / Aso Caldera)
#   5. global_2023_turkey   (Kahramanmaras, Turkey - Continental Strike-Slip Fault)
# ============================================================================

import struct, zlib, json, os, math

class ETOPOReader:
    def __init__(self, tif_path):
        self.tif_path = tif_path
        self.cached_tiles = {}
        with open(tif_path, 'rb') as f:
            f.seek(8)
            num_tags = struct.unpack('<H', f.read(2))[0]
            self.tile_offsets = []
            self.tile_bytecounts = []
            self.scales, self.tiepoint = None, None
            for _ in range(num_tags):
                tag, typ, cnt, val = struct.unpack('<HHII', f.read(12))
                p = f.tell()
                if tag == 324:
                    f.seek(val); self.tile_offsets = struct.unpack(f'<{cnt}I', f.read(cnt*4)); f.seek(p)
                elif tag == 325:
                    f.seek(val); self.tile_bytecounts = struct.unpack(f'<{cnt}I', f.read(cnt*4)); f.seek(p)
                elif tag == 33550:
                    f.seek(val); self.scales = struct.unpack('<3d', f.read(24)); f.seek(p)
                elif tag == 33922:
                    f.seek(val); self.tiepoint = struct.unpack('<6d', f.read(48)); f.seek(p)

        self.west = self.tiepoint[3]
        self.north = self.tiepoint[4]
        self.pixel_w = self.scales[0]
        self.pixel_h = self.scales[1]
        self.east = self.west + 3600 * self.pixel_w
        self.south = self.north - 3600 * self.pixel_h

    def _decode_tile(self, tile_idx):
        if tile_idx in self.cached_tiles:
            return self.cached_tiles[tile_idx]

        with open(self.tif_path, 'rb') as f:
            f.seek(self.tile_offsets[tile_idx])
            raw_comp = f.read(self.tile_bytecounts[tile_idx])
            decomp = zlib.decompress(raw_comp)

        # Decompress floating-point horizontal differencing (Predictor 3 via LibTIFF fpAcc)
        width, height = 256, 256
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

        self.cached_tiles[tile_idx] = floats
        return floats

    def sample_elevation(self, lat, lon):
        if not (self.south <= lat <= self.north and self.west <= lon <= self.east):
            return 0.0

        c = (lon - self.west) / self.pixel_w
        r = (self.north - lat) / self.pixel_h

        c = max(0.0, min(3599.0, c))
        r = max(0.0, min(3599.0, r))

        col_tile = int(c // 256)
        row_tile = int(r // 256)
        col_tile = min(14, col_tile)
        row_tile = min(14, row_tile)
        tile_idx = row_tile * 15 + col_tile

        floats = self._decode_tile(tile_idx)
        sub_c = int(c % 256)
        sub_r = int(r % 256)
        return floats[sub_r * 256 + sub_c]

def extract_regional_grid(reader, lat_center, lon_center, d_lat, d_lon, width=900, height=720):
    lat_min = lat_center - d_lat * 0.5
    lat_max = lat_center + d_lat * 0.5
    lon_min = lon_center - d_lon * 0.5
    lon_max = lon_center + d_lon * 0.5

    floats = []
    land_count = 0
    ocean_count = 0

    for r in range(height):
        v = r / (height - 1)
        lat = lat_max - v * (lat_max - lat_min)
        for c in range(width):
            u = c / (width - 1)
            lon = lon_min + u * (lon_max - lon_min)
            elev = reader.sample_elevation(lat, lon)
            floats.append(elev)
            if elev >= 0.0:
                land_count += 1
            else:
                ocean_count += 1

    min_elev = min(floats)
    max_elev = max(floats)
    total_pix = width * height

    return {
        'floats': floats,
        'width': width,
        'height': height,
        'bounds': {
            'lat_min': round(lat_min, 4),
            'lat_max': round(lat_max, 4),
            'lon_min': round(lon_min, 4),
            'lon_max': round(lon_max, 4)
        },
        'min_elev': min_elev,
        'max_elev': max_elev,
        'land_percentage': round((land_count / total_pix) * 100.0, 1),
        'ocean_percentage': round((ocean_count / total_pix) * 100.0, 1)
    }

def save_dem_binary_and_json(grid_data, base_path, event_meta):
    # UNORM16 normalization using fixed global envelope: -3500m to +2500m
    H_MIN = -3500.0
    H_MAX = +2500.0
    u16_vals = []
    for elev in grid_data['floats']:
        norm = max(0.0, min(1.0, (elev - H_MIN) / (H_MAX - H_MIN)))
        u16 = int(round(norm * 65535.0))
        u16_vals.append(u16)

    bin_path = f"{base_path}.bin"
    json_path = f"{base_path}.json"

    os.makedirs(os.path.dirname(bin_path), exist_ok=True)

    with open(bin_path, 'wb') as f:
        f.write(struct.pack(f'<{len(u16_vals)}H', *u16_vals))

    descriptor = {
        'eventId': event_meta['eventId'],
        'titleKo': event_meta['titleKo'],
        'geographicType': event_meta['geographicType'],
        'dimensions': {
            'width': grid_data['width'],
            'height': grid_data['height']
        },
        'bounds': grid_data['bounds'],
        'elevationRangeMeters': {
            'min': round(grid_data['min_elev'], 2),
            'max': round(grid_data['max_elev'], 2),
            'hMin': H_MIN,
            'hMax': H_MAX
        },
        'surfaceDistribution': {
            'landPercentage': f"{grid_data['land_percentage']}%",
            'oceanPercentage': f"{grid_data['ocean_percentage']}%"
        },
        'cameraPreset': event_meta['cameraPreset'],
        'hasWaterSurface': grid_data['ocean_percentage'] > 0.5,
        'tier2Available': event_meta['tier2Available']
    }

    with open(json_path, 'w', encoding='utf-8') as f:
        json.dump(descriptor, f, indent=2, ensure_ascii=False)

    print(f"Generated {bin_path} ({os.path.getsize(bin_path)} bytes) & {json_path}")
    print(f"  Range: {grid_data['min_elev']:.1f}m ~ {grid_data['max_elev']:.1f}m | Land: {grid_data['land_percentage']}% | Ocean: {grid_data['ocean_percentage']}%")

if __name__ == '__main__':
    print('============================================================================')
    print('SEISMOLIVE v4.0 — Universal Event Regional DEM Extractor')
    print('============================================================================\n')

    etopo_korea_japan = ETOPOReader('assets/terrain/bathymetry/ETOPO_2022_v1_15s_N45E120_surface.tif')
    etopo_turkey = ETOPOReader('assets/terrain/bathymetry/ETOPO_2022_v1_15s_N45E030_surface.tif')

    events = [
        {
            'eventId': 'hist_2016_gyeongju',
            'titleKo': '2016년 경주 내륙 지진 (M5.8)',
            'geographicType': 'INLAND_FAULT_BASIN',
            'reader': etopo_korea_japan,
            'lat': 35.76, 'lon': 129.19,
            'd_lat': 1.0, 'd_lon': 1.0,
            'out_base': 'assets/terrain/bathymetry/regional_2016_gyeongju_unorm16',
            'tier2Available': False,
            'cameraPreset': {
                'name': 'Gyeongju Yangsan Fault Corridor',
                'pitchDeg': 32.0, 'headingDeg': 26.0,
                'camDist': 0.65, 'fov': 34.0
            }
        },
        {
            'eventId': 'hist_2017_pohang',
            'titleKo': '2017년 포항 해안 대륙붕 지진 (M5.4)',
            'geographicType': 'COASTAL_CONTINENTAL_SHELF',
            'reader': etopo_korea_japan,
            'lat': 36.11, 'lon': 129.37,
            'd_lat': 1.0, 'd_lon': 1.0,
            'out_base': 'assets/terrain/bathymetry/regional_2017_pohang_unorm16',
            'tier2Available': False,
            'cameraPreset': {
                'name': 'Pohang Yeongil Bay Shelf',
                'pitchDeg': 28.0, 'headingDeg': 45.0,
                'camDist': 0.68, 'fov': 35.0
            }
        },
        {
            'eventId': 'global_2016_kumamoto',
            'titleKo': '2016년 일본 구마모토 화산지구대 지진 (M7.3)',
            'geographicType': 'INLAND_VOLCANIC_RIFT',
            'reader': etopo_korea_japan,
            'lat': 32.75, 'lon': 130.76,
            'd_lat': 1.0, 'd_lon': 1.0,
            'out_base': 'assets/terrain/bathymetry/regional_2016_kumamoto_unorm16',
            'tier2Available': False,
            'cameraPreset': {
                'name': 'Kumamoto Graben & Mount Aso',
                'pitchDeg': 34.0, 'headingDeg': 60.0,
                'camDist': 0.72, 'fov': 36.0
            }
        },
        {
            'eventId': 'global_2023_turkey',
            'titleKo': '2023년 튀르키예 카흐라만마라슈 대단층 지진 (M7.8)',
            'geographicType': 'CONTINENTAL_STRIKE_SLIP_FAULT',
            'reader': etopo_turkey,
            'lat': 37.17, 'lon': 37.04,
            'd_lat': 1.0, 'd_lon': 1.0,
            'out_base': 'assets/terrain/bathymetry/regional_2023_turkey_unorm16',
            'tier2Available': False,
            'cameraPreset': {
                'name': 'East Anatolian Fault Rift Valley',
                'pitchDeg': 36.0, 'headingDeg': 40.0,
                'camDist': 0.75, 'fov': 35.0
            }
        }
    ]

    for ev in events:
        print(f"Extracting DEM for {ev['eventId']} ({ev['titleKo']})...")
        grid = extract_regional_grid(ev['reader'], ev['lat'], ev['lon'], ev['d_lat'], ev['d_lon'], 900, 720)
        save_dem_binary_and_json(grid, ev['out_base'], ev)
        print()
