"""The fallback is a complete reader, and narrow/no-WebGL sessions reach it."""
from playwright.sync_api import sync_playwright


with sync_playwright() as p:
    browser = p.chromium.launch()
    reader = browser.new_page(viewport={"width": 1440, "height": 810})
    reader.goto("http://127.0.0.1:8899/film/atlas.html", wait_until="load", timeout=30000)
    atlas = reader.evaluate("""() => ({articles:document.querySelectorAll('article').length,
      scripts:document.querySelectorAll('script').length, nav:document.querySelectorAll('nav a').length,
      first:document.querySelector('#beat-1 h2').textContent, last:document.querySelector('#beat-14 h2').textContent})""")
    # This is below the 05–07 renderer's own supported viewport, but well
    # above a phone width. The master must choose the reader before staging it.
    narrow = browser.new_page(viewport={"width": 1200, "height": 810})
    narrow.goto("http://127.0.0.1:8899/film/index.html", wait_until="load", timeout=30000)
    narrow.wait_for_url("**/film/atlas.html?reason=narrow", timeout=30000)
    no_webgl = browser.new_page(viewport={"width": 1440, "height": 810})
    no_webgl.add_init_script("HTMLCanvasElement.prototype.getContext = function () { return null; };")
    no_webgl.goto("http://127.0.0.1:8899/film/index.html", wait_until="load", timeout=30000)
    no_webgl.wait_for_url("**/film/atlas.html?reason=no-webgl", timeout=30000)
    browser.close()

print(atlas)
assert atlas == {"articles": 14, "scripts": 0, "nav": 14, "first": "The dark earth", "last": "The human web"}
