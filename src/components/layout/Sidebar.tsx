'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Orbit, LogOut, ShieldCheck } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useUser } from '@/hooks/useUser'
import { getNavItems } from './nav'

export function Sidebar() {
  const pathname = usePathname()
  const { profile, isTeam, isAdmin, signOut } = useUser()

  const planName = profile?.plan ? profile.plan.charAt(0).toUpperCase() + profile.plan.slice(1) : 'Free'
  // Os contadores zeram no banco na primeira ação do mês; até lá, o mês anterior não conta
  const isCurrentMonth = profile?.usage_month?.slice(0, 7) === new Date().toISOString().slice(0, 7)
  const used = isCurrentMonth ? (profile?.leads_used_this_month ?? 0) : 0
  const limit = profile?.monthly_lead_limit ?? 10
  const searchesUsed = isCurrentMonth ? (profile?.searches_used_this_month ?? 0) : 0
  const searchLimit = profile?.monthly_search_limit ?? 10
  const unlimitedSearches = profile?.plan === 'pro' || profile?.plan === 'agencia'
  const usagePercentage = Math.min(100, Math.round((used / (limit || 1)) * 100))

  return (
    <aside className="hidden w-64 shrink-0 flex-col border-r border-[var(--color-ink-100)] bg-white md:flex">
      <div className="flex h-16 items-center gap-2 border-b border-[var(--color-ink-100)] px-6">
        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-[var(--color-signal-600)] text-white">
          <Orbit size={18} />
        </div>
        <span className="font-display text-lg font-semibold text-[var(--color-ink-900)]">
          OrbeLead
        </span>
      </div>

      <nav className="flex-1 space-y-1 px-3 py-4">
        {getNavItems(isAdmin).map(({ href, label, icon: Icon, ...item }) => {
          const isActive = 'exact' in item ? pathname === href : pathname.startsWith(href)
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
        {isTeam ? (
          <div className="rounded-lg bg-[var(--color-green-100)] p-3">
            <p className="flex items-center gap-1.5 text-xs font-medium text-[var(--color-green-600)]">
              <ShieldCheck size={14} />
              {isAdmin ? 'Admin' : 'Equipe'} OrbeLead
            </p>
            <p className="mt-1 text-xs text-[var(--color-ink-600)]">Buscas e leads ilimitados</p>
          </div>
        ) : (
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
            <p className="mt-2 text-xs text-[var(--color-ink-500)]">
              {unlimitedSearches ? 'Buscas ilimitadas' : `${searchesUsed} de ${searchLimit} buscas este mês`}
            </p>
          </div>
        )}

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
