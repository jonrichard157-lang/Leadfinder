'use client'

import { useState, type FormEvent } from 'react'
import Link from 'next/link'
import { Mail, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react'
import { AuthLayout } from '@/components/layout/AuthLayout'
import { Input, Label } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { supabase } from '@/lib/supabase'

export default function PasswordRecoveryPage() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/app/configuracoes`,
      })

      if (resetError) {
        throw resetError
      }

      setSent(true)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erro ao solicitar recuperação de senha.'
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthLayout
      title="Recuperar senha"
      subtitle="Enviaremos um link para redefinir sua senha."
      footer={
        <Link href="/login" className="font-medium text-[var(--color-signal-600)]">
          Voltar para o login
        </Link>
      }
    >
      {sent ? (
        <div className="rounded-lg border border-[var(--color-green-100)] bg-[var(--color-green-100)]/40 p-4">
          <div className="flex items-center gap-2 text-[var(--color-green-600)]">
            <CheckCircle2 size={18} />
            <p className="text-sm font-medium">Link enviado com sucesso</p>
          </div>
          <p className="mt-1.5 text-sm text-[var(--color-ink-600)]">
            Verifique a caixa de entrada de <strong>{email}</strong> para redefinir sua senha de acesso.
          </p>
        </div>
      ) : (
        <form className="space-y-4" onSubmit={handleSubmit}>
          {error && (
            <div className="flex items-start gap-2.5 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              <AlertCircle size={18} className="mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <Label htmlFor="email">E-mail</Label>
            <Input
              id="email"
              type="email"
              placeholder="voce@empresa.com"
              icon={<Mail size={16} />}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={loading}
            />
          </div>

          <Button type="submit" fullWidth size="lg" disabled={loading}>
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 size={18} className="animate-spin" />
                Enviando...
              </span>
            ) : (
              'Enviar link de recuperação'
            )}
          </Button>
        </form>
      )}
    </AuthLayout>
  )
}
