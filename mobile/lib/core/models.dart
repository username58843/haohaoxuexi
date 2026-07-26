/// Data models shared across the app.
///
/// Word id rule (ARCHITECTURE.md §5):
/// `wordId = simplified + '·' + pinyinKey` where `pinyinKey` = pinyin
/// lowercased, tone marks kept, all whitespace/apostrophes removed
/// (e.g. `爱·ài`, `爸爸·bàba`). Must stay identical to `lib/words-shared.js`
/// on the server.
library;

/// Canonical word id — port of `makeWordId` from `lib/words-shared.js`.
String makeWordId(String simplified, String pinyin) {
  final key = pinyin.toLowerCase().replaceAll(RegExp(r"[\s'’ʼ]+"), '');
  return '$simplified·$key';
}

List<String> _strList(dynamic v) =>
    v is List ? [for (final e in v) e.toString()] : const [];

/// A vocabulary word (full pack entry or deck/SRS snapshot).
class Word {
  const Word({
    required this.simplified,
    required this.traditional,
    required this.pinyin,
    this.definitions = const [],
    this.en = const [],
    this.ru = const [],
    this.hsk,
    this.strokes,
    this.radicals,
  });

  final String simplified;
  final String traditional;
  final String pinyin;

  /// Primary gloss lines (language-tagged by pack).
  final List<String> definitions;

  /// Optional translations (`translations.en` / `translations.ru`).
  final List<String> en;
  final List<String> ru;

  final int? hsk;
  final int? strokes;
  final String? radicals;

  /// Canonical id, see [makeWordId].
  String get id => makeWordId(simplified, pinyin);

  factory Word.fromJson(Map<String, dynamic> json) {
    final translations = json['translations'];
    return Word(
      simplified: (json['simplified'] ?? '').toString(),
      traditional: (json['traditional'] ?? json['simplified'] ?? '').toString(),
      pinyin: (json['pinyin'] ?? '').toString(),
      definitions: _strList(json['definitions']),
      en: translations is Map ? _strList(translations['en']) : const [],
      ru: translations is Map ? _strList(translations['ru']) : const [],
      hsk: (json['hsk'] as num?)?.toInt(),
      strokes: (json['strokes'] as num?)?.toInt(),
      radicals: json['radicals']?.toString(),
    );
  }

  /// Full JSON shape (mirrors the pack entry).
  Map<String, dynamic> toJson() => {
        'simplified': simplified,
        'traditional': traditional,
        'pinyin': pinyin,
        'definitions': definitions,
        'translations': {
          if (en.isNotEmpty) 'en': en,
          if (ru.isNotEmpty) 'ru': ru,
        },
        if (hsk != null) 'hsk': hsk,
        if (strokes != null) 'strokes': strokes,
        if (radicals != null) 'radicals': radicals,
      };

  /// Deck/SRS snapshot shape (§5): only the server-validated snapshot fields.
  Map<String, dynamic> toSnapshotJson() => {
        'simplified': simplified,
        'traditional': traditional,
        'pinyin': pinyin,
        'definitions': definitions,
        'translations': {
          if (en.isNotEmpty) 'en': en,
          if (ru.isNotEmpty) 'ru': ru,
        },
      };

  @override
  bool operator ==(Object other) => other is Word && other.id == id;

  @override
  int get hashCode => id.hashCode;
}

/// Per-user per-word SRS state (ARCHITECTURE.md §3 srs_cards, §7 algorithm).
class SrsCard {
  const SrsCard({
    required this.wordId,
    required this.word,
    this.state = 'new',
    this.ease = 2.5,
    this.intervalDays = 0,
    required this.due,
    this.reps = 0,
    this.lapses = 0,
  });

  final String wordId;
  final Word word;

  /// 'new' | 'learning' | 'review'
  final String state;
  final double ease;
  final double intervalDays;
  final DateTime due; // UTC
  final int reps;
  final int lapses;

  bool get isDue => !due.isAfter(DateTime.now().toUtc());
  bool get isNew => state == 'new';

  factory SrsCard.fromJson(Map<String, dynamic> json) {
    final word = json['word'];
    return SrsCard(
      wordId: (json['wordId'] ?? '').toString(),
      word: word is Map
          ? Word.fromJson(Map<String, dynamic>.from(word))
          : const Word(simplified: '', traditional: '', pinyin: ''),
      state: (json['state'] ?? 'new').toString(),
      ease: (json['ease'] as num?)?.toDouble() ?? 2.5,
      intervalDays: (json['intervalDays'] as num?)?.toDouble() ?? 0,
      due: DateTime.tryParse(json['due']?.toString() ?? '')?.toUtc() ??
          DateTime.now().toUtc(),
      reps: (json['reps'] as num?)?.toInt() ?? 0,
      lapses: (json['lapses'] as num?)?.toInt() ?? 0,
    );
  }
}

/// Public user shape returned by the API (ARCHITECTURE.md §6).
class UserProfile {
  const UserProfile({
    required this.id,
    required this.email,
    required this.name,
    this.role = 'user',
    this.isPremium = false,
    this.premiumExpiresAt,
    this.isBanned = false,
    this.settings = const {},
    this.createdAt,
  });

  final String id;
  final String email;
  final String name;
  final String role; // 'user' | 'admin'
  final bool isPremium;
  final DateTime? premiumExpiresAt;
  final bool isBanned;

  /// Raw server settings map: themeColor, language, dailyGoal,
  /// alwaysShowPinyin, alwaysShowTranslation, theme.
  final Map<String, dynamic> settings;
  final DateTime? createdAt;

  bool get isAdmin => role == 'admin';

  factory UserProfile.fromJson(Map<String, dynamic> json) {
    final settings = json['settings'];
    return UserProfile(
      id: (json['id'] ?? json['_id'] ?? '').toString(),
      email: (json['email'] ?? '').toString(),
      name: (json['name'] ?? '').toString(),
      role: (json['role'] ?? 'user').toString(),
      isPremium: json['isPremium'] == true,
      premiumExpiresAt:
          DateTime.tryParse(json['premiumExpiresAt']?.toString() ?? ''),
      isBanned: json['isBanned'] == true,
      settings: settings is Map ? Map<String, dynamic>.from(settings) : const {},
      createdAt: DateTime.tryParse(json['createdAt']?.toString() ?? ''),
    );
  }
}

/// Personal deck (ARCHITECTURE.md §3 decks).
class Deck {
  const Deck({
    required this.id,
    required this.name,
    this.words = const [],
    this.order = 0,
    this.createdAt,
    this.updatedAt,
  });

  final String id;
  final String name;
  final List<Word> words;
  final int order;
  final DateTime? createdAt;
  final DateTime? updatedAt;

  int get count => words.length;

  factory Deck.fromJson(Map<String, dynamic> json) {
    final words = json['words'];
    return Deck(
      id: (json['id'] ?? json['_id'] ?? '').toString(),
      name: (json['name'] ?? '').toString(),
      words: words is List
          ? [
              for (final w in words)
                if (w is Map) Word.fromJson(Map<String, dynamic>.from(w)),
            ]
          : const [],
      order: (json['order'] as num?)?.toInt() ?? 0,
      createdAt: DateTime.tryParse(json['createdAt']?.toString() ?? ''),
      updatedAt: DateTime.tryParse(json['updatedAt']?.toString() ?? ''),
    );
  }
}

/// Per-HSK-level progress inside [SrsSummary].
class LevelProgress {
  const LevelProgress({this.total = 0, this.seen = 0, this.mature = 0});

  final int total;
  final int seen;
  final int mature;

  factory LevelProgress.fromJson(Map<String, dynamic> json) => LevelProgress(
        total: (json['total'] as num?)?.toInt() ?? 0,
        seen: (json['seen'] as num?)?.toInt() ?? 0,
        mature: (json['mature'] as num?)?.toInt() ?? 0,
      );
}

/// `GET /srs/summary` response.
class SrsSummary {
  const SrsSummary({
    this.dueCount = 0,
    this.todayReviews = 0,
    this.todayCorrect = 0,
    this.streak = 0,
    this.bestStreak = 0,
    this.goal = 20,
    this.stateNew = 0,
    this.stateLearning = 0,
    this.stateReview = 0,
    this.byLevel = const {},
  });

  final int dueCount;
  final int todayReviews;
  final int todayCorrect;
  final int streak;
  final int bestStreak;
  final int goal;
  final int stateNew;
  final int stateLearning;
  final int stateReview;

  /// Keys 1..6.
  final Map<int, LevelProgress> byLevel;

  bool get goalMet => goal > 0 && todayReviews >= goal;
  double get goalProgress => goal > 0 ? (todayReviews / goal).clamp(0, 1).toDouble() : 0;

  factory SrsSummary.fromJson(Map<String, dynamic> json) {
    final byState = json['byState'];
    final byLevelRaw = json['byLevel'];
    final byLevel = <int, LevelProgress>{};
    if (byLevelRaw is Map) {
      byLevelRaw.forEach((key, value) {
        final level = int.tryParse(key.toString());
        if (level != null && value is Map) {
          byLevel[level] = LevelProgress.fromJson(Map<String, dynamic>.from(value));
        }
      });
    }
    int stateOf(String key) => byState is Map ? (byState[key] as num?)?.toInt() ?? 0 : 0;
    return SrsSummary(
      dueCount: (json['dueCount'] as num?)?.toInt() ?? 0,
      todayReviews: (json['todayReviews'] as num?)?.toInt() ?? 0,
      todayCorrect: (json['todayCorrect'] as num?)?.toInt() ?? 0,
      streak: (json['streak'] as num?)?.toInt() ?? 0,
      bestStreak: (json['bestStreak'] as num?)?.toInt() ?? 0,
      goal: (json['goal'] as num?)?.toInt() ?? 20,
      stateNew: stateOf('new'),
      stateLearning: stateOf('learning'),
      stateReview: stateOf('review'),
      byLevel: byLevel,
    );
  }
}

/// One day of review activity (`GET /stats/activity`).
class ActivityDay {
  const ActivityDay({required this.day, this.reviews = 0, this.correct = 0});

  /// Local day as 'YYYY-MM-DD'.
  final String day;
  final int reviews;
  final int correct;

  factory ActivityDay.fromJson(Map<String, dynamic> json) => ActivityDay(
        day: (json['day'] ?? '').toString(),
        reviews: (json['reviews'] as num?)?.toInt() ?? 0,
        correct: (json['correct'] as num?)?.toInt() ?? 0,
      );
}
