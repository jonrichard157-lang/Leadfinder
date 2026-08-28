// Tipos centrais do domínio. Desenhados para mapear 1:1 com futuras
// tabelas no Supabase (leads, searches, saved_leads, profiles, subscriptions).

export type LeadStatus = 'novo' | 'contatado' | 'em_negociacao' | 'convertido' | 'descartado'

export interface Lead {
  id: string
  name: string
  category: string
  address: string
  city: string
  state: string
  phone?: string
  hasWebsite: boolean
  website?: string
  rating: number
  reviewsCount: number
  opportunityScore: number // 0-100, calculado a partir de sinais (sem site, poucas avaliações, categoria, etc.)
  status: LeadStatus
  saved: boolean
  source: 'google_places' | 'manual' // preparado para integração futura
  foundAt: string // ISO date
  notes?: LeadNote[]
}

export interface LeadNote {
  id: string
  content: string
  createdAt: string
}

export interface SearchFilters {
  location: string
  category: string
  radiusKm: number
  onlyWithoutWebsite: boolean
  minRating: number
  minReviews: number
}

export interface SearchSummary {
  id: string
  filters: SearchFilters
  resultsCount: number
  createdAt: string
}

export interface DashboardStats {
  leadsFound: number
  leadsSaved: number
  leadsWithoutWebsite: number
  highOpportunity: number
}

export type PlanId = 'free' | 'pro' | 'agencia'

export interface Plan {
  id: PlanId
  name: string
  price: number
  priceLabel: string
  billingPeriod: 'mês'
  description: string
  features: string[]
  highlighted?: boolean
  ctaLabel: string
}

export interface UserProfile {
  id: string
  name: string
  email: string
  company?: string
  plan: PlanId
  avatarInitials: string
  createdAt: string
}
