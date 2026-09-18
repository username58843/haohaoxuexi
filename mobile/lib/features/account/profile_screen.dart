import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/api.dart';
import '../../core/i18n.dart';
import '../../core/providers.dart';
import '../../core/theme.dart';
import '../../core/widgets.dart';

/// Profile: name edit, read-only email, password change, delete account.
class ProfileScreen extends ConsumerStatefulWidget {
  const ProfileScreen({super.key});

  @override
  ConsumerState<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends ConsumerState<ProfileScreen> {
  late final TextEditingController _name;
  final TextEditingController _current = TextEditingController();
  final TextEditingController _new = TextEditingController();
  final TextEditingController _repeat = TextEditingController();
  final GlobalKey<FormState> _passwordForm = GlobalKey<FormState>();

  bool _savingName = false;
  bool _changingPassword = false;
  bool _showCurrent = false;
  bool _showNew = false;
  bool _showRepeat = false;
  String? _nameError;

  @override
  void initState() {
    super.initState();
    _name = TextEditingController(
      text: ref.read(authProvider).value?.name ?? '',
    );
  }

  @override
  void dispose() {
    _name.dispose();
    _current.dispose();
    _new.dispose();
    _repeat.dispose();
    super.dispose();
  }

  Future<void> _saveName() async {
    final name = _name.text.trim();
    if (name.length < 2 || name.length > 40) {
      setState(() => _nameError =
          tr(context, 'profile.name.invalid', 'Name must be 2–40 characters'));
      return;
    }
    setState(() {
      _savingName = true;
      _nameError = null;
    });
    final messenger = ScaffoldMessenger.of(context);
    try {
      await ref.read(apiProvider).put('/user/profile', body: {'name': name});
      await ref.read(authProvider.notifier).refresh();
      if (!mounted) return;
      messenger.showSnackBar(
        SnackBar(content: Text(tr(context, 'profile.name.updated', 'Name updated'))),
      );
    } on ApiException catch (e) {
      if (!mounted) return;
      messenger.showSnackBar(SnackBar(content: Text(_apiErrorText(context, e))));
    } finally {
      if (mounted) setState(() => _savingName = false);
    }
  }

  Future<void> _changePassword() async {
    if (!(_passwordForm.currentState?.validate() ?? false)) return;
    setState(() => _changingPassword = true);
    final messenger = ScaffoldMessenger.of(context);
    try {
      final api = ref.read(apiProvider);
      final data = await api.put('/user/password', body: {
        'currentPassword': _current.text,
        'newPassword': _new.text,
      });
      // Password change bumps tokenVersion server-side and returns a fresh
      // token — store it so this session stays valid.
      final token = data['token']?.toString();
      if (token != null && token.isNotEmpty) await api.saveToken(token);
      if (!mounted) return;
      _current.clear();
      _new.clear();
      _repeat.clear();
      _passwordForm.currentState?.reset();
      messenger.showSnackBar(
        SnackBar(
          content:
              Text(tr(context, 'profile.password.changed', 'Password changed')),
        ),
      );
    } on ApiException catch (e) {
      if (!mounted) return;
      messenger.showSnackBar(SnackBar(content: Text(_apiErrorText(context, e))));
    } finally {
      if (mounted) setState(() => _changingPassword = false);
    }
  }

  Future<void> _confirmDelete() async {
    final messenger = ScaffoldMessenger.of(context);
    final doneMsg = tr(context, 'profile.delete.done', 'Account deleted');
    final deleted = await showDialog<bool>(
      context: context,
      barrierDismissible: false,
      builder: (_) => const _DeleteAccountDialog(),
    );
    if (deleted != true) return;
    messenger.showSnackBar(SnackBar(content: Text(doneMsg)));
    // The router redirect also kicks in on auth reset; this is a safety net.
    if (mounted) context.go('/auth');
  }

  InputDecoration _passwordDecoration({
    required String label,
    required bool visible,
    required VoidCallback onToggle,
  }) {
    return InputDecoration(
      labelText: label,
      suffixIcon: IconButton(
        onPressed: onToggle,
        icon: Icon(
          visible ? Icons.visibility_off_outlined : Icons.visibility_outlined,
          size: 20,
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    ref.watch(languageProvider);
    final user = ref.watch(authProvider).value;

    if (user == null) {
      // Signed out mid-flow (e.g. account deleted) — redirect is in flight.
      return Scaffold(
        appBar: AppBar(title: Text(tr(context, 'profile.title', 'Profile'))),
        body: const LoadingView(),
      );
    }

    final trimmedName = user.name.trim();
    final initial = trimmedName.isNotEmpty
        ? trimmedName.characters.first.toUpperCase()
        : '?';

    return Scaffold(
      appBar: AppBar(title: Text(tr(context, 'profile.title', 'Profile'))),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 40),
        children: [
          Column(
            children: [
              Container(
                width: 84,
                height: 84,
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: accentSoftOf(context),
                  border: Border.all(
                    color: accentOf(context).withValues(alpha: 0.4),
                  ),
                ),
                child: Text(
                  initial,
                  style: TextStyle(
                    fontSize: 34,
                    fontWeight: FontWeight.w800,
                    color: accentOf(context),
                  ),
                ),
              ),
              const SizedBox(height: 12),
              Text(
                user.email,
                style: TextStyle(
                  fontSize: 14,
                  color: text2Of(context),
                ),
              ),
              if (user.isAdmin || user.isPremium)
                Padding(
                  padding: const EdgeInsets.only(top: 10),
                  child: Wrap(
                    spacing: 8,
                    alignment: WrapAlignment.center,
                    children: [
                      if (user.isAdmin)
                        _Badge(tr(context, 'profile.badge.admin', 'Admin')),
                      if (user.isPremium)
                        _Badge(tr(context, 'profile.badge.premium', 'Premium')),
                    ],
                  ),
                ),
            ],
          ),
          const SizedBox(height: 24),
          SectionLabel(tr(context, 'profile.name', 'Name')),
          const SizedBox(height: 10),
          InkCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                TextField(
                  controller: _name,
                  maxLength: 40,
                  decoration: InputDecoration(
                    counterText: '',
                    hintText: tr(context, 'profile.name.hint', 'Your name'),
                    errorText: _nameError,
                  ),
                  onChanged: (_) {
                    if (_nameError != null) setState(() => _nameError = null);
                  },
                ),
                const SizedBox(height: 12),
                Align(
                  alignment: Alignment.centerRight,
                  child: PillButton(
                    label: tr(context, 'common.save', 'Save'),
                    size: PillSize.sm,
                    loading: _savingName,
                    onPressed: _savingName ? null : _saveName,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 24),
          SectionLabel(tr(context, 'profile.password', 'Change password')),
          const SizedBox(height: 10),
          InkCard(
            child: Form(
              key: _passwordForm,
              autovalidateMode: AutovalidateMode.onUserInteraction,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  TextFormField(
                    controller: _current,
                    obscureText: !_showCurrent,
                    autocorrect: false,
                    enableSuggestions: false,
                    decoration: _passwordDecoration(
                      label: tr(
                          context, 'profile.password.current', 'Current password'),
                      visible: _showCurrent,
                      onToggle: () =>
                          setState(() => _showCurrent = !_showCurrent),
                    ),
                    validator: (v) => (v == null || v.isEmpty)
                        ? tr(context, 'profile.password.required',
                            'Enter your current password')
                        : null,
                  ),
                  const SizedBox(height: 12),
                  TextFormField(
                    controller: _new,
                    obscureText: !_showNew,
                    autocorrect: false,
                    enableSuggestions: false,
                    decoration: _passwordDecoration(
                      label: tr(context, 'profile.password.new', 'New password'),
                      visible: _showNew,
                      onToggle: () => setState(() => _showNew = !_showNew),
                    ),
                    validator: (v) => (v == null || v.length < 8)
                        ? tr(context, 'profile.password.short',
                            'Password must be at least 8 characters')
                        : null,
                  ),
                  const SizedBox(height: 12),
                  TextFormField(
                    controller: _repeat,
                    obscureText: !_showRepeat,
                    autocorrect: false,
                    enableSuggestions: false,
                    decoration: _passwordDecoration(
                      label: tr(context, 'profile.password.repeat',
                          'Repeat new password'),
                      visible: _showRepeat,
                      onToggle: () =>
                          setState(() => _showRepeat = !_showRepeat),
                    ),
                    validator: (v) => (v != _new.text)
                        ? tr(context, 'profile.password.mismatch',
                            'Passwords do not match')
                        : null,
                  ),
                  const SizedBox(height: 16),
                  Align(
                    alignment: Alignment.centerRight,
                    child: PillButton(
                      label:
                          tr(context, 'profile.password', 'Change password'),
                      size: PillSize.sm,
                      loading: _changingPassword,
                      onPressed: _changingPassword ? null : _changePassword,
                    ),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 28),
          Text(
            tr(context, 'profile.danger', 'Danger zone').toUpperCase(),
            style: monoStyle(context, color: dangerColor),
          ),
          const SizedBox(height: 10),
          InkCard(
            borderColor: dangerColor.withValues(alpha: 0.35),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  tr(
                      context,
                      'profile.delete.text',
                      'Deletes your account, decks and learning progress on '
                          'all devices. This cannot be undone.'),
                  style: TextStyle(
                    fontSize: 13.5,
                    height: 1.5,
                    color: text2Of(context),
                  ),
                ),
                const SizedBox(height: 14),
                PillButton(
                  label: tr(context, 'profile.delete', 'Delete account'),
                  variant: PillVariant.danger,
                  size: PillSize.sm,
                  icon: Icons.delete_outline,
                  onPressed: _confirmDelete,
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

String _apiErrorText(BuildContext context, ApiException e) {
  switch (e.code) {
    case 'network':
      return tr(context, 'error.network', 'Network error. Check your connection.');
    case 'rate_limited':
      return tr(
          context, 'error.rateLimited', 'Too many requests. Try again later.');
    case 'invalid_credentials':
    // DELETE /account rejects a wrong password with 403 `forbidden`
    // (PUT /user/password uses `invalid_credentials`) — same user-facing
    // meaning on this screen, so both get the localized message.
    case 'forbidden':
      return tr(context, 'error.wrongPassword', 'Incorrect password');
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

/// Small accent pill badge (role / premium).
class _Badge extends StatelessWidget {
  const _Badge(this.text);

  final String text;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: accentSoftOf(context),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(
        text,
        style: TextStyle(
          fontSize: 11.5,
          fontWeight: FontWeight.w700,
          color: accentOf(context),
        ),
      ),
    );
  }
}

/// Typed-confirmation dialog: password + literal "DELETE" →
/// `authProvider.deleteAccount`. Pops `true` on success.
class _DeleteAccountDialog extends ConsumerStatefulWidget {
  const _DeleteAccountDialog();

  @override
  ConsumerState<_DeleteAccountDialog> createState() =>
      _DeleteAccountDialogState();
}

class _DeleteAccountDialogState extends ConsumerState<_DeleteAccountDialog> {
  final TextEditingController _password = TextEditingController();
  final TextEditingController _confirm = TextEditingController();
  bool _busy = false;
  bool _showPassword = false;
  String? _error;

  bool get _armed =>
      _confirm.text.trim() == 'DELETE' && _password.text.isNotEmpty;

  @override
  void dispose() {
    _password.dispose();
    _confirm.dispose();
    super.dispose();
  }

  Future<void> _delete() async {
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await ref.read(authProvider.notifier).deleteAccount(_password.text);
      if (mounted) Navigator.of(context).pop(true);
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() {
        _busy = false;
        _error = _apiErrorText(context, e);
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: Text(tr(context, 'profile.delete', 'Delete account')),
      scrollable: true,
      content: SizedBox(
        width: 360,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              tr(
                  context,
                  'profile.delete.text',
                  'Deletes your account, decks and learning progress on '
                      'all devices. This cannot be undone.'),
              style: TextStyle(
                fontSize: 13.5,
                height: 1.5,
                color: text2Of(context),
              ),
            ),
            const SizedBox(height: 16),
            TextField(
              controller: _password,
              enabled: !_busy,
              obscureText: !_showPassword,
              autocorrect: false,
              enableSuggestions: false,
              decoration: InputDecoration(
                labelText:
                    tr(context, 'profile.delete.password', 'Your password'),
                suffixIcon: IconButton(
                  onPressed: () =>
                      setState(() => _showPassword = !_showPassword),
                  icon: Icon(
                    _showPassword
                        ? Icons.visibility_off_outlined
                        : Icons.visibility_outlined,
                    size: 20,
                  ),
                ),
              ),
              onChanged: (_) => setState(() {}),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _confirm,
              enabled: !_busy,
              autocorrect: false,
              enableSuggestions: false,
              textCapitalization: TextCapitalization.characters,
              decoration: InputDecoration(
                labelText: tr(context, 'profile.delete.confirmHint',
                    'Type DELETE to confirm'),
                hintText: 'DELETE',
              ),
              onChanged: (_) => setState(() {}),
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
          onPressed: _busy ? null : () => Navigator.of(context).pop(false),
          child: Text(tr(context, 'common.cancel', 'Cancel')),
        ),
        PillButton(
          label: tr(context, 'profile.delete', 'Delete account'),
          variant: PillVariant.danger,
          size: PillSize.sm,
          loading: _busy,
          onPressed: _armed && !_busy ? _delete : null,
        ),
      ],
    );
  }
}
