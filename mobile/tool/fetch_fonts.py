#!/usr/bin/env python3
"""Download the Google Fonts files bundled with the app into mobile/google_fonts/.

Why these files exist
---------------------
The app disables google_fonts runtime fetching (see lib/main.dart):
fonts.gstatic.com is unreachable for users in China, and every failed fetch
used to surface in Crashlytics as a fatal
"Failed to load font ... ClientException: Connection closed" error.
Instead, the exact font files the google_fonts package would download are
bundled as Flutter assets (pubspec.yaml -> `google_fonts/`), where the
package picks them up by filename without touching the network.

What this script does
---------------------
For every family+weight the app uses, FONTS pins the gstatic file hash from
the google_fonts (pub.dev) package's own registry. The hash doubles as:
  * the download URL:  https://fonts.gstatic.com/s/a/<hash>.ttf
  * the expected SHA-256 of the downloaded bytes
so the result is byte-identical to what google_fonts itself would fetch.
Existing files with a matching hash are left alone; everything else is
(re-)downloaded and verified. Exit code is non-zero on any failure.

Normally run by .github/workflows/fetch-fonts.yml, which commits the files
to main. Can also be run locally: python3 mobile/tool/fetch_fonts.py

Keep in sync with the app code:
  * Manrope        w400-w800  — UI font (GoogleFonts.manrope / manropeTextTheme)
  * NotoSerifSC    w600 only  — hanzi font (hanziStyle); keep hanzi at the
                                default weight or add the new cut here first
  * JetBrainsMono  w600, w700 — eyebrows / numbers (monoStyle)

Licenses: Manrope, Noto Serif SC and JetBrains Mono are all licensed under
the SIL Open Font License 1.1.
"""

import hashlib
import sys
import urllib.request
from pathlib import Path

# filename -> (sha256 == gstatic file id, exact size in bytes).
# Values come from the google_fonts 6.3.3 package registry.
FONTS = {
    "Manrope-Regular.ttf": (
        "1ddeeeff9fe3d294f709f2239557278930f56dab89db1fe535dc5c35cd67e0ee", 94948),
    "Manrope-Medium.ttf": (
        "acdd0ae608f0e024750c98bb1c4e76c13e31ad2b848eb8da7fcd783c051abafa", 95036),
    "Manrope-SemiBold.ttf": (
        "8791ca409cf36b8b2842e40b6b1cd5b42cca064b4fdf24e30f5611536793429d", 95072),
    "Manrope-Bold.ttf": (
        "e7793683898d8a0e4c97ec50116fc021d053f2f72113982076a50a9048f101b5", 94904),
    "Manrope-ExtraBold.ttf": (
        "6b753fbbbefcdfd17909197147c199d6ebc1cd79742e853bc1e732bc9f49831b", 95664),
    "NotoSerifSC-SemiBold.ttf": (
        "ebbd878444e9c226709d1259352d9d821849ee8105b5191d44101889603e154b", 14780624),
    "JetBrainsMono-SemiBold.ttf": (
        "f833596d98e0e021dd43d993254658d0f32318f82f08afee0fc2e41c16ce9571", 112136),
    "JetBrainsMono-Bold.ttf": (
        "b43a7dfebfb8816fb3859f6a7932824f594e115538ccd3f1ebc0ffc231b0acab", 112068),
}

DEST = Path(__file__).resolve().parent.parent / "google_fonts"
URL = "https://fonts.gstatic.com/s/a/{hash}.ttf"


def sha256_of(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1 << 20), b""):
            digest.update(chunk)
    return digest.hexdigest()


def main() -> int:
    DEST.mkdir(parents=True, exist_ok=True)
    failures = []
    downloaded = 0
    for name, (expected_hash, expected_size) in FONTS.items():
        path = DEST / name
        if path.is_file() and path.stat().st_size == expected_size \
                and sha256_of(path) == expected_hash:
            print(f"ok        {name} (already present)")
            continue
        url = URL.format(hash=expected_hash)
        try:
            with urllib.request.urlopen(url, timeout=180) as response:
                data = response.read()
        except Exception as error:  # noqa: BLE001 - report and keep going
            print(f"FAIL      {name}: download error: {error}")
            failures.append(name)
            continue
        actual_hash = hashlib.sha256(data).hexdigest()
        if len(data) != expected_size or actual_hash != expected_hash:
            print(f"FAIL      {name}: expected {expected_size}B/{expected_hash}, "
                  f"got {len(data)}B/{actual_hash}")
            failures.append(name)
            continue
        path.write_bytes(data)
        downloaded += 1
        print(f"fetched   {name} ({len(data)} bytes, sha256 verified)")

    print(f"\n{downloaded} downloaded, "
          f"{len(FONTS) - downloaded - len(failures)} already present, "
          f"{len(failures)} failed")
    if failures:
        print("FAILED: " + ", ".join(failures))
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
