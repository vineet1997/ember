# One Ember — completion roadmap

**Purpose.** This is the execution plan for completing *One Ember* with an AI
or a human collaborator. It is deliberately a plan, not a claim that every
item is already authorised or solved. Each phase has a concrete outcome and a
check that must pass before the next phase begins.

## Current baseline

- The master film exists at `film/index.html`: fourteen beats, one global
  deep-time `t`, one active visual child at a time.
- All fourteen scenes have been built and have scene-level checks.
- The story direction and draft narration exist in `story/`.
- The Beat 05–07 terrain renderer has measured performance diagnostics and a
  GPU Terrain-RGB conversion route. On the target machine, a deferred tile now
  prepares in about 186 ms instead of about 568 ms; delivery time, not GPU
  conversion, is now the dominant first-visit risk.
- The project is **not release-ready**. The largest unfinished work is delivery,
  whole-film direction, final copy, accessibility, data closure and release
  hardening.

## Non-negotiable principles

1. **The story is persistence and contingency, never destiny.** No copy or
   visual may turn a disputed outcome into inevitability.
2. **The elevation field is evidence, not decoration.** The renderer derives
   moving coastlines, shelf, depth and relief from it. Do not replace it with a
   lossy image or a single present-day coastline.
3. **Nothing historical goes on screen without a record entry and source.**
   `timeline.json` is the source of dated claims and uncertainty.
4. **A fast scroll must never produce a blank world or a false coastline.** A
   lower-detail elevation field is acceptable only when verified for the scale
   at which it is shown.
5. **The atlas/transcript is a product, not an apology.** Reduced motion,
   mobile, no-JavaScript and WebGL failure must reach a complete readable form.
6. **Do not guess external permissions or historical adjudications.** Mark them
   as decisions or blockers and preserve the intentional placeholder.
7. **Commit each coherent phase separately.** Do not include unrelated user
   edits in an implementation commit.

## Working protocol for each phase

1. Read this plan, `CONTINUE.md`, `CLAUDE.md`, and the relevant scene/build
   files before making changes. Treat `CONTINUE.md` as potentially stale until
   Phase 0 is complete.
2. State the phase goal and its acceptance criteria before editing.
3. Preserve existing data and unrelated worktree changes.
4. Run the smallest relevant automated checks, then a visual check where the
   task changes a visual experience.
5. If a defect blocks the next phase, repair it in the current phase. If it
   does not block the next phase, record it under “Deferred observations” in
   this document or `CONTINUE.md` instead of expanding scope.
6. Finish with evidence: changed files, checks run, real-device observations,
   known limitations, and a focused commit.

---

## Phase 0 — reconcile the handoff and freeze the baseline

**Goal:** Make the project legible to the next collaborator.

### Work

- Update `CONTINUE.md` so it no longer says Beats 01–04, 13 and 14 are unbuilt.
- Link this roadmap from the handoff document.
- List the actual entry points: `film/`, each scene directory, `story/`,
  `timeline.json`, and the existing check scripts.
- Record current terrain sizes, the observed target-machine timings, and the
  fact that the target test was Chrome DevTools Slow 4G.
- Run the story checks, scene checks, and master-film check once against a
  repository-root static server. Fix only baseline failures.

### Done when

- A new collaborator can identify what is built, what is intentionally
  unresolved, and how to run the film and checks without reading git history.
- The written status and the actual source tree agree.

---

## Phase 1 — establish the delivery budget and asset contract

**Goal:** Replace vague “slow loading” with numerical product constraints.

### Work

- Create an asset manifest covering every initial, medium and full-resolution
  terrain field: dimensions, bytes, geographic extent, precision, source and
  intended scene window.
- Record the present baseline: global + Red Sea are 8.48 MiB as PNG, a roughly
  49-second transfer-only lower bound at Chrome DevTools Slow 4G (1.44 Mbps).
- Set explicit experience budgets before changing the loader. Proposed starting
  targets:
  - first meaningful world visible in 3 seconds or less;
  - first narrated scene usable in 8 seconds or less;
  - no required scene held at fallback resolution once the reader has spent
    5 seconds in its main close view;
  - no false/duplicate coast during refinement.
- Benchmark candidates with byte-for-byte or scene-scale verification:
  lossless WebP, existing PNG, and compact elevation-specific candidates only
  if they can preserve the required measurement.
- Confirm browser support and fallback behaviour for any selected format.

### Done when

- There is one written asset contract and measurable budgets.
- Lossless WebP’s already-observed 25% saving is either reproduced and adopted
  as a baseline, or rejected with a recorded reason.

---

## Phase 2 — build an evidence-preserving terrain pyramid

**Goal:** Deliver broad geography first, then sharpen only where the film needs
it.

### Work

- Generate a small global overview and two or more precomputed levels for each
  story corridor: Red Sea, Sunda/Wallacea, and Europe/west Asia.
- Prefer a small number of whole corridor levels over a generic slippy-map
  system. The camera path is known; complexity should serve the film, not a
  hypothetical free-pan map.
- Derive every lower level from the original elevation grid, not from a rendered
  screenshot.
- Define the level selection in screen terms: use a lower level only when its
  coastline disagreement is below a pixel at that camera pose.
- Add automated validation at the sea levels and visual claims the film makes:
  land connectivity, Wallacea bottleneck, Red Sea doors, shelf extent, and
  coastline/relief comparisons at representative camera frames.

### Done when

- Every level has an auditable source, precision statement and test result.
- A lower level cannot silently change a claim the film makes at the scale it
  is allowed to appear.

---

## Phase 3 — progressive and adaptive terrain delivery

**Goal:** Make slow-network loading feel like the world resolving, not the
viewer waiting for maps.

### Work

- Start with the lightweight global overview; do not block the whole film on
  the present global + full Red Sea pair.
- Request the current beat’s minimum usable level first, then the next beat’s
  minimum usable level, then high-resolution refinements.
- Decouple network fetch from GPU preparation: a conversion queue must not
  prevent the next small, necessary asset from beginning its download.
- On a large scroll jump, reprioritise toward the newly needed corridor and
  cancel or demote stale high-resolution work where safe.
- Keep the current global elevation fallback while a field is absent.
- Refine only at a pose where the switch cannot reveal two competing coastlines.
- Add a reader-facing, non-technical loading state only if the overview itself
  is unavailable. Do not expose developer timing terminology in the release UI.

### Done when

- A Slow-4G trace shows the first visible world and each required medium field
  arriving within the Phase 1 budget.
- Fast scrolling never creates a blank frame, false geography, or a permanent
  low-detail close shot.
- The diagnostics can report which level was used and whether fallback appeared.

---

## Phase 4 — caching and production asset delivery

**Goal:** Make the first visit tolerable and return visits fast.

### Work

- Serve content-hashed terrain assets from a CDN/static host with immutable
  cache headers.
- Add a service-worker strategy only if it improves repeat visits without
  trapping stale historical data or breaking a fresh deployment.
- Verify offline/interrupted-download behaviour: retain the readable fallback;
  never leave an opaque loader.
- Test cold cache, warm cache and partial cache on the target browser.

### Done when

- A second visit does not redownload already-cached terrain.
- A deployment can safely replace data assets without stale-cache corruption.

---

## Phase 5 — direct the whole fourteen-beat film

**Goal:** Turn technically joined scenes into one authored experience.

### Work

- Review the entire master film forward and backward, without diagnostics
  visible, on a real desktop screen.
- Make a beat-by-beat edit sheet for pacing, camera speed, intentional pauses,
  voice entrances/exits, hard cuts, and seams.
- Fix blocking transition defects at their mechanism: master time ownership,
  child-scene handoff, or shared data—not by hiding the symptom in one scene.
- Pay special attention to the 07→08, 08→09, 09→10, 10→11, 11→12, 12→13 and
  13→14 handoffs, since they now cross independently built renderers.
- Review the opening and ending as complete emotional movements, not merely
  Beat 01 and Beat 14 implementations.

### Done when

- There is an approved edit sheet and every listed blocking seam is resolved.
- The film holds one intelligible tempo from 300,000 BP to the present.

---

## Phase 6 — final narration and editorial pass

**Goal:** Lock humane, natural-language narration to the final pacing.

### Work

- Rewrite the fourteen subtitle passages, titles, labels and static-reader
  text together after Phase 5’s timing is stable.
- Preserve the story’s rules: complete sentences, concrete language, no
  slogans, no inevitable march, no invented resolution of uncertainty.
- Ensure the image arrives before the words and each planned silence remains
  genuinely silent.
- Update `story/SCRIPT.md`, `story/narration.json`, scene copy tables and tests
  in the same change so the film never has two competing scripts.
- Conduct a read-aloud edit, ideally with a human narrator’s cadence in mind.

### Done when

- One locked script drives every viewer-facing surface.
- Every spoken factual claim resolves to its allowed event/source record.

---

## Phase 7 — research closure and historical decision gates

**Goal:** Close evidence gaps honestly, and keep unresolved questions visibly
unresolved where closure is not possible.

### Work

- Identify, assess and cite a vegetation dataset suitable for the film’s
  geographic/time coverage. Then decide exactly what it adds to Beats 02, 05
  and 12.
- Decide whether an older-than-60 ka temperature record materially improves
  Act I; it is low priority unless a shot needs it.
- Make a director decision for the Sahul chronology picture: the graphic must
  not privilege the genetic window while claiming neutrality about the older
  archaeological reading.
- Resolve or deliberately defer the Beat 13 Sahel chronology question with a
  source-backed note. Do not restore it to Beat 12.
- Perform a final claim-by-claim source, date, confidence and wording audit for
  all fourteen beats, including the later scenes added after the original Beat
  06 audit.

### Done when

- Every new visual/data channel has a named source and a stated uncertainty.
- Any remaining gap appears as an intentional omission or explicit uncertainty,
  never a confident-looking guess.

### Requires director/researcher authority

- Sahul chronology framing.
- Whether a data gap should remain visible rather than be filled.
- Any change that interprets contested migration or settlement evidence.

---

## Phase 8 — cultural material and rights

**Goal:** Handle sensitive material with permission, attribution and restraint.

### Work

- Seek guidance/permission for any intended Leang Karampuang and Denisova 11
  imagery.
- If permission is unavailable or inappropriate, retain the clearly labelled
  original diagram/reserved plate rather than substituting an uncredited image.
- Check caption language, provenance, attribution and visual prominence with
  the relevant source/custodian requirements.

### Done when

- Every image is permitted and attributed, or its absence is intentionally and
  respectfully represented.

### External blocker

No AI should claim permission, invent a replacement artefact, or remove the
placeholder merely to make a layout look complete.

---

## Phase 9 — complete accessibility and static-reader experience

**Goal:** The whole story remains available when the WebGL film is not.

### Work

- Build a complete fourteen-beat atlas/transcript, not just the Beat 06 atlas.
- Route narrow screens, reduced motion, no JavaScript and WebGL failure to that
  readable artifact.
- Ensure it contains the same final copy, source links/records, intentional
  pauses expressed as structure, and meaningful image alternatives.
- Review keyboard order, focus visibility, headings, landmark structure,
  live-region behaviour and contrast across the master shell.
- Add automated route checks and manual screen-reader review.

### Done when

- A reader can understand the full film without WebGL, motion, a wide screen or
  JavaScript.
- The static experience is treated as a complete work, not an error page.

---

## Phase 10 — release UI and operational hardening

**Goal:** Separate development instrumentation from the audience experience.

### Work

- Gate or remove diagnostics, benchmark controls and developer explanations
  from the production film surface.
- Define production loading, error and recovery states.
- Add clear entry, exit and restart behaviour for the master film.
- Verify font loading, browser GPU failure messaging and fallback links.
- Review privacy, third-party font dependencies and offline behaviour before
  public hosting.

### Done when

- A first-time viewer sees only intentional film UI.
- Every failure state has a truthful explanation and a usable path onward.

---

## Phase 11 — final verification and release candidate

**Goal:** Demonstrate the film is sound as a whole, not merely that its scenes
pass alone.

### Work

- Build a release-level verifier for all fourteen beat handoffs, global year
  continuity, deterministic forward/backward state, scene errors, narration
  contracts and fallback paths.
- Test the master film on the target Iris Xe device, a second browser, and a
  weaker supported machine. Record exact browser/GPU/device context.
- Perform real visible-window measurements for frame pacing and the loading
  budgets from Phases 1–4. Do not use headless timing as device evidence.
- Complete visual review at all major cuts, all intentional silences and the
  beginning/end of every beat.
- Freeze a release candidate, regenerate static artifacts, and rerun every
  relevant build/check from a clean cache.

### Done when

- The release checklist is green, remaining limitations are written plainly,
  and the master film has a reproducible tagged commit.

---

## Optional post-release production

These are valuable, but should begin only after picture and copy lock.

- Recorded narration.
- Sound design and restrained music.
- Translations/localisation.
- Additional reader tools and educational material.
- Expanded source essays or curator notes.

## Deferred observations

- The pale light on the Beat 05 limb remains a director’s-eye decision.
- The delivery plan must not silently turn diagnostics into audience UI.
- The current `CONTINUE.md` contains historical handoff material that conflicts
  with the now-built master film; reconcile it in Phase 0, not by discarding
  the record of why earlier decisions were made.
