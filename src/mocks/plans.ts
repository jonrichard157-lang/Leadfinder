import type { Plan } from '@/types'

export const PLANS: Plan[] = [
  {
    id: 'free',
    name: 'Grátis',
    price: 0,
    priceLabel: 'R$ 0',
    billingPeriod: 'mês',
    description: 'Para testar a plataforma e validar sua primeira lista de leads.',
    features: [
      '10 leads por mês',
      '1 busca salva',
      'Filtro "sem website"',
      'Exportação básica',
    ],
    ctaLabel: 'Começar grátis',
  },
  {
    id: 'pro',
    name: 'Pro',
    price: 97,
    priceLabel: 'R$ 97',
    billingPeriod: 'mês',
    description: 'Para freelancers e desenvolvedores que prospectam toda semana.',
    features: [
      '500 leads por mês',
      'Buscas ilimitadas',
      'Opportunity Score completo',
      'Exportação em CSV',
      'Histórico de leads salvos',
    ],
    highlighted: true,
    ctaLabel: 'Assinar Pro',
  },
  {
    id: 'agencia',
    name: 'Agência',
    price: 247,
    priceLabel: 'R$ 247',
    billingPeriod: 'mês',
    description: 'Para agências e equipes que gerenciam prospecção para vários clientes.',
    features: [
      'Leads ilimitados',
      'Múltiplos usuários',
      'Organização por cliente/projeto',
      'Exportação em CSV e integrações',
      'Suporte prioritário',
    ],
    ctaLabel: 'Assinar Agência',
  },
]
