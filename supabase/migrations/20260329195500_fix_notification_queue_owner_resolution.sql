-- Endurece la relacion de trabajos con owner_user_id para que la cola push
-- no dependa de que la app envie siempre owner_user_id.

create or replace function public.tg_trabajos_ensure_owner_user_id()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    new.owner_user_id := coalesce(new.owner_user_id, auth.uid());
  else
    new.owner_user_id := coalesce(new.owner_user_id, old.owner_user_id, auth.uid());
  end if;

  return new;
end;
$$;

drop trigger if exists trg_before_trabajos_ensure_owner_user_id on public.trabajos;
create trigger trg_before_trabajos_ensure_owner_user_id
before insert or update
on public.trabajos
for each row
execute function public.tg_trabajos_ensure_owner_user_id();

create or replace function public.tg_enqueue_trabajo_created_notification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner uuid;
begin
  v_owner := coalesce(new.owner_user_id, auth.uid());

  if v_owner is null then
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
    v_owner,
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

create or replace function public.tg_enqueue_trabajo_terminado_notification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner uuid;
begin
  v_owner := coalesce(new.owner_user_id, old.owner_user_id, auth.uid());

  if v_owner is null then
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
      v_owner,
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
