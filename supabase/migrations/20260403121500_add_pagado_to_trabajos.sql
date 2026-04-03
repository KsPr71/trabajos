alter table public.trabajos
add column if not exists pagado boolean not null default false;

comment on column public.trabajos.pagado
is 'Indica si el trabajo ya fue pagado por el cliente.';

create index if not exists idx_trabajos_pagado on public.trabajos (pagado);
