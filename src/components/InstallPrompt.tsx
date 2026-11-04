import { useEffect, useState } from 'react'

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const DISMISS_KEY = 'its.install.dismissed'
const DISMISS_DAYS = 7

function isStandalone(): boolean {
  return window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true
}

function isIos(): boolean {
  const ua = navigator.userAgent
  return /iPhone|iPad|iPod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
}

function isMobile(): boolean {
  return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) || navigator.maxTouchPoints > 1
}

function recentlyDismissed(): boolean {
  try {
    const t = Number(localStorage.getItem(DISMISS_KEY) ?? 0)
    return Date.now() - t < DISMISS_DAYS * 86_400_000
  } catch {
    return false
  }
}

function rememberDismiss(): void {
  try {
    localStorage.setItem(DISMISS_KEY, String(Date.now()))
  } catch {
    /* sin almacenamiento */
  }
}

/**
 * Aviso para instalar la aplicación en el dispositivo.
 * - Android/Chrome/Edge: usa el evento nativo `beforeinstallprompt`.
 * - iPhone/iPad (Safari): muestra las instrucciones de "Agregar a pantalla de inicio".
 */
export function InstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null)
  // Safari en iOS no emite beforeinstallprompt: se muestran instrucciones manuales desde el inicio.
  const [ios] = useState(() => isIos() && isMobile() && !isStandalone() && !recentlyDismissed())
  const [visible, setVisible] = useState(ios)

  useEffect(() => {
    if (isStandalone() || recentlyDismissed()) return
    const onPrompt = (e: Event) => {
      e.preventDefault()
      setDeferred(e as BeforeInstallPromptEvent)
      setVisible(true)
    }
    window.addEventListener('beforeinstallprompt', onPrompt)
    const onInstalled = () => setVisible(false)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  const install = async () => {
    if (!deferred) return
    await deferred.prompt()
    const { outcome } = await deferred.userChoice
    if (outcome === 'accepted') setVisible(false)
    setDeferred(null)
  }

  const dismiss = () => {
    rememberDismiss()
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div className="install" role="dialog" aria-label="Instalar la aplicación">
      <div className="install__icon" aria-hidden="true">
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 3v12" />
          <path d="M7 10l5 5 5-5" />
          <path d="M4 19h16" />
        </svg>
      </div>
      <div className="install__text">
        <strong>Instalar la aplicación</strong>
        {ios ? (
          <span>
            En Safari toque <b>Compartir</b> <span aria-hidden="true">⎙</span> y luego <b>"Agregar a pantalla de inicio"</b>. Así funciona sin conexión y abre como una app.
          </span>
        ) : (
          <span>Agréguela a la pantalla de inicio para usarla sin conexión y abrirla como una app.</span>
        )}
      </div>
      <div className="install__actions">
        {!ios && (
          <button type="button" className="btn btn--gold btn--sm" onClick={install}>
            Instalar
          </button>
        )}
        <button type="button" className="btn btn--ghost btn--sm" onClick={dismiss}>
          {ios ? 'Entendido' : 'Ahora no'}
        </button>
      </div>
    </div>
  )
}
