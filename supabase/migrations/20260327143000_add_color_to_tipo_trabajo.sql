alter table public.tipo_trabajo
add column if not exists color text not null default '#1F4EA8';

update public.tipo_trabajo
set color = '#1F4EA8'
where color is null
   or color !~ '^#[0-9A-Fa-f]{6}$';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'tipo_trabajo_color_hex_valido'
  ) then
    alter table public.tipo_trabajo
    add constraint tipo_trabajo_color_hex_valido
    check (color ~ '^#[0-9A-Fa-f]{6}$');
  end if;
end $$;
