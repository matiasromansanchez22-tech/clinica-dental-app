-- Migración 157: "Pago adelantado" en Caja (General y Ortodoncia).
--
-- Cuando un paciente paga por adelantado (por ejemplo una parte de la 1ª cuota de la
-- instalación) y el resto lo abona el día del turno, la plata entra a la caja con este tipo
-- de cobro y a la vez queda como saldo a favor del paciente. Cuando venga al turno, en su cobro
-- aparece "tiene $X a favor" y se aplica. No se liquida a ningún profesional (no tiene
-- prestaciones cargadas).
--
-- Copiar y pegar en Supabase → SQL Editor → Run.

alter table caja_ortodoncia drop constraint if exists caja_ortodoncia_concepto_check;
alter table caja_ortodoncia add constraint caja_ortodoncia_concepto_check
  check (concepto in (
    'Control', 'Reposición de bracket', 'Instalación (contado)', 'Instalación (2 cuotas)',
    'Continuación de ortodoncia', 'Desinstalación', 'Consulta de ortodoncia', 'Urgencia',
    'Pago adelantado'
  ));

alter table caja_general drop constraint if exists caja_general_modalidad_check;
alter table caja_general add constraint caja_general_modalidad_check
  check (modalidad in ('Día a día', 'Plan de financiación', 'Pago adelantado'));
