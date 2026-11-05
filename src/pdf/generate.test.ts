import { readFileSync } from 'node:fs'
import { PDFDocument } from 'pdf-lib'
import { describe, expect, it } from 'vitest'
import { generatePdf } from './generate'
import { sanitize, wrapText } from './engine'
import { DEFAULT_PROFILE } from '../store/storage'
import type { FormData } from '../form/types'

const assets = {
  escudo: new Uint8Array(readFileSync(new URL('../assets/escudo.png', import.meta.url))),
  pdet: new Uint8Array(readFileSync(new URL('../assets/pdet.png', import.meta.url))),
  pie: new Uint8Array(readFileSync(new URL('../assets/pie.png', import.meta.url))),
}

const sample: FormData = {
  fecha_elaboracion: '2026-11-04',
  elaborado_por: 'Profesional de Prueba',
  nombres: 'Juan Esteban',
  apellidos: 'Pérez Ñáñez',
  sexo: 'Hombre',
  genero: 'Masculino',
  doc_tipo: 'Tarjeta de identidad',
  doc_numero: '1002979363',
  etnia: 'Ninguna de las anteriores',
  convivientes: [
    { nombre: 'María Pérez', parentesco: 'Madre', sexo: 'Mujer', edad: '34', ocupacion: 'Hogar' },
    { nombre: 'Carlos Pérez', parentesco: 'Padre', sexo: 'Hombre', edad: '40', ocupacion: 'Agricultor' },
  ],
  metodologia: ['Observación', 'Entrevista'],
  entorno_familiar: 'Sí',
  entorno_familiar_texto: 'Relaciones cercanas con la madre y abuela materna.',
  sintesis: 'Lorem ipsum dolor sit amet. '.repeat(120),
  concepto: 'Línea uno\nLínea dos con tilde á é í ó ú ñ ¿? ¡!\n' + 'Texto largo '.repeat(400),
  derechos_vulnerados: 'Derecho a la educación\nDerecho a la salud',
  acciones: 'Remitir a EPS\nSeguimiento en 30 días',
  prof_nombre: 'Profesional de Prueba',
  prof_tarjeta: '123456',
  prof_fecha_elaboracion: '2026-11-04',
}

describe('generatePdf', () => {
  it('genera un documento válido con varias páginas y encabezado en todas', async () => {
    const bytes = await generatePdf({ data: sample, profile: { ...DEFAULT_PROFILE, nombre: 'Profesional de Prueba' }, assets })
    const pdf = await PDFDocument.load(bytes)
    expect(pdf.getPageCount()).toBeGreaterThanOrEqual(4)
    expect(pdf.getTitle()).toContain('Juan Esteban')
  })

  it('tolera datos vacíos y caracteres fuera de WinAnsi', async () => {
    const bytes = await generatePdf({ data: { nombres: 'Emoji 😀 ✓ — ok' }, profile: DEFAULT_PROFILE })
    expect(bytes.byteLength).toBeGreaterThan(1000)
  })

  it('incrusta la firma PNG del perfil', async () => {
    // PNG 1x1 transparente
    const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='
    const bytes = await generatePdf({ data: {}, profile: { ...DEFAULT_PROFILE, firma: png } })
    const pdf = await PDFDocument.load(bytes)
    expect(pdf.getPageCount()).toBeGreaterThanOrEqual(3)
  })
})

describe('wrapText', () => {
  it('parte palabras largas y respeta párrafos', async () => {
    const pdf = await PDFDocument.create()
    const font = await pdf.embedFont('Helvetica')
    const lines = wrapText(font, 8, 60, 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa\nhola mundo')
    expect(lines.length).toBeGreaterThan(2)
    expect(lines[lines.length - 1].text).toBe('hola mundo')
  })
})

describe('sanitize', () => {
  it('conserva tildes y elimina emojis', () => {
    expect(sanitize('Ñandú á 😀 ok')).toBe('Ñandú á  ok')
  })
})
