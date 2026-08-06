import 'dart:math' as math;

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

/// SharedPreferences key remembering the last packs picked for learning.
const String _kStudyPacksPref = 'studyPacks';

String _trN(BuildContext context, String key, String enDefault, int n) =>
    tr(context, key, enDefault).replaceAll('{n}', '$n');

/// English defaults for the header date label ({wd} = weekday, {mon} = month).
const List<String> _weekdayDefaults = [
  'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday',
];
const List<String> _monthDefaults = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

/// Localized "Sunday · Jul 27" — hand-rolled (no intl date symbols for 'tk').
String _dateLabel(BuildContext context, DateTime now) {
  final wd = tr(context, 'date.wd.${now.weekday}',
      _weekdayDefaults[now.weekday - 1]);
  final mon =
      tr(context, 'date.mon.${now.month}', _monthDefaults[now.month - 1]);
  return tr(context, 'date.fmt', '{wd} · {mon} {d}')
      .replaceAll('{wd}', wd)
      .replaceAll('{mon}', mon)
      .replaceAll('{d}', '${now.day}');
}

/// Dashboard data: SRS summary + last-14-days activity, fetched together.
class HomeData {
  const HomeData({required this.summary, required this.activity});

  final SrsSummary summary;
  final List<ActivityDay> activity;
}

final homeDataProvider = FutureProvider.autoDispose<HomeData>((ref) async {
  final api = ref.watch(apiProvider);
  final tz = DateTime.now().timeZoneOffset.inMinutes;
  final results = await Future.wait([
    api.get('/srs/summary', query: {'tzOffset': tz}),
    api.get('/stats/activity', query: {'days': 14, 'tzOffset': tz}),
  ]);
  final daysRaw = results[1]['days'];
  return HomeData(
    summary: SrsSummary.fromJson(results[0]),
    activity: daysRaw is List
        ? [
            for (final d in daysRaw)
              if (d is Map) ActivityDay.fromJson(Map<String, dynamic>.from(d)),
          ]
        : const [],
  );
});

/// Built-in pack registry entry from `GET /words/packs`.
class PackInfo {
  const PackInfo({
    required this.id,
    required this.title,
    required this.group,
    this.count = 0,
  });

  final String id;
  final String title;

  /// 'hsk' | 'textbook'
  final String group;
  final int count;
}

final packsRegistryProvider = FutureProvider<List<PackInfo>>((ref) async {
  final api = ref.watch(apiProvider);
  final data = await api.get('/words/packs');
  final raw = data['items'] ?? data['packs'];
  if (raw is! List) return const [];
  return [
    for (final p in raw)
      if (p is Map && (p['id'] ?? '').toString().isNotEmpty)
        PackInfo(
          id: p['id'].toString(),
          title: (p['title'] ?? p['id']).toString(),
          group: (p['group'] ?? '').toString(),
          count: (p['count'] as num?)?.toInt() ?? 0,
        ),
  ];
});

class HomeScreen extends ConsumerWidget {
  const HomeScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    ref.watch(languageProvider);
    final user = ref.watch(authProvider).value;
    final data = ref.watch(homeDataProvider);

    return Scaffold(
      body: SafeArea(
        // extendBody shell: keep the bottom inset so content scrolls behind
        // the floating dock; the ListView clears it via MediaQuery padding.
        bottom: false,
        child: data.when(
          loading: () => const LoadingView(),
          error: (e, _) => ErrorView(
            message: _errorText(context, e),
            onRetry: () => ref.invalidate(homeDataProvider),
          ),
          data: (d) => RefreshIndicator(
            onRefresh: () => ref
                .refresh(homeDataProvider.future)
                .then<void>((_) {}, onError: (_) {}),
            child: ListView(
              physics: const AlwaysScrollableScrollPhysics(),
              padding: EdgeInsets.fromLTRB(
                  16, 12, 16, 28 + MediaQuery.paddingOf(context).bottom),
              children: [
                _Header(name: user?.name),
                const SizedBox(height: 18),
                _StatChips(summary: d.summary),
                const SizedBox(height: 12),
                _GoalCard(summary: d.summary),
                const SizedBox(height: 12),
                _ctaSection(context, ref, d.summary),
                const SizedBox(height: 20),
                _ActivityChart(days: d.activity),
                const SizedBox(height: 12),
                _LevelBars(byLevel: d.summary.byLevel),
                const SizedBox(height: 12),
                Row(
                  children: [
                    Expanded(
                      child: _QuickLink(
                        icon: Icons.grid_view_rounded,
                        label: tr(context, 'home.browseHsk', 'Browse HSK'),
                        onTap: () => context.go('/hsk'),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: _QuickLink(
                        icon: Icons.style_rounded,
                        label: tr(context, 'home.myDecks', 'My decks'),
                        onTap: () => context.go('/decks'),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                _QuickLink(
                  icon: Icons.replay_rounded,
                  label: tr(context, 'home.difficultWords', 'Difficult words'),
                  onTap: () => context.push('/difficult'),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  String _errorText(BuildContext context, Object e) {
    if (e is ApiException) {
      if (e.isNetwork) {
        return tr(context, 'error.network', 'Network error. Check your connection.');
      }
      return e.message;
    }
    return tr(context, 'common.error', 'Something went wrong');
  }

  // -------------------------------------------------------------------------
  // Primary CTA
  // -------------------------------------------------------------------------

  Widget _ctaSection(BuildContext context, WidgetRef ref, SrsSummary s) {
    final accent = accentOf(context);
    if (s.dueCount > 0) {
      return Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          InkCard(
            color: accentSoftOf(context),
            borderColor: accent.withValues(alpha: 0.35),
            padding: const EdgeInsets.all(18),
            // count=0 = the whole due queue (one server batch caps at 500);
            // the label shows the real due count up to that cap.
            onTap: () =>
                _startStudy(context, ref, '/study?mode=review&count=0'),
            child: Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        _trN(context, 'home.reviewCards',
                            'Review {n} cards', math.min(s.dueCount, 500)),
                        style: GoogleFonts.manrope(
                          fontSize: 17,
                          fontWeight: FontWeight.w800,
                          color: accent,
                        ),
                      ),
                      const SizedBox(height: 3),
                      Text(
                        tr(context, 'home.keepStreak', 'Keep your streak going'),
                        style: GoogleFonts.manrope(
                            fontSize: 13, color: text2Of(context)),
                      ),
                    ],
                  ),
                ),
                Icon(Icons.arrow_forward_rounded, color: accent),
              ],
            ),
          ),
          const SizedBox(height: 10),
          Align(
            alignment: Alignment.center,
            child: PillButton(
              label: tr(context, 'home.learnNew', 'Learn new words'),
              variant: PillVariant.soft,
              size: PillSize.sm,
              icon: Icons.add_rounded,
              onPressed: () => _openPackPicker(context, ref),
            ),
          ),
        ],
      );
    }
    return InkCard(
      color: accentSoftOf(context),
      borderColor: accent.withValues(alpha: 0.35),
      padding: const EdgeInsets.all(18),
      onTap: () => _openPackPicker(context, ref),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  tr(context, 'home.learnNew', 'Learn new words'),
                  style: GoogleFonts.manrope(
                    fontSize: 17,
                    fontWeight: FontWeight.w800,
                    color: accent,
                  ),
                ),
                const SizedBox(height: 3),
                Text(
                  tr(context, 'home.learnNewSub',
                      'New words from your chosen packs'),
                  style:
                      GoogleFonts.manrope(fontSize: 13, color: text2Of(context)),
                ),
              ],
            ),
          ),
          Icon(Icons.arrow_forward_rounded, color: accent),
        ],
      ),
    );
  }

  Future<void> _startStudy(
      BuildContext context, WidgetRef ref, String uri) async {
    await context.push(uri);
    if (context.mounted) ref.invalidate(homeDataProvider);
  }

  /// Bottom-sheet multi-select pack picker (HSK 1–6 + textbook packs);
  /// selection is remembered in SharedPreferences.
  Future<void> _openPackPicker(BuildContext context, WidgetRef ref) async {
    final prefs = ref.read(sharedPreferencesProvider);
    final remembered = prefs.getStringList(_kStudyPacksPref) ?? const ['hsk1'];
    final selection = <String>{...remembered};
    final maxHeight = MediaQuery.of(context).size.height * 0.75;

    final result = await showModalBottomSheet<List<String>>(
      context: context,
      isScrollControlled: true,
      // Root navigator: the Home tab lives inside the HomeShell body
      // (extendBody: true), so a sheet on the nearest navigator would be
      // painted behind the floating dock, hiding the bottom button.
      useRootNavigator: true,
      builder: (sheetContext) {
        return SafeArea(
          child: StatefulBuilder(
            builder: (context, setSheetState) {
              return Padding(
                padding: const EdgeInsets.fromLTRB(20, 4, 20, 20),
                child: ConstrainedBox(
                  constraints: BoxConstraints(maxHeight: maxHeight),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      Text(
                        tr(context, 'home.choosePacks', 'Choose packs'),
                        style: GoogleFonts.manrope(
                            fontSize: 17, fontWeight: FontWeight.w700),
                      ),
                      const SizedBox(height: 14),
                      Flexible(
                        child: SingleChildScrollView(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              SectionLabel(
                                  tr(context, 'home.hskLevels', 'HSK levels')),
                              const SizedBox(height: 10),
                              Wrap(
                                spacing: 8,
                                runSpacing: 8,
                                children: [
                                  for (var i = 1; i <= 6; i++)
                                    FilterChip(
                                      label: Text('HSK $i'),
                                      selected: selection.contains('hsk$i'),
                                      onSelected: (v) => setSheetState(() {
                                        if (v) {
                                          selection.add('hsk$i');
                                        } else {
                                          selection.remove('hsk$i');
                                        }
                                      }),
                                    ),
                                ],
                              ),
                              Consumer(
                                builder: (context, ref, _) {
                                  final packs =
                                      ref.watch(packsRegistryProvider);
                                  final textbook = [
                                    for (final p
                                        in packs.value ?? const <PackInfo>[])
                                      if (p.group == 'textbook') p,
                                  ];
                                  if (packs.isLoading) {
                                    return const Padding(
                                      padding: EdgeInsets.only(top: 18),
                                      child: Center(
                                        child: SizedBox(
                                          width: 20,
                                          height: 20,
                                          child: CircularProgressIndicator(
                                              strokeWidth: 2.4),
                                        ),
                                      ),
                                    );
                                  }
                                  if (textbook.isEmpty) {
                                    return const SizedBox.shrink();
                                  }
                                  return Column(
                                    crossAxisAlignment:
                                        CrossAxisAlignment.start,
                                    children: [
                                      const SizedBox(height: 18),
                                      SectionLabel(tr(context,
                                          'home.textbooks', 'Textbooks')),
                                      const SizedBox(height: 10),
                                      Wrap(
                                        spacing: 8,
                                        runSpacing: 8,
                                        children: [
                                          for (final p in textbook)
                                            FilterChip(
                                              label: Text(p.title),
                                              selected:
                                                  selection.contains(p.id),
                                              onSelected: (v) =>
                                                  setSheetState(() {
                                                if (v) {
                                                  selection.add(p.id);
                                                } else {
                                                  selection.remove(p.id);
                                                }
                                              }),
                                            ),
                                        ],
                                      ),
                                    ],
                                  );
                                },
                              ),
                            ],
                          ),
                        ),
                      ),
                      const SizedBox(height: 16),
                      PillButton(
                        label: tr(context, 'home.start', 'Start'),
                        expanded: true,
                        size: PillSize.lg,
                        onPressed: selection.isEmpty
                            ? null
                            : () => Navigator.of(sheetContext)
                                .pop(selection.toList()),
                      ),
                    ],
                  ),
                ),
              );
            },
          ),
        );
      },
    );

    if (result == null || result.isEmpty) return;
    await prefs.setStringList(_kStudyPacksPref, result);
    if (!context.mounted) return;
    await _startStudy(
        context, ref, '/study?mode=review&sources=${result.join(',')}');
  }
}

// ---------------------------------------------------------------------------
// Sections
// ---------------------------------------------------------------------------

class _Header extends StatelessWidget {
  const _Header({this.name});

  final String? name;

  @override
  Widget build(BuildContext context) {
    final now = DateTime.now();
    final hour = now.hour;
    final String greeting;
    if (hour < 12) {
      greeting = tr(context, 'home.greeting.morning', 'Good morning');
    } else if (hour < 18) {
      greeting = tr(context, 'home.greeting.afternoon', 'Good afternoon');
    } else {
      greeting = tr(context, 'home.greeting.evening', 'Good evening');
    }
    final trimmed = (name ?? '').trim();
    final firstName =
        trimmed.isEmpty ? '' : trimmed.split(RegExp(r'\s+')).first;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SectionLabel(_dateLabel(context, now)),
        const SizedBox(height: 6),
        Text(
          firstName.isEmpty ? greeting : '$greeting, $firstName',
          style: GoogleFonts.manrope(fontSize: 24, fontWeight: FontWeight.w800),
        ),
      ],
    );
  }
}

class _StatChips extends StatelessWidget {
  const _StatChips({required this.summary});

  final SrsSummary summary;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        _StatChip(
          emoji: '🔥',
          value: '${summary.streak}',
          label: tr(context, 'home.streak', 'Streak'),
        ),
        const SizedBox(width: 10),
        _StatChip(
          emoji: '📥',
          value: '${summary.dueCount}',
          label: tr(context, 'home.due', 'Due'),
        ),
        const SizedBox(width: 10),
        _StatChip(
          emoji: '✅',
          value: '${summary.todayReviews}',
          label: tr(context, 'home.today', 'Today'),
        ),
      ],
    );
  }
}

class _StatChip extends StatelessWidget {
  const _StatChip(
      {required this.emoji, required this.value, required this.label});

  final String emoji;
  final String value;
  final String label;

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: InkCard(
        padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 8),
        child: Column(
          children: [
            Text(
              '$emoji $value',
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: GoogleFonts.manrope(
                  fontSize: 17, fontWeight: FontWeight.w800),
            ),
            const SizedBox(height: 2),
            Text(
              label,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: GoogleFonts.manrope(
                  fontSize: 11.5, color: text2Of(context)),
            ),
          ],
        ),
      ),
    );
  }
}

class _GoalCard extends StatelessWidget {
  const _GoalCard({required this.summary});

  final SrsSummary summary;

  @override
  Widget build(BuildContext context) {
    final pct = summary.goalProgress;
    return InkCard(
      child: Row(
        children: [
          SizedBox(
            width: 64,
            height: 64,
            child: CustomPaint(
              painter: _RingPainter(
                progress: pct,
                color: accentOf(context),
                track: surface3Of(context),
                stroke: 7,
              ),
              child: Center(
                child: Text(
                  '${(pct * 100).round()}%',
                  style: GoogleFonts.manrope(
                      fontSize: 13, fontWeight: FontWeight.w800),
                ),
              ),
            ),
          ),
          const SizedBox(width: 16),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                SectionLabel(tr(context, 'home.dailyGoal', 'Daily goal')),
                const SizedBox(height: 4),
                Text(
                  '${summary.todayReviews} / ${summary.goal}',
                  style: GoogleFonts.manrope(
                      fontSize: 18, fontWeight: FontWeight.w800),
                ),
                if (summary.goalMet) ...[
                  const SizedBox(height: 2),
                  Text(
                    tr(context, 'home.goalDone', 'Goal reached!'),
                    style: GoogleFonts.manrope(
                      fontSize: 12.5,
                      fontWeight: FontWeight.w700,
                      color: okColor,
                    ),
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _ActivityChart extends StatelessWidget {
  const _ActivityChart({required this.days});

  final List<ActivityDay> days;

  @override
  Widget build(BuildContext context) {
    final sorted = [...days]..sort((a, b) => a.day.compareTo(b.day));
    final last = sorted.length > 14 ? sorted.sublist(sorted.length - 14) : sorted;
    final padded = [
      for (var i = last.length; i < 14; i++) const ActivityDay(day: ''),
      ...last,
    ];
    final maxReviews = padded.fold<int>(0, (m, d) => math.max(m, d.reviews));

    return InkCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SectionLabel(tr(context, 'home.activity14', 'Last 14 days')),
          const SizedBox(height: 14),
          SizedBox(
            height: 72,
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                for (var i = 0; i < padded.length; i++)
                  Expanded(
                    child: Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 1.5),
                      child: Container(
                        height: maxReviews == 0
                            ? 4
                            : 4 + (padded[i].reviews / maxReviews) * 68,
                        decoration: BoxDecoration(
                          color: padded[i].reviews > 0
                              ? accentOf(context).withValues(
                                  alpha: i == padded.length - 1 ? 1 : 0.55)
                              : surface3Of(context),
                          borderRadius: const BorderRadius.vertical(
                              top: Radius.circular(4)),
                        ),
                      ),
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

class _LevelBars extends StatelessWidget {
  const _LevelBars({required this.byLevel});

  final Map<int, LevelProgress> byLevel;

  @override
  Widget build(BuildContext context) {
    return InkCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SectionLabel(tr(context, 'home.hskProgress', 'HSK progress')),
          const SizedBox(height: 12),
          for (var level = 1; level <= 6; level++)
            _row(context, level, byLevel[level] ?? const LevelProgress()),
        ],
      ),
    );
  }

  Widget _row(BuildContext context, int level, LevelProgress p) {
    final seenF =
        p.total > 0 ? (p.seen / p.total).clamp(0.0, 1.0) : 0.0;
    final matureF =
        p.total > 0 ? (p.mature / p.total).clamp(0.0, 1.0) : 0.0;
    final accent = accentOf(context);

    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 5),
      child: Row(
        children: [
          SizedBox(
            width: 46,
            child: Text(
              'HSK $level',
              style: monoStyle(context, size: 11, letterSpacing: 0.5),
            ),
          ),
          Expanded(
            child: SizedBox(
              height: 8,
              child: LayoutBuilder(
                builder: (context, constraints) {
                  final w = constraints.maxWidth;
                  return ClipRRect(
                    borderRadius: BorderRadius.circular(4),
                    child: Stack(
                      children: [
                        Positioned.fill(
                          child: ColoredBox(color: surface3Of(context)),
                        ),
                        if (seenF > 0)
                          Positioned(
                            left: 0,
                            top: 0,
                            bottom: 0,
                            width: w * seenF,
                            child: ColoredBox(
                                color: accent.withValues(alpha: 0.35)),
                          ),
                        if (matureF > 0)
                          Positioned(
                            left: 0,
                            top: 0,
                            bottom: 0,
                            width: w * matureF,
                            child: ColoredBox(color: accent),
                          ),
                      ],
                    ),
                  );
                },
              ),
            ),
          ),
          const SizedBox(width: 10),
          SizedBox(
            width: 62,
            child: Text(
              '${p.seen}/${p.total}',
              textAlign: TextAlign.right,
              style: GoogleFonts.manrope(
                fontSize: 11.5,
                fontWeight: FontWeight.w600,
                color: text3Of(context),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _QuickLink extends StatelessWidget {
  const _QuickLink(
      {required this.icon, required this.label, required this.onTap});

  final IconData icon;
  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InkCard(
      onTap: onTap,
      padding: const EdgeInsets.all(14),
      child: Row(
        children: [
          Container(
            width: 38,
            height: 38,
            decoration: BoxDecoration(
              color: accentSoftOf(context),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Icon(icon, size: 20, color: accentOf(context)),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Text(
              label,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: GoogleFonts.manrope(
                  fontSize: 14, fontWeight: FontWeight.w700),
            ),
          ),
          Icon(Icons.chevron_right_rounded,
              size: 20, color: text3Of(context)),
        ],
      ),
    );
  }
}

class _RingPainter extends CustomPainter {
  _RingPainter({
    required this.progress,
    required this.color,
    required this.track,
    this.stroke = 8,
  });

  final double progress;
  final Color color;
  final Color track;
  final double stroke;

  @override
  void paint(Canvas canvas, Size size) {
    final center = size.center(Offset.zero);
    final radius = (size.shortestSide - stroke) / 2;
    canvas.drawCircle(
      center,
      radius,
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = stroke
        ..color = track,
    );
    final p = progress.clamp(0.0, 1.0);
    if (p > 0) {
      canvas.drawArc(
        Rect.fromCircle(center: center, radius: radius),
        -math.pi / 2,
        p * 2 * math.pi,
        false,
        Paint()
          ..style = PaintingStyle.stroke
          ..strokeWidth = stroke
          ..strokeCap = StrokeCap.round
          ..color = color,
      );
    }
  }

  @override
  bool shouldRepaint(_RingPainter oldDelegate) =>
      oldDelegate.progress != progress ||
      oldDelegate.color != color ||
      oldDelegate.track != track ||
      oldDelegate.stroke != stroke;
}
