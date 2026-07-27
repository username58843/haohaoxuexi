import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';

import '../../core/i18n.dart';
import '../../core/theme.dart';
import '../../core/widgets.dart';

/// Injected at build time (`flutter build --dart-define=APP_VERSION=x.y.z`,
/// sourced from pubspec.yaml in CI) so release bumps can't leave a stale
/// hand-edited version here; the default only covers plain local runs.
const String _appVersion =
    String.fromEnvironment('APP_VERSION', defaultValue: '1.0.0');
const String _privacyUrl = 'https://haohaoxuexi.tech/privacy';
const String _termsUrl = 'https://haohaoxuexi.tech/terms';
const String _contactEmail = 'mail.tm.lb@gmail.com';

/// About: serif hero, version, blurb, motto meaning and selectable links.
class AboutScreen extends ConsumerWidget {
  const AboutScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    ref.watch(languageProvider);

    return Scaffold(
      appBar: AppBar(title: Text(tr(context, 'about.title', 'About'))),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(20, 16, 20, 40),
        children: [
          Column(
            children: [
              Row(
                mainAxisSize: MainAxisSize.min,
                mainAxisAlignment: MainAxisAlignment.center,
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  const HanziText('好好学习汉语', size: 34, weight: FontWeight.w700),
                  const SizedBox(width: 7),
                  // Accent "seal dot" next to the serif hero.
                  Padding(
                    padding: const EdgeInsets.only(bottom: 12),
                    child: Container(
                      width: 10,
                      height: 10,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        color: accentOf(context),
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 10),
              Text(
                'HaoHao XueXi',
                style: GoogleFonts.manrope(
                  fontSize: 16,
                  fontWeight: FontWeight.w700,
                  color: Theme.of(context).colorScheme.onSurface,
                ),
              ),
              const SizedBox(height: 4),
              Text('v$_appVersion', style: monoStyle(context, size: 12)),
            ],
          ),
          const SizedBox(height: 20),
          Text(
            tr(
                context,
                'about.blurb',
                'HaoHao XueXi is a free Chinese-vocabulary trainer: browse '
                    'HSK 1–6 words, collect them into decks, and memorize them '
                    'with spaced-repetition flashcards and quizzes.'),
            textAlign: TextAlign.center,
            style: GoogleFonts.manrope(
              fontSize: 14.5,
              height: 1.55,
              color: text2Of(context),
            ),
          ),
          const SizedBox(height: 24),
          InkCard(
            padding: const EdgeInsets.all(20),
            child: Column(
              children: [
                const HanziText(
                  '好好学习，天天向上',
                  size: 20,
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 10),
                Text(
                  tr(
                      context,
                      'about.motto.meaning',
                      '"Study well, and every day you will improve" — the '
                          'classic proverb this app is named after.'),
                  textAlign: TextAlign.center,
                  style: GoogleFonts.manrope(
                    fontSize: 13.5,
                    height: 1.5,
                    color: text2Of(context),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 28),
          SectionLabel(tr(context, 'about.links', 'Links')),
          const SizedBox(height: 10),
          InkCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                _LinkItem(
                  label: tr(context, 'about.privacy', 'Privacy policy'),
                  value: _privacyUrl,
                ),
                const SizedBox(height: 16),
                _LinkItem(
                  label: tr(context, 'about.terms', 'Terms of service'),
                  value: _termsUrl,
                ),
                const SizedBox(height: 16),
                _LinkItem(
                  label: tr(context, 'about.contact', 'Contact'),
                  value: _contactEmail,
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/// Caption + plain selectable URL/email (no launcher dependency).
class _LinkItem extends StatelessWidget {
  const _LinkItem({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: GoogleFonts.manrope(
            fontSize: 12.5,
            fontWeight: FontWeight.w600,
            color: text2Of(context),
          ),
        ),
        const SizedBox(height: 3),
        SelectableText(
          value,
          style: GoogleFonts.manrope(
            fontSize: 14,
            fontWeight: FontWeight.w600,
            color: accentOf(context),
          ),
        ),
      ],
    );
  }
}
