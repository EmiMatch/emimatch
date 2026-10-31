/* =====================================================
   EmiMatch — Núcleo central de aplicación
   v1.1.8
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

  // Las actualizaciones de la versión publicada en Google Play se gestionan desde Play Store.
})();
