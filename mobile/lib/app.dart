import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'core/dock.dart';
import 'core/i18n.dart';
import 'core/providers.dart';
import 'core/theme.dart';
import 'features/account/about_screen.dart';
import 'features/account/profile_screen.dart';
import 'features/account/settings_screen.dart';
import 'features/auth/auth_screen.dart';
import 'features/auth/forgot_password_screen.dart';
import 'features/auth/onboarding_screen.dart';
import 'features/auth/reset_password_screen.dart';
import 'features/auth/splash_screen.dart';
import 'features/browse/hsk_screen.dart';
import 'features/browse/map_screen.dart';
import 'features/decks/deck_detail_screen.dart';
import 'features/decks/decks_screen.dart';
import 'features/home/home_screen.dart';
import 'features/learn/learn_screen.dart';
import 'features/study/study_logic.dart';
import 'features/study/study_screen.dart';

/// Routes that are reachable without authentication.
const Set<String> _openPaths = {
  '/splash',
  '/onboarding',
  '/auth',
  '/forgot-password',
};

final routerProvider = Provider<GoRouter>((ref) {
  // Bridge riverpod auth changes into a Listenable for GoRouter.
  final refresh = ValueNotifier(0);
  ref.onDispose(refresh.dispose);
  ref.listen(authProvider, (e, s) => refresh.value++);

  return GoRouter(
    initialLocation: '/splash',
    refreshListenable: refresh,
    redirect: (context, state) {
      final location = state.matchedLocation;
      if (location == '/splash') return null; // splash drives its own exit

      final settings = ref.read(settingsProvider);
      if (!settings.onboardingDone && location != '/onboarding') {
        return '/onboarding';
      }

      final auth = ref.read(authProvider);
      final isAuthed = auth.value != null;
      if (!isAuthed && !auth.isLoading && !_openPaths.contains(location)) {
        return '/auth';
      }
      if (isAuthed && location == '/auth') return '/';
      return null;
    },
    routes: [
      GoRoute(
        path: '/splash',
        builder: (context, state) => const SplashScreen(),
      ),
      GoRoute(
        path: '/onboarding',
        builder: (context, state) => const OnboardingScreen(),
      ),
      GoRoute(
        path: '/auth',
        builder: (context, state) => const AuthScreen(),
      ),
      GoRoute(
        path: '/forgot-password',
        builder: (context, state) => const ForgotPasswordScreen(),
      ),
      GoRoute(
        path: '/reset-password',
        builder: (context, state) {
          final token = state.uri.queryParameters['token'] ?? '';
          return ResetPasswordScreen(token: token);
        },
      ),
      // Pushed (full-screen, outside the shell) routes.
      GoRoute(
        path: '/study',
        builder: (context, state) {
          final params = state.uri.queryParameters;
          final sources = (params['sources'] ?? '')
              .split(',')
              .map((s) => s.trim())
              .where((s) => s.isNotEmpty)
              .toList();
          // Question modes: filtered to the known ids, defaulting to the
          // web's 字→Pinyin + 字→Meaning pair (like /learn/session).
          final qmodes = (params['qmodes'] ?? '')
              .split(',')
              .map((s) => s.trim())
              .where(kAllQmodes.contains)
              .toList();
          return StudyScreen(
            mode: params['mode'] ?? 'review',
            sources: sources,
            count: int.tryParse(params['count'] ?? '') ?? 20,
            qmodes: qmodes.isEmpty ? const ['cp', 'ct'] : qmodes,
          );
        },
      ),
      GoRoute(
        path: '/hsk/map',
        builder: (context, state) => const MapScreen(),
      ),
      GoRoute(
        path: '/decks/:id',
        builder: (context, state) =>
            DeckDetailScreen(id: state.pathParameters['id']!),
      ),
      GoRoute(
        path: '/profile',
        builder: (context, state) => const ProfileScreen(),
      ),
      GoRoute(
        path: '/about',
        builder: (context, state) => const AboutScreen(),
      ),
      // Main tabs inside the bottom-nav shell.
      ShellRoute(
        builder: (context, state, child) => HomeShell(child: child),
        routes: [
          GoRoute(
            path: '/',
            builder: (context, state) => const HomeScreen(),
          ),
          GoRoute(
            path: '/learn',
            builder: (context, state) => const LearnScreen(),
          ),
          GoRoute(
            path: '/hsk',
            builder: (context, state) => const HskScreen(),
          ),
          GoRoute(
            path: '/decks',
            builder: (context, state) => const DecksScreen(),
          ),
          GoRoute(
            path: '/settings',
            builder: (context, state) => const SettingsScreen(),
          ),
        ],
      ),
    ],
  );
});

class HaoHaoApp extends ConsumerWidget {
  const HaoHaoApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final settings = ref.watch(settingsProvider);
    // Rebuild the app when the UI language changes.
    ref.watch(languageProvider);
    final router = ref.watch(routerProvider);
    final accent = accentColors[settings.accent] ?? accentColors[defaultAccentKey]!;

    return MaterialApp.router(
      title: '好好学习汉语',
      debugShowCheckedModeBanner: false,
      theme: buildTheme(Brightness.light, accent),
      darkTheme: buildTheme(Brightness.dark, accent),
      themeMode: settings.themeMode,
      routerConfig: router,
    );
  }
}

/// Bottom-navigation shell wrapping the five main tabs.
class HomeShell extends ConsumerWidget {
  const HomeShell({super.key, required this.child});

  final Widget child;

  static const List<String> _tabPaths = [
    '/',
    '/learn',
    '/hsk',
    '/decks',
    '/settings',
  ];

  int _indexOf(String location) {
    if (location.startsWith('/learn')) return 1;
    if (location.startsWith('/hsk')) return 2;
    if (location.startsWith('/decks')) return 3;
    if (location.startsWith('/settings')) return 4;
    return 0;
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    ref.watch(languageProvider);
    final location = GoRouterState.of(context).uri.path;
    final index = _indexOf(location);

    return Scaffold(
      // Content scrolls behind the frosted dock; tab screens pad their
      // scrollables with MediaQuery.paddingOf(context).bottom.
      extendBody: true,
      body: child,
      bottomNavigationBar: FloatingDock(
        selectedIndex: index,
        onSelect: (i) {
          if (i != index) context.go(_tabPaths[i]);
        },
        destinations: [
          DockDestination(
            icon: Icons.home_outlined,
            selectedIcon: Icons.home,
            label: tr(context, 'nav.home', 'Home'),
          ),
          DockDestination(
            icon: Icons.school_outlined,
            selectedIcon: Icons.school,
            label: tr(context, 'nav.learn', 'Learn'),
          ),
          DockDestination(
            icon: Icons.grid_view_outlined,
            selectedIcon: Icons.grid_view,
            label: tr(context, 'nav.hsk', 'HSK'),
          ),
          DockDestination(
            icon: Icons.style_outlined,
            selectedIcon: Icons.style,
            label: tr(context, 'nav.decks', 'Decks'),
          ),
          DockDestination(
            icon: Icons.settings_outlined,
            selectedIcon: Icons.settings,
            label: tr(context, 'nav.settings', 'Settings'),
          ),
        ],
      ),
    );
  }
}
