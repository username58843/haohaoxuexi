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
    "ZCOOLXiaoWei-Regular.ttf": (
        "88f3becb57e71d70863951a31de6f30f09beacc4a0da4efd887409c265d21f9a", 3917592),
    "MaShanZheng-Regular.ttf": (
        "18689b524ea22916a760249127fd63dba37af537b071668c06b7fc7357e98b9b", 5855516),
    "NotoSansSC-Regular.ttf": (
        "eacedb2999b6cd30457f3820f277842f0dfbb28152a246fca8161779a8945425", 10540772),
    "Inter-Regular.ttf": (
        "ecdb53099b1a68cd24c6900ea5beeafec81bd3c8cb9d0f3c51b9986583ba3982", 303384),
    "Inter-Bold.ttf": (
        "b7e339223d56e8c4210c86f1ba87b3d43d6c47e03956ea56f0a7a938ae61b2a3", 309732),
    "Lora-Regular.ttf": (
        "cc8c87cfc6fdf4bbe9c7ad2b4b2eba51b05442ef756926874780d953e574ff26", 132164),
    "Lora-Bold.ttf": (
        "ebda3b2383c1852f60aa54d2864c2c5aad405e8e2290d68318a5a3087a897120", 132100),
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

LICENSES = {
    "manrope": "58172e0c0fac2cda8a37b348164bb55e44b0e69051e557e92b1d3f6910141f7b",
    "notoserifsc": "5e0da210fb04058a8c0087985d2d456b931c2579811a49655721d3cf0c36b6d6",
    "jetbrainsmono": "b2fe5e8987594e9ffd1d2ca52a2f5d73eb8335243893c5d6254b5ad69269591d",
    "zcoolxiaowei": "a094514ca57cf8f9c5e8d8d1adab5d8cd3a377297ff016f9df2c05b3ecd77f0a",
    "mashanzheng": "d7bdb1cee215b689e23c2f95672a6084c790542170648267a55114103d756a08",
    "notosanssc": "1c05c68c34f9708415aada51f17e1b0092d2cea709bf4a94cd38114f9e73d7d9",
    "inter": "5b9321a4298cfeb6b34354164a1c3afc3db114569984c502b9b35d988fd58c57",
    "lora": "1d9a970809ac804b582a6ce7f0ebc4e7fefcbfd7ff6299cad35ee656a21be716",
}


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

    for family, expected in LICENSES.items():
        notice = DEST / f"OFL-{family}.txt"
        if notice.is_file() and sha256_of(notice) == expected:
            continue
        try:
            url = f"https://raw.githubusercontent.com/google/fonts/main/ofl/{family}/OFL.txt"
            with urllib.request.urlopen(url, timeout=60) as response:
                data = response.read()
            if hashlib.sha256(data).hexdigest() != expected:
                raise ValueError("License checksum mismatch")
            notice.write_bytes(data)
        except Exception as error:
            print(f"FAIL      {family} license: {error}")
            failures.append(f"{family} license")

    print(f"\n{downloaded} fonts downloaded, "
          f"{len(failures)} failed")
    if failures:
        print("FAILED: " + ", ".join(failures))
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
