-- Migración 176: Tarjeta de fidelidad de Ortodoncia.
--
-- Cómo funciona:
--  · Cada control de ortodoncia al que el paciente asiste suma una visita seguida.
--  · A las 5 visitas seguidas: 50% de descuento en el control siguiente.
--  · A las 10 visitas seguidas: el control siguiente es sin costo. Después la tarjeta vuelve a empezar.
--  · Faltar sin avisar vuelve la racha a cero. Cancelar o reprogramar avisando no la rompe ni suma.
--  · Es independiente del plan de referidos, pero en un mismo control se aplica un solo beneficio
--    (el que más descuenta); el otro queda para el control siguiente.
--  · Los premios se anotan acá apenas se alcanzan, para que una falta posterior no los borre.
--  · Los valores se pueden cambiar desde Ortodoncia → Catálogo de Precios.
--
-- Copiar y pegar en Supabase → SQL Editor → Run.

create table if not exists fidelidad_ortodoncia (
  id uuid primary key default gen_random_uuid(),
  paciente_id uuid not null references pacientes_ortodoncia(id) on delete cascade,
  -- 5 = descuento en un control, 10 = control sin costo (se guarda el N.º de visita que lo ganó).
  nivel integer not null check (nivel > 0),
  -- Fecha de la primera visita de esa racha (junto con paciente y nivel identifica el premio, así no se duplica).
  inicio_racha date not null,
  habilitado_en date not null,
  vence date,
  estado text not null default 'Habilitado' check (estado in ('Habilitado', 'Aplicado', 'Vencido')),
  tipo text not null check (tipo in ('Descuento en un control', 'Control sin costo')),
  monto numeric,
  aplicado_en date,
  cobro_id uuid,
  usuario_id uuid references perfiles(id) default auth.uid(),
  created_at timestamptz not null default now(),
  unique (paciente_id, nivel, inicio_racha)
);

create index if not exists fidelidad_ortodoncia_paciente_idx on fidelidad_ortodoncia (paciente_id);

alter table fidelidad_ortodoncia enable row level security;
drop policy if exists fidelidad_duenas_y_secretarias on fidelidad_ortodoncia;
create policy fidelidad_duenas_y_secretarias on fidelidad_ortodoncia for all
  using (es_caja()) with check (es_caja());
drop policy if exists fidelidad_contador_ver on fidelidad_ortodoncia;
create policy fidelidad_contador_ver on fidelidad_ortodoncia for select using (es_contador());

-- Cuánto se descontó en un cobro por la tarjeta de fidelidad (el importe es lo que realmente pagó el paciente).
alter table caja_ortodoncia add column if not exists descuento_fidelidad numeric not null default 0;
alter table caja_ortodoncia add column if not exists fidelidad_ref uuid references fidelidad_ortodoncia(id) on delete set null;

-- Valores de la tarjeta (se cambian desde Ortodoncia → Catálogo de Precios).
-- fidelidad_desde: las visitas se cuentan desde esa fecha (AAAAMMDD); lo anterior no cuenta.
insert into configuracion_ortodoncia (clave, valor) values
  ('fidelidad_visitas_descuento', 5),
  ('fidelidad_porcentaje_descuento', 50),
  ('fidelidad_visitas_control_gratis', 10),
  ('fidelidad_vigencia_dias', 90),
  ('fidelidad_desde', 20261027)
on conflict (clave) do nothing;

-- La página pública (la del QR) también muestra las condiciones de la tarjeta.
drop policy if exists referidos_config_publica on configuracion_ortodoncia;
drop policy if exists planes_config_publica on configuracion_ortodoncia;
create policy planes_config_publica on configuracion_ortodoncia
  for select to anon, authenticated
  using (clave like 'referidos\_%' or clave like 'fidelidad\_%');

-- El bloqueo del aumento (migraciones 155 y 174) tiene que aceptar el descuento por fidelidad, siempre que
-- haya un premio de fidelidad del paciente detrás.
create or replace function validar_aumento_ortodoncia()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_valor_control numeric;
  v_proximo_aumento date;
  v_porcentaje numeric;
  v_cuota_nueva numeric;
  v_saldo numeric;
  v_minimo numeric;
begin
  if auth.uid() is null or es_duena() then
    return new;
  end if;
  -- Un descuento por referido solo se acepta si hay un referido registrado de ese paciente.
  if coalesce(new.descuento_referido, 0) > 0 then
    if new.referido_ref is null or not exists (
      select 1 from referidos_ortodoncia r
       where r.id = new.referido_ref
         and (r.referido_id = new.paciente_id or r.referidor_id = new.paciente_id)
    ) then
      raise exception 'El descuento por referido no corresponde: ese paciente no tiene un referido registrado.'
        using errcode = 'check_violation';
    end if;
  end if;
  -- Un descuento por fidelidad solo se acepta si ese paciente tiene un premio de la tarjeta.
  if coalesce(new.descuento_fidelidad, 0) > 0 then
    if new.fidelidad_ref is null or not exists (
      select 1 from fidelidad_ortodoncia f
       where f.id = new.fidelidad_ref
         and f.paciente_id = new.paciente_id
    ) then
      raise exception 'El descuento por la tarjeta de fidelidad no corresponde: ese paciente no tiene un premio habilitado.'
        using errcode = 'check_violation';
    end if;
  end if;
  if new.concepto <> 'Control' or new.paciente_id is null then
    return new;
  end if;

  select valor_control, proximo_aumento
    into v_valor_control, v_proximo_aumento
    from pacientes_ortodoncia
   where id = new.paciente_id;

  if v_valor_control is null or v_valor_control <= 0
     or v_proximo_aumento is null or v_proximo_aumento >= new.fecha then
    return new;
  end if;

  select coalesce((select valor from configuracion_ortodoncia where clave = 'aumento_porcentaje'), 25)
    into v_porcentaje;

  v_cuota_nueva := round(v_valor_control * (1 + v_porcentaje / 100) / 100) * 100;

  select coalesce(sum(monto), 0)
    into v_saldo
    from saldos_a_favor
   where paciente_ortodoncia_id = new.paciente_id;

  v_minimo := v_cuota_nueva * coalesce(new.cantidad_controles_abonados, 1) - greatest(v_saldo, 0)
              - coalesce(new.descuento_referido, 0) - coalesce(new.descuento_fidelidad, 0);

  if new.importe < v_minimo - 1 then
    raise exception 'Este paciente tiene aumento: el Control no puede cobrarse por menos de $% (cuota con aumento $%). Si hay un descuento autorizado, lo carga una dueña.',
      to_char(round(v_minimo), 'FM999G999G999'), to_char(v_cuota_nueva, 'FM999G999G999')
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

drop trigger if exists bloqueo_aumento_ortodoncia on caja_ortodoncia;
create trigger bloqueo_aumento_ortodoncia
  before insert or update of importe, concepto, cantidad_controles_abonados, paciente_id, fecha, descuento_referido, descuento_fidelidad
  on caja_ortodoncia
  for each row execute function validar_aumento_ortodoncia();
