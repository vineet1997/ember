"""Browser contract for Beat 10; run with a static server on port 8899."""
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser=p.chromium.launch()
    page=browser.new_page(viewport={"width":1440,"height":810})
    errors=[]
    page.on("pageerror",lambda e:errors.append(str(e)))
    page.goto("http://127.0.0.1:8899/sweep/index.html",wait_until="networkidle",timeout=60000)
    page.wait_for_timeout(800)
    result=page.evaluate("""() => { const E=window.EMBER10;
      const lines=[.20,.23,.80].map(t=>{E.renderAt(t);return document.querySelector('#voice').textContent});
      return {ready:!!E,pure:E&&E.purity(),early:E&&E.stateFor(.2),late:E&&E.stateFor(.8),beforeGap:E&&E.stateFor(.21),inGap:E&&E.stateFor(.23),beforeSweep:E&&E.stateFor(.77),sweeping:E&&E.stateFor(.80),copy:{lines,expected:E&&E.D.beat.onScreen}} }""")
    page.screenshot(path=".playwright-mcp/beat10.png")
    browser.close()
print(result)
if errors or not result["ready"] or not result["pure"]: raise SystemExit(1)
if result["beforeGap"]["record"] != 1 or result["beforeGap"]["sweep"] != 0: raise SystemExit(1)
if not result["inGap"]["record"] < 1 or result["inGap"]["sweep"] != 0: raise SystemExit(1)
if result["beforeSweep"]["sweep"] != 0 or not result["sweeping"]["sweep"] > 0: raise SystemExit(1)
if " ".join(result["copy"]["lines"]) != result["copy"]["expected"]: raise SystemExit(1)
