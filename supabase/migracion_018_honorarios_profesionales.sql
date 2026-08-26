alter table profesionales
  add column if not exists porcentaje_honorarios numeric not null default 30;
