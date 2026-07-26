import 'dart:async';
import 'dart:convert';
import 'dart:ui' as ui show PlatformDispatcher;

import 'package:flutter/material.dart' show ThemeMode;
import 'package:flutter/services.dart' show rootBundle;
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'api.dart';
import 'i18n.dart';
import 'models.dart';
import 'theme.dart';

/// Overridden with the real instance in main() before runApp.
final sharedPreferencesProvider = Provider<SharedPreferences>(
  (ref) => throw UnimplementedError(
    'sharedPreferencesProvider must be overridden in main()',
  ),
);

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

/// Client-side app settings, persisted in SharedPreferences and mirrored to
/// `PUT /user/settings` when authenticated.
class AppSettings {
  const AppSettings({
    this.themeMode = ThemeMode.system,
    this.accent = defaultAccentKey,
    this.language = 'en',
    this.dailyGoal = 20,
    this.onboardingDone = false,
  });

  final ThemeMode themeMode;

  /// Key into [accentColors].
  final String accent;

  /// 'en' | 'ru' | 'tk' | 'zh'
  final String language;
  final int dailyGoal;
  final bool onboardingDone;

  AppSettings copyWith({
    ThemeMode? themeMode,
    String? accent,
    String? language,
    int? dailyGoal,
    bool? onboardingDone,
  }) {
    return AppSettings(
      themeMode: themeMode ?? this.themeMode,
      accent: accent ?? this.accent,
      language: language ?? this.language,
      dailyGoal: dailyGoal ?? this.dailyGoal,
      onboardingDone: onboardingDone ?? this.onboardingDone,
    );
  }
}

class SettingsNotifier extends Notifier<AppSettings> {
  static const _kTheme = 'theme';
  static const _kAccent = 'accent';
  static const _kLanguage = 'language';
  static const _kDailyGoal = 'dailyGoal';
  static const _kOnboardingDone = 'onboardingDone';

  SharedPreferences get _prefs => ref.read(sharedPreferencesProvider);

  @override
  AppSettings build() {
    final p = _prefs;
    final accentRaw = p.getString(_kAccent);

    // Language: honour the user's persisted choice; on a fresh install
    // (nothing stored yet) fall back to the device locale. We persist the
    // detected value so later launches never re-detect over an explicit choice.
    final storedLang = _validLanguage(p.getString(_kLanguage));
    final String language;
    if (storedLang != null) {
      language = storedLang;
    } else {
      language = _detectDeviceLanguage();
      p.setString(_kLanguage, language);
    }

    final settings = AppSettings(
      themeMode: _themeModeFrom(p.getString(_kTheme)),
      accent:
          accentColors.containsKey(accentRaw) ? accentRaw! : defaultAccentKey,
      language: language,
      dailyGoal: p.getInt(_kDailyGoal) ?? 20,
      onboardingDone: p.getBool(_kOnboardingDone) ?? false,
    );
    I18n.setLanguage(settings.language);
    return settings;
  }

  /// First-launch language pick from the device locales, mapped to one of the
  /// supported UI languages (en/ru/tk/zh). Falls back to 'en'.
  static String _detectDeviceLanguage() {
    final locales = ui.PlatformDispatcher.instance.locales;
    for (final locale in locales) {
      final mapped = _mapLocaleCode(locale.languageCode);
      if (mapped != null) return mapped;
    }
    return 'en';
  }

  /// Maps a BCP-47 language subtag to a supported UI language, or null.
  static String? _mapLocaleCode(String code) {
    switch (code.toLowerCase()) {
      case 'en':
        return 'en';
      case 'ru':
        return 'ru';
      case 'tk':
        return 'tk';
      case 'zh':
        return 'zh';
    }
    return null;
  }

  void setThemeMode(ThemeMode mode) {
    state = state.copyWith(themeMode: mode);
    _prefs.setString(_kTheme, mode.name);
    _mirror({'theme': mode.name});
  }

  void setAccent(String key) {
    if (!accentColors.containsKey(key)) return;
    state = state.copyWith(accent: key);
    _prefs.setString(_kAccent, key);
    _mirror({'themeColor': key});
  }

  void setLanguage(String lang) {
    final valid = _validLanguage(lang);
    if (valid == null) return;
    I18n.setLanguage(valid);
    state = state.copyWith(language: valid);
    _prefs.setString(_kLanguage, valid);
    _mirror({'language': valid});
  }

  void setDailyGoal(int goal) {
    final clamped = goal.clamp(1, 500);
    state = state.copyWith(dailyGoal: clamped);
    _prefs.setInt(_kDailyGoal, clamped);
    _mirror({'dailyGoal': clamped});
  }

  void setOnboardingDone() {
    state = state.copyWith(onboardingDone: true);
    _prefs.setBool(_kOnboardingDone, true);
  }

  /// Pull server settings into local state (called once on login / me).
  /// Does NOT mirror back to the server.
  void applyServerSettings(Map<String, dynamic>? server) {
    if (server == null || server.isEmpty) return;
    var next = state;

    final themeMode = _themeModeFromOrNull(server['theme']?.toString());
    if (themeMode != null) {
      next = next.copyWith(themeMode: themeMode);
      _prefs.setString(_kTheme, themeMode.name);
    }

    final accent = _accentKeyFrom(server['themeColor']?.toString());
    if (accent != null) {
      next = next.copyWith(accent: accent);
      _prefs.setString(_kAccent, accent);
    }

    final language = _validLanguage(server['language']?.toString());
    if (language != null) {
      I18n.setLanguage(language);
      next = next.copyWith(language: language);
      _prefs.setString(_kLanguage, language);
    }

    final goal = server['dailyGoal'];
    if (goal is num && goal >= 1 && goal <= 500) {
      next = next.copyWith(dailyGoal: goal.toInt());
      _prefs.setInt(_kDailyGoal, goal.toInt());
    }

    state = next;
  }

  /// Fire-and-forget push of the full local settings to the server.
  /// Called right after registering: a fresh account carries the server
  /// DEFAULT_SETTINGS, which must not clobber the device's pre-auth choices
  /// (detected/chosen language, theme, accent, daily goal).
  void pushLocalSettings() {
    _mirror({
      'language': state.language,
      'theme': state.themeMode.name,
      'themeColor': state.accent,
      'dailyGoal': state.dailyGoal,
    });
  }

  /// Fire-and-forget push of changed values to the server when authed.
  void _mirror(Map<String, dynamic> patch) {
    final authed = ref.read(authProvider).value != null;
    if (!authed) return;
    final api = ref.read(apiProvider);
    unawaited(
      api.put('/user/settings', body: patch).catchError(
            // Best-effort: local state is the source of truth for the device.
            (Object _) => <String, dynamic>{},
          ),
    );
  }

  static String? _validLanguage(String? lang) =>
      lang != null && I18n.supported.contains(lang) ? lang : null;

  static ThemeMode _themeModeFrom(String? name) =>
      _themeModeFromOrNull(name) ?? ThemeMode.system;

  static ThemeMode? _themeModeFromOrNull(String? name) {
    switch (name) {
      case 'dark':
        return ThemeMode.dark;
      case 'light':
        return ThemeMode.light;
      case 'system':
        return ThemeMode.system;
    }
    return null;
  }

  /// Accepts an accent key name, a legacy web color name, or a hex value.
  static String? _accentKeyFrom(String? raw) {
    if (raw == null || raw.isEmpty) return null;
    final value = raw.toLowerCase();
    if (accentColors.containsKey(value)) return value;
    const legacy = {
      'red': 'cinnabar',
      'vermilion': 'cinnabar',
      'green': 'jade',
      'yellow': 'gold',
      'purple': 'violet',
      'teal': 'cyan',
    };
    if (legacy.containsKey(value)) return legacy[value];
    if (value.startsWith('#')) {
      for (final entry in accentColors.entries) {
        final hex =
            '#${(entry.value.toARGB32() & 0xFFFFFF).toRadixString(16).padLeft(6, '0')}';
        if (hex == value) return entry.key;
      }
    }
    return null;
  }
}

final settingsProvider =
    NotifierProvider<SettingsNotifier, AppSettings>(SettingsNotifier.new);

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

/// Authenticated user state.
/// - `AsyncData(null)` — signed out.
/// - `AsyncData(user)` — signed in.
/// - `AsyncLoading` — restoring session / logging in.
/// - `AsyncError` — session restore failed (e.g. offline with stored token).
class AuthNotifier extends AsyncNotifier<UserProfile?> {
  @override
  Future<UserProfile?> build() async {
    final api = ref.read(apiProvider);
    // 401-from-interceptor hook: token already cleared, reset auth state.
    api.onUnauthorized = () {
      state = const AsyncData(null);
    };
    final token = await api.readToken();
    if (token == null || token.isEmpty) return null;
    try {
      final data = await api.get('/auth/me');
      final user =
          UserProfile.fromJson(Map<String, dynamic>.from(data['user'] as Map));
      ref.read(settingsProvider.notifier).applyServerSettings(user.settings);
      return user;
    } on ApiException catch (e) {
      if (e.isNetwork) rethrow; // keep the token, surface the error
      await api.clearToken();
      return null;
    }
  }

  bool get isAuthed => state.value != null;

  Future<void> login(String email, String password) async {
    await _authenticate(
      '/auth/login',
      {'email': email.trim(), 'password': password},
    );
  }

  Future<void> register(String name, String email, String password) async {
    await _authenticate(
      '/auth/register',
      {'name': name.trim(), 'email': email.trim(), 'password': password},
      freshAccount: true,
    );
  }

  Future<void> _authenticate(
    String path,
    Map<String, dynamic> body, {
    bool freshAccount = false,
  }) async {
    final api = ref.read(apiProvider);
    final previous = state;
    state = const AsyncLoading();
    try {
      final data = await api.post(path, body: body);
      final token = data['token']?.toString();
      if (token != null && token.isNotEmpty) {
        await api.saveToken(token);
      }
      final user =
          UserProfile.fromJson(Map<String, dynamic>.from(data['user'] as Map));
      final settings = ref.read(settingsProvider.notifier);
      if (freshAccount) {
        // Registration returns server DEFAULT_SETTINGS (language 'en', dark
        // theme, ...). Adopting them would clobber the device's detected or
        // explicitly chosen language/theme, so instead seed the new account
        // with the current local settings (must happen after state is authed
        // so the mirror is not skipped).
        state = AsyncData(user);
        settings.pushLocalSettings();
      } else {
        // Login: server settings win once, for cross-device sync.
        settings.applyServerSettings(user.settings);
        state = AsyncData(user);
      }
    } on ApiException {
      state = previous.hasValue ? AsyncData(previous.value) : const AsyncData(null);
      rethrow;
    }
  }

  Future<void> logout() async {
    final api = ref.read(apiProvider);
    try {
      await api.post('/auth/logout');
    } on ApiException {
      // Signing out locally is enough; the JWT simply expires server-side.
    }
    await api.clearToken();
    state = const AsyncData(null);
  }

  /// Permanently deletes the account (Play Store requirement).
  /// Throws [ApiException] (e.g. `invalid_credentials`) on failure.
  Future<void> deleteAccount(String password) async {
    final api = ref.read(apiProvider);
    await api.delete('/account', body: {'password': password});
    await api.clearToken();
    state = const AsyncData(null);
  }

  /// Re-fetches the profile (e.g. after a name change).
  Future<void> refresh() async {
    final api = ref.read(apiProvider);
    final token = await api.readToken();
    if (token == null || token.isEmpty) {
      state = const AsyncData(null);
      return;
    }
    try {
      final data = await api.get('/auth/me');
      final user =
          UserProfile.fromJson(Map<String, dynamic>.from(data['user'] as Map));
      state = AsyncData(user);
    } on ApiException catch (e) {
      if (e.isNetwork) return; // keep current state while offline
      await api.clearToken();
      state = const AsyncData(null);
    }
  }
}

final authProvider =
    AsyncNotifierProvider<AuthNotifier, UserProfile?>(AuthNotifier.new);

// ---------------------------------------------------------------------------
// Bundled word packs
// ---------------------------------------------------------------------------

/// Ids of the HSK packs bundled as assets for offline browsing.
const List<String> bundledHskPackIds = [
  'hsk1', 'hsk2', 'hsk3', 'hsk4', 'hsk5', 'hsk6', // assets/words/<id>.json
];

/// Lazily loads a bundled HSK word pack from assets, e.g.
/// `ref.watch(wordPacksProvider('hsk1'))`.
final wordPacksProvider =
    FutureProvider.family<List<Word>, String>((ref, packId) async {
  final id = packId.toLowerCase();
  final raw = await rootBundle.loadString('assets/words/$id.json');
  final decoded = jsonDecode(raw);
  if (decoded is! List) return const [];
  return [
    for (final entry in decoded)
      if (entry is Map) Word.fromJson(Map<String, dynamic>.from(entry)),
  ];
});
