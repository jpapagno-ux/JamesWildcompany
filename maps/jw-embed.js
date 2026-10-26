/*! jw-embed 1.0 · drop-in house maps for site pages · James Wild & Co.
 *
 * <link rel="stylesheet" href="/maps/jw-maps.css">          (in <head>: reserves the map's height)
 * <div class="jw-maps jw-site" data-jw-map="stay">          (or data-jw-map="atlas")
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
    var frame = el("div", "jw-frame atlas jw-region");
    var map = el("div", "jw-map", null, { role: "region", "aria-label": "Map of " + o.title + ": every country in the region and the stays James knows" });
    var cart = el("div", "jw-cart", "<b>" + esc(o.title) + "</b><small>" + esc(o.subtitle || "Tap a country to zoom in") + "</small>");
    var back = el("button", "jw-btn jw-back", "&larr; All of " + esc(o.title), { type: "button", hidden: "" });
    var card = el("div", "jw-card", null, { hidden: "", "aria-live": "polite" });
    frame.appendChild(map); frame.appendChild(cart); frame.appendChild(back); frame.appendChild(card);
    root.appendChild(frame);
    var chips = el("div", "jw-chips", null, { role: "group", "aria-label": "Zoom to a country" });
    root.appendChild(chips);
    var listEl = o.listId ? document.getElementById(o.listId) : null;
    Promise.all([lib(), stays()]).then(function (a) {
      var mine = a[1].filter(function (s) { return s.region === o.region; });
      var pins = mine.map(function (s) { if (o.wrap && s.lng < 0) s.lng += 360; return { name: s.name, c: [s.lng, s.lat], mark: MARKKEY[s.mark] || "know" }; });
      return Promise.all([window.JWMaps.atlas(map, { destination: o.destination, bounds: o.bounds, stays: pins, places: o.places || [], minZoom: 1.2, phoneLabels: false, world: true, wide: true, worldCopies: !!o.wrap, pad: 18 }),
                          window.JWMaps.loadDestination(o.destination), mine]);
    }).then(function (a) {
      var at = a[0], data = a[1], mine = a[2], m = at.map, start = m.getZoom();
      var lands = data.base.features.filter(function (f) { return f.properties.layer === "land" && f.properties.name; });
      var zoomed = function () { frame.classList.toggle("jw-near", m.getZoom() > start + 1.4); };
      m.on("zoomend", zoomed); zoomed();
      m.addLayer({ id: "jw-sel", type: "line", source: "jw-base", filter: ["==", ["get", "name"], ""], paint: { "line-color": "#3E4A3A", "line-width": 2.2 } });
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
        m.fitBounds(o.bounds, { padding: 30, duration: RM ? 0 : 1400 }); m.setFilter("jw-sel", ["==", ["get", "name"], ""]);
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

  function boot(root) {
    var cfgEl = root.querySelector('script[type="application/json"]');
    if (!cfgEl) return;
    var o = JSON.parse(cfgEl.textContent);
    var k = root.getAttribute("data-jw-map");
    (k === "region" ? region : k === "atlas" ? atlas : stay)(root, o);
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
