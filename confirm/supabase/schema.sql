-- Rode este script no SQL Editor do seu projeto Supabase

-- Um perfil por usuário autenticado (dono do sistema ou consultora/empresa).
-- O id é o mesmo id gerado pelo Supabase Auth ao criar o usuário.
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'consultant', -- 'owner' | 'consultant' | 'collaborator'
  -- Colaboradores apontam para o perfil da empresa dona da conta.
  -- Fica nulo para 'owner' e para o titular da empresa ('consultant').
  parent_id uuid references profiles(id) on delete cascade,
  full_name text not null,
  email text not null,
  pattern_type text default 'lista_confirmacao', -- 'lista_confirmacao' | 'agendamento_individual'
  business_type text default 'casamento', -- 'casamento' | 'festa' | 'formatura' | 'outro'
  plan text default 'normal', -- 'normal' | 'pro'
  active boolean default true,

  -- Assinatura / cobrança (Asaas)
  subscription_status text default 'trialing', -- 'trialing' | 'active' | 'past_due' | 'canceled'
  trial_ends_at timestamptz default (now() + interval '14 days'),
  asaas_customer_id text,
  asaas_subscription_id text,

  created_at timestamptz default now()
);

create table if not exists events (
  id uuid primary key default gen_random_uuid(),
  consultant_id uuid references profiles(id) on delete cascade,
  event_name text not null,          -- ex: "Casamento de Marcelo e Karine", "Formatura Turma 2026"
  event_type text default 'casamento', -- 'casamento' | 'festa' | 'formatura' | 'outro'
  event_date date not null,
  reminder_days int[] default '{15,10,5,1}',
  invite_image_url text,
  invite_message_template text,      -- se vazio, usa a mensagem padrão do tipo de evento
  -- Token do portal somente-leitura enviado ao cliente final (noivos,
  -- formandos). Nulo enquanto a consultora não gerar o link.
  portal_token text unique,
  created_at timestamptz default now()
);

create table if not exists guests (
  id uuid primary key default gen_random_uuid(),
  event_id uuid references events(id) on delete cascade,
  full_name text not null,
  phone text not null,
  confirmation_status text default 'pending', -- pending | confirmed | declined
  -- Texto livre que o convidado mandou junto da resposta (acompanhante,
  -- restrição alimentar, etc). Preenchido pelo webhook do WhatsApp.
  notes text,
  companions int default 0,
  last_reminder_sent_at timestamptz,
  reminder_count int default 0,
  created_at timestamptz default now(),
  unique (event_id, phone)
);

create table if not exists billing_events (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references profiles(id) on delete cascade,
  asaas_payment_id text,
  event_type text,      -- PAYMENT_CONFIRMED | PAYMENT_OVERDUE | ...
  status text,          -- paid | overdue | canceled
  value numeric,
  due_date date,
  invoice_url text,
  created_at timestamptz default now()
);

create table if not exists messages_log (
  id uuid primary key default gen_random_uuid(),
  guest_id uuid references guests(id) on delete cascade,
  direction text not null, -- outbound | inbound
  message_type text,       -- invite | reminder | confirmation | reply
  content text,
  created_at timestamptz default now()
);

-- Ativa Row Level Security (recomendado antes de ir pra produção)
alter table profiles enable row level security;
alter table events enable row level security;
alter table guests enable row level security;
alter table messages_log enable row level security;
alter table billing_events enable row level security;

-- Função auxiliar: o usuário logado é o dono do sistema?
create or replace function is_owner()
returns boolean as $$
  select exists (
    select 1 from profiles where id = auth.uid() and role = 'owner'
  );
$$ language sql security definer;

-- profiles: cada um vê o próprio perfil; o owner vê todos
create policy "profiles_self_select" on profiles for select using (id = auth.uid());
create policy "profiles_owner_select_all" on profiles for select using (is_owner());
create policy "profiles_owner_manage" on profiles for all using (is_owner());

-- Empresa "dona" da conta do usuário logado: ele mesmo, ou, se for
-- colaborador, o perfil da empresa a que ele pertence.
create or replace function account_id()
returns uuid as $$
  select coalesce(parent_id, id) from profiles where id = auth.uid();
$$ language sql security definer;

-- Colaborador precisa ler o perfil da empresa a que pertence (plano,
-- assinatura, etc.) — sem essa política, o login do colaborador é
-- barrado pelo RLS e ele é jogado de volta para /login.
create policy "profiles_account_select" on profiles for select using (id = account_id());

-- events: a empresa (e seus colaboradores) só vê/edita os próprios eventos
create policy "events_account_select" on events for select using (consultant_id = account_id());
create policy "events_account_manage" on events for all using (consultant_id = account_id());
create policy "events_owner_select_all" on events for select using (is_owner());

-- billing_events: cada empresa vê o próprio histórico; owner vê tudo
create policy "billing_self_select" on billing_events for select using (profile_id = account_id());
create policy "billing_owner_select_all" on billing_events for select using (is_owner());

-- Observação: as rotas /api usam a service role key (que ignora RLS) e
-- fazem a checagem de permissão manualmente no código — essas políticas
-- são uma segunda camada de proteção, não a única.

-- ============================================
-- Suporte (chamados entre empresas/colaboradores e o dono da plataforma)
-- ============================================
create table if not exists support_tickets (
  id uuid primary key default gen_random_uuid(),
  account_id uuid references profiles(id) on delete cascade, -- empresa dona do chamado
  created_by uuid references profiles(id) on delete set null, -- quem abriu (titular ou colaborador)
  subject text not null,
  status text default 'open', -- 'open' | 'closed'
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists support_messages (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid references support_tickets(id) on delete cascade,
  sender_id uuid references profiles(id) on delete set null,
  sender_role text, -- papel de quem enviou: 'owner' | 'consultant' | 'collaborator'
  body text not null,
  created_at timestamptz default now()
);

alter table support_tickets enable row level security;
alter table support_messages enable row level security;

create policy "support_tickets_account_select" on support_tickets for select using (account_id = account_id());
create policy "support_tickets_owner_select_all" on support_tickets for select using (is_owner());

create policy "support_messages_account_select" on support_messages for select using (
  ticket_id in (select id from support_tickets t where t.account_id = account_id())
);
create policy "support_messages_owner_select_all" on support_messages for select using (is_owner());

-- ============================================
-- Log de auditoria (ações administrativas do dono da plataforma)
-- ============================================
create table if not exists audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references profiles(id) on delete set null, -- quem fez a ação
  action text not null,   -- ex: 'consultant.create', 'user.update', 'team.remove'
  target_id uuid,         -- id do registro afetado, quando existir
  details jsonb,          -- payload livre com o que mudou
  created_at timestamptz default now()
);

alter table audit_log enable row level security;
create policy "audit_log_owner_select" on audit_log for select using (is_owner());

-- ============================================
-- Templates de mensagem salvos (reutilizáveis entre eventos da mesma empresa)
-- ============================================
create table if not exists message_templates (
  id uuid primary key default gen_random_uuid(),
  account_id uuid references profiles(id) on delete cascade,
  name text not null,
  body text not null,
  created_at timestamptz default now()
);

alter table message_templates enable row level security;
create policy "message_templates_account_select" on message_templates for select using (account_id = account_id());
create policy "message_templates_account_manage" on message_templates for all using (account_id = account_id());
create policy "message_templates_owner_select_all" on message_templates for select using (is_owner());

-- ============================================
-- Colaboradores: modo somente leitura e acesso restrito por evento
-- ============================================

-- Só se aplica a role='collaborator'; titular e owner sempre podem editar
-- (a checagem definitiva é sempre feita no código da API, isso é só o dado).
alter table profiles add column if not exists can_edit boolean default true;

-- Se o colaborador não tiver nenhuma linha aqui, ele continua vendo todos
-- os eventos da empresa (comportamento atual, sem quebrar quem já existe).
-- Assim que a consultora atribuir ao menos um evento a ele, passa a ver
-- só os eventos atribuídos.
create table if not exists event_access (
  id uuid primary key default gen_random_uuid(),
  event_id uuid references events(id) on delete cascade,
  collaborator_id uuid references profiles(id) on delete cascade,
  created_at timestamptz default now(),
  unique (event_id, collaborator_id)
);

alter table event_access enable row level security;
create policy "event_access_account_select" on event_access for select using (
  event_id in (select id from events where consultant_id = account_id())
);
create policy "event_access_owner_select_all" on event_access for select using (is_owner());
