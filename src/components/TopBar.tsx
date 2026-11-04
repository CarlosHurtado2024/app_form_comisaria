import type { ReactNode } from 'react'
import escudo from '../assets/escudo.png'

interface Props {
  title: string
  subtitle?: string
  onBack?: () => void
  right?: ReactNode
  brand?: boolean
}

export function TopBar({ title, subtitle, onBack, right, brand }: Props) {
  return (
    <header className="topbar">
      <div className="topbar__inner">
        {onBack ? (
          <button type="button" className="btn btn--onbar btn--icon" onClick={onBack} aria-label="Volver">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
        ) : brand ? (
          <div className="topbar__brand">
            <img src={escudo} alt="Escudo del Municipio de Morales" />
          </div>
        ) : null}
        <div className="topbar__title">
          <h1>{title}</h1>
          {subtitle && <small>{subtitle}</small>}
        </div>
        {right}
      </div>
    </header>
  )
}
