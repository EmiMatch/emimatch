"use strict";

/*
 * EmiMatch — Eliminación de cuenta
 * Utiliza Supabase Functions.invoke()
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
       * Supabase agrega automáticamente:
       * Authorization
       * apikey
       * Content-Type
       */
      const { data, error } =
  await supabase.functions.invoke(
    "delete-account",
    {
      body: {},
      headers: {
        Authorization: `Bearer ${session.access_token}`
      }
    }
  );

      if (error) {
        console.error(
          "EmiMatch — error de Edge Function:",
          error
        );

        throw new Error(
          error.message ||
          "No se pudo conectar con el servidor."
        );
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

      if (button) {
        button.textContent = "✅ Cuenta eliminada";
      }

      /*
       * Limpiar sesión local.
       */
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

  if (button) {
    button.addEventListener(
      "click",
      deleteAccount
    );
  }
})();
