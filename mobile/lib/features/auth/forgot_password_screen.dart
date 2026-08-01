import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';

import '../../core/api.dart';
import '../../core/captcha.dart';
import '../../core/i18n.dart';
import '../../core/providers.dart';
import '../../core/theme.dart';
import '../../core/widgets.dart';

class ForgotPasswordScreen extends ConsumerStatefulWidget {
  const ForgotPasswordScreen({super.key});

  @override
  ConsumerState<ForgotPasswordScreen> createState() =>
      _ForgotPasswordScreenState();
}

class _ForgotPasswordScreenState extends ConsumerState<ForgotPasswordScreen> {
  final _emailController = TextEditingController();
  bool _sent = false;
  bool _loading = false;
  String? _error;
  String _captchaToken = '';
  int _captchaAttempt = 0;

  void _resetCaptcha() {
    _captchaToken = '';
    _captchaAttempt++;
  }

  @override
  void dispose() {
    _emailController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final email = _emailController.text.trim();
    if (email.isEmpty) return;
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      await ref.read(apiProvider).post(
        '/auth/forgot-password',
        body: {'email': email, 'captchaToken': _captchaToken},
      );
      if (mounted) setState(() => _sent = true);
    } on ApiException catch (e) {
      _resetCaptcha();
      if (mounted) {
        setState(() => _error = e.message.isNotEmpty
            ? e.message
            : tr(context, 'common.error', 'Something went wrong'));
      }
    } catch (_) {
      _resetCaptcha();
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
                const HanziText('好好学习汉语',
                    size: 32, weight: FontWeight.w700),
                const SizedBox(height: 24),
                InkCard(
                  padding: const EdgeInsets.all(20),
                  child: _sent
                      ? Column(
                          children: [
                            Icon(Icons.mark_email_read_outlined,
                                size: 48, color: accent),
                            const SizedBox(height: 16),
                            Text(
                              tr(context, 'auth.forgot.sent',
                                  'If an account exists, a reset link has been sent. Check your inbox.'),
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
                              tr(context, 'auth.forgot.title',
                                  'Forgot password?'),
                              style: GoogleFonts.manrope(
                                fontSize: 20,
                                fontWeight: FontWeight.w700,
                              ),
                              textAlign: TextAlign.center,
                            ),
                            const SizedBox(height: 8),
                            Text(
                              tr(context, 'auth.forgot.hint',
                                  "Enter your email and we'll send a reset link."),
                              textAlign: TextAlign.center,
                              style: GoogleFonts.manrope(
                                  fontSize: 14, color: text2Of(context)),
                            ),
                            const SizedBox(height: 20),
                            TextFormField(
                              controller: _emailController,
                              keyboardType: TextInputType.emailAddress,
                              textInputAction: TextInputAction.done,
                              onFieldSubmitted: (_) => _submit(),
                              decoration: InputDecoration(
                                labelText: tr(context, 'auth.email', 'Email'),
                              ),
                            ),
                            const SizedBox(height: 12),
                            CaptchaWidget(
                              key: ValueKey(_captchaAttempt),
                              onToken: (t) => _captchaToken = t,
                              onExpired: () =>
                                  setState(() => _captchaToken = ''),
                            ),
                            if (_error != null) ...[
                              const SizedBox(height: 8),
                              Text(_error!,
                                  style: GoogleFonts.manrope(
                                      fontSize: 13, color: dangerColor)),
                            ],
                            const SizedBox(height: 12),
                            PillButton(
                              label: tr(context, 'auth.forgot.submit',
                                  'Send reset link'),
                              size: PillSize.lg,
                              expanded: true,
                              loading: _loading,
                              onPressed: _loading ? null : _submit,
                            ),
                            const SizedBox(height: 12),
                            Center(
                              child: GestureDetector(
                                onTap: () => context.go('/auth'),
                                child: Text(
                                  tr(context, 'auth.submitLogin', 'Sign in'),
                                  style: GoogleFonts.manrope(
                                      fontSize: 14, color: accent),
                                ),
                              ),
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
