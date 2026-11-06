/** Versión de la aplicación (commit y fecha de compilación), definida en vite.config.ts. */
declare const __APP_VERSION__: string

export const APP_VERSION: string = typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : 'desarrollo'

type Buscador = () => Promise<boolean>
let buscador: Buscador | null = null

/** Registra la función que consulta al service worker si hay una versión nueva. */
export function registrarBuscadorDeActualizacion(fn: Buscador): void {
  buscador = fn
}

/** Busca una versión nueva; devuelve true si hay una esperando (se mostrará el aviso). */
export async function buscarActualizacion(): Promise<boolean> {
  if (!buscador) return false
  try {
    return await buscador()
  } catch {
    return false
  }
}
