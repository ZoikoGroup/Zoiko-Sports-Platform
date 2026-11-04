import { CircleAlert, CircleCheck, Info } from 'lucide-react'
import { forwardRef, type ReactNode } from 'react'
import './form.css'

interface AlertProps {
  tone?: 'error' | 'success' | 'info'
  children: ReactNode
}

const ICONS = { error: CircleAlert, success: CircleCheck, info: Info }

/** Announced status message. Focusable so a form can move focus to it after a failed submit. */
export const Alert = forwardRef<HTMLDivElement, AlertProps>(function Alert({ tone = 'error', children }, ref) {
  const Icon = ICONS[tone]
  return (
    <div ref={ref} tabIndex={-1} className={`alert alert--${tone}`} role={tone === 'error' ? 'alert' : 'status'}>
      <Icon size={20} aria-hidden="true" className="alert__icon" />
      <div className="alert__body">{children}</div>
    </div>
  )
})
