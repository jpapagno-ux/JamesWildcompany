// Field Guide request form. Add to any page with:
//   <form data-guide-form data-endpoint="https://jameswildco.com/api/guide-request"> ... </form>
//   <script src="/js/guide-form.js" defer></script>
// Expected inputs: name, email, code (select or hidden: e.g. belize-full / belize-quick),
// delivery (radio: Download now / Email me / Both), optIn (checkbox, UNticked by default),
// optional when, style, and a hidden honeypot named "website". A [data-guide-out] element shows the result.
(function () {
  var qs = new URLSearchParams(location.search);
  document.querySelectorAll("form[data-guide-form]").forEach(function (f) {
    var out = f.querySelector("[data-guide-out]");
    var btn = f.querySelector("button[type=submit]");
    f.addEventListener("submit", function (e) {
      e.preventDefault();
      if (!f.reportValidity()) return;
      var v = function (n) { var el = f.elements[n]; return el ? (el.type === "checkbox" ? el.checked : el.value) : ""; };
      var body = {
        name: v("name"), email: v("email"), code: v("code"), delivery: v("delivery") || "Email me",
        optIn: v("optIn") === true, when: v("when"), style: v("style"), website: v("website"),
        source: location.origin + location.pathname,
        utm_source: qs.get("utm_source") || qs.get("src") || "", utm_campaign: qs.get("utm_campaign") || ""
      };
      btn && (btn.disabled = true);
      out.hidden = false; out.textContent = "One moment…";
      fetch(f.dataset.endpoint || "/api/guide-request", {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body)
      }).then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
        .then(function (x) {
          var j = x.j, first = (body.name || "").split(" ")[0];
          if (!x.ok) { out.textContent = j.error || "Something went wrong. Email james@jameswildco.com."; return; }
          var msg = "Thank you" + (first ? ", " + first : "") + ". Your Traveler Folio is <b>" + (j.folio || "") + "</b>.";
          if (j.held) msg += " This guide is still at the printer; James will send it the day it's ready.";
          else {
            if (j.downloadUrl) msg += ' <a class="btn" href="' + j.downloadUrl + '" target="_blank" rel="noopener" download>Download your guide</a>';
            if (j.emailing) msg += " A copy is on its way to " + body.email + ".";
          }
          out.innerHTML = msg;
          if (window.gtag) gtag("event", "generate_lead", { guide: body.code, delivery: body.delivery });
        })
        .catch(function () { out.textContent = "We couldn't reach the server. Email james@jameswildco.com and we'll send it by hand."; })
        .finally(function () { btn && (btn.disabled = false); });
    });
  });
})();
