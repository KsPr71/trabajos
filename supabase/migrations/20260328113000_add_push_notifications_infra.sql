-- Infraestructura para notificaciones push remotas con Expo Push Service

alter table public.trabajos
  add column if not exists owner_user_id uuid references auth.users (id) on delete set null;

alter table public.trabajos
  alter column owner_user_id set default auth.uid();

create index if not exists idx_trabajos_owner_user_id on public.trabajos (owner_user_id);

create table if not exists public.device_push_tokens (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  expo_push_token text not null,
  platform text not null default 'unknown',
  device_name text,
  is_active boolean not null default true,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint device_push_tokens_platform_check check (platform in ('android', 'ios', 'web', 'unknown')),
  constraint device_push_tokens_user_token_unique unique (user_id, expo_push_token)
);

create index if not exists idx_device_push_tokens_user_id on public.device_push_tokens (user_id);
create index if not exists idx_device_push_tokens_active on public.device_push_tokens (is_active);

create table if not exists public.push_reminder_logs (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  trabajo_id bigint not null references public.trabajos (id) on delete cascade,
  reminder_date date not null,
  created_at timestamptz not null default now(),
  constraint push_reminder_logs_unique unique (user_id, trabajo_id, reminder_date)
);

create index if not exists idx_push_reminder_logs_user_date on public.push_reminder_logs (user_id, reminder_date);

alter table public.device_push_tokens enable row level security;
alter table public.push_reminder_logs enable row level security;

drop policy if exists "device_push_tokens_authenticated_own_select" on public.device_push_tokens;
create policy "device_push_tokens_authenticated_own_select"
on public.device_push_tokens
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "device_push_tokens_authenticated_own_insert" on public.device_push_tokens;
create policy "device_push_tokens_authenticated_own_insert"
on public.device_push_tokens
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "device_push_tokens_authenticated_own_update" on public.device_push_tokens;
create policy "device_push_tokens_authenticated_own_update"
on public.device_push_tokens
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "device_push_tokens_authenticated_own_delete" on public.device_push_tokens;
create policy "device_push_tokens_authenticated_own_delete"
on public.device_push_tokens
for delete
to authenticated
using (auth.uid() = user_id);
