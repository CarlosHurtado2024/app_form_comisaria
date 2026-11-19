import { supabase } from './supabase'

/** Pide a la función Edge `mejorar-redaccion` (Groq) una versión mejor redactada del texto con marcas. */
export async function mejorarRedaccion(texto: string): Promise<string> {
  const { data, error } = await supabase.functions.invoke<{ ok?: boolean; texto?: string; error?: string }>('mejorar-redaccion', {
    body: { texto },
  })
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
  if (!data?.ok || !data.texto) throw new Error(data?.error ?? 'El servicio no devolvió texto.')
  return data.texto
}
