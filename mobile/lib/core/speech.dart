import 'package:flutter_tts/flutter_tts.dart';

/// Chinese TTS via the platform speech engine — Flutter port of the web
/// `lib/speech.js` (Web Speech API wrapper): Mandarin (zh-CN) voice with a
/// slightly slowed rate, and every new utterance cancels the previous one.
class Speech {
  Speech._();

  static final FlutterTts _tts = FlutterTts();
  static Future<bool>? _ready;

  /// One-time engine configuration. Resolves to false when the platform has
  /// no usable TTS engine (the speak call then no-ops, mirroring the web
  /// `canSpeak()` guard).
  static Future<bool> _configure() {
    return _ready ??= () async {
      try {
        // Prefer zh-CN (the web voice picker does the same), fall back to a
        // plain `zh` locale when the engine reports zh-CN as unavailable.
        var lang = 'zh-CN';
        if (await _tts.isLanguageAvailable('zh-CN') != true &&
            await _tts.isLanguageAvailable('zh') == true) {
          lang = 'zh';
        }
        await _tts.setLanguage(lang);
        // The web uses rate 0.85 (1.0 = normal); flutter_tts treats 0.5 as
        // the normal rate, so 0.5 × 0.85 ≈ 0.42.
        await _tts.setSpeechRate(0.42);
        return true;
      } catch (_) {
        return false;
      }
    }();
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
