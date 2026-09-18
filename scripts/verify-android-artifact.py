#!/usr/bin/env python3
"""Reject release APKs/AABs missing Flutter or AOT libraries for supported ABIs."""

import argparse
import struct
from zipfile import ZipFile

MACHINES = {"armeabi-v7a": 40, "arm64-v8a": 183, "x86_64": 62}


def verify(path, abis):
    prefix = "base/" if str(path).endswith(".aab") else ""
    with ZipFile(path) as archive:
        names = set(archive.namelist())
        for abi in abis:
            for library in ("libflutter.so", "libapp.so"):
                name = f"{prefix}lib/{abi}/{library}"
                if name not in names:
                    raise ValueError(f"Missing {name}: do not distribute an incomplete/split base APK")
                with archive.open(name) as file:
                    header = file.read(20)
                if len(header) != 20 or header[:4] != b"\x7fELF" or header[5] != 1:
                    raise ValueError(f"Invalid ELF library: {name}")
                if struct.unpack_from("<H", header, 18)[0] != MACHINES[abi]:
                    raise ValueError(f"Wrong architecture: {name}")
    return True


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("artifact")
    parser.add_argument("--abis", nargs="+", choices=MACHINES, default=list(MACHINES))
    arguments = parser.parse_args()
    verify(arguments.artifact, arguments.abis)
    print(f"Verified Flutter + AOT libraries: {', '.join(arguments.abis)}")
