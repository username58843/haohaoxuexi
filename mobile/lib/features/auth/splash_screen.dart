import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';

import '../../core/i18n.dart';
import '../../core/providers.dart';
import '../../core/theme.dart';
import '../../core/widgets.dart';

/// Branded launch screen. Waits for the first resolution of [authProvider]
/// (session restore from the stored token), then routes:
/// - onboarding not done → `/onboarding`
/// - signed in → `/`
/// - signed out (or restore failed) → `/auth`
class SplashScreen extends ConsumerStatefulWidget {
  const SplashScreen({super.key});

  @override
  ConsumerState<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends ConsumerState<SplashScreen> {
  @override
  void initState() {
    super.initState();
    _resolve();
  }

  Future<void> _resolve() async {
    // Keep the brand on screen for a beat even when auth resolves instantly.
    final minimumBranding =
        Future<void>.delayed(const Duration(milliseconds: 900));

    Object? user;
    try {
      user = await ref.read(authProvider.future);
    } catch (_) {
      // Session restore failed (offline with a stored token, server error...).
      // Treat as signed out; the user can log in again from /auth.
      user = null;
    }
    await minimumBranding;
    if (!mounted) return;

    final settings = ref.read(settingsProvider);
    if (!settings.onboardingDone) {
      context.go('/onboarding');
    } else if (user != null) {
      context.go('/');
    } else {
      context.go('/auth');
    }
  }

  @override
  Widget build(BuildContext context) {
    ref.watch(languageProvider);
    final accent = accentOf(context);

    return Scaffold(
      body: Stack(
        children: [
          // Subtle accent-tinted glow behind the wordmark (design: --bg-glow).
          Positioned.fill(
            child: DecoratedBox(
              decoration: BoxDecoration(
                gradient: RadialGradient(
                  center: const Alignment(0, -0.35),
                  radius: 1.1,
                  colors: [
                    accent.withValues(alpha: 0.07),
                    Colors.transparent,
                  ],
                ),
              ),
            ),
          ),
          SafeArea(
            child: Center(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text('HAOHAO XUEXI', style: monoStyle(context)),
                  const SizedBox(height: 14),
                  Row(
                    mainAxisSize: MainAxisSize.min,
                    crossAxisAlignment: CrossAxisAlignment.end,
                    children: [
                      // Default weight (w600): NotoSerifSC is bundled only in
                      // its SemiBold cut — see the fonts note in pubspec.yaml.
                      const HanziText('好好学习汉语', size: 40),
                      const SizedBox(width: 10),
                      // Accent "seal dot" next to the hero hanzi.
                      Container(
                        width: 10,
                        height: 10,
                        margin: const EdgeInsets.only(bottom: 14),
                        decoration: BoxDecoration(
                          color: accent,
                          shape: BoxShape.circle,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 10),
                  Text(
                    tr(context, 'splash.tagline', 'Learn Chinese every day'),
                    style: GoogleFonts.manrope(
                      fontSize: 14.5,
                      fontWeight: FontWeight.w500,
                      color: text2Of(context),
                    ),
                  ),
                  const SizedBox(height: 40),
                  const SizedBox(
                    width: 28,
                    height: 28,
                    child: CircularProgressIndicator(strokeWidth: 3),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}
