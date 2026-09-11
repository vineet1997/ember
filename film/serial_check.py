"""Reduced-motion tier never keeps two WebGL children alive at once."""
from playwright.sync_api import sync_playwright


with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_page(viewport={"width": 1440, "height": 810})
    page.emulate_media(reduced_motion="reduce")
    errors = []
    page.on("pageerror", lambda error: errors.append(str(error)))
    page.goto("http://127.0.0.1:8899/film/index.html?diagnostics=1", wait_until="load", timeout=60000)
    page.wait_for_function("window.FILM && window.FILM.ready", timeout=30000)
    immediate = page.evaluate("""() => { const F=window.FILM; F.renderAt(.45); return {
      tier:F.tier, active:F.active, pending:F.pending, staging:F.staging,
      iframeCount:document.querySelectorAll('iframe').length, still:document.querySelector('#still').classList.contains('on')
    }; }""")
    page.wait_for_function("window.FILM.active === 8 && window.FILM.pending === null", timeout=30000)
    committed = page.evaluate("""() => ({iframeCount:document.querySelectorAll('iframe').length,
      still:document.querySelector('#still').classList.contains('on'),
      loaderHidden:document.querySelector('iframe').contentDocument.querySelector('#load').classList.contains('off')})""")
    browser.close()

print({"immediate": immediate, "committed": committed})
assert not errors, errors
assert immediate == {"tier": {"concurrent": False, "name": "serial"}, "active": 1, "pending": 8,
                     "staging": {"beat": 8, "serial": True}, "iframeCount": 1, "still": True}
assert committed == {"iframeCount": 1, "still": False, "loaderHidden": True}
