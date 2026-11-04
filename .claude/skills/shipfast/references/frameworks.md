# Detecting the stack and building a release

Use the project's own scripts, CI config, Fastlane lanes or README build instructions first when they exist. The commands below are the defaults when the project defines nothing. Read the project's release configuration before building: flavors, schemes, `--dart-define`/`.env` handling, and production API endpoints.

## Detection

| Stack | Signals | Android ID | iOS ID |
| --- | --- | --- | --- |
| Flutter | `pubspec.yaml` | `android/app/build.gradle(.kts)` `applicationId` | `ios/Runner.xcodeproj` `PRODUCT_BUNDLE_IDENTIFIER` |
| Expo | `app.json` / `app.config.*` with `expo`, `eas.json` | `expo.android.package` | `expo.ios.bundleIdentifier` |
| React Native (bare) | `package.json` with `react-native`, `android/`, `ios/` | `android/app/build.gradle` `applicationId` | `ios/*.xcodeproj` |
| Capacitor / Ionic | `capacitor.config.*` | `android/app/build.gradle` | `ios/App/App.xcodeproj` |
| Native Android | `settings.gradle(.kts)`, `app/build.gradle(.kts)` | `applicationId` (watch for flavors and `applicationIdSuffix`) | - |
| Native iOS | `*.xcodeproj` / `*.xcworkspace` | - | Target build settings (do not confuse with extension targets) |

Monorepos can hold several apps (for example a customer app and an admin app). List them with their IDs and confirm the target with the user before building.

## Android release (AAB for the store, APK for the device)

| Stack | Build |
| --- | --- |
| Flutter | `flutter build appbundle --release` and `flutter build apk --release` |
| Expo | `eas build -p android --profile production` (AAB; credentials may be managed by EAS) |
| React Native / Capacitor | `npx cap sync android` for Capacitor, then `cd android && ./gradlew bundleRelease assembleRelease` |
| Native | `./gradlew :app:bundleRelease :app:assembleRelease` (add the flavor, e.g. `bundleProdRelease`) |

Verify:

```sh
shasum -a 256 <app-release.aab>
keytool -printcert -jarfile <app-release.aab>       # upload certificate fingerprint
apksigner verify --print-certs <app-release.apk>    # same certificate expected
```

- Check the release `signingConfig` really uses the upload keystore and does not silently fall back to debug signing.
- To install exactly what you upload, build a universal APK from the AAB: `bundletool build-apks --bundle <aab> --output app.apks --mode=universal --ks <keystore> ...`, then `bundletool install-apks --apks app.apks`.
- Record package, versionName/versionCode, target SDK, AAB size and SHA-256 and the certificate fingerprint in the state file.

## iOS release (IPA)

| Stack | Build |
| --- | --- |
| Flutter | `flutter build ipa --release` (optionally `--export-options-plist`) |
| Expo | `eas build -p ios --profile production`; `eas submit -p ios` can upload |
| React Native / Capacitor / Native | `xcodebuild -workspace <App>.xcworkspace -scheme <Scheme> -configuration Release -archivePath build/App.xcarchive archive`, then `xcodebuild -exportArchive -archivePath build/App.xcarchive -exportOptionsPlist ExportOptions.plist -exportPath build` (method `app-store-connect`) |

Verify the bundle ID, `CFBundleShortVersionString` / `CFBundleVersion` (higher than any earlier upload), the distribution signing identity and provisioning profile, and record the IPA size and SHA-256. Install the uploaded build through TestFlight on a real iPhone.

## Icons in the project

After choosing the icon, wire it into the app with the stack's normal tool: `flutter_launcher_icons` (Flutter), `expo.icon` / `expo.android.adaptiveIcon` (Expo), Android Studio Image Asset or `mipmap-*` + adaptive icon XML (Android), the `AppIcon` asset catalog with a single 1024 image (iOS). Rebuild before capturing screenshots.
