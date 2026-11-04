// Función Edge: administración de usuarios (solo administradores).
// Acciones: crear, restablecer_clave, activar, listar.
// Usa la clave de servicio en el servidor; el cliente nunca la conoce.
import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

interface CrearPayload {
  accion: 'crear'
  correo: string
  clave: string
  nombre: string
  tarjeta_profesional?: string
  cargo?: string
  rol?: 'admin' | 'profesional'
}
interface ClavePayload {
  accion: 'restablecer_clave'
  usuario_id: string
  clave: string
}
interface ActivarPayload {
  accion: 'activar'
  usuario_id: string
  activo: boolean
}
interface ListarPayload {
  accion: 'listar'
}
type Payload = CrearPayload | ClavePayload | ActivarPayload | ListarPayload

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Método no permitido' }, 405)

  const url = Deno.env.get('SUPABASE_URL')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
  const authHeader = req.headers.get('Authorization') ?? ''

  // 1) Identificar al solicitante con su propio token
  const caller = createClient(url, anonKey, { global: { headers: { Authorization: authHeader } } })
  const { data: userData, error: userError } = await caller.auth.getUser()
  if (userError || !userData.user) return json({ error: 'No autenticado' }, 401)

  // 2) Verificar que sea administrador activo
  const admin = createClient(url, serviceKey)
  const { data: perfil } = await admin.from('perfiles').select('rol, activo').eq('id', userData.user.id).single()
  if (!perfil || perfil.rol !== 'admin' || !perfil.activo) return json({ error: 'Solo los administradores pueden hacer esto' }, 403)

  let payload: Payload
  try {
    payload = (await req.json()) as Payload
  } catch {
    return json({ error: 'Cuerpo inválido' }, 400)
  }

  try {
    switch (payload.accion) {
      case 'crear': {
        const correo = payload.correo?.trim().toLowerCase()
        if (!correo || !payload.clave || payload.clave.length < 8 || !payload.nombre?.trim()) {
          return json({ error: 'Correo, nombre y una clave de al menos 8 caracteres son obligatorios' }, 400)
        }
        const { data, error } = await admin.auth.admin.createUser({
          email: correo,
          password: payload.clave,
          email_confirm: true,
          user_metadata: {
            nombre: payload.nombre.trim(),
            tarjeta_profesional: payload.tarjeta_profesional?.trim() ?? '',
            cargo: payload.cargo?.trim() ?? '',
            rol: payload.rol === 'admin' ? 'admin' : 'profesional',
            debe_cambiar_clave: true,
          },
        })
        if (error) return json({ error: error.message }, 400)
        return json({ ok: true, usuario_id: data.user.id })
      }
      case 'restablecer_clave': {
        if (!payload.usuario_id || !payload.clave || payload.clave.length < 8) return json({ error: 'Clave de al menos 8 caracteres' }, 400)
        const { error } = await admin.auth.admin.updateUserById(payload.usuario_id, { password: payload.clave })
        if (error) return json({ error: error.message }, 400)
        await admin.from('perfiles').update({ debe_cambiar_clave: true }).eq('id', payload.usuario_id)
        return json({ ok: true })
      }
      case 'activar': {
        if (!payload.usuario_id) return json({ error: 'Falta el usuario' }, 400)
        if (payload.usuario_id === userData.user.id && !payload.activo) return json({ error: 'No puede desactivarse a sí mismo' }, 400)
        // Bloquea o permite el inicio de sesión y actualiza el perfil
        const { error } = await admin.auth.admin.updateUserById(payload.usuario_id, {
          ban_duration: payload.activo ? 'none' : '876000h',
        })
        if (error) return json({ error: error.message }, 400)
        await admin.from('perfiles').update({ activo: payload.activo }).eq('id', payload.usuario_id)
        return json({ ok: true })
      }
      case 'listar': {
        const { data, error } = await admin
          .from('perfiles')
          .select('id, correo, nombre, tarjeta_profesional, cargo, rol, activo, debe_cambiar_clave, creado_en')
          .order('nombre')
        if (error) return json({ error: error.message }, 400)
        return json({ ok: true, usuarios: data })
      }
      default:
        return json({ error: 'Acción desconocida' }, 400)
    }
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : 'Error inesperado' }, 500)
  }
})
