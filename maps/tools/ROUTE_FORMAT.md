# jw-route v1

One JSON file per itinerary, in `maps/routes/<id>.json`. `tools/convert_route.py` writes it from GPX, KML, CSV, GeoJSON or a Voyages site page.

```json
{
  "id": "the-maya-road",
  "type": "overland",                 // "voyage" (chart frame) or "overland" (survey frame)
  "destination": "belize",            // folder in maps/data/
  "title": "The Maya road",
  "subtitle": "Belize & Tikal · 10 days · private guide",
  "mark": "know",                     // Ledger mark for the whole program (optional)
  "days": { "1": "Altun Ha", "2": "Lamanai" },
  "stops": [
    { "day": 1, "name": "Belize City · airport", "lat": 17.539, "lng": -88.308 },
    { "day": 2, "name": "Lamanai, up the New River", "lat": 17.765, "lng": -88.654, "mode": "boat",
      "path": [[-88.35, 17.76], [-88.56, 17.98], [-88.654, 17.765]] }
  ]
}
```

| Field on a stop | Meaning |
|---|---|
| `mode` | How you arrive at this stop: `sea`, `land`, `walk`, `road`, `boat`, `rail`, `air`, `heli`. Sets the line and the moving icon. |
| `path` | Optional real geometry for the leg into this stop (road, river, sea lane). Without it the leg is a straight line. |
| `time` | `AM`, `PM` or a clock time, shown in the day list. |
| `nolabel` | Draw the leg, but don't number or label the stop (a return to a lodge, a flight home). |
| `kind` | `airstrip`, `port`, `lodge` … for future icons. |

**Files I can convert**
- **Spreadsheet (CSV):** `day, name, lat, lng, mode`. The easiest to keep in Airtable.
- **GPX or KML:** waypoints become stops; a track becomes the real paths between them.
- **GeoJSON:** point features with `day`, `name`, `mode`, plus optional line features.
- **PDF or Word itineraries:** not machine-readable. Claude reads them and builds the CSV, and the coordinates are checked by hand.
