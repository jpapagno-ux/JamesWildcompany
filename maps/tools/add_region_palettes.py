"""Give every region page its James Wild palette (maps/palettes.json → regions).
- adds "palette" to the page's region map config (accent + terrain key); the patched jw-embed draws it on the map frame,
  the selected-country outline, the country chips and the terrain key line;
- puts the terrain band (five palette colours) across the top of the page.
Safe to run again. Usage, from the repo root:  python3 maps/tools/add_region_palettes.py
Fold it into tools/build_region_pages.py when convenient."""
import json, re, os, sys
ROOT = sys.argv[1] if len(sys.argv) > 1 else '.'
P = json.load(open(os.path.join(ROOT, 'maps', 'palettes.json')))['regions']
for slug, pal in P.items():
    f = os.path.join(ROOT, 'stays', slug, 'index.html')
    if not os.path.exists(f): print('skip (no page)', slug); continue
    h = open(f, encoding='utf-8').read()
    m = re.search(r'(data-jw-map="region"[^>]*>\s*<script type="application/json">)(.*?)(</script>)', h, re.S)
    if not m: print('skip (no region map)', slug); continue
    cfg = json.loads(m.group(2)); cfg['palette'] = dict(name=pal['name'], accent=pal['accent'], terrain_key=pal['terrain_key'])
    h = h[:m.start(2)] + json.dumps(cfg, ensure_ascii=False) + h[m.end(2):]
    band = '<div class="jw-page-terrain" aria-hidden="true" style="display:flex;height:6px">' + ''.join('<i style="flex:1;background:%s"></i>' % c for c, _ in pal['terrain_key']) + '</div>'
    if 'jw-page-terrain' in h: h = re.sub(r'<div class="jw-page-terrain".*?</div>', band, h, count=1, flags=re.S)
    else: h = h.replace('<body>', '<body>\n' + band, 1)
    open(f, 'w', encoding='utf-8').write(h); print('palette added', slug, pal['accent'])
