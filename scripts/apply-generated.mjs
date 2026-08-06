#!/usr/bin/env node
/**
 * Merge generated content into the word packs (words/ + mobile/assets/words/):
 *  - /agent/workspace/gen/sent-out/batch-*.json → word.example {zh, py, en, ru}
 *  - /agent/workspace/gen/tk-out/batch-*.json   → word.translations.tk
 *  - batch-extra outputs may also carry `ru` for the newly added official
 *    words (they shipped with EN-only glosses) → word.translations.ru.
 *
 * Keyed by canonical word id (simplified·pinyinKey), so every pack that
 * contains a word receives the same sentence/translations. Existing values
 * are only filled, never overwritten. Idempotent — safe to re-run.
 *
 * Usage: node scripts/apply-generated.mjs [--dry]
 */

import fs from 'fs'
import path from 'path'

const GEN = '/agent/workspace/gen'
const DIRS = ['words', 'mobile/assets/words']
const DRY = process.argv.includes('--dry')

const wid = (w) =>
  w.simplified.trim() + '·' + String(w.pinyin || '').toLowerCase().replace(/[\s'’ʼ]+/g, '')

function loadOutputs(dir) {
  const abs = path.join(GEN, dir)
  const map = new Map()
  if (!fs.existsSync(abs)) return map
  for (const f of fs.readdirSync(abs).filter((f) => f.endsWith('.json')).sort()) {
    let data
    try {
      data = JSON.parse(fs.readFileSync(path.join(abs, f), 'utf8'))
    } catch (err) {
      console.error(`skip ${dir}/${f}: ${err.message}`)
      continue
    }
    if (!Array.isArray(data)) continue
    for (const row of data) {
      if (row && typeof row.id === 'string' && row.id && !map.has(row.id)) map.set(row.id, row)
    }
  }
  return map
}

const clip = (s) => String(s || '').trim().slice(0, 200)
const sentences = loadOutputs('sent-out')
const tkMap = loadOutputs('tk-out')
console.log(`generated: ${sentences.size} sentences, ${tkMap.size} tk translations`)

let examplesAdded = 0
let tkAdded = 0
let ruAdded = 0

for (const dir of DIRS) {
  if (!fs.existsSync(dir)) continue
  for (const file of fs.readdirSync(dir).filter((f) => f.endsWith('.json'))) {
    const full = path.join(dir, file)
    let data
    try {
      data = JSON.parse(fs.readFileSync(full, 'utf8'))
    } catch {
      continue
    }
    if (!Array.isArray(data)) continue

    let changed = false
    for (const word of data) {
      if (!word || !word.simplified) continue
      const id = wid(word)

      const sent = sentences.get(id)
      if (sent && sent.zh && !word.example) {
        const ex = { zh: clip(sent.zh) }
        if (sent.py) ex.py = clip(sent.py)
        if (sent.en) ex.en = clip(sent.en)
        if (sent.ru) ex.ru = clip(sent.ru)
        if (sent.tk) ex.tk = clip(sent.tk)
        word.example = ex
        examplesAdded += 1
        changed = true
      }

      const tk = tkMap.get(id)
      if (tk) {
        const tkLines = (Array.isArray(tk.tk) ? tk.tk : []).map(clip).filter(Boolean).slice(0, 4)
        if (tkLines.length) {
          if (!word.translations) word.translations = {}
          if (!Array.isArray(word.translations.tk) || word.translations.tk.length === 0) {
            word.translations.tk = tkLines
            tkAdded += 1
            changed = true
          }
        }
        const ruLines = (Array.isArray(tk.ru) ? tk.ru : []).map(clip).filter(Boolean).slice(0, 4)
        if (ruLines.length) {
          if (!word.translations) word.translations = {}
          if (!Array.isArray(word.translations.ru) || word.translations.ru.length === 0) {
            word.translations.ru = ruLines
            ruAdded += 1
            changed = true
          }
        }
      }
    }

    if (changed && !DRY) fs.writeFileSync(full, JSON.stringify(data))
    if (changed) console.log(`${dir}/${file}: updated`)
  }
}

console.log(
  `${DRY ? '[dry] ' : ''}examples +${examplesAdded}, tk +${tkAdded}, ru +${ruAdded} (across both dirs)`
)
