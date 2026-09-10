"""Build the Phase 2 Terrain-RGB pyramid from elevation values, never pixels.

The source PNGs are the audited Terrain-RGB elevation grids generated from
ETOPO.  This tool decodes their 16-bit elevation quantity, area-averages that
quantity, then re-encodes it.  It never resizes a shaded world or averages the
two RGB channels independently (both would move a waterline).
"""
from __future__ import annotations

import hashlib
import json
from pathlib import Path

import numpy as np
from PIL import Image, ImageChops

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "slice" / "data"
OUT = ROOT / "data" / "terrain_pyramid_manifest.json"
SCALE, OFFSET = 0.30518043793392846, -11000.0
SEAS = (0.0, -68.3, -73.9, -77.0, -85.0, -131.0)

SPECS = (
    ("global-overview", ROOT / "data" / "bathymetry.png", None, "initial", (4,),
     "Whole-world opening fallback; no local geographic claim is permitted."),
    ("red-sea", DATA / "bathy_redsea.png", DATA / "bathy_redsea.json", "corridor", (2, 4),
     "Beat 05; broad shelf only below full resolution. Exact door bottlenecks require full."),
    ("sunda-wallacea", DATA / "bathy_sunda.png", DATA / "bathy_sunda.json", "corridor", (2, 4),
     "Beat 06; broad connectivity only below full resolution. The 70.5 km bottleneck requires full."),
    ("europe-west-asia", DATA / "bathy_europe.png", DATA / "bathy_europe.json", "corridor", (2, 4),
     "Beat 07; broad shelf and relief only below full resolution."),
)


def digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def decode(path: Path) -> np.ndarray:
    with Image.open(path) as im:
        a = np.asarray(im.convert("RGB"), np.uint16)
    return a[:, :, 0] * 256 + a[:, :, 1]


def encode(q: np.ndarray, path: Path) -> None:
    rgb = np.zeros((*q.shape, 3), np.uint8)
    rgb[:, :, 0] = (q >> 8).astype(np.uint8)
    rgb[:, :, 1] = (q & 255).astype(np.uint8)
    Image.fromarray(rgb, "RGB").save(path, optimize=True)


def average(q: np.ndarray, factor: int) -> np.ndarray:
    h, w = q.shape
    if h % factor or w % factor:
        raise ValueError("%s is not divisible by %d" % (q.shape, factor))
    # Round only after averaging the decoded elevation quantity.  This is the
    # float-mipmap rule from the renderer, performed offline and auditable.
    return np.rint(q.reshape(h // factor, factor, w // factor, factor).mean((1, 3))).astype(np.uint16)


def extent(meta: Path | None) -> dict[str, float]:
    if meta is None:
        return {"lon0": -180.0, "lon1": 180.0, "lat0": -90.0, "lat1": 90.0}
    tile = json.loads(meta.read_text(encoding="utf-8"))["tile"]
    return {key: tile[key] for key in ("lon0", "lon1", "lat0", "lat1")}


def coast_metrics(high: np.ndarray, low: np.ndarray) -> dict[str, dict[str, float]]:
    # The renderer linearly samples its float elevation texture.  Bilinear
    # expansion is its comparable high-grid representation, not an image resize
    # of a rendered frame.
    expanded = np.asarray(Image.fromarray(low, "I;16").resize((high.shape[1], high.shape[0]), Image.Resampling.BILINEAR), np.uint16)
    result = {}
    for sea in SEAS:
        threshold = (sea - OFFSET) / SCALE
        a, b = high > threshold, expanded > threshold
        result[str(sea)] = {
            "changedHighGridFraction": round(float(np.mean(a != b)), 6),
            "landFractionDeltaPercent": round(abs(float(a.mean() - b.mean()) * 100), 3),
        }
    return result


def write_webp(png: Path) -> dict[str, object]:
    webp = png.with_suffix(".webp")
    with Image.open(png) as im:
        rgb = im.convert("RGB")
        rgb.save(webp, "WEBP", lossless=True, quality=100, method=6, exact=True)
    with Image.open(webp) as im:
        identical = ImageChops.difference(rgb, im.convert("RGB")).getbbox() is None
    if not identical:
        raise RuntimeError("lossless WebP changed %s" % png.name)
    return {"file": webp.name, "bytes": webp.stat().st_size, "pixelIdenticalToPng": True}


def main() -> None:
    levels = []
    for field, source, meta, kind, factors, note in SPECS:
        high = decode(source)
        box = extent(meta)
        for factor in factors:
            tier = "overview" if factor == 4 else "medium"
            q = average(high, factor)
            stem = {"global-overview": "bathy_global", "red-sea": "bathy_redsea",
                    "sunda-wallacea": "bathy_sunda", "europe-west-asia": "bathy_europe"}[field]
            png = DATA / (stem + "_" + tier + ".png")
            encode(q, png)
            coast = coast_metrics(high, q)
            # A box average has a support radius of half a cell in each axis.
            # Phase 3 must additionally evaluate the actual coast at the pose;
            # this gate guarantees that even the averaging footprint is subpixel.
            footprint = round(factor * 2**.5 / 2, 3)
            entry = {
                "id": field + "-" + tier, "field": field, "tier": tier, "source": str(source.relative_to(ROOT)).replace("\\", "/"),
                "sourceSha256": digest(source), "derivation": "Decoded 16-bit Terrain-RGB elevation; exact %dx%d area average; re-encoded Terrain-RGB." % (factor, factor),
                "extent": box, "dimensions": {"width": int(q.shape[1]), "height": int(q.shape[0])},
                "precision": {"metresPerQuantisationStep": SCALE, "extraAverageRoundingErrorM": round(SCALE / 2, 4)},
                "png": {"file": png.name, "bytes": png.stat().st_size, "sha256": digest(png)},
                "webp": write_webp(png),
                "coastlineAgainstFull": coast,
                "screenSelection": {"maximumCoastDisagreementScreenPx": 0.75, "averagingFootprintFullTexels": footprint,
                    "maximumProjectedFullTexelPx": round(0.75 / footprint, 5),
                    "rule": "Use only if the projected full-resolution terrain texel is at or below maximumProjectedFullTexelPx; Phase 3 must also test the measured coast at its switch pose."},
                "claimScope": note,
            }
            levels.append(entry)
            print("%-28s %4dx%-4d  %.2f MiB PNG" % (entry["id"], q.shape[1], q.shape[0], png.stat().st_size / 1048576))
    manifest = {"schemaVersion": 1, "source": "ETOPO-derived Terrain-RGB fields already audited in Phase 1; no rendered image is an input.",
                "representativeFrames": [{"t": .280, "field": "red-sea"}, {"t": .335, "field": "sunda-wallacea"}, {"t": .404, "field": "europe-west-asia"}],
                "fullOnlyClaims": ["Red Sea door bottleneck measurements", "Wallacea minimum 70.5 km bottleneck", "Beat 07 close relief"], "levels": levels}
    OUT.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
