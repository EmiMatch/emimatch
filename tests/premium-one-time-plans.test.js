const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");

const root = path.resolve(__dirname, "..");
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");
const migration = read("supabase/migrations/20261020013000_premium_one_time_plans.sql");
const webhook = read("supabase/functions/premium-webhook/index.ts");
const creator = read("supabase/functions/premium-one-time-create/index.ts");
const plansPage = read("membresia/planes-premium-propuesta.html");

const checks = [
  ["La activación atómica vive en el esquema privado", () =>
    assert.match(migration, /CREATE OR REPLACE FUNCTION private\.grant_one_time_premium_period/)],
  ["La implementación privilegiada fija un search_path seguro", () =>
    assert.match(migration, /SECURITY DEFINER\s+SET search_path = pg_catalog, pg_temp/)],
  ["El endpoint público usa SECURITY INVOKER", () =>
    assert.match(migration, /CREATE OR REPLACE FUNCTION public\.grant_one_time_premium_period[\s\S]*?SECURITY INVOKER/)],
  ["Solo service_role puede ejecutar el RPC público", () => {
    assert.match(migration, /REVOKE ALL ON FUNCTION public\.grant_one_time_premium_period[\s\S]*?FROM PUBLIC/);
    assert.match(migration, /REVOKE ALL ON FUNCTION public\.grant_one_time_premium_period[\s\S]*?FROM anon, authenticated/);
    assert.match(migration, /GRANT EXECUTE ON FUNCTION public\.grant_one_time_premium_period[\s\S]*?TO service_role/);
  }],
  ["La activación vuelve a validar importe y moneda", () => {
    assert.match(migration, /p_amount <> v_subscription\.purchase_amount/);
    assert.match(migration, /upper\(btrim\(p_currency\)\) <> upper\(btrim\(v_subscription\.purchase_currency\)\)/);
  }],
  ["La transacción bloquea compra, usuario y pago", () => {
    assert.match(migration, /FROM public\.premium_subscriptions[\s\S]*?FOR UPDATE/);
    assert.match(migration, /FROM auth\.users WHERE id = v_subscription\.user_id FOR UPDATE/);
    assert.match(migration, /FROM public\.premium_payments[\s\S]*?FOR UPDATE/);
  }],
  ["Una misma compra no concede dos períodos con pagos distintos", () => {
    assert.ok(migration.includes("purchase_already_granted_for_another_payment"));
    assert.match(migration, /subscription_id = v_subscription\.id[\s\S]*?id <> v_payment\.id[\s\S]*?premium_period_granted_at IS NOT NULL/);
  }],
  ["Un pago bloqueado no queda registrado como aprobado", () => {
    assert.match(migration, /p_provider_payment_id, p_amount, upper\(btrim\(p_currency\)\),\s*'pending'/);
    assert.match(migration, /UPDATE public\.premium_payments\s+SET status = 'approved'/);
  }],
  ["El pago solo concede el período una vez", () => {
    assert.match(migration, /premium_period_granted_at IS NOT NULL/);
    assert.match(migration, /SET premium_period_granted_at = now\(\)/);
  }],
  ["Una aprobación tardía no revierte un reembolso o rechazo", () => {
    assert.ok(migration.includes("payment_has_terminal_non_approved_status"));
    for (const status of ["refunded", "charged_back", "cancelled", "rejected"]) {
      assert.ok(migration.includes(`'${status}'`), `Falta proteger el estado ${status}`);
    }
  }],
  ["El webhook procesa la aprobación de pago único por el RPC atómico", () => {
    assert.match(webhook, /supabase\.rpc\(\s*"grant_one_time_premium_period"/);
    assert.ok(webhook.indexOf('if (isOneTimePurchase && status === "approved")') < webhook.indexOf('const { data: existingPayment'));
  }],
  ["El webhook no infiere ARS si falta la moneda", () =>
    assert.match(webhook, /actualCurrency = typeof payment\?\.currency_id === "string"[\s\S]*?\? payment\.currency_id\.trim\(\)[\s\S]*?: ""/)],
  ["authorized_payment no activa planes de pago único por el flujo recurrente", () => {
    assert.match(webhook, /localSubscription\.purchase_type === "one_time"[\s\S]*?one_time_requires_payment_event/);
  }],
  ["La creación de checkout valida usuario y lista de precios del servidor", () => {
    assert.match(creator, /auth\.getUser\(accessToken\)/);
    assert.match(creator, /month: \{ name: "EmiMatch Premium — 1 mes", amount: 4990, months: 1 \}/);
    assert.match(creator, /quarter: \{ name: "EmiMatch Premium — 3 meses", amount: 11990, months: 3 \}/);
    assert.match(creator, /half_year: \{ name: "EmiMatch Premium — 6 meses", amount: 19990, months: 6 \}/);
    assert.match(creator, /year: \{ name: "EmiMatch Premium — 12 meses", amount: 29990, months: 12 \}/);
  }],
  ["El modo de prueba exige webhook aislado y no puede notificar a producción", () => {
    assert.match(creator, /MERCADOPAGO_TEST_WEBHOOK_URL/);
    assert.match(creator, /parsed\.hostname === "kngiadwaesdbmvwivdev\.supabase\.co"/);
    assert.match(creator, /notification_url: webhookUrl/);
  }],
  ["La pantalla aclara que los planes son de pago único", () =>
    assert.match(plansPage, /pago único por 1 mes[\s\S]*?pago único por 3 meses[\s\S]*?pago único por 6 meses[\s\S]*?pago único por 12 meses/)],
];

let failed = 0;
console.log("\\n🛡️ PRUEBAS ESTÁTICAS DE PLANES PREMIUM DE PAGO ÚNICO");
for (const [name, run] of checks) {
  try {
    run();
    console.log(`✅ ${name}`);
  } catch (error) {
    failed += 1;
    console.error(`❌ ${name}`);
    console.error(error.message);
  }
}
console.log(`\\nResultado: ${checks.length - failed}/${checks.length} pruebas estáticas correctas.`);
if (failed > 0) process.exitCode = 1;
