"""Local or deployed release smoke test for the full fourteen-beat film."""
import argparse
import atexit
import json

from playwright.sync_api import sync_playwright


parser = argparse.ArgumentParser()
parser.add_argument("--url", default="http://127.0.0.1:8899/film/index.html?diagnostics=1")
args = parser.parse_args()


with sync_playwright() as p:
    browser = p.chromium.launch()
    def close_browser():
        try:
            browser.close()
        except Exception:
            pass
    atexit.register(close_browser)
    # The full film includes the detailed Beats 05–07 globe, whose supported
    # renderer viewport begins at 1280px wide. Exercise the rich compositor.
    page = browser.new_page(viewport={"width": 1440, "height": 810})
    errors = []
    page.on("pageerror", lambda error: errors.append(str(error)))
    page.goto(args.url, wait_until="load", timeout=60000)
    page.wait_for_function("window.FILM && window.FILM.ready", timeout=30000)
    beats = page.evaluate("window.FILM.D.beats.map(b => ({id:b.id,t:b.t0 + Math.min(.002,(b.t1-b.t0)/2)}))")
    committed = []
    for beat in beats[1:]:
        print(f"staging beat {beat['id']}", flush=True)
        page.evaluate("t => window.FILM.renderAt(t)", beat["t"])
        try:
            page.wait_for_function(
                "id => window.FILM.active === id && window.FILM.pending === null",
                arg=beat["id"],
                timeout=30000,
            )
        except Exception:
            print(json.dumps(page.evaluate("""() => ({
              active:FILM.active, pending:FILM.pending, staging:FILM.staging,
              incoming:(() => { const f=[...document.querySelectorAll('iframe.incoming')].at(-1); return !f ? null : {
                src:f.src, ember:!!f.contentWindow.EMBER, ready:!!f.contentWindow.ONE_EMBER_FRAME_READY,
                loader:f.contentDocument.querySelector('#load') && f.contentDocument.querySelector('#load').className,
                text:f.contentDocument.body.innerText.slice(0,400)
              }; })(),
              events:FILM.diagnostics().events.slice(-12)
            })"""), indent=2), flush=True)
            raise
        page.wait_for_function("document.querySelectorAll('iframe').length === 1", timeout=30000)
        state = page.evaluate("""() => ({
          active:window.FILM.active,
          title:document.querySelector('#title').textContent,
          loaderHidden:document.querySelector('iframe').contentDocument.querySelector('#load').classList.contains('off')
        })""")
        assert state["active"] == beat["id"] and state["loaderHidden"], state
        committed.append(state)

    # First establish Beat 9, then prove that a cancelled reverse handoff
    # returns to that already-committed scene without leaving a second iframe.
    page.evaluate("window.FILM.renderAt(.54)")
    page.wait_for_function(
        "window.FILM.active === 9 && window.FILM.pending === null",
        timeout=30000,
    )
    reverse = page.evaluate("""() => {
      const F=window.FILM; F.renderAt(.54); F.renderAt(.45); F.renderAt(.54);
      return {active:F.active,pending:F.pending,staging:F.staging,title:document.querySelector('#title').textContent};
    }""")
    page.keyboard.press("End")
    page.wait_for_timeout(120)
    destination = page.evaluate("() => ({target:FILM.target,current:FILM.current,active:FILM.active,iframeCount:document.querySelectorAll('iframe').length})")
    trace = page.evaluate("window.FILM.diagnostics().events")

print(json.dumps({"committed": committed, "reverse": reverse, "destination": destination}, indent=2))
assert not errors, errors
assert [state["active"] for state in committed] == list(range(2, 15))
assert reverse == {"active": 9, "pending": None, "staging": None, "title": "Mammoth steppe"}
assert destination["target"] == 1 and destination["current"] < .60 and destination["active"] == 9 and destination["iframeCount"] == 1
assert all(event["type"] != "boot-error" for event in trace)
