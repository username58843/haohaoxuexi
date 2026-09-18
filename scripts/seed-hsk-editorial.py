#!/usr/bin/env python3
"""Seed editable glosses from legacy packs and a local CC-CEDICT download."""

import argparse
from collections import defaultdict
import gzip
import hashlib
import json
from pathlib import Path
import re
import shutil
import unicodedata

from pypinyin.contrib.tone_convert import to_tone

ROOT = Path(__file__).resolve().parent.parent


def key(value):
    return re.sub(r"[\s'’ʼ-]+", "", value.lower())


def untoned(value):
    return "".join(c for c in unicodedata.normalize("NFD", key(value))
                   if unicodedata.category(c) != "Mn")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("cedict", type=Path)
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()
    dest = args.output or ROOT / "data/hsk/editorial.json"
    if dest.exists():
        raise SystemExit("Editorial data already exists; refusing to overwrite edits")
    source = json.loads((ROOT / "data/hsk/source.json").read_text())
    legacy = defaultdict(list)
    legacy_dir = ROOT / "words/legacy"
    legacy_dir.mkdir(exist_ok=True)
    input_dir = legacy_dir if (legacy_dir / "hsk1.json").exists() else ROOT / "words"
    for path in sorted(input_dir.glob("hsk*.json")):
        if input_dir != legacy_dir:
            shutil.copyfile(path, legacy_dir / path.name)
        for word in json.loads(path.read_text()):
            legacy[word["simplified"]].append(word)
    cedict = defaultdict(list)
    with gzip.open(args.cedict, "rt", encoding="utf-8") as file:
        for line in file:
            match = re.match(r"(\S+) (\S+) \[(.+?)\] /(.+)/$", line.strip())
            if not match:
                continue
            traditional, simplified, py, definitions = match.groups()
            pinyin = " ".join(to_tone(syllable.lower().replace("u:", "v")) for syllable in py.split())
            glosses = [s for s in definitions.split("/") if not s.startswith("CL:")]
            if glosses:
                cedict[simplified].append((key(pinyin), traditional, glosses[:6]))
    editorial = {}
    duplicates = defaultdict(int)
    readings = defaultdict(set)
    for entry in source["entries"]:
        duplicates[entry["simplified"]] += 1
        readings[entry["simplified"]].add(key(entry["pinyin"]))
    for entry in source["entries"]:
        simplified, pinyin = entry["simplified"], entry["pinyin"]
        candidates = legacy[simplified]
        source_readings = {key(value) for value in pinyin.split("/")}
        exact = next((w for w in candidates if key(w["pinyin"]) in source_readings), None)
        if exact is None and len(readings[simplified]) == 1:
            flat = [w for w in candidates if untoned(w["pinyin"]) == untoned(pinyin)]
            if len(flat) == 1:
                exact = flat[0]
        item = {"translations": {}, "provenance": {}}
        if exact:
            for lang in ("en", "ru", "tk"):
                glosses = exact.get("translations", {}).get(lang, [])
                if glosses:
                    item["translations"][lang] = glosses
                    item["provenance"][lang] = "legacy-unreviewed"
            if entry["sense"] == 1:
                item["idPinyin"] = exact["pinyin"]
            if duplicates[simplified] == 1 and simplified in exact.get("example", {}).get("zh", ""):
                item["example"] = exact["example"]
        match = next((value for value in cedict[simplified] if value[0] in source_readings), None)
        if match is None and len(readings[simplified]) == 1:
            flat = [value for value in cedict[simplified] if untoned(value[0]) == untoned(pinyin)]
            if len(flat) == 1:
                match = flat[0]
        if match:
            item["traditional"] = match[1]
            if not item["translations"].get("en"):
                item["translations"]["en"] = match[2]
                item["provenance"]["en"] = "CC-CEDICT-unreviewed"
        editorial[str(entry["number"])] = item
    dest.write_text(json.dumps({
        "sourceVersion": source["metadata"]["version"],
        "cedict": {
            "url": "https://www.mdbg.net/chinese/export/cedict/cedict_1_0_ts_utf-8_mdbg.txt.gz",
            "license": "CC-BY-SA-4.0",
            "sha256": hashlib.sha256(args.cedict.read_bytes()).hexdigest(),
        },
        "entries": editorial,
    }, ensure_ascii=False, indent=2) + "\n")
    print(f"Seeded {len(editorial)} editable entries; legacy API packs retained unchanged")


if __name__ == "__main__":
    main()
