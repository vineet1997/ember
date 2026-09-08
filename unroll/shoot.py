"""Shoot the unroll at a series of k, and run its four tests.

    python unroll/shoot.py                 # the default ladder of k
    python unroll/shoot.py 0 0.5 1         # specific values

A spike is for LOOKING at, and the in-app browser pane cannot render this
project at all - not the WebGL film and not even plain HTML. Playwright is the
only way to see a frame, and no timing number from it means anything: headless
Chromium is SwiftShader, which is correct and slow.

Frames land in .playwright-mcp/ (gitignored). Move keepers into evidence/.
"""
import os, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "slice", "tools"))
os.chdir(ROOT)
from harness import serve as _slice_serve, GL_ARGS, utf8_stdout, SHOTS  # noqa

import functools, socket, threading
from http.server import ThreadingHTTPServer

utf8_stdout()
W, H = 1280, 800


def serve_root():
    """The unroll reaches back into slice/data/, so the server is repo-rooted."""
    sys.path.insert(0, os.path.join(ROOT, "unroll"))
    from serve import NoCache
    s = socket.socket(); s.bind(("127.0.0.1", 0)); port = s.getsockname()[1]; s.close()
    httpd = ThreadingHTTPServer(("127.0.0.1", port),
                                functools.partial(NoCache, directory=ROOT))
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    return httpd, port


def main():
    ks = [float(x) for x in sys.argv[1:]] or [0.0, 0.15, 0.35, 0.55, 0.75, 1.0]
    os.makedirs(SHOTS, exist_ok=True)
    from playwright.sync_api import sync_playwright
    httpd, port = serve_root()
    fails = []
    with sync_playwright() as pw:
        b = pw.chromium.launch(headless=True, args=GL_ARGS)
        ctx = b.new_context(viewport={"width": W, "height": H}, device_scale_factor=1)
        page = ctx.new_page()
        errs = []
        page.on("pageerror", lambda e: errs.append(str(e)))
        page.goto("http://127.0.0.1:%d/unroll/" % port, wait_until="load")
        page.wait_for_function("window.UNROLL", timeout=180000)
        page.wait_for_function(
            "document.getElementById('load').classList.contains('off')", timeout=60000)
        # the overlay fades over 0.9s AFTER that class lands, so a shot taken
        # the moment it appears catches the loader and not the earth
        page.wait_for_timeout(1400)

        for k in ks:
            st = page.evaluate("k => { const U = window.UNROLL; "
                               "const s = U.renderAt(U.tOfK(k)); "
                               "return {k: s.k, h: s.h, lit: s.lit, "
                               "vis: U.countCentres(U.frame(s), s.b)}; }", k)
            page.wait_for_timeout(250)
            f = os.path.join(SHOTS, "unroll-k%s.png" % ("%.2f" % k).replace(".", "p"))
            page.screenshot(path=f, clip={"x": 0, "y": 0, "width": W, "height": H})
            print("k %.2f   h %5.2f   centres in frame %d/6   %s"
                  % (st["k"], st["h"], st["vis"], os.path.basename(f)))

        print()
        for name, pre in (("sphereTest", "o-sphere"), ("purity", "o-purity"),
                          ("sixTest", "o-six"), ("agreementTest", "o-agree"),
                          ("recordTest", "o-record")):
            for run in (1, 2):
                page.evaluate("n => window.UNROLL[n]()", name)
                txt = page.eval_on_selector("#" + pre, "e => e.textContent")
                head = txt.split("\n")[0].strip()
                ok = head.startswith("PASS")
                if run == 2:
                    print("  %s  %-14s %s" % ("PASS" if ok else "FAIL", name, head[:60]))
                if not ok:
                    fails.append("%s (run %d)" % (name, run))
        print()
        print(page.eval_on_selector("#o-record", "e => e.textContent"))
        if errs:
            fails.append("page errors: %s" % errs)
        b.close()
    httpd.shutdown()
    if fails:
        print("\nFAIL — %s" % "; ".join(sorted(set(fails))))
        return 1
    print("\nPASS — all five, twice.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
