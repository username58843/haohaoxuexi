#!/usr/bin/env node
/**
 * One-shot data cleanup: strips CC-CEDICT classifier/variant artifacts from
 * the word packs (both /words and the bundled /mobile/assets/words copies).
 *
 * Removed from `definitions` and `translations.en`:
 *  - classifier entries:        "CL:個|个", "CL:家[jiā]", "CL:盤|盘" …
 *  - bare variant fragments:    "支", "枝[zhī]", "位[wèi]", "個|个[gè]" …
 *    (pure CJK, optionally with a traditional|simplified pipe and/or a
 *    bracketed pinyin — these are shards of comma-split CEDICT glosses,
 *    never real English meanings)
 *
 * Every remaining gloss is kept as-is. If a list would become empty the
 * original first entry is kept so no word ever loses its meaning line.
 *
 * Usage: node scripts/clean-defs.mjs [--dry]
 */

import fs from 'fs'
import path from 'path'

const DIRS = ['words', 'mobile/assets/words']
const DRY = process.argv.includes('--dry')

// "CL:" with optional whitespace; case-insensitive just in case.
const CL_RE = /^CL\s*:/i
// Pure CJK fragment: Han chars (+ radicals/compat forms), pipes, list
// separators and an optional trailing [pinyin] group. Nothing latin/cyrillic.
const HAN_FRAGMENT_RE =
  /^[⺀-⿟　-〿㐀-䶿一-鿿豈-﫿·|,，、\s]+(\[[^\]]*\])?$/

function isArtifact(entry) {
  const s = String(entry || '').trim()
  if (!s) return true
  return CL_RE.test(s) || HAN_FRAGMENT_RE.test(s)
}

function cleanList(list) {
  if (!Array.isArray(list)) return { list, removed: 0 }
  const kept = list.filter((d) => !isArtifact(d))
  if (kept.length === list.length) return { list, removed: 0 }
  // Never leave a word meaningless: fall back to the original first entry.
  const result = kept.length > 0 ? kept : list.slice(0, 1)
  return { list: result, removed: list.length - result.length }
}

let filesChanged = 0
let entriesRemoved = 0

for (const dir of DIRS) {
  const abs = path.resolve(process.cwd(), dir)
  if (!fs.existsSync(abs)) continue
  for (const file of fs.readdirSync(abs).filter((f) => f.endsWith('.json'))) {
    const full = path.join(abs, file)
    const original = fs.readFileSync(full, 'utf8')
    let data
    try {
      data = JSON.parse(original)
    } catch {
      console.error(`skip (invalid JSON): ${dir}/${file}`)
      continue
    }
    if (!Array.isArray(data)) continue

    let removedInFile = 0
    for (const word of data) {
      if (!word || typeof word !== 'object') continue
      const defs = cleanList(word.definitions)
      if (defs.removed) {
        word.definitions = defs.list
        removedInFile += defs.removed
      }
      if (word.translations && Array.isArray(word.translations.en)) {
        const en = cleanList(word.translations.en)
        if (en.removed) {
          word.translations.en = en.list
          removedInFile += en.removed
        }
      }
    }

    if (removedInFile > 0) {
      filesChanged += 1
      entriesRemoved += removedInFile
      // Preserve the file's formatting style (minified vs pretty).
      const pretty = /^\s*\[\s*\n/.test(original)
      const out = pretty ? JSON.stringify(data, null, 2) : JSON.stringify(data)
      console.log(`${dir}/${file}: -${removedInFile} artifact entr${removedInFile === 1 ? 'y' : 'ies'}`)
      if (!DRY) fs.writeFileSync(full, out)
    }
  }
}

console.log(`\n${DRY ? '[dry-run] ' : ''}${filesChanged} file(s) affected, ${entriesRemoved} artifact entries removed`)
