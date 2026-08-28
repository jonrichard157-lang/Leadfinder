# LeadFinder — v1 (Next.js)

Plataforma de prospecção comercial para freelancers, desenvolvedores e agências
digitais. Versão migrada de Vite para **Next.js (App Router)**. Interface
completa com dados mock, sem integrações externas.

## Rodar localmente

```bash
npm install
npm run dev
```

Build de produção:

```bash
npm run build
npm start
```

## Estrutura (App Router)

```
src/app/
  page.tsx                     → Landing Page ("/")
  login/page.tsx                → Login
  cadastro/page.tsx             → Cadastro
  recuperar-senha/page.tsx      → Recuperação de senha
  app/page.tsx                  → Dashboard ("/app")
  app/buscar/page.tsx           → Buscar Leads
  app/resultados/page.tsx       → Resultados
  app/meus-leads/page.tsx       → Meus Leads
  app/leads/[id]/page.tsx       → Detalhes do Lead (rota dinâmica)
  app/assinatura/page.tsx       → Assinatura
  app/configuracoes/page.tsx    → Configurações

src/components/  → ui, layout, leads, landing (mesma organização da v1)
src/mocks/       → leads.ts, plans.ts (dados fictícios)
src/types/       → tipos centrais do domínio
src/lib/         → utils.ts, supabase.ts (placeholder)
```

## Notas da migração Vite → Next.js

- Roteamento por arquivos (App Router) substitui `react-router-dom`.
- `Link` e `useRouter`/`usePathname`/`useParams` de `next/link` e
  `next/navigation` substituem os equivalentes do React Router.
- Componentes com estado/eventos (formulários, sidebar, cards com botões)
  têm a diretiva `'use client'`; o restante permanece Server Component.
- Variáveis de ambiente do Supabase agora usam o prefixo `NEXT_PUBLIC_`
  (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`) em vez do
  prefixo `VITE_`.

## O que NÃO está implementado nesta etapa (proposital)

- Google Maps / Google Places API
- Pagamentos (Stripe / Mercado Pago)
- IA e scraping
- Envio de mensagens
- Autenticação real (Supabase Auth) — os formulários de login/cadastro
  apenas navegam para `/app`
