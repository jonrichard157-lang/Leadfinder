# Pagamentos (Mercado Pago): configuração e funcionamento

## Planos e créditos

Definidos em `src/lib/billing/catalog.ts`, que é a única fonte de preços e limites. Nenhum plano é ilimitado; só a equipe interna do OrbeLead (`role` team/admin) não tem limite.

| Plano | Público | Preço/mês | Buscas/mês | Leads/mês |
|---|---|---|---|---|
| Grátis | todos | R$ 0 | 10 | 10 |
| Básico | pessoa física | R$ 47 | 40 | 150 |
| Pro | pessoa física | R$ 97 | 100 | 500 |
| Max | pessoa física | R$ 197 | 250 | 1.500 |
| Agência | empresa | R$ 247 | 400 | 3.000 |

Pacotes de créditos avulsos: +20 buscas (R$ 19), +100 leads (R$ 19), +50 buscas e +300 leads (R$ 49). Os créditos só são usados depois que a cota do mês acaba, e não expiram.

- O tipo de conta (pessoa física ou empresa) é escolhido no cadastro e pode ser alterado em Configurações enquanto a conta estiver no Grátis.
- Os planos empresariais só aparecem e só podem ser assinados por contas do tipo Empresa (a regra é verificada no servidor).
- O teto de 60 buscas por dia (migração 004) continua valendo para todos.

Para mudar um preço ou limite, altere `catalog.ts` e faça o deploy. Assinaturas que já existem no Mercado Pago continuam com o valor antigo até o usuário trocar de plano.

## Como funciona

| Ação | Produto do Mercado Pago | Quando libera |
|---|---|---|
| Assinar ou trocar de plano | Assinaturas (`/preapproval`), cobrança mensal no cartão | Webhook `subscription_preapproval` com status `authorized` ativa o plano (validade provisória de 1 dia). Cada cobrança aprovada (`subscription_authorized_payment`) estende a validade em 1 mês |
| Comprar créditos | Checkout Pro (`/checkout/preferences`): cartão, Pix ou boleto | Webhook `payment` com status `approved` |
| Cancelar | `PUT /preapproval/{id}` com status `cancelled` | O plano segue até `plan_expires_at` |

- **Validade e inadimplência:** se não chegar nova cobrança aprovada, o plano volta ao Grátis 3 dias depois de `plan_expires_at`. Os leads não são apagados.
- **Troca de plano:** cria uma assinatura nova. Quando ela é autorizada, as anteriores são canceladas. O novo plano vale na hora; não há cálculo proporcional (pro rata).
- **Segurança:** o webhook valida o cabeçalho `x-signature` e sempre consulta o estado real na API do Mercado Pago. Cada pagamento é aplicado uma única vez (`billing_payments.provider_payment_id` é único). Usuários só leem `subscriptions` e `billing_payments`; quem grava é a service role.

## Configuração (uma vez)

1. **Mercado Pago:** em [Suas integrações](https://www.mercadopago.com.br/developers/panel/app), crie uma aplicação ("Pagamentos online", com Checkout Pro e Assinaturas).
2. **Credenciais:** copie o *Access Token* de teste e o de produção.
3. **Webhooks** (na mesma aplicação):
   - URL: `https://SEU_DOMINIO/api/webhooks/mercadopago`. Configure separadamente para o modo de teste e para o de produção.
   - Eventos: **Pagamentos** e **Planos e assinaturas**.
   - Copie a **assinatura secreta**.
4. **Vercel → Environment Variables:**

   | Variável | Production | Preview |
   |---|---|---|
   | `MP_ACCESS_TOKEN` | token de produção | token de teste |
   | `MP_WEBHOOK_SECRET` | assinatura secreta de produção | assinatura secreta de teste |
   | `APP_URL` | `https://seu-dominio` | URL fixa do Preview (opcional) |
   | `SUPABASE_SERVICE_ROLE_KEY` | já configurada (Fase 0) | já configurada (Fase 0) |

5. **Supabase:** rode `supabase/migrations/005_billing_mercadopago.sql` e depois `supabase/checks/verify_migrations.sql`.

## Testes (modo sandbox)

- Em *Suas integrações → Contas de teste*, crie um **comprador** e um **vendedor** de teste. Use o Access Token do vendedor de teste.
- Assinaturas: o e-mail do usuário no OrbeLead deve ser o **e-mail do comprador de teste**. O Mercado Pago exige que `payer_email` corresponda à conta que autoriza.
- Use os [cartões de teste](https://www.mercadopago.com.br/developers/pt/docs/checkout-pro/additional-content/your-integrations/test/cards). O nome do titular `APRO` aprova o pagamento e `OTHE` recusa.
- Para receber webhooks, a URL precisa ser pública (Preview da Vercel ou um túnel); `localhost` não recebe.
- Roteiro mínimo:
  1. Assinar o Básico e conferir em Assinatura que o plano e os limites mudaram.
  2. Comprar o pacote "+20 buscas" e conferir que `extra_searches` passou a 20.
  3. Esgotar a cota e confirmar que o próximo uso consome o crédito.
  4. Cancelar e confirmar que o plano segue até a data exibida.
