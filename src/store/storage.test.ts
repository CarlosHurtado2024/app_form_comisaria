import { describe, expect, it } from 'vitest'
import { createStorage, DEFAULT_PROFILE, type KeyValueStore } from './storage'

function memory(): KeyValueStore {
  const m = new Map<string, string>()
  return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => void m.set(k, v), removeItem: (k) => void m.delete(k) }
}

describe('storage', () => {
  it('guarda y recupera el perfil con valores por defecto', () => {
    const s = createStorage(memory())
    expect(s.loadProfile()).toEqual(DEFAULT_PROFILE)
    s.saveProfile({ ...DEFAULT_PROFILE, nombre: 'Ana', tarjeta: '99' })
    expect(s.loadProfile().nombre).toBe('Ana')
    expect(s.loadProfile().seccion).toBe(DEFAULT_PROFILE.seccion)
  })

  it('crea informes prellenados con el perfil y los lista por actualización', () => {
    const s = createStorage(memory())
    const profile = { ...DEFAULT_PROFILE, nombre: 'Ana', tarjeta: '99', dirigidoA: 'Comisaria' }
    const a = s.createReport(profile)
    expect(a.data.elaborado_por).toBe('Ana')
    expect(a.data.prof_tarjeta).toBe('99')
    expect(a.data.dirigido_a).toBe('Comisaria')
    const b = s.createReport(profile)
    s.saveReport({ ...a, data: { ...a.data, nombres: 'Juan' } })
    const list = s.listReports()
    expect(list.map((r) => r.id)).toEqual([a.id, b.id])
    expect(s.getReport(a.id)?.data.nombres).toBe('Juan')
  })

  it('duplica y elimina informes', () => {
    const s = createStorage(memory())
    const a = s.createReport()
    s.saveReport({ ...a, data: { ...a.data, nombres: 'Copia' } })
    const copy = s.duplicateReport(a.id)
    expect(copy?.data.nombres).toBe('Copia')
    expect(copy?.id).not.toBe(a.id)
    s.deleteReport(a.id)
    expect(s.listReports().map((r) => r.id)).toEqual([copy?.id])
  })
})
