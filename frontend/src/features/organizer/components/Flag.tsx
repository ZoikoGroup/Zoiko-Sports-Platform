/**
 * Simplified national flags (24×16) for the countries in countries.ts.
 * Drawn in SVG because Windows does not render flag emoji.
 */
import type { ReactNode } from 'react'
import type { CountryCode } from '../api/types'

const FLAGS: Record<CountryCode, ReactNode> = {
  US: (
    <>
      <rect width="24" height="16" fill="#fff" />
      {[0, 2, 4, 6, 8, 10, 12].map((i) => (
        <rect key={i} y={i * 1.23} width="24" height="1.23" fill="#b22234" />
      ))}
      <rect width="10" height="8.6" fill="#3c3b6e" />
    </>
  ),
  CA: (
    <>
      <rect width="24" height="16" fill="#fff" />
      <rect width="6" height="16" fill="#d52b1e" />
      <rect x="18" width="6" height="16" fill="#d52b1e" />
      <path d="M12 3.5l1 2 1.6-.6-.5 2.6 1.4-1-.3 1.6 1.3.2-1.8 1.6.4 1-2.6-.4V13h-1V10.5l-2.6.4.4-1L7.4 8.3l1.3-.2-.3-1.6 1.4 1-.5-2.6 1.6.6z" fill="#d52b1e" />
    </>
  ),
  AR: (
    <>
      <rect width="24" height="16" fill="#74acdf" />
      <rect y="5.33" width="24" height="5.34" fill="#fff" />
      <circle cx="12" cy="8" r="1.8" fill="#f6b40e" />
    </>
  ),
  ES: (
    <>
      <rect width="24" height="16" fill="#aa151b" />
      <rect y="4" width="24" height="8" fill="#f1bf00" />
    </>
  ),
  NG: (
    <>
      <rect width="24" height="16" fill="#fff" />
      <rect width="8" height="16" fill="#008751" />
      <rect x="16" width="8" height="16" fill="#008751" />
    </>
  ),
  JP: (
    <>
      <rect width="24" height="16" fill="#fff" />
      <circle cx="12" cy="8" r="4.6" fill="#bc002d" />
    </>
  ),
  IN: (
    <>
      <rect width="24" height="16" fill="#fff" />
      <rect width="24" height="5.33" fill="#ff9933" />
      <rect y="10.67" width="24" height="5.33" fill="#138808" />
      <circle cx="12" cy="8" r="2" fill="none" stroke="#000080" strokeWidth="0.6" />
    </>
  ),
  AU: (
    <>
      <rect width="24" height="16" fill="#012169" />
      <path d="M0 0l12 8M12 0L0 8" stroke="#fff" strokeWidth="1.6" />
      <path d="M0 0l12 8M12 0L0 8" stroke="#c8102e" strokeWidth="0.6" />
      <path d="M6 0v8M0 4h12" stroke="#fff" strokeWidth="2.4" />
      <path d="M6 0v8M0 4h12" stroke="#c8102e" strokeWidth="1.3" />
      <circle cx="6" cy="12.2" r="1.3" fill="#fff" />
      <circle cx="18" cy="3.5" r="0.8" fill="#fff" />
      <circle cx="20.5" cy="7" r="0.8" fill="#fff" />
      <circle cx="18" cy="12.5" r="0.9" fill="#fff" />
      <circle cx="15.5" cy="7.5" r="0.7" fill="#fff" />
    </>
  ),
}

export function Flag({ code, className }: { code: CountryCode; className?: string }) {
  return (
    <svg className={className} width="24" height="16" viewBox="0 0 24 16" aria-hidden="true" focusable="false">
      {FLAGS[code]}
      <rect width="24" height="16" fill="none" stroke="rgba(0,0,0,0.15)" strokeWidth="0.6" />
    </svg>
  )
}
