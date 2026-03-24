-- Esquema inicial para gestion de trabajos

create table if not exists public.clientes (
  id bigint generated always as identity primary key,
  nombre text not null,
  fecha_nacimiento date,
  direccion text,
  telefono text,
  created_at timestamptz not null default now()
);

create table if not exists public.especialidad (
  id bigint generated always as identity primary key,
  nombre text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.tipo_trabajo (
  id bigint generated always as identity primary key,
  nombre text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.institucion (
  id bigint generated always as identity primary key,
  nombre text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.trabajos (
  id bigint generated always as identity primary key,
  nombre_trabajo text not null,
  tipo_trabajo_id bigint not null references public.tipo_trabajo (id) on update cascade on delete restrict,
  cliente_id bigint not null references public.clientes (id) on update cascade on delete restrict,
  especialidad_id bigint not null references public.especialidad (id) on update cascade on delete restrict,
  institucion_id bigint references public.institucion (id) on update cascade on delete set null,
  fecha_recibido date not null,
  fecha_entrega date,
  created_at timestamptz not null default now(),
  constraint trabajos_fechas_validas check (fecha_entrega is null or fecha_entrega >= fecha_recibido)
);

create table if not exists public.documentos_recibidos (
  id bigint generated always as identity primary key,
  trabajo_id bigint not null references public.trabajos (id) on update cascade on delete cascade,
  nombre_documento text not null,
  descripcion text,
  fecha_recepcion date not null default current_date,
  created_at timestamptz not null default now()
);

create index if not exists idx_trabajos_tipo_trabajo_id on public.trabajos (tipo_trabajo_id);
create index if not exists idx_trabajos_cliente_id on public.trabajos (cliente_id);
create index if not exists idx_trabajos_especialidad_id on public.trabajos (especialidad_id);
create index if not exists idx_trabajos_institucion_id on public.trabajos (institucion_id);
create index if not exists idx_documentos_recibidos_trabajo_id on public.documentos_recibidos (trabajo_id);
