/**
 * Texto con formato (negrita, cursiva, subrayado, viñetas, numeración) y justificado para pdf-lib.
 * Interpreta las marcas de `form/richtext.ts`.
 */
import type { PDFFont, RGB } from 'pdf-lib'
import { parseRich, type Run } from '../form/richtext'
import { INK, sanitize, type FlowDocument, type Fonts } from './engine'

interface Piece {
  text: string
  font: PDFFont
  underline: boolean
  width: number
}

interface Word {
  pieces: Piece[]
  width: number
}

export interface RichWrappedLine {
  words: Word[]
  /** Sangría de la línea (listas: sangría francesa) */
  x: number
  /** Distribuir el espacio sobrante entre palabras */
  justify: boolean
  marker?: { text: string; square: boolean }
}

export interface RichWrapOptions {
  /** Viñeta en las líneas que no traen marcador */
  autoBullet?: boolean
  /** Justificar (por defecto sí) */
  justify?: boolean
}

const INDENT = 9

export function fontFor(fonts: Fonts, run: Pick<Run, 'bold' | 'italic'>): PDFFont {
  if (run.bold && run.italic) return fonts.boldItalic
  if (run.bold) return fonts.bold
  if (run.italic) return fonts.italic
  return fonts.regular
}

/** Divide los tramos con estilo en palabras (una palabra puede mezclar estilos). */
function toWords(runs: Run[], fonts: Fonts, size: number): Word[] {
  const words: Word[] = []
  let cur: Piece[] = []
  const flush = () => {
    if (cur.length) words.push({ pieces: cur, width: cur.reduce((a, p) => a + p.width, 0) })
    cur = []
  }
  for (const run of runs) {
    const font = fontFor(fonts, run)
    const parts = sanitize(run.text).split(/(\s+)/)
    for (const part of parts) {
      if (!part) continue
      if (/^\s+$/.test(part)) {
        flush()
        continue
      }
      cur.push({ text: part, font, underline: run.underline, width: font.widthOfTextAtSize(part, size) })
    }
  }
  flush()
  return words
}

/** Ajusta texto con formato a un ancho. */
export function wrapRich(fonts: Fonts, size: number, width: number, text: string, opts: RichWrapOptions = {}): RichWrappedLine[] {
  const out: RichWrappedLine[] = []
  const space = fonts.regular.widthOfTextAtSize(' ', size)
  const justify = opts.justify ?? true
  for (const line of parseRich(text)) {
    const words = toWords(line.runs, fonts, size)
    const markerText = line.markerText || (opts.autoBullet && words.length ? '•' : '')
    const marker = markerText ? { text: markerText, square: line.marker === 'square' } : undefined
    const indent = marker ? INDENT + (line.marker === 'number' ? fonts.regular.widthOfTextAtSize(markerText, size) : 0) : 0
    const avail = Math.max(10, width - indent)
    if (words.length === 0) {
      out.push({ words: [], x: 0, justify: false, marker })
      continue
    }
    let cur: Word[] = []
    let curW = 0
    let first = true
    const push = (last: boolean) => {
      out.push({ words: cur, x: indent, justify: justify && !last && cur.length > 1, marker: first ? marker : undefined })
      first = false
      cur = []
      curW = 0
    }
    for (const w of words) {
      // Palabra más ancha que la línea: partir por caracteres
      if (w.width > avail) {
        if (cur.length) push(false)
        for (const p of w.pieces) {
          let chunk = ''
          for (const ch of p.text) {
            const cw = p.font.widthOfTextAtSize(chunk + ch, size)
            if (cw > avail && chunk) {
              out.push({ words: [{ pieces: [{ ...p, text: chunk, width: p.font.widthOfTextAtSize(chunk, size) }], width: 0 }], x: indent, justify: false, marker: first ? marker : undefined })
              first = false
              chunk = ch
            } else chunk += ch
          }
          if (chunk) {
            const piece = { ...p, text: chunk, width: p.font.widthOfTextAtSize(chunk, size) }
            cur.push({ pieces: [piece], width: piece.width })
            curW = piece.width
          }
        }
        continue
      }
      const extra = cur.length ? space + w.width : w.width
      if (curW + extra <= avail) {
        cur.push(w)
        curW += extra
      } else {
        push(false)
        cur.push(w)
        curW = w.width
      }
    }
    push(true)
  }
  return out
}

/** Dibuja líneas con formato; devuelve la altura consumida. */
export function drawRich(doc: FlowDocument, lines: RichWrappedLine[], x: number, top: number, size: number, lineHeight: number, width: number, color: RGB = INK): number {
  const page = doc.page
  const space = doc.fonts.regular.widthOfTextAtSize(' ', size)
  const baseline = (yy: number) => yy - lineHeight * 0.76
  let yy = top
  for (const l of lines) {
    if (l.marker) {
      if (l.marker.square) {
        const s = size * 0.42
        page.drawRectangle({ x: x + 1.5, y: baseline(yy) + size * 0.22, width: s, height: s, color })
      } else {
        page.drawText(l.marker.text, { x, y: baseline(yy), size, font: doc.fonts.regular, color })
      }
    }
    const total = l.words.reduce((a, w) => a + w.width, 0)
    const gap = l.justify && l.words.length > 1 ? (width - l.x - total) / (l.words.length - 1) : space
    let xx = x + l.x
    for (const w of l.words) {
      for (const p of w.pieces) {
        page.drawText(p.text, { x: xx, y: baseline(yy), size, font: p.font, color })
        if (p.underline) {
          page.drawLine({ start: { x: xx, y: baseline(yy) - 1.2 }, end: { x: xx + p.width, y: baseline(yy) - 1.2 }, thickness: 0.5, color })
        }
        xx += p.width
      }
      xx += gap
    }
    yy -= lineHeight
  }
  return lines.length * lineHeight
}
