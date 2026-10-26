#!/usr/bin/env python3
"""Convert itinerary files into the jw-route v1 format used by jw-maps.

    python3 convert_route.py <input> [--destination belize] [--type voyage|overland] [--title "..."] [--out routes/]

Reads:
  .gpx      waypoints (wpt or rtept) become stops; a track (trk) becomes the leg paths between them
  .kml      Point placemarks become stops; LineString placemarks become leg paths
  .csv      columns: day,name,lat,lng[,mode][,time][,note]   (header row required)
  .geojson  Point features (properties: day, name, mode) and optional LineString features
  .html     a Voyages site page with window.CHART (all its routes are exported)
Days: taken from a "day" field or from a "Day 3 · ..." prefix in the name; otherwise numbered in order.
Modes: sea, land, walk, road, boat, rail, air, heli.
"""
import argparse, csv, json, math, os, re, sys, xml.etree.ElementTree as ET

MODES = {"s": "sea", "w": "sea", "l": "land", "f": "walk", "a": "air", "h": "heli", "sea": "sea", "boat": "boat", "ship": "sea", "cruise": "sea",
         "road": "road", "drive": "road", "car": "road", "land": "land", "walk": "walk", "hike": "walk", "foot": "walk", "rail": "rail", "train": "rail",
         "air": "air", "fly": "air", "flight": "air", "plane": "air", "heli": "heli", "helicopter": "heli"}


def hav(a, b):
    R = 6371
    dl, dg = math.radians(b[1] - a[1]), math.radians(b[0] - a[0])
    x = math.sin(dl / 2) ** 2 + math.cos(math.radians(a[1])) * math.cos(math.radians(b[1])) * math.sin(dg / 2) ** 2
    return 2 * R * math.asin(math.sqrt(x))


def day_of(name, fallback):
    m = re.match(r"\s*day\s*(\d+)\s*[·:\-–—]?\s*(.*)", name or "", re.I)
    return (int(m.group(1)), m.group(2) or name) if m else (fallback, name)


def attach_paths(stops, lines):
    """Cut a long track into one path per leg, by nearest track point to each stop."""
    track = [p for ln in lines for p in ln]
    if len(track) < 3:
        return stops
    idx = []
    start = 0
    for s in stops:
        c = [s["lng"], s["lat"]]
        best = min(range(start, len(track)), key=lambda i: hav(track[i], c))
        idx.append(best)
        start = best
    for k in range(1, len(stops)):
        seg = track[idx[k - 1]: idx[k] + 1]
        if len(seg) > 2:
            stops[k]["path"] = [[round(x, 5), round(y, 5)] for x, y in seg]
    return stops


def from_gpx(p):
    ns = {"g": "http://www.topografix.com/GPX/1/1"}
    t = ET.parse(p).getroot()
    q = lambda tag: t.findall(".//g:" + tag, ns) or t.findall(".//" + tag)
    pts = q("wpt") or q("rtept")
    stops = []
    for i, w in enumerate(pts):
        nm = (w.findtext("g:name", default="", namespaces=ns) or w.findtext("name") or f"Stop {i + 1}").strip()
        d, nm = day_of(nm, i + 1)
        typ = (w.findtext("g:type", default="", namespaces=ns) or w.findtext("type") or "").lower()
        stops.append({"day": d, "name": nm, "lat": float(w.get("lat")), "lng": float(w.get("lon")), "mode": MODES.get(typ)})
    lines = [[[float(x.get("lon")), float(x.get("lat"))] for x in seg.findall("g:trkpt", ns) or seg.findall("trkpt")] for seg in (t.findall(".//g:trkseg", ns) or t.findall(".//trkseg"))]
    return attach_paths(stops, lines)


def from_kml(p):
    t = ET.parse(p).getroot()
    ns = {"k": t.tag.split("}")[0].strip("{")} if "}" in t.tag else {"k": ""}
    f = lambda e, tag: e.findall(".//k:" + tag, ns) if ns["k"] else e.findall(".//" + tag)
    stops, lines = [], []
    for i, pm in enumerate(f(t, "Placemark")):
        nm = (pm.findtext("k:name", default="", namespaces=ns) if ns["k"] else pm.findtext("name")) or f"Stop {i + 1}"
        for pt in f(pm, "Point"):
            lng, lat = map(float, (pt.findtext("k:coordinates", namespaces=ns) if ns["k"] else pt.findtext("coordinates")).strip().split(",")[:2])
            d, nm2 = day_of(nm.strip(), len(stops) + 1)
            stops.append({"day": d, "name": nm2, "lat": lat, "lng": lng})
        for ls in f(pm, "LineString"):
            txt = ls.findtext("k:coordinates", namespaces=ns) if ns["k"] else ls.findtext("coordinates")
            lines.append([list(map(float, c.split(",")[:2])) for c in txt.split()])
    return attach_paths(stops, lines)


def from_csv(p):
    stops = []
    with open(p, newline="", encoding="utf-8-sig") as fh:
        for i, r in enumerate(csv.DictReader(fh)):
            r = {k.strip().lower(): (v or "").strip() for k, v in r.items()}
            lat = float(r.get("lat") or r.get("latitude"))
            lng = float(r.get("lng") or r.get("lon") or r.get("longitude"))
            d, nm = day_of(r.get("name", ""), int(r["day"]) if r.get("day") else i + 1)
            if r.get("day"):
                d = int(r["day"])
            s = {"day": d, "name": nm, "lat": lat, "lng": lng}
            if r.get("mode"):
                s["mode"] = MODES.get(r["mode"].lower(), r["mode"].lower())
            for k in ("time", "note"):
                if r.get(k):
                    s[k] = r[k]
            stops.append(s)
    return stops


def from_geojson(p):
    g = json.load(open(p))
    stops, lines = [], []
    for i, f in enumerate(g.get("features", [])):
        geo, pr = f["geometry"], f.get("properties") or {}
        if geo["type"] == "Point":
            d, nm = day_of(pr.get("name", f"Stop {i + 1}"), pr.get("day") or len(stops) + 1)
            stops.append({"day": int(pr.get("day") or d), "name": nm, "lng": geo["coordinates"][0], "lat": geo["coordinates"][1], "mode": MODES.get(str(pr.get("mode", "")).lower())})
        elif geo["type"] == "LineString":
            lines.append(geo["coordinates"])
    return attach_paths(stops, lines)


def from_site_chart(p, destination):
    s = open(p, encoding="utf-8").read()
    i = s.find("window.CHART=")
    obj, _ = json.JSONDecoder().raw_decode(s[i + len("window.CHART="):])
    out = []
    for k, r in obj["routes"].items():
        stops = []
        for w in r["wp"]:
            if w.get("nf"):
                continue                      # off-map legs (e.g. the flight from Guayaquil) are described in text
            st = {"day": w["d"], "name": w["n"], "lat": w["c"][0], "lng": w["c"][1]}
            if w.get("m"):
                st["mode"] = MODES.get(w["m"], "sea")
            if w.get("t"):
                st["time"] = w["t"]
            if w.get("k") == "strip":
                st["kind"] = "airstrip"
            stops.append(st)
        out.append({"id": slug(r["title"]), "type": "voyage", "destination": destination, "title": r["title"].split(" · ", 1)[-1],
                    "subtitle": r.get("sub", ""), "code": k, "days": {str(a): b for a, b in r.get("dt", {}).items()}, "stops": stops})
    return out


def slug(t):
    return re.sub(r"[^a-z0-9]+", "-", t.lower().replace("·", " ")).strip("-")


def finish(stops, a):
    if not stops:
        sys.exit("No stops found.")
    stops[0].pop("mode", None)
    default = "sea" if a.type == "voyage" else "road"
    for s in stops[1:]:
        s["mode"] = s.get("mode") or default
    for s in stops:
        s["lat"], s["lng"] = round(s["lat"], 5), round(s["lng"], 5)
        for k in [k for k, v in s.items() if v is None]:
            s.pop(k)
    days = {}
    for s in stops:
        days.setdefault(str(s["day"]), s["name"])
    return {"id": slug(a.title or os.path.splitext(os.path.basename(a.input))[0]), "type": a.type, "destination": a.destination,
            "title": a.title or os.path.splitext(os.path.basename(a.input))[0], "subtitle": a.subtitle or "", "days": days, "stops": stops}


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("input"); ap.add_argument("--destination", required=True); ap.add_argument("--type", default="overland", choices=["voyage", "overland"])
    ap.add_argument("--title"); ap.add_argument("--subtitle"); ap.add_argument("--out", default="routes")
    a = ap.parse_args()
    os.makedirs(a.out, exist_ok=True)
    ext = os.path.splitext(a.input)[1].lower()
    if ext == ".html":
        routes = from_site_chart(a.input, a.destination)
    else:
        reader = {".gpx": from_gpx, ".kml": from_kml, ".csv": from_csv, ".geojson": from_geojson, ".json": from_geojson}[ext]
        routes = [finish(reader(a.input), a)]
    for r in routes:
        path = os.path.join(a.out, r["id"] + ".json")
        json.dump(r, open(path, "w"), ensure_ascii=False, indent=1)
        print(f"{path}  ·  {len(r['stops'])} stops, {len(r['days'])} days")
