# ORBELEAD MASTER TECHNICAL BLUEPRINT

- **Versão:** 1.0, 04/11/2026
- **Base:** [PROJECT_AUDIT.md](PROJECT_AUDIT.md) e o código da branch `audit/orbelead-evolution`, que inclui a Fase 0.
- **Função deste documento:** é a referência central do produto e da arquitetura. Toda decisão de módulo novo deve partir daqui e atualizar este arquivo.

### Convenção usada em todo o documento

| Marca | Significado |
|---|---|
| **[ATUAL]** | Implementado e funcionando no código hoje |
| **[PARCIAL]** | Existe no código, mas incompleto ou só visual |
| **[FASE 0]** | Implementado na branch de estabilização, ainda **sem deploy** (a migração 004 ainda não foi executada) |
| **[PROPOSTO]** | Arquitetura planejada; nada implementado |
| **[A VALIDAR]** | Proposta que depende de decisão de negócio, custo, termos de uso ou viabilidade jurídica antes de ser adotada |

Tecnologias e integrações marcadas como [PROPOSTO] ou [A VALIDAR] são **candidatas**. Nenhuma delas está em uso hoje.

---

## Sumário

1. [Visão geral do produto](#1-visão-geral-do-produto)
2. [Arquitetura funcional](#2-arquitetura-funcional)
3. [Arquitetura técnica](#3-arquitetura-técnica)
4. [Módulos: responsabilidades](#4-módulos-responsabilidades)
5. [Fluxos de funcionamento](#5-fluxos-de-funcionamento)
6. [Tecnologias](#6-tecnologias)
7. [Integrações externas](#7-integrações-externas)
8. [Estrutura de dados](#8-estrutura-de-dados)
9. [Segurança](#9-segurança)
10. [Regras de negócio](#10-regras-de-negócio)
11. [Roadmap](#11-roadmap)
12. [Critérios de conclusão por módulo](#12-critérios-de-conclusão-por-módulo)

---

## 1. Visão geral do produto

### 1.1 Proposta

O OrbeLead é uma plataforma SaaS de **inteligência comercial**. Ela encontra empresas, identifica quais têm uma oportunidade de negócio para o usuário, qualifica e pontua esses leads, organiza a prospecção num CRM e automatiza o contato, com relatórios para quem gerencia vendas.

Hoje o produto resolve um caso: **encontrar negócios locais sem site próprio** para quem vende sites e presença digital. A evolução generaliza essa tese. Cada usuário define **o que ele vende**, e o OrbeLead encontra e pontua quem precisa disso.

### 1.2 Públicos

| Público | Necessidade principal | Plano provável |
|---|---|---|
| Profissionais autônomos | Achar clientes rápido, sem ferramenta complexa | Free / Pro |
| Prestadores de serviços (agências, devs, designers, contadores, manutenção) | Lista qualificada por nicho e região, mais follow-up | Pro |
| Pequenas e médias empresas | Prospecção B2B recorrente com pouco esforço | Pro / Equipe |
| Equipes comerciais | Distribuir leads, acompanhar o funil, metas | Equipe |
| Empresas com departamento de vendas | Vários times, permissões, relatórios, integrações | Empresa |

### 1.3 Capacidades da plataforma

| # | Capacidade | Estado hoje |
|---|---|---|
| 1 | Busca geral de empresas | [ATUAL] via Google Places, por cidade e categoria |
| 2 | Busca por características comerciais | [PARCIAL] só "sem site", nota mínima e mínimo de avaliações |
| 3 | Identificação de oportunidades | [PARCIAL] só a tese "sem site próprio" |
| 4 | Busca por intenção pública de compra | [PROPOSTO] / [A VALIDAR] |
| 5 | Busca inteligente por descrição com IA | [PROPOSTO] |
| 6 | Análise e qualificação de leads | [PARCIAL] score fixo, sem enriquecimento |
| 7 | Opportunity Score | [ATUAL] v1 fixo; v2 configurável [PROPOSTO] |
| 8 | CRM integrado | [PARCIAL] 5 status e notas; sem pipeline, tarefas ou atividades |
| 9 | Gestão de equipes | [PARCIAL] papel "equipe interna" por código; sem organizações de clientes |
| 10 | Automação de prospecção | [PROPOSTO] (hoje existe só o link de WhatsApp) |
| 11 | Relatórios comerciais | [PARCIAL] 4 indicadores no dashboard e exportação CSV |
| 12 | Planos e assinaturas | [PARCIAL] planos estáticos e cotas no banco; sem cobrança |

### 1.4 Princípios de produto

1. **Lead acionável ou nada:** um lead sem canal de contato não é exibido. Essa regra já existe hoje.
2. **Explicável:** todo score mostra o motivo.
3. **Custo sob controle:** toda chamada paga a fornecedor externo passa por cota, cache e teto.
4. **Conformidade:** só dados públicos e com base legal (LGPD), respeitando os termos de cada fonte.
5. **Simples primeiro:** o autônomo usa sem treinamento; o recurso avançado aparece conforme o plano.

---

## 2. Arquitetura funcional

```
                         ┌──────────────────────────────────────────┐
                         │                USUÁRIO                   │
                         └───────────────┬──────────────────────────┘
                                         │
        ┌───────────────┬────────────────┼───────────────┬────────────────┐
        ▼               ▼                ▼               ▼                ▼
   DESCOBERTA      QUALIFICAÇÃO        CRM          AUTOMAÇÃO        RELATÓRIOS
 M2 Busca geral   M6 Enriquecimento  M8 Pipeline   M10 Templates    M11 Funil
 M3 Características M7 Score         Tarefas       Cadências        Produtividade
 M4 Intenção                         Atividades    Envio            Origem dos leads
 M5 Busca por IA                                   Rastreamento
        │               │                ▲               │                ▲
        └──────► CATÁLOGO DE EMPRESAS ───┘               └── EVENTOS ─────┘
                         │
        ┌────────────────┴──────────────────────────────────────────────┐
        │ PLATAFORMA: M1 Identidade · M9 Organizações e equipes ·        │
        │ M12 Planos, assinaturas e uso · M13 Admin · M14 Integrações    │
        └────────────────────────────────────────────────────────────────┘
```

### Ciclo de valor

**Descobrir → Qualificar → Priorizar → Contatar → Acompanhar → Medir**, repetido. Cada etapa gera dados para a próxima. Por exemplo: conversões alimentam a calibração do score (proposto para uma fase futura).

### Conceito central: o perfil de oferta [PROPOSTO]

Hoje a tese "sem site = oportunidade" está fixa no código (`scoring.ts`). Na evolução, cada organização cadastra um ou mais **perfis de oferta** ("vendo sites", "vendo contabilidade", "vendo manutenção de ar-condicionado"). Cada perfil define:

- os sinais que indicam necessidade (ex.: sem site, nota baixa, sem horário publicado);
- os pesos do score;
- os nichos e regiões-alvo;
- os templates de mensagem.

A tese atual vira o **perfil padrão "Presença digital"**, o que preserva o comportamento existente.

---

## 3. Arquitetura técnica

### 3.1 Implementação atual [ATUAL]

```
Navegador (React 19, 'use client' em todas as páginas)
  │  supabase-js (anon key) ──────────────► Supabase (Auth, Postgres, RLS, RPC)
  │  fetch POST /api/leads/search
  ▼
Vercel / Next.js 16 (App Router)
  ├─ proxy.ts ─ renova a sessão e protege /app/*
  └─ /api/leads/search ─ consume_search (RPC) → Google Places searchText
                         → upsert em leads → insert em searches
```

Características:
- Uma rota de servidor; o restante das operações vai direto do navegador para o Supabase, protegido por RLS e funções `SECURITY DEFINER`.
- As regras de cota ficam em PL/pgSQL.
- Não há jobs em segundo plano, filas, cache de servidor nem testes.
- **[FASE 0]** cliente com chave de serviço (`lib/supabase/admin.ts`) usado só pelo servidor para gravar o catálogo.

### 3.2 Arquitetura proposta [PROPOSTO]

Preserva Next.js, Supabase e Vercel. Acrescenta camadas, sem trocar a stack.

```
┌───────────────────────────── Next.js 16 na Vercel ─────────────────────────────┐
│  UI (App Router)                                                                │
│   • Server Components para leitura (dashboard, listas, relatórios)              │
│   • Client Components só onde há interação                                      │
│  Camada de aplicação (src/server/)                                              │
│   • Route Handlers / Server Actions: toda mutação sensível passa por aqui       │
│   • Validação de entrada (zod), autorização por organização e papel             │
│   • Serviços de domínio: discovery, scoring, crm, automation, billing           │
│  Adapters de provedores (src/server/providers/)                                 │
│   • places (Google), enrichment, ai, messaging, payments                        │
│   • Cada adapter: interface única, cache, medição de custo, tratamento de erros │
└───────────────┬──────────────────────────────────────────┬──────────────────────┘
                │                                          │
                ▼                                          ▼
        Supabase Postgres                           Jobs assíncronos
        • RLS por organization_id                   • Supabase Cron/pg_cron, Vercel Cron
        • Funções de cota e uso                       ou fila dedicada [A VALIDAR]
        • Auditoria (usage_events)                  • Enriquecimento, cadências,
        • Supabase Storage (exportações)              buscas monitoradas, refresh do catálogo
                │
                ▼
        Webhooks de entrada: gateway de pagamento, provedor de mensagens
```

### 3.3 Decisões de arquitetura

| Decisão | Escolha | Motivo |
|---|---|---|
| Stack base | Manter Next.js 16, React 19, Tailwind 4, Supabase e Vercel | Funciona, a equipe já conhece e o custo de troca é alto |
| Onde ficam as regras | Cotas e permissões no banco (RLS e funções); orquestração no servidor Next | O padrão atual de cotas no banco é robusto contra fraude pelo navegador |
| Multi-tenant | Coluna `organization_id` e RLS (um único banco) | Simples, escala bem para PMEs e é nativo no Supabase |
| Acesso a fornecedores externos | Somente pelo servidor, via adapters | Chaves protegidas, cache e controle de custo centralizados |
| Trabalho longo | Jobs assíncronos, nunca dentro da requisição do usuário | Limites de tempo das funções serverless |
| Tipos | `supabase gen types` + zod | Elimina o mapeamento manual atual |
| Migrações | Supabase CLI, versionadas, por ambiente | Hoje são executadas à mão |

### 3.4 Organização de código proposta

```
src/
  app/                      rotas (UI e api/)
  components/               já existe
  server/                   [PROPOSTO] só servidor ('server-only')
    auth/                   sessão, organização atual, checagem de papel
    discovery/              busca geral, características, intenção, IA
    scoring/                motor de score e perfis de oferta
    crm/                    leads, pipeline, atividades, tarefas
    automation/             templates, cadências, envios
    billing/                planos, assinaturas, uso, webhooks
    reports/
    providers/              google-places, ai, enrichment, messaging, payments
  lib/                      utilitários puros, compartilháveis com o cliente
  types/                    tipos de domínio + tipos gerados do banco
supabase/
  migrations/  checks/  seed.sql
```

O código atual (`lib/services/*`, `lib/scoring.ts`) migra aos poucos para `server/`, um módulo de cada vez.

---

## 4. Módulos: responsabilidades

| ID | Módulo | Responsabilidade | Estado |
|---|---|---|---|
| M1 | **Identidade e acesso** | Cadastro, login, recuperação de senha, sessão, perfil, papéis | [ATUAL] e-mail/senha; OAuth e 2FA [PROPOSTO] |
| M2 | **Busca geral** | Encontrar empresas por região e categoria | [ATUAL] |
| M3 | **Busca por características** | Filtrar por sinais comerciais (site, nota, avaliações, contato, horário, porte, idade) | [PARCIAL] |
| M4 | **Intenção pública de compra** | Encontrar demandas públicas declaradas (licitações, pedidos públicos de orçamento) | [PROPOSTO] / [A VALIDAR] |
| M5 | **Busca por IA** | Traduzir uma descrição em linguagem natural para filtros estruturados e reordenar os resultados | [PROPOSTO] |
| M6 | **Análise e qualificação** | Enriquecer o lead (detalhes, canais, presença digital) e classificar | [PROPOSTO] |
| M7 | **Opportunity Score** | Pontuar de 0 a 100 conforme o perfil de oferta, com os motivos | [ATUAL] v1; v2 [PROPOSTO] |
| M8 | **CRM** | Leads da organização, pipeline, responsável, atividades, tarefas, notas | [PARCIAL] |
| M9 | **Organizações e equipes** | Organizações, membros, convites, papéis, distribuição de leads | [PARCIAL] (só equipe interna) |
| M10 | **Automação** | Templates, cadências, envio e rastreamento por WhatsApp e e-mail | [PROPOSTO] |
| M11 | **Relatórios** | Funil, conversão, produtividade, origem, ROI por busca | [PARCIAL] |
| M12 | **Planos, assinaturas e uso** | Catálogo de planos, checkout, cobrança recorrente, cotas, medição | [PARCIAL] |
| M13 | **Administração interna** | Usuários, planos, custos de fornecedores, suporte, códigos de equipe | [PARCIAL] (página Equipe) |
| M14 | **Integrações** | Webhooks, API pública, CRMs externos, planilhas | [PROPOSTO] |
| M15 | **Notificações** | E-mail transacional, alertas no app, resumos | [PARCIAL] (aba só visual) |

### Detalhamento

**M1 Identidade.** Atual: Supabase Auth, `proxy.ts`, `useUser`, `profiles`. Proposto: login com Google, 2FA opcional para administradores, senha mínima maior, seleção de organização ativa.

**M2 Busca geral.** Atual: `lib/services/search.ts` com até 3 páginas na cidade mais 4 quadrantes, no máximo 6 requisições, 20 resultados. **[FASE 0]** filtros validados e limitados. Proposto: adapter `providers/google-places`; cache de servidor por (consulta, região) com prazo de validade; geocodificação da cidade para centralizar o raio; "carregar mais" com custo explícito.

**M3 Características.** Atual: sem site, nota mínima, mínimo de avaliações, exigência de contato. Proposto: catálogo de sinais (tem WhatsApp, só tem Instagram, horário publicado, quantidade de fotos, faixa de preço, status operacional, avaliações recentes). Cada sinal declara a fonte e o custo. Sinais que exigem Place Details são cobrados à parte.

**M4 Intenção pública de compra.** [A VALIDAR] Ideia: reunir sinais públicos de que uma empresa ou órgão **está procurando** um fornecedor. Fontes candidatas: compras públicas (ex.: portal nacional de contratações públicas), vagas publicadas (indicam necessidade de serviço) e pedidos públicos de orçamento. Cada fonte exige análise de termos de uso, de LGPD e de existência de API oficial **antes** de qualquer implementação. Raspagem de redes sociais fica fora do escopo. Entrega: um feed de oportunidades com fonte, data, link original e associação à empresa quando possível.

**M5 Busca por IA.** O usuário escreve "clínicas odontológicas em Curitiba com boas avaliações mas sem site e que respondem por WhatsApp". O modelo de IA devolve **filtros estruturados**, validados por schema, que alimentam M2 e M3. A IA não inventa empresas; ela só interpreta o pedido e reordena e explica resultados reais. Também gera um rascunho de mensagem de abordagem para M10. O fornecedor do modelo é [A VALIDAR]; a chamada fica no servidor com cota por plano.

**M6 Qualificação.** Enriquecimento sob demanda e em segundo plano: Place Details (horário, fotos, status), checagem do site (existe? é responsivo? tem HTTPS?), canais encontrados, dados cadastrais públicos de pessoa jurídica [A VALIDAR]. Os resultados viram `lead_signals`, que alimentam M7.

**M7 Opportunity Score.** Atual: `lib/scoring.ts` (base 50; ±35 pelo site; nota; avaliações; telefone). Proposto: veja a regra RN-SC na seção 10.

**M8 CRM.** Atual: `saved_leads` (5 status e notas em JSONB, por usuário). Proposto: leads pertencem à organização, com responsável, etapas de pipeline configuráveis (Kanban), atividades (ligação, mensagem, reunião), tarefas com prazo, histórico, tags e valor estimado do negócio.

**M9 Organizações.** Atual: `profiles.role` = user, team ou admin; códigos `ORBE-XXXX` dão acesso de equipe **interna** sem limites. Proposto: `organizations` e `organization_members` (owner, admin, manager, member), convites por e-mail (reaproveitando o padrão de hash, validade e tentativas dos códigos), distribuição de leads por rodízio ou manual, visibilidade por papel. O papel interno "team/admin" continua existindo como **staff do OrbeLead**, separado dos papéis dentro de uma organização.

**M10 Automação.** Templates com variáveis (`{{empresa}}`, `{{cidade}}`), cadências (passos com intervalos), execução por jobs, envio por e-mail e por WhatsApp oficial [A VALIDAR], rastreamento (enviado, entregue, respondido), parada automática quando o lead responde, e opt-out obrigatório. Atual: só o link `wa.me` (`lib/contact.ts`), que continua como modo manual.

**M11 Relatórios.** Atual: o dashboard mostra leads encontrados, leads salvos, sem site e alta oportunidade, além do CSV. Proposto: funil por etapa, taxa de conversão, tempo em cada etapa, atividade por membro, desempenho por busca, nicho e região, e custo por lead. Agregações feitas no banco (views ou funções), não no navegador.

**M12 Planos.** Atual: `mocks/plans.ts` (Grátis R$0, Pro R$97, Agência R$247), `consume_search`, `enforce_lead_quota`, reset mensal. **[FASE 0]** teto diário de 60 buscas. Proposto: tabelas `plans`, `subscriptions` e `usage_events`; gateway de pagamento [A VALIDAR]; webhooks idempotentes; trial; upgrade e downgrade; limites derivados do plano.

**M13 Admin.** Atual: `/app/equipe` (códigos e membros). Proposto: painel de staff com usuários e organizações, troca manual de plano, consumo e custo por fornecedor, bloqueio de abuso e log de auditoria.

**M14 Integrações.** Proposto: webhooks de saída (lead criado, etapa alterada), API pública com chave por organização, exportação para planilhas, conectores de CRMs [A VALIDAR].

**M15 Notificações.** Proposto: e-mail transacional (provedor [A VALIDAR]), notificações no app e preferências salvas no banco, que substituem os checkboxes que hoje não salvam nada.

---

## 5. Fluxos de funcionamento

### 5.1 Busca geral [ATUAL + FASE 0]

```
Usuário preenche /app/buscar → URL /app/resultados?filtros
  → existe cache na sessão (sessionStorage)? mostra os resultados e encerra
  → POST /api/leads/search
      1. getUser() → 401 se não houver sessão
      2. RPC consume_search → 403 se a cota acabou (mensal ou diária*)
      3. valida e limita os filtros*
      4. Google searchText: cidade (≤3 páginas) + quadrantes, ≤6 requisições, ≤20 leads
      5. upsert no catálogo leads (chave de serviço*, ou sessão como alternativa)
      6. insert em searches
      7. marca saved conforme saved_leads
  → resultados ordenados por score
(* = Fase 0)
```

### 5.2 Salvar lead [ATUAL + FASE 0]

```
Clique em "Salvar" → toggleSaveLead
  → procura o lead no catálogo (por UUID ou place_id); se não achar, erro "Refaça a busca"*
  → já está salvo? DELETE (remove dos salvos)
  → senão INSERT em saved_leads → trigger enforce_lead_quota (bloqueia ou incrementa)
```

### 5.3 Busca por IA [PROPOSTO]

```
Descrição em texto → servidor: cota de IA → modelo devolve JSON de filtros (validado por schema)
  → mostra os filtros interpretados para o usuário confirmar ou editar
  → executa o fluxo 5.1 com esses filtros
  → (opcional) a IA reordena e gera "por que este lead" com base nos sinais reais
```

### 5.4 Qualificação e score [PROPOSTO]

```
Lead salvo ou aberto → job de enriquecimento (se o plano permite e não há cache válido)
  → grava lead_signals → recalcula o score com o perfil de oferta da organização
  → guarda score, versão e motivos → a interface mostra o score e os motivos
```

### 5.5 Assinatura [PROPOSTO]

```
Escolhe o plano → servidor cria a sessão de checkout no gateway → usuário paga
  → webhook (assinatura validada, idempotente) → atualiza subscriptions
  → organização recebe os limites do plano → e-mail de confirmação
Falha de pagamento → período de carência → rebaixa para o Free (dados mantidos, só leitura acima do limite)
```

### 5.6 Cadência de prospecção [PROPOSTO]

```
Seleciona leads → escolhe a cadência → cria a inscrição (enrollment)
  → job executa cada passo no prazo → envia pelo canal → registra a atividade
  → resposta, opt-out ou etapa "convertido" → encerra a cadência daquele lead
```

### 5.7 Convite de membro [PROPOSTO]

```
Admin da organização convida por e-mail → token (só o hash fica no banco), validade 7 dias
  → convidado cria conta ou faz login → aceita → organization_members
  → assentos limitados pelo plano
```

---

## 6. Tecnologias

### 6.1 Em uso [ATUAL]

| Área | Tecnologia | Versão |
|---|---|---|
| Framework | Next.js (App Router, `proxy.ts`) | 16.4.5 [FASE 0] (era 16.3.1) |
| UI | React, React DOM | 19.2.8 |
| Estilo | Tailwind CSS (`@tailwindcss/postcss`) | 4 |
| Ícones | lucide-react | 1.33 |
| Backend como serviço | Supabase: Auth, Postgres, RLS, RPC | supabase-js 2.112, @supabase/ssr 0.12 |
| Proteção de módulos do servidor | server-only | 0.0.1 [FASE 0] |
| Linguagem | TypeScript (strict) | 5 |
| Qualidade | ESLint + eslint-config-next | 9 / 16.4.5 |
| Hospedagem | Vercel | — |
| Dados externos | Google Places API (New) | REST v1 |

### 6.2 Propostas (preservando a stack)

| Necessidade | Candidata | Status |
|---|---|---|
| Validação de entrada | zod | [PROPOSTO] |
| Tipos do banco e migrações | Supabase CLI | [PROPOSTO] |
| Testes unitários | Vitest | [PROPOSTO] |
| Testes ponta a ponta | Playwright | [PROPOSTO] |
| CI | GitHub Actions | [PROPOSTO] |
| Jobs agendados e filas | Supabase Cron/pg_cron, Vercel Cron ou fila dedicada | [A VALIDAR] |
| Arquivos (exportações, anexos) | Supabase Storage | [PROPOSTO] |
| Monitoramento de erros | Sentry ou equivalente | [A VALIDAR] |
| Rate limiting | Funções no Postgres (padrão atual) ou Redis gerenciado | [A VALIDAR] |
| Gráficos de relatórios | Biblioteca de gráficos React | [A VALIDAR] |

Regra: só entra uma dependência nova quando um módulo do roadmap precisa dela.

---

## 7. Integrações externas

| Integração | Uso | Estado | Observações |
|---|---|---|---|
| **Supabase** | Auth, banco, RLS | [ATUAL] | A chave de serviço só no servidor [FASE 0] |
| **Google Places API (New): Text Search** | Busca de empresas | [ATUAL] | SKU Enterprise (telefone, site, avaliações). Trial do Google Cloud termina em 08/11/2026: configurar quota e alerta de orçamento |
| **Vercel** | Hospedagem e deploy | [ATUAL] | |
| **WhatsApp (link `wa.me`)** | Abrir conversa manual | [ATUAL] | Não é uma API; só um link |
| Google Places: Place Details | Enriquecimento (M6) | [PROPOSTO] | Custo por chamada; cache obrigatório |
| Google Geocoding | Centro correto do raio (M2) | [PROPOSTO] | |
| Modelo de IA (LLM) | M5 e textos de M10 | [PROPOSTO] / [A VALIDAR] | Fornecedor a escolher; sempre pelo servidor |
| Gateway de pagamento | M12 | [A VALIDAR] | Requisitos: Pix, cartão recorrente, boleto, webhooks |
| E-mail transacional | M15 e M10 | [A VALIDAR] | Requisitos: domínio próprio, SPF/DKIM, webhooks de entrega |
| WhatsApp Business Platform (API oficial) | Envio automatizado (M10) | [A VALIDAR] | Exige templates aprovados e opt-in; proibido spam |
| Compras públicas e outras fontes de intenção | M4 | [A VALIDAR] | Apenas APIs oficiais ou fontes com licença clara |
| Dados cadastrais de PJ | M6 | [A VALIDAR] | Verificar a fonte oficial e a licença |
| CRMs externos e planilhas | M14 | [A VALIDAR] | |

Contrato comum para todo adapter de fornecedor:
- chave só no servidor;
- timeout e novas tentativas com backoff;
- registro de custo em `usage_events`;
- cache com prazo de validade;
- erro traduzido para mensagem amigável;
- feature flag para desligar o fornecedor.

---

## 8. Estrutura de dados

### 8.1 Atual [ATUAL]

| Tabela | Chaves e colunas principais |
|---|---|
| `profiles` | `id` (= auth.users), `full_name`, `company`, `plan` (free/pro/agencia), `role` (user/team/admin), `monthly_lead_limit`, `leads_used_this_month`, `monthly_search_limit`, `searches_used_this_month`, `usage_month`, `avatar_url`; **[FASE 0]** `searches_today`, `search_day` |
| `leads` | `id`, `place_id` (único), `name`, `category`, `address`, `city`, `state`, `phone`, `has_website`, `website`, `rating`, `reviews_count`, `opportunity_score`, `source`, `raw_data` (sem uso), `created_at`; **[FASE 0]** `updated_at` |
| `saved_leads` | `user_id`, `lead_id` (único por par), `status`, `notes` (JSONB), datas |
| `searches` | `user_id`, `filters` (JSONB), `results_count` |
| `team_access_codes` / `team_code_redemptions` / `team_code_attempts` | Códigos de equipe interna (hash), resgates e tentativas |

### 8.2 Modelo proposto [PROPOSTO]

```
organizations ─┬─ organization_members ── profiles
               ├─ subscriptions ── plans
               ├─ usage_events
               ├─ offer_profiles (perfis de oferta, pesos do score)
               ├─ pipelines ── pipeline_stages
               ├─ org_leads ──┬─ lead_activities
               │   (CRM)      ├─ lead_tasks
               │              ├─ lead_tags
               │              └─ lead_scores (por offer_profile, com versão e motivos)
               ├─ saved_searches (monitoradas)
               ├─ message_templates ── cadences ── cadence_steps
               │                         └─ cadence_enrollments ── messages
               ├─ api_keys / webhooks
               └─ invitations

leads (catálogo global, só o servidor grava) ── lead_signals (enriquecimento, com fonte e validade)
intent_signals (M4: fonte, link, data, empresa associada)
audit_log (ações administrativas e sensíveis)
```

| Tabela | Finalidade | Observações |
|---|---|---|
| `organizations` | Tenant | Toda conta nova recebe uma organização pessoal |
| `organization_members` | Papel do usuário na organização | owner, admin, manager, member |
| `plans` | Catálogo de planos e limites | Substitui `mocks/plans.ts` |
| `subscriptions` | Estado da assinatura | Espelha o gateway; atualizada só por webhook |
| `usage_events` | Registro imutável de consumo | Base de cotas, custo e relatórios |
| `org_leads` | Lead dentro do CRM da organização | Evolução de `saved_leads`; `owner_id`, `stage_id`, `value` |
| `lead_activities` | Linha do tempo | Substitui `notes` em JSONB |
| `lead_signals` | Sinais enriquecidos | `signal`, `value`, `source`, `fetched_at`, `expires_at` |
| `lead_scores` | Score por perfil de oferta | `score`, `version`, `reasons` (JSONB) |
| `offer_profiles` | Tese de venda | Sinais e pesos |
| `intent_signals` | Demanda pública | Sempre com URL e data da fonte |

### 8.3 Migração de dados (diretriz)

1. Criar uma organização pessoal para cada `profile` existente.
2. Copiar `saved_leads` para `org_leads` e transformar `notes` em `lead_activities` (tipo "nota").
3. Converter o `plan` do perfil numa `subscription` (manual, sem gateway).
4. Manter as tabelas antigas apenas para leitura durante 1 ciclo e remover depois que os relatórios forem conferidos.

Cada migração tem um script de verificação em `supabase/checks/`, como o `verify_migrations.sql` [FASE 0].

---

## 9. Segurança

### 9.1 Controles existentes

| Controle | Estado |
|---|---|
| RLS em todas as tabelas | [ATUAL] |
| Usuário não altera o próprio plano, papel ou contadores (GRANT por coluna) | [ATUAL] |
| Cotas aplicadas no banco com `FOR UPDATE` | [ATUAL] |
| Códigos de equipe: hash SHA-256, validade, limite de usos, 5 tentativas a cada 15 min | [ATUAL] |
| Chave do Google só no servidor | [ATUAL] |
| Redirecionamento do login restrito a `/app` | [FASE 0] |
| Catálogo `leads` gravado só pelo servidor | [FASE 0] (migração 004 pendente) |
| Filtros validados e limitados | [FASE 0] |
| Teto diário de buscas | [FASE 0] (migração 004 pendente) |
| Dependências sem vulnerabilidades conhecidas (`npm audit`: 0) | [FASE 0] |

### 9.2 Requisitos para a arquitetura proposta

1. **Isolamento entre organizações:** toda tabela de tenant tem `organization_id` e RLS baseada na participação do usuário na organização. Testes automatizados verificam que o usuário A não lê dados da organização B.
2. **Mutações sensíveis no servidor:** cobrança, envio de mensagens, consumo de fornecedores pagos e convites passam por Route Handlers ou Server Actions com validação zod e checagem de papel.
3. **Segredos:** só em variáveis de ambiente do servidor; nunca com o prefixo `NEXT_PUBLIC_`; separados por ambiente; rotação documentada.
4. **Webhooks:** validação de assinatura, idempotência por ID do evento, rejeição de eventos antigos.
5. **Rate limiting:** por usuário, por organização e global para cada fornecedor externo.
6. **Cabeçalhos HTTP:** CSP, HSTS, X-Frame-Options/frame-ancestors, Referrer-Policy em `next.config.ts`.
7. **Auth:** senha mínima de 8 ou mais caracteres; 2FA para staff e admins de organização; sessões revogáveis.
8. **Auditoria:** `audit_log` para mudanças de plano, papel, convites, exportações e chaves de API.
9. **IA:** a entrada do usuário nunca vira SQL nem chamada direta; a saída do modelo passa por validação de schema; não enviar ao modelo dados pessoais além do necessário.
10. **LGPD:** base legal (legítimo interesse para dados públicos de empresas), política de privacidade, canal de exclusão, opt-out respeitado em todas as cadências, retenção definida.
11. **Termos de fornecedores:** respeitar os limites de armazenamento de conteúdo do Google Places (o `place_id` pode ser guardado; outros campos têm restrições) [A VALIDAR com os termos vigentes].

---

## 10. Regras de negócio

### 10.1 Regras vigentes [ATUAL]

| ID | Regra |
|---|---|
| RN-01 | Lead sem telefone **e** sem link não é exibido |
| RN-02 | Instagram, Facebook, TikTok, WhatsApp, Linktree, iFood e apps de agendamento **não** contam como site próprio, mas são mantidos como canal de contato |
| RN-03 | Uma busca retorna no máximo 20 leads e usa no máximo 6 requisições ao Google |
| RN-04 | Plano Free: 10 buscas e 10 leads salvos por mês |
| RN-05 | Pro e Agência: buscas mensais ilimitadas; Agência e equipe: leads ilimitados |
| RN-06 | Equipe e admin (staff) não têm limites de plano |
| RN-07 | Contadores zeram no primeiro uso de cada mês novo |
| RN-08 | Funil: novo → contatado → em negociação → convertido / descartado |
| RN-09 | Score v1: base 50; sem site +35, com site −30; nota ≥4,5 +10, ≥4,0 +6, <3,5 −8; avaliações ≥50 +12, ≥20 +8, ≥5 +4, 0 −8; telefone +5; limitado a 0–100 |
| RN-10 | "Alta oportunidade" = score ≥ 75 |
| RN-11 | Link de WhatsApp só para celular brasileiro (DDD + 9 + 8 dígitos) |
| RN-12 | [FASE 0] Teto de 60 buscas por usuário por dia (UTC), para todos os planos |
| RN-13 | [FASE 0] Filtros: raio de 1 a 50 km, nota de 0 a 5 |

### 10.2 Inconsistências a corrigir (vindas da auditoria)

| ID | Problema | Correção proposta |
|---|---|---|
| RN-X1 | O Pro anuncia 500 leads, mas o banco aplica 10 | Limites lidos de `plans` |
| RN-X2 | Remover e salvar de novo o mesmo lead consome cota | Contar leads **únicos** salvos no mês |
| RN-X3 | Uma busca que falha no Google consome cota | Estornar (`refund_search`) ou consumir só depois do sucesso |

### 10.3 Regras propostas

**Planos (valores de referência; os preços finais são decisão de negócio [A VALIDAR])**

| Recurso | Free | Pro | Equipe | Empresa |
|---|---|---|---|---|
| Usuários | 1 | 1 | até N assentos | sob contrato |
| Buscas por mês | 10 | definido em `plans` | definido em `plans` | definido em `plans` |
| Leads salvos por mês | 10 | 500 (o que já é anunciado) | definido em `plans` | definido em `plans` |
| Busca por IA | — | cota | cota | cota |
| Enriquecimento | — | cota | cota | cota |
| Pipeline / tarefas | básico | ✓ | ✓ | ✓ |
| Cadências | — | limitado | ✓ | ✓ |
| Relatórios de equipe | — | — | ✓ | ✓ |
| API e webhooks | — | — | — | ✓ |

**Score v2 (RN-SC)**
- RN-SC1: score = Σ(peso do sinal × valor normalizado) do perfil de oferta, limitado a 0–100.
- RN-SC2: todo score guarda `version` e `reasons` (os 3 principais motivos são exibidos).
- RN-SC3: o perfil padrão "Presença digital" reproduz o v1 exatamente (teste de regressão).
- RN-SC4: um sinal com validade vencida não entra no cálculo até ser renovado.

**CRM e equipe**
- RN-CRM1: um lead pertence a uma organização e tem no máximo um responsável.
- RN-CRM2: um member vê os leads atribuídos a ele e os sem responsável; manager e admin veem todos.
- RN-CRM3: toda mudança de etapa gera uma atividade.
- RN-CRM4: o mesmo `place_id` não se repete dentro de uma organização.

**Automação**
- RN-AU1: opt-out bloqueia novos envios para aquele contato em todas as cadências.
- RN-AU2: resposta do lead encerra a cadência dele.
- RN-AU3: limite de envios por dia por canal e por organização.
- RN-AU4: WhatsApp automatizado só pela API oficial com template aprovado.

**Assinaturas**
- RN-AS1: o estado da assinatura só muda por webhook do gateway ou por ação de staff (auditada).
- RN-AS2: em caso de inadimplência, carência de N dias; depois, rebaixamento para o Free sem apagar dados.
- RN-AS3: o downgrade não apaga leads; bloqueia novas ações acima do limite.

**IA e intenção**
- RN-IA1: a IA nunca cria empresas; só interpreta o pedido e explica resultados reais.
- RN-IN1: todo sinal de intenção exibe a fonte original, a data e o link.

---

## 11. Roadmap

Cada fase só começa quando os critérios de conclusão da anterior (seção 12) forem atingidos.

### Fase 0: Estabilização *(código pronto na branch, sem deploy)*
- ✅ Atualizar `next` e `sharp` (audit: 0 vulnerabilidades)
- ✅ Corrigir o redirecionamento aberto do login
- ✅ Catálogo gravado pelo servidor + migração 004 (escrita)
- ✅ Validação de filtros e teto diário (escrito)
- ✅ Script de verificação de migrações
- ⏳ Quota e alerta de orçamento no Google Cloud (manual, **antes de 08/11/2026**)
- ⏳ `SUPABASE_SERVICE_ROLE_KEY` na Vercel → deploy → executar a 004 → rodar a verificação

### Fase 1: Fundação SaaS
- Supabase CLI, migrações versionadas, ambientes dev, staging e prod
- zod, tipos gerados, Vitest, CI no GitHub Actions
- Camada `src/server/` e cabeçalhos de segurança
- `organizations` e membros, com migração dos usuários atuais (M9 base)
- `plans`, `subscriptions` e `usage_events`; correção de RN-X1, X2 e X3 (M12)
- Gateway de pagamento e webhooks (M12)
- E-mail transacional básico (M15)

### Fase 2: CRM e equipes
- `org_leads`, pipeline Kanban, atividades, tarefas e tags (M8)
- Convites, papéis e distribuição de leads (M9)
- Relatórios de funil e produtividade (M11)

### Fase 3: Inteligência
- Adapter de fornecedor, cache de busca no servidor, geocodificação (M2)
- Catálogo de sinais e Place Details (M3, M6)
- Score v2 com perfis de oferta e motivos (M7)
- Busca por IA (M5)
- Buscas salvas e monitoradas

### Fase 4: Automação
- Templates, cadências, jobs, envio por e-mail (M10)
- WhatsApp oficial [A VALIDAR]
- Rascunho de mensagens com IA

### Fase 5: Expansão
- Intenção pública de compra (M4), depois da validação jurídica de cada fonte
- API pública, webhooks, conectores (M14)
- Painel de staff completo (M13), plano Empresa

---

## 12. Critérios de conclusão por módulo

Critérios gerais (valem para todos os módulos):
- Tipos sem erro, lint sem erros, build sem erros.
- Testes unitários das regras do módulo e pelo menos um teste ponta a ponta do fluxo principal.
- RLS testada: um usuário de fora não lê nem escreve os dados.
- Migração versionada, com script de verificação e plano de reversão.
- Erros mostrados ao usuário sem `alert` e sem falha silenciosa.
- Este blueprint atualizado (status do módulo e regras).

| Módulo | Critérios específicos |
|---|---|
| **Fase 0** | `npm audit` sem vulnerabilidades altas ou críticas; `verify_migrations.sql` com todos os itens `ok = true` em produção; um INSERT direto em `leads` com a sessão do usuário é negado; a busca e o salvamento funcionam em produção depois da 004; quota e alerta de orçamento ativos no Google Cloud |
| **M1 Identidade** | Login com Google opcional funcionando; 2FA disponível para admins; senha mínima de 8; redirecionamentos validados |
| **M2 Busca geral** | Toda chamada passa pelo adapter; consultas repetidas dentro do prazo do cache não chamam o Google; custo por busca registrado em `usage_events`; raio centralizado na cidade geocodificada |
| **M3 Características** | Cada sinal tem fonte, custo e validade documentados; os filtros são combináveis; o custo extra é mostrado antes de executar |
| **M4 Intenção** | Parecer jurídico/termos aprovado por fonte; cada sinal tem fonte, data e link; a deduplicação funciona; a fonte pode ser desligada por feature flag |
| **M5 Busca por IA** | A saída sempre é validada por schema; o usuário vê e edita os filtros interpretados; a cota por plano é aplicada; conjunto de pelo menos 30 descrições de teste com ≥90% de filtros corretos |
| **M6 Qualificação** | O enriquecimento roda em segundo plano sem travar a interface; respeita cache e cota; falhas de fornecedor não quebram o lead |
| **M7 Score** | O perfil "Presença digital" reproduz o v1 (teste de regressão com casos atuais); motivos exibidos; versão gravada; recálculo quando os sinais mudam |
| **M8 CRM** | Kanban com arrastar e soltar; atividades geradas a cada mudança de etapa; tarefas com prazo e lembrete; dados antigos de `saved_leads` e `notes` migrados sem perda (contagens conferidas) |
| **M9 Organizações** | Testes de isolamento entre organizações passando; convite com expiração e uso único; assentos limitados pelo plano; papéis aplicados no banco |
| **M10 Automação** | Opt-out e encerramento por resposta testados; limites de envio aplicados; reenvio idempotente (sem duplicar mensagens); logs de entrega |
| **M11 Relatórios** | Números batem com consultas de referência; agregação no banco; carregamento abaixo de 2 s com 10 mil leads |
| **M12 Planos** | Checkout, renovação, falha de pagamento, upgrade e downgrade testados em sandbox; webhooks idempotentes; limites lidos de `plans`; RN-X1, X2 e X3 corrigidas |
| **M13 Admin** | Toda ação de staff registrada em `audit_log`; troca manual de plano; painel de custo por fornecedor |
| **M14 Integrações** | Chaves de API com hash e escopo; webhooks assinados e com novas tentativas; documentação da API publicada |
| **M15 Notificações** | Preferências salvas no banco e respeitadas; e-mails com SPF/DKIM válidos; descadastro funcionando |

---

*As decisões marcadas como [A VALIDAR] precisam de registro (decisão, data, responsável) antes da implementação do módulo correspondente.*
