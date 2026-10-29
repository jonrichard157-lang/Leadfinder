import type { Lead } from '@/types'

/**
 * Utilitário para exportar lista de leads em formato CSV (compatível com Excel/Google Sheets).
 * Adiciona BOM UTF-8 (\uFEFF) para garantir suporte perfeito a caracteres em português.
 */
export function exportLeadsToCsv(leads: Lead[], filename = 'orbelead-leads.csv') {
  if (!leads || leads.length === 0) {
    return false
  }

  const headers = [
    'Nome da Empresa',
    'Categoria',
    'Telefone',
    'Endereço',
    'Cidade',
    'Estado',
    'Tem Website?',
    'Website',
    'Avaliação',
    'Qtd Avaliações',
    'Opportunity Score',
    'Status de Prospecção',
    'Data de Encontro',
  ]

  function escapeCsvCell(val: unknown): string {
    if (val === null || val === undefined) return '""'
    const stringVal = String(val).replace(/"/g, '""')
    return `"${stringVal}"`
  }

  const rows = leads.map((lead) => [
    escapeCsvCell(lead.name),
    escapeCsvCell(lead.category),
    escapeCsvCell(lead.phone || 'Não informado'),
    escapeCsvCell(lead.address),
    escapeCsvCell(lead.city),
    escapeCsvCell(lead.state),
    escapeCsvCell(lead.hasWebsite ? 'Sim' : 'Não'),
    escapeCsvCell(lead.website || ''),
    escapeCsvCell(lead.rating ? lead.rating.toFixed(1) : '0.0'),
    escapeCsvCell(lead.reviewsCount || 0),
    escapeCsvCell(lead.opportunityScore || 0),
    escapeCsvCell(lead.status || 'novo'),
    escapeCsvCell(lead.foundAt || ''),
  ])

  const csvContent = '\uFEFF' + [headers.map((h) => `"${h}"`).join(','), ...rows.map((r) => r.join(','))].join('\r\n')

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.setAttribute('href', url)
  link.setAttribute('download', filename.endsWith('.csv') ? filename : `${filename}.csv`)
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)

  return true
}

