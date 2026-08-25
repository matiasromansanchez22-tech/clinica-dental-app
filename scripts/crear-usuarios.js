// Script de una sola vez: crea los usuarios reales de la clínica con login y rol.
// Ejecutar con: node scripts/crear-usuarios.js

const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env.local") });
const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const CONTRASENA_INICIAL = "Clinica2026!";

// profesionalNombre debe coincidir textualmente con la tabla "profesionales".
const USUARIOS = [
  { email: "matias@clinica.local", nombre: "Matías", rol: "Duena" },
  { email: "marian@clinica.local", nombre: "Marianela", rol: "Duena" },
  { email: "lola@clinica.local", nombre: "Lola", rol: "Secretaria" },
  { email: "simon@clinica.local", nombre: "Simón", rol: "Secretaria" },
  { email: "catalina@clinica.local", nombre: "Catalina Irigoiti", rol: "Odontologo", profesionalNombre: "Catalina Irigoiti" },
  { email: "santiago@clinica.local", nombre: "Santiago Abud", rol: "Odontologo", profesionalNombre: "Santiago Abud" },
  { email: "luisina@clinica.local", nombre: "Luisina Pellegrini", rol: "Odontologo", profesionalNombre: "Luisina Pellegrini" },
  { email: "martin@clinica.local", nombre: "Martín Borga", rol: "Odontologo", profesionalNombre: "Martín Borga" },
];

async function main() {
  const { data: profesionales } = await supabase.from("profesionales").select("id, nombre");

  for (const u of USUARIOS) {
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email: u.email,
      password: CONTRASENA_INICIAL,
    });

    if (signUpError) {
      console.log(`⚠ ${u.email}: ${signUpError.message}`);
      continue;
    }

    const userId = signUpData.user?.id;
    if (!userId) {
      console.log(`⚠ ${u.email}: no se recibió ID de usuario (¿ya existía?).`);
      continue;
    }

    const profesionalId = u.profesionalNombre
      ? profesionales.find((p) => p.nombre === u.profesionalNombre)?.id ?? null
      : null;

    const { error: perfilError } = await supabase.from("perfiles").insert({
      id: userId,
      nombre: u.nombre,
      rol: u.rol,
      profesional_id: profesionalId,
    });

    if (perfilError) {
      console.log(`⚠ Perfil de ${u.email}: ${perfilError.message}`);
      continue;
    }

    console.log(`✅ Usuario creado: ${u.email} (${u.rol})`);
  }

  console.log(`\nContraseña inicial para todos: ${CONTRASENA_INICIAL}`);
}

main().catch((err) => {
  console.error("❌ Error:", err);
  process.exit(1);
});
