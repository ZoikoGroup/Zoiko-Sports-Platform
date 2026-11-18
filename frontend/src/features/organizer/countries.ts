/** Countries in the demo data, with the region each belongs to. */
import type { CountryCode, RegionId } from './api/types'

export interface Country {
  code: CountryCode
  name: string
  region: RegionId
}

export const COUNTRIES: Country[] = [
  { code: 'US', name: 'United States', region: 'north-america' },
  { code: 'CA', name: 'Canada', region: 'north-america' },
  { code: 'AR', name: 'Argentina', region: 'south-america' },
  { code: 'ES', name: 'Spain', region: 'europe' },
  { code: 'NG', name: 'Nigeria', region: 'africa' },
  { code: 'JP', name: 'Japan', region: 'asia' },
  { code: 'IN', name: 'India', region: 'asia' },
  { code: 'AU', name: 'Australia', region: 'oceania' },
]

export const countryName = (code: CountryCode) => COUNTRIES.find((c) => c.code === code)?.name ?? code
