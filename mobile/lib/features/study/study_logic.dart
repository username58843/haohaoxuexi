import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../../core/i18n.dart';
import '../../core/models.dart';
import '../../core/theme.dart';

/// Session logic for the study screen, mirroring the web
/// `components/learn/session-utils.js`:
/// - client-side SM-2 interval previews (ARCHITECTURE.md §7) for grade buttons
/// - multiple-choice quiz building over the five question modes
///   (汉字→Pinyin, Pinyin→汉字, 汉字→Meaning, Meaning→汉字, Meaning→Pinyin)
///   + the [QmodeLabel] widget.

/// Predicts the next interval (in days) for [card] if graded with [grade]
/// (0 Again · 1 Hard · 2 Good · 3 Easy). Mirrors the server SM-2 variant —
/// used only for the small hints under the grade buttons.
double nextIntervalDays(SrsCard card, int grade) {
  const minute = 1 / (24 * 60);
  if (card.state != 'review') {
    // new / learning
    return switch (grade) {
      0 => 10 * minute,
      1 => 30 * minute,
      3 => 3,
      _ => 1,
    };
  }
  if (grade == 0) return 10 * minute;
  final interval = card.intervalDays <= 0 ? 1.0 : card.intervalDays;
  final ease = math.max(1.3, card.ease);
  final next = switch (grade) {
    1 => math.max(interval * 1.2, interval + 0.5),
    3 => interval * ease * 1.3,
    _ => interval * ease,
  };
  return math.min(next, 365);
}

/// Compact interval label: `10m`, `2h`, `3d`, `4mo`, `1y`.
/// Unit suffixes are localized via [tr] (`time.*` keys) so the grade-button
/// hints follow the UI language.
String formatInterval(double days) {
  if (days < 1) {
    final minutes = (days * 24 * 60).round();
    if (minutes < 60) {
      return '${math.max(1, minutes)}${tr(null, 'time.m', 'm')}';
    }
    return '${(minutes / 60).round()}${tr(null, 'time.h', 'h')}';
  }
  if (days < 30) {
    return '${math.max(1, days.round())}${tr(null, 'time.d', 'd')}';
  }
  if (days < 360) {
    return '${(days / 30.44).round()}${tr(null, 'time.mo', 'mo')}';
  }
  return '${(days / 365).round()}${tr(null, 'time.y', 'y')}';
}

// -----------------------------------------------------------------------------
// Question modes (web `ALL_QMODES` / `QMODE_DEFS`)
// -----------------------------------------------------------------------------

/// The word field a question mode shows or asks for.
enum QuizField { hanzi, pinyin, meaning }

/// Question-mode ids, identical to the web:
/// `cp` 汉字→Pinyin · `pc` Pinyin→汉字 · `ct` 汉字→Meaning · `tc` Meaning→汉字 ·
/// `tp` Meaning→Pinyin.
const List<String> kAllQmodes = ['cp', 'pc', 'ct', 'tc', 'tp'];

/// prompt/answer field per question mode (web `QMODE_DEFS`).
const Map<String, ({QuizField prompt, QuizField answer})> kQmodeDefs = {
  'cp': (prompt: QuizField.hanzi, answer: QuizField.pinyin),
  'pc': (prompt: QuizField.pinyin, answer: QuizField.hanzi),
  'ct': (prompt: QuizField.hanzi, answer: QuizField.meaning),
  'tc': (prompt: QuizField.meaning, answer: QuizField.hanzi),
  'tp': (prompt: QuizField.meaning, answer: QuizField.pinyin),
};

class QuizQuestion {
  const QuizQuestion({
    required this.word,
    required this.qmode,
    required this.prompt,
    required this.options,
    required this.correctIndex,
  });

  final Word word;

  /// One of [kAllQmodes].
  final String qmode;

  /// Display text of the prompt side (hanzi, pinyin or meaning).
  final String prompt;

  /// 1–4 answer strings, already shuffled.
  final List<String> options;
  final int correctIndex;

  QuizField get promptType => kQmodeDefs[qmode]!.prompt;
  QuizField get answerType => kQmodeDefs[qmode]!.answer;
  String get answer => options[correctIndex];
}

/// Best display meaning for [word] in the given UI [language]
/// (web `meaningLine`: the UI language's translation is preferred).
String quizMeaning(Word word, String language) {
  if (language == 'ru' && word.ru.isNotEmpty) return word.ru.first;
  if (language == 'tk' && word.tk.isNotEmpty) return word.tk.first;
  if (word.definitions.isNotEmpty) return word.definitions.first;
  if (word.en.isNotEmpty) return word.en.first;
  if (word.ru.isNotEmpty) return word.ru.first;
  if (word.tk.isNotEmpty) return word.tk.first;
  return '';
}

/// Display text of a word [field] (web `fieldText`).
String _fieldText(Word word, QuizField field, String language) =>
    switch (field) {
      QuizField.hanzi => word.simplified,
      QuizField.pinyin => word.pinyin,
      QuizField.meaning => quizMeaning(word, language),
    };

/// Which of the requested modes this word can actually be asked in
/// (web `modesForWord`: both the prompt and the answer side must be non-empty).
List<String> _modesForWord(Word word, List<String> modes, String language) => [
      for (final m in modes)
        if (_fieldText(word, kQmodeDefs[m]!.prompt, language).isNotEmpty &&
            _fieldText(word, kQmodeDefs[m]!.answer, language).isNotEmpty)
          m,
    ];

String _norm(String s) => s.trim().toLowerCase();

/// Builds the whole quiz upfront (web `buildQuizQuestions`). Each question
/// gets a random eligible mode out of [qmodes], the correct answer plus up to
/// 3 distractors with unique word ids AND unique display texts — fewer than
/// 4 options is accepted when the pool is small. `count <= 0` means "the
/// whole pool" (deck Study buttons pass count=0).
List<QuizQuestion> buildQuiz(
  List<Word> pool,
  List<String> qmodes,
  int count,
  String language, {
  math.Random? random,
}) {
  final rng = random ?? math.Random();
  final modes = [
    for (final m in qmodes)
      if (kQmodeDefs.containsKey(m)) m,
  ];
  if (modes.isEmpty) return const [];

  // Dedupe by canonical id, drop unusable entries.
  final seen = <String>{};
  final words = [
    for (final w in pool)
      if (w.simplified.isNotEmpty && seen.add(w.id)) w,
  ];

  // Only words that can be asked in at least one of the selected modes.
  final eligible = [
    for (final w in words)
      if (_modesForWord(w, modes, language).isNotEmpty) w,
  ]..shuffle(rng);
  final picked = count > 0 ? eligible.take(count) : eligible;

  final questions = <QuizQuestion>[];
  for (final word in picked) {
    final wordModes = _modesForWord(word, modes, language);
    final qmode = wordModes[rng.nextInt(wordModes.length)];
    final def = kQmodeDefs[qmode]!;
    final correct = _fieldText(word, def.answer, language);
    final promptNorm = _norm(_fieldText(word, def.prompt, language));
    final usedTexts = {_norm(correct)};
    final usedIds = {word.id};
    final options = [correct];

    final candidates = [...words]..shuffle(rng);
    for (final cand in candidates) {
      if (options.length >= 4) break;
      if (usedIds.contains(cand.id)) continue;
      // Skip candidates that share the prompt (e.g. 他/她 both "tā", or the
      // 还 hái/huán homograph) — they'd be a second valid answer, not a
      // distractor.
      if (_norm(_fieldText(cand, def.prompt, language)) == promptNorm) {
        continue;
      }
      final text = _fieldText(cand, def.answer, language);
      if (text.isEmpty || usedTexts.contains(_norm(text))) continue;
      usedIds.add(cand.id);
      usedTexts.add(_norm(text));
      options.add(text);
    }

    options.shuffle(rng);
    questions.add(QuizQuestion(
      word: word,
      qmode: qmode,
      prompt: _fieldText(word, def.prompt, language),
      options: options,
      correctIndex: options.indexOf(correct),
    ));
  }
  return questions;
}

/// Reinforce the Chinese word, including meaning-to-hanzi question modes.
({String text, String lang})? speechForQuestion(
    QuizQuestion question, String language) {
  if (!kQmodeDefs.containsKey(question.qmode)) return null;
  final text = question.word.simplified;
  return text.isEmpty ? null : (text: text, lang: 'zh');
}

/// Human label for a question mode, e.g. 汉字 → Pinyin (web `QmodeLabel`):
/// 汉字 is rendered in the hanzi serif, the Pinyin/Meaning side is a localized
/// `learn.pinyin` / `learn.meaning` string. The Chinese side is spelled 汉字
/// (the actual word for "Chinese characters") rather than the bare 字, which on
/// its own reads as "character/word" and left users guessing.
class QmodeLabel extends StatelessWidget {
  const QmodeLabel(
    this.mode, {
    super.key,
    this.style,
    this.hanziSize = 14,
    this.uppercase = false,
  });

  /// One of [kAllQmodes].
  final String mode;

  /// Base style for the non-hanzi parts (inherited when null, e.g. in chips).
  final TextStyle? style;
  final double hanziSize;

  /// Uppercases the Pinyin/Meaning words — for eyebrow contexts, matching the
  /// web `.eyebrow` text-transform.
  final bool uppercase;

  @override
  Widget build(BuildContext context) {
    String label(String key, String enDefault) {
      final s = tr(context, key, enDefault);
      return uppercase ? s.toUpperCase() : s;
    }

    final pinyin = label('learn.pinyin', 'Pinyin');
    final meaning = label('learn.meaning', 'Meaning');
    final hanzi = TextSpan(
      text: '汉字',
      style: hanziStyle(context, size: hanziSize, color: style?.color),
    );
    final parts = switch (mode) {
      'cp' => [hanzi, TextSpan(text: ' → $pinyin')],
      'pc' => [TextSpan(text: '$pinyin → '), hanzi],
      'ct' => [hanzi, TextSpan(text: ' → $meaning')],
      'tp' => [TextSpan(text: '$meaning → $pinyin')],
      _ => [TextSpan(text: '$meaning → '), hanzi],
    };
    return Text.rich(
      TextSpan(style: style, children: parts),
      maxLines: 1,
      overflow: TextOverflow.ellipsis,
    );
  }
}
