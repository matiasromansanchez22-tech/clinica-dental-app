-- Migración 173: concepto "Gomas intermaxilares" en la Caja de Ortodoncia.
--
-- Cuando el ortodoncista entrega gomas intermaxilares (1/4 o 1/8) en una visita que la secretaria ya
-- había cobrado, las gomas se cobran aparte con este concepto.
--
-- Copiar y pegar en Supabase → SQL Editor → Run.

alter table caja_ortodoncia drop constraint if exists caja_ortodoncia_concepto_check;
alter table caja_ortodoncia add constraint caja_ortodoncia_concepto_check
  check (concepto in (
    'Control', 'Reposición de bracket', 'Instalación (contado)', 'Instalación (2 cuotas)',
    'Continuación de ortodoncia', 'Desinstalación', 'Consulta de ortodoncia', 'Urgencia',
    'Pago adelantado', 'Gomas intermaxilares'
  ));
