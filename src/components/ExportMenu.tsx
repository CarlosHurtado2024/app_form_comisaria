import { useEffect, useId, useRef, useState } from 'react'
import { canShareFiles } from '../pdf/download'

interface Props {
  busy?: boolean
  onPrintPdf: () => void
  onPdf: (mode: 'download' | 'share') => void
  onDocx: (mode: 'download' | 'share') => void
  /** Estilo del botón que abre el menú */
  variant?: 'onbar' | 'primary'
  label?: string
}

/** Botón "Generar" con menú desplegable: PDF (vista de impresión, descarga directa, compartir) y Word. */
export function ExportMenu({ busy, onPrintPdf, onPdf, onDocx, variant = 'onbar', label = 'Generar' }: Props) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const id = useId()
  const share = canShareFiles()

  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const pick = (fn: () => void) => {
    setOpen(false)
    fn()
  }

  return (
    <div className="xm" ref={ref}>
      <button
        type="button"
        className={`btn ${variant === 'onbar' ? 'btn--gold' : 'btn--primary'}`}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((o) => !o)}
        disabled={busy}
      >
        {busy ? 'Generando…' : label}
        <svg className="xm__caret" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      {open && (
        <div className="xm__menu" role="menu" id={id} aria-label="Generar informe">
          <div className="xm__group">PDF</div>
          <Item busy={busy} pick={pick} title="Generar PDF" desc="Vista con el formato institucional; en el cuadro de impresión elija «Guardar como PDF»." onClick={onPrintPdf} />
          <Item busy={busy} pick={pick} title="Descarga directa" desc="Genera el archivo PDF sin pasar por el cuadro de impresión." onClick={() => onPdf('download')} />
          {share && <Item busy={busy} pick={pick} title="Compartir PDF" desc="Enviar por WhatsApp, correo u otra aplicación." onClick={() => onPdf('share')} />}
          <div className="xm__group">Word</div>
          <Item busy={busy} pick={pick} title="Descargar Word (.docx)" desc="Mismo contenido y encabezados; editable en Word, LibreOffice o Google Docs." onClick={() => onDocx('download')} />
          {share && <Item busy={busy} pick={pick} title="Compartir Word" onClick={() => onDocx('share')} />}
        </div>
      )}
    </div>
  )
}

function Item({ title, desc, onClick, busy, pick }: { title: string; desc?: string; onClick: () => void; busy?: boolean; pick: (fn: () => void) => void }) {
  return (
    <button type="button" role="menuitem" className="xm__item" onClick={() => pick(onClick)} disabled={busy}>
      <span className="xm__title">{title}</span>
      {desc && <span className="xm__desc">{desc}</span>}
    </button>
  )
}
