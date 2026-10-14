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
          <span class="em-nav-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="m3 10 9-7 9 7"/><path d="M5 9v12h14V9M9 21v-7h6v7"/></svg></span>
          <small>Inicio</small>
        </a>

        <a
          href="descubrir.html"
          class="${currentPage === "descubrir.html" ? "active" : ""}"
          aria-label="Descubrir"
        >
          <span class="em-nav-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><circle cx="10.8" cy="10.8" r="6.8"/><path d="m16 16 5 5"/></svg></span>
          <small>Descubrir</small>
        </a>

        <a
          href="matches.html"
          class="${currentPage === "matches.html" ? "active" : ""}"
          aria-label="Matches"
        >
          <span class="em-nav-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M20.8 8.8c0 5.1-8.8 11-8.8 11s-8.8-5.9-8.8-11A4.8 4.8 0 0 1 12 6.4a4.8 4.8 0 0 1 8.8 2.4Z"/></svg></span>
          <small>Matches</small>
        </a>

        <a
          href="chat.html"
          class="${currentPage === "chat.html" ? "active" : ""}"
          aria-label="Mensajes"
        >
          <span class="em-nav-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M21 11.5a8.4 8.4 0 0 1-8.8 8.4 9.4 9.4 0 0 1-4-.9L3 21l1.5-4.7a8.1 8.1 0 1 1 16.5-4.8Z"/><path d="M8 11h8M8 14h5"/></svg></span>
          <small>Mensajes</small>
        </a>

        <a
          href="menu.html"
          class="${currentPage === "menu.html" ? "active" : ""}"
          aria-label="Menú"
        >
          <span class="em-nav-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M4 6h16M4 12h16M4 18h16"/></svg></span>
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
          <span class="em-brand-mark">🫰</span>
          <span>EmiMatch</span>
        </a>

        <a
          href="notificaciones.html"
          class="em-header-notifications"
          aria-label="Notificaciones"
        >
          <svg class="em-notification-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/></svg>
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
