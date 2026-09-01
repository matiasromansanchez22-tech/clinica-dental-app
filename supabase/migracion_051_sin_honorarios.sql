-- Migración 051: marca "sin honorarios" en facturación a obras sociales —
-- para prestaciones administrativas (estampilla, consulta preventiva, etc.)
-- que se facturan normalmente a la obra social pero no le generan % de
-- honorarios a ningún profesional. La misma marca en las prestaciones
-- particulares/copago no necesita columna nueva: va directo en el JSON de
-- caja_general.prestaciones.
--
-- Copiar y pegar en Supabase → SQL Editor → Run.

alter table facturacion_obras_sociales add column if not exists sin_honorarios boolean not null default false;
