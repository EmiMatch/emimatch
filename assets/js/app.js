/* =====================================================
   EmiMatch — Núcleo central de aplicación
   v1.0.0
===================================================== */

(() => {
  "use strict";

  const config = window.EMIMATCH_CONFIG;
     
   const analytics =
    window.EmiMatchAnalytics || null;

  if (!config) {
    console.error(
      "EmiMatch: config.js no fue cargado."
    );
    return;
  }

  window.EmiMatchApp.analytics

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
      return Boolean(
        config.appName &&
        config.supabaseUrl &&
        config.supabaseKey
      );
    },

    logUpdate(message) {
      console.info(
        "[EmiMatch " +
        config.version +
        "] " +
        message
      );
    }

  };

  window.EmiMatchApp.logUpdate(
    "Núcleo central cargado correctamente."
  );

})();
