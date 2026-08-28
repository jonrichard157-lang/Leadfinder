'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Search, Users, GlobeLock, Flame, ArrowRight, Loader2 } from 'lucide-react'
import { AppLayout } from '@/components/layout/AppLayout'
import { StatCard } from '@/components/leads/StatCard'
import { LeadCard } from '@/components/leads/LeadCard'
import { Button } from '@/components/ui/Button'
import { useUser } from '@/hooks/useUser'
import { getSavedLeads, getUserDashboardStats, toggleSaveLead } from '@/lib/services/leads'
import type { Lead, DashboardStats } from '@/types'

export default function DashboardPage() {
  const router = useRouter()
  const { user, displayName } = useUser()
  const [stats, setStats] = useState<DashboardStats>({
    leadsFound: 0,
    leadsSaved: 0,
    leadsWithoutWebsite: 0,
    highOpportunity: 0,
  })
  const [recentLeads, setRecentLeads] = useState<Lead[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadDashboardData() {
      if (!user) return
      setLoading(true)
      try {
        const [userStats, savedList] = await Promise.all([
          getUserDashboardStats(user.id),
          getSavedLeads(user.id),
        ])
        setStats(userStats)
        setRecentLeads(savedList.slice(0, 3))
      } finally {
        setLoading(false)
      }
    }

    loadDashboardData()
  }, [user])

  async function handleToggleSave(id: string) {
    if (!user) return
    const targetLead = recentLeads.find((l) => l.id === id)
    if (!targetLead) return

    setRecentLeads((prev) => prev.filter((l) => l.id !== id))
    await toggleSaveLead(user.id, targetLead)

    // Atualiza contadores
    const updatedStats = await getUserDashboardStats(user.id)
    setStats(updatedStats)
  }

  const firstName = displayName.split(' ')[0]

  return (
    <AppLayout title="Dashboard" subtitle="Visão geral da sua prospecção">
      <div className="flex flex-col gap-6">
        <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <h2 className="text-xl font-semibold text-[var(--color-ink-900)]">
              Olá, {firstName} 👋
            </h2>
            <p className="text-sm text-[var(--color-ink-500)]">
              Aqui está o resumo da sua prospecção e leads salvos.
            </p>
          </div>
          <Link href="/app/buscar">
            <Button size="lg" icon={<Search size={18} />}>
              Encontrar novos leads
            </Button>
          </Link>
        </div>

        {/* Estatísticas do CRM */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Leads salvos"
            value={stats.leadsSaved}
            icon={<Users size={18} />}
            accent="signal"
          />
          <StatCard
            label="Leads sem website"
            value={stats.leadsWithoutWebsite}
            icon={<GlobeLock size={18} />}
            accent="green"
          />
          <StatCard
            label="Alta oportunidade"
            value={stats.highOpportunity}
            icon={<Flame size={18} />}
            accent="amber"
          />
          <StatCard
            label="Empresas mapeadas"
            value={stats.leadsFound}
            icon={<Search size={18} />}
            accent="neutral"
          />
        </div>

        {/* Leads Recentes */}
        <div>
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold text-[var(--color-ink-900)]">
              Leads salvos recentes
            </h3>
            {recentLeads.length > 0 && (
              <Link
                href="/app/meus-leads"
                className="flex items-center gap-1 text-sm font-medium text-[var(--color-signal-600)]"
              >
                Ver todos <ArrowRight size={14} />
              </Link>
            )}
          </div>

          {loading ? (
            <div className="flex justify-center py-16 text-[var(--color-ink-400)]">
              <Loader2 size={28} className="animate-spin text-[var(--color-signal-600)]" />
            </div>
          ) : recentLeads.length === 0 ? (
            <div className="mt-4 rounded-xl border border-dashed border-[var(--color-ink-200)] py-12 text-center">
              <p className="font-medium text-[var(--color-ink-700)]">Nenhum lead salvo ainda</p>
              <p className="mt-1 text-sm text-[var(--color-ink-500)]">
                Comece fazendo uma busca para encontrar empresas sem site e salvá-las no seu CRM.
              </p>
              <div className="mt-4">
                <Button size="sm" onClick={() => router.push('/app/buscar')}>
                  Buscar Leads Agora
                </Button>
              </div>
            </div>
          ) : (
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {recentLeads.map((lead) => (
                <LeadCard
                  key={lead.id}
                  lead={lead}
                  onToggleSave={handleToggleSave}
                  onViewDetails={(id) => router.push(`/app/leads/${id}`)}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  )
}
