"""Ask the film questions from the command line.

    python slice/tools/check.py verify              is the film sound
    python slice/tools/check.py probe q.js          evaluate JS, print JSON
    python slice/tools/check.py probe -e "EMBER.stateFor(0.335).sea"
    python slice/tools/check.py shoot film -t 0.4040
    python slice/tools/check.py shoot atlas -w 390 -s "#s04"

VERIFY is the one to run before believing anything. It runs the six panel tests
twice, and then checks seven things the panel cannot see - because they are not
functions of t, or because they are about the film FAILING and a panel only runs
on a film that started:

  - the film still letters its own frames. Every canvas text site goes through
    the annotation sink so the atlas can bake the world and place words as HTML;
    a bug there would silently blank the margin. This measures ink where the
    labels are, and checks the sink is not left armed after a bake.
  - every fallback road reaches the atlas: the desktop gate, the WebGL failure
    page, and a phone-width load.
  - the atlas is intact with JavaScript disabled — which is how a crawler, a
    screen reader and a browser with WebGL off receive it.
  - the film voice appears exactly ONCE on the atlas. A copy window is a range
    of t, so a line the film shows once is live at more than one sampled frame;
    printing it twice breaks the film's own discipline.
  - one t, reached two ways, hands a screen reader the same copy. The copy
    column is written only when it changes, so a paragraph that has left the
    screen stays in the DOM at zero opacity; until 2026-09-08 it also stayed in
    the accessibility tree, and WHICH paragraph depended on the direction you
    arrived from. Two readers at one t, one state hash, different text.
  - the two background tiles do not block the film. Aborted, the film must still
    start, still clear its loader, and still draw beat 06 - from the global
    texture, at lower resolution and never at a wrong value.
  - a blocking asset that fails leaves a door open. It used to leave an opaque
    loader with no link on it, and a later success would erase even the error.
  - the way out is reachable from the keyboard: the first tab stop is the atlas.
  - the gate answers a reader who changes their mind. It used to be asked once,
    at parse time, so turning reduced motion on - or dragging the window down to
    phone width - left the film scrolling with no way out of it. Both roads are
    driven here, in both directions, and the draw loop has to actually STOP:
    reduced motion means stop moving.

Exit code is non-zero if anything fails, so it can gate a build.

PROBE is the workhorse. Anything you want to know about the film, ask it in
JavaScript and get JSON back — far cheaper and far more precise than a
screenshot, and it works when screenshots do not. The expression is evaluated
with EMBER available; a file argument may be any JS expression, typically an
arrow function.

SHOOT is for the questions that are genuinely visual. It exists because the
in-app browser pane cannot render this project — not the WebGL film, and not
even the plain-HTML atlas. Output lands in .playwright-mcp/, which is gitignored.
"""

import argparse, json, os, sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from harness import session, settle, panel_tests, utf8_stdout, SHOTS


# ── verify ─────────────────────────────────────────────────────────────────
def cmd_verify(a):
    fails = []

    with session() as (page, errors):
        runs = panel_tests(page, runs=a.runs)
        for i, r in enumerate(runs):
            for k, v in r.items():
                mark = "PASS" if v["pass"] else "FAIL"
                if not v["pass"]:
                    fails.append("panel test %s (run %d)" % (k, i + 1))
                print("  %s  run %d  %-10s %s" % (mark, i + 1, k, v["head"][:52]))

        film = page.evaluate("""() => {
          const E = window.EMBER, over = document.getElementById('over');
          const x = over.getContext('2d');
          const dpr = Math.min(2, devicePixelRatio || 1);
          const W = over.width;
          function ink(t) {
            E.renderAt(t);
            const d = x.getImageData(W - 480 * dpr, 100 * dpr, 470 * dpr, 120 * dpr).data;
            let n = 0;
            for (let i = 3; i < d.length; i += 4) if (d[i] > 12) n++;
            return n;
          }
          const before = ink(0.3350);
          const caught = E.bakeAt(0.3350).text.length;
          return { marginInk: before, bakeText: caught, afterBake: ink(0.3350) };
        }""")
        print("\n  margin ink at t 0.3350: %d px   bake caught %d strings   after bake: %d px"
              % (film["marginInk"], film["bakeText"], film["afterBake"]))
        if film["marginInk"] < 500:
            fails.append("the film is not lettering its own frames")
        if film["bakeText"] < 1:
            fails.append("the annotation sink caught nothing")
        if film["marginInk"] != film["afterBake"]:
            fails.append("a bake left the annotation sink armed")
        # ONE t, TWO ROADS, ONE READER. renderAt sets target and cur together, so
        # rendering 0.28 then 0.31 really is the film arriving from below.
        reader = page.evaluate("""() => {
          const E = window.EMBER;
          E.renderAt(0.2800); E.renderAt(0.3100);
          const up = E.readerCopy();
          E.renderAt(0.3450); E.renderAt(0.3100);
          const down = E.readerCopy();
          E.renderAt(0.3100);
          return { up, down, hash: E.stateFor(0.31) && true };
        }""")
        same = reader["up"] == reader["down"]
        print("  t 0.3100 from below vs from above: %s" % ("same" if same else "DIFFERENT"))
        if not same:
            print("    from below: %s\n    from above: %s" % (reader["up"], reader["down"]))
            fails.append("the copy a reader receives depends on how they got there")

        tab = page.evaluate("""() => {
          const a = document.querySelector('#skip-atlas');
          return { first: !!a && a === document.body.querySelector('a,button,[tabindex]'),
                   chrome: !!document.querySelector('#chrome-atlas[href="atlas.html"]'),
                   href: a ? a.getAttribute('href') : null };
        }""")
        print("  first focusable is the atlas skip link: %s   visible chrome link: %s"
              % (tab["first"] and tab["href"] == "atlas.html", tab["chrome"]))
        if not (tab["first"] and tab["href"] == "atlas.html"):
            fails.append("the first thing a keyboard reaches is not the atlas")
        if not tab["chrome"]:
            fails.append("the film's chrome carries no visible atlas link")

        if errors:
            fails.append("page errors on the film: %s" % errors)

    # ── the two background tiles, aborted ────────────────────────────────
    # 1280x800 exactly, which is the smallest viewport the gate lets through -
    # SwiftShader charges by the pixel and this is asking whether the film RUNS
    # without those tiles, not what it looks like. Anything narrower is gated
    # and the boot code never executes at all.
    with session(width=1280, height=800,
                 abort=("bathy_sunda", "bathy_europe")) as (page, errs):
        settle(page, tiles=False)          # by construction they never arrive
        d = page.evaluate("""() => {
          const E = window.EMBER;
          const s = E.renderAt(0.3350);
          const over = document.getElementById('over'), x = over.getContext('2d');
          const px = x.getImageData(0, 0, over.width, over.height).data;
          let ink = 0;
          for (let i = 3; i < px.length; i += 4) if (px[i] > 12) ink++;
          return { ready: E.tilesReady(), tile: s.tile, ink,
                   cleared: document.getElementById('load').classList.contains('off') };
        }""")
        print("\n  with sunda and europe aborted: film started, loader cleared: %s"
              % d["cleared"])
        print("    beat 06 wants tile %r, uploaded: %s, overlay ink: %d px"
              % (d["tile"], d["ready"], d["ink"]))
        if not d["cleared"]:
            fails.append("a background tile blocked the film's loader")
        if d["ready"]:
            fails.append("tilesReady() is true with two tiles aborted; the abort missed")
        if d["ink"] < 100:
            fails.append("beat 06 drew nothing without its tile")
        if errs:
            fails.append("page errors with tiles aborted: %s" % errs)

    # ── a blocking asset that fails ──────────────────────────────────────
    with session(width=1280, height=800, abort=("bathy_global",),
                 wait_ember=False) as (page, _):
        page.wait_for_timeout(3000)
        n = page.eval_on_selector_all("#ldetail a[href='atlas.html']", "a => a.length")
        msg = page.eval_on_selector("#lmsg", "e => e.textContent")
        print("  with the globe aborted: loader says %r, offers the atlas: %s"
              % (msg[:52], bool(n)))
        if not n:
            fails.append("a failed raster leaves the reader with no way to the atlas")
        if "bathy_global" not in msg:
            fails.append("a later load erased the failure message: %r" % msg)

    # ── the gate, after the film has started ─────────────────────────────
    with session() as (page, errs):
        settle(page)
        def gate():
            return page.evaluate("() => ({ ...window.EMBER.gated(), "
                                 "on: document.getElementById('gate').classList.contains('on'), "
                                 "inert: !!document.getElementById('copy').inert })")
        steps = [("running, nothing changed", lambda: None, False)]
        steps.append(("reduced motion turned ON",
                      lambda: page.emulate_media(reduced_motion="reduce"), True))
        steps.append(("reduced motion turned back off",
                      lambda: page.emulate_media(reduced_motion="no-preference"), False))
        steps.append(("dragged to phone width",
                      lambda: page.set_viewport_size({"width": 390, "height": 800}), True))
        steps.append(("dragged back out",
                      lambda: page.set_viewport_size({"width": 1440, "height": 810}), False))
        print()
        for label, act, want in steps:
            act()
            # The gate flips synchronously; `running` only clears on the
            # loop's NEXT tick, and headless Chromium runs about one of
            # those a second. Wait for the condition, not for a stopwatch.
            for expr in ("w => window.EMBER.gated().gate === w",
                         "w => window.EMBER.gated().running === !w"):
                try:
                    page.wait_for_function(expr, arg=want, timeout=10000)
                except Exception:
                    pass
            g = gate()
            ok = (g["gate"] == want and g["on"] == want
                  and g["inert"] == want and g["running"] == (not want))
            print("  %s  gate %-13s up=%-5s loop=%s  film out of the reading order=%s"
                  % ("ok " if ok else "MISS", label.split(",")[0][:13], g["on"],
                     "running" if g["running"] else "stopped", g["inert"]))
            if not ok:
                fails.append("the runtime gate: %s" % label)
        if errs:
            fails.append("page errors driving the gate: %s" % errs)

    with session(query="?nogl=1", wait_ember=False) as (page, _):
        page.wait_for_timeout(2500)
        n = page.eval_on_selector_all("#ldetail a[href='atlas.html']", "a => a.length")
        print("  WebGL failure page offers the atlas: %s" % bool(n))
        if not n:
            fails.append("the WebGL failure page does not link the atlas")

    with session(query="", width=390, height=800, wait_ember=False) as (page, _):
        page.wait_for_timeout(900)
        on = page.eval_on_selector("#gate", "e => e.classList.contains('on')")
        n = page.eval_on_selector_all("#gate a[href='atlas.html']", "a => a.length")
        print("  phone-width gate shown: %s, offers the atlas: %s" % (on, bool(n)))
        if not (on and n):
            fails.append("the phone-width gate does not reach the atlas")

    with session("atlas.html", query="", width=390, height=800,
                 javascript=False, gl=False, wait_ember=False) as (page, _):
        txt = page.inner_text("body")
        scripts = page.eval_on_selector_all("script", "a => a.length")
        want = {
            "film voice": "The people who reached Sahul crossed open sea.",
            "a caption": "Seventy point five kilometres.",
            "a margin label": "NEVER BRIDGED, AT ANY SEA LEVEL IN THE RECORD",
            "the ground register": "ORIGINAL DIAGRAM, NOT A PHOTOGRAPH OF THE SITE",
            "the dimension": "70.5 KM",
            "a citation": "Bird, M. I. et al. (2018)",
        }
        print("\n  atlas with JavaScript OFF: %d words, %d script tags"
              % (len(txt.split()), scripts))
        for name, s in want.items():
            ok = s in txt
            print("    %s  %s" % ("ok " if ok else "MISS", name))
            if not ok:
                fails.append("the atlas is missing %s without JavaScript" % name)
        if scripts:
            fails.append("the atlas carries %d script tags; it must carry none" % scripts)
        # The lede is allowed to quote the beat's conclusion as prose. What
        # must appear once is the large, paced film-voice treatment itself.
        once = page.locator(".voice").all_text_contents().count(want["film voice"])
        print("    %s  the film voice appears exactly once (found %d)"
              % ("ok " if once == 1 else "MISS", once))
        if once != 1:
            fails.append("the film voice appears %d times on the atlas" % once)

    print()
    if fails:
        print("FAIL — %d:" % len(fails))
        for f in fails:
            print("  - %s" % f)
        return 1
    print("PASS — the film letters itself, every fallback reaches the atlas, "
          "and the atlas stands up without JavaScript.")
    return 0


# ── probe ──────────────────────────────────────────────────────────────────
def cmd_probe(a):
    if a.expr:
        js = "() => (%s)" % a.expr
    else:
        js = open(a.file, encoding="utf-8").read()
    with session(page_name=a.page) as (page, errors):
        if a.settle:
            settle(page, images=(a.page != "index.html"))
        out = page.evaluate(js)
        print(json.dumps(out, indent=1, ensure_ascii=False))
        if errors:
            print("PAGE ERRORS: %s" % errors, file=sys.stderr)
            return 1
    return 0


# ── shoot ──────────────────────────────────────────────────────────────────
def cmd_shoot(a):
    os.makedirs(SHOTS, exist_ok=True)
    if a.what == "film":
        with session(width=a.width, height=a.height) as (page, _):
            settle(page)
            for t in a.t:
                page.evaluate("t => window.EMBER.renderAt(t)", t)
                page.wait_for_timeout(250)
                f = os.path.join(SHOTS, "film-%s.png" % ("%.4f" % t).replace(".", "p"))
                page.screenshot(path=f, clip={"x": 0, "y": 0,
                                              "width": a.width, "height": a.height})
                print(f)
    else:
        with session("atlas.html", query="", width=a.width, height=a.height,
                     gl=False, wait_ember=False) as (page, _):
            settle(page, images=True)
            if a.sel:
                for s in a.sel:
                    el = page.query_selector(s)
                    if not el:
                        print("no match: %s" % s, file=sys.stderr)
                        continue
                    f = os.path.join(SHOTS, "atlas-%d-%s.png"
                                     % (a.width, s.strip("#.").replace(" ", "_")))
                    el.screenshot(path=f)
                    print(f)
            else:
                f = os.path.join(SHOTS, "atlas-%d-full.png" % a.width)
                page.screenshot(path=f, full_page=True)
                print(f)
    return 0


def main():
    utf8_stdout()
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)

    v = sub.add_parser("verify", help="the six panel tests, plus what they cannot see")
    v.add_argument("--runs", type=int, default=2,
                   help="how many times to run the panel tests (default 2, never 1)")
    v.set_defaults(fn=cmd_verify)

    p = sub.add_parser("probe", help="evaluate JavaScript against the film, print JSON")
    p.add_argument("file", nargs="?", help="a file containing a JS expression")
    p.add_argument("-e", "--expr", help="a JS expression, evaluated with EMBER in scope")
    p.add_argument("--page", default="index.html")
    p.add_argument("--settle", action="store_true", help="wait for the loader to clear")
    p.set_defaults(fn=cmd_probe)

    s = sub.add_parser("shoot", help="screenshot the film or the atlas")
    s.add_argument("what", choices=["film", "atlas"])
    s.add_argument("-t", type=float, nargs="*", default=[0.3350],
                   help="film only: one or more values of t")
    s.add_argument("-w", "--width", type=int, default=1440)
    s.add_argument("--height", type=int, default=810)
    s.add_argument("-s", "--sel", nargs="*", help="atlas only: CSS selectors to clip to")
    s.set_defaults(fn=cmd_shoot)

    a = ap.parse_args()
    if a.cmd == "probe" and not a.file and not a.expr:
        ap.error("probe needs a file or -e")
    raise SystemExit(a.fn(a))


if __name__ == "__main__":
    main()
