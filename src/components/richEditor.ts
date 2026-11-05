/**
 * Conversión entre el texto con marcas (`form/richtext.ts`) y el HTML del editor visual.
 * El editor muestra negrita, cursiva, subrayado y listas reales; lo que se guarda es el texto
 * con marcas, que es lo que leen la vista de impresión, el PDF y el Word.
 */
import { BULLET, SQUARE, parseRich, type Run } from '../form/richtext'

const escapeHtml = (s: string): string => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

function runsToHtml(runs: Run[]): string {
  if (!runs.length) return '<br>'
  return runs
    .map((r) => {
      let h = escapeHtml(r.text)
      if (r.bold) h = `<b>${h}</b>`
      if (r.italic) h = `<i>${h}</i>`
      if (r.underline) h = `<u>${h}</u>`
      return h
    })
    .join('')
}

/** Texto con marcas → HTML para el editor (líneas en <div>, listas en <ul>/<ol>). */
export function markupToEditorHtml(text: string): string {
  const lines = parseRich(text)
  const out: string[] = []
  let open: 'bullet' | 'square' | 'number' | null = null
  const close = () => {
    if (open) out.push(open === 'number' ? '</ol>' : '</ul>')
    open = null
  }
  for (const l of lines) {
    const kind = l.marker ?? null
    if (kind !== open) {
      close()
      if (kind === 'number') out.push('<ol>')
      else if (kind === 'square') out.push('<ul data-square="1" style="list-style-type: square">')
      else if (kind === 'bullet') out.push('<ul>')
      open = kind
    }
    const body = runsToHtml(l.runs)
    out.push(kind ? `<li>${body}</li>` : `<div>${body}</div>`)
  }
  close()
  return out.join('')
}

interface Fmt {
  bold: boolean
  italic: boolean
  underline: boolean
}

interface LineRun extends Fmt {
  text: string
}

type Marker = 'bullet' | 'square' | 'number' | null

interface Line {
  marker: Marker
  number: number
  runs: LineRun[]
}

const BLOCK_TAGS = new Set(['DIV', 'P', 'LI', 'UL', 'OL', 'BLOCKQUOTE', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'TR', 'TABLE'])

/** HTML del editor → texto con marcas. */
export function editorHtmlToMarkup(root: HTMLElement): string {
  const lines: Line[] = []
  let cur: Line | null = null
  const ctxList: { marker: Marker; count: number }[] = []

  const ensureLine = (): Line => {
    if (!cur) {
      const top = ctxList[ctxList.length - 1]
      const number = top?.marker === 'number' ? ++top.count : 0
      cur = { marker: top?.marker ?? null, number, runs: [] }
      lines.push(cur)
    }
    return cur
  }
  const endLine = () => {
    cur = null
  }

  const walk = (node: Node, fmt: Fmt) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = (node.textContent ?? '').replace(/ /g, ' ').replace(/[\r\n]+/g, ' ')
      if (!text) return
      ensureLine().runs.push({ text, ...fmt })
      return
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return
    const el = node as HTMLElement
    const tag = el.tagName
    if (tag === 'BR') {
      // <br> dentro de una línea vacía la mantiene; en medio de texto termina la línea
      ensureLine()
      endLine()
      return
    }
    if (tag === 'UL' || tag === 'OL') {
      endLine()
      const marker: Marker = tag === 'OL' ? 'number' : el.dataset.square === '1' || /square/.test(el.style.listStyleType) ? 'square' : 'bullet'
      ctxList.push({ marker, count: 0 })
      el.childNodes.forEach((c) => walk(c, fmt))
      ctxList.pop()
      endLine()
      return
    }
    const style = el.style
    const next: Fmt = {
      bold: fmt.bold || tag === 'B' || tag === 'STRONG' || /^(bold|[6-9]00)$/.test(style.fontWeight),
      italic: fmt.italic || tag === 'I' || tag === 'EM' || style.fontStyle === 'italic',
      underline: fmt.underline || tag === 'U' || /underline/.test(style.textDecoration || style.textDecorationLine),
    }
    const block = BLOCK_TAGS.has(tag)
    if (block) endLine()
    if (tag === 'LI') ensureLine()
    el.childNodes.forEach((c) => walk(c, next))
    if (block) endLine()
  }
  root.childNodes.forEach((c) => walk(c, { bold: false, italic: false, underline: false }))

  return lines.map(serializeLine).join('\n').replace(/\n+$/, '')
}

function serializeLine(line: Line): string {
  // Unir tramos contiguos con el mismo formato
  const merged: LineRun[] = []
  for (const r of line.runs) {
    const last = merged[merged.length - 1]
    if (last && last.bold === r.bold && last.italic === r.italic && last.underline === r.underline) last.text += r.text
    else merged.push({ ...r })
  }
  const body = merged
    .map((r) => {
      // Los espacios de los extremos quedan fuera de las marcas
      const m = /^(\s*)(.*?)(\s*)$/s.exec(r.text)!
      let core = m[2]
      if (!core) return r.text
      if (r.underline) core = `__${core}__`
      if (r.italic) core = `*${core}*`
      if (r.bold) core = `**${core}**`
      return m[1] + core + m[3]
    })
    .join('')
  const prefix = line.marker === 'number' ? `${line.number}. ` : line.marker === 'square' ? `${SQUARE} ` : line.marker === 'bullet' ? `${BULLET} ` : ''
  return prefix + body
}
