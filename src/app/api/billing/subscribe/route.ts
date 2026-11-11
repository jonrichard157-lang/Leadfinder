import { NextResponse, type NextRequest } from 'next/server'
import { canSubscribe, getPlan } from '@/lib/billing/catalog'
import { appUrl, createPreapprovalPlan } from '@/lib/billing/mercadopago'
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
    // Assinatura com plano: o Mercado Pago cria a preapproval quando o usuário assina.
    // A linha fica com provider_subscription_id = "plan:{id}" até o webhook trocar pelo id real.
    const mpPlan = await createPreapprovalPlan({
      reason: `OrbeLead ${plan.name}`,
      amountCents: plan.priceCents,
      backUrl: `${base}/app/assinatura?retorno=assinatura`,
    })

    if (!mpPlan.init_point) {
      throw new Error('Mercado Pago não retornou o link de autorização.')
    }

    const { error } = await ctx.admin.from('subscriptions').insert({
      user_id: ctx.userId,
      plan_id: plan.id,
      provider_subscription_id: `plan:${mpPlan.id}`,
      status: 'pending',
      amount_cents: plan.priceCents,
    })
    if (error) throw new Error(`Falha ao registrar a assinatura: ${error.message}`)

    return NextResponse.json({ url: mpPlan.init_point })
  } catch (err) {
    return billingError(err)
  }
}
