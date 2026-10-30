'use client'

import { Suspense, useEffect, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  SlidersHorizontal,
  ArrowLeft,
  Loader2,
  ArrowUpDown,
  FileSpreadsheet,
  Building2,
  RefreshCw,
} from 'lucide-react'
import { AppLayout } from '@/components/layout/AppLayout'
import { LeadCard } from '@/components/leads/LeadCard'
import { Button } from '@/components/ui/Button'
import { useUser } from '@/hooks/useUser'
import { getSavedLeadKeys, toggleSaveLead } from '@/lib/services/leads'
import { readSearchCache, writeSearchCache } from '@/lib/searchCache'
import { exportLeadsToCsv } from '@/lib/export'
import type { Lead } from '@/types'

function byScore(a: Lead, b: Lead) {
  return b.opportunityScore - a.opportunityScore
}

// `key` recria a página a cada busca diferente; a mesma busca reaproveita o resultado guardado.
function ResultsRoute() {
  const searchParams = useSearchParams()
  const cacheKey = searchParams.toString()
  return <ResultsContent key={cacheKey} cacheKey={cacheKey} />
}

function ResultsContent({ cacheKey }: { cacheKey: string }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user, refreshProfile } = useUser()

  const location = searchParams.get('location') || 'Curitiba, PR'
  const category = searchParams.get('category') || 'Todas as categorias'
  const radiusKm = Number(searchParams.get('radius')) || 10
  const onlyWithoutWebsite = searchParams.get('onlyWithoutWebsite') !== 'false'
  const minRating = Number(searchParams.get('minRating')) || 0
  const minReviews = Number(searchParams.get('minReviews')) || 0

  const [cached] = useState(() => readSearchCache(cacheKey))
  const [leads, setLeads] = useState<Lead[]>(() => (cached ? [...cached].sort(byScore) : []))
  const [loading, setLoading] = useState(!cached)
  const [error, setError] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [sortByScore, setSortByScore] = useState(true)
  const [, startTransition] = useTransition()

  const userId = user?.id

  // Resultado guardado: só atualiza "Salvo", que pode ter mudado na página de detalhes.
  useEffect(() => {
    if (!cached || !userId) return
    let active = true
    getSavedLeadKeys(userId).then((keys) => {
      if (active) setLeads((prev) => prev.map((l) => ({ ...l, saved: keys.has(l.id) })))
    })
    return () => {
      active = false
    }
  }, [cached, userId])

  useEffect(() => {
    if (!loading && !error) writeSearchCache(cacheKey, leads)
  }, [cacheKey, leads, loading, error])

  useEffect(() => {
    if (cached) return

    async function fetchSearch() {
      try {
        const res = await fetch('/api/leads/search', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            location,
            category,
            radiusKm,
            onlyWithoutWebsite,
            minRating,
            minReviews,
          }),
        })

        if (!res.ok) {
          const errData = await res.json()
          throw new Error(errData.error || 'Erro ao realizar busca de leads.')
        }

        const data = await res.json()
        const fetchedLeads: Lead[] = data.leads || []

        // Ordena por padrão pelos melhores Opportunity Scores
        setLeads(fetchedLeads.sort(byScore))
      } catch (err: unknown) {
        console.error('Erro na busca de leads:', err)
        const msg = err instanceof Error ? err.message : 'Falha na busca.'
        setError(msg)
      } finally {
        setLoading(false)
      }
    }

    fetchSearch()
  }, [cached, location, category, radiusKm, onlyWithoutWebsite, minRating, minReviews])

  async function handleToggleSave(id: string) {
    if (!user) {
      router.push('/login')
      return
    }

    const targetLead = leads.find((l) => l.id === id)
    if (!targetLead) return

    const newSaved = !targetLead.saved
    setSaveError(null)
    setLeads((prev) => prev.map((l) => (l.id === id ? { ...l, saved: newSaved } : l)))

    startTransition(async () => {
      const res = await toggleSaveLead(user.id, targetLead)
      if (res.error) {
        setSaveError(res.error)
        setLeads((prev) => prev.map((l) => (l.id === id ? { ...l, saved: res.saved } : l)))
      } else if (res.lead && res.lead.id !== id) {
        setLeads((prev) => prev.map((l) => (l.id === id ? { ...res.lead, saved: res.saved } : l)))
      }
      refreshProfile()
    })
  }

  function handleSort() {
    setSortByScore((prev) => !prev)
    setLeads((prev) => {
      const sorted = [...prev]
      if (!sortByScore) {
        return sorted.sort(byScore)
      } else {
        return sorted.sort((a, b) => b.rating - a.rating)
      }
    })
  }

  function handleExport() {
    exportLeadsToCsv(leads, `orbelead-busca-${location.replace(/[^a-zA-Z0-9]/g, '_')}`)
  }

  const categoryLabel = category && category !== 'Todas as categorias' ? category : 'Empresas'

  return (
    <AppLayout
      title="Resultados da Busca"
      subtitle={
        loading
          ? `Mapeando ${categoryLabel.toLowerCase()} em "${location}"...`
          : `${leads.length} oportunidades encontradas para "${categoryLabel} em ${location}"`
      }
    >
      <div className="flex flex-col gap-6">
        {/* Barra de Ações Superior */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Button
            variant="ghost"
            size="sm"
            icon={<ArrowLeft size={16} />}
            onClick={() => router.push('/app/buscar')}
          >
            Ajustar critérios
          </Button>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant={sortByScore ? 'primary' : 'secondary'}
              size="sm"
              icon={sortByScore ? <ArrowUpDown size={16} /> : <SlidersHorizontal size={16} />}
              onClick={handleSort}
              disabled={leads.length === 0}
            >
              {sortByScore ? 'Score Mais Alto' : 'Melhor Avaliação'}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              icon={<FileSpreadsheet size={16} />}
              onClick={handleExport}
              disabled={leads.length === 0}
            >
              Exportar CSV
            </Button>
          </div>
        </div>

        {saveError && (
          <div className="flex items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            <span>{saveError}</span>
            <Link href="/app/assinatura" className="shrink-0 font-medium underline">
              Ver planos
            </Link>
          </div>
        )}

        {/* Estado de Carregamento */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 text-[var(--color-ink-500)]">
            <div className="relative flex h-16 w-16 items-center justify-center">
              <Building2 size={32} className="text-[var(--color-signal-600)]" />
              <Loader2 size={56} className="absolute animate-spin text-[var(--color-signal-400)] opacity-70" />
            </div>
            <p className="mt-4 font-medium text-[var(--color-ink-800)]">
              Procurando empresas e calculando Opportunity Scores...
            </p>
            <p className="mt-1 text-xs text-[var(--color-ink-400)]">
              Analisando websites, notas e telefones em {location}
            </p>
          </div>
        ) : error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 p-8 text-center">
            <p className="font-semibold text-red-800">Falha ao buscar leads</p>
            <p className="mt-1 text-sm text-red-600">{error}</p>
            <div className="mt-4">
              <Button
                variant="secondary"
                size="sm"
                icon={<RefreshCw size={14} />}
                onClick={() => window.location.reload()}
              >
                Tentar novamente
              </Button>
            </div>
          </div>
        ) : leads.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[var(--color-ink-200)] py-16 text-center">
            <Building2 size={36} className="mx-auto text-[var(--color-ink-400)]" />
            <p className="mt-3 font-medium text-[var(--color-ink-700)]">
              Nenhuma empresa encontrada com os filtros atuais
            </p>
            <p className="mt-1 text-sm text-[var(--color-ink-500)]">
              Tente aumentar o raio de busca ou remover a restrição de avaliação mínima.
            </p>
            <div className="mt-6">
              <Button size="sm" onClick={() => router.push('/app/buscar')}>
                Ajustar Busca
              </Button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {leads.map((lead) => (
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

export default function ResultsPage() {
  return (
    <Suspense
      fallback={
        <AppLayout title="Resultados da Busca" subtitle="Carregando...">
          <div className="flex justify-center py-24">
            <Loader2 size={32} className="animate-spin text-[var(--color-signal-600)]" />
          </div>
        </AppLayout>
      }
    >
      <ResultsRoute />
    </Suspense>
  )
}
