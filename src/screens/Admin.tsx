import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { useAuth } from '../auth/AuthContext'
import { TopBar } from '../components/TopBar'
import { toast } from '../components/Toast'
import { navigate } from '../hooks/useHashRoute'
import { adminApi } from '../lib/adminApi'
import { mensajeError, supabase, type InformeRow, type PerfilRow } from '../lib/supabase'
import { downloadDocx } from '../docx/download'
import { conFotosParaPdf } from '../evidencias/fotos'
import { openPrintView } from '../pdf/print'
import { perfilToProfile } from '../auth/AuthContext'

type Tab = 'usuarios' | 'informes'

function generarClave(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'
  let s = ''
  const arr = new Uint32Array(10)
  crypto.getRandomValues(arr)
  for (const n of arr) s += chars[n % chars.length]
  return s
}

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  try {
    return new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium' }).format(new Date(iso))
  } catch {
    return iso
  }
}

export function Admin({ tab = 'usuarios' }: { tab?: string }) {
  const { perfil } = useAuth()
  const activeTab: Tab = tab === 'informes' ? 'informes' : 'usuarios'
  return (
    <>
      <TopBar title="Administración" subtitle={perfil?.nombre} onBack={() => navigate({ name: 'home' })} />
      <main className="page">
        <div className="tabs" role="tablist">
          <button type="button" role="tab" aria-selected={activeTab === 'usuarios'} className={activeTab === 'usuarios' ? 'on' : ''} onClick={() => navigate({ name: 'admin' })}>
            Usuarios
          </button>
          <button type="button" role="tab" aria-selected={activeTab === 'informes'} className={activeTab === 'informes' ? 'on' : ''} onClick={() => navigate({ name: 'admin', tab: 'informes' })}>
            Todos los informes
          </button>
        </div>
        {activeTab === 'usuarios' ? <Usuarios /> : <TodosLosInformes />}
      </main>
    </>
  )
}

// ---------------------------------------------------------------------
// Usuarios
// ---------------------------------------------------------------------
function Usuarios() {
  const { perfil: yo } = useAuth()
  const [usuarios, setUsuarios] = useState<PerfilRow[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [mostrarForm, setMostrarForm] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)

  const cargar = useCallback(async () => {
    const { data, error } = await supabase.from('perfiles').select('*').order('nombre')
    setError(error ? mensajeError(error) : null)
    if (!error) setUsuarios(data as PerfilRow[])
    setCargando(false)
  }, [])

  useEffect(() => void cargar(), [cargar])

  const toggleActivo = async (u: PerfilRow) => {
    const accion = u.activo ? 'desactivar' : 'reactivar'
    if (!confirm(`¿${accion === 'desactivar' ? 'Desactivar' : 'Reactivar'} a ${u.nombre}?${u.activo ? ' No podrá ingresar, pero sus informes se conservan.' : ''}`)) return
    setBusyId(u.id)
    try {
      await adminApi.activar(u.id, !u.activo)
      toast(u.activo ? 'Usuario desactivado' : 'Usuario reactivado')
      await cargar()
    } catch (e) {
      toast(mensajeError(e), 'error')
    } finally {
      setBusyId(null)
    }
  }

  const restablecer = async (u: PerfilRow) => {
    const clave = generarClave()
    if (!confirm(`Se asignará a ${u.nombre} la contraseña temporal:\n\n${clave}\n\nDeberá cambiarla al ingresar. ¿Continuar?`)) return
    setBusyId(u.id)
    try {
      await adminApi.restablecerClave(u.id, clave)
      await navigator.clipboard?.writeText(clave).catch(() => undefined)
      alert(`Contraseña temporal de ${u.nombre}:\n\n${clave}\n\n(Se copió al portapapeles. Entréguesela de forma segura.)`)
      await cargar()
    } catch (e) {
      toast(mensajeError(e), 'error')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <>
      <div className="hero">
        <div>
          <h2>Profesionales</h2>
          <p>Cree las cuentas de quienes elaboran informes. Cada cuenta recibe una contraseña temporal que debe cambiar al ingresar.</p>
        </div>
        <button type="button" className="btn btn--primary" onClick={() => setMostrarForm((v) => !v)}>
          {mostrarForm ? 'Cerrar formulario' : '+ Nuevo usuario'}
        </button>
      </div>

      {mostrarForm && (
        <NuevoUsuarioForm
          onCreated={async () => {
            setMostrarForm(false)
            await cargar()
          }}
        />
      )}

      {error && (
        <div className="form-error" role="alert">
          {error}
        </div>
      )}
      {cargando ? (
        <p className="kbd-hint">Cargando usuarios…</p>
      ) : (
        <div className="users">
          {usuarios.map((u) => (
            <article key={u.id} className={`card user${u.activo ? '' : ' user--off'}`}>
              <div className="user__main">
                <div className="user__avatar" aria-hidden="true">
                  {u.nombre
                    .split(' ')
                    .slice(0, 2)
                    .map((p) => p[0]?.toUpperCase())
                    .join('')}
                </div>
                <div className="user__info">
                  <div className="user__name">
                    {u.nombre}
                    {u.rol === 'admin' && <span className="tag tag--admin">Administrador</span>}
                    {!u.activo && <span className="tag tag--off">Inactivo</span>}
                    {u.debe_cambiar_clave && u.activo && <span className="tag">Clave temporal</span>}
                  </div>
                  <div className="user__meta">
                    <span>{u.correo}</span>
                    {u.tarjeta_profesional && <span>T.P. {u.tarjeta_profesional}</span>}
                    <span>{u.cargo}</span>
                    <span>Creado: {formatDate(u.creado_en)}</span>
                  </div>
                </div>
              </div>
              <div className="user__actions">
                <button type="button" className="btn btn--ghost btn--sm" onClick={() => restablecer(u)} disabled={busyId === u.id}>
                  Nueva clave
                </button>
                {u.id !== yo?.id && (
                  <button type="button" className={`btn btn--sm ${u.activo ? 'btn--danger' : 'btn--primary'}`} onClick={() => toggleActivo(u)} disabled={busyId === u.id}>
                    {u.activo ? 'Desactivar' : 'Reactivar'}
                  </button>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </>
  )
}

function NuevoUsuarioForm({ onCreated }: { onCreated: () => Promise<void> }) {
  const [nombre, setNombre] = useState('')
  const [correo, setCorreo] = useState('')
  const [tarjeta, setTarjeta] = useState('')
  const [cargo, setCargo] = useState('Trabajador(a) Social')
  const [rol, setRol] = useState<'admin' | 'profesional'>('profesional')
  const [clave, setClave] = useState(() => generarClave())
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!nombre.trim() || !correo.trim()) return setError('Nombre y correo son obligatorios.')
    if (clave.length < 8) return setError('La contraseña temporal debe tener al menos 8 caracteres.')
    setBusy(true)
    try {
      await adminApi.crearUsuario({ nombre: nombre.trim(), correo: correo.trim(), tarjeta_profesional: tarjeta.trim(), cargo: cargo.trim(), rol, clave })
      await navigator.clipboard?.writeText(clave).catch(() => undefined)
      alert(`Usuario creado.\n\nCorreo: ${correo.trim()}\nContraseña temporal: ${clave}\n\n(Se copió al portapapeles. Entréguesela de forma segura; deberá cambiarla al ingresar.)`)
      await onCreated()
    } catch (err) {
      setError(mensajeError(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="card" onSubmit={submit} noValidate style={{ marginBottom: 18 }}>
      <div className="card__body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <h3 style={{ fontSize: '1rem' }}>Nuevo usuario</h3>
        <div className="profile-grid">
          <div className="field">
            <label className="field__label" htmlFor="nu-nombre">
              Nombre completo
            </label>
            <input id="nu-nombre" className="input" value={nombre} onChange={(e) => setNombre(e.target.value)} autoFocus />
          </div>
          <div className="field">
            <label className="field__label" htmlFor="nu-correo">
              Correo electrónico
            </label>
            <input id="nu-correo" className="input" type="email" inputMode="email" value={correo} onChange={(e) => setCorreo(e.target.value)} />
          </div>
          <div className="field">
            <label className="field__label" htmlFor="nu-tarjeta">
              Tarjeta profesional
            </label>
            <input id="nu-tarjeta" className="input" inputMode="numeric" value={tarjeta} onChange={(e) => setTarjeta(e.target.value)} />
          </div>
          <div className="field">
            <label className="field__label" htmlFor="nu-cargo">
              Cargo
            </label>
            <input id="nu-cargo" className="input" value={cargo} onChange={(e) => setCargo(e.target.value)} />
          </div>
          <div className="field">
            <span className="field__label">Rol</span>
            <div className="seg" role="radiogroup" aria-label="Rol">
              {(['profesional', 'admin'] as const).map((r) => (
                <button type="button" key={r} role="radio" aria-checked={rol === r} className={rol === r ? 'on' : ''} onClick={() => setRol(r)}>
                  {r === 'admin' ? 'Administrador' : 'Profesional'}
                </button>
              ))}
            </div>
          </div>
          <div className="field">
            <label className="field__label" htmlFor="nu-clave">
              Contraseña temporal
            </label>
            <div className="input-row">
              <input id="nu-clave" className="input" value={clave} onChange={(e) => setClave(e.target.value)} />
              <button type="button" className="btn btn--ghost btn--sm" onClick={() => setClave(generarClave())}>
                Generar
              </button>
            </div>
            <span className="field__hint">El usuario deberá cambiarla en su primer ingreso.</span>
          </div>
        </div>
        {error && (
          <div className="form-error" role="alert">
            {error}
          </div>
        )}
        <div className="actions-bar">
          <button type="submit" className="btn btn--primary" disabled={busy}>
            {busy ? 'Creando…' : 'Crear usuario'}
          </button>
        </div>
      </div>
    </form>
  )
}

// ---------------------------------------------------------------------
// Todos los informes (solo lectura + reasignación)
// ---------------------------------------------------------------------
interface InformeConAutor extends InformeRow {
  perfiles: { nombre: string } | null
}

function TodosLosInformes() {
  const [informes, setInformes] = useState<InformeConAutor[]>([])
  const [usuarios, setUsuarios] = useState<PerfilRow[]>([])
  const [filtro, setFiltro] = useState('')
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  const cargar = useCallback(async () => {
    const [inf, usr] = await Promise.all([
      supabase.from('informes').select('*, perfiles(nombre)').is('eliminado_en', null).order('actualizado_en', { ascending: false }),
      supabase.from('perfiles').select('*').eq('activo', true).order('nombre'),
    ])
    setError(inf.error ? mensajeError(inf.error) : null)
    if (!inf.error) setInformes(inf.data as unknown as InformeConAutor[])
    if (!usr.error) setUsuarios(usr.data as PerfilRow[])
    setCargando(false)
  }, [])

  useEffect(() => void cargar(), [cargar])

  const reasignar = async (inf: InformeConAutor, nuevo: string) => {
    if (!nuevo || nuevo === inf.autor_id) return
    const destino = usuarios.find((u) => u.id === nuevo)
    if (!confirm(`¿Reasignar el informe ${inf.codigo ?? ''} a ${destino?.nombre}?`)) return
    setBusyId(inf.id)
    const { error } = await supabase.rpc('reasignar_informe', { p_informe: inf.id, p_nuevo_autor: nuevo })
    setBusyId(null)
    if (error) return toast(mensajeError(error), 'error')
    toast('Informe reasignado')
    await cargar()
  }

  const verPdf = (inf: InformeConAutor) => {
    // La pestaña se abre dentro del clic (el navegador no la bloquea); el perfil y las fotos llegan después
    const perfil = supabase
      .from('perfiles')
      .select('*')
      .eq('id', inf.autor_id)
      .single()
      .then(({ data }) => perfilToProfile((data as PerfilRow) ?? null))
    const datos = conFotosParaPdf(inf.id, { ...inf.datos, _codigo: inf.codigo ?? '' })
    void perfil.then((p) => {
      if (!openPrintView(datos, p)) toast('El navegador bloqueó la ventana emergente', 'error')
    })
  }

  const verWord = async (inf: InformeConAutor) => {
    setBusyId(inf.id)
    try {
      const { data } = await supabase.from('perfiles').select('*').eq('id', inf.autor_id).single()
      await downloadDocx(await conFotosParaPdf(inf.id, { ...inf.datos, _codigo: inf.codigo ?? '' }), perfilToProfile((data as PerfilRow) ?? null))
    } catch (e) {
      toast(mensajeError(e), 'error')
    } finally {
      setBusyId(null)
    }
  }

  const q = filtro.trim().toLowerCase()
  const lista = informes.filter((i) =>
    !q || [i.codigo, i.nna_nombres, i.nna_apellidos, i.nna_documento, i.perfiles?.nombre].some((v) => (v ?? '').toLowerCase().includes(q)),
  )

  return (
    <>
      <div className="hero">
        <div>
          <h2>Todos los informes</h2>
          <p>Consulta de los informes de todos los profesionales. Puede reasignarlos a otra persona.</p>
        </div>
        <input className="input" style={{ maxWidth: 320 }} placeholder="Buscar por código, NNA, documento o profesional" value={filtro} onChange={(e) => setFiltro(e.target.value)} aria-label="Buscar" />
      </div>
      {error && (
        <div className="form-error" role="alert">
          {error}
        </div>
      )}
      {cargando ? (
        <p className="kbd-hint">Cargando informes…</p>
      ) : lista.length === 0 ? (
        <div className="card empty">
          <h2>No hay informes</h2>
        </div>
      ) : (
        <div className="report-list">
          {lista.map((i) => (
            <article key={i.id} className="card report-card" style={{ cursor: 'default' }}>
              <div className="report-card__code">{i.codigo ?? 'Sin código'}</div>
              <div className="report-card__title">{`${i.nna_nombres ?? ''} ${i.nna_apellidos ?? ''}`.trim() || 'Informe sin nombre'}</div>
              <div className="report-card__meta">
                <span>Profesional: {i.perfiles?.nombre ?? '—'}</span>
                <span>Elaborado: {formatDate(i.fecha_elaboracion)}</span>
                <span>Editado: {formatDate(i.actualizado_en)}</span>
              </div>
              <div className="field">
                <label className="field__hint" htmlFor={`re-${i.id}`}>
                  Reasignar a
                </label>
                <select id={`re-${i.id}`} className="input" value={i.autor_id} disabled={busyId === i.id} onChange={(e) => reasignar(i, e.target.value)}>
                  {usuarios.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.nombre}
                    </option>
                  ))}
                  {!usuarios.some((u) => u.id === i.autor_id) && <option value={i.autor_id}>{i.perfiles?.nombre ?? 'Autor actual'}</option>}
                </select>
              </div>
              <div className="report-card__actions">
                <button type="button" className="btn btn--ghost btn--sm" onClick={() => verPdf(i)}>
                  Ver PDF
                </button>
                <button type="button" className="btn btn--ghost btn--sm" onClick={() => void verWord(i)} disabled={busyId === i.id}>
                  Word
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </>
  )
}
