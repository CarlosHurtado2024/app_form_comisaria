import { useEffect, useState } from 'react'

export interface ToastMessage {
  text: string
  kind?: 'info' | 'error'
}

let listeners: ((m: ToastMessage) => void)[] = []

export function toast(text: string, kind: 'info' | 'error' = 'info'): void {
  listeners.forEach((l) => l({ text, kind }))
}

export function ToastHost() {
  const [msg, setMsg] = useState<ToastMessage | null>(null)
  useEffect(() => {
    const l = (m: ToastMessage) => setMsg(m)
    listeners.push(l)
    return () => {
      listeners = listeners.filter((x) => x !== l)
    }
  }, [])
  useEffect(() => {
    if (!msg) return
    const t = setTimeout(() => setMsg(null), msg.kind === 'error' ? 6000 : 3200)
    return () => clearTimeout(t)
  }, [msg])
  if (!msg) return null
  return (
    <div className={`toast${msg.kind === 'error' ? ' toast--error' : ''}`} role="status" aria-live="polite">
      {msg.text}
    </div>
  )
}
