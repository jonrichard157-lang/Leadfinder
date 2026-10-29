'use client'

import { useState, type FormEvent } from 'react'
import Link from 'next/link'
import { CheckCircle2, AlertCircle, Loader2, ShieldCheck, KeyRound } from 'lucide-react'
import { AppLayout } from '@/components/layout/AppLayout'
import { Card } from '@/components/ui/Card'
import { Input, Label } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils'
import { useUser } from '@/hooks/useUser'
import { supabase } from '@/lib/supabase'
import { redeemTeamCode } from '@/lib/services/team'

const TABS = [
  { id: 'perfil', label: 'Perfil' },
  { id: 'senha', label: 'Senha' },
  { id: 'notificacoes', label: 'Notificações' },
  { id: 'equipe', label: 'Acesso da equipe' },
] as const

type TabId = (typeof TABS)[number]['id']

export default function SettingsPage() {
  const { user, profile, initials, isTeam, isAdmin, refreshProfile } = useUser()
  const [activeTab, setActiveTab] = useState<TabId>('perfil')

  // Profile form state
  const [name, setName] = useState('')
  const [company, setCompany] = useState('')
  const [profileLoading, setProfileLoading] = useState(false)
  const [profileSuccess, setProfileSuccess] = useState(false)
  const [profileError, setProfileError] = useState<string | null>(null)

  // Team access state
  const [teamCode, setTeamCode] = useState('')
  const [teamLoading, setTeamLoading] = useState(false)
  const [teamMessage, setTeamMessage] = useState<{ ok: boolean; text: string } | null>(null)

  // Password form state
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordLoading, setPasswordLoading] = useState(false)
  const [passwordSuccess, setPasswordSuccess] = useState(false)
  const [passwordError, setPasswordError] = useState<string | null>(null)

  // Sincroniza o formulário quando o perfil/usuário carrega (ajuste de estado durante o render,
  // em vez de setState dentro de useEffect).
  const syncKey = profile
    ? `profile:${profile.id}:${profile.full_name ?? ''}:${profile.company ?? ''}`
    : user
      ? `user:${user.id}`
      : null
  const [syncedKey, setSyncedKey] = useState<string | null>(null)
  if (syncKey !== syncedKey) {
    setSyncedKey(syncKey)
    if (profile) {
      setName(profile.full_name || '')
      setCompany(profile.company || '')
    } else if (user) {
      setName(user.user_metadata?.full_name || '')
    }
  }

  async function handleSaveProfile(e: FormEvent) {
    e.preventDefault()
    if (!user) return

    setProfileLoading(true)
    setProfileError(null)
    setProfileSuccess(false)

    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: name,
          company: company || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id)

      if (error) throw error

      await supabase.auth.updateUser({
        data: { full_name: name },
      })

      setProfileSuccess(true)
      refreshProfile()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao atualizar perfil.'
      setProfileError(msg)
    } finally {
      setProfileLoading(false)
    }
  }

  async function handleUpdatePassword(e: FormEvent) {
    e.preventDefault()
    setPasswordError(null)
    setPasswordSuccess(false)

    if (newPassword.length < 6) {
      setPasswordError('A nova senha deve ter pelo menos 6 caracteres.')
      return
    }

    if (newPassword !== confirmPassword) {
      setPasswordError('A confirmação de senha não coincide com a nova senha.')
      return
    }

    setPasswordLoading(true)

    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      })

      if (error) throw error

      setPasswordSuccess(true)
      setNewPassword('')
      setConfirmPassword('')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao atualizar senha.'
      setPasswordError(msg)
    } finally {
      setPasswordLoading(false)
    }
  }

  async function handleRedeemTeamCode(e: FormEvent) {
    e.preventDefault()
    if (!teamCode.trim()) return

    setTeamLoading(true)
    setTeamMessage(null)

    const result = await redeemTeamCode(teamCode.trim())
    setTeamMessage({ ok: result.ok, text: result.message })
    if (result.ok) {
      setTeamCode('')
      refreshProfile()
    }

    setTeamLoading(false)
  }

  return (
    <AppLayout title="Configurações" subtitle="Gerencie sua conta e preferências">
      <div className="mx-auto max-w-2xl">
        <div className="flex gap-1.5 overflow-x-auto border-b border-[var(--color-ink-100)]">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'whitespace-nowrap border-b-2 px-3 pb-3 text-sm font-medium transition-colors',
                activeTab === tab.id
                  ? 'border-[var(--color-signal-600)] text-[var(--color-signal-700)]'
                  : 'border-transparent text-[var(--color-ink-500)] hover:text-[var(--color-ink-800)]'
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === 'perfil' && (
          <form onSubmit={handleSaveProfile}>
            <Card className="mt-6 space-y-4 p-6">
              {profileSuccess && (
                <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700">
                  <CheckCircle2 size={18} className="shrink-0" />
                  <span>Perfil atualizado com sucesso!</span>
                </div>
              )}

              {profileError && (
                <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                  <AlertCircle size={18} className="shrink-0" />
                  <span>{profileError}</span>
                </div>
              )}

              <div className="flex items-center gap-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--color-signal-600)] text-lg font-semibold text-white shadow">
                  {initials}
                </div>
                <div>
                  <p className="text-sm font-medium text-[var(--color-ink-900)]">
                    {isTeam ? 'Equipe OrbeLead' : `Plano ${profile?.plan ? profile.plan.toUpperCase() : 'FREE'}`}
                  </p>
                  <p className="text-xs text-[var(--color-ink-500)]">{user?.email}</p>
                </div>
              </div>

              <div>
                <Label htmlFor="name">Nome completo</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  disabled={profileLoading}
                />
              </div>

              <div>
                <Label htmlFor="company">Empresa (opcional)</Label>
                <Input
                  id="company"
                  placeholder="Nome da sua agência ou negócio"
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  disabled={profileLoading}
                />
              </div>

              <div>
                <Label htmlFor="email">E-mail</Label>
                <Input
                  id="email"
                  type="email"
                  value={user?.email || ''}
                  disabled
                  className="bg-gray-50 text-gray-500 cursor-not-allowed"
                />
                <p className="mt-1 text-xs text-[var(--color-ink-400)]">
                  O e-mail é gerenciado pela autenticação e não pode ser alterado diretamente aqui.
                </p>
              </div>

              <Button type="submit" disabled={profileLoading}>
                {profileLoading ? (
                  <span className="flex items-center gap-2">
                    <Loader2 size={16} className="animate-spin" />
                    Salvando...
                  </span>
                ) : (
                  'Salvar alterações'
                )}
              </Button>
            </Card>
          </form>
        )}

        {activeTab === 'senha' && (
          <form onSubmit={handleUpdatePassword}>
            <Card className="mt-6 space-y-4 p-6">
              {passwordSuccess && (
                <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700">
                  <CheckCircle2 size={18} className="shrink-0" />
                  <span>Senha atualizada com sucesso!</span>
                </div>
              )}

              {passwordError && (
                <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                  <AlertCircle size={18} className="shrink-0" />
                  <span>{passwordError}</span>
                </div>
              )}

              <div>
                <Label htmlFor="new-password">Nova senha</Label>
                <Input
                  id="new-password"
                  type="password"
                  placeholder="Mínimo 6 caracteres"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  disabled={passwordLoading}
                />
              </div>

              <div>
                <Label htmlFor="confirm-password">Confirmar nova senha</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  placeholder="Confirme sua nova senha"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  disabled={passwordLoading}
                />
              </div>

              <Button type="submit" disabled={passwordLoading}>
                {passwordLoading ? (
                  <span className="flex items-center gap-2">
                    <Loader2 size={16} className="animate-spin" />
                    Atualizando...
                  </span>
                ) : (
                  'Atualizar senha'
                )}
              </Button>
            </Card>
          </form>
        )}

        {activeTab === 'notificacoes' && (
          <Card className="mt-6 divide-y divide-[var(--color-ink-100)] p-2">
            {[
              { title: 'Novos leads de alta oportunidade', desc: 'Receba um alerta por e-mail quando encontrarmos leads com score acima de 80.' },
              { title: 'Resumo semanal', desc: 'Um resumo da sua prospecção toda segunda-feira.' },
              { title: 'Novidades do produto', desc: 'Atualizações e novos recursos do OrbeLead.' },
            ].map((item) => (
              <label key={item.title} className="flex cursor-pointer items-center justify-between gap-4 p-4">
                <div>
                  <p className="text-sm font-medium text-[var(--color-ink-900)]">{item.title}</p>
                  <p className="text-xs text-[var(--color-ink-500)]">{item.desc}</p>
                </div>
                <input type="checkbox" defaultChecked className="h-5 w-5 shrink-0 accent-[var(--color-signal-600)]" />
              </label>
            ))}
          </Card>
        )}

        {activeTab === 'equipe' && (
          <Card className="mt-6 space-y-4 p-6">
            {isTeam ? (
              <div className="flex items-start gap-3">
                <ShieldCheck size={22} className="mt-0.5 shrink-0 text-[var(--color-green-600)]" />
                <div>
                  <p className="text-sm font-medium text-[var(--color-ink-900)]">
                    Sua conta tem acesso de {isAdmin ? 'administrador' : 'equipe'}
                  </p>
                  <p className="mt-1 text-sm text-[var(--color-ink-600)]">
                    Buscas e leads ilimitados, sem necessidade de plano.
                  </p>
                  {isAdmin && (
                    <Link
                      href="/app/equipe"
                      className="mt-3 inline-block text-sm font-medium text-[var(--color-signal-600)] hover:underline"
                    >
                      Gerenciar equipe e códigos de acesso →
                    </Link>
                  )}
                </div>
              </div>
            ) : (
              <form onSubmit={handleRedeemTeamCode} className="space-y-4">
                <div>
                  <p className="text-sm font-medium text-[var(--color-ink-900)]">Faz parte da equipe OrbeLead?</p>
                  <p className="mt-1 text-sm text-[var(--color-ink-600)]">
                    Informe o código de acesso que você recebeu do administrador para liberar todas as
                    funcionalidades sem plano.
                  </p>
                </div>

                {teamMessage && (
                  <div
                    className={cn(
                      'flex items-center gap-2 rounded-lg border p-3 text-sm',
                      teamMessage.ok
                        ? 'border-green-200 bg-green-50 text-green-700'
                        : 'border-red-200 bg-red-50 text-red-700'
                    )}
                  >
                    {teamMessage.ok ? (
                      <CheckCircle2 size={18} className="shrink-0" />
                    ) : (
                      <AlertCircle size={18} className="shrink-0" />
                    )}
                    <span>{teamMessage.text}</span>
                  </div>
                )}

                <div>
                  <Label htmlFor="team-code">Código de acesso</Label>
                  <Input
                    id="team-code"
                    placeholder="ORBE-XXXX-XXXX-XXXX"
                    value={teamCode}
                    onChange={(e) => setTeamCode(e.target.value.toUpperCase())}
                    icon={<KeyRound size={16} />}
                    autoComplete="off"
                    spellCheck={false}
                    className="font-mono tracking-wider"
                    required
                    disabled={teamLoading}
                  />
                </div>

                <Button type="submit" disabled={teamLoading || !teamCode.trim()}>
                  {teamLoading ? (
                    <span className="flex items-center gap-2">
                      <Loader2 size={16} className="animate-spin" />
                      Verificando...
                    </span>
                  ) : (
                    'Verificar código'
                  )}
                </Button>
              </form>
            )}
          </Card>
        )}
      </div>
    </AppLayout>
  )
}
