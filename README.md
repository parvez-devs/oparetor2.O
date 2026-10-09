# UID 2.O

**UID 2.O** is a native Android UID workspace built with React Native / Expo. It is not a WebView wrapper.

The current native generation is **v3.0.0 — Cyber Minimal**.

## v3 Cyber Minimal

UID 2.O v3 keeps the existing Supabase authentication/cloud data and UID profile API, while upgrading the Android client into a more advanced native workspace.

### Signature visual system

- AMOLED-first Cyber Minimal design
- Animated blue/cyan aurora depth
- Edge-lit native cards
- Custom UID 2.O adaptive launcher icon
- Android monochrome themed icon
- Native + animated Lottie launch reveal
- Dark, AMOLED Black, Light and System theme modes

### UID Card v2

- Compact and Full layouts
- Cached/lazy profile images with `expo-image`
- Spring-resistance swipe-to-delete
- Long-press native quick actions
- Native bottom-sheet action menu
- Animated Saved star
- Success / Failed / Pending status treatments
- Inline Retry for failed profiles
- Floating copy confirmation
- Tap card for Profile Inspector

### Smart Home

- Animated dashboard counters
- Filters:
  - All
  - OK
  - Failed
  - IG
  - Saved
  - With Password
- Sort by newest, name or status
- Collapsible dashboard
- Debounced command search
- FlashList rendering for large UID collections
- Pull-to-refresh sync
- Floating bulk action toolbar for selected UIDs

### Command Search

Examples:

```text
status:error
status:ok
saved:true
ig:true
pass:true
@username
date:2026-10-09
```

Commands can be combined with normal search text.

### Profile Inspector

Tap a UID card to open the native inspector with:

- Large avatar preview
- Full name / username / follower information
- UID and password actions
- Fetch time
- Facebook / Instagram actions
- Saved state
- Workspace collection assignment
- Custom collections

### Secure Vault

- 4–8 digit Vault PIN
- Android biometric unlock when available
- Automatic lock when UID 2.O goes to the background
- Optional authentication before password reveal
- Optional screenshot / recent-app preview protection
- Session/password data remains in Android SecureStore

### Encrypted Backup / Restore

UID 2.O can create a portable passphrase-protected backup containing:

- UID records
- Saved/collection metadata
- App preferences
- Local passwords

The backup is encrypted locally before export. The passphrase is not uploaded.

### Offline-first sync UX

The app exposes explicit sync state:

- SYNCING
- SYNCED
- OFFLINE
- ERROR
- CONFLICT-ready state

Local data remains usable when cloud sync is unavailable. Reconnection triggers a silent sync attempt and pending/failed profile retry.

### Import Pro

- Live UID validation
- Invalid-line count
- Duplicate warnings
- Password detection
- Preview before import
- **Import only**
- **Import & Fetch**
- Animated native progress feedback

### Saved Workspace

- Saved profile workspace
- Collection filters
- Built-in and custom collections
- Command search inside Saved
- Secure password reveal
- Same Profile Inspector as Home

### Diagnostics and Updates

Control Center includes:

- Network status
- Cloud sync status
- Last successful sync
- Local UID count
- Collection count
- UID profile API probe
- Supabase probe
- Safe diagnostic report copy
- GitHub latest-release checker
- User-controlled update link

Diagnostic reports do **not** include UID or password values.

## Android release

Once the v3 CI pipeline is green, the release APK is published as:

```text
UID-2.O-v3.0.0.apk
```

Release page:

https://github.com/parvez-devs/oparetor2.O/releases/tag/v3.0.0

## Web app

The existing web panel remains available at:

https://uidzone.xyz

The web and native clients reuse the existing Supabase project and UID profile API.

## Native source

```text
mobile/
```

## Local development

From the repository root:

```bash
cd mobile
npm install
npm run v3:deps
npx expo install --fix
python3 scripts/generate_icon.py
npx expo-doctor
npx tsc --noEmit
npx expo prebuild --platform android --clean
cd android
./gradlew :app:assembleRelease
```

Release output:

```text
mobile/android/app/build/outputs/apk/release/
```

## Automated validation

`.github/workflows/native-android-apk.yml` validates:

1. Android API / build tools
2. Base dependencies
3. v3 native dependencies
4. Expo dependency compatibility
5. Launcher/adaptive/monochrome icon generation
6. Expo Doctor
7. TypeScript strict checks
8. Expo Android prebuild
9. Standalone release Gradle build
10. Embedded `assets/index.android.bundle`
11. APK signature
12. Build artifact upload
13. GitHub Release publication from `main`

## Android package

```text
com.parvezdevs.uidzone
```

## Security model

- Supabase session tokens: SecureStore
- UID passwords: SecureStore, per signed-in user
- Cloud database: UID metadata only
- Profile API receives UID values only
- Backup passwords: encrypted locally using a passphrase-derived key
- Vault PIN: hashed before SecureStore persistence
