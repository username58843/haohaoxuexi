import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/api.dart';
import '../../core/i18n.dart';
import '../../core/models.dart';
import '../../core/theme.dart';
import '../../core/widgets.dart';
import '../browse/word_sheet.dart';
import 'decks_screen.dart';

/// Single-deck editor: rename (tap the title), swipe-to-remove words,
/// network-search "Add words" sheet, study button and deck deletion.
class DeckDetailScreen extends ConsumerStatefulWidget {
  const DeckDetailScreen({super.key, required this.id});

  final String id;

  @override
  ConsumerState<DeckDetailScreen> createState() => _DeckDetailScreenState();
}

class _DeckDetailScreenState extends ConsumerState<DeckDetailScreen> {
  Deck? _deck;
  Object? _error;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final deck = await ref.read(decksProvider.notifier).fetchDeck(widget.id);
      if (!mounted) return;
      setState(() {
        _deck = deck;
        _loading = false;
      });
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e;
        _loading = false;
      });
    }
  }

  void _snack(String message) {
    if (!mounted) return;
    ScaffoldMessenger.of(context)
      ..hideCurrentSnackBar()
      ..showSnackBar(SnackBar(content: Text(message)));
  }

  Future<void> _rename() async {
    final deck = _deck;
    if (deck == null) return;
    final name = await promptDeckName(
      context,
      title: tr(context, 'deck.rename', 'Rename deck'),
      confirmLabel: tr(context, 'common.save', 'Save'),
      initial: deck.name,
    );
    if (name == null || name == deck.name || !mounted) return;
    final previous = deck.name;
    setState(() => _deck = deckCopyWith(_deck!, name: name));
    try {
      await ref.read(decksProvider.notifier).renameDeck(deck.id, name);
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => _deck = deckCopyWith(_deck!, name: previous));
      _snack(apiErrorText(context, e));
    }
  }

  Future<void> _removeAt(int index) async {
    final deck = _deck;
    if (deck == null || index < 0 || index >= deck.words.length) return;
    final oldWords = deck.words;
    final newWords = [...oldWords]..removeAt(index);
    setState(() => _deck = deckCopyWith(deck, words: newWords));
    try {
      await ref.read(decksProvider.notifier).setDeckWords(deck.id, newWords);
      if (!mounted) return;
      _snack(tr(context, 'deck.snack.removed', 'Removed from deck'));
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => _deck = deckCopyWith(_deck!, words: oldWords));
      _snack(apiErrorText(context, e));
    }
  }

  Future<void> _confirmDelete() async {
    final deck = _deck;
    if (deck == null) return;
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(tr(context, 'deck.delete.title', 'Delete deck?')),
        content: Text(tr(context, 'deck.delete.text',
            'This deck and its word list will be deleted permanently.')),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(false),
            child: Text(tr(context, 'common.cancel', 'Cancel')),
          ),
          TextButton(
            style: TextButton.styleFrom(foregroundColor: dangerColor),
            onPressed: () => Navigator.of(context).pop(true),
            child: Text(tr(context, 'common.delete', 'Delete')),
          ),
        ],
      ),
    );
    if (confirmed != true || !mounted) return;
    try {
      await ref.read(decksProvider.notifier).deleteDeck(deck.id);
      if (!mounted) return;
      context.pop();
    } on ApiException catch (e) {
      if (!mounted) return;
      _snack(apiErrorText(context, e));
    }
  }

  void _openWord(Word word) {
    showWordSheet(
      context,
      ref,
      word,
      actions: [
        PillButton(
          label: tr(context, 'deck.removeWord', 'Remove from deck'),
          variant: PillVariant.danger,
          icon: Icons.delete_outline,
          onPressed: () {
            Navigator.of(context).pop(); // close the word sheet
            final index = _deck?.words.indexOf(word) ?? -1;
            if (index >= 0) _removeAt(index);
          },
        ),
      ],
    );
  }

  Future<void> _openAddWords() async {
    final deck = _deck;
    if (deck == null) return;
    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      builder: (_) => _AddWordsSheet(
        deckId: deck.id,
        existingIds: {for (final w in deck.words) w.id},
        onAdded: (word) {
          if (!mounted) return;
          final current = _deck;
          if (current == null || current.words.any((w) => w.id == word.id)) {
            return;
          }
          setState(
            () => _deck =
                deckCopyWith(current, words: [...current.words, word]),
          );
        },
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    ref.watch(languageProvider);
    final deck = _deck;

    return Scaffold(
      appBar: AppBar(
        title: deck == null
            ? Text(tr(context, 'decks.deck', 'Deck'))
            : InkWell(
                borderRadius: BorderRadius.circular(8),
                onTap: _rename,
                child: Padding(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 4, vertical: 4),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Flexible(
                        child: Text(
                          deck.name,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                      const SizedBox(width: 6),
                      Icon(Icons.edit_outlined,
                          size: 15, color: text3Of(context)),
                    ],
                  ),
                ),
              ),
        actions: [
          if (deck != null)
            PopupMenuButton<String>(
              onSelected: (value) {
                switch (value) {
                  case 'rename':
                    _rename();
                  case 'delete':
                    _confirmDelete();
                }
              },
              itemBuilder: (context) => [
                PopupMenuItem(
                  value: 'rename',
                  child: Text(tr(context, 'deck.rename', 'Rename deck')),
                ),
                PopupMenuItem(
                  value: 'delete',
                  child: Text(
                    tr(context, 'deck.delete', 'Delete deck'),
                    style: const TextStyle(color: dangerColor),
                  ),
                ),
              ],
            ),
        ],
      ),
      body: _loading
          ? const LoadingView()
          : _error != null
              ? ErrorView(
                  message: apiErrorText(context, _error!),
                  onRetry: _load,
                )
              : deck == null
                  ? ErrorView(
                      message: tr(context, 'deck.notFound', 'Deck not found'),
                      onRetry: _load,
                    )
                  : _body(deck),
    );
  }

  Widget _body(Deck deck) {
    final keys = _dismissKeys(deck.words);
    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 10, 16, 6),
          child: Row(
            children: [
              Expanded(
                child: SectionLabel(
                  '${deck.count} ${tr(context, 'hsk.words', 'words')}',
                ),
              ),
              PillButton(
                label: tr(context, 'deck.addWords', 'Add words'),
                size: PillSize.sm,
                variant: PillVariant.soft,
                icon: Icons.playlist_add_rounded,
                onPressed: _openAddWords,
              ),
              const SizedBox(width: 8),
              PillButton(
                label: tr(context, 'decks.study', 'Study'),
                size: PillSize.sm,
                icon: Icons.play_arrow_rounded,
                onPressed: deck.count == 0
                    ? null
                    : () => context.push(studyRouteForDeck(deck.id)),
              ),
            ],
          ),
        ),
        Expanded(
          child: deck.words.isEmpty
              ? EmptyView(
                  glyph: '空',
                  title: tr(context, 'deck.empty.title', 'Deck is empty'),
                  text: tr(context, 'deck.empty.text',
                      'Add words from the HSK browser or search.'),
                  action: PillButton(
                    label: tr(context, 'deck.addWords', 'Add words'),
                    icon: Icons.playlist_add_rounded,
                    onPressed: _openAddWords,
                  ),
                )
              : ListView.separated(
                  padding: const EdgeInsets.only(bottom: 24),
                  itemCount: deck.words.length,
                  separatorBuilder: (e, s) =>
                      const Divider(indent: 16, endIndent: 16),
                  itemBuilder: (context, i) {
                    final word = deck.words[i];
                    return Dismissible(
                      key: keys[i],
                      direction: DismissDirection.endToStart,
                      background: Container(
                        alignment: Alignment.centerRight,
                        padding: const EdgeInsets.only(right: 20),
                        color: dangerColor.withValues(alpha: 0.14),
                        child:
                            const Icon(Icons.delete_outline, color: dangerColor),
                      ),
                      onDismissed: (_) => _removeAt(i),
                      child: WordRow(word: word, onTap: () => _openWord(word)),
                    );
                  },
                ),
        ),
      ],
    );
  }

  /// Stable keys even if the server data ever contains duplicate word ids.
  List<Key> _dismissKeys(List<Word> words) {
    final seen = <String, int>{};
    return [
      for (final w in words)
        ValueKey('${w.id}#${seen[w.id] = (seen[w.id] ?? 0) + 1}'),
    ];
  }
}

/// "Add words" sheet: debounced `GET /words/search` with one-tap append
/// (wordId dedupe via [DecksNotifier.addWordToDeck]).
class _AddWordsSheet extends ConsumerStatefulWidget {
  const _AddWordsSheet({
    required this.deckId,
    required this.existingIds,
    required this.onAdded,
  });

  final String deckId;
  final Set<String> existingIds;
  final ValueChanged<Word> onAdded;

  @override
  ConsumerState<_AddWordsSheet> createState() => _AddWordsSheetState();
}

class _AddWordsSheetState extends ConsumerState<_AddWordsSheet> {
  final TextEditingController _searchController = TextEditingController();
  Timer? _debounce;
  int _generation = 0;
  bool _searching = false;
  Object? _error;
  List<Word> _results = const [];
  late final Set<String> _inDeck = {...widget.existingIds};
  final Set<String> _busy = {};

  @override
  void dispose() {
    _debounce?.cancel();
    _searchController.dispose();
    super.dispose();
  }

  void _onQueryChanged(String value) {
    _debounce?.cancel();
    _debounce = Timer(
      const Duration(milliseconds: 350),
      () => _search(value.trim()),
    );
  }

  Future<void> _search(String query) async {
    final generation = ++_generation;
    if (query.isEmpty) {
      if (mounted) {
        setState(() {
          _results = const [];
          _searching = false;
          _error = null;
        });
      }
      return;
    }
    if (mounted) {
      setState(() {
        _searching = true;
        _error = null;
      });
    }
    try {
      final data = await ref
          .read(apiProvider)
          .get('/words/search', query: {'q': query, 'limit': 30});
      if (!mounted || generation != _generation) return;
      final items = data['items'];
      setState(() {
        _searching = false;
        _results = items is List
            ? [
                for (final item in items)
                  if (item is Map)
                    Word.fromJson(Map<String, dynamic>.from(item)),
              ]
            : const [];
      });
    } on ApiException catch (e) {
      if (!mounted || generation != _generation) return;
      setState(() {
        _searching = false;
        _error = e;
      });
    }
  }

  Future<void> _add(Word word) async {
    if (_busy.contains(word.id) || _inDeck.contains(word.id)) return;
    setState(() => _busy.add(word.id));
    try {
      final added = await ref
          .read(decksProvider.notifier)
          .addWordToDeck(widget.deckId, word);
      if (!mounted) return;
      setState(() {
        _busy.remove(word.id);
        _inDeck.add(word.id);
      });
      if (added) widget.onAdded(word);
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => _busy.remove(word.id));
      ScaffoldMessenger.of(context)
        ..hideCurrentSnackBar()
        ..showSnackBar(SnackBar(content: Text(apiErrorText(context, e))));
    }
  }

  @override
  Widget build(BuildContext context) {
    final insets = MediaQuery.viewInsetsOf(context).bottom;
    final height = (MediaQuery.sizeOf(context).height * 0.85 - insets)
        .clamp(280.0, double.infinity);

    return Padding(
      padding: EdgeInsets.only(bottom: insets),
      child: SizedBox(
        height: height,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 4, 20, 10),
              child: SectionLabel(tr(context, 'deck.addWords', 'Add words')),
            ),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: TextField(
                controller: _searchController,
                autofocus: true,
                onChanged: _onQueryChanged,
                textInputAction: TextInputAction.search,
                decoration: InputDecoration(
                  hintText:
                      tr(context, 'deck.search.hint', 'Search words to add…'),
                  prefixIcon: Icon(Icons.search, color: text3Of(context)),
                ),
              ),
            ),
            const SizedBox(height: 8),
            Expanded(child: _resultsView(context)),
          ],
        ),
      ),
    );
  }

  Widget _resultsView(BuildContext context) {
    if (_error != null) {
      return ErrorView(
        message: apiErrorText(context, _error!),
        onRetry: () => _search(_searchController.text.trim()),
      );
    }
    if (_searching) return const LoadingView();
    if (_searchController.text.trim().isEmpty) {
      return EmptyView(
        glyph: '找',
        title: tr(context, 'deck.search.start', 'Search the dictionary'),
        text: tr(context, 'deck.search.startText',
            'Type hanzi, pinyin or a translation.'),
      );
    }
    if (_results.isEmpty) {
      return EmptyView(
        glyph: '无',
        title: tr(context, 'search.empty', 'Nothing found'),
        text: tr(context, 'hsk.empty.text', 'Try a different search or level.'),
      );
    }
    return ListView.separated(
      padding: const EdgeInsets.only(bottom: 16),
      itemCount: _results.length,
      separatorBuilder: (e, s) => const Divider(indent: 16, endIndent: 16),
      itemBuilder: (context, i) {
        final word = _results[i];
        final inDeck = _inDeck.contains(word.id);
        final busy = _busy.contains(word.id);
        return WordRow(
          word: word,
          onTap: () => showWordSheet(context, ref, word),
          trailing: busy
              ? const Padding(
                  padding: EdgeInsets.all(8),
                  child: SizedBox(
                    width: 22,
                    height: 22,
                    child: CircularProgressIndicator(strokeWidth: 2.4),
                  ),
                )
              : IconButton(
                  tooltip: inDeck ? null : tr(context, 'deck.addWords', 'Add words'),
                  icon: Icon(
                    inDeck ? Icons.check_circle : Icons.add_circle_outline,
                    color: inDeck ? okColor : accentOf(context),
                  ),
                  onPressed: inDeck ? null : () => _add(word),
                ),
        );
      },
    );
  }
}
