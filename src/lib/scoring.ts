interface OpportunityScoreParams {
  hasWebsite: boolean
  rating?: number | null
  reviewsCount?: number | null
  phone?: string | null
  category?: string | null
}

/**
 * Calcula o Opportunity Score (0 a 100) para um lead comercial.
 * Quanto maior o score, maior a probabilidade de a empresa necessitar
 * de serviços de desenvolvimento de sites, presença digital e marketing.
 */
export function calculateOpportunityScore({
  hasWebsite,
  rating = 0,
  reviewsCount = 0,
  phone,
}: OpportunityScoreParams): number {
  let score = 50 // Pontuação base intermediária

  // 1. Sinal Principal: Presença ou Ausência de Website (Peso: ±35 pts)
  if (!hasWebsite) {
    score += 35 // Empresa sem site é o público-alvo ideal
  } else {
    score -= 30 // Já possui presença web
  }

  const numRating = Number(rating) || 0
  const numReviews = Number(reviewsCount) || 0

  // 2. Qualidade e Reputação da Empresa (Peso: +10 a -10 pts)
  if (numRating >= 4.5) {
    score += 10
  } else if (numRating >= 4.0) {
    score += 6
  } else if (numRating > 0 && numRating < 3.5) {
    score -= 8
  }

  // 3. Volume de Avaliações / Tração do Negócio (Peso: +10 a -10 pts)
  if (numReviews >= 50) {
    score += 12 // Empresa altamente ativa, com fluxo e capacidade de investimento
  } else if (numReviews >= 20) {
    score += 8
  } else if (numReviews >= 5) {
    score += 4
  } else if (numReviews === 0) {
    score -= 8 // Poucos indícios de operação
  }

  // 4. Facilidade de Contato / Prospecção Direta
  if (phone && phone.trim().length >= 8) {
    score += 5 // Possui telefone/WhatsApp para contato imediato
  }

  // Garante que o score fique sempre estritamente no intervalo [0, 100]
  return Math.max(0, Math.min(100, Math.round(score)))
}

