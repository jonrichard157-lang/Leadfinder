import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { searchLocalPlaces } from '@/lib/services/search'
import type { SearchFilters, Lead } from '@/types'

function clamp(value: unknown, min: number, max: number, fallback: number): number {
  const n = Number(value)
  if (!Number.isFinite(n)) return fallback
  return Math.min(max, Math.max(min, n))
}

function text(value: unknown, fallback: string, maxLength: number): string {
  const s = typeof value === 'string' ? value.trim().slice(0, maxLength) : ''
  return s || fallback
}

interface SavedLeadRef {
  lead_id: string | null
  leads: { place_id: string | null } | null
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json(
        { error: 'Não autorizado. Faça login para realizar buscas.' },
        { status: 401 }
      )
    }

    // Consome uma busca da cota do plano antes de chamar o Google (nenhum plano é ilimitado; créditos avulsos entram depois da cota).
    const { error: quotaError } = await supabase.rpc('consume_search')
    if (quotaError) {
      if (quotaError.hint === 'search_limit') {
        return NextResponse.json({ error: quotaError.message }, { status: 403 })
      }
      throw new Error(`Falha ao verificar a cota de buscas: ${quotaError.message}`)
    }

    const body = await request.json().catch(() => ({}))
    // Limites protegem o custo do Google: o raio define a área de cada consulta.
    const filters: SearchFilters = {
      location: text(body.location, 'Curitiba, PR', 120),
      category: text(body.category, 'Todas as categorias', 80),
      radiusKm: clamp(body.radiusKm, 1, 50, 10),
      onlyWithoutWebsite: body.onlyWithoutWebsite !== false,
      minRating: clamp(body.minRating, 0, 5, 0),
      minReviews: Math.round(clamp(body.minReviews, 0, 100000, 0)),
    }

    // 1. Busca leads através do provedor (Google Places API / Gerador Contextual)
    const rawLeads: Lead[] = await searchLocalPlaces(filters)

    // 2. Armazena/Atualiza em cache no Supabase (tabela `leads`) para reutilização
    const leadsToUpsert = rawLeads.map((l) => ({
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
    }))

    // O catálogo `leads` é compartilhado entre todos os usuários, então só o servidor grava nele
    // (service role). Assim os dados vêm sempre do Google e são atualizados a cada busca.
    // Sem SUPABASE_SERVICE_ROLE_KEY, usa a sessão do usuário e só insere empresas novas
    // (funciona apenas enquanto a migração 004 não for aplicada).
    if (leadsToUpsert.length > 0) {
      const admin = createAdminClient()
      const { error: upsertError } = admin
        ? await admin
            .from('leads')
            .upsert(leadsToUpsert, { onConflict: 'place_id' })
        : await supabase
            .from('leads')
            .upsert(leadsToUpsert, { onConflict: 'place_id', ignoreDuplicates: true })

      if (upsertError) {
        console.warn('Erro ao salvar leads em cache:', upsertError)
      }
    }

    // 3. Registra a busca no histórico de buscas do usuário
    try {
      await supabase.from('searches').insert({
        user_id: user.id,
        filters,
        results_count: rawLeads.length,
      })
    } catch (searchHistoryErr) {
      console.warn('Erro ao salvar histórico de busca:', searchHistoryErr)
    }

    // 4. Cruza com os leads já salvos pelo usuário para marcar `saved: true/false`
    const { data: savedRecords } = await supabase
      .from('saved_leads')
      .select('lead_id, leads(place_id)')
      .eq('user_id', user.id)

    const savedPlaceIds = new Set<string>()
    if (savedRecords) {
      ;(savedRecords as unknown as SavedLeadRef[]).forEach((r) => {
        if (r.leads?.place_id) savedPlaceIds.add(r.leads.place_id)
        if (r.lead_id) savedPlaceIds.add(r.lead_id)
      })
    }

    const finalLeads: Lead[] = rawLeads.map((l) => ({
      ...l,
      saved: savedPlaceIds.has(l.id),
    }))

    return NextResponse.json({
      success: true,
      leads: finalLeads,
      total: finalLeads.length,
      filters,
    })
  } catch (err: unknown) {
    console.error('Erro na API de busca de leads:', err)
    const message = err instanceof Error ? err.message : 'Erro interno do servidor.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

