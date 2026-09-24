(function () {
  "use strict";

  const currentPage =
    window.location.pathname.split("/").pop() || "index.html";

  const isAuthenticatedPage =
    currentPage !== "index.html" &&
    currentPage !== "restablecer.html";

  function getNavHTML() {
    return `
      <nav class="em-bottom-nav" aria-label="Navegación principal">

        <a
          href="perfil.html"
          class="${currentPage === "perfil.html" ? "active" : ""}"
          aria-label="Inicio"
        >
          <span>🏠</span>
          <small>Inicio</small>
        </a>

        <a
          href="descubrir.html"
          class="${currentPage === "descubrir.html" ? "active" : ""}"
          aria-label="Descubrir"
        >
          <span>🔎</span>
          <small>Descubrir</small>
        </a>

        <a
          href="matches.html"
          class="${currentPage === "matches.html" ? "active" : ""}"
          aria-label="Matches"
        >
          <span>💕</span>
          <small>Matches</small>
        </a>

        <a
          href="chat.html"
          class="${currentPage === "chat.html" ? "active" : ""}"
          aria-label="Mensajes"
        >
          <span>💬</span>
          <small>Mensajes</small>
        </a>

        <a
          href="menu.html"
          class="${currentPage === "menu.html" ? "active" : ""}"
          aria-label="Menú"
        >
          <span>☰</span>
          <small>Menú</small>
        </a>

      </nav>
    `;
  }


  function getHeaderHTML() {
    return `
      <header class="em-global-header">

        <a
          href="perfil.html"
          class="em-brand"
          aria-label="EmiMatch"
        >
          <span class="em-brand-mark">♥</span>
          <span>EmiMatch</span>
        </a>

        <a
          href="notificaciones.html"
          class="em-header-notifications"
          aria-label="Notificaciones"
        >
          🔔
        </a>

      </header>
    `;
  }


  function injectNavigation() {

    if (!isAuthenticatedPage) {
      return;
    }

    const header =
      document.createElement("div");

    header.innerHTML =
      getHeaderHTML();

    document.body.prepend(
      header.firstElementChild
    );


    const navigation =
      document.createElement("div");

    navigation.innerHTML =
      getNavHTML();

    document.body.appendChild(
      navigation.firstElementChild
    );


    document.body.classList.add(
      "em-with-navigation"
    );
  }


  function init() {
    injectNavigation();
  }


  if (
    document.readyState === "loading"
  ) {

    document.addEventListener(
      "DOMContentLoaded",
      init
    );

  } else {

    init();

  }

})();
