"""Phase 6: finish beat 12's data, and record what finishing it found.

IDEMPOTENT. Run it twice and the second run reports "already applied".

    python data/edit_timeline_p6.py

WHY THIS EXISTS. The unroll slice drew beat 12's six domestication centres and
three of them had no event with coordinates behind them - the Fertile Crescent,
the Andes and the Sahel. The slice drew those three DASHED and said INDICATIVE
on screen rather than hiding the gap, which is the right behaviour and not a
substitute for the data. This is the data.

WHAT IT FOUND, and one of the three is a script problem rather than a data one:

  1. THE FERTILE CRESCENT WAS ALREADY THERE. `fertile-crescent` carries
     coordinates and a source and has since Phase 1 - it just lives in beat 11,
     because at 11.5 ka it falls inside beat 11 while the sea is still rising.
     The slice invented a second, unsourced copy because it read a hardcoded
     table instead of the record. That is Law 07's whole argument, one level
     out: a surface the check cannot see is a surface that drifts.

  2. THE NORTHERN MILLET BELT IS A SECOND CENTRE AND WAS ONE EVENT WITH THE
     YANGTZE. `china-rice-millet` was labelled "Yangtze rice and northern
     millet" and carried ONE coordinate, at 112E 30.5N, which is the Yangtze.
     The storyboard's frame for beat 12 names them separately and it is right
     to: they are different crops, different climates, different river basins,
     roughly 500 km apart, and the beat's entire subject is INDEPENDENCE. One
     dot cannot carry two independent centres. Split.

  3. THE SAHEL DOES NOT FIT INSIDE BEAT 12, and this is the finding that
     changes a frame. The storyboard's beat 12 lights "the Sahel" among its six.
     The earliest defensible West African domestication is pearl millet, and
     every line of evidence puts it AFTER the beat closes: the genomic estimate
     for the onset of expansion is ~4,900 BP, the earliest directly dated
     domesticated caryopses are ~4,500 BP in the Tilemsi Valley, and Ounjougou
     and Winde Koroji are later still. Beat 12 runs 8,000-5,000 BP. So the light
     is real and the beat is wrong for it - it belongs to beat 13.

     THE BEAT DOES NOT NEED IT. Inside 8,000-5,000 BP the defensible
     independent centres are the Yangtze, the northern millet belt, New Guinea,
     Mesoamerica and the Andes - five - joined by the Fertile Crescent, which
     beat 11 has already fixed in place. That is six, which is exactly what the
     on-screen line claims: "in at least six places". The count survives the
     correction without being touched.

The event is written into beat 13 with its dates and its sources, so nothing is
lost, and `openQuestions` carries the frame change for the director rather than
this script making it silently.
"""
import io, json, os, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
P = os.path.join(ROOT, "timeline.json")

SOURCES = {
    "lu2009": {
        "cite": "Lu, H. et al. (2009). Earliest domestication of common millet "
                "(Panicum miliaceum) in East Asia extended to 10,000 years ago. "
                "PNAS 106, 7367–7372.",
        "checked": "web-2026-09-08"
    },
    "yang2012": {
        "cite": "Yang, X. et al. (2012). Early millet use in northern China. "
                "PNAS 109, 3726–3730.",
        "checked": "web-2026-09-08"
    },
    "dillehay2007": {
        "cite": "Dillehay, T. D. et al. (2007). Preceramic adoption of peanut, "
                "squash, and cotton in northern Peru. Science 316, 1890–1893.",
        "checked": "web-2026-09-08"
    },
    "manning2011": {
        "cite": "Manning, K. et al. (2011). 4500-year old domesticated pearl "
                "millet (Pennisetum glaucum) from the Tilemsi Valley, Mali. "
                "Journal of Archaeological Science 38, 312–322.",
        "checked": "web-2026-09-08"
    },
    "burgarella2018": {
        "cite": "Burgarella, C. et al. (2018). A western Sahara centre of "
                "domestication inferred from pearl millet genomes. Nature "
                "Ecology & Evolution 2, 1377–1380.",
        "checked": "web-2026-09-08"
    },
}

EVENTS = [
    {
        "id": "north-china-millet",
        "beat": 12,
        "type": "domestication",
        "label": "The northern millet belt",
        "region": "Yellow River, north China",
        "coordinates": [114.2, 36.6],
        "dateRange": [10300, 7500],
        "dateNote": "Broomcorn millet phytoliths at Cishan are reported from "
                    "10,300–8,700 cal BP and the earliest end of that is "
                    "contested on identification; charred foxtail millet at "
                    "Xinglonggou at ~8,000–7,500 BP is the conservative "
                    "figure. The coordinate is Cishan, which is one site in a "
                    "region and not the extent of the centre.",
        "confidence": "supported",
        "sourceIds": ["lu2009", "yang2012", "larson2014"],
        "why": "SPLIT from china-rice-millet in Phase 6. Different crop, "
               "different climate, different river basin, ~500 km from the "
               "Yangtze - and beat 12's whole subject is independence, so two "
               "independent centres cannot share one dot."
    },
    {
        "id": "andes-nanchoc",
        "beat": 12,
        "type": "domestication",
        "label": "The Andes",
        "region": "Ñanchoc Valley, northern Peru",
        "coordinates": [-79.2, -6.9],
        "dateRange": [9200, 5500],
        "dateNote": "Directly dated squash at ~9,200 BP, peanut ~7,600 BP and "
                    "cotton ~5,500 BP. Dillehay's title is ADOPTION, not "
                    "domestication: these crops may have been domesticated "
                    "elsewhere and taken up here, and the coordinate is the "
                    "earliest well-dated agriculture in the region rather than "
                    "the point a plant was changed. Larson et al. list "
                    "northwestern South America as an independent centre on "
                    "other crops - potato, quinoa, chenopods.",
        "confidence": "supported",
        "sourceIds": ["dillehay2007", "larson2014"],
        "why": "The New World's second centre, and the film needs it because "
               "one dot in Mexico reads as 'the Americas' rather than as two "
               "places that had not heard of each other either."
    },
    {
        "id": "west-africa-millet",
        "beat": 13,
        "type": "domestication",
        "label": "Pearl millet in the western Sahel",
        "region": "Tilemsi Valley and the western Sahara margin",
        "coordinates": [0.5, 16.5],
        "dateRange": [4900, 3900],
        "dateNote": "Genomic estimate for the onset of expansion ~4,900 BP; "
                    "earliest directly dated domesticated caryopses ~4,500 BP "
                    "in the Tilemsi Valley; Ounjougou and Windé Koroji "
                    "later still. The coordinate is the Tilemsi Valley, one "
                    "place in a wide centre.",
        "confidence": "supported",
        "sourceIds": ["manning2011", "burgarella2018", "larson2014"],
        "why": "AFRICA'S INDEPENDENT CENTRE, AND IT IS NOT IN BEAT 12. The "
               "storyboard's beat 12 frame lights 'the Sahel' among its six, "
               "and beat 12 runs 8,000-5,000 BP - every line of evidence puts "
               "this after the beat closes. Written into beat 13 so nothing is "
               "lost; the frame change is an open question for the director, "
               "not a decision this file made."
    },
]

PATCH_CHINA = {
    "label": "Yangtze rice",
    "region": "Middle Yangtze",
    "dateNote": "Rice. The northern millet belt was folded into this event "
                "until Phase 6 and is now north-china-millet, with its own "
                "coordinate: two independent centres cannot share one dot in a "
                "beat about independence.",
    "why": "Independent of the Fertile Crescent, and independent of the millet "
           "belt 500 km north of it.",
}

OPEN_Q = {
    "id": "oq-beat12-sahel",
    "question": "Beat 12's frame lights six places including 'the Sahel', and "
                "the Sahel does not fit inside the beat.",
    "status": "open — for the director",
    "detail": "Beat 12 runs 8,000-5,000 BP. The earliest defensible West "
              "African domestication is pearl millet: ~4,900 BP by genomes, "
              "~4,500 BP by directly dated caryopses in the Tilemsi Valley. "
              "That is after the beat closes. THE COUNT SURVIVES WITHOUT IT: "
              "inside the window the defensible independent centres are the "
              "Yangtze, the northern millet belt, New Guinea, Mesoamerica and "
              "the Andes - five - plus the Fertile Crescent, which beat 11 has "
              "already fixed in place. Six, which is exactly what the "
              "on-screen line claims. Three ways out, and it is a director's "
              "call: drop the Sahel from beat 12's frame and keep the six; "
              "move the light to the beat 12/13 boundary and let it arrive as "
              "beat 13 opens, which is where the data puts it; or widen the "
              "beat, which costs beat 13 its opening. The event exists in the "
              "record either way, in beat 13, as west-africa-millet.",
    "raised": "2026-09-08"
}


def main():
    raw = io.open(P, encoding="utf-8").read()
    d = json.loads(raw)

    have_ev = {e["id"] for e in d["events"]}
    if all(e["id"] in have_ev for e in EVENTS) and \
       d["events"][[e["id"] for e in d["events"]].index("china-rice-millet")]["label"] == PATCH_CHINA["label"]:
        print("already applied — nothing to do")
        return 0

    for k, v in SOURCES.items():
        d["sources"].setdefault(k, v)

    for ev in EVENTS:
        if ev["id"] not in have_ev:
            d["events"].append(ev)

    for e in d["events"]:
        if e["id"] == "china-rice-millet":
            e.update(PATCH_CHINA)

    for b in d["beats"]:
        if b["id"] == 12:
            for eid in ("north-china-millet", "andes-nanchoc"):
                if eid not in b["events"]:
                    b["events"].append(eid)
        if b["id"] == 13:
            if "west-africa-millet" not in b["events"]:
                b["events"].append("west-africa-millet")

    oq = d.setdefault("openQuestions", [])
    if not any(q.get("id") == OPEN_Q["id"] for q in oq):
        oq.append(OPEN_Q)

    # every source an event cites must resolve, or the record is lying
    for e in d["events"]:
        for sid in e.get("sourceIds", []):
            assert sid in d["sources"], "%s cites missing source %s" % (e["id"], sid)

    with io.open(P, "w", encoding="utf-8", newline="\n") as f:
        json.dump(d, f, indent=1, ensure_ascii=False)
        f.write("\n")
    print("timeline.json: +%d sources, +%d events, 1 split, 1 open question"
          % (len(SOURCES), len(EVENTS)))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
