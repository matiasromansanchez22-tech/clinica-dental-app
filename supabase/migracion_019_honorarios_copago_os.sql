alter table profesionales
  rename column porcentaje_honorarios to porcentaje_honorarios_copago;
alter table profesionales
  add column if not exists porcentaje_honorarios_os numeric not null default 20;
