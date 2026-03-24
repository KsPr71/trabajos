alter table public.tipo_trabajo
add column if not exists precio numeric(12,2) not null default 0;
