'use client'

import { Phone, MessageCircle, Link2, Globe, GlobeLock, Bookmark, ArrowUpRight } from 'lucide-react'
import type { Lead } from '@/types'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { OpportunityScore } from './OpportunityScore'
import { StatusBadge } from './StatusBadge'
import { linkLabel, whatsappUrl } from '@/lib/contact'
import { cn } from '@/lib/utils'

interface LeadCardProps {
  lead: Lead
  onToggleSave?: (id: string) => void
  onViewDetails?: (id: string) => void
}

// O card mostra só o necessário para entrar em contato; endereço, avaliações e anotações
// ficam na página de detalhes.
export function LeadCard({ lead, onToggleSave, onViewDetails }: LeadCardProps) {
  const whatsapp = whatsappUrl(lead.phone)

  return (
    <Card className="flex flex-col gap-4 p-5 transition-shadow hover:shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-base font-semibold text-[var(--color-ink-900)]">
            {lead.name}
          </p>
          <p className="mt-0.5 text-sm text-[var(--color-ink-500)]">{lead.category}</p>
        </div>
        <OpportunityScore score={lead.opportunityScore} />
      </div>

      <div className="flex flex-col gap-2 text-sm">
        {lead.phone ? (
          <div className="flex items-center justify-between gap-2">
            <a
              href={`tel:${lead.phone}`}
              className="inline-flex items-center gap-1.5 font-medium text-[var(--color-ink-900)] hover:text-[var(--color-signal-600)]"
            >
              <Phone size={14} className="text-[var(--color-ink-400)]" />
              {lead.phone}
            </a>
            {whatsapp && (
              <a
                href={whatsapp}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 rounded-md bg-[var(--color-green-100)] px-2 py-0.5 text-xs font-medium text-[var(--color-green-600)] hover:brightness-95"
              >
                <MessageCircle size={12} />
                WhatsApp
              </a>
            )}
          </div>
        ) : (
          <span className="inline-flex items-center gap-1.5 text-[var(--color-ink-400)]">
            <Phone size={14} />
            Sem telefone
          </span>
        )}
        {lead.website && (
          <a
            href={lead.website}
            target="_blank"
            rel="noreferrer"
            className="inline-flex min-w-0 items-center gap-1.5 text-[var(--color-signal-600)] hover:underline"
          >
            <Link2 size={14} className="shrink-0 text-[var(--color-ink-400)]" />
            <span className="truncate">{linkLabel(lead.website)}</span>
          </a>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {lead.hasWebsite ? (
          <Badge tone="neutral" icon={<Globe size={12} />}>
            Com website
          </Badge>
        ) : (
          <Badge tone="red" icon={<GlobeLock size={12} />}>
            Sem website
          </Badge>
        )}
        {lead.status !== 'novo' && <StatusBadge status={lead.status} />}
      </div>

      <div className="mt-auto flex items-center gap-2 border-t border-[var(--color-ink-100)] pt-4">
        <Button
          variant="secondary"
          size="sm"
          fullWidth
          icon={<Bookmark size={14} className={cn(lead.saved && 'fill-current')} />}
          onClick={() => onToggleSave?.(lead.id)}
        >
          {lead.saved ? 'Salvo' : 'Salvar'}
        </Button>
        <Button
          variant="primary"
          size="sm"
          fullWidth
          icon={<ArrowUpRight size={14} />}
          iconPosition="right"
          onClick={() => onViewDetails?.(lead.id)}
        >
          Ver detalhes
        </Button>
      </div>
    </Card>
  )
}
