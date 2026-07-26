import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';

import '../../core/api.dart';
import '../../core/i18n.dart';
import '../../core/models.dart';
import '../../core/providers.dart';
import '../../core/theme.dart';
import '../../core/widgets.dart';

/// Decks tab: list of personal decks + shared deck state used by the
/// deck-detail screen and the add-to-deck picker.

/// [Deck] has no copyWith — small shared helper for local patches.
Deck deckCopyWith(Deck deck, {String? name, List<Word>? words}) => Deck(
      id: deck.id,
      name: name ?? deck.name,
      words: words ?? deck.words,
      order: deck.order,
      createdAt: deck.createdAt,
      updatedAt: DateTime.now(),
    );

/// Human-readable message for a failed API call.
String apiErrorText(Object? contextOrRef, Object error) {
  if (error is ApiException) {
    switch (error.code) {
      case 'network':
        return tr(contextOrRef, 'error.network',
            'Network error. Check your connection.');
      case 'rate_limited':
        return tr(contextOrRef, 'error.rateLimited',
            'Too many requests. Try again later.');
      case 'unauthorized':
        return tr(contextOrRef, 'error.unauthorized',
            'Session expired. Sign in again.');
      case 'server_error':
        return tr(contextOrRef, 'error.server',
            'Server error. Please try again later.');
      default:
        return error.message.isNotEmpty
            ? error.message
            : tr(contextOrRef, 'common.error', 'Something went wrong');
    }
  }
  return tr(contextOrRef, 'common.error', 'Something went wrong');
}

/// Route for studying a deck as a quiz (count=0 → whole deck).
String studyRouteForDeck(String deckId) => Uri(
      path: '/study',
      queryParameters: {'mode': 'quiz', 'sources': 'deck:$deckId', 'count': '0'},
    ).toString();

Map<String, dynamic> _unwrapDeck(Map<String, dynamic> data) {
  final deck = data['deck'];
  return deck is Map ? Map<String, dynamic>.from(deck) : data;
}

/// `GET /decks` state + all deck mutations (create / rename / words / delete).
class DecksNotifier extends AsyncNotifier<List<Deck>> {
  Api get _api => ref.read(apiProvider);

  @override
  Future<List<Deck>> build() async {
    // Refetch whenever the signed-in user changes.
    ref.watch(authProvider.select((auth) => auth.value?.id));
    final data = await _api.get('/decks');
    final raw = data['decks'];
    if (raw is! List) return const [];
    return [
      for (final d in raw)
        if (d is Map) Deck.fromJson(Map<String, dynamic>.from(d)),
    ];
  }

  Future<Deck> createDeck(String name, {List<Word> words = const []}) async {
    final data = await _api.post('/decks', body: {
      'name': name,
      if (words.isNotEmpty) 'words': [for (final w in words) w.toSnapshotJson()],
    });
    final deck = Deck.fromJson(_unwrapDeck(data));
    final current = state.value;
    if (current != null && deck.id.isNotEmpty) {
      state = AsyncData([...current, deck]);
    } else {
      ref.invalidateSelf();
    }
    return deck;
  }

  /// `GET /decks/<id>` — also syncs the fresh copy into the cached list.
  Future<Deck> fetchDeck(String id) async {
    final data = await _api.get('/decks/$id');
    final deck = Deck.fromJson(_unwrapDeck(data));
    _patchWith(id, (_) => deck);
    return deck;
  }

  Future<void> renameDeck(String id, String name) async {
    await _api.put('/decks/$id', body: {'name': name});
    _patchWith(id, (d) => deckCopyWith(d, name: name));
  }

  /// Replaces the full word list of a deck (`PUT {words}`).
  Future<void> setDeckWords(String id, List<Word> words) async {
    await _api.put('/decks/$id', body: {
      'words': [for (final w in words) w.toSnapshotJson()],
    });
    _patchWith(id, (d) => deckCopyWith(d, words: words));
  }

  Future<void> deleteDeck(String id) async {
    await _api.delete('/decks/$id');
    final current = state.value;
    if (current != null) {
      state = AsyncData([for (final d in current) if (d.id != id) d]);
    }
  }

  /// Appends [word] unless the deck already contains it (wordId dedupe).
  /// Returns true when added, false when it was already there.
  Future<bool> addWordToDeck(String deckId, Word word) async {
    final deck = await fetchDeck(deckId);
    if (deck.words.any((w) => w.id == word.id)) return false;
    await setDeckWords(deckId, [...deck.words, word]);
    return true;
  }

  void _patchWith(String id, Deck Function(Deck) update) {
    final current = state.value;
    if (current == null || !current.any((d) => d.id == id)) return;
    state = AsyncData([for (final d in current) d.id == id ? update(d) : d]);
  }
}

final decksProvider =
    AsyncNotifierProvider<DecksNotifier, List<Deck>>(DecksNotifier.new);

/// Name prompt used for both "New deck" and "Rename deck".
Future<String?> promptDeckName(
  BuildContext context, {
  required String title,
  required String confirmLabel,
  String initial = '',
}) {
  return showDialog<String>(
    context: context,
    builder: (context) => _DeckNameDialog(
      title: title,
      confirmLabel: confirmLabel,
      initial: initial,
    ),
  );
}

class _DeckNameDialog extends StatefulWidget {
  const _DeckNameDialog({
    required this.title,
    required this.confirmLabel,
    required this.initial,
  });

  final String title;
  final String confirmLabel;
  final String initial;

  @override
  State<_DeckNameDialog> createState() => _DeckNameDialogState();
}

class _DeckNameDialogState extends State<_DeckNameDialog> {
  late final TextEditingController _controller =
      TextEditingController(text: widget.initial);

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  void _submit([String? _]) {
    final name = _controller.text.trim();
    if (name.isEmpty) return;
    Navigator.of(context).pop(name);
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: Text(widget.title),
      content: TextField(
        controller: _controller,
        autofocus: true,
        maxLength: 80,
        textInputAction: TextInputAction.done,
        onSubmitted: _submit,
        decoration: InputDecoration(
          hintText: tr(context, 'decks.name', 'Deck name'),
          counterText: '',
        ),
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.of(context).pop(),
          child: Text(tr(context, 'common.cancel', 'Cancel')),
        ),
        FilledButton(
          onPressed: _submit,
          child: Text(widget.confirmLabel),
        ),
      ],
    );
  }
}

class DecksScreen extends ConsumerWidget {
  const DecksScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    ref.watch(languageProvider);
    final decksAsync = ref.watch(decksProvider);

    return Scaffold(
      appBar: AppBar(
        title: Text(tr(context, 'decks.title', 'My Decks')),
        actions: [
          IconButton(
            tooltip: tr(context, 'decks.new', 'New deck'),
            icon: const Icon(Icons.add),
            onPressed: () => _createDeck(context, ref),
          ),
        ],
      ),
      body: decksAsync.when(
        loading: () => const LoadingView(),
        error: (error, _) => ErrorView(
          message: apiErrorText(context, error),
          onRetry: () => ref.invalidate(decksProvider),
        ),
        data: (decks) => RefreshIndicator(
          onRefresh: () async {
            try {
              ref.invalidate(decksProvider);
              await ref.read(decksProvider.future);
            } catch (_) {
              // Failure surfaces through the provider's error state.
            }
          },
          child: decks.isEmpty
              ? _emptyState(context, ref)
              : ListView.separated(
                  physics: const AlwaysScrollableScrollPhysics(),
                  // extendBody shell: clear the floating dock at the end.
                  padding: EdgeInsets.fromLTRB(
                      16, 16, 16, 16 + MediaQuery.paddingOf(context).bottom),
                  itemCount: decks.length,
                  separatorBuilder: (e, s) => const SizedBox(height: 12),
                  itemBuilder: (context, i) => _DeckCard(deck: decks[i]),
                ),
        ),
      ),
    );
  }

  /// Full-height scrollable empty state so pull-to-refresh still works.
  Widget _emptyState(BuildContext context, WidgetRef ref) {
    return LayoutBuilder(
      builder: (context, constraints) => SingleChildScrollView(
        physics: const AlwaysScrollableScrollPhysics(),
        child: SizedBox(
          height: constraints.maxHeight,
          child: EmptyView(
            glyph: '册',
            title: tr(context, 'decks.empty.title', 'No decks yet'),
            text: tr(context, 'decks.empty.text',
                'Create a deck to collect words for study.'),
            action: PillButton(
              label: tr(context, 'decks.new', 'New deck'),
              icon: Icons.add,
              onPressed: () => _createDeck(context, ref),
            ),
          ),
        ),
      ),
    );
  }

  Future<void> _createDeck(BuildContext context, WidgetRef ref) async {
    final name = await promptDeckName(
      context,
      title: tr(context, 'decks.new', 'New deck'),
      confirmLabel: tr(context, 'common.create', 'Create'),
    );
    if (name == null || !context.mounted) return;
    final messenger = ScaffoldMessenger.of(context);
    try {
      final deck = await ref.read(decksProvider.notifier).createDeck(name);
      if (context.mounted && deck.id.isNotEmpty) {
        context.push('/decks/${deck.id}');
      }
    } on ApiException catch (e) {
      if (!context.mounted) return;
      messenger
        ..hideCurrentSnackBar()
        ..showSnackBar(SnackBar(content: Text(apiErrorText(context, e))));
    }
  }
}

class _DeckCard extends StatelessWidget {
  const _DeckCard({required this.deck});

  final Deck deck;

  @override
  Widget build(BuildContext context) {
    final preview = deck.words.take(4).map((w) => w.simplified).join('  ');
    return InkCard(
      onTap: () => context.push('/decks/${deck.id}'),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  deck.name,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: GoogleFonts.manrope(
                    fontSize: 16,
                    fontWeight: FontWeight.w700,
                    color: Theme.of(context).colorScheme.onSurface,
                  ),
                ),
              ),
              const SizedBox(width: 10),
              Text(
                '${deck.count} ${tr(context, 'hsk.words', 'words')}'
                    .toUpperCase(),
                style: monoStyle(context, size: 10.5, color: text3Of(context)),
              ),
            ],
          ),
          const SizedBox(height: 10),
          Row(
            children: [
              Expanded(
                child: preview.isEmpty
                    ? Text(
                        tr(context, 'decks.emptyDeck', 'Empty deck'),
                        style: GoogleFonts.manrope(
                          fontSize: 13.5,
                          color: text3Of(context),
                        ),
                      )
                    : HanziText(
                        preview,
                        size: 22,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
              ),
              const SizedBox(width: 10),
              PillButton(
                label: tr(context, 'decks.study', 'Study'),
                size: PillSize.sm,
                variant: PillVariant.soft,
                icon: Icons.play_arrow_rounded,
                onPressed: deck.count == 0
                    ? null
                    : () => context.push(studyRouteForDeck(deck.id)),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
