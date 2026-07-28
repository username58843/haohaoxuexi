import 'package:flutter/material.dart';
import 'package:flutter_inappwebview/flutter_inappwebview.dart';

/// Cloudflare Turnstile captcha widget.
///
/// Loads the Turnstile widget from `haohaoxuexi.tech/captcha.html`
/// (served over HTTPS) so the page has a real origin instead of `null`,
/// which avoids CSP / iframe restrictions that break Turnstile's
/// challenge platform on Android WebView.
///
/// Communicates from JavaScript via custom URL scheme
/// (`captchatoken://…` / `captchaexpired://`) intercepted by
/// [shouldOverrideUrlLoading].
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
  bool _tokenSent = false;

  static const _captchaUrl = 'https://haohaoxuexi.tech/captcha.html';

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 90,
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
          javaScriptCanOpenWindowsAutomatically: false,
        ),
        initialUrlRequest: URLRequest(url: WebUri(_captchaUrl)),
        shouldOverrideUrlLoading: (controller, navAction) async {
          final url = navAction.request.url.toString();

          if (url.startsWith('captchatoken://')) {
            final token = Uri.decodeComponent(url.substring(16));
            if (!_tokenSent && mounted) {
              _tokenSent = true;
              widget.onToken(token);
            }
            return NavigationActionPolicy.CANCEL;
          }

          if (url.startsWith('captchaexpired://')) {
            _tokenSent = false;
            if (mounted) widget.onExpired?.call();
            return NavigationActionPolicy.CANCEL;
          }

          return NavigationActionPolicy.ALLOW;
        },
      ),
    );
  }
}
