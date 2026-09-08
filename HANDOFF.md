# Handoff — 2026-09-08 (second session of the day)

`CLAUDE.md` is loaded automatically and carries the thesis, the eight laws, the
architecture and the standing traps. **This file is the delta.** Read `CLAUDE.md`
first; read this second; do not re-derive either.

The previous handoff — the audit, the three remediation commits, and the open
list this session worked through — is the parent of this file in git history.

---

## Status in one line

**Phase 5 step 3 is done** — the audit's access finding and the Law 06
independence finding are closed — **and the director lifted the pause, so Phase 6
built the unroll.** What remains of the audit is the historical framing —
findings 1, 3 and 6 — which is **deliberately untouched**, because it needs the
papers open and they were not read.

Repo: `github.com/vineet1997/ember`, branch `main`.

---

## Phase 6: the unroll is built

**Law 03's second verb, `unroll/`.** The director lifted the pause; between
beats 08–14 and the unroll, the unroll went first, because the storyboard says
it is the film's largest technical unknown and building beats around a
transition that might not work is the expensive order.

**The answer was not to cut better. It was not to cut at all.** Put the map's
anchor at the origin and write the earth implicitly:

```
b·|q|² + 2·q_z = 0
```

b = 1 is the unit sphere through the origin; b = 0 is the plane z = 0; in
between it is **a sphere of radius 1/b with the anchor pinned**. The globe does
not melt into a map, it *inflates until it is flat*. Three things follow, and
they are the whole reason this family was chosen over the obvious mesh:

- **The fragment shader survives it.** Substituting the ray gives a quadratic
  whose leading coefficient *is* the bend, so the flat case is the linear root
  rather than a branch, and one stable quadratic covers the morph. No geometry,
  no mesh, no depth buffer, one renderer. A mesh would have cost the film a
  second earth renderer that has to agree with the first, which is the shape of
  every bug this project has had.
- **The map lands on plate carrée** — the projection the rasters are already in
  — so the atlas register adds no second distortion.
- **The seam and the poles fall out.** The globe opens at the antimeridian and
  the pole unzips from a point into an edge, because that is what a flat map
  does, and the film now shows it instead of hiding it. `evidence/unroll-k0p15`
  is the frame where it happens.

**Four tests, all passing twice.** `python unroll/shoot.py` runs them and shoots
the ladder.

| | |
|---|---|
| `sphereTest` | at k = 0 the morph is the unit sphere **exactly**, against two other formulas including the film's own `xyz()` |
| `purity` | the morph is a pure function of `t`, forward and backward |
| `agreementTest` | the shader and `project()` agree to **0.0015 px** across the morph |
| `sixTest` | **2 of 6** centres in frame from the globe, **6 of 6** from the atlas |

`sixTest` re-derives the number the storyboard has quoted since Phase 3, on a
different camera and a different surface, and it comes out the same.

**`agreementTest` failed twice and both times the test was wrong**, which is now
the fourth and fifth instance of this project's most reliable pattern. First it
compared the shader's answer against the place the probe started from — which
measures the distance from a continuous position to a pixel centre, half a pixel
by construction. It showed as *every* probe at k = 1 being wrong by exactly
0.2249°: one number, which is never a drift. It is a **round trip in pixels**
now. Then it encoded the *world* longitude, which runs to 190° for a map centred
at 10°E, and the clamp read as an 11-pixel drift at the seam — a failure
entirely inside the instrument. It encodes the *map* coordinate, which the edge
test has already bounded.

**A mirrored world, caught by looking.** `frame()` copied the film's
`cross(up, fwd)`, which is right in the film's chirality and wrong in anchor
space, where x is east and z points at the camera. East came out on the left.
Nothing in the arithmetic complains about a reflected earth; the first shot out
of the renderer did.

**Two of the film's constants were tuned at one scale and had to become
relative.** The relief slope and the waterline's gradient gate were set on a
beat-06 close shot at 0.0106° per pixel; the atlas register runs at 0.45, a
factor of forty. Unscaled, the relief turned a world map into a black rectangle
and the waterline lit the entire grazing limb white. Both are now scaled by the
frame's own degrees-per-pixel, which is also Law 08's argument from the other
end: **below a resolution there is no coastline to draw.**

### What the unroll deliberately does not have

- **The camera is the slice's own** — height, pitch, bearing and a lens shift —
  and **not** the film's sine-rule `frame()`. **The join to beat 11 is unbuilt**
  and is the next piece of work on it.
- **Three of beat 12's six centres have no coordinates in `timeline.json`.** The
  Fertile Crescent, the Andes and the Sahel are named in the storyboard's frame
  and sourced nowhere. The slice draws them **dashed**, labels them INDICATIVE,
  and `sixTest` says so in its own output. Larson et al. 2014 is already in the
  bibliography and maps the accepted centres. **Data before documents:** finish
  that before the beat is composed.
- No copy check, no atlas fallback, no accessibility work. It is a slice.

---

## What was open, and what happened to it

The previous handoff listed three items in recommended order. Items 1 and 2 are
closed. Item 3 is untouched, on purpose.

### 1. Access — closed. Six defects, all the same shape

Every one of them was *the film is correct and the reader cannot have it*.

**36.8 MB no longer blocks the first frame.** All three terrain tiles used to sit
in one `Promise.all` with the record and the globe — ~29 s at 10 Mbit, ~5 min at
1 Mbit, for two tiles the reader cannot reach for two more beats. The blocking
set is now the record, the globe and **the one tile the opening frame stands
on**; the other two are fetched while the film runs, nearest first, and decoded
inside a `requestIdleCallback`.

> **The empty tile slot has a defined state, and it is exact.** `bindTile()`
> binds the **global texture into the tile slot** with the whole world as its
> box, so `s.q` is `s.g` to the bit and `elevAt` mixes the global field with
> *itself*: the frame **is** the global field. A resolution change, never a
> value change, and no branch near a derivative. Look at
> `evidence/tile-fallback-with-tile.png` against `tile-fallback-no-tile.png` —
> coastlines, dimension line and ember land in the same places.

**What a screen reader receives is a function of `t` now.** A copy block is
written only when it changes and leaves by an opacity class, so a paragraph that
had left the screen stayed in the accessibility tree — and *which* paragraph
depended on the direction you arrived from. Two readers at one `t`, one state
hash, different text. `expose()` sets `inert` and `aria-hidden` from the same
`av`/`ar` that drive the fade, so it is not a timer that forgets, it is Law 01
applied one layer out. **The defect is still visible in the raw DOM and the fix
is what hides it** — `probe` the two arrival paths and you will see the two
different paragraphs sitting there, and `EMBER.readerCopy()` returning the same
thing for both.

**The gate is re-asked.** It used to be asked once at parse time. Turning
reduced motion on, or dragging to phone width, left the film scrolling with no
way out. Both roads now raise the gate, take the chrome out of the reading
order, and **stop the draw loop** — reduced motion means stop moving, and a film
still animating behind a panel that says it has stopped is the film lying.

**There is a way out on the page.** A skip link first in the tab order, and a
visible link in the chrome beside `press i`. The atlas used to be reachable only
from the gate, `<noscript>` and the WebGL failure page — none of which a
*working* film ever shows. This is now **placement law 4** in the type system.

**A failed raster no longer erases itself or dead-ends.** `step()` refuses to
write after a failure, and the failure page carries the atlas link.

**`--ice-dim` was 4.40:1 on the void** — below AA, and it is *every*
instrumentation surface in both artifacts. It is `#647C99`, **4.72:1**, same hue
to two decimal places. `ICED` on the canvas moved with it, because the film
draws a label's value in one and the atlas prints the same string in the other.
**The atlas is re-baked** — six of the eight stills changed; the two that did not
carry no labels, which is the right answer.

### 2. law06 independence — closed, and mutation-proved

`independence()` is the sixth panel test. It strips the eruption from all four
surfaces it occupies — the event in `D.events`, the marker in `LABELS`, the
paragraph in `RECORDS`, the horizon on the rail — and asserts the world is
**bit-identical at all 1,201 samples**.

It is non-vacuous **by assertion**: the strip must reach all four surfaces, and
with the eruption gone `law06`'s own *on screen* half must stop holding. A
positive control, because a test that cannot be made to fail is not measuring
anything.

**Mutation-tested with the audit's own injection**, which is the point:

| | `law06()` | `independence()` |
|---|---|---|
| smooth dependence of `chill` on the eruption | **PASS** | **FAIL** |
| the visible atlas link loses its id | — | (copyCheck **FAIL**) |

That first row is the gap the audit found, demonstrated and closed.
`evidence/mutate_law06.py` is the script; `evidence/README.md` says what each
artefact is evidence of.

**Its own boundary is stated in the panel and it is not small.** It strips the
film's *staging* of the eruption, not an eruption signal from the physical
record. `D.sea` and `D.temp` are measurements; if a sea-level stack carried a
depression at 39,850 BP this test would pass. That is a question for the
datasets.

**And the other four tests stopped overclaiming.** Each panel blurb now says what
it certifies and where that stops — `purity` is named a regression check, the
copy check says it bounds the film and not the literature, `absence` says it is a
property of *this* function and not a promise about beats 08–14, `hold` says it
counts at the sample spacing.

### 3. Historical framing — NOT DONE, and not by omission

Findings 1, 3 and 6. The previous handoff says *do not act on the audit's reading
of the literature without reading it*, the papers were not read this session, and
so nothing was changed. The URLs are in `audit/AUDIT-EVIDENCE.md`.

**Finding 1's structural half needs no citation and is still fair**: the film
claims neutrality on Sahul chronology while the *picture* adjudicates — the ember
rides the 50–43 ka genetic window, the atlas labels landfall 45,450 BP, and the
older reading is demoted to a rail annotation. The copy check literally approves
this. That is the next thing to argue about.

---

## What to check on a real screen, and it is one thing

⚠️ **The deferred tile decode is new main-thread work and no automated browser
can tell you whether it drops a frame.** It is scheduled inside a
`requestIdleCallback` with a 4 s timeout, which is a mitigation and not a
guarantee — the trade was taken deliberately: *one possible hitch, once per
tile*, against half a minute of black screen before the first frame.

Open the panel, scroll from the top, and watch the **worst frame** the first time
the reader crosses into beat 06. Everything else about this session's work is
load order and DOM and does not touch the draw path.

Nothing else changed the shader. The earth pass is still the Phase 4 one at two
elevation fetches per pixel.

---

## Verification

```bash
python slice/tools/check.py verify          # six panel tests twice, plus seven more
python slice/tools/check.py verify --runs 3 # five is better than two
```

`verify` now runs the **six** panel tests and then **seven** things the panel
cannot see — because they are not functions of `t`, or because they are about the
film **failing** and a panel only runs on a film that started:

- the film letters its own frames; a bake leaves no armed annotation sink
- every fallback road reaches the atlas
- the atlas is intact with JavaScript off, and the film voice appears once
- **one `t` reached two ways hands a reader the same copy**
- **the two background tiles do not block the film when aborted**
- **a blocking raster that fails still leaves a door open, and is not erased**
- **the gate answers a reader who changes their mind**, both roads, both
  directions, with the loop actually stopping

`harness.session(abort=(...))` is how the failure roads are reached. That is the
audit's central rule applied to the tooling: *a check about failure needs a
configuration that could have disagreed, and a page where everything arrives is
not one.*

---

## Traps, added to this session's account

- **A mutation harness must restore what it FOUND, not what git last
  remembered.** `mutate.py` reverted with `git checkout -- slice/film.js`, and
  every edit of the session was uncommitted: one line of cleanup deleted an
  afternoon of work. It takes a **byte copy before touching anything** now, and
  asserts both files are restored byte-for-byte at the end. Related, and it bit
  immediately afterwards: `git checkout` restores through `core.autocrlf`, so a
  file that was LF in the working tree comes back **CRLF** — check before you
  re-patch, and convert back.
- **The heredoc trap in the previous handoff is real and cost a patch.** `and \`
  at the end of a line inside a `<<'PY'` heredoc arrives as a line continuation
  and the match silently fails. Write patch scripts with the Write tool; do not
  inline Python containing backslashes.
- **A viewport under 1280×800 gates the film, so the boot code never runs at
  all.** Two smoke tests were debugged for the wrong reason before this was
  obvious. Any Playwright session that needs the film to *start* must be at least
  1280×800.
- **A generated list beside a typed count will drift the day the list grows.**
  The atlas colophon read *"Five tests passing at that build:"* and then printed
  six, one line after the sixth test was added — in the file that documents that
  exact failure mode. The count comes off the list now.

Everything in the previous handoff's trap list still holds unchanged.

---

## Commands

```bash
python slice/serve.py                   # the film, on :8123
python unroll/serve.py                  # the unroll, on :8124/unroll/
python slice/tools/check.py verify      # is the film sound; non-zero exit if not
python unroll/shoot.py                  # the unroll's four tests, twice, plus the ladder
python slice/build_atlas.py             # bake + write atlas.html (~10 min)
python slice/build_atlas.py --no-bake   # re-lay-out from the sidecar (seconds)
python data/build_rasters.py            # rebuild terrain; ends with verify_registration()
```

In the film: `i` = the panel (**six** tests), `d` = shader x-ray, `#t=0.3350` /
`#beat=06` to jump, `?still=1` kills copy transitions, `?nogl=1` forces the
WebGL failure path.

---

## Parked for the director, unchanged

- **The pale light on the limb.** `EMBER.renderAt(0.2870)` with `?still=1`, and
  again at `t 0.4040` where it reads as concentric arcs. Still undecided; look at
  the frame before changing anything.
- **Image rights** for Leang Karampuang and Denisova 11. Lead time, not launch
  time. The layouts carry the holes rather than hiding them.
- **Vegetation dataset** still unnamed; has now cost a written frame in beats
  02, 05 and 12.
- **A second idea for the temporal beats**, 05 and 07 — the storyboard's `#atlas`
  section carries the argument, and the decided negative: do not extend the atlas
  to them by adding stills.
