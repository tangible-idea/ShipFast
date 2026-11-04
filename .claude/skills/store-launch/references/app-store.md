# App Store first release and resuming interrupted work

Written: 2026-11-04. This procedure carries over the principles verified in the real Google Play case ([google-play.md](google-play.md)) to the App Store. There is no real App Store registration case yet. When you run one, record it in ShipFast `docs/release-cases/` and update this document. Re-check specs and UI names in App Store Connect and the official docs at the time of work.

Secret-free structure for resuming: [app-store-release-state.example.json](../templates/app-store-release-state.example.json)

## 1. Confirm the target

- Cross-check the App Store Connect app record's name, bundle ID and SKU against the source's `PRODUCT_BUNDLE_IDENTIFIER` (for Flutter, `ios/Runner.xcodeproj`). Do not confuse it with an extension target's bundle ID.
- Record the team (Team ID), existing version and build numbers, the version being prepared, release countries/regions, price, and iPad support (`TARGETED_DEVICE_FAMILY`). If the app supports iPad, iPad screenshots are also required.

## 2. Build and upload

```sh
cd <selected-flutter-app>
flutter build ipa --release <project-specific-production-defines>
# or xcodebuild archive / -exportArchive (use the project's actual method)
```

- Confirm the version (`CFBundleShortVersionString`) and build (`CFBundleVersion`) are higher than previous uploads.
- Confirm the distribution certificate and provisioning profile are for App Store distribution, and record the uploaded IPA's size and SHA-256. Replacing or revoking certificates is a separate decision.
- Check the upload method (Xcode Organizer, Transporter, a currently supported CLI) at the time of work. Distinguish an upload success message from build processing completing in App Store Connect (`Processing` finished).
- Match the export compliance (encryption) answers and the `ITSAppUsesNonExemptEncryption` value to the encryption the app actually uses.
- Verify installation by installing the same build on a real device through TestFlight. Running in the simulator is not evidence that the submitted build runs.

## 3. Review account

Same principles as Google Play: check for an existing account → create → initial password change → sign in again with the new password → confirm sign-in and main menus in the TestFlight build → enter it under Sign-in required in `App Review Information` → save and re-read. Check the notes' character count and save errors. Keep credentials only in a private file.

Apps with accounts must let people start account deletion inside the app (App Review Guidelines 5.1.1(v)). If the app only uses organization-issued accounts, confirm and record that fact and the actual deletion request path. If it uses third-party sign-in, check the 4.8 requirements.

## 4. iPhone screenshots

- Capture the submitted build, installed through TestFlight, on a real iPhone. Record the device model, iOS version, app version/build and capture resolution. Keep raw captures in a private folder.
- The renderer produces portrait 1320×2868 (default), 1290×2796 and 1260×2736 from Apple's `iPhone with Dynamic Island (large display)` class, and 1284×2778 and 1242×2688 from `iPhone with Face ID (large display)`. When you upload the large-display set, other sizes are filled with scaled versions. 1–10 images per device size, JPEG/PNG. ([Screenshot specifications](https://developer.apple.com/help/app-store-connect/reference/screenshot-specifications), checked 2026-11-04)
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

## 7. Submission and resume records

Selecting the build → saving version information, screenshots and review information → `Add for Review` → `Submit for Review` are each separate steps. Re-read after saving and record blocking messages. Record states as `prepared` → `local_verified` → `console_saved` → `submitted` → `approved` → `public` (distinguish `Pending Developer Release` for manual release). On rejection, record a summary of the Resolution Center message, the guideline numbers and the response.

## Official references

- [Creative assets specifications](https://developer.apple.com/help/app-store-connect/reference/app-information/creative-assets-specifications)
- [Manage creative assets](https://developer.apple.com/help/app-store-connect/manage-app-information/manage-your-app-store-assets#manage-creative-assets)
- [App Store asset best practices](https://developer.apple.com/app-store/asset-best-practices/)
- [Screenshot specifications](https://developer.apple.com/help/app-store-connect/reference/screenshot-specifications)
- [App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)
- [App privacy details](https://developer.apple.com/app-store/app-privacy-details/)
