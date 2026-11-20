import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * Diagnóstico de configuração. Só a equipe interna (role team/admin) acessa.
 * Mostra se cada variável existe e se funciona, NUNCA o valor. As verificações são gratuitas
 * (consulta simples no banco e leitura dos dados do modelo na Anthropic, sem gerar texto).
 */
export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Faça login.' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'team' && profile?.role !== 'admin') {
    return NextResponse.json({ error: 'Apenas a equipe OrbeLead.' }, { status: 403 })
  }

  const env = (name: string) => {
    const v = process.env[name]
    return { definida: typeof v === 'string' && v.trim().length > 0, tamanho: v?.length ?? 0, espacos: !!v && v !== v.trim() }
  }

  const checks: Record<string, unknown> = {
    NEXT_PUBLIC_SUPABASE_URL: env('NEXT_PUBLIC_SUPABASE_URL'),
    SUPABASE_SERVICE_ROLE_KEY: env('SUPABASE_SERVICE_ROLE_KEY'),
    ANTHROPIC_API_KEY: env('ANTHROPIC_API_KEY'),
    GOOGLE_PLACES_API_KEY: env('GOOGLE_PLACES_API_KEY'),
    MP_ACCESS_TOKEN: env('MP_ACCESS_TOKEN'),
    MP_WEBHOOK_SECRET: env('MP_WEBHOOK_SECRET'),
    APP_URL: env('APP_URL'),
  }

  // Service role funciona de verdade?
  const admin = createAdminClient()
  if (!admin) {
    checks.supabase_admin = 'não criado (falta URL ou SUPABASE_SERVICE_ROLE_KEY)'
  } else {
    const { error } = await admin.from('profiles').select('id', { count: 'exact', head: true })
    checks.supabase_admin = error ? `erro: ${error.message}` : 'ok'
  }

  // Chave da Anthropic é aceita? (retrieve do modelo não gera texto e não tem custo)
  if (process.env.ANTHROPIC_API_KEY?.trim()) {
    try {
      await new Anthropic().models.retrieve('claude-opus-5-5')
      checks.anthropic = 'ok'
    } catch (err) {
      checks.anthropic = `erro: ${err instanceof Anthropic.APIError ? `${err.status} ${err.message}` : String(err)}`
    }
  } else {
    checks.anthropic = 'sem chave'
  }

  return NextResponse.json({ deployment: process.env.VERCEL_DEPLOYMENT_ID ?? null, checks })
}
