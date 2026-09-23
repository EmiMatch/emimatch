/* =====================================================
   EmiMatch — Componentes compartidos
   v1.1.0
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
       CENTRO DE ACTIVIDAD
    ================================================= */

    initActivityCenter() {

      if (
        document.getElementById(
          "emimatch-activity-center"
        )
      ) {
        return;
      }

      const host =
        document.querySelector("main") ||
        document.querySelector(".container") ||
        document.body;

      if (!host) {
        return;
      }

      const center =
        document.createElement("section");

      center.id =
        "emimatch-activity-center";

      center.className =
        "emimatch-activity-center";

      center.innerHTML = `
        <div class="emimatch-activity-head">

          <div>

            <span
              class="emimatch-activity-kicker"
            >
              Tu actividad
            </span>

            <h2>
              Centro de actividad
            </h2>

            <p>
              Mensajes, notificaciones y solicitudes
              en un solo lugar.
            </p>

          </div>

          <button
            type="button"
            class="emimatch-activity-refresh"
            id="emimatch-activity-refresh"
            aria-label="Actualizar actividad"
            title="Actualizar"
          >
            ↻
          </button>

        </div>


        <div
          class="emimatch-activity-grid"
        >

          <a
            class="emimatch-activity-card"
            href="matches.html"
          >

            <span
              class="emimatch-activity-icon"
            >
              💬
            </span>

            <span
              class="emimatch-activity-copy"
            >

              <strong>
                Mensajes
              </strong>

              <small>
                Conversaciones y matches
              </small>

            </span>

            <span
              class="emimatch-activity-count"
              id="emimatch-messages-count"
            >
              0
            </span>

          </a>


          <button
            type="button"
            class="emimatch-activity-card"
            id="emimatch-notifications-button"
          >

            <span
              class="emimatch-activity-icon"
            >
              🔔
            </span>

            <span
              class="emimatch-activity-copy"
            >

              <strong>
                Notificaciones
              </strong>

              <small>
                Nuevos matches y actividad
              </small>

            </span>

            <span
              class="emimatch-activity-count"
              id="emimatch-notifications-count"
            >
              0
            </span>

          </button>


          <button
            type="button"
            class="emimatch-activity-card"
            id="emimatch-requests-button"
          >

            <span
              class="emimatch-activity-icon"
            >
              👥
            </span>

            <span
              class="emimatch-activity-copy"
            >

              <strong>
                Solicitudes
              </strong>

              <small>
                Personas que indicaron interés
              </small>

            </span>

            <span
              class="emimatch-activity-count"
              id="emimatch-requests-count"
            >
              0
            </span>

          </button>

        </div>


        <div
          class="emimatch-activity-panel"
          id="emimatch-notifications-panel"
          hidden
        >

          <div
            class="emimatch-activity-panel-title"
          >
            🔔 Notificaciones
          </div>

          <div
            id="emimatch-notifications-list"
          ></div>

        </div>


        <div
          class="emimatch-activity-panel"
          id="emimatch-requests-panel"
          hidden
        >

          <div
            class="emimatch-activity-panel-title"
          >
            👥 Solicitudes recibidas
          </div>

          <div
            id="emimatch-requests-list"
          ></div>

        </div>


        <div
          class="emimatch-activity-status"
          id="emimatch-activity-status"
          aria-live="polite"
        ></div>
      `;

      host.prepend(center);


      const togglePanel =
        (panelId) => {

          const panel =
            document.getElementById(
              panelId
            );

          if (!panel) {
            return;
          }

          const shouldOpen =
            panel.hidden;

          document
            .querySelectorAll(
              ".emimatch-activity-panel"
            )
            .forEach(
              (item) => {
                item.hidden = true;
              }
            );

          panel.hidden =
            !shouldOpen;
        };


      const notificationsButton =
        document.getElementById(
          "emimatch-notifications-button"
        );

      if (notificationsButton) {

        notificationsButton.addEventListener(
          "click",
          () => {

            togglePanel(
              "emimatch-notifications-panel"
            );

          }
        );

      }


      const requestsButton =
        document.getElementById(
          "emimatch-requests-button"
        );

      if (requestsButton) {

        requestsButton.addEventListener(
          "click",
          () => {

            togglePanel(
              "emimatch-requests-panel"
            );

          }
        );

      }


      const refreshButton =
        document.getElementById(
          "emimatch-activity-refresh"
        );

      if (refreshButton) {

        refreshButton.addEventListener(
          "click",
          () => {

            this.loadActivity();

          }
        );

      }


      this.loadActivity();
    },


    /* =================================================
       CARGAR ACTIVIDAD
    ================================================= */

    async loadActivity() {

      const config =
        window.EMIMATCH_CONFIG;

      if (
        !config ||
        !window.supabase ||
        !config.supabaseUrl ||
        !config.supabaseKey
      ) {
        return;
      }

      const status =
        document.getElementById(
          "emimatch-activity-status"
        );

      try {

        const client =
          window.EmiMatchActivitySupabase ||
          (
            window.EmiMatchActivitySupabase =
              window.supabase.createClient(
                config.supabaseUrl,
                config.supabaseKey
              )
          );


        const {
          data: {
            user
          } = {}
        } =
          await client.auth.getUser();


        if (!user) {
          return;
        }


        if (status) {

          status.textContent =
            "Actualizando actividad...";

        }


        const [
          messagesResult,
          matchesResult,
          requestsResult
        ] =
          await Promise.all([

            client
              .from("messages")
              .select(
                "id",
                {
                  count: "exact",
                  head: true
                }
              )
              .eq(
                "receiver_id",
                user.id
              ),


            client
              .from("matches")
              .select(
                "user1_id,user2_id"
              )
              .or(
                `user1_id.eq.${user.id},user2_id.eq.${user.id}`
              ),


            client
              .from("swipes")
              .select(
                "id,user_id,target_user_id,created_at"
              )
              .eq(
                "target_user_id",
                user.id
              )
              .eq(
                "action",
                "like"
              )
              .order(
                "created_at",
                {
                  ascending: false
                }
              )
              .limit(20)

          ]);


        if (messagesResult.error) {
          throw messagesResult.error;
        }

        if (matchesResult.error) {
          throw matchesResult.error;
        }

        if (requestsResult.error) {
          throw requestsResult.error;
        }


        const messagesCount =
          Number(
            messagesResult.count || 0
          );


        const matches =
          Array.isArray(
            matchesResult.data
          )
            ? matchesResult.data
            : [];


        const receivedLikes =
          Array.isArray(
            requestsResult.data
          )
            ? requestsResult.data
            : [];


        /*
          Evitamos mostrar como solicitud
          a una persona con la que ya existe match.
        */

        const matchUserIds =
          new Set(
            matches.map(
              (match) => {

                return (
                  match.user1_id === user.id
                    ? match.user2_id
                    : match.user1_id
                );

              }
            )
          );


        const requests =
          receivedLikes.filter(
            (item) => {

              return (
                item.user_id !== user.id &&
                !matchUserIds.has(
                  item.user_id
                )
              );

            }
          );


        const messagesElement =
          document.getElementById(
            "emimatch-messages-count"
          );

        const notificationsElement =
          document.getElementById(
            "emimatch-notifications-count"
          );

        const requestsElement =
          document.getElementById(
            "emimatch-requests-count"
          );


        if (messagesElement) {

          messagesElement.textContent =
            String(
              messagesCount
            );

        }


        if (notificationsElement) {

          notificationsElement.textContent =
            String(
              matches.length
            );

        }


        if (requestsElement) {

          requestsElement.textContent =
            String(
              requests.length
            );

        }


        await this.renderActivityNotifications(
          client,
          user.id,
          matches
        );


        await this.renderActivityRequests(
          client,
          user.id,
          requests
        );


        if (status) {

          status.textContent =
            "Actividad actualizada.";

          setTimeout(
            () => {

              if (status) {
                status.textContent =
                  "";
              }

            },
            1800
          );

        }

      } catch (error) {

        console.error(
          "EmiMatch Activity:",
          error
        );

        if (status) {

          status.textContent =
            "No pudimos actualizar la actividad.";

        }

      }

    },


    /* =================================================
       NOTIFICACIONES DE MATCH
    ================================================= */

    async renderActivityNotifications(
      client,
      currentUserId,
      matches
    ) {

      const list =
        document.getElementById(
          "emimatch-notifications-list"
        );

      if (!list) {
        return;
      }


      if (!matches.length) {

        list.innerHTML = `

          <div
            class="emimatch-activity-empty"
          >

            <span>
              ✨
            </span>

            <strong>
              No hay notificaciones nuevas
            </strong>

            <small>
              Cuando tengas un match aparecerá aquí.
            </small>

          </div>

        `;

        return;
      }


      const ids =
        [
          ...new Set(
            matches
              .map(
                (match) => {

                  return (
                    match.user1_id ===
                    currentUserId
                      ? match.user2_id
                      : match.user1_id
                  );

                }
              )
              .filter(Boolean)
          )
        ];


      const {
        data: profiles,
        error
      } =
        await client
          .from("profiles")
          .select(
            "id,nombre,foto_url"
          )
          .in(
            "id",
            ids
          );


      if (error) {
        throw error;
      }


      const profileMap =
        new Map(
          (
            profiles || []
          ).map(
            (profile) => {

              return [
                profile.id,
                profile
              ];

            }
          )
        );


      list.innerHTML =
        ids
          .map(
            (id) => {

              const profile =
                profileMap.get(id);


              const name =
                this.escapeHTML(
                  profile?.nombre ||
                  "Nuevo match"
                );


              const photo =
                profile?.foto_url
                  ? this.escapeHTML(
                      profile.foto_url
                    )
                  : "";


              return `

             
