import { useCallback, useEffect, useRef, useState } from 'react'
import { storageFor } from './storage'
import { sincronizar, type SyncResult } from './sync'

export interface SyncState {
  sincronizando: boolean
  ultima?: Date
  pendientes: number
  error?: string
  online: boolean
}

/**
 * Mantiene sincronizado el almacén local del usuario con Supabase:
 * al iniciar, al recuperar la conexión, cada minuto y cuando se solicita tras guardar.
 */
export function useSync(uid: string | undefined) {
  const [state, setState] = useState<SyncState>({ sincronizando: false, pendientes: 0, online: typeof navigator === 'undefined' || navigator.onLine })
  const running = useRef(false)
  const timer = useRef<number | undefined>(undefined)
  const listeners = useRef(new Set<(r: SyncResult) => void>())

  const run = useCallback(async () => {
    if (!uid || running.current) return
    running.current = true
    setState((s) => ({ ...s, sincronizando: true }))
    const store = storageFor(uid)
    const r = await sincronizar(uid, store)
    running.current = false
    setState((s) => ({ ...s, sincronizando: false, ultima: r.error ? s.ultima : new Date(), pendientes: store.pendingCount(), error: r.error }))
    listeners.current.forEach((l) => l(r))
  }, [uid])

  /** Programa una sincronización en unos segundos (tras guardar). */
  const schedule = useCallback(
    (ms = 2500) => {
      window.clearTimeout(timer.current)
      timer.current = window.setTimeout(() => void run(), ms)
    },
    [run],
  )

  useEffect(() => {
    if (!uid) return
    void run()
    const onOnline = () => {
      setState((s) => ({ ...s, online: true }))
      void run()
    }
    const onOffline = () => setState((s) => ({ ...s, online: false }))
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    const every = window.setInterval(() => void run(), 60_000)
    return () => {
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
      window.clearInterval(every)
      window.clearTimeout(timer.current)
    }
  }, [uid, run])

  const subscribe = useCallback((l: (r: SyncResult) => void) => {
    listeners.current.add(l)
    return () => void listeners.current.delete(l)
  }, [])

  return { state, run, schedule, subscribe }
}
