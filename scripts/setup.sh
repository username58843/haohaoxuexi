#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
npm ci --no-audit --no-fund
mkdir -p .tools
if [[ ! -x .tools/flutter/bin/flutter ]]; then
  git clone --depth 1 --branch 3.41.2 https://github.com/flutter/flutter.git .tools/flutter
fi
python3 mobile/tool/fetch_fonts.py
(cd mobile && ../.tools/flutter/bin/flutter pub get)
if [[ "${SETUP_ANDROID:-0}" == 1 ]]; then
  bash scripts/setup-android.sh
fi
