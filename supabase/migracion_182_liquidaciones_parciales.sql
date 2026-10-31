-- Migración 182: pagos parciales a un profesional por un mismo cobro.
--
-- Hasta ahora, cuando se tildaba un cobro al registrar un pago a un profesional, el cobro quedaba "Liquidado ✓"
-- por completo. Ahora se puede indicar si se le pagó el TOTAL de lo que le corresponde por ese paciente o solo una
-- PARTE. Si fue una parte, el cobro sigue pendiente y figura cuánto falta; en el próximo pago se completa.
--
-- · honorarios: lo que le corresponde al profesional por ese cobro (lo que se vio al tildarlo).
-- · monto_pagado: lo que se le pagó por ese cobro en ese pago.
-- · parcial: true si ese pago no completó el cobro.
-- Las filas que ya existían quedan como estaban (liquidación completa, sin montos).
--
-- Un cobro puede tener varias filas parciales y UNA sola completa (por eso se cambian los índices únicos).
--
-- Para DESHACER (solo si no se cargó ninguna parcial): volver a crear los índices únicos de la migración 148 y
--   alter table cobros_liquidados drop column honorarios, drop column monto_pagado, drop column parcial;
--
-- Copiar y pegar en Supabase → SQL Editor → Run.

alter table cobros_liquidados add column if not exists honorarios numeric;
alter table cobros_liquidados add column if not exists monto_pagado numeric;
alter table cobros_liquidados add column if not exists parcial boolean not null default false;

drop index if exists cobros_liquidados_general_unico;
drop index if exists cobros_liquidados_ortodoncia_unico;

create unique index if not exists cobros_liquidados_general_completo
  on cobros_liquidados (caja_general_id) where caja_general_id is not null and not parcial;
create unique index if not exists cobros_liquidados_ortodoncia_completo
  on cobros_liquidados (caja_ortodoncia_id) where caja_ortodoncia_id is not null and not parcial;

create index if not exists cobros_liquidados_general_idx on cobros_liquidados (caja_general_id) where caja_general_id is not null;
create index if not exists cobros_liquidados_ortodoncia_idx on cobros_liquidados (caja_ortodoncia_id) where caja_ortodoncia_id is not null;
