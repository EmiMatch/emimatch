import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
"Access-Control-Allow-Origin": "*",
"Access-Control-Allow-Headers":
"authorization, x-client-info, apikey, content-type, x-signature, x-request-id",
"Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY =
Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const MERCADOPAGO_ACCESS_TOKEN =
Deno.env.get("MERCADOPAGO_ACCESS_TOKEN") ?? "";
const MERCADOPAGO_WEBHOOK_SECRET =
Deno.env.get("MERCADOPAGO_WEBHOOK_SECRET") ?? "";

const supabase = createClient(
SUPABASE_URL,
SUPABASE_SERVICE_ROLE_KEY,
);

function response(
body: Record<string, unknown>,
status = 200,
) {
return new Response(JSON.stringify(body), {
status,
headers: {
...corsHeaders,
"Content-Type": "application/json",
},
});
}

function normalizeSubscriptionStatus(
status: unknown,
): string {
const value = String(status ?? "").toLowerCase();

switch (value) {
case "authorized":
return "pending";
case "active":
return "active";
case "paused":
return "paused";
case "cancelled":
case "canceled":
return "cancelled";
case "expired":
case "finished":
return "expired";
case "past_due":
case "past-due":
return "past_due";
default:
return "pending";
}
}

function parseSignature(value: string | null) {
let ts = "";
let v1 = "";

if (!value) return { ts, v1 };

for (const part of value.split(",")) {
const [key, ...rest] = part.split("=");

if (!key || rest.length === 0) continue;

const val = rest.join("=").trim();

if (key.trim() === "ts") ts = val;
if (key.trim() === "v1") v1 = val;
}

return { ts, v1 };
}

function constantTimeEqual(a: string, b: string) {
if (a.length !== b.length) return false;

let result = 0;

for (let i = 0; i < a.length; i++) {
result |= a.charCodeAt(i) ^ b.charCodeAt(i);
}

return result === 0;
}

async function hmacSha256(
secret: string,
message: string,
) {
const encoder = new TextEncoder();

const key = await crypto.subtle.importKey(
"raw",
encoder.encode(secret),
{
name: "HMAC",
hash: "SHA-256",
},
false,
["sign"],
);

const signature = await crypto.subtle.sign(
"HMAC",
key,
encoder.encode(message),
);

return Array.from(new Uint8Array(signature))
.map((b) => b.toString(16).padStart(2, "0"))
.join("");
}

async function verifySignature(
request: Request,
dataId: string,
) {
if (!MERCADOPAGO_WEBHOOK_SECRET) {
console.error(
"MERCADOPAGO_WEBHOOK_SECRET no configurado; webhook rechazado.",
);

return false;
}

const xSignature =
request.headers.get("x-signature");

const xRequestId =
request.headers.get("x-request-id");

if (!xSignature || !xRequestId) {
return false;
}

const { ts, v1 } =
parseSignature(xSignature);

if (!ts || !v1) return false;

const url = new URL(request.url);

const queryDataId =
url.searchParams.get("data.id") ?? dataId;

const manifest =
`id:${queryDataId.toLowerCase()};` +
`request-id:${xRequestId};` +
`ts:${ts};`;

const calculated =
await hmacSha256(
MERCADOPAGO_WEBHOOK_SECRET,
manifest,
);

return constantTimeEqual(calculated, v1);
}

async function mercadoPagoGet(path: string) {
if (!MERCADOPAGO_ACCESS_TOKEN) {
throw new Error(
"Falta MERCADOPAGO_ACCESS_TOKEN.",
);
}

const res = await fetch(
`https://api.mercadopago.com${path}`,
{
method: "GET",
headers: {
Authorization:
`Bearer ${MERCADOPAGO_ACCESS_TOKEN}`,
"Content-Type":
"application/json",
},
},
);

const text = await res.text();

let data: any = {};

try {
data = text ? JSON.parse(text) : {};
} catch {
data = { raw: text };
}

if (!res.ok) {
throw new Error(
`Mercado Pago HTTP ${res.status}: ${JSON.stringify(data)}`,
);
}

return data;
}

async function findSubscription(
providerSubscriptionId: string | null,
externalReference: string | null,
) {
if (providerSubscriptionId) {
const { data, error } =
await supabase
.from("premium_subscriptions")
.select("*")
.eq(
"provider_subscription_id",
providerSubscriptionId,
)
.limit(1)
.maybeSingle();

if (error) throw error;
if (data) return data;
}

if (externalReference) {
const { data, error } =
await supabase
.from("premium_subscriptions")
.select("*")
.eq("id", externalReference)
.limit(1)
.maybeSingle();

if (error) throw error;
if (data) return data;
}

return null;
}

async function saveEvent(params: {
eventType: string;
eventId: string;
userId?: string | null;
subscriptionId?: string | null;
paymentId?: string | null;
metadata?: Record<string, unknown>;
}) {
const { error } =
await supabase
.from("premium_events")
.insert({
user_id: params.userId ?? null,
subscription_id:
params.subscriptionId ?? null,
payment_id:
params.paymentId ?? null,
event_type: params.eventType,
provider: "mercadopago",
provider_event_id: params.eventId,
metadata:
params.metadata ?? {},
});

if (error) throw error;
}

async function handlePreapproval(
eventId: string,
dataId: string,
) {
const mpSubscription =
await mercadoPagoGet(
`/preapproval/${encodeURIComponent(dataId)}`,
);

const providerId =
String(mpSubscription?.id ?? dataId);

const externalReference =
mpSubscription?.external_reference
? String(
mpSubscription.external_reference,
)
: null;

const localSubscription =
await findSubscription(
providerId,
externalReference,
);

if (!localSubscription) {
console.warn(
"Suscripción local no encontrada:",
providerId,
);

return {
processed: false,
reason: "subscription_not_found",
};
}

const status =
normalizeSubscriptionStatus(
mpSubscription?.status,
);

const update: Record<
string,
unknown
> = {
provider: "mercadopago",
provider_subscription_id:
providerId,
status,
};

if (
mpSubscription?.auto_recurring
?.start_date
) {
update.current_period_start =
mpSubscription.auto_recurring.start_date;
}

if (
mpSubscription?.auto_recurring
?.end_date
) {
update.current_period_end =
mpSubscription.auto_recurring.end_date;
}

if (status === "cancelled") {
update.cancelled_at =
new Date().toISOString();
}

const { error } =
await supabase
.from("premium_subscriptions")
.update(update)
.eq(
"id",
localSubscription.id,
);

if (error) throw error;

await saveEvent({
eventType:
"subscription_preapproval",
eventId,
userId:
localSubscription.user_id,
subscriptionId:
localSubscription.id,
metadata: {
mercadopago_status:
mpSubscription?.status ?? null,
provider_subscription_id:
providerId,
external_reference:
externalReference,
},
});

return {
processed: true,
subscription_id:
localSubscription.id,
status,
};
}

async function handlePayment(
eventId: string,
dataId: string,
) {
let payment: any;
try {
payment = await mercadoPagoGet(
`/v1/payments/${encodeURIComponent(dataId)}`,
);
} catch (error) {
// El simulador de Mercado Pago usa IDs ficticios como 123456.
// Reconocer el evento evita responder 500 y generar reintentos inútiles.
if (error instanceof Error && error.message.includes("Mercado Pago HTTP 404")) {
console.warn("Pago inexistente o ID de simulación; evento reconocido sin procesar:", dataId);
return { processed: false, reason: "payment_not_found_or_simulated_id" };
}
throw error;
}

const providerPaymentId =
String(payment?.id ?? dataId);

const providerSubscriptionId =
payment?.preapproval_id
? String(payment.preapproval_id)
: null;

const externalReference =
payment?.external_reference
? String(payment.external_reference)
: null;

const localSubscription =
await findSubscription(
providerSubscriptionId,
externalReference,
);

if (!localSubscription) {
await saveEvent({
eventType: "payment_unmatched",
eventId,
metadata: {
provider_payment_id:
providerPaymentId,
status:
payment?.status ?? null,
external_reference:
externalReference,
preapproval_id:
providerSubscriptionId,
},
});

return {
processed: false,
reason: "payment_unmatched",
};
}

const mpStatus =
String(
payment?.status ?? "",
).toLowerCase();

let status = "pending";

if (mpStatus === "approved") {
status = "approved";
} else if (mpStatus === "refunded") {
status = "refunded";
} else if (
mpStatus === "cancelled" ||
mpStatus === "canceled"
) {
status = "cancelled";
} else if (mpStatus === "charged_back") {
status = "refunded";
} else if (mpStatus === "rejected") {
status = "rejected";
}

const { data: existingPayment, error: findError } =
await supabase
.from("premium_payments")
.select("*")
.eq(
"provider_payment_id",
providerPaymentId,
)
.limit(1)
.maybeSingle();

if (findError) throw findError;

let paymentRow =
existingPayment;

if (!paymentRow) {
const { data, error } =
await supabase
.from("premium_payments")
.insert({
user_id:
localSubscription.user_id,
subscription_id:
localSubscription.id,
provider: "mercadopago",
provider_payment_id:
providerPaymentId,
amount:
Number(
payment?.transaction_amount ?? 0,
),
currency:
payment?.currency_id ?? "ARS",
status,
paid_at:
status === "approved"
? (
payment?.date_approved ??
new Date().toISOString()
)
: null,
})
.select("*")
.single();

if (error) throw error;

paymentRow = data;
} else {
const { error } =
await supabase
.from("premium_payments")
.update({
status,
paid_at:
status === "approved"
? (
payment?.date_approved ??
paymentRow.paid_at ??
new Date().toISOString()
)
: paymentRow.paid_at,
})
.eq(
"id",
paymentRow.id,
);

if (error) throw error;
}

if (status === "refunded" || status === "charged_back") {
// Un reintegro o contracargo no debe dejar Premium activo indefinidamente.
const { error: accessError } = await supabase
.from("premium_subscriptions")
.update({
status: "past_due",
current_period_end: new Date().toISOString(),
updated_at: new Date().toISOString(),
})
.eq("id", localSubscription.id);
if (accessError) throw accessError;
}

if (status === "approved") {
const startDate =
payment?.date_approved
? new Date(
payment.date_approved,
)
: new Date();

let endDate =
new Date(startDate);

endDate.setUTCMonth(
endDate.getUTCMonth() + 1,
);

if (providerSubscriptionId) {
try {
const mpSubscription =
await mercadoPagoGet(
`/preapproval/${encodeURIComponent(
providerSubscriptionId,
)}`,
);

if (
mpSubscription?.next_payment_date
) {
const nextDate =
new Date(
mpSubscription.next_payment_date,
);

if (
!Number.isNaN(
nextDate.getTime(),
)
) {
endDate = nextDate;
}
}
} catch (error) {
console.warn(
"No se pudo obtener next_payment_date:",
error,
);
}
}

const { error } =
await supabase
.from("premium_subscriptions")
.update({
status: "active",
current_period_start:
startDate.toISOString(),
current_period_end:
endDate.toISOString(),
cancelled_at: null,
})
.eq(
"id",
localSubscription.id,
);

if (error) throw error;
}

await saveEvent({
eventType: "payment",
eventId,
userId:
localSubscription.user_id,
subscriptionId:
localSubscription.id,
paymentId:
paymentRow?.id ?? null,
metadata: {
provider_payment_id:
providerPaymentId,
mercadopago_status:
mpStatus,
normalized_status:
status,
external_reference:
externalReference,
preapproval_id:
providerSubscriptionId,
},
});

return {
processed: true,
subscription_id:
localSubscription.id,
payment_id:
paymentRow?.id ?? null,
status,
};
}
async function handleAuthorizedPayment(
eventId: string,
dataId: string,
) {
const authorized =
await mercadoPagoGet(
`/authorized_payments/${encodeURIComponent(dataId)}`,
);

const providerSubscriptionId =
authorized?.preapproval_id
? String(authorized.preapproval_id)
: null;

const externalReference =
authorized?.external_reference
? String(authorized.external_reference)
: null;

const localSubscription =
await findSubscription(
providerSubscriptionId,
externalReference,
);

if (!localSubscription) {
return {
processed: false,
reason: "subscription_not_found",
};
}

const nestedPayment =
authorized?.payment;

const providerPaymentId =
nestedPayment?.id
? String(nestedPayment.id)
: null;

const paymentStatus =
String(
nestedPayment?.status ??
authorized?.status ??
"",
).toLowerCase();

let status = "pending";

if (paymentStatus === "approved") {
status = "approved";
} else if (paymentStatus === "refunded") {
status = "refunded";
} else if (
paymentStatus === "cancelled" ||
paymentStatus === "canceled"
) {
status = "cancelled";
} else if (paymentStatus === "rejected") {
status = "rejected";
}

let paymentRow = null;

if (providerPaymentId) {
const { data, error } =
await supabase
.from("premium_payments")
.select("*")
.eq(
"provider_payment_id",
providerPaymentId,
)
.limit(1)
.maybeSingle();

if (error) {
throw error;
}

paymentRow = data;
}

if (!paymentRow) {
const { data, error } =
await supabase
.from("premium_payments")
.insert({
user_id:
localSubscription.user_id,
subscription_id:
localSubscription.id,
provider:
"mercadopago",
provider_payment_id:
providerPaymentId,
amount:
Number(
authorized?.transaction_amount ??
nestedPayment?.transaction_amount ??
0,
),
currency:
authorized?.currency_id ??
nestedPayment?.currency_id ??
"ARS",
status,
paid_at:
status === "approved"
? (
nestedPayment?.date_approved ??
new Date().toISOString()
)
: null,
})
.select("*")
.single();

if (error) {
throw error;
}

paymentRow = data;
}

if (status === "approved") {
const startDate =
nestedPayment?.date_approved
? new Date(
nestedPayment.date_approved,
)
: new Date();

const endDate =
new Date(startDate);

endDate.setUTCMonth(
endDate.getUTCMonth() + 1,
);

const { error } =
await supabase
.from("premium_subscriptions")
.update({
status: "active",
current_period_start:
startDate.toISOString(),
current_period_end:
endDate.toISOString(),
cancelled_at: null,
})
.eq(
"id",
localSubscription.id,
);

if (error) {
throw error;
}
}

await saveEvent({
eventType:
"subscription_authorized_payment",
eventId,
userId:
localSubscription.user_id,
subscriptionId:
localSubscription.id,
paymentId:
paymentRow?.id ?? null,
metadata: {
authorized_payment_id:
dataId,
provider_payment_id:
providerPaymentId,
status,
mercadopago_status:
paymentStatus,
},
});

return {
processed: true,
subscription_id:
localSubscription.id,
payment_id:
paymentRow?.id ?? null,
status,
};
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
return response(
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

const url =
new URL(request.url);

const rawBody =
await request.text();

let payload: any = {};

if (rawBody.trim()) {
try {
payload =
JSON.parse(rawBody);
} catch {
return response(
{
success: false,
error:
"JSON inválido.",
},
400,
);
}
}

const eventType =
String(
payload?.type ??
payload?.topic ??
url.searchParams.get("type") ??
"",
).toLowerCase();

const dataId =
String(
payload?.data?.id ??
url.searchParams.get("data.id") ??
"",
);

const eventId =
String(
payload?.id ??
dataId ??
crypto.randomUUID(),
);

if (!eventType) {
return response({
success: true,
ignored: true,
reason:
"Evento sin tipo.",
});
}

if (!dataId) {
return response({
success: true,
ignored: true,
reason:
"Evento sin data.id.",
});
}

const valid =
await verifySignature(
request,
dataId,
);

if (!valid) {
return response(
{
success: false,
error:
"Firma de Mercado Pago inválida.",
},
401,
);
}

const {
data: alreadyProcessed,
error: duplicateError,
} = await supabase
.from("premium_events")
.select("id")
.eq(
"provider_event_id",
eventId,
)
.limit(1)
.maybeSingle();

if (duplicateError) {
throw duplicateError;
}

if (alreadyProcessed) {
return response({
success: true,
duplicate: true,
event_id: eventId,
});
}

let result:
| Record<string, unknown>
| null = null;

switch (eventType) {
case "subscription_preapproval":
case "preapproval":
case "subscription":
result =
await handlePreapproval(
eventId,
dataId,
);
break;

case "subscription_authorized_payment":
case "authorized_payment":
result =
await handleAuthorizedPayment(
eventId,
dataId,
);
break;

case "payment":
result =
await handlePayment(
eventId,
dataId,
);
break;

default:
console.log(
"Evento ignorado:",
eventType,
);

result = {
processed: false,
ignored: true,
event_type: eventType,
};
}

return response({
success: true,
event_id: eventId,
event_type: eventType,
data_id: dataId,
result,
});
} catch (error) {
console.error(
"premium-webhook:",
error,
);

return response(
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