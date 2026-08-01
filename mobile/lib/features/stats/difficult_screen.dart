import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';

import '../../core/api.dart';
import '../../core/i18n.dart';
import '../../core/models.dart';
import '../../core/theme.dart';
import '../../core/widgets.dart';
import '../browse/word_sheet.dart';
import '../decks/decks_screen.dart' show apiErrorText;

/// `GET /srs/difficult` — the most-lapsed ("leech") cards, already sorted by
/// the server (lapses desc, ease asc). `total` counts every card at or above
/// the lapse threshold, not just the fetched page.
final _difficultProvider = FutureProvider.autoDispose<
    ({List<SrsCard> items, int total})>((ref) async {
  final api = ref.watch(apiProvider);
  final data = await api.get('/srs/difficult', query: {'limit': 20});
  final raw = data['items'];
  final items = raw is List
      ? [
          for (final item in raw)
            if (item is Map) SrsCard.fromJson(Map<String, dynamic>.from(item)),
        ]
      : const <SrsCard>[];
  return (
    items: items,
    total: (data['total'] as num?)?.toInt() ?? items.length,
  );
});

/// Difficult-words screen: the mobile twin of the web /stats leech list.
/// Rows open the shared word sheet with an add-to-deck action so a stubborn
/// word can go straight into a practice deck.
class DifficultScreen extends ConsumerWidget {
  const DifficultScreen({super.key});

  void _openWord(BuildContext context, WidgetRef ref, Word word) {
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
  Widget build(BuildContext context, WidgetRef ref) {
    ref.watch(languageProvider);
    final async = ref.watch(_difficultProvider);
    final total = async.value?.total ?? 0;

    return Scaffold(
      appBar: AppBar(
        title: Text(tr(context, 'difficult.title', 'Difficult words')),
        actions: [
          // Total leech count — the mobile twin of the web section-head badge.
          if (total > 0)
            Padding(
              padding: const EdgeInsets.only(right: 16),
              child: Center(
                child: Text('$total', style: monoStyle(context, size: 12)),
              ),
            ),
        ],
      ),
      body: async.when(
        loading: () => const LoadingView(),
        error: (e, _) => ErrorView(
          message: apiErrorText(context, e),
          onRetry: () => ref.invalidate(_difficultProvider),
        ),
        data: (data) {
          if (data.items.isEmpty) {
            return EmptyView(
              glyph: '易',
              title: tr(context, 'difficult.emptyTitle', 'No difficult words'),
              text: tr(context, 'difficult.emptyText',
                  'Words you keep forgetting during reviews will show up here.'),
            );
          }
          return ListView.separated(
            padding: EdgeInsets.only(
                top: 4, bottom: 24 + MediaQuery.paddingOf(context).bottom),
            // Index 0 is the intro hint; word rows follow.
            itemCount: data.items.length + 1,
            separatorBuilder: (_, i) => i == 0
                ? const SizedBox.shrink()
                : const Divider(indent: 16, endIndent: 16),
            itemBuilder: (context, i) {
              if (i == 0) {
                return Padding(
                  padding: const EdgeInsets.fromLTRB(16, 4, 16, 12),
                  child: Text(
                    tr(context, 'difficult.hint',
                        'These words keep slipping away. Tap one to open it and add it to a deck for extra practice.'),
                    style: GoogleFonts.manrope(
                      fontSize: 13.5,
                      height: 1.45,
                      color: text2Of(context),
                    ),
                  ),
                );
              }
              final card = data.items[i - 1];
              return WordRow(
                word: card.word,
                trailing: _LapsesBadge(lapses: card.lapses),
                onTap: () => _openWord(context, ref, card.word),
              );
            },
          );
        },
      ),
    );
  }
}

/// Red "×N" pill: how many times the card fell back to relearning.
class _LapsesBadge extends StatelessWidget {
  const _LapsesBadge({required this.lapses});

  final int lapses;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 3),
      decoration: BoxDecoration(
        color: dangerColor.withValues(alpha: 0.14),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(
        '×$lapses',
        style: GoogleFonts.manrope(
          fontSize: 12,
          fontWeight: FontWeight.w700,
          color: dangerColor,
        ),
      ),
    );
  }
}
