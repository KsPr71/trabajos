create table if not exists public.tipo_documento (
  id bigint generated always as identity primary key,
  nombre text not null unique,
  created_at timestamptz not null default now()
);

create index if not exists idx_tipo_documento_nombre on public.tipo_documento (nombre);

alter table public.tipo_documento enable row level security;

drop policy if exists "tipo_documento_authenticated_all" on public.tipo_documento;

create policy "tipo_documento_authenticated_all"
on public.tipo_documento
for all
to authenticated
using (true)
with check (true);
