import { useState, type FormEvent } from 'react'
import escudo from '../assets/escudo.png'
import ilustracion from '../assets/login.webp'
import { useAuth } from '../auth/AuthContext'
import { mensajeError, supabaseConfigured } from '../lib/supabase'

export function Login() {
  const { login } = useAuth()
  const [correo, setCorreo] = useState('')
  const [clave, setClave] = useState('')
  const [ver, setVer] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!correo.trim() || !clave) {
      setError('Escriba su correo y su contraseña.')
      return
    }
    setBusy(true)
    try {
      await login(correo, clave)
    } catch (err) {
      setError(mensajeError(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="login">
      <div className="login__panel">
        <figure className="login__art" aria-hidden="true">
          <img src={ilustracion} alt="" />
        </figure>
        <div className="login__body">
          <div className="login__brand">
            <img src={escudo} alt="Escudo del Municipio de Morales" />
            <div>
              <h1>Informe Trabajo Social</h1>
              <p>Comisaría de Familia · Municipio de Morales, Cauca</p>
            </div>
          </div>

          {!supabaseConfigured && (
            <div className="banner" role="alert">
              <div>
                <strong>Servidor no configurado</strong>
                Faltan las variables VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY.
              </div>
            </div>
          )}

          <form className="login__form" onSubmit={submit} noValidate>
            <div className="field">
              <label className="field__label" htmlFor="l-correo">
                Correo electrónico
              </label>
              <input id="l-correo" className="input" type="email" autoComplete="username" inputMode="email" value={correo} onChange={(e) => setCorreo(e.target.value)} autoFocus />
            </div>
            <div className="field">
              <label className="field__label" htmlFor="l-clave">
                Contraseña
              </label>
              <div className="input-row">
                <input id="l-clave" className="input" type={ver ? 'text' : 'password'} autoComplete="current-password" value={clave} onChange={(e) => setClave(e.target.value)} />
                <button type="button" className="btn btn--ghost btn--sm" onClick={() => setVer((v) => !v)} aria-pressed={ver}>
                  {ver ? 'Ocultar' : 'Ver'}
                </button>
              </div>
            </div>
            {error && (
              <div className="form-error" role="alert">
                {error}
              </div>
            )}
            <button type="submit" className="btn btn--primary btn--block" disabled={busy}>
              {busy ? 'Ingresando…' : 'Ingresar'}
            </button>
          </form>
          <p className="login__hint">Las cuentas las crea el administrador de la Comisaría. Si olvidó su contraseña, solicítele una nueva.</p>
        </div>
      </div>
    </main>
  )
}
