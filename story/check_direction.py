"""Phase 0 contract: the story direction must stay complete and actionable."""
import json
from pathlib import Path


HERE = Path(__file__).resolve().parent
direction = json.loads((HERE / "direction.json").read_text(encoding="utf-8"))
markdown = (HERE / "DIRECTION.md").read_text(encoding="utf-8")

assert direction["schema"] == 1
assert direction["ui"]["filmElements"] == [
    "beat-date", "time-ruler", "place-evidence-labels", "subtitles"
]
assert direction["ui"]["subtitleMaxLines"] == 2
assert direction["ui"]["diagnosticsInFilm"] is False
assert len(direction["acts"]) == 4
assert [beat for act in direction["acts"] for beat in act["beats"]] == list(range(1, 15))
assert set(map(int, direction["beatContracts"])) == set(range(1, 15))
assert len(direction["silences"]) == 10
assert {item["id"] for item in direction["silences"]} == {
    "opening-globe", "qafzeh-burial", "endured-hold", "pale-withdrawal",
    "sungir-detail", "beringia-wind", "record-gap", "water-closes-routes",
    "atlas-reveal", "ancestral-fan"
}
for heading in ("## The story", "## The narrator", "## The screen", "## The four acts",
                "## Required silences", "## Narrative contracts by beat"):
    assert heading in markdown, heading
print("PASS Phase 0 — 14 beats, 4 acts, 10 intentional silences, one UI contract")
