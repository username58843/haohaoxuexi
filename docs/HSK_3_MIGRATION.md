# HSK 3.0: source and release safeguards

The supplied `新版HSK考试大纲1219.docx` identifies its publication as **2025-11**
and implementation as **2026-07**, not September 2026. Its vocabulary tables
contain **11,000 numbered entries**, Chinese headwords, pinyin and parts of
speech. They do **not** contain English, Russian or Turkmen translations.

| Level | New entries | Cumulative entries |
| --- | ---: | ---: |
| 1 | 300 | 300 |
| 2 | 200 | 500 |
| 3 | 500 | 1,000 |
| 4 | 1,000 | 2,000 |
| 5 | 1,600 | 3,600 |
| 6 | 1,800 | 5,400 |
| 7–9 | 5,600 | 11,000 |

Re-extract with Python 3 (standard library only):

```sh
python3 scripts/import-hsk-syllabus.py path/to/新版HSK考试大纲1219.docx
```

The importer validates every source sequence number and every level count.
Numbered homographs (for example 花1 and 花2) must remain distinct source
entries. Parenthesized levels and parts of speech are retained verbatim.
The four non-vocabulary sections are preserved as paragraphs and tables;
the localized introduction is not a substitute for these original sections.

The character 赛 is embedded as an image, not text, in 13 vocabulary rows.
Both the PDF and DOCX text layers omit it. The importer restores that glyph
only for the SHA-256-identified image, visually checked on PDF page 353
(printed page 348). A text-only import would silently turn 比赛 into 比,
赛车 into 车, and leave row 8873 empty.

## Production data

Never delete or reseed production collections as part of a catalog release.
Personal decks and SRS cards contain user-owned snapshots; review history,
known-word marks and account settings must survive catalog updates. Do not
change the Android application ID or release signing key.

## Editorial verification

Source completeness, translation completeness and narrative coverage are
different checks. Do not claim complete translations or 100% story coverage
based on file counts, substring matching, or machine-generated filler.
Missing or unreviewed content must be reported explicitly before deployment.

### Client compatibility

The new web/Android clients request `catalog=2026-07` for vocabulary and SRS
GET requests. Old clients without the parameter continue to receive the
unchanged `words/legacy` packs. The query is part of the CDN cache key.

For an existing pronunciation, `idPinyin` retains its original identity while
`pinyin` displays the source spelling. Different readings are never collapsed
by stripping tones. Numbered homographs use a `~2`/`~3` suffix. Source rows
4148 and 7058 both say 横/héng without numbering; row 7058 gets an internal
`~2` identity, without altering the source text. Both JS and Dart snapshots
retain these fields. Level statistics are computed against the selected
catalog at read time; historical snapshots and review logs are not updated.

### Editorial inputs

`data/hsk/editorial.json` is the editable baseline. English glosses supplement
the old repository with [CC-CEDICT](https://www.mdbg.net/chinese/dictionary?page=cedict),
licensed under [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/).
The downloaded input SHA-256 and provenance are recorded in that file.
This attribution and the share-alike license apply to the derived CC-CEDICT
glosses, independently of the repository code license.

Put reviewed corrections in `editorial-overrides.json`; `node scripts/build-hsk.mjs`
regenerates byte-identical web/mobile packs and `coverage.json`. Inherited and
dictionary-sourced translations are explicitly **unreviewed**, not official
translations from the syllabus. No synthetic placeholder examples are added.
