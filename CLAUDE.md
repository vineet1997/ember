# One Ember

A scroll-driven film of **the peopling of the habitable world** — 300,000 BP to ~1300 CE,
then a bridge across the last 700 years and a present-day close. Fourteen beats, four acts,
8–12 minutes. Ships on vineet.cc/one-ember.

**Thesis:** Every one of us is African. One line that left did not stop, and its descendants
now live everywhere else.

Desktop is the film (≥1280×800). Mobile gets a **static atlas** — a longform illustrated
essay, same art and writing, no scroll-cinema. That one artifact is also the
`prefers-reduced-motion` fallback, the no-JS fallback and the crawler content.

---

## Read these first

| File | What it is |
|---|---|
| `storyboard.html` | **The single source of truth.** All 14 beats: frame, camera, earth state, on-screen copy, evidence, why it's here. If a shot isn't specified there, it isn't in the film. |
| `timeline.json` | Every dated claim with range, coordinates, confidence, citation. 63 events, 13 routes, 65 sources, 3 open questions. **Nothing goes on screen that is not in here.** |
| `data/` | The environmental channels. All acquired and built. |
| `slice/` | **Beats 05, 06 and 07 at final quality, on one continuous `t`.** The renderer, the type system, the ruler, the match cut, the hold, the plume, permanent absence, and five tests. This code *is* the film. |
| `slice/atlas.html` | **Beat 06 as a static artifact.** Eight stills baked from the film's own shader; every word live HTML. Mobile, reduced motion, no-JS, crawlers, and a browser with WebGL off all land here. Generated — edit `film.js` and rebuild, never this file. |
| `spike/` | Phase 3 throwaway prototypes. **Do not promote this code** — rewrite from scratch, keep only what it taught. |

Published storyboard: https://claude.ai/code/artifact/2e20728f-4ebf-4f50-812c-be3cb964b56f

---

## The eight laws

1. **One number governs everything.** Deep time is a single float `t` from scroll. Sea level,
   ice, sky, camera, every ember read `t` and nothing reads anything else. Asserted, not
   assumed — the spike hashes state at 401 points forward and backward and diffs them.
2. **Humans are the only warm light.** Earth is slate/ice/bone. People are ember. And
   migration is light that *travels* — a head moving along a path with a trail, never lights
   that appear and sit.
3. **Three registers, two transitions.** Atlas (simultaneity) / orbital (movement) / ground
   (a moment). *Match cut* for orbital↔ground; *unroll* for orbital↔atlas.
4. **The dot is a population, the cut is the evidence.** Orbital is *then*; ground is *now*,
   the object as we hold it. Only orbital rides the time axis, so a ground cut can never
   break Law 01.
5. **Time is non-linear and must confess it.** A visible ruler that stretches toward the
   present. Compression ratio 155:1.
6. **Nothing on screen that isn't causal — for what happened, *or for how we know it*, and
   the register says which.** *(Widened 2026-09-07, building beat 07. The Campanian Ignimbrite
   changes nothing about what happened, but at ±140 years it is how we know **when** beat 07
   happened. The film had already built that register in beat 06 — Madjedbebe's contested
   reading is drawn **on the time rail, not on the map** — so the grammar existed and worked.
   The widening is **not** a loosening: it ships with a bar the old law lacked, and the bar is
   machine-checked. **An epistemic object may not perturb `stateFor(t)`.** It may be a marker,
   a horizon and a sentence; it may not grey a sky, dim a light or move a camera. Under the old
   law the CI was cut for a **staging** no test would have caught.

   **What `law06()` actually shows, corrected 2026-09-08 after an outside audit.** It halves the
   sample spacing across the eruption's instant and requires every channel's largest step to
   halve with it — which a jump would not. That catches a **staged discontinuity**, which is the
   bug the film committed. **It is not a proof of non-influence, and the law used to say it was.**
   Continuity is not independence: a channel driven smoothly by the eruption passes every line
   of it, and the audit demonstrated exactly that by injecting a smooth 100 m sea-level
   depression centred on the eruption.

   Worse, until 2026-09-08 the walk **omitted the one channel the decision was about.** `temp`
   drives `uChill`, which tints the sky and the limb — and `chill` was computed inside
   `drawEarth` rather than in `stateFor`, so it was not state, not in the hash, and not in
   `CHANNELS`. The test that exists to prove the eruption does not grey the sky was not watching
   the greying. **An exhaustive walk over an incomplete set reads exactly like an exhaustive
   walk.** `chill` is state now, both it and `temp` are channels, and injecting a step in the
   temperature record at 39,850 BP fails the test on both while the same step 550 years away
   passes.

   **The test that would prove non-influence is a different one and is not built:** remove the
   eruption from the data entirely and assert the world is bit-identical at every `t`. That
   compares against a configuration that could have disagreed, which is the only kind of check
   worth the word "proves".)*
7. **Copy is checked against the data, not just dates.** Every on-screen line gets diffed
   against the qualifiers its own event carries.
8. **Change is an edge that moves, never a fill that fades.** The eye tracks edges. A
   gradient says *atmosphere*; an edge says *something is happening*.
   **And an edge is a pixel, not a metre** — thresholding `|elev − sea| < k` frosts the
   whole Sunda shelf white, because a flat shelf at the waterline satisfies it
   everywhere. Measure the distance to the zero crossing *in screen pixels*, and smooth
   the field to the pixel the frame has first: a coastline is fractal.

---

## Data — complete, all checked

```
data/bathymetry.png         4096×2048 terrain-RGB, ETOPO 2022 bedrock, 0.305 m precision
                            elevation = (R*256 + G) * scale + offset
                            REBUILT 2026-09-08: the old one was misregistered, see below
data/sealevel_merged.json   322 pts, 300 ka→0. Spratt stack + ICE-6G_C, 0.5 ka deglacial
data/temperature.json       2,998 pts, 60 ka→0 at 20 yr. NGRIP δ¹⁸O (a PROXY — never °C on screen)
data/ice_atlas.png          48 ICE-6G_C slices, 26 ka→0, one 27 KB atlas

Three frame tiles, all native 60″ (1.85 km/px), all the same ETOPO grid:
slice/data/bathy_redsea.png 2040×1920, lon 28–62°E  lat 4–36°N    beat 05, both doors
slice/data/bathy_sunda.png  3840×3120, lon 92–156°E lat 30°S–22°N beat 06, Wallacea
slice/data/bathy_europe.png 4320×1860, lon 12°W–60°E lat 30–61°N  beat 07, Europe

slice/data/film.json        the whole data contract — 3 beats, 13 events, 4 routes, 1 range,
                            all measurements. **Supersedes beat06.json, which is deleted.**

slice/atlas/06-01..08.webp  the baked stills, 1920x1080, 825 KB the lot. WORLD ONLY - no type
slice/atlas/stills.json     the sidecar: projected label geometry, the copy live at each t,
                            and each still's state hash. Written by build_atlas.py
```

**Terrain-RGB is not mip-safe.** A mip level averages the *high byte* and rounds it —
half a step of R is **39 m**, and that averaging happens exactly at a coastline. Decode
to a float texture (R16F) on load; then the pyramid is valid and the shader loses its
decode line. Do not sample terrain-RGB at LOD 0 either: it aliases into noise that the
waterline edge faithfully draws as frost.

Rebuild, in this order: `python data/build_rasters.py`, `python data/build_sealevel.py`,
`python data/build_beat06.py`, `python data/verify_wallacea.py`, `python data/build_beat0507.py`,
`python slice/build_slice.py`, `python slice/build_atlas.py`. `build_rasters.py` ends by
running `verify_registration()`, which is the only check in the project that compares a
representation against a *different* one; read it before trusting any new texture.
(`data/edit_timeline_p5.py` is idempotent and already applied —
it wrote the northern spine, the pale extent and the Law 06 decision into `timeline.json`.)
`data/raw/` is 496 MB of source grids — **gitignore it**, it's reproducible from the URLs in
`timeline.json → earthStateDatasets`.

Numbers not worth re-deriving: land above 0 m = **28.8%** of grid, above −130 m = **34.4%**
(that gap is the shelf). *(Both moved in the 2026-09-08 rebuild — they were 28.5% and 34.0%,
measured on a grid that was missing 18.67° of longitude. See the registration bug below.)* Ice cover **18.1%** at LGM vs **11.2%** today. Lowstand **−131 m**.
Beat 06: Wallacea minimum-bottleneck crossing **70.5 km** at −74 m, floor **70.4 km** at
*any* sea level — the sea falls 131 m and the gap does not close. Sunda and Sahul each one land
component at −68 m, Tasmania included. Dry land **23.75% → 30.88%**, a gain of 30% — but read
that carefully, because the film got it wrong twice. It is the **connectivity box, 90–160°E
50°S–30°N** (which is *not* the render tile, 92–156°E 30°S–22°N — the film labelled it with the
tile's bounds for a phase), and 23.75% is **today**, not the beat's opening. Across the beat
itself the change is **30.44% → 30.88%**, about 1.4%: the shelf was already out when beat 06
opened, and beat 05 is what exposed it. The box now travels with the measurement in
`film.json → measured.landBox`, and the on-screen label is generated from it. Sulawesi's four arm tips and 95 km palm circle, for the match cut, are in `slice/film.js`.

Beat 05, measured in Phase 5 on the **same bottleneck definition** as Wallacea — deliberately, so
the two may be spoken in one sentence. Each door needs its **own corridor**: Africa and Eurasia are
one land component at every sea level by way of Sinai, so a global bottleneck reads 0 km and
measures nothing. **Sinai is dry land at every sea level in the record**, lowstand included.
**Bab-el-Mandeb is water at every sea level in the record** — 28.5 km today, **6.6 km at 60 ka**,
4.0 km at the −131 m lowstand, and never zero. At 60 ka the figure is threshold-sensitive:
**5.2 / 6.6 / 9.1 km** as the minimum island rises 3.4 → 34 → 344 km², which is why the on-screen
line reads *under ten kilometres, as little as five* and not a single number. The Persian Gulf
basin (48–57°E, 24–30.5°N) stands **97.6% dry** at −84.7 m against **61.1%** today.

The **quantity-vs-claim trap caught two more this phase**, both before they reached a frame — see
"How this project has actually gone wrong" below. It is the failure mode to expect.

---

## Architecture

**The renderer is a fragment shader**, not canvas vectors. Projecting a thresholded raster
onto a globe needs per-pixel inverse projection. Consequence: **the film needs no coastline
geometry at all** — one elevation raster, one float, one comparison, and every shoreline
falls out of it, including ones that have been underwater for 12,000 years.

Scroll damping is `cur += (target - cur) * 0.08`. One rAF loop. Transform and opacity only.

### `slice/` — the film's foundation. Read `film.js` top to bottom before editing it.

```
slice/index.html   shell + THE TYPE SYSTEM (three voices, three placement laws, in the head)
slice/film.js      the whole engine, in 13 numbered sections
slice/serve.py     dev server with no-cache headers — use this, not http.server
slice/build_slice.py   rebuilds data/film.json + the half-size global texture
slice/build_atlas.py   bakes beat 06's stills and writes atlas.html
slice/tools/check.py   verify / probe / shoot — ask the film questions from a shell
slice/tools/harness.py the Playwright boot the three of them share
```

Eight invariants. Breaking any of them breaks a law, not just a frame:

1. **`stateFor(t)` is pure and is the only source of world state.** Everything else reads its
   result. The purity test in the panel will catch a violation; run it after any change.
2. **`frame(c)` is the single camera definition, and the shader and the overlay both use it.**
   The shader inverse-projects, `project()` forward-projects. If they disagree the ember
   drifts off the coast it is standing on. A camera keyframe names the **look-at** point;
   position falls out of the sine rule, and pitch has a ceiling of `asin(1/(1+alt))`.
3. **No `texture()` inside non-uniform control flow.** Derivatives are undefined there and
   the whole waterline depends on them. Use `textureLod` with a hand-computed LOD.
4. **Ember is for people only** — the route head, its trail, the pigment a hand was blown
   around. Never in type, never in chrome.
5. **Everything expensive is built once at load**, not on first entry to the thing that needs
   it. The stencil plate is ~1.3 M pixels of value noise; the three elevation tiles are decoded
   from terrain-RGB to float; the light sprites and the densified routes are built there too.
   Any of these done mid-scroll drops a second of frames at a beat boundary.
6. **Overlay drawing is per-frame and must stay cheap.** *(Corrected in Phase 5: this used to
   read "no image compositing in the loop except the pre-built plate", and there are now three
   pre-built images — the plate and two light sprites. The invariant's real content is that
   nothing expensive is **built** in the loop; a `drawImage` of a sprite made at load is the
   cheap path, not a violation of it. The plume and the pale field are 60 and 210 soft dots per
   frame, and a radial gradient per dot per frame would have been seven thousand gradient
   objects a second.)*
7. **No canvas text site writes a glyph.** All three — `drawLabels`, `drawGap`, `drawCut` —
   hand their string to `gtext()`, which either draws it (the film) or records where it would
   have gone (the bake). That is what lets the atlas bake the **world** and place every **word**
   as live HTML, which it must, because the atlas is the crawler content, the screen-reader
   fallback and the page a browser without WebGL gets — and because the Law 07 copy check cannot
   see text that is pixels. It is enforced on the functions rather than the output: the copy
   check asserts none of the three contains `fillText`, so a glyph put back on the canvas fails a
   test the day it is typed. `BAKE` is a render option, not world state; `stateFor` never reads
   it and the purity test is untouched by it.
8. **One tile slot, chosen by `t`.** Three beats need three high-resolution tiles and they are
   eighty degrees of longitude apart, so they can never share a frame. `tileFor(t)` picks one
   and the CPU swaps the binding — which keeps the shader byte-for-byte the Phase 4 one, at two
   elevation fetches per pixel instead of eight. The choice is in `stateFor`, so the purity test
   covers it. **Neither swap is geometrically clean** and the code says so: at two earth radii a
   frame is ~50° wide and the tiles are 30° apart, so the outgoing tile always clips an edge.
   What makes it acceptable is speed — one frame, at the edge, inside the tile's own blend
   margin, while the camera crosses ~10° of longitude per frame.

Two keys: `i` = director's panel — state readout, **frame time and GPU/overlay cost**, five
tests, measured figures. `d` = shader x-ray, cycling live edge / ghost edge / gradient /
pixel-distance.

`#t=0.3350` jumps to a frame, `#beat=05` to a beat, `?still=1` disables the copy transitions so
a drawn frame is finished the moment it returns, and `?nogl=1` forces the WebGL failure path.

**`window.EMBER.renderAt(t)` draws one frame synchronously and returns its state.** This is the
single most useful handle in the file for anyone working on it, and it exists because every
automated browser throttles `requestAnimationFrame` to uselessness. It makes three things
possible that were not: shot-checking without a screenshot per guess, **baking the atlas's
stills from the same shader at the same `t`** — the only way the two artifacts cannot disagree —
and timing the draw path, which vsync makes impossible from a frame interval. Options
`{overlay, dom, measure}` all default on; `measure:false` keeps a synchronous bake out of the
panel's readout. It sets `target` and `cur` together so a live loop redraws the same frame
instead of sliding off it, and it deliberately does **not** scroll.

`EMBER` also exposes `stateFor`, `camAt`, `frame`, `project`, `goto`, `bench`, `ROUTES`,
`tileFor`, and all five tests.

### Working in this repo — traps that have already cost a day

- **Headless and hidden browsers cannot time this film, and this was re-confirmed the hard
  way in Phase 5.** rAF is throttled and `performance.now()` is quantised. Measured this build:
  the in-app Browser pane reports `document.hidden === true` and ran **zero** rAF ticks in
  600 ms; Playwright, not hidden, ran **one tick in 800 ms**. Both will happily render a correct
  still and report nonsense timing. Do not tune performance against those numbers. Put a readout
  on screen and ask Vineet to look.
- **The panel reports the GPU *and* the overlay, and you need both.** The earth pass is the
  shader; the overlay is the 2D canvas. Everything Phase 5 added — the plume, the pale field —
  is overlay work, and the GPU timer cannot see a byte of it. A panel showing only the GPU would
  have said, honestly and uselessly, that nothing got more expensive.
- **The in-app browser pane screenshots WebGL as pure black.** Use Playwright for stills.
  Playwright will only write inside the repo root — shoot into `.playwright-mcp/`
  (gitignored) and move the keepers out. **The pane cannot render `atlas.html` either** — that
  page is plain HTML and `<img>`, and the pane still timed out drawing it. Playwright for
  anything you need to *look* at; `browser_evaluate` returning small JSON for anything you need
  to *know*.
- **A headless browser can bake this film. It must still never time it.** Playwright's Chromium
  ran the whole thing correctly on **SwiftShader over Vulkan** — WebGL2, float elevation
  textures, the waterline, the match cut — at about **a minute a frame**. Every still is right
  and no number from that machine means anything.
- **A lazy `<img>` is empty when you screenshot it.** Two passes were lost to an atlas page that
  screenshotted as pure black while the stills were provably 20–60 mean luminance on disk. Force
  `loading="eager"`, reassign `src`, and `await img.decode()` before the shot.
- **`python slice/tools/check.py verify` before believing the film is sound.** It runs the
  five panel tests *twice* and then checks four things the panel cannot see, because they are
  not functions of `t`: that the film still letters its own frames and a bake does not leave the
  annotation sink armed; that all three fallback roads reach the atlas; that the atlas is intact
  with JavaScript disabled; and that the film voice appears on it exactly once. Non-zero exit on
  failure. `check.py probe -e "<js>"` answers anything else in JSON, which is cheaper and more
  precise than a screenshot — and works when screenshots do not.
- **Always serve with `slice/serve.py`.** A caching static server hands you yesterday's
  shader and you will debug code that is not running. A browser that visited an earlier
  build may still hold it — add `?v=2` to the URL once to break that.
- **A test that only works once is not a test — and scoping is the fix, not wording.** Beat 06's
  copy check searched `document.body` for a degree sign — and the sentence *explaining* that check contains one, so
  it passed on the first run and failed on every run afterwards, against its own output. It had
  shipped that way. Checks now read the film's own surfaces and copy tables, which is idempotent
  and also stricter: it covers the canvas labels, which never touch the DOM. It happened a
  second time in Phase 5 step 2 — a check for the no-script fallback found a no-script element
  the panel had built out of that check's own explanation — so `copyCheck` now escapes angle
  brackets before writing its output, and page queries are scoped (`body > noscript`) rather
  than global. **Run every test twice before believing it**; five is better.
- **`?nogl=1` forces the WebGL2 failure path**, which is otherwise unreachable and was
  therefore broken. On failure the page now probes WebGL2/WebGL1 on throwaway canvases,
  names the GPU, and says what to do; the panel key is bound before anything can fail, and
  both tests run without a GPU.

---

## Where we are

Phases 0–4 done, **Phase 5 step 1: beats 05, 06 and 07 at final quality in `slice/`, on
one continuous `t`** — and **step 2: beat 06 also exists as a static atlas**, `slice/atlas.html`,
baked from the film's own shader. Run the film with `python slice/serve.py` — no-cache headers, because a plain
static server will hand you yesterday's shader and you will debug it for an hour.
`#t=0.2650` jumps to a frame and `#beat=05` jumps to a beat; `i` opens the director's panel
(five tests, all passing); `d` cycles the shader x-ray that found the waterline bug.

**Why one artifact and not three.** This was a decision, taken on Law 01, not a default.
Three separately-built beats would need three `t` windows, three camera splines and three
copies of the state function — and the two places this work was most likely to fail are 05's
release into 06 and 06's pull-back into 07, which are exactly the boundaries a three-artifact
build makes unscrubbable. **A boundary you cannot scrub across is a boundary you cannot
direct.** It also made beat 07's central claim testable at all: *that colour is gone for the
remaining seven beats* is a statement about `t` in [0.44, 1.0] — beats that do not exist — and
only a function total over the whole span can be asked about frames nobody has made. Separately
**addressable** was kept, and is cheap: `#t=` and `#beat=`.

**What beat 05 answered.** A locked camera survives, and *the earth is why*. The camera is
bit-identical across 0.060 of `t` — a quarter of the artifact — and what carries it was not
designed: the sea-level curve already had a three-act shape inside the lock. Nothing for two
thousand years, then **fifteen metres in four thousand** (the fastest waterline in the first
half of the film), then nothing again — four metres over two millennia. The beat's last fifth
has *only the year* moving. **Law 08 does the work the camera cannot.** Beat 05 is also the one
beat where **Law 02's second clause is suspended**: "light that travels, never lights that
appear and sit" governs how a *migration* is drawn, and this beat's subject is the negation of
a migration — a light that is not going anywhere and is still lit. The staying is the sentence.

**How permanent absence lives inside Law 01.** Not a flag. A flag is a memory of a `t` you
passed through, and Law 01 says the frame is a function of the `t` you are *at* — scrub
backwards past a flag and the colour never returns. Instead `paleRGB(t)` returns the colour
when it exists and **`null`** when it does not, and null is not a dimmed colour, it is *nothing
to draw with*: every site that draws pale light reads it and returns early, so the palette is
not policed, it is **absent**. It is in the state hash, so the purity test already proves it
comes back at the same `t` scrubbing backwards; `absence()` walks `t` out to **1.0** and proves
it is null at all 3,001 samples across seven unbuilt beats. That is the whole return on one `t`.

**And Phase 5 step 2: the atlas, for beat 06.** `slice/atlas.html`, built by
`python slice/build_atlas.py`. Eight stills baked from the film's own fragment shader at eight
values of `t`; **every word on the page is live HTML.** That split is the design and it is
forced: the atlas is the crawler content, the screen-reader fallback and the page a browser
without WebGL receives, so baked type would be pixels in exactly the artifact whose job is to be
text — and the Law 07 copy check cannot see text that is pixels. Its copy lives in `film.js`
(`ATLAS`, beside `VOICES`, `RECORDS` and the new `GROUND`), so the check covers it; the builder
transports and lays out and authors nothing. Above 1280px the words go back to the positions the
bake recorded and the frame is the film's frame; below it the same DOM reflows and every word
that was standing on the still moves under it. Nothing duplicated, nothing hidden. Measured:
**825 KB of art, about 1,560 words, zero `<script>` tags.**

**The atlas found a hole in the copy check.** Five lines had been on screen since Phase 4 and
were never checked — the ground register's instrumentation, including *ORIGINAL DIAGRAM, NOT A
PHOTOGRAPH OF THE SITE* and the reserved plate's *PERMISSION PENDING*. They were string literals
inside a draw call and the check reads tables. They are a table now. **The check could not see
them**, which is the same failure as the check that only worked once. Copy check: 30 lines → 44.

**A sequence of stills IS beat 06 — and that does not generalise.** Beat 06 is a journey, so its
content is *change of place*: take any two frames and something is somewhere else, and the frames
in order are the beat. The beats either side are **temporal devices, and a page cannot spend
time.** Beat 05's subject is duration — "nothing happens for ten thousand years" is said by
spending scroll, and a still of the dead stretch is a locked camera over a flat sea, correct and
saying nothing, because the content is the time you spent looking. Beat 07's subject is a
subtraction that must *persist* — "that colour never comes back" is a claim about every `t` after
0.4405 including seven unbuilt beats, and a static page has no *after*; print two lights then one
and the reader sees a change, never permanence. **Two candidates, neither prototyped:** for 05,
invert the figure so the *ruler* is the illustration and the reader reads a duration off an axis;
for 07, state the permanence and print `absence()`'s own result as the evidence for it. **What is
decided is the negative: do not extend this atlas to 05 and 07 by adding stills.** Eight more
frames of a locked camera would be the atlas lying about what the beat is.

**Next — Phase 5 continued:**

1. **A second idea for the temporal beats**, 05 and 07 — see the two candidates above, and the
   storyboard's `#atlas` section for the argument.
2. **The unroll**, which is still the largest technical unknown — see below.

**The frame budget was measured in Phase 4 and is fine.** Intel Iris Xe, integrated: **60 fps**,
frame interval **16.7 / 16.9 / 17.0 ms** median/p95/worst — a 0.3 ms spread over 120 frames,
nothing dropped. A frame interval is clamped by vsync and says nothing about headroom, so the
panel also runs a GPU timer query, which reads the GPU's own clock: the earth pass costs
**0.66 ms, 4% of a frame**.

**Phase 5 did not spend that budget, by construction.** The shader is byte-for-byte the Phase 4
one and still does two elevation fetches per pixel — three beats, three tiles, but one tile slot
swapped on the CPU (invariant 8). So the earth pass costs what it cost. What is new is *overlay*
work: up to 210 pale patches and 60 plume particles composited in 2D, which the GPU timer cannot
see at all. **The panel now reports the overlay separately** for exactly that reason.

**Measured on the machine, 2026-09-07, scrolling from the top:** 60 fps, frame interval
**16.7 / 17.1 / 33.5 ms** median/p95/worst, earth pass **0.84 ms**, overlay **0.90 / 1.50 ms**
with 210 pale patches and 92 plume particles live. Roughly 2 ms of a 16.7 ms frame — about 12%.

**The earth pass reads 0.84 ms, not Phase 4's 0.66, and that is not a regression.** The shader
and its two fetches are unchanged; what changed is *which frame was measured*. That reading was
taken at the default entry point, which is beat 05 — a locked, wide, low shot where the globe
fills almost the whole screen and very few pixels take the sky early-out. Beat 05 is close to
the worst case for pixel coverage in this artifact. Check `#t=0.3350` for the beat 06 number.

**The 33.5 ms worst frame is one dropped frame, and it is not in the draw path.** Five
hypotheses were tested with `renderAt` and all five were cleared: the pale field (210 patches
cost ~0.4 ms), the plume, the forced reflow in `drawCopy` (~0.4 ms, and the spike persists with
`dom:false`), the tile swap (~0.4 ms, twice in the film), and glyph layout at a copy boundary.
Two runs of **900 draws each had zero samples over 3 ms**. The outliers that do appear are
sporadic, uncorrelated with anything being drawn, and absent from long steady runs — the shape
of a GC pause or browser scheduling, not of work. **Do not optimise this without reproducing it
first**; the draw path has about 10× headroom and the one plausible remaining lever was measured
and rejected (see below).

⚠️ **A frame interval still needs a human on a real screen**, because every automated browser
throttles the loop — the in-app pane reports `document.hidden === true` and ran **zero** rAF
ticks in 600 ms; Playwright, not hidden, managed **one tick in 800 ms**. Both render correct
stills and report meaningless intervals. The *draw path*, though, is now measurable anywhere:
press **Run the benchmark** in the panel, or call `EMBER.bench()`.

**A browser can simply switch WebGL off, and one did.** Chrome 151 on this machine: *"GPU
process was unable to boot: GPU process crashed too many times with software GL"*, crash count
3, `Disabled Features: all` — on a healthy Iris Xe that Chrome's own report lists as capable,
with hardware acceleration on in settings. Edge on the same machine ran it at 60 fps. The film
diagnoses this honestly now (probes WebGL2/WebGL1 on throwaway canvases, names GPU and
browser, says what to do), but **a good error message is not a fallback** — the atlas is, and
it exists now: the failure page, the desktop gate and a `<noscript>` block all link to
`atlas.html`, and the copy check asserts all three of those links rather than trusting them.

**Not yet:** the **unroll** (orbital↔atlas, Law 03's second verb) is completely unbuilt, and
the spike already failed once here — a hard cut between projections read as a glitch. It is
the film's largest remaining technical unknown. It belongs to beat 12 and should get its own
slice, not be improvised inside another beat.

**The type system now exists** — three voices, three placement laws, in the head of
`slice/index.html`. One law had to be rewritten during the build: *no scrims anywhere* does
not survive a low-angle shot where the ground fills the frame. It now reads **no plate, no
box, no blur behind a word — but the frame may be graded.** A graduated filter that is
present only while a sentence is standing in it is photography; a scrim is a caption.

**Open (2, none blocking):** vegetation dataset still unnamed — it has now cost a written
frame, not just a future one: beat 05's Earth slot promised "Arabia's green phase closing behind
them" and the beat ships without it, because it will not draw what it cannot source. Third beat
affected, after 02 and 12. And no temperature before 60 ka (low priority).

**The Law 06 question is closed** — the law widened, the eruption stays, and the decision is
written up in `timeline.json → resolved/oq-law06`, in law 06 above, and in the storyboard.

**Deferred by the director:** image rights for the ground register. The slice ships an
**original drawn hand stencil, labelled as a diagram on screen**, and holds a dashed
reserved plate for Leang Karampuang carrying *permission pending*. **Denisova 11 is now in the
same position** — present in beat 07's record voice, present tense, with no image.

**Parked for the director's eye: the pale light on the limb.** `EMBER.renderAt(0.2870)` —
with `?still=1` — is the frame where the second light first appears at the top of beat 05's
locked shot. It is the only place in the film the pale field is seen edge-on, and at that
grazing angle the patches read as a glow along the horizon rather than as discrete lights.
That may be exactly right for *a second, paler light is already waiting in the north*, and it
may be too atmospheric for Law 08. **Not decided. Look at the frame before changing anything.**

**Deferred with a reason, not for time: beat 07's Denny ground cut.** Beat 06's match cut ends
at `t 0.3930` and a second one would land about four seconds later. Two match cuts that close
together stop being the film's rarest move and start being a tic — which is the storyboard's own
argument for why beat 07 gets no second hold. Law 04 is still honoured: Denny is exhibited in
type, present tense, and the frame says she predates the beat by fifty thousand years. The Sulawesi and
Madjedbebe material sits with Indigenous custodians whose permission is both a courtesy and
often a legal requirement. Lead time, not launch time — the layout carries the hole rather
than hiding it.

---

## How this project has actually gone wrong

Every serious error so far was the same kind: **a sentence claiming more than the data behind
it.** The thesis said *everyone* where the data said *non-Africans*. A frame emptied a
continent where the note said not to. The shelf was drawn as a fill where the physics is an
edge. The data was almost always right; the prose drifted.

**Phase 4 added a fourth, and a nastier one:** the beat's headline number was computed
correctly and measured *the wrong quantity*. Sunda-to-Sahul coastline separation is 994 km;
the claim the storyboard makes is a **bottleneck** — the smallest achievable longest hop over
all island-hopping routes — which is 70 km. Both are real measurements of the real raster.
Only one is the sentence. **Check that the quantity is the claim, not just that the arithmetic
is right.**

**Phase 5 produced that same failure twice more, which settles it as the failure mode to
expect rather than a one-off.** Both were caught before reaching a frame, and only because
something was checking:

- A line read *"between five and nine kilometres"* of water at the southern door. The
  bottleneck at 60 ka is **5.2 / 6.6 / 9.1 km** depending on how small an island you will
  step on — so the strictest reading is 9.1 and the sentence is false. It now reads *under ten
  kilometres, as little as five*, and the copy check asserts that exact bound. **Beat 06's
  70.5 km survives the same scrutiny** — not by luck, but because its claim is a *floor*, and
  raising the island threshold can only raise a bottleneck. A ceiling claim is fragile where a
  floor claim is not; know which one you are making.
- The first Law 06 test compared each channel's step near the eruption against its **average
  rate through the beat** — and failed, on a channel that was moving fast for its own reasons.
  But "the eruption did not touch the world" does not mean *nothing moved quickly*, it means
  **there is no discontinuity**, which is resolution-independent: halve the sample spacing and
  a smooth channel's largest step halves, while a jump does not shrink at all. The rewritten
  test needs no tolerance, no yardstick and nothing to tune. **A test can measure the wrong
  quantity exactly as easily as a sentence can.**

**And a fifth kind, from Phase 5: a check that silently stopped checking.** Beat 06's copy
check searched `document.body` for a degree sign — and the sentence *explaining* the check
contains one, so it passed on its first run and failed against its own output on every run
afterwards. It had shipped that way. **Run every test twice before believing it.**

**That fifth kind then happened again, one phase later, in the code that documents it.** The
atlas added a check that all three fallback roads name `atlas.html` — the gate, the no-script
block, the failure page. It selected *the document's first* no-script element; its own
explanation contained the literal tag; and **the panel renders check explanations with
`innerHTML`**, so run one built a real empty no-script element inside the panel, ahead of the
film's, for run two to find. Pass once, fail forever.

The instance is not the lesson. **A check must be scoped to a surface its own output cannot
enter, and a panel that renders explanations as markup will keep manufacturing this bug.** Both
are fixed at the mechanism: the selector is `body > noscript`, and `copyCheck` escapes angle
brackets in every line and reason before writing them (ampersands left alone — the lines under
test are the film's own copy and carry real entities). This build ran the copy check five times.

**Phase 5 step 2 produced two more of the check-was-wrong kind, and one of the flattened-
quantity kind.** The copy check failed twice on the atlas's new lines and *both times the check
was wrong*: it read `madjedbebe.dispute.alternative` for "the rocks argue for older" and that
field holds the **younger** reading, because it is the objection *to* the rocks; and it asked
`beatAt(t).id === 6` at t 0.3000, where the beat table resolves a shared endpoint downward and
answers *beat 05* at beat 06's own `t0`. That is three builds running in which fixing a failing
check made it say something truer. And the atlas's evidence table nearly printed Liang
Metanduno's **67,800** as a date when it is a **minimum** — the U-series age is on the calcite
*over* the stencil — which beside a point-dated eruption would have read as the same kind of
number. It prints `≥ 67,800 BP` now, read off the event's own `dateNote`, and the build **stops**
if a single-value event says neither *minimum* nor *±*.

**And a sixth kind, found by an outside audit on 2026-09-08, which is the one that should
change how this project checks itself: every check compared the project against the project.**

`block_mean()` downsampled ETOPO with integer block factors and cropped the remainder. 21600 ×
10800 at 60″, into 4096 × 2048: `fh = fw = 5`, crop to `[:10240, :20480]`. That silently threw
away **18.67° of longitude and 9.33° of latitude** while the shader went on mapping the result
across the whole globe — every feature in the global texture pulled sideways by up to 17°,
**1,040 km at Greenwich, 1,730 km at 120°E.** It shipped for a phase.

Nothing caught it, and nothing *could* have: the terrain-RGB encode and decode are exact, so a
round trip agrees with itself perfectly on a displaced grid. The beat tiles are cut from the raw
grid by explicit lon/lat bounds and are correctly registered, so a close orbital shot — which is
nearly all tile — looks right. Only the limb and the blend at a tile's edge come from the global
texture. Every test in the panel passed throughout.

The replacement, `box_resample()`, is an exact area average over the full extent (a running sum
sampled at fractional cell edges, float64). The check that now guards it, `verify_registration()`,
does the thing none of the others do: it compares the global texture against the **tiles** —
a different representation of the same world, built by a different path — and scans trial lon/lat
offsets, requiring the best agreement to sit at zero. On the old raster it reports
`dlon +17.0, dlat −5.0` at Sunda. On the new one, `+0.0, +0.0`.

**The general lesson, and it applies to the copy check as much as to the raster: agreement
between two of the project's own representations is not evidence that either is true.** A check
earns its keep only when the thing it compares against was produced by a path that could have
disagreed.

Four working rules that follow:

- **Data before documents.** Finish the dataset, then update the storyboard. Doing it the
  other way round once meant seven beats needed re-editing the same day.
- **Test the premise before declaring something blocked.** "Lambeck is behind a paywall"
  was true and irrelevant — ICE-6G already contained the answer.
- **Measure the shortcut before taking it.** The overlay calls `project()` about 900 times a
  frame and each call allocates three small arrays, which is real GC pressure and looked like
  the obvious thing to fix. The obvious fix — compute the screen scale once per frame and scale
  each point by its depth ratio, cutting three projections per point to one — was **measured
  against the exact version first and rejected: 23% median error, 50% at p90, 114% worst.** At
  beat 07's grazing angle the `1/depth` model does not capture how longitude foreshortens across
  the frame, and every pale patch would have been visibly the wrong size. The cheap version of a
  correct calculation is usually a different calculation.
- **An exhaustive walk is only exhaustive over the set it walks.** `law06()` reported "all 14
  channels are continuous" while the channel the law was written about sat outside `CHANNELS`,
  because it was computed in a draw call instead of in `stateFor`. A list-driven test hides its
  own omissions: it reads as coverage whatever is in the list.
- **A check must compare against something that could have disagreed.** Encode/decode round
  trips, value assertions against the same JSON that produced the value, and "the film agrees
  with the film" all pass on a wrong world. Ask what independent path the check is measuring
  against; if the answer is "none", it is a regression test, not a verification.
- **A figure must name its referent, and the name should be generated, not typed.** "+30% on
  today, 92–156°E" was three correct numbers with the wrong box beside them. The box now travels
  in the data and `boxLabel()` builds the caption from it — so moving the box breaks the prose
  instead of quietly relabelling it.
- **Ask whether a check can still see what it checks.** Five lines shipped unchecked for a
  phase because they were string literals in a draw call while the check read tables — the same
  shape as the check that passed once and then failed on its own output. When a surface moves,
  the check does not follow it.
- **Build the x-ray before debugging the picture.** Three passes were spent guessing at
  the frost on the waterline. One shader debug view (`d` key) showed in ten seconds that
  the live edge was clean and the *ghost* line was the culprit.
- **When a check fails, ask whether the check or the film is wrong — and be willing to answer
  "the check".** Phase 5's hold test found *two* locked-camera spans and looked like a Law
  violation. It was the test: the second span is beat 06's ground register, where the orbital
  camera is parked because a hand stencil fills the frame. That is not a hold, it is a camera
  nobody is looking through. **A hold is a locked camera *on the world*** — and with the
  definition fixed, the count is one. Two of the three failures in this build were the test
  being wrong, and both times fixing the test made it say something truer than before.
