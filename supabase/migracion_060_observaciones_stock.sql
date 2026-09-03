-- Migración 060: Observaciones en Stock de Insumos — para poder aclarar
-- detalles de un insumo (ej. "2 cajas, una ya abierta") y poder corregir
-- el nombre si se cargó mal.
--
-- Copiar y pegar en Supabase → SQL Editor → Run.

alter table stock_insumos add column if not exists observaciones text;
