/* =====================================================
   EmiMatch — Analytics central
   v1.0.0
   Estado: preparado, desactivado hasta configurar proveedor.
===================================================== */

(() => {
  "use strict";

  const app = window.EmiMatchApp;

  const analytics = {
    enabled: false,
    provider: null,

    isEnabled() {
      return this.enabled;
    },

    track(eventName) {
      if (!this.enabled || !eventName) return;

      try {
        if (
          this.provider === "plausible" &&
          typeof window.plausible === "function"
        ) {
          window.plausible(eventName);
        }
      } catch (error) {
        console.error(
          "EmiMatch Analytics:",
          error
        );
      }
    },

    trackPage() {
      this.track("Pageview");
    },

    trackSignup() {
      this.track("Signup");
    },

    trackProfileCompleted() {
      this.track("Profile Completed");
    },

    trackDiscovery() {
      this.track("Discovery");
    },

    trackLike() {
      this.track("Like");
    },

    trackMatch() {
      this.track("Match");
    },

    trackChatOpened() {
      this.track("Chat Opened");
    },

    trackPhotoUploaded() {
      this.track("Photo Uploaded");
    },

    trackError() {
      this.track("App Error");
    }
  };

  window.EmiMatchAnalytics =
    Object.freeze(analytics);

  if (
    app &&
    typeof app.logUpdate === "function"
  ) {
    app.logUpdate(
      "Módulo de Analytics preparado y desactivado."
    );
  }

})();
