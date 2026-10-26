-- Migración 174: Plan de referidos de Ortodoncia.
--
-- Cómo funciona el plan:
--  · El paciente nuevo ("referido") llega recomendado por un paciente nuestro ("referidor").
--  · Cuando el referido comienza la instalación (se registra el primer cobro de instalación):
--      - el referido tiene un descuento en la instalación: $30.000 si paga todo de contado, o
--        $20.000 menos en la primera cuota si paga en 2 veces;
--      - el referidor queda con un descuento en un control: la mitad de un control. Cada 3.er
--        referido que empieza el tratamiento, el control es sin costo. Tope de 3 premios por año
--        y vigencia de 90 días desde que se habilita.
--  · Los descuentos se aplican desde la pantalla de cobro, quedan anotados en el cobro
--    (descuento_referido) y no se pueden usar dos veces.
--  · Los valores se pueden cambiar desde Ortodoncia → Catálogo de Precios.
--
-- Copiar y pegar en Supabase → SQL Editor → Run.

create table if not exists referidos_ortodoncia (
  id uuid primary key default gen_random_uuid(),
  referidor_id uuid not null references pacientes_ortodoncia(id) on delete cascade,
  referido_id uuid not null unique references pacientes_ortodoncia(id) on delete cascade,
  fecha_registro date not null default current_date,
  -- Cuando el referido empieza la instalación (primer cobro de instalación).
  fecha_instalacion date,
  -- Premio del referido: descuento en su instalación.
  premio_referido_estado text not null default 'Pendiente' check (premio_referido_estado in ('Pendiente', 'Aplicado', 'Vencido')),
  premio_referido_monto numeric,
  premio_referido_aplicado_en date,
  premio_referido_cobro_id uuid,
  -- Premio del referidor: descuento en un control.
  premio_referidor_estado text not null default 'En espera' check (premio_referidor_estado in ('En espera', 'Habilitado', 'Aplicado', 'Vencido', 'Sin premio')),
  premio_referidor_tipo text check (premio_referidor_tipo in ('Mitad de un control', 'Control sin costo')),
  premio_referidor_habilitado_en date,
  premio_referidor_vence date,
  premio_referidor_monto numeric,
  premio_referidor_aplicado_en date,
  premio_referidor_cobro_id uuid,
  observaciones text,
  usuario_id uuid references perfiles(id) default auth.uid(),
  created_at timestamptz not null default now(),
  constraint referidos_no_a_si_mismo check (referidor_id <> referido_id)
);

create index if not exists referidos_ortodoncia_referidor_idx on referidos_ortodoncia (referidor_id);

alter table referidos_ortodoncia enable row level security;
drop policy if exists referidos_duenas_y_secretarias on referidos_ortodoncia;
create policy referidos_duenas_y_secretarias on referidos_ortodoncia for all
  using (es_caja()) with check (es_caja());
drop policy if exists referidos_contador_ver on referidos_ortodoncia;
create policy referidos_contador_ver on referidos_ortodoncia for select using (es_contador());

-- Cuánto se descontó en un cobro por el plan de referidos (el importe es lo que realmente pagó el paciente).
alter table caja_ortodoncia add column if not exists descuento_referido numeric not null default 0;
alter table caja_ortodoncia add column if not exists referido_ref uuid references referidos_ortodoncia(id) on delete set null;

-- Valores del plan (se cambian desde Ortodoncia → Catálogo de Precios).
insert into configuracion_ortodoncia (clave, valor) values
  ('referidos_descuento_instalacion_contado', 30000),
  ('referidos_descuento_instalacion_2_cuotas', 20000),
  ('referidos_porcentaje_descuento_control', 50),
  ('referidos_cada_cuantos_control_sin_costo', 3),
  ('referidos_tope_premios_por_anio', 3),
  ('referidos_vigencia_dias', 90)
on conflict (clave) do nothing;

-- El bloqueo del aumento (migración 155) tiene que tener en cuenta el descuento por referido: una
-- secretaria puede cobrar un Control con el descuento autorizado por el plan.
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

  v_minimo := v_cuota_nueva * coalesce(new.cantidad_controles_abonados, 1) - greatest(v_saldo, 0) - coalesce(new.descuento_referido, 0);

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
  before insert or update of importe, concepto, cantidad_controles_abonados, paciente_id, fecha, descuento_referido
  on caja_ortodoncia
  for each row execute function validar_aumento_ortodoncia();
