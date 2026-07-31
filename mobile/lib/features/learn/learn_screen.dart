/// Learn tab — mobile counterpart of the web `/learn` page: a full session
/// builder instead of the fixed home-screen shortcuts.
///
/// - **Review**: SRS flashcards via `GET /srs/queue` — due cards always come
///   first, new cards are drawn from the selected word packs (HSK levels +
///   textbook packs), with a session limit of 10/20/40.
/// - **Quiz**: MCQ built client-side from any mix of personal decks
///   (`deck:<id>`) and word packs, with 10/20/40/all questions.
///
/// The last-started config is persisted (like the web `xue_learn_config_v2`)
/// and resurfaced as a "Continue last" card.
library;

import 'dart:convert';

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
import '../decks/decks_screen.dart';
import '../home/home_screen.dart';

/// SharedPreferences key remembering the last-started session config.
const String _kLearnConfigPref = 'learnConfig';

/// Session-limit choices for review mode (mirrors the web page).
const List<int> _reviewLimits = [10, 20, 40];

/// Question-count choices for quiz mode; 0 = the whole pool.
const List<int> _quizCounts = [10, 20, 40, 0];

/// SRS summary for the due counter; invalidated after every session.
final learnSummaryProvider =
    FutureProvider.autoDispose<SrsSummary>((ref) async {
  final api = ref.watch(apiProvider);
  final tz = DateTime.now().timeZoneOffset.inMinutes;
  final data = await api.get('/srs/summary', query: {'tzOffset': tz});
  return SrsSummary.fromJson(data);
});

/// Last-started session config, stored as JSON in SharedPreferences.
class _LearnConfig {
  const _LearnConfig({
    required this.mode,
    this.reviewPacks = const [],
    this.reviewLimit = 20,
    this.quizSources = const [],
    this.quizCount = 20,
  });

  /// 'review' | 'quiz'
  final String mode;
  final List<String> reviewPacks;
  final int reviewLimit;

  /// Pack ids and/or `deck:<id>`.
  final List<String> quizSources;
  final int quizCount;

  Map<String, dynamic> toJson() => {
        'mode': mode,
        'review': {'packs': reviewPacks, 'limit': reviewLimit},
        'quiz': {'sources': quizSources, 'count': quizCount},
      };

  static _LearnConfig? fromJson(Object? raw) {
    if (raw is! Map) return null;
    final mode = raw['mode'];
    if (mode != 'review' && mode != 'quiz') return null;
    final review = raw['review'];
    final quiz = raw['quiz'];
    return _LearnConfig(
      mode: mode as String,
      reviewPacks: _ids(review is Map ? review['packs'] : null),
      reviewLimit:
          _allowed(review is Map ? review['limit'] : null, _reviewLimits, 20),
      quizSources: _ids(quiz is Map ? quiz['sources'] : null),
      quizCount: _allowed(quiz is Map ? quiz['count'] : null, _quizCounts, 20),
    );
  }

  static List<String> _ids(Object? v) => v is List
      ? [
          for (final e in v)
            if (e is String && e.isNotEmpty) e,
        ]
      : const [];

  static int _allowed(Object? v, List<int> allowed, int def) =>
      v is num && allowed.contains(v.toInt()) ? v.toInt() : def;
}

class LearnScreen extends ConsumerStatefulWidget {
  const LearnScreen({super.key});

  @override
  ConsumerState<LearnScreen> createState() => _LearnScreenState();
}

class _LearnScreenState extends ConsumerState<LearnScreen> {
  /// 'review' | 'quiz'
  String _tab = 'review';

  final Set<String> _reviewPacks = {};
  int _reviewLimit = 20;
  final Set<String> _quizSources = {};
  int _quizCount = 20;

  _LearnConfig? _saved;

  /// null = follow the selection (auto-expand when a textbook pack is
  /// selected); set once the user taps the toggle.
  bool? _textbooksExpanded;

  @override
  void initState() {
    super.initState();
    final raw =
        ref.read(sharedPreferencesProvider).getString(_kLearnConfigPref);
    if (raw == null || raw.isEmpty) return;
    _LearnConfig? cfg;
    try {
      cfg = _LearnConfig.fromJson(jsonDecode(raw));
    } on FormatException {
      cfg = null; // corrupt pref — start clean
    }
    if (cfg == null) return;
    _saved = cfg;
    _tab = cfg.mode;
    _reviewPacks.addAll(cfg.reviewPacks);
    _reviewLimit = cfg.reviewLimit;
    _quizSources.addAll(cfg.quizSources);
    _quizCount = cfg.quizCount;
  }

  // -------------------------------------------------------------------------
  // Data / session plumbing
  // -------------------------------------------------------------------------

  void _reload() {
    ref.invalidate(packsRegistryProvider);
    ref.invalidate(decksProvider);
    ref.invalidate(learnSummaryProvider);
  }

  Future<void> _refresh() async {
    _reload();
    await Future.wait([
      ref
          .read(packsRegistryProvider.future)
          .then<void>((_) {}, onError: (_) {}),
      ref.read(decksProvider.future).then<void>((_) {}, onError: (_) {}),
      ref.read(learnSummaryProvider.future).then<void>((_) {}, onError: (_) {}),
    ]);
  }

  String _studyUri(String mode, List<String> sources, int count) => Uri(
        path: '/study',
        queryParameters: {
          'mode': mode,
          if (sources.isNotEmpty) 'sources': sources.join(','),
          'count': '$count',
        },
      ).toString();

  Future<void> _startSession(String uri) async {
    await context.push(uri);
    if (mounted) ref.invalidate(learnSummaryProvider);
  }

  /// Persists the current selections as the last-started config.
  void _persist(String mode, List<String> reviewSel, List<String> quizSel) {
    final cfg = _LearnConfig(
      mode: mode,
      reviewPacks: reviewSel,
      reviewLimit: _reviewLimit,
      quizSources: quizSel,
      quizCount: _quizCount,
    );
    ref
        .read(sharedPreferencesProvider)
        .setString(_kLearnConfigPref, jsonEncode(cfg.toJson()));
    setState(() => _saved = cfg);
  }

  void _continueLast() {
    final cfg = _saved;
    if (cfg == null) return;
    _startSession(cfg.mode == 'quiz'
        ? _studyUri('quiz', cfg.quizSources, cfg.quizCount)
        : _studyUri('review', cfg.reviewPacks, cfg.reviewLimit));
  }

  /// "Quiz · HSK 1, My deck · 20" — one-line summary of a saved config.
  String _describe(
      BuildContext context, _LearnConfig cfg, Map<String, String> titles) {
    String names(List<String> ids) {
      final list = [
        for (final id in ids) titles[id] ?? id.replaceFirst('deck:', ''),
      ];
      final head = list.take(3).join(', ');
      return list.length > 3 ? '$head +${list.length - 3}' : head;
    }

    if (cfg.mode == 'review') {
      final src = cfg.reviewPacks.isEmpty
          ? tr(context, 'learn.dueOnly', 'due cards only')
          : names(cfg.reviewPacks);
      return '${tr(context, 'study.review', 'Review')} · $src · ${cfg.reviewLimit}';
    }
    final cnt = cfg.quizCount == 0
        ? tr(context, 'learn.allWords', 'All')
        : '${cfg.quizCount}';
    return '${tr(context, 'study.quiz', 'Quiz')} · ${names(cfg.quizSources)} · $cnt';
  }

  // -------------------------------------------------------------------------
  // Build
  // -------------------------------------------------------------------------

  @override
  Widget build(BuildContext context) {
    ref.watch(languageProvider);
    final packs = ref.watch(packsRegistryProvider);
    final decks = ref.watch(decksProvider);
    final summary = ref.watch(learnSummaryProvider);

    return Scaffold(
      body: SafeArea(
        // extendBody shell: keep the bottom inset so content scrolls behind
        // the floating dock; the ListView clears it via MediaQuery padding.
        bottom: false,
        child: _body(context, packs, decks, summary),
      ),
    );
  }

  Widget _body(
    BuildContext context,
    AsyncValue<List<PackInfo>> packs,
    AsyncValue<List<Deck>> decks,
    AsyncValue<SrsSummary> summary,
  ) {
    if (packs.hasError || decks.hasError || summary.hasError) {
      final error = packs.error ?? decks.error ?? summary.error!;
      return ErrorView(
        message: apiErrorText(context, error),
        onRetry: _reload,
      );
    }
    final packList = packs.value;
    final deckList = decks.value;
    final srs = summary.value;
    if (packList == null || deckList == null || srs == null) {
      return const LoadingView();
    }
    return _ready(context, packList, deckList, srs);
  }

  Widget _ready(BuildContext context, List<PackInfo> packs, List<Deck> decks,
      SrsSummary summary) {
    final hskPacks = [
      for (final p in packs)
        if (p.group == 'hsk') p,
    ];
    final textbookPacks = [
      for (final p in packs)
        if (p.group == 'textbook') p,
    ];
    final packIds = {for (final p in packs) p.id};
    final deckIds = {for (final d in decks) 'deck:${d.id}'};

    // Selections may reference packs/decks that no longer exist — keep them
    // out of the started session (and the saved config) but leave the raw
    // sets untouched so nothing is lost while data is still loading.
    final reviewSel = [
      for (final id in _reviewPacks)
        if (packIds.contains(id)) id,
    ];
    final quizSel = [
      for (final id in _quizSources)
        if (id.startsWith('deck:')
            ? deckIds.contains(id)
            : packIds.contains(id))
          id,
    ];

    final titles = {
      for (final p in packs) p.id: p.title,
      for (final d in decks) 'deck:${d.id}': d.name,
    };

    final saved = _saved;
    final continueReady = saved != null &&
        (saved.mode == 'review' || saved.quizSources.isNotEmpty);

    final textbookIds = {for (final p in textbookPacks) p.id};
    final activeSel = _tab == 'review' ? _reviewPacks : _quizSources;
    final textbooksExpanded =
        _textbooksExpanded ?? activeSel.any(textbookIds.contains);

    return RefreshIndicator(
      onRefresh: _refresh,
      child: ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: EdgeInsets.fromLTRB(
            16, 12, 16, 28 + MediaQuery.paddingOf(context).bottom),
        children: [
          SectionLabel(tr(context, 'learn.eyebrow', 'Study')),
          const SizedBox(height: 6),
          Text(
            tr(context, 'learn.title', 'Learn'),
            style:
                GoogleFonts.manrope(fontSize: 24, fontWeight: FontWeight.w800),
          ),
          const SizedBox(height: 16),
          if (continueReady) ...[
            _continueCard(context, saved, titles),
            const SizedBox(height: 12),
          ],
          _ModeTabs(
            value: _tab,
            onChanged: (v) => setState(() => _tab = v),
          ),
          const SizedBox(height: 18),
          if (_tab == 'review')
            ..._reviewPanel(context, summary, hskPacks, textbookPacks,
                textbooksExpanded, reviewSel, quizSel)
          else
            ..._quizPanel(context, decks, hskPacks, textbookPacks,
                textbooksExpanded, reviewSel, quizSel),
        ],
      ),
    );
  }

  Widget _continueCard(
      BuildContext context, _LearnConfig cfg, Map<String, String> titles) {
    return InkCard(
      color: accentSoftOf(context),
      borderColor: accentOf(context).withValues(alpha: 0.35),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                SectionLabel(
                    tr(context, 'learn.continueLast', 'Continue last')),
                const SizedBox(height: 5),
                Text(
                  _describe(context, cfg, titles),
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: GoogleFonts.manrope(
                      fontSize: 13.5, fontWeight: FontWeight.w600),
                ),
              ],
            ),
          ),
          const SizedBox(width: 12),
          PillButton(
            label: tr(context, 'learn.continue', 'Continue'),
            size: PillSize.sm,
            onPressed: _continueLast,
          ),
        ],
      ),
    );
  }

  // -------------------------------------------------------------------------
  // Review panel
  // -------------------------------------------------------------------------

  List<Widget> _reviewPanel(
    BuildContext context,
    SrsSummary summary,
    List<PackInfo> hskPacks,
    List<PackInfo> textbookPacks,
    bool textbooksExpanded,
    List<String> reviewSel,
    List<String> quizSel,
  ) {
    final canStart = summary.dueCount > 0 || reviewSel.isNotEmpty;
    return [
      InkCard(
        child: Row(
          children: [
            Text(
              '${summary.dueCount}',
              style: monoStyle(
                context,
                size: 30,
                weight: FontWeight.w700,
                letterSpacing: 0,
                color: accentOf(context),
              ),
            ),
            const SizedBox(width: 16),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    tr(context, 'learn.dueCards', 'cards due for review'),
                    style: GoogleFonts.manrope(
                        fontSize: 14.5, fontWeight: FontWeight.w700),
                  ),
                  const SizedBox(height: 3),
                  Text(
                    tr(
                      context,
                      'learn.dueHint',
                      'Due cards always come first — new cards from your '
                          'packs fill the rest.',
                    ),
                    style: GoogleFonts.manrope(
                        fontSize: 12.5, height: 1.35, color: text2Of(context)),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
      const SizedBox(height: 18),
      SectionLabel(tr(context, 'learn.newFrom', 'New cards from')),
      const SizedBox(height: 10),
      _packWrap(context, hskPacks, _reviewPacks),
      ..._textbookSection(
          context, textbookPacks, _reviewPacks, textbooksExpanded),
      const SizedBox(height: 18),
      SectionLabel(tr(context, 'learn.sessionLimit', 'Session limit')),
      const SizedBox(height: 10),
      Wrap(
        spacing: 8,
        runSpacing: 8,
        children: [
          for (final n in _reviewLimits)
            ChoiceChip(
              label: Text('$n'),
              selected: _reviewLimit == n,
              onSelected: (_) => setState(() => _reviewLimit = n),
            ),
        ],
      ),
      const SizedBox(height: 22),
      PillButton(
        label:
            '${tr(context, 'learn.startReview', 'Review')} (${summary.dueCount} ${tr(context, 'learn.dueShort', 'due')})',
        size: PillSize.lg,
        expanded: true,
        onPressed: canStart
            ? () {
                _persist('review', reviewSel, quizSel);
                _startSession(_studyUri('review', reviewSel, _reviewLimit));
              }
            : null,
      ),
      if (!canStart) ...[
        const SizedBox(height: 10),
        Text(
          tr(context, 'learn.reviewHint',
              'Nothing due yet — select a pack to add new cards.'),
          textAlign: TextAlign.center,
          style: GoogleFonts.manrope(fontSize: 12.5, color: text2Of(context)),
        ),
      ],
    ];
  }

  // -------------------------------------------------------------------------
  // Quiz panel
  // -------------------------------------------------------------------------

  List<Widget> _quizPanel(
    BuildContext context,
    List<Deck> decks,
    List<PackInfo> hskPacks,
    List<PackInfo> textbookPacks,
    bool textbooksExpanded,
    List<String> reviewSel,
    List<String> quizSel,
  ) {
    final canStart = quizSel.isNotEmpty;
    return [
      if (decks.isNotEmpty) ...[
        SectionLabel(tr(context, 'decks.title', 'My decks')),
        const SizedBox(height: 10),
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: [for (final d in decks) _deckChip(context, d)],
        ),
        const SizedBox(height: 18),
      ],
      SectionLabel(tr(context, 'learn.wordPacks', 'Word packs')),
      const SizedBox(height: 10),
      _packWrap(context, hskPacks, _quizSources),
      ..._textbookSection(
          context, textbookPacks, _quizSources, textbooksExpanded),
      const SizedBox(height: 18),
      SectionLabel(tr(context, 'learn.questionCount', 'Questions')),
      const SizedBox(height: 10),
      Wrap(
        spacing: 8,
        runSpacing: 8,
        children: [
          for (final n in _quizCounts)
            ChoiceChip(
              label: Text(n == 0 ? tr(context, 'learn.allWords', 'All') : '$n'),
              selected: _quizCount == n,
              onSelected: (_) => setState(() => _quizCount = n),
            ),
        ],
      ),
      const SizedBox(height: 22),
      PillButton(
        label:
            '${tr(context, 'learn.startQuiz', 'Start quiz')} (${_quizCount == 0 ? tr(context, 'learn.allWords', 'All') : _quizCount})',
        size: PillSize.lg,
        expanded: true,
        onPressed: canStart
            ? () {
                _persist('quiz', reviewSel, quizSel);
                _startSession(_studyUri('quiz', quizSel, _quizCount));
              }
            : null,
      ),
      if (!canStart) ...[
        const SizedBox(height: 10),
        Text(
          tr(context, 'learn.quizHint', 'Pick at least one source.'),
          textAlign: TextAlign.center,
          style: GoogleFonts.manrope(fontSize: 12.5, color: text2Of(context)),
        ),
      ],
    ];
  }

  // -------------------------------------------------------------------------
  // Shared pieces
  // -------------------------------------------------------------------------

  Widget _packWrap(
      BuildContext context, List<PackInfo> packs, Set<String> selection) {
    return Wrap(
      spacing: 8,
      runSpacing: 8,
      children: [for (final p in packs) _packChip(context, p, selection)],
    );
  }

  /// Collapsible textbook-pack group (auto-expands when one is selected).
  List<Widget> _textbookSection(BuildContext context, List<PackInfo> packs,
      Set<String> selection, bool expanded) {
    if (packs.isEmpty) return const [];
    return [
      const SizedBox(height: 6),
      Align(
        alignment: Alignment.centerLeft,
        child: InkWell(
          onTap: () => setState(() => _textbooksExpanded = !expanded),
          borderRadius: BorderRadius.circular(8),
          child: Padding(
            padding: const EdgeInsets.symmetric(vertical: 6),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  '${tr(context, 'learn.textbookPacks', 'Textbook packs')} (${packs.length})',
                  style: GoogleFonts.manrope(
                    fontSize: 13.5,
                    fontWeight: FontWeight.w600,
                    color: text2Of(context),
                  ),
                ),
                const SizedBox(width: 4),
                Icon(
                  expanded
                      ? Icons.expand_less_rounded
                      : Icons.expand_more_rounded,
                  size: 18,
                  color: text2Of(context),
                ),
              ],
            ),
          ),
        ),
      ),
      if (expanded) ...[
        const SizedBox(height: 4),
        _packWrap(context, packs, selection),
      ],
    ];
  }

  Widget _packChip(BuildContext context, PackInfo pack, Set<String> selection) {
    return FilterChip(
      label: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(pack.title),
          const SizedBox(width: 6),
          Text(
            '${pack.count}',
            style: monoStyle(
              context,
              size: 10,
              letterSpacing: 0.5,
              color: text3Of(context),
            ),
          ),
        ],
      ),
      selected: selection.contains(pack.id),
      onSelected: (v) => setState(() {
        if (v) {
          selection.add(pack.id);
        } else {
          selection.remove(pack.id);
        }
      }),
    );
  }

  Widget _deckChip(BuildContext context, Deck deck) {
    final id = 'deck:${deck.id}';
    return FilterChip(
      label: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 200),
            child: Text(
              deck.name,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
          ),
          const SizedBox(width: 6),
          Text(
            '${deck.count}',
            style: monoStyle(
              context,
              size: 10,
              letterSpacing: 0.5,
              color: text3Of(context),
            ),
          ),
        ],
      ),
      selected: _quizSources.contains(id),
      onSelected: deck.count == 0
          ? null
          : (v) => setState(() {
                if (v) {
                  _quizSources.add(id);
                } else {
                  _quizSources.remove(id);
                }
              }),
    );
  }
}

/// Pill segmented control for the study mode (web `Segmented` equivalent).
class _ModeTabs extends StatelessWidget {
  const _ModeTabs({required this.value, required this.onChanged});

  /// 'review' | 'quiz'
  final String value;
  final ValueChanged<String> onChanged;

  @override
  Widget build(BuildContext context) {
    final options = [
      ('review', tr(context, 'study.review', 'Review')),
      ('quiz', tr(context, 'study.quiz', 'Quiz')),
    ];
    return Container(
      padding: const EdgeInsets.all(4),
      decoration: BoxDecoration(
        color: surfaceOf(context),
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: hairlineOf(context)),
      ),
      child: Row(
        children: [
          for (final (key, label) in options)
            Expanded(
              child: Semantics(
                button: true,
                selected: key == value,
                label: label,
                child: Material(
                  color:
                      key == value ? accentSoftOf(context) : Colors.transparent,
                  shape: const StadiumBorder(),
                  clipBehavior: Clip.antiAlias,
                  child: InkWell(
                    onTap: () => onChanged(key),
                    customBorder: const StadiumBorder(),
                    child: Padding(
                      padding: const EdgeInsets.symmetric(vertical: 9),
                      child: Text(
                        label,
                        textAlign: TextAlign.center,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: GoogleFonts.manrope(
                          fontSize: 13.5,
                          fontWeight: FontWeight.w700,
                          color: key == value
                              ? accentOf(context)
                              : text2Of(context),
                        ),
                      ),
                    ),
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }
}
