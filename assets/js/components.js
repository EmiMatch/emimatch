/* =====================================================
   EmiMatch — Componentes compartidos
   v1.0.0
===================================================== */

(() => {
  "use strict";

  const app =
    window.EmiMatchApp;

  if (!app) {
    console.error(
      "EmiMatch: app.js no fue cargado."
    );
    return;
  }

  const Components = {

    /* =================================================
       NOTIFICACIÓN
    ================================================= */

    notify(
      message,
      type = "info",
      duration = 3500
    ) {

      const existing =
        document.getElementById(
          "emimatch-notification"
        );

      if (existing) {
        existing.remove();
      }

      const notification =
        document.createElement("div");

      notification.id =
        "emimatch-notification";

      notification.setAttribute(
        "role",
        "status"
      );

      notification.innerHTML = `
        <div class="emimatch-notification-content">
          <span class="emimatch-notification-icon">
            ${this.getIcon(type)}
          </span>

          <span class="emimatch-notification-message">
            ${this.escapeHTML(message)}
          </span>
        </div>
      `;

      notification.style.cssText = `
        position: fixed;
        left: 50%;
        bottom: 24px;
        transform: translateX(-50%);
        z-index: 99999;
        width: min(92%, 440px);
        padding: 14px 18px;
        border-radius: 16px;
        background: rgba(15, 23, 42, 0.96);
        color: #ffffff;
        border: 1px solid rgba(255,255,255,0.12);
        box-shadow: 0 15px 40px rgba(0,0,0,0.35);
        backdrop-filter: blur(16px);
        -webkit-backdrop-filter: blur(16px);
        font-family: Arial, sans-serif;
        animation: emimatchNotificationIn .25s ease;
      `;

      document.body.appendChild(
        notification
      );

      setTimeout(() => {

        notification.style.animation =
          "emimatchNotificationOut .25s ease";

        setTimeout(() => {

          if (
            notification &&
            notification.parentNode
          ) {
            notification.remove();
          }

        }, 250);

      }, duration);
    },


    /* =================================================
       ICONOS
    ================================================= */

    getIcon(type) {

      const icons = {
        success: "✅",
        error: "❌",
        warning: "⚠️",
        info: "ℹ️",
        loading: "🔄"
      };

      return (
        icons[type] ||
        icons.info
      );
    },


    /* =================================================
       MENSAJES RÁPIDOS
    ================================================= */

    success(message) {

      this.notify(
        message,
        "success"
      );

    },


    error(message) {

      this.notify(
        message,
        "error"
      );

    },


    warning(message) {

      this.notify(
        message,
        "warning"
      );

    },


    info(message) {

      this.notify(
        message,
        "info"
      );

    },


    /* =================================================
       ESTADO DE CARGA
    ================================================= */

    loading(
      message = "Cargando..."
    ) {

      this.notify(
        message,
        "loading",
        999999
      );

    },


    /* =================================================
       ESCAPAR HTML
       Protección básica contra HTML no deseado
    ================================================= */

    escapeHTML(value) {

      const div =
        document.createElement("div");

      div.textContent =
        value == null
          ? ""
          : String(value);

      return div.innerHTML;
    },


    /* =================================================
       CREAR ELEMENTO
    ================================================= */

    createElement(
      tag,
      options = {}
    ) {

      const element =
        document.createElement(tag);

      if (options.className) {

        element.className =
          options.className;

      }

      if (options.id) {

        element.id =
          options.id;

      }

      if (options.text) {

        element.textContent =
          options.text;

      }

      if (options.html) {

        element.innerHTML =
          options.html;

      }

      return element;
    },


    /* =================================================
       ESTADO VACÍO
    ================================================= */

    emptyState(
      title,
      message,
      icon = "💫"
    ) {

      const container =
        document.createElement("div");

      container.className =
        "emimatch-empty-state";

      container.innerHTML = `
        <div class="emimatch-empty-icon">
          ${this.escapeHTML(icon)}
        </div>

        <h3>
          ${this.escapeHTML(title)}
        </h3>

        <p>
          ${this.escapeHTML(message)}
        </p>
      `;

      return container;
    },


    /* =================================================
       ESTADO DE ERROR
    ================================================= */

    errorState(
      title = "Ocurrió un problema",
      message =
        "No pudimos completar la operación."
    ) {

      const container =
        document.createElement("div");

      container.className =
        "emimatch-error-state";

      container.innerHTML = `
        <div class="emimatch-error-icon">
          ❌
        </div>

        <h3>
          ${this.escapeHTML(title)}
        </h3>

        <p>
          ${this.escapeHTML(message)}
        </p>
      `;

      return container;
    },


    /* =================================================
       BOTÓN DE CARGA
    ================================================= */

    setButtonLoading(
      button,
      loading = true,
      text = "Cargando..."
    ) {

      if (!button) {
        return;
      }

      if (loading) {

        button.dataset.originalText =
          button.textContent;

        button.disabled =
          true;

        button.setAttribute(
          "aria-busy",
          "true"
        );

        button.textContent =
          text;

      } else {

        button.disabled =
          false;

        button.removeAttribute(
          "aria-busy"
        );

        if (
          button.dataset.originalText
        ) {

          button.textContent =
            button.dataset.originalText;

          delete button.dataset
            .originalText;
        }
      }
    },


    /* =================================================
       INYECTAR ESTILOS BÁSICOS
    ================================================= */

    injectBaseStyles() {

      if (
        document.getElementById(
          "emimatch-component-styles"
        )
      ) {
        return;
      }

      const style =
        document.createElement("style");

      style.id =
        "emimatch-component-styles";

      style.textContent = `

        @keyframes emimatchNotificationIn {
          from {
            opacity: 0;
            transform:
              translate(-50%, 20px);
          }

          to {
            opacity: 1;
            transform:
              translate(-50%, 0);
          }
        }

        @keyframes emimatchNotificationOut {
          from {
            opacity: 1;
            transform:
              translate(-50%, 0);
          }

          to {
            opacity: 0;
            transform:
              translate(-50%, 20px);
          }
        }

        .emimatch-notification-content {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .emimatch-notification-icon {
          font-size: 20px;
          flex-shrink: 0;
        }

        .emimatch-notification-message {
          line-height: 1.4;
          font-size: 14px;
        }

        .emimatch-empty-state,
        .emimatch-error-state {
          text-align: center;
          padding: 40px 20px;
          border-radius: 20px;
          background:
            rgba(15, 23, 42, 0.65);
          border:
            1px solid rgba(255,255,255,0.10);
        }

        .emimatch-empty-icon,
        .emimatch-error-icon {
          font-size: 42px;
          margin-bottom: 12px;
        }

        .emimatch-empty-state h3,
        .emimatch-error-state h3 {
          margin: 0 0 8px;
          color: #ffffff;
        }

        .emimatch-empty-state p,
        .emimatch-error-state p {
          margin: 0;
          color: rgba(255,255,255,0.72);
          line-height: 1.5;
        }

        @media (max-width: 600px) {

          #emimatch-notification {
            bottom: 16px;
            width: calc(100% - 24px);
            padding: 13px 15px;
          }

          .emimatch-notification-message {
            font-size: 13px;
          }

        }

      `;

      document.head.appendChild(
        style
      );
    }

  };


  /* =====================================================
     REGISTRAR COMPONENTES
  ===================================================== */

  window.EmiMatchComponents =
    Components;


  /* =====================================================
     INICIALIZACIÓN
  ===================================================== */

  Components.injectBaseStyles();

  app.logUpdate(
    "Componentes compartidos cargados correctamente."
  );

})();
