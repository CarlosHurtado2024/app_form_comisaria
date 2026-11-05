import { municipiosDe, NOMBRES_DEPARTAMENTOS, PAISES } from '../data/colombia'
import { sections } from './schema'
import { asList, asString, collectKeys, type Block, type Condition, type FormData, type SelectBlock } from './types'

/** Evalúa una condición declarativa contra los datos del informe. */
export function matches(cond: Condition | undefined, data: FormData): boolean {
  if (!cond) return true
  const raw = data[cond.key]
  const value = asString(raw)
  if (cond.equals !== undefined && value !== cond.equals) return false
  if (cond.notEquals !== undefined && value === cond.notEquals) return false
  if (cond.includes !== undefined && !asList(raw).includes(cond.includes)) return false
  if (cond.truthy !== undefined) {
    const has = Array.isArray(raw) ? raw.length > 0 : value.trim().length > 0
    if (has !== cond.truthy) return false
  }
  return true
}

export const isVisible = (block: Block, data: FormData): boolean => matches(block.when, data)

/**
 * Opciones de un campo de selección. Devuelve `null` cuando no hay lista aplicable
 * (por ejemplo, departamentos de un país distinto de Colombia): el campo se captura como texto libre.
 */
export function selectOptions(block: SelectBlock, data: FormData): string[] | null {
  if (block.options) return block.options
  switch (block.optionsFrom) {
    case 'paises':
      return PAISES
    case 'departamentos':
      return asString(data.nac_pais) === 'Colombia' ? NOMBRES_DEPARTAMENTOS : null
    case 'municipios': {
      if (asString(data.nac_pais) !== 'Colombia') return null
      const list = municipiosDe(asString(data.nac_departamento))
      return list.length ? list : null
    }
    default:
      return null
  }
}

/** Borra los valores de los bloques que han quedado ocultos para que no aparezcan en el PDF. */
export function pruneHidden(data: FormData): FormData {
  const next: FormData = { ...data }
  let changed = false
  const walk = (blocks: Block[], hiddenParent: boolean) => {
    for (const b of blocks) {
      const hidden = hiddenParent || !isVisible(b, next)
      if (hidden && !hiddenParent) {
        for (const k of collectKeys([b])) {
          if (next[k] !== undefined) {
            delete next[k]
            changed = true
          }
        }
      }
      if (b.type === 'row' || b.type === 'group') walk(b.items, hidden)
    }
  }
  for (const s of sections) walk(s.blocks, false)
  return changed ? next : data
}

/** Edad en años y meses cumplidos entre dos fechas ISO (AAAA-MM-DD). */
export function edadEn(fechaNacimiento: string, fechaReferencia: string): { anios: number; meses: number } | null {
  const a = /^(\d{4})-(\d{2})-(\d{2})$/.exec(fechaNacimiento)
  const b = /^(\d{4})-(\d{2})-(\d{2})$/.exec(fechaReferencia)
  if (!a || !b) return null
  const [ay, am, ad] = [Number(a[1]), Number(a[2]), Number(a[3])]
  const [by, bm, bd] = [Number(b[1]), Number(b[2]), Number(b[3])]
  let meses = (by - ay) * 12 + (bm - am)
  if (bd < ad) meses -= 1
  if (meses < 0) return null
  return { anios: Math.floor(meses / 12), meses: meses % 12 }
}

/**
 * Ajusta datos de informes creados antes de que existieran los campos opcionales:
 * si la sección 7 tiene contenido pero no se respondió la pregunta, se marca "Sí"
 * para que no se oculte (ni se borre) al editar.
 */
export function normalizeData(data: FormData): FormData {
  if (!data.analiza_derechos && ['derechos_vulnerados', 'derechos_amenazados', 'derechos_garantizados'].some((k) => typeof data[k] === 'string' && (data[k] as string).trim())) {
    return { ...data, analiza_derechos: 'Sí' }
  }
  return data
}
