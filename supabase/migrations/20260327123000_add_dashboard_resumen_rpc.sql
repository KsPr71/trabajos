-- Dashboard agregado en backend para reducir payload y CPU en cliente

create index if not exists idx_trabajos_dashboard_lookup
on public.trabajos (tipo_trabajo_id, estado, fecha_entrega);

create or replace function public.fn_dashboard_resumen()
returns jsonb
language sql
stable
security invoker
as $$
  with month_names as (
    select array[
      'Enero',
      'Febrero',
      'Marzo',
      'Abril',
      'Mayo',
      'Junio',
      'Julio',
      'Agosto',
      'Septiembre',
      'Octubre',
      'Noviembre',
      'Diciembre'
    ]::text[] as names
  ),
  base as (
    select
      coalesce(tt.nombre, 'Sin tipo') as tipo_trabajo,
      t.nombre_trabajo,
      t.fecha_entrega,
      t.estado,
      coalesce(t.precio_aplicado, tt.precio, 0)::numeric as precio
    from public.trabajos t
    left join public.tipo_trabajo tt
      on tt.id = t.tipo_trabajo_id
  ),
  resumen_por_tipo as (
    select
      b.tipo_trabajo,
      count(*)::int as total,
      count(*) filter (where b.estado = 'creado')::int as creado,
      count(*) filter (where b.estado = 'en_proceso')::int as en_proceso,
      count(*) filter (where b.estado = 'terminado')::int as terminado,
      count(*) filter (where b.estado = 'entregado')::int as entregado
    from base b
    group by b.tipo_trabajo
  ),
  ganancias as (
    select
      coalesce(sum(case when b.estado = 'entregado' then b.precio else 0 end), 0)::numeric as recibidas,
      coalesce(sum(case when b.estado <> 'entregado' then b.precio else 0 end), 0)::numeric as esperadas
    from base b
  ),
  ganancias_por_mes as (
    select
      date_trunc('month', b.fecha_entrega)::date as mes,
      coalesce(sum(case when b.estado = 'entregado' then b.precio else 0 end), 0)::numeric as recibidas,
      coalesce(sum(case when b.estado <> 'entregado' then b.precio else 0 end), 0)::numeric as esperadas
    from base b
    where b.fecha_entrega is not null
    group by date_trunc('month', b.fecha_entrega)::date
  ),
  entregas_por_mes as (
    select
      date_trunc('month', b.fecha_entrega)::date as mes,
      array_agg(b.nombre_trabajo order by b.nombre_trabajo) as trabajos
    from base b
    where b.fecha_entrega is not null
      and b.fecha_entrega >= current_date
      and b.estado <> 'entregado'
    group by date_trunc('month', b.fecha_entrega)::date
  )
  select jsonb_build_object(
    'generated_at',
    now(),
    'resumen_por_tipo',
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'tipo_trabajo',
            r.tipo_trabajo,
            'total',
            r.total,
            'estado_counts',
            jsonb_build_object(
              'creado',
              r.creado,
              'en_proceso',
              r.en_proceso,
              'terminado',
              r.terminado,
              'entregado',
              r.entregado
            )
          )
          order by r.total desc, r.tipo_trabajo asc
        )
        from resumen_por_tipo r
      ),
      '[]'::jsonb
    ),
    'ganancias',
    (
      select jsonb_build_object(
        'esperadas',
        g.esperadas,
        'recibidas',
        g.recibidas,
        'total',
        (g.esperadas + g.recibidas)
      )
      from ganancias g
    ),
    'ganancias_por_mes',
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'key',
            to_char(gpm.mes, 'YYYY-MM'),
            'mes_label',
            mn.names[extract(month from gpm.mes)::int] || ' ' || extract(year from gpm.mes)::int,
            'esperadas',
            gpm.esperadas,
            'recibidas',
            gpm.recibidas,
            'total',
            (gpm.esperadas + gpm.recibidas)
          )
          order by gpm.mes asc
        )
        from ganancias_por_mes gpm
        cross join month_names mn
      ),
      '[]'::jsonb
    ),
    'entregas_por_mes',
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'key',
            to_char(epm.mes, 'YYYY-MM'),
            'mes_label',
            mn.names[extract(month from epm.mes)::int] || ' ' || extract(year from epm.mes)::int,
            'trabajos',
            to_jsonb(epm.trabajos)
          )
          order by epm.mes asc
        )
        from entregas_por_mes epm
        cross join month_names mn
      ),
      '[]'::jsonb
    )
  );
$$;

grant execute on function public.fn_dashboard_resumen() to authenticated;
