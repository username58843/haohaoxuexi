import 'dart:async';
import 'dart:convert';
import 'dart:ui' as ui show PlatformDispatcher;

import 'package:flutter/material.dart' show ThemeMode;
import 'package:flutter/services.dart' show rootBundle;
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'api.dart';
import 'firebase_bootstrap.dart';
import 'i18n.dart';
import 'models.dart';
import 'reminders.dart';
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
    this.reminderEnabled = false,
    this.reminderMinutes = 20 * 60,
  });

  final ThemeMode themeMode;

  /// Key into [accentColors].
  final String accent;

  /// 'en' | 'ru' | 'tk' | 'zh'
  final String language;
  final int dailyGoal;
  final bool onboardingDone;

  /// Daily review reminder — device-local (never mirrored to the server):
  /// opt-in flag + time as minutes after local midnight (0..1439).
  final bool reminderEnabled;
  final int reminderMinutes;

  AppSettings copyWith({
    ThemeMode? themeMode,
    String? accent,
    String? language,
    int? dailyGoal,
    bool? onboardingDone,
    bool? reminderEnabled,
    int? reminderMinutes,
  }) {
    return AppSettings(
      themeMode: themeMode ?? this.themeMode,
      accent: accent ?? this.accent,
      language: language ?? this.language,
      dailyGoal: dailyGoal ?? this.dailyGoal,
      onboardingDone: onboardingDone ?? this.onboardingDone,
      reminderEnabled: reminderEnabled ?? this.reminderEnabled,
      reminderMinutes: reminderMinutes ?? this.reminderMinutes,
    );
  }
}

class SettingsNotifier extends Notifier<AppSettings> {
  static const _kTheme = 'theme';
  static const _kAccent = 'accent';
  static const _kLanguage = 'language';
  static const _kDailyGoal = 'dailyGoal';
  static const _kOnboardingDone = 'onboardingDone';
  static const _kReminderEnabled = 'reminderEnabled';
  static const _kReminderMinutes = 'reminderMinutes';

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
      reminderEnabled: p.getBool(_kReminderEnabled) ?? false,
      reminderMinutes: p.getInt(_kReminderMinutes) ?? 20 * 60,
    );
    I18n.setLanguage(settings.language);
    // Re-arm the daily reminder on every launch: inexact alarms don't
    // survive force-stop/reinstall reliably, and re-arming also refreshes
    // the notification text after a language change.
    if (settings.reminderEnabled) {
      unawaited(Reminders.scheduleDaily(
          settings.reminderMinutes ~/ 60, settings.reminderMinutes % 60));
    }
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
    // Server contract: PUT /user/settings validates dailyGoal as 5..500.
    final clamped = goal.clamp(5, 500);
    state = state.copyWith(dailyGoal: clamped);
    _prefs.setInt(_kDailyGoal, clamped);
    _mirror({'dailyGoal': clamped});
  }

  void setOnboardingDone() {
    state = state.copyWith(onboardingDone: true);
    _prefs.setBool(_kOnboardingDone, true);
  }

  // Reminder settings are device-local by design: intentionally NOT mirrored
  // to PUT /user/settings and NOT read in applyServerSettings — notification
  // preferences belong to the device, not the account.

  void setReminderEnabled(bool enabled) {
    state = state.copyWith(reminderEnabled: enabled);
    _prefs.setBool(_kReminderEnabled, enabled);
    if (enabled) {
      unawaited(Reminders.scheduleDaily(
          state.reminderMinutes ~/ 60, state.reminderMinutes % 60));
    } else {
      unawaited(Reminders.cancel());
    }
  }

  void setReminderTime(int minutesOfDay) {
    final clamped = minutesOfDay.clamp(0, 24 * 60 - 1);
    state = state.copyWith(reminderMinutes: clamped);
    _prefs.setInt(_kReminderMinutes, clamped);
    if (state.reminderEnabled) {
      unawaited(Reminders.scheduleDaily(clamped ~/ 60, clamped % 60));
    }
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
    if (goal is num && goal >= 5 && goal <= 500) {
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

  void resetToDeviceLanguage() {
    final detected = _detectDeviceLanguage();
    if (state.language == detected) return;
    I18n.setLanguage(detected);
    state = state.copyWith(language: detected);
    _prefs.setString(_kLanguage, detected);
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
      FirebaseBootstrap.setUserId(null);
    };
    final token = await api.readToken();
    if (token == null || token.isEmpty) {
      FirebaseBootstrap.setUserId(null);
      return null;
    }
    try {
      final data = await api.get('/auth/me');
      final user =
          UserProfile.fromJson(Map<String, dynamic>.from(data['user'] as Map));
      ref.read(settingsProvider.notifier).applyServerSettings(user.settings);
      // Segment analytics/crash reports per account (no-op without Firebase).
      FirebaseBootstrap.setUserId(user.id);
      return user;
    } on ApiException catch (e) {
      if (e.isNetwork) rethrow; // keep the token, surface the error
      await api.clearToken();
      FirebaseBootstrap.setUserId(null);
      return null;
    }
  }

  bool get isAuthed => state.value != null;

  Future<void> login(String email, String password, {String captchaToken = ''}) async {
    await _authenticate(
      '/auth/login',
      {'email': email.trim(), 'password': password, 'captchaToken': captchaToken},
    );
  }

  Future<void> register(String name, String email, String password, {String captchaToken = '', String lang = 'en'}) async {
    final api = ref.read(apiProvider);
    await api.post('/auth/register',
        body: {'name': name.trim(), 'email': email.trim(), 'password': password, 'captchaToken': captchaToken, 'lang': lang});
    // Email verification required — user is NOT logged in.
  }

  Future<void> verifyEmail(String email, String code) async {
    final api = ref.read(apiProvider);
    final data = await api.post('/auth/verify-email',
        body: {'email': email.trim(), 'code': code.trim()});
    final token = data['token']?.toString();
    if (token != null && token.isNotEmpty) {
      await api.saveToken(token);
    }
    final user =
        UserProfile.fromJson(Map<String, dynamic>.from(data['user'] as Map));
    // Verification is the first real sign-in of a FRESH account: the server
    // still carries DEFAULT_SETTINGS (dark theme, jade, goal 20; only the
    // language was seeded at register). Adopting them would clobber the
    // device's pre-auth choices, so seed the account with the local settings
    // instead (state must be authed first or the mirror is skipped).
    // Unverified accounts can never customize server settings (settings PUT
    // requires a token, tokens are only issued after verification), so
    // nothing meaningful can be lost here.
    state = AsyncData(user);
    FirebaseBootstrap.setUserId(user.id);
    ref.read(settingsProvider.notifier).pushLocalSettings();
  }

  Future<void> _authenticate(String path, Map<String, dynamic> body) async {
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
      // Login: server settings win once, for cross-device sync.
      // (Fresh accounts never reach this path — registration goes through
      // register() + verifyEmail(), which seeds the account with the local
      // settings instead.)
      ref.read(settingsProvider.notifier).applyServerSettings(user.settings);
      state = AsyncData(user);
      FirebaseBootstrap.setUserId(user.id);
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
    FirebaseBootstrap.setUserId(null);
    ref.read(settingsProvider.notifier).resetToDeviceLanguage();
  }

  /// Permanently deletes the account (Play Store requirement).
  /// Throws [ApiException] (e.g. `invalid_credentials`) on failure.
  Future<void> deleteAccount(String password) async {
    final api = ref.read(apiProvider);
    await api.delete('/account', body: {'password': password});
    await api.clearToken();
    state = const AsyncData(null);
    FirebaseBootstrap.setUserId(null);
  }

  /// Sends a password-reset email. Always returns successfully to prevent
  /// email enumeration — the server returns 200 regardless.
  Future<void> forgotPassword(String email, {String captchaToken = ''}) async {
    final api = ref.read(apiProvider);
    await api.post('/auth/forgot-password',
        body: {'email': email.trim(), 'captchaToken': captchaToken});
  }

  /// Resets the password using a token from the email link.
  Future<void> resetPassword(String token, String password) async {
    final api = ref.read(apiProvider);
    await api.post('/auth/reset-password',
        body: {'token': token, 'password': password});
  }

  /// Requests a verification email to be sent.
  Future<void> sendVerification({String? email}) async {
    final api = ref.read(apiProvider);
    email ??= state.value?.email;
    if (email == null) return;
    await api.post('/auth/send-verification',
        body: {'email': email});
  }

  /// Re-fetches the profile (e.g. after a name change).
  Future<void> refresh() async {
    final api = ref.read(apiProvider);
    final token = await api.readToken();
    if (token == null || token.isEmpty) {
      state = const AsyncData(null);
      FirebaseBootstrap.setUserId(null);
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
      FirebaseBootstrap.setUserId(null);
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
