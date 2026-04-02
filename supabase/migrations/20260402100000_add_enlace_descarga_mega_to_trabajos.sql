-- Enlace opcional de descarga en MEGA para cada trabajo.
alter table public.trabajos
add column if not exists enlace_descarga_mega text;

comment on column public.trabajos.enlace_descarga_mega
is 'Enlace de descarga del trabajo alojado en MEGA.';
