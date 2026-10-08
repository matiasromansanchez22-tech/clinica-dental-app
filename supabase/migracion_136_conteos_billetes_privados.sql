-- Migración 136: los conteos de billetes guardados pasan a ser privados.
-- Cada persona ve solo los que hizo ella; las Dueñas ven todos.
--
-- Copiar y pegar en Supabase → SQL Editor → Run.

drop policy if exists ver_conteos on conteos_billetes;
create policy ver_conteos on conteos_billetes for select
  using (usuario_id = auth.uid() or es_duena());
