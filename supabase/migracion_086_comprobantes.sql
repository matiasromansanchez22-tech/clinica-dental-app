-- Migración 086: subir el comprobante/factura de un gasto como archivo
-- (foto o PDF), guardado junto al gasto para poder volver a mirarlo
-- después. Base para la lectura automática con IA.
--
-- Copiar y pegar en Supabase → SQL Editor → Run.

insert into storage.buckets (id, name, public)
values ('comprobantes', 'comprobantes', false)
on conflict (id) do nothing;

drop policy if exists comprobantes_storage_leer on storage.objects;
create policy comprobantes_storage_leer on storage.objects for select
  using (bucket_id = 'comprobantes' and auth.uid() is not null);

drop policy if exists comprobantes_storage_subir on storage.objects;
create policy comprobantes_storage_subir on storage.objects for insert
  with check (bucket_id = 'comprobantes' and auth.uid() is not null);

drop policy if exists comprobantes_storage_borrar on storage.objects;
create policy comprobantes_storage_borrar on storage.objects for delete
  using (bucket_id = 'comprobantes' and auth.uid() is not null);

alter table gastos
  add column if not exists comprobante_path text;
