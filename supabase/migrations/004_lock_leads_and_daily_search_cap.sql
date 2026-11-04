-- ==============================================================================
-- ORBELEAD — FASE 0: CATÁLOGO SOMENTE PELO SERVIDOR E TETO DIÁRIO DE BUSCAS
-- Execute no SQL Editor do Supabase depois da 003.
-- Pode ser executado mais de uma vez sem efeitos colaterais.
--
-- ANTES DE EXECUTAR: configure SUPABASE_SERVICE_ROLE_KEY na Vercel e publique o código
-- desta fase. Sem a chave, a busca não consegue gravar no catálogo depois desta migração,
-- e os leads encontrados não poderão ser salvos.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. CATÁLOGO `leads`: somente leitura para usuários
--    Antes, qualquer usuário logado podia inserir empresas com dados falsos, que
--    passavam a ser mostrados a todos. Agora só a service role (servidor) grava.
-- ------------------------------------------------------------------------------

DROP POLICY IF EXISTS "Usuários autenticados podem inserir novos leads" ON public.leads;
REVOKE INSERT, UPDATE, DELETE ON public.leads FROM authenticated, anon;

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS leads_touch_updated_at ON public.leads;
CREATE TRIGGER leads_touch_updated_at
  BEFORE UPDATE ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ------------------------------------------------------------------------------
-- 2. TETO DIÁRIO DE BUSCAS (todos os planos, inclusive equipe)
--    Cada busca faz até 6 requisições pagas ao Google Places. Planos "ilimitados"
--    continuam sem limite mensal, mas passam a ter um limite por dia (dia em UTC).
--    Os contadores não estão no GRANT de UPDATE: o usuário não consegue zerá-los.
-- ------------------------------------------------------------------------------

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS searches_today INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS search_day DATE NOT NULL DEFAULT CURRENT_DATE;

CREATE OR REPLACE FUNCTION public.consume_search()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  -- Ajuste aqui o teto diário por usuário (60 buscas ≈ até 360 requisições ao Google).
  c_daily_limit CONSTANT INTEGER := 60;
  v_uid UUID := auth.uid();
  v_profile public.profiles%ROWTYPE;
  v_unlimited BOOLEAN;
  v_today INTEGER;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Não autenticado.' USING HINT = 'not_authenticated';
  END IF;

  PERFORM public.reset_usage_if_new_month(v_uid);

  SELECT * INTO v_profile FROM public.profiles WHERE id = v_uid FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Perfil não encontrado.' USING HINT = 'profile_not_found';
  END IF;

  v_today := CASE WHEN v_profile.search_day = CURRENT_DATE THEN v_profile.searches_today ELSE 0 END;

  IF v_today >= c_daily_limit THEN
    RAISE EXCEPTION 'Você atingiu o limite de % buscas por dia. Tente novamente amanhã.', c_daily_limit
      USING HINT = 'search_limit';
  END IF;

  v_unlimited := v_profile.role IN ('team', 'admin') OR v_profile.plan IN ('pro', 'agencia');

  IF NOT v_unlimited AND v_profile.searches_used_this_month >= v_profile.monthly_search_limit THEN
    RAISE EXCEPTION 'Você atingiu o limite de % buscas do seu plano este mês.', v_profile.monthly_search_limit
      USING HINT = 'search_limit';
  END IF;

  UPDATE public.profiles
     SET searches_used_this_month = searches_used_this_month + 1,
         searches_today = v_today + 1,
         search_day = CURRENT_DATE
   WHERE id = v_uid;

  RETURN json_build_object(
    'unlimited', v_unlimited,
    'used', v_profile.searches_used_this_month + 1,
    'limit', v_profile.monthly_search_limit,
    'used_today', v_today + 1,
    'daily_limit', c_daily_limit
  );
END;
$$;

REVOKE ALL ON FUNCTION public.consume_search() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.consume_search() TO authenticated;
