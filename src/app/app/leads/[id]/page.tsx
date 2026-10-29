'use client'

import { useEffect, useState, useTransition } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  ArrowLeft,
  MapPin,
  Phone,
  Star,
  Globe,
  GlobeLock,
  Bookmark,
  Loader2,
  Calendar,
  MessageSquare,
} from 'lucide-react'
import { AppLayout } from '@/components/layout/AppLayout'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Select } from '@/components/ui/Input'
import { OpportunityScore } from '@/components/leads/OpportunityScore'
import { StatusBadge } from '@/components/leads/StatusBadge'
import { useUser } from '@/hooks/useUser'
import { getLeadById, toggleSaveLead, updateLeadStatus, addLeadNote } from '@/lib/services/leads'
import type { Lead, LeadStatus } from '@/types'
import { formatDate } from '@/lib/utils'

const STATUS_OPTIONS: { id: LeadStatus; label: string }[] = [
  { id: 'novo', label: 'Novo' },
  { id: 'contatado', label: 'Contatado' },
  { id: 'em_negociacao', label: 'Em negociação' },
  { id: 'convertido', label: 'Convertido' },
  { id: 'descartado', label: 'Descartado' },
]

export default function LeadDetailPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const { user } = useUser()

  const [lead, setLead] = useState<Lead | null>(null)
  const [loading, setLoading] = useState(true)
  const [noteContent, setNoteContent] = useState('')
  const [savingNote, setSavingNote] = useState(false)
  const [, startTransition] = useTransition()

  useEffect(() => {
    async function loadLead() {
      if (!params?.id) return
      setLoading(true)
      try {
        const found = await getLeadById(params.id, user?.id)
        setLead(found)
      } finally {
        setLoading(false)
      }
    }

    loadLead()
  }, [params?.id, user?.id])

  async function handleStatusChange(newStatus: LeadStatus) {
    if (!lead) return
    setLead((prev) => (prev ? { ...prev, status: newStatus } : null))

    if (user) {
      startTransition(async () => {
        // Se ainda não estava salvo, salva com o novo status
        if (!lead.saved) {
          const res = await toggleSaveLead(user.id, { ...lead, status: newStatus })
          if (res.error) {
            setLead((prev) => (prev ? { ...prev, status: lead.status } : null))
            window.alert(res.error)
          } else {
            setLead((prev) => (prev ? { ...prev, id: res.lead.id, saved: true } : null))
          }
        } else {
          await updateLeadStatus(user.id, lead.id, newStatus)
        }
      })
    }
  }

  async function handleToggleSave() {
    if (!lead || !user) return
    const newSaved = !lead.saved

    setLead((prev) => (prev ? { ...prev, saved: newSaved } : null))

    startTransition(async () => {
      const res = await toggleSaveLead(user.id, lead)
      if (res.error) {
        setLead((prev) => (prev ? { ...prev, saved: res.saved } : null))
        window.alert(res.error)
      }
    })
  }

  async function handleAddNote() {
    if (!lead || !user || !noteContent.trim()) return
    setSavingNote(true)

    try {
      // Se o lead ainda não estava salvo, garante o salvamento primeiro
      let leadId = lead.id
      if (!lead.saved) {
        const res = await toggleSaveLead(user.id, lead)
        if (res.error) {
          window.alert(res.error)
          return
        }
        leadId = res.lead.id
      }

      const updatedNotes = await addLeadNote(user.id, leadId, noteContent.trim())
      setLead((prev) => (prev ? { ...prev, id: leadId, notes: updatedNotes, saved: true } : null))
      setNoteContent('')
    } finally {
      setSavingNote(false)
    }
  }

  if (loading) {
    return (
      <AppLayout title="Detalhes do Lead">
        <div className="flex flex-col items-center justify-center py-24 text-[var(--color-ink-400)]">
          <Loader2 size={32} className="animate-spin text-[var(--color-signal-600)]" />
          <p className="mt-3 text-sm">Carregando informações do lead...</p>
        </div>
      </AppLayout>
    )
  }

  if (!lead) {
    return (
      <AppLayout title="Lead Não Encontrado">
        <div className="mx-auto max-w-xl text-center py-16">
          <p className="text-lg font-semibold text-[var(--color-ink-900)]">Empresa não encontrada</p>
          <p className="mt-2 text-sm text-[var(--color-ink-500)]">
            O lead solicitado não existe ou foi removido.
          </p>
          <div className="mt-6">
            <Button onClick={() => router.push('/app/meus-leads')}>Voltar para Meus Leads</Button>
          </div>
        </div>
      </AppLayout>
    )
  }

  return (
    <AppLayout title="Detalhes do Lead">
      <div className="mx-auto max-w-3xl">
        <Button variant="ghost" size="sm" icon={<ArrowLeft size={16} />} onClick={() => router.back()}>
          Voltar
        </Button>

        <Card className="mt-4 p-6 md:p-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="font-display text-2xl font-semibold text-[var(--color-ink-900)]">
                {lead.name}
              </h2>
              <p className="mt-1 text-[var(--color-ink-500)]">{lead.category}</p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
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
            </div>
            <div className="flex flex-col items-center gap-1">
              <OpportunityScore score={lead.opportunityScore} size="md" />
              <span className="text-xs text-[var(--color-ink-500)]">Score</span>
            </div>
          </div>

          <div className="mt-6 grid gap-4 border-t border-[var(--color-ink-100)] pt-6 sm:grid-cols-2">
            <div className="flex items-start gap-3">
              <MapPin size={16} className="mt-0.5 text-[var(--color-ink-400)] shrink-0" />
              <div>
                <p className="text-sm text-[var(--color-ink-900)]">{lead.address}</p>
                <p className="text-sm text-[var(--color-ink-500)]">
                  {lead.city}, {lead.state}
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Phone size={16} className="mt-0.5 text-[var(--color-ink-400)] shrink-0" />
              <p className="text-sm text-[var(--color-ink-900)]">
                {lead.phone ? (
                  <a
                    href={`tel:${lead.phone}`}
                    className="text-[var(--color-signal-600)] hover:underline"
                  >
                    {lead.phone}
                  </a>
                ) : (
                  'Telefone não disponível'
                )}
              </p>
            </div>
            <div className="flex items-start gap-3">
              <Star size={16} className="mt-0.5 text-[var(--color-amber-500)] shrink-0" />
              <p className="text-sm text-[var(--color-ink-900)]">
                {lead.rating.toFixed(1)} de avaliação ({lead.reviewsCount} avaliações)
              </p>
            </div>
            <div className="flex items-start gap-3">
              {lead.hasWebsite ? (
                <Globe size={16} className="mt-0.5 text-[var(--color-ink-400)] shrink-0" />
              ) : (
                <GlobeLock size={16} className="mt-0.5 text-[var(--color-red-600)] shrink-0" />
              )}
              <p className="text-sm text-[var(--color-ink-900)]">
                {lead.website ? (
                  <a
                    href={lead.website}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[var(--color-signal-600)] hover:underline"
                  >
                    {lead.website}
                  </a>
                ) : (
                  'Nenhum website encontrado'
                )}
              </p>
            </div>
          </div>

          <div className="mt-6 flex flex-col gap-4 border-t border-[var(--color-ink-100)] pt-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="sm:w-56">
              <label className="mb-1.5 block text-sm font-medium text-[var(--color-ink-700)]">
                Status no Funil
              </label>
              <Select
                value={lead.status}
                onChange={(e) => handleStatusChange(e.target.value as LeadStatus)}
              >
                {STATUS_OPTIONS.map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {opt.label}
                  </option>
                ))}
              </Select>
            </div>
            <Button
              variant="secondary"
              icon={<Bookmark size={16} className={lead.saved ? 'fill-current' : ''} />}
              onClick={handleToggleSave}
            >
              {lead.saved ? 'Remover dos salvos' : 'Salvar lead'}
            </Button>
          </div>

          <p className="mt-4 text-xs text-[var(--color-ink-400)]">
            Encontrado em {formatDate(lead.foundAt)}
          </p>
        </Card>

        {/* Histórico e Formulário de Anotações */}
        <Card className="mt-6 p-6 md:p-8">
          <div className="flex items-center gap-2">
            <MessageSquare size={18} className="text-[var(--color-signal-600)]" />
            <h3 className="text-base font-semibold text-[var(--color-ink-900)]">
              Anotações & Histórico de Contato
            </h3>
          </div>
          <p className="mt-1 text-sm text-[var(--color-ink-500)]">
            Registre conversas pelo WhatsApp, ligações, propostas enviadas e acordos.
          </p>

          <div className="mt-4">
            <textarea
              className="w-full rounded-lg border border-[var(--color-ink-200)] p-3 text-sm focus:border-[var(--color-signal-500)] focus:outline-none"
              rows={3}
              placeholder="Ex: Entrei em contato via WhatsApp com o dono, pediu retorno na próxima sexta..."
              value={noteContent}
              onChange={(e) => setNoteContent(e.target.value)}
              disabled={savingNote}
            />
            <div className="mt-2 flex justify-end">
              <Button
                size="sm"
                disabled={!noteContent.trim() || savingNote}
                onClick={handleAddNote}
              >
                {savingNote ? (
                  <span className="flex items-center gap-2">
                    <Loader2 size={14} className="animate-spin" />
                    Salvando anotação...
                  </span>
                ) : (
                  'Adicionar anotação'
                )}
              </Button>
            </div>
          </div>

          {/* Lista de anotações anteriores */}
          {lead.notes && lead.notes.length > 0 && (
            <div className="mt-6 space-y-3 border-t border-[var(--color-ink-100)] pt-6">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-[var(--color-ink-500)]">
                Histórico ({lead.notes.length})
              </h4>
              <div className="space-y-3">
                {lead.notes.map((n) => (
                  <div
                    key={n.id}
                    className="rounded-lg border border-[var(--color-ink-100)] bg-[var(--color-ink-50)]/60 p-3.5"
                  >
                    <p className="text-sm text-[var(--color-ink-800)] whitespace-pre-wrap">
                      {n.content}
                    </p>
                    <div className="mt-2 flex items-center gap-1.5 text-[11px] text-[var(--color-ink-400)]">
                      <Calendar size={12} />
                      <span>{formatDate(n.createdAt)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>
      </div>
    </AppLayout>
  )
}
