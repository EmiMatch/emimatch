"use strict";

/*
 * EmiMatch — Eliminación de cuenta
 * Toda la lógica está aislada en este archivo.
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
      const {
        data: sessionData,
        error: sessionError
      } = await supabase.auth.getSession();

      if (sessionError) {
        throw sessionError;
      }

      let session = sessionData?.session;

      if (!session?.access_token) {
        throw new Error(
          "La sesión expiró. Iniciá sesión nuevamente."
        );
      }

      /*
       * Intentamos refrescar la sesión para utilizar
       * un access token vigente.
       */
      const {
        data: refreshData,
        error: refreshError
      } = await supabase.auth.refreshSession();

      if (!refreshError && refreshData?.session) {
        session = refreshData.session;
      }

      const response = await fetch(
        `${config.supabaseUrl}/functions/v1/delete-account`,
        {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${session.access_token}`,
            "apikey": config.supabaseKey,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({})
        }
      );

      let result = null;

      const responseText = await response.text();

      if (responseText) {
        try {
          result = JSON.parse(responseText);
        } catch (_) {
          result = {
            error: responseText
          };
        }
      }

      if (!response.ok) {
        throw new Error(
          result?.error ||
          `Error del servidor (${response.status}).`
        );
      }

      if (!result?.success) {
        throw new Error(
          result?.error ||
          "La cuenta no pudo ser eliminada."
        );
      }

      showStatus("✅ Cuenta eliminada correctamente.");

      if (button) {
        button.textContent = "✅ Cuenta eliminada";
      }

      /*
       * Limpiar la sesión local.
       */
      try {
        await supabase.auth.signOut();
      } catch (signOutError) {
        console.warn(
          "Sesión local no pudo limpiarse:",
          signOutError
        );
      }

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
  }
})();
