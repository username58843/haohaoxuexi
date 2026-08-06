import 'dart:io' show Platform;

import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:flutter_tts/flutter_tts.dart';

/// Chinese TTS via the platform speech engine — Flutter port of the web
/// `lib/speech.js` (Web Speech API wrapper): Mandarin voice with a slightly
/// slowed rate, and every new utterance cancels the previous one.
///
/// Voice quality: instead of the engine's default (often a robotic local
/// voice), the best available Mandarin voice is picked explicitly:
///  1. the Google speech engine is preferred on Android when installed
///     (`com.google.android.tts` — noticeably closer to a native speaker
///     than most vendor engines);
///  2. among the engine's zh-CN voices, network voices beat local ones and
///     higher `quality`/`x-...` variants beat plain defaults (Android voice
///     names look like `cmn-cn-x-ssa-network`).
class Speech {
  Speech._();

  static final FlutterTts _tts = FlutterTts();
  static Future<bool>? _ready;

  static const String _googleEngine = 'com.google.android.tts';

  /// One-time engine configuration. Resolves to false when the platform has
  /// no usable TTS engine (the speak call then no-ops, mirroring the web
  /// `canSpeak()` guard).
  static Future<bool> _configure() {
    return _ready ??= () async {
      try {
        await _pickEngine();

        // Prefer zh-CN (the web voice picker does the same), fall back to a
        // plain `zh` locale when the engine reports zh-CN as unavailable.
        var lang = 'zh-CN';
        if (await _tts.isLanguageAvailable('zh-CN') != true &&
            await _tts.isLanguageAvailable('zh') == true) {
          lang = 'zh';
        }
        await _tts.setLanguage(lang);
        await _pickBestVoice(lang);

        // The web uses rate 0.85 (1.0 = normal); flutter_tts treats 0.5 as
        // the normal rate, so 0.5 × 0.85 ≈ 0.42. Neutral pitch — pitch
        // shifts make Mandarin tones sound off.
        await _tts.setSpeechRate(0.42);
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

  /// Score-and-pick the most natural Mandarin voice the engine offers.
  static Future<void> _pickBestVoice(String lang) async {
    try {
      final voices = await _tts.getVoices;
      if (voices is! List) return;

      Map<String, String>? best;
      var bestScore = -1;
      for (final raw in voices) {
        if (raw is! Map) continue;
        final name = raw['name']?.toString() ?? '';
        final locale = raw['locale']?.toString() ?? '';
        if (name.isEmpty || locale.isEmpty) continue;

        final loc = locale.toLowerCase().replaceAll('_', '-');
        // Mandarin (mainland) only — skip Cantonese/Taiwanese variants so the
        // pronunciation matches the pinyin shown on the cards.
        final isMandarin = loc == 'zh-cn' || loc == 'cmn-cn' ||
            (lang == 'zh' && loc.startsWith('zh'));
        if (!isMandarin) continue;

        var score = 1;
        final n = name.toLowerCase();
        // Network voices are the neural, near-native ones.
        if (n.contains('network')) score += 8;
        // Enhanced/premium local variants still beat the plain default.
        if (n.contains('enhanced') || n.contains('premium')) score += 4;
        if (n.contains('-x-')) score += 2; // named Google voice families
        if (loc == 'zh-cn' || loc == 'cmn-cn') score += 1;

        if (score > bestScore) {
          bestScore = score;
          best = {'name': name, 'locale': locale};
        }
      }

      if (best != null) await _tts.setVoice(best);
    } catch (_) {
      // Voice listing unsupported — the engine default is still usable.
    }
  }

  /// Speak [text] with the Mandarin voice, cancelling any ongoing utterance
  /// (same contract as the web `speakChinese`).
  static Future<bool> speakChinese(String text) async {
    if (text.isEmpty) return false;
    if (!await _configure()) return false;
    try {
      await _tts.stop();
      await _tts.speak(text);
      return true;
    } catch (_) {
      return false;
    }
  }
}
