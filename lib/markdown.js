/**
 * Tiny, dependency-free Markdown → safe HTML renderer for CMS document bodies.
 * Supports: # h1..### h3, paragraphs, - / * bullet lists, 1. ordered lists,
 * **bold**, *italic*, `code`, [text](https://…) links, and blank-line breaks.
 * All text is HTML-escaped first, so stored content can never inject markup.
 */

function escapeHtml(s) {
  return String(s)
    .replace(/\u0000/g, '') // NUL is our internal placeholder marker — never user content
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** Bold / italic / inline-code substitutions over already-escaped text. */
function formatSpans(s) {
  return s
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*]+)\*/g, '$1<em>$2</em>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
}

function inline(text) {
  let out = escapeHtml(text)
  // Pass 1: extract links [label](url) — only http(s)/mailto — into an opaque
  // placeholder table, so the formatting regexes below can never swallow the
  // generated `<a href="…">` markup (e.g. a `**` inside a URL).
  const links = []
  out = out.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+|mailto:[^\s)]+)\)/g, (m, label, url) => {
    const safeUrl = url.replace(/"/g, '')
    links.push(`<a href="${safeUrl}" rel="noopener noreferrer">${formatSpans(label)}</a>`)
    return `\u0000${links.length - 1}\u0000`
  })
  // Pass 2: formatting over the remaining text, then restore the links.
  out = formatSpans(out)
  out = out.replace(/\u0000(\d+)\u0000/g, (m, i) => links[Number(i)] || '')
  return out
}

export function markdownToHtml(md) {
  const lines = String(md || '').replace(/\r\n/g, '\n').split('\n')
  const html = []
  let list = null // 'ul' | 'ol' | null
  let para = []

  const flushPara = () => {
    if (para.length) {
      html.push(`<p>${inline(para.join(' '))}</p>`)
      para = []
    }
  }
  const flushList = () => {
    if (list) {
      html.push(`</${list}>`)
      list = null
    }
  }

  for (const raw of lines) {
    const line = raw.trimEnd()
    if (!line.trim()) {
      flushPara()
      flushList()
      continue
    }
    const h = /^(#{1,3})\s+(.*)$/.exec(line)
    if (h) {
      flushPara()
      flushList()
      const level = h[1].length
      html.push(`<h${level}>${inline(h[2])}</h${level}>`)
      continue
    }
    const ul = /^[-*]\s+(.*)$/.exec(line)
    const ol = /^\d+\.\s+(.*)$/.exec(line)
    if (ul || ol) {
      flushPara()
      const want = ul ? 'ul' : 'ol'
      if (list !== want) {
        flushList()
        html.push(`<${want}>`)
        list = want
      }
      html.push(`<li>${inline((ul || ol)[1])}</li>`)
      continue
    }
    flushList()
    para.push(line.trim())
  }
  flushPara()
  flushList()
  return html.join('\n')
}
