-- Historico de precios por tipo de trabajo + precio aplicado al entregar trabajos

alter table public.trabajos
add column if not exists precio_aplicado numeric(12,2);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'trabajos_precio_aplicado_no_negativo'
  ) then
    alter table public.trabajos
    add constraint trabajos_precio_aplicado_no_negativo
    check (precio_aplicado is null or precio_aplicado >= 0);
  end if;
end $$;

create table if not exists public.tipo_trabajo_precio_historial (
  id bigint generated always as identity primary key,
  tipo_trabajo_id bigint not null
    references public.tipo_trabajo (id)
    on update cascade
    on delete cascade,
  precio numeric(12,2) not null check (precio >= 0),
  vigente_desde date not null,
  vigente_hasta date,
  created_at timestamptz not null default now(),
  constraint tipo_trabajo_precio_historial_rango_valido
    check (vigente_hasta is null or vigente_hasta >= vigente_desde)
);

create unique index if not exists idx_ttph_tipo_open_unique
on public.tipo_trabajo_precio_historial (tipo_trabajo_id)
where vigente_hasta is null;

create index if not exists idx_ttph_tipo_vigencia
on public.tipo_trabajo_precio_historial (tipo_trabajo_id, vigente_desde, vigente_hasta);

alter table public.tipo_trabajo_precio_historial enable row level security;

drop policy if exists "tipo_trabajo_precio_historial_authenticated_all"
on public.tipo_trabajo_precio_historial;

create policy "tipo_trabajo_precio_historial_authenticated_all"
on public.tipo_trabajo_precio_historial
for all
to authenticated
using (true)
with check (true);

create or replace function public.fn_precio_vigente_tipo_trabajo(
  p_tipo_trabajo_id bigint,
  p_fecha date
)
returns numeric
language sql
stable
as $$
  select h.precio
  from public.tipo_trabajo_precio_historial h
  where h.tipo_trabajo_id = p_tipo_trabajo_id
    and h.vigente_desde <= coalesce(p_fecha, current_date)
    and (h.vigente_hasta is null or h.vigente_hasta >= coalesce(p_fecha, current_date))
  order by h.vigente_desde desc, h.id desc
  limit 1
$$;

create or replace function public.fn_sync_tipo_trabajo_precio_historial()
returns trigger
language plpgsql
as $$
declare
  v_open public.tipo_trabajo_precio_historial%rowtype;
begin
  select *
    into v_open
  from public.tipo_trabajo_precio_historial
  where tipo_trabajo_id = new.id
    and vigente_hasta is null
  order by vigente_desde desc, id desc
  limit 1;

  if tg_op = 'INSERT' then
    if v_open.id is null then
      insert into public.tipo_trabajo_precio_historial (
        tipo_trabajo_id,
        precio,
        vigente_desde,
        vigente_hasta
      )
      values (
        new.id,
        new.precio,
        coalesce(new.created_at::date, current_date),
        null
      );
    elsif v_open.precio is distinct from new.precio then
      if v_open.vigente_desde = current_date then
        update public.tipo_trabajo_precio_historial
        set precio = new.precio
        where id = v_open.id;
      else
        update public.tipo_trabajo_precio_historial
        set vigente_hasta = current_date - 1
        where id = v_open.id;

        insert into public.tipo_trabajo_precio_historial (
          tipo_trabajo_id,
          precio,
          vigente_desde,
          vigente_hasta
        )
        values (new.id, new.precio, current_date, null);
      end if;
    end if;

    return new;
  end if;

  if new.precio is distinct from old.precio then
    if v_open.id is null then
      insert into public.tipo_trabajo_precio_historial (
        tipo_trabajo_id,
        precio,
        vigente_desde,
        vigente_hasta
      )
      values (new.id, new.precio, current_date, null);
    elsif v_open.vigente_desde = current_date then
      update public.tipo_trabajo_precio_historial
      set precio = new.precio
      where id = v_open.id;
    else
      update public.tipo_trabajo_precio_historial
      set vigente_hasta = current_date - 1
      where id = v_open.id;

      insert into public.tipo_trabajo_precio_historial (
        tipo_trabajo_id,
        precio,
        vigente_desde,
        vigente_hasta
      )
      values (new.id, new.precio, current_date, null);
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_sync_tipo_trabajo_precio_historial
on public.tipo_trabajo;

create trigger trg_sync_tipo_trabajo_precio_historial
after insert or update of precio
on public.tipo_trabajo
for each row
execute function public.fn_sync_tipo_trabajo_precio_historial();

insert into public.tipo_trabajo_precio_historial (
  tipo_trabajo_id,
  precio,
  vigente_desde,
  vigente_hasta
)
select
  tt.id,
  tt.precio,
  coalesce(tt.created_at::date, current_date),
  null
from public.tipo_trabajo tt
where not exists (
  select 1
  from public.tipo_trabajo_precio_historial h
  where h.tipo_trabajo_id = tt.id
);

create or replace function public.fn_set_precio_aplicado_trabajo()
returns trigger
language plpgsql
as $$
declare
  v_precio numeric;
begin
  if new.estado = 'entregado' then
    v_precio := public.fn_precio_vigente_tipo_trabajo(
      new.tipo_trabajo_id,
      coalesce(new.fecha_entrega, current_date)
    );

    if v_precio is null then
      select tt.precio
        into v_precio
      from public.tipo_trabajo tt
      where tt.id = new.tipo_trabajo_id;
    end if;

    new.precio_aplicado := v_precio;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_set_precio_aplicado_trabajo
on public.trabajos;

create trigger trg_set_precio_aplicado_trabajo
before insert or update of estado, fecha_entrega, tipo_trabajo_id
on public.trabajos
for each row
execute function public.fn_set_precio_aplicado_trabajo();

update public.trabajos t
set precio_aplicado = coalesce(
  public.fn_precio_vigente_tipo_trabajo(
    t.tipo_trabajo_id,
    coalesce(t.fecha_entrega, current_date)
  ),
  tt.precio
)
from public.tipo_trabajo tt
where t.tipo_trabajo_id = tt.id
  and t.estado = 'entregado'
  and t.precio_aplicado is null;
