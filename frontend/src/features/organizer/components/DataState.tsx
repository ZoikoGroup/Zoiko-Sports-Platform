/**
 * Loading, error, empty and "not connected" states shared by Organizer pages.
 *
 * A page wraps its view in <ResourceView>. When the backend does not provide
 * the page's data yet, the view still renders with empty lists and unknown
 * figures, and everything inside it knows the data is unavailable: figures read
 * "—" and empty lists say data is not connected rather than claiming "none".
 */
import { CircleAlert, PlugZap, RefreshCw } from 'lucide-react'
import { useMemo, type ReactNode } from 'react'
import type { Resource } from '../../../api/resource'
import { formatCount } from '../format'
import { AvailabilityContext, useAvailability } from './availability'

const NOT_CONNECTED = "Live data isn't connected yet."

/**
 * An empty list's message. `children` is what to say when the server has
 * nothing to show; `unavailable` (optional) replaces the default text used
 * while data is not connected.
 */
export function EmptyMessage({ children, unavailable = NOT_CONNECTED, className = 'org-empty' }: { children: ReactNode; unavailable?: string; className?: string }) {
  const availability = useAvailability()
  return <p className={className}>{availability === 'live' ? children : unavailable}</p>
}

/** A count, or "—" when it is not known. */
export function Metric({ value }: { value: number | null | undefined }) {
  if (value === null || value === undefined) {
    return (
      <>
        <span aria-hidden="true">—</span>
        <span className="visually-hidden">Not available</span>
      </>
    )
  }
  return <>{formatCount(value)}</>
}

/** Page-level notice shown while the page's data is not connected. */
export function NotConnectedNotice() {
  if (useAvailability() === 'live') return null
  return (
    <p className="org-banner org-banner--info" role="status" data-testid="not-connected">
      <PlugZap size={20} aria-hidden="true" />
      <span>
        <strong>{NOT_CONNECTED}</strong> Figures and lists on this page appear once the Zoiko Sports data service is connected.
      </span>
    </p>
  )
}

/** Whole-page load failure with a retry. */
export function LoadError({ title, message, onRetry }: { title: string; message: string; onRetry: () => void }) {
  return (
    <div className="org-overview">
      <div className="org-card org-error" role="alert">
        <CircleAlert size={28} aria-hidden="true" />
        <div>
          <h1 className="org-card__title">{title}</h1>
          <p>{message}</p>
        </div>
        <button type="button" className="org-btn org-btn--secondary" onClick={onRetry}>
          <RefreshCw size={18} aria-hidden="true" /> Try again
        </button>
      </div>
    </div>
  )
}

interface ResourceViewProps<T> {
  /** The page's data type is taken from `empty`, not from this union. */
  resource: Resource<NoInfer<T>>
  /** Shown while loading. */
  skeleton: ReactNode
  /** Heading of the error card. */
  errorTitle: string
  /** The page's "no data" view model, used while the data is not connected. */
  empty: () => T
  children: (data: T) => ReactNode
}

/** Renders a page from its resource: skeleton, error, or the view (live or not connected). */
export function ResourceView<T>({ resource, skeleton, errorTitle, empty, children }: ResourceViewProps<T>) {
  const data = useMemo(() => resource.data ?? empty(), [resource.data, empty])
  if (resource.status === 'loading') return <>{skeleton}</>
  if (resource.status === 'error') return <LoadError title={errorTitle} message={resource.error} onRetry={resource.reload} />
  return <AvailabilityContext.Provider value={resource.status === 'ready' ? 'live' : 'unavailable'}>{children(data)}</AvailabilityContext.Provider>
}
