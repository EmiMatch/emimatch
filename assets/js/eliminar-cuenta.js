"use strict";

/*
 * EmiMatch — Eliminación de cuenta
 * Este archivo corre en el navegador.
 * La eliminación administrativa ocurre únicamente
 * dentro de la Edge Function de Supabase.
 */

(() => {
  function init() {
    const config = window.EMIMATCH_CONFIG;

    if (!config) {
      console.error("EmiMatch: falta EMIMATCH_CONFIG.");
      return;
    }

    if (!window.supabase) {
      console.error("EmiMatch: Supabase JS no está disponible.");
      return;
    }

    const button = document.getElementById("deleteAccountButton");
    const status = document.getElementById("deleteStatus");

    if (!button) {
      console.error("EmiMatch: no se encontró #deleteAccountButton.");
      return;
    }

    const supabase = window.supabase.createClient(
      config.supabaseUrl,
      config.supabaseKey || config.supabaseAnonKey
    );

    let deleting = false;

    function showStatus(message, isError = false) {
      if (!status) return;

      status.hidden = false;
      status.textContent = message;
      status.setAttribute(
        "data-type",
        isError ? "error" : "success"
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

      button.disabled = true;
      button.textContent = "⏳ Eliminando cuenta...";

      showStatus("⏳ Verificando sesión...");

      try {
        let {
          data: sessionData,
          error: sessionError
        } = await supabase.auth.getSession();

        if (sessionError) {
          throw new Error(sessionError.message);
        }

        let session = sessionData?.session;

        if (!session?.access_token) {
          const {
            data: refreshData,
            error: refreshError
          } = await supabase.auth.refreshSession();

          if (refreshError) {
            throw new Error(
              "Tu sesión expiró. Iniciá sesión nuevamente."
            );
          }

          session = refreshData?.session;
        }

        if (!session?.access_token) {
          throw new Error(
            "No hay una sesión válida. Iniciá sesión nuevamente."
          );
        }

        showStatus("⏳ Eliminando tu cuenta...");

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
            "EmiMatch — delete-account:",
            error
          );

          let message =
            error.message ||
            "No se pudo contactar con Supabase.";

          if (error.context) {
            try {
              const response = error.context;

              if (typeof response.clone === "function") {
                const cloned = response.clone();
                const responseData = await cloned.json();

                if (responseData?.error) {
                  message = responseData.error;
                }
              }
            } catch (_) {
              // Conservamos el mensaje principal.
            }
          }

          throw new Error(message);
        }

        if (!data?.success) {
          throw new Error(
            data?.error ||
            "La cuenta no pudo ser eliminada."
          );
        }

        showStatus(
          "✅ Cuenta eliminada correctamente."
        );

        button.disabled = true;
        button.textContent =
          "✅ Cuenta eliminada";

        try {
          await supabase.auth.signOut();
        } catch (signOutError) {
          console.warn(
            "EmiMatch: no se pudo limpiar la sesión local:",
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

        button.disabled = false;
        button.textContent =
          "🗑️ Eliminar mi cuenta";

        showStatus(
          `❌ ${
            error?.message ||
            "No se pudo eliminar la cuenta."
          }`,
          true
        );
      }
    }

    button.addEventListener(
      "click",
      deleteAccount
    );
  }

  if (document.readyState === "loading") {
    document.addEventListener(
      "DOMContentLoaded",
      init
    );
  } else {
    init();
  }
})();
