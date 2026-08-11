import { ValidationError } from './validate'

/**
 * Notes model helpers — validation for the Notesnook-style notes feature.
 *
 * A note's rich content is a ProseMirror/TipTap JSON document stored as-is
 * (never rendered as raw HTML anywhere — the client renders it exclusively
 * through the TipTap editor, so there is no XSS surface). The server still
 * hard-validates shape, size and Mongo-safety before persisting.
 */

export const NOTE_LIMITS = {
  maxNotes: 5000,
  maxNotebooks: 100,
  titleLen: 200,
  headlineLen: 300,
  tagLen: 30,
  maxTags: 20,
  contentBytes: 300 * 1024, // 300 KB of JSON per note
  maxNodes: 20000,
  maxDepth: 60,
  notebookNameLen: 80,
  notebookDescLen: 300,
  trashRetentionDays: 30,
}

/** Reject Mongo-operator keys anywhere inside user-supplied JSON. */
function assertMongoSafe(value, depth, state) {
  if (depth > NOTE_LIMITS.maxDepth) throw new ValidationError('Note content is nested too deeply')
  if (Array.isArray(value)) {
    for (const item of value) assertMongoSafe(item, depth + 1, state)
    return
  }
  if (value && typeof value === 'object') {
    state.nodes += 1
    if (state.nodes > NOTE_LIMITS.maxNodes) throw new ValidationError('Note content has too many nodes')
    for (const key of Object.keys(value)) {
      if (key.startsWith('$') || key.includes('.')) {
        throw new ValidationError('Note content contains invalid keys')
      }
      assertMongoSafe(value[key], depth + 1, state)
    }
  }
}

/** Validates TipTap JSON content. Returns the content object (or null). */
export function validateNoteContent(content) {
  if (content == null) return null
  if (typeof content !== 'object' || Array.isArray(content)) {
    throw new ValidationError('content must be an object')
  }
  if (content.type !== 'doc') throw new ValidationError('content must be a doc node')
  let json
  try {
    json = JSON.stringify(content)
  } catch {
    throw new ValidationError('content must be serializable')
  }
  if (Buffer.byteLength(json, 'utf8') > NOTE_LIMITS.contentBytes) {
    throw new ValidationError('Note is too large (300 KB max)')
  }
  assertMongoSafe(content, 0, { nodes: 0 })
  return content
}

/** Plain-text preview extracted server-side from TipTap JSON. */
export function extractHeadline(content) {
  if (!content || typeof content !== 'object') return ''
  const out = []
  let length = 0
  const walk = (node, depth) => {
    if (!node || typeof node !== 'object' || depth > NOTE_LIMITS.maxDepth) return
    if (length >= NOTE_LIMITS.headlineLen) return
    if (typeof node.text === 'string') {
      out.push(node.text)
      length += node.text.length
      return
    }
    const children = Array.isArray(node.content) ? node.content : []
    for (const child of children) {
      if (length >= NOTE_LIMITS.headlineLen) break
      walk(child, depth + 1)
      // block boundary → space
      if (typeof child === 'object' && child && !child.text) {
        out.push(' ')
        length += 1
      }
    }
  }
  walk(content, 0)
  return out.join('').replace(/\s+/g, ' ').trim().slice(0, NOTE_LIMITS.headlineLen)
}

export function validateTitle(title) {
  if (title == null) return ''
  if (typeof title !== 'string') throw new ValidationError('title must be a string')
  return title.slice(0, NOTE_LIMITS.titleLen)
}

export function validateTags(tags) {
  if (tags == null) return []
  if (!Array.isArray(tags)) throw new ValidationError('tags must be an array')
  const clean = []
  const seen = new Set()
  for (const raw of tags) {
    if (typeof raw !== 'string') throw new ValidationError('tags must be strings')
    const tag = raw.trim().replace(/^#/, '').slice(0, NOTE_LIMITS.tagLen)
    if (!tag) continue
    const key = tag.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    clean.push(tag)
    if (clean.length >= NOTE_LIMITS.maxTags) break
  }
  return clean
}

export function validateNotebookName(name) {
  if (typeof name !== 'string' || !name.trim()) throw new ValidationError('name is required')
  if (name.trim().length > NOTE_LIMITS.notebookNameLen) {
    throw new ValidationError(`name must be at most ${NOTE_LIMITS.notebookNameLen} characters`)
  }
  return name.trim()
}

export function validateNotebookDescription(description) {
  if (description == null) return ''
  if (typeof description !== 'string') throw new ValidationError('description must be a string')
  return description.trim().slice(0, NOTE_LIMITS.notebookDescLen)
}

/** Public list shape — metadata only, content stays out of list payloads. */
export function toNoteMeta(doc) {
  return {
    id: doc._id.toString(),
    title: doc.title || '',
    headline: doc.headline || '',
    notebookId: doc.notebookId ? doc.notebookId.toString() : null,
    tags: doc.tags || [],
    pinned: !!doc.pinned,
    favorite: !!doc.favorite,
    archived: !!doc.archived,
    trashed: !!doc.trashed,
    deletedAt: doc.deletedAt || null,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  }
}

export function toNoteFull(doc) {
  return { ...toNoteMeta(doc), content: doc.content || null }
}

export function toNotebookShape(doc) {
  return {
    id: doc._id.toString(),
    name: doc.name,
    description: doc.description || '',
    order: doc.order || 0,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  }
}
