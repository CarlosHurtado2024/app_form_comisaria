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
import { asList, asRows, asString, type Block, type ChecksBlock, type FormData, type RadioBlock, type TableBlock, type YesNoBlock } from '../form/types'
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
  verticalAlign?: ITableCellOptions['verticalAlign']
}

const cell = (children: (Paragraph | Table)[], opts: CellOpts = {}): TableCell =>
  new TableCell({
    children: children.length ? children : [para([run('')])],
    width: opts.width ? { size: opts.width, type: WidthType.DXA } : undefined,
    shading: opts.shade ? { type: ShadingType.CLEAR, fill: opts.shade, color: 'auto' } : undefined,
    columnSpan: opts.columnSpan,
    borders: opts.borders ?? BORDERS,
    margins: CELL_MARGINS,
    verticalAlign: opts.verticalAlign,
  })

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

  /** Contenido de un bloque: párrafos y/o tablas anidadas. `w` es el ancho disponible en DXA. */
  block(block: Block, w: number): (Paragraph | Table)[] {
    if (!isVisible(block, this.data)) return []
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
        return [...(block.label ? [labelPara(block.label)] : []), para([run(v || ' ')])]
      }
      case 'textarea':
        return [...(block.label ? [labelPara(block.label)] : []), ...richParas(this.value(block.key), { autoBullet: block.bullets })]
      case 'radio':
      case 'checks':
        return this.options(block, w)
      case 'yesno':
        return this.yesno(block)
      case 'table':
        return this.dataTable(block, w)
      case 'row': {
        const items = block.items.filter((it) => isVisible(it, this.data))
        if (!items.length) return []
        const weights = block.widths && block.widths.length === block.items.length ? block.items.map((it, i) => (isVisible(it, this.data) ? block.widths![i] : 0)).filter(Boolean) : items.map(() => 1)
        const widths = splitWidth(w, weights)
        const cells = items.map((it, i) => cell(this.block(it, widths[i] - CELL_MARGINS.left - CELL_MARGINS.right), { width: widths[i] }))
        return [table([new TableRow({ children: cells })], widths)]
      }
      case 'group': {
        const inner = w - CELL_MARGINS.left - CELL_MARGINS.right
        const body = block.items.flatMap((it) => this.block(it, inner))
        return [
          table(
            [
              new TableRow({ children: [cell([para([run(block.label, { bold: true, size: SZ_LABEL })])], { shade: GRAY_SOFT, width: w })] }),
              new TableRow({ children: [cell(body, { width: w })] }),
            ],
            [w],
          ),
        ]
      }
    }
  }

  private options(block: RadioBlock | ChecksBlock, w: number): (Paragraph | Table)[] {
    const selected = block.type === 'radio' ? [this.value(block.key)] : asList(this.data[block.key])
    const cols = Math.max(1, Math.min(block.columns ?? (block.options.length > 6 ? 2 : 1), block.options.length))
    const items = block.options.map((o) => para([check(selected.includes(o)), run(o)]))
    const out: (Paragraph | Table)[] = block.label ? [labelPara(block.label)] : []
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
      labelPara(block.label),
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
    const out: (Paragraph | Table)[] = block.label ? [labelPara(block.label)] : []
    out.push(table([header, ...body], widths))
    return out
  }

  /** Sección completa: tabla de una columna con título sombreado y un bloque por fila. */
  section(title: string, blocks: Block[], extra: (Paragraph | Table)[] = []): Table {
    const inner = CONTENT_W - CELL_MARGINS.left - CELL_MARGINS.right
    const rows = [new TableRow({ children: [cell([para([run(title, { bold: true, size: SZ_LABEL })])], { shade: GRAY, width: CONTENT_W })] })]
    for (const b of blocks) {
      const content = this.block(b, inner)
      if (content.length) rows.push(new TableRow({ children: [cell(content, { width: CONTENT_W })] }))
    }
    if (extra.length) rows.push(new TableRow({ children: [cell(extra, { width: CONTENT_W })] }))
    return table(rows, [CONTENT_W])
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
    body.push(r.section(section.title, section.blocks, extra))
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
