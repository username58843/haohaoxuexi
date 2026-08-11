/**
 * Book parsers — everything runs in the browser, nothing touches the server.
 * All formats normalize to: { title, author, chapters: [{ title, text }], mode? }.
 *
 * Heavy libraries are vendored same-origin (public/vendor) and lazy-loaded:
 *   EPUB → JSZip
 *   PDF  → pdf.js (text extraction; CMaps from CDN for CJK fonts)
 * Scanned/image PDFs fall back to mode: 'pdf' (page canvas viewer).
 */

const JSZIP_SRC = '/vendor/jszip-3.10.1.min.js'
const PDFJS_SRC = '/vendor/pdfjs/pdf.min.mjs'
const PDFJS_WORKER_SRC = '/vendor/pdfjs/pdf.worker.min.mjs'
// CMaps are large; load from CDN at runtime so Chinese text-layer PDFs extract.
// Prefer same-origin vendor path first (if deployed), then jsDelivr.
const PDFJS_CMAP_URLS = [
  '/vendor/pdfjs/cmaps/',
  'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.49.0/cmaps/',
  'https://unpkg.com/pdfjs-dist@3.49.0/cmaps/',
]
const PDFJS_STANDARD_FONT_URLS = [
  '/vendor/pdfjs/standard_fonts/',
  'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.49.0/standard_fonts/',
  'https://unpkg.com/pdfjs-dist@3.49.0/standard_fonts/',
]

const MAX_CHAPTER_CHARS = 12000
const FALLBACK_CHUNK = 5000
// Soft floor: below this we still try, but may offer image-mode fallback.
const MIN_TEXT_CHARS = 40
// If a multi-page PDF yields almost nothing, treat as scanned.
const SCAN_RATIO = 8 // chars per page average

const CHAPTER_RE = /^第[0-9〇零一二三四五六七八九十百千两兩]+[章回节節卷篇集部].{0,40}$/
const SECONDARY_RE =
  /^(序章?|前言|引子|楔子|后记|後記|尾声|尾聲|目录|目錄|番外.{0,20}|卷[0-9〇零一二三四五六七八九十百千兩]+.{0,30})$/
// Western / mixed headings on their own short line
const WESTERN_HEADING_RE =
  /^(chapter|part|section|book|prologue|epilogue|appendix|前言|序|后记)\b.{0,50}$/i

let jszipPromise = null
function loadJsZip() {
  if (typeof window === 'undefined') return Promise.reject(new Error('ssr'))
  if (window.JSZip) return Promise.resolve(window.JSZip)
  if (!jszipPromise) {
    jszipPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script')
      script.src = JSZIP_SRC
      script.onload = () => resolve(window.JSZip)
      script.onerror = () => {
        jszipPromise = null
        reject(new Error('failed to load jszip'))
      }
      document.head.appendChild(script)
    })
  }
  return jszipPromise
}

let pdfjsPromise = null
export function loadPdfJs() {
  if (typeof window === 'undefined') return Promise.reject(new Error('ssr'))
  if (!pdfjsPromise) {
    pdfjsPromise = import(/* webpackIgnore: true */ PDFJS_SRC).then((mod) => {
      const pdfjs = mod.default || mod
      pdfjs.GlobalWorkerOptions.workerSrc = PDFJS_WORKER_SRC
      return pdfjs
    })
    pdfjsPromise.catch(() => {
      pdfjsPromise = null
    })
  }
  return pdfjsPromise
}

function splitOversized(chapters) {
  const out = []
  for (const ch of chapters) {
    if (ch.text.length <= MAX_CHAPTER_CHARS) {
      out.push(ch)
      continue
    }
    const paras = ch.text.split('\n')
    let buf = []
    let size = 0
    let part = 1
    for (const p of paras) {
      buf.push(p)
      size += p.length + 1
      if (size >= MAX_CHAPTER_CHARS) {
        out.push({ title: part === 1 ? ch.title : `${ch.title} · ${part}`, text: buf.join('\n') })
        buf = []
        size = 0
        part += 1
      }
    }
    if (buf.length) {
      out.push({ title: part === 1 ? ch.title : `${ch.title} · ${part}`, text: buf.join('\n') })
    }
  }
  return out
}

function normalizeText(raw) {
  return String(raw || '')
    .replace(/^\uFEFF/, '')
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t\u3000]+$/gm, '')
}

function isHeadingLine(line) {
  if (!line || line.length === 0 || line.length > 60) return false
  return CHAPTER_RE.test(line) || SECONDARY_RE.test(line) || WESTERN_HEADING_RE.test(line)
}

/** TXT → chapters by heading detection; falls back to fixed-size sections. */
export function parseTxt(rawText, { fileName = '' } = {}) {
  const text = normalizeText(rawText)
  const lines = text.split('\n')

  let title = ''
  let startIdx = 0
  const firstLine = (lines[0] || '').trim()
  if (firstLine && firstLine.length <= 30 && !isHeadingLine(firstLine)) {
    title = firstLine
    startIdx = 1
  }
  if (!title) title = fileName.replace(/\.[^.]+$/, '') || 'Untitled'

  const chapters = []
  let current = { title: '', lines: [] }
  const push = () => {
    const body = current.lines.join('\n').trim()
    if (body || current.title) chapters.push({ title: current.title, text: body })
  }
  for (let i = startIdx; i < lines.length; i++) {
    const line = lines[i].trim()
    if (isHeadingLine(line)) {
      push()
      current = { title: line, lines: [] }
    } else if (line) {
      current.lines.push(line)
    }
  }
  push()

  if (chapters.length <= 1) {
    const body = chapters[0]?.text || text
    if (body.length > FALLBACK_CHUNK * 1.5) {
      const paras = body.split('\n')
      const sections = []
      let buf = []
      let size = 0
      for (const p of paras) {
        buf.push(p)
        size += p.length + 1
        if (size >= FALLBACK_CHUNK) {
          sections.push({ title: `${sections.length + 1}`, text: buf.join('\n') })
          buf = []
          size = 0
        }
      }
      if (buf.length) sections.push({ title: `${sections.length + 1}`, text: buf.join('\n') })
      return { title, author: '', chapters: splitOversized(sections), mode: 'text' }
    }
    return {
      title,
      author: '',
      chapters: [{ title: chapters[0]?.title || title, text: body }],
      mode: 'text',
    }
  }
  return { title, author: '', chapters: splitOversized(chapters), mode: 'text' }
}

function htmlToText(html) {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  doc.querySelectorAll('script,style,head').forEach((n) => n.remove())
  const blocks = []
  const BLOCK_TAGS = new Set([
    'P',
    'DIV',
    'H1',
    'H2',
    'H3',
    'H4',
    'H5',
    'H6',
    'LI',
    'BLOCKQUOTE',
    'BR',
    'TR',
  ])
  const walk = (node) => {
    for (const child of node.childNodes) {
      if (child.nodeType === 3) {
        blocks.push(child.textContent)
      } else if (child.nodeType === 1) {
        walk(child)
        if (BLOCK_TAGS.has(child.tagName)) blocks.push('\n')
      }
    }
  }
  walk(doc.body || doc)
  return blocks
    .join('')
    .split('\n')
    .map((l) => l.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join('\n')
}

/** EPUB → spine-ordered XHTML files, one chapter per spine item. */
export async function parseEpub(arrayBuffer, { fileName = '' } = {}) {
  const JSZip = await loadJsZip()
  const zip = await JSZip.loadAsync(arrayBuffer)

  const containerXml = await zip.file('META-INF/container.xml')?.async('string')
  if (!containerXml) throw new Error('not an epub: container.xml missing')
  const container = new DOMParser().parseFromString(containerXml, 'application/xml')
  const opfPath = container.querySelector('rootfile')?.getAttribute('full-path')
  if (!opfPath || !zip.file(opfPath)) throw new Error('not an epub: opf missing')

  const opfXml = await zip.file(opfPath).async('string')
  const opf = new DOMParser().parseFromString(opfXml, 'application/xml')
  const opfDir = opfPath.includes('/') ? opfPath.slice(0, opfPath.lastIndexOf('/') + 1) : ''

  const title =
    opf.getElementsByTagName('dc:title')[0]?.textContent?.trim() ||
    fileName.replace(/\.[^.]+$/, '') ||
    'Untitled'
  const author = opf.getElementsByTagName('dc:creator')[0]?.textContent?.trim() || ''

  const manifest = new Map()
  for (const item of opf.querySelectorAll('manifest > item')) {
    manifest.set(item.getAttribute('id'), {
      href: item.getAttribute('href'),
      type: item.getAttribute('media-type') || '',
    })
  }

  const resolvePath = (href) => {
    const parts = (opfDir + href).split('/')
    const out = []
    for (const p of parts) {
      if (p === '..') out.pop()
      else if (p !== '.' && p !== '') out.push(p)
    }
    return out.join('/')
  }

  const chapters = []
  for (const ref of opf.querySelectorAll('spine > itemref')) {
    const item = manifest.get(ref.getAttribute('idref'))
    if (!item || !/xhtml|html|xml/.test(item.type)) continue
    const file = zip.file(resolvePath(item.href))
    if (!file) continue
    const html = await file.async('string')
    const text = htmlToText(html)
    if (!text.trim()) continue
    const firstLine = text.split('\n', 1)[0].trim()
    const chapterTitle =
      firstLine && firstLine.length <= 60 ? firstLine : `${chapters.length + 1}`
    chapters.push({ title: chapterTitle, text })
  }
  if (chapters.length === 0) throw new Error('epub has no readable chapters')
  return { title, author, chapters: splitOversized(chapters), mode: 'text' }
}

/**
 * Build a pdf.js getDocument payload that works for CJK fonts.
 * Tries local vendor CMaps first, falls back to CDN (browser-side only).
 */
function pdfDocOptions(data) {
  return {
    data,
    cMapUrl: PDFJS_CMAP_URLS[0],
    cMapPacked: true,
    standardFontDataUrl: PDFJS_STANDARD_FONT_URLS[0],
    useSystemFonts: true,
    disableFontFace: false,
    // Don't fail the whole doc if one font is missing.
    stopAtErrors: false,
    verbosity: 0,
  }
}

/**
 * Extract plain text from one page, preserving rough line breaks via Y positions.
 */
async function extractPageText(page) {
  const content = await page.getTextContent({ includeMarkedContent: true })
  let text = ''
  let lastY = null
  let lastX = null
  for (const item of content.items) {
    if (typeof item.str !== 'string') continue
    const str = item.str
    if (!str) continue
    const y = item.transform?.[5]
    const x = item.transform?.[4]
    if (lastY !== null && y !== undefined && Math.abs(y - lastY) > 3) {
      text += '\n'
      lastX = null
    } else if (
      lastX !== null &&
      x !== undefined &&
      item.width !== undefined &&
      x - lastX > (item.height || 10) * 0.35
    ) {
      // Large horizontal gap → space (helps Latin PDFs; harmless for CJK)
      if (!/\s$/.test(text) && !/^\s/.test(str)) text += ' '
    }
    text += str
    if (item.hasEOL) text += '\n'
    if (y !== undefined) lastY = y
    if (x !== undefined) lastX = x + (item.width || 0)
  }
  return text
    .split('\n')
    .map((l) => l.replace(/[ \t\u3000]+/g, (m) => (m.length > 1 ? ' ' : m)).trim())
    .filter(Boolean)
    .join('\n')
}

function chaptersFromPageTexts(pageTexts) {
  const chapters = []
  let current = { title: '1', pages: [] }
  const push = () => {
    const text = current.pages.join('\n').trim()
    if (text) chapters.push({ title: current.title, text })
  }
  for (const pageText of pageTexts) {
    if (!pageText) {
      current.pages.push('')
      continue
    }
    const firstLine = (pageText.split('\n', 1)[0] || '').trim()
    if (isHeadingLine(firstLine) && current.pages.some((p) => p.trim())) {
      push()
      current = { title: firstLine, pages: [] }
    }
    current.pages.push(pageText)
    // Cap chapter size so huge PDFs stay scrollable.
    const joined = current.pages.join('\n')
    if (joined.length >= MAX_CHAPTER_CHARS && !isHeadingLine(firstLine)) {
      push()
      current = { title: `${chapters.length + 1}`, pages: [] }
    } else if (current.pages.length >= 16 && !isHeadingLine(firstLine)) {
      push()
      current = { title: `${chapters.length + 1}`, pages: [] }
    }
  }
  push()
  if (chapters.length === 0) {
    const body = pageTexts.filter(Boolean).join('\n')
    if (body) chapters.push({ title: '1', text: body })
  }
  return splitOversized(chapters)
}

/**
 * PDF → text chapters when a text layer exists (with CJK CMap support).
 * Returns mode: 'pdf' + pageCount when the file is scanned / image-only so the
 * reader can show page canvases instead of failing hard.
 *
 * onProgress?: (done, total) => void
 */
export async function parsePdf(arrayBuffer, { fileName = '', onProgress } = {}) {
  const pdfjs = await loadPdfJs()
  // Copy buffer — pdf.js may transfer/detach the original ArrayBuffer.
  const data = arrayBuffer instanceof ArrayBuffer ? arrayBuffer.slice(0) : arrayBuffer
  let doc
  let lastErr
  // Retry with alternate CMap CDNs if the local path 404s.
  for (let i = 0; i < PDFJS_CMAP_URLS.length; i++) {
    try {
      const opts = pdfDocOptions(data instanceof ArrayBuffer ? data.slice(0) : data)
      opts.cMapUrl = PDFJS_CMAP_URLS[i]
      opts.standardFontDataUrl = PDFJS_STANDARD_FONT_URLS[Math.min(i, PDFJS_STANDARD_FONT_URLS.length - 1)]
      doc = await pdfjs.getDocument(opts).promise
      lastErr = null
      break
    } catch (err) {
      lastErr = err
    }
  }
  if (!doc) {
    const msg = String(lastErr?.message || lastErr || 'pdf_open_failed')
    if (/password|encrypted/i.test(msg)) throw new Error('pdf_encrypted')
    throw new Error('pdf_open_failed')
  }

  let title = fileName.replace(/\.[^.]+$/, '') || 'PDF'
  let author = ''
  try {
    const meta = await doc.getMetadata()
    const t = meta?.info?.Title
    const a = meta?.info?.Author
    if (typeof t === 'string' && t.trim() && t.trim().length <= 120) title = t.trim()
    if (typeof a === 'string' && a.trim()) author = a.trim().slice(0, 120)
  } catch {
    // metadata optional
  }

  const pageTexts = []
  const totalPages = doc.numPages
  for (let p = 1; p <= totalPages; p++) {
    try {
      const page = await doc.getPage(p)
      const text = await extractPageText(page)
      pageTexts.push(text)
      page.cleanup()
    } catch {
      pageTexts.push('')
    }
    onProgress?.(p, totalPages)
  }
  await doc.destroy()

  const joined = pageTexts.join('')
  const total = joined.replace(/\s/g, '').length
  const perPage = totalPages > 0 ? total / totalPages : 0

  // Enough extractable text → normal dictionary reader.
  if (total >= MIN_TEXT_CHARS && perPage >= SCAN_RATIO) {
    return {
      title,
      author,
      chapters: chaptersFromPageTexts(pageTexts),
      mode: 'text',
      pageCount: totalPages,
    }
  }

  // Sparse but non-empty: still offer text if there's something useful.
  if (total >= MIN_TEXT_CHARS) {
    return {
      title,
      author,
      chapters: chaptersFromPageTexts(pageTexts),
      mode: 'text',
      pageCount: totalPages,
      sparseText: true,
    }
  }

  // Image-only / scanned PDF — keep bytes for canvas page viewer.
  return {
    title,
    author,
    chapters: [],
    mode: 'pdf',
    pageCount: totalPages,
    pdfBytes: data instanceof ArrayBuffer ? data : null,
  }
}

/** Dispatch by file extension / mime. */
export async function parseFile(file, { onProgress } = {}) {
  const name = file.name || 'book'
  const lower = name.toLowerCase()
  if (lower.endsWith('.epub') || file.type === 'application/epub+zip') {
    return parseEpub(await file.arrayBuffer(), { fileName: name })
  }
  if (lower.endsWith('.pdf') || file.type === 'application/pdf') {
    return parsePdf(await file.arrayBuffer(), { fileName: name, onProgress })
  }
  // Default: treat as UTF-8 text (also covers .txt / .md / .text).
  return parseTxt(await file.text(), { fileName: name })
}
