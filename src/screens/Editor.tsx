import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from '../auth/AuthContext'
import { BlockView } from '../components/BlockView'
import { FormContext, type FormApi } from '../components/FormContext'
import { ExportMenu } from '../components/ExportMenu'
import { TopBar } from '../components/TopBar'
import { conFotosParaPdf } from '../evidencias/fotos'
import { dialogo } from '../components/Dialog'
import { toast } from '../components/Toast'
import { sectionsDone } from '../form/progress'
import { sections } from '../form/schema'
import { asString, type FieldValue, type FormData } from '../form/types'
import { edadEn, normalizeData, pruneHidden } from '../form/visibility'
import { navigate } from '../hooks/useHashRoute'
import { downloadDocx } from '../docx/download'
import { canShareFiles, downloadPdf } from '../pdf/download'
import { isEmptyReport, storageFor, type Report } from '../store/storage'
import { useSyncContext } from '../store/SyncContext'

interface Props {
  id: string
  sectionId?: string
}

export function Editor({ id, sectionId }: Props) {
  const { perfil, profile } = useAuth()
  const uid = perfil!.id
  const storage = useMemo(() => storageFor(uid), [uid])
  const sync = useSyncContext()
  const [report, setReport] = useState<Report | undefined>(() => {
    const r = storage.getReport(id)
    return r ? { ...r, data: normalizeData(r.data) } : r
  })
  const [saved, setSaved] = useState(true)
  const [busy, setBusy] = useState(false)
  const timer = useRef<number | undefined>(undefined)
  // Estado del informe al abrirlo, para poder "salir sin guardar"
  const original = useRef<Report | undefined>(storage.getReport(id))
  // El usuario decidió conservar un informe aunque esté vacío
  const conservar = useRef(false)
  const reportRef = useRef(report)
  useEffect(() => {
    reportRef.current = report
  }, [report])

  const index = Math.max(
    0,
    sections.findIndex((s) => s.id === sectionId),
  )
  const section = sections[index]

  // Autoguardado local con retardo corto; la sincronización se programa después
  const persist = useCallback(
    (r: Report) => {
      window.clearTimeout(timer.current)
      timer.current = window.setTimeout(() => {
        storage.saveReport(r)
        setSaved(true)
        sync.schedule()
      }, 400)
    },
    [storage, sync],
  )

  useEffect(() => () => window.clearTimeout(timer.current), [])

  // Al salir del editor por cualquier vía, un informe vacío que nunca se subió se descarta
  useEffect(
    () => () => {
      const r = reportRef.current
      if (!r || conservar.current) return
      const actual = storage.getReport(r.id) ?? r
      if (!actual.syncedAt && !actual.codigo && isEmptyReport(actual.data, profile)) storage.removeRaw(actual.id)
    },
    [storage, profile],
  )

  // Si la sincronización trae el código del informe, reflejarlo sin perder cambios locales
  useEffect(
    () =>
      sync.subscribe(() => {
        const fresh = storage.getReport(id)
        if (fresh) setReport((prev) => (prev && prev.codigo !== fresh.codigo ? { ...prev, codigo: fresh.codigo } : prev))
      }),
    [sync, storage, id],
  )

  const api: FormApi | null = useMemo(() => {
    if (!report) return null
    return {
      data: report.data,
      informeId: report.id,
      uid,
      set: (key: string, value: FieldValue) => {
        setReport((prev) => {
          if (!prev) return prev
          let data: FormData = { ...prev.data, [key]: value }
          // Edad calculada con la fecha de nacimiento y la fecha de elaboración del informe
          if (key === 'fecha_nacimiento' || key === 'fecha_elaboracion') {
            const edad = edadEn(asString(data.fecha_nacimiento), asString(data.fecha_elaboracion) || new Date().toISOString().slice(0, 10))
            if (edad) data = { ...data, edad_anios: String(edad.anios), edad_meses: String(edad.meses) }
            else if (key === 'fecha_nacimiento' && !asString(data.fecha_nacimiento)) data = { ...data, edad_anios: '', edad_meses: '' }
          }
          // Los campos que quedan ocultos por la lógica del formulario se vacían
          data = pruneHidden(data)
          const next = { ...prev, data }
          setSaved(false)
          persist(next)
          return next
        })
      },
    }
  }, [report, persist, uid])

  const flush = () => {
    if (!report) return
    window.clearTimeout(timer.current)
    if (!saved) {
      storage.saveReport(report)
      setSaved(true)
      sync.schedule(500)
    }
  }

  /** Cierre del informe con confirmación: guardar, salir sin guardar o descartar si está vacío. */
  const cerrar = async () => {
    if (!report) return navigate({ name: 'home' })
    const vacio = isEmptyReport(report.data, profile)
    if (vacio) {
      const r = await dialogo({
        titulo: 'Este informe está vacío',
        mensaje: 'Todavía no ha escrito nada en él. ¿Desea conservarlo o descartarlo?',
        icono: 'file',
        tono: 'warn',
        cancelar: 'seguir',
        acciones: [
          { value: 'seguir', label: 'Seguir editando', kind: 'ghost' },
          { value: 'descartar', label: 'Descartar y salir', kind: 'danger' },
          { value: 'guardar', label: 'Guardar vacío', kind: 'primary' },
        ],
      })
      if (r === 'seguir' || r === null) return
      if (r === 'descartar') {
        window.clearTimeout(timer.current)
        conservar.current = true
        storage.deleteReport(report.id)
        sync.schedule(500)
        toast('Informe descartado')
        return navigate({ name: 'home' })
      }
      conservar.current = true
      flush()
      return navigate({ name: 'home' })
    }
    const cambios = !saved || JSON.stringify(original.current?.data ?? null) !== JSON.stringify(report.data)
    if (!cambios) return navigate({ name: 'home' })
    const r = await dialogo({
      titulo: '¿Salir del informe?',
      mensaje: 'Puede guardar los cambios o salir sin guardarlos.',
      icono: 'file',
      cancelar: 'seguir',
      acciones: [
        { value: 'seguir', label: 'Seguir editando', kind: 'ghost' },
        { value: 'sin', label: 'Salir sin guardar', kind: 'danger' },
        { value: 'guardar', label: 'Guardar y salir', kind: 'primary' },
      ],
    })
    if (r === 'seguir' || r === null) return
    window.clearTimeout(timer.current)
    if (r === 'sin') {
      const orig = original.current
      if (orig && !isEmptyReport(orig.data, profile)) storage.saveReport(orig)
      else if (orig && (orig.syncedAt || orig.codigo)) storage.saveReport(orig)
      else storage.deleteReport(report.id)
      conservar.current = true
      sync.schedule(500)
      return navigate({ name: 'home' })
    }
    conservar.current = true
    flush()
    navigate({ name: 'home' })
  }

  const go = (i: number) => {
    flush()
    navigate({ name: 'editor', id, section: sections[i].id })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const pdfData = (): Promise<FormData> => conFotosParaPdf(report!.id, { ...report!.data, _codigo: report!.codigo ?? '' })

  /** En el celular abre el menú de compartir (guardar, WhatsApp, correo); en PC descarga el archivo. */
  const modoSalida = (): 'download' | 'share' => (canShareFiles() ? 'share' : 'download')

  const exportPdf = async () => {
    if (!report) return
    flush()
    setBusy(true)
    try {
      const used = await downloadPdf(await pdfData(), profile, modoSalida())
      toast(used === 'share' ? 'PDF compartido' : used === 'open' ? 'PDF abierto en una pestaña nueva' : 'PDF descargado')
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return
      toast(e instanceof Error ? e.message : 'No se pudo generar el PDF', 'error')
    } finally {
      setBusy(false)
    }
  }

  const exportDocx = async () => {
    if (!report) return
    flush()
    setBusy(true)
    try {
      const used = await downloadDocx(await pdfData(), profile, modoSalida())
      toast(used === 'share' ? 'Documento Word compartido' : 'Documento Word descargado')
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return
      toast(e instanceof Error ? e.message : 'No se pudo generar el PDF', 'error')
    } finally {
      setBusy(false)
    }
  }

  if (!report || !api) {
    return (
      <>
        <TopBar title="Informe no encontrado" onBack={() => navigate({ name: 'home' })} />
        <main className="page">
          <div className="card empty">
            <h2>El informe no está en este dispositivo</h2>
            <p>Si lo creó en otro equipo, sincronice desde el inicio con conexión a internet.</p>
            <button type="button" className="btn btn--primary" onClick={() => navigate({ name: 'home' })}>
              Volver al inicio
            </button>
          </div>
        </main>
      </>
    )
  }

  const nna = `${asString(report.data.nombres)} ${asString(report.data.apellidos)}`.trim()
  const done = sectionsDone(report.data)
  const firmaOk = !!profile.firma

  return (
    <FormContext.Provider value={api}>
      <TopBar
        title={nna || 'Nuevo informe'}
        subtitle={`${report.codigo ?? 'Código pendiente'} · Sección ${index + 1} de ${sections.length} · ${section.short}`}
        onBack={() => void cerrar()}
        right={
          <>
            <span className="status" aria-live="polite">
              {saved ? 'Guardado' : 'Guardando…'}
            </span>
            <ExportMenu busy={busy} onPdf={() => void exportPdf()} onDocx={() => void exportDocx()} />
          </>
        }
      />
      <main className="page editor">
        <nav className="editor__nav" aria-label="Secciones del informe">
          <div className="steps">
            {sections.map((s, i) => (
              <button
                type="button"
                key={s.id}
                className={`step${i === index ? ' step--active' : ''}${done.has(s.id) ? ' step--done' : ''}`}
                onClick={() => go(i)}
                aria-current={i === index ? 'step' : undefined}
              >
                <span className="step__num">{i + 1}</span>
                <span>{s.short}</span>
              </button>
            ))}
          </div>
        </nav>

        <section className="card section-card" key={section.id}>
          <div className="section-card__header">
            <h2>{section.title}</h2>
            <small>
              {report.codigo ? `Informe ${report.codigo}. ` : 'El código se asigna al sincronizar con el servidor. '}
              Los cambios se guardan automáticamente.
            </small>
          </div>
          <div className="section-card__body">
            {section.blocks.map((b, i) => (
              <BlockView key={i} block={b} />
            ))}

            {section.id === 'profesional' && (
              <div className="f-group">
                <span className="f-group__label">Firma del profesional</span>
                {firmaOk ? (
                  <div className="sig__preview">
                    <img src={profile.firma} alt="Firma registrada en el perfil" style={{ maxHeight: 100 }} />
                  </div>
                ) : (
                  <div className="banner" style={{ margin: 0 }}>
                    <div>
                      <strong>No hay firma registrada</strong>
                      Regístrela en el perfil para que aparezca en el PDF.
                    </div>
                  </div>
                )}
                <div className="actions-bar" style={{ justifyContent: 'flex-start' }}>
                  <button
                    type="button"
                    className="btn btn--ghost btn--sm"
                    onClick={() => {
                      flush()
                      navigate({ name: 'profile' })
                    }}
                  >
                    {firmaOk ? 'Cambiar firma en el perfil' : 'Ir al perfil'}
                  </button>
                </div>
              </div>
            )}
          </div>
          <div className="section-card__footer">
            <button type="button" className="btn btn--ghost" onClick={() => go(index - 1)} disabled={index === 0}>
              ← Anterior
            </button>
            {index < sections.length - 1 ? (
              <button type="button" className="btn btn--primary" onClick={() => go(index + 1)}>
                Siguiente →
              </button>
            ) : (
              <ExportMenu variant="primary" label="Generar informe" busy={busy} onPdf={() => void exportPdf()} onDocx={() => void exportDocx()} />
            )}
          </div>
        </section>
      </main>
    </FormContext.Provider>
  )
}

