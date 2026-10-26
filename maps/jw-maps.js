/*! jw-maps 1.0 · James Wild & Co. house map system
 * One base style, four plates: atlas (destination), estate (stays), chart (voyages), survey (overland).
 * Runs on MapLibre GL (or Mapbox GL, same API). No tile provider needed: each destination ships its own
 * base.geojson + relief.webp built by tools/build_destination.py.
 *
 *   JWMaps.atlas(el, { destination, stays, departures, routes, title, sub })
 *   JWMaps.stay(el,  { destination, stay, nearby, others, residence })
 *   JWMaps.itinerary(el, route, { daysEl, playEl, accent })   // route.type: "voyage" | "overland"; accent optional
 *
 * Route format (jw-route v1): see tools/ROUTE_FORMAT.md
 */
(function (root) {
  "use strict";
  var ML = root.maplibregl || root.mapboxgl;
  var CFG = { base: "/maps/data/", dataInline: null };
  var C = {
    sea: "#EEF2EE", seaInk: "#7E9BA3", linen: "#E9E3D3", linenAlt: "#DFDCD3", ink: "#1E2A30", grat: "#CFD8D4",
    reef: "#2AA9B8", hole: "#0E4A63", stays: "#3E4A3A", voyages: "#1F5673", overland: "#8A6B3F", sheet: "#FBF8F1", border: "#9C9282",
    marks: { know: "#3E4A3A", keep: "#1E2A30", who: "#6F7A5E", soon: "#8C7B5A", dove: "#0E4A63", walked: "#3E4A3A", host: "#6F7A5E", sight: "#9C9282" }
  };
  var MARKS = { know: "I know a place", keep: "I keep going back", who: "I know who knows", soon: "I'll know soon", dove: "I dove it", walked: "I've walked it", host: "I know the host" };
  var RM = root.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  var PHONE = root.matchMedia && matchMedia("(max-width:600px)").matches;

  /* ---------- small helpers ---------- */
  function fc(f) { return { type: "FeatureCollection", features: f || [] }; }
  function line(c, p) { return { type: "Feature", properties: p || {}, geometry: { type: "LineString", coordinates: c } }; }
  function pt(c, p) { return { type: "Feature", properties: p || {}, geometry: { type: "Point", coordinates: c } }; }
  function mk(cls, html) { var d = document.createElement("div"); d.className = cls; if (html) d.innerHTML = html; return d; }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function dms(v, p, n, w) { var h = v >= 0 ? p : n; v = Math.abs(v); var d = Math.floor(v), m = Math.round((v - d) * 60); if (m === 60) { d++; m = 0; } return String(d).padStart(w, "0") + "°" + String(m).padStart(2, "0") + "′" + h; }
  function hav(a, b) { var R = 6371, dl = (b[1] - a[1]) * Math.PI / 180, dg = (b[0] - a[0]) * Math.PI / 180; var x = Math.pow(Math.sin(dl / 2), 2) + Math.cos(a[1] * Math.PI / 180) * Math.cos(b[1] * Math.PI / 180) * Math.pow(Math.sin(dg / 2), 2); return 2 * R * Math.asin(Math.sqrt(x)); }
  function bearing(a, b) { var r = Math.PI / 180, y = Math.sin((b[0] - a[0]) * r) * Math.cos(b[1] * r), x = Math.cos(a[1] * r) * Math.sin(b[1] * r) - Math.sin(a[1] * r) * Math.cos(b[1] * r) * Math.cos((b[0] - a[0]) * r); return Math.atan2(y, x) / r; }
  function ease(t) { return t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; }
  function circle(c, km) { var r = []; for (var i = 0; i <= 64; i++) { var t = i / 64 * 2 * Math.PI; r.push([c[0] + km / (111.32 * Math.cos(c[1] * Math.PI / 180)) * Math.cos(t), c[1] + km / 110.57 * Math.sin(t)]); } return r; }
  function grat(b, step) { var f = [], x, y; for (x = Math.ceil(b[0] / step) * step; x <= b[2]; x += step) f.push(line([[x, b[1]], [x, b[3]]])); for (y = Math.ceil(b[1] / step) * step; y <= b[3]; y += step) f.push(line([[b[0], y], [b[2], y]])); return fc(f); }
  function boundsOf(pts) { var b = new ML.LngLatBounds(pts[0], pts[0]); pts.forEach(function (p) { b.extend(p); }); return b; }
  function hatch() { var c = document.createElement("canvas"); c.width = 24; c.height = 10; var x = c.getContext("2d"); x.strokeStyle = "rgba(126,155,163,.38)"; x.lineWidth = 1; x.beginPath(); x.moveTo(2, 5.5); x.lineTo(13, 5.5); x.stroke(); return x.getImageData(0, 0, 24, 10); }

  /* ---------- destination data ---------- */
  var cache = {};
  function loadDestination(slug) {
    if (cache[slug]) return cache[slug];
    var inl = CFG.dataInline && CFG.dataInline[slug];
    if (inl) return (cache[slug] = Promise.resolve(inl));
    var b = CFG.base + slug + "/";
    return (cache[slug] = Promise.all([fetch(b + "meta.json").then(function (r) { return r.json(); }), fetch(b + "base.geojson").then(function (r) { return r.json(); })])
      .then(function (a) { a[0].relief.url = b + a[0].relief.url; return { meta: a[0], base: a[1] }; }));
  }

  /* ---------- the base map: one look for every plate ---------- */
  function baseMap(el, o) {
    el = typeof el === "string" ? document.getElementById(el) : el;
    var map = new ML.Map({
      container: el, style: { version: 8, sources: {}, layers: [{ id: "bg", type: "background", paint: { "background-color": C.sea } }] },
      bounds: o.bounds, fitBoundsOptions: { padding: o.pad || 30 }, maxBounds: o.maxBounds, attributionControl: false, cooperativeGestures: PHONE,
      dragRotate: false, pitchWithRotate: false, maxZoom: o.maxZoom || 13, minZoom: o.minZoom || 3, renderWorldCopies: !!o.worldCopies
    });
    map.touchZoomRotate.disableRotation();
    map.addControl(new ML.NavigationControl({ showCompass: false }), "bottom-right");
    map.addControl(new ML.FullscreenControl(), "bottom-right");
    var ready = loadDestination(o.destination).then(function (d) {
      return new Promise(function (res) {
        var go = function () {
          var meta = d.meta, b = meta.bbox, home = o.home !== false;
          map.addControl(new ML.AttributionControl({ compact: true, customAttribution: meta.attribution }), o.attrib || "bottom-left");
          map.addImage("jw-hatch", hatch());
          map.addSource("jw-base", { type: "geojson", data: d.base });
          map.addSource("jw-relief", { type: "image", url: meta.relief.url, coordinates: meta.relief.coordinates });
          var pad = (o.wide || o.world) ? 40 : 2, hp = (o.wide || o.world) ? 60 : 5;   // sea, grid and world land run past the data frame when the map can zoom out   // region maps: sea, grid and world land run past the data frame
          map.addSource("jw-grat", { type: "geojson", data: grat([b[0] - pad, Math.max(b[1] - pad, -80), b[2] + pad, Math.min(b[3] + pad, 84)], o.gstep || (b[2] - b[0] > 40 ? 10 : b[2] - b[0] > 8 ? 2 : b[2] - b[0] > 3 ? .5 : .25)) });
          map.addSource("jw-world", { type: "geojson", data: fc([{ type: "Feature", properties: {}, geometry: { type: "Polygon", coordinates: [[[b[0] - hp, Math.max(b[1] - hp, -85)], [b[2] + hp, Math.max(b[1] - hp, -85)], [b[2] + hp, Math.min(b[3] + hp, 85)], [b[0] - hp, Math.min(b[3] + hp, 85)], [b[0] - hp, Math.max(b[1] - hp, -85)]]] } }]) });
          if (o.world) map.addSource("jw-wland", { type: "geojson", data: (CFG.dataInline && CFG.dataInline.__world) || CFG.base + "world.geojson" });   // inline copy for offline previews
          var L = function (id) { return ["==", ["get", "layer"], id]; };
          var LH = o.wide ? ["all", L("land"), ["==", ["get", "home"], true]] : L("land");   // region maps outline only the region's own countries
          map.addLayer({ id: "jw-seahatch", type: "fill", source: "jw-world", paint: { "fill-pattern": "jw-hatch", "fill-opacity": .9 } });
          map.addLayer({ id: "jw-grat", type: "line", source: "jw-grat", paint: { "line-color": C.grat, "line-width": .6 } });
          if (o.world) { map.addLayer({ id: "jw-wland", type: "fill", source: "jw-wland", paint: { "fill-color": C.linenAlt, "fill-opacity": .85 } });
            map.addLayer({ id: "jw-wcoast", type: "line", source: "jw-wland", paint: { "line-color": C.ink, "line-width": .5, "line-opacity": .45 } }); }
          map.addLayer({ id: "jw-depth", type: "line", source: "jw-base", filter: L("depth"), paint: { "line-color": C.seaInk, "line-width": ["interpolate", ["linear"], ["get", "m"], 200, 1.1, 4000, .6], "line-opacity": ["interpolate", ["linear"], ["get", "m"], 200, .75, 4000, .35], "line-dasharray": [4, 2.5] } });
          [[18, .07], [10, .13], [4, .28]].forEach(function (w, i) { map.addLayer({ id: "jw-halo" + i, type: "line", source: "jw-base", filter: LH, paint: { "line-color": C.seaInk, "line-width": ["interpolate", ["linear"], ["zoom"], 5, w[0] * .6, 10, w[0] * 1.4], "line-blur": w[0] * .5, "line-opacity": w[1] } }); });
          map.addLayer({ id: "jw-land", type: "fill", source: "jw-base", filter: L("land"), paint: { "fill-color": home ? ["case", ["==", ["get", "home"], true], C.linen, C.linenAlt] : C.linen } });
          map.addLayer({ id: "jw-relief", type: "raster", source: "jw-relief", paint: { "raster-opacity": 1, "raster-fade-duration": 0, "raster-resampling": "linear" } });
          map.addLayer({ id: "jw-lake", type: "fill", source: "jw-base", filter: L("lake"), paint: { "fill-color": C.sea, "fill-outline-color": o.wide ? C.sea : C.seaInk } });
          map.addLayer({ id: "jw-river", type: "line", source: "jw-base", filter: L("river"), paint: { "line-color": C.seaInk, "line-width": ["interpolate", ["linear"], ["zoom"], 6, .7, 11, 1.6], "line-opacity": .8 } });
          map.addLayer({ id: "jw-reef", type: "line", source: "jw-base", filter: L("reef"), layout: { "line-cap": "round" }, paint: { "line-color": C.reef, "line-width": 1.8, "line-dasharray": [.2, 2] } });
          map.addLayer({ id: "jw-coast", type: "line", source: "jw-base", filter: LH, paint: { "line-color": C.ink, "line-width": ["interpolate", ["linear"], ["zoom"], 5, .6, 11, 1.3], "line-opacity": .85 } });
          map.addLayer({ id: "jw-border", type: "line", source: "jw-base", filter: o.wide ? ["==", "x", "y"] : ["all", L("land"), ["!=", ["get", "home"], true]], paint: { "line-color": C.border, "line-width": .8, "line-dasharray": [3, 2] } });
          (o.places || []).forEach(function (p) { new ML.Marker({ element: mk("jw-place" + (p.big ? " big" : ""), esc(p.n)), anchor: "center" }).setLngLat(p.c).addTo(map); });
          if (o.coordEl) { var ce = typeof o.coordEl === "string" ? document.getElementById(o.coordEl) : o.coordEl; var upd = function () { var c = map.getCenter(); ce.textContent = dms(c.lat, "N", "S", 2) + " " + dms(c.lng, "E", "W", 3); }; map.on("move", upd); upd(); }
          res({ map: map, data: d });
        };
        if (map.loaded()) go(); else map.on("load", go);
      });
    });
    return ready;
  }

  /* ---------- markers ---------- */
  function pin(map, s, opt) {
    opt = opt || {};
    var e = mk("jw-pin " + (s.mark || "soon"), "<i></i>" + (opt.label === false ? "" : '<span class="jw-lb' + (s.labelUp ? " up" : "") + (s.labelLeft ? " left" : "") + '">' + esc(s.name) + "</span>"));
    e.setAttribute("role", s.url ? "link" : "img"); e.setAttribute("aria-label", s.name + (s.mark && MARKS[s.mark] ? " · " + MARKS[s.mark] : ""));
    if (s.url) { e.tabIndex = 0; e.addEventListener("click", function () { location.href = s.url; }); e.addEventListener("keydown", function (ev) { if (ev.key === "Enter") location.href = s.url; }); }
    return new ML.Marker({ element: e, anchor: "center" }).setLngLat(s.c || [s.lng, s.lat]).addTo(map);
  }
  var ANCHOR = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 2v11M5 5h6M3 9c0 3 2.5 4.5 5 4.5S13 12 13 9" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>';
  function dep(map, d) {
    var e = mk("jw-dep", ANCHOR + '<span class="jw-lb' + (d.labelLeft ? " left" : "") + '">' + esc(d.name) + "</span>"); e.setAttribute("aria-label", "Departs from " + d.name);
    return new ML.Marker({ element: e, anchor: "center" }).setLngLat(d.c || [d.lng, d.lat]).addTo(map);
  }
  var ICON = {
    sea: function (a) { return '<svg viewBox="0 0 30 30" style="transform:rotate(' + (a - 90) + 'deg)"><path d="M4 15 L20 10 L27 15 L20 20 Z" fill="#1F5673" stroke="#FBF8F1" stroke-width="1.5"/><path d="M11 15h7" stroke="#FBF8F1" stroke-width="1.4"/></svg>'; },
    land: function () { return '<svg viewBox="0 0 30 30"><circle cx="15" cy="15" r="9" fill="#FBF8F1" stroke="#1F5673" stroke-width="2"/><circle cx="15" cy="15" r="3.5" fill="#1F5673"/></svg>'; },
    walk: function () { return '<svg viewBox="0 0 30 30"><circle cx="15" cy="15" r="9" fill="#FBF8F1" stroke="#8A6B3F" stroke-width="2"/><circle cx="15" cy="15" r="3.5" fill="#8A6B3F"/></svg>'; },
    road: function () { return '<svg viewBox="0 0 30 30"><rect x="5" y="9" width="20" height="12" rx="3" fill="#8A6B3F" stroke="#FBF8F1" stroke-width="1.5"/><rect x="8" y="11.5" width="6" height="4" fill="#FBF8F1"/><rect x="16" y="11.5" width="6" height="4" fill="#FBF8F1"/><circle cx="10" cy="22" r="2.4" fill="#1E2A30"/><circle cx="20" cy="22" r="2.4" fill="#1E2A30"/></svg>'; },
    rail: function () { return '<svg viewBox="0 0 30 30"><rect x="7" y="6" width="16" height="16" rx="3" fill="#8A6B3F" stroke="#FBF8F1" stroke-width="1.5"/><rect x="10" y="9" width="10" height="6" fill="#FBF8F1"/><path d="M9 26l3-4M21 26l-3-4" stroke="#1E2A30" stroke-width="2"/></svg>'; },
    boat: function () { return '<svg viewBox="0 0 30 30"><path d="M4 16 h22 l-4 7 h-14 z" fill="#8A6B3F" stroke="#FBF8F1" stroke-width="1.5"/><path d="M12 16 V8 h7 l-3 8" fill="#FBF8F1" stroke="#8A6B3F" stroke-width="1.4"/></svg>'; },
    air: function (a) { return '<svg viewBox="0 0 30 30" style="transform:rotate(' + a + 'deg)"><path d="M15 3 L17 12 L27 17 L27 19 L17 16 L16.5 23 L20 26 L20 27.5 L15 26 L10 27.5 L10 26 L13.5 23 L13 16 L3 19 L3 17 L13 12 Z" fill="#1E2A30" stroke="#FBF8F1" stroke-width="1"/></svg>'; },
    heli: function (a) { return '<svg viewBox="0 0 30 30"><ellipse cx="15" cy="17" rx="7" ry="5" fill="#1E2A30" stroke="#FBF8F1"/><path d="M4 10h22M15 10v3M22 17h6" stroke="#1E2A30" stroke-width="2"/></svg>'; }
  };

  /* ---------- one feature set for every map: stays, vessel launches, reserves, family residences ---------- */
  var TYPES = { stay: "Stays", port: "Vessel launches", reserve: "Reserves", residence: "Family residences" };
  function ftype(s) { return s.type || (s.residence ? "residence" : "stay"); }
  function feature(map, s, opt) {
    var t = ftype(s), c = s.c || [s.lng, s.lat], m;
    if (t === "port") m = dep(map, s);
    else if (t === "residence") {   // house rule: a private house shows a 2 km area, never a pin
      var id = "jw-res-" + Math.random().toString(36).slice(2, 8);
      map.addSource(id, { type: "geojson", data: fc([{ type: "Feature", properties: {}, geometry: { type: "Polygon", coordinates: [circle([c[0] + .006, c[1] - .004], 2)] } }]) });
      map.addLayer({ id: id, type: "fill", source: id, paint: { "fill-color": C.stays, "fill-opacity": .16 } });
      map.addLayer({ id: id + "-e", type: "line", source: id, paint: { "line-color": C.stays, "line-width": 1, "line-blur": 2 } });
      m = new ML.Marker({ element: mk("jw-ring jw-res", esc(s.name) + " · area"), anchor: "bottom" }).setLngLat([c[0], c[1] + .03]).addTo(map);
      m._jwLayers = [id, id + "-e"];
    } else m = pin(map, t === "reserve" ? Object.assign({}, s, { mark: "reserve" }) : s, opt);
    m._jwType = t; return m;
  }
  function toggleType(map, list, t, on) {
    list.forEach(function (m) { if (m._jwType !== t) return; m.getElement().hidden = !on; (m._jwLayers || []).forEach(function (l) { map.setLayoutProperty(l, "visibility", on ? "visible" : "none"); }); });
  }

  /* ---------- plate I · atlas ---------- */
  function atlas(el, o) {
    return baseMap(el, { destination: o.destination, bounds: o.bounds, coordEl: o.coordEl, places: o.places, minZoom: o.minZoom || 5, maxBounds: o.maxBounds, world: o.world, wide: o.wide, worldCopies: o.worldCopies, pad: o.pad }).then(function (r) {
      var map = r.map, out = { map: map, stays: [], departures: [] };
      (o.routes || []).forEach(function (rt, i) {
        var c = rt.stops.filter(function (s) { return s.mode !== "air"; }).map(function (s) { return [s.lng, s.lat]; });
        map.addSource("jw-r" + i, { type: "geojson", data: fc([line(c)]) });
        map.addLayer({ id: "jw-r" + i, type: "line", source: "jw-r" + i, layout: { "line-cap": "round" }, paint: { "line-color": rt.type === "voyage" ? C.voyages : C.overland, "line-width": 2, "line-dasharray": rt.type === "voyage" ? [2, 1.6] : [.5, 2], "line-opacity": .85 } });
      });
      (o.stays || []).forEach(function (s) { out.stays.push(feature(map, s, { label: !PHONE || (o.phoneLabels !== false && (s.mark === "know" || s.mark === "keep")) })); });
      (o.departures || []).forEach(function (d) { out.departures.push(dep(map, d)); });
      (o.highlights || []).forEach(function (h) { pin(map, h); });
      out.toggle = function (what, on) {
        if (TYPES[what]) toggleType(map, out.stays, what, on);
        else if (what === "stays" || what === "departures") out[what].forEach(function (k) { k.getElement().hidden = !on; });
        else if (what === "routes") (o.routes || []).forEach(function (_, i) { map.setLayoutProperty("jw-r" + i, "visibility", on ? "visible" : "none"); });
        else if (what === "reef") map.setLayoutProperty("jw-reef", "visibility", on ? "visible" : "none");
      };
      return out;
    });
  }

  /* ---------- plate II · stays ---------- */
  function stay(el, o) {
    var s = o.stay, c = s.c || [s.lng, s.lat];
    return baseMap(el, { destination: o.destination, bounds: o.steps[0], coordEl: o.coordEl, places: o.places, maxZoom: 14, minZoom: 5, attrib: o.attrib }).then(function (r) {
      var map = r.map, st = { map: map, residence: false };
      map.addSource("jw-estate", { type: "geojson", data: fc([{ type: "Feature", properties: {}, geometry: { type: "Polygon", coordinates: [circle(c, o.estateKm || 1.4)] } }]) });
      map.addSource("jw-area", { type: "geojson", data: fc([{ type: "Feature", properties: {}, geometry: { type: "Polygon", coordinates: [circle([c[0] + .006, c[1] - .004], 2)] } }]) });
      map.addLayer({ id: "jw-estate", type: "fill", source: "jw-estate", minzoom: 10, paint: { "fill-color": C.stays, "fill-opacity": .07 } });
      map.addLayer({ id: "jw-estate-edge", type: "line", source: "jw-estate", minzoom: 10, paint: { "line-color": C.stays, "line-width": 1.2, "line-dasharray": [2, 2] } });
      map.addLayer({ id: "jw-area", type: "fill", source: "jw-area", layout: { visibility: "none" }, paint: { "fill-color": C.stays, "fill-opacity": .16 } });
      map.addLayer({ id: "jw-area-edge", type: "line", source: "jw-area", layout: { visibility: "none" }, paint: { "line-color": C.stays, "line-width": 1, "line-blur": 2 } });
      st.ring = new ML.Marker({ element: mk("jw-ring", esc(o.ringLabel || "Private reserve (approximate)")), anchor: "bottom" }).setLngLat([c[0], c[1] + (o.estateKm || 1.4) / 110.57 + .002]).addTo(map);
      (o.others || []).forEach(function (x) { pin(map, x); });
      st.pin = pin(map, s);
      (o.nearby || []).forEach(function (x) { var e = mk("jw-pin sight", "<i></i>" + '<span class="jw-lb small">' + esc(x.name) + "</span>"); new ML.Marker({ element: e, anchor: "center" }).setLngLat(x.c || [x.lng, x.lat]).addTo(map); });
      st.step = function (i) { var b = o.steps[i]; if (b.center) map.flyTo({ center: b.center, zoom: b.zoom, duration: RM ? 0 : 1800, curve: 1.6 }); else map.fitBounds(b, { padding: 40, duration: RM ? 0 : 1600 }); };
      st.setResidence = function (on) {
        st.residence = on; st.pin.getElement().hidden = on; st.ring.getElement().hidden = on;
        ["jw-area", "jw-area-edge"].forEach(function (l) { map.setLayoutProperty(l, "visibility", on ? "visible" : "none"); });
        ["jw-estate", "jw-estate-edge"].forEach(function (l) { map.setLayoutProperty(l, "visibility", on ? "none" : "visible"); });
      };
      if (o.residence) st.setResidence(true);
      return st;
    });
  }

  /* ---------- plates III & IV · itineraries ---------- */
  function itinerary(el, route, o) {
    o = o || {};
    var voyage = route.type === "voyage", acc = o.accent || route.accent || (voyage ? C.voyages : C.overland);   // optional destination accent
    var stops = route.stops.map(function (s) { return Object.assign({ c: [s.lng, s.lat] }, s); });
    var legs = stops.slice(1).map(function (s, i) { var p = s.path && s.path.length > 1 ? s.path : [stops[i].c, s.c]; var km = 0; for (var k = 1; k < p.length; k++) km += hav(p[k - 1], p[k]); return { path: p, mode: s.mode || (voyage ? "sea" : "road"), km: km }; });
    var days = []; stops.forEach(function (s) { if (days.indexOf(s.day) < 0) days.push(s.day); });
    var all = stops.map(function (s) { return s.c; }).concat([].concat.apply([], legs.map(function (l) { return l.path; })));
    var fullB = route.bounds || boundsOf(stops.filter(function (s) { return !s.offmap; }).map(function (s) { return s.c; })).toArray();
    var state = { progress: 0, playing: false, raf: 0 }, dayBtns = {}, wps = [];
    function at(path, t) { if (path.length === 2) return [path[0][0] + (path[1][0] - path[0][0]) * t, path[0][1] + (path[1][1] - path[0][1]) * t]; var tot = 0, d = [0]; for (var i = 1; i < path.length; i++) { tot += hav(path[i - 1], path[i]); d.push(tot); } var g = t * tot; for (i = 1; i < path.length; i++) if (d[i] >= g) { var f = (g - d[i - 1]) / Math.max(d[i] - d[i - 1], 1e-9); return [path[i - 1][0] + (path[i][0] - path[i - 1][0]) * f, path[i - 1][1] + (path[i][1] - path[i - 1][1]) * f]; } return path[path.length - 1]; }
    function partial(path, t) { if (t <= 0) return [path[0]]; if (t >= 1) return path.slice(); var tot = 0, d = [0], i; for (i = 1; i < path.length; i++) { tot += hav(path[i - 1], path[i]); d.push(tot); } var g = t * tot, out = [path[0]]; for (i = 1; i < path.length; i++) { if (d[i] < g) out.push(path[i]); else break; } out.push(at(path, t)); return out; }
    return baseMap(el, { destination: route.destination, bounds: fullB, coordEl: o.coordEl, places: o.places, maxZoom: o.maxZoom || 13, minZoom: o.minZoom || 5, world: o.world }).then(function (r) {
      var map = r.map;
      if (o.world) {   // zoomed out to the region: fade the country's detailed relief and depth so its data frame never shows as a box
        var mb = r.data.meta.bbox, zc = map.cameraForBounds([[mb[0], mb[1]], [mb[2], mb[3]]]).zoom;
        map.setPaintProperty("jw-relief", "raster-opacity", ["interpolate", ["linear"], ["zoom"], zc - 1.4, 0, zc - .4, 1]);
        map.setPaintProperty("jw-depth", "line-opacity", ["interpolate", ["linear"], ["zoom"], zc - 1.4, 0, zc - .4, .6]);
      }
      map.addSource("jw-ghost", { type: "geojson", data: fc(legs.map(function (l) { return line(l.path, { mode: l.mode }); })) });
      map.addSource("jw-live", { type: "geojson", data: fc() });
      map.addLayer({ id: "jw-ghost", type: "line", source: "jw-ghost", layout: { "line-cap": "round" }, paint: { "line-color": acc, "line-opacity": .45, "line-width": 1.6, "line-dasharray": [.1, 2.4] } });
      map.addLayer({ id: "jw-live", type: "line", source: "jw-live", layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": acc, "line-width": 2.6, "line-dasharray": voyage ? [2.2, 1.4] : [.6, 1.6] } });
      var num = 0;   // number labelled stops only, so a nolabel waypoint never leaves a gap
      stops.forEach(function (s, i) {
        if (s.nolabel || s.offmap) { wps.push(null); return; }
        var lab = num === 0 ? "●" : String(num); num++;
        var e = mk("jw-wp" + (s.kind === "port" ? " port" : ""), lab + '<span class="jw-lb">' + esc(s.name) + "</span>"); e.style.setProperty("--acc", acc); e.title = s.name; e.setAttribute("aria-label", "Day " + s.day + ": " + s.name);
        new ML.Marker({ element: e, anchor: "center" }).setLngLat(s.c).addTo(map); wps.push(e);
      });
      var veh = new ML.Marker({ element: mk("jw-veh"), anchor: "center" }).setLngLat(stops[0].c).addTo(map), lastIcon = "";
      var ctx = (o.context || []).map(function (x) { return feature(map, x, { label: !PHONE }); });   // stays, launches, reserves, residences nearby
      var rose = mk("jw-compass", '<svg viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="27" class="r"/><path d="M32 7v6M32 51v6M7 32h6M51 32h6" class="t"/><text x="32" y="5.6" class="n">N</text>' +
        '<g class="ndl"><path d="M32 13 L36 32 L32 29 L28 32 Z" class="h"/><path d="M32 51 L36 32 L32 35 L28 32 Z" class="b"/></g><circle cx="32" cy="32" r="2.4" class="h"/></svg><span class="hd">N</span>');
      rose.setAttribute("aria-hidden", "true"); map.getContainer().appendChild(rose);
      var needle = rose.querySelector(".ndl"), hdg = rose.querySelector(".hd"), PTS = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"], roseT = 0;
      function draw(p) {
        state.progress = p; var L = Math.floor(p), done = [], head, mode, ang;
        legs.forEach(function (l, i) { if (i < L) done.push(line(l.path)); });
        if (L < legs.length) { var l = legs[L], t = ease(p - L); done.push(line(partial(l.path, t))); head = at(l.path, t); mode = l.mode; var nx = at(l.path, Math.min(1, t + .02)); ang = bearing(head, nx); }
        else { var z = legs[legs.length - 1]; head = z.path[z.path.length - 1]; mode = z.mode; ang = bearing(z.path[z.path.length - 2], head); }
        map.getSource("jw-live").setData(fc(done)); veh.setLngLat(head);
        if (isFinite(ang)) { var a360 = (ang + 360) % 360; needle.style.transform = "rotate(" + a360 + "deg)"; hdg.textContent = PTS[Math.round(a360 / 45) % 8] + " " + Math.round(a360) + "°"; }
        var key = mode + Math.round(ang / 5); if (key !== lastIcon) { veh.getElement().innerHTML = (ICON[mode] || ICON.road)(ang); lastIcon = key; }
        wps.forEach(function (e, i) { if (e) e.classList.toggle("on", i <= Math.floor(p + .02)); });
      }
      function markDay(d) { Object.keys(dayBtns).forEach(function (k) { dayBtns[k].setAttribute("aria-pressed", String(+k === d)); }); wps.forEach(function (e, i) { if (e) e.classList.toggle("show", stops[i].day === d); }); }
      function setDay(d, fly) {
        markDay(d); var idx = []; stops.forEach(function (s, i) { if (s.day === d) idx.push(i); }); var last = idx[idx.length - 1];
        var pts = idx.map(function (i) { return stops[i].c; }); if (idx[0] > 0) pts.push(stops[idx[0] - 1].c);
        draw(last);
        if (fly) map.fitBounds(boundsOf(pts), { padding: PHONE ? 60 : 110, maxZoom: o.dayMaxZoom || 10, duration: RM ? 0 : 1400 });
      }
      function stop() { state.playing = false; cancelAnimationFrame(state.raf); clearTimeout(roseT); roseT = setTimeout(function () { rose.classList.remove("on"); }, 2500); if (o.playEl) { o.playEl.setAttribute("aria-pressed", "false"); o.playEl.textContent = o.playLabel || (voyage ? "Play voyage" : "Play journey"); } }
      function play() {
        if (state.playing) return stop();
        state.playing = true; clearTimeout(roseT); rose.classList.add("on"); if (o.playEl) { o.playEl.setAttribute("aria-pressed", "true"); o.playEl.textContent = "Pause"; }
        if (state.progress >= legs.length - .001) state.progress = 0;
        map.fitBounds(fullB, { padding: 30, duration: RM ? 0 : 900 });
        if (RM) { draw(legs.length); return stop(); }
        var last = performance.now(), per = o.perLeg || 1200;
        var tick = function (now) { var p = state.progress + (now - last) / per; last = now; if (p >= legs.length) { draw(legs.length); return stop(); } draw(p); markDay(stops[Math.min(Math.ceil(p), stops.length - 1)].day); state.raf = requestAnimationFrame(tick); };
        state.raf = requestAnimationFrame(tick);
      }
      if (o.daysEl) days.forEach(function (d) {
        var b = document.createElement("button"); b.type = "button"; b.className = "jw-day"; b.setAttribute("aria-pressed", "false"); b.style.setProperty("--acc", acc);
        b.innerHTML = "<b>DAY " + String(d).padStart(2, "0") + "</b><span>" + esc((route.days || {})[d] || "") + "</span>";
        b.addEventListener("click", function () { stop(); setDay(d, true); }); o.daysEl.appendChild(b); dayBtns[d] = b;
      });
      if (o.playEl) o.playEl.addEventListener("click", play);
      draw(RM ? legs.length : 0); setDay(days[0], false);
      if (!RM && o.autoplay !== false && "IntersectionObserver" in root) { var io = new IntersectionObserver(function (es) { if (es[0].isIntersecting) { io.disconnect(); setTimeout(play, 500); } }, { threshold: .5 }); io.observe(map.getContainer()); }
      return { map: map, play: play, stop: stop, setDay: setDay, bounds: fullB, context: ctx, toggle: function (t, on) { toggleType(map, ctx, t, on); } };
    });
  }

  /* ---------- text twins for search and AI answers ---------- */
  function itineraryHTML(route) {
    var by = {}; route.stops.forEach(function (s) { (by[s.day] = by[s.day] || []).push(s); });
    return '<ol class="jw-itin">' + Object.keys(by).map(function (d) { return "<li><b>Day " + d + (route.days && route.days[d] ? " · " + esc(route.days[d]) : "") + ".</b> " + by[d].filter(function (s) { return !s.nolabel; }).map(function (s) { return esc(s.name); }).join(", ") + ".</li>"; }).join("") + "</ol>";
  }
  function jsonLD(route, url) {
    return { "@context": "https://schema.org", "@type": "TouristTrip", name: route.title, description: route.subtitle, url: url, provider: { "@type": "TravelAgency", name: "James Wild & Co." },
      itinerary: { "@type": "ItemList", itemListElement: route.stops.filter(function (s) { return !s.nolabel; }).map(function (s, i) { return { "@type": "ListItem", position: i + 1, item: { "@type": "Place", name: s.name, geo: { "@type": "GeoCoordinates", latitude: s.lat, longitude: s.lng } } }; }) } };
  }

  root.JWMaps = { types: TYPES, featureType: ftype, config: function (o) { Object.assign(CFG, o); return CFG; }, colors: C, marks: MARKS, atlas: atlas, stay: stay, itinerary: itinerary, itineraryHTML: itineraryHTML, jsonLD: jsonLD, loadDestination: loadDestination };
})(typeof window !== "undefined" ? window : this);
