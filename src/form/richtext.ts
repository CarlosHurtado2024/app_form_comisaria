/**
 * Formato ligero para los cuadros de texto. Se guarda como texto plano con marcas:
 *   **negrita**   *cursiva*   __subrayado__
 *   "• " viñeta de punto, "▪ " viñeta cuadrada, "1. " numeración (al inicio de la línea).
 * El mismo texto se interpreta en la interfaz, en la vista de impresión y en el PDF directo.
 */

export interface Run {
  text: string
  bold: boolean
  italic: boolean
  underline: boolean
}

export type Marker = 'bullet' | 'square' | 'number'

export interface RichLine {
  marker?: Marker
  /** Texto del marcador tal como se muestra ("•", "▪", "3.") */
  markerText: string
  runs: Run[]
}

export const BULLET = '•'
export const SQUARE = '▪'

const MARKER_RE = /^\s*(?:([•▪■·\-*])|(\d{1,3})[.)])\s+/

/** Separa inicio de línea: marcador de lista y texto restante. */
export function splitMarker(line: string): { marker?: Marker; markerText: string; rest: string } {
  const m = MARKER_RE.exec(line)
  if (!m) return { markerText: '', rest: line }
  if (m[2]) return { marker: 'number', markerText: `${m[2]}.`, rest: line.slice(m[0].length) }
  const sym = m[1]
  const marker: Marker = sym === '▪' || sym === '■' ? 'square' : 'bullet'
  return { marker, markerText: marker === 'square' ? SQUARE : BULLET, rest: line.slice(m[0].length) }
}

/** Convierte las marcas en línea (**, *, __) en tramos con estilo. */
export function parseInline(text: string): Run[] {
  const runs: Run[] = []
  let bold = false
  let italic = false
  let underline = false
  let cur = ''
  const flush = () => {
    if (cur) runs.push({ text: cur, bold, italic, underline })
    cur = ''
  }
  for (let i = 0; i < text.length; i++) {
    const two = text.slice(i, i + 2)
    if (two === '**') {
      flush()
      bold = !bold
      i++
      continue
    }
    if (two === '__') {
      flush()
      underline = !underline
      i++
      continue
    }
    const ch = text[i]
    if (ch === '*' || ch === '_') {
      // Cursiva solo si abre pegada a texto (evita tomar un * suelto o guiones bajos de nombres)
      const prev = text[i - 1] ?? ' '
      const next = text[i + 1] ?? ' '
      const opens = !italic && /\S/.test(next) && !/[\wÀ-ÿ]/.test(prev)
      const closes = italic && /\S/.test(prev)
      if (opens || closes) {
        flush()
        italic = !italic
        continue
      }
    }
    cur += ch
  }
  flush()
  return runs
}

/** Interpreta un texto completo (líneas con marcadores y estilos en línea). */
export function parseRich(text: string): RichLine[] {
  return text
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line) => {
      const { marker, markerText, rest } = splitMarker(line)
      return { marker, markerText, runs: parseInline(rest) }
    })
}

/** Texto sin marcas (para vistas previas, búsquedas o conteos). */
export function plainText(text: string): string {
  return parseRich(text)
    .map((l) => (l.markerText ? `${l.markerText} ` : '') + l.runs.map((r) => r.text).join(''))
    .join('\n')
}

export const hasFormatting = (text: string): boolean => /\*\*|__|^\s*(?:[•▪■]|\d{1,3}[.)])\s/m.test(text)

const escapeHtml = (s: string): string => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

function runsToHtml(runs: Run[]): string {
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

/**
 * HTML del texto con formato. Cada línea es un bloque; las líneas con marcador llevan
 * sangría francesa (clase `li`) para que las viñetas y la numeración se vean alineadas.
 * `autoBullet` pone viñeta a las líneas que no tengan marcador (listas del formato).
 */
export function richToHtml(text: string, opts: { autoBullet?: boolean } = {}): string {
  const lines = parseRich(text)
  return lines
    .map((l) => {
      const body = runsToHtml(l.runs)
      const markerText = l.markerText || (opts.autoBullet && body.trim() ? BULLET : '')
      if (!markerText) return `<div class="rl">${body || '&nbsp;'}</div>`
      return `<div class="rl li"><span class="mk">${escapeHtml(markerText)}</span>${body || '&nbsp;'}</div>`
    })
    .join('')
}
