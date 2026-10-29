import { calculateOpportunityScore } from '@/lib/scoring'
import type { Lead, SearchFilters } from '@/types'

interface RawGooglePlace {
  id?: string
  displayName?: { text?: string }
  formattedAddress?: string
  nationalPhoneNumber?: string
  internationalPhoneNumber?: string
  websiteUri?: string
  rating?: number
  userRatingCount?: number
  primaryTypeDisplayName?: { text?: string }
}

// O Google aceita redes sociais, links de WhatsApp e páginas de apps de agendamento como
// "website". Para prospecção, esses negócios ainda não têm site próprio.
const NON_WEBSITE_HOSTS = [
  'instagram.com',
  'facebook.com',
  'fb.com',
  'tiktok.com',
  'youtube.com',
  'x.com',
  'twitter.com',
  'linkedin.com',
  'wa.me',
  'whatsapp.com',
  'linktr.ee',
  'beacons.ai',
  'bio.link',
  'canva.com',
  'canva.site',
  'ifood.com.br',
  'avec.app',
  'belasis.app',
  'booksy.com',
  'trinks.com',
]

function isOwnWebsite(url?: string): boolean {
  if (!url) return false
  try {
    const { protocol, hostname } = new URL(url)
    if (!protocol.startsWith('http')) return false
    const host = hostname.toLowerCase().replace(/^www\./, '')
    return !NON_WEBSITE_HOSTS.some((d) => host === d || host.endsWith(`.${d}`))
  } catch {
    return false
  }
}

/**
 * Normaliza uma string de cidade e estado para formato padrão (ex: "Curitiba, PR").
 */
function parseLocation(locationString: string): { city: string; state: string } {
  const parts = locationString.split(',').map((p) => p.trim())
  if (parts.length >= 2) {
    return { city: parts[0], state: parts[1].toUpperCase() }
  }
  return { city: locationString.trim(), state: 'BR' }
}

// Cada página da Text Search é uma requisição cobrada pelo Google (até 20 resultados cada).
const MAX_PAGES = 3
const TARGET_RESULTS = 20

/**
 * Busca empresas locais usando a Google Places API (New).
 * Sem GOOGLE_PLACES_API_KEY, usa dados simulados apenas em desenvolvimento.
 */
export async function searchLocalPlaces(filters: SearchFilters): Promise<Lead[]> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY

  if (!apiKey) {
    if (process.env.NODE_ENV !== 'production') {
      return generateContextualLeads(filters)
    }
    throw new Error('Busca indisponível: a chave da Google Places API não está configurada.')
  }

  const categoryQuery =
    filters.category && filters.category !== 'Todas as categorias'
      ? filters.category
      : 'comércios e serviços'

  const textQuery = `${categoryQuery} em ${filters.location}`
  const { city, state } = parseLocation(filters.location)

  const leads: Lead[] = []
  let pageToken: string | undefined

  // Como o filtro "sem site" descarta boa parte dos resultados, busca mais páginas até
  // atingir TARGET_RESULTS ou acabar a paginação.
  for (let page = 0; page < MAX_PAGES; page++) {
    const response = await fetch('https://places.googleapis.com/v1/places:searchText', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask':
          'places.id,places.displayName,places.formattedAddress,places.nationalPhoneNumber,places.internationalPhoneNumber,places.websiteUri,places.rating,places.userRatingCount,places.primaryTypeDisplayName,nextPageToken',
      },
      body: JSON.stringify({
        textQuery,
        languageCode: 'pt-BR',
        regionCode: 'BR',
        pageSize: 20,
        pageToken,
      }),
    })

    if (!response.ok) {
      console.error('Google Places API retornou erro:', response.status, await response.text())
      throw new Error('Não foi possível consultar o Google Places. Tente novamente em instantes.')
    }

    const data = await response.json()
    const places: RawGooglePlace[] = data.places || []

    const mappedLeads: Lead[] = places.map((p, idx) => {
      const hasWebsite = isOwnWebsite(p.websiteUri)
      const phone = p.nationalPhoneNumber || p.internationalPhoneNumber || undefined
      const rating = Number(p.rating) || 0
      const reviewsCount = Number(p.userRatingCount) || 0
      const name = p.displayName?.text || `Empresa ${idx + 1}`
      const category = p.primaryTypeDisplayName?.text || filters.category || 'Serviços'

      const opportunityScore = calculateOpportunityScore({
        hasWebsite,
        rating,
        reviewsCount,
        phone,
        category,
      })

      return {
        id: p.id ? `gp_${p.id}` : crypto.randomUUID(),
        name,
        category,
        address: p.formattedAddress || filters.location,
        city,
        state,
        phone,
        hasWebsite,
        // Mantém Instagram/WhatsApp mesmo sem site próprio: é um canal de contato com o lead.
        website: p.websiteUri || undefined,
        rating,
        reviewsCount,
        opportunityScore,
        status: 'novo',
        saved: false,
        source: 'google_places',
        foundAt: new Date().toISOString(),
      }
    })

    // Aplica os filtros solicitados pelo usuário
    leads.push(...filterLeads(mappedLeads, filters))

    pageToken = data.nextPageToken
    if (!pageToken || leads.length >= TARGET_RESULTS) break
  }

  return leads
}

/**
 * Filtra leads de acordo com os critérios do usuário.
 */
function filterLeads(leads: Lead[], filters: SearchFilters): Lead[] {
  return leads.filter((lead) => {
    if (filters.onlyWithoutWebsite && lead.hasWebsite) return false
    if (filters.minRating > 0 && lead.rating < filters.minRating) return false
    if (filters.minReviews > 0 && lead.reviewsCount < filters.minReviews) return false
    return true
  })
}

/**
 * Gerador de leads contextuais realistas para qualquer cidade/nicho do Brasil
 * quando em modo de desenvolvimento ou sem chave do Google.
 */
function generateContextualLeads(filters: SearchFilters): Lead[] {
  const { city, state } = parseLocation(filters.location || 'Curitiba, PR')
  const baseCategory =
    filters.category && filters.category !== 'Todas as categorias'
      ? filters.category
      : 'Serviços Locais'

  const sampleNames = [
    `${baseCategory} Central`,
    `Espaço ${baseCategory} Prime`,
    `Studio & ${baseCategory} Excelência`,
    `${baseCategory} Nova Era`,
    `Centro de ${baseCategory} São José`,
    `${baseCategory} Líder`,
    `Oficial ${baseCategory}`,
    `${baseCategory} & Cia`,
    `Boutique do ${baseCategory}`,
    `Grupo ${baseCategory} Regional`,
    `${baseCategory} Express`,
    `${baseCategory} Avenida`,
  ]

  const streets = [
    'Rua das Flores',
    'Av. Brasil',
    'Rua Sete de Setembro',
    'Av. Getúlio Vargas',
    'Rua Marechal Deodoro',
    'Rua XV de Novembro',
    'Av. Central',
    'Rua Tiradentes',
    'Av. dos Estados',
    'Rua Bela Vista',
    'Av. Independência',
    'Rua Santa Catarina',
  ]

  const generated: Lead[] = sampleNames.map((name, i) => {
    // 70% das empresas geradas sem site para atender o foco do SaaS
    const hasWebsite = i % 3 === 0
    const rating = Number((3.8 + (i % 12) * 0.1).toFixed(1))
    const reviewsCount = Math.floor(15 + (i * 17) % 180)
    const phone = `(${state === 'PR' ? '41' : state === 'SP' ? '11' : state === 'MG' ? '31' : '47'}) 9${Math.floor(1000 + Math.random() * 9000)}-${Math.floor(1000 + Math.random() * 9000)}`
    const address = `${streets[i % streets.length]}, ${100 + i * 85}`

    const opportunityScore = calculateOpportunityScore({
      hasWebsite,
      rating,
      reviewsCount,
      phone,
      category: baseCategory,
    })

    return {
      id: `dev_${city.toLowerCase().replace(/[^a-z0-9]/g, '')}_${i + 1}`,
      name,
      category: baseCategory,
      address,
      city,
      state,
      phone,
      hasWebsite,
      website: hasWebsite ? `https://${name.toLowerCase().replace(/[^a-z0-9]/g, '')}.com.br` : undefined,
      rating,
      reviewsCount,
      opportunityScore,
      status: 'novo',
      saved: false,
      source: 'google_places',
      foundAt: new Date().toISOString(),
    }
  })

  return filterLeads(generated, filters)
}

