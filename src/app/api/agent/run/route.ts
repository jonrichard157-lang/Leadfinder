import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { AGENT_GOOGLE_CALLS_PER_QUERY, agentAccessFor } from '@/lib/billing/catalog'
import { normalizePlan, PlanSchema } from '@/lib/agent/plan'
import { searchLocalPlaces } from '@/lib/services/search'
import type { Lead, SearchFilters } from '@/types'

/**
 * Agente de busca, etapa 2: executa o plano (já revisado pelo usuário) no Google Places.
 * Custo para o usuário: 1 pedido ao agente + 1 busca da cota, não importa quantas consultas.
 * Custo para o OrbeLead: no máximo maxQueries x AGENT_GOOGLE_CALLS_PER_QUERY chamadas ao Google.
 * Não chama a IA: o plano chega pronto.
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

  // O plano volta do navegador (pode ter sido editado): valida o formato e reaplica os limites.
  const body = await request.json().catch(() => ({}))
  const parsed = PlanSchema.safeParse(body.plan)
  if (!parsed.success) return NextResponse.json({ error: 'Plano de busca inválido. Monte o plano de novo.' }, { status: 400 })
  const plan = normalizePlan(parsed.data, access.maxQueries)
  if (plan.consultas.length === 0) {
    return NextResponse.json({ error: 'Adicione pelo menos uma consulta com nicho e local.' }, { status: 400 })
  }

  const admin = createAdminClient()
  if (!admin) {
    console.error('Agente: SUPABASE_SERVICE_ROLE_KEY ou NEXT_PUBLIC_SUPABASE_URL ausente neste deploy.')
    return NextResponse.json(
      { error: 'Agente indisponível no momento (configuração do servidor incompleta).' },
      { status: 503 }
    )
  }

  // 1. Pedido do mês (limite do agente). Depois, 1 busca da cota normal; se ela falhar, devolve o pedido.
  const { error: runError } = await admin.rpc('agent_use', { p_user: user.id, p_kind: 'run', p_limit: access.monthlyRuns })
  if (runError) {
    if (runError.hint === 'agent_limit') return NextResponse.json({ error: runError.message }, { status: 403 })
    console.error('Agente: falha ao contar o pedido:', runError)
    return NextResponse.json({ error: 'Não foi possível verificar seu limite. Tente novamente.' }, { status: 500 })
  }

  const { error: quotaError } = await supabase.rpc('consume_search')
  if (quotaError) {
    await admin.rpc('agent_use', { p_user: user.id, p_kind: 'refund_run', p_limit: 0 })
    if (quotaError.hint === 'search_limit') return NextResponse.json({ error: quotaError.message }, { status: 403 })
    console.error('Agente: falha ao consumir a busca:', quotaError)
    return NextResponse.json({ error: 'Não foi possível verificar sua cota. Tente novamente.' }, { status: 500 })
  }

  try {
    // 2. Uma busca por consulta, em paralelo, com custo fixo por consulta.
    const results = await Promise.allSettled(
      plan.consultas.map((q) => {
        const filters: SearchFilters = {
          location: q.local,
          category: q.nicho,
          radiusKm: q.raioKm,
          onlyWithoutWebsite: plan.sinais.semSite === 'exigir',
          minRating: plan.sinais.notaMinima,
          minReviews: plan.sinais.minAvaliacoes,
        }
        return searchLocalPlaces(filters, { maxRequests: AGENT_GOOGLE_CALLS_PER_QUERY })
      })
    )

    const failed = results.filter((r) => r.status === 'rejected')
    failed.forEach((r) => console.error('Agente: consulta falhou:', (r as PromiseRejectedResult).reason))
    if (failed.length === results.length) {
      // Nada foi buscado: devolve o pedido. A busca da cota não é devolvida (mesma regra da busca rápida).
      await admin.rpc('agent_use', { p_user: user.id, p_kind: 'refund_run', p_limit: 0 })
      return NextResponse.json({ error: 'Não foi possível buscar agora. Tente novamente em instantes.' }, { status: 502 })
    }

    // 3. Junta sem repetir empresas (a mesma empresa pode aparecer em dois nichos).
    const seen = new Set<string>()
    const leads: Lead[] = []
    for (const r of results) {
      if (r.status !== 'fulfilled') continue
      for (const lead of r.value) {
        if (seen.has(lead.id)) continue
        seen.add(lead.id)
        leads.push(lead)
      }
    }

    // 4. Catálogo compartilhado `leads` (só o servidor grava) e histórico da busca com a intenção.
    if (leads.length > 0) {
      const { error: upsertError } = await admin.from('leads').upsert(
        leads.map((l) => ({
          place_id: l.id,
          name: l.name,
          category: l.category,
          address: l.address,
          city: l.city,
          state: l.state,
          phone: l.phone || null,
          has_website: l.hasWebsite,
          website: l.website || null,
          rating: l.rating,
          reviews_count: l.reviewsCount,
          opportunity_score: l.opportunityScore,
          source: l.source,
        })),
        { onConflict: 'place_id' }
      )
      if (upsertError) console.warn('Agente: erro ao salvar leads em cache:', upsertError)
    }

    const { data: search, error: searchError } = await admin
      .from('searches')
      .insert({
        user_id: user.id,
        mode: 'agente',
        intent: plan,
        filters: { consultas: plan.consultas, sinais: plan.sinais },
        results_count: leads.length,
      })
      .select('id')
      .single()
    if (searchError) console.warn('Agente: erro ao salvar o histórico:', searchError)

    // 5. Marca os que o usuário já salvou.
    const { data: saved } = await supabase
      .from('saved_leads')
      .select('leads(place_id)')
      .eq('user_id', user.id)
    const savedIds = new Set(
      ((saved ?? []) as unknown as { leads: { place_id: string | null } | null }[])
        .map((r) => r.leads?.place_id)
        .filter(Boolean) as string[]
    )

    return NextResponse.json({
      searchId: search?.id ?? crypto.randomUUID(),
      resumo: plan.resumo,
      leads: leads.map((l) => ({ ...l, saved: savedIds.has(l.id) })),
      partial: failed.length > 0,
    })
  } catch (err) {
    console.error('Agente: erro ao executar o plano:', err)
    return NextResponse.json({ error: 'Erro interno ao executar a busca.' }, { status: 500 })
  }
}
