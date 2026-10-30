'use client'

import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { MapPin, Search, Sparkles } from 'lucide-react'
import { AppLayout } from '@/components/layout/AppLayout'
import { Card } from '@/components/ui/Card'
import { Input, Label, NumberInput, Select } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { CATEGORIES } from '@/mocks/leads'
import type { SearchFilters } from '@/types'

const DEFAULT_FILTERS: SearchFilters = {
  location: '',
  category: CATEGORIES[0],
  radiusKm: 10,
  onlyWithoutWebsite: true,
  minRating: 0,
  minReviews: 0,
}

const POPULAR_LOCATIONS = [
  'Curitiba, PR',
  'São Paulo, SP',
  'Belo Horizonte, MG',
  'Rio de Janeiro, RJ',
  'Porto Alegre, RS',
  'Florianópolis, SC',
]

export default function SearchLeadsPage() {
  const router = useRouter()
  const [filters, setFilters] = useState<SearchFilters>(DEFAULT_FILTERS)

  function handleSubmit(e: FormEvent) {
    e.preventDefault()

    const searchParams = new URLSearchParams()
    if (filters.location) searchParams.set('location', filters.location.trim())
    if (filters.category) searchParams.set('category', filters.category)
    searchParams.set('radius', String(filters.radiusKm))
    searchParams.set('onlyWithoutWebsite', String(filters.onlyWithoutWebsite))
    if (filters.minRating > 0) searchParams.set('minRating', String(filters.minRating))
    if (filters.minReviews > 0) searchParams.set('minReviews', String(filters.minReviews))

    router.push(`/app/resultados?${searchParams.toString()}`)
  }

  function handleQuickLocation(city: string) {
    setFilters((f) => ({ ...f, location: city }))
  }

  return (
    <AppLayout title="Buscar Leads" subtitle="Defina os critérios da sua próxima prospecção">
      <Card className="mx-auto max-w-3xl p-6 md:p-8">
        <form className="space-y-6" onSubmit={handleSubmit}>
          <div>
            <Label htmlFor="location">Localização (Cidade, Estado ou Bairro)</Label>
            <Input
              id="location"
              placeholder="Ex: Curitiba, PR ou Pinheiros, São Paulo"
              icon={<MapPin size={16} />}
              value={filters.location}
              onChange={(e) => setFilters((f) => ({ ...f, location: e.target.value }))}
              required
            />
            <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
              <span className="flex items-center gap-1 text-xs text-[var(--color-ink-500)]">
                <Sparkles size={12} />
                Populares:
              </span>
              {POPULAR_LOCATIONS.map((loc) => (
                <button
                  type="button"
                  key={loc}
                  onClick={() => handleQuickLocation(loc)}
                  className="rounded-md border border-[var(--color-ink-200)] bg-[var(--color-ink-50)] px-2 py-0.5 text-xs text-[var(--color-ink-700)] transition-colors hover:bg-[var(--color-signal-50)] hover:text-[var(--color-signal-700)]"
                >
                  {loc}
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-6 sm:grid-cols-2">
            <div>
              <Label htmlFor="category">Nicho / Categoria</Label>
              <Select
                id="category"
                value={filters.category}
                onChange={(e) => setFilters((f) => ({ ...f, category: e.target.value }))}
              >
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </Select>
            </div>

            <div>
              <Label htmlFor="radius">Raio de busca: {filters.radiusKm} km</Label>
              <input
                id="radius"
                type="range"
                min={1}
                max={50}
                value={filters.radiusKm}
                onChange={(e) => setFilters((f) => ({ ...f, radiusKm: Number(e.target.value) }))}
                className="mt-3 w-full accent-[var(--color-signal-600)]"
              />
            </div>
          </div>

          <div className="grid gap-6 sm:grid-cols-2">
            <div>
              <Label htmlFor="minRating">Avaliação mínima</Label>
              <Select
                id="minRating"
                value={filters.minRating}
                onChange={(e) => setFilters((f) => ({ ...f, minRating: Number(e.target.value) }))}
              >
                <option value={0}>Qualquer avaliação</option>
                <option value={3}>3.0 ou mais ⭐</option>
                <option value={3.5}>3.5 ou mais ⭐</option>
                <option value={4}>4.0 ou mais ⭐</option>
                <option value={4.5}>4.5 ou mais ⭐</option>
              </Select>
            </div>

            <div>
              <Label htmlFor="minReviews">Quantidade mínima de avaliações</Label>
              <NumberInput
                id="minReviews"
                min={0}
                value={filters.minReviews}
                onValueChange={(minReviews) => setFilters((f) => ({ ...f, minReviews }))}
              />
            </div>
          </div>

          <label className="flex cursor-pointer items-center justify-between rounded-lg border border-[var(--color-ink-200)] bg-[var(--color-ink-50)]/40 px-4 py-3.5 transition-colors hover:bg-[var(--color-ink-50)]">
            <div>
              <p className="text-sm font-medium text-[var(--color-ink-900)]">
                Somente empresas sem website
              </p>
              <p className="text-xs text-[var(--color-ink-500)]">
                Filtra as empresas com maior probabilidade de contratar criação de sites
              </p>
            </div>
            <input
              type="checkbox"
              checked={filters.onlyWithoutWebsite}
              onChange={(e) => setFilters((f) => ({ ...f, onlyWithoutWebsite: e.target.checked }))}
              className="h-5 w-5 accent-[var(--color-signal-600)] cursor-pointer"
            />
          </label>

          <Button type="submit" size="lg" fullWidth icon={<Search size={18} />}>
            Buscar leads
          </Button>
        </form>
      </Card>
    </AppLayout>
  )
}
