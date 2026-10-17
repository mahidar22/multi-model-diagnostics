import type { ReactNode, SVGProps } from 'react'

type IconName = 'grid' | 'folder' | 'chart' | 'shield' | 'plus' | 'arrow' | 'upload' | 'check' | 'download' | 'trash' | 'logout' | 'lock' | 'clock' | 'file' | 'spark' | 'external' | 'chevron' | 'close' | 'alert' | 'search' | 'refresh' | 'database' | 'user' | 'info'

const paths: Record<IconName, ReactNode> = {
  grid: <><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></>,
  folder: <><path d="M3 7.5A1.5 1.5 0 0 1 4.5 6H10l2 2h7.5A1.5 1.5 0 0 1 21 9.5v8a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 17.5z"/><path d="M3 10h18"/></>,
  chart: <><path d="M4 19V5"/><path d="M4 19h17"/><path d="m7 15 4-4 3 2 5-6"/><path d="M16 7h3v3"/></>,
  shield: <><path d="M12 3 20 6v5c0 5-3.4 8.5-8 10-4.6-1.5-8-5-8-10V6z"/><path d="m9 12 2 2 4-4"/></>,
  plus: <><path d="M12 5v14"/><path d="M5 12h14"/></>,
  arrow: <><path d="M5 12h14"/><path d="m13 6 6 6-6 6"/></>,
  upload: <><path d="M12 16V4"/><path d="m7 9 5-5 5 5"/><path d="M5 14v4a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-4"/></>,
  check: <><path d="m5 12 4 4L19 6"/></>,
  download: <><path d="M12 4v11"/><path d="m7 10 5 5 5-5"/><path d="M5 20h14"/></>,
  trash: <><path d="M4 7h16"/><path d="M10 11v6M14 11v6"/><path d="m5 7 1 13h12l1-13M9 7V4h6v3"/></>,
  logout: <><path d="M10 17l5-5-5-5"/><path d="M15 12H3"/><path d="M12 3h6a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-6"/></>,
  lock: <><rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></>,
  clock: <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>,
  file: <><path d="M13 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V10z"/><path d="M13 3v7h7M8 15h8M8 18h5"/></>,
  spark: <><path d="m12 3 1.2 5.8L19 11l-5.8 1.2L12 18l-1.2-5.8L5 11l5.8-2.2z"/><path d="m19 16 .6 2.4L22 19l-2.4.6L19 22l-.6-2.4L16 19l2.4-.6z"/></>,
  external: <><path d="M14 4h6v6"/><path d="M20 4 11 13"/><path d="M18 13v5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h5"/></>,
  chevron: <><path d="m9 18 6-6-6-6"/></>,
  close: <><path d="m6 6 12 12M18 6 6 18"/></>,
  alert: <><path d="M10.3 4.3 2.9 17a2 2 0 0 0 1.7 3h14.8a2 2 0 0 0 1.7-3L13.7 4.3a2 2 0 0 0-3.4 0Z"/><path d="M12 9v4M12 17h.01"/></>,
  search: <><circle cx="10.8" cy="10.8" r="6.8"/><path d="m16 16 5 5"/></>,
  refresh: <><path d="M20 7v5h-5"/><path d="M4.9 9a7.5 7.5 0 0 1 12.6-2L20 12M4 17v-5h5"/><path d="M19.1 15a7.5 7.5 0 0 1-12.6 2L4 12"/></>,
  database: <><ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5"/><path d="M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3"/></>,
  user: <><circle cx="12" cy="8" r="3.5"/><path d="M5 21c.4-4 2.8-6 7-6s6.6 2 7 6"/></>,
  info: <><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/></>,
}

export function Icon({ name, size = 18, ...props }: { name: IconName; size?: number } & SVGProps<SVGSVGElement>) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      {paths[name]}
    </svg>
  )
}
