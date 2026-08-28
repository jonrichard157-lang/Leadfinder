'use client'

import { useState, useEffect, type FormEvent } from 'react'
import { CheckCircle2, AlertCircle, Loader2 } from 'lucide-react'
import { AppLayout } from '@/components/layout/AppLayout'
import { Card } from '@/components/ui/Card'
import { Input, Label } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils'
import { useUser } from '@/hooks/useUser'
import { supabase } from '@/lib/supabase'

const TABS = [
  { id: 'perfil', label: 'Perfil' },
  { id: 'senha', label: 'Senha' },
  { id: 'notificacoes', label: 'Notificações' },
] as const

type TabId = (typeof TABS)[number]['id']

export default function SettingsPage() {
  const { user, profile, initials, refreshProfile } = useUser()
  const [activeTab, setActiveTab] = useState<TabId>('perfil')

  // Profile form state
  const [name, setName] = useState('')
  const [company, setCompany] = useState('')
  const [profileLoading, setProfileLoading] = useState(false)
  const [profileSuccess, setProfileSuccess] = useState(false)
  const [profileError, setProfileError] = useState<string | null>(null)

  // Password form state
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordLoading, setPasswordLoading] = useState(false)
  const [passwordSuccess, setPasswordSuccess] = useState(false)
  const [passwordError, setPasswordError] = useState<string | null>(null)

  useEffect(() => {
    if (profile) {
      setName(profile.full_name || '')
      setCompany(profile.company || '')
    } else if (user) {
      setName(user.user_metadata?.full_name || '')
    }
  }, [profile, user])

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

  return (
    <AppLayout title="Configurações" subtitle="Gerencie sua conta e preferências">
      <div className="mx-auto max-w-2xl">
        <div className="flex gap-1.5 border-b border-[var(--color-ink-100)]">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'border-b-2 px-3 pb-3 text-sm font-medium transition-colors',
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
                    Plano {profile?.plan ? profile.plan.toUpperCase() : 'FREE'}
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
              { title: 'Novidades do produto', desc: 'Atualizações e novos recursos do LeadFinder.' },
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
      </div>
    </AppLayout>
  )
}
