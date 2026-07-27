import 'package:flutter/gestures.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/api.dart';
import '../../core/captcha.dart';
import '../../core/i18n.dart';
import '../../core/providers.dart';
import '../../core/theme.dart';
import '../../core/widgets.dart';

/// Login / Register screen: segmented mode switch, validated fields,
/// server-error mapping (invalid_credentials, email_taken, rate_limited,
/// banned with reason, network) and legal links.
class AuthScreen extends ConsumerStatefulWidget {
  const AuthScreen({super.key});

  @override
  ConsumerState<AuthScreen> createState() => _AuthScreenState();
}

class _AuthScreenState extends ConsumerState<AuthScreen> {
  final _formKey = GlobalKey<FormState>();
  final _nameController = TextEditingController();
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();

  bool _isLogin = true;
  bool _obscurePassword = true;
  bool _submitting = false;
  bool _submitted = false;
  String _captchaToken = '';

  /// Mapped, human-readable error for the banner; null = no error.
  String? _errorText;

  /// Set when the server answered `banned` — renders a distinct notice.
  bool _isBanned = false;

  static final RegExp _emailRe = RegExp(r'^[^\s@]+@[^\s@]+\.[^\s@]+$');

  @override
  void dispose() {
    _nameController.dispose();
    _emailController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  void _switchMode(bool login) {
    if (_submitting || login == _isLogin) return;
    setState(() {
      _isLogin = login;
      _errorText = null;
      _isBanned = false;
      _submitted = false;
    });
  }

  Future<void> _submit() async {
    setState(() => _submitted = true);
    if (!(_formKey.currentState?.validate() ?? false)) return;
    FocusScope.of(context).unfocus();
    setState(() {
      _submitting = true;
      _errorText = null;
      _isBanned = false;
    });

    final auth = ref.read(authProvider.notifier);
    try {
      if (_isLogin) {
        await auth.login(_emailController.text, _passwordController.text,
            captchaToken: _captchaToken);
      } else {
        await auth.register(
          _nameController.text,
          _emailController.text,
          _passwordController.text,
          captchaToken: _captchaToken,
        );
      }
      if (!mounted) return;
      context.go('/');
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() {
        _isBanned = e.code == 'banned';
        _errorText = _describe(e);
      });
    } catch (_) {
      // Unexpected failure (malformed response...) — show a generic error.
      if (!mounted) return;
      setState(
          () => _errorText = tr(context, 'common.error', 'Something went wrong'));
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  String _describe(ApiException e) {
    switch (e.code) {
      case 'invalid_credentials':
        return tr(context, 'auth.err.invalidCredentials',
            'Wrong email or password.');
      case 'email_taken':
      case 'conflict':
        return tr(context, 'auth.err.emailTaken',
            'An account with this email already exists.');
      case 'rate_limited':
        return tr(context, 'auth.err.rateLimited',
            'Too many attempts. Please wait a bit and try again.');
      case 'banned':
        // Server message carries the ban details when available.
        return e.message.isNotEmpty && e.message.toLowerCase() != 'banned'
            ? e.message
            : tr(context, 'auth.err.banned', 'This account is suspended.');
      case 'network':
        return tr(context, 'error.network',
            'Network error. Check your connection.');
      case 'validation':
        return e.message.isNotEmpty
            ? e.message
            : tr(context, 'common.error', 'Something went wrong');
      default:
        return tr(context, 'error.server',
            'Server error. Please try again later.');
    }
  }

  String? _validateName(String? value) {
    final name = (value ?? '').trim();
    if (name.length < 2 || name.length > 40) {
      return tr(context, 'auth.v.name', 'Name must be 2–40 characters');
    }
    return null;
  }

  String? _validateEmail(String? value) {
    final email = (value ?? '').trim();
    if (!_emailRe.hasMatch(email)) {
      return tr(context, 'auth.v.email', 'Enter a valid email address');
    }
    return null;
  }

  String? _validatePassword(String? value) {
    final password = value ?? '';
    if (password.isEmpty) {
      return tr(context, 'auth.v.passwordRequired', 'Enter your password');
    }
    if (!_isLogin && password.length < 8) {
      return tr(context, 'auth.v.passwordShort',
          'Password must be at least 8 characters');
    }
    return null;
  }

  @override
  Widget build(BuildContext context) {
    ref.watch(languageProvider);

    return Scaffold(
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.fromLTRB(20, 28, 20, 28),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 420),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text('haohaoxuexi.tech', style: monoStyle(context)),
                  const SizedBox(height: 10),
                  const HanziText('好好学习汉语', size: 32, weight: FontWeight.w700),
                  const SizedBox(height: 24),
                  InkCard(
                    padding: const EdgeInsets.all(20),
                    child: Form(
                      key: _formKey,
                      autovalidateMode: _submitted
                          ? AutovalidateMode.onUserInteraction
                          : AutovalidateMode.disabled,
                      child: AutofillGroup(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.stretch,
                          children: [
                            _SegmentedModeSwitch(
                              isLogin: _isLogin,
                              enabled: !_submitting,
                              onChanged: _switchMode,
                            ),
                            const SizedBox(height: 20),
                            if (_errorText != null) ...[
                              _ErrorBanner(
                                message: _errorText!,
                                title: _isBanned
                                    ? tr(context, 'auth.err.banned',
                                        'This account is suspended.')
                                    : null,
                              ),
                              const SizedBox(height: 14),
                            ],
                            AnimatedSize(
                              duration: const Duration(milliseconds: 220),
                              curve: Curves.easeOut,
                              alignment: Alignment.topCenter,
                              child: _isLogin
                                  ? const SizedBox.shrink()
                                  : Padding(
                                      padding:
                                          const EdgeInsets.only(bottom: 14),
                                      child: TextFormField(
                                        controller: _nameController,
                                        enabled: !_submitting,
                                        textInputAction: TextInputAction.next,
                                        textCapitalization:
                                            TextCapitalization.words,
                                        autofillHints: const [
                                          AutofillHints.name
                                        ],
                                        decoration: InputDecoration(
                                          labelText:
                                              tr(context, 'auth.name', 'Name'),
                                        ),
                                        validator: _validateName,
                                      ),
                                    ),
                            ),
                            TextFormField(
                              controller: _emailController,
                              enabled: !_submitting,
                              keyboardType: TextInputType.emailAddress,
                              textInputAction: TextInputAction.next,
                              autofillHints: const [AutofillHints.email],
                              decoration: InputDecoration(
                                labelText: tr(context, 'auth.email', 'Email'),
                              ),
                              validator: _validateEmail,
                            ),
                            const SizedBox(height: 14),
                            TextFormField(
                              controller: _passwordController,
                              enabled: !_submitting,
                              obscureText: _obscurePassword,
                              textInputAction: TextInputAction.done,
                              autofillHints: [
                                _isLogin
                                    ? AutofillHints.password
                                    : AutofillHints.newPassword,
                              ],
                              onFieldSubmitted: (_) => _submit(),
                              decoration: InputDecoration(
                                labelText:
                                    tr(context, 'auth.password', 'Password'),
                                suffixIcon: IconButton(
                                  onPressed: () => setState(() =>
                                      _obscurePassword = !_obscurePassword),
                                  icon: Icon(
                                    _obscurePassword
                                        ? Icons.visibility_outlined
                                        : Icons.visibility_off_outlined,
                                    size: 20,
                                    color: text2Of(context),
                                  ),
                                ),
                              ),
                              validator: _validatePassword,
                            ),
                            const SizedBox(height: 16),
                            CaptchaWidget(
                              key: ValueKey(_isLogin),
                              onToken: (t) => _captchaToken = t,
                              onExpired: () => setState(() => _captchaToken = ''),
                              onError: () => setState(() => _captchaToken = ''),
                            ),
                            const SizedBox(height: 16),
                            PillButton(
                              label: _isLogin
                                  ? tr(context, 'auth.submitLogin', 'Log in')
                                  : tr(context, 'auth.submitRegister',
                                      'Create account'),
                              size: PillSize.lg,
                              expanded: true,
                              loading: _submitting,
                              onPressed: _submitting ? null : _submit,
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(height: 20),
                  _LegalLinks(
                    termsUrl: '$apiBaseUrl/terms',
                    privacyUrl: '$apiBaseUrl/privacy',
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

/// Pill segmented control with an accent active block (design: Segmented).
class _SegmentedModeSwitch extends StatelessWidget {
  const _SegmentedModeSwitch({
    required this.isLogin,
    required this.enabled,
    required this.onChanged,
  });

  final bool isLogin;
  final bool enabled;
  final ValueChanged<bool> onChanged;

  @override
  Widget build(BuildContext context) {
    final accent = accentOf(context);

    Widget segment({required bool login, required String label}) {
      final selected = login == isLogin;
      return Expanded(
        child: GestureDetector(
          behavior: HitTestBehavior.opaque,
          onTap: enabled ? () => onChanged(login) : null,
          child: AnimatedContainer(
            duration: const Duration(milliseconds: 180),
            curve: Curves.easeOut,
            padding: const EdgeInsets.symmetric(vertical: 10),
            decoration: BoxDecoration(
              color: selected ? accent : Colors.transparent,
              borderRadius: BorderRadius.circular(999),
            ),
            child: Center(
              child: Text(
                label,
                style: GoogleFonts.manrope(
                  fontSize: 14,
                  fontWeight: FontWeight.w700,
                  color: selected ? onAccent(accent) : text2Of(context),
                ),
              ),
            ),
          ),
        ),
      );
    }

    return Container(
      padding: const EdgeInsets.all(4),
      decoration: BoxDecoration(
        color: surfaceOf(context),
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: hairlineOf(context)),
      ),
      child: Row(
        children: [
          segment(
            login: true,
            label: tr(context, 'auth.loginTab', 'Log in'),
          ),
          segment(
            login: false,
            label: tr(context, 'auth.registerTab', 'Sign up'),
          ),
        ],
      ),
    );
  }
}

/// Danger-wash banner for auth errors; optional bold [title] (ban notice).
class _LegalLinks extends ConsumerWidget {
  const _LegalLinks({required this.termsUrl, required this.privacyUrl});

  final String termsUrl;
  final String privacyUrl;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    ref.watch(languageProvider);
    final accent = accentOf(context);
    final textStyle = GoogleFonts.manrope(
      fontSize: 12.5,
      height: 1.45,
      color: text3Of(context),
    );

    final legalText = tr(context, 'auth.legal',
        'By continuing you agree to our {terms} and {privacy}:');
    final termsLabel =
        tr(context, 'auth.legal.terms', 'Terms of Service');
    final privacyLabel =
        tr(context, 'auth.legal.privacy', 'Privacy Policy');

    final linkStyle = GoogleFonts.manrope(
      fontSize: 12.5,
      height: 1.45,
      color: accent,
      decoration: TextDecoration.underline,
    );

    final parts = legalText.split(RegExp(r'\{terms\}|\{privacy\}'));

    return RichText(
      textAlign: TextAlign.center,
      text: TextSpan(
        style: textStyle,
        children: [
          if (parts.isNotEmpty) TextSpan(text: parts[0]),
          TextSpan(
            text: termsLabel,
            style: linkStyle,
            recognizer: TapGestureRecognizer()
              ..onTap = () => launchUrl(
                    Uri.parse(termsUrl),
                    mode: LaunchMode.externalApplication,
                  ),
          ),
          if (parts.length > 1) ...[
            TextSpan(text: parts[1]),
            TextSpan(
              text: privacyLabel,
              style: linkStyle,
              recognizer: TapGestureRecognizer()
                ..onTap = () => launchUrl(
                      Uri.parse(privacyUrl),
                      mode: LaunchMode.externalApplication,
                    ),
            ),
          ],
          if (parts.length > 2) TextSpan(text: parts[2]),
        ],
      ),
    );
  }
}

/// Danger-wash banner for auth errors; optional bold [title] (ban notice).
class _ErrorBanner extends StatelessWidget {
  const _ErrorBanner({required this.message, this.title});

  final String message;
  final String? title;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(
        color: dangerColor.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: dangerColor.withValues(alpha: 0.35)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Padding(
            padding: EdgeInsets.only(top: 1),
            child: Icon(Icons.error_outline, size: 18, color: dangerColor),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                if (title != null) ...[
                  Text(
                    title!,
                    style: GoogleFonts.manrope(
                      fontSize: 13.5,
                      fontWeight: FontWeight.w700,
                      color: dangerColor,
                    ),
                  ),
                  if (message != title) const SizedBox(height: 3),
                ],
                if (title == null || message != title)
                  Text(
                    message,
                    style: GoogleFonts.manrope(
                      fontSize: 13.5,
                      height: 1.4,
                      color: dangerColor,
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
