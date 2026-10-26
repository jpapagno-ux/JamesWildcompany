#!/usr/bin/env python3
"""Build the country pages: /stays/<region>/<country>/index.html, each in the country's own palette.

Reads COUNTRIES below, maps/palettes.json (one palette per country, added to as countries are added),
maps/data/<destination>/base.geojson (country outline and neighbour labels) and maps/data/stays.json.
A country with stays gets a page; under MIN_STAYS it is "noindex, follow" and left out of the sitemap (thin pages
hurt search) and becomes indexable on its own once it has MIN_STAYS. A country with no stays is reported as held.
It also links each country's heading on its region page to the new country page.
Re-run after export_stays.py, or after adding a country or a palette.
Usage: python3 maps/tools/build_country_pages.py
"""
import html, json, os, re, sys
from shapely.geometry import shape
from shapely.ops import unary_union

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
sys.path.insert(0, HERE)
from regions import REGIONS
from build_region_pages import chrome, hero_img, nav_menu, ORIGIN, CLD

E = lambda s: html.escape(str(s), quote=True)
MIN_STAYS = 3
EAST_AFRICA = [[28.0, -12.5], [43.0, 5.5]]   # the region step for East African countries (wider than one country's data)

# One entry per country. Facts only, from the ledger: nothing here is invented.
# destination = the maps/data folder with the detailed outline; ne = the Natural Earth name in that data.
COUNTRIES = {
    "south-africa": {
        "name": "South Africa", "region": "africa", "destination": "southern-africa", "ne": "South Africa", "palette": "south-africa",
        "region_label": "Southern Africa",
        "hero": ("wildco/south-africa/monwana-thornybush/leopard-thornybush-monwana", "Leopard resting in the bush at Monwana, Thornybush Nature Reserve"),
        "lede": "The Greater Kruger, the Cape and the Kalahari.",
        "story": "James was last here in May 2026: Thornybush and the Sabi Sand in the Greater Kruger, Cape Town and the Franschhoek winelands. He first slept at Singita Ebony in 2018 and at Tswalu in the Kalahari in 2012.",
        "link": ("/safaris.html", "Wild &amp; Co Safaris"),
    },
    "botswana": {
        "name": "Botswana", "region": "africa", "destination": "southern-africa", "ne": "Botswana", "palette": "botswana-okavango",
        "region_label": "Southern Africa",
        "hero": ("wildco/partners/feline-fields/vintage-camp/vc-07", "A mokoro gliding through water lilies in the Okavango Delta"),
        "lede": "The Okavango Delta, the Linyanti and the Kwando.",
        "story": "James slept his way across the Delta in May 2026, from Mombo on Chief's Island to the Jao Reserve camps and Feline Fields in Khwai. He first came in 2012 for the Linyanti and the Kwando.",
        "link": ("/stays/feline-fields/", "Feline Fields, Botswana"),
    },
    "kenya": {
        "name": "Kenya", "region": "africa", "destination": "africa", "ne": "Kenya", "palette": "kenya-maasai-mara",
        "region_label": "East Africa", "region_bounds": EAST_AFRICA,
        "hero": ("wildco/rehost/wildebeest-emerging-from-the-river-great-migration", "Wildebeest emerging from the river during the Great Migration"),
        "lede": "The Maasai Mara and Laikipia.",
        "story": "James slept at Governors' Camp and Naboisho Camp on the Mara in 2012, inspected and approved Cottar's Bush Villa in the Olderkesi Conservancy in 2017, and counts Lewa House in Laikipia as a founder favourite.",
        "link": ("/gatherings-cottars-bush-villa.html", "Cottar&rsquo;s Bush Villa, Maasai Mara"),
    },
    "tanzania": {
        "name": "Tanzania", "region": "africa", "destination": "africa", "ne": "Tanzania", "palette": "tanzania",
        "region_label": "East Africa", "region_bounds": EAST_AFRICA,
        "hero": ("GettyImages-522040170", "A cheetah facing a thunderstorm on the Serengeti plains"),
        "lede": "The western Serengeti, the Ngorongoro Crater and Arusha.",
        "story": "James slept at all three Singita camps in the Grumeti, at Gibb's Farm in Karatu and at Legendary Lodge in Arusha in 2018. He first came in 2012, for Singita Faru Faru and the Ngorongoro Crater.",
        "link": ("/safaris.html", "Wild &amp; Co Safaris"),
    },
    # Fewer than MIN_STAYS stays: built for visitors, but "noindex, follow" and kept out of the sitemap until they grow.
    "zambia": {
        "name": "Zambia", "region": "africa", "destination": "africa", "ne": "Zambia", "palette": "zambia",
        "region_label": "Southern Africa", "region_bounds": [[10.0, -36.5], [41.0, -8.0]],
        "hero": ("wildco/zambia/wilderness-busanga-bush-camp/wilderness-busanga-bush-camp-3", "Lions on the Busanga Plains, Kafue National Park"),
        "lede": "The Zambezi, above Victoria Falls.",
        "story": "James slept at Tongabezi on the Zambezi near Livingstone in 2012, and it is still a founder favourite.",
        "link": ("/safaris.html", "Wild &amp; Co Safaris"),
    },
    "belize": {
        "name": "Belize", "region": "central-america", "destination": "belize", "ne": "Belize", "palette": "belize",
        "region_label": "Central America", "noun": ("Jungle Lodges & Stays", "jungle lodges"),
        "hero": ("GettyImages-1169946098", "A red-eyed tree frog on a rainforest stem"),
        "lede": "The Cayo District, Mountain Pine Ridge and the Blue Hole.",
        "story": "James has known Belize since 2006, when he slept at Chaa Creek and Hidden Valley and dove the Blue Hole.",
        "link": None,
    },
    "mexico": {
        "name": "Mexico", "region": "caribbean-mexico", "destination": "caribbean-mexico", "ne": "Mexico", "palette": "mexico-riviera-nayarit",
        "region_label": "Caribbean & Mexico", "noun": ("Villas & Stays", "villas and stays"),
        "bounds": [[-110.5, 17.5], [-99.5, 25.5]],   # the Pacific coast around the Riviera Nayarit, so the residence area reads
        "hero": ("wildco/voyages/home-hero/05-diver-and-humpback", "A diver hangs in deep blue water as a humpback whale passes close by"),
        "lede": "Punta Mita, on the Riviera Nayarit.",
        "story": "James stayed at Casa Koko in Punta Mita and met its host in September 2025.",
        "link": ("/gathering-casa-koko.html", "Casa Koko, Punta Mita"),
    },
    "st-barthelemy": {
        "name": "St. Barthélemy", "region": "caribbean-mexico", "destination": "caribbean-mexico", "ne": "St-Barthélemy", "palette": "st-barthelemy",
        "region_label": "Caribbean & Mexico", "noun": ("Hotels & Stays", "hotels"), "bounds": [[-65.2, 16.6], [-60.8, 19.2]],
        "hero": ("GettyImages-910074300", "A palm-fringed cove beneath a forested volcanic peak"),
        "lede": "The Côte Sauvage.",
        "story": "Le Toiny, on the island's wild southeast coast, is James's favourite place on St. Barts.",
        "link": None,
    },
    "bahamas": {
        "name": "The Bahamas", "region": "caribbean-mexico", "destination": "caribbean-mexico", "ne": "Bahamas", "palette": "bahamas-eleuthera-exumas",
        "region_label": "Caribbean & Mexico", "noun": ("Island Stays", "island stays"),
        "hero": ("gatherings/baymahni-exuma/baymahni-sandbar", "A swimmer walks out to a crescent sandbar in clear shallows in the Exumas"),
        "lede": "Where it started, in 1983.",
        "story": "Friends asked James to take them surfing on Eleuthera in 1983, and the travel designing began. In 2023 he stayed on Stocking Island in the Exumas with the Reef Ball Foundation.",
        "link": None,
    },
    "french-polynesia": {
        "name": "French Polynesia", "region": "oceania", "destination": "oceania", "ne": "Fr. Polynesia", "palette": "french-polynesia",
        "region_label": "Oceania", "noun": ("Island Stays", "island stays"), "wrap": True,
        "region_bounds": [[112.0, -47.0], [215.0, 0.0]], "bounds": [[206.0, -24.0], [222.0, -13.0]],
        "hero": ("gatherings/vahine-private-island-tahaa/vh-01", "Aerial view of a reef-fringed motu in the lagoon off Taha'a"),
        "lede": "Tahiti since 1996.",
        "story": "James has surfed, dived and explored Tahiti since 1996. Taha'a is his favourite of the islands, and he vetted Vahine Private Island there in 2025.",
        "link": None,
    },
    "united-states": {
        "name": "United States", "region": "usa-canada", "destination": "usa-canada", "ne": "United States of America", "palette": "united-states-utah",
        "region_label": "USA & Canada", "noun": ("Stays", "stays"), "bounds": [[-125.0, 24.0], [-66.5, 49.6]],
        "hero": ("GettyImages-1462563623", "Sandstone towers glowing at golden hour"),
        "lede": "Close to home, chosen just as carefully.",
        "story": "Ulum Moab in Utah, vetted in April 2023, is James's favourite family stay.",
        "link": None,
    },
    # Nothing on the map yet, so no page:
    "namibia": {
        "name": "Namibia", "region": "africa", "destination": "southern-africa", "ne": "Namibia", "palette": "namibia", "region_label": "Southern Africa",
        "hero": None, "lede": "", "story": "", "link": None,
    },
}


def geo(dest, ne):
    """Country bounds and neighbour label points from the destination's base data."""
    base = json.load(open(os.path.join(ROOT, "maps", "data", dest, "base.geojson")))
    meta = json.load(open(os.path.join(ROOT, "maps", "data", dest, "meta.json")))
    by = {}
    for f in base["features"]:
        p = f["properties"]
        if p["layer"] == "land" and p.get("name"):
            by.setdefault(p["name"], []).append(shape(f["geometry"]).buffer(0))
    me = unary_union(by[ne])
    x0, y0, x1, y1 = me.bounds
    px, py = (x1 - x0) * .06, (y1 - y0) * .06
    places = []
    for n, gs in by.items():
        g = unary_union(gs)
        big = max(getattr(g, "geoms", [g]), key=lambda q: q.area)
        if big.area < .4:
            continue
        pt = big.representative_point()
        places.append({"n": n.upper(), "c": [round(pt.x, 3), round(pt.y, 3)]})
    b = meta["bbox"]
    return [[round(x0 - px, 2), round(y0 - py, 2)], [round(x1 + px, 2), round(y1 + py, 2)]], [[b[0], b[1]], [b[2], b[3]]], places


def band(pal):
    return ('<div class="jw-page-terrain" aria-hidden="true" style="display:flex;height:6px">'
            + "".join(f'<i style="flex:1;background:{c}"></i>' for c, _ in pal["terrain_key"]) + "</div>")


def page(slug, c, mine, pal, siblings, head_links, masthead, footer, stance):
    name, reg = c["name"], REGIONS[c["region"]]
    rname = reg["name"]
    url = f"{ORIGIN}/stays/{c['region']}/{slug}/"
    pid, alt = c["hero"]
    bounds, rbounds, places = geo(c["destination"], c["ne"])
    rbounds = c.get("region_bounds") or rbounds
    bounds = c.get("bounds") or bounds
    thin = len(mine) < MIN_STAYS
    noun, faq_noun = c.get("noun", ("Safari Lodges & Stays", "safari lodges"))
    slept = [s for s in mine if (s.get("line") or "").startswith("Slept here")]
    years = sorted({int(s["year"]) for s in mine if s.get("year")})
    areas = []
    for s in mine:
        a = (s.get("area") or "").split(",")[-1].strip()
        if a and a not in areas:
            areas.append(a)
    title = f"{name} {noun} James Wild Knows Firsthand | James Wild Stays"
    desc = (f"Map of the {'' if len(mine) == 1 else str(len(mine)) + ' '}{name} {'stay' if len(mine) == 1 else 'stays'} James Wild has slept in or vetted in person: "
            f"{', '.join(areas[:4])}. Honest marks, approximate positions, personal replies.")
    cfg = {"destination": c["destination"], "region": rname, "regionLabel": c["region_label"], "country": name, "ne": c["ne"],
           "title": name, "subtitle": f"{len(mine)} {'stay' if len(mine) == 1 else 'stays'} · tap a pin", "bounds": bounds, "regionBounds": rbounds,
           "places": places, "listId": "jw-list", **({"wrap": True} if c.get("wrap") else {}),
           "palette": {"name": pal["name"], "accent": pal["accent"], "terrain_key": pal["terrain_key"]}}
    cfg_json = json.dumps(cfg, ensure_ascii=False, separators=(",", ":")).replace("</", "<\\/")

    by = {}
    for s in mine:
        by.setdefault((s.get("area") or "").split(",")[-1].strip() or name, []).append(s)
    li = lambda s: (f'<li>{f"<a href={chr(34)}{E(s["url"])}{chr(34)}>{E(s["name"])}</a>" if s.get("url") else E(s["name"])}'
                    f'<span>{E(" · ".join(x for x in [s.get("area"), s.get("line")] if x))}</span></li>')
    lists = "".join(f'<div class="jw-country"><h3>{E(a)}</h3><ul>' + "".join(li(s) for s in sorted(v, key=lambda x: x["name"])) + "</ul></div>"
                    for a, v in sorted(by.items(), key=lambda kv: -len(kv[1])))

    nl = [s["name"] for s in sorted(slept, key=lambda x: (-int(x.get("year") or 0), x["name"]))]
    join = lambda xs: xs[0] if len(xs) == 1 else ", ".join(xs[:-1]) + " and " + xs[-1]
    faq = []
    if nl:
        faq.append((f"Which {name} {faq_noun} has James Wild stayed at?",
                    f"{join(nl)}. Each one is on the map above with James's own line, and the list says when he was there."))
    else:
        faq.append((f"Which {name} {faq_noun} does James Wild know?",
                    " ".join(f"{s['name']}: {s['line']}." for s in mine if s.get("line")) + " Each one is on the map above."))
    if years:
        faq.append((f"When was James Wild last in {name}?",
                    f"{'May ' if any('May ' + str(years[-1]) in (s.get('line') or '') for s in mine) else ''}{years[-1]}."
                    + (f" His {name} stays on this page run from {years[0]} to {years[-1]}." if len(years) > 1 else "")))
    faq += [
        (f"How do I book a stay in {name}?",
         "Write to james@jameswildco.com or call 561.479.6355. Every enquiry gets a personal reply from someone who has been there, and if we have not been, we will say so."),
        ("Are the map positions exact?",
         "No. Pins are approximate, and private houses show an area only. The exact location comes with your booking."),
    ]
    graph = [
        {"@type": "CollectionPage", "@id": url + "#page", "url": url, "name": f"{name} · James Wild Stays", "description": desc,
         "isPartOf": {"@type": "WebSite", "name": "James Wild & Company", "url": ORIGIN + "/"},
         "about": {"@type": "Country", "name": name, "containedInPlace": {"@type": "Place", "name": rname}},
         "primaryImageOfPage": f"{CLD}c_fill,ar_1.91,g_auto,w_1200/f_jpg,q_auto/{pid}",
         "breadcrumb": {"@id": url + "#crumbs"}, "mainEntity": {"@id": url + "#stays"}},
        {"@type": "BreadcrumbList", "@id": url + "#crumbs", "itemListElement": [
            {"@type": "ListItem", "position": 1, "name": "The House", "item": ORIGIN + "/"},
            {"@type": "ListItem", "position": 2, "name": "James Wild Stays", "item": ORIGIN + "/stays.html"},
            {"@type": "ListItem", "position": 3, "name": rname, "item": f"{ORIGIN}/stays/{c['region']}/"},
            {"@type": "ListItem", "position": 4, "name": name, "item": url}]},
        {"@type": "ItemList", "@id": url + "#stays", "name": f"{name} stays James Wild knows", "numberOfItems": len(mine), "itemListElement": [
            {"@type": "ListItem", "position": i + 1, "item": {"@type": "LodgingBusiness", "name": s["name"],
             **({"url": ORIGIN + s["url"]} if s.get("url") else {}),
             "address": {"@type": "PostalAddress", "addressRegion": s.get("area", ""), "addressCountry": name},
             **({} if s.get("residence") else {"geo": {"@type": "GeoCoordinates", "latitude": s["lat"], "longitude": s["lng"]}})}}
            for i, s in enumerate(sorted(mine, key=lambda x: x["name"]))]},
        {"@type": "FAQPage", "mainEntity": [{"@type": "Question", "name": q, "acceptedAnswer": {"@type": "Answer", "text": a}} for q, a in faq]},
    ]
    ld = json.dumps({"@context": "https://schema.org", "@graph": graph}, ensure_ascii=False).replace("</", "<\\/")
    link_html = f'<p class="rg-link"><a class="stamp" href="{c["link"][0]}">{c["link"][1]} &rarr;</a></p>' if c.get("link") else ""
    sib = "".join(f'<a class="rg-card{" on" if k == slug else ""}" href="/stays/{v["region"]}/{k}/"{" aria-current=page" if k == slug else ""}>'
                  f'<img src="{CLD}c_fill,ar_4:3,g_auto,w_480/f_auto,q_auto/{v["hero"][0]}" alt="" loading="lazy" width="480" height="360">'
                  f'<span>{E(v["name"])}</span></a>' for k, v in siblings)
    terrain = " · ".join(E(n) for _, n in pal["terrain_key"])

    return f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{E(title)}</title>
<meta name="description" content="{E(desc)}">
<link rel="canonical" href="{url}">
<meta property="og:title" content="{E(name)} · James Wild Stays">
<meta property="og:description" content="{E(desc)}">
<meta property="og:type" content="website">
<meta property="og:url" content="{url}">
<meta property="og:image" content="{CLD}c_fill,ar_1.91,g_auto,w_1200/f_jpg,q_auto/{pid}">
<meta name="twitter:card" content="summary_large_image">
<meta name="theme-color" content="{pal['ground']}">{chr(10) + '<meta name="robots" content="noindex, follow">' if thin else ""}
{head_links}
<link rel="stylesheet" href="/maps/jw-maps.css">
<link rel="preconnect" href="https://res.cloudinary.com">
<style>
.crumbs{{font:400 var(--t-2xs,.72rem)/1.4 var(--mono);letter-spacing:.14em;text-transform:uppercase;margin:0 0 .9rem}}
.crumbs a{{color:inherit}} .crumbs span{{opacity:.6;margin:0 .45em}}
.rg-map{{padding:clamp(1.2rem,3vw,2.2rem) 0 0;border-bottom:3px solid {pal['accent']}}}
.rg-map .wrap{{max-width:min(1500px,100%)}}
.rg-count{{font:700 .72rem/1.4 var(--mono);letter-spacing:.14em;text-transform:uppercase;color:var(--ink-soft);margin:.9rem 0 1.4rem}}
.jw-lists{{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,300px),1fr));gap:1.6rem 2.4rem;margin-top:1.2rem}}
.jw-country h3{{font:400 var(--t-lg,1.35rem)/1.2 var(--display);margin:0 0 .5rem;padding-bottom:.4rem;border-bottom:1px solid {pal['accent']}}}
.jw-country ul{{list-style:none;margin:0;padding:0;display:grid;gap:.55rem}}
.jw-country li{{font:400 1rem/1.4 var(--serif)}} .jw-country li span{{display:block;font:400 .78rem/1.45 var(--mono);color:var(--ink-soft)}}
.rg-grid{{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(46%,180px),1fr));gap:.8rem;margin-top:1.2rem}}
.rg-card{{display:block;position:relative;color:var(--paper);text-decoration:none;border:1px solid var(--rule)}}
.rg-card img{{display:block;width:100%;height:auto;aspect-ratio:4/3;object-fit:cover;filter:saturate(.9)}}
.rg-card span{{position:absolute;left:0;right:0;bottom:0;padding:.7rem .8rem .6rem;font:400 1.05rem/1.2 var(--display);background:linear-gradient(transparent,rgba(30,24,18,.78))}}
.rg-card.on{{outline:2px solid {pal['accent']};outline-offset:2px}}
.rg-faq dt{{font:400 1.15rem/1.3 var(--display);margin-top:1.2rem}} .rg-faq dd{{margin:.35rem 0 0;max-width:68ch}}
.rg-link{{margin-top:1.2rem}}
.cn-pal{{font:400 .72rem/1.5 var(--mono);letter-spacing:.12em;text-transform:uppercase;color:var(--ink-soft);margin:.4rem 0 0}}
.cn-pal b{{color:{pal['accent']};font-weight:700}}
</style>
<script type="application/ld+json">{ld}</script>
</head>
<body>
{band(pal)}
{masthead}
<main id="main">

<section class="hero">
  <div class="hero__img">
    {hero_img(pid, alt)}
    <p class="hero__caption">{E(alt)}</p>
  </div>
  <div class="wrap hero__body">
    <nav class="crumbs" aria-label="Breadcrumb"><a href="/">The House</a><span>/</span><a href="/stays.html">James Wild Stays</a><span>/</span><a href="/stays/{c['region']}/">{E(rname)}</a><span>/</span>{E(name)}</nav>
    <div class="hero__eyebrow"><span class="stamp">James Wild Stays · By country</span><span class="stamp stamp--ink">Positions approximate</span></div>
    <h1>{E(name)}</h1>
    <p class="hero__sub">{E(c['lede'])} {E(c['story'])}</p>
  </div>
</section>

<section class="rg-map" aria-labelledby="map-h">
  <div class="wrap">
    <h2 class="visually-hidden" id="map-h" style="position:absolute;left:-9999px">Map of {E(name)}</h2>
    <div class="jw-maps jw-site" data-jw-map="country"><script type="application/json">{cfg_json}</script></div>
    <p class="rg-count">{len(mine)} {'stay' if len(mine) == 1 else 'stays'} on the map{f" · {len(slept)} slept in" if slept else ""} · Tap a pin for James's line</p>
  </div>
</section>

<section class="section" aria-labelledby="list-h">
  <div class="wrap">
    <div class="sechead rv"><span class="sechead__no">&#8470;</span><h2 class="sechead__title" id="list-h">Where James has been, in {E(name)}</h2><span class="sechead__note">From the ledger</span></div>
    <p class="cn-pal"><b>{E(pal['name'])} palette</b> · {terrain}</p>
    <div class="jw-lists" id="jw-list">{lists}</div>
    {link_html}
  </div>
</section>

<section class="section" style="padding-top:0" aria-labelledby="faq-h">
  <div class="wrap">
    <div class="sechead rv"><span class="sechead__no">?</span><h2 class="sechead__title" id="faq-h">Questions, answered plainly</h2></div>
    <dl class="rg-faq">{"".join(f"<dt>{E(q)}</dt><dd>{E(a)}</dd>" for q, a in faq)}</dl>
  </div>
</section>

<section class="section" style="padding-top:0" aria-labelledby="rg-h">
  <div class="wrap">
    <div class="sechead rv"><span class="sechead__no">&#8470;</span><h2 class="sechead__title" id="rg-h">More of {E(rname)}</h2><span class="sechead__note"><a href="/stays/{c['region']}/">Back to the {E(rname)} map</a></span></div>
    <div class="rg-grid">{sib}</div>
  </div>
</section>

{stance}
</main>
{footer}
<script src="/js/ledger.js" defer></script>
<script src="/maps/jw-embed.js" defer></script>
</body>
</html>
"""


def link_region_page(region, published):
    """On /stays/<region>/, turn each published country's list heading into a link (idempotent)."""
    p = os.path.join(ROOT, "stays", region, "index.html")
    if not os.path.exists(p):
        return
    t = open(p).read()
    t = re.sub(r'<h3><a class="cn-link" href="[^"]*">([^<]*) &rarr;</a></h3>', r"<h3>\1</h3>", t)
    for slug, c in published:
        t = t.replace(f'<div class="jw-country"><h3>{E(c["name"])}</h3>',
                      f'<div class="jw-country"><h3><a class="cn-link" href="/stays/{region}/{slug}/">{E(c["name"])} &rarr;</a></h3>', 1)
    open(p, "w").write(t)


def main():
    stays = json.load(open(os.path.join(ROOT, "maps", "data", "stays.json")))["stays"]
    pals = json.load(open(os.path.join(ROOT, "maps", "palettes.json")))["destinations"]
    head_links, masthead, footer, stance = chrome()
    masthead = nav_menu(masthead)
    ready, held = [], []
    for slug, c in COUNTRIES.items():
        mine = [s for s in stays if s["country"] == c["name"] and s.get("show", True) and s.get("lat") is not None]
        why = ("no stays on the map yet" if not mine else "no hero photo" if not c.get("hero")
               else f"no palette '{c['palette']}' in palettes.json" if c["palette"] not in pals else "")
        (held if why else ready).append((slug, c, mine, why))
    for region in {c["region"] for _, c, _, _ in ready}:
        sib = [(s, c) for s, c, _, _ in ready if c["region"] == region]
        for slug, c, mine, _ in [r for r in ready if r[1]["region"] == region]:
            d = os.path.join(ROOT, "stays", region, slug)
            os.makedirs(d, exist_ok=True)
            open(os.path.join(d, "index.html"), "w").write(page(slug, c, mine, pals[c["palette"]], sib, head_links, masthead, footer, stance))
            print("wrote", f"stays/{region}/{slug}/index.html", f"({len(mine)} stays{', noindex until ' + str(MIN_STAYS) if len(mine) < MIN_STAYS else ''})")
        link_region_page(region, sib)
    for slug, c, _, why in held:
        print("held ", slug, "-", why)
    # sitemap: add the country pages (build_region_pages.py rewrites it, so run this after it)
    sm = os.path.join(ROOT, "sitemap.xml")
    if os.path.exists(sm):
        t = open(sm).read()
        t = re.sub(r"  <url><loc>[^<]*/stays/[^/<]+/[^/<]+/</loc>.*?</url>\n", "", t)
        lm = re.search(r"<lastmod>([^<]+)</lastmod>", t)
        add = "".join(f"  <url><loc>{ORIGIN}/stays/{c['region']}/{s}/</loc><lastmod>{lm.group(1) if lm else ''}</lastmod></url>\n" for s, c, m, _ in ready if len(m) >= MIN_STAYS)
        open(sm, "w").write(t.replace("</urlset>", add + "</urlset>"))


if __name__ == "__main__":
    main()
