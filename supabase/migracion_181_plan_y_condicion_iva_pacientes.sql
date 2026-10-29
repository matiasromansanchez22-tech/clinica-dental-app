-- Migración 181: plan de la obra social y condición frente al IVA en la ficha del paciente (Odontología General).
--
-- · plan_obra_social: texto libre (ej. «210», «Plata», «Integral»). Solo se usa si el paciente no es Particular.
-- · condicion_iva: una de las condiciones frente al IVA (para facturar). Queda vacía hasta que se cargue.
--
-- Para DESHACER: alter table pacientes drop column plan_obra_social, drop column condicion_iva;
--
-- Copiar y pegar en Supabase → SQL Editor → Run.

alter table pacientes add column if not exists plan_obra_social text;
alter table pacientes add column if not exists condicion_iva text;

alter table pacientes drop constraint if exists pacientes_condicion_iva_check;
alter table pacientes add constraint pacientes_condicion_iva_check
  check (condicion_iva is null or condicion_iva in (
    'Consumidor Final', 'Responsable Inscripto', 'Monotributista', 'IVA Exento', 'No Responsable'
  ));
