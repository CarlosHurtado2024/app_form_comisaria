import { useState, type FormEvent } from 'react'
import { useAuth } from '../auth/AuthContext'
import { TopBar } from '../components/TopBar'
import { toast } from '../components/Toast'
import { mensajeError } from '../lib/supabase'

interface Props {
  /** Cuando es obligatorio (primer ingreso) no se puede cancelar */
  obligatorio?: boolean
  onDone?: () => void
}

export function CambiarClave({ obligatorio, onDone }: Props) {
  const { cambiarClave, logout, perfil } = useAuth()
  const [nueva, setNueva] = useState('')
  const [confirmar, setConfirmar] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    if (nueva.length < 8) return setError('La contraseña debe tener al menos 8 caracteres.')
    if (nueva !== confirmar) return setError('Las contraseñas no coinciden.')
    setBusy(true)
    try {
      await cambiarClave(nueva)
      toast('Contraseña actualizada')
      onDone?.()
    } catch (err) {
      setError(mensajeError(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <TopBar title="Cambiar contraseña" subtitle={perfil?.correo} onBack={obligatorio ? undefined : onDone} brand={obligatorio} />
      <main className="page page--narrow">
        <div className="card">
          <form className="card__body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }} onSubmit={submit} noValidate>
            {obligatorio && (
              <div className="banner" style={{ margin: 0 }}>
                <div>
                  <strong>Bienvenido(a), {perfil?.nombre}</strong>
                  Por seguridad, defina una contraseña nueva antes de continuar.
                </div>
              </div>
            )}
            <div className="field">
              <label className="field__label" htmlFor="c-nueva">
                Nueva contraseña
              </label>
              <input id="c-nueva" className="input" type="password" autoComplete="new-password" value={nueva} onChange={(e) => setNueva(e.target.value)} autoFocus />
              <span className="field__hint">Mínimo 8 caracteres.</span>
            </div>
            <div className="field">
              <label className="field__label" htmlFor="c-conf">
                Confirmar contraseña
              </label>
              <input id="c-conf" className="input" type="password" autoComplete="new-password" value={confirmar} onChange={(e) => setConfirmar(e.target.value)} />
            </div>
            {error && (
              <div className="form-error" role="alert">
                {error}
              </div>
            )}
            <div className="actions-bar">
              {obligatorio ? (
                <button type="button" className="btn btn--ghost" onClick={() => void logout()}>
                  Cerrar sesión
                </button>
              ) : (
                <button type="button" className="btn btn--ghost" onClick={onDone}>
                  Cancelar
                </button>
              )}
              <button type="submit" className="btn btn--primary" disabled={busy}>
                {busy ? 'Guardando…' : 'Guardar contraseña'}
              </button>
            </div>
          </form>
        </div>
      </main>
    </>
  )
}
