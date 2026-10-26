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

  function boot(root) {
    var cfgEl = root.querySelector('script[type="application/json"]');
    if (!cfgEl) return;
    var o = JSON.parse(cfgEl.textContent);
    (root.getAttribute("data-jw-map") === "atlas" ? atlas : stay)(root, o);
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
