import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/api.dart';
import '../../core/i18n.dart';
import '../../core/providers.dart';
import '../../core/reminders.dart';
import '../../core/theme.dart';
import '../../core/typography.dart';
import '../../core/widgets.dart';
import '../browse/map_screen.dart' show knownWordsProvider;

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
        // extendBody shell: clear the floating dock at the end of the scroll.
        padding: EdgeInsets.fromLTRB(
            16, 4, 16, 32 + MediaQuery.paddingOf(context).bottom),
        children: [
          SectionLabel(tr(context, 'settings.appearance', 'Appearance')),
          const SizedBox(height: 10),
          InkCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                DropdownButtonFormField<String>(
                  initialValue: settings.hanziFont,
                  isExpanded: true,
                  decoration: InputDecoration(labelText:
                      tr(context, 'settings.hanziFont', 'Chinese character font')),
                  items: [for (final entry in hanziFonts.entries)
                    DropdownMenuItem(value: entry.key, child: Text(
                      entry.key == 'system'
                          ? tr(context, 'settings.font.system', 'System font')
                          : entry.value,
                    )),
                  ],
                  onChanged: (key) { if (key != null) notifier.setHanziFont(key); },
                ),
                const SizedBox(height: 16),
                Text('好好学习，天天向上。', style: hanziStyle(context, size: 28)),
                const SizedBox(height: 20),
                DropdownButtonFormField<String>(
                  initialValue: settings.interfaceFont,
                  isExpanded: true,
                  decoration: InputDecoration(labelText:
                      tr(context, 'settings.interfaceFont', 'Interface font')),
                  items: [for (final entry in interfaceFonts.entries)
                    DropdownMenuItem(value: entry.key, child: Text(
                      entry.key == 'system'
                          ? tr(context, 'settings.font.system', 'System font')
                          : entry.value,
                    )),
                  ],
                  onChanged: (key) { if (key != null) notifier.setInterfaceFont(key); },
                ),
                const SizedBox(height: 12),
                const Text('Learn · Учиться · Öwrenmek'),
                const SizedBox(height: 8),
                Text(tr(context, 'settings.font.offline',
                    'Fonts are stored on your device and work offline.')),
              ],
            ),
          ),
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
                    textStyle: TextStyle(
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
                        // Localized name feeds the Semantics (a11y) label.
                        name: tr(context, 'accent.${entry.key}', entry.key),
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
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Row(
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            tr(context, 'settings.dailyGoal', 'Daily goal'),
                            style: TextStyle(
                              fontSize: 14.5,
                              fontWeight: FontWeight.w600,
                              color: Theme.of(context).colorScheme.onSurface,
                            ),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            tr(context, 'settings.dailyGoal.hint',
                                'Reviews per day'),
                            style: TextStyle(
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
                          ? () => notifier.setDailyGoal(
                              (settings.dailyGoal - 5).clamp(5, 500))
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
                          ? () => notifier.setDailyGoal(
                              (settings.dailyGoal + 5).clamp(5, 500))
                          : null,
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                const Divider(),
                const SizedBox(height: 12),
                Row(
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            tr(context, 'settings.reminder', 'Daily reminder'),
                            style: TextStyle(
                              fontSize: 14.5,
                              fontWeight: FontWeight.w600,
                              color: Theme.of(context).colorScheme.onSurface,
                            ),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            tr(context, 'settings.reminder.hint',
                                'A nudge to review your due cards'),
                            style: TextStyle(
                              fontSize: 12.5,
                              color: text2Of(context),
                            ),
                          ),
                        ],
                      ),
                    ),
                    Switch(
                      value: settings.reminderEnabled,
                      onChanged: (enabled) =>
                          _setReminderEnabled(context, ref, enabled),
                    ),
                  ],
                ),
                if (settings.reminderEnabled) ...[
                  const SizedBox(height: 6),
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          tr(context, 'settings.reminder.time',
                              'Reminder time'),
                          style: TextStyle(
                            fontSize: 14.5,
                            fontWeight: FontWeight.w600,
                            color: Theme.of(context).colorScheme.onSurface,
                          ),
                        ),
                      ),
                      PillButton(
                        label: _formatMinutes(settings.reminderMinutes),
                        size: PillSize.sm,
                        variant: PillVariant.soft,
                        icon: Icons.schedule_rounded,
                        onPressed: () => _pickReminderTime(context, ref),
                      ),
                    ],
                  ),
                ],
                const SizedBox(height: 12),
                const Divider(),
                const SizedBox(height: 12),
                SwitchRow(
                  label: tr(context, 'settings.speak', 'Speak on correct answer'),
                  hint: tr(
                    context,
                    'settings.speak.hint',
                    'In a quiz, read the question aloud after every correct '
                        'answer',
                  ),
                  value: settings.quizSpeakOnCorrect,
                  onChanged: notifier.setQuizSpeakOnCorrect,
                ),
              ],
            ),
          ),
          if (user != null) ...[
            const SizedBox(height: 24),
            SectionLabel(tr(context, 'settings.knownWords', 'Known words')),
            const SizedBox(height: 10),
            const _KnownWordsCard(),
          ],
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

  /// 24h "HH:MM" — locale-neutral (the app has no Material locale delegates,
  /// so TimeOfDay.format would always render the en_US AM/PM style).
  static String _formatMinutes(int minutes) {
    final h = (minutes ~/ 60).toString().padLeft(2, '0');
    final m = (minutes % 60).toString().padLeft(2, '0');
    return '$h:$m';
  }

  Future<void> _setReminderEnabled(
      BuildContext context, WidgetRef ref, bool enabled) async {
    final messenger = ScaffoldMessenger.of(context);
    final deniedMsg = tr(context, 'settings.reminder.denied',
        'Notifications are disabled — allow them in system settings.');
    ref.read(settingsProvider.notifier).setReminderEnabled(enabled);
    if (!enabled) return;
    // Android 13+ runtime permission. The reminder stays armed either way —
    // it starts showing as soon as the user grants notifications.
    final granted = await Reminders.requestPermission();
    if (!granted) {
      messenger.showSnackBar(SnackBar(content: Text(deniedMsg)));
    }
  }

  Future<void> _pickReminderTime(BuildContext context, WidgetRef ref) async {
    final settings = ref.read(settingsProvider);
    final picked = await showTimePicker(
      context: context,
      initialTime: TimeOfDay(
        hour: settings.reminderMinutes ~/ 60,
        minute: settings.reminderMinutes % 60,
      ),
    );
    if (picked == null || !context.mounted) return;
    ref
        .read(settingsProvider.notifier)
        .setReminderTime(picked.hour * 60 + picked.minute);
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
    case 'server_error':
      return tr(context, 'error.server', 'Server error. Please try again later.');
    case 'validation':
      return e.message;
    default:
      return e.message.isNotEmpty
          ? e.message
          : tr(context, 'common.error', 'Something went wrong');
  }
}

/// Small in-card field caption.
/// Known-words reset. The word-map mastery set used to be cached in one
/// device-wide bucket, so an account could inherit marks left by a previous
/// account on the same phone; the cache is per-account now, but an account that
/// already absorbed someone else's marks needs a way to start over.
class _KnownWordsCard extends ConsumerStatefulWidget {
  const _KnownWordsCard();

  @override
  ConsumerState<_KnownWordsCard> createState() => _KnownWordsCardState();
}

class _KnownWordsCardState extends ConsumerState<_KnownWordsCard> {
  bool _busy = false;

  Future<void> _clear() async {
    final doneMsg = tr(context, 'settings.knownWords.done', 'Known words cleared');
    final failMsg = tr(context, 'settings.knownWords.failed',
        'Could not clear known words — try again');
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: Text(tr(dialogContext, 'settings.knownWords', 'Known words')),
        content: Text(tr(
          dialogContext,
          'settings.knownWords.confirm',
          'Clear every word marked as known? Your reviews, decks and streak '
              'are not affected.',
        )),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(dialogContext).pop(false),
            child: Text(tr(dialogContext, 'common.cancel', 'Cancel')),
          ),
          TextButton(
            onPressed: () => Navigator.of(dialogContext).pop(true),
            child: Text(tr(dialogContext, 'settings.knownWords.clear', 'Clear')),
          ),
        ],
      ),
    );
    if (confirmed != true || !mounted) return;
    setState(() => _busy = true);
    final ok = await ref.read(knownWordsProvider.notifier).clear();
    if (!mounted) return;
    setState(() => _busy = false);
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(ok ? doneMsg : failMsg)),
    );
  }

  @override
  Widget build(BuildContext context) {
    final count = ref.watch(knownWordsProvider).length;
    return InkCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            tr(
              context,
              'settings.knownWords.hint',
              'Words you marked as known in the HSK list and word map. They are '
                  'stored on your account and shared with the web app.',
            ),
            style: TextStyle(
              fontSize: 12.5,
              height: 1.35,
              color: text2Of(context),
            ),
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Text(
                '$count',
                style: monoStyle(
                  context,
                  size: 22,
                  weight: FontWeight.w700,
                  letterSpacing: 0,
                  color: accentOf(context),
                ),
              ),
              const Spacer(),
              PillButton(
                label: tr(context, 'settings.knownWords.clear', 'Clear'),
                size: PillSize.sm,
                variant: PillVariant.soft,
                onPressed: _busy || count == 0 ? null : _clear,
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _FieldLabel extends StatelessWidget {
  const _FieldLabel(this.text);

  final String text;

  @override
  Widget build(BuildContext context) {
    return Text(
      text,
      style: TextStyle(
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
                    style: TextStyle(
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
                      style: TextStyle(
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
                style: TextStyle(fontSize: 13, color: dangerColor),
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
