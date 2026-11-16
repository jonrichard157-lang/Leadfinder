-- =============================================================================
-- 006: Agente de busca (Etapa 2)
-- - Contadores mensais do agente no perfil: pedidos executados e planos montados.
-- - Reset mensal passa a zerar também esses contadores.
-- - searches ganha o modo da busca e a intenção estruturada (plano do agente).
-- - agent_use(): conta o uso do agente com limite. Só a service role chama
--   (os limites vêm de src/lib/billing/catalog.ts e são passados pelo servidor).
-- Idempotente: pode rodar mais de uma vez. Seguro rodar antes do deploy do código.
-- =============================================================================

-- 1. Contadores no perfil. Não entram no GRANT de UPDATE: o usuário não consegue alterá-los.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS agent_runs_used_this_month INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS agent_plans_used_this_month INTEGER NOT NULL DEFAULT 0;

-- 2. Reset mensal inclui os contadores do agente.
CREATE OR REPLACE FUNCTION public.reset_usage_if_new_month(p_user UUID)
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.profiles
     SET searches_used_this_month = 0,
         leads_used_this_month = 0,
         agent_runs_used_this_month = 0,
         agent_plans_used_this_month = 0,
         usage_month = date_trunc('month', NOW())::date
   WHERE id = p_user
     AND usage_month < date_trunc('month', NOW())::date;
$$;

REVOKE ALL ON FUNCTION public.reset_usage_if_new_month(UUID) FROM PUBLIC, anon, authenticated;

-- 3. Histórico de buscas: modo e intenção.
ALTER TABLE public.searches
  ADD COLUMN IF NOT EXISTS mode TEXT NOT NULL DEFAULT 'rapida',
  ADD COLUMN IF NOT EXISTS intent JSONB;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'searches_mode_check') THEN
    ALTER TABLE public.searches
      ADD CONSTRAINT searches_mode_check CHECK (mode IN ('rapida', 'agente'));
  END IF;
END $$;

-- 4. Uso do agente.
--    p_kind: 'run' (pedido executado), 'plan' (plano montado) ou 'refund_run' (devolve um
--    pedido quando a execução falha antes de buscar). p_limit é o limite mensal do plano.
--    Equipe interna (team/admin) não tem limite.
CREATE OR REPLACE FUNCTION public.agent_use(p_user UUID, p_kind TEXT, p_limit INTEGER)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile public.profiles%ROWTYPE;
  v_staff BOOLEAN;
  v_used INTEGER;
BEGIN
  IF p_kind NOT IN ('run', 'plan', 'refund_run') THEN
    RAISE EXCEPTION 'Tipo de uso inválido: %', p_kind;
  END IF;

  PERFORM public.expire_plan_if_needed(p_user);
  PERFORM public.reset_usage_if_new_month(p_user);

  SELECT * INTO v_profile FROM public.profiles WHERE id = p_user FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Perfil não encontrado.' USING HINT = 'profile_not_found';
  END IF;

  IF p_kind = 'refund_run' THEN
    UPDATE public.profiles
       SET agent_runs_used_this_month = GREATEST(agent_runs_used_this_month - 1, 0)
     WHERE id = p_user;
    RETURN json_build_object('ok', TRUE);
  END IF;

  v_staff := v_profile.role IN ('team', 'admin');
  v_used := CASE WHEN p_kind = 'run' THEN v_profile.agent_runs_used_this_month
                 ELSE v_profile.agent_plans_used_this_month END;

  IF NOT v_staff AND v_used >= p_limit THEN
    IF p_kind = 'run' THEN
      RAISE EXCEPTION 'Você usou os % pedidos ao agente do seu plano este mês. A busca rápida continua disponível.', p_limit
        USING HINT = 'agent_limit';
    ELSE
      RAISE EXCEPTION 'Você atingiu o limite de % planos montados este mês. A busca rápida continua disponível.', p_limit
        USING HINT = 'agent_limit';
    END IF;
  END IF;

  IF p_kind = 'run' THEN
    UPDATE public.profiles SET agent_runs_used_this_month = agent_runs_used_this_month + 1 WHERE id = p_user;
  ELSE
    UPDATE public.profiles SET agent_plans_used_this_month = agent_plans_used_this_month + 1 WHERE id = p_user;
  END IF;

  RETURN json_build_object('ok', TRUE, 'staff', v_staff, 'used', v_used + 1, 'limit', p_limit);
END;
$$;

REVOKE ALL ON FUNCTION public.agent_use(UUID, TEXT, INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.agent_use(UUID, TEXT, INTEGER) TO service_role;
