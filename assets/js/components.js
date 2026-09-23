/* =====================================================
   EmiMatch — Componentes compartidos
   v1.1.1
   Centro de actividad
===================================================== */

(() => {
  "use strict";

  const app = window.EmiMatchApp;

  if (!app) {
    console.error(
      "EmiMatch: app.js no fue cargado."
    );
    return;
  }

  const Components = {

    /* =================================================
       NOTIFICACIONES
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

        background: rgba(15,23,42,.96);

        color: #ffffff;

        border: 1px solid rgba(255,255,255,.12);

        box-shadow:
          0 15px 40px rgba(0,0,0,.35);

        backdrop-filter: blur(16px);
        -webkit-backdrop-filter: blur(16px);

        font-family: Arial, sans-serif;
      `;

      document.body.appendChild(
        notification
      );

      window.setTimeout(() => {

        if (
          notification &&
          notification.parentNode
        ) {
          notification.remove();
        }

      }, Math.max(
        1000,
        Number(duration) || 3500
      ));
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
       ATAJOS DE MENSAJES
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

      if (
        options.className
      ) {

        element.className =
          options.className;

      }

      if (
        options.id
      ) {

        element.id =
          options.id;

      }

      if (
        options.text != null
      ) {

        element.textContent =
          options.text;

      }

      if (
        options.html != null
      ) {

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
      title =
        "Ocurrió un problema",

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

        if (
          !button.dataset.originalText
        ) {

          button.dataset.originalText =
            button.textContent;

        }

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
       ESTILOS BASE
    ================================================= */

    injectBaseStyles() {

      if (
        document.getElementById(
          "emimatch-components-base-style"
        )
      ) {

        return;
      }

      const style =
        document.createElement("style");

      style.id =
        "emimatch-components-base-style";

      style.textContent = `

        .emimatch-notification-content {

          display: flex;

          align-items: center;

          gap: 10px;

        }

        .emimatch-notification-icon {

          font-size: 18px;

          flex: 0 0 auto;

        }

        .emimatch-notification-message {

          font-size: 14px;

          line-height: 1.4;

        }

      `;

      document.head.appendChild(
        style
      );
    },


    /*
     =================================================
       ESTILOS CENTRO DE ACTIVIDAD
    ================================================= */

    injectActivityStyles() {

      if (
        document.getElementById(
          "emimatch-activity-style"
        )
      ) {

        return;
      }

      const style =
        document.createElement("style");

      style.id =
        "emimatch-activity-style";

      style.textContent = `

        #emimatch-activity-center {

          width:
            min(100%, 980px);

          margin:
            0 auto 28px;

          padding:
            20px;

          border:
            1px solid rgba(
              255,
              255,
              255,
              .11
            );

          border-radius:
            24px;

          background:
            linear-gradient(
              145deg,
              rgba(
                255,
                255,
                255,
                .075
              ),
              rgba(
                255,
                255,
                255,
                .035
              )
            );

          box-shadow:
            0 18px 50px
            rgba(
              0,
              0,
              0,
              .20
            );

          backdrop-filter:
            blur(18px);

          -webkit-backdrop-filter:
            blur(18px);

        }


        .emimatch-activity-head {

          display:
            flex;

          justify-content:
            space-between;

          align-items:
            flex-start;

          gap:
            16px;

          margin-bottom:
            16px;

        }


        .emimatch-activity-kicker {

          display:
            block;

          color:
            #d9b86c;

          font-size:
            12px;

          font-weight:
            700;

          text-transform:
            uppercase;

          letter-spacing:
            .14em;

          margin-bottom:
            5px;

        }


        .emimatch-activity-head h2 {

          margin:
            0;

          color:
            #ffffff;

          font-size:
            24px;

        }


        .emimatch-activity-head p {

          margin:
            6px 0 0;

          color:
            #b9bdd1;

          font-size:
            14px;

          line-height:
            1.5;

        }


        .emimatch-activity-refresh {

          width:
            44px;

          height:
            44px;

          flex:
            0 0 44px;

          border:
            1px solid
            rgba(
              217,
              184,
              108,
              .28
            );

          border-radius:
            14px;

          background:
            rgba(
              217,
              184,
              108,
              .08
            );

          color:
            #f1d99a;

          font-size:
            25px;

          cursor:
            pointer;

        }


        .emimatch-activity-grid {

          display:
            grid;

          grid-template-columns:
            repeat(
              3,
              minmax(
                0,
                1fr
              )
            );

          gap:
            12px;

        }


        .emimatch-activity-card {

          min-width:
            0;

          display:
            flex;

          align-items:
            center;

          gap:
            12px;

          padding:
            15px;

          border:
            1px solid
            rgba(
              255,
              255,
              255,
              .10
            );

          border-radius:
            18px;

          background:
            rgba(
              7,
              12,
              32,
              .34
            );

          color:
            #ffffff;

          text-decoration:
            none;

          text-align:
            left;

          cursor:
            pointer;

          font: inherit;

        }


        .emimatch-activity-card:hover {

          border-color:
            rgba(
              217,
              184,
              108,
              .34
            );

        }


        .emimatch-activity-icon {

          font-size:
            23px;

          flex:
            0 0 auto;

        }


        .emimatch-activity-copy {

          display:
            flex;

          flex-direction:
            column;

          min-width:
            0;

          flex:
            1;

        }


        .emimatch-activity-copy strong {

          font-size:
            15px;

        }


        .emimatch-activity-copy small {

          margin-top:
            3px;

          color:
            #aeb3c8;

          font-size:
            12px;

          line-height:
            1.35;

        }


        .emimatch-activity-count {

          min-width:
            28px;

          height:
            28px;

          padding:
            0 8px;

          display:
            grid;

          place-items:
            center;

          border-radius:
            999px;

          background:
            rgba(
              217,
              184,
              108,
              .14
            );

          color:
            #f1d99a;

          font-weight:
            700;

        }


        .emimatch-activity-panel {

          margin-top:
            12px;

          padding:
            16px;

          border:
            1px solid
            rgba(
              255,
              255,
              255,
              .09
            );

          border-radius:
            18px;

          background:
            rgba(
              4,
              8,
              24,
              .32
            );

        }


        .emimatch-activity-panel-title {

          font-weight:
            700;

          margin-bottom:
            12px;

          color:
            #f1d99a;

        }


        .emimatch-activity-empty {

          text-align:
            center;

          padding:
            18px;

          color:
            #b9bdd1;

        }


        .emimatch-activity-empty span {

          display:
            block;

          font-size:
            28px;

          margin-bottom:
            7px;

        }


        .emimatch-activity-empty strong {

          display:
            block;

          color:
            #ffffff;

        }


        .emimatch-activity-empty small {

          display:
            block;

          margin-top:
            5px;

        }


        .emimatch-activity-item {

          display:
            flex;

          align-items:
            center;

          gap:
            12px;

          padding:
            11px 0;

          border-bottom:
            1px solid
            rgba(
              255,
              255,
              255,
              .07
            );

        }


        .emimatch-activity-item:last-child {

          border-bottom:
            0;

        }


        .emimatch-activity-avatar {

          width:
            46px;

          height:
            46px;

          flex:
            0 0 46px;

          border-radius:
            50%;

          object-fit:
            cover;

          background:
            #1b2242;

        }


        .emimatch-activity-item-copy {

          min-width:
            0;

          flex:
            1;

        }


        .emimatch-activity-item-copy strong {

          display:
            block;

          color:
            #ffffff;

        }


        .emimatch-activity-item-copy small {

          display:
            block;

          color:
            #aeb3c8;

          margin-top:
            3px;

        }


        .emimatch-activity-profile {

          color:
            #f1d99a;

          text-decoration:
            none;

          font-size:
            13px;

          font-weight:
            700;

          white-space:
            nowrap;

        }


        .emimatch-activity-status {

          margin-top:
            8px;

          color:
            #8fd5b1;

          font-size:
            12px;

          min-height:
            16px;

        }


        @media (
          max-width: 700px
        ) {

          #emimatch-activity-center {

            padding:
              15px;

            border-radius:
              20px;

          }


          .emimatch-activity-head h2 {

            font-size:
              20px;

          }


          .emimatch-activity-grid {

            grid-template-columns:
              1fr;

          }


          .emimatch-activity-card {

            padding:
              14px;

          }


          .emimatch-activity-item {

            align-items:
              flex-start;

          }


          .emimatch-activity-profile {

            font-size:
              12px;

          }

        }

      `;

      document.head.appendChild(
        style
      );
    },


    /*
     =================================================
       CREAR CENTRO DE ACTIVIDAD
    ================================================= */

    initActivityCenter() {

      if (
        document.getElementById(
          "emimatch-activity-center"
        )
      ) {

        return;
      }

      const main =
        document.querySelector("main");

      if (!main) {

        console.warn(
          "EmiMatch: no se encontró <main> para el Centro de actividad."
        );

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


        <div class="emimatch-activity-grid">

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

      main.prepend(center);


      /*
       =================================================
         ABRIR / CERRAR PANELES
      ================================================= */

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

                item.hidden =
                  true;

              }
            );

          panel.hidden =
            !shouldOpen;
        };


      const notificationsButton =
        document.getElementById(
          "emimatch-notifications-button"
        );

      if (
        notificationsButton
      ) {

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

      if (
        requestsButton
      ) {

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

      if (
        refreshButton
      ) {

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
        !config.supabaseUrl ||
        !config.supabaseKey ||
        !window.supabase
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
                  count:
                    "exact",
                  head:
                    true
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
                  ascending:
                    false
                }
              )
              .limit(20)

          ]);


        if (
          messagesResult.error
        ) {

          throw messagesResult.error;

        }


        if (
          matchesResult.error
        ) {

          throw matchesResult.error;

        }


        if (
          requestsResult.error
        ) {

          throw requestsResult.error;

        }


        const messagesCount =
          Number(
            messagesResult.count ||
            0
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


        const matchUserIds =
          new Set(

            matches.map(
              (match) => {

                return (
                  match.user1_id ===
                  user.id

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

                item.user_id !==
                  user.id

                &&

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


        if (
          messagesElement
        ) {

          messagesElement.textContent =
            String(
              messagesCount
            );

        }


        if (
          notificationsElement
        ) {

          notificationsElement.textContent =
            String(
              matches.length
            );

        }


        if (
          requestsElement
        ) {

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

          window.setTimeout(
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
       RENDER NOTIFICACIONES
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
                profileMap.get(id) ||
                {};

              const name =
                this.escapeHTML(
                  profile.nombre ||
                  "Nuevo match"
                );


              const photo =
                profile.foto_url
                  ? this.escapeHTML(
                      profile.foto_url
                    )
                  : "";


              return `

                <div
                  class="emimatch-activity-item"
                >

                  ${
                    photo

                      ? `

                        <img
                          class="emimatch-activity-avatar"
                          src="${photo}"
                          alt=""
                        >

                      `

                      : `

                        <div
                          class="emimatch-activity-avatar"
                          aria-hidden="true"
                        ></div>

                      `
                  }


                  <div
                    class="emimatch-activity-item-copy"
                  >

                    <strong>
                      💕 Match con ${name}
                    </strong>

                    <small>
                      Ya pueden continuar la conversación.
                    </small>

                  </div>


                  <a
                    class="emimatch-activity-profile"
                    href="perfil-usuario.html?user=${encodeURIComponent(id)}"
                  >
                    Ver perfil
                  </a>

                </div>

              `;

            }
          )
          .join("");

    },


    /*
     =================================================
       RENDER SOLICITUDES
    ================================================= */

    async renderActivityRequests(
      client,
      currentUserId,
      requests
    ) {

      const list =
        document.getElementById(
          "emimatch-requests-list"
        );

      if (!list) {
        return;
      }


      if (!requests.length) {

        list.innerHTML = `

          <div
            class="emimatch-activity-empty"
          >

            <span>
              💫
            </span>

            <strong>
              No tenés solicitudes pendientes
            </strong>

            <small>
              Cuando alguien indique interés aparecerá aquí.
            </small>

          </div>

        `;

        return;
      }


      const ids =
        [
          ...new Set(

            requests
              .map(
                (item) =>
                  item.user_id
              )
              .filter(
                (id) =>
                  id &&
                  id !== currentUserId
              )

          )
        ];


      const {
        data: profiles,
        error
      } =
        await client
          .from("profiles")
          .select(
            "id,nombre,edad,ciudad,foto_url"
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
                profileMap.get(id) ||
                {};


              const name =
                this.escapeHTML(
                  profile.nombre ||
                  "Usuario"
                );


              const details =
                [

                  profile.edad
                    ? (
                        String(
                          profile.edad
                        ) +
                        " años"
                      )
                    : "",

                  profile.ciudad
                    ? this.escapeHTML(
                        profile.ciudad
                      )
                    : ""

                ]
                  .filter(Boolean)
                  .join(" · ");


              const photo =
                profile.foto_url
                  ? this.escapeHTML(
                      profile.foto_url
                    )
                  : "";


              return `

                <div
                  class="emimatch-activity-item"
                >

                  ${
                    photo

                      ? `

                        <img
                          class="emimatch-activity-avatar"
                          src="${photo}"
                          alt=""
                        >

                      `

                      : `

                        <div
                          class="emimatch-activity-avatar"
                          aria-hidden="true"
                        ></div>

                      `
                  }


                  <div
                    class="emimatch-activity-item-copy"
                  >

                    <strong>
                      ${name}
                    </strong>

                    <small>
                      ${
                        details ||
                        "Indicó interés en tu perfil."
                      }
                    </small>

                  </div>


                  <a
                    class="emimatch-activity-profile"
                    href="perfil-usuario.html?user=${encodeURIComponent(id)}"
                  >
                    Ver perfil
                  </a>

                </div>

              `;

            }
          )
          .join("");

    }

  };


  /* =================================================
     REGISTRO GLOBAL
  ================================================= */

  window.EmiMatchComponents =
    Object.freeze(
      Components
    );


  /* =================================================
     INICIALIZACIÓN
  ================================================= */

  Components.injectBaseStyles();

  Components.injectActivityStyles();


  const start =
    () => {

      Components.initActivityCenter();

    };


  if (
    document.readyState ===
    "loading"
  ) {

    document.addEventListener(
      "DOMContentLoaded",
      start,
      {
        once: true
      }
    );

  } else {

    start();

  }


  app.logUpdate(
    "Componentes compartidos y Centro de actividad cargados correctamente."
  );

})();
