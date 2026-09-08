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
4. **`storyboard.html`** — open it in a browser. All fourteen beats. It is the
   creative source of truth and only four of those beats are built.

Do not re-derive any of the four. They are long because the reasons are long.

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
| `timeline.json` | Every dated claim: 66 events, 70 sources, coordinates, confidence, disputes, open questions. **Nothing goes on screen that is not in here.** |
| `data/` | The environmental channels and their builders. All acquired. |
| `evidence/` | Things only a picture or a deliberate break can establish. Read its README. |
| `audit/` | An external audit's reproduction scripts, kept because they were written without sight of ours. |
| `spike/` | Phase 3 throwaway. **Do not promote this code.** |

Beats 01–04 and 08–11, 13, 14 do not exist.

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

### 1. The 230 ms decode hitch — measured, not fixed

Two of the three terrain tiles now load *after* the film starts, which took the
blocking set from 36.8 MB to 8.8 MB. The decode of an arriving tile is
scheduled in a `requestIdleCallback`, and on a Slow-4G reload the director
measured a **230 ms worst frame**.

**Do not fix this by chunking the pixel loop.** That was the obvious move and it
is wrong: the loop was benchmarked on the target CPU at **54 ms of the 230**.
The rest is the canvas readback (`getImageData` of 48 MB), the GPU upload and
the mipmap. **Instrument all four phases onto the panel first**, then ask the
director for one Slow-4G reload, then fix what is actually large.

Free and unrelated: **lossless WebP is 25% smaller than these PNGs and
byte-exact** — measured on all four rasters, round trip verified identical.
Terrain-RGB encodes elevation in pixel values, so lossy would silently move
coastlines; lossless will not. That takes the blocking set to 6.7 MB.

### 2. The audit's historical framing — findings 1, 3 and 6

**This is the highest-stakes item and it is deliberately untouched.** An
external audit reads Bird 2018 and Kealy 2017 as concluding *purposeful,
informed voyaging with intervisibility on the northern routes*. If that holds,
beat 06's film voice — *"They could not see it. They went anyway."* — is
factually wrong **and** condescending about the people it describes. It is the
most prominent sentence in everything built: once in the film, once in the
atlas, and **the copy check currently approves it**.

The previous handoff says do not act on the audit's reading without reading the
papers. The URLs are in `audit/AUDIT-EVIDENCE.md`. Read them, then either
defend the line or change it. The proposed replacement is *"The sea never
closed. They crossed it."*

Finding 1 is adjacent and its structural half needs no citation: the film claims
neutrality on Sahul chronology while the *picture* adjudicates — the ember rides
the 50–43 ka genetic window and the atlas labels landfall 45,450 BP, with the
older reading demoted to a rail annotation.

### 3. Two stale figures the last session created

Both are one-line fixes and both are in `storyboard.html`:

- Law 03's card says **2 of 6** centres are visible from an Africa-centred
  globe. It is now **1 of 6**, because the Sahel moved to beat 13. The gap got
  *wider*, so the argument is stronger, but the number is stale. `sixTest`
  prints the correct figure.
- Beat 12's frame lists **"the Sahel"** among its six lights. The data puts West
  African domestication at ~4,900 BP against a beat that closes at 5,000. See
  `timeline.json → openQuestions → oq-beat12-sahel`, which lays out three ways
  out and says it is the director's call.

### 4. The unroll's remaining work

The transition is solved and joined to the film's camera. What is left:

- **Beat 11 does not exist**, so the unroll's entry keyframe is a placeholder —
  a wide globe on the Fertile Crescent, which is the light beat 11 ends on. When
  beat 11 is built, its last keyframe replaces row 0 of `KEYS` and `joinTest`
  keeps the two cameras identical at k = 0.
- **The unroll has no `t` in the film's timeline.** It runs on its own 0→1. It
  needs to become a window of the film's deep-time `t` like beats 05–07.
- No atlas fallback, no accessibility work, no copy check beyond `recordTest`.
  It is a slice.

### 5. Then the unbuilt beats

Beats 01–04, 08–11, 13 and 14. The storyboard specifies all of them. Two known
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
