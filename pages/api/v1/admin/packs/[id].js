import { createApiHandler, errors } from '~/lib/server/api'
import { objectBody, str, optStr, optArr, ValidationError } from '~/lib/server/validate'
import {
  getPacks,
  getPackWordsResolved,
  getPackOverrideDoc,
  isTextbookPack,
  invalidatePackOverrides,
} from '~/lib/server/words'
import { getCollection } from '~/lib/server/db'
import { writeAuditLog } from '~/lib/server/users'

const MAX_WORDS = 5000
const MAX_DEF_LINES = 12

/** Validate one editor word into the stored override shape (§5 Word). */
function validateWord(raw, index) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new ValidationError(`words[${index}] must be an object`)
  }
  const field = (name) => `words[${index}].${name}`
  const lines = (value, name) => {
    const list = optArr(value, { field: field(name), max: MAX_DEF_LINES }) || []
    return list
      .map((d) => str(d, { field: field(name), max: 200 }))
      .filter(Boolean)
  }

  const word = {
    simplified: str(raw.simplified, { field: field('simplified'), min: 1, max: 200 }),
    traditional:
      optStr(raw.traditional, { field: field('traditional'), max: 200 }) || '',
    pinyin: optStr(raw.pinyin, { field: field('pinyin'), max: 200 }) || '',
    definitions: lines(raw.definitions, 'definitions'),
  }
  const en = raw.translations ? lines(raw.translations.en, 'translations.en') : []
  const ru = raw.translations ? lines(raw.translations.ru, 'translations.ru') : []
  const tk = raw.translations ? lines(raw.translations.tk, 'translations.tk') : []
  if (en.length || ru.length || tk.length) {
    word.translations = {}
    if (en.length) word.translations.en = en
    if (ru.length) word.translations.ru = ru
    if (tk.length) word.translations.tk = tk
  }
  if (word.definitions.length === 0 && !en.length && !ru.length && !tk.length) {
    throw new ValidationError(`words[${index}] needs at least one meaning line`)
  }
  return word
}

function assertEditable(id) {
  const pack = getPacks().find((p) => p.id === id)
  if (!pack) throw errors.notFound('Unknown pack')
  if (!isTextbookPack(id)) {
    throw errors.forbidden('HSK packs are read-only — only textbook packs can be edited')
  }
  return pack
}

/**
 * Admin editor for one textbook pack:
 *  GET    → current (override-resolved) title + words, plus override status.
 *  PUT    → { title?, words? } upserts the override (either field optional).
 *  DELETE → removes the override, restoring the shipped JSON file.
 */
export default createApiHandler({
  GET: {
    admin: true,
    handler: async (req, res) => {
      const id = str(req.query.id, { field: 'id', min: 1, max: 40 })
      const pack = getPacks().find((p) => p.id === id)
      if (!pack) throw errors.notFound('Unknown pack')
      const override = await getPackOverrideDoc(id)
      const words = (await getPackWordsResolved(id)) || []
      res.status(200).json({
        pack: {
          id: pack.id,
          group: pack.group,
          editable: isTextbookPack(id),
          defaultTitle: pack.title,
          title: (override?.title && String(override.title).trim()) || pack.title,
          titleOverridden: !!(override?.title && String(override.title).trim()),
          wordsOverridden: Array.isArray(override?.words),
          updatedAt: override?.updatedAt || null,
          words,
        },
      })
    },
  },
  PUT: {
    admin: true,
    handler: async (req, res) => {
      const id = str(req.query.id, { field: 'id', min: 1, max: 40 })
      assertEditable(id)
      const body = objectBody(req.body)

      const set = { updatedAt: new Date(), updatedBy: req.userId }
      let titleChanged = false
      let wordsChanged = false

      if (body.title !== undefined) {
        set.title = str(body.title, { field: 'title', min: 1, max: 80 })
        titleChanged = true
      }
      if (body.words !== undefined) {
        const rawWords = optArr(body.words, { field: 'words', max: MAX_WORDS }) || []
        if (rawWords.length === 0) {
          throw new ValidationError('words must contain at least one word')
        }
        set.words = rawWords.map(validateWord)
        wordsChanged = true
      }
      if (!titleChanged && !wordsChanged) {
        throw new ValidationError('Nothing to update — provide title and/or words')
      }

      const col = await getCollection('pack_overrides')
      await col.updateOne({ packId: id }, { $set: set }, { upsert: true })
      invalidatePackOverrides()

      await writeAuditLog(req.userId, 'pack.update', {
        detail: {
          packId: id,
          title: titleChanged ? set.title : undefined,
          wordCount: wordsChanged ? set.words.length : undefined,
        },
      })
      res.status(200).json({ ok: true })
    },
  },
  DELETE: {
    admin: true,
    handler: async (req, res) => {
      const id = str(req.query.id, { field: 'id', min: 1, max: 40 })
      assertEditable(id)
      const col = await getCollection('pack_overrides')
      const { deletedCount } = await col.deleteOne({ packId: id })
      invalidatePackOverrides()
      await writeAuditLog(req.userId, 'pack.reset', { detail: { packId: id } })
      res.status(200).json({ ok: true, removed: deletedCount > 0 })
    },
  },
})
