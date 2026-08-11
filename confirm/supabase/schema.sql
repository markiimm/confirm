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
