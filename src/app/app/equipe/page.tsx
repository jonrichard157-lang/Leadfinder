'use client'

import { useEffect, useState, type FormEvent } from 'react'
import { Copy, Check, KeyRound, Loader2, ShieldAlert, UserMinus, Ban } from 'lucide-react'
import { AppLayout } from '@/components/layout/AppLayout'
import { Card } from '@/components/ui/Card'
import { Input, Label } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { useUser } from '@/hooks/useUser'
import { formatDate } from '@/lib/utils'
import {
  createTeamCode,
  getTeamOverview,
  removeTeamMember,
  revokeTeamCode,
  type CreatedTeamCode,
  type TeamCode,
  type TeamMember,
} from '@/lib/services/team'

function codeStatus(code: TeamCode): { label: string; tone: 'green' | 'neutral' | 'red' } {
  if (code.revoked_at) return { label: 'Revogado', tone: 'red' }
  if (new Date(code.expires_at) < new Date()) return { label: 'Expirado', tone: 'neutral' }
  if (code.uses >= code.max_uses) return { label: 'Esgotado', tone: 'neutral' }
  return { label: 'Ativo', tone: 'green' }
}

export default function TeamPage() {
  const { user, isAdmin, loading: userLoading } = useUser()

  const [codes, setCodes] = useState<TeamCode[]>([])
  const [members, setMembers] = useState<TeamMember[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [label, setLabel] = useState('')
  const [maxUses, setMaxUses] = useState(1)
  const [validDays, setValidDays] = useState(7)
  const [creating, setCreating] = useState(false)
  const [createdCode, setCreatedCode] = useState<CreatedTeamCode | null>(null)
  const [copied, setCopied] = useState(false)

  const [reloadKey, setReloadKey] = useState(0)
  const reload = () => setReloadKey((k) => k + 1)

  useEffect(() => {
    if (!isAdmin) return
    let cancelled = false

    getTeamOverview()
      .then((data) => {
        if (cancelled) return
        setCodes(data.codes)
        setMembers(data.members)
        setError(null)
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Erro ao carregar a equipe.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [isAdmin, reloadKey])

  async function handleCreate(e: FormEvent) {
    e.preventDefault()
    setCreating(true)
    setCopied(false)
    try {
      const created = await createTeamCode(label, maxUses, validDays)
      setCreatedCode(created)
      setLabel('')
      reload()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao gerar código.')
    } finally {
      setCreating(false)
    }
  }

  async function handleCopy() {
    if (!createdCode) return
    await navigator.clipboard.writeText(createdCode.code)
    setCopied(true)
  }

  async function handleRevoke(codeId: string) {
    if (!window.confirm('Revogar este código? Quem ainda não usou não poderá mais usá-lo.')) return
    try {
      await revokeTeamCode(codeId)
      reload()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao revogar código.')
    }
  }

  async function handleRemoveMember(member: TeamMember) {
    if (!window.confirm(`Remover o acesso de equipe de ${member.full_name || member.email}?`)) return
    try {
      await removeTeamMember(member.id)
      reload()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao remover membro.')
    }
  }

  if (!userLoading && !isAdmin) {
    return (
      <AppLayout title="Equipe" subtitle="Acesso restrito">
        <Card className="mx-auto max-w-lg p-8 text-center">
          <ShieldAlert size={32} className="mx-auto text-[var(--color-ink-400)]" />
          <p className="mt-3 font-medium text-[var(--color-ink-800)]">Apenas administradores podem gerenciar a equipe.</p>
        </Card>
      </AppLayout>
    )
  }

  return (
    <AppLayout title="Equipe" subtitle="Libere o acesso da equipe de desenvolvimento com códigos de verificação">
      <div className="mx-auto flex max-w-3xl flex-col gap-6">
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>
        )}

        <Card className="p-6">
          <h2 className="text-base font-semibold text-[var(--color-ink-900)]">Gerar código de acesso</h2>
          <p className="mt-1 text-sm text-[var(--color-ink-600)]">
            Envie o código para a pessoa da equipe. Ela cria uma conta normal e informa o código em
            Configurações → Acesso da equipe. O código aparece só uma vez.
          </p>

          <form onSubmit={handleCreate} className="mt-5 grid gap-4 sm:grid-cols-[2fr_1fr_1fr_auto] sm:items-end">
            <div>
              <Label htmlFor="code-label">Identificação</Label>
              <Input
                id="code-label"
                placeholder="Ex.: Ana — front-end"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                maxLength={60}
              />
            </div>
            <div>
              <Label htmlFor="code-uses">Usos</Label>
              <Input
                id="code-uses"
                type="number"
                min={1}
                max={100}
                value={maxUses}
                onChange={(e) => setMaxUses(Number(e.target.value))}
              />
            </div>
            <div>
              <Label htmlFor="code-days">Validade (dias)</Label>
              <Input
                id="code-days"
                type="number"
                min={1}
                max={365}
                value={validDays}
                onChange={(e) => setValidDays(Number(e.target.value))}
              />
            </div>
            <Button type="submit" disabled={creating} icon={creating ? <Loader2 size={16} className="animate-spin" /> : <KeyRound size={16} />}>
              Gerar
            </Button>
          </form>

          {createdCode && (
            <div className="mt-5 rounded-lg border border-[var(--color-signal-100)] bg-[var(--color-signal-50)] p-4">
              <p className="text-xs font-medium text-[var(--color-signal-700)]">
                Copie agora — por segurança, este código não será exibido novamente.
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-3">
                <code className="font-mono text-lg font-semibold tracking-wider text-[var(--color-ink-900)]">
                  {createdCode.code}
                </code>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={handleCopy}
                  icon={copied ? <Check size={14} /> : <Copy size={14} />}
                >
                  {copied ? 'Copiado' : 'Copiar'}
                </Button>
              </div>
              <p className="mt-2 text-xs text-[var(--color-ink-600)]">
                {createdCode.max_uses} {createdCode.max_uses === 1 ? 'uso' : 'usos'} · válido até{' '}
                {formatDate(createdCode.expires_at)}
              </p>
            </div>
          )}
        </Card>

        <Card className="p-6">
          <h2 className="text-base font-semibold text-[var(--color-ink-900)]">Membros da equipe</h2>
          {loading ? (
            <Loader2 size={20} className="mt-4 animate-spin text-[var(--color-ink-400)]" />
          ) : members.length === 0 ? (
            <p className="mt-3 text-sm text-[var(--color-ink-500)]">Nenhum membro ainda.</p>
          ) : (
            <ul className="mt-3 divide-y divide-[var(--color-ink-100)]">
              {members.map((member) => (
                <li key={member.id} className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-[var(--color-ink-900)]">
                      {member.full_name || member.email}
                    </p>
                    <p className="truncate text-xs text-[var(--color-ink-500)]">{member.email}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Badge tone={member.role === 'admin' ? 'signal' : 'green'}>
                      {member.role === 'admin' ? 'Admin' : 'Equipe'}
                    </Badge>
                    {member.role === 'team' && member.id !== user?.id && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveMember(member)}
                        icon={<UserMinus size={14} />}
                        aria-label={`Remover ${member.email}`}
                      />
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="p-6">
          <h2 className="text-base font-semibold text-[var(--color-ink-900)]">Códigos gerados</h2>
          {loading ? (
            <Loader2 size={20} className="mt-4 animate-spin text-[var(--color-ink-400)]" />
          ) : codes.length === 0 ? (
            <p className="mt-3 text-sm text-[var(--color-ink-500)]">Nenhum código gerado ainda.</p>
          ) : (
            <ul className="mt-3 divide-y divide-[var(--color-ink-100)]">
              {codes.map((code) => {
                const status = codeStatus(code)
                return (
                  <li key={code.id} className="flex items-center justify-between gap-3 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-[var(--color-ink-900)]">
                        <span className="font-mono">…{code.hint}</span>
                        {code.label && <span className="text-[var(--color-ink-600)]"> · {code.label}</span>}
                      </p>
                      <p className="text-xs text-[var(--color-ink-500)]">
                        {code.uses}/{code.max_uses} usos · expira em {formatDate(code.expires_at)}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <Badge tone={status.tone}>{status.label}</Badge>
                      {status.label === 'Ativo' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRevoke(code.id)}
                          icon={<Ban size={14} />}
                          aria-label="Revogar código"
                        />
                      )}
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </Card>
      </div>
    </AppLayout>
  )
}
