import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { BlockView } from '../components/BlockView'
import { FormContext, type FormApi } from '../components/FormContext'
import { TopBar } from '../components/TopBar'
import { toast } from '../components/Toast'
import { sectionsDone } from '../form/progress'
import { sections } from '../form/schema'
import { asString, type FieldValue, type FormData } from '../form/types'
import { navigate } from '../hooks/useHashRoute'
import { canShareFiles, downloadPdf } from '../pdf/download'
import { storage, type Report } from '../store/storage'

interface Props {
  id: string
  sectionId?: string
}

export function Editor({ id, sectionId }: Props) {
  const [report, setReport] = useState<Report | undefined>(() => storage.getReport(id))
  const [saved, setSaved] = useState(true)
  const [busy, setBusy] = useState(false)
  const timer = useRef<number | undefined>(undefined)
  const profile = useMemo(() => storage.loadProfile(), [])

  const index = Math.max(
    0,
    sections.findIndex((s) => s.id === sectionId),
  )
  const section = sections[index]

  // Autoguardado con retardo corto
  const persist = useCallback((r: Report) => {
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => {
      storage.saveReport(r)
      setSaved(true)
    }, 400)
  }, [])

  useEffect(() => () => window.clearTimeout(timer.current), [])

  const api: FormApi | null = useMemo(() => {
    if (!report) return null
    return {
      data: report.data,
      set: (key: string, value: FieldValue) => {
        setReport((prev) => {
          if (!prev) return prev
          const next = { ...prev, data: { ...prev.data, [key]: value } as FormData }
          setSaved(false)
          persist(next)
          return next
        })
      },
    }
  }, [report, persist])

  const flush = () => {
    if (!report) return
    window.clearTimeout(timer.current)
    storage.saveReport(report)
    setSaved(true)
  }

  const go = (i: number) => {
    flush()
    navigate({ name: 'editor', id, section: sections[i].id })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const exportPdf = async (mode: 'download' | 'share' | 'open') => {
    if (!report) return
    flush()
    setBusy(true)
    try {
      const used = await downloadPdf(report.data, storage.loadProfile(), mode)
      toast(used === 'share' ? 'PDF compartido' : used === 'open' ? 'PDF abierto en una pestaña nueva' : 'PDF descargado')
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
            <h2>El informe no existe en este dispositivo</h2>
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
        subtitle={`Sección ${index + 1} de ${sections.length} · ${section.short}`}
        onBack={() => {
          flush()
          navigate({ name: 'home' })
        }}
        right={
          <>
            <span className="status" aria-live="polite">
              {saved ? 'Guardado' : 'Guardando…'}
            </span>
            <button type="button" className="btn btn--gold" onClick={() => exportPdf('download')} disabled={busy}>
              {busy ? 'Generando…' : 'Generar PDF'}
            </button>
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
            <small>Los cambios se guardan automáticamente en este dispositivo.</small>
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
                  <button type="button" className="btn btn--ghost btn--sm" onClick={() => { flush(); navigate({ name: 'profile' }) }}>
                    {firmaOk ? 'Cambiar firma en el perfil' : 'Ir al perfil'}
                  </button>
                </div>
                <div className="actions-bar" style={{ justifyContent: 'flex-start', paddingTop: 8, borderTop: '1px dashed var(--line)' }}>
                  <button type="button" className="btn btn--primary" onClick={() => exportPdf('download')} disabled={busy}>
                    Descargar PDF
                  </button>
                  {canShareFiles() && (
                    <button type="button" className="btn btn--ghost" onClick={() => exportPdf('share')} disabled={busy}>
                      Compartir
                    </button>
                  )}
                  <button type="button" className="btn btn--ghost" onClick={() => exportPdf('open')} disabled={busy}>
                    Vista previa
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
              <button type="button" className="btn btn--gold" onClick={() => exportPdf('download')} disabled={busy}>
                Generar PDF
              </button>
            )}
          </div>
        </section>
      </main>
    </FormContext.Provider>
  )
}
