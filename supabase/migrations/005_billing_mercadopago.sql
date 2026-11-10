-- ==============================================================================
-- ORBELEAD — PLANOS, ASSINATURAS (MERCADO PAGO) E CRÉDITOS AVULSOS
-- Execute no SQL Editor do Supabase depois da 004.
-- Pode ser executado mais de uma vez sem efeitos colaterais.
--
-- Os preços e limites de cada plano ficam em src/lib/billing/catalog.ts. O servidor grava
-- os limites no perfil quando o pagamento é confirmado. Aqui ficam só as regras que
-- precisam ser à prova de fraude: cotas, validade do plano e concessão de créditos.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. PERFIL: tipo de conta, validade do plano e saldo de créditos
-- ------------------------------------------------------------------------------

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS account_type TEXT NOT NULL DEFAULT 'individual',
  ADD COLUMN IF NOT EXISTS plan_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS extra_searches INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS extra_leads INTEGER NOT NULL DEFAULT 0;

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_account_type_check;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_account_type_check CHECK (account_type IN ('individual', 'business'));

-- Planos: free | basico, pro, max (pessoa física) | agencia (empresarial)
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_plan_check;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_plan_check CHECK (plan IN ('free', 'basico', 'pro', 'max', 'agencia'));

-- O usuário escolhe o tipo de conta. Plano, limites, validade e créditos continuam
-- fora do GRANT: só as funções abaixo (e a service role) alteram.
GRANT UPDATE (account_type) ON public.profiles TO authenticated;

-- O tipo de conta escolhido no cadastro vem nos metadados do signUp.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_full_name TEXT;
  v_account_type TEXT;
BEGIN
  v_full_name := COALESCE(
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'name',
    SPLIT_PART(NEW.email, '@', 1)
  );

  v_account_type := CASE
    WHEN NEW.raw_user_meta_data->>'account_type' = 'business' THEN 'business'
    ELSE 'individual'
  END;

  INSERT INTO public.profiles (id, full_name, plan, monthly_lead_limit, leads_used_this_month, account_type)
  VALUES (NEW.id, v_full_name, 'free', 10, 0, v_account_type)
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ------------------------------------------------------------------------------
-- 2. ASSINATURAS E PAGAMENTOS (somente leitura para o dono; escrita pelo servidor)
-- ------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  plan_id TEXT NOT NULL,
  provider TEXT NOT NULL DEFAULT 'mercadopago',
  provider_subscription_id TEXT UNIQUE,
  -- pending | authorized | paused | cancelled
  status TEXT NOT NULL DEFAULT 'pending',
  amount_cents INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_user ON public.subscriptions (user_id, created_at DESC);

-- Cada pagamento aprovado entra uma única vez (provider_payment_id único):
-- é o que torna os webhooks idempotentes.
CREATE TABLE IF NOT EXISTS public.billing_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  provider TEXT NOT NULL DEFAULT 'mercadopago',
  provider_payment_id TEXT NOT NULL UNIQUE,
  -- subscription | credits
  kind TEXT NOT NULL,
  reference TEXT NOT NULL,
  amount_cents INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_billing_payments_user ON public.billing_payments (user_id, created_at DESC);

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_payments ENABLE ROW LEVEL SECURITY;

REVOKE INSERT, UPDATE, DELETE ON public.subscriptions FROM authenticated, anon;
REVOKE INSERT, UPDATE, DELETE ON public.billing_payments FROM authenticated, anon;

DROP POLICY IF EXISTS "Usuário vê as próprias assinaturas" ON public.subscriptions;
CREATE POLICY "Usuário vê as próprias assinaturas"
  ON public.subscriptions FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Usuário vê os próprios pagamentos" ON public.billing_payments;
CREATE POLICY "Usuário vê os próprios pagamentos"
  ON public.billing_payments FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- ------------------------------------------------------------------------------
-- 3. VALIDADE DO PLANO
--    Cada pagamento aprovado estende o plano em 1 mês. Passados 3 dias de carência
--    sem novo pagamento (cancelamento ou cartão recusado), a conta volta ao Grátis.
--    plan_expires_at nulo = plano concedido manualmente, sem vencimento.
-- ------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.expire_plan_if_needed(p_user UUID)
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.profiles
     SET plan = 'free',
         monthly_search_limit = 10,
         monthly_lead_limit = 10,
         plan_expires_at = NULL,
         updated_at = NOW()
   WHERE id = p_user
     AND plan <> 'free'
     AND plan_expires_at IS NOT NULL
     AND plan_expires_at + INTERVAL '3 days' < NOW();
$$;

REVOKE ALL ON FUNCTION public.expire_plan_if_needed(UUID) FROM PUBLIC, anon, authenticated;

-- ------------------------------------------------------------------------------
-- 4. COTAS: nenhum plano é ilimitado (só a equipe interna do OrbeLead).
--    Acabou a cota do mês? Usa o saldo de créditos avulsos, que não expira.
-- ------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.consume_search()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  -- Teto diário por usuário, para todos os planos (proteção de custo do Google).
  c_daily_limit CONSTANT INTEGER := 60;
  v_uid UUID := auth.uid();
  v_profile public.profiles%ROWTYPE;
  v_staff BOOLEAN;
  v_today INTEGER;
  v_used_credit BOOLEAN := FALSE;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Não autenticado.' USING HINT = 'not_authenticated';
  END IF;

  PERFORM public.expire_plan_if_needed(v_uid);
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

  v_staff := v_profile.role IN ('team', 'admin');

  IF NOT v_staff AND v_profile.searches_used_this_month >= v_profile.monthly_search_limit THEN
    IF v_profile.extra_searches > 0 THEN
      v_used_credit := TRUE;
    ELSE
      RAISE EXCEPTION 'Você usou as % buscas do seu plano este mês. Faça upgrade ou compre créditos em Assinatura.',
        v_profile.monthly_search_limit
        USING HINT = 'search_limit';
    END IF;
  END IF;

  UPDATE public.profiles
     SET searches_used_this_month = searches_used_this_month + CASE WHEN v_used_credit THEN 0 ELSE 1 END,
         extra_searches = extra_searches - CASE WHEN v_used_credit THEN 1 ELSE 0 END,
         searches_today = v_today + 1,
         search_day = CURRENT_DATE
   WHERE id = v_uid;

  RETURN json_build_object(
    'staff', v_staff,
    'used_credit', v_used_credit,
    'used', v_profile.searches_used_this_month + CASE WHEN v_used_credit THEN 0 ELSE 1 END,
    'limit', v_profile.monthly_search_limit,
    'extra_searches', v_profile.extra_searches - CASE WHEN v_used_credit THEN 1 ELSE 0 END,
    'used_today', v_today + 1,
    'daily_limit', c_daily_limit
  );
END;
$$;

REVOKE ALL ON FUNCTION public.consume_search() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.consume_search() TO authenticated;

CREATE OR REPLACE FUNCTION public.enforce_lead_quota()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile public.profiles%ROWTYPE;
  v_used_credit BOOLEAN := FALSE;
BEGIN
  PERFORM public.expire_plan_if_needed(NEW.user_id);
  PERFORM public.reset_usage_if_new_month(NEW.user_id);

  SELECT * INTO v_profile FROM public.profiles WHERE id = NEW.user_id FOR UPDATE;

  IF v_profile.role NOT IN ('team', 'admin')
     AND v_profile.leads_used_this_month >= v_profile.monthly_lead_limit THEN
    IF v_profile.extra_leads > 0 THEN
      v_used_credit := TRUE;
    ELSE
      RAISE EXCEPTION 'Você usou os % leads do seu plano este mês. Faça upgrade ou compre créditos em Assinatura.',
        v_profile.monthly_lead_limit
        USING HINT = 'lead_limit';
    END IF;
  END IF;

  UPDATE public.profiles
     SET leads_used_this_month = leads_used_this_month + CASE WHEN v_used_credit THEN 0 ELSE 1 END,
         extra_leads = extra_leads - CASE WHEN v_used_credit THEN 1 ELSE 0 END
   WHERE id = NEW.user_id;

  RETURN NEW;
END;
$$;

-- ------------------------------------------------------------------------------
-- 5. FUNÇÕES DE COBRANÇA (somente a service role, chamadas pelo webhook)
-- ------------------------------------------------------------------------------

-- Ativa ou troca o plano assim que a assinatura é autorizada. A validade provisória
-- de 1 dia é estendida em 1 mês quando a primeira cobrança é aprovada.
CREATE OR REPLACE FUNCTION public.billing_activate_plan(
  p_user UUID,
  p_plan TEXT,
  p_search_limit INTEGER,
  p_lead_limit INTEGER
)
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.profiles
     SET plan = p_plan,
         monthly_search_limit = p_search_limit,
         monthly_lead_limit = p_lead_limit,
         plan_expires_at = GREATEST(COALESCE(plan_expires_at, NOW()), NOW() + INTERVAL '1 day'),
         updated_at = NOW()
   WHERE id = p_user;
$$;

-- Registra uma cobrança aprovada da assinatura e estende o plano em 1 mês.
-- Retorna FALSE se o pagamento já tinha sido processado (webhook repetido).
CREATE OR REPLACE FUNCTION public.billing_record_subscription_payment(
  p_payment_id TEXT,
  p_user UUID,
  p_plan TEXT,
  p_search_limit INTEGER,
  p_lead_limit INTEGER,
  p_amount_cents INTEGER,
  p_reference TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.billing_payments (user_id, provider_payment_id, kind, reference, amount_cents)
  VALUES (p_user, p_payment_id, 'subscription', p_reference, p_amount_cents)
  ON CONFLICT (provider_payment_id) DO NOTHING;

  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  UPDATE public.profiles
     SET plan = p_plan,
         monthly_search_limit = p_search_limit,
         monthly_lead_limit = p_lead_limit,
         plan_expires_at = GREATEST(COALESCE(plan_expires_at, NOW()), NOW()) + INTERVAL '1 month',
         updated_at = NOW()
   WHERE id = p_user;

  RETURN TRUE;
END;
$$;

-- Concede créditos avulsos de um pagamento aprovado. Idempotente.
CREATE OR REPLACE FUNCTION public.billing_grant_credits(
  p_payment_id TEXT,
  p_user UUID,
  p_searches INTEGER,
  p_leads INTEGER,
  p_amount_cents INTEGER,
  p_reference TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.billing_payments (user_id, provider_payment_id, kind, reference, amount_cents)
  VALUES (p_user, p_payment_id, 'credits', p_reference, p_amount_cents)
  ON CONFLICT (provider_payment_id) DO NOTHING;

  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  UPDATE public.profiles
     SET extra_searches = extra_searches + GREATEST(p_searches, 0),
         extra_leads = extra_leads + GREATEST(p_leads, 0),
         updated_at = NOW()
   WHERE id = p_user;

  RETURN TRUE;
END;
$$;

REVOKE ALL ON FUNCTION public.billing_activate_plan(UUID, TEXT, INTEGER, INTEGER) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.billing_record_subscription_payment(TEXT, UUID, TEXT, INTEGER, INTEGER, INTEGER, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.billing_grant_credits(TEXT, UUID, INTEGER, INTEGER, INTEGER, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.billing_activate_plan(UUID, TEXT, INTEGER, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION public.billing_record_subscription_payment(TEXT, UUID, TEXT, INTEGER, INTEGER, INTEGER, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.billing_grant_credits(TEXT, UUID, INTEGER, INTEGER, INTEGER, TEXT) TO service_role;

-- ------------------------------------------------------------------------------
-- 6. CONTAS QUE JÁ ESTAVAM EM PLANO PAGO
--    Pro/Agência atribuídos manualmente antes desta migração recebem os limites do
--    catálogo e continuam sem vencimento (plan_expires_at nulo).
-- ------------------------------------------------------------------------------

UPDATE public.profiles SET monthly_search_limit = 100, monthly_lead_limit = 500
 WHERE plan = 'pro' AND plan_expires_at IS NULL AND monthly_lead_limit < 500;

UPDATE public.profiles SET monthly_search_limit = 400, monthly_lead_limit = 3000
 WHERE plan = 'agencia' AND plan_expires_at IS NULL AND monthly_lead_limit < 3000;
