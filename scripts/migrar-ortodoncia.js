// Script de una sola vez: migra profesionales, disponibilidad y pacientes
// reales de "Sistema Gestion Ortodoncia  (2).xlsx" a Supabase.
// Ejecutar con: node scripts/migrar-ortodoncia.js

const path = require("path");
const XLSX = require("xlsx");
require("dotenv").config({ path: path.join(__dirname, "..", ".env.local") });
const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const RUTA_EXCEL = "C:\\Users\\Usuario\\Downloads\\Sistema Gestion Ortodoncia  (2).xlsx";

const DIAS = {
  domingo: 0, lunes: 1, martes: 2, miercoles: 3, miércoles: 3,
  jueves: 4, viernes: 5, sabado: 6, sábado: 6,
};

function numeroDesde(texto) {
  const limpio = String(texto || "").replace(/[^\d.-]/g, "");
  const n = Number(limpio);
  return Number.isFinite(n) ? n : null;
}

function fechaISO(valor) {
  const texto = String(valor || "").trim();
  if (!texto) return null;
  // Formatos vistos: "1/7/2025", "20/6/13", "16/07/26"
  const match = texto.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (!match) return null;
  let [, d, m, a] = match;
  if (a.length === 2) a = (Number(a) > 50 ? "19" : "20") + a;
  const fecha = new Date(Number(a), Number(m) - 1, Number(d));
  if (isNaN(fecha.getTime())) return null;
  return `${a}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
}

function normalizar(texto) {
  return String(texto || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
}

async function main() {
  const { error: errorLogin } = await supabase.auth.signInWithPassword({
    email: "matias@clinica.local",
    password: "Clinica2026!",
  });
  if (errorLogin) throw errorLogin;

  const wb = XLSX.readFile(RUTA_EXCEL);

  // --- Profesionales + disponibilidad ---
  const disponibilidad = XLSX.utils.sheet_to_json(wb.Sheets["Disponibilidad de Profesionales"], { defval: "", raw: false });
  const nombresUnicos = [...new Set(disponibilidad.map((d) => String(d["Ortodoncista"]).trim()))];

  const idProfesionalPorNombre = {};
  for (const nombre of nombresUnicos) {
    // Si ya existe un profesional con ese nombre (ej. Marianela ya cargada en General), lo reutilizamos.
    const { data: existente } = await supabase
      .from("profesionales")
      .select("id, nombre")
      .ilike("nombre", `%${nombre}%`)
      .limit(1)
      .maybeSingle();

    if (existente) {
      idProfesionalPorNombre[nombre] = existente.id;
      console.log(`Profesional reutilizado: ${existente.nombre} (para "${nombre}")`);
      continue;
    }

    const { data, error } = await supabase
      .from("profesionales")
      .insert({ nombre, especialidad: "Ortodoncia" })
      .select()
      .single();
    if (error) throw error;
    idProfesionalPorNombre[nombre] = data.id;
    console.log(`Profesional creado: ${nombre}`);
  }

  const filasDisponibilidad = disponibilidad
    .filter((d) => String(d["Ortodoncista"]).trim())
    .map((d) => ({
      profesional_id: idProfesionalPorNombre[String(d["Ortodoncista"]).trim()],
      dia_semana: DIAS[normalizar(d["Día"])],
      hora_inicio: d["Desde"],
      hora_fin: d["Hasta"],
      activo: normalizar(d["Estado"]) === "activo",
    }));

  const { error: errorDisp } = await supabase.from("disponibilidad_profesional").insert(filasDisponibilidad);
  if (errorDisp) throw errorDisp;
  console.log(`Bloques de disponibilidad creados: ${filasDisponibilidad.length}`);

  // --- Pacientes de Ortodoncia ---
  const filasPacientes = XLSX.utils
    .sheet_to_json(wb.Sheets["Pacientes Ortodoncia 2026"], { defval: "", raw: false })
    .filter((f) => String(f["Paciente"]).trim() && String(f["Paciente"]).trim() !== "#VALUE!");

  const registros = filasPacientes.map((f) => {
    const ortodoncista = String(f["Ortodoncista"]).trim();
    const estado = String(f["Estado Paciente"] || "Activo").trim();
    return {
      codigo_legado: String(f["ID"] || "").trim() || null,
      nombre: String(f["Paciente"]).trim(),
      whatsapp: String(f["WhatsApp"] || "").trim() || null,
      fecha_nacimiento: fechaISO(f["Fecha Nacimiento"]),
      fecha_instalacion: fechaISO(f["Fecha Instalacion"]),
      historial_clinico: String(f["Historial Clinico"] || "").trim() || null,
      fotografias: String(f["Fotografias"] || "").trim() || null,
      rx_inicial: String(f["RX Inicial"] || "").trim() || null,
      rx_6_meses: String(f["RX 6 Meses"] || "").trim() || null,
      rx_12_meses: String(f["RX 12 Meses"] || "").trim() || null,
      consentimiento: String(f["Consentimiento"] || "").trim() || null,
      tipo_brackets: String(f["Tipo de Brackets"] || "").trim() || null,
      cuota_inicial: numeroDesde(f["Cuota Inicial"]),
      forma_pago_instalacion: String(f["Forma Pago Instalacion"] || "").trim() || null,
      instalacion_cuota_1: String(f["Instalacion Cuota 1"] || "").trim() || null,
      instalacion_cuota_2: String(f["Instalacion Cuota 2"] || "").trim() || null,
      estado_instalacion: String(f["Estado Instalacion"] || "").trim() || null,
      valor_control: numeroDesde(f["Valor Control"]),
      ortodoncista_id: idProfesionalPorNombre[ortodoncista] || null,
      estado_paciente: ["Activo", "Inactivo", "Finalizado", "Abandonó"].includes(estado) ? estado : "Activo",
      ultimo_control: fechaISO(f["Ultimo Control"]),
      proximo_turno: fechaISO(f["Proximo Turno"]),
      observaciones_clinicas: String(f["Observaciones Clinicas"] || "").trim() || null,
      ultimo_aumento: fechaISO(f["Ultimo Aumento "]),
      proximo_aumento: fechaISO(f["Proximo Aumento"]),
      referido_por: String(f["Referido por"] || "").trim() || null,
      email: String(f["Email"] || "").trim() || null,
      fecha_baja: fechaISO(f["Fecha de Baja"]),
    };
  });

  const TAMANO_LOTE = 100;
  let insertados = 0;
  for (let i = 0; i < registros.length; i += TAMANO_LOTE) {
    const lote = registros.slice(i, i + TAMANO_LOTE);
    const { error } = await supabase.from("pacientes_ortodoncia").insert(lote);
    if (error) throw error;
    insertados += lote.length;
    console.log(`  Pacientes Ortodoncia: ${insertados}/${registros.length}`);
  }

  console.log("\n✅ Migración de Ortodoncia (profesionales + pacientes) completa.");
}

main().catch((err) => {
  console.error("❌ Error en la migración:", err);
  process.exit(1);
});
