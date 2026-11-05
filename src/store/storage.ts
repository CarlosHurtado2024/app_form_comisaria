import type { FormData } from '../form/types'

/** Datos del profesional en el formato que usan los generadores de PDF. */
export interface Profile {
  nombre: string
  tarjeta: string
  seccion: string
  cargo: string
  dirigidoA: string
  /** Firma como data URL PNG (transparente) */
  firma?: string
}

/** Informe guardado en el dispositivo (copia local sincronizable con Supabase). */
export interface Report {
  id: string
  /** Código único asignado por el servidor (ITS-AAAA-NNNN); null hasta la primera sincronización */
  codigo: string | null
  autorId: string
  createdAt: string
  updatedAt: string
  data: FormData
  /** Hay cambios locales pendientes de subir */
  dirty: boolean
  /** Marcado para eliminar en el servidor en la próxima sincronización */
  deletedAt?: string
  /** Última vez que se confirmó en el servidor */
  syncedAt?: string
}

export interface KeyValueStore {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

export const DEFAULT_PROFILE: Profile = {
  nombre: '',
  tarjeta: '',
  seccion: 'Trabajo Social - Comisaría de Familia',
  cargo: 'Trabajadora Social',
  dirigidoA: '',
}

export function memoryStore(): KeyValueStore {
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

/**
 * Almacén local de informes de un usuario. Cada usuario tiene su propia lista en el dispositivo,
 * de modo que varios profesionales pueden usar el mismo equipo sin mezclar informes.
 */
export function createStorage(uid: string, store: KeyValueStore = defaultStore()) {
  const KEY = `its.reports.v2.${uid}`

  const readAll = (): Report[] => readJson<Report[]>(store, KEY, [])
  const writeAll = (reports: Report[]) => store.setItem(KEY, JSON.stringify(reports))

  /** Informes visibles (no marcados para eliminar), los más recientes primero. */
  const listReports = (): Report[] =>
    readAll()
      .filter((r) => !r.deletedAt)
      .sort((a, b) => (a.updatedAt === b.updatedAt ? 0 : a.updatedAt < b.updatedAt ? 1 : -1))

  /** Todos los registros locales, incluidos los pendientes de eliminar (para sincronizar). */
  const listAllRaw = readAll

  const getReport = (id: string): Report | undefined => readAll().find((r) => r.id === id && !r.deletedAt)

  /** Guarda cambios hechos por el usuario (marca el informe como pendiente de subir). */
  const saveReport = (report: Report): Report => {
    const updated: Report = { ...report, updatedAt: new Date().toISOString(), dirty: true }
    writeAll([updated, ...readAll().filter((r) => r.id !== report.id)])
    return updated
  }

  /** Escribe un informe tal cual (lo usa la sincronización; no cambia updatedAt ni dirty). */
  const putRaw = (report: Report) => writeAll([report, ...readAll().filter((r) => r.id !== report.id)])

  const removeRaw = (id: string) => writeAll(readAll().filter((r) => r.id !== id))

  /** Marca para eliminar; se borra del servidor en la siguiente sincronización. */
  const deleteReport = (id: string) => {
    const r = readAll().find((x) => x.id === id)
    if (!r) return
    if (!r.syncedAt) removeRaw(id)
    else putRaw({ ...r, deletedAt: new Date().toISOString(), dirty: true })
  }

  const createReport = (profile: Profile): Report => {
    const now = new Date().toISOString()
    const hoy = todayIso()
    const report: Report = {
      id: newId(),
      codigo: null,
      autorId: uid,
      createdAt: now,
      updatedAt: now,
      dirty: true,
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
    writeAll([report, ...readAll()])
    return report
  }

  const duplicateReport = (id: string): Report | undefined => {
    const src = getReport(id)
    if (!src) return undefined
    const now = new Date().toISOString()
    // Las fotos pertenecen al informe original: la copia empieza sin evidencia
    const { evidencias: _evidencias, anexa_evidencia: _anexa, ...data } = src.data
    const copy: Report = { id: newId(), codigo: null, autorId: uid, createdAt: now, updatedAt: now, dirty: true, data }
    writeAll([copy, ...readAll()])
    return copy
  }

  const pendingCount = (): number => readAll().filter((r) => r.dirty).length

  return { listReports, listAllRaw, getReport, saveReport, putRaw, removeRaw, deleteReport, createReport, duplicateReport, pendingCount }
}

export type Storage = ReturnType<typeof createStorage>

const cache = new Map<string, Storage>()
/** Almacén del usuario indicado (se reutiliza la instancia). */
export function storageFor(uid: string): Storage {
  let s = cache.get(uid)
  if (!s) {
    s = createStorage(uid)
    cache.set(uid, s)
  }
  return s
}
