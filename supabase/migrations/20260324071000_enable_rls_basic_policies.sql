-- Politicas RLS basicas para esquema de trabajos

alter table public.clientes enable row level security;
alter table public.especialidad enable row level security;
alter table public.tipo_trabajo enable row level security;
alter table public.institucion enable row level security;
alter table public.trabajos enable row level security;
alter table public.documentos_recibidos enable row level security;

create policy "clientes_authenticated_all"
on public.clientes
for all
to authenticated
using (true)
with check (true);

create policy "especialidad_authenticated_all"
on public.especialidad
for all
to authenticated
using (true)
with check (true);

create policy "tipo_trabajo_authenticated_all"
on public.tipo_trabajo
for all
to authenticated
using (true)
with check (true);

create policy "institucion_authenticated_all"
on public.institucion
for all
to authenticated
using (true)
with check (true);

create policy "trabajos_authenticated_all"
on public.trabajos
for all
to authenticated
using (true)
with check (true);

create policy "documentos_recibidos_authenticated_all"
on public.documentos_recibidos
for all
to authenticated
using (true)
with check (true);
