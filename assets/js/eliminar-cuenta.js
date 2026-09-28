"use strict";

/*
 * EmiMatch — Eliminación real de cuenta
 * Llama directamente a la Edge Function delete-account.
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
       * Obtener la sesión actual.
       */
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
       * Intentar renovar la sesión antes de eliminar.
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
          "No se pudo obtener una sesión válida."
        );
      }

      /*
       * Endpoint oficial de la Edge Function.
       */
      const functionUrl =
        `${config.supabaseUrl}/functions/v1/delete-account`;

      /*
       * Llamada HTTPS directa.
       */
      const response = await fetch(functionUrl, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${session.access_token}`,
          "apikey": config.supabaseKey,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({})
      });

      /*
       * Intentar interpretar la respuesta como JSON.
       */
      let data = null;
      const responseText = await response.text();

      try {
        data = responseText
          ? JSON.parse(responseText)
          : null;
      } catch (parseError) {
        console.error(
          "EmiMatch — respuesta no JSON:",
          responseText
        );
      }

      /*
       * Mostrar errores HTTP reales.
       */
      if (!response.ok) {
        console.error(
          "EmiMatch — Edge Function HTTP:",
          response.status,
          data || responseText
        );

        throw new Error(
          data?.error ||
          `Error del servidor (${response.status}).`
        );
      }

      /*
       * La función debe responder success:true.
       */
      if (!data?.success) {
        throw new Error(
          data?.error ||
          "La cuenta no pudo ser eliminada."
        );
      }

      /*
       * Cuenta eliminada correctamente.
       */
      showStatus(
        "✅ Cuenta eliminada correctamente."
      );

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
          "EmiMatch: no se pudo limpiar la sesión local:",
          signOutError
        );
      }

      /*
       * Volver al inicio.
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
        button.textContent =
          "🗑️ Eliminar mi cuenta";
      }

      showStatus(
        `❌ ${
          error?.message ||
          "No se pudo eliminar la cuenta."
        }`,
        true
      );
    }
  }

  /*
   * Activar el botón.
   */
  if (button) {
    button.addEventListener(
      "click",
      deleteAccount
    );
  } else {
    console.warn(
      "EmiMatch: no se encontró #deleteAccountButton."
    );
  }
})();
