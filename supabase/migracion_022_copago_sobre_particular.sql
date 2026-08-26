create table if not exists configuracion_copago_particular (
  id integer primary key default 1,
  porcentaje numeric not null,
  check (id = 1)
);
insert into configuracion_copago_particular (id, porcentaje) values (1, 80)
on conflict (id) do nothing;
alter table configuracion_copago_particular enable row level security;
create policy autenticados_leer on configuracion_copago_particular for select using (auth.uid() is not null);
create policy duena_escribe on configuracion_copago_particular for all using (es_duena()) with check (es_duena());
