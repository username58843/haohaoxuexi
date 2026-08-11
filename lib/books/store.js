/**
 * Client-side book storage (IndexedDB) — books never leave the device, which
 * keeps the Vercel backend feather-light. Only the tiny reading-progress
 * record syncs to the account (see /api/v1/books/progress).
 *
 * DB `hhx-books` v2:
 *   books — { id, title, author, script, type: 'txt'|'epub'|'pdf'|'builtin',
 *             mode: 'text'|'pdf', chapters: [{ title, text }],
 *             pageCount?, size, addedAt }
 *   blobs — { id, data: ArrayBuffer }  // raw PDF bytes for image-mode books
 *   kv    — { key, value, savedAt } (dictionary cache, misc)
 */

const DB_NAME = 'hhx-books'
const DB_VERSION = 2

let dbPromise = null

export function idbAvailable() {
  return typeof window !== 'undefined' && !!window.indexedDB
}

function openDb() {
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve, reject) => {
    const req = window.indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = (ev) => {
      const db = req.result
      if (!db.objectStoreNames.contains('books')) {
        db.createObjectStore('books', { keyPath: 'id' })
      }
      if (!db.objectStoreNames.contains('kv')) {
        db.createObjectStore('kv', { keyPath: 'key' })
      }
      // v2: separate blob store so listing books stays cheap
      if (!db.objectStoreNames.contains('blobs')) {
        db.createObjectStore('blobs', { keyPath: 'id' })
      }
      // Quiet unused param warning in some linters
      void ev
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => {
      dbPromise = null
      reject(req.error || new Error('indexeddb open failed'))
    }
  })
  return dbPromise
}

function tx(storeName, mode, fn) {
  return openDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const t = db.transaction(storeName, mode)
        const store = t.objectStore(storeName)
        const out = fn(store)
        t.oncomplete = () => resolve(out?.result !== undefined ? out.result : undefined)
        t.onerror = () => reject(t.error || new Error('indexeddb tx failed'))
        t.onabort = () => reject(t.error || new Error('indexeddb tx aborted'))
      })
  )
}

/** List book metadata (chapters stripped — cheap for the library grid). */
export async function listBooks() {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const t = db.transaction('books', 'readonly')
    const req = t.objectStore('books').getAll()
    req.onsuccess = () => {
      const items = (req.result || []).map(({ chapters, ...meta }) => ({
        ...meta,
        chapterCount: Array.isArray(chapters)
          ? chapters.length
          : meta.pageCount || 0,
      }))
      items.sort((a, b) => (b.addedAt || 0) - (a.addedAt || 0))
      resolve(items)
    }
    req.onerror = () => reject(req.error)
  })
}

export async function getBook(id) {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const t = db.transaction('books', 'readonly')
    const req = t.objectStore('books').get(id)
    req.onsuccess = () => resolve(req.result || null)
    req.onerror = () => reject(req.error)
  })
}

export function putBook(book) {
  // Never persist raw ArrayBuffers on the books row.
  const { pdfBytes, ...safe } = book
  void pdfBytes
  return tx('books', 'readwrite', (store) => store.put(safe))
}

export async function putBookWithBlob(book, arrayBuffer) {
  const { pdfBytes, ...safe } = book
  void pdfBytes
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const t = db.transaction(['books', 'blobs'], 'readwrite')
    t.objectStore('books').put({ ...safe, hasBlob: true, mode: safe.mode || 'pdf' })
    t.objectStore('blobs').put({ id: safe.id, data: arrayBuffer })
    t.oncomplete = () => resolve()
    t.onerror = () => reject(t.error || new Error('putBookWithBlob failed'))
  })
}

export async function getBookBlob(id) {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const t = db.transaction('blobs', 'readonly')
    const req = t.objectStore('blobs').get(id)
    req.onsuccess = () => resolve(req.result?.data || null)
    req.onerror = () => reject(req.error)
  })
}

export async function deleteBook(id) {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const stores = ['books']
    // blobs store only exists on v2+
    if (db.objectStoreNames.contains('blobs')) stores.push('blobs')
    const t = db.transaction(stores, 'readwrite')
    t.objectStore('books').delete(id)
    if (stores.includes('blobs')) t.objectStore('blobs').delete(id)
    t.oncomplete = () => resolve()
    t.onerror = () => reject(t.error || new Error('deleteBook failed'))
  })
}

export async function kvGet(key) {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const t = db.transaction('kv', 'readonly')
    const req = t.objectStore('kv').get(key)
    req.onsuccess = () => resolve(req.result || null)
    req.onerror = () => reject(req.error)
  })
}

export function kvSet(key, value) {
  return tx('kv', 'readwrite', (store) => store.put({ key, value, savedAt: Date.now() }))
}

/** Stable id for an uploaded file: name + size hash — dedupes re-uploads. */
export function makeBookId(name, size) {
  let hash = 5381
  const s = `${name}:${size}`
  for (let i = 0; i < s.length; i++) hash = ((hash << 5) + hash + s.charCodeAt(i)) >>> 0
  return `up-${hash.toString(36)}`
}
