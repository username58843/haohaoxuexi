import 'package:flutter/material.dart';
import 'package:flutter_inappwebview/flutter_inappwebview.dart';

/// Cloudflare Turnstile captcha widget.
///
/// Minimal implementation — Turnstile handles its own retry/expiration.
/// [onToken] fires with the verified token.
/// [onExpired] fires when the token expires (parent should clear token state).
class CaptchaWidget extends StatefulWidget {
  const CaptchaWidget({
    super.key,
    required this.onToken,
    this.onExpired,
  });

  final ValueChanged<String> onToken;
  final VoidCallback? onExpired;

  @override
  State<CaptchaWidget> createState() => _CaptchaWidgetState();
}

class _CaptchaWidgetState extends State<CaptchaWidget> {
  InAppWebViewController? _webViewController;
  bool _tokenSent = false;

  static const _siteKey = '0x4AAAAAAD_HQtdS_M_AM8T2';

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 80,
      child: InAppWebView(
        initialSettings: InAppWebViewSettings(
          javaScriptEnabled: true,
          domStorageEnabled: true,
          transparentBackground: true,
          supportZoom: false,
          builtInZoomControls: false,
          displayZoomControls: false,
          useWideViewPort: false,
          loadWithOverviewMode: false,
          verticalScrollBarEnabled: false,
          horizontalScrollBarEnabled: false,
          overScrollMode: OverScrollMode.NEVER,
          userAgent:
              'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 '
              '(KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36',
          mixedContentMode: MixedContentMode.MIXED_CONTENT_ALWAYS_ALLOW,
          thirdPartyCookiesEnabled: true,
        ),
        initialUrlRequest: URLRequest(
          url: WebUri(
            'data:text/html;charset=utf-8,${Uri.encodeComponent(_html())}',
          ),
        ),
        onWebViewCreated: (controller) {
          _webViewController = controller;

          controller.addJavaScriptHandler(
            handlerName: 'CaptchaToken',
            callback: (args) {
              if (_tokenSent || !mounted) return;
              _tokenSent = true;
              widget.onToken(args.first.toString());
            },
          );

          controller.addJavaScriptHandler(
            handlerName: 'CaptchaExpired',
            callback: (_) {
              _tokenSent = false;
              if (mounted) widget.onExpired?.call();
            },
          );
        },
      ),
    );
  }

  String _html() => '''
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  html,body{width:100%;height:100%;background:transparent;overflow:hidden}
  body{display:flex;justify-content:center;align-items:center}
</style>
</head>
<body>
<div id="cf-turnstile"></div>
<script>
  window.addEventListener('message', function(e) {
    try {
      var d = e.data;
      if (d && d.source === 'turnstile') {
        if (d.type === 'token') {
          window.CaptchaToken.postMessage(d.token);
        } else if (d.type === 'expired') {
          window.CaptchaExpired.postMessage('');
        }
      }
    } catch(ex) {}
  });

  function onReady() {
    if (typeof turnstile === 'undefined') return;
    turnstile.render('#cf-turnstile', {
      sitekey: '$_siteKey',
      action: 'mobile-app',
      theme: 'auto',
      retry: 'auto',
      'retry-interval': 3000,
      'refresh-expired': 'auto',
      callback: function(token) {
        window.CaptchaToken.postMessage(token);
      },
      'expired-callback': function() {
        window.CaptchaExpired.postMessage('');
      }
    });
  }

  if (document.readyState === 'complete') {
    onReady();
  } else {
    window.addEventListener('load', onReady);
  }
</script>
</body>
</html>
''';
}
