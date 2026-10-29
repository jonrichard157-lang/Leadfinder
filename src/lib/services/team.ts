import { supabase } from '@/lib/supabase'

// As regras (hash do código, validade, limite de tentativas, permissão de admin) ficam nas
// funções do banco em supabase/migrations/002_team_access_and_limits.sql.

export interface TeamCode {
  id: string
  hint: string
  label: string | null
  uses: number
  max_uses: number
  expires_at: string
  revoked_at: string | null
  created_at: string
}

export interface TeamMember {
  id: string
  full_name: string | null
  email: string
  role: 'team' | 'admin'
}

export interface CreatedTeamCode {
  id: string
  code: string
  label: string | null
  max_uses: number
  expires_at: string
}

/**
 * Verifica o código informado e libera o acesso de equipe para o usuário logado.
 */
export async function redeemTeamCode(code: string): Promise<{ ok: boolean; message: string }> {
  const { data, error } = await supabase.rpc('redeem_team_code', { p_code: code })

  if (error) {
    console.error('Erro ao verificar código de equipe:', error)
    return { ok: false, message: 'Não foi possível verificar o código. Tente novamente.' }
  }

  return data as { ok: boolean; message: string }
}

export async function getTeamOverview(): Promise<{ codes: TeamCode[]; members: TeamMember[] }> {
  const { data, error } = await supabase.rpc('team_overview')
  if (error) throw new Error(error.message)
  return data as { codes: TeamCode[]; members: TeamMember[] }
}

export async function createTeamCode(
  label: string,
  maxUses: number,
  validDays: number
): Promise<CreatedTeamCode> {
  const { data, error } = await supabase.rpc('create_team_code', {
    p_label: label,
    p_max_uses: maxUses,
    p_valid_days: validDays,
  })
  if (error) throw new Error(error.message)
  return data as CreatedTeamCode
}

export async function revokeTeamCode(codeId: string): Promise<void> {
  const { error } = await supabase.rpc('revoke_team_code', { p_code_id: codeId })
  if (error) throw new Error(error.message)
}

export async function removeTeamMember(userId: string): Promise<void> {
  const { error } = await supabase.rpc('remove_team_member', { p_user_id: userId })
  if (error) throw new Error(error.message)
}
