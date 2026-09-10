"""Phase 1 contract: narration is complete, sourced, and preserves key uncertainty."""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
story = json.loads((ROOT / "story" / "narration.json").read_text(encoding="utf-8"))
direction = json.loads((ROOT / "story" / "direction.json").read_text(encoding="utf-8"))
timeline = json.loads((ROOT / "timeline.json").read_text(encoding="utf-8"))

assert story["schema"] == 1 and story["mode"] == "spoken-narration"
assert [beat["id"] for beat in story["beats"]] == list(range(1, 15))
events = {event["id"]: event for event in timeline["events"]}
timeline_beats = {beat["id"]: beat for beat in timeline["beats"]}
direction_silences = {silence["id"] for silence in direction["silences"]}
seen_silences = set()
for beat in story["beats"]:
    assert beat["segments"], beat["id"]
    spoken = " ".join(beat["segments"])
    assert len(spoken.split()) >= 12, beat["id"]
    assert "inevitable" not in spoken.lower(), beat["id"]
    allowed = set(timeline_beats[beat["id"]]["events"])
    assert set(beat["claims"]).issubset(allowed), (beat["id"], set(beat["claims"]) - allowed)
    assert all(claim in events for claim in beat["claims"])
    seen_silences.update(beat["silence"])
assert seen_silences == direction_silences

b10 = next(beat for beat in story["beats"] if beat["id"] == 10)
b10_text = " ".join(b10["segments"]).lower()
assert "evidence falls quiet" in b10_text
assert "megafauna" not in b10_text and "animals stopped" not in b10_text

b14 = next(beat for beat in story["beats"] if beat["id"] == 14)
b14_text = " ".join(b14["segments"]).lower()
assert "forced" in b14_text and "single line" in b14_text

print("PASS Phase 1 — 14 sourced narration beats, uncertainty and final inclusion preserved")
