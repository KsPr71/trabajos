-- Preserva trabajo_id historico en notification_queue aunque el trabajo sea eliminado.
-- Antes: FK con ON DELETE SET NULL limpiaba trabajo_id en historicos ya enviados.

alter table public.notification_queue
  drop constraint if exists notification_queue_trabajo_id_fkey;

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
      'trabajoId', new.id,
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
        'trabajoId', new.id,
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
