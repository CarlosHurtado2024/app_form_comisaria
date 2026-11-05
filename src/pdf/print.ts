import escudo from '../assets/escudo.png?inline'
import pdet from '../assets/pdet.png?inline'
import pie from '../assets/pie.png?inline'
import type { FormData } from '../form/types'
import type { Profile } from '../store/storage'
import { buildPrintHtml } from './html'

/**
 * Abre el informe en formato HTML (fiel a la plantilla F-PM-096) en una pestaña nueva,
 * listo para "Guardar como PDF" o imprimir con el motor del navegador.
 * Devuelve false si el navegador bloqueó la ventana emergente.
 */
export function openPrintView(data: FormData, profile: Profile): boolean {
  const html = buildPrintHtml(data, profile, { escudo, pdet, pie })
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const win = window.open(url, '_blank')
  if (!win) {
    URL.revokeObjectURL(url)
    return false
  }
  // Se mantiene la URL un rato para permitir recargar la pestaña.
  setTimeout(() => URL.revokeObjectURL(url), 10 * 60_000)
  return true
}
