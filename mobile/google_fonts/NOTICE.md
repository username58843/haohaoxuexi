# Bundled fonts

The `.ttf` files in this directory are Flutter assets consumed by the
[`google_fonts`](https://pub.dev/packages/google_fonts) package. With runtime
fetching disabled (`lib/main.dart`), the package loads these files by name
instead of downloading them from `fonts.gstatic.com` — which is unreachable
for users in China and used to produce fatal "Failed to load font" errors in
Crashlytics.

**Do not edit these files by hand.** They are downloaded, SHA-256-verified and
committed by the `Fetch bundled fonts` GitHub Actions workflow
(`.github/workflows/fetch-fonts.yml` → `mobile/tool/fetch_fonts.py`), and are
byte-identical to the files the google_fonts package itself would fetch.

Bundled cuts (keep in sync with `tool/fetch_fonts.py` and `lib/core/theme.dart`):

| Family         | Weights            | Used for                          |
| -------------- | ------------------ | --------------------------------- |
| Manrope        | 400, 500, 600, 700, 800 | UI text (`manropeTextTheme`) |
| Noto Serif SC  | 600 only           | hanzi (`hanziStyle` / `HanziText`) |
| JetBrains Mono | 600, 700           | eyebrows / numbers (`monoStyle`)  |

All three families are licensed under the
[SIL Open Font License 1.1](https://openfontlicense.org/).

This file also keeps the directory non-empty so `flutter build` succeeds on a
fresh checkout made before the workflow has committed the fonts.
