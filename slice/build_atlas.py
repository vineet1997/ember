"""Bake beat 06's stills from the film's own shader, then write the atlas.

THE ATLAS is one static artifact that is, at the same time, the mobile
experience, the prefers-reduced-motion fallback, the no-JavaScript fallback, the
crawler content, and the answer for a browser that has switched WebGL off. Same
art, same writing, no scroll-cinema.

TWO RULES SHAPE THIS WHOLE FILE.

  1. The world is baked; every word is live HTML. The earth, the lights, the
     leaders and the marker dots come out of the film's fragment shader as
     pixels, because there is no honest way to reproduce a shader in a static
     page. Nothing else does. Baked type would be invisible to a crawler, to a
     screen reader, to selection - and to the Law 07 copy check, which reads the
     film's own surfaces. So film.js routes every canvas text site through its
     annotation sink, and this script reads what the sink caught.

  2. This file is not a source of truth and must never become one. Every
     sentence in the atlas lives in film.js (VOICES, RECORDS, GROUND, ATLAS),
     where copyCheck() diffs it against the qualifiers its own event carries in
     timeline.json. Every number comes from slice/data/film.json. This script
     transports and lays out; it does not author. If you find yourself typing a
     sentence about the past into this file, put it in film.js instead.

HOW THE STILLS ARE MADE. window.EMBER.bakeAt(t) draws one frame synchronously
and returns the state plus the annotation geometry. It exists because every
automated browser throttles requestAnimationFrame to uselessness - the in-app
pane ran zero ticks in 600 ms, Playwright one tick in 800 ms - so nothing here
waits on the render loop. The page is loaded with ?still=1, which kills the copy
transitions, so a frame is finished the moment bakeAt returns.

    python slice/build_atlas.py              bake, then write slice/atlas.html
    python slice/build_atlas.py --no-bake    re-lay-out from the existing sidecar
    python slice/build_atlas.py --headed     watch it happen

It runs its own no-cache server on an ephemeral port, for the reason serve.py
exists: a caching static server hands you yesterday's shader.
"""

import argparse, base64, datetime, functools, io, json, os, re, socket, sys, threading
from http.server import ThreadingHTTPServer

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
OUT = os.path.join(HERE, "atlas")
SIDECAR = os.path.join(OUT, "stills.json")

# The bake viewport, in CSS pixels. 1440 x 810 is chosen so the overlay type
# lands at its designed size on a 1440-wide window: the film draws its margin
# labels at an absolute 10.5px, and the atlas scales them with the figure, so a
# still baked at 1440 puts them at 10.5px on a 1440 figure. Baking wider would
# make every label smaller than the film's on every screen.
BAKE_W, BAKE_H, BAKE_DPR = 1440, 810, 2
# Saved at 1.33x the CSS size: a supersample of the DPR-2 draw, so the hairlines
# - the waterline, the leaders, the dashed dimension - survive a downscale, and
# the figure is still crisp on a display wider than it was baked for.
SAVE_W, SAVE_H = 1920, 1080
WEBP_QUALITY = 88

TESTS = ["purity", "copyCheck", "law06", "absence", "hold"]


# ── the server ──────────────────────────────────────────────────────────────
def serve():
    """slice/ on an ephemeral port, with serve.py's no-cache headers."""
    sys.path.insert(0, HERE)
    from serve import NoCache
    s = socket.socket(); s.bind(("127.0.0.1", 0)); port = s.getsockname()[1]; s.close()
    httpd = ThreadingHTTPServer(("127.0.0.1", port),
                                functools.partial(NoCache, directory=HERE))
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    return httpd, port


# ── the bake ────────────────────────────────────────────────────────────────
def bake(headed=False):
    from playwright.sync_api import sync_playwright
    from PIL import Image

    os.makedirs(OUT, exist_ok=True)
    httpd, port = serve()
    url = "http://127.0.0.1:%d/index.html?still=1" % port
    print("baking from", url)

    stills, tests, meta = [], {}, {}
    with sync_playwright() as pw:
        browser = pw.chromium.launch(headless=not headed, args=[
            # Headless Chromium has no GPU. The film needs WebGL2 with float
            # textures; ANGLE over SwiftShader provides it in software, slowly,
            # which is fine for eight synchronous frames and is NOT a machine to
            # take a frame time from. See EMBER.bench() for that.
            "--use-gl=angle", "--use-angle=swiftshader",
            "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist",
        ])
        page = browser.new_page(viewport={"width": BAKE_W, "height": BAKE_H},
                                device_scale_factor=BAKE_DPR)
        errs = []
        page.on("pageerror", lambda e: errs.append(str(e)))
        page.goto(url, wait_until="load")
        try:
            page.wait_for_function("window.EMBER && window.EMBER.bakeAt", timeout=90000)
        except Exception:
            raise SystemExit(
                "the film did not reach a bakeable state.\n"
                "  page errors: " + ("; ".join(errs) or "none") + "\n"
                "  loader says: " + page.eval_on_selector("#lmsg", "e=>e.textContent") +
                "\nA bake needs WebGL2 - EMBER.bakeAt is only exported on the "
                "renderer path. Try --headed.")

        # Asked of a throwaway context, not read off the panel: the panel's
        # readout is trimmed to 52 characters to fit a 352px column, which cuts
        # this driver's name mid-parenthesis. A colophon that names the renderer
        # should name all of it.
        renderer = page.evaluate("""() => {
          const c = document.createElement('canvas');
          const g = c.getContext('webgl2') || c.getContext('webgl');
          if (!g) return 'unknown';
          const d = g.getExtension('WEBGL_debug_renderer_info');
          const r = String(d ? g.getParameter(d.UNMASKED_RENDERER_WEBGL)
                             : g.getParameter(g.RENDERER));
          const lose = g.getExtension('WEBGL_lose_context');
          if (lose) lose.loseContext();
          return r;
        }""")
        print("renderer:", renderer)

        # The five panel tests, run in the same page as the bake. A still baked
        # out of a film whose copy check is failing is a still of a lie.
        for name in TESTS:
            page.evaluate("window.EMBER.%s()" % name)
        tests = page.evaluate("""() => {
          const ids = {purity:'o-purity', copyCheck:'o-copy', law06:'o-law06',
                       absence:'o-absence', hold:'o-hold'};
          const out = {};
          for (const k in ids) {
            const el = document.getElementById(ids[k]);
            out[k] = { pass: !!el.querySelector('.ok') && !el.querySelector('.bad'),
                       head: el.textContent.split('\\n')[0].trim() };
          }
          return out;
        }""")

        shots = page.evaluate("window.EMBER.ATLAS.shots")
        meta = page.evaluate("""() => ({
          atlas: window.EMBER.ATLAS,
          beats: window.EMBER.D.beats,
          spec: window.EMBER.D.specs['6'],
          compressionRatio: window.EMBER.D.compressionRatio,
          events: window.EMBER.D.events,
          sources: window.EMBER.D.sources,
          tSpan: window.EMBER.D.tSpan
        })""")

        for sh in shots:
            m = page.evaluate("t => window.EMBER.bakeAt(t, {png:true})", sh["t"])
            png = base64.b64decode(m.pop("png").split(",", 1)[1])
            im = Image.open(io.BytesIO(png)).convert("RGB")
            im = im.resize((SAVE_W, SAVE_H), Image.LANCZOS)
            name = "06-%s.webp" % sh["id"]
            im.save(os.path.join(OUT, name), "WEBP", quality=WEBP_QUALITY, method=6)
            m["file"] = name
            m["bytes"] = os.path.getsize(os.path.join(OUT, name))
            stills.append(m)
            print("  %s  t %.4f  %s BP  sea %.1f m  %s  %d labels  %d KB"
                  % (name, m["t"], f"{m['yr']:,}", m["sea"], m["register"],
                     len(m["labels"]), m["bytes"] // 1024))
        browser.close()
    httpd.shutdown()

    if errs:
        print("PAGE ERRORS:", errs)

    side = {
        "_readme": "Baked by slice/build_atlas.py from slice/index.html. Positions "
                   "are CSS pixels against bakedAt.w/h. Every string here came out "
                   "of film.js's copy tables, which copyCheck diffs against "
                   "timeline.json - this file authors nothing.",
        "bakedAt": {"w": BAKE_W, "h": BAKE_H, "dpr": BAKE_DPR,
                    "saved": [SAVE_W, SAVE_H], "renderer": renderer,
                    # The colophon says "five tests passing". That is a claim
                    # about a BAKE RUN, not about the film as it stands right
                    # now, and --no-bake re-lays-out from a sidecar that may be
                    # older than the film. Dating it is what keeps the sentence
                    # true rather than merely once-true.
                    "when": datetime.date.today().isoformat()},
        "tests": tests,
        "stills": stills,
    }
    side.update(meta)
    with io.open(SIDECAR, "w", encoding="utf-8", newline="\n") as f:
        json.dump(side, f, indent=1, ensure_ascii=False)
    return side


# ── the page ────────────────────────────────────────────────────────────────
SPAN = 300000


def rail(side, mark_ts):
    """Law 05, as a still. Two rails: linear time above, scroll below, and the
    fan of connectors between them IS the compression. Same construction as the
    film's ruler in section 11 of film.js, from the same beat table - it has to
    be redrawn here because the film's is built by JS and this page has none."""
    def xl(yr): return (SPAN - yr) / SPAN * 1000.0
    p = ['<svg viewBox="0 0 1000 74" preserveAspectRatio="none" role="img" '
         'aria-label="The film\'s time ruler: fourteen beats on linear time above, '
         'on scroll below. Beat 06 is marked.">']
    p.append('<line x1="0" y1="20" x2="1000" y2="20" stroke="#1A2130"/>')
    p.append('<line x1="0" y1="56" x2="1000" y2="56" stroke="#2A3344"/>')
    for b in side["beats"]:
        mine = b["id"] == 6
        near = b["id"] in (5, 7)
        col = "#E6E2D8" if mine else ("#5F7794" if near else "#3A465C")
        op = ".95" if mine else (".7" if near else ".45")
        p.append('<path d="M%.2f 22 C%.2f 32,%.2f 44,%.2f 54" fill="none" stroke="%s" '
                 'stroke-width="%s" opacity="%s"/>'
                 % (xl(b["y0"]), xl(b["y0"]), b["t0"] * 1000, b["t0"] * 1000,
                    col, "1.3" if mine else "1", op))
        p.append('<rect x="%.2f" y="18" width="%.2f" height="4" fill="%s" opacity="%s"/>'
                 % (xl(b["y0"]) + .4, max(xl(b["y1"]) - xl(b["y0"]) - .8, .5), col, op))
        p.append('<rect x="%.2f" y="54" width="%.2f" height="4" fill="%s" opacity="%s"/>'
                 % (b["t0"] * 1000 + .8, (b["t1"] - b["t0"]) * 1000 - 1.6, col, op))
    # The disagreement, on the LINEAR rail and nowhere else - it is a claim about
    # years, not about where anyone was. Exactly as the film draws it.
    p.append('<line x1="%.2f" y1="8" x2="%.2f" y2="8" stroke="#E6E2D8" '
             'stroke-dasharray="3 3" opacity=".8"/>' % (xl(65000), xl(43000)))
    for y in (65000, 59000, 50000, 43000):
        p.append('<line x1="%.2f" y1="4" x2="%.2f" y2="13" stroke="#E6E2D8" opacity=".8"/>'
                 % (xl(y), xl(y)))
    for t in mark_ts:
        p.append('<line x1="%.2f" y1="50" x2="%.2f" y2="62" stroke="#E6E2D8" '
                 'stroke-width="1.2" opacity=".9"/>' % (t * 1000, t * 1000))
    p.append("</svg>")
    return "".join(p)


def esc(s):
    return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


MINIMUM = re.compile(r"minimum age|\u2265|at least", re.I)
TOLERANCE = re.compile(r"\u00b1|\+/-")


def date_str(e):
    """THE QUANTITY IS THE CLAIM, in the evidence table too.

    An event whose dateRange is a single value is one of two very different
    things, and rendering both as a bare year makes the rarer and more
    important one disappear. Liang Metanduno's 67,800 is a MINIMUM - the
    U-series date is on the calcite lying over the stencil, so the art is at
    least that old and may be much older. The Campanian Ignimbrite's 39,850 is
    a point estimate with a tolerance. Printing 'LIANG METANDUNO 67,800 BP'
    beside 'CAMPI FLEGREI 39,850 BP' says they are the same kind of number.
    They are not, and the atlas's caption already says 'at least' - so the
    table has to as well or the page contradicts itself.

    The qualifier is read off the event's own dateNote, never guessed. If a
    single-value event carries neither marker the build STOPS, because at that
    point this file cannot tell which kind of number it is holding and the only
    safe thing it can do is refuse to print it. That is a transporter declining
    to author, which is this file's whole job."""
    d = e["dateRange"]
    if not d:
        return "no date"
    if d[0] != d[1]:
        return "%s &ndash; %s BP" % (f"{d[0]:,}", f"{d[1]:,}")
    note = (e.get("dateNote") or "") + " " + (e.get("why") or "")
    if MINIMUM.search(note):
        return "&ge;&#8202;%s BP" % f"{d[0]:,}"
    if TOLERANCE.search(note):
        return "%s BP" % f"{d[0]:,}"
    raise SystemExit(
        "%s has a single-value dateRange (%d) and its dateNote says neither "
        "'minimum age' / '\u2265' / 'at least' nor a '\u00b1' tolerance, so this "
        "script cannot tell whether the atlas should print it as a minimum or as "
        "a point date. Say which, in the event's own dateNote in timeline.json, "
        "and rebuild." % (e["id"], d[0]))


def label_html(st, side):
    """The margin labels, as real text on the end of the leader the still has
    already drawn. Positions are per cent of the baked frame, so the type lands
    on the leader at every figure width."""
    w, h = side["bakedAt"]["w"], side["bakedAt"]["h"]
    rows = []
    for L in st["labels"]:
        rows.append(
            '<li class="lab" style="top:%.3f%%;right:%.3f%%">'
            '<b>%s</b><span>%s</span></li>'
            % (L["ty"] / h * 100, (w - L["tx"]) / w * 100, esc(L["k"]), esc(L["v"])))
    return "".join(rows)


def loose_html(st, side):
    """Everything else the frame would have lettered: the dimension figure, and
    the ground register's own block. Anchored the way the canvas anchored it."""
    w, h = side["bakedAt"]["w"], side["bakedAt"]["h"]
    keys = {L["k"] for L in st["labels"]} | {L["v"] for L in st["labels"]}
    rows = []
    for T in st["text"]:
        if T["s"] in keys:
            continue                       # already placed as a margin label
        side_css = ("right:%.3f%%" % ((w - T["x"]) / w * 100)) if T["align"] == "right" \
                   else ("left:%.3f%%" % (T["x"] / w * 100))
        rows.append('<div class="tx %s" style="top:%.3f%%;%s">%s</div>'
                    % (T["cls"], T["y"] / h * 100, side_css, esc(T["s"])))
    return "".join(rows)


def figure(st, sh, side, ev, seen):
    """seen is the reason this takes state. A copy window is a RANGE of t, so a
    line the film shows once - over several seconds of scroll - is live at more
    than one of the eight sampled frames. Beat 06's film voice spans shots 04 and
    05; the Madjedbebe record spans 05 and 06. Printing them at each is not a
    layout blemish, it is the atlas breaking the film's own discipline: one
    film-voice line per beat, and never more. So a line is placed at the first
    shot it is live on and nowhere after, which is also where it reads best -
    the voice lands on the gap, with the dimension it is about."""
    w, h = side["bakedAt"]["w"], side["bakedAt"]["h"]
    voice = ""
    if st["voice"] and ("v", st["voice"]["i"]) not in seen:
        seen.add(("v", st["voice"]["i"]))
        voice = '<p class="voice">%s</p>' % "".join(
            '<span>%s</span>' % esc(l) for l in st["voice"]["lines"])
    record = ""
    if st["record"] and ("r", st["record"]["i"]) not in seen:
        seen.add(("r", st["record"]["i"]))
        record = '<div class="record">%s</div>' % st["record"]["html"]
    state = '<p class="state">%s</p>' % "&nbsp;&nbsp;&middot;&nbsp;&nbsp;".join(st["state"])

    evrows = ""
    for eid in sh["ev"]:
        e = ev[eid]
        rng = date_str(e)
        cites = "<br>".join(esc(side["sources"][s]["cite"]) for s in e["sourceIds"]
                            if s in side["sources"])
        evrows += ('<tr><th scope="row">%s</th><td>%s</td><td class="c-%s">%s</td>'
                   '<td class="cite">%s</td></tr>'
                   % (esc(e["label"]), rng, e["confidence"], e["confidence"], cites))
    evidence = ('<table class="ev"><caption>Evidence</caption><tbody>%s</tbody></table>'
                % evrows) if evrows else ""

    return """
<section class="shot" id="s%(id)s">
  <figure>
    <div class="plate">
      <img src="atlas/%(file)s" width="%(sw)d" height="%(sh)d" %(load)s decoding="async"
           alt="%(alt)s">
      <div class="over">
        <ul class="labs">%(labs)s</ul>
        %(loose)s
        <div class="copy">%(voice)s%(record)s%(state)s</div>
      </div>
    </div>
    <figcaption class="col">
      <p class="shotmeta"><span class="no">%(id)s</span>
        <span>%(yr)s BP</span><span>t %(t).4f</span>
        <span>sea %(sea).1f m</span><span>%(register)s</span></p>
      <p class="cap">%(cap)s</p>
      %(evidence)s
    </figcaption>
  </figure>
</section>""" % {
        "id": sh["id"], "file": st["file"], "sw": side["bakedAt"]["saved"][0],
        "sh": side["bakedAt"]["saved"][1],
        "load": 'fetchpriority="high"' if sh["id"] == "01" else 'loading="lazy"',
        "alt": esc(alt_text(st, sh)),
        "labs": label_html(st, side), "loose": loose_html(st, side),
        "voice": voice, "record": record, "state": state,
        "yr": f"{st['yr']:,}", "t": st["t"], "sea": st["sea"],
        "register": st["register"], "cap": sh["cap"], "evidence": evidence,
    }


def alt_text(st, sh):
    """The image is the world, and the world is the part a screen reader cannot
    otherwise reach - every WORD in the frame is already text elsewhere on the
    page, so the alt describes the picture and does not repeat them."""
    return ("Beat 06, frame %s. The earth at %s BP, sea level %.1f metres, %s register, "
            "camera over %.1f east %.1f north." %
            (sh["id"], f"{st['yr']:,}", st["sea"], st["register"], st["lon"], st["lat"]))


def baked_when(side):
    """The date the sidecar was baked. Falls back to the file's own mtime for a
    sidecar written before this field existed - guessing would be worse than
    reading, and omitting worse than either."""
    return side["bakedAt"].get("when") or         datetime.date.fromtimestamp(os.path.getmtime(SIDECAR)).isoformat()


def build(side):
    ev = {e["id"]: e for e in side["events"]}
    A = side["atlas"]
    sp = side["spec"]
    by_id = {s["file"].split("-")[1].split(".")[0]: s for s in side["stills"]}
    seen = set()
    shots = "".join(figure(by_id[sh["id"]], sh, side, ev, seen) for sh in A["shots"])
    css = io.open(os.path.join(HERE, "atlas.css"), encoding="utf-8").read()

    html = """<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>One Ember &middot; Beat 06 &middot; The crossing to Sahul</title>
<meta name="description" content="Beat 06 of One Ember as a static atlas: eight frames baked from the film's own shader, with every word as text. Fifty to forty-three thousand years ago, the crossing from Sunda to Sahul.">
<link rel="icon" href="data:image/svg+xml,%%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%%3E%%3Crect width='16' height='16' fill='%%2304060A'/%%3E%%3Ccircle cx='8' cy='8' r='3' fill='%%23E8703A'/%%3E%%3C/svg%%3E">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,300..600&family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:wght@300;400;500&display=swap">
<style>
%(css)s
</style>
</head>
<body>
<!-- Generated by slice/build_atlas.py. Do not edit: every sentence below comes
     from the copy tables in slice/film.js, where copyCheck() diffs it against
     the qualifiers its own event carries in timeline.json, and every number
     comes from slice/data/film.json. Edit those, then rebuild. -->
<main>

<header class="top">
  <p class="kicker">%(kicker)s</p>
  <h1>Beat 06 &middot; <em>%(title)s</em></h1>
  <p class="dates">Act %(act)s &middot; %(y0)s &ndash; %(y1)s BP &middot; motion %(motion)d</p>
  %(lede)s
</header>

<figure class="railfig">
  %(rail)s
  <figcaption>
    <span>Linear time above &middot; scroll below &middot; 300,000 BP to now</span>
    <span>The film compresses %(ratio)d:1. Beat 06 is %(stretch).1f&times; stretched.</span>
    <span>The dashed bracket is the disagreement: it is on the time rail, never on the map.</span>
  </figcaption>
</figure>
%(shots)s

<footer class="close">
  %(closep)s
  <p class="back"><a class="go" href="index.html">The film, on a desktop</a>
     <a class="go" href="../storyboard.html">The storyboard</a>
     <a class="go" href="../timeline.json">timeline.json</a></p>
  <p class="colophon">%(colophon)s</p>
</footer>
</main>
</body>
</html>
""" % {
        "css": css, "kicker": A["kicker"], "title": sp["title"],
        "act": ["", "I", "II", "III", "IV"][sp["act"]],
        "y0": f"{sp['yearsBP'][0]:,}", "y1": f"{sp['yearsBP'][1]:,}",
        "motion": sp["motion"],
        "lede": '<div class="lede">%s</div>' % "".join("<p>%s</p>" % p for p in A["lede"]),
        "rail": rail(side, [sh["t"] for sh in A["shots"]]),
        "ratio": side["compressionRatio"],
        "stretch": (0.38 - 0.30) / ((50000 - 43000) / SPAN),
        "shots": shots,
        "closep": '<div class="lede">%s</div>' % "".join("<p>%s</p>" % p for p in A["close"]),
        "colophon": ("Stills baked from the film's fragment shader at %d&times;%d on %s, "
                     "renderer <code>%s</code>. Five tests passing at that build: %s."
                     % (side["bakedAt"]["w"], side["bakedAt"]["h"], baked_when(side),
                        esc(side["bakedAt"]["renderer"]),
                        ", ".join(k for k, v in side["tests"].items() if v["pass"]))),
    }
    p = os.path.join(HERE, "atlas.html")
    with io.open(p, "w", encoding="utf-8", newline="\n") as f:
        f.write(html)
    return p


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--no-bake", action="store_true",
                    help="re-lay-out from the existing sidecar")
    ap.add_argument("--headed", action="store_true")
    a = ap.parse_args()

    if a.no_bake:
        side = json.load(io.open(SIDECAR, encoding="utf-8"))
        print("re-laying out from %s, baked %s" % (SIDECAR, baked_when(side)))
        print("  the test results below are the ones RECORDED AT THAT BAKE, not fresh.")
        print("  If film.js has changed since, re-bake before believing them.")
    else:
        side = bake(headed=a.headed)

    bad = [k for k, v in side["tests"].items() if not v["pass"]]
    for k, v in side["tests"].items():
        print(("  PASS  " if v["pass"] else "  FAIL  ") + k + "   " + v["head"][:64])
    if bad:
        raise SystemExit("the film's own tests are failing (%s). The atlas is baked "
                         "from the film; a failing check is a still of a lie. Fix the "
                         "film first." % ", ".join(bad))

    p = build(side)
    kb = sum(s["bytes"] for s in side["stills"]) // 1024
    print("wrote %s  ·  %d stills, %d KB of art" % (p, len(side["stills"]), kb))


if __name__ == "__main__":
    main()
