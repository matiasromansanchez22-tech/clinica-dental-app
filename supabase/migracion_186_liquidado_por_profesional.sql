-- Migración 186: lo liquidado se anota POR PROFESIONAL.
--
-- Una cuota de un plan de financiación puede mezclar especialidades y repartirse entre dos profesionales
-- (por ejemplo, periodoncia de Catalina y una restauración de Agustín). Hasta ahora, una marca de «liquidado» era
-- por cobro, así que la parte de uno de los dos no se podía pagar tildando. Con esta columna, cada marca dice a qué
-- profesional se le liquidó: el mismo cobro puede estar liquidado para uno y pendiente para el otro.
--
-- Las marcas que ya existen se completan con el profesional del pago que las creó.
--
-- Para DESHACER: volver a crear los índices únicos de la migración 182 y
--   alter table cobros_liquidados drop column profesional_id;
--
-- Copiar y pegar en Supabase → SQL Editor → Run.

alter table cobros_liquidados add column if not exists profesional_id uuid references profesionales(id);

update cobros_liquidados cl
   set profesional_id = pp.profesional_id
  from pagos_profesionales pp
 where pp.id = cl.pago_profesional_id
   and cl.profesional_id is null;

drop index if exists cobros_liquidados_general_completo;
drop index if exists cobros_liquidados_ortodoncia_completo;

create unique index if not exists cobros_liquidados_general_completo_prof
  on cobros_liquidados (caja_general_id, profesional_id) where caja_general_id is not null and not parcial;
create unique index if not exists cobros_liquidados_ortodoncia_completo_prof
  on cobros_liquidados (caja_ortodoncia_id, profesional_id) where caja_ortodoncia_id is not null and not parcial;

create index if not exists cobros_liquidados_profesional_idx on cobros_liquidados (profesional_id);
