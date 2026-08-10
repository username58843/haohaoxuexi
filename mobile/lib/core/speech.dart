import 'dart:io' show Platform;

import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:flutter_tts/flutter_tts.dart';

/// TTS via the platform speech engine — Flutter port of the web `lib/speech.js`.
///
/// Mandarin is the main use (word cards, example sentences), but the quiz can
/// also read a *meaning* out loud, which has to use the UI language — so the
/// engine is configured per language instead of being zh-only. Every new
/// utterance cancels the previous one.
///
/// Voice quality: instead of the engine's default (often a robotic local
/// voice), the best available voice for the target locale is picked explicitly:
///  1. the Google speech engine is preferred on Android when installed
///     (`com.google.android.tts` — noticeably closer to a native speaker
///     than most vendor engines);
///  2. among that locale's voices, network voices beat local ones and
///     higher `quality`/`x-...` variants beat plain defaults (Android voice
///     names look like `cmn-cn-x-ssa-network`).
class Speech {
  Speech._();

  static final FlutterTts _tts = FlutterTts();
  static Future<bool>? _engineReady;

  static const String _googleEngine = 'com.google.android.tts';

  /// UI language code → preferred BCP-47 locale, with fallbacks in order.
  static const Map<String, List<String>> _localesByLang = {
    'zh': ['zh-CN', 'zh'],
    'ru': ['ru-RU', 'ru'],
    'en': ['en-US', 'en'],
    'tk': ['tk-TM', 'tk'],
  };

  /// flutter_tts treats 0.5 as the normal rate. The web reads Mandarin at 0.85
  /// of normal (0.5 × 0.85 ≈ 0.42); prose runs at the normal rate.
  static const Map<String, double> _rateByLang = {'zh': 0.42};

  /// Resolved locale per language; the key is present once resolution ran,
  /// with a null value meaning "this device cannot speak that language".
  static final Map<String, String?> _resolvedLocale = {};
  static final Map<String, Map<String, String>?> _voiceByLocale = {};

  /// Language the engine is currently configured for — avoids re-issuing
  /// setLanguage/setVoice/setSpeechRate for consecutive utterances.
  static String? _currentLang;

  /// One-time engine selection. Resolves to false when the platform has no
  /// usable TTS engine (speak then no-ops, mirroring the web `canSpeak()`).
  static Future<bool> _ensureEngine() {
    return _engineReady ??= () async {
      try {
        await _pickEngine();
        // Neutral pitch — pitch shifts make Mandarin tones sound off.
        await _tts.setPitch(1.0);
        return true;
      } catch (_) {
        return false;
      }
    }();
  }

  /// Switch to the Google TTS engine on Android when it is installed and not
  /// already the default. Best-effort: any failure keeps the default engine.
  static Future<void> _pickEngine() async {
    if (kIsWeb || !Platform.isAndroid) return;
    try {
      final engines = await _tts.getEngines;
      if (engines is! List) return;
      final ids = [for (final e in engines) e.toString()];
      if (!ids.contains(_googleEngine)) return;
      final current = await _tts.getDefaultEngine;
      if (current?.toString() == _googleEngine) return;
      await _tts.setEngine(_googleEngine);
    } catch (_) {
      // Keep whatever engine the device defaults to.
    }
  }

  /// First locale from [_localesByLang] the engine reports as available, or
  /// null when it can speak none of them (e.g. Turkmen on most devices).
  static Future<String?> _resolveLocale(String lang) async {
    if (_resolvedLocale.containsKey(lang)) return _resolvedLocale[lang];
    String? found;
    for (final locale in _localesByLang[lang] ?? const <String>[]) {
      try {
        if (await _tts.isLanguageAvailable(locale) == true) {
          found = locale;
          break;
        }
      } catch (_) {
        // Engine cannot answer — treat as unavailable and try the next one.
      }
    }
    _resolvedLocale[lang] = found;
    return found;
  }

  /// Points the engine at [lang]. Returns false when the device has no voice
  /// for it, so the caller stays silent instead of reading text with a
  /// wrong-language voice.
  static Future<bool> _applyLanguage(String lang) async {
    if (_currentLang == lang) return true;
    final locale = await _resolveLocale(lang);
    if (locale == null) return false;
    try {
      await _tts.setLanguage(locale);
      final voice = await _pickBestVoice(locale);
      if (voice != null) await _tts.setVoice(voice);
      await _tts.setSpeechRate(_rateByLang[lang] ?? 0.5);
      _currentLang = lang;
      return true;
    } catch (_) {
      return false;
    }
  }

  /// Score-and-pick the most natural voice the engine offers for [locale].
  static Future<Map<String, String>?> _pickBestVoice(String locale) async {
    if (_voiceByLocale.containsKey(locale)) return _voiceByLocale[locale];

    Map<String, String>? best;
    try {
      final voices = await _tts.getVoices;
      // Voice listing unsupported — the engine default is still usable, and
      // this is not cached as a decision since the list may appear later.
      if (voices is! List) return null;

      final wanted = locale.toLowerCase().replaceAll('_', '-');
      final primary = wanted.split('-').first;
      final isChinese = primary == 'zh';
      var bestScore = -1;

      for (final raw in voices) {
        if (raw is! Map) continue;
        final name = raw['name']?.toString() ?? '';
        final voiceLocale = raw['locale']?.toString() ?? '';
        if (name.isEmpty || voiceLocale.isEmpty) continue;

        final loc = voiceLocale.toLowerCase().replaceAll('_', '-');
        var score = 0;
        // Mandarin (mainland) also shows up as cmn-cn on some engines. Other
        // zh variants (Cantonese/Taiwanese) only count as a weak fallback so
        // the pronunciation matches the pinyin shown on the cards.
        if (loc == wanted || (isChinese && loc == 'cmn-cn')) {
          score += 10;
        } else if (loc.split('-').first == primary ||
            (isChinese && loc.startsWith('cmn'))) {
          score += 4;
        } else {
          continue;
        }

        final n = name.toLowerCase();
        // Network voices are the neural, near-native ones.
        if (n.contains('network')) score += 8;
        // Enhanced/premium local variants still beat the plain default.
        if (n.contains('enhanced') || n.contains('premium')) score += 4;
        if (n.contains('-x-')) score += 2; // named Google voice families

        if (score > bestScore) {
          bestScore = score;
          best = {'name': name, 'locale': voiceLocale};
        }
      }
      _voiceByLocale[locale] = best;
    } catch (_) {
      return null;
    }
    return best;
  }

  /// Speaks [text] in [lang] ('zh' | 'ru' | 'en' | 'tk'), cancelling any
  /// ongoing utterance. Returns false when the device cannot speak it.
  static Future<bool> speak(String text, {String lang = 'zh'}) async {
    if (text.isEmpty) return false;
    if (!await _ensureEngine()) return false;
    final target = _localesByLang.containsKey(lang) ? lang : 'en';
    if (!await _applyLanguage(target)) return false;
    try {
      await _tts.stop();
      await _tts.speak(text);
      return true;
    } catch (_) {
      return false;
    }
  }

  /// Speak [text] with the Mandarin voice (same contract as the web
  /// `speakChinese`).
  static Future<bool> speakChinese(String text) => speak(text, lang: 'zh');
}
