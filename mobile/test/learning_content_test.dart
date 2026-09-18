import 'dart:convert';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:haohao_xuexi/core/models.dart';
import 'package:haohao_xuexi/core/providers.dart';
import 'package:haohao_xuexi/core/speech.dart';
import 'package:haohao_xuexi/core/theme.dart';
import 'package:haohao_xuexi/core/typography.dart';
import 'package:haohao_xuexi/core/word_catalog.dart';
import 'package:haohao_xuexi/features/memorize/reading_document.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  test(
    'all 11,000 lexemes survive snapshot round trips without collisions',
    () {
      final ids = <String>{};
      const counts = [300, 200, 500, 1000, 1600, 1800, 5600];
      for (var i = 0; i < bundledHskPackIds.length; i++) {
        final words = decodeWordPack(
          File('assets/words/${bundledHskPackIds[i]}.json').readAsStringSync(),
        );
        expect(words.length, counts[i]);
        for (final word in words) {
          expect(ids.add(word.id), isTrue, reason: word.id);
          expect(Word.fromJson(word.toSnapshotJson()).id, word.id);
        }
      }
      expect(ids.length, 11000);
      expect(() => decodeWordPack('{}'), throwsFormatException);
      expect(() => decodeWordPack('[null]'), throwsFormatException);
    },
  );

  for (final range in readingRanges) {
    test(
      'reading document $range has valid lookups and revision-safe progress',
      () {
        final document = decodeReadingDocument(
          File('assets/learning/$range.json').readAsStringSync(),
        );
        expect(document.id, range);
        expect(document.covered, 500);
        expect(document.outside, 0);
        expect(document.complete, isFalse);
        expect(document.spokenText, contains('星期天'));
        for (final entry in document.words.entries) {
          expect(entry.value.id, entry.key);
        }
        expect(document.pageFrom({'revision': 'old', 'page': 5}), 0);
        expect(
          document.pageFrom({'revision': document.revision, 'page': -2}),
          0,
        );
        expect(
          document.pageFrom({'revision': document.revision, 'page': 99999}),
          document.passages.length - 1,
        );
      },
    );
  }

  test('broken lookup references and invalid coverage are rejected', () {
    final source = File('assets/learning/1-2.json').readAsStringSync();
    final json = jsonDecode(source) as Map<String, dynamic>;
    (json['words'] as Map).clear();
    expect(() => ReadingDocument.fromJson(json), throwsFormatException);
    final invalidCoverage = jsonDecode(source) as Map<String, dynamic>;
    (invalidCoverage['coverage'] as Map)['covered'] = -1;
    expect(
      () => ReadingDocument.fromJson(invalidCoverage),
      throwsFormatException,
    );
  });

  test('reader preferences safely recover from invalid persisted data', () {
    final preferences = ReadingPreferences.fromJson({
      'range': 'unknown',
      'language': 'unknown',
      'fontSize': 999,
      'pinyin': 'true',
      'translation': true,
    });
    expect(preferences.range, '1-2');
    expect(preferences.language, '');
    expect(preferences.fontSize, 42);
    expect(preferences.pinyin, isFalse);
    expect(preferences.translation, isTrue);
    expect(ReadingPreferences.fromJson(null).fontSize, 26);
  });

  test('long narration never splits a Unicode character or drops text', () {
    final text = '你好！${List.filled(501, '𠀀').join()}。再见！';
    final parts = splitForSpeech(text);
    expect(parts.join(), text);
    expect(parts.every((part) => part.runes.length <= 180), isTrue);
    expect(splitForSpeech(''), isEmpty);
    expect(splitForSpeech('你好', maxLength: 0), ['你', '好']);
  });

  test('five Hanzi and five interface options produce the chosen theme', () {
    expect(hanziFonts.length, 5);
    expect(interfaceFonts.length, 5);
    expect(const AppTypography().hanziFamily, 'HanziSongti');
    for (final hanzi in hanziFonts.keys) {
      for (final ui in interfaceFonts.keys) {
        final theme = buildTheme(
          Brightness.light,
          Colors.green,
          hanziFont: hanzi,
          interfaceFont: ui,
        );
        expect(theme.extension<AppTypography>()!.hanzi, hanzi);
        expect(
          theme.textTheme.bodyMedium!.fontFamily,
          AppTypography(hanzi: hanzi, ui: ui).uiFamily,
        );
      }
    }
  });

  test(
    'font choices persist without changing existing user preferences',
    () async {
      SharedPreferences.setMockInitialValues({
        'language': 'tk',
        'dailyGoal': 35,
        'quizSpeakOnCorrect': true,
        'known_fixture': ['爱·ài'],
      });
      final prefs = await SharedPreferences.getInstance();
      final container = ProviderContainer(
        overrides: [sharedPreferencesProvider.overrideWithValue(prefs)],
      );
      final notifier = container.read(settingsProvider.notifier);
      notifier.setHanziFont('kai');
      notifier.setInterfaceFont('lora');
      notifier.setHanziFont('invalid');
      expect(container.read(settingsProvider).hanziFont, 'kai');
      container.dispose();
      final reopened = ProviderContainer(
        overrides: [sharedPreferencesProvider.overrideWithValue(prefs)],
      );
      addTearDown(reopened.dispose);
      final settings = reopened.read(settingsProvider);
      expect(settings.hanziFont, 'kai');
      expect(settings.interfaceFont, 'lora');
      expect(settings.language, 'tk');
      expect(settings.dailyGoal, 35);
      expect(settings.quizSpeakOnCorrect, isTrue);
      expect(prefs.getStringList('known_fixture'), ['爱·ài']);
    },
  );
}
