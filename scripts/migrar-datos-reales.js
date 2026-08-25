// Script de una sola vez: lee "Sistema Odontologia General.xlsx" (Descargas)
// y carga los datos reales en Supabase, reemplazando los de prueba.
// Ejecutar con: node scripts/migrar-datos-reales.js

const path = require("path");
const XLSX = require("xlsx");
require("dotenv").config({ path: path.join(__dirname, "..", ".env.local") });
const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const RUTA_EXCEL = "C:\\Users\\Usuario\\Downloads\\Sistema Odontologia General.xlsx";

const DIAS = {
  domingo: 0,
  lunes: 1,
  martes: 2,
  miercoles: 3,
  miércoles: 3,
  jueves: 4,
  viernes: 5,
  sabado: 6,
  sábado: 6,
};

function filasNoVacias(wb, nombreHoja) {
  const ws = wb.Sheets[nombreHoja];
  if (!ws) throw new Error(`No se encontró la hoja "${nombreHoja}" en el Excel.`);
  const filas = XLSX.utils.sheet_to_json(ws, { defval: "", raw: false });
  return filas.filter((f) => Object.values(f).some((v) => String(v).trim() !== ""));
}

function numeroDesde(texto) {
  const limpio = String(texto || "").replace(/[^\d,.-]/g, "").replace(",", ".");
  const n = Number(limpio);
  return Number.isFinite(n) ? n : 0;
}

function siNo(valor) {
  return String(valor || "").trim().toLowerCase() === "sí" || String(valor || "").trim().toLowerCase() === "si";
}

function numeroConsultorio(texto) {
  const match = String(texto || "").match(/\d+/);
  return match ? Number(match[0]) : null;
}

async function borrarDatosDePrueba() {
  console.log("Borrando datos de prueba anteriores...");
  await supabase.from("turnos_general").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  await supabase.from("pacientes").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  await supabase.from("disponibilidad_profesional").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  await supabase.from("profesionales").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  await supabase.from("nomenclador").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  await supabase.from("catalogo_prestaciones").delete().neq("id", "");
  await supabase.from("obras_sociales").delete().neq("id", "00000000-0000-0000-0000-000000000000");
}

async function migrarProfesionalesYDisponibilidad(wb) {
  const filas = filasNoVacias(wb, "Disponibilidad de Profesionales");

  const nombresUnicos = new Map(); // nombre -> especialidad (la primera que aparezca)
  filas.forEach((f) => {
    const nombre = String(f["Profesional"]).trim();
    if (nombre && !nombresUnicos.has(nombre)) {
      nombresUnicos.set(nombre, String(f["Especialidad"] || "").trim());
    }
  });

  const idPorNombre = new Map();
  for (const [nombre, especialidad] of nombresUnicos.entries()) {
    const { data, error } = await supabase
      .from("profesionales")
      .insert({ nombre, especialidad })
      .select()
      .single();
    if (error) throw error;
    idPorNombre.set(nombre, data.id);
  }
  console.log(`Profesionales creados: ${idPorNombre.size}`);

  const disponibilidad = filas.map((f) => {
    const dia = DIAS[String(f["Día"]).trim().toLowerCase()];
    return {
      profesional_id: idPorNombre.get(String(f["Profesional"]).trim()),
      dia_semana: dia,
      hora_inicio: String(f["Hora Desde"]).trim(),
      hora_fin: String(f["Hora Hasta"]).trim(),
      consultorio: numeroConsultorio(f["Consultorio"]),
      activo: String(f["Estado"]).trim().toLowerCase() === "activo",
    };
  });

  const { error } = await supabase.from("disponibilidad_profesional").insert(disponibilidad);
  if (error) throw error;
  console.log(`Bloques de disponibilidad creados: ${disponibilidad.length}`);
}

async function migrarObrasSociales(wb) {
  const ws = wb.Sheets["Configuracion"];
  const filas = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });
  const encabezados = filas[0];
  const idx = encabezados.indexOf("Obras Sociales");
  const nombres = filas
    .slice(1)
    .map((f) => String(f[idx] || "").trim())
    .filter(Boolean);

  const { error } = await supabase
    .from("obras_sociales")
    .insert(nombres.map((nombre) => ({ nombre })));
  if (error) throw error;
  console.log(`Obras sociales creadas: ${nombres.length}`);
}

async function migrarCatalogo(wb) {
  const filas = filasNoVacias(wb, "Catálogo de Prestaciones");

  const registros = filas.map((f) => ({
    id: String(f["ID"]).trim(),
    especialidad: String(f["Especialidad"] || "").trim() || null,
    categoria: String(f["Categoria"] || "").trim() || null,
    prestacion: String(f["Prestacion Interna"] || "").trim(),
    profesional_habilitado: String(f["Profesional Habilitado"] || "").trim() || null,
    profesional_sugerido: String(f["Profesional Sugerido"] || "").trim() || null,
    particular: siNo(f["Particular"]),
    nomenclada: siNo(f["Nomenclada"]),
    valor_lista: numeroDesde(f["Valor Lista"]),
    valor_efectivo: numeroDesde(f["Valor Efectivo"]),
    tiempo_estimado_min: numeroDesde(f["Tiempo Estimado"]) || null,
    estado: String(f["Estado"] || "Activo").trim(),
    protocolo: String(f["Protocolo del tratamiento"] || "").trim() || null,
    requiere_laboratorio: siNo(f["Requiere Laboratorio"]),
    observaciones: String(f["Observaciones"] || "").trim() || null,
    activa_obra_social: siNo(f["Activa en Obra Social"]),
  }));

  const { error } = await supabase.from("catalogo_prestaciones").insert(registros);
  if (error) throw error;
  console.log(`Prestaciones del catálogo creadas: ${registros.length}`);
}

async function migrarNomenclador(wb) {
  const filas = filasNoVacias(wb, "Nomenclador");

  const registros = filas.map((f) => ({
    obra_social: String(f["Obra Social"] || "").trim(),
    codigo: String(f["Código"] || "").trim() || null,
    prestacion_os: String(f["Prestación OS"] || "").trim(),
    valor_os: numeroDesde(f["Valor OS"]),
    id_catalogo: String(f["ID Catalogo"] || "").trim() || null,
    prestacion_interna: String(f["Prestación Interna"] || "").trim() || null,
    copago_oficial: numeroDesde(f["Copago Oficial"]),
    estado: String(f["Estado"] || "").trim() || null,
    observaciones: String(f["Observaciones"] || "").trim() || null,
  }));

  // Solo migramos las filas cuyo id_catalogo exista en el catálogo (o no tenga vínculo),
  // para no romper la referencia entre tablas.
  const { data: catalogoExistente } = await supabase.from("catalogo_prestaciones").select("id");
  const idsValidos = new Set((catalogoExistente || []).map((r) => r.id));
  const registrosLimpios = registros.map((r) => ({
    ...r,
    id_catalogo: r.id_catalogo && idsValidos.has(r.id_catalogo) ? r.id_catalogo : null,
  }));

  const TAMANO_LOTE = 500;
  let insertados = 0;
  for (let i = 0; i < registrosLimpios.length; i += TAMANO_LOTE) {
    const lote = registrosLimpios.slice(i, i + TAMANO_LOTE);
    const { error } = await supabase.from("nomenclador").insert(lote);
    if (error) throw error;
    insertados += lote.length;
    console.log(`  Nomenclador: ${insertados}/${registrosLimpios.length}`);
  }
}

async function main() {
  const wb = XLSX.readFile(RUTA_EXCEL);

  await borrarDatosDePrueba();
  await migrarProfesionalesYDisponibilidad(wb);
  await migrarObrasSociales(wb);
  await migrarCatalogo(wb);
  await migrarNomenclador(wb);

  console.log("\n✅ Migración completa.");
}

main().catch((err) => {
  console.error("❌ Error en la migración:", err);
  process.exit(1);
});
