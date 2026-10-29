# OrbeLead

Plataforma de prospecção comercial para freelancers, desenvolvedores e agências
digitais: encontra empresas locais sem site próprio usando a Google Places API.

Stack: **Next.js 16 (App Router)**, **Supabase** (Auth + Postgres) e deploy na **Vercel**.

## Rodar localmente

```bash
npm install
npm run dev
```

Copie `.env.example` para `.env.local` e preencha:

| Variável | Obrigatória | Uso |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | sim | URL do projeto Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | sim | Chave pública (anon) do Supabase |
| `GOOGLE_PLACES_API_KEY` | em produção | Places API (New). Sem ela, `npm run dev` usa dados simulados e produção retorna erro na busca |

## Banco de dados (Supabase)

No SQL Editor do Supabase, execute em ordem:

1. `supabase/schema.sql` — tabelas, RLS e criação automática de perfis
2. `supabase/migrations/002_team_access_and_limits.sql` — limites de plano e acesso da equipe
3. `supabase/migrations/003_backfill_profiles.sql` — cria perfis para contas antigas

## Planos e limites

Os limites são aplicados no banco (funções `consume_search` e trigger `enforce_lead_quota`),
não no navegador. Os contadores zeram automaticamente a cada mês.

| | Buscas/mês | Leads salvos/mês |
| --- | --- | --- |
| Grátis | 10 (`monthly_search_limit`) | 10 (`monthly_lead_limit`) |
| Pro | ilimitadas | `monthly_lead_limit` |
| Agência | ilimitadas | ilimitados |
| Equipe / Admin | ilimitadas | ilimitados |

## Acesso da equipe

Contas da equipe usam todas as funcionalidades sem plano. O acesso é liberado por
**código de verificação** (formato `ORBE-XXXX-XXXX-XXXX`), guardado no banco só como hash,
com validade, número máximo de usos e bloqueio após 5 tentativas erradas em 15 minutos.

- **Primeiro admin** (uma vez, no SQL Editor):
  ```sql
  UPDATE public.profiles SET role = 'admin'
   WHERE id = (SELECT id FROM auth.users WHERE email = 'seu-email@exemplo.com');
  ```
- **Gerar códigos:** página `/app/equipe` (visível só para admins) ou no SQL Editor:
  `SELECT public.create_team_code('Equipe dev', 5, 30);` (identificação, usos, dias de validade)
- **Resgatar:** a pessoa cria uma conta normal e informa o código em
  Configurações → Acesso da equipe.
- **Revogar:** na página `/app/equipe` (códigos ainda não usados ou membros).

## Marca

- Logo no site: `src/components/brand/Logo.tsx` (`<Logo />`, `<LogoMark />`)
- Favicon, ícones de app e imagem de perfil (1024px, para redes sociais) em
  `src/app/` e `public/brand/`, gerados por `node scripts/brand-assets.mjs`
- Paleta: navy `#0B1437`, azul `#2F6BF0 → #4F46E5`; fonte do logotipo: Poppins

## Estrutura

```
src/app/
  page.tsx                     → Landing page
  login/, cadastro/, recuperar-senha/
  api/leads/search/route.ts    → Busca (cota do plano + Google Places)
  app/page.tsx                 → Dashboard
  app/buscar/, app/resultados/ → Busca de leads
  app/meus-leads/, app/leads/[id]/
  app/assinatura/, app/configuracoes/
  app/equipe/                  → Gestão da equipe (admin)

src/lib/services/  → search.ts (Google Places), leads.ts, team.ts
src/lib/supabase/  → clientes browser/servidor e proxy de sessão
src/proxy.ts       → protege /app/* (exige login)
supabase/          → schema.sql e migrations/
```
