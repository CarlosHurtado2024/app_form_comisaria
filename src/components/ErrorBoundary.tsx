import { Component, type ErrorInfo, type ReactNode } from 'react'

interface State {
  error: Error | null
}

/** Borra la caché de la aplicación (service worker y archivos guardados) y recarga. No toca los informes. */
export async function repararAplicacion(): Promise<void> {
  try {
    const regs = (await navigator.serviceWorker?.getRegistrations()) ?? []
    await Promise.all(regs.map((r) => r.unregister()))
  } catch {
    /* sin service worker */
  }
  try {
    const claves = await caches.keys()
    await Promise.all(claves.map((k) => caches.delete(k)))
  } catch {
    /* sin Cache Storage */
  }
  location.reload()
}

/**
 * Si una pantalla falla al dibujarse, muestra el error en lugar de dejar la página en blanco,
 * con opciones para recargar o reparar la aplicación.
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('Error en la aplicación', error, info.componentStack)
  }

  render(): ReactNode {
    const { error } = this.state
    if (!error) return this.props.children
    return (
      <div className="crash" role="alert">
        <div className="crash__card">
          <h1 className="crash__title">La aplicación encontró un error</h1>
          <p className="crash__text">Sus informes guardados no se pierden. Pruebe recargar; si el error continúa, use «Reparar aplicación».</p>
          <pre className="crash__detail">{`${error.name}: ${error.message}`}</pre>
          <div className="crash__actions">
            <button type="button" className="btn btn--primary" onClick={() => location.reload()}>
              Recargar
            </button>
            <button type="button" className="btn btn--ghost" onClick={() => void repararAplicacion()}>
              Reparar aplicación
            </button>
          </div>
        </div>
      </div>
    )
  }
}
