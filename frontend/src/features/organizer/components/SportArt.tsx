/**
 * Sport artwork drawn in SVG: realistic-looking balls for the hero banner and
 * event thumbnails, plus line icons that match lucide's 24px / 2px grid.
 * Self-contained (no image downloads) and crisp at any size or pixel density.
 */
import { useId, type ReactNode, type SVGProps } from 'react'
import type { SportId } from '../api/types'

type BallProps = { sport: SportId; x?: number; y?: number; size: number; rotate?: number }

/** One ball as a nested <svg> so it can be placed inside a larger illustration. */
export function Ball({ sport, x = 0, y = 0, size, rotate = 0 }: BallProps) {
  const id = useId().replace(/:/g, '')
  const art = BALLS[sport](id)
  return (
    <svg x={x} y={y} width={size} height={size} viewBox="0 0 100 100" overflow="visible">
      <g transform={rotate ? `rotate(${rotate} 50 50)` : undefined}>{art}</g>
    </svg>
  )
}

const shine = (id: string) => (
  <>
    <radialGradient id={`${id}-shine`} cx="0.35" cy="0.3" r="0.45">
      <stop offset="0" stopColor="#ffffff" stopOpacity="0.55" />
      <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
    </radialGradient>
  </>
)

const Highlight = ({ id }: { id: string }) => <circle cx="50" cy="50" r="46" fill={`url(#${id}-shine)`} />

const sphere = (id: string, light: string, dark: string) => (
  <radialGradient id={`${id}-body`} cx="0.38" cy="0.32" r="0.75">
    <stop offset="0" stopColor={light} />
    <stop offset="1" stopColor={dark} />
  </radialGradient>
)

const BALLS: Record<SportId, (id: string) => ReactNode> = {
  football: (id) => (
    <>
      <defs>
        {shine(id)}
        <radialGradient id={`${id}-body`} cx="0.4" cy="0.35" r="0.7">
          <stop offset="0" stopColor="#b5622f" />
          <stop offset="0.6" stopColor="#7c3814" />
          <stop offset="1" stopColor="#4a1d07" />
        </radialGradient>
      </defs>
      <path d="M3 50C20 22 80 22 97 50 80 78 20 78 3 50Z" fill={`url(#${id}-body)`} />
      <path d="M17 36c-4 9-4 19 0 28M83 36c4 9 4 19 0 28" stroke="#f4eee6" strokeWidth="3.2" fill="none" strokeLinecap="round" />
      <path d="M34 44h32" stroke="#f4eee6" strokeWidth="2.6" strokeLinecap="round" />
      <path d="M38 40v8M44 40v8M50 40v8M56 40v8M62 40v8" stroke="#f4eee6" strokeWidth="2.2" strokeLinecap="round" />
      <path d="M3 50C20 22 80 22 97 50" stroke="#ffffff" strokeOpacity="0.25" strokeWidth="2" fill="none" />
    </>
  ),
  basketball: (id) => (
    <>
      <defs>
        {shine(id)}
        {sphere(id, '#ff9b42', '#b6460f')}
      </defs>
      <circle cx="50" cy="50" r="46" fill={`url(#${id}-body)`} />
      <g stroke="#3a1606" strokeWidth="2.6" fill="none">
        <path d="M50 4v92M4 50h92" />
        <path d="M18 17c14 18 14 48 0 66M82 17c-14 18-14 48 0 66" />
      </g>
      <Highlight id={id} />
    </>
  ),
  baseball: (id) => (
    <>
      <defs>
        {shine(id)}
        {sphere(id, '#ffffff', '#cfd3da')}
      </defs>
      <circle cx="50" cy="50" r="46" fill={`url(#${id}-body)`} />
      <g fill="none" stroke="#d3262f">
        <path d="M22 12c14 20 14 56 0 76M78 12c-14 20-14 56 0 76" strokeWidth="1.8" />
        <path d="M22 12c14 20 14 56 0 76M78 12c-14 20-14 56 0 76" strokeWidth="7" strokeDasharray="1.6 5" />
      </g>
      <Highlight id={id} />
    </>
  ),
  soccer: (id) => (
    <>
      <defs>
        {shine(id)}
        {sphere(id, '#ffffff', '#c9ced8')}
        <clipPath id={`${id}-clip`}>
          <circle cx="50" cy="50" r="46" />
        </clipPath>
      </defs>
      <circle cx="50" cy="50" r="46" fill={`url(#${id}-body)`} />
      <g clipPath={`url(#${id}-clip)`} fill="#14161c" stroke="#14161c" strokeWidth="2" strokeLinejoin="round">
        <path d="M50 36l13.3 9.7-5.1 15.6H41.8l-5.1-15.6z" />
        <path d="M50 36V22M63.3 45.7l13.3-4.3M58.2 61.3l8.2 11.3M41.8 61.3l-8.2 11.3M36.7 45.7l-13.3-4.3" fill="none" />
        <path d="M50 2l11 8-4 12H43l-4-12z" />
        <path d="M95 36l-4 13-12 0-4-12 11-8z" />
        <path d="M77 86l-13 1-4-11 9-8 12 4z" />
        <path d="M23 86l13 1 4-11-9-8-12 4z" />
        <path d="M5 36l4 13 12 0 4-12-11-8z" />
      </g>
      <Highlight id={id} />
    </>
  ),
  cricket: (id) => (
    <>
      <defs>
        {shine(id)}
        {sphere(id, '#e0393f', '#6a0b10')}
      </defs>
      <circle cx="50" cy="50" r="46" fill={`url(#${id}-body)`} />
      <g fill="none" stroke="#f6dcc8">
        <path d="M40 5c-9 28-9 62 0 90M50 5c-9 28-9 62 0 90" strokeWidth="1.4" />
        <path d="M45 5c-9 28-9 62 0 90" strokeWidth="6" strokeDasharray="1.2 3.6" />
      </g>
      <Highlight id={id} />
    </>
  ),
  tennis: (id) => (
    <>
      <defs>
        {shine(id)}
        {sphere(id, '#ecf866', '#a5bf12')}
      </defs>
      <circle cx="50" cy="50" r="46" fill={`url(#${id}-body)`} />
      <path d="M12 22c22 14 22 42 0 56M88 22c-22 14-22 42 0 56" stroke="#ffffff" strokeWidth="4" fill="none" strokeLinecap="round" />
      <Highlight id={id} />
    </>
  ),
  'ice-hockey': (id) => (
    <>
      <defs>
        <linearGradient id={`${id}-top`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#4a4d55" />
          <stop offset="1" stopColor="#1b1d22" />
        </linearGradient>
      </defs>
      <path d="M6 42v18c0 9 19.7 16 44 16s44-7 44-16V42" fill="#0e0f12" />
      <ellipse cx="50" cy="42" rx="44" ry="16" fill={`url(#${id}-top)`} />
      <ellipse cx="50" cy="42" rx="32" ry="10" fill="none" stroke="#ffffff" strokeOpacity="0.12" strokeWidth="1.5" />
    </>
  ),
}

const THUMB_BACKGROUNDS: Record<SportId, ReactNode> = {
  football: (
    <>
      <rect width="96" height="52" fill="#2f7d32" />
      <path d="M16 0v52M32 0v52M48 0v52M64 0v52M80 0v52" stroke="#ffffff" strokeOpacity="0.55" strokeWidth="1" />
    </>
  ),
  basketball: (
    <>
      <rect width="96" height="52" fill="#c98a4b" />
      <path d="M0 8h96M0 18h96M0 28h96M0 38h96M0 48h96" stroke="#9c6633" strokeOpacity="0.45" strokeWidth="0.8" />
      <path d="M0 36h40v16M40 36a10 10 0 0 1 0 0" stroke="#ffffff" strokeWidth="1.4" fill="none" />
      <circle cx="20" cy="52" r="14" stroke="#ffffff" strokeWidth="1.4" fill="none" />
    </>
  ),
  cricket: (
    <>
      <rect width="96" height="52" fill="#3f8a3a" />
      <rect x="30" y="14" width="40" height="22" fill="#cdb98a" />
      <path d="M34 14v22M66 14v22" stroke="#ffffff" strokeWidth="1.2" />
    </>
  ),
  tennis: (
    <>
      <rect width="96" height="52" fill="#2f6db5" />
      <rect x="10" y="8" width="76" height="36" fill="#3b82c9" stroke="#ffffff" strokeWidth="1.4" />
      <path d="M10 14h76M10 38h76M48 14v24M26 14v24M70 14v24" stroke="#ffffff" strokeWidth="1" />
    </>
  ),
  soccer: (
    <>
      <rect width="96" height="52" fill="#2e8b3e" />
      <path d="M0 0h12v52H0zM24 0h12v52H24zM48 0h12v52H48zM72 0h12v52H72z" fill="#ffffff" fillOpacity="0.07" />
      <path d="M48 0v52" stroke="#ffffff" strokeOpacity="0.6" />
      <circle cx="48" cy="26" r="10" stroke="#ffffff" strokeOpacity="0.6" fill="none" />
    </>
  ),
  baseball: (
    <>
      <rect width="96" height="52" fill="#3c8a3f" />
      <path d="M48 6l22 20-22 20-22-20z" fill="#c8915a" />
      <path d="M48 12l16 14-16 14-16-14z" fill="#3c8a3f" />
    </>
  ),
  'ice-hockey': (
    <>
      <rect width="96" height="52" fill="#e6f0f8" />
      <path d="M48 0v52" stroke="#d33" strokeWidth="1.6" />
      <path d="M24 0v52M72 0v52" stroke="#3a6fc2" strokeWidth="1.4" />
      <circle cx="48" cy="26" r="9" stroke="#3a6fc2" strokeWidth="1" fill="none" />
    </>
  ),
}

/** A small photo-like tile for an event row: the playing surface with its ball. */
export function SportThumb({ sport, className }: { sport: SportId; className?: string }) {
  const puck = sport === 'ice-hockey'
  const vignette = `${useId().replace(/:/g, '')}-vignette`
  return (
    <svg className={className} viewBox="0 0 96 52" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">
      <defs>
        <radialGradient id={vignette} cx="0.5" cy="0.5" r="0.75">
          <stop offset="0.5" stopColor="#000" stopOpacity="0" />
          <stop offset="1" stopColor="#000" stopOpacity="0.35" />
        </radialGradient>
      </defs>
      {THUMB_BACKGROUNDS[sport]}
      <rect width="96" height="52" fill={`url(#${vignette})`} />
      <Ball sport={sport} x={puck ? 34 : 30} y={puck ? 12 : 6} size={puck ? 30 : 40} rotate={sport === 'football' ? -20 : 0} />
    </svg>
  )
}

type IconProps = SVGProps<SVGSVGElement> & { size?: number }

function Stroke({ size = 18, children, ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      {children}
    </svg>
  )
}

const LINE_ICONS: Record<SportId, ReactNode> = {
  football: (
    <>
      <path d="M4.5 19.5C3 12 12 3 19.5 4.5 21 12 12 21 4.5 19.5Z" />
      <path d="M9 15l6-6M10.5 10.5l3 3M8.5 12.5l3 3M12.5 8.5l3 3" />
    </>
  ),
  basketball: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3v18M6 5.3c2.6 3.7 2.6 9.7 0 13.4M18 5.3c-2.6 3.7-2.6 9.7 0 13.4" />
    </>
  ),
  cricket: (
    <>
      <path d="M15 3.5l5.5 5.5-8.5 8.5L6.5 12z" />
      <path d="M6.5 17.5 3 21" />
      <circle cx="19" cy="19" r="2" />
    </>
  ),
  tennis: (
    <>
      <circle cx="14.5" cy="9.5" r="6" />
      <path d="M10.3 13.7 4 20M11 9l7 0M14.5 5.5v8" />
    </>
  ),
  soccer: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="m12 8 3.8 2.8-1.5 4.4H9.7l-1.5-4.4zM12 8V3.5M15.8 10.8l4.3-1.4M14.3 15.2l2.7 3.6M9.7 15.2 7 18.8M8.2 10.8 3.9 9.4" />
    </>
  ),
  baseball: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M6.5 5c2.4 4 2.4 10 0 14M17.5 5c-2.4 4-2.4 10 0 14" />
    </>
  ),
  'ice-hockey': (
    <>
      <path d="M6 3l6.2 13.4a1 1 0 0 0 .9.6H20" />
      <ellipse cx="7" cy="19" rx="3.5" ry="1.6" />
    </>
  ),
}

export function SportIcon({ sport, ...props }: IconProps & { sport: SportId }) {
  return <Stroke {...props}>{LINE_ICONS[sport]}</Stroke>
}
