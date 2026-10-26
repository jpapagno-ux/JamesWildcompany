# jw-maps · the James Wild & Co. house map system

Served from the house site at `https://jameswildco.com/maps/`, so every volume (Stays, Voyages, Safaris, Gatherings, Expeditions) loads the same files.

```
maps/
  jw-maps.js, jw-maps.css     the library: atlas, stay and itinerary plates
  vendor/                     MapLibre GL 4.7.1 (BSD-3), served from our own domain
  data/<slug>/                one folder per destination: base.geojson, relief.webp, meta.json
  routes/<id>.json            one file per program, jw-route v1 (see tools/ROUTE_FORMAT.md)
  tools/                      build_destination.py, convert_route.py, ROUTE_FORMAT.md
  index.html                  working example of all four plates
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
