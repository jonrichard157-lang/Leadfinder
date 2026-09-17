'use client'

import { Star, MapPin, Globe, GlobeLock, Bookmark, ArrowUpRight } from 'lucide-react'
import type { Lead } from '@/types'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { OpportunityScore } from './OpportunityScore'
import { StatusBadge } from './StatusBadge'
import { cn } from '@/lib/utils'

interface LeadCardProps {
  lead: Lead
  onToggleSave?: (id: string) => void
  onViewDetails?: (id: string) => void
}

export function LeadCard({ lead, onToggleSave, onViewDetails }: LeadCardProps) {
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

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-[var(--color-ink-600)]">
        <span className="inline-flex items-center gap-1.5">
          <MapPin size={14} className="text-[var(--color-ink-400)]" />
          {lead.city}, {lead.state}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Star size={14} className="fill-[var(--color-amber-500)] text-[var(--color-amber-500)]" />
          {lead.rating.toFixed(1)}
          <span className="text-[var(--color-ink-400)]">({lead.reviewsCount})</span>
        </span>
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
        {lead.opportunityScore >= 75 && <Badge tone="amber">Alta oportunidade</Badge>}
        <StatusBadge status={lead.status} />
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
