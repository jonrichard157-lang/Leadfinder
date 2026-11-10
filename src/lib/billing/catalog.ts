// Catálogo de planos e pacotes de créditos do OrbeLead.
// Fonte única de preços e limites: o servidor cobra a partir daqui e grava os limites no
// perfil quando o Mercado Pago confirma o pagamento. Para mudar preço ou limite, altere este
// arquivo (assinaturas já criadas no Mercado Pago mantêm o valor antigo até serem trocadas).
// O plano Grátis também está em supabase/migrations/005 (expire_plan_if_needed): 10 / 10.

export type AccountType = 'individual' | 'business'
export type PlanId = 'free' | 'basico' | 'pro' | 'max' | 'agencia'
export type PlanAudience = 'all' | AccountType

export interface Plan {
  id: PlanId
  name: string
  audience: PlanAudience
  priceCents: number
  monthlySearches: number
  monthlyLeads: number
  description: string
  features: string[]
  highlighted?: boolean
}

export const PLANS: Plan[] = [
  {
    id: 'free',
    name: 'Grátis',
    audience: 'all',
    priceCents: 0,
    monthlySearches: 10,
    monthlyLeads: 10,
    description: 'Para testar a plataforma e validar sua primeira lista de leads.',
    features: ['10 buscas por mês', '10 leads salvos por mês', 'Opportunity Score', 'Exportação em CSV'],
  },
  {
    id: 'basico',
    name: 'Básico',
    audience: 'individual',
    priceCents: 4700,
    monthlySearches: 40,
    monthlyLeads: 150,
    description: 'Para autônomos que estão começando a prospectar com frequência.',
    features: ['40 buscas por mês', '150 leads salvos por mês', 'Opportunity Score', 'Exportação em CSV'],
  },
  {
    id: 'pro',
    name: 'Pro',
    audience: 'individual',
    priceCents: 9700,
    monthlySearches: 100,
    monthlyLeads: 500,
    description: 'Para freelancers e prestadores de serviço que prospectam toda semana.',
    features: ['100 buscas por mês', '500 leads salvos por mês', 'Opportunity Score', 'Exportação em CSV'],
    highlighted: true,
  },
  {
    id: 'max',
    name: 'Max',
    audience: 'individual',
    priceCents: 19700,
    monthlySearches: 250,
    monthlyLeads: 1500,
    description: 'Para quem vive de prospecção e precisa de volume alto.',
    features: ['250 buscas por mês', '1.500 leads salvos por mês', 'Opportunity Score', 'Exportação em CSV'],
  },
  {
    id: 'agencia',
    name: 'Agência',
    audience: 'business',
    priceCents: 24700,
    monthlySearches: 400,
    monthlyLeads: 3000,
    description: 'Para agências e empresas com prospecção comercial contínua.',
    features: ['400 buscas por mês', '3.000 leads salvos por mês', 'Opportunity Score', 'Exportação em CSV'],
    highlighted: true,
  },
]

export interface CreditPack {
  id: string
  name: string
  priceCents: number
  searches: number
  leads: number
}

// Créditos avulsos: usados só depois que a cota do mês acaba, e não expiram.
export const CREDIT_PACKS: CreditPack[] = [
  { id: 'buscas_20', name: '+20 buscas', priceCents: 1900, searches: 20, leads: 0 },
  { id: 'leads_100', name: '+100 leads', priceCents: 1900, searches: 0, leads: 100 },
  { id: 'combo_50_300', name: '+50 buscas e +300 leads', priceCents: 4900, searches: 50, leads: 300 },
]

export function getPlan(id: string | null | undefined): Plan | undefined {
  return PLANS.find((p) => p.id === id)
}

export function getCreditPack(id: string | null | undefined): CreditPack | undefined {
  return CREDIT_PACKS.find((p) => p.id === id)
}

/** Planos que cada tipo de conta pode ver e assinar. Os empresariais só aparecem para empresas. */
export function plansFor(accountType: AccountType): Plan[] {
  return PLANS.filter((p) => p.audience === 'all' || p.audience === accountType)
}

export function canSubscribe(plan: Plan, accountType: AccountType): boolean {
  return plan.priceCents > 0 && (plan.audience === 'all' || plan.audience === accountType)
}

export function formatBRL(cents: number): string {
  return (cents / 100).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
  })
}
