import { useId, useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react'
import { BULLET, SQUARE, splitMarker } from '../form/richtext'

interface Props {
  id?: string
  value: string
  onChange: (value: string) => void
  rows?: number
  ariaLabel?: string
}

type Pending = { start: number; end: number } | null

/** Envuelve la selección (o la palabra en el cursor) con una marca de estilo. */
function wrapSelection(value: string, start: number, end: number, mark: string): { value: string; start: number; end: number } {
  let s = start
  let e = end
  if (s === e) {
    // Sin selección: tomar la palabra bajo el cursor
    while (s > 0 && /\S/.test(value[s - 1])) s--
    while (e < value.length && /\S/.test(value[e])) e++
  }
  const sel = value.slice(s, e)
  const already = sel.startsWith(mark) && sel.endsWith(mark) && sel.length >= 2 * mark.length
  const inner = already ? sel.slice(mark.length, sel.length - mark.length) : `${mark}${sel}${mark}`
  const next = value.slice(0, s) + inner + value.slice(e)
  return { value: next, start: s, end: s + inner.length }
}

/** Pone o quita un marcador de lista en todas las líneas que toca la selección. */
function toggleList(value: string, start: number, end: number, kind: 'bullet' | 'square' | 'number'): { value: string; start: number; end: number } {
  const lineStart = value.lastIndexOf('\n', start - 1) + 1
  let lineEnd = value.indexOf('\n', end)
  if (lineEnd < 0) lineEnd = value.length
  const lines = value.slice(lineStart, lineEnd).split('\n')
  const allMarked = lines.every((l) => splitMarker(l).marker === kind || !l.trim())
  const out = lines.map((l, i) => {
    const { rest } = splitMarker(l)
    if (allMarked) return rest
    if (!l.trim() && lines.length > 1) return l
    const prefix = kind === 'number' ? `${i + 1}. ` : `${kind === 'square' ? SQUARE : BULLET} `
    return prefix + rest
  })
  const replaced = out.join('\n')
  // El cursor queda al final de las líneas modificadas para seguir escribiendo
  return { value: value.slice(0, lineStart) + replaced + value.slice(lineEnd), start: lineStart + replaced.length, end: lineStart + replaced.length }
}

const BOTONES: { label: string; title: string; act: (v: string, s: number, e: number) => { value: string; start: number; end: number }; cls?: string }[] = [
  { label: 'N', title: 'Negrita', cls: 'rt__b', act: (v, s, e) => wrapSelection(v, s, e, '**') },
  { label: 'K', title: 'Cursiva', cls: 'rt__i', act: (v, s, e) => wrapSelection(v, s, e, '*') },
  { label: 'S', title: 'Subrayado', cls: 'rt__u', act: (v, s, e) => wrapSelection(v, s, e, '__') },
  { label: `${BULLET} Lista`, title: 'Viñetas de punto', act: (v, s, e) => toggleList(v, s, e, 'bullet') },
  { label: `${SQUARE} Lista`, title: 'Viñetas cuadradas', act: (v, s, e) => toggleList(v, s, e, 'square') },
  { label: '1. Lista', title: 'Numeración', act: (v, s, e) => toggleList(v, s, e, 'number') },
]

/** Área de texto con barra de formato (negrita, cursiva, subrayado, viñetas y numeración). */
export function RichTextArea({ id, value, onChange, rows = 4, ariaLabel }: Props) {
  const autoId = useId()
  const ref = useRef<HTMLTextAreaElement>(null)
  const [pending, setPending] = useState<Pending>(null)

  // Restaurar la selección después de aplicar un formato
  useLayoutEffect(() => {
    if (!pending || !ref.current) return
    ref.current.focus()
    ref.current.setSelectionRange(pending.start, pending.end)
    setPending(null)
  }, [pending, value])

  const apply = (act: (typeof BOTONES)[number]['act']) => {
    const el = ref.current
    if (!el) return
    const r = act(value, el.selectionStart, el.selectionEnd)
    onChange(r.value)
    setPending({ start: r.start, end: r.end })
  }

  // Enter dentro de una lista: continúa con el mismo marcador (o la cierra si la línea está vacía)
  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key !== 'Enter' || e.shiftKey || e.ctrlKey || e.metaKey) return
    const el = e.currentTarget
    const pos = el.selectionStart
    if (pos !== el.selectionEnd) return
    const lineStart = value.lastIndexOf('\n', pos - 1) + 1
    const line = value.slice(lineStart, pos)
    const { marker, markerText, rest } = splitMarker(line)
    if (!marker) return
    e.preventDefault()
    if (!rest.trim()) {
      // Línea de lista vacía: salir de la lista
      const next = value.slice(0, lineStart) + value.slice(pos)
      onChange(next)
      setPending({ start: lineStart, end: lineStart })
      return
    }
    const prefix = marker === 'number' ? `${parseInt(markerText, 10) + 1}. ` : `${markerText} `
    const next = `${value.slice(0, pos)}\n${prefix}${value.slice(pos)}`
    onChange(next)
    setPending({ start: pos + 1 + prefix.length, end: pos + 1 + prefix.length })
  }

  return (
    <div className="rt">
      <div className="rt__bar" role="toolbar" aria-label="Formato del texto">
        {BOTONES.map((b) => (
          <button type="button" key={b.title} className={`rt__btn ${b.cls ?? ''}`} title={b.title} aria-label={b.title} onMouseDown={(e) => e.preventDefault()} onClick={() => apply(b.act)}>
            {b.label}
          </button>
        ))}
      </div>
      <textarea
        ref={ref}
        id={id ?? autoId}
        className="textarea rt__area"
        rows={Math.max(2, Math.min(rows, 12))}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        aria-label={ariaLabel}
      />
    </div>
  )
}
