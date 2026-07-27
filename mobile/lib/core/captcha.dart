import 'package:flutter/material.dart';
import 'package:webview_flutter/webview_flutter.dart';

/// Cloudflare Turnstile captcha widget.
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
  WebViewController? _controller;
  bool _finished = false;
  bool _loaded = false;
  String? _loadError;

  // Public sitekey — safe to embed in client code.
  static const _siteKey = '0x4AAAAAAD_HQtdS_M_AM8T2';

  @override
  void initState() {
    super.initState();
    _initWebView();
  }

  void _initWebView() {
    _controller = WebViewController()
      ..setJavaScriptMode(JavaScriptMode.unrestricted)
      ..setNavigationDelegate(NavigationDelegate(
        onPageFinished: (_) {
          if (mounted) setState(() => _loaded = true);
        },
        onWebResourceError: (err) {
          if (mounted) {
            setState(() => _loadError = 'WebView error: ${err.description}');
          }
          widget.onError?.call();
        },
      ))
      ..addJavaScriptChannel(
        'CaptchaToken',
        onMessageReceived: (msg) {
          if (_finished) return;
          _finished = true;
          widget.onToken(msg.message);
        },
      )
      ..addJavaScriptChannel(
        'CaptchaExpired',
        onMessageReceived: (_) {
          _finished = false;
          widget.onExpired?.call();
        },
      )
      ..addJavaScriptChannel(
        'CaptchaError',
        onMessageReceived: (_) {
          _finished = false;
          widget.onError?.call();
        },
      )
      ..loadHtmlString(_buildHtml());
  }

  String _buildHtml() => '''
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <script src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"></script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { background: transparent; display: flex; justify-content: center; align-items: center; min-height: 65px; overflow: hidden; }
    #cf-turnstile { transform: scale(0.90); transform-origin: center; }
  </style>
</head>
<body>
  <div id="cf-turnstile"></div>
  <script>
    try {
      turnstile.render('#cf-turnstile', {
        sitekey: '$_siteKey',
        action: 'turnstile-spin-v2',
        theme: 'auto',
        'retry': 'auto',
        'retry-interval': 2000,
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
    } catch(e) {
      CaptchaError.postMessage('');
    }
  </script>
</body>
</html>
''';

  @override
  Widget build(BuildContext context) {
    if (_loadError != null) {
      return Container(
        padding: const EdgeInsets.all(8),
        child: Text(
          _loadError!,
          style: const TextStyle(fontSize: 11, color: Colors.orange),
        ),
      );
    }

    return SizedBox(
      height: 65,
      child: _controller == null
          ? const SizedBox.shrink()
          : ClipRect(
              child: WebViewWidget(controller: _controller!),
            ),
    );
  }
}
