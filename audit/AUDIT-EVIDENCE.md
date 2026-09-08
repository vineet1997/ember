# Independent evaluation: reproduction notes

2026-09-08. Review artifacts only; project sources and generated film/atlas assets were not modified.

## Cartographic registration

Run `audit-georeference.py` with the bundled Python runtime (NumPy and Pillow). It compares 588 regional-tile samples with the global texture. RMS elevation disagreement is 0.105 m when accounting for the global builder's crop, and 2667.457 m at the coordinates used by the shader. `data/build_rasters.py:28` uses integer block factors and discards the remainder of the input. On a 21600 by 10800 source, a 4096 by 2048 result retains only 20480 by 10240 source cells. `slice/film.js:531` nevertheless assigns the complete global extent. See `audit-georeference.json`.

## Measurements

`audit-measurements.py` decodes the shipped regional PNG and measures its own box independently. The rendered Sunda tile is 92–156 E, 30 S–22 N. Its approximate unweighted land percentages are 27.18 at present, 36.91 at -68.3 m, and 37.47 at -73.9 m. The quoted 23.75/30.44/30.88 figures instead come from the larger 90–160 E, 50 S–30 N connectivity box. Both builders use pixel fractions, not cosine-latitude weighted surface area.

The stored comparison box changes from 30.44 to 30.88 percent between the beat's endpoint sea levels: a 1.445% relative gain, not 30%. The 30% comparison uses present sea level as its baseline. The atlas caption also says the sea falls 131 m 'from here' despite showing approximately -74 m; the further fall to -131 m is approximately 57 m.

The four boot-blocking terrain PNGs total 36,754,434 bytes. The eight atlas WebPs total 844,888 bytes. The palette color #5F7794 has 4.396:1 contrast against #04060A. See `audit-measurements.json`.

## Browser checks

Bundled Playwright Chromium, headless SwiftShader. Static render and accessibility inspection only: no claim about real-screen frame rate or smoothness. The unavailable agent-browser CLI was replaced by the bundled Playwright API. No deployment or external messages were sent.

`independent-audit.cjs` runs all five panel tests twice, renders the built beats, reads the accessibility tree, checks changes to reduced-motion and viewport settings, and injects an asset failure. `audit-followup.cjs` supplies additional reproductions. The rAF loop is disabled for deterministic static inspection; `renderAt` draws the requested frame. Some screenshot work explicitly suppresses the finished loading overlay and eagerly decodes lazy atlas images. Those test accommodations are not production edits.

Findings:

- All five panel tests passed on both runs.
- Injecting a smooth 100 m sea-level depression centred at t=0.42725 still passes `law06()`. Injection happens in the served response only. A temperature perturbation also passes; temperature is omitted from CHANNELS.
- At t=.31, arriving via .28 versus .345 leaves different, invisible record text in the DOM. The accessibility tree exposes that text. Opacity is zero, but hidden and inert are false.
- Enabling reduced motion after startup leaves the gate at display:none. Resizing the running film to 390 pixels also leaves it off.
- At ordinary film entry, Tab has no visible reader-facing target. The hidden panel has buttons, but there is no visible film navigation or atlas link.
- Aborting bathy_sunda.png leaves the loader opaque with no visible atlas link. Other successful requests overwrite the error with a normal progress label.
- The atlas at 390 pixels has scrollWidth=390: no horizontal overflow. The initial measured document height is 10363 pixels. The images have dimensions and lazy loading except the first. The alt text mostly repeats numeric camera state rather than describing geographic or pictorial relationships.
- No page JavaScript errors occurred on the successful render path.

Raw results: `independent-audit-results.json`, `audit-followup-results.json`. Screenshots: `audit-film-05-settled.png`, `audit-film-06.png`, `audit-film-07.png`, `audit-atlas-mobile-gap.png`, `audit-atlas-mobile-loaded.png`. The earlier `audit-film-05.png` catches a loader fade and should not be used to assess final contrast.

## Load-bearing literature checked

- Sümer et al., earliest modern human genomes: https://www.nature.com/articles/s41586-024-08420-x
- Iasi et al., Neanderthal ancestry through time: https://pmc.ncbi.nlm.nih.gov/articles/PMC12184710/
- Gandini et al. 2025, genetic support for the long Sahul chronology: https://pubmed.ncbi.nlm.nih.gov/41313774/
- Bird et al. 2018, Timor–Roti voyage modelling: https://www.sciencedirect.com/science/article/pii/S0277379117308478
- Kealy et al. 2017, Wallacean palaeogeography and intervisibility: https://onlinelibrary.wiley.com/doi/10.1002/arp.1570
- Spratt and Lisiecki 2016, sea-level stack: https://cp.copernicus.org/articles/12/1079/2016/
- Oktaviana et al. 2026, Liang Metanduno minimum ages: https://doi.org/10.1038/s41586-025-09968-y
- Vidal et al. 2022, Omo minimum age: https://www.nature.com/articles/s41586-021-04275-8
- Ragsdale et al. 2023, structured African origins: https://www.nature.com/articles/s41586-023-06055-y
- Larson et al. 2014, domestication centres: https://pmc.ncbi.nlm.nih.gov/articles/PMC4035915/
- SlaveVoyages methodology: https://legacy.slavevoyages.org/blog/methodology-trans-atlantic
- CI impacts: https://pmc.ncbi.nlm.nih.gov/articles/PMC3427068/ and https://escholarship.org/uc/item/7h70k3r1
- Madjedbebe research and Mirarr collaboration: https://www.sciencedirect.com/science/article/pii/S0277379122001299
- White Sands long trackway: https://eprints.bournemouth.ac.uk/34821/

This is a focused external audit of load-bearing claims, not independent certification of all 65 bibliography entries or a clinical screen-reader/vestibular user study.
