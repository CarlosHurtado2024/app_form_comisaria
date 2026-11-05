import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../auth/AuthContext'
import ilustracion from '../assets/hero.webp'
import { AppShell, iniciales } from '../components/AppShell'
import { confirmar } from '../components/Dialog'
import { Icon } from '../components/Icon'
import { toast } from '../components/Toast'
import { conFotosParaPdf, eliminarFotosDeInforme } from '../evidencias/fotos'
import { progressPercent } from '../form/progress'
import { asString } from '../form/types'
import { navigate } from '../hooks/useHashRoute'
import { downloadDocx } from '../docx/download'
import { canShareFiles, downloadPdf } from '../pdf/download'
import { storageFor, type Report } from '../store/storage'
import { useSyncContext } from '../store/SyncContext'

const fechaCorta = (iso: string): string => {
  try {
    return new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'short' }).format(new Date(iso))
  } catch {
    return iso
  }
}

/** Informes creados en cada uno de los últimos seis meses (para el gráfico de actividad). */
function porMes(reports: Report[]): { clave: string; etiqueta: string; total: number }[] {
  const ahora = new Date()
  const meses = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(ahora.getFullYear(), ahora.getMonth() - (5 - i), 1)
    return { clave: `${d.getFullYear()}-${d.getMonth()}`, etiqueta: new Intl.DateTimeFormat('es-CO', { month: 'short' }).format(d).replace('.', ''), total: 0 }
  })
  for (const r of reports) {
    const d = new Date(r.createdAt)
    const m = meses.find((x) => x.clave === `${d.getFullYear()}-${d.getMonth()}`)
    if (m) m.total += 1
  }
  return meses
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

  const remove = async (r: Report) => {
    const nombre = `${asString(r.data.nombres)} ${asString(r.data.apellidos)}`.trim() || 'este informe'
    const ok = await confirmar({
      titulo: '¿Eliminar el informe?',
      mensaje: (
        <>
          Se eliminará <strong>{nombre}</strong>
          {r.codigo ? ` (${r.codigo})` : ''} con sus fotos. Esta acción no se puede deshacer.
        </>
      ),
      aceptar: 'Sí, eliminar',
      peligro: true,
    })
    if (!ok) return
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
    setBusy(r.id)
    try {
      await downloadPdf(await conFotosParaPdf(r.id, { ...r.data, _codigo: r.codigo ?? '' }), profile, canShareFiles() ? 'share' : 'download')
    } catch (e) {
      toast(e instanceof Error ? e.message : 'No se pudo generar el PDF', 'error')
    } finally {
      setBusy(null)
    }
  }

  const word = async (r: Report) => {
    setBusy(r.id)
    try {
      await downloadDocx(await conFotosParaPdf(r.id, { ...r.data, _codigo: r.codigo ?? '' }), profile, canShareFiles() ? 'share' : 'download')
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
  const completos = reports.filter((r) => progressPercent(r.data) >= 100).length
  const meses = porMes(reports)
  const maxMes = Math.max(1, ...meses.map((m) => m.total))
  const primerNombre = (perfil?.nombre ?? '').split(/\s+/)[0] || ''

  return (
    <AppShell active="home" title={primerNombre ? `Hola, ${primerNombre}` : 'Inicio'} subtitle="Comisaría de Familia · Morales, Cauca">
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

      <div className="home">
        {/* Lista de informes */}
        <section className="card panel home__recent" aria-labelledby="recent-title">
          <div className="panel__head">
            <h2 id="recent-title">Mis informes</h2>
            <label className="search">
              <Icon name="search" size={18} />
              <input className="input" type="search" placeholder="Buscar por nombre, documento o código" value={filtro} onChange={(e) => setFiltro(e.target.value)} aria-label="Buscar informes" />
            </label>
          </div>

          {reports.length === 0 ? (
            <div className="empty">
              <h2>Aún no hay informes</h2>
              <p>Cree el primero y diligéncielo por secciones. Se guarda en este dispositivo y se sincroniza con el servidor.</p>
              <button type="button" className="btn btn--primary" onClick={create} style={{ marginTop: 14 }}>
                Crear informe
              </button>
            </div>
          ) : visibles.length === 0 ? (
            <div className="empty">
              <h2>Sin coincidencias</h2>
              <p>Ningún informe coincide con «{filtro}».</p>
            </div>
          ) : (
            <ul className="rlist">
              {visibles.map((r) => {
                const nombre = `${asString(r.data.nombres)} ${asString(r.data.apellidos)}`.trim()
                const pct = progressPercent(r.data)
                return (
                  <li key={r.id} className="rrow">
                    <button type="button" className="rrow__main" onClick={() => navigate({ name: 'editor', id: r.id })}>
                      <span className="avatar avatar--soft" aria-hidden="true">
                        {nombre ? iniciales(nombre) : <Icon name="file" size={18} />}
                      </span>
                      <span className="rrow__text">
                        <span className="rrow__name">{nombre || 'Informe sin nombre'}</span>
                        <span className="rrow__meta">
                          <span className="rrow__code">{r.codigo ?? 'Código pendiente'}</span>
                          {r.dirty && <span className="tag">Por subir</span>}
                          <span>Elaborado {fechaCorta(asString(r.data.fecha_elaboracion) || r.createdAt)}</span>
                        </span>
                      </span>
                      <span className="rrow__progress" aria-label={`Avance ${pct}%`}>
                        <span className="progress">
                          <span style={{ width: `${pct}%` }} />
                        </span>
                        <span className="rrow__pct">{pct}%</span>
                      </span>
                    </button>
                    <div className="rrow__actions">
                      <button type="button" className="iconbtn iconbtn--label" onClick={() => void pdf(r)} disabled={busy === r.id} title="Generar PDF" aria-label={`PDF de ${nombre || 'informe'}`}>
                        PDF
                      </button>
                      <button type="button" className="iconbtn iconbtn--label" onClick={() => void word(r)} disabled={busy === r.id} title="Descargar Word" aria-label={`Word de ${nombre || 'informe'}`}>
                        W
                      </button>
                      <button type="button" className="iconbtn" onClick={() => duplicate(r)} title="Duplicar" aria-label={`Duplicar ${nombre || 'informe'}`}>
                        <Icon name="copy" size={18} />
                      </button>
                      <button type="button" className="iconbtn iconbtn--danger" onClick={() => void remove(r)} title="Eliminar" aria-label={`Eliminar ${nombre || 'informe'}`}>
                        <Icon name="trash" size={18} />
                      </button>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </section>

        {/* Columna lateral: resumen y tarjeta destacada */}
        <section className="card panel home__stats" aria-labelledby="stats-title">
          <h2 id="stats-title" className="panel__title">
            Resumen
          </h2>
          <dl className="stats">
            <div>
              <dt>Informes</dt>
              <dd>{reports.length}</dd>
            </div>
            <div>
              <dt>Completos</dt>
              <dd>{completos}</dd>
            </div>
            <div className={pendientes ? 'is-warn' : ''}>
              <dt>Por subir</dt>
              <dd>{pendientes}</dd>
            </div>
            <div>
              <dt>Última sincronización</dt>
              <dd className="stats__small">{sync.state.ultima ? new Intl.DateTimeFormat('es-CO', { dateStyle: 'short', timeStyle: 'short' }).format(sync.state.ultima) : '—'}</dd>
            </div>
          </dl>
        </section>

        <section className="promo home__promo" aria-labelledby="promo-title">
          <div className="promo__text">
            <h2 id="promo-title">
              Nuevo informe de valoración <em>sociofamiliar</em>
            </h2>
            <p>Diligéncielo por secciones desde el celular o el computador, con fotos, firma y PDF o Word al final.</p>
            <button type="button" className="btn btn--light" onClick={create}>
              <Icon name="plus" size={18} />
              Crear informe
            </button>
          </div>
          <img className="promo__art" src={ilustracion} alt="" aria-hidden="true" />
        </section>

        {/* Actividad */}
        <section className="card panel home__activity" aria-labelledby="activity-title">
          <div className="panel__head">
            <h2 id="activity-title">Informes por mes</h2>
            <span className="panel__hint">Últimos 6 meses</span>
          </div>
          <div className="bars" role="img" aria-label={meses.map((m) => `${m.etiqueta}: ${m.total}`).join(', ')}>
            {meses.map((m, i) => (
              <div className="bars__col" key={m.clave}>
                <span className="bars__value">{m.total}</span>
                <span className={`bars__bar${i === meses.length - 1 ? ' is-current' : ''}`} style={{ height: `${Math.max(6, (m.total / maxMes) * 100)}%` }} />
                <span className="bars__label">{m.etiqueta}</span>
              </div>
            ))}
          </div>
        </section>
      </div>
      <p className="install-tip">Los informes se guardan en este dispositivo y se suben al servidor cuando hay conexión.</p>
    </AppShell>
  )
}
