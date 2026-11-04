#!/usr/bin/env python3
"""Build the ShipFast README diagrams as diagram-design HTML (light + dark).

Follows the diagram-design skill (https://github.com/cathrynlavery/diagram-design):
default editorial skin, slide-16x9 presentation type ramp, 4px grid, orthogonal
r=8 connectors, masked arrow labels, at most two accent elements per diagram.
Animated variants copy the skill's motion template controller verbatim.

    python3 docs/diagrams/build.py      # writes docs/diagrams/*.html
    python3 docs/diagrams/export.py     # writes docs/assets/*.png and *.gif
"""
from __future__ import annotations

import math
import os
import pathlib
import re

HERE = pathlib.Path(__file__).resolve().parent
SKILL = pathlib.Path(os.environ.get('DIAGRAM_DESIGN', pathlib.Path.home() / '.claude/skills/diagram-design'))

SKINS = {
    'light': dict(paper='#f5f5f5', paper2='#ececec', ink='#2d3142', muted='#4f5d75', soft='#5a6580',
                  accent='#bf4520', link='#2e5aa8', node='#ffffff', ink_rgb='45,49,66', muted_rgb='79,93,117',
                  accent_rgb='191,69,32', tint=0.08),
    'dark': dict(paper='#2d3142', paper2='#393e53', ink='#f5f5f5', muted='#bfc0c0', soft='#949eb2',
                 accent='#f08a59', link='#739fdf', node='#393e53', ink_rgb='245,245,245', muted_rgb='191,192,192',
                 accent_rgb='240,138,89', tint=0.10),
}
SANS = "Geist, system-ui, sans-serif"
MONO = "'Geist Mono', ui-monospace, monospace"
# Presentation ramp (output-spec.md): name 16, sublabel 12, arrow label 12, eyebrow 8.
NAME, SUB, ARROW, EYEBROW = 16, 12, 12, 8


def up4(v: float) -> int:
    return int(math.ceil(v / 4) * 4)


def label_width(text: str, size: int = ARROW, tracking: float = 0.06) -> int:
    # style-guide width budget: 0.62em per mono character, plus tracking and 6px padding each side.
    return up4(len(text) * size * (0.62 + tracking) + 12)


def esc(s: str) -> str:
    return s.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')


def rounded_path(points, r=8):
    d = f'M{points[0][0]} {points[0][1]}'
    for (x0, y0), (x1, y1), (x2, y2) in zip(points, points[1:], points[2:]):
        dx1, dy1 = (x1 > x0) - (x1 < x0), (y1 > y0) - (y1 < y0)
        dx2, dy2 = (x2 > x1) - (x2 < x1), (y2 > y1) - (y2 < y1)
        sweep = 1 if dx1 * dy2 - dy1 * dx2 > 0 else 0
        d += f' L{x1 - dx1 * r} {y1 - dy1 * r} A{r} {r} 0 0 {sweep} {x1 + dx2 * r} {y1 + dy2 * r}'
    return d + f' L{points[-1][0]} {points[-1][1]}'


class Diagram:
    def __init__(self, slug, title, desc, eyebrow, width, height, skin, shift=0):
        # shift trims empty canvas above the content: drawn coordinates move up by `shift`.
        self.slug, self.title, self.desc, self.eyebrow = slug, title, desc, eyebrow
        self.w, self.h, self.t, self.shift = width, height - shift, SKINS[skin], shift
        self.skin = skin
        self.back, self.arrows, self.labels, self.nodes = [], [], [], []

    # Colors by semantic role.
    def ink(self, a):
        return f'rgba({self.t["ink_rgb"]},{a})'

    def treatment(self, kind):
        t = self.t
        return {
            'backend': (t['node'], t['ink'], ''),
            'focal': (f'rgba({t["accent_rgb"]},{t["tint"]})', t['accent'], ''),
            'input': (f'rgba({t["muted_rgb"]},0.10)', t['soft'], ''),
            'store': (self.ink(0.05), t['muted'], ''),
            'optional': (self.ink(0.02), self.ink(0.20 if self.skin == 'light' else 0.30), ' stroke-dasharray="4,3"'),
        }[kind]

    def wrap(self, svg, step):
        return f'<g data-motion-item data-step="{step[0]}" aria-label="{esc(step[1])}">{svg}</g>' if step else svg

    def box(self, x, y, w, h, name, sub=None, kind='backend', tag=None, rx=6, step=None):
        fill, stroke, dash = self.treatment(kind)
        cx = x + w // 2
        s = f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{rx}" fill="{self.t["paper"]}"/>'
        s += f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{rx}" fill="{fill}" stroke="{stroke}" stroke-width="1"{dash}/>'
        if tag:
            tw = label_width(tag, EYEBROW, 0.08)
            tag_color = self.t['muted'] if kind == 'optional' else stroke
            s += (f'<rect x="{x + 8}" y="{y + 8}" width="{tw}" height="12" rx="2" fill="transparent" stroke="{tag_color}" stroke-opacity="0.4" stroke-width="0.8"/>'
                  f'<text x="{x + 8 + tw / 2}" y="{y + 17}" fill="{tag_color}" fill-opacity="0.8" font-size="{EYEBROW}" font-family="{MONO}" text-anchor="middle" letter-spacing="0.08em">{esc(tag)}</text>')
        name_y = y + h // 2 + (6 if tag else 0) + (-2 if sub else 6)
        s += f'<text x="{cx}" y="{name_y}" fill="{self.t["ink"]}" font-size="{NAME}" font-weight="600" font-family="{SANS}" text-anchor="middle">{esc(name)}</text>'
        if sub:
            s += f'<text x="{cx}" y="{name_y + 18}" fill="{self.t["muted"]}" font-size="{SUB}" font-family="{MONO}" text-anchor="middle">{esc(sub)}</text>'
        self.nodes.append(self.wrap(s, step))

    def oval(self, x, y, w, h, name, sub, step=None):
        self.box(x, y, w, h, name, sub, rx=20, step=step)

    def diamond(self, x, y, w, h, lines, kind='backend', step=None):
        fill, stroke, dash = self.treatment(kind)
        cx, cy = x + w // 2, y + h // 2
        pts = f'{cx},{y} {x + w},{cy} {cx},{y + h} {x},{cy}'
        s = f'<polygon points="{pts}" fill="{self.t["paper"]}"/><polygon points="{pts}" fill="{fill}" stroke="{stroke}" stroke-width="1"{dash}/>'
        for i, line in enumerate(lines):
            s += f'<text x="{cx}" y="{cy + 6 - 10 * (len(lines) - 1) + 20 * i}" fill="{self.t["ink"]}" font-size="{NAME}" font-weight="600" font-family="{SANS}" text-anchor="middle">{esc(line)}</text>'
        self.nodes.append(self.wrap(s, step))

    def dot(self, cx, cy, end=False):
        if end:
            self.nodes.append(f'<circle cx="{cx}" cy="{cy}" r="8" fill="{self.t["paper"]}" stroke="{self.t["ink"]}" stroke-width="1"/><circle cx="{cx}" cy="{cy}" r="5" fill="{self.t["ink"]}"/>')
        else:
            self.nodes.append(f'<circle cx="{cx}" cy="{cy}" r="6" fill="{self.t["ink"]}"/>')

    def arrow(self, points, role='muted', dashed=False):
        color = self.t['accent'] if role == 'accent' else self.t['muted']
        marker = f'{self.slug}-arrow-accent' if role == 'accent' else f'{self.slug}-arrow'
        dash = ' stroke-dasharray="5,4"' if dashed else ''
        self.arrows.append(f'<path d="{rounded_path(points)}" fill="none" stroke="{color}" stroke-width="{1.2 if role == "accent" else 1}"{dash} marker-end="url(#{marker})"/>')

    def label(self, text, x, y, side='above'):
        """Masked arrow label: 'above' a horizontal segment at y centered on x, or 'right'/'left' of a vertical one at x."""
        w = label_width(text)
        if side == 'above':
            rx, ry, tx, ty = x - w / 2, y - 24, x, y - 12
        elif side == 'right':
            rx, ry, tx, ty = x + 8, y - 8, x + 8 + w / 2, y + 4
        else:
            rx, ry, tx, ty = x - 8 - w, y - 8, x - 8 - w / 2, y + 4
        self.labels.append(f'<rect x="{rx}" y="{ry}" width="{w}" height="16" rx="2" fill="{self.t["paper"]}"/>'
                           f'<text x="{tx}" y="{ty}" fill="{self.t["soft"]}" font-size="{ARROW}" font-family="{MONO}" text-anchor="middle" letter-spacing="0.06em">{esc(text)}</text>')

    def lane(self, y, h, name):
        self.back.append(f'<line x1="40" y1="{y}" x2="{self.w - 40}" y2="{y}" stroke="{self.ink(0.12)}" stroke-width="1"/>'
                         f'<text x="40" y="{y + 28}" fill="{self.t["muted"]}" font-size="{EYEBROW}" font-weight="500" font-family="{MONO}" letter-spacing="0.18em">{esc(name)}</text>')
        self.back.append(f'<line x1="40" y1="{y + h}" x2="{self.w - 40}" y2="{y + h}" stroke="{self.ink(0.12)}" stroke-width="1"/>')

    def legend(self, y, items, rule=True):
        t = self.t
        s = (f'<line x1="40" y1="{y - 8}" x2="{self.w - 40}" y2="{y - 8}" stroke="{self.ink(0.10)}" stroke-width="0.8"/>' if rule else '')
        s += (f'<text x="40" y="{y + 20}" fill="{t["muted"]}" font-size="{EYEBROW}" font-family="{MONO}" letter-spacing="0.14em">LEGEND</text>')
        x = 128
        for kind, text in items:
            if kind == 'arrow-dashed':
                s += f'<line x1="{x}" y1="{y + 16}" x2="{x + 28}" y2="{y + 16}" stroke="{t["muted"]}" stroke-dasharray="5,4"/>'
            elif kind == 'arrow-accent':
                s += f'<line x1="{x}" y1="{y + 16}" x2="{x + 28}" y2="{y + 16}" stroke="{t["accent"]}" stroke-width="1.2"/>'
            elif kind == 'tag':
                s += f'<rect x="{x}" y="{y + 10}" width="28" height="12" rx="2" fill="transparent" stroke="{t["ink"]}" stroke-opacity="0.4" stroke-width="0.8"/>'
            else:
                fill, stroke, dash = self.treatment(kind)
                s += f'<rect x="{x}" y="{y + 8}" width="28" height="16" rx="4" fill="{fill}" stroke="{stroke}"{dash}/>'
            s += f'<text x="{x + 40}" y="{y + 20}" fill="{t["muted"]}" font-size="{SUB}" font-family="{MONO}">{esc(text)}</text>'
            x += 40 + up4(len(text) * SUB * 0.62) + 48
        self.back.append(s)

    def svg(self):
        t, slug = self.t, f'{self.slug}{"-dark" if self.skin == "dark" else ""}'
        markers = ''.join(f'<marker id="{self.slug}-{m}" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto"><polygon points="0 0, 8 3, 0 6" fill="{c}"/></marker>'
                          for m, c in (('arrow', t['muted']), ('arrow-accent', t['accent']), ('arrow-link', t['link'])))
        body = ''.join(self.back + self.arrows + self.labels + self.nodes)
        if self.shift:
            body = f'<g transform="translate(0 {-self.shift})">{body}</g>'
        return (f'<svg viewBox="0 0 {self.w} {self.h}" xmlns="http://www.w3.org/2000/svg" role="img" aria-labelledby="{slug}-title {slug}-desc">'
                f'<title id="{slug}-title">{esc(self.title)}</title><desc id="{slug}-desc">{esc(self.desc)}</desc>'
                f'<defs>{markers}</defs><rect width="100%" height="100%" fill="{t["paper"]}"/>{body}</svg>')


FONTS = '<link href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Geist:wght@400;500;600&family=Geist+Mono:wght@400;500;600&display=swap" rel="stylesheet">'


def static_html(d: Diagram) -> str:
    t = d.t
    return f'''<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{esc(d.title)}</title>
  {FONTS}
  <style>
    *, *::before, *::after {{ box-sizing: border-box; margin: 0; padding: 0; }}
    :root {{ --color-paper: {t["paper"]}; --color-ink: {t["ink"]}; --color-muted: {t["muted"]};
      --font-sans: 'Geist', system-ui, sans-serif; --font-serif: 'Instrument Serif', 'Noto Serif', serif; --font-mono: 'Geist Mono', ui-monospace, monospace; }}
    body {{ font-family: var(--font-sans); background: var(--color-paper); color: var(--color-ink); min-height: 100vh;
      display: flex; align-items: center; justify-content: center; padding: 3rem 2rem; }}
    .frame {{ max-width: {d.w + 40}px; width: 100%; }}
    .diagram-container {{ width: 100%; overflow-x: auto; }}
    .eyebrow {{ font-family: var(--font-mono); font-size: 0.66rem; font-weight: 500; letter-spacing: 0.18em; text-transform: uppercase; color: var(--color-muted); margin-bottom: 0.5rem; }}
    h1 {{ font-family: var(--font-serif); font-size: clamp(1.5rem, 2.4vw + 0.75rem, 2rem); font-weight: 400; letter-spacing: -0.02em; line-height: 1.15; margin-bottom: 1.5rem; }}
    svg {{ width: 100%; min-width: {d.w}px; display: block; }}
    @media print {{ .diagram-container {{ overflow-x: visible; }} svg {{ min-width: 0; }} }}
  </style>
</head>
<body>
  <div class="frame">
    <p class="eyebrow">{esc(d.eyebrow)} · ShipFast</p>
    <h1>{esc(d.title)}</h1>
    <div class="diagram-container">
      {d.svg()}
    </div>
  </div>
</body>
</html>
'''


def motion_html(d: Diagram, steps: int) -> str:
    """Reuse diagram-design's motion template: its CSS and controller stay verbatim."""
    template = (SKILL / 'assets/template-motion.html').read_text()
    t = d.t
    main = f'''<main data-motion-root data-motion-mode="step" data-step-count="{steps}" data-step-current="{steps}" data-frame="static" data-static-frame="complete">
    <p class="eyebrow">{esc(d.eyebrow)} · ShipFast</p>
    <h1>{esc(d.title)}</h1>

    <div class="diagram-container">
      {d.svg()}
    </div>

    <div data-motion-controls role="group" aria-label="Diagram playback controls">
      <button type="button" data-motion-action="prev">Previous</button>
      <button type="button" data-motion-action="play" aria-pressed="false">Play</button>
      <button type="button" data-motion-action="pause" aria-pressed="true">Pause</button>
      <button type="button" data-motion-action="next">Next</button>
      <button type="button" data-motion-action="replay">Replay</button>
      <span class="keyboard-help">←/→ step · Space play/pause · R replay · Home/End jump</span>
      <span data-motion-status-visible aria-hidden="true">Step <span data-motion-step-label>{steps}</span> of {steps}</span>
    </div>
    <p class="sr-only" data-motion-status role="status" aria-live="polite" aria-atomic="true"></p>
    <noscript><p>Animation controls require JavaScript. The complete final diagram is shown above.</p></noscript>
  </main>'''
    html = re.sub(r'<main data-motion-root.*?</main>', lambda _: main, template, flags=re.S)
    html = html.replace('<title>Motion diagram template</title>', f'<title>{esc(d.title)}</title>')
    html = html.replace('<!-- Replace template-motion in IDs and prose when copying this file. -->\n', '')
    html = html.replace('[data-motion-root] { width: min(100%, 1000px); }', f'[data-motion-root] {{ width: min(100%, {d.w + 40}px); }}')
    html = html.replace('svg { display: block; width: 100%; min-width: 960px; }', f'svg {{ display: block; width: 100%; min-width: {d.w}px; }}')
    for var, key in (('paper', 'paper'), ('ink', 'ink'), ('muted', 'muted'), ('soft', 'soft'), ('accent', 'accent')):
        html = re.sub(rf'--color-{var}: #[0-9a-f]+;', f'--color-{var}: {t[key]};', html, count=1)
    html = html.replace('--color-rule: rgba(45,49,66,0.12);', f'--color-rule: {d.ink(0.12)};')
    return html


# ---------------------------------------------------------------- diagrams

def launch_flow(skin):
    d = Diagram('launch-flow', '/shipfast launch, end to end',
                'Flowchart of a ShipFast launch: detect the app, build and verify a signed release, run it on a real phone, prepare the store listing kit, then save and re-read every Play Console section before reporting; new personal accounts also run a closed test that unlocks production.',
                'Flowchart', 1280, 720, skin, shift=64)
    d.arrow([(200, 168), (240, 168)])
    d.arrow([(440, 168), (480, 168)])
    d.arrow([(680, 168), (720, 168)])
    d.arrow([(920, 168), (960, 168)])
    d.arrow([(1080, 208), (1080, 328)]); d.label('FILL + SAVE', 1080, 268, 'right')
    d.arrow([(580, 208), (580, 328)], dashed=True); d.label('IF PERSONAL', 580, 268, 'right')
    d.arrow([(680, 368), (960, 368)], dashed=True); d.label('UNLOCKS PROD', 820, 368)
    d.arrow([(1080, 408), (1080, 528)], role='accent'); d.label('RE-READ', 1080, 468, 'right')
    d.oval(40, 132, 160, 72, 'Request', '/shipfast launch', step=(1, 'Step 1: you ask for a launch'))
    d.box(240, 128, 200, 80, 'Detect the app', 'applicationId · version', tag='AUTO', step=(2, 'Step 2: detect the app'))
    d.box(480, 128, 200, 80, 'Signed release', 'AAB + APK · SHA-256', tag='AUTO', step=(3, 'Step 3: build and verify'))
    d.box(480, 328, 200, 80, 'Closed test', '12 testers × 14 days', kind='optional', tag='ASKS YOU', step=(4, 'Step 4: start the closed test early'))
    d.box(720, 128, 200, 80, 'Real-device run', 'adb install · sign in', tag='AUTO', step=(5, 'Step 5: run the release build on a phone'))
    d.box(960, 128, 240, 80, 'Store listing kit', 'icon · images · text · policy', tag='ASKS YOU', step=(6, 'Step 6: icon, images, text and privacy policy'))
    d.box(960, 328, 240, 80, 'Play Console', 'save → re-read → submit', kind='focal', tag='AUTO', step=(7, 'Step 7: save and re-read every section'))
    d.oval(980, 528, 200, 72, 'Report', 'done · waiting · blocked', step=(8, 'Step 8: report what is done, waiting and blocked'))
    d.legend(660, [('backend', 'Step'), ('optional', 'Gate'), ('focal', 'Verified in console')])
    return d, 8


def who_does_what(skin):
    d = Diagram('who-does-what', 'Who does what',
                'Swimlane of a ShipFast launch across you, the agent and the store console: you ask and later choose and confirm the kit; the agent builds, renders, fills and re-reads; the store runs the closed test and the review.',
                'Swimlane', 1280, 720, skin)
    d.lane(40, 200, 'YOU'); d.lane(240, 200, 'AGENT'); d.lane(440, 200, 'STORE CONSOLE')
    d.arrow([(372, 140), (494, 140), (494, 300)])
    d.arrow([(584, 340), (616, 340)])
    d.arrow([(494, 380), (494, 540), (616, 540)], dashed=True)
    d.arrow([(706, 300), (706, 140), (828, 140)]); d.label('PREVIEW', 706, 212, 'right')
    d.arrow([(918, 180), (918, 340), (1040, 340)], role='accent'); d.label('APPROVED', 918, 260, 'right')
    d.arrow([(1130, 380), (1130, 500)]); d.label('SUBMIT', 1130, 472, 'right')
    d.arrow([(796, 540), (1040, 540)], dashed=True); d.label('UNLOCKS PROD', 918, 540)
    d.arrow([(1130, 300), (1130, 180)]); d.label('STATUS', 1130, 204, 'right')
    d.box(192, 100, 180, 80, 'Ask', '/shipfast launch')
    d.box(404, 300, 180, 80, 'Detect + build', 'AAB · SHA-256')
    d.box(616, 300, 180, 80, 'Render the kit', 'icon · images · policy')
    d.box(616, 500, 180, 80, 'Closed test', '12 × 14 days', kind='optional')
    d.box(828, 100, 180, 80, 'Choose + confirm', 'icon · captures · text', kind='focal')
    d.box(1040, 300, 180, 80, 'Fill + re-read', 'every section')
    d.box(1040, 500, 180, 80, 'Review', 'store decides')
    d.box(1040, 100, 180, 80, 'Status report', 'done · blocked · next')
    d.legend(660, [('backend', 'Step'), ('optional', 'Gate'), ('focal', 'Your decision')], rule=False)
    return d, 0


def store_images(skin):
    d = Diagram('store-images', 'How store images are made',
                'Flowchart of the image pipeline: a release build on a real phone is captured, you check the capture is safe to publish or recapture with demo data, the renderer crops, scales and captions it into Google Play and App Store images, and they are uploaded, saved and re-read in the store console.',
                'Flowchart', 1280, 640, skin, shift=64)
    d.arrow([(200, 240), (240, 240)])
    d.arrow([(400, 240), (440, 240)])
    d.arrow([(600, 240), (640, 240)], role='accent'); d.label('YES', 620, 240)
    d.arrow([(520, 296), (520, 400)]); d.label('NO', 520, 348, 'right')
    d.arrow([(440, 440), (120, 440), (120, 280)])
    d.arrow([(840, 224), (856, 224), (856, 160), (880, 160)])
    d.arrow([(840, 256), (868, 256), (868, 320), (880, 320)])
    d.arrow([(1080, 160), (1120, 160), (1120, 520), (1080, 520)])
    d.arrow([(980, 360), (980, 480)])
    d.box(40, 200, 160, 80, 'Release build', 'real phone · adb', kind='input', step=(1, 'Step 1: release build on a real phone'))
    d.box(240, 200, 160, 80, 'Raw capture', '.shipfast/captures', kind='store', step=(2, 'Step 2: raw capture kept private'))
    d.diamond(440, 184, 160, 112, ['Safe to', 'publish?'], step=(3, 'Step 3: you check for personal data'))
    d.box(440, 400, 160, 80, 'Recapture', 'with demo data', step=(4, 'Step 4: otherwise recapture with demo data'))
    d.box(640, 200, 200, 80, 'Renderer', 'crop · scale · caption', kind='focal', step=(5, 'Step 5: renderer crops, scales and captions'))
    d.box(880, 120, 200, 80, 'Google Play', '1080×1920 · 1024×500', step=(6, 'Step 6: Google Play and App Store images'))
    d.box(880, 280, 200, 80, 'App Store', '1320×2868 · 21:9 · 3:2', step=(6, 'Step 6: Google Play and App Store images'))
    d.box(880, 480, 200, 80, 'Store console', 'upload · save · re-read', step=(7, 'Step 7: upload, save and re-read'))
    d.legend(596, [('input', 'Device'), ('store', 'Private file'), ('backend', 'Step'), ('focal', 'Renderer')])
    return d, 7


def privacy_policy(skin):
    d = Diagram('privacy-policy', 'How the privacy policy is made',
                'Flowchart of the privacy policy: code, runtime traffic and backend behavior feed one evidence table, which produces the policy draft; confirmed facts are deployed to Firebase Hosting, unknown ones go back to you, and the same table fills the data safety answers in Play Console.',
                'Flowchart', 1280, 680, skin, shift=96)
    d.arrow([(240, 188), (272, 188), (272, 272), (320, 272)])
    d.arrow([(240, 292), (320, 292)])
    d.arrow([(240, 396), (272, 396), (272, 312), (320, 312)])
    d.arrow([(520, 292), (560, 292)])
    d.arrow([(760, 292), (800, 292)])
    d.arrow([(960, 292), (1000, 292)], role='accent'); d.label('YES', 980, 292)
    d.arrow([(880, 348), (880, 440)]); d.label('NO', 880, 392, 'right')
    d.arrow([(1100, 332), (1100, 520)])
    d.arrow([(420, 332), (420, 560), (1000, 560)]); d.label('DATA SAFETY', 700, 560)
    d.box(40, 156, 200, 64, 'Code', 'deps · fields · API', kind='input')
    d.box(40, 260, 200, 64, 'Runtime traffic', 'release build', kind='input')
    d.box(40, 364, 200, 64, 'Backend', 'retention · deletion', kind='input')
    d.box(320, 252, 200, 80, 'Evidence table', 'data · purpose · who', kind='focal')
    d.box(560, 252, 200, 80, 'Policy draft', 'PRIVACY.<lang>.md')
    d.diamond(800, 236, 160, 112, ['Facts', 'confirmed?'])
    d.box(1000, 252, 200, 80, 'Firebase Hosting', '<app>-legal.web.app')
    d.box(800, 440, 160, 64, 'Ask you', 'never guessed', kind='optional')
    d.box(1000, 520, 200, 80, 'Play Console', 'URL + data safety')
    d.legend(636, [('input', 'Evidence'), ('backend', 'Step'), ('optional', 'Blocked'), ('focal', 'Single source')])
    return d, 0


def item_states(skin):
    d = Diagram('item-states', 'Every item is tracked to the console',
                'State machine of a ShipFast item: prepared, locally verified, saved and re-read in the console, submitted, approved and public; a missing fact moves it to blocked until you answer.',
                'State machine', 1280, 560, skin, shift=88)
    d.arrow([(62, 172), (96, 172)])
    d.arrow([(256, 172), (336, 172)]); d.label('CHECKED', 296, 172)
    d.arrow([(496, 172), (576, 172)], role='accent'); d.label('RE-READ', 536, 172)
    d.arrow([(736, 172), (816, 172)]); d.label('SENT', 776, 172)
    d.arrow([(976, 172), (1056, 172)]); d.label('PASSED', 1016, 172)
    d.arrow([(1136, 204), (1136, 380)]); d.label('RELEASE', 1136, 292, 'right')
    d.arrow([(148, 204), (148, 380)], dashed=True); d.label('MISSING', 148, 292, 'left')
    d.arrow([(204, 380), (204, 204)], dashed=True); d.label('ANSWER', 204, 292, 'right')
    d.arrow([(1056, 412), (1008, 412)])
    d.dot(56, 172)
    d.box(96, 140, 160, 64, 'Prepared', 'prepared', rx=8)
    d.box(336, 140, 160, 64, 'Verified', 'local_verified', rx=8)
    d.box(576, 140, 160, 64, 'Saved', 'console_saved', kind='focal', rx=8)
    d.box(816, 140, 160, 64, 'Submitted', 'submitted', rx=8)
    d.box(1056, 140, 160, 64, 'Approved', 'approved', rx=8)
    d.box(1056, 380, 160, 64, 'Public', 'public', rx=8)
    d.box(96, 380, 160, 64, 'Blocked', 'blocked', kind='optional', rx=8)
    d.dot(1000, 412, end=True)
    d.legend(500, [('backend', 'State'), ('focal', 'Saved means re-read'), ('optional', 'Waiting on you')])
    return d, 0


DIAGRAMS = [launch_flow, who_does_what, store_images, privacy_policy, item_states]


def main():
    for make in DIAGRAMS:
        for skin in SKINS:
            d, steps = make(skin)
            suffix = '' if skin == 'light' else '-dark'
            (HERE / f'{d.slug}{suffix}.html').write_text(static_html(d))
            if steps:
                (HERE / f'{d.slug}{suffix}-animated.html').write_text(motion_html(d, steps))
            print(f'{d.slug}{suffix}')


if __name__ == '__main__':
    main()
