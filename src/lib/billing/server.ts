import 'server-only'
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { MercadoPagoError } from './mercadopago'
import type { AccountType, PlanId } from './catalog'

export interface BillingContext {
  userId: string
  email: string
  accountType: AccountType
  plan: PlanId
  role: 'user' | 'team' | 'admin'
  admin: NonNullable<ReturnType<typeof createAdminClient>>
}

/** Usuário logado + cliente admin. Retorna uma resposta de erro pronta quando não dá para seguir. */
export async function billingContext(): Promise<BillingContext | NextResponse> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user || !user.email) {
    return NextResponse.json({ error: 'Faça login para continuar.' }, { status: 401 })
  }

  const admin = createAdminClient()
  if (!admin) {
    return NextResponse.json({ error: 'Pagamentos indisponíveis no momento.' }, { status: 503 })
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('plan, role, account_type')
    .eq('id', user.id)
    .single()

  if (!profile) {
    return NextResponse.json({ error: 'Perfil não encontrado.' }, { status: 404 })
  }

  return {
    userId: user.id,
    email: user.email,
    accountType: profile.account_type === 'business' ? 'business' : 'individual',
    plan: profile.plan as PlanId,
    role: profile.role,
    admin,
  }
}

export function billingError(err: unknown) {
  console.error('Erro de cobrança:', err)
  if (err instanceof MercadoPagoError) {
    return NextResponse.json({ error: err.message }, { status: err.status === 503 ? 503 : 502 })
  }
  return NextResponse.json({ error: 'Erro interno ao processar o pagamento.' }, { status: 500 })
}
