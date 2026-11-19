-- Migración 210: carga por CÓDIGO de obra social.
--
-- Cuando un paciente es de obra social, el profesional anota en "Actividad de hoy" el código que pasó (el del nomenclador de esa obra
-- social). La app busca ese código, lo vincula con la prestación equivalente de la clínica y se lo deja pre-cargado a Caja con el
-- copago y el valor de la obra social. Acá se guarda de qué fila del nomenclador salió cada prestación (y el código tal como se anotó).
--
-- Copiar y pegar en Supabase → SQL Editor → Run.

alter table prestaciones_realizadas_agenda
  add column if not exists nomenclador_id uuid references nomenclador(id) on delete set null,
  add column if not exists codigo_os text;
