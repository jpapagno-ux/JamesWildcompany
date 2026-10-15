// Live rate band for sample listings. Reads /api/rates (a Vercel function that
// reads the booking engine) and falls back to a deep link if it can't.
(function () {
  var band = document.querySelector("[data-live-rates]");
  if (!band) return;
  var property = band.getAttribute("data-property");
  var form = band.querySelector("form");
  var inEl = form.querySelector("[name=checkIn]");
  var nightsEl = form.querySelector("[name=nights]");
  var adultsEl = form.querySelector("[name=adults]");
  var out = band.querySelector(".live__out");
  var fromEl = band.querySelector(".live__from");
  var metaEl = band.querySelector(".live__meta");
  var tbody = band.querySelector(".live__rooms tbody");
  var promoEl = band.querySelector(".live__promo");
  var bookEl = band.querySelector(".live__book");
  var statusEl = band.querySelector(".live__status");

  function iso(d) { return d.toISOString().slice(0, 10); }
  function addDays(s, n) { var d = new Date(s + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return iso(d); }
  var today = iso(new Date());
  inEl.min = addDays(today, 1);
  if (!inEl.value) inEl.value = addDays(today, 60);

  function engineUrl(ci, co, ad) {
    return "https://book.wildearthstays.com/en/property/" + property + "?checkIn=" + ci + "&checkOut=" + co +
      "&adults=" + ad + "&children=0&infants=0&currency=USD&rooms=1";
  }
  function money(n) { return "$" + Math.round(n).toLocaleString("en-US"); }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function time(isoStr) {
    try { return new Date(isoStr).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }); } catch (e) { return ""; }
  }

  function run() {
    var ci = inEl.value, n = parseInt(nightsEl.value, 10) || 3, ad = adultsEl.value || "2";
    if (!ci) return;
    var co = addDays(ci, n);
    var link = engineUrl(ci, co, ad);
    bookEl.href = link;
    band.setAttribute("data-state", "loading");
    statusEl.textContent = "Reading the booking engine for " + n + " night" + (n > 1 ? "s" : "") + " from " + ci + "…";
    var url = "/api/rates?property=" + encodeURIComponent(property) + "&checkIn=" + ci + "&checkOut=" + co + "&adults=" + ad;
    fetch(url, { headers: { accept: "application/json" } })
      .then(function (r) { return r.json().then(function (j) { if (!r.ok) throw new Error(j.error || r.status); return j; }); })
      .then(function (d) {
        fromEl.textContent = money(d.from_price);
        metaEl.innerHTML = "/ night &middot; excl. taxes and fees &middot; <span class=\"live__dot\">Live</span> &middot; updated " + esc(time(d.fetched_at));
        tbody.innerHTML = d.rooms.map(function (r) {
          return "<tr><th scope=\"row\">" + esc(r.name) + "</th><td>" + money(r.price) + "</td><td>" + money(r.total) + "</td></tr>";
        }).join("");
        if (d.promo && d.promo.rooms.length) {
          var best = Math.min.apply(null, d.promo.rooms.map(function (r) { return r.price; }));
          promoEl.hidden = false;
          promoEl.textContent = d.promo.name + " also showing for these dates, from " + money(best) + " / night.";
        } else { promoEl.hidden = true; }
        band.setAttribute("data-state", "ok");
        statusEl.textContent = d.rooms.length + " room types available · " + d.nights + " night" + (d.nights > 1 ? "s" : "") + " · " + d.adults + " adult" + (d.adults > 1 ? "s" : "") + " · stay totals before taxes in the last column.";
      })
      .catch(function () {
        band.setAttribute("data-state", "fallback");
        statusEl.textContent = "The engine didn't answer just now. Your dates are already set on the booking page.";
      });
  }

  form.addEventListener("submit", function (e) { e.preventDefault(); run(); });
  run();
})();
