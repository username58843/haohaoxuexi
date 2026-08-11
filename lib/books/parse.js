/**
 * Book parsers — everything runs in the browser, nothing touches the server.
 * All formats normalize to: { title, author, chapters: [{ title, text }] }.
 *
 * Heavy libraries are vendored same-origin (public/vendor, project convention:
 * no third-party CDNs in authenticated sessions) and lazy-loaded on first use:
 *   EPUB → JSZip (an .epub is a zip of XHTML files read in spine order)
 *   PDF  → pdf.js (text extraction only — the reader renders its own text
 *          layer so the hover dictionary works exactly like in TXT/EPUB)
 */

const JSZIP_SRC = '/vendor/jszip-3.10.1.min.js'
const PDFJS_SRC = '/vendor/pdfjs/pdf.min.mjs'
const PDFJS_WORKER_SRC = '/vendor/pdfjs/pdf.worker.min.mjs'

const MAX_CHAPTER_CHARS = 12000 // oversized chapters split for smooth rendering
const FALLBACK_CHUNK = 5000 // when no headings are detected

// 第X章/回/节/卷/篇/集/部 (+ Arabic digits), or a short standalone heading line.
const CHAPTER_RE = /^第[0-9〇零一二三四五六七八九十百千两]+[章回节節卷篇集部].{0,40}$/
const SECONDARY_RE = /^(序章?|前言|引子|楔子|后记|後記|尾声|尾聲|番外.{0,20}|卷[0-9〇零一二三四五六七八九十百千]+.{0,30})$/

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
function loadPdfJs() {
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
    .replace(/^﻿/, '')
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t　]+$/gm, '')
}

/** TXT → chapters by heading detection; falls back to fixed-size sections. */
export function parseTxt(rawText, { fileName = '' } = {}) {
  const text = normalizeText(rawText)
  const lines = text.split('\n')

  // Title: an explicit short first line, else the file name.
  let title = ''
  let startIdx = 0
  const firstLine = (lines[0] || '').trim()
  if (firstLine && firstLine.length <= 30 && !CHAPTER_RE.test(firstLine)) {
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
    const isHeading =
      line.length > 0 &&
      line.length <= 60 &&
      (CHAPTER_RE.test(line) || SECONDARY_RE.test(line))
    if (isHeading) {
      push()
      current = { title: line, lines: [] }
    } else if (line) {
      current.lines.push(line)
    }
  }
  push()

  // No headings found → fixed-size sections so long files stay scrollable.
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
      return { title, author: '', chapters: splitOversized(sections) }
    }
    return { title, author: '', chapters: [{ title: chapters[0]?.title || title, text: body }] }
  }
  return { title, author: '', chapters: splitOversized(chapters) }
}

function htmlToText(html) {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  doc.querySelectorAll('script,style,head').forEach((n) => n.remove())
  const blocks = []
  const BLOCK_TAGS = new Set(['P', 'DIV', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'LI', 'BLOCKQUOTE', 'BR', 'TR'])
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
  return { title, author, chapters: splitOversized(chapters) }
}

/**
 * PDF → per-page text extraction, pages grouped into chapters at detected
 * 第X章 headings (or every ~12 pages). Scanned/image-only PDFs yield no text —
 * the caller shows a friendly "no text layer" error.
 */
export async function parsePdf(arrayBuffer, { fileName = '' } = {}) {
  const pdfjs = await loadPdfJs()
  const doc = await pdfjs.getDocument({ data: arrayBuffer }).promise

  let title = fileName.replace(/\.[^.]+$/, '') || 'PDF'
  try {
    const meta = await doc.getMetadata()
    const t = meta?.info?.Title
    if (typeof t === 'string' && t.trim() && t.trim().length <= 80) title = t.trim()
  } catch {
    // metadata is optional
  }

  const pageTexts = []
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p)
    const content = await page.getTextContent()
    let text = ''
    let lastY = null
    for (const item of content.items) {
      if (typeof item.str !== 'string') continue
      const y = item.transform?.[5]
      if (lastY !== null && y !== undefined && Math.abs(y - lastY) > 2) text += '\n'
      text += item.str
      if (item.hasEOL) text += '\n'
      if (y !== undefined) lastY = y
    }
    pageTexts.push(
      text
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean)
        .join('\n')
    )
    page.cleanup()
  }
  await doc.destroy()

  const total = pageTexts.join('').length
  if (total < 50) throw new Error('pdf_no_text')

  const chapters = []
  let current = { title: '1', pages: [] }
  const push = () => {
    const text = current.pages.join('\n').trim()
    if (text) chapters.push({ title: current.title, text })
  }
  for (const pageText of pageTexts) {
    const firstLine = pageText.split('\n', 1)[0] || ''
    if (CHAPTER_RE.test(firstLine.trim()) && current.pages.length > 0) {
      push()
      current = { title: firstLine.trim(), pages: [] }
    }
    current.pages.push(pageText)
    if (current.pages.length >= 12 && !CHAPTER_RE.test(firstLine.trim())) {
      push()
      current = { title: `${chapters.length + 1}`, pages: [] }
    }
  }
  push()

  return { title, author: '', chapters: splitOversized(chapters) }
}

/** Dispatch by file extension / mime. */
export async function parseFile(file) {
  const name = file.name || 'book'
  const lower = name.toLowerCase()
  if (lower.endsWith('.epub')) {
    return parseEpub(await file.arrayBuffer(), { fileName: name })
  }
  if (lower.endsWith('.pdf') || file.type === 'application/pdf') {
    return parsePdf(await file.arrayBuffer(), { fileName: name })
  }
  // Default: treat as UTF-8 text.
  return parseTxt(await file.text(), { fileName: name })
}
