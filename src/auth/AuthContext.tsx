import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase, type PerfilRow } from '../lib/supabase'
import type { Profile } from '../store/storage'

export type AuthStatus = 'cargando' | 'anonimo' | 'autenticado'

export interface AuthApi {
  status: AuthStatus
  session: Session | null
  perfil: PerfilRow | null
  /** Perfil en el formato que usan los generadores de PDF */
  profile: Profile
  esAdmin: boolean
  login: (correo: string, clave: string) => Promise<void>
  logout: () => Promise<void>
  cambiarClave: (nueva: string) => Promise<void>
  guardarPerfil: (patch: Partial<PerfilRow>) => Promise<void>
  recargarPerfil: () => Promise<void>
}

export const AuthContext = createContext<AuthApi | null>(null)

const perfilKey = (uid: string) => `its.perfil.v1.${uid}`

function leerPerfilCache(uid: string): PerfilRow | null {
  try {
    const raw = localStorage.getItem(perfilKey(uid))
    return raw ? (JSON.parse(raw) as PerfilRow) : null
  } catch {
    return null
  }
}

function guardarPerfilCache(p: PerfilRow): void {
  try {
    localStorage.setItem(perfilKey(p.id), JSON.stringify(p))
  } catch {
    /* sin almacenamiento */
  }
}

export function perfilToProfile(p: PerfilRow | null): Profile {
  return {
    nombre: p?.nombre ?? '',
    tarjeta: p?.tarjeta_profesional ?? '',
    seccion: p?.seccion ?? 'Trabajo Social - Comisaría de Familia',
    cargo: p?.cargo ?? 'Trabajador(a) Social',
    dirigidoA: p?.dirigido_a ?? '',
    firma: p?.firma ?? undefined,
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('cargando')
  const [session, setSession] = useState<Session | null>(null)
  const [perfil, setPerfil] = useState<PerfilRow | null>(null)

  const cargarPerfil = useCallback(async (uid: string): Promise<PerfilRow | null> => {
    const { data, error } = await supabase.from('perfiles').select('*').eq('id', uid).single()
    if (!error && data) {
      guardarPerfilCache(data as PerfilRow)
      return data as PerfilRow
    }
    // Sin conexión: usar la copia local
    return leerPerfilCache(uid)
  }, [])

  useEffect(() => {
    let activo = true
    const aplicar = async (s: Session | null) => {
      if (!activo) return
      setSession(s)
      if (!s) {
        setPerfil(null)
        setStatus('anonimo')
        return
      }
      const p = await cargarPerfil(s.user.id)
      if (!activo) return
      if (p && !p.activo) {
        await supabase.auth.signOut()
        setPerfil(null)
        setStatus('anonimo')
        return
      }
      setPerfil(p)
      setStatus('autenticado')
    }
    supabase.auth.getSession().then(({ data }) => aplicar(data.session))
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      if (event === 'SIGNED_OUT') void aplicar(null)
      else if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
        // Evitar recargar el perfil en cada refresco de token si ya está cargado
        setSession(s)
        if (event === 'SIGNED_IN') void aplicar(s)
      }
    })
    return () => {
      activo = false
      sub.subscription.unsubscribe()
    }
  }, [cargarPerfil])

  const login = useCallback(async (correo: string, clave: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email: correo.trim().toLowerCase(), password: clave })
    if (error) throw error
  }, [])

  const logout = useCallback(async () => {
    await supabase.auth.signOut()
  }, [])

  const cambiarClave = useCallback(
    async (nueva: string) => {
      const { error } = await supabase.auth.updateUser({ password: nueva })
      if (error) throw error
      if (perfil) {
        const { error: e2 } = await supabase.from('perfiles').update({ debe_cambiar_clave: false }).eq('id', perfil.id)
        if (e2) throw e2
        const next = { ...perfil, debe_cambiar_clave: false }
        guardarPerfilCache(next)
        setPerfil(next)
      }
    },
    [perfil],
  )

  const guardarPerfil = useCallback(
    async (patch: Partial<PerfilRow>) => {
      if (!perfil) return
      const { data, error } = await supabase.from('perfiles').update(patch).eq('id', perfil.id).select('*').single()
      if (error) throw error
      guardarPerfilCache(data as PerfilRow)
      setPerfil(data as PerfilRow)
    },
    [perfil],
  )

  const recargarPerfil = useCallback(async () => {
    if (!session) return
    const p = await cargarPerfil(session.user.id)
    if (p) setPerfil(p)
  }, [session, cargarPerfil])

  const value = useMemo<AuthApi>(
    () => ({
      status,
      session,
      perfil,
      profile: perfilToProfile(perfil),
      esAdmin: perfil?.rol === 'admin',
      login,
      logout,
      cambiarClave,
      guardarPerfil,
      recargarPerfil,
    }),
    [status, session, perfil, login, logout, cambiarClave, guardarPerfil, recargarPerfil],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthApi {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider')
  return ctx
}
