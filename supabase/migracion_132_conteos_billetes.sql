-- Migración 132: conteos de billetes guardados (herramienta "Contador de
-- billetes"). Cada conteo guarda el detalle de billetes, el total, una nota
-- y quién lo hizo. Lo pueden ver y guardar la Dueña, las secretarias y el
-- Contador; solo se pueden editar/borrar los propios (la Dueña, cualquiera).
--
-- Copiar y pegar en Supabase → SQL Editor → Run.

create table if not exists conteos_billetes (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid default auth.uid() references auth.users(id),
  nombre_usuario text,
  nota text,
  billetes jsonb not null default '{}'::jsonb,
  monedas numeric not null default 0,
  total numeric not null default 0,
  esperado numeric,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists conteos_billetes_created_idx on conteos_billetes (created_at desc);

alter table conteos_billetes enable row level security;

drop policy if exists ver_y_crear on conteos_billetes;
drop policy if exists ver_conteos on conteos_billetes;
create policy ver_conteos on conteos_billetes for select using (es_staff() or es_contador());

drop policy if exists crear_conteos on conteos_billetes;
create policy crear_conteos on conteos_billetes for insert
  with check ((es_staff() or es_contador()) and usuario_id = auth.uid());

drop policy if exists editar_conteos on conteos_billetes;
create policy editar_conteos on conteos_billetes for update
  using (usuario_id = auth.uid() or es_duena())
  with check (usuario_id = auth.uid() or es_duena());

drop policy if exists borrar_conteos on conteos_billetes;
create policy borrar_conteos on conteos_billetes for delete
  using (usuario_id = auth.uid() or es_duena());
