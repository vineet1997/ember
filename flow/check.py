"""Browser contract for the 08–12 deep-time integration shell.

Run with a static server rooted at the repository on port 8899.
"""
from playwright.sync_api import sync_playwright

ROOT = "http://127.0.0.1:8899/flow/index.html"

with sync_playwright() as playwright:
    browser = playwright.chromium.launch()
    page = browser.new_page(viewport={"width": 1440, "height": 900})
    errors = []
    page.on("pageerror", lambda error: errors.append(str(error)))
    page.goto(ROOT, wait_until="networkidle")
    page.wait_for_function("window.FLOW && window.FLOW.ready")
    page.evaluate("() => window.FLOW.renderAt(.45)")
    page.wait_for_function("""() => {
      const f = document.querySelector('iframe[data-beat="8"]');
      return f && f.contentDocument && f.contentDocument.documentElement.classList.contains('presentation') &&
        document.querySelector('#subtitle').textContent.length > 0;
    }""")
    result = page.evaluate("""() => {
      const F = window.FLOW, B = F.D.beats, near = 1e-9;
      const starts = B.map(b => F.stateFor(b.t0));
      const ends = B.map(b => F.stateFor(b.t1 - near));
      const truth = B.every((b, i) => starts[i].beat.id === b.id &&
        Math.abs(starts[i].localT) < near &&
        Math.abs(ends[i].localT - 1) < 1e-6);
      const last = F.renderAt(B[B.length - 1].t1);
      const active = document.querySelector('iframe.on').dataset.beat;
      const idle = B.slice(0, -1).every(b => !document.querySelector('iframe[data-beat="' + b.id + '"]').classList.contains('on'));
      const chrome = {
        title: document.querySelector('#title').textContent,
        subtitle: document.querySelector('#subtitle').textContent,
        rulerTicks: document.querySelectorAll('#ticks .tick').length,
        childChromeHidden: getComputedStyle(document.querySelector('iframe[data-beat="12"]').contentDocument.querySelector('#head')).display === 'none'
      };
      return { purity: F.purity(), truth, last: last.beat.id, active, idle, chrome,
        range: F.D.range, starts: starts.map(s => s.t), ends: ends.map(s => s.t) };
    }""")
    print(result)
    assert result["purity"], "global state was history-dependent"
    assert result["truth"], "a beat did not own its declared t window"
    assert result["range"] == [0.44, 0.85], result["range"]
    assert result["last"] == 12 and result["active"] == "12" and result["idle"]
    assert result["chrome"]["title"] == "Seeds", result["chrome"]
    assert result["chrome"]["rulerTicks"] == 6, result["chrome"]
    assert result["chrome"]["childChromeHidden"], result["chrome"]
    assert not errors, errors
    browser.close()
