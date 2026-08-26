// Script de una sola vez: migra los turnos reales de Ortodoncia.
// Ejecutar con: node scripts/migrar-ortodoncia-turnos.js

const path = require("path");
const XLSX = require("xlsx");
require("dotenv").config({ path: path.join(__dirname, "..", ".env.local") });
const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const RUTA_EXCEL = "C:\\Users\\Usuario\\Downloads\\Sistema Gestion Ortodoncia  (2).xlsx";

const MAPA_CONCEPTO = {
  "Control (instalacion)": "Control",
};
const CONCEPTOS_VALIDOS = [
  "Consulta de ortodoncia", "Control", "Instalación superior", "Instalación inferior",
  "Reposición", "Retiro", "Urgencia",
];

function numeroDesde(texto) {
  const limpio = String(texto || "").replace(/[^\d.-]/g, "");
  const n = Number(limpio);
  return Number.isFinite(n) ? n : null;
}

function fechaISO(valor) {
  const texto = String(valor || "").trim();
  const match = texto.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (!match) return null;
  let [, p1, p2, a] = match;
  if (a.length === 2) a = "20" + a;
  const n1 = Number(p1);
  const n2 = Number(p2);
  // Esta hoja mezcla formatos: si el primer número no puede ser día (>12), es Mes/Día.
  let dia, mes;
  if (n1 > 12) {
    mes = n2;
    dia = n1;
  } else if (n2 > 12) {
    mes = n1;
    dia = n2;
  } else {
    dia = n1;
    mes = n2;
  }
  return `${a}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
}

function horaDesde(valor) {
  // Formato real: "1/1/2000 8:15:00"
  const texto = String(valor || "").trim();
  const match = texto.match(/(\d{1,2}):(\d{2}):\d{2}$/);
  if (!match) return null;
  const [, h, m] = match;
  return `${h.padStart(2, "0")}:${m}`;
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

  const { data: pacientes } = await supabase.from("pacientes_ortodoncia").select("id, nombre");
  const { data: profesionales } = await supabase.from("profesionales").select("id, nombre");

  const idPaciente = (nombre) => pacientes.find((p) => normalizar(p.nombre) === normalizar(nombre))?.id || null;
  const idProfesional = (nombre) => {
    const n = normalizar(nombre);
    return profesionales.find((p) => normalizar(p.nombre).includes(n) || n.includes(normalizar(p.nombre)))?.id || null;
  };

  const filas = XLSX.utils
    .sheet_to_json(wb.Sheets["Base Agenda Ortodoncia"], { defval: "", raw: false })
    .filter((f) => String(f["Paciente"] || "").trim());

  let migrados = 0;
  let omitidos = 0;

  for (const f of filas) {
    const fecha = fechaISO(f["Fecha"]);
    const horaInicio = horaDesde(f["Hora Inicio"]);
    const pacienteId = idPaciente(f["Paciente"]);
    const consultorioMatch = String(f["Consultorio"] || "").match(/\d+/);
    const conceptoOriginal = String(f["Concepto"] || "Control").trim();
    const concepto = CONCEPTOS_VALIDOS.includes(conceptoOriginal)
      ? conceptoOriginal
      : MAPA_CONCEPTO[conceptoOriginal] || "Control";

    if (!fecha || !horaInicio || !pacienteId || !consultorioMatch) {
      omitidos++;
      continue;
    }

    const registro = {
      codigo_legado: String(f["ID Turno"] || "").trim() || null,
      fecha,
      hora_inicio: horaInicio,
      duracion_min: numeroDesde(f["Duración"]) || 15,
      consultorio: Number(consultorioMatch[0]),
      paciente_id: pacienteId,
      whatsapp: String(f["WhatsApp"] || "").trim() || null,
      ortodoncista_id: idProfesional(f["Ortodoncista"]),
      concepto,
      valor: numeroDesde(f["Valor"]),
      estado: ["Pendiente", "Agendado", "Reprogramado", "Cancelado"].includes(f["Estado"]) ? f["Estado"] : "Agendado",
      confirmacion: ["Sin confirmar", "Confirmado", "No responde", "Reprogramar"].includes(f["Confirmación"])
        ? f["Confirmación"]
        : "Sin confirmar",
      presencia: ["En espera", "En consultorio", "Finalizado"].includes(f["Presencia"]) ? f["Presencia"] : "Pendiente",
      observaciones: String(f["Observaciones"] || "").trim() || null,
    };

    const { error } = await supabase.from("turnos_ortodoncia").insert(registro);
    if (error) {
      console.log(`⚠ Error migrando turno de ${f["Paciente"]}: ${error.message}`);
      omitidos++;
      continue;
    }
    migrados++;
  }

  console.log(`\n✅ Turnos migrados: ${migrados}. Omitidos (sin paciente/fecha/hora válida): ${omitidos}`);
}

main().catch((err) => {
  console.error("❌ Error:", err);
  process.exit(1);
});
