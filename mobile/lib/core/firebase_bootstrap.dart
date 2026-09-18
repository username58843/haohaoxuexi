import 'dart:async';

import 'package:firebase_analytics/firebase_analytics.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_crashlytics/firebase_crashlytics.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';

/// FCM background handler. Must be a top-level function so the Flutter engine
/// can invoke it from a background isolate.
///
/// Data-only messages land here when the app is terminated/backgrounded;
/// "notification" messages are shown by the system tray automatically.
@pragma('vm:entry-point')
Future<void> firebaseMessagingBackgroundHandler(RemoteMessage message) async {
  // Firebase must be (re-)initialized inside the background isolate.
  try {
    await Firebase.initializeApp();
  } catch (_) {
    // Not configured — nothing to do.
  }
}

/// Central Firebase wiring: Analytics + Crashlytics + Cloud Messaging.
///
/// The whole class is a **safe no-op** when the app was built without
/// `android/app/google-services.json` (the Gradle side skips the Google
/// Services plugin, so `Firebase.initializeApp()` throws and we simply keep
/// running without Firebase). This keeps forks, CI and keyless debug builds
/// working while release builds get the full telemetry stack.
class FirebaseBootstrap {
  FirebaseBootstrap._();

  static bool _ready = false;

  /// Whether Firebase initialized successfully this launch.
  static bool get isReady => _ready;

  /// Analytics instance, or `null` when Firebase is not configured.
  static FirebaseAnalytics? get analytics =>
      _ready ? FirebaseAnalytics.instance : null;

  /// Initialize Firebase and wire Crashlytics + Messaging.
  ///
  /// Call once from `main()` after `WidgetsFlutterBinding.ensureInitialized()`.
  /// Never throws.
  static Future<void> init() async {
    try {
      await Firebase.initializeApp();
      _ready = true;
    } catch (e) {
      debugPrint('[firebase] not configured, continuing without it: $e');
      return;
    }

    try {
      // --- Crashlytics: capture uncaught errors in release builds. ---
      // In debug we keep Flutter's red screen + console output instead.
      final crashlytics = FirebaseCrashlytics.instance;
      await crashlytics.setCrashlyticsCollectionEnabled(!kDebugMode);
      if (!kDebugMode) {
        FlutterError.onError = crashlytics.recordFlutterFatalError;
        PlatformDispatcher.instance.onError = (error, stack) {
          // Font-loading failures are cosmetic — the text falls back to a
          // system font — so keep them out of the crash-free-users metric.
          // Covers both google_fonts failure shapes: "Failed to load font
          // <url>..." (runtime fetch) and "GoogleFonts.config
          // .allowRuntimeFetching is false but font X was not found in the
          // application assets" (missing bundled cut).
          // (Should not happen anymore: fonts are bundled and runtime
          // fetching is disabled in main.dart, but keep the guard.)
          final message = error.toString().toLowerCase();
          final isFontLoadError = message.contains('failed to load font') ||
              message.contains('google_fonts') ||
              message.contains('googlefonts') ||
              message.contains('was not found in the application assets');
          crashlytics.recordError(error, stack, fatal: !isFontLoadError);
          return true;
        };
      }

      // --- Analytics: on in release, off in debug to keep data clean. ---
      await FirebaseAnalytics.instance
          .setAnalyticsCollectionEnabled(!kDebugMode);

      // --- Messaging: background handler + foreground presentation. ---
      FirebaseMessaging.onBackgroundMessage(firebaseMessagingBackgroundHandler);
      unawaited(_initMessaging());
    } catch (e, st) {
      debugPrint('[firebase] post-init wiring failed: $e\n$st');
    }
  }

  static Future<void> _initMessaging() async {
    try {
      final messaging = FirebaseMessaging.instance;
      // Android 13+ runtime notification permission (no-op below 13).
      await messaging.requestPermission();
      // Broadcast topic for app-wide announcements sent from the Firebase
      // console — no server-side token registry needed.
      await messaging.subscribeToTopic('all');
    } catch (e) {
      debugPrint('[firebase] messaging setup failed: $e');
    }
  }

  /// Record a non-fatal error to Crashlytics (no-op when unconfigured).
  static void recordError(Object error, StackTrace? stack, {String? reason}) {
    if (!_ready) return;
    unawaited(FirebaseCrashlytics.instance
        .recordError(error, stack, reason: reason));
  }

  /// Log an analytics event (no-op when unconfigured).
  static void logEvent(String name, [Map<String, Object>? parameters]) {
    if (!_ready) return;
    unawaited(FirebaseAnalytics.instance
        .logEvent(name: name, parameters: parameters));
  }

  /// Attach/detach the user id after login/logout so analytics and crash
  /// reports can be segmented per account.
  static void setUserId(String? id) {
    if (!_ready) return;
    unawaited(FirebaseAnalytics.instance.setUserId(id: id));
    unawaited(FirebaseCrashlytics.instance.setUserIdentifier(id ?? ''));
  }
}
