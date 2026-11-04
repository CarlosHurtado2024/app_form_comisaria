import type { PDFFont } from 'pdf-lib'
import {
  BAR_FILL,
  BAR_SOFT,
  CHECK,
  FlowDocument,
  INK,
  LINE_LABEL,
  LINE_VALUE,
  MUTED,
  PAD,
  SIZE_LABEL,
  SIZE_VALUE,
  formatDate,
  wrapText,
  type WrappedLine,
} from './engine'
import {
  asList,
  asRows,
  asString,
  type Block,
  type ChecksBlock,
  type FormData,
  type RadioBlock,
  type TableBlock,
  type TextAreaBlock,
  type YesNoBlock,
} from '../form/types'

/** Resultado de medir un bloque: altura total y datos precalculados para dibujarlo. */
interface Measured {
  h: number
  draw: (x: number, top: number, w: number, h: number) => void
}

const CHECK_GAP = 2.5
const GUTTER = 6

export class BlockRenderer {
  private readonly doc: FlowDocument
  private readonly data: FormData

  constructor(doc: FlowDocument, data: FormData) {
    this.doc = doc
    this.data = data
  }

  private get regular(): PDFFont {
    return this.doc.fonts.regular
  }
  private get bold(): PDFFont {
    return this.doc.fonts.bold
  }

  private labelLines(label: string, w: number): WrappedLine[] {
    return label ? wrapText(this.bold, SIZE_LABEL, w - 2 * PAD, label) : []
  }

  private valueLines(value: string, w: number, opts?: { bullets?: boolean }): WrappedLine[] {
    if (!value.trim()) return []
    return wrapText(this.regular, SIZE_VALUE, w - 2 * PAD, value, opts?.bullets ? { prefix: '• ', indent: 7 } : {})
  }

  // ---------- Medición + dibujo por tipo ----------

  measure(block: Block, w: number, inner = false): Measured {
    switch (block.type) {
      case 'note':
        return { h: 0, draw: () => undefined }
      case 'heading':
        return this.measureHeading(block.text, w, inner)
      case 'text':
      case 'select':
      case 'date': {
        const raw = asString(this.data[block.key])
        const value = block.type === 'date' ? formatDate(raw) : raw
        return this.measureSimple(block.label, value, w, inner)
      }
      case 'textarea':
        return this.measureTextArea(block, w, inner)
      case 'radio':
      case 'checks':
        return this.measureOptions(block, w, inner)
      case 'yesno':
        return this.measureYesNo(block, w, inner)
      case 'table':
        return this.measureTable(block, w)
      case 'row':
        return this.measureRow(block.items, block.widths, w, inner)
      case 'group':
        return this.measureGroup(block.label, block.items, w, inner)
    }
  }

  private measureHeading(text: string, w: number, inner: boolean): Measured {
    const lines = wrapText(this.bold, 7.2, w - 2 * PAD, text)
    const h = lines.length * LINE_LABEL + 4
    return {
      h,
      draw: (x, top) => {
        this.doc.box(x, top, w, h, inner ? BAR_SOFT : BAR_FILL)
        this.doc.lines(lines, x + PAD, top - 2, 7.2, this.bold, LINE_LABEL)
      },
    }
  }

  private measureSimple(label: string, value: string, w: number, inner: boolean): Measured {
    const ll = this.labelLines(label, w)
    const vl = this.valueLines(value, w)
    const h = PAD + ll.length * LINE_LABEL + Math.max(1, vl.length) * LINE_VALUE + PAD
    return {
      h,
      draw: (x, top, ww, hh) => {
        if (!inner) this.doc.box(x, top, ww, hh)
        let yy = top - PAD
        yy -= this.doc.lines(ll, x + PAD, yy, SIZE_LABEL, this.bold, LINE_LABEL)
        this.doc.lines(vl, x + PAD, yy, SIZE_VALUE, this.regular, LINE_VALUE)
      },
    }
  }

  private measureTextArea(block: TextAreaBlock, w: number, inner: boolean): Measured {
    const ll = this.labelLines(block.label, w)
    const vl = this.valueLines(asString(this.data[block.key]), w, { bullets: block.bullets })
    const minLines = Math.min(block.rows ?? 3, 3)
    const h = PAD + ll.length * LINE_LABEL + Math.max(minLines, vl.length) * LINE_VALUE + PAD
    return {
      h,
      draw: (x, top, ww, hh) => {
        if (!inner) this.doc.box(x, top, ww, hh)
        let yy = top - PAD
        yy -= this.doc.lines(ll, x + PAD, yy, SIZE_LABEL, this.bold, LINE_LABEL)
        this.doc.lines(vl, x + PAD, yy, SIZE_VALUE, this.regular, LINE_VALUE)
      },
    }
  }

  /**
   * Área de texto larga que puede partirse entre páginas.
   * Dibuja directamente en el flujo del documento.
   */
  flowTextArea(block: TextAreaBlock, w: number): void {
    const doc = this.doc
    const ll = this.labelLines(block.label, w)
    const vl = this.valueLines(asString(this.data[block.key]), w, { bullets: block.bullets })
    const minLines = Math.min(block.rows ?? 3, 3)
    const total = PAD + ll.length * LINE_LABEL + Math.max(minLines, vl.length) * LINE_VALUE + PAD
    if (total <= doc.available || doc.available < 60) {
      doc.ensure(total)
      this.measureTextArea(block, w, false).draw(doc.left, doc.y, w, total)
      doc.advance(total)
      return
    }
    // Partir: primera parte con las líneas que quepan
    let remaining = [...vl]
    let first = true
    while (remaining.length > 0) {
      const labelH = first ? ll.length * LINE_LABEL : LINE_LABEL
      const fit = Math.max(1, Math.floor((doc.available - 2 * PAD - labelH) / LINE_VALUE))
      const part = remaining.slice(0, fit)
      remaining = remaining.slice(fit)
      const h = PAD + labelH + part.length * LINE_VALUE + PAD
      doc.box(doc.left, doc.y, w, h)
      let yy = doc.y - PAD
      if (first) yy -= doc.lines(ll, doc.left + PAD, yy, SIZE_LABEL, this.bold, LINE_LABEL)
      else {
        doc.text(`${block.label || 'Continuación'} (continuación)`, doc.left + PAD, yy, SIZE_LABEL, this.bold, MUTED, LINE_LABEL)
        yy -= LINE_LABEL
      }
      doc.lines(part, doc.left + PAD, yy, SIZE_VALUE, this.regular, LINE_VALUE)
      doc.advance(h)
      first = false
      if (remaining.length > 0) doc.newPage()
    }
  }

  private measureOptions(block: RadioBlock | ChecksBlock, w: number, inner: boolean): Measured {
    const selected = block.type === 'radio' ? [asString(this.data[block.key])] : asList(this.data[block.key])
    const ll = this.labelLines(block.label, w)
    const cols = Math.max(1, Math.min(block.columns ?? (block.options.length > 6 ? 2 : 1), block.options.length))
    const innerW = w - 2 * PAD
    const colW = (innerW - (cols - 1) * GUTTER) / cols
    const textW = colW - CHECK - CHECK_GAP
    const opts = block.options.map((o) => ({ label: o, lines: wrapText(this.regular, SIZE_VALUE, textW, o), checked: selected.includes(o) }))
    const rows: (typeof opts)[] = []
    for (let i = 0; i < opts.length; i += cols) rows.push(opts.slice(i, i + cols))
    const rowHeights = rows.map((r) => Math.max(...r.map((o) => o.lines.length)) * LINE_VALUE)
    const other = block.other
    const otherValue = other ? asString(this.data[other.key]) : ''
    const otherLines = other ? wrapText(this.regular, SIZE_VALUE, innerW, `${other.label}: ${otherValue}`) : []
    const h = PAD + ll.length * LINE_LABEL + rowHeights.reduce((a, b) => a + b, 0) + otherLines.length * LINE_VALUE + PAD
    return {
      h,
      draw: (x, top, ww, hh) => {
        if (!inner) this.doc.box(x, top, ww, hh)
        let yy = top - PAD
        yy -= this.doc.lines(ll, x + PAD, yy, SIZE_LABEL, this.bold, LINE_LABEL)
        rows.forEach((r, ri) => {
          r.forEach((o, ci) => {
            const cx = x + PAD + ci * (colW + GUTTER)
            this.doc.checkbox(cx, yy, o.checked)
            this.doc.lines(o.lines, cx + CHECK + CHECK_GAP, yy, SIZE_VALUE, this.regular, LINE_VALUE)
          })
          yy -= rowHeights[ri]
        })
        if (otherLines.length) {
          // Etiqueta en negrita + valor
          const labelTxt = `${other!.label}: `
          const lw = this.bold.widthOfTextAtSize(labelTxt, SIZE_LABEL)
          this.doc.text(labelTxt, x + PAD, yy, SIZE_LABEL, this.bold, INK, LINE_VALUE)
          const vlines = wrapText(this.regular, SIZE_VALUE, innerW - lw, otherValue)
          this.doc.lines(vlines, x + PAD + lw, yy, SIZE_VALUE, this.regular, LINE_VALUE)
        }
      },
    }
  }

  private measureYesNo(block: YesNoBlock, w: number, inner: boolean): Measured {
    const value = asString(this.data[block.key])
    const text = asString(this.data[`${block.key}_texto`])
    const ll = this.labelLines(block.label, w)
    const innerW = w - 2 * PAD
    const tl = this.valueLines(text, w)
    const h = PAD + ll.length * LINE_LABEL + LINE_VALUE + Math.max(1, tl.length) * LINE_VALUE + PAD
    return {
      h,
      draw: (x, top, ww, hh) => {
        if (!inner) this.doc.box(x, top, ww, hh)
        let yy = top - PAD
        yy -= this.doc.lines(ll, x + PAD, yy, SIZE_LABEL, this.bold, LINE_LABEL)
        const half = innerW / 2
        const drawOpt = (cx: number, label: string, sub: string, checked: boolean) => {
          this.doc.checkbox(cx, yy, checked)
          this.doc.text(label, cx + CHECK + CHECK_GAP, yy, SIZE_VALUE, this.bold)
          const lw = this.bold.widthOfTextAtSize(label, SIZE_VALUE)
          this.doc.text(sub, cx + CHECK + CHECK_GAP + lw + 5, yy, SIZE_LABEL, this.regular, MUTED)
        }
        drawOpt(x + PAD, 'No', block.noLabel ?? '', value === 'No')
        drawOpt(x + PAD + half, 'Sí', block.yesLabel ?? '', value === 'Sí')
        yy -= LINE_VALUE
        this.doc.lines(tl, x + PAD, yy, SIZE_VALUE, this.regular, LINE_VALUE)
      },
    }
  }

  private measureTable(block: TableBlock, w: number): Measured {
    const rows = asRows(this.data[block.key])
    const weights = block.columns.map((c) => c.width ?? 1)
    const totalWeight = weights.reduce((a, b) => a + b, 0)
    const colWs = weights.map((wt) => (w * wt) / totalWeight)
    const headerH = LINE_LABEL + 3
    const ll = this.labelLines(block.label ?? '', w)
    // Filas: las diligenciadas y al menos el número indicado en el formato
    const count = Math.max(block.rows, rows.length)
    const cells: WrappedLine[][][] = []
    const rowHs: number[] = []
    for (let r = 0; r < count; r++) {
      const rowData = rows[r] ?? {}
      const cellLines = block.columns.map((c, ci) => {
        const v = rowData[c.key] ?? ''
        if (c.type === 'radio' && c.options) {
          return c.options.map((o) => ({ text: o, x: 0, checked: v === o }) as WrappedLine & { checked: boolean })
        }
        return wrapText(this.regular, SIZE_VALUE, colWs[ci] - 2 * PAD, v)
      })
      cells.push(cellLines)
      const maxLines = Math.max(1, ...cellLines.map((cl, ci) => (block.columns[ci].type === 'radio' ? this.radioRows(block.columns[ci].options ?? [], colWs[ci]) : cl.length)))
      rowHs.push(maxLines * LINE_VALUE + 2)
    }
    const h = ll.length * LINE_LABEL + headerH + rowHs.reduce((a, b) => a + b, 0)
    return {
      h,
      draw: (x, top) => {
        let yy = top
        if (ll.length) {
          this.doc.box(x, yy, w, ll.length * LINE_LABEL + 2, BAR_SOFT)
          this.doc.lines(ll, x + PAD, yy - 1, SIZE_LABEL, this.bold, LINE_LABEL)
          yy -= ll.length * LINE_LABEL + 2
        }
        // Encabezado
        this.doc.box(x, yy, w, headerH, BAR_SOFT)
        let cx = x
        block.columns.forEach((c, ci) => {
          this.doc.text(c.label, cx + PAD, yy - 1.5, SIZE_LABEL, this.bold, INK, LINE_LABEL)
          if (ci > 0) this.doc.vline(cx, yy, yy - headerH)
          cx += colWs[ci]
        })
        yy -= headerH
        cells.forEach((cellLines, r) => {
          const rh = rowHs[r]
          this.doc.box(x, yy, w, rh)
          let cx2 = x
          block.columns.forEach((c, ci) => {
            if (ci > 0) this.doc.vline(cx2, yy, yy - rh)
            if (c.type === 'radio' && c.options) {
              this.drawRadioCell(c.options, rows[r]?.[c.key] ?? '', cx2 + PAD, yy - 1, colWs[ci] - 2 * PAD)
            } else {
              this.doc.lines(cellLines[ci], cx2 + PAD, yy - 1, SIZE_VALUE, this.regular, LINE_VALUE)
            }
            cx2 += colWs[ci]
          })
          yy -= rh
        })
      },
    }
  }

  /** Número de líneas que ocupan las opciones de una celda radio según el ancho disponible. */
  private radioRows(options: string[], colW: number): number {
    const inline = options.reduce((acc, o) => acc + CHECK + CHECK_GAP + this.regular.widthOfTextAtSize(o, SIZE_VALUE) + GUTTER, 0)
    return inline <= colW - 2 * PAD ? 1 : options.length
  }

  private drawRadioCell(options: string[], value: string, x: number, top: number, w: number): void {
    const inline = this.radioRows(options, w + 2 * PAD) === 1
    let cx = x
    let yy = top
    for (const o of options) {
      this.doc.checkbox(cx, yy, value === o)
      this.doc.text(o, cx + CHECK + CHECK_GAP, yy, SIZE_VALUE, this.regular)
      if (inline) cx += CHECK + CHECK_GAP + this.regular.widthOfTextAtSize(o, SIZE_VALUE) + GUTTER
      else yy -= LINE_VALUE
    }
  }

  private measureRow(items: Block[], widths: number[] | undefined, w: number, inner: boolean): Measured {
    const weights = items.map((_, i) => widths?.[i] ?? 1)
    const total = weights.reduce((a, b) => a + b, 0)
    const ws = weights.map((wt) => (w * wt) / total)
    const measured = items.map((it, i) => this.measure(it, ws[i], false))
    const h = Math.max(0, ...measured.map((m) => m.h))
    return {
      h,
      draw: (x, top) => {
        let cx = x
        measured.forEach((m, i) => {
          if (m.h > 0) {
            if (inner) this.doc.box(cx, top, ws[i], h)
            m.draw(cx, top, ws[i], h)
          }
          cx += ws[i]
        })
      },
    }
  }

  private measureGroup(label: string, items: Block[], w: number, inner: boolean): Measured {
    const ll = this.labelLines(label, w)
    const measured = items.map((it) => this.measure(it, w, true))
    const h = PAD + ll.length * LINE_LABEL + measured.reduce((a, m) => a + m.h, 0) + PAD
    return {
      h,
      draw: (x, top, ww, hh) => {
        if (!inner) this.doc.box(x, top, ww, hh)
        let yy = top - PAD
        yy -= this.doc.lines(ll, x + PAD, yy, SIZE_LABEL, this.bold, LINE_LABEL)
        measured.forEach((m) => {
          m.draw(x, yy, ww, m.h)
          yy -= m.h
        })
      },
    }
  }

  // ---------- Flujo ----------

  /** Dibuja una lista de bloques en el flujo del documento con saltos de página. */
  flow(blocks: Block[]): void {
    const doc = this.doc
    for (let i = 0; i < blocks.length; i++) {
      const block = blocks[i]
      if (block.type === 'note') continue
      if (block.type === 'textarea') {
        this.flowTextArea(block, doc.width)
        continue
      }
      const m = this.measure(block, doc.width)
      if (m.h === 0) continue
      if (block.type === 'heading') {
        // Un encabezado nunca queda solo al final de la página: se mantiene con el bloque siguiente.
        const next = blocks[i + 1]
        const nextH = next ? Math.min(this.measure(next, doc.width).h, 70) : 0
        doc.ensure(m.h + nextH)
      }
      if (block.type === 'table') {
        this.flowTable(block, m)
        continue
      }
      doc.ensure(m.h)
      m.draw(doc.left, doc.y, doc.width, m.h)
      doc.advance(m.h)
    }
  }

  /** Las tablas largas se dibujan completas si caben; si no, en la página siguiente. */
  private flowTable(block: TableBlock, m: Measured): void {
    const doc = this.doc
    if (m.h > doc.available && doc.y < doc.contentTop - 0.5) doc.newPage()
    if (m.h > doc.available) {
      // Tabla más alta que una página: reducir filas vacías al mínimo diligenciado
      const filled = asRows(this.data[block.key]).length
      const reduced = this.measureTable({ ...block, rows: Math.max(1, filled) }, doc.width)
      reduced.draw(doc.left, doc.y, doc.width, reduced.h)
      doc.advance(reduced.h)
      return
    }
    m.draw(doc.left, doc.y, doc.width, m.h)
    doc.advance(m.h)
  }

  sectionTitle(title: string): void {
    const doc = this.doc
    const lines = wrapText(this.bold, 7.6, doc.width - 2 * PAD, title)
    const h = lines.length * LINE_LABEL + 5
    doc.ensure(h + 40)
    doc.box(doc.left, doc.y, doc.width, h, BAR_FILL, 0.8)
    doc.lines(lines, doc.left + PAD, doc.y - 2.5, 7.6, this.bold, LINE_LABEL)
    doc.advance(h)
  }
}
