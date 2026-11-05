import lockup from '../assets/brand/logo-lockup.webp'
import './Logo.css'

interface LogoProps {
  /**
   * "wordmark": tile + ZOiKO SPORTS, for the card. Navy lettering on the light
   *   theme and white on the dark theme — chosen in CSS (Logo.css) from the
   *   page's data-theme, so only the variant in use downloads.
   * "lockup": adds the GLOBAL SPORTS PLATFORM tagline; always white (sits on the photo).
   */
  variant?: 'wordmark' | 'lockup'
  className?: string
}

export function Logo({ variant = 'wordmark', className }: LogoProps) {
  if (variant === 'lockup') {
    // Intrinsic size of the extracted official artwork (2x asset). Small, so it is
    // fetched first and decoded with the frame: it never waits behind the large
    // stadium plate and appears together with the headline.
    return (
      <img
        className={className}
        src={lockup}
        width={860}
        height={312}
        alt="Zoiko Sports — Global Sports Platform"
        decoding="sync"
        fetchPriority="high"
      />
    )
  }
  return <span role="img" aria-label="Zoiko Sports" className={['logo-wordmark', className].filter(Boolean).join(' ')} />
}
