import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFImage, type PDFPage, type RGB } from 'pdf-lib'

/** Tamaño carta (igual al formato original). */
export const PAGE_W = 612
export const PAGE_H = 792
export const MARGIN = 34
export const HEADER_H = 60
export const CONTENT_W = PAGE_W - 2 * MARGIN

export const INK = rgb(0.1, 0.1, 0.1)
export const MUTED = rgb(0.4, 0.4, 0.4)
export const BORDER = rgb(0.45, 0.45, 0.45)
export const BAR_FILL = rgb(0.86, 0.86, 0.86)
export const BAR_SOFT = rgb(0.93, 0.93, 0.93)
export const GREEN = rgb(0.12, 0.47, 0.25)
export const WHITE = rgb(1, 1, 1)

export const SIZE_LABEL = 6.8
export const SIZE_VALUE = 8.2
export const LINE_LABEL = 8.6
export const LINE_VALUE = 10.4
export const PAD = 3
export const CHECK = 6.5

/** Caracteres fuera de WinAnsi que pdf-lib no puede codificar con Helvetica se descartan. */
const EXTRA_WINANSI = new Set('€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ'.split(''))
export function sanitize(text: string): string {
  let out = ''
  for (const ch of text.replace(/\r\n?/g, '\n').replace(/\t/g, '    ')) {
    const code = ch.codePointAt(0) ?? 0
    if (ch === '\n' || (code >= 0x20 && code <= 0x7e) || (code >= 0xa0 && code <= 0xff) || EXTRA_WINANSI.has(ch)) {
      out += ch
    } else if (code === 0x2013 || code === 0x2014) {
      out += '-'
    } else if (code === 0x2713 || code === 0x2714) {
      out += 'x'
    }
  }
  return out
}

export interface Fonts {
  regular: PDFFont
  bold: PDFFont
}

export interface WrapOptions {
  /** Prefijo de la primera línea de cada párrafo (p. ej. viñeta) */
  prefix?: string
  /** Sangría en puntos de las líneas de continuación */
  indent?: number
}

export interface WrappedLine {
  text: string
  x: number
}

/** Ajusta texto a un ancho, respetando saltos de párrafo. */
export function wrapText(font: PDFFont, size: number, width: number, text: string, opts: WrapOptions = {}): WrappedLine[] {
  const lines: WrappedLine[] = []
  const measure = (s: string) => font.widthOfTextAtSize(s, size)
  const paragraphs = sanitize(text).split('\n')
  for (const para of paragraphs) {
    const prefix = opts.prefix && para.trim() ? opts.prefix : ''
    const indent = prefix ? (opts.indent ?? measure(prefix)) : 0
    let first = true
    let current = ''
    const pushLine = () => {
      lines.push({ text: (first ? prefix : '') + current, x: first ? 0 : indent })
      first = false
      current = ''
    }
    const words = para.split(/\s+/).filter(Boolean)
    if (words.length === 0) {
      lines.push({ text: '', x: 0 })
      continue
    }
    for (const word of words) {
      const avail = width - (first ? measure(prefix) : indent)
      const candidate = current ? `${current} ${word}` : word
      if (measure(candidate) <= avail) {
        current = candidate
        continue
      }
      if (current) pushLine()
      // Palabra más larga que la línea: partir por caracteres
      let chunk = ''
      for (const ch of word) {
        const availNow = width - (first ? measure(prefix) : indent)
        if (measure(chunk + ch) > availNow && chunk) {
          current = chunk
          pushLine()
          chunk = ch
        } else {
          chunk += ch
        }
      }
      current = chunk
    }
    if (current || first) pushLine()
  }
  return lines
}

export function formatDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim())
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso
}

export interface HeaderInfo {
  escudo?: PDFImage
  pdet?: PDFImage
  entidad: string
  nit: string
  titulo: string
  fechaFormato: string
  version: string
  codigo: string
}

/**
 * Documento con cursor vertical y salto de página automático.
 * El eje Y se maneja como "posición superior" descendente para simplificar la maquetación.
 */
export class FlowDocument {
  readonly pdf: PDFDocument
  readonly fonts: Fonts
  readonly pages: PDFPage[] = []
  page!: PDFPage
  /** Borde superior del cursor */
  y = 0
  readonly left = MARGIN
  readonly width = CONTENT_W
  readonly bottom = MARGIN

  private constructor(pdf: PDFDocument, fonts: Fonts) {
    this.pdf = pdf
    this.fonts = fonts
  }

  static async create(): Promise<FlowDocument> {
    const pdf = await PDFDocument.create()
    const regular = await pdf.embedFont(StandardFonts.Helvetica)
    const bold = await pdf.embedFont(StandardFonts.HelveticaBold)
    const doc = new FlowDocument(pdf, { regular, bold })
    doc.newPage()
    return doc
  }

  get contentTop(): number {
    return PAGE_H - MARGIN - HEADER_H - 6
  }

  get available(): number {
    return this.y - this.bottom
  }

  newPage(): void {
    this.page = this.pdf.addPage([PAGE_W, PAGE_H])
    this.pages.push(this.page)
    this.y = this.contentTop
  }

  /** Garantiza espacio vertical; si no hay, salta de página. */
  ensure(h: number): void {
    if (this.available < h && this.y < this.contentTop - 0.5) this.newPage()
  }

  advance(h: number): void {
    this.y -= h
  }

  // ---------- Primitivas de dibujo ----------

  text(text: string, x: number, top: number, size: number, font: PDFFont = this.fonts.regular, color: RGB = INK, lineHeight = LINE_VALUE): void {
    if (!text) return
    this.page.drawText(sanitize(text), { x, y: top - lineHeight * 0.76, size, font, color })
  }

  /** Dibuja líneas ya ajustadas y devuelve la altura consumida. */
  lines(lines: WrappedLine[], x: number, top: number, size: number, font: PDFFont = this.fonts.regular, lineHeight = LINE_VALUE, color: RGB = INK): number {
    let yy = top
    for (const l of lines) {
      this.text(l.text, x + l.x, yy, size, font, color, lineHeight)
      yy -= lineHeight
    }
    return lines.length * lineHeight
  }

  box(x: number, top: number, w: number, h: number, fill?: RGB, borderWidth = 0.6): void {
    this.page.drawRectangle({
      x,
      y: top - h,
      width: w,
      height: h,
      borderColor: BORDER,
      borderWidth,
      color: fill,
    })
  }

  hline(x1: number, x2: number, y: number, thickness = 0.6, color: RGB = BORDER): void {
    this.page.drawLine({ start: { x: x1, y }, end: { x: x2, y }, thickness, color })
  }

  vline(x: number, y1: number, y2: number, thickness = 0.6, color: RGB = BORDER): void {
    this.page.drawLine({ start: { x, y: y1 }, end: { x, y: y2 }, thickness, color })
  }

  /** Casilla de verificación con marca vectorial. */
  checkbox(x: number, top: number, checked: boolean, size = CHECK): void {
    const y = top - LINE_VALUE * 0.5 - size / 2
    this.page.drawRectangle({ x, y, width: size, height: size, borderColor: INK, borderWidth: 0.7, color: WHITE })
    if (checked) {
      this.page.drawLine({ start: { x: x + 1.3, y: y + size * 0.5 }, end: { x: x + size * 0.42, y: y + 1.2 }, thickness: 1.1, color: INK })
      this.page.drawLine({ start: { x: x + size * 0.42, y: y + 1.2 }, end: { x: x + size - 1, y: y + size - 1 }, thickness: 1.1, color: INK })
    }
  }

  image(img: PDFImage, x: number, top: number, maxW: number, maxH: number): { w: number; h: number } {
    const scale = Math.min(maxW / img.width, maxH / img.height, 1)
    const w = img.width * scale
    const h = img.height * scale
    this.page.drawImage(img, { x, y: top - h, width: w, height: h })
    return { w, h }
  }

  // ---------- Encabezado institucional en todas las páginas ----------

  drawHeaders(info: HeaderInfo): void {
    const total = this.pages.length
    this.pages.forEach((page, i) => {
      const top = PAGE_H - MARGIN
      const x = this.left
      const w = this.width
      const leftW = 108
      const rightW = 86
      const centerX = x + leftW
      const centerW = w - leftW - rightW
      const rightX = x + w - rightW

      page.drawRectangle({ x, y: top - HEADER_H, width: w, height: HEADER_H, borderColor: BORDER, borderWidth: 0.8 })
      page.drawLine({ start: { x: centerX, y: top }, end: { x: centerX, y: top - HEADER_H }, thickness: 0.8, color: BORDER })
      page.drawLine({ start: { x: rightX, y: top }, end: { x: rightX, y: top - HEADER_H }, thickness: 0.8, color: BORDER })

      // Logos
      let lx = x + 6
      if (info.escudo) {
        const s = Math.min(40 / info.escudo.height, 46 / info.escudo.width)
        const iw = info.escudo.width * s
        const ih = info.escudo.height * s
        page.drawImage(info.escudo, { x: lx, y: top - 5 - ih, width: iw, height: ih })
        page.drawText('MUNICIPIO DE', { x: lx + 2, y: top - HEADER_H + 9, size: 4.6, font: this.fonts.regular, color: INK })
        page.drawText('MORALES', { x: lx + 8, y: top - HEADER_H + 4, size: 4.6, font: this.fonts.regular, color: INK })
        lx += iw + 10
      }
      if (info.pdet) {
        const s = Math.min(34 / info.pdet.height, 48 / info.pdet.width)
        page.drawImage(info.pdet, { x: lx, y: top - 10 - info.pdet.height * s, width: info.pdet.width * s, height: info.pdet.height * s })
      }

      // Centro
      const center = (txt: string, yy: number, size: number, font: PDFFont, color: RGB = INK) => {
        const tw = font.widthOfTextAtSize(txt, size)
        page.drawText(txt, { x: centerX + (centerW - tw) / 2, y: yy, size, font, color })
      }
      center(info.entidad, top - 13, 8, this.fonts.bold)
      center(info.nit, top - 22.5, 7.5, this.fonts.regular)
      const tw = this.fonts.bold.widthOfTextAtSize(info.titulo, 12.5)
      const bx = centerX + (centerW - tw) / 2 - 10
      page.drawRectangle({ x: bx, y: top - 50, width: tw + 20, height: 20, borderColor: GREEN, borderWidth: 1 })
      center(info.titulo, top - 44.5, 12.5, this.fonts.bold, GREEN)

      // Derecha
      const rx = rightX + 5
      const small = 6.2
      page.drawText(`Fecha: ${info.fechaFormato}`, { x: rx, y: top - 12, size: small, font: this.fonts.regular, color: INK })
      page.drawText(`Versión: ${info.version}`, { x: rx, y: top - 24, size: small, font: this.fonts.regular, color: INK })
      page.drawText(`Página ${i + 1} de ${total}`, { x: rx, y: top - 36, size: small, font: this.fonts.regular, color: INK })
      page.drawText(`Cód. ${info.codigo}`, { x: rx, y: top - 48, size: small, font: this.fonts.regular, color: INK })
    })
  }
}
