# evidence/

Things this project claims that are only checkable by **looking**, or by
**breaking something on purpose**, kept where a clone can still find them.

`.playwright-mcp/` is gitignored, which is correct — it is scratch — but the
previous session learned that evidence written there does not survive. The
audit's reproduction scripts were rescued into `audit/` for the same reason;
these are the same kind of thing, produced by this project rather than by the
auditor.

| | |
|---|---|
| `tile-fallback-with-tile.png` | Beat 06 at `t 0.3350`, 1280×800, with `bathy_sunda.png` loaded. |
| `tile-fallback-no-tile.png` | The same frame with that tile **aborted**. |
| `make_tile_fallback.py` | Shoots both. Run it from the repo root. |
| `mutate_law06.py` | Makes the film wrong two ways and requires the panel to notice. |

## What the two frames are evidence of

Invariant 8's empty state. Two of the three terrain tiles are fetched *after*
the film starts, so a beat can be on screen before its tile arrives, and
`bindTile()` claims that what the reader gets in that window is **a resolution
change and never a value change** — the global texture is bound into the tile
slot with the whole world as its box, so `s.q` is `s.g` to the bit, `elevAt`
mixes the global field with itself, and the frame *is* the global field.

That is a claim about a picture. Compare them: the coastlines, the 70.5 km
dimension line, the labels' leaders and the ember head land in the same places.
The Wallacean islands are simplified, not moved. No frost on the waterline, no
displacement — which is what the 2026-09-08 registration bug looked like, and
the reason this one was checked by eye and not only by assertion.

## What `mutate_law06.py` is evidence of

That `independence()` measures something. It applies the outside audit's own
injection — a **smooth** dependence of `chill` on the eruption,
`0.05·exp(−((yr−39850)/400)²)`, gated on the event being present in the record —
and requires:

```
law06()         PASS      continuity is not independence
independence()  FAIL      and this is the test that can tell
```

and then takes the visible atlas link's id out of `index.html` and requires the
copy check to fail.

It restores both files from a **byte copy taken before anything was touched**.
The first version reverted with `git checkout --` and deleted an afternoon of
uncommitted work; a mutation harness must restore what it found, not what the
repository last remembered.
