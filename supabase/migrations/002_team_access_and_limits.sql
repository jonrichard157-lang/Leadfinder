-- ==============================================================================
-- ORBELEAD — ACESSO DA EQUIPE E LIMITES DE PLANO
-- Execute no SQL Editor do Supabase depois do schema.sql.
-- Pode ser executado mais de uma vez sem efeitos colaterais.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. PAPÉIS E CONTADORES DE USO
--    role: 'user' (segue o plano) | 'team' (equipe, sem limites) | 'admin' (equipe + gerencia códigos)
-- ------------------------------------------------------------------------------

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'user',
  ADD COLUMN IF NOT EXISTS monthly_search_limit INTEGER NOT NULL DEFAULT 10,
  ADD COLUMN IF NOT EXISTS searches_used_this_month INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS usage_month DATE NOT NULL DEFAULT date_trunc('month', NOW())::date;

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_role_check CHECK (role IN ('user', 'team', 'admin'));

-- O usuário só pode editar os próprios dados cadastrais. Plano, papel, limites e
-- contadores passam a ser alterados apenas pelas funções abaixo (SECURITY DEFINER).
REVOKE UPDATE ON public.profiles FROM authenticated, anon;
GRANT UPDATE (full_name, company, avatar_url, updated_at) ON public.profiles TO authenticated;

-- ------------------------------------------------------------------------------
-- 2. LIMITES DE PLANO (aplicados no banco, não no navegador)
-- ------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.reset_usage_if_new_month(p_user UUID)
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.profiles
     SET searches_used_this_month = 0,
         leads_used_this_month = 0,
         usage_month = date_trunc('month', NOW())::date
   WHERE id = p_user
     AND usage_month < date_trunc('month', NOW())::date;
$$;

REVOKE ALL ON FUNCTION public.reset_usage_if_new_month(UUID) FROM PUBLIC, anon, authenticated;

-- Registra uma busca e bloqueia quando o limite mensal do plano foi atingido.
-- Equipe/admin e planos Pro/Agência têm buscas ilimitadas.
CREATE OR REPLACE FUNCTION public.consume_search()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_profile public.profiles%ROWTYPE;
  v_unlimited BOOLEAN;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Não autenticado.' USING HINT = 'not_authenticated';
  END IF;

  PERFORM public.reset_usage_if_new_month(v_uid);

  SELECT * INTO v_profile FROM public.profiles WHERE id = v_uid FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Perfil não encontrado.' USING HINT = 'profile_not_found';
  END IF;

  v_unlimited := v_profile.role IN ('team', 'admin') OR v_profile.plan IN ('pro', 'agencia');

  IF NOT v_unlimited AND v_profile.searches_used_this_month >= v_profile.monthly_search_limit THEN
    RAISE EXCEPTION 'Você atingiu o limite de % buscas do seu plano este mês.', v_profile.monthly_search_limit
      USING HINT = 'search_limit';
  END IF;

  UPDATE public.profiles
     SET searches_used_this_month = searches_used_this_month + 1
   WHERE id = v_uid;

  RETURN json_build_object(
    'unlimited', v_unlimited,
    'used', v_profile.searches_used_this_month + 1,
    'limit', v_profile.monthly_search_limit
  );
END;
$$;

REVOKE ALL ON FUNCTION public.consume_search() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.consume_search() TO authenticated;

-- Conta cada lead salvo e bloqueia ao passar do limite mensal.
-- Equipe/admin e plano Agência têm leads ilimitados.
CREATE OR REPLACE FUNCTION public.enforce_lead_quota()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile public.profiles%ROWTYPE;
BEGIN
  PERFORM public.reset_usage_if_new_month(NEW.user_id);

  SELECT * INTO v_profile FROM public.profiles WHERE id = NEW.user_id FOR UPDATE;

  IF v_profile.role NOT IN ('team', 'admin')
     AND v_profile.plan <> 'agencia'
     AND v_profile.leads_used_this_month >= v_profile.monthly_lead_limit THEN
    RAISE EXCEPTION 'Você atingiu o limite de % leads do seu plano este mês.', v_profile.monthly_lead_limit
      USING HINT = 'lead_limit';
  END IF;

  UPDATE public.profiles
     SET leads_used_this_month = leads_used_this_month + 1
   WHERE id = NEW.user_id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_lead_quota ON public.saved_leads;
CREATE TRIGGER enforce_lead_quota
  BEFORE INSERT ON public.saved_leads
  FOR EACH ROW EXECUTE FUNCTION public.enforce_lead_quota();

-- ------------------------------------------------------------------------------
-- 3. CÓDIGOS DE ACESSO DA EQUIPE
--    O código só é exibido uma vez, na criação. No banco fica apenas o hash SHA-256.
-- ------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.team_access_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code_hash TEXT NOT NULL UNIQUE,
  code_hint TEXT NOT NULL,
  label TEXT,
  max_uses INTEGER NOT NULL DEFAULT 1 CHECK (max_uses > 0),
  uses INTEGER NOT NULL DEFAULT 0,
  expires_at TIMESTAMPTZ NOT NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.team_code_redemptions (
  code_id UUID NOT NULL REFERENCES public.team_access_codes(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  redeemed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (code_id, user_id)
);

-- Tentativas inválidas, para limitar força bruta.
CREATE TABLE IF NOT EXISTS public.team_code_attempts (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  attempted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_team_code_attempts_user ON public.team_code_attempts (user_id, attempted_at);

-- RLS ligado e sem políticas: as tabelas só são acessíveis pelas funções abaixo.
ALTER TABLE public.team_access_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_code_redemptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_code_attempts ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.hash_team_code(p_code TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT encode(sha256(convert_to(upper(regexp_replace(p_code, '[^A-Za-z0-9]', '', 'g')), 'UTF8')), 'hex');
$$;

REVOKE ALL ON FUNCTION public.hash_team_code(TEXT) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.is_team_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  -- Sem usuário logado = SQL Editor do Supabase ou service_role (anon não tem EXECUTE nas funções de admin).
  SELECT auth.uid() IS NULL
      OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin');
$$;

REVOKE ALL ON FUNCTION public.is_team_admin() FROM PUBLIC, anon, authenticated;

-- Gera um código no formato ORBE-XXXX-XXXX-XXXX. Uso (SQL Editor):
--   SELECT public.create_team_code('Equipe dev', 5, 30);
CREATE OR REPLACE FUNCTION public.create_team_code(
  p_label TEXT DEFAULT NULL,
  p_max_uses INTEGER DEFAULT 1,
  p_valid_days INTEGER DEFAULT 7
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_raw TEXT;
  v_code TEXT;
  v_row public.team_access_codes%ROWTYPE;
BEGIN
  IF NOT public.is_team_admin() THEN
    RAISE EXCEPTION 'Apenas administradores podem gerar códigos de equipe.' USING HINT = 'forbidden';
  END IF;

  IF p_max_uses IS NULL OR p_max_uses < 1 OR p_max_uses > 100 THEN
    RAISE EXCEPTION 'Número de usos deve ficar entre 1 e 100.' USING HINT = 'invalid_input';
  END IF;

  IF p_valid_days IS NULL OR p_valid_days < 1 OR p_valid_days > 365 THEN
    RAISE EXCEPTION 'Validade deve ficar entre 1 e 365 dias.' USING HINT = 'invalid_input';
  END IF;

  -- 12 caracteres hexadecimais aleatórios (48 bits) + limite de tentativas no resgate.
  v_raw := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12));
  v_code := 'ORBE-' || substr(v_raw, 1, 4) || '-' || substr(v_raw, 5, 4) || '-' || substr(v_raw, 9, 4);

  INSERT INTO public.team_access_codes (code_hash, code_hint, label, max_uses, expires_at, created_by)
  VALUES (
    public.hash_team_code(v_code),
    right(v_raw, 4),
    NULLIF(trim(p_label), ''),
    p_max_uses,
    NOW() + make_interval(days => p_valid_days),
    auth.uid()
  )
  RETURNING * INTO v_row;

  RETURN json_build_object(
    'id', v_row.id,
    'code', v_code,
    'label', v_row.label,
    'max_uses', v_row.max_uses,
    'expires_at', v_row.expires_at
  );
END;
$$;

REVOKE ALL ON FUNCTION public.create_team_code(TEXT, INTEGER, INTEGER) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_team_code(TEXT, INTEGER, INTEGER) TO authenticated;

-- Verifica o código informado pelo usuário logado e libera o acesso de equipe.
CREATE OR REPLACE FUNCTION public.redeem_team_code(p_code TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_role TEXT;
  v_code public.team_access_codes%ROWTYPE;
  v_recent_failures INTEGER;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Não autenticado.' USING HINT = 'not_authenticated';
  END IF;

  SELECT role INTO v_role FROM public.profiles WHERE id = v_uid;
  IF v_role IN ('team', 'admin') THEN
    RETURN json_build_object('ok', true, 'role', v_role, 'message', 'Sua conta já tem acesso de equipe.');
  END IF;

  SELECT count(*) INTO v_recent_failures
    FROM public.team_code_attempts
   WHERE user_id = v_uid AND attempted_at > NOW() - INTERVAL '15 minutes';

  IF v_recent_failures >= 5 THEN
    RETURN json_build_object('ok', false, 'message', 'Muitas tentativas. Aguarde 15 minutos e tente novamente.');
  END IF;

  SELECT * INTO v_code
    FROM public.team_access_codes
   WHERE code_hash = public.hash_team_code(coalesce(p_code, ''))
   FOR UPDATE;

  IF NOT FOUND OR v_code.revoked_at IS NOT NULL OR v_code.expires_at < NOW() OR v_code.uses >= v_code.max_uses THEN
    INSERT INTO public.team_code_attempts (user_id) VALUES (v_uid);
    RETURN json_build_object('ok', false, 'message', 'Código inválido, expirado ou já utilizado.');
  END IF;

  UPDATE public.team_access_codes SET uses = uses + 1 WHERE id = v_code.id;
  INSERT INTO public.team_code_redemptions (code_id, user_id) VALUES (v_code.id, v_uid)
    ON CONFLICT DO NOTHING;
  UPDATE public.profiles SET role = 'team', updated_at = NOW() WHERE id = v_uid;
  DELETE FROM public.team_code_attempts WHERE user_id = v_uid;

  RETURN json_build_object('ok', true, 'role', 'team', 'message', 'Acesso de equipe liberado.');
END;
$$;

REVOKE ALL ON FUNCTION public.redeem_team_code(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.redeem_team_code(TEXT) TO authenticated;

-- Dados da página "Equipe" (somente admin): códigos e membros.
CREATE OR REPLACE FUNCTION public.team_overview()
RETURNS JSON
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_team_admin() THEN
    RAISE EXCEPTION 'Apenas administradores podem ver a equipe.' USING HINT = 'forbidden';
  END IF;

  RETURN json_build_object(
    'codes', coalesce((
      SELECT json_agg(json_build_object(
        'id', c.id,
        'hint', c.code_hint,
        'label', c.label,
        'uses', c.uses,
        'max_uses', c.max_uses,
        'expires_at', c.expires_at,
        'revoked_at', c.revoked_at,
        'created_at', c.created_at
      ) ORDER BY c.created_at DESC)
      FROM public.team_access_codes c
    ), '[]'::json),
    'members', coalesce((
      SELECT json_agg(json_build_object(
        'id', p.id,
        'full_name', p.full_name,
        'email', u.email,
        'role', p.role
      ) ORDER BY p.role, p.full_name)
      FROM public.profiles p
      JOIN auth.users u ON u.id = p.id
      WHERE p.role IN ('team', 'admin')
    ), '[]'::json)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.team_overview() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.team_overview() TO authenticated;

CREATE OR REPLACE FUNCTION public.revoke_team_code(p_code_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_team_admin() THEN
    RAISE EXCEPTION 'Apenas administradores podem revogar códigos.' USING HINT = 'forbidden';
  END IF;

  UPDATE public.team_access_codes SET revoked_at = NOW()
   WHERE id = p_code_id AND revoked_at IS NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.revoke_team_code(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.revoke_team_code(UUID) TO authenticated;

-- Remove o acesso de equipe de um membro (volta a seguir o plano). Não afeta administradores.
CREATE OR REPLACE FUNCTION public.remove_team_member(p_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_team_admin() THEN
    RAISE EXCEPTION 'Apenas administradores podem remover membros.' USING HINT = 'forbidden';
  END IF;

  UPDATE public.profiles SET role = 'user', updated_at = NOW()
   WHERE id = p_user_id AND role = 'team';
END;
$$;

REVOKE ALL ON FUNCTION public.remove_team_member(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.remove_team_member(UUID) TO authenticated;

-- ------------------------------------------------------------------------------
-- 4. PRIMEIRO ADMINISTRADOR
--    Troque o e-mail abaixo pelo da sua conta no OrbeLead, remova o "--" e execute:
--
-- UPDATE public.profiles SET role = 'admin'
--  WHERE id = (SELECT id FROM auth.users WHERE email = 'seu-email@exemplo.com');
-- ------------------------------------------------------------------------------
