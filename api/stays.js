// /api/stays — every stay on the house maps, read live from Airtable.
//
// Source: Guide Library base (appG0YxRHYBjuCiBP) → "Map Stays" table (tblaMXm0QBzn8hHWL).
// Only rows ticked "Show on Map" with a latitude and longitude are returned.
// The region pages, the country zoom and the stay pages all read this one feed, so a row added
// or edited in Airtable shows on every map within about five minutes (edge cache).
//
// Until AIRTABLE_TOKEN is set in Vercel this answers 503 and the maps fall back to
// /maps/data/stays.json (the copy committed with the site).
//
// Environment: AIRTABLE_TOKEN (data.records:read on the Guide Library base). Never commit it.

const BASE = process.env.AIRTABLE_BASE_ID || "appG0YxRHYBjuCiBP";
const TABLE = "tblaMXm0QBzn8hHWL";
const F = {
  name: "fldD3NXdKkapSk6T5", region: "flda34Ytw0xcAgt20", country: "fldSiKxZi505ooQtO", area: "fldHhgbc5ZqZPCSkC",
  lat: "fldDdOSAdhV9zel6p", lng: "fldEaTLffFEMzSgdF", mark: "fldxYf1Xp6NcEW99l", line: "fldvSmzHFDhl2TQ5C",
  year: "fldwG9pBjpfUTsZVV", residence: "fldgNhf6YYFBvxCmF", url: "fldbbWpENinfCKpsc", show: "fldK8JCituEJcHmDK",
  type: "fldJzvjJcHgfbHajF",
};
// Airtable "Type" → what the maps draw: a pin, an anchor, a square, or a 2 km area (never a pin)
const TYPE = { "Stay": "stay", "Vessel launch": "port", "Reserve": "reserve", "Family residence": "residence" };
const HOST = /^https:\/\/(www\.)?(jameswildco\.com|james-wild-and-company\.vercel\.app)/;

function sitePath(u) {   // keep links on whatever domain the page is served from
  if (!u) return "";
  return u.replace(HOST, "") || "/";
}

module.exports = async function handler(req, res) {
  const token = process.env.AIRTABLE_TOKEN;
  if (!token) {
    res.statusCode = 503;
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Cache-Control", "no-store");
    return res.end(JSON.stringify({ error: "not configured" }));
  }
  try {
    const out = [];
    let offset = "";
    do {
      const q = new URLSearchParams({ returnFieldsByFieldId: "true", pageSize: "100", filterByFormula: "AND({Show on Map}, {Latitude}!='', {Longitude}!='')" });
      if (offset) q.set("offset", offset);
      const r = await fetch(`https://api.airtable.com/v0/${BASE}/${TABLE}?${q}`, { headers: { Authorization: `Bearer ${token}` } });
      if (!r.ok) throw new Error("airtable " + r.status);
      const d = await r.json();
      for (const rec of d.records) {
        const f = rec.fields;
        out.push({
          name: f[F.name] || "", region: f[F.region] || "", country: f[F.country] || "", area: f[F.area] || "",
          lat: f[F.lat], lng: f[F.lng], mark: f[F.mark] || "I know a place", line: f[F.line] || "", year: f[F.year] || "",
          residence: !!f[F.residence] || f[F.type] === "Family residence", url: sitePath(f[F.url]), show: true,
          type: TYPE[f[F.type]] || (f[F.residence] ? "residence" : "stay"),
        });
      }
      offset = d.offset || "";
    } while (offset);
    out.sort((a, b) => a.region.localeCompare(b.region) || a.country.localeCompare(b.country) || a.name.localeCompare(b.name));
    res.statusCode = 200;
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Cache-Control", "public, s-maxage=300, stale-while-revalidate=86400");
    res.end(JSON.stringify({ updated: new Date().toISOString(), stays: out }));
  } catch (e) {
    res.statusCode = 502;
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Cache-Control", "no-store");
    res.end(JSON.stringify({ error: "upstream" }));
  }
};
