-- Cola de notificaciones push desacoplada de la app
-- Flujo: trigger SQL -> notification_queue -> Edge Function procesadora

create table if not exists public.notification_queue (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  trabajo_id bigint references public.trabajos (id) on delete set null,
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  scheduled_for timestamptz not null default now(),
  status text not null default 'pending',
  attempt_count integer not null default 0,
  max_attempts integer not null default 5,
  last_error text,
  locked_at timestamptz,
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint notification_queue_event_type_check
    check (event_type in ('trabajo_creado', 'trabajo_terminado')),
  constraint notification_queue_status_check
    check (status in ('pending', 'processing', 'sent', 'failed')),
  constraint notification_queue_attempts_check
    check (attempt_count >= 0 and max_attempts > 0 and attempt_count <= max_attempts + 10)
);

create index if not exists idx_notification_queue_status_scheduled_for
  on public.notification_queue (status, scheduled_for);
create index if not exists idx_notification_queue_user_id
  on public.notification_queue (user_id);
create index if not exists idx_notification_queue_trabajo_id
  on public.notification_queue (trabajo_id);

alter table public.notification_queue enable row level security;

drop policy if exists "notification_queue_authenticated_own_select" on public.notification_queue;
create policy "notification_queue_authenticated_own_select"
on public.notification_queue
for select
to authenticated
using (auth.uid() = user_id);

create or replace function public.tg_notification_queue_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  if tg_op = 'INSERT' and new.created_at is null then
    new.created_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists trg_notification_queue_set_updated_at on public.notification_queue;
create trigger trg_notification_queue_set_updated_at
before insert or update
on public.notification_queue
for each row
execute function public.tg_notification_queue_set_updated_at();

create or replace function public.tg_enqueue_trabajo_created_notification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.owner_user_id is null then
    return new;
  end if;

  insert into public.notification_queue (
    user_id,
    trabajo_id,
    event_type,
    payload,
    scheduled_for
  )
  values (
    new.owner_user_id,
    new.id,
    'trabajo_creado',
    jsonb_build_object(
      'trabajoNombre', new.nombre_trabajo,
      'fechaEntrega', new.fecha_entrega,
      'estado', new.estado
    ),
    coalesce(new.created_at, now())
  );

  return new;
end;
$$;

drop trigger if exists trg_enqueue_trabajo_created_notification on public.trabajos;
create trigger trg_enqueue_trabajo_created_notification
after insert
on public.trabajos
for each row
execute function public.tg_enqueue_trabajo_created_notification();

create or replace function public.tg_enqueue_trabajo_terminado_notification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.owner_user_id is null then
    return new;
  end if;

  if coalesce(old.estado, '') is distinct from 'terminado'
     and new.estado = 'terminado' then
    insert into public.notification_queue (
      user_id,
      trabajo_id,
      event_type,
      payload,
      scheduled_for
    )
    values (
      new.owner_user_id,
      new.id,
      'trabajo_terminado',
      jsonb_build_object(
        'trabajoNombre', new.nombre_trabajo,
        'fechaEntrega', new.fecha_entrega,
        'estadoAnterior', old.estado,
        'estadoNuevo', new.estado
      ),
      now()
    );
  end if;

  return new;
end;
$$;

drop trigger if exists trg_enqueue_trabajo_terminado_notification on public.trabajos;
create trigger trg_enqueue_trabajo_terminado_notification
after update of estado
on public.trabajos
for each row
execute function public.tg_enqueue_trabajo_terminado_notification();

create or replace function public.fn_claim_notification_queue(p_limit integer default 50)
returns setof public.notification_queue
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  with to_claim as (
    select q.id
    from public.notification_queue q
    where q.status = 'pending'
      and q.scheduled_for <= now()
      and q.attempt_count < q.max_attempts
    order by q.scheduled_for asc, q.id asc
    limit greatest(coalesce(p_limit, 50), 1)
    for update skip locked
  ),
  claimed as (
    update public.notification_queue q
    set
      status = 'processing',
      locked_at = now(),
      attempt_count = q.attempt_count + 1,
      updated_at = now()
    from to_claim
    where q.id = to_claim.id
    returning q.*
  )
  select *
  from claimed;
end;
$$;

revoke all on function public.fn_claim_notification_queue(integer) from public;
revoke all on function public.fn_claim_notification_queue(integer) from anon;
revoke all on function public.fn_claim_notification_queue(integer) from authenticated;
grant execute on function public.fn_claim_notification_queue(integer) to service_role;
