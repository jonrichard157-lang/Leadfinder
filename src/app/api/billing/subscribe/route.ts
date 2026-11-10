import { NextResponse, type NextRequest } from 'next/server'
import { canSubscribe, getPlan } from '@/lib/billing/catalog'
import { appUrl, createPreapproval } from '@/lib/billing/mercadopago'
import { billingContext, billingError } from '@/lib/billing/server'

/**
 * Cria a assinatura mensal no Mercado Pago e devolve o link de autorização (init_point).
 * O plano só é ativado quando o webhook confirma a autorização. Trocar de plano cria uma
 * assinatura nova; a anterior é cancelada automaticamente quando a nova é autorizada.
 */
export async function POST(request: NextRequest) {
  const ctx = await billingContext()
  if (ctx instanceof NextResponse) return ctx

  try {
    const body = await request.json().catch(() => ({}))
    const plan = getPlan(body.planId)

    if (!plan || !canSubscribe(plan, ctx.accountType)) {
      return NextResponse.json({ error: 'Plano indisponível para o seu tipo de conta.' }, { status: 400 })
    }
    if (ctx.role !== 'user') {
      return NextResponse.json({ error: 'Contas da equipe OrbeLead não precisam de plano.' }, { status: 400 })
    }

    const base = appUrl(request.nextUrl.origin)
    const preapproval = await createPreapproval({
      reason: `OrbeLead ${plan.name}`,
      externalReference: `sub:${ctx.userId}:${plan.id}`,
      payerEmail: ctx.email,
      amountCents: plan.priceCents,
      backUrl: `${base}/app/assinatura?retorno=assinatura`,
    })

    if (!preapproval.init_point) {
      throw new Error('Mercado Pago não retornou o link de autorização.')
    }

    const { error } = await ctx.admin.from('subscriptions').insert({
      user_id: ctx.userId,
      plan_id: plan.id,
      provider_subscription_id: preapproval.id,
      status: preapproval.status ?? 'pending',
      amount_cents: plan.priceCents,
    })
    if (error) throw new Error(`Falha ao registrar a assinatura: ${error.message}`)

    return NextResponse.json({ url: preapproval.init_point })
  } catch (err) {
    return billingError(err)
  }
}
