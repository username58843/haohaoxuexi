#!/usr/bin/env python3
"""Extract the supplied HSK syllabus without guessing vocabulary or translations."""

import argparse
from collections import Counter
import hashlib
import json
from pathlib import Path
import re
import xml.etree.ElementTree as ET
from zipfile import ZipFile

ROOT = Path(__file__).resolve().parent.parent
NS = {"w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main"}
IMAGE_GLYPHS = {"b3a6253e484be07095e4ef50a82c3a1ba5e0d7288ccc652f91251e582edaaf73": "赛"}
image_glyph_ids = {}
EXPECTED = {1: 300, 2: 200, 3: 500, 4: 1000, 5: 1600, 6: 1800, 7: 5600}
SECTION_NAMES = {
    "任务大纲": "tasks", "话题大纲": "topics", "词汇大纲": "vocabulary",
    "汉字大纲": "characters", "语法大纲": "grammar",
}


def text(element):
    pieces = []
    for node in element.iter():
        if node.tag == f"{{{NS['w']}}}t":
            pieces.append(node.text or "")
        elif node.tag.endswith("}blip"):
            relationship = node.get("{http://schemas.openxmlformats.org/officeDocument/2006/relationships}embed")
            pieces.append(image_glyph_ids.get(relationship, ""))
    return "".join(pieces).strip()


def write_json(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def extract(document):
    with ZipFile(document) as archive:
        image_glyph_ids.clear()
        relationships = ET.fromstring(archive.read("word/_rels/document.xml.rels"))
        for relationship in relationships:
            target = relationship.get("Target", "")
            if target.startswith("media/"):
                digest = hashlib.sha256(archive.read("word/" + target)).hexdigest()
                if digest in IMAGE_GLYPHS:
                    image_glyph_ids[relationship.get("Id")] = IMAGE_GLYPHS[digest]
        root = ET.fromstring(archive.read("word/document.xml"))
    entries = []
    sections = {key: [] for key in SECTION_NAMES.values() if key != "vocabulary"}
    section = None
    for block in root.find("w:body", NS):
        tag = block.tag.rsplit("}", 1)[-1]
        if tag == "p":
            value = text(block)
            if value in SECTION_NAMES:
                section = SECTION_NAMES[value]
            elif section in sections and value and not re.fullmatch(r"[-\s\d]+", value):
                sections[section].append({"type": "paragraph", "text": value})
        elif tag == "tbl":
            rows = [["\n".join(text(p) for p in cell.findall("w:p", NS) if text(p))
                     for cell in row.findall("w:tc", NS)] for row in block.findall("w:tr", NS)]
            if rows and rows[0] == ["序号", "等级", "词语", "拼音", "词性"]:
                for number, level, headword, pinyin, pos in rows[1:]:
                    headword = headword.replace("\n", "")
                    pinyin = pinyin.replace("\n", "")
                    pos = pos.replace("\n", "")
                    match = re.fullmatch(r"(.+?)(\d+)?", headword)
                    if not match:
                        raise ValueError(f"Missing headword in source row {number}")
                    entries.append({
                        "number": int(number), "level": int(level[0]),
                        "levelLabel": level, "headword": headword,
                        "simplified": match[1], "sense": int(match[2] or 1),
                        "pinyin": pinyin, "partOfSpeech": pos,
                    })
            elif section in sections and rows:
                sections[section].append({"type": "table", "rows": rows})
    if [entry["number"] for entry in entries] != list(range(1, 11001)):
        raise ValueError("Expected exactly the consecutive source rows 1–11000")
    if Counter(entry["level"] for entry in entries) != EXPECTED:
        raise ValueError("Source level counts differ from the supplied syllabus")
    if any(not value for value in sections.values()):
        raise ValueError("A non-vocabulary section is missing")
    return entries, sections


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("document", type=Path)
    args = parser.parse_args()
    entries, sections = extract(args.document)
    metadata = {
        "version": "hsk-2025-11", "title": "HSK 考试大纲",
        "publisher": "中外语言交流合作中心", "published": "2025-11", "effective": "2026-07",
        "source": "User-supplied 新版HSK考试大纲1219.docx",
        "sha256": hashlib.sha256(args.document.read_bytes()).hexdigest(),
        "counts": EXPECTED, "total": len(entries),
        "sourceLanguages": ["zh"], "hasTranslations": False,
    }
    write_json(ROOT / "data/hsk/source.json", {"metadata": metadata, "entries": entries})
    write_json(ROOT / "public/hsk/syllabus-zh.json", {"metadata": metadata, "sections": sections})
    print(f"Extracted {len(entries)} entries and {sum(map(len, sections.values()))} guide blocks")


if __name__ == "__main__":
    main()
