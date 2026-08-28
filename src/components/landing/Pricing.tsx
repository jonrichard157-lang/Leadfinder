import Link from 'next/link'
import { Check } from 'lucide-react'
import { PLANS } from '@/mocks/plans'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils'

export function Pricing() {
  return (
    <section id="precos" className="border-t border-[var(--color-ink-100)] bg-white py-20">
      <div className="mx-auto max-w-6xl px-4 md:px-6">
        <div className="max-w-xl">
          <h2 className="text-balance font-display text-3xl font-semibold text-[var(--color-ink-900)]">
            Preços simples, sem surpresas
          </h2>
          <p className="mt-3 text-[var(--color-ink-600)]">
            Comece grátis e evolua conforme sua prospecção cresce.
          </p>
        </div>

        <div className="mt-12 grid gap-6 md:grid-cols-3">
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
                  {plan.priceLabel}
                </span>
                <span className="text-sm text-[var(--color-ink-500)]"> /{plan.billingPeriod}</span>
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
                  {plan.ctaLabel}
                </Button>
              </Link>
            </Card>
          ))}
        </div>
      </div>
    </section>
  )
}
