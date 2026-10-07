-- Migración 135: permite el concepto "Continuación de ortodoncia" en los
-- cobros de Caja Ortodoncia (pacientes que empezaron en otra clínica y acá
-- hacen solo la continuación).
--
-- Copiar y pegar en Supabase → SQL Editor → Run.

alter table caja_ortodoncia drop constraint if exists caja_ortodoncia_concepto_check;
alter table caja_ortodoncia add constraint caja_ortodoncia_concepto_check
  check (concepto in (
    'Control', 'Reposición de bracket', 'Instalación (contado)', 'Instalación (2 cuotas)',
    'Continuación de ortodoncia', 'Desinstalación', 'Consulta de ortodoncia', 'Urgencia'
  ));
