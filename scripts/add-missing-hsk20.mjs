#!/usr/bin/env node
/**
 * One-shot: append the official HSK 2.0 words that were missing from the
 * shipped hsk1..hsk6 packs (verified against the "HSK Official With
 * Definitions 2012" lists from glxxyz/hskhsk.com, MIT).
 *
 * Only ADDS — nothing is removed or reordered, so existing SRS cards, decks
 * and known-word ids stay untouched. Words already present at ANY level are
 * skipped (level-boundary differences between editions are left as shipped).
 *
 * Ref TSV columns: simplified \t traditional \t pinyin-numeric \t
 * pinyin-tonemarks \t english (';'-separated), UTF-8 with BOM.
 */

import fs from 'fs'

const REF_DIR = '/agent/workspace/hsk-data'
const TARGET_DIRS = ['words', 'mobile/assets/words']

const wid = (s, p) => s.trim() + '·' + String(p || '').toLowerCase().replace(/[\s'’ʼ]+/g, '')

// All simplified forms already present anywhere in hsk1..6.
const present = new Set()
for (let lvl = 1; lvl <= 6; lvl++) {
  for (const w of JSON.parse(fs.readFileSync(`words/hsk${lvl}.json`, 'utf8'))) {
    present.add(w.simplified.trim())
  }
}

let added = 0
for (let lvl = 1; lvl <= 6; lvl++) {
  const ref = fs
    .readFileSync(`${REF_DIR}/hsk20-ref-hskhsk-L${lvl}.txt`, 'utf8')
    .replace(/^﻿/, '')
    .split('\n')
  const extras = []
  for (const line of ref) {
    const cols = line.split('\t')
    const simplified = (cols[0] || '').trim()
    if (!simplified || present.has(simplified)) continue
    const traditional = (cols[1] || '').trim() || simplified
    const pinyin = (cols[3] || '').trim()
    const en = (cols[4] || '')
      .split(';')
      .map((x) => x.trim())
      .filter(Boolean)
      .slice(0, 8)
    if (!pinyin || en.length === 0) continue
    present.add(simplified)
    extras.push({
      simplified,
      traditional,
      pinyin,
      definitions: en,
      translations: { en },
      hsk: lvl,
    })
  }
  if (!extras.length) continue
  added += extras.length

  for (const dir of TARGET_DIRS) {
    const file = `${dir}/hsk${lvl}.json`
    const data = JSON.parse(fs.readFileSync(file, 'utf8'))
    const ids = new Set(data.map((w) => wid(w.simplified, w.pinyin)))
    for (const w of extras) {
      if (!ids.has(wid(w.simplified, w.pinyin))) data.push(w)
    }
    fs.writeFileSync(file, JSON.stringify(data))
  }
  console.log(`hsk${lvl}: +${extras.length} (${extras.slice(0, 5).map((w) => w.simplified).join(' ')}…)`)
}
console.log(`total added: ${added}`)
