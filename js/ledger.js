// Reveal on scroll — restrained, one pass, no parallax.
(function () {
  var els = document.querySelectorAll(".rv");
  if (!("IntersectionObserver" in window) || !els.length) {
    els.forEach(function (el) {
      el.classList.add("in");
    });
    return;
  }
  var io = new IntersectionObserver(
    function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) {
          e.target.classList.add("in");
          io.unobserve(e.target);
        }
      });
    },
    { rootMargin: "0px 0px -8% 0px", threshold: 0.06 }
  );
  els.forEach(function (el) {
    io.observe(el);
  });
})();

// Count-up on the depth figures, once, when they scroll in.
(function () {
  var nums = document.querySelectorAll("[data-count]");
  if (!nums.length) return;
  var reduce =
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function run(el) {
    var target = parseFloat(el.getAttribute("data-count"));
    var suffix = el.getAttribute("data-suffix") || "";
    if (reduce || !isFinite(target)) {
      el.textContent = target.toLocaleString("en-GB") + suffix;
      return;
    }
    var dur = 900,
      t0 = null;
    function step(ts) {
      if (t0 === null) t0 = ts;
      var p = Math.min((ts - t0) / dur, 1);
      var eased = 1 - Math.pow(1 - p, 3);
      el.textContent =
        Math.round(target * eased).toLocaleString("en-GB") + suffix;
      if (p < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  if (!("IntersectionObserver" in window)) {
    nums.forEach(run);
    return;
  }
  var io = new IntersectionObserver(
    function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) {
          run(e.target);
          io.unobserve(e.target);
        }
      });
    },
    { threshold: 0.4 }
  );
  nums.forEach(function (el) {
    io.observe(el);
  });
})();

// Stays dropdown: caret toggles the sample-listings menu (touch and keyboard).
(function () {
  document.querySelectorAll(".nav__drop").forEach(function (d) {
    var b = d.querySelector(".nav__caret");
    if (!b) return;
    b.addEventListener("click", function (e) {
      e.stopPropagation();
      var open = d.classList.toggle("open");
      b.setAttribute("aria-expanded", open ? "true" : "false");
    });
    document.addEventListener("click", function (e) {
      if (!d.contains(e.target)) { d.classList.remove("open"); b.setAttribute("aria-expanded", "false"); }
    });
    d.addEventListener("keydown", function (e) {
      if (e.key === "Escape") { d.classList.remove("open"); b.setAttribute("aria-expanded", "false"); b.focus(); }
    });
  });
})();
