/**
 * Tiny, dependency-free Markdown → safe HTML renderer for CMS document bodies.
 * Supports: # h1..### h3, paragraphs, - / * bullet lists, 1. ordered lists,
 * **bold**, *italic*, `code`, [text](https://…) links, and blank-line breaks.
 * All text is HTML-escaped first, so stored content can never inject markup.
 */

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function inline(text) {
  let out = escapeHtml(text)
  // links [label](url) — only http(s)/mailto
  out = out.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+|mailto:[^\s)]+)\)/g, (m, label, url) => {
    const safeUrl = url.replace(/"/g, '')
    return `<a href="${safeUrl}" rel="noopener noreferrer">${label}</a>`
  })
  out = out.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
  out = out.replace(/(^|[^*])\*([^*]+)\*/g, '$1<em>$2</em>')
  out = out.replace(/`([^`]+)`/g, '<code>$1</code>')
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
