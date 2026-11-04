import { AuthProvider, useAuth } from './auth/AuthContext'
import { InstallPrompt } from './components/InstallPrompt'
import { ToastHost } from './components/Toast'
import { useHashRoute } from './hooks/useHashRoute'
import { Admin } from './screens/Admin'
import { CambiarClave } from './screens/CambiarClave'
import { Editor } from './screens/Editor'
import { Home } from './screens/Home'
import { Login } from './screens/Login'
import { Profile } from './screens/Profile'
import { SyncContext } from './store/SyncContext'
import { useSync } from './store/useSync'

function Splash() {
  return (
    <div className="splash" role="status" aria-live="polite">
      <div className="splash__spinner" />
      <span>Cargando…</span>
    </div>
  )
}

function Shell() {
  const route = useHashRoute()
  const { status, perfil, esAdmin } = useAuth()
  const sync = useSync(status === 'autenticado' ? perfil?.id : undefined)

  if (status === 'cargando') return <Splash />
  if (status === 'anonimo') return <Login />
  if (perfil?.debe_cambiar_clave) return <CambiarClave obligatorio />

  return (
    <SyncContext.Provider value={sync}>
      {route.name === 'home' && <Home />}
      {route.name === 'profile' && <Profile />}
      {route.name === 'admin' && (esAdmin ? <Admin tab={route.tab} /> : <Home />)}
      {route.name === 'editor' && <Editor key={route.id} id={route.id} sectionId={route.section} />}
    </SyncContext.Provider>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <Shell />
      <InstallPrompt />
      <ToastHost />
    </AuthProvider>
  )
}
