<!DOCTYPE html><html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">  <title>Configuración - EmiMatch</title>  <link rel="stylesheet" href="assets/css/app.css">  <!-- Supabase -->  <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>  <!-- Configuración EmiMatch -->  <script src="assets/js/config.js"></script></head><body>  <main class="em-container em-section em-with-navigation"><section class="em-shell">

  <!-- =====================================================
       ENCABEZADO
  ====================================================== -->

  <div class="em-card">

    <a
      href="menu.html"
      class="em-muted"
      style="text-decoration:none;"
    >
      ← Volver
    </a>

    <div
      class="em-brand"
      style="margin-top:18px;"
    >
      <span class="em-brand-mark">💕</span>
      <span>EmiMatch</span>
    </div>

    <h1>⚙️ Configuración</h1>

    <p class="em-muted">
      Administrá tu cuenta, seguridad y preferencias.
    </p>

  </div>


  <!-- =====================================================
       ESTADO DE CUENTA
  ====================================================== -->

  <div class="em-card">

    <h2>👤 Mi cuenta</h2>

    <div
      id="accountInfo"
      class="em-muted"
    >
      Cargando información...
    </div>

  </div>


  <!-- =====================================================
       SEGURIDAD
  ====================================================== -->

  <div class="em-card">

    <h2>🛡️ Seguridad</h2>

    <p class="em-muted">
      Protegé tu cuenta y cerrá tu sesión cuando termines
      de usar EmiMatch.
    </p>

    <button
      id="logoutButton"
      class="em-button"
      type="button"
    >
      🚪 Cerrar sesión
    </button>

  </div>


  <!-- =====================================================
       PRIVACIDAD
  ====================================================== -->

  <div class="em-card">

    <h2>🔐 Privacidad</h2>

    <p class="em-muted">
      Revisá la información relacionada con privacidad
      y seguridad.
    </p>

    <a
      href="privacidad.html"
      class="em-button"
    >
      🔐 Ver privacidad
    </a>

  </div>


  <!-- =====================================================
       ELIMINAR CUENTA
  ====================================================== -->

  <div
    class="em-card"
    id="eliminar-cuenta"
  >

    <h2>⚠️ Zona de riesgo</h2>

    <p class="em-muted">
      La eliminación de una cuenta es una acción permanente.
    </p>

    <p
      class="em-muted"
      style="font-size:14px;"
    >
      Se eliminarán la cuenta y los datos relacionados
      disponibles en EmiMatch.
    </p>

    <button
      id="deleteAccountButton"
      class="em-button"
      type="button"
    >
      🗑️ Eliminar mi cuenta
    </button>

    <div
      id="deleteStatus"
      class="em-alert"
      hidden
      style="margin-top:12px;"
      role="status"
      aria-live="polite"
    ></div>

  </div>


  <!-- =====================================================
       INFORMACIÓN
  ====================================================== -->

  <div class="em-card">

    <h2>ℹ️ Información</h2>

    <p class="em-muted">
      EmiMatch
    </p>

    <p
      id="appVersion"
      class="em-muted"
    >
      Versión: —
    </p>

  </div>

</section>

  </main>  <!-- =======================================================
       NAVEGACIÓN INFERIOR
  ======================================================== -->  <nav
    class="em-bottom-nav"
    aria-label="Navegación principal"
  ><a href="descubrir.html">
  <span>🔎</span>
  <small>Descubrir</small>
</a>

<a href="likes.html">
  <span>❤️</span>
  <small>Likes</small>
</a>

<a href="matches.html">
  <span>💕</span>
  <small>Matches</small>
</a>

<a href="chat.html">
  <span>💬</span>
  <small>Chat</small>
</a>

<a
  href="configuracion.html"
  class="active"
  aria-current="page"
>
  <span>⚙️</span>
  <small>Cuenta</small>
</a>

  </nav>  <!-- =======================================================
       SESIÓN / CUENTA
  ======================================================== -->  <script>
  "use strict";

  (() => {

    const config = window.EMIMATCH_CONFIG;

    if (!config) {
      console.error(
        "EmiMatch: EMIMATCH_CONFIG no está disponible."
      );

      window.location.replace("index.html");
      return;
    }

    if (!window.supabase) {
      console.error(
        "EmiMatch: Supabase JS no está disponible."
      );

      return;
    }

    const supabase = window.supabase.createClient(
      config.supabaseUrl,
      config.supabaseKey
    );


    /* =====================================================
       ELEMENTOS
    ====================================================== */

    const accountInfo =
      document.getElementById("accountInfo");

    const logoutButton =
      document.getElementById("logoutButton");

    const appVersion =
      document.getElementById("appVersion");


    let currentUser = null;
    let loggingOut = false;


    /* =====================================================
       VERSIÓN
    ====================================================== */

    if (appVersion) {

      appVersion.textContent =
        "Versión: " +
        (config.version || "1.0.0");

    }


    /* =====================================================
       ESCAPAR HTML
    ====================================================== */

    function escapeHtml(value) {

      return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");

    }


    /* =====================================================
       MOSTRAR INFORMACIÓN DE CUENTA
    ====================================================== */

    function renderAccount() {

      if (!accountInfo || !currentUser) {
        return;
      }

      const email =
        currentUser.email ||
        "Sin correo disponible";

      accountInfo.innerHTML = `
        <strong>Cuenta activa</strong>
        <br>
        <span>${escapeHtml(email)}</span>
      `;

    }


    /* =====================================================
       CARGAR SESIÓN
    ====================================================== */

    async function loadSession() {

      try {

        const {
          data,
          error
        } = await supabase.auth.getSession();


        if (error) {

          console.error(
            "EmiMatch: error obteniendo sesión:",
            error
          );

          window.location.replace("index.html");
          return;
        }


        const session =
          data?.session;


        if (!session?.user) {

          window.location.replace("index.html");
          return;
        }


        currentUser =
          session.user;


        renderAccount();


      } catch (error) {

        console.error(
          "EmiMatch: error cargando sesión:",
          error
        );

        window.location.replace("index.html");

      }

    }


    /* =====================================================
       CERRAR SESIÓN
    ====================================================== */

    async function logout() {

      if (
        loggingOut ||
        !logoutButton
      ) {
        return;
      }


      loggingOut = true;

      logoutButton.disabled = true;

      logoutButton.textContent =
        "⏳ Cerrando sesión...";


      try {

        const {
          error
        } = await supabase.auth.signOut();


        if (error) {
          throw error;
        }


        window.location.replace("index.html");


      } catch (error) {

        console.error(
          "EmiMatch: error cerrando sesión:",
          error
        );


        loggingOut = false;

        logoutButton.disabled = false;

        logoutButton.textContent =
          "🚪 Cerrar sesión";


        alert(
          "No se pudo cerrar la sesión. " +
          "Intentá nuevamente."
        );

      }

    }


    /* =====================================================
       EVENTO LOGOUT
    ====================================================== */

    if (logoutButton) {

      logoutButton.addEventListener(
        "click",
        logout
      );

    }


    /* =====================================================
       INICIO
    ====================================================== */

    loadSession();

  })();
  </script>  <!-- =======================================================
       ELIMINACIÓN DE CUENTA
       IMPORTANTE:
       Este archivo es el ÚNICO encargado del botón
       "Eliminar mi cuenta".
  ======================================================== -->  <script src="assets/js/eliminar-cuenta.js"></script></body>
</html>
