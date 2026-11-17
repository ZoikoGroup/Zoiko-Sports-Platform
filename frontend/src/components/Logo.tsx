import mark from '../assets/brand/logo-mark.webp'
import wordmarkWhite from '../assets/brand/logo-wordmark.webp'
import './Logo.css'

interface LogoProps {
  /**
   * "wordmark": tile + ZOiKO SPORTS, for the card. Navy lettering on the light
   *   theme and white on the dark theme — chosen in CSS (Logo.css) from the
   *   page's data-theme, so only the variant in use downloads.
   * "brand": the same wordmark, always white, for the brand column on the photo.
   * "mark": the tile alone, above the sign-in card's title. Decorative there —
   *   the brand logo beside it already names the product.
   */
  variant?: 'wordmark' | 'brand' | 'mark'
  className?: string
}

export function Logo({ variant = 'wordmark', className }: LogoProps) {
  if (variant === 'brand') {
    // Intrinsic size of the extracted official artwork (2x asset). Small, so it is
    // fetched first and decoded with the frame: it never waits behind the large
    // stadium plate and appears together with the headline.
    return (
      <img
        className={className}
        src={wordmarkWhite}
        width={776}
        height={228}
        alt="Zoiko Sports"
        decoding="sync"
        fetchPriority="high"
      />
    )
  }
  if (variant === 'mark') {
    return <img className={className} src={mark} width={218} height={218} alt="" aria-hidden="true" decoding="sync" />
  }
  return <span role="img" aria-label="Zoiko Sports" className={['logo-wordmark', className].filter(Boolean).join(' ')} />
}
