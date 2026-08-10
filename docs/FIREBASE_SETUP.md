# Firebase setup (Android)

The Flutter app ships with **Firebase Analytics, Crashlytics and Cloud
Messaging (push)** fully wired in code, but the config file with project keys
is *not* committed. Until you add it, every build runs with Firebase silently
disabled — nothing crashes, nothing is required for development.

## What's already in the repo

| Piece | Where |
|---|---|
| Gradle plugins (`google-services` 4.5.0, `crashlytics` 3.0.7), applied **only when `google-services.json` exists** | `mobile/android/settings.gradle.kts`, `mobile/android/app/build.gradle.kts` |
| Dart SDKs (`firebase_core`, `firebase_analytics`, `firebase_crashlytics`, `firebase_messaging`) | `mobile/pubspec.yaml` |
| Runtime bootstrap with graceful no-op fallback | `mobile/lib/core/firebase_bootstrap.dart` |
| Init call on startup | `mobile/lib/main.dart` |
| Automatic `screen_view` tracking (GoRouter observer) | `mobile/lib/app.dart` |
| `POST_NOTIFICATIONS` permission (Android 13+) | `mobile/android/app/src/main/AndroidManifest.xml` |

Behavior of the bootstrap:

- **Analytics** — enabled in release builds, disabled in debug (keeps data clean).
  Screen views are logged automatically; use `FirebaseBootstrap.logEvent(...)`
  for custom events.
- **Crashlytics** — uncaught Flutter + platform errors are recorded as fatals
  in release builds; `FirebaseBootstrap.recordError(...)` for non-fatals.
- **Messaging** — requests the notification permission on Android 13+, and
  subscribes every install to the **`all`** topic, so you can broadcast
  announcements straight from the Firebase console without any server work.

## Enabling Firebase (one-time, ~5 minutes)

1. In the [Firebase console](https://console.firebase.google.com/) create a
   project (or open an existing one).
2. **Add an Android app** with package name **`cn.haohaoxuexi.chinese`**.
   - For release builds also register your **SHA-1/SHA-256** signing
     certificate fingerprints (from `keytool -list -v -keystore <your.jks>`),
     required if you later enable services that check app integrity.
3. Download **`google-services.json`** and place it at:

   ```
   mobile/android/app/google-services.json
   ```

   The file is gitignored on purpose; keep it with your keystore. (It contains
   no secrets — committing it is also acceptable if you prefer.)
4. Fetch packages and build as usual:

   ```bash
   cd mobile
   flutter pub get
   flutter build appbundle --release --dart-define=API_BASE_URL=https://haohaoxuexi.tech
   ```

That's it — when the file is present, the Gradle build applies the Google
Services + Crashlytics plugins automatically and the app boots with the full
telemetry stack.

## Verifying

- **Analytics**: Firebase console → Analytics → DebugView. To see events from a
  debug device run
  `adb shell setprop debug.firebase.analytics.app cn.haohaoxuexi.chinese`
  (analytics collection is release-only by default; DebugView still works for
  release builds installed locally).
- **Crashlytics**: force a test crash from anywhere:
  `FirebaseCrashlytics.instance.crash();` — the report appears in the console
  in a couple of minutes.
- **Push**: Firebase console → Messaging → *New campaign* → target the topic
  **`all`** (or a specific test device token) and send. With the app in the
  background the notification is shown by the system tray.

## Sending announcement pushes

In the Firebase console → Messaging, create a notification targeting **topic
`all`**. All installs (with notifications allowed) receive it. No backend
changes are needed for this path; per-user targeted pushes would require a
token registry endpoint on the API and are intentionally out of scope for now.
