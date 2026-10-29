import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { searchLocalPlaces } from '@/lib/services/search'
import type { SearchFilters, Lead } from '@/types'

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

    const body = await request.json()
    const filters: SearchFilters = {
      location: body.location || 'Curitiba, PR',
      category: body.category || 'Todas as categorias',
      radiusKm: Number(body.radiusKm) || 10,
      onlyWithoutWebsite: body.onlyWithoutWebsite !== false,
      minRating: Number(body.minRating) || 0,
      minReviews: Number(body.minReviews) || 0,
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

    if (leadsToUpsert.length > 0) {
      await supabase
        .from('leads')
        .upsert(leadsToUpsert, { onConflict: 'place_id' })
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

