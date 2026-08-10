import 'dart:async';
import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart' show HapticFeedback;
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../core/api.dart';
import '../../core/i18n.dart';
import '../../core/models.dart';
import '../../core/providers.dart';
import '../../core/theme.dart';
import '../../core/widgets.dart';
import '../decks/decks_screen.dart' show apiErrorText;
import 'word_sheet.dart';

/// Muted per-level tints — same values as the web `--hsk-1..6` tokens.
const Map<int, Color> hskLevelColors = {
  1: Color(0xFF4A7A5C),
  2: Color(0xFF3D6F78),
  3: Color(0xFF45607A),
  4: Color(0xFF5C5278),
  5: Color(0xFF7A4F62),
  6: Color(0xFF7A5A3D),
  7: Color(0xFF6E3D55), // the combined HSK 3.0 band 7–9
};

const List<int> _levels = [1, 2, 3, 4, 5, 6, 7];

/// Account-synced "known words" set (canonical [Word.id]s) — the word map's
/// mastery store, shared with the web via `GET/PUT/DELETE /api/v1/words/known`.
///
/// - The local cache is scoped per account ('known_words_v1:<userId>' in
///   SharedPreferences, plain 'known_words_v1' while signed out). It used to be
///   one shared bucket, which leaked marks between accounts on the same device:
///   the bucket outlived logout and account deletion, and the login merge then
///   pushed those ids up to whichever account signed in next. The signed-out
///   bucket is *consumed* — merged once into the account that claims it, then
///   deleted — so a second account can never inherit it.
/// - Toggles apply instantly to the cache, keeping the map usable offline.
/// - Every toggle is queued as a delta ('known_words_pending_v1:<userId>') and
///   flushed (debounced) as `PUT { add, remove }`. Pending deltas survive
///   restarts, so changes made offline sync on the next launch.
/// - When a signed-in session is (re)established, the server set is merged in
///   (union) and local-only ids are pushed up — progress made on this device
///   before sync existed, or while offline, is never lost.
class KnownWordsNotifier extends Notifier<Set<String>> {
  static const _storeKey = 'known_words_v1';
  static const _pendingKey = 'known_words_pending_v1';
  static const _flushDelay = Duration(milliseconds: 800);

  Timer? _flushTimer;
  bool _flushing = false;
  String? _syncedForUser;

  /// Account the in-memory set belongs to; null = signed out.
  String? _scope;

  SharedPreferences get _prefs => ref.read(sharedPreferencesProvider);

  String _storeKeyFor(String? userId) =>
      userId == null ? _storeKey : '$_storeKey:$userId';

  String _pendingKeyFor(String? userId) =>
      userId == null ? _pendingKey : '$_pendingKey:$userId';

  Set<String> _readStore(String? userId) =>
      (_prefs.getStringList(_storeKeyFor(userId)) ?? const []).toSet();

  @override
  Set<String> build() {
    ref.onDispose(() => _flushTimer?.cancel());
    // Follow the session: re-point the cache at the signed-in account, or back
    // at the signed-out bucket, so one account's marks are never written into
    // another account's storage.
    ref.listen(authProvider, (previous, next) {
      final user = next.value;
      if (user != null) {
        if (_scope != user.id) {
          _scope = user.id;
          state = _readStore(user.id);
        }
        unawaited(_syncWithServer(user.id));
      } else if (!next.isLoading) {
        _syncedForUser = null; // logged out — re-merge on the next login
        if (_scope != null) {
          _scope = null;
          state = _readStore(null);
        }
      }
    });
    final current = ref.read(authProvider).value;
    _scope = current?.id;
    if (current != null) {
      // Session was already restored before this provider first built.
      Future.microtask(() => _syncWithServer(current.id));
    }
    return _readStore(_scope);
  }

  void toggle(String wordId) {
    if (wordId.isEmpty) return;
    final next = Set<String>.of(state);
    final turnedOn = next.add(wordId);
    if (!turnedOn) next.remove(wordId);
    _setLocal(next);
    final pending = _readPending();
    if (turnedOn) {
      pending.add.add(wordId);
      pending.remove.remove(wordId);
    } else {
      pending.remove.add(wordId);
      pending.add.remove(wordId);
    }
    _writePending(pending);
    _scheduleFlush();
  }

  /// Wipes the set for the signed-in account (cache, queued deltas and the
  /// server document). Powers "clear known words" in settings — the escape
  /// hatch for accounts that absorbed another account's marks before the
  /// per-account scoping above existed. Returns false when the server call
  /// fails (the local cache is cleared either way).
  Future<bool> clear() async {
    _flushTimer?.cancel();
    _writePending((add: <String>{}, remove: <String>{}));
    _setLocal(<String>{});
    if (_scope == null) return true;
    try {
      await ref.read(apiProvider).delete('/words/known');
      return true;
    } on ApiException {
      return false;
    }
  }

  void _setLocal(Set<String> next) {
    state = next;
    _prefs.setStringList(_storeKeyFor(_scope), next.toList(growable: false));
  }

  ({Set<String> add, Set<String> remove}) _readPending() {
    final raw = _prefs.getString(_pendingKeyFor(_scope));
    if (raw == null || raw.isEmpty) {
      return (add: <String>{}, remove: <String>{});
    }
    try {
      final decoded = jsonDecode(raw);
      Set<String> ids(Object? v) => v is List
          ? {
              for (final e in v)
                if (e is String && e.isNotEmpty) e,
            }
          : <String>{};
      if (decoded is Map) {
        return (add: ids(decoded['add']), remove: ids(decoded['remove']));
      }
    } on FormatException {
      // corrupt pref — start clean
    }
    return (add: <String>{}, remove: <String>{});
  }

  void _writePending(({Set<String> add, Set<String> remove}) pending) {
    final key = _pendingKeyFor(_scope);
    if (pending.add.isEmpty && pending.remove.isEmpty) {
      _prefs.remove(key);
    } else {
      _prefs.setString(
        key,
        jsonEncode({
          'add': pending.add.toList(growable: false),
          'remove': pending.remove.toList(growable: false),
        }),
      );
    }
  }

  /// Reads the signed-out bucket and deletes it, so words marked before signing
  /// in are adopted by exactly one account.
  Set<String> _takeGuestKnown() {
    final guest = _readStore(null);
    _prefs.remove(_storeKeyFor(null));
    _prefs.remove(_pendingKeyFor(null));
    return guest;
  }

  void _scheduleFlush() {
    _flushTimer?.cancel();
    _flushTimer = Timer(_flushDelay, () => unawaited(_flush()));
  }

  Future<void> _flush() async {
    if (_flushing) return;
    if (_scope == null) return; // guest — keep queued until an account signs in
    final pending = _readPending();
    final add = pending.add.toList(growable: false);
    final remove = pending.remove.toList(growable: false);
    if (add.isEmpty && remove.isEmpty) return;
    _flushing = true;
    try {
      await ref
          .read(apiProvider)
          .put('/words/known', body: {'add': add, 'remove': remove});
      // Clear exactly what was sent — deltas queued mid-flight stay pending.
      final after = _readPending();
      after.add.removeAll(add);
      after.remove.removeAll(remove);
      _writePending(after);
    } on ApiException {
      // Offline / transient — deltas stay queued for the next flush.
    } finally {
      _flushing = false;
    }
  }

  Future<void> _syncWithServer(String userId) async {
    if (_syncedForUser == userId) return;
    _syncedForUser = userId;
    _scope = userId;
    try {
      final data = await ref.read(apiProvider).get('/words/known');
      final rawIds = data['ids'];
      final serverIds = rawIds is List
          ? {
              for (final e in rawIds)
                if (e is String && e.isNotEmpty) e,
            }
          : <String>{};
      final pending = _readPending();
      // Guest marks are claimed only once the account is known, and the
      // signed-out bucket is deleted in the process.
      final local = _readStore(userId)..addAll(_takeGuestKnown());
      final merged = Set<String>.of(local)
        // A locally-queued removal wins over the (stale) server copy.
        ..addAll(serverIds.where((id) => !pending.remove.contains(id)));
      pending.add.addAll(local.difference(serverIds));
      _writePending(pending);
      _setLocal(merged);
      await _flush();
    } on ApiException {
      _syncedForUser = null; // transient failure — retry on the next login
    }
  }
}

final knownWordsProvider =
    NotifierProvider<KnownWordsNotifier, Set<String>>(KnownWordsNotifier.new);

/// A readable version of a level tint for text/icons on tinted washes:
/// lightened in dark mode, darkened in light mode.
Color _tintText(BuildContext context, Color tint) {
  final isDark = Theme.of(context).brightness == Brightness.dark;
  return isDark
      ? Color.lerp(tint, Colors.white, 0.45)!
      : Color.lerp(tint, Colors.black, 0.2)!;
}

/// HSK word map: the whole HSK 1–6 lexicon (bundled packs, offline) rendered
/// as a wall of hanzi tiles tinted by level, with a device-local known/unknown
/// overlay, level filter chips, search, and per-level lazy sliver grids.
class MapScreen extends ConsumerStatefulWidget {
  const MapScreen({super.key});

  @override
  ConsumerState<MapScreen> createState() => _MapScreenState();
}

class _MapScreenState extends ConsumerState<MapScreen> {
  final TextEditingController _searchController = TextEditingController();
  Timer? _debounce;

  /// Selected HSK level; null = all levels.
  int? _level;
  String _query = '';

  @override
  void dispose() {
    _debounce?.cancel();
    _searchController.dispose();
    super.dispose();
  }

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
        _KnownToggleAction(word: word),
        PillButton(
          label: tr(context, 'word.addToDeck', 'Add to deck'),
          icon: Icons.playlist_add_rounded,
          onPressed: () => showAddToDeckSheet(context, ref, word),
        ),
      ],
    );
  }

  /// Long-press on a tile: flip known ⇄ unknown with haptic feedback
  /// (mirrors the web map's press-and-hold, incl. the on/off distinction).
  void _toggleKnown(Word word) {
    final wasKnown = ref.read(knownWordsProvider).contains(word.id);
    unawaited(wasKnown ? HapticFeedback.lightImpact() : HapticFeedback.mediumImpact());
    ref.read(knownWordsProvider.notifier).toggle(word.id);
  }

  @override
  Widget build(BuildContext context) {
    ref.watch(languageProvider);
    final known = ref.watch(knownWordsProvider);
    // All six packs are bundled assets: watch them all so the stats card
    // covers every level while the wall respects the active filter.
    final packs = <int, AsyncValue<List<Word>>>{
      for (final l in _levels) l: ref.watch(wordPacksProvider(hskPackIdFor(l))),
    };
    final active = _level == null ? _levels : <int>[_level!];

    AsyncValue<List<Word>>? errorPack;
    for (final l in active) {
      final p = packs[l]!;
      if (p.hasError && !p.hasValue) {
        errorPack = p;
        break;
      }
    }
    final anyLoading = active.any((l) => packs[l]!.isLoading);

    // Stats across ALL loaded levels (not just the filtered view).
    final levelStats = <int, ({int known, int total})>{};
    var totalWords = 0;
    var totalKnown = 0;
    for (final l in _levels) {
      final words = packs[l]!.value ?? const <Word>[];
      var k = 0;
      for (final w in words) {
        if (known.contains(w.id)) k++;
      }
      levelStats[l] = (known: k, total: words.length);
      totalWords += words.length;
      totalKnown += k;
    }

    final q = _query.toLowerCase();
    final qns = _normalize(_query);
    final hasQuery = q.isNotEmpty;
    final sections = <({int level, List<Word> filtered})>[
      for (final l in active)
        (
          level: l,
          filtered: hasQuery
              ? [
                  for (final w in packs[l]!.value ?? const <Word>[])
                    if (_matches(w, q, qns)) w,
                ]
              : packs[l]!.value ?? const <Word>[],
        ),
    ];
    final anyTiles = sections.any((s) => s.filtered.isNotEmpty);

    return Scaffold(
      appBar: AppBar(title: Text(tr(context, 'wmap.title', 'Word Map'))),
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
                for (var l = 1; l <= 7; l++)
                  _levelChip(l, 'HSK ${hskLevelLabel(l)}'),
              ],
            ),
          ),
          const SizedBox(height: 4),
          Expanded(
            child: _wall(
              errorPack: errorPack,
              anyLoading: anyLoading,
              anyTiles: anyTiles,
              hasQuery: hasQuery,
              sections: sections,
              levelStats: levelStats,
              totalKnown: totalKnown,
              totalWords: totalWords,
              knownIds: known,
            ),
          ),
        ],
      ),
    );
  }

  Widget _levelChip(int? level, String label) {
    final tint = level == null ? null : hskLevelColors[level];
    return Padding(
      padding: const EdgeInsets.only(right: 8),
      child: ChoiceChip(
        label: tint == null
            ? Text(label)
            : Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Container(
                    width: 8,
                    height: 8,
                    decoration:
                        BoxDecoration(color: tint, shape: BoxShape.circle),
                  ),
                  const SizedBox(width: 6),
                  Text(label),
                ],
              ),
        selected: _level == level,
        showCheckmark: false,
        onSelected: (_) => setState(() => _level = level),
      ),
    );
  }

  Widget _wall({
    required AsyncValue<List<Word>>? errorPack,
    required bool anyLoading,
    required bool anyTiles,
    required bool hasQuery,
    required List<({int level, List<Word> filtered})> sections,
    required Map<int, ({int known, int total})> levelStats,
    required int totalKnown,
    required int totalWords,
    required Set<String> knownIds,
  }) {
    if (errorPack != null) {
      return ErrorView(
        message: apiErrorText(context, errorPack.error ?? 'error'),
        onRetry: () {
          for (final l in _levels) {
            ref.invalidate(wordPacksProvider(hskPackIdFor(l)));
          }
        },
      );
    }
    if (!anyTiles && anyLoading) return const LoadingView();
    if (!anyTiles && hasQuery) {
      return EmptyView(
        glyph: '无',
        title: tr(context, 'hsk.empty.title', 'No words found'),
        text: tr(context, 'hsk.empty.text', 'Try a different search or level.'),
      );
    }

    return CustomScrollView(
      slivers: [
        SliverToBoxAdapter(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 4),
            child: _StatsCard(
              levelStats: levelStats,
              totalKnown: totalKnown,
              totalWords: totalWords,
            ),
          ),
        ),
        SliverToBoxAdapter(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(20, 4, 20, 4),
            child: Text(
              tr(
                context,
                'wmap.holdHint',
                'Tip: press and hold a tile to mark the word as known — '
                    'hold it again to unmark.',
              ),
              style: GoogleFonts.manrope(
                fontSize: 12,
                height: 1.35,
                color: text3Of(context),
              ),
            ),
          ),
        ),
        for (final s in sections)
          if (s.filtered.isNotEmpty) ...[
            SliverToBoxAdapter(
              child: _LevelHeader(
                level: s.level,
                known: levelStats[s.level]!.known,
                total: levelStats[s.level]!.total,
              ),
            ),
            SliverPadding(
              padding: const EdgeInsets.fromLTRB(16, 0, 16, 10),
              sliver: SliverGrid(
                gridDelegate: const SliverGridDelegateWithMaxCrossAxisExtent(
                  maxCrossAxisExtent: 64,
                  mainAxisSpacing: 6,
                  crossAxisSpacing: 6,
                ),
                delegate: SliverChildBuilderDelegate(
                  (context, i) {
                    final word = s.filtered[i];
                    return _MapTile(
                      word: word,
                      tint: hskLevelColors[s.level]!,
                      known: knownIds.contains(word.id),
                      onTap: () => _openWord(word),
                      // Press-and-hold toggles known ⇄ unknown right on the
                      // wall — same gesture as the web word map.
                      onLongPress: () => _toggleKnown(word),
                    );
                  },
                  childCount: s.filtered.length,
                ),
              ),
            ),
          ],
        if (anyLoading)
          const SliverToBoxAdapter(
            child: Padding(
              padding: EdgeInsets.all(24),
              child: Center(
                child: SizedBox(
                  width: 24,
                  height: 24,
                  child: CircularProgressIndicator(strokeWidth: 3),
                ),
              ),
            ),
          ),
        SliverToBoxAdapter(
          child: SizedBox(height: 24 + MediaQuery.paddingOf(context).bottom),
        ),
      ],
    );
  }
}

/// "Known" toggle inside the word sheet — a live consumer so the button
/// flips between soft/primary while the sheet stays open.
class _KnownToggleAction extends ConsumerWidget {
  const _KnownToggleAction({required this.word});

  final Word word;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final isKnown = ref.watch(knownWordsProvider).contains(word.id);
    return PillButton(
      label: isKnown
          ? tr(context, 'wmap.known', 'Known')
          : tr(context, 'wmap.markKnown', 'Mark as known'),
      icon: Icons.check_rounded,
      variant: isKnown ? PillVariant.primary : PillVariant.soft,
      onPressed: () => ref.read(knownWordsProvider.notifier).toggle(word.id),
    );
  }
}

/// Overall mastery + per-level legend with mini progress bars.
class _StatsCard extends StatelessWidget {
  const _StatsCard({
    required this.levelStats,
    required this.totalKnown,
    required this.totalWords,
  });

  final Map<int, ({int known, int total})> levelStats;
  final int totalKnown;
  final int totalWords;

  @override
  Widget build(BuildContext context) {
    final mastery =
        totalWords > 0 ? (totalKnown / totalWords * 100).round() : 0;
    return InkCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              Text(
                '$mastery%',
                style: monoStyle(
                  context,
                  size: 28,
                  weight: FontWeight.w700,
                  color: Theme.of(context).colorScheme.onSurface,
                  letterSpacing: 0,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      tr(context, 'wmap.mastery', 'Mastery'),
                      style: GoogleFonts.manrope(
                        fontSize: 13.5,
                        fontWeight: FontWeight.w700,
                        color: Theme.of(context).colorScheme.onSurface,
                      ),
                    ),
                    const SizedBox(height: 1),
                    Text(
                      '$totalKnown/$totalWords',
                      style: monoStyle(
                        context,
                        size: 11,
                        color: text3Of(context),
                        letterSpacing: 0.8,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),
          for (final l in _levels)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 3),
              child: Row(
                children: [
                  Container(
                    width: 8,
                    height: 8,
                    decoration: BoxDecoration(
                      color: hskLevelColors[l],
                      shape: BoxShape.circle,
                    ),
                  ),
                  const SizedBox(width: 8),
                  SizedBox(
                    width: 46,
                    child: Text(
                      'HSK ${hskLevelLabel(l)}',
                      style: monoStyle(
                        context,
                        size: 10,
                        color: text2Of(context),
                        letterSpacing: 0.8,
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: _MiniBar(
                      fraction: levelStats[l]!.total > 0
                          ? levelStats[l]!.known / levelStats[l]!.total
                          : 0,
                      tint: hskLevelColors[l]!,
                    ),
                  ),
                  const SizedBox(width: 8),
                  Text(
                    '${levelStats[l]!.known}/${levelStats[l]!.total}',
                    style: monoStyle(
                      context,
                      size: 10,
                      color: text3Of(context),
                      letterSpacing: 0.5,
                    ),
                  ),
                ],
              ),
            ),
        ],
      ),
    );
  }
}

/// Thin rounded progress bar tinted by level.
class _MiniBar extends StatelessWidget {
  const _MiniBar({required this.fraction, required this.tint});

  final double fraction;
  final Color tint;

  @override
  Widget build(BuildContext context) {
    return ClipRRect(
      borderRadius: BorderRadius.circular(999),
      child: SizedBox(
        height: 5,
        child: ColoredBox(
          color: surface3Of(context),
          child: Align(
            alignment: Alignment.centerLeft,
            child: FractionallySizedBox(
              widthFactor: fraction.clamp(0, 1).toDouble(),
              child: ColoredBox(color: tint),
            ),
          ),
        ),
      ),
    );
  }
}

/// Level section header: tinted "HSK n" tag + known/total + mini bar + %.
class _LevelHeader extends StatelessWidget {
  const _LevelHeader({
    required this.level,
    required this.known,
    required this.total,
  });

  final int level;
  final int known;
  final int total;

  @override
  Widget build(BuildContext context) {
    final tint = hskLevelColors[level]!;
    final pct = total > 0 ? (known / total * 100).round() : 0;
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 14, 16, 8),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 4),
            decoration: BoxDecoration(
              color: tint.withValues(alpha: 0.18),
              borderRadius: BorderRadius.circular(999),
            ),
            child: Text(
              'HSK ${hskLevelLabel(level)}',
              style: monoStyle(
                context,
                size: 10,
                color: _tintText(context, tint),
                letterSpacing: 0.8,
              ),
            ),
          ),
          const SizedBox(width: 10),
          Text(
            '$known/$total',
            style: monoStyle(
              context,
              size: 10.5,
              color: text2Of(context),
              letterSpacing: 0.6,
            ),
          ),
          const Spacer(),
          SizedBox(
            width: 64,
            child: _MiniBar(
              fraction: total > 0 ? known / total : 0,
              tint: tint,
            ),
          ),
          const SizedBox(width: 8),
          Text(
            '$pct%',
            style: monoStyle(
              context,
              size: 10.5,
              color: text2Of(context),
              letterSpacing: 0.5,
            ),
          ),
        ],
      ),
    );
  }
}

/// One hanzi tile. Unknown: faint level-tint wash + muted glyph; known:
/// stronger tint fill, tinted border and a small check.
class _MapTile extends StatelessWidget {
  const _MapTile({
    required this.word,
    required this.tint,
    required this.known,
    required this.onTap,
    this.onLongPress,
  });

  final Word word;
  final Color tint;
  final bool known;
  final VoidCallback onTap;

  /// Press-and-hold → toggle known (web word-map parity).
  final VoidCallback? onLongPress;

  /// Font size + optional 2-row split by character count so the word always
  /// fits the square tile (the web version clipped long words). The outer
  /// FittedBox(scaleDown) is the hard no-overflow guarantee.
  static (String, double) _glyph(String text) {
    final chars = text.characters;
    final n = chars.length;
    if (n <= 1) return (text, 26);
    if (n == 2) return (text, 19);
    if (n == 3) return (text, 13.5);
    // 4 chars wrap 2×2; 5+ split into two rows.
    final head = n == 4 ? 2 : (n + 1) ~/ 2;
    final size = n == 4 ? 15.0 : 11.0;
    return ('${chars.take(head)}\n${chars.skip(head)}', size);
  }

  @override
  Widget build(BuildContext context) {
    final (display, size) = _glyph(word.simplified);
    final glyphColor = known
        ? Color.lerp(Theme.of(context).colorScheme.onSurface, tint, 0.35)!
        : text2Of(context);
    return GestureDetector(
      onTap: onTap,
      onLongPress: onLongPress,
      child: DecoratedBox(
        decoration: BoxDecoration(
          color: tint.withValues(alpha: known ? 0.26 : 0.08),
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: known ? tint : hairlineOf(context)),
        ),
        child: Stack(
          children: [
            Padding(
              padding: const EdgeInsets.all(4),
              child: Center(
                child: FittedBox(
                  fit: BoxFit.scaleDown,
                  child: Text(
                    display,
                    textAlign: TextAlign.center,
                    locale: const Locale('zh'),
                    // Single default weight (w600): NotoSerifSC is bundled
                    // only in its SemiBold cut (see pubspec.yaml). The
                    // known/unknown distinction stays visible through
                    // glyphColor and the tile tint/border above.
                    style: hanziStyle(
                      context,
                      size: size,
                      color: glyphColor,
                      height: 1.12,
                    ),
                  ),
                ),
              ),
            ),
            if (known)
              Positioned(
                top: 3,
                right: 3,
                child: Icon(
                  Icons.check_rounded,
                  size: 10,
                  color: _tintText(context, tint),
                ),
              ),
          ],
        ),
      ),
    );
  }
}
