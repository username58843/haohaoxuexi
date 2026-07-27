import 'package:flutter/material.dart';
import 'package:webview_flutter/webview_flutter.dart';

/// Cloudflare Turnstile captcha widget.
///
/// Renders the Turnstile challenge in a compact WebView.
/// When the challenge completes, [onToken] fires with the verification token.
/// When the challenge expires or fails, [onExpired] / [onError] fire.
///
/// If [TURNSTILE_SITE_KEY] is not configured (dev mode), the widget is
/// hidden and [onToken] fires immediately with an empty string.
class CaptchaWidget extends StatefulWidget {
  const CaptchaWidget({
    super.key,
    required this.onToken,
    this.onExpired,
    this.onError,
  });

  final ValueChanged<String> onToken;
  final VoidCallback? onExpired;
  final VoidCallback? onError;

  @override
  State<CaptchaWidget> createState() => _CaptchaWidgetState();
}

class _CaptchaWidgetState extends State<CaptchaWidget> {
  late final WebViewController _controller;
  bool _finished = false;

  static const _siteKey = String.fromEnvironment(
    'TURNSTILE_SITE_KEY',
    defaultValue: '',
  );

  bool get _enabled => _siteKey.isNotEmpty;

  @override
  void initState() {
    super.initState();
    if (!_enabled) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        widget.onToken('');
      });
      return;
    }

    _controller = WebViewController()
      ..setJavaScriptMode(JavaScriptMode.unrestricted)
      ..addJavaScriptChannel('CaptchaToken', onMessage: (msg) {
        if (_finished) return;
        _finished = true;
        widget.onToken(msg.message as String);
      })
      ..addJavaScriptChannel('CaptchaExpired', onMessage: (_) {
        _finished = false;
        widget.onExpired?.call();
      })
      ..addJavaScriptChannel('CaptchaError', onMessage: (_) {
        _finished = false;
        widget.onError?.call();
      })
      ..loadHtmlString(_buildHtml());
  }

  String _buildHtml() => '''
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <script src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"></script>
  <style>
    body { margin: 0; padding: 0; background: transparent; display: flex; justify-content: center; align-items: center; min-height: 65px; }
    #cf-turnstile { transform: scale(0.85); transform-origin: center; }
  </style>
</head>
<body>
  <div class="cf-turnstile" id="cf-turnstile" data-sitekey="$_siteKey" data-action="turnstile-spin-v2"></div>
  <script>
    turnstile.render('#cf-turnstile', {
      sitekey: '$_siteKey',
      action: 'turnstile-spin-v2',
      theme: 'auto',
      callback: function(token) {
        CaptchaToken.postMessage(token);
      },
      'error-callback': function() {
        CaptchaError.postMessage('');
      },
      'expired-callback': function() {
        CaptchaExpired.postMessage('');
      },
      'timeout-callback': function() {
        CaptchaExpired.postMessage('');
      }
    });
  </script>
</body>
</html>
''';

  @override
  Widget build(BuildContext context) {
    if (!_enabled) return const SizedBox.shrink();

    return SizedBox(
      height: 65,
      child: ClipRect(
        child: WebViewWidget(controller: _controller),
      ),
    );
  }
}
