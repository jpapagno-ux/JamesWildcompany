# jw-maps · the James Wild & Co. house map system

Served from the house site at `https://jameswildco.com/maps/`, so every volume (Stays, Voyages, Safaris, Gatherings, Expeditions) loads the same files.

```
maps/
  jw-maps.js, jw-maps.css     the library: atlas, stay and itinerary plates
  vendor/                     MapLibre GL 4.7.1 (BSD-3), served from our own domain
  data/<slug>/                one folder per destination: base.geojson, relief.webp, meta.json
  routes/<id>.json            one file per program, jw-route v1 (see tools/ROUTE_FORMAT.md)
  tools/                      build_destination.py, convert_route.py, ROUTE_FORMAT.md
  jw-embed.js                 drop-in loader for site pages (data-jw-map="stay" or "atlas"), loads MapLibre only when a map scrolls near
```

## Use on a page

```html
<link rel="stylesheet" href="/maps/vendor/maplibre-gl.css">
<link rel="stylesheet" href="/maps/jw-maps.css">
<div class="jw-maps"><div class="jw-frame chart"><div class="jw-map" id="voyage"></div></div><div class="jw-days" id="days"></div></div>
<script src="/maps/vendor/maplibre-gl.js"></script>
<script src="/maps/jw-maps.js"></script>
<script>
  JWMaps.config({ base: "/maps/data/" });
  fetch("/maps/routes/cruise-a-the-old-south.json").then(r => r.json())
    .then(route => JWMaps.itinerary("voyage", route, { daysEl: document.getElementById("days") }));
</script>
```

Always print the itinerary as text beside the map (`JWMaps.itineraryHTML(route)`), and the structured data from `JWMaps.jsonLD(route, url)`, so search engines and AI answers can read it.

## Add a destination
1. Add a line to `DESTINATIONS` in `tools/build_destination.py`: name, bounding box, home country, relief zoom (5 for a huge area, 7 for a country, 8 for a small island group).
2. Run `JW_MAPS_SRC=/path/to/src python3 tools/build_destination.py <slug>` (writes `data/<slug>/`). It needs the source folder (Natural Earth 1:10m GeoJSON, the NASA Blue Marble tiles from `@freetiler/nasa-bluemarble`, and the Natural Earth shaded relief), which stays outside the repo.

## Add a program
`python3 tools/convert_route.py <file.gpx|kml|csv|geojson> --destination <slug> --type voyage|overland --title "…"`

## Cost
Nothing per view. Everything is static files on Vercel. Mapbox is used only for an optional satellite still on stay pages: free up to 50,000 a month.

## Credits (keep on every map)
Natural Earth (public domain) · NASA Earth Observatory Blue Marble (public domain), tiles via FreeTiler · MapLibre GL (BSD-3).

## On the house site (jw-embed.js)
Each stay page carries a "Where it is" section:
```html
<link rel="stylesheet" href="maps/jw-maps.css">            <!-- in <head> -->
<div class="jw-maps jw-site" data-jw-map="stay"><script type="application/json">
  {"destination":"southern-africa","name":"Monwana","c":[31.1336,-24.4372],"mark":"know","region":"…","label":"…","note":"…",
   "country":[[16.3,-35],[33.2,-21.8]],"area":[[30.55,-25.15],[31.95,-23.95]]}
</script></div>
<script src="maps/jw-embed.js" defer></script>
```
Private houses add `"residence":true`: the map shows a 2 km area, never a pin. Never map anything a page says is unpublished (the Casa Koko whale shark swim).

## Regions and the stays feed (26 Oct 2026)
- Ten region pages at `/stays/<slug>/` (Africa, Asia, USA & Canada, Central America, Caribbean & Mexico, Oceania, South America,
  Europe, Antarctica, Arctic), set in `tools/regions.py` and written by `tools/build_region_pages.py`.
- Each has a full-width region map (`data-jw-map="region"`): every country outlined, tap a country or a chip to zoom, tap a pin for James's line.
- Stays come from one feed: Airtable Guide Library → **Map Stays** table → `/api/stays` (live once `AIRTABLE_TOKEN` is set in Vercel,
  5-minute cache), falling back to `data/stays.json`. Add a row in Airtable, tick **Show on Map**, and it appears on its region map.
- Refresh the committed copy and the written lists: `AIRTABLE_TOKEN=… python3 tools/export_stays.py && python3 tools/build_region_pages.py`.
- `data/world.geojson` is the simplified world land drawn behind every region map.

## Itinerary charts (HJW-01)

`data-jw-map="itinerary"` now draws the animated chart (`jw-chart.js` + `jw-chart.css`, with d3 7.8.5 vendored in `vendor/d3.min.js`) instead of MapLibre. Same jw-route v1 files in `routes/`; the region outline comes from `data/<destination>/base.geojson`, the globe from `data/world.geojson`.

```html
<div data-jw-map="itinerary"><script type="application/json">{"route":"magellan-discoverer-inaugural","kind":"voyage"}</script></div>
<script src="maps/jw-embed.js" defer></script>
```

Config: `route` or `routes:[…]` (several give route buttons), `destination`, `kind` (`voyage` | `overland`, sets the HJW-01 palette), `kicker`, `caption`, `alt`. Stops with `"nolabel": true` are steering points: the line bends through them without a hold. Add `"places"` to a route for engraved sea and land names. One chart per page. `"engine":"maplibre"` keeps the old MapLibre itinerary.
