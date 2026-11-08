"""Bake OpenStreetMap data (Yeouido, Seoul) into themed SVG map files + a road route."""
import json, math, heapq, sys, os

SRC = sys.argv[1]          # osm dir
OUT = sys.argv[2]          # landing assets dir

LON0, LON1, LAT0, LAT1 = 126.900, 126.955, 37.512, 37.537
W = 1600
H = round(W * (LAT1 - LAT0) / ((LON1 - LON0) * math.cos(math.radians((LAT0 + LAT1) / 2))))
PAD = 30

def proj(lat, lon):
    return ((lon - LON0) / (LON1 - LON0) * W, (LAT1 - lat) / (LAT1 - LAT0) * H)

def rdp(pts, eps):
    if len(pts) < 3:
        return pts
    (x1, y1), (x2, y2) = pts[0], pts[-1]
    dx, dy = x2 - x1, y2 - y1
    n = math.hypot(dx, dy) or 1e-9
    imax, dmax = 0, 0
    for i in range(1, len(pts) - 1):
        x, y = pts[i]
        d = abs(dy * x - dx * y + x2 * y1 - y2 * x1) / n if n > 1e-9 else math.hypot(x - x1, y - y1)
        if d > dmax:
            imax, dmax = i, d
    if dmax > eps:
        return rdp(pts[: imax + 1], eps)[:-1] + rdp(pts[imax:], eps)
    return [pts[0], pts[-1]]

def clip_poly(pts):
    """Sutherland-Hodgman against the padded viewport."""
    xmin, ymin, xmax, ymax = -PAD, -PAD, W + PAD, H + PAD
    edges = [
        (lambda p: p[0] >= xmin, lambda a, b: (xmin, a[1] + (b[1] - a[1]) * (xmin - a[0]) / (b[0] - a[0]))),
        (lambda p: p[0] <= xmax, lambda a, b: (xmax, a[1] + (b[1] - a[1]) * (xmax - a[0]) / (b[0] - a[0]))),
        (lambda p: p[1] >= ymin, lambda a, b: (a[0] + (b[0] - a[0]) * (ymin - a[1]) / (b[1] - a[1]), ymin)),
        (lambda p: p[1] <= ymax, lambda a, b: (a[0] + (b[0] - a[0]) * (ymax - a[1]) / (b[1] - a[1]), ymax)),
    ]
    out = pts
    for inside, inter in edges:
        if not out:
            break
        src, out = out, []
        for i, cur in enumerate(src):
            prev = src[i - 1]
            if inside(cur):
                if not inside(prev):
                    out.append(inter(prev, cur))
                out.append(cur)
            elif inside(prev):
                out.append(inter(prev, cur))
    return out

def fmt(p):
    return f"{p[0]:.0f} {p[1]:.0f}"

def poly_d(pts):
    pts = rdp(pts, 0.7)
    if len(pts) < 3:
        return ""
    return "M" + "L".join(fmt(p) for p in pts) + "Z"

def line_d(pts):
    pts = rdp(pts, 0.6)
    if len(pts) < 2:
        return ""
    return "M" + "L".join(fmt(p) for p in pts)

def stitch(ways):
    """Join open ways sharing endpoints into rings."""
    key = lambda p: (round(p[0], 7), round(p[1], 7))
    ways = [list(w) for w in ways if len(w) >= 2]
    rings = []
    while ways:
        ring = ways.pop()
        changed = True
        while changed and key(ring[0]) != key(ring[-1]):
            changed = False
            for i, w in enumerate(ways):
                if key(w[0]) == key(ring[-1]):
                    ring += w[1:]
                elif key(w[-1]) == key(ring[-1]):
                    ring += w[::-1][1:]
                elif key(w[-1]) == key(ring[0]):
                    ring = w[:-1] + ring
                elif key(w[0]) == key(ring[0]):
                    ring = w[::-1][:-1] + ring
                else:
                    continue
                ways.pop(i)
                changed = True
                break
        rings.append(ring)
    return rings

def geom(g):
    return [(n["lat"], n["lon"]) for n in g if n]

# ---------- areas ----------
water_d, park_d = [], []
wdata = json.load(open(os.path.join(SRC, "water.json")))
for e in wdata["elements"]:
    t = e.get("tags", {})
    target = water_d if t.get("natural") == "water" else park_d
    if e["type"] == "way":
        g = geom(e.get("geometry", []))
        if len(g) > 2:
            target.append(poly_d(clip_poly([proj(*p) for p in g])))
    elif t.get("natural") == "water":
        for role in ("outer", "inner"):
            ws = [geom(m.get("geometry") or []) for m in e["members"] if m["type"] == "way" and m["role"] == role]
            for ring in stitch(ws):
                closed = round(ring[0][0], 7) == round(ring[-1][0], 7) and round(ring[0][1], 7) == round(ring[-1][1], 7)
                if len(ring) > 2 and closed:
                    target.append(poly_d(clip_poly([proj(*p) for p in ring])))

data = json.load(open(os.path.join(SRC, "y.json")))
bld_d = []
roads = {}
CLS = {
    "motorway": "major", "trunk": "major", "primary": "primary", "secondary": "secondary",
    "tertiary": "tertiary", "unclassified": "minor", "residential": "minor", "living_street": "minor",
    "motorway_link": "link", "trunk_link": "link", "primary_link": "link", "secondary_link": "link",
    "tertiary_link": "link", "service": "service",
}
graph = {}
coords = {}
WEIGHT = {"major": 1.0, "primary": 1.0, "secondary": 1.05, "tertiary": 1.25, "minor": 1.8, "link": 1.1}

for e in data["elements"]:
    if e["type"] != "way":
        continue
    t = e.get("tags", {})
    if "building" in t:
        g = geom(e.get("geometry", []))
        if len(g) > 3:
            bld_d.append(poly_d([proj(*p) for p in g]))
        continue
    hw = t.get("highway")
    if hw not in CLS:
        continue
    cls = CLS[hw]
    if t.get("tunnel") in ("yes", "building_passage"):
        continue
    # split on missing nodes (clipped geometry)
    seg = []
    for n in e.get("geometry", []):
        if n:
            seg.append(proj(n["lat"], n["lon"]))
        elif seg:
            roads.setdefault(cls, []).append(line_d(seg)); seg = []
    if seg:
        roads.setdefault(cls, []).append(line_d(seg))
    # routing graph
    if cls == "service":
        continue
    ow = t.get("oneway")
    nodes, gm = e.get("nodes", []), e.get("geometry", [])
    for (a, ga), (b, gb) in zip(zip(nodes, gm), zip(nodes[1:], gm[1:])):
        if not ga or not gb:
            continue
        pa, pb = proj(ga["lat"], ga["lon"]), proj(gb["lat"], gb["lon"])
        coords[a], coords[b] = pa, pb
        w = math.dist(pa, pb) * WEIGHT[cls]
        graph.setdefault(a, []).append((b, w))
        graph.setdefault(b, []).append((a, w))

def nearest(pt):
    return min((n for n in coords if n in graph), key=lambda n: math.dist(coords[n], pt))

def route(a, b):
    dist, prev, pq = {a: 0}, {}, [(0, a)]
    while pq:
        d, u = heapq.heappop(pq)
        if u == b:
            break
        if d > dist.get(u, 1e18):
            continue
        for v, w in graph.get(u, []):
            nd = d + w
            if nd < dist.get(v, 1e18):
                dist[v], prev[v] = nd, u
                heapq.heappush(pq, (nd, v))
    path = [b]
    while path[-1] != a:
        path.append(prev[path[-1]])
    return [coords[n] for n in reversed(path)]

start = nearest(proj(float(sys.argv[3]), float(sys.argv[4])))
end = nearest(proj(float(sys.argv[5]), float(sys.argv[6])))
rpts = rdp(route(start, end), 0.8)
route_d = "M" + "L".join(f"{x:.1f} {y:.1f}" for x, y in rpts)

# ---------- write themed SVGs ----------
THEMES = {
    "dark": dict(land="#06110d", water="#0a1c1d", park="#0a1913", bld="#0c1914", service="#0e1b16", minor="#13221c",
                 tertiary="#182a23", secondary="#1d3029", primary="#22372e", major="#273d33", link="#1d3029"),
    "light": dict(land="#e3e5e1", water="#d2d9d6", park="#d9ded6", bld="#d8dbd5", service="#e8eae6", minor="#eef0ec",
                  tertiary="#f2f3f0", secondary="#f5f6f3", primary="#f8f9f7", major="#fbfcfa", link="#f5f6f3"),
}
WIDTH = dict(service=0.8, minor=1.4, link=1.8, tertiary=2.4, secondary=3.2, primary=4.2, major=5.6)
ORDER = ["service", "minor", "link", "tertiary", "secondary", "primary", "major"]

for name, c in THEMES.items():
    parts = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="{W}" height="{H}">', f'<rect width="{W}" height="{H}" fill="{c["land"]}"/>']
    parts.append(f'<path fill="{c["park"]}" d="{"".join(park_d)}"/>')
    parts.append(f'<path fill="{c["water"]}" fill-rule="evenodd" d="{"".join(water_d)}"/>')
    parts.append(f'<path fill="{c["bld"]}" d="{"".join(bld_d)}"/>')
    for cls in ORDER:
        if cls in roads:
            parts.append(f'<path fill="none" stroke="{c[cls]}" stroke-width="{WIDTH[cls]}" stroke-linecap="round" stroke-linejoin="round" d="{"".join(roads[cls])}"/>')
    parts.append("</svg>")
    with open(os.path.join(OUT, f"map-{name}.svg"), "w") as f:
        f.write("".join(parts))

json.dump({"w": W, "h": H, "route": route_d, "start": rpts[0], "end": rpts[-1], "points": len(rpts)}, sys.stdout)
