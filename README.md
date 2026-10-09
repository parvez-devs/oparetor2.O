# UID 2.O

UID 2.O is the native Android companion app for the UID Operator project. The Android app is built with React Native / Expo and uses native UI components — it is **not a WebView wrapper**.

## Android app

Current release: **v2.0.0**

### Main features

- Native Home, Import, Saved and Settings screens
- Supabase login and cloud sync
- UID profile lookup through the existing UID API
- Local password storage with secure session storage
- Search, retry, copy, save and delete actions
- Dark/light theme support
- Native scrolling, pull-to-refresh, haptics and swipe gestures
- Standalone APK with the JavaScript bundle embedded — Metro is not required
- App name and launcher branding: **UID 2.O**

## Download

Open the repository **Releases** page and download:

`UID-2.O-v2.0.0.apk`

Release page:

https://github.com/parvez-devs/oparetor2.O/releases/tag/v2.0.0

> If an older debug APK is installed and shows “Unable to load script”, uninstall it first and install the v2.0.0 release APK.

## Build locally

The native source lives in `mobile/`.

```bash
cd mobile
npm install
npx expo-doctor
npx expo prebuild --platform android --clean
cd android
./gradlew :app:assembleRelease
```

The release APK is created under:

```
mobile/android/app/build/outputs/apk/release/
```

## Automated APK build

GitHub Actions workflow:

`.github/workflows/native-android-apk.yml`

For main-branch native changes it:

1. Installs Android API 36.
2. Installs and aligns Expo dependencies.
3. Generates the UID 2.O launcher icons.
4. Runs Expo Doctor and TypeScript checks.
5. Generates the native Android project.
6. Builds a standalone release APK.
7. Verifies that `assets/index.android.bundle` exists inside the APK.
8. Verifies APK signing.
9. Uploads the APK artifact.
10. Publishes/updates GitHub Release `v2.0.0`.

## Web app

The existing web application remains available separately at:

https://uidzone.xyz

The native Android app reuses the existing Supabase project and UID API backend.

## Package

Android application ID:

`com.parvezdevs.uidzone`
