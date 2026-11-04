# Google Play: first release and resuming interrupted work

Detailed Google Play reference for the [shipfast skill](../SKILL.md). Built from real first-release work and kept free of app-specific answers. Re-check policies, screens and specs in Play Console and the official docs at the time of work.

- Secret-free structure for resuming: [state template](../templates/google-play-release-state.example.json)
- Build commands per stack: [frameworks.md](frameworks.md)
- Listing text and privacy policy: [store-listing.md](store-listing.md)

## 0. Developer account and app record (first launch only)

- A Play Console developer account needs a one-time registration fee and identity verification. Choose personal or organization type deliberately; organization accounts need a D-U-N-S number. Creating or paying for an account is the user's decision.
- **Closed-test gate:** personal accounts created after 2023-11-13 must run a closed test with at least 12 testers opted in continuously for the last 14 days before they can apply for production access ([Play Console Help](https://support.google.com/googleplay/android-developer/answer/14151465)). Production stays locked until then. Start the closed test as soon as a signed build exists, record the start date and tester count in the state file, and report the earliest production date to the user. Organization accounts are exempt.
- Create the app (name, default language, app or game, free or paid). Free → paid cannot be changed later.
- New apps use Play App Signing: Google holds the app signing key and you sign uploads with an upload key. Keep the upload keystore and its passwords in `.shipfast/secrets/` or the user's password manager, never in Git.

## 1. Align the target and existing state first

The Google account index in Console URLs (`/u/<number>/`) can change between sign-in sessions. Confirm the developer and app identifiers and the real package name. Do not confuse the customer app with the admin app in a monorepo.

Values to confirm when a record already exists:

- Console app name and package, source subfolder and `applicationId`.
- Actual release track, existing version codes, draft releases, countries/regions.
- Whether the upload certificate matches the local signing certificate.
- Previous work records, generated artifacts, and the review account's creation, password change and sign-in verification status.
- Declarations and listing currently saved in the Console. Do not judge completion from checkmarks in local documents alone.

Uploads and review submission covered by the user's existing release instruction continue within that scope. Do not ask for the same approval again at every step. Decide whether separate decisions, such as expanding countries, replacing an existing key or deleting production data, are covered by the existing instruction. Never fill in credential errors or unclear data-handling facts with guesses.

## 2. Verify the signed release file and app execution separately

Build and verify with the commands for the project's stack in [frameworks.md](frameworks.md). Follow the project's actual build configuration (flavors, environment files, build-time defines) for production. Passing signature verification does not prove the correct upload key; compare the certificate fingerprint with the upload certificate in Play Console. Also check for release configs that silently fall back to debug signing.

Record the package, version name/code, target SDK, AAB size and SHA-256, certificate fingerprint, required native library alignment and merged manifest. Do not hardcode dates for target API and page-size requirements; check the current official criteria.

The APK is what installs on a device; the AAB is what goes to the Console. Record that both files come from the same release config and source. A successful APK run is not evidence of a successful AAB upload.

## 3. Make the review account actually usable

First check whether a review account already exists, and do not create duplicates. For organization-only apps, do not verify admin features with a regular user account.

1. Create the review account through an approved admin screen or API.
2. If the account requires an initial password change, complete it.
3. Sign in again with the new password and confirm the actual role and permissions.
4. Confirm sign-in and the main menus in the Android release APK you will submit.
5. Enter the account and English instructions in the Console's `Sign-in details` (formerly `App access`).
6. Distinguish the modal's `Add` from the outer page's `Save`, and re-read after saving.

In this UI the additional instructions were limited to 500 characters. Check save-failure messages and the character count. Read each checkbox's current value and set it to the required value; clicking blindly can uncheck an already checked item.

Never leave review passwords, sessions, tokens, keystores or signing passwords in Git, progress documents, screenshots or general logs. Use a per-app local private file excluded from Git (mode 600), and record in state documents only that the secret file exists plus the verification results. Pass passwords via stdin when the input tool supports it. Credential values may also appear in the accessibility tree after input, so do not print or share the full tree.

## 4. Real-device screenshots and feature graphic

When real-device capture is requested, do not substitute emulator screens as the final result. Record the Android device model, serial, capture resolution and APK version, and pass `-s <serial>` to every ADB command when multiple devices are connected.

```sh
adb devices -l
adb -s <serial> shell wm size
adb -s <serial> install -r <release-apk>
adb -s <serial> shell am start -n <package>/.MainActivity
adb -s <serial> exec-out screencap -p > <private-capture-path>.png
```

If `install -r` fails with a signature mismatch, do not immediately uninstall the existing app. Reinstalling in a way that affects existing data is a separate decision. Before changing resolution or similar settings, record both the physical values and any existing override, and restore the previous settings after capture. Running `wm size reset` unconditionally on a device that had an override loses the original setting. A capture right after a settings change may be a stale frame, so re-check the actual image size and screen.

Review raw captures in a private folder. Keep real people's names, contacts, emails, locations, payment details, door or access codes and tokens out of public assets. Choose safe screens or use real demo data. Do not arbitrarily alter production data to avoid sensitive content.

- Phone screenshots: use real screens from the submitted APK. This Console showed 2–8 images, PNG/JPEG, up to 8 MB each, 16:9 or 9:16, sides 320–3,840 px. Re-check in the current UI.
- Feature graphic: may combine real captures with the existing logo and brand colors. This Console showed 1024×500 PNG/JPEG, up to 15 MB. Its purpose differs from screenshots.
- App icon: this Console showed 512×512 PNG/JPEG, up to 1 MB.
- Capture tablet screens with the actual tablet layout. Do not stretch phone screens as a substitute.

Do not submit app UI redrawn by a generative model as if it were a real screen. Keep feature graphic copy consistent with current features. Checking a file's specs and sensitive content and uploading, selecting and saving it in the Console are separate verification steps.

### Rebuilding assets from real-device captures

[render-play-assets.mjs](../scripts/render-play-assets.mjs) adds a title and a neutral frame to reviewed captures to produce 1080×1920 phone screenshots and a 1024×500 feature graphic. Copy the [config example](../templates/real-device-assets.example.json) into the app's `.shipfast/` folder and fill in paths, copy and provenance. Input/output paths are relative to the config file. Outputs with the same name are overwritten, so keep raw captures in a separate path.

```sh
node <skill>/scripts/render-play-assets.mjs --config .shipfast/play-assets.json
```

Set `reviewedForPublicUse` to true only after checking each capture yourself. If needed, set `crop: {left, top, width, height}` per screen to exclude the OS status/navigation bars. App content is only scaled uniformly; it is never stretched or redrawn. `icon` is optional and is the path to the app icon (for example the 512px icon from `render-app-icons.mjs`). `feature.headline` is required; `subtitle` and `caption` are optional. Titles are at most two lines. After output, visually check fonts, line overflow, tiny text and confidential information. Non-Latin captions (Korean, Japanese, Chinese, Arabic, ...) need a matching font installed on the machine.

The output `assets-manifest.json` records only publishable device model, app version, source file name/hash, crop and transformation. It does not copy raw images, device serials or credentials. A successful render does not mean the Console registration is complete.

## 5. Content declarations reflect both code and runtime results

For each app, check ads, advertising ID, government, financial, health, content rating, target age, data safety, privacy policy and access restrictions. In monorepos, do not copy one app's features (for example the customer app's payments) into another app's declarations.

For data safety, keep this evidence for each data type:

| Question | Evidence to check |
| --- | --- |
| What is collected | Auth/CRUD payloads, SDK transmissions, release runtime |
| Collected or shared | Compare off-device transmission and service-provider/sharing exemptions with the actual flow |
| Processed ephemerally | Whether server storage, logs and business records actually retain it |
| Required or optional | Whether a real feature lets users decline collection |
| Purpose | Actual use such as app functionality or account management |
| Encrypted in transit | Production API and SDK request paths |
| How accounts are created | Distinguish self sign-up from organization-issued accounts |
| Deletion requests | The form/API/support path that actually delivers the request |

An empty SDK config value does not prove there is no transmission. In real releases, initializing a push SDK with an empty app ID still produced network requests and error logs containing local identifiers. Equally, avoid concluding that every SDK collection item is active just because the dependency exists. Separately check whether the merged manifest contains the advertising ID permission.

User interaction in the content rating does not only mean chat. Review delivery features such as announcements and homework against the question's scope. IARC computes the final rating, which can differ from the target-age declaration.

If a deletion form only shows a completion screen without sending a request to the server, do not declare it as a real deletion request path. Also confirm the real scope of the public policy and support channel. This document is not a template for auto-filling another app's questionnaire answers.

## 6. Failure modes observed while operating the Console

Use a real browser page-automation tool when available, and follow that environment's computer-use guidance when you need to operate external app windows, menus or file pickers. Check tool/CLI names and browser implementations per environment.

| Observed problem | Handling on the next run |
| --- | --- |
| Action call succeeded but the screen did not change | Separate the tool result from the save/upload result and confirm from fresh state |
| Element numbers changed because of async screen updates | Re-read current state and locate the target by meaning and screen context |
| `Back` exists in both the browser and the form | Narrow to the form/modal scope first; do not decide by first/last regex match |
| Only some options visible in the accessibility tree | Scroll or PageDown, then re-read state. Never guess unobserved row numbers |
| Form behind an initial onboarding modal shows in the tree | Handle the on-screen modal first, then verify form state |
| File picker opens as a separate OS window | Re-list windows to tell the picker from the main window. Do not reuse old window IDs |
| `window_not_focused` and restore also fails | Do not repeat the same call; actually activate the window/check the picker, or use semantic input |
| Scroll call succeeded but nothing scrolled | Check the new screen, then use another supported method. Do not assume movement from a success response |
| Temporary questionnaire values lost after the browser closed | Use supported draft saving, and when resuming check server-saved values first |

The image library can be a sequence of file selection → upload complete → select asset in library → `Add` → save listing. Do not report it reflected in the listing just because a file was chosen in the picker. If you use a local file server, serve only the needed public assets, never the whole project with `.env`, review accounts or signing files.

Temporary regex scripts written while operating the screen are experimental code. Do not promote them to a skill runner as-is unless they handle window switching, duplicate labels, async rendering and form validation errors.

## 7. Submission and resume records

Confirm countries/regions, track and version code, and read the AAB upload result until processing finishes. Resolve release notes, required settings and blocking Console errors, then submit within the scope the user instructed. If a draft release already exists, the create-new-release button may be disabled, so check the existing release.

Record these states distinctly:

`prepared` → `local_verified` → `console_saved` → `submitted` → `approved` → `public`

Not every item goes through every state. For failed or stalled items, record the last check time, the actual screen/message and the next action. Do not mark a user's actual publish request complete with only a plan or local preparation. Report Google review pending separately from submission complete.

Resume records include app/version/certificate/artifact hash/account verification/declaration save status/asset selection status/track/countries/review submission, but no secrets. Do not merge local preparation results and Console results into the same completion check.

## Official references

- [Store listing](https://support.google.com/googleplay/android-developer/answer/9859152)
- [Graphic assets and screenshots](https://support.google.com/googleplay/android-developer/answer/9866151)
- [Data safety](https://support.google.com/googleplay/android-developer/answer/10787469)
- [Account deletion requirements](https://support.google.com/googleplay/android-developer/answer/13327111)
- [Target API requirements](https://support.google.com/googleplay/android-developer/answer/11926878)
- [Testing requirements for new personal accounts](https://support.google.com/googleplay/android-developer/answer/14151465)
