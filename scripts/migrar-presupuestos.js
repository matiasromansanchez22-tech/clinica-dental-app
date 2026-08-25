// Script de una sola vez: migra los presupuestos y planes de financiación
// reales de "Sistema Odontologia General.xlsx" a Supabase.
// Ejecutar con: node scripts/migrar-presupuestos.js

const path = require("path");
const XLSX = require("xlsx");
require("dotenv").config({ path: path.join(__dirname, "..", ".env.local") });
const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const RUTA_EXCEL = "C:\\Users\\Usuario\\Downloads\\Sistema Odontologia General.xlsx";

function numeroDesde(texto) {
  const limpio = String(texto || "").replace(/[^\d.-]/g, "");
  const n = Number(limpio);
  return Number.isFinite(n) ? n : 0;
}

function fechaISO(valor) {
  const match = String(valor || "").match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) return null;
  const [, d, m, a] = match;
  return `${a}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
}

function normalizar(texto) {
  return String(texto || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
}

async function main() {
  const wb = XLSX.readFile(RUTA_EXCEL);

  const { data: pacientes } = await supabase.from("pacientes").select("id, apellido_y_nombre");
  const { data: profesionales } = await supabase.from("profesionales").select("id, nombre");

  const idPaciente = (nombre) => pacientes.find((p) => normalizar(p.apellido_y_nombre) === normalizar(nombre))?.id;
  const idProfesional = (nombre) => {
    const n = normalizar(nombre);
    return profesionales.find((p) => normalizar(p.nombre).includes(n) || n.includes(normalizar(p.nombre)))?.id;
  };

  // --- Presupuestos ---
  const wsPresupuestos = wb.Sheets["Presupuestos"];
  const filasPresupuestos = XLSX.utils.sheet_to_json(wsPresupuestos, { defval: "", raw: false }).filter(
    (f) => String(f["Paciente"] || "").trim() !== ""
  );

  const mapaPresupuestoIdPorNumero = {};

  for (const f of filasPresupuestos) {
    const prestaciones = [];
    const sufijos = ["", "_1", "_2", "_3", "_4", "_5"];
    for (const sufijo of sufijos) {
      const prestacion = String(f[`Prestacion${sufijo}`] || "").trim();
      if (!prestacion) continue;
      prestaciones.push({
        catalogoId: String(f[`ID${sufijo}`] || "").trim() || null,
        prestacion,
        cantidad: numeroDesde(f[`Cantidad${sufijo}`]) || 1,
        tipoPrecio: String(f[`Precio${sufijo}`] || "Lista").trim(),
        importe: numeroDesde(f[`Importe${sufijo}`]),
      });
    }

    const pacienteId = idPaciente(f["Paciente"]);
    if (!pacienteId) {
      console.log(`⚠ Paciente no encontrado, se omite presupuesto ${f["N° Presupuesto"]}: "${f["Paciente"]}"`);
      continue;
    }

    const registro = {
      numero: String(f["N° Presupuesto"]).trim(),
      fecha: fechaISO(f["Fecha"]) || new Date().toISOString().slice(0, 10),
      paciente_id: pacienteId,
      profesional_id: idProfesional(f["Profesional"]) || null,
      estado: String(f["Estado"] || "Pendiente").trim(),
      prestaciones,
      total: numeroDesde(f["Total Presupuesto"]),
      modalidad_pago: String(f["Modalidad de Pago"] || "").trim() || null,
      cantidad_cuotas: numeroDesde(f["Cantidad de Cuotas"]) || null,
      anticipo: numeroDesde(f["Anticipo"]),
      saldo: numeroDesde(f["Saldo"]),
      fecha_aceptacion: fechaISO(f["Fecha Aceptacion"]),
      observaciones: String(f["Observaciones"] || "").trim() || null,
    };

    const { data, error } = await supabase.from("presupuestos").insert(registro).select().single();
    if (error) throw error;
    mapaPresupuestoIdPorNumero[registro.numero] = data.id;
    console.log(`Presupuesto migrado: ${registro.numero}`);
  }

  // --- Planes de Financiación ---
  const wsPlanes = wb.Sheets["Plan de Financiación"];
  const filasPlanes = XLSX.utils.sheet_to_json(wsPlanes, { defval: "", raw: false }).filter(
    (f) => String(f["Paciente"] || "").trim() !== ""
  );

  for (const f of filasPlanes) {
    const numeroPresupuesto = String(f["N° Presupuesto"]).trim();
    const presupuestoId = mapaPresupuestoIdPorNumero[numeroPresupuesto];
    if (!presupuestoId) {
      console.log(`⚠ Presupuesto ${numeroPresupuesto} no migrado, se omite plan ${f["N° Plan"]}`);
      continue;
    }

    const pacienteId = idPaciente(f["Paciente"]);
    const registro = {
      numero_plan: String(f["N° Plan"]).trim(),
      presupuesto_id: presupuestoId,
      numero_presupuesto: numeroPresupuesto,
      fecha: fechaISO(f["Fecha"]) || new Date().toISOString().slice(0, 10),
      paciente_id: pacienteId,
      profesional_id: idProfesional(f["Profesional"]) || null,
      estado_plan: String(f["Estado del Plan"] || "Activo").trim(),
      total_tratamiento: numeroDesde(f["Total Tratamiento"]),
      anticipo_acordado: numeroDesde(f["Anticipo Acordado"]),
      anticipo_cobrado: numeroDesde(f["Anticipo Cobrado"]),
      saldo_financiado: numeroDesde(f["Saldo Financiado"]),
      cantidad_cuotas: numeroDesde(f["Cantidad de Cuotas"]),
      valor_cuota: numeroDesde(f["Valor de Cuota"]),
      total_pagado: numeroDesde(f["Total Pagado"]),
      saldo_pendiente: numeroDesde(f["Saldo Pendiente"]),
      cuotas_pagadas: numeroDesde(f["Cuotas Pagadas"]),
      proxima_cuota: numeroDesde(f["N° Proxima Cuota"]) || null,
      proximo_vencimiento: fechaISO(f["Proximo Vencimiento"]),
      fecha_ultimo_pago: fechaISO(f["Fecha Ultimo Pago"]),
      medio_pago_ultimo_pago: String(f["Medio de Pago"] || "").trim() || null,
      estado_financiero: String(f["Estado Financiero"] || "").trim() || null,
      frecuencia: String(f["Frecuencia"] || "Mensual").trim(),
      dias_atraso: numeroDesde(f["Dias de Atraso"]),
      estado_cobranza: String(f["Estado de Cobranza"] || "").trim() || null,
      observaciones: String(f["Observaciones"] || "").trim() || null,
    };

    const { error } = await supabase.from("planes_financiacion").insert(registro);
    if (error) throw error;
    console.log(`Plan migrado: ${registro.numero_plan}`);
  }

  console.log("\n✅ Migración de presupuestos y planes completa.");
}

main().catch((err) => {
  console.error("❌ Error en la migración:", err);
  process.exit(1);
});
