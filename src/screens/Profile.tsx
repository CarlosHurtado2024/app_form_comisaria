import { useState } from 'react'
import { SignaturePad } from '../components/SignaturePad'
import { TopBar } from '../components/TopBar'
import { toast } from '../components/Toast'
import { navigate } from '../hooks/useHashRoute'
import { storage, type Profile as ProfileData } from '../store/storage'

export function Profile() {
  const [p, setP] = useState<ProfileData>(() => storage.loadProfile())
  const update = (patch: Partial<ProfileData>) => setP((prev) => ({ ...prev, ...patch }))

  const save = () => {
    storage.saveProfile(p)
    toast('Perfil guardado')
    navigate({ name: 'home' })
  }

  return (
    <>
      <TopBar title="Perfil del profesional" subtitle="Se usa para prellenar y firmar los informes" onBack={() => navigate({ name: 'home' })} />
      <main className="page page--narrow">
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
                <input id="p-tarjeta" className="input" value={p.tarjeta} onChange={(e) => update({ tarjeta: e.target.value })} inputMode="numeric" />
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
              <input id="p-dirigido" className="input" value={p.dirigidoA} onChange={(e) => update({ dirigidoA: e.target.value })} placeholder="Dr./Dra. … Comisario(a) de Familia" />
            </div>

            <div className="field">
              <span className="field__label">Firma</span>
              <span className="field__hint">Se insertará en la sección 9 del informe junto con su nombre y tarjeta profesional.</span>
              <SignaturePad value={p.firma} onChange={(firma) => update({ firma })} />
            </div>

            <div className="actions-bar">
              <button type="button" className="btn btn--ghost" onClick={() => navigate({ name: 'home' })}>
                Cancelar
              </button>
              <button type="button" className="btn btn--primary" onClick={save}>
                Guardar perfil
              </button>
            </div>
          </div>
        </div>
      </main>
    </>
  )
}
