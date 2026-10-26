#!/usr/bin/env python3
"""Partner lodge brand pages: /stays/<slug>/index.html (first: Feline Fields, Botswana).

Facts come from the partner's own site; James's marks only from what he has said. Images live in Cloudinary
wildco/partners/<slug>/<camp>/ with credit to the partner. Usage: python3 maps/tools/build_partner_pages.py
"""
import json, os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from build_region_pages import chrome, nav_menu, ORIGIN, CLD, E, ROOT

SA_COUNTRY = [[19.5, -27.2], [29.8, -17.6]]   # Botswana

PARTNERS = {
    "feline-fields": dict(
        name="Feline Fields", country="Botswana", region=("africa", "Africa"), site="https://www.felinefields.com",
        title="Feline Fields, Botswana: Vintage Camp in Khwai and the Kalahari Lodge | James Wild Stays",
        desc="Feline Fields in Botswana: the Vintage Camp on the Khwai River at the edge of the Okavango Delta, where James Wild stayed in 2026, and the off-grid Lodge in the northern Kalahari. Maps, rooms, what to do and how to book.",
        hero=("wildco/partners/feline-fields/vintage-camp/vc-02", "The Vintage Camp dining tent lit at dusk"),
        lede="Two camps, one family, in northern Botswana: wet Delta at Khwai and dry Kalahari to the west, a 65-minute helicopter hop apart.",
        para="James stayed at the Vintage Camp in 2026. The Lodge is its sister in the northern Kalahari, near the Namibian border. Both are a partner of the house.",
        camps=[
            dict(id="vintage-camp", name="Feline Fields Vintage Camp", short="Vintage Camp", c=[23.8113, -19.0976], mark="know",
                 label="I know a place · slept here, 2026", region="Khwai · Okavango Delta · Botswana",
                 note="Khwai Airstrip is about 20 minutes away by road.",
                 area=[[23.2, -19.5], [24.4, -18.7]], ring="The camp (approximate)",
                 nearby=[dict(name="Khwai Airstrip", c=[23.79, -19.15]), dict(name="Maun", c=[23.42, -19.98])],
                 places=[dict(n="OKAVANGO DELTA", c=[22.9, -19.35]), dict(n="BOTSWANA", c=[24.5, -21.6], big=1)],
                 fields=[("Where", "Khwai, on the eastern edge of the Okavango Delta, Botswana"),
                         ("Access", "Khwai Airstrip, about 20 minutes by road · from Maun 15 minutes by helicopter, 20 by light aircraft, or about 2½ hours by road"),
                         ("Tents", "Eight bell tents with a king or twin bed and en-suite bathroom · two family tents, each with two bedrooms"),
                         ("The camp", "Lounge, dining and wellness tents · bucket showers filled with warm water · a wooden hot tub · Victorian décor with Moroccan touches"),
                         ("Days", "Morning and afternoon game drives · helicopter flights over the Delta · guided walks · mokoro on the channels · catch-and-release fishing · birding, with more than 450 species recorded · spa"),
                         ("Best for", "Couples, families and private groups · birders and anglers"),
                         ("Water", "Mokoro levels hold steady through the year here, as they don't depend on the annual flood"),
                         ("James", "Slept here, 2026")],
                 photos=[("vc-01", "A canvas bell tent in long grass under tall trees"), ("vc-03", "Inside a bell tent: bed, rugs and a writing desk"),
                         ("vc-04", "A game-drive vehicle crossing the Khwai floodplain"), ("vc-07", "A mokoro gliding through water lilies"),
                         ("vc-09", "Wattled cranes on the floodplain"), ("vc-05", "A helicopter on the airstrip, ready to fly the Delta"),
                         ("vc-06", "Guests on foot at the water's edge"), ("vc-08", "The wellness tent by lantern light"),
                         ("vc-10", "Fishing from the bank of a Delta channel")]),
            dict(id="lodge", name="Feline Fields Lodge", short="The Lodge", c=[21.8079, -19.9731], mark="who",
                 label="Partner lodge · sister to the Vintage Camp", region="Northern Kalahari · Botswana",
                 note="Off-grid and solar-powered, near the Namibian border.",
                 area=[[21.0, -20.5], [22.6, -19.4]], ring="The lodge (approximate)",
                 nearby=[dict(name="Okavango Delta →", c=[22.5, -19.55])],
                 places=[dict(n="KALAHARI", c=[22.2, -21.0], big=1), dict(n="NAMIBIA", c=[20.5, -19.8], big=1)],
                 fields=[("Where", "The northern Kalahari, west of the Okavango Delta, near the Namibian border, Botswana"),
                         ("Access", "From Maun 50 minutes by helicopter or about 3 hours by road · 65 minutes by helicopter from Khwai"),
                         ("Suites", "Three Bush Suites on raised decks · three two-storey Pool Suites, each with a private pool · one two-bedroom Family Villa with its own pool"),
                         ("The lodge", "Off-grid and solar-powered · 25 m lap pool and open-air bush gym · lounge, library and bar · bush breakfasts and dinners under the stars"),
                         ("Days", "Nature drives · walks with San guides and a visit to a San village · horse riding · fly-camp sleep-outs · sand biking, tennis and golf practice"),
                         ("Best for", "Privacy · couples · families · two couples sharing the Family Villa"),
                         ("James", "Partner lodge of the house; James's own stay was at the Vintage Camp")],
                 photos=[("fl-01", "The main lodge and pool at sunset"), ("fl-03", "A Pool Suite deck with its private pool"),
                         ("fl-02", "A suite opening onto the Kalahari"), ("fl-04", "A Bush Suite at dusk beneath a bare tree"),
                         ("fl-06", "The 25-metre lap pool from above"), ("fl-07", "Walking the Kalahari grassland with San guides"),
                         ("fl-08", "Horse riding at the lodge"), ("fl-09", "A fly-camp bed under canvas at sunset"),
                         ("fl-05", "The library and lounge")]),
        ],
        faq=[("Has James Wild stayed at Feline Fields?", "Yes, at the Vintage Camp in Khwai, in 2026. The Lodge in the northern Kalahari is its sister camp and a partner of the house."),
             ("Where is Feline Fields?", "In northern Botswana. The Vintage Camp is on the Khwai River at the eastern edge of the Okavango Delta; the Lodge is in the northern Kalahari, west of the Delta near the Namibian border."),
             ("How do you get there?", "Fly into Maun. The Vintage Camp is 15 minutes by helicopter to Khwai Airstrip, then about 20 minutes by road; the Lodge is 50 minutes by helicopter from Maun. The two are 65 minutes apart by helicopter."),
             ("How do I book?", "Write to james@jameswildco.com or call 561.479.6355 for a personal reply and dates priced for you.")],
    ),
}


def gallery(pid_base, photos):
    return '<div class="pt-gal">' + "".join(
        f'<figure><img src="{CLD}c_fill,ar_4:3,g_auto,w_800/f_auto,q_auto/{pid_base}/{p}" srcset="{CLD}c_fill,ar_4:3,g_auto,w_480/f_auto,q_auto/{pid_base}/{p} 480w, {CLD}c_fill,ar_4:3,g_auto,w_800/f_auto,q_auto/{pid_base}/{p} 800w" sizes="(max-width:600px) 100vw, 33vw" alt="{E(a)}" loading="lazy" width="800" height="600"><figcaption>{E(a)}</figcaption></figure>'
        for p, a in photos) + "</div>"


def page(slug, P, head_links, masthead, footer, stance):
    url = f"{ORIGIN}/stays/{slug}/"
    hero_pid, hero_alt = P["hero"]
    h = lambda w: f"{CLD}c_fill,ar_21:9,g_auto,w_{w}/f_auto,q_auto/{hero_pid}"
    camps_html, graph_items = "", []
    for i, c in enumerate(P["camps"]):
        cfg = dict(destination="southern-africa", name=c["name"], short=c["short"], c=c["c"], mark=c["mark"], label=c["label"], region=c["region"],
                   note=c["note"], country=SA_COUNTRY, area=c["area"], estateKm=1.0, ringLabel=c["ring"], zoom=10, nearby=c["nearby"], places=c["places"],
                   others=[dict(name=o["short"], c=o["c"], mark=o["mark"]) for o in P["camps"] if o is not c])
        j = json.dumps(cfg, ensure_ascii=False, separators=(",", ":")).replace("</", "<\\/")
        fields = "".join(f"<div><dt>{E(k)}</dt><dd>{E(v)}</dd></div>" for k, v in c["fields"])
        camps_html += f"""
<section class="section" id="{c['id']}" aria-labelledby="{c['id']}-h"{' style="padding-top:0"' if i else ''}>
  <div class="wrap">
    <div class="sechead rv"><span class="sechead__no">0{i + 1}</span><h2 class="sechead__title" id="{c['id']}-h">{E(c['name'])}</h2><span class="sechead__note">{E(c['label'])}</span></div>
    {gallery(f"wildco/partners/{slug}/{c['id']}", c['photos'][:3])}
    <dl class="fields rv" style="margin-top:1.4rem">{fields}</dl>
    <div class="jw-maps jw-site" data-jw-map="stay" style="margin-top:1.6rem"><script type="application/json">{j}</script></div>
    <p class="jw-where"><b>Where</b>{E(c['fields'][0][1])} · {E(c['fields'][1][1].split(' · ')[0])} · map position approximate</p>
    {gallery(f"wildco/partners/{slug}/{c['id']}", c['photos'][3:])}
  </div>
</section>"""
        graph_items.append({"@type": "LodgingBusiness", "@id": f"{url}#{c['id']}", "name": c["name"], "url": f"{url}#{c['id']}",
                            "brand": {"@id": url + "#brand"}, "description": c["fields"][2][1] + ". " + c["fields"][3][1] + ".",
                            "address": {"@type": "PostalAddress", "addressRegion": c["region"].split(" · ")[0], "addressCountry": "BW"},
                            "geo": {"@type": "GeoCoordinates", "latitude": c["c"][1], "longitude": c["c"][0]},
                            "image": [f"{CLD}c_fill,ar_4:3,g_auto,w_1200/f_jpg,q_auto/wildco/partners/{slug}/{c['id']}/{p}" for p, _ in c["photos"][:4]]})
    graph = [
        {"@type": "WebPage", "@id": url, "url": url, "name": P["title"], "description": P["desc"], "breadcrumb": {"@id": url + "#crumbs"},
         "about": [{"@id": url + "#brand"}] + [{"@id": f"{url}#{c['id']}"} for c in P["camps"]],
         "primaryImageOfPage": f"{CLD}c_fill,ar_1.91,g_auto,w_1200/f_jpg,q_auto/{hero_pid}"},
        {"@type": "Brand", "@id": url + "#brand", "name": P["name"], "url": P["site"]},
        {"@type": "BreadcrumbList", "@id": url + "#crumbs", "itemListElement": [
            {"@type": "ListItem", "position": 1, "name": "The House", "item": ORIGIN + "/"},
            {"@type": "ListItem", "position": 2, "name": "James Wild Stays", "item": ORIGIN + "/stays.html"},
            {"@type": "ListItem", "position": 3, "name": P["region"][1], "item": f"{ORIGIN}/stays/{P['region'][0]}/"},
            {"@type": "ListItem", "position": 4, "name": P["name"], "item": url}]},
        {"@type": "FAQPage", "mainEntity": [{"@type": "Question", "name": q, "acceptedAnswer": {"@type": "Answer", "text": a}} for q, a in P["faq"]]},
    ] + graph_items
    ld = json.dumps({"@context": "https://schema.org", "@graph": graph}, ensure_ascii=False).replace("</", "<\\/")
    jump = " · ".join(f'<a href="#{c["id"]}">{E(c["short"])}</a>' for c in P["camps"])
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{E(P['title'])}</title>
<meta name="description" content="{E(P['desc'])}">
<link rel="canonical" href="{url}">
<meta property="og:title" content="{E(P['name'])} · James Wild Stays">
<meta property="og:description" content="{E(P['desc'])}">
<meta property="og:type" content="website">
<meta property="og:url" content="{url}">
<meta property="og:image" content="{CLD}c_fill,ar_1.91,g_auto,w_1200/f_jpg,q_auto/{hero_pid}">
<meta name="twitter:card" content="summary_large_image">
<meta name="theme-color" content="#f4f1e9">
{head_links}
<link rel="stylesheet" href="/maps/jw-maps.css">
<link rel="preconnect" href="https://res.cloudinary.com">
<style>
.crumbs{{font:400 var(--t-2xs,.72rem)/1.4 var(--mono);letter-spacing:.14em;text-transform:uppercase;margin:0 0 .9rem}}
.crumbs a{{color:inherit}} .crumbs span{{opacity:.6;margin:0 .45em}}
.pt-jump{{font:700 .75rem/1.4 var(--mono);letter-spacing:.14em;text-transform:uppercase;margin-top:1rem}} .pt-jump a{{color:inherit}}
.pt-gal{{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,260px),1fr));gap:.8rem;margin-top:1.2rem}}
.pt-gal figure{{margin:0}} .pt-gal img{{display:block;width:100%;height:auto;aspect-ratio:4/3;object-fit:cover}}
.pt-gal figcaption{{font:400 .78rem/1.45 var(--mono);color:var(--ink-soft);margin-top:.35rem}}
.rg-faq dt{{font:400 1.15rem/1.3 var(--display);margin-top:1.2rem}} .rg-faq dd{{margin:.35rem 0 0;max-width:68ch}}
.pt-credit{{font:400 .75rem/1.6 var(--mono);color:var(--ink-soft);margin-top:1.4rem}}
</style>
<script type="application/ld+json">{ld}</script>
</head>
<body>
{masthead}
<main id="main">

<section class="hero">
  <div class="hero__img">
    <img src="{h(1920)}" srcset="{h(960)} 960w, {h(1440)} 1440w, {h(1920)} 1920w, {h(2560)} 2560w" sizes="100vw" alt="{E(hero_alt)}" width="1920" height="823" fetchpriority="high">
    <p class="hero__caption">{E(hero_alt)} · Photograph: {E(P['name'])}</p>
  </div>
  <div class="wrap hero__body">
    <nav class="crumbs" aria-label="Breadcrumb"><a href="/">The House</a><span>/</span><a href="/stays.html">James Wild Stays</a><span>/</span><a href="/stays/{P['region'][0]}/">{E(P['region'][1])}</a><span>/</span>{E(P['name'])}</nav>
    <div class="hero__eyebrow"><span class="stamp">Partner lodge · {E(P['country'])}</span><span class="stamp stamp--ink">Founder stayed · Vintage Camp 2026</span></div>
    <h1>{E(P['name'])}</h1>
    <p class="hero__sub">{E(P['lede'])} {E(P['para'])}</p>
    <p class="pt-jump">{jump} · <a href="/stays/{P['region'][0]}/">All of {E(P['region'][1])}</a></p>
  </div>
</section>
{camps_html}
<section class="section" style="padding-top:0" aria-labelledby="faq-h">
  <div class="wrap">
    <div class="sechead rv"><span class="sechead__no">?</span><h2 class="sechead__title" id="faq-h">Questions, answered plainly</h2></div>
    <dl class="rg-faq">{"".join(f"<dt>{E(q)}</dt><dd>{E(a)}</dd>" for q, a in P["faq"])}</dl>
    <p class="pt-credit">Photographs: {E(P['name'])}, used with credit as a partner of the house. Facts from <a href="{P['site']}" rel="noopener" target="_blank">felinefields.com</a>, confirmed with James before booking. Map positions approximate.</p>
    <p style="margin-top:1.2rem"><a class="stamp" href="/stays/{P['region'][0]}/">&larr; Back to {E(P['region'][1])}</a> <a class="stamp" href="/stays.html">James Wild Stays</a></p>
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


def main():
    head_links, masthead, footer, stance = chrome()
    masthead = nav_menu(masthead)
    sm = os.path.join(ROOT, "sitemap.xml"); smt = open(sm).read()
    for slug, P in PARTNERS.items():
        d = os.path.join(ROOT, "stays", slug); os.makedirs(d, exist_ok=True)
        open(os.path.join(d, "index.html"), "w").write(page(slug, P, head_links, masthead, footer, stance))
        u = f"{ORIGIN}/stays/{slug}/"
        if u not in smt:
            smt = smt.replace("</urlset>", f"  <url><loc>{u}</loc></url>\n</urlset>")
        print("wrote", f"stays/{slug}/index.html")
    open(sm, "w").write(smt)


if __name__ == "__main__":
    main()
