# evidence/

Things this project claims that are only checkable by **looking**, or by
**breaking something on purpose**, kept where a clone can still find them.

`.playwright-mcp/` is gitignored, which is correct — it is scratch — but a
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
| `unroll-k0p00 … k1p00.png` | The unroll at six values of k, 1280×800. |
| `../unroll/shoot.py` | Shoots that ladder and runs the slice's four tests, twice. |

## What the two tile frames are evidence of

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

## What the unroll ladder is evidence of

That Law 03's second verb works, and that it works as a **surface morph** rather
than a cut. Read the six frames in order:

- **k 0.00** — the whole globe, the entry pose beat 11 hands over.
- **k 0.15** — the seam opens. A sliver of the Americas' west coast appears at
  the left edge with the Balsas ember standing on it. The antimeridian is one
  point on a globe and two edges on a map, and this is the frame where the film
  admits it.
- **k 0.30 → 0.50** — the corners square off and the poles unzip from a point
  into an edge. Every intermediate state is a sphere of growing radius, so the
  eye is never asked to accept a change of space.
- **k 0.75 → 1.00** — plate carrée, six centres of domestication in one frame,
  and the graduated filter carrying the sentence in the lower left.

The count in the corner is the argument: **2 of 6** centres in frame at k 0,
**6 of 6** at k 1. That is the whole reason Law 03 has an atlas register, and
the slice re-derives it on its own camera and its own surface rather than
quoting the storyboard.

Three of those six centres are drawn **dashed**, and that is not a style: the
Fertile Crescent, the Andes and the Sahel are named in the storyboard's frame
for beat 12 and have no event with coordinates in `timeline.json`. The picture
says which numbers exist.

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
