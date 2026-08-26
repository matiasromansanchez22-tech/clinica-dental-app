// Script de una sola vez: migra la hoja "Controles 2026" de la planilla real.
// Ejecutar con: node scripts/migrar-controles-ortodoncia.js

const path = require("path");
const XLSX = require("xlsx");
require("dotenv").config({ path: path.join(__dirname, "..", ".env.local") });
const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const RUTA_EXCEL = "C:\\Users\\Usuario\\Downloads\\Sistema Gestion Ortodoncia  (2).xlsx";
const ANIO = 2026;
const COLUMNAS_MES = {
  Ene: "ene", Feb: "feb", Mar: "mar", Abr: "abr", May: "may", Jun: "jun",
  Jul: "jul", Ago: "ago", Sep: "sep", Oct: "oct", Nov: "nov", Dic: "dic",
};
const VALORES_VALIDOS = ["Pago", "Pagado Anticipado"];

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
  const { data: pacientes } = await supabase.from("pacientes_ortodoncia").select("id, nombre");
  const idPaciente = (nombre) => pacientes.find((p) => normalizar(p.nombre) === normalizar(nombre))?.id || null;

  const filas = XLSX.utils
    .sheet_to_json(wb.Sheets["Controles 2026"], { defval: "", raw: false })
    .filter((f) => String(f["Paciente"] || "").trim() && String(f["Paciente"]).trim() !== "#VALUE!");

  let migrados = 0;
  let omitidos = 0;

  for (const f of filas) {
    const pacienteId = idPaciente(f["Paciente"]);
    if (!pacienteId) {
      omitidos++;
      continue;
    }

    const registro = { paciente_id: pacienteId, anio: ANIO };
    let tieneAlgo = false;
    for (const [col, clave] of Object.entries(COLUMNAS_MES)) {
      const valor = String(f[col] || "").trim();
      if (VALORES_VALIDOS.includes(valor)) {
        registro[clave] = valor;
        tieneAlgo = true;
      }
    }
    const observaciones = String(f["Observaciones del Control"] || "").trim();
    if (observaciones) {
      registro.observaciones = observaciones;
      tieneAlgo = true;
    }

    if (!tieneAlgo) {
      omitidos++;
      continue;
    }

    const { error } = await supabase.from("controles_ortodoncia").upsert(registro, { onConflict: "paciente_id,anio" });
    if (error) {
      console.log(`⚠ Error migrando control de ${f["Paciente"]}: ${error.message}`);
      omitidos++;
      continue;
    }
    migrados++;
  }

  console.log(`\n✅ Controles migrados: ${migrados}. Omitidos (sin paciente o sin datos): ${omitidos}`);
}

main().catch((err) => {
  console.error("❌ Error:", err);
  process.exit(1);
});
