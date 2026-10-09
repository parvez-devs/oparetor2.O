# UID 2.O

UID 2.O is the native Android version of the UID Operator web panel. The Android application is built with React Native / Expo and uses native components — it is **not a WebView wrapper**.

## Current Android release

**v2.1.0 — Web Panel Parity**

Download the APK from:

https://github.com/parvez-devs/oparetor2.O/releases/tag/v2.1.0

APK filename:

`UID-2.O-v2.1.0.apk`

> Remove any old debug APK that shows “Unable to load script”, then install the current standalone release.

## Web → Native parity

The native app now follows the current web panel point-by-point:

- Same top header hierarchy and UID 2.O branding
- Same four-tab bottom navigation: Home / Import / Saved / Settings
- Same dark/light palette and card/border/text colors
- Home stats bar with Total, success, profile-picture, Instagram and error counts
- Global show/hide password control
- Retry failed action
- 3-dot Home menu with pending fetch, failed retry, select/deselect, copy and delete-all actions
- Same search field placement
- UID card hierarchy matching the web panel
  - selection checkbox
  - 72px profile image
  - name and Instagram indicator
  - save star
  - OK / Err / Wait status
  - 3-dot card menu for Fetch / Open FB / Delete
  - username and follower count
  - UID row and password row with copy actions
- Saved page with title, count badge, password toggle, search and matching empty state
- Import page with format examples, large textarea, progress bar and Import button
- Settings sections matching the web panel:
  - Theme
  - Font Size
  - View Mode
  - Preferences
  - Storage
- Supabase authentication and cloud sync
- Existing UID profile API integration
- Local password storage using secure device storage
- Native scrolling, pull-to-refresh, haptics and swipe-to-delete preference
- Standalone APK with `assets/index.android.bundle` embedded — Metro/USB/PC is not required

## Web app

https://uidzone.xyz

The native Android app reuses the existing Supabase project and UID API backend.

## Build locally

Native source:

`mobile/`

```bash
cd mobile
npm install
python3 scripts/generate_icon.py
npx expo-doctor
npx tsc --noEmit
npx expo prebuild --platform android --clean
cd android
./gradlew :app:assembleRelease
```

Release APK output:

```
mobile/android/app/build/outputs/apk/release/
```

## Automated build and release

Workflow:

`.github/workflows/native-android-apk.yml`

The workflow validates Expo config, runs TypeScript checks, generates Android native files, builds the standalone release APK, verifies the embedded JavaScript bundle and APK signature, uploads the build artifact, and publishes GitHub Release **v2.1.0** only after all build steps pass.

## Android package

`com.parvezdevs.uidzone`
