import { useState } from 'react'
import { TopBar } from '../components/TopBar'
import { toast } from '../components/Toast'
import { progressPercent } from '../form/progress'
import { asString } from '../form/types'
import { navigate } from '../hooks/useHashRoute'
import { downloadPdf } from '../pdf/download'
import { openPrintView } from '../pdf/print'
import { storage, type Report } from '../store/storage'

function formatDateTime(iso: string): string {
  try {
    return new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso))
  } catch {
    return iso
  }
}

export function Home() {
  const [reports, setReports] = useState<Report[]>(() => storage.listReports())
  const profile = storage.loadProfile()
  const profileReady = !!profile.nombre && !!profile.tarjeta
  const [busy, setBusy] = useState<string | null>(null)

  const refresh = () => setReports(storage.listReports())

  const create = () => {
    const r = storage.createReport(profile)
    navigate({ name: 'editor', id: r.id })
  }

  const remove = (r: Report) => {
    const nombre = `${asString(r.data.nombres)} ${asString(r.data.apellidos)}`.trim() || 'este informe'
    if (!confirm(`¿Eliminar ${nombre}? Esta acción no se puede deshacer.`)) return
    storage.deleteReport(r.id)
    refresh()
    toast('Informe eliminado')
  }

  const duplicate = (r: Report) => {
    storage.duplicateReport(r.id)
    refresh()
    toast('Copia creada')
  }

  const pdf = async (r: Report) => {
    if (openPrintView(r.data, storage.loadProfile())) return
    setBusy(r.id)
    try {
      await downloadPdf(r.data, storage.loadProfile())
    } catch (e) {
      toast(e instanceof Error ? e.message : 'No se pudo generar el PDF', 'error')
    } finally {
      setBusy(null)
    }
  }

  return (
    <>
      <TopBar
        brand
        title="Informe Trabajo Social"
        subtitle="Comisaría de Familia · Municipio de Morales"
        right={
          <button type="button" className="btn btn--onbar" onClick={() => navigate({ name: 'profile' })}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="12" cy="8" r="4" />
              <path d="M4 21c0-4 3.6-7 8-7s8 3 8 7" />
            </svg>
            Perfil
          </button>
        }
      />
      <main className="page">
        {!profileReady && (
          <div className="banner">
            <div>
              <strong>Configure su perfil profesional</strong>
              Nombre, tarjeta profesional y firma se insertan automáticamente en cada informe.
            </div>
            <button type="button" className="btn btn--gold btn--sm" style={{ marginLeft: 'auto' }} onClick={() => navigate({ name: 'profile' })}>
              Configurar
            </button>
          </div>
        )}

        <div className="hero">
          <div>
            <h2>Mis informes</h2>
            <p>Formato de valoración sociofamiliar de verificación de derechos (F-PM-096 · v11)</p>
          </div>
          <button type="button" className="btn btn--primary" onClick={create}>
            + Nuevo informe
          </button>
        </div>

        {reports.length === 0 ? (
          <div className="card empty">
            <h2>Aún no hay informes</h2>
            <p>Cree el primero y diligéncielo por secciones. Se guarda automáticamente en este dispositivo.</p>
            <button type="button" className="btn btn--primary" onClick={create} style={{ marginTop: 14 }}>
              Crear informe
            </button>
          </div>
        ) : (
          <div className="report-list">
            {reports.map((r) => {
              const nombre = `${asString(r.data.nombres)} ${asString(r.data.apellidos)}`.trim()
              const pct = progressPercent(r.data)
              return (
                <article key={r.id} className="card report-card" onClick={() => navigate({ name: 'editor', id: r.id })}>
                  <div className="report-card__title">{nombre || 'Informe sin nombre'}</div>
                  <div className="report-card__meta">
                    <span>Elaborado: {asString(r.data.fecha_elaboracion) || '—'}</span>
                    <span>Editado: {formatDateTime(r.updatedAt)}</span>
                  </div>
                  <div className="progress" aria-label={`Avance ${pct}%`}>
                    <span style={{ width: `${pct}%` }} />
                  </div>
                  <div className="report-card__actions" onClick={(e) => e.stopPropagation()}>
                    <button type="button" className="btn btn--ghost btn--sm" onClick={() => pdf(r)} disabled={busy === r.id}>
                      {busy === r.id ? 'Generando…' : 'PDF'}
                    </button>
                    <button type="button" className="btn btn--ghost btn--sm" onClick={() => duplicate(r)}>
                      Duplicar
                    </button>
                    <button type="button" className="btn btn--danger btn--sm" style={{ marginLeft: 'auto' }} onClick={() => remove(r)}>
                      Eliminar
                    </button>
                  </div>
                </article>
              )
            })}
          </div>
        )}
        <p className="install-tip">Los informes se guardan solo en este dispositivo. Puede instalar la aplicación desde el menú del navegador para usarla sin conexión.</p>
      </main>
    </>
  )
}
