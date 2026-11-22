# App Store: first release and resuming interrupted work

Detailed App Store reference for the [shipfast skill](../SKILL.md). It applies the principles proven on Google Play ([google-play.md](google-play.md)) to App Store Connect. Re-check specs and UI names in App Store Connect and the official docs at the time of work, and update this document when they differ.

- Secret-free structure for resuming: [app-store-release-state.example.json](../templates/app-store-release-state.example.json)
- Build commands per stack: [frameworks.md](frameworks.md)
- Listing text and privacy policy: [store-listing.md](store-listing.md)

## 0. Developer account and app record (first launch only)

- Publishing requires an Apple Developer Program membership (annual fee; organizations need a D-U-N-S number). Enrolling or paying is the user's decision.
- Register the bundle ID under Certificates, Identifiers & Profiles (Xcode automatic signing can do this), then create the app in App Store Connect: platform, name, primary language, bundle ID, SKU.
- Agreements, tax and banking must be completed for paid apps or in-app purchases.

## 1. Confirm the target

**Console handshake (end of the start phase).** Ask the developer to sign in to App Store Connect with the developer account (they complete any two-factor prompt themselves) and say when it is done, or to paste the existing app's URL, for example `https://appstoreconnect.apple.com/apps/<appleId>/distribution/...`. The numeric `<appleId>` identifies the app; the public `https://apps.apple.com/.../id<appleId>` link carries the same ID. Open the app, read its bundle ID under App Information, and compare it with the source before any change. With several teams, confirm the team name shown in the account menu.

- Cross-check the App Store Connect app record's name, bundle ID and SKU against the app target's `PRODUCT_BUNDLE_IDENTIFIER` (see [frameworks.md](frameworks.md) for where each stack keeps it). Do not confuse it with an extension target's bundle ID.
- Record the team (Team ID), existing version and build numbers, the version being prepared, release countries/regions, price, and iPad support (`TARGETED_DEVICE_FAMILY`). If the app supports iPad, iPad screenshots are also required.

## 2. Build and upload

Build with the command for the project's stack in [frameworks.md](frameworks.md), using its production configuration.

- Confirm the version (`CFBundleShortVersionString`) and build (`CFBundleVersion`) are higher than previous uploads.
- Confirm the distribution certificate and provisioning profile are for App Store distribution, and record the uploaded IPA's size and SHA-256. Replacing or revoking certificates is a separate decision.
- Check the upload method (Xcode Organizer, Transporter, a currently supported CLI) at the time of work. Distinguish an upload success message from build processing completing in App Store Connect (`Processing` finished).
- CLI upload that worked (2026-11-22, Flutter): `xcodebuild -exportArchive -archivePath <xcarchive> -exportOptionsPlist <plist with destination=upload> -exportPath build/ios/upload -allowProvisioningUpdates`. It uses the account signed in to Xcode and ends with `Upload succeeded` / `EXPORT SUCCEEDED`. The build then appears in TestFlight as `Processing` for a few minutes and only then in the version page's **Add Build** dialog. Use a build number higher than every earlier upload (read them from TestFlight, not from `pubspec.yaml`).
- Match the export compliance (encryption) answers and the `ITSAppUsesNonExemptEncryption` value to the encryption the app actually uses.
- Verify installation by installing the same build on a real device through TestFlight. Running in the simulator is not evidence that the submitted build runs.

## 3. Review account

Same principles as Google Play: check for an existing account → create → initial password change → sign in again with the new password → confirm sign-in and main menus in the TestFlight build → enter it under Sign-in required in `App Review Information` → save and re-read. Check the notes' character count and save errors. Keep credentials only in a private file.

Apps with accounts must let people start account deletion inside the app (App Review Guidelines 5.1.1(v)). If the app only uses organization-issued accounts, confirm and record that fact and the actual deletion request path. If it uses third-party sign-in, check the 4.8 requirements.

## 4. iPhone screenshots

- Capture the submitted build, installed through TestFlight, on a real iPhone. Record the device model, iOS version, app version/build and capture resolution. Keep raw captures in `.shipfast/captures/`.
- **The required slot is the medium display, not the 6.9" one.** Observed 2026-11-22: the version page and `Media Manager → iPhone` list `iPhone with Dynamic Island (medium display)` as *Required* and accept only 2556×1179, 1179×2556, 2622×1206 and 1206×2622. Uploading a 1320×2868 or 1290×2796 capture there fails with "File dimensions are invalid". Render `iphone.size` `[1206, 2622]` (or `[1179, 2556]`) for the required slot. 6.9" sizes belong to the optional large-display slot; add them only when you want a separate large set.
- When a real capture is only available at 6.9" (1320×2868), scale it uniformly by height to 2622 and crop the width to 1206 (about 0.2% off the sides); never stretch.
- The renderer produces portrait 1206×2622 and 1179×2556 (6.3" / 6.1", required slot), 1320×2868 (default), 1290×2796 and 1260×2736 from Apple's `iPhone with Dynamic Island (large display)` class, and 1284×2778 and 1242×2688 from `iPhone with Face ID (large display)`. 1–10 images per device size, JPEG/PNG. ([Screenshot specifications](https://developer.apple.com/help/app-store-connect/reference/screenshot-specifications), checked 2026-11-04)
- The same document adds `iPhone Duo` sizes (outer 1398×2034, inner 2007×2853) and says they become required starting April 2027 for apps using the iOS 27.1 SDK or later. The renderer does not support them yet. If you build with that SDK, prepare real device screens separately.
- The status bar can be excluded with `crop`. App UI is only scaled uniformly.
- If the app supports iPad, prepare screens captured on a real iPad separately. Do not stretch iPhone screens as a substitute. The renderer rejects landscape captures.

## 5. Product Page Header and Search Results images

Official specs ([Creative assets specifications](https://developer.apple.com/help/app-store-connect/reference/app-information/creative-assets-specifications), checked 2026-11-04):

| Placement | Ratio | Resolution | Format |
| --- | --- | --- | --- |
| Product page header | 21:9 | 3840×1646 | JPEG/PNG |
| Search results | 3:2 | 1920×1280 – 3840×2560 | JPEG/PNG |
| Shared by both (universal) | 16:9 | 5244×2950 | PNG |

- Alpha channels and transparent areas are not allowed. The renderer removes alpha from outputs and verifies it.
- Videos use the same resolutions, 30/60 fps, 5–30 seconds, loop and are muted by default. This renderer is image-only.
- The universal 16:9 image is assumed to be cropped top and bottom for the header (21:9, full width 5244×2247) and left and right for search (3:2, full height 4425×2950). Copy and key screens go inside the intersection of both crops, the central 4425×2247. Check it with `previews/universal.png` from `--guides`. Confirm actual iPhone/iPad/Mac display in the App Store Connect Preview.
- Header-only and search-only images are also center-aligned. The header can lose more of its sides on narrow screens.

Restrictions from [Asset best practices](https://developer.apple.com/app-store/asset-best-practices/):

- No pricing or discounts, website URLs, copyright symbols, logos of other platforms/marketplaces, awards not actually received, or Apple recognition labels.
- Must be suitable for 4+ regardless of the app's rating.
- One message, short phrases. Search results must show the app's purpose and real UI at a glance.
- Localize per language. Keep one renderer config file per language.
- Without a search results image, In-App Events, app previews and screenshots appear instead.

The renderer places real captures in neutral phone frames and adds a brand background and copy. It does not reproduce Apple device imagery or another app's design. Copy wider than the layout makes the render fail, so shorten it or add a line break.

## 6. App privacy and declarations

- For App Privacy (the data collection labels), use the same evidence table as Google Play data safety: real payloads, SDK transmissions and release runtime observations. An empty SDK config does not prove there is no transmission. Check tracking and ATT usage separately.
- Confirm third-party SDK privacy manifests (`PrivacyInfo.xcprivacy`) and required-reason API declarations are included in the build.
- Write the privacy policy URL, support URL, age rating questionnaire, content rights and export compliance from the app's actual features. Do not copy another app's answers.

## 6a. Filling App Store Connect in the browser (field-tested 2026-11-22)

Order that worked, with the pages and gotchas. Ask the developer once up front for everything the console needs that the source cannot give: public contact email, operator name, **review contact phone**, price, countries. Never invent a phone number or email.

| Step | Where | Notes |
| --- | --- | --- |
| Legal pages | `publish-policy.mjs` → privacy + support URLs | Needed before the version page. Bilingual (ko + en) pages in one file work with `locale` set to the primary language. |
| Version page | `/apps/<id>/distribution/ios/version/inflight` | Promotional text (≤170), Description, Keywords (≤100 bytes; Korean is 3 bytes per character), Support URL, Copyright. Use `find` to get refs, then `form_input`; click **Save** and confirm the button turns to "Saved". |
| Screenshots | `…/inflight/media-manager/iphone` | Required slot is the medium display (see §4). Upload through the hidden file input with `file_upload`; an "App Previews, Screenshots, and Localizations" info dialog appears after a successful upload: click OK. |
| Build | version page → **Add Build** | Appears only after TestFlight processing finished. Pick it and press Done. |
| App Review Information | version page | **Sign-in required is checked by default: uncheck it** when the app has no login. Contact first/last name, email and phone are required; the phone must start with `+` and the country code. Paste review notes from the listing file. |
| Release | version page | Choose **Manually release this version** unless the developer asked otherwise. |
| App Information | `/apps/<id>/distribution/info` | Subtitle, primary category, **Content Rights** (Edit → answer → Done), **Age Ratings → Set Up** (7-step questionnaire, then Save; answer every step from the app's real features and let Apple calculate the rating). |
| App Privacy | `/apps/<id>/distribution/privacy` | Privacy Policy URL (Edit), **Get Started** → "No, we do not collect data" only when nothing leaves the device (system frameworks such as speech recognition or HealthKit read on-device do not by themselves count as collection by the developer). **Publish** shows an attestation ("responses are accurate… will update if practices change"): ask the developer before confirming it. |
| Pricing and Availability | `/apps/<id>/distribution/pricing` | **Add Pricing** (base country, price, Next, Next, Confirm), then **Set Up Availability**: All, Specific (tick the countries) or Pre-Order. Expanding countries is the developer's choice. |

Browser gotchas:

- `form_input` can leave Korean/IME text fields empty (the subtitle stayed empty although the call reported success). After typing or `form_input`, re-read the field; if empty, click the field by `ref` and use `computer type`.
- A page with unsaved changes blocks `navigate` with a "Leave site?" dialog. Open another tab (`tabs_create_mcp`) for the other console pages instead of discarding the edits.
- A Save that hits a validation error does not persist anything on that page, including the build and the notes. Read the red banner at the top of the page (`scroll up`), fix the field (for example the phone), then Save again.
- Dialog questionnaires (age rating) have many radios. Reading the dialog's `input[type=radio]` names with `javascript_tool` and clicking `NONE` / `false` by value is faster than coordinates; set the few "yes" answers explicitly and check each step's names before pressing Next.
- Do not click "Add for Review" or "Submit for Review" without the developer's confirmation of the final summary.

## 7. Submission and resume records

Selecting the build → saving version information, screenshots and review information → `Add for Review` → `Submit for Review` are each separate steps. Re-read after saving and record blocking messages. Record states as `prepared` → `local_verified` → `console_saved` → `submitted` → `approved` → `public` (distinguish `Pending Developer Release` for manual release). On rejection, record a summary of the Resolution Center message, the guideline numbers and the response.

## Official references

- [Creative assets specifications](https://developer.apple.com/help/app-store-connect/reference/app-information/creative-assets-specifications)
- [Manage creative assets](https://developer.apple.com/help/app-store-connect/manage-app-information/manage-your-app-store-assets#manage-creative-assets)
- [App Store asset best practices](https://developer.apple.com/app-store/asset-best-practices/)
- [Screenshot specifications](https://developer.apple.com/help/app-store-connect/reference/screenshot-specifications)
- [App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)
- [App privacy details](https://developer.apple.com/app-store/app-privacy-details/)
