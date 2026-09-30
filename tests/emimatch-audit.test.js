"use strict";

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const ROOT = path.resolve(__dirname, "..");

let errors = 0;
let warnings = 0;

function ok(message) {
  console.log(`✅ ${message}`);
}

function error(message) {
  errors++;
  console.log(`❌ ${message}`);
}

function warning(message) {
  warnings++;
  console.log(`⚠️ ${message}`);
}

function exists(relativePath) {
  return fs.existsSync(path.join(ROOT, relativePath));
}

function read(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8");
}

console.log("");
console.log("======================================");
console.log("        EMIMATCH — AUDITORÍA");
console.log("======================================");
console.log("");

/* 1. ARCHIVOS PRINCIPALES */

console.log("📁 ARCHIVOS PRINCIPALES");

const requiredFiles = [
  "index.html",
  "perfil.html",
  "editar-perfil.html",
  "descubrir.html",
  "matches.html",
  "chat.html",
  "configuracion.html",
  "menu.html",
  "assets/css/app.css",
  "assets/js/app.js",
  "assets/js/components.js",
  "assets/js/config.js",
  "assets/js/eliminar-cuenta.js"
];

for (const file of requiredFiles) {
  if (exists(file)) {
    ok(file);
  } else {
    error(`Falta ${file}`);
  }
}

/* 2. SUPABASE */

console.log("");
console.log("🔐 CONFIGURACIÓN SUPABASE");

if (exists("assets/js/config.js")) {
  const config = read("assets/js/config.js");

  if (config.includes("EMIMATCH_CONFIG")) {
    ok("EMIMATCH_CONFIG encontrado");
  } else {
    error("No existe EMIMATCH_CONFIG");
  }

  if (config.includes("supabaseUrl")) {
    ok("supabaseUrl encontrado");
  } else {
    error("Falta supabaseUrl");
  }

  if (
    config.includes("supabaseAnonKey") ||
    config.includes("supabaseKey")
  ) {
    ok("Clave pública de Supabase encontrada");
  } else {
    error("No se encontró clave pública de Supabase");
  }

  if (
    config.includes("service_role") ||
    config.includes("SERVICE_ROLE")
  ) {
    error("Posible clave administrativa expuesta en código cliente");
  } else {
    ok("No se detectó service_role en config.js");
  }
}

/* 3. ELIMINACIÓN DE CUENTA */

console.log("");
console.log("🗑️ ELIMINACIÓN DE CUENTA");

if (exists("assets/js/eliminar-cuenta.js")) {
  const file = read("assets/js/eliminar-cuenta.js");

  if (file.includes("delete-account")) {
    ok("Edge Function delete-account referenciada");
  } else {
    error("No se encontró delete-account");
  }

  if (file.includes("deleteAccountButton")) {
    ok("Botón de eliminación conectado");
  } else {
    error("No se encontró deleteAccountButton");
  }

  if (file.includes("functions.invoke")) {
    ok("supabase.functions.invoke detectado");
  } else {
    warning("No se detectó supabase.functions.invoke");
  }
}

if (exists("configuracion.html")) {
  const html = read("configuracion.html");

  if (html.includes("deleteAccountButton")) {
    ok("Botón de eliminación existe");
  } else {
    error("Falta deleteAccountButton en configuracion.html");
  }

  if (html.includes("eliminar-cuenta.js")) {
    ok("eliminar-cuenta.js cargado");
  } else {
    error("eliminar-cuenta.js no está cargado");
  }
}

/* 4. HTML */

console.log("");
console.log("🌐 HTML");

const htmlFiles = requiredFiles.filter(
  file => file.endsWith(".html")
);

for (const file of htmlFiles) {
  if (!exists(file)) continue;

  const html = read(file);

  if (!html.includes("<html")) {
    warning(`${file}: falta <html>`);
  }

  if (!html.includes("<body")) {
    warning(`${file}: falta <body>`);
  }

  if (!html.includes("</html>")) {
    warning(`${file}: falta </html>`);
  }
}

/* 5. JAVASCRIPT */

console.log("");
console.log("🟨 JAVASCRIPT");

const jsFiles = [
  "assets/js/app.js",
  "assets/js/components.js",
  "assets/js/config.js",
  "assets/js/eliminar-cuenta.js"
];

for (const file of jsFiles) {
  if (!exists(file)) continue;

  const content = read(file);

  if (content.trim().length === 0) {
    error(`${file}: archivo vacío`);
    continue;
  }

  ok(`${file}: contiene código`);

  const result = spawnSync(
    process.execPath,
    ["--check", path.join(ROOT, file)],
    {
      encoding: "utf8"
    }
  );

  if (result.status === 0) {
    ok(`${file}: sintaxis JavaScript correcta`);
  } else {
    error(`${file}: ERROR DE SINTAXIS`);
    if (result.stderr) {
      console.log(result.stderr.trim());
    }
  }
}

/* 6. TESTS */

console.log("");
console.log("🧪 SISTEMA DE TESTS");

if (exists("tests")) {
  ok("Directorio tests encontrado");
} else {
  warning("Directorio tests no encontrado");
}

/* 7. SUPABASE VERSIONADO */

console.log("");
console.log("☁️ SUPABASE");

if (exists("supabase/functions/delete-account/index.ts")) {
  ok("delete-account/index.ts está versionado");
} else {
  warning(
    "La Edge Function delete-account no está versionada en el repositorio"
  );
}

/* RESULTADO */

console.log("");
console.log("======================================");
console.log("              RESULTADO");
console.log("======================================");

console.log(`❌ Errores: ${errors}`);
console.log(`⚠️ Advertencias: ${warnings}`);

if (errors > 0) {
  console.log("");
  console.log("RESULTADO: ❌ AUDITORÍA CON ERRORES");
  process.exitCode = 1;
} else if (warnings > 0) {
  console.log("");
  console.log("RESULTADO: ⚠️ AUDITORÍA CON ADVERTENCIAS");
} else {
  console.log("");
  console.log("RESULTADO: ✅ AUDITORÍA CORRECTA");
}
