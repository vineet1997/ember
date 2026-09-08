"""Drive the film and the atlas from Python, deterministically.

WHY THIS EXISTS, AND WHY IT IS NOT A TEST RUNNER. The film's own tests live in
the director's panel and are the authority on whether the film is sound. This is
the thing that lets a machine ask them, and ask the film questions, without a
human at a screen — which turned out to be harder than it sounds and was
rewritten from scratch three times before being promoted here.

Four facts shape every line of it, all of them learned the expensive way:

  1. NEVER WAIT ON THE RENDER LOOP. Every automated browser throttles
     requestAnimationFrame to uselessness — the in-app pane ran zero ticks in
     600 ms, Playwright one tick in 800 ms. `EMBER.renderAt(t)` draws one frame
     synchronously and is the only honest way in. Nothing here polls for a frame.

  2. THE IN-APP BROWSER PANE CANNOT RENDER THIS PROJECT AT ALL. Not the WebGL
     film, and not even `atlas.html`, which is plain HTML and `<img>` — it times
     out drawing it. Playwright is not a preference here, it is the only option
     for anything you need to LOOK at. For anything you need to KNOW, evaluate
     JavaScript and return small JSON; it is faster and far cheaper than a
     screenshot.

  3. HEADLESS CHROMIUM HAS NO GPU, and the film needs WebGL2 with float
     elevation textures. ANGLE over SwiftShader provides it in software, at
     roughly a minute a full-resolution frame. Every still it produces is
     correct. NO TIMING NUMBER FROM IT MEANS ANYTHING — use `EMBER.bench()` on
     a real screen for that.

  4. A LAZY <img> SCREENSHOTS AS PURE BLACK. Two passes were lost to an atlas
     page that photographed as an empty rectangle while the stills were provably
     20–60 mean luminance on disk. `settle()` forces eager, reassigns src and
     awaits decode before anything is captured.

It serves through `serve.py`'s no-cache handler on an ephemeral port, for the
reason serve.py exists: a caching static server hands you yesterday's shader and
you debug code that is not running.

Used by check.py. Import it if you need something check.py does not do.
"""

import functools, os, socket, sys, threading
from contextlib import contextmanager
from http.server import ThreadingHTTPServer

SLICE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ROOT = os.path.dirname(SLICE)
SHOTS = os.path.join(ROOT, ".playwright-mcp")          # gitignored scratch

# Software WebGL2. --enable-unsafe-swiftshader is required on current Chromium;
# without it the context is refused and EMBER never reaches a bakeable state.
GL_ARGS = ["--use-gl=angle", "--use-angle=swiftshader",
           "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"]


def utf8_stdout():
    """Windows consoles are cp1252 and this project prints ✗, ·, ° and –.
    Without this every run needs PYTHONIOENCODING=utf-8 in front of it, which
    is a thing you remember only after the traceback."""
    try:
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    except Exception:
        pass


def serve():
    """slice/ on an ephemeral port, with serve.py's no-cache headers."""
    sys.path.insert(0, SLICE)
    from serve import NoCache
    s = socket.socket(); s.bind(("127.0.0.1", 0)); port = s.getsockname()[1]; s.close()
    httpd = ThreadingHTTPServer(("127.0.0.1", port),
                                functools.partial(NoCache, directory=SLICE))
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    return httpd, port


@contextmanager
def session(page_name="index.html", query="?still=1", width=1440, height=810,
            dpr=1, headed=False, javascript=True, gl=True, wait_ember=True):
    """A served page with a Playwright page on it.

    page_name  "index.html" for the film, "atlas.html" for the static artifact.
    query      "?still=1" kills the copy transitions, so a frame drawn by
               renderAt() is FINISHED when it returns rather than 0.9 s into a
               fade. Use "?nogl=1" to force the WebGL failure path.
    javascript False loads the atlas the way a crawler or a reader with
               scripting off receives it. Meaningless for the film.
    wait_ember waits for window.EMBER, which only appears on the renderer path.

    Yields (page, errors) where errors is a live list of page exceptions — check
    it, because a thrown exception otherwise looks like a passing run.
    """
    from playwright.sync_api import sync_playwright
    httpd, port = serve()
    url = "http://127.0.0.1:%d/%s%s" % (port, page_name, query)
    with sync_playwright() as pw:
        browser = pw.chromium.launch(headless=not headed, args=GL_ARGS if gl else [])
        ctx = browser.new_context(viewport={"width": width, "height": height},
                                  device_scale_factor=dpr,
                                  java_script_enabled=javascript)
        page = ctx.new_page()
        errors = []
        page.on("pageerror", lambda e: errors.append(str(e)))
        page.goto(url, wait_until="load")
        if javascript and wait_ember:
            try:
                page.wait_for_function("window.EMBER && window.EMBER.stateFor",
                                       timeout=120000)
            except Exception:
                msg = ""
                try:
                    msg = page.eval_on_selector("#lmsg", "e => e.textContent")
                except Exception:
                    pass
                browser.close(); httpd.shutdown()
                raise SystemExit(
                    "EMBER never appeared.\n  page errors: %s\n  loader says: %s\n"
                    "EMBER is only exported on the renderer path, so this usually "
                    "means WebGL2 did not start. Try headed=True."
                    % ("; ".join(errors) or "none", msg))
        try:
            yield page, errors
        finally:
            browser.close()
            httpd.shutdown()


def settle(page, images=False):
    """Wait until the page is actually photographable.

    The loading overlay fades over 0.9 s AFTER a 260 ms timeout, so a screenshot
    taken the moment EMBER exists catches the loader, not the film. And a lazy
    <img> that has never scrolled into view decodes to nothing — see fact 4 in
    the module docstring."""
    try:
        page.wait_for_function(
            "!document.getElementById('load') || "
            "document.getElementById('load').classList.contains('off')",
            timeout=30000)
    except Exception:
        pass
    if images:
        page.evaluate("""async () => {
            const im = [...document.querySelectorAll('img')];
            im.forEach(i => { i.loading = 'eager'; i.src = i.src; });
            await Promise.all(im.map(i => i.decode().catch(() => {})));
        }""")
    page.wait_for_timeout(900)


def panel_tests(page, runs=2):
    """Run the five panel tests, `runs` times, and report each run separately.

    TWICE IS THE MINIMUM AND IT IS NOT SUPERSTITION. Two checks in this project
    have passed on their first run and failed on every run afterwards, because
    each polluted the surface the next run inspected. A single green run proves
    less than it appears to."""
    out = []
    for _ in range(runs):
        out.append(page.evaluate("""() => {
          const ids = {purity:'o-purity', copyCheck:'o-copy', law06:'o-law06',
                       absence:'o-absence', hold:'o-hold'};
          const r = {};
          for (const k in ids) {
            window.EMBER[k]();
            const el = document.getElementById(ids[k]);
            r[k] = { pass: !!el.querySelector('.ok') && !el.querySelector('.bad'),
                     head: el.textContent.split('\\n')[0].trim() };
          }
          return r;
        }"""))
    return out
