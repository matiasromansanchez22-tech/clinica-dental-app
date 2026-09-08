-- Migración 075: permite marcar categorías de gasto que se pagan con la
-- reserva de Consultorio (como ya pasaba con Sueldos) en vez de con la
-- plata del día. Al cargar un gasto de una de estas categorías, además
-- de quedar como Gasto oficial, resta de la reserva de Consultorio — y
-- no cuenta en el "Disponible" del día en Caja (igual que Sueldos).
--
-- Copiar y pegar en Supabase → SQL Editor → Run.

alter table categorias_gasto
  add column if not exists sale_de_reserva boolean not null default false;

update categorias_gasto
  set sale_de_reserva = true
  where nombre in ('Alquiler', 'Impuestos', 'Pago a proveedor', 'Pagos a Laboratorio');
