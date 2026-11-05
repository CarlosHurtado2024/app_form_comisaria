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

const esMovil = (): boolean => typeof window !== 'undefined' && window.matchMedia('(max-width: 639px)').matches

/**
 * Botón "Generar" con dos opciones: PDF y Word.
 * El panel se monta en <body> (portal): así no lo recorta la barra superior y en el
 * celular se muestra como hoja inferior con fondo oscurecido.
 */
export function ExportMenu({ busy, onPdf, onDocx, variant = 'onbar', label = 'Generar' }: Props) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState<CSSProperties>({})
  const btn = useRef<HTMLButtonElement>(null)
  const id = useId()

  const abrir = () => {
    if (open) return setOpen(false)
    const r = btn.current?.getBoundingClientRect()
    setPos(!esMovil() && r ? { top: r.bottom + 8, right: Math.max(8, window.innerWidth - r.right) } : {})
    setOpen(true)
  }

  useEffect(() => {
    if (!open) return
    const cerrar = () => setOpen(false)
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') cerrar()
    }
    document.addEventListener('keydown', onKey)
    window.addEventListener('resize', cerrar)
    window.addEventListener('scroll', cerrar, true)
    return () => {
      document.removeEventListener('keydown', onKey)
      window.removeEventListener('resize', cerrar)
      window.removeEventListener('scroll', cerrar, true)
    }
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
