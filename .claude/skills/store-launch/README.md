# store-launch skill

An agent skill for preparing or resuming a first mobile app release on Google Play and the Apple App Store. It covers target identification, signed builds, review accounts, real-device screenshots, store asset rendering, declarations and submission state. See [SKILL.md](SKILL.md) for the procedure.

## Install

The skill lives in the private repository `tangible-idea/ShipFast`, so you need GitHub access to it. The [skills CLI](https://www.npmjs.com/package/skills) clones with your normal git credentials (for example `gh auth login`).

```sh
# List the skills in the repository without installing
npx skills add tangible-idea/ShipFast --list

# Install into the current project (./.claude/skills/store-launch) for Claude Code
npx skills add tangible-idea/ShipFast --skill store-launch -a claude-code

# Install for your user instead (available in every project)
npx skills add tangible-idea/ShipFast --skill store-launch -a claude-code -g

# Install for every supported agent without prompts
npx skills add tangible-idea/ShipFast --skill store-launch -a '*' -y
```

Then install the renderer dependency (`sharp`) once inside the installed skill folder:

```sh
npm install --prefix .claude/skills/store-launch          # project install
npm install --prefix ~/.claude/skills/store-launch        # global install (-g)
```

Requires Node.js 20 or later. Korean or Japanese captions need a matching font on the machine (Apple SD Gothic Neo on macOS, Noto Sans CJK elsewhere).

## Update and remove

```sh
npx skills check                     # check for updates
npx skills update store-launch       # update to the latest commit on main
npx skills remove store-launch       # remove (add -g for a global install)
```

Run `npm install --prefix <skill folder>` again after an update if `package.json` changed.

## Use

Ask the agent in natural language, for example "Prepare the App Store release for this app" or "Make the Header and Search Results images". It can also be invoked directly as `/store-launch`.

The renderers can also be run on their own:

```sh
# Google Play: phone screenshots 1080×1920 + feature graphic 1024×500
node <skill>/scripts/render-play-assets.mjs --config <private>/play-assets.json

# App Store: iPhone screenshots (default 1320×2868), Product Page Header 3840×1646 (21:9),
# Search Results 3840×2560 (3:2) and universal 5244×2950 (16:9). --guides writes crop previews.
node <skill>/scripts/render-app-store-assets.mjs --config <private>/app-store-assets.json --guides
```

Start from the config examples in [templates/](templates/). Inputs must be reviewed real-device captures marked `reviewedForPublicUse: true`.

## Contents

| Path | Purpose |
| --- | --- |
| `SKILL.md` | Entry document: target, scope, verification and status rules |
| `references/google-play.md` | Detailed Google Play procedure and observed Console failure modes |
| `references/app-store.md` | Detailed App Store procedure and Header/Search Results specs |
| `scripts/render-play-assets.mjs` | Google Play asset renderer |
| `scripts/render-app-store-assets.mjs` | App Store asset renderer |
| `templates/` | Renderer config examples and secret-free release state templates |

The skill and scripts never upload to or submit in Play Console or App Store Connect by themselves. Uploading, selecting and saving generated files are separate, verified steps.
