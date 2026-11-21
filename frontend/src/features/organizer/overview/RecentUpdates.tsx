import { CircleCheck, Rss } from 'lucide-react'
import type { RecentUpdate } from '../api/types'
import { EmptyMessage } from '../components/DataState'
import { formatAgo } from '../format'

/** One-line strip of the latest platform updates. */
export function RecentUpdates({ items, now }: { items: RecentUpdate[]; now: Date }) {
  return (
    <section className="org-card org-updates" aria-labelledby="org-updates-title">
      <h2 id="org-updates-title" className="org-updates__title">
        <Rss size={24} strokeWidth={2.4} aria-hidden="true" />
        Recent Updates
      </h2>
      {items.length === 0 ? (
        <EmptyMessage className="org-updates__empty">No updates yet.</EmptyMessage>
      ) : (
        <ul className="org-updates__list">
          {items.slice(0, 3).map((item) => (
            <li key={item.id}>
              <CircleCheck className="org-updates__icon" size={22} aria-hidden="true" />
              <span className="org-updates__text">
                {item.summary} – {item.subject}
              </span>
              <time className="org-updates__time" dateTime={item.at}>
                {formatAgo(item.at, now)}
              </time>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
