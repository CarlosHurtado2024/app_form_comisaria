import { useEffect, useState } from 'react'

export type Route = { name: 'home' } | { name: 'profile' } | { name: 'admin'; tab?: string } | { name: 'editor'; id: string; section?: string }

export function parseHash(hash: string): Route {
  const path = hash.replace(/^#/, '').replace(/^\//, '')
  const [a, b, c] = path.split('/')
  if (a === 'perfil') return { name: 'profile' }
  if (a === 'admin') return { name: 'admin', tab: b || undefined }
  if (a === 'informe' && b) return { name: 'editor', id: b, section: c || undefined }
  return { name: 'home' }
}

export function toHash(route: Route): string {
  switch (route.name) {
    case 'home':
      return '#/'
    case 'profile':
      return '#/perfil'
    case 'admin':
      return `#/admin${route.tab ? `/${route.tab}` : ''}`
    case 'editor':
      return `#/informe/${route.id}${route.section ? `/${route.section}` : ''}`
  }
}

export function navigate(route: Route, replace = false): void {
  const hash = toHash(route)
  if (replace) history.replaceState(null, '', hash)
  else location.hash = hash
  if (replace) window.dispatchEvent(new HashChangeEvent('hashchange'))
}

export function useHashRoute(): Route {
  const [route, setRoute] = useState<Route>(() => parseHash(location.hash))
  useEffect(() => {
    const onChange = () => setRoute(parseHash(location.hash))
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])
  return route
}
