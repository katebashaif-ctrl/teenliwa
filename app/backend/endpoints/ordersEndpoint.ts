import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { getD1Database, getWorkerEnv, toFils } from "../../db/d1";
import {
  getOrdersFromDb, createOrderInDb, updateOrderStatusInDb,
  updateOrderPaymentInDb, deleteOrderFromDb,
} from "../../db/ordersDb";
import { getProductsFromDb } from "../../db/productsDb";
import { verifyAdminAuth } from "../../utils/adminAuth";

async function settingAed(db: NonNullable<ReturnType<typeof getD1Database>>, key: string, fallback: number): Promise<number> {
  const row = await db.prepare("SELECT setting_value FROM store_settings WHERE setting_key = ? LIMIT 1")
    .bind(key).first<{ setting_value: string }>();
  if (!row) return fallback;
  try {
    const parsed = JSON.parse(row.setting_value);
    const value = Number(parsed);
    return Number.isFinite(value) && value >= 0 ? value : fallback;
  } catch {
    const value = Number(row.setting_value);
    return Number.isFinite(value) && value >= 0 ? value : fallback;
  }
}

export async function handleOrdersLoader({ request, context }: LoaderFunctionArgs) {
  const auth = await verifyAdminAuth(request, context);
  if (!auth.authorized) return Response.json({ success: false, error: "Admin access required", code: "UNAUTHORIZED" }, { status: 401 });
  const db = getD1Database(context);
  if (!db) return Response.json({ success: false, error: "Order database is unavailable" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  try {
    const { orders, storageType } = await getOrdersFromDb(db);
    const url = new URL(request.url);
    const status = url.searchParams.get("status");
    const query = url.searchParams.get("q")?.toLowerCase();
    let filtered = orders;
    if (status && status !== "all") filtered = filtered.filter((o) => o.status === status);
    if (query) filtered = filtered.filter((o) =>
      o.id.toLowerCase().includes(query) || o.orderNumber.toLowerCase().includes(query) ||
      o.customerName.toLowerCase().includes(query) || o.customerPhone.includes(query) ||
      o.customerEmirate.toLowerCase().includes(query)
    );
    return Response.json({
      success: true, count: filtered.length, storageType,
      totalRevenue: filtered.reduce((sum, order) =>
        sum + (order.paymentStatus === "paid" || (order.paymentMethod === "cod" && order.status === "delivered") ? order.total : 0), 0),
      orders: filtered,
    }, { headers: { "Cache-Control": "no-store, no-cache, must-revalidate", Pragma: "no-cache" } });
  } catch (error) {
    console.error("D1 orders read failed:", error);
    return Response.json({ success: false, error: "Failed to retrieve orders" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}

export async function handleOrdersAction({ request, context }: ActionFunctionArgs) {
  const db = getD1Database(context);
  if (!db) return Response.json({ success: false, error: "Order database is unavailable" }, { status: 503 });
  let body: any;
  try { body = await request.json(); }
  catch { return Response.json({ success: false, error: "Invalid JSON payload" }, { status: 400 }); }
  const method = request.method.toUpperCase();
  const intent = body.intent || (method === "POST" ? "create_order" : method === "PATCH" ? "update_status" : "delete_order");

  // Checkout accepts product identifiers and quantities only. All prices and fees are server-derived.
  if (intent === "create_order") {
    const data = body;
    const customerName = String(data.customerName || "").trim();
    const customerPhone = String(data.customerPhone || "").trim();
    const emirate = String(data.customerEmirate || "").trim();
    const address = String(data.customerAddress || "").trim();
    if (!customerName || !customerPhone || !emirate || !address ||
        !Array.isArray(data.items) || data.items.length < 1 || data.items.length > 50) {
      return Response.json({ success: false, error: "Customer details and 1-50 order items are required" }, { status: 400 });
    }
    try {
      const catalog = await getProductsFromDb(db, false);
      const byId = new Map(catalog.products.map((product) => [String(product.id), product]));
      const normalizedItems = data.items.map((item: any) => {
        const productId = String(item.productId || item.id || item.product?.id || "");
        const product = byId.get(productId);
        const quantity = Number(item.quantity);
        if (!product || !Number.isSafeInteger(quantity) || quantity < Number(product.minQty || 1) ||
            quantity > Number(product.maxQty || 50) || product.inStock === false ||
            (Number.isFinite(product.stockQuantity) && quantity > Number(product.stockQuantity))) {
          throw new Error("One or more products are unavailable or have an invalid quantity");
        }
        return {
          productId: product.id,
          name: product.name,
          quantity,
          price: Number(product.price),
          unit: product.unit || "item",
          packagingOption: typeof item.packagingOption === "string" ? item.packagingOption.slice(0, 80) : undefined,
          trackInventory: product.trackInventory === true,
        };
      });
      const subtotal = normalizedItems.reduce((sum, item) => sum + toFils(item.price) * item.quantity, 0) / 100;
      if (!Number.isFinite(subtotal) || subtotal > 100000) throw new Error("Order subtotal is outside the supported range");

      const env = getWorkerEnv(context);
      const standardFeeFallback = Number(env.STANDARD_DELIVERY_FEE ?? 30);
      const thresholdFallback = Number(env.FREE_DELIVERY_THRESHOLD ?? 250);
      const standardFee = await settingAed(db, "standardDeliveryFee", Number.isFinite(standardFeeFallback) ? standardFeeFallback : 30);
      const freeThreshold = await settingAed(db, "freeDeliveryThreshold", Number.isFinite(thresholdFallback) ? thresholdFallback : 250);
      const zone = await db.prepare(`
        SELECT id, emirate, area, delivery_fee_fils, free_delivery_threshold_fils
        FROM delivery_zones
        WHERE is_active = 1 AND lower(emirate) = lower(?)
          AND (area IS NULL OR area = ?)
        ORDER BY CASE WHEN area = ? THEN 0 ELSE 1 END
        LIMIT 1
      `).bind(emirate, String(data.area || "").trim(), String(data.area || "").trim())
        .first<{ id: number; emirate: string; area: string | null; delivery_fee_fils: number; free_delivery_threshold_fils: number | null }>();
      const feeAed = zone ? Number(zone.delivery_fee_fils) / 100 : standardFee;
      const freeAed = zone?.free_delivery_threshold_fils == null ? freeThreshold : Number(zone.free_delivery_threshold_fils) / 100;
      const deliveryFee = subtotal >= freeAed ? 0 : feeAed;
      const paymentMethod = ["ziina", "cod", "card_on_delivery", "whatsapp"].includes(data.paymentMethod) ? data.paymentMethod : "cod";

      const normalizedOrder: any = {
        customerName: customerName.slice(0, 160),
        customerPhone: customerPhone.slice(0, 30),
        customerEmirate: emirate.slice(0, 80),
        area: String(data.area || "").trim().slice(0, 100),
        customerAddress: address.slice(0, 700),
        deliveryZoneId: zone?.id ?? null,
        deliveryZoneName: zone ? [zone.emirate, zone.area].filter(Boolean).join(" - ") : emirate.slice(0, 80),
        notes: String(data.notes || "").trim().slice(0, 1000),
        giftNote: String(data.giftNote || "").trim().slice(0, 500),
        items: normalizedItems,
        subtotal,
        deliveryFee,
        discount: 0,
        total: subtotal + deliveryFee,
        paymentMethod,
        paymentStatus: "pending",
        status: paymentMethod === "ziina" ? "awaiting_payment" : "pending",
      };
      const result = await createOrderInDb(normalizedOrder, db);
      return Response.json({
        success: true,
        message: "Order placed and saved successfully",
        order: result.order,
        dbSaved: result.dbSaved,
        storageType: result.storageType,
      }, { status: 201, headers: { "Cache-Control": "no-store" } });
    } catch (error) {
      console.error("Order creation failed:", error);
      return Response.json({ success: false, error: error instanceof Error ? error.message : "Failed to create order" }, { status: 400 });
    }
  }

  // All remaining actions mutate private records and require a signed admin session.
  const auth = await verifyAdminAuth(request, context);
  if (!auth.authorized) return Response.json({ success: false, error: "Unauthorized. Admin credentials required.", code: "UNAUTHORIZED" }, { status: 401 });

  if (intent === "update_payment") {
    const { orderId, paymentStatus, ziinaPaymentIntentId, ziinaRedirectUrl, transactionId, orderStatus } = body;
    if (!orderId || !["paid", "failed", "pending", "cancelled"].includes(paymentStatus)) {
      return Response.json({ success: false, error: "Valid orderId and paymentStatus are required" }, { status: 400 });
    }
    const saved = await updateOrderPaymentInDb(String(orderId), paymentStatus, {
      ziinaPaymentIntentId, ziinaRedirectUrl, transactionId, orderStatus,
    }, db);
    return saved
      ? Response.json({ success: true, message: "Payment update saved" })
      : Response.json({ success: false, error: "Payment update could not be saved" }, { status: 503 });
  }

  if (intent === "update_status" || method === "PATCH") {
    const { orderId, status } = body;
    if (!orderId || !["pending", "processing", "shipped", "delivered", "cancelled"].includes(status)) {
      return Response.json({ success: false, error: "Valid orderId and status are required" }, { status: 400 });
    }
    const updated = await updateOrderStatusInDb(String(orderId), status, db);
    return updated
      ? Response.json({ success: true, message: "Order status updated", orderId })
      : Response.json({ success: false, error: "Order status was not saved" }, { status: 503 });
  }

  if (intent === "delete_order" || method === "DELETE") {
    const { orderId } = body;
    if (!orderId) return Response.json({ success: false, error: "orderId is required" }, { status: 400 });
    const deleted = await deleteOrderFromDb(String(orderId), db);
    return deleted
      ? Response.json({ success: true, message: "Order archived", orderId })
      : Response.json({ success: false, error: "Order could not be archived" }, { status: 404 });
  }

  return Response.json({ success: false, error: "Unsupported order intent" }, { status: 400 });
}
