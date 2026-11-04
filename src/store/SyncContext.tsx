import { createContext, useContext } from 'react'
import type { useSync } from './useSync'

export type SyncApi = ReturnType<typeof useSync>

export const SyncContext = createContext<SyncApi | null>(null)

export function useSyncContext(): SyncApi {
  const ctx = useContext(SyncContext)
  if (!ctx) throw new Error('useSyncContext debe usarse dentro de SyncContext')
  return ctx
}
