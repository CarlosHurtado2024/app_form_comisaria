/**
 * Evidencia fotográfica del informe.
 *
 * - Los metadatos viven en el informe (`data.evidencias`: [{ id, ruta, descripcion }]) y se
 *   sincronizan con el resto del formulario.
 * - El archivo comprimido se guarda en IndexedDB y se sube a Supabase Storage (bucket privado
 *   `evidencias`) en la siguiente sincronización. Las eliminaciones pendientes se recuerdan
 *   en localStorage hasta que haya conexión.
 */
import { asRows, type FieldValue, type FormData, type TableRow } from '../form/types'
import { isOnline, supabase } from '../lib/supabase'
import { fotosDb, type FotoLocal } from './db'

export const BUCKET = 'evidencias'
export const MAX_FOTOS = 12
const MAX_LADO = 1600
const CALIDAD = 0.82

export interface Evidencia extends TableRow {
  id: string
  ruta: string
  descripcion: string
}

export const evidenciasDe = (data: FormData): Evidencia[] => asRows(data.evidencias).filter((r): r is Evidencia => typeof r.id === 'string' && typeof r.ruta === 'string')

export const anexaEvidencia = (data: FormData): boolean => data.anexa_evidencia === 'Sí'

const uuid = (): string =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0
        return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16)
      })

// ---------- Compresión en el navegador ----------

async function decodificar(file: Blob): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(file, { imageOrientation: 'from-image' })
    } catch {
      /* formato no soportado por createImageBitmap: usar <img> */
    }
  }
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(img)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('No se pudo leer la imagen'))
    }
    img.src = url
  })
}

/** Reduce la foto a máximo 1600 px por lado y la convierte a JPEG. */
export async function comprimirFoto(file: Blob): Promise<Blob> {
  const img = await decodificar(file)
  const w = 'naturalWidth' in img ? img.naturalWidth : img.width
  const h = 'naturalHeight' in img ? img.naturalHeight : img.height
  const s = Math.min(1, MAX_LADO / Math.max(w, h))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(w * s))
  canvas.height = Math.max(1, Math.round(h * s))
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('No se pudo procesar la imagen')
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
  if ('close' in img) img.close()
  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/jpeg', CALIDAD))
  if (!blob) throw new Error('No se pudo comprimir la imagen')
  return blob
}

// ---------- Altas y bajas ----------

/** Comprime y guarda una foto en el dispositivo; devuelve el registro para `data.evidencias`. */
export async function agregarFoto(uid: string, informeId: string, file: Blob): Promise<Evidencia> {
  const id = uuid()
  const ruta = `${uid}/${informeId}/${id}.jpg`
  const blob = await comprimirFoto(file)
  await fotosDb.guardar({
    id,
    informeId,
    ruta,
    blob,
    subida: false,
    creadoEn: new Date().toISOString(),
  })
  return { id, ruta, descripcion: '' }
}

const claveBorrar = (uid: string) => `its.evidencias.borrar.${uid}`

function pendientesBorrar(uid: string): string[] {
  try {
    return JSON.parse(localStorage.getItem(claveBorrar(uid)) ?? '[]') as string[]
  } catch {
    return []
  }
}

function guardarPendientesBorrar(uid: string, rutas: string[]): void {
  try {
    if (rutas.length) localStorage.setItem(claveBorrar(uid), JSON.stringify(rutas))
    else localStorage.removeItem(claveBorrar(uid))
  } catch {
    /* sin almacenamiento */
  }
}

/** Quita la foto del dispositivo y programa su borrado en el servidor. */
export async function eliminarFoto(uid: string, ev: Evidencia): Promise<void> {
  const local = await fotosDb.obtener(ev.id).catch(() => undefined)
  await fotosDb.eliminar(ev.id).catch(() => undefined)
  // Si nunca se subió no hay nada que borrar en el servidor
  if (local && !local.subida) return
  guardarPendientesBorrar(uid, [...new Set([...pendientesBorrar(uid), ev.ruta])])
}

/** Programa el borrado de todas las fotos de un informe (al eliminar el informe). */
export async function eliminarFotosDeInforme(uid: string, informeId: string, data: FormData): Promise<void> {
  for (const ev of evidenciasDe(data)) await eliminarFoto(uid, ev)
  const locales = await fotosDb.porInforme(informeId).catch(() => [] as FotoLocal[])
  for (const f of locales) await fotosDb.eliminar(f.id).catch(() => undefined)
}

/** Borra solo las copias locales de un informe que ya no está en este dispositivo. */
export async function olvidarFotosLocales(informeId: string): Promise<void> {
  const locales = await fotosDb.porInforme(informeId).catch(() => [] as FotoLocal[])
  for (const f of locales) await fotosDb.eliminar(f.id).catch(() => undefined)
}

// ---------- Lectura ----------

/** Devuelve el archivo de la foto: del dispositivo o, si no está, descargado de Storage. */
export async function obtenerBlob(ev: Evidencia, informeId: string): Promise<Blob | undefined> {
  const local = await fotosDb.obtener(ev.id).catch(() => undefined)
  if (local) return local.blob
  if (!isOnline()) return undefined
  const { data, error } = await supabase.storage.from(BUCKET).download(ev.ruta)
  if (error || !data) return undefined
  await fotosDb
    .guardar({
      id: ev.id,
      informeId,
      ruta: ev.ruta,
      blob: data,
      subida: true,
      creadoEn: new Date().toISOString(),
    })
    .catch(() => undefined)
  return data
}

function blobADataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(r.result as string)
    r.onerror = () => reject(r.error ?? new Error('No se pudo leer la foto'))
    r.readAsDataURL(blob)
  })
}

/**
 * Prepara los datos del informe para el PDF: si el profesional anexa evidencia, agrega
 * `_fotos` = [{ descripcion, src }] con las imágenes como data URL.
 */
export async function conFotosParaPdf(informeId: string, data: FormData): Promise<FormData> {
  if (!anexaEvidencia(data)) return data
  const fotos: TableRow[] = []
  for (const ev of evidenciasDe(data)) {
    const blob = await obtenerBlob(ev, informeId)
    if (blob)
      fotos.push({
        descripcion: ev.descripcion ?? '',
        src: await blobADataUrl(blob),
      })
  }
  return { ...data, _fotos: fotos as FieldValue }
}

// ---------- Sincronización ----------

export interface SyncFotosResult {
  subidas: number
  borradas: number
}

/** Sube las fotos pendientes y aplica los borrados pendientes. Lanza error si falla la red. */
export async function sincronizarFotos(uid: string): Promise<SyncFotosResult> {
  const r: SyncFotosResult = { subidas: 0, borradas: 0 }
  const todas = await fotosDb.todas().catch(() => [] as FotoLocal[])
  for (const f of todas) {
    if (f.subida || !f.ruta.startsWith(`${uid}/`)) continue
    const { error } = await supabase.storage.from(BUCKET).upload(f.ruta, f.blob, { contentType: 'image/jpeg', upsert: true })
    if (error) throw error
    await fotosDb.guardar({ ...f, subida: true })
    r.subidas += 1
  }
  const borrar = pendientesBorrar(uid)
  if (borrar.length) {
    const { error } = await supabase.storage.from(BUCKET).remove(borrar)
    if (error) throw error
    guardarPendientesBorrar(uid, [])
    r.borradas = borrar.length
  }
  return r
}

/** Cantidad de fotos que aún no se han subido al servidor. */
export async function fotosPendientes(uid: string): Promise<number> {
  const todas = await fotosDb.todas().catch(() => [] as FotoLocal[])
  return todas.filter((f) => !f.subida && f.ruta.startsWith(`${uid}/`)).length + pendientesBorrar(uid).length
}
