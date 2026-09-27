/* =====================================================
   EmiMatch — Configuración central
   ===================================================== */

window.EMIMATCH_CONFIG = Object.freeze({
  appName: "EmiMatch",
  version: "1.0.1",

  supabaseUrl:
    "https://kngiadwaesdbmvwivdev.supabase.co",

  supabaseAnonKey:
    "sb_publishable_TSCAMZ4gmB0mHF10DULT3Q_y25xBw1m",

  /*
   * Compatibilidad:
   * Algunos archivos antiguos de EmiMatch utilizan
   * supabaseKey en lugar de supabaseAnonKey.
   *
   * Mantenemos ambas propiedades apuntando a la misma
   * clave pública para evitar que una página quede
   * inutilizada.
   */
  supabaseKey:
    "sb_publishable_TSCAMZ4gmB0mHF10DULT3Q_y25xBw1m"
});
