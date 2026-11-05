import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../auth/AuthContext'
import ilustracion from '../assets/hero.webp'
import { AppShell } from '../components/AppShell'
import { Icon } from '../components/Icon'
import { toast } from '../components/Toast'
import { conFotosParaPdf, eliminarFotosDeInforme } from '../evidencias/fotos'
import { progressPercent } from '../form/progress'
import { asString } from '../form/types'
import { navigate } from '../hooks/useHashRoute'
import { downloadDocx } from '../docx/download'
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
  const { perfil, profile } = useAuth()
  const uid = perfil!.id
  const storage = storageFor(uid)
  const sync = useSyncContext()
  const [reports, setReports] = useState<Report[]>(() => storage.listReports())
  const [busy, setBusy] = useState<string | null>(null)
  const [filtro, setFiltro] = useState('')
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
    void eliminarFotosDeInforme(uid, r.id, r.data)
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
    const data = conFotosParaPdf(r.id, { ...r.data, _codigo: r.codigo ?? '' })
    if (openPrintView(data, profile)) return
    setBusy(r.id)
    try {
      await downloadPdf(await data, profile)
    } catch (e) {
      toast(e instanceof Error ? e.message : 'No se pudo generar el PDF', 'error')
    } finally {
      setBusy(null)
    }
  }

  const word = async (r: Report) => {
    setBusy(r.id)
    try {
      await downloadDocx(await conFotosParaPdf(r.id, { ...r.data, _codigo: r.codigo ?? '' }), profile)
      toast('Documento Word descargado')
    } catch (e) {
      toast(e instanceof Error ? e.message : 'No se pudo generar el documento Word', 'error')
    } finally {
      setBusy(null)
    }
  }

  const q = filtro.trim().toLowerCase()
  const visibles = q
    ? reports.filter((r) => [r.codigo ?? '', asString(r.data.nombres), asString(r.data.apellidos), asString(r.data.doc_numero)].some((v) => v.toLowerCase().includes(q)))
    : reports
  const pendientes = reports.filter((r) => r.dirty).length
  const primerNombre = (perfil?.nombre ?? '').split(/\s+/)[0] || ''

  return (
    <AppShell active="home" title="Inicio" subtitle="Comisaría de Familia · Morales, Cauca">
        <section className="welcome" aria-label="Resumen">
          <div className="welcome__text">
            <h2>{primerNombre ? `Hola, ${primerNombre}` : 'Bienvenida'}</h2>
            <p>Sus informes de valoración sociofamiliar, guardados en este dispositivo y sincronizados con el servidor.</p>
            <ul className="welcome__facts">
              <li>
                <Icon name="file" size={15} />
                {reports.length} {reports.length === 1 ? 'informe' : 'informes'}
              </li>
              <li className={pendientes ? 'is-warn' : ''}>
                <Icon name="cloud" size={15} />
                {pendientes ? `${pendientes} por subir` : 'Todo sincronizado'}
              </li>
              {sync.state.ultima && (
                <li>
                  <Icon name="check" size={15} />
                  {new Intl.DateTimeFormat('es-CO', { timeStyle: 'short' }).format(sync.state.ultima)}
                </li>
              )}
            </ul>
            <div className="welcome__actions">
              <button type="button" className="btn btn--gold" onClick={create}>
                <Icon name="plus" size={18} />
                Nuevo informe
              </button>
            </div>
          </div>
          <div className="welcome__art" aria-hidden="true">
            <img src={ilustracion} alt="" />
          </div>
        </section>

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

        <div className="toolbar">
          <h2>Mis informes</h2>
          <label className="search">
            <Icon name="search" size={18} />
            <input className="input" type="search" placeholder="Buscar por nombre, documento o código" value={filtro} onChange={(e) => setFiltro(e.target.value)} aria-label="Buscar informes" />
          </label>
        </div>

        {reports.length === 0 ? (
          <div className="card empty">
            <h2>Aún no hay informes</h2>
            <p>Cree el primero y diligéncielo por secciones. Se guarda en este dispositivo y se sincroniza con el servidor.</p>
            <button type="button" className="btn btn--primary" onClick={create} style={{ marginTop: 14 }}>
              Crear informe
            </button>
          </div>
        ) : visibles.length === 0 ? (
          <div className="card empty">
            <h2>Sin coincidencias</h2>
            <p>Ningún informe coincide con «{filtro}».</p>
          </div>
        ) : (
          <div className="report-list">
            {visibles.map((r) => {
              const nombre = `${asString(r.data.nombres)} ${asString(r.data.apellidos)}`.trim()
              const pct = progressPercent(r.data)
              return (
                <article key={r.id} className="card report-card" onClick={() => navigate({ name: 'editor', id: r.id })}>
                  <div className="report-card__code">
                    <span>{r.codigo ?? 'Código pendiente'}</span>
                    {r.dirty && <span className="tag">Por subir</span>}
                  </div>
                  <div className="report-card__title">{nombre || 'Informe sin nombre'}</div>
                  <div className="report-card__meta">
                    <span>Elaborado: {asString(r.data.fecha_elaboracion) || '—'}</span>
                    <span>Editado: {formatDateTime(r.updatedAt)}</span>
                  </div>
                  <div className="report-card__done">
                    <span>Avance del informe</span>
                    <span>{pct}%</span>
                  </div>
                  <div className="progress" aria-label={`Avance ${pct}%`}>
                    <span style={{ width: `${pct}%` }} />
                  </div>
                  <div className="report-card__actions" onClick={(e) => e.stopPropagation()}>
                    <button type="button" className="btn btn--ghost btn--sm" onClick={() => pdf(r)} disabled={busy === r.id}>
                      {busy === r.id ? 'Generando…' : 'PDF'}
                    </button>
                    <button type="button" className="btn btn--ghost btn--sm" onClick={() => word(r)} disabled={busy === r.id}>
                      Word
                    </button>
                    <button type="button" className="btn btn--ghost btn--sm" onClick={() => duplicate(r)}>
                      Duplicar
                    </button>
                    <button type="button" className="btn btn--danger btn--sm btn--icon" style={{ marginLeft: 'auto' }} onClick={() => remove(r)} aria-label="Eliminar informe" title="Eliminar">
                      <Icon name="trash" size={18} />
                    </button>
                  </div>
                </article>
              )
            })}
          </div>
        )}
        <p className="install-tip">Los informes se guardan en este dispositivo y se suben al servidor cuando hay conexión.</p>
    </AppShell>
  )
}
