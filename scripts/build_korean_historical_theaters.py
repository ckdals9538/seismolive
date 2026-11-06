#!/usr/bin/env python3
"""
SEISMOLIVE v4.0 — Phase E: Korean Historical Earthquake Theaters DEM Extractor
Generates authentic 15-arc-second (~450m) DEM binaries from real NOAA ETOPO 2022
for all major historical capitals and regional theaters across the Korean Peninsula:
  1. Central Korea (Seoul/Hanyang & Gaeseong/Gaegyeong)
  2. Northern Korea (Pyongyang / Goguryeo)
  3. Southwestern Korea (Buyeo/Gongju / Baekje)
  4. Jeju Volcanic Island & Maritime Shelf
"""

import sys, os, time
sys.path.append('scripts')
from build_universal_event_dem import ETOPOReader, extract_regional_grid, save_dem_binary_and_json

def build_theaters():
    tif_path = 'assets/terrain/bathymetry/ETOPO_2022_v1_15s_N45E120_surface.tif'
    if not os.path.exists(tif_path):
        print(f"Error: {tif_path} not found.")
        return

    print("====================================================================")
    print("SEISMOLIVE v4.0 — Extracting Korean Historical Theater Regional DEMs")
    print("====================================================================")
    t0 = time.time()
    reader = ETOPOReader(tif_path)

    theaters = [
        {
            'base_path': 'assets/terrain/bathymetry/regional_central_korea_unorm16',
            'lat_center': 37.60,
            'lon_center': 126.80,
            'd_lat': 1.6,
            'd_lon': 2.0,
            'width': 900,
            'height': 720,
            'meta': {
                'eventId': 'hist_1518_seoul',
                'titleKo': '한양(서울)·개경(개성) 일원 중부 역사지진',
                'geographicType': 'INLAND_BASIN_PLAIN',
                'cameraPreset': {
                    'name': 'Hanyang & Bukhansan Ridge Corridor',
                    'pitchDeg': 34.0,
                    'headingDeg': 30.0,
                    'camDist': 0.70,
                    'targetY': 0.005
                },
                'tier2Available': False
            }
        },
        {
            'base_path': 'assets/terrain/bathymetry/regional_pyongyang_unorm16',
            'lat_center': 39.02,
            'lon_center': 125.75,
            'd_lat': 1.6,
            'd_lon': 2.0,
            'width': 900,
            'height': 720,
            'meta': {
                'eventId': 'hist_0502_goguryeo',
                'titleKo': '평양성·대동강 유역 고구려 역사지진',
                'geographicType': 'INLAND_BASIN_PLAIN',
                'cameraPreset': {
                    'name': 'Pyongyang Basin & Taedong River Valley',
                    'pitchDeg': 32.0,
                    'headingDeg': 45.0,
                    'camDist': 0.72,
                    'targetY': 0.005
                },
                'tier2Available': False
            }
        },
        {
            'base_path': 'assets/terrain/bathymetry/regional_baekje_unorm16',
            'lat_center': 36.30,
            'lon_center': 127.00,
            'd_lat': 1.6,
            'd_lon': 2.0,
            'width': 900,
            'height': 720,
            'meta': {
                'eventId': 'hist_0639_baekje',
                'titleKo': '사비(부여)·웅진(공주) 백제 역사지진',
                'geographicType': 'INLAND_BASIN_PLAIN',
                'cameraPreset': {
                    'name': 'Geumgang River Valley & Gyeryongsan',
                    'pitchDeg': 30.0,
                    'headingDeg': 35.0,
                    'camDist': 0.68,
                    'targetY': 0.004
                },
                'tier2Available': False
            }
        },
        {
            'base_path': 'assets/terrain/bathymetry/regional_jeju_unorm16',
            'lat_center': 33.40,
            'lon_center': 126.60,
            'd_lat': 1.6,
            'd_lon': 2.0,
            'width': 900,
            'height': 720,
            'meta': {
                'eventId': 'hist_jeju_island',
                'titleKo': '제주도 한라산 화산체 및 남해 대륙붕 지진',
                'geographicType': 'COASTAL_CONTINENTAL_SHELF',
                'cameraPreset': {
                    'name': 'Mount Halla Caldera & Southern Maritime Shelf',
                    'pitchDeg': 28.0,
                    'headingDeg': 45.0,
                    'camDist': 0.72,
                    'targetY': 0.008
                },
                'tier2Available': False
            }
        }
    ]

    for th in theaters:
        print(f"\nExtracting {th['meta']['titleKo']}...")
        grid = extract_regional_grid(
            reader,
            th['lat_center'], th['lon_center'],
            th['d_lat'], th['d_lon'],
            width=th['width'], height=th['height']
        )
        save_dem_binary_and_json(grid, th['base_path'], th['meta'])
        print(f"  Bounds: Lat [{grid['bounds']['lat_min']}, {grid['bounds']['lat_max']}], Lon [{grid['bounds']['lon_min']}, {grid['bounds']['lon_max']}]")
        print(f"  Elevation: Min={grid['min_elev']:.1f}m, Max={grid['max_elev']:.1f}m | Land={grid['land_percentage']}%, Ocean={grid['ocean_percentage']}%")

    print(f"\n[Completed] All 4 regional theaters built successfully in {time.time()-t0:.2f}s")

if __name__ == '__main__':
    build_theaters()
