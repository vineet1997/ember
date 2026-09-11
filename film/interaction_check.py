"""Checkpoint 4: destination controls and the renderer pixel budget."""
from playwright.sync_api import sync_playwright


with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_page(viewport={"width": 1440, "height": 810}, device_scale_factor=2)
    errors = []
    page.on("pageerror", lambda error: errors.append(str(error)))
    page.goto("http://127.0.0.1:8899/film/index.html?diagnostics=1", wait_until="load", timeout=60000)
    page.wait_for_function("window.FILM && window.FILM.ready", timeout=10000)
    initial = page.evaluate("""() => ({target:FILM.target,current:FILM.current,resolution:FILM.resolution,
      canvas:document.querySelector('iframe').contentDocument.querySelector('#earth').width,
      buttons:document.querySelectorAll('#ticks button').length,
      ruler:document.querySelector('#ruler').getAttribute('aria-label')})""")
    page.keyboard.press("End")
    page.wait_for_timeout(120)
    end = page.evaluate("() => ({target:FILM.target,current:FILM.current,scroll:scrollY,maximum:document.documentElement.scrollHeight-innerHeight,active:FILM.active})")
    page.keyboard.press("Home")
    page.wait_for_timeout(50)
    page.evaluate("document.querySelector('#ticks button[data-beat=\"8\"]').click()")
    page.wait_for_timeout(120)
    ruler = page.evaluate("""() => ({target:FILM.target,current:FILM.current,active:FILM.active,
      selected:document.querySelector('#ticks button[data-beat="1"]').getAttribute('aria-current'),
      destination:document.querySelector('#destination').style.left})""")
    browser.close()

print({"initial": initial, "end": end, "ruler": ruler})
assert not errors, errors
assert initial["buttons"] == 15 and initial["ruler"] == "Choose a destination chapter"
assert 0.65 <= initial["resolution"] < 2 and initial["canvas"] <= 1440 * initial["resolution"] + 2
assert end["target"] == 1 and end["current"] < .08 and end["scroll"] == end["maximum"] and end["active"] == 1
assert ruler["target"] == .44 and ruler["current"] < .08 and ruler["active"] == 1
assert ruler["selected"] == "true" and ruler["destination"] == "44%"
