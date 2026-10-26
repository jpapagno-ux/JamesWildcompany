#!/usr/bin/env python3
"""Soften the edges of each destination's relief image so its data frame never shows as a box.

The relief (land shading and sea depth tint) stops at the destination's bbox. On wide maps and on the
zoomed-out Region steps the map shows past that edge, and the open-sea tint read as a big rectangle.
Two passes fix it:
- coast: the sea tint is kept near land (the shelf and slope, where depth reads) and fades out over
  open water, so there is no tinted panel to see;
- edges: alpha fades to nothing over the outer band of each edge (smoothstep), so land shading and any
  remaining tint melt into the plain hatched sea and world land beyond.

Safe to run again: meta.json records "feathered" and a feathered image is skipped. A rebuilt relief
(tools/build_destination.py) comes out unfeathered, so run this after every rebuild.
Usage, from the repo root:  python3 maps/tools/feather_relief.py [slug ...]   (no slug = every destination)
"""
import json, os, sys
import numpy as np
from PIL import Image, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(HERE, "..", "data")
BAND = 0.07   # fraction of the shorter side faded on each edge
COAST = 0.05  # how far the sea tint reaches from land, as a fraction of the shorter side
SEA = np.array([31, 86, 115], dtype=np.float32)   # the relief's sea colour (build_destination.py)


def feather(slug):
    d = os.path.join(DATA, slug)
    img_p, meta_p = os.path.join(d, "relief.webp"), os.path.join(d, "meta.json")
    if not (os.path.exists(img_p) and os.path.exists(meta_p)):
        return "skip (no relief)"
    meta = json.load(open(meta_p))
    if meta.get("relief", {}).get("feathered"):
        return "skip (already feathered)"
    im = Image.open(img_p).convert("RGBA")
    a = np.asarray(im, dtype=np.float32)
    H, W = a.shape[:2]
    f = max(18.0, BAND * min(W, H))
    x = np.minimum(np.arange(W) + .5, W - np.arange(W) - .5) / f
    y = np.minimum(np.arange(H) + .5, H - np.arange(H) - .5) / f
    s = lambda t: (lambda c: c * c * (3 - 2 * c))(np.clip(t, 0, 1))
    ramp = np.outer(s(y), s(x))
    sea = (np.abs(a[..., :3] - SEA).sum(-1) < 12).astype(np.float32)
    land = Image.fromarray(((1 - sea) * 255).astype(np.uint8))
    r = max(6.0, COAST * min(W, H))
    near = np.asarray(land.filter(ImageFilter.GaussianBlur(r)), dtype=np.float32) / 255
    near = s(near * 4)                       # 1 at the coast, easing to 0 a few radii offshore
    a[..., 3] *= (1 - sea) + sea * near
    a[..., 3] *= ramp
    before = os.path.getsize(img_p)
    Image.fromarray(np.clip(a, 0, 255).astype(np.uint8), "RGBA").save(img_p, "WEBP", quality=88, method=4)
    meta.setdefault("relief", {})["feathered"] = {"edge": BAND, "coast": COAST}
    json.dump(meta, open(meta_p, "w"), indent=1, ensure_ascii=False)
    return f"feathered {W}x{H}, band {int(f)} px, {before // 1024} -> {os.path.getsize(img_p) // 1024} KB"


if __name__ == "__main__":
    slugs = sys.argv[1:] or sorted(x for x in os.listdir(DATA) if os.path.isdir(os.path.join(DATA, x)))
    for s in slugs:
        print(s, feather(s))
