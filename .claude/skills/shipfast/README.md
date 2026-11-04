# ShipFast

An agent skill that takes any mobile app from source to a Google Play and/or App Store submission: Flutter, Expo, React Native, Capacitor, native Android or native iOS.

```text
/shipfast launch Android app on Play Store
/shipfast launch ios
/shipfast images ios          # only the App Store screenshots + Header / Search Results images
/shipfast icon                # design and render the app icon
/shipfast resume              # continue from the saved state
```

What the agent does, with local scripts only (no external image API or key):

- Detects the stack, app ID and version; builds and verifies the signed release (AAB/APK, IPA).
- Plans first-launch gates such as Google Play's 12-tester / 14-day closed test for new personal accounts.
- Prepares and verifies the review account.
- Designs 3 app icon concepts as SVG, shows a masked comparison sheet, renders iOS 1024px and Play 512px icons.
- Turns real-device captures into store images:
  - Google Play: phone screenshots 1080×1920, feature graphic 1024×500
  - App Store: iPhone screenshots (default 1320×2868), Product Page Header 3840×1646 (21:9), Search Results 3840×2560 (3:2), universal 5244×2950 (16:9)
- Drafts listing text within each store's limits and a privacy policy from code evidence.
- Fills data safety / App Privacy and other declarations from code and runtime evidence, then uploads, saves and submits within the scope you give it, tracking every item in `.shipfast/`.

See [SKILL.md](SKILL.md) for the procedure, and the [Android walkthrough](https://github.com/tangible-idea/ShipFast/blob/main/docs/use-case-android.md) for diagrams and real example output.

## Install

```sh
# Current project (./.claude/skills/shipfast), for Claude Code
npx skills add tangible-idea/ShipFast --skill shipfast -a claude-code

# All your projects
npx skills add tangible-idea/ShipFast --skill shipfast -a claude-code -g

# Every supported agent, no prompts
npx skills add tangible-idea/ShipFast --skill shipfast -a '*' -y

# Just list what the repository offers
npx skills add tangible-idea/ShipFast --list
```

Then install the renderer dependency (`sharp`) once in the installed folder:

```sh
npm install --prefix .claude/skills/shipfast          # project install
npm install --prefix ~/.claude/skills/shipfast        # global install (-g)
```

Requirements: Node.js 20+. Your app's own toolchain (Flutter, Android SDK, Xcode, EAS, ...) for builds. `adb` for Android captures; a real iPhone with TestFlight for iOS captures. Non-Latin captions need a matching font installed (for example Noto Sans CJK).

## Update and remove

```sh
npx skills check
npx skills update shipfast
npx skills remove shipfast            # add -g for a global install
```

Run `npm install --prefix <skill folder>` again after an update if `package.json` changed.

## Run the renderers directly

```sh
node <skill>/scripts/render-app-icons.mjs --sheet a.svg b.svg c.svg --out icon-sheet.png
node <skill>/scripts/render-app-icons.mjs --final b.svg --out icons
node <skill>/scripts/render-play-assets.mjs --config .shipfast/play-assets.json
node <skill>/scripts/render-app-store-assets.mjs --config .shipfast/app-store-assets.json --guides
```

Start from the config examples in [templates/](templates/). Inputs must be reviewed real-device captures marked `reviewedForPublicUse: true`.

## Contents

| Path | Purpose |
| --- | --- |
| `SKILL.md` | Entry: arguments, launch flow, scope, verification and status rules |
| `references/frameworks.md` | Stack detection and release build/verify commands |
| `references/google-play.md` | Google Play procedure, first-launch gates, observed Console failure modes |
| `references/app-store.md` | App Store procedure and Header/Search Results specs |
| `references/store-listing.md` | Store text limits, required URLs, privacy policy drafting |
| `scripts/render-app-icons.mjs` | Icon comparison sheet and iOS/Play icons from SVG |
| `scripts/render-play-assets.mjs` | Google Play screenshots and feature graphic |
| `scripts/render-app-store-assets.mjs` | iPhone screenshots and App Store Header/Search/universal images |
| `templates/` | Renderer configs and secret-free release state templates |

The scripts never upload or submit anything. Store uploads, saves and submission are done by the agent in the store console within the scope you approve, and each is verified separately.
