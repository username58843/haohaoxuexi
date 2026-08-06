# 好好学习汉语 — mobile

Flutter Android app for [haohaoxuexi.tech](https://haohaoxuexi.tech): HSK
vocabulary with spaced repetition.

```bash
cd mobile
flutter pub get
flutter run
```

## Bundled fonts (google_fonts, offline)

Runtime font fetching is **disabled** (`GoogleFonts.config.allowRuntimeFetching
= false` in `lib/main.dart`): `fonts.gstatic.com` is unreachable for users in
China, and every failed fetch used to be reported to Crashlytics as a fatal
`Failed to load font ...` error.

Instead, the exact font files the `google_fonts` package would download are
committed under `google_fonts/` and declared as assets in `pubspec.yaml`. The
package finds them by filename and never touches the network.

- The files are downloaded, SHA-256-verified and committed by the
  **Fetch bundled fonts** workflow (`.github/workflows/fetch-fonts.yml`
  running `tool/fetch_fonts.py`). Don't edit them by hand.
- Bundled cuts: Manrope w400–w800, **Noto Serif SC w600 only** (each CJK cut
  is ~14 MB, so hanzi are standardized on the default SemiBold — see
  `hanziStyle` in `lib/core/theme.dart`), JetBrains Mono w600/w700.
- Adding a new family/weight: use it in code, add the matching entry to
  `tool/fetch_fonts.py` (hash + size from the google_fonts package registry),
  and re-run the workflow.

## Vendored WebView plugin (crash fix)

`third_party/flutter_inappwebview_android/` is a vendored copy of
`flutter_inappwebview_android` 1.1.2 wired up via `dependency_overrides` in
`pubspec.yaml`. It patches a WebView-creation crash on OEM ROMs that wrap
`android.webkit.WebSettings`:

```
ClassCastException: android.webkit.WebSettingsWrapper cannot be cast to
com.android.webview.chromium.ContentSettingsAdapter
```

Every `WebSettingsCompat.*` call is wrapped in try/catch (marked `HAOHAO
PATCH`). See `third_party/flutter_inappwebview_android/README.md` for the
full story and removal criteria.
