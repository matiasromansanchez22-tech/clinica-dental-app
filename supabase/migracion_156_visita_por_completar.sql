-- Migración 156: cuando la secretaria cobra una visita de Ortodoncia ANTES de que el
-- ortodoncista marque qué hizo, el ortodoncista recibe un aviso para completarla (qué hacer la
-- próxima vez o si el paciente está de alta, nota y si se despegó algún bracket).
--
-- Al cobrar sin nada marcado, la app deja una fila en prestaciones_realizadas_agenda ya cobrada
-- y con esta marca en true. Cuando el ortodoncista la completa, la marca pasa a false.
--
-- Copiar y pegar en Supabase → SQL Editor → Run.

alter table prestaciones_realizadas_agenda
  add column if not exists por_completar boolean not null default false;

create index if not exists idx_prestaciones_realizadas_por_completar
  on prestaciones_realizadas_agenda(fecha) where por_completar = true;
