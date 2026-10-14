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

/* 8. HIGIENE DEL REPOSITORIO Y SECRETOS */

console.log("");
console.log("🛡️ HIGIENE DEL REPOSITORIO");

const forbiddenFiles = [
  "android/keystore.properties",
  "android-backup/keystore.properties",
  "emimatch-release.jks",
  "android/local.properties"
];

for (const file of forbiddenFiles) {
  if (exists(file)) {
    error(`Archivo sensible o local versionado: ${file}`);
  } else {
    ok(`${file}: no está en la versión actual`);
  }
}

const trackedNodeModules = spawnSync(
  "git",
  ["ls-files", "--", "node_modules/"],
  {
    cwd: ROOT,
    encoding: "utf8"
  }
);

if (trackedNodeModules.status === 0) {
  if (trackedNodeModules.stdout.trim()) {
    error("node_modules no debe estar versionado");
  } else {
    ok("node_modules no está versionado");
  }
} else if (exists(".gitignore") && read(".gitignore").includes("node_modules/")) {
  ok("node_modules está excluido por .gitignore (Git no disponible para verificar el índice)");
} else {
  error("No se pudo verificar si node_modules está versionado");
}

if (exists(".gitignore")) {
  const ignore = read(".gitignore");
  for (const pattern of ["node_modules/", "*.jks", "**/keystore.properties", "android/local.properties"]) {
    if (ignore.includes(pattern)) {
      ok(`.gitignore protege ${pattern}`);
    } else {
      error(`.gitignore no protege ${pattern}`);
    }
  }
} else {
  error("Falta .gitignore en la raíz");
}

/* 9. REQUISITOS DE REGISTRO PARA PUBLICACIÓN */

console.log("");
console.log("🔞 EDAD MÍNIMA Y DOCUMENTOS LEGALES");

if (exists("index.html")) {
  const html = read("index.html");

  if (html.includes('id="registerAdult"')) {
    ok("Confirmación de mayoría de edad presente");
  } else {
    error("Falta la confirmación de mayoría de edad en el registro");
  }

  if (html.includes('if (!adultConfirmation || !adultConfirmation.checked)')) {
    ok("El registro valida la confirmación de mayoría de edad");
  } else {
    error("El registro no valida la confirmación de mayoría de edad");
  }

  if (html.includes('href="terminos.html" target="_blank"')) {
    ok("Términos y Condiciones accesibles desde el registro");
  } else {
    error("Falta el enlace a Términos y Condiciones en el registro");
  }

  if (html.includes('href="privacidad.html" target="_blank"')) {
    ok("Política de Privacidad accesible desde el registro");
  } else {
    error("Falta el enlace a la Política de Privacidad en el registro");
  }
}

/* 10. RENOVACIÓN PREMIUM — COMPROBACIONES ESTÁTICAS */

console.log("");
console.log("✨ RENOVACIÓN PREMIUM — COMPROBACIONES ESTÁTICAS");

const refreshPages = [
  "index.html",
  "perfil.html",
  "editar-perfil.html",
  "descubrir.html",
  "matches.html",
  "chat.html",
  "conversacion.html",
  "notificaciones.html",
  "menu.html",
  "configuracion.html",
  "admin.html",
  "likes.html",
  "perfil-usuario.html",
  "privacidad.html",
  "terminos.html",
  "recuperar.html",
  "restablecer.html",
  "membresia/membresia.html",
  "membresía/membresía.html"
];

if (exists("assets/css/premium-refresh.css")) {
  ok("Hoja de estilos premium presente");
} else {
  error("Falta assets/css/premium-refresh.css");
}

for (const page of refreshPages) {
  if (!exists(page)) {
    warning(`${page}: página no encontrada para verificar el estilo premium`);
    continue;
  }

  const html = read(page);
  const expectedPath = page.includes("/") ? "../assets/css/premium-refresh.css" : "assets/css/premium-refresh.css";
  if (html.includes(expectedPath)) {
    ok(`${page}: estilo premium enlazado con ruta relativa correcta`);
  } else {
    error(`${page}: falta el estilo premium o su ruta relativa no coincide`);
  }
}

if (exists("index.html")) {
  const html = read("index.html");
  if (html.includes('window.location.replace("perfil.html")')) {
    ok("La página de acceso contempla restauración de sesión activa");
  } else {
    error("No se encontró la navegación para sesión activa");
  }
}

if (exists("chat.html")) {
  const html = read("chat.html");
  for (const [label, pattern] of [
    ["menú de acciones de conversación", "conversation-menu-button"],
    ["acceso al perfil desde la lista de mensajes", "perfil-usuario.html?user="],
    ["acción de ocultar conversación solo local", "hideConversationForMe"],
    ["aviso de que no se borran los mensajes del servidor", "Los mensajes no se borrarán del servidor"]
  ]) {
    if (html.includes(pattern)) ok(`Mensajes: ${label} presente`);
    else error(`Mensajes: falta ${label}`);
  }
}

if (exists("conversacion.html")) {
  const html = read("conversacion.html");
  if (html.includes("profileAvatarLink") && html.includes("profileNameLink")) {
    ok("El encabezado del chat permite abrir el perfil");
  } else {
    error("Falta el acceso al perfil desde el encabezado del chat");
  }
}

if (exists("assets/js/components.js")) {
  const js = read("assets/js/components.js");
  if (js.includes("em-nav-icon") && js.includes("<svg")) {
    ok("La navegación usa iconos vectoriales");
  } else {
    error("No se encontraron iconos vectoriales en la navegación");
  }
}

if (exists("notificaciones.html")) {
  const html = read("notificaciones.html");
  if (html.includes("notificationIconMarkup") && html.includes("perfil-usuario.html?user=")) {
    ok("Notificaciones: iconos consistentes y acceso al perfil del visitante");
  } else {
    error("Notificaciones: falta el sistema de iconos o el acceso al visitante");
  }
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
