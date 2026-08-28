'use client'

import { useState, type ReactNode } from 'react'
import { X, Target } from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Search, Users, CreditCard, Settings } from 'lucide-react'
import { Sidebar } from './Sidebar'
import { Topbar } from './Topbar'
import { cn } from '@/lib/utils'

const NAV_ITEMS = [
  { href: '/app', label: 'Dashboard', icon: LayoutDashboard, exact: true },
  { href: '/app/buscar', label: 'Buscar Leads', icon: Search },
  { href: '/app/meus-leads', label: 'Meus Leads', icon: Users },
  { href: '/app/assinatura', label: 'Assinatura', icon: CreditCard },
  { href: '/app/configuracoes', label: 'Configurações', icon: Settings },
]

interface AppLayoutProps {
  title: string
  subtitle?: string
  children: ReactNode
}

export function AppLayout({ title, subtitle, children }: AppLayoutProps) {
  const [mobileOpen, setMobileOpen] = useState(false)
  const pathname = usePathname()

  return (
    <div className="flex h-screen overflow-hidden bg-[var(--color-ink-50)]">
      <Sidebar />

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMobileOpen(false)} />
          <div className="absolute left-0 top-0 flex h-full w-72 flex-col bg-white">
            <div className="flex h-16 items-center justify-between border-b border-[var(--color-ink-100)] px-5">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-md bg-[var(--color-signal-600)] text-white">
                  <Target size={18} />
                </div>
                <span className="font-display text-lg font-semibold">LeadFinder</span>
              </div>
              <button onClick={() => setMobileOpen(false)} aria-label="Fechar menu">
                <X size={20} />
              </button>
            </div>
            <nav className="flex-1 space-y-1 px-3 py-4">
              {NAV_ITEMS.map(({ href, label, icon: Icon, exact }) => {
                const isActive = exact ? pathname === href : pathname.startsWith(href)
                return (
                  <Link
                    key={href}
                    href={href}
                    onClick={() => setMobileOpen(false)}
                    className={cn(
                      'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium',
                      isActive
                        ? 'bg-[var(--color-signal-50)] text-[var(--color-signal-700)]'
                        : 'text-[var(--color-ink-600)]'
                    )}
                  >
                    <Icon size={18} />
                    {label}
                  </Link>
                )
              })}
            </nav>
          </div>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar title={title} subtitle={subtitle} onMenuClick={() => setMobileOpen(true)} />
        <main className="flex-1 overflow-y-auto px-4 py-6 md:px-8 md:py-8">{children}</main>
      </div>
    </div>
  )
}
