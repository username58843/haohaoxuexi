#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."

if ! command -v java >/dev/null; then
  if [[ "$(id -u)" == 0 ]] && command -v apt-get >/dev/null; then
    apt-get update -qq
    apt-get install -y -qq openjdk-17-jdk-headless unzip
  else
    echo 'Install JDK 17 (JAVA_HOME) and unzip before running Android setup.' >&2
    exit 1
  fi
fi

export ANDROID_HOME="${ANDROID_HOME:-$PWD/.tools/android-sdk}"
export ANDROID_SDK_ROOT="$ANDROID_HOME"
export PATH="$ANDROID_HOME/cmdline-tools/22.0/bin:$ANDROID_HOME/platform-tools:$PATH"
if [[ ! -x "$ANDROID_HOME/cmdline-tools/22.0/bin/sdkmanager" ]]; then
  mkdir -p "$ANDROID_HOME/cmdline-tools"
  python3 - "$ANDROID_HOME" <<'PY'
import hashlib
from pathlib import Path
import sys
import tempfile
import urllib.request
import zipfile

root = Path(sys.argv[1])
url = 'https://dl.google.com/android/repository/commandlinetools-linux-15859902_latest.zip'
sha = '4e4c464f145a7512b57d088ac6c278c03c9eea610886b35a5e0804e74eedf583'
with tempfile.TemporaryDirectory(dir=root) as tmp:
    archive = Path(tmp) / 'tools.zip'
    urllib.request.urlretrieve(url, archive)
    if hashlib.sha256(archive.read_bytes()).hexdigest() != sha:
        raise SystemExit('Android command-line tools checksum mismatch')
    with zipfile.ZipFile(archive) as z:
        z.extractall(tmp)
    (Path(tmp) / 'cmdline-tools').rename(root / 'cmdline-tools/22.0')
    for file in (root / 'cmdline-tools/22.0/bin').iterdir():
        file.chmod(file.stat().st_mode | 0o111)
PY
fi

# Noninteractive SDK installation in this disposable build environment.
yes | sdkmanager --sdk_root="$ANDROID_HOME" --licenses >/dev/null || test "${PIPESTATUS[1]}" = 0
sdkmanager --sdk_root="$ANDROID_HOME" 'platform-tools' 'platforms;android-36' 'build-tools;36.0.0' 'ndk;28.2.13676358' 'cmake;3.22.1'
./.tools/flutter/bin/flutter config --android-sdk "$ANDROID_HOME"
java -version
sdkmanager --version
