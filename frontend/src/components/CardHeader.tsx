import { useEffect, type ReactNode } from 'react'
import { Logo } from './Logo'
import './CardHeader.css'

interface CardHeaderProps {
  title: string
  subtitle?: ReactNode
  /** Browser tab title; defaults to the card title. */
  documentTitle?: string
}

export function CardHeader({ title, subtitle, documentTitle }: CardHeaderProps) {
  useEffect(() => {
    document.title = `${documentTitle ?? title} · Zoiko Sports`
  }, [title, documentTitle])

  return (
    <header className="card-header">
      <Logo className="card-header__logo" />
      <h1 className="card-header__title">{title}</h1>
      {subtitle && <p className="card-header__subtitle">{subtitle}</p>}
    </header>
  )
}
