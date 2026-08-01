import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'app.dart';
import 'core/firebase_bootstrap.dart';
import 'core/providers.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  // Analytics + Crashlytics + FCM. Safe no-op when the build has no
  // google-services.json (see lib/core/firebase_bootstrap.dart).
  await FirebaseBootstrap.init();
  final prefs = await SharedPreferences.getInstance();
  runApp(
    ProviderScope(
      overrides: [sharedPreferencesProvider.overrideWithValue(prefs)],
      child: const HaoHaoApp(),
    ),
  );
}
