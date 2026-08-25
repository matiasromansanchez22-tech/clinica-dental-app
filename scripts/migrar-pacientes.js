// Script de una sola vez: migra los pacientes reales de
// "Sistema Odontologia General.xlsx" (hoja "Alta de Pacientes") a Supabase.
// Ejecutar con: node scripts/migrar-pacientes.js

const path = require("path");
const XLSX = require("xlsx");
require("dotenv").config({ path: path.join(__dirname, "..", ".env.local") });
const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const RUTA_EXCEL = "C:\\Users\\Usuario\\Downloads\\Sistema Odontologia General.xlsx";

function soloDigitos(valor) {
  return String(valor || "").replace(/\D/g, "");
}

function formatearDni(valor) {
  const digitos = soloDigitos(valor);
  return digitos ? digitos.replace(/\B(?=(\d{3})+(?!\d))/g, ".") : null;
}

function siEs(valor, textoEsperado) {
  return String(valor || "").trim().toLowerCase() === textoEsperado.toLowerCase();
}

function normalizar(texto) {
  return String(texto || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function fechaISO(valor) {
  if (!valor) return null;
  // La librería puede devolver "DD/MM/AAAA" como texto formateado.
  const match = String(valor).match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) return null;
  const [, d, m, a] = match;
  return `${a}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
}

async function main() {
  const wb = XLSX.readFile(RUTA_EXCEL);
  const ws = wb.Sheets["Alta de Pacientes"];
  const filas = XLSX.utils.sheet_to_json(ws, { defval: "", raw: false });
  const pacientesExcel = filas.filter((f) => String(f["Apellido/Nombre"] || "").trim() !== "");

  const { data: profesionales } = await supabase.from("profesionales").select("id, nombre");
  const idProfesionalPorNombre = (nombreBuscado) => {
    const buscado = normalizar(nombreBuscado);
    if (!buscado) return null;
    const encontrado = profesionales.find(
      (p) => normalizar(p.nombre).includes(buscado) || buscado.includes(normalizar(p.nombre))
    );
    return encontrado ? encontrado.id : null;
  };

  let sinProfesionalAsignado = 0;

  const registros = pacientesExcel.map((f) => {
    const profesionalId = idProfesionalPorNombre(f["Profesional Habitual"]);
    if (!profesionalId && f["Profesional Habitual"]) sinProfesionalAsignado++;

    let tipoPaciente = String(f["Tipo de Paciente"] || "Particular").trim();
    if (!["Particular", "Obra Social", "Mixto"].includes(tipoPaciente)) tipoPaciente = "Particular";

    return {
      apellido_y_nombre: String(f["Apellido/Nombre"]).trim(),
      dni: formatearDni(f["DNI"]),
      celular: soloDigitos(f["Celular"]) || null,
      fecha_nacimiento: fechaISO(f["Fecha de Nacimiento"]),
      profesional_responsable_id: profesionalId,
      tipo_paciente: tipoPaciente,
      obra_social: String(f["Obra Social"] || "").trim() || null,
      numero_afiliado: String(f["N° Afiliado"] || "").trim() || null,
      estado: siEs(f["Estado"], "Inactivo") ? "Inactivo" : "Activo",
      email: String(f["Email"] || "").trim() || null,
      direccion: String(f["Direccion"] || "").trim() || null,
      localidad: String(f["Localidad"] || "").trim() || null,
      como_nos_conocio: String(f["Como Nos Conocio?"] || "").trim() || null,
      paciente_referido_por: String(f["Paciente Referido Por"] || "").trim() || null,
      estado_administrativo: String(f["Estado Administrativo"] || "").trim() || null,
      estado_clinico: String(f["Estado Clinico"] || "").trim() || null,
      historia_clinica_completa: siEs(f["Historia Clinica Completa"], "Completa"),
      consentimientos_firmados: siEs(f["Consentimientos"], "Firmado"),
    };
  });

  console.log(`Pacientes a migrar: ${registros.length}`);
  console.log(`Sin profesional habitual reconocido: ${sinProfesionalAsignado}`);

  const TAMANO_LOTE = 200;
  let insertados = 0;
  for (let i = 0; i < registros.length; i += TAMANO_LOTE) {
    const lote = registros.slice(i, i + TAMANO_LOTE);
    const { error } = await supabase.from("pacientes").insert(lote);
    if (error) throw error;
    insertados += lote.length;
    console.log(`  Pacientes: ${insertados}/${registros.length}`);
  }

  console.log("\n✅ Migración de pacientes completa.");
}

main().catch((err) => {
  console.error("❌ Error en la migración:", err);
  process.exit(1);
});
