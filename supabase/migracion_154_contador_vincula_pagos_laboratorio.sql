-- Migración 154: la contadora (rol Contador) puede vincular y desvincular un pago de laboratorio con
-- los trabajos que cubre (pagos_laboratorio_trabajos), que es lo que hace la app al cargar un pago a
-- un mecánico (Mario, Dental Pin). Hasta ahora solo lo podían escribir las Dueñas y, al cargar el
-- gasto, a la contadora le fallaba el vínculo.
--
-- Copiar y pegar en Supabase → SQL Editor → Run.

drop policy if exists contador_vincular on pagos_laboratorio_trabajos;
create policy contador_vincular on pagos_laboratorio_trabajos for insert with check (es_contador());

drop policy if exists contador_desvincular on pagos_laboratorio_trabajos;
create policy contador_desvincular on pagos_laboratorio_trabajos for delete using (es_contador());
