'use client'

import { Check, ShieldCheck } from 'lucide-react'
import { AppLayout } from '@/components/layout/AppLayout'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { PLANS } from '@/mocks/plans'
import { cn } from '@/lib/utils'
import { useUser } from '@/hooks/useUser'

export default function SubscriptionPage() {
  const { profile, isTeam, isAdmin } = useUser()

  const currentPlanId = profile?.plan ?? 'free'
  const currentPlan = PLANS.find((p) => p.id === currentPlanId) ?? PLANS[0]
  const isCurrentMonth = profile?.usage_month?.slice(0, 7) === new Date().toISOString().slice(0, 7)
  const leadsUsed = isCurrentMonth ? (profile?.leads_used_this_month ?? 0) : 0
  const leadLimit = profile?.monthly_lead_limit ?? 10

  return (
    <AppLayout title="Assinatura" subtitle="Gerencie seu plano e forma de pagamento">
      <div className="flex flex-col gap-6">
        {isTeam ? (
          <Card className="flex items-start gap-3 border-[var(--color-green-600)] p-6">
            <ShieldCheck size={22} className="mt-0.5 shrink-0 text-[var(--color-green-600)]" />
            <div>
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium text-[var(--color-ink-900)]">Acesso de equipe</p>
                <Badge tone="green">{isAdmin ? 'Admin' : 'Equipe'}</Badge>
              </div>
              <p className="mt-1 text-sm text-[var(--color-ink-600)]">
                Sua conta faz parte da equipe OrbeLead: todas as funcionalidades liberadas, com buscas e leads
                ilimitados, sem necessidade de plano.
              </p>
            </div>
          </Card>
        ) : (
          <Card className="flex flex-col justify-between gap-4 p-6 sm:flex-row sm:items-center">
            <div>
              <div className="flex items-center gap-2">
                <p className="text-sm text-[var(--color-ink-500)]">Plano atual</p>
                <Badge tone="signal">{currentPlan.name}</Badge>
              </div>
              <p className="mt-1 text-sm text-[var(--color-ink-600)]">
                {leadsUsed} de {leadLimit} leads usados este mês · renova no dia 1º
              </p>
            </div>
            <Button variant="secondary" size="sm">Gerenciar cobrança</Button>
          </Card>
        )}

        <div className="grid gap-6 md:grid-cols-3">
          {PLANS.map((plan) => {
            const isCurrent = !isTeam && plan.id === currentPlanId
            return (
              <Card
                key={plan.id}
                className={cn(
                  'flex flex-col p-6',
                  plan.highlighted && 'border-[var(--color-signal-500)] ring-1 ring-[var(--color-signal-500)]'
                )}
              >
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-[var(--color-ink-900)]">{plan.name}</h3>
                  {isCurrent && <Badge tone="green">Atual</Badge>}
                </div>
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

                <Button
                  className="mt-6"
                  variant={isCurrent ? 'secondary' : plan.highlighted ? 'primary' : 'secondary'}
                  disabled={isCurrent}
                  fullWidth
                >
                  {isCurrent ? 'Plano atual' : plan.ctaLabel}
                </Button>
              </Card>
            )
          })}
        </div>

        <Card className="p-6">
          <h3 className="text-base font-semibold text-[var(--color-ink-900)]">Histórico de faturas</h3>
          <div className="mt-4 rounded-lg border border-dashed border-[var(--color-ink-200)] py-10 text-center">
            <p className="text-sm text-[var(--color-ink-500)]">
              Nenhuma fatura emitida até o momento.
            </p>
          </div>
        </Card>
      </div>
    </AppLayout>
  )
}
