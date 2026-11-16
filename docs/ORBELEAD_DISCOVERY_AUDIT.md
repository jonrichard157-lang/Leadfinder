# OrbeLead 1.0: auditoria para a busca híbrida B2B + B2C

**Etapa 1 de 6, somente diagnóstico.** Nenhum código, migração ou configuração foi alterado. As recomendações aguardam aprovação.

- **Base analisada:** branch `feat/agente-busca`, `supabase/schema.sql`, migrações 002 a 005 e o código em `src/`. O banco de produção não foi consultado.
- **Referência:** o escopo oficial do OrbeLead 1.0, com público B2B + B2C, busca híbrida e IA para interpretação e qualificação.
- **Planos:** continuam os atuais (Grátis, Básico, Pro, Max e Agência), com créditos avulsos e Mercado Pago, como pedido.

---

## 1. Resumo

O OrbeLead já tem uma boa base de infraestrutura: autenticação, perfis, cotas no banco, catálogo de leads protegido, pagamentos com webhook idempotente e RLS em todas as tabelas. Nada disso precisa ser refeito.

O que prende o produto a um único nicho é a **regra de negócio**: o filtro padrão, o cálculo da nota e os textos assumem que o cliente do usuário é uma "empresa sem site". O banco também só sabe guardar empresas do Google, sem registrar de onde veio cada informação.

Conclusão: **dá para evoluir de forma incremental**, sem reconstruir o núcleo. São necessárias três mudanças estruturais:

1. A **busca** deixa de receber filtros fixos e passa a receber uma **intenção** (o que o usuário vende, quem procura, onde e com quais sinais).
2. A **nota** deixa de ser uma fórmula fixa e passa a ter **critérios com pesos que dependem da intenção**, separada de uma **nota de confiança**.
3. O **lead** ganha **origem, evidências e verificação** registradas à parte, e um tipo (empresa ou pessoa).

---

## 2. A arquitetura atual permite buscas independentes de nicho?

**Em parte.**

| Componente | Situação | Independente de nicho? |
|---|---|---|
| Consulta ao Google Places (`search.ts`) | Recebe um texto livre ("{categoria} em {local}"), divide a área em quadrantes e busca até 20 resultados | **Sim.** O motor aceita qualquer termo |
| Lista de categorias (`mocks/leads.ts`) | Lista fixa no código, voltada a pequenos negócios locais | Não. É fixa, mas fácil de trocar |
| Filtros (`SearchFilters`) | Local, categoria, raio, "somente sem site", nota mínima, mínimo de avaliações | Não. Os critérios são fixos |
| Nota (`scoring.ts`) | Fórmula fixa | **Não.** O peso maior é a falta de site |
| Agente, Fase A (`lib/agent/plan.ts`) | Texto livre vira um plano com nichos, locais e sinais | **Sim.** É o embrião do Intent Engine |
| Tabela `leads` | Colunas específicas do Google (`place_id`, `rating`, `has_website`) | Não. Só empresas e só uma fonte |
| Gestão (`saved_leads`) | Status, notas em JSONB, cota por salvamento | **Sim.** Não depende do nicho |

---

## 3. Onde o sistema está preso a "venda de sites"

Há **19 arquivos** que citam site ou website. Os que realmente limitam o produto:

| # | Onde | O que acontece | Efeito |
|---|---|---|---|
| L1 | `src/lib/scoring.ts` | +35 pontos para quem não tem site e −30 para quem tem: até 65 pontos de diferença numa escala de 0 a 100 | Para quem vende energia solar ou manutenção industrial, a nota fica errada |
| L2 | `app/app/buscar/page.tsx` e `api/leads/search/route.ts` | "Somente empresas sem website" vem **ligado por padrão**, e a API trata a ausência do campo como ligado (`!== false`) | Esconde a maioria das empresas do resultado sem o usuário perceber |
| L3 | `search.ts`, lista `NON_WEBSITE_HOSTS` | Instagram, WhatsApp e apps de agendamento contam como "sem site" | Faz sentido só para quem vende sites; para os outros nichos é só um dado |
| L4 | `schema.sql`, `leads.has_website` | A presença de site é uma coluna fixa do lead | Um sinal específico de um nicho virou estrutura do banco |
| L5 | `types/index.ts`, `Lead` | O comentário e os campos descrevem a nota como "sem site, poucas avaliações" | Contrato do front preso ao nicho |
| L6 | Landing, `layout.tsx` e `AuthLayout` | Textos e exemplos falam de empresas sem site | Posicionamento antigo |
| L7 | `LeadCard`, detalhe do lead, resultados e `export.ts` | O selo "sem site" é o destaque visual e uma coluna do CSV | Pode virar só um dos sinais exibidos |

**Recomendação:** "tem site" continua existindo como **um sinal entre vários**. Ele só ganha peso quando a intenção da busca pede isso, por exemplo quando o usuário vende sites ou marketing.

---

## 4. Discovery Engine: arquitetura proposta

```
Usuário (texto livre + categoria/filtros opcionais)
        │
        ▼
1. Intent Engine (IA) ── só interpreta e não executa nada
   texto + filtros → SearchIntent (oferta, público B2B/B2C, segmentos, locais, sinais, pesos)
        │  o usuário revisa e edita
        ▼
2. Planner (código) ── decide COMO buscar
   SearchIntent → consultas por fonte (nicho × local × fonte), respeitando os limites do plano
        │
        ▼
3. Conectores de fonte (código, um por fonte, mesma interface)
   Google Places hoje · sites públicos · dados de empresas (CNPJ) · diretórios depois
        │  cada resultado vem com origem, URL e data
        ▼
4. Qualification Engine
   deduplicação → validação → evidências → Opportunity Score + Confidence Score
   (regras reproduzíveis; a IA só ajuda a interpretar evidências em texto)
        │
        ▼
5. Resultados → salvar → gestão (status, notas, histórico, CSV)
```

**Contratos entre os módulos** (tipos em TypeScript, para cada parte evoluir sozinha):

- `SearchIntent`: o que foi pedido. É a saída do Intent Engine, ou dos filtros da busca especializada, ou dos dois juntos.
- `SourceQuery`: o que pedir a uma fonte.
- `SourceConnector.search(query) → RawRecord[]`: cada fonte é um arquivo novo. **Adicionar uma fonte não muda o núcleo.**
- `Candidate`: o registro normalizado, com `entity_type`, dados, origem e evidências.
- `ScoredLead`: o Candidate com as duas notas e a explicação de cada critério.

**O que já existe e é reaproveitado:**
- `searchLocalPlaces` vira o primeiro conector, o do Google Places.
- O agente da Fase A vira o Intent Engine.
- `consume_search`, o teto diário e os créditos continuam controlando o uso.

---

## 5. Fluxo da busca universal (caminho A)

1. O usuário escreve, por exemplo: *"Vendo manutenção de máquinas industriais, quero indústrias em Sorocaba."*
2. O Intent Engine devolve a intenção estruturada:
   - oferta: manutenção industrial;
   - público: B2B;
   - segmentos: metalúrgica, indústria de plásticos, alimentícia;
   - local: Sorocaba, SP;
   - sinais: porte, tempo de atividade, setor;
   - pesos sugeridos para a nota.
3. A tela mostra o plano para o usuário editar. **Montar o plano não gasta busca.** Isso já funciona na Fase A.
4. Ao executar, o sistema desconta **1 busca por pedido**. O Planner gera até N consultas, de acordo com o plano (Pro 2, Max 4, Agência 6).
5. Os conectores buscam, o Qualification Engine deduplica e dá as notas, e a tela mostra os resultados ordenados com a explicação de cada nota.

## 6. Fluxo da busca especializada (caminho B) e a combinação

1. O usuário escolhe um **segmento**, por exemplo Imobiliário, e preenche os **filtros daquele segmento**, como tipo (condomínio ou imobiliária), local e raio.
2. Os filtros viram um `SearchIntent` direto, **sem IA**: é mais barato e mais previsível.
3. **Combinação:** se o usuário também escrever um texto, a IA recebe os filtros já escolhidos como **fixos** e só completa o resto (sinais, pesos, nichos relacionados).
4. A partir daí o fluxo é o mesmo do caminho A.

**Categorias e filtros dinâmicos sem código por nicho.** As categorias vivem num **catálogo de configuração**, primeiro um arquivo no código e depois uma tabela, se o painel administrativo precisar editar. Cada segmento define:
- os termos de busca no Google ("condomínio residencial", "administradora de condomínios");
- os filtros que aparecem na tela (tipo, porte, raio);
- os sinais relevantes e os pesos padrão da nota;
- o público (B2B ou B2C).

Os 8 segmentos iniciais do escopo (Construção, Indústria, Saúde, Comércio, Tecnologia, Imobiliário, Serviços e Educação) cabem nesse formato. **Um segmento novo é uma nova entrada no catálogo, não código novo.**

---

## 7. Modelo de dados para leads B2B e B2C

### Princípio

O lead é a **oportunidade**: a entidade (empresa ou pessoa). **Origem, evidências e contatos ficam em tabelas separadas**, cada um com a fonte e a data de verificação.

### Evolução das tabelas atuais (sem quebrar nada)

| Tabela | Mudança proposta |
|---|---|
| `leads` | Novas colunas: `entity_type` (`business` ou `person`, padrão `business`), `location` (JSONB com cidade, UF e coordenadas), `last_verified_at` e `confidence_score`. As colunas atuais **ficam**, para compatibilidade. `has_website` passa a ser um sinal derivado das evidências |
| `searches` | Nova coluna `intent` (JSONB, o `SearchIntent`) e o modo (`rapida`, `universal`, `especializada`). Gravada **só pelo servidor**; hoje o cliente consegue inserir (item S7 da auditoria anterior) |
| `saved_leads` | A nota de oportunidade passa a ser **por usuário e por busca** (`opportunity_score` e `score_breakdown`), porque o mesmo lead vale notas diferentes para ofertas diferentes |

### Tabelas novas, em ordem de prioridade

| Tabela | Finalidade | Etapa |
|---|---|---|
| `lead_sources` | De onde veio cada lead: fonte, `source_url`, id externo, data da coleta e dados brutos | 4 |
| `lead_evidence` | Cada evidência: tipo (ex.: "sem site", "abriu há 2 anos", "pedido público"), valor, fonte, URL e data | 4 |
| `lead_contacts` | Contatos permitidos, com tipo, valor, fonte, data e base legal (LGPD) | 4 |
| `lead_notes` | Notas com autor e data, saindo do JSONB de `saved_leads` | 5 |
| `lead_status_history` | Histórico de mudanças de status | 5 |
| `usage_events` | Registro de cada uso (busca, chamada de IA, consulta a fonte) com custo estimado, para o painel de custos | 6 |

O escopo também cita outras tabelas. Situação de cada uma:
- `data_sources` e `lead_verifications`: não são necessárias agora. A fonte pode ser um campo de texto validado no código e a verificação cabe em `last_verified_at` mais `lead_evidence`.
- `plans`: continua em `catalog.ts`.
- `payments`, `subscriptions` e `webhook_events`: já existem como `subscriptions` e `billing_payments`.
- `trials`: **não existe no banco atual**. Recomendo não criar e seguir com o plano Grátis.

### RLS e segurança

O padrão atual se mantém:
- O **catálogo** (`leads`, `lead_sources` e `lead_evidence`) só recebe gravações do servidor (service role). O usuário apenas lê.
- `lead_contacts` aparece para o usuário **somente** quando ele salvou o lead.
- O que é **do usuário** (`saved_leads`, notas, histórico e buscas) fica restrito às próprias linhas, como hoje.

---

## 8. Opportunity Score e Confidence Score

### Opportunity Score (0 a 100): quanto a oportunidade combina com o que o usuário vende

São 5 critérios, cada um de 0 a 100:

| Critério | Como calcular (regra) | Exemplo |
|---|---|---|
| **Fit comercial** | O segmento e a categoria do lead correspondem aos segmentos da intenção | Clínica de estética, numa busca por clínicas = alto |
| **Sinal de oportunidade** | Os sinais da intenção encontrados nas evidências | "Sem agendamento online" para quem vende agendamento |
| **Qualidade dos dados** | Quantos dados essenciais existem (nome, endereço, contato, categoria) | Com endereço e telefone = alto |
| **Atualidade** | Quando a informação foi verificada pela última vez | Verificado hoje = alto |
| **Contato disponível** | Existe um meio de contato legítimo | Telefone comercial público = alto |

**Nota final = soma ponderada.** Os **pesos vêm da intenção**: o segmento define os padrões e a IA pode ajustar dentro de limites. Por exemplo, quem vende sites dá peso alto à "falta de site", e quem vende manutenção industrial dá peso alto ao "setor".

- **Reproduzível:** mesmas evidências e mesmos pesos dão sempre a mesma nota.
- **Explicável:** a tela mostra a contribuição de cada critério.

### Confidence Score (0 a 100): quanto dá para confiar nos dados

- **Confiabilidade da fonte:** o Google Places pesa mais que um diretório genérico.
- **Concordância:** o dado aparece igual em mais de uma fonte.
- **Idade da verificação.**
- **Dados que batem:** telefone, endereço e CNPJ consistentes entre si.

As duas notas aparecem **lado a lado e nunca misturadas**. Um lead pode ter oportunidade alta e confiança baixa.

### Papel da IA na nota

A IA **não dá a nota final**. Ela:
1. sugere os pesos na intenção;
2. transforma texto não estruturado (descrição de site, texto de um pedido público) em **evidências** com tipo e valor.

Quem calcula a nota é o código.

---

## 9. Fontes de dados

| Fonte | Público | Custo | Confiabilidade | LGPD e termos de uso | Recomendação |
|---|---|---|---|---|---|
| **Google Places API** (já usada) | B2B e negócios locais B2C | Pago por consulta; já há cota e alerta | Alta | Dados comerciais públicos. Os termos limitam o armazenamento: só o `place_id` pode ser guardado sem prazo, o resto precisa ser atualizado | **Manter como fonte principal.** Revisar o cache para seguir a regra de armazenamento |
| **Dados abertos de CNPJ (Receita Federal)** | B2B: porte, CNAE, data de abertura, situação | Grátis (base pública) ou API paga de terceiros | Alta para dados cadastrais | Dados públicos de empresas. Cuidado com dados pessoais de sócios: não exibir CPF e usar o mínimo necessário | **2ª fonte.** Dá o setor (CNAE) e o porte, essenciais para indústria e B2B |
| **Site público da empresa** (leitura sob demanda) | B2B | Baixo (servidor + IA para resumir) | Média | Ler só páginas públicas, respeitar o robots.txt e não coletar dados pessoais | **3ª fonte**, como evidência: o que vende, se tem agendamento online |
| **Diretórios setoriais e marketplaces** | Depende do diretório | Variável | Variável | Muitos proíbem raspagem nos termos | **Só com API oficial ou parceria.** Avaliar um por um |
| **Pedidos públicos de serviço** (B2C: pessoas pedindo orçamento) | B2C | Variável | Média | **Ponto mais sensível.** São dados pessoais: exigem base legal e uma fonte que autorize o uso comercial | **Depois do MVP**, só com fonte autorizada ou parceria. No 1.0, o B2C é **negócios locais vendendo ao consumidor** |
| Redes sociais (raspagem) | B2C | Baixo | Baixa | Proibida pelos termos, com risco de LGPD | **Não usar** |

**Seleção de fontes:** o Planner escolhe as fontes conforme a intenção. Por exemplo, uma busca B2B industrial usa Google Places e CNPJ; uma busca de serviços locais usa só o Google Places. Cada fonte tem um **custo por consulta** registrado em `usage_events`, para o painel administrativo.

---

## 10. Riscos e pontos de atenção

| Risco | Mitigação |
|---|---|
| Custo da IA e do Google crescer com o volume | Limites por plano (já existem), cache de intenções e de resultados, e `usage_events` com custo estimado |
| Termos do Google Places sobre armazenamento | Atualizar os dados do cache periodicamente e não exibir dados vencidos sem atualizar |
| Promessa de B2C maior que a cobertura real | No 1.0, comunicar o B2C como "negócios que vendem ao consumidor" e deixar os pedidos de pessoas para depois |
| IA interpretar errado | O plano é sempre **revisável** antes de executar (já funciona assim) e a nota final é calculada por regra |
| Leads antigos com nota antiga | A nova nota vale para buscas novas; os leads já salvos mantêm a nota antiga até serem atualizados |
| Migrações manuais no SQL Editor | Cada etapa tem uma migração numerada, idempotente, com script de verificação (como a 004 e a 005) |

---

## 11. Plano de implementação incremental

Cada etapa é entregue, testada e aprovada antes da próxima.

| Etapa | Entrega | Migração | O que muda para o usuário |
|---|---|---|---|
| **1. Auditoria** (esta) | Este documento | Não | Nada |
| **2. Busca universal** | Concluir o agente: executar o plano no Google Places, descontar 1 busca por pedido, contar os pedidos por mês por plano e gravar a intenção em `searches`. **Desligar o "somente sem site" por padrão** (L2) | Sim, pequena (`searches.intent` e o contador do agente) | O agente busca de verdade, para qualquer nicho |
| **3. Busca especializada** | Catálogo dos 8 segmentos com filtros próprios, combinação com o texto e textos da landing atualizados (L6) | Não | Escolher o segmento e os filtros, com ou sem texto |
| **4. Qualificação** | Contratos `Candidate` e `ScoredLead`, deduplicação, `lead_sources` e `lead_evidence`, Opportunity Score configurável (substitui L1) e Confidence Score | Sim | Duas notas com explicação e evidências |
| **5. Gestão de leads e B2B/B2C** | `entity_type`, `lead_notes`, `lead_status_history`, CSV com as novas colunas e 2ª fonte (CNPJ) | Sim | Histórico, notas com data e dados de porte e setor |
| **6. Painel administrativo** | `usage_events`, custos de IA e das fontes, monitoramento de buscas e uso de créditos | Sim | Visão de custo e uso para a equipe |

Os **critérios de pronto do escopo** são testados a partir da Etapa 2, com três cenários comerciais diferentes:
- clínicas (serviço de saúde, B2C local);
- manutenção industrial (B2B);
- energia solar (B2B e B2C local).

---

## 12. Decisões que preciso de você antes da Etapa 2

1. **Filtro "somente sem site":** desligar por padrão para todos? Recomendo que sim; ele continua disponível como opção.
2. **Limites mensais do agente:** Pro 15, Max 50 e Agência 120 pedidos por mês, e consultas por pedido Pro 2, Max 4 e Agência 6. Confirmar ou ajustar.
3. **Fonte de CNPJ** (Etapa 5): base pública gratuita (mais trabalho de manutenção) ou API paga (mais simples, custo por consulta)? Pode ficar para depois.
