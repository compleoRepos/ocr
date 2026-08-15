"""Enregistre une video de demonstration de secours du parcours complet."""
import pathlib
from playwright.sync_api import sync_playwright

ROOT = pathlib.Path("/home/ubuntu/ocr-cin-app")
VIDEO_DIR = ROOT / "demo"
VIDEO_DIR.mkdir(exist_ok=True)

CASES = [
    ("cin-valide-01.png", "Cas 1 : image nette"),
    ("cin-degradee-rotation.png", "Cas 2 : image degradee"),
    ("document-non-cin.png", "Cas 3 : pas une CIN"),
]

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path="/usr/lib/chromium/chromium", args=["--no-sandbox"])
    context = browser.new_context(
        record_video_dir=str(VIDEO_DIR),
        record_video_size={"width": 1280, "height": 800},
        viewport={"width": 1280, "height": 800},
    )
    page = context.new_page()
    page.goto("http://localhost:3000/", wait_until="networkidle")
    page.wait_for_timeout(2000)

    for filename, label in CASES:
        print(f"--- {label} ---")
        page.set_input_files("input[type=file]", str(ROOT / "fixtures" / filename))
        page.wait_for_timeout(600)
        page.click("text=Lire la CIN")
        page.wait_for_timeout(3500)
        page.evaluate("window.scrollTo(0, 0)")
        page.wait_for_timeout(1200)
        page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
        page.wait_for_timeout(1500)
        page.evaluate("window.scrollTo(0, 0)")
        page.wait_for_timeout(800)

    context.close()
    browser.close()

for video in VIDEO_DIR.glob("*.webm"):
    print("video:", video)
