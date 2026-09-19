-- Para las cuotas de un plan de financiación: guarda qué prestación(es)
-- del presupuesto original se hicieron ese día, aparte de "prestaciones"
-- (que sigue vacío en las cuotas y no participa de la liquidación por
-- catálogo — esto es solo informativo, para el registro clínico).
alter table caja_general add column if not exists prestaciones_realizadas jsonb;
