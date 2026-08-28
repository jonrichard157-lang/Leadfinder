import { Search, ListFilter, Send } from 'lucide-react'

const STEPS = [
  {
    icon: Search,
    title: 'Busque por região e categoria',
    description:
      'Informe a localização, o tipo de negócio e o raio de busca. O LeadFinder varre os estabelecimentos da área.',
  },
  {
    icon: ListFilter,
    title: 'Filtre quem precisa de você',
    description:
      'Veja quais empresas não têm website, avaliação e Opportunity Score — o indicador de potencial de cada lead.',
  },
  {
    icon: Send,
    title: 'Organize e entre em contato',
    description:
      'Salve os leads mais promissores, acompanhe o status e conduza sua prospecção com uma lista sempre atualizada.',
  },
]

export function HowItWorks() {
  return (
    <section id="como-funciona" className="border-t border-[var(--color-ink-100)] bg-white py-20">
      <div className="mx-auto max-w-6xl px-4 md:px-6">
        <div className="max-w-xl">
          <h2 className="text-balance font-display text-3xl font-semibold text-[var(--color-ink-900)]">
            Como funciona
          </h2>
          <p className="mt-3 text-[var(--color-ink-600)]">
            Da busca ao primeiro contato, em três passos.
          </p>
        </div>

        <div className="mt-12 grid gap-8 md:grid-cols-3 md:gap-6">
          {STEPS.map((step, i) => (
            <div key={step.title} className="relative">
              <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-[var(--color-signal-50)] text-[var(--color-signal-600)]">
                <step.icon size={20} />
              </div>
              <p className="mt-4 font-mono text-xs text-[var(--color-ink-400)]">
                Passo {i + 1}
              </p>
              <h3 className="mt-1 text-lg font-semibold text-[var(--color-ink-900)]">
                {step.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-[var(--color-ink-600)]">
                {step.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
