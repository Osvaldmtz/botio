-- Botio initial schema
-- Ownership chain: messages -> conversations -> bots -> businesses.owner_id -> auth.uid()

create table public.businesses (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  logo_url text,
  primary_color text default '#00FF88',
  created_at timestamptz not null default now()
);

create table public.bots (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null,
  system_prompt text not null default '',
  twilio_account_sid text,
  twilio_auth_token text, -- TODO: encrypt with pgsodium/Vault before production
  twilio_whatsapp_number text,
  is_active boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  bot_id uuid not null references public.bots(id) on delete cascade,
  customer_phone text not null,
  created_at timestamptz not null default now(),
  unique (bot_id, customer_phone)
);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  role text not null check (role in ('user','assistant')),
  content text not null,
  created_at timestamptz not null default now()
);

create index on public.bots (business_id);
create index on public.conversations (bot_id);
create index on public.messages (conversation_id, created_at);

alter table public.businesses    enable row level security;
alter table public.bots          enable row level security;
alter table public.conversations enable row level security;
alter table public.messages      enable row level security;

create policy "owner_all_businesses" on public.businesses
  for all
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

create policy "owner_all_bots" on public.bots
  for all
  using (
    exists (
      select 1 from public.businesses b
      where b.id = bots.business_id and b.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.businesses b
      where b.id = bots.business_id and b.owner_id = auth.uid()
    )
  );

create policy "owner_all_conversations" on public.conversations
  for all
  using (
    exists (
      select 1 from public.bots bo
      join public.businesses b on b.id = bo.business_id
      where bo.id = conversations.bot_id and b.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.bots bo
      join public.businesses b on b.id = bo.business_id
      where bo.id = conversations.bot_id and b.owner_id = auth.uid()
    )
  );

create policy "owner_all_messages" on public.messages
  for all
  using (
    exists (
      select 1 from public.conversations c
      join public.bots bo on bo.id = c.bot_id
      join public.businesses b on b.id = bo.business_id
      where c.id = messages.conversation_id and b.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.conversations c
      join public.bots bo on bo.id = c.bot_id
      join public.businesses b on b.id = bo.business_id
      where c.id = messages.conversation_id and b.owner_id = auth.uid()
    )
  );
