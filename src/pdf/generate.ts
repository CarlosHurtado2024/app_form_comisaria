import type { PDFImage } from 'pdf-lib'
import { FORM_SUBTITLE, FORM_TITLE, sections } from '../form/schema'
import { asRows, asString, type FormData } from '../form/types'
import type { Profile } from '../store/storage'
import { BlockRenderer } from './blocks'
import { FlowDocument, GREEN, INK, LINE_LABEL, LINE_VALUE, MUTED, PAD, SIZE_LABEL, SIZE_VALUE, formatDate, sanitize, wrapText } from './engine'

export interface PdfAssets {
  escudo?: Uint8Array
  pdet?: Uint8Array
  pie?: Uint8Array
}

export interface GenerateOptions {
  data: FormData
  profile: Profile
  assets?: PdfAssets
}

export const HEADER_TEXT = {
  entidad: 'ALCALDÍA MUNICIPAL',
  nit: 'NIT: 891500982-6',
  titulo: 'INFORME TRABAJO SOCIAL',
  fechaFormato: 'junio de 2024',
  version: '11',
  codigo: 'F-PM-096',
}

async function embedDataUrl(doc: FlowDocument, dataUrl: string): Promise<PDFImage | undefined> {
  const m = /^data:(image\/(png|jpeg|jpg));base64,(.+)$/i.exec(dataUrl)
  if (!m) return undefined
  const bytes = Uint8Array.from(atob(m[3]), (c) => c.charCodeAt(0))
  return m[2].toLowerCase() === 'png' ? doc.pdf.embedPng(bytes) : doc.pdf.embedJpg(bytes)
}

/** Genera el PDF del informe con el formato institucional F-PM-096. */
export async function generatePdf({ data, profile, assets }: GenerateOptions): Promise<Uint8Array> {
  const doc = await FlowDocument.create()
  const r = new BlockRenderer(doc, data)

  // Título del formato (solo en la primera página)
  const titleW = doc.fonts.bold.widthOfTextAtSize(FORM_TITLE, 8)
  doc.text(FORM_TITLE, doc.left + (doc.width - titleW) / 2, doc.y, 8, doc.fonts.bold, INK, LINE_VALUE)
  doc.advance(LINE_VALUE)
  const subW = doc.fonts.bold.widthOfTextAtSize(FORM_SUBTITLE, 8)
  doc.text(FORM_SUBTITLE, doc.left + (doc.width - subW) / 2, doc.y, 8, doc.fonts.bold, INK, LINE_VALUE)
  doc.advance(LINE_VALUE)
  const codigo = asString(data._codigo)
  if (codigo) {
    const txt = `Informe N.° ${codigo}`
    const cw = doc.fonts.regular.widthOfTextAtSize(txt, 8)
    doc.text(txt, doc.left + (doc.width - cw) / 2, doc.y, 8, doc.fonts.regular, INK, LINE_VALUE)
    doc.advance(LINE_VALUE)
  }
  doc.advance(3)

  for (const section of sections) {
    // La evidencia fotográfica se imprime como anexo al final (drawPhotoAnnex)
    if (section.id === 'evidencia') continue
    // La sección del profesional (datos + firma) se mantiene completa en una misma página.
    if (section.id === 'profesional') doc.ensure(180)
    r.sectionTitle(section.title)
    r.flow(section.blocks)
    if (section.id === 'profesional') await drawSignature(doc, data, profile)
    doc.advance(4)
  }

  await drawPhotoAnnex(doc, r, data)

  doc.drawHeaders({
    ...HEADER_TEXT,
    escudo: assets?.escudo ? await doc.pdf.embedPng(assets.escudo) : undefined,
    pdet: assets?.pdet ? await doc.pdf.embedPng(assets.pdet) : undefined,
    pie: assets?.pie ? await doc.pdf.embedPng(assets.pie) : undefined,
  })

  const nna = `${asString(data.nombres)} ${asString(data.apellidos)}`.trim()
  doc.pdf.setTitle(sanitize(`Informe Trabajo Social${nna ? ` - ${nna}` : ''}`))
  doc.pdf.setAuthor(sanitize(profile.nombre || asString(data.prof_nombre)))
  doc.pdf.setSubject(sanitize(FORM_TITLE))
  doc.pdf.setProducer('Informe TS - Comisaría de Familia')
  doc.pdf.setCreator('Informe TS PWA')
  return doc.pdf.save()
}

/** Anexo con la evidencia fotográfica (`data._fotos`: [{ descripcion, src }]), dos fotos por fila. */
async function drawPhotoAnnex(doc: FlowDocument, r: BlockRenderer, data: FormData): Promise<void> {
  const fotos = asRows(data._fotos)
  if (fotos.length === 0) return
  const imgs: { img: PDFImage; descripcion: string }[] = []
  for (const f of fotos) {
    const img = await embedDataUrl(doc, f.src ?? '')
    if (img) imgs.push({ img, descripcion: f.descripcion ?? '' })
  }
  if (imgs.length === 0) return

  r.sectionTitle('ANEXO. EVIDENCIA FOTOGRÁFICA')
  const cols = 2
  const cellW = doc.width / cols
  const maxW = cellW - 2 * PAD
  const maxH = 210
  for (let i = 0; i < imgs.length; i += cols) {
    const fila = imgs.slice(i, i + cols)
    const medidas = fila.map(({ img, descripcion }) => {
      const s = Math.min(maxW / img.width, maxH / img.height, 1)
      const caption = wrapText(doc.fonts.regular, SIZE_LABEL, maxW, descripcion)
      return { h: img.height * s, caption }
    })
    const imgH = Math.max(...medidas.map((m) => m.h))
    const capLines = Math.max(...medidas.map((m) => m.caption.length))
    const rowH = PAD + imgH + (capLines ? 3 + capLines * LINE_LABEL : 0) + PAD
    doc.ensure(rowH)
    const top = doc.y
    doc.box(doc.left, top, doc.width, rowH)
    fila.forEach(({ img }, j) => {
      const x = doc.left + j * cellW
      if (j > 0) doc.vline(x, top, top - rowH)
      const s = Math.min(maxW / img.width, maxH / img.height, 1)
      const w = img.width * s
      const h = img.height * s
      // Imagen centrada en la celda, alineada arriba
      doc.page.drawImage(img, { x: x + PAD + (maxW - w) / 2, y: top - PAD - h, width: w, height: h })
      const cap = medidas[j].caption
      if (cap.length) doc.lines(cap, x + PAD, top - PAD - imgH - 3, SIZE_LABEL, doc.fonts.regular, LINE_LABEL, MUTED)
    })
    doc.advance(rowH)
  }
}

async function drawSignature(doc: FlowDocument, data: FormData, profile: Profile): Promise<void> {
  const h = 92
  doc.ensure(h)
  const w = doc.width
  const leftW = w * 0.55
  doc.box(doc.left, doc.y, w, h)
  doc.vline(doc.left + leftW, doc.y, doc.y - h)
  doc.text('Firma:', doc.left + PAD, doc.y - PAD, SIZE_LABEL, doc.fonts.bold, INK, LINE_LABEL)

  const sig = profile.firma ? await embedDataUrl(doc, profile.firma) : undefined
  const nombre = asString(data.prof_nombre) || profile.nombre
  const tarjeta = asString(data.prof_tarjeta) || profile.tarjeta
  const lineY = doc.y - h + 30
  if (sig) {
    const maxW = leftW - 2 * PAD - 10
    const maxH = 48
    const scale = Math.min(maxW / sig.width, maxH / sig.height, 1)
    const sw = sig.width * scale
    const sh = sig.height * scale
    doc.page.drawImage(sig, { x: doc.left + PAD + 8, y: lineY + 2, width: sw, height: sh })
  }
  doc.hline(doc.left + PAD + 8, doc.left + leftW - PAD - 8, lineY, 0.7, INK)
  let yy = lineY - 2
  if (nombre) {
    doc.text(nombre, doc.left + PAD + 8, yy, SIZE_VALUE, doc.fonts.bold, INK, LINE_VALUE)
    yy -= LINE_VALUE
  }
  const cargo = profile.cargo || 'Profesional en Trabajo Social'
  doc.text(cargo, doc.left + PAD + 8, yy, SIZE_LABEL, doc.fonts.regular, MUTED, LINE_LABEL)
  yy -= LINE_LABEL
  if (tarjeta) doc.text(`T.P. ${tarjeta}`, doc.left + PAD + 8, yy, SIZE_LABEL, doc.fonts.regular, MUTED, LINE_LABEL)

  // Columna derecha: resumen de fechas
  const rx = doc.left + leftW + PAD
  let ry = doc.y - PAD
  const rows: [string, string][] = [
    ['Fecha de elaboración del informe', formatDate(asString(data.prof_fecha_elaboracion))],
    ['Fecha de entrega del informe', formatDate(asString(data.prof_fecha_entrega))],
    ['Sección', asString(data.seccion) || profile.seccion],
  ]
  for (const [label, value] of rows) {
    doc.text(label, rx, ry, SIZE_LABEL, doc.fonts.bold, INK, LINE_LABEL)
    ry -= LINE_LABEL
    doc.text(value || '—', rx, ry, SIZE_VALUE, doc.fonts.regular, value ? INK : MUTED, LINE_VALUE)
    ry -= LINE_VALUE + 2
  }
  doc.text('Documento generado digitalmente', rx, doc.y - h + 12, 5.5, doc.fonts.regular, GREEN, LINE_LABEL)
  doc.advance(h)
}
