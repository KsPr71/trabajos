-- Fechas por estado en trabajos:
-- - creado: estado_creado_at
-- - en_proceso: estado_en_proceso_at
-- - terminado: estado_terminado_at
-- - entregado: estado_entregado_at

alter table public.trabajos
  add column if not exists estado_creado_at timestamptz,
  add column if not exists estado_en_proceso_at timestamptz,
  add column if not exists estado_terminado_at timestamptz,
  add column if not exists estado_entregado_at timestamptz;

-- Backfill minimo para registros existentes.
update public.trabajos
set estado_creado_at = coalesce(estado_creado_at, created_at, now())
where estado_creado_at is null;

update public.trabajos
set estado_en_proceso_at = coalesce(estado_en_proceso_at, created_at, now())
where estado in ('en_proceso', 'terminado', 'entregado')
  and estado_en_proceso_at is null;

update public.trabajos
set estado_terminado_at = coalesce(estado_terminado_at, created_at, now())
where estado in ('terminado', 'entregado')
  and estado_terminado_at is null;

update public.trabajos
set estado_entregado_at = coalesce(estado_entregado_at, created_at, now())
where estado = 'entregado'
  and estado_entregado_at is null;

create or replace function public.tg_set_trabajos_estado_fechas()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    new.estado_creado_at := coalesce(new.estado_creado_at, new.created_at, now());

    if new.estado = 'en_proceso' then
      new.estado_en_proceso_at := coalesce(new.estado_en_proceso_at, now());
    elsif new.estado = 'terminado' then
      new.estado_en_proceso_at := coalesce(new.estado_en_proceso_at, now());
      new.estado_terminado_at := coalesce(new.estado_terminado_at, now());
    elsif new.estado = 'entregado' then
      new.estado_en_proceso_at := coalesce(new.estado_en_proceso_at, now());
      new.estado_terminado_at := coalesce(new.estado_terminado_at, now());
      new.estado_entregado_at := coalesce(new.estado_entregado_at, now());
    end if;

    return new;
  end if;

  new.estado_creado_at := coalesce(new.estado_creado_at, old.estado_creado_at, old.created_at, now());

  if new.estado is distinct from old.estado then
    if new.estado = 'en_proceso' then
      new.estado_en_proceso_at := now();
    elsif new.estado = 'terminado' then
      new.estado_terminado_at := now();
    elsif new.estado = 'entregado' then
      new.estado_entregado_at := now();
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_set_trabajos_estado_fechas on public.trabajos;
create trigger trg_set_trabajos_estado_fechas
before insert or update of estado
on public.trabajos
for each row
execute function public.tg_set_trabajos_estado_fechas();
