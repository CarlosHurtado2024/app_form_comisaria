import { useEffect, useId, useRef, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { Icon } from './Icon'

interface Props {
  busy?: boolean
  onPdf: () => void
  onDocx: () => void
  /** Estilo del botón que abre el menú */
  variant?: 'onbar' | 'primary'
  label?: string
}


/**
 * Botón "Generar" con dos opciones: PDF y Word.
 * El panel se monta en <body> (portal) y se posiciona justo debajo del botón,
 * en cualquier tamaño de pantalla.
 */
export function ExportMenu({ busy, onPdf, onDocx, variant = 'onbar', label = 'Generar' }: Props) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState<CSSProperties>({})
  const btn = useRef<HTMLButtonElement>(null)
  const id = useId()

  const abrir = () => {
    if (open) return setOpen(false)
    // Quitar el foco del campo activo (cierra el teclado) antes de calcular la posición
    ;(document.activeElement as HTMLElement | null)?.blur?.()
    // Siempre justo debajo del botón, alineado a su borde derecho y dentro de la pantalla
    const r = btn.current?.getBoundingClientRect()
    if (r) {
      const ancho = Math.min(320, window.innerWidth - 16)
      const right = Math.max(8, Math.min(window.innerWidth - r.right, window.innerWidth - ancho - 8))
      // Si no cabe debajo (botón al final de la pantalla), se abre hacia arriba
      const ALTO = 240
      const abajo = window.innerHeight - r.bottom - 8
      const arriba = abajo < ALTO && r.top - 8 > abajo
      setPos(arriba ? { bottom: window.innerHeight - r.top + 8, right, width: ancho } : { top: r.bottom + 8, right, width: ancho })
    } else setPos({})
    setOpen(true)
  }

  useEffect(() => {
    if (!open) return
    const cerrar = () => setOpen(false)
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') cerrar()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])

  const pick = (fn: () => void) => {
    setOpen(false)
    fn()
  }

  const panel = (
    <>
      <div className="xm__backdrop" onClick={() => setOpen(false)} aria-hidden="true" />
      <div className="xm__menu" role="menu" id={id} aria-label="Generar informe" style={pos}>
        <div className="xm__head">
          <strong>Generar informe</strong>
          <span>Elija el formato del archivo</span>
        </div>
        <button type="button" role="menuitem" className="xm__item" onClick={() => pick(onPdf)} disabled={busy}>
          <span className="xm__badge">PDF</span>
          <span className="xm__text">
            <span className="xm__title">Documento PDF</span>
            <span className="xm__desc">Listo para enviar o imprimir</span>
          </span>
          <Icon name="chevron" size={18} className="xm__go" />
        </button>
        <button type="button" role="menuitem" className="xm__item" onClick={() => pick(onDocx)} disabled={busy}>
          <span className="xm__badge xm__badge--docx">W</span>
          <span className="xm__text">
            <span className="xm__title">Documento Word</span>
            <span className="xm__desc">Editable (.docx)</span>
          </span>
          <Icon name="chevron" size={18} className="xm__go" />
        </button>
        <button type="button" className="btn btn--ghost xm__cancel" onClick={() => setOpen(false)}>
          Cancelar
        </button>
      </div>
    </>
  )

  return (
    <>
      <button
        ref={btn}
        type="button"
        className={`btn ${variant === 'onbar' ? 'btn--gold' : 'btn--primary'}`}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={id}
        onClick={abrir}
        disabled={busy}
      >
        {busy ? 'Generando…' : label}
        <Icon name="chevron" size={16} className="xm__caret" />
      </button>
      {open && createPortal(panel, document.body)}
    </>
  )
}
