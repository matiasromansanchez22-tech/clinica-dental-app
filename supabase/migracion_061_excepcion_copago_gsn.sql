-- Migración 061: Protege el copago de Grupo San Nicolás (recién cargado,
-- con valores exactos de la lista oficial 08/2025) para que no se pise si
-- alguna vez se usa "Recalcular copagos sobre particular" en Gerencial →
-- Control de Obras Sociales.
--
-- Copiar y pegar en Supabase → SQL Editor → Run.

insert into configuracion_copago_excepcion (obra_social, porcentaje, observaciones) values
  ('Grupo San Nicolás S3000/B3100/B4100', 0, 'Sin coseguro (lista oficial GSN 08/2025). No recalcular sobre particular.'),
  ('Grupo San Nicolás B2100', 25, 'Coseguro exacto de la lista oficial GSN 08/2025 (25% del valor OS). No recalcular sobre particular.'),
  ('Grupo San Nicolás S2000', 33.33, 'Coseguro exacto de la lista oficial GSN 08/2025 (33,33% del valor OS). No recalcular sobre particular.'),
  ('Grupo San Nicolás S1000 PMO', 100, 'Coseguro exacto de la lista oficial GSN 08/2025 (100% del valor OS, 50/50 con GSN). No recalcular sobre particular.')
on conflict (obra_social) do nothing;
