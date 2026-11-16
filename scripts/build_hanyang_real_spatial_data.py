#!/usr/bin/env python3
"""
Extracts real OSM building OBBs, multi-class road/rail polylines, water/green polygons,
and DEM terrain relief within +-2,200m of HANYANG_BLDG212_ANCHOR from the local
Seoul 3D Atlas dataset and compiles them into:
  - js/response/HanyangRealSpatialPayload.js (synchronous ESM payload for 4km layer)
"""

import json
import math
import os
import struct

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ATLAS_DIR = "/Users/katsina/.gemini/antigravity/brain/6a51ec9e-de1e-4cbc-8dd0-919ae91c4f3f/scratch/seoul-3d-atlas/dist/data"
OUT_PAYLOAD_JS = os.path.join(REPO_ROOT, "js", "response", "HanyangRealSpatialPayload.js")

ANCHOR_LON = 127.045053
ANCHOR_LAT = 37.555815
HALF_EXTENT_TERRAIN_M = 2200.0
HALF_EXTENT_BLDG_M = 2000.0
GRID_N = 128  # 129 x 129 vertices (~34.3m spacing for smooth slopes & river banks)


def sutherland_hodgman_clip(ring, xmin, xmax, ymin, ymax):
    def clip_edge(pts, inside_fn, intersect_fn):
        if not pts:
            return []
        out = []
        prev = pts[-1]
        prev_in = inside_fn(prev)
        for cur in pts:
            cur_in = inside_fn(cur)
            if cur_in:
                if not prev_in:
                    out.append(intersect_fn(prev, cur))
                out.append(cur)
            elif prev_in:
                out.append(intersect_fn(prev, cur))
            prev = cur
            prev_in = cur_in
        return out

    def ix_left(a, b):
        dx = b[0] - a[0]
        t = (xmin - a[0]) / dx if abs(dx) > 1e-9 else 0.0
        return (xmin, a[1] + t * (b[1] - a[1]))

    def ix_right(a, b):
        dx = b[0] - a[0]
        t = (xmax - a[0]) / dx if abs(dx) > 1e-9 else 0.0
        return (xmax, a[1] + t * (b[1] - a[1]))

    def ix_bottom(a, b):
        dy = b[1] - a[1]
        t = (ymin - a[1]) / dy if abs(dy) > 1e-9 else 0.0
        return (a[0] + t * (b[0] - a[0]), ymin)

    def ix_top(a, b):
        dy = b[1] - a[1]
        t = (ymax - a[1]) / dy if abs(dy) > 1e-9 else 0.0
        return (a[0] + t * (b[0] - a[0]), ymax)

    pts = list(ring)
    pts = clip_edge(pts, lambda p: p[0] >= xmin, ix_left)
    pts = clip_edge(pts, lambda p: p[0] <= xmax, ix_right)
    pts = clip_edge(pts, lambda p: p[1] >= ymin, ix_bottom)
    pts = clip_edge(pts, lambda p: p[1] <= ymax, ix_top)
    return pts


def liang_barsky_clip_segment(p0, p1, xmin, xmax, ymin, ymax):
    x0, y0 = p0
    x1, y1 = p1
    dx = x1 - x0
    dy = y1 - y0
    t0, t1 = 0.0, 1.0
    for p, q in ((-dx, x0 - xmin), (dx, xmax - x0), (-dy, y0 - ymin), (dy, ymax - y0)):
        if abs(p) < 1e-12:
            if q < 0:
                return None
        else:
            r = q / p
            if p < 0:
                if r > t1:
                    return None
                if r > t0:
                    t0 = r
            else:
                if r < t0:
                    return None
                if r < t1:
                    t1 = r
    return (x0 + t0 * dx, y0 + t0 * dy), (x0 + t1 * dx, y0 + t1 * dy)


def clip_polyline(points, xmin, xmax, ymin, ymax):
    chains = []
    cur = []
    for i in range(len(points) - 1):
        seg = liang_barsky_clip_segment(points[i], points[i + 1], xmin, xmax, ymin, ymax)
        if seg is None:
            if len(cur) >= 2:
                chains.append(cur)
            cur = []
            continue
        a, b = seg
        if not cur:
            cur = [a, b]
        else:
            if math.hypot(cur[-1][0] - a[0], cur[-1][1] - a[1]) < 0.25:
                cur.append(b)
            else:
                if len(cur) >= 2:
                    chains.append(cur)
                cur = [a, b]
    if len(cur) >= 2:
        chains.append(cur)
    return chains


def poly_area(pts):
    if len(pts) < 3:
        return 0.0
    s = 0.0
    n = len(pts)
    for i in range(n):
        j = (i + 1) % n
        s += pts[i][0] * pts[j][1] - pts[j][0] * pts[i][1]
    return abs(s) * 0.5


def point_in_poly(x, y, poly):
    inside = False
    n = len(poly)
    j = n - 1
    for i in range(n):
        xi, yi = poly[i]
        xj, yj = poly[j]
        if ((yi > y) != (yj > y)) and (x < (xj - xi) * (y - yi) / ((yj - yi) if abs(yj - yi) > 1e-12 else 1e-12) + xi):
            inside = not inside
        j = i
    return inside


def is_excluded_campus_footprint(east_m, north_m):
    # Exclude target Building 212 (제1공학관) footprint so detailed wireframe/structural model has no z-fighting
    if math.hypot(east_m - 52.0, north_m - 74.0) < 56.0:
        return True
    # Exclude Hanyang Main Stadium (OA-21060) open pitch/track oval at [226.75, -218.17]
    dx_s = (east_m - 226.75) / 68.0
    dn_s = (north_m - (-218.17)) / 92.0
    if (dx_s * dx_s + dn_s * dn_s) < 1.0:
        return True
    # Keep direct ramp/stair spine just outside 1F SE exit open
    if 65.0 <= east_m <= 165.0 and -125.0 <= north_m <= 55.0:
        return True
    # Also exclude exact centers of our named HIT & Paiknam packages if they overlap slightly
    # Wait: keep HIT and Paiknam real footprints out ONLY if within 22m of wireframe center
    if math.hypot(east_m - (-95.0), north_m - 210.0) < 28.0:
        return True
    if math.hypot(east_m - (-35.0), north_m - (-75.0)) < 26.0:
        return True
    return False


def main():
    with open(os.path.join(ATLAS_DIR, "seoul.json")) as f:
        atlas = json.load(f)

    meta = atlas["meta"]
    sx, sz = meta["sx"], meta["sz"]
    orig_lon, orig_lat = meta["origin"]

    lat_rad = math.radians(ANCHOR_LAT)
    m_lon = 111412.84 * math.cos(lat_rad) - 93.5 * math.cos(3.0 * lat_rad)
    m_lat = 111132.92 - 559.82 * math.cos(2.0 * lat_rad)
    scale_x = m_lon / sx
    scale_z = m_lat / sz
    ax = (ANCHOR_LON - orig_lon) * sx
    az = (orig_lat - ANCHOR_LAT) * sz

    def to_en(p):
        return ((p[0] - ax) * scale_x, -(p[1] - az) * scale_z)

    # ------------------------------------------------------------------
    # 1. Extract & Clip Water Polygons
    # ------------------------------------------------------------------
    water_polys = []
    seen_water = set()
    water_heights = atlas.get("waterHeights", [])
    for idx, rings in enumerate(atlas.get("water", [])):
        if not rings or len(rings[0]) < 3:
            continue
        wh_asl = water_heights[idx] if idx < len(water_heights) else 10.0
        outer = sutherland_hodgman_clip(
            [to_en(p) for p in rings[0]],
            -HALF_EXTENT_TERRAIN_M, HALF_EXTENT_TERRAIN_M,
            -HALF_EXTENT_TERRAIN_M, HALF_EXTENT_TERRAIN_M
        )
        if len(outer) < 3 or poly_area(outer) < 250.0:
            continue
        # Remove consecutive duplicate vertices
        clean_outer = []
        for p in outer:
            rp = (round(p[0], 1), round(p[1], 1))
            if not clean_outer or math.hypot(rp[0] - clean_outer[-1][0], rp[1] - clean_outer[-1][1]) > 0.8:
                clean_outer.append(rp)
        if len(clean_outer) < 3 or poly_area(clean_outer) < 250.0:
            continue

        cx = round(sum(p[0] for p in clean_outer) / len(clean_outer), 0)
        cy = round(sum(p[1] for p in clean_outer) / len(clean_outer), 0)
        area_r = round(poly_area(clean_outer), -1)
        dedup_key = (cx, cy, area_r)
        if dedup_key in seen_water:
            continue
        seen_water.add(dedup_key)

        water_y = max(-18.2, min(-14.8, (wh_asl - 18.0) * 0.32 - 15.0))
        holes = []
        for hr in rings[1:]:
            hc = sutherland_hodgman_clip(
                [to_en(p) for p in hr],
                -HALF_EXTENT_TERRAIN_M, HALF_EXTENT_TERRAIN_M,
                -HALF_EXTENT_TERRAIN_M, HALF_EXTENT_TERRAIN_M
            )
            if len(hc) >= 3 and poly_area(hc) >= 120.0:
                clean_h = []
                for p in hc:
                    rp = (round(p[0], 1), round(p[1], 1))
                    if not clean_h or math.hypot(rp[0] - clean_h[-1][0], rp[1] - clean_h[-1][1]) > 0.8:
                        clean_h.append(rp)
                if len(clean_h) >= 3:
                    holes.append(clean_h)

        xs = [p[0] for p in clean_outer]
        ys = [p[1] for p in clean_outer]
        water_polys.append({
            "y": round(water_y, 2),
            "bbox": (min(xs), max(xs), min(ys), max(ys)),
            "outer": clean_outer,
            "holes": holes
        })

    # ------------------------------------------------------------------
    # 2. Extract & Clip Green / Park Polygons
    # ------------------------------------------------------------------
    green_polys = []
    seen_green = set()
    for rings in atlas.get("green", []):
        if not rings or len(rings[0]) < 3:
            continue
        outer = sutherland_hodgman_clip(
            [to_en(p) for p in rings[0]],
            -HALF_EXTENT_TERRAIN_M, HALF_EXTENT_TERRAIN_M,
            -HALF_EXTENT_TERRAIN_M, HALF_EXTENT_TERRAIN_M
        )
        if len(outer) < 3 or poly_area(outer) < 350.0:
            continue
        clean_outer = []
        for p in outer:
            rp = (round(p[0], 1), round(p[1], 1))
            if not clean_outer or math.hypot(rp[0] - clean_outer[-1][0], rp[1] - clean_outer[-1][1]) > 1.2:
                clean_outer.append(rp)
        if len(clean_outer) < 3 or poly_area(clean_outer) < 350.0:
            continue
        cx = round(sum(p[0] for p in clean_outer) / len(clean_outer), 0)
        cy = round(sum(p[1] for p in clean_outer) / len(clean_outer), 0)
        area_r = round(poly_area(clean_outer), -1)
        if (cx, cy, area_r) in seen_green:
            continue
        seen_green.add((cx, cy, area_r))
        xs = [p[0] for p in clean_outer]
        ys = [p[1] for p in clean_outer]
        green_polys.append({
            "bbox": (min(xs), max(xs), min(ys), max(ys)),
            "outer": clean_outer
        })

    # ------------------------------------------------------------------
    # 3. Build 65 x 65 Blended Real DEM Terrain Grid [-2200, +2200]
    # ------------------------------------------------------------------
    t = atlas["terrain"]
    wb = t["bounds"]
    tw = wb[1][0] - wb[0][0]
    td = wb[1][1] - wb[0][1]
    tnx, tnz = t["nx"], t["nz"]
    theights = t["heights"]
    tgreen = t.get("green")

    def sample_raw_dem(east_m, north_m):
        x = ax + east_m / scale_x
        z = az - north_m / scale_z
        gx = max(0.0, min(tnx - 1e-5, (x - wb[0][0]) / tw * tnx))
        gz = max(0.0, min(tnz - 1e-5, (z - wb[0][1]) / td * tnz))
        ix, iz = int(gx), int(gz)
        a, b = gx - ix, gz - iz
        i = iz * (tnx + 1) + ix
        val = (theights[i] * (1.0 - a) + theights[i + 1] * a) * (1.0 - b) + (theights[i + tnx + 1] * (1.0 - a) + theights[i + tnx + 2] * a) * b
        gval = 0
        if tgreen:
            gval = round((tgreen[i] * (1.0 - a) + tgreen[i + 1] * a) * (1.0 - b) + (tgreen[i + tnx + 1] * (1.0 - a) + tgreen[i + tnx + 2] * a) * b)
        return val, gval

    # Authoritative local elevation pins (~0.9-1.2m below egress paths/slabs so
    # terrain sits cleanly under Hanyang Bldg 212 (0.0m), all stairs/ramps, & Stadium (-13.5m)).
    pins = [
        (52.0, 74.0, -0.95, 115.0),
        (74.0, 42.0, -1.25, 85.0),     # 1F SE exit & bridge transition
        (-95.0, 210.0, -2.1, 105.0),
        (-35.0, -75.0, -6.2, 105.0),
        (65.0, -65.0, -6.4, 95.0),     # Step-free ramp midpoint (-5.0m)
        (118.0, -5.0, -10.4, 90.0),    # Stair 2 bottom (-9.0m)
        (155.0, -57.0, -13.9, 95.0),   # Stair 3 bottom (-12.5m)
        (226.75, -218.17, -14.85, 130.0) # Main Stadium pitch (-13.5m)
    ]

    def terrain_height_at(east_m, north_m):
        dem, gflag = sample_raw_dem(east_m, north_m)
        base_y = (dem - 28.0) * 0.45 - 8.5
        # Additive RBF pin deltas so exact pin centers hit target elevations without zero-weight collapse
        delta_sum = 0.0
        w_sum = 0.0
        for px, pn, target_y, sig in pins:
            dem_p, _ = sample_raw_dem(px, pn)
            base_p = (dem_p - 28.0) * 0.45 - 8.5
            need = target_y - base_p
            d2 = (east_m - px) ** 2 + (north_m - pn) ** 2
            wt = math.exp(-d2 / (2.0 * sig * sig))
            delta_sum += wt * need
            w_sum += wt
        if w_sum > 1e-6:
            # Normalize when multiple Gaussian lobes overlap > 1.0
            norm = max(1.0, w_sum)
            base_y += delta_sum / norm
        return base_y, gflag

    grid_heights = []
    grid_green = []
    step = (2.0 * HALF_EXTENT_TERRAIN_M) / GRID_N
    for j in range(GRID_N + 1):
        # j goes from -HALF_EXTENT (South, Three.js Z = +2200) to +HALF_EXTENT (North, Three.js Z = -2200)
        north_m = -HALF_EXTENT_TERRAIN_M + j * step
        for i in range(GRID_N + 1):
            east_m = -HALF_EXTENT_TERRAIN_M + i * step
            h_y, gflag = terrain_height_at(east_m, north_m)

            # Check green polygons for park vertex tinting
            in_green = bool(gflag)
            if not in_green:
                for gp in green_polys:
                    bx0, bx1, by0, by1 = gp["bbox"]
                    if bx0 <= east_m <= bx1 and by0 <= north_m <= by1:
                        if point_in_poly(east_m, north_m, gp["outer"]):
                            in_green = True
                            break

            # Smoothly depress riverbeds inside water polygons + subtle bank chamfer
            for wp in water_polys:
                bx0, bx1, by0, by1 = wp["bbox"]
                if bx0 - 30 <= east_m <= bx1 + 30 and by0 - 30 <= north_m <= by1 + 30:
                    if point_in_poly(east_m, north_m, wp["outer"]) and not any(point_in_poly(east_m, north_m, hr) for hr in wp["holes"]):
                        h_y = min(h_y, wp["y"] - 0.85)
                        break

            grid_heights.append(round(h_y, 2))
            grid_green.append(1 if in_green else 0)

    def sample_grid_height(east_m, north_m):
        gx = max(0.0, min(GRID_N - 1e-6, (east_m + HALF_EXTENT_TERRAIN_M) / (2.0 * HALF_EXTENT_TERRAIN_M) * GRID_N))
        gn = max(0.0, min(GRID_N - 1e-6, (north_m + HALF_EXTENT_TERRAIN_M) / (2.0 * HALF_EXTENT_TERRAIN_M) * GRID_N))
        ix, in_ = int(gx), int(gn)
        a, b = gx - ix, gn - in_
        row = GRID_N + 1
        idx0 = in_ * row + ix
        return (
            (grid_heights[idx0] * (1.0 - a) + grid_heights[idx0 + 1] * a) * (1.0 - b)
            + (grid_heights[idx0 + row] * (1.0 - a) + grid_heights[idx0 + row + 1] * a) * b
        )

    # ------------------------------------------------------------------
    # 4. Extract Real OSM Buildings (OBB) within [-2000, +2000]
    # ------------------------------------------------------------------
    with open(os.path.join(ATLAS_DIR, "buildings.bin"), "rb") as bf:
        raw_bin = bf.read()
    total_cnt = len(raw_bin) // 24
    floats = struct.unpack(f"<{total_cnt * 6}f", raw_bin)

    buildings = []
    seen_bldg = set()
    for i in range(total_cnt):
        bx, bz, bw, bd, ba, bh = floats[i * 6:(i + 1) * 6]
        east_m = (bx - ax) * scale_x
        north_m = -(bz - az) * scale_z
        if abs(east_m) > HALF_EXTENT_BLDG_M or abs(north_m) > HALF_EXTENT_BLDG_M:
            continue
        if is_excluded_campus_footprint(east_m, north_m):
            continue
        w_m = max(4.0, bw * scale_x)
        d_m = max(4.0, bd * scale_z)
        h_m = max(3.5, min(250.0, bh))
        yaw_rad = -ba

        dedup = (round(east_m, 0), round(north_m, 0), round(w_m, 0), round(d_m, 0))
        if dedup in seen_bldg:
            continue
        seen_bldg.add(dedup)

        buildings.append((
            round(east_m, 1),
            round(north_m, 1),
            round(w_m, 1),
            round(d_m, 1),
            round(yaw_rad, 3),
            round(h_m, 1)
        ))

    buildings.sort(key=lambda b: b[5], reverse=True)

    # ------------------------------------------------------------------
    # 5. Extract & Clip Dense Road & Rail Polylines [-2180, +2180]
    # ------------------------------------------------------------------
    road_segments = []
    road_bound = HALF_EXTENT_TERRAIN_M - 10.0
    for cls, bridge, path in atlas.get("roads", []):
        pts_en = [to_en(p) for p in path]
        chains = clip_polyline(pts_en, -road_bound, road_bound, -road_bound, road_bound)
        for ch in chains:
            compact_pts = []
            for p in ch:
                rp = [round(p[0], 1), round(p[1], 1)]
                if not compact_pts or math.hypot(rp[0] - compact_pts[-1][0], rp[1] - compact_pts[-1][1]) >= 1.5 or p is ch[-1]:
                    compact_pts.append(rp)
            if len(compact_pts) >= 2:
                # [cls, bridge, [[e, n], ...]]
                road_segments.append([cls, int(bridge), compact_pts])

    # ------------------------------------------------------------------
    # 6. Serialize Clean ESM Payload File
    # ------------------------------------------------------------------
    flat_buildings = []
    for b in buildings:
        flat_buildings.extend(b)

    compact_water = [
        {
            "y": wp["y"],
            "outer": [[p[0], p[1]] for p in wp["outer"]],
            **({"holes": [[[p[0], p[1]] for p in hr] for hr in wp["holes"]]} if wp["holes"] else {})
        }
        for wp in water_polys
    ]
    compact_green = [
        [[p[0], p[1]] for p in gp["outer"]]
        for gp in green_polys
    ]

    payload_header = """// ============================================================================
// SEISMOLIVE v4.0 — Real OSM + Mapzen DEM 4km Seongdong/Hanyang Payload
// File: js/response/HanyangRealSpatialPayload.js
//
// Auto-generated by scripts/build_hanyang_real_spatial_data.py
// Coordinate frame: Local Tangent ENU meters anchored at HANYANG_BLDG212_ANCHOR
//   lat: 37.555815, lon: 127.045053
//   Three.js X = +east_m, Y = elevationY, Z = -north_m
// ============================================================================
"""

    js_lines = [
        payload_header,
        f"export const REAL_TERRAIN_GRID = Object.freeze({json.dumps({'nx': GRID_N, 'nz': GRID_N, 'halfExtentMeters': HALF_EXTENT_TERRAIN_M, 'heights': grid_heights, 'greenMask': grid_green}, separators=(',', ':'))});\n",
        f"export const REAL_WATER_POLYGONS = Object.freeze({json.dumps(compact_water, separators=(',', ':'))});\n",
        f"export const REAL_GREEN_POLYGONS = Object.freeze({json.dumps(compact_green, separators=(',', ':'))});\n",
        f"export const REAL_DENSE_ROADS = Object.freeze({json.dumps(road_segments, separators=(',', ':'))});\n",
        f"export const REAL_OSM_BUILDINGS_FLAT = {json.dumps(flat_buildings, separators=(',', ':'))};\n"
    ]

    with open(OUT_PAYLOAD_JS, "w", encoding="utf-8") as out_f:
        out_f.write("\n".join(js_lines))

    size_kb = os.path.getsize(OUT_PAYLOAD_JS) / 1024.0
    print(f"Wrote {OUT_PAYLOAD_JS} ({size_kb:.1f} KB)")
    print(f"  Buildings: {len(buildings)} OBBs")
    print(f"  Roads/Rail chains: {len(road_segments)}")
    print(f"  Water polygons: {len(compact_water)}")
    print(f"  Green polygons: {len(compact_green)}")
    print(f"  Terrain height at Bldg 212 (52,74): {sample_grid_height(52.0, 74.0):.2f}m")
    print(f"  Terrain height at Stadium (226.75,-218.17): {sample_grid_height(226.75, -218.17):.2f}m")


if __name__ == "__main__":
    main()
