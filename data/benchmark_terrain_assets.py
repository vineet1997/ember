"""Encode and verify the lossless terrain-delivery candidate.

Terrain-RGB is measurement data: the R/G bytes determine the elevation used
for coastlines. A smaller file is useful only if its decoded RGB values are
identical to the PNG source. This tool writes lossless WebP siblings for every
currently built terrain field, verifies that property pixel-for-pixel, and
writes the machine-readable asset manifest used by ASSET_CONTRACT.md.

Run from the repository root:

    .venv\\Scripts\\python.exe data\\benchmark_terrain_assets.py

It deliberately does not change the film loader. Format selection belongs to
Phase 3; retaining the PNGs supplies the explicit fallback in the meantime.
"""
from __future__ import annotations

import json
import os
import sys
from pathlib import Path

from PIL import Image, ImageChops, __version__ as PILLOW_VERSION, features


ROOT = Path(__file__).resolve().parent.parent
TERRAIN = ROOT / "slice" / "data"
MANIFEST = ROOT / "data" / "terrain_asset_manifest.json"
SCALE = 0.30518043793392846
OFFSET = -11000.0
SLOW_4G_BPS = 1_440_000

FIELDS = (
    {
        "id": "global-overview",
        "png": "bathy_global.png",
        "tier": "initial",
        "sceneWindow": "Global fallback for the Beat 05–07 slice and Beat 12 unroll.",
        "extent": {"lon0": -180.0, "lon1": 180.0, "lat0": -90.0, "lat1": 90.0},
        "source": "ETOPO 2022 bedrock, area-resampled from data/bathymetry.png by slice/build_slice.py.",
        "precision": "Terrain-RGB: elevation_m = (R*256 + G)*0.30518043793392846 - 11000; max quantisation error 0.3061 m.",
    },
    {
        "id": "red-sea",
        "png": "bathy_redsea.png",
        "tier": "full",
        "sceneWindow": "Beat 05 — both possible Red Sea/Persian Gulf doors out of Africa.",
        "meta": "bathy_redsea.json",
        "source": "ETOPO 2022 bedrock at native 60 arc-seconds, cropped by data/build_beat0507.py.",
    },
    {
        "id": "sunda-wallacea",
        "png": "bathy_sunda.png",
        "tier": "full",
        "sceneWindow": "Beat 06 — Sunda, Wallacea and Sahul crossing.",
        "meta": "bathy_sunda.json",
        "source": "ETOPO 2022 bedrock at native 60 arc-seconds, cropped by data/build_beat06.py.",
    },
    {
        "id": "europe-west-asia",
        "png": "bathy_europe.png",
        "tier": "full",
        "sceneWindow": "Beat 07 — Europe and west Asia close orbital view.",
        "meta": "bathy_europe.json",
        "source": "ETOPO 2022 bedrock at native 60 arc-seconds, cropped by data/build_beat0507.py.",
    },
)


def bytes_mib(value: int) -> float:
    return round(value / 1_048_576, 3)


def field_record(spec: dict[str, object]) -> dict[str, object]:
    png = TERRAIN / str(spec["png"])
    webp = png.with_suffix(".webp")
    with Image.open(png) as source:
        source.load()
        rgb = source.convert("RGB")
        # quality is ignored for lossless WebP. Method 6 is the compact
        # candidate we compare against PNG; it may take several minutes over
        # all four rasters but does not alter the decoded terrain bytes.
        rgb.save(webp, "WEBP", lossless=True, quality=100, method=6, exact=True)
    with Image.open(webp) as candidate:
        candidate.load()
        candidate_rgb = candidate.convert("RGB")
        identical = ImageChops.difference(rgb, candidate_rgb).getbbox() is None
        dimensions = {"width": rgb.width, "height": rgb.height}
    if not identical:
        raise RuntimeError("lossless WebP changed terrain bytes: %s" % png.name)

    record = {
        "id": spec["id"],
        "deliveryTier": spec["tier"],
        "sceneWindow": spec["sceneWindow"],
        "dimensions": dimensions,
        "extent": spec.get("extent"),
        "source": spec["source"],
        "precision": spec.get(
            "precision",
            "Terrain-RGB: elevation_m = (R*256 + G)*0.30518043793392846 - 11000; "
            "native 60-arc-second source, max quantisation error 0.3052 m.",
        ),
        "formats": {
            "pngFallback": {"file": png.name, "bytes": png.stat().st_size, "mib": bytes_mib(png.stat().st_size)},
            "losslessWebP": {
                "file": webp.name,
                "bytes": webp.stat().st_size,
                "mib": bytes_mib(webp.stat().st_size),
                "pixelIdenticalToPng": identical,
            },
        },
    }
    if spec.get("meta"):
        tile = json.loads((TERRAIN / str(spec["meta"])).read_text(encoding="utf-8"))["tile"]
        record["extent"] = {key: tile[key] for key in ("lon0", "lon1", "lat0", "lat1")}
        record["kmPerPixel"] = tile["kmPerPx"]
        record["maxDecodeErrorM"] = tile["maxDecodeErrorM"]
    return record


def main() -> None:
    if not features.check("webp"):
        raise SystemExit("Pillow was built without WebP support; no candidate can be benchmarked.")

    records = [field_record(dict(spec)) for spec in FIELDS]
    png_total = sum(row["formats"]["pngFallback"]["bytes"] for row in records)
    webp_total = sum(row["formats"]["losslessWebP"]["bytes"] for row in records)
    initial = [row for row in records if row["deliveryTier"] == "initial"]
    startup_png = sum(row["formats"]["pngFallback"]["bytes"] for row in records if row["id"] in {"global-overview", "red-sea"})
    startup_webp = sum(row["formats"]["losslessWebP"]["bytes"] for row in records if row["id"] in {"global-overview", "red-sea"})

    manifest = {
        "schemaVersion": 1,
        "purpose": "Phase 1 delivery contract; an evidence-preserving terrain asset inventory.",
        "sourceDataset": "ETOPO 2022 bedrock at 60 arc-seconds; original grid is excluded by .gitignore and builders name their derivation.",
        "encoding": {"scale": SCALE, "offset": OFFSET, "channels": "R/G Terrain-RGB; B is unused."},
        "deliveryTiers": {
            "initial": {"status": "built", "fields": [row["id"] for row in initial]},
            "medium": {
                "status": "not-built",
                "fields": [],
                "note": "No medium corridor fields exist yet. Phase 2 must derive them from the original elevation grid; they must not be downscaled screenshots.",
            },
            "full": {"status": "built", "fields": [row["id"] for row in records if row["deliveryTier"] == "full"]},
        },
        "selectedFormat": {
            "delivery": "lossless WebP",
            "fallback": "Retained PNG with identical Terrain-RGB bytes.",
            "loaderStatus": "Not selected by the current loader; Phase 3 must use WebP only after feature detection and request the PNG fallback if unavailable.",
        },
        "benchmark": {
            "encoder": "Pillow %s, lossless WebP, method 6" % PILLOW_VERSION,
            "allFields": {
                "pngBytes": png_total,
                "pngMiB": bytes_mib(png_total),
                "webpBytes": webp_total,
                "webpMiB": bytes_mib(webp_total),
                "savingBytes": png_total - webp_total,
                "savingPercent": round((1 - webp_total / png_total) * 100, 2),
            },
            "startupGlobalAndRedSea": {
                "pngBytes": startup_png,
                "pngMiB": bytes_mib(startup_png),
                "webpBytes": startup_webp,
                "webpMiB": bytes_mib(startup_webp),
                "slow4gTransferOnlySeconds": {
                    "png": round(startup_png * 8 / SLOW_4G_BPS, 2),
                    "webp": round(startup_webp * 8 / SLOW_4G_BPS, 2),
                },
            },
        },
        "fields": records,
    }
    MANIFEST.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    print("lossless WebP verified pixel-identical for %d terrain fields" % len(records))
    print("all fields: %.3f MiB PNG -> %.3f MiB WebP (%.2f%% saved)" % (bytes_mib(png_total), bytes_mib(webp_total), manifest["benchmark"]["allFields"]["savingPercent"]))
    print("global + Red Sea: %.2fs -> %.2fs transfer-only at 1.44 Mbps" % (manifest["benchmark"]["startupGlobalAndRedSea"]["slow4gTransferOnlySeconds"]["png"], manifest["benchmark"]["startupGlobalAndRedSea"]["slow4gTransferOnlySeconds"]["webp"]))


if __name__ == "__main__":
    main()
