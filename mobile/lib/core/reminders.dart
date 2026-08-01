import 'package:flutter/foundation.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:flutter_timezone/flutter_timezone.dart';
import 'package:timezone/data/latest.dart' as tz_data;
import 'package:timezone/timezone.dart' as tz;

import 'i18n.dart';

/// Local daily review reminder (opt-in; see the reminder fields on
/// AppSettings — they are device-local and never mirrored to the server).
///
/// Mirrors the FirebaseBootstrap philosophy: every method is a safe no-op
/// that never throws — a missing platform implementation or an exotic
/// timezone must never take the app down.
class Reminders {
  Reminders._();

  /// Stable id of the single daily reminder notification.
  static const int _notificationId = 1001;
  static const String _channelId = 'daily_reminder';

  static final FlutterLocalNotificationsPlugin _plugin =
      FlutterLocalNotificationsPlugin();

  static bool _ready = false;

  /// Whether the timezone database resolved the device zone; when false,
  /// scheduling falls back to a fixed UTC instant (see [_nextInstanceOf]).
  static bool _tzReady = false;

  /// Whether the plugin initialized successfully this launch.
  static bool get isReady => _ready;

  /// Initialize the plugin and the timezone database.
  ///
  /// Call once from `main()` before runApp (the settings notifier re-arms
  /// the reminder during the first frame). Never throws.
  static Future<void> init() async {
    try {
      tz_data.initializeTimeZones();
      await _plugin.initialize(
        const InitializationSettings(
          android: AndroidInitializationSettings('@mipmap/ic_launcher'),
        ),
      );
      _ready = true;
    } catch (e) {
      debugPrint('[reminders] init failed, continuing without reminders: $e');
      return;
    }
    try {
      // flutter_timezone 3.x returns the IANA name as a String while 4.x
      // wraps it in a TimezoneInfo — resolve dynamically so either works.
      final dynamic info = await FlutterTimezone.getLocalTimezone();
      final name = info is String ? info : info.identifier as String;
      tz.setLocalLocation(tz.getLocation(name));
      _tzReady = true;
    } catch (e) {
      debugPrint('[reminders] device timezone lookup failed, '
          'falling back to UTC instants: $e');
    }
  }

  /// Android 13+ runtime notification permission (auto-granted below 13).
  /// Returns false only when the user explicitly denied it.
  static Future<bool> requestPermission() async {
    if (!_ready) return false;
    try {
      final android = _plugin.resolvePlatformSpecificImplementation<
          AndroidFlutterLocalNotificationsPlugin>();
      final granted = await android?.requestNotificationsPermission();
      return granted ?? true;
    } catch (e) {
      debugPrint('[reminders] permission request failed: $e');
      return true;
    }
  }

  /// (Re)schedule the repeating daily reminder at [hour]:[minute] local time.
  ///
  /// The notification text is resolved via tr() at schedule time, so it
  /// follows the UI language that was current when the reminder was
  /// (re)armed — the settings notifier re-arms on every launch.
  static Future<void> scheduleDaily(int hour, int minute) async {
    if (!_ready) return;
    try {
      await _plugin.zonedSchedule(
        _notificationId,
        tr(null, 'reminder.notif.title', 'Time to review'),
        tr(null, 'reminder.notif.body',
            'Your cards are waiting — a few minutes keeps the streak alive.'),
        _nextInstanceOf(hour, minute),
        NotificationDetails(
          android: AndroidNotificationDetails(
            _channelId,
            tr(null, 'reminder.channel.name', 'Daily reminders'),
            channelDescription:
                tr(null, 'reminder.channel.desc', 'Daily review reminder'),
          ),
        ),
        // Inexact by design: a review nudge does not justify the Android 12+
        // exact-alarm permission dance.
        androidScheduleMode: AndroidScheduleMode.inexactAllowWhileIdle,
        matchDateTimeComponents: DateTimeComponents.time,
      );
    } catch (e) {
      debugPrint('[reminders] scheduling failed: $e');
    }
  }

  /// Cancel the daily reminder (toggle switched off).
  static Future<void> cancel() async {
    if (!_ready) return;
    try {
      await _plugin.cancel(_notificationId);
    } catch (e) {
      debugPrint('[reminders] cancel failed: $e');
    }
  }

  /// Next occurrence of [hour]:[minute] — in the device zone when known,
  /// otherwise the equivalent UTC instant. The UTC fallback repeats at a
  /// fixed UTC time, which equals a fixed local time in the app's non-DST
  /// audience zones (CN/TM/RU); a launch re-arm corrects any drift.
  static tz.TZDateTime _nextInstanceOf(int hour, int minute) {
    if (_tzReady) {
      final now = tz.TZDateTime.now(tz.local);
      var scheduled =
          tz.TZDateTime(tz.local, now.year, now.month, now.day, hour, minute);
      if (!scheduled.isAfter(now)) {
        scheduled = scheduled.add(const Duration(days: 1));
      }
      return scheduled;
    }
    final now = DateTime.now();
    var local = DateTime(now.year, now.month, now.day, hour, minute);
    if (!local.isAfter(now)) local = local.add(const Duration(days: 1));
    return tz.TZDateTime.from(local.toUtc(), tz.UTC);
  }
}
