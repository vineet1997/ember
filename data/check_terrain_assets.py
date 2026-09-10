"""Browser-format contract for the Phase 1 terrain delivery candidate.

Run against ``python serve.py`` at repository root. Pixel identity is checked
offline by benchmark_terrain_assets.py; this check confirms that the target
browser can decode every selected WebP and every retained PNG fallback.
"""
import json
from pathlib import Path

from playwright.sync_api import sync_playwright


ROOT = Path(__file__).resolve().parent.parent
MANIFEST = json.loads((ROOT / "data" / "terrain_asset_manifest.json").read_text(encoding="utf-8"))
BASE = "http://127.0.0.1:8899/slice/data/"


with sync_playwright() as playwright:
    browser = playwright.chromium.launch()
    page = browser.new_page()
    page.goto("http://127.0.0.1:8899/", wait_until="load")
    result = page.evaluate("""async fields => {
      const webpCanvasSupport = (() => {
        const c = document.createElement('canvas');
        return c.toDataURL('image/webp').startsWith('data:image/webp');
      })();
      const decode = async file => {
        const image = new Image(); image.src = '/slice/data/' + file;
        await image.decode(); return { width: image.naturalWidth, height: image.naturalHeight };
      };
      const rows = [];
      for (const field of fields) {
        rows.push({ id: field.id, webp: await decode(field.formats.losslessWebP.file), png: await decode(field.formats.pngFallback.file) });
      }
      return {webpCanvasSupport, rows};
    }""", MANIFEST["fields"])
    browser.close()

assert result["webpCanvasSupport"], "target Chromium reports no WebP canvas support"
for expected, actual in zip(MANIFEST["fields"], result["rows"]):
    dimensions = expected["dimensions"]
    for fmt in ("webp", "png"):
        assert actual[fmt] == dimensions, (expected["id"], fmt, actual[fmt], dimensions)
print("PASS terrain format contract — target Chromium decodes lossless WebP and retained PNG fallbacks")
