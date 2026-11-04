---
name: shipfast
description: Ship any mobile app to Google Play and/or the Apple App Store fast - for Flutter, React Native, Expo, native Android (Gradle) or native iOS (Xcode) projects. Detects the app and platform, verifies signed builds, prepares the review account, designs the app icon, captures real-device screenshots, renders all store images (Play phone screenshots and feature graphic; iPhone screenshots and App Store Product Page Header 21:9, Search Results 3:2 and universal 16:9 images), drafts listing text, checks for a privacy policy and terms of use and offers to generate and auto-upload missing ones to Firebase Hosting, fills data/privacy declarations from code evidence, and tracks Play Console / App Store Connect state through review. Use for requests like "/shipfast launch Android app on Play Store", "/shipfast ios", "publish my app", "submit for review", "make store screenshots", "make an app icon", "Header and Search Results images", or "resume the release".
argument-hint: "[launch|resume|status|icon|screenshots|images|listing|privacy|terms] [android|ios|both] [app path or name]"
---

# ShipFast

Takes any mobile app from source to a store submission. This document sets the flow, the scope and the verification rules; the references hold the per-platform details. Store specs and policies change: re-check them in Play Console / App Store Connect and the official docs at the time of work, and update the references when they differ.

## 1. Read the request

Parse `$ARGUMENTS` (or the user's sentence) into:

| Part | Values | Default |
| --- | --- | --- |
| Action | `launch` (full flow), `resume`, `status`, `icon`, `screenshots`, `images` (store graphics), `listing` (store text), `privacy` / `terms` (section 5a) | `launch` |
| Platform | `android` / Play Store / Google Play, `ios` / App Store / iPhone, `both` | Ask only if the repo builds for both and the request does not say |
| Target | App path or name in the repo | The only app in the repo; ask if there are several |

Examples: `/shipfast launch Android app on Play Store` → launch, android. `/shipfast images ios` → only the App Store images. `/shipfast resume` → read the state file and continue from `nextAction`.

## 2. Identify the project

1. Detect the stack and app root with [references/frameworks.md](references/frameworks.md). In monorepos, list the candidate apps and confirm which one.
2. Read the Android `applicationId` and/or iOS bundle ID, app name, version and build number from the source.
3. State lives in `.shipfast/` at the app root. Add `.shipfast/` to the app's `.gitignore` before writing anything there. Copy [templates/google-play-release-state.example.json](templates/google-play-release-state.example.json) or [templates/app-store-release-state.example.json](templates/app-store-release-state.example.json) to `.shipfast/<platform>-state.json` if missing. Keep raw captures in `.shipfast/captures/` and secrets in `.shipfast/secrets/` (mode 600).
4. **Connect the store console. This is the last start step; ask it before building anything.** Pause and ask the developer for one of:
   - **"I'm signed in"**: they have signed in to [Play Console](https://play.google.com/console) / [App Store Connect](https://appstoreconnect.apple.com) with the developer account in the browser you will use, and tell you so. You then find or create the app record there.
   - **The existing app's console URL**, when the app was already created, for example `https://play.google.com/console/u/0/developer/<developerId>/app/<appId>/app-dashboard` or `https://appstoreconnect.apple.com/apps/<appleId>/distribution`.

   Never ask for the Google or Apple password, and never type it yourself. The developer signs in, and you work in that signed-in session. From a URL, extract the IDs (Play: developer ID and app ID; App Store: Apple ID), open it, and confirm that the package name / bundle ID shown matches the source before going on. A mismatch is a stop: ask which app is meant. Record the URL and IDs in the state file (`target`). If no developer account exists yet, say so and stop at the accounts step (section 3, step 1); creating or paying for one is the developer's decision.
5. If a store record already exists, re-read what is actually saved in the Console / App Store Connect before trusting local state.

## 3. Launch flow

Run the steps in order, skipping ones already verified in the state file. Each step's details are in the platform reference: [references/google-play.md](references/google-play.md), [references/app-store.md](references/app-store.md).

1. **Accounts and app record** - developer account type, app record, package/bundle ID, using the console session or URL from section 2, step 4. On Google Play, new personal accounts must pass a closed test before production; plan for it on day one.
2. **Signed release build** - build with the project's real command, verify signing, record size and SHA-256.
3. **Install and run the release build on a real device** - sign in and walk the main screens.
4. **Review account** - if the app needs sign-in, create a working account, change any initial password, verify sign-in on the release build.
5. **App icon** - section 4.
6. **Screenshots and store images** - section 5.
7. **Listing text, privacy policy and terms of use** - [references/store-listing.md](references/store-listing.md). Section 5a covers checking for existing pages and letting the developer choose Firebase auto-upload.
8. **Declarations** - data safety / App Privacy, content rating, target audience, ads, export compliance, from code and runtime evidence.
9. **Upload, fill, save, submit** - within the scope in section 6, re-reading after every save.
10. **Report** - section 7.

## 4. App icon

The agent designs the icon itself; no external image API is used. Reuse the user's existing logo when there is one.

1. Find the app's purpose and brand color in the source (theme seed colors, launcher icons, README).
2. Write 3 distinct SVG concepts in `.shipfast/icons/`: `viewBox="0 0 1024 1024"`, full-bleed opaque background, one simple centered symbol inside the central ~66%, no small text, no rounded outer corners (stores apply masks), no external references, no other brands' logos.
3. Render a comparison sheet, check masked and small sizes yourself, show it to the user and let them choose.

```sh
node <skill>/scripts/render-app-icons.mjs --sheet a.svg b.svg c.svg --out .shipfast/icons/sheet.png
node <skill>/scripts/render-app-icons.mjs --final b.svg --out .shipfast/icons/final
# → ios-app-icon-1024.png (no alpha), google-play-icon-512.png (≤ 1 MiB), icons-manifest.json
```

Wire the chosen icon into the project too (Android adaptive/launcher icons, iOS `AppIcon` asset catalog) using the stack's usual tool, and rebuild.

## 5. Screenshots and store images

Sources are screens of the release build captured on a real device. Never substitute emulator/simulator frames as final, never draw app UI with a generative model, never stretch phone screens for tablets. Look at every capture and set `reviewedForPublicUse: true` only when it shows no personal data, credentials, tokens or internal information. Use demo data instead of editing production data.

```sh
# Google Play: phoneScreenshots/*.png 1080×1920 + featureGraphic.png 1024×500
node <skill>/scripts/render-play-assets.mjs --config .shipfast/play-assets.json

# App Store: iphoneScreenshots/*.png (default 1320×2868)
#  + creative/header-3840x1646.png (21:9) + creative/search-3840x2560.png (3:2)
#  + creative/universal-5244x2950.png (16:9, both placements). --guides writes crop previews
node <skill>/scripts/render-app-store-assets.mjs --config .shipfast/app-store-assets.json --guides
```

Start from [templates/real-device-assets.example.json](templates/real-device-assets.example.json) and [templates/app-store-assets.example.json](templates/app-store-assets.example.json); paths are relative to the config file. Captions must describe only features visible in the app, in the listing's language (one config per locale).

After rendering, open every output and check fonts, overflow, clipped UI and sensitive content; in `previews/universal.png` the title and key screens must sit inside the red (header) and green (search) areas. A finished render is not a finished upload.

`<skill>` is the folder containing this SKILL.md. The renderers need `sharp`: if `node -e "import('sharp')"` fails in `<skill>`, run `npm install --prefix <skill>` once.

## 5a. Privacy policy and terms of use: check, then let the developer choose

The stores need public URLs: a privacy policy (both stores), support (App Store) and account deletion (when the app has accounts). A terms of use page is needed when the app has accounts, user content or paid features. Apps with auto-renewing subscriptions on the App Store must link a Terms of Use (EULA) in their metadata.

1. **Look for what already exists.** Run `node <skill>/scripts/publish-policy.mjs --scan <app-root>`. It lists privacy and terms URLs found in the app (in-app links, fastlane `privacy_url.txt`, configs, docs), with their HTTP status. Also check the store console's saved privacy URL when a record exists.
2. **Ask the developer, one question per document**, and show what was found:

   | Document | Choices |
   | --- | --- |
   | Privacy policy | **Use the found URL** (only if it returns 200) · **Generate and auto-upload to Firebase Hosting** (recommended when nothing was found) · **I'll give you a URL** |
   | Terms of use | **Use the found URL** · **Generate and auto-upload to Firebase Hosting** · **I'll give you a URL** · **None**: Play has no requirement; on the App Store, Apple's standard EULA applies (with auto-renewing subscriptions, still add a Terms of Use link, which can be Apple's standard EULA, to the app description) |

   A found URL that fails (4xx/5xx, timeout) is reported and never offered as "use". Support and account-deletion pages follow the privacy choice: they are generated with it when auto-upload is chosen.
3. **Only if auto-upload was chosen**, require a Firebase login: run `node <skill>/scripts/publish-policy.mjs --whoami`. If it fails, ask the developer to run `! firebase login` themselves. Never read, print or store Firebase tokens; the script returns only the email.
4. **Propose the identity, then confirm it once.** Show one summary and let the developer edit it:
   - Contact email: the Firebase account email by default. Offer an alias, because it will be public. Never a noreply address.
   - Operator name: the developer name on the Play/App Store account if known, else `git config user.name`. It must match the store developer account (company or person).
   - Governing law / jurisdiction (terms only): ask; never guess.
   - Firebase project: the app's own project (`project_id` in `google-services.json`, `PROJECT_ID` in `GoogleService-Info.plist`, `projectId` in `firebase_options.dart` or `.firebaserc`). Otherwise pick from `firebase projects:list`. Creating a new project is the developer's decision.
   - Site: `<app-slug>-legal` → `https://<app-slug>-legal.web.app/privacy/`, `/terms/`, `/support/`, `/delete-account/`.
5. **Draft, preview and deploy.** Draft the chosen documents from evidence ([references/store-listing.md](references/store-listing.md)). Then write `.shipfast/policy-site.json` from [templates/policy-site.example.json](templates/policy-site.example.json), with only the pages being generated. Run without `--deploy` to build a local preview, then run `--deploy`. The script creates the site if missing and deploys only that site, so the app's own hosting is never touched. It then fetches every URL and checks for the app name, contact email and effective date.
6. **Record and enter.** Store each final URL (found, given or deployed) in the state file's `policySite.urls`. Enter the URLs in the store console and re-read them.

```sh
node <skill>/scripts/publish-policy.mjs --scan .                                       # existing legal URLs
node <skill>/scripts/publish-policy.mjs --whoami                                       # only for auto-upload
node <skill>/scripts/publish-policy.mjs --config .shipfast/policy-site.json            # build + preview
node <skill>/scripts/publish-policy.mjs --config .shipfast/policy-site.json --deploy   # publish + live check
```

Publishing makes the operator name and email public. Get the summary confirmed before the first deploy, even inside a launch request. Later redeploys with only a new effective date or edited text continue within the launch scope.

## 6. Scope and safety

- Uploads, saves and review submission that the user's request covers continue within that scope; do not re-ask at every step.
- Ask before: creating paid accounts or paying fees, expanding countries, replacing signing keys or certificates, reinstalling in a way that deletes app data, changing production data, or choosing a public release over a manual/staged one.
- Never guess credentials or data-handling facts. If unknown, ask or mark the item blocked.
- Never put review passwords, tokens, keystores or certificate passwords in Git, state files, screenshots or logs. Pass secrets via stdin where possible and do not print accessibility trees after typing them.
- Do not copy another app's questionnaire answers. Every declaration needs evidence from this app.

## 7. Status and reporting

Track each item as `prepared` → `local_verified` → `console_saved` → `submitted` → `approved` → `public`. Local preparation and store saves are never the same check. For a stalled item record the last check time, the actual screen or message, and `nextAction`. Report "waiting for review" separately from "submitted", and end with a short table: done, waiting, blocked (with what the user must do).
