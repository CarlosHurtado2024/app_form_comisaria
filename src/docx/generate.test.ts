import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { DEFAULT_PROFILE } from '../store/storage'
import type { FormData } from '../form/types'
import { generateDocx } from './generate'
import { dimensiones } from './imagen'

const assets = {
  escudo: new Uint8Array(readFileSync(new URL('../assets/escudo.png', import.meta.url))),
  pdet: new Uint8Array(readFileSync(new URL('../assets/pdet.png', import.meta.url))),
  pie: new Uint8Array(readFileSync(new URL('../assets/pie.png', import.meta.url))),
}

const sample: FormData = {
  nombres: 'Juan Esteban',
  apellidos: 'Pérez Ñáñez',
  sexo: 'Hombre',
  convivientes: [{ nombre: 'María Pérez', parentesco: 'Madre', sexo: 'Mujer', edad: '34', ocupacion: 'Hogar' }],
  sintesis: 'Texto con **negrita** y *cursiva*.\n• Viñeta\n1. Numerado',
  analiza_derechos: 'Sí',
  derechos_vulnerados: 'Salud\nEducación',
  _codigo: 'ITS-2026-0001',
}

describe('generateDocx', () => {
  it('lee dimensiones de PNG y JPEG', () => {
    expect(dimensiones(assets.pie)).toEqual({ type: 'png', width: 807, height: 90 })
    const jpg = new Uint8Array([0xff, 0xd8, 0xff, 0xc0, 0x00, 0x11, 0x08, 0x01, 0x2c, 0x02, 0x58, 0x03, 0x01, 0x22, 0x00, 0x02, 0x11, 0x01, 0x03, 0x11, 0x01, 0xff, 0xd9])
    expect(dimensiones(jpg)).toEqual({ type: 'jpg', width: 600, height: 300 })
  })

  it('genera un .docx válido con los datos del informe', async () => {
    const blob = await generateDocx({ data: sample, profile: { ...DEFAULT_PROFILE, nombre: 'Profesional de Prueba' }, assets })
    expect(blob.size).toBeGreaterThan(20_000)
    const bytes = new Uint8Array(await blob.arrayBuffer())
    // Firma ZIP "PK"
    expect(bytes[0]).toBe(0x50)
    expect(bytes[1]).toBe(0x4b)
  })

  it('tolera datos vacíos y sin imágenes', async () => {
    const blob = await generateDocx({ data: {}, profile: DEFAULT_PROFILE })
    expect(blob.size).toBeGreaterThan(5_000)
  })
})
