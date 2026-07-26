import { getCollection } from './db'

/**
 * Editable content overrides (CMS). Each entry is keyed by (scope, key, lang):
 *   scope — a page/area, e.g. 'landing', 'privacy', 'terms', 'about'
 *   key   — a slot within that scope, e.g. 'heroTitle' or 'body'
 *   lang  — 'en' | 'ru' | 'tk' | 'zh'
 *   value — the override text (plain for inline slots, markdown for doc bodies)
 *
 * Pages ship hardcoded defaults; an override replaces the default only when
 * present, so the CMS is purely additive and safe to leave empty.
 */

export const CONTENT_LANGS = ['en', 'ru', 'tk', 'zh']

export function isContentLang(lang) {
  return CONTENT_LANGS.includes(lang)
}

/** All overrides for one language → { 'scope:key': value } (used by the client). */
export async function getContentBundle(lang) {
  const col = await getCollection('content')
  const rows = await col.find({ lang }).toArray()
  const out = {}
  for (const r of rows) out[`${r.scope}:${r.key}`] = r.value
  return out
}

/** Every override across all languages, grouped for the admin editor. */
export async function getAllContent() {
  const col = await getCollection('content')
  const rows = await col.find({}).sort({ scope: 1, key: 1, lang: 1 }).toArray()
  return rows.map((r) => ({
    scope: r.scope,
    key: r.key,
    lang: r.lang,
    value: r.value,
    updatedAt: r.updatedAt,
  }))
}

export async function setContentEntry({ scope, key, lang, value, actorId }) {
  const col = await getCollection('content')
  const now = new Date()
  const trimmed = typeof value === 'string' ? value : ''
  if (trimmed.length === 0) {
    // Empty value removes the override → page falls back to its default.
    await col.deleteOne({ scope, key, lang })
    return { removed: true }
  }
  await col.updateOne(
    { scope, key, lang },
    { $set: { scope, key, lang, value: trimmed, updatedAt: now, updatedBy: actorId } },
    { upsert: true }
  )
  return { removed: false }
}
