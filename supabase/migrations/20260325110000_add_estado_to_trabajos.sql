alter table public.trabajos
add column if not exists estado text not null default 'creado';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'trabajos_estado_valido'
  ) then
    alter table public.trabajos
    add constraint trabajos_estado_valido
    check (estado in ('creado', 'en_proceso', 'terminado'));
  end if;
end
$$;

create index if not exists idx_trabajos_estado on public.trabajos (estado);
