'use client'

import { useState, type FormEvent } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Mail, Lock, User, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react'
import { AuthLayout } from '@/components/layout/AuthLayout'
import { Input, Label } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { supabase } from '@/lib/supabase'

export default function SignupPage() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [requiresConfirmation, setRequiresConfirmation] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: name,
          },
        },
      })

      if (signUpError) {
        throw signUpError
      }

      // Se o Supabase exige confirmação por e-mail e não retornou sessão ativa
      if (data.user && !data.session) {
        setRequiresConfirmation(true)
      } else {
        router.push('/app')
        router.refresh()
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Ocorreu um erro ao criar a conta.'
      if (message.includes('User already registered')) {
        setError('Este e-mail já está cadastrado. Faça login ou recupere sua senha.')
      } else if (message.includes('Password should be at least')) {
        setError('A senha deve ter pelo menos 6 caracteres.')
      } else {
        setError(message)
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthLayout
      title="Crie sua conta grátis"
      subtitle="10 leads por mês, sem cartão de crédito."
      footer={
        <>
          Já tem uma conta?{' '}
          <Link href="/login" className="font-medium text-[var(--color-signal-600)]">
            Entrar
          </Link>
        </>
      }
    >
      {requiresConfirmation ? (
        <div className="rounded-lg border border-[var(--color-green-100)] bg-[var(--color-green-100)]/40 p-4">
          <div className="flex items-center gap-2 text-[var(--color-green-600)]">
            <CheckCircle2 size={20} />
            <p className="font-medium">Quase lá! Confirme seu e-mail</p>
          </div>
          <p className="mt-2 text-sm text-[var(--color-ink-600)]">
            Enviamos um link de confirmação para <strong>{email}</strong>. Clique no link recebido para ativar sua conta e acessar a plataforma.
          </p>
          <div className="mt-4">
            <Link href="/login">
              <Button variant="secondary" fullWidth size="sm">
                Ir para a tela de Login
              </Button>
            </Link>
          </div>
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
            <Label htmlFor="name">Nome completo</Label>
            <Input
              id="name"
              type="text"
              placeholder="Seu nome"
              icon={<User size={16} />}
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              disabled={loading}
            />
          </div>

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

          <div>
            <Label htmlFor="password">Senha</Label>
            <Input
              id="password"
              type="password"
              placeholder="Mínimo 6 caracteres"
              icon={<Lock size={16} />}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              disabled={loading}
            />
          </div>

          <Button type="submit" fullWidth size="lg" disabled={loading}>
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 size={18} className="animate-spin" />
                Criando conta...
              </span>
            ) : (
              'Criar conta'
            )}
          </Button>

          <p className="text-center text-xs text-[var(--color-ink-500)]">
            Ao continuar, você concorda com os Termos de uso e a Política de privacidade.
          </p>
        </form>
      )}
    </AuthLayout>
  )
}
