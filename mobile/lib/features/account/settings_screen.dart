import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';

import '../../core/api.dart';
import '../../core/i18n.dart';
import '../../core/providers.dart';
import '../../core/theme.dart';
import '../../core/widgets.dart';

/// Settings tab (4th tab): appearance, language, study goal, account actions.
/// Everything applies instantly via [settingsProvider] (which mirrors changed
/// values to `PUT /user/settings` when authenticated).
class SettingsScreen extends ConsumerWidget {
  const SettingsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    ref.watch(languageProvider);
    final settings = ref.watch(settingsProvider);
    final notifier = ref.read(settingsProvider.notifier);
    final user = ref.watch(authProvider).value;

    return Scaffold(
      appBar: AppBar(title: Text(tr(context, 'settings.title', 'Settings'))),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 4, 16, 32),
        children: [
          SectionLabel(tr(context, 'settings.appearance', 'Appearance')),
          const SizedBox(height: 10),
          InkCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                _FieldLabel(tr(context, 'settings.theme', 'Theme')),
                const SizedBox(height: 10),
                SegmentedButton<ThemeMode>(
                  segments: [
                    ButtonSegment(
                      value: ThemeMode.dark,
                      label: Text(tr(context, 'settings.theme.dark', 'Dark')),
                    ),
                    ButtonSegment(
                      value: ThemeMode.light,
                      label: Text(tr(context, 'settings.theme.light', 'Light')),
                    ),
                    ButtonSegment(
                      value: ThemeMode.system,
                      label: Text(tr(context, 'settings.theme.system', 'System')),
                    ),
                  ],
                  selected: {settings.themeMode},
                  onSelectionChanged: (selection) =>
                      notifier.setThemeMode(selection.first),
                  showSelectedIcon: false,
                  style: SegmentedButton.styleFrom(
                    side: BorderSide(color: hairlineOf(context)),
                    foregroundColor: text2Of(context),
                    selectedBackgroundColor: accentSoftOf(context),
                    selectedForegroundColor: accentOf(context),
                    textStyle: GoogleFonts.manrope(
                      fontSize: 13.5,
                      fontWeight: FontWeight.w600,
                    ),
                    visualDensity: VisualDensity.compact,
                  ),
                ),
                const SizedBox(height: 18),
                _FieldLabel(tr(context, 'settings.accent', 'Accent color')),
                const SizedBox(height: 12),
                Wrap(
                  spacing: 10,
                  runSpacing: 10,
                  children: [
                    for (final entry in accentColors.entries)
                      _AccentSwatch(
                        name: entry.key,
                        color: entry.value,
                        selected: settings.accent == entry.key,
                        onTap: () => notifier.setAccent(entry.key),
                      ),
                  ],
                ),
              ],
            ),
          ),
          const SizedBox(height: 24),
          SectionLabel(tr(context, 'settings.language', 'Language')),
          const SizedBox(height: 10),
          InkCard(
            child: Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                for (final entry in _uiLanguages.entries)
                  ChoiceChip(
                    label: entry.key == 'zh'
                        ? HanziText(entry.value, size: 13.5)
                        : Text(entry.value),
                    selected: settings.language == entry.key,
                    showCheckmark: false,
                    onSelected: (_) => notifier.setLanguage(entry.key),
                  ),
              ],
            ),
          ),
          const SizedBox(height: 24),
          SectionLabel(tr(context, 'settings.study', 'Study')),
          const SizedBox(height: 10),
          InkCard(
            child: Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        tr(context, 'settings.dailyGoal', 'Daily goal'),
                        style: GoogleFonts.manrope(
                          fontSize: 14.5,
                          fontWeight: FontWeight.w600,
                          color: Theme.of(context).colorScheme.onSurface,
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        tr(context, 'settings.dailyGoal.hint', 'Reviews per day'),
                        style: GoogleFonts.manrope(
                          fontSize: 12.5,
                          color: text2Of(context),
                        ),
                      ),
                    ],
                  ),
                ),
                _StepButton(
                  icon: Icons.remove,
                  onTap: settings.dailyGoal > 5
                      ? () => notifier
                          .setDailyGoal((settings.dailyGoal - 5).clamp(5, 500))
                      : null,
                ),
                SizedBox(
                  width: 52,
                  child: Text(
                    '${settings.dailyGoal}',
                    textAlign: TextAlign.center,
                    style: monoStyle(
                      context,
                      size: 16,
                      weight: FontWeight.w700,
                      color: Theme.of(context).colorScheme.onSurface,
                      letterSpacing: 0,
                    ),
                  ),
                ),
                _StepButton(
                  icon: Icons.add,
                  onTap: settings.dailyGoal < 500
                      ? () => notifier
                          .setDailyGoal((settings.dailyGoal + 5).clamp(5, 500))
                      : null,
                ),
              ],
            ),
          ),
          const SizedBox(height: 24),
          SectionLabel(tr(context, 'settings.account', 'Account')),
          const SizedBox(height: 10),
          InkCard(
            padding: EdgeInsets.zero,
            child: Column(
              children: [
                if (user != null)
                  _AccountRow(
                    icon: Icons.person_outline,
                    label: user.name.isNotEmpty
                        ? user.name
                        : tr(context, 'settings.profile', 'Profile'),
                    subtitle: user.email,
                    onTap: () => context.push('/profile'),
                  )
                else
                  _AccountRow(
                    icon: Icons.login,
                    label: tr(context, 'settings.signIn', 'Sign in'),
                    onTap: () => context.go('/auth'),
                  ),
                const Divider(height: 1),
                _AccountRow(
                  icon: Icons.chat_bubble_outline,
                  label: tr(context, 'settings.feedback', 'Send feedback'),
                  onTap: () => showDialog<void>(
                    context: context,
                    builder: (_) => const _FeedbackDialog(),
                  ),
                ),
                const Divider(height: 1),
                _AccountRow(
                  icon: Icons.info_outline,
                  label: tr(context, 'settings.about', 'About'),
                  onTap: () => context.push('/about'),
                ),
                if (user != null) ...[
                  const Divider(height: 1),
                  _AccountRow(
                    icon: Icons.logout,
                    label: tr(context, 'settings.logout', 'Log out'),
                    danger: true,
                    chevron: false,
                    onTap: () => _confirmLogout(context, ref),
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }

  Future<void> _confirmLogout(BuildContext context, WidgetRef ref) async {
    final messenger = ScaffoldMessenger.of(context);
    final doneMsg = tr(context, 'settings.logout.done', 'Signed out');
    final ok = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: Text(
          tr(dialogContext, 'settings.logout.confirmTitle', 'Log out?'),
        ),
        content: Text(
          tr(dialogContext, 'settings.logout.confirmText',
              'You can sign back in at any time.'),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(dialogContext).pop(false),
            child: Text(tr(dialogContext, 'common.cancel', 'Cancel')),
          ),
          PillButton(
            label: tr(dialogContext, 'settings.logout', 'Log out'),
            variant: PillVariant.danger,
            size: PillSize.sm,
            onPressed: () => Navigator.of(dialogContext).pop(true),
          ),
        ],
      ),
    );
    if (ok != true || !context.mounted) return;
    await ref.read(authProvider.notifier).logout();
    messenger.showSnackBar(SnackBar(content: Text(doneMsg)));
    if (context.mounted) context.go('/auth');
  }
}

const Map<String, String> _uiLanguages = {
  'en': 'English',
  'ru': 'Русский',
  'tk': 'Türkmençe',
  'zh': '中文',
};

String _apiErrorText(BuildContext context, ApiException e) {
  switch (e.code) {
    case 'network':
      return tr(context, 'error.network', 'Network error. Check your connection.');
    case 'rate_limited':
      return tr(
          context, 'error.rateLimited', 'Too many requests. Try again later.');
    case 'unauthorized':
      return tr(context, 'error.unauthorized', 'Session expired. Sign in again.');
    case 'validation':
      return e.message;
    default:
      return e.message.isNotEmpty
          ? e.message
          : tr(context, 'common.error', 'Something went wrong');
  }
}

/// Small in-card field caption.
class _FieldLabel extends StatelessWidget {
  const _FieldLabel(this.text);

  final String text;

  @override
  Widget build(BuildContext context) {
    return Text(
      text,
      style: GoogleFonts.manrope(
        fontSize: 13.5,
        fontWeight: FontWeight.w600,
        color: text2Of(context),
      ),
    );
  }
}

/// Tappable accent color circle with a selected ring.
class _AccentSwatch extends StatelessWidget {
  const _AccentSwatch({
    required this.name,
    required this.color,
    required this.selected,
    required this.onTap,
  });

  final String name;
  final Color color;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      label: name,
      button: true,
      selected: selected,
      child: GestureDetector(
        onTap: onTap,
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 150),
          curve: Curves.easeOut,
          width: 44,
          height: 44,
          padding: const EdgeInsets.all(4),
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            border: Border.all(
              color: selected ? color : Colors.transparent,
              width: 2,
            ),
          ),
          child: DecoratedBox(
            decoration: BoxDecoration(shape: BoxShape.circle, color: color),
            child: selected
                ? Icon(Icons.check, size: 18, color: onAccent(color))
                : null,
          ),
        ),
      ),
    );
  }
}

/// Round +/- stepper button.
class _StepButton extends StatelessWidget {
  const _StepButton({required this.icon, this.onTap});

  final IconData icon;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return IconButton(
      onPressed: onTap,
      icon: Icon(icon, size: 20),
      style: IconButton.styleFrom(
        backgroundColor: surface2Of(context),
        foregroundColor: Theme.of(context).colorScheme.onSurface,
        disabledBackgroundColor: surfaceOf(context),
        disabledForegroundColor: text3Of(context),
        shape: const CircleBorder(),
        minimumSize: const Size(40, 40),
      ),
    );
  }
}

/// A tappable row inside the account card.
class _AccountRow extends StatelessWidget {
  const _AccountRow({
    required this.icon,
    required this.label,
    this.subtitle,
    this.onTap,
    this.danger = false,
    this.chevron = true,
  });

  final IconData icon;
  final String label;
  final String? subtitle;
  final VoidCallback? onTap;
  final bool danger;
  final bool chevron;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 13),
        child: Row(
          children: [
            Icon(icon, size: 21, color: danger ? dangerColor : text2Of(context)),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    label,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: GoogleFonts.manrope(
                      fontSize: 14.5,
                      fontWeight: FontWeight.w600,
                      color: danger
                          ? dangerColor
                          : Theme.of(context).colorScheme.onSurface,
                    ),
                  ),
                  if (subtitle != null) ...[
                    const SizedBox(height: 1),
                    Text(
                      subtitle!,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: GoogleFonts.manrope(
                        fontSize: 12.5,
                        color: text2Of(context),
                      ),
                    ),
                  ],
                ],
              ),
            ),
            if (chevron)
              Icon(Icons.chevron_right, size: 20, color: text3Of(context)),
          ],
        ),
      ),
    );
  }
}

/// Feedback dialog: topic chips + message → `POST /feedback`.
class _FeedbackDialog extends ConsumerStatefulWidget {
  const _FeedbackDialog();

  @override
  ConsumerState<_FeedbackDialog> createState() => _FeedbackDialogState();
}

class _FeedbackDialogState extends ConsumerState<_FeedbackDialog> {
  static const List<String> _topics = ['bug', 'idea', 'content', 'other'];
  static const Map<String, String> _topicDefaults = {
    'bug': 'Bug',
    'idea': 'Idea',
    'content': 'Content',
    'other': 'Other',
  };

  final TextEditingController _message = TextEditingController();
  String _topic = 'bug';
  bool _sending = false;
  String? _error;

  @override
  void dispose() {
    _message.dispose();
    super.dispose();
  }

  Future<void> _send() async {
    final text = _message.text.trim();
    if (text.isEmpty) {
      setState(() =>
          _error = tr(context, 'feedback.empty', 'Please enter a message'));
      return;
    }
    setState(() {
      _sending = true;
      _error = null;
    });
    final messenger = ScaffoldMessenger.of(context);
    final thanks = tr(context, 'feedback.thanks', 'Thanks for your feedback!');
    try {
      await ref
          .read(apiProvider)
          .post('/feedback', body: {'topic': _topic, 'message': text});
      if (!mounted) return;
      Navigator.of(context).pop();
      messenger.showSnackBar(SnackBar(content: Text(thanks)));
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() {
        _sending = false;
        _error = _apiErrorText(context, e);
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: Text(tr(context, 'feedback.title', 'Send feedback')),
      scrollable: true,
      content: SizedBox(
        width: 360,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                for (final topic in _topics)
                  ChoiceChip(
                    label: Text(
                      tr(context, 'feedback.topic.$topic',
                          _topicDefaults[topic]!),
                    ),
                    selected: _topic == topic,
                    showCheckmark: false,
                    onSelected:
                        _sending ? null : (_) => setState(() => _topic = topic),
                  ),
              ],
            ),
            const SizedBox(height: 14),
            TextField(
              controller: _message,
              enabled: !_sending,
              maxLines: 4,
              maxLength: 2000,
              decoration: InputDecoration(
                counterText: '',
                hintText: tr(context, 'feedback.hint',
                    'Tell us what happened or what you would like to see…'),
              ),
            ),
            if (_error != null) ...[
              const SizedBox(height: 10),
              Text(
                _error!,
                style: GoogleFonts.manrope(fontSize: 13, color: dangerColor),
              ),
            ],
          ],
        ),
      ),
      actions: [
        TextButton(
          onPressed: _sending ? null : () => Navigator.of(context).pop(),
          child: Text(tr(context, 'common.cancel', 'Cancel')),
        ),
        PillButton(
          label: tr(context, 'feedback.send', 'Send'),
          size: PillSize.sm,
          loading: _sending,
          onPressed: _sending ? null : _send,
        ),
      ],
    );
  }
}
