import { calculateOpportunityScore } from '@/lib/scoring'
import type { Lead, SearchFilters } from '@/types'

interface LatLng {
  latitude: number
  longitude: number
}

interface RawGooglePlace {
  id?: string
  displayName?: { text?: string }
  formattedAddress?: string
  location?: LatLng
  nationalPhoneNumber?: string
  internationalPhoneNumber?: string
  websiteUri?: string
  rating?: number
  userRatingCount?: number
  primaryTypeDisplayName?: { text?: string }
}

interface Rectangle {
  rectangle: { low: LatLng; high: LatLng }
}

interface TextSearchQuery {
  textQuery: string
  locationRestriction?: Rectangle
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

// Cada requisição à Text Search é cobrada pelo Google (SKU Enterprise, por causa de telefone,
// site e avaliações) e traz até 20 empresas. MAX_REQUESTS limita o custo de uma busca.
const TARGET_RESULTS = 20
const MAX_REQUESTS = 6
const FIELD_MASK = [
  'places.id',
  'places.displayName',
  'places.formattedAddress',
  'places.location',
  'places.nationalPhoneNumber',
  'places.internationalPhoneNumber',
  'places.websiteUri',
  'places.rating',
  'places.userRatingCount',
  'places.primaryTypeDisplayName',
  'nextPageToken',
].join(',')

async function fetchTextSearchPage(
  apiKey: string,
  query: TextSearchQuery,
  pageToken?: string
): Promise<{ places: RawGooglePlace[]; nextPageToken?: string }> {
  const response = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': FIELD_MASK,
    },
    body: JSON.stringify({
      ...query,
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
  return { places: data.places || [], nextPageToken: data.nextPageToken }
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.floor(sorted.length / 2)]
}

/**
 * Divide um quadrado de lado 2 × radiusKm, centrado em `center`, em quatro regiões.
 * Buscar em cada região traz empresas que não aparecem nos 60 primeiros resultados da cidade.
 */
function quadrants(center: LatLng, radiusKm: number): Rectangle[] {
  const dLat = radiusKm / 111
  const dLng = radiusKm / (111 * Math.cos((center.latitude * Math.PI) / 180))
  const { latitude: lat, longitude: lng } = center

  return [
    [lat, lng - dLng, lat + dLat, lng],
    [lat, lng, lat + dLat, lng + dLng],
    [lat - dLat, lng - dLng, lat, lng],
    [lat - dLat, lng, lat, lng + dLng],
  ].map(([lowLat, lowLng, highLat, highLng]) => ({
    rectangle: {
      low: { latitude: lowLat, longitude: lowLng },
      high: { latitude: highLat, longitude: highLng },
    },
  }))
}

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

  const { city, state } = parseLocation(filters.location)

  const leads: Lead[] = []
  const seenIds = new Set<string>()
  const points: LatLng[] = []
  let requests = 0

  function collect(places: RawGooglePlace[]) {
    for (const p of places) {
      if (p.id) {
        if (seenIds.has(p.id)) continue
        seenIds.add(p.id)
      }
      if (p.location) points.push(p.location)

      const lead = toLead(p, filters, city, state)
      if (leads.length < TARGET_RESULTS && matchesFilters(lead, filters)) leads.push(lead)
    }
  }

  const hasEnough = () => leads.length >= TARGET_RESULTS || requests >= MAX_REQUESTS

  // 1. Busca na cidade inteira (até 3 páginas, o máximo que o Google devolve por consulta).
  const cityQuery: TextSearchQuery = { textQuery: `${categoryQuery} em ${filters.location}` }
  let pageToken: string | undefined
  for (let page = 0; page < 3 && !hasEnough(); page++) {
    const result = await fetchTextSearchPage(apiKey, cityQuery, pageToken)
    requests++
    collect(result.places)
    pageToken = result.nextPageToken
    if (!pageToken) break
  }

  // 2. O filtro "sem site" e a exigência de contato descartam boa parte das empresas. Se ainda
  //    faltam resultados, busca região por região ao redor do centro encontrado (raio do filtro),
  //    parando assim que atingir TARGET_RESULTS.
  if (!hasEnough() && points.length > 0) {
    const center = {
      latitude: median(points.map((p) => p.latitude)),
      longitude: median(points.map((p) => p.longitude)),
    }
    for (const locationRestriction of quadrants(center, filters.radiusKm)) {
      if (hasEnough()) break
      const result = await fetchTextSearchPage(apiKey, { textQuery: categoryQuery, locationRestriction })
      requests++
      collect(result.places)
    }
  }

  return leads
}

function toLead(p: RawGooglePlace, filters: SearchFilters, city: string, state: string): Lead {
  const hasWebsite = isOwnWebsite(p.websiteUri)
  const phone = p.nationalPhoneNumber || p.internationalPhoneNumber || undefined
  const rating = Number(p.rating) || 0
  const reviewsCount = Number(p.userRatingCount) || 0
  const category = p.primaryTypeDisplayName?.text || filters.category || 'Serviços'

  return {
    id: p.id ? `gp_${p.id}` : crypto.randomUUID(),
    name: p.displayName?.text || 'Empresa sem nome',
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
    opportunityScore: calculateOpportunityScore({ hasWebsite, rating, reviewsCount, phone, category }),
    status: 'novo',
    saved: false,
    source: 'google_places',
    foundAt: new Date().toISOString(),
  }
}

/**
 * Critérios do usuário. Empresas sem telefone nem link (site, Instagram, WhatsApp)
 * não servem para prospecção e ficam de fora.
 */
function matchesFilters(lead: Lead, filters: SearchFilters): boolean {
  if (!lead.phone && !lead.website) return false
  if (filters.onlyWithoutWebsite && lead.hasWebsite) return false
  if (filters.minRating > 0 && lead.rating < filters.minRating) return false
  if (filters.minReviews > 0 && lead.reviewsCount < filters.minReviews) return false
  return true
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

  // Três variações de cada nome para simular uma busca com TARGET_RESULTS empresas.
  const names = ['', ' Centro', ' Zona Sul'].flatMap((suffix) => sampleNames.map((n) => `${n}${suffix}`))

  const generated: Lead[] = names.map((name, i) => {
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

  return generated.filter((lead) => matchesFilters(lead, filters)).slice(0, TARGET_RESULTS)
}

