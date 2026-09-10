"""Browser contract for the Act I orbital scenes; static server port 8899."""
from playwright.sync_api import sync_playwright

YEARS = {1: (300000, 260000), 2: (260000, 200000), 3: (200000, 76000), 4: (76000, 60000)}
with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_page(viewport={"width": 1440, "height": 900})
    errors = []
    page.on("pageerror", lambda error: errors.append(str(error)))
    for beat, years in YEARS.items():
        page.goto("http://127.0.0.1:8899/origins/index.html?beat=%d" % beat, wait_until="networkidle")
        page.wait_for_function("window.EMBER%d && window.EMBER%d.D" % (beat, beat))
        page.evaluate("t => window.EMBER%d.renderAt(t)" % beat, 0.5)
        state = page.evaluate("t => window.EMBER%d.stateFor(t)" % beat, 0.5)
        assert round(state["year"]) == round((years[0] + years[1]) / 2), (beat, state["year"])
        assert state["iceVisible"] == 0, beat
        assert page.evaluate("() => window.EMBER%d.purity()" % beat), beat
    assert not errors, errors
    browser.close()
print("PASS Phase 3 foundation — Act I has four sourced orbital scenes")
