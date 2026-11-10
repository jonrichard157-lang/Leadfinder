import Link from 'next/link'
import { Building2, Check } from 'lucide-react'
import { formatBRL, plansFor } from '@/lib/billing/catalog'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils'

// A landing mostra os planos de pessoa física. Os empresariais aparecem para contas de empresa.
const PLANS = plansFor('individual')

export function Pricing() {
  return (
    <section id="precos" className="border-t border-[var(--color-ink-100)] bg-white py-20">
      <div className="mx-auto max-w-6xl px-4 md:px-6">
        <div className="max-w-xl">
          <h2 className="text-balance font-display text-3xl font-semibold text-[var(--color-ink-900)]">
            Preços simples, sem surpresas
          </h2>
          <p className="mt-3 text-[var(--color-ink-600)]">
            Comece grátis e evolua conforme sua prospecção cresce. Precisou de mais no mês? Compre créditos
            avulsos, sem trocar de plano.
          </p>
        </div>

        <div className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {PLANS.map((plan) => (
            <Card
              key={plan.id}
              className={cn(
                'flex flex-col p-6',
                plan.highlighted && 'border-[var(--color-signal-500)] ring-1 ring-[var(--color-signal-500)]'
              )}
            >
              {plan.highlighted && (
                <span className="mb-3 inline-flex w-fit items-center rounded-full bg-[var(--color-signal-50)] px-2.5 py-1 text-xs font-medium text-[var(--color-signal-700)]">
                  Mais popular
                </span>
              )}
              <h3 className="text-lg font-semibold text-[var(--color-ink-900)]">{plan.name}</h3>
              <p className="mt-1 text-sm text-[var(--color-ink-600)]">{plan.description}</p>
              <p className="mt-5">
                <span className="font-display text-3xl font-semibold text-[var(--color-ink-900)]">
                  {formatBRL(plan.priceCents)}
                </span>
                <span className="text-sm text-[var(--color-ink-500)]"> /mês</span>
              </p>

              <ul className="mt-6 flex-1 space-y-2.5">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2 text-sm text-[var(--color-ink-700)]">
                    <Check size={16} className="mt-0.5 shrink-0 text-[var(--color-green-600)]" />
                    {feature}
                  </li>
                ))}
              </ul>

              <Link href="/cadastro" className="mt-6">
                <Button variant={plan.highlighted ? 'primary' : 'secondary'} fullWidth>
                  {plan.priceCents === 0 ? 'Começar grátis' : `Assinar ${plan.name}`}
                </Button>
              </Link>
            </Card>
          ))}
        </div>

        <div className="mt-8 flex flex-col items-start gap-3 rounded-xl border border-[var(--color-ink-200)] p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <Building2 size={20} className="mt-0.5 shrink-0 text-[var(--color-signal-600)]" />
            <p className="text-sm text-[var(--color-ink-700)]">
              <span className="font-medium text-[var(--color-ink-900)]">É uma empresa ou agência?</span> Crie uma
              conta do tipo Empresa para ver os planos empresariais, com volume maior.
            </p>
          </div>
          <Link href="/cadastro" className="shrink-0">
            <Button variant="secondary" size="sm">Criar conta de empresa</Button>
          </Link>
        </div>
      </div>
    </section>
  )
}
