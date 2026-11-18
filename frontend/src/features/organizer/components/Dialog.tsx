import { useEffect, useRef, type ReactNode } from 'react'

interface DialogProps {
  open: boolean
  onClose: () => void
  /** id of the heading that names the dialog. */
  labelledBy: string
  /** "center" for forms, "drawer" for the side details panel. */
  variant?: 'center' | 'drawer'
  children: ReactNode
}

/**
 * Modal built on the native <dialog>: the browser traps focus, makes the page
 * behind inert, closes on Escape and returns focus to the opener. Clicking the
 * backdrop also closes it. A child marked data-autofocus receives focus on open.
 */
export function Dialog({ open, onClose, labelledBy, variant = 'center', children }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) {
      dialog.showModal()
      // The browser focuses the first focusable element; prefer a marked field.
      dialog.querySelector<HTMLElement>('[data-autofocus]')?.focus()
    }
    if (!open && dialog.open) dialog.close()
  }, [open])

  return (
    <dialog
      ref={ref}
      className={`org-dialog org-dialog--${variant}`}
      aria-labelledby={labelledBy}
      onClose={onClose}
      onClick={(event) => {
        if (event.target === ref.current) onClose()
      }}
    >
      {open && <div className="org-dialog__body">{children}</div>}
    </dialog>
  )
}
