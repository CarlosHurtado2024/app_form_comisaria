import { createClient } from '@supabase/supabase-js'
import type { FormData } from '../form/types'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

/** Verdadero cuando las variables de entorno de Supabase están configuradas. */
export const supabaseConfigured = Boolean(url && key)

export const supabase = createClient(url ?? 'https://no-configurado.invalid', key ?? 'sin-clave', {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
})

export type Rol = 'admin' | 'profesional'

export interface PerfilRow {
  id: string
  correo: string
  nombre: string
  tarjeta_profesional: string | null
  cargo: string
  seccion: string
  dirigido_a: string | null
  firma: string | null
  rol: Rol
  activo: boolean
  debe_cambiar_clave: boolean
  creado_en: string
  actualizado_en: string
}

export interface InformeRow {
  id: string
  codigo: string | null
  autor_id: string
  nna_nombres: string | null
  nna_apellidos: string | null
  nna_documento: string | null
  fecha_elaboracion: string | null
  estado: 'borrador' | 'finalizado'
  datos: FormData
  eliminado_en: string | null
  creado_en: string
  actualizado_en: string
}

export const isOnline = (): boolean => typeof navigator === 'undefined' || navigator.onLine !== false

/** Mensajes de error de Supabase traducidos para la interfaz. */
export function mensajeError(e: unknown): string {
  const m = e instanceof Error ? e.message : typeof e === 'string' ? e : ''
  if (/invalid login credentials/i.test(m)) return 'Correo o contraseña incorrectos.'
  if (/email not confirmed/i.test(m)) return 'El correo no está confirmado.'
  if (/user is banned|banned/i.test(m)) return 'La cuenta está desactivada. Comuníquese con el administrador.'
  if (/failed to fetch|network|load failed/i.test(m)) return 'Sin conexión con el servidor. Verifique su internet.'
  if (/password should be at least/i.test(m)) return 'La contraseña debe tener al menos 8 caracteres.'
  if (/already been registered|already registered|duplicate/i.test(m)) return 'Ya existe un usuario con ese correo.'
  return m || 'Ocurrió un error inesperado.'
}
