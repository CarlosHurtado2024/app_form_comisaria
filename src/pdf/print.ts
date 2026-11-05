import escudo from '../assets/escudo.png?inline'
import pdet from '../assets/pdet.png?inline'
import pie from '../assets/pie.png?inline'
import type { FormData } from '../form/types'
import type { Profile } from '../store/storage'
import { buildPrintHtml } from './html'

/**
 * Abre el informe en formato HTML (fiel a la plantilla F-PM-096) en una pestaña nueva,
 * listo para "Guardar como PDF" o imprimir con el motor del navegador.
 * La pestaña se abre de inmediato (dentro del gesto del usuario, para que el navegador no la
 * bloquee) y se rellena cuando los datos, por ejemplo las fotos, están listos.
 * Devuelve false si el navegador bloqueó la ventana emergente.
 */
export function openPrintView(data: FormData | Promise<FormData>, profile: Profile): boolean {
  const win = window.open('', '_blank')
  if (!win) return false
  try {
    win.document.write('<!DOCTYPE html><title>Preparando el informe…</title><p style="font:15px system-ui,sans-serif;padding:24px;color:#333">Preparando el informe…</p>')
    win.document.close()
  } catch {
    /* algunos navegadores no permiten escribir en la ventana nueva */
  }
  Promise.resolve(data)
    .then((d) => {
      const html = buildPrintHtml(d, profile, { escudo, pdet, pie })
      const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      win.location.replace(url)
      // Se mantiene la URL un rato para permitir recargar la pestaña.
      setTimeout(() => URL.revokeObjectURL(url), 10 * 60_000)
    })
    .catch(() => win.close())
  return true
}
