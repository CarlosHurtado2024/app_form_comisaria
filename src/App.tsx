import { InstallPrompt } from './components/InstallPrompt'
import { ToastHost } from './components/Toast'
import { useHashRoute } from './hooks/useHashRoute'
import { Editor } from './screens/Editor'
import { Home } from './screens/Home'
import { Profile } from './screens/Profile'

export default function App() {
  const route = useHashRoute()
  return (
    <>
      {route.name === 'home' && <Home />}
      {route.name === 'profile' && <Profile />}
      {route.name === 'editor' && <Editor key={route.id} id={route.id} sectionId={route.section} />}
      <InstallPrompt />
      <ToastHost />
    </>
  )
}
