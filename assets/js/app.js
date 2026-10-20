/* =====================================================
   EmiMatch — Núcleo central de aplicación
   v1.1.7
===================================================== */

(() => {
  "use strict";

  const config = window.EMIMATCH_CONFIG;

  if (!config) {
    console.error("EmiMatch: config.js no fue cargado.");
    return;
  }

  window.EmiMatchApp = {
    config,
    getVersion() {
      return config.version;
    },
    getSupabaseConfig() {
      return {
        url: config.supabaseUrl,
        key: config.supabaseKey
      };
    },
    isReady() {
      return Boolean(config.appName && config.supabaseUrl && config.supabaseKey);
    },
    logUpdate(message) {
      console.info("[EmiMatch " + config.version + "] " + message);
    }
  };

  window.EmiMatchApp.logUpdate("Núcleo central cargado correctamente.");

  // Aviso de nuevas versiones para la app Android. No interfiere con el sitio web.
  const ANDROID_VERSION = "1.1.7";
  const VERSION_INFO_URL = "https://emimatch.github.io/emimatch/version.json";

  function compareVersions(current, latest) {
    const a = String(current).split(".").map(Number);
    const b = String(latest).split(".").map(Number);
    for (let i = 0; i < Math.max(a.length, b.length); i++) {
      const left = a[i] || 0;
      const right = b[i] || 0;
      if (right > left) return -1;
      if (right < left) return 1;
    }
    return 0;
  }

  let updateMessageElement = null;
  let updateProgressBar = null;
  let updateButton = null;

  // El puente nativo descarga el APK dentro de la app y luego invoca el instalador de Android.
  window.EmiMatchUpdateProgress = function (percent, message) {
    if (!updateMessageElement) return;
    updateMessageElement.textContent = String(message || "");
    if (percent >= 0 && updateProgressBar) {
      updateProgressBar.style.width = Math.max(0, Math.min(100, percent)) + "%";
      updateProgressBar.parentElement.hidden = false;
    }
    if (percent < 0 && updateButton) {
      updateButton.disabled = false;
      updateButton.textContent = "Reintentar";
    } else if (percent >= 0 && updateButton) {
      updateButton.disabled = true;
      updateButton.textContent = percent >= 100 ? "Preparando instalación…" : "Descargando…";
    }
  };

  function showUpdateNotice(latestVersion, releaseNotes) {
    if (document.getElementById("emimatch-update-notice")) return;

    const style = document.createElement("style");
    style.textContent = `
      #emimatch-update-notice{position:fixed;z-index:2147483647;left:16px;right:16px;bottom:calc(16px + env(safe-area-inset-bottom));max-width:520px;margin:0 auto;padding:18px;border:1px solid rgba(226,190,100,.55);border-radius:18px;background:#101010;color:#fff;box-shadow:0 18px 60px rgba(0,0,0,.55);font:14px/1.5 system-ui,sans-serif}
      #emimatch-update-notice strong{display:block;color:#f0d58a;font-size:16px;margin-bottom:5px}
      #emimatch-update-notice p{margin:0 0 13px;color:#e5e5e5}
      #emimatch-update-notice .em-update-actions{display:flex;gap:10px;align-items:center}
      #emimatch-update-notice button{padding:10px 14px;border:1px solid #555;border-radius:10px;background:transparent;color:#fff;font:inherit}
      #emimatch-update-notice button.em-update-primary{background:#e4c477;color:#17130a;border-color:#e4c477;font-weight:700}
      #emimatch-update-notice .em-update-progress{height:6px;border-radius:999px;background:#383838;overflow:hidden;margin:10px 0 14px}
      #emimatch-update-notice .em-update-progress[hidden]{display:none}
      #emimatch-update-notice .em-update-progress span{display:block;height:100%;width:0;background:#e4c477;transition:width .2s}
    `;
    const notice = document.createElement("section");
    notice.id = "emimatch-update-notice";
    notice.setAttribute("role", "status");
    notice.setAttribute("aria-live", "polite");

    const title = document.createElement("strong");
    title.textContent = "Actualización disponible";
    const message = document.createElement("p");
    message.textContent = "Ya está disponible EmiMatch " + latestVersion + ". " +
      (releaseNotes ? String(releaseNotes) + " " : "") +
      "La descarga se realizará dentro de la aplicación.";
    const progressContainer = document.createElement("div");
    progressContainer.className = "em-update-progress";
    progressContainer.hidden = true;
    const progressBar = document.createElement("span");
    progressContainer.appendChild(progressBar);

    const actions = document.createElement("div");
    actions.className = "em-update-actions";
    const update = document.createElement("button");
    update.type = "button";
    update.className = "em-update-primary";
    update.textContent = "Actualizar ahora";
    const close = document.createElement("button");
    close.type = "button";
    close.textContent = "Más tarde";
    close.addEventListener("click", () => notice.remove());
    update.addEventListener("click", () => {
      if (window.EmiMatchUpdater &&
          typeof window.EmiMatchUpdater.downloadAndInstall === "function") {
        update.disabled = true;
        update.textContent = "Preparando…";
        message.textContent = "Preparando la descarga segura del APK…";
        window.EmiMatchUpdater.downloadAndInstall();
      } else {
        message.textContent = "Esta instalación no tiene habilitada la actualización integrada. Volvé a abrir EmiMatch y probá nuevamente.";
        update.disabled = false;
      }
    });

    updateMessageElement = message;
    updateProgressBar = progressBar;
    updateButton = update;
    actions.append(update, close);
    notice.append(title, message, progressContainer, actions);
    document.head.appendChild(style);
    document.body.appendChild(notice);
  }

  async function checkAndroidUpdate() {
    // La comprobación se limita al APK Android; no muestra avisos en la web.
    const capacitor = window.Capacitor;
    if (!capacitor || typeof capacitor.getPlatform !== "function" ||
        capacitor.getPlatform() !== "android") return;

    try {
      const response = await fetch(VERSION_INFO_URL + "?t=" + Date.now(), {
        cache: "no-store",
        headers: { "Accept": "application/json" }
      });
      if (!response.ok) return;
      const info = await response.json();
      if (!info || typeof info.latestVersion !== "string") return;
      if (compareVersions(ANDROID_VERSION, info.latestVersion) < 0) {
        showUpdateNotice(info.latestVersion, info.releaseNotes || "");
      }
    } catch (error) {
      // La app sigue funcionando con normalidad si no hay conexión.
      console.info("[EmiMatch] No se pudo comprobar si hay actualizaciones.");
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", checkAndroidUpdate, { once: true });
  } else {
    checkAndroidUpdate();
  }
})();
