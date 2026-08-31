-- Migración 045: Comparativa de precios de mecánicos (laboratorios dentales),
-- para poder comparar y actualizar cuando mandan listas nuevas. Solo Dueña,
-- es información competitiva de proveedores.
--
-- Copiar y pegar en Supabase → SQL Editor → Run.

create table if not exists mecanicos_precios (
  id uuid primary key default gen_random_uuid(),
  laboratorio text not null,
  categoria text not null,
  trabajo text not null,
  precio numeric,
  observaciones text,
  contacto text,
  actualizado_en date not null default current_date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists mecanicos_precios_categoria_idx on mecanicos_precios (categoria);
create index if not exists mecanicos_precios_laboratorio_idx on mecanicos_precios (laboratorio);

alter table mecanicos_precios enable row level security;
drop policy if exists mecanicos_precios_todo on mecanicos_precios;
create policy mecanicos_precios_todo on mecanicos_precios for all using (es_duena()) with check (es_duena());
