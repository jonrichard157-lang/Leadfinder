-- ==============================================================================
-- ORBELEAD — CRIA PERFIS PARA CONTAS ANTIGAS
-- Contas criadas antes do trigger `on_auth_user_created` (schema.sql) ficaram sem
-- linha em public.profiles: não conseguem buscar, salvar leads nem virar admin.
-- Pode ser executado mais de uma vez.
-- ==============================================================================

INSERT INTO public.profiles (id, full_name)
SELECT
  u.id,
  COALESCE(u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'name', split_part(u.email, '@', 1))
FROM auth.users u
ON CONFLICT (id) DO NOTHING;
