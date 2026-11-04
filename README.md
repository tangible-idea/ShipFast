# Shipframe

A local web service that connects a GitHub repository and prepares its first store release. It finds existing store screenshots in a Flutter repository and checks them for iPhone, iPad, Android phone and Android tablet. It resizes the real screens it finds to store sizes and exports them with logo drafts and a privacy policy draft as a ZIP.

## Run

```bash
npm install
cp .env.example .env
# Fill in the GitHub OAuth Client ID, Client Secret, SESSION_SECRET and POE_API_KEY in .env
npm start
```

Open `http://localhost:4321` in a browser. Set the GitHub OAuth app's Homepage URL to `http://localhost:4321` and its Authorization callback URL to `http://localhost:4321/auth/github/callback`. The OAuth `repo` scope is requested to access private repositories. Get a Poe API key from [Poe API Keys](https://poe.com/api/keys); generating three icon drafts uses Poe points. In production, switch to an HTTPS `BASE_URL`, a persistent session store, token encryption and a GitHub App with fine-grained permissions.

## What it automates

- GitHub OAuth sign-in, selecting an accessible repository, and analyzing the source file and screenshot inventory
- Finding existing real screens such as `store/.../screenshots/` and classifying them as phone or tablet
- Resizing only correctly proportioned screens to per-device PNGs; wrong ratios are recorded as missing
- Finding the icon theme and brand color in the source, or asking the user when none is found
- Generating three icon drafts with Poe Nano-Banana-2-Lite for selection, then producing a 1024px PNG for iOS and a 512px PNG for Google Play. Without connecting GitHub, you can also enter a theme and color directly and download an icon ZIP.
- Drafting a privacy policy from the real data-handling information you enter
- Downloading a ZIP with per-device results and missing items

If the Flutter repository has `test/store/store_screenshots_test.dart`, the analysis shows it. This version never runs other people's repository code on the server. If there are no source screens, run the app's screenshot test or capture them on a device and add them to the repository. Tablet images must be real tablet screens; phone screens are never stretched as a substitute.

The privacy policy is not a legally reviewed document. Check the actual SDKs, data flows, retention periods and store data disclosures, then publish it at a public URL.

## Release support skill

The procedure distilled from real release work is packaged as the Claude Code skill [`store-launch`](.claude/skills/store-launch/SKILL.md). Target identification, state checks, execution scope and verification criteria are in the entry document; detailed per-platform procedures are in the [Google Play](.claude/skills/store-launch/references/google-play.md) and [App Store](.claude/skills/store-launch/references/app-store.md) references. The an earlier release case records what was actually confirmed and what remains. To resume, copy a [state template](.claude/skills/store-launch/templates/) into the app's private work folder.

In other projects, install it with `npx skills` (requires GitHub access to this repository). See the [skill README](.claude/skills/store-launch/README.md) for all options.

```bash
npx skills add tangible-idea/ShipFast --skill store-launch -a claude-code      # current project
npx skills add tangible-idea/ShipFast --skill store-launch -a claude-code -g   # all your projects
npm install --prefix .claude/skills/store-launch                              # renderer dependency (sharp); ~/.claude/skills/store-launch for -g
```

Store assets are rendered from screens captured on a real device and reviewed for public use:

- Google Play: [render-play-assets.mjs](.claude/skills/store-launch/scripts/render-play-assets.mjs) → phone screenshots 1080×1920, feature graphic 1024×500
- App Store: [render-app-store-assets.mjs](.claude/skills/store-launch/scripts/render-app-store-assets.mjs) → iPhone screenshots (default 1320×2868), Product Page Header 3840×1646 (21:9), Search Results 1920×1280–3840×2560 (3:2), universal 5244×2950 (16:9). `--guides` also writes crop previews.

```bash
node .claude/skills/store-launch/scripts/render-app-store-assets.mjs --config /path/to/private/app-store-assets.json --guides
```

The skill and scripts never upload to or submit in Play Console or App Store Connect by themselves. Uploading, selecting and saving the generated files are verified separately.

## Languages

The interface opens in English by default. Use the language selector to switch to Japanese or Korean; the choice is saved in the browser. The downloaded privacy draft and launch-kit README follow the selected language (`PRIVACY.en.md`, `PRIVACY.ja.md`, or `PRIVACY.ko.md`).
