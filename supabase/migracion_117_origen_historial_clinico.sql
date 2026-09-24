-- Migración 117: separar los cambios del odontograma del historial
-- clínico "de verdad" (el que sirve para anotar cómo viene el plan de
-- tratamiento de cada paciente).
--
-- Se agrega "origen" a las entradas — "manual" (lo que carga el
-- profesional a mano) u "odontograma" (lo que se genera solo al marcar un
-- diente). El historial clínico de la ficha del paciente ahora solo
-- muestra las manuales; las del odontograma se ven aparte, dentro del
-- odontograma mismo.
--
-- Copiar y pegar en Supabase → SQL Editor → Run.

alter table historial_clinico_general_entradas
  add column if not exists origen text not null default 'manual';
