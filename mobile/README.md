# UIDZone Native Android

This is a native React Native/Expo Android application. It does not use WebView.

## Included
- Supabase email/password authentication
- Native Home / Import / Saved / Settings screens
- UID profile fetching through the production UIDZone API
- Supabase cloud sync with the same RLS-backed tables as the web app
- Account-scoped local storage
- Auth tokens and UID passwords stored with Expo SecureStore / Android Keystore
- Native FlatList scrolling, pull-to-refresh, card animation and optional swipe-to-delete
- Copy UID / password / selected UID lists
- Dark/light theme, font size, view mode, auto retry

## Run
```bash
cd mobile
npm install
npx expo run:android
```

## Build an installable APK
GitHub Actions runs `.github/workflows/native-android-apk.yml` and uploads the APK artifact.

For a Play Store build, use:
```bash
npx eas build -p android --profile production
```
