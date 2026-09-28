"use strict";

/*

* EmiMatch — Eliminación real de cuenta
* Usa la API oficial de Supabase Functions.
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
status.setAttribute("data-type", error ? "error" : "success");

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
   * Verificamos que exista una sesión válida.
   */
  const {
    data: sessionData,
    error: sessionError
  } = await supabase.auth.getSession();

  if (sessionError) {
    throw new Error(
      sessionError.message || "No se pudo obtener la sesión."
    );
  }

  let session = sessionData?.session;

  if (!session?.access_token) {
    throw new Error(
      "La sesión expiró. Iniciá sesión nuevamente."
    );
  }

  /*
   * Renovamos la sesión antes de llamar a la función.
   */
  const {
    data: refreshData,
    error: refreshError
  } = await supabase.auth.refreshSession();

  if (!refreshError && refreshData?.session) {
    session = refreshData.session;
  }

  if (!session?.access_token) {
    throw new Error(
      "No se pudo obtener un token de sesión válido."
    );
  }

  /*
   * Invocación oficial de Supabase Edge Functions.
   */
  const {
    data,
    error
  } = await supabase.functions.invoke(
    "delete-account",
    {
      method: "POST",
      body: {}
    }
  );

  if (error) {
    console.error(
      "EmiMatch — error de delete-account:",
      error
    );

    let detail = error.message || "Error al comunicarse con Supabase.";

    /*
     * Intentamos obtener información adicional
     * cuando Supabase devuelve una respuesta HTTP.
     */
    if (error.context) {
      try {
        const response = error.context;

        if (typeof response.json === "function") {
          const responseData = await response.json();

          if (responseData?.error) {
            detail = responseData.error;
          }
        }
      } catch (readError) {
        console.warn(
          "EmiMatch — no se pudo leer el detalle:",
          readError
        );
      }
    }

    throw new Error(detail);
  }

  if (!data?.success) {
    throw new Error(
      data?.error ||
      "La cuenta no pudo ser eliminada."
    );
  }

  showStatus("✅ Cuenta eliminada correctamente.");

  if (button) {
    button.textContent = "✅ Cuenta eliminada";
  }

  /*
   * Limpiamos la sesión local.
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
   * Volvemos al inicio después de confirmar el éxito.
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
