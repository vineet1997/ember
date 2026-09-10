"""Validate the Phase 2 pyramid's source, topology and screen-space guard."""
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
M = json.loads((ROOT / "data" / "terrain_pyramid_manifest.json").read_text(encoding="utf-8"))

def sha(path): return hashlib.sha256(path.read_bytes()).hexdigest()

assert len(M["levels"]) == 7, "one small global overview and two levels per corridor"
for level in M["levels"]:
    source = ROOT / level["source"]
    png = ROOT / "slice" / "data" / level["png"]["file"]
    webp = ROOT / "slice" / "data" / level["webp"]["file"]
    assert sha(source) == level["sourceSha256"], level["id"] + " source changed; rebuild pyramid"
    assert sha(png) == level["png"]["sha256"], level["id"] + " PNG changed; rebuild pyramid"
    assert webp.exists() and level["webp"]["pixelIdenticalToPng"], level["id"] + " WebP is not verified"
    guard = level["screenSelection"]
    assert guard["maximumProjectedFullTexelPx"] is None or guard["maximumProjectedFullTexelPx"] > 0
    assert all(row["landFractionDeltaPercent"] <= 1.0 for row in level["coastlineAgainstFull"].values()), level["id"] + " changes shelf extent"
assert "Wallacea minimum 70.5 km bottleneck" in M["fullOnlyClaims"]
doors = json.loads((ROOT / "slice" / "data" / "doors.json").read_text(encoding="utf-8"))
assert all(row["dry"] for row in doors["rows"] if row["doorId"] == "sinai")
assert not any(row["dry"] for row in doors["rows"] if row["doorId"] == "bab-el-mandeb")
wallacea = json.loads((ROOT / "slice" / "data" / "wallacea_gap.json").read_text(encoding="utf-8"))
assert min(row["bottleneckKm"] for row in wallacea["rows"] if row["minIslandPx"] == 1) >= 70.0
sunda = json.loads((ROOT / "slice" / "data" / "bathy_sunda.json").read_text(encoding="utf-8"))
assert all("mainland Asia" in row["sunda"] and "Australia" in row["sahul"] for row in sunda["checks"])
print("PASS terrain pyramid — 7 elevation-derived levels, source-checked shelves, and explicit full-only Red Sea/Wallacea claim gates")
