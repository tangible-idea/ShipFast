#!/usr/bin/env python3
"""Export docs/diagrams/*.html to docs/assets/*.png and the animated ones to *.gif.

PNG: the diagram <svg> only, at 2x (diagram-design export.md).
GIF: one frame per motion step (?motion=step&step=N), cross-faded, encoded with
ffmpeg's palettegen/paletteuse. Needs Playwright and ffmpeg; set
PLAYWRIGHT_CHANNEL=chrome to use the system Chrome instead of a bundled Chromium.
"""
from __future__ import annotations

import os
import pathlib
import subprocess
import tempfile

from PIL import Image
from playwright.sync_api import sync_playwright

HERE = pathlib.Path(__file__).resolve().parent
OUT = HERE.parent / 'assets'
STEP_HOLD, FADE_FRAMES, FADE_MS, END_HOLD = 0.7, 3, 0.06, 2.6


def shoot(page, url, path, fade_only=False):
    page.goto(url)
    page.wait_for_load_state('networkidle')
    if fade_only:
        # Cross-faded GIF frames ghost if items also slide, so keep opacity only.
        page.add_style_tag(content='[data-motion-item] { transform: none !important; }')
    page.evaluate('document.fonts.ready')
    page.locator('svg').first.screenshot(path=str(path))


def gif(page, html: pathlib.Path, out: pathlib.Path):
    steps = int(page.goto(html.as_uri()) and page.locator('[data-motion-root]').get_attribute('data-step-count'))
    with tempfile.TemporaryDirectory() as tmp:
        tmp = pathlib.Path(tmp)
        keys = []
        for n in range(steps + 1):
            p = tmp / f'step-{n}.png'
            shoot(page, f'{html.as_uri()}?motion=step&step={n}', p, fade_only=True)
            keys.append(Image.open(p).convert('RGB'))
        frames, durations = [], []
        for n, image in enumerate(keys):
            if n:
                for k in range(1, FADE_FRAMES + 1):
                    frames.append(Image.blend(keys[n - 1], image, k / (FADE_FRAMES + 1)))
                    durations.append(FADE_MS)
            frames.append(image)
            durations.append(END_HOLD if n == steps else STEP_HOLD)
        listing = []
        for i, (frame, duration) in enumerate(zip(frames, durations)):
            frame.save(tmp / f'f{i:03d}.png')
            listing += [f"file 'f{i:03d}.png'", f'duration {duration}']
        listing.append(f"file 'f{len(frames) - 1:03d}.png'")
        (tmp / 'frames.txt').write_text('\n'.join(listing) + '\n')
        subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', 'frames.txt',
                        '-vf', 'scale=1280:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=96:stats_mode=full[p];[b][p]paletteuse=dither=none',
                        '-loop', '0', str(out)], cwd=tmp, check=True)


def main():
    OUT.mkdir(exist_ok=True)
    channel = os.environ.get('PLAYWRIGHT_CHANNEL')
    with sync_playwright() as pw:
        browser = pw.chromium.launch(channel=channel) if channel else pw.chromium.launch()
        sharp = browser.new_page(device_scale_factor=2, viewport={'width': 1440, 'height': 1000})
        plain = browser.new_page(device_scale_factor=1, viewport={'width': 1440, 'height': 1000})
        for html in sorted(HERE.glob('*.html')):
            if html.stem.endswith('-animated'):
                target = OUT / f'{html.stem.removesuffix("-animated")}.gif'
                gif(plain, html, target)
            else:
                target = OUT / f'{html.stem}.png'
                shoot(sharp, html.as_uri(), target)
            print(f'{target.relative_to(HERE.parent.parent)}  {target.stat().st_size // 1024} KB')
        browser.close()


if __name__ == '__main__':
    main()
