import { GlobeLock, Gauge, Bookmark, SlidersHorizontal, FileDown, Users } from 'lucide-react'
import { Card } from '@/components/ui/Card'

const FEATURES = [
  {
    icon: GlobeLock,
    title: 'Detecção de empresas sem website',
    description: 'Identifique rapidamente quem ainda não tem presença digital — seu lead mais qualificado.',
  },
  {
    icon: Gauge,
    title: 'Opportunity Score',
    description: 'Cada lead recebe uma pontuação de 0 a 100 com base em sinais como avaliações e presença online.',
  },
  {
    icon: SlidersHorizontal,
    title: 'Filtros avançados',
    description: 'Combine localização, categoria, raio, avaliação mínima e volume de avaliações.',
  },
  {
    icon: Bookmark,
    title: 'Lista de leads salvos',
    description: 'Organize os leads mais promissores e acompanhe o status de cada contato.',
  },
  {
    icon: FileDown,
    title: 'Exportação de dados',
    description: 'Exporte sua lista de leads para continuar a prospecção onde for mais conveniente.',
  },
  {
    icon: Users,
    title: 'Feito para equipes pequenas',
    description: 'Pensado para freelancers, desenvolvedores e agências que prospectam ativamente.',
  },
]

export function Features() {
  return (
    <section id="funcionalidades" className="py-20">
      <div className="mx-auto max-w-6xl px-4 md:px-6">
        <div className="max-w-xl">
          <h2 className="text-balance font-display text-3xl font-semibold text-[var(--color-ink-900)]">
            Tudo o que você precisa para prospectar
          </h2>
          <p className="mt-3 text-[var(--color-ink-600)]">
            Ferramentas construídas para o dia a dia de quem vende serviços digitais.
          </p>
        </div>

        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((feature) => (
            <Card key={feature.title} className="p-6">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--color-ink-50)] text-[var(--color-ink-700)]">
                <feature.icon size={18} />
              </div>
              <h3 className="mt-4 font-semibold text-[var(--color-ink-900)]">{feature.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-[var(--color-ink-600)]">
                {feature.description}
              </p>
            </Card>
          ))}
        </div>
      </div>
    </section>
  )
}
