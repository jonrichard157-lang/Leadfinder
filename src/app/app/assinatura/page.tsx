'use client'

import { Suspense, useEffect, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { AlertCircle, Check, CheckCircle2, Loader2, ShieldCheck, Zap } from 'lucide-react'
import { AppLayout } from '@/components/layout/AppLayout'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { CREDIT_PACKS, formatBRL, getPlan, plansFor, PLANS } from '@/lib/billing/catalog'
import { cn } from '@/lib/utils'
import { useUser } from '@/hooks/useUser'
import { supabase } from '@/lib/supabase'

interface SubscriptionRow {
  id: string
  plan_id: string
  status: 'pending' | 'authorized' | 'paused' | 'cancelled'
  amount_cents: number
  created_at: string
}

interface PaymentRow {
  id: string
  kind: 'subscription' | 'credits'
  amount_cents: number
  created_at: string
}

const STATUS_LABEL: Record<SubscriptionRow['status'], string> = {
  pending: 'Aguardando autorização',
  authorized: 'Ativa',
  paused: 'Pausada',
  cancelled: 'Cancelada',
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR')
}

async function startCheckout(path: string, payload: Record<string, string>) {
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok || !data.url) throw new Error(data.error || 'Não foi possível iniciar o pagamento.')
  window.location.assign(data.url)
}

function SubscriptionContent() {
  const searchParams = useSearchParams()
  const retorno = searchParams.get('retorno')
  const { user, profile, isTeam, isAdmin, refreshProfile } = useUser()

  const [subscriptions, setSubscriptions] = useState<SubscriptionRow[]>([])
  const [payments, setPayments] = useState<PaymentRow[]>([])
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [cancelled, setCancelled] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)

  const userId = user?.id

  useEffect(() => {
    if (!userId) return
    let active = true
    Promise.all([
      supabase
        .from('subscriptions')
        .select('id, plan_id, status, amount_cents, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(10),
      supabase
        .from('billing_payments')
        .select('id, kind, amount_cents, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(20),
    ]).then(([subs, pays]) => {
      if (!active) return
      setSubscriptions((subs.data as SubscriptionRow[] | null) ?? [])
      setPayments((pays.data as PaymentRow[] | null) ?? [])
    })
    return () => {
      active = false
    }
  }, [userId, reloadKey])

  // Ao voltar do Mercado Pago, a confirmação chega por webhook alguns segundos depois.
  useEffect(() => {
    if (!retorno) return
    let count = 0
    const timer = setInterval(() => {
      refreshProfile()
      setReloadKey((k) => k + 1)
      if (++count >= 15) clearInterval(timer)
    }, 4000)
    return () => clearInterval(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [retorno])

  const accountType = profile?.account_type ?? 'individual'
  const currentPlan = getPlan(profile?.plan) ?? PLANS[0]
  const isCurrentMonth = profile?.usage_month?.slice(0, 7) === new Date().toISOString().slice(0, 7)
  const leadsUsed = isCurrentMonth ? (profile?.leads_used_this_month ?? 0) : 0
  const searchesUsed = isCurrentMonth ? (profile?.searches_used_this_month ?? 0) : 0
  const activeSub = subscriptions.find((s) => s.status === 'authorized' || s.status === 'paused')
  const visiblePlans = plansFor(accountType)

  async function handleSubscribe(planId: string) {
    setError(null)
    setBusy(planId)
    try {
      await startCheckout('/api/billing/subscribe', { planId })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao iniciar a assinatura.')
      setBusy(null)
    }
  }

  async function handleBuyCredits(packId: string) {
    setError(null)
    setBusy(packId)
    try {
      await startCheckout('/api/billing/credits', { packId })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao iniciar a compra.')
      setBusy(null)
    }
  }

  async function handleCancel() {
    if (!window.confirm('Cancelar a renovação automática? Seu plano continua ativo até o fim do período pago.')) return
    setError(null)
    setBusy('cancel')
    try {
      const res = await fetch('/api/billing/cancel', { method: 'POST' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Não foi possível cancelar.')
      setCancelled(true)
      setReloadKey((k) => k + 1)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao cancelar.')
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {retorno && (
        <div className="flex items-start gap-2.5 rounded-lg border border-[var(--color-signal-100)] bg-[var(--color-signal-50)] p-4 text-sm text-[var(--color-signal-700)]">
          <Loader2 size={18} className="mt-0.5 shrink-0 animate-spin" />
          <span>
            Recebemos o retorno do Mercado Pago. {retorno === 'creditos' ? 'Os créditos entram' : 'O plano é ativado'}{' '}
            assim que o pagamento for confirmado: normalmente em segundos; Pix e boleto podem levar mais.
          </span>
        </div>
      )}

      {cancelled && (
        <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700">
          <CheckCircle2 size={18} className="shrink-0" />
          Renovação cancelada. Seu plano segue ativo até o fim do período pago.
        </div>
      )}

      {error && (
        <div className="flex items-start gap-2.5 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          <AlertCircle size={18} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {isTeam ? (
        <Card className="flex items-start gap-3 border-[var(--color-green-600)] p-6">
          <ShieldCheck size={22} className="mt-0.5 shrink-0 text-[var(--color-green-600)]" />
          <div>
            <div className="flex items-center gap-2">
              <p className="text-sm font-medium text-[var(--color-ink-900)]">Acesso de equipe</p>
              <Badge tone="green">{isAdmin ? 'Admin' : 'Equipe'}</Badge>
            </div>
            <p className="mt-1 text-sm text-[var(--color-ink-600)]">
              Sua conta faz parte da equipe OrbeLead: buscas e leads sem limite de plano.
            </p>
          </div>
        </Card>
      ) : (
        <Card className="flex flex-col justify-between gap-4 p-6 sm:flex-row sm:items-start">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <p className="text-sm text-[var(--color-ink-500)]">Plano atual</p>
              <Badge tone="signal">{currentPlan.name}</Badge>
              {activeSub && <Badge tone="green">{STATUS_LABEL[activeSub.status]}</Badge>}
            </div>
            <p className="text-sm text-[var(--color-ink-600)]">
              {searchesUsed} de {profile?.monthly_search_limit ?? 10} buscas · {leadsUsed} de{' '}
              {profile?.monthly_lead_limit ?? 10} leads este mês (renova no dia 1º)
            </p>
            <p className="text-sm text-[var(--color-ink-600)]">
              Créditos avulsos: {profile?.extra_searches ?? 0} buscas · {profile?.extra_leads ?? 0} leads
            </p>
            {profile?.plan !== 'free' && profile?.plan_expires_at && (
              <p className="text-xs text-[var(--color-ink-500)]">
                {activeSub ? 'Próxima renovação até' : 'Ativo até'} {formatDate(profile.plan_expires_at)}
              </p>
            )}
          </div>
          {activeSub && (
            <Button variant="secondary" size="sm" onClick={handleCancel} disabled={busy !== null}>
              {busy === 'cancel' ? 'Cancelando...' : 'Cancelar renovação'}
            </Button>
          )}
        </Card>
      )}

      {!isTeam && (
        <>
          <div>
            <h3 className="text-base font-semibold text-[var(--color-ink-900)]">
              {accountType === 'business' ? 'Planos empresariais' : 'Planos'}
            </h3>
            {accountType === 'individual' && (
              <p className="mt-1 text-sm text-[var(--color-ink-500)]">
                É uma empresa?{' '}
                <Link href="/app/configuracoes" className="font-medium text-[var(--color-signal-600)] hover:underline">
                  Mude o tipo de conta
                </Link>{' '}
                para ver os planos empresariais.
              </p>
            )}
          </div>

          <div className={cn('grid gap-6', visiblePlans.length >= 4 ? 'md:grid-cols-2 xl:grid-cols-4' : 'md:grid-cols-2')}>
            {visiblePlans.map((plan) => {
              const isCurrent = plan.id === currentPlan.id
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

                  {plan.priceCents > 0 && (
                    <Button
                      className="mt-6"
                      variant={isCurrent ? 'secondary' : plan.highlighted ? 'primary' : 'secondary'}
                      disabled={(isCurrent && Boolean(activeSub)) || busy !== null}
                      onClick={() => handleSubscribe(plan.id)}
                      fullWidth
                    >
                      {busy === plan.id
                        ? 'Abrindo Mercado Pago...'
                        : isCurrent && activeSub
                          ? 'Plano atual'
                          : isCurrent
                            ? 'Renovar assinatura'
                            : currentPlan.priceCents > 0
                              ? `Mudar para ${plan.name}`
                              : `Assinar ${plan.name}`}
                    </Button>
                  )}
                </Card>
              )
            })}
          </div>

          <Card className="p-6">
            <div className="flex items-center gap-2">
              <Zap size={18} className="text-[var(--color-signal-600)]" />
              <h3 className="text-base font-semibold text-[var(--color-ink-900)]">Créditos avulsos</h3>
            </div>
            <p className="mt-1 text-sm text-[var(--color-ink-600)]">
              Acabou a cota do mês? Os créditos são usados só depois da cota do plano e não expiram. Pagamento por
              cartão, Pix ou boleto.
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              {CREDIT_PACKS.map((pack) => (
                <div
                  key={pack.id}
                  className="flex flex-col justify-between gap-3 rounded-lg border border-[var(--color-ink-200)] p-4"
                >
                  <div>
                    <p className="text-sm font-medium text-[var(--color-ink-900)]">{pack.name}</p>
                    <p className="text-lg font-semibold text-[var(--color-ink-900)]">{formatBRL(pack.priceCents)}</p>
                  </div>
                  <Button size="sm" variant="secondary" disabled={busy !== null} onClick={() => handleBuyCredits(pack.id)}>
                    {busy === pack.id ? 'Abrindo...' : 'Comprar'}
                  </Button>
                </div>
              ))}
            </div>
          </Card>
        </>
      )}

      <Card className="p-6">
        <h3 className="text-base font-semibold text-[var(--color-ink-900)]">Histórico de pagamentos</h3>
        {payments.length === 0 ? (
          <div className="mt-4 rounded-lg border border-dashed border-[var(--color-ink-200)] py-10 text-center">
            <p className="text-sm text-[var(--color-ink-500)]">Nenhum pagamento até o momento.</p>
          </div>
        ) : (
          <ul className="mt-4 divide-y divide-[var(--color-ink-100)]">
            {payments.map((p) => (
              <li key={p.id} className="flex items-center justify-between py-3 text-sm">
                <span className="text-[var(--color-ink-700)]">
                  {p.kind === 'subscription' ? 'Mensalidade' : 'Créditos avulsos'}
                </span>
                <span className="text-[var(--color-ink-500)]">{formatDate(p.created_at)}</span>
                <span className="font-medium text-[var(--color-ink-900)]">{formatBRL(p.amount_cents)}</span>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-4 text-xs text-[var(--color-ink-400)]">
          Recibos e notas do pagamento ficam disponíveis na sua conta do Mercado Pago.
        </p>
      </Card>
    </div>
  )
}

export default function SubscriptionPage() {
  return (
    <AppLayout title="Assinatura" subtitle="Gerencie seu plano, créditos e pagamentos">
      <Suspense
        fallback={
          <div className="flex justify-center py-16">
            <Loader2 size={24} className="animate-spin text-[var(--color-signal-600)]" />
          </div>
        }
      >
        <SubscriptionContent />
      </Suspense>
    </AppLayout>
  )
}
