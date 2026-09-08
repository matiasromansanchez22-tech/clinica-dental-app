-- Migración 076: al cerrar el mes, la ganancia (o pérdida) limpia de ese
-- mes se carga sola como un movimiento en el panel Consultorio — así el
-- "pozo" siempre refleja lo que realmente queda disponible, sin tener que
-- cargarlo a mano.
--
-- Copiar y pegar en Supabase → SQL Editor → Run.

alter table cierres_mes_verificados
  add column if not exists movimiento_consultorio_id uuid references movimientos_personales(id);
