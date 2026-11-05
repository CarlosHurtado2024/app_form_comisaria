/** Iconos de trazo uniforme (24x24, grosor 2) para la navegación y los botones. */
export type IconName = 'home' | 'plus' | 'user' | 'shield' | 'logout' | 'file' | 'back' | 'chevron' | 'check' | 'search' | 'cloud' | 'camera' | 'menu' | 'trash' | 'copy'

const PATHS: Record<IconName, string> = {
  home: 'M3 11.5 12 4l9 7.5M5 10v10h5v-6h4v6h5V10',
  plus: 'M12 5v14M5 12h14',
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM4 21c0-3.9 3.6-7 8-7s8 3.1 8 7',
  shield: 'M12 3l8 3v6c0 4.6-3.4 8.3-8 9-4.6-.7-8-4.4-8-9V6l8-3ZM9 12l2 2 4-4',
  logout: 'M10 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h4M15 8l5 4-5 4M20 12H9',
  file: 'M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5ZM14 3v5h5M9 13h6M9 17h6',
  back: 'M15 18l-6-6 6-6',
  chevron: 'M6 9l6 6 6-6',
  check: 'M5 12.5l4.5 4.5L19 7',
  search: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14ZM20 20l-4-4',
  cloud: 'M7 18a4 4 0 0 1-.6-7.95A6 6 0 0 1 18 8.3 4 4 0 0 1 17 18H7Z',
  camera: 'M4 8h3l2-2h6l2 2h3v11H4V8ZM12 17a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z',
  menu: 'M4 7h16M4 12h16M4 17h16',
  trash: 'M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3',
  copy: 'M9 9h10v11H9zM5 15V4h10',
}

export function Icon({ name, size = 20, className }: { name: IconName; size?: number; className?: string }) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={PATHS[name]} />
    </svg>
  )
}
