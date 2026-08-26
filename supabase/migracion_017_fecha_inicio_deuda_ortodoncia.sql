create table if not exists configuracion_deuda_ortodoncia (
  id integer primary key default 1,
  fecha_inicio date not null,
  check (id = 1)
);
insert into configuracion_deuda_ortodoncia (id, fecha_inicio)
values (1, date_trunc('month', current_date))
on conflict (id) do nothing;
alter table configuracion_deuda_ortodoncia enable row level security;
create policy config_leer on configuracion_deuda_ortodoncia for select using (auth.uid() is not null);
create policy config_escribir on configuracion_deuda_ortodoncia for all using (es_duena()) with check (es_duena());
