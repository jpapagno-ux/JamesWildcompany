/*! jw-embed 1.0 · drop-in house maps for site pages · James Wild & Co.
 *
 * <link rel="stylesheet" href="/maps/jw-maps.css">          (in <head>: reserves the map's height)
 * <div class="jw-maps jw-site" data-jw-map="stay">          (or "atlas", "region", "country", "itinerary")
 *   <script type="application/json">{ ...config... }</script>
 * </div>
 * <script src="/maps/jw-embed.js" defer></script>
 *
 * MapLibre (about 800 KB) only loads when a map comes within 400 px of the screen,
 * so pages without a map in view stay as fast as before.
 *
 * stay config:  { destination, name, c:[lng,lat], mark, region, label, note,
 *                 country:[[w,s],[e,n]], area:[[w,s],[e,n]], zoom, residence, others:[], nearby:[], places:[] }
 * atlas config: { destination, title, subtitle, bounds:[[w,s],[e,n]], stays:[], places:[] }
 * region config: { destination, region, title, subtitle, bounds, countries, listId, palette: { accent, terrain_key: [[colour, name]…] } }
 * itinerary config (journey and voyage pages): { route: "<id>" | routes: ["<id>", …], destination, kind: "voyage"|"overland", kicker, caption }
 *   Draws the animated chart (jw-chart.js + d3, about 300 KB, loaded on approach). Add "engine": "maplibre" for the
 *   older MapLibre itinerary: { route, accent, region: { name, bounds }, context, autoplay }.
 *   context (default on): every stay, vessel launch, reserve and family residence in the region's feed is drawn too.
 *   Stop cards: any element with data-jw-day="<day>" (and data-jw-for="<map id>") flies the map to that day.
 *   Put the engraved fallback (<figure class="jw-fallback">) inside <div class="jw-frame chart|survey"> in the page HTML:
 *   it shows until the live map has loaded, stays if it can't, and is what search engines and no-JS readers see.
 */
(function () {
  var cur = document.currentScript;
  var BASE = cur && cur.src ? cur.src.replace(/jw-embed\.js[^/]*$/, "") : "/maps/";
  var MARKS = { know: "I know a place", keep: "I keep going back", who: "I know who knows", soon: "I'll know soon", dove: "I dove it", walked: "I've walked it", host: "I know the host" };
  var ready = null;
  var RM = matchMedia("(prefers-reduced-motion: reduce)").matches;

  function css(href) { if (document.querySelector('link[href="' + href + '"]')) return; var l = document.createElement("link"); l.rel = "stylesheet"; l.href = href; document.head.appendChild(l); }
  function js(src) { return new Promise(function (res, rej) { var s = document.createElement("script"); s.src = src; s.onload = res; s.onerror = rej; document.head.appendChild(s); }); }
  function lib() {
    if (!ready) {
      css(BASE + "vendor/maplibre-gl.css"); css(BASE + "jw-maps.css");
      ready = (window.maplibregl ? Promise.resolve() : js(BASE + "vendor/maplibre-gl.js"))
        .then(function () { return window.JWMaps ? 0 : js(BASE + "jw-maps.js"); })
        .then(function () { window.JWMaps.config({ base: BASE + "data/" }); });
    }
    return ready;
  }
  function el(tag, cls, html, attrs) {
    var e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html;
    for (var k in attrs || {}) e.setAttribute(k, attrs[k]); return e;
  }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function pad(c, dx, dy) { return [[c[0] - dx, c[1] - dy], [c[0] + dx, c[1] + dy]]; }

  function stay(root, o) {
    var frame = el("div", "jw-frame estate");
    var map = el("div", "jw-map", null, { role: "region", "aria-label": "Map zooming from the country to the region to " + o.name });
    var cart = el("div", "jw-cart", "<b>" + esc(o.short || o.name) + "</b><small>" + esc(o.region || "") + "</small>");
    var steps = o.residence ? ["Country", "Region", "Area"] : ["Country", "Region", "Property"];
    var ctrl = el("div", "jw-ctrl below-m", null, { role: "group", "aria-label": "Zoom level", style: "left:22px;bottom:22px" });
    var btns = steps.map(function (t, i) { var b = el("button", "jw-btn", t, { type: "button", "aria-pressed": String(i === 2) }); ctrl.appendChild(b); return b; });
    var card = el("div", "jw-card", '<span class="k">' + esc(o.label || MARKS[o.mark] || "") + '</span><span class="n">' + esc(o.name) + "</span>" + (o.note ? "<span>" + esc(o.note) + "</span>" : ""));
    frame.appendChild(map); frame.appendChild(cart); frame.appendChild(ctrl); frame.appendChild(card);
    root.appendChild(frame);
    lib().then(function () {
      var s = { name: o.name, c: o.c, mark: o.mark, labelLeft: o.labelLeft, labelUp: o.labelUp };
      return window.JWMaps.stay(map, {
        destination: o.destination, stay: s, others: o.others || [], nearby: o.nearby || [], places: o.places || [],
        residence: !!o.residence, estateKm: o.estateKm, ringLabel: o.ringLabel,
        steps: [o.country, o.area || pad(o.c, .8, .55), { center: o.c, zoom: o.zoom || (o.residence ? 10 : 10.2) }]
      });
    }).then(function (st) {
      var go = function (i) { btns.forEach(function (b, k) { b.setAttribute("aria-pressed", String(k === i)); }); st.step(i); };
      btns.forEach(function (b, i) { b.addEventListener("click", function () { go(i); }); });
      setTimeout(function () { go(2); }, matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 700);
    }).catch(function () { root.classList.add("jw-failed"); });
  }

  function atlas(root, o) {
    var frame = el("div", "jw-frame atlas");
    var map = el("div", "jw-map", null, { role: "region", "aria-label": "Map of " + (o.title || "the stays") });
    frame.appendChild(map);
    frame.appendChild(el("div", "jw-cart", "<b>" + esc(o.title || "") + "</b><small>" + esc(o.subtitle || "") + "</small>"));
    root.appendChild(frame);
    lib().then(function () {
      return window.JWMaps.atlas(map, { destination: o.destination, bounds: o.bounds, stays: o.stays || [], places: o.places || [], minZoom: o.minZoom || 3, phoneLabels: o.phoneLabels });
    }).catch(function () { root.classList.add("jw-failed"); });
  }


  /* ---------- region: every country in the region, every stay from the one feed ---------- */
  var MARKKEY = { "I know a place": "know", "I keep going back": "keep", "I know the host": "host", "I know who knows": "who", "I'll know soon": "soon", "I dove it": "dove" };
  var feed = null;
  function stays() {   // live from Airtable through /api/stays; the static copy is the fallback
    if (!feed) feed = fetch("/api/stays").then(function (r) { if (!r.ok) throw 0; return r.json(); })
      .catch(function () { return fetch(BASE + "data/stays.json").then(function (r) { return r.json(); }); })
      .then(function (d) { return (d.stays || d).filter(function (s) { return s.show !== false && s.lat != null && s.lng != null; }); });
    return feed;
  }
  window.JWStays = stays;

  function bboxOf(geoms) {
    var b = [180, 90, -180, -90];
    (function walk(c) { if (typeof c[0] === "number") { b[0] = Math.min(b[0], c[0]); b[1] = Math.min(b[1], c[1]); b[2] = Math.max(b[2], c[0]); b[3] = Math.max(b[3], c[1]); } else c.forEach(walk); })(geoms);
    return [[b[0], b[1]], [b[2], b[3]]];
  }

  function region(root, o) {
    var pal = o.palette || null;   // the region's James Wild palette (maps/palettes.json → regions)
    var frame = el("div", "jw-frame atlas jw-region");
    if (pal) {
      root.style.setProperty("--jw-acc", pal.accent);
      frame.appendChild(el("div", "jw-terrain", (pal.terrain_key || []).map(function (k) { return '<i style="background:' + k[0] + '"></i>'; }).join(""), { "aria-hidden": "true", style: "margin-bottom:5px" }));
    }
    var map = el("div", "jw-map", null, { role: "region", "aria-label": "Map of " + o.title + ": every country in the region and the stays James knows" });
    var cart = el("div", "jw-cart", "<b>" + esc(o.title) + "</b><small>" + esc(o.subtitle || "Tap a country to zoom in") + "</small>");
    var back = el("button", "jw-btn jw-back", "&larr; All of " + esc(o.title), { type: "button", hidden: "" });
    var card = el("div", "jw-card", null, { hidden: "", "aria-live": "polite" });
    frame.appendChild(map); frame.appendChild(cart); frame.appendChild(back); frame.appendChild(card);
    root.appendChild(frame);
    var chips = el("div", "jw-chips", null, { role: "group", "aria-label": "Zoom to a country" });
    root.appendChild(chips);
    if (pal && pal.terrain_key) root.appendChild(el("p", "jw-key", '<span>Terrain key</span> · ' + pal.terrain_key.map(function (k) { return esc(k[1]); }).join(" · ")));
    var listEl = o.listId ? document.getElementById(o.listId) : null;
    Promise.all([lib(), stays()]).then(function (a) {
      var mine = a[1].filter(function (s) { return s.region === o.region; });
      var pins = mine.map(function (s) { if (o.wrap && s.lng < 0) s.lng += 360; return { name: s.name, c: [s.lng, s.lat], mark: MARKKEY[s.mark] || "know", type: s.type, residence: s.residence }; });
      return Promise.all([window.JWMaps.atlas(map, { destination: o.destination, bounds: o.bounds, stays: pins, places: o.places || [], minZoom: 1.2, phoneLabels: false, world: true, wide: true, worldCopies: !!o.wrap, pad: 18 }),
                          window.JWMaps.loadDestination(o.destination), mine]);
    }).then(function (a) {
      var at = a[0], data = a[1], mine = a[2], m = at.map, start = m.getZoom();
      var lands = data.base.features.filter(function (f) { return f.properties.layer === "land" && f.properties.name; });
      var zoomed = function () { frame.classList.toggle("jw-near", m.getZoom() > start + 1.4); };
      m.on("zoomend", zoomed); zoomed();
      m.addLayer({ id: "jw-sel", type: "line", source: "jw-base", filter: ["==", ["get", "name"], "\u0000none"], paint: { "line-color": pal ? pal.accent : "#3E4A3A", "line-width": 2.4 } });
      var count = {}; mine.forEach(function (s) { count[s.country] = (count[s.country] || 0) + 1; });
      function go(ne, label) {
        var g = lands.filter(function (f) { return f.properties.name === ne; }).map(function (f) { return f.geometry.coordinates; });
        if (!g.length) return;
        m.fitBounds(bboxOf(g), { padding: 50, maxZoom: o.countryMaxZoom || 7.5, duration: RM ? 0 : 1600 });
        m.setFilter("jw-sel", ["==", ["get", "name"], ne]);
        back.hidden = false; card.hidden = true;
        cart.querySelector("small").textContent = label + (count[label] ? " · " + count[label] + (count[label] > 1 ? " stays" : " stay") : "");
        [].forEach.call(chips.children, function (b) { b.setAttribute("aria-pressed", String(b.dataset.ne === ne)); });
      }
      back.addEventListener("click", function () {
        m.fitBounds(o.bounds, { padding: 30, duration: RM ? 0 : 1400 }); m.setFilter("jw-sel", ["==", ["get", "name"], "\u0000none"]);
        back.hidden = true; card.hidden = true; cart.querySelector("small").textContent = o.subtitle || "Tap a country to zoom in";
        [].forEach.call(chips.children, function (b) { b.setAttribute("aria-pressed", "false"); });
      });
      (o.countries || []).forEach(function (c) {
        var n = count[c[0]] || 0;
        var b = el("button", "jw-chip" + (n ? " has" : ""), esc(c[0]) + (n ? " <span>" + n + "</span>" : ""), { type: "button", "aria-pressed": "false" });
        b.dataset.ne = c[1]; b.addEventListener("click", function () { go(c[1], c[0]); }); chips.appendChild(b);
      });
      m.on("click", "jw-land", function (e) {
        if (e.originalEvent && e.originalEvent.target && e.originalEvent.target.closest && e.originalEvent.target.closest(".jw-pin")) return;
        var f = e.features && e.features[0]; if (!f || !f.properties.home) return;
        var ne = f.properties.name, lab = ne;
        (o.countries || []).forEach(function (c) { if (c[1] === ne) lab = c[0]; });
        go(ne, lab);
      });
      m.on("mouseenter", "jw-land", function (e) { if (e.features[0].properties.home) m.getCanvas().style.cursor = "pointer"; });
      m.on("mouseleave", "jw-land", function () { m.getCanvas().style.cursor = ""; });
      at.stays.forEach(function (mk, i) {
        var s = mine[i], e = mk.getElement();
        e.tabIndex = 0; e.setAttribute("role", "button");
        var show = function (ev) {
          if (ev) ev.stopPropagation();
          card.innerHTML = '<span class="k">' + esc(s.mark || "") + '</span><span class="n">' + esc(s.name) + "</span><span>" + esc([s.area, s.country].filter(Boolean).join(", ")) + "</span>" +
            (s.line ? "<span><i>" + esc(s.line) + "</i></span>" : "") + (s.url ? '<a class="jw-more" href="' + esc(s.url) + '">See the stay &rarr;</a>' : "");
          card.hidden = false;
          if (m.getZoom() < start + 1.4) m.easeTo({ center: [s.lng, s.lat], zoom: Math.min(start + 2.6, 8), duration: RM ? 0 : 1200 });
        };
        e.addEventListener("click", show); e.addEventListener("keydown", function (ev) { if (ev.key === "Enter") show(ev); });
      });
      if (listEl && mine.length) {   // refresh the written list from the live feed
        var by = {}; mine.forEach(function (s) { (by[s.country] = by[s.country] || []).push(s); });
        listEl.innerHTML = Object.keys(by).sort().map(function (c) {
          return '<div class="jw-country"><h3>' + esc(c) + "</h3><ul>" + by[c].map(function (s) {
            return "<li>" + (s.url ? '<a href="' + esc(s.url) + '">' + esc(s.name) + "</a>" : esc(s.name)) + "<span>" + esc([s.area, s.line].filter(Boolean).join(" · ")) + "</span></li>";
          }).join("") + "</ul></div>";
        }).join("");
      }
    }).catch(function (e) { root.classList.add("jw-failed"); if (window.console) console.warn("jw-region", e); });
  }



  /* ---------- country: one country inside its region, in the country's palette ---------- */
  // config: { destination, region, country, ne (name in the base data), title, subtitle, bounds, regionBounds, palette, listId }
  // The country's stays are drawn in full, the rest of the region's stays are faint; Country · Region zoom steps;
  // a layer toggle per kind of place; tap a pin for James's line.
  function country(root, o) {
    var pal = o.palette || null;
    var frame = el("div", "jw-frame atlas jw-region jw-country-map");
    if (pal) {
      root.style.setProperty("--jw-acc", pal.accent);
      frame.appendChild(el("div", "jw-terrain", (pal.terrain_key || []).map(function (k) { return '<i style="background:' + k[0] + '"></i>'; }).join(""), { "aria-hidden": "true", style: "margin-bottom:5px" }));
    }
    var map = el("div", "jw-map", null, { role: "region", "aria-label": "Map of " + o.title + ": the stays James knows, inside " + o.region });
    var cart = el("div", "jw-cart", "<b>" + esc(o.title) + "</b><small>" + esc(o.subtitle || "") + "</small>");
    var card = el("div", "jw-card", null, { hidden: "", "aria-live": "polite" });
    var ctrl = el("div", "jw-ctrl jw-steps", null, { role: "group", "aria-label": "Zoom level", style: "right:12px;top:12px" });
    frame.appendChild(map); frame.appendChild(cart); frame.appendChild(ctrl); frame.appendChild(card);
    root.appendChild(frame);
    var chips = el("div", "jw-chips", null, { role: "group", "aria-label": "Show or hide places" });
    root.appendChild(chips);
    if (pal && pal.terrain_key) root.appendChild(el("p", "jw-key", '<span>Terrain key</span> · ' + pal.terrain_key.map(function (k) { return esc(k[1]); }).join(" · ")));
    Promise.all([lib(), stays()]).then(function (a) {
      var inRegion = a[1].filter(function (s) { return s.region === o.region; });
      var mine = inRegion.filter(function (s) { return s.country === o.country; }), others = inRegion.filter(function (s) { return s.country !== o.country; });
      var pins = mine.concat(others).map(function (s) { return { name: s.name, c: [o.wrap && s.lng < 0 ? s.lng + 360 : s.lng, s.lat], mark: MARKKEY[s.mark] || "know", type: s.type, residence: s.residence, url: s.url }; });   // wrap: Pacific maps run past 180°
      return Promise.all([window.JWMaps.atlas(map, { destination: o.destination, bounds: o.bounds, stays: pins, places: o.places || [], minZoom: 1.2, phoneLabels: false, world: true, wide: true, worldCopies: !!o.wrap, pad: 18 }), mine, others]);
    }).then(function (a) {
      var at = a[0], mine = a[1], others = a[2], all = mine.concat(others), m = at.map;
      m.addLayer({ id: "jw-sel", type: "line", source: "jw-base", filter: ["==", ["get", "name"], o.ne || o.country], paint: { "line-color": pal ? pal.accent : "#3E4A3A", "line-width": 2.4 } });
      at.stays.forEach(function (mk, i) { if (i >= mine.length) mk.getElement().classList.add("jw-faint"); });
      var steps = [[o.title, o.bounds, 30], [o.regionLabel || o.region, o.regionBounds, 20]];
      var sb = steps.map(function (s, i) { var b = el("button", "jw-btn", esc(s[0]), { type: "button", "aria-pressed": String(i === 0) });
        b.addEventListener("click", function () { sb.forEach(function (x) { x.setAttribute("aria-pressed", String(x === b)); }); m.fitBounds(s[1], { padding: s[2], duration: RM ? 0 : 1500 }); }); ctrl.appendChild(b); return b; });
      var have = {}; mine.forEach(function (s) { var t = window.JWMaps.featureType(s); have[t] = (have[t] || 0) + 1; });
      Object.keys(window.JWMaps.types).forEach(function (t) {
        if (!have[t]) return;
        var b = el("button", "jw-chip has", esc(window.JWMaps.types[t]) + " <span>" + have[t] + "</span>", { type: "button", "aria-pressed": "true" });
        b.addEventListener("click", function () { var on = b.getAttribute("aria-pressed") !== "true"; b.setAttribute("aria-pressed", String(on)); at.toggle(t, on); });
        chips.appendChild(b);
      });
      at.stays.forEach(function (mk, i) {
        var s = all[i], e = mk.getElement(); if (s.url) return;   // pins with a stay page open it, as on the region maps
        e.tabIndex = 0; e.setAttribute("role", "button");
        var show = function (ev) {
          if (ev) ev.stopPropagation();
          card.innerHTML = '<span class="k">' + esc(s.mark || "") + '</span><span class="n">' + esc(s.name) + "</span><span>" + esc([s.area, s.country].filter(Boolean).join(", ")) + "</span>" +
            (s.line ? "<span><i>" + esc(s.line) + "</i></span>" : "") + (s.url ? '<a class="jw-more" href="' + esc(s.url) + '">See the stay &rarr;</a>' : "");
          card.hidden = false;
        };
        e.addEventListener("click", show); e.addEventListener("keydown", function (ev) { if (ev.key === "Enter") show(ev); });
      });
      m.on("click", function () { card.hidden = true; });
      root.jw = at;
    }).catch(function (e) { root.classList.add("jw-failed"); if (window.console) console.warn("jw-country", e); });
  }

  /* ---------- itinerary: journey and voyage pages, over the engraved fallback ---------- */
  // config: { route: "<id>" | {jw-route}, accent, region: { name, bounds }, context: true, autoplay }
  // Controls: Route · Country · Region zoom steps (top left), layer toggles in the legend, and any [data-day] button
  // on the page (the stop cards under the map) flies the map to that day.
  // HJW-01: itinerary maps are the animated chart (maps/jw-chart.js, d3). The MapLibre version stays available
  // as { "engine": "maplibre" } in the config.
  var chartReady = null;
  function chartLib() {
    if (!chartReady) {
      css(BASE + "jw-chart.css");
      chartReady = (window.d3 && window.d3.geoOrthographic ? Promise.resolve() : js(BASE + "vendor/d3.min.js"))
        .then(function () { return window.JWChart ? 0 : js(BASE + "jw-chart.js"); });
    }
    return chartReady;
  }
  function itinerary(root, o) {
    if (o.engine === "maplibre") return itineraryMapLibre(root, o);
    var ids = o.routes || (o.route ? [o.route] : []);
    chartLib().then(function () {
      return window.JWChart.mount(root, { routes: ids, dest: o.destination, kind: o.kind, kicker: o.kicker, caption: o.caption, alt: o.alt, cartouche: o.cartouche, palette: o.palette, chart: o.chart });
    }).then(function () { root.classList.add("jw-live"); })
      .catch(function (e) { root.classList.add("jw-failed"); if (window.console) console.warn("jw-chart", e); });
  }
  function itineraryMapLibre(root, o) {
    var frame = root.querySelector(".jw-frame") || root.appendChild(el("div", "jw-frame survey"));
    var fb = frame.querySelector(".jw-fallback"), art = fb && fb.querySelector("svg");
    var getRoute = typeof o.route === "string" ? fetch(BASE + "routes/" + o.route + ".json").then(function (r) { return r.json(); }) : Promise.resolve(o.route);
    var hold = el("div", "jw-hold"), map = el("div", "jw-map", null, { role: "region" });
    hold.style.cssText = "position:absolute;z-index:2;opacity:0;transition:opacity .6s";
    map.style.cssText = "width:100%;height:100%;min-height:0";
    hold.appendChild(map);
    function place() {   // sit exactly over the fallback picture, so nothing on the page moves
      var a = (art || frame).getBoundingClientRect(), f = frame.getBoundingClientRect();
      hold.style.left = (a.left - f.left) + "px"; hold.style.top = (a.top - f.top) + "px"; hold.style.width = a.width + "px"; hold.style.height = a.height + "px";
    }
    frame.style.position = "relative"; frame.appendChild(hold); place(); window.addEventListener("resize", place);
    var cap = fb && fb.querySelector("figcaption");
    var play = el("button", "jw-btn jw-play", "Play", { type: "button", "aria-pressed": "false" });
    var route;
    getRoute.then(function (r) {
      route = r;
      map.setAttribute("aria-label", "Interactive map of " + route.title + ". Use the buttons to zoom from the route to the country and the region.");
      play.textContent = route.type === "voyage" ? "Play voyage" : "Play journey";
      return Promise.all([lib(), o.context === false ? [] : stays().catch(function () { return []; })]);
    }).then(function (a) {
      var feed = a[1] || [], reg = o.region || {};
      var ctx = feed.filter(function (s) { return s.show !== false && reg.name && s.region === reg.name; })
        .map(function (s) { return { name: s.name, c: [s.lng, s.lat], mark: MARKKEY[s.mark] || "know", type: s.type, residence: s.residence, url: s.url }; });
      return Promise.all([window.JWMaps.itinerary(map, route, { playEl: play, accent: o.accent, context: ctx, world: !!reg.bounds, minZoom: reg.bounds ? 2.2 : 5,
        autoplay: false }), window.JWMaps.loadDestination(route.destination), ctx]);
    }).then(function (a) {
      var api = a[0], meta = a[1].meta, ctx = a[2], m = api.map, reg = o.region || {};
      hold.style.opacity = "1"; root.classList.add("jw-live"); root.jw = api;
      if (art) art.style.visibility = "hidden";
      // play once when the map is in view, unless the reader has already used a control
      var touched = false, touch = function () { touched = true; };
      if (o.autoplay !== false && !RM && "IntersectionObserver" in window) {
        var io = new IntersectionObserver(function (es) { if (es[0].isIntersecting) { io.disconnect(); setTimeout(function () { if (!touched) api.play(); }, 500); } }, { threshold: .5 });
        io.observe(hold);
      }
      // zoom steps, the same control the stay maps use
      var steps = [["Route", function () { m.fitBounds(api.bounds, { padding: 30, duration: RM ? 0 : 1400 }); }],
                   ["Country", function () { var b = meta.bbox; m.fitBounds([[b[0], b[1]], [b[2], b[3]]], { padding: 20, duration: RM ? 0 : 1400 }); }]];
      if (reg.bounds) steps.push([reg.name || "Region", function () { m.fitBounds(reg.bounds, { padding: 20, duration: RM ? 0 : 1600 }); }]);
      var ctrl = el("div", "jw-ctrl jw-steps", null, { role: "group", "aria-label": "Zoom level", style: "left:12px;top:12px" });
      var sb = steps.map(function (s, i) { var b = el("button", "jw-btn", esc(s[0]), { type: "button", "aria-pressed": String(i === 0) }); b.addEventListener("click", function () { touch(); api.stop(); sb.forEach(function (x) { x.setAttribute("aria-pressed", String(x === b)); }); s[1](); }); ctrl.appendChild(b); return b; });
      hold.appendChild(ctrl);
      // legend: play first, then a toggle for every kind of place on the map
      if (cap) cap.insertBefore(play, cap.firstChild); else frame.appendChild(play);
      play.addEventListener("click", touch); m.on("dragstart", touch); m.on("zoomstart", function (ev) { if (ev.originalEvent) touch(); });
      var have = {}; ctx.forEach(function (s) { var t = window.JWMaps.featureType(s); have[t] = (have[t] || 0) + 1; });
      Object.keys(window.JWMaps.types).forEach(function (t) {
        if (!have[t]) return;
        var b = el("button", "jw-chip jw-layer", esc(window.JWMaps.types[t]) + " <span>" + have[t] + "</span>", { type: "button", "aria-pressed": "true" });
        b.addEventListener("click", function () { var on = b.getAttribute("aria-pressed") !== "true"; b.setAttribute("aria-pressed", String(on)); api.toggle(t, on); });
        (cap || frame).appendChild(b);
      });
      // stop cards under the map (one listener on the page, so cards re-rendered by the page still work)
      document.addEventListener("click", function (ev) {
        var b = ev.target && ev.target.closest && ev.target.closest("[data-jw-day]");
        if (!b || (b.getAttribute("data-jw-for") && b.getAttribute("data-jw-for") !== root.id)) return;
        touch(); api.stop(); sb.forEach(function (x, i) { x.setAttribute("aria-pressed", String(i === 0)); });
        var top = root.getBoundingClientRect().top; if (top < 0 || top > innerHeight * .5) root.scrollIntoView({ behavior: "auto", block: "start" });
        api.setDay(+b.getAttribute("data-jw-day"), true);
      });
    }).catch(function (e) { hold.remove(); root.classList.add("jw-failed"); if (window.console) console.warn("jw-itinerary", e); });
  }

  function boot(root) {
    var cfgEl = root.querySelector('script[type="application/json"]');
    if (!cfgEl) return;
    var o = JSON.parse(cfgEl.textContent);
    var k = root.getAttribute("data-jw-map");
    (k === "region" ? region : k === "country" ? country : k === "atlas" ? atlas : k === "itinerary" ? itinerary : stay)(root, o);
  }

  function start() {
    var roots = [].slice.call(document.querySelectorAll("[data-jw-map]"));
    if (!roots.length) return;
    if (!("IntersectionObserver" in window)) { roots.forEach(boot); return; }
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) { io.unobserve(e.target); boot(e.target); } });
    }, { rootMargin: "400px 0px" });
    roots.forEach(function (r) { io.observe(r); });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();
})();
