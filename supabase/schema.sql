-- ==============================================================================
-- ORBELEAD — DATABASE SCHEMA & RLS POLICIES (SUPABASE)
-- Execute este script no SQL Editor do seu projeto Supabase.
-- Depois, execute os arquivos de supabase/migrations/ em ordem.
-- ==============================================================================

-- 1. TABELA DE PERFIS DE USUÁRIOS (PROFILES)
-- Sincronizada automaticamente com auth.users através de trigger
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  company TEXT,
  plan TEXT NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'pro', 'agencia')),
  monthly_lead_limit INTEGER NOT NULL DEFAULT 10,
  leads_used_this_month INTEGER NOT NULL DEFAULT 0,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. TABELA DE LEADS (EMPRESAS ENCONTRADAS)
-- Armazena o catálogo de empresas encontradas para evitar cobrança duplicada de APIs
CREATE TABLE IF NOT EXISTS public.leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  place_id TEXT UNIQUE,
  name TEXT NOT NULL,
  category TEXT,
  address TEXT,
  city TEXT,
  state TEXT,
  phone TEXT,
  has_website BOOLEAN NOT NULL DEFAULT FALSE,
  website TEXT,
  rating NUMERIC(2, 1) NOT NULL DEFAULT 0,
  reviews_count INTEGER NOT NULL DEFAULT 0,
  opportunity_score INTEGER NOT NULL DEFAULT 0 CHECK (opportunity_score >= 0 AND opportunity_score <= 100),
  source TEXT NOT NULL DEFAULT 'google_places',
  raw_data JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices para otimização de busca de leads
CREATE INDEX IF NOT EXISTS idx_leads_city ON public.leads (city);
CREATE INDEX IF NOT EXISTS idx_leads_category ON public.leads (category);
CREATE INDEX IF NOT EXISTS idx_leads_has_website ON public.leads (has_website);
CREATE INDEX IF NOT EXISTS idx_leads_opportunity_score ON public.leads (opportunity_score DESC);

-- 3. TABELA DE LEADS SALVOS / CRM PESSOAL (SAVED_LEADS)
-- Relacionamento N:N entre o usuário e os leads que ele salvou na sua lista de prospecção
CREATE TABLE IF NOT EXISTS public.saved_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'novo' CHECK (status IN ('novo', 'contatado', 'em_negociacao', 'convertido', 'descartado')),
  notes JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT unique_user_lead UNIQUE (user_id, lead_id)
);

CREATE INDEX IF NOT EXISTS idx_saved_leads_user ON public.saved_leads (user_id);
CREATE INDEX IF NOT EXISTS idx_saved_leads_status ON public.saved_leads (status);

-- 4. TABELA DE HISTÓRICO DE BUSCAS (SEARCHES)
CREATE TABLE IF NOT EXISTS public.searches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  filters JSONB NOT NULL,
  results_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_searches_user ON public.searches (user_id);

-- ==============================================================================
-- AUTOMAÇÃO DE CADASTRO (TRIGGER APÓS NOVO USUÁRIO EM auth.users)
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_full_name TEXT;
  v_limit INTEGER;
BEGIN
  -- Extrai nome completo dos metadados enviados no signUp
  v_full_name := COALESCE(
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'name',
    SPLIT_PART(NEW.email, '@', 1)
  );

  INSERT INTO public.profiles (
    id,
    full_name,
    plan,
    monthly_lead_limit,
    leads_used_this_month
  )
  VALUES (
    NEW.id,
    v_full_name,
    'free',
    10,
    0
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Remove trigger anterior se existir e recria
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- ==============================================================================
-- ROW LEVEL SECURITY (RLS) - SEGURANÇA E PRIVACIDADE DE DADOS
-- ==============================================================================

-- Habilita RLS em todas as tabelas
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saved_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.searches ENABLE ROW LEVEL SECURITY;

-- Políticas para PROFILES
DROP POLICY IF EXISTS "Usuários podem ver seu próprio perfil" ON public.profiles;
CREATE POLICY "Usuários podem ver seu próprio perfil"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

DROP POLICY IF EXISTS "Usuários podem atualizar seu próprio perfil" ON public.profiles;
CREATE POLICY "Usuários podem atualizar seu próprio perfil"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Políticas para LEADS (compartilhados entre usuários autenticados)
DROP POLICY IF EXISTS "Usuários autenticados podem consultar leads" ON public.leads;
CREATE POLICY "Usuários autenticados podem consultar leads"
  ON public.leads FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Usuários autenticados podem inserir novos leads" ON public.leads;
CREATE POLICY "Usuários autenticados podem inserir novos leads"
  ON public.leads FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Políticas para SAVED_LEADS
DROP POLICY IF EXISTS "Usuários gerenciam apenas seus próprios leads salvos" ON public.saved_leads;
CREATE POLICY "Usuários gerenciam apenas seus próprios leads salvos"
  ON public.saved_leads FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Políticas para SEARCHES
DROP POLICY IF EXISTS "Usuários gerenciam apenas suas próprias buscas" ON public.searches;
CREATE POLICY "Usuários gerenciam apenas suas próprias buscas"
  ON public.searches FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

