import { useState } from 'react'
import { useAuth } from '../auth/AuthContext'
import { SignaturePad } from '../components/SignaturePad'
import { AppShell } from '../components/AppShell'
import { toast } from '../components/Toast'
import { APP_VERSION, buscarActualizacion } from '../lib/version'
import { navigate } from '../hooks/useHashRoute'
import { mensajeError, type PerfilRow } from '../lib/supabase'
import { CambiarClave } from './CambiarClave'

export function Profile() {
  const { perfil, guardarPerfil, logout } = useAuth()
  const [p, setP] = useState<PerfilRow>(() => perfil!)
  const [busy, setBusy] = useState(false)
  const [clave, setClave] = useState(false)
  const update = (patch: Partial<PerfilRow>) => setP((prev) => ({ ...prev, ...patch }))

  if (clave) return <CambiarClave onDone={() => setClave(false)} />

  const save = async () => {
    setBusy(true)
    try {
      await guardarPerfil({
        nombre: p.nombre.trim(),
        tarjeta_profesional: p.tarjeta_profesional?.trim() || null,
        cargo: p.cargo.trim(),
        seccion: p.seccion.trim(),
        dirigido_a: p.dirigido_a?.trim() || null,
        firma: p.firma,
      })
      toast('Perfil guardado')
      navigate({ name: 'home' })
    } catch (e) {
      toast(mensajeError(e), 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <AppShell active="profile" title="Mi perfil" subtitle={p.correo}>
        <div className="page--narrow" style={{ margin: 0 }}>
        <div className="card">
          <div className="card__body" style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div className="profile-grid">
              <div className="field">
                <label className="field__label" htmlFor="p-nombre">
                  Nombre completo
                </label>
                <input id="p-nombre" className="input" value={p.nombre} onChange={(e) => update({ nombre: e.target.value })} autoComplete="name" />
              </div>
              <div className="field">
                <label className="field__label" htmlFor="p-tarjeta">
                  Tarjeta o registro profesional N°
                </label>
                <input id="p-tarjeta" className="input" value={p.tarjeta_profesional ?? ''} onChange={(e) => update({ tarjeta_profesional: e.target.value })} inputMode="numeric" />
              </div>
              <div className="field">
                <label className="field__label" htmlFor="p-cargo">
                  Cargo
                </label>
                <input id="p-cargo" className="input" value={p.cargo} onChange={(e) => update({ cargo: e.target.value })} placeholder="Trabajadora Social" />
              </div>
              <div className="field">
                <label className="field__label" htmlFor="p-seccion">
                  Sección
                </label>
                <input id="p-seccion" className="input" value={p.seccion} onChange={(e) => update({ seccion: e.target.value })} />
              </div>
            </div>
            <div className="field">
              <label className="field__label" htmlFor="p-dirigido">
                Dirigido a (por defecto)
              </label>
              <input id="p-dirigido" className="input" value={p.dirigido_a ?? ''} onChange={(e) => update({ dirigido_a: e.target.value })} placeholder="Dr./Dra. … Comisario(a) de Familia" />
            </div>

            <div className="field">
              <span className="field__label">Firma</span>
              <span className="field__hint">Se insertará en la sección 9 del informe junto con su nombre y tarjeta profesional.</span>
              <SignaturePad value={p.firma ?? undefined} onChange={(firma) => update({ firma: firma ?? null })} />
            </div>

            <div className="actions-bar">
              <button type="button" className="btn btn--ghost" onClick={() => navigate({ name: 'home' })}>
                Cancelar
              </button>
              <button type="button" className="btn btn--primary" onClick={save} disabled={busy}>
                {busy ? 'Guardando…' : 'Guardar perfil'}
              </button>
            </div>
          </div>
        </div>

        <div className="card" style={{ marginTop: 16 }}>
          <div className="card__body actions-bar" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <strong>Cuenta</strong>
              <div className="field__hint">
                {p.correo} · {p.rol === 'admin' ? 'Administrador' : 'Profesional'}
              </div>
            </div>
            <div className="actions-bar">
              <button type="button" className="btn btn--ghost btn--sm" onClick={() => setClave(true)}>
                Cambiar contraseña
              </button>
              <button type="button" className="btn btn--danger btn--sm" onClick={() => void logout()}>
                Cerrar sesión
              </button>
            </div>
          </div>
        </div>

        <div className="card" style={{ marginTop: 16 }}>
          <div className="card__body actions-bar" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <strong>Aplicación</strong>
              <div className="field__hint">Versión {APP_VERSION}</div>
            </div>
            <button
              type="button"
              className="btn btn--ghost btn--sm"
              onClick={async () => {
                const hay = await buscarActualizacion()
                toast(hay ? 'Hay una versión nueva: use el aviso para actualizar' : 'La aplicación está actualizada')
              }}
            >
              Buscar actualización
            </button>
          </div>
        </div>
        </div>
      </AppShell>
    </>
  )
}
