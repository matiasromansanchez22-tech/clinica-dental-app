-- Migración 191: separar Odontología General y Ortodoncia en Stock e Instrumental.
--
-- Dentro de las mismas pantallas, cada instrumental y cada ítem de la lista de compras queda en un "área"
-- (Odontología General u Ortodoncia). El instrumental puede repetirse con el mismo nombre en las dos áreas
-- (ej. "Espejo bucal"). Todo lo que ya estaba cargado queda en Odontología General.
--
-- Copiar y pegar en Supabase → SQL Editor → Run.

alter table stock_lista_compras
  add column if not exists area text not null default 'Odontología General'
  check (area in ('Odontología General', 'Ortodoncia'));

alter table instrumental_items
  add column if not exists area text not null default 'Odontología General'
  check (area in ('Odontología General', 'Ortodoncia'));

alter table instrumental_items drop constraint if exists instrumental_items_nombre_key;
alter table instrumental_items drop constraint if exists instrumental_items_nombre_area_key;
alter table instrumental_items add constraint instrumental_items_nombre_area_key unique (nombre, area);

alter table instrumental_conteos
  add column if not exists area text not null default 'Odontología General'
  check (area in ('Odontología General', 'Ortodoncia'));
