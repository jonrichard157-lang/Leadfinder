import Link from 'next/link'
import { ArrowRight, GlobeLock, Globe, Star } from 'lucide-react'
import { Button } from '@/components/ui/Button'

const SCAN_ROWS = [
  { name: 'Doce Ponto Confeitaria', category: 'Confeitaria', rating: 4.8, hasWebsite: false },
  { name: 'Oficina Bom Motor', category: 'Oficina Mecânica', rating: 4.3, hasWebsite: false },
  { name: 'Studio Zenith Pilates', category: 'Pilates', rating: 4.9, hasWebsite: true },
  { name: 'Advocacia Martins & Prado', category: 'Advocacia', rating: 4.5, hasWebsite: false },
]

export function Hero() {
  return (
    <section className="mx-auto max-w-6xl px-4 pb-20 pt-16 md:px-6 md:pt-24">
      <div className="grid items-center gap-12 md:grid-cols-2 md:gap-8">
        <div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--color-signal-50)] px-3 py-1 text-xs font-medium text-[var(--color-signal-700)]">
            Prospecção comercial para serviços digitais
          </span>
          <h1 className="mt-5 text-balance font-display text-4xl font-semibold leading-[1.1] text-[var(--color-ink-900)] md:text-5xl">
            Encontre empresas que precisam do seu serviço.
          </h1>
          <p className="mt-5 max-w-md text-balance text-lg leading-relaxed text-[var(--color-ink-600)]">
            O LeadFinder localiza empresas locais sem presença digital — o ponto de partida
            ideal para freelancers, desenvolvedores e agências que vendem sites, sistemas e
            serviços digitais.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link href="/cadastro">
              <Button size="lg" icon={<ArrowRight size={18} />} iconPosition="right" fullWidth>
                Começar grátis
              </Button>
            </Link>
            <a href="#como-funciona">
              <Button size="lg" variant="secondary" fullWidth>
                Ver como funciona
              </Button>
            </a>
          </div>
          <p className="mt-4 text-sm text-[var(--color-ink-500)]">
            Sem cartão de crédito. 10 leads grátis por mês.
          </p>
        </div>

        {/* Signature element: a "scan" of local businesses, the product's core moment */}
        <div className="relative">
          <div className="rounded-xl border border-[var(--color-ink-100)] bg-white p-1.5 shadow-[0_1px_2px_rgba(17,26,46,0.06),0_12px_32px_-16px_rgba(17,26,46,0.18)]">
            <div className="flex items-center justify-between border-b border-[var(--color-ink-100)] px-4 py-3">
              <span className="text-xs font-medium text-[var(--color-ink-500)]">
                Busca: "salões de beleza em Curitiba"
              </span>
              <span className="flex items-center gap-1.5 text-xs font-medium text-[var(--color-green-600)]">
                <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-green-600)]" />
                42 encontrados
              </span>
            </div>
            <ul className="divide-y divide-[var(--color-ink-100)]">
              {SCAN_ROWS.map((row) => (
                <li key={row.name} className="flex items-center justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-[var(--color-ink-900)]">
                      {row.name}
                    </p>
                    <p className="text-xs text-[var(--color-ink-500)]">{row.category}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <span className="flex items-center gap-1 text-xs text-[var(--color-ink-500)]">
                      <Star size={12} className="fill-[var(--color-amber-500)] text-[var(--color-amber-500)]" />
                      {row.rating}
                    </span>
                    {row.hasWebsite ? (
                      <Globe size={14} className="text-[var(--color-ink-300)]" />
                    ) : (
                      <GlobeLock size={14} className="text-[var(--color-red-600)]" />
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </div>
          <div className="absolute -bottom-4 -right-4 hidden rounded-lg border border-[var(--color-ink-100)] bg-white px-4 py-3 shadow-md md:block">
            <p className="text-xs text-[var(--color-ink-500)]">Opportunity Score médio</p>
            <p className="font-display text-2xl font-semibold text-[var(--color-amber-600)]">81</p>
          </div>
        </div>
      </div>
    </section>
  )
}
