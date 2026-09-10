"""Browser contract for Beat 14; expects the repository server on port 8899."""
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(); page = browser.new_page(viewport={"width": 1440, "height": 810})
    errors = []; page.on("pageerror", lambda error: errors.append(str(error)))
    page.goto("http://127.0.0.1:8899/epilogue/index.html", wait_until="networkidle")
    page.wait_for_function("window.EMBER14 && window.EMBER14.D")
    result = page.evaluate("""() => { const E=window.EMBER14;
      const lines=[.2,.8].map(t=>{E.renderAt(t);return document.querySelector('#voice').textContent});
      return {ready:!!E,pure:E.purity(),states:[E.stateFor(0),E.stateFor(1)],copy:{lines,expected:E.D.beat.onScreen}} }""")
    browser.close()
print(result)
assert not errors and result["ready"] and result["pure"]
assert result["states"][0]["fan"] == 0 and result["states"][1]["fan"] == 1
assert " ".join(result["copy"]["lines"]) == result["copy"]["expected"]
