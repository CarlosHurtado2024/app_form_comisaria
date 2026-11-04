import { supabase, type PerfilRow } from './supabase'

type Respuesta<T = Record<string, unknown>> = ({ ok: true } & T) | { ok?: false; error: string }

async function invocar<T = Record<string, unknown>>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke<Respuesta<T>>('admin-users', { body })
  if (error) {
    // La función devuelve el detalle en el cuerpo de la respuesta
    const ctx = (error as { context?: Response }).context
    if (ctx && typeof ctx.json === 'function') {
      try {
        const j = (await ctx.json()) as { error?: string }
        if (j.error) throw new Error(j.error)
      } catch (e) {
        if (e instanceof Error && e.message) throw e
      }
    }
    throw new Error(error.message)
  }
  if (!data || data.ok !== true) throw new Error((data as { error?: string })?.error ?? 'Error en el servidor')
  return data as T
}

export interface NuevoUsuario {
  correo: string
  clave: string
  nombre: string
  tarjeta_profesional?: string
  cargo?: string
  rol: 'admin' | 'profesional'
}

export const adminApi = {
  crearUsuario: (u: NuevoUsuario) => invocar<{ usuario_id: string }>({ accion: 'crear', ...u }),
  restablecerClave: (usuario_id: string, clave: string) => invocar({ accion: 'restablecer_clave', usuario_id, clave }),
  activar: (usuario_id: string, activo: boolean) => invocar({ accion: 'activar', usuario_id, activo }),
  listar: () => invocar<{ usuarios: PerfilRow[] }>({ accion: 'listar' }).then((r) => r.usuarios),
}
