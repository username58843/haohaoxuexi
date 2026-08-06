import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';

import '../../core/api.dart';
import '../../core/i18n.dart';
import '../../core/theme.dart';
import '../../core/widgets.dart';

class ResetPasswordScreen extends ConsumerStatefulWidget {
  const ResetPasswordScreen({super.key, required this.token});

  final String token;

  @override
  ConsumerState<ResetPasswordScreen> createState() =>
      _ResetPasswordScreenState();
}

class _ResetPasswordScreenState extends ConsumerState<ResetPasswordScreen> {
  final _passwordController = TextEditingController();
  final _confirmController = TextEditingController();
  bool _done = false;
  bool _loading = false;
  String? _error;
  bool _obscure1 = true;
  bool _obscure2 = true;

  @override
  void dispose() {
    _passwordController.dispose();
    _confirmController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final password = _passwordController.text;
    final confirm = _confirmController.text;
    if (password.length < 8) {
      setState(() => _error =
          tr(context, 'auth.v.passwordShort', 'Password must be at least 8 characters'));
      return;
    }
    if (password != confirm) {
      setState(() => _error =
          tr(context, 'auth.reset.noMatch', 'Passwords do not match'));
      return;
    }
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      await ref.read(apiProvider).post(
        '/auth/reset-password',
        body: {'token': widget.token, 'password': password},
      );
      if (mounted) setState(() => _done = true);
    } on ApiException catch (e) {
      if (mounted) {
        setState(() => _error = e.message.isNotEmpty
            ? e.message
            : tr(context, 'auth.reset.invalid', 'Invalid or expired link'));
      }
    } catch (_) {
      if (mounted) {
        setState(() =>
            _error = tr(context, 'error.network', 'Network error'));
      }
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    ref.watch(languageProvider);
    final accent = accentOf(context);

    return Scaffold(
      appBar: AppBar(
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new, size: 20),
          onPressed: () => context.go('/auth'),
        ),
      ),
      body: Center(
        child: SingleChildScrollView(
          padding: const EdgeInsets.fromLTRB(20, 28, 20, 28),
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 420),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text('haohaoxuexi.tech', style: monoStyle(context)),
                const SizedBox(height: 10),
                // Default weight (w600): NotoSerifSC is bundled only in its
                // SemiBold cut — see the fonts note in pubspec.yaml.
                const HanziText('好好学习汉语', size: 32),
                const SizedBox(height: 24),
                InkCard(
                  padding: const EdgeInsets.all(20),
                  child: _done
                      ? Column(
                          children: [
                            Icon(Icons.check_circle_outline,
                                size: 48, color: accent),
                            const SizedBox(height: 16),
                            Text(
                              tr(context, 'auth.reset.done',
                                  'Your password has been reset. Sign in with your new password.'),
                              textAlign: TextAlign.center,
                              style: GoogleFonts.manrope(
                                  fontSize: 14, color: text2Of(context)),
                            ),
                            const SizedBox(height: 20),
                            PillButton(
                              label: tr(
                                  context, 'auth.submitLogin', 'Sign in'),
                              expanded: true,
                              onPressed: () => context.go('/auth'),
                            ),
                          ],
                        )
                      : Column(
                          crossAxisAlignment: CrossAxisAlignment.stretch,
                          children: [
                            Text(
                              tr(context, 'auth.reset.title',
                                  'New password'),
                              style: GoogleFonts.manrope(
                                fontSize: 20,
                                fontWeight: FontWeight.w700,
                              ),
                              textAlign: TextAlign.center,
                            ),
                            const SizedBox(height: 20),
                            TextFormField(
                              controller: _passwordController,
                              obscureText: _obscure1,
                              textInputAction: TextInputAction.next,
                              decoration: InputDecoration(
                                labelText: tr(context, 'auth.reset.password',
                                    'New password'),
                                suffixIcon: IconButton(
                                  onPressed: () => setState(
                                      () => _obscure1 = !_obscure1),
                                  icon: Icon(
                                    _obscure1
                                        ? Icons.visibility_outlined
                                        : Icons.visibility_off_outlined,
                                    size: 20,
                                    color: text2Of(context),
                                  ),
                                ),
                              ),
                            ),
                            const SizedBox(height: 14),
                            TextFormField(
                              controller: _confirmController,
                              obscureText: _obscure2,
                              textInputAction: TextInputAction.done,
                              onFieldSubmitted: (_) => _submit(),
                              decoration: InputDecoration(
                                labelText: tr(context, 'auth.reset.confirm',
                                    'Confirm password'),
                                suffixIcon: IconButton(
                                  onPressed: () => setState(
                                      () => _obscure2 = !_obscure2),
                                  icon: Icon(
                                    _obscure2
                                        ? Icons.visibility_outlined
                                        : Icons.visibility_off_outlined,
                                    size: 20,
                                    color: text2Of(context),
                                  ),
                                ),
                              ),
                            ),
                            if (_error != null) ...[
                              const SizedBox(height: 8),
                              Text(_error!,
                                  style: GoogleFonts.manrope(
                                      fontSize: 13, color: dangerColor)),
                            ],
                            const SizedBox(height: 12),
                            PillButton(
                              label: tr(context, 'auth.reset.submit',
                                  'Reset password'),
                              size: PillSize.lg,
                              expanded: true,
                              loading: _loading,
                              onPressed: _loading ? null : _submit,
                            ),
                          ],
                        ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
