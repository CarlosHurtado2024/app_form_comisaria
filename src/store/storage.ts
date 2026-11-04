import type { FormData } from '../form/types'

export interface Profile {
  nombre: string
  tarjeta: string
  seccion: string
  cargo: string
  dirigidoA: string
  /** Firma como data URL PNG (transparente) */
  firma?: string
}

export interface Report {
  id: string
  createdAt: string
  updatedAt: string
  data: FormData
}

export interface KeyValueStore {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

const PROFILE_KEY = 'its.profile.v1'
const REPORTS_KEY = 'its.reports.v1'

export const DEFAULT_PROFILE: Profile = {
  nombre: '',
  tarjeta: '',
  seccion: 'Trabajo Social - Comisaría de Familia',
  cargo: 'Trabajadora Social',
  dirigidoA: '',
}

function memoryStore(): KeyValueStore {
  const m = new Map<string, string>()
  return {
    getItem: (k) => m.get(k) ?? null,
    setItem: (k, v) => void m.set(k, v),
    removeItem: (k) => void m.delete(k),
  }
}

function defaultStore(): KeyValueStore {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.getItem('__probe__')
      return localStorage
    }
  } catch {
    /* almacenamiento bloqueado: usar memoria */
  }
  return memoryStore()
}

function readJson<T>(store: KeyValueStore, key: string, fallback: T): T {
  try {
    const raw = store.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

export function todayIso(): string {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

export function createStorage(store: KeyValueStore = defaultStore()) {
  const loadProfile = (): Profile => ({ ...DEFAULT_PROFILE, ...readJson<Partial<Profile>>(store, PROFILE_KEY, {}) })
  const saveProfile = (p: Profile) => store.setItem(PROFILE_KEY, JSON.stringify(p))

  const listReports = (): Report[] =>
    readJson<Report[]>(store, REPORTS_KEY, []).sort((a, b) => (a.updatedAt === b.updatedAt ? 0 : a.updatedAt < b.updatedAt ? 1 : -1))
  const writeReports = (reports: Report[]) => store.setItem(REPORTS_KEY, JSON.stringify(reports))

  const getReport = (id: string): Report | undefined => listReports().find((r) => r.id === id)

  const saveReport = (report: Report): Report => {
    const updated = { ...report, updatedAt: new Date().toISOString() }
    const others = listReports().filter((r) => r.id !== report.id)
    writeReports([updated, ...others])
    return updated
  }

  const deleteReport = (id: string) => writeReports(listReports().filter((r) => r.id !== id))

  /** Crea un informe nuevo con los datos generales tomados del perfil. */
  const createReport = (profile: Profile = loadProfile()): Report => {
    const now = new Date().toISOString()
    const hoy = todayIso()
    const report: Report = {
      id: newId(),
      createdAt: now,
      updatedAt: now,
      data: {
        fecha_elaboracion: hoy,
        elaborado_por: profile.nombre,
        seccion: profile.seccion,
        tarjeta_profesional: profile.tarjeta,
        dirigido_a: profile.dirigidoA,
        asunto: 'Informe de valoración sociofamiliar de verificación de derechos',
        nac_pais: 'Colombia',
        nac_departamento: 'Cauca',
        lengua_cual: 'Español',
        prof_nombre: profile.nombre,
        prof_tarjeta: profile.tarjeta,
        prof_fecha_elaboracion: hoy,
      },
    }
    const others = listReports()
    writeReports([report, ...others])
    return report
  }

  const duplicateReport = (id: string): Report | undefined => {
    const src = getReport(id)
    if (!src) return undefined
    const now = new Date().toISOString()
    const copy: Report = { id: newId(), createdAt: now, updatedAt: now, data: { ...src.data } }
    writeReports([copy, ...listReports()])
    return copy
  }

  return { loadProfile, saveProfile, listReports, getReport, saveReport, deleteReport, createReport, duplicateReport }
}

export type Storage = ReturnType<typeof createStorage>

export const storage: Storage = createStorage()
