/**
 * Entrega de un archivo generado (PDF o Word) al usuario.
 *
 * En el celular, compartir exige que `navigator.share` se llame dentro de un gesto del usuario;
 * como generar el archivo puede tardar varios segundos, primero se genera y luego se muestra
 * un diálogo "Documento listo" cuyo botón Compartir sí ocurre dentro del toque.
 */
import { dialogo } from '../components/Dialog'

export const puedeCompartirArchivos = (): boolean => typeof navigator !== 'undefined' && typeof navigator.share === 'function' && typeof navigator.canShare === 'function'

function descargar(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

/** Devuelve el modo usado: 'share', 'download' o 'cancel'. */
export async function entregarArchivo(blob: Blob, name: string, mime: string, titulo: string): Promise<'share' | 'download' | 'cancel'> {
  const file = new File([blob], name, { type: mime })
  const compartible = puedeCompartirArchivos() && navigator.canShare({ files: [file] })
  if (!compartible) {
    descargar(blob, name)
    return 'download'
  }
  const r = await dialogo({
    titulo,
    mensaje: `${name}. Puede enviarlo por WhatsApp o correo, o guardarlo en el dispositivo.`,
    icono: 'file',
    cancelar: 'cancelar',
    acciones: [
      { value: 'cancelar', label: 'Cancelar', kind: 'ghost' },
      { value: 'guardar', label: 'Guardar', kind: 'ghost' },
      { value: 'compartir', label: 'Compartir', kind: 'primary' },
    ],
  })
  if (r === 'compartir') {
    try {
      await navigator.share({ files: [file], title: name })
      return 'share'
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return 'cancel'
      // Si el sistema no permitió compartir, se guarda el archivo
      descargar(blob, name)
      return 'download'
    }
  }
  if (r === 'guardar') {
    descargar(blob, name)
    return 'download'
  }
  return 'cancel'
}
