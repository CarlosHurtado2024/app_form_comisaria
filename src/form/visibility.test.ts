import { describe, expect, it } from 'vitest'
import { edadEn, isVisible, pruneHidden, selectOptions } from './visibility'
import type { SelectBlock } from './types'

describe('edadEn', () => {
  it('calcula años y meses cumplidos', () => {
    expect(edadEn('2014-02-01', '2026-05-26')).toEqual({ anios: 12, meses: 3 })
    expect(edadEn('2014-03-09', '2026-11-04')).toEqual({ anios: 12, meses: 7 })
    expect(edadEn('2020-11-30', '2026-11-04')).toEqual({ anios: 5, meses: 11 })
  })
  it('devuelve null con fechas inválidas o futuras', () => {
    expect(edadEn('', '2026-01-01')).toBeNull()
    expect(edadEn('2030-01-01', '2026-01-01')).toBeNull()
  })
})

describe('visibilidad', () => {
  it('evalúa condiciones equals, notEquals, includes y truthy', () => {
    const d = { doc_tipo: 'Documento de su país de origen', lengua_bilingue: ['Bilingüe'], regimen: 'Ninguno', fecha_nacimiento: '2014-01-01' }
    expect(isVisible({ type: 'text', key: 'x', label: '', when: { key: 'doc_tipo', equals: 'Documento de su país de origen' } }, d)).toBe(true)
    expect(isVisible({ type: 'text', key: 'x', label: '', when: { key: 'regimen', notEquals: 'Ninguno' } }, d)).toBe(false)
    expect(isVisible({ type: 'text', key: 'x', label: '', when: { key: 'lengua_bilingue', includes: 'Bilingüe' } }, d)).toBe(true)
    expect(isVisible({ type: 'text', key: 'x', label: '', when: { key: 'fecha_nacimiento', truthy: true } }, d)).toBe(true)
  })

  it('vacía los campos ocultos (EPS con régimen Ninguno, escolarización No, ingresos Sin ingreso)', () => {
    const d = pruneHidden({
      regimen: 'Ninguno',
      eps: 'Alguna',
      escolarizacion: 'No',
      nivel: 'Básica',
      ie_nombre: 'IE',
      ingresos_monto: 'Sin ingreso',
      ingresos_fuente: ['Salario'],
      ingresos_periodicidad: 'Mensual',
      spa: 'No',
      spa_tipo: ['Social'],
      nombres: 'Ana',
    })
    expect(d.eps).toBeUndefined()
    expect(d.nivel).toBeUndefined()
    expect(d.ie_nombre).toBeUndefined()
    expect(d.ingresos_fuente).toBeUndefined()
    expect(d.ingresos_periodicidad).toBeUndefined()
    expect(d.spa_tipo).toBeUndefined()
    expect(d.nombres).toBe('Ana')
  })
})

describe('selectOptions', () => {
  const dep: SelectBlock = { type: 'select', key: 'nac_departamento', label: '', optionsFrom: 'departamentos' }
  const mun: SelectBlock = { type: 'select', key: 'nac_ciudad', label: '', optionsFrom: 'municipios' }
  it('lista departamentos y municipios solo para Colombia', () => {
    expect(selectOptions(dep, { nac_pais: 'Colombia' })).toContain('Cauca')
    expect(selectOptions(dep, { nac_pais: 'Ecuador' })).toBeNull()
    expect(selectOptions(mun, { nac_pais: 'Colombia', nac_departamento: 'Cauca' })).toContain('Morales')
    expect(selectOptions(mun, { nac_pais: 'Colombia', nac_departamento: 'Cauca' })).toContain('Popayán')
    expect(selectOptions(mun, { nac_pais: 'Colombia', nac_departamento: '' })).toBeNull()
  })
})
