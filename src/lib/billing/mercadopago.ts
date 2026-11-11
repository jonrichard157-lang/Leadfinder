import 'server-only'
import { createHmac, timingSafeEqual } from 'node:crypto'

// Cliente mínimo da API REST do Mercado Pago (sem SDK). Só roda no servidor.
// Docs: Assinaturas (/preapproval), Checkout Pro (/checkout/preferences), Pagamentos (/v1/payments).

const API = 'https://api.mercadopago.com'

export class MercadoPagoError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

function accessToken(): string {
  const token = process.env.MP_ACCESS_TOKEN
  if (!token) throw new MercadoPagoError('Pagamentos indisponíveis: MP_ACCESS_TOKEN não configurado.', 503)
  return token
}

async function mp<T>(path: string, init: { method?: string; body?: unknown; idempotencyKey?: string } = {}): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    method: init.method ?? 'GET',
    headers: {
      Authorization: `Bearer ${accessToken()}`,
      'Content-Type': 'application/json',
      ...(init.idempotencyKey ? { 'X-Idempotency-Key': init.idempotencyKey } : {}),
    },
    body: init.body ? JSON.stringify(init.body) : undefined,
    cache: 'no-store',
  })

  if (!res.ok) {
    const detail = await res.text()
    console.error(`Mercado Pago ${init.method ?? 'GET'} ${path} → ${res.status}:`, detail)
    throw new MercadoPagoError('Não foi possível falar com o Mercado Pago. Tente novamente.', res.status)
  }
  return (await res.json()) as T
}

// ---------------------------------------------------------------------------
// Assinaturas (preapproval sem plano associado: o usuário autoriza no init_point)
// ---------------------------------------------------------------------------

export interface Preapproval {
  id: string
  status: 'pending' | 'authorized' | 'paused' | 'cancelled'
  external_reference?: string
  payer_email?: string
  init_point?: string
  preapproval_plan_id?: string
  auto_recurring?: { transaction_amount?: number }
}

/**
 * Assinatura com plano associado: cria um plano mensal e devolve o init_point dele.
 * O usuário assina no Mercado Pago, que cria a preapproval (com preapproval_plan_id)
 * e avisa pelo webhook subscription_preapproval.
 */
export function createPreapprovalPlan(input: { reason: string; amountCents: number; backUrl: string }) {
  console.info('Criando preapproval_plan', { backUrl: input.backUrl, amount: input.amountCents / 100 })
  return mp<{ id: string; init_point: string }>('/preapproval_plan', {
    method: 'POST',
    body: {
      reason: input.reason,
      back_url: input.backUrl,
      auto_recurring: {
        frequency: 1,
        frequency_type: 'months',
        transaction_amount: input.amountCents / 100,
        currency_id: 'BRL',
      },
    },
  })
}

export function createPreapproval(input: {
  reason: string
  externalReference: string
  payerEmail: string
  amountCents: number
  backUrl: string
}) {
  // Diagnóstico sem expor dados pessoais: domínio do e-mail e URL de retorno.
  console.info('Criando preapproval', {
    backUrl: input.backUrl,
    payerDomain: input.payerEmail.split('@')[1],
    amount: input.amountCents / 100,
  })
  return mp<Preapproval>('/preapproval', {
    method: 'POST',
    body: {
      reason: input.reason,
      external_reference: input.externalReference,
      payer_email: input.payerEmail,
      back_url: input.backUrl,
      status: 'pending',
      auto_recurring: {
        frequency: 1,
        frequency_type: 'months',
        transaction_amount: input.amountCents / 100,
        currency_id: 'BRL',
      },
    },
  })
}

export function getPreapproval(id: string) {
  return mp<Preapproval>(`/preapproval/${encodeURIComponent(id)}`)
}

export function cancelPreapproval(id: string) {
  return mp<Preapproval>(`/preapproval/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: { status: 'cancelled' },
  })
}

export interface AuthorizedPayment {
  id: number | string
  preapproval_id: string
  transaction_amount?: number
  payment?: { id?: number | string; status?: string }
}

export function getAuthorizedPayment(id: string) {
  return mp<AuthorizedPayment>(`/authorized_payments/${encodeURIComponent(id)}`)
}

// ---------------------------------------------------------------------------
// Checkout Pro (compra avulsa de créditos: cartão, Pix, boleto)
// ---------------------------------------------------------------------------

export interface Preference {
  id: string
  init_point: string
}

export function createPreference(input: {
  itemId: string
  title: string
  amountCents: number
  externalReference: string
  payerEmail?: string
  backUrl: string
  notificationUrl?: string
}) {
  const https = input.backUrl.startsWith('https://')
  return mp<Preference>('/checkout/preferences', {
    method: 'POST',
    idempotencyKey: crypto.randomUUID(),
    body: {
      items: [
        {
          id: input.itemId,
          title: input.title,
          quantity: 1,
          unit_price: input.amountCents / 100,
          currency_id: 'BRL',
        },
      ],
      external_reference: input.externalReference,
      payer: input.payerEmail ? { email: input.payerEmail } : undefined,
      back_urls: { success: input.backUrl, pending: input.backUrl, failure: input.backUrl },
      // O Mercado Pago só aceita retorno automático para URLs https.
      ...(https ? { auto_return: 'approved' } : {}),
      ...(input.notificationUrl ? { notification_url: input.notificationUrl } : {}),
      statement_descriptor: 'ORBELEAD',
    },
  })
}

export interface Payment {
  id: number | string
  status: string
  external_reference?: string | null
  transaction_amount?: number
}

export function getPayment(id: string) {
  return mp<Payment>(`/v1/payments/${encodeURIComponent(id)}`)
}

// ---------------------------------------------------------------------------
// Webhooks: valida o cabeçalho x-signature (HMAC-SHA256 com a "assinatura secreta"
// configurada em Suas integrações > Webhooks).
// Manifesto: "id:{data.id};request-id:{x-request-id};ts:{ts};"
// ---------------------------------------------------------------------------

export function verifyWebhookSignature(params: {
  signature: string | null
  requestId: string | null
  dataId: string | null
  secret: string
}): boolean {
  if (!params.signature) return false

  const parts = Object.fromEntries(
    params.signature.split(',').map((p) => {
      const [k, ...v] = p.split('=')
      return [k.trim(), v.join('=').trim()]
    })
  )
  const ts = parts.ts
  const v1 = parts.v1
  if (!ts || !v1) return false

  const id = params.dataId && /^[a-z0-9]+$/i.test(params.dataId) ? params.dataId.toLowerCase() : params.dataId
  let manifest = ''
  if (id) manifest += `id:${id};`
  if (params.requestId) manifest += `request-id:${params.requestId};`
  manifest += `ts:${ts};`

  const expected = createHmac('sha256', params.secret).update(manifest).digest('hex')
  const a = Buffer.from(expected, 'hex')
  const b = Buffer.from(v1, 'hex')
  return a.length === b.length && timingSafeEqual(a, b)
}

/** URL pública do app, usada nos retornos e notificações do Mercado Pago. */
export function appUrl(requestOrigin: string): string {
  // O Mercado Pago recusa back_url inválida ("Invalid request"). Só usa APP_URL se for uma URL https válida.
  const raw = (process.env.APP_URL ?? '').trim().replace(/^["']|["']$/g, '')
  for (const candidate of [raw, requestOrigin]) {
    try {
      const u = new URL(candidate)
      if (u.protocol === 'https:' || u.hostname === 'localhost') return u.origin
    } catch {}
  }
  if (raw) console.warn('APP_URL inválida; usando a origem da requisição.')
  return requestOrigin.replace(/\/$/, '')
}
