# Use case: `/shipfast launch Android app on Play Store`

This walkthrough follows one first launch from start to finish. The app is **Pocket Garden**, a plant-care demo app: a Flutter project, published from a personal Play Console account that was created recently, with no store listing yet.

> The images on this page are real output from the ShipFast renderers. The app screens they start from are synthetic stand-ins made by [`demo/make-demo-captures.mjs`](demo/make-demo-captures.mjs). In a real run, those screens come from `adb exec-out screencap` on a phone running your release build. Never submit mockups to a store.

## 1. The whole run at a glance

```mermaid
flowchart TD
    A["/shipfast launch Android app on Play Store"] --> B[Parse request<br/>action = launch, platform = android]
    B --> C[Detect stack and app<br/>Flutter · com.example.pocketgarden · 1.0.0+1]
    C --> D{.shipfast/ state exists?}
    D -- yes --> R[Resume from nextAction]
    D -- no --> E[Create .shipfast/ and add it to .gitignore]
    E --> F{Play Console account<br/>and app record ready?}
    F -- no --> F1[/Ask you: create account, pay fee,<br/>create app record/]
    F1 --> G
    F -- yes --> G[Build signed AAB + APK<br/>verify certificate and SHA-256]
    G --> H[Install the release APK on your phone<br/>sign in, walk the main screens]
    H --> I{Personal account<br/>created after 2023-11-13?}
    I -- yes --> I1[Start the closed test now<br/>12 testers × 14 days]
    I -- no --> J
    I1 --> J[App icon<br/>3 SVG concepts → you pick one]
    J --> K[Capture real screens → you review → render<br/>phone screenshots + feature graphic]
    K --> L[Draft listing text + privacy policy<br/>from code evidence → you confirm]
    L --> M[Data safety, content rating,<br/>target audience, ads]
    M --> N[Upload, fill, save in Play Console<br/>re-read after every save]
    N --> O{Closed test finished?}
    O -- not yet --> O1[Report the earliest production date<br/>state = waiting]
    O -- yes --> P[Apply for production → submit for review]
    P --> Q[Report: done / waiting / blocked]
    R --> Q
```

## 2. Who does what

```mermaid
sequenceDiagram
    actor You
    participant Agent as Claude + shipfast
    participant Repo as Your repo
    participant Phone as Android phone (adb)
    participant Play as Play Console

    You->>Agent: /shipfast launch Android app on Play Store
    Agent->>Repo: read pubspec.yaml, build.gradle, dependencies
    Agent-->>You: Found Pocket Garden (com.example.pocketgarden). Personal or organization account?
    You->>Agent: Personal, account already paid
    Agent->>Repo: flutter build appbundle / apk --release
    Agent->>Repo: keytool / apksigner: verify upload certificate
    Agent->>Phone: adb install -r app-release.apk, open main screens
    Agent->>Phone: adb exec-out screencap (3 screens)
    Agent-->>You: Here are 3 icon concepts and 3 captures. Pick an icon. Anything private on screen?
    You->>Agent: Icon 1. Captures are fine.
    Agent->>Repo: render icons, screenshots, feature graphic into .shipfast/
    Agent-->>You: Draft listing text and privacy policy. Where will the policy be hosted?
    You->>Agent: https://example.com/privacy
    Agent->>Play: create closed test, upload AAB, fill listing, data safety, content rating
    Agent->>Play: save, then re-read every page
    Agent-->>You: Closed test running since Nov 4. Production unlocks after Nov 18 with 12 testers.
```

## 3. Step by step

| Step | What the agent does | What it asks you | Evidence saved |
| --- | --- | --- | --- |
| Detect | Reads the Flutter, Gradle and manifest files; finds `applicationId`, version, flavors | Which app, if the repo has several | `.shipfast/android-state.json` → `target` |
| Account | Checks the Play Console app record and account type | To create or pay for the account, if needed (never does it alone) | `target.developerAccountType` |
| Build | `flutter build appbundle --release`, `apk --release`; compares the certificate with the upload key | Keystore location, if it isn't configured | AAB size, SHA-256, certificate fingerprint |
| Run | Installs the release APK on your phone and signs in | Test account password (kept in `.shipfast/secrets/`, mode 600) | `reviewAccess.androidLoginVerifiedAt` |
| Closed test | Creates the closed track and adds testers | Tester emails or a Google Group | `closedTest.startedAt`, `optedInTesters` |
| Icon | Designs 3 SVG concepts and renders a masked comparison sheet | Which concept | `icons-manifest.json` with the source hash |
| Images | Captures, crops system bars, renders screenshots and the feature graphic | Confirm every capture is safe to publish | `assets-manifest.json` with source hashes |
| Text | Drafts the name, short description and full description within the limits | Approve or edit | `.shipfast/listing.en-US.md` |
| Privacy | Drafts the policy from dependencies and data flows | Contact email, hosting URL | `.shipfast/privacy/PRIVACY.en.md` |
| Console | Uploads, fills, saves and re-reads each section | Nothing, within the scope you gave | `console_saved` per item |
| Report | Lists what is done, what is waiting and what is blocked | - | `lastVerifiedObservation`, `nextAction` |

## 4. How the store images are made

```mermaid
flowchart LR
    A[Release APK<br/>on a real phone] -->|adb exec-out screencap| B[Raw capture<br/>.shipfast/captures/]
    B --> C{You review:<br/>no personal data,<br/>no tokens?}
    C -- no --> A2[Use demo data,<br/>capture again] --> A
    C -- yes --> D[play-assets.json<br/>title, subtitle, crop,<br/>reviewedForPublicUse: true]
    D --> E[render-play-assets.mjs]
    E --> F[phoneScreenshots/*.png<br/>1080×1920]
    E --> G[featureGraphic.png<br/>1024×500]
    E --> H[assets-manifest.json<br/>source hashes, crops]
    F & G --> I[Agent opens every image:<br/>fonts, overflow, clipping]
    I --> J[Upload → select → save → re-read<br/>in Play Console]
```

**Crop, then frame.** The renderer removes the status bar and navigation bar, scales the real UI uniformly and adds a caption. It never redraws or stretches the app.

![Raw capture cropped and framed into a store screenshot](images/capture-to-screenshot.png)

**Phone screenshots** (3 of the allowed 2–8):

![Three rendered Play Store phone screenshots](images/play-screenshots.png)

**Feature graphic** (1024×500). It shows the app icon, a headline and two of the real screens. Every color comes from `brandColor`:

![Rendered feature graphic](images/feature-graphic.png)

The config behind these images ([full file](demo/play-assets.json)):

```json
{
  "appName": "Pocket Garden",
  "brandColor": "#16a34a",
  "icon": "./out/icons/google-play-icon-512.png",
  "screens": [
    {
      "input": "./captures/plants.png",
      "output": "phoneScreenshots/01-plants.png",
      "title": "Know which plants\nneed water today",
      "subtitle": "One list for every plant you own",
      "crop": {"left": 0, "top": 96, "width": 1080, "height": 2114},
      "reviewedForPublicUse": true
    }
  ],
  "feature": {"screenIndices": [0, 2], "headline": "Never forget to water"}
}
```

## 5. How the app icon is made

```mermaid
flowchart LR
    A[Source: app purpose,<br/>theme color, README] --> B[Agent writes 3 SVGs<br/>1024 viewBox, opaque,<br/>one centered symbol]
    B --> C[render-app-icons.mjs --sheet]
    C --> D[Comparison sheet:<br/>square, iOS mask, circle mask,<br/>120px, 60px]
    D --> E{You pick}
    E -- revise --> B
    E -- pick --> F[render-app-icons.mjs --final]
    F --> G[google-play-icon-512.png ≤ 1 MiB<br/>ios-app-icon-1024.png, no alpha]
    G --> H[Wire into the project<br/>flutter_launcher_icons → rebuild]
```

The sheet shows each concept under real store masks and at small sizes, so legibility problems show up before you choose:

![Icon comparison sheet with three concepts](images/icon-sheet.png)

The script rejects any SVG with transparent pixels or external references, because store masks need a full-bleed opaque square.

## 6. How the privacy policy is made

The policy comes from what the app actually does, not from a template. The same evidence then fills Play's Data safety form, so the two cannot drift apart.

```mermaid
flowchart TD
    subgraph Evidence
      A1[Dependencies<br/>pubspec.lock / build.gradle]
      A2[Sign-up and profile fields<br/>in the UI and API calls]
      A3[Runtime traffic of the release build<br/>analytics, crash, push SDKs]
      A4[Backend retention and<br/>deletion behavior]
    end
    A1 & A2 & A3 & A4 --> B[Evidence table<br/>data type · purpose · shared with · retention]
    B --> C[Draft PRIVACY.en.md<br/>.shipfast/privacy/]
    C --> D{You confirm<br/>contact, retention,<br/>deletion path}
    D -- unknown --> X[Marked blocked,<br/>never guessed]
    D -- confirmed --> E[You publish it at a public URL]
    E --> F[Privacy policy URL in Play Console]
    B --> G[Data safety answers<br/>same evidence]
    F & G --> H[Saved and re-read]
```

Example evidence table for Pocket Garden (illustrative):

| Data | Found in | Purpose | Shared with | Retention |
| --- | --- | --- | --- | --- |
| Email address | Sign-up screen, `POST /users` | Account | Backend host (processor) | Until account deletion |
| Plant names and notes | `POST /plants` | App functionality | Backend host (processor) | Until deleted by user |
| Crash logs, device model | `firebase_crashlytics` in `pubspec.lock`; traffic seen at runtime | Diagnostics | Google (processor) | 90 days |
| Push token | `firebase_messaging`; token registered at startup | Reminders | Google (processor) | Until sign-out |

Excerpt of the draft it produces:

```markdown
## What we collect
- **Email address**, to create and secure your account.
- **Your plants and care notes**, to show reminders and your calendar.
- **Crash reports and device model** (Firebase Crashlytics), to fix bugs.
- **A push notification token** (Firebase Cloud Messaging), to send watering reminders.

## Deleting your data
Settings → Account → Delete account removes your account and plants within 30 days.
You can also email privacy@example.com.
```

Two things the agent checks before it trusts this table. An SDK with an empty configuration can still send traffic, so the table is based on what the release build actually sends. And a deletion screen that never reaches the server is not a deletion path. The agent says the draft is not legal advice.

## 7. The closed-test gate

New personal Play Console accounts cannot publish to production until a closed test has kept 12 testers opted in for the last 14 days in a row. ShipFast starts the test as soon as a signed build exists, so preparing the listing overlaps with the wait:

```mermaid
gantt
    title Pocket Garden: first Android launch (example dates)
    dateFormat YYYY-MM-DD
    axisFormat %b %d
    section Build
    Detect, build, verify          :done, b1, 2026-11-04, 1d
    section Closed test
    12 testers opted in            :active, t1, 2026-11-04, 14d
    Apply for production access    :t2, after t1, 1d
    section Listing
    Icon, screenshots, feature     :l1, 2026-11-05, 2d
    Text, privacy policy           :l2, after l1, 1d
    Data safety, rating, audience  :l3, after l2, 1d
    section Release
    Production review              :r1, after t2, 3d
```

Organization accounts skip this section. The review time shown is only an example; Google decides it.

## 8. What gets tracked

Each item moves through the same states. `/shipfast status` and `/shipfast resume` read them back:

```mermaid
stateDiagram-v2
    [*] --> prepared: file made locally
    prepared --> local_verified: checked (size, hash, visual review)
    local_verified --> console_saved: uploaded, saved, re-read in Play Console
    console_saved --> submitted: sent for review
    submitted --> approved
    approved --> public
    prepared --> blocked: missing fact or credential
    blocked --> prepared: you answer
```

```text
pocket_garden/
└── .shipfast/                 # git-ignored
    ├── android-state.json     # every item's state, hashes, nextAction
    ├── captures/              # raw screenshots (private)
    ├── icons/                 # SVG concepts, sheet, final PNGs
    ├── play-assets.json       # renderer config
    ├── out/                   # rendered store images + manifests
    ├── listing.en-US.md
    ├── privacy/PRIVACY.en.md
    └── secrets/               # mode 600: review account, never committed
```

## What it never does on its own

- Create or pay for developer accounts, or replace signing keys.
- Submit mockups or AI-drawn UI as screenshots, or stretch phone screens for tablets.
- Guess credentials, data-handling facts or questionnaire answers, or copy them from another app.
- Report "done" when a file was only generated. Done means saved in Play Console and read back.

To reproduce the images on this page, run this from the repository root:

```sh
node docs/demo/make-demo-captures.mjs
S=.claude/skills/shipfast/scripts; cd docs/demo
node ../../$S/render-app-icons.mjs --sheet icons/*.svg --out out/icon-sheet.png
node ../../$S/render-app-icons.mjs --final icons/a-leaf.svg --out out/icons
node ../../$S/render-play-assets.mjs --config play-assets.json
```
