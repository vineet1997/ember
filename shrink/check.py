"""Browser contract for Beat 08; run with a static server on port 8899."""
from playwright.sync_api import sync_playwright

with sync_playwright() as playwright:
    browser = playwright.chromium.launch()
    page = browser.new_page(viewport={"width": 1440, "height": 900})
    errors = []
    page.on("pageerror", lambda error: errors.append(str(error)))
    page.goto("http://127.0.0.1:8899/shrink/index.html", wait_until="networkidle")
    page.wait_for_function("window.EMBER8 && window.EMBER8.D")
    ready = page.evaluate("() => !!window.EMBER8")
    purity = page.evaluate("() => window.EMBER8.purity()")
    states = page.evaluate("() => [window.EMBER8.stateFor(0), window.EMBER8.stateFor(1)]")
    timing = page.evaluate("() => [window.EMBER8.stateFor(.37), window.EMBER8.stateFor(.43), window.EMBER8.stateFor(.47), window.EMBER8.stateFor(.65)]")
    copy = page.evaluate("""() => {
      const E = window.EMBER8;
      const lines = [.10, .30, .50].map(t => { E.renderAt(t); return document.querySelector('#voice').textContent; });
      return { lines, expected: E.D.beat.onScreen };
    }""")
    coverage = page.evaluate("() => window.EMBER8.D.iceCoverage.fromBP")
    print("ready", ready, "pure", purity, "range", round(states[0]["sea"], 1), round(states[1]["sea"], 1), "coverage", coverage)
    assert ready and purity and not errors
    assert states[0]["iceVisible"] == 0 and states[1]["iceVisible"] == 0
    assert coverage == 26000
    assert timing[0]["sungir"] == 0 and timing[0]["north"] == 0
    assert timing[1]["sungir"] == 1 and timing[1]["north"] == 0
    assert timing[2]["north"] == 0 and timing[3]["north"] == 1
    assert " ".join(copy["lines"]) == copy["expected"]
    browser.close()
