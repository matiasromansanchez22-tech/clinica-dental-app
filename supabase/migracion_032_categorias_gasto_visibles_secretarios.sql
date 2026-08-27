-- Migración 032: separar qué categorías de gasto puede ver un secretario/a
-- desde el botón "Registrar pago" de Caja, de las que maneja solo la Dueña.
--
-- Copiar y pegar en Supabase → SQL Editor → Run.

alter table categorias_gasto add column if not exists visible_secretarios boolean not null default false;

insert into categorias_gasto (nombre, visible_secretarios) values
  ('Insumos descartables', true),
  ('Imprenta', true),
  ('Agua / Dispenser', true),
  ('Cadete', true)
on conflict (nombre) do update set visible_secretarios = true;

update categorias_gasto set visible_secretarios = true where nombre = 'Pago a proveedor';
