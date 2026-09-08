"""Ask the film questions from the command line.

    python slice/tools/check.py verify              is the film sound
    python slice/tools/check.py probe q.js          evaluate JS, print JSON
    python slice/tools/check.py probe -e "EMBER.stateFor(0.335).sea"
    python slice/tools/check.py shoot film -t 0.4040
    python slice/tools/check.py shoot atlas -w 390 -s "#s04"

VERIFY is the one to run before believing anything. It runs the five panel tests
twice, and then checks four things the panel cannot see because they are not
functions of t:

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
        if errors:
            fails.append("page errors on the film: %s" % errors)

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
            "film voice": "They could not see it.",
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
        once = txt.count(want["film voice"])
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

    v = sub.add_parser("verify", help="the five panel tests, plus what they cannot see")
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
