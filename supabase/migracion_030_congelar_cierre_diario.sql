-- Migración 030: congelar el detalle financiero del día cuando la Dueña
-- aprueba el cierre diario.
--
-- Hasta ahora "cierres_dia_verificados" solo guardaba que el día fue
-- aprobado (fecha, quién, cuándo), pero los números de ingresos/egresos/neto
-- se seguían recalculando en vivo siempre. Si después de cerrado se cargaba
-- un gasto o un pago a un profesional con esa fecha (nada lo impedía), el
-- "cierre" mostraba números distintos a los que la Dueña vio al aprobar.
--
-- Ahora se guarda una foto (jsonb) de todo el detalle del día en el momento
-- exacto de la aprobación, para que quede congelado.
--
-- Copiar y pegar en Supabase → SQL Editor → Run.

alter table cierres_dia_verificados add column if not exists detalle jsonb;
