# Handoff — 2026-09-08

`CLAUDE.md` is loaded automatically and carries the thesis, the eight laws, the
architecture and the standing traps. **This file is the delta**: what changed on
7–8 September, what an outside audit found, what is fixed, and what is open. Read
`CLAUDE.md` first; read this second; do not re-derive either.

---

## Status in one line

Phase 5 is complete — beats 05/06/07 on one `t`, plus the beat 06 static atlas —
and **expansion of the slice is paused** by the director's decision, pending
remediation of an external audit. Do not build beats 08–14 or extend the atlas
until the open items below are closed or explicitly waived.

Repo: `github.com/vineet1997/ember`, branch `main`. The remediation is three
commits: `c9501c6`, `bcb3537`, `bcb92a5`.

---

## What happened

**7 Sep — the atlas.** Beat 06 as a static artifact: eight stills baked from the
film's own shader, every word live HTML. `slice/atlas.html`, built by
`python slice/build_atlas.py`. It is the mobile experience, the reduced-motion
fallback, the no-JS fallback, the crawler content, and the answer for a browser
with WebGL off.

**8 Sep — an external audit** (GPT 6-Astra), commissioned deliberately for a
different perspective. It was good. Every technical claim I could check locally
held. Its evidence, reproduction scripts and — importantly — **the literature
URLs behind findings 1 and 3** are preserved in `audit/AUDIT-EVIDENCE.md`.

> They were originally written into `.playwright-mcp/`, which is gitignored.
> They are copied into `audit/` and committed. The audit's screenshots are still
> only in `.playwright-mcp/` and will not survive a clone.

**8 Sep — three findings fixed.** Commits `c9501c6`, `bcb3537`, `bcb92a5`.

---

## The audit's central thesis, which matters more than any single finding

> The project treats agreement between its own representations as evidence that
> the representation is true.

This is correct and it explains every defect found. The copy check asserted
`23.75 === 23.75` — the film agreeing with the film. The terrain-RGB round trip
agreed with itself perfectly on a grid that was missing 18.67° of longitude. The
Law 06 channel walk reported "all 14 channels continuous" over a list that
omitted the only channel the law was about.

**The working rule that follows, now in `CLAUDE.md`: a check earns its keep only
when the thing it compares against was produced by a path that could have
disagreed.** Apply this to anything you add. If the answer to "what independent
path is this measured against?" is "none", you have written a regression test,
not a verification.

---

## Closed

### Raster registration — `c9501c6`

`block_mean()` downsampled ETOPO with integer block factors and cropped the
remainder: 21600 × 10800 → `fh = fw = 5` → kept `[:10240, :20480]`. It discarded
**18.67° of longitude and 9.33° of latitude** while the shader mapped the result
across the whole globe. Displacement up to **1,730 km at 120°E**. Shipped for a
phase.

Replaced with `box_resample()` — exact area average over the full extent, a
running sum sampled at fractional cell edges, float64. `verify_registration()`
now runs at the end of every `build_rasters.py`: it compares the global texture
against **the beat tiles**, which are cut from the raw grid by explicit lon/lat
bounds and never resampled, and scans trial offsets requiring best agreement at
zero.

| | dlon | dlat |
|---|---|---|
| old raster, Sunda | **+17.0°** | −5.0° |
| new raster, all three tiles | **+0.0°** | **+0.0°** |

**Two documented figures moved** because they were measured on the displaced
grid: land above 0 m **28.5% → 28.8%**, above −130 m **34.0% → 34.4%**. Beat
measurements are unaffected — those builders read the raw grid directly.

### Figures checked against referents — `bcb3537`

Three defects, all invisible to a check that compares values to themselves:

1. **Wrong box.** `landFracBox` is measured over the *connectivity* box
   90–160°E 50°S–30°N; the film labelled it with the *render tile's* bounds,
   92–156°E.
2. **Wrong baseline.** The atlas said dry land grows 23.75% → 30.88% "across
   the beat". 23.75% is **today**. Across the beat it is 30.44% → 30.88%,
   about 1.4% — the shelf was already out when beat 06 opened.
3. **Wrong origin.** "The sea falls a hundred and thirty-one metres from here to
   the lowstand" — 131 m is the lowstand below the *present*; the frame is
   already 74 m down. Further fall: **57 m**.

The box now travels with the measurement in `film.json → measured.landBox`, and
`boxLabel()` **generates** the on-screen label from it. Mutation-tested:
restoring any of the three sentences fails, and pointing `landBox` at the render
tile fails while every value stays intact.

### law06 watches the sky — `bcb92a5`

`CHANNELS` omitted `temp`, which drives `uChill` — the sky and limb tint. It
*could not* have been in the list: `chill` was computed inside `drawEarth`, so it
was never state, never in the hash. The test that exists to prove the eruption
does not grey the sky was not watching the greying.

`chill` is state now; `CHANNELS` carries `temp` and `chill`. A step injected at
39,850 BP fails both channels the right way (`4.54e0 → 4.57e0` instead of
halving); the same step 550 years away passes.

**The law also stopped overclaiming.** It said `law06()` "proves" non-influence.
It does not — continuity is not independence, and the audit demonstrated it by
injecting a *smooth* sea-level depression that passes.

---

## Open, in my recommended order

### 1. Access (audit finding 5) — the largest reader-facing problem

- **36.8 MB of terrain PNGs block `start()`.** ~29 s at 10 Mbps, ~5 min at
  1 Mbps. Load the current tile first, prepare the rest ahead of need.
- **Stale copy sits in the accessibility tree.** `drawCopy` guards `innerHTML`
  with `if (ar >= 0)`; on exit only the `.on` class toggles, which is
  opacity-only. At `t = 0.31`, arriving from 0.28 vs 0.345 leaves *different*
  invisible paragraphs exposed to a screen reader — while the state hash is
  identical. Law 01 holds for state and not for what a reader receives.
- **Reduced motion is checked only at startup.** Enabling it later, or resizing
  to phone width, leaves the film running with no escape.
- **No visible atlas link on the film**, and no keyboard-reachable navigation.
- **A load failure is overwritten.** `step()` writes `lmsg.textContent`, so a
  later successful tile erases the error a failed one wrote.
- **`--ice-dim #5F7794` on `#04060A` is 4.40:1** — below AA for small text, and
  it is every instrumentation surface in both artifacts.

### 2. law06 independence (audit finding 4, structural half)

~20 lines, and the fix that would earn the word "proves": strip the eruption's
marker, rail horizon and record from the data, and assert every world channel is
bit-identical at every `t`. Unlike continuity, it compares against a
configuration that could have disagreed.

Also worth doing while there: the other four tests' panel text overstates what
they certify. Rename them regression checks and state their boundaries.

### 3. Historical framing (findings 1, 3, 6) — needs the papers open

**Do not act on the audit's reading of the literature without reading it.** I
did not verify these; the URLs are in `audit/AUDIT-EVIDENCE.md`.

- **Finding 1** — the film claims neutrality on Sahul chronology while the
  *picture* adjudicates: the ember rides the 50–43 ka genetic window and the
  atlas labels landfall 45,450 BP, with the older reading demoted to a rail
  annotation. The copy check literally approves this ("the ember rides the
  genetic window"). The structural half of this needs no citation and is fair.
  Gandini et al. 2025 (mtDNA, ~60 ka) would also mean genetics does not have the
  single answer the film assigns it.
- **Finding 3** — *"They could not see it. They went anyway."* The audit reads
  Bird 2018 as concluding purposeful, informed voyaging and Kealy 2017 as
  supporting intervisibility on northern routes. If that holds, the line is an
  overclaim and mischaracterises the people. Proposed replacement: *"The sea
  never closed. They crossed it."*
- **Finding 6** — judgment calls on script and voice, plus a substantive point
  on the narrator's position: Mirarr people are research participants and
  continuing custodians, not an approval step. Also three script corrections
  (Omo minimum age, beat 12 "no contact", beat 14 quantitative claims).

---

## Traps that cost time on 7–8 September

- **Bash heredocs mangle backslashes here.** `\\.` arrives as `\.`, and
  `·` does not survive. Write patch scripts with the Write tool and run
  them; do not inline Python containing escapes into a heredoc.
- **Patch scripts must assert `count == 1` before replacing, and write only at
  the end.** A mid-script assertion failure then leaves the file untouched. This
  saved a corrupted `film.js` twice.
- **Preserve line endings.** The repo is mixed: `film.js`/`serve.py` are LF,
  `index.html`/`CLAUDE.md`/`storyboard.html` are CRLF. Read binary, detect,
  write back matching. (`core.autocrlf` is `true`, so a fresh clone checks out
  CRLF regardless — harmless, but the working tree will not be byte-identical.)
- **The in-app browser pane cannot render this project at all** — not the WebGL
  film, and not even the plain-HTML atlas (it times out). Use Playwright for
  anything you need to *look* at; use `EMBER.*` via evaluate returning small
  JSON for anything you need to *know*.
- **A lazy `<img>` screenshots as pure black.** Force `loading='eager'`,
  reassign `src`, `await img.decode()`, then shoot. Two passes were lost to this.
- **A bake is ~8–12 minutes** on SwiftShader. It re-runs the five tests and
  refuses to write if any fails, which is correct and has caught a real failure.
- **Run every test at least twice; five is better.** Two checks in this project
  have passed once and failed forever after. The second one was mine, one build
  after writing the lesson into the laws: the panel rendered check prose as
  `innerHTML`, so a check whose explanation named `<noscript>` *created* one for
  the next run to find. `copyCheck` now escapes angle brackets, and page queries
  are scoped (`body > noscript`).

---

## Commands

```bash
python slice/serve.py            # dev server, no-cache headers. Never a caching one.
python slice/build_atlas.py      # bake + write atlas.html (~10 min)
python slice/build_atlas.py --no-bake   # re-lay-out from the existing sidecar (seconds)
python data/build_rasters.py     # rebuild terrain; ends with verify_registration()
```

Full rebuild chain is in `CLAUDE.md`. `data/raw/` (496 MB) is gitignored and
**is present on this machine** — the rebuild above depends on it.

In the film: `i` = director's panel (five tests), `d` = shader x-ray,
`#t=0.3350` / `#beat=06` to jump, `?still=1` kills copy transitions,
`?nogl=1` forces the WebGL failure path.

---

## The verification harness

`slice/tools/` — promoted out of the session scratchpad, where it would have
died. Three scattered scripts consolidated into one CLI over a shared Playwright
boot, because each had re-implemented the server and the browser setup.

```bash
python slice/tools/check.py verify           # is the film sound; non-zero exit if not
python slice/tools/check.py probe -e "EMBER.stateFor(0.335).sea"
python slice/tools/check.py probe q.js       # any JS expression, JSON back
python slice/tools/check.py shoot film -t 0.4040
python slice/tools/check.py shoot atlas -w 390 -s "#s04"
```

**`verify` is the one to run.** It runs the five panel tests twice, then checks
four things the panel cannot see because they are not functions of `t`:

- the film still letters its own frames, and a bake does not leave the annotation
  sink armed (measures ink where the margin labels are);
- all three fallback roads reach the atlas — gate, WebGL failure page, phone width;
- the atlas is intact with JavaScript off: no script tags, and the voice, captions,
  labels, ground register, dimension figure and citations all present;
- the film voice appears exactly **once**.

Mutation-tested when promoted: adding a `<script>` to the atlas and duplicating
the film voice both fail it, with exit 1. The harness's own docstring carries the
four facts that shape it — never wait on the render loop, the in-app pane cannot
render this project at all, headless is SwiftShader so no timing number from it
means anything, and a lazy `<img>` screenshots as pure black.

`audit/` holds the auditor's independent equivalents, which were written without
sight of these and are worth reading for a second opinion on method.

---

## Parked for the director, unchanged

- **The pale light on the limb.** `EMBER.renderAt(0.2870)` with `?still=1`. Now
  visible at a second altitude too — at `t 0.4040` the pale field reads as
  concentric arcs, which looks more like an artifact than atmosphere. Still
  undecided; look at the frame before changing anything.
- **Image rights** for Leang Karampuang and Denisova 11. Lead time, not launch
  time. The layouts carry the holes rather than hiding them.
- **Vegetation dataset** still unnamed; has now cost a written frame in beats
  02, 05 and 12.
