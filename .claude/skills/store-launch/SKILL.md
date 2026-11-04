---
name: store-launch
description: Prepare or resume a first store release of a mobile app on Google Play and/or the Apple App Store - identify the exact app and package/bundle, verify signed builds, prepare a working review account, capture real-device screenshots, render store assets (Play phone screenshots + feature graphic; iPhone screenshots + App Store Product Page Header 21:9, Search Results 3:2 and universal 16:9 creative), fill content/privacy declarations from code evidence, and track Console/App Store Connect state through submission. Use when the user asks to launch or publish an app, register it in a store, work in Play Console or App Store Connect, submit for review, make store screenshots, a feature graphic or Header and Search Results images, or resume a release (also "앱 출시", "스토어 등록", "심사 제출", "스크린샷 만들어").
---

# Store launch

A procedure verified through real release work in Shipframe. Detailed rules live in the platform references; this document only sets target identification, state checks, execution scope and verification criteria. Re-check store specs and policies in the Console/App Store Connect and official docs at the time of work.

## References

| When | Read |
| --- | --- |
| Google Play work | [references/google-play.md](references/google-play.md) |
| App Store work, iPhone screenshots, Header/Search Results images | [references/app-store.md](references/app-store.md) |
| Real cases and lessons from failures | [ShipFast `docs/release-cases/`](https://github.com/tangible-idea/ShipFast/tree/main/docs/release-cases) |
| Resume state records | [templates/](templates/) (`*-release-state.example.json`) |

## 1. Align the target and state first

1. Cross-check the source root of the app the user specified, the Android `applicationId` / iOS bundle ID, and the store app record. Do not confuse the customer app with the admin app in a monorepo.
2. Look for an earlier state file in the app repository's private, Git-excluded work folder. If none exists, copy a template to create one. Never put per-app secrets or raw captures in the Shipframe repository.
3. Re-read the values actually saved in the Console/App Store Connect, not local records, first.

## 2. Execution scope

- Uploads, saves and review submission covered by the user's release instruction continue within that scope. Do not ask for the same approval again at every step.
- Expanding countries, replacing an existing signing key/certificate, reinstalling in a way that deletes app data, and changing production data are separate decisions. Ask if the instruction does not cover them.
- Never fill in credential errors or unclear data-handling facts with guesses.
- Never leave review passwords, tokens, keystores or certificate passwords in Git, state documents, screenshots or logs (use a private file with mode 600).

## 3. Automatic store asset generation

Sources are screens captured from the submitted build installed on a real device. Do not substitute emulator/simulator captures as final, do not draw app UI with a generative model, and do not stretch phone screens for tablets. Set `reviewedForPublicUse: true` only after looking at each source yourself and confirming it has no customer data, passwords or tokens.

`<skill>` is the folder containing this SKILL.md. The renderers use `sharp`. If `node -e "import('sharp')"` fails in `<skill>`, run `npm install --prefix <skill>` once.

```sh
# Google Play: phoneScreenshots/*.png 1080×1920 + featureGraphic.png 1024×500
node <skill>/scripts/render-play-assets.mjs --config <private>/play-assets.json

# App Store: iphoneScreenshots/*.png (default 1320×2868)
#  + creative/header-3840x1646.png (21:9) + creative/search-3840x2560.png (3:2)
#  + creative/universal-5244x2950.png (16:9, shared by both placements). --guides adds crop previews
node <skill>/scripts/render-app-store-assets.mjs --config <private>/app-store-assets.json --guides
```

Config examples: [templates/real-device-assets.example.json](templates/real-device-assets.example.json), [templates/app-store-assets.example.json](templates/app-store-assets.example.json). Paths are relative to the config file, and outputs with the same name are overwritten.

After rendering, always:

1. Open every output image and check fonts, line overflow, clipped UI and sensitive information. In `previews/universal.png`, confirm the title and key screens sit inside the red (header) and green (search) areas.
2. Check sizes and source hashes in `assets-manifest.json`. The script also verifies sizes and the absence of an alpha channel.
3. A finished render is not a finished store registration. Confirm upload → select/add → save → re-read separately, and check the iPhone and iPad crops of App Store header/search images with the App Store Connect Preview.

## 4. Status reporting

Record each item's state distinctly as `prepared` → `local_verified` → `console_saved` → `submitted` → `approved` → `public`. Do not merge local preparation and store saves into the same completion check. For stalled items, record the last check time, the actual screen/message and the next action. Report review pending separately from submission complete.

When you find a new failure mode or a spec change, add it with evidence to the relevant reference and to ShipFast `docs/release-cases/`.
