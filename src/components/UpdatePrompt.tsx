import { useEffect, useState } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'
import { registrarBuscadorDeActualizacion } from '../lib/version'
import { Icon } from './Icon'

/** Evento global: las pantallas con cambios pendientes los guardan de inmediato al recibirlo. */
export const FLUSH_EVENT = 'its:flush'

const CADA = 60 * 60 * 1000 // comprobar actualizaciones cada hora

/**
 * Aviso de nueva versión de la aplicación. "Actualizar" guarda primero lo pendiente
 * (los informes viven en el dispositivo, así que nada se pierde) y recarga con la versión nueva.
 */
export function UpdatePrompt() {
  const [pospuesto, setPospuesto] = useState(false)
  const [aplicando, setAplicando] = useState(false)
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, registration) {
      if (!registration) return
      // Buscar versiones nuevas periódicamente y al volver a la app
      const buscar = () => void registration.update().catch(() => undefined)
      registrarBuscadorDeActualizacion(async () => {
        await registration.update()
        return !!registration.waiting || !!registration.installing
      })
      setInterval(buscar, CADA)
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') buscar()
      })
    },
  })

  // Si se pospuso, volver a avisar cuando el usuario regrese a la app
  useEffect(() => {
    if (!pospuesto) return
    const onVisible = () => {
      if (document.visibilityState === 'visible') setPospuesto(false)
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [pospuesto])

  if (!needRefresh || pospuesto) return null

  const actualizar = async () => {
    setAplicando(true)
    // Guardar lo que haya pendiente antes de recargar
    window.dispatchEvent(new Event(FLUSH_EVENT))
    await new Promise((r) => setTimeout(r, 300))
    try {
      await updateServiceWorker(true)
    } catch {
      location.reload()
    }
  }

  const masTarde = () => {
    setPospuesto(true)
    setNeedRefresh(false)
  }

  return (
    <div className="update" role="dialog" aria-labelledby="update-title" aria-live="polite">
      <div className="update__icon" aria-hidden="true">
        <Icon name="refresh" size={22} />
      </div>
      <div className="update__text">
        <strong id="update-title">Nueva versión disponible</strong>
        Sus informes se guardan en este dispositivo antes de actualizar; no se pierde nada.
      </div>
      <div className="update__actions">
        <button type="button" className="btn btn--ghost btn--sm" onClick={masTarde} disabled={aplicando}>
          Más tarde
        </button>
        <button type="button" className="btn btn--primary btn--sm" onClick={() => void actualizar()} disabled={aplicando}>
          {aplicando ? 'Actualizando…' : 'Actualizar'}
        </button>
      </div>
    </div>
  )
}
