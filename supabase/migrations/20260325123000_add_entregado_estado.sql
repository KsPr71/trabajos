alter table public.trabajos
drop constraint if exists trabajos_estado_valido;

alter table public.trabajos
add constraint trabajos_estado_valido
check (estado in ('creado', 'en_proceso', 'terminado', 'entregado'));
