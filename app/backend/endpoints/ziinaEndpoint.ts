import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { getOrdersFromDb, updateOrderPaymentInDb } from "../../db/ordersDb";
import { verifyAdminAuth } from "../../utils/adminAuth";

const ZIINA_API_BASE = "https://api-v2.ziina.com/api";

export function getZiinaEnvConfig(context?: any) {
  const env = (context as any)?.cloudflare?.env || process.env || {};
  return {
    token: String(env.ZIINA_API_TOKEN || "").replace(/^Bearer\\s+/i, "").trim(),
    isTestMode: String(env.ZIINA_TEST_MODE || "true").toLowerCase() === "true",
    webhookSecret: String(env.ZIINA_WEBHOOK_SECRET || "").trim(),
  };
}

function constantTimeEqual(a: string, b: string): boolean {
  if (!a || !b || a.length !== b.length) return false;
  let difference = 0;
  for (let i = 0; i < a.length; i++) difference |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return difference === 0;
}
function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer), (value) => value.toString(16).padStart(2, "0")).join("");
}
async function verifyWebhookSignature(rawBody: string, suppliedSignature: string, secret: string): Promise<boolean> {
  if (!suppliedSignature || !secret) return false;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const expected = toHex(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(rawBody)));
  return constantTimeEqual(expected.toLowerCase(), suppliedSignature.trim().toLowerCase());
}

export async function handleZiinaStatus({ request, context }: LoaderFunctionArgs) {
  const auth = await verifyAdminAuth(request, context);
  if (!auth.authorized) return Response.json({ success: false, error: "Unauthorized" }, { status: 401 });
  const config = getZiinaEnvConfig(context);
  const token = config.token;
  const maskedToken = token.length > 8 ? token.slice(0, 4) + "••••" + token.slice(-4) : (token ? "••••••••" : "");
  return Response.json({
    success: true,
    configured: Boolean(token),
    envConfigured: Boolean(token),
    maskedToken,
    testMode: config.isTestMode,
    mode: config.isTestMode ? "sandbox" : "production",
    hasWebhookSecret: Boolean(config.webhookSecret),
    apiUrl: ZIINA_API_BASE,
  }, { headers: { "Cache-Control": "no-store" } });
}

export async function handleZiinaCreateIntent({ request, context }: ActionFunctionArgs) {
  const d1 = (context as any)?.cloudflare?.env?.DB;
  try {
    const body = await request.json() as any;
    const config = getZiinaEnvConfig(context);
    if (body.intent === "ping") {
      const auth = await verifyAdminAuth(request, context);
      if (!auth.authorized) return Response.json({ success:false, error:"Unauthorized" }, { status:401 });
      if (!config.token) return Response.json({ success:false, configured:false, error:"ZIINA_API_TOKEN is not configured" }, { status:503 });
      return Response.json({ success:true, configured:true, isLiveGateway:false, testMode:config.isTestMode, message:"Server-side payment secret is configured; this diagnostic does not create a payment." }, { headers: { "Cache-Control":"no-store" } });
    }

    if (!d1) return Response.json({ success: false, error: "Order database is unavailable" }, { status: 503 });
    if (!config.token) return Response.json({ success: false, error: "Ziina payments are not configured" }, { status: 503 });
    const orderId = String(body.orderId || "").trim();
    if (!orderId) return Response.json({ success: false, error: "orderId is required" }, { status: 400 });

    const orderResult = await getOrdersFromDb(d1);
    if (orderResult.storageType !== "d1_database") return Response.json({ success:false, error:"Order database is temporarily unavailable" }, { status:503 });
    const order = orderResult.orders.find((candidate) => candidate.id === orderId);
    if (!order) return Response.json({ success: false, error: "Order not found" }, { status: 404 });
    if (order.paymentMethod !== "ziina") return Response.json({ success: false, error: "Order is not configured for Ziina" }, { status: 400 });
    if (order.paymentStatus === "paid") return Response.json({ success: false, error: "Order is already paid" }, { status: 409 });
    if (order.ziinaPaymentIntentId && order.ziinaRedirectUrl) {
      return Response.json({ success:true, payment_intent:{ id:order.ziinaPaymentIntentId }, redirect_url:order.ziinaRedirectUrl, isLiveGateway:true, testMode:config.isTestMode, resumed:true });
    }
    if (order.ziinaPaymentIntentId) return Response.json({ success:false, error:"An earlier payment intent exists but has no redirect URL. Contact support." }, { status:409 });

    const amountInFils = Math.round(Number(order.total) * 100);
    if (!Number.isSafeInteger(amountInFils) || amountInFils < 200) return Response.json({ success: false, error: "Invalid order amount" }, { status: 400 });
    const base = new URL(request.url).origin;
    const encodedOrder = encodeURIComponent(order.id);
    const payload = {
      amount: amountInFils,
      currency_code: "AED",
      message: "Teen Liwa Order #" + order.orderNumber,
      success_url: base + "/payment/callback?status=success&orderId=" + encodedOrder,
      cancel_url: base + "/payment/callback?status=cancelled&orderId=" + encodedOrder,
      failure_url: base + "/payment/callback?status=failed&orderId=" + encodedOrder,
      test: config.isTestMode,
      allow_tips: false,
    };

    const response = await fetch(ZIINA_API_BASE + "/payment_intent", {
      method: "POST",
      headers: { Authorization: "Bearer " + config.token, "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await response.json().catch(() => ({})) as any;
    if (!response.ok || !data.id || !data.redirect_url) {
      return Response.json({ success: false, error: data.message || "Ziina could not create a payment intent", statusCode: response.status }, { status: 502 });
    }

    const intentSaved = await updateOrderPaymentInDb(order.id, "pending", { ziinaPaymentIntentId: data.id, ziinaRedirectUrl: data.redirect_url }, d1);
    if (!intentSaved) return Response.json({ success:false, error:"Payment intent was created but could not be safely linked to the order. Contact support before retrying." }, { status:503 });
    return Response.json({ success: true, payment_intent: data, redirect_url: data.redirect_url, isLiveGateway: true, testMode: config.isTestMode });
  } catch (error) {
    console.error("Ziina create-intent error:", error);
    return Response.json({ success: false, error: "Failed to initialize payment intent" }, { status: 500 });
  }
}

export async function handleZiinaVerify({ request, context }: LoaderFunctionArgs) {
  const d1 = (context as any)?.cloudflare?.env?.DB;
  const config = getZiinaEnvConfig(context);
  const url = new URL(request.url);
  const suppliedIntentId = url.searchParams.get("payment_intent_id") || url.searchParams.get("id") || "";
  const orderId = url.searchParams.get("orderId") || "";
  if (!orderId) return Response.json({ success:false, error:"orderId is required" }, { status:400 });
  if (!d1 || !config.token) return Response.json({ success:false, error:"Payment verification is temporarily unavailable" }, { status:503 });

  try {
    const orderResult = await getOrdersFromDb(d1);
    if (orderResult.storageType !== "d1_database") return Response.json({ success:false, error:"Order database is temporarily unavailable" }, { status:503 });
    const order = orderResult.orders.find((candidate) => candidate.id === orderId);
    if (!order || !order.ziinaPaymentIntentId) return Response.json({ success:false, error:"No payment intent is linked to this order" }, { status:404 });
    const paymentIntentId = order.ziinaPaymentIntentId;
    if (suppliedIntentId && suppliedIntentId !== paymentIntentId) return Response.json({ success:false, error:"Payment intent does not belong to this order" }, { status:404 });

    const response = await fetch(ZIINA_API_BASE + "/payment_intent/" + encodeURIComponent(paymentIntentId), {
      headers: { Authorization: "Bearer " + config.token, Accept: "application/json" },
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) return Response.json({ success:false, error:"Ziina could not confirm this payment", statusCode:response.status }, { status:502 });
    const intent = await response.json() as any;
    const expectedAmount = Math.round(Number(order.total) * 100);
    if (intent.id !== paymentIntentId || Number(intent.amount) !== expectedAmount || String(intent.currency_code).toUpperCase() !== "AED") {
      return Response.json({ success:false, error:"Payment details do not match the order" }, { status:409 });
    }

    const state = String(intent.status || "").toLowerCase();
    const isPaid = order.paymentStatus === "paid" || state === "completed";
    const paymentStatus = isPaid ? "paid" : (state === "failed" || state === "canceled" || state === "cancelled") ? "failed" : "pending";
    if (paymentStatus !== "pending" && order.paymentStatus !== "paid") {
      const saved = await updateOrderPaymentInDb(order.id, paymentStatus, {
        ziinaPaymentIntentId: paymentIntentId,
        cardBrand: intent.card_details?.card_brand,
        cardLastFour: intent.card_details?.card_last_four,
        orderStatus: isPaid ? "processing" : "pending",
      }, d1);
      if (!saved) return Response.json({ success:false, error:"Payment state could not be persisted" }, { status:503 });
    }
    return Response.json({ success:true, status:isPaid ? "completed" : state, isPaid, intent:{ id:intent.id, amount:intent.amount, currency_code:intent.currency_code, status:intent.status, card_details:intent.card_details }, isLive:true }, { headers: { "Cache-Control":"no-store" } });
  } catch (error) {
    console.error("Ziina verification error:", error);
    return Response.json({ success:false, error:"Failed to verify payment intent" }, { status:500 });
  }
}

export async function handleZiinaWebhook({ request, context }: ActionFunctionArgs) {
  const d1 = (context as any)?.cloudflare?.env?.DB;
  const config = getZiinaEnvConfig(context);
  if (!d1 || !config.token) return Response.json({ success: false, error: "Payment processing is not configured" }, { status: 503 });
  if (!config.webhookSecret) return Response.json({ success: false, error: "Webhook secret is not configured" }, { status: 503 });

  const rawBody = await request.text();
  const signature = request.headers.get("X-Hmac-Signature") || "";
  if (!await verifyWebhookSignature(rawBody, signature, config.webhookSecret)) {
    return Response.json({ success: false, error: "Invalid webhook signature" }, { status: 401 });
  }

  try {
    const payload = JSON.parse(rawBody) as any;
    if (payload.event !== "payment_intent.status.updated") return Response.json({ success: true, received: true });
    const intent = payload.data?.object || payload.data;
    if (!intent?.id) return Response.json({ success: false, error: "Invalid payment event" }, { status: 400 });

    const orderResult = await getOrdersFromDb(d1);
    if (orderResult.storageType !== "d1_database") return Response.json({ success:false, error:"Order database is temporarily unavailable" }, { status:503 });
    const order = orderResult.orders.find((candidate) => candidate.ziinaPaymentIntentId === intent.id);
    if (!order) return Response.json({ success: false, error: "No matching order" }, { status: 404 });

    const expectedAmount = Math.round(Number(order.total) * 100);
    if (Number(intent.amount) !== expectedAmount || String(intent.currency_code).toUpperCase() !== "AED") {
      return Response.json({ success: false, error: "Webhook payment amount or currency mismatch" }, { status: 409 });
    }
    const state = String(intent.status || "").toLowerCase();
    const isPaid = state === "completed";
    const alreadyPaid = order.paymentStatus === "paid";
    const paymentStatus = alreadyPaid || isPaid ? "paid" : (state === "failed" || state === "canceled" || state === "cancelled") ? "failed" : "pending";
    if (paymentStatus !== "pending" && !alreadyPaid) {
      const saved = await updateOrderPaymentInDb(order.id, paymentStatus, {
        ziinaPaymentIntentId: intent.id,
        cardBrand: intent.card_details?.card_brand,
        cardLastFour: intent.card_details?.card_last_four,
        orderStatus: isPaid ? "processing" : "pending",
      }, d1);
      if (!saved) return Response.json({ success:false, error:"Payment state could not be persisted" }, { status:503 });
    }
    return Response.json({ success: true, received: true });
  } catch (error) {
    console.error("Ziina webhook processing error:", error);
    return Response.json({ success: false, error: "Failed to process webhook" }, { status: 400 });
  }
}
