alter table public.documentos_recibidos
add column if not exists tipo_documento_id bigint
references public.tipo_documento (id)
on update cascade
on delete restrict;

create index if not exists idx_documentos_recibidos_tipo_documento_id
on public.documentos_recibidos (tipo_documento_id);

create unique index if not exists idx_documentos_recibidos_trabajo_tipo_documento_unique
on public.documentos_recibidos (trabajo_id, tipo_documento_id)
where tipo_documento_id is not null;

update public.documentos_recibidos d
set tipo_documento_id = td.id
from public.tipo_documento td
where d.tipo_documento_id is null
  and lower(trim(d.nombre_documento)) = lower(trim(td.nombre));

comment on column public.documentos_recibidos.tipo_documento_id
is 'Relacion opcional al catalogo tipo_documento para seleccionar documentos recibidos por chips.';
