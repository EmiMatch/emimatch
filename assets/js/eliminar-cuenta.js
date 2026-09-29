"use strict";

/*

* EmiMatch — Eliminación real de cuenta
* Envía explícitamente el access_token a la Edge Function.
  */

(() => {
const config = window.EMIMATCH_CONFIG;

if (!config) {
console.error("EmiMatch: falta EMIMATCH_CONFIG.");
return;
}

if (!window.supabase) {
console.error("EmiMatch: Supabase JS no está disponible.");
return;
}

const supabase = window.supabase.createClient(
config.supabaseUrl,
config.supabaseKey
);

const button = document.getElementById("deleteAccountButton");
const status = document.getElementById("deleteStatus");

let deleting = false;

function showStatus(message, error = false) {
if (!status) return;

status.hidden = false;
status.textContent = message;
status.setAttribute(
  "data-type",
  error ? "error" : "success"
);

}

async function deleteAccount() {
if (deleting) return;

const first = window.confirm(
  "¿Seguro que querés eliminar tu cuenta de EmiMatch?\n\n" +
  "Esta acción es permanente."
);

if (!first) return;

const second = window.confirm(
  "⚠️ ÚLTIMA CONFIRMACIÓN\n\n" +
  "Se eliminará tu cuenta y sus datos relacionados.\n\n" +
  "¿Querés continuar?"
);

if (!second) return;

deleting = true;

if (button) {
  button.disabled = true;
  button.textContent = "⏳ Eliminando cuenta...";
}

showStatus("⏳ Eliminando tu cuenta...");

try {
  /*
   * 1. Obtener sesión actual.
   */
  const {
    data: sessionData,
    error: sessionError
  } = await supabase.auth.getSession();

  if (sessionError) {
    throw new Error(
      sessionError.message ||
      "No se pudo obtener la sesión."
    );
  }

  let session = sessionData?.session;

  /*
   * 2. Si no hay sesión, intentar renovarla.
   */
  if (!session?.access_token) {
    const {
      data: refreshData,
      error: refreshError
    } = await supabase.auth.refreshSession();

    if (refreshError) {
      throw new Error(
        refreshError.message ||
        "La sesión expiró. Iniciá sesión nuevamente."
      );
    }

    session = refreshData?.session;
  }

  if (!session?.access_token) {
    throw new Error(
      "No se pudo obtener un token de sesión válido. Iniciá sesión nuevamente."
    );
  }

  /*
   * 3. Renovar la sesión para intentar utilizar
   *    el token más reciente.
   */
  const {
    data: refreshData,
    error: refreshError
  } = await supabase.auth.refreshSession();

  if (!refreshError && refreshData?.session) {
    session = refreshData.session;
  }

  const accessToken = session?.access_token;

  if (!accessToken) {
    throw new Error(
      "No se pudo obtener el token de autorización."
    );
  }

  /*
   * 4. Llamada directa a la Edge Function.
   *
   *    Aquí enviamos explícitamente:
   *    Authorization: Bearer <access_token>
   *
   *    El token nunca se muestra ni se guarda en el código.
   */
  const functionUrl =
    `${config.supabaseUrl}/functions/v1/delete-account`;

  const response = await fetch(functionUrl, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${accessToken}`,
      "apikey": config.supabaseKey,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({})
  });

  /*
   * 5. Leer respuesta de la Edge Function.
   */
  let result = null;

  try {
    result = await response.json();
  } catch (parseError) {
    console.warn(
      "EmiMatch: la Edge Function no devolvió JSON válido.",
      parseError
    );
  }

  console.log(
    "EmiMatch — delete-account:",
    response.status,
    result
  );

  if (!response.ok) {
    throw new Error(
      result?.error ||
      result?.message ||
      `La Edge Function respondió con HTTP ${response.status}.`
    );
  }

  if (!result?.success) {
    throw new Error(
      result?.error ||
      "La cuenta no pudo ser eliminada."
    );
  }

  /*
   * 6. Eliminación confirmada.
   */
  showStatus("✅ Cuenta eliminada correctamente.");

  if (button) {
    button.textContent = "✅ Cuenta eliminada";
  }

  /*
   * 7. Limpiar sesión local.
   */
  try {
    await supabase.auth.signOut();
  } catch (signOutError) {
    console.warn(
      "EmiMatch: no se pudo limpiar la sesión local:",
      signOutError
    );
  }

  /*
   * 8. Volver al inicio.
   */
  setTimeout(() => {
    window.location.replace("index.html");
  }, 1200);

} catch (error) {
  console.error(
    "EmiMatch — error eliminando cuenta:",
    error
  );

  deleting = false;

  if (button) {
    button.disabled = false;
    button.textContent = "🗑️ Eliminar mi cuenta";
  }

  showStatus(
    `❌ ${error?.message || "No se pudo eliminar la cuenta."}`,
    true
  );
}

}

if (button) {
button.addEventListener("click", deleteAccount);
} else {
console.warn(
"EmiMatch: no se encontró #deleteAccountButton."
);
}
})();
