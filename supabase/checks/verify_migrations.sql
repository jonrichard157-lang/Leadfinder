-- ==============================================================================
-- ORBELEAD — VERIFICA QUAIS MIGRAÇÕES ESTÃO APLICADAS
-- Somente leitura. Execute no SQL Editor do Supabase e confira a coluna "ok".
-- ==============================================================================

SELECT '002 · coluna profiles.role' AS item,
       EXISTS (SELECT 1 FROM information_schema.columns
                WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'role') AS ok
UNION ALL
SELECT '002 · função consume_search',
       EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'consume_search' AND pronamespace = 'public'::regnamespace)
UNION ALL
SELECT '002 · trigger enforce_lead_quota',
       EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'enforce_lead_quota')
UNION ALL
SELECT '002 · tabela team_access_codes',
       to_regclass('public.team_access_codes') IS NOT NULL
UNION ALL
SELECT '003 · todas as contas têm perfil',
       NOT EXISTS (SELECT 1 FROM auth.users u LEFT JOIN public.profiles p ON p.id = u.id WHERE p.id IS NULL)
UNION ALL
SELECT '004 · INSERT em leads fechado para usuários',
       NOT EXISTS (SELECT 1 FROM pg_policies
                    WHERE schemaname = 'public' AND tablename = 'leads' AND cmd = 'INSERT')
UNION ALL
SELECT '004 · teto diário (profiles.searches_today)',
       EXISTS (SELECT 1 FROM information_schema.columns
                WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'searches_today')
UNION ALL
SELECT 'Existe pelo menos um admin',
       EXISTS (SELECT 1 FROM public.profiles WHERE role = 'admin');
