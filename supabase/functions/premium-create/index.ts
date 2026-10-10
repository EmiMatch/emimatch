import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
"Access-Control-Allow-Origin": "*",
"Access-Control-Allow-Headers":
"authorization, x-client-info, apikey, content-type",
"Access-Control-Allow-Methods":
"POST, OPTIONS",
};

const SUPABASE_URL =
Deno.env.get("SUPABASE_URL") ?? "";

const SUPABASE_SERVICE_ROLE_KEY =
Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const MERCADOPAGO_ACCESS_TOKEN =
Deno.env.get("MERCADOPAGO_ACCESS_TOKEN") ?? "";

const MERCADOPAGO_TEST_MODE =
(
Deno.env.get("MERCADOPAGO_TEST_MODE") ?? "false"
).toLowerCase() === "true";

const MERCADOPAGO_TEST_PAYER_EMAIL =
Deno.env.get("MERCADOPAGO_TEST_PAYER_EMAIL") ?? "";

const BACK_URL =
"https://emimatch.github.io/emimatch/membresia/membresia.html";

const WEBHOOK_URL =
"https://kngiadwaesdbmvwivdev.supabase.co/functions/v1/premium-webhook";

const supabase = createClient(
SUPABASE_URL,
SUPABASE_SERVICE_ROLE_KEY,
);

function jsonResponse(
body: Record<string, unknown>,
status = 200,
) {
return new Response(
JSON.stringify(body),
{
status,
headers: {
...corsHeaders,
"Content-Type": "application/json",
},
},
);
}

async function mercadoPagoRequest(
path: string,
options: RequestInit = {},
) {
const response = await fetch(
`https://api.mercadopago.com${path}`,
{
...options,
headers: {
"Authorization":
`Bearer ${MERCADOPAGO_ACCESS_TOKEN}`,
"Content-Type":
"application/json",
...(options.headers ?? {}),
},
},
);

const text =
await response.text();

let data: any = null;

if (text.trim()) {
try {
data = JSON.parse(text);
} catch {
data = {
raw: text,
};
}
}

if (!response.ok) {
console.error(
"Mercado Pago error:",
response.status,
data,
);

throw new Error(
data?.message ??
data?.error ??
`Mercado Pago respondió HTTP ${response.status}.`,
);
}

return data;
}

Deno.serve(async (request) => {
if (request.method === "OPTIONS") {
return new Response(
"ok",
{
status: 200,
headers: corsHeaders,
},
);
}

if (request.method !== "POST") {
return jsonResponse(
{
success: false,
error:
"Método no permitido.",
},
405,
);
}

try {
if (!SUPABASE_URL) {
throw new Error(
"Falta SUPABASE_URL.",
);
}

if (!SUPABASE_SERVICE_ROLE_KEY) {
throw new Error(
"Falta SUPABASE_SERVICE_ROLE_KEY.",
);
}

if (!MERCADOPAGO_ACCESS_TOKEN) {
throw new Error(
"Falta MERCADOPAGO_ACCESS_TOKEN.",
);
}

const authorization =
request.headers.get(
"Authorization",
);

if (!authorization) {
return jsonResponse(
{
success: false,
error:
"Falta autorización.",
},
401,
);
}

const accessToken =
authorization.replace(
/^Bearer\s+/i,
"",
).trim();

if (!accessToken) {
return jsonResponse(
{
success: false,
error:
"Token de sesión inválido.",
},
401,
);
}

/*
* Cliente Supabase con el token
* del usuario para validar su sesión.
*/
const userClient =
createClient(
SUPABASE_URL,
SUPABASE_SERVICE_ROLE_KEY,
{
global: {
headers: {
Authorization:
`Bearer ${accessToken}`,
},
},
},
);

const {
data: userData,
error: userError,
} =
await userClient.auth.getUser(
accessToken,
);

if (
userError ||
!userData?.user
) {
console.error(
"Auth error:",
userError,
);

return jsonResponse(
{
success: false,
error:
"Sesión de usuario inválida o vencida.",
},
401,
);
}

const user =
userData.user;

const userId =
user.id;

/*
* Buscar el email real del usuario.
*/
const userEmail =
user.email?.trim() ?? "";

if (!userEmail) {
return jsonResponse(
{
success: false,
error:
"La cuenta no tiene un correo electrónico válido.",
},
400,
);
}

/*
* Buscar el plan Premium activo.
*/
const {
data: plan,
error: planError,
} =
await supabase
.from("premium_plans")
.select("*")
.eq(
"name",
"EmiMatch Premium",
)
.eq(
"active",
true,
)
.order(
"created_at",
{
ascending: false,
},
)
.limit(1)
.maybeSingle();

if (planError) {
console.error(
"Plan error:",
planError,
);

throw new Error(
"No se pudo consultar el plan Premium.",
);
}

if (!plan) {
return jsonResponse(
{
success: false,
error:
"No existe un plan Premium activo.",
},
404,
);
}

/*
* Buscar una suscripción local
* que todavía esté en proceso o activa.
*/
const {
data: existingSubscription,
error:
existingSubscriptionError,
} =
await supabase
.from(
"premium_subscriptions",
)
.select("*")
.eq(
"user_id",
userId,
)
.in(
"status",
[
"pending",
"active",
"paused",
"past_due",
],
)
.order(
"created_at",
{
ascending: false,
},
)
.limit(1)
.maybeSingle();

if (
existingSubscriptionError
) {
console.error(
"Subscription lookup error:",
existingSubscriptionError,
);

throw new Error(
"No se pudo consultar la suscripción Premium.",
);
}

/*
* Si ya existe una suscripción activa,
* no crear otra.
*/
if (
existingSubscription?.status ===
"active"
) {
return jsonResponse({
success: true,
already_active: true,
subscription_id:
existingSubscription.id,
status:
existingSubscription.status,
message:
"La cuenta ya tiene Premium activo.",
});
}

/*
* Si existe una suscripción pendiente,
* podemos reutilizarla.
*/
let subscription =
existingSubscription;

if (!subscription) {
const {
data: newSubscription,
error:
createSubscriptionError,
} =
await supabase
.from(
"premium_subscriptions",
)
.insert({
user_id:
userId,
plan_id:
plan.id,
provider:
"mercadopago",
status:
"pending",
})
.select("*")
.single();

if (
createSubscriptionError
) {
console.error(
"Create subscription error:",
createSubscriptionError,
);

throw new Error(
"No se pudo crear la suscripción Premium local.",
);
}

subscription =
newSubscription;
}

/*
* En producción usamos el email real
* de la cuenta.
*
* En modo prueba se utiliza el secreto
* configurado para el comprador de prueba.
*/
let payerEmail =
userEmail;

if (
MERCADOPAGO_TEST_MODE
) {
if (
!MERCADOPAGO_TEST_PAYER_EMAIL ||
MERCADOPAGO_TEST_PAYER_EMAIL ===
"disabled"
) {
throw new Error(
"El modo de prueba está activo pero no existe un comprador de prueba configurado.",
);
}

payerEmail =
MERCADOPAGO_TEST_PAYER_EMAIL;
}

/*
* Evitar crear suscripciones duplicadas en Mercado Pago.
* Si ya existe una suscripción remota pendiente/autorizada,
* reutilizar su enlace de pago.
*/
if (subscription.provider_subscription_id) {
  const existingProviderId = String(subscription.provider_subscription_id);
  try {
    const remoteResponse = await fetch(
      `https://api.mercadopago.com/preapproval/${encodeURIComponent(existingProviderId)}`,
      { headers: { Authorization: `Bearer ${MERCADOPAGO_ACCESS_TOKEN}` } },
    );
    const remoteText = await remoteResponse.text();
    let remote: any = {};
    try { remote = remoteText ? JSON.parse(remoteText) : {}; } catch { remote = {}; }

    if (remoteResponse.ok) {
      const remoteStatus = String(remote?.status ?? "").toLowerCase();
      if (remoteStatus !== "cancelled" && remoteStatus !== "canceled") {
        return jsonResponse({
          success: true,
          already_exists: true,
          subscription_id: subscription.id,
          provider_subscription_id: existingProviderId,
          status: remoteStatus || subscription.status || "pending",
          init_point: remote?.init_point ?? null,
          sandbox_init_point: remote?.sandbox_init_point ?? null,
          message: "Se reutilizó la suscripción Premium existente.",
        });
      }

      const { data: freshSubscription, error: freshError } = await supabase
        .from("premium_subscriptions")
        .insert({
          user_id: userId,
          plan_id: plan.id,
          provider: "mercadopago",
          status: "pending",
        })
        .select("*")
        .single();

      if (freshError || !freshSubscription) {
        throw new Error("No se pudo preparar una nueva suscripción después de cancelar la anterior.");
      }

      const { error: cancelLocalError } = await supabase
        .from("premium_subscriptions")
        .update({ status: "cancelled", cancelled_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq("id", subscription.id);

      if (cancelLocalError) throw new Error("No se pudo actualizar la suscripción anterior.");
      subscription = freshSubscription;
    } else if (remoteResponse.status !== 404) {
      console.error("No se pudo verificar suscripción Mercado Pago existente:", remoteResponse.status, remote);
      throw new Error("No se pudo verificar la suscripción existente en Mercado Pago. Intentá nuevamente.");
    } else {
      console.warn("Mercado Pago no encontró la suscripción remota guardada; se intentará crear una nueva.");
    }
  } catch (error) {
    console.error("Verificación de suscripción existente:", error);
    throw error;
  }
}

/*
* Crear suscripción en Mercado Pago.
*/
const mercadoPagoPayload = {
reason:
"EmiMatch Premium",

external_reference:
subscription.id,

payer_email:
payerEmail,

auto_recurring: {
frequency: 1,
frequency_type:
"months",
transaction_amount:
Number(plan.price),
currency_id:
plan.currency,
},

back_url:
BACK_URL,

notification_url:
WEBHOOK_URL,

status:
"pending",
};

console.log(
"Creando suscripción Mercado Pago:",
{
user_id:
userId,
subscription_id:
subscription.id,
plan_id:
plan.id,
amount:
Number(plan.price),
currency:
plan.currency,
test_mode:
MERCADOPAGO_TEST_MODE,
},
);

const mercadoPago =
await mercadoPagoRequest(
"/preapproval",
{
method: "POST",
body: JSON.stringify(
mercadoPagoPayload,
),
},
);

if (
!mercadoPago?.id
) {
throw new Error(
"Mercado Pago no devolvió un ID de suscripción.",
);
}

/*
* Guardar el ID de Mercado Pago
* en nuestra suscripción.
*/
const {
error:
updateSubscriptionError,
} =
await supabase
.from(
"premium_subscriptions",
)
.update({
provider:
"mercadopago",
provider_subscription_id:
String(
mercadoPago.id,
),
status:
"pending",
updated_at:
new Date().toISOString(),
})
.eq(
"id",
subscription.id,
);

if (
updateSubscriptionError
) {
console.error(
"Update subscription error:",
updateSubscriptionError,
);

throw new Error(
"La suscripción fue creada en Mercado Pago pero no se pudo guardar localmente.",
);
}

/*
* Registrar evento de creación.
*/
const {
error:
eventError,
} =
await supabase
.from(
"premium_events",
)
.insert({
user_id:
userId,
subscription_id:
subscription.id,
event_type:
"premium_created",
provider:
"mercadopago",
provider_event_id:
String(
mercadoPago.id,
),
metadata: {
mercadopago_subscription_id:
mercadoPago.id,
test_mode:
MERCADOPAGO_TEST_MODE,
amount:
Number(plan.price),
currency:
plan.currency,
},
});

if (eventError) {
console.error(
"Event insert warning:",
eventError,
);
}

/*
* Devolver los datos necesarios
* para redirigir al checkout.
*/
return jsonResponse({
success: true,

subscription_id:
subscription.id,

provider_subscription_id:
String(
mercadoPago.id,
),

status:
mercadoPago.status ??
"pending",

init_point:
mercadoPago.init_point ??
null,

sandbox_init_point:
mercadoPago.sandbox_init_point ??
null,

message:
"Suscripción Premium creada correctamente.",
});
} catch (error) {
console.error(
"premium-create:",
error,
);

return jsonResponse(
{
success: false,
error:
error instanceof Error
? error.message
: "Error interno.",
},
500,
);
}
});