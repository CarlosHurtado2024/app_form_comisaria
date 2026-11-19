import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { ErrorBoundary } from './components/ErrorBoundary'

// Si un archivo de una versión anterior ya no existe en el servidor, recargar una vez para tomar la nueva.
window.addEventListener('vite:preloadError', () => {
  if (sessionStorage.getItem('its.recargado')) return
  sessionStorage.setItem('its.recargado', '1')
  location.reload()
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
