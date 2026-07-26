import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/i18n.dart';
import '../../core/models.dart';
import '../../core/providers.dart';
import '../../core/theme.dart';
import '../../core/widgets.dart';
import '../decks/decks_screen.dart' show apiErrorText;
import 'word_sheet.dart';

/// HSK browser: offline-first browsing of the bundled hsk1..hsk6 packs with a
/// level filter and a debounced local search (no network).
class HskScreen extends ConsumerStatefulWidget {
  const HskScreen({super.key});

  @override
  ConsumerState<HskScreen> createState() => _HskScreenState();
}

class _HskScreenState extends ConsumerState<HskScreen> {
  final TextEditingController _searchController = TextEditingController();
  Timer? _debounce;

  /// Selected HSK level; null = all levels.
  int? _level = 1;
  String _query = '';

  @override
  void dispose() {
    _debounce?.cancel();
    _searchController.dispose();
    super.dispose();
  }

  List<String> get _packIds =>
      _level == null ? bundledHskPackIds : ['hsk$_level'];

  void _onQueryChanged(String value) {
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 250), () {
      if (mounted) setState(() => _query = value.trim());
    });
  }

  void _clearQuery() {
    _debounce?.cancel();
    _searchController.clear();
    setState(() => _query = '');
  }

  static String _normalize(String s) =>
      s.toLowerCase().replaceAll(RegExp(r"[\s'’ʼ]+"), '');

  static bool _matches(Word w, String q, String qns) {
    if (w.simplified.contains(q) || w.traditional.contains(q)) return true;
    final pinyin = w.pinyin.toLowerCase();
    if (pinyin.contains(q)) return true;
    if (qns.isNotEmpty && _normalize(w.pinyin).contains(qns)) return true;
    for (final d in w.definitions) {
      if (d.toLowerCase().contains(q)) return true;
    }
    for (final t in w.en) {
      if (t.toLowerCase().contains(q)) return true;
    }
    for (final t in w.ru) {
      if (t.toLowerCase().contains(q)) return true;
    }
    return false;
  }

  void _openWord(Word word) {
    showWordSheet(
      context,
      ref,
      word,
      actions: [
        PillButton(
          label: tr(context, 'word.addToDeck', 'Add to deck'),
          icon: Icons.playlist_add_rounded,
          onPressed: () => showAddToDeckSheet(context, ref, word),
        ),
      ],
    );
  }

  @override
  Widget build(BuildContext context) {
    ref.watch(languageProvider);
    final asyncPacks = [
      for (final id in _packIds) ref.watch(wordPacksProvider(id)),
    ];
    final loading = asyncPacks.any((p) => p.isLoading);
    final firstError =
        asyncPacks.where((p) => p.hasError && !p.hasValue).firstOrNull;
    final words = <Word>[
      for (final p in asyncPacks) ...(p.value ?? const <Word>[]),
    ];
    final q = _query.toLowerCase();
    final qns = _normalize(_query);
    final filtered =
        q.isEmpty ? words : [for (final w in words) if (_matches(w, q, qns)) w];

    return Scaffold(
      appBar: AppBar(title: Text(tr(context, 'hsk.title', 'HSK'))),
      body: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 4, 16, 0),
            child: TextField(
              controller: _searchController,
              onChanged: _onQueryChanged,
              textInputAction: TextInputAction.search,
              decoration: InputDecoration(
                hintText: tr(context, 'hsk.search.hint',
                    'Search hanzi, pinyin, meaning…'),
                prefixIcon: Icon(Icons.search, color: text3Of(context)),
                suffixIcon: _query.isEmpty
                    ? null
                    : IconButton(
                        icon: Icon(Icons.close, color: text3Of(context)),
                        onPressed: _clearQuery,
                      ),
              ),
            ),
          ),
          const SizedBox(height: 10),
          SizedBox(
            height: 40,
            child: ListView(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: 16),
              children: [
                _levelChip(null, tr(context, 'hsk.level.all', 'All')),
                for (var l = 1; l <= 6; l++) _levelChip(l, 'HSK $l'),
              ],
            ),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 6),
            child: SectionLabel(
              '${filtered.length} ${tr(context, 'hsk.words', 'words')}',
            ),
          ),
          Expanded(child: _list(filtered, loading, firstError)),
        ],
      ),
    );
  }

  Widget _levelChip(int? level, String label) {
    return Padding(
      padding: const EdgeInsets.only(right: 8),
      child: ChoiceChip(
        label: Text(label),
        selected: _level == level,
        showCheckmark: false,
        onSelected: (_) => setState(() => _level = level),
      ),
    );
  }

  Widget _list(List<Word> filtered, bool loading, AsyncValue<void>? error) {
    if (error != null) {
      return ErrorView(
        message: apiErrorText(context, error.error ?? 'error'),
        onRetry: () {
          for (final id in _packIds) {
            ref.invalidate(wordPacksProvider(id));
          }
        },
      );
    }
    if (loading && filtered.isEmpty) return const LoadingView();
    if (filtered.isEmpty) {
      return EmptyView(
        glyph: '无',
        title: tr(context, 'hsk.empty.title', 'No words found'),
        text: tr(context, 'hsk.empty.text', 'Try a different search or level.'),
      );
    }
    return ListView.separated(
      padding: const EdgeInsets.only(bottom: 24),
      itemCount: filtered.length,
      separatorBuilder: (e, s) => const Divider(indent: 16, endIndent: 16),
      itemBuilder: (context, i) {
        final word = filtered[i];
        return WordRow(word: word, onTap: () => _openWord(word));
      },
    );
  }
}
