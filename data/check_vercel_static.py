"""Verify the static artifact Vercel will receive, without a Vercel account."""

from __future__ import annotations

import hashlib
import json
import re
import sys
from pathlib import Path

from build_vercel_static import OUT, TERRAIN_SOURCES, build, sha256


ROOT = Path(__file__).resolve().parents[1]


def fail(message: str) -> None:
    print("FAIL — " + message)
    raise SystemExit(1)


def read_map(path: Path) -> dict:
    text = path.read_text(encoding="utf-8")
    match = re.search(r"Object\.freeze\((\{.*\})\);", text, re.DOTALL)
    if not match:
        fail("the production terrain map is not a readable Object.freeze JSON payload")
    return json.loads(match.group(1))


def main() -> None:
    output = build()
    delivery = read_map(output / "slice" / "data" / "terrain_delivery.js")

    for stem, formats in delivery.items():
        for kind, url in formats.items():
            if not url.startswith("/terrain/"):
                fail("%s %s uses a mutable URL: %s" % (stem, kind, url))
            path = output / url.lstrip("/")
            if not path.is_file():
                fail("%s %s points at a missing object: %s" % (stem, kind, url))
            digest = path.name.split(".")[-2]
            if sha256(path)[:16] != digest:
                fail("%s does not carry its own content digest" % path.name)

    if list((output / "slice" / "data").glob("bathy_*.png")) or \
       list((output / "slice" / "data").glob("bathy_*.webp")):
        fail("a mutable slice terrain alias escaped into the deployment output")
    if (output / "data" / "bathymetry.png").exists() or (output / "data" / "ice_atlas.png").exists():
        fail("a mutable shared terrain alias escaped into the deployment output")

    refs = {
        "unroll/unroll.js": "../slice/data/bathy_global.png",
        "doors/doors.js": "../data/bathymetry.png",
    }
    for relative, old in refs.items():
        if old in (output / relative).read_text(encoding="utf-8"):
            fail("%s still requests %s" % (relative, old))

    config = json.loads((ROOT / "vercel.json").read_text(encoding="utf-8"))
    headers = config.get("headers", [])
    immutable = [h for h in headers if h.get("source") == "/terrain/:path*"]
    if len(immutable) != 1 or not any(
        h.get("key") == "Cache-Control" and h.get("value") == "public, max-age=31536000, immutable"
        for h in immutable[0].get("headers", [])
    ):
        fail("vercel.json does not give immutable terrain URLs a one-year cache contract")
    if config.get("redirects") != [{"source": "/", "destination": "/film/", "permanent": False}]:
        fail("the production root does not redirect into the master film's relative-URL base")
    if any(output.rglob("service-worker.js")):
        fail("a service worker entered the artifact without an offline-data decision")

    atlas = output / "film" / "atlas.html"
    if not atlas.is_file():
        fail("the no-WebGL readable atlas is missing from the deployment artifact")
    atlas_text = atlas.read_text(encoding="utf-8").lower()
    if atlas_text.count("<article") != 14 or atlas_text.count("<script"):
        fail("the readable atlas is not a script-free fourteen-beat fallback")

    total_bytes = sum(path.stat().st_size for path in output.rglob("*") if path.is_file())
    # Keep a little deployment-engineering discipline around the Hobby static
    # upload ceiling. This is a guard on the generated artifact, not a claim
    # about a particular account's plan or the Git provider's transfer path.
    if total_bytes >= 100_000_000:
        fail("static artifact is %d bytes, over the 100 MB delivery guard" % total_bytes)

    print("PASS — %d immutable terrain objects, mutable aliases absent, master root wired (%d bytes)."
          % (len(TERRAIN_SOURCES), total_bytes))


if __name__ == "__main__":
    main()
