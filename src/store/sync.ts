import { olvidarFotosLocales, sincronizarFotos } from '../evidencias/fotos'
import { isOnline, supabase, type InformeRow } from '../lib/supabase'
import type { Report, Storage } from './storage'

export interface SyncResult {
  subidos: number
  bajados: number
  eliminados: number
  fotosSubidas: number
  error?: string
}

function rowToReport(row: InformeRow): Report {
  return {
    id: row.id,
    codigo: row.codigo,
    autorId: row.autor_id,
    createdAt: row.creado_en,
    updatedAt: row.actualizado_en,
    data: row.datos ?? {},
    dirty: false,
    syncedAt: new Date().toISOString(),
  }
}

/**
 * Sincroniza el almacén local de un usuario con Supabase.
 * 1. Sube los informes con cambios locales (el último cambio gana).
 * 2. Aplica las eliminaciones pendientes.
 * 3. Descarga los informes del usuario que no estén en el dispositivo o sean más recientes.
 */
export async function sincronizar(uid: string, store: Storage): Promise<SyncResult> {
  const result: SyncResult = { subidos: 0, bajados: 0, eliminados: 0, fotosSubidas: 0 }
  if (!isOnline()) return { ...result, error: 'Sin conexión' }

  try {
    // 1 y 2: cambios locales
    for (const r of store.listAllRaw()) {
      if (!r.dirty) continue
      if (r.deletedAt) {
        const { error } = await supabase.from('informes').update({ eliminado_en: r.deletedAt }).eq('id', r.id)
        if (error) throw error
        store.removeRaw(r.id)
        result.eliminados += 1
        continue
      }
      const { data, error } = await supabase
        .from('informes')
        .upsert(
          { id: r.id, autor_id: uid, datos: r.data, actualizado_en: r.updatedAt, creado_en: r.createdAt },
          { onConflict: 'id' },
        )
        .select('id, codigo, actualizado_en')
        .single()
      if (error) throw error
      store.putRaw({ ...r, codigo: data.codigo, updatedAt: data.actualizado_en, dirty: false, syncedAt: new Date().toISOString() })
      result.subidos += 1
    }

    // Fotos pendientes de subir o de borrar en Storage
    result.fotosSubidas = (await sincronizarFotos(uid)).subidas

    // 3: descargar
    const { data: rows, error } = await supabase.from('informes').select('*').eq('autor_id', uid)
    if (error) throw error
    const remoteIds = new Set<string>()
    for (const row of rows as InformeRow[]) {
      if (row.eliminado_en) {
        if (store.listAllRaw().some((x) => x.id === row.id)) {
          store.removeRaw(row.id)
          void olvidarFotosLocales(row.id)
        }
        continue
      }
      remoteIds.add(row.id)
      const local = store.listAllRaw().find((x) => x.id === row.id)
      if (!local) {
        store.putRaw(rowToReport(row))
        result.bajados += 1
      } else if (!local.dirty && (row.actualizado_en > local.updatedAt || local.codigo !== row.codigo)) {
        store.putRaw({ ...rowToReport(row), createdAt: local.createdAt })
        result.bajados += 1
      }
    }
    // Informes que ya no existen en el servidor (eliminados o reasignados) y no tienen cambios locales
    for (const local of store.listAllRaw()) {
      if (!local.dirty && local.syncedAt && !remoteIds.has(local.id)) {
        store.removeRaw(local.id)
        void olvidarFotosLocales(local.id)
      }
    }
  } catch (e) {
    result.error = e instanceof Error ? e.message : 'Error de sincronización'
  }
  return result
}
