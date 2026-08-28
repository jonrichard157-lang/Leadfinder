'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Search, Users, CreditCard, Settings, Target, LogOut } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useUser } from '@/hooks/useUser'

const NAV_ITEMS = [
  { href: '/app', label: 'Dashboard', icon: LayoutDashboard, exact: true },
  { href: '/app/buscar', label: 'Buscar Leads', icon: Search },
  { href: '/app/meus-leads', label: 'Meus Leads', icon: Users },
  { href: '/app/assinatura', label: 'Assinatura', icon: CreditCard },
  { href: '/app/configuracoes', label: 'Configurações', icon: Settings },
]

export function Sidebar() {
  const pathname = usePathname()
  const { profile, signOut } = useUser()

  const planName = profile?.plan ? profile.plan.charAt(0).toUpperCase() + profile.plan.slice(1) : 'Free'
  const used = profile?.leads_used_this_month ?? 0
  const limit = profile?.monthly_lead_limit ?? 10
  const usagePercentage = Math.min(100, Math.round((used / (limit || 1)) * 100))

  return (
    <aside className="hidden w-64 shrink-0 flex-col border-r border-[var(--color-ink-100)] bg-white md:flex">
      <div className="flex h-16 items-center gap-2 border-b border-[var(--color-ink-100)] px-6">
        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-[var(--color-signal-600)] text-white">
          <Target size={18} />
        </div>
        <span className="font-display text-lg font-semibold text-[var(--color-ink-900)]">
          LeadFinder
        </span>
      </div>

      <nav className="flex-1 space-y-1 px-3 py-4">
        {NAV_ITEMS.map(({ href, label, icon: Icon, exact }) => {
          const isActive = exact ? pathname === href : pathname.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-[var(--color-signal-50)] text-[var(--color-signal-700)]'
                  : 'text-[var(--color-ink-600)] hover:bg-[var(--color-ink-50)] hover:text-[var(--color-ink-900)]'
              )}
            >
              <Icon size={18} />
              {label}
            </Link>
          )
        })}
      </nav>

      <div className="border-t border-[var(--color-ink-100)] p-4 space-y-3">
        <div className="rounded-lg bg-[var(--color-ink-50)] p-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-[var(--color-ink-700)]">Plano {planName}</p>
            <span className="text-[10px] font-semibold text-[var(--color-signal-700)] bg-[var(--color-signal-50)] px-1.5 py-0.5 rounded">
              {usagePercentage}%
            </span>
          </div>
          <p className="mt-1 text-xs text-[var(--color-ink-500)]">
            {used} de {limit} leads usados este mês
          </p>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-[var(--color-ink-200)]">
            <div
              className="h-full rounded-full bg-[var(--color-signal-500)] transition-all duration-300"
              style={{ width: `${usagePercentage}%` }}
            />
          </div>
        </div>

        <button
          onClick={signOut}
          className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium text-[var(--color-ink-600)] transition-colors hover:bg-red-50 hover:text-red-600"
        >
          <LogOut size={16} />
          Sair da conta
        </button>
      </div>
    </aside>
  )
}
