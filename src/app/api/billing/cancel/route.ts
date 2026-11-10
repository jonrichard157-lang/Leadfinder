import { NextResponse } from 'next/server'
import { cancelPreapproval } from '@/lib/billing/mercadopago'
import { billingContext, billingError } from '@/lib/billing/server'

/**
 * Cancela a renovação automática. O plano continua ativo até o fim do período já pago
 * (profiles.plan_expires_at) e depois volta ao Grátis, sem apagar leads.
 */
export async function POST() {
  const ctx = await billingContext()
  if (ctx instanceof NextResponse) return ctx

  try {
    const { data: subs, error } = await ctx.admin
      .from('subscriptions')
      .select('id, provider_subscription_id')
      .eq('user_id', ctx.userId)
      .in('status', ['authorized', 'paused'])

    if (error) throw new Error(error.message)
    if (!subs || subs.length === 0) {
      return NextResponse.json({ error: 'Você não tem assinatura ativa.' }, { status: 400 })
    }

    for (const sub of subs) {
      if (sub.provider_subscription_id) await cancelPreapproval(sub.provider_subscription_id)
      await ctx.admin
        .from('subscriptions')
        .update({ status: 'cancelled', updated_at: new Date().toISOString() })
        .eq('id', sub.id)
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    return billingError(err)
  }
}
