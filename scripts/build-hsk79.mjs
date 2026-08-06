#!/usr/bin/env node
/**
 * One-shot builder for the HSK 3.0 band 7–9 pack (`hsk7-9`).
 *
 * Source: drkameleon/complete-hsk-vocabulary (MIT), new-7 level — the official
 * 2021 《国际中文教育中文水平等级标准》 七–九级 word list (~5,600 words with
 * tone-marked pinyin and CC-CEDICT-derived English glosses; CC-CEDICT is
 * CC BY-SA 4.0 — credited in the About page).
 *
 * Input:  /agent/workspace/hsk-data/hsk30-7-9.json  (see hsk-data/REPORT.md)
 * Output: words/hsk7-9.json + mobile/assets/words/hsk7-9.json (minified),
 *         sorted by corpus frequency (most common first), hsk: 7.
 *
 * The same artifact filter as scripts/clean-defs.mjs is applied to the
 * glosses (classifier "CL:…" entries and bare hanzi variant fragments).
 */

import fs from 'fs'

const SRC = '/agent/workspace/hsk-data/hsk30-7-9.json'
const OUT = ['words/hsk7-9.json', 'mobile/assets/words/hsk7-9.json']
const MAX_DEFS = 8

const CL_RE = /^CL\s*:/i
const HAN_FRAGMENT_RE = /^[⺀-⿟　-〿㐀-䶿一-鿿豈-﫿·|,，、\s]+(\[[^\]]*\])?$/
const isArtifact = (s) => {
  const v = String(s || '').trim()
  return !v || CL_RE.test(v) || HAN_FRAGMENT_RE.test(v)
}

const raw = JSON.parse(fs.readFileSync(SRC, 'utf8'))
const out = []
const seen = new Set()

for (const entry of raw) {
  const simplified = String(entry.simplified || '').trim()
  if (!simplified) continue
  const form = Array.isArray(entry.forms) && entry.forms[0] ? entry.forms[0] : null
  if (!form) continue

  const pinyin = String(form.transcriptions?.pinyin || '').trim()
  if (!pinyin) continue

  const id = simplified + '·' + pinyin.toLowerCase().replace(/[\s'’ʼ]+/g, '')
  if (seen.has(id)) continue
  seen.add(id)

  let defs = (Array.isArray(form.meanings) ? form.meanings : [])
    .map((m) => String(m).trim())
    .filter((m) => !isArtifact(m))
    .slice(0, MAX_DEFS)
  if (defs.length === 0) {
    const first = (form.meanings || []).map((m) => String(m).trim()).filter(Boolean)[0]
    if (!first) continue
    defs = [first]
  }

  const word = {
    simplified,
    traditional: String(form.traditional || simplified).trim() || simplified,
    pinyin,
    definitions: defs,
    translations: { en: defs },
    hsk: 7, // the combined band 7–9
    frequency: Number.isFinite(entry.frequency) ? entry.frequency : null,
  }
  if (typeof entry.radical === 'string' && entry.radical) word.radicals = entry.radical
  out.push(word)
}

// Most common words first — a sane default learning order for the band.
out.sort((a, b) => (a.frequency ?? 1e9) - (b.frequency ?? 1e9))
for (const w of out) delete w.frequency

for (const file of OUT) fs.writeFileSync(file, JSON.stringify(out))
console.log(`hsk7-9: ${out.length} words → ${OUT.join(', ')}`)
console.log('first:', out[0].simplified, out[0].pinyin, '| last:', out[out.length - 1].simplified)
