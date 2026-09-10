"""Master-film contract: all fourteen children receive one global t."""
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_page(viewport={"width": 1440, "height": 810})
    errors = []
    page.on("pageerror", lambda error: errors.append(str(error)))
    page.goto("http://127.0.0.1:8899/film/index.html", wait_until="load", timeout=60000)
    page.wait_for_function("window.FILM && window.FILM.ready", timeout=180000)
    page.wait_for_function("""() => { const f=document.querySelector('iframe');
      return f && f.contentDocument && f.contentDocument.documentElement.classList.contains('presentation'); }""")
    result = page.evaluate("""() => {
      const F=window.FILM, samples=[0,.20,.45,.68,.85,.99].map(t=>{const s=F.stateFor(t);return {id:s.beat.id,year:s.yearBP}});
      const active=[...document.querySelectorAll('iframe')].map(f=>f.title);
      const before=F.active, handoffs=[.44,.54,.61,.68,.78,.85,.93].map(t=>{const s=F.renderAt(t);return {id:s.beat.id,held:F.active === before && F.pending === s.beat.id};});
      F.renderAt(0); const jump=F.advance(.55);
      return {count:F.D.beats.length,pure:F.purity(),samples,active,handoffs,jump:{id:jump.beat.id,pending:F.pending,title:document.querySelector('#title').textContent},stagedTitle:document.querySelector('#title').textContent,stagedSubtitle:document.querySelector('#subtitle').textContent,progress:document.querySelector('#progress').style.width,visible:getComputedStyle(document.querySelector('iframe')).visibility === 'visible' && getComputedStyle(document.querySelector('iframe')).opacity === '1',subtitle:document.querySelector('#subtitle').textContent,
              live:document.querySelector('#subtitle').getAttribute('aria-live'),ruler:document.querySelectorAll('#ticks .tick').length};
    }""")
    page.keyboard.press("End")
    page.wait_for_function("""() => scrollY === document.documentElement.scrollHeight - innerHeight""")
    result["endKeyScroll"] = page.evaluate("() => scrollY > 0")
    browser.close()
print(result)
assert not errors and result["count"] == 14 and result["pure"]
assert [sample["id"] for sample in result["samples"]] == [1, 4, 8, 11, 13, 14]
assert len(result["active"]) == 1
assert [handoff["id"] for handoff in result["handoffs"]] == [8, 9, 10, 11, 12, 13, 14]
assert all(handoff["held"] for handoff in result["handoffs"])
assert result["jump"] == {"id": 9, "pending": 9, "title": "Mammoth steppe"}
assert result["stagedTitle"] == "Mammoth steppe" and result["stagedSubtitle"] == ""
assert result["progress"] == "55%"
assert result["visible"]
assert result["endKeyScroll"]
assert result["live"] == "polite" and result["ruler"] == 15
