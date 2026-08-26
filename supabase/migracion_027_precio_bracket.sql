-- Migración 027: precio por bracket despegado, para sumarlo al cobro del control.
--
-- Copiar y pegar en Supabase → SQL Editor → Run.

insert into configuracion_ortodoncia (clave, valor) values
  ('precio_bracket_metalico', 8000),
  ('precio_bracket_porcelana', 10000)
on conflict (clave) do nothing;
