import { ArrowLeft, Construction } from 'lucide-react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { ADDITIONAL_WORKSPACES, findNavItem, itemNumber, organizerPath } from './navigation'
import { useDocumentTitle } from './shellContext'

/**
 * Every sidebar destination other than the Overview. Each renders inside the
 * shell (so navigation works end to end) and states what the module will do
 * until it is built. Unknown slugs return to the Overview.
 */
export function ModulePage() {
  const { module } = useParams()
  const item = findNavItem(module)
  useDocumentTitle(item?.label ?? 'Overview')

  if (!item || item.slug === 'overview') return <Navigate to={organizerPath('overview')} replace />

  const Icon = item.icon
  const number = itemNumber(item)
  const isWorkspace = ADDITIONAL_WORKSPACES.includes(item)

  return (
    <div className="org-module">
      <nav className="org-breadcrumb" aria-label="Breadcrumb">
        <Link to={organizerPath('overview')}>Organizer Workspace</Link>
        <span aria-hidden="true">/</span>
        <span aria-current="page">{item.label}</span>
      </nav>
      <header className="org-module__head">
        <span className="org-module__icon" aria-hidden="true">
          <Icon size={30} />
        </span>
        <div>
          <h1 className="org-module__title">
            {number && <span className="org-module__number">{number}. </span>}
            {item.label}
          </h1>
          <p className="org-module__description">{item.description}</p>
        </div>
      </header>
      <section className="org-card org-module__body" aria-label="Module status">
        <Construction size={36} aria-hidden="true" />
        <h2 className="org-card__title">{isWorkspace ? 'Workspace coming soon' : 'Coming in a later build'}</h2>
        <p>
          {isWorkspace
            ? `The ${item.label} workspace is a separate role experience. Access to it is granted through your organization memberships.`
            : 'This module is part of the Organizer Workspace plan. Its screens and data are not available in this build yet.'}
        </p>
        <Link className="org-btn org-btn--secondary" to={organizerPath('overview')}>
          <ArrowLeft size={18} aria-hidden="true" /> Back to Overview
        </Link>
      </section>
    </div>
  )
}
