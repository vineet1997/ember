"""Master-film staged handoff contract on a capable desktop profile."""
from playwright.sync_api import sync_playwright


with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_page(viewport={"width": 1440, "height": 810})
    errors = []
    page.on("pageerror", lambda error: errors.append(str(error)))
    page.goto("http://127.0.0.1:8899/film/index.html?diagnostics=1", wait_until="load", timeout=60000)
    page.wait_for_function("window.FILM && window.FILM.ready", timeout=30000)
    immediate = page.evaluate("""() => {
      const F=window.FILM, samples=[0,.20,.45,.68,.85,.99].map(t=>F.stateFor(t).beat.id);
      F.renderAt(.45);
      return {tier:F.tier, samples, active:F.active, pending:F.pending, staging:F.staging,
        title:document.querySelector('#title').textContent,
        visible:[...document.querySelectorAll('iframe')].filter(f=>getComputedStyle(f).visibility==='visible').map(f=>f.title)};
    }""")
    page.wait_for_function("window.FILM.active === 8 && window.FILM.pending === null", timeout=30000)
    page.wait_for_function("document.querySelectorAll('iframe').length === 1", timeout=30000)
    committed = page.evaluate("""() => ({
      active:window.FILM.active, pending:window.FILM.pending,
      title:document.querySelector('#title').textContent,
      iframe:document.querySelector('iframe').title,
      loaderHidden:document.querySelector('iframe').contentDocument.querySelector('#load').classList.contains('off'),
      events:window.FILM.diagnostics().events
    })""")
    cancelled = page.evaluate("""() => {
      const F=window.FILM; F.renderAt(.54); const requested={pending:F.pending,staging:F.staging}; F.renderAt(.45);
      return {requested,active:F.active,pending:F.pending,staging:F.staging,title:document.querySelector('#title').textContent};
    }""")
    page.keyboard.press("End")
    page.wait_for_function("scrollY === document.documentElement.scrollHeight - innerHeight")
    browser.close()

print({"immediate": immediate, "committed": committed, "cancelled": cancelled})
assert not errors, errors
assert immediate["tier"]["concurrent"] is True
assert immediate["samples"] == [1, 4, 8, 11, 13, 14]
assert immediate["active"] == 1 and immediate["pending"] == 8 and immediate["staging"] == {"beat": 8, "serial": False}
assert immediate["title"] == "The dark earth" and immediate["visible"] == ["Beat 1: The dark earth"]
assert committed["active"] == 8 and committed["pending"] is None
assert committed["title"] == "The world gets smaller" and committed["iframe"] == "Beat 8: The world gets smaller"
assert committed["loaderHidden"]
assert any(e["type"] == "stage-first-frame" and e["detail"]["beat"] == 8 for e in committed["events"])
assert any(e["type"] == "stage-create" and e["detail"]["rendererCount"] == 2 for e in committed["events"])
disposed = next(e["detail"] for e in committed["events"] if e["type"] == "dispose" and e["detail"]["beat"] == 1)
assert disposed["reason"] == "crossfade-complete" and disposed["rendererCount"] == 1 and disposed["lifetimeMs"] >= 0
assert cancelled == {"requested": {"pending": 9, "staging": {"beat": 9, "serial": False}}, "active": 8, "pending": None, "staging": None, "title": "The world gets smaller"}
