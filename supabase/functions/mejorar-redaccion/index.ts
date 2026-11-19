// Función Edge: mejora la redacción de un cuadro de texto con un modelo de Groq.
// Solo la usan profesionales autenticados y activos. La clave GROQ_API_KEY vive en los
// secretos de Supabase; el cliente nunca la conoce.
import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

const MAX_CARACTERES = 8000
const MODELO_POR_DEFECTO = 'llama-3.3-70b-versatile'

const INSTRUCCIONES = `Eres un corrector de estilo para informes de Trabajo Social de una Comisaría de Familia en Colombia.
Recibes el texto de un cuadro del informe y devuelves ese mismo texto con mejor redacción.

Reglas obligatorias:
- Corrige ortografía, tildes, puntuación, concordancia y gramática.
- Usa un tono técnico, claro, objetivo e institucional, en español de Colombia y en tercera persona.
- NO inventes, agregues ni quites hechos, datos, nombres, fechas, edades, direcciones, cifras ni conclusiones.
- NO cambies el sentido de lo escrito ni emitas opiniones nuevas.
- Conserva las marcas de formato tal cual: **negrita**, *cursiva*, __subrayado__, y al inicio de línea "• ", "▪ " o "1. " para listas. Mantén los saltos de línea y la estructura de listas.
- Si el texto ya está bien, devuélvelo casi igual.
- Responde ÚNICAMENTE con el texto corregido, sin comillas, sin títulos, sin explicaciones.`

/** Quita lo que a veces agrega el modelo: bloques de código, comillas envolventes o un prefijo. */
function limpiar(salida: string): string {
  let t = salida.trim()
  const bloque = /^```[a-z]*\n([\s\S]*?)\n```$/i.exec(t)
  if (bloque) t = bloque[1].trim()
  t = t.replace(/^(texto (corregido|mejorado)|versión (corregida|mejorada))\s*:\s*\n?/i, '')
  if (t.length > 1 && /^["“«]/.test(t) && /["”»]$/.test(t)) t = t.slice(1, -1).trim()
  return t
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Método no permitido' }, 405)

  const groqKey = Deno.env.get('GROQ_API_KEY')
  if (!groqKey) return json({ error: 'La mejora de redacción no está configurada (falta GROQ_API_KEY).' }, 503)

  const url = Deno.env.get('SUPABASE_URL')!
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
  const authHeader = req.headers.get('Authorization') ?? ''

  // 1) Usuario autenticado y activo
  const caller = createClient(url, anonKey, { global: { headers: { Authorization: authHeader } } })
  const { data: userData, error: userError } = await caller.auth.getUser()
  if (userError || !userData.user) return json({ error: 'No autenticado' }, 401)
  const { data: perfil } = await caller.from('perfiles').select('activo').eq('id', userData.user.id).single()
  if (!perfil?.activo) return json({ error: 'La cuenta no está activa' }, 403)

  // 2) Texto a mejorar
  let texto = ''
  try {
    const body = (await req.json()) as { texto?: unknown }
    texto = typeof body.texto === 'string' ? body.texto.trim() : ''
  } catch {
    return json({ error: 'Cuerpo inválido' }, 400)
  }
  if (!texto) return json({ error: 'No hay texto para mejorar' }, 400)
  if (texto.length > MAX_CARACTERES) return json({ error: `El texto es muy largo (máximo ${MAX_CARACTERES} caracteres).` }, 413)

  // 3) Llamada a Groq (API compatible con OpenAI)
  const resp = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${groqKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: Deno.env.get('GROQ_MODEL') || MODELO_POR_DEFECTO,
      temperature: 0.2,
      max_tokens: 4096,
      messages: [
        { role: 'system', content: INSTRUCCIONES },
        { role: 'user', content: texto },
      ],
    }),
  })

  if (resp.status === 429) return json({ error: 'Se alcanzó el límite gratuito de solicitudes. Intente de nuevo en un minuto.' }, 429)
  if (!resp.ok) {
    console.error('Groq', resp.status, await resp.text().catch(() => ''))
    return json({ error: 'El servicio de redacción no respondió. Intente de nuevo.' }, 502)
  }

  const data = (await resp.json()) as { choices?: { message?: { content?: string } }[] }
  const mejorado = limpiar(data.choices?.[0]?.message?.content ?? '')
  if (!mejorado) return json({ error: 'El servicio no devolvió texto.' }, 502)

  return json({ ok: true, texto: mejorado })
})
