"""Build unroll/data/beat12.json from timeline.json.

    python unroll/build_unroll.py

WHY A BUILDER AND NOT A TABLE IN THE JS. The first version of the unroll slice
carried its six centres as a literal array, and within one build it had invented
an unsourced Fertile Crescent that was already in the record with coordinates,
and had drawn the Sahel inside a beat the data puts it after. Both are Law 07's
argument one level out: a surface the check cannot see is a surface that drifts.
Nothing goes on screen that is not in timeline.json, so the slice reads the
record and this file is the transport.

IT AUTHORS NOTHING and it REFUSES rather than guesses. A centre with no
coordinates, a source that does not resolve, or a centre that does not yet EXIST
by the time the beat closes stops the build. That last one is the check that
would have caught the Sahel before it was ever drawn - and the first version of
it measured the wrong quantity and rejected two centres that belong here. Read
the comment on it; it is the most useful thing in this file.
"""
import io, json, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
BEAT = 12

# The one fixed light beat 12 opens on is not beat 12's own: the storyboard's
# frame says "the one fixed light from the end of beat 11 is joined, one by one,
# by others that have nothing to do with it". It is carried in explicitly, with
# the reason, rather than being swept up by a filter that would then be lying
# about which beat it belongs to.
INHERITED = {"fertile-crescent":
             "beat 11 fixes this one in place at 11.5 ka while the sea is "
             "still rising; beat 12 opens on it already lit."}


def main():
    tl = json.load(io.open(os.path.join(ROOT, "timeline.json"), encoding="utf-8"))
    beats = {b["id"]: b for b in tl["beats"]}
    ev = {e["id"]: e for e in tl["events"]}
    b12 = beats[BEAT]
    y0, y1 = b12["yearsBP"]

    ids = [e["id"] for e in tl["events"]
           if e.get("beat") == BEAT and e.get("type") == "domestication"
           and e.get("coordinates")]
    ids = list(INHERITED.keys()) + ids

    out, problems = [], []
    for i in ids:
        e = ev.get(i)
        if not e:
            problems.append("%s is drawn and is not in the record" % i)
            continue
        if not e.get("coordinates"):
            problems.append("%s has no coordinates" % i)
            continue
        for sid in e.get("sourceIds", []):
            if sid not in tl["sources"]:
                problems.append("%s cites %s, which is not in the bibliography"
                                % (i, sid))
        # THE CHECK THAT CATCHES THE SAHEL - and the first version of it
        # measured the wrong quantity, which is this project's signature
        # mistake, so it is worth writing down what it now measures.
        #
        # The first version required the date range to OVERLAP the beat: a
        # light drawn in a beat has to have happened during it. That is a
        # ceiling claim and it is false. It rejected the Fertile Crescent
        # (11,500 BP) and Mesoamerican maize (9,000 BP), both of which are
        # correctly in this beat - and rejecting them said something true that
        # the first version could not hear: MOST OF BEAT 12'S CENTRES PREDATE
        # BEAT 12. Domestication starts around 10-9 ka in several places, and
        # 8-5 ka is not when each of them happened, it is when all of them are
        # true at once. That is what the beat is about, and it is the reason
        # Law 03's atlas register exists: the atlas is the register for
        # simultaneity, and the data says this beat is a simultaneity.
        #
        # So the claim a light actually makes is A FLOOR, not a window: this
        # centre EXISTS BY NOW. It fails only when a centre begins after the
        # beat has closed, which is exactly the Sahel at 4,900 BP against a
        # beat that ends at 5,000. A floor claim is the robust kind; know
        # which one you are making.
        d0, d1 = e["dateRange"]
        if d0 < y1 and not INHERITED.get(i):
            problems.append(
                "%s begins %d BP and beat %d closes at %d BP: the film would "
                "be lighting it before it exists" % (i, d0, BEAT, y1))
        out.append({
            "id": i, "label": e["label"], "region": e["region"],
            "lon": e["coordinates"][0], "lat": e["coordinates"][1],
            "dateRange": e["dateRange"], "dateNote": e.get("dateNote", ""),
            "confidence": e["confidence"], "sourceIds": e["sourceIds"],
            "beat": e.get("beat"),
            "inherited": INHERITED.get(i),
            # WHEN THE LIGHT ARRIVES IS READ OFF THE DATA, not typed. The order
            # is the order the evidence puts them in, oldest first; the RHYTHM
            # - how far apart they land in t - stays the director's, because
            # the beat is a montage and not a timeline. Order from the record,
            # spacing from the film.
            "beganBP": e["dateRange"][0]
        })

    # oldest first. Ties keep the order the record has them in.
    out.sort(key=lambda c: -c["beganBP"])
    for n, c in enumerate(out):
        c["order"] = n

    if problems:
        print("REFUSING TO WRITE:", file=sys.stderr)
        for p in problems:
            print("  - " + p, file=sys.stderr)
        return 1

    doc = {
        "_readme": "Built by unroll/build_unroll.py from timeline.json. The "
                   "unroll slice authors nothing: every place it lights is an "
                   "event in the record, with its own coordinates, dates and "
                   "sources. Do not edit by hand.",
        "beat": {"id": BEAT, "title": b12["title"], "yearsBP": b12["yearsBP"],
                 "onScreen": b12["onScreen"], "motion": b12["motion"]},
        "centres": out,
        "sources": {s: tl["sources"][s]
                    for c in out for s in c["sourceIds"]},
        "openQuestions": [q for q in tl.get("openQuestions", [])
                          if "beat12" in q.get("id", "")],
    }
    os.makedirs(os.path.join(HERE, "data"), exist_ok=True)
    p = os.path.join(HERE, "data", "beat12.json")
    with io.open(p, "w", encoding="utf-8", newline="\n") as f:
        json.dump(doc, f, indent=1, ensure_ascii=False)
        f.write("\n")
    print("wrote %s" % p)
    print("  %d centres, every one sourced and every one in existence by "
          "%d BP:" % (len(out), b12["yearsBP"][1]))
    for c in out:
        print("   %d  %-22s %7.2f %7.2f   %5d-%-5d BP   %-9s%s"
              % (c["order"], c["label"], c["lon"], c["lat"], c["dateRange"][0],
                 c["dateRange"][1], c["confidence"],
                 "  inherited from beat %d" % c["beat"] if c["inherited"] else ""))
    q = doc["openQuestions"]
    if q:
        print("  %d open question(s) travel with it:" % len(q))
        for x in q:
            print("     %s" % x["question"])
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
