"""
Phase 5, step 1: the two data changes beats 05 and 07 require, written into
timeline.json rather than into the renderer.

  1. ranges[] - an indicative extent for the pale light. Beat 07 needs a
     population that OCCUPIES rather than travels, and the film had no grammar
     for that: routes[] is a spine, and a spine is the wrong shape for a
     resident population. Carries the same honesty note routes carry, plus a
     stronger one, because a range map reads as authority in a way a route
     does not.

  2. openQuestions/oq-law06 -> resolved. The Campanian Ignimbrite decision.

Idempotent: running it twice leaves the file in the same state.

Run:  python data/edit_timeline_p5.py
"""
import json, os, io

HERE = os.path.dirname(os.path.abspath(__file__))
TL = os.path.join(os.path.dirname(HERE), "timeline.json")

# Indicative only. Truncated at 60E to the beat's own frame, which means it
# leaves out the Altai - where Neanderthals demonstrably were, and where the
# beat's own ground register comes from. That truncation is a framing decision,
# not a claim about where they lived, and the on-screen label says so.
NEANDERTHAL_EXTENT = [
    [-9.0, 37.0], [-8.5, 43.0], [-2.0, 47.0], [-4.0, 51.0], [3.0, 53.5],
    [12.0, 53.0], [22.0, 52.5], [32.0, 52.0], [44.0, 51.0], [56.0, 53.0],
    [58.0, 48.0], [52.0, 43.5], [45.0, 40.5], [43.0, 36.5], [38.0, 33.5],
    [34.5, 31.5], [32.0, 36.0], [27.0, 37.5], [22.0, 37.5], [16.0, 39.0],
    [14.5, 40.5], [8.0, 40.0], [3.0, 41.5], [-2.0, 37.0],
]

RANGE = {
    "id": "neanderthal-extent",
    "label": "The others",
    "beat": 7,
    "kind": "occupied-range",
    "event": "neanderthal-extinction",
    "confidence": "band",
    "polygon": NEANDERTHAL_EXTENT,
    "note": "INDICATIVE CARTOGRAPHY, NOT A SOURCED RANGE MAP. A ring drawn to enclose "
            "the regions with well-known Neanderthal occupation inside this beat's "
            "frame. It is not a distribution, not an isopleth, and not derived from a "
            "site database. Confidence is 'band', so the renderer MUST draw it as a "
            "diffuse field and never as a boundary line - a hard outline here would "
            "claim a frontier that no source supports.",
    "truncation": "Clipped at 60E to the beat's frame. Neanderthals reached the Altai, "
                  "some 25 degrees further east; the beat's own ground register is a "
                  "fossil from there. The clip is framing, not evidence.",
    "retreatNote": "Higham 2014 finds the disappearance was spatially staggered rather "
                   "than simultaneous. The renderer must therefore withdraw this field "
                   "UNEVENLY and must NOT contract it toward a single last refuge - "
                   "there is no sourced last refuge, and drawing one would invent the "
                   "most memorable fact in the beat. The order in which patches go out "
                   "is fixed noise, carries no dates, and is labelled as such on screen.",
}

# Beat 05 exposed a tension between two entries that had never been rendered in
# the same frame before. dispersal-route is confidence "band" and says the route
# is UNRESOLVED between two doors - but routes[] carried only ONE spine, the
# southern one. A renderer following routes[] literally draws a plume through
# Bab-el-Mandeb and has chosen the route on the reader's behalf, in the film's
# only locked shot, for ten thousand years of scroll.
#
# The fix is not a caption. It is the second spine, at exactly the same
# evidential standing as the first: indicative cartography, declared as such.
# Adding it REDUCES what the film claims.
BREAKOUT_NORTH = {
    "id": "breakout-north",
    "label": "The line that held, by Sinai",
    "beat": 5,
    "fate": "holds",
    "path": [[32.0, 19.0], [33.0, 24.0], [33.5, 28.0], [34.3, 30.2],
             [36.0, 33.0], [42.0, 32.0], [49.0, 28.0], [57.0, 23.0]],
    "note": "Indicative cartographic path, not a sourced trajectory. The NORTHERN of the "
            "two candidate doors. It exists because dispersal-route is confidence 'band' "
            "and the film had geometry for only one of the two routes it says are "
            "unresolved - which meant the renderer would have chosen. Drawn as a plume "
            "alongside breakout, at equal weight, neither favoured.",
    "convergence": "Both spines end at 57E 23N, where to-sahul begins. That convergence is "
                   "structural, not evidential: whichever door was used, the line that "
                   "held went east afterwards, and beat 06 has to be able to pick it up.",
}

DECISION = {
    "id": "oq-law06",
    "severity": "decision",
    "resolvedOn": "2026-09-07",
    "question": "Does Law 06 admit epistemic causation?",
    "decision": "LAW 06 WIDENS, AND THE REGISTER SAYS WHICH. The law now reads: nothing "
                "on screen that isn't causal - for what happened, or for how we know it. "
                "The Campanian Ignimbrite stays, on the time rail and in the record "
                "voice. It may not touch world state: no ash, no greyed sky, no dimmed "
                "light, no camera move. The eruption is drawn and the world does not "
                "notice.",
    "rationale": "The film already built this register and shipped it. Beat 06 draws "
                 "Madjedbebe's contested 65 ka reading ON THE TIME RAIL, NOT ON THE MAP, "
                 "precisely so a claim about when cannot move the world - and the copy "
                 "check already tests that. So the grammar for 'this is epistemic, not "
                 "causal' exists, is enforced, and works. The narrow reading of Law 06 "
                 "would cut the best-dated horizon in European prehistory out of the one "
                 "beat whose whole difficulty is WHEN. A law that makes the film discard "
                 "its most precise instrument is measuring the wrong thing.",
    "whyThisIsNotALoosening": "The widening ships with a bar the old law did not have, "
                              "and the bar is machine-checked rather than promised. An "
                              "epistemic object may not perturb stateFor(t). The law06 "
                              "test samples every world channel densely across the "
                              "eruption instant and fails on any step. Under the old law "
                              "the CI was cut for a staging - 'it greyed the sky exactly "
                              "as their light failed' - that no test would have caught. "
                              "The new law catches exactly that staging.",
    "changes": [
        "Law 06 text amended in CLAUDE.md and storyboard.html",
        "campanian-ignimbrite stays in beat 07, epistemic register only",
        "new law06 test in the director's panel, alongside purity and copy",
        "beat 07 record voice states the demotion on screen",
    ],
}


def main():
    tl = json.load(io.open(TL, encoding="utf-8"))

    tl.setdefault("ranges", [])
    tl["ranges"] = [r for r in tl["ranges"] if r["id"] != RANGE["id"]] + [RANGE]

    tl["routes"] = [r for r in tl["routes"] if r["id"] != BREAKOUT_NORTH["id"]]
    at = max(i for i, r in enumerate(tl["routes"]) if r["id"] == "breakout") + 1
    tl["routes"].insert(at, BREAKOUT_NORTH)

    # the southern spine is now one of a pair and must say so
    for r in tl["routes"]:
        if r["id"] == "breakout":
            r["label"] = "The line that held, by Bab-el-Mandeb"
            r["pairedWith"] = "breakout-north"
            r["note"] = ("Indicative cartographic path, not a sourced trajectory. The "
                         "SOUTHERN of the two candidate doors, and for most of this "
                         "project the only one with geometry - which would have made the "
                         "renderer choose a route the evidence leaves open. Drawn as a "
                         "plume alongside breakout-north, at equal weight, neither "
                         "favoured. See event dispersal-route, confidence 'band'.")

    oq = [q for q in tl["openQuestions"] if q["id"] != "oq-law06"]
    moved = len(oq) != len(tl["openQuestions"])
    tl["openQuestions"] = oq
    tl["resolved"] = [r for r in tl["resolved"] if r.get("id") != "oq-law06"] + [DECISION]

    json.dump(tl, io.open(TL, "w", encoding="utf-8"), indent=1, ensure_ascii=False)
    print("ranges: %d  (neanderthal-extent, %d vertices)"
          % (len(tl["ranges"]), len(NEANDERTHAL_EXTENT)))
    print("openQuestions: %d  (oq-law06 %s)"
          % (len(tl["openQuestions"]), "moved to resolved" if moved else "already moved"))
    print("resolved: %d" % len(tl["resolved"]))
    for q in tl["openQuestions"]:
        print("  still open: %-22s %s" % (q["id"], q["question"]))


if __name__ == "__main__":
    main()
