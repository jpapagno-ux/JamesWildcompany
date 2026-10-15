// /api/rates — live room rates for a sample listing.
// Reads the Wild Earth Stays booking engine (book.wildearthstays.com, built by
// Tag Albie) for one property and date range, parses the "Best Available Rate"
// rooms the same way the Intelligence Console's fetchBookingEngineRates does,
// and returns JSON. Cached 15 minutes in memory and at Vercel's edge.

const ENGINE_BASE = "https://book.wildearthstays.com/en/property/";
const CACHE_TTL_MS = 15 * 60 * 1000;
// Only properties shown on the public site may be read through this proxy.
const ALLOWED = new Set(["leeu-estates-resorts"]);
const cache = new Map();

function parseRooms(section) {
  const rooms = [];
  const seen = new Set();
  const matches = [...section.matchAll(/<h3[^>]*>([^<]{2,80})<\/h3>/g)];
  matches.forEach((m, i) => {
    const name = m[1].trim();
    const start = m.index + m[0].length;
    const end = i + 1 < matches.length ? matches[i + 1].index : Math.min(start + 6000, section.length);
    const price = section.slice(start, end).match(/\$[\d,]+\.\d{2}/);
    if (price && !seen.has(name)) {
      seen.add(name);
      rooms.push({ name, price: parseFloat(price[0].replace(/[$,]/g, "")), display: price[0] });
    }
  });
  return rooms;
}

function isoDate(s) {
  return /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(Date.parse(s + "T00:00:00Z"));
}

module.exports = async function handler(req, res) {
  const q = req.query || {};
  const property = String(q.property || "").toLowerCase();
  const checkIn = String(q.checkIn || "");
  const checkOut = String(q.checkOut || "");
  const adults = Math.min(Math.max(parseInt(q.adults, 10) || 2, 1), 8);
  const children = Math.min(Math.max(parseInt(q.children, 10) || 0, 0), 6);

  res.setHeader("content-type", "application/json; charset=utf-8");
  if (!ALLOWED.has(property)) {
    res.statusCode = 400;
    return res.end(JSON.stringify({ error: "Unknown property" }));
  }
  if (!isoDate(checkIn) || !isoDate(checkOut) || checkOut <= checkIn) {
    res.statusCode = 400;
    return res.end(JSON.stringify({ error: "checkIn and checkOut must be YYYY-MM-DD, check-out after check-in" }));
  }
  const nights = Math.round((Date.parse(checkOut) - Date.parse(checkIn)) / 86400000);
  if (nights > 30) {
    res.statusCode = 400;
    return res.end(JSON.stringify({ error: "Stays longer than 30 nights are quoted by hand" }));
  }

  const params = `checkIn=${checkIn}&checkOut=${checkOut}&adults=${adults}&children=${children}&infants=0&currency=USD&rooms=1`;
  const engineUrl = `${ENGINE_BASE}${property}?${params}`;
  const key = `${property}|${params}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.ts < CACHE_TTL_MS) {
    res.setHeader("cache-control", "public, s-maxage=900, stale-while-revalidate=600");
    return res.end(JSON.stringify({ ...hit.payload, cached: true }));
  }

  try {
    const r = await fetch(engineUrl, {
      headers: { "user-agent": "Mozilla/5.0 (compatible; JamesWildCo/1.0; +https://james-wild-and-company.vercel.app)" },
      signal: AbortSignal.timeout(15000),
    });
    if (!r.ok) throw new Error(`Engine returned ${r.status}`);
    const html = await r.text();
    const bar = html.indexOf("Best Available Rate");
    const los = html.indexOf("Length of Stay Discount");
    const end = html.indexOf("properties in our collection");
    if (bar === -1) throw new Error("No rates for these dates");
    const barSection = html.slice(bar, los > bar ? los : end > bar ? end : html.length);
    const losSection = los > -1 ? html.slice(los, end > los ? end : html.length) : null;
    const rooms = parseRooms(barSection);
    if (!rooms.length) throw new Error("No rooms available for these dates");
    const promo = losSection ? parseRooms(losSection) : [];
    const payload = {
      property,
      engine_url: engineUrl,
      check_in: checkIn,
      check_out: checkOut,
      nights,
      adults,
      currency: "USD",
      plan: "Best Available Rate",
      rooms,
      from_price: Math.min(...rooms.map((x) => x.price)),
      promo: promo.length ? { name: "Length of Stay Discount", rooms: promo } : null,
      fetched_at: new Date().toISOString(),
      cached: false,
      cache_ttl_minutes: 15,
    };
    cache.set(key, { ts: Date.now(), payload });
    res.setHeader("cache-control", "public, s-maxage=900, stale-while-revalidate=600");
    return res.end(JSON.stringify(payload));
  } catch (e) {
    res.statusCode = 502;
    res.setHeader("cache-control", "no-store");
    return res.end(JSON.stringify({ error: String(e && e.message || e), engine_url: engineUrl }));
  }
};
