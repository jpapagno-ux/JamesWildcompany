#!/usr/bin/env python3
"""Refresh maps/data/stays.json (the fallback copy and the written lists on the region pages) from Airtable.
Usage: AIRTABLE_TOKEN=... python3 maps/tools/export_stays.py   then rebuild the pages: python3 maps/tools/build_region_pages.py"""
import json, os, urllib.request, urllib.parse
BASE, TABLE = "appG0YxRHYBjuCiBP", "tblaMXm0QBzn8hHWL"
HERE = os.path.dirname(os.path.abspath(__file__))
rows, offset = [], ""
while True:
    q = {"pageSize": "100"}
    if offset: q["offset"] = offset
    req = urllib.request.Request(f"https://api.airtable.com/v0/{BASE}/{TABLE}?" + urllib.parse.urlencode(q), headers={"Authorization": "Bearer " + os.environ["AIRTABLE_TOKEN"]})
    d = json.load(urllib.request.urlopen(req))
    for r in d["records"]:
        f = r["fields"]
        url = (f.get("Page URL") or "").replace("https://jameswildco.com", "").replace("https://james-wild-and-company.vercel.app", "")
        rows.append(dict(name=f.get("Stay", ""), region=f.get("Region", ""), country=f.get("Country", ""), area=f.get("Area", ""),
                         lat=f.get("Latitude"), lng=f.get("Longitude"), mark=f.get("Mark", "I know a place"), line=f.get("James's Line", ""),
                         year=f.get("Year", ""), url=url, residence=bool(f.get("Residence")) or f.get("Type") == "Family residence",
                         type={"Stay": "stay", "Vessel launch": "port", "Reserve": "reserve", "Family residence": "residence"}.get(f.get("Type"), "residence" if f.get("Residence") else "stay"), show=bool(f.get("Show on Map")) and f.get("Latitude") is not None))
    offset = d.get("offset")
    if not offset: break
json.dump({"source": "Airtable Guide Library · Map Stays", "stays": rows}, open(os.path.join(HERE, "..", "data", "stays.json"), "w"), ensure_ascii=False, separators=(",", ":"))
print(len(rows), "stays")
