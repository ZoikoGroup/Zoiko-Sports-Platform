import { LoaderCircle } from 'lucide-react'
import type { ButtonHTMLAttributes, ReactNode } from 'react'
import './form.css'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary'
  loading?: boolean
  loadingLabel?: string
  trailingIcon?: ReactNode
}

export function Button({
  variant = 'primary',
  loading = false,
  loadingLabel,
  trailingIcon,
  children,
  className,
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      className={['btn', `btn--${variant}`, className].filter(Boolean).join(' ')}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? (
        <>
          <LoaderCircle className="btn__spinner" size={20} aria-hidden="true" />
          {loadingLabel ?? children}
        </>
      ) : (
        <>
          {children}
          {trailingIcon}
        </>
      )}
    </button>
  )
}
