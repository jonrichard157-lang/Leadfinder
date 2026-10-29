'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Search, FileSpreadsheet, Loader2 } from 'lucide-react'
import { AppLayout } from '@/components/layout/AppLayout'
import { LeadCard } from '@/components/leads/LeadCard'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { useUser } from '@/hooks/useUser'
import { getSavedLeads, toggleSaveLead } from '@/lib/services/leads'
import { exportLeadsToCsv } from '@/lib/export'
import type { Lead, LeadStatus } from '@/types'
import { cn } from '@/lib/utils'

const TABS: Array<{ id: LeadStatus | 'todos'; label: string }> = [
  { id: 'todos', label: 'Todos' },
  { id: 'novo', label: 'Novos' },
  { id: 'contatado', label: 'Contatados' },
  { id: 'em_negociacao', label: 'Em negociação' },
  { id: 'convertido', label: 'Convertidos' },
  { id: 'descartado', label: 'Descartados' },
]

export default function MyLeadsPage() {
  const router = useRouter()
  const { user } = useUser()
  const [leads, setLeads] = useState<Lead[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<LeadStatus | 'todos'>('todos')
  const [query, setQuery] = useState('')
  const [, startTransition] = useTransition()

  useEffect(() => {
    async function loadLeads() {
      if (!user) return
      setLoading(true)
      try {
        const data = await getSavedLeads(user.id)
        setLeads(data)
      } finally {
        setLoading(false)
      }
    }

    loadLeads()
  }, [user])

  const filtered = useMemo(() => {
    return leads.filter((lead) => {
      const matchesTab = activeTab === 'todos' || lead.status === activeTab
      const matchesQuery =
        lead.name.toLowerCase().includes(query.toLowerCase()) ||
        lead.category.toLowerCase().includes(query.toLowerCase()) ||
        lead.city.toLowerCase().includes(query.toLowerCase())
      return matchesTab && matchesQuery
    })
  }, [leads, activeTab, query])

  async function handleToggleSave(id: string) {
    if (!user) return
    const targetLead = leads.find((l) => l.id === id)
    if (!targetLead) return

    // Atualização otimista
    setLeads((prev) => prev.filter((l) => l.id !== id))

    startTransition(async () => {
      await toggleSaveLead(user.id, targetLead)
    })
  }

  function handleExportCsv() {
    exportLeadsToCsv(filtered.length > 0 ? filtered : leads, `orbelead-meus-leads-${activeTab}`)
  }

  return (
    <AppLayout
      title="Meus Leads"
      subtitle={loading ? 'Carregando seus leads...' : `${leads.length} leads salvos`}
    >
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          {/* Status Tabs */}
          <div className="flex flex-wrap gap-1.5">
            {TABS.map((tab) => {
              const count =
                tab.id === 'todos' ? leads.length : leads.filter((l) => l.status === tab.id).length
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    'flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors',
                    activeTab === tab.id
                      ? 'bg-[var(--color-signal-600)] text-white'
                      : 'border border-[var(--color-ink-200)] bg-white text-[var(--color-ink-600)] hover:bg-[var(--color-ink-50)]'
                  )}
                >
                  <span>{tab.label}</span>
                  <span
                    className={cn(
                      'rounded-full px-1.5 py-0.2 text-xs font-semibold',
                      activeTab === tab.id
                        ? 'bg-white/20 text-white'
                        : 'bg-[var(--color-ink-100)] text-[var(--color-ink-600)]'
                    )}
                  >
                    {count}
                  </span>
                </button>
              )
            })}
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="sm:w-64">
              <Input
                placeholder="Buscar por nome ou cidade..."
                icon={<Search size={16} />}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            <Button
              variant="secondary"
              size="md"
              icon={<FileSpreadsheet size={16} />}
              onClick={handleExportCsv}
              disabled={leads.length === 0}
            >
              Exportar CSV
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 text-[var(--color-ink-400)]">
            <Loader2 size={32} className="animate-spin text-[var(--color-signal-600)]" />
            <p className="mt-3 text-sm">Carregando seus leads do banco de dados...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[var(--color-ink-200)] py-16 text-center">
            <p className="font-medium text-[var(--color-ink-700)]">Nenhum lead encontrado</p>
            <p className="mt-1 text-sm text-[var(--color-ink-500)]">
              {leads.length === 0
                ? 'Você ainda não salvou nenhum lead. Realize uma busca para começar sua lista!'
                : 'Nenhum lead corresponde aos filtros ou busca selecionada.'}
            </p>
            {leads.length === 0 && (
              <div className="mt-4">
                <Button size="sm" onClick={() => router.push('/app/buscar')}>
                  Buscar Novos Leads
                </Button>
              </div>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((lead) => (
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
    </AppLayout>
  )
}
