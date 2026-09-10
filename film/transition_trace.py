"""Local-only baseline trace for the master-film handoff.

It records the current controller rather than treating its staged title as a
passing transition. Run it against ``python serve.py`` from the repository root.
"""
import json
from playwright.sync_api import sync_playwright

URL = "http://127.0.0.1:8899/film/index.html?diagnostics=1"

with sync_playwright() as playwright:
    browser = playwright.chromium.launch()
    page = browser.new_page(viewport={"width": 1440, "height": 810}, device_scale_factor=1)
    errors = []
    page.on("pageerror", lambda error: errors.append(str(error)))
    page.goto(URL, wait_until="load", timeout=60000)
    page.wait_for_function("window.FILM && window.FILM.ready", timeout=180000)
    immediate = page.evaluate("""() => {
      const F=window.FILM, max=document.documentElement.scrollHeight-innerHeight;
      window.scrollTo(0, max*.45); F.renderAt(.45);
      return {active:F.active,pending:F.pending,title:document.querySelector('#title').textContent,
        iframeTitle:document.querySelector('iframe').title};
    }""")
    page.wait_for_function("window.FILM.pending === null", timeout=180000)
    page.wait_for_function("""() => window.FILM.diagnostics().events.some(
      event => event.type === 'child-first-frame' && event.detail.beat === 8)""", timeout=180000)
    trace = page.evaluate("() => window.FILM.diagnostics()")
    browser.close()

print(json.dumps({"immediate": immediate, "trace": trace}, indent=2))
assert not errors, errors
assert immediate == {"active": 1, "pending": 8, "title": "The dark earth", "iframeTitle": "Beat 8: The world gets smaller"}
assert any(event["type"] == "request" and event["detail"]["beat"] == 8 for event in trace["events"])
assert any(event["type"] == "commit" and event["detail"]["beat"] == 8 for event in trace["events"])
child_frame = next(event["detail"] for event in trace["events"]
                   if event["type"] == "child-first-frame" and event["detail"]["beat"] == 8)
assert {key: child_frame[key] for key in ("beat", "covers", "handle", "loaderHidden")} == {
    "beat": 8, "covers": [8], "handle": "EMBER8", "loaderHidden": True,
}
assert child_frame["firstFrameAt"] >= 0
