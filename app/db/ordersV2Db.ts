import type { Order, OrderItem } from "../types/store";
import { fromFils, toFils, type D1DatabaseLike } from "./d1";

type DbRow = Record<string, any>;

function mapPaymentStatus(value: string): Order["paymentStatus"] {
  if (value === "paid") return "paid";
  if (value === "failed" || value === "refunded" || value === "partially_refunded") return "failed";
  if (value === "cancelled") return "cancelled";
  return "pending";
}

function mapOrderStatus(value: string): Order["status"] {
  if (value === "shipped" || value === "delivered" || value === "cancelled") return value;
  if (value === "processing" || value === "confirmed") return "processing";
  return "pending";
}

function mapJoinedRows(rows: DbRow[]): Order[] {
  const grouped = new Map<string, { order: Order; items: OrderItem[] }>();
  for (const row of rows) {
    const id = String(row.id);
    let entry = grouped.get(id);
    if (!entry) {
      entry = {
        order: {
          id,
          orderNumber: String(row.order_number),
          customerName: String(row.customer_name || ""),
          customerPhone: String(row.customer_phone || ""),
          customerEmirate: String(row.emirate || ""),
          customerAddress: String(row.address_line || ""),
          notes: row.customer_notes || undefined,
          giftNote: row.gift_note || undefined,
          items: [],
          subtotal: fromFils(row.subtotal_fils),
          deliveryFee: fromFils(row.delivery_fee_fils),
          discount: fromFils(row.discount_fils),
          total: fromFils(row.total_fils),
          paymentMethod: row.payment_method || "cod",
          paymentStatus: mapPaymentStatus(String(row.payment_status || "pending")),
          ziinaPaymentIntentId: row.provider_payment_id || undefined,
          ziinaRedirectUrl: row.redirect_url || undefined,
          transactionId: row.provider_transaction_id || undefined,
          cardBrand: row.card_brand || undefined,
          cardLastFour: row.card_last_four || undefined,
          status: mapOrderStatus(String(row.status || "pending")),
          createdAt: row.created_at || new Date().toISOString(),
        },
        items: [],
      };
      grouped.set(id, entry);
    }
    if (row.item_id != null) {
      let options: Record<string, any> = {};
      try { options = row.options_json ? JSON.parse(row.options_json) : {}; } catch {}
      entry.items.push({
        productId: row.product_id == null ? "" : String(row.product_id),
        name: String(row.product_name || "Item"),
        quantity: Number(row.quantity || 1),
        price: fromFils(row.unit_price_fils),
        unit: String(row.unit || "item"),
        packagingOption: options.packagingOption || options.packaging_option || undefined,
      });
    }
  }
  return Array.from(grouped.values()).map(({ order, items }) => ({ ...order, items }));
}

export async function initializeD1Schema(db: D1DatabaseLike): Promise<boolean> {
  try {
    await db.prepare("SELECT id, order_number, subtotal_fils FROM orders LIMIT 1").first();
    await db.prepare("SELECT id, unit_price_fils FROM order_items LIMIT 1").first();
    await db.prepare("SELECT id, provider_payment_id FROM payments LIMIT 1").first();
    return true;
  } catch (error) {
    console.error("Teen Liwa v2 order schema is not installed. Apply migrations-v2 first.", error);
    return false;
  }
}

export async function getOrdersFromDb(db?: D1DatabaseLike): Promise<{
  orders: Order[];
  storageType: "d1_database" | "server_persistent_cache";
}> {
  if (!db) return { orders: [], storageType: "server_persistent_cache" };
  const { results } = await db.prepare(`
    SELECT
      o.*,
      pay.provider_payment_id,
      pay.provider_transaction_id,
      pay.redirect_url,
      pay.card_brand,
      pay.card_last_four,
      i.id AS item_id,
      i.product_id,
      i.product_name,
      i.quantity,
      i.unit,
      i.unit_price_fils,
      i.options_json
    FROM orders o
    LEFT JOIN payments pay ON pay.id = (
      SELECT p2.id FROM payments p2 WHERE p2.order_id = o.id
      ORDER BY p2.created_at DESC, p2.id DESC LIMIT 1
    )
    LEFT JOIN order_items i ON i.order_id = o.id
    WHERE o.deleted_at IS NULL
    ORDER BY o.created_at DESC, o.id DESC
    LIMIT 500
  `).bind().all<DbRow>();
  return { orders: mapJoinedRows(results || []), storageType: "d1_database" };
}

function makeOrderNumber(): string {
  const date = new Date();
  const ymd = date.toISOString().slice(2, 10).replace(/-/g, "");
  const random = Array.from(crypto.getRandomValues(new Uint8Array(4)), (v) => v.toString(16).padStart(2, "0")).join("").toUpperCase();
  return "TL-" + ymd + "-" + random;
}

export async function createOrderInDb(
  input: Omit<Order, "id" | "orderNumber" | "createdAt" | "status"> & { status?: Order["status"] },
  db: D1DatabaseLike,
): Promise<{ order: Order; dbSaved: boolean; r2Synced: boolean; storageType: string }> {
  if (!input.customerName?.trim() || !input.customerPhone?.trim() || !input.customerAddress?.trim()) {
    throw new Error("Customer name, phone and address are required");
  }
  if (!Array.isArray(input.items) || input.items.length < 1 || input.items.length > 50) {
    throw new Error("Order must contain between 1 and 50 items");
  }

  const phone = input.customerPhone.trim().slice(0, 30);
  await db.prepare(`
    INSERT INTO customers (full_name, phone, created_at, updated_at)
    VALUES (?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    ON CONFLICT(phone) DO UPDATE SET full_name = excluded.full_name, updated_at = CURRENT_TIMESTAMP
  `).bind(input.customerName.trim().slice(0, 160), phone).run();
  const customer = await db.prepare("SELECT id FROM customers WHERE phone = ? LIMIT 1").bind(phone).first<{ id: number }>();
  const customerId = customer?.id ?? null;

  const orderNumber = makeOrderNumber();
  const subtotalFils = toFils(Number(input.subtotal));
  const deliveryFeeFils = toFils(Number(input.deliveryFee));
  const discountFils = toFils(Number(input.discount || 0));
  const totalFils = toFils(Number(input.total));
  if (totalFils !== subtotalFils + deliveryFeeFils - discountFils) {
    throw new Error("Order totals are inconsistent");
  }
  const paymentMethod = (["cod", "ziina", "card_on_delivery", "whatsapp"].includes(input.paymentMethod)
    ? input.paymentMethod : "cod") as Order["paymentMethod"];
  const initialStatus = input.status || (paymentMethod === "ziina" ? "pending" : "pending");
  const inserted = await db.prepare(`
    INSERT INTO orders (
      order_number, customer_id, customer_name, customer_phone, emirate, address_line,
      subtotal_fils, delivery_fee_fils, discount_fils, tax_fils, total_fils, currency,
      payment_method, payment_status, status, customer_notes, gift_note, source
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, 'AED', ?, 'pending', ?, ?, ?, 'web_store')
    RETURNING id
  `).bind(
    orderNumber, customerId, input.customerName.trim().slice(0, 160), phone,
    String(input.customerEmirate || "").trim().slice(0, 80),
    input.customerAddress.trim().slice(0, 700),
    subtotalFils, deliveryFeeFils, discountFils, totalFils, paymentMethod,
    initialStatus, input.notes?.trim().slice(0, 1000) || null,
    input.giftNote?.trim().slice(0, 500) || null
  ).first<{ id: number }>();
  if (!inserted?.id) throw new Error("Order insert did not return an identifier");
  const orderId = Number(inserted.id);

  const decrementedInventory: Array<{ productId: number; quantity: number }> = [];
  try {
    const statements: Array<ReturnType<D1DatabaseLike["prepare"]>> = [];
    for (const item of input.items) {
      const numericProductId = Number(item.productId);
      const productId = Number.isSafeInteger(numericProductId) && numericProductId > 0 ? numericProductId : null;
      const quantity = Math.floor(Number(item.quantity));
      const priceFils = toFils(Number(item.price));
      if (!Number.isSafeInteger(quantity) || quantity < 1) throw new Error("Invalid order item quantity");
      if (item.trackInventory && productId !== null) {
        const reserved = await db.prepare(`
          UPDATE products
          SET stock_quantity = stock_quantity - ?,
              is_available = CASE WHEN stock_quantity - ? <= 0 THEN 0 ELSE is_available END,
              updated_at = CURRENT_TIMESTAMP
          WHERE id = ? AND track_inventory = 1 AND stock_quantity >= ? AND deleted_at IS NULL
          RETURNING id
        `).bind(quantity, quantity, productId, quantity).first<{ id: number }>();
        if (!reserved) throw new Error("Insufficient stock for " + String(item.name));
        decrementedInventory.push({ productId, quantity });
        statements.push(db.prepare(`
          INSERT INTO inventory_movements (product_id, product_name, quantity_delta, reason, order_id)
          VALUES (?, ?, ?, 'sale', ?)
        `).bind(productId, String(item.name).slice(0, 200), -quantity, orderId));
      }
      statements.push(db.prepare(`
        INSERT INTO order_items (
          order_id, product_id, product_name, quantity, unit, unit_price_fils,
          total_price_fils, options_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        orderId, productId, String(item.name).slice(0, 200), quantity,
        String(item.unit || "item").slice(0, 40), priceFils, priceFils * quantity,
        JSON.stringify({ packagingOption: item.packagingOption || null })
      ));
    }
    statements.push(db.prepare(`
      INSERT INTO order_status_history (order_id, old_status, new_status, reason)
      VALUES (?, NULL, ?, 'Order created')
    `).bind(orderId, initialStatus));
    if (db.batch) await db.batch(statements);
    else for (const statement of statements) await statement.run();
  } catch (error) {
    // Compensate stock reservations if any item insert or reservation failed.
    try { await db.prepare("DELETE FROM inventory_movements WHERE order_id = ?").bind(orderId).run(); } catch {}
    for (const entry of decrementedInventory) {
      try {
        await db.prepare(`
          UPDATE products SET stock_quantity = stock_quantity + ?, is_available = 1,
            updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).bind(entry.quantity, entry.productId).run();
      } catch {}
    }
    await db.prepare("DELETE FROM orders WHERE id = ?").bind(orderId).run();
    throw error;
  }

  await db.prepare(`
    UPDATE customers SET
      total_orders = total_orders + 1,
      total_spent_fils = total_spent_fils + ?,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).bind(totalFils, customerId).run();

  const order = await getOrderById(db, orderId);
  if (!order) throw new Error("Order was saved but could not be reloaded");
  return { order, dbSaved: true, r2Synced: false, storageType: "d1_database" };
}

async function getOrderById(db: D1DatabaseLike, id: number): Promise<Order | null> {
  const result = await getOrdersFromDb(db);
  return result.orders.find((order) => order.id === String(id)) || null;
}

export async function updateOrderStatusInDb(
  orderId: string,
  status: Order["status"],
  db?: D1DatabaseLike,
): Promise<boolean> {
  if (!db || !["pending", "processing", "shipped", "delivered", "cancelled"].includes(status)) return false;
  const existing = await db.prepare("SELECT id, status FROM orders WHERE (CAST(id AS TEXT) = ? OR order_number = ?) AND deleted_at IS NULL LIMIT 1")
    .bind(orderId, orderId).first<{ id: number; status: string }>();
  if (!existing) return false;
  const statements = [
    db.prepare("UPDATE orders SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").bind(status, existing.id),
    db.prepare("INSERT INTO order_status_history (order_id, old_status, new_status, reason) VALUES (?, ?, ?, 'Updated from CMS')").bind(existing.id, existing.status, status),
  ];
  if (db.batch) await db.batch(statements);
  else for (const statement of statements) await statement.run();
  return true;
}

export async function updateOrderPaymentInDb(
  orderId: string,
  paymentStatus: "paid" | "failed" | "pending" | "cancelled",
  details: {
    ziinaPaymentIntentId?: string;
    ziinaRedirectUrl?: string;
    transactionId?: string;
    cardBrand?: string;
    cardLastFour?: string;
    orderStatus?: Order["status"];
  } = {},
  db?: D1DatabaseLike,
): Promise<boolean> {
  if (!db || !["paid", "failed", "pending", "cancelled"].includes(paymentStatus)) return false;
  const order = await db.prepare(`
    SELECT id, total_fils, status FROM orders
    WHERE (CAST(id AS TEXT) = ? OR order_number = ?)
      AND deleted_at IS NULL LIMIT 1
  `).bind(orderId, orderId).first<{ id: number; total_fils: number; status: string }>();
  if (!order) return false;

  const providerPaymentId = details.ziinaPaymentIntentId?.trim() || null;
  const newOrderStatus = details.orderStatus || (paymentStatus === "paid" ? "processing" : order.status);
  const paymentDbStatus = paymentStatus;
  if (providerPaymentId) {
    const key = "ziina-order-" + order.id + "-" + providerPaymentId;
    await db.prepare(`
      INSERT INTO payments (
        order_id, provider, provider_payment_id, provider_transaction_id,
        idempotency_key, amount_fils, currency, status, redirect_url, card_brand, card_last_four
      ) VALUES (?, 'ziina', ?, ?, ?, ?, 'AED', ?, ?, ?, ?)
      ON CONFLICT(provider, provider_payment_id) DO UPDATE SET
        provider_transaction_id = COALESCE(excluded.provider_transaction_id, payments.provider_transaction_id),
        status = excluded.status,
        redirect_url = COALESCE(excluded.redirect_url, payments.redirect_url),
        card_brand = COALESCE(excluded.card_brand, payments.card_brand),
        card_last_four = COALESCE(excluded.card_last_four, payments.card_last_four),
        updated_at = CURRENT_TIMESTAMP
    `).bind(
      order.id, providerPaymentId, details.transactionId || null, key, order.total_fils,
      paymentDbStatus, details.ziinaRedirectUrl || null, details.cardBrand || null, details.cardLastFour || null
    ).run();
  } else {
    const latest = await db.prepare("SELECT id FROM payments WHERE order_id = ? ORDER BY id DESC LIMIT 1")
      .bind(order.id).first<{ id: number }>();
    if (latest) {
      await db.prepare(`
        UPDATE payments SET status = ?, provider_transaction_id = COALESCE(?, provider_transaction_id),
          card_brand = COALESCE(?, card_brand), card_last_four = COALESCE(?, card_last_four),
          updated_at = CURRENT_TIMESTAMP WHERE id = ?
      `).bind(paymentDbStatus, details.transactionId || null, details.cardBrand || null, details.cardLastFour || null, latest.id).run();
    } else {
      await db.prepare(`
        INSERT INTO payments (order_id, provider, idempotency_key, amount_fils, currency, status, provider_transaction_id, card_brand, card_last_four)
        VALUES (?, 'ziina', ?, ?, 'AED', ?, ?, ?, ?)
      `).bind(order.id, "manual-payment-" + order.id + "-" + Date.now(), order.total_fils,
        paymentDbStatus, details.transactionId || null, details.cardBrand || null, details.cardLastFour || null).run();
    }
  }

  await db.prepare(`
    UPDATE orders SET payment_status = ?, status = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).bind(paymentDbStatus, newOrderStatus, order.id).run();
  return true;
}

export async function deleteOrderFromDb(orderId: string, db?: D1DatabaseLike): Promise<boolean> {
  if (!db) return false;
  const existing = await db.prepare(`
    SELECT id FROM orders
    WHERE (CAST(id AS TEXT) = ? OR order_number = ?) AND deleted_at IS NULL LIMIT 1
  `).bind(orderId, orderId).first<{ id: number }>();
  if (!existing) return false;
  const result: any = await db.prepare(`
    UPDATE orders SET deleted_at = CURRENT_TIMESTAMP, status = 'cancelled',
      updated_at = CURRENT_TIMESTAMP WHERE id = ? AND deleted_at IS NULL
  `).bind(existing.id).run();
  return Number(result?.meta?.changes ?? result?.meta?.rows_written ?? 0) > 0;
}
