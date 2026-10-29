import { supabase } from '@/lib/supabase'
import type { Lead, LeadNote, LeadStatus, DashboardStats } from '@/types'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Leads vindos da busca usam o place_id (ex: "gp_ChIJ..."); os do banco usam o UUID.
 * Filtrar `id` (uuid) com um place_id faz o Postgres rejeitar a consulta inteira.
 */
function leadLookupColumn(leadId: string): 'id' | 'place_id' {
  return UUID_RE.test(leadId) ? 'id' : 'place_id'
}

interface DbLead {
  id: string
  place_id: string | null
  name: string
  category: string | null
  address: string | null
  city: string | null
  state: string | null
  phone: string | null
  has_website: boolean
  website: string | null
  rating: number
  reviews_count: number
  opportunity_score: number
  source: 'google_places' | 'manual'
  created_at: string
}

interface DbSavedLead {
  id: string
  user_id: string
  lead_id: string
  status: LeadStatus
  notes: LeadNote[]
  created_at: string
  updated_at: string
  leads: DbLead | null
}

function mapDbLeadToLead(dbLead: DbLead, savedLead?: DbSavedLead | null): Lead {
  return {
    id: dbLead.id,
    name: dbLead.name,
    category: dbLead.category || 'Geral',
    address: dbLead.address || '',
    city: dbLead.city || '',
    state: dbLead.state || '',
    phone: dbLead.phone || undefined,
    hasWebsite: dbLead.has_website,
    website: dbLead.website || undefined,
    rating: Number(dbLead.rating) || 0,
    reviewsCount: dbLead.reviews_count || 0,
    opportunityScore: dbLead.opportunity_score || 0,
    status: savedLead?.status || 'novo',
    saved: Boolean(savedLead),
    source: dbLead.source || 'google_places',
    foundAt: dbLead.created_at,
    notes: savedLead?.notes || [],
  }
}

/**
 * Busca todos os leads salvos por um usuário no Supabase.
 */
export async function getSavedLeads(userId: string): Promise<Lead[]> {
  try {
    const { data, error } = await supabase
      .from('saved_leads')
      .select(`
        id,
        user_id,
        lead_id,
        status,
        notes,
        created_at,
        updated_at,
        leads (*)
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Erro ao buscar leads salvos:', error)
      return []
    }

    if (!data || data.length === 0) {
      return []
    }

    return (data as unknown as DbSavedLead[])
      .filter((row): row is DbSavedLead & { leads: DbLead } => row.leads !== null)
      .map((row) => mapDbLeadToLead(row.leads, row))
  } catch (err) {
    console.error('Falha inesperada ao buscar leads salvos:', err)
    return []
  }
}

/**
 * Busca os detalhes de um lead por ID.
 */
export async function getLeadById(leadId: string, userId?: string): Promise<Lead | null> {
  try {
    // 1. Tenta buscar no banco de dados na tabela `leads`
    const { data: dbLead, error } = await supabase
      .from('leads')
      .select('*')
      .eq(leadLookupColumn(leadId), leadId)
      .maybeSingle()

    if (!error && dbLead) {
      let savedRecord: DbSavedLead | null = null

      if (userId) {
        const { data: savedData } = await supabase
          .from('saved_leads')
          .select('*')
          .eq('user_id', userId)
          .eq('lead_id', dbLead.id)
          .maybeSingle()

        if (savedData) {
          savedRecord = savedData as DbSavedLead
        }
      }

      return mapDbLeadToLead(dbLead as DbLead, savedRecord)
    }

    if (error) {
      console.error('Erro ao buscar lead por ID:', error)
    }
    return null
  } catch (err) {
    console.error('Erro ao buscar lead por ID:', err)
    return null
  }
}

/**
 * Salva ou desmarca um lead na lista de prospecção do usuário.
 */
export async function toggleSaveLead(
  userId: string,
  lead: Lead
): Promise<{ saved: boolean; lead: Lead; error?: string }> {
  try {
    // 1. Garante que o lead exista na tabela `leads`
    let targetLeadId = lead.id

    const { data: existingLead } = await supabase
      .from('leads')
      .select('id')
      .eq(leadLookupColumn(lead.id), lead.id)
      .maybeSingle()

    if (!existingLead) {
      const { data: newLead, error: insertLeadError } = await supabase
        .from('leads')
        .insert({
          place_id: lead.id,
          name: lead.name,
          category: lead.category,
          address: lead.address,
          city: lead.city,
          state: lead.state,
          phone: lead.phone || null,
          has_website: lead.hasWebsite,
          website: lead.website || null,
          rating: lead.rating,
          reviews_count: lead.reviewsCount,
          opportunity_score: lead.opportunityScore,
          source: lead.source || 'google_places',
        })
        .select()
        .single()

      if (insertLeadError || !newLead) {
        console.error('Erro ao inserir lead no banco:', insertLeadError)
        return { saved: lead.saved, lead, error: 'Não foi possível salvar o lead.' }
      }

      targetLeadId = newLead.id
    } else {
      targetLeadId = existingLead.id
    }

    // 2. Verifica se já está salvo pelo usuário
    const { data: existingSaved } = await supabase
      .from('saved_leads')
      .select('id')
      .eq('user_id', userId)
      .eq('lead_id', targetLeadId)
      .maybeSingle()

    if (existingSaved) {
      // Remove dos salvos
      await supabase.from('saved_leads').delete().eq('id', existingSaved.id)
      return { saved: false, lead: { ...lead, id: targetLeadId, saved: false } }
    } else {
      // Salva para o usuário. O trigger `enforce_lead_quota` conta o uso do mês
      // e bloqueia quando o limite do plano é atingido (equipe não tem limite).
      const { error: saveError } = await supabase.from('saved_leads').insert({
        user_id: userId,
        lead_id: targetLeadId,
        status: lead.status || 'novo',
        notes: lead.notes || [],
      })

      if (saveError) {
        console.error('Erro ao salvar lead:', saveError)
        return {
          saved: false,
          lead: { ...lead, id: targetLeadId, saved: false },
          error: saveError.hint === 'lead_limit' ? saveError.message : 'Não foi possível salvar o lead.',
        }
      }

      return { saved: true, lead: { ...lead, id: targetLeadId, saved: true } }
    }
  } catch (err) {
    console.error('Erro ao alternar salvamento de lead:', err)
    return { saved: lead.saved, lead, error: 'Não foi possível salvar o lead.' }
  }
}

/**
 * Atualiza o status de prospecção de um lead salvo (ex: 'novo' -> 'em_negociacao').
 */
export async function updateLeadStatus(
  userId: string,
  leadId: string,
  status: LeadStatus
): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('saved_leads')
      .update({
        status,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId)
      .eq('lead_id', leadId)

    if (error) {
      console.error('Erro ao atualizar status do lead:', error)
      return false
    }

    return true
  } catch (err) {
    console.error('Erro inesperado ao atualizar status do lead:', err)
    return false
  }
}

/**
 * Adiciona uma anotação a um lead salvo pelo usuário.
 */
export async function addLeadNote(
  userId: string,
  leadId: string,
  content: string
): Promise<LeadNote[]> {
  try {
    const { data: savedRecord, error: fetchErr } = await supabase
      .from('saved_leads')
      .select('id, notes')
      .eq('user_id', userId)
      .eq('lead_id', leadId)
      .maybeSingle()

    if (fetchErr || !savedRecord) {
      console.error('Lead não encontrado nos salvos para adicionar nota:', fetchErr)
      const newNote: LeadNote = {
        id: crypto.randomUUID(),
        content,
        createdAt: new Date().toISOString(),
      }
      return [newNote]
    }

    const currentNotes: LeadNote[] = Array.isArray(savedRecord.notes) ? savedRecord.notes : []
    const newNote: LeadNote = {
      id: crypto.randomUUID(),
      content,
      createdAt: new Date().toISOString(),
    }

    const updatedNotes = [newNote, ...currentNotes]

    const { error: updateErr } = await supabase
      .from('saved_leads')
      .update({
        notes: updatedNotes,
        updated_at: new Date().toISOString(),
      })
      .eq('id', savedRecord.id)

    if (updateErr) {
      console.error('Erro ao salvar anotação no banco:', updateErr)
    }

    return updatedNotes
  } catch (err) {
    console.error('Falha ao adicionar anotação:', err)
    return [{ id: crypto.randomUUID(), content, createdAt: new Date().toISOString() }]
  }
}

/**
 * Calcula as estatísticas em tempo real para o Dashboard do usuário.
 */
export async function getUserDashboardStats(userId: string): Promise<DashboardStats> {
  try {
    const [savedLeads, { data: searches }] = await Promise.all([
      getSavedLeads(userId),
      supabase.from('searches').select('results_count').eq('user_id', userId),
    ])

    const leadsFound = (searches ?? []).reduce((sum, s) => sum + (s.results_count || 0), 0)
    const leadsSaved = savedLeads.length
    const leadsWithoutWebsite = savedLeads.filter((l) => !l.hasWebsite).length
    const highOpportunity = savedLeads.filter((l) => l.opportunityScore >= 75).length

    return {
      leadsFound,
      leadsSaved,
      leadsWithoutWebsite,
      highOpportunity,
    }
  } catch (err) {
    console.error('Erro ao calcular estatísticas do dashboard:', err)
    return {
      leadsFound: 0,
      leadsSaved: 0,
      leadsWithoutWebsite: 0,
      highOpportunity: 0,
    }
  }
}

