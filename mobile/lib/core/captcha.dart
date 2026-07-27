import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_inappwebview/flutter_inappwebview.dart';

/// Cloudflare Turnstile captcha widget.
///
/// Uses [InAppWebView] for maximum Android compatibility.
/// Retries once if the Turnstile script fails to load.
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
  InAppWebViewController? _webViewController;
  bool _tokenReceived = false;
  bool _loadFailed = false;
  bool _retrying = false;
  Timer? _timeoutTimer;

  static const _siteKey = '0x4AAAAAAD_HQtdS_M_AM8T2';
  static const _timeoutSeconds = 12;

  @override
  void initState() {
    super.initState();
    _startTimeout();
  }

  void _startTimeout() {
    _timeoutTimer?.cancel();
    _timeoutTimer = Timer(const Duration(seconds: _timeoutSeconds), () {
      if (mounted && !_tokenReceived) {
        if (!_retrying) {
          _retry();
        } else {
          setState(() => _loadFailed = true);
          widget.onError?.call();
        }
      }
    });
  }

  void _retry() {
    if (!mounted) return;
    _retrying = true;
    setState(() {
      _loadFailed = false;
      _tokenReceived = false;
    });
    _webViewController?.loadUrl(
      urlRequest: URLRequest(url: WebUri('data:text/html;charset=utf-8,${Uri.encodeComponent(_buildHtml())}')),
    );
    _startTimeout();
  }

  @override
  void dispose() {
    _timeoutTimer?.cancel();
    super.dispose();
  }

  String _buildHtml() => '''
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
  <script src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit&onload=onTurnstileReady"></script>
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    html,body{width:100%;height:100%;background:transparent;overflow:hidden}
    body{display:flex;justify-content:center;align-items:center}
    #cf-turnstile{transform:scale(0.92);transform-origin:center}
    #fallback{display:none;color:#999;font-size:12px;text-align:center;padding:8px;font-family:sans-serif}
    #error-msg{display:none;color:#e53935;font-size:11px;text-align:center;padding:4px;font-family:sans-serif}
  </style>
</head>
<body>
  <div id="cf-turnstile"></div>
  <div id="fallback">Loading captcha…</div>
  <div id="error-msg"></div>
  <script>
    var _tokenSent = false;
    function _post(msg, data) {
      try {
        if (window[msg]) { window[msg](data || ''); return; }
      } catch(e) {}
      try { window.flutter_inappwebview.callHandler(msg, data || ''); } catch(e) {}
    }

    function onTurnstileReady() {
      try {
        turnstile.render('#cf-turnstile', {
          sitekey: '$_siteKey',
          action: 'mobile-app',
          theme: 'auto',
          retry: 'auto',
          'retry-interval': 3000,
          'refresh-expired': 'auto',
          callback: function(token) {
            if (_tokenSent) return;
            _tokenSent = true;
            document.getElementById('fallback').style.display = 'none';
            document.getElementById('error-msg').style.display = 'none';
            _post('CaptchaToken', token);
          },
          'error-callback': function(err) {
            var el = document.getElementById('error-msg');
            el.textContent = 'Captcha error: ' + (err || 'unknown');
            el.style.display = 'block';
            document.getElementById('fallback').style.display = 'none';
            _post('CaptchaError');
          },
          'expired-callback': function() {
            _tokenSent = false;
            _post('CaptchaExpired');
          },
          'timeout-callback': function() {
            _tokenSent = false;
            _post('CaptchaExpired');
          }
        });
      } catch(e) {
        document.getElementById('error-msg').textContent = 'Render failed: ' + e;
        document.getElementById('error-msg').style.display = 'block';
        document.getElementById('fallback').style.display = 'none';
        _post('CaptchaError');
      }
    }

    window.onload = function() {
      if (typeof turnstile === 'undefined') {
        document.getElementById('error-msg').textContent = 'Failed to load captcha. Check your connection.';
        document.getElementById('error-msg').style.display = 'block';
        document.getElementById('fallback').style.display = 'none';
        _post('CaptchaError');
      }
    };
  </script>
</body>
</html>
''';

  @override
  Widget build(BuildContext context) {
    if (_loadFailed) {
      return SizedBox(
        height: 65,
        child: Center(
          child: TextButton.icon(
            onPressed: _retry,
            icon: const Icon(Icons.refresh, size: 16),
            label: Text(
              'Tap to retry captcha',
              style: TextStyle(fontSize: 12, color: Colors.grey[600]),
            ),
          ),
        ),
      );
    }

    return SizedBox(
      height: 65,
      child: InAppWebView(
        initialSettings: InAppWebViewSettings(
          javaScriptEnabled: true,
          domStorageEnabled: true,
          allowFileAccess: true,
          allowContentAccess: true,
          transparentBackground: true,
          supportZoom: false,
          builtInZoomControls: false,
          displayZoomControls: false,
          useWideViewPort: false,
          loadWithOverviewMode: false,
          verticalScrollBarEnabled: false,
          horizontalScrollBarEnabled: false,
          overScrollMode: OverScrollMode.NEVER,
          userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36',
          useOnLoadResource: true,
          useShouldOverrideUrlLoading: false,
          mediaPlaybackRequiresUserGesture: false,
          mixedContentMode: MixedContentMode.MIXED_CONTENT_ALWAYS_ALLOW,
          thirdPartyCookiesEnabled: true,
          cacheMode: CacheMode.LOAD_DEFAULT,
        ),
        initialUrlRequest: URLRequest(
          url: WebUri('data:text/html;charset=utf-8,${Uri.encodeComponent(_buildHtml())}'),
        ),
        onWebViewCreated: (controller) {
          _webViewController = controller;
          controller.addJavaScriptHandler(
            handlerName: 'CaptchaToken',
            callback: (args) {
              if (_tokenReceived || !mounted) return;
              _tokenReceived = true;
              _timeoutTimer?.cancel();
              final token = args.isNotEmpty ? args[0].toString() : '';
              if (token.isNotEmpty) widget.onToken(token);
            },
          );
          controller.addJavaScriptHandler(
            handlerName: 'CaptchaExpired',
            callback: (_) {
              _tokenReceived = false;
              if (mounted) widget.onExpired?.call();
            },
          );
          controller.addJavaScriptHandler(
            handlerName: 'CaptchaError',
            callback: (_) {
              _tokenReceived = false;
              if (mounted && !_retrying) {
                _retry();
              } else if (mounted) {
                setState(() => _loadFailed = true);
                widget.onError?.call();
              }
            },
          );
        },
        onLoadStart: (controller, url) {},
        onLoadStop: (controller, url) {},
        onReceivedError: (controller, request, error) {
          if (mounted && !_loadFailed && !_tokenReceived) {
            _retry();
          }
        },
      ),
    );
  }
}
