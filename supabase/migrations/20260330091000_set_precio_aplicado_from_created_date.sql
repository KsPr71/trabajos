-- Congela precio_aplicado usando la fecha de contratacion (creado),
-- no la fecha de entrega.

create or replace function public.fn_set_precio_aplicado_trabajo()
returns trigger
language plpgsql
as $$
declare
  v_precio numeric;
  v_ref_date date;
begin
  v_ref_date := coalesce(
    new.estado_creado_at::date,
    new.created_at::date,
    current_date
  );

  if tg_op = 'INSERT' then
    v_precio := public.fn_precio_vigente_tipo_trabajo(
      new.tipo_trabajo_id,
      v_ref_date
    );

    if v_precio is null then
      select tt.precio
        into v_precio
      from public.tipo_trabajo tt
      where tt.id = new.tipo_trabajo_id;
    end if;

    new.precio_aplicado := v_precio;
    return new;
  end if;

  if new.tipo_trabajo_id is distinct from old.tipo_trabajo_id
     or new.precio_aplicado is null then
    v_precio := public.fn_precio_vigente_tipo_trabajo(
      new.tipo_trabajo_id,
      v_ref_date
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

-- Recalculo para registros existentes segun fecha de creacion/contratacion.
update public.trabajos t
set precio_aplicado = coalesce(
  public.fn_precio_vigente_tipo_trabajo(
    t.tipo_trabajo_id,
    coalesce(t.estado_creado_at::date, t.created_at::date, current_date)
  ),
  tt.precio
)
from public.tipo_trabajo tt
where t.tipo_trabajo_id = tt.id;
