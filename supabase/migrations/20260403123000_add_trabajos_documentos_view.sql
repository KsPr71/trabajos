create or replace view public.v_trabajos_documentos as
select
  t.id,
  t.nombre_trabajo,
  t.tipo_trabajo_id,
  t.cliente_id,
  t.especialidad_id,
  t.institucion_id,
  t.fecha_recibido,
  t.fecha_entrega,
  t.estado,
  t.pagado,
  t.enlace_descarga_mega,
  t.precio_aplicado,
  t.created_at,
  t.estado_creado_at,
  t.estado_en_proceso_at,
  t.estado_terminado_at,
  t.estado_entregado_at,
  coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', d.id,
        'nombre_documento', d.nombre_documento,
        'descripcion', d.descripcion,
        'fecha_recepcion', d.fecha_recepcion,
        'created_at', d.created_at
      )
      order by d.fecha_recepcion desc, d.id desc
    ) filter (where d.id is not null),
    '[]'::jsonb
  ) as documentos_recibidos
from public.trabajos t
left join public.documentos_recibidos d
  on d.trabajo_id = t.id
group by t.id;

comment on view public.v_trabajos_documentos
is 'Vista de trabajos con el campo documentos_recibidos agregado como JSON.';
