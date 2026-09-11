"""Verify every renderer publishes the common first-meaningful-frame contract."""
import argparse

from playwright.sync_api import sync_playwright


ROOT = "http://127.0.0.1:8899/"
SCENES = (
    ("origins/index.html?beat=1", 1, [1]),
    ("origins/index.html?beat=2", 2, [2]),
    ("origins/index.html?beat=3", 3, [3]),
    ("origins/index.html?beat=4", 4, [4]),
    ("slice/index.html?pixelRatio=1", 5, [5, 6, 7]),
    ("shrink/index.html", 8, [8]),
    ("steppe/index.html", 9, [9]),
    ("sweep/index.html", 10, [10]),
    ("doors/index.html?pixelRatio=.95", 11, [11]),
    ("unroll/index.html", 12, [12]),
    ("ocean/index.html", 13, [13]),
    ("epilogue/index.html", 14, [14]),
)

parser = argparse.ArgumentParser()
parser.add_argument("--from-beat", type=int, default=1)
parser.add_argument("--only-beat", type=int)
args = parser.parse_args()


with sync_playwright() as playwright:
    browser = playwright.chromium.launch()
    for path, beat, covers in (
        scene for scene in SCENES
        if scene[1] >= args.from_beat and (args.only_beat is None or scene[1] == args.only_beat)
    ):
        page = browser.new_page(viewport={"width": 1280, "height": 720})
        errors = []
        page.on("pageerror", lambda error: errors.append(str(error)))
        page.goto(ROOT + path, wait_until="load", timeout=60000)
        page.wait_for_function("window.ONE_EMBER_FRAME_READY", timeout=180000)
        detail = page.evaluate("() => window.ONE_EMBER_FRAME_READY")
        page.close()
        assert not errors, {"path": path, "errors": errors}
        assert detail["type"] == "one-ember:child-ready", detail
        assert detail["beat"] == beat and detail["covers"] == covers, detail
        assert detail["loaderHidden"] is True and detail["firstFrameAt"] >= 0, detail
        print("PASS", path, detail)
    browser.close()
