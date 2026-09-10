"""Small browser contract for Beat 11.

Run from repository root:
    .venv\\Scripts\\python.exe doors\\check.py

It expects a static server at http://127.0.0.1:8899.  This deliberately checks
the scene's two claims that a screenshot cannot: state is reversible, and its
last camera is the tuple the unroll consumes.
"""
from playwright.sync_api import sync_playwright


def main():
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page(viewport={"width": 1440, "height": 810})
        errors = []
        page.on("pageerror", lambda error: errors.append(str(error)))
        page.goto("http://127.0.0.1:8899/doors/index.html",
                  wait_until="networkidle", timeout=60000)
        page.wait_for_timeout(1000)
        result = page.evaluate("""() => ({
          ready: !!window.EMBER11,
          purity: window.EMBER11 && EMBER11.purity(),
          join: window.EMBER11 && EMBER11.join(),
          final: window.EMBER11 && EMBER11.camAt(1),
          source: window.EMBER11 && EMBER11.finalCamera,
          beforeYD: window.EMBER11 && EMBER11.stateFor(.18),
          duringYD: window.EMBER11 && EMBER11.stateFor(.22),
          afterYD: window.EMBER11 && EMBER11.stateFor(.40),
          beforeBeringia: window.EMBER11 && EMBER11.stateFor(.47),
          afterBeringia: window.EMBER11 && EMBER11.stateFor(.54),
          beforeDogger: window.EMBER11 && EMBER11.stateFor(.94),
          afterDogger: window.EMBER11 && EMBER11.stateFor(.99),
          copy: (() => {
            const E = window.EMBER11;
            const lines = [.10, .45, .54, .99].map(t => {
              E.renderAt(t); return document.querySelector('#voice').textContent;
            });
            return { lines, expected: E.D.beat.onScreen };
          })()
        })""")
        page.screenshot(path=".playwright-mcp/beat11.png")
        browser.close()
    print(result)
    if errors:
        print("PAGE ERRORS:", errors)
    timing_ok = (result["beforeYD"]["cold"] == 0 and result["duringYD"]["cold"] > 0 and
                 result["afterYD"]["cold"] == 0 and result["beforeBeringia"]["beringia"] == 0 and
                 result["afterBeringia"]["beringia"] == 1 and result["beforeDogger"]["dogger"] == 0 and
                 result["afterDogger"]["dogger"] == 1)
    copy_ok = " ".join(result["copy"]["lines"]) == result["copy"]["expected"]
    return 0 if result["ready"] and result["purity"] and result["join"] and timing_ok and copy_ok and not errors else 1


if __name__ == "__main__":
    raise SystemExit(main())
