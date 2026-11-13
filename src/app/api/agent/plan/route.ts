import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { agentAccessFor } from '@/lib/billing/catalog'
import { AgentError, createSearchPlan } from '@/lib/agent/plan'

/**
 * Agente de busca, etapa 1: recebe o pedido em texto e devolve um plano de busca editável.
 * Montar o plano não desconta busca da cota; o desconto acontece quando o plano é executado.
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
