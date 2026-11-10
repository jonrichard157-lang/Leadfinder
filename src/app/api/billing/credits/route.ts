import { NextResponse, type NextRequest } from 'next/server'
import { getCreditPack } from '@/lib/billing/catalog'
import { appUrl, createPreference } from '@/lib/billing/mercadopago'
import { billingContext, billingError } from '@/lib/billing/server'

/**
 * Compra avulsa de créditos pelo Checkout Pro (cartão, Pix ou boleto).
 * Os créditos entram quando o webhook confirma o pagamento aprovado.
 */
export async function POST(request: NextRequest) {
  const ctx = await billingContext()
  if (ctx instanceof NextResponse) return ctx

  try {
    const body = await request.json().catch(() => ({}))
    const pack = getCreditPack(body.packId)
    if (!pack) {
      return NextResponse.json({ error: 'Pacote de créditos inválido.' }, { status: 400 })
    }

    const base = appUrl(request.nextUrl.origin)
    const preference = await createPreference({
      itemId: pack.id,
      title: `OrbeLead — ${pack.name}`,
      amountCents: pack.priceCents,
      externalReference: `credits:${ctx.userId}:${pack.id}:${crypto.randomUUID()}`,
      payerEmail: ctx.email,
      backUrl: `${base}/app/assinatura?retorno=creditos`,
      notificationUrl: base.startsWith('https://') ? `${base}/api/webhooks/mercadopago` : undefined,
    })

    return NextResponse.json({ url: preference.init_point })
  } catch (err) {
    return billingError(err)
  }
}
