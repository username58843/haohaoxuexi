import 'dart:convert';
import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter_inappwebview/flutter_inappwebview.dart';

import '../../core/api.dart' show apiBaseUrl;
import '../../core/theme.dart';

/// Animated stroke-order panel — Flutter port of the web `StrokeOrder`
/// (components/WordSheet.js): one looping hanzi-writer animation per
/// character, 120×120 tiles, accent-colored strokes, 1.2s pause between
/// loops.
///
/// hanzi-writer is a JS library, so the tiles are rendered inside an
/// [InAppWebView] (already a dependency, used by the captcha widget). The
/// script is the site's vendored copy — the exact same file the web app
/// loads — and per-character stroke data comes from the hanzi-writer data
/// CDN, same as the web defaults. The webview is wrapped in [IgnorePointer]
/// so the sheet keeps scrolling naturally over it; if the script fails to
/// load (offline), the panel collapses to nothing, mirroring the web
/// behaviour.
class StrokeOrderPanel extends StatefulWidget {
  const StrokeOrderPanel({super.key, required this.characters});

  /// Han characters to animate (already filtered by the caller).
  final List<String> characters;

  @override
  State<StrokeOrderPanel> createState() => _StrokeOrderPanelState();
}

class _StrokeOrderPanelState extends State<StrokeOrderPanel> {
  static const double _tile = 120;
  static const double _gap = 8;

  bool _failed = false;

  String _html(Color accent) {
    final accentHex =
        '#${accent.toARGB32().toRadixString(16).padLeft(8, '0').substring(2)}';
    final chars = jsonEncode(widget.characters);
    final src = jsonEncode('$apiBaseUrl/vendor/hanzi-writer-3.5.0.min.js');
    return '''
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, user-scalable=no">
<style>
  html, body { margin: 0; padding: 0; background: transparent; overflow: hidden; }
  #grid { display: flex; flex-wrap: wrap; justify-content: center; gap: ${_gap.toInt()}px; }
  #grid > div { width: ${_tile.toInt()}px; height: ${_tile.toInt()}px; }
</style>
</head>
<body>
<div id="grid"></div>
<script>
(function () {
  var chars = $chars;
  var grid = document.getElementById('grid');

  function fail() {
    function send() {
      try { window.flutter_inappwebview.callHandler('strokesFailed'); } catch (e) {}
    }
    if (window.flutter_inappwebview && window.flutter_inappwebview.callHandler) send();
    else window.addEventListener('flutterInAppWebViewPlatformReady', send);
  }

  var script = document.createElement('script');
  script.src = $src;
  script.onload = function () {
    if (!window.HanziWriter) return fail();
    var ok = false;
    chars.forEach(function (ch) {
      var host = document.createElement('div');
      grid.appendChild(host);
      try {
        // Same options as the web StrokeOrder component.
        var writer = HanziWriter.create(host, ch, {
          width: ${_tile.toInt()},
          height: ${_tile.toInt()},
          padding: 6,
          strokeColor: '$accentHex',
          delayBetweenLoops: 1200,
        });
        writer.loopCharacterAnimation();
        ok = true;
      } catch (e) {
        host.remove();
      }
    });
    if (!ok) fail();
  };
  script.onerror = fail;
  document.head.appendChild(script);
})();
</script>
</body>
</html>
''';
  }

  @override
  Widget build(BuildContext context) {
    if (_failed || widget.characters.isEmpty) return const SizedBox.shrink();
    final accent = accentOf(context);

    return LayoutBuilder(
      builder: (context, constraints) {
        final width = constraints.maxWidth.isFinite
            ? constraints.maxWidth
            : MediaQuery.sizeOf(context).width;
        final perRow =
            math.max(1, ((width + _gap) / (_tile + _gap)).floor());
        final rows = (widget.characters.length + perRow - 1) ~/ perRow;
        final height = rows * _tile + (rows - 1) * _gap;

        return SizedBox(
          height: height,
          // The animation is non-interactive: let taps and drags fall
          // through to the sheet's scroll view.
          child: IgnorePointer(
            child: InAppWebView(
              key: ValueKey('${widget.characters.join()}|${accent.toARGB32()}'),
              initialSettings: InAppWebViewSettings(
                javaScriptEnabled: true,
                transparentBackground: true,
                supportZoom: false,
                builtInZoomControls: false,
                displayZoomControls: false,
                verticalScrollBarEnabled: false,
                horizontalScrollBarEnabled: false,
                overScrollMode: OverScrollMode.NEVER,
              ),
              initialData: InAppWebViewInitialData(data: _html(accent)),
              onWebViewCreated: (controller) {
                controller.addJavaScriptHandler(
                  handlerName: 'strokesFailed',
                  callback: (_) {
                    if (mounted) setState(() => _failed = true);
                    return null;
                  },
                );
              },
            ),
          ),
        );
      },
    );
  }
}
