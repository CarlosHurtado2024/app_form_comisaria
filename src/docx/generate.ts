/**
 * Informe en formato Word (.docx) con el mismo contenido que el PDF: encabezado y pie
 * institucionales en todas las hojas, secciones del formato F-PM-096, casillas, tablas,
 * texto con formato, firma del profesional y anexo fotográfico.
 */
import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  Header,
  ImageRun,
  Packer,
  PageNumber,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableLayoutType,
  TableRow,
  TabStopType,
  TextRun,
  VerticalAlignTable,
  WidthType,
  type IParagraphOptions,
  type ITableCellOptions,
} from 'docx'
import { parseRich } from '../form/richtext'
import { FORM_SUBTITLE, FORM_TITLE, sections } from '../form/schema'
import {
  asList,
  asRows,
  asString,
  type Block,
  type ChecksBlock,
  type DateBlock,
  type FormData,
  type GroupBlock,
  type RadioBlock,
  type RowBlock,
  type SelectBlock,
  type TableBlock,
  type TextBlock,
  type YesNoBlock,
} from '../form/types'
import { isVisible } from '../form/visibility'
import { HEADER_TEXT, incluyeDerechos } from '../pdf/generate'
import { formatDate } from '../pdf/engine'
import type { Profile } from '../store/storage'
import { ajustar, desdeBytes, desdeDataUrl, type ImagenBytes } from './imagen'

export interface DocxAssets {
  escudo?: Uint8Array
  pdet?: Uint8Array
  pie?: Uint8Array
}

export interface GenerateDocxOptions {
  data: FormData
  profile: Profile
  assets?: DocxAssets
}

// ---------- Medidas (DXA: 1/20 de punto; página carta con márgenes de 0,5") ----------
const PAGE_W = 12240
const MARGIN = 720
const CONTENT_W = PAGE_W - 2 * MARGIN // 10800
const FONT = 'Arial'
const SZ_LABEL = 15 // medios puntos (7,5 pt)
const SZ_VALUE = 17 // 8,5 pt
const GRAY = 'DADADA'
const GRAY_SOFT = 'EFEFEF'
const GREEN = '2E8B1E'
const CHECK_ON = '☒' // ☒
const CHECK_OFF = '☐' // ☐

const border = { style: BorderStyle.SINGLE, size: 4, color: '000000' }
const BORDERS = { top: border, bottom: border, left: border, right: border }
const NO_BORDER = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }
const NO_BORDERS = { top: NO_BORDER, bottom: NO_BORDER, left: NO_BORDER, right: NO_BORDER, insideHorizontal: NO_BORDER, insideVertical: NO_BORDER }
const CELL_MARGINS = { top: 40, bottom: 40, left: 70, right: 70 }
const NO_MARGINS = { top: 0, bottom: 0, left: 0, right: 0 }
const PAD = CELL_MARGINS.left + CELL_MARGINS.right

const run = (text: string, opts: { bold?: boolean; italics?: boolean; underline?: boolean; size?: number; color?: string; font?: string } = {}): TextRun =>
  new TextRun({ text, bold: opts.bold, italics: opts.italics, underline: opts.underline ? {} : undefined, size: opts.size ?? SZ_VALUE, color: opts.color, font: opts.font ?? FONT })

const check = (on: boolean): TextRun => new TextRun({ text: `${on ? CHECK_ON : CHECK_OFF} `, size: SZ_VALUE, font: 'Segoe UI Symbol' })

const para = (children: (TextRun | ImageRun)[], opts: Partial<IParagraphOptions> = {}): Paragraph => new Paragraph({ children, spacing: { before: 0, after: 0 }, ...opts })

const labelPara = (text: string): Paragraph => para([run(text, { bold: true, size: SZ_LABEL })])

/** Párrafos de un texto con formato (negrita, cursiva, subrayado, listas), justificados. */
function richParas(text: string, opts: { autoBullet?: boolean; justify?: boolean } = {}): Paragraph[] {
  if (!text.trim()) return [para([run('')])]
  return parseRich(text).map((line) => {
    const runs = line.runs.map((r) => run(r.text, { bold: r.bold, italics: r.italic, underline: r.underline }))
    const marker = line.markerText || (opts.autoBullet && runs.length ? '•' : '')
    const alignment = opts.justify === false ? AlignmentType.LEFT : AlignmentType.JUSTIFIED
    if (!marker) return para(runs.length ? runs : [run('')], { alignment })
    const mk = line.marker === 'square' ? '▪' : marker
    return para([run(`${mk}\t`), ...runs], { alignment, indent: { left: 300, hanging: 300 }, tabStops: [{ type: TabStopType.LEFT, position: 300 }] })
  })
}

interface CellOpts {
  width?: number
  shade?: string
  columnSpan?: number
  borders?: ITableCellOptions['borders']
  margins?: ITableCellOptions['margins']
  verticalAlign?: ITableCellOptions['verticalAlign']
}

const cell = (children: (Paragraph | Table)[], opts: CellOpts = {}): TableCell =>
  new TableCell({
    children: children.length ? children : [para([run('')])],
    width: opts.width ? { size: opts.width, type: WidthType.DXA } : undefined,
    shading: opts.shade ? { type: ShadingType.CLEAR, fill: opts.shade, color: 'auto' } : undefined,
    columnSpan: opts.columnSpan,
    borders: opts.borders ?? BORDERS,
    margins: opts.margins ?? CELL_MARGINS,
    verticalAlign: opts.verticalAlign,
  })

/** Párrafo casi invisible que cierra una celda cuyo último hijo es una tabla (Word lo exige). */
const cierre = (): Paragraph => new Paragraph({ children: [run('', { size: 2 })], spacing: { before: 0, after: 0, line: 20, lineRule: 'exact' } })

/** Un bloque que se dibuja como tabla ocupa toda la celda: sin margen ni borde propio, para no duplicar líneas. */
const fillsCell = (block: Block): boolean => block.type === 'row' || block.type === 'group' || block.type === 'heading'

/** Tabla de ancho fijo (en DXA) con columnas dadas. */
const table = (rows: TableRow[], widths: number[], opts: { borders?: boolean } = {}): Table =>
  new Table({
    rows,
    width: { size: widths.reduce((a, b) => a + b, 0), type: WidthType.DXA },
    columnWidths: widths,
    layout: TableLayoutType.FIXED,
    borders: opts.borders === false ? NO_BORDERS : undefined,
  })

const splitWidth = (total: number, weights: number[]): number[] => {
  const sum = weights.reduce((a, b) => a + b, 0)
  const ws = weights.map((w) => Math.floor((total * w) / sum))
  ws[ws.length - 1] += total - ws.reduce((a, b) => a + b, 0)
  return ws
}

// ---------- Bloques ----------

class DocxRenderer {
  private readonly data: FormData
  constructor(data: FormData) {
    this.data = data
  }

  private value(key: string): string {
    return asString(this.data[key])
  }

  /** Etiqueta de un bloque, si la tiene (sirve para repartir filas en encabezado y contenido). */
  private labelOf(block: Block): string {
    return 'label' in block && typeof block.label === 'string' ? block.label : ''
  }

  /**
   * Contenido de un bloque: párrafos y/o tablas. `w` es el ancho disponible en DXA.
   * Con `sinLabel` se omite la etiqueta (ya va en la fila de encabezado); con `enGrupo`,
   * una fila de campos simples se escribe en una sola línea («Años: 16  Meses: 9»).
   */
  block(block: Block, w: number, ctx: { sinLabel?: boolean; enGrupo?: boolean } = {}): (Paragraph | Table)[] {
    if (!isVisible(block, this.data)) return []
    const label = !ctx.sinLabel && this.labelOf(block) ? [labelPara(this.labelOf(block))] : []
    switch (block.type) {
      case 'note':
      case 'fotos':
        return []
      case 'heading':
        return [table([new TableRow({ children: [cell([para([run(block.text, { bold: true, size: SZ_LABEL })])], { shade: GRAY_SOFT, width: w })] })], [w])]
      case 'text':
      case 'select':
      case 'date': {
        const raw = this.value(block.key)
        const v = block.type === 'date' ? formatDate(raw) : raw
        return [...label, para([run(v || ' ')])]
      }
      case 'textarea':
        return [...label, ...richParas(this.value(block.key), { autoBullet: block.bullets })]
      case 'radio':
      case 'checks':
        return [...label, ...this.options(block, w)]
      case 'yesno':
        return [...label, ...this.yesno(block)]
      case 'table':
        return [...label, ...this.dataTable(block, w)]
      case 'row':
        return this.row(block, w, !!ctx.enGrupo)
      case 'group':
        return [table([this.titleRow(block.label, w), new TableRow({ children: [cell(this.groupBody(block, w - PAD), { width: w })] })], [w])]
    }
  }

  /** Contenido de un grupo (sin su título). */
  private groupBody(block: GroupBlock, w: number): (Paragraph | Table)[] {
    return block.items.flatMap((it) => this.block(it, w, { enGrupo: true }))
  }

  /**
   * Fila de bloques. Si todos tienen etiqueta, se dibuja como una cuadrícula de dos filas
   * (etiquetas arriba, contenido abajo) con una sola línea entre celdas, como en el PDF.
   */
  private row(block: RowBlock, w: number, enGrupo: boolean): (Paragraph | Table)[] {
    const items = block.items.filter((it) => isVisible(it, this.data))
    if (!items.length) return []
    const simple = (b: Block) => b.type === 'text' || b.type === 'select' || b.type === 'date'
    if (enGrupo && items.every(simple)) {
      const runs = items.flatMap((it, i) => {
        const raw = this.value((it as TextBlock | SelectBlock | DateBlock).key)
        const v = it.type === 'date' ? formatDate(raw) : raw
        return [run(i ? '      ' : ''), run(`${this.labelOf(it)}: `, { bold: true, size: SZ_LABEL }), run(v || '—')]
      })
      return [para(runs)]
    }
    const weights = block.widths && block.widths.length === block.items.length ? block.items.map((it, i) => (isVisible(it, this.data) ? block.widths![i] : 0)).filter(Boolean) : items.map(() => 1)
    const widths = splitWidth(w, weights)
    if (items.every((it) => this.labelOf(it))) {
      const header = new TableRow({ cantSplit: true, children: items.map((it, i) => cell([labelPara(this.labelOf(it))], { width: widths[i] })) })
      const body = new TableRow({
        children: items.map((it, i) => {
          const inner = widths[i] - PAD
          const content = it.type === 'group' ? this.groupBody(it, inner) : this.block(it, inner, { sinLabel: true })
          return cell(content, { width: widths[i] })
        }),
      })
      return [table([header, body], widths)]
    }
    return [table([new TableRow({ children: items.map((it, i) => this.boxCell(it, widths[i])) })], widths)]
  }

  private titleRow(title: string, w: number, shade?: string): TableRow {
    return new TableRow({ children: [cell([para([run(title, { bold: true, size: SZ_LABEL })])], { shade, width: w })] })
  }

  /** Celda con el contenido de un bloque. Si el bloque es una tabla, esta llena la celda y pone las líneas. */
  private boxCell(block: Block, w: number): TableCell {
    if (fillsCell(block)) {
      const content = this.block(block, w)
      return cell(content.length ? [...content, cierre()] : [], { width: w, borders: NO_BORDERS, margins: NO_MARGINS })
    }
    return cell(this.block(block, w - PAD), { width: w })
  }

  private options(block: RadioBlock | ChecksBlock, w: number): (Paragraph | Table)[] {
    const selected = block.type === 'radio' ? [this.value(block.key)] : asList(this.data[block.key])
    const cols = Math.max(1, Math.min(block.columns ?? (block.options.length > 6 ? 2 : 1), block.options.length))
    const items = block.options.map((o) => para([check(selected.includes(o)), run(o)]))
    const out: (Paragraph | Table)[] = []
    if (cols === 1) out.push(...items)
    else {
      const perCol = Math.ceil(items.length / cols)
      const widths = splitWidth(w, Array.from({ length: cols }, () => 1))
      const cells = widths.map((cw, c) => cell(items.slice(c * perCol, (c + 1) * perCol), { width: cw, borders: NO_BORDERS }))
      out.push(table([new TableRow({ children: cells })], widths, { borders: false }))
    }
    if (block.other) out.push(para([run(`${block.other.label}: `, { bold: true, size: SZ_LABEL }), run(this.value(block.other.key))]))
    return out
  }

  private yesno(block: YesNoBlock): Paragraph[] {
    const v = this.value(block.key)
    const text = this.value(`${block.key}_texto`)
    return [
      para([check(v === 'No'), run('No', { bold: true }), run(block.noLabel ? `  ${block.noLabel}` : '', { size: SZ_LABEL, color: '666666' }), run('      '), check(v === 'Sí'), run('Sí', { bold: true }), run(block.yesLabel ? `  ${block.yesLabel}` : '', { size: SZ_LABEL, color: '666666' })]),
      ...richParas(text),
    ]
  }

  private dataTable(block: TableBlock, w: number): (Paragraph | Table)[] {
    const rows = asRows(this.data[block.key])
    const widths = splitWidth(
      w,
      block.columns.map((c) => c.width ?? 1),
    )
    const header = new TableRow({
      tableHeader: true,
      children: block.columns.map((c, i) => cell([para([run(c.label, { bold: true, size: SZ_LABEL })])], { width: widths[i], shade: GRAY_SOFT })),
    })
    const count = Math.max(1, rows.length)
    const body = Array.from({ length: count }, (_, r) => {
      const row = rows[r] ?? {}
      return new TableRow({
        children: block.columns.map((c, i) => {
          const v = row[c.key] ?? ''
          if (c.type === 'radio' && c.options) return cell([para(c.options.flatMap((o) => [check(v === o), run(`${o}  `)]))], { width: widths[i] })
          return cell([para([run(v || ' ')])], { width: widths[i] })
        }),
      })
    })
    return [table([header, ...body], widths)]
  }

  /**
   * Sección completa: título sombreado y luego cada bloque como tabla de ancho completo,
   * una tras otra, de modo que entre bloques solo haya una línea.
   */
  section(title: string, blocks: Block[], extra: (Paragraph | Table)[] = []): Table[] {
    const out: Table[] = [table([this.titleRow(title, CONTENT_W, GRAY)], [CONTENT_W])]
    for (const b of blocks) {
      if (!isVisible(b, this.data)) continue
      if (fillsCell(b)) {
        for (const t of this.block(b, CONTENT_W)) if (t instanceof Table) out.push(t)
        continue
      }
      const content = this.block(b, CONTENT_W - PAD)
      if (content.length) out.push(table([new TableRow({ children: [cell(content, { width: CONTENT_W })] })], [CONTENT_W]))
    }
    if (extra.length) out.push(table([new TableRow({ children: [cell(extra, { width: CONTENT_W })] })], [CONTENT_W]))
    return out
  }
}

// ---------- Imágenes ----------

const imageRun = (img: ImagenBytes, maxW: number, maxH: number): ImageRun =>
  new ImageRun({ type: img.type, data: img.bytes, transformation: ajustar(img, maxW, maxH) })

function signature(data: FormData, profile: Profile): (Paragraph | Table)[] {
  const nombre = asString(data.prof_nombre) || profile.nombre
  const tarjeta = asString(data.prof_tarjeta) || profile.tarjeta
  const cargo = profile.cargo || 'Profesional en Trabajo Social'
  const firma = profile.firma ? desdeDataUrl(profile.firma) : undefined
  const left: Paragraph[] = [labelPara('Firma:')]
  left.push(para(firma ? [imageRun(firma, 220, 70)] : [run(' ')], { spacing: { before: 60, after: 0 } }))
  left.push(para([run('_____________________________________')]))
  if (nombre) left.push(para([run(nombre, { bold: true })]))
  left.push(para([run(`${cargo}${tarjeta ? `  ·  T.P. ${tarjeta}` : ''}`, { size: SZ_LABEL, color: '666666' })]))
  const widths = splitWidth(CONTENT_W - CELL_MARGINS.left - CELL_MARGINS.right, [55, 45])
  return [table([new TableRow({ children: [cell(left, { width: widths[0], borders: NO_BORDERS }), cell([para([run(' ')])], { width: widths[1], borders: NO_BORDERS })] })], widths, { borders: false })]
}

function photoAnnex(data: FormData): Table | undefined {
  const fotos = asRows(data._fotos)
    .map((f) => ({ descripcion: f.descripcion ?? '', img: desdeDataUrl(f.src ?? '') }))
    .filter((f): f is { descripcion: string; img: ImagenBytes } => !!f.img)
  if (!fotos.length) return undefined
  const widths = splitWidth(CONTENT_W, [1, 1])
  const rows = [new TableRow({ children: [cell([para([run('ANEXO. EVIDENCIA FOTOGRÁFICA', { bold: true, size: SZ_LABEL })])], { shade: GRAY, width: CONTENT_W, columnSpan: 2 })] })]
  for (let i = 0; i < fotos.length; i += 2) {
    const par = fotos.slice(i, i + 2)
    const cells = par.map((f, j) =>
      cell([para([imageRun(f.img, 300, 280)], { alignment: AlignmentType.CENTER }), para([run(f.descripcion, { size: SZ_LABEL, color: '444444' })], { alignment: AlignmentType.CENTER })], { width: widths[j], verticalAlign: VerticalAlignTable.TOP }),
    )
    if (cells.length === 1) cells.push(cell([para([run(' ')])], { width: widths[1] }))
    rows.push(new TableRow({ children: cells, cantSplit: true }))
  }
  return table(rows, widths)
}

// ---------- Encabezado y pie ----------

function header(assets: DocxAssets | undefined): Header {
  const escudo = desdeBytes(assets?.escudo)
  const pdet = desdeBytes(assets?.pdet)
  const widths = splitWidth(CONTENT_W, [12, 14, 58, 16])
  const dashed = { style: BorderStyle.DASHED, size: 4, color: '777777' }
  const dashedBorders = { top: dashed, bottom: dashed, left: dashed, right: dashed }
  const logo = (img: ImagenBytes | undefined, caption: string, w: number) =>
    cell(
      [
        para(img ? [imageRun(img, 60, 58)] : [run(' ')], { alignment: AlignmentType.CENTER }),
        ...(caption ? [para([run(caption, { size: 11 })], { alignment: AlignmentType.CENTER })] : []),
      ],
      { width: w, borders: dashedBorders, verticalAlign: VerticalAlignTable.CENTER },
    )
  const center = cell(
    [
      para([run(HEADER_TEXT.entidad, { size: 19 })], { alignment: AlignmentType.CENTER }),
      para([run(HEADER_TEXT.nit, { size: 19 })], { alignment: AlignmentType.CENTER }),
      para([run(` ${HEADER_TEXT.titulo} `, { bold: true, size: 34, color: GREEN })], {
        alignment: AlignmentType.CENTER,
        spacing: { before: 60, after: 0 },
        border: { top: dashed, bottom: dashed, left: dashed, right: dashed },
      }),
    ],
    { width: widths[2], borders: dashedBorders, verticalAlign: VerticalAlignTable.CENTER },
  )
  const meta = cell(
    [
      para([run(`Fecha: ${HEADER_TEXT.fechaFormato}`, { size: SZ_LABEL })], { alignment: AlignmentType.CENTER }),
      para([run(`Versión: ${HEADER_TEXT.version}`, { size: SZ_LABEL })], { alignment: AlignmentType.CENTER }),
      para([run('Página ', { size: SZ_LABEL }), new TextRun({ children: [PageNumber.CURRENT], size: SZ_LABEL, font: FONT }), run(' de ', { size: SZ_LABEL }), new TextRun({ children: [PageNumber.TOTAL_PAGES], size: SZ_LABEL, font: FONT })], {
        alignment: AlignmentType.CENTER,
      }),
      para([run(`Cód. ${HEADER_TEXT.codigo}`, { size: SZ_LABEL })], { alignment: AlignmentType.CENTER }),
    ],
    { width: widths[3], borders: dashedBorders, verticalAlign: VerticalAlignTable.CENTER },
  )
  return new Header({
    children: [
      table([new TableRow({ children: [logo(escudo, 'MUNICIPIO DE MORALES', widths[0]), logo(pdet, '', widths[1]), center, meta] })], widths),
      para([run('')], { spacing: { before: 0, after: 80 } }),
    ],
  })
}

function footer(assets: DocxAssets | undefined): Footer {
  const pie = desdeBytes(assets?.pie)
  return new Footer({ children: [para(pie ? [imageRun(pie, 720, 80)] : [run('')], { alignment: AlignmentType.CENTER })] })
}

// ---------- Documento ----------

export async function generateDocx({ data, profile, assets }: GenerateDocxOptions): Promise<Blob> {
  const r = new DocxRenderer(data)
  const body: (Paragraph | Table)[] = []
  body.push(para([run(FORM_TITLE, { bold: true })], { alignment: AlignmentType.CENTER }))
  body.push(para([run(FORM_SUBTITLE, { bold: true })], { alignment: AlignmentType.CENTER }))
  const codigo = asString(data._codigo)
  if (codigo) body.push(para([run(`Informe N.° ${codigo}`)], { alignment: AlignmentType.CENTER }))
  body.push(para([run('')], { spacing: { before: 0, after: 80 } }))

  for (const section of sections) {
    if (section.id === 'evidencia') continue
    if (section.id === 'derechos' && !incluyeDerechos(data)) continue
    const extra = section.id === 'profesional' ? signature(data, profile) : []
    body.push(...r.section(section.title, section.blocks, extra))
    body.push(para([run('')], { spacing: { before: 0, after: 60 } }))
  }
  const anexo = photoAnnex(data)
  if (anexo) body.push(anexo)

  const nna = `${asString(data.nombres)} ${asString(data.apellidos)}`.trim()
  const doc = new Document({
    creator: 'Informe TS - Comisaría de Familia',
    title: `Informe Trabajo Social${nna ? ` - ${nna}` : ''}`,
    subject: FORM_TITLE,
    styles: { default: { document: { run: { font: FONT, size: SZ_VALUE } } } },
    sections: [
      {
        properties: {
          page: {
            size: { width: PAGE_W, height: 15840 },
            margin: { top: 1900, bottom: 1500, left: MARGIN, right: MARGIN, header: 400, footer: 300 },
          },
        },
        headers: { default: header(assets) },
        footers: { default: footer(assets) },
        children: body,
      },
    ],
  })
  return Packer.toBlob(doc)
}
