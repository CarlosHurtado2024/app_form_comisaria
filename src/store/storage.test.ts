import { describe, expect, it } from 'vitest'
import { DEFAULT_PROFILE, createStorage, defaultData, isEmptyReport, memoryStore } from './storage'

const UID = 'usuario-1'

describe('storage', () => {
  it('crea informes prellenados con el perfil, pendientes de subir y sin código', () => {
    const s = createStorage(UID, memoryStore())
    const profile = { ...DEFAULT_PROFILE, nombre: 'Ana', tarjeta: '99', dirigidoA: 'Comisaria' }
    const a = s.createReport(profile)
    expect(a.data.elaborado_por).toBe('Ana')
    expect(a.data.prof_tarjeta).toBe('99')
    expect(a.data.dirigido_a).toBe('Comisaria')
    expect(a.data.nac_pais).toBe('Colombia')
    expect(a.codigo).toBeNull()
    expect(a.dirty).toBe(true)
    expect(a.autorId).toBe(UID)
    const b = s.createReport(profile)
    s.saveReport({ ...a, data: { ...a.data, nombres: 'Juan' } })
    expect(s.listReports().map((r) => r.id)).toEqual([a.id, b.id])
    expect(s.getReport(a.id)?.data.nombres).toBe('Juan')
    expect(s.pendingCount()).toBe(2)
  })

  it('separa los informes por usuario', () => {
    const store = memoryStore()
    const s1 = createStorage('u1', store)
    const s2 = createStorage('u2', store)
    s1.createReport(DEFAULT_PROFILE)
    expect(s2.listReports()).toHaveLength(0)
  })

  it('duplica y elimina (los no sincronizados se borran de inmediato; los sincronizados quedan marcados)', () => {
    const s = createStorage(UID, memoryStore())
    const a = s.createReport(DEFAULT_PROFILE)
    s.saveReport({ ...a, data: { ...a.data, nombres: 'Copia' } })
    const copy = s.duplicateReport(a.id)
    expect(copy?.data.nombres).toBe('Copia')
    expect(copy?.id).not.toBe(a.id)
    s.deleteReport(a.id)
    expect(s.listReports().map((r) => r.id)).toEqual([copy?.id])
    expect(s.listAllRaw().some((r) => r.id === a.id)).toBe(false)

    // Sincronizado: queda marcado para eliminar en el servidor
    s.putRaw({ ...copy!, dirty: false, syncedAt: new Date().toISOString(), codigo: 'ITS-2026-0001' })
    s.deleteReport(copy!.id)
    expect(s.listReports()).toHaveLength(0)
    const raw = s.listAllRaw().find((r) => r.id === copy!.id)
    expect(raw?.deletedAt).toBeTruthy()
    expect(raw?.dirty).toBe(true)
  })
})

describe('isEmptyReport', () => {
  it('considera vacío un informe recién creado y lleno uno con datos del NNA', () => {
    const profile = { ...DEFAULT_PROFILE, nombre: 'Pro', tarjeta: '123' }
    const base = defaultData(profile)
    expect(isEmptyReport(base, profile)).toBe(true)
    expect(isEmptyReport({ ...base, fecha_elaboracion: '2020-01-01', edad_anios: '3' }, profile)).toBe(true)
    expect(isEmptyReport({ ...base, nombres: 'Ana' }, profile)).toBe(false)
    expect(isEmptyReport({ ...base, convivientes: [{ nombre: 'x' }] }, profile)).toBe(false)
    expect(isEmptyReport({ ...base, elaborado_por: 'Otra persona' }, profile)).toBe(false)
  })
})
