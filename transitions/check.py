"""Cross-beat continuity contract for the built Act III/IV run.

Run with a static server rooted at the repository on port 8899.  A seam may be
an intentional hard cut, but its year and sea level must still agree.  Only
08→09 is a literal orbital camera handoff; 09→10 and 10→11 deliberately cut
to their next image.  11→12 remains checked in unroll/shoot.py.
"""
from playwright.sync_api import sync_playwright

ROOT = "http://127.0.0.1:8899"
SCENES = {8: "/shrink/index.html", 9: "/steppe/index.html", 10: "/sweep/index.html", 11: "/doors/index.html"}


def load(page, beat, t):
    page.goto(ROOT + SCENES[beat], wait_until="networkidle")
    page.wait_for_function("window.EMBER%d && window.EMBER%d.D" % (beat, beat))
    return page.evaluate("t => window.EMBER%d.stateFor(t)" % beat, t)


def close(a, b, tolerance=1e-7):
    return abs(a - b) <= tolerance


with sync_playwright() as playwright:
    browser = playwright.chromium.launch()
    page = browser.new_page(viewport={"width": 1440, "height": 900})
    errors = []
    page.on("pageerror", lambda error: errors.append(str(error)))
    states = {(8, "out"): load(page, 8, 1), (9, "in"): load(page, 9, 0),
              (9, "out"): load(page, 9, 1), (10, "in"): load(page, 10, 0),
              (10, "out"): load(page, 10, 1), (11, "in"): load(page, 11, 0),
              (11, "out"): load(page, 11, 1)}
    contracts = [
        ("08-to-09 / matched orbital handoff", 8, 9, True),
        ("09-to-10 / deliberate southward hard cut", 9, 10, False),
        ("10-to-11 / deliberate rise from footprints", 10, 11, False),
    ]
    failed = []
    for label, left, right, camera_match in contracts:
        a, b = states[(left, "out")], states[(right, "in")]
        ok = close(a["year"], b["year"]) and close(a["sea"], b["sea"])
        if camera_match:
            ok = ok and all(close(a["cam"][key], b["cam"][key]) for key in ("lon", "lat", "alt", "pitch", "bearing"))
        print(("PASS" if ok else "FAIL"), label, "at", round(a["year"]), "BP /", round(a["sea"], 2), "m")
        if not ok:
            failed.append(label)
    early, field = states[(8, "out")], states[(9, "in")]
    ice_boundary = early["iceVisible"] == 0 and field["iceVisible"] == 0
    print(("PASS" if ice_boundary else "FAIL"), "26.5 ka seam / no pre-26 ka ICE-6G field")
    if not ice_boundary:
        failed.append("26.5 ka ICE-6G boundary")
    page.goto(ROOT + "/unroll/index.html", wait_until="networkidle")
    page.wait_for_function("window.UNROLL && window.UNROLL.D11")
    unroll = page.evaluate("""() => {
      const U = window.UNROLL, s = U.renderAt(0), c = U.camAt(0);
      return {cam: c, visible: U.countCentres(U.frame(s), s.b)};
    }""")
    door = states[(11, "out")]["cam"]
    joined = all(close(door[key], unroll["cam"][key]) for key in ("lon", "lat", "alt", "pitch", "bearing"))
    coverage = unroll["visible"] == 3
    print(("PASS" if joined else "FAIL"), "11-to-12 / generated Beat 11 camera enters the unroll")
    print(("PASS" if coverage else "FAIL"), "11-to-12 / entry camera sees", unroll["visible"], "of 6 centres")
    if not joined:
        failed.append("11-to-12 camera")
    if not coverage:
        failed.append("11-to-12 entry-centre count")
    browser.close()
    assert not errors, errors
    assert not failed, failed
