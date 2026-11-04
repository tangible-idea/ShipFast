# Store listing text and privacy policy

The agent drafts all text from the app's real features in the source and on the device. Show drafts to the user before saving them to a store.

## Text fields

Limits as of 2026-11; re-check in the console, which counts characters for you.

| Store | Field | Limit |
| --- | --- | --- |
| Google Play | App name | 30 characters |
| Google Play | Short description | 80 characters |
| Google Play | Full description | 4,000 characters |
| App Store | Name | 30 characters |
| App Store | Subtitle | 30 characters |
| App Store | Promotional text | 170 characters (can change without a new version) |
| App Store | Description | 4,000 characters |
| App Store | Keywords | 100 bytes, comma-separated (non-Latin scripts use more bytes per character) |
| App Store | What's New | 4,000 characters |
| App Store | Review notes | 4,000 bytes |

Rules for drafts:

- Describe only features that exist in this build. No pricing, rankings, awards, "best/#1" claims, competitor or other-platform names, or emoji spam.
- Lead with what the app does for the user in the first line; Play's short description and App Store subtitle are the most read.
- App Store keywords: no repeats of words already in the name or subtitle, no spaces after commas, no competitor names.
- Localize per store locale the user wants; keep each locale's screenshots, captions and text consistent.
- Store `.shipfast/listing.<locale>.md` with the final text so a later `resume` can re-check what was saved.

## Required URLs

- Privacy policy URL: required by both stores for most apps (and always when the app handles personal data or targets children).
- Support URL: required on the App Store. A contact page or a repository issues page works if it actually reaches the developer.
- Account deletion URL or in-app path: required when the app has accounts (Play's data deletion question; App Review Guideline 5.1.1(v)).

## Privacy policy draft

Build the draft from evidence, not from a generic template:

| Section | Evidence |
| --- | --- |
| Who is responsible, contact | Developer name and email the user confirms |
| Data collected and why | Sign-up/profile fields, API payloads, analytics/crash/push/ads SDKs in the dependency list and their actual runtime traffic |
| Sharing and processors | SDK vendors, backend/hosting providers, payment processors |
| Retention and deletion | Real backend behavior and the actual deletion path |
| Children | Target age declaration |
| Changes and date | Effective date |

Write it in the listing's language(s) as Markdown in `.shipfast/privacy/`, together with short `SUPPORT` and `DELETE-ACCOUNT` pages. Tell the user it is a draft, not legal advice. ShipFast publishes all three on a dedicated Firebase Hosting site (`<app-slug>-legal.web.app`, SKILL.md section 5a). If the user already hosts policies elsewhere, record that URL instead and skip the deploy. The same evidence feeds Play data safety and App Store App Privacy, so keep them consistent.

## Terms of use draft

Draft it only when the developer chose to generate it (SKILL.md section 5a). Base every clause on a feature that exists in the app:

| Section | Include when |
| --- | --- |
| Who provides the service, contact | Always (same operator and email as the privacy policy) |
| Accounts and eligibility | The app has sign-in; minimum age from the target-audience declaration |
| User content and conduct | Users can post, upload or message |
| Purchases and subscriptions | In-app purchases or subscriptions exist: price changes, renewal, cancellation through the store, refunds handled by Google Play / Apple |
| Third-party services | SDKs or links the user interacts with |
| Termination | Accounts can be suspended or deleted |
| Disclaimers and limitation of liability | Always, in plain language |
| Governing law | Always: the jurisdiction the developer gives; never guessed |
| Changes and effective date | Always |

Write it as `.shipfast/privacy/TERMS.<lang>.md`, link it from the privacy policy, and tell the developer it is a draft, not legal advice. On the App Store, apps with auto-renewing subscriptions must show a Terms of Use (EULA) link in the app description or set a custom EULA; linking Apple's standard EULA is acceptable. Without a custom EULA, Apple's standard EULA applies.
