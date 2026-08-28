import type { LeadStatus } from '@/types'
import { Badge } from '@/components/ui/Badge'

const STATUS_CONFIG: Record<LeadStatus, { label: string; tone: 'neutral' | 'signal' | 'amber' | 'green' | 'red' }> = {
  novo: { label: 'Novo', tone: 'signal' },
  contatado: { label: 'Contatado', tone: 'amber' },
  em_negociacao: { label: 'Em negociação', tone: 'amber' },
  convertido: { label: 'Convertido', tone: 'green' },
  descartado: { label: 'Descartado', tone: 'red' },
}

export function StatusBadge({ status }: { status: LeadStatus }) {
  const config = STATUS_CONFIG[status]
  return <Badge tone={config.tone}>{config.label}</Badge>
}
