import 'dart:math' as math;

import '../../core/models.dart';

/// Pure session logic for the study screen:
/// - client-side SM-2 interval previews (ARCHITECTURE.md §7) for grade buttons
/// - multiple-choice quiz building (4 options, mixed directions).

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
String formatInterval(double days) {
  if (days < 1) {
    final minutes = (days * 24 * 60).round();
    if (minutes < 60) return '${math.max(1, minutes)}m';
    return '${(minutes / 60).round()}h';
  }
  if (days < 30) return '${math.max(1, days.round())}d';
  if (days < 360) return '${(days / 30.44).round()}mo';
  return '${(days / 365).round()}y';
}

/// Quiz question direction: characters → pinyin, or characters → meaning.
enum QuizDirection { pinyin, meaning }

class QuizQuestion {
  const QuizQuestion({
    required this.word,
    required this.direction,
    required this.options,
    required this.correctIndex,
  });

  final Word word;
  final QuizDirection direction;

  /// 2–4 answer strings, already shuffled.
  final List<String> options;
  final int correctIndex;

  String get answer => options[correctIndex];
}

/// Best display meaning for [word] in the given UI [language].
String quizMeaning(Word word, String language) {
  if (language == 'ru' && word.ru.isNotEmpty) return word.ru.first;
  if (word.definitions.isNotEmpty) return word.definitions.first;
  if (word.en.isNotEmpty) return word.en.first;
  if (word.ru.isNotEmpty) return word.ru.first;
  return '';
}

String _answerText(Word word, QuizDirection direction, String language) =>
    direction == QuizDirection.pinyin ? word.pinyin : quizMeaning(word, language);

/// Builds up to [count] MCQ questions out of [pool]. Directions are mixed
/// (chars→pinyin and chars→meaning); distractors come from the same pool.
List<QuizQuestion> buildQuiz(
  List<Word> pool,
  int count,
  String language, {
  math.Random? random,
}) {
  final rng = random ?? math.Random();
  // Dedupe by canonical id, drop unusable entries.
  final seen = <String>{};
  final words = [
    for (final w in pool)
      if (w.simplified.isNotEmpty && w.pinyin.isNotEmpty && seen.add(w.id)) w,
  ];
  words.shuffle(rng);

  // count <= 0 means "the whole pool" (deck Study buttons pass count=0).
  final target = count > 0 ? count : words.length;

  final questions = <QuizQuestion>[];
  for (final word in words) {
    if (questions.length >= target) break;
    final hasMeaning = quizMeaning(word, language).isNotEmpty;
    final direction = hasMeaning && rng.nextBool()
        ? QuizDirection.meaning
        : QuizDirection.pinyin;
    final correct = _answerText(word, direction, language);
    if (correct.isEmpty) continue;

    final distractors = <String>{};
    final candidates = [...words]..shuffle(rng);
    for (final other in candidates) {
      if (distractors.length >= 3) break;
      if (other.id == word.id) continue;
      // A homograph shares the displayed hanzi prompt (还 hái/huán) — its
      // pinyin/meaning would be a second valid answer, not a distractor.
      if (other.simplified == word.simplified) continue;
      final text = _answerText(other, direction, language);
      if (text.isEmpty || text == correct) continue;
      distractors.add(text);
    }
    if (distractors.isEmpty) continue; // can't make a meaningful question

    final options = [correct, ...distractors]..shuffle(rng);
    questions.add(QuizQuestion(
      word: word,
      direction: direction,
      options: options,
      correctIndex: options.indexOf(correct),
    ));
  }
  return questions;
}
