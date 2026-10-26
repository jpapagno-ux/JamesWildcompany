#!/usr/bin/env python3
"""Build the map data for one destination in the James Wild & Co. house style.

Usage:  python3 build_destination.py <slug>            (slug from DESTINATIONS below)
        python3 build_destination.py all

Writes maps/data/<slug>/:
  base.geojson   countries (home flagged), lakes, rivers, reefs, depth contours — one FeatureCollection,
                 every feature carries a "layer" property: land | lake | river | reef | depth
  relief.webp    shading overlay in Web Mercator: land shadows in ink, sea depth in Voyages blue
  meta.json      bbox, relief corner coordinates, default view, attribution
Sources (all free): Natural Earth 1:10m (public domain); NASA Blue Marble shaded relief & bathymetry
(public domain, tiles via the @freetiler/nasa-bluemarble package).
"""
import json, math, os, sys
import numpy as np
from PIL import Image, ImageDraw, ImageFilter
from shapely.geometry import shape, box, mapping
from shapely.ops import unary_union

HERE = os.path.dirname(os.path.abspath(__file__))
# source data (Natural Earth, Blue Marble tiles, shaded relief) stays outside the repo: set JW_MAPS_SRC
SRC = os.environ.get("JW_MAPS_SRC", os.path.join(HERE, "src"))
OUT = os.path.join(HERE, "..", "data")

DESTINATIONS = {
    # slug: (name, bbox [w,s,e,n], home countries, relief zoom)
    "belize":     ("Belize", [-91.4, 14.8, -85.6, 19.4], ["Belize"], 7),
    "galapagos":  ("Galápagos", [-92.3, -1.9, -88.9, 0.9], ["Ecuador"], 7),
    "costa-rica": ("Costa Rica", [-86.3, 7.8, -82.3, 11.4], ["Costa Rica"], 7),
    "iceland":    ("Iceland", [-25.2, 62.8, -12.6, 67.2], ["Iceland"], 6),
    "greenland":  ("Greenland", [-75.0, 58.5, -14.0, 79.5], ["Greenland"], 5),
    "indonesia":  ("Raja Ampat, Komodo & Bali", [113.8, -10.6, 135.2, 1.2], ["Indonesia"], 6),
    "raja-ampat": ("Raja Ampat", [129.4, -2.6, 132.1, 0.8], ["Indonesia"], 7),
    "southern-africa": ("South Africa & Botswana", [10.0, -36.5, 40.0, -15.0], ["South Africa", "Botswana"], 6),
    "kenya":      ("Kenya", [33.4, -5.2, 42.2, 5.4], ["Kenya"], 6),
    "riviera-nayarit": ("Riviera Nayarit", [-106.6, 19.4, -104.2, 22.0], ["Mexico"], 7),
}
INK = (74, 63, 51)        # land shadow ink
HI = (251, 248, 241)      # land highlight
SEA = (31, 86, 115)       # Voyages blue for depth


def merc(lon, lat, z):
    n = 256 * 2 ** z
    x = (lon + 180) / 360 * n
    s = math.sin(math.radians(max(min(lat, 85.05), -85.05)))
    y = (0.5 - math.log((1 + s) / (1 - s)) / (4 * math.pi)) * n
    return x, y


def load(name):
    with open(os.path.join(SRC, "ne", name + ".geojson")) as f:
        return json.load(f)["features"]


def rnd(geom, nd=4):
    def r(c):
        if isinstance(c[0], (int, float)):
            return [round(c[0], nd), round(c[1], nd)]
        return [r(x) for x in c]
    g = mapping(geom)
    return {"type": g["type"], "coordinates": r(g["coordinates"])}


def clip_features(feats, bb, tol, layer, props=None, as_lines=False, minlen=0.0):
    out = []
    for f in feats:
        try:
            g = shape(f["geometry"])
        except Exception:
            continue
        if not g.is_valid:
            g = g.buffer(0)
        if not g.intersects(bb):
            continue
        g = g.intersection(bb)
        if g.geom_type in ("Polygon", "MultiPolygon"):   # drop antimeridian artefacts: thin slivers spanning the whole frame
            bw, bh = bb.bounds[2] - bb.bounds[0], bb.bounds[3] - bb.bounds[1]
            parts = [p for p in (g.geoms if g.geom_type == "MultiPolygon" else [g]) if not ((p.bounds[2] - p.bounds[0]) > .95 * bw and (p.bounds[3] - p.bounds[1]) < .06 * bh)]
            if not parts:
                continue
            g = unary_union(parts)
        if as_lines and g.geom_type in ("Polygon", "MultiPolygon"):
            g = g.boundary.intersection(bb.buffer(-1e-6))
        g = g.simplify(tol, preserve_topology=True)
        if g.is_empty or (minlen and g.length < minlen):
            continue
        p = {"layer": layer}
        if props:
            p.update(props(f))
        out.append({"type": "Feature", "properties": p, "geometry": rnd(g)})
    return out


_SR = None
def shaded_relief(bbox, W, H, z, x0, y0, x1, y1):
    """Sample the Natural Earth-derived shaded relief (2 arc-min, equirectangular) into the Mercator frame."""
    global _SR
    if _SR is None:
        Image.MAX_IMAGE_PIXELS = None
        im = Image.open(os.path.join(SRC, "relief", "shadedrelief.jpg")).convert("RGB")
        a = np.asarray(im, dtype=np.float32)
        _SR = 0.299 * a[..., 0] + 0.587 * a[..., 1] + 0.114 * a[..., 2]
    Hs, Ws = _SR.shape
    xs = x0 + (np.arange(W) + .5) * (x1 - x0) / W
    ys = y0 + (np.arange(H) + .5) * (y1 - y0) / H
    n = 256 * 2 ** z
    lon = xs / n * 360 - 180
    lat = np.degrees(np.arctan(np.sinh(np.pi * (1 - 2 * ys / n))))
    sx = (lon + 180) / 360 * Ws - .5
    sy = (90 - lat) / 180 * Hs - .5
    X, Y = np.meshgrid(sx, sy)
    xi, yi = np.floor(X).astype(int), np.floor(Y).astype(int)
    fx, fy = X - xi, Y - yi
    xi = np.clip(xi, 0, Ws - 2); yi = np.clip(yi, 0, Hs - 2)
    v = (_SR[yi, xi] * (1 - fx) * (1 - fy) + _SR[yi, xi + 1] * fx * (1 - fy) + _SR[yi + 1, xi] * (1 - fx) * fy + _SR[yi + 1, xi + 1] * fx * fy)
    return v


def relief(bbox, z, land_geoms):
    w, s, e, n = bbox
    x0, y0 = merc(w, n, z)
    x1, y1 = merc(e, s, z)
    tx0, ty0, tx1, ty1 = int(x0 // 256), int(y0 // 256), int(x1 // 256), int(y1 // 256)
    mosaic = Image.new("RGB", ((tx1 - tx0 + 1) * 256, (ty1 - ty0 + 1) * 256))
    for tx in range(tx0, tx1 + 1):
        for ty in range(ty0, ty1 + 1):
            p = os.path.join(SRC, "bm", "package", "tiles", str(z), str(tx), f"{ty}.jpeg")
            if not os.path.exists(p):   # a few tiles are missing in the package: borrow the neighbour above
                p = os.path.join(SRC, "bm", "package", "tiles", str(z), str(tx), f"{ty - 1}.jpeg")
            if os.path.exists(p):
                mosaic.paste(Image.open(p).convert("RGB"), ((tx - tx0) * 256, (ty - ty0) * 256))
    crop = (int(x0 - tx0 * 256), int(y0 - ty0 * 256), int(x1 - tx0 * 256), int(y1 - ty0 * 256))
    img = mosaic.crop(crop)
    # upsample 2x for smoother edges when zoomed in
    up = 2 if img.width < 900 else 1
    img = img.resize((img.width * up, img.height * up), Image.BICUBIC)
    W, H = img.size
    # land mask from Natural Earth polygons, drawn in the same Mercator frame
    mask = Image.new("L", (W, H), 0)
    d = ImageDraw.Draw(mask)
    sx, sy = W / (x1 - x0), H / (y1 - y0)

    def px(c):
        mx, my = merc(c[0], c[1], z)
        return ((mx - x0) * sx, (my - y0) * sy)

    for g in land_geoms:
        polys = [g] if g.geom_type == "Polygon" else list(getattr(g, "geoms", []))
        for p in polys:
            if p.geom_type != "Polygon":
                continue
            d.polygon([px(c) for c in p.exterior.coords], fill=255)
            for hole in p.interiors:
                d.polygon([px(c) for c in hole.coords], fill=0)
    m = np.asarray(mask.filter(ImageFilter.GaussianBlur(1.2)), dtype=np.float32) / 255
    a = np.asarray(img, dtype=np.float32)
    L = 0.299 * a[..., 0] + 0.587 * a[..., 1] + 0.114 * a[..., 2]
    Li = Image.fromarray(L.astype(np.uint8))
    blur = np.asarray(Li.filter(ImageFilter.GaussianBlur(16)), dtype=np.float32)
    # land relief from the shaded-relief raster (relief only, no vegetation colour)
    R = shaded_relief(bbox, W, H, z, x0, y0, x1, y1)
    def nblur(arr, r):   # blur over land only, so the coast doesn't print a dark band
        A = Image.fromarray(np.clip(arr * m, 0, 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(r))
        M = Image.fromarray((m * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(r))
        return np.asarray(A, np.float32) / np.maximum(np.asarray(M, np.float32) / 255, .02)
    ratio = W / ((e - w) * 30)            # output pixels per source pixel (source is 2 arc-min)
    rs = nblur(R, max(1.2, ratio * .9))
    rb = nblur(R, max(8, ratio * 6, W / 22))
    hp = rs - rb
    k = float(np.clip(1.6 / ratio, .38, 1))   # soften when we are magnifying the coarse source
    shadow = np.clip(-hp / 42, 0, 1) * 0.5 * k
    light = np.clip(hp / 46, 0, 1) * 0.2 * k
    # sea: darker Blue Marble = deeper water
    deep = np.clip((150 - blur) / 110, 0, 1) ** 1.3 * 0.30
    rgba = np.zeros((H, W, 4), dtype=np.float32)
    land_rgb = np.where((shadow >= light)[..., None], np.array(INK, np.float32), np.array(HI, np.float32))
    land_a = np.maximum(shadow, light)
    rgba[..., :3] = land_rgb * m[..., None] + np.array(SEA, np.float32) * (1 - m[..., None])
    rgba[..., 3] = (land_a * m + deep * (1 - m)) * 255
    out = Image.fromarray(np.clip(rgba, 0, 255).astype(np.uint8), "RGBA")
    corners = [[w, n], [e, n], [e, s], [w, s]]
    return out, corners


def build(slug):
    name, bbox, home, z = DESTINATIONS[slug]
    bb = box(*bbox)
    span = max(bbox[2] - bbox[0], bbox[3] - bbox[1])
    tol = span / 4000
    feats = []
    countries = load("countries10m")
    land_feats = clip_features(countries, bb, tol, "land", lambda f: {"name": f["properties"]["name"], "home": f["properties"]["name"] in home})
    feats += land_feats
    feats += clip_features(load("ne_10m_minor_islands"), bb, tol, "land", lambda f: {"name": "", "home": True})
    feats += clip_features(load("ne_10m_lakes"), bb, tol, "lake", lambda f: {"name": f["properties"].get("name") or ""})
    feats += clip_features(load("ne_10m_rivers_lake_centerlines"), bb, tol, "river", lambda f: {"name": f["properties"].get("name") or ""}, minlen=span / 60)
    feats += clip_features(load("ne_10m_reefs"), bb, tol, "reef")
    for fn, depth in [("ne_10m_bathymetry_K_200", 200), ("ne_10m_bathymetry_J_1000", 1000), ("ne_10m_bathymetry_I_2000", 2000),
                      ("ne_10m_bathymetry_H_3000", 3000), ("ne_10m_bathymetry_G_4000", 4000)]:
        feats += clip_features(load(fn), bb, tol * 1.5, "depth", lambda f, d=depth: {"m": d}, as_lines=True, minlen=span / 40)
    os.makedirs(os.path.join(OUT, slug), exist_ok=True)
    with open(os.path.join(OUT, slug, "base.geojson"), "w") as f:
        json.dump({"type": "FeatureCollection", "features": feats}, f, separators=(",", ":"), ensure_ascii=False)
    land_geoms = [shape(f["geometry"]) for f in feats if f["properties"]["layer"] == "land"]
    img, corners = relief(bbox, z, land_geoms)
    img.save(os.path.join(OUT, slug, "relief.webp"), "WEBP", quality=70, method=6)
    meta = {"slug": slug, "name": name, "bbox": bbox, "relief": {"url": "relief.webp", "coordinates": corners, "size": list(img.size)},
            "attribution": "Land and depth: Natural Earth · Relief: NASA Earth Observatory via FreeTiler"}
    with open(os.path.join(OUT, slug, "meta.json"), "w") as f:
        json.dump(meta, f, ensure_ascii=False, indent=1)
    sz = lambda p: os.path.getsize(os.path.join(OUT, slug, p)) // 1024
    counts = {}
    for f in feats:
        counts[f["properties"]["layer"]] = counts.get(f["properties"]["layer"], 0) + 1
    print(f"{slug:11s} base {sz('base.geojson')} KB · relief {img.size[0]}x{img.size[1]} {sz('relief.webp')} KB · {counts}")


if __name__ == "__main__":
    targets = list(DESTINATIONS) if sys.argv[1:] == ["all"] else sys.argv[1:]
    for s in targets:
        build(s)
