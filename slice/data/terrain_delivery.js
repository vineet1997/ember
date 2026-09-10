/* Development delivery map. data/build_vercel_static.py replaces these stable
   local paths with content-addressed /terrain/ URLs in Vercel's build output.
   The source rasters remain readable by the evidence builders and local
   no-cache server; production never ships them at these mutable names. */
window.EMBER_TERRAIN_ASSETS = Object.freeze({
  "bathy_global_overview": { "webp": "data/bathy_global_overview.webp", "png": "data/bathy_global_overview.png" },
  "bathy_redsea_medium": { "webp": "data/bathy_redsea_medium.webp", "png": "data/bathy_redsea_medium.png" },
  "bathy_redsea": { "webp": "data/bathy_redsea.webp", "png": "data/bathy_redsea.png" },
  "bathy_sunda_medium": { "webp": "data/bathy_sunda_medium.webp", "png": "data/bathy_sunda_medium.png" },
  "bathy_sunda": { "webp": "data/bathy_sunda.webp", "png": "data/bathy_sunda.png" },
  "bathy_europe_medium": { "webp": "data/bathy_europe_medium.webp", "png": "data/bathy_europe_medium.png" },
  "bathy_europe": { "webp": "data/bathy_europe.webp", "png": "data/bathy_europe.png" }
});
