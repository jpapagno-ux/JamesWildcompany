// /api/guide-request — Field Guide requests from the destination pages.
//
// POST JSON:
//   { name, email, code, delivery, optIn, when, style, source, utm_source, utm_campaign, website }
//   code      = Request Code on the Guides table, e.g. "belize-full" or "belize-quick"
//   delivery  = "Download now" | "Email me" | "Both"
//   optIn     = true only if the traveler ticked the (unticked) newsletter box
//   website   = honeypot; real people leave it empty
//
// What it does:
//   1. Looks the guide up in the Airtable "Guide Library" base (Guides table, by Request Code).
//   2. Logs the request in Sign-ups, linked to that guide, with a Traveler Folio ID.
//   3. Returns the download link straight away for "Download now" or "Both", but only for
//      guides ticked "Available to Request". Unreleased guides are logged and held, never served.
//   Emails are sent by the Airtable automations ("Guide requests · 2 · Email the guide").
//
// Environment variables (set in Vercel → Project → Settings → Environment Variables):
//   AIRTABLE_TOKEN    Personal access token, scopes data.records:read + data.records:write,
//                     access limited to the Guide Library base. Never commit it.
//   AIRTABLE_BASE_ID  appG0YxRHYBjuCiBP (default below)

const BASE = process.env.AIRTABLE_BASE_ID || "appG0YxRHYBjuCiBP";
const GUIDES = "tblvJAUpKMsVR2h01";
const SIGNUPS = "tblZTNV2xdEpKCSWc";
const API = "https://api.airtable.com/v0/" + BASE + "/";
const DELIVERY = new Set(["Download now", "Email me", "Both"]);
const ORIGINS = [/^https:\/\/(www\.)?jameswildco\.com$/, /^https:\/\/[a-z0-9-]+\.vercel\.app$/];
const hits = new Map(); // light per-IP throttle: 8 requests / 10 minutes per warm instance

function cors(req, res) {
  const o = req.headers.origin || "";
  if (ORIGINS.some((r) => r.test(o))) {
    res.setHeader("access-control-allow-origin", o);
    res.setHeader("vary", "origin");
    res.setHeader("access-control-allow-methods", "POST, OPTIONS");
    res.setHeader("access-control-allow-headers", "content-type");
  }
}
function send(res, status, body) {
  res.statusCode = status;
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.setHeader("cache-control", "no-store");
  res.end(JSON.stringify(body));
}
function clean(v, max) {
  return String(v == null ? "" : v).replace(/[\u0000-\u001f]/g, " ").trim().slice(0, max);
}
function throttled(ip) {
  const now = Date.now();
  const list = (hits.get(ip) || []).filter((t) => now - t < 600000);
  list.push(now);
  hits.set(ip, list);
  return list.length > 8;
}
async function airtable(path, opts) {
  const r = await fetch(API + path, {
    ...opts,
    headers: { authorization: "Bearer " + process.env.AIRTABLE_TOKEN, "content-type": "application/json" },
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error("Airtable " + r.status + ": " + JSON.stringify(j.error || j));
  return j;
}
async function readBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string") return JSON.parse(req.body || "{}");
  const chunks = [];
  for await (const c of req) chunks.push(c);
  return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
}

module.exports = async function handler(req, res) {
  cors(req, res);
  if (req.method === "OPTIONS") { res.statusCode = 204; return res.end(); }
  if (req.method !== "POST") return send(res, 405, { error: "POST only" });
  if (!process.env.AIRTABLE_TOKEN) return send(res, 503, { error: "Guide requests are not switched on yet" });

  let b;
  try { b = await readBody(req); } catch { return send(res, 400, { error: "Bad request" }); }
  if (clean(b.website, 200)) return send(res, 200, { ok: true }); // honeypot: pretend success

  const ip = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim() || "unknown";
  if (throttled(ip)) return send(res, 429, { error: "Too many requests. Try again in a few minutes." });

  const name = clean(b.name, 120);
  const email = clean(b.email, 254).toLowerCase();
  const code = clean(b.code, 60).toLowerCase();
  const delivery = DELIVERY.has(b.delivery) ? b.delivery : "Email me";
  if (!name) return send(res, 400, { error: "Please add your name" });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return send(res, 400, { error: "Please check your email address" });
  if (!/^[a-z0-9-]{3,60}$/.test(code)) return send(res, 400, { error: "Unknown guide" });

  try {
    const q = new URLSearchParams({ filterByFormula: "{Request Code}='" + code + "'", maxRecords: "1" });
    ["Guide", "Download URL", "Available to Request"].forEach((f) => q.append("fields[]", f));
    const found = await airtable(GUIDES + "?" + q.toString(), { method: "GET" });
    const guide = (found.records || [])[0];
    if (!guide) return send(res, 404, { error: "Unknown guide" });
    const released = !!guide.fields["Available to Request"];

    const folio = "JW-F-" + String(Math.floor(100000 + Math.random() * 900000));
    const status = released && delivery === "Download now" ? "Downloaded" : "Pending";
    const fields = {
      "Email": email,
      "Name": name,
      "Sign-up Type": "Field Guide",
      "Guide": [guide.id],
      "Request Code": code,
      "Delivery": delivery,
      "Delivery Status": status,
      "Folio ID": folio,
      "Marketing Opt-in": b.optIn === true,
      "Travel Window": clean([b.when, b.style].filter(Boolean).join(" · "), 120),
      "UTM Source": clean(b.utm_source, 80),
      "UTM Campaign": clean(b.utm_campaign, 80),
    };
    const src = clean(b.source, 300);
    if (/^https:\/\//.test(src)) fields["Source Page"] = src;
    await airtable(SIGNUPS, { method: "POST", body: JSON.stringify({ records: [{ fields }], typecast: true }) });

    const giveLink = released && delivery !== "Email me";
    return send(res, 200, {
      ok: true,
      folio,
      title: guide.fields["Guide"],
      downloadUrl: giveLink ? guide.fields["Download URL"] : null,
      emailing: released && delivery !== "Download now",
      held: !released,
    });
  } catch (e) {
    console.error("guide-request", e.message);
    return send(res, 502, { error: "We couldn't log that just now. Email james@jameswildco.com and we'll send it by hand." });
  }
};
