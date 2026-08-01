import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'app.dart';
import 'core/firebase_bootstrap.dart';
import 'core/providers.dart';
import 'core/reminders.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  // Analytics + Crashlytics + FCM. Safe no-op when the build has no
  // google-services.json (see lib/core/firebase_bootstrap.dart).
  await FirebaseBootstrap.init();
  // Local-notifications plugin + timezone db for the daily review reminder.
  // Must finish before runApp: the settings notifier re-arms the reminder
  // during the first frame. Safe no-op on failure (lib/core/reminders.dart).
  await Reminders.init();
  final prefs = await SharedPreferences.getInstance();
  runApp(
    ProviderScope(
      overrides: [sharedPreferencesProvider.overrideWithValue(prefs)],
      child: const HaoHaoApp(),
    ),
  );
}
