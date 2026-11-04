import { sections } from './schema'
import { collectKeys, type FieldValue, type FormData } from './types'

export function hasValue(v: FieldValue): boolean {
  if (v === undefined) return false
  if (typeof v === 'string') return v.trim().length > 0
  if (Array.isArray(v)) {
    return v.some((item) => (typeof item === 'string' ? item.trim().length > 0 : Object.values(item).some((x) => String(x ?? '').trim().length > 0)))
  }
  return false
}

/** Secciones con al menos un dato diligenciado. */
export function sectionsDone(data: FormData): Set<string> {
  const done = new Set<string>()
  for (const s of sections) {
    if (collectKeys(s.blocks).some((k) => hasValue(data[k]))) done.add(s.id)
  }
  return done
}

export function progressPercent(data: FormData): number {
  return Math.round((sectionsDone(data).size / sections.length) * 100)
}
