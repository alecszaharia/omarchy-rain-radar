"""Extract, clip and simplify the Cloud Radar basemap from Natural Earth 50m.

Natural Earth is public domain, which permits redistribution — the plugin
bundles the result so rendering never touches the network.
"""
import json, math, sys

# A margin beyond the sampling bounds so outlines reach the edge of the map
# area cleanly instead of stopping short of it.
MARGIN = 0.6
MIN_LON, MAX_LON = 19.86 - MARGIN, 37.86 + MARGIN
MIN_LAT, MAX_LAT = 41.0 - MARGIN, 53.0 + MARGIN

# Douglas-Peucker tolerance in degrees. The map is 18 degrees across a popup
# roughly 480 px wide, i.e. ~0.0375 deg/px, so 0.01 deg stays well under a
# pixel. Moldova gets a finer tolerance because it is the emphasized region and
# is small enough that coarse simplification would visibly distort it.
TOLERANCE = 0.012
TOLERANCE_EMPHASIS = 0.004

# Rings smaller than this (in square degrees) are dropped: at popup size they
# are sub-pixel specks that only cost bytes.
MIN_RING_AREA = 0.004

COUNTRIES = [
    ("moldova",  "Moldova",  True),
    ("romania",  "Romania",  False),
    ("ukraine",  "Ukraine",  False),
    ("bulgaria", "Bulgaria", False),
    ("hungary",  "Hungary",  False),
    ("slovakia", "Slovakia", False),
    ("poland",   "Poland",   False),
    ("belarus",  "Belarus",  False),
    ("serbia",   "Serbia",   False),
]


def clip(points, inside, intersect):
    """One Sutherland-Hodgman pass against a single half-plane."""
    out = []
    if not points:
        return out
    prev = points[-1]
    prev_in = inside(prev)
    for cur in points:
        cur_in = inside(cur)
        if cur_in:
            if not prev_in:
                out.append(intersect(prev, cur))
            out.append(cur)
        elif prev_in:
            out.append(intersect(prev, cur))
        prev, prev_in = cur, cur_in
    return out


def clip_rect(points):
    def x_at(a, b, x):
        t = (x - a[0]) / (b[0] - a[0])
        return (x, a[1] + t * (b[1] - a[1]))

    def y_at(a, b, y):
        t = (y - a[1]) / (b[1] - a[1])
        return (a[0] + t * (b[0] - a[0]), y)

    points = clip(points, lambda p: p[0] >= MIN_LON, lambda a, b: x_at(a, b, MIN_LON))
    points = clip(points, lambda p: p[0] <= MAX_LON, lambda a, b: x_at(a, b, MAX_LON))
    points = clip(points, lambda p: p[1] >= MIN_LAT, lambda a, b: y_at(a, b, MIN_LAT))
    points = clip(points, lambda p: p[1] <= MAX_LAT, lambda a, b: y_at(a, b, MAX_LAT))
    return points


def perpendicular_distance(p, a, b):
    if a == b:
        return math.hypot(p[0] - a[0], p[1] - a[1])
    dx, dy = b[0] - a[0], b[1] - a[1]
    return abs(dy * p[0] - dx * p[1] + b[0] * a[1] - b[1] * a[0]) / math.hypot(dx, dy)


def simplify(points, tolerance):
    if len(points) < 3:
        return points
    keep = [False] * len(points)
    keep[0] = keep[-1] = True
    stack = [(0, len(points) - 1)]
    while stack:
        first, last = stack.pop()
        worst, worst_i = 0.0, -1
        for i in range(first + 1, last):
            d = perpendicular_distance(points[i], points[first], points[last])
            if d > worst:
                worst, worst_i = d, i
        if worst > tolerance:
            keep[worst_i] = True
            stack.append((first, worst_i))
            stack.append((worst_i, last))
    return [p for p, k in zip(points, keep) if k]


def ring_area(points):
    total = 0.0
    for i in range(len(points)):
        x1, y1 = points[i]
        x2, y2 = points[(i + 1) % len(points)]
        total += x1 * y2 - x2 * y1
    return abs(total) / 2.0


def polygons_of(geometry):
    kind, coords = geometry["type"], geometry["coordinates"]
    if kind == "Polygon":
        return [coords]
    if kind == "MultiPolygon":
        return coords
    raise ValueError(kind)


def extract(geometry, tolerance):
    rings = []
    for polygon in polygons_of(geometry):
        # Outer ring only: interior holes are invisible at this scale and the
        # renderer strokes outlines rather than filling with even-odd rules.
        outer = [tuple(p[:2]) for p in polygon[0]]
        clipped = clip_rect(outer)
        if len(clipped) < 4:
            continue
        if ring_area(clipped) < MIN_RING_AREA:
            continue
        reduced = simplify(clipped, tolerance)
        if len(reduced) < 4:
            continue
        flat = []
        for lon, lat in reduced:
            flat.append(round(lon, 3))
            flat.append(round(lat, 3))
        rings.append(flat)
    return rings


def main():
    countries = json.load(open(sys.argv[1]))
    marine = json.load(open(sys.argv[2]))

    by_name = {}
    for feature in countries["features"]:
        props = feature["properties"]
        for key in ("NAME", "ADMIN", "NAME_EN", "SOVEREIGNT"):
            value = props.get(key)
            if value:
                by_name.setdefault(value, feature)

    regions = []
    for region_id, name, emphasis in COUNTRIES:
        feature = by_name.get(name)
        if feature is None:
            raise SystemExit("missing country in Natural Earth: " + name)
        rings = extract(feature["geometry"], TOLERANCE_EMPHASIS if emphasis else TOLERANCE)
        if not rings:
            raise SystemExit("no geometry left after clipping: " + name)
        regions.append({"id": region_id, "name": name, "kind": "country",
                        "emphasis": emphasis, "rings": rings})

    black_sea = next((f for f in marine["features"]
                      if f["properties"].get("name") == "Black Sea"), None)
    if black_sea is None:
        raise SystemExit("Black Sea not found in the marine polygons")
    rings = extract(black_sea["geometry"], TOLERANCE)
    if not rings:
        raise SystemExit("no Black Sea geometry left after clipping")
    regions.append({"id": "black-sea", "name": "Black Sea", "kind": "water",
                    "emphasis": False, "rings": rings})

    out = {
        "attribution": {
            "source": "Natural Earth",
            "dataset": "ne_50m_admin_0_countries, ne_50m_geography_marine_polys",
            "url": "https://www.naturalearthdata.com/",
            "license": "Public domain",
            "licenseUrl": "https://www.naturalearthdata.com/about/terms-of-use/",
            "redistributionPermitted": True,
            "note": ("Natural Earth places its vector data in the public domain, which permits "
                     "redistribution. Outlines here are clipped to the Cloud Radar bounds and "
                     "simplified; they are a schematic basemap, not a survey reference.")
        },
        "bounds": {"minLon": MIN_LON, "maxLon": MAX_LON, "minLat": MIN_LAT, "maxLat": MAX_LAT},
        "regions": regions,
    }
    # Emitted as a QML .js resource rather than JSON: the QML engine loads it
    # as part of the compilation unit, so rendering needs no file read and no
    # network request of any kind.
    with open(sys.argv[3], "w") as handle:
        handle.write("// GENERATED by tools/build-outlines.py -- do not edit by hand.\n")
        handle.write("// Source: Natural Earth 50m (public domain). See the attribution block below.\n")
        handle.write("var OUTLINES = ")
        json.dump(out, handle, separators=(",", ":"))
        handle.write("\n")

    total = sum(len(r) // 2 for region in regions for r in region["rings"])
    print("regions: %d, rings: %d, vertices: %d"
          % (len(regions), sum(len(r["rings"]) for r in regions), total))


main()
