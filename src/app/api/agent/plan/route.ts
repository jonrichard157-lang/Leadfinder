import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { AGENT_PLANS_PER_RUN, agentAccessFor } from '@/lib/billing/catalog'
import { AgentError, createSearchPlan } from '@/lib/agent/plan'

/**
 * Agente de busca, etapa 1: recebe o pedido em texto e devolve um plano de busca editável.
 * Montar o plano não desconta busca da cota; o desconto acontece quando o plano é executado.
 * Cada montagem chama a IA (tem custo), então há um limite mensal: pedidos do plano x AGENT_PLANS_PER_RUN.
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Faça login para continuar.' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('plan, role').eq('id', user.id).single()
  const access = agentAccessFor(profile?.plan, profile?.role)
  if (!access) {
    return NextResponse.json(
      { error: 'O Agente de busca está disponível nos planos Pro, Max e Agência.', upgrade: true },
      { status: 403 }
    )
  }

  const body = await request.json().catch(() => ({}))
  const text = typeof body.request === 'string' ? body.request.trim() : ''
  if (text.length < 15) {
    return NextResponse.json(
      { error: 'Descreva com um pouco mais de detalhe o que você vende e quem quer encontrar.' },
      { status: 400 }
    )
  }

  const admin = createAdminClient()
  if (!admin) return NextResponse.json({ error: 'Agente indisponível no momento.' }, { status: 503 })

  const { error: usageError } = await admin.rpc('agent_use', {
    p_user: user.id,
    p_kind: 'plan',
    p_limit: access.monthlyRuns * AGENT_PLANS_PER_RUN,
  })
  if (usageError) {
    if (usageError.hint === 'agent_limit') return NextResponse.json({ error: usageError.message }, { status: 403 })
    console.error('Agente: falha ao contar o uso:', usageError)
    return NextResponse.json({ error: 'Não foi possível verificar seu limite. Tente novamente.' }, { status: 500 })
  }

  try {
    const plan = await createSearchPlan({
      request: text.slice(0, 1500),
      defaultLocation: typeof body.location === 'string' ? body.location.trim().slice(0, 120) : undefined,
      maxQueries: access.maxQueries,
    })
    return NextResponse.json({ plan, access })
  } catch (err) {
    if (err instanceof AgentError) return NextResponse.json({ error: err.message }, { status: err.status })
    console.error('Agente: erro inesperado:', err)
    return NextResponse.json({ error: 'Erro interno no agente.' }, { status: 500 })
  }
}
