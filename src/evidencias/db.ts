/**
 * Almacén local de fotos (IndexedDB). Guarda el archivo comprimido de cada evidencia
 * para trabajar sin conexión; `subida` indica si ya está en Supabase Storage.
 */

export interface FotoLocal {
  /** Identificador de la evidencia (coincide con el nombre del archivo en Storage) */
  id: string
  informeId: string
  /** Ruta en el bucket: <autor_id>/<informe_id>/<id>.jpg */
  ruta: string
  blob: Blob
  subida: boolean
  creadoEn: string
}

const DB = 'its-evidencias'
const STORE = 'fotos'

let dbPromise: Promise<IDBDatabase> | undefined

function abrir(): Promise<IDBDatabase> {
  dbPromise ??= new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('Este navegador no permite guardar fotos en el dispositivo.'))
      return
    }
    const req = indexedDB.open(DB, 1)
    req.onupgradeneeded = () => {
      const s = req.result.createObjectStore(STORE, { keyPath: 'id' })
      s.createIndex('informeId', 'informeId')
      s.createIndex('subida', 'subida')
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error ?? new Error('No se pudo abrir el almacén de fotos'))
  })
  return dbPromise
}

function tx<T>(modo: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return abrir().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(STORE, modo)
        const req = fn(t.objectStore(STORE))
        req.onsuccess = () => resolve(req.result)
        req.onerror = () => reject(req.error ?? new Error('Error en el almacén de fotos'))
      }),
  )
}

export const fotosDb = {
  guardar: (f: FotoLocal) => tx('readwrite', (s) => s.put(f)).then(() => undefined),
  obtener: (id: string) => tx<FotoLocal | undefined>('readonly', (s) => s.get(id) as IDBRequest<FotoLocal | undefined>),
  eliminar: (id: string) => tx('readwrite', (s) => s.delete(id)).then(() => undefined),
  porInforme: (informeId: string) => tx<FotoLocal[]>('readonly', (s) => s.index('informeId').getAll(informeId) as IDBRequest<FotoLocal[]>),
  todas: () => tx<FotoLocal[]>('readonly', (s) => s.getAll() as IDBRequest<FotoLocal[]>),
}
