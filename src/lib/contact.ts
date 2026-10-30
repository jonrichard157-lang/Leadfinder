/**
 * Link do WhatsApp para celulares brasileiros (DDD + 9 + 8 dígitos).
 * Telefones fixos não recebem link: a maioria não tem WhatsApp.
 */
export function whatsappUrl(phone?: string): string | undefined {
  if (!phone) return undefined
  let digits = phone.replace(/\D/g, '')
  if (digits.length === 13 && digits.startsWith('55')) digits = digits.slice(2)
  if (digits.length !== 11 || digits[2] !== '9') return undefined
  return `https://wa.me/55${digits}`
}

const LINK_LABELS: Record<string, string> = {
  'instagram.com': 'Instagram',
  'facebook.com': 'Facebook',
  'fb.com': 'Facebook',
  'wa.me': 'WhatsApp',
  'whatsapp.com': 'WhatsApp',
  'tiktok.com': 'TikTok',
  'linktr.ee': 'Linktree',
}

/** Nome curto para o link do lead: "Instagram", "Facebook"… ou o domínio do site. */
export function linkLabel(url: string): string {
  try {
    const host = new URL(url).hostname.toLowerCase().replace(/^www\./, '')
    const known = Object.keys(LINK_LABELS).find((d) => host === d || host.endsWith(`.${d}`))
    return known ? LINK_LABELS[known] : host
  } catch {
    return 'Link'
  }
}
