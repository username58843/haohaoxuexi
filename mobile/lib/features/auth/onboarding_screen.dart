import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';

import '../../core/i18n.dart';
import '../../core/providers.dart';
import '../../core/theme.dart';
import '../../core/widgets.dart';

/// Three-slide intro: the 5000-word HSK library, the SRS idea, and the
/// daily-goal/streak habit. Skip or "Get started" marks onboarding done in
/// settings and routes to /auth.
class OnboardingScreen extends ConsumerStatefulWidget {
  const OnboardingScreen({super.key});

  @override
  ConsumerState<OnboardingScreen> createState() => _OnboardingScreenState();
}

class _OnboardingScreenState extends ConsumerState<OnboardingScreen> {
  final PageController _controller = PageController();
  int _page = 0;

  static const int _pageCount = 3;

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  void _finish() {
    ref.read(settingsProvider.notifier).setOnboardingDone();
    context.go('/auth');
  }

  void _next() {
    if (_page >= _pageCount - 1) {
      _finish();
      return;
    }
    _controller.nextPage(
      duration: const Duration(milliseconds: 320),
      curve: Curves.easeOutCubic,
    );
  }

  @override
  Widget build(BuildContext context) {
    ref.watch(languageProvider);
    final isLast = _page == _pageCount - 1;

    return Scaffold(
      body: SafeArea(
        child: Column(
          children: [
            // Top bar: brand eyebrow + Skip.
            Padding(
              padding: const EdgeInsets.fromLTRB(24, 12, 12, 0),
              child: Row(
                children: [
                  Text('haohaoxuexi.tech', style: monoStyle(context)),
                  const Spacer(),
                  AnimatedOpacity(
                    duration: const Duration(milliseconds: 200),
                    opacity: isLast ? 0 : 1,
                    child: TextButton(
                      onPressed: isLast ? null : _finish,
                      style: TextButton.styleFrom(
                        foregroundColor: text2Of(context),
                      ),
                      child: Text(tr(context, 'onboarding.skip', 'Skip')),
                    ),
                  ),
                ],
              ),
            ),
            Expanded(
              child: PageView(
                controller: _controller,
                onPageChanged: (i) => setState(() => _page = i),
                children: [
                  _OnboardPage(
                    iconPath: 'assets/icon/icon_full.png',
                    label: '好好学习: Chinese Language',
                    eyebrow: tr(context, 'onboarding.p1.eyebrow', 'HSK 1–6'),
                    title: tr(
                        context, 'onboarding.p1.title', 'Learn 5000 HSK words'),
                    text: tr(
                      context,
                      'onboarding.p1.text',
                      'Every word for HSK levels 1–6 with pinyin and translations — ready to browse, even offline.',
                    ),
                  ),
                  _OnboardPage(
                    glyph: '忆',
                    pinyin: 'yì',
                    eyebrow: tr(context, 'onboarding.p2.eyebrow',
                        'Spaced repetition'),
                    title: tr(context, 'onboarding.p2.title',
                        'Review right before you forget'),
                    text: tr(
                      context,
                      'onboarding.p2.text',
                      'Smart flashcards come back exactly when your memory is about to let go — so every minute of study counts.',
                    ),
                    extra: const _IntervalChips(),
                  ),
                  _OnboardPage(
                    glyph: '恒',
                    pinyin: 'héng',
                    eyebrow:
                        tr(context, 'onboarding.p3.eyebrow', 'Daily habit'),
                    title: tr(context, 'onboarding.p3.title',
                        'Keep your streak alive'),
                    text: tr(
                      context,
                      'onboarding.p3.text',
                      'Set a daily goal, grow your streak, and watch your mastery build across every HSK level.',
                    ),
                    extra: const _StreakPreview(),
                  ),
                ],
              ),
            ),
            // Dots.
            Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                for (var i = 0; i < _pageCount; i++)
                  AnimatedContainer(
                    duration: const Duration(milliseconds: 240),
                    curve: Curves.easeOut,
                    width: i == _page ? 22 : 8,
                    height: 8,
                    margin: const EdgeInsets.symmetric(horizontal: 4),
                    decoration: BoxDecoration(
                      color: i == _page
                          ? accentOf(context)
                          : hairline2Of(context),
                      borderRadius: BorderRadius.circular(999),
                    ),
                  ),
              ],
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(24, 20, 24, 20),
              child: PillButton(
                label: isLast
                    ? tr(context, 'onboarding.start', 'Get started')
                    : tr(context, 'onboarding.next', 'Next'),
                size: PillSize.lg,
                expanded: true,
                onPressed: _next,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _OnboardPage extends StatelessWidget {
  const _OnboardPage({
    this.glyph,
    this.pinyin,
    this.iconPath,
    this.label,
    required this.eyebrow,
    required this.title,
    required this.text,
    this.extra,
  });

  final String? glyph;
  final String? pinyin;
  final String? iconPath;
  final String? label;
  final String eyebrow;
  final String title;
  final String text;
  final Widget? extra;

  @override
  Widget build(BuildContext context) {
    final accent = accentOf(context);
    return Center(
      child: SingleChildScrollView(
        padding: const EdgeInsets.symmetric(horizontal: 28, vertical: 16),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            // App icon with rounded corners.
            ClipRRect(
              borderRadius: BorderRadius.circular(32),
              child: SizedBox(
                width: 140,
                height: 140,
                child: iconPath != null
                    ? Image.asset(
                        iconPath!,
                        fit: BoxFit.cover,
                      )
                    : Container(
                        decoration: BoxDecoration(
                          color: accentSoftOf(context),
                          border: Border.all(color: hairlineOf(context)),
                        ),
                        child: Center(
                          child: HanziText(glyph!, size: 76, color: accent),
                        ),
                      ),
              ),
            ),
            const SizedBox(height: 10),
            if (label != null)
              Text(
                label!,
                textAlign: TextAlign.center,
                style: monoStyle(context, size: 13),
              )
            else if (pinyin != null)
              Text(pinyin!, style: monoStyle(context, size: 12)),
            const SizedBox(height: 28),
            SectionLabel(eyebrow),
            const SizedBox(height: 10),
            Text(
              title,
              textAlign: TextAlign.center,
              style: GoogleFonts.manrope(
                fontSize: 25,
                fontWeight: FontWeight.w800,
                height: 1.2,
                color: Theme.of(context).colorScheme.onSurface,
              ),
            ),
            const SizedBox(height: 12),
            Text(
              text,
              textAlign: TextAlign.center,
              style: GoogleFonts.manrope(
                fontSize: 15,
                height: 1.5,
                color: text2Of(context),
              ),
            ),
            if (extra != null) ...[
              const SizedBox(height: 24),
              extra!,
            ],
          ],
        ),
      ),
    );
  }
}

/// Growing review intervals: 10m → 1d → 4d → 2w.
class _IntervalChips extends StatelessWidget {
  const _IntervalChips();

  @override
  Widget build(BuildContext context) {
    final labels = [
      '10${tr(context, 'time.m', 'm')}',
      '1${tr(context, 'time.d', 'd')}',
      '4${tr(context, 'time.d', 'd')}',
      '2${tr(context, 'time.w', 'w')}',
    ];
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        for (var i = 0; i < labels.length; i++) ...[
          if (i > 0)
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 4),
              child: Icon(Icons.chevron_right,
                  size: 16, color: text3Of(context)),
            ),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
            decoration: BoxDecoration(
              color: surfaceOf(context),
              borderRadius: BorderRadius.circular(999),
              border: Border.all(color: hairlineOf(context)),
            ),
            child: Text(
              labels[i],
              style: monoStyle(context, size: 12, letterSpacing: 0.6),
            ),
          ),
        ],
      ],
    );
  }
}

/// A week of streak dots + the daily-goal caption.
class _StreakPreview extends StatelessWidget {
  const _StreakPreview();

  @override
  Widget build(BuildContext context) {
    final accent = accentOf(context);
    const doneDays = 5;
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            for (var i = 0; i < 7; i++)
              Container(
                width: 16,
                height: 16,
                margin: const EdgeInsets.symmetric(horizontal: 4),
                decoration: BoxDecoration(
                  color: i < doneDays ? accent : surface2Of(context),
                  shape: BoxShape.circle,
                  border: Border.all(
                    color: i < doneDays
                        ? Colors.transparent
                        : hairline2Of(context),
                  ),
                ),
              ),
          ],
        ),
        const SizedBox(height: 12),
        Text(
          tr(context, 'onboarding.goalCaption', 'DAILY GOAL · 20'),
          style: monoStyle(context, size: 11),
        ),
      ],
    );
  }
}
