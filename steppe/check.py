"""Browser contract for Beat 09; run with a static server on port 8899."""
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b=p.chromium.launch(); page=b.new_page(viewport={"width":1440,"height":810}); errors=[]
    page.on("pageerror",lambda e:errors.append(str(e)))
    page.goto("http://127.0.0.1:8899/steppe/index.html",wait_until="networkidle",timeout=60000); page.wait_for_timeout(800)
    out=page.evaluate("""() => { const E=window.EMBER9;
      const lines=[.10,.80].map(t=>{E.renderAt(t);return document.querySelector('#voice').textContent});
      return {ready:!!E,pure:E&&E.purity(),start:E&&E.stateFor(0),end:E&&E.stateFor(1),
              copy:{lines,expected:E&&E.D.beat.onScreen}} }""")
    page.screenshot(path=".playwright-mcp/beat09.png"); b.close()
print(out)
if errors or not out["ready"] or not out["pure"] or " ".join(out["copy"]["lines"]) != out["copy"]["expected"]:raise SystemExit(1)
