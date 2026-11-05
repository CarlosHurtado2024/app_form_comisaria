import { useCallback, useEffect, useId, useRef, useState, type ClipboardEvent } from 'react'
import { editorHtmlToMarkup, markupToEditorHtml } from './richEditor'

interface Props {
  id?: string
  value: string
  onChange: (value: string) => void
  rows?: number
  ariaLabel?: string
}

type Cmd = 'bold' | 'italic' | 'underline' | 'bullet' | 'square' | 'number'

interface Estado {
  bold: boolean
  italic: boolean
  underline: boolean
  list: 'bullet' | 'square' | 'number' | null
}

const BOTONES: { cmd: Cmd; label: string; title: string; cls?: string }[] = [
  { cmd: 'bold', label: 'N', title: 'Negrita', cls: 'rt__b' },
  { cmd: 'italic', label: 'K', title: 'Cursiva', cls: 'rt__i' },
  { cmd: 'underline', label: 'S', title: 'Subrayado', cls: 'rt__u' },
  { cmd: 'bullet', label: '• Lista', title: 'Viñetas de punto' },
  { cmd: 'square', label: '▪ Lista', title: 'Viñetas cuadradas' },
  { cmd: 'number', label: '1. Lista', title: 'Numeración' },
]

function listaActual(root: HTMLElement): HTMLElement | null {
  const sel = window.getSelection()
  if (!sel || sel.rangeCount === 0) return null
  let node: Node | null = sel.getRangeAt(0).startContainer
  while (node && node !== root) {
    if (node instanceof HTMLElement && (node.tagName === 'UL' || node.tagName === 'OL')) return node
    node = node.parentNode
  }
  return null
}

/**
 * Editor visual: negrita, cursiva, subrayado, viñetas (punto y cuadro) y numeración.
 * Guarda texto con marcas (ver `form/richtext.ts`), el mismo que usan el PDF y el Word.
 */
export function RichTextArea({ id, value, onChange, rows = 4, ariaLabel }: Props) {
  const autoId = useId()
  const ref = useRef<HTMLDivElement>(null)
  const ultimo = useRef<string | null>(null)
  // Última selección dentro del editor: en el celular, tocar un botón puede perderla
  const rango = useRef<Range | null>(null)
  const [estado, setEstado] = useState<Estado>({ bold: false, italic: false, underline: false, list: null })

  // Cargar el contenido cuando el valor cambia desde fuera (no en cada tecla)
  useEffect(() => {
    const el = ref.current
    if (!el || value === ultimo.current) return
    el.innerHTML = markupToEditorHtml(value)
    ultimo.current = value
  }, [value])

  const emitir = useCallback(() => {
    const el = ref.current
    if (!el) return
    const markup = editorHtmlToMarkup(el)
    ultimo.current = markup
    onChange(markup)
  }, [onChange])

  const actualizarEstado = useCallback(() => {
    const el = ref.current
    if (!el || (!el.contains(document.activeElement) && document.activeElement !== el)) return
    const sel = window.getSelection()
    if (sel && sel.rangeCount > 0 && el.contains(sel.getRangeAt(0).commonAncestorContainer)) rango.current = sel.getRangeAt(0).cloneRange()
    const ul = listaActual(el)
    setEstado({
      bold: document.queryCommandState('bold'),
      italic: document.queryCommandState('italic'),
      underline: document.queryCommandState('underline'),
      list: !ul ? null : ul.tagName === 'OL' ? 'number' : ul.dataset.square === '1' ? 'square' : 'bullet',
    })
  }, [])

  useEffect(() => {
    document.addEventListener('selectionchange', actualizarEstado)
    return () => document.removeEventListener('selectionchange', actualizarEstado)
  }, [actualizarEstado])

  const ejecutar = (cmd: Cmd) => {
    const el = ref.current
    if (!el) return
    // Si el toque en el botón deshizo la selección (celular), se restaura la última conocida.
    // Se comprueba antes de enfocar: focus() crea un cursor vacío dentro del editor.
    const sel = window.getSelection()
    const dentro = sel && sel.rangeCount > 0 && el.contains(sel.getRangeAt(0).commonAncestorContainer)
    el.focus()
    if (!dentro && rango.current && sel) {
      sel.removeAllRanges()
      sel.addRange(rango.current)
    }
    if (cmd === 'bold' || cmd === 'italic' || cmd === 'underline') {
      document.execCommand(cmd)
    } else if (cmd === 'number') {
      document.execCommand('insertOrderedList')
    } else {
      const actual = listaActual(el)
      const esUl = actual?.tagName === 'UL'
      const esCuadro = esUl && actual.dataset.square === '1'
      if (esUl && (cmd === 'square') !== esCuadro) {
        // Cambiar el tipo de viñeta de la lista actual
        if (cmd === 'square') {
          actual.dataset.square = '1'
          actual.style.listStyleType = 'square'
        } else {
          delete actual.dataset.square
          actual.style.listStyleType = ''
        }
      } else {
        document.execCommand('insertUnorderedList')
        const nueva = listaActual(el)
        if (nueva && cmd === 'square') {
          nueva.dataset.square = '1'
          nueva.style.listStyleType = 'square'
        }
      }
    }
    emitir()
    actualizarEstado()
  }

  // Pegar solo texto plano (sin estilos de otras aplicaciones)
  const onPaste = (e: ClipboardEvent<HTMLDivElement>) => {
    e.preventDefault()
    const text = e.clipboardData.getData('text/plain')
    document.execCommand('insertText', false, text)
  }

  return (
    <div className="rt">
      <div className="rt__bar" role="toolbar" aria-label="Formato del texto">
        {BOTONES.map((b) => {
          const on = b.cmd === 'bold' || b.cmd === 'italic' || b.cmd === 'underline' ? estado[b.cmd] : estado.list === b.cmd
          return (
            <button
              type="button"
              key={b.cmd}
              className={`rt__btn ${b.cls ?? ''}${on ? ' rt__btn--on' : ''}`}
              title={b.title}
              aria-label={b.title}
              aria-pressed={on}
              onPointerDown={(e) => e.preventDefault()}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => ejecutar(b.cmd)}
            >
              {b.label}
            </button>
          )
        })}
      </div>
      <div
        ref={ref}
        id={id ?? autoId}
        className="textarea rt__area"
        contentEditable
        role="textbox"
        aria-multiline="true"
        aria-label={ariaLabel}
        style={{ minHeight: `${Math.max(2, Math.min(rows, 12)) * 1.55 + 1.2}em` }}
        onInput={emitir}
        onBlur={emitir}
        onPaste={onPaste}
        onKeyUp={actualizarEstado}
        onMouseUp={actualizarEstado}
        suppressContentEditableWarning
      />
    </div>
  )
}
