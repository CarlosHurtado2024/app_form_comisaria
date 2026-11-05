/**
 * Esquema declarativo del formulario.
 * El mismo esquema alimenta la interfaz de captura (React) y el generador de PDF,
 * de modo que ambos se mantienen alineados con el formato F-PM-096.
 */

export interface OtherField {
  key: string
  label: string
}

/**
 * Condición declarativa sobre otro campo. Se usa para mostrar u ocultar bloques
 * (`when`) o para bloquear la edición (`readOnlyWhen`).
 */
export interface Condition {
  key: string
  equals?: string
  notEquals?: string
  /** Para campos de casillas: la lista contiene esta opción */
  includes?: string
  /** El campo tiene algún valor */
  truthy?: boolean
}

export interface Conditional {
  /** El bloque solo se muestra cuando se cumple la condición */
  when?: Condition
}

export interface TextBlock extends Conditional {
  type: 'text'
  key: string
  label: string
  placeholder?: string
  inputType?: 'text' | 'number' | 'tel' | 'email'
  hint?: string
  /** El campo se muestra como solo lectura cuando se cumple la condición (valor calculado) */
  readOnlyWhen?: Condition
}

export interface SelectBlock extends Conditional {
  type: 'select'
  key: string
  label: string
  options?: string[]
  /** Lista dinámica: países, departamentos (si el país es Colombia) o municipios del departamento elegido */
  optionsFrom?: 'paises' | 'departamentos' | 'municipios'
  placeholder?: string
}

export interface DateBlock extends Conditional {
  type: 'date'
  key: string
  label: string
}

export interface TextAreaBlock extends Conditional {
  type: 'textarea'
  key: string
  label: string
  /** Altura sugerida en líneas para la interfaz y mínimo del cuadro en el PDF */
  rows?: number
  hint?: string
  /** Mostrar viñeta al inicio de cada línea en el PDF */
  bullets?: boolean
}

export interface RadioBlock extends Conditional {
  type: 'radio'
  key: string
  label: string
  options: string[]
  other?: OtherField
  /** Columnas en que se distribuyen las opciones en el PDF */
  columns?: number
}

export interface ChecksBlock extends Conditional {
  type: 'checks'
  key: string
  label: string
  options: string[]
  other?: OtherField
  columns?: number
}

export interface YesNoBlock extends Conditional {
  type: 'yesno'
  key: string
  label: string
  /** Etiqueta del texto cuando la respuesta es No (p. ej. "¿Por qué?") */
  noLabel?: string
  /** Etiqueta del texto cuando la respuesta es Sí (p. ej. "Descripción") */
  yesLabel?: string
}

export interface TableColumn {
  key: string
  label: string
  type?: 'text' | 'number' | 'radio'
  options?: string[]
  /** Peso relativo del ancho de la columna */
  width?: number
}

export interface TableBlock extends Conditional {
  type: 'table'
  key: string
  label?: string
  columns: TableColumn[]
  rows: number
  /** Nombre singular de cada fila en la interfaz móvil (p. ej. "Persona") */
  rowName?: string
}

export interface RowBlock extends Conditional {
  type: 'row'
  items: Block[]
  /** Pesos relativos de ancho por ítem; por defecto iguales */
  widths?: number[]
}

export interface GroupBlock extends Conditional {
  type: 'group'
  label: string
  items: Block[]
}

export interface HeadingBlock extends Conditional {
  type: 'heading'
  text: string
}

export interface NoteBlock extends Conditional {
  type: 'note'
  text: string
}

/** Evidencia fotográfica: lista de fotos con descripción (se anexa al final del PDF). */
export interface PhotosBlock extends Conditional {
  type: 'fotos'
  key: string
  label: string
  /** Clave del campo Sí/No que habilita el anexo */
  enabledBy: string
}

export type Block =
  | TextBlock
  | SelectBlock
  | DateBlock
  | TextAreaBlock
  | RadioBlock
  | ChecksBlock
  | YesNoBlock
  | TableBlock
  | RowBlock
  | GroupBlock
  | HeadingBlock
  | NoteBlock
  | PhotosBlock

export interface Section {
  id: string
  /** Título tal como aparece en el formato, p. ej. "2. DATOS DEL NIÑO, NIÑA O ADOLESCENTE" */
  title: string
  /** Nombre corto para la navegación */
  short: string
  blocks: Block[]
}

export type TableRow = Record<string, string>
export type FieldValue = string | string[] | TableRow[] | undefined
export type FormData = Record<string, FieldValue>

export function asString(v: FieldValue): string {
  return typeof v === 'string' ? v : ''
}

export function asList(v: FieldValue): string[] {
  return Array.isArray(v) && (v.length === 0 || typeof v[0] === 'string') ? (v as string[]) : []
}

export function asRows(v: FieldValue): TableRow[] {
  return Array.isArray(v) && (v.length === 0 || typeof v[0] === 'object') ? (v as TableRow[]) : []
}

/** Recorre todos los bloques (incluidos los anidados) de una lista. */
export function walkBlocks(blocks: Block[], fn: (b: Block) => void): void {
  for (const b of blocks) {
    fn(b)
    if (b.type === 'row' || b.type === 'group') walkBlocks(b.items, fn)
  }
}

/** Claves de datos que contiene una lista de bloques. */
export function collectKeys(blocks: Block[]): string[] {
  const keys: string[] = []
  walkBlocks(blocks, (b) => {
    if ('key' in b) keys.push(b.key)
    if (b.type === 'yesno') keys.push(`${b.key}_texto`)
    if ((b.type === 'radio' || b.type === 'checks') && b.other) keys.push(b.other.key)
  })
  return keys
}
