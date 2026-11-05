import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Icon, type IconName } from './Icon'

export interface DialogAction {
  /** Valor que devuelve el diálogo al elegir esta acción */
  value: string
  label: string
  /** 'primary' (verde), 'danger' (rojo), 'ghost' (secundario) */
  kind?: 'primary' | 'danger' | 'ghost'
}

export interface DialogOptions {
  titulo: string
  mensaje?: ReactNode
  /** Icono del encabezado */
  icono?: IconName
  /** Tono del icono */
  tono?: 'info' | 'warn' | 'danger'
  acciones: DialogAction[]
  /** Valor devuelto al cerrar con Escape o el fondo (null si se omite) */
  cancelar?: string
}

interface Pending {
  opts: DialogOptions
  resolve: (value: string | null) => void
}

let listener: ((p: Pending | null) => void) | null = null

/** Abre un diálogo y resuelve con el valor de la acción elegida (o null si se canceló). */
export function dialogo(opts: DialogOptions): Promise<string | null> {
  return new Promise((resolve) => {
    if (!listener) {
      resolve(null)
      return
    }
    listener({ opts, resolve })
  })
}

/** Confirmación simple: devuelve true si el usuario acepta. */
export async function confirmar(opts: { titulo: string; mensaje?: ReactNode; aceptar?: string; cancelar?: string; peligro?: boolean; icono?: IconName }): Promise<boolean> {
  const r = await dialogo({
    titulo: opts.titulo,
    mensaje: opts.mensaje,
    icono: opts.icono ?? (opts.peligro ? 'trash' : 'check'),
    tono: opts.peligro ? 'danger' : 'info',
    cancelar: 'no',
    acciones: [
      { value: 'no', label: opts.cancelar ?? 'Cancelar', kind: 'ghost' },
      { value: 'si', label: opts.aceptar ?? 'Aceptar', kind: opts.peligro ? 'danger' : 'primary' },
    ],
  })
  return r === 'si'
}

/** Aviso con un solo botón. */
export async function avisar(opts: { titulo: string; mensaje?: ReactNode; boton?: string; icono?: IconName; tono?: 'info' | 'warn' | 'danger' }): Promise<void> {
  await dialogo({ titulo: opts.titulo, mensaje: opts.mensaje, icono: opts.icono ?? 'check', tono: opts.tono ?? 'info', cancelar: 'ok', acciones: [{ value: 'ok', label: opts.boton ?? 'Entendido', kind: 'primary' }] })
}

export function DialogHost() {
  const [pending, setPending] = useState<Pending | null>(null)
  const panel = useRef<HTMLDivElement>(null)

  useEffect(() => {
    listener = setPending
    return () => {
      listener = null
    }
  }, [])

  // Foco al abrir y cierre con Escape
  useEffect(() => {
    if (!pending) return
    const prev = document.activeElement as HTMLElement | null
    const first = panel.current?.querySelector<HTMLButtonElement>('.dlg__actions .btn--primary, .dlg__actions .btn--danger, .dlg__actions button')
    first?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        cerrar(pending.opts.cancelar ?? null)
      }
    }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
      prev?.focus?.()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pending])

  const cerrar = (value: string | null) => {
    pending?.resolve(value)
    setPending(null)
  }

  if (!pending) return null
  const { opts } = pending
  return (
    <div className="dlg" role="presentation">
      <div className="dlg__backdrop" onClick={() => cerrar(opts.cancelar ?? null)} />
      <div className={`dlg__panel dlg__panel--${opts.tono ?? 'info'}`} role="dialog" aria-modal="true" aria-labelledby="dlg-title" ref={panel}>
        {opts.icono && (
          <span className="dlg__icon" aria-hidden="true">
            <Icon name={opts.icono} size={24} />
          </span>
        )}
        <h2 id="dlg-title" className="dlg__title">
          {opts.titulo}
        </h2>
        {opts.mensaje && <div className="dlg__msg">{opts.mensaje}</div>}
        <div className="dlg__actions">
          {opts.acciones.map((a) => (
            <button type="button" key={a.value} className={`btn btn--${a.kind ?? 'ghost'}`} onClick={() => cerrar(a.value)}>
              {a.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
