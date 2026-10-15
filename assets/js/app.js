/* =====================================================
   EmiMatch — Núcleo central de aplicación
   v1.1.4
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
  const ANDROID_VERSION = "1.1.4";
  const VERSION_INFO_URL = "https://emimatch.github.io/emimatch/version.json";
  const DOWNLOAD_URL = "https://github.com/EmiMatch/emimatch/releases/latest/download/app-release.apk";

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

  function showUpdateNotice(latestVersion, releaseNotes) {
    if (document.getElementById("emimatch-update-notice")) return;

    const style = document.createElement("style");
    style.textContent = `
      #emimatch-update-notice{position:fixed;z-index:2147483647;left:16px;right:16px;bottom:calc(16px + env(safe-area-inset-bottom));max-width:520px;margin:0 auto;padding:18px;border:1px solid rgba(226,190,100,.55);border-radius:18px;background:#101010;color:#fff;box-shadow:0 18px 60px rgba(0,0,0,.55);font:14px/1.5 system-ui,sans-serif}
      #emimatch-update-notice strong{display:block;color:#f0d58a;font-size:16px;margin-bottom:5px}
      #emimatch-update-notice p{margin:0 0 13px;color:#e5e5e5}
      #emimatch-update-notice .em-update-actions{display:flex;gap:10px;align-items:center}
      #emimatch-update-notice a{display:inline-block;padding:10px 14px;border-radius:10px;background:#e4c477;color:#17130a;text-decoration:none;font-weight:700}
      #emimatch-update-notice button{padding:10px 12px;border:1px solid #555;border-radius:10px;background:transparent;color:#fff;font:inherit}
    `;
    const notice = document.createElement("section");
    notice.id = "emimatch-update-notice";
    notice.setAttribute("role", "status");
    notice.setAttribute("aria-live", "polite");

    const title = document.createElement("strong");
    title.textContent = "Hay una actualización de EmiMatch";
    const message = document.createElement("p");
    message.textContent = "Ya está disponible la versión " + latestVersion + ". " +
      (releaseNotes ? String(releaseNotes) + " " : "") +
      "Actualizá para disfrutar de las últimas mejoras.";
    const actions = document.createElement("div");
    actions.className = "em-update-actions";
    const link = document.createElement("a");
    link.href = DOWNLOAD_URL;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.textContent = "Descargar APK";
    const close = document.createElement("button");
    close.type = "button";
    close.textContent = "Más tarde";
    close.addEventListener("click", () => notice.remove());
    actions.append(link, close);
    notice.append(title, message, actions);
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
