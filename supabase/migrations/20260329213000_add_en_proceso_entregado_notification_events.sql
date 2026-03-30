-- Amplia notification_queue para registrar cambios de estado:
-- en_proceso, terminado y entregado.

alter table public.notification_queue
  drop constraint if exists notification_queue_event_type_check;

alter table public.notification_queue
  add constraint notification_queue_event_type_check
  check (
    event_type in (
      'trabajo_creado',
      'trabajo_en_proceso',
      'trabajo_terminado',
      'trabajo_entregado'
    )
  );

create or replace function public.tg_enqueue_trabajo_terminado_notification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner uuid;
  v_event_type text;
begin
  v_owner := coalesce(new.owner_user_id, old.owner_user_id, auth.uid());

  if v_owner is null then
    return new;
  end if;

  if coalesce(old.estado, '') is distinct from new.estado then
    if new.estado = 'en_proceso' then
      v_event_type := 'trabajo_en_proceso';
    elsif new.estado = 'terminado' then
      v_event_type := 'trabajo_terminado';
    elsif new.estado = 'entregado' then
      v_event_type := 'trabajo_entregado';
    else
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
      v_event_type,
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
