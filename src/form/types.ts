/**
 * Esquema declarativo del formulario.
 * El mismo esquema alimenta la interfaz de captura (React) y el generador de PDF,
 * de modo que ambos se mantienen alineados con el formato F-PM-096.
 */

export interface OtherField {
  key: string
  label: string
}

export interface TextBlock {
  type: 'text'
  key: string
  label: string
  placeholder?: string
  inputType?: 'text' | 'number' | 'tel' | 'email'
}

export interface DateBlock {
  type: 'date'
  key: string
  label: string
}

export interface TextAreaBlock {
  type: 'textarea'
  key: string
  label: string
  /** Altura sugerida en líneas para la interfaz y mínimo del cuadro en el PDF */
  rows?: number
  hint?: string
  /** Mostrar viñeta al inicio de cada línea en el PDF */
  bullets?: boolean
}

export interface RadioBlock {
  type: 'radio'
  key: string
  label: string
  options: string[]
  other?: OtherField
  /** Columnas en que se distribuyen las opciones en el PDF */
  columns?: number
}

export interface ChecksBlock {
  type: 'checks'
  key: string
  label: string
  options: string[]
  other?: OtherField
  columns?: number
}

export interface YesNoBlock {
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

export interface TableBlock {
  type: 'table'
  key: string
  label?: string
  columns: TableColumn[]
  rows: number
  /** Nombre singular de cada fila en la interfaz móvil (p. ej. "Persona") */
  rowName?: string
}

export interface RowBlock {
  type: 'row'
  items: Block[]
  /** Pesos relativos de ancho por ítem; por defecto iguales */
  widths?: number[]
}

export interface GroupBlock {
  type: 'group'
  label: string
  items: Block[]
}

export interface HeadingBlock {
  type: 'heading'
  text: string
}

export interface NoteBlock {
  type: 'note'
  text: string
}

export type Block =
  | TextBlock
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
