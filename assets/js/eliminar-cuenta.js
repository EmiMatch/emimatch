"use strict";

/*
 * EmiMatch — Eliminación real de cuenta
 * Archivo para el NAVEGADOR.
 *
 * La eliminación administrativa del usuario
 * debe realizarse dentro de la Edge Function:
 * delete-account
 */

(function () {
  function iniciarEliminacion() {
    const config = window.EMIMATCH_CONFIG;

    const boton = document.getElementById("deleteAccountButton");
    const estado = document.getElementById("deleteStatus");

    function mostrarEstado(mensaje, error = false) {
      if (!estado) {
        console[error ? "error" : "log"](
          "EmiMatch:",
          mensaje
        );
        return;
      }

      estado.hidden = false;
      estado.textContent = mensaje;
      estado.setAttribute(
        "data-type",
        error ? "error" : "success"
      );
    }

    if (!boton) {
      console.error(
        "EmiMatch: no existe #deleteAccountButton."
      );
      return;
    }

    if (!config) {
      mostrarEstado(
        "❌ No se pudo cargar la configuración de EmiMatch.",
        true
      );
      return;
    }

    if (
      !config.supabaseUrl ||
      !(config.supabaseKey || config.supabaseAnonKey)
    ) {
      mostrarEstado(
        "❌ La configuración de Supabase está incompleta.",
        true
      );
      return;
    }

    if (
      !window.supabase ||
      typeof window.supabase.createClient !== "function"
    ) {
      mostrarEstado(
        "❌ No se pudo cargar Supabase.",
        true
      );
      return;
    }

    const supabase = window.supabase.createClient(
      config.supabaseUrl,
      config.supabaseKey || config.supabaseAnonKey,
      {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true
        }
      }
    );

    let eliminando = false;

    async function eliminarCuenta() {
      if (eliminando) {
        return;
      }

      const confirmar = window.confirm(
        "¿Seguro que querés eliminar tu cuenta de EmiMatch?\n\n" +
        "Esta acción es permanente."
      );

      if (!confirmar) {
        return;
      }

      const ultimaConfirmacion = window.confirm(
        "⚠️ ÚLTIMA CONFIRMACIÓN\n\n" +
        "Se eliminará tu cuenta y los datos relacionados.\n\n" +
        "¿Querés continuar?"
      );

      if (!ultimaConfirmacion) {
        return;
      }

      eliminando = true;

      boton.disabled = true;
      boton.textContent = "⏳ Eliminando cuenta...";

      mostrarEstado(
        "⏳ Verificando tu sesión..."
      );

      try {
        /*
         * 1. Obtener la sesión actual.
         */
        let {
          data: sesionData,
          error: sesionError
        } = await supabase.auth.getSession();

        if (sesionError) {
          throw new Error(
            sesionError.message ||
            "No se pudo obtener la sesión."
          );
        }

        let sesion = sesionData?.session;

        /*
         * 2. Si no existe una sesión válida,
         * intentar renovarla.
         */
        if (!sesion?.access_token) {
          const {
            data: refreshData,
            error: refreshError
          } = await supabase.auth.refreshSession();

          if (refreshError) {
            throw new Error(
              "Tu sesión expiró. Iniciá sesión nuevamente."
            );
          }

          sesion = refreshData?.session;
        }

        /*
         * 3. Comprobar nuevamente el token.
         */
        if (!sesion?.access_token) {
          throw new Error(
            "No hay una sesión válida. Iniciá sesión nuevamente."
          );
        }

        mostrarEstado(
          "⏳ Eliminando tu cuenta..."
        );

        /*
         * 4. Llamar a la Edge Function.
         *
         * Supabase JS envía automáticamente
         * el token de la sesión autenticada.
         */
        const resultado =
          await supabase.functions.invoke(
            "delete-account",
            {
              method: "POST",
              body: {}
            }
          );

        const datos = resultado.data;
        const error = resultado.error;

        /*
         * 5. Analizar respuesta de la Edge Function.
         */
        if (error) {
          console.error(
            "EmiMatch — error delete-account:",
            error
          );

          let mensaje =
            error.message ||
            "No se pudo ejecutar la eliminación de la cuenta.";

          /*
           * Intentar leer el JSON enviado
           * por la Edge Function.
           */
          if (error.context) {
            try {
              const respuesta =
                typeof error.context.clone === "function"
                  ? error.context.clone()
                  : error.context;

              if (
                respuesta &&
                typeof respuesta.json === "function"
              ) {
                const cuerpo =
                  await respuesta.json();

                if (cuerpo?.error) {
                  mensaje = cuerpo.error;
                }
              }
            } catch (leerError) {
              console.warn(
                "EmiMatch: no se pudo leer la respuesta:",
                leerError
              );
            }
          }

          throw new Error(mensaje);
        }

        /*
         * 6. Comprobar respuesta lógica.
         */
        if (!datos || datos.success !== true) {
          throw new Error(
            datos?.error ||
            "La cuenta no pudo ser eliminada."
          );
        }

        /*
         * 7. Éxito.
         */
        mostrarEstado(
          "✅ Cuenta eliminada correctamente."
        );

        boton.disabled = true;
        boton.textContent =
          "✅ Cuenta eliminada";

        /*
         * 8. Limpiar sesión local.
         */
        try {
          await supabase.auth.signOut();
        } catch (errorSalida) {
          console.warn(
            "EmiMatch: no se pudo cerrar la sesión local:",
            errorSalida
          );
        }

        /*
         * 9. Volver al inicio.
         */
        window.setTimeout(function () {
          window.location.replace(
            "index.html"
          );
        }, 1500);

      } catch (error) {
        console.error(
          "EmiMatch — eliminación de cuenta:",
          error
        );

        eliminando = false;

        boton.disabled = false;
        boton.textContent =
          "🗑️ Eliminar mi cuenta";

        mostrarEstado(
          "❌ " +
          (
            error?.message ||
            "No se pudo eliminar la cuenta."
          ),
          true
        );
      }
    }

    /*
     * Evitar registrar dos veces el evento.
     */
    if (
      boton.dataset.emimatchDeleteReady === "true"
    ) {
      return;
    }

    boton.dataset.emimatchDeleteReady = "true";

    boton.addEventListener(
      "click",
      eliminarCuenta
    );

    console.log(
      "EmiMatch: eliminación de cuenta preparada correctamente."
    );
  }

  /*
   * Ejecutar cuando el DOM esté disponible.
   */
  if (
    document.readyState === "loading"
  ) {
    document.addEventListener(
      "DOMContentLoaded",
      iniciarEliminacion,
      { once: true }
    );
  } else {
    iniciarEliminacion();
  }
})();
