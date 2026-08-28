'use client'

import Link from 'next/link'
import { Bell, Menu } from 'lucide-react'
import { useUser } from '@/hooks/useUser'

interface TopbarProps {
  title: string
  subtitle?: string
  onMenuClick?: () => void
}

export function Topbar({ title, subtitle, onMenuClick }: TopbarProps) {
  const { displayName, initials } = useUser()

  return (
    <header className="flex h-16 shrink-0 items-center justify-between border-b border-[var(--color-ink-100)] bg-white px-4 md:px-8">
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuClick}
          className="rounded-md p-1.5 text-[var(--color-ink-600)] hover:bg-[var(--color-ink-50)] md:hidden"
          aria-label="Abrir menu"
        >
          <Menu size={20} />
        </button>
        <div>
          <h1 className="text-lg font-semibold text-[var(--color-ink-900)]">{title}</h1>
          {subtitle && <p className="text-sm text-[var(--color-ink-500)]">{subtitle}</p>}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          className="relative rounded-md p-2 text-[var(--color-ink-500)] hover:bg-[var(--color-ink-50)]"
          aria-label="Notificações"
        >
          <Bell size={18} />
          <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-[var(--color-signal-500)]" />
        </button>

        <Link
          href="/app/configuracoes"
          className="flex items-center gap-2.5 rounded-lg p-1.5 transition-colors hover:bg-[var(--color-ink-50)]"
          title={`Conta: ${displayName}`}
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--color-signal-600)] text-sm font-semibold text-white shadow-sm">
            {initials}
          </div>
          <span className="hidden text-sm font-medium text-[var(--color-ink-800)] sm:inline-block">
            {displayName}
          </span>
        </Link>
      </div>
    </header>
  )
}
