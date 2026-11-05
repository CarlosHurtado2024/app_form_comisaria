import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import { fotosDb } from '../evidencias/db'
import { agregarFoto, eliminarFoto, evidenciasDe, MAX_FOTOS, obtenerBlob, type Evidencia } from '../evidencias/fotos'
import { asString, type PhotosBlock } from '../form/types'
import { confirmar } from './Dialog'
import { useForm } from './FormContext'
import { toast } from './Toast'

interface Vista {
  url?: string
  subida: boolean
  faltante: boolean
}

/** Miniaturas de las fotos: del dispositivo o descargadas del servidor. */
function useVistas(evidencias: Evidencia[], informeId: string): Record<string, Vista> {
  const [vistas, setVistas] = useState<Record<string, Vista>>({})
  const ids = evidencias.map((e) => e.id).join('|')
  useEffect(() => {
    let activo = true
    const urls: string[] = []
    const cargar = async () => {
      const next: Record<string, Vista> = {}
      for (const ev of evidencias) {
        const local = await fotosDb.obtener(ev.id).catch(() => undefined)
        const blob = local?.blob ?? (await obtenerBlob(ev, informeId))
        if (!activo) return
        if (blob) {
          const url = URL.createObjectURL(blob)
          urls.push(url)
          next[ev.id] = {
            url,
            subida: local ? local.subida : true,
            faltante: false,
          }
        } else {
          next[ev.id] = { subida: true, faltante: true }
        }
      }
      setVistas(next)
    }
    void cargar()
    return () => {
      activo = false
      urls.forEach((u) => URL.revokeObjectURL(u))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ids, informeId])
  return vistas
}

export function EvidenceField({ block }: { block: PhotosBlock }) {
  const { data, set, informeId, uid } = useForm()
  const habilitado = asString(data[block.enabledBy]) === 'Sí'
  const evidencias = evidenciasDe(data)
  const vistas = useVistas(habilitado ? evidencias : [], informeId ?? '')
  const [busy, setBusy] = useState(false)
  const camara = useRef<HTMLInputElement>(null)
  const galeria = useRef<HTMLInputElement>(null)

  if (!informeId || !uid) return null

  if (!habilitado) {
    return evidencias.length > 0 ? (
      <div className="field__hint">
        Hay {evidencias.length} fotografía{evidencias.length === 1 ? '' : 's'} guardada{evidencias.length === 1 ? '' : 's'}. Marque «Sí» para verlas e incluirlas en el PDF.
      </div>
    ) : null
  }

  const agregar = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    e.target.value = ''
    if (!files.length) return
    const cupo = MAX_FOTOS - evidencias.length
    if (cupo <= 0) return toast(`Máximo ${MAX_FOTOS} fotografías por informe`, 'error')
    setBusy(true)
    try {
      const nuevas: Evidencia[] = []
      for (const f of files.slice(0, cupo)) {
        if (!f.type.startsWith('image/')) continue
        nuevas.push(await agregarFoto(uid, informeId, f))
      }
      if (nuevas.length) set(block.key, [...evidencias, ...nuevas])
      if (files.length > cupo) toast(`Solo se agregaron ${cupo}: máximo ${MAX_FOTOS} fotografías`, 'error')
    } catch (err) {
      toast(err instanceof Error ? err.message : 'No se pudo agregar la foto', 'error')
    } finally {
      setBusy(false)
    }
  }

  const quitar = async (ev: Evidencia) => {
    if (!(await confirmar({ titulo: '¿Quitar esta fotografía?', mensaje: 'Se eliminará del informe y del servidor.', aceptar: 'Sí, quitar', peligro: true }))) return
    await eliminarFoto(uid, ev)
    set(
      block.key,
      evidencias.filter((x) => x.id !== ev.id),
    )
  }

  const describir = (id: string, descripcion: string) => {
    set(
      block.key,
      evidencias.map((x) => (x.id === id ? { ...x, descripcion } : x)),
    )
  }

  return (
    <div className="field">
      <span className="field__label">
        {block.label} ({evidencias.length}/{MAX_FOTOS})
      </span>
      {evidencias.length > 0 && (
        <div className="fotos">
          {evidencias.map((ev, i) => {
            const v = vistas[ev.id]
            return (
              <figure key={ev.id} className="foto">
                <div className="foto__img">
                  {v?.url ? <img src={v.url} alt={`Fotografía ${i + 1}`} /> : <span className="foto__estado">{v?.faltante ? 'No disponible sin conexión' : 'Cargando…'}</span>}
                  {v && !v.subida && <span className="tag foto__tag">Por subir</span>}
                </div>
                <figcaption>
                  <input className="input" placeholder={`Descripción de la foto ${i + 1}`} value={ev.descripcion ?? ''} onChange={(e) => describir(ev.id, e.target.value)} />
                  <button type="button" className="btn btn--danger btn--sm" onClick={() => void quitar(ev)}>
                    Quitar
                  </button>
                </figcaption>
              </figure>
            )
          })}
        </div>
      )}
      <div className="actions-bar" style={{ justifyContent: 'flex-start' }}>
        <input ref={camara} type="file" accept="image/*" capture="environment" hidden onChange={(e) => void agregar(e)} />
        <input ref={galeria} type="file" accept="image/*" multiple hidden onChange={(e) => void agregar(e)} />
        <button type="button" className="btn btn--primary" onClick={() => camara.current?.click()} disabled={busy || evidencias.length >= MAX_FOTOS}>
          {busy ? 'Procesando…' : 'Tomar foto'}
        </button>
        <button type="button" className="btn btn--ghost" onClick={() => galeria.current?.click()} disabled={busy || evidencias.length >= MAX_FOTOS}>
          Elegir de la galería
        </button>
      </div>
      <div className="field__hint">Las fotos se reducen automáticamente para ocupar poco espacio. Se suben al servidor en la siguiente sincronización.</div>
    </div>
  )
}
