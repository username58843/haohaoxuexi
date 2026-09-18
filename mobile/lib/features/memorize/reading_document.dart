import 'dart:convert';

import '../../core/models.dart';

const readingRanges = ['1-2', '1-3', '1-4', '1-5', '1-6', '1-7-9'];
const readingLanguages = {'en': 'English', 'ru': 'Русский', 'tk': 'Türkmençe'};

ReadingDocument decodeReadingDocument(String raw) =>
    ReadingDocument.fromJson(jsonDecode(raw) as Map<String, dynamic>);

class ReadingDocument {
  ReadingDocument.fromJson(Map<String, dynamic> json)
    : id = json['id'] as String,
      revision = json['revision'] as String,
      complete = json['status'] == 'complete',
      title = Map<String, String>.from(json['title'] as Map),
      covered = (json['coverage'] as Map)['covered'] as int,
      total = (json['coverage'] as Map)['total'] as int,
      outside = (json['coverage'] as Map)['outside'] as int,
      passages = [
        for (final raw in json['passages'] as List)
          ReadingPassage.fromJson(Map<String, dynamic>.from(raw as Map)),
      ],
      words = {
        for (final entry in (json['words'] as Map).entries)
          entry.key as String: Word.fromJson(
            Map<String, dynamic>.from(entry.value as Map),
          ),
      } {
    if (json['schemaVersion'] != 1 ||
        !readingRanges.contains(id) ||
        passages.isEmpty ||
        total <= 0 ||
        covered < 0 ||
        covered > total) {
      throw const FormatException('Invalid reading document');
    }
    for (final passage in passages) {
      if (passage.sentences.isEmpty) {
        throw const FormatException('Empty passage');
      }
      for (final sentence in passage.sentences) {
        if (sentence.tokens.map((token) => token.text).join() != sentence.zh ||
            readingLanguages.keys.any(
              (lang) => sentence.translations[lang]?.isNotEmpty != true,
            ) ||
            sentence.tokens.any(
              (token) =>
                  token.wordId != null && !words.containsKey(token.wordId),
            )) {
          throw const FormatException('Invalid reading sentence');
        }
      }
    }
  }

  final String id;
  final String revision;
  final bool complete;
  final Map<String, String> title;
  final int covered;
  final int total;
  final int outside;
  final List<ReadingPassage> passages;
  final Map<String, Word> words;

  String get spokenText => passages
      .expand((passage) => passage.sentences)
      .map((sentence) => sentence.zh)
      .join('\n');

  int pageFrom(Object? raw) {
    if (raw is! Map || raw['revision'] != revision || raw['page'] is! int) {
      return 0;
    }
    return (raw['page'] as int).clamp(0, passages.length - 1);
  }
}

class ReadingPassage {
  ReadingPassage.fromJson(Map<String, dynamic> json)
    : id = json['id'] as String,
      title = Map<String, String>.from(json['title'] as Map),
      sentences = [
        for (final raw in json['sentences'] as List)
          ReadingSentence.fromJson(Map<String, dynamic>.from(raw as Map)),
      ];
  final String id;
  final Map<String, String> title;
  final List<ReadingSentence> sentences;
}

class ReadingSentence {
  ReadingSentence.fromJson(Map<String, dynamic> json)
    : zh = json['zh'] as String,
      translations = {
        for (final lang in readingLanguages.keys) lang: json[lang] as String,
      },
      tokens = [
        for (final raw in json['tokens'] as List)
          ReadingToken.fromJson(Map<String, dynamic>.from(raw as Map)),
      ];
  final String zh;
  final Map<String, String> translations;
  final List<ReadingToken> tokens;
}

class ReadingToken {
  ReadingToken.fromJson(Map<String, dynamic> json)
    : text = json['text'] as String,
      pinyin = json['pinyin'] as String,
      wordId = json['wordId'] as String?;
  final String text;
  final String pinyin;
  final String? wordId;
}

class ReadingPreferences {
  const ReadingPreferences({
    this.range = '1-2',
    this.pinyin = false,
    this.translation = false,
    this.language = '',
    this.fontSize = 26,
  });

  factory ReadingPreferences.fromJson(Object? raw) {
    final json = raw is Map ? raw : const {};
    final size = json['fontSize'];
    return ReadingPreferences(
      range: readingRanges.contains(json['range'])
          ? json['range'] as String
          : '1-2',
      pinyin: json['pinyin'] == true,
      translation: json['translation'] == true,
      language: readingLanguages.containsKey(json['language'])
          ? json['language'] as String
          : '',
      fontSize: size is num && size.isFinite
          ? size.toDouble().clamp(18, 42)
          : 26,
    );
  }

  final String range;
  final bool pinyin;
  final bool translation;
  final String language;
  final double fontSize;

  ReadingPreferences copyWith({
    String? range,
    bool? pinyin,
    bool? translation,
    String? language,
    double? fontSize,
  }) => ReadingPreferences(
    range: range ?? this.range,
    pinyin: pinyin ?? this.pinyin,
    translation: translation ?? this.translation,
    language: language ?? this.language,
    fontSize: fontSize ?? this.fontSize,
  );

  Map<String, Object> toJson() => {
    'range': range,
    'pinyin': pinyin,
    'translation': translation,
    'language': language,
    'fontSize': fontSize,
  };
}
