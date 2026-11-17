import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'

interface MenuProps {
  /** Accessible name of the trigger button. */
  label: string
  /** Visible content of the trigger. */
  trigger: ReactNode
  triggerClassName?: string
  /** Panel alignment under the trigger. */
  align?: 'start' | 'end'
  /** "menu" for actions/choices (arrow keys move between items); "dialog" for free content. */
  kind?: 'menu' | 'dialog'
  panelClassName?: string
  children: (close: () => void) => ReactNode
}

const ITEM_SELECTOR = '[role="menuitem"], [role="menuitemradio"], [role="menuitemcheckbox"]'

/**
 * A button that opens a floating panel. Closes on Escape (returning focus to
 * the button), on a click outside, and after an item is chosen. Menus follow
 * the ARIA menu-button pattern: focus moves to the first item and the arrow,
 * Home and End keys move between items.
 */
export function Menu({ label, trigger, triggerClassName, align = 'start', kind = 'menu', panelClassName, children }: MenuProps) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const panelId = useId()

  // Closing bumps a counter; the effect below then returns focus to the button.
  const [closedCount, setClosedCount] = useState(0)
  const close = useCallback(() => {
    setOpen(false)
    setClosedCount((n) => n + 1)
  }, [])

  useEffect(() => {
    if (closedCount > 0) buttonRef.current?.focus()
  }, [closedCount])

  useEffect(() => {
    if (!open) return
    const items = panelRef.current?.querySelectorAll<HTMLElement>(ITEM_SELECTOR)
    const checked = panelRef.current?.querySelector<HTMLElement>('[aria-checked="true"]')
    if (kind === 'menu') (checked ?? items?.[0])?.focus()
    else panelRef.current?.focus()

    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [open, kind])

  function onKeyDown(event: KeyboardEvent) {
    if (event.key === 'Escape' && open) {
      event.stopPropagation()
      close()
      return
    }
    if (kind !== 'menu' || !open) return
    const items = Array.from(panelRef.current?.querySelectorAll<HTMLElement>(ITEM_SELECTOR) ?? [])
    const index = items.indexOf(document.activeElement as HTMLElement)
    const move = (next: number) => {
      event.preventDefault()
      items[(next + items.length) % items.length]?.focus()
    }
    if (event.key === 'ArrowDown') move(index + 1)
    else if (event.key === 'ArrowUp') move(index - 1)
    else if (event.key === 'Home') move(0)
    else if (event.key === 'End') move(items.length - 1)
    else if (event.key === 'Tab') setOpen(false)
  }

  return (
    <div className="org-menu" ref={rootRef} onKeyDown={onKeyDown}>
      <button
        ref={buttonRef}
        type="button"
        className={triggerClassName}
        aria-label={label}
        aria-haspopup={kind === 'menu' ? 'menu' : 'dialog'}
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        onClick={() => setOpen((value) => !value)}
      >
        {trigger}
      </button>
      {open && (
        <div
          ref={panelRef}
          id={panelId}
          className={['org-menu__panel', `org-menu__panel--${align}`, panelClassName].filter(Boolean).join(' ')}
          role={kind}
          aria-label={label}
          tabIndex={-1}
        >
          {children(close)}
        </div>
      )}
    </div>
  )
}
