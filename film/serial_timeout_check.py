"""A serial retry timeout restores and holds the last committed scene."""
from playwright.sync_api import sync_playwright


with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_page(viewport={"width": 1440, "height": 810})
    page.emulate_media(reduced_motion="reduce")
    errors = []
    page.on("pageerror", lambda error: errors.append(str(error)))
    page.goto("http://127.0.0.1:8899/film/index.html?diagnostics=1&stage-timeout=1", wait_until="load", timeout=60000)
    page.wait_for_function("window.FILM && window.FILM.ready", timeout=30000)
    page.evaluate("window.FILM.renderAt(.45)")
    page.wait_for_function("window.FILM.active === 1 && window.FILM.pending === null && window.FILM.staging === null", timeout=30000)
    result = page.evaluate("""() => ({
      target:FILM.target, current:FILM.current, active:FILM.active,
      iframeCount:document.querySelectorAll('iframe').length,
      bridge:document.querySelector('#bridge').textContent,
      events:FILM.diagnostics().events
    })""")
    browser.close()

print(result)
assert not errors, errors
assert result["target"] < .04 and result["current"] < .04 and result["active"] == 1 and result["iframeCount"] == 1
assert "previous scene is restored" in result["bridge"].lower() and "Retry scene" in result["bridge"]
assert any(e["type"] == "stage-timeout" and e["detail"]["beat"] == 8 for e in result["events"])
