import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const MERCADOPAGO_ACCESS_TOKEN = Deno.env.get("MERCADOPAGO_ACCESS_TOKEN") ?? "";
const MERCADOPAGO_TEST_MODE = (
  Deno.env.get("MERCADOPAGO_TEST_MODE") ??
  Deno.env.get("TEST_MODE") ??
  "false"
).trim().toLowerCase() === "true";
const MERCADOPAGO_TEST_PAYER_EMAIL =
  Deno.env.get("MERCADOPAGO_TEST_PAYER_EMAIL") ??
  Deno.env.get("TEST_PAYER_EMAIL") ??
  "";

const MEMBERSHIP_URL = "https://emimatch.github.io/emimatch/membresia/membresia.html";
const PRODUCTION_WEBHOOK_URL = "https://kngiadwaesdbmvwivdev.supabase.co/functions/v1/premium-webhook";

function resolveWebhookUrl(): string {
  if (MERCADOPAGO_TEST_MODE) {
    // Test purchases must write only to an isolated Supabase project too.
    // An isolated webhook alone is not enough: otherwise test rows would be
    // created in production and the isolated webhook could not find them.
    let supabaseProjectUrl: URL;
    try {
      supabaseProjectUrl = new URL(SUPABASE_URL);
    } catch {
      throw new Error("El modo de prueba requiere la URL HTTPS de un proyecto Supabase aislado. No se usará producción.");
    }
    if (
      supabaseProjectUrl.protocol !== "https:" ||
      supabaseProjectUrl.hostname === "kngiadwaesdbmvwivdev.supabase.co"
    ) {
      throw new Error("El modo de prueba requiere un proyecto Supabase aislado, distinto de producción.");
    }

    const testWebhookUrl = (Deno.env.get("MERCADOPAGO_TEST_WEBHOOK_URL") ?? "").trim();
    let parsed: URL;
    try {
      parsed = new URL(testWebhookUrl);
    } catch {
      throw new Error("El modo de prueba requiere MERCADOPAGO_TEST_WEBHOOK_URL de un entorno aislado. No se usará el webhook de producción.");
    }
    if (
      parsed.protocol !== "https:" ||
      parsed.hostname === "kngiadwaesdbmvwivdev.supabase.co" ||
      parsed.hostname !== supabaseProjectUrl.hostname
    ) {
      throw new Error("El modo de prueba requiere un webhook HTTPS del mismo proyecto Supabase aislado, distinto de producción.");
    }
    return parsed.toString();
  }

  const configuredUrl = (Deno.env.get("MERCADOPAGO_WEBHOOK_URL") ?? "").trim();
  return configuredUrl || PRODUCTION_WEBHOOK_URL;
}

const PLANS: Record<string, { name: string; amount: number; months: number }> = {
  month: { name: "EmiMatch Premium — 1 mes", amount: 4990, months: 1 },
  quarter: { name: "EmiMatch Premium — 3 meses", amount: 11990, months: 3 },
  half_year: { name: "EmiMatch Premium — 6 meses", amount: 19990, months: 6 },
  year: { name: "EmiMatch Premium — 12 meses", amount: 29990, months: 12 },
};

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function mpRequest(path: string, options: RequestInit = {}) {
  const res = await fetch(`https://api.mercadopago.com${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${MERCADOPAGO_ACCESS_TOKEN}`,
      "Content-Type": "application/json",
      ...(options.headers ?? {}),
    },
  });
  const raw = await res.text();
  let data: any = {};
  try { data = raw ? JSON.parse(raw) : {}; } catch { data = { raw }; }
  if (!res.ok) {
    console.error("Mercado Pago preference error:", res.status, data);
    throw new Error(data?.message ?? data?.error ?? `Mercado Pago respondió HTTP ${res.status}.`);
  }
  return data;
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: corsHeaders });
  }
  if (request.method !== "POST") {
    return jsonResponse({ success: false, error: "Método no permitido." }, 405);
  }

  try {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !MERCADOPAGO_ACCESS_TOKEN) {
      throw new Error("Falta configuración de Supabase o Mercado Pago.");
    }

    const webhookUrl = resolveWebhookUrl();

    const authorization = request.headers.get("Authorization") ?? "";
    const accessToken = authorization.replace(/^Bearer\s+/i, "").trim();
    if (!accessToken) {
      return jsonResponse({ success: false, error: "Necesitás iniciar sesión en EmiMatch." }, 401);
    }

    const userClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      global: { headers: { Authorization: `Bearer ${accessToken}` } },
    });
    const { data: userData, error: userError } = await userClient.auth.getUser(accessToken);
    if (userError || !userData?.user) {
      return jsonResponse({ success: false, error: "Sesión inválida o vencida. Iniciá sesión nuevamente." }, 401);
    }
    const user = userData.user;

    const { data: adminRecord, error: adminError } = await supabase
      .from("admin_users").select("user_id").eq("user_id", user.id).maybeSingle();
    if (adminError) throw new Error("No se pudo verificar el permiso de administrador.");
    if (adminRecord) {
      return jsonResponse({
        success: true, already_active: true, admin_premium: true, status: "active",
        message: "Tu cuenta de administrador tiene Premium permanente sin costo.",
      });
    }

    let body: any = {};
    try { body = await request.json(); } catch {
      return jsonResponse({ success: false, error: "Solicitud inválida." }, 400);
    }
    const planKey = typeof body?.plan_key === "string" ? body.plan_key : "";
    const selectedPlan = PLANS[planKey];
    if (!selectedPlan) {
      return jsonResponse({ success: false, error: "Elegí uno de los planes Premium disponibles." }, 400);
    }

    const userEmail = user.email?.trim() ?? "";
    if (!userEmail) {
      return jsonResponse({ success: false, error: "La cuenta no tiene un correo electrónico válido." }, 400);
    }

    const { data: plan, error: planError } = await supabase
      .from("premium_plans").select("id").eq("name", "EmiMatch Premium")
      .eq("active", true).order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (planError) throw new Error("No se pudo consultar el plan Premium.");
    if (!plan) return jsonResponse({ success: false, error: "No existe un plan Premium activo." }, 404);

    const payerEmail = MERCADOPAGO_TEST_MODE
      ? MERCADOPAGO_TEST_PAYER_EMAIL.trim()
      : userEmail;
    if (MERCADOPAGO_TEST_MODE && (!payerEmail || payerEmail === "disabled")) {
      throw new Error("El modo de prueba está activo pero falta configurar el comprador de prueba.");
    }

    const { data: localPurchase, error: purchaseError } = await supabase
      .from("premium_subscriptions")
      .insert({
        user_id: user.id,
        plan_id: plan.id,
        provider: "mercadopago",
        status: "pending",
        purchase_type: "one_time",
        duration_months: selectedPlan.months,
        purchase_amount: selectedPlan.amount,
        purchase_currency: "ARS",
      })
      .select("id")
      .single();
    if (purchaseError || !localPurchase) {
      console.error("No se pudo guardar la compra local:", purchaseError);
      throw new Error("No se pudo preparar la compra Premium.");
    }

    let preference: any;
    try {
      preference = await mpRequest("/checkout/preferences", {
        method: "POST",
        body: JSON.stringify({
        items: [{
          id: `emimatch-premium-${selectedPlan.months}m`,
          title: selectedPlan.name,
          description: `Membresía EmiMatch Premium por ${selectedPlan.months} mes(es). Pago único, sin renovación automática.`,
          quantity: 1,
          currency_id: "ARS",
          unit_price: selectedPlan.amount,
        }],
        payer: { email: payerEmail },
        external_reference: localPurchase.id,
        notification_url: webhookUrl,
        back_urls: {
          success: `${MEMBERSHIP_URL}?premium=success`,
          pending: `${MEMBERSHIP_URL}?premium=pending`,
          failure: `${MEMBERSHIP_URL}?premium=failure`,
        },
        auto_return: "approved",
        metadata: {
          user_id: user.id,
          purchase_type: "one_time",
          duration_months: selectedPlan.months,
          plan_key: planKey,
        },
        statement_descriptor: "EMIMATCH",
        }),
      });
    } catch (preferenceError) {
      await supabase.from("premium_subscriptions").update({
        status: "cancelled",
        cancelled_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }).eq("id", localPurchase.id);
      throw preferenceError;
    }

    const checkoutUrl = MERCADOPAGO_TEST_MODE
      ? preference?.sandbox_init_point
      : preference?.init_point;
    if (typeof checkoutUrl !== "string" || !checkoutUrl.startsWith("https://")) {
      await supabase.from("premium_subscriptions").update({
        status: "cancelled", cancelled_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }).eq("id", localPurchase.id);
      throw new Error(`Mercado Pago no devolvió un enlace válido para el entorno ${MERCADOPAGO_TEST_MODE ? "de prueba" : "de producción"}. No se realizó ningún cobro.`);
    }

    const { error: updateError } = await supabase.from("premium_subscriptions")
      .update({ provider: "mercadopago", updated_at: new Date().toISOString() })
      .eq("id", localPurchase.id);
    if (updateError) throw new Error("Se creó el checkout, pero no se pudo actualizar la compra local.");

    const { error: eventError } = await supabase.from("premium_events").insert({
      user_id: user.id,
      subscription_id: localPurchase.id,
      event_type: "premium_one_time_checkout_created",
      provider: "mercadopago",
      provider_event_id: `one-time-checkout-${localPurchase.id}`,
      metadata: {
        purchase_type: "one_time",
        duration_months: selectedPlan.months,
        amount: selectedPlan.amount,
        currency: "ARS",
        test_mode: MERCADOPAGO_TEST_MODE,
        preference_id: preference?.id ?? null,
      },
    });
    if (eventError) console.warn("No se pudo registrar el evento de creación:", eventError);

    return jsonResponse({
      success: true,
      purchase_id: localPurchase.id,
      checkout_url: checkoutUrl,
      checkout_mode: MERCADOPAGO_TEST_MODE ? "test" : "production",
      duration_months: selectedPlan.months,
      amount: selectedPlan.amount,
      currency: "ARS",
      message: "Checkout de pago único preparado. Premium se activa solo cuando el webhook confirma el pago.",
    });
  } catch (error) {
    console.error("premium-one-time-create:", error);
    return jsonResponse({
      success: false,
      error: error instanceof Error ? error.message : "Error interno.",
    }, 500);
  }
});
