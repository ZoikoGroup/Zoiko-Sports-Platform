/**
 * Footer destinations. A link is only rendered as a link once its URL is
 * configured (VITE_LINK_*), so the page never ships dead or placeholder links.
 */
interface SiteLink {
  label: string
  href?: string
}

const env = import.meta.env

export const FOOTER_LINKS: SiteLink[] = [
  { label: 'Privacy', href: env.VITE_LINK_PRIVACY },
  { label: 'Terms', href: env.VITE_LINK_TERMS },
  { label: 'Security', href: env.VITE_LINK_SECURITY },
  { label: 'Accessibility', href: env.VITE_LINK_ACCESSIBILITY },
  { label: 'Help', href: env.VITE_LINK_HELP },
]
