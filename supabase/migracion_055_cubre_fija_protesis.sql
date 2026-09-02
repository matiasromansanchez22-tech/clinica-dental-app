-- Migración 055: marca por obra social si cubre fija y prótesis. Se usa
-- solo en Presupuestos — si la obra social del paciente NO cubre esto, el
-- presupuesto usa el valor particular en vez del copago del nomenclador
-- (Caja sigue funcionando igual que hasta ahora, sin cambios).
--
-- Copiar y pegar en Supabase → SQL Editor → Run.

alter table obras_sociales add column if not exists cubre_fija_protesis boolean not null default true;

update obras_sociales set cubre_fija_protesis = false where nombre = 'Federada Salud';
