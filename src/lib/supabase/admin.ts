import 'server-only'
import { createClient } from '@supabase/supabase-js'

/**
 * Cliente com a service role: ignora a RLS. Use apenas em código de servidor e só para
 * gravar dados que o próprio servidor produziu (ex.: resultados do Google Places).
 * Retorna null quando SUPABASE_SERVICE_ROLE_KEY não está configurada.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null

  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}
