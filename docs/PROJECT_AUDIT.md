# OrbeLead — Auditoria Técnica do Projeto

- **Data:** 04/11/2026
- **Branch auditada:** `audit/orbelead-evolution` (criada a partir de `main` @ `3cf9a24`)
- **Escopo:** leitura do código-fonte, schema e migrações do Supabase, typecheck, lint e `npm audit`. Nenhum arquivo de código foi alterado, nenhuma migração foi executada e nenhum valor de `.env` foi lido ou exposto.
- **Limitação:** o banco Supabase em produção não foi consultado. O estado do banco descrito aqui vem de `supabase/schema.sql` e `supabase/migrations/`. Não há garantia de que as migrações 002 e 003 foram aplicadas em produção.

Legenda de status: ✅ funcionando · 🟡 parcial · ❌ não existe (ou só existe visualmente)

---

## A. Estado atual do projeto

O OrbeLead (antigo LeadFinder) é um **MVP funcional** de prospecção local: o usuário busca empresas no Google Places por cidade e categoria, o sistema calcula um Opportunity Score focado em "empresa sem site", e o usuário salva leads numa lista pessoal com status e anotações (um mini-CRM). Existe controle de cota mensal no banco e um sistema de acesso de equipe por código.

A parte **comercial do SaaS não existe**: não há cobrança, não há troca de plano, e os limites anunciados nos planos pagos não correspondem ao que o banco aplica.

| Métrica | Valor |
|---|---|
| Linhas em páginas e componentes (`.tsx`) | ~3.600 |
| Rotas de API | 1 (`POST /api/leads/search`) |
| Tabelas no Supabase | 7 |
| Testes automatizados | nenhum |
| `tsc --noEmit` | ✅ sem erros |
| `eslint` | ✅ 0 erros, 2 avisos |
| `npm audit` (produção) | ⚠️ `next` crítica, `sharp` alta |

### 1. Estrutura de diretórios

```
src/
  app/                    App Router (Next.js 16)
    page.tsx              Landing page
    login/ cadastro/ recuperar-senha/
    app/                  Painel autenticado
      page.tsx            Dashboard
      buscar/ resultados/ meus-leads/ leads/[id]/
      assinatura/ configuracoes/ equipe/
    api/leads/search/route.ts   Única rota de servidor
    manifest.ts layout.tsx globals.css
  components/
    brand/ landing/ layout/ leads/ ui/
  hooks/useUser.ts        Sessão + perfil (client-side)
  lib/
    services/             leads.ts, search.ts, team.ts
    supabase/             client.ts, server.ts, proxy.ts
    scoring.ts contact.ts export.ts searchCache.ts utils.ts supabase.ts
  mocks/                  leads.ts (CATEGORIES + mocks), plans.ts (PLANS)
  types/index.ts
  proxy.ts                "Middleware" do Next 16 (renomeado para proxy)
supabase/
  schema.sql  seed.sql  migrations/002_*.sql  migrations/003_*.sql
scripts/brand-assets.mjs  Geração de logos/ícones
```

### 2. Tecnologias e dependências

| Camada | Tecnologia |
|---|---|
| Framework | Next.js **16.3.1** (App Router, `proxy.ts` no lugar de `middleware.ts`), build com `--webpack` |
| UI | React 19.2.8, Tailwind CSS 4, lucide-react |
| Backend/DB/Auth | Supabase (`@supabase/ssr` 0.12, `@supabase/supabase-js` 2.112) |
| Dados externos | Google Places API (New): `places:searchText` |
| Deploy | Vercel (`vercel.json` mínimo) |
| Linguagem | TypeScript 5 (strict, sem erros) |

Ainda não existem: biblioteca de testes, validação de schema (zod etc.), gateway de pagamento, envio de e-mail transacional, filas/jobs, observabilidade (Sentry etc.), gerenciamento de estado/cache de dados (React Query/SWR).

---

## B. Funcionalidades existentes

### 3. Páginas e componentes

| Rota | Função | Status |
|---|---|---|
| `/` | Landing: Hero, Features, HowItWorks, Pricing, FAQ, Footer | ✅ (estática) |
| `/login` | Login por e-mail e senha | ✅ |
| `/cadastro` | Cadastro, com tratamento de confirmação de e-mail | ✅ |
| `/recuperar-senha` | Envia link de reset para `/app/configuracoes` | ✅ |
| `/app` | Dashboard com estatísticas e leads recentes | ✅ |
| `/app/buscar` | Formulário de filtros | ✅ |
| `/app/resultados` | Resultados, salvar, ordenar por score, exportar CSV, cache da sessão | ✅ |
| `/app/meus-leads` | Lista de leads salvos e exportação CSV | ✅ |
| `/app/leads/[id]` | Detalhe, status do funil, anotações, WhatsApp | ✅ (usa `window.alert` para erros) |
| `/app/assinatura` | Planos e uso | 🟡 só exibe; botões de assinar e "Gerenciar cobrança" não fazem nada |
| `/app/configuracoes` | Perfil, senha, notificações, código de equipe | 🟡 a aba Notificações não salva nada (checkboxes locais) |
| `/app/equipe` | Admin: criar e revogar códigos, remover membros | ✅ |

Componentes reutilizáveis: `ui/` (Button, Card, Input, Badge), `leads/` (LeadCard, OpportunityScore, StatCard, StatusBadge), `layout/` (AppLayout, Sidebar, Topbar, AuthLayout, nav), `brand/Logo`.

### 4. Rotas e APIs

| Endpoint | Método | Auth | Descrição |
|---|---|---|---|
| `/api/leads/search` | POST | Sessão Supabase (cookie) | Consome a cota (`consume_search`), chama o Google, grava o cache em `leads`, grava `searches` e marca `saved` |

Todo o resto (salvar lead, status, notas, perfil, equipe) é feito **direto do navegador** para o Supabase com a anon key, protegido por RLS e funções `SECURITY DEFINER`. Não há Server Actions.

### 5. Banco de dados (Supabase)

| Tabela | Finalidade | RLS |
|---|---|---|
| `profiles` | Perfil, plano, papel, limites e contadores de uso | SELECT e UPDATE do próprio perfil; UPDATE só nas colunas `full_name`, `company`, `avatar_url`, `updated_at` (002) |
| `leads` | Catálogo **global e compartilhado** de empresas (`place_id` único) | SELECT e INSERT liberados para qualquer usuário autenticado; sem UPDATE e sem DELETE |
| `saved_leads` | Relação usuário↔lead, com status e notas (JSONB) | ALL só nas próprias linhas |
| `searches` | Histórico de buscas (filtros + quantidade de resultados) | ALL só nas próprias linhas |
| `team_access_codes` | Códigos de equipe (somente o hash SHA-256) | RLS ligado e sem políticas; acesso apenas via funções |
| `team_code_redemptions` | Quem resgatou cada código | idem |
| `team_code_attempts` | Tentativas inválidas (anti força bruta) | idem |

Funções e triggers: `handle_new_user` (cria o perfil ao cadastrar), `reset_usage_if_new_month`, `consume_search` (RPC), trigger `enforce_lead_quota` em `saved_leads`, `create_team_code`, `redeem_team_code`, `team_overview`, `revoke_team_code`, `remove_team_member`, `is_team_admin`, `hash_team_code`.

Colunas existentes mas sem uso: `leads.raw_data`. Ainda não existem: tabelas de assinaturas, pagamentos, organizações/workspaces, campanhas, contatos, atividades e integrações.

### 6. Autenticação e permissões

- ✅ Supabase Auth com e-mail e senha; sessão por cookie (`@supabase/ssr`).
- ✅ `proxy.ts` redireciona visitante não autenticado de `/app/*` para `/login` e usuário logado de `/login` para `/app`.
- ✅ Papéis `user` / `team` / `admin` em `profiles.role`; o usuário não consegue se promover (UPDATE de colunas restrito).
- ✅ Código de equipe: hash SHA-256, validade, limite de usos, 5 tentativas a cada 15 min.
- 🟡 A página `/app/equipe` é protegida no banco (RPC exige admin); a interface só esconde o link.
- ❌ OAuth (Google), 2FA, convites por e-mail, multiusuário por organização.
- O primeiro admin é criado manualmente via SQL.

### 7. Integração com Google Places

- ✅ Places API (New) `searchText`, `languageCode=pt-BR`, `regionCode=BR`, field mask explícita (SKU Enterprise por causa de telefone, site e avaliações).
- ✅ Estratégia: até 3 páginas na cidade e depois 4 quadrantes em volta do centro (mediana das coordenadas), parando em 20 leads válidos ou **6 requisições por busca**.
- ✅ Detecta "sem site próprio": Instagram, WhatsApp, Linktree, iFood e apps de agendamento contam como sem site (`NON_WEBSITE_HOSTS`).
- ✅ Sem chave: dados gerados em desenvolvimento; em produção a busca retorna erro.
- 🟡 Sem cache no servidor: buscas idênticas de usuários diferentes chamam o Google de novo. O cache existe só no `sessionStorage` do navegador (5 entradas).
- ❌ Place Details, fotos, horários, Place ID refresh, geocodificação da cidade (o raio é aplicado em torno da mediana dos resultados, não da cidade).

### 8. Sistema de buscas e filtros

Filtros: localização (texto livre), categoria (lista fixa em `mocks/leads.ts`), raio em km, "apenas sem site", nota mínima, mínimo de avaliações. Regra fixa: descarta empresas sem telefone **e** sem link. Os filtros são aplicados depois da busca, e os parâmetros ficam na URL de `/app/resultados`. ✅ Funciona; 🟡 limitado a 20 resultados, sem paginação e sem "carregar mais".

### 9. Cadastro e armazenamento de leads

- O resultado da busca é gravado em `leads` com `upsert ... ignoreDuplicates` (os dados **nunca são atualizados** depois da primeira gravação).
- Ao salvar, `toggleSaveLead` garante a linha em `leads` e insere em `saved_leads`; o trigger conta a cota.
- Status do funil: `novo → contatado → em_negociacao → convertido / descartado`.
- Notas em array JSONB dentro de `saved_leads.notes`.
- Exportação CSV (BOM UTF-8) no cliente.
- ✅ Funciona. ❌ Cadastro manual de lead (o tipo `source: 'manual'` existe, mas não há tela), edição de dados do lead, tags, importação.

### 10. Opportunity Score

`src/lib/scoring.ts`: regra fixa de 0 a 100. Base 50; sem site **+35** / com site **−30**; nota ≥4,5 +10, ≥4,0 +6, <3,5 −8; avaliações ≥50 +12, ≥20 +8, ≥5 +4, 0 −8; telefone +5. ✅ Funciona e é determinístico.
🟡 O parâmetro `category` é recebido mas **ignorado**; o comentário em `types` cita "poucas avaliações, categoria" e não reflete o código. Mede apenas uma tese ("precisa de site"), sem pesos configuráveis e sem explicação exibida ao usuário. O dashboard considera "alta oportunidade" a partir de score ≥ 75.

### 11. Planos, assinaturas e controle de uso

| Item | Status |
|---|---|
| Planos `free` / `pro` / `agencia` definidos em `mocks/plans.ts` (preços R$0 / R$97 / R$247) | 🟡 estático |
| Cota de buscas aplicada no banco (`consume_search`) | ✅ free = 10/mês; pro, agência e equipe ilimitados |
| Cota de leads aplicada no banco (trigger) | ✅ mas veja os problemas abaixo |
| Reset mensal automático (preguiçoso, na próxima ação) | ✅ |
| Cobrança, checkout, webhooks, faturas, upgrade/downgrade | ❌ |
| Ajuste de `monthly_lead_limit` por plano | ❌ fica no padrão 10 para todos os planos |
| Multiusuário do plano Agência, "organização por cliente", "integrações" | ❌ anunciado mas inexistente |

---

## C. Problemas encontrados

### Segurança (por severidade)

| # | Sev. | Problema | Local |
|---|---|---|---|
| S1 | **Alta** | `next@16.3.1` tem um advisory **crítico** (GHSA-h694-7cp9-m8p3, vazamento de cache em `use cache`) e `sharp` tem advisories **altos**. O projeto não usa `use cache`, o que reduz a exposição, mas o pacote precisa ser atualizado. | `package.json` |
| S2 | **Alta** | **Envenenamento do catálogo `leads`:** qualquer usuário autenticado pode fazer INSERT de linhas arbitrárias (`WITH CHECK (true)`), inclusive com `place_id` real de terceiros, antes que o lead seja buscado. Como o upsert ignora duplicados, o dado falso (telefone, site, nome) passa a ser servido a **todos** os usuários para sempre. | `schema.sql` (política de INSERT em `leads`), `toggleSaveLead` |
| S3 | **Média** | **Open redirect no login:** `?redirect=` é passado sem validação para `router.push`. Um link `/login?redirect=https://site-malicioso` leva o usuário para fora do site logo após o login (phishing). | `src/app/login/page.tsx:15` |
| S4 | **Média** | **Custo do Google sem teto:** pro, agência e equipe têm buscas ilimitadas; cada busca faz até 6 chamadas Enterprise. Não há rate limit por minuto nem limite global. Com o trial do Google Cloud acabando em **08/11/2026**, uma conta (ou um script) pode gerar uma fatura alta. | `consume_search`, `search.ts` |
| S5 | Média | `radiusKm`, `minRating` e `minReviews` chegam do cliente sem limites nem validação de tipo; `location` e `category` são textos livres repassados ao Google (sem risco de injeção, mas sem limite de tamanho). | `route.ts` |
| S6 | Baixa | Sem cabeçalhos de segurança (CSP, HSTS, X-Frame-Options, Referrer-Policy). | `next.config.ts` |
| S7 | Baixa | `searches` aceita INSERT direto do cliente: o usuário pode inflar "Leads encontrados" no próprio dashboard. Afeta só o próprio usuário, mas compromete métricas futuras. | RLS de `searches` |
| S8 | Baixa | Senha mínima de 6 caracteres; sem 2FA. | Supabase Auth / configurações |
| S9 | Info | `is_team_admin()` retorna `true` quando `auth.uid()` é nulo (pensado para o SQL Editor/service_role). Hoje é seguro porque `anon` não tem EXECUTE, mas é uma armadilha se alguém conceder EXECUTE a `anon` no futuro. | `002_*.sql` |

Pontos positivos: RLS ativo em todas as tabelas; papel e plano protegidos por GRANT de colunas; cotas no banco (não no navegador); códigos de equipe com hash e rate limit; chave do Google só no servidor; `.env` fora do git (só `.env.example`).

### Bugs e inconsistências funcionais

| # | Problema | Local |
|---|---|---|
| B1 | **Plano Pro anuncia 500 leads/mês, mas o banco aplica 10** (nada altera `monthly_lead_limit` quando muda o plano, e não existe fluxo para mudar o plano). | `plans.ts` × `enforce_lead_quota` |
| B2 | **Desmarcar e marcar de novo consome cota**: cada INSERT em `saved_leads` incrementa `leads_used_this_month`, e o DELETE não devolve. | trigger `enforce_lead_quota` |
| B3 | **A cota de busca é consumida antes de validar o body e mesmo quando o Google falha**: erro do Google custa uma busca ao usuário free. | `route.ts` |
| B4 | `addLeadNote` retorna uma nota "fantasma" quando a gravação falha: o usuário vê a nota, mas ela não foi salva. | `services/leads.ts` |
| B5 | `updateLeadStatus` ignora o retorno: falha silenciosa na tela de detalhe. | `leads/[id]/page.tsx` |
| B6 | Dados de `leads` nunca são atualizados (telefone, nota, site e score ficam congelados na primeira gravação). | `ignoreDuplicates` |
| B7 | Em desenvolvimento sem chave, os leads simulados (`dev_*`) são gravados na mesma tabela `leads` com `source: 'google_places'`. Se o ambiente de dev apontar para o Supabase de produção, polui o catálogo. | `search.ts`, `route.ts` |
| B8 | Aba Notificações, botões "Assinar" e "Gerenciar cobrança" e "Histórico de faturas" são só visuais. | `configuracoes`, `assinatura` |
| B9 | `getUserDashboardStats` carrega **todos** os leads salvos para contar; `getSavedLeads` não pagina. Fica lento com volume. | `services/leads.ts` |
| B10 | Erros exibidos com `window.alert`. | `leads/[id]/page.tsx` |

### Dívida técnica

- Dados reais de produto em `src/mocks/` (`PLANS`, `CATEGORIES`): o nome engana e os planos não estão no banco.
- Todo o app é client-side (`'use client'`) com o cliente Supabase no navegador: sem SSR de dados, várias idas e voltas por tela, regras espalhadas entre cliente e SQL.
- Mapeamento manual `snake_case` ↔ `camelCase` sem tipos gerados do Supabase (`supabase gen types`).
- Sem testes, sem CI, sem validação de entrada.
- Migrações executadas à mão no SQL Editor (`schema.sql` + arquivos numerados, sem a pasta `001`); não há Supabase CLI nem controle do que já foi aplicado.
- Avisos de lint: fonte customizada em `layout.tsx` e `window.location.href` em `useUser.ts`.
- `README.md` e comentários com referências ao nome LeadFinder e ao estado de "mocks".

---

## D. Funcionalidades que podem ser reaproveitadas

| Item | Motivo |
|---|---|
| Integração Google Places (`search.ts`) | Estratégia de quadrantes, field mask e detecção de "sem site próprio" são sólidas; basta extrair um "provider" |
| Camada Supabase SSR (`lib/supabase/*`, `proxy.ts`) | Padrão oficial e correto |
| Funções SQL de cota (`consume_search`, trigger) | O padrão "cota no banco com `FOR UPDATE`" é o certo; só precisa ser parametrizado por plano |
| Sistema de equipe por código | Seguro e completo; vira a base dos convites de organização |
| `contact.ts` (WhatsApp, rótulos de links) | Útil para automação de contato |
| `export.ts` (CSV) | Reaproveitável; pode ir para o servidor |
| UI kit (`components/ui`, `leads`, `layout`) e identidade visual | Base consistente |
| Status de funil e notas | Ponto de partida do CRM |
| `searchCache.ts` | Boa experiência de navegação; mantém-se como cache de UI |

---

## E. Funcionalidades que precisam ser modificadas

1. **Planos**: sair de `mocks/plans.ts` para uma tabela `plans` (limites, preço, recursos), com `monthly_lead_limit` e `monthly_search_limit` derivados do plano.
2. **Política de INSERT em `leads`**: permitir escrita só pelo servidor (service role na rota de API) ou por função `SECURITY DEFINER`; nunca direto do cliente.
3. **Cotas**: contar leads *únicos* salvos no mês (ou ignorar re-salvamento); consumir a busca só depois do sucesso no Google (ou estornar em caso de falha); adicionar rate limit e um teto de custo para planos "ilimitados".
4. **Login**: aceitar `redirect` apenas como caminho relativo iniciado por `/app`.
5. **Rota de busca**: validar a entrada (zod), limitar o raio e o tamanho dos textos; adicionar cache de servidor por (consulta, região, TTL) para reduzir o custo do Google.
6. **Catálogo `leads`**: atualizar dados periodicamente (`updated_at`, refresh por `place_id`) e usar `raw_data`.
7. **Opportunity Score**: versionar (`score_version`), usar categoria e outros sinais, guardar os motivos e exibir "por que este score".
8. **Notas**: de JSONB para tabela `lead_notes`/`activities` (autoria, histórico, multiusuário).
9. **Arquitetura de dados**: mover mutações sensíveis para Route Handlers/Server Actions; tipos gerados do Supabase.
10. **Atualizar dependências**: `next` (advisory crítico) e `sharp`.

---

## F. Funcionalidades novas necessárias (visão SaaS de inteligência comercial)

**Fundação SaaS**
- Billing: Stripe ou gateway nacional (Asaas, Mercado Pago, Pagar.me, com Pix e boleto), checkout, webhooks, portal do cliente, faturas, trial, upgrade e downgrade.
- Tabelas `subscriptions`, `invoices`, `usage_events` (registro de uso auditável, em vez de apenas contadores).
- Organizações/workspaces com membros e papéis (owner/admin/membro), necessários para o plano Agência.
- Painel administrativo interno (usuários, planos, consumo do Google, custos).
- E-mail transacional (boas-vindas, limite atingido, resumo semanal) e notificações reais.

**Inteligência comercial**
- Enriquecimento: Place Details, e-mail, redes sociais, CNPJ (Receita), porte, presença digital (auditoria de site, Instagram).
- Score configurável por nicho/tese de venda (site, tráfego pago, SEO, automação…).
- Buscas salvas e monitoramento ("avise quando surgirem novos leads de X em Y").
- Mapa de leads e análise de mercado por região/categoria.

**Automação de prospecção**
- Pipeline Kanban, tarefas e follow-ups.
- Templates de mensagem (WhatsApp/e-mail) com variáveis; cadências/sequências.
- Integração com WhatsApp Business API e e-mail (envio e rastreamento), respeitando a LGPD e os termos do WhatsApp.
- Geração de mensagens com IA a partir dos dados do lead.
- Integrações: webhooks, CRMs (RD Station, HubSpot, Pipedrive), Google Sheets, API pública.

**Operação**
- Testes (unitários para score e filtros, e2e para busca e salvamento), CI, Sentry/logs, ambientes separados (dev/staging/prod) com Supabase CLI e migrações versionadas.
- LGPD: termos de uso, política de privacidade, base legal para dados de empresas e contatos, opt-out.

---

## G. Riscos técnicos

| Risco | Impacto | Probabilidade |
|---|---|---|
| Fim do trial do Google Cloud (08/11/2026) com buscas ilimitadas e sem teto | Fatura inesperada / busca fora do ar | **Alta** |
| Catálogo `leads` adulterável por qualquer usuário | Dados falsos servidos a todos os clientes | Média |
| Venda dos planos pagos sem cobrança nem limites coerentes | Receita zero e promessa (500 leads) descumprida | Alta, assim que vender |
| Migrações manuais sem controle | Produção divergente do repositório; difícil reproduzir | Média |
| Ausência de testes ao refatorar um app todo client-side | Regressões em busca, cota e salvamento | Alta durante a evolução |
| Termos do Google Places (armazenamento permanente de conteúdo do Places é restrito; `place_id` pode ser guardado) | Risco contratual ao manter catálogo e cache de longo prazo | Média |
| LGPD e uso de WhatsApp para prospecção ativa | Risco legal e de bloqueio de número | Média (quando a automação existir) |
| Dependência do `next` com advisory crítico | Vulnerabilidade conhecida | Média |
| Escalabilidade de consultas sem paginação | Lentidão no dashboard e em "Meus Leads" | Baixa hoje, cresce com uso |

---

## H. Recomendações para a evolução

**Fase 0: Estabilizar (antes de qualquer feature nova, idealmente antes de 08/11)**
1. Configurar cota e alerta de orçamento no Google Cloud; definir um teto diário de requisições por usuário e global.
2. Atualizar `next` e `sharp`.
3. Corrigir o open redirect do login.
4. Fechar o INSERT direto em `leads` (escrita só pelo servidor).
5. Confirmar no Supabase de produção que as migrações 002 e 003 estão aplicadas.

**Fase 1: Fundação SaaS**
6. Adotar Supabase CLI com migrações versionadas e ambientes dev/staging/prod.
7. Tabela `plans` + `subscriptions` + `usage_events`; limites derivados do plano; corrigir B1, B2 e B3.
8. Integrar o gateway de pagamento com webhooks idempotentes.
9. Introduzir organizações/workspaces (reaproveitar o fluxo de códigos de equipe para convites).
10. Validação (zod), testes do score, dos filtros e das cotas, e CI no GitHub Actions.

**Fase 2: Inteligência**
11. Cache de buscas no servidor e refresh do catálogo; extrair um provider de dados (Google hoje; outras fontes depois).
12. Score v2 explicável e configurável; enriquecimento de leads.

**Fase 3: Automação**
13. Pipeline Kanban, atividades, templates, cadências, IA para mensagens e integrações.

**Princípios**
- Toda regra de negócio que envolve dinheiro ou cota fica no servidor ou no banco, nunca no navegador.
- Evolução incremental em branches, com feature flags para não interromper a `main`/produção.
- Cada fase entra com testes e migrações reversíveis.
