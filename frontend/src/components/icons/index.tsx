/** Custom icons drawn on lucide's 24px / 2px-stroke grid so they sit alongside lucide icons. */
import type { SVGProps } from 'react'

type IconProps = SVGProps<SVGSVGElement> & { size?: number }

function Stroke({ size = 24, children, ...props }: IconProps) {
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

/** Stadium bowl: oval field inside tiered stands. */
export function StadiumIcon(props: IconProps) {
  return (
    <Stroke {...props}>
      <ellipse cx="12" cy="9" rx="10" ry="4" />
      <ellipse cx="12" cy="9" rx="5" ry="1.6" />
      <path d="M2 9v6c0 2.2 4.5 4 10 4s10-1.8 10-4V9" />
      <path d="M7 12.6V18.4M12 13v6M17 12.6v5.8" />
    </Stroke>
  )
}

/** Three-person group, used for league / event organizations. */
export function GroupIcon(props: IconProps) {
  return (
    <Stroke {...props}>
      <circle cx="12" cy="7.5" r="3" />
      <path d="M6.5 20v-1.5a5.5 5.5 0 0 1 11 0V20" />
      <circle cx="5" cy="9.5" r="2.2" />
      <path d="M1.5 19v-.8A3.6 3.6 0 0 1 5.3 14.6" />
      <circle cx="19" cy="9.5" r="2.2" />
      <path d="M22.5 19v-.8a3.6 3.6 0 0 0-3.8-3.6" />
    </Stroke>
  )
}
