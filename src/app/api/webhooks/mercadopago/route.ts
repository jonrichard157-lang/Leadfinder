import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getCreditPack, getPlan } from '@/lib/billing/catalog'
import {
  cancelPreapproval,
  getAuthorizedPayment,
  getPayment,
  getPreapproval,
  verifyWebhookSignature,
  type Preapproval,
} from '@/lib/billing/mercadopago'

type Admin = NonNullable<ReturnType<typeof createAdminClient>>

/**
 * Notificações do Mercado Pago (Webhooks). Configure em Suas integrações > Webhooks com os
 * eventos "Pagamentos", "Planos e assinaturas" e a URL https://SEU_DOMINIO/api/webhooks/mercadopago.
 *
 * Segurança: o corpo da notificação só informa o ID. O estado real (aprovado, autorizado…)
 * é sempre consultado na API do Mercado Pago com o nosso token, e cada pagamento é aplicado
 * uma única vez (billing_payments.provider_payment_id é único).
 * Respostas 5xx fazem o Mercado Pago reenviar a notificação.
 */
export async function POST(request: NextRequest) {
  const url = request.nextUrl
  const body = await request.json().catch(() => ({}) as Record<string, unknown>)

  const type = String(body.type ?? url.searchParams.get('type') ?? url.searchParams.get('topic') ?? '')
  const dataId = String(
    (body.data as { id?: unknown } | undefined)?.id ?? url.searchParams.get('data.id') ?? url.searchParams.get('id') ?? ''
  )

  const secret = process.env.MP_WEBHOOK_SECRET
  if (secret) {
    const valid = verifyWebhookSignature({
      signature: request.headers.get('x-signature'),
      requestId: request.headers.get('x-request-id'),
      dataId: url.searchParams.get('data.id') ?? dataId,
      secret,
    })
    if (!valid) return NextResponse.json({ error: 'Assinatura inválida.' }, { status: 401 })
  } else {
    console.warn('MP_WEBHOOK_SECRET não configurado: notificação aceita sem validar assinatura.')
  }

  if (!dataId) return NextResponse.json({ ok: true, ignored: 'sem id' })

  const admin = createAdminClient()
  if (!admin) return NextResponse.json({ error: 'Service role não configurada.' }, { status: 503 })

  try {
    switch (type) {
      case 'subscription_preapproval':
      case 'preapproval':
        await handlePreapproval(admin, await getPreapproval(dataId))
        break
      case 'subscription_authorized_payment':
      case 'authorized_payment':
        await handleAuthorizedPayment(admin, dataId)
        break
      case 'payment':
        await handlePayment(admin, dataId)
        break
      default:
        return NextResponse.json({ ok: true, ignored: type || 'tipo desconhecido' })
    }
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error(`Webhook Mercado Pago (${type} ${dataId}) falhou:`, err)
    return NextResponse.json({ error: 'Falha ao processar.' }, { status: 500 })
  }
}

/** "sub:{userId}:{planId}" ou "credits:{userId}:{packId}:{nonce}" */
function parseReference(ref: string | null | undefined) {
  const [kind, userId, itemId] = (ref ?? '').split(':')
  if (!userId || !itemId) return null
  if (kind === 'sub' || kind === 'credits') return { kind, userId, itemId } as const
  return null
}

async function rpc(admin: Admin, fn: string, args: Record<string, unknown>) {
  const { data, error } = await admin.rpc(fn, args)
  if (error) throw new Error(`${fn}: ${error.message}`)
  return data
}

async function handlePreapproval(admin: Admin, pre: Preapproval) {
  const { data: existing } = await admin
    .from('subscriptions')
    .select('id, user_id, plan_id')
    .eq('provider_subscription_id', pre.id)
    .maybeSingle()

  let sub = existing
  if (!sub) {
    const ref = parseReference(pre.external_reference)
    const plan = getPlan(ref?.itemId)
    if (!ref || ref.kind !== 'sub' || !plan) return
    const { data, error } = await admin
      .from('subscriptions')
      .insert({
        user_id: ref.userId,
        plan_id: plan.id,
        provider_subscription_id: pre.id,
        status: pre.status,
        amount_cents: plan.priceCents,
      })
      .select('id, user_id, plan_id')
      .single()
    if (error) throw new Error(error.message)
    sub = data
  }

  await admin
    .from('subscriptions')
    .update({ status: pre.status, updated_at: new Date().toISOString() })
    .eq('id', sub.id)

  if (pre.status !== 'authorized') return

  const plan = getPlan(sub.plan_id)
  if (!plan) throw new Error(`Plano desconhecido: ${sub.plan_id}`)

  await rpc(admin, 'billing_activate_plan', {
    p_user: sub.user_id,
    p_plan: plan.id,
    p_search_limit: plan.monthlySearches,
    p_lead_limit: plan.monthlyLeads,
  })

  // Troca de plano: a assinatura nova substitui as anteriores.
  const { data: others } = await admin
    .from('subscriptions')
    .select('id, provider_subscription_id, status')
    .eq('user_id', sub.user_id)
    .neq('id', sub.id)
    .in('status', ['pending', 'authorized', 'paused'])

  for (const other of others ?? []) {
    if (other.provider_subscription_id) {
      await cancelPreapproval(other.provider_subscription_id).catch((e) =>
        console.warn('Não foi possível cancelar a assinatura anterior:', other.provider_subscription_id, e)
      )
    }
    await admin
      .from('subscriptions')
      .update({ status: 'cancelled', updated_at: new Date().toISOString() })
      .eq('id', other.id)
  }
}

async function recordSubscriptionPayment(admin: Admin, preapprovalId: string, paymentId: string, amount?: number) {
  const { data: sub } = await admin
    .from('subscriptions')
    .select('user_id, plan_id')
    .eq('provider_subscription_id', preapprovalId)
    .maybeSingle()
  if (!sub) throw new Error(`Assinatura ${preapprovalId} não encontrada.`)

  const plan = getPlan(sub.plan_id)
  if (!plan) throw new Error(`Plano desconhecido: ${sub.plan_id}`)

  await rpc(admin, 'billing_record_subscription_payment', {
    p_payment_id: paymentId,
    p_user: sub.user_id,
    p_plan: plan.id,
    p_search_limit: plan.monthlySearches,
    p_lead_limit: plan.monthlyLeads,
    p_amount_cents: Math.round((amount ?? plan.priceCents / 100) * 100),
    p_reference: `sub:${preapprovalId}`,
  })
}

async function handleAuthorizedPayment(admin: Admin, id: string) {
  const ap = await getAuthorizedPayment(id)
  if (ap.payment?.status !== 'approved' || !ap.payment.id) return
  await recordSubscriptionPayment(admin, ap.preapproval_id, String(ap.payment.id), ap.transaction_amount)
}

async function handlePayment(admin: Admin, id: string) {
  const payment = await getPayment(id)
  if (payment.status !== 'approved') return

  const ref = parseReference(payment.external_reference)
  if (!ref) return

  if (ref.kind === 'credits') {
    const pack = getCreditPack(ref.itemId)
    const paidCents = Math.round((payment.transaction_amount ?? 0) * 100)
    if (!pack || paidCents < pack.priceCents) {
      // Não relança: o reenvio do Mercado Pago não mudaria o resultado. Fica no log para revisão.
      console.error(`Pagamento ${payment.id} não corresponde ao pacote ${ref.itemId}; créditos não concedidos.`)
      return
    }
    await rpc(admin, 'billing_grant_credits', {
      p_payment_id: String(payment.id),
      p_user: ref.userId,
      p_searches: pack.searches,
      p_leads: pack.leads,
      p_amount_cents: paidCents,
      p_reference: payment.external_reference,
    })
  }
  // Cobranças de assinatura são tratadas pelo evento subscription_authorized_payment,
  // que informa a assinatura de origem.
}
