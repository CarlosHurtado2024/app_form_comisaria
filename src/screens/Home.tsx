import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../auth/AuthContext'
import { TopBar } from '../components/TopBar'
import { toast } from '../components/Toast'
import { progressPercent } from '../form/progress'
import { asString } from '../form/types'
import { navigate } from '../hooks/useHashRoute'
import { downloadPdf } from '../pdf/download'
import { openPrintView } from '../pdf/print'
import { storageFor, type Report } from '../store/storage'
import { useSyncContext } from '../store/SyncContext'

function formatDateTime(iso: string): string {
  try {
    return new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso))
  } catch {
    return iso
  }
}

export function Home() {
  const { perfil, profile, esAdmin, logout } = useAuth()
  const uid = perfil!.id
  const storage = storageFor(uid)
  const sync = useSyncContext()
  const [reports, setReports] = useState<Report[]>(() => storage.listReports())
  const [busy, setBusy] = useState<string | null>(null)
  const profileReady = !!profile.nombre && !!profile.tarjeta && !!profile.firma

  const refresh = useCallback(() => setReports(storage.listReports()), [storage])

  // Refrescar la lista cuando termina una sincronización
  useEffect(() => sync.subscribe(refresh), [sync, refresh])

  const create = () => {
    const r = storage.createReport(profile)
    navigate({ name: 'editor', id: r.id })
  }

  const remove = (r: Report) => {
    const nombre = `${asString(r.data.nombres)} ${asString(r.data.apellidos)}`.trim() || 'este informe'
    if (!confirm(`¿Eliminar ${nombre}${r.codigo ? ` (${r.codigo})` : ''}? Esta acción no se puede deshacer.`)) return
    storage.deleteReport(r.id)
    refresh()
    sync.schedule(500)
    toast('Informe eliminado')
  }

  const duplicate = (r: Report) => {
    storage.duplicateReport(r.id)
    refresh()
    sync.schedule(500)
    toast('Copia creada')
  }

  const pdf = async (r: Report) => {
    const data = { ...r.data, _codigo: r.codigo ?? '' }
    if (openPrintView(data, profile)) return
    setBusy(r.id)
    try {
      await downloadPdf(data, profile)
    } catch (e) {
      toast(e instanceof Error ? e.message : 'No se pudo generar el PDF', 'error')
    } finally {
      setBusy(null)
    }
  }

  const syncLabel = sync.state.sincronizando
    ? 'Sincronizando…'
    : !sync.state.online
      ? 'Sin conexión'
      : sync.state.pendientes > 0
        ? `${sync.state.pendientes} por subir`
        : sync.state.error
          ? 'Error al sincronizar'
          : 'Sincronizado'

  return (
    <>
      <TopBar
        brand
        title="Informe Trabajo Social"
        subtitle={perfil?.nombre}
        right={
          <>
            <button type="button" className={`sync sync--${sync.state.sincronizando ? 'busy' : !sync.state.online ? 'off' : sync.state.pendientes > 0 || sync.state.error ? 'pending' : 'ok'}`} onClick={() => void sync.run()} title="Sincronizar ahora">
              {syncLabel}
            </button>
            {esAdmin && (
              <button type="button" className="btn btn--onbar" onClick={() => navigate({ name: 'admin' })}>
                Admin
              </button>
            )}
            <button type="button" className="btn btn--onbar" onClick={() => navigate({ name: 'profile' })}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="12" cy="8" r="4" />
                <path d="M4 21c0-4 3.6-7 8-7s8 3 8 7" />
              </svg>
              Perfil
            </button>
          </>
        }
      />
      <main className="page">
        {!profileReady && (
          <div className="banner">
            <div>
              <strong>Complete su perfil profesional</strong>
              Tarjeta profesional y firma se insertan automáticamente en cada informe.
            </div>
            <button type="button" className="btn btn--gold btn--sm" style={{ marginLeft: 'auto' }} onClick={() => navigate({ name: 'profile' })}>
              Completar
            </button>
          </div>
        )}
        {sync.state.error && sync.state.online && (
          <div className="banner banner--warn">
            <div>
              <strong>No se pudo sincronizar</strong>
              {sync.state.error}. Los cambios siguen guardados en este dispositivo.
            </div>
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
            <p>Cree el primero y diligéncielo por secciones. Se guarda en este dispositivo y se sincroniza con el servidor.</p>
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
                  <div className="report-card__code">
                    {r.codigo ?? 'Código pendiente'}
                    {r.dirty && <span className="tag">Por subir</span>}
                  </div>
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
        <p className="install-tip">
          Los informes se guardan en este dispositivo y se suben al servidor cuando hay conexión.{' '}
          <button type="button" className="link" onClick={() => void logout()}>
            Cerrar sesión
          </button>
        </p>
      </main>
    </>
  )
}
