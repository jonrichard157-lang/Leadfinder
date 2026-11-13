'use client'

import { useState, type FormEvent } from 'react'
import Link from 'next/link'
import { Bot, Loader2, Lock, MapPin, Plus, Trash2, Wand2 } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Input, Label } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { agentAccessFor } from '@/lib/billing/catalog'
import { useUser } from '@/hooks/useUser'

// Tipos espelhados de src/lib/agent/plan.ts (que é server-only).
type Signal = 'exigir' | 'preferir' | 'indiferente'
interface Query {
  nicho: string
  local: string
  raioKm: number
}
interface SearchPlan {
  resumo: string
  oferta: string
  consultas: Query[]
  sinais: { semSite: Signal; notaMinima: number; minAvaliacoes: number; observacoes: string[] }
  perguntas: string[]
}

const EXAMPLES = [
  'Vendo sistema de agendamento online. Quero clínicas de estética e salões em Curitiba com muitas avaliações.',
  'Faço gestão de Instagram para restaurantes e cafeterias em Belo Horizonte que têm nota boa mas pouca divulgação.',
  'Ofereço contabilidade para pequenas empresas: busque academias e pet shops em Campinas, SP.',
]

const SIGNAL_LABEL: Record<Signal, string> = {
  exigir: 'Só sem site',
  preferir: 'Prefere sem site',
  indiferente: 'Tanto faz',
}

export function AgentPanel() {
  const { profile, loading: loadingUser } = useUser()
  const access = agentAccessFor(profile?.plan, profile?.role)

  const [request, setRequest] = useState('')
  const [location, setLocation] = useState('')
  const [plan, setPlan] = useState<SearchPlan | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/agent/plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ request, location }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Não foi possível montar o plano.')
      setPlan(data.plan)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível montar o plano.')
    } finally {
      setLoading(false)
    }
  }

  function updateQuery(i: number, patch: Partial<Query>) {
    setPlan((p) => p && { ...p, consultas: p.consultas.map((q, j) => (j === i ? { ...q, ...patch } : q)) })
  }

  function removeQuery(i: number) {
    setPlan((p) => p && { ...p, consultas: p.consultas.filter((_, j) => j !== i) })
  }

  function addQuery() {
    setPlan(
      (p) =>
        p && {
          ...p,
          consultas: [...p.consultas, { nicho: '', local: p.consultas[0]?.local ?? location, raioKm: 10 }],
        }
    )
  }

  if (loadingUser) {
    return (
      <Card className="mx-auto flex max-w-3xl items-center justify-center p-10 text-[var(--color-ink-500)]">
        <Loader2 className="animate-spin" size={20} />
      </Card>
    )
  }

  if (!access) {
    return (
      <Card className="mx-auto max-w-3xl p-6 text-center md:p-8">
        <Lock className="mx-auto text-[var(--color-signal-600)]" size={28} />
        <h2 className="mt-3 text-lg font-semibold text-[var(--color-ink-900)]">Agente de busca com IA</h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-[var(--color-ink-600)]">
          Descreva o que você vende e o agente escolhe os nichos, as cidades e os sinais de um bom cliente para
          você. Disponível nos planos Pro, Max e Agência.
        </p>
        <Link href="/app/assinatura" className="mt-5 inline-block">
          <Button>Ver planos</Button>
        </Link>
      </Card>
    )
  }

  const canAdd = plan && plan.consultas.length < access.maxQueries

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Card className="p-6 md:p-8">
        <form className="space-y-5" onSubmit={handleSubmit}>
          <div>
            <Label htmlFor="agent-request">O que você vende e quem você quer encontrar?</Label>
            <textarea
              id="agent-request"
              rows={4}
              maxLength={1500}
              required
              value={request}
              onChange={(e) => setRequest(e.target.value)}
              placeholder="Ex.: Vendo sistema de agendamento. Quero clínicas de estética em Curitiba com muitas avaliações."
              className="mt-1.5 w-full rounded-lg border border-[var(--color-ink-200)] bg-white px-3 py-2.5 text-sm text-[var(--color-ink-900)] outline-none transition-colors placeholder:text-[var(--color-ink-400)] focus:border-[var(--color-signal-500)] focus:ring-2 focus:ring-[var(--color-signal-100)]"
            />
            <div className="mt-2 flex flex-wrap gap-1.5">
              {EXAMPLES.map((ex) => (
                <button
                  type="button"
                  key={ex}
                  onClick={() => setRequest(ex)}
                  className="rounded-md border border-[var(--color-ink-200)] bg-[var(--color-ink-50)] px-2 py-0.5 text-left text-xs text-[var(--color-ink-700)] transition-colors hover:bg-[var(--color-signal-50)] hover:text-[var(--color-signal-700)]"
                >
                  {ex.split('.')[0]}
                </button>
              ))}
            </div>
          </div>

          <div>
            <Label htmlFor="agent-location">Local padrão (opcional)</Label>
            <Input
              id="agent-location"
              placeholder="Usado quando o pedido não cita cidade. Ex.: São Paulo, SP"
              icon={<MapPin size={16} />}
              value={location}
              onChange={(e) => setLocation(e.target.value)}
            />
          </div>

          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

          <Button
            type="submit"
            size="lg"
            fullWidth
            disabled={loading}
            icon={loading ? <Loader2 className="animate-spin" size={18} /> : <Wand2 size={18} />}
          >
            {loading ? 'Montando o plano…' : plan ? 'Montar o plano de novo' : 'Montar plano de busca'}
          </Button>
          <p className="text-center text-xs text-[var(--color-ink-500)]">
            Montar o plano não gasta busca. Seu plano permite até {access.maxQueries} consultas por pedido.
          </p>
        </form>
      </Card>

      {plan && (
        <Card className="space-y-5 p-6 md:p-8">
          <div className="flex items-start gap-3">
            <Bot size={20} className="mt-0.5 shrink-0 text-[var(--color-signal-600)]" />
            <div>
              <h2 className="font-semibold text-[var(--color-ink-900)]">Plano de busca</h2>
              <p className="mt-1 text-sm text-[var(--color-ink-600)]">{plan.resumo}</p>
            </div>
          </div>

          {plan.perguntas.length > 0 && (
            <div className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
              <p className="font-medium">O agente ficou com dúvidas. Complete o pedido e monte de novo:</p>
              <ul className="mt-1 list-disc pl-5">
                {plan.perguntas.map((q) => (
                  <li key={q}>{q}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="space-y-3">
            <p className="text-sm font-medium text-[var(--color-ink-800)]">Consultas no Google Maps</p>
            {plan.consultas.map((q, i) => (
              <div key={i} className="grid gap-2 rounded-lg border border-[var(--color-ink-200)] p-3 sm:grid-cols-[1fr_1fr_90px_auto]">
                <Input
                  aria-label="Nicho"
                  value={q.nicho}
                  placeholder="Nicho"
                  onChange={(e) => updateQuery(i, { nicho: e.target.value })}
                />
                <Input
                  aria-label="Local"
                  value={q.local}
                  placeholder="Cidade, UF"
                  onChange={(e) => updateQuery(i, { local: e.target.value })}
                />
                <Input
                  aria-label="Raio em km"
                  type="number"
                  min={1}
                  max={50}
                  value={q.raioKm}
                  onChange={(e) => updateQuery(i, { raioKm: Number(e.target.value) || 1 })}
                />
                <button
                  type="button"
                  onClick={() => removeQuery(i)}
                  aria-label="Remover consulta"
                  className="flex items-center justify-center rounded-md px-2 text-[var(--color-ink-400)] hover:bg-red-50 hover:text-red-600"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
            {canAdd && (
              <button
                type="button"
                onClick={addQuery}
                className="flex items-center gap-1.5 text-sm font-medium text-[var(--color-signal-700)] hover:underline"
              >
                <Plus size={14} /> Adicionar consulta
              </button>
            )}
          </div>

          <div className="grid gap-3 text-sm sm:grid-cols-3">
            <div className="rounded-lg bg-[var(--color-ink-50)] px-3 py-2">
              <p className="text-xs text-[var(--color-ink-500)]">Site</p>
              <p className="font-medium text-[var(--color-ink-900)]">{SIGNAL_LABEL[plan.sinais.semSite]}</p>
            </div>
            <div className="rounded-lg bg-[var(--color-ink-50)] px-3 py-2">
              <p className="text-xs text-[var(--color-ink-500)]">Nota mínima</p>
              <p className="font-medium text-[var(--color-ink-900)]">
                {plan.sinais.notaMinima > 0 ? `${plan.sinais.notaMinima} ⭐` : 'Qualquer'}
              </p>
            </div>
            <div className="rounded-lg bg-[var(--color-ink-50)] px-3 py-2">
              <p className="text-xs text-[var(--color-ink-500)]">Mínimo de avaliações</p>
              <p className="font-medium text-[var(--color-ink-900)]">{plan.sinais.minAvaliacoes || 'Qualquer'}</p>
            </div>
          </div>

          {plan.sinais.observacoes.length > 0 && (
            <div className="text-sm">
              <p className="font-medium text-[var(--color-ink-800)]">Sinais de bom cliente</p>
              <ul className="mt-1 list-disc pl-5 text-[var(--color-ink-600)]">
                {plan.sinais.observacoes.map((o) => (
                  <li key={o}>{o}</li>
                ))}
              </ul>
            </div>
          )}

          <Button size="lg" fullWidth disabled title="Disponível na próxima etapa">
            Executar busca (em breve)
          </Button>
        </Card>
      )}
    </div>
  )
}
