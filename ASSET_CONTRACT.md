# One Ember terrain asset contract

This is the Phase 1 delivery contract for the elevation fields. It separates
what is built now from the terrain pyramid promised by Phase 2, so a smaller
or more convenient image can never silently become a different coast.

The machine-readable inventory is
[`data/terrain_asset_manifest.json`](data/terrain_asset_manifest.json). Rebuild
and verify it with:

```powershell
.venv\Scripts\python.exe data\benchmark_terrain_assets.py
.venv\Scripts\python.exe data\check_terrain_assets.py
```

The second command expects `python serve.py` at repository root. The benchmark
does an RGB pixel-for-pixel comparison after decoding every WebP. It is not a
visual approximation test.

## Asset inventory

| Delivery tier | Field | Current use | Extent / resolution | Status |
|---|---|---|---|---|
| Initial | Global overview | Whole-world first meaningful state | 180°W–180°E, 90°S–90°N; 1024×512 | Built in Phase 2 |
| Medium | Red Sea, Sunda/Wallacea, Europe/west Asia | Corridor-level first usable view | 1020×960, 1920×1560, 2160×930 | Built in Phase 2 |
| Full | Red Sea | Beat 05 | 28–62°E, 4–36°N; 2040×1920 | Built |
| Full | Sunda / Wallacea | Beat 06 | 92–156°E, 30°S–22°N; 3840×3120 | Built |
| Full | Europe / west Asia | Beat 07 | 12°W–60°E, 30–61°N; 4320×1860 | Built |

Every built field is Terrain-RGB derived from ETOPO 2022 bedrock. The decode is
`elevation metres = (R × 256 + G) × 0.30518043793392846 − 11000`; the generated
metadata records a maximum quantisation error of 0.3061 m for the global
overview and 0.3052 m for each native-resolution corridor. Builders and the
per-field source/extent/byte records are named in the manifest.

## Phase 2 pyramid

[`data/terrain_pyramid_manifest.json`](data/terrain_pyramid_manifest.json)
records seven new fields: one 1024×512 global overview plus medium (2×) and
overview (4×) levels for every corridor. Their lossless WebPs total 9,209,802
bytes (8.78 MiB). Each is an exact area-average of decoded 16-bit Terrain-RGB
elevation and then re-encoded; no rendered frame is used as an input.

The validator checks source/output hashes, lossless WebP identity, shelf-area
change at the film’s sea levels, and the recorded source evidence for the Red
Sea doors and Wallacea bottleneck. Exact Red Sea door measurements, the 70.5 km
Wallacea bottleneck, and Beat 07 close relief are explicitly full-only claims.
The manifest gives a screen-space gate for each lower level: its averaging
footprint must be under 0.75 screen pixel at the camera pose. Phase 3 uses only
one field per frame: full at the close and matching cuts, medium elsewhere,
and the global overview when neither corridor field is ready. It never blends
two resolutions, so it cannot draw duplicate or interpolated coasts during a
refinement. The global fallback is the same field bound to both shader inputs,
not an image-derived substitute.

## Phase 3 progressive delivery

The film blocks only on `film.json` and the 1024×512 global overview. It
feature-detects WebP, requests it first, and retries the retained PNG only when
the WebP request or decode fails. The opening corridor medium field begins in
parallel but is optional: the first world frame can use the overview while it
arrives.

After startup, the queue requests the current corridor’s medium field, then
the nearest upcoming corridor media, before any full fields. Network fetching
continues while an earlier field waits for its idle GPU conversion. A scroll
jump may cancel an obsolete *full* request; it never discards the current
medium field. A completed full field is selected only when the scene is not in
a matching cut, preserving a single authoritative coastline per frame.

`window.EMBER.terrainDelivery()` and the director panel expose each field as
`full`, `medium`, or `global fallback`, plus active and queued work. The
automated failure path aborts two corridor families and confirms that Beat 06
still renders from the global field and reports that fallback honestly.

## Current baseline and selected format

The present PNG set is 36,729,566 bytes (35.028 MiB). The global overview plus
Red Sea startup pair is 8,887,064 bytes (8.48 MiB), which has a 49.37-second
transfer-only lower bound at Chrome DevTools Slow 4G (1.44 Mbps). Request
latency, HTTP overhead and decoding only make that worse.

Lossless WebP is the selected **delivery baseline**: its four decoded images
matched their PNG sources at every RGB pixel. It reduces the built inventory to
27,324,476 bytes (26.059 MiB), a 9,405,090-byte / **25.61%** saving. The startup
pair becomes 6,586,274 bytes (6.281 MiB), lowering its transfer-only Slow-4G
bound to **36.59 seconds**. That is material but still misses the experience
budget, which is why a terrain pyramid and prioritised delivery remain Phase 2
and Phase 3 work.

The PNG source files remain the explicit fallback. The browser-format contract
confirms that target Chromium decodes both formats at every expected dimension.

Lossy WebP, AVIF and image-derived screenshots are rejected for elevation
delivery unless a future candidate proves the decoded Terrain-RGB measurement
unchanged at every pixel. A good-looking coast is not sufficient evidence.

## Experience budgets

These budgets are product constraints, measured from a cold navigation on the
target browser and network profile. A headless/SwiftShader run may exercise the
logic but cannot satisfy a time budget.

| Requirement | Budget | Evidence required |
|---|---:|---|
| First meaningful world visible | ≤ 3 s | Visible-window trace, cold cache |
| First narrated scene usable | ≤ 8 s | Visible-window trace, cold cache |
| Main close view at required resolution | ≤ 5 s spent in that view | Per-level diagnostics plus trace |
| Coastline during refinement | No false or duplicate coast | Representative frame comparison at the switching pose |

If the initial overview cannot arrive, the reader must receive a clear,
non-technical fallback state. If it does arrive, the film should resolve rather
than expose loading mechanics. The next phase must report the selected field,
its resolution level and whether the global fallback appeared.

Phase 3 verifies ordering, format fallback, cancellation scope, renderer
continuity, and the failure state in headless Chromium. It does **not** claim
the three time budgets above: those still require a visible-browser, cold-cache
Slow 4G trace at the target display and a representative switch-pose capture.

## Benchmark result

Pillow 12.3.0 lossless WebP, encoder method 6, produced the numbers above.
The existing PNGs were retained and measured alongside it. A faster lossless
encoder setting produced a larger result and was rejected; no lossy or
elevation-specific alternative is admissible without passing the same
pixel-identity gate. Re-run the benchmark rather than trusting these prose
figures after any terrain rebuild.
