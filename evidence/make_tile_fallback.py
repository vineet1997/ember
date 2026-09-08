"""Beat 06 with its tile, and beat 06 without it.

The claim bindTile() makes is that the empty tile slot is a RESOLUTION change
and never a value change: the global texture goes into the tile slot with the
whole world as its box, so the shader mixes the global field with itself and the
frame IS that field. That is a claim about a picture, and it is checked here by
producing the picture rather than by asserting about it.

    python evidence/make_tile_fallback.py

Writes evidence/tile-fallback-{with-tile,no-tile}.png. Roughly ten minutes on
SwiftShader; no number from that machine means anything, but every pixel does.
"""
import os, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(ROOT, "slice", "tools"))
os.chdir(ROOT)
from harness import session, settle, utf8_stdout

utf8_stdout()
T = 0.3350
W, H = 1280, 800          # the smallest viewport the gate lets through

for tag, abort, tiles in (("with-tile", (), True),
                          ("no-tile", ("bathy_sunda",), False)):
    with session(width=W, height=H, abort=abort) as (page, errs):
        settle(page, tiles=tiles)
        st = page.evaluate("t => { const s = window.EMBER.renderAt(t); "
                           "return {tile: s.tile, ready: window.EMBER.tilesReady()}; }", T)
        page.wait_for_timeout(400)
        f = os.path.join(HERE, "tile-fallback-%s.png" % tag)
        page.screenshot(path=f, clip={"x": 0, "y": 0, "width": W, "height": H})
        print("%-10s tile=%s uploaded=%s  %s  errors=%s"
              % (tag, st["tile"], st["ready"], f, errs))
