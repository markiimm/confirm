# Plataforma de confirmação automática — Plano Normal + Pro

Fluxo completo: cadastro público com 14 dias grátis → upload/gestão de
lista de convidados → disparo de convites pelo WhatsApp → lembretes
automáticos → confirmação/recusa automática → cobrança recorrente via
Asaas quando o trial acaba.

## Papéis
- **owner** — você. Vê métricas gerais e cadastra empresas manualmente
  (essas entram direto com assinatura ativa, sem trial).
- **consultant** — cada empresa cliente. Pode se cadastrar sozinha em
  `/signup` (entra com 14 dias grátis) ou ser cadastrada por você.

## Criando o seu usuário (owner) — só uma vez
1. Supabase → Authentication → Users → Add user.
2. SQL Editor:
```sql
insert into profiles (id, role, full_name, email, subscription_status)
values ('cole-o-uuid-aqui', 'owner', 'Seu nome', 'seu@email.com', 'active');
```

## Configuração
1. **Supabase** — crie o projeto, rode `supabase/schema.sql`, copie as
   3 chaves (URL, anon key, service role key) para o `.env.local`.
2. **WhatsApp (BSP)** — 360dialog ou Gupshup, aprove os templates
   `convite_casamento` e `lembrete_confirmacao`, configure o webhook
   apontando para `/api/whatsapp-webhook`.
3. **Asaas** — crie conta em asaas.com, pegue a API key em
   Configurações → Integrações, configure o webhook apontando para
   `/api/webhooks/asaas` (eventos: PAYMENT_CONFIRMED, PAYMENT_RECEIVED,
   PAYMENT_OVERDUE, SUBSCRIPTION_DELETED).
4. **Cron dos lembretes** — cron-job.org chamando `POST /api/send-reminders`
   1x por dia com o header `x-cron-secret`.

## Rodando localmente
```
npm install
npm run dev
```

## Múltiplos tipos de evento e de negócio
- `lib/eventTypes.js` — catálogo de tipos de evento (casamento, festa,
  formatura, outro), cada um com seu texto padrão de convite.
- `lib/patternTypes.js` — os dois padrões de negócio suportados:
  "lista de confirmação" (funcional) e "agendamento individual" (em
  construção — aparece desabilitado no cadastro público).

## Assinatura / trial
- Cadastro público (`/signup`) sempre entra com `subscription_status =
  'trialing'` e 14 dias de teste, sem pedir cartão.
- Quando o trial vence, o dashboard da consultora bloqueia o acesso e
  mostra um link pra `/consultora/billing`, onde ela assina via Asaas
  (cartão, Pix ou boleto — a escolha acontece na tela hospedada do
  Asaas, seu código nunca vê o número do cartão).
- O webhook do Asaas (`/api/webhooks/asaas`) atualiza o status
  automaticamente conforme os pagamentos são confirmados ou falham.

## Bot de teste gratuito
`whatsapp-test-bot/` — roda localmente com Baileys (não oficial), pra
testar o fluxo sem gastar nada antes de contratar o BSP oficial. Veja
o README de dentro da pasta para o aviso de risco.


## Recuperação de senha
Funciona via Supabase Auth — não precisa de nenhuma conta externa nova.
Só falta um passo de configuração: em Authentication > URL Configuration,
adicione `https://seusite.com/reset-password` (e o equivalente em
`localhost:3000` para testar local) na lista de Redirect URLs. Sem isso,
o Supabase recusa o link do e-mail de redefinição.

## Proteção contra spam no cadastro público
`/api/signup` tem duas camadas simples: um campo honeypot (invisível,
só um robô preenche) e uma armadilha de tempo (recusa envios em menos
de 2 segundos). Isso barra os robôs mais comuns, mas não é um CAPTCHA
de verdade — se o cadastro público começar a receber tráfego real e
spam persistente, vale adicionar o Cloudflare Turnstile (gratuito,
alternativa mais leve que reCAPTCHA) na frente do formulário.


## Portal do cliente (somente leitura)
Na página do evento, a consultora gera um link único (`/portal/<token>`)
para mandar aos noivos ou organizadores. Quem abre vê os números e a
lista de nomes com o status de cada um, sem login e sem poder alterar
nada — telefone de convidado e dados da conta nunca são expostos ali.
O link pode ser desativado a qualquer momento, o que invalida o token.

## Equipe (múltiplos usuários por empresa)
O titular da conta (`role = 'consultant'`) pode adicionar colaboradores
(`role = 'collaborator'`, com `parent_id` apontando para a empresa).
Colaboradores gerenciam eventos, listas e confirmações, mas não veem
assinatura nem gerenciam a equipe. Toda rota de evento filtra por
`account_id`, que resolve para a empresa dona dos dados — nunca pelo id
do usuário logado.

## Observações e acompanhantes
O webhook do WhatsApp salva o texto completo da resposta em `guests.notes`
e tenta detectar acompanhantes (`guests.companions`) em frases como
"sim, vou levar 2 pessoas" ou "sim, com minha esposa". Quando a resposta
não é reconhecida como sim/não, o status fica pendente e a consultora
resolve manualmente — já vendo o que o convidado escreveu. Ambos os
campos vão para a planilha exportada.

## Autogestão da assinatura
`/consultora/billing` mostra histórico de cobranças (tabela
`billing_events`, preenchida pelo webhook do Asaas), permite trocar
entre Normal e PRO, e cancelar a assinatura. Só o titular acessa.

## IMPORTANTE — atualizando um banco que já existe
O `schema.sql` usa `create table if not exists`, então rodar ele de novo
NÃO adiciona colunas em tabelas já criadas. Se o seu banco já está no ar,
rode também:

```sql
alter table profiles add column if not exists parent_id uuid references profiles(id) on delete cascade;
alter table events add column if not exists portal_token text unique;
alter table guests add column if not exists notes text;
alter table guests add column if not exists companions int default 0;

create table if not exists billing_events (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references profiles(id) on delete cascade,
  asaas_payment_id text,
  event_type text,
  status text,
  value numeric,
  due_date date,
  invoice_url text,
  created_at timestamptz default now()
);
alter table billing_events enable row level security;

create or replace function account_id()
returns uuid as $$
  select coalesce(parent_id, id) from profiles where id = auth.uid();
$$ language sql security definer;

drop policy if exists "events_consultant_select" on events;
drop policy if exists "events_consultant_manage" on events;
create policy "events_account_select" on events for select using (consultant_id = account_id());
create policy "events_account_manage" on events for all using (consultant_id = account_id());
create policy "billing_self_select" on billing_events for select using (profile_id = account_id());
create policy "billing_owner_select_all" on billing_events for select using (is_owner());
```
