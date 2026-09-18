import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:haohao_xuexi/core/dock.dart';
import 'package:haohao_xuexi/core/i18n.dart';
import 'package:haohao_xuexi/core/models.dart';
import 'package:haohao_xuexi/core/providers.dart';
import 'package:haohao_xuexi/core/theme.dart';
import 'package:haohao_xuexi/features/account/settings_screen.dart';
import 'package:haohao_xuexi/features/decks/deck_detail_screen.dart';
import 'package:haohao_xuexi/features/decks/decks_screen.dart';

class _Guest extends AuthNotifier {
  @override
  Future<UserProfile?> build() async => null;
}

class _Decks extends DecksNotifier {
  Deck deck = const Deck(
    id: 'fixture',
    name: 'My saved deck',
    words: [Word(simplified: '爱', traditional: '愛', pinyin: 'ài')],
  );
  int deletes = 0;

  @override
  Future<List<Deck>> build() async => [deck];
  @override
  Future<Deck> fetchDeck(String id) async => deck;
  @override
  Future<void> renameDeck(String id, String name) async {
    deck = deckCopyWith(deck, name: name);
    state = AsyncData([deck]);
  }

  @override
  Future<void> deleteDeck(String id) async {
    deletes++;
  }
}

void main() {
  for (final language in ['en', 'ru', 'tk', 'zh']) {
    for (final scale in [1.0, 1.8]) {
      testWidgets(
        'dock labels stay readable: $language at ${scale}x on 320px',
        (tester) async {
          tester.view.physicalSize = const Size(320, 700);
          tester.view.devicePixelRatio = 1;
          addTearDown(tester.view.resetPhysicalSize);
          addTearDown(tester.view.resetDevicePixelRatio);
          I18n.setLanguage(language);
          final labels = [
            tr(null, 'nav.home', 'Home'),
            tr(null, 'nav.learn', 'Learn'),
            tr(null, 'nav.hsk', 'HSK 3.0'),
            tr(null, 'nav.decks', 'Decks'),
            tr(null, 'nav.settings', 'Settings'),
          ];
          var selected = 4;
          await tester.pumpWidget(
            MaterialApp(
              theme: buildTheme(Brightness.light, Colors.green),
              home: MediaQuery(
                data: MediaQueryData(textScaler: TextScaler.linear(scale)),
                child: StatefulBuilder(
                  builder: (context, setState) => Scaffold(
                    bottomNavigationBar: FloatingDock(
                      destinations: [
                        for (final label in labels)
                          DockDestination(
                            icon: Icons.circle_outlined,
                            selectedIcon: Icons.circle,
                            label: label,
                          ),
                      ],
                      selectedIndex: selected,
                      onSelect: (index) => setState(() => selected = index),
                    ),
                  ),
                ),
              ),
            ),
          );
          await tester.pumpAndSettle();
          expect(tester.takeException(), isNull);
          final selectedRect = tester.getRect(find.text(labels[4]));
          expect(selectedRect.left, greaterThanOrEqualTo(0));
          expect(selectedRect.right, lessThanOrEqualTo(320));
          for (final label in labels) {
            final paragraph = tester.renderObject<RenderParagraph>(
              find.text(label),
            );
            expect(paragraph.didExceedMaxLines, isFalse);
          }
          await tester.ensureVisible(find.text(labels[0]));
          await tester.pumpAndSettle();
          await tester.tap(find.text(labels[0]));
          await tester.pumpAndSettle();
          expect(selected, 0);
          expect(tester.takeException(), isNull);
        },
      );
    }
  }

  testWidgets('font pickers update the running settings screen and persist', (
    tester,
  ) async {
    SharedPreferences.setMockInitialValues({'language': 'en'});
    final prefs = await SharedPreferences.getInstance();
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          sharedPreferencesProvider.overrideWithValue(prefs),
          authProvider.overrideWith(_Guest.new),
        ],
        child: Consumer(
          builder: (context, ref, child) {
            final settings = ref.watch(settingsProvider);
            return MaterialApp(
              theme: buildTheme(
                Brightness.light,
                Colors.green,
                hanziFont: settings.hanziFont,
                interfaceFont: settings.interfaceFont,
              ),
              home: const SettingsScreen(),
            );
          },
        ),
      ),
    );
    await tester.pumpAndSettle();
    final pickers = find.byType(DropdownButtonFormField<String>);
    expect(pickers, findsNWidgets(2));
    final first = tester.widget<DropdownButtonFormField<String>>(pickers.first);
    expect(first.initialValue, 'songti');
    await tester.tap(pickers.first);
    await tester.pumpAndSettle();
    await tester.tap(find.text('Ma Shan Zheng · 楷书').last);
    await tester.pumpAndSettle();
    expect(prefs.getString('hanziFont'), 'kai');
    expect(
      tester.widget<Text>(find.text('好好学习，天天向上。')).style!.fontFamily,
      'HanziKai',
    );
    await tester.ensureVisible(pickers.last);
    await tester.tap(pickers.last);
    await tester.pumpAndSettle();
    await tester.tap(find.text('Lora').last);
    await tester.pumpAndSettle();
    expect(prefs.getString('interfaceFont'), 'lora');
    expect(
      Theme.of(
        tester.element(find.text('Learn · Учиться · Öwrenmek')),
      ).textTheme.bodyMedium!.fontFamily,
      'AppLora',
    );
    expect(tester.takeException(), isNull);
  });

  testWidgets(
    'deck action sheet renames without touching words; deletion can be cancelled',
    (tester) async {
      SharedPreferences.setMockInitialValues({'language': 'en'});
      final prefs = await SharedPreferences.getInstance();
      final decks = _Decks();
      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            sharedPreferencesProvider.overrideWithValue(prefs),
            decksProvider.overrideWith(() => decks),
          ],
          child: MaterialApp(
            theme: buildTheme(Brightness.light, Colors.green),
            home: const DeckDetailScreen(id: 'fixture'),
          ),
        ),
      );
      await tester.pumpAndSettle();
      await tester.tap(find.byTooltip('Deck actions'));
      await tester.pumpAndSettle();
      expect(find.text('Rename deck'), findsOneWidget);
      expect(find.text('Delete deck'), findsOneWidget);
      await tester.tap(find.text('Rename deck'));
      await tester.pumpAndSettle();
      await tester.enterText(find.byType(TextField), 'Renamed, still mine');
      await tester.tap(find.text('Save'));
      await tester.pumpAndSettle();
      expect(decks.deck.name, 'Renamed, still mine');
      expect(decks.deck.words.single.id, '爱·ài');
      await tester.tap(find.byTooltip('Deck actions'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Delete deck'));
      await tester.pumpAndSettle();
      expect(find.text('Delete deck?'), findsOneWidget);
      expect(decks.deletes, 0);
      await tester.tap(find.text('Cancel'));
      await tester.pumpAndSettle();
      expect(decks.deletes, 0);
      expect(find.text('Renamed, still mine'), findsOneWidget);
      expect(tester.takeException(), isNull);
    },
  );
}
