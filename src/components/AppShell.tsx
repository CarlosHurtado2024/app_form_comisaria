import type { ReactNode } from 'react'
import escudo from '../assets/escudo.png'
import { useAuth } from '../auth/AuthContext'
import { navigate, type Route } from '../hooks/useHashRoute'
import { useSyncContext } from '../store/SyncContext'
import { Icon, type IconName } from './Icon'

interface Props {
  /** Pantalla activa en la navegación */
  active: 'home' | 'profile' | 'admin'
  title: string
  subtitle?: string
  /** Acciones de la cabecera (botones) */
  actions?: ReactNode
  children: ReactNode
}

const iniciales = (nombre: string): string =>
  nombre
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('') || '·'

/**
 * Estructura común de las pantallas principales: barra lateral en escritorio,
 * barra superior y navegación inferior en el celular.
 */
export function AppShell({ active, title, subtitle, actions, children }: Props) {
  const { perfil, esAdmin, logout } = useAuth()
  const sync = useSyncContext()
  const nombre = perfil?.nombre ?? ''

  const syncLabel = sync.state.sincronizando
    ? 'Sincronizando…'
    : !sync.state.online
      ? 'Sin conexión'
      : sync.state.pendientes > 0
        ? `${sync.state.pendientes} por subir`
        : sync.state.error
          ? 'Error al sincronizar'
          : 'Sincronizado'
  const syncClass = `sync sync--${sync.state.sincronizando ? 'busy' : !sync.state.online ? 'off' : sync.state.pendientes > 0 || sync.state.error ? 'pending' : 'ok'}`

  const items: { key: Props['active'] | 'new'; label: string; icon: IconName; route: Route; admin?: boolean }[] = [
    { key: 'home', label: 'Inicio', icon: 'home', route: { name: 'home' } },
    { key: 'profile', label: 'Mi perfil', icon: 'user', route: { name: 'profile' } },
    { key: 'admin', label: 'Administración', icon: 'shield', route: { name: 'admin' }, admin: true },
  ]
  const visibles = items.filter((i) => !i.admin || esAdmin)

  return (
    <div className="shell">
      <aside className="shell__side">
        <div className="shell__brand">
          <img src={escudo} alt="" />
          <div>
            <strong>Informe TS</strong>
            <span>Comisaría de Familia</span>
          </div>
        </div>
        <button type="button" className="shell__user" onClick={() => navigate({ name: 'profile' })}>
          <span className="avatar">{iniciales(nombre)}</span>
          <span className="shell__user-text">
            <strong>{nombre || 'Mi perfil'}</strong>
            <span>{esAdmin ? 'Administrador' : perfil?.cargo || 'Profesional'}</span>
          </span>
        </button>
        <nav className="shell__nav" aria-label="Principal">
          {visibles.map((i) => (
            <button type="button" key={i.key} className={`shell__link${active === i.key ? ' is-active' : ''}`} onClick={() => navigate(i.route)} aria-current={active === i.key ? 'page' : undefined}>
              <Icon name={i.icon} />
              {i.label}
            </button>
          ))}
        </nav>
        <div className="shell__foot">
          <button type="button" className={syncClass} onClick={() => void sync.run()} title="Sincronizar ahora">
            {syncLabel}
          </button>
          <button type="button" className="shell__link" onClick={() => void logout()}>
            <Icon name="logout" />
            Cerrar sesión
          </button>
        </div>
      </aside>

      <div className="shell__main">
        <header className="shell__top">
          <div className="shell__top-brand">
            <img src={escudo} alt="" />
          </div>
          <div className="shell__title">
            <h1>{title}</h1>
            {subtitle && <small>{subtitle}</small>}
          </div>
          <div className="shell__actions">
            <button type="button" className={`${syncClass} shell__sync`} onClick={() => void sync.run()} title="Sincronizar ahora">
              {syncLabel}
            </button>
            {actions}
          </div>
        </header>
        <main className="page shell__content">{children}</main>
      </div>

      <nav className="bottomnav" aria-label="Principal">
        {visibles.map((i) => (
          <button type="button" key={i.key} className={active === i.key ? 'is-active' : ''} onClick={() => navigate(i.route)} aria-current={active === i.key ? 'page' : undefined}>
            <Icon name={i.icon} size={22} />
            <span>{i.key === 'admin' ? 'Admin' : i.label}</span>
          </button>
        ))}
        <button type="button" onClick={() => void logout()}>
          <Icon name="logout" size={22} />
          <span>Salir</span>
        </button>
      </nav>
    </div>
  )
}
