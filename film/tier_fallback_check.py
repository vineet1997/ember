"""A stalled rich preload retries once through the one-context serial tier."""
from playwright.sync_api import sync_playwright


with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_page(viewport={"width": 1440, "height": 810})
    # Register ahead of the master's listener, then block only Beat 08's rich
    # readiness message. Removing this listener lets the serial retry commit.
    page.add_init_script("""(() => {
      if (window.top !== window) return;
      window.__blockBeat8 = event => {
        if (event.data && event.data.type === 'one-ember:child-ready' && event.data.beat === 8) {
          event.stopImmediatePropagation();
        }
      };
      window.addEventListener('message', window.__blockBeat8, true);
    })();""")
    errors = []
    page.on("pageerror", lambda error: errors.append(str(error)))
    page.goto("http://127.0.0.1:8899/film/index.html?diagnostics=1", wait_until="load", timeout=60000)
    page.wait_for_function("window.FILM && window.FILM.ready", timeout=30000)
    assert page.evaluate("typeof window.__blockBeat8") == "function"
    page.evaluate("window.FILM.renderAt(.45)")
    try:
        page.wait_for_function("window.FILM.diagnostics().events.some(e => e.type === 'tier-downgrade')", timeout=15000)
    except Exception:
        print(page.evaluate("""() => ({
          active:FILM.active, pending:FILM.pending, staging:FILM.staging,
          events:FILM.diagnostics().events
        })"""))
        browser.close()
        raise
    before_retry = page.evaluate("""() => ({
      tier:FILM.tier, active:FILM.active, pending:FILM.pending,
      iframeCount:document.querySelectorAll('iframe').length,
      events:FILM.diagnostics().events
    })""")
    page.evaluate("window.removeEventListener('message', window.__blockBeat8, true)")
    page.wait_for_function("window.FILM.active === 8 && window.FILM.pending === null", timeout=30000)
    committed = page.evaluate("""() => ({
      tier:FILM.tier, active:FILM.active, pending:FILM.pending,
      iframeCount:document.querySelectorAll('iframe').length,
      loaderHidden:document.querySelector('iframe').contentDocument.querySelector('#load').classList.contains('off')
    })""")
    browser.close()

print({"before_retry": before_retry, "committed": committed})
assert not errors, errors
assert before_retry["tier"] == {"concurrent": False, "name": "serial"}
assert before_retry["active"] == 1 and before_retry["pending"] == 8 and before_retry["iframeCount"] == 1
assert any(e["type"] == "tier-downgrade" and e["detail"]["beat"] == 8 for e in before_retry["events"])
assert committed == {"tier": {"concurrent": False, "name": "serial"}, "active": 8,
                     "pending": None, "iframeCount": 1, "loaderHidden": True}
