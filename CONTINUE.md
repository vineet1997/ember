# Continuing One Ember

You are picking up a project that is most of the way through a long build.
This file is the front door. It tells you what exists, how to run it, how to
know whether you have broken it, what to do next, and — most importantly — how
this project fails, because it fails the same way every time.

Read in this order:

1. **This file**, end to end. Fifteen minutes.
2. **`CLAUDE.md`** — the thesis, the eight laws, the architecture, the standing
   traps. It is loaded into your context automatically. It is the constitution.
3. **`HANDOFF.md`** — the delta from the last two sessions. Recent, specific,
   and it expires; `CLAUDE.md` does not.
4. **`PROJECT_PLAN.md`** — the completion roadmap. It records the next
   authorised phase, its acceptance check, and intentionally unresolved work.
5. **`storyboard.html`** — open it in a browser. All fourteen beats. It is the
   creative source of truth, and all fourteen beats now have implementations.

Do not re-derive any of the five. They are long because the reasons are long.

---

## What the thing is

A scroll-driven film of the peopling of the world, 300,000 BP to the present,
in fourteen beats. Desktop is the film; mobile, reduced motion, no-JS and
no-WebGL all get a **static atlas** of the same material.

**Thesis:** every one of us is African; one line that left did not stop, and its
descendants now live everywhere else.

The renderer is **a fragment shader over an elevation raster**. There is no
coastline geometry anywhere in the project — one raster, one float, one
comparison, and every shoreline falls out of it, including ones that have been
under water for twelve thousand years. Keep it that way; several design
decisions exist only to preserve it.

---

## What is built, and where

| | |
|---|---|
| `slice/` | **Beats 05, 06, 07 at final quality**, on one continuous `t`. The hold, the crossing to Sahul, the others. Six panel tests. This code *is* the film. |
| `slice/atlas.html` | Beat 06 as a static artifact. Eight stills baked from the film's own shader; every word live HTML. **Generated — edit `film.js` and rebuild.** |
| `unroll/` | **Beat 12's transition**, Law 03's second verb: orbital → atlas as one continuous surface. Six tests. Phase 6. |
| `flow/` | **The 08–12 integration shell.** It owns the project’s global deep-time `t` (0.4400–0.8500), derives every local beat time from `timeline.json`, and keeps one scene renderer active at a time. |
| `timeline.json` | Every dated claim: 66 events, 70 sources, coordinates, confidence, disputes, open questions. **Nothing goes on screen that is not in here.** |
| `data/` | The environmental channels and their builders. All acquired. |
| `evidence/` | Things only a picture or a deliberate break can establish. Read its README. |
| `audit/` | An external audit's reproduction scripts, kept because they were written without sight of ours. |
| `spike/` | Phase 3 throwaway. **Do not promote this code.** |

All fourteen beats are built. The master film at `film/index.html` is their
current integration surface; `flow/index.html` retains the separately useful
08–12 time-ownership shell, and the scene pages remain directed-work and
individual-contract surfaces.

## Entry points and checks

Run `python serve.py` from the repository root for an uncached server at
<http://127.0.0.1:8899/>. This is the root expected by the browser contracts;
do not substitute a caching server while developing a renderer.

| Beat(s) | Entry point | Contract |
|---|---|---|
| 01–04 | `origins/index.html` | `origins/check.py` |
| 05–07 | `slice/index.html` | `slice/tools/check.py verify` |
| 08 | `shrink/index.html` | `shrink/check.py` |
| 09 | `steppe/index.html` | `steppe/check.py` |
| 10 | `sweep/index.html` | `sweep/check.py` |
| 11 | `doors/index.html` | `doors/check.py` |
| 12 | `unroll/index.html` | `unroll/shoot.py` |
| 08–12 | `flow/index.html` | `flow/check.py`, `transitions/check.py` |
| 13 | `ocean/index.html` | `ocean/check.py` |
| 14 | `epilogue/index.html` | `epilogue/check.py` |
| 01–14 | `film/index.html` | `film/check.py` |

The editorial sources are `story/` (`check_direction.py`,
`check_narration.py`). `timeline.json` is the dated-claim record. The
evidence-preserving raster inputs, generated fields and builders live in
`data/` and `slice/data/`; see `ASSET_CONTRACT.md` for their delivery status.

### Phase 0 baseline record

- Repository-root checks passed once on 2026-09-10: both story contracts; all
  fourteen scene contracts; the 08–12 transition contract; and the master-film
  contract. The unroll verifier passed its six tests twice, and the slice
  terrain verifier passed its six panel checks twice plus raster-failure,
  fallback, reader and atlas checks. Those two are run separately because their
  software-rendered visual work is substantially heavier.
- Current evidence-grade terrain fields are global 2048×1024 plus Red Sea
  2040×1920, Sunda/Wallacea 3840×3120 and Europe/west Asia 4320×1860. Their
  current PNGs total 36,729,566 bytes; global + Red Sea are 8,887,064 bytes
  (8.48 MiB).
- The target observation was Chrome DevTools **Slow 4G** (1.44 Mbps). At that
  shaping rate, the global + Red Sea PNG pair has a 49.4-second transfer-only
  lower bound. The deferred-tile GPU preparation measured about **186 ms** on
  the target machine; network delivery, not conversion, is the current
  first-visit risk. Automated SwiftShader runs establish correctness only and
  are not timing evidence.

---

## Run it

```bash
python slice/serve.py
```
The film, on <http://localhost:8123/index.html>. Never use a caching static
server: it will hand you yesterday's shader and you will debug code that is not
running.

```bash
python unroll/serve.py
```
The unroll, on <http://localhost:8124/unroll/>. Drag the scrub bar.

In either: **`i`** opens the director's panel (the tests, the state readout,
the measured figures), **`d`** cycles the debug views. `#t=0.3350` and
`#beat=06` jump in the film; `#k=0.15` jumps in the unroll.

---

## Know whether you have broken it

```bash
python slice/tools/check.py verify      # the film. ~10 min. Non-zero exit on failure.
python unroll/shoot.py                  # the unroll. Six tests twice, plus a frame ladder.
```

`verify` runs the film's six panel tests **twice** and then seven things a panel
cannot see. Run it before you believe the film is sound, and run it again after
you change anything.

Other useful handles:

```bash
python slice/tools/check.py probe -e "EMBER.stateFor(0.335).sea"
python slice/tools/check.py shoot film -t 0.4040
python evidence/mutate_law06.py         # makes the film wrong and requires the panel to notice
```

**`window.EMBER.renderAt(t)`** draws one frame synchronously and returns its
state. It is the single most useful handle in the project, and it exists
because every automated browser throttles `requestAnimationFrame` to
uselessness. `window.UNROLL` is the equivalent in the unroll slice.

---

## How this project fails

Read this section twice. Every serious defect in eighteen months has been one
of five shapes, and you will produce at least one of them.

### 1. A sentence claiming more than the data behind it

The thesis said *everyone* where the data said *non-Africans*. A frame emptied a
continent where the note said not to. The prose drifts; the data is almost
always right.

### 2. Measuring the right thing correctly and the wrong thing entirely

The headline number for beat 06 was computed perfectly and measured coastline
separation when the claim was a **bottleneck** — 994 km against 70 km. Both are
real measurements of the real raster; only one is the sentence.

This is the most common failure in the project and it recurs in *tests* as
often as in prose. In the last two sessions alone: a Law 06 test compared a
step against an average rate when the claim was about a discontinuity; a
resolvability gate took the **max** of two foreshortening directions when an
ill-conditioned inverse is the **min**; a date check required a range to
*overlap* a beat when the claim is a *floor*; and `sixTest` asserted a number
when Law 03's claim is a *gap*.

**Ask, every time: is the quantity I am measuring the claim I am making?** And
know whether you are making a floor claim or a ceiling claim — a floor survives
scrutiny that a ceiling does not.

### 3. A check that compares the project against itself

The copy check asserted `23.75 === 23.75`. The terrain round trip agreed with
itself perfectly on a grid missing 18.67° of longitude. **Agreement between two
of your own representations is not evidence that either is true.**

Ask what independent path a check measures against. If the answer is "none", it
is a regression test, not a verification.

### 4. A check that silently stops checking

Two checks in this project passed on their first run and failed on every run
afterwards, because each polluted the surface the next run inspected. One of
them shipped that way.

**Run every test at least twice. Five is better.** `verify` and `shoot.py` both
do this for you. A check must be scoped to a surface its own output cannot
enter.

### 5. A surface the check cannot see

Five on-screen lines shipped unchecked for a phase because they were string
literals in a draw call while the check read tables. The unroll's first version
carried its six places in a literal array and invented an unsourced Fertile
Crescent that was already in the record. **When a surface moves, the check does
not follow it.**

### And the corollary that matters most

**When a check fails, ask whether the check or the film is wrong — and be
willing to answer "the check".** In the last three sessions, *seven* failing
checks were the check being wrong, and every time fixing the check made it say
something truer than before. A green suite you did not interrogate is worth
less than a red one you did.

---

## Traps that have cost real hours

- **Never time this film from an automated browser.** rAF is throttled to
  between zero and four ticks a second and `performance.now()` is quantised.
  Put a readout on screen and ask the director to look. Headless Chromium
  renders every frame *correctly* on SwiftShader at about a minute a frame, and
  no timing number from it means anything.
- **The in-app browser pane cannot render this project at all** — not the WebGL
  film and not even the plain-HTML atlas. Use Playwright for anything you need
  to *look* at, and `probe` returning small JSON for anything you need to *know*.
- **Bash heredocs mangle backslashes here.** `\\.` arrives as `\.` and a
  trailing `\` becomes a line continuation. Write patch scripts with the Write
  tool and run them. This bit twice in one session even while the warning was on
  screen.
- **Patch scripts must assert `count == 1` and write only at the end**, so a
  failed assertion leaves the file untouched. This has saved `film.js` three
  times.
- **A mutation harness must restore what it FOUND, not what git last
  remembered.** One `git checkout --` deleted an afternoon of uncommitted work.
  Take a byte copy first and assert restoration.
- **Preserve line endings.** The repo is mixed. Read binary, detect, write back
  matching. `core.autocrlf` is true, so `git checkout` returns a file as CRLF
  even if it was LF.
- **A lazy `<img>` screenshots as pure black.** Force `loading="eager"`,
  reassign `src`, `await img.decode()`.
- **A viewport under 1280×800 trips the desktop gate**, so the film's boot code
  never runs at all. Any Playwright session that needs the film to *start* must
  be at least that.

---

## What to do next

In the order the last session would have done them.

### 1. The 230 ms decode hitch — instrumented, not fixed

Two of the three terrain tiles now load *after* the film starts, which took the
blocking set from 36.8 MB to 8.8 MB. The decode of an arriving tile is
scheduled in a `requestIdleCallback`, and on a Slow-4G reload the director
measured a **230 ms worst frame**.

**Do not fix this by chunking the pixel loop.** That was the obvious move and it
is wrong: the loop was benchmarked on the target CPU at **54 ms of the 230**.
The panel now splits a deferred tile into canvas image decode, canvas readback
(`getImageData` of 48 MB), Terrain-RGB conversion, texture-upload call,
mipmap-generation call and total. The boundaries are stated in the panel so a
CPU call time is never passed off as hidden GPU completion.

The instrument was exercised in software rendering only; that confirmed that
every phase reaches the panel and said nothing about the target machine. **Ask
the director for one visible-window Slow-4G reload, read the new rows beside the
worst-frame line, then fix what is actually large.**

Free and unrelated: **lossless WebP is 25% smaller than these PNGs and
byte-exact** — measured on all four rasters, round trip verified identical.
Terrain-RGB encodes elevation in pixel values, so lossy would silently move
coastlines; lossless will not. That takes the blocking set to 6.7 MB.

### 2. The audit's historical framing — copy corrected; chronology picture open

Bird 2018 was checked against its accepted manuscript: it models a purposeful,
coordinated Timor–Roti crossing and finds Sahul Banks islands visible from some
high points. Kealy 2017's abstract finds northern-route intervisibility most
parsimonious. Neither source licenses a universal claim that the destination was
unseen. The film, atlas, record and copy check now say: *"The sea never closed.
They crossed it."* The check requires both sources and rejects the old claim.

Finding 1 is adjacent and its structural half needs no citation: the film claims
neutrality on Sahul chronology while the *picture* adjudicates — the ember rides
the 50–43 ka genetic window and the atlas labels landfall 45,450 BP, with the
older reading demoted to a rail annotation. **That is still a director decision:**
the corrected voyage line must not be mistaken for a resolution of the chronology
picture.

### 3. Two stale figures corrected

- Law 03 now says **1 of 6** centres are visible from an Africa-centred globe.
  `sixTest` re-derives that figure.
- The Sahel has been removed from Beat 12's frame and its question moved to
  `timeline.json → resolved → oq-beat12-sahel`; pearl millet remains in Beat 13.

### 4. Beats 08–11 and the unroll

**Beat 08 now exists** at `shrink/index.html`. It pulls back across the northern
hemisphere, tracks the sourced sea-level fall from −90.3 m to −128.9 m, and
draws the Sungir → Yana northward trace from `timeline.json`. The renderer
explicitly disables its ICE-6G field for the whole 39–26.5 ka span: the local
atlas begins at 26 ka, so it must not be misrepresented as an earlier animated
ice sheet. That absence is visible in both the frame and panel, and
`shrink/check.py` asserts it.

**The 08→11 flow now has a transition contract** in `transitions/check.py`.
Every handoff keeps its boundary year and sea level; 08→09 also keeps all five
camera values exactly, while 09→10 and 10→11 are named deliberate hard cuts.
The first real ICE-6G field fades in only after the 26 ka boundary inside Beat
09, rather than appearing at 26.5 ka. Run it against a repo-root static server
with `python transitions/check.py`.

**Beat timing is now data-derived where the sequence makes an occurrence
visible.** Beat 08 reads Sungir&rsquo;s 34 ka point and Yana&rsquo;s 33&ndash;31 ka range
from its generated events; Beat 10 holds White Sands through 21 ka, keeps the
record uncertain until 16 ka, and starts the continental sweep only then.
Beat 11 now follows the same rule for the Younger Dryas, Beringia&rsquo;s inundation,
Doggerland&rsquo;s final flooding, and the Fertile Crescent&rsquo;s appearance.

**Beat 09 now exists** at `steppe/index.html`. It holds the Beringian ember on
the exposed, cold-but-unglaciated landmass; its small blue herds are causal
steppe life rather than decorative fauna. `steppe/build_steppe.py` and
`steppe/check.py` use the same record and browser contract as the next scenes.

**Beat 10 now exists** at `sweep/index.html`. White Sands holds as a small
ember, then turns uncertain during the record gap without going out; the later
continental sweep draws the coastal route solid and the interior corridor
dashed. `sweep/build_sweep.py` derives its sites, routes, sources, sea level
and ice from the project record; `sweep/check.py` exercises it in Chromium.

**Beat 11 now exists** at `doors/index.html`. It reads the recorded sea-level
curve and ICE-6G atlas, draws the Beringia and Doggerland closures, and fixes
the Fertile Crescent light while the water rises. `doors/build_doors.py` emits
its only final camera tuple; `unroll/unroll.js` fetches that same record before
it starts and `joinTest` fails if its k = 0 camera differs. `doors/check.py`
checks the Beat 11 state and the shared tuple in Chromium.

**The 08→12 integration shell now exists** at `flow/index.html`. Its generated
`flow/data/run08-12.json` derives the global windows from the project’s
`scrollWeight`s: Beat 08 is `.4400–.5400`, 09 `.5400–.6100`, 10
`.6100–.6800`, 11 `.6800–.7800`, and 12 `.7800–.8500`. The shell alone reads
scroll; it sends the owning beat its derived local `t` and explicitly idles the
four hidden WebGL scenes. `flow/check.py` verifies the windows, the final Beat
12 handoff, and forward/backward purity against a repo-root static server.

What is still left:

- The integration shell establishes time ownership, not final transition
  direction. Review its live pacing, seams and copy as one run before changing
  any scene-level choreography.
- No atlas fallback, no accessibility work, no copy check beyond `recordTest`.
  It is a slice.

### 5. Then the unbuilt beats

Beats 01–04, 13 and 14. The storyboard specifies all of them. Two known
blockers: the **vegetation dataset is still unnamed** and has now cost written
frames in beats 02, 05 and 12; and there is **no temperature record before
60 ka** (low priority).

---

## Standing decisions you should not relitigate

- **One artifact, not three.** Beats 05–07 share one `t` because the two places
  the work was most likely to fail are the boundaries between them, and a
  three-artifact build makes exactly those unscrubbable.
- **Do not extend the beat 06 atlas to beats 05 and 07 by adding stills.** Those
  beats are temporal devices and a page cannot spend time. The reasoning is in
  `CLAUDE.md` and the storyboard's `#atlas` section; two alternative ideas are
  named there and neither is prototyped.
- **The unroll is a surface morph, not a cut**, and every intermediate state is
  a sphere so the fragment shader survives it. A mesh would work and would cost
  the film a second earth renderer. Don't.
- **Image rights** for Leang Karampuang and Denisova 11 are deferred with a
  reason. The layouts carry the holes rather than hiding them. This material
  sits with Indigenous custodians whose permission is both a courtesy and often
  a legal requirement.

## Parked for the director — look before changing

- **The pale light on the limb.** `EMBER.renderAt(0.2870)` with `?still=1`, and
  again at `t 0.4040` where it reads as concentric arcs. It may be right and it
  may be too atmospheric for Law 08. Undecided.

---

## Working style this project expects

Write comments that say **why**, including what was tried and failed — most of
the files here carry their own history and it is load-bearing. When you fix
something, fix it at the mechanism rather than at the instance. When a
measurement contradicts the storyboard, the measurement wins and the storyboard
gets edited; **data before documents**. Test the premise before declaring
something blocked. And measure the shortcut before taking it: the cheap version
of a correct calculation is usually a different calculation.
