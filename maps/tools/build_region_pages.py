#!/usr/bin/env python3
"""Build the ten region pages: /stays/<slug>/index.html (plus the region index on the Stays page and sitemap.xml).

Reads maps/tools/regions.py (regions, hero photos, chip countries), maps/data/<slug>/base.geojson (country label
positions) and maps/data/stays.json (the written stay lists). Re-run after export_stays.py or after editing a region.
The page chrome (masthead, footer) is copied from stays.html so the pages always match the house site.
Usage: python3 maps/tools/build_region_pages.py
"""
import html, json, os, re, sys
from datetime import date
from shapely.geometry import shape
from shapely.ops import unary_union

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
sys.path.insert(0, HERE)
from regions import REGIONS

ORIGIN = "https://james-wild-and-company.vercel.app"
CLD = "https://res.cloudinary.com/jhlnq5h5/image/upload/"
E = lambda s: html.escape(str(s), quote=True)

# What James has said about each region (facts only; nothing invented). Each: (lede, paragraph, link or None)
STORY = {
    "africa": ("Where James has spent the most nights.",
               "South Africa and Botswana in May 2026; Tanzania and the Singita camps in 2018; Kenya, Botswana, Zambia and the Kalahari in 2012. A safari expert advisor since 2011, James keeps the lodges he would go back to, and says so when he has only inspected one.",
               ("/safaris.html", "Wild &amp; Co Safaris")),
    "asia": ("Islands first, the rest to follow.",
             "James sailed Raja Ampat in Indonesia aboard the Aliikai in November 2024. The Asia stays are being entered into the ledger now; ask and he will tell you which ones he knows.",
             None),
    "usa-canada": ("Close to home, chosen just as carefully.",
                   "Ulum Moab in Utah, vetted in April 2023, is James's favourite family stay. More of North America is being entered into the ledger.",
                   None),
    "central-america": ("Where James first went looking for waves.",
                        "James has explored and sold Costa Rica since 1991, mapped surf breaks into Nicaragua and Panama in the early 1990s, and has known Belize since 2006, when he slept at Chaa Creek and Hidden Valley and dove the Blue Hole.",
                        None),
    "caribbean-mexico": ("Where it started, in 1983.",
                         "Friends asked James to take them surfing on Eleuthera in the Bahamas, and the travel designing began. Since then: the Exumas with the Reef Ball Foundation in 2023, Casa Koko in Punta Mita in 2025, and Le Toiny, his favourite place on St. Barts.",
                         ("/gathering-casa-koko.html", "Casa Koko, Punta Mita")),
    "oceania": ("Tahiti since 1996.",
                "James has surfed, dived and explored Tahiti since 1996. Taha'a is his favourite of the islands, and he vetted Vahine Private Island there in 2025.",
                None),
    "south-america": ("The Galápagos since 1991.",
                      "The Galápagos have been on James's map since 1991, and the house field guide covers the islands and the yachts that sail them. The mainland stays are being entered into the ledger.",
                      None),
    "europe": ("Being entered into the ledger.",
               "The Europe stays are being recorded now. Until they are, ask James before you book: if he has not been, he will say so.",
               None),
    "antarctica": ("James was there when the world closed.",
                   "James sailed the Antarctic Peninsula aboard HX's MS Roald Amundsen in February 2020, and the ship was stranded when COVID closed the ports. The voyages south leave from Ushuaia and the Falklands.",
                   ("/captains-log-antarctica-2020.html", "The Captain's Log, Antarctica 2020")),
    "arctic": ("Iceland since 2007. Greenland next.",
               "James vetted Iceland in 2007. Greenland is on his list, and every Greenland mark says so until he has been.",
               None),
}


def chrome():
    src = open(os.path.join(ROOT, "stays.html")).read()
    head_links = re.search(r'<link rel="icon".*?<link rel="stylesheet" href="css/ledger.css">', src, re.S).group(0)
    masthead = re.search(r'<a class="skip".*?</header>', src, re.S).group(0)
    footer = re.search(r'<footer class="foot".*?</footer>', src, re.S).group(0)
    stance = re.search(r'<section class="stance">.*?</section>', src, re.S).group(0)
    absolute = lambda s: re.sub(r'(href|src)="(?!https?:|mailto:|tel:|#|/|data:)([^"]+)"', r'\1="/\2"', s)
    return absolute(head_links), absolute(masthead), absolute(footer), stance


def labels(slug, r):
    """Country name positions for the map, from the clipped land shapes."""
    base = json.load(open(os.path.join(ROOT, "maps", "data", slug, "base.geojson")))
    by = {}
    for f in base["features"]:
        if f["properties"]["layer"] == "land" and f["properties"].get("name"):
            by.setdefault(f["properties"]["name"], []).append(shape(f["geometry"]))
    out = []
    for disp, ne in r["countries"][:10]:
        if ne in by:
            g = unary_union([x.buffer(0) for x in by[ne]])
            big = max(getattr(g, "geoms", [g]), key=lambda p: p.area)
            if big.area < 0.02:
                continue
            p = big.representative_point()
            out.append({"n": disp.upper(), "c": [round(p.x, 3), round(p.y, 3)]})
    return out


def hero_img(pid, alt):
    s = lambda w: f"{CLD}c_fill,ar_21:9,g_auto,w_{w}/f_auto,q_auto/{pid}"
    return (f'<img src="{s(1920)}" srcset="{s(960)} 960w, {s(1440)} 1440w, {s(1920)} 1920w, {s(2560)} 2560w" '
            f'sizes="100vw" alt="{E(alt)}" width="1920" height="823" fetchpriority="high">')


def page(slug, r, stays, head_links, masthead, footer, stance):
    name = r["name"]
    mine = [s for s in stays if s["region"] == name and s.get("show", True) and s.get("lat") is not None]
    countries = sorted({s["country"] for s in mine})
    lede, para, link = STORY[slug]
    url = f"{ORIGIN}/stays/{slug}/"
    title = f"{name}: Stays James Wild Knows Firsthand | James Wild Stays"
    if mine:
        desc = (f"Map of the {name} stays James Wild has slept in or vetted in person — {len(mine)} so far across "
                f"{', '.join(countries[:5])}{' and more' if len(countries) > 5 else ''}. Honest marks, approximate positions, personal replies.")
    else:
        desc = f"The {name} map from James Wild Stays: every country in the region, with the stays James knows added as they are recorded. Ask before you book."
    pid, alt = r["hero"]
    cfg = {"destination": slug, "region": name, "title": name, "subtitle": "Tap a country to zoom in", "bounds": [[r["bbox"][0], r["bbox"][1]], [r["bbox"][2], r["bbox"][3]]],
           "countries": r["countries"], "places": labels(slug, r), "listId": "jw-list"}
    if slug == "oceania":
        cfg["bounds"] = [[112, -47], [215, 0]]
        cfg["wrap"] = True
    cfg_json = json.dumps(cfg, ensure_ascii=False, separators=(",", ":")).replace("</", "<\\/")

    by = {}
    for s in mine:
        by.setdefault(s["country"], []).append(s)
    if by:
        lists = "".join(
            f'<div class="jw-country"><h3>{E(c)}</h3><ul>' + "".join(
                f'<li>{f"<a href={chr(34)}{E(s["url"])}{chr(34)}>{E(s["name"])}</a>" if s.get("url") else E(s["name"])}'
                f'<span>{E(" · ".join(x for x in [s.get("area"), s.get("line")] if x))}</span></li>' for s in sorted(by[c], key=lambda x: x["name"]))
            + "</ul></div>" for c in sorted(by))
    else:
        lists = f'<p class="jw-none">No {E(name)} stays are on the map yet. They are added here as James records them.</p>'

    others = "".join(f'<a class="rg-card{" on" if k == slug else ""}" href="/stays/{k}/"{" aria-current=page" if k == slug else ""}>'
                     f'<img src="{CLD}c_fill,ar_4:3,g_auto,w_480/f_auto,q_auto/{v["hero"][0]}" alt="" loading="lazy" width="480" height="360">'
                     f'<span>{E(v["name"])}</span></a>' for k, v in REGIONS.items())

    faq = [
        (f"Has James Wild stayed at the {name} places on this map?",
         "Each pin carries James's honest mark. “I know a place” means he has slept there or vetted it in person; “I know the host” means he knows the people who run it. Where he has only inspected a place, the line says so."),
        (f"How do I book a stay in {name}?",
         "Write to james@jameswildco.com or call 561.479.6355. Every enquiry gets a personal reply from someone who has been there, and if we have not been, we will say so."),
        ("Are the map positions exact?",
         "No. Pins are approximate, and private houses show an area only. The exact location comes with your booking."),
    ]
    graph = [
        {"@type": "CollectionPage", "@id": url + "#page", "url": url, "name": f"{name} · James Wild Stays", "description": desc,
         "isPartOf": {"@type": "WebSite", "name": "James Wild & Company", "url": ORIGIN + "/"},
         "about": {"@type": "Place", "name": name}, "primaryImageOfPage": f"{CLD}c_fill,ar_1.91,g_auto,w_1200/f_jpg,q_auto/{pid}",
         "breadcrumb": {"@id": url + "#crumbs"}, "mainEntity": {"@id": url + "#stays"}},
        {"@type": "BreadcrumbList", "@id": url + "#crumbs", "itemListElement": [
            {"@type": "ListItem", "position": 1, "name": "The House", "item": ORIGIN + "/"},
            {"@type": "ListItem", "position": 2, "name": "James Wild Stays", "item": ORIGIN + "/stays.html"},
            {"@type": "ListItem", "position": 3, "name": name, "item": url}]},
        {"@type": "ItemList", "@id": url + "#stays", "name": f"{name} stays James Wild knows", "numberOfItems": len(mine), "itemListElement": [
            {"@type": "ListItem", "position": i + 1, "item": {"@type": "LodgingBusiness", "name": s["name"],
             **({"url": ORIGIN + s["url"]} if s.get("url") else {}),
             "address": {"@type": "PostalAddress", "addressRegion": s.get("area", ""), "addressCountry": s["country"]},
             **({} if s.get("residence") else {"geo": {"@type": "GeoCoordinates", "latitude": s["lat"], "longitude": s["lng"]}})}}
            for i, s in enumerate(sorted(mine, key=lambda x: (x["country"], x["name"])))]},
        {"@type": "FAQPage", "mainEntity": [{"@type": "Question", "name": q, "acceptedAnswer": {"@type": "Answer", "text": a}} for q, a in faq]},
    ]
    ld = json.dumps({"@context": "https://schema.org", "@graph": graph}, ensure_ascii=False).replace("</", "<\\/")
    link_html = f'<p class="rg-link"><a class="stamp" href="{link[0]}">{link[1]} &rarr;</a></p>' if link else ""
    count_line = f"{len(mine)} {'stay' if len(mine) == 1 else 'stays'} on the map · {len(countries)} {'country' if len(countries) == 1 else 'countries'}" if mine else "Stays added as they are recorded"

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
<meta name="theme-color" content="#f4f1e9">
{head_links}
<link rel="stylesheet" href="/maps/jw-maps.css">
<link rel="preconnect" href="https://res.cloudinary.com">
<style>
.crumbs{{font:400 var(--t-2xs,.72rem)/1.4 var(--mono);letter-spacing:.14em;text-transform:uppercase;margin:0 0 .9rem}}
.crumbs a{{color:inherit}} .crumbs span{{opacity:.6;margin:0 .45em}}
.rg-map{{padding:clamp(1.2rem,3vw,2.2rem) 0 0}}
.rg-map .wrap{{max-width:min(1500px,100%)}}
.rg-count{{font:700 .72rem/1.4 var(--mono);letter-spacing:.14em;text-transform:uppercase;color:var(--ink-soft);margin:.9rem 0 0}}
.jw-lists{{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,300px),1fr));gap:1.6rem 2.4rem;margin-top:1.2rem}}
.jw-country h3{{font:400 var(--t-lg,1.35rem)/1.2 var(--display);margin:0 0 .5rem;padding-bottom:.4rem;border-bottom:1px solid var(--rule)}}
.jw-country ul{{list-style:none;margin:0;padding:0;display:grid;gap:.55rem}}
.jw-country li{{font:400 1rem/1.4 var(--serif)}} .jw-country li span{{display:block;font:400 .78rem/1.45 var(--mono);color:var(--ink-soft)}}
.jw-none{{font-style:italic;color:var(--ink-soft)}}
.rg-grid{{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(46%,180px),1fr));gap:.8rem;margin-top:1.2rem}}
.rg-card{{display:block;position:relative;color:var(--paper);text-decoration:none;border:1px solid var(--rule)}}
.rg-card img{{display:block;width:100%;height:auto;aspect-ratio:4/3;object-fit:cover;filter:saturate(.9)}}
.rg-card span{{position:absolute;left:0;right:0;bottom:0;padding:.7rem .8rem .6rem;font:400 1.05rem/1.2 var(--display);background:linear-gradient(transparent,rgba(30,24,18,.78))}}
.rg-card.on{{outline:2px solid var(--ink);outline-offset:2px}}
.rg-faq dt{{font:400 1.15rem/1.3 var(--display);margin-top:1.2rem}} .rg-faq dd{{margin:.35rem 0 0;max-width:68ch}}
.rg-link{{margin-top:1.2rem}}
</style>
<script type="application/ld+json">{ld}</script>
</head>
<body>
{masthead}
<main id="main">

<section class="hero">
  <div class="hero__img">
    {hero_img(pid, alt)}
    <p class="hero__caption">{E(alt)}</p>
  </div>
  <div class="wrap hero__body">
    <nav class="crumbs" aria-label="Breadcrumb"><a href="/">The House</a><span>/</span><a href="/stays.html">James Wild Stays</a><span>/</span>{E(name)}</nav>
    <div class="hero__eyebrow"><span class="stamp">James Wild Stays · By region</span><span class="stamp stamp--ink">Positions approximate</span></div>
    <h1>{E(name)}</h1>
    <p class="hero__sub">{E(lede)} {E(para)}</p>
  </div>
</section>

<section class="rg-map" aria-labelledby="map-h">
  <div class="wrap">
    <h2 class="visually-hidden" id="map-h" style="position:absolute;left:-9999px">Map of {E(name)}</h2>
    <div class="jw-maps jw-site" data-jw-map="region"><script type="application/json">{cfg_json}</script></div>
    <p class="rg-count">{count_line} · Tap a pin for James's line</p>
  </div>
</section>

<section class="section" aria-labelledby="list-h">
  <div class="wrap">
    <div class="sechead rv"><span class="sechead__no">&#8470;</span><h2 class="sechead__title" id="list-h">Where James has been, in {E(name)}</h2><span class="sechead__note">From the ledger</span></div>
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
    <div class="sechead rv"><span class="sechead__no">&#8470;</span><h2 class="sechead__title" id="rg-h">Every region</h2><span class="sechead__note"><a href="/stays.html">Back to James Wild Stays</a></span></div>
    <div class="rg-grid">{others}</div>
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


def region_index():
    cards = "".join(f'<a class="rg-card" href="/stays/{k}/"><img src="{CLD}c_fill,ar_4:3,g_auto,w_480/f_auto,q_auto/{v["hero"][0]}" alt="" loading="lazy" width="480" height="360"><span>{E(v["name"])}</span></a>' for k, v in REGIONS.items())
    return ('<!-- jw-regions:start -->\n<section class="section" style="padding-top:0" aria-labelledby="jw-regions-h"><div class="wrap">'
            '<div class="sechead rv"><span class="sechead__no">&#8470;</span><h2 class="sechead__title" id="jw-regions-h">Explore by region</h2><span class="sechead__note">Ten maps · every country · the stays James knows</span></div>'
            '<style>.rg-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(46%,180px),1fr));gap:.8rem;margin-top:1.2rem}.rg-card{display:block;position:relative;color:var(--paper);text-decoration:none;border:1px solid var(--rule)}.rg-card img{display:block;width:100%;height:auto;aspect-ratio:4/3;object-fit:cover;filter:saturate(.9)}.rg-card span{position:absolute;left:0;right:0;bottom:0;padding:.7rem .8rem .6rem;font:400 1.05rem/1.2 var(--display);background:linear-gradient(transparent,rgba(30,24,18,.78))}</style>'
            f'<div class="rg-grid">{cards}</div></div></section>\n<!-- jw-regions:end -->')


def nav_menu(t):
    """Add the ten regions to the Stays drop-down on every page (idempotent)."""
    links = "".join(f'<a href="/stays/{k}/">{E(v["name"])}</a>' for k, v in REGIONS.items())
    block = f'<!--rg-->{links}<span style="display:block;height:1px;background:currentColor;opacity:.2;margin:.3rem 0"></span><!--/rg-->'
    t = re.sub(r'<!--rg-->.*?<!--/rg-->', '', t)
    return re.sub(r'(<span class="nav__menu" id="stays-menu">)', r'\1' + block, t, count=1)


def main():
    stays = json.load(open(os.path.join(ROOT, "maps", "data", "stays.json")))["stays"]
    head_links, masthead, footer, stance = chrome()
    masthead = nav_menu(masthead)
    for slug, r in REGIONS.items():
        d = os.path.join(ROOT, "stays", slug)
        os.makedirs(d, exist_ok=True)
        open(os.path.join(d, "index.html"), "w").write(page(slug, r, stays, head_links, masthead, footer, stance))
        print("wrote", f"stays/{slug}/index.html")
    # region index on the Stays page, right after "Where the collection is"
    p = os.path.join(ROOT, "stays.html"); t = open(p).read()
    t = re.sub(r'<!-- jw-regions:start -->.*?<!-- jw-regions:end -->\n?', '', t, flags=re.S)
    i = t.index("Where the collection is"); i = t.index("</section>", i) + len("</section>")
    t = t[:i] + "\n" + region_index() + t[i:]
    open(p, "w").write(t)
    # Stays drop-down on every page
    for f in os.listdir(ROOT):
        if f.endswith(".html"):
            p = os.path.join(ROOT, f); t = open(p).read(); n = nav_menu(t)
            if n != t:
                open(p, "w").write(n)
    # sitemap
    today = date.today().isoformat()
    public = ["stays.html", "safaris.html", "gatherings.html", "founder.html", "advisors.html", "advisor-james-papagno.html", "captains-log.html",
              "captains-log-antarctica-2020.html", "stay-sample-monwana.html", "stay-sample-leeu-live.html", "gathering-casa-koko.html", "gatherings-cottars-bush-villa.html"]
    urls = [ORIGIN + "/"] + [f"{ORIGIN}/{f}" for f in public if os.path.exists(os.path.join(ROOT, f))] + [f"{ORIGIN}/stays/{k}/" for k in list(REGIONS) + sorted(x for x in os.listdir(os.path.join(ROOT, "stays")) if x not in REGIONS and os.path.isdir(os.path.join(ROOT, "stays", x)))]
    open(os.path.join(ROOT, "sitemap.xml"), "w").write('<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
        + "".join(f"  <url><loc>{u}</loc><lastmod>{today}</lastmod></url>\n" for u in urls) + "</urlset>\n")
    rb = os.path.join(ROOT, "robots.txt"); t = open(rb).read()
    if "Sitemap:" not in t:
        open(rb, "w").write(t.rstrip() + f"\nSitemap: {ORIGIN}/sitemap.xml\n")


if __name__ == "__main__":
    main()
