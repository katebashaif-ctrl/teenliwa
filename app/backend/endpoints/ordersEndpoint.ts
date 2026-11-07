import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import {
  getOrdersFromDb,
  createOrderInDb,
  updateOrderStatusInDb,
  updateOrderPaymentInDb,
  deleteOrderFromDb,
} from "../../db/ordersDb";
import { verifyAdminAuth } from "../../utils/adminAuth";
import { getProductsFromDb } from "../../db/productsDb";

export async function handleOrdersLoader({ request, context }: LoaderFunctionArgs) {
  const auth = await verifyAdminAuth(request, context);
  if (!auth.authorized) {
    return Response.json(
      {
        success: false,
        error: auth.reason || "Unauthorized. Admin access required.",
        code: "UNAUTHORIZED",
      },
      {
        status: 401,
        headers: { "WWW-Authenticate": 'Bearer realm="Admin Area"' },
      }
    );
  }

  const d1 = (context as any)?.cloudflare?.env?.DB;
  const url = new URL(request.url);
  const statusFilter = url.searchParams.get("status");
  const searchQuery = url.searchParams.get("q")?.toLowerCase();

  try {
    const { orders, storageType } = await getOrdersFromDb(d1);

    let filtered = orders;
    if (statusFilter && statusFilter !== "all") {
      filtered = filtered.filter((o) => o.status === statusFilter);
    }
    if (searchQuery) {
      filtered = filtered.filter(
        (o) =>
          o.id.toLowerCase().includes(searchQuery) ||
          o.orderNumber.toLowerCase().includes(searchQuery) ||
          o.customerName.toLowerCase().includes(searchQuery) ||
          o.customerPhone.includes(searchQuery) ||
          o.customerEmirate.toLowerCase().includes(searchQuery)
      );
    }

    return Response.json({
      success: true,
      count: filtered.length,
      totalRevenue: filtered.reduce((sum, o) => sum + (o.status !== "cancelled" ? o.total : 0), 0),
      storageType,
      orders: filtered,
    });
  } catch (error) {
    console.error("Error fetching orders from database:", error);
    return Response.json(
      {
        success: false,
        error: "Failed to retrieve orders from database",
        detail: error instanceof Error ? error.message : "unknown",
      },
      { status: 500 }
    );
  }
}

export async function handleOrdersAction({ request, context }: ActionFunctionArgs) {
  const d1 = (context as any)?.cloudflare?.env?.DB;

  let body: any;
  try {
    body = await request.json();
  } catch {
    return Response.json({ success: false, error: "Invalid JSON payload" }, { status: 400 });
  }

  const method = request.method.toUpperCase();
  const intent = body.intent || (method === "POST" ? "create_order" : method === "PATCH" ? "update_status" : "delete_order");

  if (intent === "create_order" || method === "POST") {
    const orderData = body;
    if (!orderData.customerName || !orderData.customerPhone || !Array.isArray(orderData.items)) {
      return Response.json(
        { success: false, error: "Missing required order data (name, phone, items)" },
        { status: 400 }
      );
    }

    try {
      if (!d1) return Response.json({ success: false, error: "Order storage is unavailable" }, { status: 503 });
      if (orderData.items.length < 1 || orderData.items.length > 50) return Response.json({ success: false, error: "Invalid item count" }, { status: 400 });
      const productResult = await getProductsFromDb(d1);
      if (productResult.storageType !== "d1_database") return Response.json({ success:false, error:"The live product catalog could not be loaded. Please retry later." }, { status:503 });
      const products = productResult.products;
      const productMap = new Map(products.map((product: any) => [String(product.id), product]));
      const items = orderData.items.map((item: any) => {
        const product = productMap.get(String(item.productId || item.id || item.product?.id || ""));
        const quantity = Number(item.quantity);
        const price = Number(product?.price);
        if (!product || !Number.isSafeInteger(quantity) || quantity < 1 || quantity > 100 || product.inStock === false || !Number.isFinite(price) || price < 0) throw new Error("Invalid or unavailable product");
        if (Number.isFinite(product.stockQuantity) && quantity > Number(product.stockQuantity)) throw new Error("Insufficient stock");
        return { productId: product.id, name: product.name, quantity, price, unit: product.unit || item.unit || "piece", packagingOption: item.packagingOption };
      });
      const subtotal = items.reduce((sum: number, item: any) => sum + item.price * item.quantity, 0);
      const env = (context as any)?.cloudflare?.env || {};
      const configuredThreshold = Number(env.FREE_DELIVERY_THRESHOLD ?? 250);
      const configuredDeliveryFee = Number(env.STANDARD_DELIVERY_FEE ?? 30);
      const freeThreshold = Number.isFinite(configuredThreshold) ? Math.max(0, configuredThreshold) : 250;
      const deliveryFeeAmount = Number.isFinite(configuredDeliveryFee) ? Math.max(0, configuredDeliveryFee) : 30;
      const deliveryFee = subtotal >= freeThreshold ? 0 : deliveryFeeAmount;
      if (!Number.isFinite(subtotal) || !Number.isSafeInteger(Math.round(subtotal * 100)) || subtotal > 1000000) throw new Error("Invalid order total");
      const paymentMethod = ["ziina", "cod", "card_on_delivery", "whatsapp"].includes(orderData.paymentMethod) ? orderData.paymentMethod : "cod";
      const normalizedOrder: any = {
        customerName: String(orderData.customerName).trim().slice(0, 120),
        customerPhone: String(orderData.customerPhone).trim().slice(0, 40),
        customerEmirate: String(orderData.customerEmirate || "").trim().slice(0, 80),
        customerAddress: String(orderData.customerAddress || "").trim().slice(0, 500),
        notes: String(orderData.notes || "").trim().slice(0, 1000),
        giftNote: String(orderData.giftNote || "").trim().slice(0, 500),
        items, subtotal, deliveryFee, discount: 0, total: subtotal + deliveryFee,
        paymentMethod, paymentStatus: "pending", status: "pending"
      };
      if (!normalizedOrder.customerName || !normalizedOrder.customerPhone || !normalizedOrder.customerAddress) return Response.json({ success: false, error: "Customer name, phone and address are required" }, { status: 400 });
      const result = await createOrderInDb(normalizedOrder, d1);
      if (!result.dbSaved) return Response.json({ success:false, error:"Order could not be durably saved. Please retry." }, { status:503 });
      return Response.json({
        success: true,
        message: "Order placed and saved successfully",
        order: result.order,
        dbSaved: result.dbSaved,
        r2Synced: result.r2Synced,
        storageType: result.storageType,
      });
    } catch (err) {
      console.error("Error creating order in DB:", err);
      return Response.json(
        {
          success: false,
          error: "Failed to persist order in database",
          detail: err instanceof Error ? err.message : "unknown",
        },
        { status: 500 }
      );
    }
  }

  // Admin routes for updating/deleting orders
  const auth = await verifyAdminAuth(request, context);
  if (!auth.authorized) {
    return Response.json(
      { success: false, error: "Unauthorized. Admin credentials required.", code: "UNAUTHORIZED" },
      { status: 401 }
    );
  }

  if (intent === "update_payment") {
    const { orderId, paymentStatus, ziinaPaymentIntentId, ziinaRedirectUrl, transactionId, cardBrand, cardLastFour, orderStatus } = body;
    if (!orderId) {
      return Response.json({ success: false, error: "orderId required" }, { status: 400 });
    }

    try {
      const saved = await updateOrderPaymentInDb(
        orderId,
        paymentStatus || "pending",
        {
          ziinaPaymentIntentId,
          ziinaRedirectUrl,
          transactionId,
          cardBrand,
          cardLastFour,
          orderStatus,
        },
        d1
      );
      if (!saved) return Response.json({ success:false, error:"Payment update could not be persisted" }, { status:503 });
      return Response.json({
        success: true,
        message: "Order payment details updated successfully",
        orderId,
      });
    } catch (err) {
      return Response.json(
        {
          success: false,
          error: "Failed to update order payment details",
          detail: err instanceof Error ? err.message : "unknown",
        },
        { status: 500 }
      );
    }
  }

  if (intent === "update_status" || method === "PATCH") {
    const { orderId, status } = body;
    if (!orderId || !status) {
      return Response.json({ success: false, error: "orderId and status required" }, { status: 400 });
    }

    try {
      const updated = await updateOrderStatusInDb(orderId, status, d1);
      return Response.json({
        success: true,
        message: `Order status updated to: ${status}`,
        order: updated,
      });
    } catch (err) {
      return Response.json(
        {
          success: false,
          error: "Failed to update order status",
          detail: err instanceof Error ? err.message : "unknown",
        },
        { status: 500 }
      );
    }
  }

  if (intent === "delete_order" || method === "DELETE") {
    const { orderId } = body;
    if (!orderId) {
      return Response.json({ success: false, error: "orderId required" }, { status: 400 });
    }

    try {
      await deleteOrderFromDb(orderId, d1);
      return Response.json({
        success: true,
        message: "Order deleted successfully",
        orderId,
      });
    } catch (err) {
      return Response.json(
        {
          success: false,
          error: "Failed to delete order",
          detail: err instanceof Error ? err.message : "unknown",
        },
        { status: 500 }
      );
    }
  }

  return Response.json({ success: false, error: `Unsupported intent: ${intent}` }, { status: 400 });
}
